import { MangaDexClient } from '@skald-scan/shared'
import { handleImportManga } from '../services/import-manga'
import { handleSyncChapters } from '../services/sync-chapters'
import { handleDownloadPages } from '../services/download-pages'
import { handleExtractZip } from '../services/extract-zip'
import type { SyncQueueMessage } from '../utils/storage'

type QueueHandlerEnv = {
  DB: D1Database
  STORAGE: R2Bucket
  SYNC_QUEUE: {
    send: (message: SyncQueueMessage) => Promise<void>
  }
}

interface QueueMessage {
  body: SyncQueueMessage
  ack: () => void
  // Explicit retry: re-queues the message for redelivery. Without this call,
  // Cloudflare Queues auto-acks when the handler returns, so a transiently
  // failed job is gone forever (the processed_jobs row is marked 'failed' but
  // the work is never re-attempted).
  retry: (options?: { delaySeconds?: number }) => void
  attempts: number
  id: string
}

interface QueuePayload {
  batch: {
    messages: QueueMessage[]
  }
  env: QueueHandlerEnv
}

// Cloudflare Queues caps attempts at the consumer's max_retries setting.
// Beyond that, messages go to the DLQ (if configured) or are dropped.
// Retry with exponential-ish backoff up to a sane ceiling.
const MAX_RETRIES_BEFORE_DEAD_LETTER = 3
const RETRY_BASE_DELAY_SECONDS = 30

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:queue', async (payload: QueuePayload) => {
    const { batch, env } = payload
    const client = new MangaDexClient()

    for (const message of batch.messages) {
      try {
        switch (message.body.type) {
          case 'import-manga':
            await handleImportManga(message.body, env, client)
            break
          case 'sync-chapters':
            await handleSyncChapters(message.body, env, client)
            break
          case 'download-pages':
            await handleDownloadPages(message.body, env, client)
            break
          case 'extract-zip':
            await handleExtractZip(message.body, env)
            break
          default:
            throw new Error(`Unknown queue message type: ${message.body.type}`)
        }
        message.ack()
      } catch (error) {
        // message.attempts is 1-indexed: 1 on first delivery, 2 on first retry, etc.
        // Treat "this delivery's attempt number" as the count of tries so far.
        const attempts = message.attempts ?? 1
        const willRetry = attempts <= MAX_RETRIES_BEFORE_DEAD_LETTER

        console.error(JSON.stringify({
          level: willRetry ? 'warn' : 'error',
          message: willRetry
            ? 'Queue message failed; retrying'
            : 'Queue message exhausted retries; dead-lettering',
          jobId: message.body.jobId,
          type: message.body.type,
          attempts,
          willRetry,
          error: String(error)
        }))

        if (willRetry) {
          // Exponential backoff: 30s, 60s, 120s on attempts 1, 2, 3.
          // Cloudflare clamps to its own per-queue delay ceiling (default 12h).
          const delaySeconds = RETRY_BASE_DELAY_SECONDS * (2 ** (attempts - 1))
          message.retry({ delaySeconds })
        } else {
          // Terminal: ack so the message leaves the queue. The handler already
          // marked processed_jobs as 'failed' with the error string — operators
          // inspect that table to find DLQ candidates.
          message.ack()
        }
      }
    }
  })
})
