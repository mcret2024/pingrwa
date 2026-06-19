<?php
/**
 * RWA Platform - FX Rate Helpers
 */

// In-memory cache (per-request only in PHP; use APCu for cross-request)
$_FX_MAP_CACHE = null;
$_FX_MAP_AT = 0;

/*
 * (2026-05-08) envFx() removed. Operator policy: 고환율 환경에서 환율이
 *   언제 어떻게 크게 변동될지 모르기 때문에 어떤 종류의 확정 (env
 *   default, baked-in 1350 등) 도 위험하다. 모든 fallback 을 잘라내고
 *   live worker output 만 단일 source of truth 로 사용한다. 워커 장애
 *   시에는 transactions 가 fxRequireKrwOrThrow() 에서 차단된다.
 */

/**
 * (2026-05-08) Read the most recent rate from fx_quote_latest (the table
 *   the FX worker writes to). Returns 0.0 if the table is missing, the
 *   row is stale (>24 h), or fx_mode='manual' is set in settings.
 *
 * Source priority (when this returns >0): live worker rate.
 * No silent fallback exists below this — getFxPerUsdt() returns 0 when
 * the live row is missing/stale, and strict accounting callers must use
 * fxRequireKrwOrThrow() to block the transaction outright.
 *
 * The 24 h freshness window is generous on purpose — the worker should
 * run hourly, but a temporary outage shouldn't immediately kick the rate
 * back to a stale manual setting that no one has touched in months.
 */
function fxLiveRate(string $ccy): float {
    $ccy = strtoupper(trim($ccy));
    if ($ccy === '' || $ccy === 'USDT') return 0.0;

    // (2026-05-08) Manual mode kept as a backdoor (DB-only toggle), but
    //   the admin UI no longer surfaces it. When fx_mode='manual', this
    //   helper returns 0 and getFxPerUsdt() falls through to 0 too —
    //   strict callers will throw, display callers will render "—".
    $mode = strtolower(trim((string)(getSetting('fx_mode', 'auto') ?? 'auto')));
    if ($mode === 'manual') return 0.0;

    try {
        $row = DB::fetchOne(
            "SELECT rate, fetched_at FROM fx_quote_latest
              WHERE quote_currency = ?
                AND rate > 0
              LIMIT 1",
            [$ccy]
        );
    } catch (Throwable $e) {
        return 0.0; // table missing or other DB error → fall through to manual
    }
    if (!$row) return 0.0;

    // Freshness gate: ignore live rate if it's older than 24 h.
    $fetchedAt = strtotime((string)($row['fetched_at'] ?? '')) ?: 0;
    if ($fetchedAt > 0 && (time() - $fetchedAt) > 86400) return 0.0;

    $rate = (float)($row['rate'] ?? 0);
    return (is_finite($rate) && $rate > 0) ? $rate : 0.0;
}

function getFxPerUsdt(string $currency = 'KRW'): float {
    global $_FX_MAP_CACHE, $_FX_MAP_AT;
    $ccy = strtoupper($currency ?: 'KRW');
    if ($ccy === 'USDT') return 1.0;
    if (!isset(FX_KEY[$ccy])) return 0.0;

    $now = time();
    if ($_FX_MAP_CACHE && ($now - $_FX_MAP_AT) < 30) {
        $v = (float)($_FX_MAP_CACHE[$ccy] ?? 0);
        return (is_finite($v) && $v > 0) ? $v : 0.0;
    }

    // (2026-05-08) Live worker rate ONLY. Operator policy removed manual
    //   input and the env / 1350 silent fallbacks so a worker outage
    //   surfaces immediately rather than silently using stale data.
    //   Strict accounting callers must use fxRequireKrwOrThrow() so the
    //   transaction blocks instead of running on 0.
    $n = fxLiveRate($ccy);

    // Refresh cache for all currencies in one pass (live-only).
    $map = [];
    foreach (CURRENCIES as $x) {
        if ($x === $ccy) {
            $map[$x] = (is_finite($n) && $n > 0) ? $n : 0.0;
        } else {
            $live = fxLiveRate($x);
            $map[$x] = (is_finite($live) && $live > 0) ? $live : 0.0;
        }
    }
    $_FX_MAP_CACHE = $map;
    $_FX_MAP_AT = $now;

    return (is_finite($n) && $n > 0) ? $n : 0.0;
}

function getFxTable(): array {
    global $_FX_MAP_CACHE, $_FX_MAP_AT;

    $now = time();
    if ($_FX_MAP_CACHE && ($now - $_FX_MAP_AT) < 30) return $_FX_MAP_CACHE;

    $map = [];
    foreach (CURRENCIES as $ccy) {
        if ($ccy === 'USDT') {
            $map[$ccy] = 1.0;
            continue;
        }
        // (2026-05-08) Live-only — see getFxPerUsdt() comment.
        $n = fxLiveRate($ccy);
        $map[$ccy] = (is_finite($n) && $n > 0) ? $n : 0.0;
    }
    $_FX_MAP_CACHE = $map;
    $_FX_MAP_AT = $now;
    return $map;
}

function getFxPerUsdtAt(string $currency = 'KRW', ?string $when = null): float {
    $ccy = strtoupper($currency ?: 'KRW');
    if ($ccy === 'USDT') return 1.0;
    if (!$when) return getFxPerUsdt($ccy);

    $dateTime = null;
    $raw = trim((string)$when);
    if ($raw !== '') {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            $dateTime = $raw . ' 23:59:59';
        } elseif (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/', $raw)) {
            $dateTime = str_replace('T', ' ', $raw);
            if (strlen($dateTime) === 16) $dateTime .= ':59';
        } elseif (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $raw)) {
            $dateTime = $raw;
            if (strlen($dateTime) === 16) $dateTime .= ':59';
        }
    }

    if (!$dateTime) return getFxPerUsdt($ccy);

    try {
        $row = DB::fetchOne(
            "SELECT rate FROM fx_quotes WHERE quote_currency=? AND fetched_at <= ? ORDER BY fetched_at DESC LIMIT 1",
            [$ccy, $dateTime]
        );
        $rate = (float)($row['rate'] ?? 0);
        if (is_finite($rate) && $rate > 0) return $rate;
    } catch (Throwable) {
        // table/history may not exist in all environments
    }

    return getFxPerUsdt($ccy);
}

/**
 * (2026-05-08) Live-worker only. No env / manual / baked-in fallback.
 *   Returns 0 when no live row exists. Display callers render "—";
 *   strict accounting callers must use fxRequireKrwOrThrow() so the
 *   transaction blocks instead of running on a stale or guessed rate.
 *
 *   Removed sources that used to back-fill this:
 *     - getAppSettingJson('fx').fx_krw_per_usdt  (legacy JSON setting)
 *     - getSetting('fx_krw_per_usdt')            (manual admin input)
 *     - env('FX_KRW_PER_USDT', '1350')           (deploy-time default)
 *   All three risked invoicing at a stale FX during a worker outage.
 */
function getFxKrwPerUsdt(): float {
    $n = getFxPerUsdt('KRW');
    return (is_finite($n) && $n > 0) ? floor($n) : 0.0;
}

/**
 * (2026-05-08) Strict KRW rate lookup. Throws when no fresh rate is
 *   available — callers in settlement / accounting flows must use this
 *   instead of getFxKrwPerUsdt() so a worker outage doesn't silently
 *   record bookings at a stale value.
 *
 *   The thrown exception carries a USER-SAFE Korean message ("환율을
 *   가져올 수 없습니다. 잠시 후 다시 시도해 주세요.") that's safe to
 *   surface in API responses. The verbose admin-internal detail
 *   (provider chain, last worker error, settings path hint) goes to
 *   error_log + the fx_worker_last_error setting only — never bubbles
 *   to the customer.
 *
 * @throws RuntimeException with a user-safe message.
 */
function fxRequireKrwOrThrow(): float {
    $rate = getFxKrwPerUsdt();
    if (!(is_finite($rate) && $rate > 0)) {
        // (1) Log the verbose admin diagnostic to error_log so the operator
        //     can find it without it leaking to the customer.
        $chainRaw = trim((string)(getSetting('fx_provider_chain', '') ?? ''));
        if ($chainRaw === '') {
            $chainRaw = trim((string)(getSetting('fx_worker_provider', 'coingecko') ?? 'coingecko'));
        }
        $lastErr  = trim((string)(getSetting('fx_worker_last_error', '') ?? ''));
        $lastOk   = trim((string)(getSetting('fx_worker_last_success_at', '') ?? ''));
        error_log(sprintf(
            '[fx-outage] No fresh KRW rate available. chain=%s last_success=%s last_error=%s',
            $chainRaw !== '' ? $chainRaw : '(none)',
            $lastOk   !== '' ? $lastOk   : '(never)',
            $lastErr  !== '' ? $lastErr  : '(none)'
        ));

        // (2) User-facing message — localized to the request's locale so
        //     EN/JA/ZH pages never see Korean. Falls through en → ko if a
        //     translation is missing.
        throw new RuntimeException(pickLocaleMsg([
            'ko' => '환율 시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
            'en' => 'A temporary issue with the FX system has occurred. Please try again in a moment.',
            'ja' => '為替レートシステムに一時的な問題が発生しました。しばらくしてから再度お試しください。',
            'zh' => '汇率系统出现临时故障。请稍后再试。',
        ]));
    }
    return $rate;
}

function getFundingFxForAsset(array $asset): float {
    $ccy = strtoupper($asset['settlement_basis'] ?? 'KRW');

    if ($ccy === 'USDT') return 1.0;

    $v = getFxPerUsdt($ccy);
    if (is_finite($v) && $v > 0) return $v;

    // (2026-05-08) Removed legacy 1350 fallback for KRW. With manual FX
    //   input gone (operator policy), any caller that gets 0 here must
    //   either render "—" (display) or call fxRequireKrwOrThrow() to
    //   block the transaction. Returning 0 propagates "no rate"
    //   intentionally instead of silently invoicing at a guess.
    if ($ccy === 'KRW') {
        $v = getFxKrwPerUsdt();
        return (is_finite($v) && $v > 0) ? $v : 0.0;
    }

    // (2026-05-08) Removed manual settings + env fallbacks for non-KRW
    //   currencies as well. getFxPerUsdt() above is the only source —
    //   if the worker hasn't fetched this currency, return 0 and let the
    //   caller throw. No baked-in defaults survive anywhere in this
    //   function (operator policy: 확정 환율값 보유 금지).
    return 0.0;
}

// ============================================================
// (2026-05-11) FX provider chain runner — shared between the
// scheduled cron (cron/fx_worker_cron.php) and the admin "↻ 새로고침"
// button on settings.html. Operator: '환율 새로고침이 작동하지 않는다.'
// The button was previously only calling loadFx() which re-reads the
// DB without triggering any provider HTTP fetch.
// ============================================================

if (!function_exists('fxwHttpGetJson')) {
    function fxwHttpGetJson(string $url, int $timeoutSec = 8): ?array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => max(2, intval($timeoutSec / 2)),
            CURLOPT_TIMEOUT        => $timeoutSec,
            CURLOPT_USERAGENT      => 'Silica-FX-Worker/1.0 (+https://silicarwa.kolstoken.com)',
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body === false) throw new RuntimeException("HTTP failed: $err");
        if ($code < 200 || $code >= 300) throw new RuntimeException("HTTP $code");
        $j = json_decode((string)$body, true);
        if (!is_array($j)) throw new RuntimeException("Invalid JSON");
        return $j;
    }
}

if (!function_exists('fxwFetchProvider')) {
    /**
     * Fetch the live rate (target ccy per 1 USDT) from one provider.
     * Returns 0 on ambiguous response; throws on HTTP / parse error.
     */
    function fxwFetchProvider(string $provider, string $ccy): float {
        $ccy = strtoupper(trim($ccy));
        $ccyL = strtolower($ccy);
        $provider = strtolower(trim($provider));

        if ($provider === 'coingecko') {
            $url = "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies={$ccyL}";
            $j = fxwHttpGetJson($url, 8);
            return (float)($j['tether'][$ccyL] ?? 0);
        }
        if ($provider === 'coinlore') {
            $tj = fxwHttpGetJson('https://api.coinlore.net/api/ticker/?id=518', 8);
            $usdt_usd = (float)($tj[0]['price_usd'] ?? 0);
            if ($usdt_usd <= 0) return 0.0;
            if ($ccy === 'USD') return $usdt_usd;
            $rj = fxwHttpGetJson('https://open.er-api.com/v6/latest/USD', 8);
            $usd_to_ccy = (float)($rj['rates'][$ccy] ?? 0);
            if ($usd_to_ccy <= 0) return 0.0;
            return $usdt_usd * $usd_to_ccy;
        }
        // (2026-05-18 v521) 운영자 보고: 환율 표기 안 됨. fx_worker_provider /
        //   fx_provider_chain 에 호스트명 'open.er-api.com' 이 그대로 들어가
        //   있어 'Unknown provider' throw → fetch 실패. 호스트명 형식도
        //   alias 로 인식.
        if ($provider === 'exchangerate-api' || $provider === 'er_api'
            || $provider === 'open.er-api.com' || $provider === 'er-api') {
            $j = fxwHttpGetJson('https://open.er-api.com/v6/latest/USD', 8);
            return (float)($j['rates'][$ccy] ?? 0);
        }
        if ($provider === 'frankfurter') {
            $j = fxwHttpGetJson("https://api.frankfurter.app/latest?from=USD&to={$ccy}", 8);
            return (float)($j['rates'][$ccy] ?? 0);
        }
        if ($provider === 'yahoo') {
            $pair = 'USD' . $ccy . '=X';
            $url = "https://query1.finance.yahoo.com/v8/finance/chart/" . urlencode($pair) . "?interval=1m&range=1d";
            $j = fxwHttpGetJson($url, 10);
            $meta = $j['chart']['result'][0]['meta'] ?? null;
            if (!is_array($meta)) return 0.0;
            $rate = (float)($meta['regularMarketPrice'] ?? 0);
            if ($rate <= 0) $rate = (float)($meta['previousClose'] ?? 0);
            return $rate;
        }
        throw new RuntimeException("Unknown provider: $provider");
    }
}

if (!function_exists('fxwRunProviderChain')) {
    /**
     * Iterate the configured provider chain for each currency.
     * First successful provider wins → REPLACE INTO fx_quote_latest.
     * Returns a structured report so HTTP callers can render success/failure.
     */
    function fxwRunProviderChain(array $currencies = ['KRW']): array {
        $rawChain = trim((string)(getSetting('fx_provider_chain', '') ?? ''));
        if ($rawChain === '') {
            $rawChain = trim((string)(getSetting('fx_worker_provider', 'coingecko') ?? 'coingecko'));
        }
        $providers = array_values(array_filter(
            array_map(fn($s) => strtolower(trim($s)), explode(',', $rawChain)),
            fn($s) => $s !== ''
        ));
        if (empty($providers)) $providers = ['coingecko'];

        $results = [];
        $anySuccess = false;
        $errors = [];

        foreach ($currencies as $ccy) {
            $ccy = strtoupper(trim($ccy));
            $rate = 0.0;
            $usedProvider = null;
            $attempts = [];

            foreach ($providers as $prov) {
                try {
                    $r = fxwFetchProvider($prov, $ccy);
                    if ($r > 0 && is_finite($r)) {
                        $rate = $r;
                        $usedProvider = $prov;
                        $attempts[] = ['provider' => $prov, 'ok' => true, 'rate' => $r];
                        break;
                    } else {
                        $attempts[] = ['provider' => $prov, 'ok' => false, 'note' => 'rate<=0'];
                    }
                } catch (Throwable $e) {
                    $attempts[] = ['provider' => $prov, 'ok' => false, 'note' => $e->getMessage()];
                }
            }

            if ($rate > 0 && $usedProvider) {
                $anySuccess = true;
                try {
                    DB::execute(
                        "REPLACE INTO fx_quote_latest (quote_currency, rate, provider, fetched_at) VALUES (?, ?, ?, NOW())",
                        [$ccy, $rate, $usedProvider]
                    );
                    try {
                        DB::execute(
                            "INSERT INTO fx_quotes (quote_currency, rate, provider, fetched_at) VALUES (?, ?, ?, NOW())",
                            [$ccy, $rate, $usedProvider]
                        );
                    } catch (Throwable $_) {}
                } catch (Throwable $e) {
                    $errors[] = "[$ccy] DB write failed: " . $e->getMessage();
                }
                $results[] = ['ccy' => $ccy, 'rate' => $rate, 'provider' => $usedProvider, 'attempts' => $attempts];
            } else {
                $errors[] = "[$ccy] all providers failed";
                $results[] = ['ccy' => $ccy, 'rate' => 0, 'provider' => null, 'attempts' => $attempts];
            }
        }

        if ($anySuccess) setSetting('fx_worker_last_success_at', date('Y-m-d H:i:s'));
        setSetting('fx_worker_last_error', $errors ? implode(' | ', $errors) : '');

        return [
            'ok' => $anySuccess,
            'results' => $results,
            'errors' => $errors,
        ];
    }
}
