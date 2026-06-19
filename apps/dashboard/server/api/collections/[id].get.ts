import { collectionManga, collections, manga } from '@skald-scan/shared'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { useDrizzle, readEventParam, requireAuthenticatedSession } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)
  const userId = event.context.authSession?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const collectionId = readEventParam(event, 'id')
  if (!collectionId) {
    throw createError({ statusCode: 400, statusMessage: 'collection id is required' })
  }

  const db = useDrizzle(event)

  const collection = await db.select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .get()

  if (!collection) {
    throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
  }

  const rows = await db.select({
    id: manga.id,
    title: manga.title,
    coverUrl: manga.coverUrl,
    status: manga.status
  })
    .from(collectionManga)
    .innerJoin(manga, eq(collectionManga.mangaId, manga.id))
    .where(eq(collectionManga.collectionId, collectionId))
    .all()

  return { manga: rows }
})
