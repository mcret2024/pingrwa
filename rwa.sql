-- phpMyAdmin SQL Dump
-- version 5.1.1deb5ubuntu1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- 생성 시간: 26-03-24 22:21
-- 서버 버전: 8.0.45-0ubuntu0.22.04.1
-- PHP 버전: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 데이터베이스: `rwa`
--

-- --------------------------------------------------------

--
-- 테이블 구조 `admins`
--

CREATE TABLE `admins` (
  `id` bigint NOT NULL,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `otp_secret` varchar(64) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `admins`
--

INSERT INTO `admins` (`id`, `username`, `password_hash`, `otp_secret`, `is_active`, `created_at`) VALUES
(1, 'admin', '$2y$10$uUT0dJjPGEa/ciaxus.WI.Wy1N8jDKSg3Oe.3J9Lp1PGfJNifEdY6', NULL, 1, '2026-02-12 15:44:34');

-- --------------------------------------------------------

--
-- 테이블 구조 `app_settings`
--

CREATE TABLE `app_settings` (
  `k` varchar(64) NOT NULL,
  `v` json NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `app_settings`
--

INSERT INTO `app_settings` (`k`, `v`, `updated_at`) VALUES
('staking', '{\"payday\": 15, \"lock_days\": [14, 15]}', '2026-02-24 11:21:38');

-- --------------------------------------------------------

--
-- 테이블 구조 `assets`
--

CREATE TABLE `assets` (
  `id` varchar(16) NOT NULL,
  `country_code` enum('KR','US','KZ','PH','GE','ID','VN') NOT NULL DEFAULT 'KR',
  `market` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(64) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `map_query` varchar(255) DEFAULT NULL,
  `google_map_url` varchar(512) DEFAULT NULL,
  `settlement_basis` enum('KRW','USD','KZT','PHP','GEL','IDR','VND') NOT NULL DEFAULT 'KRW',
  `payout_currency` enum('USDT') NOT NULL DEFAULT 'USDT',
  `fx_at_funding` int NOT NULL DEFAULT '1350',
  `official_price_krw` bigint DEFAULT NULL,
  `status` enum('모집중','구매진행','분배중','운영중','매각','모집실패') NOT NULL DEFAULT '모집중',
  `apr` decimal(5,2) NOT NULL DEFAULT '8.00',
  `term_years` int NOT NULL DEFAULT '2',
  `maturity_date` date DEFAULT NULL,
  `expected_buy_price_usdt` decimal(18,2) DEFAULT NULL,
  `target_usdt` decimal(18,2) NOT NULL DEFAULT '0.00',
  `raised_usdt` decimal(18,2) NOT NULL DEFAULT '0.00',
  `supply_token` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `funded_snapshot_usdt` decimal(18,2) DEFAULT NULL,
  `min_usdt` decimal(18,2) NOT NULL DEFAULT '50.00',
  `fee_buyer` decimal(5,2) NOT NULL DEFAULT '0.50',
  `fee_seller` decimal(5,2) NOT NULL DEFAULT '0.50',
  `image_url` varchar(255) DEFAULT NULL,
  `token_image_url` varchar(255) DEFAULT NULL,
  `overview` text,
  `fund_end_date` date DEFAULT NULL,
  `is_public` tinyint NOT NULL DEFAULT 1,
  `token_mint_address` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `assets`
--

INSERT INTO `assets` (`id`, `country_code`, `market`, `name`, `type`, `location`, `map_query`, `settlement_basis`, `payout_currency`, `fx_at_funding`, `official_price_krw`, `status`, `apr`, `term_years`, `maturity_date`, `expected_buy_price_usdt`, `target_usdt`, `raised_usdt`, `supply_token`, `funded_snapshot_usdt`, `min_usdt`, `fee_buyer`, `fee_seller`, `image_url`, `token_image_url`, `overview`, `fund_end_date`, `is_public`, `token_mint_address`, `created_at`, `updated_at`) VALUES
('APT001', 'KR', 'APT001/USDT', '서울 강남 오피스텔 101호', '오피스텔', '서울 강남구 테헤란로(예시)', '서울 강남구 테헤란로', 'KRW', 'USDT', 1320, 1400000000, '운영중', '8.00', 2, '2028-02-01', '1000.00', '1200.00', '200.00', '0.000000', '0.00', '50.00', '0.50', '0.50', '/assets/images/property-apt001.svg', '/assets/images/token-apt001.svg', '강남 입지권역 오피스텔. 임대 수요 기반.', '2026-04-09', 1, NULL, '2026-02-12 13:29:42', '2026-03-11 08:10:58'),
('APT002', 'KR', 'APT002/USDT', '부산 해운대 레지던스 502호', '레지던스', '부산 해운대구 해운대로(예시)', '부산 해운대구 해운대로', 'KRW', 'USDT', 1310, 1650000000, '모집중', '7.50', 3, '2029-02-01', '1200.00', '1440.00', '0.00', '0.000000', '0.00', '50.00', '0.50', '0.50', '/assets/images/property-apt002.svg', '/assets/images/token-apt002.svg', '해운대 관광 수요 기반.', '2026-04-09', 1, NULL, '2026-02-12 13:29:42', '2026-03-11 08:34:05'),
('APT003', 'KR', 'APT003/USDT', '대구 수성구 상가 1층', '상가', '대구 수성구(예시)', '대구 수성구', 'KRW', 'USDT', 1290, 1350000000, '모집중', '9.20', 2, '2028-01-15', '1200.00', '1440.00', '0.00', '0.000000', NULL, '50.00', '0.50', '0.50', '/assets/images/property-apt003.svg', '/assets/images/token-apt003.svg', '상권 중심 상가. 매각 완료 후 정산.', '2026-04-09', 1, NULL, '2026-02-12 13:29:42', '2026-03-10 09:52:26'),
('APT004', 'KR', 'APT004/USDT', '인천 송도 오피스 12층', '오피스', '인천 연수구 송도동(예시)', '인천 연수구 송도동', 'KRW', 'USDT', 1340, 2250000000, '모집중', '8.80', 2, '2028-06-01', '1800.00', '2160.00', '0.00', '0.000000', NULL, '50.00', '0.50', '0.50', '/assets/images/property-apt004.svg', '/assets/images/token-apt004.svg', '송도 국제도시 오피스. 매입 완료 후 분배중.', '2026-04-09', 1, NULL, '2026-02-12 13:29:42', '2026-03-10 09:52:26'),
('APT005', 'KR', 'APT005/USDT', 'APT005', NULL, NULL, NULL, 'KRW', 'USDT', 1350, NULL, '모집중', '8.00', 2, NULL, NULL, '1200.00', '0.00', '0.000000', NULL, '50.00', '0.50', '0.50', '/uploads/APT005_image_1770989623926_2608598277_20260213140314390145.jpg', '/uploads/APT005_token_1770989624087_photoinfra_1466762718363.jpg', NULL, '2026-04-09', 1, NULL, '2026-02-13 12:08:00', '2026-03-10 09:52:26'),
('test001', 'KR', 'test001/USDT', '테스트빌딩', '빌딩', '양산역', NULL, 'KRW', 'USDT', 1488, 2000, '모집중', '8.00', 2, NULL, '2000.00', '1000.00', '0.00', '2976000.000000', '2000.00', '50.00', '0.50', '0.50', NULL, NULL, NULL, NULL, 1, NULL, '2026-03-24 12:03:15', '2026-03-24 12:24:30');

-- --------------------------------------------------------

--
-- 테이블 구조 `asset_contract_templates`
--

CREATE TABLE `asset_contract_templates` (
  `asset_id` varchar(50) NOT NULL,
  `template_id` bigint UNSIGNED NOT NULL,
  `required_otp` tinyint(1) NOT NULL DEFAULT '1',
  `required_user_signature` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `asset_docs`
--

CREATE TABLE `asset_docs` (
  `id` bigint NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `doc_type` enum('proof','valuation','sale') NOT NULL,
  `title` varchar(255) NOT NULL,
  `doc_date` date DEFAULT NULL,
  `amount` bigint DEFAULT NULL,
  `amount_currency` enum('KRW','USD','KZT','PHP','GEL','IDR','VND') DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `asset_key_info`
--

CREATE TABLE `asset_key_info` (
  `id` bigint NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `k` varchar(64) NOT NULL,
  `v` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `auth_nonces`
--

CREATE TABLE `auth_nonces` (
  `address` varchar(64) NOT NULL,
  `nonce` varchar(128) NOT NULL,
  `expires_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `auth_nonces`
--

INSERT INTO `auth_nonces` (`address`, `nonce`, `expires_at`, `updated_at`) VALUES
('7oWYGTGQWDDvpT77Q3KzDuXu74kTbwBgxuEcktEGB2tU', 'c4g54fso1hc-mn4l7ljn', '2026-03-24 12:34:55', '2026-03-24 12:24:54'),
('9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '1g31gklq4kw-mn4ao66p', '2026-03-24 07:39:52', '2026-03-24 07:29:52'),
('Azp87VRTfof8feQMDrndD1L9WAZGYk7JhSHuX6gScwXu', 'a9gj6toa6ke-mmm3ym92', '2026-03-11 14:12:11', '2026-03-11 14:02:11'),
('BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', '3itq7nq0xe3-mn4migju', '2026-03-24 13:11:21', '2026-03-24 13:01:21'),
('HVhAJauURRSKpCwbNDL2DV6PTwMuHXykM886ySPVdV6p', 'f9iwzgejlmp-mn4mg9r7', '2026-03-24 13:09:39', '2026-03-24 12:59:39');

-- --------------------------------------------------------

--
-- 테이블 구조 `balances`
--

CREATE TABLE `balances` (
  `address` varchar(64) NOT NULL,
  `usdt` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `balances`
--

INSERT INTO `balances` (`address`, `usdt`, `updated_at`) VALUES
('7oWYGTGQWDDvpT77Q3KzDuXu74kTbwBgxuEcktEGB2tU', '0.000000', '2026-02-23 12:15:24'),
('9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '100000.008074', '2026-03-02 09:06:15'),
('Azp87VRTfof8feQMDrndD1L9WAZGYk7JhSHuX6gScwXu', '0.000000', '2026-03-11 14:02:15'),
('BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', '3300.000000', '2026-03-10 14:40:45'),
('HVhAJauURRSKpCwbNDL2DV6PTwMuHXykM886ySPVdV6p', '0.000000', '2026-03-10 07:35:59'),
('So4EbtqYQ8wSPWYYYCLj2v2SyGuFc9sKngbyGw4U', '3300.000000', '2026-02-13 15:00:30'),
('SokK7f82XSo7Qxc4xaHwQ8G1bFGNPCGMc42KTgyE', '100000.000000', '2026-02-13 11:43:27');

-- --------------------------------------------------------

--
-- 테이블 구조 `claim_records`
--

CREATE TABLE `claim_records` (
  `id` bigint NOT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `ok` tinyint NOT NULL DEFAULT '0',
  `message` varchar(255) DEFAULT NULL,
  `funded_usdt` decimal(18,2) DEFAULT NULL,
  `denom_snapshot_usdt` decimal(18,2) DEFAULT NULL,
  `supply_token_snapshot` decimal(18,6) DEFAULT NULL,
  `entitled_token` decimal(18,6) DEFAULT NULL,
  `already_claimed_token` decimal(18,6) DEFAULT NULL,
  `claimed_token` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `contract_audit_logs`
--

CREATE TABLE `contract_audit_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `contract_id` bigint UNSIGNED NOT NULL,
  `actor_type` enum('user','admin','system') NOT NULL,
  `actor_id` varchar(120) DEFAULT NULL,
  `action_type` varchar(60) NOT NULL,
  `ip` varchar(128) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `payload_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `contract_audit_logs`
--

INSERT INTO `contract_audit_logs` (`id`, `contract_id`, `actor_type`, `actor_id`, `action_type`, `ip`, `user_agent`, `payload_json`, `created_at`) VALUES
(1, 1, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:13:37'),
(2, 2, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:14:10'),
(3, 3, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:15:05'),
(4, 4, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:28:11'),
(5, 5, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:47:48'),
(6, 6, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:48:24'),
(7, 7, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:53:34'),
(8, 8, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:55:13'),
(9, 9, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 04:58:57'),
(10, 10, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:02:44'),
(11, 11, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:15:30'),
(12, 12, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:18:17'),
(13, 13, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:20:50'),
(14, 14, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:21:04'),
(15, 15, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:25:18'),
(16, 16, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:29:16'),
(17, 17, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:30:25'),
(18, 18, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:31:40'),
(19, 19, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:35:30'),
(20, 20, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:38:56'),
(21, 21, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:42:04'),
(22, 22, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:49:36'),
(23, 23, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 05:58:43'),
(24, 24, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:01:44'),
(25, 25, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:05:16'),
(26, 26, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:12:03'),
(27, 27, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:12:23'),
(28, 28, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:15:19'),
(29, 29, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:21:01'),
(30, 30, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:21:18'),
(31, 31, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:21:55'),
(32, 32, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:24:28'),
(33, 33, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:26:40'),
(34, 34, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:27:24'),
(35, 35, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:39:45'),
(36, 36, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:50:32'),
(37, 37, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:56:44'),
(38, 38, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:57:39'),
(39, 39, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 06:59:01'),
(40, 40, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 07:07:41'),
(41, 41, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 07:14:24'),
(42, 42, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Avast/144.0.0.0', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 07:24:47'),
(43, 43, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 07:44:15'),
(44, 44, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 08:08:38'),
(45, 44, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'user_signed', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"signer_name\": \"김광혁\", \"signature_path\": \"/uploads/user_contract_44_1773130164982_akwatx.png\"}', '2026-03-10 08:09:24'),
(46, 45, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 08:35:09'),
(47, 45, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'user_signed', '86.38.95.134', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"signer_name\": \"김광혁\", \"signature_path\": \"/uploads/user_contract_45_1773131717254_zc7s9z.png\"}', '2026-03-10 08:35:17'),
(48, 46, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"asset_id\": \"APT004\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 08:50:57'),
(49, 46, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'user_signed', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"signer_name\": \"김광혁\", \"signature_path\": \"/uploads/user_contract_46_1773132663158_oful0a.png\"}', '2026-03-10 08:51:03'),
(50, 47, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'draft_created', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"asset_id\": \"APT001\", \"amount_usdt\": \"100.000000\", \"fx_per_usdt\": \"1477.004645\", \"settlement_basis\": \"KRW\"}', '2026-03-10 10:00:20'),
(51, 47, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'user_signed', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"signer_name\": \"김광혁\", \"signature_path\": \"/uploads/user_contract_47_1773136827474_pmocz3.png\"}', '2026-03-10 10:00:27'),
(52, 47, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'funding_submitted', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"amount_usdt\": \"100.000000\", \"funding_record_id\": 8}', '2026-03-10 10:00:51'),
(53, 47, 'admin', 'admin', 'admin_signed', NULL, NULL, '{\"admin_signature_path\": \"/uploads/admin_contract_47_1773142085198_qdaie1.png\"}', '2026-03-10 11:28:05'),
(54, 49, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'user_signed', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"signer_name\": \"김광혁\", \"signature_path\": \"/uploads/user_contract_49_1773153628902_vn2hfg.png\"}', '2026-03-10 14:40:28'),
(55, 49, 'user', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'funding_submitted', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '{\"amount_usdt\": \"100.000000\", \"funding_record_id\": 9}', '2026-03-10 14:40:45'),
(56, 49, 'admin', 'admin', 'admin_signed', NULL, NULL, '{\"admin_signature_path\": \"/uploads/admin_contract_49_1773154110421_1pvej1.png\"}', '2026-03-10 14:48:30');

-- --------------------------------------------------------

--
-- 테이블 구조 `contract_templates`
--

CREATE TABLE `contract_templates` (
  `id` bigint UNSIGNED NOT NULL,
  `template_code` varchar(64) NOT NULL,
  `template_name` varchar(120) NOT NULL,
  `template_title` varchar(255) NOT NULL,
  `body_html` mediumtext NOT NULL,
  `body_text` mediumtext,
  `version_no` int NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` varchar(64) DEFAULT NULL,
  `updated_by` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `contract_templates`
--

INSERT INTO `contract_templates` (`id`, `template_code`, `template_name`, `template_title`, `body_html`, `body_text`, `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`) VALUES
(1, 'funding_subscription', '기본 투자 청약 전자계약서', '{{asset_name}} 투자 청약 전자계약서', '\n  <div class=\"contract-body\">\n    <h2 style=\"margin:0 0 14px\">투자 청약 전자계약서</h2>\n    <p>본 계약은 <strong>{{signed_date_kst}}</strong> 기준으로 Recon RWA 플랫폼과 아래 투자자 사이의 전자적 청약 계약입니다.</p>\n\n    <h3 style=\"margin:22px 0 10px\">1. 투자자 정보</h3>\n    <ul>\n      <li>지갑 주소: {{wallet_address}}</li>\n      <li>계약 기준시각(KST): {{signed_date_kst}}</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">2. 투자 대상 자산</h3>\n    <ul>\n      <li>자산 ID: {{asset_id}}</li>\n      <li>자산명: {{asset_name}}</li>\n      <li>시장명: {{market}}</li>\n      <li>국가: {{country_name}}</li>\n      <li>정산통화: {{settlement_basis}}</li>\n      <li>예상 연이율(APR): {{apr}}%</li>\n      <li>모금기간 종료일: {{fund_end_date}}</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">3. 청약 금액</h3>\n    <ul>\n      <li>청약금액(USDT): {{amount_usdt}} USDT</li>\n      <li>예상 현지통화 환산액: {{amount_local}} {{settlement_basis}}</li>\n      <li>적용 환율: 1 USDT = {{fx_per_usdt}} {{settlement_basis}}</li>\n      <li>최소 참여금액: {{min_usdt}} USDT</li>\n      <li>목표 모집금액: {{target_usdt}} USDT</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">4. 투자 유의사항</h3>\n    <ol>\n      <li>본 상품은 원금이 보장되지 않으며, 자산 운영 및 매각 결과에 따라 손실이 발생할 수 있습니다.</li>\n      <li>수익, 이자, 매각 정산은 대상 국가의 정산통화를 기준으로 계산되며 지급 시점 환율에 따라 USDT로 환산될 수 있습니다.</li>\n      <li>모집 완료 시점의 환율 및 발행량이 확정되며, 이후 변동될 수 없습니다.</li>\n      <li>플랫폼은 관련 법령, 내부통제, KYC/OTP 절차에 따라 투자 참여를 제한하거나 보류할 수 있습니다.</li>\n    </ol>\n\n    <h3 style=\"margin:22px 0 10px\">5. 전자문서 및 전자서명 동의</h3>\n    <p>투자자는 본 계약을 전자문서 형태로 열람하였고, 직접 입력한 자필 전자서명 및 OTP 검증을 통해 본 계약의 내용에 동의하며, 이는 서면 서명과 동일한 효력을 가지는 것에 동의합니다.</p>\n\n    <h3 style=\"margin:22px 0 10px\">6. 효력 발생</h3>\n    <p>본 계약은 투자자의 자필 전자서명과 OTP 검증이 완료되고, 실제 모금 참여가 정상 접수된 시점에 유효 접수됩니다. 이후 관리자의 최종 자필서명이 완료되면 계약 상태는 완료로 전환됩니다.</p>\n  </div>\n  ', NULL, 1, 1, 'system', 'system', '2026-03-10 03:59:55', '2026-03-10 03:59:55');

-- --------------------------------------------------------

--
-- 테이블 구조 `funding_records`
--

CREATE TABLE `funding_records` (
  `id` bigint NOT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `contract_id` bigint UNSIGNED DEFAULT NULL,
  `amount_usdt` decimal(18,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `funding_records`
--

INSERT INTO `funding_records` (`id`, `address`, `asset_id`, `contract_id`, `amount_usdt`, `created_at`) VALUES
(8, 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'APT001', 47, '100.00', '2026-03-10 10:00:51'),
(9, 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'APT001', 49, '100.00', '2026-03-10 14:40:45');

-- --------------------------------------------------------

--
-- 테이블 구조 `fx_quotes`
--

CREATE TABLE `fx_quotes` (
  `id` bigint NOT NULL,
  `provider` varchar(32) NOT NULL,
  `base_currency` varchar(8) NOT NULL DEFAULT 'USDT',
  `quote_currency` varchar(8) NOT NULL,
  `rate` decimal(24,8) NOT NULL DEFAULT '0.00000000',
  `fetched_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `fx_quote_latest`
--

CREATE TABLE `fx_quote_latest` (
  `quote_currency` varchar(8) NOT NULL,
  `rate` decimal(24,8) NOT NULL DEFAULT '0.00000000',
  `provider` varchar(32) NOT NULL,
  `fetched_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- --------------------------------------------------------

--
-- 테이블 구조 `holdings`
--

CREATE TABLE `holdings` (
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `balance_token` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `staked_token` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `claimed_token` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `redeemed_token` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `holdings`
--

INSERT INTO `holdings` (`address`, `asset_id`, `balance_token`, `staked_token`, `claimed_token`, `redeemed_token`, `updated_at`) VALUES
('9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'APT001', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-10 09:52:26'),
('9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'APT002', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-10 09:52:26'),
('9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'APT003', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-10 09:52:26'),
('9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'APT004', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-10 09:52:26'),
('9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'APT005', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-10 09:52:26'),
('BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'APT001', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-12 02:36:06'),
('BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'APT002', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-10 09:52:26'),
('BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'APT003', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-10 09:52:26'),
('BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'APT004', '0.000000', '0.000000', '0.000000', '0.000000', '2026-03-10 09:52:26');

-- --------------------------------------------------------

--
-- 테이블 구조 `interest_claims`
--

CREATE TABLE `interest_claims` (
  `id` bigint NOT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `month_key` char(7) NOT NULL,
  `settlement_basis` enum('KRW','USD','KZT','PHP','GEL','IDR','VND') NOT NULL DEFAULT 'KRW',
  `staked_snapshot` decimal(18,6) NOT NULL,
  `apr_snapshot` decimal(5,2) NOT NULL,
  `official_price_krw_snapshot` bigint DEFAULT NULL,
  `fx_krw_per_usdt` int NOT NULL,
  `amount_local` decimal(24,4) NOT NULL DEFAULT '0.0000',
  `fx_per_usdt` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `amount_usdt` decimal(18,6) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `investment_contracts`
--

CREATE TABLE `investment_contracts` (
  `id` bigint UNSIGNED NOT NULL,
  `contract_no` varchar(40) NOT NULL,
  `asset_id` varchar(50) NOT NULL,
  `address` varchar(120) NOT NULL,
  `template_id` bigint UNSIGNED NOT NULL,
  `template_code` varchar(64) NOT NULL,
  `template_version` int NOT NULL,
  `status` enum('draft','user_signed','awaiting_admin','completed','rejected','void') NOT NULL DEFAULT 'draft',
  `contract_title` varchar(255) NOT NULL,
  `contract_body_html` mediumtext NOT NULL,
  `contract_body_text` mediumtext,
  `amount_usdt` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `amount_local` decimal(24,6) DEFAULT NULL,
  `settlement_basis` varchar(10) NOT NULL DEFAULT 'KRW',
  `fx_per_usdt` decimal(24,6) NOT NULL DEFAULT '0.000000',
  `signer_name` varchar(120) NOT NULL DEFAULT '',
  `consent_electronic` tinyint(1) NOT NULL DEFAULT '0',
  `consent_signature` tinyint(1) NOT NULL DEFAULT '0',
  `user_signature_path` varchar(255) DEFAULT NULL,
  `user_signed_at` datetime DEFAULT NULL,
  `user_signed_ip` varchar(128) DEFAULT NULL,
  `user_signed_user_agent` varchar(255) DEFAULT NULL,
  `otp_verified_at` datetime DEFAULT NULL,
  `funding_record_id` bigint UNSIGNED DEFAULT NULL,
  `admin_signature_path` varchar(255) DEFAULT NULL,
  `admin_signed_by` varchar(64) DEFAULT NULL,
  `admin_signed_at` datetime DEFAULT NULL,
  `finalized_pdf_path` varchar(255) DEFAULT NULL,
  `rejected_reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `investment_contracts`
--

INSERT INTO `investment_contracts` (`id`, `contract_no`, `asset_id`, `address`, `template_id`, `template_code`, `template_version`, `status`, `contract_title`, `contract_body_html`, `contract_body_text`, `amount_usdt`, `amount_local`, `settlement_basis`, `fx_per_usdt`, `signer_name`, `consent_electronic`, `consent_signature`, `user_signature_path`, `user_signed_at`, `user_signed_ip`, `user_signed_user_agent`, `otp_verified_at`, `funding_record_id`, `admin_signature_path`, `admin_signed_by`, `admin_signed_at`, `finalized_pdf_path`, `rejected_reason`, `created_at`, `updated_at`) VALUES
(49, 'CTR-20260310234020-M1974L', 'APT001', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 1, 'funding_subscription', 1, 'completed', '서울 강남 오피스텔 101호 투자 청약 전자계약서', '\n  <div class=\"contract-body\">\n    <h2 style=\"margin:0 0 14px\">투자 청약 전자계약서</h2>\n    <p>본 계약은 <strong>2026-03-10 23:40:20</strong> 기준으로 Recon RWA 플랫폼과 아래 투자자 사이의 전자적 청약 계약입니다.</p>\n\n    <h3 style=\"margin:22px 0 10px\">1. 투자자 정보</h3>\n    <ul>\n      <li>지갑 주소: BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu</li>\n      <li>계약 기준시각(KST): 2026-03-10 23:40:20</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">2. 투자 대상 자산</h3>\n    <ul>\n      <li>자산 ID: APT001</li>\n      <li>자산명: 서울 강남 오피스텔 101호</li>\n      <li>시장명: APT001/USDT</li>\n      <li>국가: 대한민국</li>\n      <li>정산통화: KRW</li>\n      <li>예상 연이율(APR): 8%</li>\n      <li>운영기간(년): 2</li>\n      <li>만기일: Tue Feb 01 2028 00:00:00 GMT+0000 (Coordinated Universal Time)</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">3. 청약 금액</h3>\n    <ul>\n      <li>청약금액(USDT): 100.000000 USDT</li>\n      <li>예상 현지통화 환산액: 147700.464500 KRW</li>\n      <li>적용 환율: 1 USDT = 1477.004645 KRW</li>\n      <li>최소 참여금액: 50.000000 USDT</li>\n      <li>목표 모집금액: 1200.000000 USDT</li>\n    </ul>\n\n    <h3 style=\"margin:22px 0 10px\">4. 투자 유의사항</h3>\n    <ol>\n      <li>본 상품은 원금이 보장되지 않으며, 자산 운영 및 매각 결과에 따라 손실이 발생할 수 있습니다.</li>\n      <li>수익, 이자, 매각 정산은 대상 국가의 정산통화를 기준으로 계산되며 지급 시점 환율에 따라 USDT로 환산될 수 있습니다.</li>\n      <li>모집 완료 시점의 환율 및 발행량이 확정되며, 이후 변동될 수 없습니다.</li>\n      <li>플랫폼은 관련 법령, 내부통제, KYC/OTP 절차에 따라 투자 참여를 제한하거나 보류할 수 있습니다.</li>\n    </ol>\n\n    <h3 style=\"margin:22px 0 10px\">5. 전자문서 및 전자서명 동의</h3>\n    <p>투자자는 본 계약을 전자문서 형태로 열람하였고, 직접 입력한 자필 전자서명 및 OTP 검증을 통해 본 계약의 내용에 동의하며, 이는 서면 서명과 동일한 효력을 가지는 것에 동의합니다.</p>\n\n    <h3 style=\"margin:22px 0 10px\">6. 효력 발생</h3>\n    <p>본 계약은 투자자의 자필 전자서명과 OTP 검증이 완료되고, 실제 모금 참여가 정상 접수된 시점에 유효 접수됩니다. 이후 관리자의 최종 자필서명이 완료되면 계약 상태는 완료로 전환됩니다.</p>\n  </div>\n  ', NULL, '100.000000', '147700.464500', 'KRW', '1477.004645', '김광혁', 1, 1, '/uploads/user_contract_49_1773153628902_vn2hfg.png', '2026-03-10 14:40:29', '110.9.22.198', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '2026-03-10 14:40:46', 9, '/uploads/admin_contract_49_1773154110421_1pvej1.png', 'admin', '2026-03-10 14:48:30', NULL, NULL, '2026-03-10 14:40:20', '2026-03-10 14:48:30');

-- --------------------------------------------------------

--
-- 테이블 구조 `kyc_sessions`
--

CREATE TABLE `kyc_sessions` (
  `id` bigint UNSIGNED NOT NULL,
  `session_id` varchar(128) NOT NULL,
  `address` varchar(128) NOT NULL,
  `doc_type` varchar(32) DEFAULT NULL,
  `session_url` text,
  `status` varchar(64) NOT NULL DEFAULT 'pending',
  `didit_status` varchar(128) DEFAULT NULL,
  `stored_name` text,
  `stored_birth` varchar(64) DEFAULT NULL,
  `extracted_name` text,
  `extracted_birth` varchar(64) DEFAULT NULL,
  `fail_reason` varchar(128) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_decision_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `kyc_sessions`
--

INSERT INTO `kyc_sessions` (`id`, `session_id`, `address`, `doc_type`, `session_url`, `status`, `didit_status`, `stored_name`, `stored_birth`, `extracted_name`, `extracted_birth`, `fail_reason`, `created_at`, `updated_at`, `last_decision_at`) VALUES
(2, '8c8c8c30-801c-450c-9491-3846bd0d494b', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'drivers_license', 'https://verify.didit.me/session/YBl50K9J0FiK', 'mismatch_name', 'Approved', '김광혁', '1974-11-28', '고역 김', '1974-11-28', 'mismatch_name', '2026-03-09 12:49:31', '2026-03-09 12:51:43', '2026-03-09 12:51:43'),
(13, 'b569bf18-b3e7-49d2-af1c-3353319a8f37', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'drivers_license', 'https://verify.didit.me/session/27KnZSOooRlA', 'mismatch_birth', 'Approved', '김광혁', '1974-11-28', '광혁 김', NULL, 'mismatch_birth', '2026-03-09 13:13:46', '2026-03-09 13:15:12', '2026-03-09 13:15:13'),
(15, '0de24f26-577b-4058-9c3a-3ddc4810f4f0', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'drivers_license', 'https://verify.didit.me/session/rEGkAOqWgwUQ', 'kyc_status_not_approved', 'Not Started', '김광혁', '1974-11-28', NULL, NULL, 'timeout', '2026-03-09 13:15:23', '2026-03-09 13:15:23', '2026-03-09 13:15:24'),
(17, 'd77b8509-aaac-48b2-825c-c6fd0c00f925', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'drivers_license', 'https://verify.didit.me/session/OSzrFOGKcVeY', 'mismatch_name', 'Approved', '김광혁', '1974-11-28', '과영 김', '1974-11-28', 'mismatch_name', '2026-03-09 13:17:08', '2026-03-09 13:19:13', '2026-03-09 13:19:13'),
(19, '839bd1e6-4730-4a76-a97c-9d2d38ae810b', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'drivers_license', 'https://verify.didit.me/session/UIbfoKBhVs_B', 'mismatch_name', 'Approved', '김광혁', '1974-11-28', '관혁 김', '1974-11-28', 'mismatch_name', '2026-03-09 13:19:18', '2026-03-09 13:22:20', '2026-03-09 13:22:20'),
(21, 'd1acbb7e-9451-499c-b402-91e13cb7614e', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'drivers_license', 'https://verify.didit.me/session/z1Iu_4nMQaLi', 'mismatch_name', 'Approved', '김광혁', '1974-11-28', '기양형 ㅅ', '1974-11-28', 'mismatch_name', '2026-03-09 13:22:24', '2026-03-09 13:23:58', '2026-03-09 13:23:58'),
(23, '42ac5ecf-e19c-46ec-a160-727ab2ab1c1b', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'id_card', 'https://verify.didit.me/session/SEtmuHWeFc8P', 'pending', 'Not Started', '김광혁', '1974-11-28', NULL, NULL, 'expired_before_recreate', '2026-03-09 13:24:11', '2026-03-09 13:24:11', NULL),
(25, 'b869fb0b-3d35-412c-b7cc-9f421de499aa', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'drivers_license', 'https://verify.didit.me/session/LRQCXL27OlIg', 'mismatch_name', 'Approved', '김광혁', '1974-11-28', '광혐 김', '1974-11-28', 'mismatch_name', '2026-03-10 02:43:01', '2026-03-10 02:45:09', '2026-03-10 02:45:10'),
(26, '4b68664a-2a32-44f2-9e15-3d578d3869a5', 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', 'drivers_license', 'https://verify.didit.me/session/Kt_hBAMGK3hv', 'succ', 'Approved', '김광혁', '1974-11-28', '광혁 김', '1974-11-28', NULL, '2026-03-10 02:46:09', '2026-03-10 02:47:53', '2026-03-10 02:47:54');

-- --------------------------------------------------------

--
-- 테이블 구조 `orders`
--

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
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `platform_balance`
--

CREATE TABLE `platform_balance` (
  `id` tinyint NOT NULL,
  `usdt_balance` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `platform_balance`
--

INSERT INTO `platform_balance` (`id`, `usdt_balance`, `updated_at`) VALUES
(1, '0.200000', '2026-02-14 09:00:33');

-- --------------------------------------------------------

--
-- 테이블 구조 `referrals`
--

CREATE TABLE `referrals` (
  `address` varchar(64) NOT NULL,
  `ref_code` varchar(128) NOT NULL,
  `set_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `refund_records`
--

CREATE TABLE `refund_records` (
  `id` bigint NOT NULL,
  `address` varchar(64) NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `amount_usdt` decimal(18,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `sales`
--

CREATE TABLE `sales` (
  `asset_id` varchar(16) NOT NULL,
  `buy_price_krw` bigint NOT NULL DEFAULT '0',
  `sold_price_krw` bigint NOT NULL DEFAULT '0',
  `expenses_krw` bigint NOT NULL DEFAULT '0',
  `input_currency` enum('KRW','USD','KZT','PHP','GEL','IDR','VND','USDT') NOT NULL DEFAULT 'KRW',
  `vault_balance_usdt` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `window_start` date DEFAULT NULL,
  `window_end` date DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `sales`
--

INSERT INTO `sales` (`asset_id`, `buy_price_krw`, `sold_price_krw`, `expenses_krw`, `input_currency`, `vault_balance_usdt`, `window_start`, `window_end`, `updated_at`) VALUES
('APT001', 0, 0, 0, 'KRW', '0.000000', NULL, NULL, '2026-03-11 07:54:01');

-- --------------------------------------------------------

--
-- 테이블 구조 `sale_redemptions`
--

CREATE TABLE `sale_redemptions` (
  `id` bigint NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `settlement_basis` enum('KRW','USD','KZT','PHP','GEL','IDR','VND') NOT NULL DEFAULT 'KRW',
  `address` varchar(64) NOT NULL,
  `tokens` decimal(18,6) NOT NULL,
  `amount_local` decimal(24,4) NOT NULL DEFAULT '0.0000',
  `fx_krw_per_usdt` int NOT NULL,
  `fx_per_usdt` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `usdt` decimal(18,6) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `settings`
--

CREATE TABLE `settings` (
  `key` varchar(64) NOT NULL,
  `value` varchar(255) NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- --------------------------------------------------------

--
-- 테이블 구조 `trades`
--

CREATE TABLE `trades` (
  `id` bigint NOT NULL,
  `asset_id` varchar(16) NOT NULL,
  `price` decimal(18,8) NOT NULL,
  `qty` decimal(18,6) NOT NULL,
  `maker_address` varchar(64) DEFAULT NULL,
  `taker_address` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- 테이블 구조 `users`
--

CREATE TABLE `users` (
  `address` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `otp_enabled` tinyint NOT NULL DEFAULT '0',
  `otp_secret` varchar(64) DEFAULT NULL,
  `otp_temp_secret` varchar(64) DEFAULT NULL,
  `otp_temp_created_at` datetime DEFAULT NULL,
  `otp_fail_count` int NOT NULL DEFAULT '0',
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

--
-- 테이블의 덤프 데이터 `users`
--

INSERT INTO `users` (`address`, `created_at`, `otp_enabled`, `otp_secret`, `otp_temp_secret`, `otp_temp_created_at`, `otp_fail_count`, `otp_locked_until`, `otp_last_verified_at`, `kyc_yn`, `mt_name`, `mt_birth`, `kyc_doc_type`, `kyc_doc_ip`, `kyc_doc_regdate`, `kyc_session_id`, `kyc_status`, `kyc_extracted_name`, `kyc_extracted_birth`, `kyc_last_verified_at`) VALUES
('7oWYGTGQWDDvpT77Q3KzDuXu74kTbwBgxuEcktEGB2tU', '2026-02-23 12:15:24', 1, 'EY2UA2CMNBOV2PBDOVMCQ4RJKRZCYORJ', NULL, NULL, 0, NULL, '2026-03-24 12:25:35', 'N', '7YWM7Iqk7YSw', 'MjAyNi0wMy0yNA==', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '2026-02-13 14:12:11', 1, 'GMVDQOLJNNPFCYLMKR3FKT2KNFYXAVDX', NULL, NULL, 7, '2026-03-24 07:45:50', '2026-03-09 11:04:21', 'N', '6rmA6rSR7ZiB', 'MTk3NC0xMS0yOA==', NULL, NULL, NULL, '42ac5ecf-e19c-46ec-a160-727ab2ab1c1b', 'pending', NULL, NULL, NULL),
('Azp87VRTfof8feQMDrndD1L9WAZGYk7JhSHuX6gScwXu', '2026-03-11 14:02:15', 0, NULL, 'LMUC6TLZIFCDK3KMJJXV46BPFJUFIJCI', '2026-03-11 14:02:16', 0, NULL, NULL, 'N', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', '2026-02-23 03:49:18', 1, 'GB6VONTVGZFXWPCIGBFD6PS3JZOXWV3H', NULL, NULL, 0, NULL, '2026-03-24 13:02:02', 'Y', '6rmA6rSR7ZiB', 'MTk3NC0xMS0yOA==', 'drivers_license', '86.38.95.134', '2026-03-10 02:47:54', '4b68664a-2a32-44f2-9e15-3d578d3869a5', 'Approved', '광혁 김', '1974-11-28', '2026-03-10 02:47:54'),
('HVhAJauURRSKpCwbNDL2DV6PTwMuHXykM886ySPVdV6p', '2026-03-10 07:35:59', 1, 'GBHSGRTLJA4EW6SEHZTDSVKEERSVI6DM', NULL, NULL, 0, NULL, '2026-03-24 13:00:33', 'N', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('So4EbtqYQ8wSPWYYYCLj2v2SyGuFc9sKngbyGw4U', '2026-02-13 15:00:24', 0, NULL, NULL, NULL, 0, NULL, NULL, 'N', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('SokK7f82XSo7Qxc4xaHwQ8G1bFGNPCGMc42KTgyE', '2026-02-12 14:34:57', 0, NULL, NULL, NULL, 0, NULL, NULL, 'N', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Stand-in structure for view `wallet_balance_view`
-- (See below for the actual view)
--
CREATE TABLE `wallet_balance_view` (
`address` varchar(64)
,`usdt` decimal(18,6)
,`token_total` decimal(41,6)
);

-- --------------------------------------------------------

--
-- 테이블 구조 `wallet_transactions`
--

CREATE TABLE `wallet_transactions` (
  `id` bigint NOT NULL,
  `address` varchar(64) NOT NULL,
  `kind` enum('deposit','withdraw') NOT NULL DEFAULT 'deposit',
  `status` enum('대기','입금완료','출금신청','출금완료','출금취소','실패') NOT NULL DEFAULT '대기',
  `asset` enum('USDT') NOT NULL DEFAULT 'USDT',
  `amount` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `before_amount` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `after_amount` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `txid` varchar(128) DEFAULT NULL,
  `network_fee_lamports` bigint DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `wallet_transactions`
--

INSERT INTO `wallet_transactions` (`id`, `address`, `kind`, `status`, `asset`, `amount`, `before_amount`, `after_amount`, `txid`, `network_fee_lamports`, `memo`, `created_at`, `updated_at`) VALUES
(1, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'deposit', '입금완료', 'USDT', '1.000000', '100000.000000', '100001.000000', '58iY5daFweLQfPFYXRHedAk7LvQt6VMDNuhzSPxd83PtVQsNV68gxLJM9xBLJytSxBmJL8yyBw46vrSK1AdqzFsU', 80000, 'deposit', '2026-02-23 08:41:38', '2026-02-23 08:41:38'),
(2, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'deposit', '입금완료', 'USDT', '1.000000', '100001.000000', '100002.000000', '3Z9YpX1JoxGyXZiGMy7CBs2Qu3eLxvXk1TnQZwhLvvVq2dXNcEFENDjZ7mVfEc6Qygb6tJke83cLJKjbmvicfiFP', 80000, 'deposit', '2026-02-23 08:51:32', '2026-02-23 08:51:32'),
(3, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'withdraw', '출금완료', 'USDT', '1.000000', '100002.000000', '100001.000000', '5jZx2hJ57tFfmcSjWPqgSX3393HpZK9sVhmpv5NHT8WNtQr6P4Mq1dt428eSWYCXgeDaaRur9hrS27QqtwEgEMH7', 80000, 'withdraw_to:9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '2026-02-23 09:40:05', '2026-02-23 11:31:32'),
(4, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'withdraw', '출금취소', 'USDT', '1.000000', '100001.000000', '100000.000000', NULL, NULL, 'withdraw_to:9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '2026-02-23 09:41:33', '2026-02-23 11:38:46'),
(5, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'deposit', '입금완료', 'USDT', '1.000000', '100000.000000', '100001.000000', NULL, NULL, 'refund_withdraw_req:2|admin_cancel', '2026-02-23 11:38:46', '2026-02-23 11:38:46'),
(6, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'withdraw', '출금완료', 'USDT', '1.000000', '100001.000000', '100000.000000', '54eaY6SBx8HTUERrVgGyz5p7MnAANWjRbp8BEJtojiSBLX5gMpB425ZMw5j7HgP6wQGUHRsEYS85zsDniWn3M9fn', 80000, 'withdraw_to:9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '2026-02-23 11:43:25', '2026-02-23 11:43:52'),
(7, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'deposit', '입금완료', 'USDT', '1.000000', '100000.000000', '100001.000000', '2Gtqn7jyyCiE4KepiRQHCeubxjt83TMh2HhKq9G3YjMYfVzayePHRdjFZ3ogYRVx1VF8LREpF641oJCJ3bn9psaA', 80000, 'deposit', '2026-02-23 11:44:49', '2026-02-23 11:44:49'),
(8, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'withdraw', '출금완료', 'USDT', '1.000000', '100001.000000', '100000.000000', '5353j5qLY2Kdizvk21162TS3agnNzDpbD6BAhqpdbsBFkSBDJbpoD7Aqo2t2X8L6SAcpU2cu3bFcQgq2T1caZqUv', 80000, 'withdraw_to:9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '2026-02-23 12:18:56', '2026-03-11 11:04:08');

--
-- 트리거 `wallet_transactions`
--
DELIMITER $$
CREATE TRIGGER `trg_wallet_transactions_guard_update` BEFORE UPDATE ON `wallet_transactions` FOR EACH ROW BEGIN
  
  IF OLD.kind = 'deposit' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'deposit row update blocked';
  END IF;

  
  IF NEW.address <> OLD.address
     OR NEW.kind <> OLD.kind
     OR NEW.asset <> OLD.asset
     OR NEW.amount <> OLD.amount
     OR NEW.before_amount <> OLD.before_amount
     OR NEW.after_amount <> OLD.after_amount
     OR NEW.created_at <> OLD.created_at
  THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'immutable fields update blocked';
  END IF;

  
  IF OLD.status = '출금신청' THEN
    IF NOT (NEW.status IN ('출금완료','출금취소','실패')) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid status transition';
    END IF;
  ELSE
    
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'final status update blocked';
  END IF;

  
  IF NEW.status = '출금완료' THEN
    IF NEW.txid IS NULL OR NEW.txid = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'txid required on done';
    END IF;
  END IF;

  
  
END
$$
DELIMITER ;
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

CREATE TABLE `withdraw_requests` (
  `id` bigint NOT NULL,
  `wallet_tx_id` bigint NOT NULL,
  `address` varchar(64) NOT NULL,
  `to_address` varchar(64) NOT NULL,
  `asset` enum('USDT') NOT NULL DEFAULT 'USDT',
  `amount` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `status` enum('pending','processing','sent','done','canceled','failed') NOT NULL DEFAULT 'pending',
  `txid` varchar(128) DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- 테이블의 덤프 데이터 `withdraw_requests`
--

INSERT INTO `withdraw_requests` (`id`, `wallet_tx_id`, `address`, `to_address`, `asset`, `amount`, `status`, `txid`, `memo`, `created_at`, `updated_at`) VALUES
(1, 3, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'USDT', '1.000000', 'done', '5jZx2hJ57tFfmcSjWPqgSX3393HpZK9sVhmpv5NHT8WNtQr6P4Mq1dt428eSWYCXgeDaaRur9hrS27QqtwEgEMH7', 'user_request', '2026-02-23 09:40:05', '2026-02-23 11:31:30'),
(2, 4, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'USDT', '1.000000', 'canceled', NULL, 'admin_cancel', '2026-02-23 09:41:33', '2026-02-23 11:38:46'),
(3, 6, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'USDT', '1.000000', 'done', '54eaY6SBx8HTUERrVgGyz5p7MnAANWjRbp8BEJtojiSBLX5gMpB425ZMw5j7HgP6wQGUHRsEYS85zsDniWn3M9fn', 'user_request', '2026-02-23 11:43:25', '2026-02-23 11:43:50'),
(4, 8, '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', '9Z5h2hyFY3FGvBsSEU8EBt9ddkDXc2dQZp3Pg5iYzkL1', 'USDT', '1.000000', 'done', '5353j5qLY2Kdizvk21162TS3agnNzDpbD6BAhqpdbsBFkSBDJbpoD7Aqo2t2X8L6SAcpU2cu3bFcQgq2T1caZqUv', 'tx_verify_fail:허용되지 않은 명령이 포함되어 있습니다: L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95', '2026-02-23 12:18:56', '2026-03-11 11:04:06');

-- --------------------------------------------------------

--
-- 뷰 구조 `wallet_balance_view`
--
DROP TABLE IF EXISTS `wallet_balance_view`;

CREATE VIEW `wallet_balance_view` AS SELECT `b`.`address` AS `address`, `b`.`usdt` AS `usdt`, coalesce(sum((`h`.`balance_token` + `h`.`staked_token`)),0) AS `token_total` FROM (`balances` `b` left join `holdings` `h` on((`h`.`address` = `b`.`address`))) GROUP BY `b`.`address`, `b`.`usdt` ;

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
-- 테이블의 인덱스 `app_settings`
--
ALTER TABLE `app_settings`
  ADD PRIMARY KEY (`k`);

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
  ADD KEY `idx_asset_contract_templates_template_id` (`template_id`);

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
  ADD UNIQUE KEY `uniq_interest` (`address`,`asset_id`,`month_key`),
  ADD KEY `asset_id` (`asset_id`);

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
-- 테이블의 인덱스 `kyc_sessions`
--
ALTER TABLE `kyc_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_kyc_session_id` (`session_id`),
  ADD KEY `idx_kyc_sessions_address_status` (`address`,`status`,`created_at`);

--
-- 테이블의 인덱스 `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `maker_address` (`maker_address`),
  ADD KEY `idx_orders_asset_status` (`asset_id`,`status`),
  ADD KEY `idx_orders_expiry` (`expiry_date`,`status`);

--
-- 테이블의 인덱스 `platform_balance`
--
ALTER TABLE `platform_balance`
  ADD PRIMARY KEY (`id`);

--
-- 테이블의 인덱스 `referrals`
--
ALTER TABLE `referrals`
  ADD PRIMARY KEY (`address`);

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
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- 테이블의 AUTO_INCREMENT `asset_docs`
--
ALTER TABLE `asset_docs`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- 테이블의 AUTO_INCREMENT `asset_key_info`
--
ALTER TABLE `asset_key_info`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `claim_records`
--
ALTER TABLE `claim_records`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- 테이블의 AUTO_INCREMENT `contract_audit_logs`
--
ALTER TABLE `contract_audit_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=57;

--
-- 테이블의 AUTO_INCREMENT `contract_templates`
--
ALTER TABLE `contract_templates`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- 테이블의 AUTO_INCREMENT `funding_records`
--
ALTER TABLE `funding_records`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- 테이블의 AUTO_INCREMENT `fx_quotes`
--
ALTER TABLE `fx_quotes`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `interest_claims`
--
ALTER TABLE `interest_claims`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- 테이블의 AUTO_INCREMENT `investment_contracts`
--
ALTER TABLE `investment_contracts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- 테이블의 AUTO_INCREMENT `kyc_sessions`
--
ALTER TABLE `kyc_sessions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- 테이블의 AUTO_INCREMENT `refund_records`
--
ALTER TABLE `refund_records`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- 테이블의 AUTO_INCREMENT `sale_redemptions`
--
ALTER TABLE `sale_redemptions`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- 테이블의 AUTO_INCREMENT `trades`
--
ALTER TABLE `trades`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- 테이블의 AUTO_INCREMENT `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- 테이블의 AUTO_INCREMENT `withdraw_requests`
--
ALTER TABLE `withdraw_requests`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

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

-- --------------------------------------------------------

--
-- 테이블 구조 `token_withdraw_requests`
--

CREATE TABLE IF NOT EXISTS `token_withdraw_requests` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `address` VARCHAR(64) NOT NULL,
  `asset_id` VARCHAR(16) NOT NULL,
  `to_address` VARCHAR(64) NOT NULL,
  `amount_token` DECIMAL(24,6) NOT NULL DEFAULT 0,
  `status` ENUM('pending','processing','done','canceled','failed') NOT NULL DEFAULT 'pending',
  `txid` VARCHAR(128) DEFAULT NULL,
  `memo` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_twr_status (`status`),
  INDEX idx_twr_address (`address`),
  INDEX idx_twr_asset_id (`asset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
