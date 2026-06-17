import { users } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { getDatabaseFromEvent, readEventBody, readEventParam, requireAdminRole } from '../../../../utils/storage'

type RoleBody = {
  role?: string
}

const VALID_ROLES = ['admin', 'reader']

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const userId = readEventParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
  }

  const body = await readEventBody<RoleBody>(event)
  const role = body.role?.trim().toLowerCase()

  if (!role || !VALID_ROLES.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: `Role must be one of: ${VALID_ROLES.join(', ')}` })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  await db.update(users).set({ role, updatedAt: Date.now() }).where(eq(users.id, userId)).run()

  const updated = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
  })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return { user: updated }
})
