<?php
/**
 * Admin Dashboard routes
 */

if (!function_exists('adminDashFetchValue')) {
    function adminDashFetchValue(string $sql, array $params = [], $fallback = 0) {
        try {
            $value = DB::fetchValue($sql, $params);
            return $value !== null ? $value : $fallback;
        } catch (Throwable $e) {
            error_log('admin dashboard fetchValue fallback: ' . $e->getMessage());
            return $fallback;
        }
    }
}

if (!function_exists('adminDashFetchOne')) {
    function adminDashFetchOne(string $sql, array $params = [], array $fallback = []): array {
        try {
            $row = DB::fetchOne($sql, $params);
            return is_array($row) ? $row : $fallback;
        } catch (Throwable $e) {
            error_log('admin dashboard fetchOne fallback: ' . $e->getMessage());
            return $fallback;
        }
    }
}

if (!function_exists('adminDashFetchAll')) {
    function adminDashFetchAll(string $sql, array $params = [], array $fallback = []): array {
        try {
            $rows = DB::fetchAll($sql, $params);
            return is_array($rows) ? $rows : $fallback;
        } catch (Throwable $e) {
            error_log('admin dashboard fetchAll fallback: ' . $e->getMessage());
            return $fallback;
        }
    }
}

if (!function_exists('adminDashTryExecute')) {
    function adminDashTryExecute(string $sql, array $params = []): void {
        try {
            DB::execute($sql, $params);
        } catch (Throwable $e) {
            error_log('admin dashboard execute fallback: ' . $e->getMessage());
        }
    }
}

if (!function_exists('adminDashTableExists')) {
    function adminDashTableExists(string $table): bool {
        try {
            return (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                [$table]
            ) > 0;
        } catch (Throwable $e) {
            error_log('admin dashboard tableExists fallback: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('adminDashColumnExists')) {
    function adminDashColumnExists(string $table, string $column): bool {
        try {
            return (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                [$table, $column]
            ) > 0;
        } catch (Throwable $e) {
            error_log('admin dashboard columnExists fallback: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('adminAlertCountTable')) {
    function adminAlertCountTable(string $table, string $where = '1=1', array $params = []): int {
        if (!adminDashTableExists($table)) return 0;
        try {
            return (int)DB::fetchValue("SELECT COUNT(*) FROM `{$table}` WHERE {$where}", $params);
        } catch (Throwable $e) {
            error_log('admin dashboard alert count fallback: ' . $e->getMessage());
            return 0;
        }
    }
}

get('/api/admin/alerts/summary', function () {
    adminAuth();

    try {
        // (2026-05-07) Split deposit pending count by asset class so the admin
        //   header can render separate badges for "USDT 입금" and "토큰 입금".
        //   Both rows share kind='deposit'; the asset column distinguishes them
        //   (asset='USDT' → USDT deposit, anything else → SilicaSTO / Silica /
        //   legacy RWA token deposit). COALESCE handles legacy rows where the
        //   asset column was left empty (treated as USDT for backward compat).
        $depositPending = 0;
        $tokenDepositPending = 0;
        if (adminDashTableExists('wallet_transactions') && adminDashColumnExists('wallet_transactions', 'kind') && adminDashColumnExists('wallet_transactions', 'status')) {
            $depositPending = (int)adminDashFetchValue(
                "SELECT COUNT(*) FROM wallet_transactions
                  WHERE kind='deposit' AND status='대기'
                    AND UPPER(COALESCE(asset, 'USDT')) = 'USDT'",
                [], 0
            );
            $tokenDepositPending = (int)adminDashFetchValue(
                "SELECT COUNT(*) FROM wallet_transactions
                  WHERE kind='deposit' AND status='대기'
                    AND UPPER(COALESCE(asset, 'USDT')) <> 'USDT'",
                [], 0
            );
        }

        $contractPending = 0;
        if (adminDashTableExists('investment_contracts') && adminDashColumnExists('investment_contracts', 'status')) {
            $contractPending = (int)adminDashFetchValue("SELECT COUNT(*) FROM investment_contracts WHERE status='awaiting_admin'", [], 0);
        }

        $withdrawPending = adminAlertCountTable('withdraw_requests', "status='pending'");
        $tokenWithdrawPending = adminAlertCountTable('token_withdraw_requests', "status='pending'");

        jsonOk([
            'counts' => [
                'deposits' => $depositPending,
                'token_deposits' => $tokenDepositPending,
                'contracts' => $contractPending,
                'withdrawals' => $withdrawPending,
                'token_withdrawals' => $tokenWithdrawPending,
            ],
            'total_pending' => $depositPending + $tokenDepositPending + $contractPending + $withdrawPending + $tokenWithdrawPending,
        ]);
    } catch (Throwable $e) {
        error_log('admin alerts summary error: ' . $e->getMessage());
        jsonOk([
            'counts' => [
                'deposits' => 0,
                'token_deposits' => 0,
                'contracts' => 0,
                'withdrawals' => 0,
                'token_withdrawals' => 0,
            ],
            'total_pending' => 0,
        ]);
    }
});

get('/api/admin/dashboard/summary', function () {
    adminOnly();

    try {
        try {
            syncAllAssetStatusesIfNeeded();
        } catch (Throwable $e) {
            error_log('admin dashboard sync status fallback: ' . $e->getMessage());
        }

        $fx = 0.0;
        $fxDiag = null;
        try {
            $fx = (float)getFxKrwPerUsdt();
            // (2026-05-18 v518/v521) FX = 0 시 lazy provider chain 실행.
            //   v521: 결과 진단 정보를 응답에 포함 — 운영자가 원인 파악 가능.
            if ($fx <= 0) {
                if (function_exists('fxwRunProviderChain')) {
                    try {
                        $fxDiag = fxwRunProviderChain(['KRW']);
                    } catch (Throwable $diagE) {
                        $fxDiag = ['error' => $diagE->getMessage()];
                    }
                    $fx = (float)getFxKrwPerUsdt();
                }
            }
        } catch (Throwable $e) {
            error_log('admin dashboard fx fallback: ' . $e->getMessage());
        }
        $kst = todayKST();

        adminDashTryExecute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");

        // STO 분배 모델 v1: distributed_token = SUM(holdings.claimed_token) per asset
        // 단일 자산이라도 LEFT JOIN 으로 0 처리되므로 안전.
        $assets = adminDashFetchAll(
            "SELECT a.id, a.market, a.name, a.status, a.is_public,
                    a.target_usdt, a.raised_usdt, a.supply_token,
                    a.funded_snapshot_usdt, a.min_usdt,
                    a.apr, a.official_price_krw, a.fund_end_date,
                    COALESCE((SELECT SUM(h.claimed_token) FROM holdings h
                              WHERE h.asset_id = a.id AND h.claimed_token > 0), 0) AS distributed_token
             FROM assets a
             ORDER BY FIELD(a.status,'모집중','구매진행','분배중','운영중','매각','매각(완료)','모집실패','취소됨'), a.id",
            [],
            []
        );

        // (2026-05-16 v410) 운영자: '최대 발행량은 총수량으로 표기하고
        //   STO 사전 발행수량과 동일해야한다. 목표는 관리자가 설정한 판매
        //   가능 수량.' 의미 명확화:
        //     총수량   = app_settings.silica_sto_total_minted (1B 사전 발행)
        //     판매목표 = app_settings.silica_max_sto_supply  (운영자 설정)
        //     판매됨   = assets.raised_usdt                  (1 STO=1 USDT peg)
        $silicaMaxSto = null;
        if (function_exists('silicaGetMaxStoSupply')) {
            try { $silicaMaxSto = (int)silicaGetMaxStoSupply(); } catch (Throwable $_) {}
        }
        $silicaTotalMinted = null;
        try {
            $rawTotal = (string)(getSetting('silica_sto_total_minted', '1000000000') ?? '1000000000');
            $silicaTotalMinted = is_numeric($rawTotal) ? (int)$rawTotal : null;
        } catch (Throwable $_) {}
        foreach ($assets as &$_a) {
            $aid = (string)($_a['id'] ?? '');
            $isSilica = str_starts_with($aid, 'SILICA-');
            // SILICA-* 자산만 의미. 그 외는 null 로 두어 frontend 가 안 표시.
            $_a['max_sto_supply']    = ($silicaMaxSto      !== null && $isSilica) ? $silicaMaxSto      : null;
            $_a['pre_minted_supply'] = ($silicaTotalMinted !== null && $isSilica) ? $silicaTotalMinted : null;
        }
        unset($_a);

        $statusRows = adminDashFetchAll(
            "SELECT status,
                    COUNT(*) AS cnt,
                    COALESCE(SUM(target_usdt),0) AS target_sum,
                    COALESCE(SUM(raised_usdt),0) AS raised_sum,
                    COALESCE(SUM(supply_token),0) AS supply_sum
             FROM assets
             GROUP BY status",
            [],
            []
        );

        $counts = [];
        $totalTarget = 0.0;
        $totalRaised = 0.0;
        $totalSupply = 0.0;
        foreach ($statusRows as $row) {
            $status = (string)($row['status'] ?? '');
            if ($status !== '') {
                $counts[$status] = (int)($row['cnt'] ?? 0);
            }
            $totalTarget += (float)($row['target_sum'] ?? 0);
            $totalRaised += (float)($row['raised_sum'] ?? 0);
            $totalSupply += (float)($row['supply_sum'] ?? 0);
        }

        $userCount = (int)adminDashFetchValue("SELECT COUNT(*) FROM users", [], 0);
        $balanceSum = (float)adminDashFetchValue("SELECT COALESCE(SUM(usdt),0) FROM balances", [], 0);
        $platformBalance = (float)adminDashFetchValue("SELECT COALESCE(usdt_balance,0) FROM platform_balance WHERE id=1 LIMIT 1", [], 0);

        $openAgg = adminDashFetchOne(
            "SELECT COUNT(*) AS open_count,
                    COALESCE(SUM(remaining * price),0) AS open_notional
             FROM orders
             WHERE status='open'
               AND remaining > 0
               AND (expiry_date IS NULL OR expiry_date >= ?)",
            [$kst],
            []
        );

        $book = adminDashFetchAll(
            "SELECT asset_id,
                    MAX(CASE WHEN side='buy'  THEN price END) AS best_bid,
                    MIN(CASE WHEN side='sell' THEN price END) AS best_ask,
                    SUM(CASE WHEN side='buy'  THEN 1 ELSE 0 END) AS bid_cnt,
                    SUM(CASE WHEN side='sell' THEN 1 ELSE 0 END) AS ask_cnt,
                    COALESCE(SUM(CASE WHEN side='buy'  THEN remaining ELSE 0 END),0) AS bid_qty,
                    COALESCE(SUM(CASE WHEN side='sell' THEN remaining ELSE 0 END),0) AS ask_qty
             FROM orders
             WHERE status='open'
               AND remaining > 0
               AND (expiry_date IS NULL OR expiry_date >= ?)
             GROUP BY asset_id",
            [$kst],
            []
        );

        $trades24ByAsset = adminDashFetchAll(
            "SELECT asset_id,
                    COUNT(*) AS cnt,
                    COALESCE(SUM(qty * price),0) AS volume,
                    COALESCE(SUM(qty),0) AS qty
             FROM trades
             WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
             GROUP BY asset_id",
            [],
            []
        );

        $trades24All = adminDashFetchOne(
            "SELECT COUNT(*) AS cnt,
                    COALESCE(SUM(qty * price),0) AS volume,
                    COALESCE(SUM(qty),0) AS qty
             FROM trades
             WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)",
            [],
            []
        );

        $recentTrades = adminDashFetchAll(
            "SELECT asset_id, price, qty, maker_address, taker_address, created_at
             FROM trades
             ORDER BY created_at DESC
             LIMIT 20",
            [],
            []
        );

        $soldRows = adminDashFetchAll(
            "SELECT a.id AS asset_id, a.name, a.market, a.supply_token,
                    s.buy_price_krw, s.sold_price_krw, s.expenses_krw, s.input_currency,
                    s.vault_balance_usdt, s.window_start, s.window_end, s.updated_at
             FROM assets a
             JOIN sales s ON s.asset_id = a.id
             WHERE a.status IN ('매각','매각(완료)')
             ORDER BY a.id ASC",
            [],
            []
        );

        $redeemAgg = adminDashFetchAll(
            "SELECT asset_id,
                    COUNT(*) AS cnt,
                    COALESCE(SUM(tokens),0) AS tokens_sum,
                    COALESCE(SUM(usdt),0) AS usdt_sum,
                    MAX(created_at) AS last_at
             FROM sale_redemptions
             GROUP BY asset_id",
            [],
            []
        );

        $recentRedemptions = adminDashFetchAll(
            "SELECT asset_id, address, tokens, usdt, fx_krw_per_usdt, created_at
             FROM sale_redemptions
             ORDER BY created_at DESC
             LIMIT 20",
            [],
            []
        );

        // (2026-05-18 v518) 운영자 보고: '총 스테이킹 0 표기'. 기존 WHERE 절이
        //   legacy 상태 ('분배중','운영중') 만 필터링 → Silica 단일자산 정책상
        //   status='활성' 인 자산이 매칭 안 됨. status 필터 완화: '매각'/'매각
        //   (완료)'/'취소됨'/'모집실패' 제외 (실제 stake 가능 상태 모두 포함).
        $stakingAll = adminDashFetchOne(
            "SELECT COALESCE(SUM(h.staked_token),0) AS staked_total,
                    COUNT(DISTINCT CASE WHEN h.staked_token > 0 THEN h.address END) AS stakers
             FROM holdings h
             JOIN assets a ON a.id = h.asset_id
             WHERE a.status NOT IN ('매각','매각(완료)','취소됨','모집실패')",
            [],
            []
        );

        $stakingByAsset = adminDashFetchAll(
            "SELECT h.asset_id,
                    COALESCE(SUM(h.staked_token),0) AS staked_sum,
                    COUNT(DISTINCT CASE WHEN h.staked_token > 0 THEN h.address END) AS stakers
             FROM holdings h
             JOIN assets a ON a.id = h.asset_id
             WHERE a.status NOT IN ('매각','매각(완료)','취소됨','모집실패')
             GROUP BY h.asset_id
             ORDER BY h.asset_id ASC",
            [],
            []
        );

        // (2026-05-18 v522) 누적 순 출금 (Net) — SilicaSTO / Silica 별로
        //   '완료된 출금 합 - 입금 합'. 출금 후 다시 입금된 만큼은 차감되어
        //   순수 외부 유출만 표기. wallet_transactions 가 단일 진실원본:
        //     - kind='withdraw_completed' (또는 'withdraw' done) → 출금
        //     - kind='deposit' → 입금
        $netWithdraw = ['sto' => 0.0, 'silica' => 0.0];
        try {
            $rows = DB::fetchAll(
                "SELECT asset,
                        SUM(CASE WHEN kind IN ('withdraw_completed','withdraw') AND status IN ('완료','done','completed') THEN amount ELSE 0 END) AS total_out,
                        SUM(CASE WHEN kind = 'deposit' AND status IN ('완료','done','completed','입금완료','deposited') THEN amount ELSE 0 END) AS total_in
                   FROM wallet_transactions
                  WHERE asset IN ('SilicaSTO', 'Silica')
                  GROUP BY asset"
            );
            foreach ($rows as $r) {
                $net = (float)($r['total_out'] ?? 0) - (float)($r['total_in'] ?? 0);
                if ($net < 0) $net = 0; // 음수 (입금이 더 많음) 는 0 으로 표시
                if ($r['asset'] === 'SilicaSTO') $netWithdraw['sto'] = $net;
                if ($r['asset'] === 'Silica')    $netWithdraw['silica'] = $net;
            }
        } catch (Throwable $e) {
            error_log('admin dashboard net_withdraw failed: ' . $e->getMessage());
        }

        jsonOk([
            'fx_krw_per_usdt' => (float)$fx,
            '_fx_diag' => $fxDiag, // (v521) 운영자 진단용 — provider 시도 결과
            'net_withdraw' => $netWithdraw, // (v522)
            'staking_cfg' => [
                'payday' => STAKING_PAYDAY,
                'lock_days' => STAKING_LOCK_DAYS,
            ],
            'counts' => $counts,
            'totals' => [
                'target_usdt' => $totalTarget,
                'raised_usdt' => $totalRaised,
                'supply_token' => $totalSupply,
            ],
            'users' => [
                'count' => $userCount,
                'usdt_total' => $balanceSum,
            ],
            'platform' => [
                'usdt_balance' => $platformBalance,
            ],
            'orders' => [
                'open_count' => (int)($openAgg['open_count'] ?? 0),
                'open_notional' => (float)($openAgg['open_notional'] ?? 0),
                'book' => $book,
            ],
            'trades' => [
                'last24h' => [
                    'cnt' => (int)($trades24All['cnt'] ?? 0),
                    'volume' => (float)($trades24All['volume'] ?? 0),
                    'qty' => (float)($trades24All['qty'] ?? 0),
                ],
                'by_asset' => $trades24ByAsset,
                'recent' => $recentTrades,
            ],
            'sales' => [
                'sold' => $soldRows,
                'redemptions_by_asset' => $redeemAgg,
                'recent_redemptions' => $recentRedemptions,
            ],
            'staking' => [
                'staked_total' => (float)($stakingAll['staked_total'] ?? 0),
                'stakers' => (int)($stakingAll['stakers'] ?? 0),
                'by_asset' => $stakingByAsset,
            ],
            'assets' => $assets,
        ]);
    } catch (Throwable $e) {
        error_log('admin dashboard summary error: ' . $e->getMessage());
        jsonError(500, '대시보드 요약 로드 실패', [
            'detail' => (string)$e->getMessage(),
        ]);
    }
});
