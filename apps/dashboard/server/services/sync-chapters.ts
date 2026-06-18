import { chapters, mangaDexSync } from '@skald-scan/shared'
import type { MangaDexClient } from '@skald-scan/shared'
import { ChapterStatus, SyncStatus } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, inArray } from 'drizzle-orm'

import { dispatchSyncQueueMessage, type SyncQueueRuntimeEnv } from '../utils/sync-queue'
import { claimQueueJob, completeQueueJob, failQueueJob } from '../utils/storage'

export async function handleSyncChapters(
  message: { jobId: string; mangaId: string; mangaDexId: string; type: 'sync-chapters' },
  env: SyncQueueRuntimeEnv,
  client: MangaDexClient,
): Promise<void> {
  if (!(await claimQueueJob(env.DB, message.jobId))) {
    return
  }

  const db = drizzle(env.DB)

  try {
    const chaptersResponse = await client.getMangaChapters(message.mangaDexId, { language: 'en' })

    const existingChapters = await db.select({ mangaDexChapterId: chapters.mangaDexChapterId })
      .from(chapters)
      .where(eq(chapters.mangaId, message.mangaId))
      .all()

    const existingIds = new Set(existingChapters.map(c => c.mangaDexChapterId))

    const newMdChapters = chaptersResponse.data.filter(ch => !existingIds.has(ch.id))

    // Build chapter records, filtering out invalid chapter numbers
    const now = Date.now()
    const chapterRecords = newMdChapters
      .map((mdChapter) => {
        const chapterNumber = Number.parseFloat(mdChapter.attributes.chapter ?? '0')
        if (!Number.isFinite(chapterNumber)) return null
        return {
          id: crypto.randomUUID(),
          mangaId: message.mangaId,
          title: mdChapter.attributes.title ?? `Chapter ${chapterNumber}`,
          chapterNumber,
          language: mdChapter.attributes.translatedLanguage ?? 'en',
          pagesCount: mdChapter.attributes.pages ?? 0,
          status: ChapterStatus.Available,
          scanlator: mdChapter.relationships?.find(r => r.type === 'scanlation_group')?.id ?? null,
          mangaDexChapterId: mdChapter.id,
          createdAt: now,
          updatedAt: now,
        }
      })
      .filter((record): record is NonNullable<typeof record> => record !== null)

    // Batch insert chapters (chunked to respect D1 parameter limits)
    const CHAPTER_CHUNK_SIZE = 9
    for (let i = 0; i < chapterRecords.length; i += CHAPTER_CHUNK_SIZE) {
      const chunk = chapterRecords.slice(i, i + CHAPTER_CHUNK_SIZE)
      await db.insert(chapters).values(chunk).onConflictDoNothing()
    }

    // Enqueue download-pages for each new chapter
    for (const record of chapterRecords) {
      try {
        await dispatchSyncQueueMessage(env, {
          jobId: crypto.randomUUID(),
          mangaId: message.mangaId,
          chapterId: record.id,
          mangaDexChapterId: record.mangaDexChapterId,
          type: 'download-pages',
        }, client)
      } catch (error) {
        console.error(JSON.stringify({
          level: 'warn',
          message: 'Page download failed for chapter',
          chapterId: record.id,
          mangaDexChapterId: record.mangaDexChapterId,
          error: String(error),
        }))
      }
    }

    // Soft-delete chapters that no longer exist on MangaDex
    const mdChapterIds = new Set(chaptersResponse.data.map((c) => c.id))
    const allExistingChapters = await db.select({ id: chapters.id, mangaDexChapterId: chapters.mangaDexChapterId })
      .from(chapters)
      .where(eq(chapters.mangaId, message.mangaId))
      .all()

    const removedChapterIds = allExistingChapters
      .filter((c) => c.mangaDexChapterId && !mdChapterIds.has(c.mangaDexChapterId))
      .map((c) => c.id)

    if (removedChapterIds.length > 0) {
      for (let i = 0; i < removedChapterIds.length; i += 50) {
        const chunk = removedChapterIds.slice(i, i + 50)
        await db.update(chapters)
          .set({ status: ChapterStatus.Unavailable, updatedAt: Date.now() })
          .where(inArray(chapters.id, chunk))
      }
    }

    await db.update(mangaDexSync)
      .set({
        syncStatus: SyncStatus.Idle,
        remoteChapterCount: chaptersResponse.total,
        lastSyncedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(mangaDexSync.mangaId, message.mangaId))

    await completeQueueJob(env.DB, message.jobId, { newChapters: chapterRecords.length })
  } catch (error) {
    await db.update(mangaDexSync)
      .set({ syncStatus: SyncStatus.Error, lastError: String(error), updatedAt: Date.now() })
      .where(eq(mangaDexSync.mangaId, message.mangaId))

    await failQueueJob(env.DB, message.jobId, error)
    throw error
  }
}
