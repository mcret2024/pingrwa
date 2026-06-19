<?php
// (2026-05-26 v825) Deposit hijacking 방어 검증기 시뮬레이션 테스트
require_once 'D:/ai/new_silica/silica/php-api/lib/config.php';
require_once 'D:/ai/new_silica/silica/php-api/lib/solana.php';

// === Test fixtures ===
$ADMIN_WALLET  = 'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu';
$ATTACKER_WALLET = base58Encode(str_repeat("\xDE", 32));
$MINT          = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Use bytes [1..32] as user wallet
$userBytes = '';
for ($i = 1; $i <= 32; $i++) $userBytes .= chr($i);
$USER_WALLET = base58Encode($userBytes);

$adminATA = findATA($ADMIN_WALLET, $MINT);
$userATA  = findATA($USER_WALLET, $MINT);
$attackerATA = findATA($ATTACKER_WALLET, $MINT);

echo "USER_WALLET    = $USER_WALLET\n";
echo "ADMIN_WALLET   = $ADMIN_WALLET\n";
echo "MINT           = $MINT\n";
echo "Admin ATA      = $adminATA\n";
echo "User ATA       = $userATA\n";
echo "Attacker ATA   = $attackerATA\n";
echo "---\n";

function encCu16($n) {
    if ($n < 0x80) return chr($n);
    if ($n < 0x4000) return chr(0x80 | ($n & 0x7f)) . chr(($n >> 7) & 0x7f);
    return chr(0x80 | ($n & 0x7f)) . chr(0x80 | (($n >> 7) & 0x7f)) . chr(($n >> 14) & 0x7f);
}

function encU64LE($n) {
    $out = '';
    for ($i = 0; $i < 8; $i++) { $out .= chr($n & 0xff); $n >>= 8; }
    return $out;
}

function buildTx($accountKeys, $instructions) {
    $sigCount = 1;
    $sigs = str_repeat("\xAA", 64);
    $msg = chr(1) . chr(0) . chr(0);
    $msg .= encCu16(count($accountKeys));
    foreach ($accountKeys as $k) $msg .= base58Decode($k);
    $msg .= str_repeat("\xBB", 32);
    $msg .= encCu16(count($instructions));
    foreach ($instructions as $ix) {
        $msg .= chr($ix['program_id_index']);
        $msg .= encCu16(count($ix['accounts_indices']));
        foreach ($ix['accounts_indices'] as $idx) $msg .= chr($idx);
        $msg .= encCu16(strlen($ix['data']));
        $msg .= $ix['data'];
    }
    return base64_encode(encCu16($sigCount) . $sigs . $msg);
}

$accountKeys = [
    $USER_WALLET,                       // 0: fee payer
    $userATA,                           // 1: source ATA
    $adminATA,                          // 2: dest ATA (admin)
    $ADMIN_WALLET,                      // 3: admin wallet
    $MINT,                              // 4: mint
    MEMO_PROGRAM_ID,                    // 5
    ASSOCIATED_TOKEN_PROGRAM_ID,        // 6
    TOKEN_PROGRAM_ID,                   // 7
    '11111111111111111111111111111111', // 8: system program
];

$amountRaw = 100 * 1000000;
$decimals = 6;

$ixMemo = ['program_id_index' => 5, 'accounts_indices' => [], 'data' => 'RWA_DEPOSIT_USDT|to:' . $ADMIN_WALLET];
$ixCreateATA = ['program_id_index' => 6, 'accounts_indices' => [0, 2, 3, 4, 8, 7], 'data' => chr(1)];
$ixTransferChecked = ['program_id_index' => 7, 'accounts_indices' => [1, 4, 2, 0], 'data' => chr(12) . encU64LE($amountRaw) . chr($decimals)];

$pass = 0; $fail = 0;
$check = function($name, $expected, $actual, $reason = '') use (&$pass, &$fail) {
    if ($expected === $actual) {
        echo "  [PASS] $name\n";
        $pass++;
    } else {
        echo "  [FAIL] $name — expected $expected got $actual" . ($reason ? " ($reason)" : '') . "\n";
        $fail++;
    }
};

// === Test 1: Good tx should validate OK ===
echo "Test 1 (good tx):\n";
$goodTx = buildTx($accountKeys, [$ixMemo, $ixCreateATA, $ixTransferChecked]);
$parsed = parseSignedTransaction($goodTx);
$check('parse ok', true, $parsed !== null);
$check('fee_payer correct', $USER_WALLET, $parsed['fee_payer'] ?? null);
$check('3 instructions', 3, count($parsed['instructions'] ?? []));
$r = validateDepositTransactionStructure($parsed, $USER_WALLET, $MINT, $ADMIN_WALLET, $amountRaw, $decimals);
$check('validation ok', true, $r['ok'], $r['reason']);
$check('amount_raw match', $amountRaw, $r['amount_raw']);

// === Test 2: Destination hijack ===
echo "Test 2 (destination = attacker ATA):\n";
$evilKeys = $accountKeys;
$evilKeys[2] = $attackerATA;
$evilTx = buildTx($evilKeys, [$ixMemo, $ixCreateATA, $ixTransferChecked]);
$parsed2 = parseSignedTransaction($evilTx);
$r2 = validateDepositTransactionStructure($parsed2, $USER_WALLET, $MINT, $ADMIN_WALLET, $amountRaw, $decimals);
$check('attack blocked', false, $r2['ok'], $r2['reason']);
echo "    reason: " . $r2['reason'] . "\n";

// === Test 3: Wrong mint ===
echo "Test 3 (wrong mint):\n";
$evilKeys3 = $accountKeys;
$evilKeys3[4] = base58Encode(str_repeat("\xCC", 32));
$evilTx3 = buildTx($evilKeys3, [$ixMemo, $ixCreateATA, $ixTransferChecked]);
$parsed3 = parseSignedTransaction($evilTx3);
$r3 = validateDepositTransactionStructure($parsed3, $USER_WALLET, $MINT, $ADMIN_WALLET, $amountRaw, $decimals);
$check('attack blocked', false, $r3['ok'], $r3['reason']);
echo "    reason: " . $r3['reason'] . "\n";

// === Test 4: Extra system program ix (try to also drain SOL) ===
echo "Test 4 (extra system program ix):\n";
$ixEvil = ['program_id_index' => 8, 'accounts_indices' => [0, 3], 'data' => chr(2) . encU64LE(1000000000)];
$evilTx4 = buildTx($accountKeys, [$ixMemo, $ixCreateATA, $ixTransferChecked, $ixEvil]);
$parsed4 = parseSignedTransaction($evilTx4);
$r4 = validateDepositTransactionStructure($parsed4, $USER_WALLET, $MINT, $ADMIN_WALLET, null, null);
$check('attack blocked', false, $r4['ok'], $r4['reason']);
echo "    reason: " . $r4['reason'] . "\n";

// === Test 5: Amount cross-check ===
echo "Test 5 (amount cross-check):\n";
$r5 = validateDepositTransactionStructure($parsed, $USER_WALLET, $MINT, $ADMIN_WALLET, $amountRaw + 1, $decimals);
$check('attack blocked', false, $r5['ok'], $r5['reason']);
echo "    reason: " . $r5['reason'] . "\n";

// === Test 6: Two transferChecked ===
echo "Test 6 (two transferChecked):\n";
$evilTx6 = buildTx($accountKeys, [$ixMemo, $ixCreateATA, $ixTransferChecked, $ixTransferChecked]);
$parsed6 = parseSignedTransaction($evilTx6);
$r6 = validateDepositTransactionStructure($parsed6, $USER_WALLET, $MINT, $ADMIN_WALLET, null, null);
$check('attack blocked', false, $r6['ok'], $r6['reason']);
echo "    reason: " . $r6['reason'] . "\n";

// === Test 7: Fee-payer mismatch ===
echo "Test 7 (fee-payer = different user):\n";
$evilKeys7 = $accountKeys;
$evilKeys7[0] = base58Encode(str_repeat("\xEE", 32));
$evilTx7 = buildTx($evilKeys7, [$ixMemo, $ixCreateATA, $ixTransferChecked]);
$parsed7 = parseSignedTransaction($evilTx7);
$r7 = validateDepositTransactionStructure($parsed7, $USER_WALLET, $MINT, $ADMIN_WALLET, null, null);
$check('attack blocked', false, $r7['ok'], $r7['reason']);
echo "    reason: " . $r7['reason'] . "\n";

// === Test 8: closeAccount (token program) — drain rent ===
echo "Test 8 (closeAccount ix instead of transferChecked):\n";
$ixClose = ['program_id_index' => 7, 'accounts_indices' => [1, 0, 0], 'data' => chr(9)]; // 9 = closeAccount
$evilTx8 = buildTx($accountKeys, [$ixMemo, $ixCreateATA, $ixClose]);
$parsed8 = parseSignedTransaction($evilTx8);
$r8 = validateDepositTransactionStructure($parsed8, $USER_WALLET, $MINT, $ADMIN_WALLET, null, null);
$check('attack blocked', false, $r8['ok'], $r8['reason']);
echo "    reason: " . $r8['reason'] . "\n";

// === Test 9: No instructions at all ===
echo "Test 9 (empty instructions):\n";
$emptyTx = buildTx($accountKeys, []);
$parsed9 = parseSignedTransaction($emptyTx);
$r9 = validateDepositTransactionStructure($parsed9, $USER_WALLET, $MINT, $ADMIN_WALLET, null, null);
$check('blocked (0 transferChecked)', false, $r9['ok'], $r9['reason']);
echo "    reason: " . $r9['reason'] . "\n";

// === Test 10: Garbage base64 ===
echo "Test 10 (garbage input):\n";
$parsedG = parseSignedTransaction(base64_encode("garbage"));
$check('parse returns null', null, $parsedG);

echo "\n=== SUMMARY: $pass pass / $fail fail ===\n";
exit($fail > 0 ? 1 : 0);
