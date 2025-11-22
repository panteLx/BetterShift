ALTER TABLE `shift_presets` ADD `is_secondary` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shift_presets` ADD `is_all_day` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `is_all_day` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `is_secondary` integer DEFAULT false NOT NULL;
