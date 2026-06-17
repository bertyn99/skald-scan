CREATE VIRTUAL TABLE IF NOT EXISTS manga_fts USING fts5(title, description, content='manga', content_rowid='rowid');
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS manga_ai AFTER INSERT ON manga BEGIN
    INSERT INTO manga_fts(rowid, title, description) VALUES (new.rowid, new.title, coalesce(new.description, ''));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS manga_au AFTER UPDATE ON manga BEGIN
    UPDATE manga_fts
    SET title = new.title, description = coalesce(new.description, '')
    WHERE rowid = new.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS manga_ad AFTER DELETE ON manga BEGIN
    DELETE FROM manga_fts WHERE rowid = old.rowid;
END;
