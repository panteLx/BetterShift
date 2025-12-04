PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `icloud_syncs` RENAME TO `external_syncs`;--> statement-breakpoint
ALTER TABLE `external_syncs` RENAME COLUMN "icloud_url" TO "calendar_url";--> statement-breakpoint
CREATE TABLE `__new_external_syncs` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`name` text NOT NULL,
	`sync_type` text DEFAULT 'icloud' NOT NULL,
	`calendar_url` text NOT NULL,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`display_mode` text DEFAULT 'normal' NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`hide_from_stats` integer DEFAULT false NOT NULL,
	`auto_sync_interval` integer DEFAULT 0 NOT NULL,
	`last_synced_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_external_syncs`("id", "calendar_id", "name", "sync_type", "calendar_url", "color", "display_mode", "is_hidden", "hide_from_stats", "auto_sync_interval", "last_synced_at", "created_at", "updated_at") SELECT "id", "calendar_id", "name", 'icloud', "calendar_url", "color", "display_mode", "is_hidden", "hide_from_stats", "auto_sync_interval", "last_synced_at", "created_at", "updated_at" FROM `external_syncs`;--> statement-breakpoint
DROP TABLE `external_syncs`;--> statement-breakpoint
ALTER TABLE `__new_external_syncs` RENAME TO `external_syncs`;--> statement-breakpoint
CREATE TABLE `__new_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`preset_id` text,
	`date` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`title` text NOT NULL,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`notes` text,
	`is_all_day` integer DEFAULT false NOT NULL,
	`is_secondary` integer DEFAULT false NOT NULL,
	`external_event_id` text,
	`external_sync_id` text,
	`synced_from_external` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`preset_id`) REFERENCES `shift_presets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`external_sync_id`) REFERENCES `external_syncs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_shifts`("id", "calendar_id", "preset_id", "date", "start_time", "end_time", "title", "color", "notes", "is_all_day", "is_secondary", "external_event_id", "external_sync_id", "synced_from_external", "created_at", "updated_at") SELECT "id", "calendar_id", "preset_id", "date", "start_time", "end_time", "title", "color", "notes", "is_all_day", "is_secondary", "icloud_event_id", "icloud_sync_id", "synced_from_icloud", "created_at", "updated_at" FROM `shifts`;--> statement-breakpoint
DROP TABLE `shifts`;--> statement-breakpoint
ALTER TABLE `__new_shifts` RENAME TO `shifts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;