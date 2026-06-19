<?php
/**
 * Public API routes: health, config, blockhash
 */

get('/api/health', function () {
    jsonOk();
});

get('/api/public/config', function () {
    $fxRates = getFxTable();
    $depositAddr = getSetting('deposit_admin_usdt_address', '') ?? '';

    // Lazy Trigger — Lock 기간 내 첫 공개 config 호출 시 자동 이자 배정 발사
    // (응답은 먼저 전송되고 배정은 백그라운드에서 처리되어 사용자 지연 없음)
    if (function_exists('lazyTryMonthlyInterestAccrual')) {
        register_shutdown_function('lazyTryMonthlyInterestAccrual');
    }

    jsonOk([
        'fx_krw_per_usdt'       => $fxRates['KRW'] ?? 0,
        'fx_rates'              => $fxRates,
        'supported_countries'   => COUNTRIES,
        'supported_currencies'  => CURRENCIES,
        'settlement_lock_days'  => STAKING_LOCK_DAYS,
        'interest_pay_day'      => STAKING_PAYDAY,
        'tz'                    => TZ,
        'deposit_admin_usdt_address' => (string)$depositAddr,
        'bypass_otp'            => isOtpBypassed(),
        'bypass_kyc'            => isKycBypassed(),
        'solana_network'        => getConfiguredSolanaNetwork(),
        'usdt_mint'             => getEffectiveUsdtMint(),
        'usdt_decimals'         => (int)(getSetting('solana_usdt_decimals', '6') ?? '6'),
        // (2026-05-07) SilicaSTO / Silica reward token mint addresses for multi-token deposit.
        // Frontend reads these to populate the deposit page token selector. Empty string when
        // not yet configured by admin (deposit page will hide the option in that case).
        'silica_sto_mint'       => function_exists('silicaGetStoMint') ? silicaGetStoMint() : '',
        'silica_token_mint'     => function_exists('silicaGetTokenMint') ? silicaGetTokenMint() : '',
        // (2026-05-08) Silica reward token price (USDT per Silica). Frontend
        // (silica-data-bind.js) reads this for portfolio display, claim total,
        // dividend conversion, etc. Without this field exposed in /api/public/
        // config, the frontend was falling through to a hardcoded 0.05 fallback.
        'silica_price_usdt'     => function_exists('silicaGetCurrentPrice') ? silicaGetCurrentPrice() : 0,
        // (2026-05-07) Global SilicaSTO sale supply cap. Frontend (assets.html
        // banner + funding.js gating) reads these to know whether to show the
        // "sale suspended" banner and disable the Participate button.
        'silica_max_sto_supply' => function_exists('silicaGetMaxStoSupply') ? silicaGetMaxStoSupply() : 0,
        'silica_sold_sto_total' => function_exists('silicaGetSoldStoTotal') ? silicaGetSoldStoTotal() : 0,
        'silica_sale_open'      => function_exists('silicaIsSaleOpen') ? silicaIsSaleOpen() : true,
        // (2026-05-16 v428) 현재 회차 요율 (interest_rate_history 기준) — 사용자
        //   페이지 의 'CURRENT FIXED RATE' / 'Monthly Interest' 표시에 사용.
        //   기존 silica-data-bind.js 는 assets.apr 컬럼 (정적값) 을 읽어 admin
        //   staking 설정과 불일치 문제. silicaCalcThisCyclePayoutDate 가 결정
        //   하는 '이번 회차' 의 effective rate 를 노출.
        'silica_apr_pct'        => (function () {
            if (!function_exists('silicaCalcThisCyclePayoutDate')) return null;
            try {
                $thisCycle = silicaCalcThisCyclePayoutDate();
                $row = DB::fetchOne(
                    "SELECT rate_bps FROM interest_rate_history
                      WHERE effective_from_payout <= ?
                      ORDER BY effective_from_payout DESC LIMIT 1",
                    [$thisCycle]
                );
                return $row ? round((int)$row['rate_bps'] / 100, 2) : null;
            } catch (Throwable $e) {
                return null;
            }
        })(),
        'silica_next_apr_pct'   => (function () {
            if (!function_exists('silicaCalcNextCyclePayoutDate')) return null;
            try {
                $nextCycle = silicaCalcNextCyclePayoutDate();
                $row = DB::fetchOne(
                    "SELECT rate_bps FROM interest_rate_history
                      WHERE effective_from_payout <= ?
                      ORDER BY effective_from_payout DESC LIMIT 1",
                    [$nextCycle]
                );
                return $row ? round((int)$row['rate_bps'] / 100, 2) : null;
            } catch (Throwable $e) {
                return null;
            }
        })(),
        'silica_apr_cycle_payout' => function_exists('silicaCalcThisCyclePayoutDate')
            ? silicaCalcThisCyclePayoutDate() : null,
        // (2026-05-16 v423) 운영자 안내 문구 — assets.html 의 '◆ Total Sale
        //   Supply' 상단에 노출. 빈 문자열이면 미표시. 사용자 언어에 따라
        //   silica-data-bind.js 가 KO/EN 분기.
        'silica_sale_notice_ko' => function_exists('silicaGetSaleNotice') ? silicaGetSaleNotice('ko') : '',
        'silica_sale_notice_en' => function_exists('silicaGetSaleNotice') ? silicaGetSaleNotice('en') : '',
        'withdraw_fee_mode'     => getWithdrawFeeMode(),
        'withdraw_fee_usdt'     => getWithdrawFeeFixedUsdt(),
        'withdraw_fee_percent'  => getWithdrawFeePercent(),
        // (2026-05-11) Admin-uploadable token logos. Empty string means
        // the frontend should fall back to the bundled default SVG.
        //   usdt      → /user/assets/images/token-usdt.svg
        //   silicasto → /user/assets/images/token-silicasto.svg
        //   silica    → /user/assets/images/token-silica.svg
        'silica_logo_urls'      => function_exists('silicaGetTokenLogos') ? silicaGetTokenLogos() : [
            'usdt' => '', 'silicasto' => '', 'silica' => '',
        ],
    ]);
});

get('/api/public/solana/blockhash', function () {
    try {
        $bh = getRecentBlockhash();
        jsonOk($bh);
    } catch (Throwable $e) {
        jsonError(502, $e->getMessage());
    }
});

/**
 * (2026-06-07 v867) Solana RPC proxy — frontend Connection 가 호출하는 RPC
 * 요청을 backend 가 effective Helius URL 로 forward.
 *
 * 배경:
 *   - 브라우저가 직접 https://api.mainnet-beta.solana.com 을 호출하면 Solana
 *     공식 public RPC 가 abuse 방지로 403 반환.
 *   - Helius URL 은 API key 가 포함되어 있어 frontend 에 노출 불가 (v864 정책).
 *   - 따라서 backend 가 proxy 역할 — frontend → /api/public/solana/rpc →
 *     Helius mainnet/devnet (silica.env 의 키 사용).
 *
 * 보안:
 *   - method whitelist — 비정상 RPC 호출 차단 (예: getProgramAccounts 같은
 *     heavy method 는 거부 가능; 필요 시 추가).
 *   - 응답 형식은 표준 JSON-RPC envelope — @solana/web3.js 의 Connection
 *     클래스가 그대로 파싱 가능.
 *
 * 예상 호출 흐름:
 *   1. deposit.html max 버튼 클릭 → deposit.js getWalletTokenBalance()
 *   2. solanaWeb3.Connection.getParsedTokenAccountsByOwner() →
 *      POST /api/public/solana/rpc { method: 'getParsedTokenAccountsByOwner', params: [...] }
 *   3. backend → Helius (via getEffectiveRpcUrl())
 *   4. Helius 응답 → backend → frontend
 */
post('/api/public/solana/rpc', function () {
    $body = getJsonBody();
    $method = (string)($body['method'] ?? '');
    $params = $body['params'] ?? [];
    $id     = $body['id'] ?? 1;

    if (!is_array($params)) $params = [];

    // 화이트리스트 — read 메서드 + sendTransaction (wallet 서명된 raw tx).
    //   필요 시 추가: getProgramAccounts, getStakeActivation 등은 무거워서
    //   기본 제외. deposit/withdraw/staking 표준 흐름은 모두 아래 목록으로 가능.
    static $ALLOWED_METHODS = [
        // read — account/balance
        'getBalance',
        'getAccountInfo',
        'getParsedAccountInfo',
        'getMultipleAccounts',
        'getTokenAccountBalance',
        'getParsedTokenAccountsByOwner',
        'getTokenAccountsByOwner',
        'getTokenSupply',
        // read — transaction / blockhash
        'getLatestBlockhash',
        'getRecentBlockhash',          // legacy
        'getMinimumBalanceForRentExemption',
        'getSignatureStatuses',
        'getTransaction',
        'getSignaturesForAddress',
        'simulateTransaction',
        // write — broadcast (wallet 서명된 raw tx)
        'sendTransaction',
        // diagnostics
        'getHealth',
        'getSlot',
        'getEpochInfo',
        'getVersion',
        'getBlockHeight',
    ];

    if ($method === '' || !in_array($method, $ALLOWED_METHODS, true)) {
        // JSON-RPC error envelope — Connection 객체가 파싱 가능한 형식.
        header('Content-Type: application/json');
        http_response_code(400);
        echo json_encode([
            'jsonrpc' => '2.0',
            'error'   => ['code' => -32601, 'message' => 'RPC method not allowed: ' . $method],
            'id'      => $id,
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }

    try {
        $rpcUrl = getEffectiveRpcUrl();
        $result = solanaRpcSingle($rpcUrl, $method, $params);
        header('Content-Type: application/json');
        echo json_encode([
            'jsonrpc' => '2.0',
            'result'  => $result,
            'id'      => $id,
        ], JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Throwable $e) {
        // 표준 JSON-RPC error — frontend Connection 이 catch 가능.
        header('Content-Type: application/json');
        http_response_code(502);
        echo json_encode([
            'jsonrpc' => '2.0',
            'error'   => ['code' => -32603, 'message' => 'RPC forward failed: ' . $e->getMessage()],
            'id'      => $id,
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }
});

/**
 * (2026-06-07 v867) Client GeoIP — VPN 사용 의심 여부 판단.
 *
 * 정확한 자동 감지는 어렵지만 다음 heuristic 으로 합리적 판단:
 *   1. 클라이언트 IP → country (Cloudflare CF-IPCountry 헤더 우선, 없으면
 *      간단한 PHP 추정).
 *   2. 브라우저 timezone (frontend 가 query param 또는 별도 호출로 전달).
 *   3. country 와 typical timezone 이 mismatch 면 VPN 가능성 표시.
 *
 * Frontend 흐름:
 *   const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;  // e.g. "Asia/Seoul"
 *   fetch(`/api/public/geo?tz=${tz}`).then(r => r.json())
 *     → if (data.is_likely_vpn) show VPN notice
 *
 * Hostinger 가 Cloudflare 헤더를 전달하지 않으면 country 가 null —
 * frontend 는 안전하게 "감지 불가" 로 처리하고 카드 hide.
 */
get('/api/public/geo', function () {
    $clientIp = (string)($_SERVER['HTTP_CF_CONNECTING_IP']
        ?? $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['REMOTE_ADDR']
        ?? '');
    // X-Forwarded-For 가 comma-separated 일 수 있음
    if (strpos($clientIp, ',') !== false) $clientIp = trim(strtok($clientIp, ','));

    // country code 후보
    $country = (string)($_SERVER['HTTP_CF_IPCOUNTRY'] ?? '');
    if ($country === '' || $country === 'XX') {
        // Cloudflare 헤더 없음 — country 추정 불가. frontend 가 안전하게 hide.
        $country = '';
    }

    $browserTz = isset($_GET['tz']) ? trim((string)$_GET['tz']) : '';

    // country → typical timezone prefix 매핑 (대표적인 것만; 누락 시 false-positive 회피)
    $expectedTzPrefix = [
        'KR' => ['Asia/Seoul'],
        'JP' => ['Asia/Tokyo'],
        'CN' => ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Urumqi'],
        'TW' => ['Asia/Taipei'],
        'HK' => ['Asia/Hong_Kong'],
        'SG' => ['Asia/Singapore'],
        'TH' => ['Asia/Bangkok'],
        'VN' => ['Asia/Ho_Chi_Minh'],
        'PH' => ['Asia/Manila'],
        'IN' => ['Asia/Kolkata', 'Asia/Calcutta'],
        'ID' => ['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura'],
        'MY' => ['Asia/Kuala_Lumpur', 'Asia/Kuching'],
        'US' => ['America/'],
        'CA' => ['America/'],
        'GB' => ['Europe/London'],
        'DE' => ['Europe/Berlin'],
        'FR' => ['Europe/Paris'],
        'RU' => ['Europe/Moscow', 'Asia/'],
        'AU' => ['Australia/'],
        'NZ' => ['Pacific/Auckland'],
    ];

    $isLikelyVpn = false;
    if ($country !== '' && $browserTz !== '' && isset($expectedTzPrefix[$country])) {
        $matched = false;
        foreach ($expectedTzPrefix[$country] as $prefix) {
            if (strpos($browserTz, $prefix) === 0) { $matched = true; break; }
        }
        $isLikelyVpn = !$matched;
    }

    jsonOk([
        'country'        => $country ?: null,
        'browser_tz'     => $browserTz ?: null,
        'is_likely_vpn'  => $isLikelyVpn,
        'detection_available' => $country !== '' && $browserTz !== '',
    ]);
});

// (2026-05-26 v841) /api/file/:name — UPLOAD_DIR 의 파일을 안전하게 serve.
//   Hostinger Git 자동 배포가 /public_html/rwa/uploads/ 를 매 deploy 마다 wipe
//   하는 문제 해결. silica.env 에서 UPLOAD_DIR 을 배포 zone 밖 (예: /home/USER/
//   silica_uploads) 으로 설정하면 파일은 안전하게 보존되고 이 라우트가 web 노출.
//
//   .htaccess 의 RewriteRule 이 기존 /uploads/(.*) → /api/file/$1 매핑.
//   기존 코드 (image_url = '/uploads/...') 는 그대로 동작.
//
//   보안: filename 만 허용 (path traversal 방지), realpath 가 UPLOAD_DIR 안에
//   있는지 확인, 허용된 확장자만 serve.

// (2026-06-08 v891) /api/file/diagnose — 동적 라우트 /api/file/:name 보다
//   먼저 등록해야 흡수 안 됨. 운영자 진단용 endpoint.
// (audit 신규High fix · 2026-06-12) adminOnly() 잠금 — 기존엔 무인증 공개로
//   UPLOAD_DIR 절대경로 / 업로드 파일명 샘플 (서명 파일 등) / 권한 / PHP user
//   를 누구나 조회 가능했음 (정찰 정보 노출). frontend 호출처 없음 확인
//   (v890-892 의 signature 404 디버깅용 수동 도구였음) → 잠금 안전.
get('/api/file/diagnose', function () {
    adminOnly();
    $base = defined('UPLOAD_DIR') ? rtrim(UPLOAD_DIR, '/\\') : '(UPLOAD_DIR undefined)';
    $deployUploadsExists = false;
    $publicDir = defined('PUBLIC_DIR') ? PUBLIC_DIR : (defined('UPLOAD_DIR') ? dirname(UPLOAD_DIR) : '');
    if ($publicDir !== '') {
        $deployUploadsExists = is_dir(rtrim($publicDir, '/\\') . '/uploads');
    }
    $sampleFiles = [];
    if (is_dir($base)) {
        $entries = @scandir($base) ?: [];
        foreach ($entries as $e) {
            if ($e === '.' || $e === '..') continue;
            $sampleFiles[] = $e;
            if (count($sampleFiles) >= 20) break;
        }
    }
    jsonOk([
        'upload_dir'           => $base,
        'upload_dir_exists'    => is_dir($base),
        'upload_dir_writable'  => is_writable($base),
        'upload_dir_perms'     => is_dir($base) ? substr(sprintf('%o', @fileperms($base)), -4) : null,
        'file_count'           => count($sampleFiles),
        'sample_files'         => $sampleFiles,
        // 핵심 진단: PUBLIC_DIR/uploads/ 가 deploy 되어 있으면 .htaccess
        //   RewriteRule 가로채기 위험.
        'deploy_uploads_exists'   => $deployUploadsExists,
        'deploy_uploads_path'     => $publicDir !== '' ? rtrim($publicDir, '/\\') . '/uploads' : null,
        'public_dir'              => $publicDir,
        'php_user'                => function_exists('posix_getpwuid') && function_exists('posix_geteuid')
                                       ? (posix_getpwuid(posix_geteuid())['name'] ?? '?') : '(posix unavailable)',
    ]);
});

get('/api/file/:name', function ($p) {
    $name = (string)($p['name'] ?? '');
    // (2026-06-08 v890) 진단 정보 풀 응답 — 운영자가 어디서 실패하는지 즉시 확인.
    // (audit 신규High fix · 2026-06-12) 진단 정보를 HTTP 응답에서 제거하고
    //   error_log 로 이동. 기존엔 404/403 응답의 debug 필드에 UPLOAD_DIR 절대
    //   경로 / full_path / 업로드 파일명 샘플 10개 / realpath 가 무인증으로
    //   노출됐음. reason 코드는 유지 (민감정보 아님 + 운영 진단에 유용).
    //   운영자 진단 경로: Hostinger PHP error_log 의 '[file serve]' 항목 또는
    //   admin 전용 /api/file/diagnose.
    //   frontend 영향 없음: 파일 404 의 debug 필드를 파싱하는 JS 없음 확인.
    $base = defined('UPLOAD_DIR') ? rtrim(UPLOAD_DIR, '/\\') : '(UPLOAD_DIR undefined)';
    $requestUri = (string)($_SERVER['REQUEST_URI'] ?? '');

    // 경로 traversal 차단
    if ($name === '' || strpos($name, '/') !== false || strpos($name, '\\') !== false || strpos($name, '..') !== false) {
        jsonError(400, '파일 이름이 올바르지 않습니다 (경로 문자 차단).', ['reason' => 'invalid_filename']);
    }
    // 허용 확장자만
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $mimeMap = [
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'svg'  => 'image/svg+xml',
        'avif' => 'image/avif',
        'heic' => 'image/heic',
        'heif' => 'image/heif',
        'gif'  => 'image/gif',
        'pdf'  => 'application/pdf',
    ];
    if (!isset($mimeMap[$ext])) {
        jsonError(404, '지원하지 않는 확장자입니다.', ['reason' => 'unsupported_extension', 'extension' => $ext]);
    }

    $path = $base . DIRECTORY_SEPARATOR . $name;

    if (!is_file($path) || !is_readable($path)) {
        error_log(sprintf(
            '[file serve] %s — name=%s uri=%s upload_dir=%s dir_exists=%s file_exists=%s readable=%s',
            !is_file($path) ? 'file_not_found' : 'not_readable',
            $name,
            $requestUri,
            $base,
            is_dir($base) ? 'y' : 'n',
            file_exists($path) ? 'y' : 'n',
            is_readable($path) ? 'y' : 'n'
        ));
        jsonError(404, '파일을 찾을 수 없습니다.', [
            'reason' => !is_file($path) ? 'file_not_found' : 'not_readable',
        ]);
    }
    // realpath 검증 — symlink / 상대경로 우회 방지
    $real = realpath($path);
    $realBase = realpath($base);
    if ($real === false || $realBase === false || strpos($real, $realBase . DIRECTORY_SEPARATOR) !== 0) {
        error_log(sprintf(
            '[file serve] realpath_check_failed — name=%s real=%s base=%s',
            $name,
            $real === false ? '(false)' : $real,
            $realBase === false ? '(false)' : $realBase
        ));
        jsonError(403, '파일 위치 검증 실패 (path traversal 차단).', ['reason' => 'realpath_check_failed']);
    }

    header('Content-Type: ' . $mimeMap[$ext]);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: public, max-age=3600');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
});

// (v890→v891) /api/file/diagnose 라우트는 위쪽 /api/file/:name 보다 먼저
//   등록되도록 이동됨. 여기 중복 정의 제거.

get('/api/home/summary', function () {
    $user = authOptional();

    $platformAssets = DB::fetchAll("SELECT id, status, funded_snapshot_usdt, raised_usdt, supply_token FROM assets WHERE is_public=1");
    $totalAssets = count($platformAssets);
    $activeStatuses = [STATUSES['FUNDING'], STATUSES['BUYING'], STATUSES['DISTRIBUTING'], STATUSES['OPERATING']];
    $activeCount = 0;
    foreach ($platformAssets as $asset) {
        if (in_array(trim((string)($asset['status'] ?? '')), $activeStatuses, true)) {
            $activeCount++;
        }
    }

    $now = nowKST();
    $day = (int)$now->format('j');
    $month = (int)$now->format('n');
    $year = (int)$now->format('Y');
    if ($day >= STAKING_PAYDAY) {
        $month++;
        if ($month > 12) {
            $month = 1;
            $year++;
        }
    }
    $nextInterest = sprintf('%04d-%02d-%02d', $year, $month, STAKING_PAYDAY);

    $platformTotalInterest = 0.0;
    try {
        $platformTotalInterest = (float)DB::fetchValue("SELECT COALESCE(SUM(amount_usdt),0) FROM interest_claims");
    } catch (Throwable $e) {
        $platformTotalInterest = 0.0;
    }

    $platformSalePayout = 0.0;
    try {
        $platformSalePayout = (float)DB::fetchValue("SELECT COALESCE(SUM(usdt),0) FROM sale_redemptions");
    } catch (Throwable $e) {
        $platformSalePayout = 0.0;
    }

    $platformSaleProfit = 0.0;
    $platformProfitComputable = true;
    try {
        $profitRows = DB::fetchAll(
            "SELECT sr.asset_id,
                    COALESCE(SUM(sr.tokens),0) AS tokens_sum,
                    COALESCE(SUM(sr.usdt),0) AS usdt_sum,
                    a.funded_snapshot_usdt,
                    a.raised_usdt,
                    a.supply_token
             FROM sale_redemptions sr
             JOIN assets a ON a.id = sr.asset_id
             GROUP BY sr.asset_id"
        );
        foreach ($profitRows as $row) {
            $tokens = (float)($row['tokens_sum'] ?? 0);
            $receivedUsdt = (float)($row['usdt_sum'] ?? 0);
            $supply = (float)($row['supply_token'] ?? 0);
            $denom = (float)($row['funded_snapshot_usdt'] ?? 0);
            if (!($denom > 0)) $denom = (float)($row['raised_usdt'] ?? 0);
            if (!($tokens > 0)) continue;
            if (!($supply > 0 && $denom > 0)) {
                $platformProfitComputable = false;
                continue;
            }
            $unitCost = $denom / $supply;
            $principal = $tokens * $unitCost;
            $platformSaleProfit += ($receivedUsdt - $principal);
        }
    } catch (Throwable $e) {
        $platformProfitComputable = false;
    }

    $userSummary = null;
    if (!empty($user['address'] ?? '')) {
        $address = (string)$user['address'];
        $userInterest = 0.0;
        $userSalePayout = 0.0;
        $userSaleProfit = 0.0;
        $userSaleProfitComputable = true;

        try {
            $userInterest = (float)DB::fetchValue(
                "SELECT COALESCE(SUM(amount_usdt),0) FROM interest_claims WHERE address=?",
                [$address]
            );
        } catch (Throwable $e) {
            $userInterest = 0.0;
        }

        try {
            $userSalePayout = (float)DB::fetchValue(
                "SELECT COALESCE(SUM(usdt),0) FROM sale_redemptions WHERE address=?",
                [$address]
            );
        } catch (Throwable $e) {
            $userSalePayout = 0.0;
        }

        try {
            $userProfitRows = DB::fetchAll(
                "SELECT sr.asset_id,
                        COALESCE(SUM(sr.tokens),0) AS tokens_sum,
                        COALESCE(SUM(sr.usdt),0) AS usdt_sum,
                        a.funded_snapshot_usdt,
                        a.raised_usdt,
                        a.supply_token
                 FROM sale_redemptions sr
                 JOIN assets a ON a.id = sr.asset_id
                 WHERE sr.address=?
                 GROUP BY sr.asset_id",
                [$address]
            );
            foreach ($userProfitRows as $row) {
                $tokens = (float)($row['tokens_sum'] ?? 0);
                $receivedUsdt = (float)($row['usdt_sum'] ?? 0);
                $supply = (float)($row['supply_token'] ?? 0);
                $denom = (float)($row['funded_snapshot_usdt'] ?? 0);
                if (!($denom > 0)) $denom = (float)($row['raised_usdt'] ?? 0);
                if (!($tokens > 0)) continue;
                if (!($supply > 0 && $denom > 0)) {
                    $userSaleProfitComputable = false;
                    continue;
                }
                $unitCost = $denom / $supply;
                $principal = $tokens * $unitCost;
                $userSaleProfit += ($receivedUsdt - $principal);
            }
        } catch (Throwable $e) {
            $userSaleProfitComputable = false;
        }

        $userSummary = [
            'address' => $address,
            'total_interest_usdt' => round($userInterest, 6),
            'sale_payout_usdt' => round($userSalePayout, 6),
            'sale_profit_usdt' => round($userSaleProfit, 6),
            'sale_profit_computable' => $userSaleProfitComputable,
        ];
    }

    $platformSummary = [
        'total_assets' => $totalAssets,
        'active_assets' => $activeCount,
        'next_interest_pay_date' => $nextInterest,
        'next_interest_date' => $nextInterest,
        'interest_pay_day' => (int)STAKING_PAYDAY,
        'total_interest_usdt' => round($platformTotalInterest, 6),
        'total_interest_paid_usdt' => round($platformTotalInterest, 6),
        'total_sale_payout_usdt' => round($platformSalePayout, 6),
        'total_sale_profit_usdt' => round($platformSaleProfit, 6),
        'sale_profit_computable' => $platformProfitComputable,
    ];

    jsonOk(array_merge($platformSummary, [
        'platform' => $platformSummary,
        'user' => $userSummary,
    ]));
});

/**
 * (2026-06-17 v910) SOL/USDT 캔들(OHLC) 프록시 — trade2.html SOL 시세 차트용.
 *
 * 설계 (운영자 결정 2026-06-17):
 *   - 촛대 = SOL/USDT 시세 그대로 (직관적, SOL 오르면 차트도 위로).
 *     STO 가치(1 USDT = 1÷SOL SOL)는 프론트에서 숫자로 병기.
 *   - 서버 경유: 브라우저가 외부 API 를 직접 호출하지 않고 backend 가 프록시.
 *     → 일부 지역의 Binance 차단 무관(서버가 호출), rate-limit 단일 제어,
 *       거래량과 무관(아래 캐싱) — fx 점검에서 확인한 '거래 건마다 호출 안 함' 원칙.
 *
 * 데이터 소스 (fallback chain):
 *   1. Binance klines (SOLUSDT) — OHLC 통째 제공, 봉 완성형, 과거 봉 백필 자동.
 *   2. CoinGecko coins/solana/ohlc — Binance 실패(지역 차단 등) 시.
 *
 * 캐싱: 같은 (interval, limit) 응답을 settings 에 JSON + TTL 로 저장.
 *   봉 주기보다 짧은 TTL (실시간 아님). 모든 소스 실패 시 stale 캐시라도 반환.
 *
 * 안전: SOL API 가 전부 죽어도 candles=[] 만 돌아오고 거래(USDT 1:1)는 무관.
 */
if (!function_exists('solFetchBinanceKlines')) {
    function solFetchBinanceKlines(string $interval, int $limit): array {
        // Binance interval (15m,1h,4h,1d 모두 지원) 그대로 사용.
        $url = "https://api.binance.com/api/v3/klines?symbol=SOLUSDT&interval="
             . rawurlencode($interval) . "&limit=" . $limit;
        $j = fxwHttpGetJson($url, 8);
        if (!is_array($j)) return [];
        $out = [];
        foreach ($j as $k) {
            // [openTime(ms), open, high, low, close, volume, ...]
            if (!is_array($k) || count($k) < 5) continue;
            $out[] = [
                't' => (int)round(((float)$k[0]) / 1000), // ms → sec
                'o' => (float)$k[1],
                'h' => (float)$k[2],
                'l' => (float)$k[3],
                'c' => (float)$k[4],
            ];
        }
        return $out;
    }
}

if (!function_exists('solFetchCoingeckoOhlc')) {
    function solFetchCoingeckoOhlc(string $interval, int $limit): array {
        // CoinGecko OHLC: days 파라미터가 granularity 를 결정한다.
        //   days=1 → 30분봉, days=7~30 → 4시간봉, days=90+ → 1일봉.
        //   우리 interval 에 가장 근접한 days 로 받고 limit 으로 잘라낸다.
        $daysMap = ['15m' => 1, '1h' => 1, '4h' => 14, '1d' => 30];
        $days = $daysMap[$interval] ?? 1;
        $url = "https://api.coingecko.com/api/v3/coins/solana/ohlc?vs_currency=usd&days=" . $days;
        $j = fxwHttpGetJson($url, 10);
        if (!is_array($j)) return [];
        $out = [];
        foreach ($j as $k) {
            // [timestamp(ms), open, high, low, close]
            if (!is_array($k) || count($k) < 5) continue;
            $out[] = [
                't' => (int)round(((float)$k[0]) / 1000),
                'o' => (float)$k[1],
                'h' => (float)$k[2],
                'l' => (float)$k[3],
                'c' => (float)$k[4],
            ];
        }
        if (count($out) > $limit) $out = array_slice($out, -$limit);
        return $out;
    }
}

get('/api/public/sol-candles', function () {
    $interval = (string)($_GET['interval'] ?? '1h');
    $allowed = ['15m' => 96, '1h' => 48, '4h' => 60, '1d' => 60];
    if (!isset($allowed[$interval])) $interval = '1h';
    $limit = (int)($_GET['limit'] ?? $allowed[$interval]);
    $limit = max(10, min(200, $limit));

    // 캐시 TTL(초) — 봉 주기보다 짧게.
    $ttlMap = ['15m' => 120, '1h' => 300, '4h' => 600, '1d' => 900];
    $ttl = $ttlMap[$interval] ?? 300;

    // (2026-06-17 v910) 파일 캐시. settings.value 가 varchar(255) 라 봉 JSON(~2KB)이
    //   안 들어가 캐시 미스(라이브 검증서 cached=false)가 났음. sys_get_temp_dir 는
    //   컬럼 길이 무관 + 배포 wipe 무관. 캐시가 실패해도 데이터는 매번 정상 반환됨.
    $cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . "silica_sol_candles_{$interval}_{$limit}.json";
    $readFileCache = function () use ($cacheFile) {
        if (!is_file($cacheFile)) return null;
        $raw = @file_get_contents($cacheFile);
        if ($raw === false) return null;
        $decoded = json_decode($raw, true);
        return (is_array($decoded) && !empty($decoded['candles'])) ? $decoded : null;
    };

    // 신선한 캐시가 있으면 외부 호출 없이 반환.
    $cacheAge = is_file($cacheFile) ? (time() - (int)@filemtime($cacheFile)) : PHP_INT_MAX;
    if ($cacheAge < $ttl) {
        $decoded = $readFileCache();
        if ($decoded) {
            jsonOk(array_merge($decoded, ['cached' => true, 'age_sec' => $cacheAge]));
            return;
        }
    }

    $candles = [];
    $source  = null;
    $errors  = [];

    // 1) Binance klines
    try {
        $candles = solFetchBinanceKlines($interval, $limit);
        if (!empty($candles)) $source = 'binance';
    } catch (Throwable $e) {
        $errors[] = 'binance: ' . $e->getMessage();
    }

    // 2) CoinGecko OHLC fallback
    if (empty($candles)) {
        try {
            $candles = solFetchCoingeckoOhlc($interval, $limit);
            if (!empty($candles)) $source = 'coingecko';
        } catch (Throwable $e) {
            $errors[] = 'coingecko: ' . $e->getMessage();
        }
    }

    // 모든 소스 실패 — stale 캐시라도 있으면 반환, 없으면 빈 배열(차트만 빔, 거래 무관).
    if (empty($candles)) {
        $decoded = $readFileCache();
        if ($decoded) {
            jsonOk(array_merge($decoded, [
                'cached' => true, 'stale' => true,
                'age_sec' => is_file($cacheFile) ? (time() - (int)@filemtime($cacheFile)) : null,
            ]));
            return;
        }
        jsonOk([
            'candles'  => [],
            'source'   => null,
            'interval' => $interval,
            'error'    => $errors ? implode(' | ', $errors) : 'no data',
        ]);
        return;
    }

    $lastRow = end($candles);
    $payload = [
        'candles'    => $candles,
        'source'     => $source,
        'interval'   => $interval,
        'last_price' => is_array($lastRow) ? (float)$lastRow['c'] : null,
        'fetched_at' => date('Y-m-d H:i:s'),
    ];

    @file_put_contents($cacheFile, json_encode($payload, JSON_UNESCAPED_SLASHES), LOCK_EX);

    jsonOk(array_merge($payload, ['cached' => false]));
});
