CREATE TABLE `icloud_syncs` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`name` text NOT NULL,
	`icloud_url` text NOT NULL,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`last_synced_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `shifts` ADD `icloud_event_id` text;--> statement-breakpoint
ALTER TABLE `shifts` ADD `icloud_sync_id` text REFERENCES icloud_syncs(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `shifts` ADD `synced_from_icloud` integer DEFAULT false NOT NULL;