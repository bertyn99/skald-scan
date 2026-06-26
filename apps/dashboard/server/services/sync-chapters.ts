import {
  DEFAULT_LANGUAGES,
  chapters,
  mangaDexSync,
  mangaTranslations,
  parseLanguageList
} from '@skald-scan/shared'
import type { MangaDexChapter, MangaDexClient } from '@skald-scan/shared'
import { ChapterStatus, SyncStatus } from '@skald-scan/shared'
import { count, eq, inArray } from 'drizzle-orm'

import { dispatchSyncQueueMessage, type SyncQueueRuntimeEnv } from '../utils/sync-queue'
import { claimQueueJob, completeQueueJob, failQueueJob, purgeChapterStorage } from '../utils/storage'
import { useDrizzle } from '../utils/drizzle'
import { refreshMangaTranslations } from '../utils/translations'

// Bounds lazy metadata refresh in handleSyncChapters. Without this, the 30-min
// cron would call getManga on every manga every run.
const METADATA_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

export async function handleSyncChapters(
  message: { jobId: string; mangaId: string; mangaDexId: string; type: 'sync-chapters' },
  env: SyncQueueRuntimeEnv,
  client: MangaDexClient,
): Promise<void> {
  if (!(await claimQueueJob(env.DB, message.jobId))) {
    return
  }

  const db = useDrizzle(env.DB)

  try {
    const syncRow = await db.select({
      languages: mangaDexSync.languages,
      lastMetadataRefreshAt: mangaDexSync.lastMetadataRefreshAt
    })
      .from(mangaDexSync)
      .where(eq(mangaDexSync.mangaId, message.mangaId))
      .get()

    const lastMetadataRefreshAt = syncRow?.lastMetadataRefreshAt ?? null

    // syncRow.languages is JSON text — parse with fallback to DEFAULT_LANGUAGES.
    const configuredLanguages = parseLanguageList(
      syncRow?.languages ? safeJsonParse(syncRow.languages) : DEFAULT_LANGUAGES
    )

    // One paginated call across all configured languages. Avoids N rate-limit
    // trips and dedups against the union naturally.
    const { data: allMdChapters, total } = await client.getAllMangaChapters(
      message.mangaDexId,
      { language: configuredLanguages }
    )

    // Bounded lazy metadata refresh: when translations are sparse AND the last
    // refresh is older than 24h (or never happened), re-fetch manga metadata
    // and run the same atomic upsert as import-manga. Caps at 1/day/manga.
    await maybeRefreshMetadata({
      db,
      env,
      client,
      mangaId: message.mangaId,
      mangaDexId: message.mangaDexId,
      configuredLanguages,
      translationCount: await countTranslations(db, message.mangaId),
      lastMetadataRefreshAt
    })

    const existingChapters = await db.select({
      id: chapters.id,
      mangaDexChapterId: chapters.mangaDexChapterId
    })
      .from(chapters)
      .where(eq(chapters.mangaId, message.mangaId))
      .all()

    const existingIds = new Set(existingChapters.map(c => c.mangaDexChapterId))
    const newMdChapters = allMdChapters.filter(ch => !existingIds.has(ch.id))

    // Build chapter records, filtering out invalid chapter numbers.
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
          status: ChapterStatus.Processing,
          scanlator: mdChapter.relationships?.find(r => r.type === 'scanlation_group')?.id ?? null,
          mangaDexChapterId: mdChapter.id
        }
      })
      .filter((record): record is NonNullable<typeof record> => record !== null)

    // Batch insert chapters (chunked to respect D1 parameter limits).
    const CHAPTER_CHUNK_SIZE = 9
    for (let i = 0; i < chapterRecords.length; i += CHAPTER_CHUNK_SIZE) {
      const chunk = chapterRecords.slice(i, i + CHAPTER_CHUNK_SIZE)
      await db.insert(chapters).values(chunk).onConflictDoNothing()
    }

    // Enqueue download-pages for each new chapter that actually has pages.
    // MangaDex returns 0-page chapters for deleted uploads — skip them or they
    // get stuck in Processing. Dispatch in parallel; queue send is cheap.
    const downloadable = chapterRecords.filter(r => (r.pagesCount ?? 0) > 0)
    await Promise.all(downloadable.map((record) =>
      dispatchSyncQueueMessage(env, {
        jobId: crypto.randomUUID(),
        mangaId: message.mangaId,
        chapterId: record.id,
        mangaDexChapterId: record.mangaDexChapterId,
        type: 'download-pages'
      }, client).catch((error) => {
        console.error(JSON.stringify({
          level: 'warn',
          message: 'Page download failed for chapter',
          chapterId: record.id,
          mangaDexChapterId: record.mangaDexChapterId,
          error: String(error)
        }))
      })
    ))

    // Soft-delete chapters that no longer exist remotely across ANY language.
    // The union across languages is implicit because allMdChapters contains
    // every chapter MangaDex returned for the configured language set.
    const mdChapterIds = new Set(allMdChapters.map((c: MangaDexChapter) => c.id))
    const removedChapterIds = existingChapters
      .filter((c) => c.mangaDexChapterId && !mdChapterIds.has(c.mangaDexChapterId))
      .map((c) => c.id)

    if (removedChapterIds.length > 0) {
      // Mark unavailable + reclaim R2 storage + hard-delete page rows.
      // Pages rows do not auto-cascade on status update, so purge explicitly.
      for (let i = 0; i < removedChapterIds.length; i += 50) {
        const chunk = removedChapterIds.slice(i, i + 50)
        await db.update(chapters)
          .set({ status: ChapterStatus.Unavailable })
          .where(inArray(chapters.id, chunk))
      }
      await purgeChapterStorage(env, removedChapterIds)
    }

    await db.update(mangaDexSync)
      .set({
        syncStatus: SyncStatus.Idle,
        remoteChapterCount: total,
        lastSyncedAt: new Date()
      })
      .where(eq(mangaDexSync.mangaId, message.mangaId))

    await completeQueueJob(env.DB, message.jobId, { newChapters: chapterRecords.length })
  } catch (error) {
    await db.update(mangaDexSync)
      .set({ syncStatus: SyncStatus.Error, lastError: String(error) })
      .where(eq(mangaDexSync.mangaId, message.mangaId))

    await failQueueJob(env.DB, message.jobId, error)
    throw error
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function countTranslations(db: ReturnType<typeof useDrizzle>, mangaId: string): Promise<number> {
  const row = await db.select({ c: count() })
    .from(mangaTranslations)
    .where(eq(mangaTranslations.mangaId, mangaId))
    .get()
  return Number(row?.c ?? 0)
}

interface MetadataRefreshArgs {
  db: ReturnType<typeof useDrizzle>
  env: SyncQueueRuntimeEnv
  client: MangaDexClient
  mangaId: string
  mangaDexId: string
  configuredLanguages: string[]
  translationCount: number
  lastMetadataRefreshAt: Date | null
}

async function maybeRefreshMetadata(args: MetadataRefreshArgs): Promise<void> {
  const needsRefresh = args.translationCount < args.configuredLanguages.length
    && (!args.lastMetadataRefreshAt
      || args.lastMetadataRefreshAt.getTime() < Date.now() - METADATA_REFRESH_INTERVAL_MS)

  // Always bump the timestamp so we don't retry every cron tick even on failure.
  await db_updateMetadataRefresh(args.db, args.mangaId)

  if (!needsRefresh || !args.mangaDexId) return

  try {
    const mdResp = await args.client.getManga(args.mangaDexId)
    await refreshMangaTranslations(args.db, args.mangaId, mdResp.data, args.configuredLanguages)
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Metadata refresh failed',
      mangaId: args.mangaId,
      mangaDexId: args.mangaDexId,
      error: String(error)
    }))
  }
}

async function db_updateMetadataRefresh(db: ReturnType<typeof useDrizzle>, mangaId: string): Promise<void> {
  await db.update(mangaDexSync)
    .set({ lastMetadataRefreshAt: new Date() })
    .where(eq(mangaDexSync.mangaId, mangaId))
}
