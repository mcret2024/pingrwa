-- ============================================================================
-- Silica 단순 상태머신 마이그레이션 (2026-05-05)
-- ----------------------------------------------------------------------------
-- 목적:
--   RECON 다중자산 펀딩 모델의 단계형 상태머신
--   (모집중 → 구매진행 → 분배중 → 운영중 → 매각 → 매각완료)을
--   Silica 사전 발행 + 상시 분배 모델에 맞춰 3 상태로 단순화.
--
-- 새 상태머신:
--   활성             — 정상 운영. 투자/스테이킹 모두 가능. 기본 상태.
--   매각             — 광산 외부 매각 진행. 신규 투자 차단, 매각대금 분배 처리 중.
--   매각(완료)       — 매각대금 전액 분배 완료. 라이프사이클 종료.
--
-- legacy 값(모집중/구매진행/분배중/운영중/모집실패/취소됨)은 ENUM 에 보존하지만
-- 데이터는 모두 '활성' 으로 일괄 마이그레이션된다.
-- ============================================================================

-- 1) ENUM 정의 확장 — 새 값 '활성' / '매각(완료)' 가 빠져있으면 추가.
--    legacy 값들도 보존(외부 데이터 소스가 아직 보낼 가능성 대비).
ALTER TABLE `assets`
    MODIFY COLUMN `status`
    ENUM('활성','매각','매각(완료)','모집중','구매진행','분배중','운영중','모집실패','취소됨')
    NOT NULL DEFAULT '활성';

-- 2) 기존 데이터 일괄 마이그레이션:
--    매각 / 매각(완료) / 모집실패 / 취소됨 외엔 모두 '활성' 으로 정규화.
UPDATE `assets`
   SET `status` = '활성'
 WHERE `status` IN ('모집중','구매진행','분배중','운영중');

-- 3) holdings.silica_sto_balance 와 holdings.balance_token 정합성 보정:
--    구 /api/claim 경로로 balance_token 만 증가했고 silica_sto_balance 는 0 인
--    행이 있다면 silica_sto_balance 로 복사 (legacy 클레임 사용자 구제).
UPDATE `holdings` h
   SET h.silica_sto_balance = h.balance_token
 WHERE h.silica_sto_balance = 0
   AND h.balance_token > 0;

-- 4) 자산의 funding 단계용 계산 컬럼들은 더 이상 사용되지 않으므로 0 으로 리셋.
--    (target_usdt 등은 통계용으로 보존하되, 이후 코드에서는 조건 가드로 사용 안 함)
--    여기서는 raised_usdt 누적은 그대로 둔다 (총 투자액 통계용).

-- 5) 검증: 마이그레이션 후 자산 상태 분포 확인.
SELECT status, COUNT(*) AS cnt
  FROM `assets`
 GROUP BY status
 ORDER BY status;
