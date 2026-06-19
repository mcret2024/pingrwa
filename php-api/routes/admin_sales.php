<?php
/**
 * Admin Sales routes
 */

if (!function_exists('adminSalesColumnCache')) {
    function &adminSalesColumnCache(): ?array {
        static $cache = null;
        return $cache;
    }
}

if (!function_exists('adminSalesRefreshColumnCache')) {
    function adminSalesRefreshColumnCache(): void {
        $cache =& adminSalesColumnCache();
        $cache = null;
    }
}

if (!function_exists('adminSalesColumnExists')) {
    function adminSalesColumnExists(string $column): bool {
        $cache =& adminSalesColumnCache();
        if ($cache === null) {
            $cache = [];
            try {
                $rows = DB::fetchAll("SHOW COLUMNS FROM `sales`");
                foreach ($rows as $row) {
                    $field = (string)($row['Field'] ?? '');
                    if ($field !== '') $cache[$field] = true;
                }
            } catch (Throwable $e) {
                $cache = [];
            }
        }
        return !empty($cache[$column]);
    }
}

if (!function_exists('adminSalesEnsureDraftSchema')) {
    function adminSalesEnsureDraftSchema(): void {
        static $done = false;
        if ($done) return;
        $done = true;

        try {
            $pdo = DB::pdo();
            $tables = $pdo->query("SHOW TABLES LIKE 'sales'")->fetchAll();
            if (empty($tables)) return;

            $changed = false;
            $requiredColumns = [
                'actual_acquisition_cost_input' => "ALTER TABLE `sales` ADD COLUMN `actual_acquisition_cost_input` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `buy_price_krw`",
                'sale_tax_amount' => "ALTER TABLE `sales` ADD COLUMN `sale_tax_amount` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `sold_price_krw`",
                'other_expenses_input' => "ALTER TABLE `sales` ADD COLUMN `other_expenses_input` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `sale_tax_amount`",
                'manual_fx_per_usdt' => "ALTER TABLE `sales` ADD COLUMN `manual_fx_per_usdt` DECIMAL(24,6) NOT NULL DEFAULT 0 AFTER `other_expenses_input`",
            ];
            foreach ($requiredColumns as $column => $sql) {
                $rows = $pdo->query("SHOW COLUMNS FROM `sales` LIKE '{$column}'")->fetchAll();
                if (empty($rows)) {
                    $pdo->exec($sql);
                    $changed = true;
                }
            }

            $taxMeta = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'sale_tax_amount'")->fetchAll();
            if (!empty($taxMeta)) {
                $type = strtolower((string)($taxMeta[0]['Type'] ?? ''));
                if (strpos($type, 'decimal') === false) {
                    $pdo->exec("ALTER TABLE `sales` MODIFY COLUMN `sale_tax_amount` DECIMAL(24,6) NOT NULL DEFAULT 0");
                    $changed = true;
                }
            }

            $otherMeta = $pdo->query("SHOW COLUMNS FROM `sales` LIKE 'other_expenses_input'")->fetchAll();
            if (!empty($otherMeta)) {
                $type = strtolower((string)($otherMeta[0]['Type'] ?? ''));
                if (strpos($type, 'decimal') === false) {
                    $pdo->exec("ALTER TABLE `sales` MODIFY COLUMN `other_expenses_input` DECIMAL(24,6) NOT NULL DEFAULT 0");
                    $changed = true;
                }
                try {
                    $pdo->exec("UPDATE `sales` SET `other_expenses_input` = COALESCE(NULLIF(`other_expenses_input`,0), `expenses_krw`, 0) WHERE (COALESCE(`other_expenses_input`,0) = 0) AND COALESCE(`expenses_krw`,0) > 0");
                } catch (Throwable $e) {}
            }

            if ($changed) adminSalesRefreshColumnCache();
        } catch (Throwable $e) {
            // Ignore here. Write routes will surface a clear error if the storage columns still cannot be used.
        }
    }
}

if (!function_exists('adminSalesRequireDraftColumns')) {
    function adminSalesRequireDraftColumns(): void {
        adminSalesEnsureDraftSchema();
        $required = ['actual_acquisition_cost_input', 'sale_tax_amount', 'other_expenses_input', 'manual_fx_per_usdt'];
        $missing = [];
        foreach ($required as $column) {
            if (!adminSalesColumnExists($column)) $missing[] = $column;
        }
        if ($missing) {
            throw new RuntimeException('매각 저장용 컬럼이 준비되지 않았습니다. sql/manual_sales_storage_patch.sql을 먼저 적용하세요.', 500);
        }
    }
}

if (!function_exists('adminSalesGetRawActualAcquisitionInput')) {
    function adminSalesGetRawActualAcquisitionInput(array $row, float $fallback = 0.0): float {
        $raw = isset($row['actual_acquisition_cost_input']) ? (float)$row['actual_acquisition_cost_input'] : 0.0;
        if ($raw > 0) return clamp6($raw);
        $legacy = isset($row['actual_acquisition_cost']) ? (float)$row['actual_acquisition_cost'] : 0.0;
        if ($legacy > 0) return clamp6($legacy);
        $buy = isset($row['buy_price_input']) ? (float)$row['buy_price_input'] : (isset($row['buy_price_krw']) ? (float)$row['buy_price_krw'] : 0.0);
        if ($buy > 0 && $fallback <= 0) return clamp6($buy);
        return clamp6(max(0.0, $fallback > 0 ? $fallback : $buy));
    }
}

if (!function_exists('adminSalesGetRawTaxInput')) {
    function adminSalesGetRawTaxInput(array $row): float {
        foreach (['sale_tax_amount', 'sale_tax_input'] as $key) {
            if (isset($row[$key]) && is_numeric($row[$key])) {
                return clamp6(max(0.0, (float)$row[$key]));
            }
        }
        return 0.0;
    }
}

if (!function_exists('adminSalesGetRawOtherExpensesInput')) {
    function adminSalesGetRawOtherExpensesInput(array $row): float {
        foreach (['other_expenses_input', 'other_expenses_amount'] as $key) {
            if (isset($row[$key]) && is_numeric($row[$key])) {
                return clamp6(max(0.0, (float)$row[$key]));
            }
        }
        if (isset($row['expenses_input']) && is_numeric($row['expenses_input'])) {
            $candidate = (float)$row['expenses_input'] - adminSalesGetRawTaxInput($row);
            if ($candidate >= 0) return clamp6($candidate);
        }
        if (isset($row['expenses_krw']) && is_numeric($row['expenses_krw'])) {
            return clamp6(max(0.0, (float)$row['expenses_krw']));
        }
        return 0.0;
    }
}

if (!function_exists('adminSalesFormatLockDays')) {
    function adminSalesFormatLockDays(array $days): string {
        $days = array_values(array_unique(array_map(fn($d) => (int)$d, $days)));
        sort($days);
        if (!$days) return '';
        if (count($days) >= 2) {
            $sequential = true;
            for ($i = 1; $i < count($days); $i++) {
                if ($days[$i] !== $days[$i - 1] + 1) {
                    $sequential = false;
                    break;
                }
            }
            if ($sequential) {
                return $days[0] . '~' . $days[count($days) - 1] . '일';
            }
        }
        return implode(', ', $days) . '일';
    }
}

if (!function_exists('adminSalesExecutionLockInfo')) {
    function adminSalesExecutionLockInfo(): array {
        $days = array_values(array_unique(array_map(fn($d) => (int)$d, STAKING_LOCK_DAYS)));
        sort($days);
        $now = nowKST();
        $today = (int)$now->format('j');
        $locked = in_array($today, $days, true);
        $nextOpen = null;
        if ($locked) {
            if ($days) {
                $monthStart = new DateTimeImmutable($now->format('Y-m-01 00:00:00'), new DateTimeZone(TZ));
                $nextOpen = $monthStart->modify('+' . max($days) . ' days');
            } else {
                $nextOpen = $now;
            }
        }
        return [
            'is_locked' => $locked,
            'lock_days' => $days,
            'lock_label' => adminSalesFormatLockDays($days),
            'today_kst' => $now->format('Y-m-d'),
            'now_kst' => $now->format('Y-m-d H:i:s'),
            'next_open_kst' => $nextOpen ? $nextOpen->format('Y-m-d H:i:s') : null,
            'next_open_label' => $nextOpen ? ($nextOpen->format('Y-m-d 00:00') . ' KST') : null,
            'message' => $locked
                ? ('정산 제한 기간(' . adminSalesFormatLockDays($days) . ')에는 매각 최종 실행을 할 수 없습니다. 저장과 문서 업로드 등 준비 작업은 계속할 수 있으며, 매각일은 과거 날짜로 자유롭게 저장할 수 있습니다. 이미 실행된 매각 건의 유저 매각 자산 교환은 계속 가능합니다. ' . ($nextOpen ? ($nextOpen->format('Y-m-d 00:00') . ' KST') : '정산 가능 시점') . ' 이후 다시 시도하세요.')
                : '',
        ];
    }
}


if (!function_exists('adminSalesMinSelectableSaleDateKST')) {
    function adminSalesMinSelectableSaleDateKST(): ?string {
        return null;
    }
}

if (!function_exists('adminSalesSaleDateRuleInfo')) {
    function adminSalesSaleDateRuleInfo(): array {
        $days = array_values(array_unique(array_map(fn($d) => (int)$d, STAKING_LOCK_DAYS)));
        $days = array_values(array_filter($days, fn($d) => $d > 0));
        sort($days);
        return [
            'min_sale_date' => null,
            'restricted' => false,
            'message' => '',
            'threshold_day' => $days ? min($days) : 14,
            'lock_days' => $days,
            'lock_label' => adminSalesFormatLockDays($days),
        ];
    }
}


if (!function_exists('adminSalesNormalizeSaleDate')) {
    function adminSalesNormalizeSaleDate(?string $raw): ?string {
        $value = trim((string)$raw);
        if ($value === '') return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value;
        }
        if (preg_match('/^(\d{4}-\d{2}-\d{2})[T\s]\d{2}:\d{2}(:\d{2})?$/', $value, $m)) {
            return $m[1];
        }
        if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $value, $m)) {
            return $m[1];
        }
        try {
            $dt = new DateTimeImmutable($value, new DateTimeZone(TZ));
            return $dt->setTimezone(new DateTimeZone(TZ))->format('Y-m-d');
        } catch (Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('adminSalesBuildSaleDateRestrictionMessage')) {
    function adminSalesBuildSaleDateRestrictionMessage(?string $saleDate, array $rule): string {
        return '';
    }
}

if (!function_exists('adminSalesCheckSaleDateRestriction')) {
    function adminSalesCheckSaleDateRestriction(?string $raw): array {
        return [
            'sale_date' => adminSalesNormalizeSaleDate($raw),
            'blocked' => false,
            'rule' => adminSalesSaleDateRuleInfo(),
            'message' => '',
        ];
    }
}

if (!function_exists('adminSalesUploadFileRecord')) {
    /**
     * (2026-05-16 v408) 보안 감사 7번 해결 — 파일 업로드 RCE 방어 다층화.
     *
     * 기존 v? 보안 조치:
     *   - adminOnly() 권한 검증 (caller)
     *   - 15MB 크기 제한
     *   - preg_replace 로 일부 파일명 sanitize
     *
     * v408 추가 다층 방어:
     *   1) 업로드 오류 코드 (UPLOAD_ERR_*) 명시 검증
     *   2) 확장자 화이트리스트 (pdf/png/jpg/jpeg/webp) — 그 외 차단
     *   3) Double-extension 차단 (예: shell.php.png 의 'php' 부분)
     *   4) finfo 로 실제 파일 내용 MIME 검증 — 클라이언트 Content-Type 무시
     *   5) 이미지 확장자 (png/jpg/jpeg/webp) 는 getimagesize 추가 검증
     *   6) 파일명 완전 랜덤화 (bin2hex(random_bytes(16))) — 원본 파일명 보존
     *      안 함. timestamp prefix 는 예측 가능 (보안 약함) → 폐기.
     *
     * uploads/.htaccess 와 함께 작동: 가령 verification 우회로 .php 가
     * 저장되더라도 Apache 가 PHP 실행 차단. 다층 방어.
     */
    function adminSalesUploadFileRecord(string $assetId, string $type, string $title, ?string $docDate, ?float $amount = null, ?string $amountCurrency = null): array {
        if (empty($_FILES['file'])) jsonError(400, '파일이 필요합니다.');
        $file = $_FILES['file'];

        // 1) 업로드 오류 명시 검증.
        $err = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($err !== UPLOAD_ERR_OK) {
            jsonError(400, '파일 업로드 실패 (error code: ' . $err . ')');
        }

        $size = (int)($file['size'] ?? 0);
        if ($size > 15 * 1024 * 1024) jsonError(400, '파일 크기는 15MB 이하');
        if ($size < 100) jsonError(400, '파일이 비어있거나 너무 작습니다.');

        $tmpPath = (string)($file['tmp_name'] ?? '');
        if (!is_uploaded_file($tmpPath)) {
            jsonError(400, '유효하지 않은 업로드 요청입니다.');
        }

        // 2) 확장자 화이트리스트.
        $originalName = (string)($file['name'] ?? '');
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
        if (!in_array($ext, $allowedExts, true)) {
            jsonError(400, '허용되지 않은 파일 확장자입니다. (PDF / PNG / JPG / WEBP 만 가능)');
        }

        // 3) Double-extension 차단 (basename 안에 위험 확장자 포함 검사).
        $basePart = pathinfo($originalName, PATHINFO_FILENAME);
        if (preg_match('/\.(php|phtml|phps|pht|php3|php4|php5|php7|html|htm|svg|cgi|pl|py|sh|exe|js|jsp|asp|aspx)$/i', $basePart)) {
            jsonError(400, '파일명에 위험한 확장자가 포함되어 있습니다.');
        }

        // 4) finfo 로 실제 MIME 검증.
        if (!function_exists('finfo_open')) {
            jsonError(500, '서버 환경에 finfo 가 활성화되지 않아 파일 검증 불가.');
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $actualMime = $finfo ? finfo_file($finfo, $tmpPath) : false;
        if ($finfo) finfo_close($finfo);
        if (!$actualMime) {
            jsonError(400, '파일 MIME 검증 실패.');
        }
        $allowedMimes = [
            'pdf'  => ['application/pdf'],
            'png'  => ['image/png'],
            'jpg'  => ['image/jpeg'],
            'jpeg' => ['image/jpeg'],
            'webp' => ['image/webp'],
        ];
        if (!in_array($actualMime, $allowedMimes[$ext] ?? [], true)) {
            jsonError(400, '파일 내용이 확장자와 일치하지 않습니다. (확장자: ' . $ext . ', 실제: ' . $actualMime . ')');
        }

        // 5) 이미지 확장자 추가 검증 — getimagesize 로 이미지 헤더 확인.
        if (in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)) {
            $imgInfo = @getimagesize($tmpPath);
            if ($imgInfo === false) {
                jsonError(400, '유효하지 않은 이미지 파일입니다.');
            }
        }

        if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);

        // 6) 파일명 완전 랜덤화. 원본 파일명은 보존 안 함 (DB title 컬럼이
        //    이미 사용자 입력 제목을 보유). 32자 hex + 검증된 확장자.
        $randomName = bin2hex(random_bytes(16));
        $filename = $randomName . '.' . $ext;
        $dest = UPLOAD_DIR . '/' . $filename;
        if (!move_uploaded_file($tmpPath, $dest)) {
            jsonError(500, '파일 저장에 실패했습니다.');
        }
        // 저장된 파일 권한 644 (실행 비트 제거).
        @chmod($dest, 0644);

        $filePath = '/uploads/' . $filename;
        DB::execute(
            "INSERT INTO asset_docs(asset_id, doc_type, title, doc_date, amount, amount_currency, file_path) VALUES (?,?,?,?,?,?,?)",
            [$assetId, $type, $title, $docDate, $amount, $amountCurrency, $filePath]
        );

        return ['file_path' => $filePath];
    }
}

if (!function_exists('adminSalesVerifyExecutionCredentials')) {
    function adminSalesVerifyExecutionCredentials(array $sessionAdmin, string $username, string $password): array {
        $sessionUsername = trim((string)($sessionAdmin['username'] ?? ''));
        $username = trim($username);
        if ($username === '' && $sessionUsername !== '' && $sessionUsername !== 'api_key') {
            $username = $sessionUsername;
        }
        $password = trim($password);
        if ($username === '' || $password === '') {
            throw new RuntimeException('관리자 아이디와 비밀번호를 입력하세요.', 400);
        }

        if ($sessionUsername !== '' && $sessionUsername !== 'api_key' && strcasecmp($sessionUsername, $username) !== 0) {
            throw new RuntimeException('현재 로그인한 관리자 계정과 동일한 아이디를 입력하세요.', 400);
        }

        $admin = DB::fetchOne("SELECT * FROM admins WHERE username=? AND is_active=1", [$username]);
        if (!$admin) throw new RuntimeException('관리자 인증에 실패했습니다.', 401);

        $hash = (string)($admin['password_hash'] ?? '');
        $hashCompat = str_starts_with($hash, '$2b$') ? ('$2y$' . substr($hash, 4)) : $hash;
        if (!password_verify($password, $hashCompat)) {
            throw new RuntimeException('관리자 인증에 실패했습니다.', 401);
        }

        if ($hash !== $hashCompat) {
            $newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
            DB::execute("UPDATE admins SET password_hash=? WHERE id=?", [$newHash, $admin['id']]);
        }

        return ['username' => (string)($admin['username'] ?? $username)];
    }
}

if (!function_exists('adminSalesFormatUtcToKstLabel')) {
    function adminSalesFormatUtcToKstLabel(?string $utc): ?string {
        $raw = trim((string)$utc);
        if ($raw === '') return null;
        $kst = parseUtcDateTimeToKST($raw);
        return $kst instanceof DateTimeImmutable ? ($kst->format('Y-m-d H:i:s') . ' KST') : $raw;
    }
}

if (!function_exists('adminSalesCountRedemptions')) {
    function adminSalesCountRedemptions(string $assetId): int {
        try {
            return (int)DB::fetchValue("SELECT COALESCE(COUNT(*),0) FROM sale_redemptions WHERE asset_id=?", [$assetId]);
        } catch (Throwable $e) {
            return 0;
        }
    }
}

if (!function_exists('adminSalesResolveLockState')) {
    function adminSalesResolveLockState(string $assetId, ?array $asset = null, ?array $saleRow = null): array {
        $sale = is_array($saleRow) ? $saleRow : DB::fetchOne("SELECT * FROM sales WHERE asset_id=? LIMIT 1", [$assetId]);
        if (!is_array($sale)) $sale = [];

        $assetStatus = trim((string)($asset['status'] ?? ''));
        $redeemCount = adminSalesCountRedemptions($assetId);
        $executionState = inferSaleExecutionState($sale, $asset, ['redeem_count' => $redeemCount]);
        $executedAt = trim((string)($executionState['executed_at'] ?? ($sale['executed_at'] ?? '')));
        $fixedFx = isset($executionState['fixed_fx_per_usdt'])
            ? (float)$executionState['fixed_fx_per_usdt']
            : (isset($sale['fixed_fx_per_usdt']) ? (float)$sale['fixed_fx_per_usdt'] : 0.0);
        $executionSource = trim((string)($executionState['source'] ?? ''));

        $locked = !empty($executionState['executed']);
        $reasonCode = '';
        $message = '';

        if ($executionSource === 'executed_at') {
            $reasonCode = 'ALREADY_EXECUTED';
            $message = '이미 매각 실행이 완료된 자산입니다.';
        } elseif ($executionSource === 'fixed_fx') {
            $reasonCode = 'FIXED_FX_LOCKED';
            $message = '이미 매각 실행이 완료된 자산입니다. 고정 환율이 저장되어 있어 다시 저장하거나 재실행할 수 없습니다.';
        } elseif ($executionSource === 'redemptions') {
            $reasonCode = 'REDEMPTIONS_EXIST';
            $message = '이미 정산이 진행된 매각은 수정하거나 다시 실행할 수 없습니다.';
        } elseif ($executionSource === 'asset_status_sold') {
            $reasonCode = 'ASSET_STATUS_LOCKED';
            $message = '이미 매각 실행이 완료된 자산입니다. 매각 상태로 확정되어 다시 저장하거나 재실행할 수 없습니다.';
        }

        $executedAtKst = adminSalesFormatUtcToKstLabel($executedAt);
        if ($executedAtKst === null && $locked) {
            $updatedAt = trim((string)($sale['updated_at'] ?? ''));
            $updatedAtKst = adminSalesFormatUtcToKstLabel($updatedAt);
            if ($updatedAtKst !== null) {
                $executedAtKst = $updatedAtKst . ' (저장 시각 기준)';
            } else {
                $fallbackSaleDate = trim((string)($sale['window_start'] ?? ''));
                if ($fallbackSaleDate !== '') {
                    $executedAtKst = $fallbackSaleDate . ' (매각일 기준)';
                }
            }
        }

        return [
            'locked' => $locked,
            'reason_code' => $reasonCode,
            'message' => $message,
            'asset_status' => $assetStatus,
            'execution_source' => $executionSource,
            'executed_at' => $executedAt !== '' ? $executedAt : null,
            'executed_at_kst' => $executedAtKst,
            'fixed_fx_per_usdt' => $fixedFx > 0 ? clamp6($fixedFx) : 0.0,
            'redeem_count' => $redeemCount,
        ];
    }
}

if (!function_exists('adminSalesEnsureEditable')) {
    function adminSalesEnsureEditable(string $assetId, ?array $asset = null, ?array $saleRow = null): void {
        $lock = adminSalesResolveLockState($assetId, $asset, $saleRow);
        if (!empty($lock['locked'])) {
            jsonError(
                400,
                (string)($lock['message'] ?: '이미 매각 실행된 자산은 수정할 수 없습니다.'),
                [
                    'reason_code' => (string)($lock['reason_code'] ?: 'ALREADY_EXECUTED'),
                    'sale_lock' => $lock,
                ]
            );
        }
    }
}

if (!function_exists('adminSalesValidateDraftNumbers')) {
    function adminSalesValidateDraftNumbers(float $actualAcqInput, float $soldPriceInput, float $taxInput, float $otherExpensesInput, float $fixedPrincipalInput): void {
        foreach ([
            '실제 취득원가' => $actualAcqInput,
            '총 매각금액' => $soldPriceInput,
            '매각세금' => $taxInput,
            '기타 매각비용' => $otherExpensesInput,
        ] as $label => $num) {
            if (!is_finite($num) || $num < 0) {
                jsonError(400, $label . ' 값이 올바르지 않습니다.');
            }
        }

        if (!($actualAcqInput > 0)) {
            jsonError(400, '실부동산 실제 매수금액(총 취득원가)을 입력하세요.');
        }

        if ($fixedPrincipalInput > 0 && $actualAcqInput + 0.000001 < $fixedPrincipalInput) {
            jsonError(400, '실제 취득원가는 플랫폼 유저 총 투자금보다 작을 수 없습니다.');
        }
    }
}

if (!function_exists('adminSalesNormalizeFxLookupDateTime')) {
    function adminSalesNormalizeFxLookupDateTime(?string $when): ?string {
        $raw = trim((string)$when);
        if ($raw === '') return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            return $raw . ' 23:59:59';
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/', $raw)) {
            $dateTime = str_replace('T', ' ', $raw);
            return strlen($dateTime) === 16 ? ($dateTime . ':59') : $dateTime;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $raw)) {
            return strlen($raw) === 16 ? ($raw . ':59') : $raw;
        }
        return null;
    }
}

if (!function_exists('adminSalesLookupHistoricalFx')) {
    function adminSalesLookupHistoricalFx(string $currency, ?string $when): array {
        $ccy = strtoupper(trim($currency ?: 'KRW'));
        if ($ccy === 'USDT') {
            return [
                'found' => true,
                'rate' => 1.0,
                'fetched_at' => null,
                'provider' => 'system',
                'source' => 'usdt',
            ];
        }

        $dateTime = adminSalesNormalizeFxLookupDateTime($when);
        if (!$dateTime) {
            return [
                'found' => false,
                'rate' => 0.0,
                'fetched_at' => null,
                'provider' => null,
                'source' => 'invalid_date',
            ];
        }

        try {
            $row = DB::fetchOne(
                "SELECT rate, fetched_at, provider FROM fx_quotes WHERE quote_currency=? AND fetched_at <= ? ORDER BY fetched_at DESC LIMIT 1",
                [$ccy, $dateTime]
            );
            $rate = (float)($row['rate'] ?? 0);
            if (is_finite($rate) && $rate > 0) {
                return [
                    'found' => true,
                    'rate' => $rate,
                    'fetched_at' => $row['fetched_at'] ?? null,
                    'provider' => $row['provider'] ?? null,
                    'source' => 'historical',
                ];
            }
        } catch (Throwable $e) {
            // fx history table may not exist in some environments
        }

        return [
            'found' => false,
            'rate' => 0.0,
            'fetched_at' => null,
            'provider' => null,
            'source' => 'missing',
        ];
    }
}

if (!function_exists('adminSalesNormalizeManualFx')) {
    function adminSalesNormalizeManualFx($raw, string $settlement = 'KRW'): float {
        $ccy = strtoupper(trim($settlement ?: 'KRW'));
        if ($ccy === 'USDT') return 0.0;
        if ($raw === null || $raw === '') return 0.0;
        $value = (float)$raw;
        if (!is_finite($value) || $value < 0) {
            jsonError(400, '관리자 수동 환율 값이 올바르지 않습니다.');
        }
        // 상한 검증 — 비상식적 수치로 인한 페이아웃 오계산 방지 (IDR/VND 등 고환율 통화 고려해 1,000,000까지 허용)
        if ($value > 1000000) {
            jsonError(400, '관리자 수동 환율이 비정상적으로 큽니다 (최대 1,000,000). 입력값을 확인하세요.');
        }
        return $value > 0 ? clamp6($value) : 0.0;
    }
}


if (!function_exists('adminSalesResolveInterestCancelFromMonth')) {
    function adminSalesResolveInterestCancelFromMonth(?string $executedAtUtc = null, ?string $windowStart = null, ?string $plannedExecutionUtc = null): string {
        $policy = resolveSaleInterestPolicyContext($executedAtUtc, $windowStart, $plannedExecutionUtc);
        $monthKey = substr(trim((string)($policy['cancel_from_month'] ?? '')), 0, 7);
        if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
            throw new RuntimeException('매각 실행 기준 이자 중단월 정보가 올바르지 않습니다.', 400);
        }
        return $monthKey;
    }
}

if (!function_exists('adminSalesComputeDraftPayout')) {
    function adminSalesComputeDraftPayout(array $asset, array $saleInput, ?float $fxOverridePerUsdt = null): array {
        $settlement = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
        $inputCurrency = $settlement;
        $fixedPrincipalInput = saleResolveFixedInvestorPrincipalInput($asset, isset($saleInput['buy_price_krw']) ? (float)$saleInput['buy_price_krw'] : null);

        $actualAcqInput = adminSalesGetRawActualAcquisitionInput($saleInput, 0.0);
        $soldPriceInput = isset($saleInput['sold_price_input'])
            ? (float)$saleInput['sold_price_input']
            : (isset($saleInput['sold_price_krw']) ? (float)$saleInput['sold_price_krw'] : 0.0);
        $taxInput = adminSalesGetRawTaxInput($saleInput);
        $otherExpensesInput = adminSalesGetRawOtherExpensesInput($saleInput);

        adminSalesValidateDraftNumbers($actualAcqInput, $soldPriceInput, $taxInput, $otherExpensesInput, $fixedPrincipalInput);

        $totalProjectCostsInput = $taxInput + $otherExpensesInput;
        $projectNetInput = $soldPriceInput - $totalProjectCostsInput;
        $investorRatio = $actualAcqInput > 0 ? ($fixedPrincipalInput / $actualAcqInput) : 0.0;
        if (!is_finite($investorRatio) || $investorRatio < 0) $investorRatio = 0.0;
        $investorPayoutInput = max(0.0, $projectNetInput * $investorRatio);

        $effectiveFx = 1.0;
        if ($inputCurrency !== 'USDT') {
            $effectiveFx = ($fxOverridePerUsdt !== null && is_finite($fxOverridePerUsdt) && $fxOverridePerUsdt > 0)
                ? (float)$fxOverridePerUsdt
                : (float)getFxPerUsdt($inputCurrency);
            if (!($effectiveFx > 0)) {
                jsonError(400, '현재 정산통화 환율이 없어 플랫폼 유저 할당총액을 USDT로 확정할 수 없습니다.');
            }
        }

        // 플랫폼 유저 할당총액은 0.01 USDT 미만 절삭 (floor2).
        // 유저 교환 시 vault 초과 인출 방지를 위해 반올림이 아닌 내림.
        $vaultBalanceUsdt = ($inputCurrency === 'USDT')
            ? floor2($investorPayoutInput)
            : floor2($investorPayoutInput / $effectiveFx);

        return [
            'asset_id' => (string)($asset['id'] ?? ''),
            'settlement_basis' => $inputCurrency,
            'input_currency' => $inputCurrency,
            'funded_usdt' => saleResolveFundedUsdt($asset),
            'buy_price_input' => clamp6($fixedPrincipalInput),
            'actual_acquisition_cost_input' => clamp6($actualAcqInput),
            'sold_price_input' => clamp6($soldPriceInput),
            'sale_tax_input' => clamp6($taxInput),
            'other_expenses_input' => clamp6($otherExpensesInput),
            'off_platform_capital_input' => clamp6(max(0.0, $actualAcqInput - $fixedPrincipalInput)),
            'investor_ratio' => $investorRatio,
            'project_net_input' => clamp6($projectNetInput),
            'investor_payout_input' => clamp6($investorPayoutInput),
            'effective_fx_per_usdt' => $inputCurrency === 'USDT' ? 1.0 : clamp6($effectiveFx),
            'vault_total_usdt' => $vaultBalanceUsdt,
        ];
    }
}


if (!function_exists('adminSalesEnsurePayableMonthInterest')) {
    function adminSalesEnsurePayableMonthInterest(string $assetId, array $asset, ?string $executedAtUtc = null, ?string $windowStart = null, ?string $plannedExecutionUtc = null): array {
        $policy = resolveSaleInterestPolicyContext($executedAtUtc, $windowStart, $plannedExecutionUtc);
        $monthKey = substr(trim((string)($policy['basis_month_key'] ?? '')), 0, 7);
        if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
            return [
                'awarded_interest_count' => 0,
                'awarded_interest_usdt' => 0.0,
                'interest_month_key' => null,
            ];
        }

        if (empty($policy['keep_current_month'])) {
            return [
                'awarded_interest_count' => 0,
                'awarded_interest_usdt' => 0.0,
                'interest_month_key' => $monthKey,
            ];
        }

        $holders = DB::fetchAll(
            "SELECT address, staked_token FROM holdings WHERE asset_id=? AND staked_token > 0 ORDER BY address ASC FOR UPDATE",
            [$assetId]
        );
        if (!$holders) {
            return [
                'awarded_interest_count' => 0,
                'awarded_interest_usdt' => 0.0,
                'interest_month_key' => $monthKey,
            ];
        }

        $awardedCount = 0;
        $awardedUsdt = 0.0;
        $assetRow = DB::fetchOne("SELECT id, status, apr, settlement_basis, fx_at_funding FROM assets WHERE id=? FOR UPDATE", [$assetId]) ?: $asset;
        $calcAsset = array_merge($asset, $assetRow ?: []);
        // 이자율 변경은 다음월부터 적용 — monthKey에 대응하는 유효 APR로 덮어쓰기
        if (function_exists('getEffectiveAprForMonth')) {
            $calcAsset['apr'] = getEffectiveAprForMonth($assetId, (string)$monthKey, (float)($calcAsset['apr'] ?? 0));
        }
        $createdAt = trim((string)($executedAtUtc ?: $plannedExecutionUtc ?: ''));
        if ($createdAt === '') $createdAt = nowUtcSql();

        foreach ($holders as $holder) {
            $address = trim((string)($holder['address'] ?? ''));
            $staked = (float)($holder['staked_token'] ?? 0);
            if ($address === '' || !($staked > 0)) continue;

            $exists = DB::fetchOne(
                "SELECT id FROM interest_claims WHERE address=? AND asset_id=? AND month_key=? LIMIT 1 FOR UPDATE",
                [$address, $assetId, $monthKey]
            );
            if ($exists) continue;

            $calc = calcStakingInterestBreakdown($calcAsset, $staked, $monthKey);
            DB::execute(
                "INSERT INTO interest_claims(address, asset_id, month_key, staked_snapshot, apr_snapshot, fx_krw_per_usdt, amount_local, fx_per_usdt, amount_usdt, settlement_basis, created_at, claimed_at, claim_batch_id)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [
                    $address,
                    $assetId,
                    $monthKey,
                    $staked,
                    $calc['apr'],
                    (int)round($calc['payout_fx']),
                    $calc['amount_local'],
                    $calc['payout_fx'],
                    $calc['amount_usdt'],
                    $calc['settlement_basis'],
                    $createdAt,
                    null,
                    null,
                ]
            );

            $interestClaimId = 0;
            try {
                $interestClaimId = (int)DB::pdo()->lastInsertId();
            } catch (Throwable $e) {
                $interestClaimId = 0;
            }

            try {
                adminSalesAwardReferralBonusCompat($address, $assetId, $monthKey, $calc['amount_usdt'], $interestClaimId);
            } catch (Throwable $bonusError) {
                error_log('Sale execute referral bonus skipped for ' . $address . ' / ' . $assetId . ' / ' . $monthKey . ': ' . $bonusError->getMessage());
            }

            $awardedCount++;
            $awardedUsdt += (float)($calc['amount_usdt'] ?? 0);
        }

        return [
            'awarded_interest_count' => $awardedCount,
            'awarded_interest_usdt' => round($awardedUsdt, 6),
            'interest_month_key' => $monthKey,
        ];
    }
}


if (!function_exists('adminSalesAwardReferralBonusCompat')) {
    function adminSalesAwardReferralBonusCompat(string $address, string $assetId, string $monthKey, float $interestUsdt, int $interestClaimId = 0): float {
        if (!function_exists('awardReferralBonusForInterest')) return 0.0;
        $fn = new ReflectionFunction('awardReferralBonusForInterest');
        if ($fn->getNumberOfParameters() >= 5) {
            return (float)awardReferralBonusForInterest($address, $assetId, $monthKey, $interestUsdt, $interestClaimId);
        }
        return (float)awardReferralBonusForInterest($address, $assetId, $monthKey, $interestUsdt);
    }
}

if (!function_exists('adminSalesAutoUnstakeAll')) {
    function adminSalesAutoUnstakeAll(string $assetId): array {
        $rows = DB::fetchAll(
            "SELECT address, staked_token FROM holdings WHERE asset_id=? AND staked_token > 0 FOR UPDATE",
            [$assetId]
        );

        $holderCount = 0;
        $tokenTotal = 0.0;
        $perUserUnstake = [];
        foreach ($rows as $row) {
            $amt = (float)($row['staked_token'] ?? 0);
            if ($amt <= 0) continue;
            $holderCount++;
            $tokenTotal += $amt;
            $perUserUnstake[(string)$row['address']] = $amt;
        }

        if ($holderCount > 0) {
            DB::execute(
                "UPDATE holdings
                 SET balance_token = balance_token + staked_token,
                     staked_token = 0
                 WHERE asset_id=? AND staked_token > 0",
                [$assetId]
            );

            // (2026-05-06) 매각 실행 시 자동 언스테이킹 → 유저 1회 팝업 알림.
            // notifications.php 의 createUserNotification 사용. 알림 실패는 무시.
            if (function_exists('createUserNotification')) {
                foreach ($perUserUnstake as $addr => $amt) {
                    $amtFmt = rtrim(rtrim(number_format($amt, 6, '.', ','), '0'), '.');
                    try {
                        createUserNotification(
                            (string)$addr,
                            'auto_unstake_on_sale',
                            '매각 진행 — 자동 언스테이킹 완료',
                            "광산 매각 실행에 따라 보유하셨던 {$amtFmt} SilicaSTO 의 스테이킹이 자동 해제되었습니다. 매각 정산이 준비되면 보유 토큰을 USDT 로 교환하실 수 있습니다.",
                            [
                                'asset_id' => $assetId,
                                'unstaked_token' => $amt,
                                'reason' => 'sale_executed',
                            ]
                        );
                    } catch (Throwable $e) {
                        // 알림 실패는 본 트랜잭션을 깨면 안 됨
                        error_log('auto_unstake_on_sale notify failed: ' . $e->getMessage());
                    }
                }
            }
        }

        return [
            'unstaked_holder_count' => $holderCount,
            'unstaked_token_total' => clamp6($tokenTotal),
        ];
    }
}

if (!function_exists('adminSalesCancelInterestFromMonth')) {
    function adminSalesCancelInterestFromMonth(string $assetId, string $fromMonthKey): array {
        $fromMonthKey = substr(trim($fromMonthKey), 0, 7);
        if (!preg_match('/^\d{4}-\d{2}$/', $fromMonthKey)) {
            throw new RuntimeException('이자 중단 기준월 정보가 올바르지 않습니다.', 400);
        }

        $claimedCount = 0;
        try {
            $claimedCount = (int)DB::fetchValue(
                "SELECT COALESCE(COUNT(*),0) FROM interest_claims WHERE asset_id=? AND month_key >= ? AND claimed_at IS NOT NULL",
                [$assetId, $fromMonthKey]
            );
        } catch (Throwable $e) {
            $claimedCount = 0;
        }

        if ($claimedCount > 0) {
            throw new RuntimeException('매각실행일 기준 이자 중단 대상 월의 이자가 이미 지급 또는 클레임되어 현재 시점으로는 실행할 수 없습니다. 실행 시점 또는 이자 정산 상태를 확인하세요.', 400);
        }

        $rows = DB::fetchAll(
            "SELECT id FROM interest_claims WHERE asset_id=? AND month_key >= ? AND claimed_at IS NULL FOR UPDATE",
            [$assetId, $fromMonthKey]
        );
        $ids = array_values(array_filter(array_map(fn($r) => (int)($r['id'] ?? 0), $rows)));
        if (!$ids) {
            return [
                'canceled_interest_count' => 0,
                'canceled_current_month_interest_count' => 0,
            ];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        foreach (['pending_referral_bonuses', 'referral_bonus_events'] as $table) {
            try {
                DB::execute("DELETE FROM `{$table}` WHERE interest_claim_id IN ({$placeholders})", $ids);
            } catch (Throwable $e) {
                // table may not exist in some environments
            }
        }

        DB::execute("DELETE FROM interest_claims WHERE id IN ({$placeholders})", $ids);
        return [
            'canceled_interest_count' => count($ids),
            'canceled_current_month_interest_count' => count($ids),
        ];
    }
}

if (!function_exists('adminSalesBuildExecuteBlocker')) {
    function adminSalesBuildExecuteBlocker(string $code, string $message, array $extra = []): array {
        return array_merge([
            'code' => $code,
            'message' => $message,
        ], $extra);
    }
}

if (!function_exists('adminSalesDescribeInterestPolicy')) {
    function adminSalesDescribeInterestPolicy(?string $executedAtUtc = null, ?string $windowStart = null, ?string $plannedExecutionUtc = null): string {
        $policy = resolveSaleInterestPolicyContext($executedAtUtc, $windowStart, $plannedExecutionUtc);
        $payday = (int)($policy['payday'] ?? (defined('STAKING_PAYDAY') ? (int)STAKING_PAYDAY : 15));
        if ($payday < 1) $payday = 15;

        $basisType = (string)($policy['basis_type'] ?? 'planned_execution');
        $basisLabel = $basisType === 'window_start_fallback' ? '매각일' : '매각실행일(KST)';
        if (!empty($policy['keep_current_month'])) {
            return $basisLabel . '이 ' . $payday . '일 이상이므로 실행월 이자는 유지되고 다음월부터 중단됩니다.';
        }
        return $basisLabel . '이 ' . $payday . '일 이전이므로 실행월 이자는 지급되지 않습니다.';
    }
}


if (!function_exists('adminSalesBuildExecutePrecheck')) {
    function adminSalesBuildExecutePrecheck(string $assetId, ?array $assetRow = null, ?array $saleRow = null): array {
        $assetId = trim($assetId);
        if ($assetId === '') {
            throw new RuntimeException('asset_id가 필요합니다.', 400);
        }

        $asset = $assetRow ?: getAsset($assetId);
        if (!$asset) {
            throw new RuntimeException('자산이 없습니다.', 404);
        }

        $sale = $saleRow;
        if ($sale === null) {
            $sale = DB::fetchOne("SELECT * FROM sales WHERE asset_id=? LIMIT 1", [$assetId]);
        }

        $settlement = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
        $executionLock = adminSalesExecutionLockInfo();
        $saleDateRule = adminSalesSaleDateRuleInfo();
        $blockers = [];
        $warnings = [];
        $executionNowUtc = nowUtcSql();

        $status = trim((string)($asset['status'] ?? ''));
        // (2026-05-06) Silica 1:1 페그 호환 — supply_token 이 0 이면 raised_usdt 로 폴백.
        // sales.php 의 saleResolveTotalSupply 헬퍼 재사용.
        $supply = function_exists('saleResolveTotalSupply')
            ? saleResolveTotalSupply($asset)
            : (float)($asset['supply_token'] ?? 0);
        $saleExists = is_array($sale) && !empty($sale);
        $saleLock = $saleExists ? adminSalesResolveLockState($assetId, $asset, $sale) : ['locked' => false, 'reason_code' => '', 'message' => '', 'executed_at' => null, 'executed_at_kst' => null, 'fixed_fx_per_usdt' => 0.0, 'redeem_count' => 0];
        $executedAt = $saleExists ? trim((string)($saleLock['executed_at'] ?? ($sale['executed_at'] ?? ''))) : '';
        $windowStartRaw = $saleExists ? trim((string)($sale['window_start'] ?? '')) : '';
        $windowStart = $saleExists ? (adminSalesNormalizeSaleDate($windowStartRaw) ?? '') : '';
        $saleDateCheck = adminSalesCheckSaleDateRestriction($windowStartRaw);
        $manualFx = ($saleExists && adminSalesColumnExists('manual_fx_per_usdt')) ? (float)($sale['manual_fx_per_usdt'] ?? 0) : 0.0;
        $redeemCount = (int)($saleLock['redeem_count'] ?? 0);
        $claimedInterestConflictCount = 0;
        $interestCancelFromMonth = null;
        $fxLookup = ['found' => false, 'rate' => 0.0, 'fetched_at' => null, 'provider' => null, 'source' => 'missing'];
        $interestBasisExecutedAt = $executedAt !== '' ? $executedAt : null;
        $interestBasisPlannedUtc = $executedAt === '' ? $executionNowUtc : null;

        if (!$saleExists) {
            $blockers[] = adminSalesBuildExecuteBlocker('SALE_DRAFT_MISSING', '저장된 매각 정보가 없습니다. 먼저 저장하세요.');
        }

        if ($saleExists && !empty($saleLock['locked']) && (string)($saleLock['reason_code'] ?? '') !== 'REDEMPTIONS_EXIST') {
            $blockers[] = adminSalesBuildExecuteBlocker(
                (string)($saleLock['reason_code'] ?: 'ALREADY_EXECUTED'),
                (string)($saleLock['message'] ?: '이미 매각 실행이 완료된 자산입니다.'),
                [
                    'executed_at' => $saleLock['executed_at'] ?? null,
                    'executed_at_kst' => $saleLock['executed_at_kst'] ?? null,
                    'fixed_fx_per_usdt' => (float)($saleLock['fixed_fx_per_usdt'] ?? 0),
                    'execution_source' => $saleLock['execution_source'] ?? null,
                ]
            );
        }

        if ($redeemCount > 0) {
            $blockers[] = adminSalesBuildExecuteBlocker('REDEMPTIONS_EXIST', '이미 정산이 진행된 매각은 다시 실행할 수 없습니다.', ['redeem_count' => $redeemCount]);
        }

        // (2026-05-06) Silica 단순 상태머신 호환 — 화이트리스트 → 블랙리스트 전환.
        // 매각완료 / 모집실패 / 취소됨 만 차단. 활성 + legacy(모집중/구매진행/분배중/운영중) + 매각 자체는 허용.
        $statusBlocked = in_array($status, [STATUSES['SALE_DISTRIBUTED'], '모집실패', '취소됨'], true);
        if ($statusBlocked || $status === '') {
            $blockers[] = adminSalesBuildExecuteBlocker('INVALID_STATUS', '현재 자산 상태에서는 매각을 실행할 수 없습니다. (자산 상태: ' . ($status ?: 'unknown') . ')', ['asset_status' => $status]);
        }

        // supply 폴백(saleResolveTotalSupply) 적용 후에도 0 이면 진짜로 분배할 토큰이 없는 상태 — 블록 유지.
        if (!($supply > 0)) {
            $blockers[] = adminSalesBuildExecuteBlocker('ZERO_SUPPLY', '발행/분배된 STO 가 없어 매각을 실행할 수 없습니다. (확정된 funding_records 가 있는지 확인하세요.)');
        }

        if (!empty($executionLock['is_locked'])) {
            $blockers[] = adminSalesBuildExecuteBlocker('EXECUTION_LOCK', (string)($executionLock['message'] ?? '정산 제한 기간에는 매각 최종 실행을 할 수 없습니다.'));
        }

        $fixedPrincipalInput = saleResolveFixedInvestorPrincipalInput($asset, $saleExists ? (float)($sale['buy_price_krw'] ?? 0) : null);
        $actualAcqInput = $saleExists ? adminSalesGetRawActualAcquisitionInput($sale, 0.0) : 0.0;
        $soldPriceInput = $saleExists ? (float)($sale['sold_price_input'] ?? ($sale['sold_price_krw'] ?? 0)) : 0.0;
        $saleTaxInput = $saleExists ? adminSalesGetRawTaxInput($sale) : 0.0;
        $otherExpensesInput = $saleExists ? adminSalesGetRawOtherExpensesInput($sale) : 0.0;

        if ($saleExists && !($actualAcqInput > 0)) {
            $blockers[] = adminSalesBuildExecuteBlocker('MISSING_ACTUAL_COST', '실부동산 실제 매수금액(총 취득원가)을 입력하세요.');
        }
        if ($saleExists && $fixedPrincipalInput > 0 && $actualAcqInput > 0 && $actualAcqInput + 0.000001 < $fixedPrincipalInput) {
            $blockers[] = adminSalesBuildExecuteBlocker('ACTUAL_COST_LT_PRINCIPAL', '실제 취득원가는 플랫폼 유저 총 투자금보다 작을 수 없습니다.');
        }
        if ($saleExists && !($soldPriceInput > 0)) {
            $blockers[] = adminSalesBuildExecuteBlocker('MISSING_SOLD_PRICE', '총 매각금액을 입력한 뒤 매각을 실행하세요.');
        }
        if ($saleExists && (!is_finite($saleTaxInput) || $saleTaxInput < 0 || !is_finite($otherExpensesInput) || $otherExpensesInput < 0)) {
            $blockers[] = adminSalesBuildExecuteBlocker('INVALID_COST_VALUES', '매각세금/기타 매각비용 값이 올바르지 않습니다.');
        }

        if ($saleExists && $windowStartRaw === '') {
            $blockers[] = adminSalesBuildExecuteBlocker('MISSING_WINDOW_START', '매각일을 입력한 뒤 매각을 실행하세요.');
        } elseif ($saleExists && $windowStart === '') {
            $blockers[] = adminSalesBuildExecuteBlocker('INVALID_WINDOW_START', '매각일 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 다시 저장하세요.', ['window_start' => $windowStartRaw]);
        } elseif ($windowStart !== '' && $windowStart > todayKST()) {
            $blockers[] = adminSalesBuildExecuteBlocker('WINDOW_START_FUTURE', '매각일은 미래일 수 없습니다. 실제 오프라인 매각일을 입력하세요.', ['window_start' => $windowStart]);
        } elseif (!empty($saleDateCheck['blocked'])) {
            $blockers[] = adminSalesBuildExecuteBlocker('WINDOW_START_BACKDATE_BLOCKED', (string)($saleDateCheck['message'] ?: $saleDateRule['message']), ['window_start' => $windowStart, 'min_sale_date' => $saleDateRule['min_sale_date']]);
        }

        if ($settlement !== 'USDT') {
            if (!($manualFx > 0)) {
                $blockers[] = adminSalesBuildExecuteBlocker('MANUAL_FX_REQUIRED', '관리자 수동 환율을 입력 후 저장/실행하세요. 매각일 기준 자동 조회 환율은 참고용입니다.');
            }
            if ($windowStart !== '') {
                $fxLookup = adminSalesLookupHistoricalFx($settlement, $windowStart);
            }
        } else {
            $fxLookup = ['found' => true, 'rate' => 1.0, 'fetched_at' => null, 'provider' => 'system', 'source' => 'usdt'];
        }

        if ($windowStart !== '') {
            try {
                $interestCancelFromMonth = adminSalesResolveInterestCancelFromMonth($interestBasisExecutedAt, $windowStart, $interestBasisPlannedUtc);
                try {
                    $claimedInterestConflictCount = (int)DB::fetchValue(
                        "SELECT COALESCE(COUNT(*),0) FROM interest_claims WHERE asset_id=? AND month_key >= ? AND claimed_at IS NOT NULL",
                        [$assetId, $interestCancelFromMonth]
                    );
                } catch (Throwable $e) {
                    $claimedInterestConflictCount = 0;
                }
                if ($claimedInterestConflictCount > 0) {
                    $blockers[] = adminSalesBuildExecuteBlocker(
                        'CLAIMED_INTEREST_CONFLICT',
                        '매각실행일 기준 이자 중단 대상 월의 이자가 이미 지급 또는 클레임되어 현재 시점으로는 실행할 수 없습니다. 실행 시점 또는 이자 정산 상태를 확인하세요.',
                        ['claimed_interest_conflict_count' => $claimedInterestConflictCount, 'interest_cancel_from_month' => $interestCancelFromMonth]
                    );
                }
            } catch (Throwable $e) {
                $blockers[] = adminSalesBuildExecuteBlocker('INVALID_WINDOW_START', $e->getMessage());
            }
        }

        if ($saleExists && $actualAcqInput > 0 && $soldPriceInput > 0) {
            $warnings[] = [
                'code' => 'INTEREST_POLICY',
                'message' => adminSalesDescribeInterestPolicy($interestBasisExecutedAt, $windowStart, $interestBasisPlannedUtc),
            ];
        }

        $message = $blockers ? '현재 실행 불가' : '현재 실행 가능';

        return [
            'ready' => !$blockers,
            'message' => $message,
            'reason_code' => $blockers ? (string)($blockers[0]['code'] ?? 'BLOCKED') : 'READY',
            'blockers' => $blockers,
            'warnings' => $warnings,
            'asset_id' => $assetId,
            'asset_status' => $status,
            'sale_exists' => $saleExists,
            'executed_at' => $executedAt !== '' ? $executedAt : null,
            'redeem_count' => $redeemCount,
            'sale_date' => $windowStart !== '' ? $windowStart : null,
            'window_start' => $windowStart !== '' ? $windowStart : null,
            'settlement_basis' => $settlement,
            'manual_fx_per_usdt' => $settlement === 'USDT' ? 0.0 : clamp6(max(0.0, $manualFx)),
            'auto_fx_per_usdt' => $settlement === 'USDT' ? 1.0 : (float)($fxLookup['rate'] ?? 0),
            'historical_found' => !empty($fxLookup['found']),
            'historical_fetched_at' => $fxLookup['fetched_at'] ?? null,
            'historical_provider' => $fxLookup['provider'] ?? null,
            'interest_cancel_from_month' => $interestCancelFromMonth,
            'claimed_interest_conflict_count' => $claimedInterestConflictCount,
            'execution_lock' => $executionLock,
            'sale_date_min' => $saleDateRule['min_sale_date'] ?? null,
            'sale_date_rule_message' => $saleDateRule['message'] ?? '',
        ];
    }
}

get('/api/admin/sales/:assetId', function ($p) {
    adminOnly();
    adminSalesEnsureDraftSchema();
    $assetId = trim((string)($p['assetId'] ?? ''));
    if ($assetId === '') jsonError(400, 'asset_id가 필요합니다.');

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산이 없습니다.');

    $settlement = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
    $view = buildSaleViewModel($assetId);
    $row = DB::fetchOne("SELECT * FROM sales WHERE asset_id=? LIMIT 1", [$assetId]);

    $draft = null;
    $saleLock = adminSalesResolveLockState($assetId, $asset, $row ?: null);
    $currentFx = $settlement === 'USDT' ? 1.0 : (float)getFxPerUsdt($settlement);
    $fxPreview = [
        'rate' => $settlement === 'USDT' ? 1.0 : 0.0,
        'autoFx' => $settlement === 'USDT' ? 1.0 : 0.0,
        'found' => $settlement === 'USDT',
        'autoFound' => $settlement === 'USDT',
        'fetched_at' => null,
        'provider' => $settlement === 'USDT' ? 'system' : null,
        'reference_date' => null,
        'sale_date' => null,
        'date' => null,
        'current_fx' => $currentFx,
        'currentFx' => $currentFx,
        'source' => $settlement === 'USDT' ? 'usdt' : 'current',
        'message' => '',
    ];

    if ($row) {
        $windowStart = adminSalesNormalizeSaleDate(!empty($row['window_start']) ? (string)$row['window_start'] : null);
        $windowEnd = null; // settlement end is currently hidden/disabled
        $manualFx = adminSalesColumnExists('manual_fx_per_usdt') ? (float)($row['manual_fx_per_usdt'] ?? 0) : 0.0;
        $lookup = $settlement === 'USDT'
            ? ['found' => true, 'rate' => 1.0, 'fetched_at' => null, 'provider' => 'system', 'source' => 'usdt']
            : ($windowStart
                ? adminSalesLookupHistoricalFx($settlement, $windowStart)
                : ['found' => false, 'rate' => 0.0, 'fetched_at' => null, 'provider' => null, 'source' => 'current']);

        $draft = [
            'asset_id' => $assetId,
            'input_currency' => strtoupper((string)($row['input_currency'] ?? $settlement)),
            'buy_price_input' => (float)($view['buy_price_input'] ?? ($row['buy_price_krw'] ?? 0)),
            'actual_acquisition_cost_input' => adminSalesGetRawActualAcquisitionInput($row, (float)($view['actual_acquisition_cost_input'] ?? 0)),
            'sold_price_input' => (float)($row['sold_price_input'] ?? ($row['sold_price_krw'] ?? ($view['sold_price_input'] ?? 0))),
            'sale_tax_input' => adminSalesGetRawTaxInput($row + ['sale_tax_input' => (float)($view['sale_tax_input'] ?? 0)]),
            'other_expenses_input' => adminSalesGetRawOtherExpensesInput($row + ['other_expenses_input' => (float)($view['other_expenses_input'] ?? 0), 'expenses_input' => (float)($view['expenses_input'] ?? 0), 'sale_tax_input' => (float)($view['sale_tax_input'] ?? 0)]),
            'sale_date' => $windowStart,
            'window_start' => $windowStart,
            'window_end' => null,
            'manual_fx_per_usdt' => clamp6(max(0.0, $manualFx)),
            'fixed_fx_per_usdt' => (float)($row['fixed_fx_per_usdt'] ?? 0),
            'executed_at' => $row['executed_at'] ?? null,
            'executed_by' => $row['executed_by'] ?? null,
        ];

        if (is_array($view)) {
            $view['manual_fx_per_usdt'] = $draft['manual_fx_per_usdt'];
            $view['sale_date'] = $windowStart;
            $view['window_start'] = $windowStart;
            $view['window_end'] = $windowEnd;
            if (empty($view['sale_executed_at']) && !empty($draft['executed_at'])) $view['sale_executed_at'] = $draft['executed_at'];
            if (empty($view['sale_executed_at_kst']) && !empty($saleLock['executed_at_kst'])) $view['sale_executed_at_kst'] = $saleLock['executed_at_kst'];
            if (empty($view['sale_executed_by']) && !empty($draft['executed_by'])) $view['sale_executed_by'] = $draft['executed_by'];
            if (!empty($saleLock['locked'])) $view['sale_executed'] = true;
        }

        $fxPreview = [
            'rate' => $manualFx > 0 ? clamp6($manualFx) : (float)($lookup['rate'] ?? 0),
            'autoFx' => (float)($lookup['rate'] ?? 0),
            'found' => !empty($lookup['found']),
            'autoFound' => !empty($lookup['found']),
            'fetched_at' => $lookup['fetched_at'] ?? null,
            'provider' => $lookup['provider'] ?? null,
            'reference_date' => $windowStart,
            'sale_date' => $windowStart,
            'date' => $windowStart,
            'current_fx' => $currentFx,
            'currentFx' => $currentFx,
            'source' => $manualFx > 0 ? 'manual' : ($lookup['source'] ?? ($windowStart ? 'missing' : 'current')),
            'message' => ($settlement !== 'USDT' && $windowStart && empty($lookup['found']))
                ? '매각일 기준 자동 조회 환율 이력이 없습니다. 자동 조회는 참고용이며 관리자 수동 환율 입력은 필수입니다.'
                : '',
        ];
    }

    $precheck = adminSalesBuildExecutePrecheck($assetId, $asset, $row ?: null);

    jsonOk([
        'sale' => $view,
        'draft' => $draft,
        'fx_preview' => $fxPreview,
        'sale_lock' => $saleLock,
        'execution_lock' => adminSalesExecutionLockInfo(),
        'precheck' => $precheck,
    ]);
});

post('/api/admin/sales/upsert', function () {
    adminOnly();
    adminSalesRequireDraftColumns();
    $body = getJsonBody();
    $sale = is_array($body['sale'] ?? null) ? $body['sale'] : $body;

    $assetId = trim((string)($sale['asset_id'] ?? ''));
    if ($assetId === '') jsonError(400, 'asset_id가 필요합니다.');

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산이 없습니다.');
    adminSalesEnsureEditable($assetId, $asset);

    $allowedCurrencies = ['KRW','USD','KZT','PHP','GEL','IDR','VND','USDT'];
    $inputCurrency = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
    if (!in_array($inputCurrency, $allowedCurrencies, true)) {
        jsonError(400, '자산의 정산통화가 올바르지 않습니다.');
    }

    $windowStartInput = $sale['sale_date'] ?? ($sale['window_start'] ?? null);
    $windowStart = adminSalesNormalizeSaleDate($windowStartInput);
    $windowEnd = null; // settlement end is currently hidden/disabled

    if ($windowStartInput !== null && trim((string)$windowStartInput) !== '' && $windowStart === null) {
        jsonError(400, '매각일 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력하세요.');
    }
    if ($windowStart !== null && $windowStart !== '') {
        if ($windowStart > todayKST()) {
            jsonError(400, '매각일은 미래일 수 없습니다. 실제 오프라인 매각일을 입력하세요.');
        }
        $saleDateCheck = adminSalesCheckSaleDateRestriction($windowStart);
        if (!empty($saleDateCheck['blocked'])) {
            jsonError(400, (string)$saleDateCheck['message']);
        }
    }

    $manualFx = adminSalesNormalizeManualFx($sale['manual_fx_per_usdt'] ?? null, $inputCurrency);
    $previewLookup = $inputCurrency === 'USDT'
        ? ['found' => true, 'rate' => 1.0, 'fetched_at' => null, 'provider' => 'system', 'source' => 'usdt']
        : ($windowStart ? adminSalesLookupHistoricalFx($inputCurrency, (string)$windowStart) : ['found' => false, 'rate' => 0.0, 'fetched_at' => null, 'provider' => null, 'source' => 'missing']);

    if ($inputCurrency !== 'USDT' && !($manualFx > 0)) {
        jsonError(400, '관리자 수동 환율을 입력 후 저장/실행하세요. 매각일 기준 자동 조회 환율은 참고용입니다.');
    }

    $draftFxOverride = $inputCurrency === 'USDT' ? 1.0 : $manualFx;

    $computed = adminSalesComputeDraftPayout($asset, $sale, $draftFxOverride);

    $columns = ['asset_id', 'input_currency', 'buy_price_krw'];
    $values = [$assetId, $inputCurrency, $computed['buy_price_input']];
    $updates = [
        'input_currency=VALUES(input_currency)',
        'buy_price_krw=VALUES(buy_price_krw)',
    ];

    if (adminSalesColumnExists('actual_acquisition_cost_input')) {
        $columns[] = 'actual_acquisition_cost_input';
        $values[] = $computed['actual_acquisition_cost_input'];
        $updates[] = 'actual_acquisition_cost_input=VALUES(actual_acquisition_cost_input)';
    }

    $columns[] = 'sold_price_krw';
    $values[] = $computed['sold_price_input'];
    $updates[] = 'sold_price_krw=VALUES(sold_price_krw)';

    $columns[] = 'sale_tax_amount';
    $values[] = $computed['sale_tax_input'];
    $updates[] = 'sale_tax_amount=VALUES(sale_tax_amount)';

    $columns[] = 'other_expenses_input';
    $values[] = $computed['other_expenses_input'];
    $updates[] = 'other_expenses_input=VALUES(other_expenses_input)';

    $columns[] = 'expenses_krw';
    $values[] = $computed['other_expenses_input'];
    $updates[] = 'expenses_krw=VALUES(expenses_krw)';

    $columns[] = 'vault_balance_usdt';
    $values[] = $computed['vault_total_usdt'];
    $updates[] = 'vault_balance_usdt=VALUES(vault_balance_usdt)';

    if (adminSalesColumnExists('manual_fx_per_usdt')) {
        $columns[] = 'manual_fx_per_usdt';
        $values[] = $manualFx;
        $updates[] = 'manual_fx_per_usdt=VALUES(manual_fx_per_usdt)';
    }

    if (adminSalesColumnExists('fixed_fx_per_usdt')) {
        $columns[] = 'fixed_fx_per_usdt';
        $values[] = 0;
        $updates[] = 'fixed_fx_per_usdt=0';
    }
    if (adminSalesColumnExists('executed_at')) {
        $columns[] = 'executed_at';
        $values[] = null;
        $updates[] = 'executed_at=executed_at';
    }
    if (adminSalesColumnExists('executed_by')) {
        $columns[] = 'executed_by';
        $values[] = null;
        $updates[] = 'executed_by=executed_by';
    }

    $columns[] = 'window_start';
    $values[] = $windowStart;
    $updates[] = 'window_start=VALUES(window_start)';


    $placeholders = implode(',', array_fill(0, count($columns), '?'));
    DB::execute(
        "INSERT INTO sales(" . implode(',', $columns) . ")
         VALUES (" . $placeholders . ")
         ON DUPLICATE KEY UPDATE " . implode(', ', $updates),
        $values
    );

    $previewLookup = $inputCurrency === 'USDT'
        ? ['found' => true, 'rate' => 1.0, 'fetched_at' => null, 'provider' => 'system', 'source' => 'usdt']
        : ($windowStart ? adminSalesLookupHistoricalFx($inputCurrency, (string)$windowStart) : ['found' => false, 'rate' => 0.0, 'fetched_at' => null, 'provider' => null, 'source' => 'missing']);

    jsonOk($computed + [
        'sale_date' => $windowStart,
        'window_start' => $windowStart,
        'window_end' => null,
        'manual_fx_per_usdt' => $manualFx,
        'auto_fx_per_usdt' => (float)($previewLookup['rate'] ?? 0),
        'historical_found' => !empty($previewLookup['found']),
        'historical_fetched_at' => $previewLookup['fetched_at'] ?? null,
        'historical_provider' => $previewLookup['provider'] ?? null,
        'draft_saved' => true,
    ]);
});

get('/api/admin/sales/:assetId/fx-preview', function ($p) {
    adminOnly();
    $assetId = trim((string)($p['assetId'] ?? ''));
    if ($assetId === '') jsonError(400, 'asset_id가 필요합니다.');

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산이 없습니다.');

    $settlement = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
    $date = trim((string)($_GET['date'] ?? $_GET['sale_date'] ?? $_GET['window_start'] ?? ''));
    $lookup = adminSalesLookupHistoricalFx($settlement, $date);
    $currentFx = $settlement === 'USDT' ? 1.0 : (float)getFxPerUsdt($settlement);

    $rate = (float)($lookup['rate'] ?? 0);
    $found = !empty($lookup['found']);
    jsonOk([
        'asset_id' => $assetId,
        'settlement_basis' => $settlement,
        'date' => $date,
        'sale_date' => $date,
        'auto_fx_per_usdt' => $rate,
        'historical_found' => $found,
        'historical_fetched_at' => $lookup['fetched_at'] ?? null,
        'historical_provider' => $lookup['provider'] ?? null,
        'current_fx_per_usdt' => $currentFx,
        'source' => $lookup['source'] ?? 'missing',
        'rate' => $rate,
        'found' => $found,
        'fetched_at' => $lookup['fetched_at'] ?? null,
        'provider' => $lookup['provider'] ?? null,
        'current_fx' => $currentFx,
        'message' => ($date !== '' && !$found) ? '해당일 이전 환율 이력이 없습니다. 자동 조회는 참고용이며 관리자 수동 환율 입력은 필수입니다.' : '',
    ]);
});

post('/api/admin/sales/:assetId/execute', function ($p) {
    $sessionAdmin = adminOnly();
    adminSalesRequireDraftColumns();
    $assetId = trim((string)($p['assetId'] ?? ''));
    if ($assetId === '') jsonError(400, 'asset_id가 필요합니다.');

    $precheck = adminSalesBuildExecutePrecheck($assetId);
    if (empty($precheck['ready'])) {
        jsonError(
            400,
            (string)($precheck['message'] ?? '매각 실행 전 확인이 필요합니다.'),
            [
                'reason_code' => $precheck['reason_code'] ?? 'BLOCKED',
                'precheck' => $precheck,
                'execution_lock' => $precheck['execution_lock'] ?? adminSalesExecutionLockInfo(),
            ]
        );
    }

    $body = getJsonBody();
    $verifiedAdmin = adminSalesVerifyExecutionCredentials(
        $sessionAdmin,
        (string)($body['username'] ?? ''),
        (string)($body['password'] ?? '')
    );

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $asset = DB::fetchOne("SELECT * FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$asset) throw new RuntimeException('자산이 없습니다.', 404);

        $sale = DB::fetchOne("SELECT * FROM sales WHERE asset_id=? FOR UPDATE", [$assetId]);
        if (!$sale) throw new RuntimeException('저장된 매각 정보가 없습니다. 먼저 저장하세요.', 400);

        $executionNowUtc = nowUtcSql();
        $saleLock = adminSalesResolveLockState($assetId, $asset, $sale);
        if (!empty($saleLock['locked'])) {
            throw new RuntimeException((string)($saleLock['message'] ?: '이미 매각 실행이 완료된 자산입니다.'), 400);
        }

        // (2026-05-06) Silica 단순 상태머신 호환 — precheck 와 동일한 블랙리스트 정책.
        $status = trim((string)($asset['status'] ?? ''));
        $statusBlocked = in_array($status, [STATUSES['SALE_DISTRIBUTED'], '모집실패', '취소됨'], true);
        if ($statusBlocked || $status === '') {
            throw new RuntimeException('현재 자산 상태에서는 매각을 실행할 수 없습니다. (자산 상태: ' . ($status ?: 'unknown') . ')', 400);
        }

        // supply_token 이 0 이어도 raised_usdt 가 있으면 (Silica 1:1 페그) 그 값을 분배 분모로 사용.
        $supply = function_exists('saleResolveTotalSupply')
            ? saleResolveTotalSupply($asset)
            : (float)($asset['supply_token'] ?? 0);
        if (!($supply > 0)) {
            throw new RuntimeException('발행/분배된 STO 가 없어 매각을 실행할 수 없습니다. (확정된 funding_records 가 있는지 확인하세요.)', 400);
        }

        $windowStartRaw = trim((string)($sale['window_start'] ?? ''));
        $windowStart = adminSalesNormalizeSaleDate($windowStartRaw);
        if ($windowStartRaw === '') {
            throw new RuntimeException('매각일을 입력한 뒤 매각을 실행하세요.', 400);
        }
        if ($windowStart === null) {
            throw new RuntimeException('저장된 매각일 형식이 올바르지 않습니다. 매각일을 다시 입력하고 저장한 뒤 실행하세요.', 400);
        }
        if ($windowStart > todayKST()) {
            throw new RuntimeException('매각일은 미래일 수 없습니다. 실제 오프라인 매각일을 입력하세요.', 400);
        }
        $saleDateCheck = adminSalesCheckSaleDateRestriction($windowStart);
        if (!empty($saleDateCheck['blocked'])) {
            throw new RuntimeException((string)$saleDateCheck['message'], 400);
        }

        $settlement = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
        $storedManualFx = adminSalesColumnExists('manual_fx_per_usdt') ? (float)($sale['manual_fx_per_usdt'] ?? 0) : 0.0;
        $fxSource = $settlement === 'USDT' ? 'usdt' : 'manual';
        $fxLookup = ['found' => false, 'rate' => 0.0, 'fetched_at' => null, 'provider' => null, 'source' => 'missing'];

        $fixedFx = 1.0;
        if ($settlement !== 'USDT') {
            if (!($storedManualFx > 0)) {
                throw new RuntimeException('관리자 수동 환율을 입력 후 저장/실행하세요. 매각일 기준 자동 조회 환율은 참고용입니다.', 400);
            }
            $fxLookup = adminSalesLookupHistoricalFx($settlement, $windowStart);
            $fixedFx = $storedManualFx;
            $fxSource = 'manual';
        }

        $computed = adminSalesComputeDraftPayout($asset, $sale, $settlement === 'USDT' ? 1.0 : $fixedFx);
        if ((float)($computed['sold_price_input'] ?? 0) <= 0) {
            throw new RuntimeException('총 매각금액을 입력한 뒤 매각을 실행하세요.', 400);
        }

        $fixedComputed = adminSalesComputeDraftPayout($asset, $sale, $settlement === 'USDT' ? 1.0 : $fixedFx);
        $executionPolicy = resolveSaleInterestPolicyContext(null, $windowStart, $executionNowUtc);
        $payableInterestResult = adminSalesEnsurePayableMonthInterest($assetId, $asset, null, $windowStart, $executionNowUtc);
        $interestCancelFromMonth = substr(trim((string)($executionPolicy['cancel_from_month'] ?? '')), 0, 7);
        if (!preg_match('/^\d{4}-\d{2}$/', $interestCancelFromMonth)) {
            throw new RuntimeException('매각 실행 기준 이자 중단월 정보가 올바르지 않습니다.', 400);
        }
        $interestResult = adminSalesCancelInterestFromMonth($assetId, $interestCancelFromMonth);
        $orderCancelResult = function_exists('marketCancelOpenOrdersForAsset')
            ? marketCancelOpenOrdersForAsset($assetId)
            : [
                'cancelled_order_count' => 0,
                'refunded_buy_escrow_usdt' => 0.0,
                'refunded_sell_escrow_token' => 0.0,
                'cancelled_order_maker_count' => 0,
            ];
        $unstakeResult = adminSalesAutoUnstakeAll($assetId);

        $updates = [
            'input_currency=?',
            'buy_price_krw=?',
            'sold_price_krw=?',
            'expenses_krw=?',
            'vault_balance_usdt=?',
            'window_start=?',
        ];
        $params = [
            $settlement,
            $fixedComputed['buy_price_input'],
            $fixedComputed['sold_price_input'],
            $fixedComputed['other_expenses_input'],
            $fixedComputed['vault_total_usdt'],
            $windowStart,
        ];

        if (adminSalesColumnExists('actual_acquisition_cost_input')) {
            $updates[] = 'actual_acquisition_cost_input=?';
            $params[] = $fixedComputed['actual_acquisition_cost_input'];
        }
        if (adminSalesColumnExists('sale_tax_amount')) {
            $updates[] = 'sale_tax_amount=?';
            $params[] = $fixedComputed['sale_tax_input'];
        }
        if (adminSalesColumnExists('other_expenses_input')) {
            $updates[] = 'other_expenses_input=?';
            $params[] = $fixedComputed['other_expenses_input'];
        }
        if (adminSalesColumnExists('manual_fx_per_usdt')) {
            $updates[] = 'manual_fx_per_usdt=?';
            $params[] = $settlement === 'USDT' ? 0 : clamp6(max(0.0, $storedManualFx));
        }
        if (adminSalesColumnExists('fixed_fx_per_usdt')) {
            $updates[] = 'fixed_fx_per_usdt=?';
            $params[] = $settlement === 'USDT' ? 1.0 : clamp6($fixedFx);
        }
        if (adminSalesColumnExists('executed_at')) {
            $updates[] = 'executed_at=?';
            $params[] = $executionNowUtc;
        }
        if (adminSalesColumnExists('executed_by')) {
            $updates[] = 'executed_by=?';
            $params[] = (string)($verifiedAdmin['username'] ?? ($sessionAdmin['username'] ?? 'admin'));
        }

        $params[] = $assetId;
        DB::execute("UPDATE sales SET " . implode(', ', $updates) . " WHERE asset_id=?", $params);
        DB::execute("UPDATE assets SET status=? WHERE id=?", [STATUSES['SOLD'], $assetId]);

        $pdo->commit();

        $responseFixedFx = $settlement === 'USDT' ? 1.0 : clamp6($fixedFx);
        $executedBy = (string)($verifiedAdmin['username'] ?? ($sessionAdmin['username'] ?? 'admin'));
        $saleLockAfter = adminSalesResolveLockState(
            $assetId,
            ['status' => STATUSES['SOLD']],
            [
                'executed_at' => $executionNowUtc,
                'fixed_fx_per_usdt' => $responseFixedFx,
            ]
        );

        jsonOk($fixedComputed + $payableInterestResult + $unstakeResult + $interestResult + $orderCancelResult + [
            'asset_id' => $assetId,
            'asset_status' => STATUSES['SOLD'],
            'fixed_fx_per_usdt' => $responseFixedFx,
            'manual_fx_per_usdt' => $settlement === 'USDT' ? 0 : clamp6(max(0.0, $storedManualFx)),
            'fx_source' => $fxSource,
            'historical_fetched_at' => $fxLookup['fetched_at'] ?? null,
            'historical_provider' => $fxLookup['provider'] ?? null,
            'sale_date' => $windowStart,
            'window_start' => $windowStart,
            'window_end' => null,
            'interest_cancel_from_month' => $interestCancelFromMonth,
            'interest_kept_current_month' => !empty($executionPolicy['keep_current_month']),
            'executed' => true,
            'executed_at' => $executionNowUtc,
            'executed_at_kst' => adminSalesFormatUtcToKstLabel($executionNowUtc),
            'sale_executed' => true,
            'sale_executed_at' => $executionNowUtc,
            'sale_executed_at_kst' => adminSalesFormatUtcToKstLabel($executionNowUtc),
            'executed_by' => $executedBy,
            'sale_lock' => $saleLockAfter,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
});

get('/api/admin/sales/:assetId/docs', function ($p) {
    adminOnly();
    $assetId = (string)($p['assetId'] ?? '');
    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산이 없습니다.');

    $docs = DB::fetchAll(
        "SELECT id, doc_type, title, doc_date, amount, amount_currency, file_path, created_at
         FROM asset_docs
         WHERE asset_id=? AND doc_type IN ('sale','sale_proof')
         ORDER BY doc_type ASC, doc_date DESC, id DESC",
        [$assetId]
    );

    foreach ($docs as &$doc) {
        $doc['category_label'] = SALE_DOC_CATEGORIES[$doc['doc_type']] ?? (string)($doc['doc_type'] ?? '');
    }
    unset($doc);

    jsonOk(['docs' => $docs, 'categories' => SALE_DOC_CATEGORIES]);
});

post('/api/admin/sales/:assetId/docs', function ($p) {
    adminOnly();
    $assetId = (string)($p['assetId'] ?? '');
    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산이 없습니다.');

    $type = trim((string)($_POST['type'] ?? 'sale'));
    $title = trim((string)($_POST['title'] ?? '매각 문서'));
    $docDate = !empty($_POST['date']) ? (string)$_POST['date'] : null;

    if (!isSaleDocType($type)) {
        jsonError(400, '매각 관련 문서 유형만 업로드할 수 있습니다.');
    }

    $result = adminSalesUploadFileRecord($assetId, $type, $title, $docDate, null, null);
    jsonOk($result);
});

delete_route('/api/admin/sales/:assetId/docs/:docId', function ($p) {
    adminOnly();
    $assetId = (string)($p['assetId'] ?? '');
    $docId = (string)($p['docId'] ?? '');
    $row = DB::fetchOne("SELECT * FROM asset_docs WHERE id=? AND asset_id=?", [$docId, $assetId]);
    if (!$row) jsonError(404, '문서가 없습니다.');
    if (!isSaleDocType((string)($row['doc_type'] ?? ''))) {
        jsonError(400, '매각 관련 문서만 이 API로 삭제할 수 있습니다.');
    }

    if (!empty($row['file_path'])) {
        $abs = UPLOAD_DIR . '/' . basename((string)$row['file_path']);
        if (file_exists($abs)) @unlink($abs);
    }

    DB::execute("DELETE FROM asset_docs WHERE id=?", [$docId]);
    jsonOk();
});
