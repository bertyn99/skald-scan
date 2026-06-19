export function mangaCoverUrl(mangaId: string, coverUrl?: string | null): string | null {
  if (!coverUrl || coverUrl === 'data:uploaded') {
    return `/api/manga/${mangaId}/cover`
  }
  if (coverUrl.startsWith('/api/manga/')) {
    return coverUrl
  }
  return coverUrl
}

export async function uploadMangaCover(mangaId: string, file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await $fetch<{ coverUrl: string }>(`/api/manga/${mangaId}/cover`, {
    method: 'POST',
    body: arrayBuffer,
    headers: {
      'Content-Type': file.type || 'image/webp'
    }
  })
  return result.coverUrl
}
