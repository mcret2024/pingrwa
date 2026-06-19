-- AMM 관리자 작업 감사 로그 테이블
-- 2026-04-24: 관리자 AMM 작업(충전/회수/모드 전환/매도 주문 생성/취소) 전수 기록
--             다중 관리자 환경에서 책임 추적 및 운영 감사 목적

CREATE TABLE IF NOT EXISTS `amm_admin_audit` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_amm_audit_action` (`action`),
  KEY `idx_amm_audit_created_at` (`created_at`),
  KEY `idx_amm_audit_admin` (`admin_username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
