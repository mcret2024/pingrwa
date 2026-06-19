-- (2026-05-23 v793) KYC handoff tokens
--
-- 목적: Phantom/MetaMask/카카오톡 등 인앱 브라우저에서는 didit.me 의
--   카메라/iframe 흐름이 지원되지 않아 KYC 진행이 불가능. 인앱 브라우저
--   사용자가 일반 Chrome/Safari/Samsung Internet 으로 KYC 만 잠시 옮겨가
--   진행할 수 있도록 단기 유효 토큰을 발급한다. 토큰은 wallet 주소에 묶여
--   있고, KYC 완료 시 즉시 무효화 된다.
--
-- 보안:
--   - 토큰은 32바이트 cryptographic random (64 hex chars)
--   - 단기 유효 (TTL 10분)
--   - 1회 사용 (KYC 완료 시 used_at 마킹)
--   - KYC 권한만 부여, 송금/거래 권한 없음
--   - 토큰 유출 시 공격자가 자기 신분증으로 피해자 KYC 를 등록할 수 있으나
--     공격자에게 이득 없음 (오히려 자기 신분 정보 노출)
--
-- MariaDB 10.0.2+ (Hostinger 공용)

CREATE TABLE IF NOT EXISTS `kyc_handoff_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `token` VARCHAR(128) NOT NULL,
  `address` VARCHAR(64) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME DEFAULT NULL,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `used_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_kyc_handoff_token` (`token`),
  KEY `idx_kyc_handoff_address` (`address`),
  KEY `idx_kyc_handoff_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
