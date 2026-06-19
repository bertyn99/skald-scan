import { manga } from '@skald-scan/shared'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import {
  useDrizzle,
  readEventBody,
  readEventParam,
  requireAdminRole
} from '../../utils/storage'

type UpdateMangaBody = {
  title?: string
  description?: string | null
  coverUrl?: string | null
  author?: string | null
  artist?: string | null
  tags?: string | null
  status?: string
}

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const body = await readEventBody<UpdateMangaBody>(event)
  const now = Date.now()

  const changes = {
    title: body.title?.trim(),
    description: normalizeNullableText(body.description),
    coverUrl: normalizeNullableText(body.coverUrl),
    author: normalizeNullableText(body.author),
    artist: normalizeNullableText(body.artist),
    tags: normalizeNullableText(body.tags),
    status: body.status?.trim(),
    updatedAt: now
  }

  const db = useDrizzle(event)

  const updates = Object.entries(changes).filter(([, value]) => value !== undefined)
  if (updates.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const updateObj = Object.fromEntries(updates)

  await db.update(manga).set(updateObj).where(eq(manga.id, mangaId)).run()

  const item = await db.select({
    id: manga.id,
    title: manga.title,
    description: manga.description,
    coverUrl: manga.coverUrl,
    status: manga.status,
    mangaDexId: manga.mangaDexId,
    author: manga.author,
    artist: manga.artist,
    tags: manga.tags,
    createdAt: manga.createdAt,
    updatedAt: manga.updatedAt
  })
  .from(manga)
  .where(eq(manga.id, mangaId))
  .get()

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Manga not found' })
  }

  return { item }
})

const normalizeNullableText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const normalized = value.trim()

  return normalized.length > 0 ? normalized : null
}
