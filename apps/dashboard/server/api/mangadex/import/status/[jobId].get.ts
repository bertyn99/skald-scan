import { processedJobs } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'

import { getDatabaseFromEvent, requireAuthenticatedSession } from '../../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)
  const jobId = getRouterParam(event, 'jobId')

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const job = await db.select({
    jobId: processedJobs.jobId,
    status: processedJobs.status,
    metadata: processedJobs.metadata,
  })
    .from(processedJobs)
    .where(eq(processedJobs.jobId, jobId))
    .get()

  if (!job) {
    return { status: 'queued' }
  }

  let progress: { chapters: number; pages: number } | undefined
  if (job.metadata) {
    try {
      const parsed = JSON.parse(job.metadata)
      if (parsed.newChapters !== undefined || parsed.pagesCount !== undefined) {
        progress = { chapters: parsed.newChapters ?? 0, pages: parsed.pagesCount ?? 0 }
      }
    } catch {
      // ignore parse errors
    }
  }

  return {
    status: job.status === 'processing' ? 'processing' : job.status === 'completed' ? 'completed' : 'failed',
    progress,
    error: job.status === 'failed' ? job.metadata : undefined,
  }
})
