import { manga } from '@skald-scan/shared'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import {
  useDrizzle,
  readEventParam,
  requireAdminRole
} from '../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const mangaId = readEventParam(event, 'mangaId')
  if (!mangaId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId is required' })
  }

  const db = useDrizzle(event)

  const result = await db.update(manga)
    .set({ deletedAt: new Date() })
    .where(eq(manga.id, mangaId))
    .run()

  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete manga' })
  }

  return { deleted: true, mangaId }
})
