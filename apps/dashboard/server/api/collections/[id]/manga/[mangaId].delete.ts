import { collectionManga, collections } from '@skald-scan/shared'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { useDrizzle, readEventParam, requireAuthenticatedSession } from '../../../../utils/storage'

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

  const db = useDrizzle(event)

  const collection = await db.select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .get()

  if (!collection) {
    throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
  }

  await db.delete(collectionManga)
    .where(and(eq(collectionManga.collectionId, collectionId), eq(collectionManga.mangaId, mangaId)))

  return { removed: true }
})
