import { chapters, mangaDexSync, processedJobs } from '@skald-scan/shared'
import type { MangaDexClient } from '@skald-scan/shared'
import { ChapterStatus, SyncStatus } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'

type D1Database = Parameters<typeof drizzle>[0]

interface DownloadPagesMessage {
  jobId: string
  mangaId: string
  chapterId: string
  mangaDexChapterId: string
  type: 'download-pages'
}

interface QueueBinding {
  send: (message: DownloadPagesMessage) => Promise<void>
}

export async function handleSyncChapters(
  message: { jobId: string; mangaId: string; mangaDexId: string; type: 'sync-chapters' },
  env: { DB: D1Database; MANGADEX_SYNC_QUEUE: QueueBinding },
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
    const chaptersResponse = await client.getMangaChapters(message.mangaDexId, { language: 'en' })

    const existingChapters = await db.select({ mangaDexChapterId: chapters.mangaDexChapterId })
      .from(chapters)
      .where(eq(chapters.mangaId, message.mangaId))
      .all()

    const existingIds = new Set(existingChapters.map(c => c.mangaDexChapterId))

    const newMdChapters = chaptersResponse.data.filter(ch => !existingIds.has(ch.id))

    for (const mdChapter of newMdChapters) {
      const chapterNumber = Number.parseFloat(mdChapter.attributes.chapter ?? '0')
      if (!Number.isFinite(chapterNumber)) continue

      const chapterId = crypto.randomUUID()

      await db.insert(chapters).values({
        id: chapterId,
        mangaId: message.mangaId,
        title: mdChapter.attributes.title ?? `Chapter ${chapterNumber}`,
        chapterNumber,
        language: mdChapter.attributes.translatedLanguage?.[0] ?? 'en',
        pagesCount: mdChapter.attributes.pages ?? 0,
        status: ChapterStatus.Available,
        scanlator: mdChapter.relationships?.find(r => r.type === 'scanlation_group')?.id ?? null,
        mangaDexChapterId: mdChapter.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      if (mdChapter.id) {
        await env.MANGADEX_SYNC_QUEUE.send({
          jobId: crypto.randomUUID(),
          mangaId: message.mangaId,
          chapterId,
          mangaDexChapterId: mdChapter.id,
          type: 'download-pages',
        })
      }
    }

    await db.update(mangaDexSync)
      .set({ syncStatus: SyncStatus.Idle, lastSyncedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(mangaDexSync.mangaId, message.mangaId))

    await db.update(processedJobs)
      .set({ status: 'completed', metadata: JSON.stringify({ newChapters: newMdChapters.length }) })
      .where(eq(processedJobs.jobId, message.jobId))
  } catch (error) {
    await db.update(mangaDexSync)
      .set({ syncStatus: SyncStatus.Error, lastError: String(error), updatedAt: Date.now() })
      .where(eq(mangaDexSync.mangaId, message.mangaId))

    await db.update(processedJobs)
      .set({ status: 'failed', metadata: JSON.stringify({ error: String(error) }) })
      .where(eq(processedJobs.jobId, message.jobId))
    throw error
  }
}
