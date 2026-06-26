import type {
  MangaDexAtHomeResponse,
  MangaDexAuthor,
  MangaDexCoverArt,
  MangaDexCoverArtWithUrl,
  MangaDexEntityResponse,
  MangaDexError,
  MangaDexManga,
  MangaDexPage,
  MangaDexSearchResponse,
  MangaDexChapter,
} from './types'

export const DEFAULT_MANGADEX_BASE_URL = 'https://api.mangadex.org'
export const DEFAULT_MANGADEX_UPLOADS_BASE_URL = 'https://uploads.mangadex.org'
export const DEFAULT_MANGADEX_USER_AGENT = 'SkaldScan/1.0 (+https://github.com/skald-scan)'
const DEFAULT_CONTENT_RATING = ['safe', 'suggestive', 'pornographic'] as const

export type MangaDexCoverSize = 256 | 512

export function buildMangaDexCoverUrl(
  mangaId: string,
  fileName: string,
  options: { uploadsBaseUrl?: string; size?: MangaDexCoverSize } = {},
): string {
  const base = (options.uploadsBaseUrl ?? DEFAULT_MANGADEX_UPLOADS_BASE_URL).replace(/\/+$/, '')
  const url = `${base}/covers/${encodeURIComponent(mangaId)}/${encodeURIComponent(fileName)}`
  return options.size ? `${url}.${options.size}.jpg` : url
}

export interface MangaDexClientOptions {
  baseUrl?: string
  uploadsBaseUrl?: string
  userAgent?: string
  fetch?: typeof fetch
  maxRetries?: number
  baseBackoffMs?: number
  jitterMs?: number
  sleep?: (delayMs: number) => Promise<void>
  random?: () => number
}

export interface MangaSearchOptions {
  limit?: number
  offset?: number
  contentRating?: string[]
  includes?: string[]
}

export interface MangaChapterOptions {
  limit?: number
  offset?: number
  language?: string | string[]
}

export class MangaDexClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: MangaDexError,
  ) {
    super(message)
    this.name = 'MangaDexClientError'
  }
}

export class MangaDexClient {
  private readonly baseUrl: string
  private readonly uploadsBaseUrl: string
  private readonly userAgent: string
  private readonly fetchFn: typeof fetch
  private readonly maxRetries: number
  private readonly baseBackoffMs: number
  private readonly jitterMs: number
  private readonly sleep: (delayMs: number) => Promise<void>
  private readonly random: () => number

  private rateLimitRemaining: number | null = null
  private nextAllowedRequestAt = 0

  constructor(options: MangaDexClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_MANGADEX_BASE_URL).replace(/\/+$/, '')
    this.uploadsBaseUrl = (options.uploadsBaseUrl ?? DEFAULT_MANGADEX_UPLOADS_BASE_URL).replace(
      /\/+$/,
      '',
    )
    this.userAgent = options.userAgent ?? DEFAULT_MANGADEX_USER_AGENT
    this.fetchFn = options.fetch ?? fetch
    this.maxRetries = options.maxRetries ?? 3
    this.baseBackoffMs = options.baseBackoffMs ?? 500
    this.jitterMs = options.jitterMs ?? 250
    this.sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)))
    this.random = options.random ?? Math.random
  }

  async searchManga(
    query: string,
    options: MangaSearchOptions = {},
  ): Promise<MangaDexSearchResponse<MangaDexManga>> {
    const params = new URLSearchParams({ title: query })

    if (typeof options.limit === 'number') {
      params.set('limit', String(options.limit))
    }
    if (typeof options.offset === 'number') {
      params.set('offset', String(options.offset))
    }

    const ratings = options.contentRating ?? [...DEFAULT_CONTENT_RATING]
    for (const rating of ratings) {
      params.append('contentRating[]', rating)
    }

    const includes = options.includes ?? ['cover_art']
    for (const include of includes) {
      params.append('includes[]', include)
    }

    return this.request<MangaDexSearchResponse<MangaDexManga>>('/manga', params)
  }

  async getManga(mangaId: string): Promise<MangaDexEntityResponse<MangaDexManga>> {
    return this.request<MangaDexEntityResponse<MangaDexManga>>(
      `/manga/${encodeURIComponent(mangaId)}`,
    )
  }

  async getMangaChapters(
    mangaId: string,
    options: MangaChapterOptions = {},
  ): Promise<MangaDexSearchResponse<MangaDexChapter>> {
    const params = new URLSearchParams()

    if (typeof options.limit === 'number') {
      params.set('limit', String(options.limit))
    }
    if (typeof options.offset === 'number') {
      params.set('offset', String(options.offset))
    }
    if (options.language) {
      const langs = Array.isArray(options.language)
        ? options.language
        : [options.language]
      for (const lang of langs) {
        params.append('translatedLanguage[]', lang)
      }
    }

    return this.request<MangaDexSearchResponse<MangaDexChapter>>(
      `/manga/${encodeURIComponent(mangaId)}/feed`,
      params,
    )
  }

  // Paginated fetch of every chapter across all configured languages.
  // Fixes the latent bug where the default MangaDex feed limit (10) silently
  // dropped everything past chapter 10. Page size intentionally below the 500
  // server cap for gentler rate-limit behaviour.
  async getAllMangaChapters(
    mangaId: string,
    options: Omit<MangaChapterOptions, 'offset' | 'limit'> = {},
  ): Promise<{ data: MangaDexChapter[]; total: number }> {
    const PAGE_SIZE = 100
    const collected: MangaDexChapter[] = []
    let offset = 0
    let total = Number.POSITIVE_INFINITY

    while (offset < total) {
      const page = await this.getMangaChapters(mangaId, {
        ...options,
        limit: PAGE_SIZE,
        offset,
      })
      collected.push(...page.data)
      total = page.total
      offset += page.data.length
      if (page.data.length === 0) break
    }

    return { data: collected, total }
  }

  async getChapterPages(chapterId: string): Promise<MangaDexPage[]> {
    const response = await this.request<MangaDexAtHomeResponse>(
      `/at-home/server/${encodeURIComponent(chapterId)}`,
    )

    const dataHash = response.chapter.dataHash ?? response.chapter.hash
    if (!dataHash) {
      throw new MangaDexClientError(
        `Invalid at-home response for chapter ${chapterId}: missing data hash`,
        500,
      )
    }

    return response.chapter.data.map((fileName) => ({
      fileName,
      url: `${response.baseUrl}/data/${dataHash}/${fileName}`,
      dataSaverUrl: `${response.baseUrl}/data-saver/${dataHash}/${fileName}`,
    }))
  }

  async getCoverArt(mangaId: string): Promise<MangaDexCoverArtWithUrl | null> {
    const params = new URLSearchParams()
    params.append('manga[]', mangaId)
    params.set('limit', '1')

    const response = await this.request<MangaDexSearchResponse<MangaDexCoverArt>>('/cover', params)
    const coverArt = response.data[0]

    if (!coverArt) {
      return null
    }

    return {
      ...coverArt,
      url: buildMangaDexCoverUrl(mangaId, coverArt.attributes.fileName, {
        uploadsBaseUrl: this.uploadsBaseUrl,
      }),
    }
  }

  async getAuthor(authorId: string): Promise<MangaDexEntityResponse<MangaDexAuthor>> {
    return this.request<MangaDexEntityResponse<MangaDexAuthor>>(
      `/author/${encodeURIComponent(authorId)}`,
    )
  }

  private async request<T>(path: string, params?: URLSearchParams): Promise<T> {
    let attempt = 0

    while (true) {
      await this.waitForRateLimitWindow()

      const response = await this.fetchFn(this.buildUrl(path, params), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': this.userAgent,
        },
      })

      this.captureRateLimitHeaders(response.headers)

      const isRetryableStatus = response.status === 429
        || (response.status >= 500 && response.status < 600)

      if (isRetryableStatus) {
        if (attempt >= this.maxRetries) {
          const label = response.status === 429
            ? `rate limit persisted after ${this.maxRetries} retries (429 Too Many Requests)`
            : `server error ${response.status} persisted after ${this.maxRetries} retries`
          throw new MangaDexClientError(
            `MangaDex ${label}`,
            response.status,
            (await this.readErrorBody(response)) ?? undefined,
          )
        }

        const delay = this.computeBackoffDelay(response.headers, attempt)
        await this.sleep(delay)
        attempt += 1
        continue
      }

      if (!response.ok) {
        const errorBody = await this.readErrorBody(response)
        const errorMessage = errorBody?.errors?.[0]?.title ?? response.statusText

        throw new MangaDexClientError(
          `MangaDex request failed (${response.status}): ${errorMessage}`,
          response.status,
          errorBody ?? undefined,
        )
      }

      return (await response.json()) as T
    }
  }

  private buildUrl(path: string, params?: URLSearchParams): string {
    const base = `${this.baseUrl}${path}`
    if (!params) {
      return base
    }

    const query = params.toString()
    return query.length > 0 ? `${base}?${query}` : base
  }

  private captureRateLimitHeaders(headers: Headers): void {
    const remainingHeader = headers.get('X-RateLimit-Remaining')
    const retryAfterHeader = headers.get('X-RateLimit-Retry-After')

    if (remainingHeader) {
      const remaining = Number.parseInt(remainingHeader, 10)
      if (Number.isFinite(remaining)) {
        this.rateLimitRemaining = remaining
      }
    }

    if (retryAfterHeader) {
      const retryAfterMs = this.parseRetryAfterMs(retryAfterHeader)
      if (typeof retryAfterMs === 'number') {
        this.nextAllowedRequestAt = Math.max(this.nextAllowedRequestAt, Date.now() + retryAfterMs)
      }
    }

    if (this.rateLimitRemaining === 0 && this.nextAllowedRequestAt <= Date.now()) {
      this.nextAllowedRequestAt = Date.now() + 1000
    }
  }

  private async waitForRateLimitWindow(): Promise<void> {
    const now = Date.now()
    if (now >= this.nextAllowedRequestAt) {
      return
    }

    await this.sleep(this.nextAllowedRequestAt - now)
  }

  private computeBackoffDelay(headers: Headers, attempt: number): number {
    const retryAfter = headers.get('X-RateLimit-Retry-After')
    const retryAfterMs = retryAfter ? this.parseRetryAfterMs(retryAfter) : null
    const exponential = this.baseBackoffMs * 2 ** attempt
    const jitter = Math.floor(this.random() * this.jitterMs)

    return Math.max(retryAfterMs ?? 0, exponential) + jitter
  }

  private parseRetryAfterMs(value: string): number | null {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) {
      return null
    }

    if (parsed > 1_000_000_000_000) {
      return Math.max(0, parsed - Date.now())
    }
    if (parsed > 1_000_000_000) {
      return Math.max(0, parsed * 1000 - Date.now())
    }

    return Math.max(0, parsed * 1000)
  }

  private async readErrorBody(response: Response): Promise<MangaDexError | null> {
    try {
      const body = (await response.json()) as Partial<MangaDexError>
      if (body.result === 'error' && Array.isArray(body.errors)) {
        return body as MangaDexError
      }
    } catch {
      return null
    }

    return null
  }
}
