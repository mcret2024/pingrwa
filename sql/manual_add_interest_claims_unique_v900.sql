-- ============================================================
-- interest_claims UNIQUE 추가 — race condition 으로 인한 이중 이자 지급 차단
-- (v900 · 2026-06-08)
-- ============================================================
-- 배경:
--   v379 이전 devnet 의 testInterestBtn 반복 테스트를 위해 interest_claims
--   에 UNIQUE constraint 가 의도적으로 제거되었음. application-layer 의
--   SELECT-then-INSERT 패턴만으로는 race condition (운영자 두 브라우저
--   동시 클릭, 정규 cron 과 admin 거의 동시 발화) 에서 이중 INSERT 가능.
--
--   v861 에서 mainnet 의 testBtn mode 가 차단되어 더 이상 의도된 중복
--   INSERT 가 필요 없음 → UNIQUE 안전하게 추가 가능.
--
-- 효과:
--   (address, asset_id, month_key) 조합의 중복 INSERT 가 DB 레벨에서
--   거절됨. force-interest disaster + catch-up-accrual 둘 다 race 안전.
--
-- 적용 방법:
--   phpMyAdmin → 운영 DB 선택 → SQL 탭에 이 파일 내용 붙여넣기 → 실행
--
-- 사전 검증 (필수):
--   기존 중복 데이터가 있으면 ALTER TABLE 이 실패함. 아래 SELECT 로
--   먼저 확인 후 진행.
-- ============================================================

-- [1] 사전 진단 — 중복 행 존재 여부 확인
--     결과가 0건이어야 ALTER TABLE 가능. 1건 이상이면 DBA 검토 후 정리 필요.
SELECT address, asset_id, month_key, COUNT(*) AS dup_count
  FROM interest_claims
 GROUP BY address, asset_id, month_key
HAVING COUNT(*) > 1;

-- [2] UNIQUE 인덱스 추가 (위 SELECT 가 0건일 때만)
ALTER TABLE `interest_claims`
  ADD UNIQUE KEY `ux_ic_addr_asset_month` (`address`, `asset_id`, `month_key`);

-- [3] 적용 확인
SHOW INDEX FROM `interest_claims` WHERE Key_name = 'ux_ic_addr_asset_month';
