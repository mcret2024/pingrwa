<?php
/**
 * Asset routes (user-facing)
 */

// (2026-05-18 v482/v484) Silica 단일 고정 자산 lazy auto-seed.
//   /api/assets 호출 시 assets 테이블이 비어있으면 SILICA-79907 자동 INSERT.
//   v484: 응답에 seed 결과를 포함시켜 운영자가 Network 탭으로 즉시 진단.
if (!function_exists('silicaEnsureSingleAssetExists')) {
    function silicaEnsureSingleAssetExists(): array {
        static $result = null;
        if ($result !== null) return $result;
        $result = ['attempted' => false, 'seeded' => false, 'count_before' => null, 'count_after' => null, 'error' => null];
        try {
            $count = (int)(DB::fetchValue("SELECT COUNT(*) FROM assets") ?? 0);
            $result['count_before'] = $count;
            if ($count > 0) {
                $result['count_after'] = $count;
                return $result;
            }
            $result['attempted'] = true;
            $assetId = function_exists('silicaGetSingleAssetId')
                ? silicaGetSingleAssetId() : 'SILICA-79907';
            $activeStatus = STATUSES['ACTIVE'] ?? '활성';
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
                    // (v487) fx_at_funding 는 int NOT NULL — null 금지. nullable
                    //   컬럼은 '' 대신 null 로 명확화.
                    $assetId, 'KR', 'KR', 'High-Purity Silica Mine #79907', 'mine', null,
                    null, null, 'USDT', 'USDT', 0, null,
                    $activeStatus, 5.0,
                    null, 0, 0,
                    0, null,
                    100, 0.5, 0.5,
                    null, null, null, null,
                    1, null,
                ]
            );
            $result['seeded'] = true;
            $result['count_after'] = (int)(DB::fetchValue("SELECT COUNT(*) FROM assets") ?? 0);
            error_log('[silicaEnsureSingleAssetExists] auto-seeded ' . $assetId . ' count_after=' . $result['count_after']);
        } catch (Throwable $e) {
            $result['error'] = $e->getMessage();
            error_log('[silicaEnsureSingleAssetExists] seed failed: ' . $e->getMessage());
        }
        return $result;
    }
}

get('/api/assets', function () {
    $seedResult = silicaEnsureSingleAssetExists(); // (v482/v484) 자산 비었으면 자동 복구
    syncAllAssetStatusesIfNeeded();
    $isAdmin = isAdminRequest();

    $publicFilter = $isAdmin ? '' : 'WHERE (is_public = 1)';
    $rows = DB::fetchAll(
        "SELECT id, country_code, market, name, type, location, map_query, google_map_url,
                settlement_basis, payout_currency, fx_at_funding, official_price_krw,
                status, apr,
                expected_buy_price_usdt, target_usdt, raised_usdt,
                supply_token, funded_snapshot_usdt,
                min_usdt, fee_buyer, fee_seller,
                image_url, token_image_url, overview, fund_end_date,
                is_public, token_mint_address
         FROM assets {$publicFilter}
         ORDER BY FIELD(status,'모집중','구매진행','분배중','운영중','매각','모집실패','취소됨'), id"
    );

    // 모든 자산의 pending APR change를 한 번에 조회 (N+1 쿼리 방지)
    $pendingAprMap = [];
    try {
        $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul')))->format('Y-m-d');
        $pendingRows = DB::fetchAll(
            "SELECT h1.asset_id, h1.apr, h1.effective_from
             FROM apr_history h1
             INNER JOIN (
                SELECT asset_id, MIN(effective_from) AS min_eff
                FROM apr_history
                WHERE effective_from > ?
                GROUP BY asset_id
             ) h2 ON h2.asset_id = h1.asset_id AND h2.min_eff = h1.effective_from",
            [$today]
        );
        foreach ($pendingRows as $pr) {
            $pendingAprMap[(string)$pr['asset_id']] = [
                'apr' => (float)$pr['apr'],
                'effective_from' => $pr['effective_from'],
            ];
        }
    } catch (Throwable $e) {
        // apr_history 없음 등 — pending 없음으로 처리
    }

    // (2026-05-18 v493) name_ko / name_en lookup — admin/assets.html 등록자산
    //   표가 i18n 자산명을 즉시 표시할 수 있도록. assets.name 이 sync 안 된
    //   상황에서도 운영자 입력값이 표에 반영되도록 안전망 제공.
    $i18nNames = [];
    try {
        $i18nRows = DB::fetchAll(
            "SELECT asset_id, k, v FROM asset_key_info WHERE k IN ('name_ko', 'name_en')"
        );
        foreach ($i18nRows as $r) {
            $aid = (string)$r['asset_id'];
            if (!isset($i18nNames[$aid])) $i18nNames[$aid] = [];
            $i18nNames[$aid][(string)$r['k']] = (string)$r['v'];
        }
    } catch (Throwable $_) {}

    $assets = array_map(function ($row) use ($pendingAprMap, $i18nNames) {
        $row = withNormalizedAssetStatus($row);
        $target = (float)($row['target_usdt'] ?? 0);
        $raised = (float)($row['raised_usdt'] ?? 0);
        $row['pending_reserved_usdt'] = computeAssetPendingReservedUSDT((string)$row['id']);
        $row['remaining_reservable_usdt'] = computeAssetReservableRemainingUSDT((string)$row['id'], $target, $raised);
        $row['onchain_withdrawn_token'] = computeAssetOnchainWithdrawnToken((string)$row['id']);
        $row['display_status'] = computeAssetDisplayStatus($row);
        $row['pending_apr_change'] = $pendingAprMap[(string)$row['id']] ?? null;
        // (v493) i18n 자산명 추가 — frontend 가 lang 분기 또는 fallback 가능
        $aid = (string)$row['id'];
        $row['name_ko'] = $i18nNames[$aid]['name_ko'] ?? null;
        $row['name_en'] = $i18nNames[$aid]['name_en'] ?? null;
        return $row;
    }, $rows);
    // (v484) 진단 정보 노출 — 운영자가 Network 탭에서 seed 동작 여부 확인.
    jsonOk([
        'assets' => $assets,
        '_seed_debug' => $seedResult,
        '_total_rows_returned' => count($assets),
        '_is_admin_request' => $isAdmin,
        '_public_filter_applied' => !$isAdmin,
    ]);
});

// (2026-05-18 v485/v487) 운영자 강제 시드 endpoint — Hostinger OPcache 등으로
//   /api/assets 의 lazy auto-seed 가 안 도는 경우 우회.
// v487: 5xx 에러 발생 시 운영자가 원인 즉시 알 수 있도록 진단 강화:
//   - 단계별 try/catch + 어느 단계에서 실패했는지 명시
//   - INSERT 실패 시 SQL state / driver code 포함
//   - 응답에 schema 정보 (assets 컬럼 리스트) 도 디버그용으로 노출
post('/api/admin/silica/force-seed-asset', function () {
    $stage = 'init';
    try {
        $stage = 'adminOnly';
        adminOnly();

        $stage = 'count_before';
        $beforeCount = (int)(DB::fetchValue("SELECT COUNT(*) FROM assets") ?? 0);

        if ($beforeCount > 0) {
            $stage = 'list_existing';
            $rows = DB::fetchAll("SELECT id, status, is_public FROM assets");
            jsonOk([
                'ok' => true,
                'message' => '이미 자산이 등록되어 있습니다 (' . $beforeCount . '건). 강제 시드 미실행.',
                'count' => $beforeCount,
                'rows' => $rows,
                'seeded' => false,
            ]);
            return;
        }

        $stage = 'resolve_constants';
        $assetId = function_exists('silicaGetSingleAssetId')
            ? silicaGetSingleAssetId() : 'SILICA-79907';
        $activeStatus = defined('STATUSES') ? (STATUSES['ACTIVE'] ?? '활성') : '활성';

        $stage = 'insert';
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
                $assetId, 'KR', 'KR', 'High-Purity Silica Mine #79907', 'mine', null,
                null, null, 'USDT', 'USDT', 0, null,
                $activeStatus, 5.0,
                null, 0, 0,
                0, null,
                100, 0.5, 0.5,
                null, null, null, null,
                1, null,
            ]
        );

        $stage = 'count_after';
        $afterCount = (int)(DB::fetchValue("SELECT COUNT(*) FROM assets") ?? 0);
        $rows = DB::fetchAll("SELECT id, status, is_public FROM assets");
        jsonOk([
            'ok' => true,
            'message' => '자산 시드 완료: ' . $assetId,
            'count' => $afterCount,
            'rows' => $rows,
            'seeded' => true,
        ]);
    } catch (Throwable $e) {
        // 진단 정보 풀-덤프 — Network 탭 응답에서 원인 즉시 파악.
        $diag = [
            'stage'   => $stage,
            'error'   => $e->getMessage(),
            'class'   => get_class($e),
            'file'    => basename($e->getFile()) . ':' . $e->getLine(),
        ];
        // PDO 에러 정보 추가
        if ($e instanceof PDOException) {
            $diag['sql_state'] = $e->getCode();
            $diag['driver_code'] = ($e->errorInfo[1] ?? null);
            $diag['driver_msg']  = ($e->errorInfo[2] ?? null);
        }
        // assets 테이블 schema 도 첨부 (운영자가 column 누락 확인 가능)
        try {
            $cols = DB::fetchAll("SHOW COLUMNS FROM `assets`");
            $diag['assets_columns'] = array_map(function ($c) {
                return [
                    'field' => $c['Field'] ?? null,
                    'type'  => $c['Type']  ?? null,
                    'null'  => $c['Null']  ?? null,
                    'default' => $c['Default'] ?? null,
                ];
            }, $cols);
        } catch (Throwable $_) {}

        error_log('[force-seed-asset] FAIL stage=' . $stage . ' err=' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'    => false,
            'error' => '강제 시드 실패 (' . $stage . '): ' . $e->getMessage(),
            'diag'  => $diag,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
});

// Document category labels (shared with admin)
const DOC_CATEGORY_LABELS = [
    'registry'   => '등기부등본',
    'valuation'  => '자산평가서',
    'accounting' => '회계자료',
    'official1'  => '공식문서1',
    'official2'  => '공식문서2',
    'proof'      => '증빙문서',
    'sale'       => '매각문서',
    'general'    => '일반문서',
];

get('/api/assets/:id', function ($p) {
    $a = getAsset($p['id']);
    if (!$a) jsonError(404, '자산 없음');

    $target = (float)($a['target_usdt'] ?? 0);
    $raised = (float)($a['raised_usdt'] ?? 0);
    $a['pending_reserved_usdt'] = computeAssetPendingReservedUSDT((string)$a['id']);
    $a['remaining_reservable_usdt'] = computeAssetReservableRemainingUSDT((string)$a['id'], $target, $raised);
    $a['onchain_withdrawn_token'] = computeAssetOnchainWithdrawnToken((string)$a['id']);
    $a['display_status'] = computeAssetDisplayStatus($a);

    // SilicaSTO 분배 모델 v1: 누적 분배(Claim) 수량
    // 매각 분배 계산식의 분모로 사용 (사전 발행 1B 가 아님).
    try {
        $distributed = DB::fetchValue(
            "SELECT COALESCE(SUM(claimed_token), 0) FROM holdings WHERE asset_id=? AND claimed_token > 0",
            [$a['id']]
        );
        $a['distributed_token'] = (float)$distributed;
    } catch (Throwable $e) {
        $a['distributed_token'] = 0.0;
    }

    // APR 변경 예정 (apr_history에서 effective_from > 오늘 인 가장 가까운 row)
    try {
        $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul')))->format('Y-m-d');
        $pending = DB::fetchOne(
            "SELECT apr, effective_from FROM apr_history
             WHERE asset_id=? AND effective_from > ?
             ORDER BY effective_from ASC, id ASC
             LIMIT 1",
            [$a['id'], $today]
        );
        if ($pending) {
            $a['pending_apr_change'] = [
                'apr' => (float)$pending['apr'],
                'effective_from' => $pending['effective_from'],
            ];
        } else {
            $a['pending_apr_change'] = null;
        }
    } catch (Throwable $e) {
        // apr_history 없음 등
        $a['pending_apr_change'] = null;
    }

    $docs = DB::fetchAll(
        "SELECT id, doc_type, title, doc_date, amount, amount_currency, file_path FROM asset_docs WHERE asset_id=? ORDER BY doc_type ASC, doc_date DESC, id DESC",
        [$a['id']]
    );

    // Add category labels to each doc
    foreach ($docs as &$doc) {
        $doc['category_label'] = DOC_CATEGORY_LABELS[$doc['doc_type']] ?? $doc['doc_type'];
    }
    unset($doc);

    $kvs = DB::fetchAll(
        "SELECT k, v FROM asset_key_info WHERE asset_id=? ORDER BY id ASC",
        [$a['id']]
    );

    jsonOk([
        'asset' => $a,
        'docs' => $docs,
        'keyInfo' => $kvs,
        'doc_categories' => DOC_CATEGORY_LABELS,
    ]);
});
