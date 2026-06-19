import { readingProgress } from '@skald-scan/shared'
import type { UpsertProgressRequest } from '@skald-scan/shared'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import {
  useDrizzle,
  readEventBody,
  requireAuthenticatedSession
} from '../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)

  const userId = event.context.authSession?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readEventBody<UpsertProgressRequest>(event)
  const { mangaId, chapterId, lastPageRead, read } = body

  if (!mangaId || !chapterId || typeof lastPageRead !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'mangaId, chapterId, and lastPageRead are required' })
  }

  const db = useDrizzle(event)

  // Client-supplied timestamp; default to now so callers without an explicit
  // updatedAt are treated as fresh (preserves the original behaviour).
  const clientUpdatedAt = body.updatedAt ?? Date.now()

  // Stale-client guard: if the server already has a newer entry for this
  // (user, chapter) pair, skip the overwrite entirely. Offline clients with an
  // older local timestamp must not clobber newer server data.
  const existing = await db.select({ updatedAt: readingProgress.updatedAt })
    .from(readingProgress)
    .where(and(eq(readingProgress.userId, userId), eq(readingProgress.chapterId, chapterId)))
    .get()

  if (existing && existing.updatedAt !== null && existing.updatedAt > clientUpdatedAt) {
    return { success: true }
  }

  // Atomic upsert on the (userId, chapterId) unique index. Eliminates the
  // SELECT-then-INSERT/UPDATE race the previous implementation had.
  await db.insert(readingProgress)
    .values({
      id: crypto.randomUUID(),
      userId,
      mangaId,
      chapterId,
      lastPageRead,
      read,
      lastReadAt: clientUpdatedAt,
      createdAt: clientUpdatedAt,
      updatedAt: clientUpdatedAt
    })
    .onConflictDoUpdate({
      target: [readingProgress.userId, readingProgress.chapterId],
      set: {
        lastPageRead,
        read,
        lastReadAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt
      }
    })
    .run()

  return { success: true }
})
