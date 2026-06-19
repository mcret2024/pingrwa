<?php
/**
 * Contract routes (user-facing)
 */

if (!function_exists('normalizeWholeFundingAmount')) {
    function normalizeWholeFundingAmount($raw, string $label = '투자 금액'): int {
        if ($raw === null || $raw === '') jsonError(400, $label . '을 입력하세요.');
        $amount = (float)$raw;
        if (!is_finite($amount) || $amount <= 0) jsonError(400, $label . '이 올바르지 않습니다.');
        if (abs($amount - round($amount)) > 0.000001) jsonError(400, $label . '은 정수만 입력할 수 있습니다.');
        return (int)round($amount);
    }
}

get('/api/contracts/my-all', function () {
    $user = authMfaRequired();
    $rows = DB::fetchAll(
        "SELECT c.*, a.name AS asset_name
         FROM investment_contracts c
         LEFT JOIN assets a ON a.id = c.asset_id
         WHERE c.address=?
         ORDER BY c.id DESC",
        [$user['address']]
    );
    // (2026-05-17 v450) 다국어 자산명 후처리 — funding 모달이 contract 데이터에서
    //   asset_name_en/ko 를 읽어 lang 별 표시.
    if (function_exists('enrichRowsWithI18nAssetNames')) {
        enrichRowsWithI18nAssetNames($rows);
    }
    jsonOk(['contracts' => $rows, 'rows' => $rows]);
});

get('/api/contracts/my', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $status = $_GET['status'] ?? null;
    // Accept both asset_id and assetId query params (JS client sends assetId)
    $assetId = $_GET['asset_id'] ?? $_GET['assetId'] ?? null;

    $where = ['c.address=?'];
    $params = [$address];

    if ($status) { $where[] = 'c.status=?'; $params[] = $status; }
    if ($assetId) { $where[] = 'c.asset_id=?'; $params[] = $assetId; }

    $whereStr = implode(' AND ', $where);

    // (2026-05-17 v435) v433/v434 의 다국어 자산명 JOIN 시도가 500 에러 유발 →
    //   revert. 우선 기본 SELECT 로 My Pending Investments 카드를 즉시 복원하고,
    //   다국어 자산명은 두 번째 단계로 PHP 안에서 안전하게 후처리 (별도 SELECT
    //   FROM asset_key_info — 에러 시 silent skip).
    $rows = DB::fetchAll(
        "SELECT c.*, a.name AS asset_name, a.status AS asset_status,
                a.settlement_basis, a.country_code
         FROM investment_contracts c
         LEFT JOIN assets a ON a.id = c.asset_id
         WHERE {$whereStr}
         ORDER BY c.id DESC",
        $params
    );

    // (2026-05-17 v435) 다국어 자산명 후처리 — asset_key_info 테이블에서 별도
    //   조회. SQL error 시 silent skip → 기본 동작 보장 (rows 자체는 유지).
    try {
        $assetIds = [];
        foreach ($rows as $row) {
            $aid = (string)($row['asset_id'] ?? '');
            if ($aid !== '') $assetIds[$aid] = true;
        }
        $assetIds = array_keys($assetIds);
        if (!empty($assetIds)
            && function_exists('dbTableExists')
            && dbTableExists('asset_key_info')) {
            $placeholders = implode(',', array_fill(0, count($assetIds), '?'));
            $kvRows = DB::fetchAll(
                "SELECT asset_id, k, v FROM asset_key_info
                  WHERE asset_id IN ({$placeholders})
                    AND k IN ('name_en','name_ko')",
                $assetIds
            );
            $nameByAsset = [];
            foreach ($kvRows as $kv) {
                $aid = (string)($kv['asset_id'] ?? '');
                $key = (string)($kv['k'] ?? '');
                $val = (string)($kv['v'] ?? '');
                if ($aid === '' || $key === '') continue;
                if (!isset($nameByAsset[$aid])) $nameByAsset[$aid] = [];
                $nameByAsset[$aid][$key] = $val;
            }
            foreach ($rows as &$row) {
                $aid = (string)($row['asset_id'] ?? '');
                $row['asset_name_en'] = $nameByAsset[$aid]['name_en'] ?? null;
                $row['asset_name_ko'] = $nameByAsset[$aid]['name_ko'] ?? null;
            }
            unset($row);
        }
    } catch (Throwable $e) {
        error_log('[contracts/my i18n names] silent skip: ' . $e->getMessage());
    }

    // For the funding page, expose the latest reusable contract only.
    // Historical awaiting_admin / completed contracts must not block additional participation.
    $latestContract = !empty($rows) ? $rows[0] : null;
    $contract = $latestContract;
    if ($assetId && !$status) {
        // (2026-05-07) Smart filter — 만약 사용자가 가장 최근에 받은 계약이 'rejected'
        //   이면, 그보다 오래된 draft / user_signed 계약은 더 이상 유효하지 않다고
        //   간주한다 (사장님 정책: 계약 반려 = 취소 → 기존 계약서 파기).
        //   기존 로직은 단순히 rows DESC 를 돌며 첫 draft/user_signed 를 반환했기 때문에,
        //   '오래된 draft + 최근 rejected' 조합에서 오래된 draft 가 여전히 잠금 메시지를
        //   유발하는 문제가 있었다.
        //   참고: admin_contracts.php void 엔드포인트에 cascade 도 함께 들어 있어
        //   reject 직후엔 draft/user_signed 가 모두 rejected 로 정리되지만, 과거에
        //   reject 없이 누적된 draft 도 이 가드로 함께 무시된다.
        $contract = null;
        $cutoffRejectedAt = null;
        foreach ($rows as $row) {
            $rowStatus = (string)($row['status'] ?? '');
            if ($rowStatus === 'rejected') {
                // 가장 최근 rejected 의 갱신시각을 cutoff 로 채택 (여러 reject 가 있으면 가장 최신).
                $rowUpdated = (string)($row['updated_at'] ?? $row['created_at'] ?? '');
                if ($cutoffRejectedAt === null || strcmp($rowUpdated, $cutoffRejectedAt) > 0) {
                    $cutoffRejectedAt = $rowUpdated;
                }
            }
        }
        foreach ($rows as $row) {
            $rowStatus = (string)($row['status'] ?? '');
            if (!in_array($rowStatus, ['draft', 'user_signed'], true)) continue;
            // cutoff 보다 오래된 draft 는 reject 이후로 사용자가 의도적으로 다시 만든
            // 신선한 draft 가 아니므로 무시 (admin 이 explicit cascade 하지 못한 경우 대비).
            if ($cutoffRejectedAt !== null) {
                $rowUpdated = (string)($row['updated_at'] ?? $row['created_at'] ?? '');
                if (strcmp($rowUpdated, $cutoffRejectedAt) <= 0) continue;
            }
            $contract = $row;
            break;
        }
    }

    $participated = false;
    $fundingCount = 0;
    $participationCount = 0;
    if ($assetId) {
        $fundingCount = (int)DB::fetchValue(
            "SELECT COUNT(*) FROM funding_records WHERE address=? AND asset_id=?",
            [$address, $assetId]
        );
        $participationCount = countUserFundingRequests($address, $assetId);
        $participated = $participationCount > 0;
    }

    jsonOk([
        'contracts'           => $rows,
        'rows'                => $rows,
        'contract'            => $contract,
        'latest_contract'     => $latestContract,
        'participated'        => $participated,
        'funding_count'       => $fundingCount,
        'participation_count' => $participationCount,
    ]);
});

get('/api/contracts/:id', function ($p) {
    $user = authMfaRequired();
    $row = DB::fetchOne(
        "SELECT c.*, a.name AS asset_name
         FROM investment_contracts c
         LEFT JOIN assets a ON a.id = c.asset_id
         WHERE c.id=? AND c.address=?",
        [$p['id'], $user['address']]
    );
    if (!$row) jsonError(404, '계약을 찾을 수 없습니다.');
    // (2026-05-17 v449) 다국어 자산명 후처리 — asset_key_info.name_en/name_ko
    //   를 asset_name_en / asset_name_ko 로 row 에 주입. frontend 가 lang
    //   분기로 표시 (모달 헤더 / Asset 카드 라벨).
    if (function_exists('enrichSingleRowWithI18nAssetNames')) {
        enrichSingleRowWithI18nAssetNames($row);
    }
    jsonOk(['contract' => $row]);
});

post('/api/contracts/draft', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    $body = getJsonBody();

    // (2026-05-08) Resolve the request locale upfront so every user-facing
    //   error in this handler can be localized. Frontend core.js sends
    //   X-RWA-Lang on every /api/* request; falls through to the body /
    //   query parameter for legacy callers.
    $rawLang = strtolower(trim((string)(
        ($body['lang'] ?? null)
        ?? ($_SERVER['HTTP_X_RWA_LANG'] ?? null)
        ?? ($_GET['lang'] ?? '')
    )));
    $msgLang = in_array($rawLang, ['ko', 'en', 'ja', 'zh'], true) ? $rawLang : 'en';
    $pickMsg = function (array $msgs) use ($msgLang) {
        return $msgs[$msgLang] ?? $msgs['en'] ?? $msgs['ko'] ?? reset($msgs);
    };

    $assetId = trim($body['asset_id'] ?? $body['assetId'] ?? '');
    $amountUsdt = normalizeWholeFundingAmount($body['amount_usdt'] ?? $body['amount'] ?? null, '투자 금액');

    if (!$assetId) jsonError(400, $pickMsg([
        'ko' => 'asset_id가 필요합니다.',
        'en' => 'asset_id is required.',
        'ja' => 'asset_id が必要です。',
        'zh' => '需要 asset_id。',
    ]));

    ensureUser($address);
    try { assertUserKycEligibleOrThrow($address); }
    catch (Throwable $e) { jsonError(403, $e->getMessage()); }

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, $pickMsg([
        'ko' => '자산 없음',
        'en' => 'Asset not found',
        'ja' => '資産が見つかりません',
        'zh' => '未找到资产',
    ]));

    if ($asset['status'] !== STATUSES['FUNDING']) {
        jsonError(400, $pickMsg([
            'ko' => '모집중인 자산에만 계약할 수 있습니다.',
            'en' => 'Contracts can only be drafted for assets currently in funding.',
            'ja' => '募集中の資産のみ契約できます。',
            'zh' => '仅可对募集中的资产签约。',
        ]));
    }

    $minUsdt = (float)($asset['min_usdt'] ?? 0);
    if ($amountUsdt < $minUsdt) {
        jsonError(400, $pickMsg([
            'ko' => "최소 투자금액은 {$minUsdt} USDT입니다.",
            'en' => "The minimum investment amount is {$minUsdt} USDT.",
            'ja' => "最低投資金額は {$minUsdt} USDT です。",
            'zh' => "最低投资金额为 {$minUsdt} USDT。",
        ]));
    }

    // (2026-05-07) Global SilicaSTO sale-supply cap enforcement.
    //   Reject the new contract if the configured max would be exceeded.
    //   silicaGetSoldStoTotal() includes both 'completed' and 'awaiting_admin'
    //   contracts so concurrent users can't both slip past the cap.
    if ($assetId === silicaGetSingleAssetId() && function_exists('silicaIsSaleOpen')) {
        $max = silicaGetMaxStoSupply();
        if ($max > 0) {
            $sold = silicaGetSoldStoTotal();
            $remaining = max(0.0, $max - $sold);
            if ($remaining <= 0) {
                jsonError(409, $pickMsg([
                    'ko' => '최대 판매량에 도달하여 일시적으로 판매가 중단되었습니다.',
                    'en' => 'The sale supply cap has been reached and new investments are temporarily suspended.',
                    'ja' => '最大販売量に達したため、新規投資は一時的に停止されています。',
                    'zh' => '已达到销售上限，新投资暂时暂停。',
                ]));
            }
            if ($amountUsdt > $remaining) {
                $remInt = (int)floor($remaining);
                jsonError(400, $pickMsg([
                    'ko' => "남은 판매 가능 수량을 초과합니다. 최대 {$remInt} USDT 까지만 신청할 수 있습니다.",
                    'en' => "The amount exceeds the remaining sale supply. You can apply for up to {$remInt} USDT only.",
                    'ja' => "残りの販売可能数量を超えています。最大 {$remInt} USDT まで申請可能です。",
                    'zh' => "超出剩余可销售数量。最多可申请 {$remInt} USDT。",
                ]));
            }
        }
    }

    // Build contract snapshot — Silica 정책: 한국어(ko) / 영어(en) 2종 템플릿만 운영
    // 위에서 이미 $rawLang 을 추출했지만, 계약서 템플릿은 KO/EN 만 존재하므로
    // ja/zh 사용자는 EN 템플릿으로 fallback 시킨다.
    $userLang = in_array($rawLang, ['ko', 'en'], true) ? $rawLang : ($rawLang === 'ja' || $rawLang === 'zh' ? 'en' : 'ko');

    // (2026-05-17 v448) 운영자 보고: 영문 사용자 contract 본문에 admin이 입력
    //   하지 않은 자산명이 박힘. 원인: 옛 funding_subscription_en 별도 row 가
    //   여전히 is_active=1 상태 + id 가 더 커서 (LIMIT 1 ORDER BY id DESC) 선택
    //   됨. 그 row 의 body_html 에는 옛 영문 본문 (admin 이 새로 funding_subscription
    //   row 의 body_html_en 에 입력한 본문이 아닌) 이 들어있음.
    //   → SELECT 우선순위 변경: funding_subscription 코드를 우선 선택.
    //   admin 이 v442+ 의 '활성화' 버튼을 한 번 클릭하면 그 시점에 다른 row 들이
    //   자동 비활성 되지만, 그 전까지는 이 ORDER BY 가 안전한 폴백.
    $template = DB::fetchOne(
        "SELECT * FROM contract_templates WHERE is_active=1
         ORDER BY (template_code='funding_subscription') DESC, id DESC LIMIT 1"
    );
    // Safety net: 활성 row 가 없으면 funding_subscription 기본 row 폴백.
    if (!$template) {
        $template = DB::fetchOne(
            "SELECT * FROM contract_templates WHERE template_code='funding_subscription'
             ORDER BY version_no DESC, id DESC LIMIT 1"
        );
    }
    if (!$template) jsonError(400, '활성화된 전자계약서 템플릿이 없습니다.');

    $ccy = strtoupper($asset['settlement_basis'] ?? 'KRW');
    // 유저 계약서에는 USDT 금액만 표기 — 환율과 현지통화 환산은 모금 완료 시점에 확정.
    // amount_local / fx_per_usdt은 0으로 기록 (legacy 컬럼 호환성 유지).
    $amountLocal = 0.0;
    $fxNum = 0.0;
    $countryCode = strtoupper($asset['country_code'] ?? 'KR');

    // (2026-05-17 v446) 운영자 보고: '유저측 계약서에서 자산명이 한국어로 나온다
    //   (영문 페이지)'. asset_key_info.name_en 우선, 없으면 assets.name 폴백.
    //   contract draft 생성 시 박히는 'asset_name' 변수 (template {{asset_name}}
    //   치환) 가 사용자 lang 에 맞는 값으로 설정되도록.
    $assetNameForContract = (string)($asset['name'] ?? '');
    if ($userLang === 'en') {
        try {
            if (function_exists('dbTableExists') && dbTableExists('asset_key_info')) {
                $enName = DB::fetchValue(
                    "SELECT v FROM asset_key_info WHERE asset_id=? AND k='name_en' LIMIT 1",
                    [$asset['id']]
                );
                if (!empty($enName)) $assetNameForContract = (string)$enName;
            }
        } catch (Throwable $e) {
            error_log('[v446] asset_name_en lookup skipped: ' . $e->getMessage());
        }
    } else {
        // KO 사용자도 admin이 입력한 name_ko 가 있으면 우선 (없으면 assets.name).
        try {
            if (function_exists('dbTableExists') && dbTableExists('asset_key_info')) {
                $koName = DB::fetchValue(
                    "SELECT v FROM asset_key_info WHERE asset_id=? AND k='name_ko' LIMIT 1",
                    [$asset['id']]
                );
                if (!empty($koName)) $assetNameForContract = (string)$koName;
            }
        } catch (Throwable $e) {
            error_log('[v446] asset_name_ko lookup skipped: ' . $e->getMessage());
        }
    }

    // (2026-05-17 v447) country_name 도 사용자 lang 분기 — config.php 의
    //   COUNTRY_NAME_MAP_EN (v447) 사용.
    $countryName = ($userLang === 'en' && defined('COUNTRY_NAME_MAP_EN'))
        ? (COUNTRY_NAME_MAP_EN[$countryCode] ?? COUNTRY_NAME_MAP[$countryCode] ?? $countryCode)
        : (COUNTRY_NAME_MAP[$countryCode] ?? $countryCode);

    // (2026-05-17 v448) 운영자 보고: '이자수익은 스테이킹에 설정 된 이자율을
    //   따르지만, 언제든지 변경 될 수 있음으로 고정 된 값으로 표기 되어서는 안
    //   된다'. 기존 'apr' 변수는 자산 생성 시점의 정적 APR 값을 박았음. v448:
    //   contract 본문 자체에는 변동 가능한 정책 안내 문구로 박힘. 정확한 APR
    //   은 사용자 페이지 (staking 카드 등) 에서 실시간으로 표시.
    $aprNote = ($userLang === 'en')
        ? 'per current staking policy (subject to change)'
        : '현재 스테이킹 정책에 따름 (변동 가능)';

    $vars = [
        'signed_date_kst' => nowKST()->format('Y-m-d H:i:s'),
        'wallet_address'  => $address,
        'asset_id'        => $asset['id'],
        'asset_name'      => $assetNameForContract,
        'market'          => $asset['market'] ?? '',
        'country_code'    => $countryCode,
        'country_name'    => $countryName,
        'settlement_basis'=> $ccy,
        // (2026-05-17 v448) {{apr}} 와 {{apr_note}} 모두 동일 안내 문구로 박힘.
        //   admin 본문에서 '{{apr}}%' 사용한 경우 'per current staking policy
        //   (subject to change)%' 처럼 % 가 어색하게 붙음 → admin 이 본문에서
        //   라인을 'Stated APR: {{apr_note}}' 또는 라인 자체 제거로 정리 권장.
        'apr'             => $aprNote,
        'apr_note'        => $aprNote,

        'fund_end_date'   => $asset['fund_end_date'] ?? '-',
        'amount_usdt'     => numToDec6Str($amountUsdt),
        // (2026-05-17 v447) 영문 사용자 contract 에 한국어 placeholder 박히지
        //   않도록 lang 분기. 'amount_local' / 'fx_per_usdt' 는 모금 완료 시점
        //   확정되는 값이라 사용자에게 안내 문구로 표시됨.
        'amount_local'    => ($userLang === 'en') ? 'To be locked at funding completion' : '모금 완료 시 확정',
        'fx_per_usdt'     => ($userLang === 'en') ? 'To be locked at funding completion' : '모금 완료 시 확정',
        'min_usdt'        => numToDec6Str((float)($asset['min_usdt'] ?? 0)),
        'target_usdt'     => numToDec6Str((float)($asset['target_usdt'] ?? 0)),
    ];

    // (2026-05-17 v443) 운영자: '하나의 계약서에 국문, 영문 입력하여 하나로
    //   연결'. contract_templates row 안에 template_title_en / body_html_en /
    //   body_text_en 컬럼 추가. 사용자 lang === 'en' (또는 ja/zh 폴백) 인 경우
    //   _en 본문 우선, 없으면 한국어 본문 사용 (graceful fallback).
    $useEn = ($userLang === 'en');
    $rawTitle = $useEn && !empty($template['template_title_en'])
        ? $template['template_title_en']
        : ($template['template_title'] ?? '');
    $rawBodyHtml = $useEn && !empty($template['body_html_en'])
        ? $template['body_html_en']
        : ($template['body_html'] ?? '');
    $rawBodyText = $useEn && !empty($template['body_text_en'])
        ? $template['body_text_en']
        : ($template['body_text'] ?? '');

    $title = renderContractTemplate($rawTitle, $vars);
    $bodyHtml = renderContractTemplate($rawBodyHtml, $vars);
    $bodyText = !empty($rawBodyText) ? renderContractTemplate($rawBodyText, $vars) : null;

    $contractNo = makeContractNo();

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        // (2026-05-07) Auto-discard the user's existing drafts/user_signed
        //   contracts for this same address+asset before creating the new one.
        //   Earlier behavior left the old draft alive when the user clicked
        //   PARTICIPATE again, which made funding.js display the
        //   "계약이 작성 되었음 — Rewrite 버튼을 눌러 Reset 하세요" lock toast
        //   forever (the Rewrite button is hidden in current Silica markup,
        //   so the user could not escape). With this cascade, every fresh
        //   PARTICIPATE click effectively rewrites the contract — no manual
        //   action required. Submitted contracts (awaiting_admin / completed)
        //   are NOT touched; only the in-flight draft / user_signed slots.
        $pdo->prepare(
            "UPDATE investment_contracts
                SET status='rejected',
                    rejected_reason=CONCAT('user_recreated:', SUBSTRING(?, 1, 80)),
                    updated_at=?
              WHERE address=? AND asset_id=?
                AND status IN ('draft', 'user_signed')"
        )->execute([$contractNo, nowUtcSql(), $address, $assetId]);

        $pdo->prepare(
            "INSERT INTO investment_contracts(
                contract_no, address, asset_id, template_id,
                template_code, template_version,
                contract_title, contract_body_html, contract_body_text,
                amount_usdt, amount_local, fx_per_usdt, settlement_basis,
                status, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        )->execute([
            $contractNo, $address, $assetId, $template['id'],
            $template['template_code'] ?? 'funding_subscription',
            (int)($template['version_no'] ?? 1),
            $title, $bodyHtml, $bodyText,
            $amountUsdt, $amountLocal, $fxNum, $ccy,
            'draft', nowUtcSql(), nowUtcSql()
        ]);

        $contractId = $pdo->lastInsertId();

        writeContractAudit($pdo, [
            'contractId' => $contractId,
            'actorType'  => 'user',
            'actorId'    => $address,
            'actionType' => 'draft',
            'ip'         => getReqIp(),
            'userAgent'  => getReqUserAgent(),
            'payload'    => ['amount_usdt' => $amountUsdt, 'asset_id' => $assetId],
        ]);

        $pdo->commit();

        // (2026-05-17 v450) 운영자 보고: '영문 페이지에서 모달의 Asset 카드에
        //   한국어 자산명 표시'. 원인: /api/contracts/draft POST 응답의 contract
        //   객체에 asset_name 자체와 다국어 컬럼이 누락. frontend funding.js 의
        //   _localizedAssetName 이 contract.asset_name_en (undefined) → asset.name
        //   (한국어) 폴백.
        //   수정: 응답에 asset_name + asset_name_en/ko 추가. 다국어는
        //   enrichSingleRowWithI18nAssetNames helper 로 asset_key_info 후처리.
        $contractArr = [
            'id'              => (int)$contractId,
            'contract_no'     => $contractNo,
            'contract_title'  => $title,
            'contract_body_html' => $bodyHtml,
            'contract_body_text' => $bodyText,
            'amount_usdt'     => $amountUsdt,
            'amount_local'    => $amountLocal,
            'fx_per_usdt'     => $fxNum,
            'settlement_basis'=> $ccy,
            'status'          => 'draft',
            'asset_id'        => $assetId,
            'asset_name'      => $asset['name'] ?? '',
            'address'         => $address,
        ];
        if (function_exists('enrichSingleRowWithI18nAssetNames')) {
            enrichSingleRowWithI18nAssetNames($contractArr);
        }

        jsonOk([
            'contract' => $contractArr,
            'contract_id'  => (int)$contractId,
            'contract_no'  => $contractNo,
            'title'        => $title,
            'body_html'    => $bodyHtml,
            'amount_usdt'  => $amountUsdt,
            'amount_local' => $amountLocal,
            'fx_per_usdt'  => $fxNum,
        ]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError(500, '계약 생성 실패: ' . $e->getMessage());
    }
});

post('/api/contracts/:id/user-sign', function ($p) {
    $user = authMfaRequired();
    $address = $user['address'];
    $body = getJsonBody();
    $contractId = (int)$p['id'];

    if ($contractId <= 0) jsonError(400, 'contractId 올바르지 않음');

    // Check if body is empty (may happen when POST body exceeds post_max_size)
    if (empty($body)) {
        $contentLength = $_SERVER['CONTENT_LENGTH'] ?? 'N/A';
        error_log("[user-sign] Empty body for contract #$contractId. Content-Length: $contentLength");
        jsonError(400, '요청 데이터가 비어 있습니다. 서명 이미지가 너무 클 수 있습니다. 페이지를 새로고침 후 다시 시도하세요.');
    }

    // Accept both camelCase (JS client) and snake_case field names
    $signerName   = trim($body['signerName'] ?? $body['signer_name'] ?? '');
    $consentElec  = toBool($body['consentElectronic'] ?? $body['consent_electronic'] ?? false);
    $consentSign  = toBool($body['consentSignature'] ?? $body['consent_signature'] ?? false);
    $signatureDataUrl = trim($body['signatureDataUrl'] ?? $body['signature_data_url'] ?? '');

    error_log("[user-sign] id=$contractId addr=$address signerName=$signerName consentE=$consentElec consentS=$consentSign dataUrl.len=" . strlen($signatureDataUrl));

    if (!$signerName)       jsonError(400, '서명자명을 입력하세요.');
    if (!$consentElec)      jsonError(400, '전자문서 동의가 필요합니다.');
    if (!$consentSign)      jsonError(400, '전자서명 동의가 필요합니다.');
    if (!$signatureDataUrl) jsonError(400, '전자서명이 필요합니다.');

    $contract = DB::fetchOne(
        "SELECT * FROM investment_contracts WHERE id=? AND address=?",
        [$contractId, $address]
    );
    if (!$contract) jsonError(404, '전자계약서를 찾을 수 없습니다.');

    $st = $contract['status'] ?? '';
    if (!in_array($st, ['draft', 'user_signed'], true)) {
        error_log("[user-sign] FAIL: contract #$contractId status=$st not in [draft,user_signed]");
        jsonError(400, "현재 상태({$st})에서는 사용자 서명을 수정할 수 없습니다.");
    }

    try {
        $signPath = saveBase64PngToUploads($signatureDataUrl, 'user_contract_' . $contractId);
    } catch (Throwable $e) {
        error_log("[user-sign] signature save failed: " . $e->getMessage());
        jsonError(400, $e->getMessage());
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "UPDATE investment_contracts
             SET status='user_signed',
                 signer_name=?,
                 consent_electronic=1,
                 consent_signature=1,
                 user_signature_path=?,
                 user_signed_at=?,
                 user_signed_ip=?,
                 user_signed_user_agent=?,
                 rejected_reason=NULL,
                 updated_at=?
             WHERE id=?"
        )->execute([
            $signerName,
            $signPath,
            nowUtcSql(),
            getReqIp(),
            substr(getReqUserAgent(), 0, 255),
            nowUtcSql(),
            $contractId
        ]);

        writeContractAudit($pdo, [
            'contractId' => $contractId,
            'actorType'  => 'user',
            'actorId'    => $address,
            'actionType' => 'user_signed',
            'ip'         => getReqIp(),
            'userAgent'  => getReqUserAgent(),
            'payload'    => ['signer_name' => $signerName, 'signature_path' => $signPath],
        ]);

        $pdo->commit();

        // Return full contract row
        $updated = DB::fetchOne(
            "SELECT * FROM investment_contracts WHERE id=?",
            [$contractId]
        );
        jsonOk(['contract' => $updated ?: ['id' => $contractId, 'status' => 'user_signed']]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError(500, '전자계약서 서명 저장 실패: ' . $e->getMessage());
    }
});
