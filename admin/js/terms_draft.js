/* admin/js/terms_draft.js — Default Terms of Service draft (v387)
 *
 * (2026-05-15 v384) 운영자: '기본 초안을 작성하여 넣어줘.' admin/terms.html
 * 폼이 비어있을 때 (DB 미저장 상태) 자동 채워지는 시드 초안. 운영자가
 * 검토 + 수정 + [저장] 클릭 시에만 실제 DB / user 페이지에 반영됨.
 *
 * (2026-05-15 v387) 운영자: '약관을 강화해줘 (영문, 국문).' 13개 조항을
 * 23개 조항 + 부칙으로 확장. 추가/강화된 핵심:
 *   - 매각 및 정산 조항 (admin/sales.html 의 14~16일 차단 정책 반영)
 *   - 입금/출금 조항 (admin/deposits.html, withdrawals.html 흐름)
 *   - 추천인 보너스 (silica_referral_bonus 테이블)
 *   - 계정 정지/해지 절차
 *   - AML / 자금세탁방지 / 제재 명단 확인
 *   - 스마트 컨트랙트 / 블록체인 외부 의존성 기술 위험 별도 조항
 *   - 세금 / 원천징수 책임 명확화
 *   - 분쟁 해결 단계화 (협의 → 중재/소송)
 *   - 언어 우선 (KO/EN 충돌 시)
 *   - 권리 양도 금지 / 조항 분리성 (severability)
 *
 * 주의 — 본 초안은 SilicaChain 의 운영 모델 (Solana RWA, SilicaSTO
 * 스테이킹, 매월 15일 USDT 이자, 연 1회 Silica 배당, 14~16일 staking lock
 * window, 14~16일 매각 실행 차단, 매각 시 강제 언스테이킹, force majeure)
 * 기반의 출발점입니다. 실제 운영 전 반드시 변호사 검토를 받으세요. 관할
 * 법령 / 회사 본점 소재지 / 분쟁 조항 / 세금 규정은 회사 상황에 맞게 조정
 * 필요.
 *
 * 노출: terms.js 가 `window.SILICA_TERMS_DRAFT` 로 참조.
 */
(() => {
  "use strict";

  const KO_SUBTITLE =
    "SilicaChain (이하 \"회사\") 가 제공하는 SilicaSTO 토큰 발행, 스테이킹, 이자 지급, 배당 분배, 광산 자산 매각, 운영 종료 절차 등 일체의 서비스 이용에 관한 회원과 회사 간의 권리·의무 및 책임 사항을 규정합니다. 본 약관은 회원 가입 시점부터 효력이 발생하며, 회원이 서비스를 계속 이용하는 동안 적용됩니다.";

  const EN_SUBTITLE =
    "These Terms govern the rights, obligations, and responsibilities between SilicaChain (\"the Company\") and its Members regarding the issuance of SilicaSTO tokens, staking, interest payments, dividend distribution, mining asset sale, service wind-down procedures, and all related services provided by the Company. These Terms take effect upon Member registration and remain in force throughout the Member's use of the Service.";

  const KO_BODY = `
<div class="terms-section">
  <div class="inner">
    <h2>제1조 (목적)</h2>
    <p>본 약관은 SilicaChain (이하 "회사") 이 제공하는 SilicaSTO 토큰 발행, 보관, 스테이킹, 이자 지급, 연 배당 분배, 광산 자산 매각 및 정산, 추천인 보너스, USDT 및 토큰 입출금 등 일체의 서비스 (이하 "서비스") 이용에 관한 회원과 회사 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제2조 (용어의 정의)</h2>
    <ul>
      <li><strong>SilicaSTO</strong> — 회사가 발행하는 실물 자산 (규소 광산 운영 수익 및 자산 가치) 을 기반으로 한 보안 토큰. Solana 블록체인상에 발행됩니다.</li>
      <li><strong>Silica 토큰</strong> — 광산 운영 수익 분배 및 보상 지급에 사용되는 보상 토큰.</li>
      <li><strong>스테이킹</strong> — 회원이 보유한 SilicaSTO 토큰을 회사 시스템에 예치하여 이자 및 배당 수령 자격을 확보하는 행위.</li>
      <li><strong>이자</strong> — 스테이킹한 SilicaSTO 수량에 비례하여 매월 15일 (KST) 자동 지급되는 USDT 보상.</li>
      <li><strong>배당</strong> — 광산 운영 회계 결산에 따라 연 1회 Silica 토큰으로 지급되는 추가 보상. 회원이 직접 [Claim] 버튼으로 수령합니다.</li>
      <li><strong>스테이킹 락 윈도우</strong> — 이자 정산 정확성 보장을 위해 매월 14~16일 (KST) 동안 신규 스테이킹·해지 및 매각 실행이 일시 제한되는 기간.</li>
      <li><strong>매각</strong> — 광산 자산 일부 또는 전부를 외부에 처분하는 행위. 매각 실행 시 모든 스테이킹은 자동 해지되며 회원에게 토큰당 교환금액이 정산됩니다.</li>
      <li><strong>지갑</strong> — Solana 호환 비수탁형 지갑. 회원이 직접 비밀키·시드 구문을 보관·관리합니다.</li>
      <li><strong>KYC</strong> — Know Your Customer. 자금세탁방지 및 관계 법령 준수를 위한 본인 확인 절차.</li>
    </ul>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제3조 (서비스의 제공 및 변경)</h2>
    <p>회사는 회원에게 다음 각 호의 서비스를 제공합니다: ① SilicaSTO 토큰 발행 및 보관, ② 스테이킹 및 이자 지급, ③ 연 배당 분배, ④ 광산 자산 매각 및 정산, ⑤ 추천인 보너스 적립 및 지급, ⑥ USDT 및 토큰 입출금 처리, ⑦ 거래 내역 조회 및 보고서 제공, ⑧ 운영 공지 및 고객 안내.</p>
    <p>회사는 안정적인 서비스 제공을 위해 운영, 유지·보수, 점검, 시스템 업그레이드, 외부 블록체인 네트워크 상태에 따라 서비스의 일부 또는 전부를 일시 중단·변경·제한할 수 있으며, 가능한 한 사전에 사이트 공지 또는 이메일을 통해 안내합니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제4조 (회원 가입 및 KYC)</h2>
    <p>① 회원은 회사가 정한 절차에 따라 가입 신청을 하고, 회사가 이를 승인함으로써 서비스 이용 자격을 갖습니다.</p>
    <p>② 회사는 자금세탁방지 (AML), 테러자금조달방지 (CFT), 국제 제재 (Sanctions) 명단 확인, 관계 법령 준수를 위해 회원에게 KYC 절차를 요구할 수 있습니다. KYC 정보 (성명, 거주국, 신분증명서, 거주지 증명, 자금 출처 등) 는 진실하게 제공되어야 합니다.</p>
    <p>③ 회사는 회원이 제공한 정보를 정기적으로 갱신 요청할 수 있으며, KYC 미완료 또는 갱신 거부 시 일부 서비스 (배당 수령, 출금, 매각 정산 등) 가 제한될 수 있습니다.</p>
    <p>④ 회원은 단일 자연인 또는 법인 단위로만 가입 가능하며, 다중 계정 운영은 금지됩니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제5조 (계정 관리, 정지 및 해지)</h2>
    <p>① 회사는 다음 각 호의 사유가 있을 경우 회원의 계정을 사전 통지 없이 일시 정지하거나 해지할 수 있습니다.</p>
    <ul>
      <li>관계 법령, 본 약관 또는 회사의 운영 정책을 위반한 경우</li>
      <li>KYC 정보 위·변조, 타인 명의 도용 또는 다중 계정 운영이 확인된 경우</li>
      <li>국제 제재 명단에 포함되거나 자금세탁·테러자금조달 관련 의심 거래가 확인된 경우</li>
      <li>시스템 부정 이용, 비인가 자동화 도구 (봇, 스크립트) 사용</li>
      <li>회사 또는 다른 회원에게 재산상·신용상 손해를 끼친 경우</li>
    </ul>
    <p>② 회원은 언제든지 서비스 이용 중단 및 계정 해지를 신청할 수 있으나, 스테이킹 중인 자산이나 미수령 보상이 있는 경우 해지 전 정산이 필요합니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제6조 (지갑 연결 및 보안)</h2>
    <p>① 본 서비스는 Solana 호환 비수탁형 지갑을 사용합니다. 회사는 회원의 비밀키, 시드 구문, 지갑 비밀번호를 보관하지 않으며, 어떠한 경우에도 회원에게 요청하지 않습니다.</p>
    <p>② 회원은 본인의 지갑 보안 정보를 안전하게 보관할 책임이 있으며, 분실·도난·노출로 인한 손실은 회원 본인이 부담합니다.</p>
    <p>③ 잘못된 주소로의 전송, 다른 블록체인 네트워크로의 전송, 호환되지 않는 토큰 입금 등은 복구가 불가능합니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제7조 (스테이킹 및 월 이자 지급)</h2>
    <p>① 회원은 보유한 SilicaSTO 토큰을 스테이킹하여 매월 15일 (KST) USDT 형태로 고정 이자를 지급받을 수 있습니다.</p>
    <p>② 이자율은 회사의 운영 정책에 따라 변동될 수 있으며, 변경 사항은 시행일로부터 최소 7일 전에 사이트 공지를 통해 안내됩니다.</p>
    <p>③ 스테이킹 시작·해지 신청은 매월 14~16일 (KST) 의 락 윈도우 기간을 제외한 시점 (즉 17일부터 익월 13일까지) 에만 가능합니다. 이는 매월 15일 자동 이자 정산의 정확성을 보장하기 위함입니다.</p>
    <p>④ 14~16일 자동 이자 지급이 시스템 장애·천재지변 등으로 지연되는 경우, 회사는 정상화 이후 합리적인 기간 내에 관리자 수동 절차를 통해 미지급분을 보전합니다. 이전 누적 미수령 이자는 회원이 직접 [Claim] 으로 언제든 수령할 수 있습니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제8조 (연 배당 분배)</h2>
    <p>① 회사는 광산 운영 회계 결산을 거쳐 연 1회 회원에게 배당을 지급할 수 있습니다. 배당은 Silica 토큰으로 지급되며, 배당 지급일에 스테이킹 상태인 회원에 한해 지급 대상이 됩니다.</p>
    <p>② 회원은 사용자 페이지의 [Claim] 버튼을 클릭하여 배당을 직접 수령합니다. 미수령 배당은 회원이 직접 수령할 때까지 회사 시스템 내에 무기한 유지됩니다.</p>
    <p>③ 배당 풀, 지급 일자, Silica 시세 적용 기준 등은 매년 결산 시점에 결정되며 사전 공지됩니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제9조 (입금 및 출금)</h2>
    <p>① USDT 입금은 회사가 지정한 Solana 지갑 주소로 전송하여 처리합니다. 입금이 자동 확인되지 않을 경우 회원은 트랜잭션 해시를 첨부하여 확인을 요청할 수 있습니다.</p>
    <p>② USDT 또는 토큰 출금은 회원의 신청 후 관리자 검토를 거쳐 처리됩니다. KYC 미완료, 의심 거래 확인, 자금세탁방지법령에 따른 제한 사유 등이 있을 경우 출금은 보류될 수 있습니다.</p>
    <p>③ 입출금 수수료, 처리 한도, 처리 시간 등 세부 사항은 사이트 내 공지를 통해 안내됩니다.</p>
    <p>④ 잘못 입력된 주소, 호환되지 않는 네트워크로의 전송 등 회원 귀책 사유로 발생한 손실은 회사가 책임지지 않습니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제10조 (광산 매각, 운영 종료 및 정산)</h2>

    <h3>10.1 매각 결정 및 사전 공지</h3>
    <p>회사는 광산 자산의 매각이 필요한 경우, 사이트 내 공지사항을 통해 회원에게 사전 공지한 후 매각 절차를 진행할 수 있습니다. 매각 결정은 회사의 경영 판단 또는 외부 환경 변화에 따라 이루어지며, 회사는 매각 시점·매수자 선정·조건 등에 대한 재량을 가집니다. 매각 실행 (시스템 처리) 은 매월 14~16일 (KST 스테이킹 락 윈도우) 을 제외한 시점에 처리됩니다.</p>

    <h3>10.2 매각 시 시나리오 분기</h3>
    <p>매각 시 다음 두 가지 시나리오 중 하나가 적용됩니다.</p>
    <p><strong>가. 인수자가 본 서비스를 그대로 이어가는 경우 (서비스 지속)</strong>
      <br>회사는 회원에게 인수자 정보와 약관 인계 사실을 사전 공지합니다. 인수자는 본 약관과 동일한 조건으로 서비스를 운영하며, 회원의 보유 토큰·스테이킹·미수령 보상은 그대로 유지됩니다.
    </p>
    <p><strong>나. 인수자가 없거나 본 서비스가 종료되는 경우 (운영 종료)</strong>
      <br>제10.3항의 운영 종료 절차가 적용됩니다.
    </p>

    <h3>10.3 운영 종료 절차 (Wind-down)</h3>
    <p>본 서비스가 종료되는 경우, 회사는 종료 예정일 (이하 "출금 마감일") 이전 합리적인 기간 (최대 2개월 이내) 동안 다음 절차를 단계적으로 진행합니다.</p>
    <ul>
      <li><strong>공지사항 게시 (필수)</strong> — 회사는 종료 사실 및 일정을 사이트 내 공지사항에 게시합니다. 별도 배너, 이메일, 기타 연락 수단을 통한 추가 안내는 회사의 재량으로 진행되며 의무 사항은 아닙니다.</li>
      <li><strong>AMM (자동 매수 풀) 활성화</strong> — 회사는 매각 결과 및 잔여 자금을 고려하여 회원이 보유 토큰을 매도할 수 있는 AMM 을 활성화할 수 있습니다. AMM 의 매수 시세는 매각 결과·잔여 유동성·관계 비용을 반영하여 결정되며, 1토큰 = 1 USDT 와 같은 고정 가치를 보장하지 않습니다. AMM 의 USDT 유동성이 소진되는 경우 매수가 중단될 수 있습니다.</li>
      <li><strong>스테이킹 강제 해지</strong> — 회사는 출금 마감일 이전 시점에 모든 회원의 스테이킹을 강제로 해지할 수 있습니다. 강제 해지는 매월 14~16일을 제외한 시점에 처리되며, 강제 해지 사실은 사이트 공지 및 회원 거래 내역에 기록됩니다.</li>
      <li><strong>회원의 출구 의무</strong> — 회원은 출금 마감일까지 보유 토큰을 거래소·AMM 등을 통해 매도하고, 잔여 USDT 및 자산을 출금해야 합니다. 미수령 이자 및 배당은 출금 마감일까지 회원이 직접 [Claim] 으로 수령해야 합니다.</li>
      <li><strong>사이트 폐쇄</strong> — 출금 마감일 이후 사이트는 영구적으로 폐쇄될 수 있습니다.</li>
    </ul>

    <h3>10.4 정산 기준</h3>
    <p>매각 시 회원에게 지급될 정산 금액 (또는 AMM 매수 시세) 은 매각 결과, 잔여 자산, 비용 차감 후 산정되며, 원금 또는 1토큰 = 1 USDT 와 같은 고정 가치를 보장하지 않습니다. 매각 시 손실이 발생한 경우 정산 금액은 원금 이하일 수 있으며, 회원은 이러한 손실 가능성을 인지하고 동의합니다. 구체적 정산 방식 및 산정 기준은 매각 시점의 회사 결정 및 별도 공지에 따릅니다.</p>

    <h3>10.5 미회수 자금</h3>
    <p>출금 마감일까지 회원이 매도·출금·클레임하지 않은 토큰, USDT, 미수령 보상 (이자, 배당, 추천인 보너스 등) 은 출금 마감일 자정 (KST) 을 기준으로 회사에 귀속되며, 회원은 이후 어떠한 형태의 회수도 청구할 수 없습니다.</p>

    <h3>10.6 회원의 책임</h3>
    <p>회원은 본 약관 가입 시 제10조의 절차 및 위험 (원금 손실 가능성, AMM 유동성 소진 가능성, 출금 마감 후 미회수 자금의 회사 귀속 등) 을 인지하고 동의한 것으로 봅니다. 출금 마감일까지의 매도·출금·클레임 행위는 회원 본인의 책임이며, 마감일 이후 미회수에 대한 모든 손해는 회사가 부담하지 않습니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제11조 (추천인 보너스)</h2>
    <p>① 회원은 본인의 추천 코드를 통해 신규 회원을 초대하고, 피추천 회원이 스테이킹을 통해 받는 월 이자에 비례한 보너스를 USDT 로 적립받을 수 있습니다.</p>
    <p>② 적립된 추천 보너스는 회원이 사용자 페이지의 [Claim] 버튼을 클릭하여 본인의 USDT 잔액에 반영합니다. 미수령 보너스는 회원이 직접 수령할 때까지 회사 시스템 내에 유지됩니다.</p>
    <p>③ 보너스 비율, 지급 조건, 적립 한도 등은 회사의 운영 정책에 따라 결정되며, 변경 시 사전 공지됩니다.</p>
    <p>④ 부정한 방법 (다중 계정, 자기 추천, 허위 가입 등) 으로 보너스를 적립한 경우 회사는 보너스 회수 또는 계정 정지 등의 조치를 취할 수 있습니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제12조 (수수료)</h2>
    <p>① 회사는 서비스 운영에 필요한 수수료를 회원에게 청구할 수 있으며, 종류는 다음과 같습니다: ① USDT 출금 수수료, ② 토큰 출금/전송 수수료 (블록체인 가스비 포함), ③ Silica ↔ SilicaSTO swap 수수료, ④ 기타 운영 수수료.</p>
    <p>② 모든 수수료 정책은 적용 전 사이트 내 공지 또는 별도 안내를 통해 사전 고지됩니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제13조 (회원의 의무 및 금지 행위)</h2>
    <p>회원은 다음 각 호의 의무를 부담하며, 위반 시 제5조에 따른 계정 정지 또는 해지의 대상이 될 수 있습니다.</p>
    <ul>
      <li>본인의 지갑 비밀키, 시드 구문, 로그인 정보를 안전하게 보관할 의무</li>
      <li>가입 시 진실한 정보 제공 및 정보 변경 시 즉시 갱신할 의무</li>
      <li>관계 법령, 본 약관 및 회사의 운영 정책 준수</li>
      <li>다음 행위는 절대 금지됩니다:
        <ul>
          <li>타인의 정보 도용, 다중 계정 운영, 가장 거래</li>
          <li>자금세탁, 테러자금조달, 국제 제재 회피, 불법 자금 유통</li>
          <li>비인가 자동화 도구 (봇, 스크립트, 크롤러) 사용</li>
          <li>시스템 취약점 악용, 비인가 접근, 서버 공격, 데이터 변조</li>
          <li>시세 조작, 허위 정보 유포, 다른 회원에게 손해를 끼치는 행위</li>
          <li>관계 법령 또는 공서양속에 반하는 행위</li>
        </ul>
      </li>
    </ul>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제14조 (투자 위험 고지)</h2>
    <p><strong>SilicaSTO 및 Silica 토큰은 투자 상품으로서, 다음과 같은 위험을 수반합니다. 회원은 본인의 판단과 책임 하에 투자 결정을 내려야 하며, 회사는 투자 결과에 대해 어떠한 보장이나 약속도 하지 않습니다.</strong></p>
    <ul>
      <li><strong>원금 손실 가능성</strong> — 투자 원금의 전부 또는 일부를 회수하지 못할 수 있습니다.</li>
      <li><strong>가격 변동성</strong> — 토큰 가격은 시장 상황, 유동성, 거래량, 시장 심리, 외부 사건에 따라 급격히 변동할 수 있습니다.</li>
      <li><strong>운영 위험</strong> — 광산 운영 부진, 자산 가치 하락, 회계 결산 손실 등으로 이자·배당이 감소하거나 미지급될 수 있습니다.</li>
      <li><strong>유동성 부족</strong> — 매수자 부족으로 원하는 시점에 토큰을 매도하지 못할 수 있습니다.</li>
      <li><strong>규제 변경 위험</strong> — 각국의 가상자산·증권법·세법 등의 변경으로 서비스가 제한되거나 구조가 변경될 수 있습니다.</li>
    </ul>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제15조 (기술 및 블록체인 의존 위험)</h2>
    <p>본 서비스는 Solana 블록체인 및 외부 인프라에 의존합니다. 다음과 같은 기술적 위험이 존재합니다.</p>
    <ul>
      <li>스마트 컨트랙트 코드 오류, 취약점, 알려지지 않은 버그</li>
      <li>Solana 네트워크 혼잡, 정지, 포크, 정책 변경</li>
      <li>지갑 소프트웨어 (Phantom, Solflare 등) 오류 또는 호환성 문제</li>
      <li>외부 RPC 노드 (예: Helius) 의 장애 또는 응답 지연</li>
      <li>해킹, 피싱, 악성 코드, 사회공학적 공격</li>
      <li>오라클 (시세 정보 제공자) 의 부정확성 또는 장애</li>
    </ul>
    <p>회사는 이러한 기술적 위험에 대해 합리적 노력을 다하지만, 외부 인프라로 인한 손실에 대해서는 책임을 부담하지 않습니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제16조 (면책 조항 / Force Majeure)</h2>
    <p>다음 각 호의 사유로 인해 서비스 제공이 지연·중단되거나 손해가 발생한 경우, 회사는 책임을 부담하지 않습니다.</p>
    <ul>
      <li>천재지변, 전쟁, 테러, 폭동, 정전, 통신 두절, 인터넷 장애 등 불가항력</li>
      <li>해킹, DDoS 공격, 악성 코드, 외부 침입에 의한 시스템 장애</li>
      <li>Solana 또는 외부 블록체인 네트워크의 일시적 장애·정책 변경</li>
      <li>외부 거래소, 결제 시스템, RPC 노드 등 제3자 서비스의 중단</li>
      <li>관계 법령의 변경, 정부 기관의 명령, 규제 당국의 조치에 따른 서비스 제한</li>
      <li>회원의 귀책 사유 (지갑 키 분실, 잘못된 주소 전송, 정보 미갱신 등)</li>
    </ul>
    <p>매월 14~16일 자동 이자 지급이 위 사유로 지연되는 경우, 회사는 정상화 이후 합리적인 기간 내에 관리자 수동 절차를 통해 미지급분을 보전합니다.</p>
    <p>광산 매각 결정, 매각 결과에 따른 정산 금액 변동, AMM 매수 시세 및 유동성 변동, 운영 종료 후 미회수 자금의 처리에 관해서는 제10조에 따르며, 회사는 이에 따른 회원의 손실에 대해 추가 책임을 부담하지 않습니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제17조 (세금 및 원천징수)</h2>
    <p>① 회원이 서비스 이용 (이자 수령, 배당 수령, 매각 정산, 추천인 보너스 수령 등) 으로 발생하는 모든 세금 (소득세, 양도세, 부가가치세 등) 및 신고 의무는 회원 본인이 부담합니다.</p>
    <p>② 회사는 회원의 거주 국가, 법인 여부, 자금 출처 등을 고려하여 관계 법령상 의무가 있는 경우 원천징수를 수행할 수 있습니다.</p>
    <p>③ 회원은 자신의 거주 국가 및 관할 법령에 따른 세무 처리를 직접 확인해야 하며, 필요 시 세무 전문가의 자문을 받아야 합니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제18조 (개인정보 처리)</h2>
    <p>① 회사는 회원의 개인정보 (성명, 지갑 주소, 이메일, KYC 정보, 거래 내역 등) 를 관계 법령 및 회사의 개인정보 처리 방침에 따라 안전하게 처리합니다.</p>
    <p>② 개인정보는 회원 탈퇴 후에도 관계 법령 (자금세탁방지법, 전자상거래법 등) 이 정하는 기간 동안 보존됩니다.</p>
    <p>③ 자세한 처리 항목, 목적, 보유 기간, 제3자 제공 여부는 별도의 개인정보 처리 방침을 통해 안내됩니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제19조 (지적재산권)</h2>
    <p>본 서비스, 웹사이트, 소스 코드, 디자인, 로고, 문서, 발행 토큰 (SilicaSTO, Silica) 의 모든 지적재산권은 회사에 귀속됩니다. 회원은 회사의 사전 서면 동의 없이 이를 복제·배포·수정·역공학할 수 없습니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제20조 (권리 양도 금지 및 조항의 분리성)</h2>
    <p>① 회원은 회사의 사전 서면 동의 없이 본 약관에 따른 권리·의무 또는 회원 자격을 제3자에게 양도하거나 담보로 제공할 수 없습니다.</p>
    <p>② 본 약관의 어느 조항이 관할 법령에 의해 무효 또는 집행 불가능하다고 판단되는 경우에도, 나머지 조항은 그대로 유효하게 존속합니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제21조 (약관의 변경 및 통지)</h2>
    <p>① 회사는 관계 법령, 서비스 구조, 운영 정책, 보안 정책 등의 변경이 필요한 경우 본 약관을 개정할 수 있습니다.</p>
    <p>② 약관이 변경되는 경우, 회사는 시행일로부터 최소 7일 (회원에게 불리한 변경의 경우 30일) 전에 사이트 공지 또는 등록된 이메일을 통해 안내합니다.</p>
    <p>③ 회원이 시행일까지 거부 의사를 표시하지 않고 서비스를 계속 이용하는 경우, 변경된 약관에 동의한 것으로 봅니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제22조 (언어 우선)</h2>
    <p>본 약관은 한국어 및 영어로 제공됩니다. 양 언어 본 간 해석상의 차이가 있는 경우 한국어 본을 우선합니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>제23조 (분쟁 해결 및 준거법)</h2>
    <p>① 본 약관 및 서비스 이용에 관한 모든 분쟁은 대한민국 법률을 준거법으로 합니다.</p>
    <p>② 회원과 회사 간에 분쟁이 발생한 경우, 양 당사자는 우선 신의 성실의 원칙에 따라 협의를 통해 해결을 시도합니다.</p>
    <p>③ 협의가 30일 이내에 이루어지지 않는 경우, 분쟁은 회사 본점 소재지를 관할하는 법원을 제1심 관할 법원으로 합니다. 양 당사자가 합의하는 경우 대한상사중재원 중재 절차로 진행할 수도 있습니다.</p>
    <p>④ 회원이 소비자에 해당하는 경우, 회원의 주소 또는 거소지 관할 법원에 소를 제기할 수 있습니다.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>부칙</h2>
    <p>① 본 약관은 시행일부터 효력이 발생합니다.</p>
    <p>② 본 약관 시행 전 가입한 회원에게도 본 약관이 적용되며, 회원은 시행일까지 거부 의사를 표시하지 않을 경우 본 약관에 동의한 것으로 봅니다.</p>
  </div>
</div>
`.trim();

  const EN_BODY = `
<div class="terms-section">
  <div class="inner">
    <h2>Article 1. Purpose</h2>
    <p>These Terms of Service ("Terms") govern the rights, obligations, and responsibilities between SilicaChain ("the Company") and its members ("Member") with respect to the issuance and custody of SilicaSTO tokens, staking, interest payments, annual dividend distribution, mining asset sale and settlement, referral bonuses, USDT and token deposits/withdrawals, and all related services provided by the Company (collectively, the "Service").</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 2. Definitions</h2>
    <ul>
      <li><strong>SilicaSTO</strong> — A security token issued by the Company, backed by real-world silica mining operation revenue and asset value, issued on the Solana blockchain.</li>
      <li><strong>Silica Token</strong> — A reward token used for distributing mining operation profits and bonuses to Members.</li>
      <li><strong>Staking</strong> — The act of depositing SilicaSTO tokens into the Company's system to qualify for interest and dividend rewards.</li>
      <li><strong>Interest</strong> — A fixed USDT reward paid out automatically on the 15th of each month (KST), proportional to the staked SilicaSTO amount.</li>
      <li><strong>Dividend</strong> — An annual reward paid in Silica tokens, distributed based on mining operation fiscal settlement. Members claim dividends manually via the [Claim] button.</li>
      <li><strong>Staking Lock Window</strong> — A short period (14th–16th of each month, KST) during which new staking, unstaking, and sale execution are temporarily restricted to ensure accurate interest calculations.</li>
      <li><strong>Sale</strong> — The disposition of part or all of the mining assets to a third party. Upon sale execution, all staking is automatically released and Members receive the per-token settlement amount.</li>
      <li><strong>Wallet</strong> — A Solana-compatible non-custodial wallet. Members are responsible for storing and managing their own private keys and seed phrases.</li>
      <li><strong>KYC</strong> — Know Your Customer. The identity verification process required for anti-money-laundering compliance and applicable laws.</li>
    </ul>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 3. Provision and Modification of Services</h2>
    <p>The Company provides Members with the following Services: (i) issuance and custody of SilicaSTO tokens; (ii) staking and interest payments; (iii) annual dividend distribution; (iv) mining asset sale and settlement; (v) referral bonus accrual and payout; (vi) USDT and token deposit and withdrawal processing; (vii) transaction history and reporting; (viii) operational announcements and customer notices.</p>
    <p>The Company may temporarily suspend, modify, or limit all or part of the Service for operational maintenance, system upgrades, inspections, or due to external blockchain network conditions. The Company will provide reasonable advance notice via on-site announcement or email when possible.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 4. Registration and KYC</h2>
    <p>(1) Members may register for the Service through the procedures established by the Company; eligibility takes effect upon the Company's approval.</p>
    <p>(2) The Company may require Members to complete KYC procedures to comply with anti-money-laundering (AML), counter-terrorism-financing (CFT), international sanctions screening, and applicable laws. KYC information (name, country of residence, government-issued ID, proof of residence, source of funds, etc.) must be provided truthfully.</p>
    <p>(3) The Company may periodically request updates to Member information. Members who do not complete KYC or refuse updates may be restricted from certain Services (such as dividend claims, withdrawals, and sale settlements).</p>
    <p>(4) Registration is permitted only as a single natural person or legal entity; multiple-account operation is prohibited.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 5. Account Management, Suspension, and Termination</h2>
    <p>(1) The Company may suspend or terminate a Member's account without prior notice in the following cases:</p>
    <ul>
      <li>Violation of applicable laws, these Terms, or the Company's operational policies;</li>
      <li>Falsification of KYC information, identity theft, or operation of multiple accounts;</li>
      <li>Inclusion in international sanctions lists, or suspected involvement in money laundering or terrorism financing;</li>
      <li>Use of unauthorized automation tools (bots, scripts) or fraudulent use of the system;</li>
      <li>Causing financial or reputational harm to the Company or other Members.</li>
    </ul>
    <p>(2) Members may request to terminate their account at any time, but any active staking or unclaimed rewards must be settled prior to termination.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 6. Wallet Connection and Security</h2>
    <p>(1) The Service uses Solana-compatible non-custodial wallets. The Company does not store Members' private keys, seed phrases, or wallet passwords, and will never request them.</p>
    <p>(2) Members are solely responsible for safeguarding their wallet credentials. Losses due to loss, theft, or exposure of credentials are borne by the Member.</p>
    <p>(3) Transfers to incorrect addresses, transfers via incompatible blockchain networks, or deposits of incompatible tokens are irreversible.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 7. Staking and Monthly Interest Payments</h2>
    <p>(1) Members may stake their SilicaSTO tokens to receive a fixed monthly interest payout in USDT on the 15th of each month (KST).</p>
    <p>(2) Interest rates may be adjusted under the Company's operational policies; any changes will be announced at least seven (7) days before the effective date.</p>
    <p>(3) Staking and unstaking requests may only be submitted outside the lock window (i.e., from the 17th of the current month through the 13th of the following month, KST). This ensures the accuracy of the automatic interest settlement on the 15th.</p>
    <p>(4) If automatic interest payouts during the 14th–16th window are delayed due to system failures or force majeure events, the Company will make commercially reasonable efforts to settle unpaid amounts through manual administrator procedures after normalization. Previously accumulated unclaimed interest remains available indefinitely via the [Claim] button.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 8. Annual Dividend Distribution</h2>
    <p>(1) Following the fiscal settlement of mining operations, the Company may distribute an annual dividend to Members. Dividends are paid in Silica tokens, and only Members who are actively staking on the dividend payout date are eligible.</p>
    <p>(2) Members claim their dividends by manually clicking the [Claim] button on the user dashboard. Unclaimed dividends remain available indefinitely in the system until claimed.</p>
    <p>(3) The dividend pool, payout date, and applicable Silica price will be determined at each annual settlement and announced in advance.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 9. Deposits and Withdrawals</h2>
    <p>(1) USDT deposits are processed by transferring to the Solana wallet address designated by the Company. If a deposit is not auto-confirmed, the Member may request confirmation by submitting the transaction hash.</p>
    <p>(2) USDT and token withdrawals are processed after Member submission and administrator review. Withdrawals may be held pending if KYC is incomplete, if suspicious transactions are detected, or if restrictions apply under anti-money-laundering laws.</p>
    <p>(3) Deposit and withdrawal fees, processing limits, and processing times are announced on the site.</p>
    <p>(4) Losses caused by Member error (incorrect address, transfer via incompatible network, etc.) are not the responsibility of the Company.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 10. Mining Asset Sale, Service Wind-down, and Settlement</h2>

    <h3>10.1 Sale Decision and Prior Notice</h3>
    <p>If the disposition of the mining assets becomes necessary, the Company may proceed with the sale process following prior notice to Members via on-site announcements. Sale decisions are made based on the Company's business judgment or changes in external conditions, and the Company retains discretion over the timing, buyer selection, and conditions of the sale. Sale execution (system processing) occurs outside the staking lock window (i.e., not during the 14th–16th of each month, KST).</p>

    <h3>10.2 Sale Scenarios</h3>
    <p>Upon a sale, one of the following two scenarios applies:</p>
    <p><strong>(a) Successor takes over the Service (continuity)</strong>
      <br>The Company provides Members with prior notice regarding the successor and the assumption of these Terms. The successor operates the Service under the same conditions, and the Members' holdings, staking, and unclaimed rewards remain unchanged.
    </p>
    <p><strong>(b) No successor / Service terminates (wind-down)</strong>
      <br>The wind-down procedures under Article 10.3 apply.
    </p>

    <h3>10.3 Wind-down Procedures</h3>
    <p>If the Service terminates, the Company shall conduct the following procedures in a phased manner within a reasonable period (up to two (2) months) prior to the termination date (the "Withdrawal Deadline"):</p>
    <ul>
      <li><strong>On-site announcement (mandatory)</strong> — The Company posts the termination fact and schedule on the site's announcement page. Additional notices via banner, email, or other contact channels are at the Company's discretion and not mandatory.</li>
      <li><strong>AMM (Automated Market Maker) activation</strong> — The Company may activate an AMM allowing Members to sell their tokens, taking into account the sale results and remaining funds. The AMM's purchase price is determined based on the sale results, remaining liquidity, and related costs, and does not guarantee any fixed value such as 1 token = 1 USDT. AMM purchases may halt if the USDT liquidity is exhausted.</li>
      <li><strong>Forced unstaking</strong> — The Company may forcibly release all Members' staking before the Withdrawal Deadline. Forced unstaking is processed outside the 14th–16th window of each month and is recorded in the site's announcements and Members' transaction history.</li>
      <li><strong>Member exit obligations</strong> — Members must sell their tokens via exchanges or the AMM and withdraw remaining USDT and assets by the Withdrawal Deadline. Unclaimed interest and dividends must be claimed via the [Claim] button by the Withdrawal Deadline.</li>
      <li><strong>Site closure</strong> — The site may be permanently closed after the Withdrawal Deadline.</li>
    </ul>

    <h3>10.4 Settlement Standards</h3>
    <p>Settlement amounts payable to Members upon sale (or the AMM purchase price) are calculated based on sale results, remaining assets, and after deduction of costs, and do not guarantee any fixed value such as the principal amount or 1 token = 1 USDT. If a loss occurs at sale, the settlement amount may be below the principal, and Members acknowledge and accept this possibility of loss. The specific settlement method and calculation basis follow the Company's decision and separate notices at the time of sale.</p>

    <h3>10.5 Unclaimed Funds</h3>
    <p>Tokens, USDT, and unclaimed rewards (interest, dividends, referral bonuses, etc.) that Members do not sell, withdraw, or claim by the Withdrawal Deadline shall revert to the Company at midnight (KST) on the Withdrawal Deadline, and Members may not claim any form of recovery thereafter.</p>

    <h3>10.6 Member Responsibility</h3>
    <p>By accepting these Terms, Members acknowledge and accept the procedures and risks set forth in Article 10 (including possibility of principal loss, AMM liquidity exhaustion, and reversion of unclaimed funds to the Company after the Withdrawal Deadline). The sale, withdrawal, and claim actions until the Withdrawal Deadline are the sole responsibility of the Member, and the Company shall not be liable for any losses arising from non-recovery after the deadline.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 11. Referral Bonus</h2>
    <p>(1) Members may invite new Members using their referral code and accrue a USDT bonus proportional to the monthly interest earned by the referred Members' staking.</p>
    <p>(2) Accrued referral bonuses are credited to the Member's USDT balance by clicking the [Claim] button on the user dashboard. Unclaimed bonuses remain available indefinitely in the system until claimed.</p>
    <p>(3) Bonus rates, eligibility conditions, and accrual limits are determined by the Company's operational policies and announced in advance when changed.</p>
    <p>(4) If a Member accrues bonuses through fraudulent means (multiple accounts, self-referral, fake registrations, etc.), the Company may reclaim the bonus or suspend the account.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 12. Fees</h2>
    <p>(1) The Company may charge service fees, including: (i) USDT withdrawal fees; (ii) token withdrawal/transfer fees (including blockchain gas fees); (iii) Silica ↔ SilicaSTO swap fees; and (iv) other operational fees.</p>
    <p>(2) All fee policies are disclosed on the site or through separate notices prior to application.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 13. Member Obligations and Prohibited Acts</h2>
    <p>Members bear the following obligations, and violations may result in account suspension or termination under Article 5.</p>
    <ul>
      <li>Obligation to safeguard wallet private keys, seed phrases, and login credentials;</li>
      <li>Obligation to provide truthful information upon registration and update it promptly upon any change;</li>
      <li>Compliance with applicable laws, these Terms, and the Company's operational policies;</li>
      <li>The following acts are strictly prohibited:
        <ul>
          <li>Identity theft, multiple-account operation, or sham transactions;</li>
          <li>Money laundering, terrorism financing, sanctions evasion, or circulation of illicit funds;</li>
          <li>Use of unauthorized automation tools (bots, scripts, crawlers);</li>
          <li>Exploitation of system vulnerabilities, unauthorized access, server attacks, or data tampering;</li>
          <li>Market manipulation, spreading false information, or harming other Members;</li>
          <li>Acts contrary to applicable laws or public order and morals.</li>
        </ul>
      </li>
    </ul>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 14. Investment Risk Disclosure</h2>
    <p><strong>SilicaSTO and Silica tokens are investment products that carry the following risks. Members are solely responsible for their investment decisions, and the Company makes no guarantee or warranty regarding investment returns.</strong></p>
    <ul>
      <li><strong>Risk of Principal Loss</strong> — All or part of the invested amount may not be recovered.</li>
      <li><strong>Price Volatility</strong> — Token prices may fluctuate significantly due to market conditions, liquidity, trading volume, market sentiment, and external events.</li>
      <li><strong>Operational Risk</strong> — Mining operation underperformance, asset value decline, or fiscal settlement losses may reduce or eliminate interest and dividends.</li>
      <li><strong>Liquidity Risk</strong> — Lack of buyers may prevent Members from selling tokens at desired times.</li>
      <li><strong>Regulatory Risk</strong> — Changes in laws, securities regulations, or tax laws in any jurisdiction may restrict or modify the Service.</li>
    </ul>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 15. Technology and Blockchain Risks</h2>
    <p>The Service depends on the Solana blockchain and external infrastructure. The following technical risks exist:</p>
    <ul>
      <li>Smart contract code errors, vulnerabilities, and unknown bugs;</li>
      <li>Solana network congestion, halts, forks, or policy changes;</li>
      <li>Wallet software (Phantom, Solflare, etc.) malfunctions or compatibility issues;</li>
      <li>Outages or response delays in external RPC nodes (e.g., Helius);</li>
      <li>Hacking, phishing, malware, and social-engineering attacks;</li>
      <li>Inaccuracies or outages of oracles (price information providers).</li>
    </ul>
    <p>The Company makes reasonable efforts to address these technical risks but is not liable for losses caused by external infrastructure.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 16. Force Majeure / Limitation of Liability</h2>
    <p>The Company shall not be liable for any damages resulting from delays, interruptions, or losses caused by:</p>
    <ul>
      <li>Acts of God, war, terrorism, riots, power outages, communication failures, internet disruptions, or other force majeure events;</li>
      <li>System failures due to hacking, DDoS attacks, malware, or external intrusions;</li>
      <li>Temporary outages or policy changes in Solana or other external blockchain networks;</li>
      <li>Service interruptions of third-party services (exchanges, payment systems, RPC nodes, etc.);</li>
      <li>Service restrictions imposed by changes in applicable laws, government orders, or regulatory actions;</li>
      <li>Damages caused by Member fault (loss of wallet keys, transmission to incorrect addresses, failure to update information, etc.).</li>
    </ul>
    <p>If automatic interest payouts during the 14th–16th window are delayed due to such events, the Company will make commercially reasonable efforts to settle unpaid amounts through manual administrator procedures after normalization.</p>
    <p>Decisions regarding the mining asset sale, variations in settlement amounts following the sale results, fluctuations in AMM purchase prices and liquidity, and the treatment of unclaimed funds after service termination are governed by Article 10. The Company shall bear no additional liability for Member losses arising therefrom.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 17. Taxes and Withholding</h2>
    <p>(1) All taxes (income tax, capital gains tax, VAT, etc.) and reporting obligations arising from the Member's use of the Service (interest receipt, dividend receipt, sale settlement, referral bonus receipt, etc.) are the sole responsibility of the Member.</p>
    <p>(2) The Company may perform withholding where required by applicable laws, taking into account the Member's country of residence, legal entity status, source of funds, and other factors.</p>
    <p>(3) Members must independently verify tax treatment in their country and jurisdiction and seek advice from tax professionals when necessary.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 18. Personal Information</h2>
    <p>(1) The Company processes Members' personal information (name, wallet address, email, KYC data, transaction history, etc.) in accordance with applicable laws and the Company's Privacy Policy.</p>
    <p>(2) Personal information is retained for the period required by applicable laws (anti-money-laundering laws, e-commerce laws, etc.) even after account termination.</p>
    <p>(3) Detailed processing items, purposes, retention periods, and third-party disclosure are described in the separate Privacy Policy.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 19. Intellectual Property</h2>
    <p>All intellectual property rights in the Service, website, source code, design, logos, documentation, and issued tokens (SilicaSTO, Silica) belong to the Company. Members may not reproduce, distribute, modify, or reverse-engineer any of the foregoing without the Company's prior written consent.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 20. Non-Assignment and Severability</h2>
    <p>(1) Members may not assign or pledge any rights, obligations, or membership status under these Terms to a third party without the Company's prior written consent.</p>
    <p>(2) If any provision of these Terms is held invalid or unenforceable under applicable law, the remaining provisions shall remain in full force and effect.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 21. Amendments and Notices</h2>
    <p>(1) The Company may amend these Terms when changes in applicable laws, service structure, operational policies, or security policies require it.</p>
    <p>(2) Amendments are announced via on-site notice or registered email at least seven (7) days before the effective date (thirty (30) days in advance for changes that are materially unfavorable to Members).</p>
    <p>(3) If a Member does not express objection by the effective date and continues to use the Service, the Member is deemed to have accepted the amended Terms.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 22. Language Priority</h2>
    <p>These Terms are provided in Korean and English. In case of any discrepancy in interpretation between the two language versions, the Korean version shall prevail.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Article 23. Governing Law and Dispute Resolution</h2>
    <p>(1) These Terms and all disputes arising in connection with the Service shall be governed by the laws of the Republic of Korea.</p>
    <p>(2) In the event of a dispute, the Member and the Company shall first attempt resolution in good faith through consultation.</p>
    <p>(3) If consultation does not resolve the dispute within thirty (30) days, the dispute shall be submitted to the court having jurisdiction over the Company's principal office as the court of first instance. The parties may, by mutual agreement, refer the dispute to arbitration administered by the Korean Commercial Arbitration Board.</p>
    <p>(4) Where the Member qualifies as a consumer, the Member may file suit in the court having jurisdiction over the Member's address or place of residence.</p>
  </div>
</div>

<div class="terms-section">
  <div class="inner">
    <h2>Supplementary Provisions</h2>
    <p>(1) These Terms take effect from the effective date specified above.</p>
    <p>(2) These Terms apply to Members who registered before the effective date. Members who do not express objection by the effective date are deemed to have accepted these Terms.</p>
  </div>
</div>
`.trim();

  window.SILICA_TERMS_DRAFT = {
    title_ko:    "이용약관 및 투자 안내",
    title_en:    "Terms of Service & Investment",
    subtitle_ko: KO_SUBTITLE,
    subtitle_en: EN_SUBTITLE,
    body_ko:     KO_BODY,
    body_en:     EN_BODY,
  };
})();
