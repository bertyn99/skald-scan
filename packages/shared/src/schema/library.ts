import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

import { users } from './auth'
import { chapters, manga } from './catalog'

const now = () => new Date()

// Per-user favorites / curated lists of manga.
export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(now),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(now).$onUpdate(now)
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
    addedAt: integer('added_at', { mode: 'timestamp_ms' }).$defaultFn(now)
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.mangaId] })]
)

// Per-user reading state. Last-read pointer per chapter + completion flag.
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
    lastReadAt: integer('last_read_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(now),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(now).$onUpdate(now)
  },
  (table) => [
    index('reading_progress_user_manga_idx').on(table.userId, table.mangaId),
    uniqueIndex('reading_progress_user_chapter_idx').on(table.userId, table.chapterId)
  ]
)
