// RECON RWA 운영 매뉴얼 v2 — 완전 재구성
const pptxgen = require("./pptxgenjs/dist/pptxgen.cjs.js");

const COLOR = {
  navy: "1E2761", ice: "CADCFC", white: "FFFFFF",
  amber: "F59E0B", amberLight: "FEF3CD", amberBorder: "F0C36D",
  text: "111827", muted: "6B7280", bgLight: "F9FAFB", border: "E5E7EB",
  green: "16A34A", red: "DC2626", blue: "2563EB", orange: "EA580C",
  cardBg: "FFFFFF", sectionBg: "F3F4F6",
};
const FONT_HEAD = "맑은 고딕";
const FONT_BODY = "맑은 고딕";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "RECON RWA 운영 매뉴얼";
pres.author = "RECON RWA";

const TOTAL = 35;

function addHeaderBar(slide, sectionLabel, pageNum) {
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.45, fill: { color: COLOR.navy }, line: { color: COLOR.navy, width: 0 } });
  slide.addText("RECON RWA", { x: 0.4, y: 0.05, w: 4, h: 0.35, fontSize: 13, fontFace: FONT_HEAD, bold: true, color: COLOR.white });
  slide.addText(sectionLabel || "", { x: 4.5, y: 0.05, w: 5, h: 0.35, fontSize: 11, fontFace: FONT_HEAD, color: COLOR.ice, align: "center" });
  slide.addText(`${pageNum} / ${TOTAL}`, { x: 11.5, y: 0.05, w: 1.4, h: 0.35, fontSize: 11, fontFace: FONT_HEAD, color: COLOR.ice, align: "right" });
}
function addFooter(slide) {
  slide.addText("운영 매뉴얼 · v2026.04.25", { x: 0.4, y: 7.15, w: 6, h: 0.25, fontSize: 9, fontFace: FONT_BODY, color: COLOR.muted });
  slide.addText("rwa6.kolstoken.com", { x: 7, y: 7.15, w: 5.9, h: 0.25, fontSize: 9, fontFace: FONT_BODY, color: COLOR.muted, align: "right" });
}
function addTitleBlock(slide, title, subtitle) {
  slide.addText(title, { x: 0.5, y: 0.7, w: 12.3, h: 0.7, fontSize: 32, fontFace: FONT_HEAD, bold: true, color: COLOR.navy });
  if (subtitle) slide.addText(subtitle, { x: 0.5, y: 1.42, w: 12.3, h: 0.45, fontSize: 14, fontFace: FONT_BODY, color: COLOR.muted });
}
function addCard(slide, opts) {
  const { x, y, w, h, title, items, accent } = opts;
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: COLOR.cardBg }, line: { color: COLOR.border, width: 1 }, rectRadius: 0.08 });
  if (accent) slide.addShape(pres.ShapeType.rect, { x, y, w, h: 0.08, fill: { color: accent }, line: { color: accent, width: 0 } });
  slide.addText(title, { x: x + 0.2, y: y + 0.18, w: w - 0.4, h: 0.4, fontSize: 15, fontFace: FONT_HEAD, bold: true, color: COLOR.navy });
  if (items && items.length) {
    const body = items.map((t) => ({ text: t, options: { bullet: { code: "25CF" } } }));
    slide.addText(body, { x: x + 0.25, y: y + 0.65, w: w - 0.5, h: h - 0.85, fontSize: 11.5, fontFace: FONT_BODY, color: COLOR.text, paraSpaceAfter: 4, valign: "top" });
  }
}
function addSectionDivider(slide, sectionNum, sectionTitle, sectionDesc) {
  slide.background = { color: COLOR.navy };
  slide.addText(`Section ${sectionNum}`, { x: 1, y: 2.7, w: 11.3, h: 0.5, fontSize: 18, fontFace: FONT_HEAD, color: COLOR.amber, bold: true });
  slide.addText(sectionTitle, { x: 1, y: 3.2, w: 11.3, h: 1.0, fontSize: 48, fontFace: FONT_HEAD, color: COLOR.white, bold: true });
  if (sectionDesc) slide.addText(sectionDesc, { x: 1, y: 4.3, w: 11.3, h: 0.6, fontSize: 16, fontFace: FONT_BODY, color: COLOR.ice });
  slide.addShape(pres.ShapeType.rect, { x: 1, y: 5.0, w: 1.5, h: 0.06, fill: { color: COLOR.amber }, line: { color: COLOR.amber, width: 0 } });
}
function addProcessStep(slide, x, y, w, h, num, title, desc, color) {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: COLOR.cardBg }, line: { color: COLOR.border, width: 1 }, rectRadius: 0.08 });
  slide.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: y + 0.2, w: 0.6, h: 0.6, fill: { color: color || COLOR.navy }, line: { color: color || COLOR.navy, width: 0 } });
  slide.addText(String(num), { x: x + 0.2, y: y + 0.2, w: 0.6, h: 0.6, fontSize: 22, fontFace: FONT_HEAD, bold: true, color: COLOR.white, align: "center", valign: "middle" });
  slide.addText(title, { x: x + 0.95, y: y + 0.18, w: w - 1.1, h: 0.35, fontSize: 13, fontFace: FONT_HEAD, bold: true, color: COLOR.navy });
  slide.addText(desc, { x: x + 0.95, y: y + 0.5, w: w - 1.1, h: h - 0.55, fontSize: 10.5, fontFace: FONT_BODY, color: COLOR.text, valign: "top" });
}
function addStateBadge(slide, x, y, w, h, code, korean, color) {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: color }, line: { color: color, width: 0 }, rectRadius: 0.1 });
  slide.addText([
    { text: code, options: { fontSize: 13, fontFace: FONT_HEAD, bold: true, color: COLOR.white, breakLine: true } },
    { text: korean, options: { fontSize: 10.5, fontFace: FONT_BODY, color: COLOR.white } },
  ], { x, y, w, h, align: "center", valign: "middle" });
}

// ===== SLIDE 1: COVER =====
let s = pres.addSlide();
s.background = { color: COLOR.navy };
s.addShape(pres.ShapeType.rect, { x: 0, y: 6.0, w: 13.333, h: 1.5, fill: { color: COLOR.amber }, line: { color: COLOR.amber, width: 0 } });
s.addText("RECON RWA", { x: 0.8, y: 1.3, w: 11.7, h: 1.3, fontSize: 72, fontFace: FONT_HEAD, bold: true, color: COLOR.white });
s.addText("Real-World Asset Tokenization on Solana", { x: 0.8, y: 2.7, w: 11.7, h: 0.6, fontSize: 22, fontFace: FONT_BODY, color: COLOR.amber, italic: true });
s.addText("운영 매뉴얼", { x: 0.8, y: 4.0, w: 11.7, h: 1.0, fontSize: 60, fontFace: FONT_HEAD, bold: true, color: COLOR.white });
s.addText("관리자 + 유저 가이드 · 2026.04.25", { x: 0.8, y: 4.95, w: 11.7, h: 0.5, fontSize: 18, fontFace: FONT_BODY, color: COLOR.ice });
s.addText("rwa6.kolstoken.com", { x: 0.8, y: 6.35, w: 11.7, h: 0.6, fontSize: 20, fontFace: FONT_HEAD, bold: true, color: COLOR.navy });

// ===== SLIDE 2: TOC =====
s = pres.addSlide();
addHeaderBar(s, "목차 / Table of Contents", 2);
addTitleBlock(s, "목차", "총 7개 섹션");
const tocItems = [
  ["1", "시스템 개요", "장부형 시스템 · 자산 라이프사이클 · 주요 메뉴", "P.4"],
  ["2", "유저 입금/출금", "USDT 입금 · 토큰 입금 · 출금 신청 · 승인", "P.6"],
  ["3", "자산 등록 + 모금", "자산 생성 · 공개 · 전자계약 · 모금 참여", "P.10"],
  ["4", "토큰 분배", "솔라나 토큰 발행 · 민트 주소 등록 · 클레임", "P.16"],
  ["5", "거래 + 스테이킹 + AMM", "오더북 거래 · 이자 정산 · AMM 자동매수", "P.19"],
  ["6", "매각 정산", "관리자 매각 실행 · 유저 USDT 교환 · 손실 처리", "P.26"],
  ["7", "운영 / 보안 / 부가기능", "환율 · OTP/KYC · 다국어 · 다중지갑 · 감사로그", "P.30"],
];
tocItems.forEach((item, idx) => {
  const y = 1.95 + idx * 0.65;
  s.addShape(pres.ShapeType.roundRect, { x: 0.6, y: y, w: 12.1, h: 0.55, fill: { color: idx % 2 === 0 ? COLOR.bgLight : COLOR.cardBg }, line: { color: COLOR.border, width: 0.5 }, rectRadius: 0.06 });
  s.addShape(pres.ShapeType.ellipse, { x: 0.8, y: y + 0.075, w: 0.4, h: 0.4, fill: { color: COLOR.navy }, line: { color: COLOR.navy, width: 0 } });
  s.addText(item[0], { x: 0.8, y: y + 0.075, w: 0.4, h: 0.4, fontSize: 14, fontFace: FONT_HEAD, bold: true, color: COLOR.white, align: "center", valign: "middle" });
  s.addText(item[1], { x: 1.4, y: y + 0.05, w: 3.5, h: 0.45, fontSize: 14, fontFace: FONT_HEAD, bold: true, color: COLOR.navy, valign: "middle" });
  s.addText(item[2], { x: 5.1, y: y + 0.05, w: 6.5, h: 0.45, fontSize: 11, fontFace: FONT_BODY, color: COLOR.text, valign: "middle" });
  s.addText(item[3], { x: 11.7, y: y + 0.05, w: 0.95, h: 0.45, fontSize: 12, fontFace: FONT_HEAD, bold: true, color: COLOR.amber, align: "right", valign: "middle" });
});
addFooter(s);

// ===== SECTION 1 =====
s = pres.addSlide();
addSectionDivider(s, "1", "시스템 개요", "장부형 시스템과 자산 라이프사이클");

// SLIDE 4
s = pres.addSlide();
addHeaderBar(s, "1. 시스템 개요", 4);
addTitleBlock(s, "장부형(전산) 시스템", "현재 RECON RWA는 장부 기반으로 운영됩니다");
addCard(s, { x: 0.5, y: 2.1, w: 6.1, h: 2.5, title: "장부 시스템이란?", accent: COLOR.navy,
  items: ["유저 입금 = 관리자가 솔라나스캔 확인 후 수동 승인", "토큰 분배 = DB 기록만 (실제 SPL 토큰 보유는 PLATFORM_AMM_ADDRESS)", "거래 = 오더북에서 USDT/토큰 잔고가 DB 상에서 이동", "매각 정산 = vault USDT 풀이 DB에 저장되며, 유저가 토큰 입금 시 차감"] });
addCard(s, { x: 6.8, y: 2.1, w: 6.1, h: 2.5, title: "입금 필수 규칙", accent: COLOR.red,
  items: ["유저는 반드시 사이트의 입금 버튼으로 입금해야 함", "다른 외부 지갑에서 USDT/자산을 보내면 입금자 인식 불가", "관리자는 솔라나스캔에서 입금 주소·수량·시간 확인", "관리자 메모는 유저 측에서도 보임"] });
addCard(s, { x: 0.5, y: 4.7, w: 12.4, h: 2.2, title: "핵심 메뉴 (관리자)", accent: COLOR.amber,
  items: ["대시보드 · 부동산 자산 등록/관리 · 문서 관리 · 매각 관리 · 스테이킹 설정", "유저 관리 · 단체 메일 발송 · 추천인 관리 · 입금 승인 · 출금 신청 · 토큰 출금", "입출금 내역 · 전자계약 관리 · 환경설정 (FX·OTP·KYC·AMM) · 실시간 환율"] });
addFooter(s);

// SLIDE 5: State Diagram
s = pres.addSlide();
addHeaderBar(s, "1. 시스템 개요", 5);
addTitleBlock(s, "자산 라이프사이클", "등록 → 공개 → 모금 → 매입 → 분배 → 운영 → 매각");
const stateY = 2.0, stateW = 1.55, stateH = 0.85, stateGap = 1.78, stateXStart = 0.55;
const states = [
  { code: "등록", ko: "비공개", color: "9CA3AF" },
  { code: "공개", ko: "is_public=1", color: "6366F1" },
  { code: "FUNDING", ko: "모집중", color: COLOR.blue },
  { code: "BUYING", ko: "구매진행", color: COLOR.orange },
  { code: "DISTRIBUTING", ko: "분배중", color: COLOR.green },
  { code: "OPERATING", ko: "운영중", color: COLOR.green },
  { code: "SOLD", ko: "매각", color: COLOR.red },
];
states.forEach((st, i) => {
  const x = stateXStart + i * stateGap;
  addStateBadge(s, x, stateY, stateW, stateH, st.code, st.ko, st.color);
  if (i < states.length - 1) {
    s.addShape(pres.ShapeType.rightArrow, { x: x + stateW + 0.04, y: stateY + 0.27, w: 0.15, h: 0.3, fill: { color: COLOR.muted }, line: { color: COLOR.muted, width: 0 } });
  }
});
const triggers = [
  { idx: 0, text: "관리자 자산\n생성" },
  { idx: 1, text: "공개 체크\nON" },
  { idx: 2, text: "raised ≥ target\n(자동)" },
  { idx: 3, text: "토큰 민트 입력\n+ Distribute" },
  { idx: 4, text: "수동 전환\n(선택)" },
  { idx: 5, text: "Sale Execute\n(비가역)" },
];
triggers.forEach((t) => {
  const x = stateXStart + (t.idx + 0.5) * stateGap - 0.5;
  s.addText(t.text, { x: x, y: stateY + stateH + 0.1, w: 1.5, h: 0.5, fontSize: 8.5, fontFace: FONT_BODY, color: COLOR.muted, align: "center" });
});
addCard(s, { x: 0.5, y: 4.0, w: 4.0, h: 2.6, title: "자동 전환", accent: COLOR.green, items: ["FUNDING → BUYING", "(모집액 ≥ 목표액)", "", "SOLD → 매각(완료)", "(vault 100% 소진)"] });
addCard(s, { x: 4.7, y: 4.0, w: 4.0, h: 2.6, title: "비가역 액션", accent: COLOR.red, items: ["분배 시작 (BUYING → DISTRIBUTING)", "→ 모금 취소 불가", "", "Sale Execute (→ SOLD)", "→ 거래·스테이킹 영구 중단"] });
addCard(s, { x: 8.9, y: 4.0, w: 4.0, h: 2.6, title: "거래 가능 단계", accent: COLOR.blue, items: ["TRADEABLE_STATUSES =", "[DISTRIBUTING, OPERATING]", "", "이 단계에서만 오더북 거래 +", "스테이킹 + 이자 클레임 가능"] });
addFooter(s);

// ===== SECTION 2 =====
s = pres.addSlide();
addSectionDivider(s, "2", "유저 입금 / 출금", "USDT·토큰 입금 승인과 출금 처리");

// SLIDE 7: USDT Deposit
s = pres.addSlide();
addHeaderBar(s, "2. 입금/출금", 7);
addTitleBlock(s, "USDT 입금 (유저 → 플랫폼)", "사이트의 입금 버튼으로만 인식됩니다");
addProcessStep(s, 0.5, 2.0, 6.1, 1.0, 1, "유저가 입금 페이지 접속", "deposit.html → 입금 버튼 클릭 → 표시된 관리자 입금 주소로 USDT 전송", COLOR.navy);
addProcessStep(s, 0.5, 3.1, 6.1, 1.0, 2, "솔라나 트랜잭션 완료", "Phantom/Solflare 등 지갑에서 SPL Transfer 서명 → 블록체인 컨펌 대기", COLOR.navy);
addProcessStep(s, 0.5, 4.2, 6.1, 1.0, 3, "관리자 승인 페이지 진입", "관리자 패널 → 입금 승인 관리 → 신규 입금 요청 자동 표시", COLOR.amber);
addProcessStep(s, 0.5, 5.3, 6.1, 1.0, 4, "솔라나스캔 검증 후 승인", "입금자 지갑/수량/시간 일치 확인 → 승인 → 유저 잔고 자동 반영", COLOR.green);
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.3, title: "절대 주의 사항", accent: COLOR.red,
  items: ["[X] 외부 지갑(거래소·OTC)에서 직접 송금 → 인식 불가", "[X] 관리자 입금 주소를 우회해서 보내면 환불 어려움", "[O] 반드시 사이트의 입금 버튼을 통해서만 진행", "[O] 트랜잭션 컨펌 후 관리자 승인까지 보통 5~30분 소요", "[O] 관리자 메모는 유저 화면에도 표시되므로 신중히 작성"] });
s.addText("솔라나스캔 확인 항목: 송신자 주소 / USDT 수량 / 트랜잭션 시간", { x: 0.5, y: 6.45, w: 12.4, h: 0.45, fontSize: 11, fontFace: FONT_HEAD, bold: true, color: COLOR.amber, align: "center" });
addFooter(s);

// SLIDE 8: USDT Withdraw
s = pres.addSlide();
addHeaderBar(s, "2. 입금/출금", 8);
addTitleBlock(s, "USDT 출금 (플랫폼 → 유저)", "관리자 서명으로 솔라나 트랜잭션 발송");
addProcessStep(s, 0.5, 2.0, 6.1, 1.05, 1, "유저 출금 신청", "withdraw.html → 출금 수량 입력 → OTP 인증 → 신청 등록", COLOR.navy);
addProcessStep(s, 0.5, 3.15, 6.1, 1.05, 2, "관리자 검토", "관리자 패널 → 출금 신청 (USDT) → 신청 목록 확인", COLOR.navy);
addProcessStep(s, 0.5, 4.3, 6.1, 1.05, 3, "Phantom 연결", "관리자 출금 처리 지갑(환경설정에 등록된 주소)으로 Phantom 연결 필수", COLOR.amber);
addProcessStep(s, 0.5, 5.45, 6.1, 1.05, 4, "서명 후 송금", "해당 출금건 승인 클릭 → Phantom 서명 → 솔라나 트랜잭션 완료", COLOR.green);
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "출금 수수료 정책", accent: COLOR.amber,
  items: ["환경설정에서 두 가지 모드 중 선택", "  ① 고정 USDT (예: 1 USDT 차감)", "  ② 비율 % (예: 신청 수량 × 1.5%)", "", "USDT 출금: 신청 수량에서 직접 차감", "토큰 출금: 별도 USDT 잔고에서 차감", "", "음수 입력 차단 (관리자가 - 값 설정 불가)", "출금 처리 지갑 ≠ 입금 전용 지갑 권장"] });
addFooter(s);

// SLIDE 9: Token Deposit/Withdraw
s = pres.addSlide();
addHeaderBar(s, "2. 입금/출금", 9);
addTitleBlock(s, "토큰 입금/출금", "외부 지갑으로 보유 자산 토큰 송수신");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.6, title: "토큰 입금", accent: COLOR.green,
  items: ["외부 지갑에 보관 중인 자산 토큰을 사이트로 입금", "deposit.html → 토큰 선택 → 표시된 주소로 SPL Transfer", "관리자 패널 → 토큰 입금 승인에서 검증 후 승인", "승인 시 유저의 holdings.balance_token 증가", "이때부터 거래·스테이킹 가능"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "토큰 출금", accent: COLOR.orange,
  items: ["보유 토큰을 외부 지갑으로 송신", "withdraw.html → 토큰 선택 → 수량/대상 주소 입력", "OTP 인증 후 신청 등록", "관리자 패널 → 토큰 출금 관리 → Phantom 서명 후 송금", "신청 시 holdings에서 토큰 차감 (승인 전까지 lock)"] });
addFooter(s);

// ===== SECTION 3 =====
s = pres.addSlide();
addSectionDivider(s, "3", "자산 등록 + 모금", "부동산 등록부터 전자계약 모금까지");

// SLIDE 11: Asset Registration
s = pres.addSlide();
addHeaderBar(s, "3. 자산 + 모금", 11);
addTitleBlock(s, "자산 등록 (5단계)", "관리자 패널 → 부동산 자산 등록/관리");
const regSteps = [
  { num: 1, t: "기본 정보 입력", d: "자산명·코드(RSD001 등)·종류·목표액·정산통화·APR·수수료·공급량", c: COLOR.navy },
  { num: 2, t: "이미지 업로드", d: "대표 이미지 + 토큰 이미지 (자산 상세 페이지에서 노출)", c: COLOR.navy },
  { num: 3, t: "핵심정보 등록", d: "위치·면적·평가가·임대료 등 (asset_key_info DB 저장)", c: COLOR.navy },
  { num: 4, t: "문서 업로드", d: "공시서·평가서 등 (PDF/이미지) — 등록 안 해도 공개 가능하나 권장", c: COLOR.amber },
  { num: 5, t: "전자계약 템플릿", d: "다국어 본문 (KO 필수, EN/JA/ZH 권장) — 한 번 발행 시 immutable", c: COLOR.amber },
];
regSteps.forEach((step, i) => addProcessStep(s, 0.5, 2.0 + i * 0.95, 12.4, 0.85, step.num, step.t, step.d, step.c));
s.addText("주의: 정산통화·공급량 등 핵심값은 자산 생성 후 수정 불가 — 신중히 입력", { x: 0.5, y: 6.85, w: 12.4, h: 0.4, fontSize: 12, fontFace: FONT_HEAD, bold: true, color: COLOR.red, align: "center" });
addFooter(s);

// SLIDE 12: Public/Private
s = pres.addSlide();
addHeaderBar(s, "3. 자산 + 모금", 12);
addTitleBlock(s, "공개 토글 (is_public)", "비공개 → 공개 전환으로 유저에게 노출");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.5, title: "비공개 (is_public = 0)", accent: "9CA3AF",
  items: ["자산 생성 직후 기본값", "관리자 패널에만 표시", "유저는 자산 목록·메인페이지에서 볼 수 없음", "데이터 정비 (이미지·문서·계약서) 동안 사용", "수정 자유, 삭제 가능"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.5, title: "공개 (is_public = 1)", accent: COLOR.green,
  items: ["자산 관리 → 공개 체크박스 ON → 저장", "/api/markets API 응답에 포함됨", "assets.html, markets.html, 메인페이지에 노출", "모금 참여 가능 상태가 됨", "공개 상태에서 다시 비공개로 돌릴 수 있으나 권장 안 함"] });
s.addText("일반적으로: 등록 → 핵심정보 → 문서 → 계약서 → (검토) → 공개 ON 순서로 진행", { x: 0.5, y: 6.7, w: 12.4, h: 0.4, fontSize: 12, fontFace: FONT_BODY, color: COLOR.muted, align: "center", italic: true });
addFooter(s);

// SLIDE 13: Funding
s = pres.addSlide();
addHeaderBar(s, "3. 자산 + 모금", 13);
addTitleBlock(s, "유저 모금 참여 (funding.html)", "예치금 → 투자금 입력 → 전자계약 → 참여");
addProcessStep(s, 0.5, 2.0, 12.4, 0.95, 1, "USDT 예치 (선결)", "예치 페이지에서 USDT 입금이 완료되어 있어야 모금 참여 가능", COLOR.navy);
addProcessStep(s, 0.5, 3.05, 12.4, 0.95, 2, "투자금 입력 + 전자계약 작성", "funding.html → 투자할 USDT 입력 → 전자계약서에 서명", COLOR.navy);
addProcessStep(s, 0.5, 4.1, 12.4, 0.95, 3, "참여하기 버튼", "최종 참여하기 클릭 → 계약서 + 투자금이 등록됨 (관리자 서명 대기 상태)", COLOR.amber);
addProcessStep(s, 0.5, 5.15, 12.4, 0.95, 4, "관리자 서명 후 반영", "관리자가 계약서에 서명 → 양측 서명 완료 → 모금액 누적 반영", COLOR.green);
addCard(s, { x: 0.5, y: 6.2, w: 12.4, h: 0.85, title: "변경/재참여 규칙", accent: COLOR.amber,
  items: ["변경: 최종 참여 전이라면 계약서 다시 작성 → 기존 폐기 후 금액 재입력 → 계약 재작성", "재참여: 한 번 참여 후에도 추가 모금 가능 (여러 번 반복)"] });
addFooter(s);

// SLIDE 14: Contract Signing
s = pres.addSlide();
addHeaderBar(s, "3. 자산 + 모금", 14);
addTitleBlock(s, "전자계약 서명 (관리자)", "양측 서명 완료 → 모금 반영");
addCard(s, { x: 0.5, y: 2.0, w: 12.4, h: 1.8, title: "관리자 서명 절차", accent: COLOR.navy,
  items: ["관리자 패널 → 전자계약 관리 → 서명 대기 목록 → 해당 계약서 열기 → 서명 완료 버튼 클릭", "양측 서명이 완료되면 → 유저의 참여 자산이 모금액에 자동 반영"] });
addCard(s, { x: 0.5, y: 3.95, w: 6.1, h: 2.7, title: "정상 진행", accent: COLOR.green,
  items: ["유저 측: 포트폴리오에서 계약 상태 확인 가능", "관리자 측: 전자계약 관리에서 서명 완료 표시", "이후 모금이 raised ≥ target에 도달 시 자동으로 BUYING 상태 전환"] });
addCard(s, { x: 6.8, y: 3.95, w: 6.1, h: 2.7, title: "관리자 거절/취소 시", accent: COLOR.red,
  items: ["관리자가 서명 안 하고 취소 → 유저 투자금 자동 환불", "한 번 서명 완료된 후 취소 방법 = 모금 전체 취소만 가능", "모금 전체 취소 시 모든 참여자 투자금 자동 환불"] });
addFooter(s);

// SLIDE 15: Funding Status
s = pres.addSlide();
addHeaderBar(s, "3. 자산 + 모금", 15);
addTitleBlock(s, "모금 완료 또는 취소", "BUYING 전환 또는 FAILED/CANCELED");
addCard(s, { x: 0.5, y: 2.0, w: 4.0, h: 4.6, title: "모금 완료", accent: COLOR.green,
  items: ["raised_usdt ≥ target_usdt", "OR 마감일 도달 후 충족", "", "→ 자동으로 BUYING 전환", "→ 유저 추가 참여 차단", "→ 관리자가 실제 부동산 매입 진행 (오프라인)"] });
addCard(s, { x: 4.7, y: 2.0, w: 4.0, h: 4.6, title: "모금 실패", accent: COLOR.amber,
  items: ["마감일까지 목표액 미달", "관리자가 cancel-funding API 호출", "", "→ FAILED 상태", "→ 모든 유저 투자금 자동 환불", "→ 모금 자체가 무효 처리"] });
addCard(s, { x: 8.9, y: 2.0, w: 4.0, h: 4.6, title: "매입 취소", accent: COLOR.red,
  items: ["BUYING 상태에서 취소", "관리자가 cancel-funding 실행", "", "→ CANCELED 상태", "→ 모든 유저 투자금 자동 환불", "→ 분배가 시작된 후에는 취소 불가"] });
addFooter(s);

// ===== SECTION 4 =====
s = pres.addSlide();
addSectionDivider(s, "4", "토큰 분배", "솔라나 토큰 발행과 유저 클레임");

// SLIDE 17: Token Issuance
s = pres.addSlide();
addHeaderBar(s, "4. 토큰 분배", 17);
addTitleBlock(s, "솔라나 SPL 토큰 발행 (오프라인)", "관리자가 외부 도구로 발행 후 주소 입력");
addProcessStep(s, 0.5, 2.0, 12.4, 1.0, 1, "Solana CLI 또는 Spl-token-cli로 토큰 발행", "spl-token create-token → spl-token mint <MINT> <수량> (수량 = 모금액과 동일)", COLOR.navy);
addProcessStep(s, 0.5, 3.1, 12.4, 1.0, 2, "토큰명 / 약어 / 메타데이터 설정", "토큰명 = 자산명, 약어 = 자산 ID(예: RSD001), Decimals 보통 6", COLOR.navy);
addProcessStep(s, 0.5, 4.2, 12.4, 1.0, 3, "관리자 패널에서 민트 주소 입력", "자산 관리 → 해당 자산 → 토큰 컨트랙트 주소 입력 + 저장", COLOR.amber);
addProcessStep(s, 0.5, 5.3, 12.4, 1.0, 4, "분배 시작 버튼 (비가역)", "BUYING 상태에서만 가능 → 클릭 → DISTRIBUTING 전환 → 유저 클레임 가능", COLOR.green);
s.addText("주의: 분배 시작 비가역 — 토큰 민트 주소가 잘못되면 되돌릴 수 없음 (사전 검증 필수)", { x: 0.5, y: 6.45, w: 12.4, h: 0.45, fontSize: 12, fontFace: FONT_HEAD, bold: true, color: COLOR.red, align: "center" });
addFooter(s);

// SLIDE 18: Claim
s = pres.addSlide();
addHeaderBar(s, "4. 토큰 분배", 18);
addTitleBlock(s, "유저 토큰 클레임 (claim.html)", "분배 시작 후 자기 몫 토큰 수령");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.6, title: "클레임 공식", accent: COLOR.blue,
  items: ["유저 토큰 = (개인 투자액 / 총 모금액) × 총 발행 토큰", "", "예시:", "총 모금 100,000 USDT, 토큰 100,000개", "내 투자 1,000 USDT → 1,000 토큰 클레임 가능", "", "1 USDT = 1 Token 기준"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "클레임 후 가능한 작업", accent: COLOR.green,
  items: ["오더북에서 거래 (매수/매도)", "스테이킹 풀에 예치 → 월 이자 수령", "외부 지갑으로 토큰 출금", "외부 지갑에서 다시 입금", "매각 시 토큰 → USDT 교환"] });
addFooter(s);

// ===== SECTION 5 =====
s = pres.addSlide();
addSectionDivider(s, "5", "거래 + 스테이킹 + AMM", "오더북·이자 정산·자동 유동성");

// SLIDE 20: Orderbook
s = pres.addSlide();
addHeaderBar(s, "5. 거래·스테이킹·AMM", 20);
addTitleBlock(s, "오더북 거래 (trade.html)", "유저 ↔ 유저 또는 유저 ↔ AMM 직접 매칭");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 2.2, title: "매도 주문", accent: COLOR.red,
  items: ["보유 토큰 + 가격 입력 → 매도 주문 등록", "가격 ≤ 0.8 USDT → AMM 자동 매수 (시스템이 즉시 흡수)", "가격 > 0.8 USDT → 일반 오더북에 등록 (다른 유저 매수 대기)"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 2.2, title: "매수 주문", accent: COLOR.green,
  items: ["USDT 잔고 + 가격 입력 → 매수 주문 등록 (USDT escrow lock)", "오더북에서 일치하는 매도 주문과 매칭", "취소 시 escrow 자동 환불"] });
addCard(s, { x: 0.5, y: 4.3, w: 12.4, h: 2.5, title: "수수료 정책 (자산별 설정 가능)", accent: COLOR.amber,
  items: ["매수자: tradeUsdt × buyer_fee % 추가 지불 (기본 0.5%)", "매도자: tradeUsdt × seller_fee % 차감 후 수령 (기본 0.5%)", "AMM 시스템 본인은 수수료 0% (유저는 항상 정상 수수료 부과)", "수수료 수입은 회계 시스템에서 자동 집계"] });
addFooter(s);

// SLIDE 21: Staking USD example
s = pres.addSlide();
addHeaderBar(s, "5. 거래·스테이킹·AMM", 21);
addTitleBlock(s, "스테이킹 이자 산출", "정산통화 기준으로 월별 계산");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.6, title: "정산통화 = USD 예시", accent: COLOR.blue,
  items: ["지급통화: USDT (고정)", "연이자율: 10%", "유저 투자액: 100 USDT", "", "월이자 계산:", "100 × 0.1 = 10 USDT (연)", "10 / 12 = 0.83 USDT (월)", "", "→ 매월 0.83 USDT 수령"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "정산통화 = KRW 예시", accent: COLOR.amber,
  items: ["지급통화: USDT (고정)", "연이자율: 10%", "유저 투자액: 100 USDT", "모금 완료일 환율: 1,500 KRW/USDT", "실투자금: 150,000 KRW", "", "월이자: 150,000 × 0.1 / 12 = 1,250 KRW", "이자 지급일 환율: 2,000 KRW/USDT", "USDT 환산: 1,250 / 2,000 ≈ 1.6 USDT (월)"] });
addFooter(s);

// SLIDE 22: Staking Rules
s = pres.addSlide();
addHeaderBar(s, "5. 거래·스테이킹·AMM", 22);
addTitleBlock(s, "스테이킹 규칙", "월 13~15일 스테이킹 필수, 14~16일 락");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 2.2, title: "이자 받기 위한 조건", accent: COLOR.green,
  items: ["매월 13일까지 스테이킹 풀에 예치 완료", "13일~15일 사이 단 3일만 예치해도 OK", "권리 입증을 위한 입장표명 + 이자 수령"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 2.2, title: "락(Lock) 기간", accent: COLOR.red,
  items: ["14일 ~ 16일: 스테이킹/언스테이킹 모두 차단", "이 기간 외에는 자유롭게 입출", "락 기간 외에 토큰을 마켓에서 거래 가능"] });
addCard(s, { x: 0.5, y: 4.3, w: 12.4, h: 2.5, title: "권장 시나리오", accent: COLOR.navy,
  items: ["13일: 스테이킹 풀에 예치 → 이자 권리 확보", "14~16일: 락 기간 (정산 진행)", "17일 이후: 언스테이킹 + 자유 거래 가능", "다음 달 13일: 다시 스테이킹 (반복)"] });
addFooter(s);

// SLIDE 23: Interest Claim
s = pres.addSlide();
addHeaderBar(s, "5. 거래·스테이킹·AMM", 23);
addTitleBlock(s, "이자 클레임 (월 15일 오픈)", "스테이킹 잔고 기준 자동 산출 → 유저가 직접 클레임");
addProcessStep(s, 0.5, 2.0, 12.4, 1.0, 1, "관리자: APR 설정 (자산별)", "스테이킹 설정 → 자산별 연이자율 입력 → 다음 달부터 적용", COLOR.navy);
addProcessStep(s, 0.5, 3.1, 12.4, 1.0, 2, "매월 14~16일: 정산 락 기간", "이자 산출이 완료될 때까지 스테이킹/언스테이킹 차단", COLOR.amber);
addProcessStep(s, 0.5, 4.2, 12.4, 1.0, 3, "15일: 클레임 창구 오픈", "유저가 staking.html 또는 claim 페이지에서 이자 받기 버튼 클릭", COLOR.green);
addProcessStep(s, 0.5, 5.3, 12.4, 1.0, 4, "USDT 잔고 자동 입금", "산출된 이자가 유저 balance.usdt에 즉시 추가 → 출금/거래 가능", COLOR.green);
addFooter(s);

// SLIDE 24: AMM Auto-Buy
s = pres.addSlide();
addHeaderBar(s, "5. 거래·스테이킹·AMM", 24);
addTitleBlock(s, "AMM 자동 매수 (저가 보호)", "유저가 ≤ 0.8 USDT로 매도 시 시스템이 즉시 흡수");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.5, title: "작동 원리", accent: COLOR.blue,
  items: ["유저가 가격 ≤ 0.8 USDT 매도 → AMM 자동 트리거", "platform_balance.usdt_balance 풀에서 USDT 지급", "PLATFORM_AMM_ADDRESS가 토큰 보유", "수수료: 유저 매도자 fee 정상 부과 / AMM 자체 fee 없음"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.5, title: "부분 매칭 + Fallthrough", accent: COLOR.green,
  items: ["풀이 충분: 전액 AMM 매칭", "풀이 일부만 가능: 가능한 만큼 AMM, 나머지 오더북 등록", "풀이 0: AMM 건너뛰고 전량 오더북 (에러 없음)", "AMM 비활성: 모든 매도 → 오더북"] });
s.addText("위치: 관리자 패널 → 환경설정 → AMM 유동성 관리", { x: 0.5, y: 6.7, w: 12.4, h: 0.4, fontSize: 12, fontFace: FONT_HEAD, bold: true, color: COLOR.amber, align: "center" });
addFooter(s);

// SLIDE 25: AMM Recycle
s = pres.addSlide();
addHeaderBar(s, "5. 거래·스테이킹·AMM", 25);
addTitleBlock(s, "AMM 토큰 재활용 매각", "축적된 토큰을 다시 오더북에 매도 → 풀 자동 환원");
addProcessStep(s, 0.5, 2.0, 12.4, 1.0, 1, "축적 토큰 확인", "환경설정 → AMM 축적 토큰 섹션에서 자산별 보유 수량 + 오픈주문 잠금 표시", COLOR.navy);
addProcessStep(s, 0.5, 3.1, 12.4, 1.0, 2, "매도 주문 생성", "자산 선택 → 가격 (≥ 0.8 USDT 권장) + 수량 입력 → AMM 매도 주문 생성 클릭", COLOR.amber);
addProcessStep(s, 0.5, 4.2, 12.4, 1.0, 3, "유저가 해당 주문 매수", "오더북에서 일반 매도 주문처럼 보임 → 유저 매수 시 자동 매칭", COLOR.green);
addProcessStep(s, 0.5, 5.3, 12.4, 1.0, 4, "체결 대금 → AMM 풀로 자동 환원", "platform_balance.usdt_balance 자동 증가 → 다음 자동 매수 자금 확보", COLOR.green);
s.addText("동시 오픈 AMM 주문 1,000건 상한 / 모든 작업은 감사 로그에 기록", { x: 0.5, y: 6.45, w: 12.4, h: 0.45, fontSize: 11, fontFace: FONT_BODY, italic: true, color: COLOR.muted, align: "center" });
addFooter(s);

// ===== SECTION 6 =====
s = pres.addSlide();
addSectionDivider(s, "6", "매각 정산", "관리자 매각 실행과 유저 USDT 교환");

// SLIDE 27: Sale Execute
s = pres.addSlide();
addHeaderBar(s, "6. 매각 정산", 27);
addTitleBlock(s, "매각 실행 (관리자, 비가역)", "Sale Execute 클릭 시 자동 정리 작업 실행");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.6, title: "입력 항목", accent: COLOR.navy,
  items: ["실제 매입원가 (actual_acquisition_cost)", "총 매각금액 (sold_price)", "매각세금 + 기타비용", "정산 환율 (Admin Manual FX)", "매각 실행일", "관련 문서 업로드 (회계사 확인서 등)"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "자동 처리 (트랜잭션, 비가역)", accent: COLOR.red,
  items: ["vault_total_usdt 계산 + 저장", "모든 오픈 거래 주문 취소 + 에스크로 환불", "모든 스테이킹 자동 언스테이킹", "매각월 이전 이자 정산 / 이후 이자 중단", "자산 status → SOLD", "신규 거래·스테이킹 영구 차단"] });
addFooter(s);

// SLIDE 28: Settlement Formula
s = pres.addSlide();
addHeaderBar(s, "6. 매각 정산", 28);
addTitleBlock(s, "유저 정산 공식", "비례 분배 + 손실 클램프");
addCard(s, { x: 0.5, y: 2.0, w: 12.4, h: 1.4, title: "공식", accent: COLOR.navy,
  items: ["project_net = 매각가 − (매각세금 + 기타비용)", "investor_ratio = 모금원금 / 실제매입원가  (모금이 차지하는 비중)", "investor_payout = max(0, project_net × investor_ratio)   ← 손실 시 0 클램프", "vault_total_usdt = floor2(investor_payout / FX)   ← 유저 환원 풀"] });
const scenarios = [
  { c: COLOR.green, t: "수익 매각", x: 0.5, items: ["매입 200, 비용 30,", "매각 300, 모금 150", "→ 풀 202.5 USDT", "(원금 + 차익 52.5)"] },
  { c: COLOR.amber, t: "부분 손실", x: 4.7, items: ["매입 200, 비용 30,", "매각 150, 모금 150", "→ 풀 90 USDT", "(원금 60 손실)"] },
  { c: COLOR.red, t: "완전 손실", x: 8.9, items: ["매입 200, 비용 30,", "매각 20, 모금 150", "→ 풀 0 USDT", "(교환 자체 차단)"] },
];
scenarios.forEach((sc) => addCard(s, { x: sc.x, y: 3.55, w: 4.0, h: 3.1, title: sc.t, accent: sc.c, items: sc.items }));
addFooter(s);

// SLIDE 29: User Redemption
s = pres.addSlide();
addHeaderBar(s, "6. 매각 정산", 29);
addTitleBlock(s, "유저 USDT 교환 (sale-detail.html)", "토큰 입금 → 영구 소각 → USDT 지급");
addProcessStep(s, 0.5, 2.0, 6.1, 1.05, 1, "매각 페이지 접속", "sale-detail.html → 매각 자산 정보 + 토큰당 단가 확인", COLOR.navy);
addProcessStep(s, 0.5, 3.15, 6.1, 1.05, 2, "토큰 수량 입력", "정수만 입력 가능 → 교환 버튼 클릭", COLOR.navy);
addProcessStep(s, 0.5, 4.3, 6.1, 1.05, 3, "토큰 영구 소각", "유저의 holdings에서 토큰 차감 (블록체인 트랜잭션 없음, 장부 처리)", COLOR.amber);
addProcessStep(s, 0.5, 5.45, 6.1, 1.05, 4, "USDT 자동 지급", "balance.usdt 즉시 증가 → 출금/거래 가능", COLOR.green);
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "교환 실패 시나리오", accent: COLOR.red,
  items: ["vault = 0 → '정산 가능한 준비금이 없습니다.'", "신청 수량 > vault 잔액 → '남은 정산 준비금을 초과합니다.'", "신청 수량 > 보유 토큰 → '보유 토큰보다 많이 반환할 수 없습니다.'", "정수 미입력 → '토큰 입금 수량은 정수만 입력할 수 있습니다.'", "환율 누락 → '정산 환율을 확인할 수 없습니다.'"] });
addFooter(s);

// ===== SECTION 7 =====
s = pres.addSlide();
addSectionDivider(s, "7", "운영 / 보안 / 부가기능", "환율 · OTP/KYC · 다국어 · 다중지갑");

// SLIDE 31: FX & Settings
s = pres.addSlide();
addHeaderBar(s, "7. 운영·보안·부가기능", 31);
addTitleBlock(s, "환율 (FX) 및 환경설정", "관리자 패널 → 환경설정");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.6, title: "환율 설정", accent: COLOR.blue,
  items: ["지원 통화: KRW, USD, KZT, PHP, GEL, IDR, VND", "1 USDT = ? 통화 형식으로 입력", "적용 범위:", "  • 이자 지급 (월 정산)", "  • 매각 정산 (vault 계산)", "  • 사이트 표시 환산값", "실시간 환율 페이지에서 자동 조회 가능"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "OTP / KYC 토글", accent: COLOR.amber,
  items: ["테스트 시: BYPASS = ON (인증 건너뛰기)", "프로덕션: 반드시 OFF (모든 유저 인증 필수)", ".env 파일과 관리자 패널 모두에서 설정 가능", "관리자 패널 설정이 .env보다 우선", "변경 즉시 적용 (재시작 불필요)"] });
addFooter(s);

// SLIDE 32: i18n
s = pres.addSlide();
addHeaderBar(s, "7. 운영·보안·부가기능", 32);
addTitleBlock(s, "다국어 지원 (i18n)", "유저 4언어 + 관리자 2언어");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.6, title: "유저 페이지", accent: COLOR.navy,
  items: ["한국어 (KO) — 기본", "영어 (EN)", "일본어 (JA)", "중국어 (ZH)", "", "헤더 우상단 언어 드롭다운에서 전환", "선택 언어는 localStorage에 저장"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "관리자 패널", accent: COLOR.amber,
  items: ["한국어 (KO) — 기본", "영어 (EN)", "", "동작 방식:", "  • MutationObserver가 텍스트 노드 자동 번역", "  • EXACT (전체 문장) + PARTS (부분어) 사전 사용", "  • 노드별 캐시로 성능 최적화"] });
addFooter(s);

// SLIDE 33: Multi-wallet
s = pres.addSlide();
addHeaderBar(s, "7. 운영·보안·부가기능", 33);
addTitleBlock(s, "다중 지갑 지원", "Phantom 외 5개 지갑 + Wallet Standard");
const wallets = [
  { name: "Phantom", desc: "가장 많이 쓰이는 솔라나 지갑 (점유율 60%+)", c: COLOR.navy },
  { name: "Solflare", desc: "솔라나 공식 지갑, 모바일/웹/하드웨어 지원", c: COLOR.blue },
  { name: "Backpack", desc: "xNFT 지원, 신규 인기 지갑", c: COLOR.green },
  { name: "Glow", desc: "모바일 친화적 UI", c: COLOR.amber },
  { name: "Coin98", desc: "다체인 지원 (솔라나 포함)", c: COLOR.orange },
  { name: "Trust Wallet", desc: "Binance 계열 다체인 지갑", c: COLOR.red },
];
wallets.forEach((w, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.5 + col * 6.3;
  const y = 2.0 + row * 1.5;
  addCard(s, { x: x, y: y, w: 6.1, h: 1.3, title: w.name, accent: w.c, items: [w.desc] });
});
addFooter(s);

// SLIDE 34: Audit & Security
s = pres.addSlide();
addHeaderBar(s, "7. 운영·보안·부가기능", 34);
addTitleBlock(s, "감사 로그 + 보안", "AMM 작업 + 관리자 액션 추적");
addCard(s, { x: 0.5, y: 2.0, w: 6.1, h: 4.6, title: "AMM 감사 로그", accent: COLOR.navy,
  items: ["기록 대상:", "  • 충전 / 회수 (delta, before, after)", "  • AMM 활성화 / 비활성화", "  • 매도 주문 생성 / 취소", "", "기록 내용: 관리자명 · 시간 · IP · UserAgent", "위치: 환경설정 → AMM 관리자 감사 로그 (최근 50건)"] });
addCard(s, { x: 6.8, y: 2.0, w: 6.1, h: 4.6, title: "보안 안전장치", accent: COLOR.red,
  items: ["관리자 출금 처리 지갑 = 입금 전용 지갑과 분리 권장", "관리자 지갑 미일치 시 출금 거부", "음수 입력 차단 (UI + API 양쪽)", "DB 트랜잭션 + FOR UPDATE 행 잠금 (동시성 보호)", "Phantom/지갑 계정 변경 시 자동 로그아웃"] });
addFooter(s);

// SLIDE 35: Closing
s = pres.addSlide();
s.background = { color: COLOR.navy };
s.addText("매뉴얼 끝", { x: 0.8, y: 2.0, w: 11.7, h: 1.0, fontSize: 60, fontFace: FONT_HEAD, bold: true, color: COLOR.white });
s.addText("문의 및 추가 정보", { x: 0.8, y: 3.1, w: 11.7, h: 0.5, fontSize: 22, fontFace: FONT_BODY, color: COLOR.amber, italic: true });
addCard(s, { x: 0.8, y: 4.0, w: 5.7, h: 2.5, title: "사이트", items: ["프로덕션: rwa6.kolstoken.com", "관리자: rwa6.kolstoken.com/admin", "현재 버전: v2026.04.25.10"] });
addCard(s, { x: 6.8, y: 4.0, w: 5.7, h: 2.5, title: "다음 단계", items: ["테스터 피드백 수집", "성능 최적화 진행 중", "추가 지갑 호환성 확장 예정"] });
s.addText("RECON RWA · Real-World Asset Tokenization on Solana", { x: 0.8, y: 6.85, w: 11.7, h: 0.4, fontSize: 12, fontFace: FONT_BODY, color: COLOR.ice, align: "center" });

pres.writeFile({ fileName: "rwa_manual_v2.pptx" })
  .then((f) => console.log("Saved:", f))
  .catch((e) => console.error(e));
