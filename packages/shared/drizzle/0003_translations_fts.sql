-- Per-language FTS over manga_translations. alt_titles is a JSON string array
-- (contract: import/sync flatten MangaDex alt-title objects into per-lang strings);
-- the trigger concatenates values for FTS tokenization.
-- Idempotent: re-runnable on existing DBs (IF NOT EXISTS).
-- NOT drizzle-managed — paired with mangaTranslationsFtsSql in src/schema/catalog.ts.

CREATE VIRTUAL TABLE IF NOT EXISTS manga_translations_fts USING fts5(
  title, description, alt_titles,
  content='manga_translations',
  content_rowid='rowid'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS manga_translations_ai AFTER INSERT ON manga_translations BEGIN
  INSERT INTO manga_translations_fts(rowid, title, description, alt_titles)
  VALUES (
    new.rowid,
    new.title,
    coalesce(new.description, ''),
    (CASE WHEN new.alt_titles IS NULL OR new.alt_titles = '[]'
      THEN ''
      ELSE (SELECT group_concat(value, ' ') FROM json_each(new.alt_titles))
    END)
  );
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS manga_translations_au AFTER UPDATE ON manga_translations BEGIN
  UPDATE manga_translations_fts
  SET title = new.title,
      description = coalesce(new.description, ''),
      alt_titles = (CASE WHEN new.alt_titles IS NULL OR new.alt_titles = '[]'
        THEN ''
        ELSE (SELECT group_concat(value, ' ') FROM json_each(new.alt_titles))
      END)
  WHERE rowid = new.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS manga_translations_ad AFTER DELETE ON manga_translations BEGIN
  DELETE FROM manga_translations_fts WHERE rowid = old.rowid;
END;
