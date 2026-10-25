PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`owner_id` text,
	`guest_bundle_id` text,
	`signups_enabled` integer DEFAULT true NOT NULL,
	`split_shifts_enabled` integer DEFAULT false NOT NULL,
	`workspace_id` text NOT NULL,
	`view_settings` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_calendars`("id", "name", "color", "owner_id", "guest_bundle_id", "signups_enabled", "split_shifts_enabled", "workspace_id", "view_settings", "created_at", "updated_at") SELECT "id", "name", "color", "owner_id", "guest_bundle_id", "signups_enabled", "split_shifts_enabled", "workspace_id", "view_settings", "created_at", "updated_at" FROM `calendars`;--> statement-breakpoint
DROP TABLE `calendars`;--> statement-breakpoint
ALTER TABLE `__new_calendars` RENAME TO `calendars`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `calendars_ownerId_idx` ON `calendars` (`owner_id`);--> statement-breakpoint
CREATE INDEX `calendars_workspaceId_idx` ON `calendars` (`workspace_id`);