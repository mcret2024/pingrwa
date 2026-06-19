-- =====================================================
-- Silica — Recon RWA 샘플 자산 일괄 정리
-- =====================================================
-- 적용 대상: silica_full_install.sql 임포트 후 Silica 단일 자산 정책 반영.
--
-- rwa.sql 의 INSERT 시드에 포함된 Recon 의 예시 부동산 자산
-- (APT001~APT005, test001 등) 이 운영 대시보드에 함께 노출되는 것을 제거.
-- ON DELETE CASCADE 가 설정되어 있어 asset_docs / holdings / funding_records
-- / interest_claims / orders / sales / trades 등 모든 관련 행이 자동 제거됨.
--
-- 'SILICA-79907' 만 보존.
-- =====================================================

SET FOREIGN_KEY_CHECKS=0;

-- 1) Recon 샘플 자산 + 관련 cascade 데이터 삭제 (FK ON DELETE CASCADE)
DELETE FROM `assets` WHERE `id` != 'SILICA-79907';

SET FOREIGN_KEY_CHECKS=1;

-- 2) 결과 검증
SELECT COUNT(*) AS remaining_assets, GROUP_CONCAT(id) AS asset_ids FROM `assets`;
-- 기대 결과: remaining_assets = 1, asset_ids = 'SILICA-79907'
