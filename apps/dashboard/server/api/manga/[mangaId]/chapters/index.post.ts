import { chapters } from '@skald-scan/shared'
import { createError, defineEventHandler } from 'h3'

import {
  useDrizzle,
  readEventBody,
  readEventParam,
  requireAdminRole
} from '../../../../utils/storage'

type CreateChapterBody = {
  title?: string
  chapterNumber?: number
  language?: string
  pagesCount?: number
  scanlator?: string
}

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const body = await readEventBody<CreateChapterBody>(event)

  if (typeof body.chapterNumber !== 'number' || Number.isNaN(body.chapterNumber)) {
    throw createError({ statusCode: 400, statusMessage: 'chapterNumber is required' })
  }

  const now = Date.now()
  const item = {
    id: crypto.randomUUID(),
    mangaId,
    title: body.title?.trim() || null,
    chapterNumber: body.chapterNumber,
    language: body.language?.trim() || 'en',
    pagesCount: body.pagesCount ?? 0,
    scanlator: body.scanlator?.trim() || null,
    createdAt: now,
    updatedAt: now
  }

  const db = useDrizzle(event)
  await db.insert(chapters).values({
    id: item.id,
    mangaId: item.mangaId,
    title: item.title,
    chapterNumber: item.chapterNumber,
    language: item.language,
    pagesCount: item.pagesCount,
    status: 'available',
    scanlator: item.scanlator,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }).run()

  return {
    item
  }
})
