export function useOfflineCache() {
  const isOnline = ref(true)
  const cachedChapters = ref<Set<string>>(new Set())

  onMounted(async () => {
    isOnline.value = navigator.onLine

    window.addEventListener('online', () => { isOnline.value = true })
    window.addEventListener('offline', () => { isOnline.value = false })

    await registerServiceWorker()
    await checkCachedChapters()
  })

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              checkCachedChapters()
            }
          })
        }
      })
    } catch {
      // SW registration failure is non-critical
    }
  }

  async function checkCachedChapters() {
    if (!('caches' in window)) return

    try {
      const cache = await caches.open('skald-scan-pages-v1')
      const keys = await cache.keys()
      const chapterIds = new Set<string>()

      for (const key of keys) {
        const match = key.url.match(/\/chapters\/([^/]+)\/pages\//)
        if (match?.[1]) chapterIds.add(match[1])
      }

      cachedChapters.value = chapterIds
    } catch {
      // Cache access failure is non-critical
    }
  }

  function isChapterCached(chapterId: string): boolean {
    return cachedChapters.value.has(chapterId)
  }

  async function clearCache(): Promise<void> {
    if (!('caches' in window)) return

    try {
      const cache = await caches.open('skald-scan-pages-v1')
      const keys = await cache.keys()
      await Promise.all(keys.map((k) => cache.delete(k)))
      cachedChapters.value = new Set()
    } catch {
      // Clear failure is non-critical
    }
  }

  return { isOnline, cachedChapters, isChapterCached, clearCache }
}
