import { defineTask } from 'nitropack/runtime'

import { handleScheduledSync } from '../services/scheduled-sync'

interface CloudflareTaskContext {
  cloudflare?: {
    env?: {
      DB?: Parameters<typeof import('drizzle-orm/d1')['drizzle']>[0]
      SYNC_QUEUE?: { send: (message: unknown) => Promise<void> }
    }
  }
}

export default defineTask({
  meta: { description: 'Sync manga chapters from MangaDex every 30 min' },
  async run({ context }) {
    const ctx = context as CloudflareTaskContext
    const env = ctx.cloudflare?.env

    if (!env?.DB || !env?.SYNC_QUEUE) {
      return { result: 'skipped: missing bindings' }
    }

    try {
      const result = await handleScheduledSync({
        DB: env.DB,
        SYNC_QUEUE: env.SYNC_QUEUE
      })
      return { result: `synced ${result.synced} manga` }
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'sync-chapters task failed',
        error: String(error)
      }))
      return { result: `error: ${String(error)}` }
    }
  }
})
