import { chapters, manga, mangaDexSync, mangaTranslations } from '@skald-scan/shared'
import { ChapterStatus, Language, parseLanguageList } from '@skald-scan/shared'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { useDrizzle, readEventParam } from '../../utils/storage'
import { resolveResponseLanguage } from '../../utils/language'

function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const db = useDrizzle(event)
  const { language: requestedLang } = resolveResponseLanguage(event)

  // Parallel queries: canonical manga row + chapters list + sync row +
  // translation for the requested language + distinct available languages.
  const [item, chapterItems, syncRow, requestedTranslation, availableLangs] = await Promise.all([
    db.select({
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
      .where(and(eq(manga.id, mangaId), isNull(manga.deletedAt)))
      .get(),

    db.select({
      id: chapters.id,
      title: chapters.title,
      chapterNumber: chapters.chapterNumber,
      language: chapters.language,
      pagesCount: chapters.pagesCount,
      status: chapters.status
    })
      .from(chapters)
      .where(eq(chapters.mangaId, mangaId))
      .orderBy(asc(chapters.chapterNumber))
      .all(),

    db.select({
      syncStatus: mangaDexSync.syncStatus,
      lastSyncedAt: mangaDexSync.lastSyncedAt,
      lastError: mangaDexSync.lastError,
      remoteChapterCount: mangaDexSync.remoteChapterCount,
      languages: mangaDexSync.languages
    })
      .from(mangaDexSync)
      .where(eq(mangaDexSync.mangaId, mangaId))
      .get(),

    db.select({
      title: mangaTranslations.title,
      description: mangaTranslations.description,
      tags: mangaTranslations.tags
    })
      .from(mangaTranslations)
      .where(and(
        eq(mangaTranslations.mangaId, mangaId),
        eq(mangaTranslations.language, requestedLang)
      ))
      .get(),

    db.select({ language: mangaTranslations.language })
      .from(mangaTranslations)
      .where(eq(mangaTranslations.mangaId, mangaId))
      .all()
  ])

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Manga not found' })
  }

  const imported = chapterItems.filter(c => c.status === ChapterStatus.Available).length
  const importing = chapterItems.filter(c => c.status === ChapterStatus.Processing).length
  const total = syncRow?.remoteChapterCount ?? chapterItems.length

  // Translation wins over canonical when present for the requested language.
  const resolvedTitle = requestedTranslation?.title ?? item.title
  const resolvedDescription = requestedTranslation?.description ?? item.description
  const resolvedTags = requestedTranslation?.tags ?? item.tags
  const languageFallback = !requestedTranslation && requestedLang !== Language.En

  // Drizzle timestamp_ms returns Date; the API contract (MangaFull) is epoch ms.
  const createdAtMs = item.createdAt instanceof Date ? item.createdAt.getTime() : Number(item.createdAt ?? 0)
  const updatedAtMs = item.updatedAt instanceof Date ? item.updatedAt.getTime() : Number(item.updatedAt ?? 0)

  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  setResponseHeader(event, 'Vary', 'Accept-Language, Accept-Encoding')
  setResponseHeader(event, 'ETag', `"${mangaId}:${requestedLang}:${updatedAtMs}"`)
  if (languageFallback) {
    setResponseHeader(event, 'X-Language-Fallback', Language.En)
  }

  return {
    manga: {
      id: item.id,
      title: resolvedTitle,
      author: item.author,
      artist: item.artist,
      description: resolvedDescription,
      coverUrl: item.coverUrl,
      status: item.status,
      tags: resolvedTags,
      mangaDexId: item.mangaDexId,
      chapterCount: chapterItems.length,
      createdAt: createdAtMs,
      updatedAt: updatedAtMs,
      resolvedLanguage: requestedLang,
      languageFallback,
      availableLanguages: availableLangs.map(r => r.language).filter((l): l is string => Boolean(l))
    },
    chapters: chapterItems,
    sync: syncRow
      ? {
          status: syncRow.syncStatus,
          lastSyncedAt: syncRow.lastSyncedAt ?? null,
          lastError: syncRow.lastError ?? null,
          languages: parseLanguageList(safeJsonParse(syncRow.languages))
        }
      : null,
    chapterStats: {
      importing,
      imported,
      total
    }
  }
})
