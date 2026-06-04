import { mangaDexSync } from '@skald-scan/shared'
import { SyncStatus } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'

type D1Database = Parameters<typeof drizzle>[0]

interface QueueBinding {
  send: (message: { jobId: string; mangaDexId: string; type: 'import-manga' }) => Promise<void>
}

export default defineEventHandler(async (event) => {
  const env = event.context.cloudflare.env
  const db = drizzle(env.DB as D1Database)

  const syncRows = await db.select({
    mangaId: mangaDexSync.mangaId,
    mangaDexId: mangaDexSync.mangaId,
    autoSyncEnabled: mangaDexSync.autoSyncEnabled,
    syncStatus: mangaDexSync.syncStatus,
  })
    .from(mangaDexSync)
    .where(
      and(
        eq(mangaDexSync.autoSyncEnabled, true),
        eq(mangaDexSync.syncStatus, SyncStatus.Idle),
      ),
    )
    .all()

  const queue = env.MANGADEX_SYNC_QUEUE as QueueBinding
  let queuedCount = 0

  for (const row of syncRows) {
    await queue.send({
      jobId: crypto.randomUUID(),
      mangaDexId: row.mangaDexId,
      type: 'import-manga',
    })
    queuedCount++
  }

  return { queued: queuedCount, checked: syncRows.length }
})
