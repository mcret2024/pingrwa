<?php
/**
 * Admin Token Withdraw routes
 */

if (!function_exists('adminTokenWithdrawColumnExists')) {
    function adminTokenWithdrawColumnExists(string $table, string $column): bool {
        static $cache = [];
        $key = $table . '.' . $column;
        if (array_key_exists($key, $cache)) return $cache[$key];
        try {
            $cache[$key] = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                [$table, $column]
            ) > 0;
        } catch (Throwable $e) {
            $cache[$key] = false;
        }
        return $cache[$key];
    }
}

if (!function_exists('adminTokenWithdrawSelectExpr')) {
    function adminTokenWithdrawSelectExpr(string $table, string $column, string $fallbackSql = 'NULL', ?string $alias = null): string {
        $as = $alias ?: $column;
        if (adminTokenWithdrawColumnExists($table, $column)) {
            return "{$table}.{$column} AS {$as}";
        }
        return "{$fallbackSql} AS {$as}";
    }
}

if (!function_exists('adminTokenWithdrawSafeErrorText')) {
    function adminTokenWithdrawSafeErrorText(string $message, int $limit = 220): string {
        $text = trim(preg_replace('/\s+/u', ' ', (string)$message));
        if ($text === '') return '알 수 없는 오류';
        if (function_exists('mb_substr')) {
            return mb_substr($text, 0, $limit, 'UTF-8');
        }
        return substr($text, 0, $limit);
    }
}

if (!function_exists('adminTokenWithdrawSameAddress')) {
    function adminTokenWithdrawSameAddress(?string $a, ?string $b): bool {
        return trim((string)$a) !== '' && trim((string)$a) === trim((string)$b);
    }
}

if (!function_exists('adminTokenWithdrawMemoNum')) {
    function adminTokenWithdrawMemoNum(string $memo, array $keys): float {
        foreach ($keys as $key) {
            if (preg_match('/(?:^|\|)' . preg_quote((string)$key, '/') . ':([0-9.]+)/', $memo, $m)) {
                return (float)($m[1] ?? 0);
            }
        }
        return 0.0;
    }
}

if (!function_exists('adminTokenWithdrawMemoText')) {
    function adminTokenWithdrawMemoText(string $memo, array $keys): string {
        foreach ($keys as $key) {
            if (preg_match('/(?:^|\|)' . preg_quote((string)$key, '/') . ':([^|]+)/', $memo, $m)) {
                $raw = trim((string)($m[1] ?? ''));
                if ($raw !== '') {
                    $decoded = rawurldecode($raw);
                    return $decoded !== '' ? $decoded : $raw;
                }
            }
        }
        return '';
    }
}

if (!function_exists('adminTokenWithdrawFeeAmount')) {
    function adminTokenWithdrawFeeAmount(array $row): float {
        $direct = isset($row['fee_amount']) ? (float)$row['fee_amount'] : 0.0;
        if ($direct > 0) return $direct;
        return adminTokenWithdrawMemoNum((string)($row['memo'] ?? ''), ['fee_amount', 'fee']);
    }
}

if (!function_exists('adminTokenWithdrawFeeAsset')) {
    function adminTokenWithdrawFeeAsset(array $row): string {
        $direct = trim((string)($row['fee_asset'] ?? ''));
        if ($direct !== '') return strtoupper($direct);
        $memoAsset = trim(adminTokenWithdrawMemoText((string)($row['memo'] ?? ''), ['fee_asset']));
        if ($memoAsset !== '') return strtoupper($memoAsset);
        $mode = trim((string)($row['fee_mode'] ?? ''));
        if ($mode === '') $mode = adminTokenWithdrawMemoText((string)($row['memo'] ?? ''), ['fee_mode']);
        return strtolower($mode) === 'fixed_usdt' ? 'USDT' : strtoupper(trim((string)($row['asset_id'] ?? 'TOKEN')) ?: 'TOKEN');
    }
}

if (!function_exists('adminTokenWithdrawNetAmount')) {
    function adminTokenWithdrawNetAmount(array $row): float {
        $direct = isset($row['net_amount']) ? (float)$row['net_amount'] : 0.0;
        if ($direct > 0) return $direct;
        $memoNet = adminTokenWithdrawMemoNum((string)($row['memo'] ?? ''), ['net_amount', 'net_amt', 'net']);
        if ($memoNet > 0) return $memoNet;
        $amount = (float)($row['amount_token'] ?? 0);
        $fee = adminTokenWithdrawFeeAmount($row);
        return strtoupper(adminTokenWithdrawFeeAsset($row)) === 'USDT' ? $amount : max(0.0, $amount - $fee);
    }
}

if (!function_exists('adminTokenWithdrawAppendMemo')) {
    function adminTokenWithdrawAppendMemo(string $baseMemo, array $pairs): string {
        $memo = trim($baseMemo);
        foreach ($pairs as $key => $value) {
            if ($value === null || $value === '') continue;
            $encoded = rawurlencode((string)$value);
            $memo .= ($memo !== '' ? '|' : '') . $key . ':' . $encoded;
        }
        // token_withdraw_requests.memo 는 VARCHAR(255) 이므로 디버그 메모가 길어져도 저장 실패가 나지 않게 자른다.
        if (strlen($memo) > 240) {
            $memo = substr($memo, 0, 240);
        }
        return $memo;
    }
}

if (!function_exists('adminTokenWithdrawUpdateRequest')) {
    function adminTokenWithdrawUpdateRequest(int $requestId, array $fields): void {
        if ($requestId <= 0 || empty($fields)) return;
        $always = ['status', 'txid', 'memo', 'updated_at'];
        $sets = [];
        $params = [];
        foreach ($fields as $col => $value) {
            if (!preg_match('/^[a-zA-Z0-9_]+$/', (string)$col)) continue;
            if (!in_array($col, $always, true) && !adminTokenWithdrawColumnExists('token_withdraw_requests', $col)) continue;
            $sets[] = "`{$col}`=?";
            $params[] = $value;
        }
        if (!$sets) return;
        $params[] = $requestId;
        DB::execute("UPDATE token_withdraw_requests SET " . implode(', ', $sets) . " WHERE id=?", $params);
    }
}

if (!function_exists('adminTokenWithdrawFetchRow')) {
    function adminTokenWithdrawFetchRow(int $requestId, bool $forUpdate = false): ?array {
        $select = [
            'r.id',
            'r.address',
            'r.asset_id',
            'r.to_address',
            'r.amount_token',
            'r.status',
            'r.txid',
            'r.memo',
            'r.created_at',
            'r.updated_at',
            // (2026-05-20 v683) wallet_tx_id 누락 — 운영자 보고: '토큰 출금
            //   취소 시 원본 행이 Failed 로 안 바뀐다.' v679 의 UPDATE 가
            //   $r['wallet_tx_id'] 를 참조하지만 이 SELECT 에 빠져 있어 항상
            //   undefined → empty 체크 통과 → UPDATE skip 되던 버그.
            adminTokenWithdrawSelectExpr('r', 'wallet_tx_id', 'NULL'),
            adminTokenWithdrawSelectExpr('r', 'fee_mode', 'NULL'),
            adminTokenWithdrawSelectExpr('r', 'fee_value', '0'),
            adminTokenWithdrawSelectExpr('r', 'fee_amount', '0'),
            adminTokenWithdrawSelectExpr('r', 'fee_asset', "'USDT'"),
            adminTokenWithdrawSelectExpr('r', 'net_amount', '0'),
            adminTokenWithdrawSelectExpr('r', 'reject_reason', 'NULL'),
            adminTokenWithdrawSelectExpr('r', 'reviewed_by', 'NULL'),
            adminTokenWithdrawSelectExpr('r', 'reviewed_at', 'NULL'),
            'a.name AS asset_name',
            'a.token_mint_address',
        ];
        $sql = "SELECT " . implode(",\n                ", $select) . "\n"
            . "  FROM token_withdraw_requests r\n"
            . "  LEFT JOIN assets a ON a.id = r.asset_id\n"
            . " WHERE r.id=?";
        if ($forUpdate) $sql .= " FOR UPDATE";
        $row = DB::fetchOne($sql, [$requestId]) ?: null;
        if ($row) {
            // (v697) settings 에서 mint fallback
            $row['token_mint_address'] = adminTokenWithdrawResolveMintAddr($row);
        }
        return $row;
    }
}

// (2026-05-21 v697) 운영자 보고: '나는 처음부터 토큰 mint 주소를 입력했다.'
//   확인 결과 — settings 테이블의 silica_sto_mint / silica_token_mint 에는
//   등록되어 있으나 assets.token_mint_address 컬럼은 NULL. SELECT 가 assets
//   에서만 가져와 mint='' 으로 노출되던 버그. resolver 가 두 위치 모두 체크.
if (!function_exists('adminTokenWithdrawResolveMintAddr')) {
    function adminTokenWithdrawResolveMintAddr(array $row): string {
        // 1순위: assets.token_mint_address (이미 SELECT 됨)
        $mint = trim((string)($row['token_mint_address'] ?? ''));
        if ($mint !== '') return $mint;
        // 2순위: settings 별칭 매핑
        $assetId = (string)($row['asset_id'] ?? '');
        if ($assetId === 'Silica') {
            return trim((string)getSetting('silica_token_mint', ''));
        }
        // 'SilicaSTO', 'SILICA-79907', 빈값 등 → STO mint
        return trim((string)getSetting('silica_sto_mint', ''));
    }
}

if (!function_exists('adminTokenWithdrawResolveTokenDecimals')) {
    function adminTokenWithdrawResolveTokenDecimals(array $row): int {
        $fallback = 1;
        try { $fallback = (int)getAssetTokenDecimals($row); } catch (Throwable $e) {}
        $mint = trim((string)($row['token_mint_address'] ?? ''));
        if ($mint !== '' && isValidSolanaAddress($mint)) {
            try {
                $info = getSolanaMintRuntimeInfo($mint);
                if (isset($info['decimals']) && is_numeric($info['decimals'])) {
                    return max(0, min(255, (int)$info['decimals']));
                }
            } catch (Throwable $e) {
                error_log('admin token withdraw decimals fallback: ' . $e->getMessage());
            }
        }
        return max(0, min(255, (int)$fallback));
    }
}

if (!function_exists('adminTokenWithdrawConfiguredWallet')) {
    function adminTokenWithdrawConfiguredWallet(): array {
        try {
            return ['address' => getAdminWithdrawWalletAddress(), 'error' => ''];
        } catch (Throwable $e) {
            return ['address' => '', 'error' => $e->getMessage()];
        }
    }
}

if (!function_exists('adminTokenWithdrawCanSendStatus')) {
    // 전송(send) 가능 = 'pending' 전용
    // 'processing' 은 잠금 상태 → 절대 재전송 안 됨 (이중 출금 방지)
    function adminTokenWithdrawCanSendStatus(string $status): bool {
        return strtolower(trim($status)) === 'pending';
    }
}

if (!function_exists('adminTokenWithdrawCanCancelStatus')) {
    // 취소(cancel) 가능 = 'pending' 전용
    // 'processing' 은 체인 전송 가능성 있어 함부로 취소 못함 → manual-complete 로 검증 후 처리
    function adminTokenWithdrawCanCancelStatus(string $status): bool {
        return strtolower(trim($status)) === 'pending';
    }
}

// (2026-05-20 v684) Stale wallet_transactions 동기화 — 운영자 보고:
//   '취소된 항목이 유저의 출금 페이지에 그대로 Pending 으로 노출.'
//   v683 이전에 취소된 token_withdraw_requests 의 linked wallet_transactions
//   행이 '출금신청' 그대로 남아 frontend pending 목록에 표시되던 버그.
//   매 admin 페이지 진입 시 idempotent UPDATE 로 자동 정정.
//   매칭 전략:
//     1) wallet_tx_id 컬럼이 있고 NOT NULL 인 경우 → INNER JOIN 으로 정확 매칭
//     2) wallet_tx_id 가 NULL 인 경우 → address + asset_id + amount + status
//        조합으로 자연 매칭 (다중 매칭 시 가장 최근 1건만 — fallback 안전성 우선)
if (!function_exists('adminTokenWithdrawSyncStaleWalletTx')) {
    function adminTokenWithdrawSyncStaleWalletTx(bool $force = false): array {
        // (v685/v686) 진단 정보 반환. v686: wallet_tx_id 컬럼 존재 여부에 따라
        //   phase 분기 — 컬럼 없으면 phase 1 skip + phase 2 SQL 조건 수정.
        $diag = [
            'has_wallet_tx_id_col' => null,
            'phase1_linked_updated' => 0,
            'phase1_done_synced' => 0,
            'phase2_orphans_found' => 0,
            'phase2_matched_one' => 0,
            'phase2_matched_multi_skipped' => 0,
            'phase2_no_match' => 0,
            'phase2_updates' => [],
            'errors' => [],
        ];

        // v686: 컬럼 존재 여부 사전 체크
        $hasCol = false;
        try {
            $hasCol = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='token_withdraw_requests'
                    AND COLUMN_NAME='wallet_tx_id'",
                []
            ) > 0;
        } catch (Throwable $e) {
            $diag['errors'][] = 'col-check: ' . $e->getMessage();
        }
        $diag['has_wallet_tx_id_col'] = $hasCol;

        // v686: 컬럼 없으면 자동 ALTER 시도 (1회) — schema self-heal
        if (!$hasCol) {
            try {
                DB::execute(
                    "ALTER TABLE token_withdraw_requests
                       ADD COLUMN wallet_tx_id BIGINT NULL DEFAULT NULL AFTER id"
                );
                $hasCol = true;
                $diag['has_wallet_tx_id_col'] = true;
                $diag['errors'][] = 'INFO: wallet_tx_id 컬럼 신규 추가 완료 (ALTER 성공)';
            } catch (Throwable $e) {
                $diag['errors'][] = 'ALTER 실패: ' . $e->getMessage();
            }
        }

        // Phase 1 — 컬럼이 (이미 또는 이제) 있을 때만 실행
        if ($hasCol) {
            try {
                // 1a) canceled / cancelled / failed / rejected → '실패' 동기화
                $before = (int)DB::fetchValue(
                    "SELECT COUNT(*) FROM wallet_transactions wt
                       INNER JOIN token_withdraw_requests twr ON wt.id = twr.wallet_tx_id
                      WHERE LOWER(TRIM(twr.status)) IN ('canceled','cancelled','failed','rejected')
                        AND wt.kind = 'withdraw' AND wt.status = '출금신청'",
                    []
                );
                if ($before > 0) {
                    DB::execute(
                        "UPDATE wallet_transactions wt
                           INNER JOIN token_withdraw_requests twr ON wt.id = twr.wallet_tx_id
                              SET wt.status = '실패'
                            WHERE LOWER(TRIM(twr.status)) IN ('canceled','cancelled','failed','rejected')
                              AND wt.kind = 'withdraw'
                              AND wt.status = '출금신청'"
                    );
                }
                $diag['phase1_linked_updated'] = $before;

                // (2026-05-21 v735) 1b) 'done' → '출금완료' + txid 동기화.
                //   운영자 보고: 04:59 출금이 admin 에서 완료 (twr.status='done',
                //   txid 있음) 됐지만 user history 는 여전히 'WITHDRAW REQUESTED'
                //   표시. 원인: 기존 sync 가 canceled 만 처리.
                $beforeDone = (int)DB::fetchValue(
                    "SELECT COUNT(*) FROM wallet_transactions wt
                       INNER JOIN token_withdraw_requests twr ON wt.id = twr.wallet_tx_id
                      WHERE LOWER(TRIM(twr.status)) = 'done'
                        AND wt.kind = 'withdraw' AND wt.status = '출금신청'",
                    []
                );
                if ($beforeDone > 0) {
                    DB::execute(
                        "UPDATE wallet_transactions wt
                           INNER JOIN token_withdraw_requests twr ON wt.id = twr.wallet_tx_id
                              SET wt.status = '출금완료',
                                  wt.txid = COALESCE(NULLIF(wt.txid, ''), twr.txid)
                            WHERE LOWER(TRIM(twr.status)) = 'done'
                              AND wt.kind = 'withdraw'
                              AND wt.status = '출금신청'"
                    );
                }
                $diag['phase1_done_synced'] = $beforeDone;
            } catch (Throwable $e) {
                $diag['errors'][] = 'phase1: ' . $e->getMessage();
                error_log('[token-withdraw sync-stale link] ' . $e->getMessage());
            }
        } else {
            $diag['errors'][] = 'phase1 SKIP: wallet_tx_id 컬럼 부재';
        }

        // Phase 2 — 컬럼 유무에 따라 SQL 분기
        try {
            $orphanSql = $hasCol
                ? "SELECT id, address, asset_id, amount_token
                     FROM token_withdraw_requests
                    WHERE LOWER(TRIM(status)) IN ('canceled','cancelled','failed','rejected')
                      AND (wallet_tx_id IS NULL OR wallet_tx_id = 0)"
                // 컬럼 없으면 모든 canceled 행 대상으로 fallback 매칭 시도
                : "SELECT id, address, asset_id, amount_token
                     FROM token_withdraw_requests
                    WHERE LOWER(TRIM(status)) IN ('canceled','cancelled','failed','rejected')";
            $orphans = DB::fetchAll($orphanSql);
            $diag['phase2_orphans_found'] = count($orphans);

            foreach ($orphans as $o) {
                $matches = DB::fetchAll(
                    "SELECT id FROM wallet_transactions
                      WHERE address=? AND kind='withdraw' AND status='출금신청'
                        AND asset=? AND ABS(amount - ?) < 0.000001",
                    [$o['address'], $o['asset_id'], (float)$o['amount_token']]
                );
                $cnt = count($matches);
                if ($cnt === 1) {
                    DB::execute("UPDATE wallet_transactions SET status='실패' WHERE id=?", [(int)$matches[0]['id']]);
                    $diag['phase2_matched_one']++;
                    $diag['phase2_updates'][] = [
                        'twr_id' => (int)$o['id'],
                        'wt_id' => (int)$matches[0]['id'],
                        'asset' => $o['asset_id'],
                        'amount' => (float)$o['amount_token'],
                    ];
                    if ($hasCol) {
                        try {
                            DB::execute("UPDATE token_withdraw_requests SET wallet_tx_id=? WHERE id=?",
                                [(int)$matches[0]['id'], (int)$o['id']]);
                        } catch (Throwable $_) {}
                    }
                } elseif ($cnt > 1) {
                    $diag['phase2_matched_multi_skipped']++;
                    $diag['phase2_updates'][] = [
                        'twr_id' => (int)$o['id'],
                        'skip_reason' => 'multi_match',
                        'match_count' => $cnt,
                    ];
                } else {
                    $diag['phase2_no_match']++;
                }
            }
        } catch (Throwable $e) {
            $diag['errors'][] = 'phase2: ' . $e->getMessage();
            error_log('[token-withdraw sync-stale fallback] ' . $e->getMessage());
        }
        return $diag;
    }
}

// (v685) 진단/수동 트리거 endpoint — admin 이 직접 호출 가능.
//   POST /api/admin/token-withdraw/sync-stale
//   응답 JSON 에 sync 결과 상세 (phase1 / phase2 카운트 + 매칭 상세).
post('/api/admin/token-withdraw/sync-stale', function () {
    adminOnly();
    $diag = adminTokenWithdrawSyncStaleWalletTx(true);
    jsonOk(['diag' => $diag]);
});

// (2026-05-21 v689) Holdings 환불 미반영 자동 복구 — 운영자 보고: '5 STO
//   가 cancel 되었는데 잔고에 환불 안 됨.' 원인: v679 코드가 asset_id
//   별칭 ('SilicaSTO' / 'Silica') 으로 holdings UPDATE 시도 → canonical
//   ('SILICA-79907') 와 불일치 → silently 0 rows affected.
//   자동 복구: status='canceled' AND asset_id 별칭인 token_withdraw_requests
//   중 'holdings_refund_fixed_v689' 마커 없는 행을 찾아 canonical 행에 환불 +
//   마커로 중복 방지.
if (!function_exists('adminTokenWithdrawHealMissingRefunds')) {
    function adminTokenWithdrawHealMissingRefunds(): array {
        $diag = ['scanned' => 0, 'refunded' => 0, 'skipped_marked' => 0, 'errors' => [], 'details' => []];
        $singleId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';

        try {
            $rows = DB::fetchAll(
                "SELECT id, address, asset_id, amount_token, memo
                   FROM token_withdraw_requests
                  WHERE LOWER(TRIM(status)) IN ('canceled','cancelled','failed','rejected')
                    AND asset_id IN ('SilicaSTO', 'Silica')"
            );
            $diag['scanned'] = count($rows);

            foreach ($rows as $r) {
                $memo = (string)($r['memo'] ?? '');
                // 이미 처리된 행은 skip — 중복 환불 방지.
                // (v703) cancel marker 가 'cancel_refund_done_v703:1' 로
                //   분리됨 (이전엔 동일하게 holdings_refund_fixed_v689:1 사용).
                //   두 marker 중 하나라도 있으면 skip (backward compat).
                if (strpos($memo, 'holdings_refund_fixed_v689:1') !== false
                    || strpos($memo, 'cancel_refund_done_v703:1') !== false) {
                    $diag['skipped_marked']++;
                    continue;
                }

                $addr = (string)$r['address'];
                $assetIdRaw = (string)$r['asset_id'];
                $amount = (float)$r['amount_token'];
                if ($addr === '' || $amount <= 0) continue;
                $holdingsAssetId = $singleId;  // 두 별칭 모두 canonical 단일 자산으로 매핑

                try {
                    DB::execute("INSERT IGNORE INTO holdings(address, asset_id) VALUES (?,?)", [$addr, $holdingsAssetId]);
                    if ($assetIdRaw === 'Silica') {
                        DB::execute(
                            "UPDATE holdings SET silica_balance = silica_balance + ?
                              WHERE address=? AND asset_id=?",
                            [$amount, $addr, $holdingsAssetId]
                        );
                    } else {
                        // 'SilicaSTO' → 단일 자산 동기화 (silica_sto_balance + balance_token 양쪽)
                        DB::execute(
                            "UPDATE holdings SET silica_sto_balance = silica_sto_balance + ?, balance_token = balance_token + ?
                              WHERE address=? AND asset_id=?",
                            [$amount, $amount, $addr, $holdingsAssetId]
                        );
                    }

                    // 마커 추가 (중복 환불 방지)
                    $newMemo = trim($memo . '|holdings_refund_fixed_v689:1', '|');
                    DB::execute(
                        "UPDATE token_withdraw_requests SET memo=? WHERE id=?",
                        [$newMemo, (int)$r['id']]
                    );
                    $diag['refunded']++;
                    $diag['details'][] = [
                        'twr_id' => (int)$r['id'],
                        'address' => substr($addr, 0, 12),
                        'asset' => $assetIdRaw,
                        'amount' => $amount,
                    ];
                } catch (Throwable $rowErr) {
                    $diag['errors'][] = "twr_id={$r['id']}: " . $rowErr->getMessage();
                }
            }
        } catch (Throwable $e) {
            $diag['errors'][] = $e->getMessage();
        }
        return $diag;
    }
}

// 수동 트리거 endpoint (필요 시 admin 이 직접 호출)
post('/api/admin/token-withdraw/heal-refunds', function () {
    adminOnly();
    $diag = adminTokenWithdrawHealMissingRefunds();
    jsonOk(['diag' => $diag]);
});

// (2026-05-21 v701) 중복 환불 피해자 자동 보정.
//   v689 ~ v700 동안 cancel endpoint 가 환불 후 마커를 빠뜨려 다음 페이지
//   진입 시 heal 이 다시 환불 → 사용자 holdings 가 1 회분 초과 (정상값 9
//   인데 10). 이 함수는 그러한 케이스를 탐지하여 1 회 차감 + 보정 마커
//   기록 (idempotent).
//
//   탐지 기준:
//     1. token_withdraw_requests 가 취소/실패 상태 & SilicaSTO/Silica 별칭
//     2. memo 에 'holdings_refund_fixed_v689:1' 마커 존재 (= heal 이 환불함)
//     3. wallet_transactions 에 kind='withdraw_refund' AND
//        memo='refund_token_withdraw_req:<id>|...' AND before_amount > 0
//        (= cancel endpoint 도 실제 환불을 수행했음의 증거)
//     4. 'dup_refund_corrected_v701:1' 마커 부재 (= 아직 보정 안 됨)
//
//   보정 후 마커 추가 → 재실행 시 skip.
if (!function_exists('adminTokenWithdrawCorrectDoubleRefunds')) {
    function adminTokenWithdrawCorrectDoubleRefunds(): array {
        $diag = [
            'scanned' => 0,
            'corrected' => 0,
            'skipped_already_corrected' => 0,
            'skipped_no_evidence' => 0,
            'errors' => [],
            'details' => [],
        ];
        $singleId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';

        try {
            $rows = DB::fetchAll(
                "SELECT id, address, asset_id, amount_token, memo
                   FROM token_withdraw_requests
                  WHERE LOWER(TRIM(status)) IN ('canceled','cancelled','failed','rejected')
                    AND asset_id IN ('SilicaSTO', 'Silica')
                    AND memo LIKE '%holdings_refund_fixed_v689:1%'"
            );
            $diag['scanned'] = count($rows);

            foreach ($rows as $r) {
                $memo = (string)($r['memo'] ?? '');
                if (strpos($memo, 'dup_refund_corrected_v701:1') !== false) {
                    $diag['skipped_already_corrected']++;
                    continue;
                }

                $addr = (string)$r['address'];
                $assetIdRaw = (string)$r['asset_id'];
                $amount = (float)$r['amount_token'];
                if ($addr === '' || $amount <= 0) continue;

                // cancel endpoint 가 실제로 환불했는지 검증 — wallet_transactions
                // 의 withdraw_refund 행 (before_amount > 0) 존재 여부로 판단.
                // memo 패턴: 'refund_token_withdraw_req:<id>|type:admin_cancel|reason:...'
                $evidence = null;
                try {
                    $evidence = DB::fetchOne(
                        "SELECT id, amount, before_amount, after_amount
                           FROM wallet_transactions
                          WHERE address=? AND kind='withdraw_refund'
                            AND memo LIKE ?
                            AND before_amount > 0
                          ORDER BY id ASC
                          LIMIT 1",
                        [$addr, 'refund_token_withdraw_req:' . (int)$r['id'] . '|%']
                    );
                } catch (Throwable $_) {
                    $evidence = null;
                }

                if (!$evidence) {
                    $diag['skipped_no_evidence']++;
                    continue;
                }

                $holdingsAssetId = $singleId;
                try {
                    DB::execute("INSERT IGNORE INTO holdings(address, asset_id) VALUES (?,?)", [$addr, $holdingsAssetId]);
                    if ($assetIdRaw === 'Silica') {
                        DB::execute(
                            "UPDATE holdings SET silica_balance = GREATEST(0, silica_balance - ?)
                              WHERE address=? AND asset_id=?",
                            [$amount, $addr, $holdingsAssetId]
                        );
                    } else {
                        DB::execute(
                            "UPDATE holdings SET silica_sto_balance = GREATEST(0, silica_sto_balance - ?),
                                                  balance_token = GREATEST(0, balance_token - ?)
                              WHERE address=? AND asset_id=?",
                            [$amount, $amount, $addr, $holdingsAssetId]
                        );
                    }

                    $newMemo = trim($memo . '|dup_refund_corrected_v701:1', '|');
                    DB::execute(
                        "UPDATE token_withdraw_requests SET memo=? WHERE id=?",
                        [$newMemo, (int)$r['id']]
                    );
                    $diag['corrected']++;
                    $diag['details'][] = [
                        'twr_id' => (int)$r['id'],
                        'address' => substr($addr, 0, 12),
                        'asset' => $assetIdRaw,
                        'amount' => $amount,
                        'evidence_wtx_id' => (int)$evidence['id'],
                        'evidence_before' => (float)$evidence['before_amount'],
                        'evidence_after' => (float)$evidence['after_amount'],
                    ];
                } catch (Throwable $rowErr) {
                    $diag['errors'][] = "twr_id={$r['id']}: " . $rowErr->getMessage();
                }
            }
        } catch (Throwable $e) {
            $diag['errors'][] = $e->getMessage();
        }
        return $diag;
    }
}

// 수동 트리거 endpoint — 운영자가 직접 호출 가능 (실수 보정 후 한 번만 실행).
post('/api/admin/token-withdraw/correct-double-refunds', function () {
    adminOnly();
    $diag = adminTokenWithdrawCorrectDoubleRefunds();
    jsonOk(['diag' => $diag]);
});

// (2026-05-21 v703) v701 의 correctDoubleRefunds 가 cancel marker 와 heal
//   marker 를 구분 못해 정상 cancel 환불도 'double refund' 로 오판 → 추가
//   차감. 운영자 사례: 9 STO → 1출금/반려 2회 → 7 STO (정상 9).
//   해결: v701 보정으로 인한 false positive 행만 식별하여 차감을 되돌림.
//   판별 기준 (보수적):
//     1. 'dup_refund_corrected_v701:1' marker 존재 (= v701 이 차감했음)
//     2. 'dup_correction_undo_v703:1' marker 부재 (= 아직 되돌리지 않음)
//     3. reviewed_at >= v701 deploy 시점 (UTC 2026-05-20 16:51) — 이 시점
//        이전의 cancel 은 marker 가 heal 에 의해 추가된 진짜 victim 으로
//        간주하여 보정 유지. 이후의 cancel 은 v701 의 cancel 자체가 marker
//        를 달았으므로 false positive → 차감 되돌림.
if (!function_exists('adminTokenWithdrawRollbackBadCorrections')) {
    function adminTokenWithdrawRollbackBadCorrections(): array {
        $diag = [
            'scanned' => 0,
            'rolled_back' => 0,
            'skipped_already_undone' => 0,
            'skipped_pre_v701_real_victim' => 0,
            'errors' => [],
            'details' => [],
        ];
        $singleId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';
        // v701 commit: 2026-05-21 01:51:04 KST = 2026-05-20 16:51:04 UTC
        // 약간의 deploy 지연 흡수 위해 conservative 하게 16:45 부터.
        $v701ThresholdUtc = '2026-05-20 16:45:00';

        try {
            // (2026-05-21 v707) reviewed_at 컬럼 schema-adaptive — 일부 배포에서
            //   부재 (SQLSTATE[42S22] 에러). 없으면 NULL 로 대체.
            $hasReviewedAt = adminTokenWithdrawColumnExists('token_withdraw_requests', 'reviewed_at');
            $reviewedAtExpr = $hasReviewedAt ? 'reviewed_at' : 'NULL AS reviewed_at';
            $rows = DB::fetchAll(
                "SELECT id, address, asset_id, amount_token, memo, {$reviewedAtExpr}
                   FROM token_withdraw_requests
                  WHERE LOWER(TRIM(status)) IN ('canceled','cancelled','failed','rejected')
                    AND asset_id IN ('SilicaSTO', 'Silica')
                    AND memo LIKE '%dup_refund_corrected_v701:1%'"
            );
            $diag['scanned'] = count($rows);

            foreach ($rows as $r) {
                $memo = (string)($r['memo'] ?? '');
                if (strpos($memo, 'dup_correction_undo_v703:1') !== false) {
                    $diag['skipped_already_undone']++;
                    continue;
                }

                // (2026-05-21 v709) reviewed_at 컬럼이 부재/NULL 인 deployment 에서
                //   v703 logic 이 모든 행을 'real victim' 으로 분류 → false positive
                //   rollback 누락. 운영자 보고: holdings 6 STO (예상 9, -3 부족).
                //   수정: wallet_transactions.withdraw_refund 의 created_at 을
                //   timing 지표로 사용. v706/v707 heal 이 retroactively 생성한
                //   audit-fill 행 (memo 'audit_heal_v707' / 'admin_cancel_heal_v706')
                //   은 제외 — 원래 cancel 의 refund 행만 보아야 정확.
                $cancelRefundCreatedAt = '';
                try {
                    $cancelRefundCreatedAt = (string)DB::fetchValue(
                        "SELECT MIN(created_at) FROM wallet_transactions "
                        . " WHERE address=? AND kind='withdraw_refund' "
                        . "   AND memo LIKE ? "
                        . "   AND memo NOT LIKE '%admin_cancel_heal_v706%' "
                        . "   AND memo NOT LIKE '%audit_heal_v707%' ",
                        [(string)$r['address'], 'refund_token_withdraw_req:' . (int)$r['id'] . '|%']
                    );
                } catch (Throwable $_) {}

                $reviewedAt = (string)($r['reviewed_at'] ?? '');
                // wallet_tx 의 created_at 이 timing 지표로 신뢰성 가장 높음.
                // 없으면 reviewed_at 으로 fallback. 둘 다 없으면 보수적으로 skip.
                $timingTs = $cancelRefundCreatedAt !== '' ? $cancelRefundCreatedAt : $reviewedAt;

                if ($timingTs === '' || $timingTs < $v701ThresholdUtc) {
                    // v701 deploy 전의 cancel — 진짜 victim 으로 간주 (v701 보정 유지)
                    $diag['skipped_pre_v701_real_victim']++;
                    $diag['details'][] = [
                        'twr_id' => (int)$r['id'],
                        'address' => substr((string)$r['address'], 0, 12),
                        'cancel_refund_created_at' => $cancelRefundCreatedAt,
                        'reviewed_at' => $reviewedAt,
                        'timing_ts_used' => $timingTs,
                        'action' => 'skipped_real_victim',
                    ];
                    continue;
                }

                $addr = (string)$r['address'];
                $assetIdRaw = (string)$r['asset_id'];
                $amount = (float)$r['amount_token'];
                if ($addr === '' || $amount <= 0) continue;

                $holdingsAssetId = $singleId;
                try {
                    DB::execute("INSERT IGNORE INTO holdings(address, asset_id) VALUES (?,?)", [$addr, $holdingsAssetId]);
                    if ($assetIdRaw === 'Silica') {
                        DB::execute(
                            "UPDATE holdings SET silica_balance = silica_balance + ?
                              WHERE address=? AND asset_id=?",
                            [$amount, $addr, $holdingsAssetId]
                        );
                    } else {
                        DB::execute(
                            "UPDATE holdings SET silica_sto_balance = silica_sto_balance + ?,
                                                  balance_token = balance_token + ?
                              WHERE address=? AND asset_id=?",
                            [$amount, $amount, $addr, $holdingsAssetId]
                        );
                    }

                    $newMemo = trim($memo . '|dup_correction_undo_v703:1', '|');
                    DB::execute(
                        "UPDATE token_withdraw_requests SET memo=? WHERE id=?",
                        [$newMemo, (int)$r['id']]
                    );
                    $diag['rolled_back']++;
                    $diag['details'][] = [
                        'twr_id' => (int)$r['id'],
                        'address' => substr($addr, 0, 12),
                        'asset' => $assetIdRaw,
                        'amount' => $amount,
                        'cancel_refund_created_at' => $cancelRefundCreatedAt,
                        'reviewed_at' => $reviewedAt,
                        'timing_ts_used' => $timingTs,
                        'action' => 'rolled_back',
                    ];
                } catch (Throwable $rowErr) {
                    $diag['errors'][] = "twr_id={$r['id']}: " . $rowErr->getMessage();
                }
            }
        } catch (Throwable $e) {
            $diag['errors'][] = $e->getMessage();
        }
        return $diag;
    }
}

// 수동 트리거 endpoint
post('/api/admin/token-withdraw/rollback-bad-corrections', function () {
    adminOnly();
    $diag = adminTokenWithdrawRollbackBadCorrections();
    jsonOk(['diag' => $diag]);
});

// (2026-05-21 v706) 운영자 보고: history 에 3 FAILED + 1 Refund 만 보임
//   (1:1 페어링 불일치). 원인 추정: 과거 cancel transaction 실패로 refund
//   wallet_tx 가 미생성된 케이스 (status 만 sync 함수가 '실패' 로 마킹).
//   해결: 각 canceled twr 에 대응하는 wallet_transactions.withdraw_refund
//   행이 존재하지 않으면 retroactively INSERT (audit fill).
//   멱등성: 'refund_token_withdraw_req:<id>|...' memo 패턴 중복 체크.
if (!function_exists('adminTokenWithdrawHealMissingRefundWalletTx')) {
    function adminTokenWithdrawHealMissingRefundWalletTx(): array {
        $diag = [
            'scanned' => 0,
            'inserted_token' => 0,
            'inserted_fee' => 0,
            'skipped_existing' => 0,
            'errors' => [],
            'details' => [],
        ];

        // 컬럼 존재 여부 체크 — 일부 deployment 는 reject_reason/reviewed_at 등 부재.
        $hasReason = adminTokenWithdrawColumnExists('token_withdraw_requests', 'reject_reason');
        $hasReviewedAt = adminTokenWithdrawColumnExists('token_withdraw_requests', 'reviewed_at');
        $hasFeeAmount = adminTokenWithdrawColumnExists('token_withdraw_requests', 'fee_amount');
        $hasFeeAsset = adminTokenWithdrawColumnExists('token_withdraw_requests', 'fee_asset');

        $selectExprs = ['id', 'address', 'asset_id', 'amount_token'];
        $selectExprs[] = $hasReason ? 'reject_reason' : "'' AS reject_reason";
        $selectExprs[] = $hasReviewedAt ? 'reviewed_at' : 'NULL AS reviewed_at';
        $selectExprs[] = $hasFeeAmount ? 'fee_amount' : '0 AS fee_amount';
        $selectExprs[] = $hasFeeAsset ? 'fee_asset' : "'USDT' AS fee_asset";

        try {
            $rows = DB::fetchAll(
                "SELECT " . implode(', ', $selectExprs)
                . "  FROM token_withdraw_requests "
                . " WHERE LOWER(TRIM(status)) IN ('canceled','cancelled','failed','rejected') "
                . "   AND asset_id IN ('SilicaSTO', 'Silica')"
            );
            $diag['scanned'] = count($rows);

            foreach ($rows as $r) {
                $requestId = (int)$r['id'];
                $addr = (string)$r['address'];
                $assetIdRaw = (string)$r['asset_id'];
                $amount = (float)$r['amount_token'];
                if ($addr === '' || $amount <= 0) continue;

                // === 토큰 환불 wallet_tx 존재 여부 체크 ===
                $tokenExists = (int)DB::fetchValue(
                    "SELECT COUNT(*) FROM wallet_transactions "
                    . " WHERE address=? AND kind='withdraw_refund' "
                    . "   AND memo LIKE ?",
                    [$addr, 'refund_token_withdraw_req:' . $requestId . '|%']
                );

                $rejReason = (string)($r['reject_reason'] ?? '');
                if ($rejReason === '') $rejReason = '(restored by heal v706)';
                $createdAt = (string)($r['reviewed_at'] ?? '');
                if ($createdAt === '') $createdAt = nowUtcSql();

                if ($tokenExists === 0) {
                    // 미존재 — 토큰 refund wallet_tx INSERT
                    $refundMemo = 'refund_token_withdraw_req:' . $requestId
                        . '|type:admin_cancel_heal_v706|reason:' . mb_substr($rejReason, 0, 200);
                    try {
                        DB::execute(
                            "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at) "
                            . " VALUES (?,?,?,?,?,?,?,?,?,?)",
                            [$addr, 'withdraw_refund', '출금반환', $assetIdRaw, $amount, 0, $amount, null, $refundMemo, $createdAt]
                        );
                        $diag['inserted_token']++;
                        $diag['details'][] = [
                            'twr_id' => $requestId,
                            'address' => substr($addr, 0, 12),
                            'asset' => $assetIdRaw,
                            'amount' => $amount,
                            'kind' => 'token_refund',
                        ];
                    } catch (Throwable $e) {
                        $diag['errors'][] = "twr_id={$requestId} token: " . $e->getMessage();
                    }
                } else {
                    $diag['skipped_existing']++;
                }

                // === USDT 수수료 환불 wallet_tx 존재 여부 체크 ===
                $feeAmount = (float)($r['fee_amount'] ?? 0);
                $feeAsset = strtoupper((string)($r['fee_asset'] ?? 'USDT'));
                if ($feeAmount > 0 && $feeAsset === 'USDT') {
                    $feeExists = (int)DB::fetchValue(
                        "SELECT COUNT(*) FROM wallet_transactions "
                        . " WHERE address=? AND kind='withdraw_refund' AND asset='USDT' "
                        . "   AND memo LIKE ?",
                        [$addr, 'refund_token_withdraw_fee:' . $requestId . '|%']
                    );
                    if ($feeExists === 0) {
                        $feeMemo = 'refund_token_withdraw_fee:' . $requestId
                            . '|type:admin_cancel_heal_v706';
                        try {
                            DB::execute(
                                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at) "
                                . " VALUES (?,?,?,?,?,?,?,?,?,?)",
                                [$addr, 'withdraw_refund', '출금반환', 'USDT', $feeAmount, 0, $feeAmount, null, $feeMemo, $createdAt]
                            );
                            $diag['inserted_fee']++;
                            $diag['details'][] = [
                                'twr_id' => $requestId,
                                'address' => substr($addr, 0, 12),
                                'asset' => 'USDT',
                                'amount' => $feeAmount,
                                'kind' => 'fee_refund',
                            ];
                        } catch (Throwable $e) {
                            $diag['errors'][] = "twr_id={$requestId} fee: " . $e->getMessage();
                        }
                    }
                }
            }

            // (2026-05-21 v707) Phase 2 — wallet_tx FAILED 행 기반 누락 환불 복구.
            //   v706 Phase 1 은 canceled twr 만 scan. 그런데 운영자 데이터에서
            //   30 FAILED 행 vs 7 canceled twr (= 23 orphan FAILED). 이는 빠른
            //   연속 출금 + 부분적 cancel 흐름의 결과 — wallet_tx 는 '실패'
            //   상태이지만 twr 은 canceled 가 아닌 다른 상태로 남음.
            //   해결: kind='withdraw' AND status='실패' 인 wallet_tx 행마다
            //   대응하는 withdraw_refund 행이 같은 (address+asset+amount+day)
            //   범위 안에 존재하는지 1:1 consume-once 매칭 후 부족분 INSERT.
            $diag['phase2_scanned'] = 0;
            $diag['phase2_inserted'] = 0;
            $diag['phase2_matched_existing'] = 0;

            $hasAdminNoteCol = adminTokenWithdrawColumnExists('wallet_transactions', 'admin_note');
            $adminNoteExpr = $hasAdminNoteCol ? 'admin_note' : "'' AS admin_note";
            // (2026-05-21 v710) Phase 2 scope 무제한 — asset whitelist 제거.
            //   운영자 데이터: v708 까지 token+USDT 만 (7 scanned) 했는데
            //   user history 에는 9+ SILICASTO FAILED 존재. 원인 추정: 일부
            //   wallet_tx.asset 값이 canonical 별칭 ('SILICA-79907') 또는 다른
            //   변형으로 저장. asset 필터 없이 전체 FAILED withdraw 행 scan
            //   후 동일 asset 끼리 1:1 매칭.
            //   안전성: kind='withdraw' AND status='실패' 만 처리. asset='' 인
            //   행은 amount=0 이거나 의미 없으므로 자동 skip.
            $faileds = DB::fetchAll(
                "SELECT id, address, asset, amount, memo, {$adminNoteExpr}, created_at "
                . "  FROM wallet_transactions "
                . " WHERE kind='withdraw' AND status='실패' "
                . "   AND asset IS NOT NULL AND asset <> '' "
            );
            $existingRefunds = DB::fetchAll(
                "SELECT id, address, asset, amount, memo, created_at "
                . "  FROM wallet_transactions "
                . " WHERE kind='withdraw_refund' "
                . "   AND asset IS NOT NULL AND asset <> '' "
            );

            // (v710) 진단 — asset 값 분포 표시. 어떤 변형이 있는지 확인.
            $assetDistFailed = [];
            foreach ($faileds as $f) {
                $a = (string)$f['asset'];
                $assetDistFailed[$a] = ($assetDistFailed[$a] ?? 0) + 1;
            }
            $assetDistRefund = [];
            foreach ($existingRefunds as $rfd) {
                $a = (string)$rfd['asset'];
                $assetDistRefund[$a] = ($assetDistRefund[$a] ?? 0) + 1;
            }
            $diag['asset_dist_failed'] = $assetDistFailed;
            $diag['asset_dist_refund'] = $assetDistRefund;

            // (v708/v711) refundMap 구축 시 USDT 수수료 환불 (memo prefix
            //   'refund_token_withdraw_fee:') 은 제외 — 토큰 취소 시 자동
            //   생성되는 수수료 환불이므로 출금 취소의 환불 매칭 대상이 아님.
            // (v711) day key 제거 — UTC 자정 경계나 cancel/refund 시간 차이로
            //   매칭 실패하던 문제 해결. 단순히 address|asset|amount 로 매칭.
            $refundMap = [];
            foreach ($existingRefunds as $rfd) {
                $rfdMemo = (string)($rfd['memo'] ?? '');
                if (strpos($rfdMemo, 'refund_token_withdraw_fee:') === 0
                    || strpos($rfdMemo, '|refund_token_withdraw_fee:') !== false) {
                    continue;
                }
                $key = $rfd['address'] . '|' . $rfd['asset'] . '|'
                     . number_format((float)$rfd['amount'], 6, '.', '');
                $refundMap[$key] = ($refundMap[$key] ?? 0) + 1;
            }

            $diag['phase2_scanned'] = count($faileds);
            foreach ($faileds as $f) {
                $key = $f['address'] . '|' . $f['asset'] . '|'
                     . number_format((float)$f['amount'], 6, '.', '');
                if (($refundMap[$key] ?? 0) > 0) {
                    $refundMap[$key]--;
                    $diag['phase2_matched_existing']++;
                    continue;
                }
                // 누락 — refund 행 INSERT (audit-only, holdings 미변경)
                $reason = '';
                $adminNote = (string)($f['admin_note'] ?? '');
                if (strpos($adminNote, 'reject_reason:') === 0) {
                    $reason = substr($adminNote, 14);
                } else {
                    $memo = (string)($f['memo'] ?? '');
                    if (preg_match('/(?:^|\|)reject_reason:([^|\n]+)/i', $memo, $m)
                        || preg_match('/(?:^|\|)cancel_reason:([^|\n]+)/i', $memo, $m)) {
                        $reason = rawurldecode($m[1]);
                    }
                }
                if ($reason === '') $reason = '(restored by heal v707)';
                $refundMemo = 'refund_token_withdraw_wtx:' . (int)$f['id']
                    . '|type:audit_heal_v707|reason:' . mb_substr($reason, 0, 200);
                try {
                    DB::execute(
                        "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at) "
                        . " VALUES (?,?,?,?,?,?,?,?,?,?)",
                        [$f['address'], 'withdraw_refund', '출금반환', $f['asset'], (float)$f['amount'], 0, (float)$f['amount'], null, $refundMemo, $f['created_at']]
                    );
                    $diag['phase2_inserted']++;
                    $diag['details'][] = [
                        'wtx_id' => (int)$f['id'],
                        'address' => substr((string)$f['address'], 0, 12),
                        'asset' => $f['asset'],
                        'amount' => (float)$f['amount'],
                        'kind' => 'audit_fill',
                    ];
                } catch (Throwable $e) {
                    $diag['errors'][] = "wtx_id={$f['id']} phase2: " . $e->getMessage();
                }
            }
        } catch (Throwable $e) {
            $diag['errors'][] = $e->getMessage();
        }
        return $diag;
    }
}

post('/api/admin/token-withdraw/heal-missing-refund-wtx', function () {
    adminOnly();
    $diag = adminTokenWithdrawHealMissingRefundWalletTx();
    jsonOk(['diag' => $diag]);
});

get('/api/admin/token-withdraw/runtime', function () {
    adminOnly();
    // (v685) admin page 진입 시 stale wallet_tx 동기화 + 진단 결과 응답에 포함.
    //   adminOnly() 인증 후 실행 (보안 우선).
    $syncDiag = adminTokenWithdrawSyncStaleWalletTx(true);
    // (2026-05-21 v703) v701 의 correctDoubleRefunds 를 runtime 에서 제거.
    //   cancel marker 와 heal marker 가 동일하여 정상 cancel 까지 'double
    //   refund victim' 으로 오판하던 버그. 새 cancel 은 다른 marker 사용
    //   ('cancel_refund_done_v703:1') 로 분리 → 더 이상 자동 보정 불필요.
    //   기존 false positive 보정은 rollback 함수가 한 번만 되돌림.
    $rollbackDiag = adminTokenWithdrawRollbackBadCorrections();
    // (v689) holdings 환불 미반영 자동 복구
    $healDiag = adminTokenWithdrawHealMissingRefunds();
    // (v706) 누락된 refund wallet_tx 행 자동 복구 — history 의 1:1 페어링 보장
    $refundWtxHealDiag = adminTokenWithdrawHealMissingRefundWalletTx();
    $wallet = adminTokenWithdrawConfiguredWallet();
    jsonOk([
        'network' => function_exists('getConfiguredSolanaNetwork') ? getConfiguredSolanaNetwork() : (getSetting('solana_network', 'devnet') ?? 'devnet'),
        'admin_wallet_address' => $wallet['address'],
        'admin_wallet_error' => $wallet['error'],
        'same_wallet_noop_enabled' => false,
        'bypass_otp' => isOtpBypassed(),
        'sync_diag' => $syncDiag,
        'rollback_diag' => $rollbackDiag,
        'heal_diag' => $healDiag,
        'refund_wtx_heal_diag' => $refundWtxHealDiag,
    ]);
});

get('/api/admin/token-withdraw/requests', function () {
    adminOnly();
    $status = trim($_GET['status'] ?? '');
    $q = trim($_GET['q'] ?? '');
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 100)));

    $where = [];
    $params = [];
    if ($status !== '') {
        $where[] = 'r.status=?';
        $params[] = $status;
    }
    if ($q !== '') {
        $where[] = '(r.address LIKE ? OR r.to_address LIKE ? OR r.asset_id LIKE ? OR a.name LIKE ?)';
        $params[] = "%{$q}%";
        $params[] = "%{$q}%";
        $params[] = "%{$q}%";
        $params[] = "%{$q}%";
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $select = [
        'r.id',
        'r.address',
        'r.asset_id',
        'r.to_address',
        'r.amount_token',
        'r.status',
        'r.txid',
        'r.memo',
        'r.created_at',
        'r.updated_at',
        adminTokenWithdrawSelectExpr('r', 'fee_mode', 'NULL'),
        adminTokenWithdrawSelectExpr('r', 'fee_value', '0'),
        adminTokenWithdrawSelectExpr('r', 'fee_amount', '0'),
        adminTokenWithdrawSelectExpr('r', 'fee_asset', "'USDT'"),
        adminTokenWithdrawSelectExpr('r', 'net_amount', '0'),
        adminTokenWithdrawSelectExpr('r', 'reject_reason', 'NULL'),
        adminTokenWithdrawSelectExpr('r', 'reviewed_by', 'NULL'),
        adminTokenWithdrawSelectExpr('r', 'reviewed_at', 'NULL'),
        'a.name AS asset_name',
        'a.token_mint_address',
    ];

    $rows = DB::fetchAll(
        "SELECT " . implode(",\n                ", $select) . "\n"
        . "  FROM token_withdraw_requests r\n"
        . "  LEFT JOIN assets a ON a.id = r.asset_id\n"
        . " {$whereSql}\n"
        . " ORDER BY r.id DESC\n"
        . " LIMIT {$limit}",
        $params
    );

    foreach ($rows as &$row) {
        $row['fee_amount'] = adminTokenWithdrawFeeAmount($row);
        $row['fee_asset'] = adminTokenWithdrawFeeAsset($row);
        $row['net_amount'] = adminTokenWithdrawNetAmount($row);
        $row['last_error'] = adminTokenWithdrawMemoText((string)($row['memo'] ?? ''), ['send_error']);
        // (v697) mint 주소 — settings fallback
        $row['token_mint_address'] = adminTokenWithdrawResolveMintAddr($row);
    }
    unset($row);

    jsonOk(['rows' => $rows]);
});

get('/api/admin/token-withdraw/prepare', function () {
    adminOnly();
    $requestId = (int)($_GET['request_id'] ?? 0);
    if ($requestId <= 0) jsonError(400, 'request_id 필요');

    $row = adminTokenWithdrawFetchRow($requestId, false);
    if (!$row) jsonError(404, '요청 없음');

    $status = strtolower(trim((string)($row['status'] ?? '')));
    if ($status === 'done') {
        jsonOk([
            'request_id' => $requestId,
            'duplicated' => true,
            'status' => 'done',
            'txid' => $row['txid'] ?? null,
        ]);
    }
    if (!adminTokenWithdrawCanSendStatus($status)) {
        jsonError(409, '전송 불가 상태: ' . ($row['status'] ?? '-'));
    }

    // (2026-05-08) 사장님 정책: 송금 지갑은 설정 출금지갑과 일치하지 않아도 OK.
    //   wallet 설정 주소는 정보 표시용으로만 응답에 포함. 실제 전송 가드는
    //   execute 단계에서 from_address(연결된 Phantom 지갑) 기준으로 처리.
    $wallet = adminTokenWithdrawConfiguredWallet();

    $netAmount = adminTokenWithdrawNetAmount($row);
    if (!($netAmount > 0)) {
        jsonError(400, '전송 수량이 0 이하입니다.');
    }

    // 동일 지갑 가드는 실제 from_address 가 정해지는 execute 단계에서 적용.
    // prepare 응답에는 to_address 만 노출하여 클라이언트가 사전에 안내할 수 있게 한다.
    $sameWallet = $wallet['address']
        ? adminTokenWithdrawSameAddress($wallet['address'], (string)($row['to_address'] ?? ''))
        : false;
    $mint = trim((string)($row['token_mint_address'] ?? ''));
    if ($mint === '') jsonError(400, '토큰 민트 주소가 저장되어 있지 않습니다.');
    normalizeSolanaAddress($mint, '토큰 민트 주소');

    jsonOk([
        'request_id' => $requestId,
        'status' => $row['status'],
        'network' => function_exists('getConfiguredSolanaNetwork') ? getConfiguredSolanaNetwork() : (getSetting('solana_network', 'devnet') ?? 'devnet'),
        'admin_wallet_address' => $wallet['address'],
        'to_address' => (string)($row['to_address'] ?? ''),
        'token_mint_address' => $mint,
        'token_decimals' => adminTokenWithdrawResolveTokenDecimals($row),
        'net_amount' => $netAmount,
        'fee_amount' => adminTokenWithdrawFeeAmount($row),
        'fee_asset' => adminTokenWithdrawFeeAsset($row),
        'same_wallet' => $sameWallet,
        'same_wallet_noop' => false,
        'same_wallet_blocked' => $sameWallet,
    ]);
});

post('/api/admin/token-withdraw/send', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    try {
        verifyAdminOtpOrThrow($body['otp'] ?? '');
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }

    $requestId = (int)($body['request_id'] ?? 0);
    if ($requestId <= 0) jsonError(400, 'request_id 필요');

    $fromAddress = trim((string)($body['from_address'] ?? ''));
    if ($fromAddress !== '') {
        try {
            $fromAddress = normalizeSolanaAddress($fromAddress, '연결된 Phantom 지갑');
        } catch (Throwable $e) {
            jsonError(400, $e->getMessage());
        }
    }
    $signedTxBase64 = trim((string)($body['signedTxBase64'] ?? ''));

    $reviewer = (string)($admin['username'] ?? 'admin');
    $reviewedAt = nowUtcSql();

    $pdo = DB::pdo();
    $row = null;
    $adminWallet = '';
    $sameWallet = false;

    $pdo->beginTransaction();
    try {
        $row = adminTokenWithdrawFetchRow($requestId, true);
        if (!$row) {
            $pdo->rollBack();
            jsonError(404, '요청 없음');
        }

        $status = strtolower(trim((string)($row['status'] ?? '')));
        if ($status === 'done') {
            $pdo->commit();
            jsonOk(['request_id' => $requestId, 'txid' => $row['txid'] ?? null, 'duplicated' => true]);
        }
        if (!adminTokenWithdrawCanSendStatus($status)) {
            $pdo->rollBack();
            jsonError(409, '처리 불가 상태: ' . ($row['status'] ?? '-'));
        }

        // (2026-05-08) 사장님 정책 변경: 출금 송금에 사용하는 Phantom 지갑은
        //   설정 출금지갑(admin_wallet_address) 과 일치하지 않아도 OK. 잔액이
        //   있는 어떤 지갑이든 전송 가능. 따라서 wallet 설정 주소 가드 / from
        //   address 일치 가드 모두 제거. (잔액 부족 시 Solana RPC 가 거절.)
        $wallet = adminTokenWithdrawConfiguredWallet();
        $adminWallet = $wallet['address']; // 정보 표시용 — 비어 있어도 실제 송금에는 영향 없음.

        if ($fromAddress === '') {
            $pdo->rollBack();
            jsonError(400, '연결된 Phantom 지갑 주소가 필요합니다.');
        }

        // (2026-05-21 v692) 운영자 정책: 자기-전송 허용. 동일 지갑 체크 제거.
        //   클라이언트가 self-transfer signedTx 를 만들어 보내면 그대로 처리.
        //   Solana 의 transfer-checked 인스트럭션은 from==to 도 유효 (no-op
        //   효과지만 트랜잭션은 chain 에 기록됨, 운영자 의도된 동작).
        $sameWallet = adminTokenWithdrawSameAddress($fromAddress, (string)($row['to_address'] ?? ''));

        if ($signedTxBase64 === '') {
            $pdo->rollBack();
            jsonError(400, 'signedTxBase64 필요');
        }

        adminTokenWithdrawUpdateRequest($requestId, [
            'status' => 'processing',
            'reject_reason' => null,
            'reviewed_by' => $reviewer,
            'reviewed_at' => $reviewedAt,
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '토큰 전송 준비 실패: ' . $e->getMessage());
    }

    // ★ 이중출금 방지: $sig 변수를 try 블록 밖에서 선언
    //    - $sig 가 set 됐다면 → 체인에 트랜잭션이 이미 전송됨
    //    - $sig 가 null 이면 → 체인 미전송 (Phantom 거절, 잔액부족 등)
    $sig = null;
    try {
        $sig = sendRawTransaction($signedTxBase64);
        if (!$sig) {
            // sig 없이 fail → 체인 미전송 확실
            throw new RuntimeException('트랜잭션 전송 실패 — sig 미생성');
        }

        // ★ 이 시점부터 $sig 가 있음 = 체인에 전송됐음
        // getParsedTxRetry 가 RPC 지연/timeout 으로 throw 해도 트랜잭션 자체는 전송된 상태
        getParsedTxRetry($sig);

        $pdo->beginTransaction();
        try {
            $current = adminTokenWithdrawFetchRow($requestId, true);
            if (!$current) {
                $pdo->rollBack();
                jsonError(404, '요청 없음');
            }
            $currentStatus = strtolower(trim((string)($current['status'] ?? '')));
            if ($currentStatus === 'done') {
                $pdo->commit();
                jsonOk(['request_id' => $requestId, 'txid' => $current['txid'] ?? $sig, 'duplicated' => true]);
            }
            // 'processing' 은 OK (우리가 set 했으니), 그 외는 비정상
            if (!in_array($currentStatus, ['pending', 'processing'], true)) {
                $pdo->rollBack();
                jsonError(409, '전송 완료 처리 중 상태가 변경되었습니다.');
            }

            $memo = adminTokenWithdrawAppendMemo((string)($current['memo'] ?? ''), [
                'send_mode' => 'onchain',
                'network' => function_exists('getConfiguredSolanaNetwork') ? getConfiguredSolanaNetwork() : (getSetting('solana_network', 'devnet') ?? 'devnet'),
            ]);
            adminTokenWithdrawUpdateRequest($requestId, [
                'status' => 'done',
                'txid' => $sig,
                'memo' => $memo,
                'reject_reason' => null,
                'reviewed_by' => $reviewer,
                'reviewed_at' => nowUtcSql(),
            ]);
            $pdo->commit();

            jsonOk([
                'request_id' => $requestId,
                'txid' => $sig,
                'same_wallet' => false,
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    } catch (Throwable $e) {
        $safe = adminTokenWithdrawSafeErrorText($e->getMessage());

        // ★ 이중출금 방지 핵심 분기:
        if ($sig) {
            // ── A. 체인 전송됐음 ($sig 생성됨) → 절대 'pending' 으로 되돌리지 않음
            //    'processing' 유지 + sig 를 txid 컬럼에 저장 (관리자가 Solscan 에서 검증 후 수동완료)
            try {
                $pdo->beginTransaction();
                $current = adminTokenWithdrawFetchRow($requestId, true);
                $memoBase = (string)($current['memo'] ?? ($row['memo'] ?? ''));
                $memo = adminTokenWithdrawAppendMemo($memoBase, [
                    'send_uncertain' => $safe,
                    'pending_sig'    => $sig,
                ]);
                adminTokenWithdrawUpdateRequest($requestId, [
                    'status'        => 'processing',  // ★ 잠금 유지
                    'txid'          => $sig,           // 검증용 sig 보관
                    'memo'          => $memo,
                    'reject_reason' => '확인필요(체인전송됨): ' . $safe,
                    'reviewed_by'   => $reviewer,
                    'reviewed_at'   => nowUtcSql(),
                ]);
                $pdo->commit();
            } catch (Throwable $rollbackError) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                error_log('admin token withdraw uncertain-state update failed: ' . $rollbackError->getMessage());
            }
            jsonError(409, sprintf(
                '체인 전송 가능성 — 재전송 금지. Solscan 에서 시그니처 [%s] 확인 후 수동완료 처리하세요. 원인: %s',
                $sig,
                $safe
            ));
        } else {
            // ── B. 체인 미전송 ($sig 없음) → 'pending' 으로 안전 복귀
            //    Phantom 거절, 잔액부족, 잘못된 지갑 등 = 실 전송 없음
            try {
                $pdo->beginTransaction();
                $current = adminTokenWithdrawFetchRow($requestId, true);
                $memoBase = (string)($current['memo'] ?? ($row['memo'] ?? ''));
                $memo = adminTokenWithdrawAppendMemo($memoBase, ['send_error' => $safe]);
                adminTokenWithdrawUpdateRequest($requestId, [
                    'status'        => 'pending',
                    'memo'          => $memo,
                    'reject_reason' => $safe,
                ]);
                $pdo->commit();
            } catch (Throwable $rollbackError) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                error_log('admin token withdraw send rollback update failed: ' . $rollbackError->getMessage());
            }
            jsonError(400, '전송 실패: ' . $safe);
        }
    }
});

// ================================================================
// ★ 수동 완료 처리 (manual-complete)
// 시나리오: send 가 catch 에서 'processing' + sig 저장 상태로 멈춤
//          관리자가 Solscan 에서 sig 가 정상 confirm 됐음을 확인
//          이 엔드포인트로 수동 완료 처리 → status='done' + txid 확정
// 안전장치: 체인에서 txid 의 실재 여부를 RPC 로 한 번 더 검증
// ================================================================
post('/api/admin/token-withdraw/manual-complete', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    try {
        verifyAdminOtpOrThrow($body['otp'] ?? '');
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }

    $requestId = (int)($body['request_id'] ?? 0);
    $txid = trim((string)($body['txid'] ?? ''));
    if ($requestId <= 0) jsonError(400, 'request_id 필요');
    if ($txid === '')   jsonError(400, 'txid 필요');

    $reviewer = (string)($admin['username'] ?? 'admin');

    // 체인에서 txid 실재 여부 검증 (가짜 txid 입력 방지)
    try {
        $info = getParsedTxRetry($txid);
        if (!$info) throw new RuntimeException('체인에서 트랜잭션을 찾을 수 없음');
    } catch (Throwable $e) {
        jsonError(400, 'txid 체인 검증 실패: ' . $e->getMessage());
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $row = adminTokenWithdrawFetchRow($requestId, true);
        if (!$row) {
            $pdo->rollBack();
            jsonError(404, '요청 없음');
        }
        $status = strtolower(trim((string)($row['status'] ?? '')));
        if ($status === 'done') {
            $pdo->commit();
            jsonOk(['request_id' => $requestId, 'txid' => $row['txid'] ?? $txid, 'duplicated' => true]);
        }
        if (!in_array($status, ['pending', 'processing'], true)) {
            $pdo->rollBack();
            jsonError(409, '수동완료 가능 상태 아님: ' . ($row['status'] ?? '-'));
        }

        $memo = adminTokenWithdrawAppendMemo((string)($row['memo'] ?? ''), [
            'manual_complete' => '1',
            'completed_by'    => $reviewer,
        ]);
        adminTokenWithdrawUpdateRequest($requestId, [
            'status'        => 'done',
            'txid'          => $txid,
            'memo'          => $memo,
            'reject_reason' => null,
            'reviewed_by'   => $reviewer,
            'reviewed_at'   => nowUtcSql(),
        ]);
        $pdo->commit();
        jsonOk(['request_id' => $requestId, 'txid' => $txid, 'manual' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '수동완료 처리 실패: ' . $e->getMessage());
    }
});

post('/api/admin/token-withdraw/cancel', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    try {
        verifyAdminOtpOrThrow($body['otp'] ?? '');
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }

    $requestId = (int)($body['request_id'] ?? 0);
    if ($requestId <= 0) jsonError(400, 'request_id 필요');

    $reviewer = (string)($admin['username'] ?? 'admin');
    // (2026-05-20 v681) 반려 사유 필수 — USDT 출금 reject 와 동일.
    //   이전엔 비어있어도 '관리자 취소' fallback → 사용자가 사유를 알 수 없었음.
    $rejectReason = trim((string)($body['reason'] ?? ''));
    if ($rejectReason === '') jsonError(400, '반려 사유를 입력하세요.');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $r = adminTokenWithdrawFetchRow($requestId, true);
        if (!$r) {
            $pdo->rollBack();
            jsonError(404, '요청 없음');
        }

        // ★ 취소는 'pending' 만 허용 — 'processing' 은 체인 전송 가능성 있어 금지
        if (!adminTokenWithdrawCanCancelStatus((string)($r['status'] ?? ''))) {
            $pdo->rollBack();
            jsonError(400, '취소 불가 상태: ' . ($r['status'] ?? '-') . ' — processing 은 manual-complete 검증 후 처리하세요');
        }

        // (2026-05-20 v679) 운영자 보고: USDT 출금 거절 플로우와 비대칭.
        //   토큰 출금 취소 시 holdings 만 환불되고 wallet_transactions 에
        //   환불 행 / 원본 status 업데이트 누락 → 사용자 history 에 환불
        //   기록 사라짐. USDT 출금 reject (admin_withdraw.php) 와 동일하게
        //   4단계 처리하도록 보강.
        // (2026-05-21 v689) 운영자 발견: token_withdraw_requests.asset_id 가
        //   'SilicaSTO' / 'Silica' 별칭으로 저장되지만 holdings.asset_id 는
        //   canonical 'SILICA-79907' 만 존재. UPDATE WHERE asset_id='SilicaSTO'
        //   가 0 rows matched → silent fail → 환불 미반영.
        //   해결: holdings 작업에 사용할 asset_id 를 canonical 로 정규화.
        $addr = (string)$r['address'];
        $tokAssetId = (string)$r['asset_id'];
        $tokAmount = (float)($r['amount_token'] ?? 0);
        $singleId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';
        // 'SilicaSTO' / 'Silica' 같은 단일자산 별칭 → canonical (예 'SILICA-79907')
        $holdingsAssetId = in_array($tokAssetId, ['SilicaSTO', 'Silica'], true) ? $singleId : $tokAssetId;

        // (1) holdings 환불 — canonical asset_id 로 SELECT/UPDATE → 정확한 row 타겟.
        DB::execute("INSERT IGNORE INTO holdings(address, asset_id) VALUES (?,?)", [$addr, $holdingsAssetId]);
        $hRow = DB::fetchOne("SELECT balance_token FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$addr, $holdingsAssetId]);
        $tokBefore = (float)($hRow['balance_token'] ?? 0);
        $tokAfter = clamp6($tokBefore + $tokAmount);
        // 단일 자산 (SilicaSTO 등) 은 silica_sto_balance / balance_token 양쪽 미러.
        //   Silica 별칭은 silica_balance 컬럼만 갱신.
        if ($tokAssetId === 'Silica') {
            DB::execute(
                "UPDATE holdings SET silica_balance = silica_balance + ?
                  WHERE address=? AND asset_id=?",
                [$tokAmount, $addr, $holdingsAssetId]
            );
        } elseif ($holdingsAssetId === $singleId) {
            DB::execute(
                "UPDATE holdings SET silica_sto_balance = silica_sto_balance + ?, balance_token = balance_token + ?
                  WHERE address=? AND asset_id=?",
                [$tokAmount, $tokAmount, $addr, $holdingsAssetId]
            );
        } else {
            DB::execute(
                "UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?",
                [$tokAmount, $addr, $holdingsAssetId]
            );
        }

        // (2) 토큰 환불 wallet_transactions 행 INSERT — kind='withdraw_refund'
        //     symbol 표기는 원본 별칭 그대로 ('SilicaSTO' / 'Silica') — 사용자 친화적.
        $tokenSymbol = $tokAssetId;
        $refundMemo = 'refund_token_withdraw_req:' . $requestId . '|type:admin_cancel|reason:' . mb_substr($rejectReason, 0, 200);
        DB::execute(
            "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)",
            [$addr, 'withdraw_refund', '출금반환', $tokenSymbol, $tokAmount, $tokBefore, $tokAfter, null, $refundMemo, nowUtcSql()]
        );

        // (3) fee 환불 — USDT 라면 별도 wallet_transactions 행 추가.
        $feeRefund = adminTokenWithdrawFeeAmount($r);
        $feeAsset = adminTokenWithdrawFeeAsset($r);
        if ($feeRefund > 0 && strtoupper($feeAsset) === 'USDT') {
            DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?,0)", [$addr]);
            $bRow = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$addr]);
            $usdtBefore = (float)($bRow['usdt'] ?? 0);
            $usdtAfter = clamp6($usdtBefore + $feeRefund);
            DB::execute("UPDATE balances SET usdt=? WHERE address=?", [$usdtAfter, $addr]);
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$addr, 'withdraw_refund', '출금반환', 'USDT', $feeRefund, $usdtBefore, $usdtAfter, null,
                 'refund_token_withdraw_fee:' . $requestId . '|type:admin_cancel', nowUtcSql()]
            );
        }

        // (4) 원본 토큰 출금 wallet_transactions 행 status → '실패' + admin_note
        // (v683) USDT 출금 reject 와 동일하게 admin_note 컬럼에 reject_reason
        //   기록. 프론트엔드 history 가 admin_note 또는 memo 의 'reject_reason:'
        //   토큰을 파싱하여 '사유' 버튼으로 노출.
        if (!empty($r['wallet_tx_id'])) {
            $walletSet = ['status=?'];
            $walletParams = ['실패'];
            $hasAdminNote = false;
            try {
                $hasAdminNote = (int)DB::fetchValue(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wallet_transactions' AND COLUMN_NAME='admin_note'",
                    []
                ) > 0;
            } catch (Throwable $_) {}
            if ($hasAdminNote) {
                $walletSet[] = 'admin_note=?';
                $walletParams[] = 'reject_reason:' . mb_substr($rejectReason, 0, 200);
            } else {
                // admin_note 컬럼 없으면 memo 에 reject_reason 추가 (frontend
                // parseRejectInfo 가 memo 도 파싱).
                $existingMemo = (string)DB::fetchValue(
                    "SELECT memo FROM wallet_transactions WHERE id=?",
                    [(int)$r['wallet_tx_id']]
                );
                $newMemo = trim(($existingMemo ? $existingMemo . '|' : '')
                              . 'reject_reason:' . mb_substr($rejectReason, 0, 200), '|');
                $walletSet[] = 'memo=?';
                $walletParams[] = $newMemo;
            }
            $walletParams[] = (int)$r['wallet_tx_id'];
            DB::execute(
                "UPDATE wallet_transactions SET " . implode(', ', $walletSet) . " WHERE id=?",
                $walletParams
            );
        }

        // (2026-05-21 v701) 운영자 보고: STO 9 → 1출금/반려 → 10 (중복 환불 +1).
        //   원인: cancel endpoint 가 holdings 환불 + wallet_tx 생성하지만
        //   memo 에 'holdings_refund_fixed_v689:1' 마커를 빠뜨림.
        //   다음 admin 페이지 진입 시 runtime 의 heal-refunds 가 마커 부재로
        //   "환불 미반영" 으로 판단 → 다시 +amount 환불 → 중복.
        //   해결: cancel 시 마커를 즉시 메모에 추가 → heal 이 skip 하도록.
        // (2026-05-21 v703) v701 의 marker 가 heal 의 marker 와 동일 (둘 다
        //   'holdings_refund_fixed_v689:1') → correctDoubleRefunds 가 cancel
        //   환불도 'heal 환불 + cancel 환불 모두 발생' 으로 오인 → 정상 cancel
        //   에서 추가 차감 발생 (9 → 1출금/반려 → 7 사례).
        //   해결: cancel marker 를 별도 키 'cancel_refund_done_v703:1' 로 분리.
        //   heal 은 두 marker 중 하나라도 있으면 skip (backward compat).
        //   correctDoubleRefunds 는 v703 부터 disable.
        // (2026-05-21 v704) 'reject_reason' 키로 변경 — 프론트엔드 parseRejectInfo
        //   가 memo 내 'reject_reason:' 패턴을 매칭하므로 cancel_reason 키로는
        //   사유 버튼이 노출되지 않았음. 또한 reject_reason 컬럼이 없는 환경에서
        //   memo 만이 유일한 사유 저장소이므로 표준 키 사용 필수.
        $memo = adminTokenWithdrawAppendMemo((string)($r['memo'] ?? ''), [
            'reject_reason' => $rejectReason,
            'cancel_refund_done_v703' => '1',
        ]);
        adminTokenWithdrawUpdateRequest($requestId, [
            'status' => 'canceled',
            'memo' => $memo,
            'reject_reason' => $rejectReason,
            'reviewed_by' => $reviewer,
            'reviewed_at' => nowUtcSql(),
        ]);
        $pdo->commit();

        jsonOk(['request_id' => $requestId]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '취소 실패: ' . $e->getMessage());
    }
});
