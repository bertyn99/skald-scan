import { collections } from '@skald-scan/shared'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { useDrizzle, requireAuthenticatedSession } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)
  const userId = event.context.authSession?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const db = useDrizzle(event)

  const rows = await db.select({
    id: collections.id,
    name: collections.name,
    description: collections.description,
    createdAt: collections.createdAt
  })
    .from(collections)
    .where(eq(collections.userId, userId))
    .all()

  return { collections: rows }
})
