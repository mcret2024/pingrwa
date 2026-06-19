<?php
/**
 * Admin Asset routes
 * - Auto-generate asset ID by type prefix
 * - Immutable fields after creation (name, market, id, country, currency, type, location)
 * - APR changes take effect from next interest date
 * - Multi-file upload (images, PDFs, detail images)
 */

// Asset type prefix mapping
const ASSET_TYPE_PREFIX = [
    '아파트'     => 'APT',
    '오피스텔'   => 'OFT',
    '토지'       => 'LND',
    '빌딩'       => 'BLD',
    '상가'       => 'SHP',
    '공장'       => 'FCT',
    '창고'       => 'WRH',
    '숙박시설'   => 'HTL',
    '종교시설'   => 'REL',
    '리조트'     => 'RST',
    '오피스'     => 'OFC',
    '레지던스'   => 'RSD',
    '주택'       => 'HSE',
    '농지'       => 'FRM',
    '기타'       => 'ETC',
];

/**
 * Generate next asset ID for a given type prefix
 */
function generateAssetId(string $prefix): string {
    $prefix = strtoupper($prefix);
    $like = $prefix . '%';
    $last = DB::fetchValue(
        "SELECT id FROM assets WHERE id LIKE ? ORDER BY id DESC LIMIT 1",
        [$like]
    );
    if ($last) {
        $numPart = (int)substr($last, strlen($prefix));
        $next = $numPart + 1;
    } else {
        $next = 1;
    }
    return $prefix . str_pad($next, 3, '0', STR_PAD_LEFT);
}

/**
 * POST /api/admin/assets/generate-id
 * Generate next asset ID for a given type
 */
post('/api/admin/assets/generate-id', function () {
    adminOnly();
    $body = getJsonBody();
    $type = trim($body['type'] ?? '');
    if (!$type) jsonError(400, '자산 종류를 선택하세요.');

    $prefix = ASSET_TYPE_PREFIX[$type] ?? ASSET_TYPE_PREFIX['기타'];
    $id = generateAssetId($prefix);
    jsonOk(['id' => $id, 'prefix' => $prefix, 'market' => "$id/USDT"]);
});

/**
 * POST /api/admin/assets/create
 * Create a NEW asset with auto-generated ID
 */
post('/api/admin/assets/create', function () {
    adminOnly();
    $body = getJsonBody();
    $a = $body['asset'] ?? [];

    $supportedCountries = ['KR','US','KZ','PH','GE','ID','VN'];
    $supportedCurrencies = ['KRW','USD','KZT','PHP','GEL','IDR','VND','USDT'];

    // Required fields
    $type = trim($a['type'] ?? '');
    $name = trim($a['name'] ?? '');
    $countryCode = strtoupper(trim($a['country_code'] ?? 'KR'));
    $settlementBasis = strtoupper(trim($a['settlement_basis'] ?? 'KRW'));
    $location = trim($a['location'] ?? '');

    if (!$type) jsonError(400, '자산 종류를 선택하세요.');
    if (!$name) jsonError(400, '자산명을 입력하세요.');
    if (!in_array($countryCode, $supportedCountries)) jsonError(400, 'country_code가 올바르지 않습니다.');
    if (!in_array($settlementBasis, $supportedCurrencies)) jsonError(400, 'settlement_basis가 올바르지 않습니다.');

    // Auto-generate ID
    $prefix = ASSET_TYPE_PREFIX[$type] ?? ASSET_TYPE_PREFIX['기타'];
    $id = generateAssetId($prefix);
    $market = "$id/USDT";

    $fxAtFunding = 0; // Will be set when property is purchased
    $isPublic = isset($a['is_public']) ? (toBool($a['is_public']) ? 1 : 0) : 0;

    $fields = [
        $id, $countryCode, $market, $name, $type,
        $location ?: null,
        $a['map_query'] ?? null,
        $a['google_map_url'] ?? null,
        $settlementBasis, 'USDT',
        $fxAtFunding,
        isset($a['official_price_krw']) ? (float)$a['official_price_krw'] : null,
        STATUSES['FUNDING'],
        (float)($a['apr'] ?? 8),
        isset($a['expected_buy_price_usdt']) ? (float)$a['expected_buy_price_usdt'] : null,
        (float)($a['target_usdt'] ?? 0),
        0, 0, null, // raised, supply, snapshot
        (float)($a['min_usdt'] ?? 50),
        (float)($a['fee_buyer'] ?? 0.5),
        (float)($a['fee_seller'] ?? 0.5),
        $a['image_url'] ?? null,
        $a['token_image_url'] ?? null,
        $a['overview'] ?? null,
        $a['fund_end_date'] ?? null,
        $isPublic,
        null, // token_mint_address
    ];

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
        $fields
    );

    // If APR was set, record it in apr_history for tracking
    $apr = (float)($a['apr'] ?? 8);
    recordAprChange($id, $apr, 'initial');

    jsonOk(['id' => $id, 'market' => $market]);
});

/**
 * Record APR change history
 */
function recordAprChange(string $assetId, float $newApr, string $reason = 'admin_update'): void {
    try {
        // Ensure apr_history table exists (auto-migrate)
        DB::execute("CREATE TABLE IF NOT EXISTS `apr_history` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `asset_id` VARCHAR(16) NOT NULL,
            `apr` DECIMAL(5,2) NOT NULL,
            `effective_from` DATE NOT NULL,
            `reason` VARCHAR(100) DEFAULT 'admin_update',
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_apr_asset (`asset_id`),
            INDEX idx_apr_effective (`asset_id`, `effective_from`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // 정책: 이자율 변경은 '다음 회차'부터 적용.
        //  - "이번 회차" = 오늘 기준으로 가장 가까운 미래 payday(15일).
        //    · payday 이전(day < 15): 이번달 15일이 "이번 회차"
        //    · payday 당일/이후(day >= 15): 다음달 15일이 "이번 회차"
        //  - "다음 회차" = 이번 회차 바로 다음 payday.
        //  - 어떤 시점에 변경하든 "이번 회차"는 기존 이율 보호 → 버퍼 1회 보장.
        //  - 단 reason === 'initial' (자산 생성 최초 APR) 은 즉시 적용.
        $payday = (int)STAKING_PAYDAY; // 15
        $now = nowKST();

        if ($reason === 'initial') {
            $effectiveDate = $now->format('Y-m-d');
        } else {
            $currentDay = (int)$now->format('j');
            // 이번 회차 → 다음 회차로 +1개월 이동
            if ($currentDay < $payday) {
                // 이번 회차 = 이번달 15일, 다음 회차 = +1개월
                $effective = $now->modify('first day of next month');
            } else {
                // 이번 회차 = 다음달 15일 (이번달 15일은 이미 지남), 다음 회차 = +2개월
                $effective = $now->modify('first day of +2 months');
            }
            $effectiveDate = $effective->format('Y-m') . '-' . str_pad((string)$payday, 2, '0', STR_PAD_LEFT);
        }

        DB::execute(
            "INSERT INTO apr_history(asset_id, apr, effective_from, reason) VALUES (?,?,?,?)",
            [$assetId, $newApr, $effectiveDate, $reason]
        );
    } catch (Throwable $e) {
        error_log('recordAprChange: ' . $e->getMessage());
    }
}

function assetTokenMintLockedForUpdate(array $asset): bool {
    $status = normalizeAssetStatus($asset);
    if (in_array($status, [STATUSES['DISTRIBUTING'], STATUSES['OPERATING'], STATUSES['SOLD']], true)) return true;
    $assetId = (string)($asset['id'] ?? '');
    return $assetId !== '' && assetHasPostFundingActivity($assetId);
}

/**
 * POST /api/admin/assets/upsert (UPDATE only for existing assets)
 * Immutable fields: id, market, name, country_code, settlement_basis, type, location
 */
post('/api/admin/assets/upsert', function () {
    adminOnly();
    $body = getJsonBody();
    $a = $body['asset'] ?? [];
    $id = trim($a['id'] ?? '');
    if (!$id) jsonError(400, 'asset.id가 필요합니다.');

    // Check if asset exists
    $existing = DB::fetchOne("SELECT * FROM assets WHERE id=?", [$id]);

    if (!$existing) {
        // If asset doesn't exist, redirect to create flow
        // For backward compatibility, still allow creation via upsert for new assets
        $supportedCountries = ['KR','US','KZ','PH','GE','ID','VN'];
        $supportedCurrencies = ['KRW','USD','KZT','PHP','GEL','IDR','VND','USDT'];

        $countryCode = strtoupper(trim($a['country_code'] ?? 'KR'));
        $settlementBasis = strtoupper(trim($a['settlement_basis'] ?? 'KRW'));
        if (!in_array($countryCode, $supportedCountries)) jsonError(400, 'country_code가 올바르지 않습니다.');
        if (!in_array($settlementBasis, $supportedCurrencies)) jsonError(400, 'settlement_basis가 올바르지 않습니다.');

        $fxAtFunding = (float)($a['fx_at_funding'] ?? 0);
        $isPublic = isset($a['is_public']) ? (toBool($a['is_public']) ? 1 : 0) : 0;

        $tokenMintAddress = trim((string)($a['token_mint_address'] ?? ''));
        if ($tokenMintAddress !== '' && !isValidSolanaAddress($tokenMintAddress)) jsonError(400, '정상적인 솔라나 주소가 아닙니다.');

        $fields = [
            $id, $countryCode,
            $a['market'] ?? "$id/USDT",
            $a['name'] ?? $id,
            $a['type'] ?? null,
            $a['location'] ?? null,
            $a['map_query'] ?? null,
            $a['google_map_url'] ?? null,
            $settlementBasis, 'USDT',
            $fxAtFunding ?: 0,
            isset($a['official_price_krw']) ? (float)$a['official_price_krw'] : null,
            $a['status'] ?? STATUSES['FUNDING'],
            (float)($a['apr'] ?? 8),
            isset($a['expected_buy_price_usdt']) ? (float)$a['expected_buy_price_usdt'] : null,
            (float)($a['target_usdt'] ?? 0),
            0, 0, null,
            (float)($a['min_usdt'] ?? 50),
            (float)($a['fee_buyer'] ?? 0.5),
            (float)($a['fee_seller'] ?? 0.5),
            $a['image_url'] ?? null,
            $a['token_image_url'] ?? null,
            $a['overview'] ?? null,
            $a['fund_end_date'] ?? null,
            $isPublic,
            $tokenMintAddress !== '' ? $tokenMintAddress : null,
        ];

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
            $fields
        );

        jsonOk(['created' => true]);
        return;
    }

    // === EXISTING ASSET UPDATE ===
    // Immutable fields are NOT updated: id, market, name, country_code, settlement_basis, type, location

    $updates = [];
    $params = [];

    // Mutable fields only
    if (isset($a['map_query'])) { $updates[] = "map_query=?"; $params[] = $a['map_query']; }
    if (isset($a['google_map_url'])) { $updates[] = "google_map_url=?"; $params[] = $a['google_map_url']; }

if (isset($a['status'])) {
    $requestedStatus = trim((string)($a['status'] ?? ''));
    $currentStatus = trim((string)($existing['status'] ?? ''));
    if ($requestedStatus !== '' && $requestedStatus !== $currentStatus) {
        $saleExecuted = false;
        try {
            $saleRow = DB::fetchOne("SELECT executed_at FROM sales WHERE asset_id=? LIMIT 1", [$id]);
            $saleExecuted = !empty($saleRow['executed_at'] ?? null);
        } catch (Throwable $e) {
            $saleExecuted = false;
        }
        $hasSaleRedemptions = false;
        try {
            $hasSaleRedemptions = ((int)DB::fetchValue("SELECT COALESCE(COUNT(*),0) FROM sale_redemptions WHERE asset_id=?", [$id])) > 0;
        } catch (Throwable $e) {
            $hasSaleRedemptions = false;
        }
        $displayStatus = computeAssetDisplayStatus($existing);
        if ($requestedStatus === STATUSES['SOLD'] && !$saleExecuted) {
            jsonError(400, '매각 상태 전환은 매각 관리 페이지에서 관리자 재인증 후 실행해야 합니다.');
        }
        if (($currentStatus === STATUSES['SOLD'] || $displayStatus === '매각(완료)' || $saleExecuted || $hasSaleRedemptions)
            && !in_array($requestedStatus, [STATUSES['SOLD'], '매각(완료)'], true)) {
            jsonError(400, '매각이 실행된 자산 상태는 되돌릴 수 없습니다.');
        }
    }
    $updates[] = "status=?";
    $params[] = $requestedStatus;
}

    // APR change detection - record in history
    if (isset($a['apr'])) {
        $newApr = (float)$a['apr'];
        $oldApr = (float)$existing['apr'];
        if (abs($newApr - $oldApr) > 0.001) {
            recordAprChange($id, $newApr, 'admin_update');
        }
        $updates[] = "apr=?";
        $params[] = $newApr;
    }

    if (isset($a['fund_end_date'])) { $updates[] = "fund_end_date=?"; $params[] = $a['fund_end_date'] ?: null; }

    if (isset($a['expected_buy_price_usdt'])) {
        $updates[] = "expected_buy_price_usdt=?";
        $params[] = $a['expected_buy_price_usdt'] !== null ? (float)$a['expected_buy_price_usdt'] : null;
    }

    if (isset($a['target_usdt'])) { $updates[] = "target_usdt=?"; $params[] = (float)$a['target_usdt']; }
    if (isset($a['min_usdt'])) { $updates[] = "min_usdt=?"; $params[] = (float)$a['min_usdt']; }

    // fx_at_funding: only set if currently 0 (immutable once set)
    if (isset($a['fx_at_funding']) && (float)$a['fx_at_funding'] > 0 && (float)$existing['fx_at_funding'] <= 0) {
        $updates[] = "fx_at_funding=?";
        $params[] = floor((float)$a['fx_at_funding']);
    }

    if (isset($a['official_price_krw'])) {
        $updates[] = "official_price_krw=?";
        $params[] = $a['official_price_krw'] !== null ? (float)$a['official_price_krw'] : null;
    }

    // supply_token: only set if currently 0
    if (isset($a['supply_token']) && (float)$a['supply_token'] > 0 && (float)$existing['supply_token'] <= 0) {
        $updates[] = "supply_token=?";
        $params[] = (float)$a['supply_token'];
    }

    // funded_snapshot_usdt: only set if currently NULL/0
    if (isset($a['funded_snapshot_usdt']) && (float)($a['funded_snapshot_usdt'] ?? 0) > 0
        && ((float)($existing['funded_snapshot_usdt'] ?? 0)) <= 0) {
        $updates[] = "funded_snapshot_usdt=?";
        $params[] = (float)$a['funded_snapshot_usdt'];
    }

    if (isset($a['fee_buyer'])) { $updates[] = "fee_buyer=?"; $params[] = (float)$a['fee_buyer']; }
    if (isset($a['fee_seller'])) { $updates[] = "fee_seller=?"; $params[] = (float)$a['fee_seller']; }

    if (isset($a['image_url'])) { $updates[] = "image_url=?"; $params[] = $a['image_url']; }
    if (isset($a['token_image_url'])) { $updates[] = "token_image_url=?"; $params[] = $a['token_image_url']; }
    if (isset($a['overview'])) { $updates[] = "overview=?"; $params[] = $a['overview']; }

    // (2026-05-18 v491) 운영자 정책 변경: 단일자산 모델에서 자산명 수정 허용.
    //   기존 'name' 은 immutable 였으나 운영자가 '자산명 (한국어)' 폼에서
    //   바꾼 값이 등록 자산 표에 반영되도록 — admin/assets.js 가 name
    //   필드에 한국어 자산명을 채워 보냄. 빈 문자열은 무시.
    if (isset($a['name'])) {
        $newName = trim((string)$a['name']);
        if ($newName !== '') {
            $updates[] = "name=?";
            $params[] = $newName;
        }
    }

    if (isset($a['is_public'])) { $updates[] = "is_public=?"; $params[] = toBool($a['is_public']) ? 1 : 0; }

    if (array_key_exists('token_mint_address', $a)) {
        $mintAddress = trim((string)($a['token_mint_address'] ?? ''));
        $existingMintAddress = trim((string)($existing['token_mint_address'] ?? ''));
        if ($mintAddress !== '' && !isValidSolanaAddress($mintAddress)) {
            jsonError(400, '정상적인 솔라나 주소가 아닙니다.');
        }
        if (assetTokenMintLockedForUpdate($existing) && $mintAddress !== $existingMintAddress) {
            jsonError(400, '토큰 분배가 시작된 이후에는 토큰 민트 주소를 수정할 수 없습니다.');
        }
        if (!assetTokenMintLockedForUpdate($existing) && $mintAddress !== $existingMintAddress) {
            $updates[] = "token_mint_address=?";
            $params[] = $mintAddress !== '' ? $mintAddress : null;
        }
    }

    if (empty($updates)) {
        jsonOk(['message' => '변경사항 없음']);
        return;
    }

    $params[] = $id;
    DB::execute("UPDATE assets SET " . implode(', ', $updates) . " WHERE id=?", $params);

    // (v491) 'name' 은 이제 mutable — immutable_note 갱신.
    jsonOk(['updated' => true, 'immutable_note' => '마켓, 국가, 정산통화, 종류, 주소는 변경되지 않습니다.']);
});

/**
 * GET /api/admin/assets/:id/apr-history
 * View APR change history
 */
get('/api/admin/assets/:id/apr-history', function ($p) {
    adminOnly();
    try {
        $rows = DB::fetchAll(
            "SELECT * FROM apr_history WHERE asset_id=? ORDER BY effective_from DESC, id DESC",
            [$p['id']]
        );
        jsonOk(['history' => $rows]);
    } catch (Throwable $e) {
        jsonOk(['history' => [], 'note' => 'apr_history 테이블 없음']);
    }
});

/**
 * POST /api/admin/assets/:id/delete
 * (2026-05-11 v273) DISABLED — operator: '자산 삭제 버튼 제거해라.
 * 버튼뿐만 아니라, 완전히 삭제 될 수 없도록 해야한다.' Silica is a
 * single-asset platform (SILICA-79907) and deletion of the asset row
 * would orphan every trade / holding / contract / interest claim that
 * references it. The endpoint now unconditionally rejects with 403
 * regardless of caller — even if the admin token is valid and even if
 * the asset has zero balances.
 *
 * The previous cascade-delete implementation (kept in git history for
 * reference) walked apr_history / asset_docs / asset_key_info /
 * holdings / funding_records / interest_claims / investment_contracts
 * / orders / sales / sale_redemptions / trades / token_withdraw_requests
 * and removed the row from `assets`. Re-enabling that path would be a
 * dangerous foot-gun in production — leave commented-out and gate
 * carefully if it's ever needed for a fresh test database.
 */
post('/api/admin/assets/:id/delete', function ($p) {
    adminOnly();
    jsonError(403, '자산 삭제는 비활성화되어 있습니다. (운영 정책)');
});

/**
 * POST /api/admin/assets/:id/images
 * Upload asset image, token image, detail images, PDF docs
 */
post('/api/admin/assets/:id/images', function ($p) {
    adminOnly();
    $assetId = $p['id'];

    if (empty($_FILES)) jsonError(400, '파일이 필요합니다.');

    $updates = [];
    $detailImages = [];
    $rejected = []; // (2026-05-26 v834) silent continue 대신 reject 사유 누적 → 응답으로 노출
    // (2026-05-26 v838) AVIF / HEIC 등 모던 이미지 포맷 추가.
    //   운영자 보고: avif 파일 업로드 시 silent 거부. 브라우저/카메라가 점점
    //   AVIF (Apple/Android 신형) 와 HEIC (iPhone 기본) 를 기본 출력으로 쓰는
    //   추세라 허용 목록 확장.
    $allowedImageMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml',
                          'image/avif', 'image/heic', 'image/heif', 'image/gif'];
    $allowedImageExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif', '.heic', '.heif', '.gif'];
    // (2026-05-26 v834) SVG 파일은 환경마다 finfo MIME 결과가 들쭉날쭉
    //   (image/svg+xml / image/svg / application/svg+xml / text/xml /
    //    text/plain / application/xml). 확장자 기반 보완 허용 — SVG 는
    //   XML 텍스트라 MIME 다양성 자체가 안전 위협이 아님.
    $svgFallbackMimes = ['image/svg', 'application/svg+xml', 'text/xml', 'application/xml', 'text/plain'];

    if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);

    // 업로드 검증 헬퍼 — 확장자, MIME, 실제 파일 콘텐츠(finfo) 3중 검증
    $validateImageFile = function (string $tmpPath, string $origName, string $mimeClaimed) use ($allowedImageMimes, $allowedImageExts, $svgFallbackMimes): array {
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $ext = $ext ? '.' . $ext : '';
        if (!in_array($ext, $allowedImageExts, true)) {
            return [false, 'extension_not_allowed:' . $ext];
        }

        $mimeClaimed = strtolower(trim($mimeClaimed));
        $isSvgExt = ($ext === '.svg');
        if ($mimeClaimed !== '' && !in_array($mimeClaimed, $allowedImageMimes, true)) {
            if (!($isSvgExt && in_array($mimeClaimed, $svgFallbackMimes, true))) {
                return [false, 'client_mime_not_allowed:' . $mimeClaimed];
            }
        }

        // finfo 기반 실제 콘텐츠 검증 (클라이언트 MIME 위조 방지)
        if (function_exists('finfo_open')) {
            $finfo = @finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo) {
                $real = strtolower((string)@finfo_file($finfo, $tmpPath));
                finfo_close($finfo);
                if ($real !== '' && !in_array($real, $allowedImageMimes, true)) {
                    if (!($isSvgExt && in_array($real, $svgFallbackMimes, true))) {
                        return [false, 'real_mime_not_allowed:' . $real];
                    }
                }
            }
        }
        return [true, ''];
    };

    foreach ($_FILES as $field => $file) {
        // Handle array uploads (detail_images[])
        if (is_array($file['name'])) {
            for ($i = 0; $i < count($file['name']); $i++) {
                if ($file['error'][$i] !== UPLOAD_ERR_OK) {
                    $rejected[] = "{$field}[{$i}]: upload_err=" . $file['error'][$i];
                    continue;
                }
                if ($file['size'][$i] > 10 * 1024 * 1024) {
                    $rejected[] = "{$field}[{$i}]: size>10MB";
                    continue;
                }
                [$ok, $why] = $validateImageFile($file['tmp_name'][$i], $file['name'][$i], $file['type'][$i] ?? '');
                if (!$ok) {
                    $rejected[] = "{$field}[{$i}]:{$file['name'][$i]}:{$why}";
                    continue;
                }

                $ext = strtolower(pathinfo($file['name'][$i], PATHINFO_EXTENSION));
                $ext = $ext ? '.' . $ext : '.jpg';

                $safeAssetId = preg_replace('/[^a-zA-Z0-9_-]/', '', $assetId);
                $filename = "{$safeAssetId}_detail_{$i}_" . time() . '_' . mt_rand(1000, 9999) . $ext;
                $dest = UPLOAD_DIR . '/' . $filename;
                if (!@move_uploaded_file($file['tmp_name'][$i], $dest)) {
                    $rejected[] = "{$field}[{$i}]: move_uploaded_file failed (dest={$dest})";
                    continue;
                }
                $detailImages[] = '/uploads/' . $filename;
            }
            continue;
        }

        if ($file['error'] !== UPLOAD_ERR_OK) {
            $rejected[] = "{$field}: upload_err=" . $file['error'];
            continue;
        }
        if ($file['size'] > 10 * 1024 * 1024) {
            $rejected[] = "{$field}: size>10MB";
            continue;
        }
        [$ok, $why] = $validateImageFile($file['tmp_name'], $file['name'], $file['type'] ?? '');
        if (!$ok) {
            $rejected[] = "{$field}:{$file['name']}:{$why}";
            continue;
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $ext = $ext ? '.' . $ext : '.jpg';

        $safeField = preg_replace('/[^a-zA-Z0-9_-]/', '_', $field);
        $safeAssetId = preg_replace('/[^a-zA-Z0-9_-]/', '', $assetId);
        $base = pathinfo($file['name'], PATHINFO_FILENAME);
        $safeBase = preg_replace('/[^a-zA-Z0-9._-]/', '_', $base);

        $filename = "{$safeAssetId}_{$safeField}_" . time() . "_{$safeBase}{$ext}";
        $dest = UPLOAD_DIR . '/' . $filename;
        if (!@move_uploaded_file($file['tmp_name'], $dest)) {
            $rejected[] = "{$field}: move_uploaded_file failed (dest={$dest})";
            continue;
        }

        $path = '/uploads/' . $filename;

        // Main images
        if ($field === 'image' || $field === 'image_url') {
            DB::execute("UPDATE assets SET image_url=? WHERE id=?", [$path, $assetId]);
            $updates['image_url'] = $path;
        } elseif ($field === 'token' || $field === 'token_image_url') {
            DB::execute("UPDATE assets SET token_image_url=? WHERE id=?", [$path, $assetId]);
            $updates['token_image_url'] = $path;
        } elseif ($field === 'pdf') {
            // PDF document upload
            $updates['pdf_url'] = $path;
        }
    }
    if (!empty($rejected)) $updates['rejected'] = $rejected;

    // Save detail images to asset_key_info as JSON
    if (!empty($detailImages)) {
        // Store detail images as key-value
        foreach ($detailImages as $idx => $imgUrl) {
            DB::execute(
                "INSERT INTO asset_key_info(asset_id, k, v) VALUES (?, ?, ?)",
                [$assetId, 'detail_image_' . ($idx + 1), $imgUrl]
            );
        }
        $updates['detail_images'] = $detailImages;
    }

    jsonOk($updates);
});

// ----------------------------------------------------------------
// (2026-05-11 v271) POST /api/admin/assets/:id/image/delete
//   Clears the asset's main image_url (or token_image_url) and
//   best-effort unlinks the file from UPLOAD_DIR.
//   Body: { which: 'main' | 'token' }  (default 'main')
//   Operator: 'admin/assets.html 등록 된 자산 이미지 삭제 할 수
//   있도록 구현 해줘'.
// ----------------------------------------------------------------
post('/api/admin/assets/:id/image/delete', function ($p) {
    adminOnly();
    $assetId = trim((string)$p['id']);
    if ($assetId === '') jsonError(400, 'asset_id가 필요합니다.');

    $body = getJsonBody();
    $which = strtolower(trim((string)($body['which'] ?? 'main')));
    if (!in_array($which, ['main', 'token'], true)) {
        jsonError(400, "which 는 'main' 또는 'token' 만 허용됩니다.");
    }
    $col = $which === 'token' ? 'token_image_url' : 'image_url';

    // Fetch current URL so we can unlink the file after clearing the DB.
    $row = DB::fetchOne("SELECT {$col} AS url FROM assets WHERE id=?", [$assetId]);
    if (!$row) jsonError(404, '자산을 찾을 수 없습니다.');
    $url = trim((string)($row['url'] ?? ''));

    // Clear the column regardless of whether a URL was set — idempotent.
    DB::execute("UPDATE assets SET {$col}=NULL WHERE id=?", [$assetId]);

    // Best-effort file removal — only /uploads/* paths (system images
    // from /user/assets/images/ are bundled defaults and shouldn't be
    // touched).
    if ($url !== '' && strpos($url, '/uploads/') === 0) {
        $fs = UPLOAD_DIR . '/' . basename($url);
        if (is_file($fs)) @unlink($fs);
    }

    jsonOk(['ok' => true, 'which' => $which, 'deleted_url' => $url]);
});

// ----------------------------------------------------------------
// (2026-05-11 v271) POST /api/admin/assets/:id/detail-image/delete
//   Removes a single asset_key_info row whose key matches detail_image*
//   and whose value equals the supplied URL. Also best-effort unlinks
//   the underlying file.
//   Body: { url }
// ----------------------------------------------------------------
post('/api/admin/assets/:id/detail-image/delete', function ($p) {
    adminOnly();
    $assetId = trim((string)$p['id']);
    if ($assetId === '') jsonError(400, 'asset_id가 필요합니다.');

    $body = getJsonBody();
    $url = trim((string)($body['url'] ?? ''));
    if ($url === '') jsonError(400, 'url이 필요합니다.');

    // Match all detail_image_* rows with this exact URL value (operator
    // uploaded multiple, deleting one specific entry).
    DB::execute(
        "DELETE FROM asset_key_info
          WHERE asset_id=? AND k LIKE 'detail_image_%' AND v=?",
        [$assetId, $url]
    );

    if (strpos($url, '/uploads/') === 0) {
        $fs = UPLOAD_DIR . '/' . basename($url);
        if (is_file($fs)) @unlink($fs);
    }

    jsonOk(['ok' => true, 'deleted_url' => $url]);
});

// ----------------------------------------------------------------
// (2026-05-11 v268) POST /api/admin/assets/:id/key-info
//   Upsert a single asset_key_info row for an allow-listed key.
//   Used by admin/assets.html to save per-language overrides
//   (overview_en, overview_ko, name_en, name_ko) without bloating
//   the upsert endpoint with locale-specific fields.
//   Body: { key, value }
//   - key MUST be in the whitelist below — prevents arbitrary
//     k/v insertion that could collide with other features.
//   - empty value deletes the existing row (revert to KO primary).
// ----------------------------------------------------------------
const ASSET_KEY_INFO_WHITELIST = [
    'overview_en',
    'overview_ko',
    'name_en',
    'name_ko',
];

post('/api/admin/assets/:id/key-info', function ($p) {
    adminOnly();
    $assetId = trim((string)$p['id']);
    if ($assetId === '') jsonError(400, 'asset_id가 필요합니다.');

    $body = getJsonBody();
    $key = trim((string)($body['key'] ?? ''));
    $value = (string)($body['value'] ?? '');

    if (!in_array($key, ASSET_KEY_INFO_WHITELIST, true)) {
        jsonError(400, "허용되지 않은 key: '{$key}'. 허용 목록: " . implode(', ', ASSET_KEY_INFO_WHITELIST));
    }

    // Length cap so a runaway paste can't blow up the row.
    if (mb_strlen($value, 'UTF-8') > 8000) {
        jsonError(400, '값은 8000자 이하여야 합니다.');
    }

    // Upsert pattern — delete existing then insert (works regardless of
    // whether asset_key_info has a unique index on (asset_id, k)).
    DB::execute("DELETE FROM asset_key_info WHERE asset_id=? AND k=?", [$assetId, $key]);
    $trimmed = trim($value);
    if ($trimmed !== '') {
        DB::execute(
            "INSERT INTO asset_key_info(asset_id, k, v) VALUES (?, ?, ?)",
            [$assetId, $key, $value]
        );
    }

    jsonOk(['ok' => true, 'asset_id' => $assetId, 'key' => $key, 'cleared' => $trimmed === '']);
});

// === Keep existing doc routes ===

/**
 * Document category definitions
 * Categories: registry(등기부등본), valuation(자산평가서), accounting(회계자료),
 *             official1(공식문서1), official2(공식문서2), proof(증빙), sale(매각), general(일반)
 */
const DOC_CATEGORIES = [
    'registry'   => '등기부등본',
    'valuation'  => '자산평가서',
    'accounting' => '회계자료',
    'official1'  => '공식문서1',
    'official2'  => '공식문서2',
    'proof'      => '증빙문서',
    'general'    => '일반문서',
];

const SALE_DOC_CATEGORIES = [
    'sale'       => '매각문서',
    'sale_proof' => '매각증빙자료',
];

if (!function_exists('isSaleDocType')) {
    function isSaleDocType($type) {
        return in_array((string)$type, array_keys(SALE_DOC_CATEGORIES), true);
    }
}

/**
 * GET /api/admin/assets/doc-categories
 * Return list of available document categories
 */
get('/api/admin/assets/doc-categories', function () {
    adminOnly();
    $cats = [];
    foreach (DOC_CATEGORIES as $code => $label) {
        $cats[] = ['code' => $code, 'label' => $label];
    }
    jsonOk(['categories' => $cats]);
});

/**
 * GET /api/admin/assets/:id/docs
 * List all docs for an asset (admin)
 */
get('/api/admin/assets/:id/docs', function ($p) {
    adminOnly();
    $assetId = $p['id'];
    $docs = DB::fetchAll(
        "SELECT id, doc_type, title, doc_date, amount, amount_currency, file_path, created_at
         FROM asset_docs WHERE asset_id=? AND doc_type NOT IN ('sale','sale_proof')
         ORDER BY doc_type ASC, doc_date DESC, id DESC",
        [$assetId]
    );
    // Add category labels
    foreach ($docs as &$doc) {
        $doc['category_label'] = DOC_CATEGORIES[$doc['doc_type']] ?? $doc['doc_type'];
    }
    unset($doc);
    jsonOk(['docs' => $docs, 'categories' => DOC_CATEGORIES, 'sale_categories' => SALE_DOC_CATEGORIES]);
});

post('/api/admin/assets/:id/docs', function ($p) {
    adminOnly();
    $assetId = $p['id'];
    $type = trim($_POST['type'] ?? '');
    $title = trim($_POST['title'] ?? '문서');
    $docDate = !empty($_POST['date']) ? $_POST['date'] : null;
    $amount = isset($_POST['amount']) ? (float)$_POST['amount'] : null;

    $validTypes = array_keys(DOC_CATEGORIES);
    if (isSaleDocType($type)) jsonError(400, '매각 관련 문서는 매각 관리 페이지에서만 업로드할 수 있습니다.');
    if (!in_array($type, $validTypes, true)) jsonError(400, 'type이 올바르지 않습니다. 허용: ' . implode(', ', $validTypes));
    if (empty($_FILES['file'])) jsonError(400, 'PDF 파일이 필요합니다.');

    // (audit H1 fix · 2026-06-12) admin_sales.php v408 과 동일한 다층 업로드 검증 적용.
    //   기존: 확장자/MIME 미검증 + move_uploaded_file() 실패해도 DB INSERT 진행
    //   (깨진 file_path 행 생성). 이 라우트만 다른 업로드 경로 (자산 이미지,
    //   sales 문서 v408, 토큰 로고) 대비 검증이 빠져 있었음.
    $file = $_FILES['file'];

    // 1) 업로드 오류 코드 명시 검증
    $err = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($err !== UPLOAD_ERR_OK) jsonError(400, '파일 업로드 실패 (error code: ' . $err . ')');

    $size = (int)($file['size'] ?? 0);
    if ($size > 15 * 1024 * 1024) jsonError(400, '파일 크기는 15MB 이하');
    if ($size < 100) jsonError(400, '파일이 비어있거나 너무 작습니다.');

    $tmpPath = (string)($file['tmp_name'] ?? '');
    if (!is_uploaded_file($tmpPath)) jsonError(400, '유효하지 않은 업로드 요청입니다.');

    // 2) 확장자 화이트리스트 — 문서 (PDF) + 스캔 이미지 허용 (sales 와 동일)
    $originalName = (string)($file['name'] ?? '');
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    if (!in_array($ext, $allowedExts, true)) {
        jsonError(400, '허용되지 않은 파일 확장자입니다. (PDF / PNG / JPG / WEBP 만 가능)');
    }

    // 3) Double-extension 차단 (예: shell.php.pdf 의 'php' 부분)
    $basePart = pathinfo($originalName, PATHINFO_FILENAME);
    if (preg_match('/\.(php|phtml|phps|pht|php3|php4|php5|php7|html|htm|svg|cgi|pl|py|sh|exe|js|jsp|asp|aspx)$/i', $basePart)) {
        jsonError(400, '파일명에 위험한 확장자가 포함되어 있습니다.');
    }

    // 4) finfo 로 실제 파일 내용 MIME 검증 — 클라이언트 Content-Type 무시
    if (!function_exists('finfo_open')) jsonError(500, '서버 환경에 finfo 가 활성화되지 않아 파일 검증 불가.');
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $actualMime = $finfo ? finfo_file($finfo, $tmpPath) : false;
    if ($finfo) finfo_close($finfo);
    if (!$actualMime) jsonError(400, '파일 MIME 검증 실패.');
    $allowedMimes = [
        'pdf'  => ['application/pdf'],
        'png'  => ['image/png'],
        'jpg'  => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'webp' => ['image/webp'],
    ];
    if (!in_array($actualMime, $allowedMimes[$ext], true)) {
        jsonError(400, '파일 내용이 확장자와 일치하지 않습니다. (감지된 형식: ' . $actualMime . ')');
    }

    // 5) 이미지 확장자는 getimagesize 추가 검증
    if ($ext !== 'pdf' && @getimagesize($tmpPath) === false) {
        jsonError(400, '이미지 파일 검증 실패.');
    }

    if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);

    // 6) 파일명 완전 랜덤화 — 원본 파일명/timestamp prefix (예측 가능) 폐기
    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    $dest = UPLOAD_DIR . '/' . $filename;

    // 7) move 성공 확인 — 실패 시 DB INSERT 전에 중단 (기존: 미확인)
    if (!move_uploaded_file($tmpPath, $dest)) {
        jsonError(500, '파일 저장에 실패했습니다. 디스크 공간/권한을 확인하세요.');
    }

    $filePath = '/uploads/' . $filename;

    $amountCurrency = 'USDT';
    if (!empty($_POST['amount_currency'])) {
        $amountCurrency = strtoupper(trim($_POST['amount_currency']));
    }

    DB::execute(
        "INSERT INTO asset_docs(asset_id, doc_type, title, doc_date, amount, amount_currency, file_path) VALUES (?,?,?,?,?,?,?)",
        [$assetId, $type, $title, $docDate, $amount, $amountCurrency, $filePath]
    );

    jsonOk(['file_path' => $filePath]);
});

delete_route('/api/admin/assets/:assetId/docs/:docId', function ($p) {
    adminOnly();
    $row = DB::fetchOne("SELECT * FROM asset_docs WHERE id=? AND asset_id=?", [$p['docId'], $p['assetId']]);
    if (!$row) jsonError(404, '문서 없음');

    if (isSaleDocType($row['doc_type'] ?? '')) jsonError(400, '매각 관련 문서는 매각 관리 페이지에서만 삭제할 수 있습니다.');

    if ($row['file_path']) {
        $abs = UPLOAD_DIR . '/' . basename($row['file_path']);
        if (file_exists($abs)) @unlink($abs);
    }

    DB::execute("DELETE FROM asset_docs WHERE id=?", [$p['docId']]);
    jsonOk();
});

post('/api/admin/assets/:id/mark-buying', function ($p) {
    adminOnly();
    $assetId = $p['id'];
    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $asset = DB::fetchOne("SELECT * FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$asset) { $pdo->rollBack(); jsonError(404, '자산 없음'); }
        $status = normalizeAssetStatus($asset);
        if ($status !== STATUSES['FUNDING']) { $pdo->rollBack(); jsonError(400, '모집중 자산만 매입 진행으로 전환할 수 있습니다.'); }
        $raised = (float)($asset['raised_usdt'] ?? 0);
        if ($raised <= 0) { $pdo->rollBack(); jsonError(400, '확정 모금액이 없습니다.'); }
        DB::execute("UPDATE assets SET status=? WHERE id=?", [STATUSES['BUYING'], $assetId]);
        $pdo->commit();
        jsonOk(['status' => STATUSES['BUYING'], 'message' => '매입 진행 상태로 변경되었습니다.']);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, $e->getMessage());
    }
});

post('/api/admin/assets/:id/cancel-funding', function ($p) {
    $admin = adminAuth();
    $body = getJsonBody();
    $assetId = $p['id'];
    $action = trim($body['action'] ?? $body['mode'] ?? 'cancel');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $asset = DB::fetchOne("SELECT * FROM assets WHERE id=? FOR UPDATE", [$assetId]);
        if (!$asset) { $pdo->rollBack(); jsonError(404, '자산 없음'); }

        $status = normalizeAssetStatus($asset);

        if ($action === 'cancel') {
            if (!in_array($status, [STATUSES['FUNDING'], STATUSES['BUYING'], STATUSES['FAILED'], STATUSES['CANCELED']], true)) {
                $pdo->rollBack(); jsonError(400, '현재 상태에서는 취소/환불을 진행할 수 없습니다.');
            }

            if ($status === STATUSES['BUYING'] && assetHasPostFundingActivity($assetId)) {
                $pdo->rollBack();
                jsonError(400, '이미 토큰 분배/거래/정산 활동이 있어 매입 취소를 진행할 수 없습니다.');
            }

            $records = DB::fetchAll("SELECT address, SUM(amount_usdt) AS total FROM funding_records WHERE asset_id=? GROUP BY address", [$assetId]);
            $totalRefunded = 0.0;
            foreach ($records as $r) {
                $refunded = (float)DB::fetchValue(
                    "SELECT COALESCE(SUM(amount_usdt),0) FROM refund_records WHERE address=? AND asset_id=?",
                    [$r['address'], $assetId]
                );
                $net = (float)$r['total'] - $refunded;
                if ($net > 0) {
                    DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$net, $r['address']]);
                    DB::execute("INSERT INTO refund_records(address, asset_id, amount_usdt) VALUES (?,?,?)", [$r['address'], $assetId, $net]);
                    $totalRefunded += $net;
                }
            }

            $pendingContracts = DB::fetchAll(
                "SELECT c.*, fr.id AS existing_funding_id
                   FROM investment_contracts c
              LEFT JOIN funding_records fr ON fr.contract_id = c.id
                  WHERE c.asset_id=? AND c.status='awaiting_admin'
               ORDER BY c.id ASC",
                [$assetId]
            );

            foreach ($pendingContracts as $contract) {
                $hasConfirmedFunding = ((int)($contract['existing_funding_id'] ?? 0) > 0) || ((int)($contract['funding_record_id'] ?? 0) > 0);
                $amountUsdt = (float)($contract['amount_usdt'] ?? 0);

                if (!$hasConfirmedFunding && $amountUsdt > 0) {
                    ensureUser($contract['address']);
                    DB::execute("UPDATE balances SET usdt=usdt+? WHERE address=?", [$amountUsdt, $contract['address']]);
                    $totalRefunded += $amountUsdt;
                }

                DB::execute(
                    "UPDATE investment_contracts SET status='rejected', rejected_reason=?, updated_at=? WHERE id=?",
                    ['asset_canceled', nowUtcSql(), $contract['id']]
                );

                writeContractAudit($pdo, [
                    'contractId' => (int)$contract['id'],
                    'actorType'  => 'admin',
                    'actorId'    => $admin['username'] ?? 'admin',
                    'actionType' => 'asset_cancelled',
                    'ip'         => getReqIp(),
                    'userAgent'  => getReqUserAgent(),
                    'payload'    => [
                        'asset_id' => $assetId,
                        'refund_usdt' => !$hasConfirmedFunding ? $amountUsdt : 0,
                        'status_before' => 'awaiting_admin',
                    ],
                ]);
            }

            $nextStatus = $status === STATUSES['BUYING'] ? STATUSES['CANCELED'] : STATUSES['FAILED'];
            DB::execute(
                "UPDATE assets
                    SET status=?, raised_usdt=0, funded_snapshot_usdt=0, supply_token=0
                  WHERE id=?",
                [$nextStatus, $assetId]
            );

            $pdo->commit();
            jsonOk([
                'action' => $action,
                'status' => $nextStatus,
                'refunded_total_usdt' => round($totalRefunded, 6),
                'message' => $nextStatus === STATUSES['CANCELED'] ? '매입 취소 및 전액 환불이 완료되었습니다.' : '모금 취소 및 전액 환불이 완료되었습니다.',
            ]);
            return;
        }

        if ($action === 'start_distribution') {
            if (!in_array($status, [STATUSES['BUYING'], STATUSES['DISTRIBUTING']], true)) {
                $pdo->rollBack();
                jsonError(400, '구매진행 상태의 자산만 분배 시작이 가능합니다.');
            }
            if ($status !== STATUSES['BUYING'] && assetHasPostFundingActivity($assetId)) {
                $pdo->rollBack();
                jsonError(400, '이미 분배/거래 활동이 시작된 자산입니다.');
            }

            $tokenMintAddress = trim((string)($asset['token_mint_address'] ?? ''));
            if ($tokenMintAddress === '') {
                $pdo->rollBack();
                jsonError(400, '토큰 컨트랙트가 추가되어 있지 않습니다. 토큰 민트 주소를 먼저 입력하세요.');
            }
            if (!isValidSolanaAddress($tokenMintAddress)) {
                $pdo->rollBack();
                jsonError(400, '정상적인 솔라나 주소가 아닙니다.');
            }

            $snapshot = computeAssetDistributionSnapshot($asset);
            DB::execute(
                "UPDATE assets SET status=?, funded_snapshot_usdt=?, fx_at_funding=?, supply_token=? WHERE id=?",
                [STATUSES['DISTRIBUTING'], $snapshot['funded_snapshot_usdt'], $snapshot['fx_at_funding'], $snapshot['supply_token'], $assetId]
            );

            $pdo->commit();
            jsonOk([
                'action' => $action,
                'status' => STATUSES['DISTRIBUTING'],
                'funded_snapshot_usdt' => $snapshot['funded_snapshot_usdt'],
                'fx_at_funding' => $snapshot['fx_at_funding'],
                'supply_token' => $snapshot['supply_token'],
                'settlement_basis' => $snapshot['settlement_basis'],
                'token_mint_address' => $tokenMintAddress,
                'message' => '토큰 민트 주소가 확인되어 1 USDT = 1 Token 기준으로 분배를 시작했습니다.',
            ]);
            return;
        }

        $pdo->rollBack();
        jsonError(400, '지원하지 않는 action 입니다.');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonError(500, $e->getMessage());
    }
});

/**
 * GET /api/admin/assets/types
 * Return list of available asset types
 */
get('/api/admin/assets/types', function () {
    adminOnly();
    $types = [];
    foreach (ASSET_TYPE_PREFIX as $label => $prefix) {
        $types[] = ['label' => $label, 'prefix' => $prefix];
    }
    jsonOk(['types' => $types]);
});
