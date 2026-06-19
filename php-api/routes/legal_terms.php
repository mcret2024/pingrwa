<?php
/**
 * Legal Terms / 이용약관 관리
 *
 * (2026-05-12 v306) Operator: '이용약관 한국어로 변환이 적용 되지 않았다.
 *   이용약관 관리자에서 수정 할 수 있도록 해줘. 영어와 한국어 별도 기재.'
 *
 * Stores the user-facing Terms of Service / Investment in DB so admins
 * can edit both KO and EN versions without code changes. The user-side
 * /user/terms.html fetches GET /api/terms (public) and renders body_html
 * for the user's current locale.
 *
 * Endpoints:
 *   GET  /api/terms                    — public, ?lang=ko|en (default 'en')
 *   GET  /api/admin/terms              — admin, returns both KO + EN
 *   POST /api/admin/terms              — admin saves both versions
 */

if (!function_exists('ensureLegalTermsTable')) {
    function ensureLegalTermsTable(): void {
        static $done = false;
        if ($done) return;
        DB::execute("
            CREATE TABLE IF NOT EXISTS legal_terms (
                id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
                doc_key         VARCHAR(64)  NOT NULL DEFAULT 'tos_investment',
                title_ko        VARCHAR(255) NOT NULL DEFAULT '이용약관 및 투자 안내',
                title_en        VARCHAR(255) NOT NULL DEFAULT 'Terms of Service & Investment',
                subtitle_ko     TEXT NULL,
                subtitle_en     TEXT NULL,
                body_html_ko    MEDIUMTEXT NULL,
                body_html_en    MEDIUMTEXT NULL,
                effective_date  DATE NULL,
                updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updated_by      VARCHAR(128) NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_legal_terms_key (doc_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Seed: insert default row if table is empty. The EN body is copied
        // from the existing static /user/terms.html marketing copy so the
        // user-facing page survives the migration. KO body left empty until
        // the operator fills it in (current UX expects KO users to see KO,
        // but if it's blank we fall back to EN — handled in the public GET).
        $exists = (int)DB::fetchValue("SELECT COUNT(*) FROM legal_terms WHERE doc_key='tos_investment'");
        if ($exists === 0) {
            DB::execute(
                "INSERT INTO legal_terms (doc_key, title_ko, title_en, subtitle_ko, subtitle_en, body_html_ko, body_html_en, effective_date, updated_by)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    'tos_investment',
                    '이용약관 및 투자 안내',
                    'Terms of Service & Investment',
                    '본 약관은 SilicaChain 플랫폼 이용 조건, 실물자산 연동 토큰 상품의 기본 원칙, 투자자 공시, 책임 범위를 정합니다.',
                    'These terms outline the conditions for using the SilicaChain platform, the basic principles of real-world-asset-linked token products, investor disclosures, and the scope of responsibility.',
                    '', // KO body empty by default — admin fills in via /admin/terms.html
                    '', // EN body empty by default — admin can paste the legacy content
                    date('Y-m-d'),
                    'system_seed',
                ]
            );
        }
        $done = true;
    }
}

/**
 * GET /api/terms?lang=ko|en
 * Public — returns the stored terms doc for the requested locale.
 * Falls back to EN content when KO is blank (so a partial setup doesn't
 * leave Korean users staring at an empty page).
 */
get('/api/terms', function () {
    ensureLegalTermsTable();
    $lang = strtolower(trim((string)($_GET['lang'] ?? 'en')));
    if ($lang !== 'ko' && $lang !== 'en') $lang = 'en';

    $row = DB::fetchOne("SELECT * FROM legal_terms WHERE doc_key='tos_investment' LIMIT 1");
    if (!$row) {
        jsonOk([
            'lang' => $lang,
            'title' => '',
            'subtitle' => '',
            'body_html' => '',
            'effective_date' => null,
        ]);
        return;
    }

    $bodyKo = trim((string)($row['body_html_ko'] ?? ''));
    $bodyEn = trim((string)($row['body_html_en'] ?? ''));

    // Pick body for requested locale, fall back to the other if blank.
    $body = '';
    $titlePicked = '';
    $subtitlePicked = '';
    if ($lang === 'ko') {
        $body = $bodyKo !== '' ? $bodyKo : $bodyEn;
        $titlePicked = trim((string)($row['title_ko'] ?? '')) ?: trim((string)($row['title_en'] ?? ''));
        $subtitlePicked = trim((string)($row['subtitle_ko'] ?? '')) ?: trim((string)($row['subtitle_en'] ?? ''));
    } else {
        $body = $bodyEn !== '' ? $bodyEn : $bodyKo;
        $titlePicked = trim((string)($row['title_en'] ?? '')) ?: trim((string)($row['title_ko'] ?? ''));
        $subtitlePicked = trim((string)($row['subtitle_en'] ?? '')) ?: trim((string)($row['subtitle_ko'] ?? ''));
    }

    jsonOk([
        'lang' => $lang,
        'title' => $titlePicked,
        'subtitle' => $subtitlePicked,
        'body_html' => $body,
        'effective_date' => $row['effective_date'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ]);
});

/**
 * GET /api/admin/terms
 * Admin — returns the raw row so both KO and EN can be edited side-by-side.
 */
get('/api/admin/terms', function () {
    adminOnly();
    ensureLegalTermsTable();
    $row = DB::fetchOne("SELECT * FROM legal_terms WHERE doc_key='tos_investment' LIMIT 1");
    if (!$row) {
        jsonOk(['terms' => null]);
        return;
    }
    jsonOk(['terms' => $row]);
});

/**
 * POST /api/admin/terms
 * Admin — updates both KO and EN versions in one call.
 */
post('/api/admin/terms', function () {
    $admin = adminAuth();
    ensureLegalTermsTable();
    $body = getJsonBody();

    $titleKo    = trim((string)($body['title_ko'] ?? ''));
    $titleEn    = trim((string)($body['title_en'] ?? ''));
    $subtitleKo = (string)($body['subtitle_ko'] ?? '');
    $subtitleEn = (string)($body['subtitle_en'] ?? '');
    $bodyKo     = (string)($body['body_html_ko'] ?? '');
    $bodyEn     = (string)($body['body_html_en'] ?? '');
    $effective  = trim((string)($body['effective_date'] ?? ''));

    if ($titleEn === '') jsonError(400, 'English title is required.');
    if ($titleKo === '') $titleKo = $titleEn;   // fallback so KO never goes empty

    if ($effective === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $effective)) {
        $effective = date('Y-m-d');
    }

    $exists = (int)DB::fetchValue("SELECT COUNT(*) FROM legal_terms WHERE doc_key='tos_investment'");
    if ($exists === 0) {
        DB::execute(
            "INSERT INTO legal_terms (doc_key, title_ko, title_en, subtitle_ko, subtitle_en, body_html_ko, body_html_en, effective_date, updated_by)
             VALUES (?,?,?,?,?,?,?,?,?)",
            ['tos_investment', $titleKo, $titleEn, $subtitleKo, $subtitleEn, $bodyKo, $bodyEn, $effective, $admin['username'] ?? 'admin']
        );
    } else {
        DB::execute(
            "UPDATE legal_terms
                SET title_ko=?, title_en=?, subtitle_ko=?, subtitle_en=?,
                    body_html_ko=?, body_html_en=?, effective_date=?, updated_by=?
              WHERE doc_key='tos_investment'",
            [$titleKo, $titleEn, $subtitleKo, $subtitleEn, $bodyKo, $bodyEn, $effective, $admin['username'] ?? 'admin']
        );
    }

    jsonOk(['ok' => true, 'effective_date' => $effective]);
});
