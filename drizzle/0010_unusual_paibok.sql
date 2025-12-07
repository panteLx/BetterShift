CREATE TABLE `sync_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`external_sync_id` text NOT NULL,
	`external_sync_name` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`shifts_created` integer DEFAULT 0 NOT NULL,
	`shifts_updated` integer DEFAULT 0 NOT NULL,
	`shifts_deleted` integer DEFAULT 0 NOT NULL,
	`sync_type` text DEFAULT 'auto' NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`synced_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`external_sync_id`) REFERENCES `external_syncs`(`id`) ON UPDATE no action ON DELETE cascade
);
