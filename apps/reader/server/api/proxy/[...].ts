import { defineEventHandler, getMethod, getHeaders, readRawBody, setResponseHeaders, setResponseHeader } from 'h3'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })

  if (getMethod(event) === 'OPTIONS') {
    return null
  }

  const config = useRuntimeConfig()
  const dashboardUrl = config.public.dashboardUrl
  const strippedPath = (event.path || '').replace(/^\/api\/proxy/, '') || '/'
  const apiPath = strippedPath.startsWith('/api')
    ? strippedPath
    : `/api${strippedPath.startsWith('/') ? strippedPath : `/${strippedPath}`}`
  const target = new URL(apiPath, dashboardUrl).toString()

  const method = getMethod(event)
  const body = method !== 'GET' && method !== 'HEAD' ? await readRawBody(event) : undefined

  const { host, ...rawHeaders } = getHeaders(event)
  const forwardHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (typeof value === 'string') forwardHeaders[key] = value
  }

  const response = await fetch(target, {
    method,
    headers: forwardHeaders,
    body,
  })

  // forward response headers
  response.headers.forEach((value, key) => {
    setResponseHeader(event, key, value)
  })

  return response.body // return the stream
})