<?php
/**
 * Deposit & Withdraw routes (user-facing)
 */

post('/api/deposit/submit', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $body = getJsonBody();

    // (2026-05-07) signedTx 입력 검증 — base64 형식 + 길이 상한.
    //   - 비어있으면 400
    //   - 16KB 초과 거부 (정상 SPL transfer 는 1KB 미만)
    //   - base64 정규식 통과 못 하면 거부 (CRLF/공백 스트립 후 검사)
    $signedTxBase64 = trim($body['signedTxBase64'] ?? $body['signedTx'] ?? '');
    if (!$signedTxBase64) jsonError(400, '서명된 트랜잭션이 필요합니다.');
    if (strlen($signedTxBase64) > 16384) jsonError(400, '서명된 트랜잭션이 비정상적으로 큽니다.');
    if (!preg_match('#^[A-Za-z0-9+/=\s]+$#', $signedTxBase64)) {
        jsonError(400, '서명된 트랜잭션 형식이 올바르지 않습니다 (base64 아님).');
    }

    // (2026-05-07) 핵심 보안 — signedTx 의 fee-payer 가 인증된 wallet 과 일치해야.
    //   일치 안 하면 다른 사용자의 입금 거래(이미 chain 에 올라간 signed tx) 를
    //   가로채 attacker 의 wallet_transactions 에 deposit 행을 INSERT 하는 공격 가능.
    //   → 본인이 서명한 트랜잭션만 허용.
    $feePayer = extractFeePayerFromSignedTx($signedTxBase64);
    if (!$feePayer) {
        jsonError(400, '서명된 트랜잭션 파싱에 실패했습니다.');
    }
    if ($feePayer !== $address) {
        error_log("[deposit.submit] fee-payer mismatch: tx={$feePayer} vs auth={$address}");
        jsonError(403, '서명한 지갑이 로그인 지갑과 다릅니다. 본인 지갑으로 다시 서명해 주세요.');
    }

    // (2026-05-07) assetCode 형식 검증 — 영숫자/언더스코어/하이픈만, 2~40자.
    //   임의 string 수락 시 SQL injection 자체는 prepared statement 가 막지만,
    //   "SILICA-79907" 같은 정상 자산 ID 외 비정상 패턴은 일찍 거부.
    $assetCode = trim($body['asset'] ?? $body['assetId'] ?? 'USDT');
    $assetCode = $assetCode !== '' ? $assetCode : 'USDT';
    if (!preg_match('/^[A-Za-z0-9_-]{2,40}$/', $assetCode)) {
        jsonError(400, '자산 코드 형식이 올바르지 않습니다.');
    }
    $assetCodeUpper = strtoupper($assetCode);
    $isUsdt = $assetCodeUpper === 'USDT';
    // (2026-05-07) SilicaSTO / Silica reward token deposit support.
    //   These two tokens are NOT rows in the assets table; their mint addresses are
    //   stored in the settings table (silica_sto_mint, silica_token_mint) and managed
    //   from admin/silica-tokens.html. Branch on the asset code rather than calling
    //   getAsset() — the latter would return null and throw "자산 없음".
    //   Match is case-insensitive; we normalize the canonical code we store in
    //   wallet_transactions.asset to "SilicaSTO" / "Silica" for downstream UI parity.
    $isSilicaSto = $assetCodeUpper === 'SILICASTO';
    $isSilicaToken = $assetCodeUpper === 'SILICA';
    $canonicalAsset = $isUsdt ? 'USDT' : ($isSilicaSto ? 'SilicaSTO' : ($isSilicaToken ? 'Silica' : $assetCode));

    ensureUser($address);

    $adminAddr = getSetting('deposit_admin_usdt_address', '') ?? '';
    if (!$adminAddr) jsonError(500, '관리자 입금 주소가 설정되지 않았습니다.');

    $effectiveMint = getEffectiveUsdtMint();
    if ($isSilicaSto) {
        // SilicaSTO mint from settings (admin/silica-tokens.html).
        $effectiveMint = function_exists('silicaGetStoMint') ? silicaGetStoMint() : '';
        if ($effectiveMint === '') jsonError(400, 'SilicaSTO 토큰 mint 주소가 설정되지 않았습니다. 관리자에게 문의하세요.');
    } elseif ($isSilicaToken) {
        // Silica reward token mint from settings.
        $effectiveMint = function_exists('silicaGetTokenMint') ? silicaGetTokenMint() : '';
        if ($effectiveMint === '') jsonError(400, 'Silica 토큰 mint 주소가 설정되지 않았습니다. 관리자에게 문의하세요.');
    } elseif (!$isUsdt) {
        // Legacy RWA token branch (assets table). Kept for backwards compatibility
        // with multi-asset platform mode (SILICA-79907 etc.).
        $asset = getAsset($assetCode);
        if (!$asset) jsonError(404, '자산 없음');
        $assetStatus = trim((string)($asset['status'] ?? ''));
        if (!in_array($assetStatus, [STATUSES['DISTRIBUTING'], STATUSES['OPERATING'], STATUSES['SOLD']], true)) {
            jsonError(400, '관리자가 분배를 시작한 토큰만 입금할 수 있습니다.');
        }
        $effectiveMint = trim((string)($asset['token_mint_address'] ?? ''));
        if ($effectiveMint === '') jsonError(400, '토큰 민트 주소가 등록되지 않은 자산입니다.');
    }

    // ============================================================================
    // (2026-05-26 v825) Deposit hijacking 방어 — broadcast 전 instruction 검증.
    //
    //   기존 코드는 signed tx 를 받자마자 sendRawTransaction() 으로 chain 에
    //   forward → chain 응답 받은 후에야 postTokenBalances 로 admin ATA 수신
    //   여부를 사후 확인. 이 흐름은 "destination 이 admin 이 아닌 attacker"
    //   인 signed tx 도 일단 chain 으로 보내기 때문에, 변조된 deposit.js 가
    //   attacker 주소로 transferChecked 를 만들어 사용자에게 서명시킨 후 우리
    //   서버를 broadcast 채널로 악용하는 hijacking 시나리오가 성립한다.
    //
    //   해결: parseSignedTransaction() 으로 signed tx 의 instructions 를 파싱하고,
    //         validateDepositTransactionStructure() 가 다음을 enforce:
    //         (1) instructions 가 memo / createATA(idempotent) / transferChecked 만
    //         (2) transferChecked 가 정확히 1개
    //         (3) transferChecked.destination == server-derived admin ATA
    //         (4) transferChecked.mint == 예상 mint
    //         (5) transferChecked.owner == fee_payer == 인증 사용자
    //         (6) 그 외 모든 program (system, closeAccount, mintTo 등) 거부
    //
    //   검증 통과해야만 sendRawTransaction() 으로 broadcast.
    //   클라이언트 측 변조 (XSS, JS 침해, 악성 브라우저 확장) 의 99% 시나리오 차단.
    // ============================================================================
    $expectedDecimals = null;
    if ($isUsdt) {
        $expectedDecimals = (int)(getSetting('solana_usdt_decimals', '6') ?? '6');
    }
    // SilicaSTO / Silica / Legacy RWA 의 decimals 는 chain mint metadata 에 따라
    // 변하므로 서버에서 강제하지 않음 (chain transferChecked 가 자체 검증).

    $expectedAmountRaw = null;
    if (isset($body['amount_raw']) && is_numeric($body['amount_raw'])) {
        $aRaw = (int)$body['amount_raw'];
        if ($aRaw > 0) $expectedAmountRaw = $aRaw;
    }

    $parsed = parseSignedTransaction($signedTxBase64);
    if (!$parsed) {
        error_log("[deposit.submit] parse failed for tx from {$address}");
        jsonError(400, '서명된 트랜잭션 구조를 파싱할 수 없습니다.');
    }

    $validation = validateDepositTransactionStructure(
        $parsed,
        $address,           // expected fee-payer
        $effectiveMint,     // expected mint (서버가 asset 코드로부터 결정)
        $adminAddr,         // expected admin wallet (settings)
        $expectedAmountRaw, // optional client cross-check
        $expectedDecimals   // optional (USDT only)
    );

    if (!$validation['ok']) {
        // (2026-06-07 v869) detail 까지 풀 덤프 — 운영자 SSH 로그에서 즉시 진단.
        $detailJson = json_encode($validation['detail'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        error_log("[deposit.submit] validation FAILED for {$address}: reason={$validation['reason']} detail={$detailJson}");

        // (2026-05-26 v844) i18n 적용 — 영문 페이지에 한글 메시지 노출되던 문제 fix.
        $userMsg = pickLocaleMsg([
            'ko' => '서명된 트랜잭션이 입금 요건을 충족하지 않습니다. 입금 페이지를 새로고침한 뒤 다시 시도하세요. (보안 검증 실패)',
            'en' => 'The signed transaction does not meet deposit requirements. Please refresh the deposit page and try again. (security check failed)',
            'ja' => '署名された取引が入金要件を満たしていません。入金ページを更新後、再度お試しください。(セキュリティ検証失敗)',
            'zh' => '签名交易不符合存款要求。请刷新存款页面后重试。(安全检查失败)',
        ]);
        // (v869) reason + detail 모두 응답에 포함 — frontend 가 진단 모달로 노출.
        //   reason 은 항상 노출 안전 (validator 내부 상태, 사용자 자산/비밀 정보 아님).
        //   detail 은 expected/actual mint/ATA/decimals 등 — admin 운영자가 정확한
        //   설정 미일치 원인을 한눈에 파악 가능.
        $extras = [
            'reason' => $validation['reason'],
            'detail' => $validation['detail'] ?? [],
        ];
        jsonError(400, $userMsg, $extras);
    }

    // Step 1: 트랜잭션 전송 (검증 통과한 경우만)
    // "already been processed" 에러는 실제로 이미 체인에 올라간 성공 케이스 →
    // signed tx에서 txid를 복원하여 검증 단계로 진행 (사용자 자산 유실 방지).
    $txid = null;
    try {
        $txid = sendRawTransaction($signedTxBase64);
    } catch (Throwable $e) {
        $errMsg = $e->getMessage();
        if (stripos($errMsg, 'already been processed') !== false) {
            $txid = extractTxidFromSignedTx($signedTxBase64);
            if (!$txid) {
                jsonError(500, '입금 오류: 이미 처리된 트랜잭션이지만 signature를 복원하지 못했습니다. 관리자에게 문의하세요.');
            }
            // 이미 체인에 있으므로 아래 verify 단계로 자연스럽게 이어짐
        } else {
            jsonError(500, '입금 오류: 트랜잭션 전송 실패 - ' . $errMsg);
        }
    }
    if (!$txid) jsonError(500, '트랜잭션 전송 실패 (빈 응답)');

    // Step 2: RPC 확인 시도 (실패해도 txid는 이미 체인에 있음 → 아래에서 pending 기록)
    $tx = null;
    $verifyError = null;
    try {
        $tx = getParsedTxRetry($txid);
        if (!$tx) $verifyError = '트랜잭션 확인 타임아웃';
    } catch (Throwable $e) {
        $verifyError = $e->getMessage();
    }

    $depositAmount = 0;
    $chainFailed = false;
    if ($tx) {
        if (!empty($tx['meta']['err'])) {
            $chainFailed = true;
        } else {
            $preBalances = $tx['meta']['preTokenBalances'] ?? [];
            $postBalances = $tx['meta']['postTokenBalances'] ?? [];
            $adminATA = null;
            try { $adminATA = findATA($adminAddr, $effectiveMint); } catch (Throwable $e) {}

            foreach ($postBalances as $post) {
                if (($post['mint'] ?? '') !== $effectiveMint) continue;
                $owner = $post['owner'] ?? '';
                $accountIndex = $post['accountIndex'] ?? null;
                $postAmt = (float)($post['uiTokenAmount']['uiAmount'] ?? 0);
                $matched = false;
                foreach ($preBalances as $pre) {
                    if (($pre['mint'] ?? '') !== $effectiveMint) continue;
                    $preOwner = $pre['owner'] ?? '';
                    $sameAccount = isset($pre['accountIndex']) && $accountIndex !== null && (int)$pre['accountIndex'] === (int)$accountIndex;
                    if ($sameAccount || ($owner && ($preOwner === $owner))) {
                        $preAmt = (float)($pre['uiTokenAmount']['uiAmount'] ?? 0);
                        $delta = $postAmt - $preAmt;
                        if ($delta > 0 && ($owner === $adminAddr || $owner === $adminATA || $sameAccount)) {
                            $depositAmount = $delta;
                            $matched = true;
                            break 2;
                        }
                    }
                }
                if (!$matched && ($owner === $adminAddr || $owner === $adminATA) && $postAmt > 0) {
                    $depositAmount = $postAmt;
                    break;
                }
            }

            if ($depositAmount <= 0) {
                $innerInstructions = $tx['meta']['innerInstructions'] ?? [];
                foreach ($innerInstructions as $inner) {
                    foreach (($inner['instructions'] ?? []) as $ix) {
                        $parsed = $ix['parsed'] ?? null;
                        if (!$parsed) continue;
                        $type = $parsed['type'] ?? '';
                        $info = $parsed['info'] ?? [];
                        if ($type === 'transferChecked' && ($info['mint'] ?? '') === $effectiveMint) {
                            $dest = $info['destination'] ?? '';
                            if ($dest === $adminATA || $dest === $adminAddr) {
                                $depositAmount = (float)($info['tokenAmount']['uiAmount'] ?? 0);
                                break 2;
                            }
                        }
                    }
                }
            }
        }
    }

    // Step 3: 결과에 따라 DB 기록 — txid는 어떤 경우든 보존 (사용자 자산 유실 방지)
    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $dup = DB::fetchOne("SELECT id FROM wallet_transactions WHERE txid=? LIMIT 1", [$txid]);
        if ($dup) { $pdo->rollBack(); jsonError(400, '이미 처리된 트랜잭션입니다.'); }

        if ($chainFailed) {
            $errDetail = json_encode($tx['meta']['err'] ?? null);
            $pdo->prepare(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )->execute([$address, 'deposit', '실패', $canonicalAsset, 0, 0, 0, $txid, 'on_chain_failed|' . substr((string)$errDetail, 0, 200), nowUtcSql()]);
            $pdo->commit();
            jsonError(400, '트랜잭션 실패(체인). 블록체인에서 실패한 거래로 기록되었습니다.');
        }

        if ($depositAmount > 0) {
            $depositAmount = clamp6($depositAmount);
            $pdo->prepare(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )->execute([$address, 'deposit', '대기', $canonicalAsset, $depositAmount, 0, 0, $txid, '', nowUtcSql()]);
            $pdo->commit();
            jsonOk(['asset' => $canonicalAsset, 'amount' => $depositAmount, 'txid' => $txid, 'status' => '승인대기']);
        }

        // RPC 확인 실패 또는 금액 파싱 실패 — 사용자 자산 유실 방지를 위해 pending 기록.
        // 관리자가 Solana Explorer에서 txid 확인 후 수동으로 금액 입력 및 승인.
        $memoText = $verifyError
            ? 'rpc_verify_pending: ' . substr($verifyError, 0, 200)
            : 'rpc_verify_pending: amount_not_found_in_tx';
        $pdo->prepare(
            "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)"
        )->execute([$address, 'deposit', '대기', $canonicalAsset, 0, 0, 0, $txid, $memoText, nowUtcSql()]);
        $pdo->commit();
        jsonOk([
            'asset' => $canonicalAsset,
            'amount' => 0,
            'txid' => $txid,
            'status' => '확인중',
            'message' => 'Solana RPC 확인이 지연되고 있습니다. 트랜잭션은 블록체인에 전송되었으며, 관리자가 수동 확인 후 처리합니다. (txid: ' . substr($txid, 0, 12) . '...)',
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '입금 기록 실패: ' . $e->getMessage());
    }
});

post('/api/withdraw/request', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    // (2026-05-18 v553) 운영자: '출금정지 유저가 출금 신청이 가능한 문제가
    //   있다'. authMfaRequired 는 is_suspended 만 차단하고 withdraw_suspended
    //   는 통과시킨다. 출금 전용 가드를 명시적으로 호출해 차단.
    assertUserWithdrawAllowed($address);
    // (2026-06-17 v911) KYC 필수 — 미인증 유저는 출금 차단.
    assertUserKycEligibleOrThrow($address);
    $body = getJsonBody();

    $amountRaw = trim((string)($body['amount'] ?? ''));
    $amount = (float)$amountRaw;
    $requestedToAddress = trim((string)($body['to_address'] ?? $address));
    $otp = trim($body['otp'] ?? '');

    if ($amount <= 0) jsonError(400, pickLocaleMsg([
        'ko' => '출금 금액이 필요합니다.',
        'en' => 'Withdrawal amount is required.',
        'ja' => '出金金額が必要です。',
        'zh' => '需要提现金额。',
    ]));
    // 정수만 허용 — 소수점 입력 차단
    if (!preg_match('/^\d+$/', $amountRaw) || abs($amount - floor($amount)) > 0.0000001) {
        jsonError(400, pickLocaleMsg([
            'ko' => '출금 금액은 정수만 입력 가능합니다.',
            'en' => 'Withdrawal amount must be an integer.',
            'ja' => '出金金額は整数のみ入力可能です。',
            'zh' => '提现金额仅可输入整数。',
        ]));
    }
    if ($requestedToAddress !== '' && $requestedToAddress !== $address) {
        jsonError(400, pickLocaleMsg([
            'ko' => '출금은 로그인한 계정의 지갑 주소로만 신청할 수 있습니다.',
            'en' => 'Withdrawals can only be requested to your own logged-in wallet address.',
            'ja' => '出金はログイン中のウォレットアドレスにのみ申請できます。',
            'zh' => '提现只能申请到您登录的钱包地址。',
        ]));
    }

    $toAddress = normalizeSolanaAddress($address, '수령 지갑주소');

    try { verifyUserTxnOtpOrThrow($address, $otp); }
    catch (Throwable $e) { jsonError($e->getCode() ?: 400, $e->getMessage()); }

    ensureUser($address);
    $quote = computeWithdrawQuote('USDT', $amount);
    if ($quote['net_amount'] <= 0) {
        // (2026-05-21 v714) 다국어 i18n — 영문 페이지에서 한국어 에러 표시 문제 해결.
        jsonError(400, pickLocaleMsg([
            'ko' => '수수료를 제외하면 전송 수량이 0 이하입니다.',
            'en' => 'Net transfer amount after fee is zero or less.',
            'ja' => '手数料を差し引いた送金量が 0 以下です。',
            'zh' => '扣除手续费后转账数量为 0 或以下。',
        ]));
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
        $beforeAmt = (float)($bal['usdt'] ?? 0);
        $totalDebit = (float)$quote['total_debited'];
        if ($beforeAmt < $totalDebit) {
            $pdo->rollBack();
            jsonError(400, pickLocaleMsg([
                'ko' => 'USDT 잔액이 부족합니다.',
                'en' => 'Insufficient USDT balance.',
                'ja' => 'USDT 残高が不足しています。',
                'zh' => 'USDT 余额不足。',
            ]));
        }

        $afterAmt = clamp6($beforeAmt - $totalDebit);
        DB::execute("UPDATE balances SET usdt=? WHERE address=?", [$afterAmt, $address]);

        $memo = "to:{$toAddress}|fee_mode:{$quote['mode']}|fee_value:{$quote['fee_value']}|fee_amount:{$quote['fee_amount']}|net:{$quote['net_amount']}";
        $pdo->prepare(
            "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)"
        )->execute([$address, 'withdraw', '출금신청', 'USDT', $amount, $beforeAmt, $afterAmt, null, $memo, nowUtcSql()]);

        $walletTxId = (int)$pdo->lastInsertId();
        // (2026-05-20 v673) v671 self-heal 가 트랜잭션 안에서 ALTER 실행
        //   하여 DDL implicit commit + opcache 캐싱 등으로 실패한 사례 보고.
        //   해결: ALTER 시도 자체를 포기하고, 실제 schema 에 맞춰 INSERT 문을
        //   동적으로 생성. 컬럼이 없으면 INSERT 에서 제외 (memo 에 이미 모든
        //   breakdown 정보 포함되어 데이터 손실 없음).
        $cols = $pdo->query("SHOW COLUMNS FROM `withdraw_requests`")->fetchAll(PDO::FETCH_ASSOC);
        $hasCol = array_flip(array_map(fn($c) => $c['Field'] ?? '', $cols));

        $insertCols = ['wallet_tx_id', 'address', 'to_address', 'asset', 'amount'];
        $insertVals = [$walletTxId, $address, $toAddress, 'USDT', $amount];
        // 신규 schema 컬럼 — 있을 때만 포함
        if (isset($hasCol['fee_mode']))   { $insertCols[] = 'fee_mode';   $insertVals[] = $quote['mode']; }
        if (isset($hasCol['fee_value']))  { $insertCols[] = 'fee_value';  $insertVals[] = $quote['fee_value']; }
        if (isset($hasCol['fee_amount'])) { $insertCols[] = 'fee_amount'; $insertVals[] = $quote['fee_amount']; }
        if (isset($hasCol['net_amount'])) { $insertCols[] = 'net_amount'; $insertVals[] = $quote['net_amount']; }
        // 공통 필수 컬럼
        $insertCols[] = 'status';      $insertVals[] = 'pending';
        $insertCols[] = 'memo';        $insertVals[] = $memo;
        $insertCols[] = 'created_at';  $insertVals[] = nowUtcSql();

        $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
        $colList = '`' . implode('`,`', $insertCols) . '`';
        $pdo->prepare("INSERT INTO withdraw_requests ($colList) VALUES ($placeholders)")
            ->execute($insertVals);
        $requestId = (int)$pdo->lastInsertId();

        $pdo->commit();
        jsonOk([
            'request_id' => $requestId,
            'wallet_tx_id' => $walletTxId,
            'amount' => $amount,
            'fee_mode' => $quote['mode'],
            'fee_value' => $quote['fee_value'],
            'fee_amount' => $quote['fee_amount'],
            'fee_asset' => 'USDT',
            'net_amount' => $quote['net_amount'],
            'total_debited' => $totalDebit,
            'to_address' => $toAddress,
            'status' => '출금신청',
            'before' => $beforeAmt,
            'after' => $afterAmt
        ]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError(500, '출금 요청 실패: ' . $e->getMessage());
    }
});
