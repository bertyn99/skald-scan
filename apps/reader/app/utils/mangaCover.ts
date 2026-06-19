import { dashboardApi } from './dashboardApi'

export function mangaCoverUrl(mangaId: string, coverUrl?: string | null): string | null {
  if (!coverUrl || coverUrl === 'data:uploaded') {
    return dashboardApi(`/manga/${mangaId}/cover`)
  }
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return coverUrl
  }
  if (coverUrl.startsWith('/api/')) {
    return dashboardApi(coverUrl.replace(/^\/api/, ''))
  }
  return dashboardApi(`/manga/${mangaId}/cover`)
}
