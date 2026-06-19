<?php
/**
 * Admin Withdraw routes
 */

if (!function_exists('adminWithdrawTableExists')) {
    function adminWithdrawTableExists(string $table): bool {
        if (function_exists('adminDashTableExists')) return adminDashTableExists($table);
        try {
            return (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                [$table]
            ) > 0;
        } catch (Throwable $e) {
            error_log('admin withdraw tableExists fallback: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('adminWithdrawColumnExists')) {
    function adminWithdrawColumnExists(string $table, string $column): bool {
        if (function_exists('adminDashColumnExists')) return adminDashColumnExists($table, $column);
        try {
            return (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                [$table, $column]
            ) > 0;
        } catch (Throwable $e) {
            error_log('admin withdraw columnExists fallback: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('adminWithdrawColumnType')) {
    function adminWithdrawColumnType(string $table, string $column): string {
        try {
            return (string)(DB::fetchValue(
                "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
                [$table, $column]
            ) ?? '');
        } catch (Throwable $e) {
            error_log('admin withdraw columnType fallback: ' . $e->getMessage());
            return '';
        }
    }
}

if (!function_exists('adminWithdrawStatusSupported')) {
    function adminWithdrawStatusSupported(string $status): bool {
        $type = strtolower(adminWithdrawColumnType('withdraw_requests', 'status'));
        if ($type === '') return true;
        if (strpos($type, 'enum(') !== 0) return true;
        return strpos($type, "'" . strtolower($status) . "'") !== false;
    }
}

if (!function_exists('adminWithdrawSelectExpr')) {
    function adminWithdrawSelectExpr(string $tableAlias, string $column, string $fallbackSql = 'NULL', ?string $alias = null): string {
        $alias = $alias ?: $column;
        if (adminWithdrawColumnExists('withdraw_requests', $column)) {
            $qualified = ($tableAlias !== '' ? ($tableAlias . '.') : '') . $column;
            return "{$qualified} AS {$alias}";
        }
        return "{$fallbackSql} AS {$alias}";
    }
}

if (!function_exists('adminWithdrawMemoNum')) {
    function adminWithdrawMemoNum(?string $memo, $keys): float {
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

if (!function_exists('adminWithdrawMemoText')) {
    function adminWithdrawMemoText(?string $memo, $keys): string {
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

if (!function_exists('adminWithdrawFeeAmount')) {
    function adminWithdrawFeeAmount(array $row): float {
        $direct = isset($row['fee_amount']) ? (float)$row['fee_amount'] : NAN;
        if (is_finite($direct) && $direct > 0) return clamp6($direct);
        $memoFee = adminWithdrawMemoNum($row['memo'] ?? '', ['fee_amount', 'fee']);
        return clamp6(max(0, $memoFee));
    }
}

if (!function_exists('adminWithdrawNetAmount')) {
    function adminWithdrawNetAmount(array $row): float {
        $direct = isset($row['net_amount']) ? (float)$row['net_amount'] : NAN;
        if (is_finite($direct) && $direct > 0) return clamp6($direct);
        $memoNet = adminWithdrawMemoNum($row['memo'] ?? '', ['net_amount', 'net_amt', 'net']);
        if ($memoNet > 0) return clamp6($memoNet);
        return clamp6(max(0, (float)($row['amount'] ?? 0) - adminWithdrawFeeAmount($row)));
    }
}

if (!function_exists('adminWithdrawRejectReason')) {
    function adminWithdrawRejectReason(array $row): string {
        $direct = trim((string)($row['reject_reason'] ?? ''));
        if ($direct !== '') return $direct;
        return trim(adminWithdrawMemoText($row['memo'] ?? '', ['reject_reason', 'reason']));
    }
}

if (!function_exists('adminWithdrawDisplayStatusRaw')) {
    function adminWithdrawDisplayStatusRaw(string $raw): string {
        $status = strtolower(trim($raw));
        if (in_array($status, ['pending', 'processing'], true)) return '대기';
        if (in_array($status, ['done', 'sent'], true)) return '전송완료';
        if (in_array($status, ['rejected', 'failed', 'canceled', 'cancelled'], true)) return '반려';
        return $raw !== '' ? $raw : '-';
    }
}

if (!function_exists('adminWithdrawApplyStatusFilter')) {
    function adminWithdrawApplyStatusFilter(string $status, array &$where, array &$params): void {
        $status = strtolower(trim($status));
        if ($status === '' || $status === 'all') return;
        if ($status === 'pending') {
            $where[] = "LOWER(TRIM(r.status)) IN ('pending','processing')";
            return;
        }
        if (in_array($status, ['done', 'sent'], true)) {
            $where[] = "LOWER(TRIM(r.status)) IN ('done','sent')";
            return;
        }
        if (in_array($status, ['rejected', 'failed', 'canceled', 'cancelled'], true)) {
            $where[] = "LOWER(TRIM(r.status)) IN ('rejected','failed','canceled','cancelled')";
            return;
        }
        $where[] = 'LOWER(TRIM(r.status)) = ?';
        $params[] = $status;
    }
}

if (!function_exists('adminWithdrawRejectStatusValue')) {
    function adminWithdrawRejectStatusValue(): string {
        if (adminWithdrawStatusSupported('rejected')) return 'rejected';
        if (adminWithdrawStatusSupported('failed')) return 'failed';
        if (adminWithdrawStatusSupported('canceled')) return 'canceled';
        return 'failed';
    }
}

if (!function_exists('adminWithdrawDoneStatusValue')) {
    function adminWithdrawDoneStatusValue(): string {
        if (adminWithdrawStatusSupported('done')) return 'done';
        if (adminWithdrawStatusSupported('sent')) return 'sent';
        return 'done';
    }
}

if (!function_exists('adminWithdrawBuildMemo')) {
    function adminWithdrawBuildMemo(string $baseMemo, array $pairs): string {
        $memo = trim($baseMemo);
        foreach ($pairs as $key => $value) {
            $encoded = rawurlencode((string)$value);
            $memo .= ($memo !== '' ? '|' : '') . $key . ':' . $encoded;
        }
        return $memo;
    }
}

if (!function_exists('adminWithdrawRefundTotal')) {
    function adminWithdrawRefundTotal(array $requestRow): float {
        // USDT 출금 요청의 amount 는 요청 총수량(=플랫폼에서 실제 차감된 금액)입니다.
        return clamp6(max(0, (float)($requestRow['amount'] ?? 0)));
    }
}

if (!function_exists('adminWithdrawReviewSetSql')) {
    function adminWithdrawReviewSetSql(string $adminUser, ?string $reason, ?string $txid = null): array {
        $parts = [];
        $params = [];
        if (adminWithdrawColumnExists('withdraw_requests', 'reviewed_by')) {
            $parts[] = 'reviewed_by=?';
            $params[] = $adminUser;
        }
        if (adminWithdrawColumnExists('withdraw_requests', 'reviewed_at')) {
            $parts[] = 'reviewed_at=?';
            $params[] = nowUtcSql();
        }
        if ($reason !== null && adminWithdrawColumnExists('withdraw_requests', 'reject_reason')) {
            $parts[] = 'reject_reason=?';
            $params[] = $reason;
        }
        if ($txid !== null && adminWithdrawColumnExists('withdraw_requests', 'txid')) {
            $parts[] = 'txid=?';
            $params[] = $txid;
        }
        return [$parts, $params];
    }
}

// (2026-05-21 v717) 운영자 보고: admin/withdrawals 에는 pending request 존재
//   하지만 user/history 에서 보이지 않음. 원인: 과거 deposit_withdraw.php 의
//   wallet_tx INSERT 가 실패했거나 트랜잭션이 부분적으로만 commit 된 케이스.
//   해결: withdraw_requests 의 각 행마다 대응하는 wallet_transactions 의
//   원본 withdraw 행 존재 여부 체크 후 누락 시 retroactively INSERT.
//   매칭 기준: wallet_tx_id (있으면 직접 매칭) → 없으면 address+asset+amount+
//   nearby created_at fallback. status 는 request.status 에 매핑.
if (!function_exists('adminWithdrawHealMissingOriginWalletTx')) {
    function adminWithdrawHealMissingOriginWalletTx(): array {
        $diag = [
            'scanned' => 0,
            'inserted' => 0,
            'skipped_existing' => 0,
            'skipped_no_amount' => 0,
            'errors' => [],
            'details' => [],
        ];

        if (!adminWithdrawTableExists('withdraw_requests')) return $diag;

        // 컬럼 schema-adaptive
        $hasWalletTxId = adminWithdrawColumnExists('withdraw_requests', 'wallet_tx_id');
        $hasReviewedAt = adminWithdrawColumnExists('withdraw_requests', 'reviewed_at');

        $cols = ['id', 'address', 'to_address', 'amount', 'status', 'created_at'];
        if ($hasWalletTxId) $cols[] = 'wallet_tx_id';
        if ($hasReviewedAt) $cols[] = 'reviewed_at';

        try {
            $rows = DB::fetchAll(
                "SELECT " . implode(', ', $cols) . " FROM withdraw_requests"
            );
            $diag['scanned'] = count($rows);

            foreach ($rows as $r) {
                $reqId = (int)$r['id'];
                $addr = (string)($r['address'] ?? '');
                $amount = (float)($r['amount'] ?? 0);
                $reqStatus = strtolower(trim((string)($r['status'] ?? '')));
                $createdAt = (string)($r['created_at'] ?? '');

                if ($addr === '' || $amount <= 0) {
                    $diag['skipped_no_amount']++;
                    continue;
                }

                // 1) wallet_tx_id 직접 매칭
                $walletTxId = $hasWalletTxId ? (int)($r['wallet_tx_id'] ?? 0) : 0;
                if ($walletTxId > 0) {
                    $exists = (int)DB::fetchValue(
                        "SELECT COUNT(*) FROM wallet_transactions WHERE id=? AND address=?",
                        [$walletTxId, $addr]
                    );
                    if ($exists > 0) {
                        $diag['skipped_existing']++;
                        continue;
                    }
                }

                // 2) address+asset(USDT)+amount+kind='withdraw' fallback 매칭
                //    created_at 근방 (±10분) 범위로 안전 매칭.
                $fallbackExists = (int)DB::fetchValue(
                    "SELECT COUNT(*) FROM wallet_transactions "
                    . " WHERE address=? AND kind='withdraw' AND asset='USDT' "
                    . "   AND ABS(amount - ?) < 0.000001 "
                    . "   AND ABS(TIMESTAMPDIFF(MINUTE, created_at, ?)) <= 10",
                    [$addr, $amount, $createdAt]
                );
                if ($fallbackExists > 0) {
                    $diag['skipped_existing']++;
                    continue;
                }

                // 3) 누락 — INSERT
                // wallet_tx status 매핑: pending → '출금신청', processing → '처리중',
                //   done → '출금완료', rejected/canceled → '실패', failed → '실패'
                $wtxStatus = '출금신청';
                if ($reqStatus === 'processing') $wtxStatus = '출금신청';
                elseif ($reqStatus === 'done') $wtxStatus = '출금완료';
                elseif (in_array($reqStatus, ['rejected', 'canceled', 'cancelled', 'failed'], true)) $wtxStatus = '실패';

                $heallMemo = 'origin_withdraw_req:' . $reqId . '|type:audit_heal_v717';
                try {
                    DB::execute(
                        "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at) "
                        . " VALUES (?,?,?,?,?,?,?,?,?,?)",
                        [$addr, 'withdraw', $wtxStatus, 'USDT', $amount, 0, 0, null, $heallMemo, $createdAt ?: nowUtcSql()]
                    );
                    $newId = (int)DB::pdo()->lastInsertId();
                    // wallet_tx_id 백필
                    if ($hasWalletTxId && $newId > 0) {
                        try {
                            DB::execute("UPDATE withdraw_requests SET wallet_tx_id=? WHERE id=?", [$newId, $reqId]);
                        } catch (Throwable $_) {}
                    }
                    $diag['inserted']++;
                    $diag['details'][] = [
                        'req_id' => $reqId,
                        'address' => substr($addr, 0, 12),
                        'amount' => $amount,
                        'status' => $wtxStatus,
                        'new_wallet_tx_id' => $newId,
                    ];
                } catch (Throwable $e) {
                    $diag['errors'][] = "req_id={$reqId}: " . $e->getMessage();
                }
            }
        } catch (Throwable $e) {
            $diag['errors'][] = $e->getMessage();
        }
        return $diag;
    }
}

// 수동 트리거 endpoint
post('/api/admin/withdraw/heal-origin-wtx', function () {
    adminAuth();
    $diag = adminWithdrawHealMissingOriginWalletTx();
    jsonOk(['diag' => $diag]);
});

// admin 페이지 진입 시 자동 호출
get('/api/admin/withdraw/runtime', function () {
    adminAuth();
    $healDiag = adminWithdrawHealMissingOriginWalletTx();
    jsonOk(['heal_diag' => $healDiag]);
});

get('/api/admin/withdraw/requests', function () {
    adminAuth();
    $status = trim($_GET['status'] ?? '');
    $q = trim($_GET['q'] ?? '');
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 100)));

    if (!adminWithdrawTableExists('withdraw_requests')) {
        jsonOk(['rows' => []]);
    }

    $where = [];
    $params = [];

    adminWithdrawApplyStatusFilter($status, $where, $params);
    if ($q !== '') {
        $where[] = '(r.address LIKE ? OR r.to_address LIKE ?)';
        $params[] = "%{$q}%";
        $params[] = "%{$q}%";
    }

    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
    $select = [
        'r.id',
        'r.wallet_tx_id',
        'r.address',
        'r.to_address',
        adminWithdrawSelectExpr('r', 'asset', "'USDT'", 'asset'),
        'r.amount',
        'r.status',
        'r.txid',
        adminWithdrawSelectExpr('r', 'fee_mode', 'NULL', 'fee_mode'),
        adminWithdrawSelectExpr('r', 'fee_value', 'NULL', 'fee_value'),
        adminWithdrawSelectExpr('r', 'fee_amount', 'NULL', 'fee_amount'),
        adminWithdrawSelectExpr('r', 'net_amount', 'NULL', 'net_amount'),
        adminWithdrawSelectExpr('r', 'reject_reason', 'NULL', 'reject_reason'),
        adminWithdrawSelectExpr('r', 'reviewed_by', 'NULL', 'reviewed_by'),
        adminWithdrawSelectExpr('r', 'reviewed_at', 'NULL', 'reviewed_at'),
        'r.memo',
        'r.created_at',
        'r.updated_at',
    ];

    $rows = [];
    try {
        $rows = DB::fetchAll(
            "SELECT " . implode(",\n                ", $select) . "\n"
            . "FROM withdraw_requests r\n"
            . "{$whereSql}\n"
            . "ORDER BY r.id DESC\n"
            . "LIMIT {$limit}",
            $params
        );
    } catch (Throwable $e) {
        error_log('admin withdraw requests query failed: ' . $e->getMessage());
        jsonOk(['rows' => []]);
    }

    foreach ($rows as &$row) {
        $row['fee_amount'] = adminWithdrawFeeAmount($row);
        $row['net_amount'] = adminWithdrawNetAmount($row);
        $row['reject_reason'] = adminWithdrawRejectReason($row);
        $row['display_status'] = adminWithdrawDisplayStatusRaw((string)($row['status'] ?? ''));
    }
    unset($row);

    jsonOk(['rows' => $rows]);
});

post('/api/admin/withdraw/send', function () {
    // (2026-05-21 보안감사) Was adminAuth() — JWT only.
    //   감사관 (ChatGPT) 보고: 'USDT 송금 broadcast 가 wallet 화이트리스트 검사를
    //   우회. adminAuth() 는 JWT 만 확인하고 v583 화이트리스트 검증 안 함.'
    //   adminOnly() 로 교체 — JWT + ADMIN_KEY fallback + ADMIN_WALLET_ADDRESSES
    //   화이트리스트 + (regex 일치 시) Phantom header 검증 모두 적용.
    //   참조 precedent: admin_silica_dividend.php:293 의 v309 동일 패치.
    $admin = adminOnly();
    $body = getJsonBody();

    try {
        verifyAdminOtpOrThrow($body['otp'] ?? '');
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }

    $requestId = (int)($body['request_id'] ?? 0);
    if ($requestId <= 0) jsonError(400, 'request_id 필요');

    $signedTxBase64 = trim((string)($body['signedTxBase64'] ?? ''));
    if ($signedTxBase64 === '') jsonError(400, 'signedTxBase64 필요');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $r = DB::fetchOne("SELECT * FROM withdraw_requests WHERE id=? FOR UPDATE", [$requestId]);
        if (!$r) {
            $pdo->rollBack();
            jsonError(404, '요청을 찾을 수 없습니다.');
        }

        $rawStatus = strtolower(trim((string)($r['status'] ?? '')));
        if (in_array($rawStatus, ['done', 'sent'], true)) {
            $pdo->commit();
            jsonOk(['request_id' => $requestId, 'txid' => $r['txid'] ?? null, 'duplicated' => true]);
        }
        if (in_array($rawStatus, ['rejected', 'failed', 'canceled', 'cancelled'], true)) {
            $pdo->rollBack();
            jsonError(409, '반려된 요청은 전송할 수 없습니다.');
        }
        // ★ 이중출금 방지: 'pending' 만 허용 ('processing' 은 잠금 상태)
        if ($rawStatus !== 'pending') {
            $pdo->rollBack();
            jsonError(409, "처리 불가 상태: {$rawStatus} — processing/done 은 재전송 차단");
        }

        $wtx = DB::fetchOne("SELECT * FROM wallet_transactions WHERE id=? FOR UPDATE", [$r['wallet_tx_id']]);
        if (!$wtx) {
            $pdo->rollBack();
            jsonError(400, 'wallet_tx_id가 유효하지 않습니다.');
        }

        $wtxKind = trim((string)($wtx['kind'] ?? ''));
        $wtxStatus = trim((string)($wtx['status'] ?? ''));
        if ($wtxKind !== 'withdraw') {
            $pdo->rollBack();
            jsonError(400, "wallet_transactions kind 불일치: {$wtxKind}");
        }
        if (!in_array($wtxStatus, ['출금신청', 'pending', 'processing'], true)) {
            $pdo->rollBack();
            jsonError(409, "wallet_transactions 상태 불일치: {$wtxStatus}");
        }
        if (($wtx['address'] ?? '') !== ($r['address'] ?? '')) {
            $pdo->rollBack();
            jsonError(400, '요청/거래 주소가 일치하지 않습니다.');
        }
        if (abs((float)($wtx['amount'] ?? 0) - (float)($r['amount'] ?? 0)) > 0.000001) {
            $pdo->rollBack();
            jsonError(400, '요청/거래 수량이 일치하지 않습니다.');
        }

        if ($rawStatus === 'pending') {
            $sets = ['status=?'];
            $setParams = ['processing'];
            [$reviewParts, $reviewParams] = adminWithdrawReviewSetSql((string)($admin['username'] ?? 'admin'), null);
            if ($reviewParts) {
                $sets = array_merge($sets, $reviewParts);
                $setParams = array_merge($setParams, $reviewParams);
            }
            $setParams[] = $requestId;
            DB::execute("UPDATE withdraw_requests SET " . implode(', ', $sets) . " WHERE id=?", $setParams);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, 'processing_mark_failed: ' . $e->getMessage());
    }

    // ★ 이중출금 방지: $sig 변수 try 블록 밖 선언
    //    $sig 가 set 되면 = 체인 전송됨, throw 가 발생해도 'pending' 으로 되돌리면 안 됨
    $sig = null;
    try {
        $sig = sendRawTransaction($signedTxBase64);
        if (!$sig) throw new RuntimeException('트랜잭션 전송 실패 — sig 미생성');

        $ptx = getParsedTxRetry($sig);
        $feeLamports = (int)($ptx['meta']['fee'] ?? 0);

        $pdo->beginTransaction();
        try {
            $r2 = DB::fetchOne("SELECT * FROM withdraw_requests WHERE id=? FOR UPDATE", [$requestId]);
            if (!$r2) {
                $pdo->rollBack();
                jsonError(404, '요청을 찾을 수 없습니다.');
            }
            $currentStatus = strtolower(trim((string)($r2['status'] ?? '')));
            if (in_array($currentStatus, ['done', 'sent'], true)) {
                $pdo->commit();
                jsonOk(['request_id' => $requestId, 'txid' => $r2['txid'] ?? $sig, 'duplicated' => true]);
            }
            if (!in_array($currentStatus, ['pending', 'processing'], true)) {
                $pdo->rollBack();
                jsonError(409, '전송 완료 처리 중 상태가 변경되었습니다.');
            }

            $finalStatus = adminWithdrawDoneStatusValue();
            $sets = ['status=?'];
            $setParams = [$finalStatus];
            [$reviewParts, $reviewParams] = adminWithdrawReviewSetSql((string)($admin['username'] ?? 'admin'), null, $sig);
            if ($reviewParts) {
                $sets = array_merge($sets, $reviewParts);
                $setParams = array_merge($setParams, $reviewParams);
            }
            $setParams[] = $requestId;
            DB::execute("UPDATE withdraw_requests SET " . implode(', ', $sets) . " WHERE id=?", $setParams);

            $walletSet = ['status=?', 'txid=?', 'network_fee_lamports=?'];
            $walletParams = ['출금완료', $sig, $feeLamports];
            if (adminWithdrawColumnExists('wallet_transactions', 'admin_note')) {
                $walletSet[] = 'admin_note=?';
                $walletParams[] = 'admin_send';
            }
            $walletParams[] = $r2['wallet_tx_id'];
            DB::execute("UPDATE wallet_transactions SET " . implode(', ', $walletSet) . " WHERE id=?", $walletParams);

            $pdo->commit();
            jsonOk([
                'request_id' => $requestId,
                'txid' => $sig,
                'network_fee_lamports' => $feeLamports,
                'net_amount' => adminWithdrawNetAmount($r2),
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            jsonError(500, 'finalize_failed: ' . $e->getMessage());
        }
    } catch (Throwable $e) {
        // ★ 이중출금 방지 핵심 분기:
        if ($sig) {
            // ── A. 체인 전송됐음 → 절대 'pending' 으로 되돌리지 않음
            //    'processing' 유지 + sig 를 txid 컬럼에 저장 (관리자가 Solscan 검증 후 수동완료)
            try {
                $existing = DB::fetchOne("SELECT memo FROM withdraw_requests WHERE id=?", [$requestId]);
                $memo = adminWithdrawBuildMemo((string)($existing['memo'] ?? ''), [
                    'send_uncertain' => substr($e->getMessage(), 0, 180),
                    'pending_sig'    => $sig,
                ]);
                DB::execute(
                    "UPDATE withdraw_requests SET status='processing', txid=?, memo=? WHERE id=?",
                    [$sig, $memo, $requestId]
                );
            } catch (Throwable $ignore) {}
            jsonError(409, sprintf(
                '체인 전송 가능성 — 재전송 금지. Solscan 에서 시그니처 [%s] 확인 후 수동완료 처리하세요. 원인: %s',
                $sig,
                $e->getMessage()
            ));
        } else {
            // ── B. 체인 미전송 ($sig 없음) → 'pending' 으로 안전 복귀
            try {
                $existing = DB::fetchOne("SELECT memo FROM withdraw_requests WHERE id=?", [$requestId]);
                $memo = adminWithdrawBuildMemo((string)($existing['memo'] ?? ''), ['send_error' => substr($e->getMessage(), 0, 180)]);
                DB::execute("UPDATE withdraw_requests SET status='pending', memo=? WHERE id=?", [$memo, $requestId]);
            } catch (Throwable $ignore) {}
            jsonError(400, $e->getMessage());
        }
    }
});

// ================================================================
// ★ USDT 출금 수동 완료 처리 (manual-complete)
// 시나리오: send 가 catch 에서 'processing' + sig 저장 상태로 멈춤
//          관리자가 Solscan 에서 sig confirm 됨을 확인 후 이 엔드포인트로 done 처리
// 안전장치: 체인에서 txid 의 실재 여부를 RPC 로 한 번 더 검증
// ================================================================
post('/api/admin/withdraw/manual-complete', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    try { verifyAdminOtpOrThrow($body['otp'] ?? ''); }
    catch (Throwable $e) { jsonError(400, $e->getMessage()); }

    $requestId = (int)($body['request_id'] ?? 0);
    $txid = trim((string)($body['txid'] ?? ''));
    if ($requestId <= 0) jsonError(400, 'request_id 필요');
    if ($txid === '')    jsonError(400, 'txid 필요');

    $reviewer = (string)($admin['username'] ?? 'admin');

    // 체인에서 txid 실재 여부 검증
    try {
        $info = getParsedTxRetry($txid);
        if (!$info) throw new RuntimeException('체인에서 트랜잭션을 찾을 수 없음');
    } catch (Throwable $e) {
        jsonError(400, 'txid 체인 검증 실패: ' . $e->getMessage());
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $r = DB::fetchOne("SELECT * FROM withdraw_requests WHERE id=? FOR UPDATE", [$requestId]);
        if (!$r) {
            $pdo->rollBack();
            jsonError(404, '요청 없음');
        }
        $status = strtolower(trim((string)($r['status'] ?? '')));
        if (in_array($status, ['done', 'sent'], true)) {
            $pdo->commit();
            jsonOk(['request_id' => $requestId, 'txid' => $r['txid'] ?? $txid, 'duplicated' => true]);
        }
        if (!in_array($status, ['pending', 'processing'], true)) {
            $pdo->rollBack();
            jsonError(409, '수동완료 가능 상태 아님: ' . ($r['status'] ?? '-'));
        }

        $finalStatus = adminWithdrawDoneStatusValue();
        $memo = adminWithdrawBuildMemo((string)($r['memo'] ?? ''), [
            'manual_complete' => '1',
            'completed_by'    => $reviewer,
        ]);

        $sets = ['status=?', 'memo=?'];
        $setParams = [$finalStatus, $memo];
        [$reviewParts, $reviewParams] = adminWithdrawReviewSetSql($reviewer, null, $txid);
        if ($reviewParts) {
            $sets = array_merge($sets, $reviewParts);
            $setParams = array_merge($setParams, $reviewParams);
        }
        $setParams[] = $requestId;
        DB::execute("UPDATE withdraw_requests SET " . implode(', ', $sets) . " WHERE id=?", $setParams);

        // wallet_transactions 도 업데이트
        if (!empty($r['wallet_tx_id'])) {
            $walletSet = ['status=?', 'txid=?'];
            $walletParams = ['출금완료', $txid];
            if (adminWithdrawColumnExists('wallet_transactions', 'admin_note')) {
                $walletSet[] = 'admin_note=?';
                $walletParams[] = 'manual_complete';
            }
            $walletParams[] = $r['wallet_tx_id'];
            DB::execute("UPDATE wallet_transactions SET " . implode(', ', $walletSet) . " WHERE id=?", $walletParams);
        }

        $pdo->commit();
        jsonOk(['request_id' => $requestId, 'txid' => $txid, 'manual' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '수동완료 처리 실패: ' . $e->getMessage());
    }
});

post('/api/admin/withdraw/reject', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    try {
        verifyAdminOtpOrThrow($body['otp'] ?? '');
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }

    $requestId = (int)($body['request_id'] ?? 0);
    $reason = trim((string)($body['reason'] ?? ''));
    if ($requestId <= 0) jsonError(400, 'request_id 필요');
    if ($reason === '') jsonError(400, '반려 사유를 입력하세요.');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $r = DB::fetchOne("SELECT * FROM withdraw_requests WHERE id=? FOR UPDATE", [$requestId]);
        if (!$r) {
            $pdo->rollBack();
            jsonError(404, '요청을 찾을 수 없습니다.');
        }

        $rawStatus = strtolower(trim((string)($r['status'] ?? '')));
        if (in_array($rawStatus, ['done', 'sent'], true)) {
            $pdo->rollBack();
            jsonError(409, '전송완료된 요청은 반려할 수 없습니다.');
        }
        if (in_array($rawStatus, ['rejected', 'failed', 'canceled', 'cancelled'], true)) {
            $pdo->commit();
            jsonOk([
                'request_id' => $requestId,
                'refund_amount' => 0,
                'duplicated' => true,
                'display_status' => '반려',
            ]);
        }
        if (!in_array($rawStatus, ['pending', 'processing'], true)) {
            $pdo->rollBack();
            jsonError(409, '반려 가능한 상태가 아닙니다.');
        }

        $wtx = DB::fetchOne("SELECT * FROM wallet_transactions WHERE id=? FOR UPDATE", [$r['wallet_tx_id']]);
        if (!$wtx) {
            $pdo->rollBack();
            jsonError(400, 'wallet_tx_id가 유효하지 않습니다.');
        }
        if (trim((string)($wtx['kind'] ?? '')) !== 'withdraw') {
            $pdo->rollBack();
            jsonError(400, 'wallet_transactions kind 불일치');
        }
        if (trim((string)($wtx['status'] ?? '')) === '출금완료') {
            $pdo->rollBack();
            jsonError(409, '이미 전송완료된 출금입니다.');
        }

        $address = (string)($r['address'] ?? '');
        ensureUser($address);

        DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?, 0)", [$address]);
        $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
        $beforeAmt = (float)($bal['usdt'] ?? 0);
        $refundTotal = adminWithdrawRefundTotal($r);
        $afterAmt = clamp6($beforeAmt + $refundTotal);
        DB::execute("UPDATE balances SET usdt=? WHERE address=?", [$afterAmt, $address]);

        $refundMemo = adminWithdrawBuildMemo("refund_withdraw_req:{$requestId}", [
            'type' => 'admin_reject',
            'reason' => $reason,
        ]);
        // (2026-05-20 v676) 운영자 요청 — 관리자 거절로 인한 환불은 'deposit'
        //   (입금) 으로 표기하면 외부 자금 유입처럼 보여 사용자 혼란.
        //   kind='withdraw_refund' + status='출금반환' 으로 명시화하여 자기
        //   출금 신청의 환불임을 분명히 표시.
        //   회계상 외부 입금 vs 내부 환불 분리 → AML/감사 트레일 명확.
        DB::execute(
            "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            [$address, 'withdraw_refund', '출금반환', 'USDT', $refundTotal, $beforeAmt, $afterAmt, null, $refundMemo, nowUtcSql()]
        );

        $requestMemo = adminWithdrawBuildMemo((string)($r['memo'] ?? ''), ['reject_reason' => $reason]);
        $requestStatus = adminWithdrawRejectStatusValue();
        $reqSet = ['status=?', 'memo=?'];
        $reqParams = [$requestStatus, $requestMemo];
        [$reviewParts, $reviewParams] = adminWithdrawReviewSetSql((string)($admin['username'] ?? 'admin'), $reason);
        if ($reviewParts) {
            $reqSet = array_merge($reqSet, $reviewParts);
            $reqParams = array_merge($reqParams, $reviewParams);
        }
        $reqParams[] = $requestId;
        DB::execute("UPDATE withdraw_requests SET " . implode(', ', $reqSet) . " WHERE id=?", $reqParams);

        $walletSet = ['status=?'];
        $walletParams = ['실패'];
        if (adminWithdrawColumnExists('wallet_transactions', 'admin_note')) {
            $walletSet[] = 'admin_note=?';
            $walletParams[] = 'reject_reason:' . mb_substr($reason, 0, 200);
        }
        $walletParams[] = $r['wallet_tx_id'];
        DB::execute("UPDATE wallet_transactions SET " . implode(', ', $walletSet) . " WHERE id=?", $walletParams);

        $pdo->commit();
        jsonOk([
            'request_id' => $requestId,
            'refund_amount' => $refundTotal,
            'display_status' => '반려',
            'reason' => $reason,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, 'reject_failed: ' . $e->getMessage());
    }
});

post('/api/admin/withdraw/cancel', function () {
    adminAuth();
    $body = getJsonBody();

    try {
        verifyAdminOtpOrThrow($body['otp'] ?? '');
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }

    $requestId = (int)($body['request_id'] ?? 0);
    if ($requestId <= 0) jsonError(400, 'request_id 필요');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $r = DB::fetchOne("SELECT * FROM withdraw_requests WHERE id=? FOR UPDATE", [$requestId]);
        if (!$r) {
            $pdo->rollBack();
            jsonError(404, '요청 없음');
        }
        if (!in_array(strtolower(trim((string)($r['status'] ?? ''))), ['pending', 'processing'], true)) {
            $pdo->rollBack();
            jsonError(400, '취소 불가 상태');
        }

        $address = (string)($r['address'] ?? '');
        ensureUser($address);
        DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?, 0)", [$address]);
        $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
        $beforeAmt = (float)($bal['usdt'] ?? 0);
        $refundTotal = adminWithdrawRefundTotal($r);
        $afterAmt = clamp6($beforeAmt + $refundTotal);
        DB::execute("UPDATE balances SET usdt=? WHERE address=?", [$afterAmt, $address]);

        // (2026-05-20 v676) admin cancel 환불도 withdraw_refund 로 명시.
        DB::execute(
            "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            [$address, 'withdraw_refund', '출금반환', 'USDT', $refundTotal, $beforeAmt, $afterAmt, 'refund_withdraw_req:' . $requestId . '|type:admin_cancel', nowUtcSql()]
        );

        DB::execute("UPDATE withdraw_requests SET status='canceled', memo=? WHERE id=?", [trim((string)($body['reason'] ?? 'admin_cancel')), $requestId]);
        DB::execute("UPDATE wallet_transactions SET status='출금취소' WHERE id=?", [$r['wallet_tx_id']]);

        $pdo->commit();
        jsonOk(['request_id' => $requestId, 'refund_amount' => $refundTotal]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, 'cancel_failed: ' . $e->getMessage());
    }
});

post('/api/admin/withdraw/fail', function () {
    adminAuth();
    $body = getJsonBody();

    try {
        verifyAdminOtpOrThrow($body['otp'] ?? '');
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }

    $requestId = (int)($body['request_id'] ?? 0);
    if ($requestId <= 0) jsonError(400, 'request_id 필요');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $r = DB::fetchOne("SELECT * FROM withdraw_requests WHERE id=? FOR UPDATE", [$requestId]);
        if (!$r) {
            $pdo->rollBack();
            jsonError(404, '요청 없음');
        }
        if (!in_array(strtolower(trim((string)($r['status'] ?? ''))), ['pending', 'processing'], true)) {
            $pdo->rollBack();
            jsonError(400, '실패 처리 불가 상태');
        }

        $address = (string)($r['address'] ?? '');
        ensureUser($address);
        DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?, 0)", [$address]);
        $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
        $beforeAmt = (float)($bal['usdt'] ?? 0);
        $refundTotal = adminWithdrawRefundTotal($r);
        $afterAmt = clamp6($beforeAmt + $refundTotal);
        DB::execute("UPDATE balances SET usdt=? WHERE address=?", [$afterAmt, $address]);

        // (2026-05-20 v676) admin fail 환불도 withdraw_refund 로 명시.
        DB::execute(
            "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            [$address, 'withdraw_refund', '출금반환', 'USDT', $refundTotal, $beforeAmt, $afterAmt, 'refund_withdraw_req:' . $requestId . '|type:admin_fail', nowUtcSql()]
        );

        DB::execute("UPDATE withdraw_requests SET status='failed', memo=? WHERE id=?", [trim((string)($body['reason'] ?? 'admin_fail')), $requestId]);
        DB::execute("UPDATE wallet_transactions SET status='실패' WHERE id=?", [$r['wallet_tx_id']]);

        $pdo->commit();
        jsonOk(['request_id' => $requestId, 'refund_amount' => $refundTotal]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, 'fail_mark_failed: ' . $e->getMessage());
    }
});

get('/api/admin/wallet/transactions', function () {
    adminAuth();
    $kind = trim($_GET['kind'] ?? '');
    $status = trim($_GET['status'] ?? '');
    $asset = trim($_GET['asset'] ?? '');
    $q = trim($_GET['q'] ?? '');
    $limit = min(300, max(1, (int)($_GET['limit'] ?? 200)));

    $where = [];
    $params = [];

    if ($kind) {
        $where[] = 't.kind=?';
        $params[] = $kind;
    }
    if ($status) {
        $where[] = 't.status=?';
        $params[] = $status;
    }
    if ($asset && strtolower($asset) !== 'all') {
        $where[] = "COALESCE(t.asset,'')=?";
        $params[] = $asset;
    }
    if ($q) {
        $where[] = '(t.address LIKE ? OR t.txid LIKE ? OR t.memo LIKE ?)';
        $params[] = "%{$q}%";
        $params[] = "%{$q}%";
        $params[] = "%{$q}%";
    }

    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $rows = DB::fetchAll(
        "SELECT t.id, t.address, t.kind, t.status, t.asset,
                t.amount, t.before_amount, t.after_amount,
                t.txid, t.network_fee_lamports, t.memo, t.created_at
         FROM wallet_transactions t
         {$whereSql}
         ORDER BY t.id DESC
         LIMIT {$limit}",
        $params
    );

    jsonOk(['rows' => $rows]);
});
