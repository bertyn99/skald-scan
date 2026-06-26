import { chapters } from '@skald-scan/shared'
import { and, asc, eq } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { useDrizzle, readEventParam, readEventQuery } from '../../../../utils/storage'

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const query = readEventQuery(event)
  const limit = Math.min(parseIntegerQuery(query.limit, DEFAULT_LIMIT), MAX_LIMIT)
  const offset = parseIntegerQuery(query.offset, 0)
  const lang = typeof query.lang === 'string' ? query.lang.trim() : ''

  if (limit < 1) {
    throw createError({ statusCode: 400, statusMessage: 'limit must be at least 1' })
  }
  if (offset < 0) {
    throw createError({ statusCode: 400, statusMessage: 'offset must be 0 or greater' })
  }

  const db = useDrizzle(event)

  const whereClause = lang
    ? and(eq(chapters.mangaId, mangaId), eq(chapters.language, lang))
    : eq(chapters.mangaId, mangaId)

  const items = await db.select({
    id: chapters.id,
    title: chapters.title,
    chapterNumber: chapters.chapterNumber,
    language: chapters.language,
    pagesCount: chapters.pagesCount,
    status: chapters.status,
    createdAt: chapters.createdAt
  })
    .from(chapters)
    .where(whereClause)
    .orderBy(asc(chapters.chapterNumber))
    .limit(limit)
    .offset(offset)
    .all()

  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  if (lang) {
    setResponseHeader(event, 'Vary', 'Accept-Language, Accept-Encoding')
  }

  return { items }
})

const parseIntegerQuery = (value: unknown, fallback: number): number => {
  if (value === undefined) return fallback
  const normalized = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(String(normalized), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
