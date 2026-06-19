<?php
/**
 * (2026-06-08 v893) 계약서 PDF 생성 — dompdf 기반.
 *
 * admin 서명 완료 시점에 generateContractPdf() 호출 →
 *   - HTML 본문 + 사용자 서명 이미지 + 관리자 서명 이미지 합성
 *   - UPLOAD_DIR/contract_pdf_<id>_<ts>_<rand>.pdf 로 저장
 *   - investment_contracts.finalized_pdf_path UPDATE
 *
 * 한국어 폰트:
 *   dompdf 의 default DejaVu 는 한글 일부만 지원. 완전한 한글 표시를 위해
 *   별도 NotoSansKR 폰트 install 권장 (후속 작업). 우선 본문은 dompdf 의
 *   기본 폰트로 렌더링 — 한글이 깨질 수 있음.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;

/**
 * 계약서 PDF 생성 + UPLOAD_DIR 저장 + DB UPDATE.
 *
 * @return string|null 성공 시 '/uploads/<filename>' path, 실패 시 null
 */
function generateContractPdf(int $contractId): ?string {
    try {
        $contract = DB::fetchOne(
            "SELECT * FROM investment_contracts WHERE id=? LIMIT 1",
            [$contractId]
        );
        if (!$contract) {
            error_log("[generateContractPdf] contract not found id=$contractId");
            return null;
        }

        // 본문 HTML — body_html / contract_body_html 둘 다 호환.
        $bodyHtml = (string)($contract['contract_body_html'] ?? $contract['body_html'] ?? '');
        if ($bodyHtml === '') {
            error_log("[generateContractPdf] empty body_html id=$contractId");
            return null;
        }

        // 서명 이미지를 base64 data URL 로 embed — dompdf 가 /uploads/ 경로
        //   대신 inline 이미지 사용. UPLOAD_DIR 의 실제 파일을 읽음.
        $embedSignature = function (?string $path): string {
            if (empty($path)) return '';
            $filename = basename((string)$path);
            if ($filename === '') return '';
            $abs = (defined('UPLOAD_DIR') ? rtrim(UPLOAD_DIR, '/\\') : '') . DIRECTORY_SEPARATOR . $filename;
            if (!is_file($abs) || !is_readable($abs)) return '';
            $bytes = @file_get_contents($abs);
            if ($bytes === false) return '';
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $mime = match ($ext) {
                'png'  => 'image/png',
                'jpg', 'jpeg' => 'image/jpeg',
                'webp' => 'image/webp',
                default => 'image/png',
            };
            return 'data:' . $mime . ';base64,' . base64_encode($bytes);
        };

        $userSigDataUrl  = $embedSignature($contract['user_signature_path']  ?? null);
        $adminSigDataUrl = $embedSignature($contract['admin_signature_path'] ?? null);

        $signedDateUser  = (string)($contract['user_signed_at']  ?? '');
        $signedDateAdmin = (string)($contract['admin_signed_at'] ?? '');
        $signerName      = htmlspecialchars((string)($contract['signer_name'] ?? ''), ENT_QUOTES, 'UTF-8');
        $contractNo      = htmlspecialchars((string)($contract['contract_no'] ?? ''), ENT_QUOTES, 'UTF-8');

        // 최종 PDF HTML 조립 — body + 두 서명 블록.
        $html = '<!doctype html><html><head><meta charset="utf-8"><style>'
              . 'body { font-family: DejaVu Sans, sans-serif; font-size: 11pt; color: #111; }'
              . 'h2,h3 { color: #0F172A; }'
              . '.meta { color: #475569; font-size: 10pt; margin: 4px 0; }'
              . '.contract-body { line-height: 1.55; }'
              . '.signature-row { margin-top: 30px; border-top: 1px dashed #94a3b8; padding-top: 16px; }'
              . '.signature-row table { width: 100%; }'
              . '.signature-row td { vertical-align: top; padding: 8px; width: 50%; }'
              . '.signature-label { font-weight: bold; margin-bottom: 6px; }'
              . '.signature-img { max-width: 240px; max-height: 100px; border: 1px solid #cbd5e1; padding: 4px; background:#fff; }'
              . '.signature-date { color: #475569; font-size: 9pt; margin-top: 4px; }'
              . '</style></head><body>'
              . '<div class="contract-body">' . $bodyHtml . '</div>'
              . '<div class="signature-row"><table><tr>'
              . '<td>'
              . '<div class="signature-label">사용자 서명 / Investor Signature</div>'
              . ($userSigDataUrl !== ''
                  ? '<img class="signature-img" src="' . $userSigDataUrl . '">'
                  : '<div style="color:#94a3b8">(no signature)</div>')
              . ($signerName !== '' ? '<div class="signature-date">이름: ' . $signerName . '</div>' : '')
              . ($signedDateUser !== '' ? '<div class="signature-date">' . htmlspecialchars($signedDateUser, ENT_QUOTES, 'UTF-8') . ' UTC</div>' : '')
              . '</td>'
              . '<td>'
              . '<div class="signature-label">관리자 서명 / Administrator Signature</div>'
              . ($adminSigDataUrl !== ''
                  ? '<img class="signature-img" src="' . $adminSigDataUrl . '">'
                  : '<div style="color:#94a3b8">(no signature)</div>')
              . ($signedDateAdmin !== '' ? '<div class="signature-date">' . htmlspecialchars($signedDateAdmin, ENT_QUOTES, 'UTF-8') . ' UTC</div>' : '')
              . '</td>'
              . '</tr></table></div>'
              . ($contractNo !== '' ? '<div class="meta" style="margin-top:20px">계약번호: ' . $contractNo . '</div>' : '')
              . '</body></html>';

        // dompdf 설정 — UTF-8, A4, remote 이미지 비활성 (보안), inline base64 만.
        $options = new Options();
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('isRemoteEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('chroot', defined('UPLOAD_DIR') ? UPLOAD_DIR : sys_get_temp_dir());

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $pdfBytes = $dompdf->output();
        if ($pdfBytes === '' || $pdfBytes === false) {
            error_log("[generateContractPdf] dompdf output empty id=$contractId");
            return null;
        }

        if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0755, true);

        $name = 'contract_pdf_' . $contractId . '_' . time() . '_'
              . substr(base_convert((string)random_int(0, PHP_INT_MAX), 10, 36), 0, 8) . '.pdf';
        $abs = rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $name;
        $bytes = file_put_contents($abs, $pdfBytes);
        if ($bytes === false || $bytes <= 0) {
            error_log("[generateContractPdf] write failed dest=$abs");
            return null;
        }

        $url = '/uploads/' . $name;
        DB::execute(
            "UPDATE investment_contracts SET finalized_pdf_path=?, updated_at=? WHERE id=?",
            [$url, nowUtcSql(), $contractId]
        );
        error_log("[generateContractPdf] OK contract=$contractId path=$url size=$bytes");
        return $url;
    } catch (Throwable $e) {
        error_log("[generateContractPdf] exception contract=$contractId: " . $e->getMessage());
        return null;
    }
}
