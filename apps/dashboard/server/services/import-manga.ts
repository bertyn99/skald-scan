import { chapters, manga, mangaDexSync, processedJobs } from '@skald-scan/shared'
import type { MangaDexClient } from '@skald-scan/shared'
import { MangaStatus, SyncStatus } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'

type D1Database = Parameters<typeof drizzle>[0]

interface ImportMangaMessage {
  jobId: string
  mangaDexId: string
  type: 'import-manga'
}

interface SyncChaptersMessage {
  jobId: string
  mangaId: string
  mangaDexId: string
  type: 'sync-chapters'
}

interface QueueBinding {
  send: (message: SyncChaptersMessage) => Promise<void>
}

export async function handleImportManga(
  message: ImportMangaMessage,
  env: { DB: D1Database; MANGADEX_SYNC_QUEUE: QueueBinding },
  client: MangaDexClient,
): Promise<void> {
  const db = drizzle(env.DB)

  const existing = await db.select({ jobId: processedJobs.jobId })
    .from(processedJobs)
    .where(eq(processedJobs.jobId, message.jobId))
    .get()

  if (existing) {
    return
  }

  await db.insert(processedJobs).values({
    jobId: message.jobId,
    status: 'processing',
  })

  try {
    const response = await client.getManga(message.mangaDexId)
    const mdManga = response.data

    const title = mdManga.attributes.title['en'] ?? mdManga.attributes.title[Object.keys(mdManga.attributes.title)[0]] ?? 'Unknown'
    const description = mdManga.attributes.description?.['en'] ?? null
    const status = mapMangaDexStatus(mdManga.attributes.status)
    const tags = mdManga.attributes.tags?.map(t => t.attributes.name['en'] ?? '').filter(Boolean).join(', ') ?? null

    let author: string | null = null
    let artist: string | null = null
    if (mdManga.relationships) {
      for (const rel of mdManga.relationships) {
        if (rel.type === 'author') {
          const authorResp = await client.getAuthor(rel.id)
          author = authorResp.data.attributes.name
        }
        if (rel.type === 'artist') {
          const authorResp = await client.getAuthor(rel.id)
          artist = authorResp.data.attributes.name
        }
      }
    }

    let coverUrl: string | null = null
    if (mdManga.relationships) {
      const coverRel = mdManga.relationships.find(r => r.type === 'cover_art')
      if (coverRel) {
        const cover = await client.getCoverArt(message.mangaDexId)
        coverUrl = cover?.url ?? null
      }
    }

    const mangaId = crypto.randomUUID()

    await db.insert(manga).values({
      id: mangaId,
      title,
      description,
      coverUrl,
      status,
      mangaDexId: message.mangaDexId,
      author,
      artist,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await db.insert(mangaDexSync).values({
      id: crypto.randomUUID(),
      mangaId,
      syncStatus: SyncStatus.Syncing,
      autoSyncEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await env.MANGADEX_SYNC_QUEUE.send({
      jobId: crypto.randomUUID(),
      mangaId,
      mangaDexId: message.mangaDexId,
      type: 'sync-chapters',
    })

    await db.update(processedJobs)
      .set({ status: 'completed' })
      .where(eq(processedJobs.jobId, message.jobId))
  } catch (error) {
    await db.update(processedJobs)
      .set({ status: 'failed', metadata: JSON.stringify({ error: String(error) }) })
      .where(eq(processedJobs.jobId, message.jobId))
    throw error
  }
}

function mapMangaDexStatus(status?: string): string {
  switch (status) {
    case 'completed': return MangaStatus.Completed
    case 'hiatus': return MangaStatus.Hiatus
    case 'cancelled': return MangaStatus.Cancelled
    default: return MangaStatus.Ongoing
  }
}
