import type { UserProfileResponse } from '@skald-scan/shared'
import { createError, defineEventHandler } from 'h3'

import { requireAuthenticatedSession } from '../../utils/storage'

export default defineEventHandler((event): UserProfileResponse => {
  requireAuthenticatedSession(event)
  const user = event.context.authSession?.user
  if (!user) {
    // requireAuthenticatedSession only checks for a session; a tombstoned user
    // (session present, user absent) must still 401 here.
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  // preferredLanguage is registered in Better Auth's additionalFields, so the
  // inferred session user type already includes it — no cast needed.
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
    preferredLanguage: user.preferredLanguage ?? null
  }
})
