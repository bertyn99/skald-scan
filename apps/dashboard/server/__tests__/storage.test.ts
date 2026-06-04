import { beforeEach, describe, expect, it, vi } from 'vitest'


import chapterIndexGetHandler from '../api/manga/[mangaId]/chapters/index.get'
import chapterIndexPostHandler from '../api/manga/[mangaId]/chapters/index.post'
import pageGetHandler from '../api/manga/[mangaId]/chapters/[chapterId]/pages/[pageId].get'
import mangaGetHandler from '../api/manga/[mangaId].get'
import mangaPutHandler from '../api/manga/[mangaId].put'
import mangaIndexGetHandler from '../api/manga/index.get'
import mangaIndexPostHandler from '../api/manga/index.post'
import uploadUrlHandler from '../api/storage/upload-url.post'
import uploadZipHandler from '../api/storage/upload-zip.post'
import {
  buildCoverR2Key,
  buildPageR2Key,
  buildTempZipR2Key,
  generateR2UploadPresignedUrl,
  isZipLikeFileName,
  resolvePageR2KeyFromFileName,
  type StorageBucketBinding
} from '../utils/storage'

describe('storage + manga APIs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.restoreAllMocks()
  })

  it('builds R2 path conventions and file name parsing', () => {
    expect(buildPageR2Key('m-1', 'c-1', 3)).toBe('manga/m-1/chapters/c-1/pages/3.webp')
    expect(buildCoverR2Key('m-1')).toBe('manga/m-1/cover.webp')
    expect(buildTempZipR2Key('job-1')).toBe('temp/job-1.zip')
    expect(resolvePageR2KeyFromFileName('m-1', 'c-1', '0007.webp')).toBe(
      'manga/m-1/chapters/c-1/pages/7.webp'
    )
    expect(isZipLikeFileName('chapter.zip')).toBe(true)
    expect(isZipLikeFileName('chapter.cbz')).toBe(true)
    expect(isZipLikeFileName('chapter.webp')).toBe(false)
  })

  it('generates a presigned upload URL from bucket helper', async () => {
    const bucket: StorageBucketBinding = {
      put: vi.fn(),
      get: vi.fn(),
      createPresignedUrl: vi.fn().mockResolvedValue('https://example.test/signed-upload')
    }

    await expect(generateR2UploadPresignedUrl(bucket, 'manga/m-1/chapters/c-1/pages/1.webp')).resolves.toBe(
      'https://example.test/signed-upload'
    )

    expect(bucket.createPresignedUrl).toHaveBeenCalledWith('manga/m-1/chapters/c-1/pages/1.webp', {
      method: 'PUT',
      expiresIn: 3600
    })
  })

  it('creates storage upload-url response', async () => {
    const storage = createStorageBinding({
      createPresignedUrl: vi.fn().mockResolvedValue('https://example.test/upload')
    })

    const event = createEvent<Parameters<typeof uploadUrlHandler>[0]>({
      auth: true,
      env: { STORAGE: storage },
      body: {
        mangaId: 'manga-1',
        chapterId: 'chapter-2',
        fileName: '0010.webp'
      }
    })

    await expect(uploadUrlHandler(event)).resolves.toEqual({
      uploadUrl: 'https://example.test/upload',
      key: 'manga/manga-1/chapters/chapter-2/pages/10.webp'
    })
  })

  it('stores zip file and enqueues async extraction job', async () => {
    const uuid: `${string}-${string}-${string}-${string}-${string}` =
      '00000000-0000-4000-8000-000000000045'
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid)

    const storage = createStorageBinding()
    const queueSend = vi.fn().mockResolvedValue(undefined)

    const event = createEvent<Parameters<typeof uploadZipHandler>[0]>({
      auth: true,
      env: {
        STORAGE: storage,
        SYNC_QUEUE: { send: queueSend }
      },
      body: {
        mangaId: 'manga-1',
        chapterId: 'chapter-1',
        fileName: 'chapter.cbz',
        content: Buffer.from('zip-content').toString('base64')
      }
    })

    await expect(uploadZipHandler(event)).resolves.toEqual({
      queued: true,
      jobId: uuid,
      tempR2Key: `temp/${uuid}.zip`
    })

    expect(storage.put).toHaveBeenCalledTimes(1)
    expect(queueSend).toHaveBeenCalledWith({
      type: 'extract-zip',
      jobId: uuid,
      mangaId: 'manga-1',
      chapterId: 'chapter-1',
      tempR2Key: `temp/${uuid}.zip`
    })
  })

  it('lists manga with pagination', async () => {
    const db = createDatabaseBinding([
      {
        allResult: {
          results: [{ id: 'm1', title: 'Manga One' }]
        },
        onBind: (args) => expect(args).toEqual([10, 5])
      },
      {
        firstResult: { count: 1 }
      }
    ])

    const event = createEvent<Parameters<typeof mangaIndexGetHandler>[0]>({
      env: { DB: db },
      query: { limit: '10', offset: '5' }
    })

    await expect(mangaIndexGetHandler(event)).resolves.toMatchObject({
      items: [{ id: 'm1', title: 'Manga One' }],
      pagination: { limit: 10, offset: 5, total: 1 }
    })
  })

  it('creates manga via post route (auth required)', async () => {
    const uuid: `${string}-${string}-${string}-${string}-${string}` =
      '00000000-0000-4000-8000-000000000046'
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid)

    const db = createDatabaseBinding([{ runResult: { success: true } }])
    const event = createEvent<Parameters<typeof mangaIndexPostHandler>[0]>({
      auth: true,
      env: { DB: db },
      body: { title: 'New Manga' }
    })

    const result = await mangaIndexPostHandler(event)
    const item = (result as { item: { id: string; title: string } }).item

    expect(item.id).toBe(uuid)
    expect(item.title).toBe('New Manga')
  })

  it('gets manga detail with chapters', async () => {
    const db = createDatabaseBinding([
      {
        firstResult: { id: 'm1', title: 'Manga One' },
        onBind: (args) => expect(args).toEqual(['m1'])
      },
      {
        allResult: { results: [{ id: 'c1', mangaId: 'm1' }] },
        onBind: (args) => expect(args).toEqual(['m1'])
      }
    ])

    const event = createEvent<Parameters<typeof mangaGetHandler>[0]>({
      env: { DB: db },
      params: { mangaId: 'm1' }
    })

    await expect(mangaGetHandler(event)).resolves.toMatchObject({
      item: { id: 'm1', title: 'Manga One' },
      chapters: [{ id: 'c1', mangaId: 'm1' }]
    })
  })

  it('updates manga via put route (auth required)', async () => {
    const db = createDatabaseBinding([
      {
        runResult: { success: true },
        onBind: (args) => {
          expect(args.at(-1)).toBe('m1')
        }
      },
      {
        firstResult: { id: 'm1', title: 'Updated Title' }
      }
    ])

    const event = createEvent<Parameters<typeof mangaPutHandler>[0]>({
      auth: true,
      env: { DB: db },
      params: { mangaId: 'm1' },
      body: { title: 'Updated Title' }
    })

    await expect(mangaPutHandler(event)).resolves.toMatchObject({
      item: { id: 'm1', title: 'Updated Title' }
    })
  })

  it('lists chapters for manga', async () => {
    const db = createDatabaseBinding([
      {
        allResult: { results: [{ id: 'c1', mangaId: 'm1', title: null, chapterNumber: 1 }] },
        onBind: (args) => expect(args).toEqual(['m1'])
      }
    ])

    const event = createEvent<Parameters<typeof chapterIndexGetHandler>[0]>({
      env: { DB: db },
      params: { mangaId: 'm1' }
    })

    await expect(chapterIndexGetHandler(event)).resolves.toMatchObject({
      items: [{ id: 'c1', mangaId: 'm1', chapterNumber: 1 }]
    })
  })

  it('creates chapter for manga (auth required)', async () => {
    const uuid: `${string}-${string}-${string}-${string}-${string}` =
      '00000000-0000-4000-8000-000000000047'
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid)

    const db = createDatabaseBinding([{ runResult: { success: true } }])
    const event = createEvent<Parameters<typeof chapterIndexPostHandler>[0]>({
      auth: true,
      env: { DB: db },
      params: { mangaId: 'm1' },
      body: { chapterNumber: 2, title: 'Chapter 2' }
    })

    const result = await chapterIndexPostHandler(event)
    const item = (result as { item: { id: string; chapterNumber: number } }).item

    expect(item.id).toBe(uuid)
    expect(item.chapterNumber).toBe(2)
  })

  it('serves page image with immutable cache header', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      }
    })

    const db = createDatabaseBinding([
      {
        firstResult: { r2Key: 'manga/m1/chapters/c1/pages/1.webp' }
      }
    ])

    const storage = createStorageBinding({
      get: vi.fn().mockResolvedValue({
        body: stream,
        httpEtag: 'etag-1',
        httpMetadata: { contentType: 'image/webp' }
      })
    })

    const event = createEvent<Parameters<typeof pageGetHandler>[0]>({
      env: {
        DB: db,
        STORAGE: storage
      },
      params: {
        mangaId: 'm1',
        chapterId: 'c1',
        pageId: '1'
      }
    })

    const response = await pageGetHandler(event)
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect((response as Response).headers.get('Content-Type')).toBe('image/webp')
    expect((response as Response).headers.get('ETag')).toBe('etag-1')
  })
})

type MockPrepared = {
  onBind?: (args: unknown[]) => void
  allResult?: unknown
  firstResult?: unknown
  runResult?: unknown
}

type EventFixture = {
  auth?: boolean
  env?: Record<string, unknown>
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, unknown>
}

const createDatabaseBinding = (statements: MockPrepared[]) => {
  return {
    prepare: vi.fn().mockImplementation(() => {
      const statement = statements.shift()

      if (!statement) {
        throw new Error('Unexpected prepare call')
      }

      return {
        bind: (...args: unknown[]) => {
          statement.onBind?.(args)

          return {
            all: vi.fn().mockResolvedValue(statement.allResult ?? { results: [] }),
            first: vi.fn().mockResolvedValue(statement.firstResult ?? null),
            run: vi.fn().mockResolvedValue(statement.runResult ?? { success: true }),
            raw: vi.fn().mockResolvedValue(statement.allResult ? (statement.allResult as any).results.map(Object.values) : (statement.firstResult ? [Object.values(statement.firstResult)] : []))
          }
        }
      }
    })
  }
}

const createStorageBinding = (
  overrides: Partial<StorageBucketBinding> = {}
): StorageBucketBinding => ({
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  ...overrides
})

const createEvent = <T>(fixture: EventFixture): T => {
  const eventObject = {
    context: {
      cloudflare: {
        env: {
          DB: createDatabaseBinding([]),
          STORAGE: createStorageBinding(),
          SYNC_QUEUE: {
            send: vi.fn().mockResolvedValue(undefined)
          },
          ...fixture.env
        }
      },
      authSession: fixture.auth ? { session: { id: 'session-1' } } : null,
      body: fixture.body,
      params: fixture.params,
      query: fixture.query
    }
  }

  return eventObject as T
}
