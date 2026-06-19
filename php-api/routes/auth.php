<?php
/**
 * Auth routes: nonce, login, me
 */

post('/api/auth/nonce', function () {
    $body = getJsonBody();
    $address = trim($body['address'] ?? '');
    if (!$address) jsonError(400, 'address가 필요합니다.');

    $nonce = base_convert(random_int(0, PHP_INT_MAX), 10, 36) . '-' . base_convert(time(), 10, 36);
    $exp = (new DateTimeImmutable('+10 minutes', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

    DB::execute(
        "INSERT INTO auth_nonces(address, nonce, expires_at) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE nonce=VALUES(nonce), expires_at=VALUES(expires_at)",
        [$address, $nonce, $exp]
    );

    $message = "Recon RWA Login\naddress={$address}\nnonce={$nonce}\nexpires=10min";
    jsonOk(['message' => $message, 'expiresAt' => $exp]);
});

post('/api/auth/login', function () {
    $body = getJsonBody();
    $address = trim($body['address'] ?? '');
    $signatureBase64 = trim($body['signatureBase64'] ?? '');
    if (!$address || !$signatureBase64) jsonError(400, 'address/signatureBase64가 필요합니다.');

    $row = DB::fetchOne("SELECT nonce, expires_at FROM auth_nonces WHERE address=?", [$address]);
    if (!$row) jsonError(400, 'nonce가 없습니다. 다시 시도하세요.');

    $expiresAt = new DateTimeImmutable($row['expires_at'], new DateTimeZone('UTC'));
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    if ($expiresAt < $now) jsonError(400, 'nonce가 만료되었습니다.');

    $message = "Recon RWA Login\naddress={$address}\nnonce={$row['nonce']}\nexpires=10min";

    $ok = verifySolanaMessageSignature($address, $message, $signatureBase64);
    if (!$ok) jsonError(401, '서명 검증 실패');

    // (audit H6 fix · 2026-06-12) nonce 1회용 소비 — 서명 검증 통과 즉시 삭제.
    //   기존: 성공한 로그인 후에도 nonce 행이 TTL(10분) 까지 남아 있어, 캡처된
    //   서명 payload 를 재전송하면 같은 지갑의 JWT 를 추가 발급 가능 (replay).
    //   변경: 검증 직후 DELETE → 두 번째 재전송은 'nonce가 없습니다' 400.
    //   WHERE 에 nonce 값까지 포함 — 다른 탭이 사이에 새 nonce 를 발급했어도
    //   그 새 nonce 를 잘못 지우지 않음.
    //   프론트 영향 없음: core.js 두 로그인 경로 모두 nonce→서명→login 1회 호출,
    //   서명 재사용/자동 재시도 루프 없음 (2026-06-12 전수 확인).
    DB::execute(
        "DELETE FROM auth_nonces WHERE address=? AND nonce=?",
        [$address, $row['nonce']]
    );

    ensureUser($address);

    // (2026-05-18 v556) H3 fix — 사용중지 주소는 login 자체 차단. 기존엔
    //   서명 검증까지 통과해 JWT 가 발급되었고, 사용자는 '로그인 됐다' 고
    //   오해한 채 모든 액션에서 403 받음. 명확한 메시지를 login 시점에
    //   바로 표시해 혼란 제거. assertUserAccessAllowed 가 i18n-aware 메시지
    //   + status='account_suspended' + suspended_reason / suspended_at 을
    //   포함한 403 응답을 자동 emit.
    assertUserAccessAllowed($address);

    $token = makeJwt($address);

    jsonOk(['token' => $token]);
});

get('/api/me', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureUser($address);

    $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$address]);
    $fundingCount = (int)DB::fetchValue("SELECT COUNT(*) FROM funding_records WHERE address=?", [$address]);
    $fundingRequestCount = countUserFundingRequests($address);

    // Get referrer from validated referral_links only
    $myReferrer = null;
    try {
        $refLink = getValidReferralLinkForInvestor($address);
        $myReferrer = $refLink['referrer_code'] ?? null;
    } catch (Throwable $e) {}

    // Get my referrer code if I'm an approved referrer
    $myRefCode = null;
    try {
        $myCodeRow = DB::fetchOne("SELECT code FROM referrer_codes WHERE address=? AND is_active=1", [$address]);
        $myRefCode = $myCodeRow['code'] ?? null;
    } catch (Throwable $e) {}

    // (2026-05-16 v429) 추천인 정책 — '투자 서명을 투자자가 하면 추천인 고정
    //   (관리자 서명 안 했어도)'. user_signed/awaiting_admin/completed 모두 포함.
    $hasSignedFunding = function_exists('hasUserSignedFunding')
        ? hasUserSignedFunding($address)
        : ($fundingRequestCount > 0);

    jsonOk([
        'address'             => $address,
        'usdt'                => (float)($bal['usdt'] ?? 0),
        'fundingCount'        => $fundingCount,
        'fundingRequestCount' => $fundingRequestCount,
        'hasAnyFunding'       => $fundingRequestCount > 0,
        // (2026-05-16 v426) 추천인 정책 전용 필드 — funding_records (admin-sign 후)
        //   기준. v429 에서 hasSignedFunding 으로 정책 키 교체 (한 단계 더 빠른 시점).
        'hasConfirmedFunding' => $fundingCount > 0,
        // (2026-05-16 v429) 추천인 정책 키 — '사용자가 contract 에 서명한 시점'
        //   부터 추천인 고정. user_signed/awaiting_admin/completed 모두 포함.
        'hasSignedFunding'    => $hasSignedFunding,
        'myRefCode'           => $myRefCode,
        'myReferrer'          => $myReferrer,
    ]);
});
