-- ============================================================
-- 계약서 템플릿 — "Recon RWA 플랫폼" → "Silica Chain Holdings RWA 플랫폼"
-- (v886 · 2026-06-07)
-- ============================================================
-- 배경:
--   manual_contract_template_usdt_only_patch.sql 에 잔존한 "Recon RWA 플랫폼"
--   문구가 DB 의 contract_templates.body_html 에 들어가 사용자 청약 계약서에
--   "Recon" (리콘) 으로 노출되던 문제.
--
-- 적용 방법:
--   1) phpMyAdmin → rwa6 (또는 운영 DB) 선택 → SQL 탭에 이 파일 내용 붙여넣기 → 실행
--   2) 또는 /admin/contracts.html 에서 funding_subscription 활성 템플릿 본문 수정
--
-- 효과:
--   - 새로 생성되는 계약서: 새 양식 적용
--   - 기존 계약서: body_html 스냅샷 저장이라 영향 없음 (소급 변경 X)
-- ============================================================

UPDATE `contract_templates`
SET `body_html` = REPLACE(`body_html`, 'Recon RWA 플랫폼', 'Silica Chain Holdings RWA 플랫폼'),
    `updated_at` = CURRENT_TIMESTAMP,
    `updated_by` = 'migration_recon_to_silica_v886'
WHERE `template_code` = 'funding_subscription'
  AND `is_active` = 1
  AND `body_html` LIKE '%Recon RWA 플랫폼%';

-- 다른 활성 템플릿에도 같은 패턴이 남아있다면 함께 정정:
UPDATE `contract_templates`
SET `body_html` = REPLACE(`body_html`, 'Recon RWA 플랫폼', 'Silica Chain Holdings RWA 플랫폼'),
    `updated_at` = CURRENT_TIMESTAMP,
    `updated_by` = 'migration_recon_to_silica_v886'
WHERE `is_active` = 1
  AND `body_html` LIKE '%Recon RWA 플랫폼%';

-- 검증 쿼리 — 적용 후 결과 확인 (남아있으면 행 수 > 0)
-- SELECT id, template_code, version, updated_at, updated_by
--   FROM contract_templates
--   WHERE body_html LIKE '%Recon%';
