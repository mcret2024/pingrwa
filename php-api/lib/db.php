<?php
/**
 * RWA Platform - Database Connection (PDO)
 */

class DB {
    private static ?PDO $pdo = null;
    private static bool $migrated = false;

    public static function get(): PDO {
        if (self::$pdo === null) {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
            self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, time_zone='+00:00'",
            ]);
            self::autoMigrate();
        }
        return self::$pdo;
    }

    /**
     * (audit H2-1 fix · 2026-06-12) AUTO_MIGRATE_ENABLED=false 인 운영 환경에서
     *   배포 후 운영자가 db.php 인라인 DDL 을 수동 1회 적용하기 위한 진입점.
     *   /api/admin/db/migrate (adminOnly) 에서 호출. force=true 라 끄기 스위치 무시.
     */
    public static function runAutoMigrateNow(): void {
        self::get();              // PDO 연결 보장 (이미 연결돼 있으면 no-op)
        self::autoMigrate(true);  // force: 끄기 스위치 + $migrated 가드 무시
    }

    /** Auto-apply missing columns/tables from migration_v2 */
    private static function autoMigrate(bool $force = false): void {
        if (self::$migrated && !$force) return;
        // (audit H2-1 fix · 2026-06-12) 운영 자동 DDL 끄기 스위치.
        //   force=true (runAutoMigrateNow 경유 수동 트리거) 는 스위치를 무시하고 강제 실행.
        if (!$force && defined('AUTO_MIGRATE_ENABLED') && !AUTO_MIGRATE_ENABLED) return;
        self::$migrated = true;
        $pdo = self::$pdo;
        // IMPORTANT: interest_claims claimed_at / claim_batch_id are operationally critical
        // for monthly accrual, claim, public stats, and portfolio summaries.
        // Keep this schema guard OUTSIDE the main try/catch so an unrelated ALTER failure
        // elsewhere does not skip the staking claim-tracking columns.
        self::ensureInterestClaimsSchemaOn($pdo);
        try {
            // Check if assets table has is_public column
            $cols = $pdo->query("SHOW COLUMNS FROM `assets` LIKE 'is_public'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `assets` ADD COLUMN `is_public` TINYINT NOT NULL DEFAULT 1 AFTER `fund_end_date`");
                $pdo->exec("UPDATE `assets` SET `is_public` = 1 WHERE `is_public` = 0");
            }
            // Check if assets table has token_mint_address column
            $cols = $pdo->query("SHOW COLUMNS FROM `assets` LIKE 'token_mint_address'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `assets` ADD COLUMN `token_mint_address` VARCHAR(64) DEFAULT NULL AFTER `is_public`");
            }
            // Ensure assets.settlement_basis supports USDT
            $cols = $pdo->query("SHOW COLUMNS FROM `assets` LIKE 'settlement_basis'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (strpos($type, 'usdt') === false) {
                    $pdo->exec("ALTER TABLE `assets` MODIFY COLUMN `settlement_basis` ENUM('KRW','USD','KZT','PHP','GEL','IDR','VND','USDT') NOT NULL DEFAULT 'KRW'");
                }
            }
            // Ensure assets.status supports 취소됨
            // Silica 단순 상태머신(2026-05-05): '활성' / '매각' / '매각(완료)' 만 사용.
            // legacy 값(모집중/구매진행/분배중/운영중/모집실패/취소됨)은 ENUM 에 보존해 호환성을 유지하되
            // 신규 코드 경로에서는 모두 '활성' 또는 '매각'/'매각(완료)' 로 매핑되어 들어온다.
            $cols = $pdo->query("SHOW COLUMNS FROM `assets` LIKE 'status'")->fetchAll();
            if (!empty($cols)) {
                $type = (string)($cols[0]['Type'] ?? '');
                $needsActive = strpos($type, '활성') === false;
                $needsSaleDone = strpos($type, '매각(완료)') === false;
                $needsCanceled = strpos($type, '취소됨') === false;
                if ($needsActive || $needsSaleDone || $needsCanceled) {
                    $pdo->exec("ALTER TABLE `assets`
                        MODIFY COLUMN `status`
                        ENUM('활성','매각','매각(완료)','모집중','구매진행','분배중','운영중','모집실패','취소됨')
                        NOT NULL DEFAULT '활성'");
                }
                // 기존 row 가 legacy 상태로 남아있으면 자동 흡수: 매각/매각(완료)/취소 외엔 모두 활성.
                $pdo->exec("UPDATE `assets`
                    SET status='활성'
                    WHERE status IN ('모집중','구매진행','분배중','운영중')");
            }

            // (2026-05-06 v3) silica_sto_* 컬럼 reconciliation — Silica 모델의 TOTAL/STAKED 의미 강제.
            //
            // 정상 invariant:
            //   silica_sto_balance = balance_token + staked_token   (TOTAL)
            //   silica_sto_staked  = staked_token                   (staked subset)
            //
            // legacy 컬럼(balance_token, staked_token) 은 admin-sign / claim / sales / staking 등 모든
            // 주요 경로가 갱신하므로 source of truth. silica_sto_* 가 어긋나면 (위/아래 어느 방향이든)
            // legacy 값으로 강제 동기화. 정상 row 는 부등식 false 라 영향 없음.
            try {
                $pdo->exec("UPDATE `holdings`
                    SET silica_sto_balance = balance_token + staked_token,
                        silica_sto_staked  = staked_token
                  WHERE silica_sto_balance != (balance_token + staked_token)
                     OR silica_sto_staked  != staked_token");
            } catch (Throwable $e) {
                // 컬럼 미존재 등 — 조용히 무시 (silica_schema_migration 미적용 환경)
            }

            // (2026-05-07) Silica USDT-fixed 모델 — 기존 SILICA 자산이 RECON 잔재인
            // settlement_basis='KRW' 로 남아있으면 USDT 로 갱신.
            // staking.html 의 정산통화 카드, 이자 계산 미리보기, 사용자 페이지의
            // 환율 표기 등이 일관되게 USDT 기반으로 동작하도록 한다.
            try {
                $pdo->exec("UPDATE `assets`
                    SET settlement_basis='USDT'
                  WHERE settlement_basis IN ('KRW','USD')
                    AND id LIKE 'SILICA-%'");
            } catch (Throwable $e) {
                // ENUM 에 USDT 가 아직 없을 수 있음 — 위쪽 ALTER 가 먼저 수행되므로 보통 안전.
            }

            // (2026-05-07) wallet_transactions ENUM 확장 — RECON 시대 'deposit'/'withdraw'
            // 만 허용하던 kind ENUM 때문에 funding.php 의 'invest' / staking.php 의 'stake'
            // / swap.php 의 'swap_in' / 'swap_out' 등 모든 신규 kind 가 MySQL non-strict
            // mode 에서 빈 문자열로 INSERT 되어 history 화면에 매핑 실패로 표시되던 문제.
            // VARCHAR 로 변경해 향후 신규 kind 추가 시 매번 ALTER 안 해도 되게 함.
            try {
                $cols = $pdo->query("SHOW COLUMNS FROM `wallet_transactions` LIKE 'kind'")->fetchAll();
                if (!empty($cols)) {
                    $type = strtolower((string)($cols[0]['Type'] ?? ''));
                    if (strpos($type, 'enum') !== false) {
                        $pdo->exec("ALTER TABLE `wallet_transactions`
                            MODIFY COLUMN `kind` VARCHAR(40) NOT NULL DEFAULT 'deposit'");
                    }
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `wallet_transactions` LIKE 'status'")->fetchAll();
                if (!empty($cols)) {
                    $type = strtolower((string)($cols[0]['Type'] ?? ''));
                    if (strpos($type, 'enum') !== false) {
                        $pdo->exec("ALTER TABLE `wallet_transactions`
                            MODIFY COLUMN `status` VARCHAR(40) NOT NULL DEFAULT '대기'");
                    }
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `wallet_transactions` LIKE 'asset'")->fetchAll();
                if (!empty($cols)) {
                    $type = strtolower((string)($cols[0]['Type'] ?? ''));
                    if (strpos($type, 'enum') !== false) {
                        $pdo->exec("ALTER TABLE `wallet_transactions`
                            MODIFY COLUMN `asset` VARCHAR(40) NOT NULL DEFAULT 'USDT'");
                    }
                }

                // 기존 빈 kind 행 보강 — funding.php 의 invest 신청 패턴
                //   (status='대기' + asset='USDT' + amount > 0 + memo LIKE '투자%') → 'invest'
                $pdo->exec("UPDATE `wallet_transactions`
                    SET kind='invest'
                  WHERE kind=''
                    AND status='대기'
                    AND asset='USDT'
                    AND memo LIKE '투자%'");

                // admin_contracts.php 의 invest_credit 패턴
                //   (status='완료' + asset 가 SilicaSTO/USDT 류 + memo LIKE '%STO%분배%') → 'invest_credit'
                //   admin-sign 후 STO 분배 메모 흐름.
                $pdo->exec("UPDATE `wallet_transactions`
                    SET kind='invest_credit'
                  WHERE kind=''
                    AND memo LIKE '%STO%분배%'");

                // 빈 status 보강 — RECON ENUM 에 '완료' 가 없어서 빈값 저장된 케이스.
                //   invest_credit / stake / unstake / interest_claim / dividend_claim → '완료'
                //   invest 신청 → '대기' (이미 ENUM 에 있음, 빈값 케이스는 거의 없지만 fallback)
                $pdo->exec("UPDATE `wallet_transactions`
                    SET status='완료'
                  WHERE status=''
                    AND kind IN ('invest_credit','stake','unstake','swap_in','swap_out','interest_claim','referral_bonus','dividend_claim')");
                $pdo->exec("UPDATE `wallet_transactions`
                    SET status='대기'
                  WHERE status=''
                    AND kind='invest'");

                // SilicaSTO / Silica 자산 ENUM 미정의로 빈 asset 도 추정.
                //   memo 에 'SilicaSTO' / 'Silica' 가 들어있으면 그 값으로.
                $pdo->exec("UPDATE `wallet_transactions`
                    SET asset='SilicaSTO'
                  WHERE asset='' AND (memo LIKE '%SilicaSTO%' OR kind IN ('stake','unstake','swap_in','invest_credit'))");
                $pdo->exec("UPDATE `wallet_transactions`
                    SET asset='Silica'
                  WHERE asset='' AND (memo LIKE '%Silica %' OR kind = 'swap_out')");

                // (2026-05-07) invest 행 status 정상화 — 다음 두 케이스 처리.
                //   A) 같은 contract 의 invest_credit 행이 존재 → admin-sign 완료된 상태
                //      → invest 행 status '대기' 를 '완료' 로.
                //   B) investment_contracts.status='rejected' → 반려된 상태
                //      → invest 행 status '대기' 를 '반려' 로.
                // 이전엔 ENUM 제약으로 '완료' / '반려' 가 빈값 됐다가 보강에서 '대기'
                // 로 잘못 복원되어 영원히 PENDING 으로 표시되던 문제 fix.
                try {
                    // A) admin-sign 완료된 invest 행 → '완료'
                    $pdo->exec("UPDATE wallet_transactions wt
                        JOIN wallet_transactions wc
                          ON wc.address = wt.address
                         AND wc.kind = 'invest_credit'
                         AND SUBSTRING_INDEX(SUBSTRING_INDEX(wc.memo,'계약 #',-1),')',1)
                           = SUBSTRING_INDEX(SUBSTRING_INDEX(wt.memo,'계약 #',-1),')',1)
                        SET wt.status = '완료',
                            wt.memo   = CONCAT(IFNULL(wt.memo,''), ' / 관리자 서명 완료')
                      WHERE wt.kind   = 'invest'
                        AND wt.status = '대기'
                        AND wt.memo NOT LIKE '%서명 완료%'
                        AND wt.memo NOT LIKE '%반려%'");
                } catch (Throwable $e) {
                    error_log('[db.boot] invest→완료 backfill failed: ' . $e->getMessage());
                }
                try {
                    // B) rejected 계약의 invest 행 → '반려'
                    $pdo->exec("UPDATE wallet_transactions wt
                        JOIN investment_contracts c
                          ON c.address = wt.address
                         AND c.status  = 'rejected'
                         AND wt.memo LIKE CONCAT('%계약 #', c.id, '%')
                        SET wt.status = '반려',
                            wt.memo   = CONCAT(IFNULL(wt.memo,''), ' / 관리자 반려')
                      WHERE wt.kind   = 'invest'
                        AND wt.status = '대기'
                        AND wt.memo NOT LIKE '%반려%'");
                } catch (Throwable $e) {
                    error_log('[db.boot] invest→반려 backfill failed: ' . $e->getMessage());
                }
            } catch (Throwable $e) {
                error_log('[db.boot] wallet_transactions schema migration failed: ' . $e->getMessage());
            }
            // user_notifications: 유저별 1회용 팝업/배지 알림 (관리자 서명 등 푸시 이벤트).
            $tables = $pdo->query("SHOW TABLES LIKE 'user_notifications'")->fetchAll();
            if (empty($tables)) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `user_notifications` (
                    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                    `address` VARCHAR(64) NOT NULL,
                    `type` VARCHAR(48) NOT NULL,
                    `title` VARCHAR(200) NOT NULL,
                    `body` TEXT NULL,
                    `payload_json` TEXT NULL,
                    `read_at` DATETIME NULL,
                    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_un_address_read (`address`, `read_at`),
                    INDEX idx_un_type (`type`),
                    INDEX idx_un_created (`created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            // Check if token_withdraw_requests table exists
            $tables = $pdo->query("SHOW TABLES LIKE 'token_withdraw_requests'")->fetchAll();
            if (empty($tables)) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `token_withdraw_requests` (
                    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                    `address` VARCHAR(64) NOT NULL,
                    `asset_id` VARCHAR(16) NOT NULL,
                    `to_address` VARCHAR(64) NOT NULL,
                    `amount_token` DECIMAL(24,6) NOT NULL DEFAULT 0,
                    `status` ENUM('pending','processing','done','canceled','failed') NOT NULL DEFAULT 'pending',
                    `txid` VARCHAR(128) DEFAULT NULL,
                    `memo` VARCHAR(255) DEFAULT NULL,
                    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_twr_status (`status`),
                    INDEX idx_twr_address (`address`),
                    INDEX idx_twr_asset_id (`asset_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            }
            // Check if assets table has google_map_url column
            $cols = $pdo->query("SHOW COLUMNS FROM `assets` LIKE 'google_map_url'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `assets` ADD COLUMN `google_map_url` VARCHAR(512) DEFAULT NULL AFTER `map_query`");
            }
            // Check if apr_history table exists
            $tables = $pdo->query("SHOW TABLES LIKE 'apr_history'")->fetchAll();
            if (empty($tables)) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `apr_history` (
                    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                    `asset_id` VARCHAR(16) NOT NULL,
                    `apr` DECIMAL(5,2) NOT NULL,
                    `effective_from` DATE NOT NULL,
                    `reason` VARCHAR(100) DEFAULT 'admin_update',
                    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_apr_asset (`asset_id`),
                    INDEX idx_apr_effective (`asset_id`, `effective_from`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            }
            // Check if contract_templates table exists
            $tables = $pdo->query("SHOW TABLES LIKE 'contract_templates'")->fetchAll();
            if (empty($tables)) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `contract_templates` (
                    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    `template_code` VARCHAR(64) NOT NULL,
                    `template_name` VARCHAR(120) NOT NULL,
                    `template_title` VARCHAR(255) NOT NULL,
                    `body_html` MEDIUMTEXT NOT NULL,
                    `body_text` MEDIUMTEXT,
                    `version_no` INT NOT NULL DEFAULT 1,
                    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                    `created_by` VARCHAR(64) DEFAULT NULL,
                    `updated_by` VARCHAR(64) DEFAULT NULL,
                    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY `uk_contract_templates_code_ver` (`template_code`,`version_no`),
                    KEY `idx_contract_templates_active` (`template_code`,`is_active`,`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            }
            // (2026-05-17 v443) 운영자: '하나의 계약서에 국문(제목,본문), 영문
            //   (제목,본문)을 입력하도록 하여 하나의 계약서가 연결 되도록'. 한 row
            //   에 KO + EN 본문 둘 다 보관 → 사용자 lang 별 dispatch. 기존
            //   template_title / body_html / body_text 컬럼은 KO 본문으로 간주.
            //   _en suffix 컬럼 self-healing 추가.
            $cols = $pdo->query("SHOW COLUMNS FROM `contract_templates` LIKE 'template_title_en'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `contract_templates` ADD COLUMN `template_title_en` VARCHAR(255) NULL DEFAULT NULL AFTER `template_title`");
            }
            $cols = $pdo->query("SHOW COLUMNS FROM `contract_templates` LIKE 'body_html_en'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `contract_templates` ADD COLUMN `body_html_en` MEDIUMTEXT NULL AFTER `body_html`");
            }
            $cols = $pdo->query("SHOW COLUMNS FROM `contract_templates` LIKE 'body_text_en'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `contract_templates` ADD COLUMN `body_text_en` MEDIUMTEXT NULL AFTER `body_text`");
            }

            // (2026-05-17 v445) 운영자 보고: EN 사용자에게 한국어 본문이 표시됨.
            //   원인: funding_subscription 의 body_html_en/template_title_en 가
            //   NULL. 기존 funding_subscription_en row 의 본문을 _en 컬럼으로
            //   1회 자동 복사. 멱등성 보장 패턴:
            //   1. settings 에 flag INSERT IGNORE 시도 → rowCount=0 이면 already migrated
            //   2. rowCount=1 이면 실제 마이그레이션 진행
            //   3. settings 테이블 schema 가 다르면 SQL error → catch 에서 marker
            //      유무 확인 안 되니 skip (안전)
            try {
                // settings 테이블 컬럼: `key` / `value` (reserved word 라 backtick 필수).
                // 참고: helpers.php setSetting() 패턴 (line 498) 과 일치.
                $flagStmt = $pdo->prepare("INSERT IGNORE INTO settings(`key`,`value`) VALUES('silica_en_template_migrated_v445','1')");
                $flagStmt->execute();
                if ($flagStmt->rowCount() > 0) {
                    // 첫 실행 — 마이그레이션 수행.
                    $primary = $pdo->query(
                        "SELECT id, template_title_en, body_html_en, body_text_en
                           FROM contract_templates
                          WHERE template_code='funding_subscription'
                          ORDER BY version_no DESC, id DESC LIMIT 1"
                    )->fetch(PDO::FETCH_ASSOC);
                    $enSource = $pdo->query(
                        "SELECT template_title, body_html, body_text
                           FROM contract_templates
                          WHERE template_code='funding_subscription_en'
                          ORDER BY (is_active=1) DESC, version_no DESC, id DESC LIMIT 1"
                    )->fetch(PDO::FETCH_ASSOC);
                    if ($primary && $enSource) {
                        $stmt = $pdo->prepare(
                            "UPDATE contract_templates
                               SET template_title_en = COALESCE(template_title_en, ?),
                                   body_html_en      = COALESCE(body_html_en, ?),
                                   body_text_en      = COALESCE(body_text_en, ?)
                             WHERE id=?"
                        );
                        $stmt->execute([
                            $enSource['template_title'] ?? null,
                            $enSource['body_html'] ?? null,
                            $enSource['body_text'] ?? null,
                            (int)$primary['id'],
                        ]);
                        error_log("[v445] EN template migrated: copied from funding_subscription_en to funding_subscription id={$primary['id']}");
                    }
                }
                // rowCount=0 → flag 이미 존재 → 이미 마이그레이션됨 → skip.
            } catch (Throwable $e) {
                error_log('[v445] en-template migration silent skip: ' . $e->getMessage());
            }

            // Ensure default funding_subscription template exists
            $tmplCount = $pdo->query("SELECT COUNT(*) FROM contract_templates WHERE template_code='funding_subscription'")->fetchColumn();
            if ((int)$tmplCount === 0) {
                $defaultBody = '
  <div class=\"contract-body\">
    <h2 style=\"margin:0 0 14px\">투자 청약 전자계약서</h2>
    <p>본 계약은 <strong>{{signed_date_kst}}</strong> 기준으로 Recon RWA 플랫폼과 아래 투자자 사이의 전자적 청약 계약입니다.</p>

    <h3 style=\"margin:22px 0 10px\">1. 투자자 정보</h3>
    <ul>
      <li>지갑 주소: {{wallet_address}}</li>
      <li>계약 기준시각(KST): {{signed_date_kst}}</li>
    </ul>

    <h3 style=\"margin:22px 0 10px\">2. 투자 대상 자산</h3>
    <ul>
      <li>자산 ID: {{asset_id}}</li>
      <li>자산명: {{asset_name}}</li>
      <li>시장명: {{market}}</li>
      <li>국가: {{country_name}}</li>
      <li>정산통화: {{settlement_basis}}</li>
      <li>예상 연이율(APR): {{apr}}%</li>
      <li>모금기간 종료일: {{fund_end_date}}</li>
    </ul>

    <h3 style=\"margin:22px 0 10px\">3. 청약 금액</h3>
    <ul>
      <li>청약금액(USDT): {{amount_usdt}} USDT</li>
      <li>예상 현지통화 환산액: {{amount_local}} {{settlement_basis}}</li>
      <li>적용 환율: 1 USDT = {{fx_per_usdt}} {{settlement_basis}}</li>
      <li>최소 참여금액: {{min_usdt}} USDT</li>
      <li>목표 모집금액: {{target_usdt}} USDT</li>
    </ul>

    <h3 style=\"margin:22px 0 10px\">4. 투자 유의사항</h3>
    <ol>
      <li>본 상품은 원금이 보장되지 않으며, 자산 운영 및 매각 결과에 따라 손실이 발생할 수 있습니다.</li>
      <li>수익, 이자, 매각 정산은 대상 국가의 정산통화를 기준으로 계산되며 지급 시점 환율에 따라 USDT로 환산될 수 있습니다.</li>
      <li>모집 완료 시점의 환율 및 발행량이 확정되며, 이후 변동될 수 없습니다.</li>
      <li>플랫폼은 관련 법령, 내부통제, KYC/OTP 절차에 따라 투자 참여를 제한하거나 보류할 수 있습니다.</li>
    </ol>

    <h3 style=\"margin:22px 0 10px\">5. 전자문서 및 전자서명 동의</h3>
    <p>투자자는 본 계약을 전자문서 형태로 열람하였고, 직접 입력한 자필 전자서명 및 OTP 검증을 통해 본 계약의 내용에 동의하며, 이는 서면 서명과 동일한 효력을 가지는 것에 동의합니다.</p>

    <h3 style=\"margin:22px 0 10px\">6. 효력 발생</h3>
    <p>본 계약은 투자자의 자필 전자서명과 OTP 검증이 완료되고, 실제 모금 참여가 정상 접수된 시점에 유효 접수됩니다. 이후 관리자의 최종 자필서명이 완료되면 계약 상태는 완료로 전환됩니다.</p>
  </div>';
                $pdo->prepare(
                    "INSERT INTO contract_templates (template_code, template_name, template_title, body_html, body_text, version_no, is_active, created_by, updated_by)
                     VALUES (?,?,?,?,NULL,1,1,'system','system')"
                )->execute([
                    'funding_subscription',
                    '기본 투자 청약 전자계약서',
                    '{{asset_name}} 투자 청약 전자계약서',
                    $defaultBody
                ]);
            }
            // Check if asset_contract_templates table exists
            $tables = $pdo->query("SHOW TABLES LIKE 'asset_contract_templates'")->fetchAll();
            if (empty($tables)) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `asset_contract_templates` (
                    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    `asset_id` VARCHAR(50) NOT NULL,
                    `template_id` BIGINT UNSIGNED NOT NULL,
                    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    KEY `idx_asset_contract_templates_template_id` (`template_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            } else {
                // Ensure `id` column exists (original schema may lack it)
                $cols = $pdo->query("SHOW COLUMNS FROM `asset_contract_templates` LIKE 'id'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `asset_contract_templates` ADD COLUMN `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY FIRST");
                }
            }
            // (2026-05-17 v441) Per-language mapping support. asset_contract_templates
            //   gets a `language` column ('ko' | 'en' | NULL=공통) so admin can
            //   assign a Korean template + English template to the same asset.
            //   user-side draft endpoint picks the row matching user's lang.
            $cols = $pdo->query("SHOW COLUMNS FROM `asset_contract_templates` LIKE 'language'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `asset_contract_templates` ADD COLUMN `language` VARCHAR(8) NULL DEFAULT NULL AFTER `template_id`");
                $pdo->exec("ALTER TABLE `asset_contract_templates` ADD INDEX `idx_act_asset_lang` (`asset_id`, `language`, `is_active`)");
            }
            // Check if investment_contracts table exists
            $tables = $pdo->query("SHOW TABLES LIKE 'investment_contracts'")->fetchAll();
            if (empty($tables)) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `investment_contracts` (
                    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    `contract_no` VARCHAR(40) NOT NULL,
                    `asset_id` VARCHAR(50) NOT NULL,
                    `address` VARCHAR(120) NOT NULL,
                    `template_id` BIGINT UNSIGNED NOT NULL,
                    `template_code` VARCHAR(64) NOT NULL,
                    `template_version` INT NOT NULL,
                    `status` ENUM('draft','user_signed','awaiting_admin','completed','rejected','void') NOT NULL DEFAULT 'draft',
                    `contract_title` VARCHAR(255) NOT NULL,
                    `contract_body_html` MEDIUMTEXT NOT NULL,
                    `contract_body_text` MEDIUMTEXT,
                    `amount_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
                    `amount_local` DECIMAL(24,6) DEFAULT NULL,
                    `settlement_basis` VARCHAR(10) NOT NULL DEFAULT 'KRW',
                    `fx_per_usdt` DECIMAL(24,6) NOT NULL DEFAULT 0,
                    `signer_name` VARCHAR(120) NOT NULL DEFAULT '',
                    `consent_electronic` TINYINT(1) NOT NULL DEFAULT 0,
                    `consent_signature` TINYINT(1) NOT NULL DEFAULT 0,
                    `user_signature_path` VARCHAR(255) DEFAULT NULL,
                    `user_signed_at` DATETIME DEFAULT NULL,
                    `user_signed_ip` VARCHAR(128) DEFAULT NULL,
                    `user_signed_user_agent` VARCHAR(255) DEFAULT NULL,
                    `otp_verified_at` DATETIME DEFAULT NULL,
                    `funding_record_id` BIGINT UNSIGNED DEFAULT NULL,
                    `admin_signature_path` VARCHAR(255) DEFAULT NULL,
                    `admin_signed_by` VARCHAR(64) DEFAULT NULL,
                    `admin_signed_at` DATETIME DEFAULT NULL,
                    `finalized_pdf_path` VARCHAR(255) DEFAULT NULL,
                    `rejected_reason` VARCHAR(255) DEFAULT NULL,
                    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY `uk_contract_no` (`contract_no`),
                    KEY `idx_ic_address` (`address`),
                    KEY `idx_ic_asset` (`asset_id`),
                    KEY `idx_ic_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            }

            // Ensure legacy investment_contracts tables have funding-approval columns.
            // Older production DBs may already have the table but miss the columns used by /api/funding and admin sign.
            $tables = $pdo->query("SHOW TABLES LIKE 'investment_contracts'")->fetchAll();
            if (!empty($tables)) {
                $legacyContractCols = [
                    'otp_verified_at'      => "ALTER TABLE `investment_contracts` ADD COLUMN `otp_verified_at` DATETIME DEFAULT NULL AFTER `user_signed_user_agent`",
                    'funding_record_id'    => "ALTER TABLE `investment_contracts` ADD COLUMN `funding_record_id` BIGINT UNSIGNED DEFAULT NULL AFTER `otp_verified_at`",
                    'admin_signature_path' => "ALTER TABLE `investment_contracts` ADD COLUMN `admin_signature_path` VARCHAR(255) DEFAULT NULL AFTER `funding_record_id`",
                    'admin_signed_by'      => "ALTER TABLE `investment_contracts` ADD COLUMN `admin_signed_by` VARCHAR(64) DEFAULT NULL AFTER `admin_signature_path`",
                    'admin_signed_at'      => "ALTER TABLE `investment_contracts` ADD COLUMN `admin_signed_at` DATETIME DEFAULT NULL AFTER `admin_signed_by`",
                    'finalized_pdf_path'   => "ALTER TABLE `investment_contracts` ADD COLUMN `finalized_pdf_path` VARCHAR(255) DEFAULT NULL AFTER `admin_signed_at`",
                    'rejected_reason'      => "ALTER TABLE `investment_contracts` ADD COLUMN `rejected_reason` VARCHAR(255) DEFAULT NULL AFTER `finalized_pdf_path`",
                ];
                foreach ($legacyContractCols as $col => $sql) {
                    $cols = $pdo->query("SHOW COLUMNS FROM `investment_contracts` LIKE '{$col}'")->fetchAll();
                    if (empty($cols)) {
                        $pdo->exec($sql);
                    }
                }
            }

            // funding_records.contract_id is required to deduplicate admin approval / pending reservation safely.
            $tables = $pdo->query("SHOW TABLES LIKE 'funding_records'")->fetchAll();
            if (!empty($tables)) {
                $cols = $pdo->query("SHOW COLUMNS FROM `funding_records` LIKE 'contract_id'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `funding_records` ADD COLUMN `contract_id` BIGINT UNSIGNED DEFAULT NULL AFTER `asset_id`");
                }
                $idx = $pdo->query("SHOW INDEX FROM `funding_records` WHERE Key_name='idx_funding_contract_id'")->fetchAll();
                if (empty($idx)) {
                    $pdo->exec("ALTER TABLE `funding_records` ADD INDEX `idx_funding_contract_id` (`contract_id`)");
                }
            }
                        // Ensure wallet_transactions.asset supports real asset ids (not only USDT enum)
            $cols = $pdo->query("SHOW COLUMNS FROM `wallet_transactions` LIKE 'asset'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (strpos($type, 'enum') !== false || strpos($type, 'varchar') === false) {
                    $pdo->exec("ALTER TABLE `wallet_transactions` MODIFY COLUMN `asset` VARCHAR(64) NOT NULL DEFAULT 'USDT'");
                }
            }
            // Ensure withdraw_requests.asset supports token asset ids
            $cols = $pdo->query("SHOW COLUMNS FROM `withdraw_requests` LIKE 'asset'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (strpos($type, 'enum') !== false || strpos($type, 'varchar') === false) {
                    $pdo->exec("ALTER TABLE `withdraw_requests` MODIFY COLUMN `asset` VARCHAR(64) NOT NULL DEFAULT 'USDT'");
                }
            }
            // Flexible kinds/status for newer flows
            $cols = $pdo->query("SHOW COLUMNS FROM `wallet_transactions` LIKE 'kind'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (strpos($type, 'enum') !== false || strpos($type, 'varchar') === false) {
                    $pdo->exec("ALTER TABLE `wallet_transactions` MODIFY COLUMN `kind` VARCHAR(64) NOT NULL DEFAULT 'deposit'");
                }
            }
            $cols = $pdo->query("SHOW COLUMNS FROM `wallet_transactions` LIKE 'status'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (strpos($type, 'enum') !== false || strpos($type, 'varchar') === false) {
                    $pdo->exec("ALTER TABLE `wallet_transactions` MODIFY COLUMN `status` VARCHAR(64) NOT NULL DEFAULT '대기'");
                }
            }
            $cols = $pdo->query("SHOW COLUMNS FROM `withdraw_requests` LIKE 'status'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (strpos($type, 'enum') !== false || strpos($type, 'varchar') === false) {
                    $pdo->exec("ALTER TABLE `withdraw_requests` MODIFY COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'pending'");
                }
            }
            $cols = $pdo->query("SHOW COLUMNS FROM `token_withdraw_requests` LIKE 'status'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (strpos($type, 'enum') !== false || strpos($type, 'varchar') === false) {
                    $pdo->exec("ALTER TABLE `token_withdraw_requests` MODIFY COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'pending'");
                }
            }

            $userCols = [
                'is_suspended' => "ALTER TABLE `users` ADD COLUMN `is_suspended` TINYINT(1) NOT NULL DEFAULT 0 AFTER `kyc_yn`",
                'suspended_reason' => "ALTER TABLE `users` ADD COLUMN `suspended_reason` VARCHAR(255) DEFAULT NULL AFTER `is_suspended`",
                'suspended_at' => "ALTER TABLE `users` ADD COLUMN `suspended_at` DATETIME DEFAULT NULL AFTER `suspended_reason`",
                'suspended_by' => "ALTER TABLE `users` ADD COLUMN `suspended_by` VARCHAR(64) DEFAULT NULL AFTER `suspended_at`",
                'withdraw_suspended' => "ALTER TABLE `users` ADD COLUMN `withdraw_suspended` TINYINT(1) NOT NULL DEFAULT 0 AFTER `suspended_by`",
                'withdraw_suspension_reason' => "ALTER TABLE `users` ADD COLUMN `withdraw_suspension_reason` VARCHAR(255) DEFAULT NULL AFTER `withdraw_suspended`",
                'withdraw_suspended_at' => "ALTER TABLE `users` ADD COLUMN `withdraw_suspended_at` DATETIME DEFAULT NULL AFTER `withdraw_suspension_reason`",
                'withdraw_suspended_by' => "ALTER TABLE `users` ADD COLUMN `withdraw_suspended_by` VARCHAR(64) DEFAULT NULL AFTER `withdraw_suspended_at`",
            ];
            foreach ($userCols as $col => $sql) {
                $cols = $pdo->query("SHOW COLUMNS FROM `users` LIKE '{$col}'")->fetchAll();
                if (empty($cols)) $pdo->exec($sql);
            }

            $withdrawCols = [
                'fee_mode' => "ALTER TABLE `withdraw_requests` ADD COLUMN `fee_mode` VARCHAR(20) NOT NULL DEFAULT 'fixed_usdt' AFTER `amount`",
                'fee_value' => "ALTER TABLE `withdraw_requests` ADD COLUMN `fee_value` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `fee_mode`",
                'fee_amount' => "ALTER TABLE `withdraw_requests` ADD COLUMN `fee_amount` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `fee_value`",
                'net_amount' => "ALTER TABLE `withdraw_requests` ADD COLUMN `net_amount` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `fee_amount`",
                'reject_reason' => "ALTER TABLE `withdraw_requests` ADD COLUMN `reject_reason` VARCHAR(500) DEFAULT NULL AFTER `memo`",
                'reviewed_by' => "ALTER TABLE `withdraw_requests` ADD COLUMN `reviewed_by` VARCHAR(64) DEFAULT NULL AFTER `reject_reason`",
                'reviewed_at' => "ALTER TABLE `withdraw_requests` ADD COLUMN `reviewed_at` DATETIME DEFAULT NULL AFTER `reviewed_by`",
            ];
            foreach ($withdrawCols as $col => $sql) {
                $cols = $pdo->query("SHOW COLUMNS FROM `withdraw_requests` LIKE '{$col}'")->fetchAll();
                if (empty($cols)) $pdo->exec($sql);
            }
            // (2026-05-08) Backfill fee_amount / net_amount from the memo
            //   string for legacy rows where the INSERT only wrote memo.
            //   memo carries "fee_amount:1|net:719" — extract once into the
            //   dedicated columns so admin_accounting and history can read
            //   straight from the row. Run BEFORE the net=amount fallback
            //   so the memo-derived (smaller) net wins where present.
            try {
                $pdo->exec(
                    "UPDATE `withdraw_requests`
                       SET `fee_amount` = CAST(REGEXP_REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(`memo`, 'fee_amount:', -1), '|', 1), '[^0-9.]', '') AS DECIMAL(24,6))
                     WHERE `fee_amount`=0
                       AND `memo` LIKE '%fee_amount:%'"
                );
            } catch (Throwable $e) {}
            try {
                $pdo->exec(
                    "UPDATE `withdraw_requests`
                       SET `net_amount` = CAST(REGEXP_REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(`memo`, '|net:', -1), '|', 1), '[^0-9.]', '') AS DECIMAL(24,6))
                     WHERE (`net_amount`=0 OR `net_amount`=`amount`)
                       AND `memo` LIKE '%|net:%'"
                );
            } catch (Throwable $e) {}
            // Final fallback: if memo had no breakdown, default net=amount
            // (this is correct for old fee-less withdrawals).
            try { $pdo->exec("UPDATE `withdraw_requests` SET `net_amount`=`amount` WHERE `net_amount`=0 AND `amount`>0"); } catch (Throwable $e) {}

            $tokenWithdrawCols = [
                'fee_mode' => "ALTER TABLE `token_withdraw_requests` ADD COLUMN `fee_mode` VARCHAR(20) NOT NULL DEFAULT 'fixed_usdt' AFTER `amount_token`",
                'fee_value' => "ALTER TABLE `token_withdraw_requests` ADD COLUMN `fee_value` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `fee_mode`",
                'fee_amount' => "ALTER TABLE `token_withdraw_requests` ADD COLUMN `fee_amount` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `fee_value`",
                'fee_asset' => "ALTER TABLE `token_withdraw_requests` ADD COLUMN `fee_asset` VARCHAR(64) NOT NULL DEFAULT 'USDT' AFTER `fee_amount`",
                'net_amount' => "ALTER TABLE `token_withdraw_requests` ADD COLUMN `net_amount` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `fee_asset`",
                'reject_reason' => "ALTER TABLE `token_withdraw_requests` ADD COLUMN `reject_reason` VARCHAR(500) DEFAULT NULL AFTER `memo`",
                'reviewed_by' => "ALTER TABLE `token_withdraw_requests` ADD COLUMN `reviewed_by` VARCHAR(64) DEFAULT NULL AFTER `reject_reason`",
                'reviewed_at' => "ALTER TABLE `token_withdraw_requests` ADD COLUMN `reviewed_at` DATETIME DEFAULT NULL AFTER `reviewed_by`",
            ];
            foreach ($tokenWithdrawCols as $col => $sql) {
                $cols = $pdo->query("SHOW COLUMNS FROM `token_withdraw_requests` LIKE '{$col}'")->fetchAll();
                if (empty($cols)) $pdo->exec($sql);
            }
            // (2026-05-08) Same memo-based backfill for token_withdraw_requests.
            try {
                $pdo->exec(
                    "UPDATE `token_withdraw_requests`
                       SET `fee_amount` = CAST(REGEXP_REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(`memo`, 'fee_amount:', -1), '|', 1), '[^0-9.]', '') AS DECIMAL(24,6))
                     WHERE `fee_amount`=0
                       AND `memo` LIKE '%fee_amount:%'"
                );
            } catch (Throwable $e) {}
            try {
                $pdo->exec(
                    "UPDATE `token_withdraw_requests`
                       SET `fee_asset` = SUBSTRING_INDEX(SUBSTRING_INDEX(`memo`, 'fee_asset:', -1), '|', 1)
                     WHERE (`fee_asset` IS NULL OR `fee_asset`='' OR `fee_asset`='USDT')
                       AND `memo` LIKE '%fee_asset:%'"
                );
            } catch (Throwable $e) {}
            try {
                $pdo->exec(
                    "UPDATE `token_withdraw_requests`
                       SET `net_amount` = CAST(REGEXP_REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(`memo`, '|net:', -1), '|', 1), '[^0-9.]', '') AS DECIMAL(24,6))
                     WHERE (`net_amount`=0 OR `net_amount`=`amount_token`)
                       AND `memo` LIKE '%|net:%'"
                );
            } catch (Throwable $e) {}
            try { $pdo->exec("UPDATE `token_withdraw_requests` SET `net_amount`=`amount_token` WHERE `net_amount`=0 AND `amount_token`>0"); } catch (Throwable $e) {}
// Check if wallet_transactions table has admin_note column
            $cols = $pdo->query("SHOW COLUMNS FROM `wallet_transactions` LIKE 'admin_note'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `wallet_transactions` ADD COLUMN `admin_note` VARCHAR(500) DEFAULT NULL AFTER `memo`");
            }
            // Ensure sales table can store tax separately when sale settlement is updated
            $tables = $pdo->query("SHOW TABLES LIKE 'sales'")->fetchAll();
            if (!empty($tables)) {
                $cols = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'sale_tax_amount'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `sales` ADD COLUMN `sale_tax_amount` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `sold_price_krw`");
                } else {
                    $type = strtolower((string)($cols[0]['Type'] ?? ''));
                    if (strpos($type, 'decimal') === false) {
                        $pdo->exec("ALTER TABLE `sales` MODIFY COLUMN `sale_tax_amount` DECIMAL(24,6) NOT NULL DEFAULT 0");
                    }
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'actual_acquisition_cost_input'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `sales` ADD COLUMN `actual_acquisition_cost_input` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `buy_price_krw`");
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'other_expenses_input'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `sales` ADD COLUMN `other_expenses_input` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `sale_tax_amount`");
                } else {
                    $type = strtolower((string)($cols[0]['Type'] ?? ''));
                    if (strpos($type, 'decimal') === false) {
                        $pdo->exec("ALTER TABLE `sales` MODIFY COLUMN `other_expenses_input` DECIMAL(24,6) NOT NULL DEFAULT 0");
                    }
                }
                try {
                    $pdo->exec("UPDATE `sales` SET `other_expenses_input` = COALESCE(NULLIF(`other_expenses_input`,0), `expenses_krw`, 0) WHERE (COALESCE(`other_expenses_input`,0) = 0) AND COALESCE(`expenses_krw`,0) > 0");
                } catch (Throwable $e) {}
                $cols = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'fixed_fx_per_usdt'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `sales` ADD COLUMN `fixed_fx_per_usdt` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `vault_balance_usdt`");
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'manual_fx_per_usdt'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `sales` ADD COLUMN `manual_fx_per_usdt` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `window_start`");
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'executed_at'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `sales` ADD COLUMN `executed_at` DATETIME DEFAULT NULL AFTER `fixed_fx_per_usdt`");
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'executed_by'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `sales` ADD COLUMN `executed_by` VARCHAR(64) DEFAULT NULL AFTER `executed_at`");
                }
            }
            // Ensure sale_redemptions.settlement_basis supports USDT
            $tables = $pdo->query("SHOW TABLES LIKE 'sale_redemptions'")->fetchAll();
            if (!empty($tables)) {
                $cols = $pdo->query("SHOW COLUMNS FROM `sale_redemptions` LIKE 'settlement_basis'")->fetchAll();
                if (!empty($cols)) {
                    $type = strtolower((string)($cols[0]['Type'] ?? ''));
                    if (strpos($type, 'usdt') === false) {
                        $pdo->exec("ALTER TABLE `sale_redemptions` MODIFY COLUMN `settlement_basis` ENUM('KRW','USD','KZT','PHP','GEL','IDR','VND','USDT') NOT NULL DEFAULT 'KRW'");
                    }
                }
            }
            // Remove legacy trigger that blocks deposit approval / memo updates
            // All validation is now enforced in PHP (admin_deposit.php, deposit_withdraw.php)
            $pdo->exec("DROP TRIGGER IF EXISTS `trg_wallet_transactions_guard_update`");
            // Check if contract_audit_logs table exists
            $tables = $pdo->query("SHOW TABLES LIKE 'contract_audit_logs'")->fetchAll();
            if (empty($tables)) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `contract_audit_logs` (
                    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    `contract_id` BIGINT UNSIGNED NOT NULL,
                    `actor_type` ENUM('user','admin','system') NOT NULL,
                    `actor_id` VARCHAR(120) DEFAULT NULL,
                    `action_type` VARCHAR(60) NOT NULL,
                    `ip` VARCHAR(128) DEFAULT NULL,
                    `user_agent` VARCHAR(255) DEFAULT NULL,
                    `payload_json` JSON DEFAULT NULL,
                    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    KEY `idx_cal_contract` (`contract_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            }

            // Ensure market tables support both legacy and current trading flows
            $tables = $pdo->query("SHOW TABLES LIKE 'orders'")->fetchAll();
            if (!empty($tables)) {
                $cols = $pdo->query("SHOW COLUMNS FROM `orders` LIKE 'fee_rate'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `orders` ADD COLUMN `fee_rate` DECIMAL(8,4) NOT NULL DEFAULT 0 AFTER `escrow_token`");
                }
            }

            $tables = $pdo->query("SHOW TABLES LIKE 'trades'")->fetchAll();
            if (!empty($tables)) {
                $cols = $pdo->query("SHOW COLUMNS FROM `trades` LIKE 'order_id'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `trades` ADD COLUMN `order_id` VARCHAR(80) DEFAULT NULL AFTER `asset_id`");
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `trades` LIKE 'buyer_address'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `trades` ADD COLUMN `buyer_address` VARCHAR(64) DEFAULT NULL AFTER `qty`");
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `trades` LIKE 'seller_address'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `trades` ADD COLUMN `seller_address` VARCHAR(64) DEFAULT NULL AFTER `buyer_address`");
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `trades` LIKE 'amount'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `trades` ADD COLUMN `amount` DECIMAL(18,6) NOT NULL DEFAULT 0 AFTER `price`");
                    if ($pdo->query("SHOW COLUMNS FROM `trades` LIKE 'qty'")->fetchAll()) {
                        $pdo->exec("UPDATE `trades` SET `amount` = COALESCE(`qty`, 0) WHERE `amount` = 0");
                    }
                }
                $cols = $pdo->query("SHOW COLUMNS FROM `trades` LIKE 'total_usdt'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `trades` ADD COLUMN `total_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0 AFTER `amount`");
                    $pdo->exec("UPDATE `trades` SET `total_usdt` = ROUND(COALESCE(`price`,0) * COALESCE(`amount`,0), 6) WHERE `total_usdt` = 0");
                }
            }

            // Keep a second idempotent pass here as a safety net when later migrations are edited.
            self::ensureInterestClaimsSchemaOn($pdo);
        } catch (Throwable $e) {
            // Non-fatal: log but don't crash the app
            error_log('RWA autoMigrate: ' . $e->getMessage());
        }
    }

    public static function ensureInterestClaimsSchema(): void {
        self::ensureInterestClaimsSchemaOn(self::get());
    }

    private static function ensureInterestClaimsSchemaOn(PDO $pdo): void {
        try {
            $tables = $pdo->query("SHOW TABLES LIKE 'interest_claims'")->fetchAll();
            if (empty($tables)) {
                return;
            }

            $safeExec = function (string $sql, string $label) use ($pdo): bool {
                try {
                    $pdo->exec($sql);
                    return true;
                } catch (Throwable $e) {
                    error_log('RWA interest_claims migrate [' . $label . ']: ' . $e->getMessage());
                    return false;
                }
            };

            $hasClaimedAt = !empty($pdo->query("SHOW COLUMNS FROM `interest_claims` LIKE 'claimed_at'")->fetchAll());
            $claimedAtJustAdded = false;
            if (!$hasClaimedAt) {
                $claimedAtJustAdded = $safeExec(
                    "ALTER TABLE `interest_claims` ADD COLUMN `claimed_at` DATETIME DEFAULT NULL AFTER `created_at`",
                    'add_claimed_at'
                );
                $hasClaimedAt = !empty($pdo->query("SHOW COLUMNS FROM `interest_claims` LIKE 'claimed_at'")->fetchAll());
            }

            $hasClaimBatchId = !empty($pdo->query("SHOW COLUMNS FROM `interest_claims` LIKE 'claim_batch_id'")->fetchAll());
            if (!$hasClaimBatchId) {
                $afterColumn = $hasClaimedAt ? 'claimed_at' : 'created_at';
                $safeExec(
                    "ALTER TABLE `interest_claims` ADD COLUMN `claim_batch_id` VARCHAR(64) DEFAULT NULL AFTER `{$afterColumn}`",
                    'add_claim_batch_id'
                );
            }

            $hasFxPerUsdt = !empty($pdo->query("SHOW COLUMNS FROM `interest_claims` LIKE 'fx_per_usdt'")->fetchAll());
            if (!$hasFxPerUsdt) {
                $safeExec(
                    "ALTER TABLE `interest_claims` ADD COLUMN `fx_per_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0 AFTER `amount_local`",
                    'add_fx_per_usdt'
                );
            }
            $safeExec(
                "UPDATE `interest_claims` SET `fx_per_usdt` = COALESCE(NULLIF(`fx_per_usdt`,0), NULLIF(`fx_krw_per_usdt`,0), 0) WHERE `fx_per_usdt` = 0",
                'backfill_fx_per_usdt'
            );

            $cols = $pdo->query("SHOW COLUMNS FROM `interest_claims` LIKE 'settlement_basis'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (strpos($type, 'usdt') === false) {
                    $safeExec(
                        "ALTER TABLE `interest_claims` MODIFY COLUMN `settlement_basis` ENUM('KRW','USD','KZT','PHP','GEL','IDR','VND','USDT') NOT NULL DEFAULT 'KRW'",
                        'extend_settlement_basis'
                    );
                }
            }

            $cols = $pdo->query("SHOW COLUMNS FROM `interest_claims` LIKE 'month_key'")->fetchAll();
            if (!empty($cols)) {
                $type = strtolower((string)($cols[0]['Type'] ?? ''));
                if (preg_match('/char\((\d+)\)/', $type, $m) && ((int)$m[1]) < 20) {
                    $safeExec(
                        "ALTER TABLE `interest_claims` MODIFY COLUMN `month_key` VARCHAR(32) NOT NULL",
                        'widen_month_key'
                    );
                }
            }

            $uniq = $pdo->query("SHOW INDEX FROM `interest_claims` WHERE Key_name='uniq_interest'")->fetchAll();
            if (!empty($uniq)) {
                $safeExec("ALTER TABLE `interest_claims` DROP INDEX `uniq_interest`", 'drop_legacy_unique');
            }

            // (2026-06-08 v900) interest_claims UNIQUE 추가 — race condition 으로
            //   인한 이중 이자 지급 차단. v379 의 legacy uniq_interest 와 별도
            //   이름 (ux_ic_addr_asset_month) 사용. 기존 중복 데이터가 있으면
            //   ALTER 가 실패 (DUP_ENTRY) — safeExec 가 silently fail 처리하고
            //   migration_audit 에 기록. 운영자가 sql/manual_add_interest_claims_
            //   unique_v900.sql 의 사전 진단 SELECT 실행 후 수동 정리 필요.
            $uxNew = $pdo->query("SHOW INDEX FROM `interest_claims` WHERE Key_name='ux_ic_addr_asset_month'")->fetchAll();
            if (empty($uxNew)) {
                $safeExec(
                    "ALTER TABLE `interest_claims` ADD UNIQUE KEY `ux_ic_addr_asset_month` (`address`, `asset_id`, `month_key`)",
                    'add_unique_addr_asset_month_v900'
                );
            }

            if ($hasClaimedAt) {
                $idx = $pdo->query("SHOW INDEX FROM `interest_claims` WHERE Key_name='idx_interest_pending'")->fetchAll();
                if (empty($idx)) {
                    $safeExec(
                        "ALTER TABLE `interest_claims` ADD INDEX `idx_interest_pending` (`address`,`asset_id`,`claimed_at`,`created_at`)",
                        'add_idx_interest_pending'
                    );
                }
            }

            if ($claimedAtJustAdded && $hasClaimedAt) {
                $safeExec(
                    "UPDATE `interest_claims` SET `claimed_at` = `created_at` WHERE `claimed_at` IS NULL",
                    'backfill_claimed_at'
                );
            }
        } catch (Throwable $e) {
            error_log('RWA ensureInterestClaimsSchema: ' . $e->getMessage());
        }
    }


    /** Convenience: execute query and return all rows */
    public static function fetchAll(string $sql, array $params = []): array {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** Convenience: fetch one row */
    public static function fetchOne(string $sql, array $params = []): ?array {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** Convenience: execute and return affected rows */
    public static function execute(string $sql, array $params = []): int {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /** Convenience: fetch single scalar value */
    public static function fetchValue(string $sql, array $params = []) {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    /** Get PDO for transactions */
    public static function pdo(): PDO {
        return self::get();
    }
}
