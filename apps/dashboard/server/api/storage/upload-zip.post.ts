import { createError, defineEventHandler } from 'h3'

import {
  buildTempZipR2Key,
  getDatabaseFromEvent,
  getStorageFromEvent,
  getSyncQueueFromEvent,
  isZipLikeFileName,
  readEventBody,
  requireAdminRole,
  type ExtractZipQueueMessage
} from '../../utils/storage'
import { dispatchSyncQueueMessage } from '../../utils/sync-queue'

type UploadZipBody = {
  mangaId?: string
  chapterId?: string
  fileName?: string
  content?: string
}

const MAX_ZIP_BYTES = 100 * 1024 * 1024

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const body = await readEventBody<UploadZipBody>(event)
  const mangaId = body.mangaId?.trim()
  const chapterId = body.chapterId?.trim()
  const fileName = body.fileName?.trim() ?? 'archive.zip'
  const content = body.content

  if (!mangaId || !chapterId || typeof content !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'mangaId, chapterId, and content are required'
    })
  }

  if (!isZipLikeFileName(fileName)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'fileName must end with .zip or .cbz'
    })
  }

  let fileBuffer: ArrayBuffer
  try {
    fileBuffer = Uint8Array.from(atob(content), (character) => character.charCodeAt(0)).buffer
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'content must be valid base64' })
  }

  if (fileBuffer.byteLength > MAX_ZIP_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `Archive exceeds maximum size of ${MAX_ZIP_BYTES} bytes`
    })
  }

  const jobId = crypto.randomUUID()
  const tempR2Key = buildTempZipR2Key(jobId)

  const storage = getStorageFromEvent(event)
  await storage.put(tempR2Key, fileBuffer, {
    httpMetadata: {
      contentType: 'application/zip',
      cacheControl: 'private, max-age=0, no-store'
    },
    customMetadata: {
      mangaId,
      chapterId,
      originalFileName: fileName
    }
  })

  const queueMessage: ExtractZipQueueMessage = {
    type: 'extract-zip',
    jobId,
    mangaId,
    chapterId,
    tempR2Key
  }

  await dispatchSyncQueueMessage(
    {
      DB: getDatabaseFromEvent(event),
      STORAGE: storage,
      SYNC_QUEUE: getSyncQueueFromEvent(event)
    },
    queueMessage
  )

  return {
    queued: true,
    jobId,
    tempR2Key
  }
})
