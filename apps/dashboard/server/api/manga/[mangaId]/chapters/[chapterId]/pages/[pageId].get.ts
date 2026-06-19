import { pages } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, sendRedirect } from 'h3'

import {
  buildPageR2Key,
  getDatabaseFromEvent,
  getStorageFromEvent,
  readEventParam
} from '../../../../../../utils/storage'
import { buildResizeOptions, buildVariantR2Key, imageResponseHeaders } from '../../../../../../utils/image-optimization'

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
  const pageRecord = await db.select({ r2Key: pages.r2Key, imageUrl: pages.imageUrl })
    .from(pages)
    .where(and(eq(pages.chapterId, chapterId), eq(pages.pageNumber, pageNumber)))
    .get()

  const storage = getStorageFromEvent(event)
  const pageKey = pageRecord?.r2Key ?? buildPageR2Key(mangaId, chapterId, pageNumber)

  const query = getQuery(event)
  const resizeOpts = buildResizeOptions(query.w)

  if (resizeOpts) {
    const variantKey = buildVariantR2Key(pageKey, resizeOpts.width!)
    const variant = await storage.get(variantKey)
    if (variant?.body) {
      return new Response(variant.body, { status: 200, headers: imageResponseHeaders() })
    }
  }

  const object = await storage.get(pageKey)
  if (!object?.body) {
    if (pageRecord?.imageUrl) {
      return sendRedirect(event, pageRecord.imageUrl, 302)
    }
    throw createError({ statusCode: 404, statusMessage: 'Page image not found' })
  }

  if (resizeOpts) {
    const arrayBuf = await new Response(object.body).arrayBuffer()
    await storage.put(buildVariantR2Key(pageKey, resizeOpts.width!), arrayBuf, {
      httpMetadata: { contentType: 'image/webp' },
    })
    return new Response(arrayBuf, { status: 200, headers: imageResponseHeaders() })
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
    },
  })
})
