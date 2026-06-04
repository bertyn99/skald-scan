CREATE TABLE `processed_jobs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`processed_at` integer NOT NULL,
	`status` text NOT NULL,
	`metadata` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`manga_id` text NOT NULL,
	`title` text,
	`chapter_number` real NOT NULL,
	`language` text DEFAULT 'en',
	`pages_count` integer DEFAULT 0,
	`status` text DEFAULT 'available',
	`scanlator` text,
	`manga_dex_chapter_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chapters`("id", "manga_id", "title", "chapter_number", "language", "pages_count", "status", "scanlator", "manga_dex_chapter_id", "created_at", "updated_at") SELECT "id", "manga_id", "title", "chapter_number", "language", "pages_count", "status", "scanlator", "manga_dex_chapter_id", "created_at", "updated_at" FROM `chapters`;--> statement-breakpoint
DROP TABLE `chapters`;--> statement-breakpoint
ALTER TABLE `__new_chapters` RENAME TO `chapters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_manga_dex_chapter_id_unique` ON `chapters` (`manga_dex_chapter_id`);--> statement-breakpoint
CREATE INDEX `chapters_manga_id_idx` ON `chapters` (`manga_id`);--> statement-breakpoint
CREATE INDEX `chapters_chapter_number_idx` ON `chapters` (`chapter_number`);--> statement-breakpoint
CREATE TABLE `__new_collection_manga` (
	`collection_id` text NOT NULL,
	`manga_id` text NOT NULL,
	`added_at` integer,
	PRIMARY KEY(`collection_id`, `manga_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_collection_manga`("collection_id", "manga_id", "added_at") SELECT "collection_id", "manga_id", "added_at" FROM `collection_manga`;--> statement-breakpoint
DROP TABLE `collection_manga`;--> statement-breakpoint
ALTER TABLE `__new_collection_manga` RENAME TO `collection_manga`;--> statement-breakpoint
CREATE TABLE `__new_manga_dex_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`manga_id` text NOT NULL,
	`last_synced_at` integer,
	`sync_status` text DEFAULT 'idle',
	`auto_sync_enabled` integer DEFAULT true,
	`last_error` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_manga_dex_sync`("id", "manga_id", "last_synced_at", "sync_status", "auto_sync_enabled", "last_error", "created_at", "updated_at") SELECT "id", "manga_id", "last_synced_at", "sync_status", "auto_sync_enabled", "last_error", "created_at", "updated_at" FROM `manga_dex_sync`;--> statement-breakpoint
DROP TABLE `manga_dex_sync`;--> statement-breakpoint
ALTER TABLE `__new_manga_dex_sync` RENAME TO `manga_dex_sync`;--> statement-breakpoint
CREATE UNIQUE INDEX `manga_dex_sync_manga_id_unique` ON `manga_dex_sync` (`manga_id`);--> statement-breakpoint
CREATE INDEX `manga_dex_sync_manga_id_idx` ON `manga_dex_sync` (`manga_id`);--> statement-breakpoint
CREATE INDEX `manga_dex_sync_last_synced_at_idx` ON `manga_dex_sync` (`last_synced_at`);--> statement-breakpoint
CREATE INDEX `manga_dex_sync_auto_sync_enabled_idx` ON `manga_dex_sync` (`auto_sync_enabled`);--> statement-breakpoint
CREATE TABLE `__new_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`image_url` text NOT NULL,
	`width` integer,
	`height` integer,
	`file_size` integer,
	`r2_key` text,
	`created_at` integer,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_pages`("id", "chapter_id", "page_number", "image_url", "width", "height", "file_size", "r2_key", "created_at") SELECT "id", "chapter_id", "page_number", "image_url", "width", "height", "file_size", "r2_key", "created_at" FROM `pages`;--> statement-breakpoint
DROP TABLE `pages`;--> statement-breakpoint
ALTER TABLE `__new_pages` RENAME TO `pages`;--> statement-breakpoint
CREATE INDEX `pages_chapter_id_idx` ON `pages` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `pages_page_number_idx` ON `pages` (`page_number`);--> statement-breakpoint
CREATE TABLE `__new_reading_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`manga_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`last_page_read` integer DEFAULT 0,
	`read` integer DEFAULT false NOT NULL,
	`progress_percent` real DEFAULT 0,
	`last_read_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reading_progress`("id", "user_id", "manga_id", "chapter_id", "last_page_read", "read", "progress_percent", "last_read_at", "created_at", "updated_at") SELECT "id", "user_id", "manga_id", "chapter_id", "last_page_read", "read", "progress_percent", "last_read_at", "created_at", "updated_at" FROM `reading_progress`;--> statement-breakpoint
DROP TABLE `reading_progress`;--> statement-breakpoint
ALTER TABLE `__new_reading_progress` RENAME TO `reading_progress`;--> statement-breakpoint
CREATE INDEX `reading_progress_user_manga_idx` ON `reading_progress` (`user_id`,`manga_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reading_progress_user_chapter_idx` ON `reading_progress` (`user_id`,`chapter_id`);--> statement-breakpoint
ALTER TABLE `manga` ADD `uploaded_by` text;--> statement-breakpoint
ALTER TABLE `manga` ADD `deleted_at` integer;