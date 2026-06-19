<?php
/**
 * Silica Token Price Management Routes
 * Phase A: DB schema (silica_price_history table)
 * Phase B: API endpoints
 * Phase C (2026-05-07): MECCA(MEA) 시세 연동 — 거래소 상장 전까지 테스트용.
 *   CoinLore 의 ticker?id=161989 응답에서 price_usd 를 그대로 silica 시세로 복사.
 */

// ----------------------------------------------------------------
// (2026-05-07) CoinLore MECCA(MEA) 시세 fetch helper.
// id=161989 은 https://www.coinlore.com/coin/mecca 페이지에서 확인된 고정 식별자.
// 응답 형식 (배열 1개):
//   [{ "id": "161989", "symbol": "MEA", "name": "MECCA", "price_usd": "0.002897", ... }]
// 실패 시 RuntimeException — 호출 측에서 502 로 변환.
// ----------------------------------------------------------------
function silicaFetchMeaPriceFromCoinLore() {
    $url = 'https://api.coinlore.net/api/ticker/?id=161989';
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 8,
            'header'  => "User-Agent: SilicaChain/1.0\r\n",
            'ignore_errors' => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) {
        throw new RuntimeException('CoinLore API 호출 실패 (네트워크)');
    }
    $data = json_decode($body, true);
    if (!is_array($data) || empty($data[0]) || !is_array($data[0])) {
        throw new RuntimeException('CoinLore 응답 형식 오류');
    }
    $row = $data[0];
    if (strtoupper((string)($row['symbol'] ?? '')) !== 'MEA') {
        // CoinLore 가 ID 잘못 매핑한 응답을 줘도 우리가 가드.
        throw new RuntimeException('CoinLore 응답이 MEA 가 아님: ' . ($row['symbol'] ?? '?'));
    }
    $price = (float)($row['price_usd'] ?? 0);
    if (!is_finite($price) || $price <= 0) {
        throw new RuntimeException('CoinLore 시세 0 이하 또는 비정상');
    }
    return [
        'price_usdt' => $price,
        'symbol'     => (string)$row['symbol'],
        'name'       => (string)($row['name'] ?? 'MECCA'),
        'fetched_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'source'     => 'coinlore',
        'source_id'  => '161989',
    ];
}

// ----------------------------------------------------------------
// GET /api/admin/silica/price - 현재 Silica 시세 + 모드
// ----------------------------------------------------------------
get('/api/admin/silica/price', function () {
    adminOnly();

    $stored = getSetting('silica_price_usdt', null);
    $price = 0.0;
    $mode = 'manual';
    $updatedAt = null;
    $source = null;
    $sourceId = null;

    if ($stored) {
        $obj = is_string($stored) ? json_decode($stored, true) : $stored;
        if (is_array($obj)) {
            $price = (float)($obj['value'] ?? 0);
            $mode = (string)($obj['mode'] ?? 'manual');
            $updatedAt = $obj['updated_at'] ?? null;
            $source = $obj['source'] ?? null;
            $sourceId = $obj['source_id'] ?? null;
        } else {
            $price = (float)$stored;
        }
    }

    jsonOk([
        'price_usdt' => $price,
        'mode'       => $mode,
        'updated_at' => $updatedAt,
        'source'     => $source,
        'source_id'  => $sourceId,
    ]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/price - 시세 업데이트
// Body: { price_usdt: number, mode: 'manual'|'exchange_api', reason: string }
// ----------------------------------------------------------------
post('/api/admin/silica/price', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    $newPrice = (float)($body['price_usdt'] ?? 0);
    $mode = (string)($body['mode'] ?? 'manual');
    $reason = (string)($body['reason'] ?? '');

    if ($newPrice <= 0) {
        jsonError(400, '시세는 0보다 커야 합니다.');
    }
    if (!in_array($mode, ['manual', 'exchange_api', 'linked_mea'], true)) {
        jsonError(400, '유효하지 않은 모드입니다.');
    }

    // 이전 값 가져오기 (가격 + 이전 모드)
    $stored = getSetting('silica_price_usdt', null);
    $prevPrice = 0.0;
    $prevMode  = 'manual';
    if ($stored) {
        $obj = is_string($stored) ? json_decode($stored, true) : $stored;
        if (is_array($obj)) {
            $prevPrice = (float)($obj['value'] ?? 0);
            $prevMode  = (string)($obj['mode'] ?? 'manual');
        } else {
            $prevPrice = (float)$stored;
        }
    }

    $changePct = $prevPrice > 0 ? round(($newPrice - $prevPrice) / $prevPrice * 100, 4) : null;

    // 새 값 저장
    setSetting('silica_price_usdt', json_encode([
        'value' => $newPrice,
        'mode' => $mode,
        'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
    ]));
    setSetting('silica_price_mode', $mode);

    // (2026-05-07) silica_price_history 는 'manual' 모드에서 가격을 직접 입력했을
    // 때만 기록한다. 사용자가 보는 "시세 변경 이력 (감사 로그)" 표는 운영자의
    // 직접 결정만 표시되어야 하므로 — 모드 B/C 전환이나 자동 동기화는 노이즈.
    //   - 모드 B/C 전환: 가격 자체는 기존값 유지 정도라 history 에 의미 없음
    //   - sync-mea: 별도 endpoint 가 audit 로그만 남김
    if ($mode === 'manual') {
        DB::execute(
            "INSERT INTO silica_price_history (prev_price_usdt, new_price_usdt, change_pct, mode, reason, changed_by)
             VALUES (?, ?, ?, ?, ?, ?)",
            [$prevPrice, $newPrice, $changePct, $mode, $reason, $admin['username']]
        );
    }

    // silica_audit_log 는 항상 기록 — manual 가격 변경, 모드 전환, 자동 동기화 모두 추적.
    // 모드가 바뀌었으면 action 을 분리해서 audit 추적성 강화.
    $auditAction = ($mode !== $prevMode)
        ? 'silica_price_mode_change'
        : 'silica_price_update';
    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, prev_value, new_value, metadata)
         VALUES ('price_change', ?, ?, ?, ?, ?)",
        [
            $auditAction,
            $admin['username'],
            json_encode(['price' => $prevPrice, 'mode' => $prevMode]),
            json_encode(['price' => $newPrice, 'mode' => $mode]),
            json_encode([
                'reason'      => $reason,
                'change_pct'  => $changePct,
                'recorded_in_history' => ($mode === 'manual'),
            ]),
        ]
    );

    jsonOk([
        'ok' => true,
        'prev_price_usdt' => $prevPrice,
        'new_price_usdt' => $newPrice,
        'change_pct' => $changePct,
        'recorded_in_history' => ($mode === 'manual'),
    ]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/price/sync-mea
// 관리자 수동 트리거 — CoinLore 에서 MEA 시세를 가져와 Silica 시세로 복사.
// 모드도 'linked_mea' 로 전환되며 silica_price_history / silica_audit_log 양쪽에 기록.
// ----------------------------------------------------------------
post('/api/admin/silica/price/sync-mea', function () {
    $admin = adminAuth();

    try {
        $mea = silicaFetchMeaPriceFromCoinLore();
    } catch (Throwable $e) {
        jsonError('MEA 시세 조회 실패: ' . $e->getMessage(), 502);
    }

    $newPrice = (float)$mea['price_usdt'];

    // 이전 가격 추출 (manual / exchange_api / linked_mea 모두 같은 키 사용)
    $stored = getSetting('silica_price_usdt', null);
    $prevPrice = 0.0;
    if ($stored) {
        $obj = is_string($stored) ? json_decode($stored, true) : $stored;
        $prevPrice = is_array($obj) ? (float)($obj['value'] ?? 0) : (float)$stored;
    }

    $changePct = $prevPrice > 0 ? round(($newPrice - $prevPrice) / $prevPrice * 100, 4) : null;

    // 새 값 저장 — mode='linked_mea', source 메타데이터 동봉.
    setSetting('silica_price_usdt', json_encode([
        'value'      => $newPrice,
        'mode'       => 'linked_mea',
        'updated_at' => $mea['fetched_at'],
        'source'     => 'coinlore:MEA',
        'source_id'  => $mea['source_id'],
    ]));
    setSetting('silica_price_mode', 'linked_mea');

    // (2026-05-07) silica_price_history 에는 기록하지 않는다 — 사용자에게 노출되는
    // "시세 변경 이력 (감사 로그)" 표는 관리자 직접 입력 기록만 남기기로 결정.
    // MEA 자동 동기화는 silica_audit_log (운영자 전용) 에만 추적.

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, prev_value, new_value, metadata)
         VALUES ('price_change', 'silica_price_sync_mea', ?, ?, ?, ?)",
        [
            $admin['username'],
            json_encode(['price' => $prevPrice]),
            json_encode(['price' => $newPrice, 'mode' => 'linked_mea']),
            json_encode([
                'source'     => 'coinlore',
                'source_id'  => $mea['source_id'],
                'change_pct' => $changePct,
                'fetched_at' => $mea['fetched_at'],
                'recorded_in_history' => false,
            ]),
        ]
    );

    jsonOk([
        'ok'              => true,
        'prev_price_usdt' => $prevPrice,
        'new_price_usdt'  => $newPrice,
        'change_pct'      => $changePct,
        'source'          => 'coinlore:MEA',
        'fetched_at'      => $mea['fetched_at'],
    ]);
});

// ----------------------------------------------------------------
// GET /api/admin/silica/price/history - 시세 변경 이력
// ----------------------------------------------------------------
get('/api/admin/silica/price/history', function () {
    adminOnly();
    $limit = (int)($_GET['limit'] ?? 50);
    $limit = max(1, min(500, $limit));

    $rows = DB::fetchAll(
        "SELECT id, prev_price_usdt, new_price_usdt, change_pct, mode, reason, changed_by, changed_at
         FROM silica_price_history
         ORDER BY changed_at DESC
         LIMIT ?",
        [$limit]
    );

    jsonOk(['history' => $rows]);
});

// ----------------------------------------------------------------
// GET /api/silica/price - 공개 (사용자도 조회 가능)
// ----------------------------------------------------------------
get('/api/silica/price', function () {
    $stored = getSetting('silica_price_usdt', null);
    $price = 0.0;
    if ($stored) {
        $obj = is_string($stored) ? json_decode($stored, true) : $stored;
        $price = is_array($obj) ? (float)($obj['value'] ?? 0) : (float)$stored;
    }
    jsonOk(['price_usdt' => $price]);
});
