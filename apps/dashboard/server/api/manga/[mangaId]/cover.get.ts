import { manga } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, sendRedirect } from 'h3'

import {
  buildCoverR2Key,
  getDatabaseFromEvent,
  getStorageFromEvent,
  readEventParam
} from '../../../../utils/storage'
import { buildResizeOptions, buildVariantR2Key, imageResponseHeaders } from '../../../../utils/image-optimization'

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const query = getQuery(event)
  const resizeOpts = buildResizeOptions(query.w)

  const storage = getStorageFromEvent(event)
  const coverKey = buildCoverR2Key(mangaId)

  let objectKey = coverKey
  if (resizeOpts) {
    const variantKey = buildVariantR2Key(coverKey, resizeOpts.width!)
    const variant = await storage.get(variantKey)
    if (variant?.body) {
      return new Response(variant.body, {
        status: 200,
        headers: imageResponseHeaders(),
      })
    }
    objectKey = coverKey
  }

  const object = await storage.get(objectKey)
  if (!object?.body) {
    const database = getDatabaseFromEvent(event)
    const db = drizzle(database)
    const record = await db.select({ coverUrl: manga.coverUrl })
      .from(manga)
      .where(eq(manga.id, mangaId))
      .get()

    if (record?.coverUrl) {
      return sendRedirect(event, record.coverUrl, 302)
    }

    throw createError({ statusCode: 404, statusMessage: 'Cover image not found' })
  }

  if (resizeOpts && object.httpMetadata?.contentType !== 'image/webp') {
    const arrayBuf = await new Response(object.body).arrayBuffer()
    await storage.put(buildVariantR2Key(coverKey, resizeOpts.width!), arrayBuf, {
      httpMetadata: { contentType: 'image/webp' },
    })

    return new Response(arrayBuf, {
      status: 200,
      headers: imageResponseHeaders(),
    })
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
