import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_MANGADEX_USER_AGENT,
  MangaDexClient,
  buildMangaDexCoverUrl,
} from '../mangadex'

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

const okCollection = {
  result: 'ok' as const,
  response: 'collection' as const,
  data: [],
  limit: 10,
  offset: 0,
  total: 0,
}

describe('MangaDexClient', () => {
  it('searches manga with expected query params and default content ratings', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ...okCollection, limit: 10, offset: 5 }))

    const client = new MangaDexClient({ fetch: fetchMock })
    await client.searchManga('one piece', { limit: 10, offset: 5 })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    const parsed = new URL(String(url))

    expect(parsed.origin + parsed.pathname).toBe('https://api.mangadex.org/manga')
    expect(parsed.searchParams.get('title')).toBe('one piece')
    expect(parsed.searchParams.get('limit')).toBe('10')
    expect(parsed.searchParams.get('offset')).toBe('5')
    expect(parsed.searchParams.getAll('contentRating[]').sort()).toEqual(
      ['safe', 'suggestive', 'pornographic'].sort(),
    )
    expect(parsed.searchParams.getAll('contentRating[]')).not.toContain('erotica')
    expect(parsed.searchParams.getAll('includes[]')).toEqual(['cover_art'])

    const headers = new Headers(init?.headers)
    expect(headers.get('User-Agent')).toBe(DEFAULT_MANGADEX_USER_AGENT)
  })

  it('uses client configuration for base URL and user agent', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        result: 'ok',
        response: 'entity',
        data: {
          id: 'manga-1',
          type: 'manga',
          attributes: {
            title: { en: 'Configured Manga' },
          },
        },
      }),
    )

    const client = new MangaDexClient({
      baseUrl: 'https://example.org/api/',
      userAgent: 'CustomAgent/2.0',
      fetch: fetchMock,
    })

    await client.getManga('manga-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://example.org/api/manga/manga-1')

    const headers = new Headers(init?.headers)
    expect(headers.get('User-Agent')).toBe('CustomAgent/2.0')
  })

  it('builds thumbnail cover URLs with size suffix', () => {
    expect(buildMangaDexCoverUrl('manga-123', 'cover.jpg', { size: 256 })).toBe(
      'https://uploads.mangadex.org/covers/manga-123/cover.jpg.256.jpg',
    )
  })

  it('constructs cover art URL from cover endpoint response', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        ...okCollection,
        data: [
          {
            id: 'cover-1',
            type: 'cover_art',
            attributes: {
              fileName: 'my cover.jpg',
            },
          },
        ],
      }),
    )

    const client = new MangaDexClient({ fetch: fetchMock })
    const cover = await client.getCoverArt('manga-123')

    expect(cover).not.toBeNull()
    expect(cover?.url).toBe('https://uploads.mangadex.org/covers/manga-123/my%20cover.jpg')
  })

  it('retries 429 responses with backoff and succeeds', async () => {
    const sleepMock = vi.fn<(delayMs: number) => Promise<void>>(async (_delayMs) => {})
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            result: 'error',
            errors: [{ title: 'Too Many Requests' }],
          },
          429,
          { 'X-RateLimit-Retry-After': '1' },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            result: 'error',
            errors: [{ title: 'Too Many Requests Again' }],
          },
          429,
          { 'X-RateLimit-Retry-After': '1' },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ...okCollection, data: [] }))

    const client = new MangaDexClient({
      fetch: fetchMock,
      sleep: sleepMock,
      random: () => 0,
      baseBackoffMs: 10,
      jitterMs: 1,
      maxRetries: 3,
    })

    await client.searchManga('retry target')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(sleepMock).toHaveBeenCalled()
    expect(sleepMock.mock.calls.some(([delay]) => delay >= 1000)).toBe(true)
  })

  it('throws descriptive error after persistent 429 responses', async () => {
    const sleepMock = vi.fn<(delayMs: number) => Promise<void>>(async (_delayMs) => {})
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          result: 'error',
          errors: [{ title: 'Too Many Requests' }],
        },
        429,
        { 'X-RateLimit-Retry-After': '1' },
      ),
    )

    const client = new MangaDexClient({
      fetch: fetchMock,
      sleep: sleepMock,
      random: () => 0,
      maxRetries: 3,
      baseBackoffMs: 10,
      jitterMs: 1,
    })

    await expect(client.searchManga('always-rate-limited')).rejects.toEqual(
      expect.objectContaining({
        name: 'MangaDexClientError',
        status: 429,
        message: expect.stringContaining('persisted after 3 retries'),
      }),
    )

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(sleepMock).toHaveBeenCalled()
    expect(sleepMock.mock.calls.some(([delay]) => delay >= 1000)).toBe(true)
  })

  it('throws MangaDexClientError for non-200 responses', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          result: 'error',
          errors: [{ title: 'Internal Server Error' }],
        },
        500,
      ),
    )

    const client = new MangaDexClient({ fetch: fetchMock })

    await expect(client.getManga('broken-id')).rejects.toEqual(
      expect.objectContaining({
        name: 'MangaDexClientError',
        status: 500,
        message: expect.stringContaining('Internal Server Error'),
      }),
    )
  })

  it('observes rate limit headers and waits before the next request', async () => {
    const sleepMock = vi.fn<(delayMs: number) => Promise<void>>(async (_delayMs) => {})
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ ...okCollection }, 200, {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Retry-After': '1',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          result: 'ok',
          response: 'entity',
          data: {
            id: 'manga-2',
            type: 'manga',
            attributes: {
              title: { en: 'Waited Manga' },
            },
          },
        }),
      )

    const client = new MangaDexClient({ fetch: fetchMock, sleep: sleepMock })

    await client.searchManga('first-call')
    await client.getManga('manga-2')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleepMock).toHaveBeenCalledTimes(1)
    const firstSleepCall = sleepMock.mock.calls.at(0)
    expect(firstSleepCall).toBeDefined()
    expect(firstSleepCall?.[0]).toBeGreaterThan(0)
  })
})
