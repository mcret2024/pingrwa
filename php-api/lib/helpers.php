<?php
/**
 * RWA Platform - Helper Functions
 */

// ====== JSON Response ======
function jsonResponse(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// (2026-05-18 v573) Auto-detect arg order. Documented signature is
//   jsonError(int $status, string $message) but a significant portion of the
//   codebase (admin_silica_dividend.php, admin_silica_tokens.php, etc — 56
//   sites at last count) calls it with reversed args: jsonError('msg', 400).
//   On PHP 8.x the implicit string→int coercion is a deprecation, and
//   index.php installs a `set_error_handler` that promotes deprecations to
//   ErrorException. The result: reversed-arg calls explode into a generic
//   500 'ROUTE-...' instead of returning the intended 4xx — operator hit
//   this while testing the distribute-dividends cron (lock-window rejection
//   surfaced as a 500). Normalising here is faster and safer than touching
//   56 individual callsites.
function jsonError($a, $b = null, ?array $extra = null): void {
    if (is_int($a) && (is_string($b) || $b === null)) {
        $status = $a;
        $message = (string)($b ?? '');
    } elseif (is_string($a) && is_int($b)) {
        // reversed args — swap.
        $status = $b;
        $message = $a;
    } else {
        // Best-effort fallback.
        $status = is_numeric($a) ? (int)$a : (is_numeric($b) ? (int)$b : 500);
        $message = is_string($a) ? $a : (is_string($b) ? $b : 'unknown error');
    }
    $data = ['ok' => false, 'message' => $message];
    if ($extra) $data = array_merge($data, $extra);
    jsonResponse($data, $status);
}

function jsonOk(array $data = []): void {
    jsonResponse(array_merge(['ok' => true], $data));
}

// ====== i18n: per-request locale helpers ======
/**
 * (2026-05-08) Resolve the active locale from the incoming request.
 *   Site policy: only EN and KO are supported. Default is EN. Frontend
 *   RwaCore.api() sends X-RWA-Lang on every /api/* call; body / query
 *   are accepted as legacy paths. Anything other than 'ko' (including
 *   stale 'ja' / 'zh' values from earlier multi-locale builds) collapses
 *   to 'en'.
 */
if (!function_exists('requestLocale')) {
    function requestLocale(): string {
        $body = function_exists('getJsonBody') ? @getJsonBody() : [];
        $raw = strtolower(trim((string)(
            ($body['lang'] ?? null)
            ?? ($_SERVER['HTTP_X_RWA_LANG'] ?? null)
            ?? ($_GET['lang'] ?? '')
        )));
        return $raw === 'ko' ? 'ko' : 'en';
    }
}

/**
 * Pick a localized message string from a 4-locale array, falling back
 * through en → ko → first available so a missing translation never
 * collapses the message to an empty string.
 */
if (!function_exists('pickLocaleMsg')) {
    function pickLocaleMsg(array $msgs): string {
        $loc = requestLocale();
        $val = $msgs[$loc] ?? $msgs['en'] ?? $msgs['ko'] ?? '';
        if (!is_string($val) && $msgs) {
            // Defensive: if a non-string crept in, fall back to first scalar.
            foreach ($msgs as $m) {
                if (is_string($m)) return $m;
            }
            return '';
        }
        return (string)$val;
    }
}

// ====== Request Helpers ======
function getRawRequestBody(): string {
    static $rawBody = null;
    if ($rawBody === null) {
        $body = file_get_contents('php://input');
        $rawBody = is_string($body) ? $body : '';
    }
    return $rawBody;
}

function getJsonBody(): array {
    $raw = getRawRequestBody();
    if ($raw === '') {
        error_log("[getJsonBody] empty body. content-length=" . ($_SERVER['CONTENT_LENGTH'] ?? 'N/A'));
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        error_log("[getJsonBody] json_decode failed. raw.len=" . strlen($raw) . " error=" . json_last_error_msg() . " preview=" . substr($raw, 0, 120));
        return [];
    }
    return $data;
}

function normalizeIdempotencyValue($value) {
    if (is_array($value)) {
        $isList = array_keys($value) === range(0, count($value) - 1);
        if (!$isList) {
            ksort($value);
        }
        $out = [];
        foreach ($value as $k => $v) {
            $out[$isList ? $k : (string)$k] = normalizeIdempotencyValue($v);
        }
        return $out;
    }
    if (is_object($value)) {
        return normalizeIdempotencyValue(get_object_vars($value));
    }
    if ($value === null || is_bool($value) || is_int($value) || is_float($value) || is_string($value)) {
        return $value;
    }
    return (string)$value;
}

function normalizeUploadedFilesFingerprint(array $files): array {
    $normalized = [];
    foreach ($files as $field => $meta) {
        if (!is_array($meta)) continue;

        if (isset($meta['name']) && is_array($meta['name'])) {
            $entries = [];
            $names = $meta['name'];
            $sizes = $meta['size'] ?? [];
            $types = $meta['type'] ?? [];
            $errors = $meta['error'] ?? [];
            foreach ($names as $idx => $name) {
                $entries[] = [
                    'name' => (string)($name ?? ''),
                    'size' => (int)($sizes[$idx] ?? 0),
                    'type' => (string)($types[$idx] ?? ''),
                    'error' => (int)($errors[$idx] ?? 0),
                ];
            }
            $normalized[(string)$field] = $entries;
            continue;
        }

        $normalized[(string)$field] = [
            'name' => (string)($meta['name'] ?? ''),
            'size' => (int)($meta['size'] ?? 0),
            'type' => (string)($meta['type'] ?? ''),
            'error' => (int)($meta['error'] ?? 0),
        ];
    }
    ksort($normalized);
    return $normalized;
}

function requestContentFingerprint(): array {
    $contentType = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? ''), 2)[0]));
    if ($contentType === 'application/json' || $contentType === 'text/json') {
        $data = getJsonBody();
        if ($data !== []) {
            return ['json' => normalizeIdempotencyValue($data)];
        }
        $raw = getRawRequestBody();
        if ($raw !== '') {
            return ['json_raw_sha256' => hash('sha256', $raw), 'length' => strlen($raw)];
        }
        return ['json' => []];
    }

    if ($contentType === 'multipart/form-data' || $contentType === 'application/x-www-form-urlencoded') {
        return [
            'post' => normalizeIdempotencyValue($_POST ?? []),
            'files' => normalizeUploadedFilesFingerprint($_FILES ?? []),
        ];
    }

    $raw = getRawRequestBody();
    if ($raw === '') {
        return ['empty' => true];
    }

    return [
        'raw_sha256' => hash('sha256', $raw),
        'length' => strlen($raw),
    ];
}

function requestActorFingerprint(): string {
    $authorization = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
    if (str_starts_with($authorization, 'Bearer ')) {
        $token = trim(substr($authorization, 7));
        if ($token !== '') {
            $userDecoded = decodeJwt($token, JWT_SECRET);
            if ($userDecoded && !empty($userDecoded['address'])) {
                return 'user:' . strtolower((string)$userDecoded['address']);
            }
            $adminDecoded = decodeJwt($token, ADMIN_JWT_SECRET);
            if ($adminDecoded && ($adminDecoded['role'] ?? '') === 'admin') {
                return 'admin:' . strtolower((string)($adminDecoded['username'] ?? 'admin'));
            }
            return 'bearer:' . substr(hash('sha256', $token), 0, 24);
        }
    }

    $wallet = strtolower(trim((string)($_SERVER['HTTP_X_WALLET'] ?? '')));
    if ($wallet !== '') {
        return 'wallet:' . $wallet;
    }

    $adminKey = trim((string)($_SERVER['HTTP_X_ADMIN_KEY'] ?? ''));
    if ($adminKey !== '') {
        return 'admin-key:' . substr(hash('sha256', $adminKey), 0, 24);
    }

    $ip = trim(getReqIp());
    if ($ip !== '') {
        return 'ip:' . $ip;
    }

    return 'guest';
}

function buildRequestIdempotencyKey(string $method, string $path): string {
    $headerKey = trim((string)($_SERVER['HTTP_X_IDEMPOTENCY_KEY'] ?? ''));
    if ($headerKey !== '') {
        $headerKey = preg_replace('/[^a-zA-Z0-9:_\-.]/', '', $headerKey);
        if ($headerKey !== '') {
            return 'hdr:' . substr($headerKey, 0, 190);
        }
    }

    $payload = [
        'method' => strtoupper($method),
        'path' => (string)$path,
        'actor' => requestActorFingerprint(),
        'content' => requestContentFingerprint(),
    ];

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        $json = serialize($payload);
    }

    return 'fp:' . hash('sha256', (string)$json);
}

function requestGuardDir(): string {
    static $dir = null;
    if ($dir !== null) return $dir;

    $dir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'rwa_request_guard';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function releaseWriteRequestGuard(): void {
    $lock = $GLOBALS['__rwa_write_request_guard'] ?? null;
    if (!is_array($lock)) return;

    $fh = $lock['fh'] ?? null;
    if (is_resource($fh)) {
        @flock($fh, LOCK_UN);
        @fclose($fh);
    }

    unset($GLOBALS['__rwa_write_request_guard']);
}

function guardDuplicateWriteRequest(string $method, string $path): void {
    $unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!in_array(strtoupper($method), $unsafeMethods, true)) return;

    $idempotencyKey = buildRequestIdempotencyKey($method, $path);
    $lockFile = requestGuardDir() . DIRECTORY_SEPARATOR . hash('sha256', $idempotencyKey) . '.lock';
    $fh = @fopen($lockFile, 'c+');
    if (!$fh) return;

    if (!@flock($fh, LOCK_EX | LOCK_NB)) {
        @fclose($fh);
        jsonError(409, '동일 요청을 처리 중입니다. 잠시만 기다려 주세요.', [
            'code' => 'duplicate_inflight',
        ]);
    }

    $GLOBALS['__rwa_write_request_guard'] = [
        'fh' => $fh,
        'key' => $idempotencyKey,
        'path' => $path,
    ];

    @ftruncate($fh, 0);
    @fwrite($fh, json_encode([
        'key' => $idempotencyKey,
        'path' => $path,
        'method' => strtoupper($method),
        'at' => gmdate('c'),
        'ip' => getReqIp(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    @fflush($fh);

    if (empty($GLOBALS['__rwa_write_request_guard_shutdown_registered'])) {
        $GLOBALS['__rwa_write_request_guard_shutdown_registered'] = true;
        register_shutdown_function('releaseWriteRequestGuard');
    }
}

function getReqIp(): string {
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($xff) return trim(explode(',', $xff)[0]);
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

function getReqUserAgent(): string {
    return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
}

// ====== KST Time Helpers ======
function nowKST(): DateTimeImmutable {
    return new DateTimeImmutable('now', new DateTimeZone(TZ));
}

function todayKST(): string {
    return nowKST()->format('Y-m-d');
}

function dayOfMonthKST(): int {
    return (int)nowKST()->format('j');
}

function monthKeyKST(): string {
    return nowKST()->format('Y-m');
}

if (!function_exists('parseUtcDateTimeToKST')) {
    function parseUtcDateTimeToKST(?string $value): ?DateTimeImmutable {
        $raw = trim((string)$value);
        if ($raw === '') return null;

        $utc = new DateTimeZone('UTC');
        $kst = new DateTimeZone(TZ);
        $formats = [
            'Y-m-d H:i:s',
            'Y-m-d\TH:i:s',
            'Y-m-d\TH:i:sP',
            DateTimeInterface::ATOM,
            DateTimeInterface::RFC3339,
        ];

        foreach ($formats as $format) {
            $dt = DateTimeImmutable::createFromFormat($format, $raw, $utc);
            if ($dt instanceof DateTimeImmutable) {
                return $dt->setTimezone($kst);
            }
        }

        try {
            return (new DateTimeImmutable($raw, $utc))->setTimezone($kst);
        } catch (Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('parseYmdDateToKST')) {
    function parseYmdDateToKST(?string $value): ?DateTimeImmutable {
        $raw = trim((string)$value);
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $m)) return null;

        $year = (int)$m[1];
        $month = (int)$m[2];
        $day = (int)$m[3];
        if (!checkdate($month, $day, $year)) return null;

        $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $raw, new DateTimeZone(TZ));
        return $dt instanceof DateTimeImmutable ? $dt : null;
    }
}


if (!function_exists('isSoldLikeAssetStatus')) {
    function isSoldLikeAssetStatus(?string $status): bool {
        $s = trim((string)$status);
        return in_array($s, [STATUSES['SOLD'], '매각', '매각(완료)'], true);
    }
}

if (!function_exists('inferSaleExecutionState')) {
    function inferSaleExecutionState(?array $saleRow = null, ?array $asset = null, array $options = []): array {
        $sale = is_array($saleRow) ? $saleRow : [];
        $assetRow = is_array($asset) ? $asset : [];

        $executedAt = trim((string)($sale['executed_at'] ?? ''));
        $fixedFx = isset($sale['fixed_fx_per_usdt']) ? (float)$sale['fixed_fx_per_usdt'] : 0.0;
        $assetStatus = trim((string)($assetRow['status'] ?? ''));
        $displayStatus = trim((string)($assetRow['display_status'] ?? ''));
        $redeemCount = isset($options['redeem_count']) ? (int)$options['redeem_count'] : 0;
        $hasRedemptions = $redeemCount > 0 || !empty($options['has_redemptions']);

        $executed = false;
        $source = '';

        if ($executedAt !== '') {
            $executed = true;
            $source = 'executed_at';
        } elseif ($fixedFx > 0) {
            $executed = true;
            $source = 'fixed_fx';
        } elseif ($hasRedemptions) {
            $executed = true;
            $source = 'redemptions';
        } elseif (isSoldLikeAssetStatus($displayStatus !== '' ? $displayStatus : $assetStatus)) {
            $executed = true;
            $source = 'asset_status_sold';
        }

        return [
            'executed' => $executed,
            'source' => $source,
            'executed_at' => $executedAt !== '' ? $executedAt : null,
            'fixed_fx_per_usdt' => $fixedFx > 0 ? clamp6($fixedFx) : 0.0,
            'asset_status' => $assetStatus,
            'display_status' => $displayStatus,
            'redeem_count' => $redeemCount,
        ];
    }
}

if (!function_exists('resolveSaleInterestPolicyContext')) {
    function resolveSaleInterestPolicyContext(?string $executedAtUtc = null, ?string $windowStart = null, ?string $plannedExecutionUtc = null): array {
        $payday = defined('STAKING_PAYDAY') ? (int)STAKING_PAYDAY : 15;
        if ($payday < 1) $payday = 15;

        $basisType = 'current_kst';
        $basisLabel = '매각실행일(KST)';
        $basis = parseUtcDateTimeToKST($executedAtUtc);

        if ($basis instanceof DateTimeImmutable) {
            $basisType = 'executed_at';
        } else {
            $basis = parseUtcDateTimeToKST($plannedExecutionUtc);
            if ($basis instanceof DateTimeImmutable) {
                $basisType = 'planned_execution';
            } else {
                $basis = parseYmdDateToKST($windowStart);
                if ($basis instanceof DateTimeImmutable) {
                    $basisType = 'window_start_fallback';
                    $basisLabel = '매각일';
                } else {
                    $basis = nowKST();
                }
            }
        }

        $basisDay = (int)$basis->format('j');
        $keepCurrentMonth = ($basisDay >= $payday);
        $cancelFrom = $keepCurrentMonth
            ? $basis->modify('first day of next month')
            : $basis->modify('first day of this month');

        return [
            'payday' => $payday,
            'basis_type' => $basisType,
            'basis_label' => $basisLabel,
            'basis_date' => $basis->format('Y-m-d'),
            'basis_datetime_kst' => $basis->format('Y-m-d H:i:s'),
            'basis_month_key' => $basis->format('Y-m'),
            'basis_day' => $basisDay,
            'keep_current_month' => $keepCurrentMonth,
            'cancel_from_month' => $cancelFrom->format('Y-m'),
        ];
    }
}

function nowUtcSql(): string {
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
}

function isSettlementLock(): bool {
    return in_array(dayOfMonthKST(), STAKING_LOCK_DAYS, true);
}

function isInterestOpenToday(): bool {
    return dayOfMonthKST() === STAKING_PAYDAY;
}

// (2026-05-12 v320) Returns true when today's KST date is in the cooling
// window that blocks admin dividend writes (create / update). Cancellation
// stays open at all times as an emergency lever.
function isDividendAdminLocked(): bool {
    $days = defined('DIVIDEND_ADMIN_LOCK_DAYS') ? DIVIDEND_ADMIN_LOCK_DAYS : [];
    return in_array(dayOfMonthKST(), $days, true);
}

function dividendAdminLockBounds(): array {
    $days = defined('DIVIDEND_ADMIN_LOCK_DAYS') ? DIVIDEND_ADMIN_LOCK_DAYS : [];
    if (empty($days)) return ['min' => 0, 'max' => 0];
    return ['min' => min($days), 'max' => max($days)];
}

// ====== Settings Helpers ======
function getSetting(string $key, ?string $fallback = null): ?string {
    $row = DB::fetchOne("SELECT `value` FROM settings WHERE `key`=?", [$key]);
    return $row ? $row['value'] : $fallback;
}

function setSetting(string $key, string $value): void {
    DB::execute(
        "INSERT INTO settings(`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)",
        [$key, $value]
    );
}


function getWithdrawFeeMode(): string {
    $mode = strtolower(trim((string)(getSetting('withdraw_fee_mode', 'fixed_usdt') ?? 'fixed_usdt')));
    return in_array($mode, ['fixed_usdt', 'percent'], true) ? $mode : 'fixed_usdt';
}

function getWithdrawFeeFixedUsdt(): float {
    $fee = (float)(getSetting('withdraw_fee_usdt', '0') ?? '0');
    return (!is_finite($fee) || $fee < 0) ? 0.0 : clamp6($fee);
}

function getWithdrawFeePercent(): float {
    $pct = (float)(getSetting('withdraw_fee_percent', '0') ?? '0');
    return (!is_finite($pct) || $pct < 0) ? 0.0 : clamp6(min(99.999999, $pct));
}

function getWithdrawFeePolicy(): array {
    return [
        'mode' => getWithdrawFeeMode(),
        'withdraw_fee_usdt' => getWithdrawFeeFixedUsdt(),
        'withdraw_fee_percent' => getWithdrawFeePercent(),
    ];
}

/**
 * Withdrawal quote policy
 * - USDT + fixed fee: request amount is total debit, actual send = amount - fee
 * - USDT + percent : request amount is total debit, actual send = amount - amount*percent
 * - TOKEN + fixed fee: token amount is sent as requested, fixed USDT charged separately
 * - TOKEN + percent : requested token amount includes fee, actual send = amount - fee
 */
function computeWithdrawQuote(string $assetCode, float $requestedAmount): array {
    $assetCode = strtoupper(trim($assetCode));
    $requestedAmount = clamp6($requestedAmount);
    $policy = getWithdrawFeePolicy();
    $mode = $policy['mode'];
    $fixedUsdt = (float)$policy['withdraw_fee_usdt'];
    $percent = (float)$policy['withdraw_fee_percent'];

    $feeAmount = 0.0;
    $feeAsset = 'USDT';
    $netAmount = $requestedAmount;
    $extraDebitUsdt = 0.0;
    $totalDebited = $requestedAmount;

    if ($assetCode === 'USDT') {
        $feeAmount = $mode === 'percent'
            ? clamp6($requestedAmount * $percent / 100)
            : $fixedUsdt;
        $feeAsset = 'USDT';
        $netAmount = clamp6($requestedAmount - $feeAmount);
    } else {
        if ($mode === 'percent') {
            $feeAmount = clamp6($requestedAmount * $percent / 100);
            $feeAsset = $assetCode;
            $netAmount = clamp6($requestedAmount - $feeAmount);
        } else {
            $feeAmount = $fixedUsdt;
            $feeAsset = 'USDT';
            $netAmount = $requestedAmount;
            $extraDebitUsdt = $fixedUsdt;
        }
    }

    return [
        'mode' => $mode,
        'fee_value' => $mode === 'percent' ? $percent : $fixedUsdt,
        'fee_amount' => clamp6($feeAmount),
        'fee_asset' => $feeAsset,
        'net_amount' => clamp6($netAmount),
        'extra_debit_usdt' => clamp6($extraDebitUsdt),
        'total_debited' => clamp6($totalDebited),
    ];
}

// ====== Dynamic Bypass Checks (DB setting > .env fallback) ======
function isOtpBypassed(): bool {
    try {
        $dbVal = getSetting('bypass_otp', null);
        if ($dbVal !== null) {
            return in_array(strtolower(trim($dbVal)), ['1', 'true', 'yes', 'on'], true);
        }
    } catch (Throwable $e) {}
    return BYPASS_OTP;
}

function isKycBypassed(): bool {
    try {
        $dbVal = getSetting('bypass_kyc', null);
        if ($dbVal !== null) {
            return in_array(strtolower(trim($dbVal)), ['1', 'true', 'yes', 'on'], true);
        }
    } catch (Throwable $e) {}
    return BYPASS_KYC;
}



function decodeMaybeStoredText(?string $v): ?string {
    if ($v === null) return null;
    $s = trim((string)$v);
    if ($s === '') return null;
    $decoded = base64_decode($s, true);
    if ($decoded !== false && base64_encode($decoded) === $s) {
        return $decoded;
    }
    return $s;
}

function getUserKycRow(string $address): array {
    ensureUser($address);
    return DB::fetchOne(
        "SELECT address, kyc_yn, mt_name, mt_birth, kyc_doc_type, kyc_doc_regdate, kyc_status, kyc_extracted_name, kyc_extracted_birth, kyc_last_verified_at FROM users WHERE address=? LIMIT 1",
        [$address]
    ) ?: [];
}

function isUserKycApproved(string $address): bool {
    if (isKycBypassed()) return true;
    $row = getUserKycRow($address);
    return strtoupper((string)($row['kyc_yn'] ?? 'N')) === 'Y';
}

function assertUserKycEligibleOrThrow(string $address): void {
    if (isKycBypassed()) return;
    $row = getUserKycRow($address);
    if (strtoupper((string)($row['kyc_yn'] ?? 'N')) !== 'Y') {
        // (2026-06-17 v911) 다국어화 — 거래/스테이킹/출금/스왑 공통 KYC 차단 메시지.
        //   (운영자: 일/중 미사용 → ko/en). contracts(투자 계약)도 동일 함수 사용.
        throw new RuntimeException(pickLocaleMsg([
            'ko' => 'KYC 인증을 완료해야 이용할 수 있는 기능입니다.',
            'en' => 'This feature requires completed KYC verification.',
        ]));
    }
}

function getAssetTokenName(array $asset): string {
    $name = trim((string)($asset['token_name'] ?? $asset['asset_name'] ?? $asset['name'] ?? ''));
    if ($name !== '') return $name;
    return trim((string)($asset['asset_id'] ?? $asset['id'] ?? 'TOKEN')) ?: 'TOKEN';
}

function getAssetTokenSymbol(array $asset): string {
    $symbol = trim((string)($asset['token_symbol'] ?? $asset['asset_id'] ?? $asset['id'] ?? ''));
    return $symbol !== '' ? strtoupper($symbol) : 'TOKEN';
}

function getAssetTokenDecimals(array $asset): int {
    return 1;
}

function isAssetDistributionStarted(array $asset): bool {
    $status = (string)($asset['status'] ?? '');
    return in_array($status, [STATUSES['DISTRIBUTING'], STATUSES['OPERATING'], STATUSES['SOLD'], '매각(완료)'], true);
}

function getAppSettingJson(string $k, $fallback = null) {
    $row = DB::fetchOne("SELECT v FROM app_settings WHERE k=? LIMIT 1", [$k]);
    if (!$row) return $fallback;
    $decoded = json_decode($row['v'], true);
    return $decoded !== null ? $decoded : ($row['v'] ?? $fallback);
}

// ====== Asset Status ======
function normalizeAssetStatus(array $asset): string {
    $status = $asset['status'] ?? '';
    $raised = (float)($asset['raised_usdt'] ?? 0);
    $target = (float)($asset['target_usdt'] ?? 0);
    if ($status === STATUSES['FUNDING'] && $target > 0 && $raised >= $target) {
        return STATUSES['BUYING'];
    }
    return $status;
}

function withNormalizedAssetStatus(?array $asset): ?array {
    if (!$asset) return $asset;
    $asset['status'] = normalizeAssetStatus($asset);
    return $asset;
}

function syncAssetStatusIfNeeded(string $assetId): void {
    DB::execute(
        "UPDATE assets SET status=? WHERE id=? AND status=? AND target_usdt > 0 AND raised_usdt >= target_usdt",
        [STATUSES['BUYING'], $assetId, STATUSES['FUNDING']]
    );
}

function syncAllAssetStatusesIfNeeded(): void {
    DB::execute(
        "UPDATE assets SET status=? WHERE status=? AND target_usdt > 0 AND raised_usdt >= target_usdt",
        [STATUSES['BUYING'], STATUSES['FUNDING']]
    );
}

if (!function_exists('dbTableExists')) {
    function dbTableExists(string $table): bool {
        static $cache = [];
        $key = strtolower($table);
        if (array_key_exists($key, $cache)) return $cache[$key];
        try {
            $cache[$key] = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                [$table]
            ) > 0;
        } catch (Throwable $e) {
            error_log('dbTableExists fallback: ' . $e->getMessage());
            $cache[$key] = false;
        }
        return $cache[$key];
    }
}

if (!function_exists('dbColumnExists')) {
    function dbColumnExists(string $table, string $column): bool {
        static $cache = [];
        $key = strtolower($table . '.' . $column);
        if (array_key_exists($key, $cache)) return $cache[$key];
        try {
            $cache[$key] = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                [$table, $column]
            ) > 0;
        } catch (Throwable $e) {
            error_log('dbColumnExists fallback: ' . $e->getMessage());
            $cache[$key] = false;
        }
        return $cache[$key];
    }
}

// ====== User Helpers ======
function ensureUser(string $address): void {
    DB::execute("INSERT IGNORE INTO users(address) VALUES (?)", [$address]);
    $initUsdt = max(0, (float)env('NEW_USER_INITIAL_USDT', '0'));
    DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?, ?)", [$address, $initUsdt]);
    // (2026-06-16 v903) 추천인 승인제 제거 — 모든 회원 자동 추천인 등재.
    //   referrer_codes.address 는 UNIQUE(uk_rc_address) 라 INSERT IGNORE 가 중복 방지(이미
    //   등재된 유저는 무시). is_active=1 로 생성되어 기존 보너스/검증 로직(is_active 체크)이
    //   그대로 작동 → 추천 코드/추천인 주소 둘 다 사용 가능. 메뉴도 my-status 의 is_referrer
    //   가 true 가 되어 자동 노출. 코드는 8자(generateReferralCode 와 동일 문자셋, I/O/0/1 제외).
    //   code UNIQUE 충돌 시 INSERT IGNORE 무시 → 다음 ensureUser 호출에서 새 코드로 재시도
    //   (확률 32^8 분의 1로 사실상 항상 1회 성공). Revert: 아래 referrer_codes 블록 제거.
    try {
        $rcChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $rcCode = '';
        for ($i = 0; $i < 8; $i++) { $rcCode .= $rcChars[random_int(0, 31)]; }
        DB::execute(
            "INSERT IGNORE INTO referrer_codes(address, code, is_active, approved_by) VALUES (?, ?, 1, 'auto')",
            [$address, $rcCode]
        );
    } catch (Throwable $_) {}
}

function ensureHolding(string $address, string $assetId): void {
    DB::execute("INSERT IGNORE INTO holdings(address, asset_id) VALUES (?,?)", [$address, $assetId]);
}

function lockUserRowForUpdate(string $address): void {
    ensureUser($address);
    DB::fetchOne("SELECT address FROM users WHERE address=? FOR UPDATE", [$address]);
}

function normalizeReferralCode(?string $code): string {
    return strtoupper(trim((string)$code));
}

function getReferralLinkForInvestor(string $investorAddress, bool $forUpdate = false): ?array {
    ensureReferralTables();

    $sql = "SELECT * FROM referral_links WHERE BINARY investor_address = BINARY ? ORDER BY id DESC LIMIT 1";
    if ($forUpdate) $sql .= " FOR UPDATE";

    return DB::fetchOne($sql, [$investorAddress]);
}

function countUserFundingRequests(string $address, ?string $assetId = null): int {
    $where = ["address=?", "status IN ('awaiting_admin','completed')"];
    $params = [$address];
    if ($assetId !== null && $assetId !== '') {
        $where[] = "asset_id=?";
        $params[] = $assetId;
    }

    return (int)DB::fetchValue(
        "SELECT COUNT(*) FROM investment_contracts WHERE " . implode(' AND ', $where),
        $params
    );
}

function hasUserFundingRequest(string $address, ?string $assetId = null): bool {
    return countUserFundingRequests($address, $assetId) > 0;
}

/**
 * (2026-05-16 v426) 운영자 정책: 추천인 변경 가능 여부는 '관리자가 admin-sign
 *   한 시점'을 기준으로 함. 즉 funding_records 에 행이 있는지 — awaiting_admin
 *   단계의 신청 contract 는 아직 '확정 전'으로 간주, 추천인 변경을 허용한다.
 *
 *   hasUserFundingRequest (awaiting_admin+completed) 와 의도가 다른 별도 키:
 *   - hasUserFundingRequest: 사용자가 '신청서를 제출했는지' (UI 표시용)
 *   - hasUserConfirmedFunding: 사용자가 '실제로 토큰 발행을 받았는지' (추천인 정책용)
 */
function hasUserConfirmedFunding(string $address, ?string $assetId = null): bool {
    $where = ["address=?"];
    $params = [$address];
    if ($assetId !== null && $assetId !== '') {
        $where[] = "asset_id=?";
        $params[] = $assetId;
    }
    return (int)DB::fetchValue(
        "SELECT COUNT(*) FROM funding_records WHERE " . implode(' AND ', $where),
        $params
    ) > 0;
}

/**
 * (2026-05-16 v429) 운영자 정책 재확정: '투자 서명을 투자자가 하면 추천인은
 *   고정 되어야한다. (관리자 서명을 하지 않더라도)'.
 *
 *   따라서 추천인 변경 차단 기준은:
 *     contract.status IN ('user_signed', 'awaiting_admin', 'completed')
 *   - user_signed: 사용자가 서명만 함 (funding 신청 전, draft 와 awaiting 사이 임시)
 *   - awaiting_admin: 사용자가 funding 신청 후 admin 서명 대기
 *   - completed: admin 서명 완료
 *
 *   v426 의 hasUserConfirmedFunding (funding_records 기준) 보다 더 빠른 시점.
 *   v424 이전의 countUserFundingRequests (awaiting+completed) 보다 한 단계 더 빠름.
 */
/**
 * (2026-05-17 v440) 다국어 자산명 후처리 — rows 의 각 row 에 asset_name_en /
 *   asset_name_ko 필드를 채운다. asset_key_info 테이블 (k='name_en'|'name_ko')
 *   에서 가져옴. 이 테이블 미존재 또는 SQL error 시 silent skip + error_log.
 *   사용자측 /api/contracts/my (v435) 와 admin /api/admin/contracts/* (v440)
 *   둘 다에서 동일한 패턴 사용 — 코드 중복 제거.
 *
 * @param array  $rows         in-out, byref
 * @param string $assetIdKey   row 안에서 자산 ID 컬럼명 (기본 'asset_id')
 */
function enrichRowsWithI18nAssetNames(array &$rows, string $assetIdKey = 'asset_id'): void {
    if (empty($rows)) return;
    try {
        if (!function_exists('dbTableExists') || !dbTableExists('asset_key_info')) return;
        $assetIds = [];
        foreach ($rows as $row) {
            $aid = (string)($row[$assetIdKey] ?? '');
            if ($aid !== '') $assetIds[$aid] = true;
        }
        $assetIds = array_keys($assetIds);
        if (empty($assetIds)) return;
        $placeholders = implode(',', array_fill(0, count($assetIds), '?'));
        $kvRows = DB::fetchAll(
            "SELECT asset_id, k, v FROM asset_key_info
              WHERE asset_id IN ({$placeholders})
                AND k IN ('name_en','name_ko')",
            $assetIds
        );
        $nameByAsset = [];
        foreach ($kvRows as $kv) {
            $aid = (string)($kv['asset_id'] ?? '');
            $key = (string)($kv['k'] ?? '');
            $val = (string)($kv['v'] ?? '');
            if ($aid === '' || $key === '') continue;
            if (!isset($nameByAsset[$aid])) $nameByAsset[$aid] = [];
            $nameByAsset[$aid][$key] = $val;
        }
        foreach ($rows as &$row) {
            $aid = (string)($row[$assetIdKey] ?? '');
            $row['asset_name_en'] = $nameByAsset[$aid]['name_en'] ?? null;
            $row['asset_name_ko'] = $nameByAsset[$aid]['name_ko'] ?? null;
        }
        unset($row);
    } catch (Throwable $e) {
        error_log('[enrichRowsWithI18nAssetNames] silent skip: ' . $e->getMessage());
    }
}

/**
 * Single-row convenience wrapper.
 */
function enrichSingleRowWithI18nAssetNames(?array &$row, string $assetIdKey = 'asset_id'): void {
    if (!$row || !is_array($row)) return;
    $rows = [$row];
    enrichRowsWithI18nAssetNames($rows, $assetIdKey);
    $row = $rows[0];
}

function hasUserSignedFunding(string $address, ?string $assetId = null, ?int $ignoreContractId = null): bool {
    $where = ["address=?", "status IN ('user_signed','awaiting_admin','completed')"];
    $params = [$address];
    if ($assetId !== null && $assetId !== '') {
        $where[] = "asset_id=?";
        $params[] = $assetId;
    }
    if ($ignoreContractId !== null && $ignoreContractId > 0) {
        // funding.php 가 현재 처리 중인 contract (status='user_signed') 자기 자신을
        // 검사 대상에서 제외 — 그 contract 외에 다른 서명 contract 가 있을 때만 차단.
        $where[] = "id != ?";
        $params[] = $ignoreContractId;
    }
    return (int)DB::fetchValue(
        "SELECT COUNT(*) FROM investment_contracts WHERE " . implode(' AND ', $where),
        $params
    ) > 0;
}

function computeAssetPendingReservedUSDT(string $assetId): float {
    if (!dbTableExists('investment_contracts')) return 0.0;

    $where = ["asset_id=?", "status='awaiting_admin'"];
    if (dbColumnExists('investment_contracts', 'funding_record_id')) {
        $where[] = "(funding_record_id IS NULL OR funding_record_id=0)";
    }

    return (float)DB::fetchValue(
        "SELECT COALESCE(SUM(amount_usdt),0) FROM investment_contracts WHERE " . implode(' AND ', $where),
        [$assetId]
    );
}

function computeAssetReservableRemainingUSDT(string $assetId, float $targetUsdt, float $raisedConfirmedUsdt): float {
    $pending = computeAssetPendingReservedUSDT($assetId);

    // (2026-05-18 v477) Silica 단일 자산 정책: target_usdt = 0 이면 per-asset
    //   cap 자체가 없음 (사전 발행 1B STO 상시 분배 모델). 기존 로직은
    //   max(0, 0 - 0 - 0) = 0 → remaining_reservable_usdt = 0 → 사용자
    //   페이지 MAX 버튼이 항상 '모집 완료' 토스트로 빠짐. 운영자 보고:
    //   초기화 후 MAX 작동 안 함 / PARTICIPATE 도 0 금액으로 차단.
    //   target_usdt > 0 일 때만 per-asset 한도 계산. 0 이면 INF 처리하여
    //   global silica_max_sto_supply 또는 user balance 가 binding constraint
    //   가 되도록.
    $hasPerAssetCap = $targetUsdt > 0;
    $perAssetRemaining = $hasPerAssetCap
        ? max(0.0, (float)$targetUsdt - (float)$raisedConfirmedUsdt - (float)$pending)
        : PHP_FLOAT_MAX; // 실질적 무한 — global cap 또는 user balance 가 cap

    // (2026-05-08) Also cap by the global Silica STO sale supply.
    //   At 1 USDT = 1 SilicaSTO peg, the dollar-cap and STO-cap are the same
    //   number. Without this min(), assets.html MAX could suggest an amount
    //   larger than the platform-wide mintable supply (e.g. user has 1M USDT,
    //   asset target is 1M, but admin set silica_max_sto_supply=100,000 →
    //   only 49,400 STO actually remain). Honors the canonical Silica policy
    //   that the global STO cap is the binding constraint, not target_usdt.
    if (function_exists('silicaGetMaxStoSupply') && function_exists('silicaRemainingStoSupply')) {
        $maxCap = silicaGetMaxStoSupply();
        if ($maxCap > 0) {
            $remainingStoUsdt = silicaRemainingStoSupply();
            return min($perAssetRemaining, $remainingStoUsdt);
        }
    }
    // global cap 도 없고 per-asset cap 도 없으면 매우 큰 수 — 클라이언트의
    //   min(balance, reservable, stoRemaining) 에서 balance 가 cap 이 됨.
    //   JSON 직렬화 가능하도록 PHP_FLOAT_MAX 대신 1e18 사용.
    return $hasPerAssetCap ? $perAssetRemaining : 1e18;
}

function validateReferralAssignment(string $investorAddress, string $rawInput, ?int $ignoreContractId = null): array {
    ensureReferralTables();

    // (2026-05-16 v418) 운영자: '추천인 코드와 아울러 주소 둘중 하나 모두
    //   입력 가능하도록.' 입력값을 자동 감별 — 길이 32+자 + base58 패턴이면
    //   Solana 주소, 그 외는 추천 코드.
    // (2026-05-18 v499) 모든 메시지 pickLocaleMsg locale 분기. 영어 페이지에
    //   서 한국어 메시지 노출 방지.
    $input = trim((string)$rawInput);
    if ($input === '') {
        return ['ok' => false, 'message' => pickLocaleMsg([
            'ko' => '추천인 코드 또는 지갑 주소를 입력하세요.',
            'en' => 'Please enter a referrer code or wallet address.',
        ])];
    }

    $isAddress = (strlen($input) >= 32 && preg_match('/^[1-9A-HJ-NP-Za-km-z]+$/', $input));

    $referrer = null;
    if ($isAddress) {
        // 주소로 조회 (정확 일치).
        $referrer = DB::fetchOne(
            "SELECT address, code FROM referrer_codes WHERE BINARY address = BINARY ? AND is_active=1 LIMIT 1",
            [$input]
        );
        if (!$referrer) {
            return ['ok' => false, 'message' => pickLocaleMsg([
                'ko' => '입력한 주소는 등록된 추천인이 아닙니다.',
                'en' => 'The entered address is not a registered referrer.',
            ])];
        }
    } else {
        // 코드로 조회 (대문자 정규화).
        $code = normalizeReferralCode($input);
        $referrer = DB::fetchOne(
            "SELECT address, code FROM referrer_codes WHERE BINARY code = BINARY ? AND is_active=1 LIMIT 1",
            [$code]
        );
        if (!$referrer) {
            return ['ok' => false, 'message' => pickLocaleMsg([
                'ko' => '유효하지 않은 추천인 코드입니다.',
                'en' => 'Invalid referrer code.',
            ])];
        }
    }

    // (2026-05-16 v425) 본인 추천 차단 — hash_equals 로 timing-safe 비교 +
    //   주소 길이가 다른 edge case 안전 처리. Solana 주소는 case-sensitive
    //   base58 이라 === 비교도 정확하지만 hash_equals 가 보안 베스트프랙티스.
    $refAddr = (string)($referrer['address'] ?? '');
    if ($refAddr !== '' && hash_equals($refAddr, $investorAddress)) {
        return ['ok' => false, 'message' => pickLocaleMsg([
            'ko' => '본인 추천은 불가합니다.',
            'en' => 'You cannot refer yourself.',
        ])];
    }

    // (2026-05-16 v429) 정책 재확정: '투자 서명을 투자자가 하면 추천인은
    //   고정 되어야한다 (관리자 서명을 하지 않더라도).' v426 이 너무 늦은 시점
    //   (admin-sign 후) 으로 잡아 사용자가 awaiting_admin contract 있는데도
    //   추천인 변경 가능했음. 새 기준: hasUserSignedFunding (user_signed,
    //   awaiting_admin, completed 모두 포함).
    //   funding.php 호출 시 ignoreContractId 로 현재 처리 중인 contract 자기
    //   자신을 제외 — 첫 funding 의 user_signed 자기 contract 로 차단 안 됨.
    //
    // (2026-05-18 v474) 운영자 정책: '관리자가 추천인으로 지정한 유저가
    //   투자시 추천인 코드를 입력 할 수 없는 문제'. approved referrer
    //   (referrer_codes 에 is_active=1 등재) 는 기존 referral_links 가
    //   없으면 hasUserSignedFunding 락을 우회 — 처음 한 번에 한해 본인의
    //   추천인을 추가 가능. 설정 후엔 일반 사용자와 동일하게 변경 불가
    //   (referral_links UNIQUE INDEX uk_investor 와 후속 hasSigned 체크).
    $bypassFirstFundingLock = false;
    try {
        $isApprovedReferrer = (int)DB::fetchValue(
            "SELECT COUNT(*) FROM referrer_codes WHERE BINARY address = BINARY ? AND is_active=1",
            [$investorAddress]
        ) > 0;
        if ($isApprovedReferrer) {
            $hasExistingLink = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM referral_links WHERE BINARY investor_address = BINARY ?",
                [$investorAddress]
            ) > 0;
            if (!$hasExistingLink) {
                $bypassFirstFundingLock = true;
            }
        }
    } catch (Throwable $_) { /* fail-safe — DB 오류 시 락 그대로 적용 */ }

    if (!$bypassFirstFundingLock && hasUserSignedFunding($investorAddress, null, $ignoreContractId)) {
        return ['ok' => false, 'message' => pickLocaleMsg([
            'ko' => '이미 서명한 투자 계약서가 있어 추천인을 설정할 수 없습니다.',
            'en' => 'A signed investment contract already exists; the referrer cannot be set.',
        ])];
    }

    return [
        'ok' => true,
        'code' => $referrer['code'],  // 항상 정규 코드 반환 (입력이 주소였어도)
        'referrer' => $referrer,
    ];
}

function referralUserNameExpr(string $tableAlias = 'u', string $alias = 'referrer_nickname'): string {
    static $baseColumn = null;

    if ($baseColumn === null) {
        $baseColumn = '';
        try {
            $rows = DB::fetchAll("SHOW COLUMNS FROM `users`");
            $available = [];
            foreach ($rows as $row) {
                $field = strtolower((string)($row['Field'] ?? ''));
                if ($field !== '') $available[$field] = true;
            }
            if (!empty($available['nickname'])) {
                $baseColumn = 'nickname';
            } elseif (!empty($available['mt_name'])) {
                $baseColumn = 'mt_name';
            }
        } catch (Throwable $e) {
            $baseColumn = '';
        }
    }

    if ($baseColumn === '') return "NULL AS {$alias}";

    $qualified = ($tableAlias !== '' ? ($tableAlias . '.') : '') . $baseColumn;
    return "{$qualified} AS {$alias}";
}

function getValidReferralLinkForInvestor(string $investorAddress, ?string $expectedReferrerAddress = null): ?array {
    ensureReferralTables();

    $nicknameExpr = referralUserNameExpr('u', 'referrer_nickname');
    $firstFundingTimeExpr = function_exists('adminReferralFirstFundingTimeExpr')
        ? adminReferralFirstFundingTimeExpr('ic_prev')
        : (function_exists('adminReferralColumnExists') && adminReferralColumnExists('investment_contracts', 'otp_verified_at')
            ? "COALESCE(ic_prev.otp_verified_at, ic_prev.created_at)"
            : "ic_prev.created_at");

    $sql = "SELECT rl.*, rc.code AS active_referrer_code, {$nicknameExpr}
            FROM referral_links rl
            JOIN referrer_codes rc
              ON BINARY rc.address = BINARY rl.referrer_address
             AND BINARY rc.code = BINARY rl.referrer_code
             AND rc.is_active = 1
            LEFT JOIN users u ON BINARY u.address = BINARY rl.referrer_address
            WHERE BINARY rl.investor_address = BINARY ?
              AND BINARY rl.referrer_address <> BINARY rl.investor_address
              AND NOT EXISTS (
                    SELECT 1
                    FROM investment_contracts ic_prev
                    WHERE BINARY ic_prev.address = BINARY rl.investor_address
                      AND ic_prev.status IN ('awaiting_admin','completed')
                      AND {$firstFundingTimeExpr} < rl.created_at
              )";
    $params = [$investorAddress];

    if ($expectedReferrerAddress !== null) {
        $sql .= " AND BINARY rl.referrer_address = BINARY ?";
        $params[] = $expectedReferrerAddress;
    }

    $sql .= " ORDER BY rl.created_at DESC, rl.id DESC LIMIT 1";

    return DB::fetchOne($sql, $params);
}

function getAsset(string $assetId): ?array {
    syncAssetStatusIfNeeded($assetId);
    $row = DB::fetchOne("SELECT * FROM assets WHERE id=?", [$assetId]);
    return withNormalizedAssetStatus($row);
}

function computeUserFundedUSDT(string $address, string $assetId): float {
    $funded = (float)DB::fetchValue(
        "SELECT COALESCE(SUM(amount_usdt),0) FROM funding_records WHERE address=? AND asset_id=?",
        [$address, $assetId]
    );
    $refunded = (float)DB::fetchValue(
        "SELECT COALESCE(SUM(amount_usdt),0) FROM refund_records WHERE address=? AND asset_id=?",
        [$address, $assetId]
    );
    return $funded - $refunded;
}


function computeAssetNetFundedUSDT(string $assetId): float {
    $funded = (float)DB::fetchValue(
        "SELECT COALESCE(SUM(amount_usdt),0) FROM funding_records WHERE asset_id=?",
        [$assetId]
    );
    $refunded = (float)DB::fetchValue(
        "SELECT COALESCE(SUM(amount_usdt),0) FROM refund_records WHERE asset_id=?",
        [$assetId]
    );
    return max(0.0, $funded - $refunded);
}

function assetHasPostFundingActivity(string $assetId): bool {
    $checks = [
        ["SELECT COUNT(*) FROM holdings WHERE asset_id=? AND (balance_token > 0 OR staked_token > 0 OR claimed_token > 0)", [$assetId]],
        ["SELECT COUNT(*) FROM interest_claims WHERE asset_id=?", [$assetId]],
        ["SELECT COUNT(*) FROM orders WHERE asset_id=?", [$assetId]],
        ["SELECT COUNT(*) FROM trades WHERE asset_id=?", [$assetId]],
        ["SELECT COUNT(*) FROM token_withdraw_requests WHERE asset_id=?", [$assetId]],
        ["SELECT COUNT(*) FROM sales WHERE asset_id=?", [$assetId]],
        ["SELECT COUNT(*) FROM sale_redemptions WHERE asset_id=?", [$assetId]],
    ];

    foreach ($checks as [$sql, $params]) {
        try {
            if ((int)DB::fetchValue($sql, $params) > 0) return true;
        } catch (Throwable) {
            // Table may not exist yet
        }
    }
    return false;
}

function convertCurrencyAmount(float $amount, string $fromCurrency, string $toCurrency): float {
    $from = strtoupper(trim($fromCurrency ?: 'USDT'));
    $to = strtoupper(trim($toCurrency ?: 'USDT'));
    if (!is_finite($amount)) return 0.0;
    if ($amount == 0.0 || $from === $to) return $amount;

    if ($from === 'USDT') {
        $fxTo = getFxPerUsdt($to);
        return ($fxTo > 0) ? ($amount * $fxTo) : 0.0;
    }

    if ($to === 'USDT') {
        $fxFrom = getFxPerUsdt($from);
        return ($fxFrom > 0) ? ($amount / $fxFrom) : 0.0;
    }

    $usdt = convertCurrencyAmount($amount, $from, 'USDT');
    return convertCurrencyAmount($usdt, 'USDT', $to);
}

function computeAssetDistributionSnapshot(array $asset, ?float $fundedSnap = null, ?float $fxOverride = null): array {
    $assetId = (string)($asset['id'] ?? '');
    $settlement = strtoupper($asset['settlement_basis'] ?? 'KRW');
    $snapshot = $fundedSnap;
    if (!is_finite((float)$snapshot) || (float)$snapshot <= 0) {
        $snapshot = (float)($asset['funded_snapshot_usdt'] ?? 0);
    }
    if (!is_finite((float)$snapshot) || (float)$snapshot <= 0) {
        $snapshot = (float)($asset['raised_usdt'] ?? 0);
    }
    if ((!is_finite((float)$snapshot) || (float)$snapshot <= 0) && $assetId !== '') {
        $snapshot = computeAssetNetFundedUSDT($assetId);
    }
    if (!is_finite((float)$snapshot) || (float)$snapshot <= 0) {
        throw new RuntimeException('분배 기준 USDT 스냅샷이 없습니다.');
    }

    $fx = is_finite((float)$fxOverride) && (float)$fxOverride > 0
        ? (float)$fxOverride
        : (float)($asset['fx_at_funding'] ?? 0);

    if ($settlement === 'USDT') {
        $fx = 1.0;
    } else {
        if (!($fx > 0)) {
            $fx = getFundingFxForAsset($asset);
        }
        if (!($fx > 0)) {
            // (2026-05-08) Same user-safe pattern as fxRequireKrwOrThrow():
            //   verbose detail → error_log, customer sees a generic message
            //   in their own locale (X-RWA-Lang).
            error_log(sprintf(
                '[fx-outage] Funding contract blocked — no FX rate. asset=%s settlement=%s',
                (string)($asset['id'] ?? '?'), $settlement
            ));
            throw new RuntimeException(pickLocaleMsg([
                'ko' => '환율 시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
                'en' => 'A temporary issue with the FX system has occurred. Please try again in a moment.',
                'ja' => '為替レートシステムに一時的な問題が発生しました。しばらくしてから再度お試しください。',
                'zh' => '汇率系统出现临时故障。请稍后再试。',
            ]));
        }
    }

    // 토큰 발행량은 항상 확정 모금 USDT와 동일하게 계산한다.
    // 정산통화 환율은 이후 정산/매각 계산에만 사용한다.
    $supply = clamp6((float)$snapshot);

    return [
        'funded_snapshot_usdt' => round((float)$snapshot, 2),
        'fx_at_funding'        => $settlement === 'USDT' ? 1 : floor($fx),
        'supply_token'         => $supply,
        'settlement_basis'     => $settlement,
    ];
}

// ====== Numeric Helpers ======
function toBool($v): bool {
    return $v === true || $v === 1 || $v === '1' || $v === 'true' || $v === 'on';
}

function clamp6(float $n): float {
    if (!is_finite($n)) return 0.0;
    return round($n * 1e6) / 1e6;
}

/**
 * Truncate (floor) a positive amount to 2 decimal places.
 * 매각 정산·유저 교환 등 USDT 금액은 0.01 미만을 버림한다.
 * (반올림이 아닌 내림 — 플랫폼 vault 준비금 초과 인출 방지)
 */
function floor2(float $n): float {
    if (!is_finite($n)) return 0.0;
    if ($n <= 0) return 0.0;
    return floor($n * 100) / 100;
}

/**
 * (2026-05-11 v264) Truncate (floor) to 3 decimal places.
 * 운영자 정책: 거래 수수료는 소수점 4번째 자리부터 절삭한다.
 *   (반올림이 아닌 내림 — 플랫폼이 raw 계산값보다 많이 받지 않도록)
 * 0 / 음수 / NaN / Infinity 는 0.0 으로 정규화.
 */
function floor3(float $n): float {
    if (!is_finite($n)) return 0.0;
    if ($n <= 0) return 0.0;
    return floor($n * 1000) / 1000;
}

function numToDec4Str(float $n): string {
    if (!is_finite($n)) return '0.0000';
    $v = floor($n * 1e4) / 1e4;
    return number_format($v, 4, '.', '');
}

function numToDec6Str(float $n): string {
    if (!is_finite($n)) return '0.000000';
    $v = floor($n * 1e6) / 1e6;
    return number_format($v, 6, '.', '');
}

function trunc6ToDec6Str(float $n): string {
    if (!is_finite($n) || $n <= 0) return '0.000000';
    $v = floor($n * 1e6) / 1e6;
    return number_format($v, 6, '.', '');
}

function approxEq(float $a, float $b, float $rel = 0.002): bool {
    if (!is_finite($a) || !is_finite($b)) return false;
    $d = abs($a - $b);
    $m = max(1.0, abs($b));
    return ($d / $m) <= $rel;
}

function isLocalCurrencyTokenMode(array $asset): bool {
    $fx = (float)($asset['fx_at_funding'] ?? 0);
    $denom = (float)($asset['funded_snapshot_usdt'] ?? $asset['raised_usdt'] ?? 0);
    $supply = (float)($asset['supply_token'] ?? 0);
    $ccy = strtoupper($asset['settlement_basis'] ?? 'KRW');

    if (!($fx > 0 && $denom > 0 && $supply > 0)) return false;

    $expected = $denom * $fx;
    if (approxEq($supply, $expected, 0.01)) return true;

    if (approxEq($supply, $denom, 0.01) && $ccy === 'KRW') return false;

    return false;
}

function isAdminSimulationEnabled(): bool {
    return envBool('ADMIN_SIMULATE_BALANCE_ENABLED');
}

// ====== Contract Helpers ======
function escapeHtml(string $v): string {
    return htmlspecialchars($v, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function renderContractTemplate(string $html, array $vars = []): string {
    return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($m) use ($vars) {
        return escapeHtml($vars[$m[1]] ?? '');
    }, $html);
}

function makeContractNo(): string {
    return 'CTR-' . nowKST()->format('YmdHis') . '-' . strtoupper(substr(base_convert(random_int(0, PHP_INT_MAX), 10, 36), 0, 6));
}

function saveBase64PngToUploads(string $dataUrl, string $prefix = 'contract_sign'): string {
    $s = trim($dataUrl);

    // Use string prefix matching instead of regex on full data URL (avoids issues with very long base64)
    $allowedPrefixes = [
        'data:image/png;base64,',
        'data:image/jpeg;base64,',
        'data:image/webp;base64,',
    ];
    $matchedPrefix = null;
    foreach ($allowedPrefixes as $p) {
        if (str_starts_with($s, $p)) {
            $matchedPrefix = $p;
            break;
        }
    }
    if (!$matchedPrefix) {
        $preview = substr($s, 0, 80);
        error_log("[saveBase64PngToUploads] prefix mismatch. length=" . strlen($s) . " start=\"{$preview}\"");
        throw new RuntimeException('전자서명 이미지 형식이 올바르지 않습니다. (PNG/JPEG 서명만 허용)');
    }

    $base64Raw = substr($s, strlen($matchedPrefix));
    // Remove any whitespace from base64 data
    $base64Clean = preg_replace('/\s/', '', $base64Raw);
    if (!$base64Clean) {
        throw new RuntimeException('전자서명 이미지 데이터가 비어 있습니다.');
    }

    $buf = base64_decode($base64Clean, true);
    if ($buf === false || strlen($buf) === 0 || strlen($buf) > 2 * 1024 * 1024) {
        error_log("[saveBase64PngToUploads] buffer invalid: " . ($buf === false ? 'decode_failed' : strlen($buf) . ' bytes'));
        throw new RuntimeException('전자서명 이미지 크기가 올바르지 않습니다.');
    }

    $safePrefix = preg_replace('/[^a-zA-Z0-9_-]/', '_', $prefix);
    $name = "{$safePrefix}_" . time() . '_' . substr(base_convert(random_int(0, PHP_INT_MAX), 10, 36), 0, 8) . '.png';

    if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);

    file_put_contents(UPLOAD_DIR . '/' . $name, $buf);
    return '/uploads/' . $name;
}

function writeContractAudit(PDO $pdo, array $params): void {
    $stmt = $pdo->prepare(
        "INSERT INTO contract_audit_logs(contract_id, actor_type, actor_id, action_type, ip, user_agent, payload_json)
         VALUES (?,?,?,?,?,?,?)"
    );
    $stmt->execute([
        $params['contractId'],
        $params['actorType'] ?? 'system',
        $params['actorId'] ?? null,
        $params['actionType'] ?? 'unknown',
        $params['ip'] ?? null,
        substr($params['userAgent'] ?? '', 0, 255) ?: null,
        json_encode($params['payload'] ?? new stdClass(), JSON_UNESCAPED_UNICODE),
    ]);
}

// ====== Claim logging ======
function logClaimRecord(array $row): void {
    try {
        DB::execute(
            "INSERT INTO claim_records(
                address, asset_id, ok, message,
                funded_usdt, denom_snapshot_usdt, supply_token_snapshot,
                entitled_token, already_claimed_token, claimed_token,
                ip, user_agent
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            [
                $row['address'], $row['asset_id'],
                ($row['ok'] ?? false) ? 1 : 0,
                $row['message'] ?? null,
                $row['funded_usdt'] ?? null,
                $row['denom_snapshot_usdt'] ?? null,
                $row['supply_token_snapshot'] ?? null,
                $row['entitled_token'] ?? null,
                $row['already_claimed_token'] ?? null,
                $row['claimed_token'] ?? 0,
                $row['ip'] ?? null,
                $row['user_agent'] ?? null,
            ]
        );
    } catch (Throwable) {}
}

// ====== Interest calculation (BigInt-like using bcmath) ======
function calcMonthlyInterestLocalRaw1e4(string $stakedRaw1e6, int $apr_x100): string {
    // floor( stakedRaw1e6 * apr_x100 / 12_000_000 )
    $product = bcmul($stakedRaw1e6, (string)$apr_x100, 0);
    return bcdiv($product, '12000000', 0);
}

function calcUsdtRaw1e6FromLocal1e4(string $localRaw1e4, string $fxRaw1e6): string {
    if (bccomp($fxRaw1e6, '0') <= 0) return '0';
    // usdt_1e6 = floor( local1e4 * 100000000 / fxRaw1e6 )
    $product = bcmul($localRaw1e4, '100000000', 0);
    return bcdiv($product, $fxRaw1e6, 0);
}

// ====== BigInt-style decimal converters ======
function normDec6ToRaw(string $s): array {
    $x = trim($s);
    if ($x === '') return ['raw' => '0', 'str' => '0.000000'];
    $parts = explode('.', $x, 2);
    $ip = preg_replace('/[^\d]/', '', $parts[0] ?: '0') ?: '0';
    $fp = substr(str_pad(preg_replace('/[^\d]/', '', $parts[1] ?? ''), 6, '0'), 0, 6);
    $raw = bcadd(bcmul($ip, '1000000', 0), $fp, 0);
    return ['raw' => $raw, 'str' => ltrim($ip, '0') ?: '0' . '.' . $fp];
}

function rawToDec6Str(string $raw): string {
    if (bccomp($raw, '0') < 0) $raw = '0';
    $ip = bcdiv($raw, '1000000', 0);
    $fp = str_pad(bcmod($raw, '1000000'), 6, '0', STR_PAD_LEFT);
    return $ip . '.' . $fp;
}

function normDec4ToRaw(string $s): array {
    $x = trim($s);
    if ($x === '') return ['raw' => '0', 'str' => '0.0000'];
    $parts = explode('.', $x, 2);
    $ip = preg_replace('/[^\d]/', '', $parts[0] ?: '0') ?: '0';
    $fp = substr(str_pad(preg_replace('/[^\d]/', '', $parts[1] ?? ''), 4, '0'), 0, 4);
    $raw = bcadd(bcmul($ip, '10000', 0), $fp, 0);
    return ['raw' => $raw, 'str' => ltrim($ip, '0') ?: '0' . '.' . $fp];
}

function rawToDec4Str(string $raw): string {
    if (bccomp($raw, '0') < 0) $raw = '0';
    $ip = bcdiv($raw, '10000', 0);
    $fp = str_pad(bcmod($raw, '10000'), 4, '0', STR_PAD_LEFT);
    return $ip . '.' . $fp;
}

// ====== CORS Handling ======
// (2026-05-18 v546) 거부된 cross-origin 요청을 error_log 에 기록 — 의심스러운
//   외부 호출 시도를 사후 분석 가능. 정상 same-origin 요청은 Origin 헤더가
//   없거나 같은 도메인이라 로깅에서 자동 제외.
function handleCors(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin) {
        if (in_array($origin, CORS_ORIGINS, true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Key, X-Wallet, X-Idempotency-Key');
            // 추가 보안 헤더 — modern browsers 의 frame busting / MIME sniffing 등 차단.
            header('X-Content-Type-Options: nosniff');
            header('Referrer-Policy: strict-origin-when-cross-origin');
        } else {
            // CORS_ORIGINS 에 없는 cross-origin 요청 — Allow 헤더 안 보냄 → 브라우저 차단.
            // 단순 same-origin 정상 흐름이 아닌 의심스런 요청이므로 로그.
            $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
            error_log("[security][CORS] Blocked cross-origin request: origin={$origin} path={$path} ip={$ip}");
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        header('Access-Control-Max-Age: 86400');
        http_response_code(204);
        exit;
    }
}

// ====== Rate Limiting (simple in-memory via APCu or file) ======
function rateLimit(int $maxPerMinute = 240): void {
    // For shared hosting without APCu, use a simple pass-through
    // Production can use APCu or Redis-based rate limiting
    if (!function_exists('apcu_fetch')) return;

    $ip = getReqIp();
    $key = 'rl:' . $ip . ':' . floor(time() / 60);
    $count = apcu_fetch($key);
    if ($count === false) {
        apcu_store($key, 1, 60);
    } else {
        if ($count >= $maxPerMinute) {
            jsonError(429, 'Too many requests');
        }
        apcu_inc($key);
    }
}


function computeAssetOnchainWithdrawnToken(string $assetId): float {
    try {
        $sum = DB::fetchValue("SELECT COALESCE(SUM(amount_token),0) FROM token_withdraw_requests WHERE asset_id=? AND status='done'", [$assetId]);
        return (float)$sum;
    } catch (Throwable $e) {
        return 0.0;
    }
}

function computeAssetDisplayStatus(array $asset): string {
    $status = (string)($asset['status'] ?? '');
    if ($status === STATUSES['SOLD'] || $status === '매각') {
        try {
            $assetId = (string)($asset['id'] ?? '');
            if ($assetId !== '') {
                $sale = DB::fetchOne("SELECT COALESCE(vault_balance_usdt,0) AS vault_total_usdt FROM sales WHERE asset_id=? LIMIT 1", [$assetId]);
                $total = (float)($sale['vault_total_usdt'] ?? 0);
                if ($total > 0) {
                    $redeemed = (float)DB::fetchValue("SELECT COALESCE(SUM(usdt),0) FROM sale_redemptions WHERE asset_id=?", [$assetId]);
                    if ($redeemed + 0.000001 >= $total) return '매각(완료)';
                }
            }
        } catch (Throwable $e) {
        }
    }
    return $status;
}
