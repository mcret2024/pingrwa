<?php
/**
 * Admin Deposit Approval routes
 */

// Ensure admin_note column exists; auto-create if missing (cached per request)
function _ensureAdminNoteCol(): bool {
    static $result = null;
    if ($result !== null) return $result;
    try {
        $row = DB::fetchOne(
            "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wallet_transactions' AND COLUMN_NAME='admin_note'"
        );
        if (((int)($row['cnt'] ?? 0)) > 0) {
            $result = true;
            return true;
        }
        DB::pdo()->exec("ALTER TABLE `wallet_transactions` ADD COLUMN `admin_note` VARCHAR(500) DEFAULT NULL AFTER `memo`");
        $result = true;
    } catch (Throwable $e) {
        error_log('[admin_deposit] _ensureAdminNoteCol failed: ' . $e->getMessage());
        $result = false;
    }
    return $result;
}

// Drop the legacy guard trigger that blocks deposit updates (cached per request)
function _dropLegacyTrigger(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        DB::pdo()->exec("DROP TRIGGER IF EXISTS `trg_wallet_transactions_guard_update`");
    } catch (Throwable $e) {
        error_log('[admin_deposit] _dropLegacyTrigger failed: ' . $e->getMessage());
    }
}

// List deposit transactions (filterable by status)
get('/api/admin/deposits', function () {
    adminAuth();
    $status = trim($_GET['status'] ?? '');
    $q = trim($_GET['q'] ?? '');
    $assetType = strtolower(trim($_GET['asset_type'] ?? 'all'));
    $assetCode = strtoupper(trim($_GET['asset'] ?? ''));
    $limit = min(500, max(1, (int)($_GET['limit'] ?? 200)));
    $hasNote = _ensureAdminNoteCol();

    $where = ["t.kind='deposit'"];
    $params = [];
    $countWhere = ["kind='deposit'"];
    $countParams = [];

    if ($assetType === 'usdt') {
        $where[] = "UPPER(COALESCE(t.asset,'USDT'))='USDT'";
        $countWhere[] = "UPPER(COALESCE(asset,'USDT'))='USDT'";
    } elseif ($assetType === 'token') {
        $where[] = "UPPER(COALESCE(t.asset,'USDT'))<>'USDT'";
        $countWhere[] = "UPPER(COALESCE(asset,'USDT'))<>'USDT'";
    }

    if ($assetCode !== '') {
        $where[] = "UPPER(COALESCE(t.asset,'USDT'))=?";
        $params[] = $assetCode;
        $countWhere[] = "UPPER(COALESCE(asset,'USDT'))=?";
        $countParams[] = $assetCode;
    }

    if ($status && $status !== 'all') {
        $where[] = 't.status=?';
        $params[] = $status;
    }
    if ($q) {
        if ($hasNote) {
            $where[] = '(t.address LIKE ? OR t.txid LIKE ? OR t.memo LIKE ? OR t.admin_note LIKE ?)';
            $params[] = "%$q%";
            $params[] = "%$q%";
            $params[] = "%$q%";
            $params[] = "%$q%";
        } else {
            $where[] = '(t.address LIKE ? OR t.txid LIKE ? OR t.memo LIKE ?)';
            $params[] = "%$q%";
            $params[] = "%$q%";
            $params[] = "%$q%";
        }
    }

    $whereSql = 'WHERE ' . implode(' AND ', $where);
    $countWhereSql = 'WHERE ' . implode(' AND ', $countWhere);
    $noteCol = $hasNote ? ', t.admin_note' : '';

    $rows = DB::fetchAll(
        "SELECT t.id, t.address, t.kind, t.status, t.asset,
                t.amount, t.before_amount, t.after_amount,
                t.txid, t.memo{$noteCol}, t.created_at, t.updated_at
         FROM wallet_transactions t
         {$whereSql}
         ORDER BY
           CASE t.status WHEN '대기' THEN 0 ELSE 1 END,
           t.id DESC
         LIMIT {$limit}",
        $params
    );

    $counts = DB::fetchOne(
        "SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status='대기' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status='입금완료' THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN status='실패' THEN 1 ELSE 0 END) AS rejected,
           SUM(CASE WHEN status='대기' THEN amount ELSE 0 END) AS pending_amount
         FROM wallet_transactions {$countWhereSql}",
        $countParams
    );

    jsonOk(['rows' => $rows, 'counts' => $counts]);
});

// Save admin note on a deposit
post('/api/admin/deposit/note', function () {
    adminAuth();
    $body = getJsonBody();

    $txId = (int)($body['tx_id'] ?? 0);
    $note = trim($body['note'] ?? '');
    if ($txId <= 0) jsonError(400, 'tx_id 필요');

    if (!_ensureAdminNoteCol()) {
        jsonError(500, 'admin_note 컬럼 자동 생성에 실패했습니다. DB 권한을 확인하세요.');
    }

    // Drop legacy trigger that blocks this update
    _dropLegacyTrigger();

    // admin_note is freely editable regardless of status
    DB::execute(
        "UPDATE wallet_transactions SET admin_note=? WHERE id=? AND kind='deposit'",
        [substr($note, 0, 500), $txId]
    );

    jsonOk(['tx_id' => $txId, 'admin_note' => $note]);
});

// Approve a deposit
post('/api/admin/deposit/approve', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    $txId = (int)($body['tx_id'] ?? 0);
    $note = trim($body['admin_note'] ?? '');
    if ($txId <= 0) jsonError(400, 'tx_id 필요');

    // DDL operations MUST run BEFORE beginTransaction (implicit commit)
    _dropLegacyTrigger();
    $hasNote = _ensureAdminNoteCol();

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $tx = DB::fetchOne("SELECT * FROM wallet_transactions WHERE id=? FOR UPDATE", [$txId]);
        if (!$tx) { $pdo->rollBack(); jsonError(404, '거래를 찾을 수 없습니다.'); }
        if ($tx['kind'] !== 'deposit') { $pdo->rollBack(); jsonError(400, '입금 거래가 아닙니다.'); }
        if ($tx['status'] !== '대기') { $pdo->rollBack(); jsonError(400, "이미 처리된 거래입니다. (현재 상태: {$tx['status']})"); }

        $address = $tx['address'];
        $amount = (float)$tx['amount'];
        // 음수/비정상 금액 승인 방지 — DB 변조나 잘못된 레코드로 인한 유저 잔액 역전 차단
        if (!is_finite($amount) || $amount <= 0) {
            $pdo->rollBack();
            jsonError(400, "거래 #{$txId}의 금액이 비정상입니다 (amount={$amount}). 승인 불가.");
        }
        $assetCode = strtoupper(trim((string)($tx['asset'] ?? 'USDT')));
        $beforeAmt = 0.0;
        $afterAmt = 0.0;

        if ($assetCode === 'USDT' || $assetCode === '') {
            DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?, 0)", [$address]);
            $balRow = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
            $beforeAmt = (float)($balRow['usdt'] ?? 0);
            $afterAmt = $beforeAmt + $amount;
            DB::execute("UPDATE balances SET usdt=? WHERE address=?", [$afterAmt, $address]);
        } elseif ($assetCode === 'SILICASTO') {
            // (2026-05-07) SilicaSTO 입금 승인 — holdings.silica_sto_balance 증액.
            //   asset_id 는 단일 자산 'SILICA-79907' (silicaGetSingleAssetId).
            //   balance_token 도 동시에 증가시킴 (legacy idle 미러).
            $assetId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';
            ensureHolding($address, $assetId);
            $holdRow = DB::fetchOne("SELECT silica_sto_balance FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetId]);
            $beforeAmt = (float)($holdRow['silica_sto_balance'] ?? 0);
            $afterAmt = $beforeAmt + $amount;
            DB::execute(
                "UPDATE holdings
                    SET silica_sto_balance = silica_sto_balance + ?,
                        balance_token      = balance_token + ?
                  WHERE address=? AND asset_id=?",
                [$amount, $amount, $address, $assetId]
            );
        } elseif ($assetCode === 'SILICA') {
            // Silica 보상 토큰 입금 승인 — holdings.silica_balance 증액.
            $assetId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';
            ensureHolding($address, $assetId);
            $holdRow = DB::fetchOne("SELECT silica_balance FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetId]);
            $beforeAmt = (float)($holdRow['silica_balance'] ?? 0);
            $afterAmt = $beforeAmt + $amount;
            DB::execute(
                "UPDATE holdings SET silica_balance = silica_balance + ? WHERE address=? AND asset_id=?",
                [$amount, $address, $assetId]
            );
        } else {
            ensureHolding($address, $assetCode);
            $holdRow = DB::fetchOne("SELECT balance_token FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetCode]);
            $beforeAmt = (float)($holdRow['balance_token'] ?? 0);
            $afterAmt = $beforeAmt + $amount;
            DB::execute("UPDATE holdings SET balance_token=? WHERE address=? AND asset_id=?", [$afterAmt, $address, $assetCode]);
        }

        $updateSql = "UPDATE wallet_transactions SET status='입금완료', before_amount=?, after_amount=?";
        $updateParams = [$beforeAmt, $afterAmt];
        if ($note !== '' && $hasNote) {
            $updateSql .= ", admin_note=?";
            $updateParams[] = substr($note, 0, 500);
        }
        $updateSql .= " WHERE id=?";
        $updateParams[] = $txId;
        DB::execute($updateSql, $updateParams);

        $pdo->commit();

        error_log("[admin_deposit] APPROVED tx_id={$txId} address={$address} amount={$amount} by={$admin['username']}");
        jsonOk([
            'tx_id' => $txId,
            'amount' => $amount,
            'before' => $beforeAmt,
            'after' => $afterAmt,
            'status' => '입금완료',
            'asset' => $assetCode ?: 'USDT'
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '승인 처리 실패: ' . $e->getMessage());
    }
});

// Batch approve multiple deposits
post('/api/admin/deposit/approve-batch', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    $txIds = $body['tx_ids'] ?? [];
    if (!is_array($txIds) || empty($txIds)) jsonError(400, 'tx_ids 배열 필요');
    if (count($txIds) > 100) jsonError(400, '한 번에 최대 100건');

    // DDL operations MUST run BEFORE any beginTransaction
    _dropLegacyTrigger();

    $results = [];
    foreach ($txIds as $txId) {
        $txId = (int)$txId;
        if ($txId <= 0) { $results[] = ['tx_id' => $txId, 'ok' => false, 'error' => 'invalid id']; continue; }

        $pdo = DB::pdo();
        $pdo->beginTransaction();
        try {
            $tx = DB::fetchOne("SELECT * FROM wallet_transactions WHERE id=? FOR UPDATE", [$txId]);
            if (!$tx || $tx['kind'] !== 'deposit' || $tx['status'] !== '대기') {
                $pdo->rollBack();
                $results[] = ['tx_id' => $txId, 'ok' => false, 'error' => '처리 불가 (' . ($tx['status'] ?? 'not found') . ')'];
                continue;
            }

            $address = $tx['address'];
            $amount = (float)$tx['amount'];
            // 음수/비정상 금액 방지 (일괄 승인 경로)
            if (!is_finite($amount) || $amount <= 0) {
                $pdo->rollBack();
                $results[] = ['tx_id' => $txId, 'ok' => false, 'error' => "비정상 금액 (amount={$amount})"];
                continue;
            }
            $assetCode = strtoupper(trim((string)($tx['asset'] ?? 'USDT')));
            $beforeAmt = 0.0;
            $afterAmt = 0.0;

            if ($assetCode === 'USDT' || $assetCode === '') {
                DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?, 0)", [$address]);
                $balRow = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
                $beforeAmt = (float)($balRow['usdt'] ?? 0);
                $afterAmt = $beforeAmt + $amount;
                DB::execute("UPDATE balances SET usdt=? WHERE address=?", [$afterAmt, $address]);
            } elseif ($assetCode === 'SILICASTO') {
                $assetId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';
                ensureHolding($address, $assetId);
                $holdRow = DB::fetchOne("SELECT silica_sto_balance FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetId]);
                $beforeAmt = (float)($holdRow['silica_sto_balance'] ?? 0);
                $afterAmt = $beforeAmt + $amount;
                DB::execute(
                    "UPDATE holdings
                        SET silica_sto_balance = silica_sto_balance + ?,
                            balance_token      = balance_token + ?
                      WHERE address=? AND asset_id=?",
                    [$amount, $amount, $address, $assetId]
                );
            } elseif ($assetCode === 'SILICA') {
                $assetId = function_exists('silicaGetSingleAssetId') ? silicaGetSingleAssetId() : 'SILICA-79907';
                ensureHolding($address, $assetId);
                $holdRow = DB::fetchOne("SELECT silica_balance FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetId]);
                $beforeAmt = (float)($holdRow['silica_balance'] ?? 0);
                $afterAmt = $beforeAmt + $amount;
                DB::execute(
                    "UPDATE holdings SET silica_balance = silica_balance + ? WHERE address=? AND asset_id=?",
                    [$amount, $address, $assetId]
                );
            } else {
                ensureHolding($address, $assetCode);
                $holdRow = DB::fetchOne("SELECT balance_token FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetCode]);
                $beforeAmt = (float)($holdRow['balance_token'] ?? 0);
                $afterAmt = $beforeAmt + $amount;
                DB::execute("UPDATE holdings SET balance_token=? WHERE address=? AND asset_id=?", [$afterAmt, $address, $assetCode]);
            }
            DB::execute(
                "UPDATE wallet_transactions SET status='입금완료', before_amount=?, after_amount=? WHERE id=?",
                [$beforeAmt, $afterAmt, $txId]
            );

            $pdo->commit();
            $results[] = ['tx_id' => $txId, 'ok' => true, 'amount' => $amount];
            error_log("[admin_deposit] BATCH_APPROVED tx_id={$txId} address={$address} amount={$amount} by={$admin['username']}");
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $results[] = ['tx_id' => $txId, 'ok' => false, 'error' => $e->getMessage()];
        }
    }

    jsonOk(['results' => $results]);
});

// Reject a deposit
post('/api/admin/deposit/reject', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    $txId = (int)($body['tx_id'] ?? 0);
    // (2026-05-07) reason / contact 필수화 — 거절 시 사용자가 관리자에게 문의할 수
    //   있도록 사유와 연락처를 반드시 받는다. 빈 입력은 거부 (400).
    //   admin_contact: 이메일 / 텔레그램 / 카카오 ID 등 자유 형식 (4~120자).
    //   reason: 4~500자.
    $reason = trim((string)($body['reason'] ?? ''));
    $adminContact = trim((string)($body['admin_contact'] ?? $body['contact'] ?? ''));
    if ($txId <= 0) jsonError(400, 'tx_id 필요');
    if (mb_strlen($reason) < 4 || mb_strlen($reason) > 500) {
        jsonError(400, '거절 사유는 4~500자 사이여야 합니다. 사용자가 이해할 수 있도록 명확히 작성해 주세요.');
    }
    if (mb_strlen($adminContact) < 4 || mb_strlen($adminContact) > 120) {
        jsonError(400, '관리자 연락처는 4~120자 사이여야 합니다 (이메일 / Telegram / KakaoTalk ID 등).');
    }

    // DDL MUST run BEFORE beginTransaction
    _dropLegacyTrigger();
    $hasNote = _ensureAdminNoteCol();

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $tx = DB::fetchOne("SELECT * FROM wallet_transactions WHERE id=? FOR UPDATE", [$txId]);
        if (!$tx) { $pdo->rollBack(); jsonError(404, '거래를 찾을 수 없습니다.'); }
        if ($tx['kind'] !== 'deposit') { $pdo->rollBack(); jsonError(400, '입금 거래가 아닙니다.'); }
        if ($tx['status'] !== '대기') { $pdo->rollBack(); jsonError(400, "이미 처리된 거래입니다. (현재 상태: {$tx['status']})"); }

        // memo: legacy 추적용으로 |reject:<요약> 형태 유지 (admin 측 검색에 사용).
        $memoAppend = "|reject:" . mb_substr($reason, 0, 60);
        $newMemo = ($tx['memo'] ?? '') . $memoAppend;
        // admin_note: 사용자에게 노출되는 정식 거절 사유 + 연락처 (구조화된 텍스트).
        //   클라이언트(silica-data-bind.js / deposit.js)는 "Reason:" / "Contact:"
        //   prefix 를 파싱하여 별도 라인으로 표시한다.
        $adminNoteText = "Reason: {$reason}\nContact: {$adminContact}";
        if ($hasNote) {
            DB::execute(
                "UPDATE wallet_transactions SET status='실패', memo=?, admin_note=? WHERE id=?",
                [mb_substr($newMemo, 0, 255), mb_substr($adminNoteText, 0, 500), $txId]
            );
        } else {
            // admin_note 컬럼 자동 생성 실패 시 fallback — memo 에만 저장 (저장 누락 방지).
            DB::execute(
                "UPDATE wallet_transactions SET status='실패', memo=? WHERE id=?",
                [mb_substr($newMemo . " | " . $adminNoteText, 0, 255), $txId]
            );
        }

        $pdo->commit();
        error_log("[admin_deposit] REJECTED tx_id={$txId} address={$tx['address']} amount={$tx['amount']} reason={$reason} contact={$adminContact} by={$admin['username']}");
        jsonOk([
            'tx_id' => $txId,
            'status' => '실패',
            'reason' => $reason,
            'admin_contact' => $adminContact,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '거절 처리 실패: ' . $e->getMessage());
    }
});
