import { chapters, manga, mangaDexSync } from '@skald-scan/shared'
import type { MangaDexClient, MangaDexManga } from '@skald-scan/shared'
import { buildMangaDexCoverUrl, MangaStatus, SyncStatus } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'

import { dispatchSyncQueueMessage, type SyncQueueRuntimeEnv } from '../utils/sync-queue'
import { claimQueueJob, completeQueueJob, failQueueJob } from '../utils/storage'

interface ImportMangaMessage {
  jobId: string
  mangaDexId: string
  type: 'import-manga'
}

export async function handleImportManga(
  message: ImportMangaMessage,
  env: SyncQueueRuntimeEnv,
  client: MangaDexClient,
): Promise<void> {
  if (!(await claimQueueJob(env.DB, message.jobId))) {
    return
  }

  const db = drizzle(env.DB)

  try {
    const response = await client.getManga(message.mangaDexId)
    const mdManga = response.data

    const title = mdManga.attributes.title.en
      ?? Object.values(mdManga.attributes.title)[0]
      ?? 'Unknown'
    const description = mdManga.attributes.description?.en ?? null
    const status = mapMangaDexStatus(mdManga.attributes.status)
    const tags = mdManga.attributes.tags
      ?.map((tag) => tag.attributes.name.en ?? Object.values(tag.attributes.name)[0] ?? '')
      .filter(Boolean) ?? []
    const tagsJson = tags.length > 0 ? JSON.stringify(tags) : null

    const author = await resolveRelationshipName(client, mdManga, 'author')
    const artist = await resolveRelationshipName(client, mdManga, 'artist')
    const coverUrl = resolveCoverUrl(message.mangaDexId, mdManga)

    const existingManga = await db.select({ id: manga.id })
      .from(manga)
      .where(eq(manga.mangaDexId, message.mangaDexId))
      .get()

    const mangaId = existingManga?.id ?? crypto.randomUUID()
    const now = Date.now()

    if (!existingManga) {
      await db.insert(manga).values({
        id: mangaId,
        title,
        description,
        coverUrl,
        status,
        mangaDexId: message.mangaDexId,
        author,
        artist,
        tags: tagsJson,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      await db.update(manga)
        .set({
          title,
          description,
          coverUrl,
          status,
          author,
          artist,
          tags: tagsJson,
          updatedAt: now,
        })
        .where(eq(manga.id, mangaId))
    }

    const existingSync = await db.select({ id: mangaDexSync.id })
      .from(mangaDexSync)
      .where(eq(mangaDexSync.mangaId, mangaId))
      .get()

    if (!existingSync) {
      await db.insert(mangaDexSync).values({
        id: crypto.randomUUID(),
        mangaId,
        syncStatus: SyncStatus.Syncing,
        autoSyncEnabled: true,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      await db.update(mangaDexSync)
        .set({ syncStatus: SyncStatus.Syncing, updatedAt: now, lastError: null })
        .where(eq(mangaDexSync.mangaId, mangaId))
    }

    try {
      await dispatchSyncQueueMessage(env, {
        jobId: crypto.randomUUID(),
        mangaId,
        mangaDexId: message.mangaDexId,
        type: 'sync-chapters',
      }, client)
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Chapter sync failed after manga import',
        mangaId,
        mangaDexId: message.mangaDexId,
        error: String(error),
      }))

      await db.update(mangaDexSync)
        .set({
          syncStatus: SyncStatus.Error,
          lastError: String(error),
          updatedAt: Date.now(),
        })
        .where(eq(mangaDexSync.mangaId, mangaId))
    }

    await completeQueueJob(env.DB, message.jobId, { mangaId })
  } catch (error) {
    await failQueueJob(env.DB, message.jobId, error)
    throw error
  }
}

async function resolveRelationshipName(
  client: MangaDexClient,
  mdManga: MangaDexManga,
  type: 'author' | 'artist',
): Promise<string | null> {
  const relationship = mdManga.relationships?.find((rel) => rel.type === type)
  if (!relationship) {
    return null
  }

  try {
    const response = await client.getAuthor(relationship.id)
    return response.data.attributes.name
  } catch {
    return null
  }
}

function resolveCoverUrl(mangaDexId: string, mdManga: MangaDexManga): string | null {
  const coverRelationship = mdManga.relationships?.find((rel) => rel.type === 'cover_art')
  const fileName = coverRelationship?.attributes?.fileName
  if (!fileName) {
    return null
  }

  return buildMangaDexCoverUrl(mangaDexId, fileName)
}

function mapMangaDexStatus(status?: string): string {
  switch (status) {
    case 'completed': return MangaStatus.Completed
    case 'hiatus': return MangaStatus.Hiatus
    case 'cancelled': return MangaStatus.Cancelled
    default: return MangaStatus.Ongoing
  }
}
