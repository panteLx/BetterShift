CREATE TABLE `calendar_custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`options` text,
	`required` integer DEFAULT false NOT NULL,
	`show_in_calendar` integer DEFAULT false NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `calendar_custom_fields_calendarId_idx` ON `calendar_custom_fields` (`calendar_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_custom_fields_calendarId_key_idx` ON `calendar_custom_fields` (`calendar_id`,`key`);--> statement-breakpoint
CREATE TABLE `preset_custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`preset_id`) REFERENCES `shift_presets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `calendar_custom_fields`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `preset_custom_field_values_presetId_idx` ON `preset_custom_field_values` (`preset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `preset_custom_field_values_presetId_fieldId_idx` ON `preset_custom_field_values` (`preset_id`,`field_id`);--> statement-breakpoint
CREATE TABLE `shift_custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `calendar_custom_fields`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shift_custom_field_values_shiftId_idx` ON `shift_custom_field_values` (`shift_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shift_custom_field_values_shiftId_fieldId_idx` ON `shift_custom_field_values` (`shift_id`,`field_id`);