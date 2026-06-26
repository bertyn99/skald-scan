import { pages, processedJobs } from '@skald-scan/shared'
import { eq, inArray } from 'drizzle-orm'
import { createError, getQuery, getRouterParam, readBody, type H3Event } from 'h3'

import { type D1Binding, useDrizzle } from './drizzle'

export { getD1Binding as getDatabaseFromEvent, useDrizzle } from './drizzle'
export type { D1Binding } from './drizzle'

export type ExtractZipQueueMessage = {
  type: 'extract-zip'
  jobId: string
  mangaId: string
  chapterId: string
  tempR2Key: string
}

export type ImportMangaQueueMessage = {
  type: 'import-manga'
  jobId: string
  mangaDexId: string
  languages?: string[]
}

export type SyncChaptersQueueMessage = {
  type: 'sync-chapters'
  jobId: string
  mangaId: string
  mangaDexId: string
}

export type DownloadPagesQueueMessage = {
  type: 'download-pages'
  jobId: string
  mangaId: string
  chapterId: string
  mangaDexChapterId: string
}

export type SyncQueueMessage =
  | ExtractZipQueueMessage
  | ImportMangaQueueMessage
  | SyncChaptersQueueMessage
  | DownloadPagesQueueMessage

type QueueBinding = {
  send: (message: SyncQueueMessage) => Promise<void>
}

export type StorageObject = {
  body?: ReadableStream<Uint8Array>
  httpEtag?: string
  httpMetadata?: {
    contentType?: string
    cacheControl?: string
  }
}

export type StorageBucketBinding = {
  put: (
    key: string,
    value: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: {
      httpMetadata?: {
        contentType?: string
        cacheControl?: string
      }
      customMetadata?: Record<string, string>
    }
  ) => Promise<unknown>
  get: (key: string) => Promise<StorageObject | null>
  delete?: (key: string) => Promise<void>
  createPresignedUrl?: (key: string, options?: PresignedUrlOptions) => Promise<string | URL>
}

export type DashboardStorageEnv = {
  DB: D1Binding
  STORAGE: StorageBucketBinding
  SYNC_QUEUE: QueueBinding
}

export type DashboardStorageCloudflareEnv = Partial<DashboardStorageEnv>

type CloudflareEventContext = {
  cloudflare?: {
    env?: DashboardStorageCloudflareEnv
  }
}

type PresignedUrlOptions = {
  method?: 'PUT' | 'GET' | 'HEAD' | 'DELETE'
  expiresIn?: number
}

type R2BucketWithPresigned = StorageBucketBinding & {
  createPresignedUrl?: (key: string, options?: PresignedUrlOptions) => Promise<string | URL>
}

export const buildPageR2Key = (mangaId: string, chapterId: string, pageNumber: number): string =>
  `manga/${sanitizePathSegment(mangaId)}/chapters/${sanitizePathSegment(chapterId)}/pages/${pageNumber}.webp`

export const buildCoverR2Key = (mangaId: string): string =>
  `manga/${sanitizePathSegment(mangaId)}/cover.webp`

export const buildTempZipR2Key = (jobId: string): string =>
  `temp/${sanitizePathSegment(jobId)}.zip`

export const resolvePageR2KeyFromFileName = (
  mangaId: string,
  chapterId: string,
  fileName: string
): string => {
  const pageNumber = getPageNumberFromFileName(fileName)

  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    throw new Error('fileName must include a positive page number')
  }

  return buildPageR2Key(mangaId, chapterId, pageNumber)
}

export const isZipLikeFileName = (fileName: string): boolean => {
  const normalized = fileName.trim().toLowerCase()

  return normalized.endsWith('.zip') || normalized.endsWith('.cbz')
}

export const getPageNumberFromFileName = (fileName: string): number => {
  const normalized = fileName.trim().toLowerCase()
  const withoutExtension = normalized.replace(/\.[a-z0-9]+$/i, '')
  const numericPart = withoutExtension.match(/\d+/)

  return numericPart ? Number.parseInt(numericPart[0], 10) : Number.NaN
}

export const generateR2UploadPresignedUrl = async (
  bucket: StorageBucketBinding,
  key: string,
  expiresIn = 3600
): Promise<string> => {
  const maybeBucket = bucket as R2BucketWithPresigned

  if (!maybeBucket.createPresignedUrl) {
    throw new Error('R2 createPresignedUrl is not available in this runtime')
  }

  const presignedUrl = await maybeBucket.createPresignedUrl(key, {
    method: 'PUT',
    expiresIn
  })

  return typeof presignedUrl === 'string' ? presignedUrl : presignedUrl.toString()
}

export const getCloudflareStorageEnv = (event: H3Event): DashboardStorageCloudflareEnv => {
  const maybeContext = event.context as H3Event['context'] & CloudflareEventContext
  const env = maybeContext.cloudflare?.env

  if (!env) {
    throw new Error('Cloudflare env bindings are required')
  }

  return env
}

export const getStorageFromEvent = (event: H3Event): StorageBucketBinding => {
  const env = getCloudflareStorageEnv(event)

  if (!env.STORAGE) {
    throw new Error('Cloudflare STORAGE binding is required')
  }

  return env.STORAGE
}

export const getSyncQueueFromEvent = (event: H3Event): QueueBinding => {
  const env = getCloudflareStorageEnv(event)

  if (!env.SYNC_QUEUE) {
    throw new Error('Cloudflare SYNC_QUEUE binding is required')
  }

  return env.SYNC_QUEUE
}

export const requireAuthenticatedSession = (event: H3Event): void => {
  if (!event.context.authSession?.session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
}

export const requireAdminRole = (event: H3Event): void => {
  requireAuthenticatedSession(event)
  const role = event.context.authSession?.user?.role
  if (role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }
}

export const readEventBody = async <T>(event: H3Event): Promise<T> => {
  const maybeBody = (event.context as H3Event['context'] & { body?: T }).body

  if (maybeBody !== undefined) {
    return maybeBody
  }

  return await readBody<T>(event)
}

export const readEventQuery = (event: H3Event): Record<string, unknown> => {
  const maybeQuery = (event.context as H3Event['context'] & { query?: Record<string, unknown> }).query

  return maybeQuery ?? getQuery(event)
}

export const readEventParam = (event: H3Event, name: string): string | undefined => {
  const maybeParams = (event.context as H3Event['context'] & { params?: Record<string, string | undefined> }).params

  return maybeParams?.[name] ?? getRouterParam(event, name) ?? undefined
}

const sanitizePathSegment = (value: string): string => value.trim().replaceAll('/', '-')

/**
 * Atomic queue-job claim. Returns true when this caller is allowed to process
 * the job, false otherwise. Handles three cases in one statement:
 *
 *   1. Job has never been seen  → INSERT succeeds, claim granted.
 *   2. Job previously failed     → UPDATE back to 'processing', claim granted
 *      (so queue retries actually re-run the work instead of no-opping).
 *   3. Job is 'processing' or 'completed' → ON CONFLICT DO NOTHING, claim denied
 *      (protects against concurrent redeliveries and double-processing).
 *
 * Used by import-manga.ts, sync-chapters.ts, download-pages.ts, extract-zip.ts.
 */
export const claimQueueJob = async (
  database: D1Binding,
  jobId: string
): Promise<boolean> => {
  // processed_jobs schema requires processed_at + status (NOT NULL).
  // Bind both explicitly; the UPSERT's WHERE clause gates reclaim to failed rows.
  const now = Date.now()
  const result = await database
    .prepare(
      `INSERT INTO processed_jobs (job_id, processed_at, status, metadata)
       VALUES (?1, ?2, 'processing', NULL)
       ON CONFLICT (job_id) DO UPDATE
         SET processed_at = ?2,
             status = 'processing',
             metadata = NULL
         WHERE processed_jobs.status = 'failed'
       RETURNING job_id`
    )
    .bind(jobId, now)
    .first<{ job_id: string }>()

  return result?.job_id === jobId
}

/**
 * Marks a queue job as completed with optional metadata.
 *
 * Used by import-manga.ts, sync-chapters.ts, download-pages.ts (migrate when safe).
 */
export const completeQueueJob = async (
  database: D1Binding,
  jobId: string,
  metadata?: Record<string, unknown>
): Promise<void> => {
  const db = useDrizzle(database)
  await db.update(processedJobs)
    .set({
      status: 'completed',
      metadata: metadata ? JSON.stringify(metadata) : null
    })
    .where(eq(processedJobs.jobId, jobId))
}

/**
 * Marks a queue job as failed, recording the error in metadata.
 *
 * Used by import-manga.ts, sync-chapters.ts, download-pages.ts (migrate when safe).
 */
export const failQueueJob = async (
  database: D1Binding,
  jobId: string,
  error: unknown
): Promise<void> => {
  const db = useDrizzle(database)
  await db.update(processedJobs)
    .set({
      status: 'failed',
      metadata: JSON.stringify({ error: String(error) })
    })
    .where(eq(processedJobs.jobId, jobId))
}

// Reclaims R2 objects + hard-deletes page rows for chapters being soft-deleted.
// Cascade FK only fires on chapter HARD delete, so callers that mark chapters
// Unavailable (status update) must invoke this to avoid orphaned storage.
// Skips pages whose r2_key is NULL (legacy external-URL pages).
// Both the SELECT and DELETE chunk against D1's 100-param-per-statement cap
// (a takedown on a long-running series can soft-delete 100+ chapters at once).
const R2_DELETE_CONCURRENCY = 5
const CHAPTER_ID_CHUNK = 90

export const purgeChapterStorage = async (
  env: { STORAGE: StorageBucketBinding; DB: D1Binding },
  chapterIds: string[]
): Promise<void> => {
  if (chapterIds.length === 0) return
  const db = useDrizzle(env.DB)

  const keysToDelete: string[] = []
  for (let i = 0; i < chapterIds.length; i += CHAPTER_ID_CHUNK) {
    const chunk = chapterIds.slice(i, i + CHAPTER_ID_CHUNK)
    const rows = await db.select({ r2Key: pages.r2Key })
      .from(pages)
      .where(inArray(pages.chapterId, chunk))
      .all()
    for (const row of rows) {
      if (typeof row.r2Key === 'string' && row.r2Key.length > 0) {
        keysToDelete.push(row.r2Key)
      }
    }
  }

  if (!env.STORAGE.delete) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: 'STORAGE.delete unavailable; R2 objects orphaned',
      count: keysToDelete.length
    }))
  } else {
    for (let i = 0; i < keysToDelete.length; i += R2_DELETE_CONCURRENCY) {
      const batch = keysToDelete.slice(i, i + R2_DELETE_CONCURRENCY)
      await Promise.all(batch.map(key =>
        env.STORAGE.delete!(key).catch(err => {
          console.warn(JSON.stringify({
            level: 'warn',
            message: 'R2 delete failed',
            key,
            error: String(err)
          }))
        })
      ))
    }
  }

  for (let i = 0; i < chapterIds.length; i += CHAPTER_ID_CHUNK) {
    const chunk = chapterIds.slice(i, i + CHAPTER_ID_CHUNK)
    await db.delete(pages).where(inArray(pages.chapterId, chunk))
  }
}
