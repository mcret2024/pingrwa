-- Optional fallback when the runtime DB user cannot CREATE/ALTER referral tables.
-- Run once with a DB account that has DDL permission.

SET @db = DATABASE();

CREATE TABLE IF NOT EXISTS `referral_bonus_events` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `interest_claim_id` BIGINT NOT NULL,
  `referrer_address` VARCHAR(64) NOT NULL,
  `investor_address` VARCHAR(64) NOT NULL,
  `asset_id` VARCHAR(16) NOT NULL,
  `month_key` VARCHAR(32) NOT NULL,
  `investor_interest_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `bonus_rate` DECIMAL(8,6) NOT NULL DEFAULT 0.01,
  `bonus_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
  `last_error` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_rbe_interest_claim` (`interest_claim_id`),
  KEY `idx_rbe_referrer` (`referrer_address`),
  KEY `idx_rbe_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pending_referral_bonuses` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `interest_claim_id` BIGINT DEFAULT NULL,
  `referrer_address` VARCHAR(64) NOT NULL,
  `investor_address` VARCHAR(64) NOT NULL,
  `asset_id` VARCHAR(16) NOT NULL,
  `month_key` VARCHAR(32) NOT NULL,
  `investor_interest_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `bonus_rate` DECIMAL(8,6) NOT NULL DEFAULT 0.01,
  `bonus_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `attempts` INT NOT NULL DEFAULT 0,
  `last_error` TEXT DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_prb_interest_claim` (`interest_claim_id`),
  KEY `idx_prb_status` (`status`),
  KEY `idx_prb_referrer` (`referrer_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@db AND table_name='pending_referral_bonuses' AND column_name='interest_claim_id'),
  'SELECT 1',
  'ALTER TABLE `pending_referral_bonuses` ADD COLUMN `interest_claim_id` BIGINT DEFAULT NULL AFTER `id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@db AND table_name='referral_bonuses' AND column_name='month_key'),
  'ALTER TABLE `referral_bonuses` MODIFY COLUMN `month_key` VARCHAR(32) NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@db AND table_name='pending_referral_bonuses' AND column_name='month_key'),
  'ALTER TABLE `pending_referral_bonuses` MODIFY COLUMN `month_key` VARCHAR(32) NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=@db AND table_name='pending_referral_bonuses' AND index_name='uk_prb_interest_claim'),
  'SELECT 1',
  'ALTER TABLE `pending_referral_bonuses` ADD UNIQUE KEY `uk_prb_interest_claim` (`interest_claim_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=@db AND table_name='referral_bonus_events' AND index_name='uk_rbe_interest_claim'),
  'SELECT 1',
  'ALTER TABLE `referral_bonus_events` ADD UNIQUE KEY `uk_rbe_interest_claim` (`interest_claim_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
