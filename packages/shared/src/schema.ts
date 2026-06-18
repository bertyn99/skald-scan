import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { ChapterStatus, Language, MangaStatus, SyncStatus, UserRole } from './constants'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role').notNull().default(UserRole.Reader),
  imageUrl: text('image_url'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at'),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at'),
})

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
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
    uploadedBy: text('uploaded_by'),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('manga_status_idx').on(table.status),
    index('manga_updated_at_idx').on(table.updatedAt),
    index('manga_title_idx').on(table.title),
  ],
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
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  (table) => [
    index('chapters_manga_id_idx').on(table.mangaId),
    index('chapters_chapter_number_idx').on(table.chapterNumber),
  ],
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
    createdAt: integer('created_at'),
  },
  (table) => [
    index('pages_chapter_id_idx').on(table.chapterId),
    index('pages_page_number_idx').on(table.pageNumber),
  ],
)

export const readingProgress = sqliteTable(
  'reading_progress',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    mangaId: text('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    chapterId: text('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    lastPageRead: integer('last_page_read').default(0),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    progressPercent: real('progress_percent').default(0),
    lastReadAt: integer('last_read_at'),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  (table) => [
    index('reading_progress_user_manga_idx').on(table.userId, table.mangaId),
    uniqueIndex('reading_progress_user_chapter_idx').on(table.userId, table.chapterId),
  ],
)

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const collectionManga = sqliteTable(
  'collection_manga',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    mangaId: text('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    addedAt: integer('added_at'),
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.mangaId] })],
)

export const mangaDexSync = sqliteTable(
  'manga_dex_sync',
  {
    id: text('id').primaryKey(),
    mangaId: text('manga_id')
      .notNull()
      .unique()
      .references(() => manga.id, { onDelete: 'cascade' }),
    lastSyncedAt: integer('last_synced_at'),
    syncStatus: text('sync_status').default(SyncStatus.Idle),
    autoSyncEnabled: integer('auto_sync_enabled', { mode: 'boolean' }).default(true),
    lastError: text('last_error'),
    remoteChapterCount: integer('remote_chapter_count'),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  (table) => [
    index('manga_dex_sync_manga_id_idx').on(table.mangaId),
    index('manga_dex_sync_last_synced_at_idx').on(table.lastSyncedAt),
    index('manga_dex_sync_auto_sync_enabled_idx').on(table.autoSyncEnabled),
  ],
)

export const processedJobs = sqliteTable('processed_jobs', {
  jobId: text('job_id').primaryKey(),
  processedAt: integer('processed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  status: text('status', { enum: ['processing', 'completed', 'failed'] }).notNull(),
  metadata: text('metadata'), // JSON string
});

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
  END;`,
] as const

export const mangaFtsStatements = mangaFtsSql.map((statement) => sql.raw(statement))
