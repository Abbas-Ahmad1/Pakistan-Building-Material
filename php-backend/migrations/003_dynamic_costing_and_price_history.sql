-- =========================================================================
-- Migration 003: Dynamic Product Cost, Price History & Automatic Pricing
-- =========================================================================

-- 1. Extend products table with pricing modes, markup/margin rules, and tracking
ALTER TABLE `products` 
  ADD COLUMN `previous_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `purchase_price`,
  ADD COLUMN `cost_change_percent` DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER `previous_cost`,
  ADD COLUMN `pricing_mode` ENUM('FIXED', 'MARKUP', 'MARGIN') NOT NULL DEFAULT 'FIXED' AFTER `wholesale_price`,
  ADD COLUMN `markup_percentage` DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER `pricing_mode`,
  ADD COLUMN `margin_percentage` DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER `markup_percentage`,
  ADD COLUMN `auto_price_update` TINYINT(1) NOT NULL DEFAULT 0 AFTER `margin_percentage`,
  ADD COLUMN `last_cost_update` DATETIME NULL AFTER `auto_price_update`,
  ADD COLUMN `weighted_avg_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `last_cost_update`;

-- Initialize previous_cost and weighted_avg_cost to current purchase_price
UPDATE `products` SET `previous_cost` = `purchase_price`, `weighted_avg_cost` = `purchase_price` WHERE `purchase_price` > 0;

-- 2. Create inventory_batches table for batch tracking and FIFO / AVCO costing
CREATE TABLE IF NOT EXISTS `inventory_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `branch_id` INT NOT NULL DEFAULT 1,
  `supplier_id` INT NULL,
  `purchase_id` INT NULL,
  `batch_number` VARCHAR(100) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `initial_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `remaining_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `received_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_batch_product_branch_rem` (`product_id`, `branch_id`, `remaining_quantity`),
  INDEX `idx_batch_purchase` (`purchase_id`),
  INDEX `idx_batch_number` (`batch_number`),
  CONSTRAINT `fk_batches_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_batches_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_batches_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_batches_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create inventory_batch_transactions table for auditing batch layer deductions/replenishments
CREATE TABLE IF NOT EXISTS `inventory_batch_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT NOT NULL,
  `transaction_type` VARCHAR(50) NOT NULL COMMENT 'PURCHASE, SALE, SALE_RETURN, PURCHASE_RETURN, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT',
  `reference_type` VARCHAR(50) NOT NULL COMMENT 'INVOICE, PURCHASE_ORDER, RETURN, TRANSFER, ADJUSTMENT',
  `reference_id` INT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL,
  `remaining_quantity_after` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_batch_tx_batch` (`batch_id`),
  INDEX `idx_batch_tx_ref` (`reference_type`, `reference_id`),
  CONSTRAINT `fk_batch_tx_batch` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create product_price_history table for historical tracking of cost and selling price changes
CREATE TABLE IF NOT EXISTS `product_price_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `branch_id` INT NULL,
  `old_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `new_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cost_change_percent` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `old_selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `new_selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `price_change_percent` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `pricing_mode` VARCHAR(50) NOT NULL DEFAULT 'FIXED',
  `reason` TEXT NOT NULL,
  `user_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_price_history_product` (`product_id`, `created_at`),
  CONSTRAINT `fk_price_hist_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_price_hist_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Add default system costing method setting (FIFO by default, with option for WEIGHTED_AVERAGE)
INSERT INTO `settings` (`key`, `value`) 
VALUES ('inventory_costing_method', 'FIFO')
ON DUPLICATE KEY UPDATE `value` = `value`;

-- 6. Initial Seed: Create legacy opening batches for existing stock so existing inventory works seamlessly with FIFO
INSERT INTO `inventory_batches` (
  `product_id`, `branch_id`, `supplier_id`, `purchase_id`, `batch_number`,
  `unit_cost`, `initial_quantity`, `remaining_quantity`, `received_date`, `notes`
)
SELECT 
  bs.`product_id`,
  bs.`branch_id`,
  p.`supplier_id`,
  NULL,
  CONCAT('BATCH-INIT-', bs.`branch_id`, '-', bs.`product_id`),
  p.`purchase_price`,
  bs.`current_stock`,
  bs.`current_stock`,
  NOW(),
  'Initial opening stock layer from system migration'
FROM `branch_stocks` bs
INNER JOIN `products` p ON bs.`product_id` = p.`id`
WHERE bs.`current_stock` > 0;
