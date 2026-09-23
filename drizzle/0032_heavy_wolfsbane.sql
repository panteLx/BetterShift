CREATE TABLE `calendar_feed_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`user_id` text,
	`token` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feed_tokens_token_unique` ON `calendar_feed_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `calendar_feed_tokens_calendarId_userId_idx` ON `calendar_feed_tokens` (`calendar_id`,`user_id`);