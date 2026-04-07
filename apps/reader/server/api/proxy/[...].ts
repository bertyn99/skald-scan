import { defineEventHandler, getMethod, getHeaders, readRawBody, setResponseHeaders, setResponseHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const dashboardUrl = config.public.dashboardUrl
  const url = event.node.req.url || ''
  const path = url.replace(/^\/api\/proxy/, '')
  const target = new URL(path, dashboardUrl).toString()

  const method = getMethod(event)
  const headers = getHeaders(event)
  const body = method !== 'GET' && method !== 'HEAD' ? await readRawBody(event) : undefined

  // clean up headers that shouldn't be forwarded like host
  const { host, ...forwardHeaders } = headers

  const response = await fetch(target, {
    method,
    headers: forwardHeaders as Record<string, string>,
    body
  })

  // forward response headers
  response.headers.forEach((value, key) => {
    setResponseHeader(event, key, value)
  })

  // Add CORS headers to the response
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })

  return response.body // return the stream
})