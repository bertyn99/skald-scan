import type { UpdatePreferencesRequest } from '@skald-scan/shared'
import { users } from '@skald-scan/shared'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import { useDrizzle, readEventBody, requireAuthenticatedSession } from '../../../utils/storage'
import { isValidLanguageCode } from '../../../utils/language'

export default defineEventHandler(async (event) => {
  requireAuthenticatedSession(event)
  const body = await readEventBody<UpdatePreferencesRequest>(event)
  const lang = body?.language

  if (typeof lang !== 'string' || !isValidLanguageCode(lang)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid language code' })
  }

  const userId = event.context.authSession?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  // preferredLanguage is a simple preference column (no auth/security
  // implications). Direct DB write is safe and avoids the complexity of
  // Better Auth's strict endpoint context shape. The field is registered in
  // additionalFields (input: false) so it cannot be set via signUp, but the
  // client-side session still surfaces it on the next getSession call.
  const db = useDrizzle(event)
  await db.update(users)
    .set({ preferredLanguage: lang })
    .where(eq(users.id, userId))

  return { language: lang }
})
