ALTER TABLE `products` ADD COLUMN `purchase_price` real DEFAULT 0;
--> statement-breakpoint
UPDATE `products`
SET `purchase_price` = COALESCE(`purchase_price`, `price`, 0);
