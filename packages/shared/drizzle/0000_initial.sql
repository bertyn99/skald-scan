CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'reader' NOT NULL,
	`image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chapters` (
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
CREATE UNIQUE INDEX `chapters_manga_dex_chapter_id_unique` ON `chapters` (`manga_dex_chapter_id`);--> statement-breakpoint
CREATE INDEX `chapters_manga_id_idx` ON `chapters` (`manga_id`);--> statement-breakpoint
CREATE INDEX `chapters_chapter_number_idx` ON `chapters` (`chapter_number`);--> statement-breakpoint
CREATE TABLE `manga` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_url` text,
	`status` text DEFAULT 'ongoing' NOT NULL,
	`manga_dex_id` text,
	`author` text,
	`artist` text,
	`tags` text,
	`created_at` integer,
	`updated_at` integer,
	`uploaded_by` text,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manga_manga_dex_id_unique` ON `manga` (`manga_dex_id`);--> statement-breakpoint
CREATE INDEX `manga_status_idx` ON `manga` (`status`);--> statement-breakpoint
CREATE INDEX `manga_updated_at_idx` ON `manga` (`updated_at`);--> statement-breakpoint
CREATE INDEX `manga_title_idx` ON `manga` (`title`);--> statement-breakpoint
CREATE TABLE `manga_dex_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`manga_id` text NOT NULL,
	`last_synced_at` integer,
	`sync_status` text DEFAULT 'idle',
	`auto_sync_enabled` integer DEFAULT true,
	`last_error` text,
	`remote_chapter_count` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manga_dex_sync_manga_id_unique` ON `manga_dex_sync` (`manga_id`);--> statement-breakpoint
CREATE INDEX `manga_dex_sync_manga_id_idx` ON `manga_dex_sync` (`manga_id`);--> statement-breakpoint
CREATE INDEX `manga_dex_sync_last_synced_at_idx` ON `manga_dex_sync` (`last_synced_at`);--> statement-breakpoint
CREATE INDEX `manga_dex_sync_auto_sync_enabled_idx` ON `manga_dex_sync` (`auto_sync_enabled`);--> statement-breakpoint
CREATE TABLE `pages` (
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
CREATE INDEX `pages_chapter_id_idx` ON `pages` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `pages_page_number_idx` ON `pages` (`page_number`);--> statement-breakpoint
CREATE TABLE `collection_manga` (
	`collection_id` text NOT NULL,
	`manga_id` text NOT NULL,
	`added_at` integer,
	PRIMARY KEY(`collection_id`, `manga_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`cover_url` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reading_progress` (
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
CREATE INDEX `reading_progress_user_manga_idx` ON `reading_progress` (`user_id`,`manga_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reading_progress_user_chapter_idx` ON `reading_progress` (`user_id`,`chapter_id`);--> statement-breakpoint
CREATE TABLE `processed_jobs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`processed_at` integer NOT NULL,
	`status` text NOT NULL,
	`metadata` text
);
