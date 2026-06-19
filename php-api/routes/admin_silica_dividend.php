<?php
/**
 * Annual Dividend Execution
 * 관리자가 USDT 풀 입력 → Silica 토큰으로 환산 분배
 * 배당 회차: 실행월 다음달부터만 선택 가능
 * 지급일: 선택 회차의 15일
 * 대상: 지급일 시점 스테이킹 중인 유저
 *
 * (2026-05-15 v366) Deploy verify marker — v361 self-healing migration 의
 *   production sync 가 누락됐던 정황 확인을 위해 파일 modification time
 *   강제 갱신 + opcache invalidation trigger. 동일 deploy 사이클에서 같은
 *   파일이 다시 sync 되어야 함.
 */

// ----------------------------------------------------------------
// (2026-05-15 v361) Self-healing schema migration — dividend_payouts /
//   silica_audit_log 의 schema mismatch 자동 보정. 과거 CLI script
//   (cron/dividend_payout_cron.php — v750 보안감사로 제거) 에만 있던
//   migration 을 HTTP cron 호출 경로와 admin payout 경로에 통합. Hostinger
//   가 호출하는 건 HTTP endpoint 라 5/15 cron 이 "Unknown column 'address'
//   in 'INSERT INTO'" 로 실패한 사건의 재발 방지용.
// (2026-05-21 보안감사) CLI 스크립트 제거 — claim flow 우회 + 더블 페이먼트
//   위험. 본 함수는 HTTP cron / admin payout 경로에 남아 schema 자가치유
//   역할만 수행.
// ----------------------------------------------------------------
if (!function_exists('silicaEnsureDividendSchema')) {
    function silicaEnsureDividendSchema(): void {
        // 1) dividend_payouts: address 컬럼 + user_id NULL 완화.
        try {
            $cols = DB::fetchAll("SHOW COLUMNS FROM dividend_payouts");
            $colNames = array_map(fn($c) => strtolower((string)($c['Field'] ?? '')), $cols);
            $userIdNotNull = false;
            foreach ($cols as $c) {
                if (strtolower((string)($c['Field'] ?? '')) === 'user_id' && strtoupper((string)($c['Null'] ?? '')) === 'NO') {
                    $userIdNotNull = true;
                }
            }
            if (!in_array('address', $colNames, true)) {
                DB::execute("ALTER TABLE dividend_payouts ADD COLUMN address VARCHAR(64) NULL AFTER execution_id");
                try { DB::execute("CREATE INDEX idx_dp_address ON dividend_payouts (address)"); } catch (Throwable $_) {}
                error_log('[migration] dividend_payouts.address 컬럼 추가 완료');
            }
            if ($userIdNotNull) {
                DB::execute("ALTER TABLE dividend_payouts MODIFY COLUMN user_id BIGINT NULL");
                error_log('[migration] dividend_payouts.user_id NOT NULL → NULL 완화');
            }

            // (2026-05-15 v367) Claim-based dividend model — status enum 에
            //   'pending' / 'claimed' 추가 + claimed_at 컬럼. 기존 'paid' 도 호환.
            $cols = DB::fetchAll("SHOW COLUMNS FROM dividend_payouts");
            $colNames = array_map(fn($c) => strtolower((string)($c['Field'] ?? '')), $cols);
            $statusCol = null;
            foreach ($cols as $c) {
                if (strtolower((string)($c['Field'] ?? '')) === 'status') $statusCol = $c;
            }
            if ($statusCol) {
                $statusType = strtolower((string)($statusCol['Type'] ?? ''));
                if (strpos($statusType, "'pending'") === false || strpos($statusType, "'claimed'") === false) {
                    DB::execute(
                        "ALTER TABLE dividend_payouts MODIFY COLUMN status
                         ENUM('pending','paid','claimed','failed','cancelled') NOT NULL DEFAULT 'pending'"
                    );
                    error_log('[migration] dividend_payouts.status enum → +pending,+claimed 확장');
                }
            }
            if (!in_array('claimed_at', $colNames, true)) {
                DB::execute("ALTER TABLE dividend_payouts ADD COLUMN claimed_at TIMESTAMP NULL AFTER status");
                error_log('[migration] dividend_payouts.claimed_at 컬럼 추가');
            }

            // UNIQUE (execution_id, address) — 중복 INSERT 차단 (멱등성).
            //   기존 데이터에 중복이 있으면 ALTER 실패. 그 경우 cleanup 필요.
            try {
                $idx = DB::fetchOne("SHOW INDEX FROM dividend_payouts WHERE Key_name = 'ux_dividend_payouts_exec_addr'");
                if (!$idx) {
                    DB::execute("ALTER TABLE dividend_payouts ADD UNIQUE KEY ux_dividend_payouts_exec_addr (execution_id, address)");
                    error_log('[migration] dividend_payouts UNIQUE (execution_id, address) 추가');
                }
            } catch (Throwable $e) {
                error_log('[migration] UNIQUE 제약 추가 실패 (이미 중복 데이터가 있을 수 있음): ' . $e->getMessage());
            }
        } catch (Throwable $e) {
            error_log('[migration] dividend_payouts schema migration 실패: ' . $e->getMessage());
        }

        // 2) silica_audit_log.category enum 에 'dividend_paid' + 'dividend_claimed' 추가.
        try {
            $row = DB::fetchOne("SHOW COLUMNS FROM silica_audit_log LIKE 'category'");
            $type = strtolower((string)($row['Type'] ?? ''));
            if ($type && (strpos($type, "'dividend_paid'") === false || strpos($type, "'dividend_claimed'") === false)) {
                DB::execute(
                    "ALTER TABLE silica_audit_log MODIFY COLUMN category
                     ENUM('price_change','rate_change','dividend_exec','dividend_cancel',
                          'dividend_paid','dividend_claimed','mint_change','fx_change',
                          'popup_create','popup_update','popup_delete','system_config') NOT NULL"
                );
                error_log('[migration] silica_audit_log.category enum → +dividend_paid,+dividend_claimed 확장');
            }
        } catch (Throwable $e) {
            error_log('[migration] silica_audit_log enum migration 실패: ' . $e->getMessage());
        }
    }
}

// ----------------------------------------------------------------
// 헬퍼: 배당 회차 선택 가능 여부 검증
// ----------------------------------------------------------------
if (!function_exists('silicaValidateDividendCycle')) {
    function silicaValidateDividendCycle(string $payoutMonth): array {
        // payoutMonth: 'YYYY-MM' 또는 'YYYY-MM-DD'
        $payoutDate = strlen($payoutMonth) === 7
            ? "$payoutMonth-15"
            : substr($payoutMonth, 0, 7) . '-15';

        // (2026-05-13 v334) 운영자: '5월을 선택 할 수 없다.' 정책 완화 —
        //   이전엔 "다음 회차부터만" 이라 오늘(5/13) 에 이번 회차(5/15) 예약
        //   불가했음. 이제 "**과거 회차만 차단**" — 이번 회차 포함 이후 모두
        //   허용. timing 가드는 cooling window (14~16) 가 담당 — 5/14 부터는
        //   어차피 어떤 변경도 차단되므로 5/13 까지 이번 회차 예약은 안전.
        $thisCyclePayout = silicaCalcThisCyclePayoutDate();
        if ($payoutDate < $thisCyclePayout) {
            return [
                'ok' => false,
                'error' => '과거 회차는 선택 불가. 이번 회차 또는 다음 회차부터 선택하세요.',
                'payout_date' => $payoutDate,
                'min_allowed' => $thisCyclePayout,
            ];
        }
        return ['ok' => true, 'payout_date' => $payoutDate];
    }
}

// ----------------------------------------------------------------
// GET /api/admin/silica/dividend - 예정/완료 배당 목록
// ----------------------------------------------------------------
get('/api/admin/silica/dividend', function () {
    adminOnly();

    // (2026-05-13 v332) 운영자: '여전히 배당 실행 기록이 관리자에 없다.'
    //   진단을 위해 전체 dividend_executions 개수와 status 별 breakdown 도
    //   반환. 운영자가 콘솔에서 '실제로 DB 에 행이 있는가?' 즉시 확인 가능.
    $totalCount = 0;
    $statusBreakdown = [];
    try {
        $totalCount = (int)(DB::fetchValue("SELECT COUNT(*) FROM dividend_executions") ?? 0);
        $rows = DB::fetchAll(
            "SELECT status, COUNT(*) AS c
               FROM dividend_executions
              GROUP BY status"
        );
        foreach ($rows as $row) {
            $statusBreakdown[(string)$row['status']] = (int)$row['c'];
        }
    } catch (Throwable $_) {}

    $scheduled = DB::fetchAll(
        "SELECT id, payout_amount_usdt, payout_month, status, executed_by, executed_at,
                price_mode, recipient_count, silica_total_distributed
         FROM dividend_executions
         WHERE status IN ('scheduled', 'executing')
         ORDER BY payout_month ASC"
    );

    $past = DB::fetchAll(
        "SELECT id, payout_amount_usdt, payout_month, status, executed_by, executed_at, paid_at,
                silica_price_at_payout, recipient_count, silica_total_distributed
         FROM dividend_executions
         WHERE status IN ('paid', 'cancelled')
         ORDER BY payout_month DESC LIMIT 20"
    );

    // (2026-05-12 v320) Expose lock-window state so the UI can render
    // the banner / disable buttons without a separate roundtrip.
    $lockBounds = dividendAdminLockBounds();

    // (2026-05-12 v324) 운영자: '스테이킹 유저가 있지만, 0명으로 나온다.'
    //   배당 페이지의 "예상 수령자" 표시용 — 현 시점에 silica_sto_staked > 0
    //   인 holdings 행 개수 + 총 스테이킹 합계. cron 의 분배 대상 산정과
    //   동일한 WHERE 조건이므로 미리보기 수치가 실제 분배 결과와 일치.
    $stakerStats = ['count' => 0, 'total_staked' => 0.0];
    try {
        $row = DB::fetchOne(
            "SELECT COUNT(*) AS c, COALESCE(SUM(silica_sto_staked), 0) AS s
               FROM holdings
              WHERE silica_sto_staked > 0"
        );
        if ($row) {
            $stakerStats['count'] = (int)($row['c'] ?? 0);
            $stakerStats['total_staked'] = (float)($row['s'] ?? 0);
        }
    } catch (Throwable $e) {
        // holdings 테이블이 없거나 스키마가 다른 경우 0 으로 폴백 — UI 가
        // 안전하게 "~0명" 으로 표기하고 평균은 fallback 텍스트 사용.
        error_log('[dividend GET] stakers query failed: ' . $e->getMessage());
    }

    jsonOk([
        'scheduled' => $scheduled,
        'past' => $past,
        'admin_lock' => [
            'days' => defined('DIVIDEND_ADMIN_LOCK_DAYS') ? DIVIDEND_ADMIN_LOCK_DAYS : [],
            'today_kst' => dayOfMonthKST(),
            'locked' => isDividendAdminLocked(),
            'window' => $lockBounds,
        ],
        'stakers' => $stakerStats,
        // (v332) 진단 정보 — 운영자 콘솔에서 즉시 DB 상태 파악
        '_diagnostic' => [
            'dividend_executions_total' => $totalCount,
            'status_breakdown' => $statusBreakdown,
        ],
    ]);
});

// ----------------------------------------------------------------
// GET /api/admin/silica/dividend/log - 배당 액션 감사 로그
// (2026-05-12 v327) 운영자: '관리자가 언제 얼마나 배당금을 지급 했는지
//   로그가 이 페이지에 필요하다.' silica_audit_log + dividend_executions
//   조인으로 통합 타임라인 반환. category IN (dividend_exec, dividend_cancel)
//   에 cron 의 dividend_paid 이벤트 (v327 부터) 도 포함.
// ----------------------------------------------------------------
get('/api/admin/silica/dividend/log', function () {
    adminOnly();
    $limit = (int)($_GET['limit'] ?? 50);
    $limit = max(1, min(200, $limit));

    $rows = [];
    try {
        $rows = DB::fetchAll(
            "SELECT id, category, action, actor, target_id, new_value, prev_value, metadata, created_at
               FROM silica_audit_log
              WHERE category IN ('dividend_exec', 'dividend_cancel', 'dividend_paid')
              ORDER BY created_at DESC
              LIMIT {$limit}"
        );
    } catch (Throwable $e) {
        // 테이블 없으면 빈 배열 반환
        error_log('[dividend log] query failed: ' . $e->getMessage());
    }

    // 각 행의 target_id 로 dividend_executions 메타 join (있을 때만)
    $execIds = [];
    foreach ($rows as $r) {
        $tid = (int)($r['target_id'] ?? 0);
        if ($tid > 0) $execIds[$tid] = true;
    }
    $execMeta = [];
    if (!empty($execIds)) {
        $placeholders = implode(',', array_fill(0, count($execIds), '?'));
        try {
            $execRows = DB::fetchAll(
                "SELECT id, payout_amount_usdt, payout_month, status,
                        silica_total_distributed, recipient_count, paid_at
                   FROM dividend_executions
                  WHERE id IN ({$placeholders})",
                array_keys($execIds)
            );
            foreach ($execRows as $er) {
                $execMeta[(int)$er['id']] = $er;
            }
        } catch (Throwable $_) {}
    }

    // JSON 필드 디코드 후 클라이언트 친화 포맷으로 정리
    $log = [];
    foreach ($rows as $r) {
        $tid = (int)($r['target_id'] ?? 0);
        $newV  = is_string($r['new_value'] ?? null)  ? json_decode($r['new_value'], true)  : ($r['new_value'] ?? null);
        $prevV = is_string($r['prev_value'] ?? null) ? json_decode($r['prev_value'], true) : ($r['prev_value'] ?? null);
        $meta  = is_string($r['metadata'] ?? null)   ? json_decode($r['metadata'], true)   : ($r['metadata'] ?? null);
        $log[] = [
            'id'         => (int)$r['id'],
            'category'   => (string)$r['category'],
            'action'     => (string)$r['action'],
            'actor'      => (string)($r['actor'] ?? ''),
            'target_id'  => $tid ?: null,
            'new_value'  => $newV,
            'prev_value' => $prevV,
            'metadata'   => $meta,
            'created_at' => (string)$r['created_at'],
            'exec_meta'  => $tid && isset($execMeta[$tid]) ? $execMeta[$tid] : null,
        ];
    }

    jsonOk(['log' => $log]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/dividend - 새 배당 실행 예약
// Body: { pool_usdt, payout_month: 'YYYY-MM', price_mode, popup_ko, popup_en, memo }
// ----------------------------------------------------------------
post('/api/admin/silica/dividend', function () {
    // (2026-05-12 v309) Was adminAuth() — JWT only. Switched to adminOnly()
    // so the X-Admin-Wallet check in auth.php fires for this route.
    // Operator: '배당 실행은 관리자 지갑이 연결 된 상태에서만 가능해야한다.'
    $admin = adminOnly();

    // (2026-05-12 v320) Cooling-window check — block dividend writes during
    // the 10–16 KST window so the pool can't be tweaked right before the
    // staking lock starts. Cancellation is still allowed (emergency exit).
    if (isDividendAdminLocked()) {
        $b = dividendAdminLockBounds();
        jsonError(
            "배당 입력 차단 기간입니다 (매월 {$b['min']}~{$b['max']}일 KST). "
          . "스테이킹 lock 시작 전후의 안전 윈도우 — 17일 이후에 다시 시도하세요.",
            423
        );
    }

    $body = getJsonBody();

    $poolUsdt = (float)($body['pool_usdt'] ?? 0);
    $payoutMonth = (string)($body['payout_month'] ?? '');
    $priceMode = (string)($body['price_mode'] ?? 'payout_admin');
    $popupKo = (string)($body['popup_ko'] ?? '');
    $popupEn = (string)($body['popup_en'] ?? '');
    $memo = (string)($body['memo'] ?? '');

    if ($poolUsdt <= 0) {
        jsonError('배당 풀은 0보다 커야 합니다.', 400);
    }

    // 회차 검증
    $check = silicaValidateDividendCycle($payoutMonth);
    if (!$check['ok']) {
        jsonError($check['error'], 400);
    }
    $payoutDate = $check['payout_date'];

    // 유효 모드 체크
    if (!in_array($priceMode, ['payout_admin', 'payout_api', 'execution_lock'], true)) {
        jsonError('유효하지 않은 가격 모드.', 400);
    }

    // 현재 Silica 시세
    $stored = getSetting('silica_price_usdt', null);
    $currentPrice = 0.0;
    if ($stored) {
        $obj = is_string($stored) ? json_decode($stored, true) : $stored;
        $currentPrice = is_array($obj) ? (float)($obj['value'] ?? 0) : (float)$stored;
    }

    DB::execute(
        "INSERT INTO dividend_executions
         (payout_amount_usdt, payout_month, silica_price_at_execution, price_mode,
          popup_content_ko, popup_content_en, status, executed_by, memo)
         VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)",
        [$poolUsdt, $payoutDate, $currentPrice, $priceMode, $popupKo, $popupEn, $admin['username'], $memo]
    );

    $newId = (int)DB::get()->lastInsertId();

    // 감사 로그
    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value, metadata)
         VALUES ('dividend_exec', 'dividend_create', ?, ?, ?, ?)",
        [
            $admin['username'],
            $newId,
            json_encode(['pool_usdt' => $poolUsdt, 'payout_date' => $payoutDate, 'price_mode' => $priceMode]),
            json_encode(['memo' => $memo]),
        ]
    );

    // 자동 팝업 생성 (popup content가 있으면)
    if ($popupKo !== '') {
        DB::execute(
            "INSERT INTO popup_announcements
             (type, title_ko, title_en, body_ko, body_en, audience, dismissable,
              start_at, end_at, status, auto_trigger, linked_id, created_by)
             VALUES ('dividend', ?, ?, ?, ?, 'all', 1, NOW(), DATE_ADD(?, INTERVAL 1 DAY), 'active', 'dividend_exec', ?, ?)",
            [
                '연 배당 실행 안내',
                'Annual Dividend Notice',
                $popupKo,
                $popupEn,
                $payoutDate,
                $newId,
                $admin['username'],
            ]
        );
    }

    jsonOk(['ok' => true, 'id' => $newId, 'payout_date' => $payoutDate]);
});

// ----------------------------------------------------------------
// PUT /api/admin/silica/dividend/{id} - 예정 배당 수정
// ----------------------------------------------------------------
post('/api/admin/silica/dividend/update', function () {
    // (2026-05-12 v309) Wallet-required — see /silica/dividend POST note.
    $admin = adminOnly();

    // (2026-05-12 v320) Cooling-window block — same as create.
    if (isDividendAdminLocked()) {
        $b = dividendAdminLockBounds();
        jsonError(
            "배당 수정 차단 기간입니다 (매월 {$b['min']}~{$b['max']}일 KST). "
          . "수정이 불가피하면 취소 후 다음 회차에 다시 등록하세요.",
            423
        );
    }

    $body = getJsonBody();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) jsonError('id 필요', 400);

    $row = DB::fetchOne("SELECT * FROM dividend_executions WHERE id = ?", [$id]);
    if (!$row) jsonError('배당 실행을 찾을 수 없습니다.', 404);
    if (!in_array($row['status'], ['scheduled', 'executing'], true)) {
        jsonError('이미 처리된 배당은 수정 불가.', 400);
    }

    $newPool = isset($body['pool_usdt']) ? (float)$body['pool_usdt'] : (float)$row['payout_amount_usdt'];
    $newMemo = isset($body['memo']) ? (string)$body['memo'] : $row['memo'];

    DB::execute(
        "UPDATE dividend_executions SET payout_amount_usdt = ?, memo = ? WHERE id = ?",
        [$newPool, $newMemo, $id]
    );

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, prev_value, new_value)
         VALUES ('dividend_exec', 'dividend_update', ?, ?, ?, ?)",
        [
            $admin['username'], $id,
            json_encode(['pool_usdt' => $row['payout_amount_usdt']]),
            json_encode(['pool_usdt' => $newPool]),
        ]
    );

    jsonOk(['ok' => true, 'id' => $id]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/dividend/cancel - 예정 배당 취소
// ----------------------------------------------------------------
post('/api/admin/silica/dividend/cancel', function () {
    // (2026-05-12 v309) Wallet-required — see /silica/dividend POST note.
    $admin = adminOnly();

    // (2026-05-13 v341) popup_announcements 테이블 / linked_id 컬럼이 누락된
    //   환경에서 cascade INSERT 가 silent fail 하지 않도록 방어. 사용자 측
    //   /api/silica/popups/active 가 이미 ensurePopupTables() 를 부르지만,
    //   관리자가 그 엔드포인트보다 먼저 cancel 을 호출하는 경우 보호.
    if (function_exists('ensurePopupTables')) ensurePopupTables();

    $body = getJsonBody();

    $id = (int)($body['id'] ?? 0);
    $reason = (string)($body['reason'] ?? '');
    if ($id <= 0) jsonError('id 필요', 400);

    $row = DB::fetchOne("SELECT * FROM dividend_executions WHERE id = ?", [$id]);
    if (!$row) jsonError('배당 실행을 찾을 수 없습니다.', 404);
    if (!in_array($row['status'], ['scheduled', 'executing'], true)) {
        jsonError('이미 처리된 배당은 취소 불가.', 400);
    }

    DB::execute(
        "UPDATE dividend_executions
         SET status = 'cancelled', cancelled_by = ?, cancelled_at = NOW(), cancelled_reason = ?
         WHERE id = ?",
        [$admin['username'], $reason, $id]
    );

    // (2026-05-13 v341) 연결된 팝업도 비활성화 — rowsAffected 를 잡아
    //   클라이언트에 반환. 운영자가 cascade 가 실제로 작동했는지 즉시 확인
    //   가능. 0건이면 → 이 배당과 연결된 안내 팝업이 없었음 (정상).
    $expiredCount = 0;
    try {
        $stmt = DB::get()->prepare(
            "UPDATE popup_announcements SET status = 'expired'
             WHERE auto_trigger = 'dividend_exec' AND linked_id = ?"
        );
        $stmt->execute([$id]);
        $expiredCount = (int)$stmt->rowCount();
    } catch (Throwable $e) {
        error_log('[dividend cancel] expire linked popups failed: ' . $e->getMessage());
    }

    // 취소 공지 팝업 자동 생성
    DB::execute(
        "INSERT INTO popup_announcements
         (type, title_ko, title_en, body_ko, body_en, audience, dismissable,
          start_at, end_at, status, auto_trigger, linked_id, created_by)
         VALUES ('dividend', '연 배당 취소 안내', 'Annual Dividend Cancelled', ?, ?, 'all', 1,
                 NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active', 'dividend_cancel', ?, ?)",
        [
            "예정된 연 배당이 취소되었습니다.\n사유: $reason",
            "The scheduled annual dividend has been cancelled.\nReason: $reason",
            $id,
            $admin['username'],
        ]
    );
    $cancelPopupId = (int)DB::get()->lastInsertId();

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, metadata)
         VALUES ('dividend_cancel', 'dividend_cancel', ?, ?, ?)",
        [$admin['username'], $id, json_encode(['reason' => $reason, 'expired_popups' => $expiredCount])]
    );

    jsonOk([
        'ok' => true,
        'cascade' => [
            'linked_popups_expired' => $expiredCount,   // 연결됐던 팝업 만료 개수
            'cancellation_popup_id' => $cancelPopupId,  // 새로 만든 취소 안내 팝업
        ],
    ]);
});

// ----------------------------------------------------------------
// GET/POST /api/cron/distribute-dividends  — Hostinger cron 호출용
// (2026-05-13 v344) 운영자: '관리자가 수동으로 실행을 누르면 안된다.
//   놓칠 수 있기 때문이다. 크론잡이 시스템에 호출하면, 시스템은 실제
//   시간이 맞는지 확인 후 자동 실행 되어야한다.'
// 패턴: 외부 트리거 + 서버 측 시간 검증 + 자동 실행.
//   1) CRON_KEY 인증
//   2) 서버 시계로 오늘 KST 날짜 계산
//   3) payout_month=오늘 AND status='scheduled' 행이 있어야 진행
//   4) 오늘이 staking lock 윈도우 (14~16일 KST) 안이어야 진행
//      → holdings 가 frozen 상태에서만 분배 (스냅샷 신뢰성)
//   5) 모든 검증 통과 시 자동 실행 — 관리자 개입 없음
// 안전: CRON_KEY 유출되어도 정해진 지급일 + lock 윈도우에만 작동.
// ----------------------------------------------------------------
$cronDividendHandler = function () {
    // [1] CRON_KEY 인증
    $providedKey = trim((string)($_SERVER['HTTP_X_CRON_KEY'] ?? $_GET['key'] ?? ''));
    $expectedKey = trim((string)env('CRON_KEY', ''));
    if ($expectedKey === '' || $providedKey === '' || !hash_equals($expectedKey, $providedKey)) {
        jsonError(401, 'CRON_KEY 인증 실패.');
    }

    // (v361) self-healing schema migration — 본격 분배 전 dividend_payouts /
    //   silica_audit_log 의 schema 보정. CLI script 의 migration 을 HTTP
    //   경로에도 적용 — 5/15 cron 실패 원인 (address column 없음) 해결.
    silicaEnsureDividendSchema();

    // [2] 시스템 시계 기준 KST 오늘 계산 (cron 가 보내는 date 파라미터 무시 — 신뢰 X)
    $kstNow = (new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul')));
    $todayDate = $kstNow->format('Y-m-d');
    $todayKstDay = (int)$kstNow->format('j');

    // [3a] Pay day 검증 — 14일 이전 (그리고 14일 자체) 거부
    //     (2026-05-13 v346) 운영자: '이자는 무조건 15일에 지급해야한다. 14일에는
    //     지급하면 안된다.' 이자 cron 의 todayKst < payDay 룰을 배당에도 적용.
    //     14일은 lock 윈도우 안에 있지만 payday 가 아니므로 분배 거부.
    // (2026-05-18 v574) 운영자 보안 원칙: 'CRON_KEY 가 유출되어도 문제가 없어야
    //   한다. 키 인증 후에도 시스템이 실제 시간을 점검해야 한다.' 이전 코드는
    //   ?force=1 로 lock window 가드를 우회 가능 → 키 유출 시 임의 시점에
    //   배당 분배 가능. 제거: force 인자 미지원. 시간 가드는 무조건. catch-up
    //   이 필요하면 adminOnly() 토큰 기반 별도 엔드포인트로 분리.
    $payDay = defined('STAKING_PAYDAY') ? (int)STAKING_PAYDAY : 15;
    if ($todayKstDay < $payDay) {
        // (2026-05-18 v573) jsonError 시그니처는 (int $status, string $message).
        jsonError(
            400,
            "KST 오늘 {$todayKstDay}일은 지급일({$payDay}일) 이전 — 배당 분배 거부."
        );
    }

    // [3b] Lock 윈도우 검증 — 14~16일 KST 에만 진행
    //     이유: holdings 가 frozen 상태에서만 스냅샷 신뢰 가능
    //     (2026-05-13 v345) 운영자: '호스팅어 서버 점검/장애 시에도 16일까지
    //     계속 재시도 되어야한다.' lock 윈도우 = retry 윈도우 역할. 15일에
    //     서버가 죽어도 16일 cron 이 살아나면 자동 회복.
    $lockDays = defined('STAKING_LOCK_DAYS') ? STAKING_LOCK_DAYS : [14, 15, 16];
    if (!in_array($todayKstDay, $lockDays, true)) {
        $lockMin = min($lockDays); $lockMax = max($lockDays);
        jsonError(
            400,
            "KST 오늘 {$todayKstDay}일은 staking lock 윈도우({$lockMin}~{$lockMax}일) 밖. 시간 가드는 우회 불가능."
        );
    }

    // [4] 처리 대상 조회 — 오늘이거나 과거인 scheduled 배당 모두
    //     (서버가 다운되어 5/15 못 돈 경우 → 5/16 cron 이 5/15 scheduled 행을
    //     집어서 처리. status='paid' 가 되면 후속 cron 호출은 자동 no-op.)
    $executions = DB::fetchAll(
        "SELECT * FROM dividend_executions
         WHERE payout_month <= ? AND status = 'scheduled'
         ORDER BY payout_month ASC",
        [$todayDate]
    );

    if (empty($executions)) {
        jsonOk([
            'ok' => true,
            'today_kst' => $todayDate,
            'kst_day' => $todayKstDay,
            'processed' => 0,
            'message' => "{$todayDate} 기준 처리할 scheduled 배당 없음 — 정상 no-op (이미 paid 또는 cancelled 상태).",
        ]);
    }
    // 호환성 — 응답에 payout_date 도 노출 (가장 오래된 처리 대상의 date)
    $payoutDate = (string)$executions[0]['payout_month'];

    if (function_exists('ensurePopupTables')) ensurePopupTables();

    // [5] 검증 통과 — 자동 실행
    $results = [];
    foreach ($executions as $exec) {
        $execId = (int)$exec['id'];
        $poolUsdt = (float)$exec['payout_amount_usdt'];
        $priceMode = (string)$exec['price_mode'];
        $execPrice = (float)$exec['silica_price_at_execution'];

        $silicaPrice = match ($priceMode) {
            'execution_lock' => $execPrice,
            'payout_admin'   => silicaGetCurrentPrice(),
            'payout_api'     => silicaGetCurrentPrice(),
            default          => silicaGetCurrentPrice(),
        };
        if ($silicaPrice <= 0) {
            $results[] = ['exec_id' => $execId, 'status' => 'skipped', 'reason' => 'silica_price unavailable'];
            continue;
        }

        $stakers = DB::fetchAll(
            "SELECT address, silica_sto_staked FROM holdings WHERE silica_sto_staked > 0"
        );
        if (empty($stakers)) {
            $results[] = ['exec_id' => $execId, 'status' => 'skipped', 'reason' => 'no stakers'];
            continue;
        }
        $totalStaked = 0.0;
        foreach ($stakers as $s) $totalStaked += (float)$s['silica_sto_staked'];
        if ($totalStaked <= 0) {
            $results[] = ['exec_id' => $execId, 'status' => 'skipped', 'reason' => 'total_staked zero'];
            continue;
        }

        DB::get()->beginTransaction();
        try {
            // (2026-05-15 v365) Race condition guard — admin payout 과 동시
            //   발화 시 SELECT FOR UPDATE 로 row lock + status 재검증. 다른
            //   transaction 이 먼저 처리했다면 0 row → skip (no-op).
            $execLocked = DB::fetchOne(
                "SELECT id, status FROM dividend_executions WHERE id=? AND status='scheduled' FOR UPDATE",
                [$execId]
            );
            if (!$execLocked) {
                DB::get()->rollBack();
                $results[] = ['exec_id' => $execId, 'status' => 'skipped', 'reason' => 'concurrent processing or already paid'];
                continue;
            }

            $totalSilicaDistributed = 0.0;
            $recipients = 0;

            // (2026-05-15 v367) Claim-based model — cron 은 dividend_payouts 에
            //   status='pending' 행만 INSERT. 사용자가 claim.html 에서 [Claim
            //   Dividend] 클릭 시 holdings 잔액 + wallet_transactions 처리.
            //   1만 명 처리 시 거대 transaction → INSERT-only bulk 로 축소.
            //   UNIQUE (execution_id, address) 가 retry 중복 INSERT 차단.
            foreach ($stakers as $s) {
                $address = (string)$s['address'];
                $userStake = (float)$s['silica_sto_staked'];
                $sharePct = round($userStake / $totalStaked * 100, 6);
                $shareUsdt = round($poolUsdt * ($userStake / $totalStaked), 6);
                $silicaAmount = round($shareUsdt / $silicaPrice, 2);
                if ($silicaAmount <= 0) continue;

                try {
                    DB::execute(
                        "INSERT INTO dividend_payouts
                         (execution_id, address, staked_silica_sto_at_payout, share_pct, share_usdt,
                          silica_amount, silica_price_used, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
                        [$execId, $address, $userStake, $sharePct, $shareUsdt, $silicaAmount, $silicaPrice]
                    );
                } catch (Throwable $insErr) {
                    // UNIQUE 위반 (이미 같은 execution_id + address 있음) 은 정상 skip.
                    if (strpos($insErr->getMessage(), 'Duplicate entry') === false) throw $insErr;
                    continue;
                }

                $totalSilicaDistributed += $silicaAmount;
                $recipients++;
            }

            // (audit H12 fix · 2026-06-10) recipients=0 또는 totalSilicaDistributed<=0 시 paid 마킹 거부.
            //   기존: silica_amount=round(...,2) 가 모든 사용자에서 0 이 나오면 (배당풀이 너무 작거나
            //         silica 가격이 너무 높음) 0 명 지급된 채로 'paid' 마킹 → 운영 사고 은폐.
            //   변경: rollBack 후 status='scheduled' 유지 + audit log 기록. 운영자가 풀 증액 또는
            //         silica 가격 조정 후 재실행 가능.
            if ($recipients === 0 || $totalSilicaDistributed <= 0) {
                DB::get()->rollBack();
                try {
                    DB::execute(
                        "INSERT INTO silica_audit_log
                           (category, action, actor, target_id, new_value, metadata)
                         VALUES ('dividend_paid', 'dividend_zero_recipient_aborted', 'cron-http', ?, ?, ?)",
                        [
                            $execId,
                            json_encode([
                                'pool_usdt' => $poolUsdt,
                                'silica_price' => $silicaPrice,
                                'stakers_eligible' => count($stakers),
                                'total_staked' => $totalStaked,
                                'silica_total_distributed' => $totalSilicaDistributed,
                                'recipient_count' => $recipients,
                            ]),
                            json_encode([
                                'payout_date' => $payoutDate,
                                'reason' => 'recipients=0 or distribution<=0 — pool too small or silica_price too high',
                                'remediation' => 'Operator: increase pool_usdt or adjust silica_price, then re-run cron'
                            ]),
                        ]
                    );
                } catch (Throwable $_) {}
                error_log(
                    "[dividend cron] exec_id={$execId} ABORTED zero-recipient — " .
                    "pool={$poolUsdt} USDT, silica_price={$silicaPrice}, stakers=" . count($stakers) . ". " .
                    "Status kept 'scheduled' for operator review."
                );
                $results[] = ['exec_id' => $execId, 'status' => 'aborted_zero_recipient', 'reason' => 'recipients=0 or distribution<=0 — operator review required'];
                continue;
            }

            // (v365) Atomic status guard — FOR UPDATE 가 이미 lock 했지만
            //   WHERE status='scheduled' 이중 안전망.
            $affected = DB::execute(
                "UPDATE dividend_executions
                 SET status = 'paid', paid_at = NOW(),
                     silica_price_at_payout = ?,
                     silica_total_distributed = ?,
                     recipient_count = ?
                 WHERE id = ? AND status = 'scheduled'",
                [$silicaPrice, $totalSilicaDistributed, $recipients, $execId]
            );
            if ($affected === 0) {
                DB::get()->rollBack();
                $results[] = ['exec_id' => $execId, 'status' => 'skipped', 'reason' => 'status transition failed (concurrent)'];
                continue;
            }

            try {
                DB::execute(
                    "INSERT INTO silica_audit_log
                       (category, action, actor, target_id, new_value, metadata)
                     VALUES ('dividend_paid', 'dividend_paid', 'cron-http', ?, ?, ?)",
                    [
                        $execId,
                        json_encode([
                            'pool_usdt' => $poolUsdt,
                            'silica_price_at_payout' => $silicaPrice,
                            'silica_total_distributed' => $totalSilicaDistributed,
                            'recipient_count' => $recipients,
                        ]),
                        json_encode([
                            'payout_date' => $payoutDate,
                            'price_mode' => $priceMode,
                            'trigger' => 'cron_http_autoexec',
                            'kst_day_validated' => $todayKstDay,
                        ]),
                    ]
                );
            } catch (Throwable $_) {}

            DB::get()->commit();
            $results[] = [
                'exec_id' => $execId,
                'status' => 'paid',
                'recipients' => $recipients,
                'total_silica' => $totalSilicaDistributed,
                'silica_price' => $silicaPrice,
            ];
        } catch (Throwable $e) {
            if (DB::get()->inTransaction()) DB::get()->rollBack();
            $results[] = ['exec_id' => $execId, 'status' => 'failed', 'error' => $e->getMessage()];
        }
    }

    jsonOk([
        'ok' => true,
        'payout_date' => $payoutDate,
        'kst_day_validated' => $todayKstDay,
        'processed' => count($results),
        'results' => $results,
    ]);
};
post('/api/cron/distribute-dividends', $cronDividendHandler);
get('/api/cron/distribute-dividends', $cronDividendHandler);

// ----------------------------------------------------------------
// POST /api/admin/silica/dividend/payout  — 관리자가 직접 지급 실행
// (v343) cron 책임 분리에 따른 신설 — 실제 분배 로직은 여기 한 곳.
//   adminOnly() 로 JWT + 지갑 의무화 (auth.php $requireWallet 정규식에
//   /silica/dividend/payout 포함됨).
//   Body: { id: int, dryrun?: bool }
// ----------------------------------------------------------------
post('/api/admin/silica/dividend/payout', function () {
    $admin = adminOnly();
    $body = getJsonBody();
    $execId = (int)($body['id'] ?? 0);
    $dryRun = !empty($body['dryrun']);
    if ($execId <= 0) jsonError('id 필요', 400);

    if (function_exists('ensurePopupTables')) ensurePopupTables();

    // (v361) self-healing schema migration — admin payout 경로도 동일한
    //   INSERT INTO dividend_payouts 를 사용하므로 schema 보정 필요.
    silicaEnsureDividendSchema();

    // Early SELECT — 사용자 친화적 에러용. transaction 안의 SELECT FOR UPDATE 가
    //   최종 권위. 둘 사이 race 가 발생해도 FOR UPDATE 가 차단.
    $exec = DB::fetchOne("SELECT * FROM dividend_executions WHERE id = ?", [$execId]);
    if (!$exec) jsonError('배당 실행을 찾을 수 없습니다.', 404);
    if ($exec['status'] !== 'scheduled') {
        jsonError("이미 처리된 배당은 재실행 불가 (현재 상태: {$exec['status']}).", 400);
    }

    $payoutDate = (string)$exec['payout_month'];
    $poolUsdt = (float)$exec['payout_amount_usdt'];
    $priceMode = (string)$exec['price_mode'];
    $execPrice = (float)$exec['silica_price_at_execution'];

    // 시세 결정 — execution_lock 은 예약 시점 락, 그 외는 현재 시세
    $silicaPrice = match ($priceMode) {
        'execution_lock' => $execPrice,
        'payout_admin'   => silicaGetCurrentPrice(),
        'payout_api'     => silicaGetCurrentPrice(),
        default          => silicaGetCurrentPrice(),
    };
    if ($silicaPrice <= 0) jsonError('Silica 시세 미설정 — 시세 관리에서 설정 후 다시 시도하세요.', 400);

    // 스테이커 스냅샷
    $stakers = DB::fetchAll(
        "SELECT address, silica_sto_staked
           FROM holdings
          WHERE silica_sto_staked > 0"
    );
    if (empty($stakers)) jsonError('스테이킹 중인 사용자가 없습니다.', 400);

    $totalStaked = 0.0;
    foreach ($stakers as $s) $totalStaked += (float)$s['silica_sto_staked'];
    if ($totalStaked <= 0) jsonError('총 스테이킹 수량이 0입니다.', 400);

    if (!$dryRun) {
        DB::get()->beginTransaction();
        // (2026-05-15 v365) Race condition guard — admin payout 과 cron 발화가
        //   동시에 같은 행을 처리하면 중복 지급 가능. SELECT FOR UPDATE 로
        //   row lock + status='scheduled' 재검증. 다른 transaction 이 먼저
        //   완료했다면 FOR UPDATE 가 0 row 반환 → 즉시 abort.
        $execLocked = DB::fetchOne(
            "SELECT id, status FROM dividend_executions WHERE id=? AND status='scheduled' FOR UPDATE",
            [$execId]
        );
        if (!$execLocked) {
            DB::get()->rollBack();
            jsonError(409, '동시 처리 검출 — 이미 다른 트랜잭션이 처리 중이거나 완료됐습니다. 새로고침 후 상태를 확인하세요.');
        }
    }

    try {
        $totalSilicaDistributed = 0.0;
        $recipients = 0;
        $perUserPreview = [];

        foreach ($stakers as $s) {
            $address = (string)$s['address'];
            $userStake = (float)$s['silica_sto_staked'];
            $sharePct = round($userStake / $totalStaked * 100, 6);
            $shareUsdt = round($poolUsdt * ($userStake / $totalStaked), 6);
            $silicaAmount = round($shareUsdt / $silicaPrice, 2);
            if ($silicaAmount <= 0) continue;

            if (!$dryRun) {
                // (v367) Claim-based model — pending 으로 INSERT. 사용자가
                //   클레임 시점에 holdings/wallet_transactions 처리.
                try {
                    DB::execute(
                        "INSERT INTO dividend_payouts
                         (execution_id, address, staked_silica_sto_at_payout, share_pct, share_usdt,
                          silica_amount, silica_price_used, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
                        [$execId, $address, $userStake, $sharePct, $shareUsdt, $silicaAmount, $silicaPrice]
                    );
                } catch (Throwable $insErr) {
                    // UNIQUE 위반 = 이미 같은 (execution_id, address) 있음 → skip
                    if (strpos($insErr->getMessage(), 'Duplicate entry') === false) throw $insErr;
                    continue;
                }
            } else {
                $perUserPreview[] = [
                    'address' => substr($address, 0, 6) . '...' . substr($address, -4),
                    'stake' => $userStake,
                    'share_pct' => $sharePct,
                    'silica_amount' => $silicaAmount,
                ];
            }

            $totalSilicaDistributed += $silicaAmount;
            $recipients++;
        }

        if (!$dryRun) {
            // (v365) Atomic status guard — WHERE status='scheduled' 로 race
            //   완전 차단. FOR UPDATE 가 이미 lock 했지만 이중 안전망.
            $affected = DB::execute(
                "UPDATE dividend_executions
                 SET status = 'paid', paid_at = NOW(),
                     silica_price_at_payout = ?,
                     silica_total_distributed = ?,
                     recipient_count = ?
                 WHERE id = ? AND status = 'scheduled'",
                [$silicaPrice, $totalSilicaDistributed, $recipients, $execId]
            );
            if ($affected === 0) {
                DB::get()->rollBack();
                jsonError(409, '상태 전이 실패 — 동시 처리 검출. 새로고침 후 상태를 확인하세요.');
            }

            try {
                DB::execute(
                    "INSERT INTO silica_audit_log
                       (category, action, actor, target_id, new_value, metadata)
                     VALUES ('dividend_paid', 'dividend_paid', ?, ?, ?, ?)",
                    [
                        $admin['username'],
                        $execId,
                        json_encode([
                            'pool_usdt'                => $poolUsdt,
                            'silica_price_at_payout'   => $silicaPrice,
                            'silica_total_distributed' => $totalSilicaDistributed,
                            'recipient_count'          => $recipients,
                        ]),
                        json_encode([
                            'payout_date' => $payoutDate,
                            'price_mode'  => $priceMode,
                            'trigger'     => 'admin_ui',
                        ]),
                    ]
                );
            } catch (Throwable $_) {}

            // 마커 setting 도 제거 (cron 이 다시 보이지 않도록)
            try { setSetting("dividend_ready_{$payoutDate}", ''); } catch (Throwable $_) {}

            DB::get()->commit();
        }

        jsonOk([
            'ok' => true,
            'dry_run' => $dryRun,
            'exec_id' => $execId,
            'payout_date' => $payoutDate,
            'recipients' => $recipients,
            'total_silica' => $totalSilicaDistributed,
            'silica_price' => $silicaPrice,
            'pool_usdt' => $poolUsdt,
        ] + ($dryRun ? ['preview' => $perUserPreview] : []));
    } catch (Throwable $e) {
        if (!$dryRun && DB::get()->inTransaction()) DB::get()->rollBack();
        jsonError('배당 지급 처리 실패: ' . $e->getMessage(), 500);
    }
});

// ----------------------------------------------------------------
// GET /api/silica/payment-status  (public)
// (2026-05-14 v347) 운영자: '재해로 14~16일 모두 다운 → 17일 이후 정상화 시,
//   시스템이 미지급 상황을 자동 인지하고 배너로 알림.' 사용자 모든 페이지가
//   이 endpoint 를 polling 해 지연 상태일 때 배너 노출.
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// GET /api/silica/dividend/schedule  (public, wallet auth optional)
// (2026-05-15 v363) 운영자: '예정된 지급 배당금이 user/claim.html 에 표기
//   되어야 한다.' user 측의 ANNUAL DIVIDEND PAYOUT INFO 카드가 정적
//   placeholder 만 보이는 dead UI 상태였음 — backend 의 dividend_executions
//   를 조회하는 endpoint 가 처음부터 없었음. 추가 후 frontend 에서 fetch.
//   wallet 연결 시 본인 share + expected silica 까지 함께 반환.
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// GET /api/admin/silica/dividend/payout-log  (admin)
// (2026-05-15 v373) 운영자: '배당금에도 이러한 로그와 팝업 시스템을 추가해줘.'
//   이자 페이지의 회차별 집계 + 검색 모달 패턴을 배당에도 적용. 기존
//   dividendHistoryRows 가 회차 단위 요약을 이미 보여주므로 그 행을 클릭
//   하면 모달이 열려 그 회차의 사용자별 dividend_payouts 행 표시 + 50개씩
//   페이지네이션 + 지갑 검색 + 상태 필터.
// ----------------------------------------------------------------
get('/api/admin/silica/dividend/payout-log', function () {
    adminOnly();
    silicaEnsureDividendSchema();

    $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    $executionId = (int)($_GET['execution_id'] ?? 0);
    $address = trim((string)($_GET['address'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));

    $where = [];
    $params = [];
    if ($executionId > 0) {
        $where[] = "execution_id = ?";
        $params[] = $executionId;
    }
    if ($address !== '') {
        // partial match — '7oWY' 만으로도 검색 가능
        $where[] = "address LIKE ?";
        $params[] = '%' . $address . '%';
    }
    if ($status === 'pending') {
        $where[] = "status = 'pending'";
    } elseif ($status === 'claimed') {
        // 'paid' 는 옛 자동 분배 흐름 (v367 이전), 'claimed' 는 새 클레임 흐름.
        // 둘 다 사용자 잔액 반영된 완료 상태로 통합.
        $where[] = "status IN ('claimed', 'paid')";
    }
    $whereSql = $where ? "WHERE " . implode(" AND ", $where) : "";

    $rows = DB::fetchAll(
        "SELECT id, execution_id, address, staked_silica_sto_at_payout,
                share_pct, share_usdt, silica_amount, silica_price_used,
                status, claimed_at
           FROM dividend_payouts
           {$whereSql}
           ORDER BY id DESC
           LIMIT " . $limit . " OFFSET " . $offset,
        $params
    );

    $count = (int)(DB::fetchValue(
        "SELECT COUNT(*) FROM dividend_payouts {$whereSql}",
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

// ----------------------------------------------------------------
// POST /api/silica/dividend/claim  (wallet auth required)
// (2026-05-15 v367) 운영자: '버튼을 클릭해서 받아가게 하면 동시 받는 유저가
//   매우 줄어들텐데' — 1만 명 동시 자동 분배의 PHP timeout/DB lock 위험을
//   해소하는 클레임 방식. cron 은 dividend_payouts 에 'pending' 만 INSERT,
//   사용자가 claim.html 에서 본인 분만 받음 (단일 사용자 transaction).
//   미수령 = 무기한 대기 (옵션 A) — 사용자 자율, 자산 안전.
// ----------------------------------------------------------------
post('/api/silica/dividend/claim', function () {
    $user = authRequired();
    $address = $user['address'];

    silicaEnsureDividendSchema();

    $pendings = DB::fetchAll(
        "SELECT id, execution_id, silica_amount
           FROM dividend_payouts
          WHERE address = ? AND status = 'pending'
          ORDER BY execution_id ASC",
        [$address]
    );

    if (empty($pendings)) {
        jsonError(400, '수령 가능한 배당이 없습니다.');
    }

    DB::get()->beginTransaction();
    try {
        // 한 번 더 FOR UPDATE 로 race protection
        $pendingsLocked = DB::fetchAll(
            "SELECT id, execution_id, silica_amount
               FROM dividend_payouts
              WHERE address = ? AND status = 'pending'
              ORDER BY execution_id ASC FOR UPDATE",
            [$address]
        );
        if (empty($pendingsLocked)) {
            DB::get()->rollBack();
            jsonError(409, '동시 처리 검출 — 이미 클레임 진행 중. 새로고침 후 다시 시도하세요.');
        }

        $totalSilica = 0.0;
        $execIds = [];
        foreach ($pendingsLocked as $p) {
            $silicaAmount = (float)$p['silica_amount'];
            $totalSilica += $silicaAmount;
            $execIds[] = (int)$p['execution_id'];

            $affected = DB::execute(
                "UPDATE dividend_payouts
                    SET status = 'claimed', claimed_at = NOW()
                  WHERE id = ? AND status = 'pending'",
                [(int)$p['id']]
            );
            if ($affected === 0) {
                // 다른 transaction 이 먼저 claim 함 (이론상 FOR UPDATE 가 차단했어야)
                DB::get()->rollBack();
                jsonError(409, '상태 전이 실패 — 동시 처리 검출.');
            }
        }

        $balBefore = (float)(DB::fetchValue(
            "SELECT COALESCE(silica_balance, 0) FROM holdings WHERE address = ?",
            [$address]
        ) ?? 0);

        DB::execute(
            "UPDATE holdings
                SET silica_balance = COALESCE(silica_balance, 0) + ?, updated_at = NOW()
              WHERE address = ?",
            [$totalSilica, $address]
        );
        $balAfter = $balBefore + $totalSilica;

        $memo = count($execIds) === 1
            ? "연 배당 클레임: exec#{$execIds[0]}"
            : "연 배당 클레임: " . count($execIds) . "회차 합산 (exec#" . implode(',#', $execIds) . ")";
        DB::execute(
            "INSERT INTO wallet_transactions
             (address, kind, status, asset, amount, before_amount, after_amount, txid, memo, created_at)
             VALUES (?, 'dividend_claim', '완료', 'Silica', ?, ?, ?, NULL, ?, NOW())",
            [$address, $totalSilica, $balBefore, $balAfter, $memo]
        );

        try {
            DB::execute(
                "INSERT INTO silica_audit_log
                   (category, action, actor, target_id, new_value, metadata)
                 VALUES ('dividend_claimed', 'dividend_claimed', ?, ?, ?, ?)",
                [
                    $address,
                    count($execIds) > 0 ? $execIds[0] : null,
                    json_encode([
                        'address' => $address,
                        'total_silica' => $totalSilica,
                        'before_balance' => $balBefore,
                        'after_balance' => $balAfter,
                        'execution_ids' => $execIds,
                    ]),
                    json_encode([
                        'claim_count' => count($execIds),
                        'trigger' => 'user_claim',
                    ]),
                ]
            );
        } catch (Throwable $_) {}

        DB::get()->commit();

        jsonOk([
            'claimed_count' => count($execIds),
            'total_silica' => $totalSilica,
            'execution_ids' => $execIds,
            'before_balance' => $balBefore,
            'after_balance' => $balAfter,
        ]);
    } catch (Throwable $e) {
        if (DB::get()->inTransaction()) DB::get()->rollBack();
        jsonError(500, '클레임 실패: ' . $e->getMessage());
    }
});

get('/api/silica/dividend/schedule', function () {
    $row = DB::fetchOne(
        "SELECT id, payout_month, payout_amount_usdt, status
           FROM dividend_executions
          WHERE status = 'scheduled'
          ORDER BY payout_month ASC
          LIMIT 1"
    );

    // (2026-06-16 v898) audit 후속 — 배당 '예정(scheduled)' 과 '미수령(pending)' 표시 분리.
    //   기존: scheduled 가 없으면(배당 paid 직후) 여기서 early-return 하여, 사용자의 미수령
    //         배당(dividend_payouts.status='pending')을 계산조차 안 함 → claim.html 이
    //         'DIVIDEND CLAIM 0.00 / 버튼 비활성' 으로 떠 사용자가 수령 불가 (운영자 6/16 발견).
    //   변경: early-return 제거. 'next'(예정)는 그대로(없으면 null), 미수령은 'my_pending' 으로
    //         항상 계산해 반환. claim 실행(/dividend/claim)은 schedule 과 독립(pending 직접
    //         조회 + 트랜잭션 + FOR UPDATE)이라 돈 로직 무변경 — '표시'만 복구.
    //   Revert: 아래 early-return 주석 해제 + my_pending 블록/필드 제거.
    // if (!$row) {
    //     jsonOk(['next' => null]);
    //     return;
    // }

    $silicaPrice = function_exists('silicaGetCurrentPrice') ? silicaGetCurrentPrice() : 0.0;

    // 예정 배당(scheduled) — 있을 때만 next 구성, 없으면 null
    $next = null;
    if ($row) {
        $poolUsdt = (float)$row['payout_amount_usdt'];
        $poolSilicaEst = $silicaPrice > 0 ? round($poolUsdt / $silicaPrice, 2) : null;
        $next = [
            'id' => (int)$row['id'],
            'payout_date' => (string)$row['payout_month'],
            'pool_usdt' => $poolUsdt,
            'silica_price_usdt' => $silicaPrice > 0 ? $silicaPrice : null,
            'pool_silica_estimate' => $poolSilicaEst,
            'status' => (string)$row['status'],
            'user' => null,
        ];
    }

    // wallet 인증 시 본인 미수령(pending) 배당 + (예정 있으면) share/expected 계산.
    //   (2026-06-16 v898) 미수령(my_pending)은 예정(next) 유무와 무관하게 항상 계산 —
    //   배당이 paid 된 뒤에도 사용자가 받을 분을 claim.html 에서 볼 수 있도록.
    $myPending = null;
    try {
        $user = function_exists('authOptional') ? authOptional() : null;
        if ($user && !empty($user['address'])) {
            $address = $user['address'];

            // 예정 배당(next)이 있을 때만 share/expected (참여 안내용)
            if ($next) {
                $userStaked = (float)(DB::fetchValue(
                    "SELECT silica_sto_staked FROM holdings WHERE address=?",
                    [$address]
                ) ?? 0);
                $totalStaked = (float)(DB::fetchValue(
                    "SELECT COALESCE(SUM(silica_sto_staked), 0) FROM holdings WHERE silica_sto_staked > 0"
                ) ?? 0);

                $share = ($userStaked > 0 && $totalStaked > 0) ? ($userStaked / $totalStaked) : 0.0;
                $expectedUsdt = $share > 0 ? round((float)$next['pool_usdt'] * $share, 6) : 0.0;
                $expectedSilica = ($silicaPrice > 0 && $expectedUsdt > 0)
                    ? round($expectedUsdt / $silicaPrice, 2)
                    : null;

                $next['user'] = [
                    'staked_sto' => $userStaked,
                    'total_staked_sto' => $totalStaked,
                    'share_pct' => $share > 0 ? round($share * 100, 4) : 0,
                    'expected_usdt' => $expectedUsdt,
                    'expected_silica' => $expectedSilica,
                ];
            }

            // (v367) Pending 미수령 분 — 과거 회차 + 이번 회차 모두 합산.
            //   claim 버튼이 합산 금액 표시 + 클릭 시 모두 한 번에 처리. (v898) 예정 유무 무관.
            $pendingRows = [];
            $pendingSilica = 0.0;
            try {
                $pendingRows = DB::fetchAll(
                    "SELECT id, execution_id, silica_amount, silica_price_used,
                            staked_silica_sto_at_payout, share_pct, share_usdt
                       FROM dividend_payouts
                      WHERE address = ? AND status = 'pending'
                      ORDER BY execution_id ASC",
                    [$address]
                );
                foreach ($pendingRows as $pr) {
                    $pendingSilica += (float)$pr['silica_amount'];
                }
            } catch (Throwable $_) {}

            $myPending = [
                'pending_claim_count' => count($pendingRows),
                'pending_silica_total' => round($pendingSilica, 2),
                'pending_executions' => array_map(fn($r) => (int)$r['execution_id'], $pendingRows),
            ];

            // (하위호환) 예정(next)이 있으면 기존 프론트가 읽던 next.user.pending_* 도 채움.
            if ($next && isset($next['user']) && is_array($next['user'])) {
                $next['user']['pending_claim_count'] = $myPending['pending_claim_count'];
                $next['user']['pending_silica_total'] = $myPending['pending_silica_total'];
                $next['user']['pending_executions'] = $myPending['pending_executions'];
            }
        }
    } catch (Throwable $_) {}

    jsonOk(['next' => $next, 'my_pending' => $myPending]);
});

// ----------------------------------------------------------------
// GET /api/silica/interest/next  (public, wallet auth optional)
// (2026-05-15 v364) 운영자: '이자 부분도 방금 배당금 업데이트 처럼 되어야
//   한다고 생각한다.' user/claim.html INTEREST 탭에도 다음 지급일 + 본인
//   예상 수령액 표시. 배당과 동일 패턴.
// ----------------------------------------------------------------
get('/api/silica/interest/next', function () {
    $kstNow = new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul'));
    $today = (int)$kstNow->format('j');

    // 다음 지급일 — 17일 이후면 다음 달 15일, 그 외는 이번 달 15일
    $nextMonth = (int)$kstNow->format('m');
    $nextYear  = (int)$kstNow->format('Y');
    if ($today > 16) {
        $nextMonth += 1;
        if ($nextMonth > 12) { $nextMonth = 1; $nextYear += 1; }
    }
    $nextPayoutDate = sprintf("%04d-%02d-15", $nextYear, $nextMonth);

    // 자산 APR (단일 자산 정책 — Silica 는 SILICA-79907 만 사용)
    $assetId = 'SILICA-79907';
    $asset = DB::fetchOne("SELECT id, apr, status FROM assets WHERE id=?", [$assetId]);
    $aprPct = $asset ? (float)($asset['apr'] ?? 0) : 0.0;

    $next = [
        'payout_date' => $nextPayoutDate,
        'asset_id' => $assetId,
        'apr_pct' => $aprPct,
        'asset_status' => $asset ? (string)$asset['status'] : null,
        'user' => null,
    ];

    // wallet 인증 시 본인 staked + expected_usdt 계산
    try {
        $user = function_exists('authOptional') ? authOptional() : null;
        if ($user && !empty($user['address'])) {
            $address = $user['address'];
            $userStaked = (float)(DB::fetchValue(
                "SELECT silica_sto_staked FROM holdings WHERE address=? AND asset_id=?",
                [$address, $assetId]
            ) ?? 0);

            // 월이자 = staked × APR ÷ 100 ÷ 12. 백엔드 stakingTruncatePayoutUsdt
            // 와 동일하게 1자리 floor — UI 와 실제 지급액 mismatch 방지.
            $expectedUsdtRaw = ($userStaked > 0 && $aprPct > 0)
                ? ($userStaked * $aprPct / 100) / 12
                : 0.0;
            $expectedUsdt = floor(($expectedUsdtRaw + 1e-9) * 10) / 10;

            $next['user'] = [
                'staked_sto' => $userStaked,
                'expected_usdt' => $expectedUsdt,
            ];
        }
    } catch (Throwable $_) {}

    jsonOk(['next' => $next]);
});

get('/api/silica/payment-status', function () {
    $kstNow = new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul'));
    $today = $kstNow->format('Y-m-d');
    $todayDay = (int)$kstNow->format('j');
    $monthKey = $kstNow->format('Y-m');

    // (2026-05-18 v570) 운영자 보고 — 신규 도메인 (rwa.silicachainholding.com) 에
    //   배포 직후 배너 + 모달 노출. v567 의 가드는 interest 만 보호했고,
    //   dividend overdue 체크 (status='scheduled' AND payout_month<today) 는
    //   무가드여서 admin 페이지를 살펴보다 잘못 만든 scheduled row 한 줄로도
    //   배너가 뜨는 경로가 남아 있었다.
    //
    //   더 견고한 규칙: "**시스템에 실제 지급 활동의 흔적이 전혀 없으면**
    //   has_pending = false 로 즉시 종결". 흔적은 다음 중 하나:
    //   - holdings 에 staked_token > 0 인 행
    //   - interest_claims 한 건 이상 (과거 이자 청구)
    //   - dividend_payouts 한 건 이상 (과거 배당 지급)
    //   - funding_records 한 건 이상 (자산 자금 유입)
    //   하나도 없으면 '깨끗한 새 deployment' 로 판정 — 어떤 scheduled row 가
    //   섞여 있어도 운영자가 정리할 시간을 주고, 사용자에게 잘못된 경고를 안 띄움.
    // (audit H11 fix · 2026-06-10) staked_token + silica_sto_staked 둘 다 검사.
    //   silicaHasDisasterPending() (lib/silica.php) 와 동일 로직 — 양쪽 동기화 필수.
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
        // 어떤 테이블이라도 없으면 (예: 마이그레이션 미완) 활동 없음으로 간주.
        $isLiveSystem = false;
    }

    if (!$isLiveSystem) {
        // Fresh install — has_pending=false 로 즉시 종결.
        jsonOk([
            'has_pending' => false,
            'today_kst' => $today,
            'overdue_dividends' => [],
            'overdue_interest' => false,
            'fresh_install_short_circuit' => true,
            'message_ko' => '',
            'message_en' => '',
        ]);
    }

    // 이하부터는 live system 에서만 평가.

    // 미지급 배당: payout_month < 오늘 AND status='scheduled'
    $overdueDividends = [];
    try {
        $rows = DB::fetchAll(
            "SELECT id, payout_month, payout_amount_usdt
               FROM dividend_executions
              WHERE status = 'scheduled' AND payout_month < ?
              ORDER BY payout_month ASC",
            [$today]
        );
        foreach ($rows as $r) {
            $overdueDividends[] = [
                'id' => (int)$r['id'],
                'payout_month' => (string)$r['payout_month'],
                'pool_usdt' => (float)$r['payout_amount_usdt'],
            ];
        }
    } catch (Throwable $_) {}

    // 미지급 이자: lock 윈도우 (14~16) 지나간 회차인데 cron_accrual_done 키 없음
    // (2026-05-18 v567) 운영자 보고 — 신규 설치 도메인에서 '배당금/이자 지급
    //   안내' 모달이 무조건 떴음. 원인: 신규 설치는 cron_accrual_done_{YYYY-MM}
    //   키가 한 번도 만들어진 적이 없음 + 오늘이 16일 초과 → 무조건 overdue
    //   판정. 가드 1차: hasStakers || hasPastClaims.
    // (2026-05-18 v572) 운영자 재보고 — '5월 18일에 설치했는데 왜 5월 회차
    //   이슈?'. v567 의 hasStakers OR 조건 결함: 운영자가 설치 직후 테스트로
    //   stake 한 건 만들었더니 hasStakers=true → false alarm. 5월 14-16 lock
    //   window 시점에 시스템 자체가 없었으니 5월 지급 의무는 존재할 수 없는데
    //   현재 stake 한 사람이 있다는 이유만으로 미지급 판정.
    //
    //   정답 로직: "이번 달 14-16에 cron 이 돌았어야 했는가" — 가장 확실한 신호는
    //   "이전 달들에 실제로 청구 기록이 있는가" (= 시스템이 작동 중이었음).
    //   - 과거 달에 청구 기록 존재 → 이번 달 누락은 진짜 overdue
    //   - 과거 달 청구 기록 0 → 신규 설치 / 첫 cron 실행 전 → 의무 없음, 무경보
    //
    //   현재 stake 잔액(hasStakers)은 의도적으로 무시 — 운영자가 18일에 stake 했어도
    //   그건 6월 회차 대상이지 5월 대상이 아님 (5월 스냅샷은 14-16에 이미 종료).
    // (audit H13 fix · 2026-06-10) 첫 운영 월 검출 보완.
    //   기존 hasPrevMonthClaims 단독 조건은 mainnet 첫 cron 실패 시 검출 불가.
    //   production_first_payout_month setting 으로 명시적 추적 추가 (운영자가
    //   mainnet 출시 시 admin 설정에서 YYYY-MM 입력). 둘 중 하나라도 true 면 overdue.
    //   silicaHasDisasterPending() (lib/silica.php) 와 같은 로직 — 양쪽 동기화 필수.
    $overdueInterest = false;
    if ($todayDay > 16) {
        $doneKey = "cron_accrual_done_{$monthKey}";
        try {
            $done = trim((string)(getSetting($doneKey, '') ?? ''));
            if ($done === '') {
                $hasPrevMonthClaims = false;
                try {
                    $hasPrevMonthClaims = (int)(DB::fetchValue(
                        "SELECT COUNT(*) FROM interest_claims WHERE month_key < ?",
                        [$monthKey]
                    ) ?? 0) > 0;
                } catch (Throwable $_) {}
                $firstPayout = trim((string)(getSetting('production_first_payout_month', '') ?? ''));
                $reachedFirstPayout = $firstPayout !== '' && strcmp($monthKey, $firstPayout) >= 0;
                $overdueInterest = $hasPrevMonthClaims || $reachedFirstPayout;
            }
        } catch (Throwable $_) {}
    }

    $hasPending = !empty($overdueDividends) || $overdueInterest;

    jsonOk([
        'has_pending' => $hasPending,
        'today_kst' => $today,
        'overdue_dividends' => $overdueDividends,
        'overdue_interest' => $overdueInterest,
        'fresh_install_short_circuit' => false,
        // (2026-05-21 보안감사) 메시지에 자동 lock 안내 추가 — 사용자가 "왜
        //   stake/unstake 버튼이 안 눌리지?" 혼란 없도록 시스템 동작 명시.
        'message_ko' => $hasPending
            ? "재해 및 서버 이슈로 인해 이자 또는 배당금 지급이 처리 되지 않았습니다.\n관리자가 지급을 완료 할 때 까지 언스테이킹을 하지마세요.\n이 기간 동안 시스템이 자동으로 스테이킹/언스테이킹을 일시 정지합니다 (사용자의 정당한 이자 권리 보호).\n언스테이킹시 이자 및 배당금을 받으실 수 없습니다.\n지급 완료 후 별도 공지를 드릴 수 있도록 하겠습니다.\n불편을 드려 죄송합니다. 감사합니다."
            : '',
        'message_en' => $hasPending
            ? "Due to natural disasters or server issues, interest or dividend payments have not been processed.\nPlease do not unstake until the administrator completes the payment.\nDuring this period, the system automatically suspends staking/unstaking (to protect your interest entitlement).\nIf you unstake, you will not be able to receive your interest or dividend.\nWe will provide a separate notice after the payment is completed.\nWe apologize for the inconvenience. Thank you."
            : '',
    ]);
});
