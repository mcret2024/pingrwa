<?php
/**
 * Silica-specific helpers
 * Phase D: Solana 토큰 연동 (SilicaSTO + Silica 두 토큰)
 */

if (!function_exists('silicaGetStoMint')) {
    /**
     * SilicaSTO 토큰 mint 주소 조회 (관리자 설정에서)
     */
    function silicaGetStoMint(): string {
        $mint = (string)getSetting('silica_sto_mint', '');
        return trim($mint);
    }
}

if (!function_exists('silicaGetTokenMint')) {
    /**
     * Silica 보상 토큰 mint 주소 조회
     */
    function silicaGetTokenMint(): string {
        $mint = (string)getSetting('silica_token_mint', '');
        return trim($mint);
    }
}

if (!function_exists('silicaRequireStoMint')) {
    /**
     * SilicaSTO mint이 설정되지 않은 경우 예외 발생
     */
    function silicaRequireStoMint(): string {
        $mint = silicaGetStoMint();
        if ($mint === '') {
            throw new RuntimeException('SilicaSTO 토큰 mint 주소가 설정되지 않았습니다. 관리자 설정에서 등록해주세요.');
        }
        if (!isValidSolanaAddress($mint)) {
            throw new RuntimeException('SilicaSTO mint 주소가 유효하지 않습니다: ' . $mint);
        }
        return $mint;
    }
}

if (!function_exists('silicaRequireTokenMint')) {
    /**
     * Silica 토큰 mint이 설정되지 않은 경우 예외 발생
     */
    function silicaRequireTokenMint(): string {
        $mint = silicaGetTokenMint();
        if ($mint === '') {
            throw new RuntimeException('Silica 토큰 mint 주소가 설정되지 않았습니다. 관리자 설정에서 등록해주세요.');
        }
        if (!isValidSolanaAddress($mint)) {
            throw new RuntimeException('Silica mint 주소가 유효하지 않습니다: ' . $mint);
        }
        return $mint;
    }
}

if (!function_exists('silicaGetCurrentPrice')) {
    /**
     * 현재 Silica 토큰 시세 (USDT)
     * @return float Silica 1개당 USDT 가격
     */
    function silicaGetCurrentPrice(): float {
        $stored = getSetting('silica_price_usdt', null);
        if (!$stored) return 0.0;
        $obj = is_string($stored) ? json_decode($stored, true) : $stored;
        if (is_array($obj)) {
            return (float)($obj['value'] ?? 0);
        }
        return (float)$stored;
    }
}

if (!function_exists('silicaCalcSwapRate')) {
    /**
     * Silica → SilicaSTO 스왑 환산율
     * 1 SilicaSTO = 1 USDT (페그)
     * Silica 1개 가격 = X USDT
     * 따라서: 1 SilicaSTO = (1 / X) Silica 필요
     *
     * @return array { silica_per_sto, sto_per_silica, silica_price_usdt }
     */
    function silicaCalcSwapRate(): array {
        $price = silicaGetCurrentPrice();
        if ($price <= 0) {
            return [
                'silica_per_sto' => 0.0,
                'sto_per_silica' => 0.0,
                'silica_price_usdt' => 0.0,
                'error' => 'Silica 시세가 설정되지 않았습니다.',
            ];
        }
        return [
            'silica_per_sto' => round(1 / $price, 8),
            'sto_per_silica' => $price,
            'silica_price_usdt' => $price,
        ];
    }
}

if (!function_exists('silicaConvertSilicaToSto')) {
    /**
     * Silica 수량을 SilicaSTO 수량으로 환산
     */
    function silicaConvertSilicaToSto(float $silicaAmount): float {
        $price = silicaGetCurrentPrice();
        if ($price <= 0) return 0.0;
        return round($silicaAmount * $price, 6);
    }
}

if (!function_exists('silicaConvertUsdtToSilica')) {
    /**
     * USDT 가치를 Silica 수량으로 환산 (배당 계산용)
     * @return float Silica 수량 (소수점 2자리)
     */
    function silicaConvertUsdtToSilica(float $usdtValue): float {
        $price = silicaGetCurrentPrice();
        if ($price <= 0) return 0.0;
        return round($usdtValue / $price, 2);
    }
}

if (!function_exists('silicaGetSingleAssetId')) {
    /**
     * Silica는 단일 자산이므로 항상 'SILICA-79907'
     */
    function silicaGetSingleAssetId(): string {
        return 'SILICA-79907';
    }
}

if (!function_exists('silicaGetSingleAsset')) {
    /**
     * 단일 자산 정보 조회
     */
    function silicaGetSingleAsset(): ?array {
        return DB::fetchOne(
            "SELECT * FROM assets WHERE id = ?",
            [silicaGetSingleAssetId()]
        );
    }
}

if (!function_exists('silicaGetCurrentRateBps')) {
    /**
     * 현재 회차의 적용 이자율 (bps 단위)
     * 500 = 5.00%
     */
    function silicaGetCurrentRateBps(): int {
        // 회차: 매월 16일~다음달 15일, 지급일=15일
        $today = time();
        $day = (int)date('d', $today);
        $year = (int)date('Y', $today);
        $month = (int)date('m', $today);
        if ($day > 15) {
            $month++;
            if ($month > 12) { $month = 1; $year++; }
        }
        $thisCyclePayout = sprintf('%04d-%02d-15', $year, $month);

        $row = DB::fetchOne(
            "SELECT rate_bps FROM interest_rate_history
             WHERE effective_from_payout <= ?
             ORDER BY effective_from_payout DESC LIMIT 1",
            [$thisCyclePayout]
        );
        return $row ? (int)$row['rate_bps'] : 500; // 기본 5%
    }
}

if (!function_exists('silicaGetCurrentSalePhase')) {
    /**
     * 현재 진행 중인 SilicaSTO 판매 단계
     * Silica 정책: 1 USDT = 1 SilicaSTO 고정 페어. price_usdt 는 항상 1.0.
     * @return array { phase, price_usdt, target_usdt, raised_usdt, progress_pct }
     */
    function silicaGetCurrentSalePhase(): array {
        $stored = getSetting('silica_sale_phase', null);
        $defaults = [
            'phase' => 'public',
            'price_usdt' => 1.0,
            'target_usdt' => 1000000.0,
        ];
        if ($stored) {
            $obj = is_string($stored) ? json_decode($stored, true) : $stored;
            if (is_array($obj)) {
                $obj = array_merge($defaults, $obj);
            } else {
                $obj = $defaults;
            }
        } else {
            $obj = $defaults;
        }

        // 정책: 1 USDT = 1 SilicaSTO 고정 페어.
        // 과거 DB seed 의 0.001 같은 값이 들어있어도 응답은 항상 1.0 으로 강제.
        $obj['price_usdt'] = 1.0;

        // raised_usdt: 단일 자산의 raised_usdt에서 계산
        $asset = silicaGetSingleAsset();
        $raised = $asset ? (float)$asset['raised_usdt'] : 0.0;
        $obj['raised_usdt'] = $raised;
        $obj['progress_pct'] = $obj['target_usdt'] > 0
            ? round($raised / $obj['target_usdt'] * 100, 2)
            : 0.0;

        return $obj;
    }
}

if (!function_exists('silicaGetMaxStoSupply')) {
    /**
     * (2026-05-07) Global SilicaSTO max sale supply.
     *   Setting key: silica_max_sto_supply (integer; 0 = unlimited).
     *   Stored as a plain numeric string in settings; cast to float for arithmetic.
     */
    function silicaGetMaxStoSupply(): float {
        $raw = getSetting('silica_max_sto_supply', '0');
        $val = (float)$raw;
        return ($val > 0) ? $val : 0.0;
    }
}

if (!function_exists('silicaGetSoldStoTotal')) {
    /**
     * Total SilicaSTO already sold (= total USDT raised on the single asset
     * since the project enforces a 1 USDT = 1 SilicaSTO peg).
     *
     * Source of truth: investment_contracts where status IN ('completed',
     * 'awaiting_admin') for the canonical asset. We include awaiting_admin so
     * that pending invest requests reserve their share of the cap — preventing
     * two users racing past the cap because both see "remaining > 0" before
     * either is signed by admin.
     */
    function silicaGetSoldStoTotal(): float {
        $assetId = silicaGetSingleAssetId();
        try {
            $val = DB::fetchValue(
                "SELECT COALESCE(SUM(amount_usdt), 0) FROM investment_contracts
                  WHERE asset_id=? AND status IN ('completed', 'awaiting_admin')",
                [$assetId],
                0
            );
            return (float)$val;
        } catch (Throwable $e) {
            error_log('[silicaGetSoldStoTotal] failed: ' . $e->getMessage());
            return 0.0;
        }
    }
}

if (!function_exists('silicaRemainingStoSupply')) {
    /**
     * Remaining SilicaSTO that can still be sold.
     *   - max=0 (unlimited) → returns PHP_FLOAT_MAX (effectively no cap).
     *   - sold >= max → returns 0.
     */
    function silicaRemainingStoSupply(): float {
        $max = silicaGetMaxStoSupply();
        if ($max <= 0) return PHP_FLOAT_MAX;
        $sold = silicaGetSoldStoTotal();
        return max(0.0, $max - $sold);
    }
}

if (!function_exists('silicaIsSaleOpen')) {
    /**
     * True when invest contracts can still be created.
     *   - No cap configured (max=0) → always open.
     *   - sold < max → open.
     *   - sold >= max → closed.
     */
    function silicaIsSaleOpen(): bool {
        $max = silicaGetMaxStoSupply();
        if ($max <= 0) return true;
        return silicaGetSoldStoTotal() < $max;
    }
}

if (!function_exists('silicaGetSaleNotice')) {
    /**
     * (2026-05-16 v423) Admin-configurable sale-supply notice text shown
     * directly above the "◆ Total Sale Supply" label on user/assets.html.
     *
     * Setting keys:
     *   silica_sale_notice_ko  (string, default '')   — 국문 안내
     *   silica_sale_notice_en  (string, default '')   — English notice
     *
     * Empty string → no notice rendered on the user page. Multi-line text
     * preserved (newlines collapse to <br> via white-space: pre-wrap on
     * the frontend element). Frontend renders via textContent → XSS safe.
     *
     * Returns the raw stored value (no escaping). Caller is responsible
     * for HTML-safe rendering; the user page uses textContent + CSS
     * white-space: pre-wrap.
     *
     * @param string $lang  'ko' or 'en'. Anything else falls back to 'ko'.
     */
    function silicaGetSaleNotice(string $lang = 'ko'): string {
        $l = strtolower(trim($lang));
        $key = ($l === 'en') ? 'silica_sale_notice_en' : 'silica_sale_notice_ko';
        return (string)(getSetting($key, '') ?? '');
    }
}

if (!function_exists('silicaSetSaleNotice')) {
    /**
     * (2026-05-16 v423) Admin endpoint helper — persists sale notice text.
     *
     * Validates: length <= 500 chars per language. Newlines preserved.
     * Trims surrounding whitespace. Empty string clears the notice.
     *
     * Returns true on success, false on validation failure (length exceeded).
     */
    function silicaSetSaleNotice(string $lang, string $value): bool {
        $l = strtolower(trim($lang));
        if ($l !== 'ko' && $l !== 'en') return false;
        $key = ($l === 'en') ? 'silica_sale_notice_en' : 'silica_sale_notice_ko';

        $v = trim($value);
        if (mb_strlen($v, 'UTF-8') > 500) return false;

        setSetting($key, $v);
        return true;
    }
}

if (!function_exists('silicaCalcMonthlyInterest')) {
    /**
     * 월 이자 계산 (USDT 단위)
     *
     * @param float $stakedSto 스테이킹 중인 SilicaSTO 수량 (1 STO = 1 USDT)
     * @param int|null $rateBps 적용 요율 (null이면 현재 회차 요율)
     * @return float 월 이자 USDT
     */
    function silicaCalcMonthlyInterest(float $stakedSto, ?int $rateBps = null): float {
        $bps = $rateBps ?? silicaGetCurrentRateBps();
        // 연 이자율(bps)을 12개월로 나눔
        return round($stakedSto * ($bps / 10000) / 12, 6);
    }
}

if (!function_exists('silicaHasDisasterPending')) {
    /**
     * 재해 모드 (이자/배당 미지급 잔존) 여부 — fast read-only check.
     *
     * (2026-05-21 보안감사) /api/silica/payment-status 의 disaster 판정 로직을
     * 함수로 추출. stake/unstake 가드에서 재사용. payment-status endpoint 와
     * 동일한 의미를 보장 (사용자 UI 와 backend 가드의 정합성).
     *
     * 판정 조건:
     *   1) live system 인가? (holdings/claims/payouts/funding 중 하나라도 활동
     *      흔적 있음). fresh install 이면 false 즉시 반환 — 잘못된 alarm 방지.
     *   2) overdue dividend 가 있는가? (scheduled status + payout_month <
     *      오늘 KST) → true
     *   3) overdue interest 가 있는가? (KST 오늘 day > 16일 AND
     *      cron_accrual_done_{YYYY-MM} 키 미설정 AND 이전 달 청구기록 존재)
     *      → true
     *   넷 다 아니면 false.
     *
     * 사용 예:
     *   if (silicaHasDisasterPending()) {
     *       jsonError(423, '재해 복구 처리 중입니다. ...');
     *   }
     */
    function silicaHasDisasterPending(): bool {
        try {
            $kstNow = new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul'));
        } catch (Throwable $_) {
            // 시간대 라이브러리 문제 → 보수적으로 false (lock 안 걸어 가벼운 op 허용).
            return false;
        }
        $today    = $kstNow->format('Y-m-d');
        $todayDay = (int)$kstNow->format('j');
        $monthKey = $kstNow->format('Y-m');

        // 1) live system 체크 — fresh install 이면 false.
        //   (audit H11 fix · 2026-06-10) staked_token + silica_sto_staked 둘 다 검사.
        //   둘 중 하나만 0 인 drift row 가 있어도 live 로 판단 (보수적). 운영 정상화 후
        //   다음 단계에서 두 컬럼 unify 가능.
        $isLiveSystem = false;
        try {
            $live = DB::fetchValue("
                SELECT (
                    (SELECT COUNT(*) FROM holdings WHERE staked_token > 0 OR silica_sto_staked > 0)
                  + COALESCE((SELECT COUNT(*) FROM interest_claims), 0)
                  + COALESCE((SELECT COUNT(*) FROM dividend_payouts), 0)
                  + COALESCE((SELECT COUNT(*) FROM funding_records), 0)
                ) AS total", []);
            $isLiveSystem = (int)($live ?? 0) > 0;
        } catch (Throwable $_) {
            $isLiveSystem = false;
        }
        if (!$isLiveSystem) return false;

        // 2) overdue dividend
        try {
            $cnt = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM dividend_executions
                  WHERE status='scheduled' AND payout_month < ?",
                [$today]
            );
            if ($cnt > 0) return true;
        } catch (Throwable $_) {}

        // 3) overdue interest — 오늘 day > 16 + cron lock 없음.
        //   (audit H13 fix · 2026-06-10) 기존 'hasPrevMonthClaims' 단독 조건은 mainnet
        //   첫 운영 월 cron 실패 시 검출 불가 (첫 달에는 이전 달 청구가 없음).
        //   production_first_payout_month setting 으로 명시적 추적 추가 — 운영자가
        //   mainnet 출시 후 첫 14일 이전에 admin 설정에서 입력 (YYYY-MM).
        //   둘 중 하나라도 true 면 overdue 로 판정 (OR 결합으로 호환성 유지).
        if ($todayDay > 16) {
            try {
                $done = trim((string)(getSetting("cron_accrual_done_{$monthKey}", '') ?? ''));
                if ($done === '') {
                    $hasPrev = (int)(DB::fetchValue(
                        "SELECT COUNT(*) FROM interest_claims WHERE month_key < ?",
                        [$monthKey]
                    ) ?? 0) > 0;
                    $firstPayout = trim((string)(getSetting('production_first_payout_month', '') ?? ''));
                    $reachedFirstPayout = $firstPayout !== '' && strcmp($monthKey, $firstPayout) >= 0;
                    if ($hasPrev || $reachedFirstPayout) return true;
                }
            } catch (Throwable $_) {}
        }

        return false;
    }
}

