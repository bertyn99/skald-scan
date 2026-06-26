import type { MangaStatus, ChapterStatus, Language, SyncStatus } from './constants';

// GET /api/manga
export interface MangaListResponse {
  manga: MangaListItem[];
  cursor?: string;
}

export interface MangaListItem {
  id: string;
  title: string;
  coverUrl: string | null;
  status: MangaStatus;
  chapterCount: number;
  lastReadChapter?: number;
  updatedAt: number;
  // Resolved language actually used for this response (query param, user pref,
  // Accept-Language, or 'en' fallback). Lets clients show "Viewing in: fr".
  resolvedLanguage?: string;
  // Set when the requested language had no translation and the response fell back.
  languageFallback?: boolean;
}

// GET /api/manga/:id
export interface MangaDetailResponse {
  manga: MangaFull;
  chapters: ChapterSummary[];
}

export interface MangaFull {
  id: string;
  title: string;
  author: string | null;
  artist: string | null;
  description: string | null;
  coverUrl: string | null;
  status: MangaStatus;
  tags: string | null;
  mangaDexId: string | null;
  chapterCount: number;
  createdAt: number;
  updatedAt: number;
  resolvedLanguage?: string;
  languageFallback?: boolean;
  // Languages present in manga_translations for this manga.
  availableLanguages?: string[];
  // Optional admin-view payload: all translation rows.
  translations?: MangaTranslationSummary[];
}

export interface MangaTranslationSummary {
  language: string;
  title: string;
  description: string | null;
}

export interface ChapterSummary {
  id: string;
  title: string;
  chapterNumber: number;
  pagesCount: number;
  language: Language;
  status: ChapterStatus;
}

// PUT /api/reading-progress
export interface UpsertProgressRequest {
  mangaId: string;
  chapterId: string;
  lastPageRead: number;
  read: boolean;
  updatedAt?: number;
}

// POST /api/mangadex/import
export interface TriggerImportRequest {
  mangaDexId: string;
  // Optional per-manga language override. Defaults to DEFAULT_LANGUAGES when absent.
  languages?: string[];
}
export interface TriggerImportResponse {
  jobId: string;
}

// GET /api/mangadex/import/:jobId/status
export interface ImportStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: { chapters: number; pages: number };
  mangaId?: string;
  error?: string;
}

// Chapter import statistics for UI display
export interface ChapterImportStats {
  importing: number;
  total: number;
  imported: number;
}

// MangaDex sync status info for UI display
export interface MangaSyncInfo {
  status: SyncStatus;
  lastSyncedAt: number | null;
  lastError: string | null;
  // Languages currently mirrored for this manga (NULL config → DEFAULT_LANGUAGES).
  languages?: string[];
}

// PUT /api/manga/:id/languages
export interface SetMangaLanguagesRequest {
  languages: string[];
}

// GET /api/users/me
export interface UserProfileResponse {
  id: string;
  email: string;
  name: string | null;
  role: string;
  preferredLanguage: string | null;
}

// PUT /api/users/me/preferences
export interface UpdatePreferencesRequest {
  language?: string;
}
