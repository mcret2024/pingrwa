<?php
/**
 * Admin endpoints for managing the global SilicaSTO max sale supply.
 *
 * Setting:
 *   silica_max_sto_supply  (integer; 0 = unlimited)
 *
 * Endpoints:
 *   GET  /api/admin/silica/max-supply
 *     → { max_supply, sold_total, remaining, sale_open, can_set_min }
 *
 *   POST /api/admin/silica/max-supply
 *     body: { max_supply: int }
 *     → { ok, max_supply, sold_total, remaining, sale_open }
 *     Validation: max_supply must be a non-negative integer and either 0
 *     (unlimited) or >= sold_total. Setting it below sold_total would
 *     make the user-facing "remaining" go negative, which is nonsense —
 *     we reject with 400 and tell admin the floor.
 */

get('/api/admin/silica/max-supply', function () {
    adminAuth();
    $max = silicaGetMaxStoSupply();
    $sold = silicaGetSoldStoTotal();
    $remaining = silicaRemainingStoSupply();
    jsonOk([
        'max_supply'  => $max,
        'sold_total'  => $sold,
        'remaining'   => ($remaining === PHP_FLOAT_MAX ? null : $remaining),
        'sale_open'   => silicaIsSaleOpen(),
        // Floor for the next admin-supplied value: cannot drop below this
        // without effectively "un-selling" already-issued tokens.
        'can_set_min' => $sold,
        // (2026-05-16 v423) 운영자가 '◆ Total Sale Supply' 상단에 노출할 안내
        //   멘트. 예: '1차 판매 수량 100만 STO 까지 진행'. 빈 문자열이면 미표시.
        'notice_ko'   => function_exists('silicaGetSaleNotice') ? silicaGetSaleNotice('ko') : '',
        'notice_en'   => function_exists('silicaGetSaleNotice') ? silicaGetSaleNotice('en') : '',
    ]);
});

post('/api/admin/silica/max-supply', function () {
    $admin = adminAuth();
    $body = getJsonBody();
    $rawIn = $body['max_supply'] ?? null;
    if ($rawIn === null || $rawIn === '') {
        jsonError(400, 'max_supply 값이 필요합니다.');
    }
    if (!is_numeric($rawIn)) {
        jsonError(400, 'max_supply 는 숫자여야 합니다.');
    }
    $newMax = (float)$rawIn;
    if (!is_finite($newMax) || $newMax < 0) {
        jsonError(400, 'max_supply 는 0 이상이어야 합니다 (0 = 무제한).');
    }
    // Integer enforcement — STO is integer-only per the 1:1 USDT peg policy.
    if (floor($newMax) !== $newMax) {
        jsonError(400, 'max_supply 는 정수여야 합니다.');
    }
    $newMax = (int)$newMax;

    $sold = silicaGetSoldStoTotal();
    if ($newMax > 0 && $newMax < $sold) {
        jsonError(400, "이미 판매된 수량({$sold} STO) 보다 낮게 설정할 수 없습니다. 최소 {$sold} 이상이어야 합니다.");
    }

    setSetting('silica_max_sto_supply', (string)$newMax);
    error_log("[admin_silica_supply] max_supply set to {$newMax} (sold={$sold}) by={$admin['username']}");

    // (2026-05-16 v423) Optional sale-notice text (KO/EN). 두 키 모두 옵션 —
    //   미전송 시 기존 값 유지. 빈 문자열로 전송 시 해당 언어 안내 비움.
    //   length<=500 검증은 silicaSetSaleNotice 안에서 수행.
    if (array_key_exists('notice_ko', $body)) {
        $rawKo = (string)($body['notice_ko'] ?? '');
        if (!silicaSetSaleNotice('ko', $rawKo)) {
            jsonError(400, '국문 안내 문구는 500자 이하여야 합니다.');
        }
    }
    if (array_key_exists('notice_en', $body)) {
        $rawEn = (string)($body['notice_en'] ?? '');
        if (!silicaSetSaleNotice('en', $rawEn)) {
            jsonError(400, '영문 안내 문구는 500자 이하여야 합니다.');
        }
    }

    $remaining = silicaRemainingStoSupply();
    jsonOk([
        'ok'         => true,
        'max_supply' => silicaGetMaxStoSupply(),
        'sold_total' => $sold,
        'remaining'  => ($remaining === PHP_FLOAT_MAX ? null : $remaining),
        'sale_open'  => silicaIsSaleOpen(),
        'notice_ko'  => silicaGetSaleNotice('ko'),
        'notice_en'  => silicaGetSaleNotice('en'),
    ]);
});
