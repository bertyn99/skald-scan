export enum MangaStatus {
  Ongoing = 'ongoing',
  Completed = 'completed',
  Hiatus = 'hiatus',
  Cancelled = 'cancelled',
}

export enum SyncStatus {
  Idle = 'idle',
  Syncing = 'syncing',
  Error = 'error',
}

export enum UserRole {
  Admin = 'admin',
  Reader = 'reader',
}

export enum ChapterStatus {
  Available = 'available',
  Unavailable = 'unavailable',
  Processing = 'processing',
}

export enum Language {
  En = 'en',
  Ja = 'ja',
  Ko = 'ko',
  Zh = 'zh',
  Fr = 'fr',
  Es = 'es',
  EsLa = 'es-la',
  Pt = 'pt',
  PtBr = 'pt-br',
}

// Languages mirrored by default when none are configured per-manga.
// Used by sync-chapters and import-manga. Persisted as JSON on mangaDexSync.
export const DEFAULT_LANGUAGES: string[] = [Language.En, Language.Fr, Language.Es, Language.Pt]

export function isLanguageCode(value: unknown): value is string {
  return typeof value === 'string' && (Object.values(Language) as string[]).includes(value)
}

export function parseLanguageList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_LANGUAGES
  const filtered = raw.filter(isLanguageCode)
  return filtered.length > 0 ? filtered : DEFAULT_LANGUAGES
}

// Parse an Accept-Language header (RFC 7231 §5.3.5) into the best-supported
// Language code. Honors q= weights (descending), then falls back to tag-prefix
// matching (e.g. `es-MX` → `es`, `pt-PT` → `pt`). Returns null when nothing
// matches so callers can apply their own final fallback.
//
// Tag variants: `zh-Hant`/`zh-TW` map to `zh` (we don't distinguish Traditional
// vs Simplified in this catalog); `pt-BR` matches the dedicated `pt-br` code
// exactly before falling back to `pt`; same for `es-419` → `es-la` → `es`.
const LANGUAGE_VALUES = Object.values(Language) as string[]

export function parseAcceptLanguage(header?: string | null): string | null {
  if (!header) return null

  const parsed = header
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.find(p => p.trim().startsWith('q='))
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1
      return { tag: (tag ?? '').toLowerCase(), q: Number.isFinite(q) ? q : 0 }
    })
    .filter(entry => entry.tag.length > 0 && entry.q > 0)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of parsed) {
    // Exact (e.g. "pt-br", "es-la").
    if (LANGUAGE_VALUES.includes(tag)) return tag as Language
    // Region-stripped (e.g. "es-mx" → "es", "fr-ca" → "fr").
    const base = tag.split('-')[0]!
    if (LANGUAGE_VALUES.includes(base)) return base as Language
    // Locale-to-dialect mapping (e.g. "pt-br" base is "pt" — already matched
    // above — but a header like "pt-br,es-419" needs the second to hit es-la).
    const DIALECT_BY_BASE: Record<string, string> = { es: Language.EsLa, pt: Language.PtBr }
    const dialect = DIALECT_BY_BASE[base]
    if (dialect && LANGUAGE_VALUES.includes(dialect)) return dialect as Language
  }

  return null
}
