PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_account` (
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_account`("id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "created_at", "updated_at") SELECT "id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "created_at", "updated_at" FROM `account`;--> statement-breakpoint
DROP TABLE `account`;--> statement-breakpoint
ALTER TABLE `__new_account` RENAME TO `account`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project`("id", "name", "owner_id", "created_at", "updated_at") SELECT "id", "name", "owner_id", "created_at", "updated_at" FROM `project`;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
CREATE TABLE `__new_project_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`token` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`max_uses` integer,
	`uses` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_project_invite`("id", "project_id", "token", "role", "created_by", "expires_at", "max_uses", "uses") SELECT "id", "project_id", "token", "role", "created_by", "expires_at", "max_uses", "uses" FROM `project_invite`;--> statement-breakpoint
DROP TABLE `project_invite`;--> statement-breakpoint
ALTER TABLE `__new_project_invite` RENAME TO `project_invite`;--> statement-breakpoint
CREATE UNIQUE INDEX `project_invite_token_unique` ON `project_invite` (`token`);--> statement-breakpoint
CREATE TABLE `__new_project_member` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `user_id`),
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project_member`("project_id", "user_id", "role", "joined_at") SELECT "project_id", "user_id", "role", "joined_at" FROM `project_member`;--> statement-breakpoint
DROP TABLE `project_member`;--> statement-breakpoint
ALTER TABLE `__new_project_member` RENAME TO `project_member`;--> statement-breakpoint
CREATE TABLE `__new_project_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`ydoc_snapshot` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project_snapshot`("id", "project_id", "ydoc_snapshot", "created_at") SELECT "id", "project_id", "ydoc_snapshot", "created_at" FROM `project_snapshot`;--> statement-breakpoint
DROP TABLE `project_snapshot`;--> statement-breakpoint
ALTER TABLE `__new_project_snapshot` RENAME TO `project_snapshot`;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_session`("id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id") SELECT "id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id" FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_anonymous` integer DEFAULT false
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "created_at", "updated_at", "is_anonymous") SELECT "id", "name", "email", "email_verified", "image", "created_at", "updated_at", "is_anonymous" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `__new_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_verification`("id", "identifier", "value", "expires_at", "created_at", "updated_at") SELECT "id", "identifier", "value", "expires_at", "created_at", "updated_at" FROM `verification`;--> statement-breakpoint
DROP TABLE `verification`;--> statement-breakpoint
ALTER TABLE `__new_verification` RENAME TO `verification`;--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);