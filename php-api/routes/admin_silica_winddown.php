<?php
/**
 * Silica Wind-down State Management
 *
 * (2026-05-15 v394) 운영자 결정: 매각 / 운영 종료 시 wind-down 절차 도입.
 * 약관 v392 제10조 (광산 매각, 운영 종료 및 정산) 의 절차를 시스템화.
 *
 * State machine:
 *   active → winding_down → closed
 *
 * 핵심 제약:
 *   - 총 wind-down 기간 (announced_at → withdrawal_deadline) ≤ 2개월
 *   - 강제 언스테이킹은 매월 14~16일 (KST 스테이킹 락 윈도우) 제외
 *   - 미회수 자금은 종료 후 회사 귀속 (회수 청구 불가)
 *
 * Endpoints:
 *   GET  /api/silica/service-state                    (public)
 *   GET  /api/admin/silica/winddown                   (admin)
 *   POST /api/admin/silica/winddown/begin             (admin)
 *   POST /api/admin/silica/winddown/set-amm           (admin)
 *   POST /api/admin/silica/winddown/set-deadline      (admin)
 *   POST /api/admin/silica/winddown/disable-staking   (admin, 14~16일 차단)
 *   POST /api/admin/silica/winddown/close             (admin)
 */

if (!function_exists('ensureSilicaWinddownTable')) {
    function ensureSilicaWinddownTable(): void {
        static $done = false;
        if ($done) return;
        if (function_exists('ensureSilicaAuditLog')) ensureSilicaAuditLog();
        DB::execute("
            CREATE TABLE IF NOT EXISTS silica_winddown_state (
                id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
                state               ENUM('active','winding_down','closed') NOT NULL DEFAULT 'active',
                announced_at        DATETIME NULL,
                staking_disabled_at DATETIME NULL,
                withdrawal_deadline DATETIME NULL,
                amm_enabled         TINYINT(1) NOT NULL DEFAULT 0,
                amm_buy_price_usdt  DECIMAL(20,8) NULL,
                amm_liquidity_usdt  DECIMAL(20,8) NOT NULL DEFAULT 0,
                amm_liquidity_used  DECIMAL(20,8) NOT NULL DEFAULT 0,
                reason              TEXT NULL,
                updated_by          VARCHAR(128) NULL,
                created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Seed: single 'active' row if table empty.
        $exists = (int)(DB::fetchValue("SELECT COUNT(*) FROM silica_winddown_state") ?? 0);
        if ($exists === 0) {
            DB::execute(
                "INSERT INTO silica_winddown_state (state, updated_by) VALUES ('active', 'system_seed')"
            );
        }
        $done = true;
    }
}

if (!function_exists('silicaWinddownGetRow')) {
    function silicaWinddownGetRow(): array {
        ensureSilicaWinddownTable();
        $row = DB::fetchOne("SELECT * FROM silica_winddown_state ORDER BY id ASC LIMIT 1");
        return $row ?: ['state' => 'active'];
    }
}

if (!function_exists('silicaIsServiceActive')) {
    function silicaIsServiceActive(): bool {
        try {
            $row = silicaWinddownGetRow();
            return ($row['state'] ?? 'active') === 'active';
        } catch (Throwable $_) {
            return true; // fail open — 테이블 없으면 기본 active
        }
    }
}

if (!function_exists('silicaIsStakingDisabled')) {
    // (2026-05-18 v463) 운영자 보고: disable-staking 실행 후에도 사용자가 다시
    //   stake 가능. silicaIsServiceActive 는 state 만 체크하고 staking_disabled_at
    //   은 보지 않아 wind-down 도중 stake 만 차단하는 시나리오를 지원 못함.
    //   새 helper — staking_disabled_at IS NOT NULL 이면 true.
    function silicaIsStakingDisabled(): bool {
        try {
            $row = silicaWinddownGetRow();
            return !empty($row['staking_disabled_at']);
        } catch (Throwable $_) {
            return false; // fail open
        }
    }
}

if (!function_exists('silicaIsServiceClosed')) {
    function silicaIsServiceClosed(): bool {
        try {
            $row = silicaWinddownGetRow();
            return ($row['state'] ?? 'active') === 'closed';
        } catch (Throwable $_) {
            return false;
        }
    }
}

// ------------------------------------------------------------------
// GET /api/silica/service-state  (public)
// 사용자 측에서 사이트 상태 확인 — 헤더 배너, 출금 마감 카운트다운에 사용.
// ------------------------------------------------------------------
get('/api/silica/service-state', function () {
    $row = silicaWinddownGetRow();
    $liqTotal = (float)($row['amm_liquidity_usdt'] ?? 0);
    $liqUsed  = (float)($row['amm_liquidity_used'] ?? 0);
    jsonOk([
        'state'                  => $row['state'] ?? 'active',
        'announced_at'           => $row['announced_at'] ?? null,
        'staking_disabled_at'    => $row['staking_disabled_at'] ?? null,
        'withdrawal_deadline'    => $row['withdrawal_deadline'] ?? null,
        'amm_enabled'            => (int)($row['amm_enabled'] ?? 0) === 1,
        'amm_buy_price_usdt'     => $row['amm_buy_price_usdt'] ?? null,
        'amm_liquidity_remaining'=> max(0, $liqTotal - $liqUsed),
    ]);
});

// ------------------------------------------------------------------
// GET /api/admin/silica/winddown
// admin 측 전체 설정 조회.
// ------------------------------------------------------------------
get('/api/admin/silica/winddown', function () {
    adminOnly();
    $row = silicaWinddownGetRow();
    jsonOk(['winddown' => $row]);
});

// ------------------------------------------------------------------
// GET /api/admin/silica/winddown/preview  (v402)
// 미회수 자금 미리보기 — 영구 폐쇄 전 운영자가 '지금 폐쇄하면 얼마가
// 회사 귀속 되는지' 확인. 5단계 실행 시점의 동일 데이터가 audit 에 기록.
// ------------------------------------------------------------------
get('/api/admin/silica/winddown/preview', function () {
    adminOnly();
    ensureSilicaWinddownTable();

    // (v403) usdt_balance 는 holdings 가 아니라 별도 balances 테이블에 있음.
    //   잘못된 테이블/컬럼 참조로 SQL 오류 → 500 발생하던 버그 수정.
    //   활성 사용자: holdings 의 silica 자산 보유자 + balances 의 USDT 보유자
    //   를 union 하여 중복 제거 카운트.
    $activeUsers = (int)(DB::fetchValue(
        "SELECT COUNT(DISTINCT address) FROM (
            SELECT address FROM holdings
             WHERE silica_sto_balance > 0
                OR silica_sto_staked  > 0
                OR silica_balance     > 0
            UNION
            SELECT address FROM balances WHERE usdt > 0
         ) AS combined"
    ) ?? 0);

    // 자산별 합계.
    $totalSto       = (float)(DB::fetchValue("SELECT COALESCE(SUM(silica_sto_balance), 0) FROM holdings") ?? 0);
    $totalStoStaked = (float)(DB::fetchValue("SELECT COALESCE(SUM(silica_sto_staked), 0)  FROM holdings") ?? 0);
    $totalSilica    = (float)(DB::fetchValue("SELECT COALESCE(SUM(silica_balance), 0)     FROM holdings") ?? 0);
    $totalUsdt      = (float)(DB::fetchValue("SELECT COALESCE(SUM(usdt), 0)               FROM balances") ?? 0);

    // 미수령 이자 (interest_claims.claimed_at IS NULL).
    $pendingInterest = 0.0;
    try {
        $pendingInterest = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(amount_usdt), 0) FROM interest_claims WHERE claimed_at IS NULL"
        ) ?? 0);
    } catch (Throwable $_) {}

    // 미수령 배당 (dividend_payouts.status = 'pending').
    $pendingDividendSilica = 0.0;
    try {
        $pendingDividendSilica = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(silica_amount), 0) FROM dividend_payouts WHERE status = 'pending'"
        ) ?? 0);
    } catch (Throwable $_) {}

    // (v412) 미수령 추천 보너스 (referral_bonus_payouts.status = 'pending').
    $pendingReferralUsdt = 0.0;
    try {
        $pendingReferralUsdt = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(bonus_usdt), 0) FROM referral_bonus_payouts WHERE status = 'pending'"
        ) ?? 0);
    } catch (Throwable $_) {}

    jsonOk([
        'active_users' => $activeUsers,
        'totals' => [
            'silica_sto_balance' => $totalSto,
            'silica_sto_staked'  => $totalStoStaked,
            'silica_balance'     => $totalSilica,
            'usdt_balance'       => $totalUsdt,
        ],
        'pending_rewards' => [
            'interest_usdt'        => $pendingInterest,
            'dividend_silica'      => $pendingDividendSilica,
            'referral_bonus_usdt'  => $pendingReferralUsdt,
        ],
        'fetched_at' => date('Y-m-d H:i:s'),
    ]);
});

// ------------------------------------------------------------------
// GET /api/admin/silica/winddown/preview/users  (v405)
// 사용자별 미회수 자금 세부 — 페이지네이션 + 부분 주소 검색.
// 미리보기 카드의 [세부 보기] 모달이 호출.
// ------------------------------------------------------------------
get('/api/admin/silica/winddown/preview/users', function () {
    adminOnly();
    ensureSilicaWinddownTable();

    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 20)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    $address = trim((string)($_GET['address'] ?? ''));

    $addrFilter = '';
    $params     = [];
    if ($address !== '') {
        // partial match — interest-log / dividend payout-log 와 동일 패턴.
        $addrFilter = "AND c.addr LIKE ?";
        $params[]   = '%' . $address . '%';
    }

    // 활성 사용자 union (holdings 또는 balances 둘 중 하나라도 잔액 있는 address).
    $unionSql = "
        SELECT DISTINCT addr FROM (
            SELECT address AS addr FROM holdings
             WHERE silica_sto_balance > 0
                OR silica_sto_staked  > 0
                OR silica_balance     > 0
            UNION
            SELECT address AS addr FROM balances WHERE usdt > 0
        ) u
    ";

    // 사용자별 데이터 — holdings 가 multi-row 인 경우 대비 SUM (단일 자산이면 무영향).
    $sql = "
        SELECT
            c.addr                                       AS address,
            COALESCE(h.silica_sto_balance, 0)            AS silica_sto_balance,
            COALESCE(h.silica_sto_staked, 0)             AS silica_sto_staked,
            COALESCE(h.silica_balance, 0)                AS silica_balance,
            COALESCE(b.usdt, 0)                          AS usdt_balance,
            COALESCE(pi.pending_interest, 0)             AS pending_interest_usdt,
            COALESCE(pd.pending_dividend, 0)             AS pending_dividend_silica
        FROM (
            {$unionSql}
        ) c
        LEFT JOIN (
            SELECT address,
                   SUM(silica_sto_balance) AS silica_sto_balance,
                   SUM(silica_sto_staked)  AS silica_sto_staked,
                   SUM(silica_balance)     AS silica_balance
              FROM holdings
             GROUP BY address
        ) h ON h.address = c.addr
        LEFT JOIN balances b ON b.address = c.addr
        LEFT JOIN (
            SELECT address, SUM(amount_usdt) AS pending_interest
              FROM interest_claims
             WHERE claimed_at IS NULL
             GROUP BY address
        ) pi ON pi.address = c.addr
        LEFT JOIN (
            SELECT address, SUM(silica_amount) AS pending_dividend
              FROM dividend_payouts
             WHERE status = 'pending'
             GROUP BY address
        ) pd ON pd.address = c.addr
        WHERE 1=1 {$addrFilter}
        ORDER BY usdt_balance DESC, silica_sto_balance DESC, silica_sto_staked DESC
        LIMIT {$limit} OFFSET {$offset}
    ";

    $rows  = [];
    $total = 0;
    try {
        $rows  = DB::fetchAll($sql, $params);
        $total = (int)(DB::fetchValue(
            "SELECT COUNT(*) FROM ({$unionSql}) c WHERE 1=1 {$addrFilter}",
            $params
        ) ?? 0);
    } catch (Throwable $e) {
        error_log('[winddown preview/users] ' . $e->getMessage());
        jsonError(500, '사용자별 세부 조회 실패: ' . $e->getMessage());
    }

    jsonOk([
        'rows' => $rows,
        'pagination' => [
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset,
            'has_more' => ($offset + $limit) < $total,
        ],
    ]);
});

// ------------------------------------------------------------------
// GET /api/admin/silica/winddown/preview/export  (v405)
// 사용자별 미회수 자금을 CSV 다운로드 (UTF-8 BOM 포함 — Excel 호환).
// 전체 활성 사용자 (페이지네이션 없음).
// ------------------------------------------------------------------
get('/api/admin/silica/winddown/preview/export', function () {
    adminOnly();
    ensureSilicaWinddownTable();

    $unionSql = "
        SELECT DISTINCT addr FROM (
            SELECT address AS addr FROM holdings
             WHERE silica_sto_balance > 0
                OR silica_sto_staked  > 0
                OR silica_balance     > 0
            UNION
            SELECT address AS addr FROM balances WHERE usdt > 0
        ) u
    ";
    $sql = "
        SELECT
            c.addr                                       AS address,
            COALESCE(h.silica_sto_balance, 0)            AS silica_sto_balance,
            COALESCE(h.silica_sto_staked, 0)             AS silica_sto_staked,
            COALESCE(h.silica_balance, 0)                AS silica_balance,
            COALESCE(b.usdt, 0)                          AS usdt_balance,
            COALESCE(pi.pending_interest, 0)             AS pending_interest_usdt,
            COALESCE(pd.pending_dividend, 0)             AS pending_dividend_silica
        FROM (
            {$unionSql}
        ) c
        LEFT JOIN (
            SELECT address,
                   SUM(silica_sto_balance) AS silica_sto_balance,
                   SUM(silica_sto_staked)  AS silica_sto_staked,
                   SUM(silica_balance)     AS silica_balance
              FROM holdings
             GROUP BY address
        ) h ON h.address = c.addr
        LEFT JOIN balances b ON b.address = c.addr
        LEFT JOIN (
            SELECT address, SUM(amount_usdt) AS pending_interest
              FROM interest_claims
             WHERE claimed_at IS NULL
             GROUP BY address
        ) pi ON pi.address = c.addr
        LEFT JOIN (
            SELECT address, SUM(silica_amount) AS pending_dividend
              FROM dividend_payouts
             WHERE status = 'pending'
             GROUP BY address
        ) pd ON pd.address = c.addr
        ORDER BY usdt_balance DESC, silica_sto_balance DESC, silica_sto_staked DESC
    ";

    $rows = [];
    try {
        $rows = DB::fetchAll($sql);
    } catch (Throwable $e) {
        error_log('[winddown preview/export] ' . $e->getMessage());
        jsonError(500, 'CSV 내보내기 실패: ' . $e->getMessage());
    }

    // CSV 응답 헤더 — Excel 호환 (UTF-8 BOM).
    $filename = 'winddown_preview_' . date('Ymd_His') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');

    echo "\xEF\xBB\xBF"; // UTF-8 BOM
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        '지갑 주소',
        'SilicaSTO 보유',
        'SilicaSTO 스테이킹',
        'Silica 보유',
        'USDT 잔액',
        '미수령 이자 (USDT)',
        '미수령 배당 (Silica)',
    ]);
    foreach ($rows as $r) {
        fputcsv($fp, [
            $r['address'] ?? '',
            (float)($r['silica_sto_balance'] ?? 0),
            (float)($r['silica_sto_staked'] ?? 0),
            (float)($r['silica_balance'] ?? 0),
            (float)($r['usdt_balance'] ?? 0),
            (float)($r['pending_interest_usdt'] ?? 0),
            (float)($r['pending_dividend_silica'] ?? 0),
        ]);
    }
    fclose($fp);
    exit;
});

// ------------------------------------------------------------------
// GET  /api/silica/closure-notice           (public)
// GET  /api/admin/silica/closure-notice     (admin 조회)
// POST /api/admin/silica/closure-notice     (admin 저장)
// 폐쇄 후 사용자가 보게 될 안내 페이지를 사전에 작성. state=closed 가
// 되면 user 측이 user/closed.html 로 전환되어 이 내용을 표시.
// ------------------------------------------------------------------
get('/api/silica/closure-notice', function () {
    $lang = strtolower(trim((string)($_GET['lang'] ?? 'en')));
    if ($lang !== 'ko' && $lang !== 'en') $lang = 'en';

    $titleKo = (string)(getSetting('closure_notice_title_ko', '') ?? '');
    $titleEn = (string)(getSetting('closure_notice_title_en', '') ?? '');
    $bodyKo  = (string)(getSetting('closure_notice_body_html_ko', '') ?? '');
    $bodyEn  = (string)(getSetting('closure_notice_body_html_en', '') ?? '');

    if ($lang === 'ko') {
        jsonOk([
            'lang'      => 'ko',
            'title'     => $titleKo !== '' ? $titleKo : $titleEn,
            'body_html' => $bodyKo  !== '' ? $bodyKo  : $bodyEn,
        ]);
    } else {
        jsonOk([
            'lang'      => 'en',
            'title'     => $titleEn !== '' ? $titleEn : $titleKo,
            'body_html' => $bodyEn  !== '' ? $bodyEn  : $bodyKo,
        ]);
    }
});

get('/api/admin/silica/closure-notice', function () {
    adminOnly();
    jsonOk([
        'notice' => [
            'title_ko' => (string)(getSetting('closure_notice_title_ko', '') ?? ''),
            'title_en' => (string)(getSetting('closure_notice_title_en', '') ?? ''),
            'body_ko'  => (string)(getSetting('closure_notice_body_html_ko', '') ?? ''),
            'body_en'  => (string)(getSetting('closure_notice_body_html_en', '') ?? ''),
        ],
    ]);
});

post('/api/admin/silica/closure-notice', function () {
    $admin = adminAuth();
    $body  = getJsonBody();

    $titleKo = trim((string)($body['title_ko'] ?? ''));
    $titleEn = trim((string)($body['title_en'] ?? ''));
    $bodyKo  = (string)($body['body_ko'] ?? '');
    $bodyEn  = (string)($body['body_en'] ?? '');

    setSetting('closure_notice_title_ko',     $titleKo);
    setSetting('closure_notice_title_en',     $titleEn);
    setSetting('closure_notice_body_html_ko', $bodyKo);
    setSetting('closure_notice_body_html_en', $bodyEn);

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
         VALUES ('winddown', 'closure_notice_update', ?, NULL, ?)",
        [$admin['username'], json_encode(['title_ko' => $titleKo, 'title_en' => $titleEn])]
    );

    jsonOk(['ok' => true]);
});

// ------------------------------------------------------------------
// POST /api/admin/silica/winddown/begin
// wind-down 시작 — active → winding_down. announced_at 기록.
// ------------------------------------------------------------------
post('/api/admin/silica/winddown/begin', function () {
    $admin = adminAuth();
    ensureSilicaWinddownTable();
    $body = getJsonBody();
    $reason = trim((string)($body['reason'] ?? ''));

    $row = silicaWinddownGetRow();
    if (($row['state'] ?? '') !== 'active') {
        jsonError('현재 상태에서는 wind-down 을 시작할 수 없습니다 (active 가 아님).', 409);
    }

    DB::execute(
        "UPDATE silica_winddown_state
            SET state = 'winding_down',
                announced_at = NOW(),
                reason = ?,
                updated_by = ?
          WHERE id = ?",
        [$reason !== '' ? $reason : null, $admin['username'], (int)$row['id']]
    );

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
         VALUES ('winddown', 'winddown_begin', ?, ?, ?)",
        [$admin['username'], (int)$row['id'], json_encode(['reason' => $reason])]
    );

    jsonOk(['ok' => true, 'state' => 'winding_down']);
});

// ------------------------------------------------------------------
// POST /api/admin/silica/winddown/set-amm
// AMM 활성 / 매수 시세 / USDT 유동성 설정. 매번 호출이 그 시점의 설정으로
// 덮어쓰기 (운영자가 시세 조정 + 유동성 추가 가능).
// ------------------------------------------------------------------
post('/api/admin/silica/winddown/set-amm', function () {
    $admin = adminAuth();
    ensureSilicaWinddownTable();
    $body = getJsonBody();

    $enabled   = !empty($body['enabled']);
    $price     = (float)($body['buy_price_usdt'] ?? 0);
    $liquidity = (float)($body['liquidity_usdt'] ?? 0);

    if ($enabled && $price <= 0) {
        jsonError('AMM 매수 시세는 0 보다 커야 합니다.', 400);
    }
    if ($enabled && $liquidity < 0) {
        jsonError('AMM USDT 유동성은 0 이상이어야 합니다.', 400);
    }

    $row = silicaWinddownGetRow();
    if (($row['state'] ?? '') === 'active') {
        jsonError('wind-down 이 시작되지 않은 상태에서는 AMM 을 설정할 수 없습니다.', 409);
    }

    DB::execute(
        "UPDATE silica_winddown_state
            SET amm_enabled        = ?,
                amm_buy_price_usdt = ?,
                amm_liquidity_usdt = ?,
                updated_by         = ?
          WHERE id = ?",
        [
            $enabled ? 1 : 0,
            $enabled ? $price : null,
            $enabled ? $liquidity : 0,
            $admin['username'],
            (int)$row['id'],
        ]
    );

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
         VALUES ('winddown', 'winddown_set_amm', ?, ?, ?)",
        [
            $admin['username'],
            (int)$row['id'],
            json_encode(['enabled' => $enabled, 'price' => $price, 'liquidity' => $liquidity]),
        ]
    );

    jsonOk(['ok' => true]);
});

// ------------------------------------------------------------------
// POST /api/admin/silica/winddown/set-deadline
// 출금 마감일 설정. 총 wind-down 기간 ≤ 2개월 검증.
// 입력 형식: 'YYYY-MM-DD' (자정 23:59:59 자동 적용) 또는 'YYYY-MM-DD HH:MM:SS'.
// ------------------------------------------------------------------
post('/api/admin/silica/winddown/set-deadline', function () {
    $admin = adminAuth();
    ensureSilicaWinddownTable();
    $body = getJsonBody();

    $deadline = trim((string)($body['withdrawal_deadline'] ?? ''));
    if ($deadline === '') {
        jsonError('withdrawal_deadline 은 필수입니다.', 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/', $deadline)) {
        jsonError('withdrawal_deadline 형식이 올바르지 않습니다 (YYYY-MM-DD 또는 YYYY-MM-DD HH:MM:SS).', 400);
    }

    $row = silicaWinddownGetRow();
    if (($row['state'] ?? '') === 'active') {
        jsonError('wind-down 이 시작되지 않은 상태에서는 마감일을 설정할 수 없습니다.', 409);
    }
    if (($row['state'] ?? '') === 'closed') {
        jsonError('이미 종료된 상태에서는 마감일을 변경할 수 없습니다.', 409);
    }

    $deadlineFull = strlen($deadline) === 10 ? ($deadline . ' 23:59:59') : $deadline;

    // 2개월 한도 검증 (announced_at 기준).
    if (!empty($row['announced_at'])) {
        try {
            $announced   = new DateTimeImmutable($row['announced_at']);
            $maxDeadline = $announced->modify('+2 months');
            $deadlineDT  = new DateTimeImmutable($deadlineFull);
            if ($deadlineDT > $maxDeadline) {
                jsonError(
                    '출금 마감일은 wind-down 시작일 (' . $announced->format('Y-m-d')
                    . ') 로부터 2개월 이내여야 합니다. 최대: '
                    . $maxDeadline->format('Y-m-d H:i:s'),
                    400
                );
            }
        } catch (Throwable $e) {
            jsonError('날짜 처리 오류: ' . $e->getMessage(), 400);
        }
    }

    DB::execute(
        "UPDATE silica_winddown_state
            SET withdrawal_deadline = ?,
                updated_by          = ?
          WHERE id = ?",
        [$deadlineFull, $admin['username'], (int)$row['id']]
    );

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
         VALUES ('winddown', 'winddown_set_deadline', ?, ?, ?)",
        [$admin['username'], (int)$row['id'], json_encode(['withdrawal_deadline' => $deadlineFull])]
    );

    jsonOk(['ok' => true, 'withdrawal_deadline' => $deadlineFull]);
});

// ------------------------------------------------------------------
// POST /api/admin/silica/winddown/disable-staking
// 강제 언스테이킹 — 모든 staker 의 staked → balance 이동. 14~16일 차단.
// 확인 문구 '스테이킹 중단' 필수.
// ------------------------------------------------------------------
post('/api/admin/silica/winddown/disable-staking', function () {
    $admin = adminAuth();
    ensureSilicaWinddownTable();
    $body = getJsonBody();
    $confirm = trim((string)($body['confirm_text'] ?? ''));

    if ($confirm !== '스테이킹 중단') {
        jsonError('확인 문구가 일치하지 않습니다. 정확히 "스테이킹 중단" 을 입력하세요.', 400);
    }

    // 14~16일 KST 스테이킹 락 윈도우 차단.
    $today = (int)(new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul')))->format('j');
    $lockDays = defined('STAKING_LOCK_DAYS') ? STAKING_LOCK_DAYS : [14, 15, 16];
    if (in_array($today, $lockDays, true)) {
        jsonError(
            '스테이킹 락 윈도우 기간 (매월 ' . implode('~', [min($lockDays), max($lockDays)])
            . '일 KST) 에는 강제 언스테이킹을 실행할 수 없습니다. 17일 이후 다시 시도하세요.',
            423
        );
    }

    $row = silicaWinddownGetRow();
    // (v400) state 검증 완화 — admin/settings.html#winddown 의 4단계가
    //   1단계 (begin) 없이 바로 실행되는 흐름. state=active 면 자동으로
    //   winding_down 으로 전환 (announced_at = NOW). closed 만 거부.
    if (($row['state'] ?? '') === 'closed') {
        jsonError('이미 영구 폐쇄된 상태에서는 스테이킹 중단을 실행할 수 없습니다.', 409);
    }
    // (2026-05-18 v463/v465 → v470) 운영자 결정: sweep propagation 버그가
    //   v465 에서 고쳐졌으므로 1회만 실행 가능하도록 idempotency 재도입.
    //   재실행은 의도된 운영 시나리오가 아니며, staking 자체가 silicaIs-
    //   StakingDisabled() 가드로 시스템에서 차단되어 신규 stake 가 불가.
    //   정말 강제 재실행이 필요한 경우 body 에 force_resweep=true 를 명시
    //   적으로 전달 (UI 상 노출 없음 — 운영자가 curl 등으로 직접 호출).
    $forceResweep = !empty($body['force_resweep']);
    if (!empty($row['staking_disabled_at']) && !$forceResweep) {
        jsonError(
            '이미 스테이킹 중단이 실행되었습니다 (' . $row['staking_disabled_at'] . '). '
            . '신규 스테이킹은 시스템에서 차단되므로 재실행 불필요합니다.',
            409
        );
    }
    $isReSweep = !empty($row['staking_disabled_at']); // force_resweep=true 인 경우만 true

    $autoTransitionToWindingDown = (($row['state'] ?? '') === 'active');

    $pdo = DB::get();
    $pdo->beginTransaction();
    try {
        // 모든 staker 조회 — FOR UPDATE 로 lock.
        // (v465) legacy 컬럼 staked_token 도 함께 검사. 일부 holdings 가
        //   silica_sto_staked=0 이지만 staked_token>0 인 경우 (migration
        //   누락) 강제 언스테이킹 대상에서 빠지던 버그 수정.
        $stakers = DB::fetchAll(
            "SELECT address,
                    silica_sto_staked,
                    COALESCE(staked_token, 0) AS staked_token
               FROM holdings
              WHERE silica_sto_staked > 0
                 OR COALESCE(staked_token, 0) > 0
              FOR UPDATE"
        );

        $unstakeCount  = 0;
        $totalUnstaked = 0.0;
        // (v465) 처리된 사용자 sample (최대 5명) 마스킹하여 응답에 포함 — 운영자가
        //   특정 wallet 포함 여부 즉시 확인 가능.
        $sampleAddrs = [];
        // (v465) 추가 검증: legacy staked_token 도 함께 0 으로 set (사용자 페이지
        //   는 silica_sto_staked 사용하지만 일관성 보장).
        foreach ($stakers as $h) {
            $addr        = $h['address'];
            $stakedNew   = (float)$h['silica_sto_staked'];
            $stakedLegacy = (float)$h['staked_token'];
            // (v465) 두 컬럼 중 최대값을 신뢰 — 둘 다 동기화 되어있어야 하지만
            //   부분 migration 시나리오 보호.
            $staked = max($stakedNew, $stakedLegacy);
            if ($staked <= 0) continue;

            DB::execute(
                "UPDATE holdings
                    SET silica_sto_balance = COALESCE(silica_sto_balance, 0) + ?,
                        silica_sto_staked  = 0,
                        staked_token       = 0,
                        balance_token      = COALESCE(balance_token, 0) + ?,
                        updated_at         = NOW()
                  WHERE address = ?",
                [$staked, $staked, $addr]
            );
            if (count($sampleAddrs) < 5) {
                $sampleAddrs[] = [
                    'address_short' => substr($addr, 0, 6) . '...' . substr($addr, -4),
                    'unstaked'      => $staked,
                ];
            }

            // (v395) 유저 거래 내역에도 기록 — user 히스토리에 노출.
            try {
                DB::execute(
                    "INSERT INTO wallet_transactions(address, kind, status, asset, amount, before_amount, after_amount, memo, created_at)
                     VALUES (?, 'force_unstake', '완료', 'SilicaSTO', ?, ?, 0, ?, " . (function_exists('nowUtcSql') ? 'NOW()' : 'NOW()') . ")",
                    [$addr, $staked, $staked, '운영 종료에 따른 강제 언스테이킹 (관리자: ' . ($admin['username'] ?? '-') . ')']
                );
            } catch (Throwable $txLogErr) {
                error_log('wallet_transactions force_unstake log failed: ' . $txLogErr->getMessage());
            }

            DB::execute(
                "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
                 VALUES ('winddown', 'force_unstake', ?, ?, ?)",
                [$admin['username'], $addr, json_encode(['amount' => $staked])]
            );

            $unstakeCount++;
            $totalUnstaked += $staked;
        }

        // (v400) state=active 였으면 winding_down 으로 자동 전환 + announced_at = NOW.
        if ($autoTransitionToWindingDown) {
            DB::execute(
                "UPDATE silica_winddown_state
                    SET state               = 'winding_down',
                        announced_at        = NOW(),
                        staking_disabled_at = NOW(),
                        updated_by          = ?
                  WHERE id = ?",
                [$admin['username'], (int)$row['id']]
            );
            DB::execute(
                "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
                 VALUES ('winddown', 'winddown_auto_begin', ?, ?, ?)",
                [$admin['username'], (int)$row['id'], json_encode(['triggered_by' => 'disable_staking', 'note' => 'state=active 였으나 4단계 실행으로 자동 전환'])]
            );
        } else {
            DB::execute(
                "UPDATE silica_winddown_state
                    SET staking_disabled_at = NOW(),
                        updated_by          = ?
                  WHERE id = ?",
                [$admin['username'], (int)$row['id']]
            );
        }

        DB::execute(
            "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
             VALUES ('winddown', ?, ?, ?, ?)",
            [
                $isReSweep ? 'winddown_disable_staking_resweep' : 'winddown_disable_staking',
                $admin['username'],
                (int)$row['id'],
                json_encode([
                    'is_re_sweep'    => $isReSweep,
                    'unstake_count'  => $unstakeCount,
                    'total_unstaked' => $totalUnstaked,
                ]),
            ]
        );

        $pdo->commit();

        jsonOk([
            'ok'             => true,
            'is_re_sweep'    => $isReSweep,
            'unstake_count'  => $unstakeCount,
            'total_unstaked' => $totalUnstaked,
            // (v465) 처리된 wallet sample (최대 5개, 마스킹) — 운영자가
            //   특정 wallet 포함 여부 즉시 확인 가능.
            'sample_addrs'   => $sampleAddrs,
            'note'           => $isReSweep
                ? 'Re-sweep 실행 — 이미 disabled 상태였으나 새로 staked 한 사용자(' . $unstakeCount . '명) 강제 unstake 완료.'
                : 'Initial disable-staking 실행 — 전체 staker(' . $unstakeCount . '명) 강제 unstake 완료.',
        ]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError('강제 언스테이킹 실패: ' . $e->getMessage(), 500);
    }
});

// ------------------------------------------------------------------
// POST /api/admin/silica/winddown/close
// 출금 마감일 후 사이트 영구 폐쇄. 미회수 자금은 회사 귀속 (참고용 합계만
// audit 에 기록 — 실제 holdings 잔액 zero-out 은 별도 작업).
// 확인 문구 '서비스 종료' 필수.
// ------------------------------------------------------------------
post('/api/admin/silica/winddown/close', function () {
    $admin = adminAuth();
    ensureSilicaWinddownTable();
    $body = getJsonBody();
    $confirm = trim((string)($body['confirm_text'] ?? ''));

    if ($confirm !== '서비스 종료') {
        jsonError('확인 문구가 일치하지 않습니다. 정확히 "서비스 종료" 를 입력하세요.', 400);
    }

    $row = silicaWinddownGetRow();
    // (v400) state 검증 완화 — settings.html#winddown 의 5단계가 4단계 없이도
    //   바로 실행 가능. 단 state=closed 면 이미 종료된 상태라 거부.
    //   withdrawal_deadline 검증 제거 — admin/settings.html UI 에 마감일
    //   설정 input 이 없음 (운영자가 공지로 안내). state 가 active 면
    //   winding_down 으로 자동 전환 후 closed 처리.
    if (($row['state'] ?? '') === 'closed') {
        jsonError('이미 영구 폐쇄된 상태입니다.', 409);
    }

    $autoTransitionToWindingDown = (($row['state'] ?? '') === 'active');

    // 미회수 자금 합계 (참고용 audit). 실제 zero-out 은 별도 작업으로 분리.
    // (v402) preview endpoint 와 동일한 항목 — 미수령 이자/배당도 포함.
    $remainingStoBalance = (float)(DB::fetchValue(
        "SELECT COALESCE(SUM(silica_sto_balance), 0) FROM holdings"
    ) ?? 0);
    $remainingStoStaked = (float)(DB::fetchValue(
        "SELECT COALESCE(SUM(silica_sto_staked), 0) FROM holdings"
    ) ?? 0);
    $remainingSilicaBalance = (float)(DB::fetchValue(
        "SELECT COALESCE(SUM(silica_balance), 0) FROM holdings"
    ) ?? 0);
    // (v403) usdt_balance 는 balances 테이블의 usdt 컬럼. holdings 가 아님.
    $remainingUsdtBalance = (float)(DB::fetchValue(
        "SELECT COALESCE(SUM(usdt), 0) FROM balances"
    ) ?? 0);
    $pendingInterestUsdt = 0.0;
    try {
        $pendingInterestUsdt = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(amount_usdt), 0) FROM interest_claims WHERE claimed_at IS NULL"
        ) ?? 0);
    } catch (Throwable $_) {}
    $pendingDividendSilica = 0.0;
    try {
        $pendingDividendSilica = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(silica_amount), 0) FROM dividend_payouts WHERE status = 'pending'"
        ) ?? 0);
    } catch (Throwable $_) {}
    // (v412) 미수령 추천 보너스 합계 — close audit 에 포함.
    $pendingReferralUsdt = 0.0;
    try {
        $pendingReferralUsdt = (float)(DB::fetchValue(
            "SELECT COALESCE(SUM(bonus_usdt), 0) FROM referral_bonus_payouts WHERE status = 'pending'"
        ) ?? 0);
    } catch (Throwable $_) {}

    // (v400) state=active 였으면 winding_down 단계 거치지 않고 바로 closed.
    //   announced_at 도 NOW 로 동시 기록 (audit 일관성).
    if ($autoTransitionToWindingDown) {
        DB::execute(
            "UPDATE silica_winddown_state
                SET state        = 'closed',
                    announced_at = NOW(),
                    updated_by   = ?
              WHERE id = ?",
            [$admin['username'], (int)$row['id']]
        );
        DB::execute(
            "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
             VALUES ('winddown', 'winddown_auto_begin', ?, ?, ?)",
            [$admin['username'], (int)$row['id'], json_encode(['triggered_by' => 'close', 'note' => 'state=active 였으나 5단계 실행으로 자동 전환 + 즉시 종료'])]
        );
    } else {
        DB::execute(
            "UPDATE silica_winddown_state
                SET state      = 'closed',
                    updated_by = ?
              WHERE id = ?",
            [$admin['username'], (int)$row['id']]
        );
    }

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
         VALUES ('winddown', 'winddown_close', ?, ?, ?)",
        [
            $admin['username'],
            (int)$row['id'],
            json_encode([
                'remaining_silica_sto_balance' => $remainingStoBalance,
                'remaining_silica_sto_staked'  => $remainingStoStaked,
                'remaining_silica_balance'     => $remainingSilicaBalance,
                'remaining_usdt_balance'       => $remainingUsdtBalance,
                'pending_interest_usdt'        => $pendingInterestUsdt,
                'pending_dividend_silica'      => $pendingDividendSilica,
                'pending_referral_bonus_usdt'  => $pendingReferralUsdt,
                'note'                         => '미회수 자금 회사 귀속 (약관 제10.5조)',
            ]),
        ]
    );

    jsonOk([
        'ok'                              => true,
        'state'                           => 'closed',
        'remaining_silica_sto_balance'    => $remainingStoBalance,
        'remaining_silica_sto_staked'     => $remainingStoStaked,
        'remaining_silica_balance'        => $remainingSilicaBalance,
        'remaining_usdt_balance'          => $remainingUsdtBalance,
        'pending_interest_usdt'           => $pendingInterestUsdt,
        'pending_dividend_silica'         => $pendingDividendSilica,
        'pending_referral_bonus_usdt'     => $pendingReferralUsdt,
    ]);
});
