import { MangaDexClient } from '@skald-scan/shared'
import { handleImportManga } from '../services/import-manga'
import { handleSyncChapters } from '../services/sync-chapters'
import { handleDownloadPages } from '../services/download-pages'

type QueueMessage = {
  jobId: string
  type: 'import-manga' | 'sync-chapters' | 'download-pages'
  [key: string]: unknown
}

interface QueuePayload {
  batch: {
    messages: Array<{
      body: QueueMessage
      ack: () => void
      attempts: number
      id: string
    }>
  }
  env: Record<string, unknown>
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:queue', async (payload: QueuePayload) => {
    const { batch, env } = payload
    const client = new MangaDexClient()

    for (const message of batch.messages) {
      try {
        switch (message.body.type) {
          case 'import-manga':
            await handleImportManga(
              message.body as Parameters<typeof handleImportManga>[0],
              env as Parameters<typeof handleImportManga>[1],
              client,
            )
            break
          case 'sync-chapters':
            await handleSyncChapters(
              message.body as Parameters<typeof handleSyncChapters>[0],
              env as Parameters<typeof handleSyncChapters>[1],
              client,
            )
            break
          case 'download-pages':
            await handleDownloadPages(
              message.body as Parameters<typeof handleDownloadPages>[0],
              env as Parameters<typeof handleDownloadPages>[1],
              client,
            )
            break
          default:
            console.error(JSON.stringify({
              level: 'warn',
              message: 'Unknown queue message type',
              type: message.body.type,
              jobId: message.body.jobId,
            }))
        }
        message.ack()
      } catch (error) {
        console.error(JSON.stringify({
          level: 'error',
          message: 'Queue message failed',
          jobId: message.body.jobId,
          error: String(error),
          retryCount: message.attempts,
        }))
      }
    }
  })
})
