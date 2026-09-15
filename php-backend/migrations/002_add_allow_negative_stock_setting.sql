-- Migration: 002_add_allow_negative_stock_setting
-- Description: Add configurable allow_negative_stock setting (default: false)

INSERT INTO `settings` (`key`, `value`, `updated_at`)
VALUES ('allow_negative_stock', 'false', NOW())
ON DUPLICATE KEY UPDATE `key` = `key`;
