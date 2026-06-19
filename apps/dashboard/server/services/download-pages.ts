import { chapters, ChapterStatus, pages } from '@skald-scan/shared'
import type { MangaDexClient } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'

import {
  buildPageR2Key,
  claimQueueJob,
  completeQueueJob,
  failQueueJob,
  type StorageBucketBinding
} from '../utils/storage'

type D1Database = Parameters<typeof drizzle>[0]

interface DownloadPagesMessage {
  jobId: string
  mangaId: string
  chapterId: string
  mangaDexChapterId: string
  type: 'download-pages'
}

export type DownloadPagesEnv = {
  DB: D1Database
  STORAGE: StorageBucketBinding
}

export async function handleDownloadPages(
  message: DownloadPagesMessage,
  env: DownloadPagesEnv,
  client: MangaDexClient,
): Promise<void> {
  if (!(await claimQueueJob(env.DB, message.jobId))) {
    return
  }

  const db = drizzle(env.DB)

  try {
    await db.update(chapters)
      .set({ status: ChapterStatus.Processing, updatedAt: Date.now() })
      .where(eq(chapters.id, message.chapterId))

    const pagesData = await client.getChapterPages(message.mangaDexChapterId)

    const pageValues: Array<{
      id: string
      chapterId: string
      pageNumber: number
      imageUrl: string
      r2Key: string
      fileSize: number
      createdAt: number
    }> = []

    for (const [index, page] of pagesData.entries()) {
      const pageNumber = index + 1
      const r2Key = buildPageR2Key(message.mangaId, message.chapterId, pageNumber)

      const imageResponse = await fetch(page.url)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch page ${pageNumber}: ${imageResponse.status}`)
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const contentType = imageResponse.headers.get('content-type') ?? 'image/webp'

      await env.STORAGE.put(r2Key, imageBuffer, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable'
        }
      })

      pageValues.push({
        id: crypto.randomUUID(),
        chapterId: message.chapterId,
        pageNumber,
        imageUrl: page.url,
        r2Key,
        fileSize: imageBuffer.byteLength,
        createdAt: Date.now()
      })
    }

    const CHUNK_SIZE = 10
    for (let i = 0; i < pageValues.length; i += CHUNK_SIZE) {
      const chunk = pageValues.slice(i, i + CHUNK_SIZE)
      await db.insert(pages).values(chunk).onConflictDoNothing()
    }

    await db.update(chapters)
      .set({
        pagesCount: pageValues.length,
        status: ChapterStatus.Available,
        updatedAt: Date.now()
      })
      .where(eq(chapters.id, message.chapterId))

    await completeQueueJob(env.DB, message.jobId, { pagesCount: pageValues.length })
  } catch (error) {
    await db.update(chapters)
      .set({ status: ChapterStatus.Unavailable, updatedAt: Date.now() })
      .where(eq(chapters.id, message.chapterId))

    await failQueueJob(env.DB, message.jobId, error)
    console.error(JSON.stringify({
      level: 'error',
      message: 'Page download job failed',
      jobId: message.jobId,
      chapterId: message.chapterId,
      error: String(error)
    }))
    throw error
  }
}
