<?php
/**
 * KYC routes: status, save basic info, certify, poll
 */

function b64Encode(string $s): string {
    return base64_encode($s);
}

function isB64Strict(string $s): bool {
    $trimmed = preg_replace('/\s+/', '', $s);
    if (!$trimmed) return false;
    $decoded = base64_decode($trimmed, true);
    if ($decoded === false) return false;
    return base64_encode($decoded) === $trimmed;
}

function decodeMaybeB64(?string $v): ?string {
    if ($v === null) return null;
    $s = trim($v);
    if ($s === '') return '';
    if (isB64Strict($s)) {
        $decoded = base64_decode($s, true);
        return $decoded !== false ? $decoded : '';
    }
    return $s;
}

function normalizeBirth(?string $v): ?string {
    $s = trim($v ?? '');
    if (!$s) return null;

    if (preg_match('/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/', $s, $m)) {
        return "{$m[1]}-{$m[2]}-{$m[3]}";
    }

    $digits = preg_replace('/\D/', '', $s);
    if (strlen($digits) !== 8) return null;

    $y1 = (int)substr($digits, 0, 4);
    $m1 = (int)substr($digits, 4, 2);
    $d1 = (int)substr($digits, 6, 2);
    if ($y1 >= 1900 && $y1 <= 2100 && $m1 >= 1 && $m1 <= 12 && $d1 >= 1 && $d1 <= 31) {
        return sprintf('%04d-%02d-%02d', $y1, $m1, $d1);
    }

    $d2 = (int)substr($digits, 0, 2);
    $m2 = (int)substr($digits, 2, 2);
    $y2 = (int)substr($digits, 4, 4);
    if ($y2 >= 1900 && $y2 <= 2100 && $m2 >= 1 && $m2 <= 12 && $d2 >= 1 && $d2 <= 31) {
        return sprintf('%04d-%02d-%02d', $y2, $m2, $d2);
    }

    return null;
}

function normalizeNameCore(string $name): string {
    $s = Normalizer::normalize(trim($name), Normalizer::FORM_KC) ?: trim($name);
    // strip invisible
    $s = preg_replace('/[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{206F}\x{FEFF}\x{00AD}]/u', '', $s);
    // strip controls
    $s = preg_replace('/[\p{Cc}\p{Cf}]+/u', '', $s);
    $s = preg_replace('/\s+/', ' ', trim($s));
    return $s;
}

function normalizeNameToKey(string $name): string {
    $s = normalizeNameCore($name);
    $s = preg_replace('/[^\p{L}\p{N}]+/u', '', $s);
    return mb_strtolower($s);
}

function normalizeNameVariants(string $name): array {
    $cleaned = normalizeNameCore($name);
    if (!$cleaned) return [];
    $tokens = array_filter(explode(' ', $cleaned));
    $v1 = normalizeNameToKey($cleaned);
    $v2 = normalizeNameToKey(implode('', $tokens));
    $v3 = normalizeNameToKey(implode('', array_reverse($tokens)));
    $out = [];
    if ($v1) $out[$v1] = true;
    if ($v2) $out[$v2] = true;
    if ($v3) $out[$v3] = true;
    return array_keys($out);
}

function sanitizeDocType(?string $v): string {
    $s = strtolower(trim($v ?? ''));
    if ($s === 'id_card') return 'id_card';
    if ($s === 'drivers_license' || $s === 'driver_license') return 'drivers_license';
    if ($s === 'passport') return 'passport';
    return '';
}

function isApprovedDiditStatus(?string $v): bool {
    $s = strtoupper(trim($v ?? ''));
    return in_array($s, ['APPROVED','APPROVE','ACCEPTED','PASSED','VERIFIED','APPROVED_WITH_WARNING','APPROVED_WITH_WARNINGS','APPROVEDWITHWARNINGS']);
}

function isReviewLike(?string $v): bool {
    $s = strtoupper(trim($v ?? ''));
    foreach (['REVIEW','IN_REVIEW','ON_REVIEW','MANUAL_REVIEW','NEEDS_REVIEW','UNDER_REVIEW'] as $x) {
        if (str_contains($s, $x)) return true;
    }
    return false;
}

function isPendingLike(?string $v): bool {
    $s = strtoupper(trim($v ?? ''));
    foreach (['PENDING','IN_PROGRESS','PROCESS','NOT STARTED','STARTED','CREATED'] as $x) {
        if (str_contains($s, $x)) return true;
    }
    return false;
}

function sameBirth(?string $a, ?string $b): bool {
    return ($a ?? '') === ($b ?? '');
}

function sameName(string $storedName, array $extractedNames): bool {
    $storedKey = normalizeNameToKey($storedName);
    $storedVariants = normalizeNameVariants($storedName);

    foreach ($extractedNames as $cand) {
        $candKey = normalizeNameToKey($cand);
        if (!$candKey) continue;
        if ($candKey === $storedKey) return true;
        $candVariants = normalizeNameVariants($cand);
        foreach ($candVariants as $v) {
            if (in_array($v, $storedVariants)) return true;
        }
    }
    return false;
}

function getKycUser(string $address): ?array {
    return DB::fetchOne(
        "SELECT address, kyc_yn, mt_name, mt_birth,
                kyc_doc_type, kyc_doc_ip, kyc_doc_regdate,
                kyc_session_id, kyc_status, kyc_extracted_name, kyc_extracted_birth,
                kyc_last_verified_at
         FROM users WHERE address=? LIMIT 1",
        [$address]
    );
}

function getLatestPendingKycSession(string $address): ?array {
    return DB::fetchOne(
        "SELECT * FROM kyc_sessions WHERE address=? AND status='pending' ORDER BY id DESC LIMIT 1",
        [$address]
    );
}

function getKycSessionById(string $address, string $sessionId): ?array {
    return DB::fetchOne(
        "SELECT * FROM kyc_sessions WHERE address=? AND session_id=? LIMIT 1",
        [$address, $sessionId]
    );
}

function createDiditSession(string $address, string $docType, string $storedName, string $storedBirth, string $ip): array {
    if (!DIDIT_API_KEY) throw new RuntimeException('DIDIT_API_KEY 설정이 없습니다.');
    if (!DIDIT_WORKFLOW_ID) throw new RuntimeException('DIDIT_WORKFLOW_ID 설정이 없습니다.');
    if (!PUBLIC_BASE_URL) throw new RuntimeException('PUBLIC_BASE_URL 설정이 없습니다.');

    $rid = bin2hex(random_bytes(6));
    // (2026-05-18 v568) 실제 파일은 /user/kyc-return.html 위치. 이전 코드는
    //   `/kyc-return.html` 으로 callback URL 을 만들어 didit 가 root 로 redirect
    //   → 신규 deployment 에서 404 (이전 deployment 에선 우연히 .htaccess 또는
    //   FTP 로 root 에 사본이 있었음). path 에 /user 명시.
    $callbackUrl = PUBLIC_BASE_URL . '/user/kyc-return.html?rid=' . urlencode($rid);

    $body = [
        'workflow_id' => DIDIT_WORKFLOW_ID,
        'vendor_data' => $address,
        'callback' => $callbackUrl,
        'callback_method' => 'both',
        'metadata' => json_encode(['address' => $address, 'doc_type' => $docType, 'ip' => $ip]),
        'expected_details' => ['date_of_birth' => $storedBirth],
    ];

    $ch = curl_init('https://verification.didit.me/v3/session/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($body),
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
            'x-api-key: ' . DIDIT_API_KEY,
        ],
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$response || $httpCode >= 400) {
        $data = json_decode($response ?: '{}', true) ?: [];
        $detail = $data['detail'] ?? $data['error'] ?? $data['message'] ?? '';
        if (stripos($detail, 'credit') !== false) {
            throw new RuntimeException('kyc_no_credits');
        }
        throw new RuntimeException('kyc_provider_error');
    }

    $data = json_decode($response, true) ?: [];
    $sessionId = trim($data['session_id'] ?? $data['sessionId'] ?? '');
    $sessionUrl = trim($data['session_url'] ?? $data['url'] ?? $data['sessionUrl'] ?? '');

    if (!$sessionId || !$sessionUrl) {
        throw new RuntimeException('kyc_provider_error');
    }

    return ['sessionId' => $sessionId, 'sessionUrl' => $sessionUrl, 'raw' => $data];
}

function fetchDiditDecision(string $sessionId): array {
    if (!DIDIT_API_KEY) throw new RuntimeException('DIDIT_API_KEY 설정이 없습니다.');

    $ch = curl_init('https://verification.didit.me/v3/session/' . urlencode($sessionId) . '/decision/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'x-api-key: ' . DIDIT_API_KEY,
        ],
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response ?: '{}', true) ?: [];

    if ($httpCode >= 400) {
        $detail = $data['detail'] ?? $data['error'] ?? $data['message'] ?? '';
        if (stripos($detail, 'credit') !== false) {
            throw new RuntimeException('kyc_no_credits');
        }
        throw new RuntimeException('kyc_provider_error');
    }

    return $data;
}

function extractDiditDecision(array $decision): array {
    $out = [
        'status_overall' => trim($decision['status'] ?? $decision['overall_status'] ?? ''),
        'idv_status' => '',
        'session_url' => trim($decision['session_url'] ?? $decision['url'] ?? $decision['sessionUrl'] ?? ''),
        'name_candidates' => [],
        'birth_candidates' => [],
    ];

    $idv = null;
    if (!empty($decision['id_verifications'][0])) $idv = $decision['id_verifications'][0];
    elseif (!empty($decision['id_verification'])) $idv = $decision['id_verification'];
    elseif (!empty($decision['idVerification'])) $idv = $decision['idVerification'];
    elseif (!empty($decision['idVerificationResult'])) $idv = $decision['idVerificationResult'];

    $out['idv_status'] = trim($idv['status'] ?? $idv['verification_status'] ?? '');

    $fullName = trim($idv['full_name'] ?? $idv['fullName'] ?? $idv['document_full_name'] ?? $idv['documentFullName'] ?? $idv['name'] ?? '');
    $firstName = trim($idv['first_name'] ?? $idv['firstName'] ?? '');
    $lastName = trim($idv['last_name'] ?? $idv['lastName'] ?? '');

    $cands = [];
    if ($fullName) $cands[] = $fullName;
    if ($firstName || $lastName) $cands[] = trim("$firstName $lastName");
    if ($lastName || $firstName) $cands[] = trim("$lastName $firstName");
    $out['name_candidates'] = array_values(array_unique(array_filter($cands)));

    $dobRaw = $idv['date_of_birth'] ?? $idv['dateOfBirth'] ?? $idv['birth_date'] ?? $idv['birthDate'] ?? $idv['birthdate'] ?? $idv['dob'] ?? '';
    $dobNorm = normalizeBirth($dobRaw);
    if ($dobNorm) $out['birth_candidates'] = [$dobNorm];

    return $out;
}

// ====== KYC Routes ======

get('/api/kyc/status', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    ensureUser($address);

    // (2026-05-18 v539) 운영자: '필수가 아니더라도 KYC 는 가능해야 한다'.
    //   기존 bypass 분기는 모든 사용자에게 kyc_yn='Y' + mt_name='BYPASSED'
    //   를 강제 반환 → 자발적 KYC 가 불가능했다. bypass 는 다운스트림 게이트
    //   (assertUserKycEligibleOrThrow, core.js checkKycGate) 에서만 통과
    //   결정에 사용하면 충분. 본 status 엔드포인트는 실제 사용자 상태를
    //   반환하고 bypassed 플래그만 추가로 알려 프론트가 'optional' UI 를
    //   분기하도록 한다.
    $u = getKycUser($address);
    $mtName = decodeMaybeB64($u['mt_name'] ?? null);
    $mtBirth = decodeMaybeB64($u['mt_birth'] ?? null);

    // (2026-05-18 v569) 운영자: 인증된 사용자가 자신의 KYC 정보를 카드에서
    //   확인할 수 있어야 함. 추가 필드 반환 — 신분증 종류, 등록일, didit
    //   추출된 이름/생년월일, 최종 확인 시각.
    // (2026-05-18 v570) 활성 KYC 세션의 상태를 함께 노출. 프론트는 이 값을
    //   보고 'in_review' 면 업로드 폼 대신 "인증 진행 중" 패널을 띄워야
    //   사용자가 페이지를 이탈했다 돌아와도 자신의 상태를 알 수 있다.
    $pendingSession = getLatestPendingKycSession($address);
    $sessionState = null;
    $sessionDiditStatus = null;
    $sessionId = null;
    if ($pendingSession) {
        $sessionId = $pendingSession['session_id'] ?? null;
        $sessionDiditStatus = $pendingSession['didit_status'] ?? null;
        $rawStatus = trim((string)$sessionDiditStatus);
        if (isReviewLike($rawStatus)) {
            $sessionState = 'in_review';
        } elseif (isApprovedDiditStatus($rawStatus)) {
            // 세션 row 가 'pending' 으로 남아있지만 last decision 이 Approved 라면
            //   포커스 빠진 사이 final 폴링이 안 돌았을 뿐. 안전하게 'in_review'
            //   로 처리해서 다음 폴 호출이 정상 승인 경로로 진입하게 한다.
            $sessionState = 'in_review';
        } else {
            $sessionState = 'pending';
        }
    } elseif (strtoupper((string)($u['kyc_status'] ?? '')) === 'IN_REVIEW') {
        // 세션이 다른 이유로 정리됐어도 user.kyc_status='in_review' 면 UI 유지.
        $sessionState = 'in_review';
    }

    // (2026-05-19 v582) 운영자: 'didit 에서 거부되면 kyc-certification 에 거부
    //   카드 + 신청일 + 거부일 표시, 다시 제출 안내.' 활성(pending) 세션이
    //   없거나 user.kyc_status 가 거절 키인 경우 가장 최근 세션 1개를 가져와
    //   거부 카드용 데이터를 제공한다. 신청일 = kyc_sessions.created_at,
    //   거부일 = kyc_sessions.updated_at (status 가 terminal 로 바뀐 시점).
    $latestSession = null;
    try {
        $latestSession = DB::fetchOne(
            "SELECT session_id, status, didit_status, fail_reason, created_at, updated_at, doc_type
               FROM kyc_sessions
              WHERE address = ?
              ORDER BY id DESC
              LIMIT 1",
            [$address]
        );
    } catch (Throwable $_) {}

    jsonOk([
        'address' => $address,
        'kyc_yn' => strtoupper($u['kyc_yn'] ?? 'N'),
        'mt_name_set' => !empty(trim($mtName ?? '')),
        'mt_birth_set' => !empty(trim($mtBirth ?? '')),
        'mt_name' => $mtName ?? '',
        'mt_birth' => $mtBirth ?? '',
        'kyc_status' => ($u['kyc_status'] ?? '') ?: null,
        'kyc_doc_type' => $u['kyc_doc_type'] ?? null,
        'kyc_doc_regdate' => $u['kyc_doc_regdate'] ?? null,
        'kyc_extracted_name' => $u['kyc_extracted_name'] ?? null,
        'kyc_extracted_birth' => $u['kyc_extracted_birth'] ?? null,
        'kyc_last_verified_at' => $u['kyc_last_verified_at'] ?? null,
        'bypassed' => isKycBypassed(),
        // (v570) 활성 세션 진행 상태 — 프론트가 'in_review' 인 경우 폼 숨김.
        'session_id' => $sessionId,
        'session_state' => $sessionState,
        'session_didit_status' => $sessionDiditStatus,
        // (v582) 최근 세션 스냅샷 (거부 카드용). pending 이면 in-progress 패널이
        //   먼저 잡고, terminal 이면 거부 카드가 잡는다 — 프론트가 분기.
        'latest_session_id' => $latestSession['session_id'] ?? null,
        'latest_session_status' => $latestSession['status'] ?? null,
        'latest_session_didit_status' => $latestSession['didit_status'] ?? null,
        'latest_session_fail_reason' => $latestSession['fail_reason'] ?? null,
        'latest_session_submitted_at' => $latestSession['created_at'] ?? null,
        'latest_session_decided_at' => $latestSession['updated_at'] ?? null,
        'latest_session_doc_type' => $latestSession['doc_type'] ?? null,
    ]);
});

post('/api/kyc-ready-save', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    ensureUser($address);

    // (2026-05-18 v539) bypass mode 여도 자발적 KYC 가 가능하도록 짧은 순환
    //   제거. 입력값을 정상적으로 저장. bypass 여부는 응답에 플래그로 알려
    //   프론트가 후속 흐름(자발적 verify 안내 등) 을 분기하는 데 사용.
    // (2026-05-18 v543) 운영자: '2단계에서 1단계로 돌아가서 수정하려고
    //   해도 이미 입력한 정보가 수정 안 된다'. 원인: 기존 코드가
    //   mt_name + mt_birth 가 둘 다 입력되어 있으면 무조건 409 'already_set'
    //   로 거절 → didit 인증 시작 전에 이름/생년월일을 잘못 입력해도
    //   영영 수정 불가. 정책 변경: kyc_yn === 'Y' (didit 승인 완료) 인 경우만
    //   변경 차단. 미인증 상태라면 자유롭게 재입력 가능.
    $body = getJsonBody();
    $mtName = trim($body['mt_name'] ?? '');
    $mtBirth = normalizeBirth($body['mt_birth'] ?? '');

    if (!$mtName || mb_strlen($mtName) > 100) jsonError(400, '성명을 정확히 입력하세요.');
    if (!$mtBirth) jsonError(400, '생년월일 형식이 올바르지 않습니다.');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $row = DB::fetchOne("SELECT mt_name, mt_birth, kyc_yn FROM users WHERE address=? FOR UPDATE", [$address]);
        if (!$row) { $pdo->rollBack(); jsonError(404, '사용자 없음'); }

        // (v543) 차단 조건을 'mt_name/mt_birth 둘 다 입력됨' 에서
        //   'kyc_yn === Y (didit 승인 완료)' 로 완화. didit 시작 전이면
        //   유저가 자유롭게 이름/생년월일을 재입력할 수 있어 인증 직전에
        //   오타 발견해도 정정 가능.
        if (strtoupper((string)($row['kyc_yn'] ?? 'N')) === 'Y') {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'status' => 'already_verified', 'message' => '이미 KYC 인증이 완료된 사용자입니다.'], 409);
        }

        DB::execute("UPDATE users SET mt_name=?, mt_birth=? WHERE address=?", [b64Encode($mtName), b64Encode($mtBirth), $address]);
        $pdo->commit();
        jsonOk(['status' => 'succ', 'mt_name' => $mtName, 'mt_birth' => $mtBirth, 'bypassed' => isKycBypassed()]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError(500, '기본 정보 저장 실패: ' . $e->getMessage());
    }
});

post('/api/kyc-certify', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    ensureUser($address);

    // (2026-05-18 v539) bypass mode 여도 자발적 인증 가능하도록 짧은 순환
    //   제거. didit 세션 생성 같은 정상 흐름을 그대로 진행. bypass 여부는
    //   다운스트림 게이트가 별도로 판단.
    // (2026-05-18 v549) v547 의 short-circuit 제거 — 운영자 의도는 'KYC 가
    //   필수가 아니더라도 가능해야 한다' 이지 '건너뛰라' 가 아니다. didit 키
    //   미설정 시 graceful 차단 대신 명확한 admin-actionable 에러 메시지를
    //   catch 블록에서 분기 표시 (status='kyc_not_configured'). 운영자는
    //   .env 에 DIDIT_API_KEY / DIDIT_WORKFLOW_ID 를 설정해 즉시 정상화.
    $body = getJsonBody();
    $docType = sanitizeDocType($body['document_type'] ?? '');
    if (!$docType) jsonError(400, '신분증 종류를 선택하세요.');

    $u = getKycUser($address);
    $kycYn = strtoupper($u['kyc_yn'] ?? 'N');
    $storedName = trim(decodeMaybeB64($u['mt_name'] ?? null) ?? '');
    $storedBirth = normalizeBirth(decodeMaybeB64($u['mt_birth'] ?? null) ?? '');
    $clientIp = getReqIp();

    if ($kycYn === 'Y') {
        jsonOk(['status' => 'succ', 'already_verified' => true, 'kyc_yn' => 'Y']);
    }

    if (!$storedName || !$storedBirth) {
        jsonResponse(['ok' => false, 'status' => 'need_basic_info', 'message' => '기본 정보를 먼저 입력하세요.'], 409);
    }

    if (KYC_MODE === 'auto') {
        DB::execute(
            "UPDATE users SET kyc_yn='Y', kyc_doc_type=?, kyc_doc_ip=?, kyc_doc_regdate=?, kyc_last_verified_at=?, kyc_status='APPROVED' WHERE address=?",
            [$docType, $clientIp, nowUtcSql(), nowUtcSql(), $address]
        );
        jsonOk(['status' => 'succ', 'kyc_yn' => 'Y', 'mode' => 'auto']);
    }

    // Didit mode - use DB lock
    $pdo = DB::pdo();
    $gotLock = false;
    $lockKey = "kyc_certify|{$address}";

    try {
        $lockRow = DB::fetchOne("SELECT GET_LOCK(?, 5) AS got_lock", [$lockKey]);
        $gotLock = (int)($lockRow['got_lock'] ?? 0) === 1;

        if (!$gotLock) {
            jsonResponse(['ok' => false, 'status' => 'busy_try_again', 'message' => '잠시 후 다시 시도하세요.'], 409);
        }

        $existing = getLatestPendingKycSession($address);
        if ($existing) {
            $diditStatus = $existing['didit_status'] ?? '';
            $createdAt = new DateTimeImmutable($existing['created_at'], new DateTimeZone('UTC'));
            $ageSec = time() - $createdAt->getTimestamp();
            $maxSec = isReviewLike($diditStatus) ? KYC_REVIEW_MAX_SEC : KYC_STUCK_MAX_SEC;

            if ($existing['session_url'] && isPendingLike($diditStatus) && $ageSec <= $maxSec) {
                jsonOk([
                    'status' => 'session_created',
                    'reused' => true,
                    'session_id' => $existing['session_id'],
                    'session_url' => $existing['session_url'],
                    'retry_after_sec_not_started' => KYC_STUCK_MAX_SEC,
                    'retry_after_sec_review' => KYC_REVIEW_MAX_SEC,
                ]);
            }

            DB::execute(
                "UPDATE kyc_sessions SET status='kyc_status_not_approved', fail_reason='expired_before_recreate', updated_at=? WHERE id=?",
                [nowUtcSql(), $existing['id']]
            );
        }

        try {
            $created = createDiditSession($address, $docType, $storedName, $storedBirth, $clientIp);

            DB::execute(
                "INSERT INTO kyc_sessions(session_id, address, doc_type, session_url, status, didit_status, stored_name, stored_birth, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE address=VALUES(address), doc_type=VALUES(doc_type), session_url=VALUES(session_url),
                 status=VALUES(status), didit_status=VALUES(didit_status), stored_name=VALUES(stored_name), stored_birth=VALUES(stored_birth), updated_at=VALUES(updated_at)",
                [
                    $created['sessionId'], $address, $docType, $created['sessionUrl'],
                    'pending', $created['raw']['status'] ?? 'Not Started',
                    $storedName, $storedBirth, nowUtcSql(), nowUtcSql()
                ]
            );

            DB::execute("UPDATE users SET kyc_session_id=?, kyc_status='pending' WHERE address=?", [$created['sessionId'], $address]);

            jsonOk([
                'status' => 'session_created',
                'session_id' => $created['sessionId'],
                'session_url' => $created['sessionUrl'],
                'retry_after_sec_not_started' => KYC_STUCK_MAX_SEC,
                'retry_after_sec_review' => KYC_REVIEW_MAX_SEC,
            ]);
        } catch (Throwable $e) {
            $msg = $e->getMessage();
            if ($msg === 'kyc_no_credits') {
                jsonResponse(['ok' => false, 'status' => 'kyc_no_credits', 'message' => 'KYC 공급자 크레딧이 없습니다.'], 403);
            }
            if ($msg === 'kyc_provider_network_error') {
                jsonResponse(['ok' => false, 'status' => 'kyc_provider_network_error', 'message' => 'KYC 공급자 네트워크 호출 실패'], 502);
            }
            // (2026-05-18 v549) createDiditSession 이 던지는 'DIDIT_API_KEY
            //   설정이 없습니다.' / 'DIDIT_WORKFLOW_ID 설정이 없습니다.' 를
            //   별도 status 로 분기 → 프론트가 admin-actionable 메시지를 표시.
            if (stripos($msg, 'DIDIT_API_KEY') !== false || stripos($msg, 'DIDIT_WORKFLOW_ID') !== false) {
                jsonResponse([
                    'ok' => false,
                    'status' => 'kyc_not_configured',
                    'message' => 'KYC verification service has not been configured by the administrator yet. Please contact support to enable identity verification.',
                    'detail' => $msg,
                ], 503);
            }
            jsonResponse(['ok' => false, 'status' => 'kyc_provider_error', 'message' => 'KYC 공급자 호출 실패', 'detail' => $msg], 502);
        }
    } catch (Throwable $e) {
        jsonError(500, 'KYC 처리 중 서버 오류: ' . $e->getMessage());
    } finally {
        if ($gotLock) {
            try { DB::execute("DO RELEASE_LOCK(?)", [$lockKey]); } catch (Throwable $ignore) {}
        }
    }
});

post('/api/kyc-certify/poll', function () {
    $user = authMfaRequired();
    $address = $user['address'];
    ensureUser($address);

    // (2026-05-18 v539) bypass 여부와 무관하게 정상 polling 수행. 사용자가
    //   자발적으로 verify 를 진행 중이면 그 결과를 정확히 돌려주는 게 맞다.
    $body = getJsonBody();
    $sessionId = trim($body['session_id'] ?? '');
    if (!$sessionId) {
        $pending = getLatestPendingKycSession($address);
        $sessionId = trim($pending['session_id'] ?? '');
    }
    if (!$sessionId) jsonResponse(['ok' => false, 'status' => 'missing_session_id', 'message' => '세션이 없습니다.'], 400);

    $session = getKycSessionById($address, $sessionId);
    if (!$session) jsonResponse(['ok' => false, 'status' => 'missing_session_id', 'message' => '세션을 찾을 수 없습니다.'], 404);

    $u = getKycUser($address);
    $storedName = trim(decodeMaybeB64($u['mt_name'] ?? null) ?? $session['stored_name'] ?? '');
    $storedBirth = normalizeBirth(decodeMaybeB64($u['mt_birth'] ?? null) ?? $session['stored_birth'] ?? '');

    if (!$storedName || !$storedBirth) {
        jsonResponse(['ok' => false, 'status' => 'need_basic_info', 'message' => '기본 정보를 먼저 입력하세요.'], 409);
    }

    if (strtoupper($u['kyc_yn'] ?? 'N') === 'Y') {
        jsonOk(['status' => 'succ', 'kyc_yn' => 'Y', 'already_verified' => true]);
    }

    $terminalStatuses = ['succ', 'mismatch_name', 'mismatch_birth', 'kyc_status_not_approved', 'kyc_no_credits'];
    if (in_array($session['status'] ?? '', $terminalStatuses)) {
        jsonResponse([
            'ok' => $session['status'] === 'succ',
            'status' => $session['status'],
            'didit_status' => $session['didit_status'] ?? null,
            'session_id' => $session['session_id'],
        ]);
    }

    try {
        $decision = fetchDiditDecision($sessionId);
        $ex = extractDiditDecision($decision);
        // (2026-05-18 v581) 운영자 보고: "공급자 상태 · 승인" 으로 표시되는데
        //   동시에 검토 중 패널이 뜨는 모순. 원인: $diditStatus 는 화면 표시용
        //   값인데 idv_status 우선 OR 로 잡고 있어, 문서 스캔만 통과한 상태
        //   (idv='Approved', session='In Review') 에서 idv 값을 노출 → didit
        //   대시보드의 "검토 중" 과 어긋남.
        //   세션 전체 (status_overall) 가 didit 대시보드 truth 와 일치하므로
        //   그것을 우선시. idv 는 폴백. 승인 판정 자체는 별도 변수($anyReview /
        //   $approved) 가 두 필드를 독립적으로 보므로 영향 없음.
        $diditStatus = trim($ex['status_overall'] ?: $ex['idv_status']);

        DB::execute(
            "UPDATE kyc_sessions SET didit_status=?, extracted_name=?, extracted_birth=?, last_decision_at=?, updated_at=? WHERE session_id=?",
            [$diditStatus ?: null, $ex['name_candidates'][0] ?? null, $ex['birth_candidates'][0] ?? null, nowUtcSql(), nowUtcSql(), $sessionId]
        );

        $createdAt = new DateTimeImmutable($session['created_at'], new DateTimeZone('UTC'));
        $ageSec = time() - $createdAt->getTimestamp();

        // (2026-05-18 v570) SECURITY FIX — didit "검토중" 인 세션이 우리 사이트에서
        //   자동 승인되던 문제. 원인: didit Decision 응답은 세션 전체 status (didit
        //   대시보드 "Status" 열) 와 개별 검증 항목 (id_verifications[].status) 를
        //   분리해서 돌려준다. 운영자가 보고한 케이스에서 문서 스캔은 자동 통과
        //   (idv_status='Approved') 였지만, 얼굴 매칭은 사람 검토 대상이라 세션
        //   status_overall='In Review' 상태였다. 이전 OR 조건이 idv_status 만 보고
        //   승인 처리 → 다른 사람 사진을 올린 사용자도 KYC 통과.
        //
        //   새 규칙:
        //   1) ANY status 가 review-like 이면 절대 승인하지 않는다 — didit 대시보드
        //      가 "검토중" 인 한 우리도 "검토중".
        //   2) 승인 판정은 세션 레벨 status_overall (= didit 대시보드 truth) 이
        //      APPROVED 여야 한다.
        //   3) review-like 는 더 이상 terminal failure 가 아니다 — 사람 검토는
        //      몇 시간~며칠 걸릴 수 있어 timeout 으로 reject 하면 정상 사용자도
        //      탈락. 별도 'in_review' 응답으로 프론트가 "인증 진행 중" UI 를
        //      띄우게 한다. 관리자가 didit 대시보드에서 거절하면 다음 폴링에서
        //      status_overall='Declined' 가 와서 정상 거절 경로로 빠진다.
        $anyReview = isReviewLike($ex['idv_status']) || isReviewLike($ex['status_overall']);
        $approved = !$anyReview && isApprovedDiditStatus($ex['status_overall']);

        if (!$approved) {
            // 사람 검토 대기 — terminal 처리 금지. 사용자에게 '진행 중' 노출.
            if ($anyReview) {
                DB::execute("UPDATE users SET kyc_status='in_review' WHERE address=?", [$address]);
                jsonOk([
                    'status' => 'in_review',
                    'didit_status' => $diditStatus ?: null,
                    'session_id' => $sessionId,
                    'review_overdue' => ($ageSec > KYC_REVIEW_MAX_SEC),
                ]);
            }

            // didit 가 명시적으로 거절했다면 즉시 reject (Declined / Rejected).
            $explicitDeclined = preg_match('/DECLIN|REJECT|FAIL|DENIED|EXPIR/i', $ex['status_overall'] . ' ' . $ex['idv_status']) === 1;

            if (!$explicitDeclined && isPendingLike($diditStatus) && $ageSec <= KYC_STUCK_MAX_SEC) {
                jsonOk(['status' => 'pending', 'didit_status' => $diditStatus ?: null, 'session_id' => $sessionId]);
            }

            DB::execute(
                "UPDATE kyc_sessions SET status='kyc_status_not_approved', fail_reason=? WHERE session_id=?",
                [$explicitDeclined ? 'declined' : (isPendingLike($diditStatus) ? 'timeout' : 'not_approved'), $sessionId]
            );
            DB::execute("UPDATE users SET kyc_status='kyc_status_not_approved' WHERE address=?", [$address]);
            jsonResponse(['ok' => false, 'status' => 'kyc_status_not_approved', 'didit_status' => $diditStatus ?: null, 'session_id' => $sessionId], 400);
        }

        if (!sameBirth($storedBirth, $ex['birth_candidates'][0] ?? '')) {
            DB::execute("UPDATE kyc_sessions SET status='mismatch_birth', fail_reason='mismatch_birth' WHERE session_id=?", [$sessionId]);
            DB::execute("UPDATE users SET kyc_status='mismatch_birth' WHERE address=?", [$address]);
            jsonResponse(['ok' => false, 'status' => 'mismatch_birth', 'didit_status' => $diditStatus ?: null, 'session_id' => $sessionId], 400);
        }

        if (!sameName($storedName, $ex['name_candidates'])) {
            DB::execute("UPDATE kyc_sessions SET status='mismatch_name', fail_reason='mismatch_name' WHERE session_id=?", [$sessionId]);
            DB::execute("UPDATE users SET kyc_status='mismatch_name' WHERE address=?", [$address]);
            jsonResponse(['ok' => false, 'status' => 'mismatch_name', 'didit_status' => $diditStatus ?: null, 'session_id' => $sessionId], 400);
        }

        // KYC approved + name/birth match => success
        DB::execute(
            "UPDATE users SET kyc_yn='Y', kyc_doc_type=?, kyc_doc_ip=?, kyc_doc_regdate=?, kyc_session_id=?, kyc_status=?, kyc_extracted_name=?, kyc_extracted_birth=?, kyc_last_verified_at=? WHERE address=?",
            [
                $session['doc_type'], getReqIp(), nowUtcSql(), $sessionId,
                $diditStatus ?: 'APPROVED',
                $ex['name_candidates'][0] ?? null, $ex['birth_candidates'][0] ?? null,
                nowUtcSql(), $address
            ]
        );

        DB::execute("UPDATE kyc_sessions SET status='succ', fail_reason=NULL WHERE session_id=?", [$sessionId]);

        jsonOk(['status' => 'succ', 'kyc_yn' => 'Y', 'didit_status' => $diditStatus ?: null, 'session_id' => $sessionId]);
    } catch (Throwable $e) {
        if ($e->getMessage() === 'kyc_no_credits') {
            DB::execute("UPDATE kyc_sessions SET status='kyc_no_credits', fail_reason='kyc_no_credits' WHERE session_id=?", [$sessionId]);
            DB::execute("UPDATE users SET kyc_status='kyc_no_credits' WHERE address=?", [$address]);
            jsonResponse(['ok' => false, 'status' => 'kyc_no_credits', 'message' => 'KYC 공급자 크레딧이 없습니다.'], 403);
        }
        jsonResponse(['ok' => false, 'status' => 'kyc_provider_error', 'message' => 'KYC 조회 실패', 'detail' => $e->getMessage()], 502);
    }
});
