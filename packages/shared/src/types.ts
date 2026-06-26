import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  accounts,
  chapters,
  collectionManga,
  collections,
  manga,
  mangaDexSync,
  mangaTranslations,
  pages,
  readingProgress,
  sessions,
  users,
  verifications
} from './schema'

export type User = InferSelectModel<typeof users>
export type InsertUser = InferInsertModel<typeof users>

export type Account = InferSelectModel<typeof accounts>
export type InsertAccount = InferInsertModel<typeof accounts>

export type Verification = InferSelectModel<typeof verifications>
export type InsertVerification = InferInsertModel<typeof verifications>

export type Session = InferSelectModel<typeof sessions>
export type InsertSession = InferInsertModel<typeof sessions>

export type Manga = InferSelectModel<typeof manga>
export type InsertManga = InferInsertModel<typeof manga>

export type Chapter = InferSelectModel<typeof chapters>
export type InsertChapter = InferInsertModel<typeof chapters>

export type Page = InferSelectModel<typeof pages>
export type InsertPage = InferInsertModel<typeof pages>

export type ReadingProgress = InferSelectModel<typeof readingProgress>
export type InsertReadingProgress = InferInsertModel<typeof readingProgress>

export type Collection = InferSelectModel<typeof collections>
export type InsertCollection = InferInsertModel<typeof collections>

export type CollectionManga = InferSelectModel<typeof collectionManga>
export type InsertCollectionManga = InferInsertModel<typeof collectionManga>

export type MangaDexSync = InferSelectModel<typeof mangaDexSync>
export type InsertMangaDexSync = InferInsertModel<typeof mangaDexSync>

export type MangaTranslation = InferSelectModel<typeof mangaTranslations>
export type InsertMangaTranslation = InferInsertModel<typeof mangaTranslations>
