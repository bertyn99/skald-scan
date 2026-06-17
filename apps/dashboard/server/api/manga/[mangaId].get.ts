import { chapters, manga } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, asc } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventParam } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')

  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

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

  const chapterItems = await db.select({
    id: chapters.id,
    title: chapters.title,
    chapterNumber: chapters.chapterNumber,
    language: chapters.language,
    pagesCount: chapters.pagesCount,
    status: chapters.status,
  })
  .from(chapters)
  .where(eq(chapters.mangaId, mangaId))
  .orderBy(asc(chapters.chapterNumber))
  .all()

  return {
    manga: {
      ...item,
      chapterCount: chapterItems.length,
    },
    chapters: chapterItems,
  }
})
