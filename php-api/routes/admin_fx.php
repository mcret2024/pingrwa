<?php
/**
 * Admin FX routes: live quotes, history
 */

// (2026-05-11) On-demand FX refresh — invoked by the '↻ 새로고침'
//   button on admin/settings.html. Operator: '환율 새로고침이 작동하지
//   않는다.' The button previously called loadFx() only (re-read the
//   DB), with no actual provider HTTP fetch. This endpoint runs the
//   same provider chain the cron uses — first success writes the row,
//   returns a structured report so the admin can see which provider
//   answered (or which ones failed).
post('/api/admin/fx/refresh-now', function () {
    adminOnly();
    require_once __DIR__ . '/../lib/fx.php';
    $ccyArg = strtoupper(trim((string)($_GET['ccy'] ?? 'KRW')));
    $ALLOWED_CCYS = ['KRW', 'USD', 'KZT', 'PHP', 'GEL', 'IDR', 'VND'];
    $ccys = in_array($ccyArg, $ALLOWED_CCYS, true) ? [$ccyArg] : ['KRW'];

    try {
        $report = fxwRunProviderChain($ccys);
        jsonOk($report);
    } catch (Throwable $e) {
        error_log('[admin/fx/refresh-now] ' . $e->getMessage());
        jsonError(500, 'FX 새로고침 실패: ' . $e->getMessage());
    }
});

// (2026-05-18 v571) /api/cron/fx — HTTP cron endpoint mirroring the existing
//   /api/cron/accrue-interest and /api/cron/distribute-dividends pattern.
//   운영자가 Hostinger Cron Jobs UI 에서 CLI 절대경로 (도메인마다 다름)를
//   찾는 부담을 없애기 위해, 다른 두 cron 과 동일한 'curl + ?key=' 패턴으로
//   fx 환율도 호출 가능하게 한다. fx_worker_cron.php 본체는 그대로 두고
//   (CLI 사용자 호환), 같은 fxwRunProviderChain() 함수를 HTTP 컨텍스트에서
//   재사용. 인증: CRON_KEY 환경변수 일치 필수 (admin 토큰과는 별개).
//
//   Hostinger 예시 (UTC 기준, 15분마다):
//     */15 * * * *  curl -s "https://example.com/api/cron/fx?key=CRON_KEY" > /dev/null 2>&1
//
//   응답: 각 통화별 provider chain 결과 + 첫 성공 provider + 새 rate.
$cronFxHandler = function () {
    require_once __DIR__ . '/../lib/fx.php';

    $providedKey = trim((string)($_SERVER['HTTP_X_CRON_KEY'] ?? $_GET['key'] ?? ''));
    $expectedKey = trim((string)env('CRON_KEY', ''));
    if ($expectedKey === '' || $providedKey === '' || !hash_equals($expectedKey, $providedKey)) {
        jsonError(401, 'CRON_KEY 인증 실패 — .env 의 CRON_KEY 값을 ?key= 또는 X-Cron-Key header 로 전달.');
    }

    // 처리할 통화 — ?ccy=KRW 가 있으면 그것만, 없으면 admin 이 fx_target_currencies
    //   설정에 적어둔 전체 목록 (settings 에서 정의 안 됐으면 KRW 만).
    $ccyArg = strtoupper(trim((string)($_GET['ccy'] ?? '')));
    $ALLOWED_CCYS = ['KRW', 'USD', 'KZT', 'PHP', 'GEL', 'IDR', 'VND'];
    if ($ccyArg !== '' && in_array($ccyArg, $ALLOWED_CCYS, true)) {
        $ccys = [$ccyArg];
    } else {
        $raw = trim((string)(getSetting('fx_target_currencies', 'KRW') ?? 'KRW'));
        $ccys = array_values(array_filter(
            array_map(fn($s) => strtoupper(trim($s)), explode(',', $raw)),
            fn($s) => in_array($s, $ALLOWED_CCYS, true)
        ));
        if (!$ccys) $ccys = ['KRW'];
    }

    try {
        $report = fxwRunProviderChain($ccys);
        jsonOk($report);
    } catch (Throwable $e) {
        error_log('[cron/fx] ' . $e->getMessage());
        jsonError(500, 'FX cron 실패: ' . $e->getMessage());
    }
};

post('/api/cron/fx', $cronFxHandler);
get('/api/cron/fx', $cronFxHandler);

get('/api/admin/fx/live', function () {
    adminOnly();
    $fxRates = getFxTable();

    $latestRows = DB::fetchAll(
        "SELECT quote_currency, rate, provider, fetched_at FROM fx_quote_latest ORDER BY quote_currency ASC"
    );

    $last = DB::fetchOne("SELECT MAX(fetched_at) AS last_at FROM fx_quote_latest");

    $mode = getSetting('fx_mode', 'auto') ?? 'auto';
    // (2026-05-08) provider_chain is the canonical fallback list used by
    //   the worker. fx_worker_provider remains as a legacy single-provider
    //   pointer; we expose both so the admin UI can display the chain
    //   that's actually being tried in order.
    $rawChain = trim((string)(getSetting('fx_provider_chain', '') ?? ''));
    if ($rawChain === '') {
        $rawChain = trim((string)(getSetting('fx_worker_provider', 'coingecko') ?? 'coingecko'));
    }
    $providerChain = array_values(array_filter(
        array_map(fn($s) => strtolower(trim($s)), explode(',', $rawChain)),
        fn($s) => $s !== ''
    ));
    $provider = $providerChain[0] ?? 'coingecko';
    $lastSuccess = getSetting('fx_worker_last_success_at', '') ?? '';
    $lastError = getSetting('fx_worker_last_error', '') ?? '';

    $fxSettingKeys = array_values(FX_KEY);
    if ($fxSettingKeys) {
        $placeholders = implode(',', array_fill(0, count($fxSettingKeys), '?'));
        $settingRows = DB::fetchAll(
            "SELECT `key`, updated_at FROM settings WHERE `key` IN ({$placeholders})",
            $fxSettingKeys
        );
    } else {
        $settingRows = [];
    }

    $reverseFxKey = [];
    foreach (FX_KEY as $ccy => $key) {
        $reverseFxKey[$key] = $ccy;
    }

    $settingsUpdatedAt = [];
    foreach ($settingRows as $row) {
        $ccy = $reverseFxKey[$row['key'] ?? ''] ?? '';
        if ($ccy) $settingsUpdatedAt[$ccy] = $row['updated_at'] ?? null;
    }

    // Surface the actual provider that wrote the latest KRW row (the
    //   chain's fallback may have kicked in). Falls back to chain head.
    $latestProvider = '';
    foreach ($latestRows as $r) {
        if (strtoupper((string)($r['quote_currency'] ?? '')) === 'KRW') {
            $latestProvider = (string)($r['provider'] ?? '');
            break;
        }
    }
    if ($latestProvider !== '') $provider = $latestProvider;

    jsonOk([
        'mode' => $mode,
        'provider' => $provider,
        'provider_chain' => $providerChain,
        'last_at' => $last['last_at'] ?? null,
        'worker_last_success_at' => $lastSuccess ?: null,
        'worker_last_error' => $lastError ?: null,
        'fx_rates' => $fxRates,
        'latest' => $latestRows,
        'settings_updated_at' => $settingsUpdatedAt,
    ]);
});

// (2026-05-08) Save the FX provider chain (ordered comma-separated list).
//   The chain is the source of truth for the cron worker:
//   php-api/cron/fx_worker_cron.php tries each provider in order, writes
//   the first success to fx_quote_latest, and records the failure detail
//   in fx_worker_last_error if all providers fail.
post('/api/admin/settings/fx-providers', function () {
    adminOnly();
    $body = getJsonBody();
    $chain = $body['chain'] ?? null;
    if (!is_array($chain)) jsonError(400, 'chain 배열이 필요합니다.');

    $ALLOWED = ['coingecko', 'coinlore', 'exchangerate-api', 'er_api', 'frankfurter', 'yahoo'];
    $clean = [];
    $seen = [];
    foreach ($chain as $raw) {
        $p = strtolower(trim((string)$raw));
        if ($p === '') continue;
        if (!in_array($p, $ALLOWED, true)) {
            jsonError(400, "지원되지 않는 provider: '$p'. 허용: " . implode(', ', $ALLOWED));
        }
        if (isset($seen[$p])) continue;
        $seen[$p] = true;
        $clean[] = $p;
    }
    if (empty($clean)) jsonError(400, '체인은 최소 1개 이상이어야 합니다.');

    $serialized = implode(',', $clean);
    setSetting('fx_provider_chain', $serialized);
    // Keep legacy single-provider key in sync with chain head for any
    //   older code that still reads fx_worker_provider directly.
    setSetting('fx_worker_provider', $clean[0]);

    jsonOk([
        'chain' => $clean,
        'saved' => $serialized,
    ]);
});

get('/api/admin/fx/history', function () {
    adminOnly();
    $ccy = strtoupper(trim($_GET['ccy'] ?? 'KRW'));
    $limit = min(2000, max(10, (int)($_GET['limit'] ?? 240)));

    $allowed = ['KRW','USD','KZT','PHP','GEL','IDR','VND'];
    if (!in_array($ccy, $allowed)) jsonError(400, 'ccy 올바르지 않음');

    $rows = DB::fetchAll(
        "SELECT rate, fetched_at, provider FROM fx_quotes WHERE quote_currency=? ORDER BY fetched_at DESC LIMIT {$limit}",
        [$ccy]
    );

    // Return old -> new order
    jsonOk(['ccy' => $ccy, 'rows' => array_reverse($rows)]);
});
