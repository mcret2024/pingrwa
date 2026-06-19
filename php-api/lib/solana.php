<?php
/**
 * RWA Platform - Solana Helpers (PHP)
 *
 * NOTE: Full Solana transaction building/signing requires the @solana/web3.js equivalent.
 * PHP handles: ed25519 signature verification, base58 encode/decode, address validation.
 * For on-chain transaction submission (deposit verify, withdraw send), we use JSON-RPC calls.
 */

// ====== Base58 Encoding/Decoding ======
function base58Encode(string $bytes): string {
    $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    $base = strlen($alphabet);

    $num = gmp_import($bytes, 1, GMP_BIG_ENDIAN);
    $encoded = '';
    while (gmp_cmp($num, 0) > 0) {
        [$num, $rem] = gmp_div_qr($num, $base);
        $encoded = $alphabet[gmp_intval($rem)] . $encoded;
    }

    // Leading zeros
    for ($i = 0; $i < strlen($bytes); $i++) {
        if (ord($bytes[$i]) !== 0) break;
        $encoded = '1' . $encoded;
    }

    return $encoded ?: '1';
}

function base58Decode(string $encoded): string {
    $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    $base = strlen($alphabet);

    $num = gmp_init(0);
    for ($i = 0; $i < strlen($encoded); $i++) {
        $pos = strpos($alphabet, $encoded[$i]);
        if ($pos === false) throw new RuntimeException("Invalid base58 character: {$encoded[$i]}");
        $num = gmp_add(gmp_mul($num, $base), $pos);
    }

    $bytes = gmp_export($num, 1, GMP_BIG_ENDIAN) ?: '';

    // Leading zeros
    $leadingZeros = 0;
    for ($i = 0; $i < strlen($encoded); $i++) {
        if ($encoded[$i] !== '1') break;
        $leadingZeros++;
    }

    return str_repeat("\x00", $leadingZeros) . $bytes;
}

// ====== Solana Address Validation ======
function isValidSolanaAddress(string $address): bool {
    try {
        $bytes = base58Decode($address);
        return strlen($bytes) === 32;
    } catch (Throwable) {
        return false;
    }
}

function normalizeSolanaAddress(string $address, string $label = '지갑주소'): string {
    $s = trim($address);
    if ($s === '') {
        throw new RuntimeException("{$label}가 필요합니다.");
    }
    if (!isValidSolanaAddress($s)) {
        throw new RuntimeException("{$label} 형식이 올바르지 않습니다.");
    }
    return $s;
}

// ====== Ed25519 Signature Verification ======
function verifySolanaMessageSignature(string $address, string $message, string $signatureBase64): bool {
    $pk = base58Decode($address);
    if (strlen($pk) !== 32) return false;

    $msgBytes = $message; // UTF-8 string
    $sigBytes = base64_decode($signatureBase64, true);
    if (!$sigBytes || strlen($sigBytes) !== 64) return false;

    return sodium_crypto_sign_verify_detached($sigBytes, $msgBytes, $pk);
}

// ====== Solana RPC Helper ======
function normalizeSolanaNetworkName(?string $value): string {
    $net = strtolower(trim((string)$value));
    if ($net === 'mainnet') return 'mainnet-beta';
    if ($net === 'mainnet-beta') return 'mainnet-beta';
    if ($net === 'testnet') return 'testnet';
    return 'devnet';
}

function getConfiguredSolanaNetwork(): string {
    try {
        return normalizeSolanaNetworkName(getSetting('solana_network', 'devnet') ?? 'devnet');
    } catch (Throwable $e) {
        return 'devnet';
    }
}

function getDefaultSolanaRpcUrl(string $network): string {
    $net = normalizeSolanaNetworkName($network);
    if ($net === 'mainnet-beta') return 'https://api.mainnet-beta.solana.com';
    if ($net === 'testnet') return 'https://api.testnet.solana.com';
    return 'https://api.devnet.solana.com';
}

function inferSolanaNetworkFromRpcUrl(string $url): ?string {
    $u = strtolower(trim($url));
    if ($u === '') return null;
    if (strpos($u, 'devnet') !== false) return 'devnet';
    if (strpos($u, 'testnet') !== false) return 'testnet';
    if (strpos($u, 'mainnet') !== false || strpos($u, 'mainnet-beta') !== false) return 'mainnet-beta';
    return null;
}

/**
 * (2026-06-07 v862) 우선순위에 따라 실제 사용 RPC URL + 출처를 반환.
 *
 *   1) DB setting `solana_rpc_url`         → source='db_override'
 *   2) 네트워크별 env 키                    → source='env_mainnet' / 'env_devnet' / 'env_testnet'
 *      (HELIUS_RPC_URL_MAINNET / DEVNET / TESTNET)
 *   3) Legacy 단일 env HELIUS_RPC_URL      → source='env_legacy'
 *      (네트워크 inference 통과 시만)
 *   4) Solana 공식 public RPC              → source='public_default'
 *
 * 정상 운영 경로는 (2). silica.env 에 devnet/mainnet 두 키를 모두 보관해두고
 * admin 패널의 네트워크 토글만으로 안전하게 전환한다. (1) 은 응급 override.
 *
 * 재발 방지: solana_network=devnet 인데 mainnet HELIUS 를 그대로 쓰면
 * 관리자 토큰 출금/블록해시/입출금 검증이 다른 체인으로 가는 회귀가 생긴다.
 */
function getEffectiveRpcUrlWithSource(): array {
    $network = getConfiguredSolanaNetwork();

    try {
        $dbUrl = trim((string)(getSetting('solana_rpc_url', '') ?? ''));
        if ($dbUrl !== '') return ['url' => $dbUrl, 'source' => 'db_override', 'network' => $network];
    } catch (Throwable $e) {
        // ignore
    }

    // (2) 네트워크별 env 키 — admin 패널 선택값에 정확히 매핑.
    if ($network === 'mainnet-beta') {
        $netSpecific = trim((string)HELIUS_RPC_URL_MAINNET);
        if ($netSpecific !== '') return ['url' => $netSpecific, 'source' => 'env_mainnet', 'network' => $network];
    } elseif ($network === 'testnet') {
        $netSpecific = trim((string)HELIUS_RPC_URL_TESTNET);
        if ($netSpecific !== '') return ['url' => $netSpecific, 'source' => 'env_testnet', 'network' => $network];
    } else { // devnet
        $netSpecific = trim((string)HELIUS_RPC_URL_DEVNET);
        if ($netSpecific !== '') return ['url' => $netSpecific, 'source' => 'env_devnet', 'network' => $network];
    }

    // (3) Legacy 단일 env — URL 패턴에서 추론한 네트워크가 현재 설정과
    //     일치할 때만 사용. 기존 배포 환경(.env 키 한 개만 있는 경우) 호환용.
    $envUrl = trim((string)HELIUS_RPC_URL);
    if ($envUrl !== '') {
        $envNetwork = inferSolanaNetworkFromRpcUrl($envUrl);
        if ($envNetwork === null || $envNetwork === $network) {
            return ['url' => $envUrl, 'source' => 'env_legacy', 'network' => $network];
        }
        error_log('[solanaRpc] Ignoring legacy HELIUS_RPC_URL because configured network=' . $network . ' but env rpc looks like ' . $envNetwork . '. Tip: 새 운영 흐름에서는 HELIUS_RPC_URL_MAINNET / HELIUS_RPC_URL_DEVNET 를 사용하세요.');
    }

    return ['url' => getDefaultSolanaRpcUrl($network), 'source' => 'public_default', 'network' => $network];
}

function getEffectiveRpcUrl(): string {
    return getEffectiveRpcUrlWithSource()['url'];
}

/**
 * (2026-06-07 v863) Solana RPC 연결 상태 검사 — admin 화면에 표시.
 *
 * `getHealth` 는 가장 가벼운 RPC 메서드(노드 동기화 여부만 반환). 빠른 검사용.
 *   - 성공: 'ok' (Solana node 정상 응답)
 *   - 실패: HTTP error, timeout, JSON-RPC error 등 → 'error'
 *
 * Returns:
 *   [
 *     'status' => 'ok' | 'error',
 *     'message' => '활성화 (API 연결됨)' | '연결 오류: ...',
 *     'latency_ms' => int|null,
 *     'http_code' => int|null,
 *   ]
 */
function checkSolanaRpcHealth(?string $url = null, int $timeoutSec = 5): array {
    $rpcUrl = $url ?? getEffectiveRpcUrl();
    if (trim((string)$rpcUrl) === '') {
        return [
            'status'     => 'error',
            'message'    => '연결 오류: RPC URL 미설정',
            'latency_ms' => null,
            'http_code'  => null,
        ];
    }

    $body = json_encode([
        'jsonrpc' => '2.0',
        'id'      => 1,
        'method'  => 'getHealth',
        'params'  => [],
    ]);

    $start = microtime(true);
    $ch = curl_init($rpcUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => $timeoutSec,
        CURLOPT_CONNECTTIMEOUT => max(2, intdiv($timeoutSec, 2)),
    ]);
    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);
    $latencyMs = (int)round((microtime(true) - $start) * 1000);

    if ($response === false || $response === '') {
        return [
            'status'     => 'error',
            'message'    => '연결 오류: ' . ($curlErr !== '' ? $curlErr : '응답 없음'),
            'latency_ms' => $latencyMs,
            'http_code'  => $httpCode ?: null,
        ];
    }
    if ($httpCode >= 400) {
        return [
            'status'     => 'error',
            'message'    => '연결 오류: HTTP ' . $httpCode,
            'latency_ms' => $latencyMs,
            'http_code'  => $httpCode,
        ];
    }
    $data = json_decode($response, true);
    if (!is_array($data)) {
        return [
            'status'     => 'error',
            'message'    => '연결 오류: JSON 파싱 실패',
            'latency_ms' => $latencyMs,
            'http_code'  => $httpCode,
        ];
    }
    if (isset($data['error'])) {
        $msg = (string)($data['error']['message'] ?? 'JSON-RPC 오류');
        return [
            'status'     => 'error',
            'message'    => '연결 오류: ' . $msg,
            'latency_ms' => $latencyMs,
            'http_code'  => $httpCode,
        ];
    }
    // Solana 정상 응답: result === 'ok'
    return [
        'status'     => 'ok',
        'message'    => '활성화 (API 연결됨, ' . $latencyMs . 'ms)',
        'latency_ms' => $latencyMs,
        'http_code'  => $httpCode,
    ];
}

function getEffectiveUsdtMint(): string {
    try {
        $dbMint = getSetting('solana_usdt_mint', '') ?? '';
        if ($dbMint) return $dbMint;
    } catch (Throwable $e) {}
    return USDT_MINT;
}

function solanaRpcSingle(string $rpcUrl, string $method, array $params = []) {
    $body = json_encode([
        'jsonrpc' => '2.0',
        'id'      => 1,
        'method'  => $method,
        'params'  => $params,
    ]);

    $ch = curl_init($rpcUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$response || $httpCode >= 400) {
        throw new RuntimeException("Solana RPC 호출 실패 (HTTP $httpCode, url=" . parse_url($rpcUrl, PHP_URL_HOST) . ")");
    }

    $data = json_decode($response, true);
    if (isset($data['error'])) {
        throw new RuntimeException('Solana RPC 오류: ' . ($data['error']['message'] ?? json_encode($data['error'])));
    }

    return $data['result'] ?? null;
}

function getSolanaFallbackRpcUrls(string $network): array {
    // 공용 백업 RPC 목록 — primary 실패 시 순차 시도.
    // 목적: devnet/mainnet 기본 RPC가 rate-limit/일시 장애일 때 deposit 검증 실패로
    // 사용자 지갑에서 차감된 금액이 UI에 반영되지 않는 사고를 막는다.
    // 주의: ankr.com은 2024년 이후 API 키 필수화 → 제거.
    $net = normalizeSolanaNetworkName($network);
    if ($net === 'mainnet-beta') {
        return [
            'https://api.mainnet-beta.solana.com',
            'https://solana-rpc.publicnode.com',
        ];
    }
    if ($net === 'testnet') {
        return [
            'https://api.testnet.solana.com',
        ];
    }
    return [
        'https://api.devnet.solana.com',
    ];
}

/**
 * Solana signed transaction (base64)에서 첫 번째 서명(= txid) 추출.
 * 구조: [compact-u16 sig_count][sig_1 64B][sig_2 64B]...[tx_body]
 * 단일 서명자 케이스는 sig_count=1이 1바이트로 인코딩됨.
 *
 * "already been processed" 에러 발생 시, 이 함수로 txid를 복원하여
 * 이미 체인에 올라간 트랜잭션을 정상 검증 경로로 넘긴다.
 */
function extractTxidFromSignedTx(string $base64Tx): ?string {
    $bytes = base64_decode($base64Tx, true);
    if ($bytes === false || strlen($bytes) < 65) return null;

    // compact-u16 디코딩 (서명 개수) — 대부분의 deposit tx는 단일 서명자
    $firstByte = ord($bytes[0]);
    if ($firstByte < 1) return null;
    // 0x80 이상이면 2바이트 인코딩이지만, 실전에서는 서명자 수가 127 이하이므로 1바이트로 충분
    if ($firstByte >= 0x80) return null;

    $sig = substr($bytes, 1, 64);
    if (strlen($sig) !== 64) return null;

    try {
        return base58Encode($sig);
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * (2026-05-07) Solana signed transaction (base64) 의 fee-payer 주소 추출.
 *
 * Wire format (legacy):
 *   [compact-u16 sig_count] [sig_1..sig_n × 64B]
 *   [3B message_header] [compact-u16 key_count]
 *   [account_keys × 32B each]
 *   ...
 *
 * Versioned (v0) tx 는 message_header 앞에 1B version flag (>= 0x80) 가 있다.
 *
 * Fee-payer = account_keys[0] 의 32B 를 base58 인코딩한 값.
 *
 * 보안 사용처: /api/deposit/submit 에서 signedTx 의 fee-payer 가 로그인된
 *              wallet 주소와 일치하는지 검증해 다른 사용자의 입금 거래를
 *              가로채 자기 잔액으로 INSERT 하는 공격 차단.
 */
function decodeCompactU16(string $bytes, int $offset): array {
    if ($offset >= strlen($bytes)) return [null, 0];
    $b1 = ord($bytes[$offset]);
    if (($b1 & 0x80) === 0) return [$b1, 1];
    if ($offset + 1 >= strlen($bytes)) return [null, 0];
    $b2 = ord($bytes[$offset + 1]);
    if (($b2 & 0x80) === 0) {
        return [($b1 & 0x7f) | ($b2 << 7), 2];
    }
    if ($offset + 2 >= strlen($bytes)) return [null, 0];
    $b3 = ord($bytes[$offset + 2]);
    return [($b1 & 0x7f) | (($b2 & 0x7f) << 7) | ($b3 << 14), 3];
}

function extractFeePayerFromSignedTx(string $base64Tx): ?string {
    $bytes = base64_decode($base64Tx, true);
    if ($bytes === false || strlen($bytes) < 100) return null;

    $offset = 0;

    // 1) signature count (compact-u16) + signatures × 64B
    [$sigCount, $sigCountSize] = decodeCompactU16($bytes, $offset);
    if ($sigCount === null || $sigCount < 1 || $sigCount > 32) return null;
    $offset += $sigCountSize;
    $offset += $sigCount * 64;
    if ($offset >= strlen($bytes)) return null;

    // 2) versioned tx 플래그 — 첫 바이트 MSB 가 1이면 versioned (v0+).
    //    legacy 면 첫 바이트 < 0x80, v0 면 0x80.
    $first = ord($bytes[$offset]);
    if (($first & 0x80) !== 0) {
        $offset += 1; // skip version byte
    }

    // 3) message header — 3 bytes (numRequiredSigs, numReadOnlySigned, numReadOnlyUnsigned)
    if ($offset + 3 > strlen($bytes)) return null;
    $offset += 3;

    // 4) account keys count (compact-u16)
    [$keyCount, $keyCountSize] = decodeCompactU16($bytes, $offset);
    if ($keyCount === null || $keyCount < 1 || $keyCount > 64) return null;
    $offset += $keyCountSize;

    // 5) first 32B = fee_payer
    if ($offset + 32 > strlen($bytes)) return null;
    $feePayerBytes = substr($bytes, $offset, 32);
    if (strlen($feePayerBytes) !== 32) return null;

    try {
        return base58Encode($feePayerBytes);
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * (2026-05-26 v825) Solana signed transaction (base64) 의 전체 instruction 파싱.
 *
 * 반환값:
 *   [
 *     'fee_payer'  => 'base58 address',
 *     'account_keys' => ['addr1', 'addr2', ...],   // 32B → base58
 *     'instructions' => [
 *       [
 *         'program_id' => 'base58 program id',
 *         'accounts'   => ['addr1', ...],          // resolved via account_keys
 *         'data'       => 'binary string',         // raw instruction data
 *       ], ...
 *     ],
 *   ]
 *
 * 실패 시 null. 입금 hijacking 방어 (v825) 의 핵심 — broadcast 전에
 * 이 결과를 validateDepositTransactionStructure() 에 넘겨 검증한다.
 */
function parseSignedTransaction(string $base64Tx): ?array {
    $bytes = base64_decode($base64Tx, true);
    if ($bytes === false || strlen($bytes) < 100) return null;

    $offset = 0;
    $len = strlen($bytes);

    // 1) signature count + signatures × 64B
    [$sigCount, $sigCountSize] = decodeCompactU16($bytes, $offset);
    if ($sigCount === null || $sigCount < 1 || $sigCount > 32) return null;
    $offset += $sigCountSize + $sigCount * 64;
    if ($offset >= $len) return null;

    // 2) versioned (v0+) flag
    $first = ord($bytes[$offset]);
    if (($first & 0x80) !== 0) {
        $offset += 1;
    }

    // 3) message header (3 bytes)
    if ($offset + 3 > $len) return null;
    $offset += 3;

    // 4) account keys
    [$keyCount, $keyCountSize] = decodeCompactU16($bytes, $offset);
    if ($keyCount === null || $keyCount < 1 || $keyCount > 64) return null;
    $offset += $keyCountSize;
    if ($offset + 32 * $keyCount > $len) return null;

    $accountKeys = [];
    for ($i = 0; $i < $keyCount; $i++) {
        $kb = substr($bytes, $offset, 32);
        $offset += 32;
        if (strlen($kb) !== 32) return null;
        try {
            $accountKeys[] = base58Encode($kb);
        } catch (Throwable $e) {
            return null;
        }
    }

    // 5) recent blockhash (32B) — skip
    if ($offset + 32 > $len) return null;
    $offset += 32;

    // 6) instructions
    [$ixCount, $ixCountSize] = decodeCompactU16($bytes, $offset);
    if ($ixCount === null || $ixCount < 0 || $ixCount > 64) return null;
    $offset += $ixCountSize;

    $instructions = [];
    for ($i = 0; $i < $ixCount; $i++) {
        // 6a) program_id_index (1B)
        if ($offset + 1 > $len) return null;
        $programIdIndex = ord($bytes[$offset]);
        $offset += 1;
        if (!isset($accountKeys[$programIdIndex])) return null;
        $programId = $accountKeys[$programIdIndex];

        // 6b) accounts count + indices
        [$acctCount, $acctCountSize] = decodeCompactU16($bytes, $offset);
        if ($acctCount === null || $acctCount < 0 || $acctCount > 32) return null;
        $offset += $acctCountSize;
        if ($offset + $acctCount > $len) return null;

        $ixAccounts = [];
        for ($j = 0; $j < $acctCount; $j++) {
            $idx = ord($bytes[$offset]);
            $offset += 1;
            if (!isset($accountKeys[$idx])) return null;
            $ixAccounts[] = $accountKeys[$idx];
        }

        // 6c) data length + data
        [$dataLen, $dataLenSize] = decodeCompactU16($bytes, $offset);
        if ($dataLen === null || $dataLen < 0 || $dataLen > 2048) return null;
        $offset += $dataLenSize;
        if ($offset + $dataLen > $len) return null;
        $data = substr($bytes, $offset, $dataLen);
        $offset += $dataLen;

        $instructions[] = [
            'program_id' => $programId,
            'accounts'   => $ixAccounts,
            'data'       => $data,
        ];
    }

    return [
        'fee_payer'    => $accountKeys[0] ?? null,
        'account_keys' => $accountKeys,
        'instructions' => $instructions,
    ];
}

/**
 * (2026-05-26 v825) Deposit hijacking 방어 — signed tx 구조 검증.
 *
 * 허용 instruction 만 존재해야 함:
 *   1) MEMO_PROGRAM_ID — 검증 안 함 (선택)
 *   2) ASSOCIATED_TOKEN_PROGRAM_ID — discriminator 0x01 (createIdempotent) 만 허용,
 *      그 외 (0x00 = create, etc.) 거부
 *   3) TOKEN_PROGRAM_ID — discriminator 0x0c (transferChecked) 만 허용.
 *      transferChecked 는 정확히 1개여야 하며 destination/mint/amount/owner 검증.
 *
 * 그 외 instruction (다른 program_id) 이 하나라도 있으면 거부.
 *
 * 반환값: ['ok' => bool, 'reason' => string, 'amount_raw' => int (validated transferChecked amount)]
 *
 * 사용처: /api/deposit/submit 에서 sendRawTransaction() 호출 전에 호출.
 */
function validateDepositTransactionStructure(
    array $parsed,
    string $expectedFeePayer,
    string $expectedMint,
    string $expectedAdminWallet,
    ?int $expectedAmountRaw = null,
    ?int $expectedDecimals = null
): array {
    // (2026-06-07 v869) reject 가 reason + detail (expected/actual) 을 함께 반환.
    //   운영자가 자주 만나는 거부 케이스 (mint/ATA/decimals/amount mismatch) 의
    //   원인을 한눈에 파악하도록 강화. detail 은 deposit_withdraw.php 가 응답에
    //   그대로 forward → frontend 가 진단 모달로 표시.
    $reject = function (string $why, array $detail = []) {
        return ['ok' => false, 'reason' => $why, 'detail' => $detail, 'amount_raw' => 0];
    };

    if (!isset($parsed['fee_payer'], $parsed['instructions'])) {
        return $reject('parse_failed', [
            'has_fee_payer' => isset($parsed['fee_payer']),
            'has_instructions' => isset($parsed['instructions']),
        ]);
    }
    if ($parsed['fee_payer'] !== $expectedFeePayer) {
        return $reject('fee_payer_mismatch', [
            'expected_fee_payer' => $expectedFeePayer,
            'actual_fee_payer'   => $parsed['fee_payer'],
        ]);
    }

    // 서버가 *직접* admin ATA 를 derive — signed tx 의 destination 과 비교용
    try {
        $expectedAdminATA = findATA($expectedAdminWallet, $expectedMint);
    } catch (Throwable $e) {
        return $reject('admin_ata_derive_failed', [
            'expected_admin_wallet' => $expectedAdminWallet,
            'expected_mint'         => $expectedMint,
            'error'                 => $e->getMessage(),
        ]);
    }

    $transferCount = 0;
    $validatedAmount = 0;

    foreach ($parsed['instructions'] as $ix) {
        $pid = $ix['program_id'];
        $data = $ix['data'];
        $accts = $ix['accounts'];

        if ($pid === MEMO_PROGRAM_ID) {
            // memo 는 자유 — 내용 검증 없음, 길이만 sanity check
            if (strlen($data) > 256) return $reject('memo_too_long', ['memo_length' => strlen($data)]);
            continue;
        }

        // (2026-05-26 v852) ComputeBudget — wallet 이 자동 추가하는 priority fee /
        //   compute unit 설정. 자금 이동 없음, 위변조 자체가 무의미.
        if (defined('COMPUTE_BUDGET_PROGRAM_ID') && $pid === COMPUTE_BUDGET_PROGRAM_ID) {
            // 길이만 sanity check (정상 instruction 은 최대 ~10 bytes)
            if (strlen($data) > 32) return $reject('compute_budget_data_too_long', ['data_length' => strlen($data)]);
            continue;
        }

        // (2026-06-07 v872) Lighthouse — Phantom 지갑이 자동 삽입하는 assertion
        //   program. AssertAccountInfo / AssertTokenAccountField 등 read-only
        //   검증만 수행, 자금 이동 instruction 자체가 없음. 검증 실패 시 tx
        //   전체 revert. 안전하므로 화이트리스트 허용.
        //   data 길이만 sanity check (정상 assertion 은 최대 ~1KB).
        if (defined('LIGHTHOUSE_PROGRAM_ID') && $pid === LIGHTHOUSE_PROGRAM_ID) {
            if (strlen($data) > 2048) return $reject('lighthouse_data_too_long', ['data_length' => strlen($data)]);
            continue;
        }

        if ($pid === ASSOCIATED_TOKEN_PROGRAM_ID) {
            // discriminator: 1B at start of data
            //   0x01 = CreateIdempotent (deposit.js 가 쓰는 것)
            //   0x00 = Create (idempotent 아님, 이론적으론 OK 지만 deposit.js 와 불일치)
            //   그 외 = 거부
            $disc = strlen($data) > 0 ? ord($data[0]) : -1;
            if ($disc !== 1 && $disc !== 0) {
                return $reject('ata_program_unexpected_discriminator', ['discriminator' => $disc]);
            }
            // createIdempotent 의 accounts: [payer, ata, owner, mint, system_program, token_program, (rent_sysvar?)]
            if (count($accts) < 6) return $reject('ata_program_not_enough_accounts', ['account_count' => count($accts)]);
            // owner == expectedAdminWallet, mint == expectedMint, ata == expectedAdminATA 강제
            if ($accts[2] !== $expectedAdminWallet) {
                return $reject('ata_program_owner_mismatch', [
                    'expected_admin_wallet' => $expectedAdminWallet,
                    'actual_owner'          => $accts[2],
                    'hint' => 'admin 패널 → 설정 → 입금지갑 (deposit_admin_usdt_address) 과 frontend 가 사용한 admin 주소가 다릅니다.',
                ]);
            }
            if ($accts[3] !== $expectedMint) {
                return $reject('ata_program_mint_mismatch', [
                    'expected_mint' => $expectedMint,
                    'actual_mint'   => $accts[3],
                    'hint' => 'admin 패널의 USDT/STO/Silica mint 주소와 signed tx 의 mint 가 다릅니다. 운영자 mainnet/devnet 전환 시 mint 주소 미갱신 가능성.',
                ]);
            }
            if ($accts[1] !== $expectedAdminATA) {
                return $reject('ata_program_ata_mismatch', [
                    'expected_admin_ata' => $expectedAdminATA,
                    'actual_ata'         => $accts[1],
                ]);
            }
            continue;
        }

        // (v870) SPL Token + SPL Token 2022 동일 정책. Token 2022 는 instruction
        //   discriminator 가 SPL Token 과 동일 (transferChecked=0x0c) — 같은 검증 로직 적용.
        $isToken2022 = (defined('TOKEN_2022_PROGRAM_ID') && $pid === TOKEN_2022_PROGRAM_ID);
        if ($pid === TOKEN_PROGRAM_ID || $isToken2022) {
            // SPL Token program: instructions
            //   0x03 = Transfer (deprecated, no decimals check)
            //   0x0c (12) = TransferChecked  ← 유일 허용
            //   기타 (0x09 = closeAccount, 0x07 = mintTo, 0x04 = approve, etc.) → 거부
            $disc = strlen($data) > 0 ? ord($data[0]) : -1;
            if ($disc !== 12) {
                return $reject('token_program_disallowed_instruction', [
                    'discriminator' => $disc,
                    'program_id'    => $pid,
                    'is_token_2022' => $isToken2022,
                    'hint' => '입금은 transferChecked (0x0c=12) 만 허용. 0x03=Transfer (legacy) 도 거부.',
                ]);
            }

            // transferChecked accounts: [source_ATA, mint, dest_ATA, owner_signer]
            if (count($accts) < 4) return $reject('transferChecked_not_enough_accounts', ['account_count' => count($accts)]);
            $srcATA   = $accts[0];
            $mintAcct = $accts[1];
            $destATA  = $accts[2];
            $ownerAct = $accts[3];

            // data: [12: 1B][amount: 8B u64 LE][decimals: 1B]
            if (strlen($data) < 10) return $reject('transferChecked_data_short', ['data_length' => strlen($data)]);
            // u64 LE 디코딩
            $amountRaw = 0;
            for ($k = 7; $k >= 0; $k--) {
                $amountRaw = ($amountRaw << 8) | ord($data[1 + $k]);
            }
            // PHP int 는 64bit 환경에서 PHP_INT_MAX(=2^63-1) 까지 안전.
            // 토큰 발행 한도가 그 범위를 초과할 일은 없으니 안전.
            $decimals = ord($data[9]);

            // 4가지 핵심 검증 — 모두 통과해야 함
            if ($mintAcct !== $expectedMint) {
                return $reject('transferChecked_mint_mismatch', [
                    'expected_mint' => $expectedMint,
                    'actual_mint'   => $mintAcct,
                    'hint' => 'signed tx 가 사용한 mint 가 admin 설정의 mint 와 다릅니다. mainnet/devnet 전환 후 mint 주소 미갱신 가능성.',
                ]);
            }
            if ($destATA !== $expectedAdminATA) {
                return $reject('transferChecked_destination_not_admin_ata', [
                    'expected_admin_ata'    => $expectedAdminATA,
                    'actual_destination'    => $destATA,
                    'expected_admin_wallet' => $expectedAdminWallet,
                    'hint' => '입금이 admin 의 ATA 가 아닌 다른 주소로 향함. admin 입금지갑 주소가 정확히 설정됐는지 확인.',
                ]);
            }
            if ($ownerAct !== $expectedFeePayer) {
                return $reject('transferChecked_owner_not_fee_payer', [
                    'expected_owner_fee_payer' => $expectedFeePayer,
                    'actual_owner'             => $ownerAct,
                ]);
            }
            if ($srcATA === $destATA) {
                return $reject('transferChecked_self_transfer', [
                    'src_ata'  => $srcATA,
                    'dest_ata' => $destATA,
                ]);
            }

            if ($expectedDecimals !== null && $decimals !== $expectedDecimals) {
                return $reject('transferChecked_decimals_mismatch', [
                    'expected_decimals' => $expectedDecimals,
                    'actual_decimals'   => $decimals,
                    'hint' => 'USDT decimals 설정 (admin → 설정 → Solana → USDT 소수점) 과 signed tx 가 사용한 decimals 가 다릅니다.',
                ]);
            }
            if ($expectedAmountRaw !== null && $amountRaw !== $expectedAmountRaw) {
                return $reject('transferChecked_amount_mismatch', [
                    'expected_amount_raw' => $expectedAmountRaw,
                    'actual_amount_raw'   => $amountRaw,
                    'hint' => 'frontend 가 보낸 amount_raw 와 signed tx 안의 transfer 금액이 다릅니다. UI 표시 금액과 서명 금액의 swap 공격 차단.',
                ]);
            }
            if ($amountRaw <= 0) return $reject('transferChecked_amount_nonpositive', ['amount_raw' => $amountRaw]);

            $transferCount += 1;
            $validatedAmount = $amountRaw;
            continue;
        }

        // 그 외 program — 거부 (system program 까지도 거부하는 strict 정책)
        //   (v870) 운영자 진단용 — tx 안의 모든 instruction program_id 도 dump.
        $allProgramIds = array_values(array_unique(array_map(
            fn($x) => (string)($x['program_id'] ?? ''),
            $parsed['instructions']
        )));
        return $reject('disallowed_program', [
            'rejected_program_id'  => $pid,
            'all_tx_program_ids'   => $allProgramIds,
            'allowed_program_ids'  => [
                'memo'           => MEMO_PROGRAM_ID,
                'compute_budget' => defined('COMPUTE_BUDGET_PROGRAM_ID') ? COMPUTE_BUDGET_PROGRAM_ID : '(undef)',
                'lighthouse'     => defined('LIGHTHOUSE_PROGRAM_ID') ? LIGHTHOUSE_PROGRAM_ID : '(undef)',
                'spl_token'      => TOKEN_PROGRAM_ID,
                'spl_token_2022' => defined('TOKEN_2022_PROGRAM_ID') ? TOKEN_2022_PROGRAM_ID : '(undef)',
                'spl_ata'        => ASSOCIATED_TOKEN_PROGRAM_ID,
            ],
            'hint' => 'tx 안에 허용 목록 외의 program 이 포함됨. 위 allowed 목록 외의 program_id 가 어떤 것인지 비교하세요.',
        ]);
    }

    if ($transferCount !== 1) {
        return $reject('expected_exactly_one_transferChecked', [
            'transfer_count'  => $transferCount,
            'expected_count'  => 1,
            'hint' => 'signed tx 안에 transferChecked 가 정확히 1 개여야 합니다.',
        ]);
    }

    return ['ok' => true, 'reason' => '', 'detail' => [], 'amount_raw' => $validatedAmount];
}

function solanaRpc(string $method, array $params = []) {
    $primaryUrl = getEffectiveRpcUrl();
    $tried = [];
    $errors = [];

    $tryUrl = function (string $url) use ($method, $params, &$tried, &$errors) {
        if ($url === '' || in_array($url, $tried, true)) return null;
        $tried[] = $url;
        try {
            return solanaRpcSingle($url, $method, $params);
        } catch (Throwable $e) {
            $errors[] = parse_url($url, PHP_URL_HOST) . ':' . $e->getMessage();
            error_log('[solanaRpc] RPC failed (' . $url . '): ' . $e->getMessage());
            return null;
        }
    };

    // 1) primary
    $r = $tryUrl($primaryUrl);
    if ($r !== null) return $r;

    // 2) network-default fallback
    $network = getConfiguredSolanaNetwork();
    $r = $tryUrl(getDefaultSolanaRpcUrl($network));
    if ($r !== null) return $r;

    // 3) 추가 공용 fallback RPC들
    foreach (getSolanaFallbackRpcUrls($network) as $fb) {
        $r = $tryUrl($fb);
        if ($r !== null) return $r;
    }

    throw new RuntimeException('Solana RPC 호출 실패 (모든 endpoint 시도 실패: ' . implode(' | ', array_slice($errors, 0, 3)) . ')');
}

function getRecentBlockhash(): array {
    $result = solanaRpc('getLatestBlockhash', [['commitment' => 'confirmed']]);
    return [
        'blockhash'            => $result['value']['blockhash'] ?? '',
        'lastValidBlockHeight' => $result['value']['lastValidBlockHeight'] ?? 0,
    ];
}

function sendRawTransaction(string $base64Tx): string {
    try {
        $sig = solanaRpc('sendTransaction', [$base64Tx, [
            'encoding'            => 'base64',
            'skipPreflight'       => false,
            'preflightCommitment' => 'confirmed',
        ]]);
        return $sig;
    } catch (Throwable $e) {
        // "already been processed" — 이미 체인에 확정된 트랜잭션이라는 뜻.
        // 서명된 tx 의 첫 번째 서명이 곧 txid 이므로 복원해서 돌려준다.
        // (관리자가 Process Transfer 를 더블클릭/재시도 했거나, 첫 시도에서 RPC 응답이
        //  타임아웃됐지만 실제로는 체인에 올라간 케이스를 복구)
        $msg = (string)$e->getMessage();
        if (stripos($msg, 'already been processed') !== false
            || stripos($msg, 'already processed') !== false
            || stripos($msg, 'AlreadyProcessed') !== false) {
            $recovered = extractTxidFromSignedTx($base64Tx);
            if ($recovered) {
                error_log('[sendRawTransaction] tx already processed — recovered txid: ' . $recovered);
                return $recovered;
            }
        }
        throw $e;
    }
}

function getParsedTransaction(string $signature): ?array {
    return solanaRpc('getTransaction', [$signature, [
        'encoding'                       => 'jsonParsed',
        'commitment'                     => 'confirmed',
        'maxSupportedTransactionVersion' => 0,
    ]]);
}

function getParsedTxRetry(string $sig, int $tries = 12, int $delayMs = 700): ?array {
    for ($i = 0; $i < $tries; $i++) {
        $tx = null;
        try {
            $tx = getParsedTransaction($sig);
        } catch (Throwable) {
            // ignore and retry
        }
        if ($tx && isset($tx['meta'])) return $tx;
        usleep($delayMs * 1000);
    }
    return null;
}

// ====== ATA (Associated Token Account) derivation ======
/**
 * (2026-05-26 v853) ed25519 curve point check.
 *
 * Solana PDA 는 정의상 ed25519 curve 위에 있지 *않은* 점이어야 한다 (그래야
 * private key 가 존재하지 않아 PDA 가 서명 불가능). 옛 구현은 단순히 bump=255
 * hash 를 무조건 반환해 ~50% 확률로 on-curve 인 잘못된 ATA 를 돌려줬고, 그
 * 결과 v825 deposit 검증이 클라이언트의 정확한 ATA (Solana web3.js 의
 * findProgramAddressSync) 와 mismatch → ata_program_ata_mismatch 거부.
 *
 * libsodium 의 sodium_crypto_sign_ed25519_pk_to_curve25519 는 입력이 valid
 * ed25519 pubkey 일 때만 성공한다 (즉 curve 위에 있을 때). 따라서:
 *   throws → off-curve (valid PDA candidate)
 *   succeeds → on-curve (PDA 부적격, 다음 bump 시도)
 */
function isEd25519OnCurve(string $bytes): bool {
    if (strlen($bytes) !== 32) return false;
    if (!function_exists('sodium_crypto_sign_ed25519_pk_to_curve25519')) {
        // sodium 미설치 환경 — fallback. 호스팅에선 거의 항상 사용 가능.
        return true; // 안전쪽: on-curve 로 가정 → bump 시도 continue
    }
    try {
        @sodium_crypto_sign_ed25519_pk_to_curve25519($bytes);
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function findATA(string $ownerBase58, string $mintBase58): string {
    $ownerBytes = base58Decode($ownerBase58);
    $tokenProgramBytes = base58Decode(TOKEN_PROGRAM_ID);
    $mintBytes = base58Decode($mintBase58);
    $assocProgramBytes = base58Decode(ASSOCIATED_TOKEN_PROGRAM_ID);

    // PDA: sha256([owner, TOKEN_PROGRAM_ID, mint, bump, ASSOCIATED_TOKEN_PROGRAM_ID, "ProgramDerivedAddress"])
    // Seeds: [owner, TOKEN_PROGRAM_ID, mint]
    $seeds = $ownerBytes . $tokenProgramBytes . $mintBytes;

    // (2026-05-26 v853) 표준 findProgramAddress 알고리즘 구현.
    //   - bump 를 255 부터 0 까지 내려가며 시도
    //   - 각 bump 에서 sha256 으로 후보 주소 생성
    //   - 후보가 ed25519 curve 위에 있지 *않은* 경우만 유효한 PDA
    //   - 첫 번째 off-curve 결과를 ATA 로 반환
    for ($bump = 255; $bump >= 0; $bump--) {
        $hashInput = $seeds . chr($bump) . $assocProgramBytes . 'ProgramDerivedAddress';
        $hash = hash('sha256', $hashInput, true);
        if (!isEd25519OnCurve($hash)) {
            return base58Encode($hash);
        }
    }

    throw new RuntimeException('ATA derivation failed — all 256 bumps on-curve (statistically impossible)');
}

// ====== Admin withdraw keypair ======
function getWithdrawKeypair(): array {
    $raw = trim(env('ADMIN_WITHDRAW_KEYPAIR_JSON', ''));
    if (!$raw) throw new RuntimeException('ADMIN_WITHDRAW_KEYPAIR_JSON 설정이 없습니다.');
    $arr = json_decode($raw, true);
    if (!is_array($arr) || count($arr) < 64) throw new RuntimeException('ADMIN_WITHDRAW_KEYPAIR_JSON 길이 오류');

    $secretKey = '';
    foreach ($arr as $b) $secretKey .= chr((int)$b & 255);

    // Ed25519 keypair: first 32 bytes = seed, last 32 bytes = public key
    $publicKey = substr($secretKey, 32, 32);
    return [
        'secretKey' => $secretKey,
        'publicKey' => base58Encode($publicKey),
    ];
}

function getAdminWithdrawWalletAddress(): string {
    $withdrawRaw = trim(getSetting('withdraw_admin_usdt_address', '') ?? '');
    $depositRaw = trim(getSetting('deposit_admin_usdt_address', '') ?? '');
    $raw = $withdrawRaw !== '' ? $withdrawRaw : $depositRaw;

    if ($raw === '') throw new RuntimeException('관리자 출금지갑이 설정되어 있지 않습니다.');
    if (!isValidSolanaAddress($raw)) throw new RuntimeException('관리자 출금지갑 주소 형식이 올바르지 않습니다.');
    return $raw;
}

function getSolanaMintRuntimeInfo(string $mint): array {
    $mint = trim($mint);
    if ($mint === '') {
        throw new RuntimeException('민트 주소가 필요합니다.');
    }
    normalizeSolanaAddress($mint, '민트 주소');

    $out = [
        'mint' => $mint,
        'name' => null,
        'symbol' => null,
        'decimals' => null,
        'supply' => null,
        'ui_supply' => null,
        'source' => null,
    ];

    try {
        $res = solanaRpc('getAsset', [$mint]);
        $meta = $res['content']['metadata'] ?? [];
        $tokenInfo = $res['token_info'] ?? [];
        $out['name'] = trim((string)($meta['name'] ?? '')) ?: null;
        $out['symbol'] = trim((string)($meta['symbol'] ?? '')) ?: null;
        if (isset($tokenInfo['decimals']) && is_numeric($tokenInfo['decimals'])) {
            $out['decimals'] = (int)$tokenInfo['decimals'];
        }
        if (isset($tokenInfo['supply']) && is_numeric($tokenInfo['supply'])) {
            $out['supply'] = (float)$tokenInfo['supply'];
        }
        if (isset($tokenInfo['balance']) && is_numeric($tokenInfo['balance'])) {
            $out['ui_supply'] = (float)$tokenInfo['balance'];
        }
        $out['source'] = 'getAsset';
    } catch (Throwable $e) {
        // ignore and fall back
    }

    try {
        $sup = solanaRpc('getTokenSupply', [$mint]);
        $val = $sup['value'] ?? [];
        if ($out['decimals'] === null && isset($val['decimals']) && is_numeric($val['decimals'])) {
            $out['decimals'] = (int)$val['decimals'];
        }
        if ($out['supply'] === null && isset($val['amount']) && is_numeric($val['amount'])) {
            $out['supply'] = (float)$val['amount'];
        }
        if ($out['ui_supply'] === null && isset($val['uiAmount']) && is_numeric($val['uiAmount'])) {
            $out['ui_supply'] = (float)$val['uiAmount'];
        }
        if ($out['ui_supply'] === null && isset($val['uiAmountString']) && is_numeric($val['uiAmountString'])) {
            $out['ui_supply'] = (float)$val['uiAmountString'];
        }
        if ($out['source'] === null) $out['source'] = 'getTokenSupply';
    } catch (Throwable $e) {
        if ($out['source'] === null) {
            throw $e;
        }
    }

    return $out;
}
