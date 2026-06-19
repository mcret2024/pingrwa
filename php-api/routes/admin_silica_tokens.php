<?php
/**
 * Silica Token Mint Address Management
 * 외부에서 발행한 SPL 토큰의 mint 주소 등록
 */

// ----------------------------------------------------------------
// GET /api/admin/silica/tokens - 현재 토큰 mint 주소들
// ----------------------------------------------------------------
get('/api/admin/silica/tokens', function () {
    adminOnly();

    $stoMint = (string)getSetting('silica_sto_mint', '');
    $tokenMint = (string)getSetting('silica_token_mint', '');
    $usdtMint = (string)getSetting('solana_usdt_mint', '');
    $usdtDecimals = (int)getSetting('solana_usdt_decimals', 6);

    // Silica STO 분배 모델 v1 — 사전 발행 + Claim 장부(ledger) 분배
    // burn 없음 (Reserve 가 영구 backing).
    $stoDecimals = (int)getSetting('silica_sto_decimals', 1);
    $stoTotalMinted = (string)getSetting('silica_sto_total_minted', '0');
    $stoReserveWallet = (string)getSetting('silica_sto_reserve_wallet', '');

    jsonOk([
        'usdt_mint' => $usdtMint,
        'usdt_decimals' => $usdtDecimals,
        'silica_sto_mint' => $stoMint,
        'silica_token_mint' => $tokenMint,
        // 분배 모델 설정
        'silica_sto_decimals' => $stoDecimals,
        'silica_sto_total_minted' => $stoTotalMinted,
        'silica_sto_reserve_wallet' => $stoReserveWallet,
    ]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/tokens - 토큰 mint 주소 저장
// Body: { usdt_mint, silica_sto_mint, silica_token_mint, usdt_decimals }
// (2026-05-21 보안감사) Was adminAuth() — JWT only.
//   감사관 (ChatGPT) 보고: 'mint 주소 변경은 on-chain destination 결정의
//   critical config. JWT 만으로는 v583 화이트리스트 우회 가능.' adminOnly()
//   로 교체 — adminOnly() 의 regex 에 'silica/tokens$' 가 이미 포함되어
//   있어 Phantom 헤더 검증도 동시에 활성화됨.
// ----------------------------------------------------------------
post('/api/admin/silica/tokens', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    $usdtMint = trim((string)($body['usdt_mint'] ?? ''));
    $stoMint = trim((string)($body['silica_sto_mint'] ?? ''));
    $tokenMint = trim((string)($body['silica_token_mint'] ?? ''));
    $usdtDecimals = isset($body['usdt_decimals']) ? (int)$body['usdt_decimals'] : 6;

    // STO 분배 모델 v1 — 신규 필드 (선택적, 미전송 시 기존 값 유지)
    $stoDecimalsRaw      = $body['silica_sto_decimals']       ?? null;
    $stoTotalMintedRaw   = $body['silica_sto_total_minted']   ?? null;
    $stoReserveWalletRaw = $body['silica_sto_reserve_wallet'] ?? null;

    // Solana mint 주소 형식 검증 (base58, 32-44자)
    $validateMint = function (string $s, string $field): void {
        if ($s === '') return; // 빈 값은 OK
        if (!preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $s)) {
            jsonError("$field: 유효하지 않은 Solana mint 주소", 400);
        }
    };
    $validateMint($usdtMint, 'usdt_mint');
    $validateMint($stoMint, 'silica_sto_mint');
    $validateMint($tokenMint, 'silica_token_mint');

    if ($usdtDecimals < 0 || $usdtDecimals > 18) {
        jsonError('USDT decimals는 0~18 범위여야 합니다.', 400);
    }

    // STO 분배 필드 검증
    if ($stoDecimalsRaw !== null) {
        $stoDecimals = (int)$stoDecimalsRaw;
        if ($stoDecimals < 0 || $stoDecimals > 18) {
            jsonError('STO decimals 는 0~18 범위여야 합니다.', 400);
        }
    }
    if ($stoTotalMintedRaw !== null) {
        $stoTotalMinted = trim((string)$stoTotalMintedRaw);
        if (!preg_match('/^\d+$/', $stoTotalMinted)) {
            jsonError('STO total minted 는 0 이상의 정수여야 합니다.', 400);
        }
    }
    if ($stoReserveWalletRaw !== null) {
        $stoReserveWallet = trim((string)$stoReserveWalletRaw);
        $validateMint($stoReserveWallet, 'silica_sto_reserve_wallet');
    }

    // 이전 값 (감사 로그용)
    $prev = [
        'usdt_mint' => (string)getSetting('solana_usdt_mint', ''),
        'silica_sto_mint' => (string)getSetting('silica_sto_mint', ''),
        'silica_token_mint' => (string)getSetting('silica_token_mint', ''),
        'usdt_decimals' => (int)getSetting('solana_usdt_decimals', 6),
        'silica_sto_decimals' => (int)getSetting('silica_sto_decimals', 1),
        'silica_sto_total_minted' => (string)getSetting('silica_sto_total_minted', '0'),
        'silica_sto_reserve_wallet' => (string)getSetting('silica_sto_reserve_wallet', ''),
    ];

    // 저장
    setSetting('solana_usdt_mint', $usdtMint);
    setSetting('silica_sto_mint', $stoMint);
    setSetting('silica_token_mint', $tokenMint);
    setSetting('solana_usdt_decimals', (string)$usdtDecimals);

    if ($stoDecimalsRaw !== null) setSetting('silica_sto_decimals', (string)$stoDecimals);
    if ($stoTotalMintedRaw !== null) setSetting('silica_sto_total_minted', $stoTotalMinted);
    if ($stoReserveWalletRaw !== null) setSetting('silica_sto_reserve_wallet', $stoReserveWallet);

    // 감사 로그
    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, prev_value, new_value)
         VALUES ('mint_change', 'silica_mint_update', ?, ?, ?)",
        [
            $admin['username'],
            json_encode($prev),
            json_encode([
                'usdt_mint' => $usdtMint,
                'silica_sto_mint' => $stoMint,
                'silica_token_mint' => $tokenMint,
                'usdt_decimals' => $usdtDecimals,
                'silica_sto_decimals' => $stoDecimalsRaw !== null ? (int)$stoDecimals : null,
                'silica_sto_total_minted' => $stoTotalMintedRaw !== null ? $stoTotalMinted : null,
                'silica_sto_reserve_wallet' => $stoReserveWalletRaw !== null ? $stoReserveWallet : null,
            ]),
        ]
    );

    jsonOk(['ok' => true]);
});

// ----------------------------------------------------------------
// GET /api/admin/silica/onchain-supply - SilicaSTO 사전 발행량 on-chain 조회
//   - silica_sto_mint 설정값으로 Solana RPC `getTokenSupply` 호출
//   - 발행량(supply) + decimals + uiAmount + 조회 시각 반환
//   - 이 값이 사장님 정책상 "사전 발행량"의 단일 진실 (manual 입력 불필요)
// ----------------------------------------------------------------
get('/api/admin/silica/onchain-supply', function () {
    adminOnly();

    $mint = trim((string)getSetting('silica_sto_mint', ''));
    if ($mint === '') {
        jsonError('SilicaSTO Mint 주소가 설정되어 있지 않습니다. 먼저 설정을 저장해주세요.', 400);
    }

    try {
        $info = getSolanaMintRuntimeInfo($mint);
        $rawSupply = isset($info['supply']) ? (float)$info['supply'] : 0;
        $decimals = isset($info['decimals']) ? (int)$info['decimals'] : 0;
        $uiSupply = $decimals > 0
            ? ($rawSupply / pow(10, $decimals))
            : $rawSupply;

        // 캐시 갱신 — 다른 페이지(dashboard) 가 이 값을 빠르게 읽을 수 있도록
        // app_settings 의 silica_sto_total_minted / silica_sto_decimals 를 업데이트.
        // 정수 문자열로 보관 (UI 단위, decimals 반영).
        try {
            setSetting('silica_sto_total_minted', (string)number_format($uiSupply, 0, '.', ''));
            setSetting('silica_sto_decimals', (string)$decimals);
        } catch (Throwable $_) { /* cache 갱신 실패는 응답에 영향 없음 */ }

        jsonOk([
            'mint' => $mint,
            'decimals' => $decimals,
            'raw_supply' => (string)$rawSupply,        // smallest-unit 정수 문자열
            'ui_supply' => $uiSupply,                  // 표시 단위 (decimals 적용)
            'name' => $info['name'] ?? null,
            'symbol' => $info['symbol'] ?? null,
            'source' => $info['source'] ?? null,
            'fetched_at' => date('c'),
        ]);
    } catch (Throwable $e) {
        jsonError('on-chain 조회 실패: ' . $e->getMessage(), 502);
    }
});

// ----------------------------------------------------------------
// GET /api/silica/tokens - 공개: 사용자도 토큰 정보 조회 (mint 주소는 공개)
// ----------------------------------------------------------------
get('/api/silica/tokens', function () {
    jsonOk([
        'usdt_mint' => (string)getSetting('solana_usdt_mint', ''),
        'silica_sto_mint' => (string)getSetting('silica_sto_mint', ''),
        'silica_token_mint' => (string)getSetting('silica_token_mint', ''),
        'network' => (string)getSetting('solana_network', 'devnet'),
    ]);
});

// ================================================================
// Token Logo Management (USDT / SilicaSTO / Silica)
// ----------------------------------------------------------------
// 운영자가 admin/assets.html 페이지에서 USDT / SilicaSTO / Silica
// 토큰 로고 이미지를 업로드하고 교체할 수 있게 한다.
// 저장된 URL 은 app_settings 의 silica_logo_usdt / silica_logo_silicasto /
// silica_logo_silica 키에 보관되며, /api/public/config 응답 또는 별도의
// GET 으로 조회 가능. 비어있으면 프론트가 기본 SVG (예: /user/assets/
// images/token-usdt.svg) 로 폴백.
// ================================================================

if (!function_exists('silicaTokenLogoKeys')) {
    function silicaTokenLogoKeys(): array {
        return [
            'usdt'      => 'silica_logo_usdt',
            'silicasto' => 'silica_logo_silicasto',
            'silica'    => 'silica_logo_silica',
        ];
    }
}

if (!function_exists('silicaGetTokenLogos')) {
    /**
     * (2026-06-07 v868) DB 에 저장된 URL 이 가리키는 파일이 실제로 UPLOAD_DIR
     * 에 존재하는지 검증한 뒤 반환. 파일이 누락되었으면 (예: Hostinger git
     * auto-deploy 가 uploads 폴더를 wipe 했거나, UPLOAD_DIR 설정이 잘못된
     * 환경 migration 직후) 빈 문자열을 반환하여 frontend 가 번들된 기본
     * SVG 로 자연스럽게 fallback 하도록 한다.
     *
     * 이전 동작: DB URL 그대로 노출 → 브라우저 404 (silica_logo_*.webp).
     */
    function silicaGetTokenLogos(): array {
        $out = [];
        $uploadDir = defined('UPLOAD_DIR') ? rtrim((string)UPLOAD_DIR, "/\\") : '';
        foreach (silicaTokenLogoKeys() as $slug => $key) {
            $url = (string)getSetting($key, '');
            if ($url === '') { $out[$slug] = ''; continue; }
            // URL 형태: '/uploads/<name>' 또는 '/api/file/<name>' — basename 으로
            // 파일명 추출 후 UPLOAD_DIR 안에 실재하는지 확인.
            $filename = basename($url);
            if ($filename === '' || $uploadDir === '') { $out[$slug] = ''; continue; }
            // path traversal 차단 (basename 만 사용)
            if (strpos($filename, '..') !== false || strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
                $out[$slug] = ''; continue;
            }
            $filepath = $uploadDir . DIRECTORY_SEPARATOR . $filename;
            if (!is_file($filepath)) {
                error_log("[silica_logo] missing file for {$key}: {$filepath} (DB url={$url}) — falling back to default");
                $out[$slug] = '';
                continue;
            }
            $out[$slug] = $url;
        }
        return $out;
    }
}

// ----------------------------------------------------------------
// GET /api/admin/silica/token-logos - 현재 등록된 로고 URL
// ----------------------------------------------------------------
get('/api/admin/silica/token-logos', function () {
    adminOnly();
    jsonOk([
        'logos' => silicaGetTokenLogos(),
    ]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/token-logos/upload
//   multipart/form-data:
//     - token: 'usdt' | 'silicasto' | 'silica'
//     - file:  업로드할 이미지 파일 (PNG/JPG/WEBP/SVG, 최대 2 MB)
//   응답: { ok, token, url }
//
// 업로드 검증 (확장자 + MIME + finfo 콘텐츠 sniff) 은 admin_assets.php 의
// upload 라우트와 동일한 3중 검증 로직을 사용한다.
// ----------------------------------------------------------------
post('/api/admin/silica/token-logos/upload', function () {
    $admin = adminAuth();

    $token = strtolower(trim((string)($_POST['token'] ?? '')));
    $keys = silicaTokenLogoKeys();
    if (!isset($keys[$token])) {
        jsonError("token 필드는 다음 중 하나여야 합니다: " . implode(', ', array_keys($keys)), 400);
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        jsonError('파일이 업로드되지 않았습니다.', 400);
    }

    $file = $_FILES['file'];

    if ($file['size'] <= 0 || $file['size'] > 2 * 1024 * 1024) {
        jsonError('파일 크기는 0 < size ≤ 2 MB 여야 합니다.', 400);
    }

    $allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    $allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $ext = $ext ? '.' . $ext : '';
    if (!in_array($ext, $allowedExts, true)) {
        jsonError('지원되는 확장자: PNG, JPG, JPEG, WEBP, SVG', 400);
    }

    $mimeClaimed = strtolower(trim((string)($file['type'] ?? '')));
    if ($mimeClaimed !== '' && !in_array($mimeClaimed, $allowedMimes, true)) {
        jsonError('MIME 타입이 허용되지 않습니다.', 400);
    }

    if (function_exists('finfo_open')) {
        $finfo = @finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $real = strtolower((string)@finfo_file($finfo, $file['tmp_name']));
            finfo_close($finfo);
            if ($real !== '' && !in_array($real, $allowedMimes, true)) {
                jsonError('파일 콘텐츠가 이미지로 인식되지 않습니다.', 400);
            }
        }
    }

    if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);

    $filename = "silica_logo_{$token}_" . time() . '_' . mt_rand(1000, 9999) . $ext;
    $dest = UPLOAD_DIR . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        jsonError('파일 저장 실패.', 500);
    }

    $url = '/uploads/' . $filename;
    $key = $keys[$token];
    $prev = (string)getSetting($key, '');
    setSetting($key, $url);

    // 감사 로그 — silica_audit_log 가 있으면 기록 (스키마 부재 시 무시)
    try {
        DB::execute(
            "INSERT INTO silica_audit_log (category, action, actor, prev_value, new_value)
             VALUES ('logo_change', 'token_logo_upload', ?, ?, ?)",
            [
                $admin['username'] ?? 'admin',
                json_encode([$key => $prev]),
                json_encode([$key => $url]),
            ]
        );
    } catch (Throwable $_) { /* 감사 로그 실패는 응답에 영향 없음 */ }

    jsonOk([
        'ok' => true,
        'token' => $token,
        'url' => $url,
    ]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/token-logos/clear
//   body: { token: 'usdt' | 'silicasto' | 'silica' }
//   설정값을 빈 문자열로 되돌려 기본 SVG 폴백을 사용하게 한다.
// ----------------------------------------------------------------
post('/api/admin/silica/token-logos/clear', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    $token = strtolower(trim((string)($body['token'] ?? '')));
    $keys = silicaTokenLogoKeys();
    if (!isset($keys[$token])) {
        jsonError("token 필드는 다음 중 하나여야 합니다: " . implode(', ', array_keys($keys)), 400);
    }

    $key = $keys[$token];
    $prev = (string)getSetting($key, '');
    setSetting($key, '');

    try {
        DB::execute(
            "INSERT INTO silica_audit_log (category, action, actor, prev_value, new_value)
             VALUES ('logo_change', 'token_logo_clear', ?, ?, ?)",
            [
                $admin['username'] ?? 'admin',
                json_encode([$key => $prev]),
                json_encode([$key => '']),
            ]
        );
    } catch (Throwable $_) { /* 감사 로그 실패는 응답에 영향 없음 */ }

    jsonOk(['ok' => true, 'token' => $token]);
});
