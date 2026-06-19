/**
 * Build a reader-side proxy URL for a dashboard API path.
 * Paths may be passed with or without the `/api` prefix.
 */
export function dashboardApi(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const apiPath = normalized.startsWith('/api') ? normalized : `/api${normalized}`
  return `/api/proxy${apiPath}`
}
