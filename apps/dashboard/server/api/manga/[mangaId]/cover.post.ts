import { manga } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readRawBody } from 'h3'

import {
  buildCoverR2Key,
  getDatabaseFromEvent,
  getStorageFromEvent,
  readEventParam,
  requireAdminRole
} from '../../../utils/storage'

const MAX_COVER_BYTES = 5 * 1024 * 1024

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const rawBody = await readRawBody(event, false)
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Cover image body is required' })
  }

  const bodyBuffer = typeof rawBody === 'string'
    ? new TextEncoder().encode(rawBody).buffer
    : rawBody
  const bytes = bodyBuffer.byteLength

  if (bytes > MAX_COVER_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Cover image exceeds 5MB limit' })
  }

  const contentType = event.node.req.headers['content-type'] ?? 'image/webp'
  const coverKey = buildCoverR2Key(mangaId)
  const storage = getStorageFromEvent(event)

  await storage.put(coverKey, bodyBuffer, {
    httpMetadata: {
      contentType: typeof contentType === 'string' ? contentType : 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable'
    }
  })

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)
  const coverUrl = `/api/manga/${mangaId}/cover`

  await db.update(manga)
    .set({ coverUrl, updatedAt: Date.now() })
    .where(eq(manga.id, mangaId))

  return { coverUrl }
})
