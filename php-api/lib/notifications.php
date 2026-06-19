<?php
/**
 * User notifications — 1회용 팝업/배지 알림.
 *
 * Silica 단순 분배 모델(2026-05-05)에서 관리자 서명 등 비동기 이벤트가 발생했을 때
 * 유저측에 팝업으로 통지하기 위한 경량 큐.
 *
 * 사용 예:
 *   createUserNotification(
 *       $address,
 *       'admin_signed_funding',
 *       '투자가 확정되었습니다',
 *       '관리자 서명이 완료되어 SilicaSTO 가 분배되었습니다.',
 *       ['contract_id' => 123, 'amount_usdt' => 100, 'sto_credited' => 100]
 *   );
 *
 * 프론트는 GET /api/notifications/unread 로 폴링하여 화면 띄움 → 사용자가 닫으면
 * POST /api/notifications/:id/read 로 read_at 업데이트. 같은 알림은 한 번만 노출.
 */

if (!function_exists('createUserNotification')) {
    /**
     * @param string $address 수신 유저 주소
     * @param string $type    알림 타입 슬러그 (예: admin_signed_funding)
     * @param string $title   팝업 제목
     * @param string $body    팝업 본문
     * @param array  $payload 임의 메타데이터 — JSON 으로 직렬화되어 보존
     * @return int            새로 생성된 notification id (실패 시 0)
     */
    function createUserNotification(string $address, string $type, string $title, string $body = '', array $payload = []): int {
        $address = trim($address);
        $type = trim($type);
        if ($address === '' || $type === '') return 0;

        try {
            $payloadJson = !empty($payload) ? json_encode($payload, JSON_UNESCAPED_UNICODE) : null;
            DB::execute(
                "INSERT INTO user_notifications (address, type, title, body, payload_json)
                 VALUES (?,?,?,?,?)",
                [$address, $type, $title, $body, $payloadJson]
            );
            return (int)DB::pdo()->lastInsertId();
        } catch (Throwable $e) {
            // 알림 실패는 본 트랜잭션에 영향을 주면 안 되므로 에러 로그만 남기고 0 반환.
            error_log('createUserNotification failed: ' . $e->getMessage());
            return 0;
        }
    }
}

if (!function_exists('fetchUnreadUserNotifications')) {
    /**
     * 미읽음 알림 조회. 가장 오래된 것부터 정렬해서 반환 (FIFO 표시 의도).
     */
    function fetchUnreadUserNotifications(string $address, int $limit = 20): array {
        $address = trim($address);
        if ($address === '') return [];
        $limit = max(1, min($limit, 100));
        try {
            return DB::fetchAll(
                "SELECT id, type, title, body, payload_json, created_at
                   FROM user_notifications
                  WHERE address=? AND read_at IS NULL
                  ORDER BY id ASC
                  LIMIT {$limit}",
                [$address]
            );
        } catch (Throwable $e) {
            error_log('fetchUnreadUserNotifications failed: ' . $e->getMessage());
            return [];
        }
    }
}

if (!function_exists('markUserNotificationRead')) {
    /**
     * 단일 알림을 읽음 처리. 다른 유저의 알림은 갱신되지 않도록 address 검증.
     * @return bool 1행이 갱신되었는지 여부
     */
    function markUserNotificationRead(string $address, int $id): bool {
        if (trim($address) === '' || $id <= 0) return false;
        try {
            $stmt = DB::pdo()->prepare(
                "UPDATE user_notifications
                    SET read_at = UTC_TIMESTAMP()
                  WHERE id = ?
                    AND address = ?
                    AND read_at IS NULL"
            );
            $stmt->execute([$id, $address]);
            return $stmt->rowCount() > 0;
        } catch (Throwable $e) {
            error_log('markUserNotificationRead failed: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('markAllUserNotificationsRead')) {
    function markAllUserNotificationsRead(string $address): int {
        if (trim($address) === '') return 0;
        try {
            $stmt = DB::pdo()->prepare(
                "UPDATE user_notifications
                    SET read_at = UTC_TIMESTAMP()
                  WHERE address = ?
                    AND read_at IS NULL"
            );
            $stmt->execute([$address]);
            return $stmt->rowCount();
        } catch (Throwable $e) {
            error_log('markAllUserNotificationsRead failed: ' . $e->getMessage());
            return 0;
        }
    }
}
