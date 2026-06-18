import { processedJobs } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { createError, getQuery, getRouterParam, readBody, type H3Event } from 'h3'
type D1Binding = Parameters<typeof drizzle>[0]

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

export const getDatabaseFromEvent = (event: H3Event): D1Binding => {
  const env = getCloudflareStorageEnv(event)

  if (!env.DB) {
    throw new Error('Cloudflare DB binding is required')
  }

  return env.DB
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
 * Returns true if the job has NOT been processed yet (and marks it as 'processing').
 * Returns false if the job was already completed or is currently being processed.
 *
 * Used by import-manga.ts, sync-chapters.ts, download-pages.ts (migrate when safe).
 */
export const claimQueueJob = async (
  database: D1Binding,
  jobId: string
): Promise<boolean> => {
  const db = drizzle(database)
  const existing = await db.select({ jobId: processedJobs.jobId })
    .from(processedJobs)
    .where(eq(processedJobs.jobId, jobId))
    .get()
  if (existing) {
    return false
  }

  await db.insert(processedJobs).values({
    jobId,
    status: 'processing',
  })
  return true
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
  const db = drizzle(database)
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
  const db = drizzle(database)
  await db.update(processedJobs)
    .set({
      status: 'failed',
      metadata: JSON.stringify({ error: String(error) })
    })
    .where(eq(processedJobs.jobId, jobId))
}
