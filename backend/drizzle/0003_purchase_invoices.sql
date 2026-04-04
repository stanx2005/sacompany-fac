-- Factures fournisseur (achat) — aussi créée au démarrage via ensureAuxiliarySchema si absent.
CREATE TABLE IF NOT EXISTS `purchase_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer,
	`invoice_number` text NOT NULL,
	`date` text NOT NULL,
	`total_excl_tax` real DEFAULT 0 NOT NULL,
	`total_tax` real DEFAULT 0 NOT NULL,
	`total_incl_tax` real DEFAULT 0 NOT NULL,
	`source_type` text NOT NULL,
	`file_path` text,
	`file_mime` text,
	`original_filename` text,
	`notes` text,
	`status` text DEFAULT 'pending',
	`created_at` integer,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
