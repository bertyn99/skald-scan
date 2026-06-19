import { chapters } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import {
  getDatabaseFromEvent,
  readEventBody,
  readEventParam,
  requireAdminRole
} from '../../../../utils/storage'

type UpdateChapterBody = {
  title?: string
  chapterNumber?: number
}

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const mangaId = readEventParam(event, 'mangaId')
  const chapterId = readEventParam(event, 'chapterId')
  if (!mangaId || !chapterId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId and chapterId are required' })
  }

  const body = await readEventBody<UpdateChapterBody>(event)
  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const updates: Record<string, unknown> = { updatedAt: Date.now() }
  if (body.title !== undefined) updates.title = body.title?.trim() || null
  if (typeof body.chapterNumber === 'number') updates.chapterNumber = body.chapterNumber

  await db.update(chapters)
    .set(updates)
    .where(and(eq(chapters.id, chapterId), eq(chapters.mangaId, mangaId)))

  return { updated: true }
})
