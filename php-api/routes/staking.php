<?php
/**
 * Staking & Interest routes
 */

function awardReferralBonusForInterest(
    string $investorAddress,
    string $assetId,
    string $monthKey,
    float $interestUsdt,
    int $interestClaimId = 0,
    ?float $bonusRateOverride = null,
    bool $queueOnFailure = true
): float {
    if ($interestUsdt <= 0) return 0.0;

    ensureReferralTables();

    $rawLink = getReferralLinkForInvestor($investorAddress);
    $link = getValidReferralLinkForInvestor($investorAddress);
    if (!$link) {
        if ($rawLink) {
            if ($queueOnFailure && function_exists('adminReferralQueuePendingBonus')) {
                $referrerAddr = (string)($rawLink['referrer_address'] ?? '');
                $bonusRate = ($bonusRateOverride !== null && is_finite($bonusRateOverride)) ? $bonusRateOverride : getReferralBonusRate();
                adminReferralQueuePendingBonus([
                    'interest_claim_id' => $interestClaimId > 0 ? $interestClaimId : null,
                    'referrer_address' => $referrerAddr,
                    'investor_address' => $investorAddress,
                    'asset_id' => $assetId,
                    'month_key' => $monthKey,
                    'investor_interest_usdt' => $interestUsdt,
                    'bonus_rate' => $bonusRate,
                    // (2026-05-12 v307) 운영자: '추천인 보상은 소수점 3자리
                    //   까지' — 기존 round(..., 6) 6자리 반올림에서 floor3()
                    //   3자리 절삭으로 통일. 4.1 USDT × 1% = 0.041 USDT.
                    'bonus_usdt' => floor3($interestUsdt * $bonusRate),
                ], '추천인 링크가 아직 유효하지 않아 보상 지급을 보류했습니다.');
                return 0.0;
            }
            throw new RuntimeException('추천인 링크가 아직 유효하지 않습니다.');
        }
        if (!$queueOnFailure) {
            throw new RuntimeException('추천인 링크를 찾을 수 없습니다.');
        }
        return 0.0;
    }

    $bonusRate = ($bonusRateOverride !== null && is_finite($bonusRateOverride))
        ? $bonusRateOverride
        : getReferralBonusRate();
    // (2026-05-12 v307) 운영자: '추천인 보상은 소수점 3자리까지' —
    //   기존 round(..., 6) 6자리 반올림에서 floor3() 3자리 절삭으로
    //   통일. 예: 4.1 USDT × 1% = 0.041 USDT 정확히. 0.04166...
    //   같은 raw 입력은 0.041 로 절삭 (1만분의 6 USDT 정도가 플랫폼
    //   흡수 — 이자 1자리 절삭과 동일 정책).
    $referralBonusUsdt = floor3($interestUsdt * $bonusRate);
    if (!($referralBonusUsdt > 0)) return 0.0;

    $referrerAddr = (string)($link['referrer_address'] ?? '');
    if ($referrerAddr === '' || $referrerAddr === $investorAddress) return 0.0;

    $payload = [
        'interest_claim_id' => $interestClaimId > 0 ? $interestClaimId : null,
        'referrer_address' => $referrerAddr,
        'investor_address' => $investorAddress,
        'asset_id' => $assetId,
        'month_key' => $monthKey,
        'investor_interest_usdt' => $interestUsdt,
        'bonus_rate' => $bonusRate,
        'bonus_usdt' => $referralBonusUsdt,
    ];

    $pdo = DB::pdo();
    $startedTx = !$pdo->inTransaction();
    if ($startedTx) $pdo->beginTransaction();

    try {
        if ($interestClaimId > 0 && adminReferralTableExists('referral_bonus_events')) {
            DB::execute(
                "INSERT INTO referral_bonus_events(interest_claim_id, referrer_address, investor_address, asset_id, month_key, investor_interest_usdt, bonus_rate, bonus_usdt, status, last_error)
                 VALUES (?,?,?,?,?,?,?,?, 'processing', NULL)
                 ON DUPLICATE KEY UPDATE
                    referrer_address=VALUES(referrer_address),
                    investor_address=VALUES(investor_address),
                    asset_id=VALUES(asset_id),
                    month_key=VALUES(month_key),
                    investor_interest_usdt=VALUES(investor_interest_usdt),
                    bonus_rate=VALUES(bonus_rate),
                    bonus_usdt=VALUES(bonus_usdt),
                    updated_at=CURRENT_TIMESTAMP",
                [
                    $interestClaimId,
                    $referrerAddr,
                    $investorAddress,
                    $assetId,
                    $monthKey,
                    $interestUsdt,
                    $bonusRate,
                    $referralBonusUsdt,
                ]
            );

            $existingEvent = DB::fetchOne(
                "SELECT status, bonus_usdt FROM referral_bonus_events WHERE interest_claim_id=? FOR UPDATE",
                [$interestClaimId]
            );
            if (($existingEvent['status'] ?? '') === 'completed') {
                if ($startedTx && $pdo->inTransaction()) $pdo->commit();
                if (function_exists('adminReferralClearPendingBonus')) adminReferralClearPendingBonus($interestClaimId);
                return (float)($existingEvent['bonus_usdt'] ?? $referralBonusUsdt);
            }
        }

        ensureUser($referrerAddr);

        // (2026-05-16 v412) 운영자 우려: '서버에 문제가 있을지 걱정.' cron
        //   발화 시 1만+ 추천 보너스 동시 처리 부하 위험 → 클레임 방식 전환.
        //   기존 즉시 balances 가산 + wallet_transactions INSERT 흐름을:
        //     - referral_bonus_payouts (pending) INSERT 로 변경
        //     - 사용자가 user/claim.html 의 Referral 탭에서 [Claim] 클릭 시
        //       /api/referral/claim 호출 → balances 가산 + wallet_tx INSERT
        //   referral_bonuses 누적 통계 테이블은 그대로 유지 (history 표시용).
        ensureReferralBonusPayoutsTable();

        DB::execute(
            "INSERT INTO referral_bonus_payouts
             (referrer_address, interest_claim_id, investor_address, asset_id, month_key, bonus_usdt, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE
                bonus_usdt = VALUES(bonus_usdt),
                updated_at = CURRENT_TIMESTAMP",
            [$referrerAddr, $interestClaimId > 0 ? $interestClaimId : null, $investorAddress, $assetId, $monthKey, $referralBonusUsdt]
        );

        DB::execute(
            "INSERT INTO referral_bonuses(referrer_address, investor_address, asset_id, month_key, investor_interest_usdt, bonus_rate, bonus_usdt)
             VALUES (?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
                investor_interest_usdt=investor_interest_usdt+VALUES(investor_interest_usdt),
                bonus_rate=VALUES(bonus_rate),
                bonus_usdt=bonus_usdt+VALUES(bonus_usdt)",
            [$referrerAddr, $investorAddress, $assetId, $monthKey, $interestUsdt, $bonusRate, $referralBonusUsdt]
        );

        if ($interestClaimId > 0 && adminReferralTableExists('referral_bonus_events')) {
            DB::execute(
                "UPDATE referral_bonus_events SET status='completed', last_error=NULL WHERE interest_claim_id=?",
                [$interestClaimId]
            );
        }

        if ($startedTx && $pdo->inTransaction()) $pdo->commit();
        if ($interestClaimId > 0 && function_exists('adminReferralClearPendingBonus')) adminReferralClearPendingBonus($interestClaimId);
        return $referralBonusUsdt;
    } catch (Throwable $e) {
        if ($startedTx && $pdo->inTransaction()) {
            try { $pdo->rollBack(); } catch (Throwable $__) {}
        }

        if ($interestClaimId > 0 && adminReferralTableExists('referral_bonus_events')) {
            adminReferralTryExecute(
                "INSERT INTO referral_bonus_events(interest_claim_id, referrer_address, investor_address, asset_id, month_key, investor_interest_usdt, bonus_rate, bonus_usdt, status, last_error)
                 VALUES (?,?,?,?,?,?,?,?, 'failed', ?)
                 ON DUPLICATE KEY UPDATE
                    referrer_address=VALUES(referrer_address),
                    investor_address=VALUES(investor_address),
                    asset_id=VALUES(asset_id),
                    month_key=VALUES(month_key),
                    investor_interest_usdt=VALUES(investor_interest_usdt),
                    bonus_rate=VALUES(bonus_rate),
                    bonus_usdt=VALUES(bonus_usdt),
                    status='failed',
                    last_error=VALUES(last_error),
                    updated_at=CURRENT_TIMESTAMP",
                [
                    $interestClaimId,
                    $referrerAddr,
                    $investorAddress,
                    $assetId,
                    $monthKey,
                    $interestUsdt,
                    $bonusRate,
                    $referralBonusUsdt,
                    mb_substr($e->getMessage(), 0, 1000),
                ]
            );
        }
        if ($queueOnFailure && function_exists('adminReferralQueuePendingBonus')) {
            adminReferralQueuePendingBonus($payload, $e->getMessage());
        }
        throw $e;
    }
}


// (2026-05-06) Silica 단순 상태머신용으로 화이트리스트 → 블랙리스트 전환.
// RECON 다중자산 모델: [DISTRIBUTING, OPERATING] 같은 단계가 분리돼 화이트리스트가 자연스러웠음.
// Silica: 자산 상태가 '활성' / '매각' / '매각(완료)' 3개로 단순화 + DB에 legacy 값(모집중 등)이
// 마이그레이션 미완료 상태로 남아있을 가능성. 블랙리스트로 가면 어떤 시점·환경에서도 안전.
function stakingInterestActiveStatuses(): array {
    return [STATUSES['ACTIVE']];
}

function stakingClaimAllowedStatuses(): array {
    return [STATUSES['ACTIVE'], STATUSES['SOLD'], STATUSES['SALE_DISTRIBUTED']];
}

function stakingIsSoldStatus(?string $status): bool {
    $s = trim((string)$status);
    return in_array($s, [STATUSES['SOLD'], STATUSES['SALE_DISTRIBUTED']], true);
}

function stakingAllowsNewStake(?string $status): bool {
    $s = trim((string)$status);
    if ($s === '') return false;
    // SOLD / 매각(완료) / 모집실패 / 취소됨 만 차단. 그 외(활성 + legacy alias 모두) 허용.
    $blocked = [
        STATUSES['SOLD'],
        STATUSES['SALE_DISTRIBUTED'],
        '모집실패',
        '취소됨',
    ];
    return !in_array($s, $blocked, true);
}

function stakingAllowsClaim(?string $status): bool {
    $s = trim((string)$status);
    if ($s === '') return false;
    // 모집실패/취소됨만 차단. SOLD/매각완료에서도 미수령 이자 클레임 가능.
    return !in_array($s, ['모집실패', '취소됨'], true);
}


function stakingResolveSoldClaimCutoffMonth(string $assetId): string {
    $fallback = monthKeyKST();
    $assetId = trim($assetId);
    if ($assetId === '') return $fallback;

    try {
        $sale = DB::fetchOne("SELECT executed_at, window_start FROM sales WHERE asset_id=? LIMIT 1", [$assetId]);
    } catch (Throwable $e) {
        return $fallback;
    }

    $policy = resolveSaleInterestPolicyContext(
        isset($sale['executed_at']) ? (string)$sale['executed_at'] : null,
        isset($sale['window_start']) ? (string)$sale['window_start'] : null,
        null
    );
    $monthKey = substr(trim((string)($policy['cancel_from_month'] ?? '')), 0, 7);
    return preg_match('/^\d{4}-\d{2}$/', $monthKey) ? $monthKey : $fallback;
}


function stakingNormalizeLocalForStorage(float $value): float {
    if (!is_finite($value)) return 0.0;
    return round($value, 4);
}

function stakingTruncatePayoutUsdt(float $value): float {
    if (!is_finite($value)) return 0.0;
    return floor(($value + 1e-9) * 10) / 10;
}

/**
 * 월별 지급일(15일) 기준 환율을 가져온다.
 * 1순위: settings 테이블의 monthly_payday_fx_{CCY}_{YYYY-MM} (한번 고정되면 불변)
 * 2순위: fx_quotes 테이블에서 해당 월 15일까지의 최신 시세
 * 3순위: 현재 시장 환율 (fallback — fx_quotes 기록이 없을 때)
 *
 * 1순위에 값이 없으면 2/3순위에서 조회 후 자동으로 1순위에 저장하여
 * 동일 월 내 모든 배정이 동일 환율을 사용하도록 한다.
 */
function stakingGetMonthlyPaydayFx(string $ccy, string $monthKey): float {
    $ccy = strtoupper(trim($ccy));
    if ($ccy === 'USDT') return 1.0;
    if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
        throw new RuntimeException('monthKey 형식 오류: ' . $monthKey);
    }

    $settingKey = "monthly_payday_fx_{$ccy}_{$monthKey}";
    $stored = (float)(getSetting($settingKey, '0') ?? '0');
    if ($stored > 0) return $stored;

    $payDay = defined('STAKING_PAYDAY') ? (int)STAKING_PAYDAY : 15;
    if ($payDay < 1 || $payDay > 31) $payDay = 15;
    $refDate = $monthKey . '-' . str_pad((string)$payDay, 2, '0', STR_PAD_LEFT) . ' 23:59:59';

    // 2순위: fx_quotes 이력에서 해당 월 15일까지의 최신 시세
    $historical = 0.0;
    try {
        $historical = (float)getFxPerUsdtAt($ccy, $refDate);
    } catch (Throwable $e) { /* ignore */ }

    // 3순위: 현재 시세 (15일이 미래이거나 fx_quotes 기록이 없을 때)
    if (!($historical > 0)) {
        $historical = (float)getFxPerUsdt($ccy);
    }

    if (!($historical > 0)) {
        throw new RuntimeException("{$monthKey} 15일 기준 {$ccy} 환율을 확인할 수 없습니다.");
    }

    // 첫 확정된 값은 월 단위로 잠금 — 동일 월 내 재호출 시 동일 값 보장
    try { setSetting($settingKey, (string)$historical); } catch (Throwable $e) { /* ignore */ }

    return $historical;
}

/**
 * monthKey(YYYY-MM)에 해당하는 payday(15일) 기준으로 유효한 APR을 조회.
 *
 * 설계: 관리자가 이자율을 변경해도 "다음 월"부터 적용되어야 하므로,
 *       apr_history.effective_from <= payday 중 가장 최신 값을 사용한다.
 * Fallback: apr_history에 매칭 행이 없으면 assets.apr (현재 값) 사용.
 */
function getEffectiveAprForMonth(string $assetId, string $monthKey, ?float $fallbackApr = null): float {
    if ($monthKey === '' || !preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
        // monthKey가 유효하지 않으면 현재 값 사용
        if ($fallbackApr !== null && $fallbackApr > 0) return (float)$fallbackApr;
        $v = DB::fetchValue("SELECT apr FROM assets WHERE id=?", [$assetId]);
        return (float)($v ?? 0);
    }
    $payday = str_pad((string)STAKING_PAYDAY, 2, '0', STR_PAD_LEFT);
    $paydayDate = $monthKey . '-' . $payday;
    try {
        $v = DB::fetchValue(
            "SELECT apr FROM apr_history
             WHERE asset_id=? AND effective_from <= ?
             ORDER BY effective_from DESC, id DESC
             LIMIT 1",
            [$assetId, $paydayDate]
        );
        if ($v !== null && $v !== false && (float)$v > 0) return (float)$v;
    } catch (Throwable $e) {
        // apr_history 테이블 없음 등 → fallback
        error_log('[getEffectiveAprForMonth] history lookup failed: ' . $e->getMessage());
    }
    if ($fallbackApr !== null && $fallbackApr > 0) return (float)$fallbackApr;
    $v = DB::fetchValue("SELECT apr FROM assets WHERE id=?", [$assetId]);
    return (float)($v ?? 0);
}

function calcStakingInterestBreakdown(array $asset, float $staked, ?string $monthKey = null): array {
    $apr = (float)($asset['apr'] ?? 0);
    if ($apr <= 0) throw new RuntimeException('자산 수익률(APR)이 설정되지 않았습니다.');
    if ($staked <= 0) throw new RuntimeException('스테이킹된 토큰이 없습니다.');

    $ccy = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));

    // 지급일(15일) 기준 환율. monthKey가 있으면 월 고정 환율 사용, 없으면 현재 환율.
    if ($ccy === 'USDT') {
        $payoutFx = 1.0;
    } elseif ($monthKey && preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
        $payoutFx = stakingGetMonthlyPaydayFx($ccy, $monthKey);
    } else {
        $payoutFx = (float)getFxPerUsdt($ccy);
    }
    if (!($payoutFx > 0)) throw new RuntimeException('환율 정보 없음');

    $fundingFx = $ccy === 'USDT' ? 1.0 : (float)($asset['fx_at_funding'] ?? 0);
    if (!($fundingFx > 0)) {
        $fundingFx = $payoutFx;
    }
    if (!($fundingFx > 0)) throw new RuntimeException('확정 환율 정보 없음');

    $principalLocal = $ccy === 'USDT'
        ? (float)$staked
        : ((float)$staked * $fundingFx);
    $amountLocalRaw = $principalLocal * ($apr / 100.0) / 12.0;
    $amountUsdtRaw = $ccy === 'USDT' ? $amountLocalRaw : ($amountLocalRaw / $payoutFx);
    $amountUsdt = stakingTruncatePayoutUsdt($amountUsdtRaw);

    if ($amountUsdt <= 0) throw new RuntimeException('최종 지급 기준 이자 계산 결과가 0.0 USDT 입니다.');

    return [
        'apr' => $apr,
        'settlement_basis' => $ccy,
        'funding_fx' => $fundingFx,
        'payout_fx' => $payoutFx,
        'principal_local' => $principalLocal,
        'amount_local_raw' => $amountLocalRaw,
        'amount_local' => stakingNormalizeLocalForStorage($amountLocalRaw),
        'amount_usdt_raw' => $amountUsdtRaw,
        'amount_usdt' => $amountUsdt,
    ];
}

// (2026-05-15 v379) v376 의 stakingEnsureInterestClaimsSchema() 제거.
//   interest_claims UNIQUE 제약 시도 = testInterestBtn 의 의도된 중복
//   INSERT 와 충돌하는 잘못된 디자인. testBtn 으로 누른 결과 = 실제 거래
//   기록이므로 보존해야 함. race 방어는 application level (inflight 키 +
//   per-holder existing check + SELECT FOR UPDATE) 로 충분.

function createInterestAccrualRecord(string $address, array $asset, string $monthKey): array {
    // (2026-05-08) Trim defensively — force-interest reads holdings.address
    //   and passes it here verbatim. If holdings has stray whitespace, the
    //   row gets INSERTed with whitespace too and /api/portfolio's
    //   address=? SELECT misses it. Notification lib trims independently
    //   so the popup still fires with the trimmed address, producing the
    //   "popup says 4.10 USDT, card says 0.00 USDT" mismatch.
    $address = trim($address);
    $assetId = trim((string)($asset['id'] ?? ''));
    if ($assetId === '') throw new RuntimeException('assetId 필요');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        ensureUser($address);
        ensureHolding($address, $assetId);

        // createInterestAccrualRecord 자체는 중복 체크 안 함 — 호출자가 책임.
        // 호출자별 정책:
        //   - 자동 크론(cron accrue-interest) → runMonthlyInterestBatch 가 호출 전 per-holder
        //     중복 체크로 idempotency 보장
        //   - 관리자 force-interest mode='disaster' → 호출 전 per-holder 중복 체크 (재해복구
        //     안전 — 이미 받은 사용자 skip → 더블 페이먼트 방지)
        //   - 관리자 force-interest mode='test' → 중복 체크 없음 (devnet 테스트 반복 실행
        //     허용. 운영 전환 시 testInterestBtn 자체 제거 — PRODUCTION_CHECKLIST 참조)

        $assetRow = DB::fetchOne("SELECT id, status, apr, settlement_basis, fx_at_funding FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$assetRow) throw new RuntimeException('자산 없음');
        if (!stakingAllowsNewStake($assetRow['status'] ?? '')) {
            throw new RuntimeException('매각 상태 자산은 이자를 배정할 수 없습니다.');
        }

        $h = DB::fetchOne("SELECT staked_token FROM holdings WHERE address=? AND asset_id=? FOR UPDATE", [$address, $assetId]);
        $staked = (float)($h['staked_token'] ?? 0);
        if ($staked <= 0) throw new RuntimeException('스테이킹된 토큰이 없습니다.');

        // 이자율 변경은 다음월부터 적용 — monthKey에 해당하는 payday 기준으로
        // apr_history에서 유효 APR을 조회하고, assets.apr(현재값)을 덮어쓴다.
        $effectiveApr = getEffectiveAprForMonth($assetId, (string)$monthKey, (float)($assetRow['apr'] ?? 0));
        $assetRow['apr'] = $effectiveApr;

        $calc = calcStakingInterestBreakdown(array_merge($asset, $assetRow), $staked, $monthKey);
        $now = nowUtcSql();

        DB::execute(
            "INSERT INTO interest_claims(address, asset_id, month_key, staked_snapshot, apr_snapshot, fx_krw_per_usdt, amount_local, fx_per_usdt, amount_usdt, settlement_basis, created_at, claimed_at, claim_batch_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [
                $address,
                $assetId,
                $monthKey,
                $staked,
                $calc['apr'],
                (int)round($calc['payout_fx']),
                $calc['amount_local'],
                $calc['payout_fx'],
                $calc['amount_usdt'],
                $calc['settlement_basis'],
                $now,
                null,
                null,
            ]
        );

        $id = (int)$pdo->lastInsertId();
        $pdo->commit();

        $referralBonusUsdt = 0.0;
        try {
            // 재발 방지: 추천인 보너스는 부가 기능이므로 실패해도 월 이자 배정 자체를 되돌리면 안 된다.
            // 또한 interest_claim_id 기준으로 정확히 1회만 지급되도록 이벤트 테이블로 중복 방지한다.
            $referralBonusUsdt = awardReferralBonusForInterest($address, $assetId, $monthKey, $calc['amount_usdt'], $id);
        } catch (Throwable $bonusError) {
            error_log('Staking referral bonus skipped for ' . $address . ' / ' . $assetId . ' / ' . $monthKey . ': ' . $bonusError->getMessage());
            $referralBonusUsdt = 0.0;
        }

        // (2026-05-08) Queue an interest_accrued popup for the user so they
        //   know to visit /user/staking.html (or /user/claim.html) and click
        //   "이자 클레임". Without this the test-mode payout (or the cron
        //   accrue-interest run) was silently sitting in interest_claims
        //   waiting for the user to discover it on their next visit.
        //   Best-effort: a notification failure must not roll back the
        //   accrual itself.
        try {
            $payoutCycle = (string)$monthKey . '-15';
            $amountUsdtNum = (float)($calc['amount_usdt'] ?? 0);
            $payload = [
                'interest_claim_id' => $id,
                'asset_id'          => $assetId,
                'month_key'         => (string)$monthKey,
                'payout_date'       => $payoutCycle,
                'amount_usdt'       => $amountUsdtNum,
                'staked_token'      => (float)$staked,
                'apr_pct'           => (float)$calc['apr'],
                'referral_bonus_usdt' => $referralBonusUsdt,
            ];
            createUserNotification(
                $address,
                'interest_accrued',
                '스테이킹 이자가 지급되었습니다',
                sprintf(
                    '%s 회차 이자 %s USDT 가 클레임 대기 중입니다. 스테이킹 페이지의 "이자 클레임" 버튼을 눌러 잔액에 받아가세요.',
                    (string)$monthKey,
                    number_format($amountUsdtNum, 2, '.', ',')
                ),
                $payload
            );
        } catch (Throwable $notifErr) {
            error_log('[interest_accrued] notification skipped for ' . $address . ' / ' . $assetId . ' / ' . $monthKey . ': ' . $notifErr->getMessage());
        }

        return [
            'id' => $id,
            'address' => $address,
            'asset_id' => $assetId,
            'month_key' => $monthKey,
            'staked_token' => $staked,
            'apr' => $calc['apr'],
            'funding_fx' => $calc['funding_fx'],
            'fx_rate' => $calc['payout_fx'],
            'amount_local' => $calc['amount_local'],
            'amount_usdt' => $calc['amount_usdt'],
            'settlement_basis' => $calc['settlement_basis'],
            'created_at' => $now,
            'claimed_at' => null,
            'referral_bonus_usdt' => $referralBonusUsdt,
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function claimPendingInterestAccruals(string $address, array $asset): array {
    // (2026-05-08) Match the trim-on-insert policy in
    // createInterestAccrualRecord — and use TRIM() on both sides of the
    // SELECT so legacy rows (inserted before this fix) still claimable.
    $address = trim($address);
    $assetId = trim((string)($asset['id'] ?? ''));
    if ($assetId === '') throw new RuntimeException('assetId 필요');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        ensureUser($address);

        $params = [$address, $assetId];
        $sql = "SELECT * FROM interest_claims WHERE TRIM(address)=TRIM(?) AND asset_id=? AND claimed_at IS NULL";
        if (stakingIsSoldStatus($asset['status'] ?? '')) {
            $sql .= " AND month_key < ?";
            $params[] = stakingResolveSoldClaimCutoffMonth($assetId);
        }
        $sql .= " ORDER BY created_at ASC, id ASC FOR UPDATE";

        $rows = DB::fetchAll($sql, $params);
        if (!$rows) {
            if (stakingIsSoldStatus($asset['status'] ?? '')) {
                throw new RuntimeException('매각 상태에서는 지급 확정된 미수령 이자만 클레임할 수 있습니다.');
            }
            throw new RuntimeException('클레임 가능한 누적 이자가 없습니다.');
        }

        $totalUsdt = 0.0;
        $totalLocal = 0.0;
        foreach ($rows as &$row) {
            $normalizedUsdt = stakingTruncatePayoutUsdt((float)($row['amount_usdt'] ?? 0));
            if (abs($normalizedUsdt - (float)($row['amount_usdt'] ?? 0)) > 0.000001) {
                DB::execute("UPDATE interest_claims SET amount_usdt=? WHERE id=?", [$normalizedUsdt, (int)$row['id']]);
                $row['amount_usdt'] = $normalizedUsdt;
            }
            $totalUsdt += $normalizedUsdt;
            $totalLocal += (float)($row['amount_local'] ?? 0);
        }
        unset($row);
        $totalUsdt = round($totalUsdt, 1);
        $totalLocal = round($totalLocal, 4);
        if (!($totalUsdt > 0)) throw new RuntimeException('클레임 가능한 이자가 없습니다.');

        $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=? FOR UPDATE", [$address]);
        $beforeAmt = (float)($bal['usdt'] ?? 0);
        $afterAmt = $beforeAmt + $totalUsdt;
        DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$totalUsdt, $address]);

        $claimBatchId = 'ICB-' . gmdate('YmdHis') . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
        $claimedAt = nowUtcSql();
        $ids = array_map(fn($r) => (int)$r['id'], $rows);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        DB::execute(
            "UPDATE interest_claims SET claimed_at=?, claim_batch_id=? WHERE id IN ($placeholders)",
            array_merge([$claimedAt, $claimBatchId], $ids)
        );

        // (2026-05-10 v220) Operator: '이자 건당 표기 되어야하지만, 누적
        //   합산 표기 되고 있다.' Was inserting ONE row with the summed
        //   total; now insert ONE row PER cycle so the user can see each
        //   monthly accrual individually in history. Walk the same $rows
        //   that were just marked claimed_at and emit one row each.
        $running = $beforeAmt;
        foreach ($rows as $r) {
            $monthKey = (string)($r['month_key'] ?? '');
            $cycleUsdt = clamp6((float)($r['amount_usdt'] ?? 0));
            if ($cycleUsdt <= 0) continue;
            $afterCycle = clamp6($running + $cycleUsdt);
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, amount, before_amount, after_amount, txid, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    $address,
                    'interest_claim',
                    '완료',
                    $cycleUsdt,
                    $running,
                    $afterCycle,
                    null,
                    sprintf('스테이킹 이자 클레임 %s · %s · 회차 %s', $assetId, $monthKey, $claimBatchId),
                    $claimedAt,
                ]
            );
            $running = $afterCycle;
        }

        $pdo->commit();

        return [
            'claimed' => true,
            'address' => $address,
            'asset_id' => $assetId,
            'claim_batch_id' => $claimBatchId,
            'claimed_count' => count($rows),
            'amount_usdt' => round($totalUsdt, 1),
            'amount_local' => round($totalLocal, 4),
            'claimed_at' => $claimedAt,
            'referral_bonus_usdt' => 0.0,
            'rows' => array_map(function ($row) use ($claimedAt, $claimBatchId) {
                $row['claimed_at'] = $claimedAt;
                $row['claim_batch_id'] = $claimBatchId;
                return $row;
            }, $rows),
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

post('/api/staking/stake', function () {
    // (2026-05-15 v398) 운영 종료 가드 — 종료 진행 중 또는 영구 폐쇄 상태에서
    //   신규 스테이킹 차단. 출구 (언스테이킹) 는 그대로 허용.
    //   (v399) 한국어 / 영문 양어 메시지.
    //   (2026-05-18 v466) 양어 합쳐서 보내던 것 → requestLocale() 기반 단일
    //     언어 메시지. 사용자 보고: 영문 UI 인데 팝업에 한국어가 섞여 나옴.
    if (function_exists('silicaIsServiceActive') && !silicaIsServiceActive()) {
        jsonError(423, pickLocaleMsg([
            'ko' => '서비스 운영 종료 절차가 진행 중입니다. 신규 스테이킹이 차단되었습니다.',
            'en' => 'Service wind-down in progress. New staking is blocked.',
        ]));
    }

    // (2026-05-18 v463) 추가 안전망 — staking_disabled_at IS NOT NULL 이면 신규
    //   stake 차단. state 가 'active' 로 남아있는 부정합 상태에서도 disable
    //   결정이 반영되도록 (운영자 보고 시나리오: disable-staking 후에도 stake
    //   가능했음).
    if (function_exists('silicaIsStakingDisabled') && silicaIsStakingDisabled()) {
        jsonError(423, pickLocaleMsg([
            'ko' => '관리자에 의해 스테이킹이 중단되었습니다. 신규 스테이킹이 차단되었습니다.',
            'en' => 'Staking has been disabled by admin. New staking is blocked.',
        ]));
    }

    if (isSettlementLock()) jsonError(400, '정산 기간에는 스테이킹/해제가 제한됩니다.');

    // (2026-05-21 보안감사) 재해 모드 가드 — cron 이 14-16일 처리 못 한 채
    //   17일+ 진입 또는 overdue 배당 존재 시 stake 자동 차단. 스냅샷 정합성
    //   보존 + 사용자의 정당한 이자 권리 보호. 운영자가 force-interest 로
    //   복구를 완료하면 cron_accrual_done lock 설정 → 자동 해제.
    if (silicaHasDisasterPending()) {
        jsonError(423, pickLocaleMsg([
            'ko' => '재해 복구 처리 중입니다. 처리가 완료될 때까지 스테이킹이 일시 정지됩니다. 잠시 후 다시 시도해주세요.',
            'en' => 'Disaster recovery in progress. Staking is temporarily suspended until completion. Please try again later.',
        ]));
    }

    // (2026-05-07) authMfaRequired → authRequired 로 완화.
    //   사용자가 OTP 미등록/미인증 상태에서 stake 시도 시 401 → backend 도달 안 됨 →
    //   wallet_transactions INSERT 도 안 되어 history STAKING 탭이 영원히 비어있던 문제.
    //   stake 는 자기 잔액 내 idle→staked 이동이라 외부 유출 없음. swap.php 와 동일 정책.
    //   정말 OTP 강제하려면 추후 admin settings 에서 enforce_mfa_for_staking 같은 토글로
    //   다시 켤 수 있도록 한다.
    $user = authRequired();
    $address = $user['address'];
    // (2026-06-17 v911) KYC 필수 — 미인증 유저는 스테이킹(자금이동) 차단.
    assertUserKycEligibleOrThrow($address);
    $body = getJsonBody();
    $assetId = trim($body['assetId'] ?? '');

    // (2026-05-06) 보안 강화: 양의 정수만 허용. 소수점·음수·지수표기·문자열 주입 모두 차단.
    // 1 STO = 1 USDT 페그 정책상 STO 거래는 정수 단위만 유효.
    $amountRaw = $body['amount'] ?? 0;
    if (is_string($amountRaw)) {
        // 문자열로 들어온 경우(JSON 클라이언트가 quoted number 보냄): 비숫자 제거 후 정수 파싱
        $amountRaw = preg_replace('/[^0-9]/', '', $amountRaw);
        if ($amountRaw === '') jsonError(400, '스테이킹 수량을 입력하세요.');
    }
    $amountFloat = (float)$amountRaw;
    if (!is_finite($amountFloat) || $amountFloat <= 0) {
        jsonError(400, '스테이킹 수량은 1 이상이어야 합니다.');
    }
    if ($amountFloat > PHP_INT_MAX) {
        jsonError(400, '스테이킹 수량이 허용 범위를 초과했습니다.');
    }
    if (abs($amountFloat - floor($amountFloat)) > 0.0000005) {
        jsonError(400, '스테이킹 수량은 정수만 입력할 수 있습니다. 소수점 단위 거래는 허용되지 않습니다.');
    }
    $amount = (float)floor($amountFloat); // 다운스트림 호환 위해 float 캐스트 유지

    if (!$assetId) jsonError(400, 'assetId 필요');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        ensureUser($address);
        $asset = DB::fetchOne("SELECT id, status FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$asset) jsonError(404, '자산 없음');
        if (!stakingAllowsNewStake($asset['status'] ?? '')) {
            // 매각/매각완료/실패 상태 모두 신규 스테이킹 차단.
            jsonError(400, '현재 자산 상태에서는 신규 스테이킹을 할 수 없습니다. (자산 상태: ' . ($asset['status'] ?? 'unknown') . ')');
        }

        ensureHolding($address, $assetId);
        // (2026-05-06 v2) 컬럼 의미 정정:
        //   legacy balance_token = idle 만 (idle 풀)
        //   legacy staked_token  = staked 만 (staked 풀)
        //   silica_sto_balance   = TOTAL (idle + staked 합산)  ← 변경되지 않음, stake 가 늘어도 그대로
        //   silica_sto_staked    = staked 만 (= legacy staked_token 과 같은 값)
        // 프론트 계산: idle = silica_sto_balance - silica_sto_staked.
        // 따라서 stake 시 silica_sto_balance 는 손대면 안 됨 (이전 버전 v82 의 이중 차감 버그 수정).
        $h = DB::fetchOne(
            "SELECT balance_token, silica_sto_balance, silica_sto_staked FROM holdings WHERE address=? AND asset_id=? FOR UPDATE",
            [$address, $assetId]
        );
        $balLegacy = (float)($h['balance_token'] ?? 0);
        // silica idle = TOTAL - staked (UI 와 동일 공식)
        $silicaTotal  = (float)($h['silica_sto_balance'] ?? 0);
        $silicaStaked = (float)($h['silica_sto_staked'] ?? 0);
        $silicaIdle   = max(0.0, $silicaTotal - $silicaStaked);
        // (2026-05-06 v3) min() 으로 보수적 검증 — 양쪽 트랙 모두 통과해야 허용.
        // v82 가 max() 를 써서 한쪽이 잘못된 경우 over-stake 가 가능했던 버그 방지.
        $bal = min($balLegacy, $silicaIdle);
        if ($bal < $amount) { $pdo->rollBack(); jsonError(400, '보유 토큰 부족'); }

        // legacy 컬럼: idle 풀에서 staked 풀로 이동 (둘 다 변경)
        // silica 컬럼: staked 만 증가 (TOTAL 은 그대로)
        DB::execute(
            "UPDATE holdings
                SET balance_token     = GREATEST(0, balance_token - ?),
                    staked_token      = staked_token + ?,
                    silica_sto_staked = silica_sto_staked + ?
              WHERE address=? AND asset_id=?",
            [$amount, $amount, $amount, $address, $assetId]
        );

        // (2026-05-06) wallet_transactions 기록 — 거래 내역 노출.
        try {
            $stakedAfter = (float)DB::fetchValue(
                "SELECT silica_sto_staked FROM holdings WHERE address=? AND asset_id=?",
                [$address, $assetId]
            );
            $stakedBefore = max(0.0, $stakedAfter - $amount);
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [$address, 'stake', '완료', 'SilicaSTO', $amount, $stakedBefore, $stakedAfter, "스테이킹 (자산 {$assetId})", nowUtcSql()]
            );
        } catch (Throwable $txLogErr) {
            error_log('wallet_transactions stake log failed: ' . $txLogErr->getMessage());
        }

        $pdo->commit();
        jsonOk(['staked' => $amount]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '서버 오류: ' . $e->getMessage());
    }
});

post('/api/staking/unstake', function () {
    // (2026-05-21 보안감사) 재해 모드 가드 — stake 와 동일 정책. cron 미처리
    //   상태에서 언스테이킹이 일어나면 admin 의 force-interest 가 누락 사용자를
    //   식별할 수 없게 됨 (staked_token=0 → LEFT JOIN 에서 누락). 사용자 본인의
    //   정당한 이자 권리를 시스템이 자동 보호.
    if (silicaHasDisasterPending()) {
        jsonError(423, pickLocaleMsg([
            'ko' => '재해 복구 처리 중입니다. 처리가 완료될 때까지 언스테이킹이 일시 정지됩니다. 지금 언스테이킹하면 미지급 이자 권리를 잃을 수 있습니다.',
            'en' => 'Disaster recovery in progress. Unstaking is temporarily suspended until completion. Unstaking now may forfeit your pending interest entitlement.',
        ]));
    }

    // (2026-05-07) authMfaRequired → authRequired 로 완화 (stake 와 동일 정책).
    $user = authRequired();
    $address = $user['address'];
    // (2026-06-17 v911) KYC 필수 — 미인증 유저는 언스테이킹(자금이동) 차단.
    assertUserKycEligibleOrThrow($address);
    $body = getJsonBody();
    $assetId = trim($body['assetId'] ?? '');

    // (2026-05-06) 양의 정수만 허용 — stake 와 동일 보안 정책.
    $amountRaw = $body['amount'] ?? 0;
    if (is_string($amountRaw)) {
        $amountRaw = preg_replace('/[^0-9]/', '', $amountRaw);
        if ($amountRaw === '') jsonError(400, '언스테이킹 수량을 입력하세요.');
    }
    $amountFloat = (float)$amountRaw;
    if (!is_finite($amountFloat) || $amountFloat <= 0) {
        jsonError(400, '언스테이킹 수량은 1 이상이어야 합니다.');
    }
    if ($amountFloat > PHP_INT_MAX) {
        jsonError(400, '언스테이킹 수량이 허용 범위를 초과했습니다.');
    }
    if (abs($amountFloat - floor($amountFloat)) > 0.0000005) {
        jsonError(400, '언스테이킹 수량은 정수만 입력할 수 있습니다.');
    }
    $amount = (float)floor($amountFloat);

    if (!$assetId) jsonError(400, 'assetId 필요');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        ensureUser($address);

        $asset = DB::fetchOne("SELECT id, status FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$asset) { $pdo->rollBack(); jsonError(404, '자산 없음'); }
        if (isSettlementLock()) {
            $pdo->rollBack();
            jsonError(400, '정산 기간에는 스테이킹/해제가 제한됩니다.');
        }

        ensureHolding($address, $assetId);

        // (2026-05-06 v2) Stake 정정과 대칭 — silica_sto_balance 는 TOTAL 이므로 변경 없음.
        $h = DB::fetchOne(
            "SELECT staked_token, silica_sto_staked FROM holdings WHERE address=? AND asset_id=? FOR UPDATE",
            [$address, $assetId]
        );
        $stakedLegacy = (float)($h['staked_token'] ?? 0);
        $stakedSilica = (float)($h['silica_sto_staked'] ?? 0);
        // (2026-05-06 v3) min() 으로 보수적 검증 — 양쪽 트랙 모두 통과해야 허용.
        $staked = min($stakedLegacy, $stakedSilica);
        if ($staked < $amount) { $pdo->rollBack(); jsonError(400, '스테이킹 잔액 부족'); }

        // legacy 컬럼: staked 풀에서 idle 풀로 이동
        // silica 컬럼: staked 만 감소 (TOTAL 은 그대로)
        DB::execute(
            "UPDATE holdings
                SET staked_token      = GREATEST(0, staked_token - ?),
                    balance_token     = balance_token + ?,
                    silica_sto_staked = GREATEST(0, silica_sto_staked - ?)
              WHERE address=? AND asset_id=?",
            [$amount, $amount, $amount, $address, $assetId]
        );

        // (2026-05-06) wallet_transactions 기록.
        try {
            $stakedAfter = (float)DB::fetchValue(
                "SELECT silica_sto_staked FROM holdings WHERE address=? AND asset_id=?",
                [$address, $assetId]
            );
            $stakedBefore = $stakedAfter + $amount;
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [$address, 'unstake', '완료', 'SilicaSTO', $amount, $stakedBefore, $stakedAfter, "언스테이킹 (자산 {$assetId})", nowUtcSql()]
            );
        } catch (Throwable $txLogErr) {
            error_log('wallet_transactions unstake log failed: ' . $txLogErr->getMessage());
        }

        $pdo->commit();
        jsonOk(['unstaked' => $amount]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '서버 오류: ' . $e->getMessage());
    }
});

// (2026-05-08) Pending interest detail endpoint — feeds the
//   "자세히 보기" modal on staking.html / claim.html. Returns
//   per-row breakdown of unclaimed interest_claims rows for the
//   logged-in user so they can see month / staked snapshot / APR /
//   amount before clicking Claim.
get('/api/interest/pending', function () {
    $user = authMfaRequired();
    $address = trim($user['address']);
    $rows = DB::fetchAll(
        "SELECT id, asset_id, month_key, staked_snapshot, apr_snapshot,
                amount_local, amount_usdt, fx_per_usdt, settlement_basis,
                created_at
         FROM interest_claims
         WHERE TRIM(address)=TRIM(?)
           AND claimed_at IS NULL
         ORDER BY month_key ASC, id ASC",
        [$address]
    );
    $totalUsdt = 0.0;
    foreach ($rows as $r) $totalUsdt += (float)($r['amount_usdt'] ?? 0);
    jsonOk([
        'rows' => $rows,
        'count' => count($rows),
        'total_usdt' => round($totalUsdt, 6),
    ]);
});

// (2026-05-08) Recent claimed cycles — feeds staking.html's
//   "Recent Cycle History" card AND claim.html's full per-cycle
//   history table. Returns the user's CLAIMED interest_claims rows
//   (claimed_at NOT NULL) ordered by claim time, newest first.
//   Default 5 (staking 카드용); capped at 200 (claim 페이지 전체 내역용).
get('/api/interest/claimed', function () {
    $user = authMfaRequired();
    $address = trim($user['address']);
    $limit = max(1, min((int)($_GET['limit'] ?? 5), 200));
    $rows = DB::fetchAll(
        "SELECT id, asset_id, month_key, staked_snapshot, apr_snapshot,
                amount_local, amount_usdt, fx_per_usdt, settlement_basis,
                created_at, claimed_at, claim_batch_id
         FROM interest_claims
         WHERE TRIM(address)=TRIM(?)
           AND claimed_at IS NOT NULL
         ORDER BY claimed_at DESC, id DESC
         LIMIT {$limit}",
        [$address]
    );
    $totalUsdt = 0.0;
    foreach ($rows as $r) $totalUsdt += (float)($r['amount_usdt'] ?? 0);
    jsonOk([
        'rows' => $rows,
        'count' => count($rows),
        'total_usdt' => round($totalUsdt, 6),
    ]);
});

post('/api/interest/claim', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $body = getJsonBody();
    $assetId = trim($body['assetId'] ?? '');

    if (!$assetId) jsonError(400, 'assetId 필요');

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산 없음');
    if (!stakingAllowsClaim($asset['status'] ?? '')) jsonError(400, '이자 클레임 불가 상태');

    try {
        $result = claimPendingInterestAccruals($address, $asset);
        jsonOk($result);
    } catch (RuntimeException $e) {
        jsonError(400, $e->getMessage());
    } catch (Throwable $e) {
        jsonError(500, '서버 오류: ' . $e->getMessage());
    }
});

// (2026-05-21 보안감사) mode 분기 추가:
//   - mode='disaster' (기본/안전) : per-holder 중복 체크 적용 → 이미 받은 사용자 skip.
//     운영 시 disaster recovery 경로. 같은 회차에 두 번 클릭해도 idempotent.
//     partial cron 실패 시나리오에서 누락된 사용자만 selective INSERT.
//   - mode='test' : 중복 체크 없음. devnet 회귀 테스트용으로만 사용.
//     운영 전환 시 testInterestBtn 자체 제거 필요 (PRODUCTION_CHECKLIST 블로커).
//     운영 환경에서 mode='test' 호출자가 없어야 함.
post('/api/admin/staking/force-interest', function () {
    adminOnly();
    $body = getJsonBody();
    $assetId = trim($body['assetId'] ?? '');
    if ($assetId === '') jsonError(400, 'assetId 필요');

    // mode: 'disaster' (기본, 안전) 또는 'test' (devnet 테스트).
    // 알 수 없는 값은 안전한 disaster 로 fallback.
    $mode = (string)($body['mode'] ?? 'disaster');
    if ($mode !== 'test' && $mode !== 'disaster') $mode = 'disaster';

    // (2026-05-26 v861) Mainnet 안전장치 — mode='test' 는 per-holder 중복
    //   체크를 우회 → mainnet 에서 실수로 호출되면 모든 사용자에게 실제
    //   USDT 더블 지급. UI 의 testInterestBtn 은 주석 처리됐지만 다른
    //   경로 (API 직접 호출, 주석 해제 실수) 도 차단:
    //   solana_network 가 'mainnet-beta' 이면 mode='test' 자체 거부.
    if ($mode === 'test') {
        $net = '';
        try {
            $net = strtolower(trim((string)(function_exists('getConfiguredSolanaNetwork')
                ? getConfiguredSolanaNetwork()
                : (getSetting('solana_network', 'devnet') ?? 'devnet'))));
        } catch (Throwable $_) {
            $net = 'devnet';
        }
        if ($net === 'mainnet-beta' || $net === 'mainnet') {
            error_log("[force-interest] mode=test BLOCKED on mainnet by safety guard (v861)");
            jsonError(403,
                'mode=test 는 mainnet 에서 사용할 수 없습니다. ' .
                '재해 복구가 필요하면 mode=disaster 를 사용하세요. ' .
                '(safety guard v861)');
        }
    }

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산 없음');
    if (!stakingAllowsNewStake($asset['status'] ?? '')) jsonError(400, '매각 상태 자산은 해당월 이자를 배정할 수 없습니다.');

    $monthKey = monthKeyKST();
    $holders = DB::fetchAll(
        "SELECT address, staked_token FROM holdings WHERE asset_id=? AND staked_token > 0 ORDER BY address ASC",
        [$assetId]
    );

    if (!$holders) {
        jsonOk([
            'asset_id' => $assetId,
            'month_key' => $monthKey,
            'mode' => $mode,
            'holder_count' => 0,
            'paid_count' => 0,
            'already_paid_count' => 0,
            'failed_count' => 0,
            'total_interest_usdt' => 0,
            'rows' => [],
        ]);
    }

    $paidCount = 0;
    $alreadyPaidCount = 0;
    $failedCount = 0;
    $totalInterestUsdt = 0.0;
    $rows = [];

    foreach ($holders as $holder) {
        $address = (string)($holder['address'] ?? '');
        if ($address === '') continue;

        // mode='disaster' 만 per-holder 중복 체크 (운영 안전).
        // mode='test' 는 우회 — devnet 반복 테스트 허용.
        if ($mode === 'disaster') {
            $existing = DB::fetchOne(
                "SELECT id FROM interest_claims WHERE address=? AND asset_id=? AND month_key=? LIMIT 1",
                [$address, $assetId, $monthKey]
            );
            if ($existing) {
                $alreadyPaidCount++;
                if (count($rows) < 20) {
                    $rows[] = [
                        'address' => $address,
                        'status' => 'already_paid',
                        'month_key' => $monthKey,
                    ];
                }
                continue;
            }
        }

        try {
            $result = createInterestAccrualRecord($address, $asset, $monthKey);
            $paidCount++;
            $totalInterestUsdt += (float)($result['amount_usdt'] ?? 0);
            if (count($rows) < 20) {
                $rows[] = [
                    'address' => $address,
                    'status' => 'paid',
                    'amount_usdt' => (float)($result['amount_usdt'] ?? 0),
                    'amount_local' => (float)($result['amount_local'] ?? 0),
                    'fx_rate' => (float)($result['fx_rate'] ?? 0),
                    'month_key' => (string)($result['month_key'] ?? $monthKey),
                ];
            }
        } catch (Throwable $e) {
            $failedCount++;
            error_log('Admin force-interest failed for ' . $address . ' / ' . $assetId . ': ' . $e->getMessage());
            if (count($rows) < 20) {
                $rows[] = [
                    'address' => $address,
                    'status' => 'failed',
                    'message' => $e->getMessage(),
                ];
            }
        }
    }

    jsonOk([
        'asset_id' => $assetId,
        'month_key' => $monthKey,
        'mode' => $mode,
        'holder_count' => count($holders),
        'paid_count' => $paidCount,
        'already_paid_count' => $alreadyPaidCount,
        'failed_count' => $failedCount,
        'total_interest_usdt' => round($totalInterestUsdt, 6),
        'rows' => $rows,
    ]);
});

// ----------------------------------------------------------------
// (2026-05-18 v575) POST /api/admin/staking/catch-up-accrual
//
// 재해복구용 — 14-16일 lock window 전체가 outage 로 죽어서 HTTP cron 이
//   한 번도 못 돈 경우, 지나간 회차를 운영자가 명시적으로 catch-up.
//   v370 에서 제거됐던 `reset-accrual-done` + `clear-month-claims` 의 안전한
//   재구현 (그 둘은 month_key 명시 없음 + audit 없음 + type-to-confirm 없음
//   이라 운영자 실수에 취약했음).
//   v574 의 force=1 제거와 짝을 이루는 도구 — HTTP cron 은 시간 가드 무조건,
//   본 엔드포인트는 admin JWT 인증 + 명시적 month_key + type-to-confirm 으로
//   안전한 catch-up 경로 분리.
//
// Body:
//   month_key: "YYYY-MM" — 처리할 회차 (반드시 과거)
//   confirm:   "재해복구확인" — 정확 일치 필수 (type-to-confirm)
//
// 검증 순서:
//   1) adminOnly() — JWT 인증
//   2) month_key 포맷 + 범위 (과거 회차만)
//   3) confirm 토큰 정확 매칭
//   4) cron_accrual_done_{month_key} 이미 INSERT 됐는지 → reject
//   5) interest_claims 해당 월 행 존재 여부 → reject (이중 지급 방지)
//   6) runMonthlyInterestBatch($month_key, force=true) 실행
//   7) silica_audit_log INSERT (category=system_config, action=interest_catchup_{month_key})
// ----------------------------------------------------------------
post('/api/admin/staking/catch-up-accrual', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    $monthKey = trim((string)($body['month_key'] ?? ''));
    $confirm = trim((string)($body['confirm'] ?? ''));

    // [2] month_key 포맷
    if (!preg_match('/^(\d{4})-(\d{2})$/', $monthKey, $m)) {
        jsonError(400, "month_key 형식이 올바르지 않습니다. 'YYYY-MM' 형태로 입력하세요 (예: 2026-05).");
    }
    $year = (int)$m[1];
    $month = (int)$m[2];
    if ($year < 2025 || $year > 2030 || $month < 1 || $month > 12) {
        jsonError(400, "month_key 가 허용 범위(2025~2030) 를 벗어났습니다.");
    }

    // 과거 회차만 허용 — 현재/미래 월은 정규 cron 또는 force-interest 가 처리.
    $currentMonthKey = monthKeyKST();
    if ($monthKey >= $currentMonthKey) {
        jsonError(
            400,
            "catch-up 은 과거 회차만 가능합니다. 현재 회차({$currentMonthKey})는 정규 cron 또는 [이자 수동 배정] 버튼을 사용하세요."
        );
    }

    // [3] confirm token
    if ($confirm !== '재해복구확인') {
        jsonError(400, "확인 문구가 일치하지 않습니다. 정확히 '재해복구확인' 을 입력하세요.");
    }

    // [4] cron_accrual_done_{month_key} 이미 처리됐는지
    $doneKey = "cron_accrual_done_{$monthKey}";
    $already = trim((string)(getSetting($doneKey, '') ?? ''));
    if ($already !== '') {
        jsonError(
            409,
            "{$monthKey} 회차는 이미 {$already} 에 처리됐습니다. 재실행이 필요하면 운영자가 SQL 로 app_settings 의 '{$doneKey}' 키를 직접 삭제한 후 다시 호출하세요. (이중 지급 방지)"
        );
    }

    // [5] interest_claims 해당 월 행 존재 여부
    $existingCount = (int)(DB::fetchValue(
        "SELECT COUNT(*) FROM interest_claims WHERE month_key = ?",
        [$monthKey]
    ) ?? 0);
    if ($existingCount > 0) {
        jsonError(
            409,
            "{$monthKey} 회차에 이미 {$existingCount}건의 청구 기록이 존재합니다. 이중 지급 위험으로 catch-up 거절. 기존 행을 검토 후 필요 시 SQL 로 정리하고 다시 호출하세요."
        );
    }

    // [6] 실제 처리
    try {
        $summary = runMonthlyInterestBatch($monthKey, true);
    } catch (Throwable $e) {
        error_log('[catch-up-accrual] runMonthlyInterestBatch failed for ' . $monthKey . ': ' . $e->getMessage());
        jsonError(500, "이자 배정 실패: " . $e->getMessage());
    }

    // [7] audit log
    try {
        DB::execute(
            "INSERT INTO silica_audit_log (category, action, actor, actor_ip, metadata)
             VALUES ('system_config', ?, ?, ?, ?)",
            [
                "interest_catchup_{$monthKey}",
                (string)($admin['username'] ?? 'admin'),
                (string)($_SERVER['REMOTE_ADDR'] ?? ''),
                json_encode([
                    'month_key' => $monthKey,
                    'paid_count' => (int)($summary['paid_count'] ?? 0),
                    'failed_count' => (int)($summary['failed_count'] ?? 0),
                    'total_interest_usdt' => (float)($summary['total_interest_usdt'] ?? 0),
                ], JSON_UNESCAPED_UNICODE),
            ]
        );
    } catch (Throwable $logErr) {
        // audit 실패는 fatal 이 아님 — 본 처리는 이미 성공
        error_log('[catch-up-accrual] audit log INSERT failed (non-fatal): ' . $logErr->getMessage());
    }

    jsonOk(array_merge($summary, [
        'catch_up' => true,
        'month_key' => $monthKey,
        'actor' => (string)($admin['username'] ?? 'admin'),
    ]));
});

// (2026-05-08) Admin 진단 엔드포인트 — 특정 지갑이 force-interest 후
//   왜 staking/claim/history 페이지에서 결과를 못 보는지 빠르게 확인할
//   수 있도록 holdings + interest_claims 원본을 그대로 노출한다.
//   운영자가 "테스팅 이자 지급을 했는데 유저 페이지에 안 나온다" 는
//   상황에서, "그 지갑이 실제로 staked_token>0 이었나?", "interest_claims
//   row 가 INSERT 되었나?" 를 한 번의 호출로 확인 가능.
//
//   (2026-05-08 v2) TRIM() 양쪽으로 변경 — 과거 INSERT 경로에서 address
//   에 공백이 끼어 들어간 row 도 매칭해 노출한다. 가설 A (address 공백
//   미스매치) 의 진단 적중률이 떨어지면 안 되므로.
//   추가로 raw mismatch 표시: holdings.address 와 입력 address 의 정확
//   문자열 비교 결과 + 길이 + hex dump 를 보여줘 운영자가 즉시 공백/대
//   소문자 차이를 눈으로 확인 가능.
get('/api/admin/staking/diagnose-wallet', function () {
    adminOnly();
    $rawInput = (string)($_GET['address'] ?? '');
    $address = trim($rawInput);
    $assetId = trim($_GET['assetId'] ?? 'SILICA-79907');
    if ($address === '') jsonError(400, 'address 필요');

    $holding = DB::fetchOne(
        "SELECT address, asset_id, balance_token, staked_token,
                silica_sto_balance, silica_sto_staked, updated_at
         FROM holdings WHERE TRIM(address)=TRIM(?) AND asset_id=?",
        [$address, $assetId]
    );

    $claims = DB::fetchAll(
        "SELECT id, asset_id, address AS stored_address,
                month_key, staked_snapshot, apr_snapshot,
                amount_local, amount_usdt, fx_per_usdt, settlement_basis,
                created_at, claimed_at, claim_batch_id
         FROM interest_claims
         WHERE TRIM(address)=TRIM(?) AND asset_id=?
         ORDER BY id DESC",
        [$address, $assetId]
    );

    $pendingCount = 0; $paidCount = 0;
    $pendingUsdt = 0.0; $paidUsdt = 0.0;
    foreach ($claims as $c) {
        $amt = (float)($c['amount_usdt'] ?? 0);
        if (empty($c['claimed_at'])) {
            $pendingCount++;
            $pendingUsdt += $amt;
        } else {
            $paidCount++;
            $paidUsdt += $amt;
        }
    }

    // (2026-05-08) Address-mismatch diagnostic — surface stored address
    //   length / exact-match comparison so the operator can immediately
    //   see whether old rows have whitespace or case differences from
    //   the JWT-side address that the user is logging in with.
    $storedAddrSamples = [];
    if ($holding) {
        $storedAddrSamples[] = [
            'source' => 'holdings',
            'value'  => (string)$holding['address'],
            'length' => strlen((string)$holding['address']),
            'matches_input_exactly' => $holding['address'] === $rawInput,
            'matches_input_trimmed' => $holding['address'] === $address,
        ];
    }
    foreach (array_slice($claims, 0, 3) as $c) {
        $sa = (string)($c['stored_address'] ?? '');
        $storedAddrSamples[] = [
            'source' => 'interest_claims#' . $c['id'],
            'value'  => $sa,
            'length' => strlen($sa),
            'matches_input_exactly' => $sa === $rawInput,
            'matches_input_trimmed' => $sa === $address,
        ];
    }

    jsonOk([
        'address' => $address,
        'address_input_raw' => $rawInput,
        'address_input_length' => strlen($rawInput),
        'address_trimmed_length' => strlen($address),
        'asset_id' => $assetId,
        'holding' => $holding ?: null,
        'has_stake' => $holding && (float)($holding['staked_token'] ?? 0) > 0,
        'claims' => $claims,
        'stored_address_samples' => $storedAddrSamples,
        'summary' => [
            'total_rows'    => count($claims),
            'pending_rows'  => $pendingCount,
            'paid_rows'     => $paidCount,
            'pending_usdt'  => round($pendingUsdt, 6),
            'paid_usdt'     => round($paidUsdt, 6),
        ],
    ]);
});

// (2026-05-17 v453) 운영자 요청: admin/staking.html '지갑 진단 (스테이킹 수량)'
//   카드용 endpoint. 주소 검색 → 해당 사용자의 stake/unstake 기록 + 총
//   스테이킹 수량 + holdings 와의 차이 진단.
get('/api/admin/staking/diagnose-stake', function () {
    adminOnly();
    $rawInput = (string)($_GET['address'] ?? '');
    $address = trim($rawInput);
    $assetId = trim($_GET['assetId'] ?? 'SILICA-79907');
    if ($address === '') jsonError(400, 'address 필요');

    // 1) 현재 holdings 상태 (idle + staked 수량).
    $holding = DB::fetchOne(
        "SELECT address, asset_id, balance_token, staked_token,
                silica_sto_balance, silica_sto_staked, updated_at
         FROM holdings WHERE TRIM(address)=TRIM(?) AND asset_id=?",
        [$address, $assetId]
    );

    // 2) 스테이킹 거래 기록 — kind IN ('stake','unstake'). 최대 200건.
    //    (v459) reverted (soft-deleted) row 는 표시는 하지만 집계에서 제외.
    $records = DB::fetchAll(
        "SELECT id, kind, status, asset, amount, before_amount, after_amount,
                memo, created_at
         FROM wallet_transactions
         WHERE TRIM(address)=TRIM(?) AND kind IN ('stake','unstake')
         ORDER BY id DESC
         LIMIT 200",
        [$address]
    );

    // 3) 이력 기반 집계 + 현재 holdings 와 비교 (불일치 즉시 발견).
    //    (v459) status='취소' 이거나 memo 에 '[v459 reverted]' marker 가 있는
    //    row 는 집계에서 제외 (soft-delete 된 백필 row).
    $totalStakeIn = 0.0;
    $totalUnstake = 0.0;
    foreach ($records as $r) {
        $amt = (float)($r['amount'] ?? 0);
        $kind = (string)($r['kind'] ?? '');
        $status = (string)($r['status'] ?? '');
        $memo = (string)($r['memo'] ?? '');
        // soft-deleted 백필 row 는 net 계산에서 제외.
        if ($status === '취소' || strpos($memo, '[v459 reverted]') !== false) {
            continue;
        }
        if ($kind === 'stake') $totalStakeIn += $amt;
        elseif ($kind === 'unstake') $totalUnstake += $amt;
    }
    $netStakedFromHistory = max(0.0, $totalStakeIn - $totalUnstake);
    // holdings 의 silica_sto_staked 가 정식 값 — 폴백으로 staked_token.
    $currentStaked = (float)($holding['silica_sto_staked'] ?? $holding['staked_token'] ?? 0);
    $currentIdle = (float)($holding['silica_sto_balance'] ?? $holding['balance_token'] ?? 0);
    $discrepancy = round($currentStaked - $netStakedFromHistory, 6);

    jsonOk([
        'address' => $address,
        'address_input_raw' => $rawInput,
        'asset_id' => $assetId,
        'holding' => $holding ?: null,
        'records' => $records,
        'summary' => [
            'total_stake_in'         => round($totalStakeIn, 6),
            'total_unstake'          => round($totalUnstake, 6),
            'net_staked_from_history'=> round($netStakedFromHistory, 6),
            'current_staked'         => round($currentStaked, 6),
            'current_idle'           => round($currentIdle, 6),
            'discrepancy'            => $discrepancy,
            'record_count'           => count($records),
        ],
    ]);
});

// (2026-05-17 v455) 운영자 요청: 데이터 정정 도구. 특정 wallet 의 wallet_transactions
//   누락 기록 자동 감지 + 백필 INSERT.
//
//   감지 항목:
//   1. invest_credit 누락 — funding_records 행과 wallet_transactions.kind='invest_credit'
//      비교. 메모에 '계약 #N' 패턴이 있어야 매칭. 매칭 안 되는 funding_records 는
//      누락 candidate.
//   2. staked gap — holdings.silica_sto_staked vs (stake - unstake) 합계.
//
//   동작 모드:
//   - dry_run=true (또는 default) : 분석만 수행, 변경 없음.
//   - dry_run=false + apply 배열 : 지정된 액션만 실행.
//     apply 가능: 'backfill_invest_credit', 'backfill_stake_gap'
//
//   안전 장치:
//   - INSERT 만 사용, UPDATE/DELETE 없음 (holdings 자체 변경 안 함).
//   - memo 에 '[v455 reconcile]' 표시 → 추적 가능.
//   - 모든 작업을 단일 트랜잭션 → 실패 시 rollback.
post('/api/admin/staking/reconcile-wallet', function () {
    adminOnly();
    $body = getJsonBody();
    $address = trim((string)($body['address'] ?? ''));
    $assetId = trim((string)($body['asset_id'] ?? 'SILICA-79907'));
    $dryRun = !array_key_exists('dry_run', $body) ? true : !empty($body['dry_run']);
    $applyActions = (is_array($body['apply'] ?? null) ? $body['apply'] : []);

    if ($address === '') jsonError(400, 'address 필요');

    // 1) 현재 holdings
    $holding = DB::fetchOne(
        "SELECT address, asset_id, silica_sto_balance, silica_sto_staked, staked_token
         FROM holdings WHERE TRIM(address)=TRIM(?) AND asset_id=?",
        [$address, $assetId]
    );

    // 2) funding_records (admin-sign 으로 발행된 실제 STO 분배)
    $fundings = DB::fetchAll(
        "SELECT id, contract_id, amount_usdt, created_at
         FROM funding_records
         WHERE TRIM(address)=TRIM(?) AND asset_id=?
         ORDER BY id",
        [$address, $assetId]
    );

    // 3) wallet_transactions: invest_credit / stake / unstake
    // (v459) reverted row 는 분석에서 제외 (status='취소' 또는 marker).
    $investCredits = DB::fetchAll(
        "SELECT id, amount, memo, status, created_at
         FROM wallet_transactions
         WHERE TRIM(address)=TRIM(?) AND kind='invest_credit' AND asset='SilicaSTO'
           AND status <> '취소'
           AND (memo IS NULL OR memo NOT LIKE '%[v459 reverted]%')
         ORDER BY id",
        [$address]
    );
    $stakeTxs = DB::fetchAll(
        "SELECT id, kind, amount, memo, status, created_at
         FROM wallet_transactions
         WHERE TRIM(address)=TRIM(?) AND kind IN ('stake','unstake') AND asset='SilicaSTO'
           AND status <> '취소'
           AND (memo IS NULL OR memo NOT LIKE '%[v459 reverted]%')
         ORDER BY id",
        [$address]
    );

    // 분석: invest_credit 누락
    $missingCredits = [];
    foreach ($fundings as $f) {
        $matched = false;
        $cid = (int)($f['contract_id'] ?? 0);
        foreach ($investCredits as $ic) {
            $memo = (string)($ic['memo'] ?? '');
            // 매칭 패턴: '계약 #56' 또는 '#56' 또는 'contract_id={cid}'
            if ($cid > 0 && strpos($memo, "계약 #{$cid}") !== false) {
                $matched = true; break;
            }
            if ($cid > 0 && strpos($memo, "#{$cid}") !== false) {
                $matched = true; break;
            }
        }
        if (!$matched) {
            $missingCredits[] = [
                'funding_record_id' => (int)$f['id'],
                'contract_id'       => $cid,
                'amount'            => (float)$f['amount_usdt'],
                'created_at'        => $f['created_at'],
            ];
        }
    }

    // 분석: staked gap
    $totalStake = 0.0;
    $totalUnstake = 0.0;
    foreach ($stakeTxs as $tx) {
        $amt = (float)($tx['amount'] ?? 0);
        if ($tx['kind'] === 'stake') $totalStake += $amt;
        elseif ($tx['kind'] === 'unstake') $totalUnstake += $amt;
    }
    $netStaked = $totalStake - $totalUnstake;
    $currentStaked = (float)($holding['silica_sto_staked'] ?? 0);
    $stakedGap = round($currentStaked - $netStaked, 6);

    // (2026-05-17 v457) 기존 [v455 reconcile] marker 가 있는 row 카운트 — frontend
    //   가 되돌리기 버튼 표시 여부를 결정. 누락/gap 모두 0 인 상태에서도
    //   기존 백필 row 가 있으면 되돌리기 가능해야 함.
    // (v459) 이미 reverted (soft-deleted) row 는 카운트에서 제외 — 이미 처리된 row.
    $existingReconcileCount = (int)(DB::fetchValue(
        "SELECT COUNT(*) FROM wallet_transactions
          WHERE TRIM(address)=TRIM(?)
            AND memo LIKE '[v455 reconcile]%'
            AND status <> '취소'
            AND (memo NOT LIKE '%[v459 reverted]%')",
        [$address]
    ) ?? 0);

    $result = [
        'address'  => $address,
        'asset_id' => $assetId,
        'analysis' => [
            'holding'                => $holding ?: null,
            'funding_records_count'  => count($fundings),
            'invest_credit_count'    => count($investCredits),
            'missing_invest_credits' => $missingCredits,
            'missing_invest_credit_total' => array_sum(array_column($missingCredits, 'amount')),
            'total_stake'            => $totalStake,
            'total_unstake'          => $totalUnstake,
            'net_staked_from_history'=> $netStaked,
            'current_staked'         => $currentStaked,
            'staked_gap'             => $stakedGap,
            'existing_reconcile_count' => $existingReconcileCount,
        ],
        'dry_run' => $dryRun,
        'applied' => [],
    ];

    if ($dryRun || empty($applyActions)) {
        jsonOk($result);
        return;
    }

    // ─── 실제 백필 실행 (transaction) ───
    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        // A. invest_credit 백필 — 각 누락 row 에 대해 INSERT.
        //    before/after 는 시점 정확값을 모르므로 'reference-only' 의미로 0 / amount.
        if (in_array('backfill_invest_credit', $applyActions, true)) {
            foreach ($missingCredits as $mc) {
                DB::execute(
                    "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                     VALUES (?, 'invest_credit', '완료', 'SilicaSTO', ?, 0, ?, ?, ?)",
                    [
                        $address,
                        $mc['amount'],
                        $mc['amount'],
                        "[v455 reconcile] 투자 확정 — SilicaSTO 분배 (계약 #{$mc['contract_id']})",
                        $mc['created_at'],
                    ]
                );
                $result['applied'][] = "invest_credit 백필: 계약 #{$mc['contract_id']} ({$mc['amount']} STO)";
            }
        }

        // B. staked gap 백필 — silica_sto_staked 차이를 stake/unstake row 로 보정.
        //    holdings 자체는 변경 안 함 (이미 발생한 interest_claims 와의 일관성 보존).
        //
        //    (2026-05-17 v456) created_at 정교화: 가능하면 가장 오래된 stake/unstake
        //    tx 의 created_at 직전 시각으로 설정 → 사용자 거래 내역의 시간 순서
        //    자연스러움 (ID 21 의 before=200 과 연결). 또한 before/after 를
        //    holdings 현재값 - amt / 현재값 으로 설정해 시퀀스 일관성 보강.
        if (in_array('backfill_stake_gap', $applyActions, true) && abs($stakedGap) > 0.000001) {
            $isPositive = ($stakedGap > 0);
            $kind = $isPositive ? 'stake' : 'unstake';
            $amt = abs($stakedGap);

            // (v456) 가장 오래된 기존 stake/unstake tx 의 created_at 직전 시각.
            //   없으면 가장 오래된 funding_records 의 created_at 직전, 그래도
            //   없으면 nowUtcSql().
            $oldestStakeAt = null;
            if (!empty($stakeTxs)) {
                $oldestStakeAt = $stakeTxs[0]['created_at'] ?? null;
            }
            $backfillAt = $oldestStakeAt;
            if (!$backfillAt && !empty($fundings)) {
                $backfillAt = $fundings[0]['created_at'] ?? null;
            }
            if (!$backfillAt) {
                $backfillAt = nowUtcSql();
            } else {
                // 1초 빼서 정확히 직전 시점으로.
                try {
                    $dt = new DateTime($backfillAt);
                    $dt->modify('-1 second');
                    $backfillAt = $dt->format('Y-m-d H:i:s');
                } catch (Throwable $_) { /* 형식 오류 시 그대로 */ }
            }

            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                 VALUES (?, ?, '완료', 'SilicaSTO', ?, 0, ?, ?, ?)",
                [
                    $address,
                    $kind,
                    $amt,
                    $amt,
                    "[v455 reconcile] holdings/이력 차이 보정 ({$kind} {$amt} STO)",
                    $backfillAt,
                ]
            );
            $result['applied'][] = "staked gap 백필: {$kind} {$amt} STO @ {$backfillAt}";
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, '백필 실패: ' . $e->getMessage());
    }

    jsonOk($result);
});

// (2026-05-17 v456) v455 백필 row 되돌리기 — '[v455 reconcile]' marker 가 있는
//   row 만 DELETE 시도.
// (2026-05-17 v458) try/catch + 상세 에러 진단.
// (2026-05-17 v459) DB 의 trg_wallet_transactions_no_delete trigger 가 무조건
//   DELETE 차단 (SQLSTATE 45000). DELETE 대신 soft-delete (UPDATE status='취소'
//   + memo 에 reverted marker 추가). 진단 도구는 이 marker 보고 무시.
post('/api/admin/staking/reconcile-revert', function () {
    adminOnly();
    $body = getJsonBody();
    $address = trim((string)($body['address'] ?? ''));
    if ($address === '') jsonError(400, 'address 필요');

    try {
        // 이미 reverted 된 row 는 제외 — memo 에 '[v459 reverted]' marker 가
        // 추가되었거나 status='취소' 인 것.
        $rows = DB::fetchAll(
            "SELECT id, kind, amount, memo, status, created_at
             FROM wallet_transactions
             WHERE TRIM(address)=TRIM(?)
               AND memo LIKE ?
               AND memo NOT LIKE ?
               AND status <> '취소'
             ORDER BY id DESC",
            [$address, '[v455 reconcile]%', '%[v459 reverted]%']
        );

        if (empty($rows)) {
            jsonOk(['address' => $address, 'reverted' => 0, 'rows' => []]);
            return;
        }

        $ids = [];
        foreach ($rows as $r) {
            $id = (int)($r['id'] ?? 0);
            if ($id > 0) $ids[] = $id;
        }
        if (empty($ids)) {
            jsonOk(['address' => $address, 'reverted' => 0, 'rows' => $rows, 'note' => 'No valid row ids']);
            return;
        }

        // (v459) Soft-delete: status='취소' + memo CONCAT marker. trigger 우회.
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $nowMarker = '[v459 reverted at ' . nowUtcSql() . ']';
        $stmt = DB::pdo()->prepare(
            "UPDATE wallet_transactions
                SET status='취소',
                    memo = CONCAT(IFNULL(memo, ''), ' ', ?)
              WHERE id IN ({$placeholders})"
        );
        $execParams = array_merge([$nowMarker], $ids);
        $stmt->execute($execParams);
        $reverted = $stmt->rowCount();

        jsonOk([
            'address'  => $address,
            'reverted' => $reverted,
            'matched'  => count($rows),
            'rows'     => $rows,
            'mode'     => 'soft-delete',
            'note'     => 'wallet_transactions DELETE 가 DB trigger 로 차단되어 soft-delete (status=취소 + memo marker) 적용. 진단 도구는 이 marker row 무시.',
        ]);
    } catch (Throwable $e) {
        error_log('[v459 reconcile-revert] failed: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        jsonError(500, '백필 되돌리기 실패: ' . $e->getMessage(), [
            'detail' => $e->getMessage(),
            'file'   => basename($e->getFile()),
            'line'   => $e->getLine(),
        ]);
    }
});

/**
 * 월별 이자 배정 배치 실행 (내부 공용 함수).
 * 크론 엔드포인트 및 Lazy Trigger 양쪽에서 재사용.
 *
 * @param string $monthKey YYYY-MM
 * @param bool $force 이미 완료된 달이어도 강제 재실행
 * @return array 결과 summary
 */
function runMonthlyInterestBatch(string $monthKey, bool $force = false): array {
    $payDay = defined('STAKING_PAYDAY') ? (int)STAKING_PAYDAY : 15;
    $todayKst = (int)nowKST()->format('j');

    $lockKey = "cron_accrual_done_{$monthKey}";
    $existingLock = trim((string)(getSetting($lockKey, '') ?? ''));
    if ($existingLock !== '' && !$force) {
        return [
            'skipped' => true,
            'reason' => 'already_completed',
            'completed_at' => $existingLock,
            'month_key' => $monthKey,
        ];
    }

    $allowedStatuses = [STATUSES['DISTRIBUTING'], STATUSES['OPERATING']];
    $placeholders = implode(',', array_fill(0, count($allowedStatuses), '?'));
    $assets = DB::fetchAll(
        "SELECT * FROM assets WHERE status IN ({$placeholders}) AND is_public = 1 ORDER BY id ASC",
        $allowedStatuses
    );

    $summary = [
        'month_key' => $monthKey,
        'payday' => $payDay,
        'kst_today' => $todayKst,
        'force' => $force,
        'asset_total' => count($assets),
        'asset_with_holders' => 0,
        'holder_paid' => 0,
        'holder_already' => 0,
        'holder_failed' => 0,
        'total_interest_usdt' => 0.0,
        'per_asset' => [],
    ];

    foreach ($assets as $asset) {
        $assetId = (string)($asset['id'] ?? '');
        if ($assetId === '') continue;
        if (!stakingAllowsNewStake($asset['status'] ?? '')) continue;

        // (audit H11 fix · 2026-06-10) 자격 컬럼을 silica_sto_staked 로 통일.
        //   기존: staked_token > 0 (legacy 컬럼).
        //   변경: silica_sto_staked > 0 (현행 stake 잔액 컬럼) — dividend cron 및 wind-down
        //         force-unstake 와 일관성 유지. drift 점검은 PRODUCTION_CHECKLIST 참조.
        $holders = DB::fetchAll(
            "SELECT address FROM holdings WHERE asset_id=? AND silica_sto_staked > 0 ORDER BY address ASC",
            [$assetId]
        );
        if (!$holders) continue;

        $summary['asset_with_holders']++;
        $assetStats = [
            'asset_id' => $assetId,
            'holder_count' => count($holders),
            'paid' => 0,
            'already' => 0,
            'failed' => 0,
            'total_usdt' => 0.0,
        ];

        foreach ($holders as $holder) {
            $address = trim((string)($holder['address'] ?? ''));
            if ($address === '') continue;

            $existing = DB::fetchOne(
                "SELECT id FROM interest_claims WHERE address=? AND asset_id=? AND month_key=? LIMIT 1",
                [$address, $assetId, $monthKey]
            );
            if ($existing) {
                $assetStats['already']++;
                $summary['holder_already']++;
                continue;
            }

            try {
                $result = createInterestAccrualRecord($address, $asset, $monthKey);
                $assetStats['paid']++;
                $assetStats['total_usdt'] += (float)($result['amount_usdt'] ?? 0);
                $summary['holder_paid']++;
                $summary['total_interest_usdt'] += (float)($result['amount_usdt'] ?? 0);
            } catch (Throwable $e) {
                $assetStats['failed']++;
                $summary['holder_failed']++;
                error_log("[interest batch] {$assetId}/{$address}: " . $e->getMessage());
            }
        }

        $summary['per_asset'][] = $assetStats;
    }

    $summary['total_interest_usdt'] = round($summary['total_interest_usdt'], 6);

    // (audit H10 fix · 2026-06-10) holder_failed > 0 일 때 done lock 마킹 금지.
    //   기존: 일부 holder 실패해도 cron_accrual_done_{YYYY-MM} 가 저장되어 다음 cron 이
    //         "이미 완료" 로 간주 → 미지급 사용자가 영구히 누락.
    //   변경: holder_failed === 0 일 때만 lock 저장. 부분 실패 시 cron 이 다음 실행에서
    //         실패한 holder 만 재시도. interest_claims 의 UNIQUE constraint (v900) 가
    //         이미 처리된 holder 의 중복 INSERT 차단.
    if ($summary['holder_failed'] === 0) {
        try {
            setSetting($lockKey, nowUtcSql());
        } catch (Throwable $e) {
            error_log('[interest batch] lock save failed: ' . $e->getMessage());
        }
        $summary['locked_at'] = nowUtcSql();
    } else {
        $summary['locked_at'] = null;
        $summary['lock_skipped_reason'] = 'holder_failed_gt_zero';
        error_log(
            "[interest batch] DONE lock SKIPPED — holder_failed={$summary['holder_failed']} > 0. " .
            "Next cron run will retry. Operator review required: see error_log entries above for failed holders."
        );
    }

    return $summary;
}

/**
 * Lazy Trigger — 사용자 요청 처리 중 자동 배정 발사.
 * /api/public/config 같은 공용 엔드포인트 상단에서 호출.
 *
 * 조건:
 * 1. KST 오늘이 Lock 기간(14-16일) 이내
 * 2. 해당 월 배정이 아직 완료 안 됨 (cron_accrual_done_YYYY-MM 없음)
 * 3. 동시 트리거 방지 (5분 inflight lock)
 *
 * 동작:
 * - fastcgi_finish_request()로 클라이언트 응답 먼저 전송
 * - 이후 백그라운드에서 runMonthlyInterestBatch 실행
 * - 모든 에러는 error_log로만 기록, 사용자에게 영향 없음
 */
function lazyTryMonthlyInterestAccrual(): void {
    try {
        $todayKst = (int)nowKST()->format('j');
        // (2026-06-14 v897) audit H7 부분수정 — lazy 경로에도 지급일(15일) 가드 추가.
        //   배경: 이자 cron($cronAccrueHandler, L1887)·배당 cron(admin_silica_dividend.php
        //         L556) 은 'todayKst < payDay(15) → 거부' 룰이 있으나, 이 lazy 경로에는 그
        //         룰이 빠져 있어 14일(lock window 시작일)에 공개 페이지 조회만 해도 이자
        //         적립이 실행됨 → "15일 지급" 정책이 하루 빨라지는 불일치(운영자 2026-06-14
        //         발견: 같은 사이클 이자가 14일에 claim 활성, 배당은 정상적으로 비활성).
        //   조치: 배당/이자 cron 과 동일하게 지급일(15일) 이전 적립을 차단. 15·16일은 기존대로
        //         허용(lock window). 이중지급 방지는 별개로 interest_claims UNIQUE(v900)+
        //         cron_accrual_done lock 이 계속 담당.
        //   Revert: 아래 payDay 가드 2줄을 삭제(또는 주석)하면 직전(잠금기간만 체크) 동작 복귀.
        $payDay = defined('STAKING_PAYDAY') ? (int)STAKING_PAYDAY : 15;
        if ($todayKst < $payDay) return;
        $lockDays = defined('STAKING_LOCK_DAYS') ? STAKING_LOCK_DAYS : [14, 15, 16];
        if (!in_array($todayKst, $lockDays, true)) return;

        $monthKey = monthKeyKST();

        // 이미 완료된 달이면 스킵
        $doneKey = "cron_accrual_done_{$monthKey}";
        $done = trim((string)(getSetting($doneKey, '') ?? ''));
        if ($done !== '') return;

        // 동시 트리거 방지 — 5분 inflight lock
        $inflightKey = "cron_accrual_inflight_{$monthKey}";
        $inflight = trim((string)(getSetting($inflightKey, '') ?? ''));
        if ($inflight !== '') {
            $inflightTs = strtotime($inflight);
            if ($inflightTs && (time() - $inflightTs) < 300) return;
        }
        setSetting($inflightKey, gmdate('Y-m-d H:i:s'));

        // 클라이언트 응답을 먼저 끝내고 백그라운드에서 실행
        if (function_exists('fastcgi_finish_request')) {
            register_shutdown_function(function () use ($monthKey) {
                try {
                    runMonthlyInterestBatch($monthKey, false);
                } catch (Throwable $e) {
                    error_log('[lazy accrue] shutdown batch failed: ' . $e->getMessage());
                }
            });
        } else {
            try {
                runMonthlyInterestBatch($monthKey, false);
            } catch (Throwable $e) {
                error_log('[lazy accrue] inline batch failed: ' . $e->getMessage());
            }
        }
    } catch (Throwable $e) {
        error_log('[lazy accrue] outer error: ' . $e->getMessage());
    }
}

/**
 * 월별 자동 이자 배정 (크론 전용) — GET/POST 모두 지원
 *
 * 인증: CRON_KEY 환경변수 값과 일치하는 header 또는 GET param 필요
 *   - X-Cron-Key: <CRON_KEY>
 *   - ?key=<CRON_KEY>
 *
 * 날짜 제한: KST 오늘이 Lock 기간(14-16일) 이내. 우회 불가능.
 *   (2026-05-18 v574) ?force=1 지원 제거 — 운영자 보안 원칙: CRON_KEY 유출
 *   대비. 키 인증 후에도 시간 가드는 무조건. 관리자 catch-up 필요 시 별도
 *   adminOnly() 엔드포인트 추가 필요.
 *
 * Hostinger 크론 설정 예시 (매시 + Lock 기간만 자동 실행):
 *   0 * 14-16 * * curl -s "https://rwa6.kolstoken.com/api/cron/accrue-interest?key=CRON_SECRET"
 *
 * 브라우저 테스트: 주소창에 그대로 입력 가능 (GET 지원).
 */
$cronAccrueHandler = function () {
    $providedKey = trim((string)($_SERVER['HTTP_X_CRON_KEY'] ?? $_GET['key'] ?? ''));
    $expectedKey = trim((string)env('CRON_KEY', ''));
    if ($expectedKey === '' || $providedKey === '' || !hash_equals($expectedKey, $providedKey)) {
        jsonError(401, 'CRON_KEY 인증 실패 — .env에 CRON_KEY 설정 후 요청 header/key 파라미터로 전달하세요.');
    }

    // (2026-05-18 v574) 운영자 보안 원칙: 'CRON_KEY 가 유출되어도 문제가 없어야
    //   한다. 키 인증 후에도 시스템이 실제 시간을 점검해야 한다.' 이전 코드는
    //   ?force=1 로 lock window 가드를 우회할 수 있어 키 유출 시 임의 시점에
    //   이자 배정이 실행 가능했음. 제거: force 인자 미지원. 시간 가드는 무조건.
    //   관리자 catch-up 이 필요하면 별도 adminOnly() 엔드포인트로 분리해야 함
    //   (현재 미구현 — 필요 시 추가).
    $payDay = defined('STAKING_PAYDAY') ? (int)STAKING_PAYDAY : 15;
    $lockDays = defined('STAKING_LOCK_DAYS') ? STAKING_LOCK_DAYS : [14, 15, 16];
    $todayKst = (int)nowKST()->format('j');

    // 자동 크론은 반드시 스테이킹 Lock 기간(14~16일) 내에서만 실행.
    // 이유: Lock 기간 밖에는 사용자가 언스테이킹 가능 → holdings 상태가 15일 시점과 달라질 수 있음
    // → "15일 스테이킹 유저만 지급" 정책 위반 위험.
    // Lock 기간 내에는 holdings.staked_token이 불변이므로 14/15/16일 어느 시점이든 정확한 15일 스냅샷.
    if ($todayKst < $payDay) {
        jsonError(400, "오늘은 KST 기준 {$todayKst}일 — 지급일({$payDay}일) 이전입니다. 자동 실행은 지급일 도래 후에만 가능합니다.");
    }
    if (!in_array($todayKst, $lockDays, true)) {
        $lockMin = min($lockDays);
        $lockMax = max($lockDays);
        jsonError(400, "오늘은 KST 기준 {$todayKst}일 — 스테이킹 Lock 기간({$lockMin}~{$lockMax}일)을 벗어나 holdings 상태 신뢰 불가. 시간 가드는 우회 불가능.");
    }

    $monthKey = monthKeyKST();
    // force=false 고정 — HTTP cron 경로는 idempotency 우회 불허. 이미 처리된
    //   달은 silent skip 으로 끝남 (반복 호출에 안전).
    $summary = runMonthlyInterestBatch($monthKey, false);

    // skipped 케이스 친절 메시지 보강
    if (!empty($summary['skipped'])) {
        $summary['message'] = "{$monthKey} 이자 배정이 이미 {$summary['completed_at']}에 완료되었습니다.";
    }

    jsonOk($summary);
};

// GET/POST 둘 다 지원 — 브라우저 직접 테스트 및 curl 양쪽 호환
post('/api/cron/accrue-interest', $cronAccrueHandler);
get('/api/cron/accrue-interest', $cronAccrueHandler);

// (2026-05-15 v376) Admin schema status check — UNIQUE 제약 적용 여부 검증.
//   operator 가 self-healing migration 의 실제 적용 결과 확인 가능.
get('/api/admin/staking/schema-status', function () {
    adminOnly();

    // (v379) interest_claims UNIQUE 시도 제거 — testBtn 의도된 중복과 충돌.
    //   dividend 의 self-healing 만 호출 (운영 환경 안전).
    if (function_exists('silicaEnsureDividendSchema')) {
        silicaEnsureDividendSchema();
    }

    $result = [
        'interest_claims' => ['table' => 'interest_claims', 'unique_keys' => []],
        'dividend_payouts' => ['table' => 'dividend_payouts', 'unique_keys' => []],
    ];

    try {
        $rows = DB::fetchAll(
            "SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
               FROM INFORMATION_SCHEMA.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'interest_claims'
                AND NON_UNIQUE = 0
              ORDER BY INDEX_NAME, SEQ_IN_INDEX"
        );
        $byKey = [];
        foreach ($rows as $r) {
            $kn = $r['INDEX_NAME'];
            $byKey[$kn] = $byKey[$kn] ?? [];
            $byKey[$kn][] = $r['COLUMN_NAME'];
        }
        foreach ($byKey as $kn => $cols) {
            $result['interest_claims']['unique_keys'][] = ['name' => $kn, 'columns' => $cols];
        }
        $hasUx = isset($byKey['ux_ic_addr_asset_month']);
        $result['interest_claims']['has_ux_addr_asset_month'] = $hasUx;
        // (audit 신규Medium fix · 2026-06-12) policy 문구를 실제 DB 인덱스 존재
        //   여부로 동적 표시. 기존 하드코딩 'no_unique (testBtn 의도된 중복 허용)'
        //   는 v379 devnet 정책 — v900 에서 mainnet 용 UNIQUE 가 실제로 추가된
        //   뒤에도 옛 문구가 그대로 표시되어 운영 검증 시 오인 유발 (audit 지적).
        $result['interest_claims']['policy'] = $hasUx
            ? 'unique_enforced (v900 — ux_ic_addr_asset_month 적용, 이중지급 race DB 차단)'
            : 'no_unique — 경고: mainnet 운영에는 ux_ic_addr_asset_month UNIQUE 필요. sql/manual_add_interest_claims_unique_v900.sql 적용 여부 확인.';
    } catch (Throwable $e) {
        $result['interest_claims']['error'] = $e->getMessage();
    }

    try {
        $rows = DB::fetchAll(
            "SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
               FROM INFORMATION_SCHEMA.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'dividend_payouts'
                AND NON_UNIQUE = 0
              ORDER BY INDEX_NAME, SEQ_IN_INDEX"
        );
        $byKey = [];
        foreach ($rows as $r) {
            $kn = $r['INDEX_NAME'];
            $byKey[$kn] = $byKey[$kn] ?? [];
            $byKey[$kn][] = $r['COLUMN_NAME'];
        }
        foreach ($byKey as $kn => $cols) {
            $result['dividend_payouts']['unique_keys'][] = ['name' => $kn, 'columns' => $cols];
        }
        $result['dividend_payouts']['has_ux_payout_addr'] = isset($byKey['ux_dividend_payouts_exec_addr']);
    } catch (Throwable $e) {
        $result['dividend_payouts']['error'] = $e->getMessage();
    }

    jsonOk($result);
});

// (2026-05-15 v369) 운영자: '이자 지급 로그를 추가해라' — admin/staking.html
//   에 운영자가 cron 자동 발화 결과 + testInterestBtn 결과 모두 시각화.
// (2026-05-15 v371) 운영자: '전체 데이터 다 불러오는 건 부담. 묶음으로 회차별
//   지급 여부만 표기, 클릭 시 팝업에 세부 50개씩 분할.' 2단계 뷰:
//   1) /interest-summary — 회차(month_key, asset_id) 별 집계만
//   2) /interest-log — 특정 회차 클릭 시 50개씩 분할 fetch (offset 지원)
// ----------------------------------------------------------------

// 회차별 집계 — 가벼운 default 카드 데이터
get('/api/admin/staking/interest-summary', function () {
    adminOnly();
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 24)));   // 최근 N개월, 24 default

    $rows = DB::fetchAll(
        "SELECT month_key, asset_id,
                COUNT(*) AS total_count,
                SUM(CASE WHEN claimed_at IS NOT NULL THEN 1 ELSE 0 END) AS paid_count,
                SUM(CASE WHEN claimed_at IS NULL THEN 1 ELSE 0 END) AS pending_count,
                COALESCE(SUM(amount_usdt), 0) AS total_usdt,
                COALESCE(SUM(CASE WHEN claimed_at IS NULL THEN amount_usdt ELSE 0 END), 0) AS pending_usdt,
                MIN(created_at) AS first_created_at,
                MAX(created_at) AS last_created_at
           FROM interest_claims
          GROUP BY month_key, asset_id
          ORDER BY month_key DESC, asset_id ASC
          LIMIT " . $limit
    );

    jsonOk(['rows' => $rows]);
});

// 세부 로그 — 모달용 + 페이지네이션 (50개씩). status 필터 옵션.
get('/api/admin/staking/interest-log', function () {
    adminOnly();
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    $monthKey = trim((string)($_GET['month_key'] ?? ''));
    $assetId = trim((string)($_GET['asset_id'] ?? ''));
    $address = trim((string)($_GET['address'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));

    $where = [];
    $params = [];
    if ($monthKey !== '' && preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
        $where[] = "month_key = ?";
        $params[] = $monthKey;
    }
    if ($assetId !== '') {
        $where[] = "asset_id = ?";
        $params[] = $assetId;
    }
    // (2026-05-15 v389) 운영자: '지갑 주소 일부 입력에서 검색이 되지 않는
    //   문제가 있다.' v372 의 exact match (`address = ?`) 가 UI 상 truncated
    //   주소 (예: '7oWYGT...B2tU') 의 앞/뒤 일부 검색을 막고 있었음. LIKE
    //   파셜 매치로 변경 — 동일 패턴인 dividend payout-log (v373) 와 일치.
    if ($address !== '') {
        $where[] = "address LIKE ?";
        $params[] = '%' . $address . '%';
    }
    if ($status === 'pending') {
        $where[] = "claimed_at IS NULL";
    } elseif ($status === 'claimed') {
        $where[] = "claimed_at IS NOT NULL";
    }
    $whereSql = $where ? "WHERE " . implode(" AND ", $where) : "";

    $rows = DB::fetchAll(
        "SELECT id, address, asset_id, month_key, amount_usdt, amount_local, fx_per_usdt,
                apr_snapshot, staked_snapshot, settlement_basis, claim_batch_id,
                claimed_at, created_at
           FROM interest_claims
           {$whereSql}
           ORDER BY created_at DESC, id DESC
           LIMIT " . $limit . " OFFSET " . $offset,
        $params
    );

    $count = (int)(DB::fetchValue(
        "SELECT COUNT(*) FROM interest_claims {$whereSql}",
        $params
    ) ?? 0);

    jsonOk([
        'rows' => $rows,
        'pagination' => [
            'total' => $count,
            'limit' => $limit,
            'offset' => $offset,
            'has_more' => ($offset + $limit) < $count,
        ],
    ]);
});

// (2026-05-15 v370) 임시 진단 endpoint 2개 제거:
//   - POST /api/admin/staking/reset-accrual-done (v362) — done 키 reset
//   - POST /api/admin/staking/clear-month-claims (v368) — interest_claims 행 삭제
//   5월 cron 자동 발화 검증 완료 후 production 보안을 위해 제거.
//   향후 동일 시나리오 (재해 복구 등) 발생 시 재추가 가능. 코드 history
//   는 git log v362/v368 commit 에 보존.

get('/api/interest/history', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $assetId = trim((string)($_GET['assetId'] ?? ''));

    $params = [$address];
    $where = "WHERE i.address=?";
    if ($assetId !== '') {
        $where .= " AND i.asset_id=?";
        $params[] = $assetId;

        $asset = getAsset($assetId);
        if ($asset && stakingIsSoldStatus($asset['status'] ?? '')) {
            $cutoffMonth = stakingResolveSoldClaimCutoffMonth($assetId);
            $where .= " AND NOT (i.claimed_at IS NULL AND i.month_key >= ?)";
            $params[] = $cutoffMonth;
        }
    }

    $rows = DB::fetchAll(
        "SELECT i.*, a.name AS asset_name
         FROM interest_claims i
         LEFT JOIN assets a ON a.id=i.asset_id
         $where
         ORDER BY i.created_at DESC, i.id DESC
         LIMIT 200",
        $params
    );
    jsonOk(['rows' => $rows]);
});

/**
 * (2026-05-10 v220) Admin backfill — split existing aggregated
 * `interest_claim` wallet_transactions rows into per-cycle rows.
 * Operator: '이자 건당 표기 되어야하지만, 누적 합산 표기 되고 있다.'
 * Older `interest_claim` rows were inserted with the SUMMED total of
 * a claim batch (one row per batch, memo '스테이킹 이자 일괄 클레임
 * <asset> · N건'); v220 going forward emits one row per cycle. This
 * endpoint cleans up the legacy aggregated rows.
 *
 * Approach (idempotent, safe to re-run):
 *   1. DELETE all wallet_transactions WHERE kind='interest_claim'.
 *   2. For every claimed interest_claims row (claimed_at IS NOT NULL),
 *      INSERT one wallet_transactions row carrying that cycle's
 *      amount_usdt + month_key + claim_batch_id in the memo.
 *
 * Auth: admin only.
 *
 * Query params:
 *   dry_run=1   → don't modify, just report counts
 *   limit=N     → process at most N rows (default no cap)
 *
 * Response:
 *   { ok, dry_run, claim_count, deleted, inserted }
 */
post('/api/admin/interest-history-backfill', function () {
    adminAuth();

    $dryRun = (string)($_GET['dry_run'] ?? '0') === '1';
    $limit  = (int)($_GET['limit'] ?? 0);

    $sql = "SELECT * FROM interest_claims WHERE claimed_at IS NOT NULL ORDER BY claimed_at ASC, id ASC";
    if ($limit > 0) $sql .= " LIMIT {$limit}";
    $claims = DB::fetchAll($sql);
    $claimCount = count($claims);

    $deleted = 0;
    if (!$dryRun) {
        $deleted = (int)DB::execute(
            "DELETE FROM wallet_transactions WHERE kind='interest_claim'"
        );
    }

    $inserted = 0;
    foreach ($claims as $c) {
        $address = trim((string)($c['address'] ?? ''));
        $assetId = (string)($c['asset_id'] ?? '');
        $monthKey = (string)($c['month_key'] ?? '');
        $amountUsdt = (float)($c['amount_usdt'] ?? 0);
        $batchId = (string)($c['claim_batch_id'] ?? '');
        $claimedAt = (string)($c['claimed_at'] ?? '');
        if ($address === '' || $amountUsdt <= 0) continue;

        if (!$dryRun) {
            DB::execute(
                "INSERT INTO wallet_transactions(address, kind, status, amount, before_amount, after_amount, txid, memo, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    $address,
                    'interest_claim',
                    '완료',
                    clamp6($amountUsdt),
                    0, 0, null,
                    sprintf('스테이킹 이자 클레임 %s · %s · 회차 %s (backfill)', $assetId, $monthKey, $batchId),
                    $claimedAt !== '' ? $claimedAt : nowUtcSql(),
                ]
            );
        }
        $inserted++;
    }

    jsonOk([
        'ok' => true,
        'dry_run' => $dryRun,
        'claim_count' => $claimCount,
        'deleted' => $deleted,
        'inserted' => $inserted,
    ]);
});
