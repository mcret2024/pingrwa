<?php
/**
 * Popup Announcements Management
 *
 * (2026-05-11 v276) Operator: '팝업 게시하면 팝업게시완료(API연동 대기중)
 * 이라고 나타난다 무슨 api를 대기하는것인가? 아울러 생성한 팝업은 삭제
 * 할 수 없나?' — backend was already wired (POST / GET / UPDATE /
 * DELETE), but the popup_announcements / popup_dismissals tables were
 * never created. Added ensurePopupTables() and invoke it at the top
 * of every endpoint so first-touch self-initializes the schema, same
 * pattern as ensureNoticesTable() in routes/notices.php.
 */

if (!function_exists('ensureSilicaAuditLog')) {
    function ensureSilicaAuditLog(): void {
        static $done = false;
        if ($done) return;
        DB::execute("
            CREATE TABLE IF NOT EXISTS silica_audit_log (
                id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
                category    VARCHAR(64)  NOT NULL,
                action      VARCHAR(64)  NOT NULL,
                actor       VARCHAR(128) NULL,
                target_id   VARCHAR(128) NULL,
                old_value   TEXT NULL,
                new_value   TEXT NULL,
                created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                INDEX idx_audit_cat (category, created_at),
                INDEX idx_audit_actor (actor, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $done = true;
    }
}

if (!function_exists('ensurePopupTables')) {
    function ensurePopupTables(): void {
        static $done = false;
        if ($done) return;
        ensureSilicaAuditLog();
        DB::execute("
            CREATE TABLE IF NOT EXISTS popup_announcements (
                id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
                type          VARCHAR(32)  NOT NULL DEFAULT 'general',
                title_ko      VARCHAR(255) NOT NULL,
                title_en      VARCHAR(255) NULL,
                body_ko       TEXT NOT NULL,
                body_en       TEXT NULL,
                audience      VARCHAR(32)  NOT NULL DEFAULT 'all',
                dismissable   TINYINT(1)   NOT NULL DEFAULT 1,
                start_at      DATETIME     NOT NULL,
                end_at        DATETIME     NOT NULL,
                status        VARCHAR(16)  NOT NULL DEFAULT 'active',
                auto_trigger  VARCHAR(64)  NULL,
                linked_id     INT UNSIGNED NULL,
                view_count    INT UNSIGNED NOT NULL DEFAULT 0,
                created_by    VARCHAR(128) NULL,
                created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                INDEX idx_popup_status (status, start_at, end_at),
                INDEX idx_popup_type (type),
                INDEX idx_popup_linked (auto_trigger, linked_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        // (2026-05-12 v314) Add linked_id column on existing deployments —
        //   admin_silica_dividend.php has been INSERT-ing into linked_id
        //   since the dividend popup feature shipped, but the original
        //   ensurePopupTables() schema never defined the column. Existing
        //   prod DBs would silently fail those INSERTs. Detect + ALTER.
        try {
            $cols = DB::fetchAll("SHOW COLUMNS FROM popup_announcements");
            $names = array_map(fn($c) => strtolower((string)($c['Field'] ?? '')), $cols);
            if (!in_array('linked_id', $names, true)) {
                DB::execute("ALTER TABLE popup_announcements
                             ADD COLUMN linked_id INT UNSIGNED NULL AFTER auto_trigger,
                             ADD INDEX idx_popup_linked (auto_trigger, linked_id)");
            }
        } catch (Throwable $e) {
            // 마이그레이션 실패해도 신규 row 는 ('dividend_exec', NULL) 로 저장됨.
        }
        DB::execute("
            CREATE TABLE IF NOT EXISTS popup_dismissals (
                popup_id       INT UNSIGNED NOT NULL,
                user_address   VARCHAR(64)  NOT NULL,
                dismiss_until  DATETIME     NOT NULL,
                dismissed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (popup_id, user_address),
                INDEX idx_pd_until (dismiss_until)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        // (2026-05-11 v277) Earlier deploy created popup_dismissals
        //   with user_id INT — the schema didn't match what authOptional()
        //   returns (a wallet address string). Detect the legacy column
        //   and migrate to user_address VARCHAR. No data to preserve —
        //   popups never displayed before this commit so nobody dismissed.
        try {
            $cols = DB::fetchAll("SHOW COLUMNS FROM popup_dismissals");
            $names = array_map(fn($c) => strtolower((string)($c['Field'] ?? '')), $cols);
            if (in_array('user_id', $names, true) && !in_array('user_address', $names, true)) {
                DB::execute("DROP TABLE popup_dismissals");
                DB::execute("
                    CREATE TABLE popup_dismissals (
                        popup_id       INT UNSIGNED NOT NULL,
                        user_address   VARCHAR(64)  NOT NULL,
                        dismiss_until  DATETIME     NOT NULL,
                        dismissed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (popup_id, user_address),
                        INDEX idx_pd_until (dismiss_until)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
            }
        } catch (Throwable $e) {
            // 컬럼 조회/이주 실패해도 활성 팝업 표시는 계속 — dismissal 기록만 누락.
        }
        $done = true;
    }
}

// ----------------------------------------------------------------
// GET /api/admin/silica/popups - 모든 팝업 목록
// ----------------------------------------------------------------
get('/api/admin/silica/popups', function () {
    adminOnly();
    ensurePopupTables();
    $status = $_GET['status'] ?? null;

    // (2026-05-18 v533) 운영자: 'popups.html 에서 수정 시 제목만 남고 본문이
    //   비워진다'. 원인: list 엔드포인트가 body_ko/body_en/linked_id 를
    //   SELECT 에 포함하지 않아 프론트 캐시 (_popupCache) 에 본문이 없음 →
    //   수정 모달 prefill 시 빈 값. 본 SELECT 에 body / linked_id 추가.
    //   list 응답 크기가 약간 늘어나지만 max 200건 제한이라 영향 미미.
    $sql = "SELECT id, type, title_ko, title_en, body_ko, body_en,
                   audience, dismissable, start_at, end_at, status,
                   auto_trigger, linked_id, view_count,
                   created_by, created_at, updated_at
            FROM popup_announcements";
    $params = [];
    if ($status) {
        $sql .= " WHERE status = ?";
        $params[] = $status;
    }
    $sql .= " ORDER BY created_at DESC LIMIT 200";

    $rows = DB::fetchAll($sql, $params);
    jsonOk(['popups' => $rows]);
});

// ----------------------------------------------------------------
// GET /api/admin/silica/popups/{id}
// ----------------------------------------------------------------
get('/api/admin/silica/popups/get', function () {
    adminOnly();
    ensurePopupTables();
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonError('id 필요', 400);

    $row = DB::fetchOne("SELECT * FROM popup_announcements WHERE id = ?", [$id]);
    if (!$row) jsonError('찾을 수 없음', 404);
    jsonOk(['popup' => $row]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/popups - 새 팝업 생성
// ----------------------------------------------------------------
post('/api/admin/silica/popups', function () {
    $admin = adminAuth();
    ensurePopupTables();
    $body = getJsonBody();

    $type = (string)($body['type'] ?? 'general');
    $titleKo = trim((string)($body['title_ko'] ?? ''));
    $titleEn = trim((string)($body['title_en'] ?? ''));
    $bodyKo = trim((string)($body['body_ko'] ?? ''));
    $bodyEn = trim((string)($body['body_en'] ?? ''));
    $audience = (string)($body['audience'] ?? 'all');
    $dismissable = !empty($body['dismissable']);
    $startAt = (string)($body['start_at'] ?? gmdate('Y-m-d H:i:s'));
    $endAt = (string)($body['end_at'] ?? '');

    // (2026-05-12 v314) Optional 배당 연결 — admin/dividend.html 의 별도
    //   팝업 카드가 가장 가까운 예정 배당 ID 를 linked_id 로 함께 전달한다.
    //   기존 INSERT 가 linked_id/auto_trigger 컬럼을 생략하던 점 보완.
    //   배당이 취소되면 admin_silica_dividend.php cancel 핸들러가
    //   auto_trigger='dividend_exec' AND linked_id=? 로 자동 expire.
    $linkedId   = isset($body['linked_id']) ? (int)$body['linked_id'] : 0;
    $autoTrigger = trim((string)($body['auto_trigger'] ?? ''));
    if ($linkedId > 0 && $autoTrigger === '' && $type === 'dividend') {
        // 명시 안 했지만 dividend + linked_id 있으면 표준 트리거 코드 부여
        $autoTrigger = 'dividend_exec';
    }

    if ($titleKo === '' || $bodyKo === '') {
        jsonError('한국어 제목과 본문은 필수입니다.', 400);
    }
    if ($endAt === '') {
        jsonError('종료일은 필수입니다.', 400);
    }
    if (!in_array($type, ['general', 'dividend', 'rate_change', 'maintenance', 'event'], true)) {
        jsonError('유효하지 않은 팝업 유형.', 400);
    }
    if (!in_array($audience, ['all', 'stakers', 'kyc_verified', 'custom'], true)) {
        jsonError('유효하지 않은 대상.', 400);
    }

    DB::execute(
        "INSERT INTO popup_announcements
         (type, title_ko, title_en, body_ko, body_en, audience, dismissable,
          start_at, end_at, status, auto_trigger, linked_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
        [
            $type, $titleKo, $titleEn ?: null, $bodyKo, $bodyEn ?: null,
            $audience, $dismissable ? 1 : 0, $startAt, $endAt,
            $autoTrigger !== '' ? $autoTrigger : null,
            $linkedId > 0 ? $linkedId : null,
            $admin['username'],
        ]
    );

    $newId = (int)DB::get()->lastInsertId();

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
         VALUES ('popup_create', 'popup_create', ?, ?, ?)",
        [
            $admin['username'], $newId,
            json_encode([
                'type' => $type, 'title' => $titleKo,
                'linked_id' => $linkedId > 0 ? $linkedId : null,
                'auto_trigger' => $autoTrigger !== '' ? $autoTrigger : null,
            ]),
        ]
    );

    jsonOk(['ok' => true, 'id' => $newId, 'linked_id' => $linkedId > 0 ? $linkedId : null]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/popups/update
// ----------------------------------------------------------------
post('/api/admin/silica/popups/update', function () {
    $admin = adminAuth();
    ensurePopupTables();
    $body = getJsonBody();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) jsonError('id 필요', 400);

    $row = DB::fetchOne("SELECT * FROM popup_announcements WHERE id = ?", [$id]);
    if (!$row) jsonError('찾을 수 없음', 404);

    $fields = [];
    $params = [];
    foreach (['type', 'title_ko', 'title_en', 'body_ko', 'body_en', 'audience', 'start_at', 'end_at', 'status'] as $f) {
        if (isset($body[$f])) {
            $fields[] = "$f = ?";
            $params[] = $body[$f];
        }
    }
    if (isset($body['dismissable'])) {
        $fields[] = "dismissable = ?";
        $params[] = !empty($body['dismissable']) ? 1 : 0;
    }
    if (empty($fields)) jsonError('변경할 필드가 없습니다.', 400);

    $params[] = $id;
    DB::execute("UPDATE popup_announcements SET " . implode(', ', $fields) . " WHERE id = ?", $params);

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id, new_value)
         VALUES ('popup_update', 'popup_update', ?, ?, ?)",
        [$admin['username'], $id, json_encode($body)]
    );

    jsonOk(['ok' => true]);
});

// ----------------------------------------------------------------
// POST /api/admin/silica/popups/delete
// ----------------------------------------------------------------
post('/api/admin/silica/popups/delete', function () {
    $admin = adminAuth();
    ensurePopupTables();
    $body = getJsonBody();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) jsonError('id 필요', 400);

    DB::execute("DELETE FROM popup_announcements WHERE id = ?", [$id]);

    DB::execute(
        "INSERT INTO silica_audit_log (category, action, actor, target_id)
         VALUES ('popup_delete', 'popup_delete', ?, ?)",
        [$admin['username'], $id]
    );

    jsonOk(['ok' => true]);
});

// ----------------------------------------------------------------
// GET /api/silica/popups/active - 사용자가 볼 활성 팝업
// ----------------------------------------------------------------
get('/api/silica/popups/active', function () {
    ensurePopupTables();
    // (2026-05-11 v277) Wallet/JWT 가 있으면 사용자별 dismiss 필터링.
    //   없는 게스트는 익명 조회 — 게스트는 클라이언트 측 localStorage
    //   로 '오늘 하루 보지 않기' 가 처리됨 (silica-popups.js 참조).
    //   기존 코드는 존재하지 않는 userAuth() 를 호출해 fatal 이었음 →
    //   authOptional() 로 교체.
    $userAddr = null;
    try {
        $u = authOptional();
        $userAddr = $u['address'] ?? null;
    } catch (Throwable $e) {
        $userAddr = null;
    }

    $now = gmdate('Y-m-d H:i:s');

    $rows = DB::fetchAll(
        "SELECT id, type, title_ko, title_en, body_ko, body_en, audience, dismissable, start_at, end_at
         FROM popup_announcements
         WHERE status = 'active' AND start_at <= ? AND end_at >= ?
         ORDER BY start_at ASC",
        [$now, $now]
    );

    // 닫힘 처리된 팝업 필터링 (오늘 하루 보지 않기)
    if ($userAddr) {
        $dismissed = DB::fetchAll(
            "SELECT popup_id FROM popup_dismissals
             WHERE user_address = ? AND dismiss_until > ?",
            [$userAddr, $now]
        );
        $dismissedIds = array_column($dismissed, 'popup_id');
        $rows = array_filter($rows, fn($r) => !in_array((int)$r['id'], $dismissedIds, true));
        $rows = array_values($rows);
    }

    // (2026-05-18 v531) 운영자 진단 — 빈 응답 시 원인 파악용. 모든 popup
    //   row 의 status / start_at / end_at 을 노출하여 어느 조건이
    //   불만족인지 즉시 확인.
    $debugAll = [];
    try {
        $debugAll = DB::fetchAll(
            "SELECT id, status, start_at, end_at, type, title_ko
               FROM popup_announcements
              ORDER BY id DESC LIMIT 20"
        );
    } catch (Throwable $_) {}

    jsonOk([
        'popups' => $rows,
        '_diag' => [
            'now_utc'     => $now,
            'returned'    => count($rows),
            'all_popups'  => $debugAll,
            'filter_rule' => "status='active' AND start_at <= now_utc AND end_at >= now_utc",
        ],
    ]);
});

// ----------------------------------------------------------------
// POST /api/silica/popups/dismiss - 사용자가 "오늘 하루 보지 않기" 클릭
// ----------------------------------------------------------------
post('/api/silica/popups/dismiss', function () {
    // (2026-05-11 v277) authRequired() 로 교체 — userAuth() 미정의로
    //   기존 호출은 fatal. 인증 안 된 사용자는 401 받고 클라이언트가
    //   localStorage 폴백으로 dismiss 기록.
    $u = authRequired();
    ensurePopupTables();
    $body = getJsonBody();
    $popupId = (int)($body['popup_id'] ?? 0);
    if ($popupId <= 0) jsonError('popup_id 필요', 400);

    $addr = trim((string)($u['address'] ?? ''));
    if ($addr === '') jsonError('주소가 확인되지 않습니다.', 400);

    // 오늘 자정까지
    $tonight = gmdate('Y-m-d 23:59:59');

    DB::execute(
        "INSERT INTO popup_dismissals (popup_id, user_address, dismiss_until)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE dismiss_until = VALUES(dismiss_until), dismissed_at = NOW()",
        [$popupId, $addr, $tonight]
    );

    // 조회수 카운트
    DB::execute("UPDATE popup_announcements SET view_count = view_count + 1 WHERE id = ?", [$popupId]);

    jsonOk(['ok' => true]);
});
