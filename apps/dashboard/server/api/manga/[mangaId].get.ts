import { chapters, manga, mangaDexSync } from '@skald-scan/shared'
import { ChapterStatus } from '@skald-scan/shared'
import { eq, asc, and, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { useDrizzle, readEventParam } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')

  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const db = useDrizzle(event)

  const item = await db.select({
    id: manga.id,
    title: manga.title,
    description: manga.description,
    coverUrl: manga.coverUrl,
    status: manga.status,
    mangaDexId: manga.mangaDexId,
    author: manga.author,
    artist: manga.artist,
    tags: manga.tags,
    createdAt: manga.createdAt,
    updatedAt: manga.updatedAt
  })
    .from(manga)
    .where(and(eq(manga.id, mangaId), isNull(manga.deletedAt)))
    .get()

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Manga not found' })
  }

  const chapterItems = await db.select({
    id: chapters.id,
    title: chapters.title,
    chapterNumber: chapters.chapterNumber,
    language: chapters.language,
    pagesCount: chapters.pagesCount,
    status: chapters.status
  })
    .from(chapters)
    .where(eq(chapters.mangaId, mangaId))
    .orderBy(asc(chapters.chapterNumber))
    .all()

  const syncRow = await db.select({
    syncStatus: mangaDexSync.syncStatus,
    lastSyncedAt: mangaDexSync.lastSyncedAt,
    lastError: mangaDexSync.lastError,
    remoteChapterCount: mangaDexSync.remoteChapterCount
  })
    .from(mangaDexSync)
    .where(eq(mangaDexSync.mangaId, mangaId))
    .get()

  const imported = chapterItems.filter(c => c.status === ChapterStatus.Available).length
  const importing = chapterItems.filter(c => c.status === ChapterStatus.Processing).length
  const total = syncRow?.remoteChapterCount ?? chapterItems.length

  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')

  return {
    manga: {
      ...item,
      chapterCount: chapterItems.length
    },
    chapters: chapterItems,
    sync: syncRow
      ? {
          status: syncRow.syncStatus,
          lastSyncedAt: syncRow.lastSyncedAt ?? null,
          lastError: syncRow.lastError ?? null
        }
      : null,
    chapterStats: {
      importing,
      imported,
      total
    }
  }
})
