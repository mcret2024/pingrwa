-- =====================================================
-- SilicaChain 통합 설치 SQL (clean install) v2
-- 구조: 2026-06-12 운영 DB 구조 추출 (drift 0 — interest_claims UNIQUE/claimed_at,
--   wallet_transactions 트리거 정답, 57 테이블, db.php autoMigrate 전체 반영)
-- seed: 시스템 부트스트랩만 (admins[placeholder]/settings/templates/SILICA-79907 고정자산)
--   사용자 데이터 + 더미 자산(APT/test) 제외.
-- 이 파일 하나만 phpMyAdmin Import. admins 비밀번호는 placeholder — 설치 후 변경.
-- =====================================================

-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- 호스트: 127.0.0.1:3306
-- 생성 시간: 26-06-12 09:20
-- 서버 버전: 11.8.6-MariaDB-log
-- PHP 버전: 7.2.34

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 데이터베이스: `u781966299_silica2RWA`
--

-- --------------------------------------------------------

--
-- 테이블 구조 `admins`
--

DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id` bigint(20) NOT NULL,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `otp_secret` varchar(64) DEFAULT NULL,
  `is_active` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `amm_admin_audit`
--

DROP TABLE IF EXISTS `amm_admin_audit`;
CREATE TABLE `amm_admin_audit` (
  `id` bigint(20) NOT NULL,
  `admin_username` varchar(64) DEFAULT NULL,
  `action` varchar(32) NOT NULL COMMENT 'topup | withdraw | enable | disable | sell_create | sell_cancel',
  `asset_id` varchar(64) DEFAULT NULL,
  `amount` decimal(18,6) DEFAULT NULL COMMENT '토큰 수량 또는 USDT 금액',
  `price` decimal(18,6) DEFAULT NULL COMMENT '매도 가격 (sell_create 전용)',
  `order_id` varchar(64) DEFAULT NULL,
  `balance_before` decimal(18,6) DEFAULT NULL COMMENT '풀 잔고 변경 전 (topup/withdraw)',
  `balance_after` decimal(18,6) DEFAULT NULL COMMENT '풀 잔고 변경 후 (topup/withdraw)',
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
CREATE TABLE `app_settings` (
  `k` varchar(64) NOT NULL,
  `v` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`v`)),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `apr_history`
--

DROP TABLE IF EXISTS `apr_history`;
CREATE TABLE `apr_history` (
  `id` bigint(20) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `apr` decimal(5,2) NOT NULL,
  `effective_from` date NOT NULL,
  `reason` varchar(100) DEFAULT 'admin_update',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `assets`
--

DROP TABLE IF EXISTS `assets`;
CREATE TABLE `assets` (
  `id` varchar(16) NOT NULL,
  `country_code` enum('KR','US','KZ','PH','GE','ID','VN') NOT NULL DEFAULT 'KR',
  `market` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `license_no` varchar(32) DEFAULT NULL COMMENT '광업권 번호 (예: 79907)',
  `sio2_purity` decimal(5,2) DEFAULT NULL COMMENT 'SiO2 순도 (%)',
  `mine_area_ha` decimal(10,2) DEFAULT NULL COMMENT '광산 면적 (헥타르)',
  `total_reserves_ton` bigint(20) DEFAULT NULL COMMENT '총 매장량 (톤)',
  `recoverable_ton` bigint(20) DEFAULT NULL COMMENT '회수 가능량 (톤)',
  `recovery_rate` decimal(5,2) DEFAULT NULL COMMENT '회수율 (%)',
  `license_start` date DEFAULT NULL COMMENT '광업권 시작일',
  `license_end` date DEFAULT NULL COMMENT '광업권 만료일',
  `end_use_ko` varchar(255) DEFAULT NULL COMMENT '활용 분야 (한국어, 콤마 구분)',
  `end_use_en` varchar(255) DEFAULT NULL COMMENT '활용 분야 (영문)',
  `description_ko` text DEFAULT NULL COMMENT '상세 설명 (한국어)',
  `description_en` text DEFAULT NULL COMMENT '상세 설명 (영문)',
  `type` varchar(64) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `map_query` varchar(255) DEFAULT NULL,
  `google_map_url` varchar(512) DEFAULT NULL,
  `settlement_basis` enum('KRW','USD','KZT','PHP','GEL','IDR','VND','USDT') NOT NULL DEFAULT 'KRW',
  `payout_currency` enum('USDT') NOT NULL DEFAULT 'USDT',
  `fx_at_funding` int(11) NOT NULL DEFAULT 1350,
  `official_price_krw` bigint(20) DEFAULT NULL,
  `status` enum('활성','매각','매각(완료)','모집중','구매진행','분배중','운영중','모집실패','취소됨') NOT NULL DEFAULT '활성',
  `apr` decimal(5,2) NOT NULL DEFAULT 8.00,
  `term_years` int(11) NOT NULL DEFAULT 2,
  `maturity_date` date DEFAULT NULL,
  `expected_buy_price_usdt` decimal(18,2) DEFAULT NULL,
  `target_usdt` decimal(18,2) NOT NULL DEFAULT 0.00,
  `raised_usdt` decimal(18,2) NOT NULL DEFAULT 0.00,
  `supply_token` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `funded_snapshot_usdt` decimal(18,2) DEFAULT NULL,
  `min_usdt` decimal(18,2) NOT NULL DEFAULT 50.00,
  `fee_buyer` decimal(5,2) NOT NULL DEFAULT 0.50,
  `fee_seller` decimal(5,2) NOT NULL DEFAULT 0.50,
  `image_url` varchar(255) DEFAULT NULL,
  `token_image_url` varchar(255) DEFAULT NULL,
  `overview` text DEFAULT NULL,
  `fund_end_date` date DEFAULT NULL,
  `is_public` tinyint(4) NOT NULL DEFAULT 1,
  `token_mint_address` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `asset_contract_templates`
--

DROP TABLE IF EXISTS `asset_contract_templates`;
CREATE TABLE `asset_contract_templates` (
  `asset_id` varchar(50) NOT NULL,
  `template_id` bigint(20) UNSIGNED NOT NULL,
  `language` varchar(8) DEFAULT NULL,
  `required_otp` tinyint(1) NOT NULL DEFAULT 1,
  `required_user_signature` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `asset_docs`
--

DROP TABLE IF EXISTS `asset_docs`;
CREATE TABLE `asset_docs` (
  `id` bigint(20) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `doc_type` enum('proof','valuation','sale') NOT NULL,
  `title` varchar(255) NOT NULL,
  `doc_date` date DEFAULT NULL,
  `amount` bigint(20) DEFAULT NULL,
  `amount_currency` enum('KRW','USD','KZT','PHP','GEL','IDR','VND') DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `asset_key_info`
--

DROP TABLE IF EXISTS `asset_key_info`;
CREATE TABLE `asset_key_info` (
  `id` bigint(20) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `k` varchar(64) NOT NULL,
  `v` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `auth_nonces`
--

DROP TABLE IF EXISTS `auth_nonces`;
CREATE TABLE `auth_nonces` (
  `address` varchar(64) NOT NULL,
  `nonce` varchar(128) NOT NULL,
  `expires_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `balances`
--

DROP TABLE IF EXISTS `balances`;
CREATE TABLE `balances` (
  `address` varchar(64) NOT NULL,
  `usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `claim_records`
--

DROP TABLE IF EXISTS `claim_records`;
CREATE TABLE `claim_records` (
  `id` bigint(20) NOT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `ok` tinyint(4) NOT NULL DEFAULT 0,
  `message` varchar(255) DEFAULT NULL,
  `funded_usdt` decimal(18,2) DEFAULT NULL,
  `denom_snapshot_usdt` decimal(18,2) DEFAULT NULL,
  `supply_token_snapshot` decimal(18,6) DEFAULT NULL,
  `entitled_token` decimal(18,6) DEFAULT NULL,
  `already_claimed_token` decimal(18,6) DEFAULT NULL,
  `claimed_token` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `contract_audit_logs`
--

DROP TABLE IF EXISTS `contract_audit_logs`;
CREATE TABLE `contract_audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `contract_id` bigint(20) UNSIGNED NOT NULL,
  `actor_type` enum('user','admin','system') NOT NULL,
  `actor_id` varchar(120) DEFAULT NULL,
  `action_type` varchar(60) NOT NULL,
  `ip` varchar(128) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload_json`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `contract_templates`
--

DROP TABLE IF EXISTS `contract_templates`;
CREATE TABLE `contract_templates` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `template_code` varchar(64) NOT NULL,
  `template_name` varchar(120) NOT NULL,
  `template_title` varchar(255) NOT NULL,
  `template_title_en` varchar(255) DEFAULT NULL,
  `body_html` mediumtext NOT NULL,
  `body_html_en` mediumtext DEFAULT NULL,
  `body_text` mediumtext DEFAULT NULL,
  `body_text_en` mediumtext DEFAULT NULL,
  `version_no` int(11) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` varchar(64) DEFAULT NULL,
  `updated_by` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `db_migrations`
--

DROP TABLE IF EXISTS `db_migrations`;
CREATE TABLE `db_migrations` (
  `filename` varchar(255) NOT NULL,
  `file_hash` varchar(64) DEFAULT NULL,
  `applied_at` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `dividend_executions`
--

DROP TABLE IF EXISTS `dividend_executions`;
CREATE TABLE `dividend_executions` (
  `id` bigint(20) NOT NULL,
  `payout_amount_usdt` decimal(20,2) NOT NULL COMMENT '배당 풀 (USDT 가치)',
  `payout_month` date NOT NULL COMMENT '지급 월 (YYYY-MM-15)',
  `silica_price_at_execution` decimal(20,8) DEFAULT NULL COMMENT '실행 시점 Silica 시세',
  `silica_price_at_payout` decimal(20,8) DEFAULT NULL COMMENT '지급 시점 Silica 시세 (확정)',
  `silica_total_distributed` decimal(20,2) DEFAULT NULL COMMENT '실제 분배된 Silica 총량',
  `recipient_count` int(11) DEFAULT NULL COMMENT '수령자 수',
  `price_mode` enum('payout_admin','payout_api','execution_lock') NOT NULL DEFAULT 'payout_admin',
  `popup_content_ko` text DEFAULT NULL,
  `popup_content_en` text DEFAULT NULL,
  `status` enum('scheduled','executing','paid','cancelled') NOT NULL DEFAULT 'scheduled',
  `executed_by` varchar(64) DEFAULT NULL,
  `executed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `cancelled_by` varchar(64) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_reason` varchar(500) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `memo` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='연 배당 실행 헤더';

-- --------------------------------------------------------

--
-- 테이블 구조 `dividend_payouts`
--

DROP TABLE IF EXISTS `dividend_payouts`;
CREATE TABLE `dividend_payouts` (
  `id` bigint(20) NOT NULL,
  `execution_id` bigint(20) NOT NULL,
  `address` varchar(64) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `staked_silica_sto_at_payout` decimal(20,6) NOT NULL DEFAULT 0.000000 COMMENT '지급일 시점 스테이킹 STO 수량',
  `share_pct` decimal(10,6) NOT NULL DEFAULT 0.000000 COMMENT '전체 풀 대비 지분 %',
  `share_usdt` decimal(20,6) NOT NULL DEFAULT 0.000000 COMMENT '지분 환산 USDT',
  `silica_amount` decimal(20,2) NOT NULL DEFAULT 0.00 COMMENT '실제 지급 Silica (소수점 2자리)',
  `silica_price_used` decimal(20,8) NOT NULL,
  `tx_hash` varchar(128) DEFAULT NULL COMMENT 'Solana tx hash',
  `status` enum('pending','paid','claimed','failed','cancelled') NOT NULL DEFAULT 'pending',
  `claimed_at` timestamp NULL DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='연 배당 사용자별 지급 내역';

-- --------------------------------------------------------

--
-- 테이블 구조 `email_broadcasts`
--

DROP TABLE IF EXISTS `email_broadcasts`;
CREATE TABLE `email_broadcasts` (
  `id` int(10) UNSIGNED NOT NULL,
  `subject` varchar(500) NOT NULL,
  `body_html` mediumtext NOT NULL,
  `filter_type` varchar(40) NOT NULL DEFAULT 'all_verified',
  `filter_addresses` mediumtext DEFAULT NULL,
  `total` int(11) NOT NULL DEFAULT 0,
  `sent` int(11) NOT NULL DEFAULT 0,
  `failed` int(11) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_by` varchar(80) DEFAULT NULL,
  `created_ip` varchar(64) DEFAULT NULL,
  `created_ua` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `error_message` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `email_broadcast_logs`
--

DROP TABLE IF EXISTS `email_broadcast_logs`;
CREATE TABLE `email_broadcast_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `broadcast_id` int(10) UNSIGNED NOT NULL,
  `address` varchar(64) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `error` varchar(500) DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `funding_records`
--

DROP TABLE IF EXISTS `funding_records`;
CREATE TABLE `funding_records` (
  `id` bigint(20) NOT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `contract_id` bigint(20) UNSIGNED DEFAULT NULL,
  `amount_usdt` decimal(18,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `fx_quotes`
--

DROP TABLE IF EXISTS `fx_quotes`;
CREATE TABLE `fx_quotes` (
  `id` bigint(20) NOT NULL,
  `provider` varchar(32) NOT NULL,
  `base_currency` varchar(8) NOT NULL DEFAULT 'USDT',
  `quote_currency` varchar(8) NOT NULL,
  `rate` decimal(24,8) NOT NULL DEFAULT 0.00000000,
  `fetched_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `fx_quote_latest`
--

DROP TABLE IF EXISTS `fx_quote_latest`;
CREATE TABLE `fx_quote_latest` (
  `quote_currency` varchar(8) NOT NULL,
  `rate` decimal(24,8) NOT NULL DEFAULT 0.00000000,
  `provider` varchar(32) NOT NULL,
  `fetched_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `holdings`
--

DROP TABLE IF EXISTS `holdings`;
CREATE TABLE `holdings` (
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `balance_token` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `staked_token` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `claimed_token` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `redeemed_token` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `silica_sto_balance` decimal(20,6) NOT NULL DEFAULT 0.000000 COMMENT 'SilicaSTO 보유량',
  `silica_balance` decimal(20,2) NOT NULL DEFAULT 0.00 COMMENT 'Silica 보유량 (소수점 2자리)',
  `silica_sto_staked` decimal(20,6) NOT NULL DEFAULT 0.000000 COMMENT '스테이킹 중 SilicaSTO'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `interest_claims`
--

DROP TABLE IF EXISTS `interest_claims`;
CREATE TABLE `interest_claims` (
  `id` bigint(20) NOT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `month_key` varchar(32) NOT NULL,
  `settlement_basis` enum('KRW','USD','KZT','PHP','GEL','IDR','VND','USDT') NOT NULL DEFAULT 'KRW',
  `staked_snapshot` decimal(18,6) NOT NULL,
  `apr_snapshot` decimal(5,2) NOT NULL,
  `official_price_krw_snapshot` bigint(20) DEFAULT NULL,
  `fx_krw_per_usdt` int(11) NOT NULL,
  `amount_local` decimal(24,4) NOT NULL DEFAULT 0.0000,
  `fx_per_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `amount_usdt` decimal(18,6) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `claimed_at` datetime DEFAULT NULL,
  `claim_batch_id` varchar(64) DEFAULT NULL,
  `cycle_payout_date` date DEFAULT NULL COMMENT '회차 지급일 (YYYY-MM-15)',
  `rate_bps_applied` int(11) DEFAULT NULL COMMENT '적용된 이자율 (bps)',
  `payout_token` enum('USDT','silica_sto','silica') NOT NULL DEFAULT 'USDT'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `interest_rate_history`
--

DROP TABLE IF EXISTS `interest_rate_history`;
CREATE TABLE `interest_rate_history` (
  `id` bigint(20) NOT NULL,
  `rate_bps` int(11) NOT NULL COMMENT '500 = 5.00%',
  `effective_from_payout` date NOT NULL COMMENT '적용 시작 회차의 지급일 (YYYY-MM-15)',
  `prev_rate_bps` int(11) DEFAULT NULL COMMENT '이전 요율',
  `created_by` varchar(64) DEFAULT NULL COMMENT 'admin username',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reason` varchar(500) DEFAULT NULL COMMENT '변경 사유'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='고정이자율 회차 변경 이력 (다음 회차부터 적용)';

-- --------------------------------------------------------

--
-- 테이블 구조 `investment_contracts`
--

DROP TABLE IF EXISTS `investment_contracts`;
CREATE TABLE `investment_contracts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `contract_no` varchar(40) NOT NULL,
  `asset_id` varchar(50) NOT NULL,
  `address` varchar(120) NOT NULL,
  `template_id` bigint(20) UNSIGNED NOT NULL,
  `template_code` varchar(64) NOT NULL,
  `template_version` int(11) NOT NULL,
  `status` enum('draft','user_signed','awaiting_admin','completed','rejected','void') NOT NULL DEFAULT 'draft',
  `contract_title` varchar(255) NOT NULL,
  `contract_body_html` mediumtext NOT NULL,
  `contract_body_text` mediumtext DEFAULT NULL,
  `amount_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `amount_local` decimal(24,6) DEFAULT NULL,
  `settlement_basis` varchar(10) NOT NULL DEFAULT 'KRW',
  `fx_per_usdt` decimal(24,6) NOT NULL DEFAULT 0.000000,
  `signer_name` varchar(120) NOT NULL DEFAULT '',
  `consent_electronic` tinyint(1) NOT NULL DEFAULT 0,
  `consent_signature` tinyint(1) NOT NULL DEFAULT 0,
  `user_signature_path` varchar(255) DEFAULT NULL,
  `user_signed_at` datetime DEFAULT NULL,
  `user_signed_ip` varchar(128) DEFAULT NULL,
  `user_signed_user_agent` varchar(255) DEFAULT NULL,
  `otp_verified_at` datetime DEFAULT NULL,
  `funding_record_id` bigint(20) UNSIGNED DEFAULT NULL,
  `admin_signature_path` varchar(255) DEFAULT NULL,
  `admin_signed_by` varchar(64) DEFAULT NULL,
  `admin_signed_at` datetime DEFAULT NULL,
  `finalized_pdf_path` varchar(255) DEFAULT NULL,
  `rejected_reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `kyc_handoff_tokens`
--

DROP TABLE IF EXISTS `kyc_handoff_tokens`;
CREATE TABLE `kyc_handoff_tokens` (
  `id` int(11) NOT NULL,
  `token` varchar(128) NOT NULL,
  `address` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_ip` varchar(45) DEFAULT NULL,
  `used_ip` varchar(45) DEFAULT NULL,
  `didit_session_id` varchar(128) DEFAULT NULL,
  `didit_session_url` varchar(512) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `kyc_sessions`
--

DROP TABLE IF EXISTS `kyc_sessions`;
CREATE TABLE `kyc_sessions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `session_id` varchar(128) NOT NULL,
  `address` varchar(128) NOT NULL,
  `doc_type` varchar(32) DEFAULT NULL,
  `session_url` text DEFAULT NULL,
  `status` varchar(64) NOT NULL DEFAULT 'pending',
  `didit_status` varchar(128) DEFAULT NULL,
  `stored_name` text DEFAULT NULL,
  `stored_birth` varchar(64) DEFAULT NULL,
  `extracted_name` text DEFAULT NULL,
  `extracted_birth` varchar(64) DEFAULT NULL,
  `fail_reason` varchar(128) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_decision_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `legal_terms`
--

DROP TABLE IF EXISTS `legal_terms`;
CREATE TABLE `legal_terms` (
  `id` int(10) UNSIGNED NOT NULL,
  `doc_key` varchar(64) NOT NULL DEFAULT 'tos_investment',
  `title_ko` varchar(255) NOT NULL DEFAULT '이용약관 및 투자 안내',
  `title_en` varchar(255) NOT NULL DEFAULT 'Terms of Service & Investment',
  `subtitle_ko` text DEFAULT NULL,
  `subtitle_en` text DEFAULT NULL,
  `body_html_ko` mediumtext DEFAULT NULL,
  `body_html_en` mediumtext DEFAULT NULL,
  `effective_date` date DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` varchar(128) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `notices`
--

DROP TABLE IF EXISTS `notices`;
CREATE TABLE `notices` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `category` varchar(40) NOT NULL,
  `title` varchar(255) NOT NULL,
  `title_en` varchar(255) DEFAULT NULL,
  `period` varchar(64) DEFAULT NULL,
  `notice_date` date DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `body` mediumtext DEFAULT NULL,
  `body_en` mediumtext DEFAULT NULL,
  `published` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `orders`
--

DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` varchar(80) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `side` enum('buy','sell') NOT NULL,
  `maker_address` varchar(64) NOT NULL,
  `price` decimal(18,8) NOT NULL,
  `amount` decimal(18,6) NOT NULL,
  `remaining` decimal(18,6) NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `escrow_usdt` decimal(18,6) DEFAULT NULL,
  `escrow_token` decimal(18,6) DEFAULT NULL,
  `status` enum('open','filled','cancelled','expired') NOT NULL DEFAULT 'open',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `token_type` enum('legacy','silica_sto','silica') NOT NULL DEFAULT 'legacy' COMMENT '매매 토큰 종류'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `pending_referral_bonuses`
--

DROP TABLE IF EXISTS `pending_referral_bonuses`;
CREATE TABLE `pending_referral_bonuses` (
  `id` bigint(20) NOT NULL,
  `interest_claim_id` bigint(20) DEFAULT NULL,
  `referrer_address` varchar(64) NOT NULL,
  `investor_address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `month_key` varchar(32) NOT NULL,
  `investor_interest_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `bonus_rate` decimal(8,6) NOT NULL DEFAULT 0.010000,
  `bonus_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `last_error` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `platform_balance`
--

DROP TABLE IF EXISTS `platform_balance`;
CREATE TABLE `platform_balance` (
  `id` tinyint(4) NOT NULL,
  `usdt_balance` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `popup_announcements`
--

DROP TABLE IF EXISTS `popup_announcements`;
CREATE TABLE `popup_announcements` (
  `id` bigint(20) NOT NULL,
  `type` enum('general','dividend','rate_change','maintenance','event') NOT NULL DEFAULT 'general',
  `title_ko` varchar(255) NOT NULL,
  `title_en` varchar(255) DEFAULT NULL,
  `body_ko` text NOT NULL,
  `body_en` text DEFAULT NULL,
  `audience` enum('all','stakers','kyc_verified','custom') NOT NULL DEFAULT 'all',
  `audience_filter` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '커스텀 대상 필터' CHECK (json_valid(`audience_filter`)),
  `dismissable` tinyint(1) NOT NULL DEFAULT 1 COMMENT '오늘 하루 보지 않기 가능',
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `status` enum('draft','active','paused','expired') NOT NULL DEFAULT 'active',
  `auto_trigger` varchar(64) DEFAULT NULL COMMENT '자동 생성 출처 (dividend, rate_change 등)',
  `linked_id` bigint(20) DEFAULT NULL COMMENT '연결된 이벤트 ID (dividend_execution_id 등)',
  `view_count` int(11) NOT NULL DEFAULT 0,
  `created_by` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='관리자 공지 팝업';

-- --------------------------------------------------------

--
-- 테이블 구조 `popup_dismissals`
--

DROP TABLE IF EXISTS `popup_dismissals`;
CREATE TABLE `popup_dismissals` (
  `popup_id` int(10) UNSIGNED NOT NULL,
  `user_address` varchar(64) NOT NULL,
  `dismiss_until` datetime NOT NULL,
  `dismissed_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `referrals`
--

DROP TABLE IF EXISTS `referrals`;
CREATE TABLE `referrals` (
  `address` varchar(64) NOT NULL,
  `ref_code` varchar(128) NOT NULL,
  `set_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `referral_bonuses`
--

DROP TABLE IF EXISTS `referral_bonuses`;
CREATE TABLE `referral_bonuses` (
  `id` bigint(20) NOT NULL,
  `referrer_address` varchar(64) NOT NULL,
  `investor_address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `month_key` varchar(32) NOT NULL,
  `investor_interest_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `bonus_rate` decimal(8,6) NOT NULL DEFAULT 0.010000,
  `bonus_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `referral_bonus_events`
--

DROP TABLE IF EXISTS `referral_bonus_events`;
CREATE TABLE `referral_bonus_events` (
  `id` bigint(20) NOT NULL,
  `interest_claim_id` bigint(20) NOT NULL,
  `referrer_address` varchar(64) NOT NULL,
  `investor_address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `month_key` varchar(32) NOT NULL,
  `investor_interest_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `bonus_rate` decimal(8,6) NOT NULL DEFAULT 0.010000,
  `bonus_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `status` varchar(20) NOT NULL DEFAULT 'completed',
  `last_error` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `referral_bonus_payouts`
--

DROP TABLE IF EXISTS `referral_bonus_payouts`;
CREATE TABLE `referral_bonus_payouts` (
  `id` bigint(20) NOT NULL,
  `referrer_address` varchar(64) NOT NULL,
  `interest_claim_id` bigint(20) DEFAULT NULL,
  `investor_address` varchar(64) NOT NULL,
  `asset_id` varchar(64) NOT NULL,
  `month_key` varchar(7) NOT NULL,
  `bonus_usdt` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `status` enum('pending','claimed') NOT NULL DEFAULT 'pending',
  `claimed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `referral_links`
--

DROP TABLE IF EXISTS `referral_links`;
CREATE TABLE `referral_links` (
  `id` bigint(20) NOT NULL,
  `investor_address` varchar(64) NOT NULL,
  `referrer_address` varchar(64) NOT NULL,
  `referrer_code` varchar(32) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `referrer_codes`
--

DROP TABLE IF EXISTS `referrer_codes`;
CREATE TABLE `referrer_codes` (
  `id` bigint(20) NOT NULL,
  `address` varchar(64) NOT NULL,
  `code` varchar(32) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `approved_by` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `refund_records`
--

DROP TABLE IF EXISTS `refund_records`;
CREATE TABLE `refund_records` (
  `id` bigint(20) NOT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `amount_usdt` decimal(18,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `sales`
--

DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `asset_id` varchar(16) NOT NULL,
  `buy_price_krw` bigint(20) NOT NULL DEFAULT 0,
  `actual_acquisition_cost_input` decimal(24,6) NOT NULL DEFAULT 0.000000,
  `sold_price_krw` bigint(20) NOT NULL DEFAULT 0,
  `sale_tax_amount` decimal(24,6) NOT NULL DEFAULT 0.000000,
  `other_expenses_input` decimal(24,6) NOT NULL DEFAULT 0.000000,
  `manual_fx_per_usdt` decimal(24,6) NOT NULL DEFAULT 0.000000,
  `expenses_krw` bigint(20) NOT NULL DEFAULT 0,
  `input_currency` enum('KRW','USD','KZT','PHP','GEL','IDR','VND','USDT') NOT NULL DEFAULT 'KRW',
  `vault_balance_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `window_start` date DEFAULT NULL,
  `window_end` date DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `sale_redemptions`
--

DROP TABLE IF EXISTS `sale_redemptions`;
CREATE TABLE `sale_redemptions` (
  `id` bigint(20) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `settlement_basis` enum('KRW','USD','KZT','PHP','GEL','IDR','VND') NOT NULL DEFAULT 'KRW',
  `address` varchar(64) NOT NULL,
  `tokens` decimal(18,6) NOT NULL,
  `amount_local` decimal(24,4) NOT NULL DEFAULT 0.0000,
  `fx_krw_per_usdt` int(11) NOT NULL,
  `fx_per_usdt` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `usdt` decimal(18,6) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `settings`
--

DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `key` varchar(64) NOT NULL,
  `value` varchar(255) NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `silica_audit_log`
--

DROP TABLE IF EXISTS `silica_audit_log`;
CREATE TABLE `silica_audit_log` (
  `id` bigint(20) NOT NULL,
  `category` enum('price_change','rate_change','dividend_exec','dividend_cancel','dividend_paid','dividend_claimed','mint_change','fx_change','popup_create','popup_update','popup_delete','system_config') NOT NULL,
  `action` varchar(64) NOT NULL,
  `actor` varchar(64) NOT NULL COMMENT 'admin username',
  `actor_ip` varchar(64) DEFAULT NULL,
  `target_id` bigint(20) DEFAULT NULL,
  `prev_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`prev_value`)),
  `new_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_value`)),
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Silica 운영 액션 통합 감사 로그';

-- --------------------------------------------------------

--
-- 테이블 구조 `silica_price_history`
--

DROP TABLE IF EXISTS `silica_price_history`;
CREATE TABLE `silica_price_history` (
  `id` bigint(20) NOT NULL,
  `prev_price_usdt` decimal(20,8) DEFAULT NULL COMMENT '이전 시세 (USDT)',
  `new_price_usdt` decimal(20,8) NOT NULL COMMENT '새 시세 (USDT)',
  `change_pct` decimal(10,4) DEFAULT NULL COMMENT '변동률 (%)',
  `mode` enum('manual','exchange_api') NOT NULL DEFAULT 'manual',
  `reason` varchar(500) DEFAULT NULL COMMENT '변경 사유',
  `changed_by` varchar(64) DEFAULT NULL COMMENT 'admin username',
  `changed_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Silica 토큰 시세 변경 이력';

-- --------------------------------------------------------

--
-- 테이블 구조 `silica_referral_bonus`
--

DROP TABLE IF EXISTS `silica_referral_bonus`;
CREATE TABLE `silica_referral_bonus` (
  `id` bigint(20) NOT NULL,
  `referrer_user_id` bigint(20) NOT NULL COMMENT '보너스 받는 유저',
  `source_user_id` bigint(20) NOT NULL COMMENT '이자 받은 유저 (보너스 산정 기준)',
  `tier` tinyint(4) NOT NULL COMMENT '1=직접, 2=2단계, 3=3단계',
  `interest_claim_id` bigint(20) DEFAULT NULL COMMENT '연결된 이자 지급 ID',
  `source_interest_usdt` decimal(20,6) NOT NULL,
  `bonus_pct` decimal(5,2) NOT NULL COMMENT '20.00 / 5.00 / 5.00',
  `bonus_amount_usdt` decimal(20,6) NOT NULL,
  `status` enum('pending','paid','cancelled') NOT NULL DEFAULT 'pending',
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Silica 3-tier 추천 보너스 (20%+5%+5%)';

-- --------------------------------------------------------

--
-- 테이블 구조 `silica_swaps`
--

DROP TABLE IF EXISTS `silica_swaps`;
CREATE TABLE `silica_swaps` (
  `id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `silica_amount_in` decimal(20,2) NOT NULL COMMENT 'Silica 입력 수량 (소수점 2자리)',
  `silica_sto_amount_out` decimal(20,6) NOT NULL COMMENT 'SilicaSTO 출력 수량',
  `silica_price_used` decimal(20,8) NOT NULL COMMENT '스왑 시점 Silica 시세 (USDT)',
  `rate_used` decimal(20,8) NOT NULL COMMENT '환산 비율 (1 SilicaSTO = N Silica)',
  `mode` enum('manual','exchange_api') NOT NULL DEFAULT 'manual',
  `tx_hash_burn` varchar(128) DEFAULT NULL COMMENT 'Silica 소각 트랜잭션',
  `tx_hash_mint` varchar(128) DEFAULT NULL COMMENT 'SilicaSTO 발행 트랜잭션',
  `status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `completed_at` datetime DEFAULT NULL,
  `failed_reason` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Silica → SilicaSTO 단방향 스왑 이력';

-- --------------------------------------------------------

--
-- 테이블 구조 `silica_winddown_state`
--

DROP TABLE IF EXISTS `silica_winddown_state`;
CREATE TABLE `silica_winddown_state` (
  `id` int(10) UNSIGNED NOT NULL,
  `state` enum('active','winding_down','closed') NOT NULL DEFAULT 'active',
  `announced_at` datetime DEFAULT NULL,
  `staking_disabled_at` datetime DEFAULT NULL,
  `withdrawal_deadline` datetime DEFAULT NULL,
  `amm_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `amm_buy_price_usdt` decimal(20,8) DEFAULT NULL,
  `amm_liquidity_usdt` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `amm_liquidity_used` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `reason` text DEFAULT NULL,
  `updated_by` varchar(128) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `swap_quotes`
--

DROP TABLE IF EXISTS `swap_quotes`;
CREATE TABLE `swap_quotes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `quote_token` char(64) NOT NULL,
  `user_address` varchar(64) NOT NULL,
  `silica_price_usdt` decimal(20,10) NOT NULL,
  `fee_pct` decimal(7,4) NOT NULL DEFAULT 0.0000,
  `requested_amount` decimal(20,6) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Server-issued swap quote tokens with TTL anti-arbitrage';

-- --------------------------------------------------------

--
-- 테이블 구조 `token_withdraw_requests`
--

DROP TABLE IF EXISTS `token_withdraw_requests`;
CREATE TABLE `token_withdraw_requests` (
  `id` bigint(20) NOT NULL,
  `wallet_tx_id` bigint(20) DEFAULT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `to_address` varchar(64) NOT NULL,
  `amount_token` decimal(24,6) NOT NULL DEFAULT 0.000000,
  `status` enum('pending','processing','done','canceled','failed') NOT NULL DEFAULT 'pending',
  `txid` varchar(128) DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `trades`
--

DROP TABLE IF EXISTS `trades`;
CREATE TABLE `trades` (
  `id` bigint(20) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `price` decimal(18,8) NOT NULL,
  `qty` decimal(18,6) NOT NULL,
  `maker_address` varchar(64) DEFAULT NULL,
  `taker_address` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `address` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `otp_enabled` tinyint(4) NOT NULL DEFAULT 0,
  `otp_secret` varchar(64) DEFAULT NULL,
  `otp_temp_secret` varchar(64) DEFAULT NULL,
  `otp_temp_created_at` datetime DEFAULT NULL,
  `otp_fail_count` int(11) NOT NULL DEFAULT 0,
  `otp_locked_until` datetime DEFAULT NULL,
  `otp_last_verified_at` datetime DEFAULT NULL,
  `kyc_yn` char(1) NOT NULL DEFAULT 'N',
  `mt_name` varchar(255) DEFAULT NULL,
  `mt_birth` varchar(20) DEFAULT NULL,
  `kyc_doc_type` varchar(30) DEFAULT NULL,
  `kyc_doc_ip` varchar(64) DEFAULT NULL,
  `kyc_doc_regdate` datetime DEFAULT NULL,
  `kyc_session_id` varchar(191) DEFAULT NULL,
  `kyc_status` varchar(64) DEFAULT NULL,
  `kyc_extracted_name` varchar(255) DEFAULT NULL,
  `kyc_extracted_birth` varchar(20) DEFAULT NULL,
  `kyc_last_verified_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `user_notifications`
--

DROP TABLE IF EXISTS `user_notifications`;
CREATE TABLE `user_notifications` (
  `id` bigint(20) NOT NULL,
  `address` varchar(64) NOT NULL,
  `type` varchar(48) NOT NULL,
  `title` varchar(200) NOT NULL,
  `body` text DEFAULT NULL,
  `payload_json` text DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 뷰 용 스탠드-인 구조 `wallet_balance_view`
-- (실제 뷰는 아래 참조)
--
DROP VIEW IF EXISTS `wallet_balance_view`;
CREATE TABLE `wallet_balance_view` (
`address` varchar(64)
,`usdt` decimal(18,6)
,`token_total` decimal(41,6)
);

-- --------------------------------------------------------

--
-- 테이블 구조 `wallet_transactions`
--

DROP TABLE IF EXISTS `wallet_transactions`;
CREATE TABLE `wallet_transactions` (
  `id` bigint(20) NOT NULL,
  `address` varchar(64) NOT NULL,
  `kind` varchar(40) NOT NULL DEFAULT 'deposit',
  `status` varchar(40) NOT NULL DEFAULT '대기',
  `asset` varchar(40) NOT NULL DEFAULT 'USDT',
  `amount` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `before_amount` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `after_amount` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `txid` varchar(128) DEFAULT NULL,
  `network_fee_lamports` bigint(20) DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `admin_note` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 트리거 `wallet_transactions`
--
DROP TRIGGER IF EXISTS `trg_wallet_transactions_no_delete`;
DELIMITER $$
CREATE TRIGGER `trg_wallet_transactions_no_delete` BEFORE DELETE ON `wallet_transactions` FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'wallet_transactions delete blocked';
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- 테이블 구조 `withdraw_requests`
--

DROP TABLE IF EXISTS `withdraw_requests`;
CREATE TABLE `withdraw_requests` (
  `id` bigint(20) NOT NULL,
  `wallet_tx_id` bigint(20) NOT NULL,
  `address` varchar(64) NOT NULL,
  `to_address` varchar(64) NOT NULL,
  `asset` enum('USDT') NOT NULL DEFAULT 'USDT',
  `amount` decimal(18,6) NOT NULL DEFAULT 0.000000,
  `status` enum('pending','processing','sent','done','canceled','failed') NOT NULL DEFAULT 'pending',
  `txid` varchar(128) DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 덤프된 테이블의 인덱스
--

--
-- 테이블의 인덱스 `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- 테이블의 인덱스 `amm_admin_audit`
--
ALTER TABLE `amm_admin_audit`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_amm_audit_action` (`action`),
  ADD KEY `idx_amm_audit_created_at` (`created_at`),
  ADD KEY `idx_amm_audit_admin` (`admin_username`);

--
-- 테이블의 인덱스 `app_settings`
--
ALTER TABLE `app_settings`
  ADD PRIMARY KEY (`k`);

--
-- 테이블의 인덱스 `apr_history`
--
ALTER TABLE `apr_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_apr_asset` (`asset_id`),
  ADD KEY `idx_apr_effective` (`asset_id`,`effective_from`);

--
-- 테이블의 인덱스 `assets`
--
ALTER TABLE `assets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_assets_status` (`status`);

--
-- 테이블의 인덱스 `asset_contract_templates`
--
ALTER TABLE `asset_contract_templates`
  ADD PRIMARY KEY (`asset_id`),
  ADD KEY `idx_asset_contract_templates_template_id` (`template_id`),
  ADD KEY `idx_act_asset_lang` (`asset_id`,`language`,`is_active`);

--
-- 테이블의 인덱스 `asset_docs`
--
ALTER TABLE `asset_docs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_docs_asset_type` (`asset_id`,`doc_type`);

--
-- 테이블의 인덱스 `asset_key_info`
--
ALTER TABLE `asset_key_info`
  ADD PRIMARY KEY (`id`),
  ADD KEY `asset_id` (`asset_id`);

--
-- 테이블의 인덱스 `auth_nonces`
--
ALTER TABLE `auth_nonces`
  ADD PRIMARY KEY (`address`);

--
-- 테이블의 인덱스 `balances`
--
ALTER TABLE `balances`
  ADD PRIMARY KEY (`address`);

--
-- 테이블의 인덱스 `claim_records`
--
ALTER TABLE `claim_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_claim_records_addr_asset_time` (`address`,`asset_id`,`created_at`);

--
-- 테이블의 인덱스 `contract_audit_logs`
--
ALTER TABLE `contract_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_contract_audit_logs_contract_id` (`contract_id`,`id`);

--
-- 테이블의 인덱스 `contract_templates`
--
ALTER TABLE `contract_templates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_contract_templates_code_ver` (`template_code`,`version_no`),
  ADD KEY `idx_contract_templates_active` (`template_code`,`is_active`,`id`);

--
-- 테이블의 인덱스 `db_migrations`
--
ALTER TABLE `db_migrations`
  ADD PRIMARY KEY (`filename`);

--
-- 테이블의 인덱스 `dividend_executions`
--
ALTER TABLE `dividend_executions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payout_month` (`payout_month`),
  ADD KEY `idx_status` (`status`);

--
-- 테이블의 인덱스 `dividend_payouts`
--
ALTER TABLE `dividend_payouts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_dividend_payouts_exec_addr` (`execution_id`,`address`),
  ADD KEY `idx_execution_id` (`execution_id`),
  ADD KEY `idx_address` (`address`),
  ADD KEY `idx_status` (`status`);

--
-- 테이블의 인덱스 `email_broadcasts`
--
ALTER TABLE `email_broadcasts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email_broadcasts_created_at` (`created_at`),
  ADD KEY `idx_email_broadcasts_status` (`status`),
  ADD KEY `idx_email_broadcasts_created_by` (`created_by`);

--
-- 테이블의 인덱스 `email_broadcast_logs`
--
ALTER TABLE `email_broadcast_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ebl_broadcast` (`broadcast_id`),
  ADD KEY `idx_ebl_status` (`status`),
  ADD KEY `idx_ebl_email` (`email`);

--
-- 테이블의 인덱스 `funding_records`
--
ALTER TABLE `funding_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_funding_records_contract_id` (`contract_id`),
  ADD KEY `asset_id` (`asset_id`),
  ADD KEY `idx_funding_addr_asset` (`address`,`asset_id`);

--
-- 테이블의 인덱스 `fx_quotes`
--
ALTER TABLE `fx_quotes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ccy_time` (`quote_currency`,`fetched_at`),
  ADD KEY `idx_time` (`fetched_at`);

--
-- 테이블의 인덱스 `fx_quote_latest`
--
ALTER TABLE `fx_quote_latest`
  ADD PRIMARY KEY (`quote_currency`);

--
-- 테이블의 인덱스 `holdings`
--
ALTER TABLE `holdings`
  ADD PRIMARY KEY (`address`,`asset_id`),
  ADD KEY `asset_id` (`asset_id`);

--
-- 테이블의 인덱스 `interest_claims`
--
ALTER TABLE `interest_claims`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_ic_addr_asset_month` (`address`,`asset_id`,`month_key`),
  ADD KEY `asset_id` (`asset_id`),
  ADD KEY `idx_cycle_payout_date` (`cycle_payout_date`),
  ADD KEY `idx_interest_pending` (`address`,`asset_id`,`claimed_at`,`created_at`);

--
-- 테이블의 인덱스 `interest_rate_history`
--
ALTER TABLE `interest_rate_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_effective_from_payout` (`effective_from_payout`);

--
-- 테이블의 인덱스 `investment_contracts`
--
ALTER TABLE `investment_contracts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_investment_contracts_no` (`contract_no`),
  ADD KEY `idx_investment_contracts_asset_address` (`asset_id`,`address`,`id`),
  ADD KEY `idx_investment_contracts_status` (`status`),
  ADD KEY `idx_investment_contracts_funding_record_id` (`funding_record_id`);

--
-- 테이블의 인덱스 `kyc_handoff_tokens`
--
ALTER TABLE `kyc_handoff_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_kyc_handoff_token` (`token`),
  ADD KEY `idx_kyc_handoff_address` (`address`),
  ADD KEY `idx_kyc_handoff_expires` (`expires_at`);

--
-- 테이블의 인덱스 `kyc_sessions`
--
ALTER TABLE `kyc_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_kyc_session_id` (`session_id`),
  ADD KEY `idx_kyc_sessions_address_status` (`address`,`status`,`created_at`);

--
-- 테이블의 인덱스 `legal_terms`
--
ALTER TABLE `legal_terms`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_legal_terms_key` (`doc_key`);

--
-- 테이블의 인덱스 `notices`
--
ALTER TABLE `notices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notices_category` (`category`),
  ADD KEY `idx_notices_pub_date` (`published`,`notice_date` DESC),
  ADD KEY `idx_notices_created` (`created_at` DESC);

--
-- 테이블의 인덱스 `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `maker_address` (`maker_address`),
  ADD KEY `idx_orders_asset_status` (`asset_id`,`status`),
  ADD KEY `idx_orders_expiry` (`expiry_date`,`status`),
  ADD KEY `idx_orders_token_type` (`token_type`,`status`);

--
-- 테이블의 인덱스 `pending_referral_bonuses`
--
ALTER TABLE `pending_referral_bonuses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_prb_interest_claim` (`interest_claim_id`),
  ADD KEY `idx_prb_status` (`status`),
  ADD KEY `idx_prb_referrer` (`referrer_address`);

--
-- 테이블의 인덱스 `platform_balance`
--
ALTER TABLE `platform_balance`
  ADD PRIMARY KEY (`id`);

--
-- 테이블의 인덱스 `popup_announcements`
--
ALTER TABLE `popup_announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status_dates` (`status`,`start_at`,`end_at`),
  ADD KEY `idx_audience` (`audience`),
  ADD KEY `idx_auto_trigger` (`auto_trigger`);

--
-- 테이블의 인덱스 `popup_dismissals`
--
ALTER TABLE `popup_dismissals`
  ADD PRIMARY KEY (`popup_id`,`user_address`),
  ADD KEY `idx_pd_until` (`dismiss_until`);

--
-- 테이블의 인덱스 `referrals`
--
ALTER TABLE `referrals`
  ADD PRIMARY KEY (`address`);

--
-- 테이블의 인덱스 `referral_bonuses`
--
ALTER TABLE `referral_bonuses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_rb_unique` (`referrer_address`,`investor_address`,`asset_id`,`month_key`),
  ADD KEY `idx_rb_referrer` (`referrer_address`),
  ADD KEY `idx_rb_month` (`month_key`);

--
-- 테이블의 인덱스 `referral_bonus_events`
--
ALTER TABLE `referral_bonus_events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_rbe_interest_claim` (`interest_claim_id`),
  ADD KEY `idx_rbe_referrer` (`referrer_address`),
  ADD KEY `idx_rbe_status` (`status`);

--
-- 테이블의 인덱스 `referral_bonus_payouts`
--
ALTER TABLE `referral_bonus_payouts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_rbp_claim_referrer` (`interest_claim_id`,`referrer_address`),
  ADD KEY `idx_rbp_referrer_status` (`referrer_address`,`status`),
  ADD KEY `idx_rbp_status` (`status`);

--
-- 테이블의 인덱스 `referral_links`
--
ALTER TABLE `referral_links`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_investor` (`investor_address`),
  ADD KEY `idx_rl_referrer` (`referrer_address`);

--
-- 테이블의 인덱스 `referrer_codes`
--
ALTER TABLE `referrer_codes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_rc_address` (`address`),
  ADD UNIQUE KEY `uk_rc_code` (`code`),
  ADD KEY `idx_rc_code` (`code`),
  ADD KEY `idx_rc_address` (`address`);

--
-- 테이블의 인덱스 `refund_records`
--
ALTER TABLE `refund_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `address` (`address`),
  ADD KEY `asset_id` (`asset_id`);

--
-- 테이블의 인덱스 `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`asset_id`);

--
-- 테이블의 인덱스 `sale_redemptions`
--
ALTER TABLE `sale_redemptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `asset_id` (`asset_id`),
  ADD KEY `address` (`address`);

--
-- 테이블의 인덱스 `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`key`);

--
-- 테이블의 인덱스 `silica_audit_log`
--
ALTER TABLE `silica_audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_actor` (`actor`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- 테이블의 인덱스 `silica_price_history`
--
ALTER TABLE `silica_price_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_changed_at` (`changed_at`);

--
-- 테이블의 인덱스 `silica_referral_bonus`
--
ALTER TABLE `silica_referral_bonus`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_referrer_user_id` (`referrer_user_id`),
  ADD KEY `idx_source_user_id` (`source_user_id`),
  ADD KEY `idx_tier` (`tier`),
  ADD KEY `idx_status` (`status`);

--
-- 테이블의 인덱스 `silica_swaps`
--
ALTER TABLE `silica_swaps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- 테이블의 인덱스 `silica_winddown_state`
--
ALTER TABLE `silica_winddown_state`
  ADD PRIMARY KEY (`id`);

--
-- 테이블의 인덱스 `swap_quotes`
--
ALTER TABLE `swap_quotes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_token` (`quote_token`),
  ADD KEY `idx_user_expires` (`user_address`,`expires_at`),
  ADD KEY `idx_consumed` (`consumed_at`);

--
-- 테이블의 인덱스 `token_withdraw_requests`
--
ALTER TABLE `token_withdraw_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_twr_status` (`status`),
  ADD KEY `idx_twr_address` (`address`),
  ADD KEY `idx_twr_asset_id` (`asset_id`);

--
-- 테이블의 인덱스 `trades`
--
ALTER TABLE `trades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_trades_asset_time` (`asset_id`,`created_at`);

--
-- 테이블의 인덱스 `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`address`),
  ADD KEY `idx_users_kyc_yn` (`kyc_yn`),
  ADD KEY `idx_users_kyc_session_id` (`kyc_session_id`);

--
-- 테이블의 인덱스 `user_notifications`
--
ALTER TABLE `user_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_un_address_read` (`address`,`read_at`),
  ADD KEY `idx_un_type` (`type`),
  ADD KEY `idx_un_created` (`created_at`);

--
-- 테이블의 인덱스 `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_txid` (`txid`),
  ADD KEY `idx_addr_time` (`address`,`created_at`);

--
-- 테이블의 인덱스 `withdraw_requests`
--
ALTER TABLE `withdraw_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_wallet_tx` (`wallet_tx_id`),
  ADD KEY `idx_addr_time` (`address`,`created_at`),
  ADD KEY `idx_status_time` (`status`,`created_at`);

--
-- 덤프된 테이블의 AUTO_INCREMENT
--

--
-- 테이블의 AUTO_INCREMENT `admins`
--
ALTER TABLE `admins`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `amm_admin_audit`
--
ALTER TABLE `amm_admin_audit`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `apr_history`
--
ALTER TABLE `apr_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `asset_docs`
--
ALTER TABLE `asset_docs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `asset_key_info`
--
ALTER TABLE `asset_key_info`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `claim_records`
--
ALTER TABLE `claim_records`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `contract_audit_logs`
--
ALTER TABLE `contract_audit_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `contract_templates`
--
ALTER TABLE `contract_templates`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `dividend_executions`
--
ALTER TABLE `dividend_executions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `dividend_payouts`
--
ALTER TABLE `dividend_payouts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `email_broadcasts`
--
ALTER TABLE `email_broadcasts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `email_broadcast_logs`
--
ALTER TABLE `email_broadcast_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `funding_records`
--
ALTER TABLE `funding_records`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `fx_quotes`
--
ALTER TABLE `fx_quotes`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `interest_claims`
--
ALTER TABLE `interest_claims`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `interest_rate_history`
--
ALTER TABLE `interest_rate_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `investment_contracts`
--
ALTER TABLE `investment_contracts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `kyc_handoff_tokens`
--
ALTER TABLE `kyc_handoff_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `kyc_sessions`
--
ALTER TABLE `kyc_sessions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `legal_terms`
--
ALTER TABLE `legal_terms`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `notices`
--
ALTER TABLE `notices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `pending_referral_bonuses`
--
ALTER TABLE `pending_referral_bonuses`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `popup_announcements`
--
ALTER TABLE `popup_announcements`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `referral_bonuses`
--
ALTER TABLE `referral_bonuses`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `referral_bonus_events`
--
ALTER TABLE `referral_bonus_events`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `referral_bonus_payouts`
--
ALTER TABLE `referral_bonus_payouts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `referral_links`
--
ALTER TABLE `referral_links`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `referrer_codes`
--
ALTER TABLE `referrer_codes`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `refund_records`
--
ALTER TABLE `refund_records`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `sale_redemptions`
--
ALTER TABLE `sale_redemptions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `silica_audit_log`
--
ALTER TABLE `silica_audit_log`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `silica_price_history`
--
ALTER TABLE `silica_price_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `silica_referral_bonus`
--
ALTER TABLE `silica_referral_bonus`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `silica_swaps`
--
ALTER TABLE `silica_swaps`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `silica_winddown_state`
--
ALTER TABLE `silica_winddown_state`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `swap_quotes`
--
ALTER TABLE `swap_quotes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `token_withdraw_requests`
--
ALTER TABLE `token_withdraw_requests`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `trades`
--
ALTER TABLE `trades`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `user_notifications`
--
ALTER TABLE `user_notifications`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `withdraw_requests`
--
ALTER TABLE `withdraw_requests`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

-- --------------------------------------------------------

--
-- 뷰 구조 `wallet_balance_view`
--
DROP TABLE IF EXISTS `wallet_balance_view`;

DROP VIEW IF EXISTS `wallet_balance_view`;
CREATE ALGORITHM=UNDEFINED DEFINER=`u781966299_Silica2`@`127.0.0.1` SQL SECURITY DEFINER VIEW `wallet_balance_view`  AS SELECT `b`.`address` AS `address`, `b`.`usdt` AS `usdt`, coalesce(sum(`h`.`balance_token` + `h`.`staked_token`),0) AS `token_total` FROM (`balances` `b` left join `holdings` `h` on(`h`.`address` = `b`.`address`)) GROUP BY `b`.`address`, `b`.`usdt` ;

--
-- 덤프된 테이블의 제약사항
--

--
-- 테이블의 제약사항 `asset_docs`
--
ALTER TABLE `asset_docs`
  ADD CONSTRAINT `asset_docs_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `asset_key_info`
--
ALTER TABLE `asset_key_info`
  ADD CONSTRAINT `asset_key_info_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `balances`
--
ALTER TABLE `balances`
  ADD CONSTRAINT `balances_ibfk_1` FOREIGN KEY (`address`) REFERENCES `users` (`address`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `dividend_payouts`
--
ALTER TABLE `dividend_payouts`
  ADD CONSTRAINT `fk_dividend_payouts_execution` FOREIGN KEY (`execution_id`) REFERENCES `dividend_executions` (`id`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `funding_records`
--
ALTER TABLE `funding_records`
  ADD CONSTRAINT `funding_records_ibfk_1` FOREIGN KEY (`address`) REFERENCES `users` (`address`) ON DELETE CASCADE,
  ADD CONSTRAINT `funding_records_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `holdings`
--
ALTER TABLE `holdings`
  ADD CONSTRAINT `holdings_ibfk_1` FOREIGN KEY (`address`) REFERENCES `users` (`address`) ON DELETE CASCADE,
  ADD CONSTRAINT `holdings_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `interest_claims`
--
ALTER TABLE `interest_claims`
  ADD CONSTRAINT `interest_claims_ibfk_1` FOREIGN KEY (`address`) REFERENCES `users` (`address`) ON DELETE CASCADE,
  ADD CONSTRAINT `interest_claims_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`maker_address`) REFERENCES `users` (`address`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `referrals`
--
ALTER TABLE `referrals`
  ADD CONSTRAINT `referrals_ibfk_1` FOREIGN KEY (`address`) REFERENCES `users` (`address`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `refund_records`
--
ALTER TABLE `refund_records`
  ADD CONSTRAINT `refund_records_ibfk_1` FOREIGN KEY (`address`) REFERENCES `users` (`address`) ON DELETE CASCADE,
  ADD CONSTRAINT `refund_records_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `sale_redemptions`
--
ALTER TABLE `sale_redemptions`
  ADD CONSTRAINT `sale_redemptions_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sale_redemptions_ibfk_2` FOREIGN KEY (`address`) REFERENCES `users` (`address`) ON DELETE CASCADE;

--
-- 테이블의 제약사항 `trades`
--
ALTER TABLE `trades`
  ADD CONSTRAINT `trades_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;
SET FOREIGN_KEY_CHECKS=1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;


-- ===== 시스템 seed (clean install bootstrap) =====
SET FOREIGN_KEY_CHECKS=0;


--
-- 테이블의 덤프 데이터 `admins`
--

INSERT INTO `admins` (`id`, `username`, `password_hash`, `otp_secret`, `is_active`, `created_at`) VALUES
(1, 'admin', '$2y$10$CHANGEMEplaceholderHASHreplaceAFTERinstall0123456789ab', NULL, 1, '2026-02-12 15:44:34');


--
-- 테이블의 덤프 데이터 `app_settings`
--

INSERT INTO `app_settings` (`k`, `v`, `updated_at`) VALUES
('staking', '{\"payday\": 15, \"lock_days\": [14, 15]}', '2026-02-24 11:21:38');


--
-- 테이블의 덤프 데이터 `contract_templates`
--

INSERT INTO `contract_templates` (`id`, `template_code`, `template_name`, `template_title`, `body_html`, `body_text`, `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`) VALUES
(1, 'funding_subscription', '기본 투자 청약 전자계약서', '{{asset_name}} 투자 청약 전자계약서', '\n  <div class=\"contract-body\">\n    <h2 style=\"margin:0 0 14px\">투자 청약 전자계약서</h2>\n    <p>본 계약은 <strong>{{signed_date_kst}}</strong> 기준으로 Recon RWA 플랫폼과 아래 투자자 사이의 전자적 청약 계약입니다.</p>\n\n    <h3 style=\"margin:22px 0 10px\">1. 투자자 정보</h3>\n    <ul>\n      <li>지갑 주소: {{wallet_address}}</li>\n      <li>계약 기준시각(KST): {{signed_date_kst}}</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">2. 투자 대상 자산</h3>\n    <ul>\n      <li>자산 ID: {{asset_id}}</li>\n      <li>자산명: {{asset_name}}</li>\n      <li>시장명: {{market}}</li>\n      <li>국가: {{country_name}}</li>\n      <li>정산통화: {{settlement_basis}}</li>\n      <li>예상 연이율(APR): {{apr}}%</li>\n      <li>모금기간 종료일: {{fund_end_date}}</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">3. 청약 금액</h3>\n    <ul>\n      <li>청약금액(USDT): {{amount_usdt}} USDT</li>\n      <li>예상 현지통화 환산액: {{amount_local}} {{settlement_basis}}</li>\n      <li>적용 환율: 1 USDT = {{fx_per_usdt}} {{settlement_basis}}</li>\n      <li>최소 참여금액: {{min_usdt}} USDT</li>\n      <li>목표 모집금액: {{target_usdt}} USDT</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">4. 투자 유의사항</h3>\n    <ol>\n      <li>본 상품은 원금이 보장되지 않으며, 자산 운영 및 매각 결과에 따라 손실이 발생할 수 있습니다.</li>\n      <li>수익, 이자, 매각 정산은 대상 국가의 정산통화를 기준으로 계산되며 지급 시점 환율에 따라 USDT로 환산될 수 있습니다.</li>\n      <li>모집 완료 시점의 환율 및 발행량이 확정되며, 이후 변동될 수 없습니다.</li>\n      <li>플랫폼은 관련 법령, 내부통제, KYC/OTP 절차에 따라 투자 참여를 제한하거나 보류할 수 있습니다.</li>\n    </ol>\n\n    <h3 style=\"margin:22px 0 10px\">5. 전자문서 및 전자서명 동의</h3>\n    <p>투자자는 본 계약을 전자문서 형태로 열람하였고, 직접 입력한 자필 전자서명 및 OTP 검증을 통해 본 계약의 내용에 동의하며, 이는 서면 서명과 동일한 효력을 가지는 것에 동의합니다.</p>\n\n    <h3 style=\"margin:22px 0 10px\">6. 효력 발생</h3>\n    <p>본 계약은 투자자의 자필 전자서명과 OTP 검증이 완료되고, 실제 모금 참여가 정상 접수된 시점에 유효 접수됩니다. 이후 관리자의 최종 자필서명이 완료되면 계약 상태는 완료로 전환됩니다.</p>\n  </div>\n  ', NULL, 1, 1, 'system', 'system', '2026-03-10 03:59:55', '2026-03-10 03:59:55');


--
-- 테이블의 덤프 데이터 `fx_quote_latest`
--

INSERT INTO `fx_quote_latest` (`quote_currency`, `rate`, `provider`, `fetched_at`, `updated_at`) VALUES
('GEL', '2.72069000', 'open.er-api.com', '2026-03-24 13:19:40', '2026-03-24 13:19:40'),
('IDR', '16924.80904300', 'open.er-api.com', '2026-03-24 13:19:40', '2026-03-24 13:19:40'),
('KRW', '1488.07543500', 'open.er-api.com', '2026-03-24 13:19:40', '2026-03-24 13:19:40'),
('KZT', '481.76177500', 'open.er-api.com', '2026-03-24 13:19:40', '2026-03-24 13:19:40'),
('PHP', '59.72177300', 'open.er-api.com', '2026-03-24 13:19:40', '2026-03-24 13:19:40'),
('USD', '1.00000000', 'open.er-api.com', '2026-03-24 13:19:40', '2026-03-24 13:19:40'),
('VND', '26275.89301700', 'open.er-api.com', '2026-03-24 13:19:40', '2026-03-24 13:19:40');


--
-- 테이블의 덤프 데이터 `settings`
--

INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES
('deposit_admin_usdt_address', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', '2026-02-23 06:18:19'),
('fx_gel_per_usdt', '2.72069', '2026-03-24 00:43:14'),
('fx_idr_per_usdt', '16924.809043', '2026-03-24 00:43:14'),
('fx_krw_per_usdt', '1488.075435', '2026-03-24 00:43:14'),
('fx_kzt_per_usdt', '481.761775', '2026-03-24 00:43:14'),
('fx_mode', 'auto', '2026-02-24 13:04:59'),
('fx_php_per_usdt', '59.721773', '2026-03-24 00:43:14'),
('fx_usd_per_usdt', '1', '2026-02-24 14:20:33'),
('fx_vnd_per_usdt', '26275.893017', '2026-03-24 00:43:14'),
('fx_worker_last_error', '', '2026-02-24 14:20:33'),
('fx_worker_last_success_at', '2026-03-24 13:19:40', '2026-03-24 13:19:40'),
('fx_worker_provider', 'open.er-api.com', '2026-02-24 14:20:33'),
('withdraw_admin_usdt_address', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', '2026-03-11 11:22:16');


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


-- 초기 5% 시드
INSERT INTO `interest_rate_history` (`rate_bps`, `effective_from_payout`, `prev_rate_bps`, `created_by`, `reason`)
VALUES (500, '2026-01-15', NULL, 'system', '초기 설정')
ON DUPLICATE KEY UPDATE `id` = `id`;


-- ----------------------------------------------------------------
-- 15. INSERT 마이그레이션 완료 마커
-- ----------------------------------------------------------------

INSERT INTO `app_settings` (`k`, `v`) VALUES
  ('silica_schema_version', JSON_QUOTE('1.0.0')),
  ('silica_schema_migrated_at', JSON_QUOTE(DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%sZ')))
ON DUPLICATE KEY UPDATE `v` = VALUES(`v`);


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

SET FOREIGN_KEY_CHECKS=1;
