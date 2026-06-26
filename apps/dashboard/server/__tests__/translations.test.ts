import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_LANGUAGES, Language } from '@skald-scan/shared'

import { buildTranslationRows, refreshMangaTranslations } from '../utils/translations'
import { claimQueueJob } from '../utils/storage'

import { createMockD1 } from './fixtures'

// Minimal MangaDex manga shape sufficient for the translation builder.
function buildMdManga(languages: Record<string, string>) {
  return {
    id: 'md-1',
    type: 'manga' as const,
    attributes: {
      title: languages,
      description: Object.fromEntries(Object.entries(languages).map(([k]) => [k, `${k} desc`])),
      altTitles: [],
      tags: [],
      status: 'ongoing'
    },
    relationships: []
  }
}

describe('buildTranslationRows', () => {
  it('emits one row per language present in the manga title', () => {
    const rows = buildTranslationRows(
      'm-1',
      buildMdManga({ en: 'Title EN', fr: 'Titre FR', ja: 'タイトル' }) as never,
      [Language.En, Language.Fr, Language.Es]
    )
    // ES is absent from the source → skipped.
    expect(rows.map(r => r.language)).toEqual([Language.En, Language.Fr])
    expect(rows[0]).toMatchObject({ mangaId: 'm-1', title: 'Title EN', description: 'en desc' })
    expect(rows[1]).toMatchObject({ language: Language.Fr, title: 'Titre FR' })
  })

  it('flattens alt_titles to a JSON string array per language (not the raw object array)', () => {
    const mdManga = {
      id: 'md-1',
      type: 'manga' as const,
      attributes: {
        title: { en: 'Main', fr: 'Principal' },
        description: {},
        // MangaDex shape: array of single-key objects.
        altTitles: [
          { en: 'Alt EN One' },
          { fr: 'Alt FR Un' },
          { en: 'Alt EN Two', fr: 'Alt FR Deux' }
        ],
        tags: [],
        status: 'ongoing'
      },
      relationships: []
    }
    const rows = buildTranslationRows('m-1', mdManga as never, [Language.En, Language.Fr])

    const enAlt = JSON.parse(rows[0]!.altTitles)
    const frAlt = JSON.parse(rows[1]!.altTitles)

    expect(enAlt).toEqual(['Alt EN One', 'Alt EN Two'])
    expect(frAlt).toEqual(['Alt FR Un', 'Alt FR Deux'])
    // Contract: must be a flat string array, never an array of objects.
    expect(typeof enAlt[0]).toBe('string')
  })
})

describe('refreshMangaTranslations', () => {
  beforeEach(() => vi.clearAllMocks())

  // The helper drives Drizzle's db.insert().values().onConflictDoUpdate()
  // chain and db.delete().where() chain, then submits all builders to
  // db.batch(). We build a stub db that records builders and exposes .batch.
  function buildStubDb() {
    const builders: unknown[] = []
    const chainable = () => {
      const c: Record<string, ReturnType<typeof vi.fn>> = {}
      c.values = vi.fn(() => c)
      c.onConflictDoUpdate = vi.fn(() => c)
      c.where = vi.fn(() => c)
      return c
    }
    const db = {
      insert: vi.fn(() => {
        const c = chainable()
        builders.push(c)
        return c
      }),
      delete: vi.fn(() => {
        const c = chainable()
        builders.push(c)
        return c
      }),
      batch: vi.fn(async (items: unknown[]) => {
        // Helper passes an array of builders; we recorded the same count.
        expect(Array.isArray(items)).toBe(true)
        expect(items.length).toBe(builders.length)
        return []
      }),
      _builders: builders
    }
    return db
  }

  it('issues an atomic db.batch with upserts + cleanup delete', async () => {
    const db = buildStubDb()

    await refreshMangaTranslations(
      db as never,
      'm-1',
      buildMdManga({ en: 'T', fr: 'TFR' }) as never,
      [Language.En, Language.Fr]
    )

    // Exactly ONE batch call — that's the atomicity contract.
    expect(db.batch).toHaveBeenCalledTimes(1)
    // The batch receives at least: 1 upsert chunk + 1 cleanup delete.
    expect(db._builders.length).toBeGreaterThanOrEqual(2)
  })

  it('skips entirely when no languages are configured', async () => {
    const db = buildStubDb()

    const result = await refreshMangaTranslations(
      db as never,
      'm-1',
      buildMdManga({ en: 'T' }) as never,
      []
    )

    expect(result.upserted).toBe(0)
    expect(db.batch).not.toHaveBeenCalled()
  })
})

describe('claimQueueJob (atomic reclaim of failed rows)', () => {
  // Stateful mock that mirrors the real ON CONFLICT DO UPDATE WHERE status='failed'
  // semantics: a row that doesn't exist or has status='failed' yields a RETURNING
  // row (claim granted); a 'processing' or 'completed' row yields null (denied).
  // Test code mutates `rowStatus` to simulate failQueueJob/completeQueueJob.
  function buildClaimDb() {
    let rowStatus: 'absent' | 'processing' | 'failed' | 'completed' = 'absent'
    const db = createMockD1([]) as unknown as D1Database
    vi.mocked(db.prepare).mockImplementation(() => ({
      bind: () => ({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockImplementation(async () => {
          if (rowStatus === 'absent' || rowStatus === 'failed') {
            rowStatus = 'processing'
            return { job_id: 'job-x' }
          }
          return null
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
        raw: vi.fn().mockResolvedValue([])
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      raw: vi.fn().mockResolvedValue([])
    }) as ReturnType<D1Database['prepare']>)
    return {
      db,
      setStatus: (next: typeof rowStatus) => { rowStatus = next },
      getStatus: () => rowStatus
    }
  }

  it('grants the first claim and denies a concurrent re-claim', async () => {
    const { db } = buildClaimDb()
    expect(await claimQueueJob(db, 'job-x')).toBe(true)
    // Second call while the row is 'processing' must be denied.
    expect(await claimQueueJob(db, 'job-x')).toBe(false)
  })

  it('re-grants the claim after the row was marked failed (queue retry path)', async () => {
    const { db, setStatus, getStatus } = buildClaimDb()
    expect(await claimQueueJob(db, 'job-x')).toBe(true)
    expect(getStatus()).toBe('processing')
    // Concurrent re-claim while processing is denied.
    expect(await claimQueueJob(db, 'job-x')).toBe(false)
    // Service's failQueueJob flips status to 'failed'.
    setStatus('failed')
    // Queue redelivery: claim must succeed so the work actually retries.
    expect(await claimQueueJob(db, 'job-x')).toBe(true)
    expect(getStatus()).toBe('processing')
  })

  it('denies re-claim once the row is completed (no double-processing)', async () => {
    const { db, setStatus } = buildClaimDb()
    expect(await claimQueueJob(db, 'job-x')).toBe(true)
    setStatus('completed')
    expect(await claimQueueJob(db, 'job-x')).toBe(false)
  })
})

describe('DEFAULT_LANGUAGES sanity', () => {
  it('contains exactly the documented default set', () => {
    expect(DEFAULT_LANGUAGES).toEqual([Language.En, Language.Fr, Language.Es, Language.Pt])
  })
})
