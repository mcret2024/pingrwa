-- Run once only if runtime auto-migration cannot ALTER the sales table.
-- Purpose: store sale draft fields independently so actual acquisition / sale tax / other sale expenses persist correctly.

SET @db_name := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='sales' AND COLUMN_NAME='actual_acquisition_cost_input') = 0,
  'ALTER TABLE `sales` ADD COLUMN `actual_acquisition_cost_input` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `buy_price_krw`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='sales' AND COLUMN_NAME='sale_tax_amount') = 0,
  'ALTER TABLE `sales` ADD COLUMN `sale_tax_amount` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `sold_price_krw`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `sales`
MODIFY COLUMN `sale_tax_amount` DECIMAL(24,6) NOT NULL DEFAULT 0;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='sales' AND COLUMN_NAME='other_expenses_input') = 0,
  'ALTER TABLE `sales` ADD COLUMN `other_expenses_input` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `sale_tax_amount`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `sales`
MODIFY COLUMN `other_expenses_input` DECIMAL(24,6) NOT NULL DEFAULT 0;

UPDATE `sales`
SET `other_expenses_input` = COALESCE(NULLIF(`other_expenses_input`,0), `expenses_krw`, 0)
WHERE COALESCE(`other_expenses_input`,0) = 0
  AND COALESCE(`expenses_krw`,0) > 0;
