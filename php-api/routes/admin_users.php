<?php
/**
 * Admin user management routes
 */

get('/api/admin/users/list', function () {
    adminOnly();

    // (2026-05-21 v734) 운영자 보고: 유저 리스트의 출금 대기 합계가 user history
    //   상의 'WITHDRAW REQUESTED' 행 수와 불일치 (예: 2 행 보이는데 1 STO 만
    //   집계). 원인: token_withdraw_requests 가 canceled 상태인데 대응하는
    //   wallet_transactions 가 stale '출금신청' 상태로 남음. sync 함수가
    //   admin/token-withdrawals.html 진입 시에만 실행되어 users 페이지에서는
    //   stale 데이터가 표출됨.
    // 해결: users/list 호출 시 sync 자동 실행 (idempotent, 부담 적음).
    if (function_exists('adminTokenWithdrawSyncStaleWalletTx')) {
        try { adminTokenWithdrawSyncStaleWalletTx(true); } catch (Throwable $_) {}
    }

    $q = trim($_GET['q'] ?? '');
    $limit = min(300, max(1, (int)($_GET['limit'] ?? 100)));

    $where = [];
    $params = [];
    if ($q !== '') {
        $where[] = 'u.address LIKE ?';
        $params[] = "%{$q}%";
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    // (2026-05-18 v579) 운영자 요청: '유저 목록에 KYC 인증/미인증/진행중/실패
    //   4가지 컬러칩 표시.' kyc_status 컬럼을 함께 반환 → 프론트에서
    //   kyc_yn + kyc_status 조합으로 4-state 매핑.
    // (2026-05-21 v721) 운영자 요청 — 유저 리스트의 USDT / 토큰 수량은 출금
    //   대기 중인 것을 포함해야 함. balances/holdings 에서는 이미 차감된
    //   상태이므로 pending 합계를 별도 sub-query 로 SUM 한 후 frontend 에서
    //   합산 표시. 별도 필드로 노출하여 운영자가 'X (대기 Y 포함)' 식으로
    //   세분 확인 가능.
    // (2026-05-21 v736) Silica 컬럼 신규 추가 — 기존엔 SilicaSTO 만 반영되어
    //   Silica 보유/대기 가 유저 리스트에서 invisible 이었음.
    //     silica_balance_total      : holdings.silica_balance 합계
    //     pending_withdraw_silica_amount : token_withdraw_requests asset_id='Silica'
    $rows = DB::fetchAll(
        "SELECT u.address, u.created_at, u.kyc_yn, u.kyc_status, u.mt_name,
                COALESCE(b.usdt,0) AS usdt,
                " . userControlSelectExpr('u', 'is_suspended', '0', true) . ",
                " . userControlSelectExpr('u', 'withdraw_suspended', '0', true) . ",
                (SELECT COALESCE(SUM(h.balance_token + h.staked_token),0) FROM holdings h WHERE h.address=u.address) AS token_total,
                (SELECT COALESCE(SUM(h.staked_token),0) FROM holdings h WHERE h.address=u.address) AS staked_total,
                -- (v736) Silica 보유 총량 (holdings.silica_balance SUM)
                (SELECT COALESCE(SUM(h.silica_balance),0) FROM holdings h WHERE h.address=u.address) AS silica_balance_total,
                (SELECT COUNT(*) FROM orders o WHERE o.maker_address=u.address AND o.status='open') AS open_orders,
                (SELECT COUNT(*) FROM withdraw_requests wr WHERE wr.address=u.address AND wr.status IN ('pending','processing')) AS pending_withdrawals,
                (SELECT COUNT(*) FROM token_withdraw_requests tr WHERE tr.address=u.address AND tr.status IN ('pending','processing')) AS pending_token_withdrawals,
                -- (v721) USDT 출금 대기 합계 (amount)
                (SELECT COALESCE(SUM(wr2.amount),0) FROM withdraw_requests wr2
                  WHERE wr2.address=u.address AND LOWER(TRIM(wr2.status)) IN ('pending','processing')) AS pending_withdraw_usdt_amount,
                -- (v721) STO 출금 대기 합계 (SilicaSTO + SILICA-79907)
                (SELECT COALESCE(SUM(tr2.amount_token),0) FROM token_withdraw_requests tr2
                  WHERE tr2.address=u.address
                    AND LOWER(TRIM(tr2.status)) IN ('pending','processing')
                    AND tr2.asset_id IN ('SilicaSTO', 'SILICA-79907')) AS pending_withdraw_sto_amount,
                -- (v736) Silica 출금 대기 합계 (asset_id='Silica')
                (SELECT COALESCE(SUM(tr3.amount_token),0) FROM token_withdraw_requests tr3
                  WHERE tr3.address=u.address
                    AND LOWER(TRIM(tr3.status)) IN ('pending','processing')
                    AND tr3.asset_id = 'Silica') AS pending_withdraw_silica_amount
         FROM users u
         LEFT JOIN balances b ON b.address = u.address
         {$whereSql}
         ORDER BY u.created_at DESC
         LIMIT {$limit}",
        $params
    );

    foreach ($rows as &$row) {
        $row['name'] = decodeMaybeStoredText($row['mt_name'] ?? null);
        $ctrl = resolveUserControlStatus((string)($row['address'] ?? ''), $row);
        $row['is_suspended'] = !empty($ctrl['is_suspended']);
        $row['withdraw_suspended'] = !empty($ctrl['withdraw_suspended']);
    }
    unset($row);

    jsonOk(['users' => $rows]);
});

// (2026-05-06) 공개 진단 엔드포인트 — 인증 불필요.
// 어드민 토큰 없이도 브라우저 주소창에서 직접 조회 가능. address 가 지정되어야 하며,
// 해당 주소의 holdings 와 funding_records 합계만 반환 (지갑 주소는 어차피 온체인 공개,
// 토큰 잔량도 SPL RPC 로 공개 조회 가능 — 추가 노출 위험 적음).
//   GET /api/holdings-diag?address=7oWYGT...
get('/api/holdings-diag', function () {
    $address = trim($_GET['address'] ?? '');
    if ($address === '') jsonError(400, 'address 파라미터 필수');
    $rows = [];
    try {
        $rows = DB::fetchAll(
            "SELECT h.address, h.asset_id,
                    h.balance_token, h.staked_token, h.claimed_token,
                    h.silica_sto_balance, h.silica_sto_staked,
                    (h.balance_token + h.staked_token) AS legacy_total,
                    CASE
                        WHEN h.silica_sto_balance != (h.balance_token + h.staked_token) THEN 'TOTAL_MISMATCH'
                        WHEN h.silica_sto_staked  != h.staked_token                     THEN 'STAKED_MISMATCH'
                        ELSE 'ok'
                    END AS status,
                    (SELECT COALESCE(SUM(amount_usdt),0) FROM funding_records fr WHERE fr.address=h.address AND fr.asset_id=h.asset_id) AS confirmed_funded_usdt
               FROM holdings h
              WHERE h.address = ?
              ORDER BY h.asset_id",
            [$address]
        );
    } catch (Throwable $e) {
        error_log('holdings-diag (public) failed: ' . $e->getMessage());
    }
    jsonOk(['rows' => $rows, 'count' => count($rows)]);
});

// (2026-05-06) Holdings 진단 — 특정 유저의 silica_sto_* / legacy 컬럼 정합성 점검 + 즉시 복구.
// 사용 예:
//   GET  /api/admin/holdings-diag?address=0xabc...     → 진단(어드민 인증, 전체 row 조회)
//   POST /api/admin/holdings-reconcile                 → 전체 재정합 (db.php boot 과 동일 로직 1회 즉시)
get('/api/admin/holdings-diag', function () {
    adminOnly();
    $address = trim($_GET['address'] ?? '');
    $where = $address !== '' ? 'WHERE h.address = ?' : '';
    $params = $address !== '' ? [$address] : [];
    // (2026-05-18 v538) 운영자: 'swap 으로 SilicaSTO 받은 유저가 DRIFT 로
    //   오판된다'. 원인: 기존 검사식이 claimed === balance+staked 만 보고
    //   swap 유입을 무시. claimed_token 은 회계 의미상 'STO 펀딩 분배 누적'
    //   만 추적하고, swap_in 으로 들어온 SilicaSTO 는 별도. 진단 응답에
    //   swap_in_sto / refunded_usdt 컬럼 추가 → 프론트 검사식이 이를 합산해
    //   비교. 결과로 swap 유저의 false positive DRIFT 제거.
    $rows = DB::fetchAll(
        "SELECT h.address, h.asset_id,
                h.balance_token, h.staked_token, h.claimed_token,
                h.silica_sto_balance, h.silica_sto_staked,
                (h.balance_token + h.staked_token) AS legacy_total,
                CASE
                    WHEN h.silica_sto_balance != (h.balance_token + h.staked_token) THEN 'TOTAL_MISMATCH'
                    WHEN h.silica_sto_staked  != h.staked_token                     THEN 'STAKED_MISMATCH'
                    ELSE 'ok'
                END AS status,
                (SELECT COALESCE(SUM(amount_usdt),0) FROM funding_records fr WHERE fr.address=h.address AND fr.asset_id=h.asset_id) AS confirmed_funded_usdt,
                (SELECT COALESCE(SUM(amount_usdt),0) FROM refund_records rr WHERE rr.address=h.address AND rr.asset_id=h.asset_id) AS refunded_usdt,
                (SELECT COALESCE(SUM(amount),0) FROM wallet_transactions wt
                  WHERE wt.address=h.address AND wt.kind='swap_in' AND wt.asset='SilicaSTO') AS swap_in_sto
           FROM holdings h
           {$where}
           ORDER BY h.address, h.asset_id",
        $params
    );

    // (2026-05-21 v724) 진단 강화 — schema invariant 검사만으로는 v701 사례 같은
    //   '일관된 잘못된 차감' (양쪽 미러 모두 -1) 을 감지 못함. wallet_transactions
    //   을 source of truth 로 삼아 expected balance 를 합산 후 actual 과 비교.
    //   불일치 발생 시 PHANTOM_DRIFT 로 마킹 + 차이값 제공.
    $expectedDiag = [];
    if ($address !== '') {
        $expectedDiag = adminUsersComputeExpectedFromWalletTx($address);
    }

    jsonOk(['rows' => $rows, 'count' => count($rows), 'expected_diag' => $expectedDiag]);
});

// (2026-05-21 v724) wallet_transactions 의 kind 별 +/- 부호를 적용해
//   각 asset 의 expected total 을 계산. holdings/balances 의 actual 과 비교
//   하여 phantom drift (양쪽 미러 일관된 잘못된 변경) 감지.
//   부호 매핑은 silica-data-bind.js 의 positive substring/exact 와 동일:
//     POSITIVE: deposit, invest_credit, invest_refund, unstake, interest,
//               referral, dividend, swap_in, order_buy_canceled,
//               order_sell_canceled, withdraw_refund, trade_buy, trade_sell_recv
//     NEGATIVE: 나머지 (withdraw, invest, stake, swap_out, swap_fee, trade_sell,
//               trade_buy_pay, trade_*_fee, etc.)
if (!function_exists('adminUsersComputeExpectedFromWalletTx')) {
    function adminUsersComputeExpectedFromWalletTx(string $address): array {
        $diag = [
            'usdt'    => ['actual' => 0.0, 'expected' => 0.0, 'diff' => 0.0, 'status' => 'ok'],
            'sto'     => ['actual' => 0.0, 'expected' => 0.0, 'diff' => 0.0, 'status' => 'ok'],
            'silica'  => ['actual' => 0.0, 'expected' => 0.0, 'diff' => 0.0, 'status' => 'ok'],
            'tx_count' => 0,
            'errors' => [],
        ];

        $isPositive = function (string $kind): bool {
            $k = strtolower(trim($kind));
            $positiveSub = ['deposit', 'invest_credit', 'invest_refund', 'unstake',
                            'interest', 'referral', 'dividend', 'swap_in',
                            'order_buy_canceled', 'order_sell_canceled', 'withdraw_refund'];
            foreach ($positiveSub as $p) {
                if (strpos($k, $p) !== false) return true;
            }
            if ($k === 'trade_buy' || $k === 'trade_sell_recv') return true;
            return false;
        };

        $classifyAsset = function ($row): ?string {
            $a = strtoupper(trim((string)($row['asset'] ?? '')));
            if ($a === 'USDT') return 'usdt';
            if ($a === 'SILICASTO' || $a === 'SILICA-79907') return 'sto';
            if ($a === 'SILICA') return 'silica';
            return null;
        };

        try {
            // actual 잔액 — balances + holdings
            $usdtActual = (float)(DB::fetchValue("SELECT COALESCE(usdt,0) FROM balances WHERE address=?", [$address]) ?? 0);
            $h = DB::fetchOne(
                "SELECT
                    COALESCE(SUM(silica_sto_balance + silica_sto_staked), 0) AS sto_total,
                    COALESCE(SUM(silica_balance), 0) AS silica_total
                   FROM holdings WHERE address=?",
                [$address]
            ) ?? ['sto_total' => 0, 'silica_total' => 0];
            $stoActual = (float)($h['sto_total'] ?? 0);
            $silicaActual = (float)($h['silica_total'] ?? 0);

            $diag['usdt']['actual']   = round($usdtActual, 6);
            $diag['sto']['actual']    = round($stoActual, 6);
            $diag['silica']['actual'] = round($silicaActual, 6);

            // expected — wallet_transactions kind 별 +/- 합산
            // 단 status='실패' / '출금취소' / '출금반환' 는 제외 (이미 환불 행이 +) — 원본 출금 행은 negative 로 카운트하지 않음.
            //   원본 withdraw + status='실패' = NET 0 효과 (refund 행이 +amount 로 상쇄)
            $rows = DB::fetchAll(
                "SELECT kind, status, asset, amount FROM wallet_transactions
                  WHERE address=?",
                [$address]
            );
            $diag['tx_count'] = count($rows);

            foreach ($rows as $r) {
                $asset = $classifyAsset($r);
                if (!$asset) continue;
                $amt = (float)($r['amount'] ?? 0);
                if ($amt <= 0) continue;
                $status = (string)($r['status'] ?? '');
                $kind = (string)($r['kind'] ?? '');

                // FAILED 출금 행은 net 0 효과 — refund 가 별도 +amount 행으로 존재.
                //   원본 withdraw 의 -amount 와 refund 의 +amount 가 상쇄되도록
                //   원본 withdraw status='실패' 는 deduct 하지 않음.
                if (strtolower(trim($kind)) === 'withdraw'
                    && in_array(trim($status), ['실패', '반려', '출금취소'], true)) {
                    continue;
                }
                // 출금신청 (pending) 도 잔액에 이미 차감 반영됨 — actual 과 일치 위해 deduct 유지.
                // 출금완료 (done) → deduct 유지.

                if ($isPositive($kind)) {
                    $diag[$asset]['expected'] += $amt;
                } else {
                    $diag[$asset]['expected'] -= $amt;
                }
            }

            // diff 계산 + drift 판정 (epsilon 0.000001 허용)
            foreach (['usdt', 'sto', 'silica'] as $key) {
                $diag[$key]['expected'] = round($diag[$key]['expected'], 6);
                $diff = round($diag[$key]['actual'] - $diag[$key]['expected'], 6);
                $diag[$key]['diff'] = $diff;
                if (abs($diff) > 0.000001) {
                    $diag[$key]['status'] = $diff > 0 ? 'EXTRA' : 'MISSING';
                }
            }
        } catch (Throwable $e) {
            $diag['errors'][] = $e->getMessage();
        }

        return $diag;
    }
}

post('/api/admin/holdings-reconcile', function () {
    $admin = adminOnly();
    try {
        $stmt = DB::pdo()->prepare("UPDATE `holdings`
            SET silica_sto_balance = balance_token + staked_token,
                silica_sto_staked  = staked_token
          WHERE silica_sto_balance != (balance_token + staked_token)
             OR silica_sto_staked  != staked_token");
        $stmt->execute();
        $count = $stmt->rowCount();
        jsonOk([
            'ok' => true,
            'rows_reconciled' => $count,
            'admin' => $admin['username'],
        ]);
    } catch (Throwable $e) {
        jsonError(500, 'Reconcile 실패: ' . $e->getMessage());
    }
});

// (2026-05-18 v540) holdings-reset — 비파괴적 무결성 복구.
// 이전 버전들 (v538 포함) 은 silica_sto_balance 를 'funded' 또는 'funded + swap_in'
// 로 강제 재설정해, admin_deposit / admin_contracts / winddown 등 다른 경로로
// 유입된 SilicaSTO 를 reset 시 유실시키는 위험이 있었다. 새 정책은 보유량을
// 절대 줄이지 않고 schema invariant 만 복원:
//
//   (1) claimed_token = net_funded               ← 회계 컬럼 정정
//   (2) silica_sto_balance = balance + staked    ← legacy → silica 미러 동기화
//   (3) silica_sto_staked  = staked              ← staked 미러 동기화
//
// balance_token / staked_token / silica_sto_balance 의 절대량은 만지지 않는다.
// 어떤 경로로 들어온 토큰이든 보존된다.
post('/api/admin/holdings-reset-from-funding', function () {
    $admin = adminOnly();
    $body = getJsonBody();
    $address = trim($body['address'] ?? '');
    if ($address === '') jsonError(400, 'address 필수');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $rows = DB::fetchAll(
            "SELECT h.address, h.asset_id, h.staked_token AS old_staked,
                    h.balance_token AS old_balance, h.claimed_token AS old_claimed,
                    h.silica_sto_balance AS old_silica_balance,
                    h.silica_sto_staked AS old_silica_staked,
                    COALESCE((SELECT SUM(amount_usdt) FROM funding_records fr
                              WHERE fr.address=h.address AND fr.asset_id=h.asset_id),0) AS funded,
                    COALESCE((SELECT SUM(amount_usdt) FROM refund_records rr
                              WHERE rr.address=h.address AND rr.asset_id=h.asset_id),0) AS refunded
               FROM holdings h
              WHERE h.address=? FOR UPDATE",
            [$address]
        );

        $changes = [];
        foreach ($rows as $r) {
            $netFunded        = max(0.0, (float)$r['funded'] - (float)$r['refunded']);
            $oldBalance       = (float)$r['old_balance'];
            $oldStaked        = (float)$r['old_staked'];
            $oldClaimed       = (float)$r['old_claimed'];
            $oldSilicaBalance = (float)$r['old_silica_balance'];
            $oldSilicaStaked  = (float)$r['old_silica_staked'];

            // 비파괴 정정 — 보유량은 그대로, 회계 + 미러만 정정.
            $newClaimed       = $netFunded;
            $newSilicaBalance = $oldBalance + $oldStaked;  // legacy → silica 미러
            $newSilicaStaked  = $oldStaked;

            DB::execute(
                "UPDATE holdings
                    SET claimed_token      = ?,
                        silica_sto_balance = ?,
                        silica_sto_staked  = ?
                  WHERE address=? AND asset_id=?",
                [$newClaimed, $newSilicaBalance, $newSilicaStaked, $r['address'], $r['asset_id']]
            );

            $changes[] = [
                'asset_id' => $r['asset_id'],
                'before' => [
                    'balance_token' => $oldBalance,
                    'staked_token' => $oldStaked,
                    'claimed_token' => $oldClaimed,
                    'silica_sto_balance' => $oldSilicaBalance,
                    'silica_sto_staked' => $oldSilicaStaked,
                ],
                'after' => [
                    'balance_token' => $oldBalance,                // unchanged
                    'staked_token' => $oldStaked,                  // unchanged
                    'claimed_token' => $newClaimed,
                    'silica_sto_balance' => $newSilicaBalance,
                    'silica_sto_staked' => $newSilicaStaked,
                ],
                'net_funded' => $netFunded,
            ];
        }

        $pdo->commit();
        jsonOk([
            'ok' => true,
            'address' => $address,
            'changes' => $changes,
            'admin' => $admin['username'],
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, 'Reset 실패: ' . $e->getMessage());
    }
});

post('/api/admin/users/control', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    $address = trim((string)($body['address'] ?? ''));
    $action = trim((string)($body['action'] ?? ''));
    $reason = trim((string)($body['reason'] ?? ''));

    if ($address === '') jsonError(400, 'address 필요');
    if (!in_array($action, ['suspend', 'unsuspend', 'withdraw_suspend', 'withdraw_unsuspend'], true)) {
        jsonError(400, 'action 올바르지 않음');
    }

    // (2026-05-18 v552) v551 진단으로 확인된 진짜 원인:
    //   saveUserControlStatus → userControlLoadMap → userControlStoreReady()
    //   가 'CREATE TABLE IF NOT EXISTS app_settings' (DDL) 를 실행하는데,
    //   MySQL 은 DDL 문 실행 시 현재 트랜잭션을 implicitly commit 한다.
    //   결과: 트랜잭션이 사라진 채로 commit() 가 호출되어 'There is no
    //   active transaction' 오류. 첫 요청 (static $done=false) 만 재현되는
    //   잠재 버그였다. 트랜잭션 시작 전에 DDL 을 선제 실행하여 회피.
    if (function_exists('userControlStoreReady')) {
        try { userControlStoreReady(); } catch (Throwable $_) { /* ignore */ }
    }

    // (2026-05-18 v548 → v551) 단계별 진단 — DB::pdo / beginTransaction 도
    //   try 안으로 끌어들임. 이전 버전은 이 두 호출이 try 바깥에 있어 throw 시
    //   index.php wrapper 가 generic 메시지로 응답해 운영자 진단이 불가능.
    $stage = 'init';
    $pdo = null;
    try {
        $stage = 'db_connect';
        $pdo = DB::pdo();
        $stage = 'begin_transaction';
        $pdo->beginTransaction();
        $stage = 'lockUserRow';
        lockUserRowForUpdate($address);
        $stage = 'getUserControlStatus';
        $currentControl = getUserControlStatus($address);

        $result = [
            'action' => $action,
            'address' => $address,
            'cancelled_orders' => 0,
            'unstaked_token' => 0.0,
            'refunded_usdt' => 0.0,
            'refunded_token' => 0.0,
            // (2026-05-18 v556) suspend 시 자동 취소되는 pending 출금 카운트.
            'cancelled_usdt_withdrawals' => 0,
            'cancelled_token_withdrawals' => 0,
        ];

        if ($action === 'suspend') {
            $orders = [];
            try {
                $orders = DB::fetchAll("SELECT * FROM orders WHERE maker_address=? AND status='open' FOR UPDATE", [$address]);
            } catch (Throwable $e) {
                $orders = [];
            }

            foreach ($orders as $order) {
                $order = marketNormalizeOrderRow($order);
                if (($order['side'] ?? '') === 'buy') {
                    $refund = (float)($order['escrow_usdt'] ?? 0);
                    if ($refund > 0) {
                        DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$refund, $address]);
                        $result['refunded_usdt'] += $refund;
                    }
                } else {
                    $refund = (float)($order['escrow_token'] ?? 0);
                    if ($refund <= 0) $refund = (float)($order['remaining'] ?? 0);
                    if ($refund > 0) {
                        ensureHolding($address, (string)$order['asset_id']);
                        DB::execute("UPDATE holdings SET balance_token=balance_token+? WHERE address=? AND asset_id=?", [$refund, $address, $order['asset_id']]);
                        $result['refunded_token'] += $refund;
                    }
                }
                DB::execute("UPDATE orders SET status='cancelled', remaining=0, escrow_usdt=0, escrow_token=0 WHERE id=?", [$order['id']]);
                $result['cancelled_orders']++;
            }

            $stakedRows = DB::fetchAll("SELECT asset_id, staked_token FROM holdings WHERE address=? AND staked_token>0 FOR UPDATE", [$address]);
            foreach ($stakedRows as $row) {
                $amt = (float)($row['staked_token'] ?? 0);
                if ($amt <= 0) continue;
                DB::execute("UPDATE holdings SET balance_token=balance_token+?, staked_token=0 WHERE address=? AND asset_id=?", [$amt, $address, $row['asset_id']]);
                $result['unstaked_token'] += $amt;
            }

            // (2026-05-18 v556) H1 fix — pending USDT 출금 자동 취소 + 환불.
            //   기존엔 사용중지된 사용자의 pending withdraw_requests 가 그대로
            //   남아 운영자가 모르고 승인할 위험 + escrow USDT 가 묶임. 사용
            //   중지는 'all withdrawals halted' 의도이므로 일괄 취소가 옳다.
            $stage = 'cancel_pending_usdt_withdrawals';
            $pendingWds = DB::fetchAll(
                "SELECT id, wallet_tx_id, amount FROM withdraw_requests
                  WHERE address=? AND status IN ('pending','processing') FOR UPDATE",
                [$address]
            );
            foreach ($pendingWds as $w) {
                $refundAmt = (float)($w['amount'] ?? 0);
                if ($refundAmt > 0) {
                    DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?, 0)", [$address]);
                    $balRow = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
                    $beforeAmt = (float)($balRow['usdt'] ?? 0);
                    $afterAmt = $beforeAmt + $refundAmt;
                    DB::execute("UPDATE balances SET usdt=? WHERE address=?", [$afterAmt, $address]);
                    // 환불 내역도 wallet_transactions 에 기록 — 사용자 거래 내역에서 추적 가능.
                    // (2026-05-20 v676) kind='withdraw_refund' / status='출금반환' 으로
                    //   명시 (이전 deposit/입금완료 는 외부 입금처럼 보여 혼란).
                    DB::execute(
                        "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                         VALUES (?,?,?,?,?,?,?,?,?)",
                        [$address, 'withdraw_refund', '출금반환', 'USDT', $refundAmt, $beforeAmt, $afterAmt,
                         'refund_withdraw_req:' . $w['id'] . '|type:suspend_auto_cancel', nowUtcSql()]
                    );
                    $result['refunded_usdt'] += $refundAmt;
                }
                DB::execute(
                    "UPDATE withdraw_requests SET status='canceled', memo=? WHERE id=?",
                    ['suspend_auto_cancel|reason:' . ($reason ?: 'admin_suspend'), $w['id']]
                );
                if (!empty($w['wallet_tx_id'])) {
                    DB::execute("UPDATE wallet_transactions SET status='출금취소' WHERE id=?", [$w['wallet_tx_id']]);
                }
                $result['cancelled_usdt_withdrawals']++;
            }

            // (v556) H1 fix — pending 토큰 출금 자동 취소 + 환불.
            //   token_withdraw_requests 도 동일하게 pending/processing 행 모두
            //   취소 + holdings 의 balance_token + silica_sto_balance 양쪽 미러
            //   복원 (token_withdraw/request 가 양쪽을 차감하므로 양쪽 복원 필요).
            // (v559) wallet_tx_id 컬럼은 일부 deployment 에 없음 (운영자 보고:
            //   'Unknown column wallet_tx_id'). INFORMATION_SCHEMA 로 존재
            //   여부 확인 후 동적으로 SELECT 컬럼 구성. SELECT * 대안 대신
            //   명시적 컬럼 리스트를 유지해 schema drift 추적 용이.
            $stage = 'cancel_pending_token_withdrawals';
            $hasTwWalletTxId = false;
            try {
                $hasTwWalletTxId = (int)DB::fetchValue(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='token_withdraw_requests'
                        AND COLUMN_NAME='wallet_tx_id'",
                    []
                ) > 0;
            } catch (Throwable $_) { $hasTwWalletTxId = false; }
            $twSelectCols = 'id, asset_id, amount_token' . ($hasTwWalletTxId ? ', wallet_tx_id' : '');
            $pendingTwds = DB::fetchAll(
                "SELECT {$twSelectCols} FROM token_withdraw_requests
                  WHERE address=? AND status IN ('pending','processing') FOR UPDATE",
                [$address]
            );
            foreach ($pendingTwds as $tw) {
                $refundAmt = (float)($tw['amount_token'] ?? 0);
                $tokAssetId = (string)($tw['asset_id'] ?? '');
                if ($refundAmt > 0 && $tokAssetId !== '') {
                    ensureHolding($address, $tokAssetId);
                    // (2026-05-20 v679) holdings before/after 캡처 + wallet_transactions
                    //   환불 행 INSERT. 이전엔 holdings 만 환불되고 사용자 history 에
                    //   기록 없어 'suspend 자동 취소' 상황을 사용자가 알 길이 없었음.
                    $singleId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';
                    $hRow = DB::fetchOne("SELECT balance_token FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $tokAssetId]);
                    $tokBefore = (float)($hRow['balance_token'] ?? 0);
                    $tokAfter = clamp6($tokBefore + $refundAmt);
                    if ($tokAssetId === $singleId) {
                        DB::execute(
                            "UPDATE holdings
                                SET silica_sto_balance = silica_sto_balance + ?,
                                    balance_token      = balance_token + ?
                              WHERE address=? AND asset_id=?",
                            [$refundAmt, $refundAmt, $address, $tokAssetId]
                        );
                    } else {
                        DB::execute(
                            "UPDATE holdings SET balance_token = balance_token + ? WHERE address=? AND asset_id=?",
                            [$refundAmt, $address, $tokAssetId]
                        );
                    }
                    $result['refunded_token'] += $refundAmt;

                    // 환불 wallet_transactions 행 — kind='withdraw_refund' / status='출금반환'
                    $tokenSymbol = ($tokAssetId === $singleId) ? 'SilicaSTO' : $tokAssetId;
                    DB::execute(
                        "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                         VALUES (?,?,?,?,?,?,?,?,?)",
                        [$address, 'withdraw_refund', '출금반환', $tokenSymbol, $refundAmt, $tokBefore, $tokAfter,
                         'refund_token_withdraw_req:' . $tw['id'] . '|type:suspend_auto_cancel', nowUtcSql()]
                    );
                }
                // status 와 memo 컬럼은 거의 모든 deployment 에 존재 — 그래도 안전 try.
                try {
                    DB::execute(
                        "UPDATE token_withdraw_requests SET status='canceled', memo=? WHERE id=?",
                        ['suspend_auto_cancel|reason:' . ($reason ?: 'admin_suspend'), $tw['id']]
                    );
                } catch (Throwable $_) {
                    DB::execute("UPDATE token_withdraw_requests SET status='canceled' WHERE id=?", [$tw['id']]);
                }
                // (v679) 원본 토큰 출금 wallet_transactions row status → '실패'
                //   (이전 '출금취소' → '실패' 통일, USDT 출금 거절 흐름과 동일)
                if ($hasTwWalletTxId && !empty($tw['wallet_tx_id'])) {
                    DB::execute("UPDATE wallet_transactions SET status='실패' WHERE id=?", [$tw['wallet_tx_id']]);
                }
                $result['cancelled_token_withdrawals']++;
            }

            $stage = 'save_suspend';
            saveUserControlStatus($address, array_merge($currentControl, [
                'is_suspended' => true,
                'suspended_reason' => $reason ?: 'admin_suspend',
                'suspended_at' => nowUtcSql(),
                'suspended_by' => ($admin['username'] ?? 'admin'),
            ]));
        } elseif ($action === 'unsuspend') {
            $stage = 'save_unsuspend';
            saveUserControlStatus($address, array_merge($currentControl, [
                'is_suspended' => false,
                'suspended_reason' => '',
                'suspended_at' => null,
                'suspended_by' => '',
            ]));
        } elseif ($action === 'withdraw_suspend') {
            $stage = 'save_withdraw_suspend';
            saveUserControlStatus($address, array_merge($currentControl, [
                'withdraw_suspended' => true,
                'withdraw_suspension_reason' => $reason ?: 'admin_withdraw_suspend',
                'withdraw_suspended_at' => nowUtcSql(),
                'withdraw_suspended_by' => ($admin['username'] ?? 'admin'),
            ]));
        } elseif ($action === 'withdraw_unsuspend') {
            $stage = 'save_withdraw_unsuspend';
            saveUserControlStatus($address, array_merge($currentControl, [
                'withdraw_suspended' => false,
                'withdraw_suspension_reason' => '',
                'withdraw_suspended_at' => null,
                'withdraw_suspended_by' => '',
            ]));
        }

        $stage = 'commit';
        $pdo->commit();
        jsonOk($result);
    } catch (Throwable $e) {
        // (2026-05-18 v551) rollBack 가 자체 throw 하면 jsonError 가 실행 안 되어
        //   index.php 의 outer wrapper 가 generic 메시지로 응답하게 된다 (운영자
        //   보고: '서버 처리 중 오류가 발생했습니다.'). guard 적용. $pdo 가 null
        //   인 경우 (db_connect 단계에서 실패) 도 안전.
        try {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
        } catch (Throwable $rbErr) {
            error_log('[admin/users/control] rollBack failed (ignored): ' . $rbErr->getMessage());
        }
        error_log('[admin/users/control] FAILED — stage=' . $stage
            . ' action=' . $action . ' address=' . $address
            . ' error=' . $e->getMessage()
            . ' at ' . $e->getFile() . ':' . $e->getLine());
        jsonError(500, 'user_control_failed [stage=' . $stage . ']: ' . $e->getMessage()
            . ' [' . basename($e->getFile()) . ':' . $e->getLine() . ']');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// (2026-05-18 v570) KYC 화해 — didit "검토중" 인 사용자가 우리 DB 에서 'Y' 로
//   잘못 승인된 케이스를 식별하고 롤백한다. v570 보안 패치는 신규 케이스만
//   막을 뿐, 이전 OR 조건으로 이미 false-approve 된 행은 그대로 남아 있어
//   별도 정정이 필요.
//
//   /api/admin/kyc/audit  — 전체 kyc_yn='Y' 행을 didit 에 재조회해 mismatch
//                            만 추려 반환 (DB 변경 없음).
//   /api/admin/kyc/reset  — 특정 address 의 kyc_yn 을 'N' 으로 되돌리고
//                            kyc_status 를 didit 실제 상태로 동기화.
// ─────────────────────────────────────────────────────────────────────────────

// (2026-05-19 v588) 운영자 요청: '유저가 KYC 를 신청하여 보류중이 있는 경우,
//   관리자가 알 수 있어야한다.' 대시보드 + 헤더용 카운터. 두 가지 카운트 노출:
//     pending_review: didit 사람 검토 대기 / 자동 처리 중 (users.kyc_status
//                     in {in_review, pending, reviewing, in_progress})
//                     OR 활성 kyc_sessions 행 존재
//     rejected:       기본 정보 불일치 / 거절 / 크레딧 소진 (kyc_status_not_approved,
//                     mismatch_name, mismatch_birth, kyc_no_credits)
//   둘 다 운영자가 조치해야 하는 행 — 대시보드 KPI 로 일별 모니터링.
get('/api/admin/kyc/pending-count', function () {
    adminOnly();

    $pendingReview = 0;
    $rejected = 0;
    try {
        // pending review — users.kyc_status 가 보류 상태 키.
        $pendingReview = (int)(DB::fetchValue(
            "SELECT COUNT(*) FROM users
              WHERE LOWER(COALESCE(kyc_status,'')) IN ('in_review','pending','reviewing','in_progress')
                AND COALESCE(kyc_yn,'N') <> 'Y'",
            []
        ) ?? 0);
    } catch (Throwable $_) {}
    try {
        // 거절 — 운영자가 사용자 문의 대응 또는 SQL 정정 필요할 수 있음.
        $rejected = (int)(DB::fetchValue(
            "SELECT COUNT(*) FROM users
              WHERE LOWER(COALESCE(kyc_status,'')) IN ('kyc_status_not_approved','mismatch_name','mismatch_birth','kyc_no_credits','rejected')
                AND COALESCE(kyc_yn,'N') <> 'Y'",
            []
        ) ?? 0);
    } catch (Throwable $_) {}

    jsonOk([
        'pending_review' => $pendingReview,
        'rejected' => $rejected,
    ]);
});

get('/api/admin/kyc/audit', function () {
    adminOnly();

    if (!function_exists('fetchDiditDecision') || !function_exists('extractDiditDecision')) {
        jsonError(500, 'KYC helper functions not loaded (kyc.php route file missing?)');
    }
    if (!defined('DIDIT_API_KEY') || !DIDIT_API_KEY) {
        jsonError(503, 'DIDIT_API_KEY not configured — cannot audit.');
    }

    $limit = min(500, max(1, (int)($_GET['limit'] ?? 200)));

    // kyc_yn='Y' 이면서 kyc_session_id 가 있는 행만 (세션 ID 없으면 didit
    //   조회 불가 — 아주 옛날 mode='auto' 자동승인 행은 제외).
    $rows = DB::fetchAll(
        "SELECT address, kyc_yn, kyc_session_id, kyc_status, kyc_last_verified_at, kyc_extracted_name
           FROM users
          WHERE kyc_yn='Y' AND kyc_session_id IS NOT NULL AND kyc_session_id <> ''
          ORDER BY kyc_last_verified_at DESC
          LIMIT {$limit}",
        []
    );

    $mismatch = [];
    $ok = [];
    $errors = [];

    foreach ($rows as $u) {
        $sid = (string)($u['kyc_session_id'] ?? '');
        try {
            $decision = fetchDiditDecision($sid);
            $ex = extractDiditDecision($decision);
            $statusOverall = trim($ex['status_overall'] ?? '');
            $idvStatus = trim($ex['idv_status'] ?? '');

            $anyReview = isReviewLike($idvStatus) || isReviewLike($statusOverall);
            $sessionApproved = !$anyReview && isApprovedDiditStatus($statusOverall);

            $entry = [
                'address' => $u['address'],
                'session_id' => $sid,
                'kyc_status' => $u['kyc_status'],
                'kyc_last_verified_at' => $u['kyc_last_verified_at'],
                'kyc_extracted_name' => $u['kyc_extracted_name'],
                'didit_status_overall' => $statusOverall,
                'didit_idv_status' => $idvStatus,
                'didit_says_approved' => $sessionApproved,
            ];

            if (!$sessionApproved) {
                $entry['recommended_action'] = $anyReview ? 'reset_to_in_review' : 'reset_to_not_approved';
                $mismatch[] = $entry;
            } else {
                $ok[] = $entry;
            }
        } catch (Throwable $e) {
            $errors[] = [
                'address' => $u['address'],
                'session_id' => $sid,
                'error' => $e->getMessage(),
            ];
        }
    }

    jsonOk([
        'scanned' => count($rows),
        'mismatch_count' => count($mismatch),
        'ok_count' => count($ok),
        'error_count' => count($errors),
        'mismatch' => $mismatch,
        'errors' => $errors,
    ]);
});

/**
 * (2026-06-07 v875) 관리자 KYC 강제 override — 인증 완료 / 취소.
 *   기존 /api/admin/kyc/reset 은 didit 재대조 기반 (didit 가 거부한 경우만
 *   reset). 이 endpoint 는 didit 응답과 무관하게 admin 권한으로 강제 처리.
 *
 *   body:
 *     - address: string (필수)
 *     - action:  'approve' | 'revoke' (필수)
 *     - reason:  string (필수, 최소 3자) — 감사 기록용
 *
 *   approve: kyc_yn='Y', kyc_status='admin_force_approved', kyc_last_verified_at=NOW
 *   revoke:  kyc_yn='N', kyc_status='admin_force_revoked',  kyc_last_verified_at=NULL
 *
 *   감사 로그: silica_audit_log (category='kyc_override') 기록.
 */
post('/api/admin/users/kyc-override', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    $address = trim((string)($body['address'] ?? ''));
    $action  = strtolower(trim((string)($body['action'] ?? '')));
    $reason  = trim((string)($body['reason'] ?? ''));

    if ($address === '') jsonError(400, '지갑 주소가 필요합니다.');
    if (!in_array($action, ['approve', 'revoke'], true)) {
        jsonError(400, "action 은 'approve' 또는 'revoke' 만 허용됩니다.");
    }
    if (mb_strlen($reason) < 3) {
        jsonError(400, '사유는 3자 이상 입력해주세요. (감사 추적용)');
    }

    $u = DB::fetchOne(
        "SELECT address, kyc_yn, kyc_status, kyc_last_verified_at FROM users WHERE address=? LIMIT 1",
        [$address]
    );
    if (!$u) jsonError(404, '해당 지갑 주소의 유저를 찾을 수 없습니다.');

    $prevKycYn = (string)($u['kyc_yn'] ?? 'N');
    $prevKycStatus = (string)($u['kyc_status'] ?? '');

    if ($action === 'approve') {
        DB::execute(
            "UPDATE users SET kyc_yn='Y', kyc_status='admin_force_approved', kyc_last_verified_at=? WHERE address=?",
            [nowUtcSql(), $address]
        );
        $newKycYn = 'Y';
        $newKycStatus = 'admin_force_approved';
    } else { // revoke
        DB::execute(
            "UPDATE users SET kyc_yn='N', kyc_status='admin_force_revoked', kyc_last_verified_at=NULL WHERE address=?",
            [$address]
        );
        $newKycYn = 'N';
        $newKycStatus = 'admin_force_revoked';
    }

    // 감사 로그 — silica_audit_log 가 있으면 기록 (스키마 부재 시 무시)
    try {
        DB::execute(
            "INSERT INTO silica_audit_log (category, action, actor, prev_value, new_value)
             VALUES ('kyc_override', ?, ?, ?, ?)",
            [
                'kyc_force_' . $action,
                $admin['username'] ?? 'admin',
                json_encode(['address' => $address, 'kyc_yn' => $prevKycYn, 'kyc_status' => $prevKycStatus, 'reason' => $reason], JSON_UNESCAPED_UNICODE),
                json_encode(['address' => $address, 'kyc_yn' => $newKycYn, 'kyc_status' => $newKycStatus], JSON_UNESCAPED_UNICODE),
            ]
        );
    } catch (Throwable $_) { /* 감사 로그 실패는 응답에 영향 없음 */ }

    error_log('[admin/kyc-override] address=' . $address
        . ' action=' . $action
        . ' actor=' . ($admin['username'] ?? 'admin')
        . ' prev=' . $prevKycYn . '/' . $prevKycStatus
        . ' new=' . $newKycYn . '/' . $newKycStatus
        . ' reason=' . $reason);

    jsonOk([
        'status'  => 'ok',
        'address' => $address,
        'action'  => $action,
        'prev_kyc_yn'    => $prevKycYn,
        'prev_kyc_status' => $prevKycStatus,
        'new_kyc_yn'     => $newKycYn,
        'new_kyc_status' => $newKycStatus,
    ]);
});

post('/api/admin/kyc/reset', function () {
    adminOnly();

    $body = getJsonBody();
    $address = trim($body['address'] ?? '');
    $reason = trim($body['reason'] ?? 'admin_reconcile_didit_mismatch');
    if (!$address) jsonError(400, 'address required');

    if (!function_exists('fetchDiditDecision') || !function_exists('extractDiditDecision')) {
        jsonError(500, 'KYC helper functions not loaded.');
    }
    if (!defined('DIDIT_API_KEY') || !DIDIT_API_KEY) {
        jsonError(503, 'DIDIT_API_KEY not configured.');
    }

    $u = DB::fetchOne("SELECT address, kyc_yn, kyc_session_id, kyc_status FROM users WHERE address=? LIMIT 1", [$address]);
    if (!$u) jsonError(404, 'user not found');

    $sid = (string)($u['kyc_session_id'] ?? '');
    if (!$sid) jsonError(400, 'user has no kyc_session_id — cannot reconcile against didit; manual SQL required.');

    // didit 재조회 — 실제 상태에 따라 분기.
    try {
        $decision = fetchDiditDecision($sid);
    } catch (Throwable $e) {
        jsonError(502, 'didit decision fetch failed: ' . $e->getMessage());
    }
    $ex = extractDiditDecision($decision);
    $statusOverall = trim($ex['status_overall'] ?? '');
    $idvStatus = trim($ex['idv_status'] ?? '');
    $anyReview = isReviewLike($idvStatus) || isReviewLike($statusOverall);
    $sessionApproved = !$anyReview && isApprovedDiditStatus($statusOverall);

    if ($sessionApproved) {
        // didit 가 실제로 승인 상태라면 우리도 그대로 둠 — admin 이 강제 reset
        //   하려면 force=true 를 별도 옵션으로 추가 가능 (현재 미구현).
        jsonResponse([
            'ok' => false,
            'status' => 'didit_actually_approved',
            'message' => 'didit currently reports this session as Approved. No reset performed.',
            'didit_status_overall' => $statusOverall,
            'didit_idv_status' => $idvStatus,
        ], 409);
    }

    // 새 kyc_status 결정. review-like 면 'in_review' 로, 그 외엔 didit 실제
    //   status_overall 을 lowercase 로 저장.
    $newKycStatus = $anyReview ? 'in_review' : ($statusOverall ? strtolower($statusOverall) : 'kyc_status_not_approved');

    DB::execute(
        "UPDATE users SET kyc_yn='N', kyc_status=?, kyc_last_verified_at=NULL WHERE address=?",
        [$newKycStatus, $address]
    );

    // 세션 행도 동기화 (있다면) — 검토중이면 'pending' 유지, 그 외엔 terminal.
    DB::execute(
        "UPDATE kyc_sessions SET status=?, didit_status=?, updated_at=? WHERE address=? AND session_id=?",
        [$anyReview ? 'pending' : 'kyc_status_not_approved', $statusOverall ?: null, nowUtcSql(), $address, $sid]
    );

    error_log('[admin/kyc/reset] address=' . $address . ' reason=' . $reason
        . ' didit_overall=' . $statusOverall . ' didit_idv=' . $idvStatus
        . ' new_kyc_status=' . $newKycStatus);

    jsonOk([
        'status' => 'reset',
        'address' => $address,
        'new_kyc_yn' => 'N',
        'new_kyc_status' => $newKycStatus,
        'didit_status_overall' => $statusOverall,
        'didit_idv_status' => $idvStatus,
    ]);
});
