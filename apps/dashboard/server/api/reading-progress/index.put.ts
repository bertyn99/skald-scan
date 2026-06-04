import { readingProgress } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import type { UpsertProgressRequest } from '@skald-scan/shared'

import {
  getDatabaseFromEvent,
  readEventBody,
  readEventParam,
  requireAuthenticatedSession
} from '../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)

  const body = await readEventBody<UpsertProgressRequest>(event)
  const { mangaId, chapterId, lastPageRead, read } = body

  if (!mangaId || !chapterId || typeof lastPageRead !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'mangaId, chapterId, and lastPageRead are required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)
  const now = Date.now()

  const existing = await db.select({ id: readingProgress.id })
    .from(readingProgress)
    .where(eq(readingProgress.chapterId, chapterId))
    .get()

  if (existing) {
    await db.update(readingProgress)
      .set({
        lastPageRead,
        read,
        updatedAt: now,
        lastReadAt: now,
      })
      .where(eq(readingProgress.id, existing.id))
      .run()
  } else {
    await db.insert(readingProgress)
      .values({
        id: crypto.randomUUID(),
        userId: 'system',
        mangaId,
        chapterId,
        lastPageRead,
        read,
        lastReadAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }

  return { success: true }
})
