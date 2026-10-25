CREATE TABLE `workspace_join_links` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`token` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'member' NOT NULL,
	`expires_at` integer,
	`max_uses` integer,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`revoked_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_join_links_token_unique` ON `workspace_join_links` (`token`);--> statement-breakpoint
CREATE INDEX `workspace_join_links_workspaceId_idx` ON `workspace_join_links` (`workspace_id`);