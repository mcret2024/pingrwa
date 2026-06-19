<?php
/**
 * OTP routes: status, setup, enable, verify
 */

use OTPHP\TOTP;

get('/api/otp/status', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureUser($address);

    // If OTP is bypassed, always report as enabled + verified
    if (isOtpBypassed()) {
        jsonOk([
            'enabled'            => true,
            'verified'           => true,
            'locked'             => false,
            'lock_remaining_sec' => 0,
            'requires_setup'     => false,
            'requires_verify'    => false,
            'bypassed'           => true,
        ]);
        return;
    }

    $row = getUserOtpRow($address);
    $enabled = !empty($row['otp_enabled']) && !empty($row['otp_secret']);
    $locked = isOtpLocked($row);
    $lockRemainingSec = 0;
    if ($locked && $row['otp_locked_until']) {
        $t = new DateTimeImmutable($row['otp_locked_until'], new DateTimeZone('UTC'));
        $lockRemainingSec = max(0, $t->getTimestamp() - time());
    }

    $verified = $enabled && $user['mfa'];

    jsonOk([
        'enabled'            => $enabled,
        'verified'           => $verified,
        'locked'             => $locked,
        'lock_remaining_sec' => $lockRemainingSec,
        'requires_setup'     => !$enabled,
        'requires_verify'    => $enabled && !$verified,
    ]);
});

post('/api/otp/setup', function () {
    $user = authRequired();
    $address = $user['address'];
    ensureUser($address);

    if (isOtpBypassed()) {
        jsonOk(['issuer' => 'Recon RWA', 'account' => $address, 'secret_base32' => 'BYPASSED', 'otpauth_url' => '', 'qr_svg' => null, 'bypassed' => true]);
        return;
    }

    $row = getUserOtpRow($address);
    $enabled = !empty($row['otp_enabled']) && !empty($row['otp_secret']);
    if ($enabled) jsonError(400, '이미 OTP가 등록되어 있습니다.');
    if (isOtpLocked($row)) jsonError(429, 'OTP가 잠겨 있습니다. 잠시 후 다시 시도하세요.');

    $issuer = 'Recon RWA';
    $totp = TOTP::generate();
    $totp->setLabel($address);
    $totp->setIssuer($issuer);

    $secret = $totp->getSecret();

    DB::execute(
        "UPDATE users SET otp_temp_secret=?, otp_temp_created_at=? WHERE address=?",
        [$secret, nowUtcSql(), $address]
    );

    $otpauthUrl = $totp->getProvisioningUri();

    // Generate QR SVG if endroid/qr-code is available
    $qrSvg = null;
    try {
        $qrCode = \Endroid\QrCode\QrCode::create($otpauthUrl);
        $writer = new \Endroid\QrCode\Writer\SvgWriter();
        $result = $writer->write($qrCode);
        $qrSvg = $result->getString();
    } catch (Throwable) {}

    jsonOk([
        'issuer'        => $issuer,
        'account'       => $address,
        'secret_base32' => $secret,
        'otpauth_url'   => $otpauthUrl,
        'qr_svg'        => $qrSvg,
    ]);
});

post('/api/otp/enable', function () {
    $user = authRequired();
    $address = $user['address'];

    if (isOtpBypassed()) {
        $token = makeJwt($address, true);
        jsonOk(['token' => $token, 'mfa' => true, 'bypassed' => true]);
        return;
    }

    $body = getJsonBody();
    $otp = trim($body['otp'] ?? '');
    if (!preg_match('/^\d{6}$/', $otp)) jsonError(400, 'OTP 6자리가 필요합니다.');

    ensureUser($address);
    $row = getUserOtpRow($address);
    if (isOtpLocked($row)) jsonError(429, 'OTP가 잠겨 있습니다. 잠시 후 다시 시도하세요.');

    $enabled = !empty($row['otp_enabled']) && !empty($row['otp_secret']);
    if ($enabled) jsonError(400, '이미 OTP가 등록되어 있습니다.');

    $temp = trim($row['otp_temp_secret'] ?? '');
    if (!$temp) jsonError(400, 'OTP 등록 세션이 없습니다. 다시 등록을 시작하세요.');

    $totp = TOTP::createFromSecret($temp);
    if (!$totp->verify($otp, null, 1)) {
        bumpOtpFail($address);
        jsonError(401, 'OTP가 올바르지 않습니다.');
    }

    DB::execute(
        "UPDATE users SET otp_enabled=1, otp_secret=?, otp_temp_secret=NULL, otp_temp_created_at=NULL,
         otp_last_verified_at=?, otp_fail_count=0, otp_locked_until=NULL WHERE address=?",
        [$temp, nowUtcSql(), $address]
    );

    $token = makeJwt($address, true);
    jsonOk(['token' => $token, 'mfa' => true]);
});

post('/api/otp/verify', function () {
    $user = authRequired();
    $address = $user['address'];

    if (isOtpBypassed()) {
        $token = makeJwt($address, true);
        jsonOk(['token' => $token, 'mfa' => true, 'bypassed' => true]);
        return;
    }

    $body = getJsonBody();
    $otp = trim($body['otp'] ?? '');
    if (!preg_match('/^\d{6}$/', $otp)) jsonError(400, 'OTP 6자리가 필요합니다.');

    ensureUser($address);
    $row = getUserOtpRow($address);

    $enabled = !empty($row['otp_enabled']) && !empty($row['otp_secret']);
    if (!$enabled) jsonError(400, 'OTP가 등록되어 있지 않습니다. 먼저 등록하세요.');
    if (isOtpLocked($row)) jsonError(429, 'OTP가 잠겨 있습니다. 잠시 후 다시 시도하세요.');

    $secret = trim($row['otp_secret'] ?? '');
    $totp = TOTP::createFromSecret($secret);
    if (!$totp->verify($otp, null, 1)) {
        bumpOtpFail($address);
        jsonError(401, 'OTP가 올바르지 않습니다.');
    }

    DB::execute(
        "UPDATE users SET otp_last_verified_at=?, otp_fail_count=0, otp_locked_until=NULL WHERE address=?",
        [nowUtcSql(), $address]
    );

    $token = makeJwt($address, true);
    jsonOk(['token' => $token, 'mfa' => true]);
});
