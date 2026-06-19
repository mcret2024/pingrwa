<?php
/**
 * Markets, Orders, Trades routes
 *
 * 이 라우트는 배포 환경마다 orders / trades 스키마가 조금씩 달라도
 * 동작하도록 컬럼 존재 여부를 런타임에 확인해 호환 처리한다.
 */

function marketTableColumns(string $table): array {
    static $cache = [];
    if (isset($cache[$table])) return $cache[$table];
    $rows = DB::fetchAll("SHOW COLUMNS FROM `{$table}`");
    $map = [];
    foreach ($rows as $r) {
        $map[$r['Field']] = $r;
    }
    return $cache[$table] = $map;
}

function marketHasColumn(string $table, string $column): bool {
    $cols = marketTableColumns($table);
    return isset($cols[$column]);
}

function marketTradeQtyColumn(): string {
    if (marketHasColumn('trades', 'qty')) return 'qty';
    if (marketHasColumn('trades', 'amount')) return 'amount';
    return '0';
}

function marketOrderRequiresManualId(): bool {
    $cols = marketTableColumns('orders');
    if (!isset($cols['id'])) return false;
    $extra = strtolower((string)($cols['id']['Extra'] ?? ''));
    return strpos($extra, 'auto_increment') === false;
}

function marketMakeOrderId(): string {
    try {
        return 'ord_' . gmdate('YmdHis') . '_' . bin2hex(random_bytes(4));
    } catch (Throwable $e) {
        return 'ord_' . gmdate('YmdHis') . '_' . substr(md5(uniqid('', true)), 0, 8);
    }
}

function marketNormalizeOrderRow(array $row): array {
    $row['id'] = (string)($row['id'] ?? '');
    $row['price'] = (float)($row['price'] ?? 0);
    $row['amount'] = (float)($row['amount'] ?? 0);
    $row['remaining'] = (float)($row['remaining'] ?? ($row['amount'] ?? 0));
    $row['escrow_usdt'] = (float)($row['escrow_usdt'] ?? 0);
    $row['escrow_token'] = (float)($row['escrow_token'] ?? 0);
    $row['fee_rate'] = (float)($row['fee_rate'] ?? 0);
    return $row;
}

/**
 * (2026-05-08) Apply minimum trade fee floor. Operator: '기본값으로
 *   최소한 0.001usdt 은 생기게 해줘.' When fee_pct > 0 the computed
 *   fee is forced to at least MIN_TRADE_FEE_USDT so micro-trades
 *   can't slip through with rounded-to-zero fees. When fee_pct === 0
 *   (admin set the asset to fee-free), no minimum applies — the
 *   admin's "free" intent is preserved.
 */
const MIN_TRADE_FEE_USDT = 0.001;
if (!function_exists('applyMinTradeFee')) {
    function applyMinTradeFee(float $fee, float $feePct, float $minFee = MIN_TRADE_FEE_USDT): float {
        if ($feePct <= 0) return 0.0;
        return $fee >= $minFee ? $fee : $minFee;
    }
}

function marketNormalizeTradeRow(array $row): array {
    $qty = array_key_exists('qty', $row) ? $row['qty'] : ($row['amount'] ?? 0);
    $row['qty'] = (float)$qty;
    $row['amount'] = (float)($row['amount'] ?? $qty);
    $row['price'] = (float)($row['price'] ?? 0);
    $row['total_usdt'] = (float)($row['total_usdt'] ?? ($row['price'] * $row['qty']));
    if (!isset($row['buyer_address']) && isset($row['taker_address'])) {
        $row['buyer_address'] = $row['taker_address'];
    }
    if (!isset($row['seller_address']) && isset($row['maker_address'])) {
        $row['seller_address'] = $row['maker_address'];
    }
    return $row;
}

function marketInsertOrder(array $data): string {
    $cols = marketTableColumns('orders');
    $insertCols = [];
    $params = [];
    $manualId = null;

    if (marketOrderRequiresManualId() && isset($cols['id'])) {
        $manualId = marketMakeOrderId();
        $insertCols[] = 'id';
        $params[] = $manualId;
    }

    $map = [
        'asset_id'     => $data['asset_id'] ?? null,
        'side'         => $data['side'] ?? null,
        'maker_address'=> $data['maker_address'] ?? null,
        'price'        => $data['price'] ?? 0,
        'amount'       => $data['amount'] ?? 0,
        'remaining'    => $data['remaining'] ?? 0,
        'expiry_date'  => $data['expiry_date'] ?? null,
        'escrow_usdt'  => $data['escrow_usdt'] ?? null,
        'escrow_token' => $data['escrow_token'] ?? null,
        'fee_rate'     => $data['fee_rate'] ?? null,
        'status'       => $data['status'] ?? 'open',
        'created_at'   => $data['created_at'] ?? nowUtcSql(),
    ];

    foreach ($map as $col => $val) {
        if (isset($cols[$col])) {
            $insertCols[] = $col;
            $params[] = $val;
        }
    }

    if (!$insertCols) {
        throw new RuntimeException('orders 테이블 컬럼을 확인할 수 없습니다.');
    }

    $quotedCols = '`' . implode('`,`', $insertCols) . '`';
    $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
    DB::execute("INSERT INTO orders ({$quotedCols}) VALUES ({$placeholders})", $params);

    if ($manualId !== null) return $manualId;
    $lastId = (string)DB::pdo()->lastInsertId();
    return $lastId !== '' ? $lastId : (string)(DB::fetchValue("SELECT id FROM orders WHERE maker_address=? ORDER BY created_at DESC LIMIT 1", [$data['maker_address'] ?? '']) ?? '');
}

function marketInsertTrade(array $data): void {
    $cols = marketTableColumns('trades');
    $insertCols = [];
    $params = [];

    $map = [
        'asset_id'       => $data['asset_id'] ?? null,
        'order_id'       => $data['order_id'] ?? null,
        'buyer_address'  => $data['buyer_address'] ?? null,
        'seller_address' => $data['seller_address'] ?? null,
        'maker_address'  => $data['maker_address'] ?? null,
        'taker_address'  => $data['taker_address'] ?? null,
        'price'          => $data['price'] ?? 0,
        'amount'         => $data['amount'] ?? 0,
        'qty'            => $data['amount'] ?? 0,
        'total_usdt'     => $data['total_usdt'] ?? 0,
        'created_at'     => $data['created_at'] ?? nowUtcSql(),
    ];

    foreach ($map as $col => $val) {
        if (isset($cols[$col])) {
            $insertCols[] = $col;
            $params[] = $val;
        }
    }

    if (!$insertCols) {
        throw new RuntimeException('trades 테이블 컬럼을 확인할 수 없습니다.');
    }

    $quotedCols = '`' . implode('`,`', $insertCols) . '`';
    $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
    DB::execute("INSERT INTO trades ({$quotedCols}) VALUES ({$placeholders})", $params);
}

/**
 * (2026-05-10 v214) Write wallet_transactions rows so trade fills show
 * up on /user/history.html under the Trade tab. Operator: '히스토리에서
 * 트레이드 거래 내역이 보이지 않는다.' Earlier markets.php only wrote to
 * the `trades` table; nothing landed in `wallet_transactions`, so the
 * history-page filter `/^(trade|order)/i` matched zero rows.
 *
 * One call per match → up to two rows (one per non-AMM party). Logs:
 *   - taker-buyer side  → kind='trade_buy',  asset='USDT', amount=cost
 *   - maker-seller side → kind='trade_sell', asset='USDT', amount=net
 *   - taker-seller side → kind='trade_sell', asset='USDT', amount=net
 *   - maker-buyer side  → kind='trade_buy',  asset='USDT', amount=cost
 *     (before==after — escrow was already debited at order placement;
 *      the row just marks the fill event in history)
 *
 * AMM platform address is filtered so we don't pollute platform history.
 * Failures are logged + swallowed so a history-table issue can never
 * roll back a successful trade.
 */
/**
 * (2026-05-10 v218 hardening) Input-validation guardrails for the market
 * endpoints. Operator: '거래 훔치기, db조작, 데이터주입, 마이너스값 주입,
 * 악성코드 주입 등의 방어를 진행해줘.'
 *
 * Layered defenses on top of what already exists:
 *   - All SQL goes through prepared statements (`DB::execute`,
 *     `DB::fetchOne` with bound params) — no string concatenation of
 *     user input into queries.
 *   - Order ownership: cancel-endpoint already filters by maker_address;
 *     fill-endpoint route handles the cross-user case.
 *   - Auth: all mutation endpoints behind authMfaRequired or adminAuth.
 *
 * What these helpers add:
 *   - is_finite() on every numeric input (blocks NaN / ±Infinity that
 *     PHP's (float) cast happily produces from the strings "NaN",
 *     "Infinity", "-Infinity" — those would otherwise sneak past
 *     `<= 0` checks and corrupt downstream math).
 *   - Lower & upper bounds on price/amount so a single trade cannot
 *     overflow accumulators or produce absurd USDT totals.
 *   - Format whitelist on asset_id (prevents weird characters from
 *     reaching SQL even via prepared params, and from being mirrored
 *     back into HTML).
 *   - Format whitelist on expiry_date (YYYY-MM-DD only).
 *   - Format whitelist on Solana addresses (base58 charset) when an
 *     address comes from request body rather than from the JWT.
 */

// Hard caps. Silica is a USDT-pegged STO, so a single trade clearing
// 1M USDT or 100M STO is very far outside reality and indicates abuse.
const MARKET_MAX_PRICE_USDT  = 1000000.0;     // 1M USDT per token
const MARKET_MAX_AMOUNT_TOK  = 100000000.0;   // 100M tokens per order

function marketRequireFinite(float $v, string $name): void {
    if (!is_finite($v)) {
        jsonError(400, "{$name} 값이 유효하지 않습니다.");
    }
}

function marketRequirePositive(float $v, string $name): void {
    marketRequireFinite($v, $name);
    if ($v <= 0) {
        jsonError(400, "{$name}은(는) 0 보다 커야 합니다.");
    }
}

function marketRequirePriceBounds(float $price): void {
    marketRequirePositive($price, '가격');
    if ($price > MARKET_MAX_PRICE_USDT) {
        jsonError(400, sprintf('가격이 허용 한도를 초과했습니다 (최대 %.0f USDT).', MARKET_MAX_PRICE_USDT));
    }
}

function marketRequireAmountBounds(float $amount): void {
    marketRequirePositive($amount, '수량');
    if ($amount > MARKET_MAX_AMOUNT_TOK) {
        jsonError(400, sprintf('수량이 허용 한도를 초과했습니다 (최대 %.0f).', MARKET_MAX_AMOUNT_TOK));
    }
}

function marketValidateAssetId(string $raw): string {
    $id = trim($raw);
    if ($id === '' || strlen($id) > 64 || !preg_match('/^[A-Za-z0-9_\-]+$/', $id)) {
        jsonError(400, 'asset_id 형식이 올바르지 않습니다.');
    }
    return $id;
}

function marketValidateExpiryDate($raw): ?string {
    if ($raw === null) return null;
    $d = trim((string)$raw);
    if ($d === '') return null;
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
        jsonError(400, 'expiry_date 형식이 올바르지 않습니다 (YYYY-MM-DD).');
    }
    [$y, $m, $day] = array_map('intval', explode('-', $d));
    if (!checkdate($m, $day, $y)) {
        jsonError(400, 'expiry_date 가 유효한 날짜가 아닙니다.');
    }
    // Limit to a reasonable horizon — 10 years out — so an attacker can't
    // park escrow indefinitely against year-9999 expiries.
    $maxYear = (int)date('Y') + 10;
    if ($y > $maxYear) {
        jsonError(400, "expiry_date 는 {$maxYear}년 이내여야 합니다.");
    }
    return $d;
}

function marketValidateAddress(string $raw, string $name = '주소'): string {
    $a = trim($raw);
    // Solana pubkey base58 alphabet (no 0, O, I, l). Be permissive on
    // length (Phantom addresses are 32-44; some tooling may use longer
    // hashed IDs) but bound it.
    if (!preg_match('/^[1-9A-HJ-NP-Za-km-z]{1,128}$/', $a)) {
        jsonError(400, "{$name} 형식이 올바르지 않습니다.");
    }
    return $a;
}

/**
 * (2026-05-11) AMM sweep — find OPEN sell orders priced ≤ amm_threshold
 * and process them through the same AMM auto-buy logic that runs on new
 * order placement. Operator: '자동 매수가 되지 않고 있다.' AMM only
 * triggers on new-order placement; orders placed before AMM was enabled
 * or before the threshold was raised sit in the book untouched until
 * this sweep runs.
 *
 * Each candidate processed in its own transaction so a partial pool can
 * still fill orders one-by-one and a per-order error doesn't roll back
 * earlier fills. Returns a summary report for admin display.
 */
function marketAmmSweepOpenSells(string $assetId): array {
    $report = [
        'scanned' => 0, 'filled_full' => 0, 'filled_partial' => 0,
        'skipped' => 0, 'pool_exhausted' => false, 'errors' => [],
    ];

    $ammThreshold = (float)(getSetting('amm_threshold', '0.8') ?? '0.8');
    if (!is_finite($ammThreshold) || $ammThreshold <= 0 || $ammThreshold > 1) {
        $ammThreshold = 0.8;
    }
    $ammEnabled = (getSetting('amm_enabled', '1') ?? '1') === '1';
    $ammAddrConst = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';
    if (!$ammEnabled) { $report['errors'][] = 'AMM 비활성화'; return $report; }
    if ($ammAddrConst === '') { $report['errors'][] = 'PLATFORM_AMM_ADDRESS 미정의'; return $report; }

    $asset = getAsset($assetId);
    if (!$asset) { $report['errors'][] = "asset '$assetId' 없음"; return $report; }
    // (2026-05-24 v823) 함수-레벨 $feePct 폐기 — P2P 매칭과 일관성 위해 per-order
    //   maker.fee_rate (placement-time fee) 사용. 이 값은 fallback 용으로만 보존
    //   (옛 주문 fee_rate 가 NULL 인 경우 현재 asset.fee_seller 적용).
    $assetSellerFeePct = (float)($asset['fee_seller'] ?? 0);

    $candidates = DB::fetchAll(
        "SELECT * FROM orders
          WHERE asset_id=?
            AND side='sell'
            AND status='open'
            AND remaining > 0
            AND price <= ?
            AND TRIM(maker_address) <> TRIM(?)
          ORDER BY price ASC, created_at ASC, id ASC",
        [$assetId, $ammThreshold + 0.0000001, $ammAddrConst]
    );
    $report['scanned'] = count($candidates);

    // (2026-05-20 v660) DIAGNOSTIC — sweep 가 skip 되는 원인 추적용 로그.
    //   error_log() 로 PHP error.log 에 출력 + $report['diag'] 에도 누적
    //   하여 API 응답에서 바로 확인 가능. 운영자 화면에서 brower DevTools
    //   Network 탭으로 응답 JSON 확인 가능.
    $report['diag'] = [];
    $report['diag'][] = sprintf(
        'sweep_start asset=%s threshold=%.6f amm_enabled=%d amm_addr_const=%s scanned=%d',
        $assetId, $ammThreshold, $ammEnabled ? 1 : 0,
        substr($ammAddrConst, 0, 12), count($candidates)
    );
    error_log('[amm-sweep] ' . end($report['diag']));

    foreach ($candidates as $cand) {
        // (2026-05-20 v661) BUGFIX — order ID 는 문자열 (예 'ord_20260520_xxxx').
        //   v660 진단으로 발견: (int) 캐스팅이 문자열을 0 으로 변환 →
        //   'WHERE id=0' 조회 실패 → 모든 sweep 후보가 SKIP order_not_open.
        //   marketMakeOrderId() 는 문자열 ID 를 생성하며 orders.id 컬럼은
        //   varchar 임 (marketOrderRequiresManualId() true 인 경우).
        $orderId = (string)$cand['id'];
        $price = (float)$cand['price'];
        $sellerAddr = (string)$cand['maker_address'];

        // (2026-05-24 v823) Per-order fee_pct — P2P 매칭 (marketAutoMatchAgainstBook,
        //   line 805) 과 동일 패턴. 매도자(maker)의 placement-time fee 유지.
        //   AMM maker 케이스 (이론상 sweep 후보로 등장하면 안 되지만 안전망)
        //   는 0% 처리. fee_rate 가 NULL 이면 현재 asset.fee_seller 로 fallback.
        $candIsAmm = ($ammAddrConst !== '' && trim($sellerAddr) === $ammAddrConst);
        $feePct = $candIsAmm ? 0.0 : (float)($cand['fee_rate'] ?? $assetSellerFeePct);

        $report['diag'][] = sprintf(
            'cand order_id=%s price=%.6f remaining_q=%.6f maker_addr=%s status_q=%s fee_pct=%.4f',
            $orderId, $price, (float)($cand['remaining'] ?? 0),
            substr($sellerAddr, 0, 12), (string)($cand['status'] ?? '?'), $feePct
        );
        error_log('[amm-sweep] ' . end($report['diag']));

        $pdo = DB::pdo();
        $pdo->beginTransaction();
        try {
            // Lock pool + check funds.
            DB::execute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
            $pb = DB::fetchOne("SELECT usdt_balance FROM platform_balance WHERE id=1 FOR UPDATE");
            $poolUsdt = (float)($pb['usdt_balance'] ?? 0);
            $report['diag'][] = sprintf('pool_locked usdt=%.6f', $poolUsdt);
            error_log('[amm-sweep] ' . end($report['diag']));
            if ($poolUsdt <= 0) {
                $pdo->rollBack();
                $report['pool_exhausted'] = true;
                $report['diag'][] = 'BREAK pool_exhausted (poolUsdt <= 0)';
                error_log('[amm-sweep] ' . end($report['diag']));
                break;
            }

            // Lock order row + recheck remaining (may have been partially
            //   filled by another concurrent flow since we scanned).
            $order = DB::fetchOne("SELECT * FROM orders WHERE id=? FOR UPDATE", [$orderId]);
            if (!$order || ($order['status'] ?? '') !== 'open') {
                $pdo->rollBack();
                $report['skipped']++;
                $report['diag'][] = sprintf(
                    'SKIP order_not_open found=%d status_now=%s',
                    $order ? 1 : 0, (string)($order['status'] ?? 'NULL')
                );
                error_log('[amm-sweep] ' . end($report['diag']));
                continue;
            }
            $remaining = clamp6((float)($order['remaining'] ?? 0));
            $report['diag'][] = sprintf(
                'order_locked remaining=%.6f escrow_token=%.6f',
                $remaining, (float)($order['escrow_token'] ?? 0)
            );
            error_log('[amm-sweep] ' . end($report['diag']));
            if ($remaining <= 0.000001) {
                $pdo->rollBack();
                $report['skipped']++;
                $report['diag'][] = sprintf('SKIP remaining_dust (remaining=%.6f)', $remaining);
                error_log('[amm-sweep] ' . end($report['diag']));
                continue;
            }

            // (2026-05-20 v657) AMM 매칭 시 매도자 수수료를 부과하지 않음.
            //   운영자 정책: 'AMM 에서 반대측 유저의 거래수수료를 감안할
            //   필요가 없다. 풀 지출은 gross 전체이어야 한다.'
            //   이전: 풀이 net(=gross−fee) 만 지급하여 fee 차액이 풀에 잔존.
            //   현재: 풀이 gross 전체 지급, 매도자도 gross 전체 수령. 수수료 0.
            $fullTradeUsdt = clamp6($price * $remaining);

            $ammAmount = 0.0; $ammTradeUsdt = 0.0;

            if ($poolUsdt + 0.0000001 >= $fullTradeUsdt) {
                $ammAmount = $remaining;
                $ammTradeUsdt = $fullTradeUsdt;
            } else if ($price > 0) {
                $rawMax = $poolUsdt / $price;
                // (2026-05-11 v260) Integer floor — matches the
                // inline AMM block change. Prevents fractional
                // dust in resting orders.
                $ammAmount = floor($rawMax);
                if ($ammAmount > $remaining) $ammAmount = $remaining;
                if ($ammAmount > 0) {
                    $ammTradeUsdt = clamp6($price * $ammAmount);
                    $safety = 0;
                    while ($ammTradeUsdt > $poolUsdt && $ammAmount >= 0.000002 && $safety < 10) {
                        $ammAmount = clamp6($ammAmount - 0.000001);
                        $ammTradeUsdt = clamp6($price * $ammAmount);
                        $safety++;
                    }
                    if ($ammTradeUsdt > $poolUsdt || $ammAmount <= 0) {
                        $ammAmount = 0.0;
                        $ammTradeUsdt = 0.0;
                    }
                }
            }

            // (v660) DIAGNOSTIC — 계산 결과 로깅
            $report['diag'][] = sprintf(
                'calc fullTradeUsdt=%.6f poolUsdt=%.6f ammAmount=%.6f ammTradeUsdt=%.6f',
                $fullTradeUsdt, $poolUsdt, $ammAmount, $ammTradeUsdt
            );
            error_log('[amm-sweep] ' . end($report['diag']));

            if ($ammAmount <= 0) {
                $pdo->rollBack();
                $report['skipped']++;
                $report['diag'][] = sprintf(
                    'SKIP amm_amount_zero (fullTradeUsdt=%.6f poolUsdt=%.6f price=%.6f)',
                    $fullTradeUsdt, $poolUsdt, $price
                );
                error_log('[amm-sweep] ' . end($report['diag']));
                continue;
            }

            ensureUser(PLATFORM_AMM_ADDRESS);
            ensureHolding(PLATFORM_AMM_ADDRESS, $assetId);

            $sellerBalRow = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$sellerAddr]);
            $sellerUsdtBefore = (float)($sellerBalRow['usdt'] ?? 0);

            // (2026-05-20 v658) 운영자 정책 최종 — AMM 매칭 시:
            //   - 매도자는 거래수수료(USDT) 차감된 net 수령
            //   - 풀은 gross 전체 지출 (수수료 환원 없음)
            //   - 차액(seller fee)은 스왑/출금 수수료처럼 시스템 총량에서
            //     사라지는 방식으로 implicit platform 수익.
            $ammSellerFee = applyMinTradeFee(floor3($ammTradeUsdt * $feePct / 100), $feePct);
            $ammSellerNet = clamp6($ammTradeUsdt - $ammSellerFee);

            DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$ammSellerNet, $sellerAddr]);
            DB::execute("UPDATE platform_balance SET usdt_balance=usdt_balance-? WHERE id=1", [$ammTradeUsdt]);
            DB::execute(
                "UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?",
                [$ammAmount, PLATFORM_AMM_ADDRESS, $assetId]
            );

            // Update the resting order: decrement remaining + escrow_token.
            $newRemaining = clamp6($remaining - $ammAmount);
            $newEscrowTok = clamp6(max(0, (float)($order['escrow_token'] ?? 0) - $ammAmount));
            $newStatus = $newRemaining <= 0.000001 ? 'filled' : 'open';
            DB::execute(
                "UPDATE orders SET remaining=?, escrow_token=?, status=? WHERE id=?",
                [$newRemaining, $newEscrowTok, $newStatus, $orderId]
            );

            marketInsertTrade([
                'asset_id'       => $assetId,
                'order_id'       => $orderId,
                'buyer_address'  => PLATFORM_AMM_ADDRESS,
                'seller_address' => $sellerAddr,
                'maker_address'  => $sellerAddr,
                'taker_address'  => PLATFORM_AMM_ADDRESS,
                'price'          => $price,
                'amount'         => $ammAmount,
                'total_usdt'     => $ammTradeUsdt,
                'created_at'     => nowUtcSql(),
            ]);

            // Wallet-tx mirror for seller's history.
            // (v658) makerFee=$ammSellerFee → 매도자 history 에
            //   trade_sell_recv (+gross) + trade_sell_fee (-fee) 2행 표시.
            marketLogTradeFill([
                'takerAddress'    => PLATFORM_AMM_ADDRESS,
                'makerAddress'    => $sellerAddr,
                'takerSide'       => 'buy',
                'matchQty'        => $ammAmount,
                'matchPrice'      => $price,
                'matchUsdt'       => $ammTradeUsdt,
                'takerFee'        => 0.0,
                'makerFee'        => $ammSellerFee,
                'takerUsdtBefore' => 0.0,
                'makerUsdtBefore' => $sellerUsdtBefore,
                'makerOrderId'    => $orderId,
                'assetSymbol'     => 'SilicaSTO',
            ]);

            $pdo->commit();
            if ($newStatus === 'filled') $report['filled_full']++;
            else $report['filled_partial']++;
            // (v660) DIAGNOSTIC — 체결 성공 로그 (v661: order_id 는 string → %s)
            $report['diag'][] = sprintf(
                'COMMIT order_id=%s ammAmount=%.6f ammTradeUsdt=%.6f sellerNet=%.6f newStatus=%s',
                $orderId, $ammAmount, $ammTradeUsdt, $ammSellerNet, $newStatus
            );
            error_log('[amm-sweep] ' . end($report['diag']));

            // (2026-05-20 v655) AMM 매수 감사 로그.
            //   sweep 경로에서 발생한 1건 기록. v657: balance_after 는 gross
            //   차감 후 잔고 ($poolUsdt - $ammTradeUsdt).
            // (v662) 감사 로그 INSERT 결과를 명시적으로 검증하여 diag 에 기록.
            $auditOk = false;
            if (function_exists('ammAuditLog')) {
                try {
                    $beforeId = (int)(DB::fetchValue("SELECT MAX(id) FROM amm_admin_audit") ?? 0);
                    ammAuditLog(null, 'auto_buy', [
                        'asset_id'       => $assetId,
                        'amount'         => $ammAmount,
                        'price'          => $price,
                        'order_id'       => (string)$orderId,
                        'balance_before' => $poolUsdt,
                        'balance_after'  => clamp6($poolUsdt - $ammTradeUsdt),
                        'note'           => 'sweep',
                    ]);
                    $afterId = (int)(DB::fetchValue("SELECT MAX(id) FROM amm_admin_audit") ?? 0);
                    $auditOk = $afterId > $beforeId;
                    $report['diag'][] = sprintf(
                        'audit_log auditOk=%d before_id=%d after_id=%d',
                        $auditOk ? 1 : 0, $beforeId, $afterId
                    );
                    error_log('[amm-sweep] ' . end($report['diag']));
                } catch (Throwable $auditErr) {
                    $report['diag'][] = 'audit_log EXCEPTION: ' . $auditErr->getMessage();
                    error_log('[amm-sweep] ' . end($report['diag']));
                }
            } else {
                $report['diag'][] = 'audit_log SKIP: ammAuditLog function not loaded';
                error_log('[amm-sweep] ' . end($report['diag']));
            }
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $report['errors'][] = "order #$orderId: " . $e->getMessage();
            // (v660) DIAGNOSTIC — 예외 발생 로그 (v661: order_id %s)
            $report['diag'][] = sprintf(
                'EXCEPTION order_id=%s msg=%s file=%s:%d',
                $orderId, $e->getMessage(),
                basename($e->getFile()), $e->getLine()
            );
            error_log('[amm-sweep] ' . end($report['diag']));
        }
    }

    return $report;
}

function marketLogTradeFill(array $a): void {
    // (2026-05-10 v218) Diagnostic — confirms the helper actually fires
    //   when fills happen. Operator: '트레이드 기록이 안나온다.' Logs to
    //   PHP error_log so we can verify deploy + execution.
    error_log(sprintf(
        '[marketLogTradeFill] side=%s qty=%s price=%s usdt=%s taker=%s maker=%s order#%s',
        (string)($a['takerSide'] ?? '?'),
        (string)($a['matchQty'] ?? '?'),
        (string)($a['matchPrice'] ?? '?'),
        (string)($a['matchUsdt'] ?? '?'),
        substr((string)($a['takerAddress'] ?? '?'), 0, 8),
        substr((string)($a['makerAddress'] ?? '?'), 0, 8),
        (string)($a['makerOrderId'] ?? '?')
    ));
    $now    = nowUtcSql();
    $ammAddr = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';
    $isAmm  = function (string $addr) use ($ammAddr): bool {
        return $ammAddr !== '' && trim($addr) === $ammAddr;
    };
    $fmtQty = function (float $n): string {
        return rtrim(rtrim(number_format($n, 6, '.', ''), '0'), '.') ?: '0';
    };
    $fmtUsdt = function (float $n): string { return number_format($n, 6, '.', ''); };
    $fmtPx   = function (float $n): string { return number_format($n, 2, '.', ''); };

    $taker  = (string)$a['takerAddress'];
    $maker  = (string)$a['makerAddress'];
    $side   = (string)$a['takerSide'];           // 'buy' | 'sell'
    $qty    = (float)$a['matchQty'];
    $px     = (float)$a['matchPrice'];
    $usdt   = (float)$a['matchUsdt'];
    $tFee   = (float)$a['takerFee'];
    $mFee   = (float)$a['makerFee'];
    $tBefore = (float)$a['takerUsdtBefore'];
    $mBefore = (float)$a['makerUsdtBefore'];
    // (2026-05-20 v661) order_id 는 문자열 ('ord_YYYYmmddHHMMSS_xxxxxxxx').
    //   v660 진단으로 발견: (int) 캐스팅이 문자열을 0 으로 변환 → memo 에
    //   'order #0' 으로 출력. (string) 으로 변경 + 아래 sprintf %d → %s.
    $oid    = (string)($a['makerOrderId'] ?? '');
    $sym    = (string)($a['assetSymbol'] ?? 'SilicaSTO');

    // (2026-05-10 v220) Emit 3 rows per non-AMM party so history shows
    //   the token leg + the gross USDT leg + the fee separately.
    //   Operator: '거래 수수료 표기가 누락 / 토큰 거래 표기가 누락
    //   (usdt만 표기 되고 있다).'
    //
    //   Buyer side:
    //     trade_buy        SilicaSTO  +qty            (token gained)
    //     trade_buy_pay    USDT       -matchUsdt      (gross USDT paid)
    //     trade_buy_fee    USDT       -fee            (fee paid, only if > 0)
    //
    //   Seller side:
    //     trade_sell       SilicaSTO  -qty            (token sold)
    //     trade_sell_recv  USDT       +matchUsdt      (gross USDT received)
    //     trade_sell_fee   USDT       -fee            (fee paid, only if > 0)
    $insert = function (string $addr, string $kind, string $asset, float $amount, float $before, float $after, string $memo) use ($now): void {
        try {
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                [$addr, $kind, '완료', $asset, $amount, $before, $after, $memo, $now]
            );
        } catch (Throwable $e) {
            error_log('[marketLogTradeFill] ' . $e->getMessage());
        }
    };

    // Resolve buyer / seller addresses + their respective fees regardless
    //   of which side is taker.
    if ($side === 'buy') {
        $buyerAddr   = $taker;  $buyerFee   = $tFee; $buyerUsdtBefore  = $tBefore;
        $sellerAddr  = $maker;  $sellerFee  = $mFee; $sellerUsdtBefore = $mBefore;
    } else {
        $buyerAddr   = $maker;  $buyerFee   = $mFee; $buyerUsdtBefore  = $mBefore;
        $sellerAddr  = $taker;  $sellerFee  = $tFee; $sellerUsdtBefore = $tBefore;
    }

    // ---- Buyer rows ----
    if (!$isAmm($buyerAddr)) {
        // Token gained
        $insert(
            $buyerAddr, 'trade_buy', $sym, $qty,
            0, $qty,
            sprintf('Bought %s %s @ %s USDT (order #%s)',
                $fmtQty($qty), $sym, $fmtPx($px), $oid)
        );
        // USDT gross paid (no fee)
        $afterPay = clamp6($buyerUsdtBefore - $usdt);
        $insert(
            $buyerAddr, 'trade_buy_pay', 'USDT', $usdt,
            $buyerUsdtBefore, $afterPay,
            sprintf('Buy payment for %s %s @ %s USDT (order #%s)',
                $fmtQty($qty), $sym, $fmtPx($px), $oid)
        );
        // Fee (only if > 0)
        if ($buyerFee > 0) {
            $afterFee = clamp6($afterPay - $buyerFee);
            $insert(
                $buyerAddr, 'trade_buy_fee', 'USDT', $buyerFee,
                $afterPay, $afterFee,
                sprintf('Buy fee for %s %s (order #%s)',
                    $fmtQty($qty), $sym, $oid)
            );
        }
    }

    // ---- Seller rows ----
    if (!$isAmm($sellerAddr)) {
        // Token sold
        $insert(
            $sellerAddr, 'trade_sell', $sym, $qty,
            $qty, 0,
            sprintf('Sold %s %s @ %s USDT (order #%s)',
                $fmtQty($qty), $sym, $fmtPx($px), $oid)
        );
        // USDT gross received (no fee)
        $afterRecv = clamp6($sellerUsdtBefore + $usdt);
        $insert(
            $sellerAddr, 'trade_sell_recv', 'USDT', $usdt,
            $sellerUsdtBefore, $afterRecv,
            sprintf('Sell proceeds from %s %s @ %s USDT (order #%s)',
                $fmtQty($qty), $sym, $fmtPx($px), $oid)
        );
        // Fee (only if > 0)
        if ($sellerFee > 0) {
            $afterFee = clamp6($afterRecv - $sellerFee);
            $insert(
                $sellerAddr, 'trade_sell_fee', 'USDT', $sellerFee,
                $afterRecv, $afterFee,
                sprintf('Sell fee for %s %s (order #%s)',
                    $fmtQty($qty), $sym, $oid)
            );
        }
    }
}

/**
 * (2026-05-08) Auto-match a NEW taker order against opposing maker orders
 * already resting on the book.
 *
 * Operator: '나의 매수 주문이 오더북에 들어가지 않는다' followed by '거래가
 * 체결 되었지만 차트가 생성 되지 않고 거래량 변동이 없다.' Diagnosis:
 * order placement was insert-only — no maker-vs-taker matching at all.
 * AMM auto-buy existed for distress sells but no plain book crossing,
 * so a buy at 1.00 + sell at 1.00 would both sit in the book forever
 * even though they should match on placement.
 *
 * Match price: maker's price (price-time priority — better for the
 * taker on price improvement). The taker pre-deducts escrow at
 * taker-price elsewhere; this function transfers actually-paid amounts
 * per-match and lets the caller refund any leftover at the end.
 *
 * Self-trade prevention: skips makers whose maker_address === taker.
 *
 * Returns:
 *   filled            float — total qty matched
 *   cash_buyer_paid   float — total USDT debited from BUYER (gross + buyer fee)
 *   cash_seller_recv  float — total USDT credited to SELLER (gross − seller fee)
 *   total_gross_usdt  float — sum of matchPrice × matchQty
 *   trades            array — list of per-match summaries (for response)
 *
 * Caller must already be inside a transaction.
 */
function marketAutoMatchAgainstBook(
    string $assetId,
    string $takerSide,
    string $takerAddress,
    float  $takerPrice,
    float  $takerAmount,
    float  $takerFeePct,
    float  $assetBuyerFeePct,
    float  $assetSellerFeePct
): array {
    $remaining       = $takerAmount;
    $totalFilled     = 0.0;
    $totalGrossUsdt  = 0.0;
    $cashBuyerPaid   = 0.0;
    $cashSellerRecv  = 0.0;
    $tradesOut       = [];

    $oppositeSide = ($takerSide === 'buy') ? 'sell' : 'buy';
    $priceCmp     = ($takerSide === 'buy') ? '<=' : '>=';
    $orderBy      = ($takerSide === 'buy')
        ? 'price ASC, created_at ASC, id ASC'
        : 'price DESC, created_at ASC, id ASC';

    $ammAddrConst = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';

    // (2026-05-08 v2) Self-trade policy — operator: '자기자신의 주문을
    //   차단하지마.' Default flipped to ALLOW self-trade. A user's own
    //   buy and sell at crossing prices now match each other. Block can
    //   be re-enabled via settings.allow_self_trade='0' if wash-trading
    //   becomes a real concern.
    $allowSelfTrade = true;
    try {
        $allowSelfTrade = (string)(getSetting('allow_self_trade', '1') ?? '1') !== '0';
    } catch (Throwable $_) {}
    $selfTradeFilter = $allowSelfTrade
        ? ''
        : 'AND TRIM(maker_address) <> TRIM(?)';

    $maxIterations = 50; // hard cap for safety
    while ($remaining > 0.000001 && $maxIterations-- > 0) {
        $params = [$assetId, $oppositeSide, $takerPrice];
        if (!$allowSelfTrade) $params[] = $takerAddress;
        $maker = DB::fetchOne(
            "SELECT * FROM orders
             WHERE asset_id=? AND side=? AND status='open' AND remaining > 0
               AND price {$priceCmp} ?
               {$selfTradeFilter}
             ORDER BY {$orderBy}
             LIMIT 1
             FOR UPDATE",
            $params
        );
        if (!$maker) break;

        $matchPrice = (float)$maker['price'];
        $matchQty   = min($remaining, (float)$maker['remaining']);
        if ($matchQty <= 0.000001) break;

        $matchUsdt  = clamp6($matchPrice * $matchQty);

        $makerAddr   = (string)$maker['maker_address'];
        $makerIsAmm  = ($ammAddrConst !== '' && trim($makerAddr) === $ammAddrConst);
        $takerIsAmm  = ($ammAddrConst !== '' && trim($takerAddress) === $ammAddrConst);

        if ($takerSide === 'buy') {
            // Buyer = taker, seller = maker
            $buyerFeeRate  = $takerIsAmm ? 0.0 : $takerFeePct;
            $sellerFeeRate = $makerIsAmm ? 0.0 : (float)($maker['fee_rate'] ?? $assetSellerFeePct);
            $buyerFee  = applyMinTradeFee(floor3($matchUsdt * $buyerFeeRate / 100), $buyerFeeRate);
            $sellerFee = applyMinTradeFee(floor3($matchUsdt * $sellerFeeRate / 100), $sellerFeeRate);
            $sellerNet = clamp6($matchUsdt - $sellerFee);
            $buyerCost = clamp6($matchUsdt + $buyerFee);

            // Buyer balance debit (NOTE: caller did NOT pre-escrow yet for
            //   matched portion. We debit directly here.)
            // (2026-05-20 v667) takerIsAmm 시 USDT는 platform_balance 에 있음.
            if ($takerIsAmm) {
                DB::execute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
                $poolRow = DB::fetchOne("SELECT usdt_balance FROM platform_balance WHERE id=1 FOR UPDATE");
                $buyerUsdtBeforeFill = (float)($poolRow['usdt_balance'] ?? 0);
                if ($buyerUsdtBeforeFill + 0.000001 < $buyerCost) break;
            } else {
                $buyerBal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$takerAddress]);
                if ((float)($buyerBal['usdt'] ?? 0) + 0.000001 < $buyerCost) break;
                $buyerUsdtBeforeFill  = (float)($buyerBal['usdt'] ?? 0);
            }
            // (2026-05-10 v214) Capture before-balances for wallet_transactions.
            $sellerBalRow         = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$makerAddr]);
            $sellerUsdtBeforeFill = (float)($sellerBalRow['usdt'] ?? 0);
            if ($takerIsAmm) {
                DB::execute("UPDATE platform_balance SET usdt_balance = usdt_balance - ? WHERE id=1", [$buyerCost]);
            } else {
                DB::execute("UPDATE balances SET usdt = usdt - ? WHERE address=?", [$buyerCost, $takerAddress]);
            }

            // Seller (maker) receives net USDT
            DB::execute("UPDATE balances SET usdt = usdt + ? WHERE address=?", [$sellerNet, $makerAddr]);

            // Buyer (taker) receives token from maker's escrow_token
            ensureHolding($takerAddress, $assetId);
            DB::execute(
                "UPDATE holdings SET balance_token = balance_token + ? WHERE address=? AND asset_id=?",
                [$matchQty, $takerAddress, $assetId]
            );

            // Decrement maker's escrow_token + remaining; mark filled if exhausted
            $newMakerRemaining = clamp6((float)$maker['remaining'] - $matchQty);
            $newMakerEscrowTok = clamp6(max(0, (float)($maker['escrow_token'] ?? 0) - $matchQty));
            DB::execute(
                "UPDATE orders SET remaining=?, escrow_token=?, status=? WHERE id=?",
                [
                    $newMakerRemaining,
                    $newMakerEscrowTok,
                    $newMakerRemaining <= 0.000001 ? 'filled' : 'open',
                    $maker['id'],
                ]
            );

            // (2026-05-20 v664) 운영자 정책: 모든 fee 를 implicit 처리하여
            //   통일성 유지. 스왑/출금/AMM 매칭과 동일하게, 오더북 매수자/
            //   매도자 fee 도 platform_balance 로 credit 하지 않음.
            //   결과: 시스템 총 USDT 가 (buyerFee + sellerFee) 만큼 감소,
            //   운영자 implicit 수익 (DB 잔고 누적 없음). AMM 풀은 운영자가
            //   명시적으로 충전한 잔액 + 이전 잔여만 보유 — fee 누적 영향 없음.
            // (이전 v663 까지) platform_balance += (buyerFee + sellerFee)

            $cashBuyerPaid  = clamp6($cashBuyerPaid  + $buyerCost);
            $cashSellerRecv = clamp6($cashSellerRecv + $sellerNet);
        } else {
            // Seller = taker, buyer = maker
            $buyerFeeRate  = $makerIsAmm ? 0.0 : (float)($maker['fee_rate'] ?? $assetBuyerFeePct);
            $sellerFeeRate = $takerIsAmm ? 0.0 : $takerFeePct;
            $buyerFee  = applyMinTradeFee(floor3($matchUsdt * $buyerFeeRate / 100), $buyerFeeRate);
            $sellerFee = applyMinTradeFee(floor3($matchUsdt * $sellerFeeRate / 100), $sellerFeeRate);
            $sellerNet = clamp6($matchUsdt - $sellerFee);
            $buyerEscrowConsumed = clamp6($matchUsdt + $buyerFee);

            // (2026-05-10 v214) Capture before-balances for wallet_transactions.
            // (2026-05-20 v667) takerIsAmm 시 USDT는 platform_balance 에 있음.
            if ($takerIsAmm) {
                DB::execute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
                $poolRow = DB::fetchOne("SELECT usdt_balance FROM platform_balance WHERE id=1 FOR UPDATE");
                $sellerUsdtBeforeFill = (float)($poolRow['usdt_balance'] ?? 0);
            } else {
                $sellerBalRow         = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$takerAddress]);
                $sellerUsdtBeforeFill = (float)($sellerBalRow['usdt'] ?? 0);
            }
            $buyerBalRow          = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$makerAddr]);
            $buyerUsdtBeforeFill  = (float)($buyerBalRow['usdt'] ?? 0);

            // Seller (taker) receives net USDT
            // (v667) takerIsAmm → platform_balance 로 credit, 일반 유저 → balances
            if ($takerIsAmm) {
                DB::execute("UPDATE platform_balance SET usdt_balance = usdt_balance + ? WHERE id=1", [$sellerNet]);
            } else {
                DB::execute("UPDATE balances SET usdt = usdt + ? WHERE address=?", [$sellerNet, $takerAddress]);
            }

            // Buyer (maker) receives token (taker's tokens are already debited
            //   from holdings before calling this function)
            ensureHolding($makerAddr, $assetId);
            DB::execute(
                "UPDATE holdings SET balance_token = balance_token + ? WHERE address=? AND asset_id=?",
                [$matchQty, $makerAddr, $assetId]
            );

            // Decrement maker's escrow_usdt + remaining; mark filled if exhausted
            $newMakerRemaining = clamp6((float)$maker['remaining'] - $matchQty);
            $newMakerEscrow    = clamp6(max(0, (float)($maker['escrow_usdt'] ?? 0) - $buyerEscrowConsumed));
            // If maker fully filled and any escrow rounding remains, refund to buyer
            if ($newMakerRemaining <= 0.000001 && $newMakerEscrow > 0) {
                DB::execute("UPDATE balances SET usdt = usdt + ? WHERE address=?", [$newMakerEscrow, $makerAddr]);
                $newMakerEscrow = 0;
            }
            DB::execute(
                "UPDATE orders SET remaining=?, escrow_usdt=?, status=? WHERE id=?",
                [
                    $newMakerRemaining,
                    $newMakerEscrow,
                    $newMakerRemaining <= 0.000001 ? 'filled' : 'open',
                    $maker['id'],
                ]
            );

            // (2026-05-20 v664) 운영자 정책: fee 통일 implicit 처리.
            //   매도 taker (셀러) + 매수 maker (바이어) 경로 — 동일하게
            //   buyerFee + sellerFee 는 platform_balance 로 credit 하지 않음.


            $cashSellerRecv = clamp6($cashSellerRecv + $sellerNet);
            $cashBuyerPaid  = clamp6($cashBuyerPaid  + $buyerEscrowConsumed);
        }

        // Insert trade row (shared between buy/sell takers)
        $buyerAddrTrade  = ($takerSide === 'buy') ? $takerAddress : $makerAddr;
        $sellerAddrTrade = ($takerSide === 'buy') ? $makerAddr    : $takerAddress;
        marketInsertTrade([
            'asset_id'       => $assetId,
            'order_id'       => $maker['id'],
            'buyer_address'  => $buyerAddrTrade,
            'seller_address' => $sellerAddrTrade,
            'maker_address'  => $makerAddr,
            'taker_address'  => $takerAddress,
            'price'          => $matchPrice,
            'amount'         => $matchQty,
            'total_usdt'     => $matchUsdt,
            'created_at'     => nowUtcSql(),
        ]);

        // (2026-05-10 v214) Mirror the fill into wallet_transactions so
        //   the user's history page Trade tab actually populates.
        if ($takerSide === 'buy') {
            marketLogTradeFill([
                'takerAddress'    => $takerAddress,
                'makerAddress'    => $makerAddr,
                'takerSide'       => 'buy',
                'matchQty'        => $matchQty,
                'matchPrice'      => $matchPrice,
                'matchUsdt'       => $matchUsdt,
                'takerFee'        => $buyerFee,
                'makerFee'        => $sellerFee,
                'takerUsdtBefore' => $buyerUsdtBeforeFill,
                'makerUsdtBefore' => $sellerUsdtBeforeFill,
                'makerOrderId'    => (int)$maker['id'],
                'assetSymbol'     => 'SilicaSTO',
            ]);
        } else {
            marketLogTradeFill([
                'takerAddress'    => $takerAddress,
                'makerAddress'    => $makerAddr,
                'takerSide'       => 'sell',
                'matchQty'        => $matchQty,
                'matchPrice'      => $matchPrice,
                'matchUsdt'       => $matchUsdt,
                'takerFee'        => $sellerFee,
                'makerFee'        => $buyerFee,
                'takerUsdtBefore' => $sellerUsdtBeforeFill,
                'makerUsdtBefore' => $buyerUsdtBeforeFill,
                'makerOrderId'    => (int)$maker['id'],
                'assetSymbol'     => 'SilicaSTO',
            ]);
        }

        $tradesOut[] = ['price' => $matchPrice, 'qty' => $matchQty, 'usdt' => $matchUsdt];
        $totalFilled    = clamp6($totalFilled    + $matchQty);
        $totalGrossUsdt = clamp6($totalGrossUsdt + $matchUsdt);
        $remaining      = clamp6($remaining      - $matchQty);
    }

    return [
        'filled'           => $totalFilled,
        'cash_buyer_paid'  => $cashBuyerPaid,
        'cash_seller_recv' => $cashSellerRecv,
        'total_gross_usdt' => $totalGrossUsdt,
        'trades'           => $tradesOut,
    ];
}



if (!function_exists('marketResolveAssetStatus')) {
    function marketResolveAssetStatus(?array $asset): string {
        if (!is_array($asset)) return '';
        return trim((string)($asset['display_status'] ?? $asset['status'] ?? ''));
    }
}

if (!function_exists('marketIsAssetTradeable')) {
    function marketIsAssetTradeable(?array $asset): bool {
        if (!is_array($asset)) return false;
        $status = trim((string)($asset['status'] ?? ''));
        return in_array($status, TRADEABLE_STATUSES, true);
    }
}

if (!function_exists('marketTradeDisabledMessage')) {
    function marketTradeDisabledMessage(?array $asset): string {
        $status = marketResolveAssetStatus($asset);
        if (isSoldLikeAssetStatus($status)) {
            return '매각 자산은 거래할 수 없습니다. 매각 페이지에서만 교환할 수 있습니다.';
        }
        if ($status === STATUSES['FUNDING']) {
            return '모금 단계 자산은 아직 거래할 수 없습니다.';
        }
        if ($status === STATUSES['PURCHASING']) {
            return '매입 진행 중 자산은 아직 거래할 수 없습니다.';
        }
        if ($status === STATUSES['FAILED'] || $status === STATUSES['CANCELLED']) {
            return '종료된 자산은 거래할 수 없습니다.';
        }
        return '거래 불가 상태입니다.';
    }
}

if (!function_exists('marketCancelOpenOrdersForAsset')) {
    function marketCancelOpenOrdersForAsset(string $assetId): array {
        $assetId = trim($assetId);
        $summary = [
            'cancelled_order_count' => 0,
            'refunded_buy_escrow_usdt' => 0.0,
            'refunded_sell_escrow_token' => 0.0,
            'cancelled_order_maker_count' => 0,
        ];
        if ($assetId === '') return $summary;

        $rows = DB::fetchAll(
            "SELECT * FROM orders WHERE asset_id=? AND status='open' FOR UPDATE",
            [$assetId]
        );
        if (!$rows) return $summary;

        $makers = [];
        foreach ($rows as $row) {
            $order = marketNormalizeOrderRow($row);
            $orderId = (string)($order['id'] ?? '');
            $maker = trim((string)($order['maker_address'] ?? ''));
            if ($maker === '') {
                throw new RuntimeException('주문 생성자 정보가 비어 있는 열린 주문이 있어 자동 취소를 완료할 수 없습니다.', 500);
            }

            if (($order['side'] ?? '') === 'buy') {
                $refund = clamp6(max(0, (float)($order['escrow_usdt'] ?? 0)));
                if ($refund > 0) {
                    ensureUser($maker);
                    DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$refund, $maker]);
                    $summary['refunded_buy_escrow_usdt'] += $refund;
                }
            } else {
                $refund = clamp6(max(0, (float)($order['escrow_token'] ?? 0)));
                if ($refund <= 0) {
                    $refund = clamp6(max(0, (float)($order['remaining'] ?? 0)));
                }
                if ($refund > 0) {
                    ensureHolding($maker, $assetId);
                    DB::execute(
                        "UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?",
                        [$refund, $maker, $assetId]
                    );
                    $summary['refunded_sell_escrow_token'] += $refund;
                }
            }

            if ($orderId !== '') {
                DB::execute(
                    "UPDATE orders SET status='cancelled', remaining=0, escrow_usdt=0, escrow_token=0 WHERE id=?",
                    [$orderId]
                );
            }
            $summary['cancelled_order_count']++;
            $makers[$maker] = true;
        }

        $summary['refunded_buy_escrow_usdt'] = clamp6((float)$summary['refunded_buy_escrow_usdt']);
        $summary['refunded_sell_escrow_token'] = clamp6((float)$summary['refunded_sell_escrow_token']);
        $summary['cancelled_order_maker_count'] = count($makers);
        return $summary;
    }
}

get('/api/markets', function () {
    authOptional();
    syncAllAssetStatusesIfNeeded();

    $statusList = implode(',', array_map(function($s) { return "'" . addslashes($s) . "'"; }, TRADEABLE_STATUSES));
    $tradeQtyCol = marketTradeQtyColumn();

    $assets = DB::fetchAll(
        "SELECT id, market, name, status, apr, supply_token, fee_buyer, fee_seller,
                settlement_basis, fx_at_funding, image_url, token_image_url, is_public, token_mint_address
         FROM assets
         WHERE status IN ({$statusList}) AND is_public=1
         ORDER BY name"
    );

    if (empty($assets)) {
        jsonOk(['markets' => []]);
        return;
    }

    // ==== N+1 제거: 4개 집계 쿼리로 모든 자산 메트릭을 한 번에 수집 ====
    $expiryWhere = marketActiveOrderExpiryWhere();

    // 1) 자산별 최근 체결가 (LAST trade)
    $lastPriceMap = [];
    try {
        $rows = DB::fetchAll(
            "SELECT t1.asset_id, t1.price
               FROM trades t1
         INNER JOIN (
                    SELECT asset_id, MAX(id) AS max_id
                      FROM trades
                  GROUP BY asset_id
              ) t2 ON t1.asset_id = t2.asset_id AND t1.id = t2.max_id"
        );
        foreach ($rows as $r) $lastPriceMap[(string)$r['asset_id']] = (float)($r['price'] ?? 0);
    } catch (Throwable $e) { /* non-fatal */ }

    // 2) 자산별 best bid / best ask (오픈 주문 중 매수 최고가 / 매도 최저가)
    $bidAskMap = [];
    try {
        $rows = DB::fetchAll(
            "SELECT asset_id,
                    MAX(CASE WHEN side='buy'  THEN price END) AS best_bid,
                    MIN(CASE WHEN side='sell' THEN price END) AS best_ask
               FROM orders
              WHERE status='open' AND remaining > 0 AND {$expiryWhere}
           GROUP BY asset_id"
        );
        foreach ($rows as $r) {
            $bidAskMap[(string)$r['asset_id']] = [
                'best_bid' => (float)($r['best_bid'] ?? 0),
                'best_ask' => (float)($r['best_ask'] ?? 0),
            ];
        }
    } catch (Throwable $e) { /* non-fatal */ }

    // 3) 자산별 24시간 거래량
    $volMap = [];
    try {
        $rows = DB::fetchAll(
            "SELECT asset_id, COALESCE(SUM({$tradeQtyCol}),0) AS vol
               FROM trades
              WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
           GROUP BY asset_id"
        );
        foreach ($rows as $r) $volMap[(string)$r['asset_id']] = (float)($r['vol'] ?? 0);
    } catch (Throwable $e) { /* non-fatal */ }

    // 4) merge — 자산 row 에 메트릭 병합 (N+1 없이 O(N))
    $markets = [];
    foreach ($assets as $a) {
        $a = withNormalizedAssetStatus($a);
        $aid = (string)$a['id'];
        $ba  = $bidAskMap[$aid] ?? ['best_bid' => 0, 'best_ask' => 0];
        $markets[] = array_merge($a, [
            'last_price' => $lastPriceMap[$aid] ?? 0.0,
            'best_bid'   => $ba['best_bid'],
            'best_ask'   => $ba['best_ask'],
            'volume_24h' => $volMap[$aid] ?? 0.0,
        ]);
    }

    jsonOk(['markets' => $markets]);
});

// (2026-05-11 v260) Sub-integer dust cleanup — orders are integer-only
//   on input (POST /api/orders floors $amount), but AMM partial-fill
//   floors to 6 decimals (line ~1372: floor($rawMax * 1e6) / 1e6) so
//   it can take fractional STO from a resting buy. Subsequent integer
//   matches against the remainder leave a tiny dust like 0.000002 STO
//   that's > 0 but unfillable. Operator screenshot:
//     My Open Orders: Buy 1.00 amount=11 filled=11 STATUS=OPEN
//   The status check uses `<= 0.000001` so 0.000002 stays 'open', and
//   the GET /api/orders filter uses `remaining > 0` so it's still
//   returned. This helper hunts down those stuck rows, refunds any
//   trapped escrow, and flips them to 'filled'.
if (!function_exists('marketCleanupDustOrders')) {
    function marketCleanupDustOrders(?string $assetId = null): array {
        $report = ['cleaned' => 0, 'refunded_usdt' => 0.0, 'refunded_token' => 0.0];
        // Orders are integer-only — any remaining < 1 STO is dust.
        $where = "status='open' AND remaining > 0 AND remaining < 1";
        $params = [];
        if ($assetId) { $where .= ' AND asset_id=?'; $params[] = $assetId; }
        $stuck = DB::fetchAll("SELECT * FROM orders WHERE $where", $params);
        if (empty($stuck)) return $report;

        $pdo = DB::pdo();
        try {
            $pdo->beginTransaction();
            foreach ($stuck as $o) {
                $orderId    = (int)$o['id'];
                $escrowUsdt = (float)($o['escrow_usdt'] ?? 0);
                $escrowTok  = (float)($o['escrow_token'] ?? 0);
                $addr       = (string)($o['maker_address'] ?? '');
                if ($escrowUsdt > 0.000001 && $addr !== '') {
                    DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$escrowUsdt, $addr]);
                    $report['refunded_usdt'] += $escrowUsdt;
                }
                if ($escrowTok > 0.000001 && $addr !== '') {
                    DB::execute(
                        "UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?",
                        [$escrowTok, $addr, $o['asset_id']]
                    );
                    $report['refunded_token'] += $escrowTok;
                }
                DB::execute(
                    "UPDATE orders SET status='filled', remaining=0, escrow_usdt=0, escrow_token=0 WHERE id=?",
                    [$orderId]
                );
                $report['cleaned']++;
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('[marketCleanupDustOrders] ' . $e->getMessage());
            $report['error'] = $e->getMessage();
        }
        return $report;
    }
}

get('/api/orders', function () {
    $user = authOptional();
    $assetId = trim((string)($_GET['asset_id'] ?? $_GET['assetId'] ?? ''));
    $status = trim((string)($_GET['status'] ?? 'open'));
    $mine = filter_var($_GET['mine'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));

    // (2026-05-11 v260) Self-heal dust orders before serving — fires
    //   on every open-orders read so a stuck row is visible only for
    //   the first request after it becomes stuck.
    if ($status === 'open') {
        marketCleanupDustOrders($assetId !== '' ? $assetId : null);
    }

    $where = ['1=1'];
    $params = [];
    if ($assetId !== '') { $where[] = 'asset_id=?'; $params[] = $assetId; }
    if ($status !== '') {
        $where[] = 'status=?';
        $params[] = $status;
        if ($status === 'open') {
            // Use >= 1 instead of > 0 so a row that slipped past the
            // cleanup (rare race) still gets hidden from the UI until
            // the next fetch.
            $where[] = 'remaining >= 1';
            $where[] = marketActiveOrderExpiryWhere();
        }
    }
    if ($mine) {
        if (!$user) jsonError(401, '인증 필요');
        $where[] = 'maker_address=?';
        $params[] = $user['address'];
    }

    $whereStr = implode(' AND ', $where);
    $rows = DB::fetchAll(
        "SELECT * FROM orders WHERE {$whereStr} ORDER BY created_at DESC, id DESC LIMIT {$limit}",
        $params
    );
    $rows = array_map('marketNormalizeOrderRow', $rows);
    jsonOk(['orders' => $rows]);
});

post('/api/orders', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    // (2026-06-17 v911) KYC 필수 — 운영자: 미인증 유저는 페이지 열람만, 주문(자금이동) 차단.
    assertUserKycEligibleOrThrow($address);
    $body = getJsonBody();

    // (2026-05-10 v218 hardening) Strict input validation.
    //   Order: format whitelists first (so non-numeric strings can't
    //   reach SQL or HTML), then numeric finite + bounds, then domain
    //   rules (2-decimal price, integer amount).
    $assetId = marketValidateAssetId((string)($body['asset_id'] ?? $body['assetId'] ?? ''));
    $side = trim((string)($body['side'] ?? ''));
    if (!in_array($side, ['buy', 'sell'], true)) jsonError(400, 'side는 buy 또는 sell');

    // (2026-05-10 v209) order_type: 'market' is a taker-only IOC against
    //   the visible book — any unfilled remainder MUST NOT rest in the
    //   book. Operator: '시장가로 체결할 반대편 주문이 없는 경우에는
    //   애초에 시장가 주문을 넣을 수 없도록' + race fallback for clicks
    //   that slip through before the button disables.
    $orderType = strtolower(trim((string)($body['order_type'] ?? $body['orderType'] ?? 'limit')));
    if (!in_array($orderType, ['limit', 'market'], true)) $orderType = 'limit';

    // (2026-05-10 v218 hardening) Numeric inputs go through bounds
    //   checks that explicitly reject NaN / ±Infinity (PHP's (float)
    //   cast turns the strings 'NaN' / 'Infinity' into those values,
    //   which would otherwise sneak past simple `<= 0` checks).
    $price  = (float)($body['price'] ?? 0);
    $amount = (float)($body['amount'] ?? 0);
    marketRequirePriceBounds($price);
    marketRequireAmountBounds($amount);

    // 가격은 소수점 2자리까지만 허용 (1.05 OK, 1.123 reject)
    if (abs($price * 100 - round($price * 100)) > 0.0001) {
        jsonError(400, pickLocaleMsg([
            'ko' => '가격은 소수점 2자리까지만 입력할 수 있습니다.',
            'en' => 'Price must have at most 2 decimal places.',
        ]));
    }
    $price = round($price, 2);
    // 거래 수량은 정수만 허용 (매각/출금과 일관성, dust drain 방어)
    // 정수 검사: 양의 정수 + 부동소수 오차 허용 (1.0 → 1 OK, 1.5 → reject)
    if (abs($amount - floor($amount)) > 0.0000001) {
        jsonError(400, pickLocaleMsg([
            'ko' => '거래 수량은 정수만 입력할 수 있습니다.',
            'en' => 'Trade amount must be an integer.',
        ]));
    }
    $amount = floor($amount);

    // (2026-05-10 v218 hardening) expiry_date — strict YYYY-MM-DD,
    //   valid calendar date, ≤10y in future. Replaces the old
    //   trim-only handling.
    $expiryRaw = $body['expiry_date'] ?? $body['expiry'] ?? null;
    $expiryDate = marketValidateExpiryDate($expiryRaw);

    // (2026-05-10 v215) Minimum order total — 1 USDT floor. Operator:
    //   '총 토탈 금액이 1달러 이상이 아니면 오더를 할 수 없도록'.
    //   Frontend disables the button + shows a red status line below
    //   1 USDT, but enforce server-side as the source of truth so a
    //   bypassed UI can't slip a sub-dollar order through.
    $orderTotal = $price * $amount;
    if ($orderTotal < 1.0 - 0.000001) {
        jsonError(400, sprintf('최소 주문 금액은 1 USDT 입니다 (현재 %.2f USDT).', $orderTotal));
    }

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, pickLocaleMsg([
        'ko' => '자산 없음',
        'en' => 'Asset not found.',
    ]));
    if (!marketIsAssetTradeable($asset)) jsonError(400, marketTradeDisabledMessage($asset));

    ensureUser($address);
    ensureHolding($address, $assetId);

    // AMM 시스템 본인은 수수료 없음 — PLATFORM_AMM_ADDRESS 가 주문을 생성하면
    // 해당 주문의 fee_rate를 0으로 강제 (admin의 토큰 재활용 매각 시에도 적용)
    $ammAddrForOrder = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';
    $orderMakerIsAmm = ($ammAddrForOrder !== '' && trim((string)$address) === $ammAddrForOrder);

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        if ($side === 'buy') {
            $totalUsdt = clamp6($price * $amount);
            $feePct = $orderMakerIsAmm ? 0.0 : (float)($asset['fee_buyer'] ?? 0);
            $fee = applyMinTradeFee(floor3($totalUsdt * $feePct / 100), $feePct);
            $escrowUsdt = $totalUsdt + $fee;

            $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
            $balUsdt = (float)($bal['usdt'] ?? 0);
            if ($balUsdt < $escrowUsdt) {
                $pdo->rollBack();
                // (2026-05-20 v659) 운영자: 매수 시 USDT 잔고가 gross 만큼은
                // 있지만 거래수수료 까지 못 커버하는 경우, "거래수수료 부족"
                // 임을 명확히 안내. 두 경우를 분리해서 메시지 차별화:
                //   case A) bal < totalUsdt → 주문 금액 자체가 부족
                //   case B) bal >= totalUsdt but < totalUsdt+fee → 수수료 부족
                $fmt = function ($n) {
                    return rtrim(rtrim(number_format($n, 6, '.', ''), '0'), '.') ?: '0';
                };
                if ($balUsdt + 0.000001 < $totalUsdt) {
                    // case A — gross 자체 미달
                    jsonError(400, pickLocaleMsg([
                        'ko' => sprintf(
                            'USDT 잔액 부족 — 보유 %s USDT, 필요 %s USDT (수량 %s × 가격 %s).',
                            $fmt($balUsdt), $fmt($escrowUsdt), $fmt((float)$amount), $fmt((float)$price)
                        ),
                        'en' => sprintf(
                            'Insufficient USDT balance — held %s USDT, required %s USDT (qty %s × price %s).',
                            $fmt($balUsdt), $fmt($escrowUsdt), $fmt((float)$amount), $fmt((float)$price)
                        ),
                    ]));
                } else {
                    // case B — gross 는 충분하지만 fee 까지 못 커버
                    $shortage = clamp6($escrowUsdt - $balUsdt);
                    jsonError(400, pickLocaleMsg([
                        'ko' => sprintf(
                            '거래수수료가 부족합니다 — 주문 금액 %s USDT + 수수료 %s USDT = 필요 %s USDT, 보유 %s USDT (부족분 %s USDT).',
                            $fmt($totalUsdt), $fmt($fee), $fmt($escrowUsdt), $fmt($balUsdt), $fmt($shortage)
                        ),
                        'en' => sprintf(
                            'Insufficient USDT for trade fee — order %s USDT + fee %s USDT = required %s USDT, held %s USDT (short %s USDT).',
                            $fmt($totalUsdt), $fmt($fee), $fmt($escrowUsdt), $fmt($balUsdt), $fmt($shortage)
                        ),
                    ]));
                }
            }

            // (2026-05-08) Auto-match against open sells BEFORE inserting
            //   resting buy. Operator: buy 1.00 + sell 1.00 should cross
            //   immediately. marketAutoMatchAgainstBook debits buyer
            //   balance per match, so we deduct ONLY the residual escrow
            //   for the un-matched portion below.
            $matchResult = marketAutoMatchAgainstBook(
                $assetId, 'buy', $address, $price, $amount, $feePct,
                (float)($asset['fee_buyer'] ?? 0),
                (float)($asset['fee_seller'] ?? 0)
            );
            $filledQty = (float)($matchResult['filled'] ?? 0);
            $remainingQty = clamp6($amount - $filledQty);

            $orderId = null;
            if ($remainingQty > 0.000001) {
                if ($orderType === 'market') {
                    // (2026-05-10 v209) Market = taker IOC against the
                    //   visible book. The frontend's button disable +
                    //   pre-submit refresh greatly reduces the race, but
                    //   between the last refresh and this commit the
                    //   ask side could vanish or shrink. Anything that
                    //   didn't match is dropped — no resting order, no
                    //   residual escrow taken (buyer balance was only
                    //   debited per match inside the helper).
                    $pdo->commit();
                    jsonOk([
                        'order_id'        => null,
                        'order_type'      => 'market',
                        'filled_qty'      => $filledQty,
                        'remaining'       => $remainingQty,
                        'requested'       => $amount,
                        'avg_price'       => $filledQty > 0
                            ? clamp6((float)$matchResult['total_gross_usdt'] / $filledQty)
                            : 0,
                        'auto_matched'    => $filledQty > 0,
                        'market_unfilled' => true,
                    ]);
                    return;
                }
                $residualUsdt = clamp6($price * $remainingQty);
                $residualFee  = applyMinTradeFee(floor3($residualUsdt * $feePct / 100), $feePct);
                $residualEscrow = clamp6($residualUsdt + $residualFee);
                // (v511) 잔액 변경 전후 캡처 — wallet_transactions 기록용.
                $balBeforeOrder = (float)(DB::fetchValue("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]) ?? 0);
                DB::execute("UPDATE balances SET usdt = usdt - ? WHERE address=?", [$residualEscrow, $address]);
                $balAfterOrder = max(0.0, $balBeforeOrder - $residualEscrow);

                $orderId = marketInsertOrder([
                    'asset_id'      => $assetId,
                    'maker_address' => $address,
                    'side'          => 'buy',
                    'price'         => $price,
                    'amount'        => $amount,
                    'remaining'     => $remainingQty,
                    'escrow_usdt'   => $residualEscrow,
                    'escrow_token'  => null,
                    'fee_rate'      => $feePct,
                    'expiry_date'   => $expiryDate,
                    'status'        => 'open',
                    'created_at'    => nowUtcSql(),
                ]);

                // (2026-05-18 v511/v515) 매수 주문 placement → wallet_transactions
                //   기록. v515: memo 에 구조화 정보 (order=X, fee=Y) 포함하여
                //   frontend 가 'amount' 아래에 작은 subtitle '주문 N · 수수료 N'
                //   표시 가능.
                try {
                    DB::execute(
                        "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                        [
                            $address,
                            'order_buy_placed',
                            'pending',
                            'USDT',
                            $residualEscrow,
                            $balBeforeOrder,
                            $balAfterOrder,
                            'Buy order placed: ' . $amount . ' ' . $assetId . ' @ ' . $price . ' USDT [order=' . $residualUsdt . ', fee=' . $residualFee . ']',
                        ]
                    );
                } catch (Throwable $txLogErr) {
                    error_log('wallet_transactions order_buy_placed log failed: ' . $txLogErr->getMessage());
                }
            }

            $pdo->commit();
            jsonOk([
                'order_id'   => $orderId,
                'order_type' => $orderType,
                'filled_qty' => $filledQty,
                'remaining'  => $remainingQty,
                'avg_price'  => $filledQty > 0
                    ? clamp6((float)$matchResult['total_gross_usdt'] / $filledQty)
                    : 0,
                'auto_matched' => $filledQty > 0,
            ]);
            return;
        } else {
            $h = DB::fetchOne("SELECT balance_token FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetId]);
            if ((float)($h['balance_token'] ?? 0) < $amount) {
                $pdo->rollBack();
                jsonError(400, pickLocaleMsg([
                    'ko' => '보유 토큰 부족',
                    'en' => 'Insufficient token balance.',
                ]));
            }

            DB::execute("UPDATE holdings SET balance_token=balance_token-? WHERE address=? AND asset_id=?", [$amount, $address, $assetId]);

            $feePct = $orderMakerIsAmm ? 0.0 : (float)($asset['fee_seller'] ?? 0);

            // (2026-05-08) Auto-match against open buys BEFORE the AMM
            //   distress-pool branch. Same fix as the buy path — operator
            //   wants seller's order to immediately consume any standing
            //   buy at >= sell price. Tokens were already debited from the
            //   seller's holdings above; the helper credits buyer maker
            //   addresses' holdings + seller's USDT balance per match.
            $bookMatch = marketAutoMatchAgainstBook(
                $assetId, 'sell', $address, $price, $amount, $feePct,
                (float)($asset['fee_buyer'] ?? 0),
                (float)($asset['fee_seller'] ?? 0)
            );
            $bookFilled = (float)($bookMatch['filled'] ?? 0);
            $remainingAfterBook = clamp6($amount - $bookFilled);

            // If the book fully consumed the sell order, commit + return.
            if ($remainingAfterBook <= 0.000001) {
                $pdo->commit();
                jsonOk([
                    'order_id'     => null,
                    'order_type'   => $orderType,
                    'auto_filled'  => true,
                    'amm'          => false,
                    'partial_amm'  => false,
                    'filled_qty'   => $bookFilled,
                    'remaining'    => 0,
                    'avg_price'    => $bookFilled > 0
                        ? clamp6((float)$bookMatch['total_gross_usdt'] / $bookFilled)
                        : 0,
                    'auto_matched' => true,
                ]);
                return;
            }

            // (2026-05-10 v209) Market sell: any unfilled remainder
            //   after the book match must NOT fall through to AMM or
            //   land as a resting limit. Refund the seller the tokens
            //   we debited up front for the unmatched portion and
            //   commit just the partial fill.
            if ($orderType === 'market') {
                DB::execute(
                    "UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?",
                    [$remainingAfterBook, $address, $assetId]
                );
                $pdo->commit();
                jsonOk([
                    'order_id'        => null,
                    'order_type'      => 'market',
                    'auto_filled'     => $bookFilled > 0,
                    'amm'             => false,
                    'partial_amm'     => false,
                    'filled_qty'      => $bookFilled,
                    'remaining'       => $remainingAfterBook,
                    'requested'       => $amount,
                    'avg_price'       => $bookFilled > 0
                        ? clamp6((float)$bookMatch['total_gross_usdt'] / $bookFilled)
                        : 0,
                    'auto_matched'    => $bookFilled > 0,
                    'market_unfilled' => true,
                ]);
                return;
            }

            // From here on (limit only), only the un-matched residual
            //   continues into AMM / book-rest logic. Use
            //   $amount = $remainingAfterBook so the existing AMM block
            //   works on the correct quantity.
            $amount = $remainingAfterBook;

            // ★ AMM 자동 체결 임계값 — 관리자 설정 (settings.amm_threshold, 기본 0.8)
            //   시세 × (이 비율 이하) 가격에 매도 시 시스템이 자동 매수
            $ammThreshold = (float)(getSetting('amm_threshold', '0.8') ?? '0.8');
            if (!is_finite($ammThreshold) || $ammThreshold <= 0 || $ammThreshold > 1) {
                $ammThreshold = 0.8;  // 비정상 값 방어
            }
            $ammEnabled = (getSetting('amm_enabled', '1') ?? '1') === '1';

            // 방어적 가드: PLATFORM_AMM_ADDRESS 상수가 없으면 AMM 비활성으로 간주
            $ammAddrConst = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';
            if ($ammEnabled && $ammAddrConst === '') {
                $ammEnabled = false;
            }

            if ($ammEnabled && $price <= $ammThreshold + 0.0000001) {
                // ===== AMM auto-buy (partial fill supported) =====
                // (2026-05-20 v657) 운영자 정책 변경: AMM 매칭 시 반대측 유저
                // (매도자) 의 거래수수료를 부과하지 않음. 풀 지출 = gross 전체.
                //   이전: 풀이 net(=gross−sellerFee) 만 지급 → fee 차액이 풀에
                //         잔존 (예 8 USDT gross → 매도자 7.96, 풀 0.04 잔존)
                //   변경: 풀이 gross 전체 지급 → 매도자 gross 전체 수령, 풀에
                //         fee 잔존 없음. 매도자/AMM 둘 다 수수료 0.
                // Pool capacity:
                //  - 전액 커버 가능 → 전체 AMM 매칭
                //  - 부분 커버 가능 → AMM이 감당 가능한 만큼만 매칭, 잔여분은 오더북
                //  - pool = 0     → AMM 건너뛰고 전량 오더북 (에러 없음)
                DB::execute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
                $pb = DB::fetchOne("SELECT usdt_balance FROM platform_balance WHERE id=1 FOR UPDATE");
                $poolUsdt = (float)($pb['usdt_balance'] ?? 0);

                $fullTradeUsdt = clamp6($price * $amount);

                $ammAmount    = 0.0;
                $ammTradeUsdt = 0.0;

                if ($poolUsdt + 0.0000001 >= $fullTradeUsdt) {
                    // 전액 AMM 매칭 가능 — 풀이 gross 전체 지급
                    $ammAmount    = $amount;
                    $ammTradeUsdt = $fullTradeUsdt;
                } elseif ($poolUsdt > 0 && $price > 0) {
                    // 부분 매칭: 풀 잔고로 감당 가능한 최대 수량 계산
                    // tradeUsdt = price * amt ≤ poolUsdt
                    // ⇒ amt ≤ poolUsdt / price
                    $rawMax    = $poolUsdt / $price;
                    // (2026-05-11 v260) Floor to INTEGER (was 6 decimals)
                    //   — SilicaSTO is integer-only at the order level,
                    //   so a fractional AMM match left a non-integer
                    //   remaining on the seller's order that later
                    //   integer matches couldn't fully consume,
                    //   leaving dust like 0.000002 STO stuck as
                    //   'open'. Integer floor = no dust ever.
                    $ammAmount = floor($rawMax);
                    if ($ammAmount > $amount) $ammAmount = $amount;

                    if ($ammAmount > 0) {
                        $ammTradeUsdt = clamp6($price * $ammAmount);

                        // 안전 가드: 부동소수점 오차로 풀을 초과하면 1 micro씩 감소
                        $safety = 0;
                        while ($ammTradeUsdt > $poolUsdt && $ammAmount >= 0.000002 && $safety < 10) {
                            $ammAmount = clamp6($ammAmount - 0.000001);
                            $ammTradeUsdt = clamp6($price * $ammAmount);
                            $safety++;
                        }
                        if ($ammTradeUsdt > $poolUsdt || $ammAmount <= 0) {
                            $ammAmount = 0.0;
                            $ammTradeUsdt = 0.0;
                        }
                    }
                }
                // else: poolUsdt <= 0 → AMM skip, 전량 오더북

                $ammOrderId = null;

                // AMM 부분 실행
                if ($ammAmount > 0) {
                    ensureUser(PLATFORM_AMM_ADDRESS);
                    ensureHolding(PLATFORM_AMM_ADDRESS, $assetId);
                    // (2026-05-10 v214) Capture seller's USDT before for
                    //   wallet_transactions history row.
                    $sellerBalAmm = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$address]);
                    $sellerUsdtBeforeAmm = (float)($sellerBalAmm['usdt'] ?? 0);

                    // (2026-05-20 v658) 운영자 정책 최종 — AMM 매칭 시:
                    //   - 매도자는 거래수수료(USDT) 차감된 net 수령
                    //   - 풀은 gross 전체 지출 (수수료 환원 없음)
                    //   - 차액(seller fee)은 스왑/출금 수수료처럼 시스템 총량에서
                    //     사라지는 방식으로 implicit platform 수익 (platform_balance
                    //     로 credit 하지 않음).
                    //   결과: 풀 = -gross, 매도자 = +net, 시스템 USDT 총량 -fee.
                    $ammSellerFee = applyMinTradeFee(floor3($ammTradeUsdt * $feePct / 100), $feePct);
                    $ammSellerNet = clamp6($ammTradeUsdt - $ammSellerFee);

                    DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$ammSellerNet, $address]);
                    DB::execute("UPDATE platform_balance SET usdt_balance=usdt_balance-? WHERE id=1", [$ammTradeUsdt]);
                    DB::execute("UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?", [$ammAmount, PLATFORM_AMM_ADDRESS, $assetId]);

                    $ammOrderId = marketInsertOrder([
                        'asset_id'      => $assetId,
                        'maker_address' => $address,
                        'side'          => 'sell',
                        'price'         => $price,
                        'amount'        => $ammAmount,
                        'remaining'     => 0,
                        'escrow_usdt'   => null,
                        'escrow_token'  => 0,
                        // (v658) 매도자는 정상 seller fee 부담 → fee_rate 도 정상값
                        'fee_rate'      => $feePct,
                        'expiry_date'   => $expiryDate,
                        'status'        => 'filled',
                        'created_at'    => nowUtcSql(),
                    ]);

                    marketInsertTrade([
                        'asset_id'       => $assetId,
                        'order_id'       => $ammOrderId,
                        'buyer_address'  => PLATFORM_AMM_ADDRESS,
                        'seller_address' => $address,
                        'maker_address'  => $address,
                        'taker_address'  => PLATFORM_AMM_ADDRESS,
                        'price'          => $price,
                        'amount'         => $ammAmount,
                        'total_usdt'     => $ammTradeUsdt,
                        'created_at'     => nowUtcSql(),
                    ]);

                    // (2026-05-10 v214) Log to wallet_transactions so the
                    //   AMM-fulfilled sell shows up under the Trade tab on
                    //   the user's history page. Buyer (AMM platform) is
                    //   filtered inside the helper. Logged from the
                    //   user-as-maker perspective: takerSide='buy' makes
                    //   the helper write a 'trade_sell' row for the maker.
                    // (v658) makerFee = $ammSellerFee → 매도자 history 에
                    //   trade_sell_recv (+gross) + trade_sell_fee (-fee) 2행 표시.
                    marketLogTradeFill([
                        'takerAddress'    => PLATFORM_AMM_ADDRESS,
                        'makerAddress'    => $address,
                        'takerSide'       => 'buy',
                        'matchQty'        => $ammAmount,
                        'matchPrice'      => $price,
                        'matchUsdt'       => $ammTradeUsdt,
                        'takerFee'        => 0.0,                // AMM doesn't pay
                        'makerFee'        => $ammSellerFee,      // (v658) 매도자 seller fee
                        'takerUsdtBefore' => 0.0,                // skipped
                        'makerUsdtBefore' => $sellerUsdtBeforeAmm,
                        'makerOrderId'    => (int)$ammOrderId,
                        'assetSymbol'     => 'SilicaSTO',
                    ]);
                }

                // (2026-05-20 v656) v655 의 ammAuditLog 인-트랜잭션 호출을
                // 제거. ammAuditLog → ensureAmmAuditTable → CREATE TABLE
                // IF NOT EXISTS 가 MySQL/InnoDB 의 DDL implicit commit 을
                // 유발하여 활성 트랜잭션이 강제 커밋되고, 이후 $pdo->commit()
                // 가 "no active transaction" 예외를 던져 500 응답이 반환되는
                // 버그 (유저가 재시도하면 풀은 이미 비워져 정상 매칭 불가).
                // 해결: 트랜잭션 안에서는 데이터만 캡처(아래 변수)하고, 실제
                // INSERT 는 $pdo->commit() 직후에 한 번만 실행.
                // (v657) balance_after 는 gross 차감 후 잔고.
                $ammAuditPending = null;
                if ($ammAmount > 0) {
                    $ammAuditPending = [
                        'asset_id'       => $assetId,
                        'amount'         => $ammAmount,
                        'price'          => $price,
                        'order_id'       => (string)$ammOrderId,
                        'balance_before' => $poolUsdt,
                        'balance_after'  => clamp6($poolUsdt - $ammTradeUsdt),
                        'note'           => 'on_order',
                    ];
                }

                $remainingAfterAmm = clamp6($amount - $ammAmount);

                // Case 1: AMM 전액 매칭 완료
                if ($remainingAfterAmm <= 0.000001) {
                    $pdo->commit();
                    // (v656) 트랜잭션 종료 후 감사 로그 기록 — DDL implicit
                    // commit 이 발생해도 이미 커밋된 후이므로 안전.
                    if ($ammAuditPending && function_exists('ammAuditLog')) {
                        ammAuditLog(null, 'auto_buy', $ammAuditPending);
                    }
                    // (v658) received_usdt 는 매도자가 실제 수령한 금액 = net (fee 차감 후)
                    jsonOk([
                        'order_id'      => $ammOrderId,
                        'auto_filled'   => true,
                        'amm'           => true,
                        'partial_amm'   => false,
                        'trade_usdt'    => $ammTradeUsdt,
                        'received_usdt' => $ammSellerNet,
                        'filled_qty'    => $ammAmount,
                        'remaining'     => 0,
                        'avg_price'     => $price,
                    ]);
                    return;
                }

                // Case 2 & 3: 잔여분을 오더북에 등록 (부분 AMM 또는 AMM 미실행)
                $orderId = marketInsertOrder([
                    'asset_id'      => $assetId,
                    'maker_address' => $address,
                    'side'          => 'sell',
                    'price'         => $price,
                    'amount'        => $remainingAfterAmm,
                    'remaining'     => $remainingAfterAmm,
                    'escrow_usdt'   => null,
                    'escrow_token'  => $remainingAfterAmm,
                    'fee_rate'      => $feePct,
                    'expiry_date'   => $expiryDate,
                    'status'        => 'open',
                    'created_at'    => nowUtcSql(),
                ]);

                $pdo->commit();
                // (v656) 트랜잭션 종료 후 감사 로그 기록.
                if ($ammAuditPending && function_exists('ammAuditLog')) {
                    ammAuditLog(null, 'auto_buy', $ammAuditPending);
                }

                if ($ammAmount > 0) {
                    // Case 2: AMM 부분 매칭 + 오더북 잔여
                    // (v658) received_usdt = net (fee 차감 후)
                    jsonOk([
                        'order_id'       => $orderId,
                        'amm_order_id'   => $ammOrderId,
                        'auto_filled'    => true,
                        'amm'            => true,
                        'partial_amm'    => true,
                        'trade_usdt'     => $ammTradeUsdt,
                        'received_usdt'  => $ammSellerNet,
                        'filled_qty'     => $ammAmount,
                        'remaining'      => $remainingAfterAmm,
                        'avg_price'      => $price,
                    ]);
                } else {
                    // Case 3: 풀 고갈 → AMM 건너뛰고 전량 오더북
                    jsonOk([
                        'order_id'   => $orderId,
                        'amm'        => false,
                        'filled_qty' => 0,
                        'remaining'  => $remainingAfterAmm,
                        'avg_price'  => 0,
                    ]);
                }
                return;
            }

            $orderId = marketInsertOrder([
                'asset_id'      => $assetId,
                'maker_address' => $address,
                'side'          => 'sell',
                'price'         => $price,
                'amount'        => $amount,
                'remaining'     => $amount,
                'escrow_usdt'   => null,
                'escrow_token'  => $amount,
                'fee_rate'      => $feePct,
                'expiry_date'   => $expiryDate,
                'status'        => 'open',
                'created_at'    => nowUtcSql(),
            ]);
        }

        $pdo->commit();
        jsonOk(['order_id' => $orderId, 'filled_qty' => 0, 'remaining' => $amount, 'avg_price' => 0]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, pickLocaleMsg([
            'ko' => '주문 생성 실패',
            'en' => 'Order creation failed',
        ]) . ': ' . $e->getMessage());
    }
});


function marketActiveOrderExpiryWhere(string $alias = ''): string {
    $a = $alias ? "{$alias}." : '';
    $today = addslashes(todayKST());
    return "({$a}expiry_date IS NULL OR {$a}expiry_date='' OR {$a}expiry_date >= '{$today}')";
}

function marketBestCounterOrderForMyOrder(array $myOrder, string $address): ?array {
    $assetId = (string)($myOrder['asset_id'] ?? '');
    $side = (string)($myOrder['side'] ?? '');
    $price = (float)($myOrder['price'] ?? 0);

    if ($assetId === '' || !in_array($side, ['buy', 'sell'], true) || $price <= 0) {
        return null;
    }

    if ($side === 'buy') {
        $sql = "SELECT * FROM orders
                WHERE asset_id=?
                  AND side='sell'
                  AND status='open'
                  AND maker_address<>?
                  AND remaining > 0
                  AND " . marketActiveOrderExpiryWhere() . "
                  AND price <= ?
                ORDER BY price ASC, created_at ASC, id ASC
                LIMIT 1 FOR UPDATE";
    } else {
        $sql = "SELECT * FROM orders
                WHERE asset_id=?
                  AND side='buy'
                  AND status='open'
                  AND maker_address<>?
                  AND remaining > 0
                  AND " . marketActiveOrderExpiryWhere() . "
                  AND price >= ?
                ORDER BY price DESC, created_at ASC, id ASC
                LIMIT 1 FOR UPDATE";
    }

    $row = DB::fetchOne($sql, [$assetId, $address, $price]);
    return $row ? marketNormalizeOrderRow($row) : null;
}


post('/api/orders/:id/match', function ($p) {
    authMfaRequired();
    jsonError(410, '더 이상 사용하지 않는 거래 경로입니다. 호가창 주문 자체를 즉시체결 또는 선택 거래로 처리하세요.');
});

post('/api/orders/:id/cancel', function ($p) {
    $user = authMfaRequired();
    $address = $user['address'];
    // (2026-05-10 v218 hardening) Strict order id whitelist — must be a
    //   pure positive integer string. Prepared statements already block
    //   SQL injection, but a non-numeric id would just miss with no
    //   useful error; we surface it explicitly.
    $orderId = (string)($p['id'] ?? '');
    // (2026-05-18 v512) order id 는 marketMakeOrderId() 가 'ord_YYYYMMDDHHMMSS_xxxxxxxx'
    //   형식 (varchar(80)) 으로 생성하므로 순수 숫자 정규식은 잘못. 알파벳/숫자/
    //   언더스코어/하이픈 80자 이하로 완화.
    if (!preg_match('/^[a-zA-Z0-9_\-]{1,80}$/', $orderId)) {
        jsonError(400, pickLocaleMsg([
            'ko' => '주문 ID 형식이 올바르지 않습니다.',
            'en' => 'Invalid order ID format.',
        ]));
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        // Ownership filter `maker_address = ?` IS the trade-theft
        //   defense — only the order's creator can cancel it.
        $order = DB::fetchOne("SELECT * FROM orders WHERE id=? AND maker_address=? FOR UPDATE", [$orderId, $address]);
        if (!$order) {
            $pdo->rollBack();
            jsonError(404, pickLocaleMsg([
                'ko' => '주문 없음',
                'en' => 'Order not found.',
            ]));
        }
        $order = marketNormalizeOrderRow($order);
        if (($order['status'] ?? '') !== 'open') {
            $pdo->rollBack();
            jsonError(400, pickLocaleMsg([
                'ko' => '취소 불가 상태',
                'en' => 'Order cannot be canceled (not in open status).',
            ]));
        }

        if (($order['side'] ?? '') === 'buy') {
            $refund = clamp6(max(0, (float)($order['escrow_usdt'] ?? 0)));
            if ($refund > 0) {
                // (v511) 잔액 전후 캡처 후 wallet_transactions 기록
                // (v515) memo 에 order/fee 분해 정보 — escrow = order + fee
                //   환불액과 동일한 구조로 frontend 가 subtitle 표시 가능.
                $balBeforeCancel = (float)(DB::fetchValue("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]) ?? 0);
                DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$refund, $address]);
                $balAfterCancel = $balBeforeCancel + $refund;
                $orderPart = clamp6((float)($order['price'] ?? 0) * (float)($order['remaining'] ?? 0));
                $feePart   = clamp6($refund - $orderPart);
                if ($feePart < 0) $feePart = 0;
                try {
                    DB::execute(
                        "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                         VALUES (?, 'order_buy_canceled', '완료', 'USDT', ?, ?, ?, ?, NOW())",
                        [$address, $refund, $balBeforeCancel, $balAfterCancel,
                         'Buy order canceled: ' . $orderId . ' [order=' . $orderPart . ', fee=' . $feePart . ']']
                    );
                } catch (Throwable $_) {}
            }
        } else {
            $refund = clamp6(max(0, (float)($order['escrow_token'] ?? 0)));
            if ($refund <= 0) {
                $refund = clamp6(max(0, (float)($order['remaining'] ?? 0)));
            }
            if ($refund > 0) {
                ensureHolding($address, $order['asset_id']);
                DB::execute("UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?", [$refund, $address, $order['asset_id']]);
                try {
                    DB::execute(
                        "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                         VALUES (?, 'order_sell_canceled', '완료', ?, ?, NULL, NULL, ?, NOW())",
                        [$address, $order['asset_id'], $refund, 'Sell order canceled: ' . $orderId . ' (token returned)']
                    );
                } catch (Throwable $_) {}
            }
        }

        DB::execute("UPDATE orders SET status='cancelled', remaining=0, escrow_usdt=0, escrow_token=0 WHERE id=?", [$orderId]);
        $pdo->commit();
        jsonOk(['cancelled' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, pickLocaleMsg([
            'ko' => '취소 실패',
            'en' => 'Cancel failed',
        ]) . ': ' . $e->getMessage());
    }
});

post('/api/orders/:id/fill', function ($p) {
    $user = authMfaRequired();
    $address = $user['address'];
    // (2026-06-17 v911) KYC 필수 — 미인증 유저는 즉시체결(자금이동) 차단.
    assertUserKycEligibleOrThrow($address);
    // (2026-05-10 v218 hardening) Same order-id whitelist as the cancel
    //   route. Then numeric finite + bounds + integer-only check on
    //   the fill amount.
    $orderId = (string)($p['id'] ?? '');
    // (2026-05-18 v512) order id 는 marketMakeOrderId() 가 'ord_YYYYMMDDHHMMSS_xxxxxxxx'
    //   형식 (varchar(80)) 으로 생성하므로 순수 숫자 정규식은 잘못. 알파벳/숫자/
    //   언더스코어/하이픈 80자 이하로 완화.
    if (!preg_match('/^[a-zA-Z0-9_\-]{1,80}$/', $orderId)) {
        jsonError(400, pickLocaleMsg([
            'ko' => '주문 ID 형식이 올바르지 않습니다.',
            'en' => 'Invalid order ID format.',
        ]));
    }
    $body = getJsonBody();
    $fillAmount = clamp6((float)($body['amount'] ?? 0));
    marketRequireAmountBounds($fillAmount);
    // 거래 수량은 정수만 허용
    if (abs($fillAmount - floor($fillAmount)) > 0.0000001) {
        jsonError(400, pickLocaleMsg([
            'ko' => '거래 수량은 정수만 입력할 수 있습니다.',
            'en' => 'Trade amount must be an integer.',
        ]));
    }
    $fillAmount = floor($fillAmount);

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $order = DB::fetchOne("SELECT * FROM orders WHERE id=? AND status='open' FOR UPDATE", [$orderId]);
        if (!$order) {
            $pdo->rollBack();
            jsonError(404, pickLocaleMsg([
                'ko' => '주문 없음 또는 이미 완료',
                'en' => 'Order not found or already completed.',
            ]));
        }
        $order = marketNormalizeOrderRow($order);

        if (!empty($order['expiry_date']) && (string)$order['expiry_date'] < todayKST()) {
            $pdo->rollBack();
            jsonError(400, '만료된 주문입니다.');
        }

        $makerAddr = trim((string)($order['maker_address'] ?? ''));
        if ($makerAddr === '') {
            $pdo->rollBack();
            jsonError(400, '주문 생성자 정보가 올바르지 않습니다.');
        }

        $remaining = clamp6((float)($order['remaining'] ?? 0));
        if ($remaining <= 0) {
            $pdo->rollBack();
            jsonError(400, '체결 가능 수량 없음');
        }
        if ($fillAmount > $remaining + 0.000001) {
            $pdo->rollBack();
            jsonError(409, '주문 잔량이 변경되었습니다. 현재 잔량 이내에서만 거래할 수 있습니다.');
        }
        $actual = $fillAmount;

        $price = (float)($order['price'] ?? 0);
        $assetId = (string)($order['asset_id'] ?? '');
        if ($price <= 0 || $assetId === '') {
            $pdo->rollBack();
            jsonError(400, '주문 정보가 올바르지 않습니다.');
        }

        $asset = getAsset($assetId);
        if (!$asset) {
            $pdo->rollBack();
            jsonError(404, '자산 없음');
        }
        if (!marketIsAssetTradeable($asset)) {
            $pdo->rollBack();
            jsonError(400, marketTradeDisabledMessage($asset));
        }

        ensureUser($address);
        ensureHolding($address, $assetId);
        ensureUser($makerAddr);
        ensureHolding($makerAddr, $assetId);

        $tradeUsdt = clamp6($price * $actual);
        $newRemaining = clamp6(max(0, $remaining - $actual));

        // AMM 시스템 본인은 수수료 없음 — PLATFORM_AMM_ADDRESS 가 참여한 거래는
        // 해당 당사자에게 수수료를 부과하지 않는다.
        $ammAddr = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';
        $makerIsAmm = ($ammAddr !== '' && trim((string)$makerAddr) === $ammAddr);
        $takerIsAmm = ($ammAddr !== '' && trim((string)$address)   === $ammAddr);

        if (($order['side'] ?? '') === 'buy') {
            $sellerHolding = DB::fetchOne("SELECT balance_token FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetId]);
            if ((float)($sellerHolding['balance_token'] ?? 0) + 0.000001 < $actual) {
                $pdo->rollBack();
                jsonError(400, '토큰 부족');
            }

            // buy order: maker=buyer, taker=seller
            $buyerFeeRate = (array_key_exists('fee_rate', $order) && $order['fee_rate'] !== null && $order['fee_rate'] !== '')
                ? (float)$order['fee_rate']
                : (float)($asset['fee_buyer'] ?? 0);
            if ($makerIsAmm) $buyerFeeRate = 0.0; // AMM은 buyer일 때 수수료 0
            $buyerFeeApplied = applyMinTradeFee(floor3($tradeUsdt * $buyerFeeRate / 100), $buyerFeeRate);
            $buyerEscrowUsed = clamp6($tradeUsdt + $buyerFeeApplied);
            $currentEscrowUsdt = clamp6((float)($order['escrow_usdt'] ?? 0));
            if ($currentEscrowUsdt + 0.000001 < $buyerEscrowUsed) {
                $pdo->rollBack();
                jsonError(400, '매수 주문 예치금이 부족합니다.');
            }

            $sellerFeeRate = (float)($asset['fee_seller'] ?? 0);
            if ($takerIsAmm) $sellerFeeRate = 0.0; // AMM은 seller일 때 수수료 0
            $sellerFee = applyMinTradeFee(floor3($tradeUsdt * $sellerFeeRate / 100), $sellerFeeRate);
            $sellerNet = clamp6($tradeUsdt - $sellerFee);

            DB::execute("UPDATE holdings SET balance_token=balance_token-? WHERE address=? AND asset_id=?", [$actual, $address, $assetId]);
            DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$sellerNet, $address]);
            DB::execute("UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?", [$actual, $makerAddr, $assetId]);

            $newEscrowUsdt = clamp6(max(0, $currentEscrowUsdt - $buyerEscrowUsed));
            if ($newRemaining <= 0 && $newEscrowUsdt > 0) {
                DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$newEscrowUsdt, $makerAddr]);
                $newEscrowUsdt = 0;
            }

            DB::execute(
                "UPDATE orders SET remaining=?, escrow_usdt=?, status=? WHERE id=?",
                [$newRemaining, $newEscrowUsdt, $newRemaining <= 0 ? 'filled' : 'open', $orderId]
            );
        } elseif (($order['side'] ?? '') === 'sell') {
            // sell order: maker=seller, taker=buyer
            $buyerFeeRate = (float)($asset['fee_buyer'] ?? 0);
            if ($takerIsAmm) $buyerFeeRate = 0.0; // AMM은 buyer일 때 수수료 0
            $buyerFee = applyMinTradeFee(floor3($tradeUsdt * $buyerFeeRate / 100), $buyerFeeRate);
            $buyerTotal = clamp6($tradeUsdt + $buyerFee);

            $buyerBalance = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
            if ((float)($buyerBalance['usdt'] ?? 0) + 0.000001 < $buyerTotal) {
                $pdo->rollBack();
                jsonError(400, 'USDT 부족');
            }

            $currentEscrowToken = clamp6((float)($order['escrow_token'] ?? 0));
            if ($currentEscrowToken <= 0) {
                $currentEscrowToken = $remaining;
            }
            if ($currentEscrowToken + 0.000001 < $actual) {
                $pdo->rollBack();
                jsonError(400, '매도 주문 예치 토큰이 부족합니다.');
            }

            $sellerFeeRate = (array_key_exists('fee_rate', $order) && $order['fee_rate'] !== null && $order['fee_rate'] !== '')
                ? (float)$order['fee_rate']
                : (float)($asset['fee_seller'] ?? 0);
            if ($makerIsAmm) $sellerFeeRate = 0.0; // AMM은 seller일 때 수수료 0
            $sellerFee = applyMinTradeFee(floor3($tradeUsdt * $sellerFeeRate / 100), $sellerFeeRate);
            $sellerNet = clamp6($tradeUsdt - $sellerFee);

            DB::execute("UPDATE balances SET usdt=usdt-? WHERE address=?", [$buyerTotal, $address]);
            DB::execute("UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?", [$actual, $address, $assetId]);
            // AMM 재활용 매각: 매각 대금을 AMM 유저 balance 가 아니라 platform_balance(유동성 풀) 로 환원한다.
            if ($makerIsAmm) {
                DB::execute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
                DB::execute("UPDATE platform_balance SET usdt_balance=usdt_balance+? WHERE id=1", [$sellerNet]);
            } else {
                DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$sellerNet, $makerAddr]);
            }

            $newEscrowToken = clamp6(max(0, $currentEscrowToken - $actual));
            if ($newRemaining <= 0 && $newEscrowToken > 0) {
                DB::execute("UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?", [$newEscrowToken, $makerAddr, $assetId]);
                $newEscrowToken = 0;
            }

            DB::execute(
                "UPDATE orders SET remaining=?, escrow_token=?, status=? WHERE id=?",
                [$newRemaining, $newEscrowToken, $newRemaining <= 0 ? 'filled' : 'open', $orderId]
            );
        } else {
            $pdo->rollBack();
            jsonError(400, '지원하지 않는 주문 타입입니다.');
        }

        marketInsertTrade([
            'asset_id'       => $assetId,
            'order_id'       => $orderId,
            'buyer_address'  => ($order['side'] === 'buy') ? $makerAddr : $address,
            'seller_address' => ($order['side'] === 'buy') ? $address : $makerAddr,
            'maker_address'  => $makerAddr,
            'taker_address'  => $address,
            'price'          => $price,
            'amount'         => $actual,
            'total_usdt'     => $tradeUsdt,
            'created_at'     => nowUtcSql(),
        ]);

        $pdo->commit();
        jsonOk(['filled' => $actual, 'price' => $price, 'trade_usdt' => $tradeUsdt, 'remaining' => $newRemaining]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '체결 실패: ' . $e->getMessage());
    }
});

get('/api/trades', function () {
    $assetId = trim((string)($_GET['asset_id'] ?? $_GET['assetId'] ?? ''));
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));

    $where = ['1=1'];
    $params = [];
    if ($assetId !== '') { $where[] = 'asset_id=?'; $params[] = $assetId; }

    $whereStr = implode(' AND ', $where);
    $rows = DB::fetchAll("SELECT * FROM trades WHERE {$whereStr} ORDER BY created_at DESC, id DESC LIMIT {$limit}", $params);
    $rows = array_map('marketNormalizeTradeRow', $rows);
    jsonOk(['trades' => $rows]);
});

/**
 * (2026-05-10 v218) Admin backfill — populate wallet_transactions from
 * the existing `trades` table. Operator: '트레이드 기록이 안나온다.'
 * v214 added live mirroring on every fill, but trades that happened
 * BEFORE that deploy have no wallet_transactions rows.
 *
 * Idempotent: deletes any existing trade_buy / trade_sell rows that
 * carry a backfill marker in memo, then re-inserts. Live-mirrored rows
 * (those without the marker) are left alone.
 *
 * Auth: admin only.
 *
 * Query params:
 *   dry_run=1   → just report counts, no DB write
 *   limit=N     → process at most N trades (default no cap)
 *
 * Response:
 *   { ok: true, trade_count, deleted, inserted, skipped_amm }
 */
post('/api/admin/trade-history-backfill', function () {
    adminAuth();

    $dryRun = (string)($_GET['dry_run'] ?? '0') === '1';
    $limit  = (int)($_GET['limit'] ?? 0);
    $ammAddr = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';
    $isAmm = function (string $a) use ($ammAddr): bool {
        return $ammAddr !== '' && trim($a) === $ammAddr;
    };

    $sql = "SELECT * FROM trades ORDER BY id ASC";
    if ($limit > 0) $sql .= " LIMIT {$limit}";
    $trades = DB::fetchAll($sql);
    $tradeCount = count($trades);

    // (2026-05-10 v220 / v229) Cache the maker order's side + fee_rate
    //   per trade. v229: side is needed to resolve maker→buyer/seller
    //   since the trades table only has maker_address / taker_address
    //   columns in this DB.
    $orderInfoById = [];
    $feeRateByOrder = [];
    foreach ($trades as $t) {
        $oid = (int)($t['order_id'] ?? 0);
        if ($oid > 0 && !isset($orderInfoById[$oid])) {
            $row = DB::fetchOne("SELECT side, fee_rate FROM orders WHERE id=?", [$oid]);
            $orderInfoById[$oid] = [
                'side' => (string)($row['side'] ?? ''),
                'fee_rate' => (float)($row['fee_rate'] ?? 0.1),
            ];
            $feeRateByOrder[$oid] = $orderInfoById[$oid]['fee_rate'];
        }
    }
    $minFee = defined('MIN_TRADE_FEE_USDT') ? (float)MIN_TRADE_FEE_USDT : 0.001;
    $estFee = function (float $usdt, float $feePct) use ($minFee): float {
        if ($feePct <= 0) return 0.0;
        $raw = $usdt * $feePct / 100.0;
        return $raw < $minFee ? $minFee : round($raw, 6);
    };

    $deleted = 0;
    if (!$dryRun) {
        // (v220) Wipe ALL trade_* rows — both backfill and live-mirror —
        //   so we can re-emit consistently with the new 3-row-per-side
        //   schema. Live trades after this run will use the new helper.
        $deleted = (int)DB::execute(
            "DELETE FROM wallet_transactions
             WHERE kind LIKE 'trade\\_%' ESCAPE '\\\\'
                OR kind IN ('trade_buy', 'trade_sell')"
        );
    }

    $inserted = 0;
    $skippedAmm = 0;

    foreach ($trades as $t) {
        // (2026-05-11 v229) trades table in this DB only has maker/taker
        //   columns — buyer_address / seller_address don't exist. Read
        //   maker + taker, look up the maker order's side, then map
        //   maker→buyer/seller accordingly.
        $maker = trim((string)($t['maker_address'] ?? ''));
        $taker = trim((string)($t['taker_address'] ?? ''));
        $price = (float)($t['price'] ?? 0);
        $qty = (float)($t['amount'] ?? $t['qty'] ?? 0);
        $usdt = (float)($t['total_usdt'] ?? ($price * $qty));
        $oid = (int)($t['order_id'] ?? 0);
        $created = (string)($t['created_at'] ?? nowUtcSql());

        $qtyStr = rtrim(rtrim(number_format($qty, 6, '.', ''), '0'), '.') ?: '0';
        $priceStr = number_format($price, 2, '.', '');
        $feePct = $feeRateByOrder[$oid] ?? 0.1;
        $fee = $estFee($usdt, $feePct);

        // Maker order's side determines who is buyer/seller. Default
        //   fallback (no side info): assume maker=buyer.
        $makerSide = (string)($orderInfoById[$oid]['side'] ?? '');
        if ($makerSide === 'sell') {
            $buyer = $taker;  $seller = $maker;
        } else {
            $buyer = $maker;  $seller = $taker;
        }

        $insertRow = function (string $addr, string $kind, string $asset, float $amount, string $memo) use ($created): void {
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                [$addr, $kind, '완료', $asset, $amount, 0, 0, $memo, $created]
            );
        };

        // Buyer side: token + USDT gross + fee
        if ($buyer !== '' && !$isAmm($buyer)) {
            if (!$dryRun) {
                $insertRow($buyer, 'trade_buy', 'SilicaSTO', $qty,
                    sprintf('Bought %s SilicaSTO @ %s USDT (order #%d, backfill)', $qtyStr, $priceStr, $oid));
                $insertRow($buyer, 'trade_buy_pay', 'USDT', $usdt,
                    sprintf('Buy payment for %s SilicaSTO @ %s USDT (order #%d, backfill)', $qtyStr, $priceStr, $oid));
                if ($fee > 0) {
                    $insertRow($buyer, 'trade_buy_fee', 'USDT', $fee,
                        sprintf('Buy fee for %s SilicaSTO (order #%d, backfill)', $qtyStr, $oid));
                }
            }
            $inserted += $fee > 0 ? 3 : 2;
        } else if ($isAmm($buyer)) {
            $skippedAmm++;
        }

        // Seller side: token + USDT gross + fee
        if ($seller !== '' && !$isAmm($seller)) {
            if (!$dryRun) {
                $insertRow($seller, 'trade_sell', 'SilicaSTO', $qty,
                    sprintf('Sold %s SilicaSTO @ %s USDT (order #%d, backfill)', $qtyStr, $priceStr, $oid));
                $insertRow($seller, 'trade_sell_recv', 'USDT', $usdt,
                    sprintf('Sell proceeds from %s SilicaSTO @ %s USDT (order #%d, backfill)', $qtyStr, $priceStr, $oid));
                if ($fee > 0) {
                    $insertRow($seller, 'trade_sell_fee', 'USDT', $fee,
                        sprintf('Sell fee for %s SilicaSTO (order #%d, backfill)', $qtyStr, $oid));
                }
            }
            $inserted += $fee > 0 ? 3 : 2;
        } else if ($isAmm($seller)) {
            $skippedAmm++;
        }
    }

    jsonOk([
        'ok' => true,
        'dry_run' => $dryRun,
        'trade_count' => $tradeCount,
        'deleted' => $deleted,
        'inserted' => $inserted,
        'skipped_amm' => $skippedAmm,
    ]);
});
