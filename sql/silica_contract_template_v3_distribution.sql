-- ============================================================
-- SilicaChain 전자계약 템플릿 v3 — 장부(Ledger) 분배 모델 명문화
-- ============================================================
-- 효과:
--   funding_subscription_ko / _en 템플릿을 v3 으로 갱신.
--   v2 의 모든 보호 조항(위험 고지, KYC/AML, 분쟁해결 등)을 유지하면서
--   SilicaChain 의 장부(ledger) 분배 모델을 정확히 반영.
--
-- 핵심 변경 (v2 → v3):
--   제5조 (토큰 발행 및 분배) 재작성:
--     - 사전 발행: SilicaSTO 1,000,000,000 (1B) 가 모금 개시 전 Reserve 지갑에 발행됨.
--       이는 플랫폼 내부 원장(ledger)을 1:1 로 백킹(backing)하는 영구 보관 자산.
--     - 분배 트리거 (3 단계):
--         (a) 투자자 USDT 청약 + 자필 전자서명 + OTP 검증
--         (b) 관리자 자필 서명
--         (c) 유저 Claim 클릭 → 플랫폼 내부 장부에 STO 보유량 기록
--     - **사이트 내부의 모든 STO 이동(Claim / 스테이킹 / 스왑 / 거래)은 장부(ledger) 로
--       처리되며, on-chain SPL Transfer 는 외부 지갑으로의 입금/출금 시에만 발생.**
--     - 매각 분배 분모: "누적 Claim 수량" (= 장부 기준 분배량). 사전 발행량 1B 이 아님.
--
-- 적용 방법:
--   phpMyAdmin → rwa6 DB → SQL 탭 → 이 파일 내용 붙여넣기 → 실행
-- ============================================================

-- ============================================================
-- 1) 한국어 (KO) — v3
-- ============================================================
INSERT INTO `contract_templates`
(`template_code`, `template_name`, `template_title`, `body_html`, `body_text`,
 `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
('funding_subscription_ko', 'SilicaChain 투자 청약 전자계약서 (한국어 v3)',
 '{{asset_name}} 투자 청약 전자계약서',
 '<div class="contract-body" style="line-height:1.75">
  <h2 style="margin:0 0 14px">투자 청약 전자계약서</h2>
  <p>본 계약(이하 "본 계약")은 <strong>{{signed_date_kst}}</strong>(KST) 기준으로 SilicaChain 플랫폼(이하 "플랫폼")과 아래 명시된 투자자(이하 "투자자") 간에 전자적으로 체결되며, 양 당사자는 아래 조항에 동의합니다.</p>

  <h3 style="margin:22px 0 10px">제1조 (정의)</h3>
  <ol>
    <li>"플랫폼"이란 SilicaChain 이 운영하는 RWA 토큰화 서비스 일체를 의미합니다.</li>
    <li>"대상 자산"이란 본 계약 제3조에 기재된, 대한민국 내 규조토(Silica) 광산 자산 및 그 운영권/수익권을 의미합니다.</li>
    <li>"STO 토큰"이란 대상 자산의 청약 권리를 표상하기 위해 발행되는 SPL 토큰을 의미합니다.</li>
    <li>"Silica 토큰"이란 대상 자산의 운영 수익 분배 단위로 사용되는 SPL 토큰을 의미합니다.</li>
    <li>"Reserve 지갑"이란 모금 개시 전 사전 발행된 STO 토큰 전량(1,000,000,000 STO)을 보관하는 플랫폼 관리 지갑으로, 플랫폼 내부 원장의 STO 보유 잔고를 1:1 로 백킹(backing)하는 자산입니다. Reserve 의 STO 는 외부 지갑으로의 출금이 발생할 때에만 on-chain 이동이 일어납니다.</li>
    <li>"Claim"이란 관리자 서명 완료 후 투자자가 플랫폼 UI 의 클레임 버튼을 클릭하여 자신의 청약 STO 보유량이 플랫폼 내부 원장(ledger)에 기록되는 절차를 의미합니다. Claim 행위 자체는 on-chain SPL Transfer 를 발생시키지 않으며, 장부 기재만으로 보유가 확정됩니다.</li>
    <li>"플랫폼 내부 원장(Ledger)"이란 사용자별 STO 보유·스테이킹·스왑·거래·이자·매각 정산 잔고를 기록·관리하는 SilicaChain 의 데이터베이스 기반 회계 시스템을 의미합니다.</li>
    <li>"정산통화"란 대상 자산의 회계·이자 산정에 사용되는 기준 통화(KRW)를 의미하며, 모든 지급은 USDT로 환산되어 이루어집니다.</li>
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
    ※ 본 계약서에는 <strong>USDT 청약금액</strong>만 기재됩니다. 현지통화 환산 금액·적용 환율은 <strong>모금 완료 시점</strong>의 시장 환율로 확정됩니다.
  </p>

  <h3 style="margin:22px 0 10px">제5조 (토큰 발행 및 분배 — 장부(Ledger) 모델)</h3>
  <ol>
    <li><strong>사전 발행:</strong> 모금 개시 이전에 STO 토큰 총량 <strong>1,000,000,000 (1B)</strong> 가 일괄 발행되어 플랫폼 Reserve 지갑에 보관됩니다. 본 STO 는 플랫폼 내부 원장(ledger)에서 사용자별로 기록되는 STO 보유 잔고를 1:1 로 백킹(backing)하는 영구 보관 자산이며, 추가 발행은 일어나지 않습니다.</li>
    <li><strong>분배 비율:</strong> <strong>1 USDT 청약 = 1 STO 토큰</strong> (정수 단위만 거래 가능).</li>
    <li><strong>분배 트리거 (3 단계):</strong>
      <ul>
        <li>(a) 투자자가 USDT 청약 + 본 계약 자필 전자서명 + OTP 검증 완료</li>
        <li>(b) 플랫폼 관리자가 본 계약을 검토 후 자필 서명하여 "완료" 상태로 전환</li>
        <li>(c) 투자자가 플랫폼 UI 의 Claim 버튼을 클릭하면 플랫폼 내부 원장(ledger)에 해당 투자자의 STO 보유량이 즉시 기록되며 보유 효력이 발생함</li>
      </ul>
    </li>
    <li><strong>장부(Ledger) 보유의 의미:</strong> Claim 으로 발생한 STO 보유는 플랫폼 데이터베이스 원장에 기록되며, on-chain SPL Transfer 는 발생하지 않습니다. 이는 거래 수수료(Solana 가스비) 절감, 즉시성, 통합 회계 처리를 위한 표준 운영 방식이며, Reserve 지갑이 1:1 로 백킹하므로 보유의 실질적 가치는 동일하게 보장됩니다. 플랫폼 내부에서 발생하는 모든 STO 이동(스테이킹, 스왑, 거래, 매각 정산 등)도 동일하게 장부 기록으로 처리됩니다.</li>
    <li><strong>외부 지갑 출금 시 on-chain 이전:</strong> 투자자가 보유 STO 를 외부 지갑으로 출금 신청할 경우에만 Reserve 지갑에서 투자자 외부 지갑으로 실제 SPL Transfer 가 발생합니다. 이때 해당 수량만큼 플랫폼 원장 잔고에서 차감됩니다.</li>
    <li><strong>관리자 서명 전 Claim 불가:</strong> (b) 단계 미완료 시 Claim 버튼은 비활성화되며, 투자자는 STO 보유 효력을 가질 수 없습니다.</li>
    <li><strong>매각 분배 분모:</strong> 본 계약 제8조에 의한 매각 정산 시, 1 STO 당 정산금액 산출의 분모는 <strong>"실제 누적 분배(Claim) 된 STO 수량"</strong> (장부 기준) 이며, 사전 발행량(1B) 이나 Reserve 잔량은 분모로 사용되지 않습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제6조 (스테이킹 및 이자)</h3>
  <ol>
    <li>Claim 후 투자자 지갑에 입금된 STO 토큰을 플랫폼에 스테이킹할 경우 약정 연이율(APR) {{apr}}% 가 적용되며, 시스템이 12 등분하여 매월 이자를 지급합니다.</li>
    <li>이자 지급일은 매월 <strong>15일</strong>이며, 해당 월 15일 시장 환율로 USDT 환산되어 지급됩니다.</li>
    <li>매월 <strong>14일~16일</strong>은 정산 기간으로 스테이킹/언스테이킹이 제한되며, 매월 17일부터 재개됩니다.</li>
    <li>이자는 USDT 로 투자자 플랫폼 계좌에 자동 적립되며, Claim 절차를 통해 실제 지갑에 반영됩니다.</li>
    <li>약정 APR 은 대상 자산의 운영 성과·시장 상황·관련 법령 변경에 따라 사전 공지를 거쳐 조정될 수 있습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제7조 (투자 위험 고지 — 중요)</h3>
  <ol>
    <li><strong>원금 비보장:</strong> 본 상품은 예금자보호법 및 금융투자업 관련 보호 대상이 아니며, 자산의 운영·매각 결과에 따라 원금 손실이 발생할 수 있습니다.</li>
    <li><strong>유동성 위험:</strong> STO 토큰은 플랫폼 내 거래만 가능하며, 외부 거래소 상장 전까지는 즉시 환금이 어려울 수 있습니다.</li>
    <li><strong>운영 위험:</strong> 광산 채굴 중단·인허가 변경·자연재해 등으로 운영이 일시 또는 영구 중단될 수 있습니다.</li>
    <li><strong>환율 위험:</strong> 정산통화(KRW)와 USDT 간 환율 변동에 따라 USDT 환산 수익이 감소할 수 있습니다.</li>
    <li><strong>스마트 컨트랙트 위험:</strong> Solana 네트워크 또는 SPL 컨트랙트의 결함, 해킹, 네트워크 장애로 인한 손실 가능성을 인지합니다.</li>
    <li><strong>Reserve 지갑 위험:</strong> Reserve 지갑은 1B STO 전량을 영구 보관하며 플랫폼 원장 잔고를 백킹합니다. Reserve 지갑 키 침해가 발생할 경우 백킹 자산 도난 위험이 존재하며, 플랫폼은 multisig·hardware wallet 등 보안 조치를 통해 이를 최소화합니다.</li>
    <li><strong>규제 위험:</strong> 가상자산·증권형 토큰 관련 법령 변경에 따라 본 상품의 구조·서비스가 변경되거나 종료될 수 있습니다.</li>
    <li><strong>매각 시점 위험:</strong> 매각 환율은 관리자가 매각 실행 시점에 수동 입력하며, 입력 후에는 변경되지 않습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제8조 (매각 정산 — 분배 수량 기준)</h3>
  <ol>
    <li>대상 자산 매각 실행 시, 매각수익에서 매각세금·매각비용을 차감한 순수익 중 투자자 할당분은 본 조 제2항의 산식에 따라 1 STO 당 정산금액으로 환산됩니다.</li>
    <li><strong>1 STO 당 정산금액 = 플랫폼 유저 할당총액 ÷ 누적 분배(Claim) STO 수량</strong>
      <ul>
        <li>분모 = 매각 실행 시점까지 실제로 Claim 되어 투자자 지갑으로 분배된 STO 수량의 합계.</li>
        <li>사전 발행량(1B), Reserve 잔량, 소각 예정량은 분모에서 제외됩니다.</li>
      </ul>
    </li>
    <li>투자자는 본인이 보유한 (Claim 완료된) STO 수량 × 1 STO 당 정산금액 을 USDT 로 수령합니다.</li>
    <li>매각 실행 시 적용 환율은 관리자가 매각 시점에 수동 입력한 값이며, 입력 후 변경되지 않습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제9조 (KYC, AML 및 제재대상 확인)</h3>
  <ol>
    <li>투자자는 신원확인(KYC) 자료가 진실하며, 본인 명의 지갑임을 보증합니다.</li>
    <li>플랫폼은 자금세탁방지법(AML)·테러자금조달금지법·국제 제재 규정에 따라 의심거래를 보고하거나, 제재대상자(OFAC/UN/EU 제재 리스트)와의 거래를 차단할 수 있습니다.</li>
    <li>투자 자금은 합법적 출처에서 유래한 것이어야 하며, 투자자는 자금 출처를 증명할 수 있는 자료를 보관하여야 합니다.</li>
    <li>플랫폼은 의심거래 발견 시 사전 통보 없이 거래를 보류·차단·환불 처리할 수 있습니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제10조 (개인정보 보호)</h3>
  <p>플랫폼은 「개인정보 보호법」 및 관련 법령에 따라 투자자의 개인정보를 수집·이용·보관하며, 동의 없이 제3자에게 제공하지 않습니다. 단 법령에 따른 수사기관·감독기관 요청 또는 KYC/AML 의무 이행을 위한 위탁업체 제공은 예외로 합니다.</p>

  <h3 style="margin:22px 0 10px">제11조 (세무 책임)</h3>
  <p>본 계약 및 본 계약에 기반한 수익 발생에 따른 모든 세금(소득세·양도세·부가가치세 등)은 투자자 본인의 책임이며, 플랫폼은 관련 법령상 원천징수 의무가 있는 경우 이를 이행합니다.</p>

  <h3 style="margin:22px 0 10px">제12조 (불가항력)</h3>
  <p>천재지변, 전쟁, 폭동, 정부조치, 인터넷·블록체인 네트워크 장애, 해킹 등 양 당사자의 합리적 통제 범위를 벗어나는 사유로 인한 의무 불이행에 대해서는 그 책임이 면제됩니다.</p>

  <h3 style="margin:22px 0 10px">제13조 (전자문서 및 전자서명 동의)</h3>
  <p>투자자는 본 계약을 전자문서 형태로 충분히 열람하였으며, 자필 전자서명 및 OTP 검증을 통해 본 계약의 내용에 동의합니다. 본 전자서명은 「전자문서 및 전자거래 기본법」에 따라 자필 서면 서명과 동일한 법적 효력을 가집니다.</p>

  <h3 style="margin:22px 0 10px">제14조 (효력 발생 및 해지)</h3>
  <ol>
    <li>본 계약은 투자자의 자필 전자서명, OTP 검증, 청약금 입금 확인, 관리자 자필 서명 4개 단계가 모두 완료된 시점에 "완료" 상태로 전환됩니다. 이후 투자자는 Claim 버튼을 통해 STO 토큰을 수령할 수 있습니다.</li>
    <li>관리자는 KYC 미흡, 자금세탁 의심, 약관 위반 등의 사유 발견 시 본 계약을 반려할 수 있으며, 이 경우 청약금은 자동 환불되며 STO 분배도 이루어지지 않습니다.</li>
    <li>모금 기간 내 자산이 모집목표를 달성하지 못한 경우 본 계약은 자동 실효되며, 청약금은 7영업일 이내 환불됩니다. 본 계약 실효 시 플랫폼 원장(ledger) 상의 해당 투자자 STO 보유 기록도 함께 무효 처리됩니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제15조 (분쟁 해결 및 준거법)</h3>
  <ol>
    <li>본 계약의 해석 및 효력은 대한민국 법률에 따릅니다.</li>
    <li>본 계약과 관련된 분쟁은 우선 양 당사자의 협의에 따라 해결하며, 협의가 이루어지지 않을 경우 대한상사중재원의 중재 규칙에 따라 중재로 최종 해결합니다.</li>
    <li>중재 장소는 대한민국 서울이며, 중재 언어는 한국어로 합니다.</li>
  </ol>

  <h3 style="margin:22px 0 10px">제16조 (기타)</h3>
  <ol>
    <li>본 계약의 일부 조항이 무효 또는 집행 불가능한 것으로 판단되는 경우에도 다른 조항의 효력에는 영향을 미치지 않습니다.</li>
    <li>본 계약에 명시되지 않은 사항은 플랫폼 이용약관, 관련 법령, 거래 관행에 따릅니다.</li>
    <li>본 계약은 한국어를 정본으로 하며, 영문 번역본과 해석상 차이가 있을 경우 한국어 정본이 우선합니다.</li>
  </ol>
</div>',
 NULL, 3, 1, 'system', 'silica_v3_distribution',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  template_name = VALUES(template_name),
  template_title = VALUES(template_title),
  body_html = VALUES(body_html),
  version_no = VALUES(version_no),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'silica_v3_distribution';

-- ============================================================
-- 2) 영어 (EN) — v3
-- ============================================================
INSERT INTO `contract_templates`
(`template_code`, `template_name`, `template_title`, `body_html`, `body_text`,
 `version_no`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
('funding_subscription_en', 'SilicaChain Investment Subscription Agreement (English v3)',
 '{{asset_name}} Investment Subscription Agreement',
 '<div class="contract-body" style="line-height:1.75">
  <h2 style="margin:0 0 14px">Investment Subscription Agreement</h2>
  <p>This agreement (the "Agreement") is electronically executed as of <strong>{{signed_date_kst}}</strong> (KST) between SilicaChain Platform (the "Platform") and the investor identified below (the "Investor"). Both parties agree to the terms below.</p>

  <h3 style="margin:22px 0 10px">Article 1. Definitions</h3>
  <ol>
    <li>"Platform" means the RWA tokenization service operated by SilicaChain.</li>
    <li>"Underlying Asset" means the diatomaceous earth (Silica) mining asset located in the Republic of Korea, including its operating rights and revenue rights, as specified in Article 3.</li>
    <li>"STO Token" means the SPL token issued to represent the Investor’s subscription rights to the Underlying Asset.</li>
    <li>"Silica Token" means the SPL token used as the unit of operating revenue distribution for the Underlying Asset.</li>
    <li>"Reserve Wallet" means the Platform-controlled wallet that permanently holds the pre-issued supply (1,000,000,000 STO) and backs the Platform’s internal ledger STO balances on a 1:1 basis. STO held in the Reserve Wallet only moves on-chain when an external withdrawal occurs.</li>
    <li>"Claim" means the procedure whereby, after the administrator has signed the contract, the Investor presses the Claim button in the Platform UI to have the corresponding STO holding recorded on the Platform’s internal ledger. The Claim itself does not trigger an on-chain SPL Transfer; the ledger entry alone constitutes valid holding.</li>
    <li>"Internal Ledger" means SilicaChain’s database-based accounting system that records and manages each user’s STO holdings, staking, swaps, trades, interest, and sale settlement balances.</li>
    <li>"Settlement Currency" means the base currency (KRW) used for accounting and interest calculation. All payouts are converted to and settled in USDT.</li>
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
    Note: Only the <strong>USDT subscription amount</strong> is recorded in this Agreement. The local-currency equivalent and applicable FX rate are locked at the <strong>moment of funding completion</strong>.
  </p>

  <h3 style="margin:22px 0 10px">Article 5. Token Issuance and Distribution (Ledger Model)</h3>
  <ol>
    <li><strong>Pre-issuance:</strong> The total STO supply of <strong>1,000,000,000 (1B)</strong> is minted in a single batch prior to funding launch and permanently held in the Platform-controlled Reserve Wallet. This supply backs the Platform’s internal ledger STO balances on a 1:1 basis; no further minting occurs.</li>
    <li><strong>Distribution Ratio:</strong> <strong>1 USDT subscription = 1 STO Token</strong> (integer units only).</li>
    <li><strong>Distribution Trigger (3 steps):</strong>
      <ul>
        <li>(a) Investor completes USDT subscription, electronic signature on this Agreement, and OTP verification</li>
        <li>(b) Platform administrator reviews and signs the Agreement, transitioning it to "Completed" status</li>
        <li>(c) Investor presses the Claim button in the Platform UI; the corresponding STO holding is immediately recorded on the Platform’s internal ledger and the holding becomes effective</li>
      </ul>
    </li>
    <li><strong>Ledger Holding:</strong> STO holdings created by Claim are recorded in the Platform’s database ledger; no on-chain SPL Transfer occurs at this stage. This is the standard operational mode adopted for gas-fee efficiency, immediacy, and unified accounting. The 1:1 backing by the Reserve Wallet ensures the substantive value of the holding is identical. All internal STO movements (staking, swap, trade, sale settlement, etc.) are likewise processed as ledger entries.</li>
    <li><strong>On-chain Transfer on External Withdrawal:</strong> Only when an Investor requests withdrawal of STO to an external wallet does an actual SPL Transfer occur from the Reserve Wallet to the Investor’s external wallet. The corresponding amount is then debited from the Investor’s ledger balance.</li>
    <li><strong>No Claim Before Admin Signature:</strong> Until step (b) is complete, the Claim button is disabled and the Investor’s holding is not effective.</li>
    <li><strong>Sale Distribution Denominator:</strong> For the sale settlement under Article 8, the divisor used to compute "per-STO settlement amount" is the <strong>"actual cumulative claimed (distributed) STO quantity"</strong> (ledger basis). The pre-issued supply (1B) and Reserve balance are NOT used as the divisor.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 6. Staking and Interest</h3>
  <ol>
    <li>If claimed STO Tokens are subsequently staked on the Platform, interest accrues at the stated APR of {{apr}}%, with the system automatically dividing by 12 to pay monthly interest.</li>
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
    <li><strong>Reserve Wallet Risk:</strong> The Reserve Wallet permanently holds the entire 1B STO supply backing the Platform’s ledger balances. A compromise of the Reserve Wallet key could result in theft of the backing assets. The Platform mitigates this through multisig and hardware wallet practices.</li>
    <li><strong>Regulatory Risk:</strong> Changes in laws governing virtual assets or security tokens may alter or terminate the structure of this product.</li>
    <li><strong>Sale-Timing Risk:</strong> The FX rate applied at the time of sale is entered manually by the administrator at the moment of execution and cannot be changed thereafter.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 8. Sale Settlement (Based on Distributed Quantity)</h3>
  <ol>
    <li>Upon execution of the sale of the Underlying Asset, the net proceeds (sale revenue minus sale tax and sale expenses) allocable to investors are converted into a per-STO settlement amount according to Paragraph 2 below.</li>
    <li><strong>Per-STO settlement = total investor allocation ÷ cumulative claimed (distributed) STO quantity</strong>
      <ul>
        <li>Denominator = the total quantity of STO actually claimed and transferred to investor wallets up to the point of sale execution.</li>
        <li>The pre-issued supply (1B), Reserve balance, and pending burn balance are excluded from the denominator.</li>
      </ul>
    </li>
    <li>The Investor receives, in USDT, an amount equal to (claimed STO held by Investor) × (per-STO settlement).</li>
    <li>The FX rate applied at sale execution is entered manually by the administrator at the moment of execution and cannot be changed thereafter.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 9. KYC, AML and Sanctions Screening</h3>
  <ol>
    <li>The Investor warrants that the KYC information provided is true and that the wallet is registered in the Investor’s own name.</li>
    <li>The Platform may report suspicious transactions or block transactions involving sanctioned parties (OFAC/UN/EU lists) in accordance with anti-money-laundering and counter-terrorism-financing laws.</li>
    <li>Investment funds must originate from lawful sources, and the Investor shall retain documents evidencing the source of funds.</li>
    <li>The Platform may suspend, block, or refund transactions without prior notice upon detecting suspicious activity.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 10. Privacy Protection</h3>
  <p>The Platform collects, uses, and stores the Investor’s personal information in accordance with the Personal Information Protection Act and applicable laws, and does not provide such information to third parties without the Investor’s consent. Exceptions apply to disclosures to investigative or regulatory authorities under applicable law and to processors engaged for KYC/AML compliance.</p>

  <h3 style="margin:22px 0 10px">Article 11. Tax Responsibility</h3>
  <p>All taxes arising from this Agreement and the resulting returns (including income tax, capital gains tax, and value-added tax) are the sole responsibility of the Investor. The Platform shall fulfill any withholding obligations as required by applicable law.</p>

  <h3 style="margin:22px 0 10px">Article 12. Force Majeure</h3>
  <p>Neither party shall be liable for any failure of performance caused by events beyond reasonable control, including acts of God, war, civil unrest, governmental actions, internet or blockchain network outages, or hacks.</p>

  <h3 style="margin:22px 0 10px">Article 13. Consent to Electronic Document and Signature</h3>
  <p>The Investor has reviewed this Agreement in electronic form and agrees to its terms by handwritten electronic signature and OTP verification. Such electronic signature has the same legal effect as a handwritten written signature in accordance with the Framework Act on Electronic Documents and Electronic Transactions.</p>

  <h3 style="margin:22px 0 10px">Article 14. Effective Date and Termination</h3>
  <ol>
    <li>This Agreement transitions to "Completed" status upon completion of all four steps: Investor electronic signature, OTP verification, deposit confirmation, and administrator handwritten signature. Upon completion, the Investor may receive STO Tokens via the Claim button.</li>
    <li>The administrator may reject this Agreement upon discovery of insufficient KYC, suspicion of money laundering, or violation of terms, in which case the subscription will be automatically refunded and no STO will be distributed.</li>
    <li>If the Underlying Asset fails to reach its funding target within the funding period, this Agreement shall automatically lapse and the subscription will be refunded within seven (7) business days. Upon lapse, the Investor’s STO holding record on the Platform ledger is correspondingly invalidated.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 15. Dispute Resolution and Governing Law</h3>
  <ol>
    <li>This Agreement is governed by the laws of the Republic of Korea.</li>
    <li>Any dispute arising in connection with this Agreement shall first be resolved by good-faith consultation between the parties; failing such resolution, it shall be finally resolved by arbitration under the rules of the Korean Commercial Arbitration Board.</li>
    <li>The seat of arbitration shall be Seoul, Republic of Korea, and the language of arbitration shall be Korean.</li>
  </ol>

  <h3 style="margin:22px 0 10px">Article 16. Miscellaneous</h3>
  <ol>
    <li>If any provision of this Agreement is held invalid or unenforceable, the validity of the remaining provisions shall not be affected.</li>
    <li>Matters not specified in this Agreement shall be governed by the Platform’s Terms of Service, applicable laws, and trade customs.</li>
    <li>The Korean version of this Agreement shall be the original; in case of any discrepancy with the English translation, the Korean version shall prevail.</li>
  </ol>
</div>',
 NULL, 3, 1, 'system', 'silica_v3_distribution',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  template_name = VALUES(template_name),
  template_title = VALUES(template_title),
  body_html = VALUES(body_html),
  version_no = VALUES(version_no),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'silica_v3_distribution';

-- ============================================================
-- 3) Verification (선택 실행)
-- ============================================================
-- SELECT template_code, template_name, version_no, is_active, updated_at
--   FROM contract_templates
--   WHERE template_code IN ('funding_subscription_ko', 'funding_subscription_en')
--   ORDER BY template_code;
