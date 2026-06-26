import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Idempotency store for queue workers (import-manga, sync-chapters,
// download-pages, extract-zip). Every worker must check this before doing work.
export const processedJobs = sqliteTable('processed_jobs', {
  jobId: text('job_id').primaryKey(),
  processedAt: integer('processed_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  status: text('status', { enum: ['processing', 'completed', 'failed'] }).notNull(),
  metadata: text('metadata') // JSON string
})
