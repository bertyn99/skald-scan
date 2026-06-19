import { collectionManga, collections } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventParam, requireAuthenticatedSession } from '../../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)
  const userId = event.context.authSession?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const collectionId = readEventParam(event, 'id')
  const mangaId = readEventParam(event, 'mangaId')
  if (!collectionId || !mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'collection id and mangaId are required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const collection = await db.select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .get()

  if (!collection) {
    throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
  }

  await db.insert(collectionManga).values({
    collectionId,
    mangaId,
    addedAt: Date.now()
  }).onConflictDoNothing()

  return { added: true }
})
