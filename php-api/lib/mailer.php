<?php
/**
 * Simple mail sender — 호스팅어 공용 호스팅의 PHP mail() 함수 사용.
 *
 * 호스팅어 hPanel → Emails → Email Accounts에서 발송용 주소 생성
 * (예: noreply@rwa6.kolstoken.com) 후 DNS SPF 레코드 확인 권장.
 *
 * 실패 로그는 error_log()로 남고, 반환값은 성공 여부(bool).
 */

if (!function_exists('mailerSanitizeHeaderValue')) {
    function mailerSanitizeHeaderValue(string $s): string {
        // 헤더 인젝션 방지: CR/LF 제거
        return preg_replace('/[\r\n]+/', '', $s) ?? '';
    }
}

if (!function_exists('mailerEncodeSubject')) {
    function mailerEncodeSubject(string $subject): string {
        $subject = mailerSanitizeHeaderValue($subject);
        return '=?UTF-8?B?' . base64_encode($subject) . '?=';
    }
}

if (!function_exists('mailerEncodeName')) {
    function mailerEncodeName(string $name): string {
        $name = mailerSanitizeHeaderValue($name);
        if ($name === '') return '';
        // ASCII 영역만 있으면 그대로, 비ASCII가 있으면 base64 인코딩
        if (preg_match('/^[\x20-\x7E]+$/', $name)) {
            return '"' . str_replace('"', '', $name) . '"';
        }
        return '=?UTF-8?B?' . base64_encode($name) . '?=';
    }
}

if (!function_exists('sendMail')) {
    /**
     * 메일 발송.
     *
     * @param string $toEmail 수신자 주소
     * @param string $subject 제목 (UTF-8)
     * @param string $htmlBody HTML 본문
     * @param string|null $textBody 순수 텍스트 대체 본문 (optional)
     * @return bool 성공 여부
     */
    function sendMail(string $toEmail, string $subject, string $htmlBody, ?string $textBody = null): bool {
        $toEmail = trim($toEmail);
        if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
            error_log('[mailer] invalid to: ' . $toEmail);
            return false;
        }

        $fromEmail = MAIL_FROM;
        $fromName  = MAIL_FROM_NAME;
        if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
            error_log('[mailer] invalid from configured: ' . $fromEmail);
            return false;
        }

        $fromDisplay = mailerEncodeName($fromName);
        $fromHeader  = ($fromDisplay !== '' ? $fromDisplay . ' ' : '') . '<' . $fromEmail . '>';
        $boundary    = 'bnd_' . bin2hex(random_bytes(8));

        if ($textBody === null) {
            $textBody = trim(preg_replace('/\s+/', ' ', strip_tags($htmlBody)));
        }

        $headers = [
            'From: ' . $fromHeader,
            'Reply-To: ' . $fromEmail,
            'Return-Path: ' . $fromEmail,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            'X-Mailer: RECON-RWA',
        ];

        $eol = "\r\n";
        $body = '--' . $boundary . $eol
              . 'Content-Type: text/plain; charset=UTF-8' . $eol
              . 'Content-Transfer-Encoding: base64' . $eol . $eol
              . chunk_split(base64_encode($textBody)) . $eol
              . '--' . $boundary . $eol
              . 'Content-Type: text/html; charset=UTF-8' . $eol
              . 'Content-Transfer-Encoding: base64' . $eol . $eol
              . chunk_split(base64_encode($htmlBody)) . $eol
              . '--' . $boundary . '--' . $eol;

        $ok = @mail(
            $toEmail,
            mailerEncodeSubject($subject),
            $body,
            implode($eol, $headers),
            '-f' . $fromEmail
        );

        if (!$ok) {
            error_log('[mailer] send failed to=' . $toEmail . ' subject=' . $subject);
        }
        return (bool)$ok;
    }
}

if (!function_exists('buildEmailVerifyHtml')) {
    function buildEmailVerifyHtml(string $verifyUrl, string $lang = 'ko'): string {
        $L = [
            'ko' => [
                'title'   => '이메일 인증',
                'hello'   => 'RECON RWA 이메일 인증',
                'desc'    => '아래 버튼을 클릭하여 이메일을 인증하세요. 인증 링크는 24시간 후 만료됩니다.',
                'btn'     => '이메일 인증',
                'fallback'=> '버튼이 작동하지 않으면 아래 링크를 복사해 브라우저 주소창에 붙여넣으세요.',
                'note'    => '본인이 요청하지 않은 경우 이 메일을 무시하세요.',
            ],
            'en' => [
                'title'   => 'Email Verification',
                'hello'   => 'RECON RWA Email Verification',
                'desc'    => 'Click the button below to verify your email. The link expires in 24 hours.',
                'btn'     => 'Verify Email',
                'fallback'=> 'If the button does not work, copy the link below into your browser.',
                'note'    => 'If you did not request this, please ignore this email.',
            ],
        ];
        $t = $L[$lang] ?? $L['ko'];
        $safeUrl = htmlspecialchars($verifyUrl, ENT_QUOTES, 'UTF-8');

        return '<!DOCTYPE html>'
             . '<html><head><meta charset="UTF-8"><title>' . $t['title'] . '</title></head>'
             . '<body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;color:#0f172a">'
             . '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">'
             . '<h2 style="margin:0 0 16px;color:#0f172a">' . $t['hello'] . '</h2>'
             . '<p style="margin:0 0 20px;line-height:1.6;color:#334155">' . $t['desc'] . '</p>'
             . '<div style="text-align:center;margin:28px 0">'
             . '<a href="' . $safeUrl . '" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600">' . $t['btn'] . '</a>'
             . '</div>'
             . '<p style="margin:24px 0 8px;font-size:13px;color:#64748b">' . $t['fallback'] . '</p>'
             . '<p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all">' . $safeUrl . '</p>'
             . '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">'
             . '<p style="margin:0;font-size:12px;color:#94a3b8">' . $t['note'] . '</p>'
             . '</div>'
             . '</body></html>';
    }
}
