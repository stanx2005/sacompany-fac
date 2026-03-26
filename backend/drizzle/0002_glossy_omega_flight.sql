CREATE TABLE `quote_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_id` integer,
	`product_id` integer,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`tax_rate` real NOT NULL,
	`total_line` real NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_number` text NOT NULL,
	`client_id` integer,
	`date` text NOT NULL,
	`total_excl_tax` real NOT NULL,
	`total_tax` real NOT NULL,
	`total_incl_tax` real NOT NULL,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.998Z"',
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_quote_number_unique` ON `quotes` (`quote_number`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cheque_registry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cheque_number` text NOT NULL,
	`bank_name` text,
	`amount` real NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending',
	`is_paid` integer DEFAULT 0,
	`client_id` integer,
	`supplier_id` integer,
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.998Z"',
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_cheque_registry`("id", "cheque_number", "bank_name", "amount", "issue_date", "due_date", "type", "status", "is_paid", "client_id", "supplier_id", "created_at") SELECT "id", "cheque_number", "bank_name", "amount", "issue_date", "due_date", "type", "status", "is_paid", "client_id", "supplier_id", "created_at" FROM `cheque_registry`;--> statement-breakpoint
DROP TABLE `cheque_registry`;--> statement-breakpoint
ALTER TABLE `__new_cheque_registry` RENAME TO `cheque_registry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`tax_number` text,
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.996Z"'
);
--> statement-breakpoint
INSERT INTO `__new_clients`("id", "name", "email", "phone", "address", "tax_number", "created_at") SELECT "id", "name", "email", "phone", "address", "tax_number", "created_at" FROM `clients`;--> statement-breakpoint
DROP TABLE `clients`;--> statement-breakpoint
ALTER TABLE `__new_clients` RENAME TO `clients`;--> statement-breakpoint
CREATE TABLE `__new_delivery_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_number` text NOT NULL,
	`client_id` integer,
	`date` text NOT NULL,
	`total_incl_tax` real NOT NULL,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.997Z"',
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_delivery_notes`("id", "note_number", "client_id", "date", "total_incl_tax", "status", "created_at") SELECT "id", "note_number", "client_id", "date", "total_incl_tax", "status", "created_at" FROM `delivery_notes`;--> statement-breakpoint
DROP TABLE `delivery_notes`;--> statement-breakpoint
ALTER TABLE `__new_delivery_notes` RENAME TO `delivery_notes`;--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_notes_note_number_unique` ON `delivery_notes` (`note_number`);--> statement-breakpoint
CREATE TABLE `__new_open_tabs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer,
	`product_id` integer,
	`quantity` integer NOT NULL,
	`date` text NOT NULL,
	`is_closed` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.998Z"',
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_open_tabs`("id", "client_id", "product_id", "quantity", "date", "is_closed", "created_at") SELECT "id", "client_id", "product_id", "quantity", "date", "is_closed", "created_at" FROM `open_tabs`;--> statement-breakpoint
DROP TABLE `open_tabs`;--> statement-breakpoint
ALTER TABLE `__new_open_tabs` RENAME TO `open_tabs`;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`tax_rate` real DEFAULT 20,
	`stock` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.996Z"'
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "description", "price", "tax_rate", "stock", "created_at") SELECT "id", "name", "description", "price", "tax_rate", "stock", "created_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE TABLE `__new_purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`supplier_id` integer,
	`date` text NOT NULL,
	`total_incl_tax` real NOT NULL,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.998Z"',
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_purchase_orders`("id", "order_number", "supplier_id", "date", "total_incl_tax", "status", "created_at") SELECT "id", "order_number", "supplier_id", "date", "total_incl_tax", "status", "created_at" FROM `purchase_orders`;--> statement-breakpoint
DROP TABLE `purchase_orders`;--> statement-breakpoint
ALTER TABLE `__new_purchase_orders` RENAME TO `purchase_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_order_number_unique` ON `purchase_orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `__new_sales_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`client_id` integer,
	`date` text NOT NULL,
	`total_excl_tax` real NOT NULL,
	`total_tax` real NOT NULL,
	`total_incl_tax` real NOT NULL,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.997Z"',
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sales_invoices`("id", "invoice_number", "client_id", "date", "total_excl_tax", "total_tax", "total_incl_tax", "status", "created_at") SELECT "id", "invoice_number", "client_id", "date", "total_excl_tax", "total_tax", "total_incl_tax", "status", "created_at" FROM `sales_invoices`;--> statement-breakpoint
DROP TABLE `sales_invoices`;--> statement-breakpoint
ALTER TABLE `__new_sales_invoices` RENAME TO `sales_invoices`;--> statement-breakpoint
CREATE UNIQUE INDEX `sales_invoices_invoice_number_unique` ON `sales_invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `__new_suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`tax_number` text,
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.996Z"'
);
--> statement-breakpoint
INSERT INTO `__new_suppliers`("id", "name", "email", "phone", "address", "tax_number", "created_at") SELECT "id", "name", "email", "phone", "address", "tax_number", "created_at" FROM `suppliers`;--> statement-breakpoint
DROP TABLE `suppliers`;--> statement-breakpoint
ALTER TABLE `__new_suppliers` RENAME TO `suppliers`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'staff',
	`company_name` text DEFAULT 'SA COMPANY',
	`company_ice` text DEFAULT '000000000000000',
	`company_address` text DEFAULT 'Votre Adresse Ici, Casablanca',
	`company_email` text DEFAULT 'contact@sacompany.ma',
	`company_phone` text DEFAULT '+212 5XX XX XX XX',
	`company_rib` text DEFAULT '000 000 0000000000000000 00',
	`created_at` integer DEFAULT '"2026-03-26T12:50:07.994Z"'
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "email", "password", "role", "company_name", "company_ice", "company_address", "company_email", "company_phone", "company_rib", "created_at") SELECT "id", "name", "email", "password", "role", "company_name", "company_ice", "company_address", "company_email", "company_phone", "company_rib", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `date` text;