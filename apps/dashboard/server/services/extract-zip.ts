import { unzipSync } from 'fflate'
import { chapters, ChapterStatus, pages } from '@skald-scan/shared'
import { eq } from 'drizzle-orm'

import { type D1Binding, useDrizzle } from '../utils/drizzle'
import { buildPageR2Key, claimQueueJob, completeQueueJob, failQueueJob, type StorageBucketBinding } from '../utils/storage'

export type ExtractZipEnv = {
  DB: D1Binding
  STORAGE: StorageBucketBinding
}

export type ExtractZipMessage = {
  type: 'extract-zip'
  jobId: string
  mangaId: string
  chapterId: string
  tempR2Key: string
  pageOrder?: string[]
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const INSERT_CHUNK_SIZE = 10

function detectContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    default: return 'application/octet-stream'
  }
}

function isImageFile(fileName: string): boolean {
  const normalized = fileName.replace(/\\/g, '/')
  if (normalized.startsWith('.') || normalized.includes('/.')) {
    return false
  }
  if (normalized.startsWith('__MACOSX/')) {
    return false
  }
  const ext = normalized.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(ext)
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function orderEntries(
  entries: Array<[string, Uint8Array]>,
  pageOrder?: string[]
): Array<[string, Uint8Array]> {
  if (!pageOrder || pageOrder.length === 0) {
    return entries.sort(([a], [b]) => naturalCompare(a, b))
  }

  const orderMap = new Map(pageOrder.map((name, index) => [name, index]))
  return entries.sort(([a], [b]) => {
    const ai = orderMap.get(a)
    const bi = orderMap.get(b)
    if (ai !== undefined && bi !== undefined) return ai - bi
    if (ai !== undefined) return -1
    if (bi !== undefined) return 1
    return naturalCompare(a, b)
  })
}

export async function handleExtractZip(
  message: ExtractZipMessage,
  env: ExtractZipEnv
): Promise<void> {
  const db = useDrizzle(env.DB)

  if (!(await claimQueueJob(env.DB, message.jobId))) {
    return
  }

  try {
    const zipObject = await env.STORAGE.get(message.tempR2Key)
    if (!zipObject) {
      throw new Error(`ZIP not found in R2 at key: ${message.tempR2Key}`)
    }

    const arrayBuffer = zipObject.body
      ? await new Response(zipObject.body).arrayBuffer()
      : new ArrayBuffer(0)
    const decompressed = unzipSync(new Uint8Array(arrayBuffer))

    const imageEntries = orderEntries(
      Object.entries(decompressed).filter(([fileName]) => isImageFile(fileName)),
      message.pageOrder
    )

    if (imageEntries.length === 0) {
      throw new Error(`No image files found in ZIP: ${message.tempR2Key}`)
    }

    const pageRows: Array<{
      id: string
      chapterId: string
      pageNumber: number
      imageUrl: string
      r2Key: string
    }> = []

    for (let index = 0; index < imageEntries.length; index++) {
      const entry = imageEntries[index]
      if (!entry) continue
      const [fileName, fileData] = entry
      const pageNumber = index + 1
      const r2Key = buildPageR2Key(message.mangaId, message.chapterId, pageNumber)
      const contentType = detectContentType(fileName)

      await env.STORAGE.put(r2Key, fileData, {
        httpMetadata: { contentType }
      })

      pageRows.push({
        id: crypto.randomUUID(),
        chapterId: message.chapterId,
        pageNumber,
        imageUrl: `/api/manga/${message.mangaId}/chapters/${message.chapterId}/pages/${pageNumber}`,
        r2Key
      })
    }

    for (let i = 0; i < pageRows.length; i += INSERT_CHUNK_SIZE) {
      await db.insert(pages).values(pageRows.slice(i, i + INSERT_CHUNK_SIZE))
    }

    await db.update(chapters)
      .set({
        status: ChapterStatus.Available,
        pagesCount: pageRows.length
      })
      .where(eq(chapters.id, message.chapterId))

    if (env.STORAGE.delete) {
      await env.STORAGE.delete(message.tempR2Key)
    }

    await completeQueueJob(env.DB, message.jobId, { pagesCount: pageRows.length })
  } catch (error) {
    await failQueueJob(env.DB, message.jobId, error)

    console.error(JSON.stringify({
      level: 'error',
      message: 'ZIP extraction job failed',
      jobId: message.jobId,
      mangaId: message.mangaId,
      chapterId: message.chapterId,
      tempR2Key: message.tempR2Key,
      error: String(error)
    }))

    throw error
  }
}
