PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_calendar_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`token` text NOT NULL,
	`name` text,
	`bundle_id` text NOT NULL,
	`expires_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` integer,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bundle_id`) REFERENCES `calendar_permission_bundles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_calendar_access_tokens`("id", "calendar_id", "token", "name", "bundle_id", "expires_at", "created_by", "created_at", "last_used_at", "usage_count", "is_active") SELECT "id", "calendar_id", "token", "name", "bundle_id", "expires_at", "created_by", "created_at", "last_used_at", "usage_count", "is_active" FROM `calendar_access_tokens`;--> statement-breakpoint
DROP TABLE `calendar_access_tokens`;--> statement-breakpoint
ALTER TABLE `__new_calendar_access_tokens` RENAME TO `calendar_access_tokens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_access_tokens_token_unique` ON `calendar_access_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `calendar_access_tokens_token_idx` ON `calendar_access_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `calendar_access_tokens_calendarId_isActive_idx` ON `calendar_access_tokens` (`calendar_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `calendar_access_tokens_createdBy_idx` ON `calendar_access_tokens` (`created_by`);--> statement-breakpoint
CREATE TABLE `__new_calendar_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bundle_id` text NOT NULL,
	`shared_by` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bundle_id`) REFERENCES `calendar_permission_bundles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shared_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_calendar_shares`("id", "calendar_id", "user_id", "bundle_id", "shared_by", "created_at") SELECT "id", "calendar_id", "user_id", "bundle_id", "shared_by", "created_at" FROM `calendar_shares`;--> statement-breakpoint
DROP TABLE `calendar_shares`;--> statement-breakpoint
ALTER TABLE `__new_calendar_shares` RENAME TO `calendar_shares`;--> statement-breakpoint
CREATE INDEX `calendar_shares_calendarId_idx` ON `calendar_shares` (`calendar_id`);--> statement-breakpoint
CREATE INDEX `calendar_shares_userId_idx` ON `calendar_shares` (`user_id`);--> statement-breakpoint
ALTER TABLE `calendar_notes` ADD `created_by` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `calendar_permission_bundles` ADD `seed_key` text;--> statement-breakpoint
ALTER TABLE `shift_presets` ADD `created_by` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `shifts` ADD `created_by` text REFERENCES user(id);