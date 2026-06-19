import { chapters } from '@skald-scan/shared'
import { eq, asc } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { useDrizzle, readEventParam } from '../../../../utils/storage'

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')

  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const db = useDrizzle(event)

  const items = await db.select({
    id: chapters.id,
    title: chapters.title,
    chapterNumber: chapters.chapterNumber,
    pagesCount: chapters.pagesCount,
    status: chapters.status,
    createdAt: chapters.createdAt
  })
    .from(chapters)
    .where(eq(chapters.mangaId, mangaId))
    .orderBy(asc(chapters.chapterNumber))
    .all()

  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')

  return {
    items
  }
})
