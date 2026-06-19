-- ============================================================================
-- 미수령(orphan) SilicaSTO 백필 마이그레이션 (2026-05-05)
-- ----------------------------------------------------------------------------
-- 배경:
--   2026-05-05 이전의 클레임 모델에서, 유저 투자 + 관리자 서명까지 완료되었어도
--   별도의 "토큰 받기" 클릭 없이는 holdings 가 채워지지 않았다.
--   재설계된 claim.html 에 #claimBtn 이 누락되면서 일부 유저가 양측 서명 완료
--   상태에서 토큰을 받지 못한 채 갇혀 있던 케이스 발생.
--
-- 새 모델(2026-05-05~):
--   관리자 서명 시점에 holdings.silica_sto_balance / balance_token / claimed_token
--   을 1:1 USDT/STO 페그로 즉시 자동 증액한다.
--   본 SQL 은 정책 시행 전에 양측 서명까지 끝난 미수령분을 1회 백필한다.
--
-- 멱등성:
--   funded - claimed > 0 인 행만 갱신하므로 여러 번 실행해도 안전.
--
-- 권장 실행 방법:
--   1) 우선 dry-run (SELECT 미리보기):
--        아래 "DRY RUN PREVIEW" 섹션 단독 실행
--   2) 결과 확인 후 실제 적용:
--        "STEP 1" + "STEP 2" 실행
--   3) 알림은 어드민 API 엔드포인트 (POST /api/admin/contracts/backfill-orphan-credits)
--      를 통해 큐잉됨 — SQL 만으로는 user_notifications 행이 생성되지 않으므로
--      알림 받으려면 admin/contracts.html UI 사용 권장.
--      (참고: 과거 cron/backfill_orphan_sto_credits.php 도 같은 역할을 했으나
--       2026-05-21 보안감사로 제거 — HTTP 엔드포인트로 일원화.)
-- ============================================================================

-- ──── DRY RUN PREVIEW ────────────────────────────────────────────────────────
-- 백필 대상자 미리보기. 실제 갱신 없음.
SELECT
    f.address,
    f.asset_id,
    SUM(f.amount_usdt)                          AS total_funded,
    COALESCE(MAX(h.claimed_token), 0)           AS claimed_token,
    COALESCE(MAX(h.silica_sto_balance), 0)      AS silica_sto_balance,
    SUM(f.amount_usdt) - COALESCE(MAX(h.claimed_token), 0) AS will_credit,
    CASE WHEN h.address IS NULL THEN 'NEW HOLDING' ELSE 'EXISTING' END AS holding_state
  FROM funding_records f
  LEFT JOIN holdings h
         ON h.address = f.address
        AND h.asset_id = f.asset_id
 GROUP BY f.address, f.asset_id, h.address
 HAVING will_credit > 0.000001
 ORDER BY will_credit DESC;

-- ──── STEP 1: 누락된 holdings 행 보장 ───────────────────────────────────────
INSERT IGNORE INTO holdings (address, asset_id, balance_token, staked_token, claimed_token, redeemed_token, silica_sto_balance)
SELECT DISTINCT f.address, f.asset_id, 0, 0, 0, 0, 0
  FROM funding_records f
 WHERE NOT EXISTS (
     SELECT 1 FROM holdings h WHERE h.address = f.address AND h.asset_id = f.asset_id
 );

-- ──── STEP 2: 미수령분(=funded - claimed) 만큼 1:1 페그 증액 ─────────────────
UPDATE holdings h
  JOIN (
    SELECT address, asset_id, SUM(amount_usdt) AS total_funded
      FROM funding_records
     GROUP BY address, asset_id
  ) f ON f.address = h.address AND f.asset_id = h.asset_id
   SET
       h.silica_sto_balance = h.silica_sto_balance + (f.total_funded - h.claimed_token),
       h.balance_token      = h.balance_token + (f.total_funded - h.claimed_token),
       h.claimed_token      = f.total_funded
 WHERE f.total_funded > h.claimed_token + 0.000001;

-- ──── 검증: 백필 후 양측 합계 일치 확인 ─────────────────────────────────────
-- 각 유저의 confirmed funded 와 claimed_token 이 일치해야 정상.
SELECT
    f.address,
    f.asset_id,
    SUM(f.amount_usdt)            AS total_funded,
    h.claimed_token,
    h.silica_sto_balance,
    SUM(f.amount_usdt) - h.claimed_token AS still_outstanding
  FROM funding_records f
  JOIN holdings h ON h.address = f.address AND h.asset_id = f.asset_id
 GROUP BY f.address, f.asset_id, h.claimed_token, h.silica_sto_balance
 HAVING still_outstanding > 0.000001;
-- ↑ 위 결과가 0행이면 백필이 정상 완료됨.
