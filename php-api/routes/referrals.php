<?php
/**
 * User-facing Referral Routes
 *
 * - Validate referral code
 * - Get my referrer info
 * - Get my referrer dashboard (if approved as referrer)
 * - Get my referral bonuses
 */

/**
 * GET /api/referral/validate?code=XXXX
 * Check if a referral code OR wallet address is valid and active
 *
 * (2026-05-16 v424) 운영자 보고: 'REFERRAL CODE OR ADDRESS' 필드인데 주소를
 *   입력하면 "존재하지 않는 REFERRAL CODE" 에러. 원인: 이 endpoint 가
 *   normalizeReferralCode() 로 입력을 대문자화 → 주소는 case-sensitive 라
 *   BINARY 매치 실패. v418 의 apply / funding 처럼 자동 감별 적용.
 */
get('/api/referral/validate', function () {
    ensureReferralTables();

    // (2026-05-16 v425) 운영자 보안 점검: '자기 자신의 추천인 코드 및 주소를
    //   입력 할 수 있으면 안된다'. apply/funding 경로는 validateReferralAssignment
    //   가 본인 추천을 차단(line 845 helpers.php) 하지만, validate endpoint 는
    //   본인 체크가 없어 valid:true 응답 → frontend 가 apply 호출 → backend 가
    //   400 반환 → UX 결함. authOptional 추가 + 인증된 사용자라면 본인 추천
    //   차단을 validate 단계에서 미리 적용.
    // (2026-05-18 v499) 운영자 보고: '영어 페이지에서 한국어 메시지'. 모든
    //   응답 메시지에 pickLocaleMsg(['ko'=>...,'en'=>...]) 적용 — wind-down
    //   v466 와 동일 패턴. frontend X-RWA-Lang 헤더 기반 분기.
    $user = function_exists('authOptional') ? authOptional() : null;
    $investorAddress = $user['address'] ?? null;

    $rawInput = trim((string)($_GET['code'] ?? ''));
    if ($rawInput === '') {
        jsonError(400, pickLocaleMsg([
            'ko' => '추천인 코드 또는 지갑 주소를 입력하세요.',
            'en' => 'Please enter a referrer code or wallet address.',
        ]));
    }

    // 자동 감별: 32+자 + base58 패턴이면 Solana 주소, 그 외는 추천 코드.
    $isAddress = (strlen($rawInput) >= 32 && preg_match('/^[1-9A-HJ-NP-Za-km-z]+$/', $rawInput));

    $nicknameExpr = function_exists('referralUserNameExpr')
        ? referralUserNameExpr('u', 'nickname')
        : (function_exists('adminReferralUserNicknameExpr') ? adminReferralUserNicknameExpr('u', 'nickname') : 'NULL AS nickname');

    if ($isAddress) {
        $referrer = DB::fetchOne(
            "SELECT rc.address, rc.code, rc.is_active, {$nicknameExpr}
             FROM referrer_codes rc
             LEFT JOIN users u ON BINARY u.address = BINARY rc.address
             WHERE BINARY rc.address = BINARY ?",
            [$rawInput]
        );
        $notFoundMsg = pickLocaleMsg([
            'ko' => '존재하지 않는 추천인 주소입니다.',
            'en' => 'This referrer address does not exist.',
        ]);
    } else {
        $code = normalizeReferralCode($rawInput);
        $referrer = DB::fetchOne(
            "SELECT rc.address, rc.code, rc.is_active, {$nicknameExpr}
             FROM referrer_codes rc
             LEFT JOIN users u ON BINARY u.address = BINARY rc.address
             WHERE BINARY rc.code = BINARY ?",
            [$code]
        );
        $notFoundMsg = pickLocaleMsg([
            'ko' => '존재하지 않는 추천인 코드입니다.',
            'en' => 'This referrer code does not exist.',
        ]);
    }

    if (!$referrer) {
        jsonOk(['valid' => false, 'message' => $notFoundMsg]);
        return;
    }

    if (!$referrer['is_active']) {
        jsonOk(['valid' => false, 'message' => pickLocaleMsg([
            'ko' => '비활성화된 추천인입니다.',
            'en' => 'This referrer is inactive.',
        ])]);
        return;
    }

    // (2026-05-16 v425) 본인 추천 차단 — 인증된 사용자만 가능 (authOptional
    //   이라 미인증 시 null 인 경우 skip). 미인증 호출은 어차피 apply 단계에서
    //   validateReferralAssignment 로 차단되므로 안전.
    if ($investorAddress && hash_equals($referrer['address'], $investorAddress)) {
        jsonOk(['valid' => false, 'message' => pickLocaleMsg([
            'ko' => '본인 추천은 불가합니다.',
            'en' => 'You cannot refer yourself.',
        ])]);
        return;
    }

    $refNickname = decodeMaybeStoredText($referrer['nickname'] ?? null);

    jsonOk([
        'valid' => true,
        'referrer_nickname' => $refNickname ?: (substr($referrer['address'], 0, 8) . '...'),
        // v424: 항상 정규 코드 반환 — frontend 가 주소 입력해도 코드 확인 가능.
        'referrer_code' => $referrer['code'],
    ]);
});

/**
 * POST /api/referral/apply
 * Apply a referral code (link investor to referrer)
 */
post('/api/referral/apply', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureReferralTables();

    $body = getJsonBody();
    // (2026-05-16 v418) 운영자: '추천인 코드와 아울러 주소 둘중 하나 모두
    //   입력 가능.' validateReferralAssignment 가 자동 감별. 정규화 X (코드
    //   대문자 정규화는 validate 안에서 처리).
    $rawInput = trim((string)($body['code'] ?? ''));
    if ($rawInput === '') {
        jsonError(400, pickLocaleMsg([
            'ko' => '추천인 코드 또는 지갑 주소를 입력하세요.',
            'en' => 'Please enter a referrer code or wallet address.',
        ]));
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        lockUserRowForUpdate($address);

        // (2026-06-17 v905) 운영자 정책: 이미 투자(서명)한 지갑은 추천 설정 시점을 놓침
        //   → 추천 설정 전면 거부. 기존엔 existing 있을 때만 차단(아래 if)했고, v903 추천
        //   자율화로 모든 회원이 approved referrer 가 되며 'existing 없음 + 투자 후' 가
        //   v474 bypass 로 허용되던 문제를 차단(프론트 funding.js 입력칸도 숨김 처리).
        //   추천인은 투자(서명) 이전에만 설정 가능. Revert: 이 hasUserSignedFunding 가드 제거.
        if (hasUserSignedFunding($address)) {
            $pdo->rollBack();
            jsonError(400, pickLocaleMsg([
                'ko' => '이미 투자한 계정은 추천인을 설정할 수 없습니다. 추천인은 투자(서명) 이전에만 설정 가능합니다.',
                'en' => 'Accounts that have already signed an investment cannot set a referrer. A referrer can only be set before your first investment.',
            ]));
        }

        // (2026-05-16 v429) 정책 재확정: '투자 서명을 투자자가 하면 추천인은
        //   고정 (관리자 서명 안 했어도)'. 결정 키: hasUserSignedFunding
        //   (user_signed/awaiting_admin/completed 모두 포함). v426 의
        //   hasUserConfirmedFunding (funding_records 기준) 보다 빠른 시점.
        //
        // (2026-05-18 v474) approved referrer 도 existing 이 있으면 동일하게
        //   변경 불가 (v429 fixity 유지). (v905) 위 가드로 투자 후엔 미도달 — 보존.
        $existing = getReferralLinkForInvestor($address, true);
        if ($existing) {
            if (hasUserSignedFunding($address)) {
                $pdo->rollBack();
                jsonError(400, pickLocaleMsg([
                    'ko' => '이미 서명한 투자 계약서가 있어 추천인을 설정할 수 없습니다.',
                    'en' => 'A signed investment contract already exists; the referrer cannot be set.',
                ]));
            }
            DB::execute("DELETE FROM referral_links WHERE id=?", [$existing['id']]);
        }

        $validation = validateReferralAssignment($address, $rawInput);
        if (empty($validation['ok'])) {
            $pdo->rollBack();
            jsonError(400, $validation['message'] ?? pickLocaleMsg([
                'ko' => '추천인 적용 실패',
                'en' => 'Failed to apply the referrer.',
            ]));
        }

        DB::execute(
            "INSERT INTO referral_links(investor_address, referrer_address, referrer_code) VALUES (?,?,?)",
            [$address, $validation['referrer']['address'], $validation['code']]
        );

        $pdo->commit();
        jsonOk(['applied' => true, 'referrer_code' => $validation['code']]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
});

/**
 * GET /api/referral/my-status
 * Get my referrer status (am I a referrer? my code? my stats)
 */
get('/api/referral/my-status', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureReferralTables();

    // Am I a referrer?
    $myCode = DB::fetchOne("SELECT * FROM referrer_codes WHERE BINARY address = BINARY ?", [$address]);

    // My referrer (who referred me) — only if the link is still valid
    $myReferrer = getValidReferralLinkForInvestor($address);

    $bonusRate = getReferralBonusRate();

    $result = [
        'is_referrer' => !!$myCode,
        'referrer_code' => $myCode ? $myCode['code'] : null,
        'referrer_active' => $myCode ? !!$myCode['is_active'] : false,
        'bonus_rate' => $bonusRate,
        'bonus_rate_pct' => round($bonusRate * 100, 2),
        'my_referrer' => $myReferrer ? [
            'code' => $myReferrer['referrer_code'],
            'nickname' => $myReferrer['referrer_nickname'] ?? null,
        ] : null,
    ];

    if ($myCode) {
        try {
            $refCount = (int)DB::fetchValue(
                "SELECT COUNT(*)
                 FROM referral_links rl
                 JOIN referrer_codes rc
                   ON BINARY rc.address = BINARY rl.referrer_address
                  AND BINARY rc.code = BINARY rl.referrer_code
                  AND rc.is_active = 1
                 WHERE BINARY rl.referrer_address = BINARY ?
                   AND " . (function_exists('adminReferralLinkPredicate')
                        ? adminReferralLinkPredicate('rl')
                        : "BINARY rl.referrer_address <> BINARY rl.investor_address"),
                [$address]
            );
            $totalBonus = (float)DB::fetchValue(
                "SELECT COALESCE(SUM(bonus_usdt), 0) FROM referral_bonuses WHERE BINARY referrer_address = BINARY ?",
                [$address]
            );
        } catch (Throwable $e) {
            $refCount = 0;
            $totalBonus = 0.0;
        }
        $result['referral_count'] = $refCount;
        $result['total_bonus_usdt'] = $totalBonus;
    }

    jsonOk($result);
});

/**
 * GET /api/referral/my-referrals
 * Get list of users I referred (only if I'm a referrer)
 */
get('/api/referral/my-referrals', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureReferralTables();

    $myCode = DB::fetchOne("SELECT * FROM referrer_codes WHERE BINARY address = BINARY ? AND is_active=1", [$address]);
    if (!$myCode) { jsonOk(['referrals' => []]); return; }

    $investorNicknameExpr = function_exists('referralUserNameExpr')
        ? referralUserNameExpr('u', 'nickname')
        : (function_exists('adminReferralUserNicknameExpr') ? adminReferralUserNicknameExpr('u', 'nickname') : 'NULL AS nickname');

    $links = DB::fetchAll(
        "SELECT rl.investor_address, rl.created_at, {$investorNicknameExpr}
         FROM referral_links rl
         JOIN referrer_codes rc
           ON BINARY rc.address = BINARY rl.referrer_address
          AND BINARY rc.code = BINARY rl.referrer_code
          AND rc.is_active = 1
         LEFT JOIN users u ON BINARY u.address = BINARY rl.investor_address
         WHERE BINARY rl.referrer_address = BINARY ?
           AND " . (function_exists('adminReferralLinkPredicate')
                ? adminReferralLinkPredicate('rl')
                : "BINARY rl.referrer_address <> BINARY rl.investor_address") . "
         ORDER BY rl.created_at DESC",
        [$address]
    );

    // Mask addresses for privacy
    $result = [];
    foreach ($links as $l) {
        $addr = $l['investor_address'];
        $masked = substr($addr, 0, 6) . '...' . substr($addr, -4);
        $result[] = [
            'address_masked' => $masked,
            'nickname' => decodeMaybeStoredText($l['nickname'] ?? null),
            'linked_at' => $l['created_at'],
        ];
    }

    jsonOk(['referrals' => $result]);
});

/**
 * GET /api/referral/my-bonuses
 * Get my referral bonus history
 */
// (2026-05-16 v412) 추천 보너스 클레임 방식 전환 — self-healing 마이그레이션.
//   기존 즉시 지급에서 pending → claim 패턴으로 변경 (cron 부하 분산).
if (!function_exists('ensureReferralBonusPayoutsTable')) {
    function ensureReferralBonusPayoutsTable(): void {
        static $done = false;
        if ($done) return;
        DB::execute("
            CREATE TABLE IF NOT EXISTS referral_bonus_payouts (
                id                 BIGINT NOT NULL AUTO_INCREMENT,
                referrer_address   VARCHAR(64) NOT NULL,
                interest_claim_id  BIGINT NULL,
                investor_address   VARCHAR(64) NOT NULL,
                asset_id           VARCHAR(64) NOT NULL,
                month_key          VARCHAR(7)  NOT NULL,
                bonus_usdt         DECIMAL(20,8) NOT NULL DEFAULT 0,
                status             ENUM('pending','claimed') NOT NULL DEFAULT 'pending',
                claimed_at         DATETIME NULL,
                created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_rbp_claim_referrer (interest_claim_id, referrer_address),
                INDEX idx_rbp_referrer_status (referrer_address, status),
                INDEX idx_rbp_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $done = true;
    }
}

// ----------------------------------------------------------------
// GET /api/referral/pending  (v412)
// 사용자 본인의 미수령 추천 보너스 합계 + 회차 수 — claim.html 의
// Referral 탭 hero card 표시.
// ----------------------------------------------------------------
get('/api/referral/pending', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureReferralBonusPayoutsTable();

    $pendingTotal = (float)(DB::fetchValue(
        "SELECT COALESCE(SUM(bonus_usdt), 0) FROM referral_bonus_payouts
          WHERE BINARY referrer_address = BINARY ? AND status = 'pending'",
        [$address]
    ) ?? 0);
    $pendingCount = (int)(DB::fetchValue(
        "SELECT COUNT(*) FROM referral_bonus_payouts
          WHERE BINARY referrer_address = BINARY ? AND status = 'pending'",
        [$address]
    ) ?? 0);

    jsonOk([
        'pending_total_usdt' => round($pendingTotal, 3),
        'pending_count'      => $pendingCount,
    ]);
});

// ----------------------------------------------------------------
// POST /api/referral/claim  (v412)
// 본인의 모든 pending referral_bonus_payouts 를 한 번에 claim:
//   - balances.usdt += SUM(bonus_usdt)
//   - status='claimed', claimed_at=NOW
//   - wallet_transactions INSERT (kind='referral_bonus')
// 단일 사용자 transaction 으로 부하 분산.
// ----------------------------------------------------------------
post('/api/referral/claim', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureReferralBonusPayoutsTable();
    ensureUser($address);

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        // 1) pending 모두 lock 으로 fetch.
        $rows = DB::fetchAll(
            "SELECT id, bonus_usdt, investor_address, asset_id, month_key, interest_claim_id
               FROM referral_bonus_payouts
              WHERE BINARY referrer_address = BINARY ? AND status = 'pending'
              FOR UPDATE",
            [$address]
        );
        if (empty($rows)) {
            $pdo->rollBack();
            jsonOk(['ok' => true, 'claimed_count' => 0, 'total_usdt' => 0.0, 'message' => '수령할 추천 보너스가 없습니다.']);
            return;
        }

        $totalUsdt = 0.0;
        $payoutIds = [];
        foreach ($rows as $r) {
            $totalUsdt   += (float)$r['bonus_usdt'];
            $payoutIds[] = (int)$r['id'];
        }
        if ($totalUsdt <= 0) {
            $pdo->rollBack();
            jsonOk(['ok' => true, 'claimed_count' => 0, 'total_usdt' => 0.0]);
            return;
        }

        // 2) balances.usdt 가산 (FOR UPDATE lock 후 일관성 보장).
        $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
        $balBefore = (float)($bal['usdt'] ?? 0);
        $balAfter  = $balBefore + $totalUsdt;
        DB::execute("UPDATE balances SET usdt = usdt + ? WHERE address = ?", [$totalUsdt, $address]);

        // 3) payouts 모두 claimed 처리.
        $idList = implode(',', array_map('intval', $payoutIds));
        DB::execute(
            "UPDATE referral_bonus_payouts
                SET status='claimed', claimed_at=NOW()
              WHERE id IN ({$idList})"
        );

        // 4) wallet_transactions 단일 INSERT (claim 합산 — 사용자 history 에
        //    한 줄 표시).
        $memo = count($payoutIds) === 1
            ? "추천보상 클레임: payout#{$payoutIds[0]}"
            : "추천보상 클레임: " . count($payoutIds) . "건 합산";
        DB::execute(
            "INSERT INTO wallet_transactions(address, kind, status, amount, before_amount, after_amount, txid, memo, created_at)
             VALUES (?, 'referral_bonus', '완료', ?, ?, ?, NULL, ?, NOW())",
            [$address, $totalUsdt, $balBefore, $balAfter, $memo]
        );

        $pdo->commit();
        jsonOk([
            'ok'            => true,
            'claimed_count' => count($payoutIds),
            'total_usdt'    => round($totalUsdt, 3),
            'balance_after' => round($balAfter, 6),
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '추천 보너스 클레임 실패: ' . $e->getMessage());
    }
});

get('/api/referral/my-bonuses', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureReferralTables();

    $myCode = DB::fetchOne("SELECT * FROM referrer_codes WHERE BINARY address = BINARY ?", [$address]);
    if (!$myCode) { jsonOk(['bonuses' => [], 'total_bonus_usdt' => 0]); return; }

    $bonuses = DB::fetchAll(
        "SELECT rb.month_key, rb.asset_id, rb.investor_interest_usdt, rb.bonus_rate, rb.bonus_usdt, rb.created_at,
                a.name AS asset_name
         FROM referral_bonuses rb
         LEFT JOIN assets a ON BINARY a.id = BINARY rb.asset_id
         WHERE BINARY rb.referrer_address = BINARY ?
         ORDER BY rb.created_at DESC
         LIMIT 200",
        [$address]
    );

    $totalBonus = (float)DB::fetchValue(
        "SELECT COALESCE(SUM(bonus_usdt), 0) FROM referral_bonuses WHERE BINARY referrer_address = BINARY ?",
        [$address]
    );

    jsonOk([
        'bonuses' => $bonuses,
        'total_bonus_usdt' => $totalBonus,
    ]);
});
