import { createError, defineEventHandler } from 'h3'
import {
  getDatabaseFromEvent,
  getStorageFromEvent,
  getSyncQueueFromEvent,
  requireAdminRole
} from '../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const checks: Record<string, 'ok' | 'error'> = {
    db: 'ok',
    storage: 'ok',
    queue: 'ok'
  }

  try {
    const db = getDatabaseFromEvent(event)
    await db.prepare('SELECT 1').first()
  } catch (dbErr) {
    checks.db = 'error'
  }

  try {
    const storage = getStorageFromEvent(event)
    await storage.get('__health_check__')
  } catch (storageErr) {
    checks.storage = 'error'
  }

  try {
    getSyncQueueFromEvent(event)
  } catch (queueErr) {
    checks.queue = 'error'
  }

  const allOk = Object.values(checks).every(v => v === 'ok')
  const dbOk = checks.db === 'ok'

  if (!allOk) {
    console.warn(JSON.stringify({ level: 'warn', message: 'health check degraded', checks }))
  }

  if (!dbOk) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service unavailable',
      data: { checks }
    })
  }

  return {
    status: allOk ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }
})
