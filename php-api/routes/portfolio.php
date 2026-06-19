<?php
/**
 * Portfolio & Wallet routes
 *
 * (2026-05-08) v3 — SOLD-cancel filter removed. See foreach comment
 * in /api/portfolio. Bumped to bust PHP opcache on Hostinger when
 * the operator hits any /api/* endpoint.
 */

if (!function_exists('portfolioTableExists')) {
    function portfolioTableExists(string $table): bool {
        try {
            return (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                [$table]
            ) > 0;
        } catch (Throwable $e) {
            error_log('/api/portfolio tableExists fallback: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('portfolioColumnExists')) {
    function portfolioColumnExists(string $table, string $column): bool {
        try {
            return (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                [$table, $column]
            ) > 0;
        } catch (Throwable $e) {
            error_log('/api/portfolio columnExists fallback: ' . $e->getMessage());
            return false;
        }
    }
}

get('/api/portfolio', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    ensureUser($address);

    $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$address]);
    $holdings = DB::fetchAll(
        "SELECT h.*, a.name AS asset_name, a.name AS name,
                a.status AS asset_status, a.status AS status,
                a.market, a.apr, a.settlement_basis, a.image_url, a.token_image_url,
                a.is_public, a.token_mint_address
         FROM holdings h
         JOIN assets a ON a.id = h.asset_id
         WHERE h.address=?",
        [$address]
    );
    $holdings = array_map(function($row){
        $row['token_name'] = getAssetTokenName($row);
        $row['token_symbol'] = getAssetTokenSymbol($row);
        return $row;
    }, $holdings);

    $funding = DB::fetchAll(
        "SELECT *
           FROM (
                SELECT CONCAT('funding_record:', CAST(f.id AS CHAR)) AS row_key,
                       'funding_record' AS entry_kind,
                       f.id AS source_id,
                       f.address,
                       f.asset_id,
                       f.contract_id,
                       f.amount_usdt,
                       f.created_at,
                       a.name AS asset_name,
                       a.name AS name,
                       a.status AS asset_status,
                       a.status AS status,
                       CASE
                           WHEN COALESCE(a.status,'') IN ('모집실패','취소됨') THEN '취소 됨 (자산반환)'
                           ELSE NULL
                       END AS funding_status_label
                  FROM funding_records f
                  JOIN assets a ON a.id = f.asset_id
                 WHERE f.address=?
                UNION ALL
                SELECT CONCAT('contract_refund:', CAST(c.id AS CHAR)) AS row_key,
                       'contract_refund' AS entry_kind,
                       c.id AS source_id,
                       c.address,
                       c.asset_id,
                       c.id AS contract_id,
                       c.amount_usdt,
                       COALESCE(c.user_signed_at, c.created_at, c.updated_at) AS created_at,
                       a.name AS asset_name,
                       a.name AS name,
                       a.status AS asset_status,
                       a.status AS status,
                       '취소 됨 (자산반환)' AS funding_status_label
                  FROM investment_contracts c
                  JOIN assets a ON a.id = c.asset_id
             LEFT JOIN funding_records fr ON fr.contract_id = c.id
                 WHERE c.address=?
                   AND c.status='rejected'
                   AND fr.id IS NULL
                   AND COALESCE(c.amount_usdt,0) > 0
                   AND (
                        COALESCE(c.rejected_reason,'') IN ('asset_canceled','asset_cancelled','admin_void')
                        OR COALESCE(a.status,'') IN ('모집실패','취소됨')
                   )
           ) t
       ORDER BY t.created_at DESC, t.source_id DESC",
        [$address, $address]
    );
    $fundingCount = count($funding);
    $fundingRequestCount = max(countUserFundingRequests($address), $fundingCount);

    $interestSummary = [];
    $interestSummaryRows = [];
    try {
        $hasInterestTable = !empty(DB::fetchAll("SHOW TABLES LIKE 'interest_claims'"));
        if ($hasInterestTable) {
            $hasClaimedAt = !empty(DB::fetchAll("SHOW COLUMNS FROM `interest_claims` LIKE 'claimed_at'"));
            if ($hasClaimedAt) {
                // (2026-05-08 v3) LEFT JOIN sales / assets removed —
                //   were only used by the SOLD-cancel filter, which has
                //   been deleted (see comment below in the foreach).
                //   Removing them also eliminates the row-multiplication
                //   risk when sales has multiple rows per asset_id.
                //   TRIM() on both sides preserved (defensive against
                //   legacy whitespace-padded addresses).
                $rows = DB::fetchAll(
                    "SELECT i.asset_id,
                            i.amount_usdt,
                            i.claimed_at,
                            i.month_key
                     FROM interest_claims i
                     WHERE TRIM(i.address)=TRIM(?)
                       AND NOT (i.claimed_at IS NULL AND COALESCE(i.amount_usdt,0) < 0.1)
                     ORDER BY i.asset_id ASC, i.id ASC",
                    [$address]
                );

                $aggregates = [];
                foreach ($rows as $row) {
                    $assetIdKey = (string)($row['asset_id'] ?? '');
                    if ($assetIdKey === '') continue;

                    if (!isset($aggregates[$assetIdKey])) {
                        $aggregates[$assetIdKey] = [
                            'asset_id' => $assetIdKey,
                            'total_rounds' => 0,
                            'total_interest_usdt' => 0.0,
                            'pending_interest_usdt' => 0.0,
                            'claimed_interest_usdt' => 0.0,
                            'pending_rounds' => 0,
                            'claimed_rounds' => 0,
                            'last_claimed_at' => null,
                        ];
                    }

                    $isPending = empty($row['claimed_at']);
                    $includeRow = true;
                    // (2026-05-08 v3) SOLD-cancel filter REMOVED.
                    //   Silica is a USDT-pegged perpetual single-asset
                    //   stake — there is no RECON-style auction "sold"
                    //   lifecycle. The previous filter dropped every
                    //   pending interest row whenever assets.status was
                    //   '매각' (regardless of whether a real sales record
                    //   existed), making 25.8 USDT of legitimate accruals
                    //   invisible to the user even though force-interest
                    //   wrote them and the notification popup correctly
                    //   announced them. Operator's console showed the
                    //   smoking-gun MISMATCH: 9 server rows aggregating
                    //   to 0. We now keep every accrued row visible
                    //   regardless of asset_status.
                    //
                    //   If RECON multi-asset behavior is ever restored,
                    //   gate this filter behind a per-asset config flag
                    //   instead of a status string + nowKST() fallback.

                    if (!$includeRow) continue;

                    $amountUsdt = (float)($row['amount_usdt'] ?? 0);
                    $aggregates[$assetIdKey]['total_rounds']++;
                    $aggregates[$assetIdKey]['total_interest_usdt'] += $amountUsdt;

                    if ($isPending) {
                        $aggregates[$assetIdKey]['pending_interest_usdt'] += $amountUsdt;
                        $aggregates[$assetIdKey]['pending_rounds']++;
                    } else {
                        $aggregates[$assetIdKey]['claimed_interest_usdt'] += $amountUsdt;
                        $aggregates[$assetIdKey]['claimed_rounds']++;
                        $claimedAt = $row['claimed_at'] ?? null;
                        if ($claimedAt && (!$aggregates[$assetIdKey]['last_claimed_at'] || strcmp((string)$claimedAt, (string)$aggregates[$assetIdKey]['last_claimed_at']) > 0)) {
                            $aggregates[$assetIdKey]['last_claimed_at'] = $claimedAt;
                        }
                    }
                }

                $interestSummaryRows = array_values($aggregates);
            } else {
                $interestSummaryRows = DB::fetchAll(
                    "SELECT asset_id,
                            COUNT(*) AS total_rounds,
                            COALESCE(SUM(amount_usdt),0) AS total_interest_usdt,
                            0 AS pending_interest_usdt,
                            COALESCE(SUM(amount_usdt),0) AS claimed_interest_usdt,
                            0 AS pending_rounds,
                            COUNT(*) AS claimed_rounds,
                            MAX(created_at) AS last_claimed_at
                     FROM interest_claims
                     WHERE TRIM(address)=TRIM(?)
                     GROUP BY asset_id",
                    [$address]
                );
            }
        }
    } catch (Throwable $e) {
        error_log('/api/portfolio interestSummary fallback: ' . $e->getMessage());
        $interestSummaryRows = [];
    }
    // (2026-05-08) Diagnostic — raw row counts for the resolved address
    //   so the operator can check from the browser console whether the
    //   server-side query found anything. Front-end logs the response
    //   via window.__SILICA_DEBUG_PORTFOLIO__.
    $debugInterestStats = [
        'address_used' => $address,
        'address_length' => strlen($address),
        'address_hex' => bin2hex($address),
        'exact_match_rows'   => 0,
        'trim_match_rows'    => 0,
        'pending_rows'       => 0,
        'pending_total_usdt' => 0.0,
        'silica_asset_status'   => null,
        'silica_has_sale_record'=> null,
        'aggregation_dropped'   => 0,  // diff between trim_match_rows and aggregated total
    ];
    try {
        $exactRow = DB::fetchOne("SELECT COUNT(*) AS c FROM interest_claims WHERE address=?", [$address]);
        $debugInterestStats['exact_match_rows'] = (int)($exactRow['c'] ?? 0);
        $trimRow  = DB::fetchOne("SELECT COUNT(*) AS c FROM interest_claims WHERE TRIM(address)=TRIM(?)", [$address]);
        $debugInterestStats['trim_match_rows'] = (int)($trimRow['c'] ?? 0);
        $pendRow  = DB::fetchOne(
            "SELECT COUNT(*) AS c, COALESCE(SUM(amount_usdt),0) AS s
             FROM interest_claims
             WHERE TRIM(address)=TRIM(?) AND claimed_at IS NULL",
            [$address]
        );
        $debugInterestStats['pending_rows'] = (int)($pendRow['c'] ?? 0);
        $debugInterestStats['pending_total_usdt'] = (float)($pendRow['s'] ?? 0);

        // Silica-specific fields so we can see at a glance whether the
        // SOLD-cancel filter would trigger.
        $silicaRow = DB::fetchOne("SELECT status FROM assets WHERE id=?", ['SILICA-79907']);
        $debugInterestStats['silica_asset_status'] = $silicaRow ? (string)$silicaRow['status'] : null;
        $saleRow = DB::fetchOne(
            "SELECT executed_at, window_start FROM sales
             WHERE asset_id=? AND (executed_at IS NOT NULL OR window_start IS NOT NULL)
             LIMIT 1",
            ['SILICA-79907']
        );
        $debugInterestStats['silica_has_sale_record'] = !empty($saleRow);
    } catch (Throwable $e) {
        $debugInterestStats['error'] = $e->getMessage();
    }

    foreach ($interestSummaryRows as $row) {
        $interestSummary[(string)$row['asset_id']] = [
            'asset_id' => (string)$row['asset_id'],
            'total_rounds' => (int)($row['total_rounds'] ?? 0),
            'total_interest_usdt' => (float)($row['total_interest_usdt'] ?? 0),
            'pending_interest_usdt' => (float)($row['pending_interest_usdt'] ?? 0),
            'claimed_interest_usdt' => (float)($row['claimed_interest_usdt'] ?? 0),
            'pending_rounds' => (int)($row['pending_rounds'] ?? 0),
            'claimed_rounds' => (int)($row['claimed_rounds'] ?? 0),
            'last_claimed_at' => $row['last_claimed_at'] ?? null,
        ];
    }

    // Get referrer from validated referral_links only
    $myReferrer = null;
    try {
        $refLink = getValidReferralLinkForInvestor($address);
        $myReferrer = $refLink['referrer_code'] ?? null;
    } catch (Throwable $e) {}

    // Get my referral code if I am an approved referrer
    $myRefCode = null;
    try {
        $myCodeRow = DB::fetchOne("SELECT code FROM referrer_codes WHERE address=? AND is_active=1", [$address]);
        $myRefCode = $myCodeRow['code'] ?? null;
    } catch (Throwable $e) {}

    // (2026-05-11 v240) Cumulative dividend paid (Silica) — operator:
    //   '아직 배당금이 지급 되지 않았지만 지급 된 것으로 나오고 총 수량도
    //   무언가 맞지 않다.' Old code used silicaBal (wallet balance) as
    //   the dividend total, which conflated investment-token holdings
    //   with actual payouts. Sum kind='dividend_claim' from
    //   wallet_transactions for the correct figure.
    $cumulativeDividendSilica = 0.0;
    try {
        $cumulativeDividendSilica = (float)DB::fetchValue(
            "SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions
              WHERE TRIM(address)=TRIM(?)
                AND kind='dividend_claim'
                AND (status IS NULL OR status NOT IN ('실패','반려','취소'))",
            [$address]
        );
    } catch (Throwable $_) { /* table missing — treat as 0 */ }

    // (2026-05-17 v439) 운영자 요청: 'USDT 와 SilicaSTO 카드에 관리자 승인
    //   대기 자산을 표기'. 각 카드 아래에 admin 승인 대기 중인 수량을 노출.
    //   - pendingDepositUsdt : wallet_transactions 의 USDT 입금 status='대기'
    //   - pendingDepositSto  : wallet_transactions 의 SilicaSTO 입금 status='대기'
    //   - pendingFundingSto  : investment_contracts.status='awaiting_admin' 합계
    //                          (1 USDT = 1 SilicaSTO peg 이라 amount_usdt 그대로)
    //   SQL 에러 시 silent 0 폴백 (메인 응답 보호).
    $pendingDepositUsdt = 0.0;
    $pendingDepositSto  = 0.0;
    $pendingDepositSilica = 0.0;
    try {
        $pendingDepositUsdt = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(amount),0) FROM wallet_transactions
              WHERE TRIM(address)=TRIM(?)
                AND status='대기'
                AND (kind LIKE '%deposit%' OR kind='입금')
                AND (asset IS NULL OR UPPER(asset)='USDT')",
            [$address]
        ) ?? 0);
    } catch (Throwable $_) { /* table or column missing — treat as 0 */ }
    try {
        $pendingDepositSto = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(amount),0) FROM wallet_transactions
              WHERE TRIM(address)=TRIM(?)
                AND status='대기'
                AND (kind LIKE '%deposit%' OR kind='입금')
                AND UPPER(asset)='SILICASTO'",
            [$address]
        ) ?? 0);
    } catch (Throwable $_) { /* table or column missing — treat as 0 */ }
    // (2026-05-21 v731) Silica 입금 대기도 SilicaSTO 와 동일하게 카드에 표시.
    try {
        $pendingDepositSilica = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(amount),0) FROM wallet_transactions
              WHERE TRIM(address)=TRIM(?)
                AND status='대기'
                AND (kind LIKE '%deposit%' OR kind='입금')
                AND UPPER(asset)='SILICA'",
            [$address]
        ) ?? 0);
    } catch (Throwable $_) { /* table or column missing — treat as 0 */ }
    $pendingFundingSto = 0.0;
    try {
        $pendingFundingSto = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(amount_usdt),0) FROM investment_contracts
              WHERE TRIM(address)=TRIM(?) AND status='awaiting_admin'",
            [$address]
        ) ?? 0);
    } catch (Throwable $_) { /* table missing — treat as 0 */ }

    // (2026-05-21 v719) 운영자 요청: 출금 대기 수량도 portfolio 카드에 표시.
    //   - pendingWithdrawUsdt   : withdraw_requests.amount, status IN (pending, processing)
    //   - pendingWithdrawSto    : token_withdraw_requests.amount_token, status pending/processing,
    //                              asset_id IN ('SilicaSTO', canonical SILICA-79907)
    //   - pendingWithdrawSilica : 같은 테이블, asset_id='Silica'
    //   잔액에서는 이미 차감되어 있지만 사용자가 "내가 N USDT 출금 요청해두었다"
    //   는 사실을 카드에서 한눈에 확인 가능하도록.
    $pendingWithdrawUsdt = 0.0;
    $pendingWithdrawSto = 0.0;
    $pendingWithdrawSilica = 0.0;
    try {
        if (portfolioTableExists('withdraw_requests')) {
            $pendingWithdrawUsdt = (float)(DB::fetchValue(
                "SELECT COALESCE(SUM(amount),0) FROM withdraw_requests
                  WHERE TRIM(address)=TRIM(?)
                    AND LOWER(TRIM(status)) IN ('pending', 'processing')",
                [$address]
            ) ?? 0);
        }
    } catch (Throwable $_) { /* table missing — treat as 0 */ }
    try {
        if (portfolioTableExists('token_withdraw_requests')) {
            $pendingWithdrawSto = (float)(DB::fetchValue(
                "SELECT COALESCE(SUM(amount_token),0) FROM token_withdraw_requests
                  WHERE TRIM(address)=TRIM(?)
                    AND LOWER(TRIM(status)) IN ('pending', 'processing')
                    AND asset_id IN ('SilicaSTO', 'SILICA-79907')",
                [$address]
            ) ?? 0);
            $pendingWithdrawSilica = (float)(DB::fetchValue(
                "SELECT COALESCE(SUM(amount_token),0) FROM token_withdraw_requests
                  WHERE TRIM(address)=TRIM(?)
                    AND LOWER(TRIM(status)) IN ('pending', 'processing')
                    AND asset_id = 'Silica'",
                [$address]
            ) ?? 0);
        }
    } catch (Throwable $_) { /* table missing — treat as 0 */ }

    jsonOk([
        'address'             => $address,
        'usdt'                => (float)($bal['usdt'] ?? 0),
        'holdings'            => $holdings,
        'funding'             => $funding,
        'fundingCount'        => $fundingCount,
        'fundingRequestCount' => $fundingRequestCount,
        'hasAnyFunding'       => ($fundingCount > 0 || $fundingRequestCount > 0),
        // (2026-05-17 v439) admin 승인 대기 자산 — frontend 카드에 표시.
        'pendingDepositUsdt'   => round($pendingDepositUsdt, 6),
        'pendingDepositSto'    => round($pendingDepositSto, 6),
        'pendingDepositSilica' => round($pendingDepositSilica, 6),
        'pendingFundingSto'    => round($pendingFundingSto, 6),
        // (2026-05-21 v719) 출금 대기 수량 — 사용자 카드에 표시.
        'pendingWithdrawUsdt'   => round($pendingWithdrawUsdt, 6),
        'pendingWithdrawSto'    => round($pendingWithdrawSto, 6),
        'pendingWithdrawSilica' => round($pendingWithdrawSilica, 6),
        // (2026-05-16 v426) 추천인 정책 전용 — funding_records (admin-sign 후)
        //   기준만 적용. v429 에서 hasSignedFunding 으로 키 교체 (한 단계 더 빠름).
        'hasConfirmedFunding' => ($fundingCount > 0),
        // (2026-05-16 v429) 추천인 정책 키 — contract 서명 시점부터 고정.
        'hasSignedFunding'    => function_exists('hasUserSignedFunding')
                                ? hasUserSignedFunding($address)
                                : ($fundingRequestCount > 0),
        'interestSummary'     => $interestSummary,
        'interestSummaryDebug'=> $debugInterestStats,
        'cumulativeDividendSilica' => $cumulativeDividendSilica,
        'ref_code'            => $myReferrer,
        'myReferrer'          => $myReferrer,
        'myRefCode'           => $myRefCode,
    ]);
});

/**
 * (2026-05-11 v230) Read-time virtual transformation. Replaces the
 * v221-v229 attempts to DELETE+INSERT new-schema rows in
 * wallet_transactions. Operator's DB has a strict append-only policy
 * enforced by triggers:
 *   - trg_wallet_transactions_no_delete: blocks every DELETE
 *   - trg_wallet_transactions_guard_update: blocks every UPDATE that
 *     changes immutable fields (kind, asset, amount, etc.)
 *
 * So the legacy rows physically can't be migrated. Instead, the
 * /api/wallet/transactions endpoint now SYNTHESIZES the new-schema
 * rows on the fly: when it spots a legacy row, it looks up the source
 * trade / interest_claim records and emits virtual replacement rows
 * in the response. Persisted DB state is left untouched.
 */
function portfolioVirtualizeLegacyTradeRows(array $rows, string $address): array {
    if (!$rows) return $rows;
    $needsTransform = false;
    foreach ($rows as $r) {
        $kind = (string)($r['kind'] ?? '');
        $asset = (string)($r['asset'] ?? '');
        if (($kind === 'trade_buy' || $kind === 'trade_sell') && $asset === 'USDT') {
            $needsTransform = true;
            break;
        }
    }
    if (!$needsTransform) return $rows;

    $minFee = defined('MIN_TRADE_FEE_USDT') ? (float)MIN_TRADE_FEE_USDT : 0.001;
    $estFee = function (float $usdt, float $feePct) use ($minFee): float {
        if ($feePct <= 0) return 0.0;
        $raw = $usdt * $feePct / 100.0;
        return $raw < $minFee ? $minFee : round($raw, 6);
    };
    $orderInfoCache = [];
    $tradeByOrderCache = [];

    $out = [];
    foreach ($rows as $r) {
        $kind = (string)($r['kind'] ?? '');
        $asset = (string)($r['asset'] ?? '');
        if (!(($kind === 'trade_buy' || $kind === 'trade_sell') && $asset === 'USDT')) {
            $out[] = $r;
            continue;
        }
        // (v232) Resolve the matching trade. Prefer order #N from the
        //   memo, but fall back to a created_at + address proximity
        //   lookup — operator's legacy wallet_tx rows have memos with
        //   'order #0' (a v214-era bug where makerOrderId wasn't
        //   passed correctly), so the order-id path always failed.
        $oid = 0;
        if (preg_match('/order #(\d+)/', (string)($r['memo'] ?? ''), $m)) {
            $oid = (int)$m[1];
        }
        $rowCreatedAt = (string)($r['created_at'] ?? '');

        $trade = null;
        if ($oid > 0) {
            $cacheKey = 'oid:' . $oid;
            if (!isset($tradeByOrderCache[$cacheKey])) {
                $tradeByOrderCache[$cacheKey] = DB::fetchOne(
                    "SELECT * FROM trades
                      WHERE order_id=?
                        AND (TRIM(maker_address)=TRIM(?) OR TRIM(taker_address)=TRIM(?))
                      ORDER BY id ASC LIMIT 1",
                    [$oid, $address, $address]
                );
            }
            $trade = $tradeByOrderCache[$cacheKey];
        }
        // Fallback: created_at proximity match. trades.created_at and
        //   the legacy wallet_tx.created_at are written from the same
        //   nowUtcSql() in v214-v219 marketLogTradeFill, so they
        //   should match exactly. Allow a ±2 second window for any
        //   sub-second drift.
        if (!$trade && $rowCreatedAt !== '') {
            $cacheKey = 'ts:' . $rowCreatedAt;
            if (!isset($tradeByOrderCache[$cacheKey])) {
                $tradeByOrderCache[$cacheKey] = DB::fetchOne(
                    "SELECT * FROM trades
                      WHERE (TRIM(maker_address)=TRIM(?) OR TRIM(taker_address)=TRIM(?))
                        AND ABS(TIMESTAMPDIFF(SECOND, created_at, ?)) <= 2
                      ORDER BY id ASC LIMIT 1",
                    [$address, $address, $rowCreatedAt]
                );
            }
            $trade = $tradeByOrderCache[$cacheKey];
        }
        if (!$trade) { $out[] = $r; continue; }
        // Now we have a trade — ensure we have order info too. Take
        //   order_id from the matched trade if memo didn't supply one.
        $resolvedOid = (int)($trade['order_id'] ?? $oid);
        if ($resolvedOid > 0 && !isset($orderInfoCache[$resolvedOid])) {
            $orow = DB::fetchOne("SELECT side, fee_rate FROM orders WHERE id=?", [$resolvedOid]);
            $orderInfoCache[$resolvedOid] = [
                'side' => (string)($orow['side'] ?? ''),
                'fee_rate' => (float)($orow['fee_rate'] ?? 0.1),
            ];
        }
        $oid = $resolvedOid;

        $price = (float)($trade['price'] ?? 0);
        $qty = (float)($trade['amount'] ?? $trade['qty'] ?? 0);
        $usdt = (float)($trade['total_usdt'] ?? ($price * $qty));
        if ($qty <= 0 || $usdt <= 0) { $out[] = $r; continue; }

        // (v232) Defensive lookup — if the order was missing or oid=0,
        //   fall back to a default fee_rate so we still produce a fee
        //   row (better than a free trade in the user's history view).
        $orderInfo = $orderInfoCache[$oid] ?? ['side' => '', 'fee_rate' => 0.1];
        $feePct = (float)$orderInfo['fee_rate'];
        $fee = $estFee($usdt, $feePct);

        // Synthesize the new-schema rows. We reuse the legacy row's id
        //   for the FIRST emitted virtual row (so any UI that keys on
        //   id stays stable) and append '-pay' / '-fee' suffix for the
        //   additional ones. created_at is copied so timestamps line up.
        $created = (string)($r['created_at'] ?? nowUtcSql());
        $baseId = (string)($r['id'] ?? '');
        $qtyStr = rtrim(rtrim(number_format($qty, 6, '.', ''), '0'), '.') ?: '0';
        $priceStr = number_format($price, 2, '.', '');

        $mkRow = function (string $idSuffix, string $kindOut, string $assetOut, float $amountOut, string $memoOut)
            use ($baseId, $address, $created): array {
            return [
                'id' => $baseId . $idSuffix,
                'address' => $address,
                'kind' => $kindOut,
                'status' => '완료',
                'asset' => $assetOut,
                'amount' => $amountOut,
                'before_amount' => 0,
                'after_amount' => 0,
                'memo' => $memoOut,
                'txid' => null,
                'created_at' => $created,
                '_virtual' => true,
            ];
        };

        // (v231) Take the cue from the LEGACY ROW's kind, not the
        //   buyer/seller computation. The legacy row already says
        //   whether this user paid (trade_buy) or received (trade_sell)
        //   on this match — we just need to expand it. The earlier
        //   buyer/seller mapping was failing on self-trade rows where
        //   maker == taker == user (both sides true → first branch
        //   only), or on rows whose memo's order #N pointed to a
        //   DIFFERENT trade (multi-fill order).
        $isBuyerLeg = ((string)($r['kind'] ?? '') === 'trade_buy');
        if ($isBuyerLeg) {
            $out[] = $mkRow('',     'trade_buy',     'SilicaSTO', $qty,
                sprintf('Bought %s SilicaSTO @ %s USDT (order #%d, virtual)', $qtyStr, $priceStr, $oid));
            $out[] = $mkRow('-pay', 'trade_buy_pay', 'USDT',      $usdt,
                sprintf('Buy payment for %s SilicaSTO @ %s USDT (order #%d, virtual)', $qtyStr, $priceStr, $oid));
            if ($fee > 0) {
                $out[] = $mkRow('-fee', 'trade_buy_fee', 'USDT', $fee,
                    sprintf('Buy fee for %s SilicaSTO (order #%d, virtual)', $qtyStr, $oid));
            }
        } else {
            // kind === 'trade_sell'
            $out[] = $mkRow('',      'trade_sell',      'SilicaSTO', $qty,
                sprintf('Sold %s SilicaSTO @ %s USDT (order #%d, virtual)', $qtyStr, $priceStr, $oid));
            $out[] = $mkRow('-recv', 'trade_sell_recv', 'USDT',      $usdt,
                sprintf('Sell proceeds from %s SilicaSTO @ %s USDT (order #%d, virtual)', $qtyStr, $priceStr, $oid));
            if ($fee > 0) {
                $out[] = $mkRow('-fee', 'trade_sell_fee', 'USDT', $fee,
                    sprintf('Sell fee for %s SilicaSTO (order #%d, virtual)', $qtyStr, $oid));
            }
        }
    }
    return $out;
}

/**
 * (2026-05-11 v230) Same idea for legacy aggregated interest_claim
 * rows: synthesize per-cycle virtual rows from interest_claims at read
 * time. The DB delete trigger blocks the v221-v223 split-and-replace
 * approach, so we don't touch the table.
 */
function portfolioVirtualizeAggregatedInterest(array $rows, string $address): array {
    if (!$rows) return $rows;
    $needsTransform = false;
    foreach ($rows as $r) {
        if ((string)($r['kind'] ?? '') !== 'interest_claim') continue;
        $memo = (string)($r['memo'] ?? '');
        // Legacy = lacks the v220 '회차 ICB-' marker; new live rows have it.
        if (strpos($memo, '회차 ICB-') === false) {
            $needsTransform = true;
            break;
        }
    }
    if (!$needsTransform) return $rows;

    $out = [];
    foreach ($rows as $r) {
        if ((string)($r['kind'] ?? '') !== 'interest_claim') { $out[] = $r; continue; }
        $memo = (string)($r['memo'] ?? '');
        if (strpos($memo, '회차 ICB-') !== false) { $out[] = $r; continue; }

        $createdAt = (string)($r['created_at'] ?? '');
        if ($createdAt === '') { $out[] = $r; continue; }

        // Find the per-cycle interest_claims rows for this aggregated
        //   row. Match by claimed_at = wallet_tx.created_at (claim
        //   inserts both rows under the same nowUtcSql() value).
        $cycles = DB::fetchAll(
            "SELECT * FROM interest_claims
              WHERE TRIM(address)=TRIM(?)
                AND claimed_at = ?
                AND amount_usdt > 0
              ORDER BY id ASC",
            [$address, $createdAt]
        );
        if (!$cycles) {
            // Fallback: pull all claimed cycles for this user and pick
            //   any that the legacy row's amount could be the SUM of.
            //   For now, just keep the legacy row when timestamp
            //   matching fails.
            $out[] = $r;
            continue;
        }

        $baseId = (string)($r['id'] ?? '');
        foreach ($cycles as $idx => $c) {
            $monthKey = (string)($c['month_key'] ?? '');
            $cycleUsdt = round((float)($c['amount_usdt'] ?? 0), 6);
            $batchId = (string)($c['claim_batch_id'] ?? '');
            $assetId = (string)($c['asset_id'] ?? '');
            if ($cycleUsdt <= 0) continue;
            $out[] = [
                'id' => $baseId . '-c' . $idx,
                'address' => $address,
                'kind' => 'interest_claim',
                'status' => '완료',
                'asset' => 'USDT',
                'amount' => $cycleUsdt,
                'before_amount' => 0,
                'after_amount' => 0,
                'memo' => sprintf('스테이킹 이자 클레임 %s · %s · 회차 %s (virtual)', $assetId, $monthKey, $batchId),
                'txid' => null,
                'created_at' => $createdAt,
                '_virtual' => true,
            ];
        }
    }
    return $out;
}


get('/api/wallet/transactions', function () {
    // (2026-05-07) authMfaRequired → authRequired 로 완화.
    //   거래 내역 조회는 본인 데이터만 반환하는 read-only 액션이므로 OTP 까지
    //   요구할 필요가 없다. OTP 미등록 사용자가 history.html 에서 빈 화면만
    //   보던 문제 해소. (송금/출금처럼 잔액 변경 액션은 여전히 authMfaRequired.)
    $user = authRequired();
    $address = $user['address'];
    $limit = min(500, max(1, (int)($_GET['limit'] ?? 50)));

    // (2026-05-11 v281) Operator: '히스토리에서 트레이드만 표기되고 나머지
    //   탭은 비워져 있다.' Trade fills emit 3 wallet_transactions rows per
    //   side × 2 sides per match. A few dozen recent trades easily fill the
    //   50-row window so older deposit / invest / staking rows get cut off
    //   even though they exist. Add server-side kind filtering so each tab
    //   pulls its own deep slice instead of competing for the same 50 slots.
    //   Patterns mirror the frontend TAB_FILTERS regex map.
    $kindFilter = strtolower(trim((string)($_GET['kind'] ?? '')));
    $kindWhere = '';
    static $KIND_FILTER_MAP = null;
    if ($KIND_FILTER_MAP === null) {
        // (2026-05-12 v310) Operator: '추천인 승인을 받은 유저는 히스토리에서
        //   러퍼럴 수익 항목이 나타나야한다. 일반 유저는 보여서는 안된다.'
        //   referral_bonus 를 interest 필터에서 분리해 별도 'referral_bonus'
        //   kind 로 옮겼다. 프론트의 Referral 전용 탭이 이 필터를 사용하고,
        //   비-referrer 사용자는 클라이언트에서 한 번 더 referral_bonus 행을
        //   숨긴다 (서버는 본인 주소 행만 반환하지만 과거 referrer 상태였던
        //   사용자가 비활성화된 경우에도 행이 남아 있을 수 있어 안전 장치).
        $KIND_FILTER_MAP = [
            'deposit_withdraw' => "(t.kind LIKE 'deposit%' OR t.kind LIKE 'withdraw%')",
            'investments'      => "t.kind LIKE 'invest%'",
            'staking'          => "(t.kind LIKE 'stake%' OR t.kind LIKE 'unstake%')",
            'interest'         => "t.kind LIKE 'interest%'",
            'referral_bonus'   => "t.kind LIKE 'referral_bonus%'",
            'dividend'         => "t.kind LIKE '%dividend%'",
            'swap'             => "t.kind LIKE '%swap%'",
            'trade'            => "(t.kind LIKE 'trade%' OR t.kind LIKE 'order%')",
        ];
    }
    if ($kindFilter !== '' && isset($KIND_FILTER_MAP[$kindFilter])) {
        $kindWhere = ' AND ' . $KIND_FILTER_MAP[$kindFilter];
    }

    // (2026-05-11 v230 / cleaned in v233) Read-time virtualization
    //   handles the legacy v214-v219 trade rows + aggregated interest
    //   rows below (after the SELECT). DB triggers
    //   (trg_wallet_transactions_no_delete +
    //   trg_wallet_transactions_guard_update) enforce strict
    //   append-only semantics, so DELETE/UPDATE-based migration is not
    //   possible — the response is rewritten on the fly instead.

    $select = ['t.*'];
    $join = '';
    if (portfolioTableExists('withdraw_requests')) {
        $join = ' LEFT JOIN withdraw_requests wr ON wr.wallet_tx_id = t.id ';
        $select[] = portfolioColumnExists('withdraw_requests', 'fee_mode')
            ? 'wr.fee_mode AS withdraw_fee_mode'
            : 'NULL AS withdraw_fee_mode';
        $select[] = portfolioColumnExists('withdraw_requests', 'fee_value')
            ? 'wr.fee_value AS withdraw_fee_value'
            : 'NULL AS withdraw_fee_value';
        $select[] = portfolioColumnExists('withdraw_requests', 'fee_amount')
            ? 'wr.fee_amount AS withdraw_fee_amount'
            : 'NULL AS withdraw_fee_amount';
        $select[] = portfolioColumnExists('withdraw_requests', 'net_amount')
            ? 'wr.net_amount AS withdraw_net_amount'
            : 'NULL AS withdraw_net_amount';
    } else {
        $select[] = 'NULL AS withdraw_fee_mode';
        $select[] = 'NULL AS withdraw_fee_value';
        $select[] = 'NULL AS withdraw_fee_amount';
        $select[] = 'NULL AS withdraw_net_amount';
    }

    // (2026-05-21 v700) 운영자 보고: 'history 의 토큰 출금 실패 행에 사유
    //   버튼이 안 나타남. USDT 는 정상.'
    //   원인: USDT 만 withdraw_requests JOIN 으로 reject_reason 노출, 토큰은
    //   token_withdraw_requests 의 reject_reason 이 응답에 없어 frontend
    //   parseRejectInfo 가 찾지 못함.
    //   해결: token_withdraw_requests LEFT JOIN 추가하여 두 테이블 중 어느
    //   쪽이든 reject_reason 있으면 'withdraw_reject_reason' 으로 노출.
    // (2026-05-21 v702) v700 배포 후에도 일부 사용자에서 버튼 미노출 보고.
    //   가능 원인:
    //     (a) token_withdraw_requests.wallet_tx_id 가 NULL (구버전 데이터 또는
    //         create 시 컬럼 부재) → wallet_tx_id JOIN 매칭 실패.
    //     (b) cancel endpoint 가 wallet_tx_id NULL 인 경우 wallet_transactions
    //         UPDATE 를 스킵 → admin_note 미설정.
    //   강화책 (각각 독립적 fallback, COALESCE 우선순위 적용):
    //     1) USDT withdraw_requests JOIN — wr.wallet_tx_id = t.id
    //     2) 토큰 wallet_tx_id JOIN — twr.wallet_tx_id = t.id (정확)
    //     3) 토큰 fallback JOIN — address + asset + amount + status (orphan)
    //     4) wallet_transactions.admin_note 의 'reject_reason:<text>' 부분 추출
    $usdtReasonExpr = (portfolioTableExists('withdraw_requests') && portfolioColumnExists('withdraw_requests', 'reject_reason'))
        ? 'wr.reject_reason' : 'NULL';
    $coalesceArgs = [$usdtReasonExpr];

    $hasTwrTable = portfolioTableExists('token_withdraw_requests');
    $hasTwrReason = $hasTwrTable && portfolioColumnExists('token_withdraw_requests', 'reject_reason');
    $hasTwrWalletTxId = $hasTwrTable && portfolioColumnExists('token_withdraw_requests', 'wallet_tx_id');

    if ($hasTwrTable) {
        // 2) wallet_tx_id 기반 정확 매칭 (1차 fallback)
        if ($hasTwrWalletTxId) {
            $join .= ' LEFT JOIN token_withdraw_requests twr ON twr.wallet_tx_id = t.id ';
            if ($hasTwrReason) {
                $coalesceArgs[] = 'twr.reject_reason';
            }
        }
        // 3) address + asset + amount + canceled status fallback (orphan 매칭)
        //    토큰 출금만 (kind='withdraw' AND status='실패') 한정 + canceled twr
        //    한정으로 부정확 매칭 최소화. amount 비교는 절대값 epsilon (소수점
        //    오차 흡수).
        $join .= " LEFT JOIN token_withdraw_requests twr2 ON ("
            . " twr2.address = t.address"
            . " AND LOWER(TRIM(twr2.status)) IN ('canceled','cancelled','failed','rejected')"
            . " AND twr2.asset_id = t.asset"
            . " AND ABS(twr2.amount_token - t.amount) < 0.000001"
            . " AND t.kind = 'withdraw'"
            . " AND t.status = '실패'"
            . ") ";
        if ($hasTwrReason) {
            $coalesceArgs[] = 'twr2.reject_reason';
        }
    }

    // 4) wallet_transactions.admin_note 의 'reject_reason:<text>' 추출.
    //    cancel endpoint 가 'reject_reason:관리자 사유' 형태로 저장 → SUBSTRING
    //    으로 ':' 이후 부분만 추출. admin_note 가 'reject_reason:' 으로 시작
    //    하지 않으면 (예: 입금 거절의 'Reason:...\nContact:...') NULL 처리.
    if (portfolioColumnExists('wallet_transactions', 'admin_note')) {
        $coalesceArgs[] = "CASE WHEN t.admin_note LIKE 'reject_reason:%'"
            . " THEN NULLIF(SUBSTRING(t.admin_note, CHAR_LENGTH('reject_reason:') + 1), '')"
            . " ELSE NULL END";
    }

    // (2026-05-21 v704) 5) twr/twr2 의 memo 에서 'reject_reason:<URL_encoded>' 추출.
    //   cancel endpoint v704+ 가 token_withdraw_requests.memo 에
    //   'reject_reason:<rawurlencode(text)>|cancel_refund_done_v703:1' 형태로
    //   저장. SUBSTRING_INDEX 로 'reject_reason:' 이후 첫번째 '|' 전까지 추출.
    //   reject_reason 컬럼이 없는 배포 환경 / 컬럼은 있지만 cancel endpoint 가
    //   적용되기 전 cancel 행 모두 커버.
    //   (v704) backward compat — 기존 cancel 은 'cancel_reason:' 키 사용 → 두
    //   키 모두 시도. 우선순위: reject_reason 먼저, cancel_reason 두 번째.
    $memoExtractSql = function ($alias, $key) {
        return "CASE WHEN {$alias}.memo LIKE '%{$key}:%'"
            . " THEN NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX({$alias}.memo, '{$key}:', -1), '|', 1), '')"
            . " ELSE NULL END";
    };
    if ($hasTwrTable) {
        if ($hasTwrWalletTxId) {
            $coalesceArgs[] = $memoExtractSql('twr', 'reject_reason');
            $coalesceArgs[] = $memoExtractSql('twr', 'cancel_reason');
        }
        $coalesceArgs[] = $memoExtractSql('twr2', 'reject_reason');
        $coalesceArgs[] = $memoExtractSql('twr2', 'cancel_reason');
    }

    // 6) 같은 패턴으로 wallet_transactions.memo 에서 추출 (가장 마지막 fallback)
    //    cancel endpoint 가 admin_note 컬럼 부재 시 wallet_transactions.memo 에
    //    '|reject_reason:<text>' 부분을 append 함.
    $coalesceArgs[] = $memoExtractSql('t', 'reject_reason');
    $coalesceArgs[] = $memoExtractSql('t', 'cancel_reason');

    $select[] = "COALESCE(" . implode(', ', $coalesceArgs) . ") AS withdraw_reject_reason";

    try {
        $rows = DB::fetchAll(
            "SELECT " . implode(",
                ", $select) . "
"
            . "FROM wallet_transactions t
"
            . $join
            . "WHERE t.address=? {$kindWhere}
"
            . "ORDER BY t.id DESC
"
            . "LIMIT {$limit}",
            [$address]
        );
    } catch (Throwable $e) {
        error_log('/api/wallet/transactions fallback: ' . $e->getMessage());
        $rows = DB::fetchAll(
            "SELECT t.*
"
            . "FROM wallet_transactions t
"
            . "WHERE t.address=? {$kindWhere}
"
            . "ORDER BY t.id DESC
"
            . "LIMIT {$limit}",
            [$address]
        );
        $rows = array_map(function ($row) {
            $row['withdraw_fee_mode'] = null;
            $row['withdraw_fee_value'] = null;
            $row['withdraw_fee_amount'] = null;
            $row['withdraw_net_amount'] = null;
            $row['withdraw_reject_reason'] = null;
            return $row;
        }, $rows);
    }

    // (2026-05-11 v230) Read-time virtualization. Legacy v214-v219
    //   trade rows are expanded into the v220 3-row-per-side schema
    //   (token + USDT-gross + fee), and legacy aggregated
    //   interest_claim rows are split into per-cycle rows. Persisted
    //   DB state stays untouched — DB triggers prevent rewriting it.
    try {
        $rowsAsArrays = array_map(function ($r) {
            return is_array($r) ? $r : (array)$r;
        }, $rows);
        $rowsAsArrays = portfolioVirtualizeLegacyTradeRows($rowsAsArrays, $address);
        $rowsAsArrays = portfolioVirtualizeAggregatedInterest($rowsAsArrays, $address);
        $rows = $rowsAsArrays;
    } catch (Throwable $e) {
        error_log('[portfolio.virtualize] ' . $e->getMessage());
    }

    jsonOk(['transactions' => $rows]);
});
