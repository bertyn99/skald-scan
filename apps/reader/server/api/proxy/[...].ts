import { defineEventHandler, getMethod, getHeader, getHeaders, readRawBody, setResponseHeaders, setResponseHeader, appendResponseHeader } from 'h3'

// Headers we forward from the reader BFF to the dashboard. Anything else is
// dropped to reduce header-injection surface. Critically includes
// Accept-Language so the dashboard can resolve the user's preferred language
// when ?lang= is absent.
const ALLOWED_FORWARD_HEADERS = new Set([
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'user-agent',
])

// Origins allowed to make authenticated cross-origin requests to the reader
// BFF. Populated from runtime config (dashboard + reader canonical URLs) plus
// any configured preview deploys via env.
function buildAllowedOrigins(): string[] {
  const config = useRuntimeConfig()
  const readerUrl = config.public.readerUrl as string | undefined
  const dashboardUrl = config.public.dashboardUrl as string | undefined
  return [
    readerUrl,
    dashboardUrl,
    // comma-separated env override for preview deploys
    process.env.READER_CORS_ALLOW_ORIGINS,
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .flatMap(v => v.split(',').map(s => s.trim()))
    .filter(Boolean)
}

function resolveCorsOrigin(reqOrigin: string | null, allowed: string[]): string {
  if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin
  return allowed[0] ?? ''
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const dashboardUrl = config.public.dashboardUrl
  const allowedOrigins = buildAllowedOrigins()

  const reqOrigin = getHeader(event, 'origin') ?? null
  const corsOrigin = resolveCorsOrigin(reqOrigin, allowedOrigins)
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': corsOrigin,
    // Vary by Origin so caches don't serve one origin's CORS allow-list to another.
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Language',
  })

  if (getMethod(event) === 'OPTIONS') {
    return null
  }

  const strippedPath = (event.path || '').replace(/^\/api\/proxy/, '') || '/'
  const apiPath = strippedPath.startsWith('/api')
    ? strippedPath
    : `/api${strippedPath.startsWith('/') ? strippedPath : `/${strippedPath}`}`
  const target = new URL(apiPath, dashboardUrl).toString()

  const method = getMethod(event)
  const body = method !== 'GET' && method !== 'HEAD' ? await readRawBody(event) : undefined

  // Allowlist forward headers; drop everything else (cookie, cf-*, host, etc.).
  const { host: _host, ...rawHeaders } = getHeaders(event)
  void _host
  const forwardHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (ALLOWED_FORWARD_HEADERS.has(key.toLowerCase()) && typeof value === 'string') {
      forwardHeaders[key] = value
    }
  }

  const response = await fetch(target, {
    method,
    headers: forwardHeaders,
    body,
  })

  // Forward response headers, but:
  //   - SKIP CORS headers (we set our own per-origin CORS above)
  //   - APPEND (not overwrite) for headers that may legitimately repeat
  //     (Set-Cookie, Link, Vary) so multi-valued dashboard responses survive.
  //   - SET for everything else (ETag, Cache-Control, X-Language-Fallback, etc.)
  // so the cache-poisoning fix in manga/index.get.ts reaches the CDN.
  const CORS_HEADERS = new Set([
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'access-control-allow-credentials',
    'access-control-expose-headers',
    'access-control-max-age'
  ])
  const APPEND_HEADERS = new Set(['set-cookie', 'link', 'vary'])

  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (CORS_HEADERS.has(lower)) return
    if (APPEND_HEADERS.has(lower)) {
      appendResponseHeader(event, key, value)
    } else {
      setResponseHeader(event, key, value)
    }
  })

  return response.body
})
