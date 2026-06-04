import { chapters } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, asc } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventParam } from '../../../../utils/storage'

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')

  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const items = await db.select()
  .from(chapters)
  .where(eq(chapters.mangaId, mangaId))
  .orderBy(asc(chapters.chapterNumber))
  .all()

  return {
    items
  }
})
