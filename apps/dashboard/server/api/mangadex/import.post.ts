import { defineEventHandler, readBody, createError } from 'h3'
import type { TriggerImportRequest, TriggerImportResponse } from '@skald-scan/shared'

interface QueueBinding {
  send: (message: { jobId: string; mangaDexId: string; type: 'import-manga' }) => Promise<void>
}

export default defineEventHandler(async (event): Promise<TriggerImportResponse> => {
  const body = await readBody<TriggerImportRequest>(event)

  if (!body?.mangaDexId || typeof body.mangaDexId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'mangaDexId is required' })
  }

  const jobId = crypto.randomUUID()
  const queue = event.context.cloudflare.env.MANGADEX_SYNC_QUEUE as QueueBinding

  await queue.send({
    jobId,
    mangaDexId: body.mangaDexId,
    type: 'import-manga',
  })

  return { jobId }
})
