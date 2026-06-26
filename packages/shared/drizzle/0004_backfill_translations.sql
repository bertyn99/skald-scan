-- One-time backfill: seed EN translation rows from existing canonical manga
-- so every existing manga has at least one translation immediately after deploy.
-- Full localized backfill (FR/ES/PT) for existing MangaDex manga happens lazily
-- via handleSyncChapters' bounded metadata refresh (max 1/day/manga).
-- Idempotent: re-runnable (NOT EXISTS guard per manga+lang).

INSERT INTO manga_translations (manga_id, language, title, description, updated_at)
SELECT
  id,
  'en',
  title,
  COALESCE(description, ''),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM manga
WHERE deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM manga_translations mt
    WHERE mt.manga_id = manga.id
      AND mt.language = 'en'
  );
