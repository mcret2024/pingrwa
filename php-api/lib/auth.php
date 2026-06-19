<?php
/**
 * RWA Platform - Auth Middleware
 */

use OTPHP\TOTP;

/**
 * Parse user from Authorization header (optional).
 * Sets global $currentUser = ['address'=>..., 'mfa'=>bool, 'via'=>'jwt'|'x-wallet'] or null
 */
function parseAuthOptional(): ?array {
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($hdr, 'Bearer ')) {
        $token = substr($hdr, 7);
        $decoded = decodeJwt($token, JWT_SECRET);
        if ($decoded && !empty($decoded['address'])) {
            // (2026-05-08) Trim defensively. Some JWT minting paths produced
            // tokens with leading/trailing whitespace in 'address'. The
            // user_notifications path already trims, but holdings INSERTs
            // and the /api/portfolio interest_claims SELECT did not — so a
            // user could see a popup ("4.10 USDT pending") while the
            // pending-interest card showed 0.00 because the rows lived under
            // an untrimmed address that no SELECT path could find with the
            // same address value. Canonical-form-from-auth-layer ensures all
            // subsequent INSERTs / SELECTs see the same string.
            return [
                'address' => trim((string)$decoded['address']),
                'mfa'     => !empty($decoded['mfa']),
                'via'     => 'jwt',
            ];
        }
        return null;
    }

    $xw = trim($_SERVER['HTTP_X_WALLET'] ?? '');
    if ($xw) {
        return ['address' => $xw, 'mfa' => false, 'via' => 'x-wallet'];
    }
    return null;
}

function authOptional(): ?array {
    return parseAuthOptional();
}

function userControlColumns(): array {
    static $cache = null;
    if ($cache !== null) return $cache;

    $wanted = [
        'is_suspended',
        'suspended_reason',
        'suspended_at',
        'suspended_by',
        'withdraw_suspended',
        'withdraw_suspension_reason',
        'withdraw_suspended_at',
        'withdraw_suspended_by',
    ];
    $cache = array_fill_keys($wanted, false);

    try {
        $rows = DB::fetchAll("SHOW COLUMNS FROM `users`");
        foreach ($rows as $row) {
            $field = (string)($row['Field'] ?? '');
            if ($field !== '' && array_key_exists($field, $cache)) {
                $cache[$field] = true;
            }
        }
    } catch (Throwable $e) {
        // 운영 DB 스키마가 달라도 기본값 false 로 안전하게 처리
    }

    return $cache;
}

function userControlColumnExists(string $column): bool {
    $cols = userControlColumns();
    return !empty($cols[$column]);
}

function userControlSelectExpr(string $tableAlias, string $column, string $fallbackSql = 'NULL', bool $coalesceZero = false): string {
    if (userControlColumnExists($column)) {
        $qualified = ($tableAlias !== '' ? ($tableAlias . '.') : '') . $column;
        if ($coalesceZero) {
            return "COALESCE({$qualified},0) AS {$column}";
        }
        return "{$qualified} AS {$column}";
    }
    return "{$fallbackSql} AS {$column}";
}

function userControlStoreReady(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        DB::execute("CREATE TABLE IF NOT EXISTS `app_settings` (
            `k` varchar(64) NOT NULL,
            `v` json NOT NULL,
            `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`k`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Throwable $e) {
        // ignore: app_settings may already exist or create privilege may be unavailable
    }
}

function userControlStoreKey(): string {
    return 'user_controls';
}

function normalizeUserControlState(array $row = []): array {
    return [
        'is_suspended' => !empty($row['is_suspended']),
        'suspended_reason' => trim((string)($row['suspended_reason'] ?? '')),
        'suspended_at' => $row['suspended_at'] ?? null,
        'suspended_by' => trim((string)($row['suspended_by'] ?? '')),
        'withdraw_suspended' => !empty($row['withdraw_suspended']),
        'withdraw_suspension_reason' => trim((string)($row['withdraw_suspension_reason'] ?? '')),
        'withdraw_suspended_at' => $row['withdraw_suspended_at'] ?? null,
        'withdraw_suspended_by' => trim((string)($row['withdraw_suspended_by'] ?? '')),
    ];
}

function userControlLoadMap(): array {
    global $__userControlMapCache;
    if (is_array($__userControlMapCache ?? null)) {
        return $__userControlMapCache;
    }
    userControlStoreReady();
    try {
        $map = getAppSettingJson(userControlStoreKey(), []);
        $__userControlMapCache = is_array($map) ? $map : [];
    } catch (Throwable $e) {
        $__userControlMapCache = [];
    }
    return $__userControlMapCache;
}

function resolveUserControlStatus(string $address, array $baseRow = []): array {
    $state = normalizeUserControlState($baseRow);
    $key = strtolower(trim($address));
    if ($key === '') return $state;

    $map = userControlLoadMap();
    if (isset($map[$key]) && is_array($map[$key])) {
        $override = normalizeUserControlState($map[$key]);
        foreach ($override as $k => $v) {
            $state[$k] = $v;
        }
    }
    return $state;
}

function userControlActionSupported(string $action): bool {
    // users 컬럼이 없어도 app_settings 기반 fallback 저장소로 동작할 수 있게 한다.
    return true;
}

function ensureUserControlActionSupported(string $action): void {
    // no-op: fallback 저장소를 통해 항상 동작하도록 허용
}

function getUserControlStatus(string $address): array {
    ensureUser($address);
    $select = [
        userControlSelectExpr('u', 'is_suspended', '0', true),
        userControlSelectExpr('u', 'suspended_reason', 'NULL'),
        userControlSelectExpr('u', 'suspended_at', 'NULL'),
        userControlSelectExpr('u', 'suspended_by', 'NULL'),
        userControlSelectExpr('u', 'withdraw_suspended', '0', true),
        userControlSelectExpr('u', 'withdraw_suspension_reason', 'NULL'),
        userControlSelectExpr('u', 'withdraw_suspended_at', 'NULL'),
        userControlSelectExpr('u', 'withdraw_suspended_by', 'NULL'),
    ];
    $row = DB::fetchOne(
        "SELECT " . implode(', ', $select) . "
           FROM users u
          WHERE u.address=? LIMIT 1",
        [$address]
    ) ?: [];

    return resolveUserControlStatus($address, $row);
}

function saveUserControlStatus(string $address, array $state): void {
    ensureUser($address);
    $next = normalizeUserControlState($state);

    $key = strtolower(trim($address));
    if ($key !== '') {
        $map = userControlLoadMap();
        $isClear = empty($next['is_suspended'])
            && empty($next['withdraw_suspended'])
            && $next['suspended_reason'] === ''
            && $next['withdraw_suspension_reason'] === '';
        if ($isClear) unset($map[$key]);
        else $map[$key] = $next;

        $GLOBALS['__userControlMapCache'] = $map;
        userControlStoreReady();
        $json = json_encode($map, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json !== false) {
            try {
                DB::execute(
                    "INSERT INTO app_settings(`k`,`v`) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)",
                    [userControlStoreKey(), $json]
                );
            } catch (Throwable $e) {
                // 운영 DB가 app_settings 없이 users 컬럼만 쓰는 경우를 위해 예외는 무시하고 아래 users UPDATE를 계속 진행
            }
        }
    }

    $sets = [];
    $params = [];
    $mappings = [
        'is_suspended' => $next['is_suspended'] ? 1 : 0,
        'suspended_reason' => ($next['suspended_reason'] !== '' ? $next['suspended_reason'] : null),
        'suspended_at' => $next['suspended_at'] ?: null,
        'suspended_by' => ($next['suspended_by'] !== '' ? $next['suspended_by'] : null),
        'withdraw_suspended' => $next['withdraw_suspended'] ? 1 : 0,
        'withdraw_suspension_reason' => ($next['withdraw_suspension_reason'] !== '' ? $next['withdraw_suspension_reason'] : null),
        'withdraw_suspended_at' => $next['withdraw_suspended_at'] ?: null,
        'withdraw_suspended_by' => ($next['withdraw_suspended_by'] !== '' ? $next['withdraw_suspended_by'] : null),
    ];

    foreach ($mappings as $column => $value) {
        if (!userControlColumnExists($column)) continue;
        $sets[] = "{$column}=?";
        $params[] = $value;
    }

    if ($sets) {
        $params[] = $address;
        DB::execute("UPDATE users SET " . implode(', ', $sets) . " WHERE address=?", $params);
    }
}

// (2026-05-18 v554) 운영자: '영어 페이지에서 한국어가 표기되는 문제'. 제재
//   메시지를 locale-aware 로 변환 + 구조화된 status 코드를 함께 응답해
//   프론트가 status 로 분기하거나 message 를 그대로 표시할 수 있게 한다.
//   추가 필드 (status / reason / suspended_since) 는 프론트가 popup UI 에서
//   사유를 시각화하는 데 사용.
function assertUserAccessAllowed(string $address): void {
    $st = getUserControlStatus($address);
    if (!empty($st['is_suspended'])) {
        $reason = (string)($st['suspended_reason'] ?? '');
        $msg = pickLocaleMsg([
            'en' => 'Your account is currently suspended.',
            'ko' => '사용이 중지된 계정입니다.',
        ]);
        if ($reason !== '') {
            $msg .= ' ' . pickLocaleMsg([
                'en' => 'Reason: ',
                'ko' => '사유: ',
            ]) . $reason;
        }
        jsonError(403, $msg, [
            'status' => 'account_suspended',
            'suspended_reason' => $reason,
            'suspended_at' => $st['suspended_at'] ?? null,
        ]);
    }
}

function assertUserWithdrawAllowed(string $address): void {
    assertUserAccessAllowed($address);
    $st = getUserControlStatus($address);
    if (!empty($st['withdraw_suspended'])) {
        $reason = (string)($st['withdraw_suspension_reason'] ?? '');
        $msg = pickLocaleMsg([
            'en' => 'Withdrawals are currently suspended on your account.',
            'ko' => '출금이 중지된 계정입니다.',
        ]);
        if ($reason !== '') {
            $msg .= ' ' . pickLocaleMsg([
                'en' => 'Reason: ',
                'ko' => '사유: ',
            ]) . $reason;
        }
        jsonError(403, $msg, [
            'status' => 'withdraw_suspended',
            'suspended_reason' => $reason,
            'suspended_at' => $st['withdraw_suspended_at'] ?? null,
        ]);
    }
}

function authRequired(): array {
    $user = parseAuthOptional();
    if (!$user || empty($user['address'])) {
        jsonError(401, pickLocaleMsg([
            'ko' => '로그인이 필요합니다.',
            'en' => 'Login is required.',
            'ja' => 'ログインが必要です。',
            'zh' => '需要登录。',
        ]));
    }
    ensureUser($user['address']);
    assertUserAccessAllowed($user['address']);
    return $user;
}

function authMfaRequired(): array {
    if (isOtpBypassed()) {
        return authRequired();
    }
    $user = authRequired();
    if ($user['via'] !== 'jwt') {
        jsonError(401, pickLocaleMsg([
            'ko' => 'OTP 인증이 필요합니다.',
            'en' => 'OTP authentication is required.',
            'ja' => 'OTP認証が必要です。',
            'zh' => '需要 OTP 验证。',
        ]));
    }
    if (!$user['mfa']) {
        jsonError(401, pickLocaleMsg([
            'ko' => 'OTP 인증이 필요합니다.',
            'en' => 'OTP authentication is required.',
            'ja' => 'OTP認証が必要です。',
            'zh' => '需要 OTP 验证。',
        ]));
    }
    return $user;
}

function adminAuth(): array {
    // (audit C1 fix · 2026-06-12) adminAuth() 단독 호출이 wallet whitelist 를 우회하던
    //   문제 해소. 기존 adminAuth() 는 JWT 만 검증했고 ADMIN_WALLET_ADDRESSES 화이트리스트
    //   (v583) 와 ADMIN_KEY (CLI 자동화) 둘 다 무시했음. 자금/설정/계약/wind-down 등 민감
    //   mutation 라우트가 약한 인증으로 노출되던 상태.
    //   해결: adminAuth() 정의를 adminOnly() wrapper 로 변경. 호출 측 코드 변경 불필요.
    //         단일 위치 수정으로 49개 호출지가 모두 자동 강화됨.
    //   반환값 호환: 호출지 모두 $admin['username'] 만 사용 → grep 으로 확인됨.
    //   ADMIN_WALLET_ADDRESSES 가 비어있으면 동작 변화 없음. 설정되어 있으면 X-Admin-Wallet
    //   헤더의 주소가 화이트리스트에 포함되어야 통과.
    //   예외: /api/admin/auth/me 같이 admin.core.js 가 X-Admin-Wallet 헤더를 일부러 미부착
    //         하는 auth route 는 명시적으로 adminJwtOnlyRead() 호출 필요 (admin_auth.php 참조).
    return adminOnly();
}

/**
 * (audit C1 fix · 2026-06-12) Legacy JWT-only admin auth.
 *   사용 요건: /api/admin/auth/me 처럼 admin.core.js 의 isAuthRoute 정규식에 포함되어
 *   X-Admin-Wallet 헤더가 부착되지 않는 read-only 토큰 검증 endpoint 에서만 사용.
 *   adminOnly() 의 화이트리스트 검증을 우회하므로 mutation 라우트에서는 절대 사용 금지.
 */
function adminJwtOnlyRead(): array {
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($hdr, 'Bearer ')) {
        jsonError(401, '관리자 로그인이 필요합니다.');
    }
    $token = substr($hdr, 7);
    $decoded = decodeJwt($token, ADMIN_JWT_SECRET);
    if (!$decoded || ($decoded['role'] ?? '') !== 'admin') {
        jsonError(401, '관리자 토큰이 유효하지 않습니다.');
    }
    return ['username' => $decoded['username'] ?? 'admin'];
}

// 정책: 관리자 데이터 수정 시 Phantom 지갑이 *연결되어 있어야* 한다.
// 다만 특정 주소로 제한하지는 않는다 — 연결된 어떤 지갑이든 사용 가능.
// (단순 로그인/조회는 지갑 없이 가능, 보기 전용)
//
// (2026-05-19 v583) 운영자 요청: '관리자 페이지는 계정 + 지정된 관리자 지갑
//   주소만 접근 가능, 다중 계정 허용.' .env 의 ADMIN_WALLET_ADDRESSES (쉼표
//   구분) 가 설정되면 JWT 인증 + 화이트리스트 검사 둘 다 통과해야 한다.
//   읽기/쓰기 모두 적용 — admin 페이지가 첫 API 호출부터 거절돼야 페이지가
//   비어 있게 됨 (사실상 페이지 잠금 효과). 빈 값이면 기존 동작 유지.

function adminWalletWhitelistConfigured(): bool {
    return defined('ADMIN_WALLET_ADDRESSES') && !empty(ADMIN_WALLET_ADDRESSES);
}

function adminWalletInWhitelist(string $address): bool {
    $address = trim($address);
    if ($address === '') return false;
    if (!adminWalletWhitelistConfigured()) return true; // whitelist 비활성 = 무제한
    foreach (ADMIN_WALLET_ADDRESSES as $allowed) {
        // Solana 주소는 대소문자 구분 (base58 유지) — strict 비교.
        if (hash_equals((string)$allowed, $address)) return true;
    }
    return false;
}

function adminOnly(): array {
    // 1. JWT 또는 X-Admin-Key 인증 검증
    $admin = null;
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($hdr, 'Bearer ')) {
        $token = substr($hdr, 7);
        $decoded = decodeJwt($token, ADMIN_JWT_SECRET);
        if ($decoded && ($decoded['role'] ?? '') === 'admin') {
            $admin = ['username' => $decoded['username'] ?? 'admin'];
        }
    }

    if (!$admin) {
        $k = $_SERVER['HTTP_X_ADMIN_KEY'] ?? '';
        if (ADMIN_KEY && $k === ADMIN_KEY) {
            $admin = ['username' => 'api_key'];
        }
    }

    if (!$admin) {
        jsonError(401, '관리자 로그인이 필요합니다.');
    }

    // (v583) 화이트리스트가 설정돼 있으면 모든 admin 호출 (읽기 포함) 에
    //   적용. X-Admin-Wallet 헤더의 주소가 ADMIN_WALLET_ADDRESSES 에
    //   포함돼야 통과. ADMIN_KEY 경로 (CLI / 자동화) 는 면제 — 사람이 아닌
    //   서버 간 호출이라 별도 보안 경계.
    if (adminWalletWhitelistConfigured() && ($admin['username'] ?? '') !== 'api_key') {
        $hdrWallet = trim((string)($_SERVER['HTTP_X_ADMIN_WALLET'] ?? ''));
        if ($hdrWallet === '') {
            jsonError(403, '관리자 지갑 연결이 필요합니다. (화이트리스트 활성)');
        }
        if (!isValidSolanaAddress($hdrWallet)) {
            jsonError(403, '관리자 지갑 주소 형식이 올바르지 않습니다.');
        }
        if (!adminWalletInWhitelist($hdrWallet)) {
            jsonError(403, '이 지갑 주소는 관리자 화이트리스트에 등록돼 있지 않습니다. .env 의 ADMIN_WALLET_ADDRESSES 를 확인하세요.');
        }
        $admin['wallet'] = $hdrWallet;
    }

    // 2. 쓰기 메서드(POST/PUT/PATCH/DELETE)는 Phantom 지갑 연결 필수
    //    (특정 주소 제한 없음 — 연결된 어떤 지갑이든 OK)
    //
    // (2026-05-11 v252) Operator: '문서 및 이미지를 업로드 하려면 계속
    //   지갑을 연결하라고 나타난다. 이것은 지갑 연결 필요하지 않다.'
    //   File upload + setting-style endpoints don't broadcast on-chain
    //   transactions, so requiring a connected wallet is busywork that
    //   blocks the operator's normal admin flow. The on-chain endpoints
    //   (token-withdrawals broadcast, mint changes, etc.) keep wallet
    //   verification — they need Phantom to sign anyway and explicitly
    //   re-check the wallet there.
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';

        // (2026-05-11 v254) Inverted policy — wallet check is now
        // opt-IN. Only the explicit on-chain broadcasting routes still
        // require a connected Phantom wallet (they need it to sign a
        // Solana tx anyway and re-verify there). Every other admin
        // write is just CRUD against the database and shouldn't make
        // the operator dance through Phantom.
        //
        // Previous opt-OUT design kept missing endpoints (e.g.
        // /api/admin/assets/:id/images, asset create/delete, accounting
        // adjustments) and forced another patch each time. The opt-in
        // list below is short and stable.
        // (2026-05-21 보안감사 Phase 1 fix #3) 감사관 (ChatGPT) 보고:
        //   'token-withdrawals/[^/]+/(send|broadcast|sign)' 와
        //   'withdrawals/[^/]+/(send|broadcast|sign)' (둘 다 PLURAL) 패턴이
        //   실제 라우트 '/api/admin/token-withdraw/send' 와
        //   '/api/admin/withdraw/send' (둘 다 SINGULAR + 직접 /send) 와
        //   매치되지 않아 'on-chain broadcast 는 Phantom wallet 필수' 가드가
        //   실질적으로 작동 안 함. 실제 라우트 패턴 추가.
        //   기존 plural 패턴은 dead 일 가능성 높지만 호환성 위해 보존 — 추후
        //   cleanup 으로 제거 검토.
        $requireWallet = (bool)preg_match(
            '#/api/admin/('
              // Phantom-signed on-chain broadcasts (legacy plural form — dead)
              . 'token-withdrawals/[^/]+/(send|broadcast|sign)'
              . '|withdrawals/[^/]+/(send|broadcast|sign)'
              // (v756) actual current routes — singular form, direct /send
              . '|token-withdraw/send$'
              . '|withdraw/send$'
              // mint address change (sets up a future on-chain destination)
              . '|silica/tokens$'
              // (2026-05-12 v309) Operator: '배당 실행은 관리자 지갑이
              //   연결 된 상태에서만 가능해야한다.' Dividend writes
              //   (create / update / cancel) move large USDT pools and
              //   trigger user-facing popups — require Phantom connection
              //   to align with the on-chain broadcast guard rails.
              . '|silica/dividend(/update|/cancel|/payout)?$'
              // any other route the operator opts into later
            . ')#',
            $uriPath
        );
        $skipWalletCheck = !$requireWallet;

        if (!$skipWalletCheck) {
            $headerWallet = trim($_SERVER['HTTP_X_ADMIN_WALLET'] ?? '');
            if ($headerWallet === '') {
                jsonError(403, 'Phantom 지갑 연결이 필요합니다.');
            }
            // 주소 형식만 검증 (특정 주소 매칭은 하지 않음)
            if (!isValidSolanaAddress($headerWallet)) {
                jsonError(403, '연결된 지갑 주소 형식이 올바르지 않습니다.');
            }
        }
    }

    return $admin;
}

// ====== User OTP Helpers ======
function getUserOtpRow(string $address): ?array {
    return DB::fetchOne(
        "SELECT otp_enabled, otp_secret, otp_temp_secret, otp_temp_created_at,
                otp_fail_count, otp_locked_until, otp_last_verified_at
         FROM users WHERE address=? LIMIT 1",
        [$address]
    );
}

function isOtpLocked(?array $row): bool {
    if (!$row || empty($row['otp_locked_until'])) return false;
    $t = new DateTimeImmutable($row['otp_locked_until'], new DateTimeZone('UTC'));
    return $t > new DateTimeImmutable('now', new DateTimeZone('UTC'));
}

function bumpOtpFail(string $address): array {
    $row = getUserOtpRow($address);
    $fails = ((int)($row['otp_fail_count'] ?? 0)) + 1;

    $lockedUntil = null;
    if ($fails >= 5) {
        $lockedUntil = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
            ->modify('+10 minutes')->format('Y-m-d H:i:s');
    }

    DB::execute(
        "UPDATE users SET otp_fail_count=?, otp_locked_until=? WHERE address=?",
        [$fails, $lockedUntil, $address]
    );

    return ['fails' => $fails, 'lockedUntil' => $lockedUntil];
}

function verifyAdminOtpOrThrow(string $otpInput): void {
    if (isOtpBypassed()) return;

    $otp = substr(preg_replace('/\D/', '', trim($otpInput)), 0, 6);
    if (!preg_match('/^\d{6}$/', $otp)) {
        throw new RuntimeException('OTP 6자리가 필요합니다.');
    }

    $secret = trim(env('OTP_SECRET_KEY', ''));
    if (!$secret) {
        throw new RuntimeException('서버 OTP_SECRET_KEY 설정이 없습니다.');
    }

    $totp = TOTP::createFromSecret($secret);
    $totp->setDigits(6);
    $totp->setPeriod(30);

    if (!$totp->verify($otp, null, 2)) {
        throw new RuntimeException('OTP가 올바르지 않습니다.');
    }
}

function verifyUserTxnOtpOrThrow(string $address, string $otpInput): void {
    if (isOtpBypassed()) return;

    $otp = substr(preg_replace('/\D/', '', trim($otpInput)), 0, 6);
    if (!preg_match('/^\d{6}$/', $otp)) {
        throw new RuntimeException('OTP 6자리를 입력하세요.');
    }

    $row = getUserOtpRow($address);
    $enabled = !empty($row['otp_enabled']) && !empty($row['otp_secret']);
    if (!$enabled) {
        throw new RuntimeException('OTP가 등록되어 있지 않습니다.');
    }

    if (isOtpLocked($row)) {
        throw new RuntimeException('OTP가 잠겨 있습니다. 잠시 후 다시 시도하세요.');
    }

    $totp = TOTP::createFromSecret(trim($row['otp_secret']));
    $totp->setDigits(6);
    $totp->setPeriod(30);

    if (!$totp->verify($otp, null, 1)) {
        bumpOtpFail($address);
        throw new RuntimeException('OTP가 올바르지 않습니다.');
    }

    DB::execute(
        "UPDATE users SET otp_last_verified_at=?, otp_fail_count=0, otp_locked_until=NULL WHERE address=?",
        [nowUtcSql(), $address]
    );
}

// ====== Check if admin request (for mixed endpoints) ======
function isAdminRequest(): bool {
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($hdr, 'Bearer ')) return false;
    $decoded = decodeJwt(substr($hdr, 7), ADMIN_JWT_SECRET);
    return $decoded && ($decoded['role'] ?? '') === 'admin';
}
