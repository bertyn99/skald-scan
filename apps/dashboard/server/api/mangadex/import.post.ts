import type { TriggerImportRequest, TriggerImportResponse } from '@skald-scan/shared'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, getStorageFromEvent, getSyncQueueFromEvent, readEventBody, requireAdminRole } from '../../utils/storage'
import { dispatchSyncQueueMessage } from '../../utils/sync-queue'

export default defineEventHandler(async (event): Promise<TriggerImportResponse> => {
  requireAdminRole(event)
  const body = await readEventBody<TriggerImportRequest>(event)

  if (!body?.mangaDexId || typeof body.mangaDexId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'mangaDexId is required' })
  }

  const jobId = crypto.randomUUID()

  try {
    await dispatchSyncQueueMessage(
      {
        DB: getDatabaseFromEvent(event),
        STORAGE: getStorageFromEvent(event),
        SYNC_QUEUE: getSyncQueueFromEvent(event)
      },
      {
        type: 'import-manga',
        jobId,
        mangaDexId: body.mangaDexId,
      },
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Import failed',
      message: detail,
    })
  }

  return { jobId }
})
