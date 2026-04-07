import { getTableConfig, type AnySQLiteTable } from 'drizzle-orm/sqlite-core'
import { describe, expect, expectTypeOf, it } from 'vitest'

import * as schema from '../schema'
import type { InsertChapter, InsertUser, Manga, ReadingProgress } from '../types'

const indexNames = (table: AnySQLiteTable) => getTableConfig(table).indexes.map((idx) => idx.config.name)

describe('schema', () => {
  it('exports all expected tables', () => {
    expect(schema).toHaveProperty('users')
    expect(schema).toHaveProperty('sessions')
    expect(schema).toHaveProperty('manga')
    expect(schema).toHaveProperty('chapters')
    expect(schema).toHaveProperty('pages')
    expect(schema).toHaveProperty('readingProgress')
    expect(schema).toHaveProperty('collections')
    expect(schema).toHaveProperty('collectionManga')
    expect(schema).toHaveProperty('mangaDexSync')
  })

  it('defines all required explicit indexes', () => {
    expect(indexNames(schema.manga)).toEqual(
      expect.arrayContaining(['manga_status_idx', 'manga_updated_at_idx', 'manga_title_idx']),
    )

    expect(indexNames(schema.chapters)).toEqual(
      expect.arrayContaining(['chapters_manga_id_idx', 'chapters_chapter_number_idx']),
    )

    expect(indexNames(schema.pages)).toEqual(
      expect.arrayContaining(['pages_chapter_id_idx', 'pages_page_number_idx']),
    )

    expect(indexNames(schema.readingProgress)).toEqual(
      expect.arrayContaining([
        'reading_progress_user_manga_idx',
        'reading_progress_user_chapter_idx',
      ]),
    )

    expect(indexNames(schema.mangaDexSync)).toEqual(
      expect.arrayContaining([
        'manga_dex_sync_manga_id_idx',
        'manga_dex_sync_last_synced_at_idx',
        'manga_dex_sync_auto_sync_enabled_idx',
      ]),
    )
  })

  it('defines valid FTS5 table and trigger SQL statements', () => {
    expect(schema.mangaFtsSql).toHaveLength(4)
    for (const statement of schema.mangaFtsSql) {
      expect(statement.trim()).toMatch(/^CREATE\s+/i)
      expect(statement.trim().endsWith(';')).toBe(true)
    }

    expect(schema.mangaFtsSql[0]).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS manga_fts USING fts5')
    expect(schema.mangaFtsSql[1]).toContain('CREATE TRIGGER IF NOT EXISTS manga_ai')
    expect(schema.mangaFtsSql[2]).toContain('CREATE TRIGGER IF NOT EXISTS manga_au')
    expect(schema.mangaFtsSql[3]).toContain('CREATE TRIGGER IF NOT EXISTS manga_ad')
  })

  it('supports inferred select and insert types', () => {
    const newUser: InsertUser = {
      id: 'user_1',
      email: 'reader@example.com',
      role: 'reader',
    }

    const newChapter: InsertChapter = {
      id: 'chapter_1',
      mangaId: 'manga_1',
      chapterNumber: 12.5,
    }

    expectTypeOf(newUser.email).toEqualTypeOf<string>()
    expectTypeOf(newChapter.chapterNumber).toEqualTypeOf<number>()
    expectTypeOf<Manga['status']>().toEqualTypeOf<string>()
    expectTypeOf<ReadingProgress['read']>().toEqualTypeOf<boolean>()
    expect(newUser.role).toBe('reader')
  })
})
