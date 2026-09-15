CREATE TABLE `preset_time_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`preset_id`) REFERENCES `shift_presets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `preset_time_segments_presetId_idx` ON `preset_time_segments` (`preset_id`);--> statement-breakpoint
CREATE TABLE `shift_time_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shift_time_segments_shiftId_idx` ON `shift_time_segments` (`shift_id`);--> statement-breakpoint
ALTER TABLE `calendars` ADD `split_shifts_enabled` integer DEFAULT false NOT NULL;