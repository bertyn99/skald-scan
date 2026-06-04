import { pages, processedJobs } from '@skald-scan/shared'
import type { MangaDexClient } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'

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
  const db = drizzle(env.DB)

  const existing = await db.select({ jobId: processedJobs.jobId })
    .from(processedJobs)
    .where(eq(processedJobs.jobId, message.jobId))
    .get()

  if (existing) {
    return
  }

  await db.insert(processedJobs).values({
    jobId: message.jobId,
    status: 'processing',
  })

  try {
    const pagesData = await client.getChapterPages(message.mangaDexChapterId)


    const pageValues = pagesData.map((page, index) => ({
      id: crypto.randomUUID(),
      chapterId: message.chapterId,
      pageNumber: index + 1,
      imageUrl: page.url,
      createdAt: Date.now(),
    }))

    for (const pv of pageValues) {
      await db.insert(pages).values(pv).onConflictDoNothing()
    }

    await db.update(processedJobs)
      .set({ status: 'completed', metadata: JSON.stringify({ pagesCount: pagesData.length }) })
      .where(eq(processedJobs.jobId, message.jobId))
  } catch (error) {
    await db.update(processedJobs)
      .set({ status: 'failed', metadata: JSON.stringify({ error: String(error) }) })
      .where(eq(processedJobs.jobId, message.jobId))
    throw error
  }
}
