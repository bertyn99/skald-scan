import { manga, mangaDexSync } from '@skald-scan/shared'
import { SyncStatus } from '@skald-scan/shared'
import { eq, inArray } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import {
  getDatabaseFromEvent,
  useDrizzle,
  getStorageFromEvent,
  getSyncQueueFromEvent,
  readEventBody,
  requireAdminRole
} from '../../../utils/storage'
import { dispatchSyncQueueMessage } from '../../../utils/sync-queue'

type BulkBody = {
  action?: 'delete' | 'sync'
  mangaIds?: string[]
}

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const body = await readEventBody<BulkBody>(event)
  const action = body.action
  const mangaIds = body.mangaIds?.filter(Boolean) ?? []

  if (!action || mangaIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'action and mangaIds are required' })
  }

  const db = useDrizzle(event)
  const now = Date.now()

  if (action === 'delete') {
    for (let i = 0; i < mangaIds.length; i += 50) {
      const chunk = mangaIds.slice(i, i + 50)
      await db.update(manga)
        .set({ deletedAt: new Date(now), updatedAt: now })
        .where(inArray(manga.id, chunk))
    }
    return { action, count: mangaIds.length }
  }

  if (action === 'sync') {
    const records = await db.select({
      id: manga.id,
      mangaDexId: manga.mangaDexId
    })
      .from(manga)
      .where(inArray(manga.id, mangaIds))
      .all()

    let queued = 0
    for (const record of records) {
      if (!record.mangaDexId) continue
      const jobId = crypto.randomUUID()
      await db.update(mangaDexSync)
        .set({ syncStatus: SyncStatus.Syncing, updatedAt: now })
        .where(eq(mangaDexSync.mangaId, record.id))

      await dispatchSyncQueueMessage(
        {
          DB: getDatabaseFromEvent(event),
          STORAGE: getStorageFromEvent(event),
          SYNC_QUEUE: getSyncQueueFromEvent(event)
        },
        {
          type: 'sync-chapters',
          jobId,
          mangaId: record.id,
          mangaDexId: record.mangaDexId
        }
      )
      queued++
    }
    return { action, queued }
  }

  throw createError({ statusCode: 400, statusMessage: 'Unsupported action' })
})
