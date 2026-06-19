import { chapters, manga, readingProgress } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, requireAuthenticatedSession } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)

  const userId = event.context.authSession?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const rows = await db.select({
    mangaId: readingProgress.mangaId,
    chapterId: readingProgress.chapterId,
    lastPageRead: readingProgress.lastPageRead,
    lastReadAt: readingProgress.lastReadAt,
    chapterNumber: chapters.chapterNumber
  })
    .from(readingProgress)
    .innerJoin(chapters, eq(readingProgress.chapterId, chapters.id))
    .where(eq(readingProgress.userId, userId))
    .orderBy(desc(readingProgress.lastReadAt))
    .all()

  const mangaIds = [...new Set(rows.map(r => r.mangaId))]
  if (mangaIds.length === 0) {
    return { items: [] }
  }

  const mangaRows = await db.select({
    id: manga.id,
    title: manga.title,
    coverUrl: manga.coverUrl,
    status: manga.status,
    updatedAt: manga.updatedAt
  })
    .from(manga)
    .where(inArray(manga.id, mangaIds))
    .all()

  const mangaMap = new Map(mangaRows.map(m => [m.id, m]))
  const latestByManga = new Map<string, typeof rows[number]>()

  for (const row of rows) {
    if (!latestByManga.has(row.mangaId)) {
      latestByManga.set(row.mangaId, row)
    }
  }

  const items = [...latestByManga.values()].map((row) => {
    const m = mangaMap.get(row.mangaId)
    return {
      mangaId: row.mangaId,
      title: m?.title ?? 'Unknown',
      coverUrl: m?.coverUrl ?? null,
      status: m?.status ?? 'ongoing',
      chapterId: row.chapterId,
      chapterNumber: row.chapterNumber,
      lastPageRead: row.lastPageRead,
      lastReadAt: row.lastReadAt ?? 0
    }
  })

  return { items }
})
