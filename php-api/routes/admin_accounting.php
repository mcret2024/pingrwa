<?php
/**
 * Admin accounting/statistics routes
 */

if (!function_exists('adminAccountingTableExists')) {
    function adminAccountingTableExists(string $table): bool {
        static $cache = [];
        if (array_key_exists($table, $cache)) return $cache[$table];
        try {
            $cache[$table] = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                [$table]
            ) > 0;
        } catch (Throwable $e) {
            error_log('admin accounting tableExists: ' . $e->getMessage());
            $cache[$table] = false;
        }
        return $cache[$table];
    }
}

if (!function_exists('adminAccountingColumnExists')) {
    function adminAccountingColumnExists(string $table, string $column): bool {
        static $cache = [];
        $key = $table . '.' . $column;
        if (array_key_exists($key, $cache)) return $cache[$key];
        try {
            $cache[$key] = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                [$table, $column]
            ) > 0;
        } catch (Throwable $e) {
            error_log('admin accounting columnExists: ' . $e->getMessage());
            $cache[$key] = false;
        }
        return $cache[$key];
    }
}

if (!function_exists('adminAccountingFetchValue')) {
    function adminAccountingFetchValue(string $sql, array $params = [], $default = 0) {
        try {
            $v = DB::fetchValue($sql, $params);
            if ($v === null) return $default;
            return $v;
        } catch (Throwable $e) {
            error_log('admin accounting fetchValue: ' . $e->getMessage());
            return $default;
        }
    }
}


if (!function_exists('adminAccountingMemoNum')) {
    function adminAccountingMemoNum(?string $memo, $keys): float {
        $src = (string)($memo ?? '');
        $list = is_array($keys) ? $keys : [$keys];
        foreach ($list as $key) {
            $pattern = '/(?:^|\|)' . preg_quote((string)$key, '/') . ':([0-9.]+)/';
            if (preg_match($pattern, $src, $m)) {
                $n = (float)($m[1] ?? 0);
                if (is_finite($n) && $n >= 0) return $n;
            }
        }
        return 0.0;
    }
}

if (!function_exists('adminAccountingMemoText')) {
    function adminAccountingMemoText(?string $memo, $keys): string {
        $src = (string)($memo ?? '');
        $list = is_array($keys) ? $keys : [$keys];
        foreach ($list as $key) {
            $pattern = '/(?:^|\|)' . preg_quote((string)$key, '/') . ':([^|]+)/';
            if (preg_match($pattern, $src, $m) && isset($m[1])) {
                $raw = (string)$m[1];
                $decoded = rawurldecode($raw);
                return $decoded !== '' ? $decoded : $raw;
            }
        }
        return '';
    }
}

if (!function_exists('adminAccountingParseUtc')) {
    function adminAccountingParseUtc(?string $raw): ?DateTimeImmutable {
        $text = trim((string)($raw ?? ''));
        if ($text === '') return null;
        try {
            if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $text)) {
                return new DateTimeImmutable($text, new DateTimeZone('UTC'));
            }
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $text)) {
                return new DateTimeImmutable($text . ' 00:00:00', new DateTimeZone('UTC'));
            }
            return new DateTimeImmutable($text, new DateTimeZone('UTC'));
        } catch (Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('adminAccountingMonthMatches')) {
    function adminAccountingMonthMatches(?string $createdAt, ?string $monthKey): bool {
        if ($monthKey === null || $monthKey === '') return true;
        $dt = adminAccountingParseUtc($createdAt);
        if (!$dt) return false;
        return $dt->setTimezone(new DateTimeZone(TZ))->format('Y-m') === $monthKey;
    }
}

if (!function_exists('adminAccountingEstimateAssetPriceUsdt')) {
    function adminAccountingEstimateAssetPriceUsdt(string $assetId): float {
        static $cache = [];
        $assetId = trim($assetId);
        if ($assetId === '') return 0.0;
        if (array_key_exists($assetId, $cache)) return $cache[$assetId];

        $price = 0.0;
        if (adminAccountingTableExists('trades') && adminAccountingColumnExists('trades', 'price')) {
            $price = (float)adminAccountingFetchValue(
                "SELECT price FROM trades WHERE asset_id=? AND price>0 ORDER BY created_at DESC, id DESC LIMIT 1",
                [$assetId],
                0.0
            );
        }

        if (!($price > 0) && adminAccountingTableExists('assets')) {
            try {
                $asset = DB::fetchOne(
                    "SELECT expected_buy_price_usdt, funded_snapshot_usdt, raised_usdt, supply_token FROM assets WHERE id=? LIMIT 1",
                    [$assetId]
                );
                if ($asset) {
                    $price = (float)($asset['expected_buy_price_usdt'] ?? 0);
                    if (!($price > 0)) {
                        $supply = (float)($asset['supply_token'] ?? 0);
                        $funded = (float)($asset['funded_snapshot_usdt'] ?? $asset['raised_usdt'] ?? 0);
                        if ($supply > 0 && $funded > 0) $price = $funded / $supply;
                    }
                }
            } catch (Throwable $e) {
                error_log('admin accounting asset price fallback: ' . $e->getMessage());
            }
        }

        if (!($price > 0)) $price = 1.0;
        $cache[$assetId] = clamp6($price);
        return $cache[$assetId];
    }
}

if (!function_exists('adminAccountingWithdrawFeeRevenue')) {
    function adminAccountingWithdrawFeeRevenue(?string $monthKey = null): float {
        $sum = 0.0;

        if (adminAccountingTableExists('withdraw_requests')) {
            $select = ['created_at', 'memo', 'status'];
            if (adminAccountingColumnExists('withdraw_requests', 'updated_at')) $select[] = 'updated_at';
            if (adminAccountingColumnExists('withdraw_requests', 'fee_amount')) $select[] = 'fee_amount';
            $rows = [];
            try {
                $rows = DB::fetchAll(
                    "SELECT " . implode(', ', $select) . " FROM withdraw_requests WHERE LOWER(TRIM(status)) IN ('done','sent')"
                );
            } catch (Throwable $e) {
                error_log('admin accounting withdraw fee usdt: ' . $e->getMessage());
                $rows = [];
            }
            foreach ($rows as $row) {
                $eventAt = $row['updated_at'] ?? $row['created_at'] ?? null;
                if (!adminAccountingMonthMatches($eventAt, $monthKey)) continue;
                $fee = isset($row['fee_amount']) ? (float)$row['fee_amount'] : 0.0;
                if (!($fee > 0)) $fee = adminAccountingMemoNum($row['memo'] ?? '', ['fee_amount', 'fee']);
                if ($fee > 0) $sum += max(0.0, $fee);
            }
        }

        if (adminAccountingTableExists('token_withdraw_requests')) {
            $select = ['asset_id', 'created_at', 'memo', 'status'];
            if (adminAccountingColumnExists('token_withdraw_requests', 'updated_at')) $select[] = 'updated_at';
            if (adminAccountingColumnExists('token_withdraw_requests', 'fee_amount')) $select[] = 'fee_amount';
            if (adminAccountingColumnExists('token_withdraw_requests', 'fee_asset')) $select[] = 'fee_asset';
            if (adminAccountingColumnExists('token_withdraw_requests', 'fee_mode')) $select[] = 'fee_mode';
            $rows = [];
            try {
                $rows = DB::fetchAll(
                    "SELECT " . implode(', ', $select) . " FROM token_withdraw_requests WHERE LOWER(TRIM(status))='done'"
                );
            } catch (Throwable $e) {
                error_log('admin accounting token withdraw fee: ' . $e->getMessage());
                $rows = [];
            }
            foreach ($rows as $row) {
                $eventAt = $row['updated_at'] ?? $row['created_at'] ?? null;
                if (!adminAccountingMonthMatches($eventAt, $monthKey)) continue;
                $fee = isset($row['fee_amount']) ? (float)$row['fee_amount'] : 0.0;
                if (!($fee > 0)) $fee = adminAccountingMemoNum($row['memo'] ?? '', ['fee_amount', 'fee']);
                if (!($fee > 0)) continue;

                $feeAsset = strtoupper(trim((string)($row['fee_asset'] ?? '')));
                if ($feeAsset === '') {
                    $feeAsset = strtoupper(trim((string)adminAccountingMemoText($row['memo'] ?? '', 'fee_asset')));
                }
                if ($feeAsset === '') {
                    $feeMode = strtolower(trim((string)($row['fee_mode'] ?? adminAccountingMemoText($row['memo'] ?? '', 'fee_mode'))));
                    $feeAsset = $feeMode === 'fixed_usdt' ? 'USDT' : strtoupper((string)($row['asset_id'] ?? ''));
                }

                if ($feeAsset === 'USDT') {
                    $sum += max(0.0, $fee);
                    continue;
                }

                $assetId = (string)($row['asset_id'] ?? '');
                $priceUsdt = adminAccountingEstimateAssetPriceUsdt($assetId);
                if ($priceUsdt > 0) $sum += max(0.0, $fee * $priceUsdt);
            }
        }

        return clamp6($sum);
    }
}

if (!function_exists('adminAccountingTradeFeeRevenue')) {
    function adminAccountingTradeFeeRevenue(?string $monthKey = null): float {
        if (!adminAccountingTableExists('trades')) return 0.0;

        $tradeAmountExpr = adminAccountingColumnExists('trades', 'amount')
            ? 't.amount'
            : (adminAccountingColumnExists('trades', 'qty') ? 't.qty' : '0');
        $tradeTotalExpr = adminAccountingColumnExists('trades', 'total_usdt')
            ? 't.total_usdt'
            : "ROUND(COALESCE(t.price,0) * COALESCE({$tradeAmountExpr},0), 6)";

        $select = [
            't.asset_id',
            't.created_at',
            "{$tradeAmountExpr} AS trade_amount",
            "{$tradeTotalExpr} AS trade_total_usdt",
        ];
        if (adminAccountingColumnExists('trades', 'price')) $select[] = 't.price';

        if (adminAccountingColumnExists('trades', 'order_id')) $select[] = 't.order_id';
        if (adminAccountingColumnExists('trades', 'buyer_address')) $select[] = 't.buyer_address';
        if (adminAccountingColumnExists('trades', 'seller_address')) $select[] = 't.seller_address';
        if (adminAccountingColumnExists('trades', 'maker_address')) $select[] = 't.maker_address';
        if (adminAccountingColumnExists('trades', 'taker_address')) $select[] = 't.taker_address';

        $join = '';
        if (adminAccountingTableExists('orders') && adminAccountingColumnExists('trades', 'order_id')) {
            $join .= ' LEFT JOIN orders o ON o.id = t.order_id ';
            if (adminAccountingColumnExists('orders', 'side')) $select[] = 'o.side AS order_side';
            if (adminAccountingColumnExists('orders', 'fee_rate')) $select[] = 'o.fee_rate AS order_fee_rate';
        }
        if (adminAccountingTableExists('assets')) {
            $join .= ' LEFT JOIN assets a ON a.id = t.asset_id ';
            if (adminAccountingColumnExists('assets', 'fee_buyer')) $select[] = 'a.fee_buyer';
            if (adminAccountingColumnExists('assets', 'fee_seller')) $select[] = 'a.fee_seller';
        }

        $rows = [];
        try {
            $rows = DB::fetchAll(
                "SELECT " . implode(', ', $select) . " FROM trades t {$join} ORDER BY t.id DESC"
            );
        } catch (Throwable $e) {
            error_log('admin accounting trade fee: ' . $e->getMessage());
            return 0.0;
        }

        $sum = 0.0;
        $platformAmmAddress = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';
        foreach ($rows as $row) {
            if (!adminAccountingMonthMatches($row['created_at'] ?? null, $monthKey)) continue;

            $tradeUsdt = (float)($row['trade_total_usdt'] ?? 0);
            if (!($tradeUsdt > 0)) {
                $tradeAmount = (float)($row['trade_amount'] ?? 0);
                $price = (float)($row['price'] ?? 0);
                $tradeUsdt = clamp6($tradeAmount * $price);
            }
            if (!($tradeUsdt > 0)) continue;

            $orderSide = strtolower(trim((string)($row['order_side'] ?? '')));
            $orderFeeRate = isset($row['order_fee_rate']) ? (float)$row['order_fee_rate'] : null;
            $assetBuyerFee = isset($row['fee_buyer']) ? (float)$row['fee_buyer'] : 0.0;
            $assetSellerFee = isset($row['fee_seller']) ? (float)$row['fee_seller'] : 0.0;

            $buyerFeeRate = ($orderSide === 'buy' && $orderFeeRate !== null && $orderFeeRate >= 0) ? $orderFeeRate : $assetBuyerFee;
            $sellerFeeRate = ($orderSide === 'sell' && $orderFeeRate !== null && $orderFeeRate >= 0) ? $orderFeeRate : $assetSellerFee;

            $isAmmTrade = false;
            if ($platformAmmAddress !== '') {
                foreach (['buyer_address', 'seller_address', 'maker_address', 'taker_address'] as $key) {
                    if (isset($row[$key]) && trim((string)$row[$key]) === $platformAmmAddress) {
                        $isAmmTrade = true;
                        break;
                    }
                }
            }

            // (2026-05-11 v264) Mirror the collection-time math —
            //   markets.php uses applyMinTradeFee(floor3(raw)) so the
            //   accounting recomputation must use floor3 + min-fee
            //   too, otherwise it'd over-report by up to ~0.0005 per
            //   trade (clamp6 used to round half-up, floor3 truncates).
            //   Operator: '소수점 4번째 부터는 절삭으로 가자.'
            $applyFee = static function (float $raw, float $rate): float {
                if ($rate <= 0) return 0.0;
                $fee = floor3($raw);
                $min = defined('MIN_TRADE_FEE_USDT') ? (float)MIN_TRADE_FEE_USDT : 0.001;
                return $fee >= $min ? $fee : $min;
            };

            if ($isAmmTrade) {
                $sum += $applyFee($tradeUsdt * $sellerFeeRate / 100, $sellerFeeRate);
                continue;
            }

            $sum += $applyFee($tradeUsdt * $buyerFeeRate / 100, $buyerFeeRate);
            $sum += $applyFee($tradeUsdt * $sellerFeeRate / 100, $sellerFeeRate);
        }

        return floor3($sum);
    }
}

if (!function_exists('adminAccountingInterestSum')) {
    function adminAccountingInterestSum(?string $monthKey = null, ?string $assetId = null): float {
        if (!adminAccountingTableExists('interest_claims')) return 0.0;
        $where = [];
        $params = [];
        if ($monthKey !== null && $monthKey !== '' && adminAccountingColumnExists('interest_claims', 'month_key')) {
            $where[] = 'month_key=?';
            $params[] = $monthKey;
        }
        if ($assetId !== null && $assetId !== '') {
            $where[] = 'asset_id=?';
            $params[] = $assetId;
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
        return (float)adminAccountingFetchValue(
            "SELECT COALESCE(SUM(amount_usdt),0) FROM interest_claims {$whereSql}",
            $params,
            0.0
        );
    }
}

if (!function_exists('adminAccountingPendingDepositTotal')) {
    function adminAccountingPendingDepositTotal(): float {
        if (!adminAccountingTableExists('wallet_transactions')) return 0.0;
        return (float)adminAccountingFetchValue(
            "SELECT COALESCE(SUM(amount),0) FROM wallet_transactions WHERE kind='deposit' AND status='대기'",
            [],
            0.0
        );
    }
}

if (!function_exists('adminAccountingPendingWithdrawTotal')) {
    function adminAccountingPendingWithdrawTotal(): float {
        if (!adminAccountingTableExists('withdraw_requests')) return 0.0;
        $select = ['amount', 'memo'];
        if (adminAccountingColumnExists('withdraw_requests', 'net_amount')) $select[] = 'net_amount';
        $rows = [];
        try {
            $rows = DB::fetchAll(
                "SELECT " . implode(', ', $select) . " FROM withdraw_requests WHERE LOWER(TRIM(status)) IN ('pending','processing')"
            );
        } catch (Throwable $e) {
            error_log('admin accounting pending withdraw total: ' . $e->getMessage());
            return 0.0;
        }
        $sum = 0.0;
        foreach ($rows as $row) {
            $net = isset($row['net_amount']) ? (float)$row['net_amount'] : NAN;
            if (!is_finite($net) || $net <= 0) {
                $memo = (string)($row['memo'] ?? '');
                if (preg_match('/(?:^|\|)(?:net_amount|net_amt|net):([0-9.]+)/', $memo, $m)) {
                    $net = (float)($m[1] ?? 0);
                } elseif (preg_match('/(?:^|\|)(?:fee_amount|fee):([0-9.]+)/', $memo, $m)) {
                    $net = max(0.0, (float)($row['amount'] ?? 0) - (float)($m[1] ?? 0));
                } else {
                    $net = (float)($row['amount'] ?? 0);
                }
            }
            $sum += max(0.0, $net);
        }
        return clamp6($sum);
    }
}

// (2026-05-20 v680) 토큰 출금 대기 합계 — asset_id 별 분리.
//   운영자 요청: '출금 대기 USDT 카드 아래 행에 출금 대기 토큰 카드 추가
//   (Silica / SilicaSTO 각각).'
//   token_withdraw_requests.asset_id 컬럼이 'SilicaSTO' / 'Silica' /
//   'SILICA-79907' 등으로 다양하게 저장될 수 있어 정규화하여 두 buckets
//   ('silica_sto', 'silica') 로 합산.
if (!function_exists('adminAccountingPendingTokenWithdrawTotals')) {
    function adminAccountingPendingTokenWithdrawTotals(): array {
        $result = ['silica_sto' => 0.0, 'silica' => 0.0];
        if (!adminAccountingTableExists('token_withdraw_requests')) return $result;
        try {
            $rows = DB::fetchAll(
                "SELECT asset_id, COALESCE(SUM(amount_token),0) AS total
                   FROM token_withdraw_requests
                  WHERE LOWER(TRIM(status)) IN ('pending','processing')
               GROUP BY asset_id"
            );
        } catch (Throwable $e) {
            error_log('admin accounting pending token withdraw totals: ' . $e->getMessage());
            return $result;
        }
        foreach ($rows as $row) {
            $aid = strtolower((string)($row['asset_id'] ?? ''));
            $tot = (float)($row['total'] ?? 0);
            // 'silica' (Silica 보상 토큰) 만 'silica' bucket. 그 외 ('silicasto',
            //   'silica-79907', 빈값 등) 는 모두 silica_sto bucket — 현재 단일
            //   자산 모델이라 SilicaSTO 가 사실상 유일한 RWA 토큰.
            if ($aid === 'silica') {
                $result['silica'] = clamp6($result['silica'] + $tot);
            } else {
                $result['silica_sto'] = clamp6($result['silica_sto'] + $tot);
            }
        }
        return $result;
    }
}

if (!function_exists('adminAccountingFundingUsedTotal')) {
    function adminAccountingFundingUsedTotal(): float {
        $confirmed = 0.0;
        if (adminAccountingTableExists('funding_records')) {
            $confirmed = (float)adminAccountingFetchValue(
                "SELECT COALESCE(SUM(amount_usdt),0) FROM funding_records",
                [],
                0.0
            );
        }

        $pending = 0.0;
        if (adminAccountingTableExists('investment_contracts')) {
            $where = ["status='awaiting_admin'"];
            if (adminAccountingColumnExists('investment_contracts', 'funding_record_id')) {
                $where[] = '(funding_record_id IS NULL OR funding_record_id=0)';
            }
            $pending = (float)adminAccountingFetchValue(
                "SELECT COALESCE(SUM(amount_usdt),0) FROM investment_contracts WHERE " . implode(' AND ', $where),
                [],
                0.0
            );
        }

        return clamp6($confirmed + $pending);
    }
}

get('/api/admin/accounting/summary', function () {
    adminOnly();

    $now = nowKST();
    $currentMonthKey = $now->format('Y-m');
    $previousMonthKey = $now->modify('first day of last month')->format('Y-m');
    $nextMonthRef = $now->modify('first day of next month');
    $nextMonthKey = $nextMonthRef->format('Y-m');

    $previousInterestRef = $now->modify('first day of last month');
    $currentInterestRef = $now;
    $nextInterestRef = $now->modify('first day of next month');

    $previousInterestDate = sprintf('%04d-%02d-%02d', (int)$previousInterestRef->format('Y'), (int)$previousInterestRef->format('m'), STAKING_PAYDAY);
    $currentInterestDate = sprintf('%04d-%02d-%02d', (int)$currentInterestRef->format('Y'), (int)$currentInterestRef->format('m'), STAKING_PAYDAY);
    $nextInterestDate = sprintf('%04d-%02d-%02d', (int)$nextInterestRef->format('Y'), (int)$nextInterestRef->format('m'), STAKING_PAYDAY);

    $summary = [
        'user_count' => (int)adminAccountingFetchValue("SELECT COUNT(*) FROM users", [], 0),
        'total_user_usdt' => (float)adminAccountingFetchValue("SELECT COALESCE(SUM(usdt),0) FROM balances", [], 0.0),
        'funding_used_usdt' => adminAccountingFundingUsedTotal(),
        'pending_deposits_usdt' => adminAccountingPendingDepositTotal(),
        'cumulative_interest_usdt' => adminAccountingInterestSum(),
        'previous_month_interest_usdt' => adminAccountingInterestSum($previousMonthKey),
        'current_month_interest_usdt' => adminAccountingInterestSum($currentMonthKey),
        'next_month_projected_interest_usdt' => 0.0,
        'pending_withdrawals_usdt' => adminAccountingPendingWithdrawTotal(),
        // (2026-05-20 v680) 토큰 출금 대기 — Silica / SilicaSTO 분리 표시.
        'pending_withdrawals_tokens' => adminAccountingPendingTokenWithdrawTotals(),
        'withdraw_fee_cumulative_usdt' => adminAccountingWithdrawFeeRevenue(),
        'withdraw_fee_previous_month_usdt' => adminAccountingWithdrawFeeRevenue($previousMonthKey),
        'withdraw_fee_current_month_usdt' => adminAccountingWithdrawFeeRevenue($currentMonthKey),
        'trade_fee_cumulative_usdt' => adminAccountingTradeFeeRevenue(),
        'trade_fee_previous_month_usdt' => adminAccountingTradeFeeRevenue($previousMonthKey),
        'trade_fee_current_month_usdt' => adminAccountingTradeFeeRevenue($currentMonthKey),
        'previous_month_key' => $previousMonthKey,
        'current_month_key' => $currentMonthKey,
        'next_month_key' => $nextMonthKey,
        'previous_interest_date' => $previousInterestDate,
        'current_interest_date' => $currentInterestDate,
        'next_interest_date' => $nextInterestDate,
        // (2026-05-11 v281) 운영자: '이해하기 어렵고 폰트가 너무 크다.'
        //   전월/당월/다음달 dump 는 이미 카드별 라벨에 표기되므로 제거.
        // (2026-05-11 v282) 운영자: '토큰 수수료 환산' 줄 제거.
        //   2026-05-05 부로 percent 모드가 admin UI 에서 제외되어 모든
        //   출금 수수료가 USDT 고정으로만 부과되므로 환산 케이스 자체가
        //   더 이상 발생하지 않음 — 잘못된 정보였다.
        'notes' => "· 유저 총 USDT: balances 테이블의 실시간 잔고만 집계 (모금 사용액 / 입금 승인 대기액은 별도 항목)
· 수수료 수익: 완료된 출금 · 거래만 합산 (모든 출금 수수료는 USDT 고정)",
    ];

    $assetStats = [];
    $assets = [];
    if (adminAccountingTableExists('assets')) {
        try {
            $assets = DB::fetchAll(
                "SELECT id, name, status, apr, settlement_basis, fx_at_funding FROM assets ORDER BY name, id"
            );
        } catch (Throwable $e) {
            error_log('admin accounting assets query failed: ' . $e->getMessage());
            $assets = [];
        }
    }

    foreach ($assets as $asset) {
        $stakedRows = [];
        if (adminAccountingTableExists('holdings')) {
            try {
                $stakedRows = DB::fetchAll(
                    "SELECT staked_token FROM holdings WHERE asset_id=? AND staked_token>0",
                    [$asset['id']]
                );
            } catch (Throwable $e) {
                error_log('admin accounting stakedRows query failed: ' . $e->getMessage());
                $stakedRows = [];
            }
        }

        $projected = 0.0;
        $stakedTotal = 0.0;
        $stakerCount = 0;

        // 다음 지급일(15일) 기준으로 유효 APR 계산 — 변경된 이자율은 다음월부터 적용
        $projAsset = $asset;
        if (function_exists('getEffectiveAprForMonth')) {
            try {
                $now = nowKST();
                $payday = (int)STAKING_PAYDAY;
                $nextPaydayDate = ((int)$now->format('j') >= $payday)
                    ? $now->modify('first day of next month')
                    : $now;
                $nextMonthKey = $nextPaydayDate->format('Y-m');
                $projAsset['apr'] = getEffectiveAprForMonth(
                    (string)($asset['id'] ?? ''),
                    $nextMonthKey,
                    (float)($asset['apr'] ?? 0)
                );
            } catch (Throwable $e) { /* fallback to current apr */ }
        }

        foreach ($stakedRows as $staker) {
            $staked = (float)($staker['staked_token'] ?? 0);
            if ($staked <= 0) continue;
            $stakedTotal += $staked;
            $stakerCount++;
            try {
                $calc = calcStakingInterestBreakdown($projAsset, $staked);
                $projected += (float)($calc['amount_usdt'] ?? 0);
            } catch (Throwable $e) {
                // ignore per-holder calculation issue so dashboard still loads
            }
        }

        $row = [
            'asset_id' => (string)($asset['id'] ?? ''),
            'asset_name' => (string)($asset['name'] ?? ''),
            'status' => (string)($asset['status'] ?? ''),
            'apr' => (float)($asset['apr'] ?? 0),
            'staker_count' => $stakerCount,
            'staked_total' => clamp6($stakedTotal),
            'cumulative_interest_usdt' => adminAccountingInterestSum(null, (string)($asset['id'] ?? '')),
            'previous_month_interest_usdt' => adminAccountingInterestSum($previousMonthKey, (string)($asset['id'] ?? '')),
            'current_month_interest_usdt' => adminAccountingInterestSum($currentMonthKey, (string)($asset['id'] ?? '')),
            'next_month_projected_interest_usdt' => clamp6($projected),
        ];
        $summary['next_month_projected_interest_usdt'] += $row['next_month_projected_interest_usdt'];
        $assetStats[] = $row;
    }

    $summary['next_month_projected_interest_usdt'] = clamp6($summary['next_month_projected_interest_usdt']);

    jsonOk([
        'summary' => $summary,
        'assets' => $assetStats,
    ]);
});

// ------------------------------------------------------------------
// (v413) 출금수수료 세부 내역 — accounting 페이지의 카드 클릭 모달용.
//   ?period=cumulative|previous|current (기본 cumulative)
//   ?offset=N&limit=10
//
// withdraw_requests + token_withdraw_requests 두 테이블 union.
// 각 행: 시점 / 주소 / 출금 종류 / 출금 금액 / 수수료 (USDT 환산).
// ------------------------------------------------------------------
get('/api/admin/accounting/withdraw-fee/detail', function () {
    adminOnly();
    $period = trim((string)($_GET['period'] ?? 'cumulative'));
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 10)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $now = nowKST();
    $currentMonthKey  = $now->format('Y-m');
    $previousMonthKey = $now->modify('first day of last month')->format('Y-m');
    $monthFilter = null;
    if ($period === 'previous') $monthFilter = $previousMonthKey;
    elseif ($period === 'current') $monthFilter = $currentMonthKey;

    $rows = [];

    // USDT 출금
    if (adminAccountingTableExists('withdraw_requests')) {
        try {
            $select = ['id', 'address', 'created_at', 'memo', 'status'];
            if (adminAccountingColumnExists('withdraw_requests', 'updated_at')) $select[] = 'updated_at';
            if (adminAccountingColumnExists('withdraw_requests', 'amount')) $select[] = 'amount';
            if (adminAccountingColumnExists('withdraw_requests', 'fee_amount')) $select[] = 'fee_amount';
            $records = DB::fetchAll(
                "SELECT " . implode(', ', $select) . " FROM withdraw_requests
                  WHERE LOWER(TRIM(status)) IN ('done','sent')"
            );
            foreach ($records as $r) {
                $eventAt = $r['updated_at'] ?? $r['created_at'] ?? null;
                if (!adminAccountingMonthMatches($eventAt, $monthFilter)) continue;
                $fee = isset($r['fee_amount']) ? (float)$r['fee_amount'] : 0.0;
                if (!($fee > 0)) $fee = adminAccountingMemoNum($r['memo'] ?? '', ['fee_amount', 'fee']);
                if (!($fee > 0)) continue;
                $rows[] = [
                    'event_at'   => $eventAt,
                    'address'    => $r['address'] ?? '',
                    'kind'       => 'USDT',
                    'amount'     => isset($r['amount']) ? (float)$r['amount'] : 0.0,
                    'fee_usdt'   => $fee,
                ];
            }
        } catch (Throwable $e) {
            error_log('[accounting withdraw-fee/detail USDT] ' . $e->getMessage());
        }
    }

    // 토큰 출금
    if (adminAccountingTableExists('token_withdraw_requests')) {
        try {
            $select = ['id', 'address', 'asset_id', 'created_at', 'memo', 'status'];
            if (adminAccountingColumnExists('token_withdraw_requests', 'updated_at')) $select[] = 'updated_at';
            if (adminAccountingColumnExists('token_withdraw_requests', 'amount_token')) $select[] = 'amount_token';
            if (adminAccountingColumnExists('token_withdraw_requests', 'fee_amount')) $select[] = 'fee_amount';
            if (adminAccountingColumnExists('token_withdraw_requests', 'fee_asset')) $select[] = 'fee_asset';
            if (adminAccountingColumnExists('token_withdraw_requests', 'fee_mode')) $select[] = 'fee_mode';
            $records = DB::fetchAll(
                "SELECT " . implode(', ', $select) . " FROM token_withdraw_requests
                  WHERE LOWER(TRIM(status))='done'"
            );
            foreach ($records as $r) {
                $eventAt = $r['updated_at'] ?? $r['created_at'] ?? null;
                if (!adminAccountingMonthMatches($eventAt, $monthFilter)) continue;
                $fee = isset($r['fee_amount']) ? (float)$r['fee_amount'] : 0.0;
                if (!($fee > 0)) $fee = adminAccountingMemoNum($r['memo'] ?? '', ['fee_amount', 'fee']);
                if (!($fee > 0)) continue;

                $feeAsset = strtoupper(trim((string)($r['fee_asset'] ?? '')));
                if ($feeAsset === '') {
                    $feeAsset = strtoupper(trim((string)adminAccountingMemoText($r['memo'] ?? '', 'fee_asset')));
                }
                if ($feeAsset === '') {
                    $feeMode = strtolower(trim((string)($r['fee_mode'] ?? adminAccountingMemoText($r['memo'] ?? '', 'fee_mode'))));
                    $feeAsset = $feeMode === 'fixed_usdt' ? 'USDT' : strtoupper((string)($r['asset_id'] ?? ''));
                }

                $feeUsdt = 0.0;
                if ($feeAsset === 'USDT') {
                    $feeUsdt = $fee;
                } else {
                    $priceUsdt = adminAccountingEstimateAssetPriceUsdt((string)($r['asset_id'] ?? ''));
                    $feeUsdt = $priceUsdt > 0 ? $fee * $priceUsdt : 0.0;
                }
                if (!($feeUsdt > 0)) continue;
                $rows[] = [
                    'event_at'   => $eventAt,
                    'address'    => $r['address'] ?? '',
                    'kind'       => 'TOKEN (' . ($r['asset_id'] ?? '?') . ')',
                    'amount'     => isset($r['amount_token']) ? (float)$r['amount_token'] : 0.0,
                    'fee_usdt'   => $feeUsdt,
                ];
            }
        } catch (Throwable $e) {
            error_log('[accounting withdraw-fee/detail TOKEN] ' . $e->getMessage());
        }
    }

    // 시간 역순 정렬 (최신 우선)
    usort($rows, fn($a, $b) => strcmp((string)($b['event_at'] ?? ''), (string)($a['event_at'] ?? '')));

    $total = count($rows);
    $paged = array_slice($rows, $offset, $limit);
    $totalFee = 0.0;
    foreach ($rows as $r) $totalFee += (float)$r['fee_usdt'];

    jsonOk([
        'rows'       => $paged,
        'total_fee'  => round($totalFee, 6),
        'period'     => $period,
        'pagination' => [
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset,
            'has_more' => ($offset + $limit) < $total,
        ],
    ]);
});

// ------------------------------------------------------------------
// (v413) 거래수수료 세부 내역.
// (v416) 운영자: '거래수수료 세부내역이 나오지 않는다.' 진단 결과 trades
//   테이블에 fee_* 컬럼이 없는 환경 — summary 는 fee_rate × trade_total
//   계산 (adminAccountingTradeFeeRevenue 와 동일 로직). detail 도 같은
//   로직으로 변경해 row 별 fee_usdt 계산. trades + orders + assets join.
// ------------------------------------------------------------------
get('/api/admin/accounting/trade-fee/detail', function () {
    adminOnly();
    $period = trim((string)($_GET['period'] ?? 'cumulative'));
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 10)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $now = nowKST();
    $currentMonthKey  = $now->format('Y-m');
    $previousMonthKey = $now->modify('first day of last month')->format('Y-m');
    $monthFilter = null;
    if ($period === 'previous') $monthFilter = $previousMonthKey;
    elseif ($period === 'current') $monthFilter = $currentMonthKey;

    if (!adminAccountingTableExists('trades')) {
        jsonOk(['rows' => [], 'total_fee' => 0, 'period' => $period,
                'pagination' => ['total' => 0, 'limit' => $limit, 'offset' => $offset, 'has_more' => false]]);
        return;
    }

    // (v416) summary 와 동일 select + join — fee_rate 계산용.
    $tradeAmountExpr = adminAccountingColumnExists('trades', 'amount')
        ? 't.amount'
        : (adminAccountingColumnExists('trades', 'qty') ? 't.qty' : '0');
    $tradeTotalExpr = adminAccountingColumnExists('trades', 'total_usdt')
        ? 't.total_usdt'
        : "ROUND(COALESCE(t.price,0) * COALESCE({$tradeAmountExpr},0), 6)";

    $select = [
        't.id',
        't.asset_id',
        't.created_at',
        "{$tradeAmountExpr} AS trade_amount",
        "{$tradeTotalExpr} AS trade_total_usdt",
    ];
    if (adminAccountingColumnExists('trades', 'price'))          $select[] = 't.price';
    if (adminAccountingColumnExists('trades', 'order_id'))       $select[] = 't.order_id';
    if (adminAccountingColumnExists('trades', 'buyer_address'))  $select[] = 't.buyer_address';
    if (adminAccountingColumnExists('trades', 'seller_address')) $select[] = 't.seller_address';
    if (adminAccountingColumnExists('trades', 'maker_address'))  $select[] = 't.maker_address';
    if (adminAccountingColumnExists('trades', 'taker_address'))  $select[] = 't.taker_address';

    $join = '';
    if (adminAccountingTableExists('orders') && adminAccountingColumnExists('trades', 'order_id')) {
        $join .= ' LEFT JOIN orders o ON o.id = t.order_id ';
        if (adminAccountingColumnExists('orders', 'side'))     $select[] = 'o.side AS order_side';
        if (adminAccountingColumnExists('orders', 'fee_rate')) $select[] = 'o.fee_rate AS order_fee_rate';
    }
    if (adminAccountingTableExists('assets')) {
        $join .= ' LEFT JOIN assets a ON a.id = t.asset_id ';
        if (adminAccountingColumnExists('assets', 'fee_buyer'))  $select[] = 'a.fee_buyer';
        if (adminAccountingColumnExists('assets', 'fee_seller')) $select[] = 'a.fee_seller';
    }

    $allRows = [];
    try {
        $allRows = DB::fetchAll(
            "SELECT " . implode(', ', $select) . " FROM trades t {$join} ORDER BY t.id DESC"
        );
    } catch (Throwable $e) {
        error_log('[accounting trade-fee/detail] ' . $e->getMessage());
        jsonOk(['rows' => [], 'total_fee' => 0, 'period' => $period,
                'pagination' => ['total' => 0, 'limit' => $limit, 'offset' => $offset, 'has_more' => false]]);
        return;
    }

    $platformAmmAddress = defined('PLATFORM_AMM_ADDRESS') ? trim((string)PLATFORM_AMM_ADDRESS) : '';
    $applyFee = static function (float $raw, float $rate): float {
        if ($rate <= 0) return 0.0;
        $fee = floor3($raw);
        $min = defined('MIN_TRADE_FEE_USDT') ? (float)MIN_TRADE_FEE_USDT : 0.001;
        return $fee >= $min ? $fee : $min;
    };

    $processed = [];
    $totalFeeAll = 0.0;
    foreach ($allRows as $row) {
        $matches = adminAccountingMonthMatches($row['created_at'] ?? null, $monthFilter);
        $tradeUsdt = (float)($row['trade_total_usdt'] ?? 0);
        if (!($tradeUsdt > 0)) {
            $tradeAmount = (float)($row['trade_amount'] ?? 0);
            $price = (float)($row['price'] ?? 0);
            $tradeUsdt = $price > 0 ? round($tradeAmount * $price, 6) : 0;
        }
        if (!($tradeUsdt > 0)) continue;

        $orderSide      = strtolower(trim((string)($row['order_side'] ?? '')));
        $orderFeeRate   = isset($row['order_fee_rate']) ? (float)$row['order_fee_rate'] : null;
        $assetBuyerFee  = isset($row['fee_buyer'])  ? (float)$row['fee_buyer']  : 0.0;
        $assetSellerFee = isset($row['fee_seller']) ? (float)$row['fee_seller'] : 0.0;
        $buyerFeeRate  = ($orderSide === 'buy'  && $orderFeeRate !== null && $orderFeeRate >= 0) ? $orderFeeRate : $assetBuyerFee;
        $sellerFeeRate = ($orderSide === 'sell' && $orderFeeRate !== null && $orderFeeRate >= 0) ? $orderFeeRate : $assetSellerFee;

        $isAmmTrade = false;
        if ($platformAmmAddress !== '') {
            foreach (['buyer_address', 'seller_address', 'maker_address', 'taker_address'] as $key) {
                if (isset($row[$key]) && trim((string)$row[$key]) === $platformAmmAddress) {
                    $isAmmTrade = true;
                    break;
                }
            }
        }

        $feeUsdt = $isAmmTrade
            ? $applyFee($tradeUsdt * $sellerFeeRate / 100, $sellerFeeRate)
            : ($applyFee($tradeUsdt * $buyerFeeRate / 100, $buyerFeeRate)
              + $applyFee($tradeUsdt * $sellerFeeRate / 100, $sellerFeeRate));

        if (!($feeUsdt > 0)) continue;

        if ($matches) {
            $processed[] = [
                'id'         => $row['id'] ?? null,
                'created_at' => $row['created_at'] ?? null,
                'asset_id'   => $row['asset_id'] ?? null,
                'side'       => $orderSide ?: '-',
                'qty'        => (float)($row['trade_amount'] ?? 0),
                'price'      => (float)($row['price'] ?? 0),
                'fee_usdt'   => round($feeUsdt, 6),
            ];
            $totalFeeAll += $feeUsdt;
        }
    }

    $total = count($processed);
    $paged = array_slice($processed, $offset, $limit);

    jsonOk([
        'rows'       => $paged,
        'total_fee'  => round($totalFeeAll, 6),
        'period'     => $period,
        'pagination' => [
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset,
            'has_more' => ($offset + $limit) < $total,
        ],
    ]);
});
