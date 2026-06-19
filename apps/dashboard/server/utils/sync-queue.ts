import { MangaDexClient } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'

import { handleDownloadPages } from '../services/download-pages'
import { handleExtractZip } from '../services/extract-zip'
import { handleImportManga } from '../services/import-manga'
import { handleSyncChapters } from '../services/sync-chapters'
import type { StorageBucketBinding, SyncQueueMessage } from './storage'

type D1Database = Parameters<typeof drizzle>[0]

type QueueBinding = {
  send: (message: SyncQueueMessage) => Promise<void>
}

export type SyncQueueRuntimeEnv = {
  DB: D1Database
  STORAGE: StorageBucketBinding
  SYNC_QUEUE: QueueBinding
}

function shouldProcessQueueInline(): boolean {
  return import.meta.dev && process.env.NODE_ENV !== 'test'
}

async function processSyncQueueMessage(
  env: SyncQueueRuntimeEnv,
  message: SyncQueueMessage,
  client: MangaDexClient,
): Promise<void> {
  switch (message.type) {
    case 'import-manga':
      await handleImportManga(message, env, client)
      break
    case 'sync-chapters':
      await handleSyncChapters(message, env, client)
      break
    case 'download-pages':
      await handleDownloadPages(message, env, client)
      break
    case 'extract-zip':
      await handleExtractZip(message, env)
      break
    default: {
      const unhandled: never = message
      throw new Error(`Unknown queue message type: ${(unhandled as SyncQueueMessage).type}`)
    }
  }
}

export async function dispatchSyncQueueMessage(
  env: SyncQueueRuntimeEnv,
  message: SyncQueueMessage,
  client = new MangaDexClient(),
): Promise<void> {
  await env.SYNC_QUEUE.send(message)

  if (!shouldProcessQueueInline()) {
    return
  }

  await processSyncQueueMessage(env, message, client)
}
