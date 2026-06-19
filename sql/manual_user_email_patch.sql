-- User email registration + verification columns
-- MariaDB 10.0.2+ (Hostinger 공용) — ADD COLUMN IF NOT EXISTS / ADD INDEX IF NOT EXISTS 지원
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `email_verified_at` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `email_verify_token` VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `email_verify_expires_at` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `email_verify_sent_at` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `email_verify_attempts` INT NOT NULL DEFAULT 0,
  ADD INDEX IF NOT EXISTS `idx_users_email` (`email`),
  ADD INDEX IF NOT EXISTS `idx_users_email_verify_token` (`email_verify_token`);
