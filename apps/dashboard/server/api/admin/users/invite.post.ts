import { createError, defineEventHandler } from 'h3'

import { readEventBody, requireAdminRole } from '../../../utils/storage'

type InviteBody = {
  email?: string
}

type InviteResponse = {
  email: string
  token: string
  expiresAt: number
  signupUrl: string
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event): Promise<InviteResponse> => {
  requireAdminRole(event)

  const body = await readEventBody<InviteBody>(event)
  const email = body.email?.trim()

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'email is required' })
  }

  // V1: generate a one-time invite token without DB storage or email sending.
  // V2: persist to an invites table and dispatch via email gateway.
  const token = crypto.randomUUID()
  const expiresAt = Date.now() + INVITE_TTL_MS

  return {
    email,
    token,
    expiresAt,
    signupUrl: `/auth/sign-in?invite=${token}`
  }
})
