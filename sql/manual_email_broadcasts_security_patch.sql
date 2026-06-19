-- Admin bulk email security: IP + user-agent 로깅 컬럼 추가
ALTER TABLE `email_broadcasts`
  ADD COLUMN IF NOT EXISTS `created_ip` VARCHAR(64) DEFAULT NULL AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `created_ua` VARCHAR(255) DEFAULT NULL AFTER `created_ip`,
  ADD INDEX IF NOT EXISTS `idx_email_broadcasts_created_by` (`created_by`);
