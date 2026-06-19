# H9 — 신탁형(Custodial) 약관 조항 초안

> **용도**: audit H9 대응 — 공개운영 전 약관에 "신탁형 자금 보관" 을 명확히 고지.
> **적용 위치**: `admin/terms.html` (약관 본문은 DB `legal_terms` 테이블에 저장됨 — admin 패널에서 KO/EN 편집).
> **⚠ 법무 검토 필수**: 아래는 AI 작성 초안. 실제 약관 반영 전 변호사 검토 필요.
> **작성**: 2026-06-12 (audit H9)

기존 약관에 이미 "제10조 (광산 매각, 운영 종료 및 정산)" 가 있는 것으로 확인됨 → 아래는 **신탁형 명시 + 면책·위험 고지 보강** 중심. 조 번호는 기존 약관 체계에 맞게 조정.

---

## 제○조 (자금의 보관 및 운영 — 신탁형 / Custody and Operation of Funds — Custodial)

**[KO]**
1. 회사는 이용자가 예치한 자금(USDT 및 발행 토큰)을 **회사가 운영·관리하는 지갑 및 내부 장부(ledger)** 에 보관한다.
2. 스테이킹, 이자 지급, 배당, 스왑 등 모든 자산 운용은 **블록체인의 자동 실행이 아니라 회사의 운영 처리** 로 이루어진다.
3. 토큰(SilicaSTO, Silica)은 Solana 네트워크에 발행되나, **자금의 보관 및 정산을 블록체인이 자동으로 보장하지 아니한다.**
4. 이용자는 본 서비스가 비신탁(non-custodial)·탈중앙(decentralized) 구조가 아니라, **회사가 자금을 보관·운용하는 신탁형(custodial) 구조** 임을 이해하고 이에 동의한다.

**[EN]**
1. The Company holds user-deposited funds (USDT and issued tokens) in **wallets and internal ledgers operated and managed by the Company**.
2. All asset operations — including staking, interest payments, dividends, and swaps — are performed **by the Company's operations, not by automatic blockchain execution**.
3. Tokens (SilicaSTO, Silica) are issued on the Solana network; however, **the custody and settlement of funds are not automatically guaranteed by the blockchain.**
4. The user understands and agrees that this service is **not a non-custodial or decentralized structure, but a custodial structure in which the Company holds and operates the funds.**

---

## 제○조 (면책 및 위험 고지 / Disclaimer and Risk Disclosure)

**[KO]**
1. 천재지변, 서버 장애, 네트워크 중단 등 **불가항력(force majeure)** 으로 인한 이자·배당 지급 지연 또는 미지급에 대하여, 회사는 고의 또는 중대한 과실이 없는 한 책임을 지지 아니한다.
2. 투자 상품은 **원금 손실의 가능성** 이 있으며, 회사는 원금 또는 수익을 보장하지 아니한다. 토큰의 1 USDT 기준가 유지는 회사의 운영 정책이며 온체인으로 보장되지 아니한다.
3. 회사의 파산, 해산, 자금 운용 위험 등으로 인한 손실 가능성이 존재하며, 이용자는 이를 인지하고 투자한다.

**[EN]**
1. The Company shall not be liable for any delay or failure in interest or dividend payments caused by **force majeure** (natural disasters, server failures, network interruptions, etc.), except in cases of the Company's willful misconduct or gross negligence.
2. Investment products **carry the risk of loss of principal**; the Company does not guarantee principal or returns. The 1-USDT reference value of tokens is the Company's operational policy and is not guaranteed on-chain.
3. There is a risk of loss due to the Company's bankruptcy, dissolution, or fund operation risks, and the user invests with awareness of this.

---

## 적용 절차 (운영자)

1. **법무 검토** — 위 초안을 변호사에게 검토받아 문구·조 번호·관할 법령 적합성 확인.
2. **admin/terms.html** 접속 → 약관 편집 → 위 조항을 기존 약관 체계에 맞게 KO/EN 각각 삽입.
3. 기존 "제10조 (운영 종료/정산)" 와 중복·충돌 없는지 확인.
4. 공개운영 시점에 사용자가 가입·투자 시 약관 동의를 받는 흐름 확인.

## 함께 적용된 H9 코드 변경 (2026-06-12)

- `user/assets/js/i18n.js`: dead entry "온체인 전 과정 검증 가능" → 신탁형 사실로 정정 (KO+EN).
- `user/landing.html`: SilicaSTO 카드 "원금 안정 보존(preserve principal)" → "회사가 1:1 기준가 유지(원금 보장 아님)" 로 완화 (footer "원금 손실 가능" 과 모순 해소).
- `user/assets/includes/site-footer.html`: 전 페이지 footer 에 신탁형 고지 문단 추가 (KO + i18n EN 매핑).
