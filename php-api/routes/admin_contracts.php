<?php
/**
 * Admin Contract routes
 */

get('/api/admin/contracts', function () {
    $admin = adminAuth();
    $status = $_GET['status'] ?? 'awaiting_admin';
    // (2026-05-17 v451) 운영자 요청: 좌측 contract 카드에 자산명 대신 KYC 유저
    //   실명 표시. users 테이블 LEFT JOIN + mt_name / kyc_extracted_name 가져옴.
    //   decodeMaybeStoredText 로 PHP 단에서 복호화 (한국어 한글 인코딩 처리).
    $rows = DB::fetchAll(
        "SELECT c.*, a.name AS asset_name,
                u.mt_name, u.kyc_extracted_name, u.kyc_yn, u.kyc_status
         FROM investment_contracts c
         LEFT JOIN assets a ON a.id=c.asset_id
         LEFT JOIN users u ON u.address=c.address
         WHERE c.status=?
         ORDER BY c.id DESC LIMIT 200",
        [$status]
    );
    // (2026-05-17 v440) 운영자 보고: '관리자가 자산설정에서 입력한 자산명값이
    //   아닌 다른 값으로 나옴'. admin 에서 입력한 name_ko / name_en 을 함께
    //   반환해서 admin/js/contracts.js 가 lang 분기로 표시.
    if (function_exists('enrichRowsWithI18nAssetNames')) enrichRowsWithI18nAssetNames($rows);
    // (v451) mt_name 등 한국어 텍스트 복호화.
    if (function_exists('decodeMaybeStoredText')) {
        foreach ($rows as &$row) {
            $row['mt_name'] = decodeMaybeStoredText($row['mt_name'] ?? null);
            $row['kyc_extracted_name'] = decodeMaybeStoredText($row['kyc_extracted_name'] ?? null);
        }
        unset($row);
    }
    jsonOk(['contracts' => $rows]);
});

get('/api/admin/contracts/pending-count', function () {
    adminAuth();
    $count = (int)DB::fetchValue("SELECT COUNT(*) FROM investment_contracts WHERE status='awaiting_admin'");
    jsonOk(['count' => $count]);
});

get('/api/admin/contracts/all', function () {
    adminAuth();
    $limit = min(500, max(1, (int)($_GET['limit'] ?? 100)));
    // (2026-05-17 v451) KYC 사용자 정보도 함께 반환 — 카드 표시용.
    $rows = DB::fetchAll(
        "SELECT c.*, a.name AS asset_name,
                u.mt_name, u.kyc_extracted_name, u.kyc_yn, u.kyc_status
         FROM investment_contracts c
         LEFT JOIN assets a ON a.id=c.asset_id
         LEFT JOIN users u ON u.address=c.address
         ORDER BY c.id DESC LIMIT {$limit}"
    );
    if (function_exists('enrichRowsWithI18nAssetNames')) enrichRowsWithI18nAssetNames($rows);
    if (function_exists('decodeMaybeStoredText')) {
        foreach ($rows as &$row) {
            $row['mt_name'] = decodeMaybeStoredText($row['mt_name'] ?? null);
            $row['kyc_extracted_name'] = decodeMaybeStoredText($row['kyc_extracted_name'] ?? null);
        }
        unset($row);
    }
    jsonOk(['contracts' => $rows]);
});

get('/api/admin/contracts/stream', function () {
    // SSE stream - simplified for PHP (single response)
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');

    $count = (int)DB::fetchValue("SELECT COUNT(*) FROM investment_contracts WHERE status='awaiting_admin'");
    echo "data: " . json_encode(['count' => $count]) . "\n\n";
    flush();
    exit;
});

get('/api/admin/contracts/:id', function ($p) {
    adminAuth();
    $row = DB::fetchOne(
        "SELECT c.*, a.name AS asset_name, a.settlement_basis,
                u.kyc_yn, u.mt_name, u.mt_birth, u.kyc_doc_type, u.kyc_status, u.kyc_extracted_name, u.kyc_extracted_birth, u.kyc_last_verified_at
         FROM investment_contracts c
         LEFT JOIN assets a ON a.id=c.asset_id
         LEFT JOIN users u ON u.address=c.address
         WHERE c.id=?",
        [$p['id']]
    );
    if (!$row) jsonError(404, '계약 없음');
    $row['mt_name'] = decodeMaybeStoredText($row['mt_name'] ?? null);
    $row['mt_birth'] = decodeMaybeStoredText($row['mt_birth'] ?? null);
    $row['kyc_extracted_name'] = decodeMaybeStoredText($row['kyc_extracted_name'] ?? null);
    $row['kyc_extracted_birth'] = decodeMaybeStoredText($row['kyc_extracted_birth'] ?? null);
    $row['kyc_required'] = !isKycBypassed();
    $row['kyc_approved'] = strtoupper((string)($row['kyc_yn'] ?? 'N')) === 'Y';
    // (2026-05-17 v440) 다국어 자산명 후처리.
    if (function_exists('enrichSingleRowWithI18nAssetNames')) enrichSingleRowWithI18nAssetNames($row);
    jsonOk(['contract' => $row]);
});

// (2026-06-08 v893) PDF 재생성 endpoint — admin 서명 완료된 (status=completed)
//   계약에 대해 PDF 만 재생성. v893 이전 서명된 contract 의 PDF 누락 처리용.
post('/api/admin/contracts/:id/regenerate-pdf', function ($p) {
    adminAuth();
    $contractId = (int)$p['id'];
    $contract = DB::fetchOne("SELECT id, status FROM investment_contracts WHERE id=? LIMIT 1", [$contractId]);
    if (!$contract) jsonError(404, '계약 없음');
    if (($contract['status'] ?? '') !== 'completed') {
        jsonError(400, '서명 완료된 계약만 PDF 재생성 가능합니다.');
    }
    if (!function_exists('generateContractPdf')) {
        jsonError(500, 'PDF 생성 라이브러리 미로드.');
    }
    $path = generateContractPdf($contractId);
    if (!$path) jsonError(500, 'PDF 생성 실패. 서버 로그 확인 필요.');
    jsonOk(['finalized_pdf_path' => $path]);
});

post('/api/admin/contracts/:id/admin-sign', function ($p) {
    $admin = adminAuth();
    $body = getJsonBody();
    $contractId = (int)$p['id'];

    $signatureDataUrl = trim($body['signature_data_url'] ?? $body['signatureDataUrl'] ?? '');
    $signPath = null;
    if ($signatureDataUrl) {
        $signPath = saveBase64PngToUploads($signatureDataUrl, 'admin_sign_' . $contractId);
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $contract = DB::fetchOne("SELECT * FROM investment_contracts WHERE id=? FOR UPDATE", [$contractId]);
        if (!$contract) { $pdo->rollBack(); jsonError(404, '계약 없음'); }
        if (($contract['status'] ?? '') !== 'awaiting_admin') { $pdo->rollBack(); jsonError(400, '관리자 서명 가능 상태가 아닙니다.'); }

        $assetId = (string)($contract['asset_id'] ?? '');
        $asset = DB::fetchOne("SELECT * FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$asset) { $pdo->rollBack(); jsonError(404, '자산 없음'); }

        $fundingRecordsHasContractId = dbColumnExists('funding_records', 'contract_id');
        $contractHasFundingRecordId = dbColumnExists('investment_contracts', 'funding_record_id');

        $existingFunding = $fundingRecordsHasContractId
            ? DB::fetchOne("SELECT * FROM funding_records WHERE contract_id=? LIMIT 1 FOR UPDATE", [$contractId])
            : null;
        $fundingId = (int)($existingFunding['id'] ?? 0);
        if ($fundingId <= 0 && $contractHasFundingRecordId) {
            $fundingId = (int)($contract['funding_record_id'] ?? 0);
        }

        $legacyAlreadyCounted = $fundingId > 0;
        $newRaised = (float)($asset['raised_usdt'] ?? 0);
        $newStatus = $asset['status'];
        $stoCredited = 0.0;

        // ── Silica 단순 분배 모델 (2026-05-05) ──
        // RECON 의 FUNDING→BUYING 전환 / target 도달 검사 / supply 스냅샷 로직 모두 제거.
        // Silica 는 사전 발행 1B STO 가 Reserve 에 영구 보관되며, 1 USDT = 1 STO 페그.
        // 관리자 서명 = funding_records 확정 + holdings.silica_sto_balance 즉시 증액.
        // 별도 "분배중" 단계, 별도 사용자 클레임 액션 없음.
        if (!$legacyAlreadyCounted) {
            // 자산은 ACTIVE 일 때만 신규 확정 가능. SOLD/매각(완료) 상태에서는 차단.
            $assetStatus = (string)($asset['status'] ?? '');
            $isAcceptingInvestments = !in_array($assetStatus, [STATUSES['SOLD'], STATUSES['SALE_DISTRIBUTED']], true);
            if (!$isAcceptingInvestments) {
                $pdo->rollBack();
                jsonError(400, '매각 진행/완료 상태인 자산에는 신규 투자를 확정할 수 없습니다. 해당 계약을 반려하세요.');
            }

            $amountUsdt = (float)($contract['amount_usdt'] ?? 0);
            if ($amountUsdt <= 0) {
                $pdo->rollBack();
                jsonError(400, '계약 금액이 비정상입니다.');
            }

            // 1) funding_records 확정 행 생성
            if ($fundingRecordsHasContractId) {
                $pdo->prepare("INSERT INTO funding_records(address, asset_id, contract_id, amount_usdt) VALUES (?,?,?,?)")
                    ->execute([$contract['address'], $assetId, $contractId, $amountUsdt]);
            } else {
                $pdo->prepare("INSERT INTO funding_records(address, asset_id, amount_usdt) VALUES (?,?,?)")
                    ->execute([$contract['address'], $assetId, $amountUsdt]);
            }
            $fundingId = (int)$pdo->lastInsertId();

            // 2) 자산 raised_usdt 누적 (status 는 ACTIVE 유지 — 단계 전환 없음)
            $newRaised = (float)($asset['raised_usdt'] ?? 0) + $amountUsdt;
            DB::execute("UPDATE assets SET raised_usdt=? WHERE id=?", [$newRaised, $assetId]);

            // 3) holdings 행 보장 + silica_sto_balance 즉시 증액 (1:1 페그)
            //    이 시점부터 사용자는 portfolio.html 에서 STO 보유분을 확인할 수 있고,
            //    스테이킹 / 외부 출금이 즉시 가능해진다. 별도 "토큰 받기" 액션 불필요.
            ensureHolding($contract['address'], $assetId);
            DB::execute(
                "UPDATE holdings
                    SET silica_sto_balance = silica_sto_balance + ?,
                        balance_token      = balance_token + ?,
                        claimed_token      = claimed_token + ?
                  WHERE address=? AND asset_id=?",
                [$amountUsdt, $amountUsdt, $amountUsdt, $contract['address'], $assetId]
            );
            $stoCredited = $amountUsdt;
        }

        $contractUpdateSet = ["status='completed'", "admin_signature_path=?", "admin_signed_at=?", "admin_signed_by=?", "updated_at=?"];
        $contractUpdateParams = [$signPath, nowUtcSql(), $admin['username'], nowUtcSql()];
        if ($contractHasFundingRecordId) {
            array_unshift($contractUpdateSet, "funding_record_id=?");
            array_unshift($contractUpdateParams, $fundingId ?: null);
        }
        $contractUpdateParams[] = $contractId;
        $pdo->prepare(
            "UPDATE investment_contracts SET " . implode(', ', $contractUpdateSet) . " WHERE id=?"
        )->execute($contractUpdateParams);

        // (2026-05-06) wallet_transactions 기록 — 거래 내역 페이지에 노출.
        // 1) 기존 'invest' '대기' 기록 → '완료' 로 갱신
        // 2) STO 분배 신규 행 추가
        if ($stoCredited > 0 && !empty($contract['address'])) {
            try {
                $pdo->prepare(
                    "UPDATE wallet_transactions
                        SET status='완료',
                            memo=CONCAT(IFNULL(memo,''), ' / 관리자 서명 완료')
                      WHERE address=? AND kind='invest' AND status='대기'
                        AND memo LIKE ?
                      LIMIT 1"
                )->execute([$contract['address'], "%계약 #{$contractId}%"]);

                $h = DB::fetchOne(
                    "SELECT silica_sto_balance FROM holdings WHERE address=? AND asset_id=?",
                    [$contract['address'], $assetId]
                );
                $stoAfter  = (float)($h['silica_sto_balance'] ?? 0);
                $stoBefore = max(0.0, $stoAfter - $stoCredited);
                $pdo->prepare(
                    "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                     VALUES (?,?,?,?,?,?,?,?,?)"
                )->execute([
                    $contract['address'], 'invest_credit', '완료', 'SilicaSTO',
                    $stoCredited, $stoBefore, $stoAfter,
                    "투자 확정 — SilicaSTO 분배 (자산 {$assetId}, 계약 #{$contractId})",
                    nowUtcSql(),
                ]);
            } catch (Throwable $txLogErr) {
                error_log('wallet_transactions admin-sign log failed: ' . $txLogErr->getMessage());
            }
        }

        writeContractAudit($pdo, [
            'contractId' => $contractId,
            'actorType'  => 'admin',
            'actorId'    => $admin['username'],
            'actionType' => 'admin_sign',
            'ip'         => getReqIp(),
            'userAgent'  => getReqUserAgent(),
            'payload'    => [
                'signature_path' => $signPath,
                'funding_record_id' => $fundingId,
                'legacy_already_counted' => $legacyAlreadyCounted,
                'asset_status_after' => $newStatus,
                'raised_usdt_after' => $newRaised,
                'sto_credited' => $stoCredited,
            ],
        ]);

        $pdo->commit();

        // (2026-06-08 v893) 계약 완료 PDF 생성 — admin sign commit 직후 hook.
        //   PDF 생성 실패해도 계약 완료 자체는 영향 없음 (try/catch 외부).
        //   결과는 investment_contracts.finalized_pdf_path 에 저장.
        if (function_exists('generateContractPdf')) {
            try {
                generateContractPdf($contractId);
            } catch (Throwable $e) {
                error_log('[admin-sign] PDF generation failed (계약 완료에는 영향 없음): ' . $e->getMessage());
            }
        }

        // ── 유저측 1회용 팝업 알림 큐잉 (트랜잭션 외부) ──
        // 실패해도 본 서명 트랜잭션은 이미 커밋되었으므로 영향 없음.
        if ($stoCredited > 0 && !empty($contract['address'])) {
            $amountFmt = rtrim(rtrim(number_format($stoCredited, 6, '.', ','), '0'), '.');
            createUserNotification(
                (string)$contract['address'],
                'admin_signed_funding',
                '투자 확정 — SilicaSTO 분배 완료',
                "관리자 서명이 완료되어 {$amountFmt} SilicaSTO 가 즉시 분배되었습니다. 포트폴리오에서 보유분을 확인하세요.",
                [
                    'contract_id' => $contractId,
                    'asset_id' => $assetId,
                    'amount_usdt' => (float)($contract['amount_usdt'] ?? 0),
                    'sto_credited' => $stoCredited,
                    'funding_record_id' => $fundingId,
                ]
            );
        }

        jsonOk([
            'status' => 'completed',
            'funding_record_id' => $fundingId,
            'asset_status' => $newStatus,
            'raised_usdt' => $newRaised,
            'sto_credited' => $stoCredited,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, $e->getMessage());
    }
});

// ────────────────────────────────────────────────────────────────────────────
// 1회용 백필 엔드포인트 (2026-05-05) — 양측 서명까지 끝났으나 옛 클레임 모델
// 결함으로 토큰을 받지 못한 유저에게 미수령분을 1:1 페그로 자동 분배.
// 멱등성: funded - claimed > 0 인 행만 갱신하므로 여러 번 호출해도 안전.
// dryRun=true 인자로 영향 row 수만 조회 가능.
// ────────────────────────────────────────────────────────────────────────────
post('/api/admin/contracts/backfill-orphan-credits', function () {
    $admin = adminAuth();
    $body = getJsonBody();
    $dryRun = !empty($body['dryRun']);

    $rows = DB::fetchAll(
        "SELECT f.address,
                f.asset_id,
                SUM(f.amount_usdt)              AS total_funded,
                COALESCE(MAX(h.claimed_token), 0)      AS claimed_token,
                COALESCE(MAX(h.silica_sto_balance), 0) AS silica_sto_balance,
                (h.address IS NULL)             AS holding_missing
           FROM funding_records f
           LEFT JOIN holdings h
                  ON h.address = f.address
                 AND h.asset_id = f.asset_id
          GROUP BY f.address, f.asset_id, h.address"
    );

    $updated = 0;
    $created = 0;
    $totalCredited = 0.0;
    $notifSent = 0;
    $errors = [];
    $sample = []; // dryRun 시 영향 받는 첫 20건 미리보기

    foreach ($rows as $row) {
        $address = (string)$row['address'];
        $assetId = (string)$row['asset_id'];
        $totalFunded = (float)$row['total_funded'];
        $claimed = (float)$row['claimed_token'];
        $missing = (bool)$row['holding_missing'];

        $diff = $totalFunded - $claimed;
        if ($diff <= 0.000001) continue;

        if ($dryRun) {
            $updated++;
            $totalCredited += $diff;
            if (count($sample) < 20) {
                $sample[] = [
                    'address' => substr($address, 0, 12) . '…',
                    'asset_id' => $assetId,
                    'total_funded' => $totalFunded,
                    'claimed' => $claimed,
                    'will_credit' => $diff,
                    'new_holding' => $missing,
                ];
            }
            continue;
        }

        $pdo = DB::pdo();
        $pdo->beginTransaction();
        try {
            if ($missing) {
                ensureHolding($address, $assetId);
                $created++;
            }
            DB::execute(
                "UPDATE holdings
                    SET silica_sto_balance = silica_sto_balance + ?,
                        balance_token      = balance_token + ?,
                        claimed_token      = claimed_token + ?
                  WHERE address=? AND asset_id=?",
                [$diff, $diff, $diff, $address, $assetId]
            );
            $updated++;
            $totalCredited += $diff;

            $diffFmt = rtrim(rtrim(number_format($diff, 6, '.', ','), '0'), '.');
            $nid = createUserNotification(
                $address,
                'orphan_sto_backfill',
                '미수령 SilicaSTO 가 분배되었습니다',
                "이전 정책에서 양측 서명까지 완료되었으나 미수령 상태였던 {$diffFmt} SilicaSTO 가 분배 자동화 정책 전환에 따라 즉시 분배되었습니다. 포트폴리오에서 보유분을 확인하세요.",
                [
                    'asset_id' => $assetId,
                    'sto_credited' => $diff,
                    'amount_usdt' => $diff,
                    'reason' => 'orphan_backfill_2026_05_05',
                ]
            );
            if ($nid > 0) $notifSent++;

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $errors[] = ['address' => substr($address, 0, 12) . '…', 'asset_id' => $assetId, 'error' => $e->getMessage()];
        }
    }

    jsonOk([
        'dryRun' => $dryRun,
        'updated' => $updated,
        'created_holdings' => $created,
        'total_credited_sto' => $totalCredited,
        'notifications_queued' => $notifSent,
        'errors' => $errors,
        'sample' => $dryRun ? $sample : [],
        'admin' => $admin['username'],
    ]);
});

post('/api/admin/contracts/:id/void', function ($p) {
    $admin = adminAuth();
    $body = getJsonBody();
    $contractId = (int)$p['id'];
    $reason = trim($body['reason'] ?? 'admin_void');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $contract = DB::fetchOne("SELECT * FROM investment_contracts WHERE id=? FOR UPDATE", [$contractId]);
        if (!$contract) { $pdo->rollBack(); jsonError(404, '계약 없음'); }

        $status = (string)($contract['status'] ?? '');
        if ($status === 'rejected') {
            $pdo->rollBack();
            jsonError(400, '이미 반려된 계약입니다.');
        }
        if ($status === 'completed') {
            $pdo->rollBack();
            jsonError(400, '양측 서명이 완료된 계약은 반려할 수 없습니다.');
        }
        if (!in_array($status, ['draft', 'user_signed', 'awaiting_admin'], true)) {
            $pdo->rollBack();
            jsonError(400, '현재 상태에서는 계약을 반려할 수 없습니다.');
        }

        $assetId = (string)($contract['asset_id'] ?? '');
        $asset = $assetId !== '' ? DB::fetchOne("SELECT * FROM assets WHERE id=? FOR UPDATE", [$assetId]) : null;
        $existingFunding = DB::fetchOne("SELECT * FROM funding_records WHERE contract_id=? LIMIT 1 FOR UPDATE", [$contractId]);

        $refundUsdt = 0.0;
        $reversedConfirmedFunding = false;
        $assetStatusAfter = $asset['status'] ?? null;
        $raisedAfter = $asset ? (float)($asset['raised_usdt'] ?? 0) : 0.0;

        if ($status === 'awaiting_admin') {
            $refundUsdt = (float)($contract['amount_usdt'] ?? 0);
            ensureUser($contract['address']);
            DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$refundUsdt, $contract['address']]);

            if ($existingFunding || (int)($contract['funding_record_id'] ?? 0) > 0) {
                $reversedConfirmedFunding = true;
                if ($refundUsdt > 0 && $assetId !== '') {
                    DB::execute("INSERT INTO refund_records(address, asset_id, amount_usdt) VALUES (?,?,?)", [$contract['address'], $assetId, $refundUsdt]);
                }

                if ($asset) {
                    $raisedAfter = max(0.0, (float)($asset['raised_usdt'] ?? 0) - $refundUsdt);
                    $target = (float)($asset['target_usdt'] ?? 0);
                    $assetStatusAfter = $asset['status'];
                    $updateSql = "UPDATE assets SET raised_usdt=?";
                    $params = [$raisedAfter];

                    if (($asset['status'] ?? '') === STATUSES['BUYING'] && $target > 0 && $raisedAfter < $target && !assetHasPostFundingActivity($assetId)) {
                        $assetStatusAfter = STATUSES['FUNDING'];
                        $updateSql .= ", status=?, funded_snapshot_usdt=0, supply_token=0, fx_at_funding=0";
                        $params[] = $assetStatusAfter;
                    }

                    $updateSql .= " WHERE id=?";
                    $params[] = $assetId;
                    DB::execute($updateSql, $params);
                }
            }
        }

        $pdo->prepare(
            "UPDATE investment_contracts
                SET status='rejected',
                    rejected_reason=?,
                    updated_at=?
              WHERE id=?"
        )->execute([$reason, nowUtcSql(), $contractId]);

        // (2026-05-07) Cascade discard — 같은 사용자 + 자산 조합으로 남아있던 다른
        //   draft / user_signed 계약서도 함께 'rejected' 로 정리한다.
        //   이유: 사장님 요청 — 계약이 반려되면 취소이므로 기존 계약서는 파기되어야
        //   한다. cascade 없이는 사용자가 invest 페이지를 다시 열었을 때 이전에
        //   생성됐다가 방치된 draft / user_signed 계약이 잔존해 amount 필드를
        //   잠그고 'REWRITE 버튼' 안내가 계속 뜬다.
        $cascadeDiscarded = 0;
        if ($assetId !== '') {
            $stmt = $pdo->prepare(
                "UPDATE investment_contracts
                    SET status='rejected',
                        rejected_reason=CONCAT('cascade_void:', SUBSTRING(?, 1, 90)),
                        updated_at=?
                  WHERE address=? AND asset_id=?
                    AND status IN ('draft', 'user_signed')
                    AND id <> ?"
            );
            $stmt->execute([$reason ?: 'admin_void', nowUtcSql(), $contract['address'], $assetId, $contractId]);
            $cascadeDiscarded = (int)$stmt->rowCount();
        }

        // (2026-05-07) 반려 시 wallet_transactions 의 invest 행도 같이 갱신.
        // 사용자 history 페이지에서 '반려' status 와 환불 메모 가시화 — 이전엔
        // void 함수가 wallet_transactions 를 건드리지 않아 invest 신청 행이
        // 영원히 'PENDING' 으로 남는 문제 있었다.
        try {
            $pdo->prepare(
                "UPDATE wallet_transactions
                    SET status='반려',
                        memo=CONCAT(IFNULL(memo,''), ' / 관리자 반려: ', SUBSTRING(?, 1, 80))
                  WHERE address=? AND kind='invest' AND status='대기'
                    AND memo LIKE ?
                  LIMIT 1"
            )->execute([$reason ?: 'admin_void', $contract['address'], "%계약 #{$contractId}%"]);

            // 환불 USDT 가 있으면 별도 환불 행 추가 (사용자 잔액 복원 로그).
            if ($refundUsdt > 0) {
                $balRow = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$contract['address']]);
                $usdtAfter  = (float)($balRow['usdt'] ?? 0);
                $usdtBefore = max(0.0, $usdtAfter - $refundUsdt);
                $pdo->prepare(
                    "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                     VALUES (?,?,?,?,?,?,?,?,?)"
                )->execute([
                    $contract['address'], 'invest_refund', '완료', 'USDT',
                    $refundUsdt, $usdtBefore, $usdtAfter,
                    "투자 반려 — USDT 환불 (계약 #{$contractId}" . ($assetId ? ", 자산 {$assetId}" : "") . ")",
                    nowUtcSql(),
                ]);
            }
        } catch (Throwable $txLogErr) {
            error_log('wallet_transactions void log failed: ' . $txLogErr->getMessage());
        }

        writeContractAudit($pdo, [
            'contractId' => $contractId,
            'actorType'  => 'admin',
            'actorId'    => $admin['username'],
            'actionType' => 'void',
            'ip'         => getReqIp(),
            'userAgent'  => getReqUserAgent(),
            'payload'    => [
                'reason' => $reason,
                'prev_status' => $status,
                'refund_usdt' => $refundUsdt,
                'reversed_confirmed_funding' => $reversedConfirmedFunding,
                'asset_status_after' => $assetStatusAfter,
                'raised_usdt_after' => $raisedAfter,
                'cascade_discarded_drafts' => $cascadeDiscarded,
            ],
        ]);

        $pdo->commit();
        jsonOk([
            'status' => 'rejected',
            'reason' => $reason,
            'refund_usdt' => $refundUsdt,
            'reversed_confirmed_funding' => $reversedConfirmedFunding,
            'asset_status' => $assetStatusAfter,
            'raised_usdt' => $raisedAfter,
            'cascade_discarded_drafts' => $cascadeDiscarded,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, $e->getMessage());
    }
});

get('/api/admin/contracts/:id/logs', function ($p) {
    adminAuth();
    $rows = DB::fetchAll(
        "SELECT * FROM contract_audit_logs WHERE contract_id=? ORDER BY id DESC",
        [$p['id']]
    );
    jsonOk(['logs' => $rows]);
});

get('/api/admin/assets/:assetId/contracts', function ($p) {
    adminAuth();
    $rows = DB::fetchAll(
        "SELECT c.*, a.name AS asset_name
         FROM investment_contracts c LEFT JOIN assets a ON a.id=c.asset_id
         WHERE c.asset_id=?
         ORDER BY c.id DESC",
        [$p['assetId']]
    );
    jsonOk(['contracts' => $rows]);
});

// ====== Contract Template Management ======

// Get all assets (for assignment dropdowns in template management)
// NOTE: This static route MUST come before /:id to avoid matching 'assets-list' as :id
get('/api/admin/contract-templates/assets-list', function () {
    adminOnly();
    try {
        $rows = DB::fetchAll("SELECT id, name, status, type FROM assets ORDER BY id");
    } catch (Throwable $e) {
        $rows = [];
    }
    jsonOk(['assets' => $rows]);
});

get('/api/admin/contract-templates', function () {
    adminOnly();
    try {
        $rows = DB::fetchAll(
            "SELECT id, template_code, template_name, template_title, version_no, is_active, created_by, updated_by, created_at, updated_at
             FROM contract_templates ORDER BY template_code, version_no DESC"
        );
    } catch (Throwable $e) {
        // Table may not exist yet
        error_log('contract_templates query failed: ' . $e->getMessage());
        jsonOk(['templates' => []]);
        return;
    }

    // Enrich each template with assigned assets (fail-safe)
    // (2026-05-17 v441) language 컬럼 추가 — admin UI 가 lang 별 배지 표시.
    try {
        foreach ($rows as &$tmpl) {
            $assigned = DB::fetchAll(
                "SELECT m.asset_id, m.language, m.is_active AS mapping_active,
                        a.name AS asset_name, a.status AS asset_status
                 FROM asset_contract_templates m
                 LEFT JOIN assets a ON a.id = m.asset_id
                 WHERE m.template_id=? AND m.is_active=1
                 ORDER BY m.asset_id, (m.language IS NULL) ASC, m.language",
                [(int)$tmpl['id']]
            );
            $tmpl['assigned_assets'] = $assigned;
        }
        unset($tmpl);
    } catch (Throwable $e) {
        // If asset_contract_templates table doesn't exist yet, just skip enrichment
        error_log('Template enrichment failed: ' . $e->getMessage());
        foreach ($rows as &$tmpl) {
            $tmpl['assigned_assets'] = [];
        }
        unset($tmpl);
    }

    jsonOk(['templates' => $rows]);
});

get('/api/admin/contract-templates/:id', function ($p) {
    adminOnly();
    $row = DB::fetchOne("SELECT * FROM contract_templates WHERE id=?", [(int)$p['id']]);
    if (!$row) jsonError(404, '템플릿 없음');
    jsonOk(['template' => $row]);
});

post('/api/admin/contract-templates', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    $code = trim($body['template_code'] ?? '');
    $name = trim($body['template_name'] ?? '');
    $title = trim($body['template_title'] ?? '');
    $bodyHtml = $body['body_html'] ?? '';
    $bodyText = $body['body_text'] ?? null;
    // (2026-05-17 v443) 영문 컬럼 — 옵션. 빈값이면 NULL 저장.
    $titleEn = trim((string)($body['template_title_en'] ?? ''));
    $bodyHtmlEn = (string)($body['body_html_en'] ?? '');
    $bodyTextEn = (string)($body['body_text_en'] ?? '');
    $titleEn = ($titleEn === '' ? null : $titleEn);
    $bodyHtmlEn = ($bodyHtmlEn === '' ? null : $bodyHtmlEn);
    $bodyTextEn = ($bodyTextEn === '' ? null : $bodyTextEn);

    if (!$code) jsonError(400, '템플릿 코드가 필요합니다.');
    if (!$name) jsonError(400, '템플릿 이름이 필요합니다.');
    if (!$title) jsonError(400, '계약서 제목 템플릿이 필요합니다.');
    if (!$bodyHtml) jsonError(400, '계약서 본문(HTML)이 필요합니다.');

    // Get next version number for this code
    $maxVer = (int)DB::fetchValue(
        "SELECT COALESCE(MAX(version_no),0) FROM contract_templates WHERE template_code=?", [$code]
    );
    $newVer = $maxVer + 1;

    DB::execute(
        "INSERT INTO contract_templates (template_code, template_name, template_title, template_title_en, body_html, body_html_en, body_text, body_text_en, version_no, is_active, created_by, updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,1,?,?)",
        [$code, $name, $title, $titleEn, $bodyHtml, $bodyHtmlEn, $bodyText, $bodyTextEn, $newVer, $admin['username'], $admin['username']]
    );

    $newId = (int)DB::pdo()->lastInsertId();

    // (2026-05-17 v444) 전역 단일 active 정책 — 새 row 가 default is_active=1 로
    //   INSERT 되었으므로 다른 모든 row 자동 비활성. 운영자: '활성화 계약서는
    //   1개이어야한다'.
    try {
        DB::execute(
            "UPDATE contract_templates SET is_active=0 WHERE id<>?",
            [$newId]
        );
    } catch (Throwable $e) {
        error_log('[v444] create-time global exclusive failed: ' . $e->getMessage());
    }

    jsonOk(['id' => $newId, 'version_no' => $newVer]);
});

post('/api/admin/contract-templates/:id/update', function ($p) {
    $admin = adminOnly();
    $body = getJsonBody();
    $id = (int)$p['id'];

    $row = DB::fetchOne("SELECT * FROM contract_templates WHERE id=?", [$id]);
    if (!$row) jsonError(404, '템플릿 없음');

    $sets = [];
    $params = [];

    if (isset($body['template_name'])) {
        $sets[] = 'template_name=?';
        $params[] = trim($body['template_name']);
    }
    if (isset($body['template_title'])) {
        $sets[] = 'template_title=?';
        $params[] = trim($body['template_title']);
    }
    if (isset($body['body_html'])) {
        $sets[] = 'body_html=?';
        $params[] = $body['body_html'];
    }
    if (isset($body['body_text'])) {
        $sets[] = 'body_text=?';
        $params[] = $body['body_text'];
    }
    // (2026-05-17 v443) 영문 컬럼 저장. 빈 문자열 → NULL 로 정규화.
    if (array_key_exists('template_title_en', $body)) {
        $sets[] = 'template_title_en=?';
        $v = trim((string)($body['template_title_en'] ?? ''));
        $params[] = ($v === '' ? null : $v);
    }
    if (array_key_exists('body_html_en', $body)) {
        $sets[] = 'body_html_en=?';
        $v = (string)($body['body_html_en'] ?? '');
        $params[] = ($v === '' ? null : $v);
    }
    if (array_key_exists('body_text_en', $body)) {
        $sets[] = 'body_text_en=?';
        $v = (string)($body['body_text_en'] ?? '');
        $params[] = ($v === '' ? null : $v);
    }
    if (isset($body['is_active'])) {
        $sets[] = 'is_active=?';
        $params[] = $body['is_active'] ? 1 : 0;
    }

    if (empty($sets)) jsonError(400, '변경사항 없음');

    $sets[] = 'updated_by=?';
    $params[] = $admin['username'];
    $params[] = $id;

    DB::execute("UPDATE contract_templates SET " . implode(',', $sets) . " WHERE id=?", $params);

    // (2026-05-17 v444) 정책 변경: 운영자 요청 '활성화 계약서는 1개이어야한다'.
    //   기존 v442 의 'template_code 단위 단일 active' → 전역 단일 active.
    //   is_active=1 로 set 시 DB 전체의 다른 모든 row 자동 비활성.
    if (isset($body['is_active']) && $body['is_active']) {
        try {
            DB::execute(
                "UPDATE contract_templates SET is_active=0 WHERE id<>?",
                [$id]
            );
        } catch (Throwable $e) {
            error_log('[v444] global exclusive activate failed: ' . $e->getMessage());
        }
    }

    jsonOk(['updated' => true]);
});

// (2026-05-17 v444) 전역 단일 active 정책 — 모든 다른 row 비활성, 이 id 만 활성.
//   v442 의 template_code 단위 처리에서 전역 단위로 확장.
post('/api/admin/contract-templates/:id/activate', function ($p) {
    $admin = adminOnly();
    $id = (int)$p['id'];
    $row = DB::fetchOne("SELECT id, template_code FROM contract_templates WHERE id=?", [$id]);
    if (!$row) jsonError(404, '템플릿 없음');

    DB::execute(
        "UPDATE contract_templates SET is_active=0, updated_by=? WHERE id<>?",
        [$admin['username'], $id]
    );
    DB::execute(
        "UPDATE contract_templates SET is_active=1, updated_by=? WHERE id=?",
        [$admin['username'], $id]
    );

    jsonOk([
        'activated' => true,
        'id' => $id,
        'template_code' => (string)($row['template_code'] ?? ''),
    ]);
});

post('/api/admin/contract-templates/:id/preview', function ($p) {
    adminOnly();
    $body = getJsonBody();
    $id = (int)$p['id'];

    $tmpl = DB::fetchOne("SELECT * FROM contract_templates WHERE id=?", [$id]);
    if (!$tmpl) jsonError(404, '템플릿 없음');

    // Sample variables for preview
    $vars = [
        'signed_date_kst' => nowKST()->format('Y-m-d H:i:s'),
        'wallet_address'  => 'SaMpLeWaLLeTaDdReSs1234567890abcdefgh',
        'asset_id'        => 'APT001',
        'asset_name'      => '서울 강남 오피스텔 (샘플)',
        'market'          => 'KR-APT001',
        'country_code'    => 'KR',
        'country_name'    => '대한민국',
        'settlement_basis'=> 'KRW',
        'apr'             => '8.00',
        'fund_end_date'   => '2026-06-30',
        'amount_usdt'     => '1,000.000000',
        'amount_local'    => '1,350,000.000000',
        'fx_per_usdt'     => '1,350.000000',
        'min_usdt'        => '50.000000',
        'target_usdt'     => '100,000.000000',
    ];

    // Override with custom vars if provided
    if (!empty($body['vars']) && is_array($body['vars'])) {
        $vars = array_merge($vars, $body['vars']);
    }

    $titleRendered = renderContractTemplate($tmpl['template_title'] ?? '', $vars);
    $bodyRendered = renderContractTemplate($tmpl['body_html'] ?? '', $vars);

    jsonOk([
        'title' => $titleRendered,
        'body_html' => $bodyRendered,
    ]);
});

// ====== Template <-> Asset Assignment Management ======

// Get all assignments for a specific template
get('/api/admin/contract-templates/:id/assets', function ($p) {
    adminOnly();
    $templateId = (int)$p['id'];
    try {
        // (2026-05-17 v441) language 컬럼도 노출.
        $rows = DB::fetchAll(
            "SELECT m.asset_id, m.language, m.is_active AS mapping_active,
                    a.name AS asset_name, a.status AS asset_status
             FROM asset_contract_templates m
             LEFT JOIN assets a ON a.id = m.asset_id
             WHERE m.template_id=?
             ORDER BY m.asset_id, m.language",
            [$templateId]
        );
    } catch (Throwable $e) {
        $rows = [];
    }
    jsonOk(['assignments' => $rows]);
});

// Get template assigned to a specific asset (for asset edit page)
// (2026-05-17 v441) 'assigned' 는 호환성 위해 단일 row 유지 (legacy frontend
//   기대값). 새 'assignments' 배열로 모든 language 매핑 반환.
get('/api/admin/assets/:assetId/template', function ($p) {
    adminOnly();
    if (function_exists('ensureAssetContractTemplatesLanguageColumn')) {
        ensureAssetContractTemplatesLanguageColumn(); // (v498)
    }
    $assetId = $p['assetId'];
    $mapping = null;
    $allMappings = [];
    $allTemplates = [];
    try {
        $allMappings = DB::fetchAll(
            "SELECT m.id AS mapping_id, m.template_id, m.language, m.is_active AS mapping_active,
                    t.template_code, t.template_name, t.template_title, t.version_no, t.is_active AS template_active
             FROM asset_contract_templates m
             JOIN contract_templates t ON t.id = m.template_id
             WHERE m.asset_id=? AND m.is_active=1
             ORDER BY (m.language IS NULL) ASC, m.language ASC, t.version_no DESC",
            [$assetId]
        );
        $mapping = !empty($allMappings) ? $allMappings[0] : null;
    } catch (Throwable $e) {
        error_log('Asset template query failed: ' . $e->getMessage());
    }
    try {
        $allTemplates = DB::fetchAll(
            "SELECT id, template_code, template_name, template_title, version_no, is_active
             FROM contract_templates WHERE is_active=1 ORDER BY template_code, version_no DESC"
        );
    } catch (Throwable $e) {
        error_log('Available templates query failed: ' . $e->getMessage());
    }
    jsonOk([
        'assigned' => $mapping,
        'assignments' => $allMappings,
        'available_templates' => $allTemplates,
    ]);
});

// Assign a template to an asset (per-language).
// (2026-05-17 v441) language 인자 추가 — 같은 자산에 KO 템플릿 + EN 템플릿
//   둘 다 매핑 가능. 'ko' | 'en' | null (공통).
// (2026-05-18 v498) Self-healing: asset_contract_templates.language 컬럼이
//   없으면 ALTER 로 추가. db.php 의 autoMigrate 가 어떤 이유로 미실행되어
//   본 endpoint 호출 시 'Unknown column language' 500 에러 보고. endpoint
//   진입 직후 컬럼 존재 보장.
if (!function_exists('ensureAssetContractTemplatesLanguageColumn')) {
    function ensureAssetContractTemplatesLanguageColumn(): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        try {
            $rows = DB::fetchAll(
                "SELECT COUNT(*) AS c FROM information_schema.columns
                  WHERE table_schema = DATABASE()
                    AND table_name = 'asset_contract_templates'
                    AND column_name = 'language'"
            );
            $hasCol = ((int)($rows[0]['c'] ?? 0)) > 0;
            if (!$hasCol) {
                DB::execute("ALTER TABLE `asset_contract_templates` ADD COLUMN `language` VARCHAR(8) NULL DEFAULT NULL AFTER `template_id`");
                try {
                    DB::execute("ALTER TABLE `asset_contract_templates` ADD INDEX `idx_act_asset_lang` (`asset_id`, `language`, `is_active`)");
                } catch (Throwable $_) {
                    // 인덱스 추가 실패는 무시 (이미 존재 등).
                }
                error_log('[ensureAssetContractTemplatesLanguageColumn] language column auto-added');
            }
        } catch (Throwable $e) {
            error_log('[ensureAssetContractTemplatesLanguageColumn] failed: ' . $e->getMessage());
        }
    }
}

post('/api/admin/assets/:assetId/template/assign', function ($p) {
    // (2026-05-18 v500) 운영자 재보고: v498 후에도 500 에러. 단계별 try/catch +
    //   진단 응답으로 정확한 원인 특정. 또한 self-heal 을 endpoint 안에서 직접
    //   실행 (함수 호출 의존성 제거).
    $stage = 'init';
    try {
        $stage = 'adminOnly';
        adminOnly();

        // (2026-05-18 v503) 컬럼 self-heal 일반화 — id / language / is_active
        //   각각 확인 후 누락 시 ALTER ADD. driver_msg "Unknown column 'id'
        //   in 'SELECT'" 운영자 보고 (v502 까지는 id 컬럼 누락 미처리).
        $colCheck = function (string $col): bool {
            return (int)(DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns
                  WHERE table_schema = DATABASE() AND table_name = 'asset_contract_templates' AND column_name = ?",
                [$col]
            ) ?? 0) > 0;
        };

        $stage = 'ensure_id_column';
        if (!$colCheck('id')) {
            // (v504) Multiple primary key defined 회피: 기존 PRIMARY KEY 가
            //   다른 컬럼(예: asset_id+template_id 조합) 으로 설정되어 있을
            //   수 있음. 새 id 추가 전 기존 PK 드롭.
            try {
                $existingPk = DB::fetchAll(
                    "SELECT COLUMN_NAME FROM information_schema.statistics
                      WHERE table_schema = DATABASE()
                        AND table_name = 'asset_contract_templates'
                        AND index_name = 'PRIMARY'"
                );
                if (!empty($existingPk)) {
                    DB::execute("ALTER TABLE `asset_contract_templates` DROP PRIMARY KEY");
                }
            } catch (Throwable $_) { /* PK 없으면 무시 */ }
            DB::execute("ALTER TABLE `asset_contract_templates` ADD COLUMN `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY FIRST");
        }

        $stage = 'ensure_is_active_column';
        if (!$colCheck('is_active')) {
            DB::execute("ALTER TABLE `asset_contract_templates` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1");
        }

        $stage = 'ensure_language_column';
        if (!$colCheck('language')) {
            DB::execute("ALTER TABLE `asset_contract_templates` ADD COLUMN `language` VARCHAR(8) NULL DEFAULT NULL AFTER `template_id`");
            try {
                DB::execute("ALTER TABLE `asset_contract_templates` ADD INDEX `idx_act_asset_lang` (`asset_id`, `language`, `is_active`)");
            } catch (Throwable $_) { /* 이미 존재 가능 */ }
        }

        $stage = 'parse_body';
        $assetId = trim($p['assetId']);
        $body = getJsonBody();
        $templateId = (int)($body['template_id'] ?? 0);
        $rawLang = trim((string)($body['language'] ?? ''));
        $language = null;
        if ($rawLang !== '' && strtolower($rawLang) !== 'null') {
            $l = strtolower($rawLang);
            if ($l === 'ko' || $l === 'en') $language = $l;
            else jsonError(400, 'language 는 ko | en | null 중 하나여야 합니다.');
        }

        if (!$assetId) jsonError(400, '자산 ID가 필요합니다.');
        if ($templateId <= 0) jsonError(400, '템플릿 ID가 필요합니다.');

        $stage = 'verify_asset';
        $asset = DB::fetchOne("SELECT id, name FROM assets WHERE id=?", [$assetId]);
        if (!$asset) jsonError(404, '자산을 찾을 수 없습니다.');

        $stage = 'verify_template';
        $tmpl = DB::fetchOne("SELECT id, template_name FROM contract_templates WHERE id=?", [$templateId]);
        if (!$tmpl) jsonError(404, '템플릿을 찾을 수 없습니다.');

        $stage = 'deactivate_existing_mapping';
        if ($language === null) {
            DB::execute("UPDATE asset_contract_templates SET is_active=0 WHERE asset_id=? AND language IS NULL", [$assetId]);
        } else {
            DB::execute("UPDATE asset_contract_templates SET is_active=0 WHERE asset_id=? AND language=?", [$assetId, $language]);
        }

        $stage = 'lookup_existing';
        if ($language === null) {
            $existing = DB::fetchOne(
                "SELECT id FROM asset_contract_templates WHERE asset_id=? AND template_id=? AND language IS NULL",
                [$assetId, $templateId]
            );
        } else {
            $existing = DB::fetchOne(
                "SELECT id FROM asset_contract_templates WHERE asset_id=? AND template_id=? AND language=?",
                [$assetId, $templateId, $language]
            );
        }

        $stage = 'upsert_mapping';
        if ($existing) {
            DB::execute("UPDATE asset_contract_templates SET is_active=1 WHERE id=?", [(int)$existing['id']]);
        } else {
            DB::execute(
                "INSERT INTO asset_contract_templates (asset_id, template_id, language, is_active) VALUES (?,?,?,1)",
                [$assetId, $templateId, $language]
            );
        }

        jsonOk([
            'assigned'      => true,
            'asset_id'      => $assetId,
            'template_id'   => $templateId,
            'language'      => $language,
            'asset_name'    => $asset['name'],
            'template_name' => $tmpl['template_name'],
        ]);
    } catch (Throwable $e) {
        $diag = [
            'stage' => $stage,
            'error' => $e->getMessage(),
            'class' => get_class($e),
            'file'  => basename($e->getFile()) . ':' . $e->getLine(),
        ];
        if ($e instanceof PDOException) {
            $diag['sql_state']   = $e->getCode();
            $diag['driver_code'] = ($e->errorInfo[1] ?? null);
            $diag['driver_msg']  = ($e->errorInfo[2] ?? null);
        }
        try {
            $cols = DB::fetchAll("SHOW COLUMNS FROM `asset_contract_templates`");
            $diag['act_columns'] = array_map(function ($c) {
                return ['field' => $c['Field'] ?? null, 'type' => $c['Type'] ?? null];
            }, $cols);
        } catch (Throwable $_) {}
        error_log('[template/assign] FAIL stage=' . $stage . ' err=' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        // (v501) frontend api() 가 data.message 를 e.message 로 사용 — error
        //   필드 대신 message 도 함께 노출하여 toast/콘솔 자동 표시.
        echo json_encode([
            'ok'      => false,
            'message' => '템플릿 연결 실패 (' . $stage . '): ' . $e->getMessage(),
            'error'   => '템플릿 연결 실패 (' . $stage . '): ' . $e->getMessage(),
            'diag'    => $diag,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
});

// Unassign template from asset (set mapping inactive).
// (2026-05-17 v441) language 인자 지원 — 'ko'/'en'/null 별로 개별 해제 가능.
//   인자 미전달 시 모든 언어 매핑 해제 (기존 동작 유지 backward-compat).
post('/api/admin/assets/:assetId/template/unassign', function ($p) {
    adminOnly();
    if (function_exists('ensureAssetContractTemplatesLanguageColumn')) {
        ensureAssetContractTemplatesLanguageColumn(); // (v498)
    }
    $assetId = trim($p['assetId']);
    if (!$assetId) jsonError(400, '자산 ID가 필요합니다.');

    $body = getJsonBody();
    $hasLangArg = array_key_exists('language', $body);
    if ($hasLangArg) {
        $rawLang = (string)($body['language'] ?? '');
        if ($rawLang === '' || strtolower($rawLang) === 'null') {
            DB::execute("UPDATE asset_contract_templates SET is_active=0 WHERE asset_id=? AND language IS NULL", [$assetId]);
        } else {
            $l = strtolower($rawLang);
            if ($l !== 'ko' && $l !== 'en') jsonError(400, 'language 는 ko | en | null 중 하나여야 합니다.');
            DB::execute("UPDATE asset_contract_templates SET is_active=0 WHERE asset_id=? AND language=?", [$assetId, $l]);
        }
    } else {
        DB::execute("UPDATE asset_contract_templates SET is_active=0 WHERE asset_id=?", [$assetId]);
    }
    jsonOk(['unassigned' => true, 'asset_id' => $assetId]);
});

// Clone a template for a specific asset (create asset-specific copy)
post('/api/admin/contract-templates/:id/clone', function ($p) {
    $admin = adminOnly();
    $body = getJsonBody();
    $sourceId = (int)$p['id'];
    $assetId = trim($body['asset_id'] ?? '');

    $source = DB::fetchOne("SELECT * FROM contract_templates WHERE id=?", [$sourceId]);
    if (!$source) jsonError(404, '원본 템플릿을 찾을 수 없습니다.');

    // Generate new code: if cloning for a specific asset, prefix with asset_id
    $newCode = $assetId
        ? 'asset_' . strtolower($assetId) . '_' . $source['template_code']
        : $source['template_code'] . '_copy';

    $newName = $assetId
        ? $source['template_name'] . ' (' . $assetId . ' 전용)'
        : $source['template_name'] . ' (복제)';

    // Get next version number for this code
    $maxVer = (int)DB::fetchValue(
        "SELECT COALESCE(MAX(version_no),0) FROM contract_templates WHERE template_code=?", [$newCode]
    );
    $newVer = $maxVer + 1;

    DB::execute(
        "INSERT INTO contract_templates (template_code, template_name, template_title, body_html, body_text, version_no, is_active, created_by, updated_by)
         VALUES (?,?,?,?,?,?,1,?,?)",
        [$newCode, $newName, $source['template_title'], $source['body_html'], $source['body_text'], $newVer, $admin['username'], $admin['username']]
    );

    $newId = (int)DB::pdo()->lastInsertId();

    // If cloning for a specific asset, auto-assign it
    if ($assetId) {
        $asset = DB::fetchOne("SELECT id FROM assets WHERE id=?", [$assetId]);
        if ($asset) {
            // Deactivate existing assignments
            DB::execute("UPDATE asset_contract_templates SET is_active=0 WHERE asset_id=?", [$assetId]);
            DB::execute(
                "INSERT INTO asset_contract_templates (asset_id, template_id, is_active) VALUES (?,?,1)",
                [$assetId, $newId]
            );
        }
    }

    jsonOk([
        'id' => $newId,
        'template_code' => $newCode,
        'template_name' => $newName,
        'version_no' => $newVer,
        'asset_id' => $assetId ?: null,
    ]);
});


