import { users } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { count, desc } from 'drizzle-orm'
import { defineEventHandler } from 'h3'

import { getDatabaseFromEvent, requireAdminRole } from '../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    imageUrl: users.imageUrl,
    createdAt: users.createdAt,
  })
    .from(users)
    .orderBy(desc(users.createdAt))
    .all()

  return { users: allUsers }
})
