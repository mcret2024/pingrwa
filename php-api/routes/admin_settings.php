<?php
/**
 * Admin Settings routes
 */

if (!function_exists('adminResetTableExists')) {
    function adminResetTableExists(string $table): bool {
        return (int)DB::fetchValue(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
            [$table]
        ) > 0;
    }
}

if (!function_exists('adminResetDeleteAllRows')) {
    function adminResetDeleteAllRows(string $table): int {
        if (!adminResetTableExists($table)) return 0;
        $count = (int)DB::fetchValue("SELECT COUNT(*) FROM `{$table}`");
        DB::execute("DELETE FROM `{$table}`");
        return $count;
    }
}

if (!function_exists('adminResetTruncateAllRows')) {
    function adminResetTruncateAllRows(string $table): int {
        if (!adminResetTableExists($table)) return 0;
        $count = (int)DB::fetchValue("SELECT COUNT(*) FROM `{$table}`");
        DB::get()->exec("TRUNCATE TABLE `{$table}`");
        return $count;
    }
}

if (!function_exists('adminResetSetAutoIncrement')) {
    function adminResetSetAutoIncrement(string $table): void {
        if (!adminResetTableExists($table)) return;
        try {
            DB::get()->exec("ALTER TABLE `{$table}` AUTO_INCREMENT = 1");
        } catch (Throwable $e) {
            // ignore when table has no AUTO_INCREMENT or privilege is unavailable
        }
    }
}

if (!function_exists('adminResetRemoveUploads')) {
    function adminResetRemoveUploads(string $rootDir): int {
        $rootDir = rtrim($rootDir, DIRECTORY_SEPARATOR);
        if ($rootDir === '' || !is_dir($rootDir)) return 0;

        // (2026-05-18 v509) 운영자 보고: '공지 다운로드 페이지 비어있음'.
        //   원인: notices 테이블은 reset 에 보존되는데 업로드 파일은 모두
        //   삭제 → 고아 file_path. 보존되는 테이블이 참조하는 파일 접두사
        //   는 skip 한다.
        //   notice_*    : notices 테이블 (보존)
        // 향후 추가 보존 테이블이 생기면 이 prefix 리스트에 추가.
        $preservePrefixes = ['notice_'];

        $removed = 0;
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($rootDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($it as $item) {
            $name = $item->getFilename();
            if (str_starts_with($name, '.')) continue;
            if (preg_match('/^index\.[a-z0-9]+$/i', $name)) continue;

            // (v509) 보존 prefix 매치 시 skip
            $skipPreserve = false;
            foreach ($preservePrefixes as $pfx) {
                if (strpos($name, $pfx) === 0) { $skipPreserve = true; break; }
            }
            if ($skipPreserve) continue;

            $path = $item->getPathname();
            if ($item->isFile() || $item->isLink()) {
                if (@unlink($path)) $removed++;
                continue;
            }

            if ($item->isDir()) {
                @rmdir($path);
            }
        }

        return $removed;
    }
}

get('/api/admin/simulate/status', function () {
    adminOnly();
    jsonOk(['enabled' => isAdminSimulationEnabled()]);
});

get('/api/admin/settings/staking', function () {
    adminOnly();
    jsonOk(['payday' => STAKING_PAYDAY, 'lock_days' => STAKING_LOCK_DAYS]);
});

post('/api/admin/settings/staking', function () {
    adminOnly();
    // Staking settings are hard-coded
    jsonOk(['payday' => STAKING_PAYDAY, 'lock_days' => STAKING_LOCK_DAYS]);
});

get('/api/admin/users/balance', function () {
    adminOnly();
    $address = trim($_GET['address'] ?? '');
    $query = trim($_GET['q'] ?? '');
    $limit = min(500, max(1, (int)($_GET['limit'] ?? 100)));

    // (2026-05-21 v734) sync stale wallet_tx before counting pending — admin/users
    //   페이지 진입 시도 토큰 출금 cancel/processing 흐름의 sync 보장.
    if (function_exists('adminTokenWithdrawSyncStaleWalletTx')) {
        try { adminTokenWithdrawSyncStaleWalletTx(true); } catch (Throwable $_) {}
    }

    if ($address !== '') {
        ensureUser($address);
        $row = DB::fetchOne(
            "SELECT u.address, u.kyc_yn, u.created_at, u.mt_name,
                    COALESCE(b.usdt,0) AS usdt,
                    " . userControlSelectExpr('u', 'is_suspended', '0', true) . ",
                    " . userControlSelectExpr('u', 'withdraw_suspended', '0', true) . ",
                    " . userControlSelectExpr('u', 'suspended_reason', 'NULL') . ",
                    " . userControlSelectExpr('u', 'withdraw_suspension_reason', 'NULL') . "
             FROM users u
             LEFT JOIN balances b ON b.address = u.address
             WHERE u.address = ?
             LIMIT 1",
            [$address]
        );
        if (!$row) jsonError(404, '유저가 없습니다.');

        // (2026-05-21 v687) 운영자 요청: 선택 유저 상세에서 Silica 와 STO
        //   를 분리 표시. holdings 테이블의 silica_sto_balance / silica_sto_staked
        //   / silica_balance 컬럼을 함께 조회하여 종류별 합계 노출.
        //   COALESCE 로 NULL 안전 + 직접 참조 (admin_users.php /holdings-diag
        //   도 동일하게 직접 참조 → production schema 보장됨).
        $holdings = DB::fetchAll(
            "SELECT h.asset_id, h.balance_token, h.staked_token, h.claimed_token, h.redeemed_token,
                    COALESCE(h.silica_sto_balance, 0) AS silica_sto_balance,
                    COALESCE(h.silica_sto_staked, 0)  AS silica_sto_staked,
                    COALESCE(h.silica_balance, 0)     AS silica_balance,
                    a.name AS name
               FROM holdings h
          LEFT JOIN assets a ON a.id = h.asset_id
              WHERE h.address=?
           ORDER BY h.asset_id",
            [$address]
        );

        $tokenTotal = 0.0;
        $stakedTotal = 0.0;
        $silicaStoBalance = 0.0;
        $silicaStoStaked = 0.0;
        $silicaBalance = 0.0;
        foreach ($holdings as $h) {
            $tokenTotal += (float)($h['balance_token'] ?? 0) + (float)($h['staked_token'] ?? 0);
            $stakedTotal += (float)($h['staked_token'] ?? 0);
            $silicaStoBalance += (float)($h['silica_sto_balance'] ?? 0);
            $silicaStoStaked += (float)($h['silica_sto_staked'] ?? 0);
            $silicaBalance += (float)($h['silica_balance'] ?? 0);
        }

        $openOrders = 0;
        try { $openOrders = (int)DB::fetchValue("SELECT COUNT(*) FROM orders WHERE maker_address=? AND status='open'", [$address]); } catch (Throwable $e) {}
        $pendingWithdrawals = 0;
        try { $pendingWithdrawals = (int)DB::fetchValue("SELECT COUNT(*) FROM withdraw_requests WHERE address=? AND status IN ('pending','processing')", [$address]); } catch (Throwable $e) {}
        $pendingTokenWithdrawals = 0;
        try { $pendingTokenWithdrawals = (int)DB::fetchValue("SELECT COUNT(*) FROM token_withdraw_requests WHERE address=? AND status IN ('pending','processing')", [$address]); } catch (Throwable $e) {}

        // (2026-05-21 v720) 운영자 요청: 선택 유저 상세의 자산 카드에 출금 대기
        //   AMOUNT 표시 + 출금 요청 카드 클릭 시 팝업으로 detail 표시.
        //   - pending_withdraw_amount_usdt   : USDT 대기 합계
        //   - pending_withdraw_amount_sto    : SilicaSTO 대기 합계
        //   - pending_withdraw_amount_silica : Silica 대기 합계
        //   - pending_withdraw_details       : 각 요청 row (id, amount, asset, created_at, status)
        $pendingWithdrawAmountUsdt = 0.0;
        $pendingWithdrawAmountSto = 0.0;
        $pendingWithdrawAmountSilica = 0.0;
        $pendingWithdrawDetails = [];
        try {
            $pendingWithdrawAmountUsdt = (float)DB::fetchValue(
                "SELECT COALESCE(SUM(amount), 0) FROM withdraw_requests
                  WHERE address=? AND LOWER(TRIM(status)) IN ('pending', 'processing')",
                [$address]
            );
            $usdtRows = DB::fetchAll(
                "SELECT id, amount, status, created_at, to_address
                   FROM withdraw_requests
                  WHERE address=? AND LOWER(TRIM(status)) IN ('pending', 'processing')
               ORDER BY id DESC",
                [$address]
            );
            foreach ($usdtRows as $w) {
                $pendingWithdrawDetails[] = [
                    'id' => (int)$w['id'],
                    'kind' => 'usdt',
                    'asset' => 'USDT',
                    'amount' => (float)$w['amount'],
                    'status' => $w['status'],
                    'created_at' => $w['created_at'],
                    'to_address' => $w['to_address'] ?? '',
                ];
            }
        } catch (Throwable $_) {}
        try {
            $pendingWithdrawAmountSto = (float)DB::fetchValue(
                "SELECT COALESCE(SUM(amount_token), 0) FROM token_withdraw_requests
                  WHERE address=? AND LOWER(TRIM(status)) IN ('pending', 'processing')
                    AND asset_id IN ('SilicaSTO', 'SILICA-79907')",
                [$address]
            );
            $pendingWithdrawAmountSilica = (float)DB::fetchValue(
                "SELECT COALESCE(SUM(amount_token), 0) FROM token_withdraw_requests
                  WHERE address=? AND LOWER(TRIM(status)) IN ('pending', 'processing')
                    AND asset_id = 'Silica'",
                [$address]
            );
            $tokenRows = DB::fetchAll(
                "SELECT id, asset_id, amount_token, status, created_at, to_address
                   FROM token_withdraw_requests
                  WHERE address=? AND LOWER(TRIM(status)) IN ('pending', 'processing')
               ORDER BY id DESC",
                [$address]
            );
            foreach ($tokenRows as $w) {
                $pendingWithdrawDetails[] = [
                    'id' => (int)$w['id'],
                    'kind' => 'token',
                    'asset' => $w['asset_id'],
                    'amount' => (float)$w['amount_token'],
                    'status' => $w['status'],
                    'created_at' => $w['created_at'],
                    'to_address' => $w['to_address'] ?? '',
                ];
            }
        } catch (Throwable $_) {}

        $ctrl = resolveUserControlStatus($address, $row);

        jsonOk([
            'address' => $row['address'],
            'name' => decodeMaybeStoredText($row['mt_name'] ?? null),
            'usdt' => (float)($row['usdt'] ?? 0),
            'token_total' => clamp6($tokenTotal),
            'staked_total' => clamp6($stakedTotal),
            // (v687) Silica / SilicaSTO 분리 표시용
            'silica_sto_balance' => clamp6($silicaStoBalance),
            'silica_sto_staked' => clamp6($silicaStoStaked),
            'silica_balance' => clamp6($silicaBalance),
            'open_orders' => $openOrders,
            'pending_withdrawals' => $pendingWithdrawals,
            'pending_token_withdrawals' => $pendingTokenWithdrawals,
            // (v720) 자산 카드 내 출금 대기 amount + 팝업용 detail
            'pending_withdraw_amount_usdt'   => clamp6($pendingWithdrawAmountUsdt),
            'pending_withdraw_amount_sto'    => clamp6($pendingWithdrawAmountSto),
            'pending_withdraw_amount_silica' => clamp6($pendingWithdrawAmountSilica),
            'pending_withdraw_details'       => $pendingWithdrawDetails,
            'is_suspended' => !empty($ctrl['is_suspended']),
            'withdraw_suspended' => !empty($ctrl['withdraw_suspended']),
            'suspended_reason' => ($ctrl['suspended_reason'] !== '' ? $ctrl['suspended_reason'] : null),
            'withdraw_suspension_reason' => ($ctrl['withdraw_suspension_reason'] !== '' ? $ctrl['withdraw_suspension_reason'] : null),
            'kyc_yn' => $row['kyc_yn'] ?? 'N',
            'created_at' => $row['created_at'] ?? null,
            'holdings' => $holdings,
        ]);
    }

    if ($query) {
        $rows = DB::fetchAll(
            "SELECT u.address, COALESCE(b.usdt,0) AS usdt, u.kyc_yn, u.created_at, u.mt_name,
                    " . userControlSelectExpr('u', 'is_suspended', '0', true) . ",
                    " . userControlSelectExpr('u', 'withdraw_suspended', '0', true) . "
             FROM users u
             LEFT JOIN balances b ON b.address = u.address
             WHERE u.address LIKE ?
             ORDER BY u.created_at DESC LIMIT {$limit}",
            ["%$query%"]
        );
    } else {
        $rows = DB::fetchAll(
            "SELECT u.address, COALESCE(b.usdt,0) AS usdt, u.kyc_yn, u.created_at, u.mt_name,
                    " . userControlSelectExpr('u', 'is_suspended', '0', true) . ",
                    " . userControlSelectExpr('u', 'withdraw_suspended', '0', true) . "
             FROM users u
             LEFT JOIN balances b ON b.address = u.address
             ORDER BY u.created_at DESC LIMIT {$limit}"
        );
    }

    foreach ($rows as &$row) {
        $row['name'] = decodeMaybeStoredText($row['mt_name'] ?? null);
        $ctrl = resolveUserControlStatus((string)($row['address'] ?? ''), $row);
        $row['is_suspended'] = !empty($ctrl['is_suspended']);
        $row['withdraw_suspended'] = !empty($ctrl['withdraw_suspended']);
    }
    unset($row);

    jsonOk(['users' => $rows]);
});

post('/api/admin/simulate/balance', function () {
    adminOnly();
    if (!isAdminSimulationEnabled()) jsonError(403, '시뮬레이션이 비활성화되어 있습니다.');

    $body = getJsonBody();
    $address = trim($body['address'] ?? '');
    $amount = (float)($body['amount'] ?? 0);

    if (!$address) jsonError(400, 'address 필요');
    if (!is_finite($amount) || $amount <= 0) jsonError(400, 'amount 올바르지 않음');

    ensureUser($address);
    DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$amount, $address]);

    $bal = DB::fetchOne("SELECT usdt FROM balances WHERE address=?", [$address]);
    jsonOk(['new_balance' => (float)($bal['usdt'] ?? 0)]);
});

get('/api/admin/settings/fx', function () {
    adminOnly();
    $fxRates = getFxTable();
    jsonOk(['fx_rates' => $fxRates]);
});

post('/api/admin/settings/fx', function () {
    adminOnly();
    $body = getJsonBody();

    foreach (FX_KEY as $ccy => $key) {
        if (isset($body[$key])) {
            $v = (float)$body[$key];
            if ($v > 0) setSetting($key, (string)$v);
        }
        if (isset($body[strtolower($ccy)])) {
            $v = (float)$body[strtolower($ccy)];
            if ($v > 0) setSetting($key, (string)$v);
        }
    }

    jsonOk(['fx_rates' => getFxTable()]);
});

get('/api/admin/settings/deposit', function () {
    adminOnly();
    $addr = getSetting('deposit_admin_usdt_address', '') ?? '';
    jsonOk(['deposit_admin_usdt_address' => $addr]);
});

post('/api/admin/settings/deposit', function () {
    adminOnly();
    $body = getJsonBody();
    $addr = trim($body['deposit_admin_usdt_address'] ?? '');
    if ($addr && !isValidSolanaAddress($addr)) jsonError(400, '유효하지 않은 주소');
    setSetting('deposit_admin_usdt_address', $addr);
    jsonOk();
});

// ====== Solana Network / USDT Token Settings ======

/**
 * (v864) URL 에서 host 만 추출 — API key 마스킹 처리.
 *   "https://mainnet.helius-rpc.com/?api-key=abc..." → "mainnet.helius-rpc.com"
 *   admin 화면 응답에서 full URL 노출을 차단하여 어깨너머/스크린샷/DevTools
 *   네트워크 탭 등에서 키가 새지 않도록 한다.
 */
function maskSolanaRpcUrlToHost(string $url): string {
    $s = trim($url);
    if ($s === '') return '';
    $host = parse_url($s, PHP_URL_HOST);
    return is_string($host) && $host !== '' ? $host : '(URL 형식 오류)';
}

get('/api/admin/settings/solana', function () {
    adminOnly();
    $network = getSetting('solana_network', 'devnet') ?? 'devnet';
    $rpcUrl = getSetting('solana_rpc_url', '') ?? '';
    $usdtMint = getSetting('solana_usdt_mint', USDT_MINT) ?? USDT_MINT;
    $usdtDecimals = (int)(getSetting('solana_usdt_decimals', '6') ?? '6');

    // (2026-06-07 v862) 실제 RPC + 출처. (v864) full URL 은 응답에서 제외
    //   하고 host 만 노출 — API key 노출 방지.
    $eff = getEffectiveRpcUrlWithSource();

    // (2026-06-07 v863) RPC 연결 health check — admin 화면에 활성화/오류 표시.
    //   query param ?skip_health=1 → 페이지 로딩 속도 우선시 health 생략 가능.
    $skipHealth = isset($_GET['skip_health']) && $_GET['skip_health'] === '1';
    $health = $skipHealth
        ? null
        : checkSolanaRpcHealth($eff['url']);

    // (v864) legacy admin override URL 도 host 만 반환 (frontend 경고 배너용).
    $rpcUrlHostOnly = $rpcUrl !== '' ? maskSolanaRpcUrlToHost($rpcUrl) : '';

    jsonOk([
        'network' => $network,
        'rpc_url' => $rpcUrlHostOnly,                       // (v864) host 만 (legacy: full URL 이었음)
        'rpc_url_present' => $rpcUrl !== '',                // (v864) 값 존재 여부만 boolean
        'effective_rpc_host' => maskSolanaRpcUrlToHost($eff['url']), // (v864) full URL 대신 host
        'effective_rpc_source' => $eff['source'],           // (v862) source label
        'rpc_health' => $health,                            // (v863) RPC 연결 상태 (status: ok|error, message, latency_ms)
        'usdt_mint' => $usdtMint,
        'usdt_decimals' => $usdtDecimals,
        'default_usdt_mint' => USDT_MINT,
    ]);
});

// (2026-06-07 v863) RPC 연결 상태만 빠르게 검사 — admin 화면의 "재검사" 버튼.
//   GET /api/admin/settings/solana 는 다른 설정도 함께 반환하므로
//   재검사만 필요할 때는 이 가벼운 endpoint 를 사용.
//   (v864) full URL 노출 제거 — host 만 반환.
get('/api/admin/settings/solana/health', function () {
    adminOnly();
    $eff = getEffectiveRpcUrlWithSource();
    $health = checkSolanaRpcHealth($eff['url']);
    jsonOk([
        'network'              => $eff['network'],
        'effective_rpc_host'   => maskSolanaRpcUrlToHost($eff['url']), // (v864) host 만
        'effective_rpc_source' => $eff['source'],
        'rpc_health'           => $health,
        'checked_at'           => date('c'),
    ]);
});

post('/api/admin/settings/solana', function () {
    adminOnly();
    $body = getJsonBody();

    if (isset($body['network'])) {
        $net = trim($body['network']);
        if (!in_array($net, ['devnet', 'mainnet-beta'])) jsonError(400, '네트워크는 devnet 또는 mainnet-beta 중 하나여야 합니다.');
        setSetting('solana_network', $net);
    }

    // (v863) RPC URL 응급 override — frontend 입력 필드는 v863 부터 제거됨.
    //   다만 API 직접 호출 시 (개발자/배포 스크립트) 강제 설정 가능하도록 유지.
    //   본 키가 빈 값으로 저장되면 우선순위 1번이 비활성 → silica.env 의 네트워크별
    //   키가 정상 적용됨.
    if (isset($body['rpc_url'])) {
        $url = trim($body['rpc_url']);
        if ($url && !filter_var($url, FILTER_VALIDATE_URL)) jsonError(400, 'RPC URL이 올바르지 않습니다.');
        setSetting('solana_rpc_url', $url);
    }

    if (isset($body['usdt_mint'])) {
        $mint = trim($body['usdt_mint']);
        if ($mint && !preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $mint)) {
            jsonError(400, 'Mint 주소가 올바르지 않습니다. (Base58, 32-44자)');
        }
        setSetting('solana_usdt_mint', $mint);
    }

    if (isset($body['usdt_decimals'])) {
        $dec = (int)$body['usdt_decimals'];
        if ($dec < 0 || $dec > 18) jsonError(400, '소수점은 0~18 사이여야 합니다.');
        setSetting('solana_usdt_decimals', (string)$dec);
    }

    jsonOk(['saved' => true]);
});

// ====== OTP/KYC Toggle Settings ======

get('/api/admin/settings/security', function () {
    adminOnly();
    jsonOk([
        'bypass_otp' => isOtpBypassed(),
        'bypass_kyc' => isKycBypassed(),
        'env_bypass_otp' => BYPASS_OTP,
        'env_bypass_kyc' => BYPASS_KYC,
    ]);
});

post('/api/admin/settings/security', function () {
    adminOnly();
    $body = getJsonBody();

    if (isset($body['bypass_otp'])) {
        $val = filter_var($body['bypass_otp'], FILTER_VALIDATE_BOOLEAN) ? '1' : '0';
        setSetting('bypass_otp', $val);
    }

    if (isset($body['bypass_kyc'])) {
        $val = filter_var($body['bypass_kyc'], FILTER_VALIDATE_BOOLEAN) ? '1' : '0';
        setSetting('bypass_kyc', $val);
    }

    jsonOk([
        'bypass_otp' => isOtpBypassed(),
        'bypass_kyc' => isKycBypassed(),
        'saved' => true,
    ]);
});

get('/api/admin/settings/withdraw-wallet', function () {
    adminOnly();
    $addr = getSetting('withdraw_admin_usdt_address', '') ?? '';
    jsonOk(['withdraw_admin_usdt_address' => $addr]);
});

get('/api/admin/settings/withdraw-fee', function () {
    adminOnly();
    jsonOk([
        'withdraw_fee_mode' => getWithdrawFeeMode(),
        'withdraw_fee_usdt' => getWithdrawFeeFixedUsdt(),
        'withdraw_fee_percent' => getWithdrawFeePercent(),
    ]);
});

post('/api/admin/settings/withdraw-fee', function () {
    adminOnly();
    $body = getJsonBody();

    $mode = strtolower(trim((string)($body['withdraw_fee_mode'] ?? getWithdrawFeeMode())));
    if (!in_array($mode, ['fixed_usdt', 'percent'], true)) jsonError(400, '출금 수수료 방식이 올바르지 않습니다.');

    // 엄격한 숫자 검증 — 음수/비숫자/무한대/과대값 전부 차단
    $feeUsdtRaw = $body['withdraw_fee_usdt'] ?? getWithdrawFeeFixedUsdt();
    $feePctRaw  = $body['withdraw_fee_percent'] ?? getWithdrawFeePercent();

    // 1) 타입 검증: 숫자(int/float) 또는 숫자 문자열만 허용
    if (!is_numeric($feeUsdtRaw)) jsonError(400, '고정 출금 수수료는 숫자여야 합니다.');
    if (!is_numeric($feePctRaw))  jsonError(400, '퍼센트 출금 수수료는 숫자여야 합니다.');

    $feeUsdt = (float)$feeUsdtRaw;
    $feePct  = (float)$feePctRaw;

    // 2) 유한성 검증 (NaN/Infinity 차단)
    if (!is_finite($feeUsdt)) jsonError(400, '고정 출금 수수료 값이 유효하지 않습니다.');
    if (!is_finite($feePct))  jsonError(400, '퍼센트 출금 수수료 값이 유효하지 않습니다.');

    // 3) 하한 검증 (음수 차단) — 엄격하게 0 이상
    if ($feeUsdt < 0) jsonError(400, '고정 출금 수수료는 0 이상이어야 합니다. (음수 입력 차단)');
    if ($feePct < 0)  jsonError(400, '퍼센트 출금 수수료는 0 이상이어야 합니다. (음수 입력 차단)');

    // 4) 상한 검증 (비정상 대형값 차단)
    if ($feeUsdt > 10000) jsonError(400, '고정 출금 수수료는 10,000 USDT 이하로 설정해야 합니다.');
    if ($feePct >= 100)   jsonError(400, '퍼센트 출금 수수료는 100% 미만이어야 합니다.');

    setSetting('withdraw_fee_mode', $mode);
    setSetting('withdraw_fee_usdt', (string)round($feeUsdt, 6));
    setSetting('withdraw_fee_percent', (string)round($feePct, 6));

    jsonOk([
        'withdraw_fee_mode' => $mode,
        'withdraw_fee_usdt' => round($feeUsdt, 6),
        'withdraw_fee_percent' => round($feePct, 6),
        'saved' => true,
    ]);
});

// (2026-05-07) Swap 수수료 — % 단일 모드 (0~10 범위).
//   사용자가 swap.html 에서 Sync Price 시점에 quote 와 함께 잠금되며,
//   execute 시 백엔드가 잠금된 fee_pct 로 net USDT 계산 후 STO 지급.
//   허용 범위 0~10% 는 정책적 안전장치 — 더 높으면 사용자 이탈 / 분쟁 위험.

get('/api/admin/settings/swap-fee', function () {
    adminOnly();
    $stored = getSetting('swap_fee_pct', '0');
    $val = (float)$stored;
    if (!is_finite($val) || $val < 0 || $val > 100) $val = 0.0;
    jsonOk(['swap_fee_pct' => round($val, 4)]);
});

post('/api/admin/settings/swap-fee', function () {
    adminOnly();
    $body = getJsonBody();

    // 1) 타입 검증 — 숫자(int/float) 또는 숫자 문자열만.
    //    악의적 입력(객체/배열/스크립트 문자열) 전부 차단.
    $raw = $body['swap_fee_pct'] ?? null;
    if ($raw === null) jsonError(400, '스왑 수수료 (%) 값을 입력하세요.');
    if (!is_numeric($raw)) jsonError(400, '스왑 수수료는 숫자여야 합니다.');

    $pct = (float)$raw;

    // 2) 유한성 검증 — NaN / Infinity / -Infinity 차단.
    if (!is_finite($pct)) jsonError(400, '스왑 수수료 값이 유효하지 않습니다.');

    // 3) 하한 — 음수 절대 차단 (사용자가 양수로 받게 되는 사기 방지).
    if ($pct < 0) jsonError(400, '스왑 수수료는 0 이상이어야 합니다. (음수 입력 차단)');

    // 4) 상한 — 정책상 10% 이하. 이 이상은 운영 분쟁 유발 가능성.
    if ($pct > 10) jsonError(400, '스왑 수수료는 10% 이하로 설정해야 합니다.');

    // 5) 정밀도 — 소수 4째 자리까지만 의미 있음 (DB 컬럼 DECIMAL(7,4)).
    $pctRounded = round($pct, 4);

    setSetting('swap_fee_pct', (string)$pctRounded);

    jsonOk([
        'swap_fee_pct' => $pctRounded,
        'saved' => true,
    ]);
});

post('/api/admin/settings/withdraw-wallet', function () {
    adminOnly();
    $body = getJsonBody();
    $addr = trim($body['withdraw_admin_usdt_address'] ?? '');
    if ($addr && !isValidSolanaAddress($addr)) jsonError(400, '유효하지 않은 주소');
    setSetting('withdraw_admin_usdt_address', $addr);
    jsonOk();
});

// ====== AMM Liquidity Management (ledger-only) ======

/**
 * amm_admin_audit 테이블 존재 보장.
 * sql/manual_amm_admin_audit_patch.sql 이 아직 적용되지 않은 환경(배포 직후)
 * 에서도 감사 로그가 누락되지 않도록 런타임에 안전하게 CREATE.
 * 프로세스당 1회만 실행 (static flag) → 매 요청마다 CREATE 쿼리 반복 비용 없음.
 */
if (!function_exists('ensureAmmAuditTable')) {
    function ensureAmmAuditTable(): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        try {
            DB::execute("
                CREATE TABLE IF NOT EXISTS `amm_admin_audit` (
                    `id` bigint NOT NULL AUTO_INCREMENT,
                    `admin_username` varchar(64) DEFAULT NULL,
                    `action` varchar(32) NOT NULL,
                    `asset_id` varchar(64) DEFAULT NULL,
                    `amount` decimal(18,6) DEFAULT NULL,
                    `price` decimal(18,6) DEFAULT NULL,
                    `order_id` varchar(64) DEFAULT NULL,
                    `balance_before` decimal(18,6) DEFAULT NULL,
                    `balance_after` decimal(18,6) DEFAULT NULL,
                    `ip` varchar(64) DEFAULT NULL,
                    `user_agent` varchar(255) DEFAULT NULL,
                    `note` varchar(255) DEFAULT NULL,
                    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    KEY `idx_amm_audit_action` (`action`),
                    KEY `idx_amm_audit_created_at` (`created_at`),
                    KEY `idx_amm_audit_admin` (`admin_username`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            ");
        } catch (Throwable $e) {
            // CREATE 권한 없거나 오래된 MySQL 등 — 감사 기능만 비활성화되고 주 기능은 계속 동작
            error_log('[ensureAmmAuditTable] ' . $e->getMessage());
        }
    }
}

/**
 * AMM 관리자 작업 감사 로그 insert helper.
 * 테이블이 없으면 ensureAmmAuditTable 로 즉시 생성 후 기록 → 감사 로그 누락 방지.
 */
if (!function_exists('ammAuditLog')) {
    function ammAuditLog(?array $admin, string $action, array $data = []): void {
        ensureAmmAuditTable();
        try {
            DB::execute(
                "INSERT INTO amm_admin_audit
                   (admin_username, action, asset_id, amount, price, order_id,
                    balance_before, balance_after, ip, user_agent, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    $admin['username'] ?? null,
                    $action,
                    $data['asset_id']       ?? null,
                    isset($data['amount'])         ? (float)$data['amount']         : null,
                    isset($data['price'])          ? (float)$data['price']          : null,
                    $data['order_id']       ?? null,
                    isset($data['balance_before']) ? (float)$data['balance_before'] : null,
                    isset($data['balance_after'])  ? (float)$data['balance_after']  : null,
                    (function_exists('getReqIp') ? getReqIp() : ($_SERVER['REMOTE_ADDR'] ?? null)),
                    substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
                    $data['note'] ?? null,
                ]
            );
        } catch (Throwable $e) {
            error_log('[ammAuditLog] ' . $e->getMessage());
        }
    }
}

get('/api/admin/settings/amm', function () {
    adminOnly();
    DB::execute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
    $pb = DB::fetchOne("SELECT usdt_balance, updated_at FROM platform_balance WHERE id=1");
    $enabled = (getSetting('amm_enabled', '1') ?? '1') === '1';

    $tokens = [];
    $openOrders = [];
    if (defined('PLATFORM_AMM_ADDRESS')) {
        // 1) holdings.balance_token — 즉시 매도 가능한 "보유" 수량
        $holdings = [];
        try {
            $holdings = DB::fetchAll(
                "SELECT h.asset_id, h.balance_token, a.name, a.market
                   FROM holdings h
              LEFT JOIN assets a ON a.id = h.asset_id
                  WHERE h.address=? AND h.balance_token > 0
               ORDER BY h.asset_id",
                [PLATFORM_AMM_ADDRESS]
            );
        } catch (Throwable $e) {
            $holdings = [];
        }

        // 2) 오픈 매도 주문에 잠긴 escrow_token — 매각 중이지만 여전히 AMM 소유
        $escrowRows = [];
        try {
            $escrowRows = DB::fetchAll(
                "SELECT o.asset_id,
                        SUM(COALESCE(o.escrow_token, o.remaining, 0)) AS escrow_token,
                        MAX(a.name) AS name, MAX(a.market) AS market
                   FROM orders o
              LEFT JOIN assets a ON a.id = o.asset_id
                  WHERE o.maker_address=? AND o.status='open' AND o.side='sell'
               GROUP BY o.asset_id",
                [PLATFORM_AMM_ADDRESS]
            );
        } catch (Throwable $e) {
            $escrowRows = [];
        }

        // 3) asset_id 기준으로 merge (보유 + 오픈주문 합산)
        $byAsset = [];
        foreach ($holdings as $h) {
            $aid = (string)$h['asset_id'];
            $byAsset[$aid] = [
                'asset_id'      => $aid,
                'name'          => $h['name'] ?? null,
                'market'        => $h['market'] ?? null,
                'balance_token' => (float)($h['balance_token'] ?? 0),
                'escrow_token'  => 0.0,
            ];
        }
        foreach ($escrowRows as $e) {
            $aid = (string)$e['asset_id'];
            if (!isset($byAsset[$aid])) {
                $byAsset[$aid] = [
                    'asset_id'      => $aid,
                    'name'          => $e['name'] ?? null,
                    'market'        => $e['market'] ?? null,
                    'balance_token' => 0.0,
                    'escrow_token'  => 0.0,
                ];
            }
            $byAsset[$aid]['escrow_token'] = (float)($e['escrow_token'] ?? 0);
        }

        // 4) total 계산 + 정렬 + 필터
        foreach ($byAsset as &$row) {
            $row['total_token'] = clamp6($row['balance_token'] + $row['escrow_token']);
        }
        unset($row);
        $tokens = array_values(array_filter($byAsset, fn($r) => ($r['total_token'] ?? 0) > 0));
        usort($tokens, fn($a, $b) => strcmp($a['asset_id'], $b['asset_id']));

        try {
            $openOrders = DB::fetchAll(
                "SELECT o.id, o.asset_id, o.side, o.price, o.amount, o.remaining,
                        o.escrow_token, o.expiry_date, o.status, o.created_at,
                        a.name AS asset_name, a.market AS asset_market
                   FROM orders o
              LEFT JOIN assets a ON a.id = o.asset_id
                  WHERE o.maker_address=? AND o.status='open'
               ORDER BY o.created_at DESC",
                [PLATFORM_AMM_ADDRESS]
            );
        } catch (Throwable $e) {
            $openOrders = [];
        }
    }

    // Silica 단일 자산 — SilicaSTO / Silica 토큰별 잔액 (silica_schema_migration 적용 환경)
    $silicaBalances = [
        'asset_id'           => null,
        'silica_sto_balance' => 0.0,
        'silica_balance'     => 0.0,
        'silica_sto_staked'  => 0.0,
    ];
    if (defined('PLATFORM_AMM_ADDRESS')) {
        try {
            $row = DB::fetchOne(
                "SELECT h.asset_id, h.silica_sto_balance, h.silica_balance, h.silica_sto_staked
                   FROM holdings h
                  WHERE h.address=?
               ORDER BY h.asset_id ASC
                  LIMIT 1",
                [PLATFORM_AMM_ADDRESS]
            );
            if ($row) {
                $silicaBalances = [
                    'asset_id'           => $row['asset_id'] ?? null,
                    'silica_sto_balance' => (float)($row['silica_sto_balance'] ?? 0),
                    'silica_balance'     => (float)($row['silica_balance'] ?? 0),
                    'silica_sto_staked'  => (float)($row['silica_sto_staked'] ?? 0),
                ];
            }
        } catch (Throwable $e) {
            // 컬럼 없는 구 환경 — 0 유지
        }
    }

    // ★ 자동매수 임계값 — 관리자 설정 (기본 0.8)
    $ammThreshold = (float)(getSetting('amm_threshold', '0.8') ?? '0.8');
    if (!is_finite($ammThreshold) || $ammThreshold <= 0 || $ammThreshold > 1) {
        $ammThreshold = 0.8;
    }

    jsonOk([
        'amm_enabled'         => $enabled,
        'usdt_balance'        => (float)($pb['usdt_balance'] ?? 0),
        'updated_at'          => $pb['updated_at'] ?? null,
        'accumulated_tokens'  => $tokens,
        'open_orders'         => $openOrders,
        'amm_threshold'       => $ammThreshold,
        'silica_balances'     => $silicaBalances,
    ]);
});

// AMM 토큰 재활용 매각: 관리자가 AMM 보유 토큰을 오더북에 매도 등록
post('/api/admin/settings/amm/sell', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    $assetId    = trim((string)($body['asset_id'] ?? ''));
    $tokenType  = strtolower(trim((string)($body['token_type'] ?? 'legacy')));
    $priceRaw   = $body['price']  ?? null;
    $amountRaw  = $body['amount'] ?? null;
    $expiryDate = !empty($body['expiry_date']) ? trim((string)$body['expiry_date']) : null;

    if ($assetId === '') jsonError(400, '자산(asset_id)을 선택하세요.');
    if (!in_array($tokenType, ['legacy', 'silica_sto', 'silica'], true)) {
        jsonError(400, "token_type 은 'silica_sto' 또는 'silica' 여야 합니다.");
    }

    // 엄격 숫자 검증 — 음수/비숫자/무한대/0 전부 차단
    if (!is_numeric($priceRaw))  jsonError(400, '가격은 숫자여야 합니다.');
    if (!is_numeric($amountRaw)) jsonError(400, '수량은 숫자여야 합니다.');
    $price  = (float)$priceRaw;
    $amount = (float)$amountRaw;
    if (!is_finite($price))                  jsonError(400, '가격 값이 유효하지 않습니다.');
    if (!is_finite($amount))                 jsonError(400, '수량 값이 유효하지 않습니다.');
    if ($price  <= 0) jsonError(400, '가격은 0보다 커야 합니다. (음수 입력 차단)');
    if ($amount <= 0) jsonError(400, '수량은 0보다 커야 합니다. (음수 입력 차단)');
    if ($price  > 1000000)    jsonError(400, '가격은 1,000,000 USDT 이하로 설정하세요.');
    if ($amount > 1000000000) jsonError(400, '한 번에 매도 가능한 수량은 10억 이하입니다.');

    if (!defined('PLATFORM_AMM_ADDRESS')) jsonError(500, 'AMM 주소가 설정되지 않았습니다.');
    $ammAddr = trim((string)PLATFORM_AMM_ADDRESS);
    if ($ammAddr === '') jsonError(500, 'AMM 주소가 비어 있습니다.');

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산을 찾을 수 없습니다.');

    // 토큰 종류별 holdings 컬럼 매핑
    $balanceCol = match ($tokenType) {
        'silica_sto' => 'silica_sto_balance',
        'silica'     => 'silica_balance',
        default      => 'balance_token',
    };

    // 1,000건 오픈 주문 상한 검사 (DoS 방지)
    $openCount = (int)DB::fetchValue(
        "SELECT COUNT(*) FROM orders WHERE maker_address=? AND status='open'",
        [$ammAddr]
    );
    if ($openCount >= 1000) {
        jsonError(400, '동시 오픈 AMM 주문은 1,000건 이하로 제한됩니다. 기존 주문을 취소한 뒤 재시도하세요.');
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        ensureUser($ammAddr);
        ensureHolding($ammAddr, $assetId);

        $h = DB::fetchOne(
            "SELECT `{$balanceCol}` AS bal FROM holdings WHERE address=? AND asset_id=? FOR UPDATE",
            [$ammAddr, $assetId]
        );
        $available = (float)($h['bal'] ?? 0);
        if ($available + 0.000001 < $amount) {
            $pdo->rollBack();
            $tokenLabel = $tokenType === 'silica_sto' ? 'SilicaSTO' : ($tokenType === 'silica' ? 'Silica' : '토큰');
            jsonError(400, sprintf('AMM %s 보유량 부족. (보유: %s, 요청: %s)',
                $tokenLabel, number_format($available, 6), number_format($amount, 6)));
        }

        DB::execute(
            "UPDATE holdings SET `{$balanceCol}` = `{$balanceCol}` - ? WHERE address=? AND asset_id=?",
            [$amount, $ammAddr, $assetId]
        );

        // (2026-05-20 v667) AMM 매도 등록 시 기존 매수 주문과 즉시 매칭.
        //   운영자: 'AMM 이 시세 2.00 에 매도 등록했는데, 시세 2.00 매수
        //   주문이 이미 오더북에 있어도 매칭되지 않는다.'
        //   원인: 이 endpoint 가 marketInsertOrder 만 호출, marketAutoMatch
        //   AgainstBook 미호출 → 일반 유저 매도 (markets.php POST /api/orders)
        //   는 호출하지만 AMM admin sell 만 빠져있던 버그.
        //   해결: takerSide='sell', takerAddress=AMM 으로 호출. fee 0 (AMM).
        $matched = 0.0;
        try {
            $bookMatch = marketAutoMatchAgainstBook(
                $assetId, 'sell', $ammAddr, $price, $amount,
                0.0,  // takerFeePct = 0 (AMM)
                (float)($asset['fee_buyer']  ?? 0),
                (float)($asset['fee_seller'] ?? 0)
            );
            $matched = (float)($bookMatch['filled'] ?? 0);
        } catch (Throwable $matchErr) {
            error_log('[admin/amm/sell] auto-match failed: ' . $matchErr->getMessage());
        }

        $orderId = null;
        $remainingAfterMatch = clamp6($amount - $matched);
        if ($remainingAfterMatch > 0.000001) {
            // 남은 수량만 오더북에 등록
            $orderId = marketInsertOrder([
                'asset_id'      => $assetId,
                'maker_address' => $ammAddr,
                'side'          => 'sell',
                'price'         => $price,
                'amount'        => $remainingAfterMatch,
                'remaining'     => $remainingAfterMatch,
                'escrow_usdt'   => null,
                'escrow_token'  => $remainingAfterMatch,
                'fee_rate'      => 0, // AMM은 수수료 없음
                'expiry_date'   => $expiryDate,
                'status'        => 'open',
                'created_at'    => nowUtcSql(),
            ]);
        }

        // token_type 컬럼이 마이그레이션 적용된 환경에서만 set
        // (v667) 즉시 매칭으로 orderId 가 null 일 수 있음 (전량 체결)
        if ($orderId !== null) {
            try {
                DB::execute("UPDATE orders SET token_type=? WHERE id=?", [$tokenType, $orderId]);
            } catch (Throwable $e) {
                // 컬럼 없는 구 환경 — 무시
            }
        }

        $pdo->commit();

        // (v667) 매칭 정보 포함하여 audit 기록
        ammAuditLog($admin, 'sell_create', [
            'asset_id' => $assetId,
            'amount'   => $amount,
            'price'    => $price,
            'order_id' => (string)($orderId ?? ''),
            'note'     => 'token=' . $tokenType
                          . ($expiryDate ? ' expiry=' . $expiryDate : '')
                          . ($matched > 0 ? sprintf(' matched=%.6f remaining=%.6f', $matched, $remainingAfterMatch) : ''),
        ]);

        jsonOk([
            'order_id'    => $orderId,
            'asset_id'    => $assetId,
            'token_type'  => $tokenType,
            'price'       => $price,
            'amount'      => $amount,
            'matched_qty' => $matched,
            'resting_qty' => $remainingAfterMatch,
            'fully_filled'=> ($remainingAfterMatch <= 0.000001),
            'expiry_date' => $expiryDate,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
});

// AMM 매도 주문 취소
post('/api/admin/settings/amm/cancel-order', function () {
    $admin = adminOnly();
    $body = getJsonBody();
    $orderId = trim((string)($body['order_id'] ?? ''));
    if ($orderId === '') jsonError(400, 'order_id 필요');

    if (!defined('PLATFORM_AMM_ADDRESS')) jsonError(500, 'AMM 주소가 설정되지 않았습니다.');
    $ammAddr = trim((string)PLATFORM_AMM_ADDRESS);

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $order = DB::fetchOne("SELECT * FROM orders WHERE id=? FOR UPDATE", [$orderId]);
        if (!$order) { $pdo->rollBack(); jsonError(404, '주문을 찾을 수 없습니다.'); }
        if (trim((string)($order['maker_address'] ?? '')) !== $ammAddr) {
            $pdo->rollBack();
            jsonError(400, 'AMM 주문이 아닙니다.');
        }
        if (($order['status'] ?? '') !== 'open') {
            $pdo->rollBack();
            jsonError(400, '이미 체결 완료되었거나 취소된 주문입니다.');
        }

        $side      = (string)($order['side'] ?? '');
        $assetId   = (string)($order['asset_id'] ?? '');
        $tokenType = strtolower((string)($order['token_type'] ?? 'legacy'));
        $remaining = (float)($order['remaining'] ?? 0);
        $refundAmount = 0.0;

        // token_type 에 따른 환원 컬럼 결정
        $refundCol = match ($tokenType) {
            'silica_sto' => 'silica_sto_balance',
            'silica'     => 'silica_balance',
            default      => 'balance_token',
        };

        if ($side === 'sell') {
            $escrowToken = (float)($order['escrow_token'] ?? 0);
            $refundAmount = $escrowToken > 0 ? $escrowToken : $remaining;
            if ($refundAmount > 0) {
                ensureHolding($ammAddr, $assetId);
                DB::execute(
                    "UPDATE holdings SET `{$refundCol}` = `{$refundCol}` + ? WHERE address=? AND asset_id=?",
                    [$refundAmount, $ammAddr, $assetId]
                );
            }
        } else {
            // (비현재 시나리오) buy 주문이면 USDT 에스크로를 풀로 환원
            $escrowUsdt = (float)($order['escrow_usdt'] ?? 0);
            if ($escrowUsdt > 0) {
                DB::execute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
                DB::execute("UPDATE platform_balance SET usdt_balance=usdt_balance+? WHERE id=1", [$escrowUsdt]);
                $refundAmount = $escrowUsdt;
            }
        }

        DB::execute("UPDATE orders SET status='cancelled' WHERE id=?", [$orderId]);
        $pdo->commit();

        ammAuditLog($admin, 'sell_cancel', [
            'asset_id' => $assetId,
            'amount'   => $refundAmount,
            'order_id' => (string)$orderId,
        ]);

        jsonOk(['cancelled' => true, 'order_id' => $orderId]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
});

// 성능 개선: 오래된 cancelled/filled 주문 정리 (30일 이상)
// orders 테이블 비대화 방지 — 실제 체결 내역은 trades 테이블에 별도 보존되므로
// 만료된 주문 row 는 삭제해도 거래 이력에는 영향 없음.
post('/api/admin/settings/orders/cleanup', function () {
    $admin = adminOnly();
    $body = getJsonBody();
    $days = max(7, min(365, (int)($body['days'] ?? 30)));
    $dryRun = !empty($body['dry_run']);

    $candidateSql = "SELECT COUNT(*) FROM orders
                      WHERE status IN ('cancelled','filled','expired')
                        AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)";
    $count = (int)DB::fetchValue($candidateSql, [$days]);

    if ($dryRun) {
        jsonOk([
            'dry_run' => true,
            'would_delete' => $count,
            'days'   => $days,
        ]);
        return;
    }

    if ($count === 0) {
        jsonOk(['deleted' => 0, 'days' => $days]);
        return;
    }

    DB::execute(
        "DELETE FROM orders
          WHERE status IN ('cancelled','filled','expired')
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
          LIMIT 10000",
        [$days]
    );

    error_log('[orders_cleanup] admin=' . ($admin['username'] ?? '?') . ' deleted~' . $count . ' days=' . $days);

    jsonOk(['deleted' => $count, 'days' => $days]);
});

// AMM 감사 로그 조회 (최근 50건 또는 ?date / ?offset / ?limit 페이지네이션)
// (2026-05-16 v404) 운영자: '로그가 있는날만 표기, 클릭시 팝업으로 그날
//   거래 로그 모두 표기 (페이지당 최대 10개), 화살표로 다음 10개 보이게.'
//   기존 단순 list → 날짜 그룹 + 페이지네이션 패턴으로 변경. 같은 endpoint
//   에 ?date 와 ?offset 추가 — date 지정 시 그날 로그만, offset 으로
//   페이지네이션. date 미지정 시 기존 동작 유지 (호환성).
get('/api/admin/settings/amm/audit', function () {
    adminOnly();
    ensureAmmAuditTable();
    $limit  = max(1, min(200, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    $date   = trim((string)($_GET['date'] ?? ''));

    $where  = '';
    $params = [];
    if ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $where    = "WHERE DATE(created_at) = ?";
        $params[] = $date;
    }

    $rows  = [];
    $total = 0;
    try {
        $rows = DB::fetchAll(
            "SELECT id, admin_username, action, asset_id, amount, price, order_id,
                    balance_before, balance_after, ip, note, created_at
               FROM amm_admin_audit
               {$where}
           ORDER BY id DESC
              LIMIT {$limit} OFFSET {$offset}",
            $params
        );
        $total = (int)(DB::fetchValue(
            "SELECT COUNT(*) FROM amm_admin_audit {$where}",
            $params
        ) ?? 0);
    } catch (Throwable $e) {
        $rows  = [];
        $total = 0;
    }

    jsonOk([
        'logs' => $rows,
        'pagination' => [
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset,
            'has_more' => ($offset + $limit) < $total,
        ],
    ]);
});

// (v404) 로그가 존재하는 날짜 목록 (최근 60일 범위 내 distinct 일자).
//   감사 로그 카드의 메인 뷰 — 날짜 버튼 그리드.
get('/api/admin/settings/amm/audit/days', function () {
    adminOnly();
    ensureAmmAuditTable();
    $days = [];
    try {
        $days = DB::fetchAll(
            "SELECT DATE(created_at) AS day, COUNT(*) AS log_count
               FROM amm_admin_audit
              WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
           GROUP BY DATE(created_at)
           ORDER BY day DESC"
        );
    } catch (Throwable $e) {
        $days = [];
    }
    jsonOk(['days' => $days]);
});

// (2026-05-11 v259) Helper — run the open-sell sweep after any AMM
//   config change that could enable matching (enable / raise threshold
//   / top-up pool). Operator: 'amm 이 0.7 매도 수량을 거래체결 하지
//   않았는지 확인이 필요하다.' AMM is reactive — it only fires on
//   NEW order placement, so a 0.70 sell posted while AMM was disabled
//   (or threshold was below 0.70 / pool was empty) sits in the book
//   forever even after the operator fixes the config. Auto-running
//   the sweep after each config save catches those stale orders
//   immediately so the operator doesn't have to remember to click
//   '미체결 매도 일괄 처리'.
if (!function_exists('autoSweepAmmAfterConfig')) {
    function autoSweepAmmAfterConfig(string $assetId = 'SILICA-79907'): array {
        try {
            return marketAmmSweepOpenSells($assetId);
        } catch (Throwable $e) {
            error_log('[autoSweepAmmAfterConfig] ' . $e->getMessage());
            return ['errors' => ['auto_sweep_failed: ' . $e->getMessage()]];
        }
    }
}

post('/api/admin/settings/amm/enabled', function () {
    $admin = adminOnly();
    $body = getJsonBody();
    if (!array_key_exists('enabled', $body)) jsonError(400, 'enabled 값이 필요합니다.');
    $enabled = filter_var($body['enabled'], FILTER_VALIDATE_BOOLEAN);
    setSetting('amm_enabled', $enabled ? '1' : '0');
    ammAuditLog($admin, $enabled ? 'enable' : 'disable');
    // Catch stale 0.70-style sells the moment AMM is re-enabled.
    $sweep = $enabled ? autoSweepAmmAfterConfig() : null;
    jsonOk(['amm_enabled' => $enabled, 'auto_sweep' => $sweep]);
});

// ★ 자동매수 임계값 변경 (settings.amm_threshold)
//   매도 호가가 이 값(USDT 절대값) 이하면 시스템이 자동 매수
//   범위: 0.01 ~ 1.00, 기본 0.80
post('/api/admin/settings/amm/threshold', function () {
    $admin = adminOnly();
    $body = getJsonBody();
    if (!array_key_exists('threshold', $body)) jsonError(400, 'threshold 값이 필요합니다.');
    $thr = (float)$body['threshold'];
    if (!is_finite($thr) || $thr < 0.01 || $thr > 1.0) {
        jsonError(400, '임계값은 0.01 ~ 1.00 사이여야 합니다.');
    }
    $prev = (float)(getSetting('amm_threshold', '0.8') ?? '0.8');
    setSetting('amm_threshold', (string)round($thr, 4));
    ammAuditLog($admin, 'threshold_change', ['amm_threshold' => $thr]);
    // Auto-sweep when the threshold WIDENS (raises). Narrowing the
    // threshold doesn't free up new matching opportunities, so skip
    // the sweep cost in that case.
    $sweep = ($thr + 0.0000001 > $prev) ? autoSweepAmmAfterConfig() : null;
    jsonOk(['amm_threshold' => round($thr, 4), 'auto_sweep' => $sweep]);
});

post('/api/admin/settings/amm/topup', function () {
    $admin = adminOnly();
    $body = getJsonBody();

    // 신규 스키마: { action: 'add' | 'subtract', amount: positive }
    // 레거시 스키마: { delta: signed }  ← 호환 유지하되 backend 에서 양수화
    $action = strtolower(trim((string)($body['action'] ?? '')));
    $amountRaw = $body['amount'] ?? null;
    $deltaRaw  = $body['delta']  ?? null;

    if ($action !== '' || $amountRaw !== null) {
        // 신규 스키마 경로 — 엄격하게 양수만 받음
        if (!in_array($action, ['add', 'subtract'], true)) {
            jsonError(400, "action 은 'add' 또는 'subtract' 여야 합니다.");
        }
        if (!is_numeric($amountRaw)) jsonError(400, '조정 금액은 숫자여야 합니다.');
        $amount = (float)$amountRaw;
        if (!is_finite($amount))     jsonError(400, '조정 금액이 올바르지 않습니다.');
        if ($amount <= 0)            jsonError(400, '조정 금액은 0보다 커야 합니다. (음수 입력 차단)');
        if ($amount > 100000000)     jsonError(400, '한 번에 조정 가능한 금액은 1억 USDT 이하입니다.');
        $delta = ($action === 'add') ? $amount : -$amount;
    } else {
        // 레거시 delta 경로 — 기존 동작 유지
        if (!is_numeric($deltaRaw)) jsonError(400, '조정 금액은 숫자여야 합니다.');
        $delta = (float)$deltaRaw;
        if (!is_finite($delta))         jsonError(400, '조정 금액이 올바르지 않습니다.');
        if (abs($delta) > 100000000)    jsonError(400, '한 번에 조정 가능한 금액은 ±1억 USDT 이하입니다.');
        if ($delta == 0)                jsonError(400, '조정 금액은 0이 아니어야 합니다.');
        $action = $delta > 0 ? 'add' : 'subtract';
    }

    $pdo = DB::get();
    $pdo->beginTransaction();
    try {
        DB::execute("INSERT IGNORE INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
        $pb = DB::fetchOne("SELECT usdt_balance FROM platform_balance WHERE id=1 FOR UPDATE");
        $before = (float)($pb['usdt_balance'] ?? 0);
        $after  = $before + $delta;

        if ($after < 0) {
            $pdo->rollBack();
            jsonError(400, '회수 금액이 현재 유동성보다 큽니다. (현재: ' . number_format($before, 6) . ' USDT)');
        }

        DB::execute("UPDATE platform_balance SET usdt_balance=? WHERE id=1", [clamp6($after)]);
        $pdo->commit();

        ammAuditLog($admin, $action === 'add' ? 'topup' : 'withdraw', [
            'amount'         => abs($delta),
            'balance_before' => clamp6($before),
            'balance_after'  => clamp6($after),
        ]);

        // (2026-05-11 v259) Auto-sweep on pool TOP-UP — operator just
        //   funded the AMM so any sells stuck on the book due to a
        //   previously-empty pool can now match. No sweep on withdraw
        //   (pool capacity only shrinks; nothing new matches).
        $sweep = ($action === 'add' && $delta > 0) ? autoSweepAmmAfterConfig() : null;

        jsonOk([
            'before' => clamp6($before),
            'after'  => clamp6($after),
            'delta'  => clamp6($delta),
            'auto_sweep' => $sweep,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
});
/**
 * ─── SILICA SINGLE-ASSET INVARIANT (2026-05-18 v486) ──────────────────────
 *
 * Silica 는 단일 고정 자산 (SILICA-79907) 플랫폼이다. 다음 정책을 영구히
 * 지킨다 — reset / 운영 도구 / 마이그레이션 어떤 경로에서도 위반 금지:
 *
 *   [INVARIANT-1] assets 테이블은 항상 정확히 1개의 row 를 가진다.
 *                 SILICA-79907 row 가 사라지면 사용자 페이지 전체가 깨진다
 *                 (/api/assets [], /api/funding 404, /api/staking 404 등).
 *
 *   [INVARIANT-2] reset 엔드포인트는 'assets' 테이블을 절대 truncate / delete
 *                 하지 않는다. 누적 카운터 (raised_usdt, supply_token,
 *                 funded_snapshot_usdt) 와 status 만 reset 가능.
 *
 *   [INVARIANT-3] admin 의 자산 삭제 API (POST /api/admin/assets/:id/delete)
 *                 는 v273 부터 비활성화 (HTTP 403) — 우회 불가.
 *
 * 본 reset 함수는 위 [INVARIANT-1] / [INVARIANT-2] 를 강제한다:
 *   - $deleteTables 에 'assets' 가 포함되지 않도록 정적 audit
 *   - reset 종료 직전 SELECT COUNT(*) FROM assets > 0 확인
 *   - 0 이면 silicaEnsureSingleAssetExists() 즉시 호출 (자동 복구)
 *
 * 과거 v475 까지 'assets' 가 $deleteTables 에 포함되어 운영자가 reset 실행
 * 시 자산이 통째 사라지는 사고가 있었음 (v476 에서 정정). 본 invariant 블록
 * 은 동일 사고 재발 방지용 명시적 가드.
 */
post('/api/admin/settings/reset-test-data', function () {
    $admin = adminOnly();
    $body = getJsonBody();
    if (empty($body['confirm'])) jsonError(400, '초기화 확인값이 필요합니다.');

    // (2026-05-18 v476) 운영자 정정: 'Silica 는 단일 고정 자산이므로
    //   reset 후 asset 재생성 단계가 없어야 한다'. v475 까지 assets 와
    //   asset_contract_templates/docs/key_info, interest_rate_history 도
    //   삭제했으나 이는 자산 설정 (admin 운영 데이터) → 보존 대상.
    //   삭제 대상은 사용자 활동/거래/잔액 등 '테스트 행위' 만.
    //
    //   자산 row 자체는 유지 + 누적 카운터(raised_usdt, funded_snapshot_usdt,
    //   supply_token) 만 0 으로 reset (아래 UPDATE).
    $deleteTables = [
        'contract_audit_logs',
        'investment_contracts',
        'claim_records',
        'interest_claims',
        'funding_records',
        'holdings',
        'orders',
        'trades',
        'sale_redemptions',
        'sales',
        'refund_records',
        'token_withdraw_requests',
        'withdraw_requests',
        'pending_referral_bonuses',
        'referral_bonus_events',
        'referral_bonuses',
        'referral_links',
        'referrer_codes',
        'referrals',
        'auth_nonces',
        'kyc_sessions',
        'apr_history',
        'fx_quotes',
        'fx_quote_latest',
        'balances',
        'users',
        // (v475) silica_audit_log: wind-down/disable-staking 등 운영 감사 로그.
        //   자산이 아니라 '운영 행위'의 audit 이므로 reset 대상.
        'silica_audit_log',
        // (2026-05-18 v525) 운영자 보고: '공지팝업도 초기화 되지 않는다'.
        //   popup_announcements / popup_dismissals 도 테스트 데이터 — reset 시
        //   삭제 대상에 포함. notices 와 달리 사용자 보이는 즉시 공지라
        //   reset 후 잔존하면 혼란.
        'popup_announcements',
        'popup_dismissals',
        // notices 도 reset 에서 제거 — 운영자 의도가 '깨끗한 시작' 이라면
        //   admin 이 등록한 공지도 초기화. 만약 보존이 필요하면 별도 요청.
        'notices',
    ];

    $autoIncrementTables = [
        'contract_audit_logs',
        'investment_contracts',
        'claim_records',
        'interest_claims',
        'funding_records',
        'orders',
        'trades',
        'sale_redemptions',
        'refund_records',
        'token_withdraw_requests',
        'withdraw_requests',
        'pending_referral_bonuses',
        'referral_bonus_events',
        'referral_bonuses',
        'referral_links',
        'referrer_codes',
        'kyc_sessions',
        'apr_history',
        'fx_quotes',
        // (v475) 운영 감사 로그
        'silica_audit_log',
        // (v525) 공지 / 팝업
        'popup_announcements',
        'popup_dismissals',
        'notices',
    ];

    $summary = [];
    $pdo = DB::get();

    try {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

        foreach ($deleteTables as $table) {
            $summary[$table] = adminResetDeleteAllRows($table);
        }

        $summary['wallet_transactions'] = adminResetTruncateAllRows('wallet_transactions');

        // (2026-05-18 v476) Silica 는 단일 고정 자산 — assets row 자체는 유지
        //   하되 누적 카운터(raised_usdt, funded_snapshot_usdt, supply_token)
        //   를 0 으로 reset.
        // (2026-05-18 v478) 운영자 보고: reset 후 MAX/PARTICIPATE 작동 안 함.
        //   추가 원인 — 이전 sale 테스트로 자산 status 가 '매각' / '매각(완료)'
        //   잔존 시 frontend isInvestable() = false → MAX/PARTICIPATE 둘 다
        //   차단. status 도 ACTIVE('활성') 로 reset (자산 재투자 가능 상태).
        if (adminResetTableExists('assets')) {
            $assetCount = (int)DB::fetchValue("SELECT COUNT(*) FROM assets");

            // (2026-05-18 v481) 운영자 보고: assets 테이블 비어있음.
            //   v475 reset 이 'assets' 삭제 후 v476 부터 보존 정책으로 변경.
            //   그 사이에 reset 실행한 환경은 자산 row 가 영구 손실 — admin
            //   이 수동 재생성 필요했음. Silica 는 단일 고정 자산이므로 reset
            //   시 row 0개 면 SILICA-79907 자동 seed (admin 이 admin/assets
            //   에서 자유롭게 편집 가능).
            if ($assetCount === 0) {
                try {
                    $defaultAssetId = function_exists('silicaGetSingleAssetId')
                        ? silicaGetSingleAssetId() : 'SILICA-79907';
                    $activeStatus = STATUSES['ACTIVE'] ?? '활성';
                    // 최소 필드만 입력 — admin 이 admin/assets 에서 이름/이미지
                    //   /수수료 등 자유 편집. NOT NULL 컬럼 빠지지 않도록 모두
                    //   기본값 명시.
                    DB::execute(
                        "INSERT INTO assets(
                            id, country_code, market, name, type, location, map_query, google_map_url,
                            settlement_basis, payout_currency, fx_at_funding, official_price_krw,
                            status, apr,
                            expected_buy_price_usdt, target_usdt, raised_usdt,
                            supply_token, funded_snapshot_usdt,
                            min_usdt, fee_buyer, fee_seller,
                            image_url, token_image_url, overview, fund_end_date,
                            is_public, token_mint_address
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        [
                            // (v487) fx_at_funding int NOT NULL → 0 (null 금지).
                            //   nullable 컬럼 '' → null.
                            $defaultAssetId, 'KR', 'KR', 'High-Purity Silica Mine #79907', 'mine', null,
                            null, null, 'USDT', 'USDT', 0, null,
                            $activeStatus, 5.0,
                            null, 0, 0,
                            0, null,
                            100, 0.5, 0.5,
                            null, null, null, null,
                            1, null,
                        ]
                    );
                    $summary['assets_seeded_default'] = $defaultAssetId;
                    $assetCount = 1; // 이후 status/counters reset 분기에서 그대로 사용
                } catch (Throwable $seedErr) {
                    error_log('[admin_reset_test_data] asset auto-seed failed: ' . $seedErr->getMessage());
                    $summary['assets_seed_error'] = $seedErr->getMessage();
                }
            }

            $assetSets = [];
            foreach (['raised_usdt', 'funded_snapshot_usdt', 'supply_token'] as $col) {
                try {
                    if ((int)DB::fetchValue(
                        "SELECT COUNT(*) FROM information_schema.columns
                          WHERE table_schema = DATABASE() AND table_name = 'assets' AND column_name = ?",
                        [$col]
                    ) > 0) {
                        $assetSets[] = "`{$col}` = 0";
                    }
                } catch (Throwable $_) {}
            }
            if (!empty($assetSets)) {
                DB::execute("UPDATE assets SET " . implode(', ', $assetSets));
            }
            // status reset — STATUSES['ACTIVE'] = '활성'. 매각/매각(완료)/취소됨
            //   등 비투자 상태에서 활성으로 복귀.
            try {
                $activeStatus = STATUSES['ACTIVE'] ?? '활성';
                DB::execute("UPDATE assets SET status = ?", [$activeStatus]);
            } catch (Throwable $_) {}
            $summary['assets_counters_reset'] = $assetCount;
            $summary['assets_status_reset_to_active'] = $assetCount;
        }

        // (2026-05-18 v475) silica_winddown_state — row 자체는 보존하고
        //   default 값으로 reset. ensureSilicaWinddownTable 이 row 1개를
        //   강제 seed 하므로 DELETE 보다 UPDATE 가 더 안전. state='active'
        //   + 모든 wind-down 진행 필드(NULL/0) 초기화 + closure_notice
        //   setting 도 비움.
        if (adminResetTableExists('silica_winddown_state')) {
            $winddownRows = (int)DB::fetchValue("SELECT COUNT(*) FROM silica_winddown_state");
            DB::execute("
                UPDATE silica_winddown_state SET
                    state               = 'active',
                    announced_at        = NULL,
                    staking_disabled_at = NULL,
                    withdrawal_deadline = NULL,
                    amm_enabled         = 0,
                    amm_buy_price_usdt  = NULL,
                    amm_liquidity_usdt  = 0,
                    amm_liquidity_used  = 0,
                    reason              = NULL,
                    updated_by          = 'admin_reset_test_data',
                    updated_at          = NOW()
            ");
            $summary['silica_winddown_state_reset'] = $winddownRows;
        }
        // closure_notice settings — wind-down 5단계에서 미리 작성된 안내
        //   페이지 텍스트도 초기화 (테스트 데이터 일관성).
        try {
            DB::execute("DELETE FROM settings WHERE k IN (
                'closure_notice_title_ko','closure_notice_title_en',
                'closure_notice_body_html_ko','closure_notice_body_html_en'
            )");
        } catch (Throwable $_) {}

        if (adminResetTableExists('platform_balance')) {
            $platformRows = (int)DB::fetchValue("SELECT COUNT(*) FROM platform_balance");
            if ($platformRows > 0) {
                DB::execute("UPDATE platform_balance SET usdt_balance=0");
            } else {
                DB::execute("INSERT INTO platform_balance(id, usdt_balance) VALUES (1, 0)");
            }
            $summary['platform_balance_reset'] = $platformRows;
        }

        foreach ($autoIncrementTables as $table) {
            adminResetSetAutoIncrement($table);
        }

        $uploadsDeleted = 0;
        $uploadsError = null;
        try {
            $uploadsDeleted = adminResetRemoveUploads(UPLOAD_DIR);
        } catch (Throwable $e) {
            $uploadsError = $e->getMessage();
        }

        error_log('[admin_reset_test_data] by=' . ($admin['username'] ?? 'admin') . ' ip=' . getReqIp());

        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');

        // (v486) [INVARIANT-1] 강제 단일자산 보장 — reset 후 assets row 가
        //   0개면 즉시 silicaEnsureSingleAssetExists() 호출. 이 함수는 v482
        //   에서 routes/assets.php 에 정의되어 있으며 static cache 무관하게
        //   COUNT 후 INSERT 한다. 호출 후 재확인하여 운영자에게 결과 보고.
        $finalAssetCount = (int)(DB::fetchValue("SELECT COUNT(*) FROM assets") ?? 0);
        if ($finalAssetCount === 0) {
            if (function_exists('silicaEnsureSingleAssetExists')) {
                silicaEnsureSingleAssetExists();
            }
            $finalAssetCount = (int)(DB::fetchValue("SELECT COUNT(*) FROM assets") ?? 0);
            $summary['_invariant_enforced'] = 'silicaEnsureSingleAssetExists triggered after reset';
        }
        $summary['_assets_final_count'] = $finalAssetCount;

        jsonOk([
            'message' => '테스트 데이터 초기화 완료',
            'deleted_counts' => $summary,
            'uploads_deleted' => $uploadsDeleted,
            'uploads_error' => $uploadsError,
            // (v476) Silica 단일 고정 자산 정책 — 자산 설정 데이터 모두 유지.
            //   누적 카운터만 0 으로 reset. silica_winddown_state 는 v475 와
            //   동일하게 state='active' 로 reset (row 보존).
            'kept' => [
                'admins',
                'settings',
                'app_settings',
                'contract_templates',
                'assets (counters reset)',
                'asset_contract_templates',
                'asset_docs',
                'asset_key_info',
                'interest_rate_history',
                'silica_winddown_state (reset to active)',
            ],
        ]);
    } catch (Throwable $e) {
        try { $pdo->exec('SET FOREIGN_KEY_CHECKS=1'); } catch (Throwable $inner) {}
        throw $e;
    }
});

// (2026-05-11) AMM sweep — manually process existing OPEN sell orders
//   priced ≤ amm_threshold. Operator: '자동 매수가 되지 않고 있다.'
//   AMM auto-buy only fires on NEW order placement; orders that were
//   placed before AMM was enabled / before the threshold was raised
//   sit untouched in the book. This endpoint scans + processes them.
post('/api/admin/settings/amm/sweep', function () {
    adminOnly();
    $assetId = trim((string)($_GET['asset_id'] ?? 'SILICA-79907'));
    if (!$assetId) jsonError(400, 'asset_id 필요');
    try {
        $report = marketAmmSweepOpenSells($assetId);
        jsonOk($report);
    } catch (Throwable $e) {
        error_log('[admin/amm/sweep] ' . $e->getMessage());
        jsonError(500, 'AMM sweep 실패: ' . $e->getMessage());
    }
});

