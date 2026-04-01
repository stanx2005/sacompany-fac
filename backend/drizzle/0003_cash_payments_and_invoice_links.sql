ALTER TABLE `cheque_registry` ADD `invoice_id` integer REFERENCES `sales_invoices`(`id`);
--> statement-breakpoint
ALTER TABLE `cheque_registry` ADD `invoice_number` text;
--> statement-breakpoint
CREATE TABLE `cash_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_number` text NOT NULL,
	`invoice_id` integer,
	`client_id` integer,
	`amount` real NOT NULL,
	`payment_date` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT '"2026-04-01T00:00:00.000Z"',
	FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_payments_payment_number_unique` ON `cash_payments` (`payment_number`);
