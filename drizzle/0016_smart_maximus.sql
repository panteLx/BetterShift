CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`update_check_enabled` integer DEFAULT true NOT NULL,
	`update_banner_visibility` text DEFAULT 'all' NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
