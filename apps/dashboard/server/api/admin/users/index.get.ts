import { users } from '@skald-scan/shared'
import { count, desc } from 'drizzle-orm'
import { defineEventHandler } from 'h3'

import { useDrizzle, requireAdminRole } from '../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const db = useDrizzle(event)

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
