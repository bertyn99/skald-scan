import { chapters, manga } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { getDatabaseFromEvent, readEventQuery } from '../../utils/storage'

const DEFAULT_LIMIT = 100
const CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'

const buildFtsQuery = (search: string): string => `"${search.replace(/"/g, '""')}"*`

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

  const selectShape = {
    id: manga.id,
    title: manga.title,
    coverUrl: manga.coverUrl,
    status: manga.status,
    updatedAt: manga.updatedAt,
    chapterCount: count(chapters.id)
  }

  const baseFilters = [isNull(manga.deletedAt)]
  if (status) {
    baseFilters.push(eq(manga.status, status))
  }

  const rows = search
    ? await db.select(selectShape)
      .from(manga)
      .innerJoin(sql`manga_fts`, sql`manga_fts.rowid = manga.rowid`)
      .leftJoin(chapters, eq(chapters.mangaId, manga.id))
      .where(and(sql`manga_fts MATCH ${buildFtsQuery(search)}`, ...baseFilters))
      .groupBy(manga.id)
      .orderBy(sql`rank`)
      .limit(limit)
      .offset(offset)
      .all()
    : await db.select(selectShape)
      .from(manga)
      .leftJoin(chapters, eq(chapters.mangaId, manga.id))
      .where(and(...baseFilters))
      .groupBy(manga.id)
      .orderBy(desc(manga.updatedAt), desc(manga.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

  const totalRow = search
    ? await db.select({ total: sql<number>`count(*)` })
      .from(manga)
      .innerJoin(sql`manga_fts`, sql`manga_fts.rowid = manga.rowid`)
      .where(and(sql`manga_fts MATCH ${buildFtsQuery(search)}`, ...baseFilters))
      .get()
    : await db.select({ total: sql<number>`count(*)` })
      .from(manga)
      .where(and(...baseFilters))
      .get()
  const total = Number(totalRow?.total ?? 0)

  setResponseHeader(event, 'Cache-Control', CACHE_CONTROL)

  return {
    manga: rows.map((row) => ({
      id: row.id,
      title: row.title,
      coverUrl: row.coverUrl,
      status: row.status,
      chapterCount: Number(row.chapterCount) || 0,
      updatedAt: row.updatedAt ?? 0
    })),
    total,
    limit,
    offset
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
