-- ============================================================
-- 계약서 기본폼 다국어 버전 패치 (v2026.04.22.9)
-- ============================================================
-- 효과:
--   funding_subscription_ko / _en / _ja / _zh 4개 언어 템플릿 생성.
--   contracts.php가 유저의 현재 언어(request.lang 또는 X-RWA-Lang 헤더)에
--   맞춰 자동 선택. 매칭되는 언어 없으면 한국어 기본 템플릿(funding_subscription)
--   사용.
--
-- 정책 반영:
--   - USDT만 계약서에 표기 (환율/현지통화 미기재)
--   - 환율은 모금 완료 시 확정됨을 명시
--   - 매월 15일 이자 지급, 14-16일 스테이킹 lock
--   - 매각 환율 관리자 수동 입력
--
-- 적용 방법:
--   phpMyAdmin → rwa6 DB → SQL 탭 → 이 파일 내용 붙여넣기 → 실행
--   또는 install.php가 sql/ 디렉터리 자동 스캔으로 신규 설치 시 적용
--
-- 주의:
--   기존 funding_subscription (legacy)는 유지. 언어 지정 템플릿이 없을 때
--   fallback으로 사용. 기존 서명된 계약서는 body_html 스냅샷이라 영향 없음.
-- ============================================================

-- ============================================================
-- 1) 한국어 (KO)
-- ============================================================
INSERT INTO `contract_templates`
(`template_code`, `template_name`, `template_title`, `body_html`, `body_text`,
 `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
('funding_subscription_ko', '기본 투자 청약 전자계약서 (한국어)',
 '{{asset_name}} 투자 청약 전자계약서',
 '<div class="contract-body">
  <h2 style="margin:0 0 14px">투자 청약 전자계약서</h2>
  <p>본 계약은 <strong>{{signed_date_kst}}</strong> 기준으로 RECON RWA 플랫폼(이하 "플랫폼")과 아래 투자자(이하 "투자자") 사이에 체결되는 전자적 청약 계약입니다.</p>

  <h3 style="margin:22px 0 10px">제1조 투자자 정보</h3>
  <ul>
    <li>지갑 주소: {{wallet_address}}</li>
    <li>계약 기준시각(KST): {{signed_date_kst}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">제2조 투자 대상 자산</h3>
  <ul>
    <li>자산 ID: {{asset_id}}</li>
    <li>자산명: {{asset_name}}</li>
    <li>시장명: {{market}}</li>
    <li>국가: {{country_name}}</li>
    <li>정산통화: {{settlement_basis}}</li>
    <li>연 이율(APR): {{apr}}%</li>
    <li>모금기간 종료일: {{fund_end_date}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">제3조 청약 금액</h3>
  <ul>
    <li>청약금액(USDT): {{amount_usdt}} USDT</li>
    <li>최소 참여금액: {{min_usdt}} USDT</li>
    <li>목표 모집금액: {{target_usdt}} USDT</li>
  </ul>

  <p class="small-note" style="margin-top:10px;color:#78350f;background:#fef3c7;border-left:3px solid #d97706;padding:10px 12px;border-radius:6px;line-height:1.7">
    ※ 현지통화 환산 금액과 적용 환율은 <strong>모금 완료(자산 매입 가정) 시점</strong>의 시장 환율로 확정됩니다.<br>
    본 계약서에는 USDT 청약금액만 기재되며, 환율 변동으로 인한 현지통화 환산액 변동은 정상 사항입니다.
  </p>

  <h3 style="margin:22px 0 10px">제4조 토큰 분배</h3>
  <p>모금 완료 후 <strong>1 USDT = 1 Token</strong> 기준으로 토큰이 발행됩니다. 투자자는 투자 금액과 동일한 수량의 토큰을 클레임으로 수령할 수 있으며, 환율과 무관하게 토큰 수량이 결정됩니다.</p>

  <h3 style="margin:22px 0 10px">제5조 스테이킹 이자</h3>
  <ul>
    <li>스테이킹된 토큰에 대해 연 이율(APR) {{apr}}% 기준으로 이자가 발생하며, 시스템은 자동으로 12로 나누어 매월 이자를 지급합니다.</li>
    <li>이자 지급일은 매월 15일이며, 지급 환율은 해당 월 15일 기준 시장 환율로 확정됩니다.</li>
    <li>매월 14~16일은 정산 기간으로 스테이킹 및 언스테이킹이 제한되며, 17일부터 재개됩니다.</li>
    <li>이자는 USDT로 투자자 플랫폼 계좌에 자동 적립되며, 클레임을 통해 실 반영됩니다.</li>
  </ul>

  <h3 style="margin:22px 0 10px">제6조 투자 유의사항</h3>
  <ol>
    <li>본 상품은 원금이 보장되지 않으며, 자산 운영·매각 결과에 따라 손실이 발생할 수 있습니다.</li>
    <li>수익, 이자, 매각 정산은 정산통화 기준으로 계산되며, 지급 시점 환율에 따라 USDT로 환산됩니다.</li>
    <li>모금 완료 시점의 환율과 발행 수량은 확정되며, 이후 변동되지 않습니다.</li>
    <li>매각 실행 시 적용되는 환율은 관리자가 매각 시점에 수동으로 입력한 값이며, 매각 실행 후에는 변경되지 않습니다.</li>
    <li>플랫폼은 관련 법령, 내부통제, KYC/OTP 절차에 따라 투자 참여를 제한 또는 보류할 수 있습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제7조 전자문서 및 전자서명 동의</h3>
  <p>투자자는 본 계약을 전자문서 형태로 열람하였고, 자필 전자서명 및 OTP 검증을 통해 본 계약의 내용에 동의하며, 이는 서면 서명과 동일한 효력을 갖는 데 동의합니다.</p>

  <h3 style="margin:22px 0 10px">제8조 효력 발생</h3>
  <p>본 계약은 투자자의 자필 전자서명과 OTP 검증이 완료되고, 실제 모금 참여가 정상 접수된 시점에 유효하게 접수됩니다. 이후 관리자의 최종 자필서명이 완료되면 계약 상태는 "완료"로 전환됩니다.</p>
</div>',
 NULL, 1, 1, 'system', 'migration_multilang_v1',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  body_html = VALUES(body_html),
  template_title = VALUES(template_title),
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'migration_multilang_v1';

-- ============================================================
-- 2) 영어 (EN)
-- ============================================================
INSERT INTO `contract_templates`
(`template_code`, `template_name`, `template_title`, `body_html`, `body_text`,
 `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
('funding_subscription_en', 'Default Investment Subscription Agreement (English)',
 '{{asset_name}} Investment Subscription Agreement',
 '<div class="contract-body">
  <h2 style="margin:0 0 14px">Investment Subscription Agreement</h2>
  <p>This agreement is an electronic investment subscription contract executed as of <strong>{{signed_date_kst}}</strong> (KST) between the RECON RWA Platform (hereinafter "Platform") and the investor identified below (hereinafter "Investor").</p>

  <h3 style="margin:22px 0 10px">Article 1. Investor Information</h3>
  <ul>
    <li>Wallet Address: {{wallet_address}}</li>
    <li>Signed Date (KST): {{signed_date_kst}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">Article 2. Investment Asset</h3>
  <ul>
    <li>Asset ID: {{asset_id}}</li>
    <li>Asset Name: {{asset_name}}</li>
    <li>Market: {{market}}</li>
    <li>Country: {{country_name}}</li>
    <li>Settlement Currency: {{settlement_basis}}</li>
    <li>Annual Percentage Rate (APR): {{apr}}%</li>
    <li>Funding Period End Date: {{fund_end_date}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">Article 3. Subscription Amount</h3>
  <ul>
    <li>Subscription Amount (USDT): {{amount_usdt}} USDT</li>
    <li>Minimum Participation Amount: {{min_usdt}} USDT</li>
    <li>Target Funding Amount: {{target_usdt}} USDT</li>
  </ul>

  <p class="small-note" style="margin-top:10px;color:#78350f;background:#fef3c7;border-left:3px solid #d97706;padding:10px 12px;border-radius:6px;line-height:1.7">
    Note: The local currency conversion amount and applicable FX rate will be locked at the <strong>moment of funding completion</strong> (assumed asset acquisition time) based on the market FX rate at that time.<br>
    Only the USDT subscription amount is stated in this agreement. Fluctuations in local currency equivalent due to FX movements are normal and expected.
  </p>

  <h3 style="margin:22px 0 10px">Article 4. Token Distribution</h3>
  <p>After funding completion, tokens will be issued on a <strong>1 USDT = 1 Token</strong> basis. Investors may claim tokens equal to their invested USDT amount. Token quantity is determined independently of FX rates.</p>

  <h3 style="margin:22px 0 10px">Article 5. Staking Interest</h3>
  <ul>
    <li>Interest on staked tokens accrues at the asset''s annual rate of {{apr}}% APR. The system automatically divides by 12 to pay monthly interest.</li>
    <li>The interest payout date is the 15th of each month. The payout FX rate is locked based on the market rate on the 15th of that month.</li>
    <li>Staking and unstaking are restricted during the settlement period (14th–16th of each month) and resume on the 17th.</li>
    <li>Interest is automatically credited in USDT to the investor''s platform account and reflected upon claim.</li>
  </ul>

  <h3 style="margin:22px 0 10px">Article 6. Investment Risk Notice</h3>
  <ol>
    <li>This product does not guarantee principal. Losses may occur depending on asset operation and sale outcomes.</li>
    <li>Returns, interest, and sale settlements are calculated in the settlement currency and converted to USDT at the applicable FX rate at the time of payment.</li>
    <li>The FX rate and token issuance quantity are locked at the moment of funding completion and remain unchanged thereafter.</li>
    <li>The FX rate applied at sale execution is entered manually by the administrator at the time of sale and cannot be changed thereafter.</li>
    <li>The Platform may restrict or suspend investment participation in accordance with applicable laws, internal controls, and KYC/OTP procedures.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 7. Consent to Electronic Document and Signature</h3>
  <p>The Investor has reviewed this agreement in electronic form and agrees to its terms through handwritten electronic signature and OTP verification, acknowledging that such electronic consent has the same legal effect as a written signature.</p>

  <h3 style="margin:22px 0 10px">Article 8. Effective Date</h3>
  <p>This agreement becomes effective upon the Investor''s electronic signature, OTP verification, and the actual funding participation being properly received. Upon completion of the administrator''s final signature, the contract status transitions to "Completed."</p>
</div>',
 NULL, 1, 1, 'system', 'migration_multilang_v1',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  body_html = VALUES(body_html),
  template_title = VALUES(template_title),
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'migration_multilang_v1';

-- ============================================================
-- 3) 일본어 (JA)
-- ============================================================
INSERT INTO `contract_templates`
(`template_code`, `template_name`, `template_title`, `body_html`, `body_text`,
 `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
('funding_subscription_ja', '基本投資申込電子契約書 (日本語)',
 '{{asset_name}} 投資申込電子契約書',
 '<div class="contract-body">
  <h2 style="margin:0 0 14px">投資申込電子契約書</h2>
  <p>本契約は <strong>{{signed_date_kst}}</strong>（KST）を基準に、RECON RWAプラットフォーム（以下「プラットフォーム」）と下記の投資家（以下「投資家」）の間で締結される電子的な申込契約です。</p>

  <h3 style="margin:22px 0 10px">第1条 投資家情報</h3>
  <ul>
    <li>ウォレットアドレス: {{wallet_address}}</li>
    <li>契約基準時刻（KST）: {{signed_date_kst}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">第2条 投資対象資産</h3>
  <ul>
    <li>資産ID: {{asset_id}}</li>
    <li>資産名: {{asset_name}}</li>
    <li>市場名: {{market}}</li>
    <li>国: {{country_name}}</li>
    <li>精算通貨: {{settlement_basis}}</li>
    <li>年利率（APR）: {{apr}}%</li>
    <li>募集期間終了日: {{fund_end_date}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">第3条 申込金額</h3>
  <ul>
    <li>申込金額（USDT）: {{amount_usdt}} USDT</li>
    <li>最低参加金額: {{min_usdt}} USDT</li>
    <li>目標募集金額: {{target_usdt}} USDT</li>
  </ul>

  <p class="small-note" style="margin-top:10px;color:#78350f;background:#fef3c7;border-left:3px solid #d97706;padding:10px 12px;border-radius:6px;line-height:1.7">
    ※ 現地通貨換算額および適用為替レートは、<strong>募集完了（資産取得仮定）時点</strong>の市場為替レートで確定されます。<br>
    本契約書にはUSDT申込金額のみ記載され、為替変動による現地通貨換算額の変動は通常のことです。
  </p>

  <h3 style="margin:22px 0 10px">第4条 トークン分配</h3>
  <p>募集完了後、<strong>1 USDT = 1 Token</strong> の基準でトークンが発行されます。投資家は投資金額と同等数量のトークンをクレームで受け取ることができ、トークン数量は為替レートとは無関係に決定されます。</p>

  <h3 style="margin:22px 0 10px">第5条 ステーキング利息</h3>
  <ul>
    <li>ステーキングされたトークンに対して年利率（APR）{{apr}}%基準で利息が発生し、システムは自動的に12で割って毎月利息を支払います。</li>
    <li>利息支払日は毎月15日で、支払為替レートは当該月15日基準の市場為替レートで確定されます。</li>
    <li>毎月14～16日は精算期間となり、ステーキングおよびアンステーキングが制限され、17日から再開されます。</li>
    <li>利息はUSDTで投資家のプラットフォームアカウントに自動的に加算され、クレームを通じて実際に反映されます。</li>
  </ul>

  <h3 style="margin:22px 0 10px">第6条 投資上の注意事項</h3>
  <ol>
    <li>本商品は元本が保証されず、資産運用・売却結果によって損失が発生する可能性があります。</li>
    <li>収益、利息、売却精算は精算通貨基準で計算され、支払時点の為替レートに従ってUSDTに換算されます。</li>
    <li>募集完了時点の為替レートと発行数量が確定され、その後変更されません。</li>
    <li>売却実行時に適用される為替レートは、管理者が売却時点で手動入力した値であり、売却実行後に変更されません。</li>
    <li>プラットフォームは関連法令、内部統制、KYC/OTP手続きに従って投資参加を制限または保留することがあります。</li>
  </ol>

  <h3 style="margin:22px 0 10px">第7条 電子文書および電子署名への同意</h3>
  <p>投資家は本契約を電子文書の形式で閲覧し、自筆電子署名およびOTP検証を通じて本契約の内容に同意し、これが書面署名と同じ効力を有することに同意します。</p>

  <h3 style="margin:22px 0 10px">第8条 効力発生</h3>
  <p>本契約は投資家の自筆電子署名とOTP検証が完了し、実際の募集参加が正常に受理された時点で有効に成立します。その後、管理者の最終自筆署名が完了すると、契約状態は「完了」に転換されます。</p>
</div>',
 NULL, 1, 1, 'system', 'migration_multilang_v1',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  body_html = VALUES(body_html),
  template_title = VALUES(template_title),
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'migration_multilang_v1';

-- ============================================================
-- 4) 중국어 (ZH, 简体)
-- ============================================================
INSERT INTO `contract_templates`
(`template_code`, `template_name`, `template_title`, `body_html`, `body_text`,
 `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
('funding_subscription_zh', '基础投资认购电子合同 (中文)',
 '{{asset_name}} 投资认购电子合同',
 '<div class="contract-body">
  <h2 style="margin:0 0 14px">投资认购电子合同</h2>
  <p>本合同于 <strong>{{signed_date_kst}}</strong>（KST）由 RECON RWA 平台（以下简称"平台"）与下列投资者（以下简称"投资者"）之间以电子方式签订。</p>

  <h3 style="margin:22px 0 10px">第一条 投资者信息</h3>
  <ul>
    <li>钱包地址: {{wallet_address}}</li>
    <li>合同基准时间（KST）: {{signed_date_kst}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">第二条 投资对象资产</h3>
  <ul>
    <li>资产 ID: {{asset_id}}</li>
    <li>资产名称: {{asset_name}}</li>
    <li>市场名称: {{market}}</li>
    <li>国家: {{country_name}}</li>
    <li>结算货币: {{settlement_basis}}</li>
    <li>年化收益率（APR）: {{apr}}%</li>
    <li>募集期限终止日: {{fund_end_date}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">第三条 认购金额</h3>
  <ul>
    <li>认购金额（USDT）: {{amount_usdt}} USDT</li>
    <li>最低参与金额: {{min_usdt}} USDT</li>
    <li>目标募集金额: {{target_usdt}} USDT</li>
  </ul>

  <p class="small-note" style="margin-top:10px;color:#78350f;background:#fef3c7;border-left:3px solid #d97706;padding:10px 12px;border-radius:6px;line-height:1.7">
    说明：当地货币换算金额及适用汇率将在<strong>募集完成（资产买入假定）时点</strong>按当时市场汇率确定。<br>
    本合同仅记载 USDT 认购金额，当地货币换算金额因汇率变动而产生的变化为正常现象。
  </p>

  <h3 style="margin:22px 0 10px">第四条 代币分配</h3>
  <p>募集完成后，代币按 <strong>1 USDT = 1 Token</strong> 的基准发行。投资者可通过 claim 领取与投资金额相等数量的代币，代币数量的确定与汇率无关。</p>

  <h3 style="margin:22px 0 10px">第五条 质押利息</h3>
  <ul>
    <li>质押的代币按该资产年化收益率（APR）{{apr}}% 计算利息，系统自动除以 12 按月支付利息。</li>
    <li>利息支付日为每月 15 日，支付汇率按该月 15 日的市场汇率锁定。</li>
    <li>每月 14–16 日为结算期，期间限制质押与解除质押，17 日起恢复。</li>
    <li>利息将以 USDT 自动计入投资者平台账户，并通过 claim 实际反映。</li>
  </ul>

  <h3 style="margin:22px 0 10px">第六条 投资风险提示</h3>
  <ol>
    <li>本产品不保证本金，资产运营或出售结果可能导致损失。</li>
    <li>收益、利息及出售结算以结算货币为基础计算，按支付时点的汇率换算为 USDT。</li>
    <li>募集完成时点的汇率与发行数量一经锁定即不再变动。</li>
    <li>出售执行时适用的汇率为管理员在出售时点手动输入的数值，出售执行后不可更改。</li>
    <li>平台可依据相关法律法规、内部控制及 KYC/OTP 程序对投资参与进行限制或暂缓。</li>
  </ol>

  <h3 style="margin:22px 0 10px">第七条 对电子文档与电子签名的同意</h3>
  <p>投资者已以电子文档形式审阅本合同，并通过亲笔电子签名及 OTP 验证同意本合同内容，确认该同意方式具有与书面签名相同的法律效力。</p>

  <h3 style="margin:22px 0 10px">第八条 效力发生</h3>
  <p>本合同在投资者完成亲笔电子签名、OTP 验证并实际募集参与正常受理后正式生效。其后管理员完成最终亲笔签名时，合同状态转为"已完成"。</p>
</div>',
 NULL, 1, 1, 'system', 'migration_multilang_v1',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  body_html = VALUES(body_html),
  template_title = VALUES(template_title),
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'migration_multilang_v1';

-- ============================================================
-- 확인용 SELECT (선택 실행)
-- ============================================================
-- SELECT template_code, template_name, is_active, version_no, updated_at
--   FROM contract_templates
--   WHERE template_code LIKE 'funding_subscription%'
--   ORDER BY template_code;
