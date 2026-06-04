import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockFrom, mockWhere, mockOrderBy, mockLimit, mockAll, mockUpdate, mockSet, mockSend } = vi.hoisted(() => {
  const all = vi.fn()
  const limit = vi.fn(() => ({ all }))
  const orderBy = vi.fn(() => ({ limit }))
  const where = vi.fn(() => ({ orderBy }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  const set = vi.fn(() => ({ where: vi.fn() }))
  const update = vi.fn(() => ({ set }))
  const send = vi.fn()

  return { mockSelect: select, mockFrom: from, mockWhere: where, mockOrderBy: orderBy, mockLimit: limit, mockAll: all, mockUpdate: update, mockSet: set, mockSend: send }
})

vi.mock('drizzle-orm/d1', () => ({
  drizzle: () => ({
    select: mockSelect,
    update: mockUpdate,
  }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => 'eq'),
  and: vi.fn((..._args) => 'and'),
  lt: vi.fn((_col, _val) => 'lt'),
  asc: vi.fn((_col) => 'asc'),
}))

vi.mock('@skald-scan/shared', () => ({
  mangaDexSync: {
    id: 'id',
    mangaId: 'manga_id',
    autoSyncEnabled: 'auto_sync_enabled',
    syncStatus: 'sync_status',
    lastSyncedAt: 'last_synced_at',
  },
  SyncStatus: { Idle: 'idle', Syncing: 'syncing', Error: 'error' },
}))

describe('scheduled-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAll.mockReset()
    mockSend.mockReset()
    mockSet.mockReturnValue({ where: vi.fn() })
  })

  it('returns zero counts when no manga due for sync', async () => {
    mockAll.mockResolvedValue([])
    const { handleScheduledSync } = await import('../services/scheduled-sync')

    const result = await handleScheduledSync({
      DB: {} as never,
      SYNC_QUEUE: { send: mockSend },
    })

    expect(result).toEqual({ synced: 0, queued: 0 })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('queues sync jobs for due manga', async () => {
    mockAll.mockResolvedValue([
      { id: 'sync-1', mangaId: 'manga-a' },
      { id: 'sync-2', mangaId: 'manga-b' },
    ])

    const { handleScheduledSync } = await import('../services/scheduled-sync')

    const result = await handleScheduledSync({
      DB: {} as never,
      SYNC_QUEUE: { send: mockSend },
    })

    expect(result).toEqual({ synced: 2, queued: 2 })
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('respects max 5 manga per run', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `sync-${i}`,
      mangaId: `manga-${i}`,
    }))
    mockAll.mockResolvedValue(many)

    const { handleScheduledSync } = await import('../services/scheduled-sync')

    const result = await handleScheduledSync({
      DB: {} as never,
      SYNC_QUEUE: { send: mockSend },
    })

    // The limit(5) is called, mock returns all 8, but the service processes what mockAll returns
    expect(mockLimit).toHaveBeenCalledWith(5)
    expect(result.synced).toBe(8) // mock returns 8 since we're testing the query call
  })

  it('sets sync status to syncing before queueing', async () => {
    mockAll.mockResolvedValue([{ id: 'sync-1', mangaId: 'manga-a' }])

    const { handleScheduledSync } = await import('../services/scheduled-sync')

    await handleScheduledSync({
      DB: {} as never,
      SYNC_QUEUE: { send: mockSend },
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ syncStatus: 'syncing' }),
    )
  })
})
