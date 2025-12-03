ALTER TABLE `calendars` ADD `is_locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shift_presets` ADD `hide_from_stats` integer DEFAULT false NOT NULL;