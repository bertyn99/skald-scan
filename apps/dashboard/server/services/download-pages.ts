import { pages } from '@skald-scan/shared'
import type { MangaDexClient } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'

import { claimQueueJob, completeQueueJob, failQueueJob } from '../utils/storage'

type D1Database = Parameters<typeof drizzle>[0]

interface DownloadPagesMessage {
  jobId: string
  mangaId: string
  chapterId: string
  mangaDexChapterId: string
  type: 'download-pages'
}

export async function handleDownloadPages(
  message: DownloadPagesMessage,
  env: { DB: D1Database },
  client: MangaDexClient,
): Promise<void> {
  if (!(await claimQueueJob(env.DB, message.jobId))) {
    return
  }

  const db = drizzle(env.DB)

  try {
    const pagesData = await client.getChapterPages(message.mangaDexChapterId)


    const pageValues = pagesData.map((page, index) => ({
      id: crypto.randomUUID(),
      chapterId: message.chapterId,
      pageNumber: index + 1,
      imageUrl: page.url,
      createdAt: Date.now(),
    }))

    // Chunk into batches to respect D1 parameter limits
    const CHUNK_SIZE = 10
    for (let i = 0; i < pageValues.length; i += CHUNK_SIZE) {
      const chunk = pageValues.slice(i, i + CHUNK_SIZE)
      await db.insert(pages).values(chunk).onConflictDoNothing()
    }

    await completeQueueJob(env.DB, message.jobId, { pagesCount: pagesData.length })
  } catch (error) {
    await failQueueJob(env.DB, message.jobId, error)
    console.error(JSON.stringify({
      level: 'error',
      message: 'Page download job failed',
      jobId: message.jobId,
      chapterId: message.chapterId,
      error: String(error),
    }))
    throw error
  }
}
