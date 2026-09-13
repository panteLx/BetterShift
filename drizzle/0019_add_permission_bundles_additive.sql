CREATE TABLE `calendar_permission_bundles` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`name` text NOT NULL,
	`capabilities` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_permission_bundles_calendarId_idx` ON `calendar_permission_bundles` (`calendar_id`);--> statement-breakpoint
ALTER TABLE `calendar_access_tokens` ADD `bundle_id` text REFERENCES calendar_permission_bundles(id);--> statement-breakpoint
ALTER TABLE `calendar_shares` ADD `bundle_id` text REFERENCES calendar_permission_bundles(id);--> statement-breakpoint
ALTER TABLE `calendars` ADD `guest_bundle_id` text;