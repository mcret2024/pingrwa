<?php
/**
 * RWA Platform - PHP API Router
 *
 * All /api/* requests are routed here via .htaccess
 */

// (2026-05-26 v829) 초기 부팅 단계 (vendor/autoload.php, lib/config.php 로드
//   이전) 에서 발생하는 예외도 APP_DEBUG=1 이 적용되도록, exception_handler 가
//   설치되기 전에 .env 를 미리 한 번 파싱한다.
//
// (2026-05-26 v830) 다중 위치 탐색 — Hostinger Git 자동 배포가 .env 를
//   .gitignore 기반으로 wipe 하는 문제 회피.
//
//   탐색 순서:
//     1) SILICA_ENV_PATH 환경변수가 가리키는 경로 (명시적 override)
//     2) /home/USER/silica.env  (5 levels up from php-api/ — Hostinger 홈)
//     3) /home/USER/.silica_env (위와 같은 위치, dot-prefix 버전)
//     4) /domains/USER/silica.env  (4 levels up — alternate Hostinger 구조)
//     5) php-api/.env  (legacy 기본 위치 — 자동 배포 wipe 위험)
//
//   하나라도 먼저 발견되면 거기서 로드. 운영 권장은 (2) — 배포 zone 밖에 위치.
function silicaFindEnvFile(): ?string {
    $candidates = [];
    $override = (string)getenv('SILICA_ENV_PATH');
    if ($override !== '') $candidates[] = $override;
    // 배포 zone 밖 우선 (안전 위치)
    //   2 levels up = /public_html/silica.env       — File Manager 접근 가능 + 배포 wipe 안전
    //   3-5 levels up = 호스팅 계정 home 영역 부근 — FTP / SSH 만 접근
    for ($up = 5; $up >= 2; $up--) {
        $base = dirname(__DIR__, $up);
        if ($base && $base !== '.' && $base !== '/') {
            $candidates[] = $base . '/silica.env';
            $candidates[] = $base . '/.silica_env';
        }
    }
    // legacy 기본 — 마지막 폴백
    $candidates[] = __DIR__ . '/.env';
    foreach ($candidates as $path) {
        if ($path && is_file($path) && is_readable($path)) return $path;
    }
    return null;
}

function silicaParseEnvFile(string $envFile): void {
    $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!$lines) return;
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k); $v = trim($v);
        if ((str_starts_with($v, '"') && str_ends_with($v, '"')) ||
            (str_starts_with($v, "'") && str_ends_with($v, "'"))) {
            $v = substr($v, 1, -1);
        }
        if (!isset($_ENV[$k]) && getenv($k) === false) {
            putenv("$k=$v");
            $_ENV[$k] = $v;
        }
    }
}

$_earlyEnvFile = silicaFindEnvFile();
if ($_earlyEnvFile) {
    silicaParseEnvFile($_earlyEnvFile);
    // 로드된 위치를 한 번 더 잘 보이게 환경변수로 남김 — 진단용
    if (getenv('SILICA_ENV_LOADED_FROM') === false) {
        putenv('SILICA_ENV_LOADED_FROM=' . $_earlyEnvFile);
        $_ENV['SILICA_ENV_LOADED_FROM'] = $_earlyEnvFile;
    }
}
unset($_earlyEnvFile);

// Global error handler - catch ALL errors as JSON
function apiShouldExposeDebug(): bool {
    foreach ([getenv('APP_DEBUG'), getenv('API_DEBUG'), getenv('NODE_ENV')] as $raw) {
        $v = strtolower(trim((string)$raw));
        if ($v === '') continue;
        if (in_array($v, ['1', 'true', 'yes', 'on', 'dev', 'development', 'local', 'debug'], true)) return true;
        if (in_array($v, ['0', 'false', 'no', 'off', 'prod', 'production'], true)) return false;
    }
    return false;
}

function apiLogThrowable(Throwable $e, string $scope = 'api'): string {
    try {
        $errorId = strtoupper($scope) . '-' . gmdate('YmdHis') . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
    } catch (Throwable $randErr) {
        $errorId = strtoupper($scope) . '-' . gmdate('YmdHis');
    }

    $trace = array_slice(array_map(
        fn($t) => basename((string)($t['file'] ?? '?')) . ':' . ((string)($t['line'] ?? '?')),
        $e->getTrace()
    ), 0, 8);

    error_log(sprintf(
        '[%s] %s in %s:%d | trace=%s',
        $errorId,
        $e->getMessage(),
        $e->getFile(),
        $e->getLine(),
        implode(' > ', $trace)
    ));

    return $errorId;
}

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
set_exception_handler(function (Throwable $e) {
    $errorId = apiLogThrowable($e, 'uncaught');
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');

    $payload = [
        'ok' => false,
        'message' => '서버 처리 중 오류가 발생했습니다.',
        'error_id' => $errorId,
    ];

    if (apiShouldExposeDebug()) {
        $payload['message'] = $e->getMessage();
        $payload['file'] = basename($e->getFile()) . ':' . $e->getLine();
        $payload['trace'] = array_slice(array_map(fn($t) => basename($t['file'] ?? '?') . ':' . ($t['line'] ?? '?'), $e->getTrace()), 0, 5);
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
});

require_once __DIR__ . '/vendor/autoload.php';

// ====== Load Library Files ======
require_once __DIR__ . '/lib/config.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/jwt_helper.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/solana.php';
require_once __DIR__ . '/lib/fx.php';
require_once __DIR__ . '/lib/mailer.php';
require_once __DIR__ . '/lib/migrations.php';
require_once __DIR__ . '/lib/silica.php';
require_once __DIR__ . '/lib/notifications.php';

// Handle CORS first
handleCors();

// Rate limiting
rateLimit(240);

// Parse the request path
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($requestUri, PHP_URL_PATH);

// Remove trailing slash
$path = rtrim($path, '/');

// Method
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Guard duplicate write submissions (double click / repeated submit)
guardDuplicateWriteRequest($method, $path);

// ====== Route Matching ======
// Simple pattern matching with :param support

function matchRoute(string $pattern, string $path): ?array {
    $patternParts = explode('/', trim($pattern, '/'));
    $pathParts = explode('/', trim($path, '/'));

    if (count($patternParts) !== count($pathParts)) return null;

    $params = [];
    for ($i = 0; $i < count($patternParts); $i++) {
        if (str_starts_with($patternParts[$i], ':')) {
            $params[substr($patternParts[$i], 1)] = $pathParts[$i];
        } elseif ($patternParts[$i] !== $pathParts[$i]) {
            return null;
        }
    }
    return $params;
}

// ====== Route Registry ======
$routes = [];

function get(string $pattern, callable $handler): void {
    global $routes;
    $routes[] = ['GET', $pattern, $handler];
}

function post(string $pattern, callable $handler): void {
    global $routes;
    $routes[] = ['POST', $pattern, $handler];
}

function delete_route(string $pattern, callable $handler): void {
    global $routes;
    $routes[] = ['DELETE', $pattern, $handler];
}

// ====== Load All Route Files ======
require_once __DIR__ . '/routes/public.php';
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/otp.php';
require_once __DIR__ . '/routes/assets.php';
require_once __DIR__ . '/routes/sales.php';
require_once __DIR__ . '/routes/contracts.php';
require_once __DIR__ . '/routes/funding.php';
require_once __DIR__ . '/routes/staking.php';
require_once __DIR__ . '/routes/swap.php';
require_once __DIR__ . '/routes/markets.php';
require_once __DIR__ . '/routes/portfolio.php';
require_once __DIR__ . '/routes/notifications.php';
require_once __DIR__ . '/routes/deposit_withdraw.php';
require_once __DIR__ . '/routes/kyc.php';
require_once __DIR__ . '/routes/user_profile.php';
require_once __DIR__ . '/routes/token_withdraw.php';
require_once __DIR__ . '/routes/admin_auth.php';
require_once __DIR__ . '/routes/admin_assets.php';
require_once __DIR__ . '/routes/admin_sales.php';
require_once __DIR__ . '/routes/admin_settings.php';
require_once __DIR__ . '/routes/admin_users.php';
require_once __DIR__ . '/routes/admin_dashboard.php';
require_once __DIR__ . '/routes/admin_accounting.php';
require_once __DIR__ . '/routes/admin_contracts.php';
require_once __DIR__ . '/routes/admin_withdraw.php';
require_once __DIR__ . '/routes/admin_deposit.php';
require_once __DIR__ . '/routes/admin_fx.php';
require_once __DIR__ . '/routes/admin_token_withdraw.php';
require_once __DIR__ . '/routes/admin_referrals.php';
require_once __DIR__ . '/routes/admin_emails.php';
require_once __DIR__ . '/routes/referrals.php';
require_once __DIR__ . '/routes/notices.php';
require_once __DIR__ . '/routes/legal_terms.php';

// === Silica-specific routes (Phase B) ===
require_once __DIR__ . '/routes/admin_silica_tokens.php';
require_once __DIR__ . '/routes/admin_silica_price.php';
require_once __DIR__ . '/routes/admin_silica_rate.php';
require_once __DIR__ . '/routes/admin_silica_dividend.php';
require_once __DIR__ . '/routes/admin_silica_popups.php';
require_once __DIR__ . '/routes/admin_silica_supply.php';
// (2026-05-15 v394) Wind-down 운영 종료 절차 — 약관 v392 제10조 시스템화.
require_once __DIR__ . '/routes/admin_silica_winddown.php';

// ====== Dispatch ======
foreach ($routes as [$routeMethod, $routePattern, $routeHandler]) {
    if ($method !== $routeMethod) continue;
    $params = matchRoute($routePattern, $path);
    if ($params !== null) {
        try {
            $routeHandler($params);
        } catch (Throwable $e) {
            $status = 500;
            if (property_exists($e, 'status')) {
                $candidate = $e->status;
                if (is_numeric($candidate)) {
                    $candidate = (int)$candidate;
                    if ($candidate >= 400 && $candidate < 600) $status = $candidate;
                }
            }
            if (method_exists($e, 'getCode')) {
                $candidate = $e->getCode();
                if (is_numeric($candidate)) {
                    $candidate = (int)$candidate;
                    if ($candidate >= 400 && $candidate < 600) $status = $candidate;
                }
            }
            if ($status >= 500 && !apiShouldExposeDebug()) {
                $errorId = apiLogThrowable($e, 'route');
                jsonError($status, '서버 처리 중 오류가 발생했습니다.', ['error_id' => $errorId]);
            }
            jsonError($status, $e->getMessage());
        }
        exit;
    }
}

// No route matched
jsonError(404, 'Not Found');
