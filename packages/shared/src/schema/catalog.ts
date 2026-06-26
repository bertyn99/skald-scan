import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'

import { ChapterStatus, Language, MangaStatus, SyncStatus } from '../constants'

const now = () => new Date()

export const manga = sqliteTable(
  'manga',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    coverUrl: text('cover_url'),
    status: text('status').notNull().default(MangaStatus.Ongoing),
    mangaDexId: text('manga_dex_id').unique(),
    author: text('author'),
    artist: text('artist'),
    tags: text('tags'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(now),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(now).$onUpdate(now),
    uploadedBy: text('uploaded_by'),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })
  },
  (table) => [
    index('manga_status_idx').on(table.status),
    index('manga_updated_at_idx').on(table.updatedAt),
    index('manga_title_idx').on(table.title)
  ]
)

export const chapters = sqliteTable(
  'chapters',
  {
    id: text('id').primaryKey(),
    mangaId: text('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    title: text('title'),
    chapterNumber: real('chapter_number').notNull(),
    language: text('language').default(Language.En),
    pagesCount: integer('pages_count').default(0),
    status: text('status').default(ChapterStatus.Available),
    scanlator: text('scanlator'),
    mangaDexChapterId: text('manga_dex_chapter_id').unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(now),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(now).$onUpdate(now)
  },
  (table) => [
    index('chapters_manga_id_idx').on(table.mangaId),
    index('chapters_chapter_number_idx').on(table.chapterNumber)
  ]
)

export const pages = sqliteTable(
  'pages',
  {
    id: text('id').primaryKey(),
    chapterId: text('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    pageNumber: integer('page_number').notNull(),
    imageUrl: text('image_url').notNull(),
    width: integer('width'),
    height: integer('height'),
    fileSize: integer('file_size'),
    r2Key: text('r2_key'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(now)
  },
  (table) => [
    index('pages_chapter_id_idx').on(table.chapterId),
    index('pages_page_number_idx').on(table.pageNumber)
  ]
)

export const mangaDexSync = sqliteTable(
  'manga_dex_sync',
  {
    id: text('id').primaryKey(),
    mangaId: text('manga_id')
      .notNull()
      .unique()
      .references(() => manga.id, { onDelete: 'cascade' }),
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
    syncStatus: text('sync_status').default(SyncStatus.Idle),
    autoSyncEnabled: integer('auto_sync_enabled', { mode: 'boolean' }).default(true),
    lastError: text('last_error'),
    remoteChapterCount: integer('remote_chapter_count'),
    // JSON-encoded string[] of BCP-47-ish codes (subset of Language enum).
    // NULL → use DEFAULT_LANGUAGES. Drives which chapter languages sync mirrors.
    languages: text('languages'),
    // Bounds lazy metadata refresh to at most 1/day/manga in handleSyncChapters.
    lastMetadataRefreshAt: integer('last_metadata_refresh_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(now),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(now).$onUpdate(now)
  },
  (table) => [
    index('manga_dex_sync_manga_id_idx').on(table.mangaId),
    index('manga_dex_sync_last_synced_at_idx').on(table.lastSyncedAt),
    index('manga_dex_sync_auto_sync_enabled_idx').on(table.autoSyncEnabled)
  ]
)

// Localized manga metadata. One row per (manga, language).
// `manga.title` / `manga.description` remain the canonical fallback (typically EN).
// alt_titles is a FLAT JSON string array, already language-filtered at insert time,
// so the FTS trigger can concatenate values via json_each without object parsing.
export const mangaTranslations = sqliteTable(
  'manga_translations',
  {
    mangaId: text('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    altTitles: text('alt_titles'),
    tags: text('tags'),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(now).$onUpdate(now)
  },
  (table) => [
    primaryKey({ columns: [table.mangaId, table.language] }),
    index('manga_translations_lang_idx').on(table.language)
  ]
)

// Manual FTS5 virtual table + sync triggers. NOT managed by drizzle-kit —
// applied via the 0001_manga_fts migration. Keep statements idempotent (IF NOT EXISTS).
export const mangaFtsSql = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS manga_fts USING fts5(title, description, content='manga', content_rowid='rowid');`,
  `CREATE TRIGGER IF NOT EXISTS manga_ai AFTER INSERT ON manga BEGIN
    INSERT INTO manga_fts(rowid, title, description) VALUES (new.rowid, new.title, coalesce(new.description, ''));
  END;`,
  `CREATE TRIGGER IF NOT EXISTS manga_au AFTER UPDATE ON manga BEGIN
    UPDATE manga_fts
    SET title = new.title, description = coalesce(new.description, '')
    WHERE rowid = new.rowid;
  END;`,
  `CREATE TRIGGER IF NOT EXISTS manga_ad AFTER DELETE ON manga BEGIN
    DELETE FROM manga_fts WHERE rowid = old.rowid;
  END;`
] as const

export const mangaFtsStatements = mangaFtsSql.map((statement) => sql.raw(statement))

// Per-language FTS over manga_translations. alt_titles is a JSON string array
// (contract: import/sync flatten MangaDex alt-title objects into per-lang strings);
// the trigger concatenates values for FTS tokenization.
// Table must remain a rowid table (NOT WITHOUT ROWID) — Drizzle's composite
// primaryKey() does not emit WITHOUT ROWID, so this holds by default.
const ALT_TITLES_FTS_EXPR = `(CASE WHEN new.alt_titles IS NULL OR new.alt_titles = '[]'
  THEN ''
  ELSE (SELECT group_concat(value, ' ') FROM json_each(new.alt_titles))
END)`

export const mangaTranslationsFtsSql = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS manga_translations_fts USING fts5(
    title, description, alt_titles,
    content='manga_translations',
    content_rowid='rowid'
  );`,
  `CREATE TRIGGER IF NOT EXISTS manga_translations_ai AFTER INSERT ON manga_translations BEGIN
    INSERT INTO manga_translations_fts(rowid, title, description, alt_titles)
    VALUES (new.rowid, new.title, coalesce(new.description, ''), ${ALT_TITLES_FTS_EXPR});
  END;`,
  `CREATE TRIGGER IF NOT EXISTS manga_translations_au AFTER UPDATE ON manga_translations BEGIN
    UPDATE manga_translations_fts
    SET title = new.title,
        description = coalesce(new.description, ''),
        alt_titles = ${ALT_TITLES_FTS_EXPR}
    WHERE rowid = new.rowid;
  END;`,
  `CREATE TRIGGER IF NOT EXISTS manga_translations_ad AFTER DELETE ON manga_translations BEGIN
    DELETE FROM manga_translations_fts WHERE rowid = old.rowid;
  END;`
] as const

export const mangaTranslationsFtsStatements = mangaTranslationsFtsSql.map((statement) => sql.raw(statement))
