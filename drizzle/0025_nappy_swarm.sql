ALTER TABLE `system_settings` ADD `allow_guest_access` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `must_change_password` integer DEFAULT false NOT NULL;