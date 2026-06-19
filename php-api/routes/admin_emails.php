<?php
/**
 * Admin bulk email broadcasts
 *
 * - GET  /api/admin/emails/recipients  : 필터별 수신자 수 & 샘플
 * - POST /api/admin/emails/preview     : 발송 대상 미리보기 (실제 발송 X)
 * - POST /api/admin/emails/send        : 단체 메일 발송 (lazy shutdown trigger)
 * - GET  /api/admin/emails/list        : 발송 이력
 * - GET  /api/admin/emails/detail      : 개별 브로드캐스트 상세 + 로그
 */

if (!function_exists('ensureEmailBroadcastsSchema')) {
    function ensureEmailBroadcastsSchema(): bool {
        static $ok = null;
        if ($ok !== null) return $ok;
        try {
            $row = DB::fetchOne("SHOW TABLES LIKE 'email_broadcasts'");
            if ($row) { $ok = true; return true; }
        } catch (Throwable $e) {}
        try {
            if (function_exists('applyPendingMigrations')) {
                applyPendingMigrations(false);
            }
            $row = DB::fetchOne("SHOW TABLES LIKE 'email_broadcasts'");
            $ok = !empty($row);
            return $ok;
        } catch (Throwable $e) {
            error_log('[admin_emails] migration failed: ' . $e->getMessage());
            $ok = false;
            return false;
        }
    }
}

if (!function_exists('adminEmailClientIp')) {
    function adminEmailClientIp(): string {
        // 프록시 뒤 배포 가능성 감안 (호스팅어는 단일 노드지만 향후 대비)
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $k) {
            $v = $_SERVER[$k] ?? '';
            if ($v !== '') {
                $ip = explode(',', (string)$v)[0] ?? '';
                $ip = trim($ip);
                if ($ip !== '') return substr($ip, 0, 64);
            }
        }
        return 'unknown';
    }
}

if (!function_exists('adminEmailEnforceRateLimit')) {
    /**
     * 관리자당 rate limit:
     *  - 최근 60분 내 5회 초과 발송 차단
     *  - 최근 10초 이내 연속 발송 차단 (더블클릭/스크립트 봇 대응)
     */
    function adminEmailEnforceRateLimit(string $adminUsername): void {
        try {
            $recentCount = (int)DB::fetchValue(
                "SELECT COUNT(*) FROM email_broadcasts
                 WHERE created_by=? AND created_at >= (UTC_TIMESTAMP() - INTERVAL 60 MINUTE)",
                [$adminUsername]
            );
            if ($recentCount >= 5) {
                jsonError(429, '최근 60분 내 발송 횟수 상한(5회)을 초과했습니다. 잠시 후 다시 시도하세요.');
            }
            $lastAt = DB::fetchValue(
                "SELECT created_at FROM email_broadcasts
                 WHERE created_by=? ORDER BY id DESC LIMIT 1",
                [$adminUsername]
            );
            if ($lastAt) {
                $last = strtotime((string)$lastAt . ' UTC');
                if ($last && (time() - $last) < 10) {
                    jsonError(429, '직전 발송 후 10초 이내에는 다시 발송할 수 없습니다.');
                }
            }
        } catch (Throwable $e) {
            // rate limit 조회 실패는 차단하지 않음 (DB 일시 오류 대응)
            error_log('[admin_emails] rate limit check error: ' . $e->getMessage());
        }
    }
}

if (!function_exists('adminEmailFetchRecipients')) {
    /**
     * filter_type에 따라 수신자 목록 반환 (verified 이메일만).
     *
     * @param string $filterType
     *   - 'all_verified'    : 인증된 이메일 보유 전체
     *   - 'stakers'         : 스테이킹 보유자
     *   - 'funders'         : 1회 이상 모금 참여
     *   - 'specific'        : $addresses 배열로 지정
     * @param array $addresses (filter_type=specific 일 때)
     * @return array [{address, email}, ...]
     */
    function adminEmailFetchRecipients(string $filterType, array $addresses = []): array {
        $filterType = in_array($filterType, ['all_verified', 'stakers', 'funders', 'specific'], true)
            ? $filterType : 'all_verified';

        switch ($filterType) {
            case 'stakers':
                return DB::fetchAll(
                    "SELECT DISTINCT u.address, u.email
                     FROM users u
                     INNER JOIN holdings h ON h.address = u.address
                     WHERE u.email IS NOT NULL
                       AND u.email_verified_at IS NOT NULL
                       AND h.staked_token > 0"
                );

            case 'funders':
                return DB::fetchAll(
                    "SELECT DISTINCT u.address, u.email
                     FROM users u
                     INNER JOIN funding_records fr ON fr.address = u.address
                     WHERE u.email IS NOT NULL
                       AND u.email_verified_at IS NOT NULL"
                );

            case 'specific':
                $addresses = array_values(array_filter(array_map('strval', $addresses ?: [])));
                if (!$addresses) return [];
                $addresses = array_slice($addresses, 0, 5000);
                $placeholders = implode(',', array_fill(0, count($addresses), '?'));
                return DB::fetchAll(
                    "SELECT u.address, u.email
                     FROM users u
                     WHERE u.address IN ({$placeholders})
                       AND u.email IS NOT NULL
                       AND u.email_verified_at IS NOT NULL",
                    $addresses
                );

            case 'all_verified':
            default:
                return DB::fetchAll(
                    "SELECT address, email
                     FROM users
                     WHERE email IS NOT NULL
                       AND email_verified_at IS NOT NULL"
                );
        }
    }
}

if (!function_exists('adminEmailSanitizeHtml')) {
    function adminEmailSanitizeHtml(string $html): string {
        // 위험한 태그 제거 (script/iframe/object/embed/style + on이벤트)
        $html = preg_replace('#<(script|iframe|object|embed|style)[^>]*>.*?</\1>#is', '', $html);
        $html = preg_replace('#<(script|iframe|object|embed|style|link|meta)[^>]*/?>#i', '', $html);
        $html = preg_replace('#\son[a-z]+\s*=\s*(["\']).*?\1#i', '', $html);
        $html = preg_replace('#javascript:#i', '', $html);
        return $html;
    }
}

get('/api/admin/emails/recipients', function () {
    adminAuth();
    if (!ensureEmailBroadcastsSchema()) jsonError(503, '이메일 기능 초기화 중');

    $filter = trim($_GET['filter'] ?? 'all_verified');
    $addressesRaw = $_GET['addresses'] ?? '';
    $addresses = array_values(array_filter(array_map('trim', preg_split('/[\s,;]+/', (string)$addressesRaw))));

    $rows = adminEmailFetchRecipients($filter, $addresses);
    $total = count($rows);
    $sample = array_slice($rows, 0, 10);

    jsonOk([
        'filter'  => $filter,
        'total'   => $total,
        'sample'  => $sample,
    ]);
});

post('/api/admin/emails/preview', function () {
    adminAuth();
    if (!ensureEmailBroadcastsSchema()) jsonError(503, '이메일 기능 초기화 중');

    $body = getJsonBody();
    $subject = trim((string)($body['subject'] ?? ''));
    $bodyHtml = (string)($body['body_html'] ?? '');
    $filter = trim((string)($body['filter'] ?? 'all_verified'));
    $addresses = is_array($body['addresses'] ?? null) ? $body['addresses'] : [];

    if ($subject === '' || mb_strlen($subject) > 500) jsonError(400, '제목 필요 (500자 이내)');
    if (trim(strip_tags($bodyHtml)) === '') jsonError(400, '본문 필요');

    $sanitized = adminEmailSanitizeHtml($bodyHtml);
    $rows = adminEmailFetchRecipients($filter, $addresses);

    jsonOk([
        'subject'        => $subject,
        'body_html'      => $sanitized,
        'filter'         => $filter,
        'total'          => count($rows),
        'sample'         => array_slice($rows, 0, 10),
    ]);
});

post('/api/admin/emails/send', function () {
    $admin = adminAuth();
    if (!ensureEmailBroadcastsSchema()) jsonError(503, '이메일 기능 초기화 중');

    $adminUsername = $admin['username'] ?? 'admin';
    if ($adminUsername === '' || $adminUsername === 'admin' && empty($admin['username'])) {
        // 빈 username은 비정상 → 차단
        jsonError(401, '관리자 계정 식별이 불가능합니다. 다시 로그인하세요.');
    }

    adminEmailEnforceRateLimit($adminUsername);

    $body = getJsonBody();
    $subject = trim((string)($body['subject'] ?? ''));
    $bodyHtml = (string)($body['body_html'] ?? '');
    $filter = trim((string)($body['filter'] ?? 'all_verified'));
    $addresses = is_array($body['addresses'] ?? null) ? $body['addresses'] : [];

    if ($subject === '' || mb_strlen($subject) > 500) jsonError(400, '제목 필요 (500자 이내)');
    if (trim(strip_tags($bodyHtml)) === '') jsonError(400, '본문 필요');

    $sanitized = adminEmailSanitizeHtml($bodyHtml);
    $recipients = adminEmailFetchRecipients($filter, $addresses);
    $total = count($recipients);
    if ($total === 0) jsonError(400, '발송 대상이 없습니다.');
    if ($total > 10000) jsonError(400, '한 번에 최대 10,000명까지 발송 가능합니다.');

    $clientIp = adminEmailClientIp();
    $clientUa = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);

    // 보안 감사 로그 (중요: 관리자·IP·수신자 수 기록)
    error_log(sprintf(
        '[admin_emails][send] admin=%s ip=%s total=%d filter=%s subject=%s',
        $adminUsername, $clientIp, $total, $filter, substr($subject, 0, 80)
    ));

    // 브로드캐스트 레코드 생성 (created_ip / created_ua는 마이그레이션 적용 후 컬럼 존재)
    try {
        DB::execute(
            "INSERT INTO email_broadcasts
                (subject, body_html, filter_type, filter_addresses, total, status,
                 created_by, created_ip, created_ua, started_at)
             VALUES (?, ?, ?, ?, ?, 'sending', ?, ?, ?, UTC_TIMESTAMP())",
            [
                $subject,
                $sanitized,
                $filter,
                $filter === 'specific' ? json_encode(array_slice($addresses, 0, 5000), JSON_UNESCAPED_UNICODE) : null,
                $total,
                $adminUsername,
                $clientIp,
                $clientUa,
            ]
        );
    } catch (Throwable $e) {
        // 보안 패치 마이그레이션 미적용 구버전 DB와의 호환 (fallback)
        DB::execute(
            "INSERT INTO email_broadcasts
                (subject, body_html, filter_type, filter_addresses, total, status, created_by, started_at)
             VALUES (?, ?, ?, ?, ?, 'sending', ?, UTC_TIMESTAMP())",
            [
                $subject,
                $sanitized,
                $filter,
                $filter === 'specific' ? json_encode(array_slice($addresses, 0, 5000), JSON_UNESCAPED_UNICODE) : null,
                $total,
                $adminUsername,
            ]
        );
    }
    $broadcastId = (int)DB::pdo()->lastInsertId();

    // 각 수신자 로그 row 사전 생성 (발송 상태 추적)
    $insertStmt = DB::pdo()->prepare(
        "INSERT INTO email_broadcast_logs (broadcast_id, address, email, status)
         VALUES (?, ?, ?, 'pending')"
    );
    foreach ($recipients as $r) {
        $insertStmt->execute([$broadcastId, $r['address'] ?? null, $r['email']]);
    }

    // 클라이언트에 우선 응답 → 백그라운드에서 실제 발송
    register_shutdown_function(function () use ($broadcastId, $recipients, $subject, $sanitized) {
        try {
            if (function_exists('fastcgi_finish_request')) {
                @fastcgi_finish_request();
            }
        } catch (Throwable $e) {}

        // 재 접근용 PDO 세션 (shutdown 내에서도 동작)
        try {
            $sent = 0; $failed = 0;
            $stmtOk = DB::pdo()->prepare(
                "UPDATE email_broadcast_logs
                 SET status='sent', sent_at=UTC_TIMESTAMP()
                 WHERE broadcast_id=? AND email=? AND status='pending'
                 LIMIT 1"
            );
            $stmtFail = DB::pdo()->prepare(
                "UPDATE email_broadcast_logs
                 SET status='failed', error=?, sent_at=UTC_TIMESTAMP()
                 WHERE broadcast_id=? AND email=? AND status='pending'
                 LIMIT 1"
            );

            foreach ($recipients as $r) {
                $to = $r['email'];
                try {
                    $ok = sendMail($to, $subject, $sanitized);
                } catch (Throwable $e) {
                    $ok = false;
                    error_log('[admin_emails] send exception: ' . $e->getMessage());
                }
                if ($ok) {
                    $sent++;
                    $stmtOk->execute([$broadcastId, $to]);
                } else {
                    $failed++;
                    $stmtFail->execute(['mail() failed', $broadcastId, $to]);
                }
                // 서버 부하 완화 — 10건마다 100ms 휴식
                if (($sent + $failed) % 10 === 0) usleep(100000);
            }

            DB::execute(
                "UPDATE email_broadcasts
                 SET sent=?, failed=?, status=?, finished_at=UTC_TIMESTAMP()
                 WHERE id=?",
                [$sent, $failed, $failed > 0 && $sent === 0 ? 'failed' : 'completed', $broadcastId]
            );
        } catch (Throwable $e) {
            error_log('[admin_emails] shutdown send error: ' . $e->getMessage());
            try {
                DB::execute(
                    "UPDATE email_broadcasts
                     SET status='failed', error_message=?, finished_at=UTC_TIMESTAMP()
                     WHERE id=?",
                    [substr($e->getMessage(), 0, 500), $broadcastId]
                );
            } catch (Throwable $ignored) {}
        }
    });

    jsonOk([
        'broadcast_id' => $broadcastId,
        'total'        => $total,
        'message'      => "총 {$total}명에게 메일 발송을 시작했습니다. 목록에서 진행 상황을 확인하세요.",
    ]);
});

get('/api/admin/emails/list', function () {
    adminAuth();
    if (!ensureEmailBroadcastsSchema()) jsonOk(['items' => []]);

    $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));
    try {
        $rows = DB::fetchAll(
            "SELECT id, subject, filter_type, total, sent, failed, status,
                    created_by, created_ip, created_at, started_at, finished_at, error_message
             FROM email_broadcasts
             ORDER BY id DESC
             LIMIT {$limit}"
        );
    } catch (Throwable $e) {
        // 보안 패치 마이그레이션 미적용 구버전 DB 호환
        $rows = DB::fetchAll(
            "SELECT id, subject, filter_type, total, sent, failed, status,
                    created_by, created_at, started_at, finished_at, error_message
             FROM email_broadcasts
             ORDER BY id DESC
             LIMIT {$limit}"
        );
    }
    jsonOk(['items' => $rows]);
});

get('/api/admin/emails/detail', function () {
    adminAuth();
    if (!ensureEmailBroadcastsSchema()) jsonError(404, 'not found');

    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonError(400, 'id 필요');

    $bc = DB::fetchOne("SELECT * FROM email_broadcasts WHERE id=?", [$id]);
    if (!$bc) jsonError(404, '브로드캐스트를 찾을 수 없습니다.');

    $logs = DB::fetchAll(
        "SELECT address, email, status, error, sent_at
         FROM email_broadcast_logs
         WHERE broadcast_id=?
         ORDER BY id ASC
         LIMIT 2000",
        [$id]
    );

    jsonOk(['broadcast' => $bc, 'logs' => $logs]);
});
