<?php
/**
 * DB 마이그레이션 자동 적용기
 *
 * sql/ 디렉터리의 *.sql 패치를 스캔하여 아직 적용되지 않은 것만 순차 실행.
 * 적용 이력은 db_migrations 테이블에 저장 (filename PK + file hash + applied_at).
 *
 * 호출 경로:
 *  1. 관리자 수동: POST/GET /api/admin/db/migrate
 *  2. 관리자 로그인 성공 시 lazy shutdown trigger (background)
 *  3. install.php 재실행 시 (별도 경로, 기존 동작 유지)
 */

// (audit H2-2 fix · 2026-06-12) 자동 적용 차단 목록 (blocklist).
//   파괴적(전체 DELETE / 운영 reset) 패치는 자동 경로에서 절대 실행 금지.
//   적용 경로 전부 — lazyApplyPendingMigrationsOnShutdown (admin 로그인),
//   POST/GET /api/admin/db/migrate, user_profile/admin_emails 의 self-heal —
//   가 모두 applyPendingMigrations() 를 거치므로 이 함수 한 곳에서 차단하면
//   모든 자동 경로가 커버됨.
//   ⚠ silica_cleanup_dummies.sql: users / holdings / interest_claims / balances /
//      wallet_transactions / dividend_payouts 등 사용자 데이터 전체 DELETE.
//      개발/테스트 시드 청소용이라 운영 데이터가 있으면 전멸 → 자동 실행 영구 차단.
//   초기화가 필요한 시점 (고객 이관 직전) 에는 phpMyAdmin 에서 파일 내용을
//   직접 실행 (의도적 1회). blocklist 는 자동 경로만 막을 뿐 수동 SQL 실행과
//   무관 → "자동 실행만 차단, 초기화 능력 보존" 을 정확히 구현.
//   파일 자체도 보존 (다른 부동산 자산 새 clean 설치 시 재사용 가능).
if (!defined('MIGRATION_AUTO_APPLY_BLOCKLIST')) {
    define('MIGRATION_AUTO_APPLY_BLOCKLIST', [
        'silica_cleanup_dummies.sql',
    ]);
}

if (!function_exists('ensureMigrationTable')) {
    function ensureMigrationTable(): void {
        DB::execute("
            CREATE TABLE IF NOT EXISTS `db_migrations` (
                `filename` VARCHAR(255) NOT NULL,
                `file_hash` VARCHAR(64) DEFAULT NULL,
                `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `notes` VARCHAR(500) DEFAULT NULL,
                PRIMARY KEY (`filename`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }
}

if (!function_exists('getSqlPatchDir')) {
    function getSqlPatchDir(): ?string {
        // php-api/ 기준 상위 디렉터리의 sql/
        $candidates = [
            dirname(__DIR__, 2) . '/sql',          // public_html/rwa6/sql
            dirname(__DIR__) . '/../sql',           // fallback
        ];
        foreach ($candidates as $path) {
            if (is_dir($path)) return realpath($path) ?: $path;
        }
        return null;
    }
}

if (!function_exists('applyPendingMigrations')) {
    /**
     * 미적용 SQL 패치를 찾아 순차 적용.
     * @param bool $dryRun true면 실제 실행 없이 계획만 반환
     * @return array summary (applied, skipped, failed_at, errors)
     */
    function applyPendingMigrations(bool $dryRun = false): array {
        try {
            ensureMigrationTable();
        } catch (Throwable $e) {
            return ['error' => 'migration 테이블 생성 실패: ' . $e->getMessage()];
        }

        $sqlDir = getSqlPatchDir();
        if (!$sqlDir) {
            return ['applied' => 0, 'skipped' => 0, 'files' => [], 'note' => 'sql/ 디렉터리 없음'];
        }

        $alreadyRows = DB::fetchAll("SELECT filename FROM db_migrations");
        $already = array_column($alreadyRows, 'filename');

        $patches = glob($sqlDir . '/*.sql') ?: [];
        sort($patches);

        $result = [
            'dry_run' => $dryRun,
            'sql_dir' => $sqlDir,
            'total_patches' => count($patches),
            'already_applied' => count($already),
            'applied' => 0,
            'skipped' => 0,
            'blocked' => [],
            'files' => [],
            'errors' => [],
        ];

        foreach ($patches as $patchFile) {
            $basename = basename($patchFile);
            if (in_array($basename, $already, true)) {
                $result['skipped']++;
                continue;
            }
            // (audit H2-2 fix · 2026-06-12) blocklist — 파괴적 패치 자동 적용 금지.
            //   dry-run 포함 모든 자동 경로에서 skip. 이관 시점 초기화는 phpMyAdmin
            //   직접 실행 (의도적). db_migrations 에 기록하지 않음 → 차단 상태 유지.
            if (defined('MIGRATION_AUTO_APPLY_BLOCKLIST') && in_array($basename, MIGRATION_AUTO_APPLY_BLOCKLIST, true)) {
                $result['blocked'][] = $basename;
                error_log("[migration] BLOCKED auto-apply (destructive, manual-only via phpMyAdmin): {$basename}");
                continue;
            }

            $sql = @file_get_contents($patchFile);
            if ($sql === false || $sql === '') {
                $result['errors'][] = ['file' => $basename, 'error' => '파일 읽기 실패 또는 빈 파일'];
                continue;
            }

            $hash = hash('sha256', $sql);

            if ($dryRun) {
                $result['files'][] = ['file' => $basename, 'status' => 'pending', 'hash' => $hash];
                $result['applied']++;
                continue;
            }

            try {
                // PDO::exec는 여러 statement를 한 번에 실행 가능 (MySQL 클라이언트 옵션 의존)
                DB::pdo()->exec($sql);
                DB::execute(
                    "INSERT INTO db_migrations (filename, file_hash, notes) VALUES (?, ?, ?)",
                    [$basename, $hash, 'auto_apply']
                );
                $result['files'][] = ['file' => $basename, 'status' => 'applied', 'hash' => $hash];
                $result['applied']++;
            } catch (Throwable $e) {
                $result['errors'][] = ['file' => $basename, 'error' => $e->getMessage()];
                $result['failed_at'] = $basename;
                error_log("[migration] {$basename} failed: " . $e->getMessage());
                // 실패 시 중단 — 순서 의존성 가능
                break;
            }
        }

        return $result;
    }
}

if (!function_exists('lazyApplyPendingMigrationsOnShutdown')) {
    /**
     * 관리자 로그인 성공 후 shutdown 시점에 background로 실행.
     * 클라이언트 응답 먼저 전송 후 migration 처리 → 로그인 지연 없음.
     */
    function lazyApplyPendingMigrationsOnShutdown(): void {
        // (audit H2-1 fix · 2026-06-12) 운영 자동 DDL 끄기 스위치. 끄면 admin 로그인 시
        //   sql/ 패치 자동적용을 정지. 수동 /api/admin/db/migrate (applyPendingMigrations
        //   직접 호출) 는 영향 없음 — 이 가드는 lazy(자동) 경로에만 적용.
        if (defined('AUTO_MIGRATE_ENABLED') && !AUTO_MIGRATE_ENABLED) return;
        // 중복 등록 방지 플래그
        static $registered = false;
        if ($registered) return;
        $registered = true;

        register_shutdown_function(function () {
            try {
                if (function_exists('fastcgi_finish_request')) {
                    // 이미 응답 전송됐을 수 있으나, 안전하게 한번 더 호출해도 무해
                    @fastcgi_finish_request();
                }
                applyPendingMigrations(false);
            } catch (Throwable $e) {
                error_log('[migrations] shutdown apply error: ' . $e->getMessage());
            }
        });
    }
}
