import { collections } from '@skald-scan/shared'
import { createError, defineEventHandler } from 'h3'

import { useDrizzle, readEventBody, requireAuthenticatedSession } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)
  const userId = event.context.authSession?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readEventBody<{ name?: string; description?: string }>(event)
  const name = body.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const now = Date.now()
  const id = crypto.randomUUID()
  const db = useDrizzle(event)

  await db.insert(collections).values({
    id,
    userId,
    name,
    description: body.description?.trim() || null,
    createdAt: now,
    updatedAt: now
  })

  return { item: { id, name, description: body.description ?? null, createdAt: now } }
})
