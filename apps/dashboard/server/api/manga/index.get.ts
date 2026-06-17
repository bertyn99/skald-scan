import { chapters, manga } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { and, count, desc, eq, isNull, like } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventQuery } from '../../utils/storage'

const DEFAULT_LIMIT = 100

export default defineEventHandler(async (event) => {
  const query = readEventQuery(event)
  const limit = parseIntegerQuery(query.limit, DEFAULT_LIMIT)
  const offset = parseIntegerQuery(query.offset, 0)
  const search = typeof query.q === 'string' ? query.q.trim() : ''
  const status = typeof query.status === 'string' ? query.status.trim() : ''

  if (limit < 1 || limit > DEFAULT_LIMIT) {
    throw createError({ statusCode: 400, statusMessage: `limit must be between 1 and ${DEFAULT_LIMIT}` })
  }

  if (offset < 0) {
    throw createError({ statusCode: 400, statusMessage: 'offset must be 0 or greater' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const filters = [isNull(manga.deletedAt)]
  if (search) {
    filters.push(like(manga.title, `%${search}%`))
  }
  if (status) {
    filters.push(eq(manga.status, status))
  }

  const rows = await db.select({
    id: manga.id,
    title: manga.title,
    coverUrl: manga.coverUrl,
    status: manga.status,
    updatedAt: manga.updatedAt,
    chapterCount: count(chapters.id),
  })
    .from(manga)
    .leftJoin(chapters, eq(chapters.mangaId, manga.id))
    .where(and(...filters))
    .groupBy(manga.id)
    .orderBy(desc(manga.updatedAt), desc(manga.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  return {
    manga: rows.map((row) => ({
      id: row.id,
      title: row.title,
      coverUrl: row.coverUrl,
      status: row.status,
      chapterCount: Number(row.chapterCount) || 0,
      updatedAt: row.updatedAt ?? 0,
    })),
  }
})

const parseIntegerQuery = (value: unknown, fallback: number): number => {
  if (value === undefined) {
    return fallback
  }

  const normalized = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(String(normalized), 10)

  return Number.isFinite(parsed) ? parsed : fallback
}
