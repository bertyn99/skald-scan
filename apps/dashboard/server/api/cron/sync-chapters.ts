import { createError, defineEventHandler } from 'h3'

import { handleScheduledSync } from '../../services/scheduled-sync'

export default defineEventHandler(async (event) => {
  const env = event.context.cloudflare?.env
  if (!env?.DB || !env?.SYNC_QUEUE) {
    throw createError({ statusCode: 500, statusMessage: 'Missing required bindings' })
  }

  const result = await handleScheduledSync({
    DB: env.DB,
    SYNC_QUEUE: env.SYNC_QUEUE,
  })

  return result
})
