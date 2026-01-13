CREATE TABLE `project_export` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file_key` text NOT NULL,
	`format` text DEFAULT 'mp3' NOT NULL,
	`duration_seconds` integer NOT NULL,
	`is_latest` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_export_file_key_unique` ON `project_export` (`file_key`);--> statement-breakpoint
CREATE INDEX `project_export_project_id_idx` ON `project_export` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_export_latest_idx` ON `project_export` (`project_id`,`is_latest`);