import { manga } from '@skald-scan/shared'
import { MangaStatus } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventBody, requireAdminRole } from '../../utils/storage'

type CreateMangaBody = {
  title?: string
  description?: string
  coverUrl?: string
  author?: string
  artist?: string
  tags?: string
}

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const body = await readEventBody<CreateMangaBody>(event)
  const title = body.title?.trim()

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'title is required' })
  }

  const now = Date.now()
  const record = {
    id: crypto.randomUUID(),
    title,
    description: body.description?.trim() || null,
    coverUrl: body.coverUrl?.trim() || null,
    status: MangaStatus.Ongoing,
    author: body.author?.trim() || null,
    artist: body.artist?.trim() || null,
    tags: body.tags?.trim() || null,
    createdAt: now,
    updatedAt: now
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)
  await db.insert(manga).values(record).run()

  return {
    item: record
  }
})
