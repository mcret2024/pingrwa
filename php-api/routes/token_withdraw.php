<?php
/**
 * Token Withdraw routes (user-facing)
 */

post('/api/token-withdraw/request', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    // (2026-05-18 v553) 출금정지 사용자 차단 — authMfaRequired 는 is_suspended
    //   만 차단하고 withdraw_suspended 는 통과시키므로 별도 가드 필요.
    assertUserWithdrawAllowed($address);
    $body = getJsonBody();

    $assetId = trim($body['assetId'] ?? '');
    $requestedToAddr = trim($body['to_address'] ?? $body['toAddress'] ?? $address);
    $amount = (float)($body['amount'] ?? 0);
    $otp = trim($body['otp'] ?? '');

    // (2026-05-21 v714) i18n 강화 — 영문 페이지에서 한국어 에러 표출 방지.
    if (!$assetId) jsonError(400, pickLocaleMsg([
        'ko' => 'assetId 가 필요합니다.',
        'en' => 'assetId is required.',
        'ja' => 'assetId が必要です。',
        'zh' => '需要 assetId。',
    ]));
    if (!is_finite($amount) || $amount <= 0) jsonError(400, pickLocaleMsg([
        'ko' => '출금 금액이 올바르지 않습니다.',
        'en' => 'Invalid withdrawal amount.',
        'ja' => '出金金額が正しくありません。',
        'zh' => '提现金额无效。',
    ]));
    if (abs($amount - round($amount)) > 0.000001) jsonError(400, pickLocaleMsg([
        'ko' => '토큰 출금은 정수 수량만 신청할 수 있습니다.',
        'en' => 'Token withdrawal accepts integer amounts only.',
        'ja' => 'トークン出金は整数のみ受け付けます。',
        'zh' => '代币提现仅接受整数数量。',
    ]));
    if ($requestedToAddr !== '' && $requestedToAddr !== $address) jsonError(400, pickLocaleMsg([
        'ko' => '출금은 로그인한 계정의 지갑 주소로만 신청할 수 있습니다.',
        'en' => 'Withdrawals can only be requested to your own logged-in wallet address.',
        'ja' => '出金はログイン中のウォレットアドレスにのみ申請できます。',
        'zh' => '提现只能申请到您登录的钱包地址。',
    ]));

    $toAddr = normalizeSolanaAddress($address, '출금지갑주소');

    try { verifyUserTxnOtpOrThrow($address, $otp); }
    catch (Throwable $e) { jsonError($e->getCode() ?: 400, $e->getMessage()); }

    $quote = computeWithdrawQuote($assetId, $amount);
    if ($quote['net_amount'] <= 0) {
        // (2026-05-21 v714) 다국어 i18n — 영문 페이지에서 한국어 에러 표시 문제 해결.
        jsonError(400, pickLocaleMsg([
            'ko' => '수수료를 제외하면 전송 수량이 0 이하입니다.',
            'en' => 'Net transfer amount after fee is zero or less.',
            'ja' => '手数料を差し引いた送金量が 0 以下です。',
            'zh' => '扣除手续费后转账数量为 0 或以下。',
        ]));
    }

    // (2026-05-07) Silica platform tokens (SilicaSTO / Silica) live on
    // dedicated columns of the canonical SILICA-79907 holdings row, not on
    // the legacy multi-asset balance_token field. Branch the balance debit
    // logic accordingly; the legacy RWA path stays for backwards compat.
    $isSilicaSto   = ($assetId === 'SilicaSTO');
    $isSilicaToken = ($assetId === 'Silica');
    $useSilicaSingleAsset = ($isSilicaSto || $isSilicaToken);
    $silicaSingleId = function_exists('silicaGetSingleAssetId')
        ? silicaGetSingleAssetId()
        : 'SILICA-79907';

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        ensureUser($address);
        // ensureHolding wants a row keyed on (address, asset_id). For Silica
        // platform tokens we always target SILICA-79907; for legacy RWA we
        // keep the user-supplied asset_id.
        $holdingsAssetId = $useSilicaSingleAsset ? $silicaSingleId : $assetId;
        ensureHolding($address, $holdingsAssetId);

        $b = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
        $usdtBefore = (float)($b['usdt'] ?? 0);

        $availableToken = 0.0;
        $balanceBefore = 0.0;
        $balanceAfter = 0.0;

        if ($isSilicaSto) {
            $h = DB::fetchOne(
                "SELECT silica_sto_balance, silica_sto_staked, balance_token
                   FROM holdings WHERE address=? AND asset_id=? FOR UPDATE",
                [$address, $silicaSingleId]
            );
            $stoTotal = (float)($h['silica_sto_balance'] ?? 0);
            $stoStaked = (float)($h['silica_sto_staked'] ?? 0);
            $availableToken = max(0.0, $stoTotal - $stoStaked); // idle only
            if ($availableToken < $amount) {
                $pdo->rollBack();
                jsonError(400, pickLocaleMsg([
                    'ko' => '출금 가능한 SilicaSTO 가 부족합니다 (스테이킹된 토큰은 출금 불가 — 먼저 언스테이킹하세요).',
                    'en' => 'Insufficient withdrawable SilicaSTO (staked tokens cannot be withdrawn — unstake first).',
                    'ja' => '出金可能な SilicaSTO が不足しています (ステーキング中のトークンは出金不可 — 先にアンステーキングしてください)。',
                    'zh' => '可提现的 SilicaSTO 不足 (质押中的代币无法提现 — 请先解除质押)。',
                ]));
            }
            $balanceBefore = $stoTotal;
            $balanceAfter = $stoTotal - $amount;
        } elseif ($isSilicaToken) {
            $h = DB::fetchOne(
                "SELECT silica_balance FROM holdings WHERE address=? AND asset_id=? FOR UPDATE",
                [$address, $silicaSingleId]
            );
            $availableToken = (float)($h['silica_balance'] ?? 0);
            if ($availableToken < $amount) {
                $pdo->rollBack();
                jsonError(400, pickLocaleMsg([
                    'ko' => '보유 Silica 가 부족합니다.',
                    'en' => 'Insufficient Silica balance.',
                    'ja' => '保有 Silica が不足しています。',
                    'zh' => 'Silica 余额不足。',
                ]));
            }
            $balanceBefore = $availableToken;
            $balanceAfter = $availableToken - $amount;
        } else {
            // Legacy multi-asset RWA token (e.g., SILICA-79907 itself or future
            // additional assets) — debits balance_token, same as before.
            $h = DB::fetchOne("SELECT balance_token FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetId]);
            $availableToken = (float)($h['balance_token'] ?? 0);
            if ($availableToken < $amount) {
                $pdo->rollBack();
                jsonError(400, pickLocaleMsg([
                    'ko' => '보유 토큰이 부족합니다.',
                    'en' => 'Insufficient token balance.',
                    'ja' => '保有トークンが不足しています。',
                    'zh' => '代币余额不足。',
                ]));
            }
            $balanceBefore = $availableToken;
            $balanceAfter = $availableToken - $amount;
        }

        if ((float)($quote['extra_debit_usdt'] ?? 0) > 0 && $usdtBefore < (float)$quote['extra_debit_usdt']) {
            $pdo->rollBack();
            // (2026-05-20 v678) 운영자: 영문 페이지에서 '를 낼' 한국어가 누출.
            //   i18n MutationObserver 가 '출금 수수료' 만 'Withdrawal Fee' 로 부분
            //   번역하고 '를 낼 USDT가 부족합니다' 는 그대로 두어 혼합 표시 발생.
            //   pickLocaleMsg 로 처음부터 언어별 완전한 문장 반환. 한국어는
            //   '낼' 제거하여 자연스러운 표현으로 단순화.
            jsonError(400, pickLocaleMsg([
                'ko' => '출금 수수료 USDT가 부족합니다.',
                'en' => 'Insufficient USDT for withdrawal fee.',
                'ja' => '出金手数料の USDT が不足しています。',
                'zh' => 'USDT 不足以支付提现手续费。',
            ]));
        }

        // Debit the right column for the asset type.
        if ($isSilicaSto) {
            DB::execute(
                "UPDATE holdings
                    SET silica_sto_balance = silica_sto_balance - ?,
                        balance_token      = balance_token - ?
                  WHERE address=? AND asset_id=?",
                [$amount, $amount, $address, $silicaSingleId]
            );
        } elseif ($isSilicaToken) {
            DB::execute(
                "UPDATE holdings SET silica_balance = silica_balance - ? WHERE address=? AND asset_id=?",
                [$amount, $address, $silicaSingleId]
            );
        } else {
            DB::execute("UPDATE holdings SET balance_token=balance_token-? WHERE address=? AND asset_id=?", [$amount, $address, $assetId]);
        }
        if ((float)$quote['extra_debit_usdt'] > 0) {
            DB::execute("UPDATE balances SET usdt=usdt-? WHERE address=?", [$quote['extra_debit_usdt'], $address]);
        }

        $memo = "fee_mode:{$quote['mode']}|fee_value:{$quote['fee_value']}|fee_amount:{$quote['fee_amount']}|fee_asset:{$quote['fee_asset']}|net:{$quote['net_amount']}";

        // (2026-05-07) Mirror the request as a wallet_transactions row so it
        // shows up in the user's history page under the Withdrawals tab. Asset
        // column carries the canonical token name (USDT / SilicaSTO / Silica /
        // legacy RWA id) so the existing inferAsset() picks it up correctly.
        $pdo->prepare(
            "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)"
        )->execute([
            $address, 'withdraw', '출금신청', $assetId,
            $amount, $balanceBefore, $balanceAfter, null, $memo, nowUtcSql(),
        ]);
        $walletTxId = (int)$pdo->lastInsertId();

        // Insert the request row. wallet_tx_id link only added when the
        // column exists (older deployments may not have it yet).
        $hasWalletTxIdCol = false;
        try {
            $hasWalletTxIdCol = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='token_withdraw_requests'
                    AND COLUMN_NAME='wallet_tx_id'",
                [], 0
            ) > 0;
        } catch (Throwable $_) {}

        // (2026-05-20 v673) Schema-adaptive INSERT — v671 self-heal 가 트랜잭션
        //   안에서 ALTER 실행하여 실패한 사례 대응. 실제 schema 에 존재하는
        //   컬럼만 INSERT 에 포함. 누락 컬럼의 데이터는 memo 에 이미 포함됨.
        $cols = $pdo->query("SHOW COLUMNS FROM `token_withdraw_requests`")->fetchAll(PDO::FETCH_ASSOC);
        $hasCol = array_flip(array_map(fn($c) => $c['Field'] ?? '', $cols));

        $insertCols = [];
        $insertVals = [];
        if ($hasWalletTxIdCol) { $insertCols[] = 'wallet_tx_id'; $insertVals[] = $walletTxId; }
        $insertCols[] = 'address';      $insertVals[] = $address;
        $insertCols[] = 'asset_id';     $insertVals[] = $assetId;
        $insertCols[] = 'to_address';   $insertVals[] = $toAddr;
        $insertCols[] = 'amount_token'; $insertVals[] = $amount;
        if (isset($hasCol['fee_mode']))   { $insertCols[] = 'fee_mode';   $insertVals[] = $quote['mode']; }
        if (isset($hasCol['fee_value']))  { $insertCols[] = 'fee_value';  $insertVals[] = $quote['fee_value']; }
        if (isset($hasCol['fee_amount'])) { $insertCols[] = 'fee_amount'; $insertVals[] = $quote['fee_amount']; }
        if (isset($hasCol['fee_asset']))  { $insertCols[] = 'fee_asset';  $insertVals[] = $quote['fee_asset']; }
        if (isset($hasCol['net_amount'])) { $insertCols[] = 'net_amount'; $insertVals[] = $quote['net_amount']; }
        $insertCols[] = 'status';       $insertVals[] = 'pending';
        $insertCols[] = 'memo';         $insertVals[] = $memo;

        $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
        $colList = '`' . implode('`,`', $insertCols) . '`';
        $pdo->prepare("INSERT INTO token_withdraw_requests ($colList) VALUES ($placeholders)")
            ->execute($insertVals);

        $requestId = $pdo->lastInsertId();
        $pdo->commit();
        jsonOk([
            'request_id' => (int)$requestId,
            'wallet_tx_id' => $walletTxId,
            'amount' => $amount,
            'fee_mode' => $quote['mode'],
            'fee_value' => $quote['fee_value'],
            'fee_amount' => $quote['fee_amount'],
            'fee_asset' => $quote['fee_asset'],
            'net_amount' => $quote['net_amount'],
            'to_address' => $toAddr
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '토큰 출금 신청 실패: ' . $e->getMessage());
    }
});


get('/api/token-withdraw/my', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $rows = DB::fetchAll(
        "SELECT r.id, r.asset_id, r.to_address, r.amount_token, r.status, r.txid, r.memo, r.created_at, a.name AS asset_name
           FROM token_withdraw_requests r
      LEFT JOIN assets a ON a.id = r.asset_id
          WHERE r.address=?
       ORDER BY r.id DESC
          LIMIT 100",
        [$address]
    );
    jsonOk(['rows' => $rows]);
});
