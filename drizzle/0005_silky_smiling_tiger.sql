ALTER TABLE `icloud_syncs` ADD `display_mode` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `icloud_syncs` ADD `is_hidden` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `icloud_syncs` ADD `hide_from_stats` integer DEFAULT false NOT NULL;