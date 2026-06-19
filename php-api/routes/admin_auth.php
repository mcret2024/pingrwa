<?php
/**
 * Admin Auth routes
 */

post('/api/admin/auth/login', function () {
    $body = getJsonBody();
    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');
    // (2026-05-19 v587) 운영자 결정 — OTP 완전 제거. 지갑 화이트리스트가
    //   2-factor 역할을 하므로 OTP 는 잉여. body['otp'] 는 더 이상 읽지 않음.

    if (!$username || !$password) jsonError(400, '아이디/비밀번호가 필요합니다.');

    // (2026-05-19 v584) 운영자 요청: '로그인 페이지에서 지갑 연결을 하지
    //   않으면 로그인 자체가 되지 않도록.' 화이트리스트가 설정돼 있으면
    //   로그인 시점에 X-Admin-Wallet 헤더의 주소를 검증 — 화이트리스트
    //   미포함이면 JWT 발급 자체를 거절. 비밀번호 + OTP 인증 통과해도
    //   이 게이트를 통과 못하면 토큰 발급 안 됨.
    if (adminWalletWhitelistConfigured()) {
        $hdrWallet = trim((string)($_SERVER['HTTP_X_ADMIN_WALLET'] ?? ''));
        if ($hdrWallet === '') {
            jsonError(403, '관리자 지갑 연결이 필요합니다. 로그인 전에 Phantom 지갑을 연결하세요.');
        }
        if (!isValidSolanaAddress($hdrWallet)) {
            jsonError(403, '관리자 지갑 주소 형식이 올바르지 않습니다.');
        }
        if (!adminWalletInWhitelist($hdrWallet)) {
            jsonError(403, '이 지갑은 관리자 화이트리스트에 등록되지 않았습니다. 등록된 지갑으로 다시 연결하세요.');
        }
        // 비밀번호/OTP 검사 전에 미리 한 번 차단해 brute-force 시도 시 빠르게
        //   reject (비밀번호 hash 비교 비용 절약).
    }

    $admin = DB::fetchOne("SELECT * FROM admins WHERE username=? AND is_active=1", [$username]);
    if (!$admin) jsonError(401, '로그인 실패');

    $hash = $admin['password_hash'];
    // Node.js bcrypt uses $2b$ prefix; PHP needs $2y$ or $2a$
    $hashCompat = $hash;
    if (str_starts_with($hash, '$2b$')) {
        $hashCompat = '$2y$' . substr($hash, 4);
    }

    if (!password_verify($password, $hashCompat)) {
        jsonError(401, '로그인 실패');
    }

    // If hash was Node.js format, update to PHP-native format
    if ($hash !== $hashCompat) {
        $newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
        DB::execute("UPDATE admins SET password_hash=? WHERE id=?", [$newHash, $admin['id']]);
    }

    // (2026-05-19 v587) OTP 검증 호출 제거. 지갑 화이트리스트 (v583/v584) 가
    //   2-factor 게이트 — 비밀번호 + 지갑 둘 다 통과한 시점에 토큰 발급.
    //   verifyAdminOtpOrThrow() 함수와 user 측 OTP 코드는 그대로 보존 — admin
    //   로그인 경로에서만 호출 안 함.

    $token = makeAdminJwt($username);

    // 로그인 성공 후 background에서 미적용 DB 마이그레이션 자동 실행 (응답 지연 없음)
    if (function_exists('lazyApplyPendingMigrationsOnShutdown')) {
        lazyApplyPendingMigrationsOnShutdown();
    }

    jsonOk(['token' => $token, 'username' => $username]);
});

// (2026-05-19 v584) 로그인 페이지 전용 — 화이트리스트가 활성화돼 있는지를
//   알려주는 공개 엔드포인트. 활성 시 프론트는 지갑 연결 UI 를 강제. 비활성
//   시 기존처럼 username/password 만으로 진행 가능. 화이트리스트 주소 자체는
//   응답에 포함하지 않음 (정보 노출 차단).
get('/api/admin/auth/wallet-required', function () {
    jsonOk([
        'wallet_required' => adminWalletWhitelistConfigured(),
    ]);
});

get('/api/admin/auth/me', function () {
    // (audit C1 fix · 2026-06-12) adminJwtOnlyRead() 사용 — adminOnly() 의 wallet
    //   whitelist 검증 우회. /api/admin/auth/me 는 admin.core.js 의 isAuthRoute
    //   정규식에 포함되어 X-Admin-Wallet 헤더가 부착되지 않음. 이 endpoint 는 read-only
    //   토큰 검증만 하므로 wallet check 불필요. mutation 라우트는 adminAuth() 그대로 사용
    //   → adminOnly() 의 강한 검증 적용.
    $admin = adminJwtOnlyRead();
    jsonOk(['username' => $admin['username']]);
});

/**
 * 관리자 수동 마이그레이션 트리거.
 * 로그인 후에는 자동 실행되지만, 즉시 확인 용도로 직접 호출 가능.
 * 응답에 적용된 파일 목록 포함.
 *
 * (audit H2-1 fix · 2026-06-12) AUTO_MIGRATE_ENABLED=false 로 자동 마이그레이션을
 *   끈 환경에서 배포 후 수동 적용하는 공식 경로. dry-run 이 아니면 sql/ 패치
 *   (applyPendingMigrations) + db.php 인라인 DDL (DB::runAutoMigrateNow) 둘 다 적용.
 *   이 엔드포인트는 끄기 스위치와 무관하게 항상 동작 (운영자 명시 실행 + adminOnly).
 */
$dbMigrateHandler = function () {
    adminOnly();
    $dryRun = (($_GET['dry'] ?? $_POST['dry'] ?? '') === '1');
    $autoMigrate = ['ran' => false];
    if (!$dryRun) {
        try {
            DB::runAutoMigrateNow();
            $autoMigrate = ['ran' => true];
        } catch (Throwable $e) {
            $autoMigrate = ['ran' => false, 'error' => $e->getMessage()];
            error_log('[db/migrate] runAutoMigrateNow failed: ' . $e->getMessage());
        }
    }
    $result = applyPendingMigrations($dryRun);
    $result['auto_migrate'] = $autoMigrate;
    $result['auto_migrate_enabled'] = defined('AUTO_MIGRATE_ENABLED') ? AUTO_MIGRATE_ENABLED : null;
    jsonOk($result);
};
post('/api/admin/db/migrate', $dbMigrateHandler);
get('/api/admin/db/migrate', $dbMigrateHandler);
