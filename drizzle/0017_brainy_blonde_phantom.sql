CREATE TABLE `shift_signups` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`user_id` text NOT NULL,
	`signed_up_by` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`signed_up_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shift_signups_shiftId_idx` ON `shift_signups` (`shift_id`);--> statement-breakpoint
CREATE INDEX `shift_signups_userId_idx` ON `shift_signups` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shift_signups_shiftId_userId_idx` ON `shift_signups` (`shift_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `calendars` ADD `allow_self_signup` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `shift_presets` ADD `default_signup_capacity` integer;--> statement-breakpoint
ALTER TABLE `shifts` ADD `signup_capacity` integer;