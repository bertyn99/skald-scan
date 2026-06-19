import { readingProgress } from '@skald-scan/shared'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { useDrizzle, readEventParam, requireAuthenticatedSession } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)

  const userId = event.context.authSession?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const db = useDrizzle(event)

  const progress = await db.select({
    id: readingProgress.id,
    chapterId: readingProgress.chapterId,
    lastPageRead: readingProgress.lastPageRead,
    read: readingProgress.read,
    lastReadAt: readingProgress.lastReadAt
  })
    .from(readingProgress)
    .where(and(
      eq(readingProgress.mangaId, mangaId),
      eq(readingProgress.userId, userId)
    ))
    .all()

  return { progress }
})
