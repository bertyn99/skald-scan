import { readingProgress, chapters } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventParam, requireAuthenticatedSession } from '../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)

  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const progress = await db.select({
    id: readingProgress.id,
    chapterId: readingProgress.chapterId,
    lastPageRead: readingProgress.lastPageRead,
    read: readingProgress.read,
    lastReadAt: readingProgress.lastReadAt,
  })
    .from(readingProgress)
    .where(eq(readingProgress.mangaId, mangaId))
    .all()

  return { progress }
})
