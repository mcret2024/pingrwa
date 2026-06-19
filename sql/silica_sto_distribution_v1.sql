-- ============================================================
-- SilicaSTO 분배 모델 v1 — 사전 발행 + Claim 장부(ledger) 분배
-- ============================================================
-- 효과:
--   1) app_settings 에 STO 분배 관리용 신규 키 3개 추가
--      - silica_sto_decimals       : SPL 토큰 decimals (1)
--      - silica_sto_total_minted   : 사전 발행 총량 (1,000,000,000)
--      - silica_sto_reserve_wallet : 1B STO 영구 보관 reserve 지갑 주소
--   2) v_silica_sto_distributed VIEW 추가 — 누적 분배(claim) 수량 즉시 조회
--      매각 분배 계산식의 분모로 사용 (RECON 의 supply_token 대체).
--
-- 정책 반영 (장부 모델):
--   - Pre-mint 1,000,000,000 STO 가 Reserve 에 영구 보관 — 플랫폼 원장 1:1 backing.
--   - 유저 투자 → 관리자 계약서 서명 → 유저 Claim 클릭 → 플랫폼 원장에 보유 기록.
--     (Claim 시점에 on-chain SPL Transfer 는 발생하지 않음 — 장부 기재.)
--   - 사이트 내부 모든 STO 이동 (스테이킹/스왑/거래/매각 정산) = 장부 처리.
--   - 외부 지갑 출금 시에만 Reserve → 외부 지갑 SPL Transfer 발생.
--   - 매각 정산: 매각 수익 ÷ "누적 분배(claim)" 수량 (장부 기준).
--   - 미분배 STO 소각 ❌ (Reserve 가 영구 backing 으로 잔존).
--
-- 적용 방법:
--   phpMyAdmin → rwa6 DB → SQL 탭 → 이 파일 내용 붙여넣기 → 실행
--
-- 주의:
--   - silica_sto_mint 키는 기존(silica_schema_migration.sql) 이미 존재 — 건너뜀.
--   - VIEW 는 holdings.claimed_token (DECIMAL(18,6)) 합계를 정수 STO 단위로 반올림.
-- ============================================================

-- ============================================================
-- 1) app_settings — STO 분배 키 3종 신규 등록
-- ============================================================
INSERT INTO `app_settings` (`k`, `v`) VALUES
  ('silica_sto_decimals',       JSON_QUOTE('1')),
  ('silica_sto_total_minted',   JSON_QUOTE('1000000000')),
  ('silica_sto_reserve_wallet', JSON_QUOTE(''))
ON DUPLICATE KEY UPDATE `v` = `app_settings`.`v`;
-- 주의: 위 ON DUPLICATE 는 기존 값이 있으면 덮지 않음 (관리자 입력 값 보호).

-- ============================================================
-- 2) v_silica_sto_distributed — 누적 분배(claim) 수량 VIEW
-- ============================================================
-- 매각 분배 계산식의 분모로 사용.
-- holdings.claimed_token = 유저 지갑별 누적 클레임 수량 (decimals 정수 가정).
-- ============================================================
DROP VIEW IF EXISTS `v_silica_sto_distributed`;

CREATE VIEW `v_silica_sto_distributed` AS
SELECT
  COALESCE(h.asset_id, 'SILICA-79907') AS asset_id,
  CAST(COALESCE(SUM(h.claimed_token), 0) AS DECIMAL(20,1)) AS distributed_token,
  COUNT(DISTINCT h.address)             AS distinct_holders,
  MAX(h.updated_at)                     AS last_claim_at
FROM `holdings` h
WHERE h.claimed_token > 0
GROUP BY h.asset_id;

-- ============================================================
-- 3) 검증 쿼리 (선택 실행)
-- ============================================================
-- SELECT k, v FROM app_settings WHERE k LIKE 'silica_sto%' ORDER BY k;
-- SELECT * FROM v_silica_sto_distributed;
