import { chapters } from '@skald-scan/shared'
import { ChapterStatus } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventParam, requireAdminRole } from '../../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const mangaId = readEventParam(event, 'mangaId')
  const chapterId = readEventParam(event, 'chapterId')
  if (!mangaId || !chapterId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId and chapterId are required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  await db.update(chapters)
    .set({ status: ChapterStatus.Unavailable, updatedAt: Date.now() })
    .where(and(eq(chapters.id, chapterId), eq(chapters.mangaId, mangaId)))

  return { deleted: true }
})
