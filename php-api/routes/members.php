<?php
/**
 * Member signup (PII: nickname/email/name/phone) + admin-configurable field set.
 * Auth model:
 *   - signup: user signs a message proving wallet ownership (binds address).
 *   - admin config/list: wallet signature from an ADMIN_WALLET_ADDRESSES address.
 * PII lives here (DB); the referrer link & staking live on-chain.
 */

function membersFieldDefs(): array {
    // available collectable fields (admin toggles which are required)
    return ['nickname' => '닉네임', 'email' => '이메일', 'name' => '이름', 'phone' => '전화번호'];
}

/** Current electronic investment-contract version (terms published in the frontend). */
const MEMBER_CONTRACT_VERSION = 'v1';

function membersEnsureTable(): void {
    DB::execute("CREATE TABLE IF NOT EXISTS `members` (
        `address`   VARCHAR(64) NOT NULL,
        `nickname`  VARCHAR(120) NULL,
        `email`     VARCHAR(190) NULL,
        `name`      VARCHAR(120) NULL,
        `phone`     VARCHAR(60) NULL,
        `referrer`  VARCHAR(64) NULL,
        `contract_version`   VARCHAR(20) NULL,
        `contract_signed_at` DATETIME NULL,
        `contract_sig`       TEXT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`address`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // add contract columns to pre-existing tables (ignored if already present)
    foreach ([
        "ADD COLUMN `contract_version` VARCHAR(20) NULL",
        "ADD COLUMN `contract_signed_at` DATETIME NULL",
        "ADD COLUMN `contract_sig` TEXT NULL",
    ] as $alter) {
        try { DB::execute("ALTER TABLE `members` $alter"); } catch (\Throwable $e) { /* column exists */ }
    }
}

function membersGetConfig(): array {
    $raw = getSetting('signup_fields', null);
    $cfg = $raw ? json_decode($raw, true) : null;
    if (!is_array($cfg)) $cfg = ['nickname' => true, 'email' => true, 'name' => false, 'phone' => false];
    foreach (array_keys(membersFieldDefs()) as $k) { if (!array_key_exists($k, $cfg)) $cfg[$k] = false; else $cfg[$k] = !empty($cfg[$k]); }
    return $cfg;
}

/** Verify a wallet-signed admin request; returns the admin address or throws. */
function membersVerifyAdmin(array $body, string $action): string {
    $addr = trim((string)($body['address'] ?? ''));
    $ts   = (int)($body['ts'] ?? 0);
    $sig  = trim((string)($body['sig'] ?? ''));
    $msg  = trim((string)($body['message'] ?? ''));
    if ($addr === '' || $sig === '' || $msg === '') jsonError(401, '관리자 서명이 필요합니다.');
    if (abs((int)(microtime(true) * 1000) - $ts) > 600000) jsonError(401, '서명이 만료되었습니다. 다시 시도하세요.');
    $admins = array_map('strval', ADMIN_WALLET_ADDRESSES);
    if (!in_array($addr, $admins, true)) jsonError(403, '관리자 지갑이 아닙니다.');
    $expected = "PINGRWA-ADMIN|{$action}|ts={$ts}";
    if ($msg !== $expected) jsonError(401, '서명 메시지가 일치하지 않습니다.');
    if (!verifySolanaMessageSignature($addr, $msg, $sig)) jsonError(401, '서명 검증 실패.');
    return $addr;
}

// ── public: which fields to collect (frontend builds the signup form) ──
get('/api/members/config', function () {
    membersEnsureTable();
    jsonOk(['fields' => membersGetConfig(), 'labels' => membersFieldDefs()]);
});

// ── public: member's own record ──
get('/api/members/:address', function ($p) {
    membersEnsureTable();
    $m = DB::fetchOne("SELECT address,nickname,email,name,phone,referrer,contract_version,contract_signed_at,created_at FROM members WHERE address=?", [trim((string)($p['address'] ?? ''))]);
    jsonOk(['member' => $m, 'contract_version' => MEMBER_CONTRACT_VERSION]);
});

// ── user signup (wallet-signed; binds address) ──
post('/api/members/signup', function () {
    membersEnsureTable();
    $body = getJsonBody();
    $addr = trim((string)($body['address'] ?? ''));
    $ts   = (int)($body['ts'] ?? 0);
    $sig  = trim((string)($body['sig'] ?? ''));
    $msg  = trim((string)($body['message'] ?? ''));
    if ($addr === '') jsonError(400, '지갑 주소가 필요합니다.');
    if ($sig === '' || $msg === '') jsonError(401, '서명이 필요합니다.');
    if (abs((int)(microtime(true) * 1000) - $ts) > 600000) jsonError(401, '서명이 만료되었습니다.');
    // wallet-signed electronic-contract acceptance (binds address + contract version)
    $cver = trim((string)($body['contract_version'] ?? ''));
    if ($cver === '') jsonError(400, '계약 버전이 필요합니다.');
    if ($msg !== "PINGRWA 전자투자계약 동의|{$cver}|{$addr}|ts={$ts}") jsonError(401, '계약 동의 서명 메시지가 일치하지 않습니다.');
    if (!verifySolanaMessageSignature($addr, $msg, $sig)) jsonError(401, '서명 검증 실패.');

    $cfg = membersGetConfig();
    $vals = ['nickname' => null, 'email' => null, 'name' => null, 'phone' => null];
    foreach (array_keys(membersFieldDefs()) as $k) {
        $v = trim((string)($body[$k] ?? ''));
        if (!empty($cfg[$k]) && $v === '') jsonError(400, membersFieldDefs()[$k] . ' 입력이 필요합니다.');
        $vals[$k] = $v !== '' ? $v : null;
    }
    if ($vals['email'] !== null && !filter_var($vals['email'], FILTER_VALIDATE_EMAIL)) jsonError(400, '이메일 형식이 올바르지 않습니다.');
    $referrer = trim((string)($body['referrer'] ?? ''));
    $referrer = $referrer !== '' ? $referrer : null;

    DB::execute(
        "INSERT INTO members(address,nickname,email,name,phone,referrer,contract_version,contract_signed_at,contract_sig)
         VALUES(?,?,?,?,?,?,?,NOW(),?)
         ON DUPLICATE KEY UPDATE nickname=VALUES(nickname),email=VALUES(email),name=VALUES(name),phone=VALUES(phone),referrer=COALESCE(members.referrer,VALUES(referrer)),
           contract_version=VALUES(contract_version),contract_signed_at=VALUES(contract_signed_at),contract_sig=VALUES(contract_sig)",
        [$addr, $vals['nickname'], $vals['email'], $vals['name'], $vals['phone'], $referrer, $cver, $sig]
    );
    jsonOk(['saved' => true, 'contract_version' => $cver]);
});

// ── admin: set which fields to collect (wallet-signed) ──
post('/api/admin/members/config', function () {
    membersEnsureTable();
    $body = getJsonBody();
    membersVerifyAdmin($body, 'set_signup_fields');
    $in = $body['fields'] ?? [];
    $cfg = [];
    foreach (array_keys(membersFieldDefs()) as $k) $cfg[$k] = !empty($in[$k]);
    setSetting('signup_fields', json_encode($cfg));
    jsonOk(['fields' => $cfg]);
});

// ── admin: list members (wallet-signed) ──
post('/api/admin/members/list', function () {
    membersEnsureTable();
    $body = getJsonBody();
    membersVerifyAdmin($body, 'list_members');
    $rows = DB::fetchAll("SELECT address,nickname,email,name,phone,referrer,created_at FROM members ORDER BY created_at DESC LIMIT 500");
    jsonOk(['members' => $rows, 'count' => count($rows)]);
});
