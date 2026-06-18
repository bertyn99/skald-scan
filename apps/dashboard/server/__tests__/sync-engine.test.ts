import { beforeEach, describe, expect, it, vi } from 'vitest'

import importPostHandler from '../api/mangadex/import.post'
import importStatusGetHandler from '../api/mangadex/import/status/[jobId].get'

const { mockGet, mockReadBody } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockReadBody: vi.fn((event: { context?: { body?: unknown } }) => Promise.resolve(event.context?.body)),
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    readBody: mockReadBody,
  }
})

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: mockGet,
  }),
}))

type EventFixture = {
  auth?: boolean
  env?: Record<string, unknown>
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, unknown>
}

const createEvent = <T>(fixture: EventFixture): T => {
  const eventObject = {
    context: {
      cloudflare: {
        env: {
          DB: {},
          MANGADEX_SYNC_QUEUE: {
            send: vi.fn().mockResolvedValue(undefined),
          },
          SYNC_QUEUE: {
            send: vi.fn().mockResolvedValue(undefined),
          },
          ...fixture.env,
        },
      },
      authSession: fixture.auth ? { session: { id: 'session-1' }, user: { id: 'user-1', role: 'admin' } } : null,
      body: fixture.body,
      params: fixture.params,
      query: fixture.query,
    },
  }

  return eventObject as T
}

describe('MangaDex sync API routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockGet.mockReset()
  })

  describe('POST /api/mangadex/import', () => {
    it('queues an import job and returns jobId', async () => {
      const uuid: `${string}-${string}-${string}-${string}-${string}` =
        '00000000-0000-4000-8000-000000000099'
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid)

      const queueSend = vi.fn().mockResolvedValue(undefined)

      const event = createEvent<Parameters<typeof importPostHandler>[0]>({
        auth: true,
        env: {
          SYNC_QUEUE: { send: queueSend },
        },
        body: { mangaDexId: 'md-test-123' },
      })

      const result = await importPostHandler(event)

      expect(result.jobId).toBe(uuid)
      expect(queueSend).toHaveBeenCalledTimes(1)
      expect(queueSend).toHaveBeenCalledWith({
        type: 'import-manga',
        jobId: uuid,
        mangaDexId: 'md-test-123',
      })
    })

    it('rejects request without mangaDexId', async () => {
      const event = createEvent<Parameters<typeof importPostHandler>[0]>({
        auth: true,
        body: {},
      })

      await expect(importPostHandler(event)).rejects.toThrow()
    })

    it('rejects request with empty mangaDexId', async () => {
      const event = createEvent<Parameters<typeof importPostHandler>[0]>({
        auth: true,
        body: { mangaDexId: '' },
      })

      await expect(importPostHandler(event)).rejects.toThrow()
    })
  })

  describe('GET /api/mangadex/import/status/:jobId', () => {
    it('returns queued status when job not found', async () => {
      mockGet.mockResolvedValue(null)

      const event = createEvent<Parameters<typeof importStatusGetHandler>[0]>({
        auth: true,
        params: { jobId: 'job-unknown' },
      })

      const result = await importStatusGetHandler(event)

      expect(result).toEqual({ status: 'queued' })
    })

    it('returns processing status when job is processing', async () => {
      mockGet.mockResolvedValue({
        jobId: 'job-1',
        status: 'processing',
        metadata: null,
      })

      const event = createEvent<Parameters<typeof importStatusGetHandler>[0]>({
        auth: true,
        params: { jobId: 'job-1' },
      })

      const result = await importStatusGetHandler(event)

      expect(result).toMatchObject({ status: 'processing' })
    })

    it('returns completed status with progress when metadata has counts', async () => {
      mockGet.mockResolvedValue({
        jobId: 'job-2',
        status: 'completed',
        metadata: JSON.stringify({ newChapters: 5, pagesCount: 100 }),
      })

      const event = createEvent<Parameters<typeof importStatusGetHandler>[0]>({
        auth: true,
        params: { jobId: 'job-2' },
      })

      const result = await importStatusGetHandler(event)

      expect(result).toMatchObject({
        status: 'completed',
        progress: { chapters: 5, pages: 100 },
      })
    })

    it('returns failed status with error metadata', async () => {
      mockGet.mockResolvedValue({
        jobId: 'job-3',
        status: 'failed',
        metadata: JSON.stringify({ error: 'MangaDex API timeout' }),
      })

      const event = createEvent<Parameters<typeof importStatusGetHandler>[0]>({
        auth: true,
        params: { jobId: 'job-3' },
      })

      const result = await importStatusGetHandler(event)

      expect(result.status).toBe('failed')
    })
  })
})
