import { describe, expect, it, vi } from 'vitest'

import healthHandler from '../api/admin/health.get'
import deleteMangaHandler from '../api/manga/[mangaId].delete'
import inviteHandler from '../api/admin/users/invite.post'
import getProgressHandler from '../api/reading-progress/[mangaId].get'
import putProgressHandler from '../api/reading-progress/index.put'

import {
  createAdminEvent,
  createAnonymousEvent,
  createMockD1,
  createMockQueue,
  createMockR2,
  createReaderEvent,
  expectThrowWithStatus,
  isCreateError
} from './fixtures'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getErrorChecks(error: unknown): Record<string, unknown> | undefined {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data: unknown }).data
    if (typeof data === 'object' && data !== null && 'checks' in data) {
      return (data as { checks: Record<string, unknown> }).checks
    }
  }
  return undefined
}

// ─── Health endpoint ─────────────────────────────────────

describe('GET /api/admin/health', () => {
  it('returns ok status when all bindings healthy', async () => {
    const db = createMockD1([{ firstResult: { '1': 1 } }])
    const event = createAdminEvent({
      env: {
        DB: db,
        STORAGE: createMockR2(),
        SYNC_QUEUE: createMockQueue()
      }
    })

    const result = await healthHandler(event)

    expect(result.status).toBe('ok')
    expect(result.checks.db).toBe('ok')
    expect(result.checks.storage).toBe('ok')
    expect(result.checks.queue).toBe('ok')
  })

  it('requires admin role', async () => {
    const event = createReaderEvent({})
    await expectThrowWithStatus(403)(() => healthHandler(event))
  })

  it('throws 503 with db error when DB check fails', async () => {
    const db = createMockD1()
    vi.mocked(db.prepare).mockImplementation(() => {
      throw new Error('connection refused')
    })
    const event = createAdminEvent({
      env: {
        DB: db,
        STORAGE: createMockR2(),
        SYNC_QUEUE: createMockQueue()
      }
    })

    try {
      await healthHandler(event)
      expect.fail('should have thrown 503')
    } catch (error) {
      expect(isCreateError(error)).toBe(true)
      if (isCreateError(error)) {
        expect(error.statusCode).toBe(503)
      }
      const checks = getErrorChecks(error)
      expect(checks?.db).toBe('error')
    }
  })
})

// ─── DELETE manga ────────────────────────────────────────

describe('DELETE /api/manga/:mangaId', () => {
  it('soft-deletes manga by setting deletedAt', async () => {
    const db = createMockD1([{ runResult: { success: true } }])
    const event = createAdminEvent({
      env: { DB: db },
      params: { mangaId: 'manga-1' }
    })

    const result = await deleteMangaHandler(event)

    expect(result).toEqual({ deleted: true, mangaId: 'manga-1' })
  })

  it('requires admin role', async () => {
    const event = createReaderEvent({ params: { mangaId: 'manga-1' } })
    await expectThrowWithStatus(403)(() => deleteMangaHandler(event))
  })

  it('requires mangaId param', async () => {
    const event = createAdminEvent({})
    await expectThrowWithStatus(400)(() => deleteMangaHandler(event))
  })
})

// ─── Invite endpoint ─────────────────────────────────────

describe('POST /api/admin/users/invite', () => {
  it('generates invite token for valid email', async () => {
    const event = createAdminEvent({
      body: { email: 'test@example.com' }
    })

    const result = await inviteHandler(event)

    expect(result.email).toBe('test@example.com')
    expect(result.token).toMatch(UUID_RE)
    expect(result.signupUrl).toContain(result.token)
    expect(result.expiresAt).toBeGreaterThan(Date.now())
  })

  it('requires admin role', async () => {
    const event = createReaderEvent({
      body: { email: 'test@example.com' }
    })
    await expectThrowWithStatus(403)(() => inviteHandler(event))
  })

  it('rejects missing email', async () => {
    const event = createAdminEvent({ body: {} })
    await expectThrowWithStatus(400)(() => inviteHandler(event))
  })
})

// ─── Reading-progress GET (data leak fix) ────────────────

describe('GET /api/reading-progress/:mangaId', () => {
  it('returns only current user progress entries', async () => {
    const capturedBindings: unknown[][] = []
    const db = createMockD1([{
      onBind: (args) => { capturedBindings.push(args) },
      allResult: {
        results: [
          { id: 'p1', chapterId: 'c1', lastPageRead: 5, read: 0, lastReadAt: 1000 },
          { id: 'p2', chapterId: 'c2', lastPageRead: 3, read: 1, lastReadAt: 2000 }
        ]
      }
    }])
    const event = createAdminEvent({
      auth: { userId: 'user-test', role: 'admin' },
      env: { DB: db },
      params: { mangaId: 'm1' }
    })

    const result = await getProgressHandler(event)

    expect(result.progress).toHaveLength(2)
    expect(result.progress[0]).toMatchObject({
      id: 'p1',
      chapterId: 'c1',
      lastPageRead: 5,
      read: false,
      lastReadAt: 1000
    })
    expect(result.progress[1]).toMatchObject({
      id: 'p2',
      chapterId: 'c2',
      read: true
    })
    expect(capturedBindings[0]).toContain('user-test')
  })
})

// ─── Reading-progress PUT (merge logic) ──────────────────

describe('PUT /api/reading-progress', () => {
  it('upserts progress for new chapter', async () => {
    const db = createMockD1([
      { firstResult: null },
      { runResult: { success: true } }
    ])
    const event = createAdminEvent({
      env: { DB: db },
      body: { mangaId: 'm1', chapterId: 'c1', lastPageRead: 5 }
    })

    const result = await putProgressHandler(event)

    expect(result).toEqual({ success: true })
  })

  it('skips update when server data is newer', async () => {
    const db = createMockD1([
      { firstResult: { updatedAt: Date.now() } }
    ])
    const event = createAdminEvent({
      env: { DB: db },
      body: {
        mangaId: 'm1',
        chapterId: 'c1',
        lastPageRead: 3,
        updatedAt: 1
      }
    })

    const result = await putProgressHandler(event)

    expect(result).toEqual({ success: true })
  })

  it('requires authentication', async () => {
    const event = createAnonymousEvent({
      body: { mangaId: 'm1', chapterId: 'c1', lastPageRead: 5 }
    })
    await expectThrowWithStatus(401)(() => putProgressHandler(event))
  })
})
