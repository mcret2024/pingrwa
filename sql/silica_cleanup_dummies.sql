-- ============================================================
-- silica_cleanup_dummies.sql
--
-- 목적 : rwa.sql 시드 더미 데이터 일괄 제거
-- 보존 : SILICA-79907 자산 + admins + 시스템 설정/템플릿/FX
-- 제거 : APT001~005·test001 자산 + 모든 사용자 활동 기록
--
-- 우선순위 : 95 (silica_schema_migration.sql 90 이후 실행)
-- 멱등성   : 재실행 안전 (DELETE 기반, 누락 테이블은 install.php 가 무시)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------
-- 0. wallet_transactions DELETE 차단 트리거 임시 제거
--    (rwa.sql 의 trg_wallet_transactions_no_delete 가 DELETE 막음)
-- ----------------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_wallet_transactions_no_delete`;

-- ----------------------------------------------------------------
-- 1. 사용자 활동 데이터 모두 비움 (실 사용자 없음)
-- ----------------------------------------------------------------

-- 자산 보유/거래/잔액
DELETE FROM `holdings`;
DELETE FROM `sales`;
DELETE FROM `balances`;

-- 지갑 트랜잭션·출금
DELETE FROM `wallet_transactions`;
DELETE FROM `withdraw_requests`;
DELETE FROM `token_withdraw_requests`;

-- 펀딩·계약·KYC·감사
DELETE FROM `funding_records`;
DELETE FROM `kyc_sessions`;
DELETE FROM `contract_audit_logs`;
DELETE FROM `auth_nonces`;

-- 이자·배당·추천인
DELETE FROM `interest_claims`;
DELETE FROM `dividend_payouts`;
DELETE FROM `silica_swaps`;
DELETE FROM `referrals`;
DELETE FROM `silica_referral_bonus`;
DELETE FROM `referral_bonus_events`;
DELETE FROM `pending_referral_bonuses`;

-- ----------------------------------------------------------------
-- 2. 사용자 마스터 비움 (실 사용자 없음)
-- ----------------------------------------------------------------

DELETE FROM `users`;

-- ----------------------------------------------------------------
-- 3. 더미 자산 제거 (SILICA-79907 만 보존)
-- ----------------------------------------------------------------

-- APT001~005·test001 + 그 외 모든 비-silica 자산 제거
DELETE FROM `assets` WHERE `id` != 'SILICA-79907';

-- ----------------------------------------------------------------
-- 4. 플랫폼 잔액 0으로 리셋 (시스템 메타 유지, 잔액만)
-- ----------------------------------------------------------------

UPDATE `platform_balance` SET `usdt_balance` = 0;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------
-- 5. wallet_transactions DELETE 차단 트리거 재생성
--    (보안 가드 복원 — 운영 중 wallet_transactions DELETE 방지)
--    DELIMITER 없이 단일 문장 형식 (PHP PDO 호환)
-- ----------------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_wallet_transactions_no_delete`;

CREATE TRIGGER `trg_wallet_transactions_no_delete` BEFORE DELETE ON `wallet_transactions` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'wallet_transactions delete blocked';
