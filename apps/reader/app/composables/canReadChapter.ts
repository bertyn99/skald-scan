export function canReadChapter(_mangaId: string, _chapterId: string) {
  return { allowed: true as const, reason: null as string | null }
}
