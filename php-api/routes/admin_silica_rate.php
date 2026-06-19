<?php
/**
 * Cycle-based Interest Rate Management
 * 회차 기반 이자율 — 변경 시 다음 회차부터 적용
 * 회차: 매월 16일~다음달 15일 (지급일=15일)
 */

// ----------------------------------------------------------------
// 헬퍼: "이번 회차" 판별
//   실행일 ≤ 15: 당월 15일이 이번 회차
//   실행일 ≥ 16: 다음달 15일이 이번 회차
// 다음 회차 = 이번 회차 + 1개월
// ----------------------------------------------------------------
if (!function_exists('silicaCalcThisCyclePayoutDate')) {
    function silicaCalcThisCyclePayoutDate(?string $forDate = null): string {
        $now = $forDate ? strtotime($forDate) : time();
        $day = (int)date('d', $now);
        $year = (int)date('Y', $now);
        $month = (int)date('m', $now);
        if ($day > 15) {
            $month++;
            if ($month > 12) { $month = 1; $year++; }
        }
        return sprintf('%04d-%02d-15', $year, $month);
    }

    function silicaCalcNextCyclePayoutDate(?string $forDate = null): string {
        $thisDate = silicaCalcThisCyclePayoutDate($forDate);
        $year = (int)substr($thisDate, 0, 4);
        $month = (int)substr($thisDate, 5, 2);
        $month++;
        if ($month > 12) { $month = 1; $year++; }
        return sprintf('%04d-%02d-15', $year, $month);
    }
}

// ----------------------------------------------------------------
// GET /api/admin/silica/rate - 현재 + 다음 회차 이자율
// ----------------------------------------------------------------
get('/api/admin/silica/rate', function () {
    adminOnly();

    $thisCycle = silicaCalcThisCyclePayoutDate();
    $nextCycle = silicaCalcNextCyclePayoutDate();

    $thisRate = DB::fetchOne(
        "SELECT rate_bps FROM interest_rate_history
         WHERE effective_from_payout <= ?
         ORDER BY effective_from_payout DESC LIMIT 1",
        [$thisCycle]
    );
    $nextRate = DB::fetchOne(
        "SELECT rate_bps FROM interest_rate_history
         WHERE effective_from_payout <= ?
         ORDER BY effective_from_payout DESC LIMIT 1",
        [$nextCycle]
    );

    jsonOk([
        'this_cycle_payout' => $thisCycle,
        'this_cycle_rate_bps' => $thisRate ? (int)$thisRate['rate_bps'] : null,
        'this_cycle_rate_pct' => $thisRate ? round($thisRate['rate_bps'] / 100, 2) : null,
        'next_cycle_payout' => $nextCycle,
        'next_cycle_rate_bps' => $nextRate ? (int)$nextRate['rate_bps'] : null,
        'next_cycle_rate_pct' => $nextRate ? round($nextRate['rate_bps'] / 100, 2) : null,
    ]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/rate - 새 이자율 설정 (다음 회차부터 적용)
// Body: { rate_pct: number, reason: string }
// ----------------------------------------------------------------
post('/api/admin/silica/rate', function () {
    $admin = adminAuth();
    $body = getJsonBody();

    $newRatePct = (float)($body['rate_pct'] ?? -1);
    $reason = (string)($body['reason'] ?? '');

    if ($newRatePct < 0 || $newRatePct > 100) {
        // (2026-05-08) Fixed argument order — jsonError(int status, string msg).
        jsonError(400, '이자율은 0~100% 범위여야 합니다.');
    }

    $newRateBps = (int)round($newRatePct * 100); // 5.00% → 500bps

    // 다음 회차의 지급일을 effective_from_payout으로 설정
    $nextCycle = silicaCalcNextCyclePayoutDate();

    // 이전 요율 (같은 회차)
    $prev = DB::fetchOne(
        "SELECT rate_bps FROM interest_rate_history
         WHERE effective_from_payout <= ?
         ORDER BY effective_from_payout DESC LIMIT 1",
        [$nextCycle]
    );
    $prevBps = $prev ? (int)$prev['rate_bps'] : null;

    if ($prevBps === $newRateBps) {
        // (2026-05-08) Fixed argument order — jsonError(int status, string msg).
        jsonError(400, '변경 사항이 없습니다 (동일한 요율).');
    }

    // 같은 effective_from_payout으로 이미 등록된 행 있으면 업데이트
    $existing = DB::fetchOne(
        "SELECT id FROM interest_rate_history WHERE effective_from_payout = ?",
        [$nextCycle]
    );
    if ($existing) {
        DB::execute(
            "UPDATE interest_rate_history
             SET rate_bps = ?, prev_rate_bps = ?, created_by = ?, reason = ?, created_at = NOW()
             WHERE id = ?",
            [$newRateBps, $prevBps, $admin['username'], $reason, (int)$existing['id']]
        );
    } else {
        DB::execute(
            "INSERT INTO interest_rate_history (rate_bps, effective_from_payout, prev_rate_bps, created_by, reason)
             VALUES (?, ?, ?, ?, ?)",
            [$newRateBps, $nextCycle, $prevBps, $admin['username'], $reason]
        );
    }

    // 감사 로그
    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, prev_value, new_value, metadata)
         VALUES ('rate_change', 'interest_rate_update', ?, ?, ?, ?)",
        [
            $admin['username'],
            json_encode(['rate_bps' => $prevBps]),
            json_encode(['rate_bps' => $newRateBps, 'effective_from' => $nextCycle]),
            json_encode(['reason' => $reason]),
        ]
    );

    // (2026-05-08) 사장님 정책: 이자율 변경 시 모든 관련 유저에게 팝업 알림.
    //   대상 = silica_sto_balance OR silica_sto_staked > 0 (현재 보유자 +
    //   스테이커). 즉시 영향을 받는 그룹이 가장 작은 합리적 단위. 알림
    //   생성 실패는 본 트랜잭션을 깨뜨리지 않도록 try/catch + error_log.
    $notifSent = 0;
    try {
        $rows = DB::fetchAll(
            "SELECT DISTINCT address FROM holdings
              WHERE COALESCE(silica_sto_balance, 0) > 0
                 OR COALESCE(silica_sto_staked, 0) > 0"
        );
        $newPct = round($newRateBps / 100, 2);
        $prevPct = $prevBps !== null ? round($prevBps / 100, 2) : null;
        $payload = [
            'prev_rate_pct'        => $prevPct,
            'new_rate_pct'         => $newPct,
            'effective_from_payout' => $nextCycle,
            'reason'               => $reason,
        ];
        foreach ($rows as $row) {
            $addr = trim((string)($row['address'] ?? ''));
            if ($addr === '') continue;
            createUserNotification(
                $addr,
                'rate_change',
                '스테이킹 이자율이 변경되었습니다',
                sprintf(
                    '%s 회차 (지급 %s) 부터 새 이자율 %s%% 가 적용됩니다.%s',
                    substr($nextCycle, 0, 7),
                    $nextCycle,
                    number_format($newPct, 2),
                    $prevPct !== null ? sprintf(' 이전: %s%%', number_format($prevPct, 2)) : ''
                ),
                $payload
            );
            $notifSent++;
        }
    } catch (Throwable $e) {
        // Notification fan-out is best-effort — never block the rate change.
        error_log('[silica.rate] notification fan-out failed: ' . $e->getMessage());
    }

    jsonOk([
        'ok' => true,
        'effective_from_payout' => $nextCycle,
        'prev_rate_bps' => $prevBps,
        'new_rate_bps' => $newRateBps,
        'new_rate_pct' => round($newRateBps / 100, 2),
        'notifications_sent' => $notifSent,
    ]);
});

// ----------------------------------------------------------------
// GET /api/admin/silica/rate/history - 이자율 변경 이력 (감사 로그)
//
// (2026-05-08) Reads from silica_audit_log instead of
//   interest_rate_history. The latter has a UNIQUE-style upsert
//   semantic (one row per effective_from_payout — the rate that wins
//   for that cycle), which means changing the rate twice on the same
//   day overwrites the first row and only the second is visible.
//
//   silica_audit_log records EVERY change (INSERT-only) so the
//   "변경 이력 (감사 로그)" UI label is accurate. Filters category =
//   'rate_change' and parses the JSON columns into the flat shape the
//   frontend table expects: rate_pct / prev_rate_bps / created_by /
//   reason / effective_from_payout / created_at.
// ----------------------------------------------------------------
get('/api/admin/silica/rate/history', function () {
    adminOnly();
    $limit = (int)($_GET['limit'] ?? 100);
    $limit = max(1, min(500, $limit));

    $rows = DB::fetchAll(
        "SELECT id, actor, prev_value, new_value, metadata, created_at
           FROM silica_audit_log
          WHERE category = 'rate_change'
            AND action   = 'interest_rate_update'
          ORDER BY id DESC
          LIMIT {$limit}"
    );

    $history = [];
    foreach ($rows as $r) {
        $prev = json_decode((string)($r['prev_value'] ?? ''), true) ?: [];
        $new  = json_decode((string)($r['new_value']  ?? ''), true) ?: [];
        $meta = json_decode((string)($r['metadata']   ?? ''), true) ?: [];
        $rateBps = isset($new['rate_bps']) ? (int)$new['rate_bps'] : 0;
        $prevBps = isset($prev['rate_bps']) ? (int)$prev['rate_bps'] : null;
        $history[] = [
            'id'                    => (int)($r['id'] ?? 0),
            'rate_bps'              => $rateBps,
            'rate_pct'              => $rateBps > 0 ? round($rateBps / 100, 2) : 0,
            'effective_from_payout' => (string)($new['effective_from'] ?? ''),
            'prev_rate_bps'         => $prevBps,
            'created_by'            => (string)($r['actor'] ?? ''),
            'reason'                => (string)($meta['reason'] ?? ''),
            'created_at'            => (string)($r['created_at'] ?? ''),
        ];
    }

    jsonOk(['history' => $history]);
});

// ----------------------------------------------------------------
// GET /api/silica/rate - 공개 (사용자가 현재 회차 이자율 조회)
// ----------------------------------------------------------------
get('/api/silica/rate', function () {
    $thisCycle = silicaCalcThisCyclePayoutDate();
    $row = DB::fetchOne(
        "SELECT rate_bps FROM interest_rate_history
         WHERE effective_from_payout <= ?
         ORDER BY effective_from_payout DESC LIMIT 1",
        [$thisCycle]
    );
    jsonOk([
        'cycle_payout_date' => $thisCycle,
        'rate_bps' => $row ? (int)$row['rate_bps'] : 500,
        'rate_pct' => $row ? round($row['rate_bps'] / 100, 2) : 5.00,
    ]);
});
