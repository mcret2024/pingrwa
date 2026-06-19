-- Admin bulk email broadcasts
CREATE TABLE IF NOT EXISTS `email_broadcasts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `subject` VARCHAR(500) NOT NULL,
  `body_html` MEDIUMTEXT NOT NULL,
  `filter_type` VARCHAR(40) NOT NULL DEFAULT 'all_verified',
  `filter_addresses` MEDIUMTEXT DEFAULT NULL,
  `total` INT NOT NULL DEFAULT 0,
  `sent` INT NOT NULL DEFAULT 0,
  `failed` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_by` VARCHAR(80) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` DATETIME DEFAULT NULL,
  `finished_at` DATETIME DEFAULT NULL,
  `error_message` VARCHAR(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email_broadcasts_created_at` (`created_at`),
  KEY `idx_email_broadcasts_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_broadcast_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `broadcast_id` INT UNSIGNED NOT NULL,
  `address` VARCHAR(64) DEFAULT NULL,
  `email` VARCHAR(255) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `error` VARCHAR(500) DEFAULT NULL,
  `sent_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ebl_broadcast` (`broadcast_id`),
  KEY `idx_ebl_status` (`status`),
  KEY `idx_ebl_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
