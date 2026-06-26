import { chapters, manga, mangaTranslations } from '@skald-scan/shared'
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseHeader, type H3Event } from 'h3'

import { useDrizzle, readEventQuery } from '../../utils/storage'
import { resolveResponseLanguage } from '../../utils/language'

const DEFAULT_LIMIT = 100
const CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'

// Wrap each whitespace-separated token as an FTS5 prefix phrase, then AND them.
// Per-token phrasing handles multi-word queries and avoids FTS5 syntax errors
// on inputs like `es-la` (the hyphen would otherwise be parsed as NOT).
const buildFtsQuery = (search: string): string =>
  search
    .split(/\s+/)
    .filter(Boolean)
    .map(token => `"${token.replace(/"/g, '""')}"*`)
    .join(' ')

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

  const db = useDrizzle(event)
  const { language: resolvedLang } = resolveResponseLanguage(event)

  // Coalesce the localized title over the canonical one. Uses the storage
  // column name `title` on the manga_translations join — Drizzle emits the
  // table name verbatim (no alias), so we reference `manga_translations.title`.
  const resolvedTitle = sql<string>`coalesce(${mangaTranslations.title}, ${manga.title})`.as('resolved_title')

  const baseFilters = [isNull(manga.deletedAt)]
  if (status) {
    baseFilters.push(eq(manga.status, status))
  }

  const translationsJoin = and(
    eq(mangaTranslations.mangaId, manga.id),
    eq(mangaTranslations.language, resolvedLang)
  )

  // Search path: build the candidate rowid set ONCE via a parameterized CTE
  // that unions both FTS tables (canonical title/description + localized
  // title/description/alt_titles). We then JOIN manga to that CTE.
  // Ranking uses bm25 inside each FTS branch of the CTE so the function is
  // always in scope; the outer query orders by the precomputed rank.
  if (search) {
    const ftsQuery = buildFtsQuery(search)
    const rows = await db.select({
      id: manga.id,
      title: resolvedTitle,
      coverUrl: manga.coverUrl,
      status: manga.status,
      updatedAt: manga.updatedAt,
      chapterCount: count(chapters.id),
      total: sql<number>`count(*) OVER ()`.as('total')
    })
      .from(sql`(
        WITH canonical(rowid, rank) AS (
          SELECT rowid, bm25(manga_fts) FROM manga_fts WHERE manga_fts MATCH ${ftsQuery}
        ),
        localized(rowid, rank) AS (
          SELECT mt.rowid, bm25(manga_translations_fts)
          FROM manga_translations_fts mtf
          JOIN manga_translations mt ON mt.rowid = mtf.rowid
          WHERE mtf MATCH ${ftsQuery}
        )
        SELECT rowid, MIN(rank) AS rank
        FROM (
          SELECT rowid, rank FROM canonical
          UNION
          SELECT rowid, rank FROM localized
        )
        GROUP BY rowid
      ) AS matches`)
      .innerJoin(manga, sql`manga.rowid = matches.rowid`)
      .leftJoin(mangaTranslations, translationsJoin)
      .leftJoin(chapters, eq(chapters.mangaId, manga.id))
      .where(and(...baseFilters))
      .groupBy(manga.id)
      .orderBy(sql`MIN(matches.rank)`)
      .limit(limit)
      .offset(offset)
      .all()

    return buildListResponse(event, resolvedLang, rows, limit, offset)
  }

  // Non-search path: LEFT JOIN translations for the resolved language only.
  const rows = await db.select({
    id: manga.id,
    title: resolvedTitle,
    coverUrl: manga.coverUrl,
    status: manga.status,
    updatedAt: manga.updatedAt,
    chapterCount: count(chapters.id),
    total: sql<number>`count(*) OVER ()`.as('total')
  })
    .from(manga)
    .leftJoin(mangaTranslations, translationsJoin)
    .leftJoin(chapters, eq(chapters.mangaId, manga.id))
    .where(and(...baseFilters))
    .groupBy(manga.id)
    .orderBy(desc(manga.updatedAt), desc(manga.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  return buildListResponse(event, resolvedLang, rows, limit, offset)
})

function buildListResponse(
  event: H3Event,
  lang: string,
  rows: Array<{ total: number | null } & Record<string, unknown>>,
  limit: number,
  offset: number
) {
  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0
  applyCacheHeaders(event, lang)

  return {
    manga: rows.map(({ total: _t, updatedAt, ...row }) => ({
      id: row.id as string,
      title: row.title as string,
      coverUrl: (row.coverUrl as string | null) ?? null,
      status: row.status as string,
      chapterCount: Number(row.chapterCount) || 0,
      updatedAt: updatedAt instanceof Date ? updatedAt.getTime() : Number(updatedAt ?? 0),
      resolvedLanguage: lang
    })),
    total,
    limit,
    offset,
    resolvedLanguage: lang
  }
}

function applyCacheHeaders(event: H3Event, lang: string): void {
  setResponseHeader(event, 'Cache-Control', CACHE_CONTROL)
  // Vary by Accept-Language AND Accept-Encoding so CDNs don't serve a French
  // user a cached English response when the URL path is identical.
  setResponseHeader(event, 'Vary', 'Accept-Language, Accept-Encoding')
  // ETag includes the resolved language so revalidation from a different lang
  // correctly misses.
  setResponseHeader(event, 'ETag', `"list:${lang}"`)
}

const parseIntegerQuery = (value: unknown, fallback: number): number => {
  if (value === undefined) {
    return fallback
  }

  const normalized = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(String(normalized), 10)

  return Number.isFinite(parsed) ? parsed : fallback
}
