const CACHE_NAME = 'skald-scan-pages-v1'
const MAX_CACHE_SIZE = 500 * 1024 * 1024 // 500MB

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only cache page image requests
  const isPageImage = url.pathname.match(/\/api\/proxy\/manga\/[^/]+\/chapters\/[^/]+\/pages\/\d+$/)

  if (!isPageImage) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached

      const response = await fetch(event.request)
      if (response.ok) {
        await cache.put(event.request, response.clone())
        await evictIfNeeded(cache)
      }
      return response
    }),
  )
})

async function evictIfNeeded(cache: Cache) {
  const entries = await cache.keys()
  if (entries.length < 200) return

  // Simple LRU: delete oldest third
  const toDelete = entries.slice(0, Math.floor(entries.length / 3))
  await Promise.all(toDelete.map((req) => cache.delete(req)))
}
