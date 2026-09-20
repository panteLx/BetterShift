CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`tone` text DEFAULT 'info' NOT NULL,
	`show_on_auth` integer DEFAULT true NOT NULL,
	`show_on_dashboard` integer DEFAULT true NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
