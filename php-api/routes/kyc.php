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

/**
 * (2026-05-24 v814) 현재 사용자의 활성 review 세션 조회.
 *   pending 상태 + didit_status 가 review-like + 만료 시간 이내.
 *   없으면 null.
 */
function kycActiveReviewSession(string $address): ?array {
    $row = DB::fetchOne(
        "SELECT id, session_id, didit_status, status, created_at, updated_at
         FROM kyc_sessions
         WHERE address = ? AND status = 'pending'
         ORDER BY id DESC LIMIT 1",
        [$address]
    );
    if (!$row) return null;
    $diditStatus = (string)($row['didit_status'] ?? '');
    if (!isReviewLike($diditStatus)) return null;
    try {
        $createdAt = new DateTimeImmutable($row['created_at'], new DateTimeZone('UTC'));
        $ageSec = time() - $createdAt->getTimestamp();
        if ($ageSec > KYC_REVIEW_MAX_SEC) {
            // 너무 오래된 review 는 사실상 stuck — 재시도 허용.
            return null;
        }
    } catch (Throwable $_) {}
    return $row;
}

/**
 * (2026-05-24 v814) 사용자가 KYC 리뷰 진행 중인지 확인.
 *   1) kyc_sessions 에 활성 review 세션이 있거나
 *   2) users.kyc_status = 'in_review' 인 경우
 */
function kycIsInReview(string $address): bool {
    if (kycActiveReviewSession($address)) return true;
    try {
        $u = DB::fetchOne("SELECT kyc_status FROM users WHERE address=? LIMIT 1", [$address]);
        if ($u && strtolower((string)($u['kyc_status'] ?? '')) === 'in_review') {
            return true;
        }
    } catch (Throwable $_) {}
    return false;
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
    // (2026-05-23 v793) 핸드오프 토큰 인증 허용 — 일반 브라우저에서도 status
    //   조회 가능. authKycEndpoint() 정의는 파일 하단의 핸드오프 섹션 참고.
    $user = function_exists('authKycEndpoint') ? authKycEndpoint() : authMfaRequired();
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
    // (2026-05-23 v793) 핸드오프 토큰 인증 허용. 일반 브라우저에서 KYC 진행 시
    //   사용자가 이름/생년월일 정보를 (재)입력할 수 있어야 함.
    $user = function_exists('authKycEndpoint') ? authKycEndpoint() : authMfaRequired();
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
        $row = DB::fetchOne("SELECT mt_name, mt_birth, kyc_yn, kyc_status FROM users WHERE address=? FOR UPDATE", [$address]);
        if (!$row) { $pdo->rollBack(); jsonError(404, '사용자 없음'); }

        // (v543) 차단 조건을 'mt_name/mt_birth 둘 다 입력됨' 에서
        //   'kyc_yn === Y (didit 승인 완료)' 로 완화. didit 시작 전이면
        //   유저가 자유롭게 이름/생년월일을 재입력할 수 있어 인증 직전에
        //   오타 발견해도 정정 가능.
        if (strtoupper((string)($row['kyc_yn'] ?? 'N')) === 'Y') {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'status' => 'already_verified', 'message' => '이미 KYC 인증이 완료된 사용자입니다.'], 409);
        }

        // (2026-05-26 v856) mismatch 거부 후 정보 정정 시 kyc_status clear.
        //   기존: mt_birth/mt_name 만 업데이트 → kyc_status='mismatch_birth' 잔존
        //   → kyc-certification.html 이 status 보고 또 거부 카드 표시 → EDIT INFO →
        //   루프. Resubmit 버튼이 없어 사용자가 막힘.
        //   수정: mismatch_name / mismatch_birth 인 사용자가 정보 정정하면
        //   kyc_status 를 NULL 로 clear → 다음 kyc-certification 진입 시 폼 노출
        //   → 새 KYC 세션 시작 가능.
        $prevKycStatus = strtolower((string)($row['kyc_status'] ?? ''));
        $clearStatus = in_array($prevKycStatus, ['mismatch_birth', 'mismatch_name'], true);
        if ($clearStatus) {
            DB::execute("UPDATE users SET mt_name=?, mt_birth=?, kyc_status=NULL WHERE address=?", [b64Encode($mtName), b64Encode($mtBirth), $address]);
        } else {
            DB::execute("UPDATE users SET mt_name=?, mt_birth=? WHERE address=?", [b64Encode($mtName), b64Encode($mtBirth), $address]);
        }
        $pdo->commit();
        jsonOk(['status' => 'succ', 'mt_name' => $mtName, 'mt_birth' => $mtBirth, 'bypassed' => isKycBypassed(), 'kyc_status_cleared' => $clearStatus]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError(500, '기본 정보 저장 실패: ' . $e->getMessage());
    }
});

post('/api/kyc-certify', function () {
    // (2026-05-23 v793) 핸드오프 토큰 인증 허용. 일반 브라우저에서 didit 세션
    //   생성을 시작하기 위한 진입점.
    $user = function_exists('authKycEndpoint') ? authKycEndpoint() : authMfaRequired();
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

    // (2026-05-24 v814) 운영자 요청: 리뷰 진행 중 (In Review) 인 사용자는
    //   재신청 차단. 현재까지는 expired_before_recreate 로 기존 세션을 폐기
    //   하고 새 세션 만들었으나, 정책상 리뷰 결과 확정 전엔 재시도 불가.
    //   리뷰가 거부/거절 완료된 후에만 새 신청 허용.
    if (kycIsInReview($address)) {
        $review = kycActiveReviewSession($address);
        jsonResponse([
            'ok' => false,
            'status' => 'kyc_in_review',
            'message' => '이전 KYC 신청이 검토 중입니다. 결과가 나올 때까지 재신청은 차단됩니다.',
            'session_id' => $review['session_id'] ?? null,
            'didit_status' => $review['didit_status'] ?? null,
            'submitted_at' => $review['created_at'] ?? null,
        ], 409);
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
    // (2026-05-23 v793) 핸드오프 토큰 인증 허용. 일반 브라우저에서 didit
    //   결과를 폴링하는 핵심 엔드포인트.
    $user = function_exists('authKycEndpoint') ? authKycEndpoint() : authMfaRequired();
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
        // (2026-05-26 v855) 정책 완화 — status_overall 이 명시적 APPROVED 면
        //   didit 관리자의 최종 세션 결정으로 신뢰하고 개별 idv_status warning
        //   은 무시. 운영자 보고: didit 대시보드에서 In Review → Approved 로
        //   수동 승인했는데 ID VERIFICATION 의 individual warning (orange !)
        //   이 남아있어 우리 사이트가 anyReview=true 로 차단 → kyc_yn='Y'
        //   영영 안 됨.
        //
        //   v570 의 원래 우려 (idv 만 APPROVED + session 'In Review' 인 상태에서
        //   자동 통과) 는 여전히 차단됨 — status_overall 이 review-like 면
        //   isApprovedDiditStatus($ex['status_overall']) 자체가 false 라서
        //   $approved=false. status_overall 이 명시적 APPROVED 일 때만 승인.
        //
        //   anyReview 는 status_overall 이 review-like 인지만 보고 in_review
        //   응답 분기에 계속 사용 (아래 if (!$approved) { if ($anyReview)... }).
        $anyReview = isReviewLike($ex['status_overall']);
        $approved = isApprovedDiditStatus($ex['status_overall']);

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

        // (2026-05-23 v793) KYC 완료 → 해당 wallet 의 모든 미사용 핸드오프
        //   토큰 무효화. 1회용 enforcement. 핸드오프로 진행된 경우든 일반
        //   JWT 로 진행된 경우든 동일하게 정리한다.
        if (function_exists('kycHandoffMarkUsed')) {
            kycHandoffMarkUsed($address);
        }

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

// ====== KYC Handoff (인앱 → 일반 브라우저 전환) ======
//
// (2026-05-23 v793) Phantom/MetaMask/카카오톡 등 인앱 브라우저에서는 didit.me
//   카메라/iframe 흐름이 지원되지 않아 KYC 진행이 불가능. 인앱 사용자가 일반
//   Chrome/Safari/Samsung Internet 으로 KYC 만 잠시 옮겨가 진행하도록 단기
//   유효 토큰을 발급. 토큰을 받은 일반 브라우저는 지갑 연결 없이도 해당
//   wallet 의 KYC 흐름을 진행 가능.
//
// 흐름:
//   1) Phantom 인앱 (지갑 연결 + MFA 완료) → POST /api/kyc/handoff/create
//      → 32바이트 랜덤 토큰 발급, DB 저장 (TTL 10분)
//   2) 인앱 화면에 https://...kyc-certification.html?kyc_token=XXX 표시
//   3) 사용자가 일반 브라우저에 URL 붙여넣기
//   4) 일반 브라우저 페이지 로드 시 GET /api/kyc/handoff/resolve?token=XXX
//      → 서버가 토큰 → wallet 주소 검증 후 반환
//   5) 일반 브라우저는 후속 KYC API 호출 시 X-Kyc-Handoff-Token 헤더로 인증
//   6) KYC 완료 (succ) 시 토큰 used_at 마킹 → 1회용

if (!function_exists('kycHandoffCleanupExpired')) {
    /**
     * 만료된 KYC 핸드오프 토큰 정리. 보존 정책: 만료 후 7일 지난 row 삭제.
     *   used_at 이 찍힌 사용 완료 row 도 동일 정책 적용 (audit 7일).
     */
    function kycHandoffCleanupExpired(): void {
        try {
            DB::execute(
                "DELETE FROM kyc_handoff_tokens
                 WHERE (expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY))
                    OR (used_at IS NOT NULL AND used_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY))"
            );
        } catch (Throwable $_) {}
    }
}

if (!function_exists('kycHandoffValidateToken')) {
    /**
     * 핸드오프 토큰 검증. 유효하면 wallet 주소 반환, 무효면 null.
     *   "유효" = 토큰 존재 + 미사용 + 미만료.
     */
    function kycHandoffValidateToken(string $token): ?array {
        $token = trim($token);
        if (!$token || !preg_match('/^[a-f0-9]{32,128}$/i', $token)) return null;

        $row = DB::fetchOne(
            "SELECT id, token, address, created_at, expires_at, used_at
               FROM kyc_handoff_tokens
              WHERE token = ?
              LIMIT 1",
            [$token]
        );
        if (!$row) return null;
        if (!empty($row['used_at'])) return null;

        try {
            $exp = new DateTimeImmutable($row['expires_at'], new DateTimeZone('UTC'));
            $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
            if ($now >= $exp) return null;
        } catch (Throwable $_) { return null; }

        return $row;
    }
}

if (!function_exists('kycHandoffMarkUsed')) {
    /**
     * 토큰 사용 완료 처리. KYC 'succ' 시 호출. 한 wallet 의 모든 미사용
     *   토큰을 한 번에 무효화 (다른 브라우저로 새로 발급한 토큰이 남아있어도
     *   같이 정리).
     */
    function kycHandoffMarkUsed(string $address, ?string $usedIp = null): void {
        try {
            DB::execute(
                "UPDATE kyc_handoff_tokens
                    SET used_at = UTC_TIMESTAMP(), used_ip = ?
                  WHERE address = ? AND used_at IS NULL",
                [$usedIp ?: getReqIp(), $address]
            );
        } catch (Throwable $_) {}
    }
}

if (!function_exists('authKycEndpoint')) {
    /**
     * KYC 엔드포인트 인증 헬퍼.
     *   1) 일반 JWT 인증 (authMfaRequired) 시도 → 성공하면 일반 흐름.
     *   2) JWT 없거나 실패 + X-Kyc-Handoff-Token 헤더 있음 → 핸드오프 토큰 검증.
     *      유효하면 ['address' => $addr, 'via' => 'kyc_handoff', ...] 반환.
     *
     * 반환 형식은 authMfaRequired 와 호환. 단, 핸드오프 모드에서는 일반 JWT
     *   세션처럼 다른 API 들을 호출할 수는 없다 (KYC 권한만).
     */
    function authKycEndpoint(): array {
        // 1) JWT 우선
        $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $hasJwt = str_starts_with($hdr, 'Bearer ');
        if ($hasJwt) {
            // 정상 JWT 흐름 — authMfaRequired() 가 401 발생 시 즉시 종료.
            return authMfaRequired();
        }

        // 2) 핸드오프 토큰
        $handoffToken = trim($_SERVER['HTTP_X_KYC_HANDOFF_TOKEN'] ?? '');
        if ($handoffToken) {
            $row = kycHandoffValidateToken($handoffToken);
            if (!$row) {
                jsonResponse([
                    'ok' => false,
                    'status' => 'kyc_handoff_invalid',
                    'message' => 'KYC handoff link is invalid or expired. Please re-open the original page and generate a new link.'
                ], 401);
            }
            $address = strtolower($row['address']);
            ensureUser($address);
            assertUserAccessAllowed($address);
            return [
                'address' => $address,
                'via' => 'kyc_handoff',
                'mfa' => true, // 발급 시점에 MFA 완료 사용자였음
                'handoff_token' => $row['token'],
                'handoff_expires_at' => $row['expires_at'],
            ];
        }

        // 3) 둘 다 없음 — 일반 인증 흐름으로 (401 발생)
        return authMfaRequired();
    }
}

/**
 * POST /api/kyc/handoff/create
 *   인앱 브라우저에서 호출. 일반 JWT 인증 필수 (지갑 연결 + MFA 완료).
 *   요청한 wallet 의 모든 기존 미사용 토큰 무효화 후 새 토큰 발급.
 *   응답: { token, expires_at, handoff_url, ttl_seconds }
 */
post('/api/kyc/handoff/create', function () {
    // 인앱에서만 발급되어야 하지만 서버에서는 UA 검증을 강제하지 않음
    //   (일반 브라우저에서도 발급 받아 다른 브라우저로 옮길 수 있게).
    //   대신 일반 인증 (지갑 연결 + MFA 통과) 은 필수.
    $user = authMfaRequired();
    $address = strtolower($user['address']);

    // 이미 KYC 완료된 유저면 불필요
    $u = getKycUser($address);
    if (strtoupper($u['kyc_yn'] ?? 'N') === 'Y') {
        jsonResponse([
            'ok' => false,
            'status' => 'already_verified',
            'message' => 'KYC is already verified.',
        ], 409);
    }

    // (2026-05-24 v814) 리뷰 진행 중 사용자는 핸드오프 토큰도 발급 차단.
    //   동일 정책: 리뷰 결과 확정 전엔 재시도 불가.
    if (kycIsInReview($address)) {
        $review = kycActiveReviewSession($address);
        jsonResponse([
            'ok' => false,
            'status' => 'kyc_in_review',
            'message' => '이전 KYC 신청이 검토 중입니다. 결과가 나올 때까지 재신청은 차단됩니다.',
            'session_id' => $review['session_id'] ?? null,
            'didit_status' => $review['didit_status'] ?? null,
            'submitted_at' => $review['created_at'] ?? null,
        ], 409);
    }

    // 만료 토큰 cleanup (옵션, 가벼움)
    kycHandoffCleanupExpired();

    // (2026-05-24 v811) Phantom 에서 country + document_type 함께 전송 가능.
    //   두 값 모두 있으면 didit 세션을 미리 생성해서 토큰에 URL 저장 →
    //   Chrome 진입 시 즉시 didit 으로 redirect (폼 재선택 불필요).
    //   둘 중 하나라도 없으면 기존 흐름 (토큰만 발급, Chrome 에서 폼 표시).
    $body = getJsonBody();
    $reqDocType = sanitizeDocType($body['document_type'] ?? '');
    $reqCountry = trim($body['country'] ?? '');
    $wantsDiditPresession = ($reqDocType !== '' && $reqCountry !== '');

    // didit 세션 사전 생성 시 추가 검증
    $diditSessionId = null;
    $diditSessionUrl = null;
    if ($wantsDiditPresession) {
        // mt_name / mt_birth 없으면 didit 세션 못 만듦
        $storedName = trim(decodeMaybeB64($u['mt_name'] ?? null) ?? '');
        $storedBirth = normalizeBirth(decodeMaybeB64($u['mt_birth'] ?? null) ?? '');
        if (!$storedName || !$storedBirth) {
            jsonResponse([
                'ok' => false,
                'status' => 'need_basic_info',
                'message' => 'Please complete the Basic Info step first.'
            ], 409);
        }

        // 활성 pending 세션 재사용 (중복 didit 생성 방지)
        $existing = getLatestPendingKycSession($address);
        try {
            if ($existing && !empty($existing['session_url'])) {
                $diditStatus = $existing['didit_status'] ?? '';
                $createdAt = new DateTimeImmutable($existing['created_at'], new DateTimeZone('UTC'));
                $ageSec = time() - $createdAt->getTimestamp();
                $maxSec = isReviewLike($diditStatus) ? KYC_REVIEW_MAX_SEC : KYC_STUCK_MAX_SEC;
                if (isPendingLike($diditStatus) && $ageSec <= $maxSec) {
                    $diditSessionId = $existing['session_id'];
                    $diditSessionUrl = $existing['session_url'];
                } else {
                    // 기존 세션 만료 처리
                    DB::execute(
                        "UPDATE kyc_sessions SET status='kyc_status_not_approved', fail_reason='expired_before_handoff', updated_at=? WHERE id=?",
                        [nowUtcSql(), $existing['id']]
                    );
                }
            }
        } catch (Throwable $_) {}

        // 새 didit 세션 생성 (필요 시)
        if (!$diditSessionUrl && KYC_MODE !== 'auto') {
            try {
                $created = createDiditSession($address, $reqDocType, $storedName, $storedBirth, getReqIp());
                $diditSessionId = $created['sessionId'];
                $diditSessionUrl = $created['sessionUrl'];

                // kyc_sessions 에 등록 (정규 흐름과 동일)
                DB::execute(
                    "INSERT INTO kyc_sessions(session_id, address, doc_type, session_url, status, didit_status, stored_name, stored_birth, created_at, updated_at)
                     VALUES (?,?,?,?,?,?,?,?,?,?)
                     ON DUPLICATE KEY UPDATE address=VALUES(address), doc_type=VALUES(doc_type), session_url=VALUES(session_url),
                     status=VALUES(status), didit_status=VALUES(didit_status), stored_name=VALUES(stored_name), stored_birth=VALUES(stored_birth), updated_at=VALUES(updated_at)",
                    [
                        $created['sessionId'], $address, $reqDocType, $created['sessionUrl'],
                        'pending', $created['raw']['status'] ?? 'Not Started',
                        $storedName, $storedBirth, nowUtcSql(), nowUtcSql()
                    ]
                );
                DB::execute("UPDATE users SET kyc_session_id=?, kyc_status='pending' WHERE address=?", [$created['sessionId'], $address]);
            } catch (Throwable $e) {
                // didit 실패해도 토큰은 발급 — Chrome 에서 폼으로 fallback.
                error_log('[kyc-handoff] didit pre-session failed (continuing with form fallback): ' . $e->getMessage());
                $diditSessionId = null;
                $diditSessionUrl = null;
            }
        }
    }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        // 기존 미사용 토큰 모두 무효화 — 동일 wallet 에 대해서는 항상 1개만
        //   유효하도록 유지. (이전 발급 토큰이 노출된 경우 자동 차단)
        DB::execute(
            "UPDATE kyc_handoff_tokens
                SET used_at = UTC_TIMESTAMP(), used_ip = ?
              WHERE address = ? AND used_at IS NULL",
            [getReqIp() . ' (revoked-by-new)', $address]
        );

        // 새 토큰 생성 (32바이트 = 64자 hex)
        $token = bin2hex(random_bytes(32));
        $ttlSec = 600; // 10분
        $expiresAt = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
            ->modify("+{$ttlSec} seconds")
            ->format('Y-m-d H:i:s');

        DB::execute(
            "INSERT INTO kyc_handoff_tokens (token, address, expires_at, created_ip, didit_session_id, didit_session_url)
             VALUES (?, ?, ?, ?, ?, ?)",
            [$token, $address, $expiresAt, getReqIp(), $diditSessionId, $diditSessionUrl]
        );

        $pdo->commit();

        // 핸드오프 URL — 현재 요청 호스트 기준
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $baseUrl = $scheme . '://' . $host;
        if (defined('PUBLIC_BASE_URL') && PUBLIC_BASE_URL) {
            $baseUrl = rtrim(PUBLIC_BASE_URL, '/');
        }
        $handoffUrl = $baseUrl . '/user/kyc-certification.html?kyc_token=' . $token;

        jsonOk([
            'token' => $token,
            'expires_at' => $expiresAt,
            'ttl_seconds' => $ttlSec,
            'handoff_url' => $handoffUrl,
            'didit_session_id' => $diditSessionId,
            'didit_session_url' => $diditSessionUrl,
            'has_didit_presession' => !empty($diditSessionUrl),
        ]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError(500, '핸드오프 토큰 발급 실패: ' . $e->getMessage());
    }
});

/**
 * GET /api/kyc/handoff/resolve?token=XXX
 *   일반 브라우저에서 페이지 로드 시 호출. 인증 불필요 (토큰 자체가 인증).
 *   응답: { address, expires_at, ttl_remaining_seconds, masked_address }
 */
get('/api/kyc/handoff/resolve', function () {
    $token = trim($_GET['token'] ?? '');
    if (!$token) {
        jsonResponse([
            'ok' => false,
            'status' => 'kyc_handoff_missing_token',
            'message' => 'Token parameter required.'
        ], 400);
    }

    $row = kycHandoffValidateToken($token);
    if (!$row) {
        jsonResponse([
            'ok' => false,
            'status' => 'kyc_handoff_invalid',
            'message' => 'KYC handoff link is invalid, used, or expired. Please re-open the original page in your wallet browser and generate a new link.'
        ], 401);
    }

    $address = strtolower($row['address']);
    $expiresAt = $row['expires_at'];

    // TTL 잔여
    try {
        $exp = new DateTimeImmutable($expiresAt, new DateTimeZone('UTC'));
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $ttlRemaining = max(0, $exp->getTimestamp() - $now->getTimestamp());
    } catch (Throwable $_) {
        $ttlRemaining = 0;
    }

    // 마스킹된 주소 (UI 표시용, 전체 주소는 노출 안 함)
    $masked = strlen($address) > 10
        ? substr($address, 0, 4) . '...' . substr($address, -4)
        : $address;

    // (v811) didit 사전 세션 URL 이 있으면 Chrome 이 즉시 redirect 가능
    $diditSessionUrl = trim((string)($row['didit_session_url'] ?? ''));
    $diditSessionId = trim((string)($row['didit_session_id'] ?? ''));

    jsonOk([
        'address' => $address, // 페이지 내 KYC 흐름에 필요
        'masked_address' => $masked,
        'expires_at' => $expiresAt,
        'ttl_remaining_seconds' => $ttlRemaining,
        'didit_session_url' => $diditSessionUrl ?: null,
        'didit_session_id' => $diditSessionId ?: null,
    ]);
});

/**
 * POST /api/kyc/handoff/revoke
 *   (옵션) Phantom 인앱에서 사용자가 "취소" 누르면 토큰 즉시 무효화.
 *   인증: 일반 JWT 또는 핸드오프 토큰 둘 다 허용.
 */
post('/api/kyc/handoff/revoke', function () {
    $address = null;

    // JWT 우선
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($hdr, 'Bearer ')) {
        try {
            $user = authMfaRequired();
            $address = strtolower($user['address']);
        } catch (Throwable $_) {}
    }

    // 핸드오프 토큰 폴백
    if (!$address) {
        $handoffToken = trim($_SERVER['HTTP_X_KYC_HANDOFF_TOKEN'] ?? '');
        if ($handoffToken) {
            $row = kycHandoffValidateToken($handoffToken);
            if ($row) $address = strtolower($row['address']);
        }
    }

    if (!$address) {
        jsonResponse(['ok' => false, 'status' => 'unauthorized'], 401);
    }

    kycHandoffMarkUsed($address);
    jsonOk(['revoked' => true]);
});
