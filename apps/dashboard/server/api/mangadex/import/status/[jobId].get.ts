import { processedJobs } from '@skald-scan/shared'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'

import { useDrizzle, requireAdminRole } from '../../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)
  const jobId = getRouterParam(event, 'jobId')

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }

  const db = useDrizzle(event)

  const job = await db.select({
    jobId: processedJobs.jobId,
    status: processedJobs.status,
    metadata: processedJobs.metadata
  })
    .from(processedJobs)
    .where(eq(processedJobs.jobId, jobId))
    .get()

  if (!job) {
    return { status: 'queued' as const }
  }

  let progress: { chapters: number; pages: number } | undefined
  let mangaId: string | undefined
  if (job.metadata) {
    try {
      const parsed = JSON.parse(job.metadata) as Record<string, unknown>
      if (parsed.newChapters !== undefined || parsed.pagesCount !== undefined) {
        progress = {
          chapters: typeof parsed.newChapters === 'number' ? parsed.newChapters : 0,
          pages: typeof parsed.pagesCount === 'number' ? parsed.pagesCount : 0
        }
      }
      if (typeof parsed.mangaId === 'string') {
        mangaId = parsed.mangaId
      }
    } catch {
      // ignore parse errors
    }
  }

  return {
    status: job.status === 'processing'
      ? 'processing' as const
      : job.status === 'completed'
        ? 'completed' as const
        : 'failed' as const,
    progress,
    mangaId,
    error: job.status === 'failed' ? job.metadata ?? undefined : undefined
  }
})
