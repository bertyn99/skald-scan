import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChapterStatus, MangaDexClient } from '@skald-scan/shared'

import { handleDownloadPages } from '../services/download-pages'
import { handleExtractZip } from '../services/extract-zip'
import { handleSyncChapters } from '../services/sync-chapters'

import { createMockD1, createMockQueue, createMockR2 } from './fixtures'

// ─── fflate mock (hoisted before service import) ────────
const mockUnzipSync = vi.hoisted(() => vi.fn())
vi.mock('fflate', () => ({
  unzipSync: mockUnzipSync
}))

// ─── helpers ─────────────────────────────────────────────

function createMockR2Object(bytes: number[]): {
  body: ReadableStream<Uint8Array>
  httpEtag: string
  httpMetadata: { contentType?: string }
  arrayBuffer: () => Promise<ArrayBuffer>
  text: () => Promise<string>
} {
  const data = new Uint8Array(bytes)
  const buffer: ArrayBuffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(data)
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data)
        controller.close()
      }
    }),
    httpEtag: 'etag-test',
    httpMetadata: {},
    arrayBuffer: () => Promise.resolve(buffer),
    text: () => Promise.resolve('')
  }
}

function createMockMangaDexClient(
  overrides: Partial<Pick<MangaDexClient, keyof MangaDexClient>>
): MangaDexClient {
  return Object.assign(new MangaDexClient({ fetch: vi.fn() }), overrides)
}

// ─── extract-zip service ─────────────────────────────────

describe('handleExtractZip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUnzipSync.mockReset()
    mockUnzipSync.mockReturnValue({})
  })

  it('skips already-processed job', async () => {
    const db = createMockD1([
      // atomic claim returns null → already claimed
      { firstResult: null }
    ])
    const storage = createMockR2()

    await handleExtractZip(
      { type: 'extract-zip', jobId: 'job-done', mangaId: 'm-1', chapterId: 'c-1', tempR2Key: 'temp/job-done.zip' },
      { DB: db, STORAGE: storage }
    )

    expect(storage.get).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('extracts images from ZIP and stores to R2', async () => {
    mockUnzipSync.mockReturnValue({
      'page_001.webp': new Uint8Array([1, 2, 3]),
      'page_002.webp': new Uint8Array([4, 5, 6]),
      'page_003.webp': new Uint8Array([7, 8, 9])
    })

    const db = createMockD1([
      { firstResult: { job_id: 'job-1' } }, // atomic claim succeeds
      { allResult: { results: [] } } // completeQueueJob update (no-op mock)
    ])
    const storage = createMockR2({
      'temp/job-1.zip': createMockR2Object([0, 1, 2])
    })

    await handleExtractZip(
      { type: 'extract-zip', jobId: 'job-1', mangaId: 'm-1', chapterId: 'c-1', tempR2Key: 'temp/job-1.zip' },
      { DB: db, STORAGE: storage }
    )

    expect(storage.put).toHaveBeenCalledTimes(3)
    expect(storage.put).toHaveBeenCalledWith(
      'manga/m-1/chapters/c-1/pages/1.webp',
      expect.any(Uint8Array),
      expect.objectContaining({ httpMetadata: { contentType: 'image/webp' } })
    )
    expect(storage.put).toHaveBeenCalledWith(
      'manga/m-1/chapters/c-1/pages/2.webp',
      expect.any(Uint8Array),
      expect.objectContaining({ httpMetadata: { contentType: 'image/webp' } })
    )
    expect(storage.put).toHaveBeenCalledWith(
      'manga/m-1/chapters/c-1/pages/3.webp',
      expect.any(Uint8Array),
      expect.objectContaining({ httpMetadata: { contentType: 'image/webp' } })
    )
    expect(storage.delete).toHaveBeenCalledWith('temp/job-1.zip')
  })

  it('marks job failed and rethrows on R2 error', async () => {
    const capturedBinds: unknown[][] = []
    const db = createMockD1([
      { firstResult: { job_id: 'job-fail' } }, // atomic claim succeeds
      { onBind: (args) => capturedBinds.push(args) } // failQueueJob update
    ])
    const storage = createMockR2()

    await expect(
      handleExtractZip(
        { type: 'extract-zip', jobId: 'job-fail', mangaId: 'm-1', chapterId: 'c-1', tempR2Key: 'temp/missing.zip' },
        { DB: db, STORAGE: storage }
      )
    ).rejects.toThrow('ZIP not found in R2')

    expect(capturedBinds.length).toBe(1)
    expect(capturedBinds[0]).toContain('failed')
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('deletes temp ZIP after extraction', async () => {
    mockUnzipSync.mockReturnValue({
      '001.png': new Uint8Array([1])
    })

    const db = createMockD1([
      { firstResult: { job_id: 'job-del' } },
      { allResult: { results: [] } } // completeQueueJob
    ])
    const storage = createMockR2({
      'temp/job-del.zip': createMockR2Object([0])
    })

    await handleExtractZip(
      { type: 'extract-zip', jobId: 'job-del', mangaId: 'm-2', chapterId: 'c-2', tempR2Key: 'temp/job-del.zip' },
      { DB: db, STORAGE: storage }
    )

    expect(storage.delete).toHaveBeenCalledWith('temp/job-del.zip')
  })

  it('handles empty ZIP gracefully', async () => {
    mockUnzipSync.mockReturnValue({
      'readme.txt': new Uint8Array([1, 2, 3]),
      '.DS_Store': new Uint8Array([0]),
      '__MACOSX/page': new Uint8Array([0])
    })

    const db = createMockD1([
      { firstResult: { job_id: 'job-empty' } }, // claim
      { onBind: () => {} } // failQueueJob
    ])
    const storage = createMockR2({
      'temp/empty.zip': createMockR2Object([0])
    })

    await expect(
      handleExtractZip(
        { type: 'extract-zip', jobId: 'job-empty', mangaId: 'm-3', chapterId: 'c-3', tempR2Key: 'temp/empty.zip' },
        { DB: db, STORAGE: storage }
      )
    ).rejects.toThrow('No image files found')

    expect(storage.put).not.toHaveBeenCalled()
  })

  it('assigns sequential page numbers in sorted order', async () => {
    mockUnzipSync.mockReturnValue({
      'page_c.webp': new Uint8Array([3]),
      'page_a.webp': new Uint8Array([1]),
      'page_b.webp': new Uint8Array([2])
    })

    const db = createMockD1([
      { firstResult: { job_id: 'job-sort' } },
      { allResult: { results: [] } } // completeQueueJob
    ])
    const storage = createMockR2({
      'temp/sort.zip': createMockR2Object([0])
    })

    await handleExtractZip(
      { type: 'extract-zip', jobId: 'job-sort', mangaId: 'm-4', chapterId: 'c-4', tempR2Key: 'temp/sort.zip' },
      { DB: db, STORAGE: storage }
    )

    const putCalls = vi.mocked(storage.put).mock.calls
    expect(putCalls).toHaveLength(3)
    expect(putCalls[0][0]).toBe('manga/m-4/chapters/c-4/pages/1.webp')
    expect(putCalls[1][0]).toBe('manga/m-4/chapters/c-4/pages/2.webp')
    expect(putCalls[2][0]).toBe('manga/m-4/chapters/c-4/pages/3.webp')
  })
})

// ─── download-pages service ──────────────────────────────

describe('handleDownloadPages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads pages to R2 and marks chapter available', async () => {
    const imageBytes = new Uint8Array([1, 2, 3])
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(imageBytes.buffer),
      headers: { get: () => 'image/webp' }
    }) as typeof fetch

    const db = createMockD1([
      { firstResult: { job_id: 'job-dl-ok' } }, // atomic claim
      {}, // chapters status update (Processing)
      {}, // chapters status update (Available)
      { allResult: { results: [] } } // completeQueueJob
    ])
    const storage = createMockR2()

    const mockClient = createMockMangaDexClient({
      getChapterPages: vi.fn().mockResolvedValue([
        { url: 'https://cdn.example/page1.webp' },
        { url: 'https://cdn.example/page2.webp' }
      ])
    })

    await handleDownloadPages(
      {
        type: 'download-pages',
        jobId: 'job-dl-ok',
        mangaId: 'm-1',
        chapterId: 'c-1',
        mangaDexChapterId: 'md-c-1'
      },
      { DB: db, STORAGE: storage },
      mockClient
    )

    expect(storage.put).toHaveBeenCalledTimes(2)
    expect(storage.put).toHaveBeenCalledWith(
      'manga/m-1/chapters/c-1/pages/1.webp',
      expect.any(ArrayBuffer),
      expect.objectContaining({ httpMetadata: expect.objectContaining({ contentType: 'image/webp' }) })
    )
  })

  it('marks job failed and rethrows on MangaDex API error', async () => {
    const capturedBinds: unknown[][] = []
    const db = createMockD1([
      { firstResult: { job_id: 'job-dl-fail' } }, // atomic claim
      {}, // chapters status update (Processing)
      { onBind: (args) => capturedBinds.push(args) } // failQueueJob
    ])

    const mockClient = createMockMangaDexClient({
      getChapterPages: vi.fn().mockRejectedValue(new Error('MangaDex API error'))
    })

    await expect(
      handleDownloadPages(
        {
          type: 'download-pages',
          jobId: 'job-dl-fail',
          mangaId: 'm-1',
          chapterId: 'c-1',
          mangaDexChapterId: 'md-c-1'
        },
        { DB: db, STORAGE: createMockR2() },
        mockClient
      )
    ).rejects.toThrow('MangaDex API error')

    expect(mockClient.getChapterPages).toHaveBeenCalledWith('md-c-1')
    expect(capturedBinds.length).toBeGreaterThanOrEqual(1)
    expect(capturedBinds.some(args => args.includes('failed') || args.includes('unavailable'))).toBe(true)
  })
})

// ─── sync-chapters service ───────────────────────────────

describe('handleSyncChapters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks removed chapters as unavailable', async () => {
    // Capture EVERY bind across all prepared statements, regardless of order.
    const allBinds: unknown[][] = []
    // Drizzle's typed select with fields uses stmt.bind(...).raw() and reads
    // rows as array-of-arrays (column order matches the select clause).
    // select count(*) uses stmt.bind(...).all() reading .results.
    const existingChaptersRaw: unknown[][] = [
      ['chap-1', 'ch1'],
      ['chap-2', 'ch2'],
      ['chap-3', 'ch3']
    ]
    const db = createMockD1([])
    let claimConsumed = false

    function rawForSql(sqlText: string): unknown[][] {
      const lower = sqlText.toLowerCase()
      if (lower.includes('from "chapters"')) return existingChaptersRaw
      return []
    }
    function allForSql(sqlText: string): { results: unknown[] } | null {
      const lower = sqlText.toLowerCase()
      if (lower.includes('count(*)') && lower.includes('manga_translations')) {
        return { results: [{ c: 4 }] } // >= configuredLanguages.length, no refresh
      }
      if (lower.includes('from "pages"')) return { results: [] }
      return null
    }

    vi.mocked(db.prepare).mockImplementation((sqlText?: string) => {
      const sql = String(sqlText ?? '')
      return {
        bind: (...args: unknown[]) => {
          allBinds.push(args)
          const isClaim = sql.includes('INSERT INTO processed_jobs')
          const claimResult = isClaim && !claimConsumed ? { job_id: args[0] } : null
          if (isClaim && claimResult) claimConsumed = true
          const allMatched = allForSql(sql)
          const rawMatched = rawForSql(sql)
          return {
            all: vi.fn().mockResolvedValue(allMatched ?? { results: [] }),
            first: vi.fn().mockResolvedValue(claimResult),
            run: vi.fn().mockResolvedValue({ success: true }),
            raw: vi.fn().mockResolvedValue(rawMatched)
          }
        },
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        raw: vi.fn().mockResolvedValue(rawForSql(sql))
      } as ReturnType<D1Database['prepare']>
    })

    const mockClient = createMockMangaDexClient({
      getAllMangaChapters: vi.fn().mockResolvedValue({
        total: 2,
        data: [
          {
            id: 'ch1',
            type: 'chapter',
            attributes: { chapter: '1', title: 'Ch 1', translatedLanguage: 'en', pages: 10 },
            relationships: []
          },
          {
            id: 'ch3',
            type: 'chapter',
            attributes: { chapter: '3', title: 'Ch 3', translatedLanguage: 'en', pages: 8 },
            relationships: []
          }
        ]
      })
    })

    const queue = createMockQueue()

    await handleSyncChapters(
      { type: 'sync-chapters', jobId: 'job-sync', mangaId: 'm-1', mangaDexId: 'md-1' },
      { DB: db, STORAGE: createMockR2(), SYNC_QUEUE: { send: queue.send } },
      mockClient
    )

    expect(mockClient.getAllMangaChapters).toHaveBeenCalledWith(
      'md-1',
      expect.objectContaining({ language: expect.any(Array) })
    )

    const removedUpdate = allBinds.find(args => args.includes(ChapterStatus.Unavailable))
    expect(removedUpdate).toBeDefined()
    expect(removedUpdate).toContain('chap-2')
    expect(removedUpdate).not.toContain('chap-1')
    expect(removedUpdate).not.toContain('chap-3')
  })
})
