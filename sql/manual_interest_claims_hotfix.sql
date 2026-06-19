-- Run this once only if runtime auto-migration cannot ALTER the table.
-- Purpose: make interest_claims compatible with staking claim/allocation logic.

SET @db_name := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='interest_claims' AND COLUMN_NAME='claimed_at') = 0,
  'ALTER TABLE `interest_claims` ADD COLUMN `claimed_at` DATETIME DEFAULT NULL AFTER `created_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='interest_claims' AND COLUMN_NAME='claim_batch_id') = 0,
  'ALTER TABLE `interest_claims` ADD COLUMN `claim_batch_id` VARCHAR(64) DEFAULT NULL AFTER `claimed_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='interest_claims' AND COLUMN_NAME='fx_per_usdt') = 0,
  'ALTER TABLE `interest_claims` ADD COLUMN `fx_per_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0 AFTER `amount_local`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `interest_claims`
SET `fx_per_usdt` = COALESCE(NULLIF(`fx_per_usdt`,0), NULLIF(`fx_krw_per_usdt`,0), 0)
WHERE `fx_per_usdt` = 0;

-- Expand enum to support USDT settlement.
ALTER TABLE `interest_claims`
MODIFY COLUMN `settlement_basis` ENUM('KRW','USD','KZT','PHP','GEL','IDR','VND','USDT') NOT NULL DEFAULT 'KRW';

-- Widen month_key so later monthly formats do not fail.
ALTER TABLE `interest_claims`
MODIFY COLUMN `month_key` VARCHAR(32) NOT NULL;

-- Backfill old rows so existing history stays treated as already-awarded rows.
UPDATE `interest_claims`
SET `claimed_at` = `created_at`
WHERE `claimed_at` IS NULL;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='interest_claims' AND INDEX_NAME='idx_interest_pending') = 0,
  'ALTER TABLE `interest_claims` ADD INDEX `idx_interest_pending` (`address`,`asset_id`,`claimed_at`,`created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
