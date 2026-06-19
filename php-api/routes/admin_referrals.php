<?php
/**
 * Admin Referral Management Routes
 *
 * - Admin approves which users can become referrers
 * - Approved referrers receive a configurable share of investor staking interest
 * - Bonus is additional platform payout and is not deducted from investor interest
 */

if (!function_exists('adminReferralSafeIdentifier')) {
    function adminReferralSafeIdentifier(string $name): string {
        $trimmed = trim($name);
        if ($trimmed === '' || !preg_match('/^[A-Za-z0-9_]+$/', $trimmed)) {
            throw new InvalidArgumentException('Invalid identifier');
        }
        return '`' . $trimmed . '`';
    }
}

if (!function_exists('adminReferralTableExists')) {
    function adminReferralTableExists(string $table): bool {
        $table = trim($table);
        if ($table === '') return false;

        try {
            $row = DB::fetchOne("SHOW TABLES LIKE ?", [$table]);
            if (is_array($row) && !empty($row)) return true;
        } catch (Throwable $e) {
            error_log('admin referral tableExists show tables fallback: ' . $e->getMessage());
        }

        try {
            return (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                [$table]
            ) > 0;
        } catch (Throwable $e) {
            error_log('admin referral tableExists information_schema fallback: ' . $e->getMessage());
        }

        try {
            $safeTable = adminReferralSafeIdentifier($table);
            DB::fetchOne("SELECT 1 FROM {$safeTable} LIMIT 1");
            return true;
        } catch (Throwable $e) {
            error_log('admin referral tableExists direct select fallback: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('adminReferralColumnExists')) {
    function adminReferralColumnExists(string $table, string $column): bool {
        $table = trim($table);
        $column = trim($column);
        if ($table === '' || $column === '') return false;

        try {
            $safeTable = adminReferralSafeIdentifier($table);
            $row = DB::fetchOne("SHOW COLUMNS FROM {$safeTable} LIKE ?", [$column]);
            if (is_array($row) && !empty($row)) return true;
        } catch (Throwable $e) {
            error_log('admin referral columnExists show columns fallback: ' . $e->getMessage());
        }

        try {
            return (int)DB::fetchValue(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                [$table, $column]
            ) > 0;
        } catch (Throwable $e) {
            error_log('admin referral columnExists information_schema fallback: ' . $e->getMessage());
        }

        try {
            $safeTable = adminReferralSafeIdentifier($table);
            $safeColumn = adminReferralSafeIdentifier($column);
            DB::fetchOne("SELECT {$safeColumn} FROM {$safeTable} LIMIT 1");
            return true;
        } catch (Throwable $e) {
            error_log('admin referral columnExists direct select fallback: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('adminReferralTryExecute')) {
    function adminReferralTryExecute(string $sql, array $params = []): void {
        try {
            DB::execute($sql, $params);
        } catch (Throwable $e) {
            error_log('admin referral execute fallback: ' . $e->getMessage());
        }
    }
}

if (!function_exists('adminReferralFetchAllSafe')) {
    function adminReferralFetchAllSafe(string $sql, array $params = [], array $fallback = []): array {
        try {
            $rows = DB::fetchAll($sql, $params);
            return is_array($rows) ? $rows : $fallback;
        } catch (Throwable $e) {
            error_log('admin referral fetchAll fallback: ' . $e->getMessage());
            return $fallback;
        }
    }
}

if (!function_exists('adminReferralFetchOneSafe')) {
    function adminReferralFetchOneSafe(string $sql, array $params = [], array $fallback = []): array {
        try {
            $row = DB::fetchOne($sql, $params);
            return is_array($row) ? $row : $fallback;
        } catch (Throwable $e) {
            error_log('admin referral fetchOne fallback: ' . $e->getMessage());
            return $fallback;
        }
    }
}

if (!function_exists('adminReferralFetchValueSafe')) {
    function adminReferralFetchValueSafe(string $sql, array $params = [], $fallback = 0) {
        try {
            $value = DB::fetchValue($sql, $params);
            return $value !== null ? $value : $fallback;
        } catch (Throwable $e) {
            error_log('admin referral fetchValue fallback: ' . $e->getMessage());
            return $fallback;
        }
    }
}


if (!function_exists('adminReferralTableCollation')) {
    function adminReferralTableCollation(string $table): string {
        if (!adminReferralTableExists($table)) return '';
        try {
            $row = DB::fetchOne(
                "SELECT table_collation FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                [$table]
            );
            $collation = trim((string)($row['table_collation'] ?? ''));
            if ($collation !== '' && preg_match('/^[A-Za-z0-9_]+$/', $collation)) return $collation;
        } catch (Throwable $e) {
            error_log('admin referral tableCollation fallback: ' . $e->getMessage());
        }
        return '';
    }
}

if (!function_exists('adminReferralPreferredCollation')) {
    function adminReferralPreferredCollation(): string {
        static $cached = null;
        if ($cached !== null) return $cached;

        $candidates = [];
        foreach (['users', 'investment_contracts', 'assets', 'wallet_transactions'] as $table) {
            $collation = adminReferralTableCollation($table);
            if ($collation !== '') $candidates[] = $collation;
        }
        try {
            $dbCollation = trim((string)DB::fetchValue('SELECT @@collation_database'));
            if ($dbCollation !== '') $candidates[] = $dbCollation;
        } catch (Throwable $e) {
            error_log('admin referral preferredCollation fallback: ' . $e->getMessage());
        }
        foreach ($candidates as $candidate) {
            if (preg_match('/^[A-Za-z0-9_]+$/', (string)$candidate)) {
                $cached = (string)$candidate;
                return $cached;
            }
        }
        $cached = '';
        return $cached;
    }
}

if (!function_exists('adminReferralCreateTableTail')) {
    function adminReferralCreateTableTail(): string {
        $tail = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
        $collation = adminReferralPreferredCollation();
        if ($collation !== '') $tail .= ' COLLATE=' . $collation;
        return $tail;
    }
}

if (!function_exists('adminReferralIndexExists')) {
    function adminReferralIndexExists(string $table, string $index): bool {
        if (!adminReferralTableExists($table)) return false;
        try {
            $safeTable = adminReferralSafeIdentifier($table);
            $rows = DB::fetchAll("SHOW INDEX FROM {$safeTable} WHERE Key_name=?", [$index]);
            return !empty($rows);
        } catch (Throwable $e) {
            error_log('admin referral indexExists fallback: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('adminReferralEnsureIndex')) {
    function adminReferralEnsureIndex(string $table, string $index, string $sql): void {
        if (!adminReferralTableExists($table)) return;
        if (adminReferralIndexExists($table, $index)) return;
        adminReferralTryExecute($sql);
    }
}

if (!function_exists('adminReferralTryConvertTableCollation')) {
    function adminReferralTryConvertTableCollation(string $table): void {
        if (!adminReferralTableExists($table)) return;
        $preferred = adminReferralPreferredCollation();
        if ($preferred === '') return;
        $current = adminReferralTableCollation($table);
        if ($current === '' || strcasecmp($current, $preferred) === 0) return;
        $safeTable = adminReferralSafeIdentifier($table);
        adminReferralTryExecute("ALTER TABLE {$safeTable} CONVERT TO CHARACTER SET utf8mb4 COLLATE {$preferred}");
    }
}

if (!function_exists('adminReferralFirstFundingTimeExpr')) {
    function adminReferralFirstFundingTimeExpr(string $contractAlias = 'ic_prev'): string {
        if (adminReferralColumnExists('investment_contracts', 'otp_verified_at')) {
            return "COALESCE({$contractAlias}.otp_verified_at, {$contractAlias}.created_at)";
        }
        return "{$contractAlias}.created_at";
    }
}

if (!function_exists('adminReferralClearPendingBonus')) {
    function adminReferralClearPendingBonus(int $interestClaimId): void {
        if ($interestClaimId <= 0 || !adminReferralTableExists('pending_referral_bonuses')) return;
        adminReferralTryExecute("DELETE FROM pending_referral_bonuses WHERE interest_claim_id=?", [$interestClaimId]);
    }
}

if (!function_exists('adminReferralQueuePendingBonus')) {
    function adminReferralQueuePendingBonus(array $payload, string $lastError): void {
        ensureReferralTables();
        if (!adminReferralTableExists('pending_referral_bonuses')) return;

        $interestClaimId = isset($payload['interest_claim_id']) && (int)$payload['interest_claim_id'] > 0
            ? (int)$payload['interest_claim_id']
            : null;

        $params = [
            $interestClaimId,
            (string)($payload['referrer_address'] ?? ''),
            (string)($payload['investor_address'] ?? ''),
            (string)($payload['asset_id'] ?? ''),
            (string)($payload['month_key'] ?? ''),
            (float)($payload['investor_interest_usdt'] ?? 0),
            (float)($payload['bonus_rate'] ?? 0),
            (float)($payload['bonus_usdt'] ?? 0),
            mb_substr(trim($lastError), 0, 1000),
        ];

        $sql = "INSERT INTO pending_referral_bonuses
                    (interest_claim_id, referrer_address, investor_address, asset_id, month_key, investor_interest_usdt, bonus_rate, bonus_usdt, attempts, last_error, status)
                VALUES (?,?,?,?,?,?,?,?,1,?,'pending')
                ON DUPLICATE KEY UPDATE
                    referrer_address=VALUES(referrer_address),
                    investor_address=VALUES(investor_address),
                    asset_id=VALUES(asset_id),
                    month_key=VALUES(month_key),
                    investor_interest_usdt=VALUES(investor_interest_usdt),
                    bonus_rate=VALUES(bonus_rate),
                    bonus_usdt=VALUES(bonus_usdt),
                    attempts=attempts+1,
                    last_error=VALUES(last_error),
                    status='pending',
                    updated_at=CURRENT_TIMESTAMP";
        adminReferralTryExecute($sql, $params);
    }
}

if (!function_exists('adminReferralFetchPendingBonuses')) {
    function adminReferralFetchPendingBonuses(int $limit = 100): array {
        ensureReferralTables();
        if (!adminReferralTableExists('pending_referral_bonuses')) return [];
        $limit = max(1, min(500, $limit));
        return adminReferralFetchAllSafe(
            "SELECT * FROM pending_referral_bonuses WHERE status IN ('pending','failed') ORDER BY updated_at ASC, id ASC LIMIT {$limit}",
            [],
            []
        );
    }
}

if (!function_exists('adminReferralProcessPendingBonuses')) {
    function adminReferralProcessPendingBonuses(int $limit = 100): array {
        ensureReferralTables();
        $rows = adminReferralFetchPendingBonuses($limit);
        $summary = ['total' => count($rows), 'succeeded' => 0, 'failed' => 0, 'rows' => []];
        foreach ($rows as $row) {
            $claimId = (int)($row['interest_claim_id'] ?? 0);
            try {
                if ($claimId > 0 && adminReferralTableExists('referral_bonus_events')) {
                    $event = adminReferralFetchOneSafe(
                        "SELECT status, bonus_usdt FROM referral_bonus_events WHERE interest_claim_id=?",
                        [$claimId],
                        []
                    );
                    if (($event['status'] ?? '') === 'completed') {
                        adminReferralClearPendingBonus($claimId);
                        $summary['succeeded']++;
                        $summary['rows'][] = [
                            'interest_claim_id' => $claimId,
                            'status' => 'already_completed',
                            'bonus_usdt' => (float)($event['bonus_usdt'] ?? 0),
                        ];
                        continue;
                    }
                }

                $bonusUsdt = awardReferralBonusForInterest(
                    (string)($row['investor_address'] ?? ''),
                    (string)($row['asset_id'] ?? ''),
                    (string)($row['month_key'] ?? ''),
                    (float)($row['investor_interest_usdt'] ?? 0),
                    $claimId,
                    isset($row['bonus_rate']) ? (float)$row['bonus_rate'] : null,
                    false
                );
                if ($claimId > 0) adminReferralClearPendingBonus($claimId);
                $summary['succeeded']++;
                $summary['rows'][] = [
                    'interest_claim_id' => $claimId,
                    'status' => 'paid',
                    'bonus_usdt' => $bonusUsdt,
                ];
            } catch (Throwable $e) {
                $summary['failed']++;
                adminReferralQueuePendingBonus($row, $e->getMessage());
                $summary['rows'][] = [
                    'interest_claim_id' => $claimId,
                    'status' => 'failed',
                    'message' => $e->getMessage(),
                ];
            }
        }
        return $summary;
    }
}

if (!function_exists('adminReferralUserNicknameExpr')) {
    function adminReferralUserNicknameExpr(string $tableAlias = 'u', string $alias = 'nickname'): string {
        if (!adminReferralTableExists('users')) return "NULL AS {$alias}";
        if (adminReferralColumnExists('users', 'mt_name')) return "{$tableAlias}.mt_name AS {$alias}";
        if (adminReferralColumnExists('users', 'nickname')) return "{$tableAlias}.nickname AS {$alias}";
        return "NULL AS {$alias}";
    }
}

if (!function_exists('adminReferralAssetNameExpr')) {
    function adminReferralAssetNameExpr(string $tableAlias = 'a', string $fallbackColumn = 'rb.asset_id', string $alias = 'asset_name'): string {
        if (!adminReferralTableExists('assets')) return "{$fallbackColumn} AS {$alias}";
        if (adminReferralColumnExists('assets', 'name')) return "COALESCE({$tableAlias}.name, {$fallbackColumn}) AS {$alias}";
        if (adminReferralColumnExists('assets', 'title')) return "COALESCE({$tableAlias}.title, {$fallbackColumn}) AS {$alias}";
        return "{$fallbackColumn} AS {$alias}";
    }
}

if (!function_exists('adminReferralCanValidateFirstFunding')) {
    function adminReferralCanValidateFirstFunding(): bool {
        return adminReferralTableExists('investment_contracts')
            && adminReferralColumnExists('investment_contracts', 'address')
            && adminReferralColumnExists('investment_contracts', 'status')
            && adminReferralColumnExists('investment_contracts', 'created_at');
    }
}

if (!function_exists('adminReferralLinkPredicate')) {
    function adminReferralLinkPredicate(string $linkAlias = 'rl'): string {
        $parts = ["BINARY {$linkAlias}.referrer_address <> BINARY {$linkAlias}.investor_address"];
        if (adminReferralCanValidateFirstFunding()) {
            $firstFundingTimeExpr = adminReferralFirstFundingTimeExpr('ic_prev');
            $parts[] = "NOT EXISTS (
                SELECT 1
                FROM investment_contracts ic_prev
                WHERE BINARY ic_prev.address = BINARY {$linkAlias}.investor_address
                  AND ic_prev.status IN ('awaiting_admin','completed')
                  AND {$firstFundingTimeExpr} < {$linkAlias}.created_at
            )";
        }
        return implode("\n                   AND ", $parts);
    }
}

if (!function_exists('adminReferralCountForReferrer')) {
    function adminReferralCountForReferrer(string $address): int {
        if (!adminReferralTableExists('referral_links')) return 0;
        $sql = "SELECT COUNT(*)
                  FROM referral_links rl
                 WHERE BINARY rl.referrer_address = BINARY ?
                   AND " . adminReferralLinkPredicate('rl');
        return (int)adminReferralFetchValueSafe($sql, [$address], 0);
    }
}

if (!function_exists('adminReferralTotalBonusForReferrer')) {
    function adminReferralTotalBonusForReferrer(string $address): float {
        if (!adminReferralTableExists('referral_bonuses') || !adminReferralColumnExists('referral_bonuses', 'bonus_usdt')) return 0.0;
        return (float)adminReferralFetchValueSafe(
            "SELECT COALESCE(SUM(bonus_usdt), 0) FROM referral_bonuses WHERE BINARY referrer_address = BINARY ?",
            [$address],
            0
        );
    }
}


if (!function_exists('adminReferralHasReferrerIdColumn')) {
    function adminReferralHasReferrerIdColumn(): bool {
        static $cached = null;
        if ($cached !== null) return $cached;
        $cached = adminReferralColumnExists('referrer_codes', 'id');
        return $cached;
    }
}

if (!function_exists('adminReferralSelectRowKeyExpr')) {
    function adminReferralSelectRowKeyExpr(string $tableAlias = 'rc', string $alias = 'row_key'): string {
        if (adminReferralHasReferrerIdColumn()) return "CAST({$tableAlias}.id AS CHAR) AS {$alias}";
        return "{$tableAlias}.address AS {$alias}";
    }
}

if (!function_exists('adminReferralReferrerOrderExpr')) {
    function adminReferralReferrerOrderExpr(string $tableAlias = 'rc'): string {
        if (adminReferralHasReferrerIdColumn()) return "{$tableAlias}.id DESC";
        if (adminReferralColumnExists('referrer_codes', 'created_at')) return "{$tableAlias}.created_at DESC, {$tableAlias}.address DESC";
        return "{$tableAlias}.address DESC";
    }
}

if (!function_exists('adminReferralFindReferrerByKey')) {
    function adminReferralFindReferrerByKey($key): array {
        $key = trim((string)$key);
        if ($key === '') return [];

        if (adminReferralHasReferrerIdColumn() && ctype_digit($key)) {
            $row = adminReferralFetchOneSafe("SELECT * FROM referrer_codes WHERE id=?", [(int)$key], []);
            if ($row) return $row;
        }

        return adminReferralFetchOneSafe("SELECT * FROM referrer_codes WHERE BINARY address = BINARY ?", [$key], []);
    }
}

if (!function_exists('adminReferralPrimaryIdentifier')) {
    function adminReferralPrimaryIdentifier(array $row): string {
        if (array_key_exists('id', $row) && $row['id'] !== null && $row['id'] !== '') {
            return (string)$row['id'];
        }
        return trim((string)($row['address'] ?? ''));
    }
}

// Auto-create referral tables and gently backfill missing columns if schema is older.
function ensureReferralTables(): void {
    static $done = false;
    if ($done) return;
    $done = true;

    $tableTail = adminReferralCreateTableTail();

    adminReferralTryExecute("CREATE TABLE IF NOT EXISTS `referrer_codes` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `address` VARCHAR(64) NOT NULL,
        `code` VARCHAR(32) NOT NULL,
        `is_active` TINYINT(1) NOT NULL DEFAULT 1,
        `approved_by` VARCHAR(64) DEFAULT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_rc_address (`address`),
        UNIQUE KEY uk_rc_code (`code`),
        INDEX idx_rc_code (`code`),
        INDEX idx_rc_address (`address`)
    ) {$tableTail}");

    adminReferralTryExecute("CREATE TABLE IF NOT EXISTS `referral_links` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `investor_address` VARCHAR(64) NOT NULL,
        `referrer_address` VARCHAR(64) NOT NULL,
        `referrer_code` VARCHAR(32) NOT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_investor (`investor_address`),
        INDEX idx_rl_referrer (`referrer_address`)
    ) {$tableTail}");

    adminReferralTryExecute("CREATE TABLE IF NOT EXISTS `referral_bonuses` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `referrer_address` VARCHAR(64) NOT NULL,
        `investor_address` VARCHAR(64) NOT NULL,
        `asset_id` VARCHAR(16) NOT NULL,
        `month_key` VARCHAR(32) NOT NULL,
        `investor_interest_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
        `bonus_rate` DECIMAL(8,6) NOT NULL DEFAULT 0.01,
        `bonus_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rb_referrer (`referrer_address`),
        INDEX idx_rb_month (`month_key`),
        UNIQUE KEY uk_rb_unique (`referrer_address`, `investor_address`, `asset_id`, `month_key`)
    ) {$tableTail}");

    adminReferralTryExecute("CREATE TABLE IF NOT EXISTS `referral_bonus_events` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `interest_claim_id` BIGINT NOT NULL,
        `referrer_address` VARCHAR(64) NOT NULL,
        `investor_address` VARCHAR(64) NOT NULL,
        `asset_id` VARCHAR(16) NOT NULL,
        `month_key` VARCHAR(32) NOT NULL,
        `investor_interest_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
        `bonus_rate` DECIMAL(8,6) NOT NULL DEFAULT 0.01,
        `bonus_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
        `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
        `last_error` TEXT DEFAULT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_rbe_interest_claim (`interest_claim_id`),
        INDEX idx_rbe_referrer (`referrer_address`),
        INDEX idx_rbe_status (`status`)
    ) {$tableTail}");

    adminReferralTryExecute("CREATE TABLE IF NOT EXISTS `pending_referral_bonuses` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `interest_claim_id` BIGINT DEFAULT NULL,
        `referrer_address` VARCHAR(64) NOT NULL,
        `investor_address` VARCHAR(64) NOT NULL,
        `asset_id` VARCHAR(16) NOT NULL,
        `month_key` VARCHAR(32) NOT NULL,
        `investor_interest_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
        `bonus_rate` DECIMAL(8,6) NOT NULL DEFAULT 0.01,
        `bonus_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
        `attempts` INT NOT NULL DEFAULT 0,
        `last_error` TEXT DEFAULT NULL,
        `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_prb_interest_claim (`interest_claim_id`),
        INDEX idx_prb_status (`status`),
        INDEX idx_prb_referrer (`referrer_address`)
    ) {$tableTail}");

    $alterMap = [
        'referrer_codes' => [
            'is_active' => "ALTER TABLE `referrer_codes` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `code`",
            'approved_by' => "ALTER TABLE `referrer_codes` ADD COLUMN `approved_by` VARCHAR(64) DEFAULT NULL AFTER `is_active`",
            'created_at' => "ALTER TABLE `referrer_codes` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `approved_by`",
            'updated_at' => "ALTER TABLE `referrer_codes` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`",
        ],
        'referral_links' => [
            'referrer_code' => "ALTER TABLE `referral_links` ADD COLUMN `referrer_code` VARCHAR(32) NOT NULL DEFAULT '' AFTER `referrer_address`",
            'created_at' => "ALTER TABLE `referral_links` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `referrer_code`",
        ],
        'referral_bonuses' => [
            'month_key' => "ALTER TABLE `referral_bonuses` ADD COLUMN `month_key` VARCHAR(32) NOT NULL DEFAULT '' AFTER `asset_id`",
            'investor_interest_usdt' => "ALTER TABLE `referral_bonuses` ADD COLUMN `investor_interest_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0 AFTER `month_key`",
            'bonus_rate' => "ALTER TABLE `referral_bonuses` ADD COLUMN `bonus_rate` DECIMAL(8,6) NOT NULL DEFAULT 0.01 AFTER `investor_interest_usdt`",
            'bonus_usdt' => "ALTER TABLE `referral_bonuses` ADD COLUMN `bonus_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0 AFTER `bonus_rate`",
            'created_at' => "ALTER TABLE `referral_bonuses` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `bonus_usdt`",
        ],
        'referral_bonus_events' => [
            'interest_claim_id' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `interest_claim_id` BIGINT NOT NULL AFTER `id`",
            'referrer_address' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `referrer_address` VARCHAR(64) NOT NULL AFTER `interest_claim_id`",
            'investor_address' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `investor_address` VARCHAR(64) NOT NULL AFTER `referrer_address`",
            'asset_id' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `asset_id` VARCHAR(16) NOT NULL AFTER `investor_address`",
            'month_key' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `month_key` VARCHAR(32) NOT NULL DEFAULT '' AFTER `asset_id`",
            'investor_interest_usdt' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `investor_interest_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0 AFTER `month_key`",
            'bonus_rate' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `bonus_rate` DECIMAL(8,6) NOT NULL DEFAULT 0.01 AFTER `investor_interest_usdt`",
            'bonus_usdt' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `bonus_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0 AFTER `bonus_rate`",
            'status' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'completed' AFTER `bonus_usdt`",
            'last_error' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `last_error` TEXT DEFAULT NULL AFTER `status`",
            'created_at' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `last_error`",
            'updated_at' => "ALTER TABLE `referral_bonus_events` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`",
        ],
        'pending_referral_bonuses' => [
            'interest_claim_id' => "ALTER TABLE `pending_referral_bonuses` ADD COLUMN `interest_claim_id` BIGINT DEFAULT NULL AFTER `id`",
            'attempts' => "ALTER TABLE `pending_referral_bonuses` ADD COLUMN `attempts` INT NOT NULL DEFAULT 0 AFTER `bonus_usdt`",
            'last_error' => "ALTER TABLE `pending_referral_bonuses` ADD COLUMN `last_error` TEXT DEFAULT NULL AFTER `attempts`",
            'status' => "ALTER TABLE `pending_referral_bonuses` ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER `last_error`",
            'created_at' => "ALTER TABLE `pending_referral_bonuses` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `status`",
            'updated_at' => "ALTER TABLE `pending_referral_bonuses` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`",
        ],
    ];

    foreach ($alterMap as $table => $columns) {
        if (!adminReferralTableExists($table)) continue;
        adminReferralTryConvertTableCollation($table);
        foreach ($columns as $column => $sql) {
            if (!adminReferralColumnExists($table, $column)) {
                adminReferralTryExecute($sql);
            }
        }
    }

    foreach (['referral_bonuses', 'pending_referral_bonuses', 'referral_bonus_events'] as $table) {
        if (!adminReferralTableExists($table) || !adminReferralColumnExists($table, 'month_key')) continue;
        try {
            $col = DB::fetchOne("SHOW COLUMNS FROM `{$table}` LIKE 'month_key'");
            $type = strtolower((string)($col['Type'] ?? ''));
            if (preg_match('/char\((\d+)\)/', $type, $m) && ((int)$m[1]) < 32) {
                adminReferralTryExecute("ALTER TABLE `{$table}` MODIFY COLUMN `month_key` VARCHAR(32) NOT NULL");
            }
        } catch (Throwable $e) {
            error_log('admin referral widen ' . $table . '.month_key: ' . $e->getMessage());
        }
    }

    adminReferralEnsureIndex('referrer_codes', 'uk_rc_address', "ALTER TABLE `referrer_codes` ADD UNIQUE KEY `uk_rc_address` (`address`)");
    adminReferralEnsureIndex('referrer_codes', 'uk_rc_code', "ALTER TABLE `referrer_codes` ADD UNIQUE KEY `uk_rc_code` (`code`)");
    adminReferralEnsureIndex('referrer_codes', 'idx_rc_code', "ALTER TABLE `referrer_codes` ADD INDEX `idx_rc_code` (`code`)");
    adminReferralEnsureIndex('referrer_codes', 'idx_rc_address', "ALTER TABLE `referrer_codes` ADD INDEX `idx_rc_address` (`address`)");

    adminReferralEnsureIndex('referral_links', 'uk_investor', "ALTER TABLE `referral_links` ADD UNIQUE KEY `uk_investor` (`investor_address`)");
    adminReferralEnsureIndex('referral_links', 'idx_rl_referrer', "ALTER TABLE `referral_links` ADD INDEX `idx_rl_referrer` (`referrer_address`)");

    adminReferralEnsureIndex('referral_bonuses', 'idx_rb_referrer', "ALTER TABLE `referral_bonuses` ADD INDEX `idx_rb_referrer` (`referrer_address`)");
    adminReferralEnsureIndex('referral_bonuses', 'idx_rb_month', "ALTER TABLE `referral_bonuses` ADD INDEX `idx_rb_month` (`month_key`)");
    adminReferralEnsureIndex('referral_bonuses', 'uk_rb_unique', "ALTER TABLE `referral_bonuses` ADD UNIQUE KEY `uk_rb_unique` (`referrer_address`,`investor_address`,`asset_id`,`month_key`)");

    adminReferralEnsureIndex('referral_bonus_events', 'uk_rbe_interest_claim', "ALTER TABLE `referral_bonus_events` ADD UNIQUE KEY `uk_rbe_interest_claim` (`interest_claim_id`)");
    adminReferralEnsureIndex('referral_bonus_events', 'idx_rbe_referrer', "ALTER TABLE `referral_bonus_events` ADD INDEX `idx_rbe_referrer` (`referrer_address`)");
    adminReferralEnsureIndex('referral_bonus_events', 'idx_rbe_status', "ALTER TABLE `referral_bonus_events` ADD INDEX `idx_rbe_status` (`status`)");

    adminReferralEnsureIndex('pending_referral_bonuses', 'uk_prb_interest_claim', "ALTER TABLE `pending_referral_bonuses` ADD UNIQUE KEY `uk_prb_interest_claim` (`interest_claim_id`)");
    adminReferralEnsureIndex('pending_referral_bonuses', 'idx_prb_status', "ALTER TABLE `pending_referral_bonuses` ADD INDEX `idx_prb_status` (`status`)");
    adminReferralEnsureIndex('pending_referral_bonuses', 'idx_prb_referrer', "ALTER TABLE `pending_referral_bonuses` ADD INDEX `idx_prb_referrer` (`referrer_address`)");
}

/**
 * Get the admin-configured referral bonus rate (default 0.01 = 1%)
 */
function getReferralBonusRate(): float {
    $rate = getSetting('referral_bonus_rate', '0.01');
    $val = (float)$rate;
    if (!is_finite($val) || $val < 0 || $val > 1) return 0.01;
    return $val;
}

/**
 * Generate a unique referral code (8 chars alphanumeric)
 */
function generateReferralCode(): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $exists = adminReferralFetchValueSafe("SELECT COUNT(*) FROM referrer_codes WHERE BINARY code = BINARY ?", [$code], 0);
    } while ((int)$exists > 0);
    return $code;
}

/**
 * GET /api/admin/referrals
 * List all referrer codes (approved referrers)
 */
get('/api/admin/referrals', function () {
    adminOnly();
    ensureReferralTables();

    $nicknameExpr = adminReferralUserNicknameExpr('u', 'nickname');
    $rowKeyExpr = adminReferralSelectRowKeyExpr('rc', 'row_key');
    $orderExpr = adminReferralReferrerOrderExpr('rc');
    $joinUsers = adminReferralTableExists('users') ? 'LEFT JOIN users u ON BINARY u.address = BINARY rc.address' : '';

    $rawCount = (int)adminReferralFetchValueSafe("SELECT COUNT(*) FROM referrer_codes", [], 0);
    $rows = adminReferralFetchAllSafe(
        "SELECT rc.*, {$nicknameExpr}, {$rowKeyExpr}
           FROM referrer_codes rc
           {$joinUsers}
          ORDER BY {$orderExpr}",
        [],
        []
    );

    if (!$rows && $rawCount > 0) {
        $rows = adminReferralFetchAllSafe(
            "SELECT rc.*, NULL AS nickname, {$rowKeyExpr}
               FROM referrer_codes rc
              ORDER BY {$orderExpr}",
            [],
            []
        );
    }

    foreach ($rows as &$row) {
        $row['nickname'] = decodeMaybeStoredText($row['nickname'] ?? null);
        $row['referral_count'] = adminReferralCountForReferrer((string)($row['address'] ?? ''));
        $row['total_bonus_usdt'] = adminReferralTotalBonusForReferrer((string)($row['address'] ?? ''));
        $row['is_active'] = !empty($row['is_active']) ? 1 : 0;
        $row['id'] = adminReferralPrimaryIdentifier($row);
        $row['row_key'] = (string)($row['row_key'] ?? $row['id']);
    }
    unset($row);

    jsonOk(['referrers' => $rows, 'raw_count' => $rawCount]);
});

/**
 * POST /api/admin/referrals/approve
 * Approve a user as a referrer and generate their code
 */
post('/api/admin/referrals/approve', function () {
    $admin = adminAuth();
    ensureReferralTables();

    $body = getJsonBody();
    try {
        $address = normalizeSolanaAddress((string)($body['address'] ?? ''), '추천인 지갑주소');
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }

    ensureUser($address);

    $existing = adminReferralFetchOneSafe("SELECT * FROM referrer_codes WHERE BINARY address = BINARY ?", [$address], []);
    if ($existing) {
        $existingKey = adminReferralPrimaryIdentifier($existing);
        jsonOk([
            'message' => '이미 추천인으로 승인된 유저입니다.',
            'code' => $existing['code'] ?? null,
            'address' => $address,
            'id' => $existingKey,
            'row_key' => $existingKey,
            'already_exists' => true,
        ]);
    }

    $code = generateReferralCode();
    DB::execute(
        "INSERT INTO referrer_codes(address, code, is_active, approved_by) VALUES (?,?,1,?)",
        [$address, $code, $admin['username'] ?? 'admin']
    );

    $created = adminReferralFetchOneSafe("SELECT * FROM referrer_codes WHERE BINARY address = BINARY ?", [$address], []);
    $createdKey = adminReferralPrimaryIdentifier($created ?: ['address' => $address]);

    jsonOk([
        'code' => $code,
        'address' => $address,
        'id' => $createdKey,
        'row_key' => $createdKey,
        'already_exists' => false,
    ]);
});

/**
 * POST /api/admin/referrals/:id/toggle
 * Activate/deactivate a referrer
 */
post('/api/admin/referrals/:id/toggle', function ($p) {
    adminOnly();
    ensureReferralTables();

    $key = trim((string)($p['id'] ?? ''));
    $row = adminReferralFindReferrerByKey($key);
    if (!$row) jsonError(404, '추천인을 찾을 수 없습니다.');

    $newActive = !empty($row['is_active']) ? 0 : 1;
    DB::execute("UPDATE referrer_codes SET is_active=? WHERE BINARY address = BINARY ?", [$newActive, $row['address']]);

    jsonOk(['is_active' => $newActive, 'row_key' => adminReferralPrimaryIdentifier($row)]);
});

/**
 * GET /api/admin/referrals/:id/details
 * Get detailed info about a referrer's referral links and bonuses
 */
get('/api/admin/referrals/:id/details', function ($p) {
    adminOnly();
    ensureReferralTables();

    $key = trim((string)($p['id'] ?? ''));
    $referrer = adminReferralFindReferrerByKey($key);
    if (!$referrer) jsonError(404, '추천인을 찾을 수 없습니다.');

    $links = [];
    if (adminReferralTableExists('referral_links')) {
        $nicknameExpr = adminReferralUserNicknameExpr('u', 'investor_nickname');
        $joinUsers = adminReferralTableExists('users') ? 'LEFT JOIN users u ON BINARY u.address = BINARY rl.investor_address' : '';
        $links = adminReferralFetchAllSafe(
            "SELECT rl.investor_address, rl.created_at, {$nicknameExpr}
               FROM referral_links rl
               {$joinUsers}
              WHERE BINARY rl.referrer_address = BINARY ?
                AND " . adminReferralLinkPredicate('rl') . "
              ORDER BY rl.created_at DESC",
            [$referrer['address']],
            []
        );
        foreach ($links as &$link) {
            $link['investor_nickname'] = decodeMaybeStoredText($link['investor_nickname'] ?? null);
        }
        unset($link);
    }

    $bonuses = [];
    if (adminReferralTableExists('referral_bonuses')) {
        $assetExpr = adminReferralAssetNameExpr('a', 'rb.asset_id', 'asset_name');
        $joinAssets = adminReferralTableExists('assets') ? 'LEFT JOIN assets a ON BINARY a.id = BINARY rb.asset_id' : '';
        $bonuses = adminReferralFetchAllSafe(
            "SELECT rb.*, {$assetExpr}
               FROM referral_bonuses rb
               {$joinAssets}
              WHERE BINARY rb.referrer_address = BINARY ?
              ORDER BY rb.created_at DESC
              LIMIT 100",
            [$referrer['address']],
            []
        );
    }

    $referrer['id'] = adminReferralPrimaryIdentifier($referrer);
    $referrer['row_key'] = $referrer['id'];

    jsonOk([
        'referrer' => $referrer,
        'links' => $links,
        'bonuses' => $bonuses,
    ]);
});

/**
 * DELETE /api/admin/referrals/:id
 * Remove a referrer
 */
post('/api/admin/referrals/:id/delete', function ($p) {
    adminOnly();
    ensureReferralTables();

    $key = trim((string)($p['id'] ?? ''));
    $row = adminReferralFindReferrerByKey($key);
    if (!$row) jsonError(404, '추천인을 찾을 수 없습니다.');

    DB::execute("DELETE FROM referrer_codes WHERE BINARY address = BINARY ?", [$row['address']]);
    jsonOk(['deleted' => true, 'row_key' => adminReferralPrimaryIdentifier($row)]);
});

// ====== Referral Bonus Rate Settings ======

/**
 * GET /api/admin/settings/referral
 * Get the current referral bonus rate
 */
get('/api/admin/settings/referral', function () {
    adminOnly();
    $rate = getReferralBonusRate();
    jsonOk([
        'referral_bonus_rate' => $rate,
        'referral_bonus_pct'  => round($rate * 100, 2),
    ]);
});

/**
 * POST /api/admin/settings/referral
 * Update the referral bonus rate
 */
post('/api/admin/settings/referral', function () {
    adminOnly();
    $body = getJsonBody();

    if (isset($body['referral_bonus_rate'])) {
        $rate = (float)$body['referral_bonus_rate'];
    } elseif (isset($body['referral_bonus_pct'])) {
        $rate = (float)$body['referral_bonus_pct'] / 100;
    } else {
        jsonError(400, '보상률을 입력하세요. (referral_bonus_rate 또는 referral_bonus_pct)');
    }

    // (2026-05-16 v420) 운영자: 1% 미만 값도 입력 가능하게 (최소 0.01%).
    //   0.01% = 0.0001 (rate) — round(4) 저장 정밀도와 일치. 0 / 음수는 차단:
    //   추천 보상 기능 자체를 끄려면 referrer_codes.is_active=0 로 끄거나
    //   추천인 미등록 상태로 운영해야 한다. rate=0 이면 보상이 INSERT 단계까지
    //   가서 SUM=0 의무 클레임이 발생할 수 있어 별도 처리 필요 → UI 에서 차단.
    if (!is_finite($rate) || $rate < 0.0001 || $rate > 0.5) {
        jsonError(400, '보상률은 0.01%~50% 사이여야 합니다.');
    }

    setSetting('referral_bonus_rate', (string)round($rate, 4));

    jsonOk([
        'referral_bonus_rate' => $rate,
        'referral_bonus_pct'  => round($rate * 100, 2),
        'saved' => true,
    ]);
});

// ====== Failed Referral Bonus Retry ======

/**
 * GET /api/admin/referrals/pending-bonuses
 * 실패하거나 보류된 추천 보상 재처리 대기열 조회
 */
get('/api/admin/referrals/pending-bonuses', function () {
    adminOnly();
    ensureReferralTables();
    $pending = adminReferralFetchPendingBonuses(200);
    jsonOk([
        'pending' => $pending,
        'failed_count' => count($pending),
    ]);
});

/**
 * POST /api/admin/referrals/retry-bonuses
 * 실패/보류된 추천 보상을 다시 시도
 */
post('/api/admin/referrals/retry-bonuses', function () {
    adminOnly();
    $body = getJsonBody();
    $limit = isset($body['limit']) ? (int)$body['limit'] : 100;
    $summary = adminReferralProcessPendingBonuses($limit);
    jsonOk($summary);
});
