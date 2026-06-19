<?php
/**
 * User profile routes — email registration & verification
 *
 * - GET    /api/user/profile            : 내 프로필 (지갑 주소, 이메일, 인증 상태)
 * - POST   /api/user/email/register     : 이메일 등록/변경 → 인증 메일 발송
 * - POST   /api/user/email/resend       : 인증 메일 재발송
 * - GET    /api/user/email/verify       : 인증 링크 클릭 처리 (query: token)
 * - POST   /api/user/email              : 이메일 삭제 (DELETE 대체, method=delete)
 */

if (!function_exists('userEmailVerifyBaseUrl')) {
    function userEmailVerifyBaseUrl(): string {
        $b = MAIL_VERIFY_BASE_URL;
        if ($b !== '') return $b;
        // fallback: HTTP_HOST 기반 동적 구성
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        return $scheme . '://' . $host;
    }
}

if (!function_exists('ensureUserEmailSchema')) {
    /**
     * users 테이블에 email 관련 컬럼이 있는지 확인하고, 없으면 자동 마이그레이션 실행.
     * (관리자 로그인 lazy 트리거 없이도 유저가 마이페이지에 접근 가능하도록)
     */
    function ensureUserEmailSchema(): bool {
        static $ok = null;
        if ($ok !== null) return $ok;
        try {
            $row = DB::fetchOne("SHOW COLUMNS FROM users LIKE 'email'");
            if ($row) { $ok = true; return true; }
        } catch (Throwable $e) {
            error_log('[user_profile] schema check error: ' . $e->getMessage());
        }
        // 컬럼 없음 → 동기 마이그레이션 실행
        try {
            if (function_exists('applyPendingMigrations')) {
                applyPendingMigrations(false);
            }
            $row = DB::fetchOne("SHOW COLUMNS FROM users LIKE 'email'");
            $ok = !empty($row);
            return $ok;
        } catch (Throwable $e) {
            error_log('[user_profile] auto-migration failed: ' . $e->getMessage());
            $ok = false;
            return false;
        }
    }
}

if (!function_exists('userEmailRateLimitCheck')) {
    function userEmailRateLimitCheck(string $address): void {
        // 최근 60초 내에 재발송 시도 차단
        $row = DB::fetchOne(
            "SELECT email_verify_sent_at FROM users WHERE address=?",
            [$address]
        );
        if (!empty($row['email_verify_sent_at'])) {
            $last = strtotime($row['email_verify_sent_at']);
            if ($last && (time() - $last) < 60) {
                jsonError(429, '인증 메일은 60초에 한 번만 발송할 수 있습니다. 잠시 후 다시 시도하세요.');
            }
        }
    }
}

// (2026-05-18 v554) 운영자: '출금 중지 유저가 해당 페이지 접속 시 팝업을
//   띄워서 안내해줘'. 페이지 로드 시 프론트가 호출해 사용자 제재 상태를
//   확인하는 가벼운 endpoint. authRequired() 통과 시점에 응답하므로
//   account_suspended 인 경우엔 이 endpoint 자체가 403 으로 응답하고,
//   withdraw_suspended 인 경우만 200 + 플래그로 답한다.
get('/api/user/withdraw/status', function () {
    $user = authRequired();
    $address = $user['address'];
    $st = getUserControlStatus($address);
    jsonOk([
        'address'                     => $address,
        'withdraw_suspended'          => !empty($st['withdraw_suspended']),
        'withdraw_suspension_reason'  => (string)($st['withdraw_suspension_reason'] ?? ''),
        'withdraw_suspended_at'       => $st['withdraw_suspended_at'] ?? null,
    ]);
});

// (2026-05-18 v556) H2 — 사용중지 상태 전용 endpoint. authRequired() 가 이미
//   사용중지된 주소를 403 으로 차단하므로, 이 endpoint 가 200 으로 응답한다는
//   것 자체가 '해당 사용자는 정상 활동 가능' 이라는 의미. 즉 사용중지된
//   사용자는 endpoint 호출 자체가 403 + status='account_suspended' 응답을
//   받고, 프론트의 core.js api() wrapper 가 이를 캐치해 모달 표시.
//
//   따라서 이 endpoint 의 실용성: 페이지 로드 시 미리 호출해 두면
//   사용중지된 사용자는 즉시 403 → 모달 → portfolio 우회. 정상 사용자는
//   200 응답 받고 무시.
get('/api/user/account/status', function () {
    $user = authRequired();
    $st = getUserControlStatus($user['address']);
    jsonOk([
        'address'                  => $user['address'],
        'is_suspended'             => !empty($st['is_suspended']),
        'withdraw_suspended'       => !empty($st['withdraw_suspended']),
        // 위 두 플래그는 이 endpoint 가 200 으로 응답하므로 항상 false 여야 하지만,
        //   race condition 대비로 함께 반환.
    ]);
});

get('/api/user/profile', function () {
    $user = authRequired();
    $address = $user['address'];
    if (!ensureUserEmailSchema()) {
        // 스키마 마이그레이션이 실패한 경우에도 지갑 주소만 반환 (비치명적 폴백)
        jsonOk([
            'address' => $address,
            'email' => null, 'email_verified' => false,
            'email_verified_at' => null, 'email_verify_pending' => false,
            'email_verify_sent_at' => null,
        ]);
        return;
    }
    $row = DB::fetchOne(
        "SELECT email, email_verified_at, email_verify_expires_at, email_verify_sent_at
         FROM users WHERE address=?",
        [$address]
    ) ?: [];

    jsonOk([
        'address'               => $address,
        'email'                 => $row['email'] ?? null,
        'email_verified'        => !empty($row['email_verified_at']),
        'email_verified_at'     => $row['email_verified_at'] ?? null,
        'email_verify_pending'  => !empty($row['email']) && empty($row['email_verified_at']),
        'email_verify_sent_at'  => $row['email_verify_sent_at'] ?? null,
    ]);
});

post('/api/user/email/register', function () {
    $user = authRequired();
    $address = $user['address'];

    if (!ensureUserEmailSchema()) {
        jsonError(503, '이메일 기능이 초기화 중입니다. 잠시 후 다시 시도하세요.');
    }

    $body = getJsonBody();
    $email = strtolower(trim($body['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError(400, '올바른 이메일 형식이 아닙니다.');
    }
    if (strlen($email) > 255) {
        jsonError(400, '이메일이 너무 깁니다.');
    }

    // 다른 사용자가 이미 인증된 이메일이면 거부
    $dup = DB::fetchOne(
        "SELECT address FROM users
         WHERE email=? AND email_verified_at IS NOT NULL AND address<>?",
        [$email, $address]
    );
    if ($dup) {
        jsonError(409, '이미 사용 중인 이메일입니다.');
    }

    userEmailRateLimitCheck($address);

    $token = bin2hex(random_bytes(32));
    $expires = (new DateTimeImmutable('+24 hours', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
    $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

    DB::execute(
        "UPDATE users
         SET email = ?,
             email_verified_at = NULL,
             email_verify_token = ?,
             email_verify_expires_at = ?,
             email_verify_sent_at = ?,
             email_verify_attempts = 0
         WHERE address = ?",
        [$email, $token, $expires, $now, $address]
    );

    $lang = strtolower(substr(trim($body['lang'] ?? 'ko'), 0, 2)) === 'en' ? 'en' : 'ko';
    $verifyUrl = userEmailVerifyBaseUrl() . '/api/user/email/verify?token=' . urlencode($token);

    $subject = $lang === 'en' ? 'RECON RWA — Verify your email' : 'RECON RWA — 이메일 인증 안내';
    $html = buildEmailVerifyHtml($verifyUrl, $lang);

    $ok = sendMail($email, $subject, $html);
    if (!$ok) {
        jsonError(502, '메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.');
    }

    jsonOk([
        'email'           => $email,
        'verify_sent_at'  => $now,
        'expires_at'      => $expires,
        'message'         => '인증 메일이 발송되었습니다. 메일함을 확인하세요.',
    ]);
});

post('/api/user/email/resend', function () {
    $user = authRequired();
    $address = $user['address'];

    if (!ensureUserEmailSchema()) {
        jsonError(503, '이메일 기능이 초기화 중입니다. 잠시 후 다시 시도하세요.');
    }

    $row = DB::fetchOne(
        "SELECT email, email_verified_at FROM users WHERE address=?",
        [$address]
    );
    if (!$row || empty($row['email'])) {
        jsonError(400, '등록된 이메일이 없습니다.');
    }
    if (!empty($row['email_verified_at'])) {
        jsonError(400, '이미 인증된 이메일입니다.');
    }

    userEmailRateLimitCheck($address);

    $token = bin2hex(random_bytes(32));
    $expires = (new DateTimeImmutable('+24 hours', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
    $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

    DB::execute(
        "UPDATE users
         SET email_verify_token = ?, email_verify_expires_at = ?, email_verify_sent_at = ?
         WHERE address = ?",
        [$token, $expires, $now, $address]
    );

    $body = getJsonBody();
    $lang = strtolower(substr(trim($body['lang'] ?? 'ko'), 0, 2)) === 'en' ? 'en' : 'ko';
    $verifyUrl = userEmailVerifyBaseUrl() . '/api/user/email/verify?token=' . urlencode($token);

    $subject = $lang === 'en' ? 'RECON RWA — Verify your email' : 'RECON RWA — 이메일 인증 안내';
    $html = buildEmailVerifyHtml($verifyUrl, $lang);

    $ok = sendMail($row['email'], $subject, $html);
    if (!$ok) {
        jsonError(502, '메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.');
    }

    jsonOk([
        'email'          => $row['email'],
        'verify_sent_at' => $now,
        'expires_at'     => $expires,
        'message'        => '인증 메일이 재발송되었습니다.',
    ]);
});

get('/api/user/email/verify', function () {
    if (!ensureUserEmailSchema()) {
        http_response_code(503);
        header('Content-Type: text/html; charset=utf-8');
        echo userEmailVerifyResultHtml(false, '이메일 기능이 초기화 중입니다. 잠시 후 다시 시도하세요.');
        exit;
    }
    $token = trim($_GET['token'] ?? '');
    if ($token === '' || !preg_match('/^[a-f0-9]{64}$/', $token)) {
        // 사용자가 브라우저로 링크를 클릭하는 경로 → HTML 응답
        http_response_code(400);
        header('Content-Type: text/html; charset=utf-8');
        echo userEmailVerifyResultHtml(false, '유효하지 않은 인증 링크입니다.');
        exit;
    }

    $row = DB::fetchOne(
        "SELECT address, email, email_verified_at, email_verify_expires_at
         FROM users WHERE email_verify_token=?",
        [$token]
    );

    if (!$row) {
        http_response_code(400);
        header('Content-Type: text/html; charset=utf-8');
        echo userEmailVerifyResultHtml(false, '인증 링크가 유효하지 않거나 이미 사용되었습니다.');
        exit;
    }

    if (!empty($row['email_verified_at'])) {
        header('Content-Type: text/html; charset=utf-8');
        echo userEmailVerifyResultHtml(true, '이미 인증된 이메일입니다.');
        exit;
    }

    $expires = strtotime($row['email_verify_expires_at'] ?? '') ?: 0;
    if (!$expires || $expires < time()) {
        http_response_code(400);
        header('Content-Type: text/html; charset=utf-8');
        echo userEmailVerifyResultHtml(false, '인증 링크가 만료되었습니다. 새로 등록해주세요.');
        exit;
    }

    $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
    DB::execute(
        "UPDATE users
         SET email_verified_at = ?, email_verify_token = NULL, email_verify_expires_at = NULL
         WHERE address = ?",
        [$now, $row['address']]
    );

    header('Content-Type: text/html; charset=utf-8');
    echo userEmailVerifyResultHtml(true, '이메일이 성공적으로 인증되었습니다.');
    exit;
});

post('/api/user/email/delete', function () {
    $user = authRequired();
    $address = $user['address'];

    if (!ensureUserEmailSchema()) {
        jsonOk(['message' => '이메일이 삭제되었습니다.']);
        return;
    }

    DB::execute(
        "UPDATE users
         SET email = NULL,
             email_verified_at = NULL,
             email_verify_token = NULL,
             email_verify_expires_at = NULL,
             email_verify_sent_at = NULL,
             email_verify_attempts = 0
         WHERE address = ?",
        [$address]
    );

    jsonOk(['message' => '이메일이 삭제되었습니다.']);
});

if (!function_exists('userEmailVerifyResultHtml')) {
    function userEmailVerifyResultHtml(bool $ok, string $message): string {
        $color = $ok ? '#22c55e' : '#ef4444';
        $icon  = $ok ? '&#10003;' : '&#10007;';
        $safe  = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        return '<!DOCTYPE html>'
             . '<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
             . '<title>RECON RWA — 이메일 인증</title></head>'
             . '<body style="font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:48px 16px;color:#0f172a">'
             . '<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;text-align:center;box-shadow:0 4px 12px rgba(15,23,42,.06)">'
             . '<div style="font-size:56px;color:' . $color . ';line-height:1;margin-bottom:16px">' . $icon . '</div>'
             . '<h2 style="margin:0 0 12px;color:#0f172a">RECON RWA</h2>'
             . '<p style="margin:0 0 24px;line-height:1.6;color:#334155">' . $safe . '</p>'
             . '<a href="/" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 28px;border-radius:8px;font-weight:600">홈으로 이동</a>'
             . '</div>'
             . '</body></html>';
    }
}
