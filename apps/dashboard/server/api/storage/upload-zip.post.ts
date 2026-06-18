import { createError, defineEventHandler } from 'h3'

import {
  buildTempZipR2Key,
  getStorageFromEvent,
  getSyncQueueFromEvent,
  isZipLikeFileName,
  readEventBody,
  requireAdminRole,
  type ExtractZipQueueMessage
} from '../../utils/storage'

type UploadZipBody = {
  mangaId?: string
  chapterId?: string
  fileName?: string
  content?: string
}

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

  const queue = getSyncQueueFromEvent(event)
  await queue.send(queueMessage)

  return {
    queued: true,
    jobId,
    tempR2Key
  }
})
