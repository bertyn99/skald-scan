import type { MangaDexClient } from '@skald-scan/shared'
import { MangaDexClient as MangaDexClientClass } from '@skald-scan/shared'
import { createError, defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = query.q

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Query parameter "q" is required' })
  }

  const limit = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : 20
  const offset = typeof query.offset === 'string' ? Number.parseInt(query.offset, 10) : 0

  const client: MangaDexClient = new MangaDexClientClass()

  try {
    const results = await client.searchManga(q, { limit, offset })
    return results
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: `MangaDex search failed: ${error instanceof Error ? error.message : String(error)}`,
    })
  }
})
