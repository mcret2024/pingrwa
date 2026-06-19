-- ============================================================
-- SilicaChain 전자계약 템플릿 v2 — KO/EN 전용 (강화판)
-- ============================================================
-- 효과:
--   1) 일본어(funding_subscription_ja), 중국어(funding_subscription_zh)
--      템플릿을 비활성화 + 삭제.
--   2) 한국어(funding_subscription_ko) / 영어(funding_subscription_en)
--      템플릿을 SilicaChain 단일 자산(실리카 광산) 기준으로 재작성하여
--      법적 강제성·리스크 고지·KYC/AML·분쟁해결·세무·세이프하버 조항 강화.
--   3) Recon → SilicaChain 으로 브랜드 정합화.
--
-- 정책 반영:
--   - USDT 기준 청약 (환율은 모금 완료 시 확정)
--   - 매월 15일 이자 지급 / 14~16일 스테이킹 lock
--   - 단일 자산: 한국 규조토(Silica) 광산
--   - STO ↔ Silica 토큰 스왑 정책
--   - 매각 환율: 관리자 수동 입력
--
-- 적용 방법:
--   phpMyAdmin → rwa6 DB → SQL 탭 → 파일 내용 붙여넣기 → 실행
--
-- 주의:
--   기존 서명된 계약서는 body_html 스냅샷이라 본 마이그레이션 영향 없음.
--   contract_templates 의 ja / zh row 는 안전 삭제 (FK 없음).
-- ============================================================

-- ============================================================
-- 0) JA / ZH 템플릿 비활성화 + 삭제
-- ============================================================
UPDATE `contract_templates`
   SET `is_active` = 0,
       `updated_at` = CURRENT_TIMESTAMP,
       `updated_by` = 'silica_v2_migration'
 WHERE `template_code` IN ('funding_subscription_ja', 'funding_subscription_zh');

DELETE FROM `contract_templates`
 WHERE `template_code` IN ('funding_subscription_ja', 'funding_subscription_zh');

-- ============================================================
-- 1) 한국어 (KO) — 강화판
-- ============================================================
INSERT INTO `contract_templates`
(`template_code`, `template_name`, `template_title`, `body_html`, `body_text`,
 `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
('funding_subscription_ko', 'SilicaChain 투자 청약 전자계약서 (한국어 v2)',
 '{{asset_name}} 투자 청약 전자계약서',
 '<div class="contract-body" style="line-height:1.75">
  <h2 style="margin:0 0 14px">투자 청약 전자계약서</h2>
  <p>본 계약(이하 “본 계약”)은 <strong>{{signed_date_kst}}</strong>(KST) 기준으로 SilicaChain 플랫폼(이하 “플랫폼”)과 아래 명시된 투자자(이하 “투자자”) 간에 전자적으로 체결되며, 양 당사자는 아래 조항에 동의합니다.</p>

  <h3 style="margin:22px 0 10px">제1조 (정의)</h3>
  <ol>
    <li>“플랫폼”이란 SilicaChain 이 운영하는 RWA 토큰화 서비스 일체를 의미합니다.</li>
    <li>“대상 자산”이란 본 계약 제3조에 기재된, 대한민국 내 규조토(Silica) 광산 자산 및 그 운영권/수익권을 의미합니다.</li>
    <li>“STO 토큰”이란 대상 자산의 청약 권리를 표상하기 위해 발행되는 SPL 토큰을 의미합니다.</li>
    <li>“Silica 토큰”이란 대상 자산의 운영 수익 분배 단위로 사용되는 SPL 토큰을 의미합니다.</li>
    <li>“정산통화”란 대상 자산의 회계·이자 산정에 사용되는 기준 통화(KRW)를 의미하며, 모든 지급은 USDT로 환산되어 이루어집니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제2조 (투자자 정보)</h3>
  <ul>
    <li>지갑 주소: <code>{{wallet_address}}</code></li>
    <li>계약 기준시각(KST): {{signed_date_kst}}</li>
    <li>투자자는 KYC 및 OTP 인증을 완료하였으며, 본인이 본 계약을 이해하고 자발적으로 체결함을 확인합니다.</li>
  </ul>

  <h3 style="margin:22px 0 10px">제3조 (투자 대상 자산)</h3>
  <ul>
    <li>자산 ID: {{asset_id}}</li>
    <li>자산명: {{asset_name}}</li>
    <li>시장: {{market}}</li>
    <li>국가: {{country_name}}</li>
    <li>정산통화: {{settlement_basis}}</li>
    <li>약정 연이율(APR): {{apr}}%</li>
    <li>모금기간 종료일: {{fund_end_date}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">제4조 (청약 금액 및 환율)</h3>
  <ul>
    <li>청약금액(USDT): <strong>{{amount_usdt}} USDT</strong></li>
    <li>최소 참여금액: {{min_usdt}} USDT</li>
    <li>목표 모집금액: {{target_usdt}} USDT</li>
  </ul>
  <p class="small-note" style="margin-top:10px;color:#78350f;background:#fef3c7;border-left:3px solid #d97706;padding:10px 12px;border-radius:6px">
    ※ 본 계약서에는 <strong>USDT 청약금액</strong>만 기재됩니다. 현지통화 환산 금액·적용 환율은 <strong>모금 완료 시점</strong>의 시장 환율로 확정되며, 환율 변동으로 인한 현지통화 환산액의 변동은 정상적인 사항입니다.
  </p>

  <h3 style="margin:22px 0 10px">제5조 (토큰 발행 및 분배)</h3>
  <ol>
    <li>모금 완료 후 <strong>1 USDT = 1 STO 토큰</strong> 기준으로 STO 토큰이 발행됩니다.</li>
    <li>투자자는 청약금액과 동일한 수량의 STO 토큰을 클레임 절차를 통해 수령할 수 있습니다.</li>
    <li>STO 토큰은 본 계약의 효력 하에 발행되는 권리표시 토큰으로, 플랫폼 정책에 따라 양도가 제한될 수 있습니다.</li>
    <li>스테이킹된 STO 토큰은 1:1 비율로 Silica 토큰으로 스왑이 가능하며, 스왑 시점·조건은 플랫폼 별도 공지로 정합니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제6조 (스테이킹 및 이자)</h3>
  <ol>
    <li>스테이킹된 STO 토큰에 대해 약정 연이율(APR) {{apr}}% 가 적용되며, 시스템은 이를 12 등분하여 매월 이자를 지급합니다.</li>
    <li>이자 지급일은 매월 <strong>15일</strong>이며, 해당 월 15일 시장 환율을 적용하여 USDT 로 환산·지급됩니다.</li>
    <li>매월 <strong>14일~16일</strong>은 정산 기간으로 스테이킹 및 언스테이킹이 제한되며, 매월 17일부터 재개됩니다.</li>
    <li>이자는 USDT 로 투자자 플랫폼 계좌에 자동 적립되며, 클레임 절차를 통해 실제 지갑에 반영됩니다.</li>
    <li>약정 APR 은 대상 자산의 운영 성과·시장 상황·관련 법령 변경에 따라 사전 공지를 거쳐 조정될 수 있습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제7조 (투자 위험 고지 — 중요)</h3>
  <ol>
    <li><strong>원금 비보장:</strong> 본 상품은 예금자보호법 및 금융투자업 관련 보호 대상이 아니며, 자산의 운영·매각 결과에 따라 원금 손실이 발생할 수 있습니다.</li>
    <li><strong>유동성 위험:</strong> STO 토큰은 플랫폼 내 거래만 가능하며, 외부 거래소 상장 전까지는 즉시 환금이 어려울 수 있습니다.</li>
    <li><strong>운영 위험:</strong> 광산 채굴 중단·인허가 변경·자연재해 등으로 운영이 일시 또는 영구 중단될 수 있습니다.</li>
    <li><strong>환율 위험:</strong> 정산통화(KRW)와 USDT 간 환율 변동에 따라 USDT 환산 수익이 감소할 수 있습니다.</li>
    <li><strong>스마트 컨트랙트 위험:</strong> Solana 네트워크 또는 SPL 컨트랙트의 결함, 해킹, 네트워크 장애로 인한 손실 가능성을 인지합니다.</li>
    <li><strong>규제 위험:</strong> 가상자산·증권형 토큰 관련 법령 변경에 따라 본 상품의 구조·서비스가 변경되거나 종료될 수 있습니다.</li>
    <li><strong>매각 시점 위험:</strong> 매각 환율은 관리자가 매각 실행 시점에 수동 입력하며, 입력 후에는 변경되지 않습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제8조 (KYC, AML 및 제재대상 확인)</h3>
  <ol>
    <li>투자자는 신원확인(KYC) 자료가 진실하며, 본인 명의 지갑임을 보증합니다.</li>
    <li>플랫폼은 자금세탁방지법(AML)·테러자금조달금지법·국제 제재 규정에 따라 의심거래를 보고하거나, 제재대상자(OFAC/UN/EU 제재 리스트)와의 거래를 차단할 수 있습니다.</li>
    <li>투자 자금은 합법적 출처에서 유래한 것이어야 하며, 투자자는 자금 출처를 증명할 수 있는 자료를 보관하여야 합니다.</li>
    <li>플랫폼은 의심거래 발견 시 사전 통보 없이 거래를 보류·차단·환불 처리할 수 있습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제9조 (개인정보 보호)</h3>
  <p>플랫폼은 「개인정보 보호법」 및 관련 법령에 따라 투자자의 개인정보를 수집·이용·보관하며, 동의 없이 제3자에게 제공하지 않습니다. 단 법령에 따른 수사기관·감독기관 요청 또는 KYC/AML 의무 이행을 위한 위탁업체 제공은 예외로 합니다.</p>

  <h3 style="margin:22px 0 10px">제10조 (세무 책임)</h3>
  <p>본 계약 및 본 계약에 기반한 수익 발생에 따른 모든 세금(소득세·양도세·부가가치세 등)은 투자자 본인의 책임이며, 플랫폼은 관련 법령상 원천징수 의무가 있는 경우 이를 이행합니다.</p>

  <h3 style="margin:22px 0 10px">제11조 (불가항력)</h3>
  <p>천재지변, 전쟁, 폭동, 정부조치, 인터넷·블록체인 네트워크 장애, 해킹 등 양 당사자의 합리적 통제 범위를 벗어나는 사유로 인한 의무 불이행에 대해서는 그 책임이 면제됩니다.</p>

  <h3 style="margin:22px 0 10px">제12조 (전자문서 및 전자서명 동의)</h3>
  <p>투자자는 본 계약을 전자문서 형태로 충분히 열람하였으며, 자필 전자서명 및 OTP 검증을 통해 본 계약의 내용에 동의합니다. 본 전자서명은 「전자문서 및 전자거래 기본법」에 따라 자필 서면 서명과 동일한 법적 효력을 가집니다.</p>

  <h3 style="margin:22px 0 10px">제13조 (효력 발생 및 해지)</h3>
  <ol>
    <li>본 계약은 투자자의 자필 전자서명, OTP 검증, 청약금 입금 확인 후 관리자의 최종 자필 서명이 완료된 시점에 “완료” 상태로 전환되어 효력을 발생합니다.</li>
    <li>관리자는 KYC 미흡, 자금세탁 의심, 약관 위반 등의 사유 발견 시 본 계약을 반려할 수 있으며, 이 경우 청약금은 자동 환불됩니다.</li>
    <li>모금 기간 내 자산이 모집목표를 달성하지 못한 경우 본 계약은 자동 실효되며, 청약금은 7영업일 이내 환불됩니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제14조 (분쟁 해결 및 준거법)</h3>
  <ol>
    <li>본 계약의 해석 및 효력은 대한민국 법률에 따릅니다.</li>
    <li>본 계약과 관련된 분쟁은 우선 양 당사자의 협의에 따라 해결하며, 협의가 이루어지지 않을 경우 대한상사중재원의 중재 규칙에 따라 중재로 최종 해결합니다.</li>
    <li>중재 장소는 대한민국 서울이며, 중재 언어는 한국어로 합니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제15조 (기타)</h3>
  <ol>
    <li>본 계약의 일부 조항이 무효 또는 집행 불가능한 것으로 판단되는 경우에도 다른 조항의 효력에는 영향을 미치지 않습니다.</li>
    <li>본 계약에 명시되지 않은 사항은 플랫폼 이용약관, 관련 법령, 거래 관행에 따릅니다.</li>
    <li>본 계약은 한국어를 정본으로 하며, 영문 번역본과 해석상 차이가 있을 경우 한국어 정본이 우선합니다.</li>
  </ol>
</div>',
 NULL, 2, 1, 'system', 'silica_v2_migration',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  template_name = VALUES(template_name),
  template_title = VALUES(template_title),
  body_html = VALUES(body_html),
  version_no = VALUES(version_no),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'silica_v2_migration';

-- ============================================================
-- 2) 영어 (EN) — Strengthened
-- ============================================================
INSERT INTO `contract_templates`
(`template_code`, `template_name`, `template_title`, `body_html`, `body_text`,
 `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
('funding_subscription_en', 'SilicaChain Investment Subscription Agreement (English v2)',
 '{{asset_name}} Investment Subscription Agreement',
 '<div class="contract-body" style="line-height:1.75">
  <h2 style="margin:0 0 14px">Investment Subscription Agreement</h2>
  <p>This agreement (the “Agreement”) is electronically executed as of <strong>{{signed_date_kst}}</strong> (KST) between SilicaChain Platform (the “Platform”) and the investor identified below (the “Investor”). Both parties agree to the terms below.</p>

  <h3 style="margin:22px 0 10px">Article 1. Definitions</h3>
  <ol>
    <li>“Platform” means the RWA tokenization service operated by SilicaChain.</li>
    <li>“Underlying Asset” means the diatomaceous earth (Silica) mining asset located in the Republic of Korea, including its operating rights and revenue rights, as specified in Article 3.</li>
    <li>“STO Token” means the SPL token issued to represent the Investor’s subscription rights to the Underlying Asset.</li>
    <li>“Silica Token” means the SPL token used as the unit of operating revenue distribution for the Underlying Asset.</li>
    <li>“Settlement Currency” means the base currency (KRW) used for accounting and interest calculation. All payouts are converted to and settled in USDT.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 2. Investor Information</h3>
  <ul>
    <li>Wallet Address: <code>{{wallet_address}}</code></li>
    <li>Signed Date (KST): {{signed_date_kst}}</li>
    <li>The Investor has completed KYC and OTP verification, and confirms that the Investor understands and voluntarily enters into this Agreement.</li>
  </ul>

  <h3 style="margin:22px 0 10px">Article 3. Underlying Asset</h3>
  <ul>
    <li>Asset ID: {{asset_id}}</li>
    <li>Asset Name: {{asset_name}}</li>
    <li>Market: {{market}}</li>
    <li>Country: {{country_name}}</li>
    <li>Settlement Currency: {{settlement_basis}}</li>
    <li>Stated Annual Percentage Rate (APR): {{apr}}%</li>
    <li>Funding End Date: {{fund_end_date}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">Article 4. Subscription Amount and FX</h3>
  <ul>
    <li>Subscription Amount (USDT): <strong>{{amount_usdt}} USDT</strong></li>
    <li>Minimum Participation: {{min_usdt}} USDT</li>
    <li>Target Funding Amount: {{target_usdt}} USDT</li>
  </ul>
  <p class="small-note" style="margin-top:10px;color:#78350f;background:#fef3c7;border-left:3px solid #d97706;padding:10px 12px;border-radius:6px">
    Note: Only the <strong>USDT subscription amount</strong> is recorded in this Agreement. The local-currency equivalent and applicable FX rate are locked at the <strong>moment of funding completion</strong> based on the prevailing market rate. Fluctuations in the local-currency equivalent due to FX movements are normal and expected.
  </p>

  <h3 style="margin:22px 0 10px">Article 5. Token Issuance and Distribution</h3>
  <ol>
    <li>Upon funding completion, STO Tokens are issued on a <strong>1 USDT = 1 STO Token</strong> basis.</li>
    <li>The Investor may claim STO Tokens equal in quantity to the Subscription Amount through the claim procedure.</li>
    <li>STO Tokens are rights-representation tokens issued under this Agreement, and their transferability may be restricted in accordance with Platform policy.</li>
    <li>Staked STO Tokens may be swapped 1:1 for Silica Tokens. The swap timing and conditions are governed by separate Platform notices.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 6. Staking and Interest</h3>
  <ol>
    <li>Interest accrues on staked STO Tokens at the stated APR of {{apr}}%, with the system automatically dividing by 12 to pay monthly interest.</li>
    <li>The interest payout date is the <strong>15th of each month</strong>, and the payout FX rate is locked based on the market rate on that day, with payment in USDT.</li>
    <li>The <strong>14th–16th</strong> of each month is the settlement window during which staking and unstaking are restricted; operations resume from the 17th.</li>
    <li>Interest is automatically credited in USDT to the Investor’s Platform account and reflected in the Investor’s wallet upon claim.</li>
    <li>The stated APR may be adjusted with prior notice based on the operating performance of the Underlying Asset, market conditions, or applicable regulatory changes.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 7. Investment Risk Disclosure (Material)</h3>
  <ol>
    <li><strong>No Principal Guarantee:</strong> This product is not protected by depositor protection laws or financial-investment regulations; principal loss may occur depending on the operation and disposition of the Underlying Asset.</li>
    <li><strong>Liquidity Risk:</strong> STO Tokens may only be traded within the Platform; immediate liquidation may be difficult prior to listing on external exchanges.</li>
    <li><strong>Operational Risk:</strong> Mining operations may be temporarily or permanently suspended due to halts in extraction, regulatory changes, natural disasters, or similar events.</li>
    <li><strong>FX Risk:</strong> Returns expressed in USDT may decrease due to exchange-rate fluctuations between the Settlement Currency (KRW) and USDT.</li>
    <li><strong>Smart Contract Risk:</strong> The Investor acknowledges potential losses from defects, hacks, or network outages affecting the Solana network or SPL contracts.</li>
    <li><strong>Regulatory Risk:</strong> Changes in laws governing virtual assets or security tokens may alter or terminate the structure of this product.</li>
    <li><strong>Sale-Timing Risk:</strong> The FX rate applied at the time of sale is entered manually by the administrator at the moment of execution and cannot be changed thereafter.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 8. KYC, AML and Sanctions Screening</h3>
  <ol>
    <li>The Investor warrants that the KYC information provided is true and that the wallet is registered in the Investor’s own name.</li>
    <li>The Platform may report suspicious transactions or block transactions involving sanctioned parties (OFAC/UN/EU lists) in accordance with anti-money-laundering and counter-terrorism-financing laws.</li>
    <li>Investment funds must originate from lawful sources, and the Investor shall retain documents evidencing the source of funds.</li>
    <li>The Platform may suspend, block, or refund transactions without prior notice upon detecting suspicious activity.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 9. Privacy Protection</h3>
  <p>The Platform collects, uses, and stores the Investor’s personal information in accordance with the Personal Information Protection Act and applicable laws, and does not provide such information to third parties without the Investor’s consent. Exceptions apply to disclosures to investigative or regulatory authorities under applicable law and to processors engaged for KYC/AML compliance.</p>

  <h3 style="margin:22px 0 10px">Article 10. Tax Responsibility</h3>
  <p>All taxes arising from this Agreement and the resulting returns (including income tax, capital gains tax, and value-added tax) are the sole responsibility of the Investor. The Platform shall fulfill any withholding obligations as required by applicable law.</p>

  <h3 style="margin:22px 0 10px">Article 11. Force Majeure</h3>
  <p>Neither party shall be liable for any failure of performance caused by events beyond reasonable control, including acts of God, war, civil unrest, governmental actions, internet or blockchain network outages, or hacks.</p>

  <h3 style="margin:22px 0 10px">Article 12. Consent to Electronic Document and Signature</h3>
  <p>The Investor has reviewed this Agreement in electronic form and agrees to its terms by handwritten electronic signature and OTP verification. Such electronic signature has the same legal effect as a handwritten written signature in accordance with the Framework Act on Electronic Documents and Electronic Transactions.</p>

  <h3 style="margin:22px 0 10px">Article 13. Effective Date and Termination</h3>
  <ol>
    <li>This Agreement becomes “Completed” and effective upon the Investor’s electronic signature, OTP verification, confirmation of the subscription deposit, and the administrator’s final handwritten signature.</li>
    <li>The administrator may reject this Agreement upon discovery of insufficient KYC, suspicion of money laundering, or violation of terms, in which case the subscription will be automatically refunded.</li>
    <li>If the Underlying Asset fails to reach its funding target within the funding period, this Agreement shall automatically lapse, and the subscription will be refunded within seven (7) business days.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 14. Dispute Resolution and Governing Law</h3>
  <ol>
    <li>This Agreement is governed by the laws of the Republic of Korea.</li>
    <li>Any dispute arising in connection with this Agreement shall first be resolved by good-faith consultation between the parties; failing such resolution, it shall be finally resolved by arbitration under the rules of the Korean Commercial Arbitration Board.</li>
    <li>The seat of arbitration shall be Seoul, Republic of Korea, and the language of arbitration shall be Korean.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 15. Miscellaneous</h3>
  <ol>
    <li>If any provision of this Agreement is held invalid or unenforceable, the validity of the remaining provisions shall not be affected.</li>
    <li>Matters not specified in this Agreement shall be governed by the Platform’s Terms of Service, applicable laws, and trade customs.</li>
    <li>The Korean version of this Agreement shall be the original; in case of any discrepancy with the English translation, the Korean version shall prevail.</li>
  </ol>
</div>',
 NULL, 2, 1, 'system', 'silica_v2_migration',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  template_name = VALUES(template_name),
  template_title = VALUES(template_title),
  body_html = VALUES(body_html),
  version_no = VALUES(version_no),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'silica_v2_migration';

-- ============================================================
-- 3) Verification (선택 실행)
-- ============================================================
-- SELECT template_code, template_name, is_active, version_no, updated_at
--   FROM contract_templates
--   WHERE template_code LIKE 'funding_subscription%'
--   ORDER BY template_code;
