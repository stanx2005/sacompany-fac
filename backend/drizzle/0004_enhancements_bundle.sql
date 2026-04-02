CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`details` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);

CREATE UNIQUE INDEX `app_settings_key_unique` ON `app_settings` (`key`);

ALTER TABLE `clients` ADD `archived` integer DEFAULT 0;
ALTER TABLE `sales_invoices` ADD `archived` integer DEFAULT 0;
