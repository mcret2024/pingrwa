-- (2026-05-24 v811) Handoff token 에 didit session 정보 저장.
--
-- 목적: Phantom 에서 사용자가 country + docType 선택 후 Generate Secure Link
--   클릭 시, 백엔드가 동시에 didit session 도 생성하여 URL 을 함께 저장.
--   Chrome 에서 핸드오프 링크 진입 시 즉시 didit 으로 redirect 가능 →
--   사용자가 폼을 재선택할 필요 없음.
--
-- 추가 컬럼:
--   - didit_session_id  : didit 측 session id (kyc_sessions.session_id 참조)
--   - didit_session_url : didit 인증창 URL (Chrome 이 redirect 할 대상)
--
-- 둘 다 NULL 가능 — country/docType 미선택으로 토큰만 발급된 경우 NULL,
--   Chrome 은 NULL 이면 기존 흐름 (폼 표시) 으로 fallback.
--
-- MariaDB 10.0.2+ (Hostinger 공용)

ALTER TABLE `kyc_handoff_tokens`
  ADD COLUMN IF NOT EXISTS `didit_session_id` VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `didit_session_url` VARCHAR(512) DEFAULT NULL;
