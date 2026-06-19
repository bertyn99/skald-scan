import { mangaDexSync, processedJobs } from '@skald-scan/shared'
import { desc } from 'drizzle-orm'
import { defineEventHandler } from 'h3'

import { useDrizzle, requireAdminRole } from '../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const db = useDrizzle(event)

  const jobs = await db.select({
    jobId: processedJobs.jobId,
    status: processedJobs.status,
    metadata: processedJobs.metadata,
    processedAt: processedJobs.processedAt
  })
    .from(processedJobs)
    .orderBy(desc(processedJobs.processedAt))
    .limit(100)
    .all()

  const syncErrors = await db.select({
    mangaId: mangaDexSync.mangaId,
    lastError: mangaDexSync.lastError,
    syncStatus: mangaDexSync.syncStatus
  })
    .from(mangaDexSync)
    .all()

  return {
    jobs: jobs.map(job => ({
      jobId: job.jobId,
      status: job.status,
      metadata: job.metadata,
      processedAt: job.processedAt
    })),
    syncErrors: syncErrors.filter(s => s.lastError)
  }
})
