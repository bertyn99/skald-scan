import { describe, it } from 'vitest'

import {
  createAdminEvent,
  createAnonymousEvent,
  createReaderEvent,
  expectThrowWithStatus,
  isCreateError
} from './fixtures'

import mangaIndexPost from '../api/manga/index.post'
import mangaPut from '../api/manga/[mangaId].put'
import mangaDelete from '../api/manga/[mangaId].delete'
import chapterPost from '../api/manga/[mangaId]/chapters/index.post'
import uploadUrl from '../api/storage/upload-url.post'
import uploadZip from '../api/storage/upload-zip.post'
import importPost from '../api/mangadex/import.post'
import adminStats from '../api/admin/stats/index.get'
import adminUsers from '../api/admin/users/index.get'
import rolePut from '../api/admin/users/[id]/role.put'

async function expectAdminPassesGate(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (isCreateError(error) && (error.statusCode === 401 || error.statusCode === 403)) {
      throw new Error(`Admin should not receive ${error.statusCode}: ${error.statusMessage}`)
    }
  }
}

describe('auth gates', () => {
  describe('manga endpoints', () => {
    it('rejects reader from POST /api/manga', async () => {
      const event = createReaderEvent({ body: { title: 'Test' } })
      await expectThrowWithStatus(403)(() => mangaIndexPost(event))
    })

    it('rejects anonymous from POST /api/manga', async () => {
      const event = createAnonymousEvent({ body: { title: 'Test' } })
      await expectThrowWithStatus(401)(() => mangaIndexPost(event))
    })

    it('allows admin to pass auth gate on POST /api/manga', async () => {
      const event = createAdminEvent({ body: { title: 'Test' } })
      await expectAdminPassesGate(() => mangaIndexPost(event))
    })

    it('rejects reader from PUT /api/manga/:mangaId', async () => {
      const event = createReaderEvent({ params: { mangaId: 'm1' }, body: { title: 'x' } })
      await expectThrowWithStatus(403)(() => mangaPut(event))
    })

    it('rejects anonymous from PUT /api/manga/:mangaId', async () => {
      const event = createAnonymousEvent({ params: { mangaId: 'm1' }, body: { title: 'x' } })
      await expectThrowWithStatus(401)(() => mangaPut(event))
    })

    it('allows admin to pass auth gate on PUT /api/manga/:mangaId', async () => {
      const event = createAdminEvent({ params: { mangaId: 'm1' }, body: { title: 'Updated' } })
      await expectAdminPassesGate(() => mangaPut(event))
    })

    it('rejects reader from DELETE /api/manga/:mangaId', async () => {
      const event = createReaderEvent({ params: { mangaId: 'm1' } })
      await expectThrowWithStatus(403)(() => mangaDelete(event))
    })

    it('rejects anonymous from DELETE /api/manga/:mangaId', async () => {
      const event = createAnonymousEvent({ params: { mangaId: 'm1' } })
      await expectThrowWithStatus(401)(() => mangaDelete(event))
    })

    it('allows admin to pass auth gate on DELETE /api/manga/:mangaId', async () => {
      const event = createAdminEvent({ params: { mangaId: 'm1' } })
      await expectAdminPassesGate(() => mangaDelete(event))
    })

    it('rejects reader from POST /api/manga/:mangaId/chapters', async () => {
      const event = createReaderEvent({ params: { mangaId: 'm1' }, body: { chapterNumber: 1 } })
      await expectThrowWithStatus(403)(() => chapterPost(event))
    })

    it('rejects anonymous from POST /api/manga/:mangaId/chapters', async () => {
      const event = createAnonymousEvent({ params: { mangaId: 'm1' }, body: { chapterNumber: 1 } })
      await expectThrowWithStatus(401)(() => chapterPost(event))
    })

    it('allows admin to pass auth gate on POST /api/manga/:mangaId/chapters', async () => {
      const event = createAdminEvent({ params: { mangaId: 'm1' }, body: { chapterNumber: 1 } })
      await expectAdminPassesGate(() => chapterPost(event))
    })
  })

  describe('storage endpoints', () => {
    it('rejects reader from POST /api/storage/upload-url', async () => {
      const event = createReaderEvent({
        body: { mangaId: 'm1', chapterId: 'c1', fileName: '001.webp' }
      })
      await expectThrowWithStatus(403)(() => uploadUrl(event))
    })

    it('rejects anonymous from POST /api/storage/upload-url', async () => {
      const event = createAnonymousEvent({
        body: { mangaId: 'm1', chapterId: 'c1', fileName: '001.webp' }
      })
      await expectThrowWithStatus(401)(() => uploadUrl(event))
    })

    it('allows admin to pass auth gate on POST /api/storage/upload-url', async () => {
      const event = createAdminEvent({
        body: { mangaId: 'm1', chapterId: 'c1', fileName: '001.webp' }
      })
      await expectAdminPassesGate(() => uploadUrl(event))
    })

    it('rejects reader from POST /api/storage/upload-zip', async () => {
      const event = createReaderEvent({
        body: { mangaId: 'm1', chapterId: 'c1', fileName: 'a.zip', content: 'dGVzdA==' }
      })
      await expectThrowWithStatus(403)(() => uploadZip(event))
    })

    it('rejects anonymous from POST /api/storage/upload-zip', async () => {
      const event = createAnonymousEvent({
        body: { mangaId: 'm1', chapterId: 'c1', fileName: 'a.zip', content: 'dGVzdA==' }
      })
      await expectThrowWithStatus(401)(() => uploadZip(event))
    })

    it('allows admin to pass auth gate on POST /api/storage/upload-zip', async () => {
      const event = createAdminEvent({
        body: { mangaId: 'm1', chapterId: 'c1', fileName: 'a.zip', content: 'dGVzdA==' }
      })
      await expectAdminPassesGate(() => uploadZip(event))
    })
  })

  describe('mangadex endpoints', () => {
    it('rejects reader from POST /api/mangadex/import', async () => {
      const event = createReaderEvent({ body: { mangaDexId: 'md-1' } })
      await expectThrowWithStatus(403)(() => importPost(event))
    })

    it('rejects anonymous from POST /api/mangadex/import', async () => {
      const event = createAnonymousEvent({ body: { mangaDexId: 'md-1' } })
      await expectThrowWithStatus(401)(() => importPost(event))
    })

    it('allows admin to pass auth gate on POST /api/mangadex/import', async () => {
      const event = createAdminEvent({ body: { mangaDexId: 'md-1' } })
      await expectAdminPassesGate(() => importPost(event))
    })
  })

  describe('admin endpoints', () => {
    it('rejects reader from GET /api/admin/stats', async () => {
      const event = createReaderEvent({})
      await expectThrowWithStatus(403)(() => adminStats(event))
    })

    it('rejects anonymous from GET /api/admin/stats', async () => {
      const event = createAnonymousEvent({})
      await expectThrowWithStatus(401)(() => adminStats(event))
    })

    it('allows admin to pass auth gate on GET /api/admin/stats', async () => {
      const event = createAdminEvent({})
      await expectAdminPassesGate(() => adminStats(event))
    })

    it('rejects reader from GET /api/admin/users', async () => {
      const event = createReaderEvent({})
      await expectThrowWithStatus(403)(() => adminUsers(event))
    })

    it('rejects anonymous from GET /api/admin/users', async () => {
      const event = createAnonymousEvent({})
      await expectThrowWithStatus(401)(() => adminUsers(event))
    })

    it('allows admin to pass auth gate on GET /api/admin/users', async () => {
      const event = createAdminEvent({})
      await expectAdminPassesGate(() => adminUsers(event))
    })

    it('rejects reader from PUT /api/admin/users/:id/role', async () => {
      const event = createReaderEvent({ params: { id: 'u1' }, body: { role: 'reader' } })
      await expectThrowWithStatus(403)(() => rolePut(event))
    })

    it('rejects anonymous from PUT /api/admin/users/:id/role', async () => {
      const event = createAnonymousEvent({ params: { id: 'u1' }, body: { role: 'reader' } })
      await expectThrowWithStatus(401)(() => rolePut(event))
    })

    it('allows admin to pass auth gate on PUT /api/admin/users/:id/role', async () => {
      const event = createAdminEvent({ params: { id: 'u1' }, body: { role: 'reader' } })
      await expectAdminPassesGate(() => rolePut(event))
    })
  })

})
