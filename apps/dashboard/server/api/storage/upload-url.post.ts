import { createError, defineEventHandler } from 'h3'

import {
  generateR2UploadPresignedUrl,
  getStorageFromEvent,
  readEventBody,
  requireAdminRole,
  resolvePageR2KeyFromFileName
} from '../../utils/storage'

type UploadUrlBody = {
  mangaId?: string
  chapterId?: string
  fileName?: string
}

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const body = await readEventBody<UploadUrlBody>(event)
  const mangaId = body.mangaId?.trim()
  const chapterId = body.chapterId?.trim()
  const fileName = body.fileName?.trim()

  if (!mangaId || !chapterId || !fileName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'mangaId, chapterId, and fileName are required'
    })
  }

  const key = resolvePageR2KeyFromFileName(mangaId, chapterId, fileName)
  const storage = getStorageFromEvent(event)
  const uploadUrl = await generateR2UploadPresignedUrl(storage, key)

  return {
    uploadUrl,
    key
  }
})
