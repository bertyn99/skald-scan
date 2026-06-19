import { createError, defineEventHandler, readRawBody } from 'h3'

export default defineEventHandler(async (event) => {
  // Reserved for P3 Stripe webhooks — verify signature before processing.
  await readRawBody(event)
  throw createError({ statusCode: 501, statusMessage: 'Stripe webhooks not implemented' })
})
