import {
  DEFAULT_LANGUAGES,
  manga,
  mangaDexSync,
  parseLanguageList
} from '@skald-scan/shared'
import type { MangaDexClient, MangaDexManga } from '@skald-scan/shared'
import { buildMangaDexCoverUrl, MangaStatus, SyncStatus } from '@skald-scan/shared'
import { eq } from 'drizzle-orm'

import { dispatchSyncQueueMessage, type SyncQueueRuntimeEnv } from '../utils/sync-queue'
import { claimQueueJob, completeQueueJob, failQueueJob } from '../utils/storage'
import { useDrizzle } from '../utils/drizzle'
import { refreshMangaTranslations } from '../utils/translations'

interface ImportMangaMessage {
  jobId: string
  mangaDexId: string
  // Optional per-manga language override; falls back to DEFAULT_LANGUAGES.
  languages?: string[]
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

  const db = useDrizzle(env.DB)
  const languages = parseLanguageList(message.languages ?? DEFAULT_LANGUAGES)

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
      .filter((name): name is string => typeof name === 'string' && name.length > 0) ?? []
    const tagsJson = tags.length > 0 ? JSON.stringify(tags) : null

    const { author, artist } = await resolveRelationshipNames(client, mdManga)
    const coverUrl = resolveCoverUrl(message.mangaDexId, mdManga)

    const existingManga = await db.select({ id: manga.id })
      .from(manga)
      .where(eq(manga.mangaDexId, message.mangaDexId))
      .get()

    const mangaId = existingManga?.id ?? crypto.randomUUID()

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
        tags: tagsJson
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
          tags: tagsJson
        })
        .where(eq(manga.id, mangaId))
    }

    // Atomic upsert of per-language translations. alt_titles is flattened
    // to a string array per the FTS schema contract. Stale languages are removed.
    await refreshMangaTranslations(db, mangaId, mdManga, languages)

    const languagesJson = JSON.stringify(languages)
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
        languages: languagesJson
      })
    } else {
      await db.update(mangaDexSync)
        .set({
          syncStatus: SyncStatus.Syncing,
          lastError: null,
          languages: languagesJson
        })
        .where(eq(mangaDexSync.mangaId, mangaId))
    }

    try {
      await dispatchSyncQueueMessage(env, {
        jobId: crypto.randomUUID(),
        mangaId,
        mangaDexId: message.mangaDexId,
        type: 'sync-chapters'
      }, client)
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Chapter sync failed after manga import',
        mangaId,
        mangaDexId: message.mangaDexId,
        error: String(error)
      }))

      await db.update(mangaDexSync)
        .set({
          syncStatus: SyncStatus.Error,
          lastError: String(error)
        })
        .where(eq(mangaDexSync.mangaId, mangaId))
    }

    await completeQueueJob(env.DB, message.jobId, { mangaId })
  } catch (error) {
    await failQueueJob(env.DB, message.jobId, error)
    throw error
  }
}

// Resolve both author and artist names with one fetch per unique author id.
// Many manga have the same person as both author and artist; without dedup
// we'd call client.getAuthor() twice for the same id.
async function resolveRelationshipNames(
  client: MangaDexClient,
  mdManga: MangaDexManga
): Promise<{ author: string | null; artist: string | null }> {
  const authorRel = mdManga.relationships?.find(rel => rel.type === 'author')
  const artistRel = mdManga.relationships?.find(rel => rel.type === 'artist')
  const uniqueIds = new Set<string>()
  if (authorRel?.id) uniqueIds.add(authorRel.id)
  if (artistRel?.id) uniqueIds.add(artistRel.id)

  const namesById = new Map<string, string>()
  await Promise.all([...uniqueIds].map(async id => {
    try {
      const response = await client.getAuthor(id)
      namesById.set(id, response.data.attributes.name)
    } catch {
      // leave unresolved
    }
  }))

  return {
    author: authorRel?.id ? (namesById.get(authorRel.id) ?? null) : null,
    artist: artistRel?.id ? (namesById.get(artistRel.id) ?? null) : null
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
