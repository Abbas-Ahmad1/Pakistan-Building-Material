-- ============================================================================
-- Hardware Store POS & ERP - Production Database Schema for MySQL 8+
-- Engineered for High-Concurrency, Transactional Financial Integrity & UTF8MB4
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- 1. ROLES
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BRANCHES (Multi-location POS)
DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL UNIQUE,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `manager_name` VARCHAR(100) DEFAULT NULL,
  `is_main` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_branches_code` (`code`),
  INDEX `idx_branches_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. USERS
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_id` INT NOT NULL,
  `branch_id` INT DEFAULT 1,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role_id`),
  INDEX `idx_users_branch` (`branch_id`),
  INDEX `idx_users_status` (`status`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `fk_users_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. USER SESSIONS & TOKENS (Database-Backed Persistent Authentication)
DROP TABLE IF EXISTS `user_sessions`;
CREATE TABLE `user_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `token` VARCHAR(128) NOT NULL UNIQUE,
  `user_id` INT NOT NULL,
  `branch_id` INT DEFAULT 1,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sessions_token` (`token`),
  INDEX `idx_sessions_user` (`user_id`),
  INDEX `idx_sessions_expires` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sessions_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. CATEGORIES
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_categories_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. SUBCATEGORIES
DROP TABLE IF EXISTS `subcategories`;
CREATE TABLE `subcategories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_subcategories_category` (`category_id`),
  CONSTRAINT `fk_subcategories_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. SUPPLIERS
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `company` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `total_purchases` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payable_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_suppliers_company` (`company`),
  INDEX `idx_suppliers_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. PRODUCTS
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sku` VARCHAR(100) NOT NULL UNIQUE,
  `barcode` VARCHAR(100) DEFAULT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `category_id` INT NOT NULL,
  `subcategory_id` INT DEFAULT NULL,
  `brand` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `unit` VARCHAR(30) NOT NULL DEFAULT 'Piece',
  `purchase_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `wholesale_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `current_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `minimum_stock` DECIMAL(12,2) NOT NULL DEFAULT 5.00,
  `supplier_id` INT DEFAULT NULL,
  `image_url` TEXT DEFAULT NULL,
  `status` ENUM('active', 'inactive', 'discontinued') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_products_sku` (`sku`),
  INDEX `idx_products_barcode` (`barcode`),
  INDEX `idx_products_name` (`name`),
  INDEX `idx_products_category` (`category_id`),
  INDEX `idx_products_supplier` (`supplier_id`),
  INDEX `idx_products_status` (`status`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  CONSTRAINT `fk_products_subcategory` FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. BRANCH STOCKS (Location-specific stock matrix)
DROP TABLE IF EXISTS `branch_stocks`;
CREATE TABLE `branch_stocks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `branch_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `current_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `minimum_stock` DECIMAL(12,2) NOT NULL DEFAULT 5.00,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_branch_product` (`branch_id`, `product_id`),
  INDEX `idx_branch_stocks_branch` (`branch_id`),
  INDEX `idx_branch_stocks_product` (`product_id`),
  CONSTRAINT `fk_branch_stocks_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_branch_stocks_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. STOCK TRANSFERS
DROP TABLE IF EXISTS `stock_transfers`;
CREATE TABLE `stock_transfers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transfer_number` VARCHAR(100) NOT NULL UNIQUE,
  `from_branch_id` INT NOT NULL,
  `to_branch_id` INT NOT NULL,
  `transfer_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('COMPLETED', 'PENDING', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
  `notes` TEXT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_transfers_from` (`from_branch_id`),
  INDEX `idx_transfers_to` (`to_branch_id`),
  CONSTRAINT `fk_transfers_from` FOREIGN KEY (`from_branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_transfers_to` FOREIGN KEY (`to_branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_transfers_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. STOCK TRANSFER ITEMS
DROP TABLE IF EXISTS `stock_transfer_items`;
CREATE TABLE `stock_transfer_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transfer_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_transfer_items_transfer` (`transfer_id`),
  INDEX `idx_transfer_items_product` (`product_id`),
  CONSTRAINT `fk_transfer_items_transfer` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_transfer_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. CASH DRAWER SHIFTS
DROP TABLE IF EXISTS `cash_drawer_shifts`;
CREATE TABLE `cash_drawer_shifts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shift_code` VARCHAR(100) NOT NULL UNIQUE,
  `branch_id` INT NOT NULL,
  `cashier_id` INT NOT NULL,
  `cashier_name` VARCHAR(100) NOT NULL,
  `opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` DATETIME DEFAULT NULL,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `opening_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cash_sales_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `other_sales_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_sales_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cash_refunds_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `drawer_expenses_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `expected_closing_cash` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `actual_closing_cash` DECIMAL(12,2) DEFAULT NULL,
  `cash_difference` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `closing_notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_shifts_branch` (`branch_id`),
  INDEX `idx_shifts_cashier` (`cashier_id`),
  INDEX `idx_shifts_status` (`status`),
  CONSTRAINT `fk_shifts_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_shifts_cashier` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. DRAWER EXPENSES (Petty cash out of register)
DROP TABLE IF EXISTS `drawer_expenses`;
CREATE TABLE `drawer_expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shift_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `cashier_id` INT NOT NULL,
  `cashier_name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `note` TEXT NOT NULL,
  `paid_to` VARCHAR(150) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_drawer_expenses_shift` (`shift_id`),
  INDEX `idx_drawer_expenses_branch` (`branch_id`),
  CONSTRAINT `fk_drawer_exp_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_drawer_shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_drawer_exp_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_drawer_exp_cashier` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. CUSTOMERS (Khata Ledger Accounts)
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `credit_limit` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_purchases` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_paid` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `outstanding_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `is_walk_in` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_customers_name` (`name`),
  INDEX `idx_customers_phone` (`phone`),
  INDEX `idx_customers_balance` (`outstanding_balance`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. CUSTOMER PAYMENTS
DROP TABLE IF EXISTS `customer_payments`;
CREATE TABLE `customer_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `sale_id` INT DEFAULT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL,
  `payment_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reference_no` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `received_by` INT DEFAULT NULL,
  INDEX `idx_cust_payments_customer` (`customer_id`),
  INDEX `idx_cust_payments_sale` (`sale_id`),
  CONSTRAINT `fk_cust_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_cust_payments_user` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. PURCHASES (Stock Inwards)
DROP TABLE IF EXISTS `purchases`;
CREATE TABLE `purchases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_number` VARCHAR(100) NOT NULL UNIQUE,
  `supplier_id` INT NOT NULL,
  `purchase_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(14,2) NOT NULL,
  `paid_amount` DECIMAL(14,2) NOT NULL,
  `due_amount` DECIMAL(14,2) NOT NULL,
  `payment_status` ENUM('PAID', 'PARTIAL', 'DUE') NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_purchases_supplier` (`supplier_id`),
  INDEX `idx_purchases_date` (`purchase_date`),
  CONSTRAINT `fk_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `fk_purchases_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. PURCHASE ITEMS
DROP TABLE IF EXISTS `purchase_items`;
CREATE TABLE `purchase_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL,
  `line_total` DECIMAL(14,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_purchase_items_purchase` (`purchase_id`),
  INDEX `idx_purchase_items_product` (`product_id`),
  CONSTRAINT `fk_purchase_items_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_purchase_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. SUPPLIER PAYMENTS
DROP TABLE IF EXISTS `supplier_payments`;
CREATE TABLE `supplier_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `supplier_id` INT NOT NULL,
  `purchase_id` INT DEFAULT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL,
  `payment_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reference_no` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `paid_by` INT DEFAULT NULL,
  INDEX `idx_sup_payments_supplier` (`supplier_id`),
  INDEX `idx_sup_payments_purchase` (`purchase_id`),
  CONSTRAINT `fk_sup_payments_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `fk_sup_payments_user` FOREIGN KEY (`paid_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. SALES (Invoices)
DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_number` VARCHAR(100) NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `sale_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(14,2) NOT NULL,
  `original_grand_total` DECIMAL(14,2) DEFAULT NULL,
  `net_total` DECIMAL(14,2) DEFAULT NULL,
  `returned_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `cogs_total` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `gross_profit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `due_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(50) NOT NULL,
  `payment_status` ENUM('PAID', 'PARTIAL', 'DUE') NOT NULL,
  `cashier_id` INT NOT NULL,
  `cashier_name` VARCHAR(100) DEFAULT NULL,
  `branch_id` INT DEFAULT 1,
  `shift_id` INT DEFAULT NULL,
  `delivery_status` VARCHAR(30) NOT NULL DEFAULT 'DELIVERED',
  `loading_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sales_invoice` (`invoice_number`),
  INDEX `idx_sales_customer` (`customer_id`),
  INDEX `idx_sales_cashier` (`cashier_id`),
  INDEX `idx_sales_branch` (`branch_id`),
  INDEX `idx_sales_shift` (`shift_id`),
  INDEX `idx_sales_date` (`sale_date`),
  INDEX `idx_sales_status` (`payment_status`),
  CONSTRAINT `fk_sales_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_sales_cashier` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_sales_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_drawer_shifts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. SALE ITEMS
DROP TABLE IF EXISTS `sale_items`;
CREATE TABLE `sale_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(14,2) NOT NULL,
  `line_profit` DECIMAL(14,2) NOT NULL,
  `returned_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `remaining_quantity` DECIMAL(12,2) DEFAULT NULL,
  `delivered_quantity` DECIMAL(12,2) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sale_items_sale` (`sale_id`),
  INDEX `idx_sale_items_product` (`product_id`),
  CONSTRAINT `fk_sale_items_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sale_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. SALE DELIVERY LOGS (Remaining pickup batches)
DROP TABLE IF EXISTS `sale_delivery_logs`;
CREATE TABLE `sale_delivery_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `sale_item_id` INT NOT NULL,
  `delivered_quantity` DECIMAL(12,2) NOT NULL,
  `total_delivered_after` DECIMAL(12,2) NOT NULL,
  `remaining_after` DECIMAL(12,2) NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `recorded_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_delivery_sale` (`sale_id`),
  INDEX `idx_delivery_item` (`sale_item_id`),
  CONSTRAINT `fk_del_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_del_item` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. SALES RETURNS
DROP TABLE IF EXISTS `sales_returns`;
CREATE TABLE `sales_returns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `return_number` VARCHAR(100) NOT NULL UNIQUE,
  `sale_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `total_refund_amount` DECIMAL(14,2) NOT NULL,
  `refund_type` ENUM('CASH_REFUND', 'LEDGER_ADJUSTMENT', 'MIXED') NOT NULL,
  `cash_refund_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `ledger_credit_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `reason` TEXT DEFAULT NULL,
  `processed_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_returns_sale` (`sale_id`),
  INDEX `idx_returns_customer` (`customer_id`),
  CONSTRAINT `fk_returns_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`),
  CONSTRAINT `fk_returns_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_returns_user` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. SALES RETURN ITEMS
DROP TABLE IF EXISTS `sales_return_items`;
CREATE TABLE `sales_return_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `return_id` INT NOT NULL,
  `sale_item_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `returned_quantity` DECIMAL(12,2) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `refund_line_total` DECIMAL(14,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ret_items_return` (`return_id`),
  INDEX `idx_ret_items_sale_item` (`sale_item_id`),
  INDEX `idx_ret_items_product` (`product_id`),
  CONSTRAINT `fk_ret_items_return` FOREIGN KEY (`return_id`) REFERENCES `sales_returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ret_items_sale_item` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items` (`id`),
  CONSTRAINT `fk_ret_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. INVENTORY TRANSACTIONS (Stock Audit Ledger)
DROP TABLE IF EXISTS `inventory_transactions`;
CREATE TABLE `inventory_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `transaction_type` ENUM('PURCHASE', 'SALE', 'PURCHASE_RETURN', 'SALE_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT') NOT NULL,
  `reference_type` VARCHAR(50) NOT NULL,
  `reference_id` INT DEFAULT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `stock_before` DECIMAL(12,2) NOT NULL,
  `stock_after` DECIMAL(12,2) NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `branch_id` INT DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_inv_tx_product` (`product_id`),
  INDEX `idx_inv_tx_type` (`transaction_type`),
  INDEX `idx_inv_tx_branch` (`branch_id`),
  INDEX `idx_inv_tx_date` (`created_at`),
  CONSTRAINT `fk_inv_tx_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_inv_tx_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv_tx_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. EXPENSES
DROP TABLE IF EXISTS `expenses`;
CREATE TABLE `expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `expense_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'Cash',
  `description` TEXT DEFAULT NULL,
  `recorded_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_expenses_category` (`category`),
  INDEX `idx_expenses_date` (`expense_date`),
  CONSTRAINT `fk_expenses_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. QUOTATIONS (Estimates / Bids)
DROP TABLE IF EXISTS `quotations`;
CREATE TABLE `quotations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quotation_number` VARCHAR(100) NOT NULL UNIQUE,
  `customer_id` INT DEFAULT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_phone` VARCHAR(50) DEFAULT NULL,
  `project_title` VARCHAR(200) DEFAULT NULL,
  `valid_until` DATE DEFAULT NULL,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(14,2) NOT NULL,
  `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'EXPIRED') NOT NULL DEFAULT 'SENT',
  `notes` TEXT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_quotations_status` (`status`),
  INDEX `idx_quotations_customer` (`customer_id`),
  CONSTRAINT `fk_quotations_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quotations_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. QUOTATION ITEMS
DROP TABLE IF EXISTS `quotation_items`;
CREATE TABLE `quotation_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quotation_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `line_total` DECIMAL(14,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_quotation_items_q` (`quotation_id`),
  INDEX `idx_quotation_items_p` (`product_id`),
  CONSTRAINT `fk_q_items_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_q_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. ZAKAT RECORDS (Annual Islamic Wealth Assessment)
DROP TABLE IF EXISTS `zakat_records`;
CREATE TABLE `zakat_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `fiscal_year` VARCHAR(50) NOT NULL,
  `cash_balance` DECIMAL(14,2) NOT NULL,
  `bank_balance` DECIMAL(14,2) NOT NULL,
  `inventory_value` DECIMAL(14,2) NOT NULL,
  `receivables_value` DECIMAL(14,2) NOT NULL,
  `liabilities_value` DECIMAL(14,2) NOT NULL,
  `net_zakatable_amount` DECIMAL(14,2) NOT NULL,
  `zakat_rate` DECIMAL(5,2) NOT NULL DEFAULT 2.50,
  `calculated_zakat` DECIMAL(14,2) NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 29. SETTINGS (Store Configuration)
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 30. AUDIT LOGS
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `record_id` INT DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_module` (`module`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_date` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
