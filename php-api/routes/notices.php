<?php
/**
 * Notices / Accounting Reports
 *
 * (2026-05-11 v270) Operator: 'ir 메뉴 아래에 공지 메뉴를 추가하고,
 * 연간(또는 분기별) 회계 자료를 유저가 볼 수 있도록 하고, 관리자
 * 패널에 회계 자료만 별도 관리 할 수 있는 설정탭을 구성해줘.'
 *
 * Categories (extensible):
 *   accounting_annual    — 연간 회계 보고서 (FY2025, FY2026, ...)
 *   accounting_quarterly — 분기 회계 보고서 (2026 Q1, 2026 Q2, ...)
 *   general              — 일반 공지 (확장용)
 *
 * Endpoints:
 *   GET  /api/notices                      (public — published only)
 *   GET  /api/admin/notices                (admin — all, incl. unpublished)
 *   POST /api/admin/notices                (admin — create with optional file)
 *   POST /api/admin/notices/:id/toggle     (admin — flip published)
 *   DELETE /api/admin/notices/:id          (admin — delete + best-effort file unlink)
 */

if (!function_exists('ensureNoticesTable')) {
    function ensureNoticesTable(): void {
        static $checked = false;
        if ($checked) return;
        DB::execute("
            CREATE TABLE IF NOT EXISTS `notices` (
                `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                `category` VARCHAR(40) NOT NULL,
                `title` VARCHAR(255) NOT NULL,
                `period` VARCHAR(64) DEFAULT NULL,
                `notice_date` DATE DEFAULT NULL,
                `file_path` VARCHAR(500) DEFAULT NULL,
                `body` MEDIUMTEXT DEFAULT NULL,
                `published` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_notices_category` (`category`),
                INDEX `idx_notices_pub_date` (`published`, `notice_date` DESC),
                INDEX `idx_notices_created` (`created_at` DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // (2026-05-18 v502) 운영자 요청: '제목과 본문 영문/국문 따로 등록'.
        //   기존 title/body 는 한국어로 유지, title_en/body_en 컬럼 추가.
        //   사용자 페이지가 requestLocale() 기준으로 분기 표시 — 영문 비어
        //   있으면 한국어 폴백.
        try {
            $hasTitleEn = (int)(DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns
                  WHERE table_schema = DATABASE() AND table_name = 'notices' AND column_name = 'title_en'"
            ) ?? 0) > 0;
            if (!$hasTitleEn) {
                DB::execute("ALTER TABLE `notices` ADD COLUMN `title_en` VARCHAR(255) DEFAULT NULL AFTER `title`");
            }
            $hasBodyEn = (int)(DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns
                  WHERE table_schema = DATABASE() AND table_name = 'notices' AND column_name = 'body_en'"
            ) ?? 0) > 0;
            if (!$hasBodyEn) {
                DB::execute("ALTER TABLE `notices` ADD COLUMN `body_en` MEDIUMTEXT DEFAULT NULL AFTER `body`");
            }
        } catch (Throwable $e) {
            error_log('[ensureNoticesTable] i18n ALTER failed: ' . $e->getMessage());
        }
        $checked = true;
    }
}

const NOTICE_CATEGORIES = [
    'accounting_annual'    => '연간 회계',
    'accounting_quarterly' => '분기 회계',
    'general'              => '일반 공지',
];

if (!function_exists('noticeValidateCategory')) {
    function noticeValidateCategory(string $cat): string {
        $cat = trim($cat);
        if (!isset(NOTICE_CATEGORIES[$cat])) {
            jsonError(400, "category 는 다음 중 하나여야 합니다: " . implode(', ', array_keys(NOTICE_CATEGORIES)));
        }
        return $cat;
    }
}

if (!function_exists('noticeNormalizeRow')) {
    function noticeNormalizeRow(array $r): array {
        $r['id']          = (int)($r['id'] ?? 0);
        $r['published']   = (int)($r['published'] ?? 0) === 1;
        $r['category']    = (string)($r['category'] ?? '');
        $r['category_label'] = NOTICE_CATEGORIES[$r['category']] ?? $r['category'];
        // (2026-05-18 v509) 고아 file_path 정리 — 파일 시스템에 실제 파일이
        //   없으면 file_path 를 null 로 응답 (frontend 가 '파일 없음' 표시).
        //   원인: reset 이 업로드 파일은 삭제했지만 notices row 는 보존했던
        //   기간에 발생한 잔재. v509 부터 reset 이 notice_* 파일 보존하므로
        //   향후엔 발생 안 함. 본 정리는 historical orphan 케이스 대응.
        $fp = (string)($r['file_path'] ?? '');
        if ($fp !== '' && strpos($fp, '/uploads/') === 0) {
            $fs = (defined('UPLOAD_DIR') ? UPLOAD_DIR : __DIR__ . '/../../uploads') . '/' . basename($fp);
            if (!is_file($fs)) {
                $r['file_path'] = null;
                $r['file_missing'] = true;
            }
        }
        return $r;
    }
}

// (2026-05-18 v502) 사용자 페이지 응답용 — locale 분기 + 영문 비어있으면
//   한국어 폴백. title/body 는 한국어 기본값 유지하면서 추가 필드로 노출.
if (!function_exists('noticeLocalizeRow')) {
    function noticeLocalizeRow(array $r): array {
        $r = noticeNormalizeRow($r);
        $lang = function_exists('requestLocale') ? requestLocale() : 'ko';
        $titleKo = (string)($r['title'] ?? '');
        $titleEn = (string)($r['title_en'] ?? '');
        $bodyKo  = (string)($r['body'] ?? '');
        $bodyEn  = (string)($r['body_en'] ?? '');
        if ($lang === 'en') {
            $r['title'] = $titleEn !== '' ? $titleEn : $titleKo;
            $r['body']  = $bodyEn  !== '' ? $bodyEn  : $bodyKo;
        }
        // KO 응답은 원본 그대로
        return $r;
    }
}

// ----------------------------------------------------------------
// GET /api/notices — public list (published only).
//   Query params:
//     ?category=accounting_annual   (optional filter)
//     ?limit=50                     (default 50, max 200)
// ----------------------------------------------------------------
get('/api/notices', function () {
    ensureNoticesTable();

    $category = trim((string)($_GET['category'] ?? ''));
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));

    $where = ['published = 1'];
    $params = [];
    if ($category !== '') {
        if (!isset(NOTICE_CATEGORIES[$category])) {
            jsonError(400, '유효하지 않은 category');
        }
        $where[] = 'category = ?';
        $params[] = $category;
    }

    $sql = "SELECT id, category, title, title_en, period, notice_date, file_path, body, body_en, created_at
            FROM notices
            WHERE " . implode(' AND ', $where) . "
            ORDER BY COALESCE(notice_date, DATE(created_at)) DESC, id DESC
            LIMIT {$limit}";
    $rows = DB::fetchAll($sql, $params);
    // (v502) 사용자 페이지 — locale 기반 분기 표시.
    $rows = array_map('noticeLocalizeRow', $rows);

    jsonOk([
        'notices'   => $rows,
        'categories' => NOTICE_CATEGORIES,
    ]);
});

// ----------------------------------------------------------------
// GET /api/admin/notices — admin list (includes unpublished + 양어 모두).
// ----------------------------------------------------------------
get('/api/admin/notices', function () {
    adminOnly();
    ensureNoticesTable();

    $rows = DB::fetchAll(
        "SELECT id, category, title, title_en, period, notice_date, file_path, body, body_en, published, created_at
         FROM notices
         ORDER BY id DESC"
    );
    // admin 응답은 양어 모두 그대로 — UI 가 KO/EN 각각 편집 가능.
    $rows = array_map('noticeNormalizeRow', $rows);
    jsonOk([
        'notices'    => $rows,
        'categories' => NOTICE_CATEGORIES,
    ]);
});

// ----------------------------------------------------------------
// POST /api/admin/notices — create.
//   multipart/form-data:
//     - category   (required, whitelisted)
//     - title      (required)
//     - period     (optional, e.g. FY2025, 2026Q1)
//     - notice_date (optional, YYYY-MM-DD)
//     - body       (optional, inline text/HTML — escaped at render time)
//     - published  (optional bool, default '1')
//     - file       (optional file upload, PDF/이미지)
// ----------------------------------------------------------------
post('/api/admin/notices', function () {
    adminOnly();
    ensureNoticesTable();

    $category = noticeValidateCategory((string)($_POST['category'] ?? ''));

    // (2026-05-18 v502) title / body 는 KO 가 기본 (필수). title_en / body_en
    //   은 선택 — 비어있으면 KO 폴백. 운영자 요청: '제목과 본문 영문 국문
    //   따로 등록'.
    //   하위 호환: 옛 단일 필드(title/body) 만 전송하는 호출자도 동작.
    $title    = trim((string)($_POST['title'] ?? ''));
    $titleEn  = trim((string)($_POST['title_en'] ?? ''));
    if ($title === '') jsonError(400, '한국어 제목(title)은 필수입니다.');
    if (mb_strlen($title, 'UTF-8') > 255) jsonError(400, 'title은 255자 이하여야 합니다.');
    if ($titleEn !== '' && mb_strlen($titleEn, 'UTF-8') > 255) jsonError(400, 'title_en은 255자 이하여야 합니다.');

    $period = trim((string)($_POST['period'] ?? ''));
    if (mb_strlen($period, 'UTF-8') > 64) jsonError(400, 'period는 64자 이하여야 합니다.');

    $noticeDate = trim((string)($_POST['notice_date'] ?? ''));
    if ($noticeDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $noticeDate)) {
        jsonError(400, 'notice_date는 YYYY-MM-DD 형식이어야 합니다.');
    }

    $body   = (string)($_POST['body'] ?? '');
    $bodyEn = (string)($_POST['body_en'] ?? '');
    if (mb_strlen($body, 'UTF-8') > 50000) jsonError(400, 'body는 50000자 이하여야 합니다.');
    if (mb_strlen($bodyEn, 'UTF-8') > 50000) jsonError(400, 'body_en은 50000자 이하여야 합니다.');

    $publishedRaw = $_POST['published'] ?? '1';
    $published = filter_var($publishedRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($published === null) $published = true;

    // Optional file upload
    $filePath = null;
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['file'];
        if ($file['size'] > 25 * 1024 * 1024) {
            jsonError(400, '파일은 25 MB 이하여야 합니다.');
        }
        $allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $ext = $ext ? '.' . $ext : '';
        if (!in_array($ext, $allowedExts, true)) {
            jsonError(400, 'PDF / PNG / JPG / WEBP 만 업로드 가능합니다.');
        }
        if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);
        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $file['name']);
        $filename = 'notice_' . time() . '_' . bin2hex(random_bytes(4)) . '_' . $safe;
        $dest = UPLOAD_DIR . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            jsonError(500, '파일 저장 실패');
        }
        $filePath = '/uploads/' . $filename;
    }

    DB::execute(
        "INSERT INTO notices (category, title, title_en, period, notice_date, file_path, body, body_en, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $category,
            $title,
            $titleEn !== '' ? $titleEn : null,
            $period !== '' ? $period : null,
            $noticeDate !== '' ? $noticeDate : null,
            $filePath,
            $body !== '' ? $body : null,
            $bodyEn !== '' ? $bodyEn : null,
            $published ? 1 : 0,
        ]
    );

    $id = (int)DB::pdo()->lastInsertId();
    jsonOk(['ok' => true, 'id' => $id, 'file_path' => $filePath]);
});

// ----------------------------------------------------------------
// POST /api/admin/notices/:id/update — edit existing notice (v506).
//   운영자 요청: '등록된 공지에 비공개와 삭제만 있고 수정이 없다. 수정
//   버튼 + 팝업으로 수정 가능하도록.'
//
//   multipart/form-data (POST 와 동일한 필드 수용):
//     - category (옵션)
//     - title / title_en (옵션)
//     - period / notice_date (옵션)
//     - body / body_en (옵션)
//     - published (옵션)
//     - file (옵션, 새 파일로 교체. 'remove_file=1' 이면 기존 파일 unlink + NULL)
// ----------------------------------------------------------------
post('/api/admin/notices/:id/update', function ($p) {
    adminOnly();
    ensureNoticesTable();

    $id = (int)$p['id'];
    if ($id <= 0) jsonError(400, 'id가 유효하지 않습니다.');

    $existing = DB::fetchOne("SELECT * FROM notices WHERE id=?", [$id]);
    if (!$existing) jsonError(404, '공지를 찾을 수 없습니다.');

    $updates = [];
    $params  = [];

    if (array_key_exists('category', $_POST)) {
        $category = noticeValidateCategory((string)$_POST['category']);
        $updates[] = 'category=?';
        $params[]  = $category;
    }

    if (array_key_exists('title', $_POST)) {
        $title = trim((string)$_POST['title']);
        if ($title === '') jsonError(400, '한국어 제목(title)은 비울 수 없습니다.');
        if (mb_strlen($title, 'UTF-8') > 255) jsonError(400, 'title은 255자 이하여야 합니다.');
        $updates[] = 'title=?';
        $params[]  = $title;
    }

    if (array_key_exists('title_en', $_POST)) {
        $titleEn = trim((string)$_POST['title_en']);
        if ($titleEn !== '' && mb_strlen($titleEn, 'UTF-8') > 255) jsonError(400, 'title_en은 255자 이하여야 합니다.');
        $updates[] = 'title_en=?';
        $params[]  = $titleEn !== '' ? $titleEn : null;
    }

    if (array_key_exists('period', $_POST)) {
        $period = trim((string)$_POST['period']);
        if ($period !== '' && mb_strlen($period, 'UTF-8') > 64) jsonError(400, 'period는 64자 이하여야 합니다.');
        $updates[] = 'period=?';
        $params[]  = $period !== '' ? $period : null;
    }

    if (array_key_exists('notice_date', $_POST)) {
        $noticeDate = trim((string)$_POST['notice_date']);
        if ($noticeDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $noticeDate)) {
            jsonError(400, 'notice_date는 YYYY-MM-DD 형식이어야 합니다.');
        }
        $updates[] = 'notice_date=?';
        $params[]  = $noticeDate !== '' ? $noticeDate : null;
    }

    if (array_key_exists('body', $_POST)) {
        $body = (string)$_POST['body'];
        if (mb_strlen($body, 'UTF-8') > 50000) jsonError(400, 'body는 50000자 이하여야 합니다.');
        $updates[] = 'body=?';
        $params[]  = $body !== '' ? $body : null;
    }

    if (array_key_exists('body_en', $_POST)) {
        $bodyEn = (string)$_POST['body_en'];
        if (mb_strlen($bodyEn, 'UTF-8') > 50000) jsonError(400, 'body_en은 50000자 이하여야 합니다.');
        $updates[] = 'body_en=?';
        $params[]  = $bodyEn !== '' ? $bodyEn : null;
    }

    if (array_key_exists('published', $_POST)) {
        $published = filter_var($_POST['published'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($published === null) $published = true;
        $updates[] = 'published=?';
        $params[]  = $published ? 1 : 0;
    }

    // 파일 처리 — 새 파일 업로드 또는 'remove_file=1' 시 제거.
    $newFilePath = null;
    $removeFileRequested = false;
    if (!empty($_POST['remove_file']) && filter_var($_POST['remove_file'], FILTER_VALIDATE_BOOLEAN)) {
        $removeFileRequested = true;
    }
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['file'];
        if ($file['size'] > 25 * 1024 * 1024) jsonError(400, '파일은 25 MB 이하여야 합니다.');
        $allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $ext = $ext ? '.' . $ext : '';
        if (!in_array($ext, $allowedExts, true)) {
            jsonError(400, 'PDF / PNG / JPG / WEBP 만 업로드 가능합니다.');
        }
        if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);
        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $file['name']);
        $filename = 'notice_' . time() . '_' . bin2hex(random_bytes(4)) . '_' . $safe;
        $dest = UPLOAD_DIR . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            jsonError(500, '파일 저장 실패');
        }
        $newFilePath = '/uploads/' . $filename;
        $updates[] = 'file_path=?';
        $params[]  = $newFilePath;
    } elseif ($removeFileRequested) {
        $updates[] = 'file_path=?';
        $params[]  = null;
    }

    if (empty($updates)) {
        jsonOk(['ok' => true, 'message' => '변경사항 없음']);
        return;
    }

    $params[] = $id;
    DB::execute("UPDATE notices SET " . implode(', ', $updates) . " WHERE id=?", $params);

    // 옛 파일 unlink (새 파일로 교체 or 명시적 제거 시).
    if (($newFilePath !== null || $removeFileRequested) && !empty($existing['file_path'])
        && strpos($existing['file_path'], '/uploads/') === 0) {
        $fs = UPLOAD_DIR . '/' . basename($existing['file_path']);
        if (is_file($fs)) @unlink($fs);
    }

    jsonOk(['ok' => true, 'id' => $id]);
});

// ----------------------------------------------------------------
// POST /api/admin/notices/:id/toggle — flip published.
// ----------------------------------------------------------------
post('/api/admin/notices/:id/toggle', function ($p) {
    adminOnly();
    ensureNoticesTable();

    $id = (int)$p['id'];
    if ($id <= 0) jsonError(400, 'id가 유효하지 않습니다.');

    $row = DB::fetchOne("SELECT id, published FROM notices WHERE id=?", [$id]);
    if (!$row) jsonError(404, '공지를 찾을 수 없습니다.');

    $next = ((int)$row['published'] === 1) ? 0 : 1;
    DB::execute("UPDATE notices SET published=? WHERE id=?", [$next, $id]);
    jsonOk(['ok' => true, 'published' => $next === 1]);
});

// ----------------------------------------------------------------
// DELETE /api/admin/notices/:id — delete row + best-effort unlink file.
// ----------------------------------------------------------------
delete_route('/api/admin/notices/:id', function ($p) {
    adminOnly();
    ensureNoticesTable();

    $id = (int)$p['id'];
    if ($id <= 0) jsonError(400, 'id가 유효하지 않습니다.');

    $row = DB::fetchOne("SELECT id, file_path FROM notices WHERE id=?", [$id]);
    if (!$row) jsonError(404, '공지를 찾을 수 없습니다.');

    DB::execute("DELETE FROM notices WHERE id=?", [$id]);

    // Best-effort file removal (a missing file isn't an error).
    if (!empty($row['file_path']) && strpos($row['file_path'], '/uploads/') === 0) {
        $fs = UPLOAD_DIR . '/' . basename($row['file_path']);
        if (is_file($fs)) @unlink($fs);
    }
    jsonOk(['ok' => true]);
});
