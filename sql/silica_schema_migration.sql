-- ================================================================
-- Silica Chain — Phase A: DB Schema Migration
-- Adds Silica-specific tables and fields on top of Recon base schema
-- Run AFTER importing rwa.sql
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';

-- ----------------------------------------------------------------
-- 1. ALTER `assets` — 광산 특화 컬럼 추가
-- ----------------------------------------------------------------

ALTER TABLE `assets`
  ADD COLUMN `license_no` VARCHAR(32) DEFAULT NULL COMMENT '광업권 번호 (예: 79907)' AFTER `name`,
  ADD COLUMN `sio2_purity` DECIMAL(5,2) DEFAULT NULL COMMENT 'SiO2 순도 (%)' AFTER `license_no`,
  ADD COLUMN `mine_area_ha` DECIMAL(10,2) DEFAULT NULL COMMENT '광산 면적 (헥타르)' AFTER `sio2_purity`,
  ADD COLUMN `total_reserves_ton` BIGINT DEFAULT NULL COMMENT '총 매장량 (톤)' AFTER `mine_area_ha`,
  ADD COLUMN `recoverable_ton` BIGINT DEFAULT NULL COMMENT '회수 가능량 (톤)' AFTER `total_reserves_ton`,
  ADD COLUMN `recovery_rate` DECIMAL(5,2) DEFAULT NULL COMMENT '회수율 (%)' AFTER `recoverable_ton`,
  ADD COLUMN `license_start` DATE DEFAULT NULL COMMENT '광업권 시작일' AFTER `recovery_rate`,
  ADD COLUMN `license_end` DATE DEFAULT NULL COMMENT '광업권 만료일' AFTER `license_start`,
  ADD COLUMN `end_use_ko` VARCHAR(255) DEFAULT NULL COMMENT '활용 분야 (한국어, 콤마 구분)' AFTER `license_end`,
  ADD COLUMN `end_use_en` VARCHAR(255) DEFAULT NULL COMMENT '활용 분야 (영문)' AFTER `end_use_ko`,
  ADD COLUMN `description_ko` TEXT DEFAULT NULL COMMENT '상세 설명 (한국어)' AFTER `end_use_en`,
  ADD COLUMN `description_en` TEXT DEFAULT NULL COMMENT '상세 설명 (영문)' AFTER `description_ko`;

-- ----------------------------------------------------------------
-- 2. INSERT 단일 자산 시드 데이터 (광업권 79907호)
-- ----------------------------------------------------------------

INSERT INTO `assets` (
  `id`, `country_code`, `market`, `name`, `license_no`, `type`, `location`,
  `sio2_purity`, `mine_area_ha`, `total_reserves_ton`, `recoverable_ton`, `recovery_rate`,
  `end_use_ko`, `end_use_en`,
  `description_ko`, `description_en`,
  `settlement_basis`, `payout_currency`, `fx_at_funding`,
  `status`, `apr`, `term_years`, `maturity_date`,
  `target_usdt`, `min_usdt`, `fee_buyer`, `fee_seller`, `is_public`, `overview`
) VALUES (
  'SILICA-79907', 'KR', 'KOSDAQ', '고순도 실리카 광산', '79907', 'mine', '대한민국',
  97.04, 271.00, 30680000, 21470000, 70.00,
  '반도체,광섬유,태양광,유리', 'Semiconductor,Fiber,Solar,Glass',
  '한국에 위치한 271헥타르 규모의 고순도 석영 매장지. 일반 한국 광산이 90~93% 수준인 것에 비해 97.04% SiO₂ 함량을 자랑하며, 반도체 웨이퍼·광섬유·태양광 패널 제조에 적합한 프리미엄 등급의 원료 광산입니다.',
  'A 271-hectare high-purity quartz reserve in Korea. With 97.04% SiO₂ content (vs 90-93% Korean average), it qualifies as semiconductor-grade feedstock for chip wafers, optical fiber, and solar panels.',
  'KRW', 'USDT', 1400,
  '모집중', 5.00, 20, '2031-10-19',
  1000000.00, 100.00, 0.50, 0.50, 1, '한국 271헥타르 고순도 실리카 광산 (SiO₂ 97.04%)'
) ON DUPLICATE KEY UPDATE
  `license_no` = VALUES(`license_no`),
  `sio2_purity` = VALUES(`sio2_purity`),
  `mine_area_ha` = VALUES(`mine_area_ha`),
  `total_reserves_ton` = VALUES(`total_reserves_ton`),
  `recoverable_ton` = VALUES(`recoverable_ton`),
  `recovery_rate` = VALUES(`recovery_rate`),
  `end_use_ko` = VALUES(`end_use_ko`),
  `end_use_en` = VALUES(`end_use_en`),
  `description_ko` = VALUES(`description_ko`),
  `description_en` = VALUES(`description_en`);

-- 기존 데이터의 라이센스 만료일 정보 클리어 (하위호환)
UPDATE `assets`
   SET `license_start` = NULL,
       `license_end`   = NULL
 WHERE `id` = 'SILICA-79907';

-- ----------------------------------------------------------------
-- 3. INSERT app_settings — Silica 전용 설정 키
-- ----------------------------------------------------------------

INSERT INTO `app_settings` (`k`, `v`) VALUES
  ('silica_sto_mint', JSON_QUOTE('')),
  ('silica_token_mint', JSON_QUOTE('')),
  ('silica_price_usdt', JSON_OBJECT('value', 0.05, 'mode', 'manual', 'updated_at', NOW())),
  ('silica_price_mode', JSON_QUOTE('manual')),
  ('silica_sale_phase', JSON_OBJECT('phase', 'public', 'price_usdt', 1.0, 'target_usdt', 1000000)),
  ('silica_min_invest_usdt', JSON_QUOTE('100')),
  ('silica_referral_tiers', JSON_ARRAY(20.0)),  -- 1단계 단일 비율 (Recon 과 동일)
  ('silica_dividend_payout_day', JSON_QUOTE('15'))
ON DUPLICATE KEY UPDATE `v` = VALUES(`v`);

-- ----------------------------------------------------------------
-- 4. CREATE silica_price_history — Silica 시세 변경 이력 (감사 로그)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `silica_price_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `prev_price_usdt` DECIMAL(20, 8) DEFAULT NULL COMMENT '이전 시세 (USDT)',
  `new_price_usdt` DECIMAL(20, 8) NOT NULL COMMENT '새 시세 (USDT)',
  `change_pct` DECIMAL(10, 4) DEFAULT NULL COMMENT '변동률 (%)',
  `mode` ENUM('manual', 'exchange_api') NOT NULL DEFAULT 'manual',
  `reason` VARCHAR(500) DEFAULT NULL COMMENT '변경 사유',
  `changed_by` VARCHAR(64) DEFAULT NULL COMMENT 'admin username',
  `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_changed_at` (`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Silica 토큰 시세 변경 이력';

-- ----------------------------------------------------------------
-- 5. CREATE interest_rate_history — 회차 기반 이자율 변경 이력
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `interest_rate_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `rate_bps` INT NOT NULL COMMENT '500 = 5.00%',
  `effective_from_payout` DATE NOT NULL COMMENT '적용 시작 회차의 지급일 (YYYY-MM-15)',
  `prev_rate_bps` INT DEFAULT NULL COMMENT '이전 요율',
  `created_by` VARCHAR(64) DEFAULT NULL COMMENT 'admin username',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` VARCHAR(500) DEFAULT NULL COMMENT '변경 사유',
  PRIMARY KEY (`id`),
  KEY `idx_effective_from_payout` (`effective_from_payout`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='고정이자율 회차 변경 이력 (다음 회차부터 적용)';

-- 초기 5% 시드
INSERT INTO `interest_rate_history` (`rate_bps`, `effective_from_payout`, `prev_rate_bps`, `created_by`, `reason`)
VALUES (500, '2026-01-15', NULL, 'system', '초기 설정')
ON DUPLICATE KEY UPDATE `id` = `id`;

-- ----------------------------------------------------------------
-- 6. CREATE dividend_executions — 연 배당 실행 기록
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `dividend_executions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `payout_amount_usdt` DECIMAL(20, 2) NOT NULL COMMENT '배당 풀 (USDT 가치)',
  `payout_month` DATE NOT NULL COMMENT '지급 월 (YYYY-MM-15)',
  `silica_price_at_execution` DECIMAL(20, 8) DEFAULT NULL COMMENT '실행 시점 Silica 시세',
  `silica_price_at_payout` DECIMAL(20, 8) DEFAULT NULL COMMENT '지급 시점 Silica 시세 (확정)',
  `silica_total_distributed` DECIMAL(20, 2) DEFAULT NULL COMMENT '실제 분배된 Silica 총량',
  `recipient_count` INT DEFAULT NULL COMMENT '수령자 수',
  `price_mode` ENUM('payout_admin', 'payout_api', 'execution_lock') NOT NULL DEFAULT 'payout_admin',
  `popup_content_ko` TEXT DEFAULT NULL,
  `popup_content_en` TEXT DEFAULT NULL,
  `status` ENUM('scheduled', 'executing', 'paid', 'cancelled') NOT NULL DEFAULT 'scheduled',
  `executed_by` VARCHAR(64) DEFAULT NULL,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cancelled_by` VARCHAR(64) DEFAULT NULL,
  `cancelled_at` DATETIME DEFAULT NULL,
  `cancelled_reason` VARCHAR(500) DEFAULT NULL,
  `paid_at` DATETIME DEFAULT NULL,
  `memo` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_payout_month` (`payout_month`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='연 배당 실행 헤더';

-- ----------------------------------------------------------------
-- 7. CREATE dividend_payouts — 사용자별 배당 지급 내역
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `dividend_payouts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `execution_id` BIGINT NOT NULL,
  -- (2026-05-12 v326) address 기반 식별 — 코드베이스 다른 부분이 모두
  -- holdings.address / wallet_transactions.address 를 키로 사용하므로
  -- user_id BIGINT 보다 address VARCHAR(64) 가 일관됨. user_id 는 legacy
  -- column 으로 nullable 유지 (기존 배포 호환).
  `address` VARCHAR(64) NULL,
  `user_id` BIGINT NULL,
  `staked_silica_sto_at_payout` DECIMAL(20, 6) NOT NULL DEFAULT 0 COMMENT '지급일 시점 스테이킹 STO 수량',
  `share_pct` DECIMAL(10, 6) NOT NULL DEFAULT 0 COMMENT '전체 풀 대비 지분 %',
  `share_usdt` DECIMAL(20, 6) NOT NULL DEFAULT 0 COMMENT '지분 환산 USDT',
  `silica_amount` DECIMAL(20, 2) NOT NULL DEFAULT 0 COMMENT '실제 지급 Silica (소수점 2자리)',
  `silica_price_used` DECIMAL(20, 8) NOT NULL,
  `tx_hash` VARCHAR(128) DEFAULT NULL COMMENT 'Solana tx hash',
  `status` ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
  `paid_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_execution_id` (`execution_id`),
  KEY `idx_address` (`address`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_dividend_payouts_execution` FOREIGN KEY (`execution_id`) REFERENCES `dividend_executions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='연 배당 사용자별 지급 내역';

-- ----------------------------------------------------------------
-- 8. CREATE silica_swaps — 단방향 스왑 이력 (Silica → SilicaSTO)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `silica_swaps` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `silica_amount_in` DECIMAL(20, 2) NOT NULL COMMENT 'Silica 입력 수량 (소수점 2자리)',
  `silica_sto_amount_out` DECIMAL(20, 6) NOT NULL COMMENT 'SilicaSTO 출력 수량',
  `silica_price_used` DECIMAL(20, 8) NOT NULL COMMENT '스왑 시점 Silica 시세 (USDT)',
  `rate_used` DECIMAL(20, 8) NOT NULL COMMENT '환산 비율 (1 SilicaSTO = N Silica)',
  `mode` ENUM('manual', 'exchange_api') NOT NULL DEFAULT 'manual',
  `tx_hash_burn` VARCHAR(128) DEFAULT NULL COMMENT 'Silica 소각 트랜잭션',
  `tx_hash_mint` VARCHAR(128) DEFAULT NULL COMMENT 'SilicaSTO 발행 트랜잭션',
  `status` ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME DEFAULT NULL,
  `failed_reason` VARCHAR(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Silica → SilicaSTO 단방향 스왑 이력';

-- ----------------------------------------------------------------
-- 9. CREATE popup_announcements — 공지 팝업 관리
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `popup_announcements` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `type` ENUM('general', 'dividend', 'rate_change', 'maintenance', 'event') NOT NULL DEFAULT 'general',
  `title_ko` VARCHAR(255) NOT NULL,
  `title_en` VARCHAR(255) DEFAULT NULL,
  `body_ko` TEXT NOT NULL,
  `body_en` TEXT DEFAULT NULL,
  `audience` ENUM('all', 'stakers', 'kyc_verified', 'custom') NOT NULL DEFAULT 'all',
  `audience_filter` JSON DEFAULT NULL COMMENT '커스텀 대상 필터',
  `dismissable` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '오늘 하루 보지 않기 가능',
  `start_at` DATETIME NOT NULL,
  `end_at` DATETIME NOT NULL,
  `status` ENUM('draft', 'active', 'paused', 'expired') NOT NULL DEFAULT 'active',
  `auto_trigger` VARCHAR(64) DEFAULT NULL COMMENT '자동 생성 출처 (dividend, rate_change 등)',
  `linked_id` BIGINT DEFAULT NULL COMMENT '연결된 이벤트 ID (dividend_execution_id 등)',
  `view_count` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_dates` (`status`, `start_at`, `end_at`),
  KEY `idx_audience` (`audience`),
  KEY `idx_auto_trigger` (`auto_trigger`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='관리자 공지 팝업';

-- ----------------------------------------------------------------
-- 10. CREATE popup_dismissals — "오늘 하루 보지 않기" 추적
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `popup_dismissals` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `popup_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `dismissed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dismiss_until` DATETIME NOT NULL COMMENT '이 시각까지 보지 않음 (오늘 자정)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_popup_user` (`popup_id`, `user_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_dismiss_until` (`dismiss_until`),
  CONSTRAINT `fk_popup_dismissals_popup` FOREIGN KEY (`popup_id`) REFERENCES `popup_announcements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='유저별 팝업 닫기 기록';

-- ----------------------------------------------------------------
-- 11. ALTER holdings — 두 토큰 잔액 컬럼 추가
-- ----------------------------------------------------------------

-- holdings는 (user_id, asset_id) 기반 멀티자산이지만 Silica는 단일자산이므로
-- 추가 컬럼으로 두 토큰 잔액 따로 관리.
-- 위치 독립 / 멱등성: PREPARE 패턴으로 컬럼 존재 시 skip

SET @db_name := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='holdings' AND COLUMN_NAME='silica_sto_balance') = 0,
  'ALTER TABLE `holdings` ADD COLUMN `silica_sto_balance` DECIMAL(20, 6) NOT NULL DEFAULT 0 COMMENT ''SilicaSTO 보유량''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='holdings' AND COLUMN_NAME='silica_balance') = 0,
  'ALTER TABLE `holdings` ADD COLUMN `silica_balance` DECIMAL(20, 2) NOT NULL DEFAULT 0 COMMENT ''Silica 보유량 (소수점 2자리)''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='holdings' AND COLUMN_NAME='silica_sto_staked') = 0,
  'ALTER TABLE `holdings` ADD COLUMN `silica_sto_staked` DECIMAL(20, 6) NOT NULL DEFAULT 0 COMMENT ''스테이킹 중 SilicaSTO''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------
-- 12. ALTER interest_claims — 토큰 종류 + 회차 강화
-- 위치 독립 / 멱등성: PREPARE 패턴으로 컬럼 존재 시 skip
-- ----------------------------------------------------------------

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='interest_claims' AND COLUMN_NAME='cycle_payout_date') = 0,
  'ALTER TABLE `interest_claims` ADD COLUMN `cycle_payout_date` DATE DEFAULT NULL COMMENT ''회차 지급일 (YYYY-MM-15)''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='interest_claims' AND COLUMN_NAME='rate_bps_applied') = 0,
  'ALTER TABLE `interest_claims` ADD COLUMN `rate_bps_applied` INT DEFAULT NULL COMMENT ''적용된 이자율 (bps)''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='interest_claims' AND COLUMN_NAME='payout_token') = 0,
  'ALTER TABLE `interest_claims` ADD COLUMN `payout_token` ENUM(''USDT'', ''silica_sto'', ''silica'') NOT NULL DEFAULT ''USDT''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='interest_claims' AND INDEX_NAME='idx_cycle_payout_date') = 0,
  'ALTER TABLE `interest_claims` ADD KEY `idx_cycle_payout_date` (`cycle_payout_date`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------
-- 12-B. ALTER orders — 토큰 종류 구분 (SilicaSTO / Silica 별 매도)
-- 위치 독립 / 멱등성: PREPARE 패턴
-- ----------------------------------------------------------------

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='orders' AND COLUMN_NAME='token_type') = 0,
  'ALTER TABLE `orders` ADD COLUMN `token_type` ENUM(''legacy'', ''silica_sto'', ''silica'') NOT NULL DEFAULT ''legacy'' COMMENT ''매매 토큰 종류''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA=@db_name AND TABLE_NAME='orders' AND INDEX_NAME='idx_orders_token_type') = 0,
  'ALTER TABLE `orders` ADD KEY `idx_orders_token_type` (`token_type`, `status`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------
-- 13. CREATE silica_referral_bonus — 3-Tier 추천 보너스 추적
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `silica_referral_bonus` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `referrer_user_id` BIGINT NOT NULL COMMENT '보너스 받는 유저',
  `source_user_id` BIGINT NOT NULL COMMENT '이자 받은 유저 (보너스 산정 기준)',
  `tier` TINYINT NOT NULL COMMENT '1=직접, 2=2단계, 3=3단계',
  `interest_claim_id` BIGINT DEFAULT NULL COMMENT '연결된 이자 지급 ID',
  `source_interest_usdt` DECIMAL(20, 6) NOT NULL,
  `bonus_pct` DECIMAL(5, 2) NOT NULL COMMENT '20.00 / 5.00 / 5.00',
  `bonus_amount_usdt` DECIMAL(20, 6) NOT NULL,
  `status` ENUM('pending', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
  `paid_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_referrer_user_id` (`referrer_user_id`),
  KEY `idx_source_user_id` (`source_user_id`),
  KEY `idx_tier` (`tier`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Silica 3-tier 추천 보너스 (20%+5%+5%)';

-- ----------------------------------------------------------------
-- 14. CREATE silica_audit_log — Silica 운영 감사 로그
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `silica_audit_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `category` ENUM('price_change', 'rate_change', 'dividend_exec', 'dividend_cancel',
                  'dividend_paid',
                  'mint_change', 'fx_change', 'popup_create', 'popup_update', 'popup_delete',
                  'system_config') NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `actor` VARCHAR(64) NOT NULL COMMENT 'admin username',
  `actor_ip` VARCHAR(64) DEFAULT NULL,
  `target_id` BIGINT DEFAULT NULL,
  `prev_value` JSON DEFAULT NULL,
  `new_value` JSON DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_actor` (`actor`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Silica 운영 액션 통합 감사 로그';

-- ----------------------------------------------------------------
-- 15. INSERT 마이그레이션 완료 마커
-- ----------------------------------------------------------------

INSERT INTO `app_settings` (`k`, `v`) VALUES
  ('silica_schema_version', JSON_QUOTE('1.0.0')),
  ('silica_schema_migrated_at', JSON_QUOTE(DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%sZ')))
ON DUPLICATE KEY UPDATE `v` = VALUES(`v`);

SET FOREIGN_KEY_CHECKS = 1;

-- ================================================================
-- DONE
-- 실행 후 확인:
--   SELECT v FROM app_settings WHERE k='silica_schema_version';
-- 결과: "1.0.0"
-- ================================================================
