<?php
/**
 * RWA Platform - Configuration
 * Loads .env values and defines constants
 */

// Load .env file if exists
// (2026-05-26 v830) 다중 위치 탐색은 index.php 의 silicaFindEnvFile() 가
//   이미 수행 (배포 zone 밖 우선). 여기선 동일 헬퍼 재사용. 헬퍼가 없으면
//   legacy 경로 fallback (직접 호출 / CLI 모드 등 비-HTTP 진입 경로 호환).
if (function_exists('silicaFindEnvFile') && function_exists('silicaParseEnvFile')) {
    $envFile = silicaFindEnvFile();
    if ($envFile) silicaParseEnvFile($envFile);
} else {
    $envFile = dirname(__DIR__) . '/.env';
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            if (str_contains($line, '=')) {
                [$key, $value] = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                    (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                    $value = substr($value, 1, -1);
                }
                if (!isset($_ENV[$key]) && getenv($key) === false) {
                    putenv("$key=$value");
                    $_ENV[$key] = $value;
                }
            }
        }
    }
}

function env(string $key, $default = ''): string {
    return $_ENV[$key] ?? getenv($key) ?: (string)$default;
}

function envBool(string $key): bool {
    $v = strtolower(trim(env($key, '')));
    return in_array($v, ['1', 'true', 'yes', 'on'], true);
}

// --- Constants ---
define('NODE_ENV', env('NODE_ENV', 'production'));
define('TZ', 'Asia/Seoul');
date_default_timezone_set('UTC'); // internal UTC, display KST

define('DB_HOST', env('DB_HOST', 'localhost'));
define('DB_PORT', (int)env('DB_PORT', '3306'));
define('DB_USER', env('DB_USER', ''));
define('DB_PASS', env('DB_PASSWORD', ''));
define('DB_NAME', env('DB_NAME', ''));

define('JWT_SECRET', env('JWT_SECRET', ''));
define('ADMIN_JWT_SECRET', env('ADMIN_JWT_SECRET', JWT_SECRET));
define('ADMIN_KEY', env('ADMIN_KEY', ''));

// (2026-05-19 v583) 관리자 지갑 화이트리스트 — 운영자 요청: '관리자 페이지는
//   계정 + 지정된 관리자 지갑 주소만 접근 가능. 다중 계정 허용.'
//   .env 의 ADMIN_WALLET_ADDRESSES 에 쉼표로 구분된 Solana 주소 목록.
//   값이 비어 있으면 기존 동작 유지 (whitelist 비활성 — 어떤 지갑이든 OK).
//   값이 있으면 모든 admin API 호출에 X-Admin-Wallet 가 이 목록에 포함된
//   주소여야 함. JWT/ADMIN_KEY 인증과 결합되는 2-factor 게이트.
define('ADMIN_WALLET_ADDRESSES', array_values(array_filter(array_map(
    fn($s) => trim((string)$s),
    explode(',', (string)env('ADMIN_WALLET_ADDRESSES', ''))
), fn($s) => $s !== '')));

define('BYPASS_OTP', envBool('BYPASS_OTP'));
define('BYPASS_KYC', envBool('BYPASS_KYC'));

// (audit H2-1 fix · 2026-06-12) 자동 DB 마이그레이션 on/off 스위치.
//   기본값 true — 미설정 시 현 동작 100% 유지 (비파괴). 명시적으로
//   0/false/no/off 일 때만 끈다 (envBool 은 미설정 시 false 라 여기엔 부적합).
//   끄면: autoMigrate (db.php 인라인 DDL) + lazyApply (admin 로그인 시 sql/
//        패치 자동적용) 두 자동 경로가 정지.
//   끈 상태에서 배포 후 적용: 수동 POST/GET /api/admin/db/migrate (adminOnly)
//        → applyPendingMigrations + DB::runAutoMigrateNow() 강제 실행.
//   주의: 끄면 "배포 시 수동 마이그레이션 실행" 이 필수 절차가 된다.
define('AUTO_MIGRATE_ENABLED', !in_array(
    strtolower(trim(env('AUTO_MIGRATE_ENABLED', 'true'))),
    ['0', 'false', 'no', 'off'],
    true
));

// (2026-06-07 v862) Helius RPC URL — 네트워크별 분리 보관.
//   silica.env 에 두 키 모두 입력해두고, admin 패널의 Solana 네트워크
//   선택값에 따라 lib/solana.php getEffectiveRpcUrl() 가 매칭되는 키를
//   자동으로 사용한다.
//
//   우선순위:
//     1) DB setting `solana_rpc_url` (admin 패널의 RPC URL 직접 입력)
//     2) 현재 network 와 매칭되는 env 키
//        - mainnet-beta → HELIUS_RPC_URL_MAINNET
//        - devnet       → HELIUS_RPC_URL_DEVNET
//        - testnet      → HELIUS_RPC_URL_TESTNET
//     3) Legacy 단일 env HELIUS_RPC_URL (네트워크 inference 통과 시)
//     4) 공식 public RPC (getDefaultSolanaRpcUrl)
//
//   운영 흐름:
//     - silica.env 양쪽 키 채워두면 admin 패널 RPC URL 필드 비워둔 채
//       네트워크만 토글해서 안전하게 전환 가능.
//     - admin 패널 RPC URL 필드는 응급 override 용도로만 사용.
define('HELIUS_RPC_URL',         env('HELIUS_RPC_URL', ''));
define('HELIUS_RPC_URL_MAINNET', env('HELIUS_RPC_URL_MAINNET', ''));
define('HELIUS_RPC_URL_DEVNET',  env('HELIUS_RPC_URL_DEVNET', ''));
define('HELIUS_RPC_URL_TESTNET', env('HELIUS_RPC_URL_TESTNET', ''));

define('CORS_ORIGINS', array_filter(array_map('trim', explode(',', env('CORS_ORIGIN', '')))));

define('UPLOAD_DIR', env('UPLOAD_DIR', dirname(__DIR__) . '/uploads'));
define('PUBLIC_DIR', env('PUBLIC_DIR', dirname(dirname(__DIR__))));

define('STAKING_PAYDAY', 15);
define('STAKING_LOCK_DAYS', [14, 15, 16]);

// (2026-05-12 v320) 운영자: '관리자가 13일 23시59분에 이것을 할 수 있다.
//   따라서 나는 10일 부터 16일 까지는 관리자가 배당급 값을 진입 할 수
//   없도록 막아야 한다고 생각한다. 16일 까지 두는 이유는 시스템오류
//   또는 향후 온체인으로 웹을 업데이트 할 때 하루 정도 여유를 주어
//   안정장치로 두는 목적이다.'
// Cooling window for dividend admin writes — covers 4-day buffer before
// the staking lock window plus the lock itself plus one day after for
// system maintenance / on-chain confirmation. Reads (GET) + cancellation
// are still allowed during this window (cancellation is the emergency
// lever; closing it would trap operators if a mistake is discovered
// inside the window).
//
// (2026-05-12 v321) 운영자: '현재 나는 배당금 지급 테스팅을 해야하기 때문에
//   10일 부터 16일이 아닌 14일 부터 16일로 바꾸어줘. 테스팅 후 다시 10일
//   부터 16일로 변경.'
// (2026-05-12 v327) 운영자: '이제 배당금 진입은 10일 부터 16일 까지 할 수
//   없도록 막아라.' Testing done — restored to the original 7-day buffer.
// (2026-05-13 v333) 운영자: '[14,15,16] 으로 좁혀서 즉시 테스트 가능한
//   상태로 만들어' — 진단 결과 db_total=0 으로 이전 POST 가 한 번도 성공
//   하지 못했음이 확인됨. 다시 임시로 좁혀 오늘(5/13 = day 13)이 윈도우
//   밖이 되도록.
// TEMPORARY — narrowed to [14,15,16] for live testing. Revert to the full
// 7-day window once dividend payout has been validated end-to-end.
// >>> TODO(post-test): restore to [10,11,12,13,14,15,16] <<<
define('DIVIDEND_ADMIN_LOCK_DAYS', [14, 15, 16]);

// Default USDT mint (mainnet). Can be overridden via admin settings for devnet testing.
define('USDT_MINT_DEFAULT', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
define('USDT_MINT', env('USDT_MINT', USDT_MINT_DEFAULT));
define('TOKEN_PROGRAM_ID', 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
// (2026-06-07 v870) SPL Token 2022 — TokenKeg 의 superset. 동일 instruction
//   discriminator (transferChecked=0x0c) + 추가 기능 (transfer hooks 등).
//   mainnet 의 일부 토큰 (특히 새로 deploy 되는 RWA / stablecoin) 이
//   Token 2022 program 사용. validate 시 SPL Token 과 동일 정책 적용.
define('TOKEN_2022_PROGRAM_ID', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
define('ASSOCIATED_TOKEN_PROGRAM_ID', 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
define('MEMO_PROGRAM_ID', 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
// (2026-05-26 v852) ComputeBudget — Phantom / Solana CLI 등 wallet 이 자동
//   추가하는 priority fee / compute unit 한도 설정용 program. 자금 이동과
//   무관하고 모든 instruction (SetComputeUnitLimit, SetComputeUnitPrice,
//   RequestHeapFrame 등) 이 단순 fee 메타 설정 → 화이트리스트 안전.
define('COMPUTE_BUDGET_PROGRAM_ID', 'ComputeBudget111111111111111111111111111111');

// (2026-06-07 v872) Lighthouse — Phantom 지갑이 transaction 안전 검증용으로
//   자동 삽입하는 assertion-only program. 사용자가 의도한 결과 (예: "이
//   instruction 후 잔액이 정확히 X 만큼 차감되어야 함") 가 실제로 일어나는지
//   on-chain 에서 검증. 검증 실패 시 트랜잭션 전체 revert.
//
//   특성:
//     - read-only assertion 만 수행 — 자금 이동 instruction 자체가 없음
//     - 모든 instruction 은 AssertXxx (AssertAccountInfo, AssertTokenAccountField,
//       AssertSysvarClock 등) — 실패하면 tx revert
//     - 공식 repo: https://github.com/Jac0xb/lighthouse
//
//   따라서 자금 이동이 불가능한 안전한 program → 화이트리스트 허용.
//   허용하지 않으면 Phantom 이 자동 삽입한 안전장치 때문에 정상 deposit 도
//   disallowed_program 으로 거부됨.
define('LIGHTHOUSE_PROGRAM_ID', 'L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95');
define('USDT_DECIMALS', 6);

// Platform AMM address — AMM이 축적한 토큰을 장부상 보유하는 내부 주소.
// 온체인 지갑이 아니라 holdings/balances 테이블의 식별자로만 사용됨.
// .env 의 PLATFORM_AMM_ADDRESS 로 재정의 가능. 기본값은 base58 sentinel.
define('PLATFORM_AMM_ADDRESS_DEFAULT', 'AMMpooL1111111111111111111111111111111111111');
define('PLATFORM_AMM_ADDRESS', env('PLATFORM_AMM_ADDRESS', PLATFORM_AMM_ADDRESS_DEFAULT));

// Silica 단순 상태머신 (2026-05-05) ─────────────────────────────────────────
//   ACTIVE              — 정상 운영. 투자/스테이킹 모두 가능. 기본 상태.
//   SOLD                — 광산 외부 매각 진행. 신규 투자 차단, 매각대금 분배 처리 중.
//   SALE_DISTRIBUTED    — 매각대금 전액 분배 완료. 라이프사이클 종료.
// RECON 다중자산 잔재(FUNDING/BUYING/DISTRIBUTING/OPERATING/FAILED/CANCELED)는
// 마이그레이션 호환을 위해 키만 유지(값은 동일)하며, 새 코드 경로에서는
// 모두 ACTIVE 로 흡수된다. 신규 로직은 ACTIVE/SOLD/SALE_DISTRIBUTED 만 참조.
define('STATUSES', [
    // ── 새 단순 상태 ──
    'ACTIVE'           => '활성',
    'SOLD'             => '매각',
    'SALE_DISTRIBUTED' => '매각(완료)',

    // ── Legacy aliases (DB ENUM 마이그레이션 기간 호환) ──
    // 모두 ACTIVE 로 흡수되어야 하므로 새 비교식에서는 사용 금지.
    'FUNDING'      => '활성',
    'BUYING'       => '활성',
    'DISTRIBUTING' => '활성',
    'OPERATING'    => '활성',
    'FAILED'       => '취소됨',
    'CANCELED'     => '취소됨',
]);

define('COUNTRIES', [
    // (2026-05-17 v447) 운영자 보고: 영문 contract 본문에 'Country: 대한민국'
    //   한국어로 박힘. name_en 컬럼 추가 → contract draft 생성 시 사용자 lang 별
    //   매핑 선택.
    ['code' => 'KR', 'name' => '대한민국',    'name_en' => 'Republic of Korea'],
    ['code' => 'US', 'name' => '미국',        'name_en' => 'United States'],
    ['code' => 'KZ', 'name' => '카자흐스탄',  'name_en' => 'Kazakhstan'],
    ['code' => 'PH', 'name' => '필리핀',      'name_en' => 'Philippines'],
    ['code' => 'GE', 'name' => '조지아',      'name_en' => 'Georgia'],
    ['code' => 'ID', 'name' => '인도네시아',  'name_en' => 'Indonesia'],
    ['code' => 'VN', 'name' => '베트남',      'name_en' => 'Vietnam'],
]);

define('COUNTRY_NAME_MAP',    array_column(COUNTRIES, 'name',    'code'));
define('COUNTRY_NAME_MAP_EN', array_column(COUNTRIES, 'name_en', 'code'));

define('CURRENCIES', ['KRW', 'USD', 'KZT', 'PHP', 'GEL', 'IDR', 'VND', 'USDT']);

define('FX_KEY', [
    'KRW' => 'fx_krw_per_usdt',
    'USD' => 'fx_usd_per_usdt',
    'KZT' => 'fx_kzt_per_usdt',
    'PHP' => 'fx_php_per_usdt',
    'GEL' => 'fx_gel_per_usdt',
    'IDR' => 'fx_idr_per_usdt',
    'VND' => 'fx_vnd_per_usdt',
]);

define('TRADEABLE_STATUSES', [STATUSES['DISTRIBUTING'], STATUSES['OPERATING']]);

// Mail (Hostinger)
define('MAIL_FROM', env('MAIL_FROM', 'noreply@rwa6.kolstoken.com'));
define('MAIL_FROM_NAME', env('MAIL_FROM_NAME', 'RECON RWA'));
define('MAIL_VERIFY_BASE_URL', rtrim(env('MAIL_VERIFY_BASE_URL', env('PUBLIC_BASE_URL', '')), '/'));

// KYC
define('KYC_MODE', strtolower(trim(env('KYC_MODE', 'didit'))));
define('DIDIT_API_KEY', env('DIDIT_API_KEY', ''));
define('DIDIT_WORKFLOW_ID', env('DIDIT_WORKFLOW_ID', ''));
define('PUBLIC_BASE_URL', rtrim(env('PUBLIC_BASE_URL', ''), '/'));
define('KYC_STUCK_MAX_SEC', max(10, (int)env('KYC_STUCK_MAX_SEC', '60')));
define('KYC_REVIEW_MAX_SEC', max(10, (int)env('KYC_REVIEW_MAX_SEC', '90')));

// Ensure upload directory exists
if (!is_dir(UPLOAD_DIR)) {
    @mkdir(UPLOAD_DIR, 0755, true);
}

// (2026-05-18 v546) Security: boot-time validation of critical secrets.
//   Non-blocking — logs warnings rather than crashing so the operator
//   notices in error_log without breaking the live service. Each
//   warning is throttled to once per request via a static flag.
//   감지 대상:
//     - JWT_SECRET 비어있음 / 32바이트 미만 / 'CHANGE_ME' 등 placeholder
//     - ADMIN_JWT_SECRET 가 JWT_SECRET 와 동일 (fallback 사용 = 별도 키 없음)
//     - CORS_ORIGINS 미설정 / 와일드카드 / http:// (HTTPS 외부 원본)
function securityBootValidate(): void {
    static $done = false;
    if ($done) return;
    $done = true;

    $weakPlaceholders = ['CHANGE_ME', 'YOUR_', 'SECRET', 'PLEASE_CHANGE', 'TODO'];
    $isWeak = function (string $secret) use ($weakPlaceholders): array {
        if ($secret === '') return ['weak' => true, 'reason' => 'empty'];
        if (strlen($secret) < 32) return ['weak' => true, 'reason' => 'too_short (' . strlen($secret) . ' bytes, recommend 32+)'];
        foreach ($weakPlaceholders as $p) {
            if (stripos($secret, $p) !== false) {
                return ['weak' => true, 'reason' => 'placeholder ("' . $p . '" detected)'];
            }
        }
        return ['weak' => false, 'reason' => ''];
    };

    // 1. JWT_SECRET 점검
    $j = $isWeak(JWT_SECRET);
    if ($j['weak']) {
        error_log('[security][BOOT] JWT_SECRET is weak: ' . $j['reason']
            . '. Generate with: php -r "echo bin2hex(random_bytes(32));"');
    }

    // 2. ADMIN_JWT_SECRET 점검
    $a = $isWeak(ADMIN_JWT_SECRET);
    if ($a['weak']) {
        error_log('[security][BOOT] ADMIN_JWT_SECRET is weak: ' . $a['reason']
            . '. Set a separate strong value in .env');
    }

    // 3. ADMIN_JWT_SECRET 와 JWT_SECRET 가 동일하면 경고 (분리 권장)
    if (JWT_SECRET !== '' && ADMIN_JWT_SECRET === JWT_SECRET) {
        error_log('[security][BOOT] ADMIN_JWT_SECRET shares JWT_SECRET (fallback). '
            . 'Recommended: set distinct ADMIN_JWT_SECRET in .env to limit blast radius if user JWT secret leaks.');
    }

    // 4. CORS_ORIGINS 점검
    if (empty(CORS_ORIGINS)) {
        error_log('[security][BOOT] CORS_ORIGIN env var is empty. '
            . 'Cross-origin requests will be rejected (safe default), but if any external integration exists set the proper allowlist.');
    } else {
        foreach (CORS_ORIGINS as $o) {
            if ($o === '*') {
                error_log('[security][BOOT] CORS_ORIGIN contains "*" wildcard — allows ANY origin. Replace with explicit domain allowlist.');
            } elseif (stripos($o, 'http://') === 0) {
                error_log('[security][BOOT] CORS_ORIGIN includes non-HTTPS origin "' . $o . '" — accept only HTTPS in production.');
            }
        }
    }
}
securityBootValidate();
