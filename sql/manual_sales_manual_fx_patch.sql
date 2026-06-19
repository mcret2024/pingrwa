-- Add manual_fx_per_usdt column to sales table.
-- Idempotent: skipped if column already exists.
-- Position-independent: no AFTER clause (column appended at end).

SET @db_name := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='sales' AND COLUMN_NAME='manual_fx_per_usdt') = 0,
  'ALTER TABLE `sales` ADD COLUMN `manual_fx_per_usdt` DECIMAL(24,6) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
