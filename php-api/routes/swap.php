<?php
/**
 * Silica Swap Routes — Silica → SilicaSTO 1방향 변환.
 *
 * Quote-and-execute pattern:
 *   1) POST /api/swap/quote    → 서버가 가격 + quote_token 발급, swap_quotes 에 저장
 *   2) POST /api/swap/execute  → quote_token 만료/유효 검증 후 atomic 한 holdings 업데이트
 *
 * 만료 TTL: 10초 (악의적인 stale-price arbitrage 방지)
 *
 * 변환 산식:
 *   sto_out = floor(silica_amount × silica_price × 100) / 100   (소수 둘째 자리 절삭)
 *   1 SilicaSTO = 1 USDT 페그라 가치 변환은 그대로.
 *
 * holdings 컬럼 갱신:
 *   silica_balance      -= silica_amount
 *   silica_sto_balance  += sto_out
 *   balance_token       += sto_out   (legacy idle mirror)
 *   silica_sto_staked / staked_token 은 변동 없음 — swap 결과는 idle 로 들어감
 */

// ----------------------------------------------------------------
// (2026-05-07) swap_quotes 테이블 보장 — 라우트 첫 호출 전에 한 번만.
// db.php 의 boot 블록에 추가하는 것이 가장 깔끔하지만, 본 파일 자체에 idempotent
// 보장을 넣어두면 수동 마이그레이션이 누락되어도 첫 요청 시 자동 생성된다.
// ----------------------------------------------------------------
function silicaSwapEnsureQuotesTable(): void {
    static $done = false;
    if ($done) return;
    try {
        DB::execute("
            CREATE TABLE IF NOT EXISTS `swap_quotes` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `quote_token` CHAR(64) NOT NULL,
                `user_address` VARCHAR(64) NOT NULL,
                `silica_price_usdt` DECIMAL(20,10) NOT NULL,
                `fee_pct` DECIMAL(7,4) NOT NULL DEFAULT 0,
                `requested_amount` DECIMAL(20,6) DEFAULT NULL,
                `expires_at` DATETIME NOT NULL,
                `consumed_at` DATETIME DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uniq_token` (`quote_token`),
                KEY `idx_user_expires` (`user_address`, `expires_at`),
                KEY `idx_consumed` (`consumed_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            COMMENT='Server-issued swap quote tokens with TTL anti-arbitrage'
        ");
        // (2026-05-07) 기존 v1 테이블에는 fee_pct 가 없을 수 있다 — 자동 보강.
        $cols = DB::fetchAll("SHOW COLUMNS FROM `swap_quotes` LIKE 'fee_pct'");
        if (empty($cols)) {
            DB::execute("ALTER TABLE `swap_quotes`
                ADD COLUMN `fee_pct` DECIMAL(7,4) NOT NULL DEFAULT 0
                AFTER `silica_price_usdt`");
        }
    } catch (Throwable $e) {
        error_log('[swap.php] swap_quotes table ensure failed: ' . $e->getMessage());
    }
    $done = true;
}

// (2026-05-07) 스왑 수수료 (%) 읽기 — settings 'swap_fee_pct'.
// 정수/실수 문자열이거나 JSON 일 수 있어 모두 안전하게 float 로 정규화.
// 음수 / NaN / 0 미만 / 100 초과 등 비정상 값은 0 으로 fallback.
function silicaSwapReadFeePct(): float {
    $stored = getSetting('swap_fee_pct', null);
    if ($stored === null || $stored === '') return 0.0;
    $raw = is_string($stored) ? $stored : (string)$stored;
    $val = (float)$raw;
    if (!is_finite($val) || $val < 0 || $val > 100) return 0.0;
    return $val;
}

// 헬퍼 — 현재 silica 시세 읽기 + source 메타데이터 추출.
function silicaSwapReadCurrentPrice(): array {
    $stored = getSetting('silica_price_usdt', null);
    $price = 0.0;
    $mode = 'manual';
    $source = null;
    $updatedAt = null;
    if ($stored) {
        $obj = is_string($stored) ? json_decode($stored, true) : $stored;
        if (is_array($obj)) {
            $price = (float)($obj['value'] ?? 0);
            $mode = (string)($obj['mode'] ?? 'manual');
            $source = $obj['source'] ?? null;
            $updatedAt = $obj['updated_at'] ?? null;
        } else {
            $price = (float)$stored;
        }
    }
    return [
        'price' => $price,
        'mode' => $mode,
        'source' => $source,
        'updated_at' => $updatedAt,
    ];
}

// ----------------------------------------------------------------
// POST /api/swap/quote
// Body:    { silica_amount?: number }  (선택 — 기록용, 검증은 execute 에서)
// Returns: { ok, quote_token, silica_price_usdt, expires_at, ttl_seconds,
//            applied_rate, mode, source, updated_at }
// ----------------------------------------------------------------
post('/api/swap/quote', function () {
    silicaSwapEnsureQuotesTable();
    $user = authRequired();

    $body = getJsonBody();
    $reqAmount = isset($body['silica_amount']) ? (float)$body['silica_amount'] : null;
    if ($reqAmount !== null && $reqAmount < 0) $reqAmount = null;

    $info = silicaSwapReadCurrentPrice();
    $price = $info['price'];
    if ($price <= 0) {
        jsonError(503, 'Silica 시세가 설정되지 않았습니다. 관리자 페이지에서 시세를 등록한 뒤 다시 시도해 주세요.');
    }

    $token = bin2hex(random_bytes(32));   // 64 hex chars
    // (2026-05-08 v3) 운영자 요청으로 다시 8초로 복원. 만료 후 클릭은
    // 프론트에서 '새로 받기' UX 로 처리되므로 짧은 TTL 도 안전.
    $ttl = 8;
    $expiresAt = (new DateTime('now', new DateTimeZone('UTC')))
        ->modify("+{$ttl} seconds")
        ->format('Y-m-d H:i:s');

    // 수수료 잠금 — quote 발급 시점의 swap_fee_pct 를 그대로 quote 에 저장.
    // execute 시 settings 가 바뀌어도 사용자가 본 fee 가 유지된다.
    $feePct = silicaSwapReadFeePct();

    DB::execute(
        "INSERT INTO swap_quotes
            (quote_token, user_address, silica_price_usdt, fee_pct, requested_amount, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        [$token, $user['address'], $price, $feePct, $reqAmount, $expiresAt]
    );

    // (2026-05-07) user_usdt_balance — frontend displays this so the user can
    //   see whether they hold enough USDT to cover the swap fee. Without this
    //   the user only learns "Insufficient USDT" after clicking Execute.
    $userUsdt = 0.0;
    try {
        $balRow = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$user['address']]);
        $userUsdt = (float)($balRow['usdt'] ?? 0);
    } catch (Throwable $e) {
        error_log('[swap.quote] user usdt fetch failed: ' . $e->getMessage());
    }

    jsonOk([
        'quote_token'       => $token,
        'silica_price_usdt' => $price,
        'fee_pct'           => $feePct,
        'expires_at'        => str_replace(' ', 'T', $expiresAt) . 'Z',
        'ttl_seconds'       => $ttl,
        'applied_rate'      => $price > 0 ? (1.0 / $price) : 0,  // 1 STO = X Silica
        'mode'              => $info['mode'],
        'source'            => $info['source'],
        'updated_at'        => $info['updated_at'],
        'user_usdt_balance' => $userUsdt,
    ]);
});

// ----------------------------------------------------------------
// POST /api/swap/execute
// Body:    { quote_token: string, silica_amount: number }
// Returns: { ok, silica_in, sto_out, price, new_silica_balance, new_sto_balance }
// 실패 코드:
//   400 - 잘못된 입력
//   404 - quote_token 미존재 / 다른 사용자 소유
//   410 - 만료됨 또는 이미 사용됨
//   422 - 잔액 부족
//   500 - 트랜잭션 실패
// ----------------------------------------------------------------
post('/api/swap/execute', function () {
    // (2026-05-15 v398) 운영 종료 가드 — 종료 진행 중 또는 영구 폐쇄 상태에서
    //   스왑 차단 (자금 형태 변경 = 신규 거래 범주). 보유 자산의 출금/매도
    //   /클레임은 별도 endpoint 에서 마감일까지 허용.
    //   (v399) 한국어 / 영문 양어 메시지.
    //   (v466) requestLocale() 기반 단일 언어 — 사용자 보고: 팝업 양어 혼합.
    if (function_exists('silicaIsServiceActive') && !silicaIsServiceActive()) {
        jsonError(423, pickLocaleMsg([
            'ko' => '서비스 운영 종료 절차가 진행 중입니다. 토큰 스왑이 차단되었습니다.',
            'en' => 'Service wind-down in progress. Token swap is blocked.',
        ]));
    }

    silicaSwapEnsureQuotesTable();
    $user = authRequired();
    // (2026-06-17 v911) KYC 필수 — 미인증 유저는 스왑(자금이동) 차단.
    assertUserKycEligibleOrThrow($user['address']);
    $body = getJsonBody();

    $token  = (string)($body['quote_token'] ?? '');
    $amount = (float)($body['silica_amount'] ?? 0);

    if (strlen($token) !== 64 || !ctype_xdigit($token)) {
        jsonError(400, '유효하지 않은 quote_token 형식입니다.');
    }
    if (!is_finite($amount) || $amount <= 0) {
        jsonError(400, 'Silica 수량은 0보다 커야 합니다.');
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        // 1) quote 조회 + 행 락
        $quote = DB::fetchOne(
            "SELECT id, quote_token, user_address, silica_price_usdt, fee_pct,
                    expires_at, consumed_at
               FROM swap_quotes
              WHERE quote_token = ?
              FOR UPDATE",
            [$token]
        );
        if (!$quote) {
            $pdo->rollBack();
            jsonError(404, '이 quote_token 을 찾을 수 없습니다. 시세 동기화부터 다시 진행하세요.');
        }
        if ($quote['user_address'] !== $user['address']) {
            $pdo->rollBack();
            jsonError(404, 'quote_token 이 본인 소유가 아닙니다.');
        }
        if (!empty($quote['consumed_at'])) {
            $pdo->rollBack();
            jsonError(410, 'quote_token 이 이미 사용되었습니다. 시세를 다시 동기화하세요.');
        }
        // expires_at 은 UTC. strtotime 기본 timezone 영향 회피 위해 명시.
        $expiresTs = (new DateTimeImmutable($quote['expires_at'], new DateTimeZone('UTC')))->getTimestamp();
        if (time() >= $expiresTs) {
            $pdo->rollBack();
            jsonError(410, 'Quote 가 만료되었습니다 (10초 초과). 시세를 다시 동기화하세요.');
        }

        $price = (float)$quote['silica_price_usdt'];
        $feePct = (float)($quote['fee_pct'] ?? 0);
        // 잠금된 fee_pct 도 가드 — DB 가 음수/이상값을 가질 가능성 차단.
        if (!is_finite($feePct) || $feePct < 0 || $feePct > 100) $feePct = 0.0;
        if ($price <= 0) {
            $pdo->rollBack();
            jsonError(500, 'quote 가격이 비정상입니다. 관리자에게 문의하세요.');
        }

        // 2) (2026-05-07) Math model — STO is integer-only, fee is paid
        //    separately from balances.usdt.
        //
        //    gross_usdt = silica_in × silicaPrice
        //    fee_pct_usdt = gross_usdt × fee_pct / 100
        //    fee_usdt   = max(SWAP_FEE_MIN_USDT, fee_pct_usdt) floored to 2 dp
        //    sto_out    = floor(gross_usdt)            (integer, 1:1 USDT peg)
        //
        //    (2026-05-08) 사장님 정책: Swap 수수료는 최소 1 USDT 부터 시작
        //    하고, 소수점 셋째 자리 이하는 절삭 (즉 cent 단위 까지만 표시).
        //    percent 결과가 1 USDT 보다 적게 나와도 1 USDT 로 끌어올리고,
        //    더 많이 나오면 2-decimal 로 floor.
        //
        //    The user pays:
        //      - silica_in SILICA (debited from holdings.silica_balance)
        //      - fee_usdt USDT    (debited from balances.usdt)
        //    The user receives:
        //      - sto_out STO      (credited to holdings.silica_sto_balance)
        $grossUsdt = $amount * $price;
        // (2026-05-11) When fee_pct is 0 (admin set 0% in settings),
        //   the swap is truly free — no 1 USDT minimum floor applies.
        //   This matches markets.php applyMinTradeFee() semantics where
        //   $feePct <= 0 returns 0 short-circuit. Earlier the 1 USDT
        //   floor was unconditional, so '0% 입력 시 무료' on the admin
        //   UI was misleading: 0% setting still charged 1 USDT.
        if ($feePct <= 0) {
            $feeUsdt = 0.0;
        } else {
            $feePctUsdt = $grossUsdt * ($feePct / 100);
            // Floor pct fee to 2 decimals first, then enforce min 1 USDT.
            $feeUsdt = floor(max(1.0, $feePctUsdt) * 100) / 100;
        }
        $stoOut    = floor($grossUsdt);
        if ($stoOut <= 0) {
            $pdo->rollBack();
            jsonError(400, '환산 SilicaSTO 수량이 0 이하입니다. 더 큰 Silica 수량을 입력하세요 (1 STO 단위로 절삭됩니다).');
        }

        // 3) holdings + balances 조회 + 행 락
        $holdings = DB::fetchOne(
            "SELECT silica_balance, silica_sto_balance, silica_sto_staked,
                    balance_token, staked_token
               FROM holdings
              WHERE address = ?
              FOR UPDATE",
            [$user['address']]
        );
        if (!$holdings) {
            $pdo->rollBack();
            jsonError(404, '보유 정보가 없습니다. 먼저 투자/배당이 있어야 swap 이 가능합니다.');
        }

        // balances 행도 같이 락 — fee 가 USDT 잔액에서 차감되므로 동시 swap 시
        // race condition 방지를 위해 SELECT FOR UPDATE 로 직렬화.
        DB::execute("INSERT IGNORE INTO balances(address, usdt) VALUES (?, 0)", [$user['address']]);
        $balanceRow = DB::fetchOne(
            "SELECT usdt FROM balances WHERE address=? FOR UPDATE",
            [$user['address']]
        );
        $usdtBefore = (float)($balanceRow['usdt'] ?? 0);

        $silicaBalanceBefore = (float)($holdings['silica_balance'] ?? 0);
        $stoBalanceBefore    = (float)($holdings['silica_sto_balance'] ?? 0);

        if ($silicaBalanceBefore + 1e-9 < $amount) {
            $pdo->rollBack();
            jsonError(422, sprintf(
                'Silica 잔액 부족 — 보유 %s, 필요 %s',
                rtrim(rtrim(number_format($silicaBalanceBefore, 6, '.', ''), '0'), '.'),
                rtrim(rtrim(number_format($amount, 6, '.', ''), '0'), '.')
            ));
        }

        if ($feeUsdt > 0 && $usdtBefore + 1e-9 < $feeUsdt) {
            $pdo->rollBack();
            jsonError(422, sprintf(
                '수수료 USDT 잔액 부족 — 보유 %s USDT, 필요 %s USDT (수수료). USDT 입금 후 다시 시도하세요.',
                number_format($usdtBefore, 4, '.', ''),
                number_format($feeUsdt, 4, '.', '')
            ));
        }

        // 4) atomic balance update — Silica 차감 + STO 증액 + USDT 수수료 차감
        DB::execute(
            "UPDATE holdings
                SET silica_balance     = silica_balance - ?,
                    silica_sto_balance = silica_sto_balance + ?,
                    balance_token      = balance_token + ?
              WHERE address = ?",
            [$amount, $stoOut, $stoOut, $user['address']]
        );
        if ($feeUsdt > 0) {
            DB::execute(
                "UPDATE balances SET usdt = usdt - ? WHERE address = ?",
                [$feeUsdt, $user['address']]
            );
        }

        // 5) quote 소비 마킹
        DB::execute(
            "UPDATE swap_quotes SET consumed_at = UTC_TIMESTAMP() WHERE id = ?",
            [$quote['id']]
        );

        // 6) wallet_transactions 기록 — 3행 (양방향 + 수수료) 으로 남기면
        //    history 페이지에서 사용자가 swap 의 모든 자산 변동을 확인 가능.
        $silicaBalanceAfter = $silicaBalanceBefore - $amount;
        $stoBalanceAfter    = $stoBalanceBefore + $stoOut;
        $usdtAfter          = $feeUsdt > 0 ? ($usdtBefore - $feeUsdt) : $usdtBefore;

        try {
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    $user['address'], 'swap_out', '완료', 'Silica',
                    $amount, $silicaBalanceBefore, $silicaBalanceAfter,
                    sprintf('Swap Silica → SilicaSTO (price %s)', number_format($price, 6, '.', '')),
                    nowUtcSql(),
                ]
            );
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    $user['address'], 'swap_in', '완료', 'SilicaSTO',
                    $stoOut, $stoBalanceBefore, $stoBalanceAfter,
                    sprintf(
                        'Swap Silica → SilicaSTO (silica_in %s, integer floor)',
                        number_format($amount, 6, '.', '')
                    ),
                    nowUtcSql(),
                ]
            );
            // (2026-05-07) Fee row — only inserted when fee_pct > 0. Asset is
            // USDT and the amount column carries the magnitude charged.
            if ($feeUsdt > 0) {
                DB::execute(
                    "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                     VALUES (?,?,?,?,?,?,?,?,?)",
                    [
                        $user['address'], 'swap_fee', '완료', 'USDT',
                        $feeUsdt, $usdtBefore, $usdtAfter,
                        sprintf(
                            'Swap fee (%s%% of %s USDT gross)',
                            number_format($feePct, 4, '.', ''),
                            number_format($grossUsdt, 6, '.', '')
                        ),
                        nowUtcSql(),
                    ]
                );
            }
        } catch (Throwable $logErr) {
            // wallet_transactions 실패는 swap 자체에 영향 주지 않음
            error_log('[swap.execute] wallet_transactions log failed: ' . $logErr->getMessage());
        }

        // 7) silica_audit_log
        try {
            DB::execute(
                "INSERT INTO silica_audit_log (category, action, actor, prev_value, new_value, metadata)
                 VALUES ('swap', 'silica_to_sto', ?, ?, ?, ?)",
                [
                    $user['address'],
                    json_encode(['silica' => $silicaBalanceBefore, 'sto' => $stoBalanceBefore]),
                    json_encode(['silica' => $silicaBalanceAfter, 'sto' => $stoBalanceAfter]),
                    json_encode([
                        'silica_in'    => $amount,
                        'sto_out'      => $stoOut,
                        'price'        => $price,
                        'fee_pct'      => $feePct,
                        'fee_usdt'     => $feeUsdt,
                        'gross_usdt'   => $grossUsdt,
                        'usdt_before'  => $usdtBefore,
                        'usdt_after'   => $usdtAfter,
                        'quote_token_prefix' => substr($token, 0, 8),
                    ]),
                ]
            );
        } catch (Throwable $logErr) {
            error_log('[swap.execute] silica_audit_log failed: ' . $logErr->getMessage());
        }

        $pdo->commit();

        jsonOk([
            'silica_in'           => $amount,
            'sto_out'             => $stoOut,
            'price'               => $price,
            'fee_pct'             => $feePct,
            'fee_usdt'            => $feeUsdt,
            'gross_usdt'          => $grossUsdt,
            'new_silica_balance'  => $silicaBalanceAfter,
            'new_sto_balance'     => $stoBalanceAfter,
            'new_usdt_balance'    => $usdtAfter,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[swap.execute] failed: ' . $e->getMessage());
        jsonError(500, 'Swap 실행 실패: ' . $e->getMessage());
    }
});
