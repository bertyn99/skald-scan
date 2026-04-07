import { getAuthFromEvent } from '../utils/auth'
import { defineEventHandler, getRequestHeaders } from 'h3'

export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/api/auth')) {
    return
  }

  const auth = getAuthFromEvent(event)

  event.context.auth = auth

  const headerEntries: [string, string][] = []
  if (event.node?.req) {
    for (const [key, value] of Object.entries(getRequestHeaders(event))) {
      if (typeof value === 'string') {
        headerEntries.push([key, value])
      }
    }
  }

  const session = await auth.api.getSession({
    headers: new Headers(headerEntries),
  })

  event.context.authSession = session
})
