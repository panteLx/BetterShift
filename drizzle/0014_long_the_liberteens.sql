CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`view_settings` text,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `calendars` ADD `view_settings` text;