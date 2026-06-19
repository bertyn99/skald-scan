import { manga, mangaDexSync } from '@skald-scan/shared'
import { SyncStatus } from '@skald-scan/shared'
import { eq, and, isNull } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import {
  getDatabaseFromEvent,
  useDrizzle,
  getStorageFromEvent,
  getSyncQueueFromEvent,
  readEventParam,
  requireAdminRole
} from '../../../utils/storage'
import { dispatchSyncQueueMessage } from '../../../utils/sync-queue'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const db = useDrizzle(event)

  const record = await db.select({
    id: manga.id,
    mangaDexId: manga.mangaDexId
  })
    .from(manga)
    .where(and(eq(manga.id, mangaId), isNull(manga.deletedAt)))
    .get()

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Manga not found' })
  }

  if (!record.mangaDexId) {
    throw createError({ statusCode: 400, statusMessage: 'This manga is not linked to MangaDex' })
  }

  const jobId = crypto.randomUUID()

  await db.update(mangaDexSync)
    .set({ syncStatus: SyncStatus.Syncing, updatedAt: Date.now(), lastError: null })
    .where(eq(mangaDexSync.mangaId, mangaId))

  await dispatchSyncQueueMessage(
    {
      DB: getDatabaseFromEvent(event),
      STORAGE: getStorageFromEvent(event),
      SYNC_QUEUE: getSyncQueueFromEvent(event)
    },
    {
      type: 'sync-chapters',
      jobId,
      mangaId,
      mangaDexId: record.mangaDexId
    }
  )

  return { jobId }
})
