ALTER TABLE `calendar_notes` ADD `type` text DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_notes` ADD `color` text;--> statement-breakpoint
ALTER TABLE `calendar_notes` ADD `recurring_pattern` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_notes` ADD `recurring_interval` integer;