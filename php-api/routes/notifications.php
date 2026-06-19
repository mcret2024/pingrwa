<?php
/**
 * User notification routes — 1회용 팝업 알림 큐.
 *
 * GET  /api/notifications/unread     — 미읽음 알림 목록 (FIFO)
 * POST /api/notifications/:id/read   — 단일 알림을 읽음 처리
 * POST /api/notifications/read-all   — 미읽음 전체 읽음 처리
 */

get('/api/notifications/unread', function () {
    $user = authMfaRequired();
    $address = $user['address'];

    $rows = fetchUnreadUserNotifications($address, 20);

    // payload_json 을 클라이언트가 즉시 사용 가능한 객체로 디코딩
    foreach ($rows as &$row) {
        if (!empty($row['payload_json'])) {
            $decoded = json_decode($row['payload_json'], true);
            $row['payload'] = is_array($decoded) ? $decoded : null;
        } else {
            $row['payload'] = null;
        }
        unset($row['payload_json']);
    }
    unset($row);

    jsonOk([
        'notifications' => $rows,
        'count' => count($rows),
    ]);
});

post('/api/notifications/:id/read', function ($p) {
    $user = authMfaRequired();
    $address = $user['address'];
    $id = (int)($p['id'] ?? 0);
    if ($id <= 0) jsonError(400, 'invalid id');

    $ok = markUserNotificationRead($address, $id);
    jsonOk(['ok' => $ok, 'id' => $id]);
});

post('/api/notifications/read-all', function () {
    $user = authMfaRequired();
    $address = $user['address'];

    $count = markAllUserNotificationsRead($address);
    jsonOk(['ok' => true, 'updated' => $count]);
});
