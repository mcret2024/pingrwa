<?php
/**
 * Funding, Refund, Claim routes
 */

if (!function_exists('normalizeWholeFundingAmount')) {
    function normalizeWholeFundingAmount($raw, string $label = '투자 금액'): int {
        if ($raw === null || $raw === '') jsonError(400, $label . '을 입력하세요.');
        $amount = (float)$raw;
        if (!is_finite($amount) || $amount <= 0) jsonError(400, $label . '이 올바르지 않습니다.');
        if (abs($amount - round($amount)) > 0.000001) jsonError(400, $label . '은 정수만 입력할 수 있습니다.');
        return (int)round($amount);
    }
}

post('/api/funding', function () {
    // (2026-05-15 v398) 운영 종료 가드 — 종료 진행 중 또는 영구 폐쇄 상태에서
    //   신규 투자/모금 참여 차단. 이미 보유한 자산의 출금/매도/클레임은 별개.
    //   (v399) 한국어 / 영문 양어 메시지.
    //   (v466) requestLocale() 기반 단일 언어 — 사용자 보고: 팝업 양어 혼합.
    if (function_exists('silicaIsServiceActive') && !silicaIsServiceActive()) {
        jsonError(423, pickLocaleMsg([
            'ko' => '서비스 운영 종료 절차가 진행 중입니다. 신규 투자 참여가 차단되었습니다.',
            'en' => 'Service wind-down in progress. New investment is blocked.',
        ]));
    }

    $user = authMfaRequired();
    $address = $user['address'];
    $body = getJsonBody();

    $assetId = trim($body['assetId'] ?? '');
    $amount = normalizeWholeFundingAmount($body['amount'] ?? null, '참여 금액');
    // (2026-05-16 v419) 운영자 우려: '없는 추천인 코드나 주소 입력 후 그대로
    //   투자 버튼을 눌려서 투자 진행이 가능한가?' 검증 — 이미 backend 가
    //   validateReferralAssignment 로 차단 (line ~130 jsonError 400). 단
    //   기존 normalizeReferralCode 가 strtoupper 호출 → 주소 입력 시 대문자
    //   변환 → BINARY 매치 실패 → v418 의 주소 지원이 funding.php 에서 미반영.
    //   raw trim 으로 변경 (정규화는 validateReferralAssignment 안에서 자동).
    $refCode = !empty($body['refCode']) ? trim((string)$body['refCode']) : null;
    $contractId = (int)($body['contractId'] ?? 0);
    $otp = trim($body['otp'] ?? '');

    if (!$assetId) jsonError(400, 'assetId 필요');
    if ($contractId <= 0) jsonError(400, '전자계약서 작성이 필요합니다.');

    try { verifyUserTxnOtpOrThrow($address, $otp); }
    catch (Throwable $e) { jsonError(400, $e->getMessage()); }

    syncAssetStatusIfNeeded($assetId);

    $contractHasFundingRecordId = dbColumnExists('investment_contracts', 'funding_record_id');
    $contractHasOtpVerifiedAt = dbColumnExists('investment_contracts', 'otp_verified_at');
    $contractHasRejectedReason = dbColumnExists('investment_contracts', 'rejected_reason');
    $fundingRecordsHasContractId = dbColumnExists('funding_records', 'contract_id');

    // (2026-05-16 v432) ensure* 함수들의 self-healing DDL (CREATE TABLE IF NOT
    //   EXISTS) 을 transaction 시작 전에 워밍업 호출. MySQL/InnoDB 는 DDL 명령
    //   에서 implicit commit 을 발생시켜 진행 중인 transaction 을 끝내버린다.
    //   → 후속 $pdo->rollBack() / commit() 시 'There is no active transaction'
    //   에러 발생 (사용자 보고 시나리오). static $done 가드로 한 번만 실행되므로
    //   여기서 미리 호출하면 transaction 안에서는 no-op.
    if (function_exists('ensureReferralTables')) ensureReferralTables();
    if (function_exists('ensureReferralBonusPayoutsTable')) ensureReferralBonusPayoutsTable();

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        lockUserRowForUpdate($address);

        $asset = DB::fetchOne("SELECT * FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$asset) { $pdo->rollBack(); jsonError(404, '자산 없음'); }
        // Silica 단순 상태머신: 매각/매각완료가 아닌 모든 상태에서 신규 투자 허용.
        // (DB ENUM 마이그레이션 기간 동안 legacy 값들도 일괄 허용 — 실제로는 전부 ACTIVE 로 마이그레이션됨)
        $assetStatus = (string)($asset['status'] ?? '');
        if (in_array($assetStatus, [STATUSES['SOLD'], STATUSES['SALE_DISTRIBUTED']], true)) {
            $pdo->rollBack();
            jsonError(400, '매각 진행/완료 상태인 자산에는 신규 투자할 수 없습니다.');
        }

        $contract = DB::fetchOne(
            "SELECT * FROM investment_contracts WHERE id=? AND asset_id=? AND address=? FOR UPDATE",
            [$contractId, $assetId, $address]
        );
        if (!$contract) { $pdo->rollBack(); jsonError(400, '유효한 전자계약서가 없습니다.'); }

        $contractStatus = (string)($contract['status'] ?? '');
        $contractAmount = (float)($contract['amount_usdt'] ?? 0);
        if (abs($contractAmount - round($contractAmount)) > 0.000001) {
            $pdo->rollBack();
            jsonError(400, '기존 전자계약서 금액에 소수점이 포함되어 있습니다. 계약서를 다시 작성하세요.');
        }
        if (!(abs($contractAmount - $amount) <= 0.000001)) {
            $pdo->rollBack();
            jsonError(400, '참여 금액이 전자계약서 금액과 일치하지 않습니다. 계약서를 다시 작성하세요.');
        }

        $dupByContract = null;
        if ($fundingRecordsHasContractId) {
            $dupByContract = DB::fetchOne(
                "SELECT id FROM funding_records WHERE contract_id=? LIMIT 1 FOR UPDATE",
                [$contractId]
            );
        }
        $existingFundingId = $contractHasFundingRecordId ? (int)($contract['funding_record_id'] ?? 0) : 0;
        if ($dupByContract) {
            $existingFundingId = (int)($dupByContract['id'] ?? 0);
        }
        if ($existingFundingId > 0 || $contractStatus === 'completed') {
            $pdo->rollBack();
            jsonError(400, '이미 확정된 참여 계약입니다. 추가 참여는 새 계약서를 작성한 뒤 진행하세요.');
        }
        if ($contractStatus === 'awaiting_admin') {
            $pdo->rollBack();
            jsonError(400, '이미 관리자 서명 대기 중인 계약입니다. 이 계약은 다시 접수할 수 없습니다.');
        }
        if ($contractStatus !== 'user_signed') {
            $pdo->rollBack();
            jsonError(400, '전자계약서 서명이 완료되지 않았습니다.');
        }

        // Silica 는 모집 목표(target_usdt)·잔여 캡 개념 없음 — 사전 발행 1B STO 상시 분배.
        // target/raised 는 통계용으로만 보존하고 신규 투자 차단 조건으로는 사용하지 않는다.
        $raisedConfirmed = (float)($asset['raised_usdt'] ?? 0);
        if ($amount < (float)($asset['min_usdt'] ?? 0)) { $pdo->rollBack(); jsonError(400, "최소 참여 {$asset['min_usdt']} USDT"); }

        $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
        if ((float)($bal['usdt'] ?? 0) < $amount) { $pdo->rollBack(); jsonError(400, 'USDT 잔액 부족'); }

        if ($refCode) {
            // (2026-05-16 v424) 운영자 정책: 첫 참여 확정 전이면 추천인 변경 가능.
            //   funding.php 는 funding_records 가 아직 없는 시점(곧 INSERT 됨)
            //   이므로 hasUserFundingRequest 가 false 가 정상. 즉 이 경로로
            //   진입한 사용자는 '첫 참여 직전' 상태로 간주, 기존 link 가 있어도
            //   다른 코드를 보내면 교체 허용. 단 같은 코드면 silent skip.
            $existingLink = getReferralLinkForInvestor($address, true);
            if ($existingLink) {
                // 'same referrer' 감별 — validateReferralAssignment 와 동일 로직.
                $existingCode    = (string)($existingLink['referrer_code'] ?? '');
                $existingRefAddr = (string)($existingLink['referrer_address'] ?? '');
                $input = trim((string)$refCode);
                $isAddrInput = (strlen($input) >= 32 && preg_match('/^[1-9A-HJ-NP-Za-km-z]+$/', $input));
                $sameReferrer = $isAddrInput
                    ? hash_equals($existingRefAddr, $input)
                    : hash_equals(strtoupper($existingCode), strtoupper($input));

                if ($sameReferrer) {
                    // 동일 추천인 — 변경 불필요, 그대로 유지 (frontend 자동 채움 정상 흐름).
                } else {
                    // (2026-05-16 v429) 다른 추천인 입력 → hasUserSignedFunding
                    //   재검증 후 교체. ignoreContractId=$contractId 로 현재 처리
                    //   중인 user_signed contract 자기 자신은 제외 — 첫 funding 의
                    //   contract 가 자기 자신 1개뿐이면 통과, 다른 contract 가
                    //   있으면 차단.
                    if (hasUserSignedFunding($address, null, $contractId)) {
                        $pdo->rollBack();
                        jsonError(400, '이미 서명한 투자 계약서가 있어 추천인을 설정할 수 없습니다.');
                    }
                    DB::execute("DELETE FROM referral_links WHERE id=?", [$existingLink['id']]);
                    $existingLink = null;
                }
            }

            if (!$existingLink) {
                // (2026-05-16 v429) $contractId 전달 — 첫 funding 시점에 자기
                //   자신 contract (status='user_signed') 가 hasUserSignedFunding
                //   에서 잡혀 차단되는 false-positive 방지.
                $validation = validateReferralAssignment($address, $refCode, $contractId);
                if (empty($validation['ok'])) {
                    $pdo->rollBack();
                    jsonError(400, $validation['message'] ?? '추천인 코드 적용 실패');
                }

                DB::execute(
                    "INSERT INTO referral_links(investor_address, referrer_address, referrer_code) VALUES (?,?,?)",
                    [$address, $validation['referrer']['address'], $validation['code']]
                );
            }
        }

        // (2026-05-06) wallet_transactions 기록 — 거래 내역 페이지에서 보이도록.
        // USDT 잔액 변동 캡처: 차감 전 잔액 = (현재 잔액 + amount), 차감 후 = 현재 잔액
        $usdtBefore = (float)($bal['usdt'] ?? 0);
        $usdtAfter  = max(0.0, $usdtBefore - $amount);
        DB::execute("UPDATE balances SET usdt=usdt-? WHERE address=?", [$amount, $address]);
        try {
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [$address, 'invest', '대기', 'USDT', $amount, $usdtBefore, $usdtAfter, "투자 신청 (자산 {$assetId}, 계약 #{$contractId})", nowUtcSql()]
            );
        } catch (Throwable $txLogErr) {
            // wallet_transactions 기록 실패는 본 트랜잭션에 영향 없음 — 로그만 남김
            error_log('wallet_transactions invest log failed: ' . $txLogErr->getMessage());
        }

        $contractUpdateSet = ["status='awaiting_admin'", "updated_at=?"];
        $contractUpdateParams = [nowUtcSql()];
        if ($contractHasOtpVerifiedAt) {
            array_unshift($contractUpdateSet, "otp_verified_at=?");
            array_unshift($contractUpdateParams, nowUtcSql());
        }
        if ($contractHasRejectedReason) {
            $contractUpdateSet[] = "rejected_reason=NULL";
        }
        $contractUpdateParams[] = $contractId;
        DB::execute(
            "UPDATE investment_contracts SET " . implode(', ', $contractUpdateSet) . " WHERE id=?",
            $contractUpdateParams
        );

        writeContractAudit($pdo, [
            'contractId' => $contractId,
            'actorType'  => 'user',
            'actorId'    => $address,
            'actionType' => 'funding_requested',
            'ip'         => getReqIp(),
            'userAgent'  => getReqUserAgent(),
            'payload'    => [
                'asset_id' => $assetId,
                'amount_usdt' => $amount,
                'otp_verified' => true,
            ],
        ]);

        $pdo->commit();

        $pendingReserved = computeAssetPendingReservedUSDT($assetId);
        jsonOk([
            'raised_usdt' => $raisedConfirmed,
            'pending_reserved_usdt' => $pendingReserved,
            'status' => $asset['status'],
            'contract_status' => 'awaiting_admin',
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('/api/funding failed: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        jsonError(500, '모금 참여 처리 중 서버 오류가 발생했습니다. 스키마 최신화 후 다시 시도하세요.', [
            'detail' => $e->getMessage(),
        ]);
    }
});

get('/api/funding/:assetId', function ($p) {
    $user = authMfaRequired();
    $address = $user['address'];
    $assetId = trim((string)($p['assetId'] ?? ''));
    if ($assetId === '') jsonError(400, 'assetId 필요');

    // NOTE:
    // The funding page must show more than confirmed funding_records.
    // Users also need to see:
    //  - awaiting_admin contracts as '대기중'
    //  - refund_records as '환불 완료'
    // Otherwise a pending participation looks like "no history", and when funding is canceled
    // the refund/history button appears to do nothing because the refund trail is invisible.
    $contractHasOtpVerifiedAt = dbColumnExists('investment_contracts', 'otp_verified_at');
    $contractHasFundingRecordId = dbColumnExists('investment_contracts', 'funding_record_id');
    $fundingRecordsHasContractId = dbColumnExists('funding_records', 'contract_id');

    $pendingCreatedAtExpr = $contractHasOtpVerifiedAt
        ? "COALESCE(c.otp_verified_at, c.user_signed_at, c.created_at, c.updated_at)"
        : "COALESCE(c.user_signed_at, c.created_at, c.updated_at)";
    $pendingJoin = $fundingRecordsHasContractId
        ? "LEFT JOIN funding_records fr ON fr.contract_id = c.id"
        : "";
    $pendingWhere = [
        "c.address=?",
        "c.asset_id=?",
        "c.status='awaiting_admin'",
        "COALESCE(c.amount_usdt,0) > 0",
    ];
    if ($fundingRecordsHasContractId) {
        $pendingWhere[] = "fr.id IS NULL";
    }
    if ($contractHasFundingRecordId) {
        $pendingWhere[] = "(c.funding_record_id IS NULL OR c.funding_record_id=0)";
    }

    $rows = DB::fetchAll(
        "SELECT *
           FROM (
                SELECT CONCAT('funding_record:', CAST(f.id AS CHAR)) AS row_key,
                       'funding_record' AS entry_kind,
                       f.id AS source_id,
                       f.amount_usdt,
                       f.created_at,
                       'confirmed' AS status_group,
                       '참여완료' AS status_label
                  FROM funding_records f
                 WHERE f.address=? AND f.asset_id=?
                UNION ALL
                SELECT CONCAT('pending_contract:', CAST(c.id AS CHAR)) AS row_key,
                       'pending_contract' AS entry_kind,
                       c.id AS source_id,
                       c.amount_usdt,
                       {$pendingCreatedAtExpr} AS created_at,
                       'pending' AS status_group,
                       '대기중' AS status_label
                  FROM investment_contracts c
                  {$pendingJoin}
                 WHERE " . implode(' AND ', $pendingWhere) . "
                UNION ALL
                SELECT CONCAT('refund_record:', CAST(r.id AS CHAR)) AS row_key,
                       'refund_record' AS entry_kind,
                       r.id AS source_id,
                       r.amount_usdt,
                       r.created_at,
                       'refund' AS status_group,
                       '환불 완료' AS status_label
                  FROM refund_records r
                 WHERE r.address=? AND r.asset_id=?
           ) t
       ORDER BY t.created_at DESC, t.source_id DESC",
        [$address, $assetId, $address, $assetId, $address, $assetId]
    );

    $confirmedUsdt = 0.0;
    $pendingUsdt = 0.0;
    $refundUsdt = 0.0;
    foreach ($rows as $row) {
        $amt = (float)($row['amount_usdt'] ?? 0);
        $group = (string)($row['status_group'] ?? '');
        if ($group === 'confirmed') $confirmedUsdt += $amt;
        elseif ($group === 'pending') $pendingUsdt += $amt;
        elseif ($group === 'refund') $refundUsdt += $amt;
    }

    jsonOk([
        'rows' => $rows,
        'summary' => [
            'confirmed_usdt' => $confirmedUsdt,
            'pending_usdt' => $pendingUsdt,
            'refund_usdt' => $refundUsdt,
            'net_participation_usdt' => max(0.0, ($confirmedUsdt + $pendingUsdt) - $refundUsdt),
        ],
    ]);
});

post('/api/refunds', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $body = getJsonBody();
    $assetId = trim($body['assetId'] ?? '');
    $amountReq = isset($body['amount']) ? (float)$body['amount'] : null;

    if (!$assetId) jsonError(400, 'assetId 필요');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        ensureUser($address);
        $asset = DB::fetchOne("SELECT * FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$asset) jsonError(404, '자산 없음');
        if (!in_array($asset['status'], [STATUSES['FAILED'], STATUSES['CANCELED']], true)) jsonError(400, '환불 가능한 상태가 아닙니다.');

        $funded = computeUserFundedUSDT($address, $assetId);
        if ($funded <= 0) jsonError(400, '환불 가능 금액이 없습니다.');

        $amt = $amountReq === null ? $funded : min($funded, max(0, $amountReq));
        if ($amt <= 0) jsonError(400, '환불 금액이 올바르지 않습니다.');

        DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$amt, $address]);
        DB::execute("INSERT INTO refund_records(address, asset_id, amount_usdt) VALUES (?,?,?)", [$address, $assetId, $amt]);

        $pdo->commit();
        jsonOk(['refunded' => $amt]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError(500, '서버 오류: ' . $e->getMessage());
    }
});

// ── /api/claim — Deprecated 2026-05-05 ──
// Silica 단순 분배 모델로 전환되면서 STO 토큰 클레임은 별도 사용자 액션이 아니라
// 관리자 서명(/api/admin/contracts/:id/admin-sign) 시점에 holdings.silica_sto_balance 가
// 즉시 자동 증액된다. 따라서 이 엔드포인트는 더 이상 호출되지 않아야 하며,
// 호출되더라도 No-op 으로 200 을 반환해 옛 클라이언트 캐시를 안전하게 처리한다.
// (이자 클레임은 /api/interest/claim, 배당 클레임은 별도 경로 — 이쪽은 그대로 유지.)
post('/api/claim', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $body = getJsonBody();
    $assetId = trim($body['assetId'] ?? '');
    $ip = getReqIp();
    $ua = getReqUserAgent();

    logClaimRecord([
        'address' => $address, 'asset_id' => $assetId ?: '-', 'ok' => true,
        'message' => 'noop_auto_credit_on_admin_sign',
        'ip' => $ip, 'user_agent' => $ua,
    ]);

    jsonOk([
        'claimed' => 0,
        'token_mode' => 'auto_credit',
        'message' => '관리자 서명 시점에 자동 분배되므로 별도 클레임 동작이 필요하지 않습니다.',
    ]);
});

get('/api/claim/history', function () {
    $user = authMfaRequired();
    $assetId = trim($_GET['assetId'] ?? '');
    $sql = "SELECT id, asset_id, ok, message, claimed_token, entitled_token, already_claimed_token, created_at FROM claim_records WHERE address=?";
    $params = [$user['address']];
    if ($assetId) { $sql .= " AND asset_id=?"; $params[] = $assetId; }
    $sql .= " ORDER BY id DESC LIMIT 100";
    jsonOk(['rows' => DB::fetchAll($sql, $params)]);
});

function buildClaimStatusRowForAddress(string $address, array $asset): array {
    $aid = (string)($asset['id'] ?? $asset['asset_id'] ?? '');
    $funded = computeUserFundedUSDT($address, $aid);
    $holding = DB::fetchOne("SELECT balance_token, staked_token, claimed_token FROM holdings WHERE address=? AND asset_id=?", [$address, $aid]) ?: [];
    $row = array_merge($asset, $holding);
    $localMode = isLocalCurrencyTokenMode($row);
    $fx = (float)($row['fx_at_funding'] ?? 0);
    $supply = (float)($row['supply_token'] ?? 0);
    $denom = (float)($row['funded_snapshot_usdt'] ?? 0);
    $entitled = 0.0;
    if ($localMode) {
        if ($fx > 0) $entitled = clamp6($funded * $fx);
    } else {
        if ($supply > 0 && $denom > 0) $entitled = clamp6($funded * ($supply / $denom));
    }
    $claimed = (float)($holding['claimed_token'] ?? 0);
    $available = max(0, clamp6($entitled - $claimed));
    $assetStatus = (string)($row['status'] ?? $row['asset_status'] ?? '');
    $canClaim = in_array($assetStatus, [STATUSES['DISTRIBUTING'], STATUSES['OPERATING'], STATUSES['SOLD']], true) && $available > 0;
    $claimState = $canClaim
        ? 'claimable'
        : (($claimed > 0 && $available <= 0) ? 'claimed' : 'waiting');

    return [
        'assetId' => $aid,
        'id' => $aid,
        'assetStatus' => $assetStatus,
        'status' => $assetStatus,
        'assetName' => $row['name'] ?? $row['asset_name'] ?? $aid,
        'name' => $row['name'] ?? $row['asset_name'] ?? $aid,
        'settlement_basis' => strtoupper((string)($row['settlement_basis'] ?? 'KRW')),
        'token_mode' => $localMode ? 'local_currency' : 'legacy',
        'fx_at_funding' => $fx,
        'fundedUSDT' => $funded,
        'funded_usdt' => $funded,
        'entitledToken' => $entitled,
        'entitled_token' => $entitled,
        'alreadyClaimedToken' => $claimed,
        'claimed_token' => $claimed,
        'already_claimed_token' => $claimed,
        'availableToken' => $available,
        'available_token' => $available,
        'balance_token' => (float)($holding['balance_token'] ?? 0),
        'staked_token' => (float)($holding['staked_token'] ?? 0),
        'supply_token' => $supply,
        'funded_snapshot_usdt' => $denom,
        'token_mint_address' => (string)($row['token_mint_address'] ?? ''),
        'token_ready' => trim((string)($row['token_mint_address'] ?? '')) !== '',
        'token_name' => getAssetTokenName($row),
        'token_symbol' => getAssetTokenSymbol($row),
        'token_decimals' => getAssetTokenDecimals($row),
        'canClaim' => $canClaim,
        'claim_state' => $claimState,
        'claim_label' => $claimState === 'claimable' ? '클레임' : ($claimState === 'claimed' ? '클레임(완료)' : '확인'),
    ];
}

get('/api/claim/status', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $assetId = trim($_GET['assetId'] ?? $_GET['asset_id'] ?? '');

    if ($assetId !== '') {
        $asset = DB::fetchOne("SELECT id, name, status, settlement_basis, supply_token, funded_snapshot_usdt, fx_at_funding, token_mint_address FROM assets WHERE id=?", [$assetId]);
        if (!$asset) jsonError(404, '자산 없음');
        jsonOk(buildClaimStatusRowForAddress($address, $asset));
        return;
    }

    $assets = DB::fetchAll(
        "SELECT DISTINCT a.id, a.name, a.status, a.settlement_basis, a.supply_token, a.funded_snapshot_usdt, a.fx_at_funding, a.token_mint_address
           FROM funding_records f
           JOIN assets a ON a.id=f.asset_id
          WHERE f.address=?
       ORDER BY a.id ASC",
        [$address]
    );
    $result = array_map(fn($row) => buildClaimStatusRowForAddress($address, $row), $assets);
    jsonOk(['claims' => $result]);
});

get('/api/claim/my-assets', function () {
    $user = authMfaRequired();
    $address = $user['address'];

    $claimableStatuses = [STATUSES['DISTRIBUTING'], STATUSES['OPERATING'], STATUSES['SOLD']];
    $placeholders = implode(',', array_fill(0, count($claimableStatuses), '?'));

    $rows = DB::fetchAll(
        "SELECT DISTINCT a.id, a.name, a.status, a.settlement_basis, a.supply_token, a.funded_snapshot_usdt, a.fx_at_funding, a.token_mint_address
         FROM funding_records f
         JOIN assets a ON a.id = f.asset_id
         WHERE f.address=? AND a.status IN ({$placeholders})
         ORDER BY a.name",
        array_merge([$address], $claimableStatuses)
    );

    $assets = array_map(fn($row) => buildClaimStatusRowForAddress($address, $row), $rows);
    jsonOk(['assets' => $assets]);
});
