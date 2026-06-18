import { manga, mangaDexSync } from '@skald-scan/shared'
import { SyncStatus } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { and, asc, eq, isNull, lt, not } from 'drizzle-orm'

import type { SyncQueueMessage } from '../utils/storage'

type D1Database = Parameters<typeof drizzle>[0]

interface QueueBinding {
  send: (message: SyncQueueMessage) => Promise<void>
}

const MAX_MANGA_PER_RUN = 5
const SYNC_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export async function handleScheduledSync(
  env: { DB: D1Database; SYNC_QUEUE: QueueBinding },
): Promise<{ synced: number; queued: number }> {
  const db = drizzle(env.DB)

  const cutoff = Date.now() - SYNC_INTERVAL_MS

  const dueRaw = await db.select({
    id: mangaDexSync.id,
    mangaId: mangaDexSync.mangaId,
    mangaDexId: manga.mangaDexId,
  })
    .from(mangaDexSync)
    .innerJoin(manga, eq(mangaDexSync.mangaId, manga.id))
    .where(and(
      eq(mangaDexSync.autoSyncEnabled, true),
      eq(mangaDexSync.syncStatus, SyncStatus.Idle),
      lt(mangaDexSync.lastSyncedAt, cutoff),
      not(isNull(manga.mangaDexId)),
    ))
    .orderBy(asc(mangaDexSync.lastSyncedAt))
    .limit(MAX_MANGA_PER_RUN)
    .all()

  const due = dueRaw.filter((record): record is {
    id: string
    mangaId: string
    mangaDexId: string
  } => record.mangaDexId !== null)

  if (due.length === 0) {
    return { synced: 0, queued: 0 }
  }

  for (const record of due) {
    await db.update(mangaDexSync)
      .set({ syncStatus: SyncStatus.Syncing, updatedAt: Date.now() })
      .where(eq(mangaDexSync.id, record.id))

    await env.SYNC_QUEUE.send({
      jobId: crypto.randomUUID(),
      mangaId: record.mangaId,
      type: 'sync-chapters',
      mangaDexId: record.mangaDexId,
    })
  }

  return { synced: due.length, queued: due.length }
}
