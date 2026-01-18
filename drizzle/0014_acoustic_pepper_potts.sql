CREATE TABLE `registration_whitelist` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern` text NOT NULL,
	`pattern_type` text DEFAULT 'email' NOT NULL,
	`added_by` text,
	`used_at` integer,
	`used_by_user_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registration_whitelist_pattern_unique` ON `registration_whitelist` (`pattern`);--> statement-breakpoint
CREATE INDEX `registration_whitelist_pattern_idx` ON `registration_whitelist` (`pattern`);--> statement-breakpoint
CREATE INDEX `registration_whitelist_patternType_idx` ON `registration_whitelist` (`pattern_type`);