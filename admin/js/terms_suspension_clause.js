/* admin/js/terms_suspension_clause.js — 사용중지 면책 조항 (v561)
 *
 * 운영자: '사용중지를 관리자가 할 수 있음으로 이에 대한 면책조항이 필요하다.
 *   이용약관에 추가해줘.' 본 파일은 사용중지 / 출금정지 / 자동 처리 / 비복원
 *   원칙 / 면책 범위를 명시한 HTML 블록을 KO/EN 두 버전으로 제공한다.
 *
 *   admin/terms.html 의 [사용중지 면책 조항 추가] 버튼이 이 데이터를 읽어
 *   현재 body 텍스트 영역 끝에 append 한다. 마커 주석 (data-clause-key=
 *   "suspension_disclaimer") 으로 중복 추가 방지.
 *
 * 노출: window.SILICA_SUSPENSION_CLAUSE
 */
(() => {
  "use strict";

  const KO_CLAUSE = `
<!-- BEGIN clause: suspension_disclaimer (v561) -->
<div class="terms-section" data-clause-key="suspension_disclaimer">
  <div class="inner">
    <h2>제○조 사용 제재 및 계정 관리 면책</h2>

    <h3>1. 운영자의 권리</h3>
    <p>SilicaChain (이하 "플랫폼") 의 운영자는 다음 각 호의 사유에 해당하는 경우, 사전 통지 없이 즉시 사용자 계정에 대한 사용 중지 (Account Suspension) 또는 출금 중지 (Withdrawal Suspension) 등의 제재 조치를 취할 수 있는 단독 권한을 보유합니다.</p>
    <ul>
      <li>본 약관 또는 관련 법령 위반의 합리적 의심이 있는 경우</li>
      <li>이상 거래 · 시세 조작 · 자금세탁 등 불법 행위가 의심되는 경우</li>
      <li>신원 인증 (KYC) · 자금 출처 자료 검증에 실패하거나 거부한 경우</li>
      <li>수사기관 · 금융감독기관 · 법원 등의 요청 또는 처분이 있는 경우</li>
      <li>해킹 · 계정 도용 · 보안 사고가 의심되는 경우</li>
      <li>본인 명의 도용 · 미성년자 가입 · 다중 계정 운용 등 약관 위반이 발견된 경우</li>
      <li>플랫폼 안정성 · 다른 사용자 보호를 위해 필요하다고 운영자가 판단하는 경우</li>
    </ul>

    <h3>2. 사용 중지 시 자동 처리</h3>
    <p>운영자가 사용 중지 조치를 적용하는 경우, 다음 사항이 동일 트랜잭션 내에서 자동 처리됩니다.</p>
    <ul>
      <li>미체결 주문 (매수 · 매도) 전체 자동 취소 및 에스크로 환불</li>
      <li>모든 스테이킹 강제 해제 (잠금 토큰 → 유휴 잔액으로 이동)</li>
      <li>대기 중인 출금 신청 (USDT · 토큰) 자동 취소 및 환불</li>
      <li>로그인 · 거래 · 출금 · 기타 모든 쓰기 액션 차단</li>
    </ul>

    <h3>3. 출금 중지 (부분 제재)</h3>
    <p>운영자는 사용 중지가 아닌 출금만 별도로 차단할 수 있습니다. 이 경우 거래 · 스테이킹 · 로그인은 정상적으로 가능하되, USDT 및 토큰의 외부 인출만 차단됩니다. 출금 중지는 추가 신원 검증 · 자금 추적 · 법령 준수 검토 등에 사용됩니다.</p>

    <h3>4. 비복원 원칙</h3>
    <p>제2조에 따라 자동 처리된 사항 (취소된 주문, 해제된 스테이킹, 취소된 출금 신청) 은 사용 중지 해제 시 자동으로 복원되지 않으며, 사용자가 직접 재설정해야 합니다. 사용 중지 기간 동안의 가격 변동 · 이자 미수령 · 거래 기회 상실 등 시점 차이로 인한 손실에 대해 운영자는 책임을 지지 않습니다.</p>

    <h3>5. 이의 제기 및 해제 절차</h3>
    <p>사용 중지 또는 출금 중지를 통보 받은 사용자는 플랫폼의 지원팀 또는 사이트 내 문의 채널을 통해 사유 확인 및 이의 제기를 할 수 있습니다. 운영자는 합리적 검토 후 제재 해제 여부를 결정하며, 최종 결정은 운영자의 단독 재량에 속합니다. 해제 결정 시점 및 방식 또한 운영자의 재량입니다.</p>

    <h3>6. 면책 범위</h3>
    <p>본 조에 정한 운영자의 정당한 제재 행위로 인해 사용자가 입은 손해 (가격 변동에 따른 손실, 거래 기회 상실, 이자 또는 배당 미수령, 그 밖의 일실 이익 등 모든 직접 · 간접적 손해를 포함) 에 대해, 운영자는 고의 또는 중대한 과실이 없는 한 어떠한 책임도 부담하지 않습니다.</p>

    <h3>7. 기록 보존</h3>
    <p>제재 조치와 관련된 사유 · 시각 · 처리 내역 · 환불 내역은 감사 로그 (audit log) 형태로 보존되며, 사용자는 본인 계정에 한해 합리적 범위 내에서 그 기록의 열람을 요청할 수 있습니다.</p>
  </div>
</div>
<!-- END clause: suspension_disclaimer -->
`.trim();

  const EN_CLAUSE = `
<!-- BEGIN clause: suspension_disclaimer (v561) -->
<div class="terms-section" data-clause-key="suspension_disclaimer">
  <div class="inner">
    <h2>Article ○. Account Suspension and Administrative Action Disclaimer</h2>

    <h3>1. Administrator's Rights</h3>
    <p>SilicaChain administrators (the "Platform") reserve the sole and exclusive right to suspend a user's account (Account Suspension) or restrict withdrawals (Withdrawal Suspension), without prior notice and effective immediately, in any of the following circumstances:</p>
    <ul>
      <li>Reasonable suspicion of violating these Terms or applicable laws</li>
      <li>Suspected market manipulation, money laundering, or other illicit activity</li>
      <li>Failure or refusal of identity verification (KYC) or source-of-funds checks</li>
      <li>Request or order from law enforcement, financial regulators, or courts</li>
      <li>Security incidents, suspected hacking, or account compromise</li>
      <li>Terms violations such as identity fraud, underage registration, or multiple accounts</li>
      <li>Other circumstances the administrator deems necessary to protect platform stability or other users</li>
    </ul>

    <h3>2. Automatic Actions on Account Suspension</h3>
    <p>When an administrator places an account under full suspension, the following actions are executed automatically and atomically within a single transaction:</p>
    <ul>
      <li>All open buy and sell orders are cancelled and escrow refunded</li>
      <li>All staked positions are force-unstaked (locked tokens moved to idle balance)</li>
      <li>All pending withdrawal requests (USDT and tokens) are cancelled and refunded</li>
      <li>Login, trading, withdrawals, and all other write actions are blocked</li>
    </ul>

    <h3>3. Withdrawal-Only Restriction</h3>
    <p>Administrators may also impose a withdrawal-only restriction without full account suspension. Under this mode, trading, staking, and login remain available, but USDT and token withdrawals are blocked. This restriction is typically used during enhanced identity verification, fund-source tracing, or regulatory compliance review.</p>

    <h3>4. No Automatic Restoration</h3>
    <p>Items processed under Section 2 (cancelled orders, unstaked positions, cancelled withdrawals) are not automatically restored when the suspension is lifted. The user must re-create them. The administrator shall not be liable for any loss arising from price movements, missed yield or dividend accrual, lost trading opportunities, or other timing-related effects during the suspension period.</p>

    <h3>5. Appeals and Reinstatement</h3>
    <p>A user whose account has been suspended or restricted may contact the platform support team or the on-site inquiry channel to inquire about the reason and submit an appeal. The administrator will review such requests in good faith. Any decision regarding reinstatement, including its timing and method, rests at the administrator's sole discretion.</p>

    <h3>6. Limitation of Liability</h3>
    <p>To the maximum extent permitted by law, the administrator shall not be liable for any direct or indirect damages — including but not limited to losses from price movements, lost trading opportunities, missed interest or dividend accrual, or other consequential losses — arising from the legitimate exercise of the rights described in this article, save in cases of the administrator's willful misconduct or gross negligence.</p>

    <h3>7. Recordkeeping</h3>
    <p>All suspension actions, including reasons, timestamps, processing details, and refund records, are preserved in an audit log. A user may, within reasonable limits and for their own account only, request access to such records.</p>
  </div>
</div>
<!-- END clause: suspension_disclaimer -->
`.trim();

  window.SILICA_SUSPENSION_CLAUSE = {
    clause_key: "suspension_disclaimer",
    body_ko: KO_CLAUSE,
    body_en: EN_CLAUSE,
  };
})();
