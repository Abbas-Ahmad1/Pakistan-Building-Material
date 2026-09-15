-- =========================================================================
-- Migration 004: Batch-wise Selling Prices (Retail & Wholesale)
-- =========================================================================

-- Add retail_selling_price and wholesale_selling_price to inventory_batches
ALTER TABLE `inventory_batches`
  ADD COLUMN `retail_selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `unit_cost`,
  ADD COLUMN `wholesale_selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `retail_selling_price`;

-- Initialize batch selling prices from products table for any existing batches
UPDATE `inventory_batches` ib
JOIN `products` p ON ib.product_id = p.id
SET 
  ib.retail_selling_price = p.selling_price,
  ib.wholesale_selling_price = COALESCE(p.wholesale_price, p.selling_price)
WHERE ib.retail_selling_price = 0.00;
