import { chapters } from '@skald-scan/shared'
import { ChapterStatus } from '@skald-scan/shared'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { useDrizzle, readEventParam, requireAdminRole } from '../../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const mangaId = readEventParam(event, 'mangaId')
  const chapterId = readEventParam(event, 'chapterId')
  if (!mangaId || !chapterId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId and chapterId are required' })
  }

  const db = useDrizzle(event)

  await db.update(chapters)
    .set({ status: ChapterStatus.Unavailable })
    .where(and(eq(chapters.id, chapterId), eq(chapters.mangaId, mangaId)))

  return { deleted: true }
})
