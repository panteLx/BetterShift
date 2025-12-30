CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`is_user_visible` integer DEFAULT false NOT NULL,
	`timestamp` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_userId_timestamp_idx` ON `audit_logs` (`user_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_timestamp_idx` ON `audit_logs` (`action`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_logs_userVisible_userId_timestamp_idx` ON `audit_logs` (`is_user_visible`,`user_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `calendar_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`token` text NOT NULL,
	`name` text,
	`permission` text DEFAULT 'read' NOT NULL,
	`expires_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` integer,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_access_tokens_token_unique` ON `calendar_access_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `calendar_access_tokens_token_idx` ON `calendar_access_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `calendar_access_tokens_calendarId_isActive_idx` ON `calendar_access_tokens` (`calendar_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `calendar_access_tokens_createdBy_idx` ON `calendar_access_tokens` (`created_by`);--> statement-breakpoint
CREATE TABLE `calendar_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`user_id` text NOT NULL,
	`permission` text DEFAULT 'read' NOT NULL,
	`shared_by` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_shares_calendarId_idx` ON `calendar_shares` (`calendar_id`);--> statement-breakpoint
CREATE INDEX `calendar_shares_userId_idx` ON `calendar_shares` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_calendar_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`calendar_id` text NOT NULL,
	`status` text DEFAULT 'subscribed' NOT NULL,
	`source` text DEFAULT 'guest' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_calendar_subscriptions_userId_idx` ON `user_calendar_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_calendar_subscriptions_calendarId_idx` ON `user_calendar_subscriptions` (`calendar_id`);--> statement-breakpoint
CREATE INDEX `user_calendar_subscriptions_status_idx` ON `user_calendar_subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
ALTER TABLE `calendars` ADD `owner_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `calendars` ADD `guest_permission` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
CREATE INDEX `calendars_ownerId_idx` ON `calendars` (`owner_id`);--> statement-breakpoint
ALTER TABLE `calendars` DROP COLUMN `password_hash`;--> statement-breakpoint
ALTER TABLE `calendars` DROP COLUMN `is_locked`;