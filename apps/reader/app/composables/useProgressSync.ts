export function useProgressSync(mangaId: () => string, chapterId: () => string, totalPages: () => number) {
  let lastSyncedPage = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastUpdatedAt = Date.now()

  function onPageChange(page: number) {
    if (page === lastSyncedPage) return
    lastSyncedPage = page

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => sync(page), 1000)
  }

  async function sync(page: number) {
    const mId = mangaId()
    const cId = chapterId()
    const total = totalPages()
    if (!mId || !cId || total === 0) return

    const read = page >= total
    const updatedAt = Date.now()

    try {
      await $fetch(dashboardApi('/reading-progress'), {
        method: 'PUT',
        body: {
          mangaId: mId,
          chapterId: cId,
          lastPageRead: page,
          read,
          updatedAt
        }
      })
      lastUpdatedAt = updatedAt
    } catch {
      // Silent fail — progress sync is non-critical
    }
  }

  function destroy() {
    if (timer) clearTimeout(timer)
  }

  return { onPageChange, destroy, lastUpdatedAt: () => lastUpdatedAt }
}
