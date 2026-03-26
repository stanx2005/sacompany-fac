CREATE TABLE `cheque_registry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cheque_number` text NOT NULL,
	`bank_name` text,
	`amount` real NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending',
	`client_id` integer,
	`supplier_id` integer,
	`created_at` integer DEFAULT '"2026-03-18T06:22:55.737Z"',
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`tax_number` text,
	`created_at` integer DEFAULT '"2026-03-18T06:22:55.736Z"'
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer,
	`product_id` integer,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`tax_rate` real NOT NULL,
	`total_line` real NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `open_tabs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer,
	`product_id` integer,
	`quantity` integer NOT NULL,
	`date` text NOT NULL,
	`is_closed` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2026-03-18T06:22:55.738Z"',
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`tax_rate` real DEFAULT 19,
	`stock` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2026-03-18T06:22:55.736Z"'
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`supplier_id` integer,
	`date` text NOT NULL,
	`total_incl_tax` real NOT NULL,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT '"2026-03-18T06:22:55.737Z"',
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_order_number_unique` ON `purchase_orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `sales_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`client_id` integer,
	`date` text NOT NULL,
	`total_excl_tax` real NOT NULL,
	`total_tax` real NOT NULL,
	`total_incl_tax` real NOT NULL,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT '"2026-03-18T06:22:55.737Z"',
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_invoices_invoice_number_unique` ON `sales_invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`tax_number` text,
	`created_at` integer DEFAULT '"2026-03-18T06:22:55.736Z"'
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'staff',
	`created_at` integer DEFAULT '"2026-03-18T06:22:55.735Z"'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);