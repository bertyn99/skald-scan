CREATE TABLE `manga_translations` (
	`manga_id` text NOT NULL,
	`language` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`alt_titles` text,
	`tags` text,
	`updated_at` integer,
	PRIMARY KEY(`manga_id`, `language`),
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `manga_translations_lang_idx` ON `manga_translations` (`language`);--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_language` text;--> statement-breakpoint
ALTER TABLE `manga_dex_sync` ADD `languages` text;--> statement-breakpoint
ALTER TABLE `manga_dex_sync` ADD `last_metadata_refresh_at` integer;