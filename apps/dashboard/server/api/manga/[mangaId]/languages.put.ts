import type { SetMangaLanguagesRequest } from '@skald-scan/shared'
import { manga, mangaDexSync, parseLanguageList } from '@skald-scan/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { useDrizzle, readEventParam, readEventBody, requireAdminRole, getDatabaseFromEvent, getStorageFromEvent, getSyncQueueFromEvent } from '../../../utils/storage'
import { dispatchSyncQueueMessage } from '../../../utils/sync-queue'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)
  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const body = await readEventBody<SetMangaLanguagesRequest>(event)
  if (!body || !Array.isArray(body.languages)) {
    throw createError({ statusCode: 400, statusMessage: 'languages must be an array' })
  }

  // Validate + dedupe against the Language enum; falls back to defaults if empty.
  const languages = parseLanguageList(body.languages)
  const languagesJson = JSON.stringify(languages)

  const db = useDrizzle(event)

  // Ensure manga exists and is not deleted.
  const target = await db.select({ id: manga.id, mangaDexId: manga.mangaDexId })
    .from(manga)
    .where(and(eq(manga.id, mangaId), isNull(manga.deletedAt)))
    .get()
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Manga not found' })
  }

  // Upsert the sync row's languages config. Re-sync immediately so the new
  // language set is mirrored without waiting for the 30-min cron.
  const existingSync = await db.select({ id: mangaDexSync.id })
    .from(mangaDexSync)
    .where(eq(mangaDexSync.mangaId, mangaId))
    .get()

  if (!existingSync) {
    await db.insert(mangaDexSync).values({
      id: crypto.randomUUID(),
      mangaId,
      languages: languagesJson
    })
  } else {
    await db.update(mangaDexSync)
      .set({ languages: languagesJson })
      .where(eq(mangaDexSync.mangaId, mangaId))
  }

  if (target.mangaDexId) {
    await dispatchSyncQueueMessage(
      {
        DB: getDatabaseFromEvent(event),
        STORAGE: getStorageFromEvent(event),
        SYNC_QUEUE: getSyncQueueFromEvent(event)
      },
      {
        type: 'sync-chapters',
        jobId: crypto.randomUUID(),
        mangaId,
        mangaDexId: target.mangaDexId
      }
    )
  }

  return { mangaId, languages }
})
