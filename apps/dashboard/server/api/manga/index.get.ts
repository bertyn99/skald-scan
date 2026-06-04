import { manga } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { desc, sql } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventQuery } from '../../utils/storage'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  const query = readEventQuery(event)
  const limit = parseIntegerQuery(query.limit, DEFAULT_LIMIT)
  const offset = parseIntegerQuery(query.offset, 0)

  if (limit < 1 || limit > MAX_LIMIT) {
    throw createError({ statusCode: 400, statusMessage: `limit must be between 1 and ${MAX_LIMIT}` })
  }

  if (offset < 0) {
    throw createError({ statusCode: 400, statusMessage: 'offset must be 0 or greater' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const items = await db.select({
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
  .orderBy(desc(manga.updatedAt), desc(manga.createdAt))
  .limit(limit)
  .offset(offset)
  .all()

  const countResult = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(manga).get()
  return {
    items,
    pagination: {
      limit,
      offset,
      total: countResult?.count ?? 0
    }
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
