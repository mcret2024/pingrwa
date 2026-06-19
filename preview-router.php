<?php
/**
 * SilicaChain Preview Mock Router
 *
 * For visual review without DB setup.
 * Intercepts /api/* requests and returns fake JSON responses
 * so the admin pages load without errors.
 *
 * Usage:  php -S localhost:8765 preview-router.php
 */

// Decode request URL (handle Korean/encoded paths)
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// CORS headers for all requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * Mock JSON response helper
 */
function mockJson($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Get POST body as array
 */
function getBody(): array {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    return is_array($json) ? $json : [];
}

// ============ MOCK API ROUTES ============
if (strpos($uri, '/api/') === 0) {

    // Public Config
    if ($uri === '/api/public/config') {
        mockJson([
            'bypass_otp' => true,
            'bypass_kyc' => true,
            'fx_rates' => ['KRW' => 1400.0, 'USD' => 1.0],
            'silica_price_usdt' => 0.05,
            'sale_phase' => 'public',
            'sale_price_usdt' => 0.001,
            'usdt_mint' => 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            'silica_sto_mint' => '',
            'silica_token_mint' => '',
            'network' => 'devnet',
        ]);
    }

    // Admin Login (any creds work in preview)
    if ($uri === '/api/admin/auth/login') {
        $body = getBody();
        $username = trim($body['username'] ?? '');
        if ($username === '') {
            mockJson(['error' => '아이디를 입력하세요.'], 400);
        }
        // Generate fake JWT-like token
        mockJson([
            'token' => 'silica-preview-' . bin2hex(random_bytes(16)),
            'admin' => [
                'id' => 1,
                'username' => $username ?: 'admin',
                'role' => 'super',
                'email' => $username . '@silica.preview',
            ],
            'expires_in' => 86400,
        ]);
    }

    // Admin Whoami
    if ($uri === '/api/admin/auth/whoami') {
        mockJson([
            'admin' => [
                'id' => 1,
                'username' => 'admin',
                'role' => 'super',
                'email' => 'admin@silica.preview',
            ],
        ]);
    }

    // Admin Logout
    if ($uri === '/api/admin/auth/logout') {
        mockJson(['ok' => true]);
    }

    // Admin Dashboard
    if ($uri === '/api/admin/dashboard') {
        mockJson([
            'kpi' => [
                'total' => '$847,000',
                'funding' => '$420K / $1M',
                'buying' => '847,000',
                'active' => '5,000 STO',
                'sold' => '0',
                'failed' => '0',
                'open_orders' => '24',
                'vol_24h' => '12,547 SILICA',
                'platform_fee' => '$1,247',
                'staked' => '847,000 STO',
                'payday' => '5월 15일 (D-19)',
                'fx' => '₩1,400',
            ],
            'alerts' => [],
            'assets' => [
                ['name' => '광업권 79907호', 'status' => 'funding', 'raised' => 420000, 'goal' => 1000000, 'progress' => 42, 'issued' => 847000],
            ],
            'book' => [
                ['asset' => 'SILICA/USDT', 'best_bid' => 0.05, 'best_ask' => 0.06, 'spread' => 0.01, 'orders_ba' => '12 / 8', 'qty_ba' => '15500 / 6300'],
            ],
            'trades' => [
                ['time' => '14:32:10', 'asset' => 'SILICA/USDT', 'price' => 0.05, 'qty' => 240, 'amount' => 12.00],
                ['time' => '14:31:45', 'asset' => 'SILICA/USDT', 'price' => 0.05, 'qty' => 120, 'amount' => 6.00],
                ['time' => '14:30:22', 'asset' => 'SILICA/USDT', 'price' => 0.04, 'qty' => 500, 'amount' => 20.00],
            ],
            'sales' => [
                ['key' => 'Public Sale 진행률', 'value' => '42% ($420K/$1M)'],
                ['key' => '참여자 수', 'value' => '1,247명'],
                ['key' => '평균 투자', 'value' => '$337'],
            ],
            'staking' => [
                ['key' => '현재 이자율', 'value' => '5.00% (5월 회차)'],
                ['key' => '총 스테이킹', 'value' => '847,000 STO'],
                ['key' => '다음 지급일', 'value' => '2026-05-15 (D-19)'],
            ],
        ]);
    }

    // Admin Settings — get
    if ($uri === '/api/admin/settings' && $method === 'GET') {
        mockJson([
            'fx' => ['KRW' => 1400, 'USD' => 1, 'KZT' => 0, 'PHP' => 0, 'GEL' => 0, 'IDR' => 0, 'VND' => 0],
            'staking' => ['payday' => 15, 'lock_days' => 14],
            'deposit_addr' => '5fHneW46xGXgs5mUiveM4rPQEyKfxxMGgB1qgYWQcHjJ',
            'withdraw_addr' => '',
            'withdraw_fee_mode' => 'fixed_usdt',
            'withdraw_fee_fixed' => 1,
            'withdraw_fee_percent' => 0.5,
            'ref_bonus_rate' => 1.0,
            'bypass_otp' => true,
            'bypass_kyc' => true,
            'sol_network' => 'devnet',
            'sol_rpc_url' => 'https://api.devnet.solana.com',
            'sol_usdt_mint' => 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            'sol_usdt_decimals' => 6,
            'silica_sto_mint' => '',
            'silica_token_mint' => '',
            'silica_price_usdt' => 0.05,
            'amm_enabled' => true,
            'amm_balance' => 25000,
        ]);
    }

    // Admin Settings — save (any save returns ok)
    if (strpos($uri, '/api/admin/settings') === 0 || strpos($uri, '/api/admin/') === 0) {
        if ($method === 'POST' || $method === 'PUT') {
            mockJson(['ok' => true, 'message' => 'Preview 모드 - 실제 저장은 발생하지 않습니다.']);
        }
    }

    // Header alert counts
    if ($uri === '/api/admin/alerts/counts') {
        mockJson([
            'deposit' => 0,
            'contract' => 0,
            'withdraw' => 0,
            'token_withdraw' => 0,
            'total' => 0,
        ]);
    }

    // Asset list (single asset)
    if (strpos($uri, '/api/admin/assets') === 0 || strpos($uri, '/api/assets') === 0) {
        mockJson([
            'assets' => [
                [
                    'id' => 1,
                    'name_ko' => '고순도 실리카 광산',
                    'name_en' => 'High-Purity Silica Mine',
                    'license_no' => '79907',
                    'jurisdiction' => 'KR',
                    'sio2_purity' => 97.04,
                    'mine_area_ha' => 271,
                    'total_reserves_ton' => 30680000,
                    'recoverable_ton' => 21470000,
                    'recovery_rate' => 70,
                    'status' => 'funding',
                ]
            ],
        ]);
    }

    // Users list
    if (strpos($uri, '/api/admin/users') === 0) {
        mockJson([
            'users' => [],
            'total' => 0,
            'message' => 'Preview 모드 - 데이터 없음',
        ]);
    }

    // Catch-all for any other admin API
    if (strpos($uri, '/api/admin/') === 0) {
        mockJson(['ok' => true, 'data' => [], 'message' => 'Preview Mock API']);
    }

    // Public APIs catch-all
    if (strpos($uri, '/api/') === 0) {
        mockJson(['ok' => true, 'data' => []]);
    }
}

// ============ STATIC FILES ============

// Emulate .htaccess rewrite: /assets/* → /user/assets/*
// (core.js's absUrl() expects this rewrite for header/footer/CSS loading)
if (strpos($uri, '/assets/') === 0) {
    $rewrittenFile = __DIR__ . '/user' . $uri;
    if (file_exists($rewrittenFile) && !is_dir($rewrittenFile)) {
        // Set proper Content-Type based on extension
        $ext = strtolower(pathinfo($rewrittenFile, PATHINFO_EXTENSION));
        $mimeMap = [
            'css'  => 'text/css; charset=utf-8',
            'js'   => 'application/javascript; charset=utf-8',
            'html' => 'text/html; charset=utf-8',
            'json' => 'application/json; charset=utf-8',
            'png'  => 'image/png',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif'  => 'image/gif',
            'svg'  => 'image/svg+xml',
            'ico'  => 'image/x-icon',
            'woff' => 'font/woff',
            'woff2'=> 'font/woff2',
        ];
        if (isset($mimeMap[$ext])) {
            header('Content-Type: ' . $mimeMap[$ext]);
        }
        readfile($rewrittenFile);
        exit;
    }
}

// Default routing for non-API requests: serve as static file
$file = __DIR__ . $uri;

// If requesting a directory, look for index.html
if (is_dir($file)) {
    $file = rtrim($file, '/') . '/index.html';
}

// If file exists, return false to let PHP serve it
if (file_exists($file)) {
    return false;
}

// Otherwise 404
http_response_code(404);
echo "404 Not Found: $uri";
return true;
