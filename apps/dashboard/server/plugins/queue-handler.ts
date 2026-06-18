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

interface QueuePayload {
  batch: {
    messages: Array<{
      body: SyncQueueMessage
      ack: () => void
      attempts: number
      id: string
    }>
  }
  env: QueueHandlerEnv
}

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
        console.error(JSON.stringify({
          level: 'error',
          message: 'Queue message failed',
          jobId: message.body.jobId,
          error: String(error),
          retryCount: message.attempts
        }))
      }
    }
  })
})
