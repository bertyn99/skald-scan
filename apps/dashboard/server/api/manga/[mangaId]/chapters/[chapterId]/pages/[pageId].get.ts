import { pages } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import {
  buildPageR2Key,
  getDatabaseFromEvent,
  getStorageFromEvent,
  readEventParam
} from '../../../../../../utils/storage'

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')
  const chapterId = readEventParam(event, 'chapterId')
  const pageId = readEventParam(event, 'pageId')

  if (!mangaId || !chapterId || !pageId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'mangaId, chapterId, and pageId are required'
    })
  }

  const pageNumber = Number.parseInt(pageId, 10)
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    throw createError({ statusCode: 400, statusMessage: 'pageId must be a positive number' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)
  const pageRecord = await db.select({ r2Key: pages.r2Key })
    .from(pages)
    .where(and(eq(pages.chapterId, chapterId), eq(pages.pageNumber, pageNumber)))
    .get()

  const storage = getStorageFromEvent(event)
  const pageKey = pageRecord?.r2Key ?? buildPageR2Key(mangaId, chapterId, pageNumber)
  const object = await storage.get(pageKey)

  if (!object?.body) {
    throw createError({ statusCode: 404, statusMessage: 'Page image not found' })
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...(object.httpEtag ? { ETag: object.httpEtag } : {})
    }
  })
})
