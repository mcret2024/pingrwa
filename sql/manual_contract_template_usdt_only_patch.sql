-- ============================================================
-- 계약서 템플릿 USDT 전용 전환 패치 (v2026.04.21.20+)
-- ============================================================
-- 변경: 모금 완료 시점에 환율/현지통화 확정 정책으로 전환 →
--      유저 계약서 생성 시점에는 USDT 금액만 표기.
--      현지통화 환산액·적용 환율 행을 "모금 완료 시 확정" 안내로 교체.
--
-- 적용 방법:
--   phpMyAdmin → rwa6 DB 선택 → SQL 탭에 이 파일 내용 붙여넣기 → 실행
--   또는 /admin/contracts.html 에서 템플릿을 직접 수정
--
-- 효과: 새로 생성되는 모든 계약서에 새 양식 적용. 기존 계약서는
--       body_html이 스냅샷으로 저장되어 있어 영향 없음.
-- ============================================================

-- 1) funding_subscription 템플릿 중 활성화된 최신 버전 업데이트
UPDATE `contract_templates`
SET `body_html` = '
  <div class="contract-body">
    <h2 style="margin:0 0 14px">투자 청약 전자계약서</h2>
    <p>본 계약은 <strong>{{signed_date_kst}}</strong> 기준으로 Silica Chain Holdings RWA 플랫폼과 아래 투자자 사이의 전자적 청약 계약입니다.</p>

    <h3 style="margin:22px 0 10px">1. 투자자 정보</h3>
    <ul>
      <li>지갑 주소: {{wallet_address}}</li>
      <li>계약 기준시각(KST): {{signed_date_kst}}</li>
    </ul>

    <h3 style="margin:22px 0 10px">2. 투자 대상 자산</h3>
    <ul>
      <li>자산 ID: {{asset_id}}</li>
      <li>자산명: {{asset_name}}</li>
      <li>시장명: {{market}}</li>
      <li>국가: {{country_name}}</li>
      <li>정산통화: {{settlement_basis}}</li>
      <li>예상 연이율(APR): {{apr}}%</li>
      <li>모금기간 종료일: {{fund_end_date}}</li>
    </ul>

    <h3 style="margin:22px 0 10px">3. 청약 금액</h3>
    <ul>
      <li>청약금액(USDT): {{amount_usdt}} USDT</li>
      <li>최소 참여금액: {{min_usdt}} USDT</li>
      <li>목표 모집금액: {{target_usdt}} USDT</li>
    </ul>

    <p class="small-note" style="margin-top:10px; color:#78350f; background:#fef3c7; border-left:3px solid #d97706; padding:10px 12px; border-radius:6px">
      ※ 현지통화 환산 금액과 적용 환율은 <strong>모금 완료(매입 확정) 시점</strong>의 시장 환율로 확정됩니다.<br>
      본 계약에는 USDT 청약금액만 기재되며, 환율 변동으로 인한 현지통화 환산액의 변동은 정상입니다.
    </p>

    <h3 style="margin:22px 0 10px">4. 투자 유의사항</h3>
    <ol>
      <li>본 상품은 원금이 보장되지 않으며, 자산 운영 및 매각 결과에 따라 손실이 발생할 수 있습니다.</li>
      <li>수익, 이자, 매각 정산은 모금 완료 시점에 확정된 정산통화 환율을 기준으로 계산되며, 지급은 USDT로 이루어집니다.</li>
      <li>모집 완료 시점의 환율 및 발행량이 확정되며, 이후 변동될 수 없습니다.</li>
      <li>플랫폼은 관련 법령, 내부통제, KYC/OTP 절차에 따라 투자 참여를 제한하거나 보류할 수 있습니다.</li>
    </ol>

    <h3 style="margin:22px 0 10px">5. 전자문서 및 전자서명 동의</h3>
    <p>투자자는 본 계약을 전자문서 형태로 열람하였고, 직접 입력한 자필 전자서명 및 OTP 검증을 통해 본 계약의 내용에 동의하며, 이는 서면 서명과 동일한 효력을 가지는 것에 동의합니다.</p>

    <h3 style="margin:22px 0 10px">6. 효력 발생</h3>
    <p>본 계약은 투자자의 자필 전자서명과 OTP 검증이 완료되고, 실제 모금 참여가 정상 접수된 시점에 유효 접수됩니다. 이후 관리자의 최종 자필서명이 완료되면 계약 상태는 완료로 전환됩니다.</p>
  </div>
',
  `updated_at` = CURRENT_TIMESTAMP,
  `updated_by` = 'migration_usdt_only_v1'
WHERE `template_code` = 'funding_subscription'
  AND `is_active` = 1;
