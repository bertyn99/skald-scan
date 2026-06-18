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
}
export interface TriggerImportResponse {
  jobId: string;
}

// GET /api/mangadex/import/:jobId/status
export interface ImportStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: { chapters: number; pages: number };
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
}
