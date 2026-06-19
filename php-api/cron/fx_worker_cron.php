<?php
/**
 * FX Worker Cron — Pulls live USDT/KRW (and other configured currencies)
 *   from a chain of public providers and writes the result to
 *   fx_quote_latest. Designed to run every 10–15 minutes via Hostinger
 *   cron (or whatever scheduler is available).
 *
 * Provider chain (settings.fx_provider_chain — comma-separated, ordered):
 *   coingecko          → Tether spot price in target currency (best for KRW)
 *   coinlore           → CoinLore tether ticker (USD only — combined with USD/KRW)
 *   exchangerate-api   → Open-access ER-API USD/KRW (treats USDT≈USD)
 *   frankfurter        → ECB-derived USD/KRW (treats USDT≈USD)
 *   yahoo              → Yahoo Finance public chart endpoint USDKRW=X
 *                        (treats USDT≈USD; no auth, widely used by yfinance
 *                        and similar libraries; Yahoo Japan does NOT publish
 *                        a public REST API — this global Yahoo endpoint is
 *                        the closest free equivalent)
 *
 * Behavior:
 *   - Iterate providers in order. First provider that returns rate>0 wins.
 *   - Write rate + provider + fetched_at to fx_quote_latest (REPLACE).
 *   - Record fx_worker_last_success_at on any success, fx_worker_last_error
 *     when ALL providers in the chain fail for a currency.
 *   - Does NOT touch settings.fx_*_per_usdt — those are only used as a
 *     fallback by getFxPerUsdt() if the live row is missing/stale.
 *
 * Sales / settlement / interest accounting code that strictly requires a
 * live rate calls fxRequireKrwOrThrow() (lib/fx.php), which throws a
 * RuntimeException when both live and manual sources are empty —
 * preventing transactions from running against a stale fallback.
 *
 * Usage:
 *   php cron/fx_worker_cron.php                  # all configured currencies
 *   php cron/fx_worker_cron.php --ccy=KRW        # single currency
 *   php cron/fx_worker_cron.php --dry-run        # report, don't write
 *   php cron/fx_worker_cron.php --verbose        # log per-provider attempts
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "CLI only";
    exit(1);
}

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../lib/config.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/helpers.php';

// ── CLI args ──────────────────────────────────────────────────────────
$ccyArg = null;
$dryRun = false;
$verbose = false;
foreach ($argv ?? [] as $arg) {
    if (preg_match('/^--ccy=(.+)$/', $arg, $m)) $ccyArg = strtoupper(trim($m[1]));
    if ($arg === '--dry-run') $dryRun = true;
    if ($arg === '--verbose' || $arg === '-v') $verbose = true;
}

$logLine = function (string $msg) use ($verbose) {
    fwrite(STDERR, '[fx-worker] ' . $msg . "\n");
    if (!$verbose) return;
};

// ── HTTP fetch helper (cURL with timeout) ────────────────────────────
function fxw_http_get_json(string $url, int $timeoutSec = 8): ?array {
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

    if ($body === false) {
        throw new RuntimeException("HTTP failed: $err");
    }
    if ($code < 200 || $code >= 300) {
        throw new RuntimeException("HTTP $code");
    }
    $j = json_decode((string)$body, true);
    if (!is_array($j)) {
        throw new RuntimeException("Invalid JSON");
    }
    return $j;
}

// ── Per-provider fetch ────────────────────────────────────────────────
//   Each function returns the rate (units of $ccy per 1 USDT) or 0 on
//   ambiguous response. Throws on transport / parsing errors so the
//   caller can record the failure detail.
function fxw_fetch(string $provider, string $ccy): float {
    $ccy = strtoupper(trim($ccy));
    $ccyL = strtolower($ccy);
    $provider = strtolower(trim($provider));

    if ($provider === 'coingecko') {
        // GET /api/v3/simple/price?ids=tether&vs_currencies=krw
        // → { "tether": { "krw": 1488.5 } }
        $url = "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies={$ccyL}";
        $j = fxw_http_get_json($url, 8);
        return (float)($j['tether'][$ccyL] ?? 0);
    }

    if ($provider === 'coinlore') {
        // CoinLore tether ticker — only gives USD rate. We then convert
        //   USD → target ccy via ExchangeRate-API as a side fetch. If
        //   either step fails, return 0 so the chain falls through.
        $tj = fxw_http_get_json('https://api.coinlore.net/api/ticker/?id=518', 8);
        $usdt_usd = (float)($tj[0]['price_usd'] ?? 0);
        if ($usdt_usd <= 0) return 0.0;
        if ($ccy === 'USD') return $usdt_usd;
        // Side fetch USD→ccy to multiply.
        $rj = fxw_http_get_json('https://open.er-api.com/v6/latest/USD', 8);
        $usd_to_ccy = (float)($rj['rates'][$ccy] ?? 0);
        if ($usd_to_ccy <= 0) return 0.0;
        return $usdt_usd * $usd_to_ccy;
    }

    if ($provider === 'exchangerate-api' || $provider === 'er_api') {
        // open.er-api.com gives USD-base rates. USDT is 1:1 USD-pegged
        //   so USD/ccy is a usable approximation when CoinGecko is down.
        $j = fxw_http_get_json('https://open.er-api.com/v6/latest/USD', 8);
        return (float)($j['rates'][$ccy] ?? 0);
    }

    if ($provider === 'frankfurter') {
        // Frankfurter (ECB-derived). Same USDT≈USD assumption as ER-API.
        //   /latest?from=USD&to=KRW returns { "rates": { "KRW": 1488.5 } }
        $j = fxw_http_get_json("https://api.frankfurter.app/latest?from=USD&to={$ccy}", 8);
        return (float)($j['rates'][$ccy] ?? 0);
    }

    if ($provider === 'yahoo') {
        // (2026-05-08) Yahoo Finance public chart endpoint — no auth, used
        //   widely by yfinance / yahoo-finance2 / etc. The pair is
        //   "USD<CCY>=X" (e.g. USDKRW=X) which gives the latest USD/CCY
        //   rate. We treat USDT as 1:1 USD (USDT is USD-pegged stablecoin)
        //   so this is a usable substitute for USDT/CCY when CoinGecko
        //   etc. fail.
        //
        //   Note: Yahoo Japan (finance.yahoo.co.jp) does NOT publish an
        //   official free REST API — Yahoo!ファイナンス API was deprecated
        //   years ago. This global Yahoo Finance endpoint is the closest
        //   free equivalent that operators commonly call "Yahoo".
        $pair = 'USD' . $ccy . '=X';
        $url = "https://query1.finance.yahoo.com/v8/finance/chart/" . urlencode($pair) . "?interval=1m&range=1d";
        $j = fxw_http_get_json($url, 10);
        $meta = $j['chart']['result'][0]['meta'] ?? null;
        if (!is_array($meta)) return 0.0;
        // regularMarketPrice is the latest trade; previousClose is the
        //   prior session close. Prefer regularMarketPrice; fall through
        //   so a stale-but-positive value is better than 0.
        $rate = (float)($meta['regularMarketPrice'] ?? 0);
        if ($rate <= 0) {
            $rate = (float)($meta['previousClose'] ?? 0);
        }
        return $rate;
    }

    throw new RuntimeException("Unknown provider: $provider");
}

// ── Main loop ─────────────────────────────────────────────────────────
$rawChain = trim((string)(getSetting('fx_provider_chain', '') ?? ''));
if ($rawChain === '') {
    $rawChain = trim((string)(getSetting('fx_worker_provider', 'coingecko') ?? 'coingecko'));
}
$providers = array_values(array_filter(
    array_map(fn($s) => strtolower(trim($s)), explode(',', $rawChain)),
    fn($s) => $s !== ''
));
if (empty($providers)) $providers = ['coingecko'];

// Currencies to fetch. Silica primarily uses KRW; the rest are
//   forward-compat shims that fail silently if the provider doesn't
//   expose them.
$DEFAULT_CCYS = ['KRW']; // Add 'USD','VND',etc. later if needed
$currencies = $ccyArg ? [$ccyArg] : $DEFAULT_CCYS;

$logLine("provider chain: " . implode(' → ', $providers));
$logLine("currencies: "     . implode(', ', $currencies));

$anySuccess = false;
$errors = [];

foreach ($currencies as $ccy) {
    $rate = 0.0;
    $usedProvider = null;
    $perCcyErrors = [];

    foreach ($providers as $prov) {
        try {
            $r = fxw_fetch($prov, $ccy);
            if ($r > 0 && is_finite($r)) {
                $rate = $r;
                $usedProvider = $prov;
                $logLine("✓ $ccy via $prov = $r");
                break;
            } else {
                $perCcyErrors[] = "$prov: rate<=0";
                $logLine("✗ $ccy via $prov returned $r");
            }
        } catch (Throwable $e) {
            $perCcyErrors[] = "$prov: " . $e->getMessage();
            $logLine("✗ $ccy via $prov: " . $e->getMessage());
        }
    }

    if ($rate > 0 && $usedProvider) {
        $anySuccess = true;
        if (!$dryRun) {
            DB::execute(
                "REPLACE INTO fx_quote_latest (quote_currency, rate, provider, fetched_at) VALUES (?, ?, ?, NOW())",
                [$ccy, $rate, $usedProvider]
            );
            // Also append to fx_quotes history (best-effort; ignore if table missing).
            try {
                DB::execute(
                    "INSERT INTO fx_quotes (quote_currency, rate, provider, fetched_at) VALUES (?, ?, ?, NOW())",
                    [$ccy, $rate, $usedProvider]
                );
            } catch (Throwable $_) {}
        }
    } else {
        $errors[] = "[$ccy] all providers failed: " . implode('; ', $perCcyErrors);
    }
}

// ── Update worker status flags ────────────────────────────────────────
if (!$dryRun) {
    if ($anySuccess) {
        setSetting('fx_worker_last_success_at', date('Y-m-d H:i:s'));
    }
    setSetting('fx_worker_last_error', $errors ? implode(' | ', $errors) : '');
}

if ($errors) {
    fwrite(STDERR, "[fx-worker] ⚠ errors: " . implode(' | ', $errors) . "\n");
    exit($anySuccess ? 0 : 2); // exit 2 when all failed (cron alert hint)
}
fwrite(STDERR, "[fx-worker] ✓ done\n");
exit(0);
