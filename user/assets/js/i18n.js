(() => {
  "use strict";

  const STORAGE_KEY = "rwa_lang_user_v1";
  const LANGS = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
  ];
  const LOCALES = { ko: "ko-KR", en: "en-US" };

  const EXACT = {
    en: {
  // Header & dropdown (Concept 1) — EXACT 매칭으로 안정 보장
  "입출금": "Transfers",
  "지갑 연결": "Connect Wallet",
  "지갑 해제": "Disconnect Wallet",
  "지갑 연결 해제": "Disconnect Wallet",
  "OTP 등록": "Setup OTP",
  "OTP 인증": "Verify OTP",
  "Connected Wallet": "Connected Wallet",
  "투자 상품은 원금 손실 가능성이 있으며, 시세와 수익은 변동될 수 있습니다. 이 페이지의 표기는 이해를 돕기 위한 정보입니다.": "Investment products may result in loss of principal, and prices and returns may fluctuate. Information on this page is provided for easier understanding.",
  "사용자 예치 자금은 회사가 운영·관리하는 지갑 및 내부 장부에 보관되며, 스테이킹·이자·배당·스왑은 블록체인의 자동 실행이 아니라 회사의 운영 처리로 이루어집니다(신탁형 운영). 토큰(SilicaSTO·Silica)은 Solana 에 발행되나, 자금 보관·정산을 블록체인이 자동 보장하지 않습니다.": "User-deposited funds are held in wallets and internal ledgers operated and managed by the company. Staking, interest, dividends, and swaps are processed by the company's operations, not by automatic blockchain execution (custodial model). Tokens (SilicaSTO and Silica) are issued on Solana, but the custody and settlement of funds are not automatically guaranteed by the blockchain.",
  "모금 → 매입 → 토큰 분배(클레임) → 거래 → 스테이킹 이자 → 매각 정산(차익)": "Funding → Acquisition → Token Distribution (Claim) → Trading → Staking Interest → Sale Settlement (Profit)",
  "스테이킹 잔고 기준으로 매월 15일에 이자 클레임이 열립니다. 정산 기간(14~16일)에는 스테이킹/언스테이킹이 제한됩니다.": "Interest claims open on the 15th of each month based on your staking balance. Staking and unstaking are restricted during the settlement period (14th–16th).",
  // (2026-05-14 v355) backend staking.php 의 jsonError 메시지 풀-센텐스 매핑.
  //   기존 word-by-word 매칭이 "SETTLEMENT PERIOD에는 STAKING/해제가
  //   제한됩니다." 같이 한/영 mix 결과를 만들었음 — full-sentence 매핑이
  //   translateExact() 에서 우선되어 깔끔한 영문으로 치환되도록 추가.
  "정산 기간에는 스테이킹/해제가 제한됩니다.": "Staking and unstaking are restricted during the settlement period.",
  "Google Authenticator 앱에서 QR을 스캔하거나, 아래 키를 수동 등록하세요.": "Scan the QR code with Google Authenticator or register the key below manually.",
  "Google Authenticator의 6자리 코드를 입력하세요.": "Enter the 6-digit code from Google Authenticator.",
  "팬텀 지갑으로 USDT를 관리자 입금지갑으로 전송하면 잔액이 반영됩니다.": "When you send USDT from Phantom to the admin deposit address, your balance will be credited.",
  "모금 참여자는 클레임을 통해 토큰을 수령할 수 있으며, 거래 준비가 완료된 자산은 거래도 가능합니다.": "Participants can claim tokens, and assets ready for trading can also be traded.",
  "거래, 스테이킹, 이자 클레임 등 운영 기능을 사용할 수 있습니다.": "You can use operating functions such as trading, staking, and interest claims.",
  "모집 미달 자산은 환불/내역 확인이 가능합니다.": "For underfunded assets, you can check refunds and history.",
  "토큰 수령이 완료되었습니다.": "Your token claim has been completed.",
  "수령한 토큰으로 스테이킹 또는 다음 단계를 진행할 수 있습니다.": "You can proceed to staking or the next step with the claimed tokens.",
  "수령이 끝난 뒤에는 스테이킹 풀에서 예치하거나 거래 페이지로 이동할 수 있습니다.": "After claiming, you can deposit into the staking pool or move to the trading page.",
  "기존 계약서는 자동 파기되며, 새로운 금액으로 다시 작성해야 합니다.": "The existing contract will be automatically discarded, and you must draft it again with the new amount.",
  "해당 국가의 통화로 환산되어 투자됩니다.": "Your investment is converted into the local currency of that country.",
  "지급 시점의 환율로 USDT로 지급됩니다.": "It is paid in USDT based on the exchange rate at the time of payment.",
  "이 상품에 대해 제출하거나 체결한 계약 이력을 모두 확인할 수 있습니다.": "You can review all submitted or completed contract records for this product.",
  "지갑을 연결하면 내 자산, 클레임, 매각 정산을 확인할 수 있습니다.": "Connect your wallet to check your assets, claims, and sale settlements.",
  "자산 목록과 동일한 기준으로 상위 3개 자산을 표시합니다.": "The top 3 assets are shown using the same criteria as the asset list.",
  "최근 거래 기준으로 표시됩니다.": "Displayed based on recent trades.",
  "토큰 가격은 시장 거래에 의해 변동될 수 있습니다. 매각 정산은 정산 준비금 상황에 따라 순차적으로 진행됩니다.": "Token prices may fluctuate based on market trading. Sale settlements are processed sequentially depending on the settlement reserve status.",
  "첫 참여 전에만 설정할 수 있습니다.": "It can only be set before your first participation.",
  "보유 USDT 잔액에서 차감됩니다.": "It will be deducted from your available USDT balance.",
  "해당 자산 참여자만 토큰을 받을 수 있습니다.": "Only participants in this asset can claim tokens.",
  "참여 내역이 있는 사용자만 확인할 수 있습니다.": "Only users with participation history can view this.",
  "현재 자산은 매각 상태입니다. 신규 스테이킹과 당월 이자 배정은 중단되며, 이전 미클레임 이자 클레임과 언스테이킹만 가능합니다.": "This asset is in sale status. New staking and current-month interest accrual are suspended, and only previous unclaimed interest claims and unstaking are available.",
  "동일 요청을 처리 중입니다. 잠시만 기다려 주세요.": "The same request is already being processed. Please wait a moment.",
  "매각일 기준으로 고정된 환율이 적용되며, 토큰 입금 즉시 영구 소각 후 비율만큼 USDT가 지급됩니다.": "The exchange rate fixed on the sale date is applied, and USDT is paid in proportion immediately after the token deposit is burned permanently."
},


  };

  const PARTS = {
    en: {
  "관리자 대시보드": "Admin Dashboard",
  "관리자 로그인": "Admin Login",
  "관리자": "Admin",
  "회계 통계": "Accounting",
  "관리 메뉴": "Admin Menu",
  "부동산 자산 등록/관리": "Asset Management",
  "자산 등록/관리": "Asset Management",
  "문서/계약 관리": "Documents / Contracts",
  "문서 관리": "Document Management",
  "매각 관리": "Sale Management",
  "스테이킹 설정": "Staking Settings",
  "유저 관리": "User Management",
  "추천인 관리": "Referral Management",
  "입금 승인 관리": "Deposit Approvals",
  "출금 신청": "Withdrawal Requests",
  "출금 신청 (USDT)": "USDT Withdrawal Requests",
  "토큰 출금 관리": "Token Withdrawal Management",
  "토큰 출금": "Token Withdrawals",
  "환경설정": "Settings",
  "실시간 환율": "Live FX",
  "홈 · RECON RWA": "Home · RECON RWA",
  "소개 · RECON RWA": "About · RECON RWA",
  "자산 · RECON RWA": "Assets · RECON RWA",
  "자산 상세 · RECON RWA": "Asset Details · RECON RWA",
  "차트 · RECON RWA": "Chart · RECON RWA",
  "클레임 · RECON RWA": "Claim · RECON RWA",
  "입금 · RECON RWA": "Deposit · RECON RWA",
  "출금 · RECON RWA": "Withdrawal · RECON RWA",
  "모금 참여 · RECON RWA": "Funding · RECON RWA",
  "포트폴리오 · RECON RWA": "Portfolio · RECON RWA",
  "추천인 · RECON RWA": "Referral · RECON RWA",
  "매각 상세 · RECON RWA": "Sale Details · RECON RWA",
  "매각 · RECON RWA": "Sale · RECON RWA",
  "매각일": "Sale Date",
  "스테이킹 · RECON RWA": "Staking · RECON RWA",
  "KYC 인증 · RECON RWA": "KYC Verification · RECON RWA",
  "KYC 기본 정보 · RECON RWA": "KYC Basic Info · RECON RWA",
  "KYC 복귀 · RECON RWA": "Return to KYC · RECON RWA",
  "전자계약 관리 · RECON RWA": "Contract Management · RECON RWA",
  "설정 · RECON RWA": "Settings · RECON RWA",
  "입출금 내역": "Transaction History",
  "회계 통계 대시보드": "Accounting Dashboard",
  "빠른 메뉴": "Quick Menu",
  "추천 자산": "Featured Assets",
  "전체 보기": "View All",
  "마켓 보기": "View Market",
  "최근 체결": "Recent Trades",
  "최근 거래": "Recent Trades",
  "체결가": "Trade Price",
  "공지": "Notice",
  "토큰 클레임": "Token Claim",
  "스테이킹/이자": "Staking / Interest",
  "매각(차익)": "Sale (Profit)",
  "부동산 조각 투자 STO": "Fractional Real Estate STO",
  "투자 프로세스": "Investment Process",
  "토큰 분배": "Token Distribution",
  "거래/스테이킹": "Trading / Staking",
  "매각 정산": "Sale Settlement",
  "신뢰를 위한 공개": "Transparency for Trust",
  "증빙/정산 문서": "Documents / Settlement Records",
  "수익 산정": "Profit Calculation",
  "통합 거래 페이지 열기": "Open Integrated Trading Page",
  "홈": "Home",
  "소개": "About",
  "투자": "Invest",
  "이용약관": "Terms of Use",
  "이미 참여 완료": "Already Participated",
  "이미 해당 자산 모금에 참여하셨습니다.": "You have already participated in this asset.",
  "운영 중입니다.": "Currently Operating.",
  "운영 중입니다. 보유 SilicaSTO는 포트폴리오에서 즉시 확인할 수 있으며, 스테이킹 / 이자·배당 클레임 / 외부 출금이 가능합니다.": "Currently operating. Your SilicaSTO holdings are visible in the portfolio immediately. Staking, interest/dividend claims, and external withdrawals are available.",
  "매각 정산 단계입니다. 보유 토큰을 반환하고 차익(USDT)을 수령합니다.": "Sale settlement phase. Return your tokens to receive the proceeds in USDT.",
  "모집 실패 자산입니다. 환불 조건을 확인하세요.": "This asset's funding failed. Please review the refund terms.",
  "매입이 취소된 자산입니다. 투자 USDT 환불 및 참여 내역을 확인하세요.": "This asset's acquisition was cancelled. Please review your USDT refund and participation history.",
  "현재 단계에서 조건을 확인하세요.": "Please review the conditions at this stage.",
  "자산 상세": "Asset Details",
  "자산 목록": "Asset List",
  "자산": "Asset",
  "자산들": "Assets",
  "자산 보기": "View Assets",
  "거래": "Trade",
  "차트": "Chart",
  "스테이킹": "Staking",
  "클레임": "Claim",
  "매각": "Sale",
  "입금": "Deposit",
  "출금": "Withdrawal",
  "입출금": "Transfers",
  "지갑 연결 해제": "Disconnect Wallet",
  "Connected Wallet": "Connected Wallet",
  "OTP 등록": "Setup OTP",
  "OTP 인증": "Verify OTP",
  "포트폴리오": "Portfolio",
  "추천인": "Referral",
  "마이페이지": "My Page",
  "마이페이지 · RECON RWA": "My Page · RECON RWA",
  "이메일": "Email",
  "이메일 주소": "Email Address",
  "이메일 미등록": "Email not registered",
  "등록 및 인증 메일 발송": "Register & Send Verification Email",
  "인증 메일 재발송": "Resend Verification Email",
  "이메일 삭제": "Delete Email",
  "지갑 주소": "Wallet Address",
  "지갑 연결 필요": "Wallet connection required",
  "문서": "Documents",
  "증빙문서": "Supporting Documents",
  "증빙문서 안내": "Supporting Documents Notice",
  "개요": "Overview",
  "지도": "Map",
  "핵심 정보": "Key Information",
  "위치": "Location",
  "로그인": "Login",
  "로그아웃": "Logout",
  "아이디": "ID",
  "비밀번호": "Password",
  "저장": "Save",
  "닫기": "Close",
  "취소": "Cancel",
  "확인": "Confirm",
  "적용": "Apply",
  "삭제": "Delete",
  "복사": "Copy",
  "새로고침": "Refresh",
  "검색": "Search",
  "초기화": "Reset",
  "열기": "Open",
  "보기": "View",
  "업로드": "Upload",
  "편집": "Edit",
  "등록": "Register",
  "연결": "Connect",
  "연결 해제": "Disconnect",
  "선택": "Select",
  "불러오기": "Reload",
  "팬텀 연결": "Connect Phantom",
  "지갑 연결": "Connect Wallet",
  "지갑 해제": "Disconnect Wallet",
  "내 지갑": "My Wallet",
  "지갑": "Wallet",
  "지갑주소": "Wallet Address",
  "OTP 등록": "Set Up OTP",
  "OTP 인증": "Verify OTP",
  "OTP 코드": "OTP Code",
  "등록 완료": "Finish Setup",
  "인증": "Verify",
  "상태": "Status",
  "금액": "Amount",
  "수량": "Quantity",
  "가격": "Price",
  "시간": "Time",
  "기간": "Period",
  "국가": "Country",
  "주소": "Address",
  "종류": "Type",
  "카테고리": "Category",
  "메시지": "Message",
  "네트워크": "Network",
  "안내": "Guide",
  "현재 상태": "Current Status",
  "다음 단계": "Next Step",
  "현재": "Current",
  "최소": "Minimum",
  "최대": "Max",
  "목표": "Target",
  "전체": "All",
  "이전": "Before",
  "이후": "After",
  "보유": "Holdings",
  "총 보유": "Total Holdings",
  "총 스테이킹": "Total Staking",
  "모금": "Funding",
  "모금 참여": "Funding Participation",
  "참여": "Participation",
  "참여하기": "Participate",
  "모금률": "Funding Rate",
  "목표 모금": "Funding Target",
  "현재 모금": "Current Funding",
  "최소 참여": "Minimum Contribution",
  "충전하기": "Top Up",
  "보유 잔액": "Available Balance",
  "현재 잔액": "Current Balance",
  "내 참여 내역": "My Participation History",
  "내 누적 참여금": "My Total Contribution",
  "환불/내역": "Refund / History",
  "토큰 받기": "Claim Tokens",
  "토큰 받기 불가": "Token Claim Unavailable",
  "전자계약서": "Electronic Contract",
  "전자계약": "Electronic Contract",
  "전자계약서 작성하기": "Create Electronic Contract",
  "계약보기": "View Contract",
  "다시 작성": "Rewrite",
  "계약 내용": "Contract Details",
  "청약금액": "Subscription Amount",
  "계약번호": "Contract No.",
  "서명 정보": "Signature Info",
  "서명자명": "Signer Name",
  "자필 전자서명": "Handwritten Electronic Signature",
  "서명 지우기": "Clear Signature",
  "사용자 서명 정보": "User Signature Info",
  "처리 순서": "Process",
  "서명 완료": "Signed",
  "반려 사유": "Reject Reason",
  "추천인 코드": "Referral Code",
  "추천인 코드(선택)": "Referral Code (Optional)",
  "추천인 코드를 입력하세요": "Enter referral code",
  "추천인 코드 또는 주소(선택)": "Referral Code or Address (Optional)",
  "추천인 코드 또는 지갑 주소를 입력하세요": "Enter referral code or wallet address",
  "다음 회차 적용 예정": "Applies from next round",
  "부터": "from",

  // Landing page (Concept A)
  "소개 · RECON RWA": "About · RECON RWA",
  "Real World Asset · Solana": "Real World Asset · Solana",
  "Process": "Process",
  "Trust": "Trust",
  "부동산을 디지털 자산으로": "Real Estate as Digital Assets",
  "디지털 자산": "Digital Assets",
  "투명하고 유동적으로": "Transparent and Liquid",
  "모금부터 매각 정산까지. 실물 부동산을 토큰화하여 최소 금액으로 참여하고, 매월 스테이킹 이자를 수령하며, P2P로 자유롭게 거래할 수 있습니다.": "From funding to sale settlement. Tokenize real estate, participate with minimal capital, earn monthly staking interest, and trade freely on P2P.",
  "자산 보기 →": "View Assets →",
  "거래소 열기": "Open Market",
  "운영 자산": "Active Assets",
  "지원 국가": "Countries",
  "평균 연이율": "Avg. APR",
  "온체인 검증": "On-chain Verified",
  "왜 RECON인가": "Why RECON",
  "기관급 구조, 개인이 누리는 혜택": "Institutional Structure, Personal Access",
  "전통적으로 고액 자산가만 접근 가능했던 상업용 부동산 투자를 토큰화하여 누구나 소액으로 참여할 수 있게 합니다.": "Commercial real estate investment — once only accessible to high-net-worth individuals — is tokenized so anyone can participate with small amounts.",
  "USDT 기반 투명성": "USDT-Based Transparency",
  "모든 투자·정산은 USDT로 이루어지며, 블록체인에 투명하게 기록됩니다. 모금 환율은 완료 시점에 고정됩니다.": "All investments and settlements are in USDT, transparently recorded on-chain. The funding FX rate is locked at completion.",
  "예측 가능한 수익": "Predictable Yield",
  "연 이율(APR) 기반으로 매월 15일 스테이킹 이자 자동 지급. 이율 변경은 다음 회차부터 적용되어 1회차 버퍼 보장.": "Monthly staking interest auto-paid on the 15th based on APR. Rate changes apply from the next round, guaranteeing a one-round buffer.",
  "언제든 거래 가능": "Always Tradeable",
  "P2P 마켓에서 자유롭게 매매. 출구 전략이 필요한 경우 매각 완료 이전에도 토큰을 다른 투자자에게 양도할 수 있습니다.": "Trade freely on P2P market. If you need an exit, transfer tokens to other investors even before asset sale completion.",
  "투자 프로세스": "Investment Process",
  "4단계로 진행되는 부동산 토큰 투자": "4-step real estate token investment",
  "모금 참여": "Join Funding",
  "목표 금액 달성 시 매입 단계로 자동 진행. 실패 시 원금 100% 환불.": "When target is met, automatically progresses to acquisition. If it fails, 100% refund.",
  "토큰 분배": "Token Distribution",
  "매입 완료 후 참여 비율에 따라 토큰이 발행되어 클레임으로 수령.": "After acquisition, tokens are minted proportionally and claimable to your wallet.",
  "거래 & 스테이킹": "Trade & Stake",
  "P2P 거래로 유동성 확보. 스테이킹으로 매월 15일 이자 지급.": "P2P trading provides liquidity. Stake to earn monthly interest on the 15th.",
  "매각 정산": "Sale Settlement",
  "매각 완료 시 제비용 공제 후 차익을 토큰 소각 비율로 수령.": "Upon sale, profits (after cost deductions) are distributed proportional to burned tokens.",
  "신뢰를 위한 공개": "Disclosure for Trust",
  "투명한 증빙과 명확한 수익 산정 기준": "Transparent documentation and clear yield calculation",
  "📄 증빙/정산 문서": "📄 Documents & Settlement",
  "매수·매각 관련 서류(일부 마스킹), 감정평가, 회계사 공문서를 페이지에서 확인 가능.": "View acquisition/sale documents (partially masked), appraisals, and CPA reports directly on the page.",
  "📊 수익 산정": "📊 Yield Calculation",
  "실제 매각수익 = 매각대금 − 세금·공과금·회계사 수수료·현지 인건비. 명세 전부 공개.": "Actual sale profit = Sale proceeds − taxes, fees, CPA costs, local labor. Full breakdown disclosed.",
  "🔒 스마트 컨트랙트": "🔒 Smart Contract",
  "SilicaSTO·Silica 토큰은 Solana 에 발행됩니다. 스테이킹·이자·배당·스왑은 회사가 운영·정산하며, 자금은 회사가 보관·관리합니다.": "SilicaSTO and Silica tokens are issued on Solana. Staking, interest, dividends, and swaps are operated, settled, and custodied by the company.",
  "준비되셨나요?": "Ready to Start?",
  "몇 분 안에 지갑을 연결하고 첫 자산에 참여할 수 있습니다.": "Connect your wallet and join your first asset in just a few minutes.",
  "지금 시작하기 →": "Get Started →",
  "지갑을 연결하면 추천인 코드를 설정할 수 있습니다.": "Connect your wallet to set a referral code.",
  "첫 참여 이후에는 추천인 등록이 불가합니다.": "Referral code cannot be set after your first participation.",
  "추천인 코드가 설정되었습니다. 변경할 수 없습니다.": "Referral code is set and cannot be changed.",
  "첫 참여 전에만 설정할 수 있습니다.": "Can only be set before your first participation.",
  "현재 단계에서는 추천인 설정이 불가합니다.": "Referral code cannot be set at this stage.",
  "추천인 코드를 입력하세요.": "Please enter a referral code.",
  "유효하지 않은 추천인 코드입니다.": "Invalid referral code.",
  "추천인 코드 확인 실패": "Failed to verify referral code.",
  "추천인 코드가 적용되었습니다.": "Referral code applied.",
  "추천인 코드가 설정되었습니다.": "Referral code has been set.",
  "이미 참여한 자산은 추천인 코드를 변경할 수 없습니다.": "You cannot change the referral code for an asset you have already participated in.",
  "적용": "Apply",
  "코드 복사": "Copy Code",
  "클레임 실행": "Claim Action",
  "클레임 로그": "Claim Log",
  "수령": "Claimed",
  "수령 가능": "Available to Claim",
  "이미 수령": "Already Claimed",
  "클레임 완료": "Claim Complete",
  "수령 수량": "Claimed Amount",
  "민트 주소": "Mint Address",
  "토큰명": "Token Name",
  "토큰 약어": "Token Symbol",
  "총 발행량": "Total Supply",
  "내 분배 완료": "Already Distributed",
  "확정 환율": "Locked FX",
  "내 권리": "My Entitlement",
  "입금(USDT)": "Deposit (USDT)",
  "입금 자산": "Deposit Asset",
  "내 USDT 잔액(플랫폼)": "My USDT Balance (Platform)",
  "관리자 입금지갑": "Deposit Address",
  "관리자 입금지갑주소 형식 오류": "Invalid admin deposit wallet address format.",
  "관리자 입금지갑이 내 지갑과 동일합니다.": "The admin deposit wallet matches your own wallet.",
  "내 보유수량 표시는 지갑 인증 완료 후 가능합니다.": "Your holdings will be shown after wallet verification is complete.",
  // sale-detail.js toasts / textContent (2026-05-12 v299)
  "올바른 매각 자산 정보가 없습니다.": "No valid sale asset information available.",
  "잘못된 접근입니다. sale-detail.html?id=자산ID 형태로 접속해야 합니다.":
    "Invalid access. Please use sale-detail.html?id=<asset-id>.",
  "정산통화가 USDT이므로 현지통화 참고값이 없습니다.":
    "Settlement currency is USDT, so no local-currency reference is shown.",
  "현지통화 참고값을 계산할 수 없습니다.":
    "Unable to calculate local-currency reference.",
  "현재 매각 교환 가능 상태가 아닙니다.":
    "This asset is not currently available for sale exchange.",
  "매각 실행 완료 후부터 정산할 수 있습니다.":
    "Settlement is available only after the sale execution completes.",
  "남은 교환 가능액이 없습니다.": "No remaining exchangeable amount.",
  "교환 가능한 보유 토큰이 없습니다.": "No exchangeable tokens in your holdings.",
  "토큰 입금 수량은 1개 이상 정수만 입력하세요.":
    "Token deposit quantity must be a whole number of 1 or more.",
  "보유 토큰이 부족합니다.": "Insufficient token holdings.",
  "예상 수령액을 계산할 수 없습니다.": "Unable to calculate estimated proceeds.",
  "남은 교환 가능액을 초과합니다.": "Exceeds the remaining exchangeable amount.",
  "입금주소": "Deposit Address",
  "입금할 USDT": "USDT to Deposit",
  "USDT 전송(입금)": "Send USDT (Deposit)",
  "거래내역": "Transaction History",
  "최근 처리": "Recent Activity",
  "전송중": "Sending",
  "처리 중...": "Processing...",
  "로딩 중...": "Loading...",
  "이미지 로딩 중...": "Loading image...",
  "문서를 로딩 중...": "Loading documents...",
  "출금 신청 금액": "Withdrawal Amount",
  "출금 신청 수량": "Withdrawal Quantity",
  "출금 수수료": "Withdrawal Fee",
  "출금 가능 수량": "Available Withdrawal Quantity",
  "출금신청금액": "Requested Withdrawal Amount",
  "출금 신청 완료": "Withdrawal Request Complete",
  "출금 신청중": "Submitting Withdrawal Request",
  "스테이킹 하러 가기": "Go to Staking",
  "예상 이자": "Estimated Interest",
  "예상 이자 내역": "Estimated Interest Records",
  "이자 클레임": "Claim Interest",
  "누적 이자 클레임": "Claim Accumulated Interest",
  "누적 이자": "Accumulated Interest",
  "미클레임 이자": "Unclaimed Interest",
  "수익": "Profit",
  "이자 지급": "Interest Payout",
  "다음 지급일": "Next Payout Date",
  "이자 총 수익": "Total Interest Income",
  "매각 차익 수익": "Total Sale Profit",
  "등록 자산": "Listed Assets",
  "진행 중": "Active",
  "다음달 예상 이자": "Next Month Estimated Interest",
  "전월 발생 이자": "Previous Month Interest",
  "당월 발생 이자": "Current Month Interest",
  "누적 이자(USDT)": "Accrued Interest (USDT)",
  "전월 이자(USDT)": "Previous Month Interest (USDT)",
  "당월 이자(USDT)": "Current Month Interest (USDT)",
  "계약 제출 및 체결 내역": "Submitted and Signed Contracts",
  "계약 내역이 없습니다.": "No contract history.",
  "새 탭에서 열기": "Open in New Tab",
  "활성": "Active",
  "모집중": "Active",
  "구매진행": "Active",
  "분배중": "Active",
  "운영중": "Active",
  "매각": "Sale In Progress",
  "매각(완료)": "Sale Completed",
  "모집실패": "Cancelled",
  "취소됨": "Cancelled",
  "대기중": "Pending",
  "완료": "Completed",
  "실패": "Failed",
  "반려": "Rejected",
  "승인": "Approved",
  "미작성": "Not Created",
  "대한민국": "South Korea",
  "미국": "United States",
  "카자흐스탄": "Kazakhstan",
  "필리핀": "Philippines",
  "조지아": "Georgia",
  "인도네시아": "Indonesia",
  "베트남": "Vietnam",
  "대시보드": "Dashboard",
  "요약": "Summary",
  "총 자산": "Total Assets",
  "분배/운영": "Distributing / Operating",
  "실패/취소": "Failed / Cancelled",
  "오픈 주문": "Open Orders",
  "24h 거래대금": "24h Volume",
  "플랫폼 수수료": "Platform Fees",
  "이자 지급일": "Interest Payout Day",
  "현재 환율": "Current FX",
  "주의/점검 필요": "Needs Attention",
  "자산 현황": "Asset Overview",
  "진행률": "Progress",
  "거래/주문 요약": "Trade / Order Summary",
  "총 유저 수": "Total Users",
  "현재 가입/연결 유저": "Registered / Connected Users",
  "유저 총 USDT": "Total User USDT",
  "balances 기준": "Based on balances",
  "모금 사용 총액": "Total Used in Funding",
  "확정 + 관리자 대기": "Confirmed + Awaiting Admin",
  "입금 대기 USDT": "Pending Deposit USDT",
  "승인 전 입금 신청": "Deposit Requests Before Approval",
  "출금 대기 USDT": "Pending Withdrawal USDT",
  "전송 대기 기준": "Based on pending transfers",
  "전체 누적 발생 이자": "Total Accrued Interest",
  "출금수수료 수익 누적": "Cumulative Withdrawal Fee Income",
  "완료된 출금 기준": "Based on completed withdrawals",
  "출금수수료 수익 전월": "Previous Month Withdrawal Fee Income",
  "출금수수료 수익 현재월": "Current Month Withdrawal Fee Income",
  "거래수수료 수익 누적": "Cumulative Trading Fee Income",
  "체결 완료 기준": "Based on completed trades",
  "거래수수료 수익 전월": "Previous Month Trading Fee Income",
  "거래수수료 수익 현재월": "Current Month Trading Fee Income",
  "자산별 이자 통계": "Interest by Asset",
  "스테이커": "Stakers",
  "스테이킹 수량": "Staked Amount",
  "새 자산 등록": "Create Asset",
  "검색 / 필터": "Search / Filters",
  "세부 검색": "Detailed Filters",
  "필터 초기화": "Reset Filters",
  "전자계약서 템플릿": "Contract Templates",
  "현재 적용된 계약서": "Current Template",
  "계약서 변경": "Change Template",
  "템플릿 선택": "Select Template",
  "연결 해제 (기본 사용)": "Disconnect (Use Default)",
  "기본에서 복제해 전용 계약서 만들기": "Duplicate Default to Create Dedicated Template",
  "증빙문서 관리": "Supporting Document Management",
  "문서 등록": "Register Document",
  "등기부등본": "Registry Copy",
  "자산평가서": "Asset Valuation Report",
  "회계자료": "Accounting Documents",
  "공식문서1": "Official Document 1",
  "공식문서2": "Official Document 2",
  "일반문서": "General Document",
  "문서 제목": "Document Title",
  "문서 날짜": "Document Date",
  "금액 (선택, USDT)": "Amount (Optional, USDT)",
  "파일 (PDF/이미지)": "File (PDF/Image)",
  "상태 관리": "Status Management",
  "현재 진행 상태": "Current Status",
  "현재 요약": "Current Summary",
  "모금/매입 취소": "Cancel Funding / Acquisition",
  "모금/매입 취소 (전액 환불)": "Cancel Funding / Acquisition (Full Refund)",
  "구매 진행 (부동산 매입)": "Start Acquisition (Property Purchase)",
  "토큰 분배 시작": "Start Token Distribution",
  "토큰 정보 관리": "Token Info Management",
  "온체인 출금 수량": "On-chain Withdrawn Amount",
  "토큰 소수점": "Token Decimals",
  "토큰 민트 주소 (Solana)": "Token Mint Address (Solana)",
  "발행 준비 정보": "Issuance Preparation",
  "자산 편집": "Edit Asset",
  "자산 삭제": "Delete Asset",
  "자산 공개 / 비공개": "Asset Visibility",
  "비공개 (Private)": "Private",
  "공개 (Public)": "Public",
  "기본 정보": "Basic Info",
  "수정불가": "Read-only",
  "자산 ID": "Asset ID",
  "마켓": "Market",
  "자산명": "Asset Name",
  "물건지 국가": "Property Country",
  "정산통화": "Settlement Currency",
  "지도 쿼리": "Map Query",
  "구글지도 Embed URL": "Google Maps Embed URL",
  "이미지 / 토큰 이미지 / 세부 이미지": "Images / Token Image / Detail Images",
  "자산 이미지 URL": "Asset Image URL",
  "토큰 이미지 URL": "Token Image URL",
  "자산 이미지 업로드": "Upload Asset Image",
  "토큰 이미지 업로드": "Upload Token Image",
  "세부 이미지 업로드 (여러 장)": "Upload Detail Images (Multiple)",
  "파일만 업로드": "Upload File Only",
  "자산 이미지 미리보기": "Asset Image Preview",
  "토큰 이미지 미리보기": "Token Image Preview",
  "세부 이미지": "Detail Images",
  "자산 개요": "Asset Overview",
  "개요/설명": "Overview / Description",
  "모금 / 참여 설정": "Funding / Participation Settings",
  "목표 모금(USDT)": "Funding Target (USDT)",
  "예상 매수가(USDT)": "Expected Purchase Price (USDT)",
  "현재 모금(USDT)": "Current Funding (USDT)",
  "읽기전용": "Read-only",
  "최소 참여(USDT)": "Minimum Contribution (USDT)",
  "스테이킹 이자율": "Staking APR",
  "이자율 변경 이력": "APR Change History",
  "운영 / 정산 / 발행 정보": "Operation / Settlement / Issuance",
  "모금기간 종료일": "Funding End Date",
  "최종환율": "Final FX",
  "매입 후 확정": "Locked After Acquisition",
  "발행량": "Supply",
  "모금 스냅샷(USDT)": "Funding Snapshot (USDT)",
  "매수 수수료(%)": "Buy Fee (%)",
  "매도 수수료(%)": "Sell Fee (%)",
  "전자계약 목록": "Contract List",
  "전체 검색": "Search All",
  "부동산 타입": "Property Type",
  "현재 진행상태": "Current Status",
  "계약 관리": "Contract Management",
  "계약서 템플릿 관리": "Template Management",
  "관리자 서명 대기": "Awaiting Admin Signature",
  "좌측에서 계약을 선택하세요.": "Select a contract on the left.",
  "새 템플릿 만들기": "Create New Template",
  "템플릿 코드": "Template Code",
  "템플릿 이름": "Template Name",
  "적용 자산 관리": "Applied Assets",
  "+ 자산에 적용": "+ Apply to Asset",
  "계약서 제목": "Contract Title",
  "계약서 본문 HTML": "Contract HTML Body",
  "활성화": "Active",
  "미리보기": "Preview",
  "복제하기": "Duplicate",
  "사용 가능한 변수": "Available Variables",
  "계약 기준시각": "Contract Timestamp",
  "투자자 지갑주소": "Investor Wallet Address",
  "시장명": "Market Name",
  "국가코드": "Country Code",
  "국가명": "Country Name",
  "연이율": "APR",
  "청약금액 USDT": "Subscription Amount (USDT)",
  "현지통화 환산액": "Local Currency Equivalent",
  "적용 환율": "Applied FX",
  "최소 참여금액": "Minimum Contribution",
  "목표 모집금액": "Funding Target",
  "자산 선택": "Select Asset",
  "표시 자산": "Shown Assets",
  "계약 정보": "Contract Information",
  "유저 정보 / KYC": "User Info / KYC",
  "사용자 서명": "User Signature",
  "관리자 서명": "Admin Signature",
  "PDF 다운로드": "Download PDF",
  "감사 로그": "Audit Log",
  "입금 승인": "Approve Deposit",
  "출금 반려": "Reject Withdrawal",
  "USDT 출금": "USDT Withdrawal",
  "회계": "Accounting",
  "입금 지갑주소": "Deposit Address",
  "출금 처리 관리자 지갑주소(서명용)": "Admin Withdrawal Wallet (Signer)",
  "저장되었습니다.": "Saved.",
  "페이지 처리 중 오류가 발생했습니다.": "An error occurred while processing the page.",
  "관리자 페이지 로드 오류": "Admin Page Load Error",
  "다시 불러오기": "Reload",
  "페이지 일부를 불러오지 못했습니다.": "Some parts of the page could not be loaded.",
  "KYC 인증": "KYC Verification",
  "인증 완료": "Verification Complete",
  "성명": "Full Name",
  "생년월일": "Date of Birth",
  "신분증 종류 선택": "Select ID Type",
  "주민등록증": "Resident Registration Card",
  "운전면허증": "Driver License",
  "여권": "Passport",
  "개인정보 안내": "Privacy Notice",
  "인증 시작": "Start Verification",
  "기본 정보로 돌아가기": "Back to Basic Info",
  "이전으로": "Back",
  "KYC 페이지로 돌아가기": "Return to KYC Page",
  "처리중입니다.": "Processing.",
  "KYC 인증이 완료되었습니다.": "KYC verification has been completed."
},


  };


  const EXTRA_EXACT = {
  "en": {
    "홈으로 이동": "Go to home",
    "주요 메뉴": "Main Menu",
    "처리 중입니다. 잠시만 기다려주세요.": "Processing. Please wait a moment.",
    "클레임 상태 로드 실패": "Failed to load claim status",
    "거래 페이지로 이동 중입니다.": "Moving to the trading page.",
    "Google Authenticator 6자리 코드를 입력하세요.": "Enter the 6-digit code from Google Authenticator.",
    "OTP 코드(6자리)": "OTP Code (6 digits)",
    "자산을 선택하세요": "Select an asset",
    "입금완료": "Deposit Completed",
    "거래 확인": "Trade Confirmation",
    "거래하기": "Trade",
    "자산 정보": "Asset Information",
    "매수호가": "Bid",
    "매도호가": "Ask",
    "즉시체결": "Instant Match",
    "미체결주문": "Open Orders",
    "보너스 내역": "Bonus History",
    "보너스(USDT)": "Bonus (USDT)",
    "전송수량": "Transfer Amount",
    "신청수량": "Requested Amount",
    "수령 주소": "Receiving Address",
    "수령주소": "Receiving Address",
    "환율(예상)": "Estimated FX Rate",
    "월/회차": "Month / Round",
    "최근체결": "Recent Trades",
    "24h 거래량": "24h Volume",
    "가격(USDT)": "Price (USDT)",
    "수량(": "Amount (",
    "잔량(": "Remaining (",
    "고가": "High",
    "저가": "Low",
    "시가": "Open",
    "종가": "Close"
  },
  "ja": {
    "홈으로 이동": "ホームへ移動",
    "주요 메뉴": "主要メニュー",
    "처리 중입니다. 잠시만 기다려주세요.": "処理中です。しばらくお待ちください。",
    "클레임 상태 로드 실패": "受取状況の読み込みに失敗しました",
    "거래 페이지로 이동 중입니다.": "取引ページへ移動しています。",
    "Google Authenticator 6자리 코드를 입력하세요.": "Google Authenticator の6桁コードを入力してください。",
    "OTP 코드(6자리)": "OTPコード（6桁）",
    "자산을 선택하세요": "資産を選択してください",
    "입금완료": "入金完了",
    "거래 확인": "取引確認",
    "거래하기": "取引する",
    "자산 정보": "資産情報",
    "매수호가": "買い気配",
    "매도호가": "売り気配",
    "즉시체결": "即時約定",
    "미체결주문": "未約定注文",
    "보너스 내역": "ボーナス履歴",
    "보너스(USDT)": "ボーナス（USDT）",
    "전송수량": "送信数量",
    "신청수량": "申請数量",
    "수령 주소": "受取アドレス",
    "수령주소": "受取アドレス",
    "환율(예상)": "為替レート（予想）",
    "월/회차": "月 / 回次",
    "최근체결": "最近の約定",
    "24h 거래량": "24時間取引量",
    "가격(USDT)": "価格（USDT）",
    "수량(": "数量（",
    "잔량(": "残数量（",
    "고가": "高値",
    "저가": "安値",
    "시가": "始値",
    "종가": "終値"
  },
  "zh": {
    "홈으로 이동": "前往首页",
    "주요 메뉴": "主要菜单",
    "처리 중입니다. 잠시만 기다려주세요.": "正在处理中。请稍候。",
    "클레임 상태 로드 실패": "加载领取状态失败",
    "거래 페이지로 이동 중입니다.": "正在前往交易页面。",
    "Google Authenticator 6자리 코드를 입력하세요.": "请输入 Google Authenticator 的 6 位验证码。",
    "OTP 코드(6자리)": "OTP验证码（6位）",
    "자산을 선택하세요": "请选择资产",
    "입금완료": "入金完成",
    "거래 확인": "交易确认",
    "거래하기": "进行交易",
    "자산 정보": "资产信息",
    "매수호가": "买盘",
    "매도호가": "卖盘",
    "즉시체결": "即时成交",
    "미체결주문": "未成交订单",
    "보너스 내역": "奖励记录",
    "보너스(USDT)": "奖励（USDT）",
    "전송수량": "发送数量",
    "신청수량": "申请数量",
    "수령 주소": "收款地址",
    "수령주소": "收款地址",
    "환율(예상)": "预计汇率",
    "월/회차": "月份 / 回次",
    "최근체결": "最近成交",
    "24h 거래량": "24小时成交量",
    "가격(USDT)": "价格（USDT）",
    "수량(": "数量（",
    "잔량(": "剩余量（",
    "고가": "最高价",
    "저가": "最低价",
    "시가": "开盘价",
    "종가": "收盘价"
  }
};
  const EXTRA_PARTS = {
  "en": {
    "주요 메뉴": "Main Menu",
    "홈으로 이동": "Go to home",
    "거래 수수료": "Trading Fee",
    "거래 확인": "Trade Confirmation",
    "거래하기": "Trade",
    "자산 정보": "Asset Information",
    "매수호가": "Bid",
    "매도호가": "Ask",
    "고가": "High",
    "저가": "Low",
    "시가": "Open",
    "종가": "Close",
    "즉시체결": "Instant Match",
    "미체결주문": "Open Orders",
    "전송수량": "Transfer Amount",
    "신청수량": "Requested Amount",
    "수령 주소": "Receiving Address",
    "수령주소": "Receiving Address",
    "월/회차": "Month / Round",
    "환율(예상)": "Estimated FX Rate",
    "입금완료": "Deposit Completed",
    "연결된 지갑": "Connected Wallet",
    "연결일": "Connected At",
    "작업": "Action",
    "조회": "View",
    "보너스 내역": "Bonus History",
    "보너스(USDT)": "Bonus (USDT)",
    "이용 및 투자약관": "Terms of Use and Investment"
  },
  "ja": {
    "주요 메뉴": "主要メニュー",
    "홈으로 이동": "ホームへ移動",
    "거래 수수료": "取引手数料",
    "거래 확인": "取引確認",
    "거래하기": "取引する",
    "자산 정보": "資産情報",
    "매수호가": "買い気配",
    "매도호가": "売り気配",
    "고가": "高値",
    "저가": "安値",
    "시가": "始値",
    "종가": "終値",
    "즉시체결": "即時約定",
    "미체결주문": "未約定注文",
    "전송수량": "送信数量",
    "신청수량": "申請数量",
    "수령 주소": "受取アドレス",
    "수령주소": "受取アドレス",
    "월/회차": "月 / 回次",
    "환율(예상)": "為替レート（予想）",
    "입금완료": "入金完了",
    "연결된 지갑": "接続済みウォレット",
    "연결일": "接続日時",
    "작업": "操作",
    "조회": "照会",
    "보너스 내역": "ボーナス履歴",
    "보너스(USDT)": "ボーナス（USDT）",
    "이용 및 투자약관": "利用および投資規約"
  },
  "zh": {
    "주요 메뉴": "主要菜单",
    "홈으로 이동": "前往首页",
    "거래 수수료": "交易手续费",
    "거래 확인": "交易确认",
    "거래하기": "进行交易",
    "자산 정보": "资产信息",
    "매수호가": "买盘",
    "매도호가": "卖盘",
    "고가": "最高价",
    "저가": "最低价",
    "시가": "开盘价",
    "종가": "收盘价",
    "즉시체결": "即时成交",
    "미체결주문": "未成交订单",
    "전송수량": "发送数量",
    "신청수량": "申请数量",
    "수령 주소": "收款地址",
    "수령주소": "收款地址",
    "월/회차": "月份 / 回次",
    "환율(예상)": "预计汇率",
    "입금완료": "入金完成",
    "연결된 지갑": "已连接钱包",
    "연결일": "连接时间",
    "작업": "操作",
    "조회": "查看",
    "보너스 내역": "奖励记录",
    "보너스(USDT)": "奖励（USDT）",
    "이용 및 투자약관": "使用与投资条款"
  }
};

  function mergeLangMap(target, extra) {
    Object.entries(extra || {}).forEach(([lang, map]) => {
      target[lang] = Object.assign({}, target[lang] || {}, map || {});
    });
  }

  mergeLangMap(EXACT, EXTRA_EXACT);
  mergeLangMap(PARTS, EXTRA_PARTS);

  const EXTRA_EXACT_V2 = {
  en: {
    "자산 하위 메뉴": "Assets submenu",
    "자산 하위 메뉴 열기": "Open assets submenu",
    "포트폴리오 하위 메뉴": "Portfolio submenu",
    "포트폴리오 하위 메뉴 열기": "Open portfolio submenu",
    "통합 거래": "Integrated Trading",
    "마켓 탐색, 체결 기준 시세 그래프, 호가 확인, 주문 생성과 체결을 한 페이지에서 진행합니다.": "Browse markets, view execution-based price charts, check the order book, and place and execute orders on one page.",
    "거래 가능 자산 검색": "Search tradable assets",
    "불러오는 중...": "Loading...",
    "체결 기준 시세 그래프": "Execution Price Chart",
    "실제 체결 데이터 기준으로 최근 가격 흐름을 표시합니다.": "Shows recent price movement based on executed trade data.",
    "월간 기준(요약)": "Monthly Basis (Summary)",
    "데이터 없음": "No data",
    "호가창": "Order Book",
    "자산 정보 카드와 거래 카드 사이에서 현재 호가를 바로 확인할 수 있습니다.": "You can check the current order book directly between the asset info card and the trading card.",
    "즉시체결은 해당 매도 주문의 잔량 전체를 바로 매수하고, 선택은 우측 거래하기 패널에 주문 ID·가격·잔량을 불러와 원하는 수량만 거래합니다.": "Instant Match buys the full remaining amount of the selected sell order immediately. Select loads the order ID, price, and remaining amount into the trading panel on the right so you can trade only the quantity you want.",
    "즉시체결은 해당 매수 주문의 잔량 전체를 바로 매도하고, 선택은 우측 거래하기 패널에 주문 ID·가격·잔량을 불러와 원하는 수량만 거래합니다.": "Instant Match sells the full remaining amount of the selected buy order immediately. Select loads the order ID, price, and remaining amount into the trading panel on the right so you can trade only the quantity you want.",
    "호가창의 선택 버튼을 누르면 주문 ID, 가격, 잔량이 채워지고 원하는 수량만 거래할 수 있습니다.": "When you press Select in the order book, the order ID, price, and remaining amount are filled in so you can trade only the quantity you want.",
    "만료일(선택)": "Expiration Date (Optional)",
    "만료일을 지정하지 않으면 무기한 유지됩니다.": "If no expiration date is set, the order remains open indefinitely.",
    "스테이킹 잔고와 환율 기준으로 월 이자가 계산되고, 배정된 이자는 누적 클레임할 수 있습니다.": "Monthly interest is calculated based on your staking balance and exchange rate, and accrued interest can be claimed together.",
    "관리자가 배정한 이자를 누적해서 한 번에 클레임할 수 있습니다.": "You can claim the interest allocated by the admin all at once after it accumulates.",
    "투자유저가 직접 이자를 클레임하지 않아도 추천 보상은 자동으로 즉시 지급됩니다.": "Referral rewards are paid automatically and immediately even if the investor does not manually claim the interest.",
    "보상금은 USDT 잔액에 누적되며, 출금 요청 시 인출할 수 있습니다.": "Reward amounts accumulate in your USDT balance and can be withdrawn when you submit a withdrawal request.",
    "매각 차익에 대한 추천인 보상은 없습니다. 오직 스테이킹 이자 배정분에 대해서만 보상이 발생합니다.": "There are no referral rewards for sale profits. Rewards apply only to allocated staking interest.",
    "모금 확정 환율 기준으로, 내 권리만큼 자산 토큰을 수령합니다.": "Claim asset tokens according to your entitlement based on the final funding exchange rate.",
    "참여하신 비율만큼 자산 토큰을 수령합니다.": "Receive asset tokens proportional to your contribution.",
    "자산 토큰 정보와 정산통화 정보를 분리하여 표시합니다.": "Asset token information and settlement currency information are shown separately.",
    "투자 청약 전자계약서 검토 및 자필서명": "Review Investment Subscription E-Contract and Handwritten Signature",
    "본인은 전자문서 형태의 투자 청약 계약서 열람 및 저장에 동의합니다.": "I agree to view and save the investment subscription contract in electronic document form.",
    "본인은 아래 자필 전자서명이 본 계약에 대한 본인의 의사표시임을 확인합니다.": "I confirm that the handwritten electronic signature below represents my intent for this contract.",
    "문서를 로딩 중...": "Loading documents...",
    "계약 내역이 없습니다.": "There is no contract history."
  },


};
  const EXTRA_PARTS_V2 = {
  en: {
    "통합 거래": "Integrated Trading",
    "거래 가능 자산 검색": "Search tradable assets",
    "불러오는 중...": "Loading...",
    "· 정산통화": "· Settlement Currency",
    "거래수수료": "Trading Fee",
    "내 USDT": "My USDT",
    "내 총보유 토큰": "My Total Tokens",
    "내 가용 토큰": "My Available Tokens",
    "정산통화 기준 참고": "Reference in settlement currency",
    "거래 불가": "Trading Unavailable",
    "월": "Month",
    "가격(USDT)": "Price (USDT)",
    "수량(": "Quantity (",
    "잔량(": "Remaining (",
    "쉬운 거래 방법": "Easy Trading Guide",
    "선택한 주문": "Selected Order",
    "주문 ID:": "Order ID:",
    "거래 수량(": "Trade Amount (",
    "잔량 전체": "Use full remaining amount",
    "실제 수령자산": "Actual Received Asset",
    "📄 증빙문서": "📄 Supporting Documents",
    "0건": "0 items",
    "참여 금액(USDT)": "Contribution Amount (USDT)",
    "전환액:": "Converted Amount:",
    "💰 USDT 잔액이 부족합니다": "💰 Your USDT balance is insufficient",
    "내 누적 환산(": "My Total Converted (",
    "보유자산만 보기": "Show only held assets",
    "자산/통화": "Asset / Currency",
    "· 고정 이자": "· Fixed Interest",
    "상세": "Details",
    "보유(": "Held (",
    "스테이킹(": "Staked (",
    "스테이킹/언스테이킹": "Stake / Unstake",
    "스테이킹 규칙 요약": "Staking Rules Summary",
    "세부 계산 방식 보기": "View Detailed Calculation Method",
    "기준": "Basis",
    "추천인 프로그램": "Referral Program",
    "보상 규칙": "Reward Rules",
    "가 월별로 배정되는 즉시": "as soon as it is allocated monthly",
    "를 추가 보상으로 받습니다.": "is paid as an additional reward.",
    "내 추천인 상태": "My Referrer Status",
    "추천인 미승인": "Referrer Not Approved",
    "나의 추천인": "My Referrer",
    "추천인 정보를 불러오는 중...": "Loading referrer information...",
    "내가 추천한 유저": "Users I Referred",
    "유저": "User",
    "내 참여금(USDT)": "My Contribution (USDT)",
    "내 권리(": "My Entitlement (",
    "이미 수령(": "Already Claimed (",
    "수령 가능(": "Available to Claim (",
    "클레임 안내": "Claim Guide",
    "클레임 팁": "Claim Tips"
  },


};
  mergeLangMap(EXACT, EXTRA_EXACT_V2);
  mergeLangMap(PARTS, EXTRA_PARTS_V2);

  const EXTRA_EXACT_V3 = {
    en: {
      "모집완료 후 오프라인 매입 절차가 진행 중입니다.": "Offline acquisition is in progress after funding closed.",
      "토큰 발행 후 분배(클레임)가 진행 중입니다.": "Token issuance and distribution (claim) are in progress.",
      "운영 단계: 스테이킹 이자 및 P2P 거래가 가능합니다.": "Operating stage: staking interest and P2P trading are available.",
      "매각 정산 완료: 토큰 반환 후 차익을 수령합니다.": "Sale settlement is complete: return tokens and receive the profit.",
      "모집 미달: 만료 후 환불(Refund) 청구가 열립니다.": "Funding shortfall: refund requests open after expiration.",
      "매입 취소 자산입니다. 참여 내역과 환불 완료 여부를 확인할 수 있습니다.": "This asset was cancelled before acquisition. You can review your participation history and refund status.",
      "* 모집 달성으로 단계 전환 처리 중입니다. 잠시 후 다시 확인하세요.": "* The funding target has been met and the stage transition is being processed. Please check again shortly.",
      "지갑을 연결하세요.": "Connect your wallet.",
      "표시할 자산이 없습니다.": "No assets to display.",
      "조건에 맞는 자산이 없습니다.": "No assets match your filters.",
      "최근 체결이 없습니다.": "There are no recent trades.",
      "보유 자산 없음": "No holdings.",
      "보유 자산이 없습니다.": "You do not hold this asset.",
      "지갑을 연결하면 내 참여 자산 기준으로 스테이킹/이자 기능이 활성화됩니다.": "Connect your wallet to enable staking and interest features for your participating assets.",
      "지갑을 연결하면 이자 클레임이 활성화됩니다.": "Connect your wallet to enable interest claims.",
      "체크를 해제하면 전체 스테이킹 풀을, 체크하면 보유 자산만 볼 수 있습니다.": "Turn the filter off to see the full staking pool, or on to view only held assets.",
      "보유에서 스테이킹으로 이동하거나, 언스테이킹이 가능합니다.": "You can move tokens from holdings to staking, or unstake them.",
      "매각 상태에서는 당월 이자가 발생하지 않습니다. 이전 미수령 이자와 언스테이킹만 가능합니다.": "During sale status, current-month interest no longer accrues. Only previous unclaimed interest and unstaking are available.",
      "현재 단계에서는 이자 클레임이 열리지 않습니다.": "Interest claims are not open at the current stage.",
      "환율 설정이 필요합니다. (관리자 FX 설정)": "An exchange rate must be configured. (Admin FX setting)",
      "스테이킹 잔고가 없습니다. 먼저 스테이킹하세요.": "There is no staked balance. Please stake first.",
      "아직 관리자가 이자를 배정하지 않았습니다. 다음 배정 후 예상 이자를 클레임할 수 있습니다.": "The administrator has not allocated interest yet. You will be able to claim the expected interest after the next allocation.",
      "추천한 유저가 없습니다.": "There are no users you referred.",
      "추천인 권한이 없습니다.": "You do not have referrer privileges.",
      "설정된 추천인이 없습니다.": "No referrer has been set.",
      "보너스 내역이 없습니다.": "There is no bonus history.",
      "보너스 내역을 불러올 수 없습니다.": "Unable to load bonus history.",
      "추천 코드가 복사되었습니다.": "The referral code has been copied.",
      "코드가 없습니다.": "There is no code.",
      "복사 실패": "Copy failed.",
      "상태를 불러올 수 없습니다.": "Unable to load the status.",
      "계약 조회 실패": "Failed to load the contract.",
      "계약서 내용이 없습니다.": "There is no contract content.",
      "포트폴리오를 불러오지 못했습니다.": "Failed to load the portfolio.",
      "최대 설정 실패": "Failed to set the maximum amount.",
      "수량을 입력하세요.": "Enter a quantity.",
      "스테이킹이 완료되었습니다.": "Staking has been completed.",
      "스테이킹 실패": "Staking failed.",
      "언스테이킹이 완료되었습니다.": "Unstaking has been completed.",
      "언스테이킹 실패": "Unstaking failed.",
      "이자 클레임 실패": "Interest claim failed.",
      "내역이 없습니다.": "There is no history.",
      "지갑을 연결하면 내 보유수량이 표시됩니다.": "Connect your wallet to view your holdings.",
      "지갑 인증 후 내 보유수량을 불러옵니다.": "After wallet verification, your holdings will be loaded.",
      "투자(참여)한 자산이 없습니다.": "You have not funded any assets yet.",
      "지갑을 연결하면 내 투자 자산이 표시됩니다.": "Connect your wallet to view your invested assets.",
      "목록 로드 실패": "Failed to load the list.",
      "토큰 분배중": "Token Distribution",
      "모집완료 · 매입중": "Funding Complete · Acquiring"
    },


  };
  const EXTRA_PARTS_V3 = {
    en: {
      "내 자산": "My Assets",
      "토큰 준비중": "Token Pending",
      "진행 확인": "Check Progress",
      "매각 차익 받기": "Claim Sale Profit",
      "모금 진행": "Funding Progress",
      "모금마감": "Funding Closes",
      "모집률": "Funding Rate",
      "즉시 클레임 가능": "Claim Available Now",
      "분배 완료": "Distribution Complete",
      "토큰 등록 완료": "Token Registration Complete",
      "토큰 등록중": "Registering Tokens",
      "내 활동": "My Activity",
      "증빙문서 전체": "All Supporting Documents",
      "내 정산 가능": "My Settlement Available",
      "목록 로드 실패": "Failed to Load List"
    },


  };
  mergeLangMap(EXACT, EXTRA_EXACT_V3);
  mergeLangMap(PARTS, EXTRA_PARTS_V3);


  const EXTRA_EXACT_V4 = {
  "en": {
    "지갑을 연결하면 내가 투자한 자산만 표시됩니다.": "Connect your wallet to show only the assets you invested in.",
    "지갑을 연결하면 토큰 정보를 표시합니다.": "Connect your wallet to show token information.",
    "현재 지갑 주소로 모금 참여한 자산이 없습니다.": "There are no funded assets for the current wallet address.",
    "모금이 완료 되어 재단에서 토큰을 발행 및 등록중에 있습니다. 토큰등록이 완료 되면 분배 받을 수 있습니다.": "Funding is complete and the foundation is issuing and registering the tokens. You can receive the distribution once token registration is complete.",
    "토큰 등록이 완료되었습니다. 관리자가 분배를 시작하면 클레임할 수 있습니다.": "Token registration is complete. You can claim once the administrator starts the distribution.",
    "클레임 버튼으로 자산 토큰을 수령할 수 있습니다.": "You can claim the asset tokens with the claim button.",
    "미수령 수량이 있다면 계속 클레임할 수 있습니다.": "You can continue claiming while there is an unclaimed amount.",
    "현재 미수령 수량이 없습니다. 수령 후에는 스테이킹 또는 거래가 가능합니다.": "There is currently no claimable amount left. After claiming, you can stake or trade.",
    "미수령 토큰이 있다면 먼저 클레임한 뒤, 매각 정산으로 이동할 수 있습니다.": "If you still have unclaimed tokens, claim them first and then move to sale settlement.",
    "매입 완료 후 토큰 등록 및 분배가 열립니다.": "Token registration and distribution open after acquisition is complete.",
    "목표 달성 후 1 USDT = 1 Token 기준으로 발행 수량이 확정됩니다.": "After the target is reached, the issued amount is fixed on a 1 USDT = 1 Token basis.",
    "환불 가능 여부를 확인하세요.": "Please check whether a refund is available.",
    "취소된 자산입니다. 환불/참여 내역을 확인하세요.": "This asset was cancelled. Check the refund and participation history.",
    "클레임 가능 상태를 확인하세요.": "Check whether the claim status is available.",
    "모금 달성 시점에 확정된 환율입니다.": "This is the exchange rate fixed at the time the funding target was achieved.",
    "확정 환율 정보가 없습니다.": "Locked exchange-rate information is not available.",
    "참여 내역이 없으면 클레임할 수 없습니다.": "You cannot claim without participation history.",
    "클레임 후 스테이킹 풀에서 예치하고 수익을 받을 수 있습니다.": "After claiming, you can deposit into the staking pool and receive earnings.",
    "현재 자산 상태에 맞는 다음 단계를 확인하세요.": "Check the next step that matches the current asset status.",
    "토큰 발행 및 등록이 완료되면 클레임이 열립니다.": "Claiming opens once token issuance and registration are completed.",
    "현재 수령 가능 수량이 없습니다.": "There is currently no amount available to claim.",
    "지갑을 연결하면 내 참여 자산 기준으로 스테이킹/이자 기능이 활성화됩니다.": "Connect your wallet to enable staking and interest features for your participated assets.",
    "지갑을 연결하면 이자 클레임이 활성화됩니다.": "Connect your wallet to enable interest claims.",
    "체크를 해제하면 전체 스테이킹 풀을, 체크하면 보유 자산만 볼 수 있습니다.": "Clear the check to view the full staking pool, or check it to view only held assets.",
    "보유에서 스테이킹으로 이동하거나, 언스테이킹이 가능합니다.": "You can move assets from holdings into staking, or unstake them.",
    "매각 상태에서는 당월 이자가 발생하지 않습니다. 이전 미수령 이자와 언스테이킹만 가능합니다.": "No new interest accrues during sale status. Only previously unclaimed interest and unstaking are available.",
    "현재 단계에서는 이자 클레임이 열리지 않습니다.": "Interest claiming is not open at the current stage.",
    "환율 설정이 필요합니다. (관리자 FX 설정)": "Exchange-rate configuration is required. (Admin FX setting)",
    "스테이킹 잔고가 없습니다. 먼저 스테이킹하세요.": "There is no staking balance. Please stake first.",
    "예상 이자 내역이 없습니다.": "There is no estimated interest history.",
    "관리자가 배정한 이자를 누적해서 한 번에 클레임할 수 있습니다.": "You can accumulate the interest allocated by the administrator and claim it at once.",
    "보유에서 스테이킹으로 이동합니다.": "Moves from holdings to staking.",
    "스테이킹에서 보유로 이동합니다.": "Moves from staking back to holdings.",
    "표시할 거래 자산이 없습니다.": "There are no tradable assets to display.",
    "선택한 주문의 현재 잔량 이내에서만 거래할 수 있습니다.": "You can trade only within the current remaining quantity of the selected order.",
    "호가창에서 선택 버튼을 눌러 주문을 불러오세요.": "Use the Select button in the order book to load an order.",
    "모집완료 후 오프라인 매입 절차가 진행 중입니다.": "After funding is complete, the offline acquisition process is in progress.",
    "토큰 발행 후 분배(클레임)가 진행 중입니다.": "Token distribution (claim) is in progress after token issuance.",
    "운영 단계: 스테이킹 이자 및 P2P 거래가 가능합니다.": "Operating stage: staking interest and P2P trading are available.",
    "매각 정산 완료: 토큰 반환 후 차익을 수령합니다.": "Sale settlement complete: return the tokens and receive the profit difference.",
    "모집 미달: 만료 후 환불(Refund) 청구가 열립니다.": "Underfunded: refund claims open after expiry.",
    "매입 취소 자산입니다. 참여 내역과 환불 완료 여부를 확인할 수 있습니다.": "This asset acquisition was cancelled. You can check participation history and refund status.",
    "* 모집 달성으로 단계 전환 처리 중입니다. 잠시 후 다시 확인하세요.": "* Stage transition is being processed after the funding target was reached. Please check again shortly.",
    "조건에 맞는 자산이 없습니다.": "No assets match the selected conditions.",
    "토큰을 받은 후 스테이킹풀에 예치하여 이자권리를 유지하세요.": "After receiving tokens, deposit them into the staking pool to maintain your interest entitlement.",
    "자산 토큰 정보와 정산통화 정보를 분리하여 표시합니다.": "Asset token information and settlement-currency information are shown separately.",
    "모금 확정 환율 기준으로, 내 권리만큼 자산 토큰을 수령합니다.": "Claim asset tokens according to your entitlement based on the final funding exchange rate.",
    "스테이킹 잔고와 환율 기준으로 월 이자가 계산되고, 배정된 이자는 누적 클레임할 수 있습니다.": "Monthly interest is calculated based on your staking balance and the exchange rate, and allocated interest can be claimed cumulatively.",
    "현재 자산은 매각 상태입니다. 신규 스테이킹과 당월 이자 배정은 중단되며, 이전 미클레임 이자 클레임과 언스테이킹만 가능합니다.": "This asset is in sale status. New staking and current-month interest allocation are suspended; only previously unclaimed interest claims and unstaking are available.",
    "현재 단계에서는 스테이킹이 비활성화됩니다. (상태:": "Staking is disabled at the current stage. (Status:"
  },
  "ja": {
    "지갑을 연결하면 내가 투자한 자산만 표시됩니다.": "ウォレットを接続すると、自分が投資した資産のみ表示されます。",
    "지갑을 연결하면 토큰 정보를 표시합니다.": "ウォレットを接続すると、トークン情報が表示されます。",
    "현재 지갑 주소로 모금 참여한 자산이 없습니다.": "現在のウォレットアドレスで募集参加した資産はありません。",
    "모금이 완료 되어 재단에서 토큰을 발행 및 등록중에 있습니다. 토큰등록이 완료 되면 분배 받을 수 있습니다.": "募集は完了しており、財団がトークンを発行・登録しています。トークン登録が完了すると配布を受け取れます。",
    "토큰 등록이 완료되었습니다. 관리자가 분배를 시작하면 클레임할 수 있습니다.": "トークン登録が完了しました。管理者が配布を開始すると受け取れます。",
    "클레임 버튼으로 자산 토큰을 수령할 수 있습니다.": "受取ボタンで資産トークンを受け取れます。",
    "미수령 수량이 있다면 계속 클레임할 수 있습니다.": "未受取数量がある限り、引き続き受け取れます。",
    "현재 미수령 수량이 없습니다. 수령 후에는 스테이킹 또는 거래가 가능합니다.": "現在、受取可能な数量はありません。受取後はステーキングまたは取引が可能です。",
    "미수령 토큰이 있다면 먼저 클레임한 뒤, 매각 정산으로 이동할 수 있습니다.": "未受取トークンがある場合は、まず受け取ってから売却精算へ進めます。",
    "매입 완료 후 토큰 등록 및 분배가 열립니다.": "買付完了後にトークン登録と配布が開きます。",
    "목표 달성 후 1 USDT = 1 Token 기준으로 발행 수량이 확정됩니다.": "目標達成後、1 USDT = 1 Token基準で発行数量が確定します。",
    "환불 가능 여부를 확인하세요.": "返金可能かどうかを確認してください。",
    "취소된 자산입니다. 환불/참여 내역을 확인하세요.": "キャンセルされた資産です。返金・参加履歴を確認してください。",
    "클레임 가능 상태를 확인하세요.": "受取可能な状態か確認してください。",
    "모금 달성 시점에 확정된 환율입니다.": "募集達成時点で確定した為替です。",
    "확정 환율 정보가 없습니다.": "確定為替情報がありません。",
    "참여 내역이 없으면 클레임할 수 없습니다.": "参加履歴がない場合は受け取れません。",
    "클레임 후 스테이킹 풀에서 예치하고 수익을 받을 수 있습니다.": "受取後はステーキングプールに預けて収益を得られます。",
    "현재 자산 상태에 맞는 다음 단계를 확인하세요.": "現在の資産状態に合った次のステップを確認してください。",
    "토큰 발행 및 등록이 완료되면 클레임이 열립니다.": "トークン発行と登録が完了すると受取が開きます。",
    "현재 수령 가능 수량이 없습니다.": "現在、受取可能な数量がありません。",
    "지갑을 연결하면 내 참여 자산 기준으로 스테이킹/이자 기능이 활성화됩니다.": "ウォレットを接続すると、参加資産を基準にステーキング/利息機能が有効になります。",
    "지갑을 연결하면 이자 클레임이 활성화됩니다.": "ウォレットを接続すると利息受取が有効になります。",
    "체크를 해제하면 전체 스테이킹 풀을, 체크하면 보유 자산만 볼 수 있습니다.": "チェックを外すと全体のステーキングプールを、チェックすると保有資産のみを表示できます。",
    "보유에서 스테이킹으로 이동하거나, 언스테이킹이 가능합니다.": "保有からステーキングへ移す、またはアンステーキングが可能です。",
    "매각 상태에서는 당월 이자가 발생하지 않습니다. 이전 미수령 이자와 언스테이킹만 가능합니다.": "売却状態では当月利息は発生しません。過去の未受取利息とアンステーキングのみ可能です。",
    "현재 단계에서는 이자 클레임이 열리지 않습니다.": "現在の段階では利息受取は開いていません。",
    "환율 설정이 필요합니다. (관리자 FX 설정)": "為替設定が必要です。（管理者FX設定）",
    "스테이킹 잔고가 없습니다. 먼저 스테이킹하세요.": "ステーキング残高がありません。先にステーキングしてください。",
    "예상 이자 내역이 없습니다.": "予想利息の内訳がありません。",
    "관리자가 배정한 이자를 누적해서 한 번에 클레임할 수 있습니다.": "管理者が配分した利息を累積して一度に受け取れます。",
    "보유에서 스테이킹으로 이동합니다.": "保有からステーキングへ移動します。",
    "스테이킹에서 보유로 이동합니다.": "ステーキングから保有へ移動します。",
    "표시할 거래 자산이 없습니다.": "表示する取引資産がありません。",
    "선택한 주문의 현재 잔량 이내에서만 거래할 수 있습니다.": "選択した注文の現在残量の範囲内でのみ取引できます。",
    "호가창에서 선택 버튼을 눌러 주문을 불러오세요.": "板の選択ボタンを押して注文を読み込んでください。",
    "모집완료 후 오프라인 매입 절차가 진행 중입니다.": "募集完了後、オフライン買付手続きが進行中です。",
    "토큰 발행 후 분배(클레임)가 진행 중입니다.": "トークン発行後、配布（受取）が進行中です。",
    "운영 단계: 스테이킹 이자 및 P2P 거래가 가능합니다.": "運用段階：ステーキング利息とP2P取引が可能です。",
    "매각 정산 완료: 토큰 반환 후 차익을 수령합니다.": "売却精算完了：トークン返還後に差益を受け取ります。",
    "모집 미달: 만료 후 환불(Refund) 청구가 열립니다.": "募集未達：満了後に返金請求が開きます。",
    "매입 취소 자산입니다. 참여 내역과 환불 완료 여부를 확인할 수 있습니다.": "買付が取り消された資産です。参加履歴と返金完了状況を確認できます。",
    "* 모집 달성으로 단계 전환 처리 중입니다. 잠시 후 다시 확인하세요.": "※ 募集達成により段階転換を処理中です。しばらくしてから再確認してください。",
    "조건에 맞는 자산이 없습니다.": "条件に合う資産がありません。",
    "토큰을 받은 후 스테이킹풀에 예치하여 이자권리를 유지하세요.": "トークン受取後、ステーキングプールに預けて利息権利を維持してください。",
    "자산 토큰 정보와 정산통화 정보를 분리하여 표시합니다.": "資産トークン情報と精算通貨情報を分けて表示します。",
    "모금 확정 환율 기준으로, 내 권리만큼 자산 토큰을 수령합니다.": "募集確定為替を基準に、自分の権利分だけ資産トークンを受け取ります。",
    "스테이킹 잔고와 환율 기준으로 월 이자가 계산되고, 배정된 이자는 누적 클레임할 수 있습니다.": "ステーキング残高と為替を基準に月次利息が計算され、配分された利息は累積受取できます。",
    "현재 자산은 매각 상태입니다. 신규 스테이킹과 당월 이자 배정은 중단되며, 이전 미클레임 이자 클레임과 언스테이킹만 가능합니다.": "現在の資産は売却状態です。新規ステーキングと当月利息配分は停止され、過去の未受取利息とアンステーキングのみ可能です。",
    "현재 단계에서는 스테이킹이 비활성화됩니다. (상태:": "現在の段階ではステーキングは無効です。（状態："
  },
  "zh": {
    "지갑을 연결하면 내가 투자한 자산만 표시됩니다.": "连接钱包后，仅显示你已投资的资产。",
    "지갑을 연결하면 토큰 정보를 표시합니다.": "连接钱包后将显示代币信息。",
    "현재 지갑 주소로 모금 참여한 자산이 없습니다.": "当前钱包地址没有参与募资的资产。",
    "모금이 완료 되어 재단에서 토큰을 발행 및 등록중에 있습니다. 토큰등록이 완료 되면 분배 받을 수 있습니다.": "募资已完成，基金会正在发行并登记代币。代币登记完成后即可领取分配。",
    "토큰 등록이 완료되었습니다. 관리자가 분배를 시작하면 클레임할 수 있습니다.": "代币登记已完成。管理员开始分配后即可领取。",
    "클레임 버튼으로 자산 토큰을 수령할 수 있습니다.": "你可以通过领取按钮领取资产代币。",
    "미수령 수량이 있다면 계속 클레임할 수 있습니다.": "只要仍有未领取数量，就可以继续领取。",
    "현재 미수령 수량이 없습니다. 수령 후에는 스테이킹 또는 거래가 가능합니다.": "当前没有可领取数量。领取后可进行质押或交易。",
    "미수령 토큰이 있다면 먼저 클레임한 뒤, 매각 정산으로 이동할 수 있습니다.": "如果仍有未领取代币，请先领取后再进入出售结算。",
    "매입 완료 후 토큰 등록 및 분배가 열립니다.": "收购完成后将开放代币登记和分配。",
    "목표 달성 후 1 USDT = 1 Token 기준으로 발행 수량이 확정됩니다.": "达成目标后，将按 1 USDT = 1 Token 的标准确定发行数量。",
    "환불 가능 여부를 확인하세요.": "请确认是否可以退款。",
    "취소된 자산입니다. 환불/참여 내역을 확인하세요.": "该资产已取消。请查看退款/参与记录。",
    "클레임 가능 상태를 확인하세요.": "请确认是否处于可领取状态。",
    "모금 달성 시점에 확정된 환율입니다.": "这是募资达成时确定的汇率。",
    "확정 환율 정보가 없습니다.": "没有锁定汇率信息。",
    "참여 내역이 없으면 클레임할 수 없습니다.": "没有参与记录则无法领取。",
    "클레임 후 스테이킹 풀에서 예치하고 수익을 받을 수 있습니다.": "领取后可存入质押池并获得收益。",
    "현재 자산 상태에 맞는 다음 단계를 확인하세요.": "请确认与当前资产状态相符的下一步。",
    "토큰 발행 및 등록이 완료되면 클레임이 열립니다.": "代币发行和登记完成后将开放领取。",
    "현재 수령 가능 수량이 없습니다.": "当前没有可领取数量。",
    "지갑을 연결하면 내 참여 자산 기준으로 스테이킹/이자 기능이 활성화됩니다.": "连接钱包后，将按你参与的资产启用质押/利息功能。",
    "지갑을 연결하면 이자 클레임이 활성화됩니다.": "连接钱包后将启用利息领取。",
    "체크를 해제하면 전체 스테이킹 풀을, 체크하면 보유 자산만 볼 수 있습니다.": "取消勾选可查看全部质押池，勾选后仅查看持有资产。",
    "보유에서 스테이킹으로 이동하거나, 언스테이킹이 가능합니다.": "可以从持有转入质押，或执行解除质押。",
    "매각 상태에서는 당월 이자가 발생하지 않습니다. 이전 미수령 이자와 언스테이킹만 가능합니다.": "出售状态下当月不再产生利息，仅可领取此前未领取利息并解除质押。",
    "현재 단계에서는 이자 클레임이 열리지 않습니다.": "当前阶段未开放利息领取。",
    "환율 설정이 필요합니다. (관리자 FX 설정)": "需要先设置汇率。（管理员FX设置）",
    "스테이킹 잔고가 없습니다. 먼저 스테이킹하세요.": "没有质押余额。请先质押。",
    "예상 이자 내역이 없습니다.": "没有预计利息明细。",
    "관리자가 배정한 이자를 누적해서 한 번에 클레임할 수 있습니다.": "管理员分配的利息会累计，你可以一次性领取。",
    "보유에서 스테이킹으로 이동합니다.": "从持有转入质押。",
    "스테이킹에서 보유로 이동합니다.": "从质押转回持有。",
    "표시할 거래 자산이 없습니다.": "没有可显示的交易资产。",
    "선택한 주문의 현재 잔량 이내에서만 거래할 수 있습니다.": "只能在所选订单当前剩余数量范围内交易。",
    "호가창에서 선택 버튼을 눌러 주문을 불러오세요.": "请在盘口中点击“选择”按钮加载订单。",
    "모집완료 후 오프라인 매입 절차가 진행 중입니다.": "募资完成后，线下收购流程正在进行中。",
    "토큰 발행 후 분배(클레임)가 진행 중입니다.": "代币发行后，分配（领取）正在进行中。",
    "운영 단계: 스테이킹 이자 및 P2P 거래가 가능합니다.": "运营阶段：可进行质押利息和 P2P 交易。",
    "매각 정산 완료: 토큰 반환 후 차익을 수령합니다.": "出售结算完成：返还代币后领取差价收益。",
    "모집 미달: 만료 후 환불(Refund) 청구가 열립니다.": "募资未达标：到期后将开放退款申请。",
    "매입 취소 자산입니다. 참여 내역과 환불 완료 여부를 확인할 수 있습니다.": "该资产收购已取消。可查看参与记录和退款完成情况。",
    "* 모집 달성으로 단계 전환 처리 중입니다. 잠시 후 다시 확인하세요.": "＊ 因募资达标，系统正在处理阶段转换。请稍后再查看。",
    "조건에 맞는 자산이 없습니다.": "没有符合条件的资产。",
    "토큰을 받은 후 스테이킹풀에 예치하여 이자권리를 유지하세요.": "领取代币后，请存入质押池以保持利息权益。",
    "자산 토큰 정보와 정산통화 정보를 분리하여 표시합니다.": "资产代币信息和结算货币信息将分开展示。",
    "모금 확정 환율 기준으로, 내 권리만큼 자산 토큰을 수령합니다.": "按募资确定汇率，领取你应得的资产代币。",
    "스테이킹 잔고와 환율 기준으로 월 이자가 계산되고, 배정된 이자는 누적 클레임할 수 있습니다.": "根据质押余额和汇率计算月度利息，已分配利息可累计领取。",
    "현재 자산은 매각 상태입니다. 신규 스테이킹과 당월 이자 배정은 중단되며, 이전 미클레임 이자 클레임과 언스테이킹만 가능합니다.": "当前资产处于出售状态。新的质押和当月利息分配将停止，仅可领取此前未领取利息并解除质押。",
    "현재 단계에서는 스테이킹이 비활성화됩니다. (상태:": "当前阶段质押不可用。（状态："
  }
};
  const EXTRA_PARTS_V4 = {
  "en": {
    "자산 목록": "Asset List",
    "자산 선택": "Select Asset",
    "선택 자산": "Selected Asset",
    "토큰 정보": "Token Information",
    "토큰명": "Token Name",
    "토큰 약어": "Token Symbol",
    "정산통화": "Settlement Currency",
    "총 발행량": "Total Supply",
    "총발행량": "Total Supply",
    "내 분배 완료": "My Distributed",
    "확정 환율": "Locked FX",
    "클레임 안내": "Claim Guide",
    "수령 힌트": "Claim Tip",
    "스테이킹 수량": "Staked Amount",
    "언스테이킹 수량": "Unstaked Amount",
    "지급일": "Payout Date",
    "예상 이자": "Estimated Interest",
    "예상 이자 내역": "Estimated Interest History",
    "클레임 내역": "Claim History",
    "정산 기간": "Settlement Period",
    "월/회차": "Month / Batch",
    "환율": "FX",
    "최근체결": "Last Trade",
    "거래 가능 자산 검색": "Search Tradable Assets",
    "정산통화 기준 참고": "Settlement Currency Reference",
    "체결 기준 시세 그래프": "Execution-based Price Chart",
    "월간 기준(요약)": "Monthly Summary",
    "시가": "Open",
    "고가": "High",
    "저가": "Low",
    "종가": "Close",
    "호가창": "Order Book",
    "간편 거래": "Quick Trade",
    "주문 생성": "Create Order",
    "거래수수료": "Trading Fee",
    "실제 수령자산": "Actual Asset Received",
    "만료일(선택)": "Expiry Date (Optional)",
    "무기한": "Open-ended",
    "불러오는 중...": "Loading...",
    "거래 불가": "Trading Disabled",
    "즉시체결": "Instant Fill",
    "체결": "Fill",
    "선택": "Select",
    "거래하기": "Trade Now",
    "매도 주문": "Sell Order",
    "매수 주문": "Buy Order",
    "내 주문": "My Orders",
    "구분": "Type",
    "잔량": "Remaining",
    "매수호가": "Best Bid",
    "매도호가": "Best Ask",
    "최근 체결": "Recent Trades",
    "클레임 로그": "Claim Log",
    "모금 참여": "Funding",
    "토큰 준비중": "Token Pending",
    "진행 확인": "Check Progress",
    "매각 차익 받기": "Claim Sale Profit",
    "모집실패": "Funding Failed",
    "모집 실패": "Funding Failed",
    "매입 취소": "Acquisition Cancelled",
    "매입 진행중": "Acquisition in Progress",
    "모금 진행중": "Funding in Progress",
    "토큰 등록 대기": "Awaiting Token Registration",
    "토큰 등록 완료": "Token Registration Complete",
    "토큰 등록중": "Registering Tokens",
    "수령": "Claimed",
    "수령 가능": "Available to Claim",
    "이미 수령": "Already Claimed",
    "민트 주소": "Mint Address",
    "수령 실행": "Claim Action",
    "클레임 실행": "Claim Action"
  },
  "ja": {
    "자산 목록": "資産一覧",
    "자산 선택": "資産を選択",
    "선택 자산": "選択資産",
    "토큰 정보": "トークン情報",
    "토큰명": "トークン名",
    "토큰 약어": "トークン略号",
    "정산통화": "精算通貨",
    "총 발행량": "総発行量",
    "총발행량": "総発行量",
    "내 분배 완료": "自分の配布完了",
    "확정 환율": "確定為替",
    "클레임 안내": "受取案内",
    "수령 힌트": "受取ヒント",
    "스테이킹 수량": "ステーキング数量",
    "언스테이킹 수량": "アンステーキング数量",
    "지급일": "支給日",
    "예상 이자": "予想利息",
    "예상 이자 내역": "予想利息内訳",
    "클레임 내역": "受取履歴",
    "정산 기간": "精算期間",
    "월/회차": "月 / 回次",
    "환율": "為替",
    "최근체결": "最新約定",
    "거래 가능 자산 검색": "取引可能資産を検索",
    "정산통화 기준 참고": "精算通貨基準の参考",
    "체결 기준 시세 그래프": "約定基準価格グラフ",
    "월간 기준(요약)": "月間基準（要約）",
    "시가": "始値",
    "고가": "高値",
    "저가": "安値",
    "종가": "終値",
    "호가창": "板情報",
    "간편 거래": "簡単取引",
    "주문 생성": "注文作成",
    "거래수수료": "取引手数料",
    "실제 수령자산": "実際の受取資産",
    "만료일(선택)": "満了日（任意）",
    "무기한": "無期限",
    "불러오는 중...": "読み込み中...",
    "거래 불가": "取引不可",
    "즉시체결": "即時約定",
    "체결": "約定",
    "선택": "選択",
    "거래하기": "取引する",
    "매도 주문": "売り注文",
    "매수 주문": "買い注文",
    "내 주문": "自分の注文",
    "구분": "区分",
    "잔량": "残量",
    "매수호가": "買い気配",
    "매도호가": "売り気配",
    "최근 체결": "最近の約定",
    "클레임 로그": "受取ログ",
    "모금 참여": "募集参加",
    "토큰 준비중": "トークン準備中",
    "진행 확인": "進行確認",
    "매각 차익 받기": "売却差益を受け取る",
    "모집실패": "募集失敗",
    "모집 실패": "募集失敗",
    "매입 취소": "買付取消",
    "매입 진행중": "買付進行中",
    "모금 진행중": "募集中",
    "토큰 등록 대기": "トークン登録待機",
    "토큰 등록 완료": "トークン登録完了",
    "토큰 등록중": "トークン登録中",
    "수령": "受取",
    "수령 가능": "受取可能",
    "이미 수령": "受取済み",
    "민트 주소": "Mintアドレス",
    "수령 실행": "受取実行",
    "클레임 실행": "受取実行"
  },
  "zh": {
    "자산 목록": "资产列表",
    "자산 선택": "选择资产",
    "선택 자산": "所选资产",
    "토큰 정보": "代币信息",
    "토큰명": "代币名称",
    "토큰 약어": "代币简称",
    "정산통화": "结算货币",
    "총 발행량": "总发行量",
    "총발행량": "总发行量",
    "내 분배 완료": "我的已分配数量",
    "확정 환율": "锁定汇率",
    "클레임 안내": "领取说明",
    "수령 힌트": "领取提示",
    "스테이킹 수량": "质押数量",
    "언스테이킹 수량": "解除质押数量",
    "지급일": "发放日",
    "예상 이자": "预计利息",
    "예상 이자 내역": "预计利息明细",
    "클레임 내역": "领取记录",
    "정산 기간": "结算期间",
    "월/회차": "月份 / 期次",
    "환율": "汇率",
    "최근체결": "最新成交",
    "거래 가능 자산 검색": "搜索可交易资产",
    "정산통화 기준 참고": "结算货币参考",
    "체결 기준 시세 그래프": "按成交计算的价格图表",
    "월간 기준(요약)": "月度概览",
    "시가": "开盘",
    "고가": "最高",
    "저가": "最低",
    "종가": "收盘",
    "호가창": "盘口",
    "간편 거래": "快捷交易",
    "주문 생성": "创建订单",
    "거래수수료": "交易手续费",
    "실제 수령자산": "实际收到的资产",
    "만료일(선택)": "到期日（可选）",
    "무기한": "无期限",
    "불러오는 중...": "加载中...",
    "거래 불가": "不可交易",
    "즉시체결": "立即成交",
    "체결": "成交",
    "선택": "选择",
    "거래하기": "立即交易",
    "매도 주문": "卖单",
    "매수 주문": "买单",
    "내 주문": "我的订单",
    "구분": "类型",
    "잔량": "剩余数量",
    "매수호가": "买入价",
    "매도호가": "卖出价",
    "최근 체결": "最近成交",
    "클레임 로그": "领取日志",
    "모금 참여": "参与募资",
    "토큰 준비중": "代币准备中",
    "진행 확인": "查看进度",
    "매각 차익 받기": "领取出售差价收益",
    "모집실패": "募资失败",
    "모집 실패": "募资失败",
    "매입 취소": "收购取消",
    "매입 진행중": "收购进行中",
    "모금 진행중": "募资进行中",
    "토큰 등록 대기": "等待代币登记",
    "토큰 등록 완료": "代币登记完成",
    "토큰 등록중": "代币登记中",
    "수령": "已领取",
    "수령 가능": "可领取",
    "이미 수령": "已领取",
    "민트 주소": "Mint地址",
    "수령 실행": "执行领取",
    "클레임 실행": "执行领取"
  }
};
  mergeLangMap(EXACT, EXTRA_EXACT_V4);
  mergeLangMap(PARTS, EXTRA_PARTS_V4);
  const EXTRA_EXACT_V5 = {
    ko: {
      "Fractional Real Estate STO": "부동산 조각 투자 STO",
      "Interest claims open on the 15th of each month based on your staking balance.": "스테이킹 잔고 기준으로 매월 15일에 이자 클레임이 열립니다.",
      "Staking and unstaking are restricted during the settlement period (14th-16th).": "정산 기간(14~16일)에는 스테이킹/언스테이킹이 제한됩니다.",
      "Token prices may fluctuate based on market trading.": "토큰 가격은 시장 거래에 의해 변동될 수 있습니다.",
      "Sale settlements are processed sequentially depending on the settlement reserve status.": "매각 정산은 정산 준비금 상황에 따라 순차적으로 진행됩니다.",
      "Withdrawal Policy": "출금 정책",
      "Withdrawal History": "출금 내역",
      "Claim Interest": "이자 클레임",
      "Claim History": "클레임 내역",
      "Staking Rules Summary": "스테이킹 규칙 요약",
      "View detailed calculation method": "상세한 계산 방법 보기",
      "Settlement Guide": "정산 안내",
      "Reward Rules": "보상 규칙",
      "Trading Fee": "거래 수수료",
      "My USDT": "내 USDT",
      "My Total Tokens": "내 총보유 토큰",
      "My Available Tokens": "내 가용 토큰",
      "Connect Wallet required": "지갑 연결 필요",
      "OTP verification is required.": "OTP 인증이 필요합니다.",
      "Login is required.": "로그인이 필요합니다.",
      "Portfolio could not be loaded.": "포트폴리오를 불러오지 못했습니다.",
      "There are no sell orders.": "매도 주문이 없습니다.",
      "There are no orders.": "내 주문이 없습니다.",
      "Token distribution is in progress.": "토큰 분배중",
      "Distribution in Progress": "분배중",
      "Status": "상태",
      "Details": "상세",
      "April 15": "4월 15일",
      "Please log in to continue.": "로그인이 필요합니다."
    },
    en: {
      "스테이킹 잔고 기준으로 매월 15일에 이자 클레임이 열립니다.": "Interest claims open on the 15th of each month based on your staking balance.",
      "정산 기간(14~16일)에는 스테이킹/언스테이킹이 제한됩니다.": "Staking and unstaking are restricted during the settlement period (14th-16th).",
      "토큰 가격은 시장 거래에 의해 변동될 수 있습니다.": "Token prices may fluctuate based on market trading.",
      "매각 정산은 정산 준비금 상황에 따라 순차적으로 진행됩니다.": "Sale settlements are processed sequentially depending on the settlement reserve status.",
      "토큰 분배중": "Token distribution is in progress.",
      "분배중": "Distribution in Progress",
      "팬텀 지갑 USDT 보유량: 0 USDT": "Phantom Wallet USDT Balance: 0 USDT",
      "출금 가능 수량: 0 USDT": "Withdrawable Amount: 0 USDT",
      "출금 신청 금액 (USDT)": "Withdrawal Request Amount (USDT)",
      "매도 주문이 없습니다.": "There are no sell orders.",
      "내 주문이 없습니다.": "There are no orders.",
      "포트폴리오를 불러오지 못했습니다.": "Portfolio could not be loaded.",
      "로그인이 필요합니다.": "Login is required.",
      "OTP 인증이 필요합니다.": "OTP verification is required.",
      "매각 완료된 자산이 없습니다.": "There are no completed sale assets.",
      "추천인 정보를 불러오는 중...": "Loading referral information...",
      "호가창의 선택 버튼을 누르면 주문 ID, 가격, 잔량이 채워지고 원하는 수량만 거래할 수 있습니다.": "Click Select in the order book to fill the order ID, price, and remaining quantity, then trade only the amount you want.",
      "매각금/제비용은 자산의 정산통화 기준으로 입력됩니다.": "Sale proceeds and expenses are entered in the asset's settlement currency.",
      "수령액은 지급 시점 환율을 적용하여 USDT로 지급됩니다.": "Payouts are converted to and paid in USDT using the exchange rate at the time of payment.",
      "토큰 발행 후 분배(클레임)가 진행 중입니다.": "Token issuance is complete and distribution (claim) is in progress.",
      "매월 15일 스테이킹 잔고 기준으로 이자가 계산되며, 정산통화 계산 중 절삭 없이 계산한 뒤 최종 USDT 소수 첫째 자리까지 계정에 반영됩니다.": "Interest is calculated on the 15th of each month based on your staking balance. The settlement-currency calculation is performed without truncation, and only the final USDT amount credited to your account is rounded down to the first decimal place.",
      "1. 투자원금은 모금 달성(또는 마감) 시점 환율로 확정됩니다.": "1. The investment principal is fixed using the exchange rate at the time funding is completed (or closes).",
      "예: 2,000 USDT 투자 × 확정 환율 1,500 = 3,000,000 정산통화 기준 원금입니다.": "Example: 2,000 USDT investment × locked FX 1,500 = 3,000,000 in settlement-currency principal.",
      "2. 월 이자는 확정 원금에 연이자율/12를 적용합니다.": "2. Monthly interest is calculated by applying annual interest / 12 to the locked principal.",
      "예: 연 8%면 월 이자 기준은 3,000,000 × 8% ÷ 12 입니다.": "Example: At 8% APR, the monthly interest basis is 3,000,000 × 8% ÷ 12.",
      "3. 계산된 월 이자는 지급일(15일) 환율로 다시 USDT 환산해 확정합니다.": "3. The calculated monthly interest is converted to USDT again using the payout-day (15th) exchange rate and then finalized.",
      "4. 정산통화 기준 계산 과정에서는 절삭하지 않고, 최종 계정 반영 USDT만 소수 첫째 자리까지 반영합니다.": "4. No truncation is applied during settlement-currency calculations. Only the final USDT credited to the account is reflected to one decimal place.",
      "5. 정산 기간(14~16일)에는 스테이킹/언스테이킹이 제한되며, 17일부터 다시 가능합니다.": "5. Staking and unstaking are restricted during the settlement period (14th-16th) and become available again from the 17th.",
      "6. 자산이 매각 상태가 되면 신규 스테이킹과 당월 이자 배정이 중단되며, 이전 미클레임 이자와 언스테이킹만 가능합니다.": "6. Once an asset enters sale status, new staking and current-month interest allocation stop. Only previously unclaimed interest and unstaking remain available.",
      "* 토큰을 받은 후 스테이킹풀에 예치하여 이자권리를 유지하세요.": "* After receiving tokens, deposit them into the staking pool to keep your interest rights.",
      "추천인 코드를 얻은 유저는 투자유저의": "Users with a referral code receive a bonus as soon as the investor's",
      "가 월별로 배정되는 즉시": "is allocated each month.",
      "스테이킹 이자 배정분의": "The bonus amount is",
      "를 추가 보상으로 받습니다.": "of the allocated staking interest.",
      "투자유저가 직접 이자를 클레임하지 않아도 추천 보상은 자동으로 즉시 지급됩니다.": "Referral rewards are paid automatically and immediately even if the investor does not manually claim the interest.",
      "보상금은 USDT 잔액에 누적되며, 출금 요청 시 인출할 수 있습니다.": "Reward amounts accumulate in your USDT balance and can be withdrawn when you submit a withdrawal request.",
      "매각 차익에 대한 추천인 보상은 없습니다. 오직 스테이킹 이자 배정분에 대해서만 보상이 발생합니다.": "There are no referral rewards for sale profits. Rewards apply only to allocated staking interest."
    },


  };

  const EXTRA_PARTS_V5 = {
    ko: {
      "Asset": "자산",
      "Assets": "자산",
      "Asset List": "자산 목록",
      "View Assets": "자산 보기",
      "Select Asset": "자산 선택",
      "Trade": "거래",
      "Trading": "거래",
      "Claim": "클레임",
      "Claim Interest": "이자 클레임",
      "Claim History": "클레임 내역",
      "Token": "토큰",
      "Token Distribution": "토큰 분배",
      "Token Distribution (Claim)": "토큰 분배(클레임)",
      "Status": "상태",
      "Details": "상세",
      "Distribution in Progress": "분배중",
      "Token distribution is in progress.": "토큰 분배중",
      "Trading Fee": "거래 수수료",
      "My USDT": "내 USDT",
      "My Total Tokens": "내 총보유 토큰",
      "My Available Tokens": "내 가용 토큰",
      "Settlement Guide": "정산 안내",
      "Reward Rules": "보상 규칙",
      "Staking Rules Summary": "스테이킹 규칙 요약",
      "View detailed calculation method": "상세한 계산 방법 보기",
      "Month / Round": "월 / 회차",
      "Settlement Amount": "정산금액",
      "Received Amount (USDT)": "수령금액 (USDT)",
      "Status / Time": "상태 / 시간",
      "Withdrawal": "출금",
      "Withdrawal Policy": "출금 정책",
      "Withdrawal History": "출금 내역",
      "Withdrawal Request Amount (USDT)": "출금 신청 금액 (USDT)",
      "Withdrawable Amount": "출금 가능 수량",
      "Phantom Wallet USDT Balance": "팬텀 지갑 USDT 보유량",
      "Connect Wallet": "지갑 연결",
      "Login is required.": "로그인이 필요합니다.",
      "OTP verification is required.": "OTP 인증이 필요합니다.",
      "Loading referral information...": "추천인 정보를 불러오는 중...",
      "Portfolio could not be loaded.": "포트폴리오를 불러오지 못했습니다.",
      "There are no sell orders.": "매도 주문이 없습니다.",
      "There are no orders.": "내 주문이 없습니다."
    },
    en: {
      "로그인 후 확인": "Check after login",
      "출금 정책": "Withdrawal Policy",
      "출금 내역": "Withdrawal History",
      "출금 신청 금액 (USDT)": "Withdrawal Request Amount (USDT)",
      "출금 가능 수량": "Withdrawable Amount",
      "팬텀 지갑 USDT 보유량": "Phantom Wallet USDT Balance",
      "토큰 분배중": "Token distribution is in progress.",
      "분배중": "Distribution in Progress",
      "매도 주문이 없습니다.": "There are no sell orders.",
      "내 주문이 없습니다.": "There are no orders.",
      "포트폴리오를 불러오지 못했습니다.": "Portfolio could not be loaded.",
      "OTP 인증이 필요합니다.": "OTP verification is required.",
      "로그인이 필요합니다.": "Login is required.",
      "상세": "Details",
      "정산 안내": "Settlement Guide",
      "보상 규칙": "Reward Rules",
      "스테이킹 규칙 요약": "Staking Rules Summary",
      "상세한 계산 방법 보기": "View detailed calculation method"
    },


  };

  mergeLangMap(EXACT, EXTRA_EXACT_V5);
  mergeLangMap(PARTS, EXTRA_PARTS_V5);

  const EXTRA_EXACT_V6 = {
  "en": {
    "소개 · RECON RWA": "About · RECON RWA",
    "실물 부동산을 토큰으로": "Real Estate, Tokenized",
    "4단계로 진행되는 부동산 토큰 투자": "Real-estate token investing in 4 steps",
    "부동산 매입을 위한 모금에 참여합니다. 목표가 달성되면 매입 단계로 넘어갑니다.": "Participate in funding for the property acquisition. Once the target is reached, it moves to the acquisition stage.",
    "실물 부동산 매입 완료 후 토큰이 발행되고, 참여 비율에 맞춰 클레임으로 수령합니다.": "After the real property acquisition is completed, tokens are issued and can be claimed according to your participation ratio.",
    "P2P 거래로 유동성을 확보하고, 스테이킹으로 고정 이자 클레임에 참여합니다.": "Secure liquidity through P2P trading and participate in fixed-interest claims through staking.",
    "매각이 완료되면 제비용을 제한 실수익을 정산하고, 토큰을 반환하면 차익을 수령합니다.": "Once the sale is completed, the net proceeds are settled after expenses, and you receive the profit after returning the tokens.",
    "투명한 증빙과 수익 산정 기준": "Transparent documentation and profit-calculation standards",
    "매수/매각 관련 서류(일부 마스킹), 감정평가, 회계사 공문서를 페이지에서 확인할 수 있습니다.": "Documents related to purchase/sale (partially masked), appraisals, and certified accountant letters can be reviewed on the page.",
    "실제 매각수익은 매각 시 발생하는 세금, 공과금, 회계사 수수료, 현지 인건비 등을 제한 금액입니다.": "Actual sale profit is the amount remaining after taxes, public charges, accountant fees, local labor costs, and other expenses incurred at the time of sale.",
    "성명과 생년월일은 KYC 검증에 사용됩니다. 한 번 저장하면 변경할 수 없습니다.": "Your legal name and date of birth are used for KYC verification. Once saved, they cannot be changed.",
    "입력한 정보와 신분증 정보가 다르면 출금이 제한될 수 있습니다.": "Withdrawals may be restricted if the information entered does not match your ID document.",
    "형식: YYYY-MM-DD": "Format: YYYY-MM-DD",
    "실명 입력": "Enter your legal name",
    "관리자 승인을 받은 유저만 추천인 코드를 발급받아 추천 보상을 받을 수 있습니다.": "Only users approved by the administrator can receive a referral code and earn referral rewards.",
    "스테이킹 이자": "Staking Interest",
    "내 추천 코드": "My Referral Code",
    "추천 현황": "Referral Status",
    "추천수:": "Referrals:",
    "총 보너스:": "Total Bonus:",
    "아직 추천인으로 승인되지 않았습니다.": "You have not yet been approved as a referrer.",
    "관리자에게 추천인 신청을 문의하세요.": "Please contact the administrator to apply as a referrer.",
    "지갑을 연결하면 추천인 상태를 확인할 수 있습니다.": "Connect your wallet to check your referrer status.",
    "추천 내역": "Referral History",
    "내 추천인 상태": "My Referrer Status",
    "나의 추천인": "My Referrer",
    "내가 추천한 유저": "Users I Referred",
    "보너스 내역": "Bonus History",
    "유저": "User",
    "연결일": "Linked At",
    "보너스(USDT)": "Bonus (USDT)",
    "USDT 또는 보유한 부동산 자산 토큰을 출금할 수 있습니다. 실제 전송은 관리자가 처리합니다.": "You can withdraw USDT or the real-estate asset tokens you hold. The actual transfer is processed by the administrator.",
    "출금 주소는 현재 로그인한 지갑 주소로 자동 고정됩니다. 보안을 위해 다른 주소로 수정할 수 없습니다.": "The withdrawal address is automatically locked to the wallet address currently logged in. For security reasons, it cannot be changed to another address.",
    "보안을 위해 로그인한 계정의 Solana 주소로만 출금할 수 있으며, 주소 수정은 허용되지 않습니다.": "For security reasons, withdrawals are only allowed to the Solana address of the logged-in account, and address editing is not allowed.",
    "선택한 자산 기준으로 출금 신청이 진행됩니다.": "The withdrawal request is processed based on the selected asset.",
    "출금 신청/내역 조회는 OTP(로그인 토큰 mfa=1) 상태에서만 가능합니다.": "Withdrawal requests and history lookup are available only when OTP is verified (login token mfa=1).",
    "USDT 출금과 자산 토큰 출금 내역, 반려 사유를 확인할 수 있습니다.": "You can review USDT withdrawals, asset-token withdrawal history, and rejection reasons.",
    "출금 자산 아이콘": "Withdrawal asset icon",
    "로그인한 지갑주소가 자동으로 입력됩니다.": "The logged-in wallet address is filled in automatically.",
    "출금 OTP 6자리": "6-digit withdrawal OTP",
    "⚠ Devnet 환경": "⚠ Devnet Environment",
    "Phantom 지갑 설정에서 네트워크를": "In Phantom wallet settings, change the network to",
    "으로 변경해야 합니다.": ".",
    "Phantom → 설정(⚙) → 개발자 설정 → 테스트넷 모드 활성화 → Solana Devnet 선택": "Phantom → Settings (⚙) → Developer Settings → Enable Testnet Mode → Select Solana Devnet",
    "USDT 또는 부동산 자산 토큰을 선택해서 입금할 수 있습니다.": "You can deposit by selecting USDT or a real-estate asset token.",
    "최대 버튼은 현재 팬텀 지갑의 USDT 보유량 기준으로 입력됩니다.": "The Max button fills the amount based on your current Phantom-wallet USDT balance.",
    "입금 반영/내역 조회는 OTP(로그인 토큰 mfa=1) 상태에서만 가능합니다.": "Deposit crediting and history lookup are available only when OTP is verified (login token mfa=1).",
    "입금/출금 내역이 표시됩니다. 자산 토큰 입금도 여기에서 확인할 수 있습니다.": "Deposit/withdrawal history is shown here. Asset-token deposits can also be checked here.",
    "전송을 처리하고 있습니다. 잠시만 기다려주세요.": "Your transfer is being processed. Please wait a moment.",
    "모집 확정 환율:": "Locked Funding FX:",
    "공시/평가:": "Disclosure / Appraisal:",
    "만료": "Expiry",
    "호가창의": "In the order book,",
    "은 해당 주문 잔량 전체를 바로 거래하고,": "executes the entire remaining quantity of that order immediately, and",
    "은 주문 ID·가격·잔량을 우측에 채운 뒤 원하는 수량만 거래합니다.": "fills the order ID, price, and remaining quantity on the right so you can trade only the amount you want.",
    "매도": "Sell",
    "매수": "Buy",
    "매도 주문 등록 시 판매 수량이 체결 전까지 예치됩니다. 확인 팝업에서 거래수수료와 예상 실제 수령 USDT를 확인할 수 있습니다.": "When you place a sell order, the selling quantity is escrowed until execution. In the confirmation popup, you can check the trading fee and the estimated USDT you will actually receive.",
    "매도 주문 생성": "Create Sell Order",
    "매수 주문 등록 시 USDT가 체결 전까지 예치됩니다. 확인 팝업에서 거래수수료와 실제 수령 토큰 수량을 확인할 수 있습니다.": "When you place a buy order, USDT is escrowed until execution. In the confirmation popup, you can check the trading fee and the actual token quantity you will receive.",
    "매수 주문 생성": "Create Buy Order",
    "수수료와 실제 수령 자산을 확인한 뒤 진행하세요.": "Proceed after checking the fees and the asset amount you will actually receive.",
    "진행": "Proceed",
    "예: BLD001 또는 강남": "e.g. BLD001 or Gangnam",
    "호가 전환": "Switch Order Book",
    "주문 생성 전환": "Switch Order Form",
    "매각 자산 교환이 가능합니다. 토큰 입금 후 토큰당 교환금액 기준으로 USDT를 수령합니다. (입금 즉시 토큰 영구 소각)": "Sold asset exchange is now available. Deposit tokens to receive USDT based on the token exchange amount. (Tokens are permanently burned immediately upon deposit.)",
    "목록": "List",
    "초기 투자금": "Initial Investment",
    "매각금": "Sale Proceeds",
    "제비용": "Expenses",
    "플랫폼 유저 할당총액(USDT)": "Platform User Allocation Total (USDT)",
    "프로젝트 순유입:": "Project Net Inflow:",
    "토큰당 교환금액": "Token Exchange Amount",
    "· 환율(참고):": "· FX (Reference):",
    "플랫폼 유저 할당총액:": "Platform User Allocation Total:",
    "· 토큰발행량:": "· Token Supply:",
    "* 유저 정산은 플랫폼 유저 할당총액(USDT)의 총액 기준(지급완료 포함)입니다. 토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 기준으로 계산되며, 토큰은 입금 즉시 영구 소각됩니다.": "* User settlement is based on the total platform user allocation amount (USDT), including completed payouts. The token exchange amount is calculated from platform user allocation total ÷ total token supply, and tokens are permanently burned immediately upon deposit.",
    "토큰 교환": "Token Exchange",
    "내 보유 수량": "My Holdings",
    "토큰 입금 수량(": "Token Deposit Quantity (",
    "입금 즉시 토큰은 영구 소각되며, 입금 수량 × 토큰당 교환금액만큼 USDT가 지급됩니다.": "Tokens are permanently burned immediately upon deposit, and USDT is paid by deposited quantity × token exchange amount.",
    "USDT로 교환(토큰 소각)": "Exchange to USDT (Burn Tokens)",
    "예상 수령액": "Estimated Payout",
    "남은 교환 가능액:": "Remaining Exchangeable Amount:",
    "회계사 공문서": "Certified Accountant Letter",
    "등록된 문서가 없습니다.": "There are no documents registered.",
    "수령 내역": "Receipt History",
    "입금(소각)": "Deposit (Burn)",
    "현지금액(참고)": "Local Amount (Reference)",
    "매각 자산 이미지": "Sale Asset Image",
    "토큰당 교환단가(현지통화)": "Token Exchange Unit Price (Local Currency)",
    "플랫폼 유저 기준 수익률": "Platform User Return",
    "내 교환 가능": "My Exchangeable Amount",
    "매각 자산 교환": "Sold Asset Exchange",
    "플랫폼 유저는 플랫폼 유저 할당총액을 기준으로 정산받습니다.": "Platform users are settled based on the platform user allocation total.",
    "토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 ÷ 매각 환율 기준으로 계산됩니다.": "The token exchange amount is calculated as platform user allocation total ÷ total token supply ÷ sale FX rate.",
    "스냅샷(지급일) 스테이킹 잔고": "Snapshot (Payout-Day) Staking Balance",
    "정산금액": "Settlement Amount",
    "수령금액(USDT)": "Received Amount (USDT)",
    "* 관리자가 이자를 배정하면 회차별로 누적되고, 사용자는 원하는 시점에 누적분을 한 번에 클레임합니다.": "* When the administrator allocates interest, it accumulates by round, and users can claim the accumulated amount at any time.",
    "* 이자 산식: 모금 확정 환율 기준 투자원금 → 연이자율/12 → 지급일 환율로 USDT 환산, 최종 계정 반영 USDT는 소수 첫째 자리까지만 반영됩니다.": "* Interest formula: investment principal at the locked funding FX → APR/12 → converted to USDT at the payout-day FX. Only the final USDT credited to the account is reflected to one decimal place.",
    "* 정산 기간에는 스테이킹/언스테이킹이 제한됩니다. 현재 설정 기준일은 상단 안내에 표시됩니다.": "* Staking and unstaking are restricted during the settlement period. The currently configured reference days are shown in the guide above.",
    "언스테이킹": "Unstake",
    "기준": "Reference",
    "물건 이미지": "Property Image",
    "누적이자": "Accumulated Interest",
    "미클레임": "Unclaimed",
    "바로가기": "Go",
    "분배 대기/클레임 가능 자산": "Awaiting Distribution / Claimable Assets",
    "보유 내역이 없습니다.": "There are no holdings.",
    "참여 내역이 없습니다.": "There is no participation history.",
    "계약 없음": "No Contracts",
    "지갑을 연결하면 내 투자 자산이 표시됩니다.": "Connect your wallet to display your invested assets.",
    "투자(참여)한 자산이 없습니다.": "There are no assets you have participated in.",
    "분배 자산을 불러오지 못했습니다.": "Unable to load distributable assets.",
    "보유 자산이 없습니다.": "There are no held assets.",
    "내역이 없습니다.": "There is no history.",
    "표시할 자산이 없습니다.": "There are no assets to display.",
    "모집완료 · 매입중": "Funding Complete · Acquiring",
    "모집완료 후 오프라인 매입 절차가 진행 중입니다.": "After funding is completed, the offline acquisition procedure is in progress.",
    "운영 단계: 스테이킹 이자 및 P2P 거래가 가능합니다.": "Operating stage: staking interest and P2P trading are available.",
    "매각 정산 완료: 토큰 반환 후 차익을 수령합니다.": "Sale settlement completed: return the tokens to receive the profit.",
    "매입 취소 자산입니다. 환불/참여 내역을 확인하세요.": "This asset acquisition has been canceled. Check your refund/participation history.",
    "최근 체결이 없습니다.": "There are no recent trades.",
    "조건에 맞는 자산이 없습니다.": "There are no assets matching the conditions.",
    "해당 자산 참여자만 토큰을 받을 수 있습니다.": "Only participants in this asset can receive tokens.",
    "참여 내역이 있는 사용자만 확인할 수 있습니다.": "Only users with participation history can check this.",
    "분배 대기 또는 클레임 가능한 자산이 없습니다.": "There are no assets awaiting distribution or available for claim.",
    "이미 내 클레임을 완료했습니다.": "I have already completed my claim.",
    "지갑 연결 후 입금 내역을 확인할 수 있습니다.": "Connect your wallet to check your deposit history.",
    "지갑을 연결하세요.": "Connect your wallet.",
    "Select Asset 필요": "Asset selection required",
    "자세히 보기": "View Details"
  },
  "ja": {
    "소개 · RECON RWA": "紹介 · RECON RWA",
    "실물 부동산을 토큰으로": "実物不動産をトークン化",
    "4단계로 진행되는 부동산 토큰 투자": "4段階で進む不動産トークン投資",
    "부동산 매입을 위한 모금에 참여합니다. 목표가 달성되면 매입 단계로 넘어갑니다.": "不動産取得のための募集に参加します。目標を達成すると買付段階へ進みます。",
    "실물 부동산 매입 완료 후 토큰이 발행되고, 참여 비율에 맞춰 클레임으로 수령합니다.": "実物不動産の取得完了後にトークンが発行され、参加比率に応じて受取で受領します。",
    "P2P 거래로 유동성을 확보하고, 스테이킹으로 고정 이자 클레임에 참여합니다.": "P2P取引で流動性を確保し、ステーキングで固定利息の受取に参加します。",
    "매각이 완료되면 제비용을 제한 실수익을 정산하고, 토큰을 반환하면 차익을 수령합니다.": "売却が完了すると諸費用控除後の実収益を精算し、トークンを返還すると差益を受け取ります。",
    "투명한 증빙과 수익 산정 기준": "透明な証憑と収益算定基準",
    "매수/매각 관련 서류(일부 마스킹), 감정평가, 회계사 공문서를 페이지에서 확인할 수 있습니다.": "売買関連書類（一部マスキング）、鑑定評価、会計士公文書をページで確認できます。",
    "실제 매각수익은 매각 시 발생하는 세금, 공과금, 회계사 수수료, 현지 인건비 등을 제한 금액입니다.": "実際の売却収益は、売却時に発生する税金、公課、会計士手数料、現地人件費などを控除した金額です。",
    "성명과 생년월일은 KYC 검증에 사용됩니다. 한 번 저장하면 변경할 수 없습니다.": "氏名と生年月日はKYC確認に使用されます。一度保存すると変更できません。",
    "입력한 정보와 신분증 정보가 다르면 출금이 제한될 수 있습니다.": "入力した情報と身分証情報が異なる場合、出金が制限されることがあります。",
    "형식: YYYY-MM-DD": "形式: YYYY-MM-DD",
    "실명 입력": "実名を入力",
    "관리자 승인을 받은 유저만 추천인 코드를 발급받아 추천 보상을 받을 수 있습니다.": "管理者承認を受けたユーザーのみ紹介コードを発行でき、紹介報酬を受け取れます。",
    "스테이킹 이자": "ステーキング利息",
    "내 추천 코드": "自分の紹介コード",
    "추천 현황": "紹介状況",
    "추천수:": "紹介人数:",
    "총 보너스:": "総ボーナス:",
    "아직 추천인으로 승인되지 않았습니다.": "まだ紹介人として承認されていません。",
    "관리자에게 추천인 신청을 문의하세요.": "管理者に紹介人申請についてお問い合わせください。",
    "지갑을 연결하면 추천인 상태를 확인할 수 있습니다.": "ウォレットを接続すると紹介人状態を確認できます。",
    "추천 내역": "紹介履歴",
    "내 추천인 상태": "自分の紹介人状態",
    "나의 추천인": "私の紹介人",
    "내가 추천한 유저": "私が紹介したユーザー",
    "보너스 내역": "ボーナス履歴",
    "유저": "ユーザー",
    "연결일": "連結日",
    "보너스(USDT)": "ボーナス（USDT）",
    "USDT 또는 보유한 부동산 자산 토큰을 출금할 수 있습니다. 실제 전송은 관리자가 처리합니다.": "USDTまたは保有している不動産資産トークンを出金できます。実際の送金は管理者が処理します。",
    "출금 주소는 현재 로그인한 지갑 주소로 자동 고정됩니다. 보안을 위해 다른 주소로 수정할 수 없습니다.": "出金先アドレスは現在ログイン中のウォレットアドレスに自動固定されます。安全のため他のアドレスへ変更できません。",
    "보안을 위해 로그인한 계정의 Solana 주소로만 출금할 수 있으며, 주소 수정은 허용되지 않습니다.": "安全のため、ログイン中アカウントのSolanaアドレスにのみ出金でき、アドレス変更は許可されません。",
    "선택한 자산 기준으로 출금 신청이 진행됩니다.": "選択した資産を基準に出金申請が進みます。",
    "출금 신청/내역 조회는 OTP(로그인 토큰 mfa=1) 상태에서만 가능합니다.": "出金申請/履歴照会はOTP認証済み（ログイントークン mfa=1）の場合のみ可能です。",
    "USDT 출금과 자산 토큰 출금 내역, 반려 사유를 확인할 수 있습니다.": "USDT出金と資産トークン出金履歴、差戻し理由を確認できます。",
    "출금 자산 아이콘": "出金資産アイコン",
    "로그인한 지갑주소가 자동으로 입력됩니다.": "ログイン中のウォレットアドレスが自動入力されます。",
    "출금 OTP 6자리": "出金OTP 6桁",
    "⚠ Devnet 환경": "⚠ Devnet環境",
    "Phantom 지갑 설정에서 네트워크를": "Phantomウォレット設定でネットワークを",
    "으로 변경해야 합니다.": "に変更する必要があります。",
    "Phantom → 설정(⚙) → 개발자 설정 → 테스트넷 모드 활성화 → Solana Devnet 선택": "Phantom → 設定（⚙）→ 開発者設定 → テストネットモード有効化 → Solana Devnet を選択",
    "USDT 또는 부동산 자산 토큰을 선택해서 입금할 수 있습니다.": "USDTまたは不動産資産トークンを選択して入金できます。",
    "최대 버튼은 현재 팬텀 지갑의 USDT 보유량 기준으로 입력됩니다.": "最大ボタンは現在のPhantomウォレットUSDT保有量を基準に入力されます。",
    "입금 반영/내역 조회는 OTP(로그인 토큰 mfa=1) 상태에서만 가능합니다.": "入金反映/履歴照会はOTP認証済み（ログイントークン mfa=1）の場合のみ可能です。",
    "입금/출금 내역이 표시됩니다. 자산 토큰 입금도 여기에서 확인할 수 있습니다.": "入出金履歴が表示されます。資産トークン入金もここで確認できます。",
    "전송을 처리하고 있습니다. 잠시만 기다려주세요.": "送信を処理しています。しばらくお待ちください。",
    "모집 확정 환율:": "募集確定為替:",
    "공시/평가:": "開示/評価:",
    "만료": "満了",
    "호가창의": "板の",
    "은 해당 주문 잔량 전체를 바로 거래하고,": "は該当注文の残量全体をすぐに取引し、",
    "은 주문 ID·가격·잔량을 우측에 채운 뒤 원하는 수량만 거래합니다.": "は注文ID・価格・残量を右側に入力した後、希望数量だけ取引します。",
    "매도": "売り",
    "매수": "買い",
    "매도 주문 등록 시 판매 수량이 체결 전까지 예치됩니다. 확인 팝업에서 거래수수료와 예상 실제 수령 USDT를 확인할 수 있습니다.": "売り注文登録時、販売数量は約定前まで預託されます。確認ポップアップで取引手数料と予想実受取USDTを確認できます。",
    "매도 주문 생성": "売り注文作成",
    "매수 주문 등록 시 USDT가 체결 전까지 예치됩니다. 확인 팝업에서 거래수수료와 실제 수령 토큰 수량을 확인할 수 있습니다.": "買い注文登録時、USDTは約定前まで預託されます。確認ポップアップで取引手数料と実受取トークン数量を確認できます。",
    "매수 주문 생성": "買い注文作成",
    "수수료와 실제 수령 자산을 확인한 뒤 진행하세요.": "手数料と実際に受け取る資産を確認してから進んでください。",
    "진행": "進行",
    "예: BLD001 또는 강남": "例: BLD001 または Gangnam",
    "호가 전환": "板切替",
    "주문 생성 전환": "注文作成切替",
    "매각 자산 교환이 가능합니다. 토큰 입금 후 토큰당 교환금액 기준으로 USDT를 수령합니다. (입금 즉시 토큰 영구 소각)": "売却資産の交換が可能です。トークンを入金すると、トークン当たり交換金額基準でUSDTを受け取れます。（入金と同時にトークンは永久焼却）",
    "목록": "一覧",
    "초기 투자금": "初期投資額",
    "매각금": "売却代金",
    "제비용": "諸費用",
    "플랫폼 유저 할당총액(USDT)": "プラットフォームユーザー割当総額（USDT）",
    "프로젝트 순유입:": "プロジェクト純流入:",
    "토큰당 교환금액": "トークン当たり交換金額",
    "· 환율(참고):": "・ 為替（参考）:",
    "플랫폼 유저 할당총액:": "プラットフォームユーザー割当総額:",
    "· 토큰발행량:": "・ トークン発行量:",
    "* 유저 정산은 플랫폼 유저 할당총액(USDT)의 총액 기준(지급완료 포함)입니다. 토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 기준으로 계산되며, 토큰은 입금 즉시 영구 소각됩니다.": "* ユーザー精算はプラットフォームユーザー割当総額（USDT）の総額基準（支払完了含む）です。トークン当たり交換金額は、プラットフォームユーザー割当総額 ÷ 総発行トークン数量を基準に計算され、トークンは入金と同時に永久焼却されます。",
    "토큰 교환": "トークン交換",
    "내 보유 수량": "自分の保有数量",
    "토큰 입금 수량(": "トークン入金数量（",
    "입금 즉시 토큰은 영구 소각되며, 입금 수량 × 토큰당 교환금액만큼 USDT가 지급됩니다.": "入金と同時にトークンは永久焼却され、入金数量 × トークン当たり交換金額に応じてUSDTが支給されます。",
    "USDT로 교환(토큰 소각)": "USDTへ交換（トークン焼却）",
    "예상 수령액": "予想受取額",
    "남은 교환 가능액:": "残り交換可能額:",
    "회계사 공문서": "会計士公文書",
    "등록된 문서가 없습니다.": "登録された文書がありません。",
    "수령 내역": "受取履歴",
    "입금(소각)": "入金（焼却）",
    "현지금액(참고)": "現地金額（参考）",
    "매각 자산 이미지": "売却資産画像",
    "토큰당 교환단가(현지통화)": "トークン当たり交換単価（現地通貨）",
    "플랫폼 유저 기준 수익률": "プラットフォームユーザー基準収益率",
    "내 교환 가능": "自分の交換可能額",
    "매각 자산 교환": "売却資産交換",
    "플랫폼 유저는 플랫폼 유저 할당총액을 기준으로 정산받습니다.": "プラットフォームユーザーはプラットフォームユーザー割当総額を基準に精算されます。",
    "토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 ÷ 매각 환율 기준으로 계산됩니다.": "トークン当たり交換金額は、プラットフォームユーザー割当総額 ÷ 総発行トークン数量 ÷ 売却為替レートで計算されます。",
    "스냅샷(지급일) 스테이킹 잔고": "スナップショット（支給日）ステーキング残高",
    "정산금액": "精算金額",
    "수령금액(USDT)": "受取金額（USDT）",
    "* 관리자가 이자를 배정하면 회차별로 누적되고, 사용자는 원하는 시점에 누적분을 한 번에 클레임합니다.": "* 管理者が利息を配分すると回次ごとに累積され、ユーザーは望む時点で累積分を一括受取できます。",
    "* 이자 산식: 모금 확정 환율 기준 투자원금 → 연이자율/12 → 지급일 환율로 USDT 환산, 최종 계정 반영 USDT는 소수 첫째 자리까지만 반영됩니다.": "* 利息算式: 募集確定為替基準の投資元本 → 年利率/12 → 支給日為替でUSDT換算、最終反映USDTは小数第1位までのみ反映されます。",
    "* 정산 기간에는 스테이킹/언스테이킹이 제한됩니다. 현재 설정 기준일은 상단 안내에 표시됩니다.": "* 精算期間中はステーキング/アンステーキングが制限されます。現在の設定基準日は上部案内に表示されます。",
    "언스테이킹": "アンステーキング",
    "기준": "基準",
    "물건 이미지": "物件画像",
    "누적이자": "累積利息",
    "미클레임": "未受取",
    "바로가기": "移動",
    "분배 대기/클레임 가능 자산": "配布待ち/受取可能資産",
    "보유 내역이 없습니다.": "保有履歴がありません。",
    "참여 내역이 없습니다.": "参加履歴がありません。",
    "계약 없음": "契約なし",
    "지갑을 연결하면 내 투자 자산이 표시됩니다.": "ウォレットを接続すると自分の投資資産が表示されます。",
    "투자(참여)한 자산이 없습니다.": "投資（参加）した資産がありません。",
    "분배 자산을 불러오지 못했습니다.": "配布資産を読み込めませんでした。",
    "보유 자산이 없습니다.": "保有資産がありません。",
    "내역이 없습니다.": "履歴がありません。",
    "표시할 자산이 없습니다.": "表示する資産がありません。",
    "모집완료 · 매입중": "募集完了 ・ 買付中",
    "모집완료 후 오프라인 매입 절차가 진행 중입니다.": "募集完了後、オフライン買付手続きが進行中です。",
    "운영 단계: 스테이킹 이자 및 P2P 거래가 가능합니다.": "運用段階: ステーキング利息とP2P取引が可能です。",
    "매각 정산 완료: 토큰 반환 후 차익을 수령합니다.": "売却精算完了: トークン返還後に差益を受け取ります。",
    "매입 취소 자산입니다. 환불/참여 내역을 확인하세요.": "買付取消資産です。返金/参加履歴を確認してください。",
    "최근 체결이 없습니다.": "最近の約定がありません。",
    "조건에 맞는 자산이 없습니다.": "条件に合う資産がありません。",
    "해당 자산 참여자만 토큰을 받을 수 있습니다.": "当該資産の参加者のみトークンを受け取れます。",
    "참여 내역이 있는 사용자만 확인할 수 있습니다.": "参加履歴があるユーザーのみ確認できます。",
    "분배 대기 또는 클레임 가능한 자산이 없습니다.": "配布待ちまたは受取可能な資産がありません。",
    "이미 내 클레임을 완료했습니다.": "すでに自分の受取を完了しました。",
    "지갑 연결 후 입금 내역을 확인할 수 있습니다.": "ウォレット接続後に入金履歴を確認できます。",
    "지갑을 연결하세요.": "ウォレットを接続してください。",
    "Select Asset 필요": "資産の選択が必要です",
    "자세히 보기": "詳しく見る"
  },
  "zh": {
    "소개 · RECON RWA": "介绍 · RECON RWA",
    "실물 부동산을 토큰으로": "将真实房地产代币化",
    "4단계로 진행되는 부동산 토큰 투자": "四个步骤完成的房地产代币投资",
    "부동산 매입을 위한 모금에 참여합니다. 목표가 달성되면 매입 단계로 넘어갑니다.": "参与用于收购房地产的募资。达到目标后将进入收购阶段。",
    "실물 부동산 매입 완료 후 토큰이 발행되고, 참여 비율에 맞춰 클레임으로 수령합니다.": "真实房地产收购完成后将发行代币，并按参与比例通过领取方式获得。",
    "P2P 거래로 유동성을 확보하고, 스테이킹으로 고정 이자 클레임에 참여합니다.": "通过P2P交易 确保流动性，并通过质押参与固定利息领取。",
    "매각이 완료되면 제비용을 제한 실수익을 정산하고, 토큰을 반환하면 차익을 수령합니다.": "出售完成后，将在扣除各项费用后结算实际收益，返还代币后即可领取差价收益。",
    "투명한 증빙과 수익 산정 기준": "透明的凭证与收益计算标准",
    "매수/매각 관련 서류(일부 마스킹), 감정평가, 회계사 공문서를 페이지에서 확인할 수 있습니다.": "可在页面查看买入/出售相关文件（部分已遮蔽）、评估报告和会计师公函。",
    "실제 매각수익은 매각 시 발생하는 세금, 공과금, 회계사 수수료, 현지 인건비 등을 제한 금액입니다.": "实际出售收益是扣除出售时产生的税费、公费、会计师费用和当地人工成本等后的金额。",
    "성명과 생년월일은 KYC 검증에 사용됩니다. 한 번 저장하면 변경할 수 없습니다.": "姓名和出生日期将用于KYC验证。保存后无法更改。",
    "입력한 정보와 신분증 정보가 다르면 출금이 제한될 수 있습니다.": "如果填写的信息与身份证件信息不一致，提现可能会受到限制。",
    "형식: YYYY-MM-DD": "格式: YYYY-MM-DD",
    "실명 입력": "输入实名",
    "관리자 승인을 받은 유저만 추천인 코드를 발급받아 추천 보상을 받을 수 있습니다.": "只有经管理员批准的用户才能领取推荐码并获得推荐奖励。",
    "스테이킹 이자": "质押利息",
    "내 추천 코드": "我的推荐码",
    "추천 현황": "推荐情况",
    "추천수:": "推荐人数:",
    "총 보너스:": "总奖励:",
    "아직 추천인으로 승인되지 않았습니다.": "你尚未被批准为推荐人。",
    "관리자에게 추천인 신청을 문의하세요.": "请联系管理员申请成为推荐人。",
    "지갑을 연결하면 추천인 상태를 확인할 수 있습니다.": "连接钱包后即可查看推荐人状态。",
    "추천 내역": "推荐记录",
    "내 추천인 상태": "我的推荐人状态",
    "나의 추천인": "我的推荐人",
    "내가 추천한 유저": "我推荐的用户",
    "보너스 내역": "奖励记录",
    "유저": "用户",
    "연결일": "关联日期",
    "보너스(USDT)": "奖励（USDT）",
    "USDT 또는 보유한 부동산 자산 토큰을 출금할 수 있습니다. 실제 전송은 관리자가 처리합니다.": "你可以提现USDT或持有的房地产资产代币。实际转账由管理员处理。",
    "출금 주소는 현재 로그인한 지갑 주소로 자동 고정됩니다. 보안을 위해 다른 주소로 수정할 수 없습니다.": "提现地址会自动固定为当前登录的钱包地址。出于安全考虑，不能修改为其他地址。",
    "보안을 위해 로그인한 계정의 Solana 주소로만 출금할 수 있으며, 주소 수정은 허용되지 않습니다.": "出于安全考虑，只能提现到当前登录账户的Solana地址，不允许修改地址。",
    "선택한 자산 기준으로 출금 신청이 진행됩니다.": "提现申请将按照所选资产进行。",
    "출금 신청/내역 조회는 OTP(로그인 토큰 mfa=1) 상태에서만 가능합니다.": "仅在OTP已验证（登录令牌 mfa=1）状态下，才能提交提现申请或查看记录。",
    "USDT 출금과 자산 토큰 출금 내역, 반려 사유를 확인할 수 있습니다.": "可以查看USDT提现、资产代币提现记录以及驳回原因。",
    "출금 자산 아이콘": "提现资产图标",
    "로그인한 지갑주소가 자동으로 입력됩니다.": "登录的钱包地址会自动填入。",
    "출금 OTP 6자리": "6位提现OTP",
    "⚠ Devnet 환경": "⚠ Devnet环境",
    "Phantom 지갑 설정에서 네트워크를": "请在Phantom钱包设置中将网络切换为",
    "으로 변경해야 합니다.": "。",
    "Phantom → 설정(⚙) → 개발자 설정 → 테스트넷 모드 활성화 → Solana Devnet 선택": "Phantom → 设置（⚙）→ 开发者设置 → 启用测试网模式 → 选择 Solana Devnet",
    "USDT 또는 부동산 자산 토큰을 선택해서 입금할 수 있습니다.": "你可以选择USDT或房地产资产代币进行充值。",
    "최대 버튼은 현재 팬텀 지갑의 USDT 보유량 기준으로 입력됩니다.": "最大按钮会按当前Phantom钱包中的USDT余额填入。",
    "입금 반영/내역 조회는 OTP(로그인 토큰 mfa=1) 상태에서만 가능합니다.": "仅在OTP已验证（登录令牌 mfa=1）状态下，才能进行充值入账或查看记录。",
    "입금/출금 내역이 표시됩니다. 자산 토큰 입금도 여기에서 확인할 수 있습니다.": "这里会显示充值/提现记录，也可以在这里查看资产代币充值。",
    "전송을 처리하고 있습니다. 잠시만 기다려주세요.": "正在处理转账，请稍候。",
    "모집 확정 환율:": "募资锁定汇率:",
    "공시/평가:": "披露/评估:",
    "만료": "到期",
    "호가창의": "盘口中的",
    "은 해당 주문 잔량 전체를 바로 거래하고,": "会立即交易该订单的全部剩余数量，",
    "은 주문 ID·가격·잔량을 우측에 채운 뒤 원하는 수량만 거래합니다.": "会在右侧填入订单ID、价格和剩余数量后，只交易你想要的数量。",
    "매도": "卖出",
    "매수": "买入",
    "매도 주문 등록 시 판매 수량이 체결 전까지 예치됩니다. 확인 팝업에서 거래수수료와 예상 실제 수령 USDT를 확인할 수 있습니다.": "提交卖单时，卖出数量将在成交前被冻结。你可以在确认弹窗中查看交易手续费和预计实际收到的USDT。",
    "매도 주문 생성": "创建卖单",
    "매수 주문 등록 시 USDT가 체결 전까지 예치됩니다. 확인 팝업에서 거래수수료와 실제 수령 토큰 수량을 확인할 수 있습니다.": "提交买单时，USDT将在成交前被冻结。你可以在确认弹窗中查看交易手续费和实际收到的代币数量。",
    "매수 주문 생성": "创建买单",
    "수수료와 실제 수령 자산을 확인한 뒤 진행하세요.": "请先确认手续费和实际收到的资产后再继续。",
    "진행": "继续",
    "예: BLD001 또는 강남": "例如：BLD001 或 Gangnam",
    "호가 전환": "切换盘口",
    "주문 생성 전환": "切换下单表单",
    "매각 자산 교환이 가능합니다. 토큰 입금 후 토큰당 교환금액 기준으로 USDT를 수령합니다. (입금 즉시 토큰 영구 소각)": "可进行出售资产兑换。存入代币后，将按每枚代币兑换金额领取USDT。（存入后代币会立即被永久销毁）",
    "목록": "列表",
    "초기 투자금": "初始投资金额",
    "매각금": "出售金额",
    "제비용": "各项费用",
    "플랫폼 유저 할당총액(USDT)": "平台用户分配总额（USDT）",
    "프로젝트 순유입:": "项目净流入:",
    "토큰당 교환금액": "每枚代币兑换金额",
    "· 환율(참고):": "· 汇率（参考）:",
    "플랫폼 유저 할당총액:": "平台用户分配总额:",
    "· 토큰발행량:": "· 代币发行量:",
    "* 유저 정산은 플랫폼 유저 할당총액(USDT)의 총액 기준(지급완료 포함)입니다. 토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 기준으로 계산되며, 토큰은 입금 즉시 영구 소각됩니다.": "* 用户结算以平台用户分配总额（USDT）为基准（含已支付部分）。每枚代币兑换金额按平台用户分配总额 ÷ 总发行代币数量计算，代币存入后会立即被永久销毁。",
    "토큰 교환": "代币兑换",
    "내 보유 수량": "我的持有数量",
    "토큰 입금 수량(": "代币存入数量（",
    "입금 즉시 토큰은 영구 소각되며, 입금 수량 × 토큰당 교환금액만큼 USDT가 지급됩니다.": "代币在存入后会立即被永久销毁，并按存入数量 × 每枚代币兑换金额支付USDT。",
    "USDT로 교환(토큰 소각)": "兑换为USDT（销毁代币）",
    "예상 수령액": "预计收款金额",
    "남은 교환 가능액:": "剩余可兑换金额:",
    "회계사 공문서": "会计师公函",
    "등록된 문서가 없습니다.": "没有已登记的文件。",
    "수령 내역": "领取记录",
    "입금(소각)": "存入（销毁）",
    "현지금액(참고)": "当地金额（参考）",
    "매각 자산 이미지": "出售资产图片",
    "토큰당 교환단가(현지통화)": "每枚代币兑换单价（当地货币）",
    "플랫폼 유저 기준 수익률": "平台用户基准收益率",
    "내 교환 가능": "我的可兑换数量",
    "매각 자산 교환": "出售资产兑换",
    "플랫폼 유저는 플랫폼 유저 할당총액을 기준으로 정산받습니다.": "平台用户按平台用户分配总额作为结算基准。",
    "토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 ÷ 매각 환율 기준으로 계산됩니다.": "每枚代币兑换金额按平台用户分配总额 ÷ 总发行代币数量 ÷ 出售汇率计算。",
    "스냅샷(지급일) 스테이킹 잔고": "快照（发放日）质押余额",
    "정산금액": "结算金额",
    "수령금액(USDT)": "收款金额（USDT）",
    "* 관리자가 이자를 배정하면 회차별로 누적되고, 사용자는 원하는 시점에 누적분을 한 번에 클레임합니다.": "* 管理员分配利息后，会按期次累计，用户可以在任意时间一次性领取累计金额。",
    "* 이자 산식: 모금 확정 환율 기준 투자원금 → 연이자율/12 → 지급일 환율로 USDT 환산, 최종 계정 반영 USDT는 소수 첫째 자리까지만 반영됩니다.": "* 利息公式：按募资锁定汇率确定投资本金 → 年利率/12 → 按发放日汇率换算为USDT，最终入账USDT仅保留到小数点后一位。",
    "* 정산 기간에는 스테이킹/언스테이킹이 제한됩니다. 현재 설정 기준일은 상단 안내에 표시됩니다.": "* 在结算期间，质押/解除质押会受到限制。当前设置的参考日期显示在上方说明中。",
    "언스테이킹": "解除质押",
    "기준": "基准",
    "물건 이미지": "物件图片",
    "누적이자": "累计利息",
    "미클레임": "未领取",
    "바로가기": "前往",
    "분배 대기/클레임 가능 자산": "待分配/可领取资产",
    "보유 내역이 없습니다.": "没有持有记录。",
    "참여 내역이 없습니다.": "没有参与记录。",
    "계약 없음": "没有合同",
    "지갑을 연결하면 내 투자 자산이 표시됩니다.": "连接钱包后将显示你的投资资产。",
    "투자(참여)한 자산이 없습니다.": "没有你参与投资的资产。",
    "분배 자산을 불러오지 못했습니다.": "无法加载可分配资产。",
    "보유 자산이 없습니다.": "没有持有资产。",
    "내역이 없습니다.": "没有记录。",
    "표시할 자산이 없습니다.": "没有可显示的资产。",
    "모집완료 · 매입중": "募资完成 · 收购中",
    "모집완료 후 오프라인 매입 절차가 진행 중입니다.": "募资完成后，线下收购流程正在进行中。",
    "운영 단계: 스테이킹 이자 및 P2P 거래가 가능합니다.": "运营阶段：可进行质押利息和P2P交易。",
    "매각 정산 완료: 토큰 반환 후 차익을 수령합니다.": "出售结算完成：返还代币后领取差价收益。",
    "매입 취소 자산입니다. 환불/참여 내역을 확인하세요.": "该资产的收购已取消。请查看退款/参与记录。",
    "최근 체결이 없습니다.": "暂无最近成交。",
    "조건에 맞는 자산이 없습니다.": "没有符合条件的资产。",
    "해당 자산 참여자만 토큰을 받을 수 있습니다.": "只有参与该资产的用户才能领取代币。",
    "참여 내역이 있는 사용자만 확인할 수 있습니다.": "只有有参与记录的用户才能查看。",
    "분배 대기 또는 클레임 가능한 자산이 없습니다.": "没有待分配或可领取的资产。",
    "이미 내 클레임을 완료했습니다.": "我已完成领取。",
    "지갑 연결 후 입금 내역을 확인할 수 있습니다.": "连接钱包后即可查看充值记录。",
    "지갑을 연결하세요.": "请连接钱包。",
    "Select Asset 필요": "需要选择资产",
    "자세히 보기": "查看详情"
  }
};

  const EXTRA_PARTS_V6 = {
  "en": {
    "추천인 프로그램": "Referral Program",
    "추천인": "Referral",
    "추천": "Referral",
    "추천수:": "Referrals:",
    "총 보너스:": "Total Bonus:",
    "내 추천 코드": "My Referral Code",
    "추천 현황": "Referral Status",
    "내역이 없습니다.": "There is no history.",
    "보유 내역이 없습니다.": "There are no holdings.",
    "참여 내역이 없습니다.": "There is no participation history.",
    "계약 없음": "No Contracts",
    "누적이자": "Accumulated Interest",
    "미클레임": "Unclaimed",
    "바로가기": "Go",
    "거래내역": "Transaction History",
    "처리중": "Processing",
    "수수료": "Fee",
    "비고": "Notes",
    "목록": "List",
    "예상": "Estimated",
    "만료": "Expiry",
    "지갑을 연결하세요.": "Connect your wallet.",
    "지갑을 연결하면 추천인 상태를 확인할 수 있습니다.": "Connect your wallet to check your referrer status."
  },
  "ja": {
    "추천인 프로그램": "紹介プログラム",
    "추천인": "紹介人",
    "추천": "紹介",
    "추천수:": "紹介人数:",
    "총 보너스:": "総ボーナス:",
    "내 추천 코드": "自分の紹介コード",
    "추천 현황": "紹介状況",
    "내역이 없습니다.": "履歴がありません。",
    "보유 내역이 없습니다.": "保有履歴がありません。",
    "참여 내역이 없습니다.": "参加履歴がありません。",
    "계약 없음": "契約なし",
    "누적이자": "累積利息",
    "미클레임": "未受取",
    "바로가기": "移動",
    "거래내역": "取引履歴",
    "처리중": "処理中",
    "수수료": "手数料",
    "비고": "備考",
    "목록": "一覧",
    "예상": "予想",
    "만료": "満了",
    "지갑을 연결하세요.": "ウォレットを接続してください。",
    "지갑을 연결하면 추천인 상태를 확인할 수 있습니다.": "ウォレットを接続すると紹介人状態を確認できます。"
  },
  "zh": {
    "추천인 프로그램": "推荐计划",
    "추천인": "推荐人",
    "추천": "推荐",
    "추천수:": "推荐人数:",
    "총 보너스:": "总奖励:",
    "내 추천 코드": "我的推荐码",
    "추천 현황": "推荐情况",
    "내역이 없습니다.": "没有记录。",
    "보유 내역이 없습니다.": "没有持有记录。",
    "참여 내역이 없습니다.": "没有参与记录。",
    "계약 없음": "没有合同",
    "누적이자": "累计利息",
    "미클레임": "未领取",
    "바로가기": "前往",
    "거래내역": "交易记录",
    "처리중": "处理中",
    "수수료": "手续费",
    "비고": "备注",
    "목록": "列表",
    "예상": "预计",
    "만료": "到期",
    "지갑을 연결하세요.": "请连接钱包。",
    "지갑을 연결하면 추천인 상태를 확인할 수 있습니다.": "连接钱包后即可查看推荐人状态。"
  }
};

  mergeLangMap(EXACT, EXTRA_EXACT_V6);
  mergeLangMap(PARTS, EXTRA_PARTS_V6);


  const EXTRA_EXACT_V6B = {
    en: {
      "자산별 정산 기준 안내": "Asset-by-asset Settlement Guide",
      "정산 기준과 지급 방식은 자산별 관리자 설정에 따라 다릅니다. 정산통화가 USDT인 자산은 USDT 기준으로 처리되며, 그 외 자산은 정산통화 기준 금액을 환율에 따라 USDT로 환산해 지급할 수 있습니다.": "Settlement rules and payout methods vary according to the administrator settings for each asset. Assets whose settlement currency is USDT are processed on a USDT basis, while other assets may be paid in USDT by converting the settlement-currency amount using the applicable exchange rate.",
      "예시 기준 환율(KRW): 1 USDT = 1,488 KRW": "Illustrative FX (KRW): 1 USDT = 1,488 KRW",
      "KYC 기본 정보": "KYC Basic Info"
    },


  };
  mergeLangMap(EXACT, EXTRA_EXACT_V6B);


  const EXTRA_EXACT_V6C = {
    en: {
      "입금 금액을 입력하세요.": "Enter a deposit amount.",
      "지갑 연결을 해제했습니다.": "Wallet disconnected.",
      "지갑 연결을 해제했습니다. 지갑을 연결해주세요.": "Wallet disconnected. Please connect your wallet.",
      "월렛을 해제했습니다. 지갑을 연결해주세요.": "Wallet disconnected. Please connect your wallet.",
      "USDT 출금 신청": "USDT Withdrawal Request",
      "갱신": "Refresh",
      "갱신 완료": "Refresh complete",
      "입금(USDT)": "Deposit (USDT)"
    },


  };
  mergeLangMap(EXACT, EXTRA_EXACT_V6C);


  const EXTRA_EXACT_V20 = {
  "en": {
    "홈 · RECON RWA": "Home · RECON RWA",
    "소개 · RECON RWA": "About · RECON RWA",
    "자산 · RECON RWA": "Assets · RECON RWA",
    "자산 상세 · RECON RWA": "Asset Details · RECON RWA",
    "차트 · RECON RWA": "Chart · RECON RWA",
    "클레임 · RECON RWA": "Claim · RECON RWA",
    "입금 · RECON RWA": "Deposit · RECON RWA",
    "출금 · RECON RWA": "Withdrawal · RECON RWA",
    "모금 참여 · RECON RWA": "Funding · RECON RWA",
    "포트폴리오 · RECON RWA": "Portfolio · RECON RWA",
    "추천인 · RECON RWA": "Referral · RECON RWA",
    "매각 상세 · RECON RWA": "Sale Details · RECON RWA",
    "매각 · RECON RWA": "Sales · RECON RWA",
    "스테이킹 · RECON RWA": "Staking · RECON RWA",
    "KYC 인증 · RECON RWA": "KYC Verification · RECON RWA",
    "KYC 기본 정보 · RECON RWA": "KYC Basic Info · RECON RWA",
    "KYC 복귀 · RECON RWA": "KYC Return · RECON RWA",
    "이용 및 투자약관 · RECON RWA": "Terms of Use & Investment · RECON RWA",
    "실물 부동산을 토큰으로": "Tokenizing Real Estate",
    "4단계로 진행되는 부동산 토큰 투자": "A four-step real-estate token investment flow",
    "부동산 매입을 위한 모금에 참여합니다. 목표가 달성되면 매입 단계로 넘어갑니다.": "Participate in funding for real-estate acquisition. When the target is reached, the asset moves to the acquisition stage.",
    "실물 부동산 매입 완료 후 토큰이 발행되고, 참여 비율에 맞춰 클레임으로 수령합니다.": "After the real estate is acquired, tokens are issued and claimed according to your participation ratio.",
    "P2P 거래로 유동성을 확보하고, 스테이킹으로 고정 이자 클레임에 참여합니다.": "Secure liquidity through P2P trading and participate in fixed-interest claims through staking.",
    "매각이 완료되면 제비용을 제한 실수익을 정산하고, 토큰을 반환하면 차익을 수령합니다.": "When the sale is completed, net proceeds are settled after expenses, and profit is received when tokens are returned.",
    "투명한 증빙과 수익 산정 기준": "Transparent evidence and profit-calculation standards",
    "매수/매각 관련 서류(일부 마스킹), 감정평가, 회계사 공문서를 페이지에서 확인할 수 있습니다.": "You can review purchase/sale documents (partially masked), appraisal reports, and accountant-issued documents on the page.",
    "실제 매각수익은 매각 시 발생하는 세금, 공과금, 회계사 수수료, 현지 인건비 등을 제한 금액입니다.": "Actual sale proceeds are the amount remaining after taxes, public charges, accountant fees, local labor costs, and other sale-related expenses.",
    "고정 이자": "Fixed Interest",
    "이미지 로딩 중...": "Loading image...",
    "핵심 정보": "Key Information",
    "지도": "Map",
    "위치:": "Location:",
    "개요": "Overview",
    "증빙문서": "Supporting Documents",
    "증빙문서 안내": "Supporting Documents Notice",
    "등기부등본, 자산평가서, 회계자료, 공식문서 등은 개인정보 보호를 위해 일부 마스킹될 수 있습니다.": "Registry copies, asset valuation reports, accounting materials, and official documents may be partially masked to protect personal information.",
    "최근 체결가:": "Recent Trade Price:",
    "부동산 종류": "Real Estate Type",
    "공시/평가(정산통화)": "Disclosure / Valuation (Settlement Currency)",
    "예상 매수가(정산통화)": "Estimated Purchase Price (Settlement Currency)",
    "* 표기 금액은 이해를 돕기 위한 예시이며, 실제 계약/정산 금액과 다를 수 있습니다.": "* The displayed amounts are illustrative and may differ from the actual contract or settlement amounts.",
    "목표 달성 후 매입 단계로 전환됩니다.": "The asset moves to the acquisition stage after the target is reached.",
    "참여 전에 전자계약서를 먼저 작성하고 자필서명을 완료해야 합니다.": "Before participating, you must first complete the electronic contract and handwritten signature.",
    "※ 전자계약서 작성 후 최종 참여(참여하기 버튼)를 완료하지 않으면": "※ If you do not complete the final participation step (the Participate button) after drafting the electronic contract,",
    "전자계약서 서명 후, 참여 직전에 OTP를 다시 입력해야 합니다.": "After signing the electronic contract, you must re-enter OTP right before participation.",
    "모금에 참여하려면 먼저 USDT를 예치해야 합니다.": "You must deposit USDT before participating in funding.",
    "USDT 예치하러 가기 →": "Go deposit USDT →",
    "* 참여 내역은 토큰 분배 비율에 반영됩니다.": "* Your participation history is reflected in the token-distribution ratio.",
    "상품에 따라 투자금은 USDT로 직접 투자되거나,": "Depending on the product, the investment may be made directly in USDT,",
    "해당 국가의 통화로 환산되어 투자됩니다.": "or converted into the local currency of the relevant country before investment.",
    "투자금은 모금 종료 시점의 환율을 기준으로 적용됩니다.": "The investment amount is applied based on the exchange rate at the close of funding.",
    "이자와 매각차익은 상품 기준 통화로 계산한 뒤,": "Interest and sale profits are calculated in the product’s base currency and then",
    "환율과 발행량은 모금 완료 시점에 최종 확정됩니다.": "The exchange rate and issuance quantity are finalized when funding is completed.",
    "* 마우스 또는 터치로 직접 서명하세요.": "* Please sign directly with your mouse or touch input.",
    "관리자가 자산 상세페이지에서 최종 자필서명을 완료하면 계약이 마무리됩니다.": "The contract is finalized when the administrator completes the final handwritten signature on the asset-detail page.",
    "1) 계약 내용 검토": "1) Review contract details",
    "2) 자필 전자서명 완료": "2) Complete handwritten electronic signature",
    "3) 모금 참여 시 OTP 재검증": "3) Re-verify OTP when participating in funding",
    "4) 관리자 자필서명 대기": "4) Await administrator handwritten signature",
    "서명 완료": "Signature Complete",
    "계약 제출 및 체결 내역": "Submitted and Executed Contracts",
    "이 상품에 대해 제출하거나 체결한 계약 이력을 모두 확인할 수 있습니다.": "You can review all submitted or executed contract records for this product.",
    "계약을 선택하면 상세 내용을 열람할 수 있습니다.": "Select a contract to view its details.",
    "새 탭에서 열기": "Open in New Tab",
    "기본 정보를 확인한 뒤 신분증 인증을 진행합니다.": "Review the basic information and then proceed with ID verification.",
    "KYC 인증이 완료되었습니다.": "KYC verification has been completed.",
    "KYC 인증이 완료되었습니다": "KYC verification has been completed.",
    "다음 화면에서 신분증 촬영 또는 업로드가 진행됩니다.": "On the next screen, you will capture or upload your ID.",
    "신분증 이미지는 Didit을 통해 본인 확인 목적으로만 사용됩니다.": "ID images are used through Didit only for identity verification purposes.",
    "처리중입니다.": "Processing.",
    "인증 결과를 확인하는 중입니다. 잠시 후 자동으로 KYC 인증 페이지로 돌아갑니다.": "Checking the verification result. You will automatically return to the KYC verification page shortly.",
    "거래 페이지로 이동 중…": "Moving to the trading page…",
    "페이지가 자동으로 이동하지 않으면 아래 버튼을 눌러주세요.": "If the page does not move automatically, please press the button below.",
    "지갑을 연결하면 내 자산, 클레임, 매각 정산을 확인할 수 있습니다.": "Connect your wallet to check your assets, claims, and sale settlements.",
    "자산 목록과 동일한 기준으로 상위 3개 자산을 표시합니다.": "The top three assets are shown using the same criteria as the asset list.",
    "최근 거래 기준으로 표시됩니다.": "Displayed based on recent trades.",
    "체결가": "Trade Price",
    "매각 완료된 자산의 교환 기준과 수령 내역을 확인합니다.": "Check the exchange basis and receipt history for sold assets.",
    "세부 계산 방식 보기": "View detailed calculation method",
    "스냅샷(지급일) 스테이킹 잔고": "Snapshot (Payout Date) Staking Balance",
    "정산금액": "Settlement Amount",
    "수령금액(USDT)": "Received Amount (USDT)",
    "매월 15일 스테이킹 잔고 기준으로 이자가 계산되며, 정산통화 계산 중 절삭 없이 계산한 뒤 최종 USDT 소수 첫째 자리까지 계정에 반영됩니다.": "Interest is calculated each month on the 15th based on your staking balance. The settlement-currency amount is calculated without truncation, and only the final USDT credited to your account is rounded down to the first decimal place.",
    "정산 기간(14~16일)에는 스테이킹/언스테이킹이 제한되며, 17일부터 다시 가능합니다.": "Staking and unstaking are restricted during the settlement period (14th–16th) and become available again from the 17th.",
    "자산이 매각 상태가 되면 신규 스테이킹과 당월 이자 배정이 중단되며, 이전 미클레임 이자와 언스테이킹만 가능합니다.": "When an asset enters sale status, new staking and current-month interest allocation stop, and only previous unclaimed interest and unstaking remain available.",
    "* 토큰을 받은 후 스테이킹풀에 예치하여 이자권리를 유지하세요.": "* After receiving tokens, deposit them into the staking pool to maintain your interest rights.",
    "분배 대기/클레임 가능 자산": "Awaiting Distribution / Claimable Assets",
    "분배 대기 또는 클레임 가능한 자산이 없습니다.": "There are no assets awaiting distribution or available for claim.",
    "서명자": "Signer",
    "내역이 없습니다.": "No records found.",
    "로그인 후 확인": "Check after login",
    "이용 및 투자약관": "Terms of Use and Investment",
    "성명과 생년월일은 KYC 검증에 사용됩니다. 한 번 저장하면 변경할 수 없습니다.": "Your name and date of birth are used for KYC verification. Once saved, they cannot be changed."
  },
  "ja": {
    "홈 · RECON RWA": "ホーム · RECON RWA",
    "소개 · RECON RWA": "紹介 · RECON RWA",
    "자산 · RECON RWA": "資産 · RECON RWA",
    "자산 상세 · RECON RWA": "資産詳細 · RECON RWA",
    "차트 · RECON RWA": "チャート · RECON RWA",
    "클레임 · RECON RWA": "受取 · RECON RWA",
    "입금 · RECON RWA": "入金 · RECON RWA",
    "출금 · RECON RWA": "出金 · RECON RWA",
    "모금 참여 · RECON RWA": "募集参加 · RECON RWA",
    "포트폴리오 · RECON RWA": "ポートフォリオ · RECON RWA",
    "추천인 · RECON RWA": "紹介 · RECON RWA",
    "매각 상세 · RECON RWA": "売却詳細 · RECON RWA",
    "매각 · RECON RWA": "売却 · RECON RWA",
  "매각일": "売却日",
    "스테이킹 · RECON RWA": "ステーキング · RECON RWA",
    "KYC 인증 · RECON RWA": "KYC認証 · RECON RWA",
    "KYC 기본 정보 · RECON RWA": "KYC基本情報 · RECON RWA",
    "KYC 복귀 · RECON RWA": "KYC復帰 · RECON RWA",
    "부동산 조각 투자 STO": "不動産小口投資 STO",
    "고정 이자": "固定利息",
    "이미지 로딩 중...": "画像を読み込み中...",
    "핵심 정보": "主要情報",
    "지도": "地図",
    "위치:": "所在地:",
    "개요": "概要",
    "증빙문서": "証憑書類",
    "증빙문서 안내": "証憑書類の案内",
    "최근 체결가:": "最近の約定価格:",
    "부동산 종류": "不動産種別",
    "공시/평가(정산통화)": "公示/評価（精算通貨）",
    "예상 매수가(정산통화)": "予想買付価格（精算通貨）",
    "자산 보기": "資産を見る",
    "투자 프로세스": "投資プロセス",
    "토큰 분배": "トークン配布",
    "매각 정산": "売却精算",
    "신뢰를 위한 공개": "信頼のための公開",
    "증빙/정산 문서": "証憑/精算書類",
    "토큰 클레임": "トークン受取",
    "스테이킹/이자": "ステーキング / 利息",
    "매각(차익)": "売却（差益）",
    "기본 정보를 확인한 뒤 신분증 인증을 진행합니다.": "基本情報を確認した後、本人確認書類の認証を進めます。",
    "KYC 인증이 완료되었습니다.": "KYC認証が完了しました。",
    "KYC 인증이 완료되었습니다": "KYC認証が完了しました。",
    "다음 화면에서 신분증 촬영 또는 업로드가 진행됩니다.": "次の画面で本人確認書類の撮影またはアップロードを行います。",
    "신분증 이미지는 Didit을 통해 본인 확인 목적으로만 사용됩니다.": "本人確認書類の画像は、Diditを通じて本人確認目的のみに使用されます。",
    "처리중입니다.": "処理中です。",
    "인증 결과를 확인하는 중입니다. 잠시 후 자동으로 KYC 인증 페이지로 돌아갑니다.": "認証結果を確認中です。しばらくすると自動的にKYC認証ページへ戻ります。",
    "거래 페이지로 이동 중…": "取引ページへ移動中…",
    "페이지가 자동으로 이동하지 않으면 아래 버튼을 눌러주세요.": "ページが自動で移動しない場合は、下のボタンを押してください。",
    "세부 계산 방식 보기": "詳細な計算方法を見る",
    "스냅샷(지급일) 스테이킹 잔고": "スナップショット（支給日）ステーキング残高",
    "정산금액": "精算金額",
    "수령금액(USDT)": "受取金額（USDT）",
    "분배 대기/클레임 가능 자산": "配布待ち / 受取可能資産",
    "분배 대기 또는 클레임 가능한 자산이 없습니다.": "配布待ちまたは受取可能な資産はありません。",
    "서명자": "署名者",
    "내역이 없습니다.": "履歴がありません。",
    "로그인 후 확인": "ログイン後に確認",
    "Staking Rules Summary": "ステーキングルール要約",
    "Detailed calculation method": "詳細な計算方法",
    "Settlement Guide": "精算ガイド",
    "Reward Rules": "報酬ルール",
    "Claim Interest": "利息受取",
    "Claim History": "受取履歴",
    "Unclaimed Interest": "未受取利息",
    "Holdings": "保有資産",
    "My USDT": "保有USDT",
    "My Total Tokens": "保有トークン合計",
    "My Available Tokens": "出金可能トークン",
    "Month / Round": "月 / 回次",
    "Settlement Amount": "精算金額",
    "Received Amount (USDT)": "受取金額（USDT）",
    "Status / Time": "状態 / 時刻"
  },
  "zh": {
    "홈 · RECON RWA": "首页 · RECON RWA",
    "소개 · RECON RWA": "介绍 · RECON RWA",
    "자산 · RECON RWA": "资产 · RECON RWA",
    "자산 상세 · RECON RWA": "资产详情 · RECON RWA",
    "차트 · RECON RWA": "图表 · RECON RWA",
    "클레임 · RECON RWA": "领取 · RECON RWA",
    "입금 · RECON RWA": "充值 · RECON RWA",
    "출금 · RECON RWA": "提现 · RECON RWA",
    "모금 참여 · RECON RWA": "募资参与 · RECON RWA",
    "포트폴리오 · RECON RWA": "投资组合 · RECON RWA",
    "추천인 · RECON RWA": "推荐 · RECON RWA",
    "매각 상세 · RECON RWA": "出售详情 · RECON RWA",
    "매각 · RECON RWA": "出售 · RECON RWA",
  "매각일": "出售日期",
    "스테이킹 · RECON RWA": "质押 · RECON RWA",
    "KYC 인증 · RECON RWA": "KYC认证 · RECON RWA",
    "KYC 기본 정보 · RECON RWA": "KYC基本信息 · RECON RWA",
    "KYC 복귀 · RECON RWA": "KYC返回 · RECON RWA",
    "부동산 조각 투자 STO": "房地产碎片化投资 STO",
    "고정 이자": "固定利息",
    "이미지 로딩 중...": "正在加载图片...",
    "핵심 정보": "关键信息",
    "지도": "地图",
    "위치:": "位置:",
    "개요": "概览",
    "증빙문서": "证明文件",
    "증빙문서 안내": "证明文件说明",
    "최근 체결가:": "最近成交价:",
    "부동산 종류": "房地产类型",
    "공시/평가(정산통화)": "披露/估值（结算货币）",
    "예상 매수가(정산통화)": "预计买入价（结算货币）",
    "자산 보기": "查看资产",
    "투자 프로세스": "投资流程",
    "토큰 분배": "代币分配",
    "매각 정산": "出售结算",
    "신뢰를 위한 공개": "为信任而公开",
    "증빙/정산 문서": "证明/结算文件",
    "토큰 클레임": "代币领取",
    "스테이킹/이자": "质押 / 利息",
    "매각(차익)": "出售（差价收益）",
    "기본 정보를 확인한 뒤 신분증 인증을 진행합니다.": "确认基本信息后，继续进行身份证件认证。",
    "KYC 인증이 완료되었습니다.": "KYC认证已完成。",
    "KYC 인증이 완료되었습니다": "KYC认证已完成。",
    "다음 화면에서 신분증 촬영 또는 업로드가 진행됩니다.": "在下一页面中，将进行证件拍摄或上传。",
    "신분증 이미지는 Didit을 통해 본인 확인 목적으로만 사용됩니다.": "证件图片仅通过 Didit 用于身份验证。",
    "처리중입니다.": "正在处理中。",
    "인증 결과를 확인하는 중입니다. 잠시 후 자동으로 KYC 인증 페이지로 돌아갑니다.": "正在确认认证结果。稍后将自动返回 KYC 认证页面。",
    "거래 페이지로 이동 중…": "正在前往交易页面…",
    "페이지가 자동으로 이동하지 않으면 아래 버튼을 눌러주세요.": "如果页面未自动跳转，请点击下方按钮。",
    "세부 계산 방식 보기": "查看详细计算方法",
    "스냅샷(지급일) 스테이킹 잔고": "快照（发放日）质押余额",
    "정산금액": "结算金额",
    "수령금액(USDT)": "收取金额（USDT）",
    "분배 대기/클레임 가능 자산": "待分配 / 可领取资产",
    "분배 대기 또는 클레임 가능한 자산이 없습니다.": "没有待分配或可领取的资产。",
    "서명자": "签署人",
    "내역이 없습니다.": "没有记录。",
    "로그인 후 확인": "登录后查看",
    "Staking Rules Summary": "质押规则摘要",
    "Detailed calculation method": "详细计算方法",
    "Settlement Guide": "结算指南",
    "Reward Rules": "奖励规则",
    "Claim Interest": "领取利息",
    "Claim History": "领取记录",
    "Unclaimed Interest": "未领取利息",
    "Holdings": "持仓",
    "My USDT": "我的 USDT",
    "My Total Tokens": "我的总代币数量",
    "My Available Tokens": "我的可用代币",
    "Month / Round": "月份 / 回次",
    "Settlement Amount": "结算金额",
    "Received Amount (USDT)": "收取金额（USDT）",
    "Status / Time": "状态 / 时间"
  }
};
  const EXTRA_PARTS_V20 = {
  "en": {
    "핵심 정보": "Key Information",
    "지도": "Map",
    "개요": "Overview",
    "증빙문서": "Supporting Documents",
    "증빙문서 안내": "Supporting Documents Notice",
    "자산 보기": "View Assets",
    "투자 프로세스": "Investment Process",
    "토큰 분배": "Token Distribution",
    "매각 정산": "Sale Settlement",
    "신뢰를 위한 공개": "Transparency for Trust",
    "증빙/정산 문서": "Documents / Settlement Records",
    "최근 체결가": "Recent Trade Price",
    "고정 이자": "Fixed Interest",
    "서명자": "Signer",
    "세부 계산 방식 보기": "View detailed calculation method",
    "스냅샷(지급일) 스테이킹 잔고": "Snapshot (Payout Date) Staking Balance",
    "정산금액": "Settlement Amount",
    "수령금액(USDT)": "Received Amount (USDT)",
    "내역이 없습니다.": "No records found.",
    "이용 및 투자약관": "Terms of Use and Investment"
  },
  "ja": {
    "핵심 정보": "主要情報",
    "지도": "地図",
    "개요": "概要",
    "증빙문서": "証憑書類",
    "증빙문서 안내": "証憑書類の案内",
    "자산 보기": "資産を見る",
    "투자 프로세스": "投資プロセス",
    "토큰 분배": "トークン配布",
    "매각 정산": "売却精算",
    "신뢰를 위한 공개": "信頼のための公開",
    "증빙/정산 문서": "証憑/精算書類",
    "최근 체결가": "最近の約定価格",
    "고정 이자": "固定利息",
    "서명자": "署名者",
    "세부 계산 방식 보기": "詳細な計算方法を見る",
    "스냅샷(지급일) 스테이킹 잔고": "スナップショット（支給日）ステーキング残高",
    "정산금액": "精算金額",
    "수령금액(USDT)": "受取金額（USDT）",
    "내역이 없습니다.": "履歴がありません。",
    "이용 및 투자약관": "利用および投資規約"
  },
  "zh": {
    "핵심 정보": "关键信息",
    "지도": "地图",
    "개요": "概览",
    "증빙문서": "证明文件",
    "증빙문서 안내": "证明文件说明",
    "자산 보기": "查看资产",
    "투자 프로세스": "投资流程",
    "토큰 분배": "代币分配",
    "매각 정산": "出售结算",
    "신뢰를 위한 공개": "为信任而公开",
    "증빙/정산 문서": "证明/结算文件",
    "최근 체결가": "最近成交价",
    "고정 이자": "固定利息",
    "서명자": "签署人",
    "세부 계산 방식 보기": "查看详细计算方法",
    "스냅샷(지급일) 스테이킹 잔고": "快照（发放日）质押余额",
    "정산금액": "结算金额",
    "수령금액(USDT)": "收取金额（USDT）",
    "내역이 없습니다.": "没有记录。",
    "이용 및 투자약관": "使用与投资条款"
  }
};
  mergeLangMap(EXACT, EXTRA_EXACT_V20);
  mergeLangMap(PARTS, EXTRA_PARTS_V20);


  const EXTRA_EXACT_V20B = {
  "en": {
    "정산 기준과 지급 방식은 자산별 Admin 설정에 따라 다릅니다. 정산통화가 USDT인 자산은 USDT 기준으로 처리되며, 그 외 자산은 Settlement Currency 기준 금액을 환율에 따라 USDT로 환산해 지급할 수 있습니다.": "Settlement rules and payout methods vary according to the admin settings for each asset. Assets whose settlement currency is USDT are processed on a USDT basis, while other assets may be paid in USDT by converting the settlement-currency amount using the applicable exchange rate.",
    "지갑을 연결하면 내 자산, 클레임, 매각 정산을 확인할 수 있습니다.": "Connect your wallet to check your assets, claims, and sale settlements."
  },
  "ja": {
    "정산 기준과 지급 방식은 자산별 Admin 설정에 따라 다릅니다. 정산통화가 USDT인 자산은 USDT 기준으로 처리되며, 그 외 자산은 Settlement Currency 기준 금액을 환율에 따라 USDT로 환산해 지급할 수 있습니다.": "精算基準と支給方式は資産ごとの管理者設定によって異なります。精算通貨がUSDTの資産はUSDT基準で処理され、それ以外の資産は精算通貨基準金額を為替に従ってUSDTへ換算して支給できます。",
    "목표 달성 후 매입 단계로 전환됩니다.": "目標達成後に買付段階へ移行します。",
    "참여 전에 전자계약서를 먼저 작성하고 자필서명을 완료해야 합니다.": "参加前に電子契約書を作成し、自筆署名を完了する必要があります。",
    "모금에 참여하려면 먼저 USDT를 예치해야 합니다.": "募集に参加するには、まずUSDTを入金する必要があります。",
    "지갑을 연결하면 내 자산, 클레임, 매각 정산을 확인할 수 있습니다.": "ウォレットを接続すると、自分の資産、受取、売却精算を確認できます。"
  },
  "zh": {
    "정산 기준과 지급 방식은 자산별 Admin 설정에 따라 다릅니다. 정산통화가 USDT인 자산은 USDT 기준으로 처리되며, 그 외 자산은 Settlement Currency 기준 금액을 환율에 따라 USDT로 환산해 지급할 수 있습니다.": "结算标准和支付方式会根据各资产的管理员设置而有所不同。结算货币为USDT的资产按USDT处理，其他资产则可按汇率将结算货币金额折算为USDT后支付。",
    "목표 달성 후 매입 단계로 전환됩니다.": "达到目标后，将转入收购阶段。",
    "참여 전에 전자계약서를 먼저 작성하고 자필서명을 완료해야 합니다.": "参与前，必须先完成电子合同和手写签名。",
    "모금에 참여하려면 먼저 USDT를 예치해야 합니다.": "参与募资前，必须先充值 USDT。",
    "지갑을 연결하면 내 자산, 클레임, 매각 정산을 확인할 수 있습니다.": "连接钱包后，即可查看你的资产、领取情况和出售结算。"
  }
};
  mergeLangMap(EXACT, EXTRA_EXACT_V20B);


  const EXTRA_EXACT_V20C = {
  "en": {
    "설정 키(Base32)": "Setup Key (Base32)",
    "토큰": "Token",
    ")에는 스테이킹/언스테이킹이 제한됩니다.": ") restricts staking and unstaking.",
    "· 연 이자율": "· Annual Interest Rate",
    "효력발생일: 2026-03-09": "Effective Date: 2026-03-09",
    "서비스명: RECON RWA": "Service Name: RECON RWA",
    "적용범위: 플랫폼 이용 및 투자 관련 안내": "Scope: Platform usage and investment guidance",
    "플랫폼 핵심 구조": "Core Platform Structure",
    "모금 → 자산 매입/편입 → 토큰 분배(클레임) → 거래 → 스테이킹 이자 → 매각 정산": "Funding → Asset Acquisition / Inclusion → Token Distribution (Claim) → Trading → Staking Interest → Sale Settlement",
    "주요 대상 자산": "Primary Target Assets",
    "제1조 목적": "Article 1 Purpose",
    "제2조 정의": "Article 2 Definitions",
    "제3조 서비스 내용": "Article 3 Service Details",
    "제4조 이용자 자격 및 지갑 연결": "Article 4 User Eligibility and Wallet Connection",
    "제5조 투자 전 확인사항": "Article 5 Pre-investment Checklist",
    "플랫폼": "Platform",
    "이용자": "User",
    "투자자": "Investor"
  },
  "ja": {
    "설정 키(Base32)": "設定キー（Base32）",
    "토큰": "トークン",
    ")에는 스테이킹/언스테이킹이 제한됩니다.": "）はステーキング/アンステーキングが制限されます。",
    "· 연 이자율": "・ 年利率",
    "효력발생일: 2026-03-09": "効力発生日: 2026-03-09",
    "서비스명: RECON RWA": "サービス名: RECON RWA",
    "적용범위: 플랫폼 이용 및 투자 관련 안내": "適用範囲: プラットフォーム利用および投資関連案内",
    "플랫폼 핵심 구조": "プラットフォームの中核構造",
    "모금 → 자산 매입/편입 → 토큰 분배(클레임) → 거래 → 스테이킹 이자 → 매각 정산": "募集 → 資産買付/組入 → トークン配布（受取）→ 取引 → ステーキング利息 → 売却精算",
    "매각 완료된 자산의 교환 기준과 수령 내역을 확인합니다.": "売却完了資産の交換基準と受取履歴を確認します。",
    "주요 대상 자산": "主な対象資産",
    "제1조 목적": "第1条 目的",
    "제2조 정의": "第2条 定義",
    "제3조 서비스 내용": "第3条 サービス内容",
    "제4조 이용자 자격 및 지갑 연결": "第4条 利用者資格およびウォレット接続",
    "제5조 투자 전 확인사항": "第5条 投資前の確認事項",
    "플랫폼": "プラットフォーム",
    "이용자": "利用者",
    "투자자": "投資家"
  },
  "zh": {
    "설정 키(Base32)": "设置密钥（Base32）",
    "토큰": "代币",
    ")에는 스테이킹/언스테이킹이 제한됩니다.": "）期间质押/解除质押受限。",
    "· 연 이자율": "· 年利率",
    "효력발생일: 2026-03-09": "生效日期: 2026-03-09",
    "서비스명: RECON RWA": "服务名称: RECON RWA",
    "적용범위: 플랫폼 이용 및 투자 관련 안내": "适用范围: 平台使用及投资相关说明",
    "플랫폼 핵심 구조": "平台核心结构",
    "모금 → 자산 매입/편입 → 토큰 분배(클레임) → 거래 → 스테이킹 이자 → 매각 정산": "募资 → 资产收购/纳入 → 代币分配（领取）→ 交易 → 质押利息 → 出售结算",
    "매각 완료된 자산의 교환 기준과 수령 내역을 확인합니다.": "查看已出售资产的兑换基准与收款记录。",
    "주요 대상 자산": "主要目标资产",
    "제1조 목적": "第1条 目的",
    "제2조 정의": "第2条 定义",
    "제3조 서비스 내용": "第3条 服务内容",
    "제4조 이용자 자격 및 지갑 연결": "第4条 用户资格及钱包连接",
    "제5조 투자 전 확인사항": "第5条 投资前确认事项",
    "플랫폼": "平台",
    "이용자": "用户",
    "투자자": "投资者"
  }
};
  mergeLangMap(EXACT, EXTRA_EXACT_V20C);


  const EXTRA_EXACT_V20D = {
  "en": {
    "거래 · RECON RWA": "Trade · RECON RWA",
    "선택 자산 보유 수량": "Selected Asset Balance"
  },
  "ja": {
    "거래 · RECON RWA": "取引 · RECON RWA",
    "선택 자산 보유 수량": "選択資産の保有数量"
  },
  "zh": {
    "거래 · RECON RWA": "交易 · RECON RWA",
    "선택 자산 보유 수량": "所选资产持有数量"
  }
};
  mergeLangMap(EXACT, EXTRA_EXACT_V20D);

  const EXTRA_EXACT_V21 = {
  en: {
    "없음": "None",
    "대기": "Pending",
    "즉시체결": "Instant Match",
    "선택": "Select"
  },


};
  const EXTRA_PARTS_V21 = {
  en: { "없음": "None" },


};
  mergeLangMap(EXACT, EXTRA_EXACT_V21);
  mergeLangMap(PARTS, EXTRA_PARTS_V21);

  const EXTRA_EXACT_V22 = {
  en: {
    "작성중": "In Draft",
    "사용자 서명 완료": "User Signature Completed",
    "양측 서명 완료": "Executed by Both Parties",
    "금액 입력 필요": "Amount Required",
    "참여 확정 완료": "Participation Confirmed",
    "초안 생성됨 (금액 확정)": "Draft Created (Amount Locked)",
    "지갑 연결 필요": "Wallet connection required",
    "자산 선택 필요": "Asset selection required",
    "작성 불가": "Unavailable",
    "현재 진행중": "Current",
    "열기": "Open",
    "서명 필요": "Signature Required",
    "계약 제출 및 체결 내역": "Submitted and Executed Contracts",
    "이 상품에 대해 제출하거나 체결한 계약 이력을 모두 확인할 수 있습니다.": "Review every contract you submitted or executed for this product.",
    "계약을 선택하면 상세 내용을 열람할 수 있습니다.": "Select a contract to view its details.",
    "이 상품의 계약 이력이 없습니다.": "There is no contract history for this product.",
    "전자계약서를 불러오지 못했습니다.": "Failed to load the electronic contract.",
    "전자계약서 조회 실패": "Failed to load the electronic contract.",
    "전자계약서 생성 실패": "Failed to create the electronic contract.",
    "전자계약서를 먼저 작성하세요.": "Create the electronic contract first.",
    "전자계약서 자필서명을 먼저 완료하세요.": "Complete the handwritten electronic signature first.",
    "입력 금액이 전자계약서 금액과 다릅니다. 계약서를 다시 작성하세요.": "The entered amount does not match the electronic contract. Please recreate the contract.",
    "전자계약서가 없습니다.": "There is no electronic contract.",
    "서명자명을 입력하세요.": "Enter the signer name.",
    "전자문서 동의가 필요합니다.": "Consent to electronic documents is required.",
    "전자서명 동의가 필요합니다.": "Consent to the electronic signature is required.",
    "자필 전자서명이 필요합니다.": "A handwritten electronic signature is required.",
    "서명 이미지를 생성할 수 없습니다. 다시 서명해 주세요.": "Unable to create the signature image. Please sign again.",
    "서명이 너무 작습니다. 다시 서명해 주세요.": "The signature is too small. Please sign again.",
    "서명 처리 중…": "Processing signature…",
    "전자계약서 서명이 완료되었습니다.": "The electronic contract signature is complete.",
    "서명 완료 처리 실패": "Failed to finalize the signature.",
    "전자계약서 서명 저장 실패": "Failed to save the electronic contract signature.",
    "기존 계약서가 파기되었습니다. 금액을 변경한 후 다시 작성하세요.": "The previous contract has been discarded. Change the amount and create it again.",
    "참여 금액을 먼저 입력한 후 전자계약서를 작성하세요.": "Enter the participation amount first, then create the electronic contract.",
    "전자계약서 서명이 완료되었습니다. 참여하기 버튼을 눌러주세요.": "The electronic contract has been signed. Please press the Participate button.",
    "전자계약서 서명이 완료되었습니다. OTP 입력 후 참여하기를 실행하세요.": "The electronic contract has been signed. Enter your OTP and then proceed with participation.",
    "모금액 달성 시점에 확정됩니다. (현재 표기는 live 예상치)": "The rate is fixed when funding is achieved. (The current display is a live estimate.)",
    "지갑을 연결한 후 투자 청약 전자계약서를 작성할 수 있습니다.": "Connect your wallet to create the subscription electronic contract.",
    "자산을 먼저 선택하세요.": "Select an asset first.",
    "현재 단계에서는 신규 전자계약서 작성 및 모금 참여가 불가합니다.": "At this stage, new electronic contracts and participation are unavailable.",
    "최근 참여 신청 건입니다. 관리자 서명이 완료되면 모금액에 확정 반영됩니다.": "This is your most recent participation request. It will be finalized in the funding amount once the administrator signs.",
    "양측 서명이 완료되어 모금에 확정 반영된 계약입니다.": "This contract has been fully executed by both parties and has been finalized in the funding amount.",
    "참여 금액을 먼저 입력한 후 전자계약서를 작성하세요.": "Please enter the participation amount first, then create the electronic contract.",
    "참여 전에 전자계약서를 먼저 작성하고 자필서명을 완료해야 합니다.": "Before participating, create the electronic contract and complete the handwritten signature.",
    "입력 금액이 변경되어 기존 전자계약서를 그대로 사용할 수 없습니다. 다시 작성하세요.": "The entered amount has changed, so the existing electronic contract cannot be reused. Please create it again.",
    "계약 내용을 검토하고 자필 전자서명을 완료하세요. 금액 변경 시 '다시 작성' 버튼을 이용하세요.": "Review the contract and complete the handwritten electronic signature. Use the Recreate button if you need to change the amount.",
    "이전 계약서를 다시 작성해야 합니다.": "The previous contract must be recreated.",
    "지갑을 연결하면 내 투자 자산이 표시됩니다.": "Connect your wallet to view your invested assets.",
    "지갑을 연결하면 내가 투자한 자산만 표시됩니다.": "Only assets invested by your wallet will be shown after connection.",
    "지갑을 연결하면 토큰 정보를 표시합니다.": "Connect your wallet to view token information.",
    "내 투자 자산 목록 로드 실패": "Failed to load your invested assets.",
    "목록 로드 실패": "Failed to load the list.",
    "투자(참여)한 자산이 없습니다.": "You have not invested in any assets.",
    "참여 내역 없음": "No participation history",
    "현재 지갑 주소로 모금 참여한 자산이 없습니다.": "There are no assets funded with the current wallet address.",
    "내역이 없습니다.": "No history found.",
    "토큰등록중": "Token registration in progress",
    "모금이 완료 되어 재단에서 토큰을 발행 및 등록중에 있습니다. 토큰등록이 완료 되면 분배 받을 수 있습니다.": "Funding has been completed and the foundation is issuing and registering the token. Distribution becomes available once registration is complete.",
    "토큰 등록 완료": "Token registration completed",
    "토큰 등록이 완료되었습니다. 관리자가 분배를 시작하면 클레임할 수 있습니다.": "Token registration is complete. You can claim once the administrator starts distribution.",
    "토큰 분배중": "Token distribution in progress",
    "클레임 버튼으로 자산 토큰을 수령할 수 있습니다.": "Use the Claim button to receive the asset tokens.",
    "미수령 수량이 있다면 계속 클레임할 수 있습니다.": "If there are unclaimed tokens remaining, you can continue claiming.",
    "현재 미수령 수량이 없습니다. 수령 후에는 스테이킹 또는 거래가 가능합니다.": "There are no unclaimed tokens right now. After claiming, staking or trading becomes available.",
    "매각 진행중": "Sale settlement in progress",
    "미수령 토큰이 있다면 먼저 클레임한 뒤, 매각 정산으로 이동할 수 있습니다.": "If you still have unclaimed tokens, claim them first and then proceed to sale settlement.",
    "매입 진행중": "Acquisition in progress",
    "매입 완료 후 토큰 등록 및 분배가 열립니다.": "Token registration and distribution will open after acquisition is completed.",
    "모금 진행중": "Funding in progress",
    "목표 달성 후 1 USDT = 1 Token 기준으로 발행 수량이 확정됩니다.": "After the target is reached, the issuance amount is fixed on a 1 USDT = 1 Token basis.",
    "모집 실패": "Funding failed",
    "환불 가능 여부를 확인하세요.": "Check whether a refund is available.",
    "매입 취소": "Acquisition canceled",
    "취소된 자산입니다. 환불/참여 내역을 확인하세요.": "This asset has been canceled. Please review the refund and participation history.",
    "안내": "Information",
    "클레임 가능 상태를 확인하세요.": "Check whether claiming is currently available.",
    "클레임 상태 로드 실패": "Failed to load claim status.",
    "참여 내역이 없습니다.": "There is no participation history.",
    "클레임 가능: 버튼을 눌러 수령하세요.": "Claim available: press the button to receive your tokens.",
    "아직 클레임이 열리지 않았습니다.": "Claiming has not opened yet.",
    "현재 수령 가능 수량이 없습니다.": "There is no claimable amount right now.",
    "클레임 실패": "Claim failed",
    "보유 자산 없음": "No holdings",
    "계약 조회 실패": "Failed to load the contract.",
    "계약서 내용이 없습니다.": "No contract content is available.",
    "관리자 반려": "Rejected by Admin",
    "계약 없음": "No contract",
    "이미 내 클레임을 완료했습니다.": "You have already completed your claim.",
    "분배 자산을 불러오지 못했습니다.": "Failed to load distributable assets.",
    "포트폴리오 로드 실패": "Failed to load the portfolio.",
    "포트폴리오를 불러오지 못했습니다.": "Unable to load the portfolio.",
    "추천코드 복사 완료": "Referral code copied.",
    "보유 내역이 없습니다.": "No holdings found.",
    "지갑이 연결되었습니다.": "Wallet connected.",
    "히스토리": "History",
    "자금 히스토리": "History",
    "자금 히스토리 · RECON RWA": "History · RECON RWA"
  },


};
  mergeLangMap(EXACT, EXTRA_EXACT_V22);


  const EXTRA_EXACT_V23 = {
    en: {
      "접근 권한이 없습니다.": "Access denied.",
      "권한이 있는 추천인 계정에서만 접근 가능합니다.": "This page is available only to approved referrer accounts.",
      "추천인 코드:": "Referrer Code:",
      "추천인:": "Referrer:",
      "Phantom 지갑이 필요합니다.": "Phantom wallet is required.",
      "지갑 연결 실패": "Wallet connection failed",
      "OTP 인증 실패": "OTP verification failed",
      "OTP 6자리를 입력하세요.": "Enter the 6-digit OTP code.",
      "히스토리 페이지": "History Page"
    },


  };
  mergeLangMap(EXACT, EXTRA_EXACT_V23);

  const EXTRA_EXACT_V24 = {
    en: {
      "체결 데이터가 없습니다.": "There is no fill data.",
      "체결이 없습니다.": "There are no fills.",
      "체결이 1건만 있어 그래프를 표시할 수 없습니다.": "The chart cannot be shown because there is only one fill.",
      "월간 데이터가 없습니다.": "There is no monthly data.",
      "매수 주문이 없습니다.": "There are no buy orders.",
      "자산이 없습니다.": "There are no assets.",
      "체결할 잔량이 없습니다.": "There is no remaining quantity to fill.",
      "성공": "Success",
      "자산명 또는 코드(예: APT001)": "Asset name or code (e.g. APT001)",
      "USDT 출금은 신청 수량 - 고정 수수료 = 전송수량으로 계산됩니다.": "For USDT withdrawals, transfer amount = requested quantity - fixed fee.",
      "토큰 출금은 신청 수량 전액이 전송되고, 고정 수수료는 별도 USDT로 차감됩니다.": "For token withdrawals, the full requested quantity is transferred, and the fixed fee is deducted separately in USDT.",
      "USDT 출금은 신청 수량에서 비율 수수료가 차감된 뒤 전송됩니다.": "For USDT withdrawals, the transfer is sent after deducting the percentage fee from the requested quantity.",
      "토큰 출금은 신청 수량에서 비율 수수료가 차감된 뒤 전송됩니다.": "For token withdrawals, the transfer is sent after deducting the percentage fee from the requested quantity."
    },


  };
  mergeLangMap(EXACT, EXTRA_EXACT_V24);

  const EXTRA_EXACT_V25 = {
    "en": {
      "승인대기중": "Pending Approval",
      "⏳ 승인대기중": "⏳ Pending Approval",
      "승인대기": "Pending Approval",
      "✓ 입금완료": "✓ Deposit Completed",
      "✕ 거절": "✕ Rejected",
      "거절": "Rejected"
    },
    "ja": {
      "승인대기중": "承認待ち",
      "⏳ 승인대기중": "⏳ 承認待ち",
      "승인대기": "承認待ち",
      "✓ 입금완료": "✓ 入金完了",
      "✕ 거절": "✕ 却下",
      "거절": "却下"
    },
    "zh": {
      "승인대기중": "等待审核",
      "⏳ 승인대기중": "⏳ 等待审核",
      "승인대기": "等待审核",
      "✓ 입금완료": "✓ 入金完成",
      "✕ 거절": "✕ 已拒绝",
      "거절": "已拒绝"
    }
  };
  mergeLangMap(EXACT, EXTRA_EXACT_V25);

  // 스테이킹 페이지 힌트 문구 추가 번역
  const EXTRA_EXACT_V26 = {
    en: {
      "환율 설정이 필요합니다. (관리자 FX 설정)": "FX rate configuration is required. (Admin FX settings)",
      "스테이킹 잔고가 없습니다. 먼저 스테이킹하세요.": "You have no staking balance. Please stake first.",
      "누적 클레임 완료 이자": "Cumulative Claimed Interest",
      "아직 배정되지 않은 상태입니다.": "Not yet allocated.",
      "주문이 오더북에 등록되었습니다.": "Order has been registered on the order book.",
      "금액을 입력하세요.": "Please enter an amount.",
      "시스템 AMM 유동성이 부족합니다.": "Platform AMM liquidity is insufficient.",
      "토큰 부족": "Insufficient tokens",
      "보유 토큰 부족": "Insufficient token balance",
      "매수 주문 예치금이 부족합니다.": "Buy order deposit is insufficient.",
      "주문이 즉시 전량 체결되었습니다.": "Order fully filled immediately.",
      "주문이 부분 체결되었습니다.": "Order partially filled.",
      "체결": "Filled",
      "잔량": "Remaining",
    },


  };
  mergeLangMap(EXACT, EXTRA_EXACT_V26);

  // V27: sale-detail.html (user 매각 상세 페이지) Korean fragments
  const EXTRA_EXACT_V27 = {
    en: {
      "매각 자산 교환이 가능합니다. 토큰 입금 후 토큰당 교환단가 기준으로 USDT를 수령합니다. (입금 즉시 토큰 영구 소각)":
        "Sold asset exchange is available. Deposit tokens to receive USDT based on the per-token exchange unit price. (Tokens are permanently burned immediately upon deposit.)",
      "토큰 입금 수량은 정수만 입력할 수 있으며, 입금 즉시 토큰은 영구 소각되고 해당 수량 × 토큰당 교환금액만큼 USDT가 지급됩니다.":
        "Token deposit quantity must be a whole number. Tokens are permanently burned immediately upon deposit, and USDT is paid as quantity × per-token exchange amount.",
      "토큰 입금 수량은 정수만 입력할 수 있습니다.": "Token deposit quantity must be a whole number.",
      "거래 수량은 정수만 입력할 수 있습니다.": "Trade quantity must be a whole number.",
      "가격은 소수점 2자리까지만 입력할 수 있습니다.": "Price can have at most 2 decimal places.",
      "매각 실행일": "Sale Execution Date",
      "남은 교환 가능액": "Remaining Exchangeable Amount",
      "회계사 공문서": "Certified Accountant Letter",
      "수령 내역": "Receipt History",
      // V27.1: sales.php /redeem 백엔드 에러 메시지 (손실 매각 시 노출 가능)
      "정산 가능한 준비금이 없습니다.": "No settlement reserve is available.",
      "정산 금액이 0입니다.": "Settlement amount is 0.",
      "남은 정산 준비금을 초과합니다.": "Exceeds the remaining settlement reserve.",
      "매각 정보가 없습니다.": "Sale information not found.",
      "토큰 입금 수량은 1개 이상이어야 합니다.": "Token deposit quantity must be at least 1.",
      "반환할 토큰 수량이 올바르지 않습니다.": "The token quantity to return is invalid.",
      "보유 토큰보다 많이 반환할 수 없습니다.": "Cannot return more than your held tokens.",
      "토큰 공급량 오류": "Token supply error",
      "정산 환율을 확인할 수 없습니다.": "Settlement exchange rate is unavailable.",
      "정산 처리 실패": "Settlement processing failed",
    },


  };
  mergeLangMap(EXACT, EXTRA_EXACT_V27);

  function invertTranslatedMap(source) {
    const out = {};
    Object.entries(source || {}).forEach(([original, translated]) => {
      const key = String(translated || "").replace(/\s+/g, " ").trim();
      if (!key || out[key]) return;
      out[key] = original;
    });
    return out;
  }

  mergeLangMap(EXACT, { ko: invertTranslatedMap(EXACT.en) });
  mergeLangMap(PARTS, { ko: Object.assign({}, invertTranslatedMap(PARTS.en), PARTS.ko || {}) });

  const EN_SOURCE = {
  // (2026-05-07) KO 매핑 추가 — EN source 페이지(swap.html 등) 의 정적 영어를
  // KO 모드에서 한국어로 변환. 정책상 EN 이 source 이므로 신규 라벨은 모두 EN 으로
  // 작성하고 여기서 KO 번역만 추가하면 양방향 동작.
  "ko": {
    // ── Common navigation / wallet ──
    "Connect Wallet": "지갑 연결",
    "Disconnect Wallet": "지갑 해제",
    "My Assets": "내 자산",
    "Setup OTP": "OTP 등록",
    "Verify OTP": "OTP 인증",

    // ── Header brand subtitle (kept intentionally English in source) ──

    // ── assets.html (Investment Submitted modal + pending list) ──
    "Investment Submitted": "투자 신청 접수",
    "Your contract has been signed and your investment has been submitted in a single transaction.":
      "계약 서명과 투자 신청이 한 번에 처리되었습니다.",
    "Amount": "금액",
    "Tokens": "받을 토큰",
    "Contract No.": "계약번호",
    "View Portfolio": "포트폴리오 보기",
    "Close": "닫기",
    "My Pending Investments": "관리자 승인 대기 중인 투자",
    "These contracts are awaiting administrator approval. They will disappear from this list once approved.":
      "관리자 승인을 기다리는 계약입니다. 승인되면 이 목록에서 자동으로 사라집니다.",
    "↻ Refresh": "↻ 새로고침",
    "Awaiting Approval": "승인 대기",
    "Apply for Investment": "투자 신청",
    "Participate (Invest)": "투자 참여",
    "+ Deposit USDT": "+ USDT 입금",

    // ── swap.html static labels ──
    "Swap": "스왑",
    "Swap · SilicaChain": "스왑 · SilicaChain",
    "◆ ONE-WAY SWAP · NO REVERSAL": "◆ 단방향 스왑 · 되돌릴 수 없음",
    "One-way conversion from Silica to SilicaSTO. The reverse direction is not supported.":
      "Silica → SilicaSTO 단방향 변환. 반대 방향은 지원되지 않습니다.",
    "FROM": "보내는 토큰",
    "TO": "받는 토큰",
    "Applied Rate": "적용 환율",
    "Silica Price": "Silica 시세",
    "Price Updated": "시세 갱신",
    "Swap Fee": "스왑 수수료",
    "Execute Swap": "스왑 실행",
    "Sync Price": "시세 동기화",
    "🔄 Sync Price": "🔄 시세 동기화",
    "🔄 Re-sync Price": "🔄 시세 다시 동기화",

    // ── swap inline status (인라인 JS 가 직접 한국어 출력하지만, 캐시된 이전 영문 노드가
    //    남아있을 때 변환되도록 fallback 매핑) ──
    "just now": "방금",
    "Synced": "동기화 완료",
    "Syncing…": "동기화 중…",
    "Executing…": "실행 중…",
    "Click \"Sync Price\" first to lock the rate. The quote expires after 10 seconds.":
      "스왑 전 \"Sync Price\" 버튼을 눌러주세요. 동기화 후 10초 안에 스왑하지 않으면 만료됩니다.",
    "⚠ Quote expired — please sync again.":
      "⚠ 시세 유효시간이 만료되었습니다. 다시 동기화해 주세요.",
    "✓ Swap completed. Sync again to perform another.":
      "✓ 스왑 완료. 다시 스왑하려면 시세를 다시 동기화하세요.",

    // ── 공통 짧은 라벨 ──
    "Balance": "잔액",
    "Loading...": "로딩 중...",
    "0% (Free)": "0% (무료)",

    // ── trade.html / 기타 페이지에서 자주 보이는 라벨 ──
    "Order Book": "오더북",
    "Recent Trades": "최근 체결",
    "Buy Order": "매수 주문",
    "Sell Order": "매도 주문",
    "Trading Fee": "거래 수수료",
    "Open": "시가",
    "High": "고가",
    "Low": "저가",
    // (v885) 운영자 보고 — "Close" 가 "종가"로 매핑되어 모달 닫기 버튼이
    //   "종가"로 잘못 표기되던 문제. 같은 객체에서 라인 4111 "Close":"닫기"
    //   를 덮어쓰고 있었음 (중복 key). 라인 4111 의 "닫기"를 살리기 위해
    //   여기 OHLC 의 "종가" 매핑 제거. trade chart 의 Close 는 영문으로 노출.
    "Settlement Currency": "정산통화",
    "Total Supply": "총 발행량",
    "Last Trade": "최근 거래",
    "My Orders": "내 주문",

    // ── history.html ──
    "Transaction History": "거래 내역",
    "All": "전체",
    "Deposits & Withdrawals": "입출금",
    "Investments": "투자 내역",
    "Staking": "스테이킹",
    "Interest": "이자",
    "Dividends": "배당",
    "Trade": "거래",
    // 테이블 헤더
    "Time": "시각",
    "Type": "유형",
    "Token": "토큰",
    "Status": "상태",
    "Tx Hash": "거래 해시",
    // 필터 영역
    "🔍 Search...": "🔍 검색...",
    "All Tokens": "전체 토큰",
    "Last 30 days": "최근 30일",
    "Last 7 days": "최근 7일",
    "📥 Export": "📥 내보내기",
    "‹ Previous": "‹ 이전",
    "Next ›": "다음 ›",
    // 인증 안내
    "Connect your wallet to view transaction history.": "거래 내역을 보려면 지갑을 연결하세요.",
    "No transactions in this category.": "해당 카테고리에 거래 내역이 없습니다.",
    "No transaction history yet. Start your first trade.":
      "거래 내역이 없습니다. 첫 거래를 시작하세요.",

    // ── staking.html ──
    "Stake": "스테이킹",
    "Unstake": "언스테이킹",
    "Staked Amount": "스테이킹 수량",
    "Estimated Interest": "예상 이자",
    "Claim History": "클레임 내역",

    // ── claim.html ──
    "Claim": "클레임",
    "Claims": "클레임",
    "Available to Claim": "클레임 가능",

    // ── deposit.html / withdraw.html ──
    "Deposit": "입금",
    "Withdraw": "출금",
    "Withdrawal": "출금",
    "Amount": "금액",
    "Available": "사용 가능",
    "Network": "네트워크",
    "Address": "주소",

    // ── landing.html (2026-05-12 v284) ──
    // Hero overlay
    // (2026-05-12 v292) 'for' / 'Mined' / 'Two' 단일 단어 키는 제거.
    //   replaceLooseToken 의 영어 키용 word-boundary 패치로 substring
    //   오염은 막았지만, 'for'/'Mined' 등은 활용형(한국어 어미)이라
    //   다른 문맥에서도 어색하게 매치될 위험이 남는다. 히어로 텍스트
    //   노드는 'Real-World Assets'와 'Stable Yield.' 만 KO로 변환되고
    //   가운데 "Mined for"는 EN으로 남도록 보수적 처리.
    "Real-World Assets": "실물자산",
    "Stable Yield.": "안정 수익.",
    "Korea's 271-hectare high-purity silica mine. Monthly USDT fixed interest + annual dividend.":
      "271헥타르 규모 한국 고순도 규석 광산. 매월 USDT 고정 이자 + 연간 배당.",
    "Invest Now →": "지금 투자하기 →",
    "View Asset Details": "자산 상세 보기",

    // Stat strip labels
    "PURITY": "순도",
    "RESERVES": "매장량",
    "AREA": "면적",
    "RECOVERY": "회수율",
    "METRIC TONS": "톤",
    "HECTARES": "헥타르",
    "RECOVERY RATE": "회수율",

    // Underlying asset section
    "◆ THE UNDERLYING ASSET": "◆ 기초 자산",
    "Mining License": "광업권",
    "Korea's Purest Mineral Resource.": "한국 최고 순도의 광물 자원.",
    "// SiO₂ 97.04% — Korean average 90~93%":
      "// SiO₂ 97.04% — 국내 평균 90~93%",
    "A core raw material for semiconductor wafers, optical fiber, and solar panels. Purity 4~7%p higher than the Korean average. We issue Investment Certificates to fund mining operations, and investors share in the mine's revenue.":
      "반도체 웨이퍼, 광섬유, 태양광 패널의 핵심 원료. 국내 평균보다 순도 4~7%p 높습니다. 투자증서(SilicaSTO)를 발행해 광산 운영 자금을 모으고, 투자자는 광산 수익을 함께 나눕니다.",
    "License No.": "광업권 번호",
    "Jurisdiction": "관할 국가",
    "Recoverable": "회수 가능량",
    "Until": "기한",
    "End Use": "용도",
    "Korea": "대한민국",
    "Solana Devnet": "Solana Devnet",
    "Chips · Fiber · Solar": "반도체 · 광섬유 · 태양광",
    "◆ SiO₂ PURITY": "◆ SiO₂ 순도",
    "PERCENT": "퍼센트",

    // Yield section
    // (2026-05-12 v292) 'Two' 단일 단어 키 제거 — 'Two-Factor
    //   Authentication' 같은 다른 페이지 문구를 substring 침범하던 버그.
    //   히어로의 'Two Yield Streams' 는 별도 키로 그대로 매핑.
    "◆ TWO YIELD STREAMS": "◆ 두 가지 수익원",
    "Two Yield Streams": "두 가지 수익원",
    "Yield Streams": "수익원",
    "Monthly stable income + annual mine performance dividend":
      "매월 안정적 수익 + 연 1회 광산 실적 배당",
    "● Fixed · Monthly · USDT": "● 고정 · 매월 · USDT",
    "Fixed Interest": "고정 이자",
    "Automatically paid out in USDT on the 15th of every month. The interest rate is adjustable by the operator, and any updated rate applies from the next cycle (current cycle is unaffected).":
      "매월 15일 USDT로 자동 지급됩니다. 이자율은 운영자가 조정 가능하며, 변경된 이자율은 다음 회차부터 적용됩니다(진행 중인 회차에는 영향이 없습니다).",
    "Payout": "지급일",
    "15th of every month": "매월 15일",
    "Currency": "지급 통화",
    "● Variable · Annual · Silica": "● 변동 · 연간 · Silica",
    "Annual Interest": "연이자",
    "Annual Dividend": "연간 배당",
    "Distributed in April~May after Korean fiscal year close. Mine revenue is shared as Silica tokens and allocated only to investors actively staking on the payout date (15th).":
      "한국 회계연도 마감 이후 4~5월에 분배됩니다. 광산 수익은 Silica 토큰으로 공유되며, 지급일(15일) 시점에 스테이킹 중인 투자자에게만 배정됩니다.",
    "Frequency": "지급 주기",
    "Annually · April~May": "연 1회 · 4~5월",

    // Dual Token section
    "◆ DUAL TOKEN ARCHITECTURE": "◆ 이중 토큰 구조",
    "Dual Token": "이중 토큰",
    "Architecture.": "구조.",
    "An Investment Certificate issued when you invest in the mine. Always pegged 1:1 to USDT. Designed to preserve principal stably.":
      "광산에 투자하면 발행되는 투자증서. 항상 USDT와 1:1로 연동되며, 원금을 안정적으로 보존하도록 설계되었습니다.",
    "Price": "가격",
    "1 SilicaSTO = 1 USDT": "1 SilicaSTO = 1 USDT",
    "Issuance": "발행",
    "At investment": "투자 시점",
    // (2026-05-18 v471) 정적 '5%' 매핑 폐기 — SilicaSTO Staking APR 은
    //   landing.html inline JS 가 /api/public/config 의 silica_apr_pct
    //   에서 동적 바인딩. placeholder 만 유지 — 캐시된 페이지의 옛 텍스트
    //   가 잘못 번역되지 않도록.
    "Available (— % USDT Interest)": "가능 (— % USDT 이자)",
    "Available (rate not set)": "가능 (이자율 미설정)",
    "External wallet supported": "외부 지갑 지원",
    "A reward token paid out as the annual dividend. Market price is established upon exchange listing, and it can be swapped one-way into SilicaSTO.":
      "연간 배당으로 지급되는 보상 토큰. 거래소 상장 시 시장가격이 형성되며, SilicaSTO로 단방향 스왑이 가능합니다.",
    // (2026-05-18 v469) 정적 '0.05 USDT' 매핑 폐기 — Silica 시세는 landing.html
    //   inline JS 가 /api/public/config 에서 동적 바인딩. 캐시된 페이지가 옛
    //   '0.05' 텍스트를 표시해도 i18n.apply 가 번역하지 않도록 placeholder 만
    //   유지. (key 가 매칭되지 않으면 원문 그대로 노출.)
    "Variable (currently — USDT)": "변동 (현재 — USDT)",
    "Variable (price not set)": "변동 (시세 미설정)",
    "Annual dividend / Reward": "연간 배당 / 보상",
    "Trading": "거래",
    "Silica → SilicaSTO (one-way)": "Silica → SilicaSTO (단방향)",

    // CTA section
    "◆ READY TO INVEST": "◆ 투자 시작",
    "Hold Real-World Assets": "실물자산을",
    "In Your Wallet.": "지갑에 보유하세요.",
    "Connect your Phantom wallet and get started in under a minute.":
      "Phantom 지갑을 연결하고 1분 안에 시작하세요.",
    "Create Account": "계정 만들기",
    "View IR Materials": "IR 자료 보기",

    // ── claim.html (2026-05-12 v286) ──
    "◆ INTEREST & DIVIDEND CLAIMS": "◆ 이자 및 배당 클레임",
    "Cumulative Interest": "누적 이자",
    "Cumulative Dividend": "누적 배당",
    "Total Reward Value": "총 보상 가치",
    "USDT Equivalent": "USDT 환산",
    "Interest (Monthly)": "이자 (월간)",
    "Dividend (Annual)": "배당 (연간)",
    "Referral Bonus": "추천 보상",
    "◆ INTEREST CLAIM": "◆ 이자 클레임",
    "— rounds pending": "— 회차 대기 중",
    "Details": "자세히 보기",
    "Claim Now": "지금 클레임",
    "Monthly Fixed Interest Payout History": "월별 고정 이자 지급 내역",
    "Paid out automatically on the 15th of each month.": "매월 15일에 자동 지급됩니다.",
    "Cycle": "회차",
    "Period": "기간",
    "Interest Rate": "이자율",
    "Avg Staked": "평균 스테이킹",
    "Tx": "거래",
    "No interest has been paid out yet. Stake SilicaSTO to receive automatic payouts on the 15th of each month.":
      "지급된 이자가 아직 없습니다. SilicaSTO를 스테이킹하면 매월 15일에 자동 지급됩니다.",
    "◆ NEXT DIVIDEND": "◆ 다음 배당",
    "Annual Dividend Payout Info": "연간 배당 지급 안내",
    "Schedule will appear after staking": "스테이킹 후 일정이 표시됩니다",
    "Expected Receipt": "예상 수령",
    "Based on payout date price": "지급일 가격 기준",
    "Annual dividends are distributed in Silica reward tokens once per year based on the platform's revenue share schedule. Stake SilicaSTO before the snapshot date to be eligible.":
      "연간 배당은 플랫폼 수익 분배 일정에 따라 매년 1회 Silica 보상 토큰으로 분배됩니다. 스냅샷 일자 이전에 SilicaSTO를 스테이킹해 두어야 받을 수 있습니다.",
    "When users you referred receive monthly staking interest, you automatically earn a referrer bonus paid in USDT to your balance. View your referral status, bonus history, and your share code on the dedicated page.":
      "추천한 사용자가 월간 스테이킹 이자를 받으면, 그 즉시 추천인 보상이 USDT로 잔액에 자동 지급됩니다. 추천 현황·보너스 내역·공유 코드는 추천 페이지에서 확인할 수 있습니다.",
    "Open Referral Page →": "추천 페이지 열기 →",

    // ── portfolio.html (2026-05-12 v287) ──
    "TOTAL VALUE": "총 자산 가치",
    "+ Deposit": "+ 입금",
    "− Withdraw": "− 출금",
    "TETHER · STABLECOIN": "테더 · 스테이블코인",
    "INVESTMENT CERTIFICATE · STO": "투자증서 · STO",
    "REWARD TOKEN · UTILITY": "보상 토큰 · 유틸리티",
    "Staked": "스테이킹",
    "Idle": "보유",
    "Current Price": "현재 가격",
    "Cumulative Payout": "누적 지급",
    "Mint": "민트",
    "Solana": "Solana",
    "Wallet · Solana Devnet": "지갑 · Solana Devnet",

    // ── referral.html (2026-05-12 v288) ──
    "◆ 1-TIER REFERRAL · DIRECT": "◆ 1단계 추천 · 직접",
    "Referral Program": "추천 프로그램",
    "Directly invite friends and earn monthly interest bonuses":
      "친구를 직접 초대하고 매월 이자 보너스를 받으세요",
    "DIRECT REFERRAL": "직접 추천",
    "Direct Referral Bonus": "직접 추천 보너스",
    "Earn an additional percentage from the monthly interest rewards of people you directly invite.":
      "직접 초대한 사용자의 월간 이자 보상에서 추가 비율만큼 보너스를 받습니다.",
    "◆ MY REFERRAL LINK": "◆ 내 추천 링크",
    "My Referral Link": "내 추천 링크",
    "CODE": "코드",
    "URL": "URL",
    "— Displayed after wallet connection —": "— 지갑 연결 후 표시됩니다 —",
    "📋 Copy": "📋 복사",
    "💬 KakaoTalk": "💬 카카오톡",
    "📧 Email": "📧 이메일",
    "𝕏 Twitter": "𝕏 트위터",
    "Direct Referral": "직접 추천",
    "PEOPLE": "명",
    "Cumulative Bonus": "누적 보너스",
    "This Month (Expected)": "이번 달 (예상)",
    "Referred Users": "추천한 사용자",
    "0 users": "0명",
    "No directly referred users yet.": "아직 추천한 사용자가 없습니다.",
    "Share the referral link above to invite your first friend.":
      "위 추천 링크를 공유해 첫 친구를 초대하세요.",
    "Referral Program Information": "추천 프로그램 안내",

    // ── ir.html (2026-05-12 v289) ──
    // Hero / mine site
    "High-Purity": "고순도",
    "Silica": "Silica",
    "Mine": "광산",
    "◆ MINE SITE": "◆ 광산 위치",
    "Mine Site & Overview": "광산 위치 & 개요",
    "◆ OVERVIEW": "◆ 개요",
    "◆ DETAIL IMAGES": "◆ 상세 이미지",
    "◆ LOCATION": "◆ 위치",
    // Asset details
    "◆ ASSET DETAILS": "◆ 자산 정보",
    "Mine Information": "광산 정보",
    "Mining License Registration No.": "광업권 등록번호",
    "Governing Law": "준거법",
    "Mine Area": "광산 면적",
    "Approved Mining Area": "허가 광구 면적",
    "SiO₂ Purity": "SiO₂ 순도",
    "+4~7%p vs. Korean Avg. 90-93%": "국내 평균 90~93% 대비 +4~7%p",
    "Total Reserves": "총 매장량",
    "Verified Reserves": "확인 매장량",
    "70% Recovery Rate": "회수율 70%",
    "Test Network": "테스트 네트워크",
    // Reserve breakdown
    "◆ RESERVE BREAKDOWN": "◆ 매장량 분포",
    "Reserve Distribution": "매장량 분포",
    "Of the total 30.68M tons of reserves, 70% has been verified as recoverable.":
      "총 매장량 30.68M톤 중 70%가 회수 가능한 것으로 확인되었습니다.",
    "RECOVERABLE": "회수 가능",
    "UNRECOVERABLE": "회수 불가",
    // Purity comparison
    "◆ PURITY COMPARISON": "◆ 순도 비교",
    "Purity Comparison": "순도 비교",
    // (v508) '(Silica Chain)' 부가 라벨 제거 — 운영자 요청. 캐시 호환용 옛 key 도 유지.
    "Mine #79907": "광산 #79907",
    "Mine #79907 (Silica Chain)": "광산 #79907",
    "Korea Avg.": "국내 평균",
    "Semiconductor Grade Standard": "반도체 등급 기준",
    "Semiconductor Grade Met": "반도체 등급 충족",
    "Mine #79907 meets the purity standards required for semiconductor wafer manufacturing.":
      "광산 #79907는 반도체 웨이퍼 제조에 요구되는 순도 기준을 충족합니다.",
    // Use cases
    "◆ END USES": "◆ 활용 분야",
    "Application Areas": "활용 분야",
    "Semiconductors": "반도체",
    "A core raw material for silicon wafers. Forms the foundation of all semiconductor chips, including memory, CPUs, and GPUs. Market growth is accelerating with rising demand for AI semiconductors.":
      "실리콘 웨이퍼의 핵심 원료. 메모리, CPU, GPU 등 모든 반도체 칩의 기반이 됩니다. AI 반도체 수요 증가로 시장이 빠르게 성장하고 있습니다.",
    "Optical Fiber": "광섬유",
    "Essential for telecommunications infrastructure. High-purity quartz is critical for 5G/6G backbone networks and data center optical cable manufacturing.":
      "통신 인프라의 필수 소재. 고순도 석영은 5G/6G 백본망 및 데이터센터 광케이블 제조에 핵심적입니다.",
    "Solar Power": "태양광",
    "Polysilicon raw material for solar panels. Global demand is surging with the expansion of renewable energy policies.":
      "태양광 패널용 폴리실리콘 원료. 재생에너지 정책 확대로 전 세계 수요가 급증하고 있습니다.",
    // Investment contract
    "◆ INVESTMENT CONTRACT": "◆ 투자 계약",
    "Investment Contract Details": "투자 계약 상세",
    "REPORT FREQ": "보고 주기",
    "Quarterly Operations Report": "분기별 운영 보고",
    "AUDIT": "감사",
    "Annual External Audit": "연 1회 외부 감사",
    "CONTRACT": "계약",
    // (2026-05-17 v462) 'Governed by Korean Law' 운영자 요청으로 제거. i18n 매핑은
    //   호환성 위해 보존 (다른 페이지에서 참조하는 경우 안전망).
    "Governed by Korean Law": "",
    // Document library
    "◆ DOWNLOADS": "◆ 다운로드",
    "Document Library": "문서 라이브러리",
    // Roadmap
    "◆ ROADMAP": "◆ 로드맵",
    "Roadmap": "로드맵",
    "Launch": "런칭",
    "2026 Q1 · Platform beta launch, KYC, Pre-sale start":
      "2026 1분기 · 플랫폼 베타 출시, KYC, 사전 판매 시작",
    "Build": "구축",
    "2026 Q2 · Public Sale, mining operations begin":
      "2026 2분기 · 공개 판매, 채굴 운영 시작",
    "Production": "생산",
    "2026 Q3-Q4 · Monthly mineral shipments, revenue generation":
      "2026 3~4분기 · 월간 광물 출하, 수익 발생",
    "Expansion": "확장",
    "2027 Q1 · Silica exchange listing, first annual dividend":
      "2027 1분기 · Silica 거래소 상장, 1차 연간 배당",
    // Key milestones
    "◆ MAJOR EVENTS": "◆ 주요 일정",
    "Key Milestones": "주요 마일스톤",
    "Public Sale Closes": "공개 판매 종료",
    "May close early upon reaching $1,000,000 fundraising target":
      "100만 달러 모집 목표 달성 시 조기 마감될 수 있습니다",
    "Full-Scale Mining Operations Begin": "본격 채굴 운영 개시",
    "Use-of-Funds report published (CapEx/Opex breakdown)":
      "자금 사용 보고서 공개 (CapEx/Opex 세부 내역)",
    "FY2026 Financial Closing": "FY2026 회계 결산",
    "First annual dividend after external audit (Silica token Distribution)":
      "외부 감사 후 1차 연간 배당 (Silica 토큰 분배)",
    "Silica Exchange Listing": "Silica 거래소 상장",
    "Simultaneous listing on domestic and international exchanges":
      "국내·해외 거래소 동시 상장",

    // ── (v866) 컨셉 전환: 채굴권 → 광물 제련 사업 ──
    // landing.html hero
    "Korean rare metal smelting operation — iridium & multi-metal recovery for semiconductor, AI, and aerospace. Monthly USDT fixed interest + annual dividend.":
      "한국의 희귀금속 제련 사업 — 이리듐 및 복합 금속 회수, 반도체·AI·우주항공 공급망 공급. 매월 USDT 고정 이자 + 연간 배당.",
    "Recovery": "회수율",
    "Capacity": "처리량",
    "METAL RECOVERY RATE": "금속 회수율",
    "REFINED PRODUCT": "정제 산출물",
    "TONS / YEAR": "톤 / 연",
    "IRIDIUM": "이리듐",
    "ORE Ir CONTENT": "원광 이리듐 함유량",

    // landing.html asset section
    "◆ THE UNDERLYING BUSINESS": "◆ 기초 사업",
    "Rare Metal": "희귀금속",
    "Smelting.": "제련.",
    "Iridium & Multi-Metal Recovery.": "이리듐 및 복합 금속 회수.",
    "// Recovery 95% · Refined Purity ≥99.9%":
      "// 회수율 95% · 정제 순도 ≥99.9%",
    "Smelting and refining of polymetallic ore — recovering iridium (Ir), gold (Au), silver (Ag), iron (Fe), and PGMs — for the global semiconductor, AI infrastructure, and aerospace supply chain. We issue Investment Certificates to fund smelting operations, and investors share in the operation's revenue.":
      "복합 광물에서 이리듐(Ir), 금(Au), 은(Ag), 철(Fe), PGM 을 제련·정제하여 글로벌 반도체, AI 인프라, 우주항공 공급망에 공급합니다. 투자증서(SilicaSTO)를 발행해 제련 사업 자금을 모으고, 투자자는 사업 수익을 함께 나눕니다.",
    "Operator": "운영사",
    "Silica Chain Holdings": "Silica Chain Holdings",
    "Annual Capacity": "연간 처리량",
    "15,000 t": "15,000 t",
    "Semiconductor · AI · Aerospace": "반도체 · AI · 우주항공",
    "◆ REFINED PURITY": "◆ 정제 순도",

    // landing.html yield/token
    "Monthly stable income + annual smelting performance dividend":
      "매월 안정적 수익 + 연 1회 제련 실적 배당",
    "Distributed in April~May after Korean fiscal year close. Smelting operation revenue is shared as Silica tokens and allocated only to investors actively staking on the payout date (15th).":
      "한국 회계연도 마감 이후 4~5월에 분배됩니다. 제련 사업 수익은 Silica 토큰으로 공유되며, 지급일(15일) 시점에 스테이킹 중인 투자자에게만 배정됩니다.",
    "An Investment Certificate issued when you invest in the smelting operation. Always pegged 1:1 to USDT. Designed to preserve principal stably.":
      "제련 사업에 투자하면 발행되는 투자증서. 항상 USDT와 1:1로 연동되며, 원금을 안정적으로 보존하도록 설계되었습니다.",

    // ir.html asset hero
    "◆ OPERATION · LOADING…": "◆ 사업 · 로딩 중…",
    "Smelting": "제련",
    "// Recovery 95% · Refined Purity ≥99.9% · 15,000 t/yr":
      "// 회수율 95% · 정제 순도 ≥99.9% · 연 15,000 t",
    "Korean rare metal smelting and refining operation specializing in iridium (Ir) recovery and multi-metal extraction (Au · Ag · Fe · PGMs) from polymetallic ore. Refined products supply global semiconductor, AI infrastructure, and aerospace markets.":
      "한국의 희귀금속 제련·정제 사업으로, 복합 광물에서 이리듐(Ir) 회수 및 복합 금속(Au · Ag · Fe · PGM) 추출을 전문으로 합니다. 정제 산출물은 글로벌 반도체, AI 인프라, 우주항공 시장에 공급됩니다.",
    "◆ FACILITY": "◆ 시설",
    "Facility & Overview": "시설 & 개요",
    "Smelting facility main image": "제련 시설 메인 이미지",
    "Facility location": "시설 위치",

    // ir.html operation info
    "Operation Information": "사업 정보",
    "Asset ID": "자산 ID",
    "Operation Identifier": "사업 식별자",
    "Ore Processing Throughput": "원광 처리 처리량",
    "Refined Purity": "정제 순도",
    "Semiconductor & Aerospace Grade": "반도체 & 우주항공 등급",
    "Recovery Rate": "회수율",
    "Multi-Metal Recovery": "복합 금속 회수",
    "Iridium Output": "이리듐 산출량",
    "10 t / yr": "연 10 t",
    "High-Value Rare Metal": "고부가 희귀금속",

    // ir.html ore content
    "◆ ORE CONTENT": "◆ 원광 함유량",
    "Polymetallic Ore Composition": "복합 광물 구성",
    "Iron (Fe) makes up the largest mass share, while iridium (Ir) — concentrated at 11% — drives the bulk of refined-output value.":
      "철(Fe)이 질량 기준 가장 큰 비중을 차지하지만, 11%로 농축된 이리듐(Ir)이 정제 산출물 가치의 대부분을 만들어냅니다.",
    "IRIDIUM (Ir)": "이리듐 (Ir)",
    "IRON (Fe)": "철 (Fe)",

    // ir.html refined output
    "◆ REFINED OUTPUT": "◆ 정제 산출",
    "Refined Purity Comparison": "정제 순도 비교",
    "Silica Chain Refined Output": "Silica Chain 정제 산출",
    "Industry Average Refined": "업계 평균 정제",
    "Semiconductor & Aerospace Grade Met": "반도체 & 우주항공 등급 충족",
    "Silica Chain refined output meets the purity standards required for semiconductor and aerospace component manufacturing.":
      "Silica Chain 정제 산출물은 반도체 및 우주항공 부품 제조에 요구되는 순도 기준을 충족합니다.",

    // ir.html application areas (반도체/AI/우주항공)
    "Iridium and PGM target materials for patterning and deposition equipment, plus high-purity refined output for advanced chip processes. Demand accelerating with AI chip growth.":
      "패터닝/증착 장비용 이리듐 및 PGM 타깃 소재와 첨단 칩 공정용 고순도 정제 산출물. AI 반도체 성장과 함께 수요 가속.",
    "AI Data Centers": "AI 데이터센터",
    "Heat-resistant electrode coatings and power-thermal management materials for high-performance AI infrastructure. Demand surging with hyperscaler buildouts.":
      "고성능 AI 인프라용 내열 전극 코팅 및 전력/열관리 소재. 하이퍼스케일러 증설과 함께 수요 급증.",
    "Aerospace": "우주항공",
    "Ultra-high-temperature alloys, catalysts, and structural coatings for spacecraft and next-generation propulsion. Iridium's heat resistance is irreplaceable in this segment.":
      "우주선 및 차세대 추진 시스템용 초고온 합금, 촉매, 구조 코팅. 이리듐의 내열성은 이 분야에서 대체 불가합니다.",

    // ir.html roadmap/timeline (v866)
    "2026 Q2 · Public Sale, pilot smelting line expansion":
      "2026 Q2 · 공개 판매, 파일럿 제련 라인 증설",
    "2026 Q3-Q4 · First offtake contracts, refined product shipments":
      "2026 Q3-Q4 · 첫 오프테이크 계약, 정제 산출물 출하",
    "2027 Q1 · Commercial smelting plant live, Silica exchange listing, first annual dividend":
      "2027 Q1 · 상업 제련 플랜트 가동, Silica 거래소 상장, 첫 연간 배당",
    "Pilot Smelting Line Expansion Begins": "파일럿 제련 라인 증설 개시",

    // ── staking.html (2026-05-12 v290) ──
    "◆ EARN MONTHLY USDT + ANNUAL DIVIDEND": "◆ 매월 USDT + 연 1회 배당",
    "Stake SilicaSTO and receive monthly USDT interest. Plus an annual Silica dividend.":
      "SilicaSTO를 스테이킹하고 매월 USDT 이자를 받으세요. 추가로 연 1회 Silica 배당이 지급됩니다.",
    "// CURRENT FIXED RATE": "// 현재 적용 이자율",
    "Auto USDT payout on the 15th of each month":
      "매월 15일 USDT 자동 지급",
    "Staking": "스테이킹",
    "Unstaking": "언스테이킹",
    "Stake Amount (SilicaSTO)": "스테이킹 수량 (SilicaSTO)",
    "Unstake Amount (SilicaSTO)": "언스테이킹 수량 (SilicaSTO)",
    "MAX": "최대",
    "SILICASTO": "SILICASTO",
    "◆ Expected Yield": "◆ 예상 수익",
    "Monthly Interest (USDT)": "월 이자 (USDT)",
    "Annual Interest (USDT)": "연 이자 (USDT)",
    "Annual Dividend (Silica, variable)": "연 배당 (Silica, 변동)",
    "Interest payouts begin from the next cycle (the 15th payout date) after staking.":
      "이자는 스테이킹 다음 회차(15일 지급일)부터 자동 지급됩니다.",
    "Recent Cycle History": "최근 회차 내역",
    "View All →": "전체 보기 →",
    "No cycles have been paid out yet.": "아직 지급된 회차가 없습니다.",
    "◆ MY STAKING": "◆ 내 스테이킹",
    "Interest Claim": "이자 클레임",
    "Pending": "대기 중",
    "— rounds": "— 회차",
    "Active": "활성",
    "— No cycle info": "— 회차 정보 없음",
    "The cycle starts after you begin staking":
      "스테이킹 시작 후 회차가 진행됩니다",

    // ── deposit.html / withdraw.html (2026-05-12 v291) ──
    "Select Token": "토큰 선택",
    "USDT (Solana)": "USDT (Solana)",
    "Integer amounts only.": "정수 금액만 입력 가능합니다.",
    "Most Recent Deposit Rejected": "최근 입금 반려됨",
    "The deposit above was rejected by the administrator.":
      "위 입금이 관리자에 의해 반려되었습니다.",
    "View Reason": "사유 보기",
    "Pending Deposits": "입금 대기 중",
    "External Manual Deposits Prohibited": "외부 수동 입금 금지",
    "Do not send tokens directly to this address from an external wallet.":
      "외부 지갑에서 이 주소로 토큰을 직접 전송하지 마세요.",
    "Manual external transfers are not automatically tracked by the system and will not be reflected in your balance.":
      "수동 외부 송금은 시스템에서 자동으로 추적되지 않으며 잔액에 반영되지 않습니다.",
    "Transfers must be performed from a connected wallet through the site's deposit function to be processed correctly.":
      "정상 처리를 위해서는 연결된 지갑에서 사이트의 입금 기능을 통해 송금해야 합니다.",
    // withdraw.html
    "← Back to Wallet": "← 지갑으로 돌아가기",
    "Send tokens to your connected Solana wallet.":
      "연결된 Solana 지갑으로 토큰을 전송합니다.",
    "Token to Withdraw": "출금할 토큰",
    "Withdraw available (idle) balance only. Staked tokens must be unstaked first.":
      "출금은 사용 가능한(스테이킹되지 않은) 잔액만 가능합니다. 스테이킹된 토큰은 먼저 언스테이킹해야 합니다.",
    "Recipient Solana Address": "받는 Solana 주소",
    "Auto-filled after wallet connection": "지갑 연결 후 자동 입력됩니다",
    "Withdrawals are processed only to your connected wallet (cannot be changed).":
      "출금은 연결된 지갑으로만 처리됩니다 (변경 불가).",
    "Withdrawal Amount (Integers only)": "출금 수량 (정수만)",
    "Integer values only": "정수만 입력 가능",
    "OTP Code": "OTP 코드",
    "6-digit OTP": "6자리 OTP",
    "Withdrawal Amount": "출금 수량",
    "Platform Fee": "플랫폼 수수료",
    "You Receive": "수령 금액",
    "Staked Tokens": "스테이킹된 토큰",
    "Available to withdraw is your idle (non-staked) balance only.":
      "출금 가능한 금액은 스테이킹되지 않은 사용 가능 잔액만입니다.",
    "Submit Withdrawal": "출금 신청",
    "Pending Withdrawals": "출금 대기 중",

    // ── 재검수 후 추가 (2026-05-12 v292) ──
    // swap.html
    "FROM (You Pay)": "보내는 토큰 (지불)",
    "TO (You Receive)": "받는 토큰 (수령)",
    "Your USDT (for fee)": "수수료용 USDT 잔액",
    "Type the FROM amount to fetch the latest swap rate.":
      "보낼 수량을 입력하면 최신 환율을 받아옵니다.",
    // ir.html
    "Invest Now": "지금 투자하기",
    "Download Documents": "문서 다운로드",
    "Complete": "완료",
    "In Progress": "진행 중",
    "Upcoming": "예정",
    // landing.html 호환 — case variant
    "Order book": "오더북",
    // referral.html
    "Bonuses are automatically paid in USDT on the 15th of each month.":
      "보너스는 매월 15일에 USDT로 자동 지급됩니다.",

    // ── profile.html (2026-05-12 v293) ──
    "◆ ACCOUNT SETTINGS": "◆ 계정 설정",
    "My Profile": "내 프로필",
    "— (Wallet Connection Required)": "— (지갑 연결 필요)",
    "KYC PENDING": "KYC 대기",
    "▸ Basic Information": "▸ 기본 정보",
    "▸ Security / OTP": "▸ 보안 / OTP",
    "▸ KYC Status": "▸ KYC 상태",
    "▸ Notification Settings": "▸ 알림 설정",
    "▸ Language": "▸ 언어",
    "▸ Activity Log": "▸ 활동 기록",
    "▸ Logout": "▸ 로그아웃",
    "Basic Information": "기본 정보",
    "Name": "이름",
    "Name (Auto-filled after KYC verification)": "이름 (KYC 인증 완료 시 자동 입력)",
    "Email": "이메일",
    "Phone Number": "전화번호",
    "Country": "국가",
    "South Korea": "대한민국",
    "Save": "저장",
    "Security Settings": "보안 설정",
    "Two-Factor Authentication (Google OTP)": "2단계 인증 (Google OTP)",
    "OTP code required for login & withdrawal": "로그인 및 출금 시 OTP 코드 필요",
    "Withdrawal Notifications": "출금 알림",
    "Email Notification on withdrawal": "출금 시 이메일 알림",
    "Login Notifications": "로그인 알림",
    "Notify on new device login": "새 기기 로그인 시 알림",
    "Connected Wallet": "연결된 지갑",
    "Phantom Wallet": "Phantom 지갑",
    "— (Not Connected)": "— (연결되지 않음)",
    "Not Connected": "연결되지 않음",

    // ── kyc-certification.html (2026-05-12 v293) ──
    "◆ IDENTITY VERIFICATION · POWERED BY DIDIT": "◆ 신원 인증 · DIDIT 제공",
    "KYC Verification": "KYC 인증",
    "Identity verification is required to begin investing.":
      "투자를 시작하려면 신원 인증이 필요합니다.",
    "Account Creation": "계정 생성",
    "ID Verification": "신분증 인증",
    "Face Verification": "얼굴 인증",
    "Upload ID Document": "신분증 업로드",
    "Please upload a Korean Resident Registration Card, Driver's License, or Passport.":
      "주민등록증, 운전면허증 또는 여권을 업로드하세요.",
    "Upload Front of ID": "신분증 앞면 업로드",
    "Upload Back of ID": "신분증 뒷면 업로드",
    "JPG, PNG · Max 5MB": "JPG, PNG · 최대 5MB",
    "Privacy Protection": "개인정보 보호",
    "Uploaded ID Documents are used solely for KYC Verification and are stored securely encrypted.":
      "업로드된 신분증은 KYC 인증 용도로만 사용되며 암호화되어 안전하게 보관됩니다.",
    "Next Step →": "다음 단계 →",

    // ── kyc-ready.html (2026-05-12 v293) ──
    "KYC Basic Information": "KYC 기본 정보",
    "Your name and date of birth will be used for KYC Verification. Once saved, this information cannot be changed.":
      "성명과 생년월일은 KYC 인증에 사용되며, 저장 후에는 변경할 수 없습니다.",
    "Notice": "안내",
    "If the information you enter does not match your ID Document, withdrawals may be restricted.":
      "입력한 정보가 신분증과 일치하지 않으면 출금이 제한될 수 있습니다.",
    "Full Name": "성명",
    "Enter your legal name": "법적 성명을 입력하세요",
    "Date of Birth": "생년월일",
    "Format: YYYY-MM-DD": "형식: YYYY-MM-DD",
    "Confirm": "확인",
    "Back": "뒤로",
    "Processing...": "처리 중...",

    // ── kyc-return.html (2026-05-12 v293) ──
    "KYC Verification Complete": "KYC 인증 완료",
    "Verifying your authentication result. You will be redirected to the KYC Verification page shortly.":
      "인증 결과를 확인하고 있습니다. 잠시 후 KYC 인증 페이지로 이동합니다.",
    "Return to KYC Page": "KYC 페이지로 돌아가기",

    // ── sale-detail.html / sales.html (2026-05-12 v294) ──
    "Sale": "매각",
    "Liquidated assets are available for exchange. After depositing tokens, you will receive USDT based on the exchange rate per token.":
      "매각된 자산은 USDT로 교환할 수 있습니다. 토큰 입금 시 토큰당 환율 기준으로 USDT가 지급됩니다.",
    "(Tokens are permanently burned upon deposit.)":
      "(입금된 토큰은 영구 소각됩니다.)",
    "List": "목록",
    "Initial Investment": "초기 투자금",
    "Sale Amount": "매각 금액",
    "Expenses": "비용",
    "Platform User Allocation Total (USDT)": "플랫폼 사용자 배분 합계 (USDT)",
    "Project Net Inflow": "프로젝트 순유입",
    "Exchange Rate per Token": "토큰당 환율",
    "1 TOKEN =": "1 TOKEN =",
    "FX (reference):": "환율 (참고):",
    "Platform User Allocation Total:": "플랫폼 사용자 배분 합계:",
    "Token Supply:": "토큰 발행량:",
    "* User settlement is calculated based on the total Platform User Allocation (USDT), including amounts already paid out. The exchange rate per token is calculated as Platform User Allocation Total ÷ Total Issued Tokens, and tokens are permanently burned upon deposit.":
      "* 사용자 정산은 이미 지급된 금액을 포함한 플랫폼 사용자 배분 총액(USDT)을 기준으로 계산됩니다. 토큰당 환율은 플랫폼 사용자 배분 합계 ÷ 총 발행 토큰 수로 산정되며, 입금된 토큰은 영구 소각됩니다.",
    "Token Exchange": "토큰 교환",
    "My Holdings": "내 보유 수량",
    "Token Deposit Amount": "토큰 입금 수량",
    "e.g., 10": "예: 10",
    "Only whole numbers may be entered for token deposit. Tokens are permanently burned upon deposit, and USDT equal to the deposited amount × exchange rate per token will be paid out.":
      "토큰 입금은 정수만 입력할 수 있습니다. 입금된 토큰은 영구 소각되며, 입금 수량 × 토큰당 환율에 해당하는 USDT가 지급됩니다.",
    "Max": "최대",
    "Exchange to USDT (Burn Tokens)": "USDT로 교환 (토큰 소각)",
    "Estimated Proceeds": "예상 수령액",
    "Remaining Exchangeable:": "남은 교환 가능액:",
    "Sale Execution Date:": "매각 실행일:",
    "Accountant Official Documents": "회계 공식 문서",
    "Document": "문서",
    "Upload": "업로드",
    "View": "보기",
    "No documents registered.": "등록된 문서가 없습니다.",
    "Proceeds History": "수령 내역",
    "Deposit (Burned)": "입금 (소각)",
    "Local Amount (Ref.)": "현지 통화 (참고)",
    "Received (USDT)": "수령 (USDT)",
    "No history.": "내역이 없습니다.",
    // Footer links
    "About": "소개",
    "Assets": "자산",
    "Markets": "마켓",
    "Admin": "관리자",
    "Investment products carry the risk of principal loss, and prices and returns may fluctuate. The information shown on this page is for guidance only.":
      "투자 상품은 원금 손실 위험이 있으며 가격과 수익은 변동될 수 있습니다. 이 페이지의 정보는 참고용입니다.",
    // sales.html
    "Review exchange terms and proceeds for assets that have been sold.":
      "매각된 자산의 교환 조건과 수령 내역을 확인하세요.",
    "Settlement Notice": "정산 안내",
    "Platform users receive settlement based on the platform user allocation total.":
      "플랫폼 사용자는 플랫폼 사용자 배분 총액 기준으로 정산을 받습니다.",
    "The exchange rate per token is calculated as Platform User Allocation Total (USDT) ÷ Total Issued Tokens. Local currency conversion values are shown for reference only.":
      "토큰당 환율은 플랫폼 사용자 배분 합계(USDT) ÷ 총 발행 토큰 수로 계산됩니다. 현지 통화 환산 값은 참고용입니다.",

    // ── assets.html — 펀딩 폼 (2026-05-12 v295) ──
    "Sale Temporarily Suspended": "판매 일시 중단",
    "The maximum SilicaSTO sale quantity has been reached. New investment applications are temporarily paused. Please check back later — the cap may be raised by the administrator.":
      "최대 SilicaSTO 판매 수량에 도달하여 신규 투자 신청이 일시적으로 중단되었습니다. 관리자가 판매 한도를 늘리는 경우 다시 신청할 수 있습니다.",
    "Investment Amount (USDT)": "투자 금액 (USDT)",
    "SilicaSTO to Receive": "받을 SilicaSTO",
    "@ — USDT Phase (per admin configuration)":
      "@ — USDT 회차 (관리자 설정 기준)",
    "Investment Amount": "투자 금액",
    "SilicaSTO Issued": "발행 SilicaSTO",
    "Total": "합계",
    "Not Created": "미작성",
    "Create Electronic Contract": "전자계약서 작성",
    "View Contract": "계약서 보기",
    "Recreate": "재작성",
    "Enter 6-digit OTP": "6자리 OTP 입력",
    "Referral Code (Optional)": "추천 코드 (선택)",
    "Enter referral code": "추천 코드 입력",
    "Apply": "적용",
    "Can only be set before your first participation.":
      "첫 참여 전에만 설정할 수 있습니다.",
    "💰 Insufficient USDT balance": "💰 USDT 잔액 부족",
    "You must deposit USDT first to participate.":
      "참여하려면 먼저 USDT를 입금해야 합니다.",
    "Current balance:": "현재 잔액:",
    "Go to USDT Deposit →": "USDT 입금하러 가기 →",
    // Yield Scenario card
    // (2026-05-18 v472) 운영자 요청: '투자에만 참여해서는 이자/배당 지급
    //   안 됨 — 스테이킹 했을 때 예상되는 이자' 라고 명시. 기존 '월 이자'
    //   / '매월 고정 USDT 이자' 등 무조건적 표현 폐기.
    "Estimated Yield (When Staked)": "예상 수익 (스테이킹 시)",
    // (2026-05-22 v773) HTML 에서 'Estimated Yield' / '(When Staked)' 두 span 으로
    //   분리 (모바일에서 (When Staked) 가 다음 줄로 표시되도록). TreeWalker 가
    //   text node 단위로 번역하므로 각 부분 별도 매핑 필요.
    "Estimated Yield": "예상 수익",
    "(When Staked)": "(스테이킹 시)",
    "// Interest and dividend are paid only when the issued SilicaSTO is staked. Figures are estimates based on the entered amount.":
      "// 이자와 배당은 발행받은 SilicaSTO를 스테이킹 했을 때에만 지급됩니다. 입력 금액 기준 예상치입니다.",
    "Estimated Monthly Interest": "예상 월 이자",
    "— Annualized · 15th of each month · Staking required":
      "— 연 이자 기준 · 매월 15일 · 스테이킹 필요",
    "Estimated Annual Interest": "예상 연간 이자",
    "12-month total · Assumes continuous staking · Rate may change per cycle":
      "12개월 합계 · 지속 스테이킹 가정 · 회차별 요율 변동 가능",
    "Annual Dividend (Variable)": "연간 배당 (변동)",
    // (2026-05-18 v473) 운영자 정정: '매출' → '배당 가능한 수익'.
    //   매출 (revenue) 은 top-line 이며 비용 차감 전. 배당은 distributable
    //   profit (배당 가능한 수익) 발생 시에만 분배되므로 정확한 표현.
    "Paid only when distributable profit is generated (Silica)":
      "배당 가능한 수익 발생 시에만 지급 (Silica)",
    // 폐기된 옛 key — 캐시 호환용
    "Paid only when the mine generates revenue (Silica)":
      "광산 매출 발생 시에만 지급 (Silica)",
    // 폐기된 옛 key 들 — 캐시된 페이지의 텍스트가 잘못 번역되지 않도록 매핑
    //   유지 (정확성 떨어지지만 매핑 자체는 정상). 페이지 캐시 만료 후 자연
    //   소멸. 새 페이지는 위 문구만 사용.
    "Yield Scenario": "수익 시나리오",
    "// Based on entered amount": "// 입력한 금액 기준",
    "Monthly Interest": "월 이자",
    "— Annualized · 15th of each month": "— 연 이자 기준 · 매월 15일",
    "Annual Cumulative Interest": "연간 누적 이자",
    "12-month total": "12개월 합계",
    "Mine Revenue Distribution (Silica)": "광산 수익 분배 (Silica)",
    // Investor Benefits card
    "Investor Benefits": "투자자 혜택",
    "▲ Monthly USDT interest when SilicaSTO is staked (rate set per cycle by administrator)":
      "▲ SilicaSTO 스테이킹 시 월 USDT 이자 (요율은 관리자가 회차별 설정)",
    // (2026-05-18 v473) 운영자 정정: '광산 매출' → '배당 가능한 수익'.
    "▲ Annual Silica dividend, distributed only when distributable profit is generated":
      "▲ 연간 Silica 배당, 배당 가능한 수익 발생 시에만 분배",
    // 폐기된 옛 key — 캐시 호환용
    "▲ Annual Silica dividend, distributed only when the mine generates revenue":
      "▲ 연간 Silica 배당, 광산 매출 발생 시에만 분배",
    // 폐기된 옛 key 들 — 캐시 호환용
    "▲ Monthly fixed USDT interest": "▲ 매월 고정 USDT 이자",
    "▲ Annual mine revenue dividend (Silica)":
      "▲ 연간 광산 수익 배당 (Silica)",
    // Mineral 3D card
    "Silica Mineral · SiO₂": "실리카 광물 · SiO₂",
    "High-Purity Quartz Crystal": "고순도 석영 결정",
    "Hexagonal lattice · 97.04% SiO₂ purity":
      "육각 격자 구조 · SiO₂ 순도 97.04%",
    "Mining License #79907 · Korea": "광업권 #79907 · 대한민국",
    // Page header (asset info strip is already covered via landing entries)
    "◆ INVESTMENT CERTIFICATE TOKEN SALE": "◆ 투자증서 토큰 판매",
    "Mining License #79907": "광업권 #79907",
    "STO Investment": "STO 투자",

    // ── assets.html — contract modal (2026-05-12 v295) ──
    "Electronic Contract": "전자계약서",
    "Investment subscription electronic contract review and handwritten signature":
      "투자 청약 전자계약서 검토 및 친필 서명",
    "Contract Details": "계약 상세",
    "Asset": "자산",
    "Subscription Amount": "청약 금액",
    "Contract Number": "계약번호",
    "Signature Information": "서명 정보",
    "Signer Name": "서명자 이름",
    "Enter your real name": "실명을 입력하세요",
    "I agree to the viewing and storage of the investment subscription contract in electronic document form.":
      "투자 청약 계약서를 전자 문서 형태로 열람·보관하는 데 동의합니다.",
    "I confirm that the handwritten electronic signature below represents my expression of intent regarding this contract.":
      "아래 친필 전자 서명이 본 계약에 대한 본인의 의사 표시임을 확인합니다.",
    "Handwritten Electronic Signature": "친필 전자 서명",
    "Clear Signature": "서명 지우기",
    "* Sign directly with mouse or touch.": "* 마우스 또는 터치로 직접 서명하세요.",
    "User Signature Information": "사용자 서명 정보",
    "The contract will be finalized once the administrator completes the final handwritten signature on the asset detail page.":
      "관리자가 자산 상세 페이지에서 최종 친필 서명을 완료하면 계약이 확정됩니다.",
    "Processing Order": "진행 순서",
    "1) Review contract details": "1) 계약 상세 검토",
    "2) Complete handwritten electronic signature": "2) 친필 전자 서명 완료",
    "3) OTP re-verification at funding participation":
      "3) 투자 참여 시 OTP 재인증",
    "4) Awaiting administrator's handwritten signature":
      "4) 관리자 친필 서명 대기",
    "Complete Signature": "서명 완료",

    // ── assets.html — contract history modal (2026-05-12 v295) ──
    "Contract Submission & Execution History": "계약 제출 및 체결 이력",
    "View all contracts submitted or executed for this product.":
      "이 상품에 대해 제출되거나 체결된 모든 계약을 확인할 수 있습니다.",
    "Select a contract to view its details.":
      "계약을 선택하여 상세 내용을 확인하세요.",
    "No contract history.": "계약 이력이 없습니다.",

    // ── assets.html — document view modal (2026-05-12 v295) ──
    "Supporting Documents": "증빙 문서",
    "Loading document...": "문서를 불러오는 중...",
    "Open in new tab": "새 탭에서 열기",

    // ── trade.html (2026-05-12 v296) ──
    // Pair stats strip
    "PRICE": "가격",
    "24H CHANGE": "24시간 변동",
    "24H VOLUME": "24시간 거래량",
    "24H HIGH": "24시간 고가",
    // Chart view tabs
    "Chart": "차트",
    "Peg & Trades": "페그 & 체결",
    "Last:": "최근:",
    "Zoom": "확대",
    "No chart data": "차트 데이터 없음",
    "Will be displayed automatically when trades occur":
      "거래 발생 시 자동으로 표시됩니다",
    // Peg view stats
    "24h Volume": "24시간 거래량",
    "24h Trades": "24시간 체결 수",
    "Spread": "스프레드",
    // Recent trades
    "◆ RECENT TRADES": "◆ 최근 체결",
    "No recent trades.": "최근 체결이 없습니다.",
    // Order book columns
    "Price (USDT)": "가격 (USDT)",
    "Amount (STO)": "수량 (STO)",
    "No sell orders": "매도 주문 없음",
    "No buy orders": "매수 주문 없음",
    // Order form tabs / inputs
    "Buy": "매수",
    "Sell": "매도",
    "Limit Order": "지정가 주문",
    "Market Order": "시장가 주문",
    "Limit": "지정가",
    "Market": "시장가",
    "Price (USDT)": "가격 (USDT)",
    "Price (USDT) · 2 decimal places": "가격 (USDT) · 소수점 2자리",
    "e.g., 0.05, 1.23 (3 or more decimal places not allowed)":
      "예: 0.05, 1.23 (소수점 3자리 이상 불가)",
    "Amount (SilicaSTO) · Integers only": "수량 (SilicaSTO) · 정수만",
    "e.g., 1, 100, 1000 (decimals not allowed)":
      "예: 1, 100, 1000 (소수점 불가)",
    "Amount (SilicaSTO)": "수량 (SilicaSTO)",
    "Market Price": "시장가",
    // Order summary
    "Holdings": "보유",
    "Min trade fee: 0.001 USDT": "최소 거래 수수료: 0.001 USDT",
    // My open orders
    "My Open Orders": "내 미체결 주문",
    "History →": "내역 →",
    "Filled": "체결됨",
    "No open orders.": "미체결 주문이 없습니다.",
    // Trade confirm modal
    "Order": "주문",
    "BUY · MARKET": "매수 · 시장가",
    "SELL · MARKET": "매도 · 시장가",
    "BUY · LIMIT": "매수 · 지정가",
    "SELL · LIMIT": "매도 · 지정가",
    "Cancel": "취소",
    // Trade result modal
    "Order placed": "주문 등록 완료",
    "OK": "확인",

    // ── swap.html — firm-quote modal + success modal (2026-05-12 v296) ──
    "Confirm Swap": "스왑 확인",
    "You're about to swap at the firm rate below. This rate is locked for the next 8 seconds — confirm before the timer ends.":
      "아래 확정 환율로 스왑을 진행합니다. 환율은 다음 8초 동안 잠금되며, 만료 전에 확인 버튼을 눌러주세요.",
    "You receive": "수령 금액",
    "You pay": "지불 금액",
    "Locked rate": "잠금 환율",
    "Silica price": "Silica 시세",
    "Swap fee": "스왑 수수료",
    "USDT balance after swap": "스왑 후 USDT 잔액",
    "⏱ Expires in 8s": "⏱ 8초 후 만료",
    "Swap Successful": "스왑 성공",
    "Paid": "지불",
    "Received": "수령",
    "USDT balance": "USDT 잔액",

    // ── kyc-ready.js / kyc-certification.js JS strings (2026-05-12 v297) ──
    // kyc-ready.js
    "KYC verification is already complete.": "이미 KYC 인증이 완료되어 있습니다.",
    "Continue": "계속",
    "Next Step": "다음 단계",
    "Failed to load KYC status.": "KYC 상태를 불러오지 못했습니다.",
    "Please enter your name.": "성명을 입력하세요.",
    "Please enter your date of birth.": "생년월일을 입력하세요.",
    "Saving basic information...": "기본 정보를 저장하는 중입니다...",
    "Basic information saved.": "기본 정보가 저장되었습니다.",
    "Basic information is already saved.": "이미 저장된 기본 정보가 있습니다.",
    "Failed to save basic information.": "기본 정보 저장 실패",
    // kyc-certification.js
    "Please enter your basic information first.": "기본 정보를 먼저 입력하세요.",
    "Failed to load KYC information.": "KYC 정보를 불러오지 못했습니다.",
    "Start Verification": "인증 시작",
    "Checking verification...": "인증 확인중...",
    // 'Processing...' 매핑은 kyc-ready.html 섹션(상단)에서 이미 등록됨.
    "Opening the verification window...": "인증 화면을 여는 중입니다.",
    "Verifying your authentication result.": "인증 결과를 확인하는 중입니다.",
    "Please wait a moment.": "잠시만 기다려주세요.",
    "Current status:": "현재 상태:",
    "In Progress": "진행중",
    "If the not-started state persists, please retry after about {sec} seconds.":
      "미시작 상태가 길면 약 {sec}초 후 다시 시도하세요.",
    "If the review state persists, please retry after about {sec} seconds.":
      "검토 상태가 길면 약 {sec}초 후 다시 시도하세요.",
    "KYC verification completed.": "KYC 인증이 완료되었습니다.",
    "KYC verification was not completed.": "KYC 인증이 완료되지 않았습니다.",
    "Date of birth does not match. Please verify your basic information.":
      "생년월일이 일치하지 않습니다. 기본 정보를 다시 확인하세요.",
    "Name does not match. Please verify your basic information.":
      "성명이 일치하지 않습니다. 기본 정보를 다시 확인하세요.",
    "Verification was not approved. Please try again.":
      "인증이 승인되지 않았습니다. 다시 시도하세요.",
    "KYC provider credits are insufficient. Please contact the administrator.":
      "KYC 공급자 크레딧이 부족합니다. 관리자에게 문의하세요.",
    "Please select an ID document type.": "신분증 종류를 선택하세요.",
    "Please try again in a moment.": "잠시 후 다시 시도하세요.",
    "Failed to start KYC.": "KYC 시작 실패",

    // (2026-05-18 v580) v570 에서 추가한 "Verification in Progress" 패널
    //   문장들 — 사전 등록 누락으로 부분 번역 (예: "VERIFICATION IN 진행률")
    //   문제가 발생. 완전한 문장 단위로 매핑 추가.
    //   kyc-certification.html in-progress panel:
    "Verification in Progress": "인증 진행 중",
    "Your identity submission has been received and is currently being reviewed by our verification provider and our team. This usually takes a few minutes, but in some cases can take several hours.":
      "신원 인증 제출이 접수되어 인증 공급자와 운영팀이 검토하고 있습니다. 보통 몇 분 안에 완료되지만, 경우에 따라 몇 시간이 소요될 수 있습니다.",
    "You do not need to keep this page open. When the review is complete your account will be automatically approved and you can begin investing.":
      "이 페이지를 열어두지 않아도 됩니다. 검토가 완료되면 계정이 자동으로 승인되어 투자를 시작할 수 있습니다.",
    "Provider status": "공급자 상태",
    "Under review": "검토 중",
    "Session": "세션",
    "Your review is taking longer than usual. If this persists for more than 24 hours, please contact support.":
      "검토가 평소보다 오래 걸리고 있습니다. 24시간 이상 지속되면 운영팀에 문의하세요.",
    "Refresh": "새로고침",
    "Return to Dashboard": "대시보드로 돌아가기",

    // kyc-return.html (v570/v580):
    "Submission Received": "제출 완료",
    "Your identity verification has been submitted. Our provider and team will review it shortly. You will be redirected to the KYC page to monitor progress.":
      "신원 인증이 제출되었습니다. 인증 공급자와 운영팀이 곧 검토합니다. 진행 상황을 확인하실 수 있도록 KYC 페이지로 이동합니다.",
    "Continue to KYC Page": "KYC 페이지로 이동",

    // (2026-05-18 v581) didit 가 API 응답에서 직접 보내는 status 문자열 —
    //   사용자 화면에 그대로 노출되는 값이므로 한글로 매핑. v581 에서
    //   $diditStatus 가 status_overall 우선으로 바뀌면서 "In Review" 같은
    //   세션 상태 문자열이 그대로 보임 → 사전 매핑 없으면 영어 그대로 남음.
    "In Review": "검토 중",
    "Approved": "승인",
    "Declined": "거절",
    "Not Started": "시작 전",
    "Expired": "만료",
    "Abandoned": "중단됨",
    "Kyc Expired": "KYC 만료",

    // (2026-05-19 v582) Verification Rejected 패널 — kyc-certification.html
    //   에서 didit 거부 / mismatch / no_credits 등 terminal 실패 상태일 때
    //   폼 대신 표시되는 카드. 신청일/거부일 정보와 함께 재제출 안내.
    "Verification Rejected": "인증 거부됨",
    "Your identity verification was not approved by our verification provider. Please review the details below and resubmit with the correct information.":
      "신원 인증이 인증 공급자로부터 승인되지 않았습니다. 아래 정보를 확인하고 올바른 정보로 다시 제출해 주세요.",
    "Your submitted name didn't match the name extracted from your ID document. Please correct your basic information and resubmit.":
      "제출하신 이름이 신분증에서 추출된 이름과 일치하지 않습니다. 기본 정보를 정정한 후 다시 제출해 주세요.",
    "Your submitted date of birth didn't match the value extracted from your ID document. Please correct your basic information and resubmit.":
      "제출하신 생년월일이 신분증에서 추출된 값과 일치하지 않습니다. 기본 정보를 정정한 후 다시 제출해 주세요.",
    "Our verification provider's credits are exhausted and your submission could not be processed. Please contact support.":
      "인증 공급자의 크레딧이 소진되어 신청을 처리할 수 없습니다. 운영팀에 문의해 주세요.",
    "Submitted": "신청일",
    "Rejected": "거부일",
    "Reason": "사유",
    "Not approved": "승인되지 않음",
    "Name didn't match the ID document": "이름이 신분증과 일치하지 않음",
    "Date of birth didn't match the ID document": "생년월일이 신분증과 일치하지 않음",
    "Provider credits exhausted": "공급자 크레딧 소진",
    "Resubmit": "다시 제출",
    "Edit Info": "정보 수정",
    "Contact Support": "운영팀 문의",

    // ── core.js wallet / OTP toasts (2026-05-12 v298) ──
    // OTP modal text
    "OTP is locked. Please retry after {sec}s.":
      "OTP가 잠겨 있습니다. {sec}초 후 재시도하세요.",
    "OTP setup is required.": "OTP 등록이 필요합니다.",
    "QR generation unavailable (use the manual setup key)":
      "QR 생성 불가 (수동 등록 키 사용)",
    "OTP setup preparation failed.": "OTP 등록 준비 실패",
    "OTP verification is required.": "OTP 인증이 필요합니다.",
    "Please enter the 6-digit OTP code.": "OTP 6자리를 입력하세요.",
    "OTP setup failed.": "OTP 등록 실패",
    "OTP verification failed.": "OTP 인증 실패",
    // Wallet connect / disconnect
    "Failed to load the wallet connection module. Please refresh the page.":
      "지갑 연결 모듈을 불러오지 못했습니다. 페이지를 새로고침 해주세요.",
    "Wallet selection failed.": "지갑 선택 실패",
    "Failed to connect {wallet}.": "{wallet} 연결에 실패했습니다.",
    "Wallet signature failed.": "지갑 서명에 실패했습니다.",
    "Wallet connected.": "지갑이 연결되었습니다.",
    "Wallet connection failed.": "지갑 연결 실패",
    "Failed to disconnect wallet.": "지갑 해제 실패",
    "Wallet account changed — logging out.": "지갑 계정이 변경되어 로그아웃됩니다.",
    "Wallet disconnected — logging out.": "지갑 연결이 해제되어 로그아웃됩니다.",
  },
  "ja": {
    "Asset List": "資産一覧",
    "Select Asset": "資産を選択",
    "Selected Asset": "選択資産",
    "Token Information": "トークン情報",
    "Token Name": "トークン名",
    "Token Symbol": "トークン略号",
    "Settlement Currency": "精算通貨",
    "SETTLEMENT CURRENCY": "精算通貨",
    "Total Supply": "総発行量",
    "My Distributed": "自分の配布完了",
    "Locked FX": "確定為替",
    "Claim Guide": "受取案内",
    "Claim Tip": "受取ヒント",
    "Staked Amount": "ステーキング数量",
    "Unstaked Amount": "アンステーキング数量",
    "Payout Date": "支給日",
    "Estimated Interest": "予想利息",
    "Estimated Interest History": "予想利息内訳",
    "Claim History": "受取履歴",
    "Month / Batch": "月 / 回次",
    "FX": "為替",
    "Search Tradable Assets": "取引可能資産を検索",
    "Last Trade": "最新約定",
    "Recent Trades": "最近の約定",
    "Settlement Currency Reference": "精算通貨基準の参考",
    "Execution-based Price Chart": "約定基準価格グラフ",
    "Monthly Summary": "月間基準（要約）",
    "Open": "始値",
    "High": "高値",
    "Low": "安値",
    "Close": "終値",
    "Order Book": "板情報",
    "Quick Trade": "簡単取引",
    "Trade Now": "取引する",
    "Create Order": "注文作成",
    "Trading Fee": "取引手数料",
    "Actual Asset Received": "実際の受取資産",
    "Expiry Date (Optional)": "満了日（任意）",
    "Open-ended": "無期限",
    "Loading...": "読み込み中...",
    "Trading Disabled": "取引不可",
    "Instant Fill": "即時約定",
    "Fill": "約定",
    "Select": "選択",
    "Sell Order": "売り注文",
    "Buy Order": "買い注文",
    "My Orders": "自分の注文",
    "Type": "区分",
    "Remaining": "残量",
    "Best Bid": "買い気配",
    "Best Ask": "売り気配",
    "Claim Log": "受取ログ",
    "Claim Action": "受取実行",
    "Check Progress": "進行確認",
    "Token Pending": "トークン準備中",
    "Claim Sale Profit": "売却差益を受け取る",
    "Funding Failed": "募集失敗",
    "Acquisition Cancelled": "買付取消",
    "Acquisition in Progress": "買付進行中",
    "Funding in Progress": "募集中",
    "Awaiting Token Registration": "トークン登録待機",
    "Token Registration Complete": "トークン登録完了",
    "Registering Tokens": "トークン登録中",
    "Already Claimed": "受取済み",
    "Available to Claim": "受取可能",
    "Claimed": "受取",
    "Mint Address": "Mintアドレス",
    "Integrated Trading": "統合取引"
  },
  "zh": {
    "Asset List": "资产列表",
    "Select Asset": "选择资产",
    "Selected Asset": "所选资产",
    "Token Information": "代币信息",
    "Token Name": "代币名称",
    "Token Symbol": "代币简称",
    "Settlement Currency": "结算货币",
    "SETTLEMENT CURRENCY": "结算货币",
    "Total Supply": "总发行量",
    "My Distributed": "我的已分配数量",
    "Locked FX": "锁定汇率",
    "Claim Guide": "领取说明",
    "Claim Tip": "领取提示",
    "Staked Amount": "质押数量",
    "Unstaked Amount": "解除质押数量",
    "Payout Date": "发放日",
    "Estimated Interest": "预计利息",
    "Estimated Interest History": "预计利息明细",
    "Claim History": "领取记录",
    "Month / Batch": "月份 / 期次",
    "FX": "汇率",
    "Search Tradable Assets": "搜索可交易资产",
    "Last Trade": "最新成交",
    "Recent Trades": "最近成交",
    "Settlement Currency Reference": "结算货币参考",
    "Execution-based Price Chart": "按成交计算的价格图表",
    "Monthly Summary": "月度概览",
    "Open": "开盘",
    "High": "最高",
    "Low": "最低",
    "Close": "收盘",
    "Order Book": "盘口",
    "Quick Trade": "快捷交易",
    "Trade Now": "立即交易",
    "Create Order": "创建订单",
    "Trading Fee": "交易手续费",
    "Actual Asset Received": "实际收到的资产",
    "Expiry Date (Optional)": "到期日（可选）",
    "Open-ended": "无期限",
    "Loading...": "加载中...",
    "Trading Disabled": "不可交易",
    "Instant Fill": "立即成交",
    "Fill": "成交",
    "Select": "选择",
    "Sell Order": "卖单",
    "Buy Order": "买单",
    "My Orders": "我的订单",
    "Type": "类型",
    "Remaining": "剩余数量",
    "Best Bid": "买入价",
    "Best Ask": "卖出价",
    "Claim Log": "领取日志",
    "Claim Action": "执行领取",
    "Check Progress": "查看进度",
    "Token Pending": "代币准备中",
    "Claim Sale Profit": "领取出售差价收益",
    "Funding Failed": "募资失败",
    "Acquisition Cancelled": "收购取消",
    "Acquisition in Progress": "收购进行中",
    "Funding in Progress": "募资进行中",
    "Awaiting Token Registration": "等待代币登记",
    "Token Registration Complete": "代币登记完成",
    "Registering Tokens": "代币登记中",
    "Already Claimed": "已领取",
    "Available to Claim": "可领取",
    "Claimed": "已领取",
    "Mint Address": "Mint地址",
    "Integrated Trading": "综合交易"
  }
};

  const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MONTH_INDEX_EN = MONTH_NAMES_EN.reduce((acc, name, idx) => {
    acc[name.toLowerCase()] = idx + 1;
    return acc;
  }, {});
  const UNSAFE_LOOSE_KEYS = new Set(["월", "기준"]);

  function hasTranslatableContent(value) {
    const text = String(value || "");
    return /[가-힣]/.test(text)
      || /(^|[^0-9])\d+\s*(개|건|명|회차)(?=$|[^0-9])/u.test(text)
      || /\d{4}\.\s*\d{2}\.\s*\d{2}\./.test(text)
      || /\d{1,2}월\s*\d{1,2}일/.test(text)
      || /[A-Z]{2,6}\s*기준\s*정산/.test(text)
      || /[A-Za-z]/.test(text);
  }

  function hasTranslatableContentForLang(value, forcedLang) {
    const lang = forcedLang || getLang();
    const text = String(value || "");
    if (!text) return false;
    if (lang === "ko") return /[A-Za-z]/.test(text);
    return hasTranslatableContent(text);
  }

  function monthName(month, lang) {
    const m = Number(month);
    if (!Number.isFinite(m) || m < 1 || m > 12) return String(month || "");
    if (lang === "en") return MONTH_NAMES_EN[m - 1];
    return `${m}월`;
  }

  function formatMonthDay(monthOrDate, maybeDay, forcedLang) {
    const lang = forcedLang || getLang();
    let month;
    let day;
    if (monthOrDate instanceof Date) {
      month = monthOrDate.getUTCMonth() + 1;
      day = monthOrDate.getUTCDate();
    } else if (monthOrDate && typeof monthOrDate === "object") {
      month = Number(monthOrDate.month);
      day = Number(monthOrDate.day);
    } else {
      month = Number(monthOrDate);
      day = Number(maybeDay);
    }
    if (!Number.isFinite(month) || !Number.isFinite(day)) return "-";
    if (lang === "en") return `${monthName(month, lang)} ${day}`;
    if (lang === "ja" || lang === "zh") return `${month}月${day}日`;
    return `${month}월 ${day}일`;
  }

  function formatYearMonthDay(yearOrDate, maybeMonth, maybeDay, forcedLang) {
    const lang = forcedLang || getLang();
    let year;
    let month;
    let day;
    if (yearOrDate instanceof Date) {
      year = yearOrDate.getUTCFullYear();
      month = yearOrDate.getUTCMonth() + 1;
      day = yearOrDate.getUTCDate();
    } else if (yearOrDate && typeof yearOrDate === "object") {
      year = Number(yearOrDate.year);
      month = Number(yearOrDate.month);
      day = Number(yearOrDate.day);
    } else {
      year = Number(yearOrDate);
      month = Number(maybeMonth);
      day = Number(maybeDay);
    }
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "-";
    if (lang === "en") return `${monthName(month, lang)} ${day}, ${year}`;
    if (lang === "ja" || lang === "zh") return `${year}年${month}月${day}日`;
    return `${year}년 ${month}월 ${day}일`;
  }

  function localizeDateText(value, forcedLang) {
    const lang = forcedLang || getLang();
    const raw = String(value || "").trim();
    if (!raw) return raw;

    let m = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
    if (m) return formatYearMonthDay(Number(m[1]), Number(m[2]), Number(m[3]), lang);

    m = raw.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
    if (m) return formatMonthDay(Number(m[1]), Number(m[2]), lang);

    m = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (m) {
      const month = MONTH_INDEX_EN[String(m[1]).toLowerCase()];
      if (month) return formatYearMonthDay(Number(m[3]), month, Number(m[2]), lang);
    }

    m = raw.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    if (m) {
      const month = MONTH_INDEX_EN[String(m[1]).toLowerCase()];
      if (month) return formatMonthDay(month, Number(m[2]), lang);
    }

    return raw;
  }

  function formatCount(count, unit = "개", forcedLang) {
    const lang = forcedLang || getLang();
    const n = Number(count);
    const raw = Number.isFinite(n) ? String(n) : String(count || 0);
    if (lang === "ko") return `${raw}${unit}`;
    if (lang === "en") {
      if (unit === "개") return `${raw} items`;
      if (unit === "건") return `${raw} records`;
      if (unit === "명") return `${raw} users`;
      if (unit === "회차") return `${raw} periods`;
      return raw;
    }
    if (lang === "ja") {
      if (unit === "개") return `${raw}件`;
      if (unit === "건") return `${raw}件`;
      if (unit === "명") return `${raw}名`;
      if (unit === "회차") return `${raw}回分`;
      return raw;
    }
    if (lang === "zh") {
      if (unit === "개") return `${raw}项`;
      if (unit === "건") return `${raw}条`;
      if (unit === "명") return `${raw}人`;
      if (unit === "회차") return `${raw}期`;
      return raw;
    }
    return `${raw}${unit}`;
  }

  function formatSettlementLabel(currency, forcedLang) {
    const lang = forcedLang || getLang();
    const cur = String(currency || "").trim().toUpperCase() || "KRW";
    if (lang === "en") return `Settlement in ${cur} → USDT payout`;
    if (lang === "ja") return `${cur}基準で精算 → USDT支給`;
    if (lang === "zh") return `按${cur}结算 → 支付USDT`;
    return `${cur} 기준 정산 → USDT 지급`;
  }

  function formatAprFundingClose(rateText, dateText, forcedLang) {
    const lang = forcedLang || getLang();
    const localizedDate = localizeDateText(dateText, lang);
    if (lang === "en") return `Fixed Interest ${rateText} · Funding Closes ${localizedDate}`;
    if (lang === "ja") return `固定利息 ${rateText} ・ 募集締切 ${localizedDate}`;
    if (lang === "zh") return `固定利息 ${rateText} · 募资截止 ${localizedDate}`;
    return `고정 이자 ${rateText} · 모금마감 ${localizedDate}`;
  }

  function formatFundingRateLine(rateText, targetText, forcedLang) {
    const lang = forcedLang || getLang();
    if (lang === "en") return `Funding Rate ${rateText} · Moves to acquisition once ${targetText} is reached.`;
    if (lang === "ja") return `募集率 ${rateText} ・ ${targetText}達成で買付段階へ移行します。`;
    if (lang === "zh") return `募资率 ${rateText} · 达成${targetText}后转入收购阶段。`;
    return `모집률 ${rateText} · ${targetText} 달성 시 매입 단계로 전환됩니다.`;
  }

  function translateDayRangeText(value, forcedLang) {
    const lang = forcedLang || getLang();
    let out = String(value || "");
    if (lang === "ko") return out;
    out = out.replace(/(\d+)~(\d+)일/g, (_, a, b) => {
      if (lang === "en") return `${a}-${b}`;
      if (lang === "ja") return `${a}〜${b}日`;
      if (lang === "zh") return `${a}-${b}日`;
      return _;
    });
    out = out.replace(/(\d+(?:\s*,\s*\d+)+)일/g, (_, list) => {
      const arr = String(list).split(/\s*,\s*/).filter(Boolean);
      if (lang === "en") return arr.join(", ");
      if (lang === "ja") return `${arr.join("・")}日`;
      if (lang === "zh") return `${arr.join("、")}日`;
      return _;
    });
    out = out.replace(/(^|[^0-9])(\d+)일(?=$|[^0-9])/g, (_, lead, n) => {
      if (lang === "en") return `${lead}${n}`;
      if (lang === "ja" || lang === "zh") return `${lead}${n}日`;
      return _;
    });
    return out;
  }

  function translatePatternText(input, forcedLang) {
    const lang = forcedLang || getLang();

    let out = String(input ?? "");

    out = out.replace(/([A-Z]{2,6})\s*기준\s*정산\s*→\s*USDT\s*지급/g, (_, cur) => formatSettlementLabel(cur, lang));
    out = out.replace(/고정\s*이자\s*([0-9.,]+%?)\s*[·•]\s*모금마감\s*([^<\n]+)/g, (_, rate, dateText) => formatAprFundingClose(String(rate).trim(), String(dateText).trim(), lang));
    out = out.replace(/모집률\s*([0-9.,]+%)\s*[·•]\s*(목표\([^)]+\))\s*달성\s*시\s*매입\s*단계로\s*전환됩니다\./g, (_, rate, target) => formatFundingRateLine(String(rate).trim(), String(target).trim(), lang));

    out = out.replace(/매수\s*([0-9.,]+%)\s*[·•]\s*매도\s*([0-9.,]+%)/g, (_, buyFee, sellFee) => {
      if (lang === "en") return `Buy ${buyFee} · Sell ${sellFee}`;
      if (lang === "ja") return `買い ${buyFee} ・ 売り ${sellFee}`;
      if (lang === "zh") return `买入 ${buyFee} · 卖出 ${sellFee}`;
      return `매수 ${buyFee} · 매도 ${sellFee}`;
    });
    out = out.replace(/팬텀\s*지갑\s*USDT\s*보유량\s*:\s*([0-9.,]+)\s*USDT/g, (_, amountText) => {
      if (lang === "en") return `Phantom Wallet USDT Balance: ${amountText} USDT`;
      if (lang === "ja") return `PhantomウォレットUSDT保有量: ${amountText} USDT`;
      if (lang === "zh") return `Phantom钱包USDT余额: ${amountText} USDT`;
      return `팬텀 지갑 USDT 보유량: ${amountText} USDT`;
    });
    out = out.replace(/출금\s*가능\s*수량\s*:\s*([0-9.,]+)\s*([A-Z0-9_-]+)/g, (_, amountText, sym) => {
      if (lang === "en") return `Withdrawable Amount: ${amountText} ${sym}`;
      if (lang === "ja") return `出金可能数量: ${amountText} ${sym}`;
      if (lang === "zh") return `可提现数量: ${amountText} ${sym}`;
      return `출금 가능 수량: ${amountText} ${sym}`;
    });
    out = out.replace(/Settlement\s+in\s+([A-Z]{2,6})\s*→\s*USDT\s+payout/g, (_, cur) => formatSettlementLabel(cur, lang));
    out = out.replace(/^예:\s*(.+)$/gm, (_, example) => {
      const sample = String(example).trim();
      if (lang === "en") return `e.g. ${sample}`;
      if (lang === "ja") return `例: ${sample}`;
      if (lang === "zh") return `例如: ${sample}`;
      return `예: ${sample}`;
    });
    out = out.replace(/Settlement\s*period\s*\(([^)]+)\)/gi, (_, rangeText) => {
      const range = translateDayRangeText(rangeText, lang);
      if (lang === "en") return `Settlement period (${range})`;
      if (lang === "ja") return `精算期間（${range}）`;
      if (lang === "zh") return `结算期间（${range}）`;
      return `정산 기간(${range})`;
    });
    out = out.replace(/정산\s*기간\s*\(([^)]+)\)/g, (_, rangeText) => {
      const range = translateDayRangeText(rangeText, lang);
      if (lang === "en") return `Settlement period (${range})`;
      if (lang === "ja") return `精算期間（${range}）`;
      if (lang === "zh") return `结算期间（${range}）`;
      return `정산 기간(${range})`;
    });

    out = out.replace(/(^|[^0-9A-Za-z가-힣])(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?=$|[^0-9A-Za-z가-힣])/g,
      (_, lead, y, m, d) => `${lead}${formatYearMonthDay(Number(y), Number(m), Number(d), lang)}`);
    out = out.replace(/(^|[^0-9A-Za-z가-힣])(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.(?=$|[^0-9A-Za-z가-힣])/g,
      (_, lead, y, m, d) => `${lead}${formatYearMonthDay(Number(y), Number(m), Number(d), lang)}`);
    out = out.replace(/(^|[^0-9A-Za-z가-힣])(\d{1,2})월\s*(\d{1,2})일(?=$|[^0-9A-Za-z가-힣])/g,
      (_, lead, m, d) => `${lead}${formatMonthDay(Number(m), Number(d), lang)}`);
    out = out.replace(/(^|[^0-9A-Za-z가-힣])([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?=$|[^0-9A-Za-z가-힣])/g,
      (_, lead, monthText, d, y) => {
        const month = MONTH_INDEX_EN[String(monthText).toLowerCase()];
        return month ? `${lead}${formatYearMonthDay(Number(y), month, Number(d), lang)}` : _;
      });
    out = out.replace(/(^|[^0-9A-Za-z가-힣])([A-Za-z]+)\s+(\d{1,2})(?=$|[^0-9A-Za-z가-힣])/g,
      (_, lead, monthText, d) => {
        const month = MONTH_INDEX_EN[String(monthText).toLowerCase()];
        return month ? `${lead}${formatMonthDay(month, Number(d), lang)}` : _;
      });

    out = out.replace(/(\d+)\s*개\s*회차의\s*예상\s*이자가\s*있습니다\.\s*지금\s*한\s*번에\s*클레임할\s*수\s*있습니다\./g, (_, n) => {
      if (lang === "en") return `There is expected interest for ${formatCount(Number(n), "회차", lang)}. You can claim it all at once now.`;
      if (lang === "ja") return `${formatCount(Number(n), "회차", lang)}の予想利息があります。今すぐまとめて受け取れます。`;
      if (lang === "zh") return `共有${formatCount(Number(n), "회차", lang)}的预计利息。现在可以一次性领取。`;
      return _;
    });
    out = out.replace(/(\d+)\s*개\s*회차의\s*이전\s*미수령\s*이자가\s*있습니다\.\s*지금\s*한\s*번에\s*클레임할\s*수\s*있습니다\./g, (_, n) => {
      if (lang === "en") return `There is previously unclaimed interest for ${formatCount(Number(n), "회차", lang)}. You can claim it all at once now.`;
      if (lang === "ja") return `${formatCount(Number(n), "회차", lang)}分の未受取利息があります。今すぐまとめて受け取れます。`;
      if (lang === "zh") return `共有${formatCount(Number(n), "회차", lang)}的历史未领取利息。现在可以一次性领取。`;
      return _;
    });
    out = out.replace(/(\d+)\s*개\s*회차를\s*일괄\s*클레임했습니다\.\s*\(([^)]+)\)/g, (_, n, amountText) => {
      if (lang === "en") return `Claimed ${formatCount(Number(n), "회차", lang)} at once. (${amountText})`;
      if (lang === "ja") return `${formatCount(Number(n), "회차", lang)}を一括受取しました。（${amountText}）`;
      if (lang === "zh") return `已一次性领取${formatCount(Number(n), "회차", lang)}。（${amountText}）`;
      return _;
    });

    out = out.replace(/(^|[^0-9])(\d+)\s*개\s*회차(?=$|[^0-9])/g,
      (_, lead, n) => `${lead}${formatCount(Number(n), "회차", lang)}`);
    out = out.replace(/(^|[^0-9])(\d+)\s*개(?=$|[^0-9])/g,
      (_, lead, n) => `${lead}${formatCount(Number(n), "개", lang)}`);
    out = out.replace(/(^|[^0-9])(\d+)\s*건(?=$|[^0-9])/g,
      (_, lead, n) => `${lead}${formatCount(Number(n), "건", lang)}`);
    out = out.replace(/(^|[^0-9])(\d+)\s*명(?=$|[^0-9])/g,
      (_, lead, n) => `${lead}${formatCount(Number(n), "명", lang)}`);
    out = out.replace(/(^|[^0-9])(\d+)\s*회차(?=$|[^0-9])/g,
      (_, lead, n) => `${lead}${formatCount(Number(n), "회차", lang)}`);

    out = out.replace(/정산\s*기간\(([^)]+)\)에는\s*스테이킹\/언스테이킹이\s*제한됩니다\./g, (_, rangeText) => {
      const range = translateDayRangeText(rangeText, lang);
      if (lang === "en") return `Staking and unstaking are restricted during the settlement period (${range}).`;
      if (lang === "ja") return `精算期間（${range}）はステーキング/アンステーキングが制限されます。`;
      if (lang === "zh") return `结算期间（${range}）将限制质押/解除质押。`;
      return _;
    });
    out = out.replace(/원금은\s*모금\s*확정\s*환율,\s*지급은\s*(\d+)일\s*환율\s*기준으로\s*USDT\s*환산됩니다\./g, (_, dPay) => {
      if (lang === "en") return `Principal is fixed at the funding FX rate, and payouts are converted to USDT using the FX rate on day ${dPay}.`;
      if (lang === "ja") return `元本は募集確定時の為替で固定され、支給は${dPay}日の為替を基準にUSDT換算されます。`;
      if (lang === "zh") return `本金按募资确定时汇率固定，发放时按第${dPay}日汇率折算为USDT。`;
      return _;
    });
    out = out.replace(/확정환율\s*([0-9.,]+)\s*([A-Z]{2,6})\s*\/\s*지급일환율\s*([0-9.,]+)\s*([A-Z]{2,6})/g, (_, baseFx, baseCcy, payFx, payCcy) => {
      if (lang === "en") return `Funding FX ${baseFx} ${baseCcy} / Payout FX ${payFx} ${payCcy}`;
      if (lang === "ja") return `確定為替 ${baseFx} ${baseCcy} / 支給日為替 ${payFx} ${payCcy}`;
      if (lang === "zh") return `募资确定汇率 ${baseFx} ${baseCcy} / 发放日汇率 ${payFx} ${payCcy}`;
      return _;
    });
    out = out.replace(/누적\s*클레임\s*완료\s*이자\s*([0-9.,]+)\s*USDT\s*\/\s*아직\s*배정되지\s*않은\s*상태입니다\./g, (_, amountText) => {
      if (lang === "en") return `Cumulative claimed interest ${amountText} USDT / no new allocation yet.`;
      if (lang === "ja") return `累積受取済み利息 ${amountText} USDT / まだ新規配分はありません。`;
      if (lang === "zh") return `累计已领取利息 ${amountText} USDT / 目前尚未有新的分配。`;
      return _;
    });
    out = out.replace(/합산\s*([0-9.,]+)\s*TOKEN\s*\(≈\s*([0-9.,]+)\s*USDT\)\s*\/\s*/g, (_, totalToken, totalUsdt) => {
      if (lang === "en") return `Total ${totalToken} TOKEN (≈ ${totalUsdt} USDT) / `;
      if (lang === "ja") return `合計 ${totalToken} TOKEN（≈ ${totalUsdt} USDT） / `;
      if (lang === "zh") return `合计 ${totalToken} TOKEN（≈ ${totalUsdt} USDT） / `;
      return _;
    });


    out = out.replace(/발행량은\s*확정\s*모금액과\s*동일하게\s*계산됩니다\.\s*1 USDT = 1\s*([A-Z0-9_-]+)\s*[·•]\s*소수점\s*1자리\s*기준입니다\./g, (_, sym) => {
      if (lang === "en") return `Issued quantity is calculated from the confirmed funding amount. 1 USDT = 1 ${sym} · rounded to 1 decimal place.`;
      if (lang === "ja") return `発行量は確定募集額と同じ基準で計算されます。1 USDT = 1 ${sym} ・ 小数第1位基準です。`;
      if (lang === "zh") return `发行量按确认募资额等额计算。1 USDT = 1 ${sym} · 按小数点后1位为准。`;
      return _;
    });
    out = out.replace(/내\s*참여금\s*([0-9.,]+\s*USDT)\s*기준으로\s*권리가\s*계산됩니다\.\s*발행량은\s*1 USDT = 1\s*([A-Z0-9_-]+)입니다\./g, (_, amountText, sym) => {
      if (lang === "en") return `Your entitlement is calculated from your contribution of ${amountText}. Issuance is 1 USDT = 1 ${sym}.`;
      if (lang === "ja") return `自分の参加金 ${amountText} を基準に権利が計算されます。発行量は 1 USDT = 1 ${sym} です。`;
      if (lang === "zh") return `你的权益按参与金额 ${amountText} 计算。发行量按 1 USDT = 1 ${sym} 计算。`;
      return _;
    });
    out = out.replace(/([A-Z0-9_-]+)\s*수령이\s*완료되었습니다\.\s*이제\s*스테이킹\s*또는\s*다음\s*단계를\s*진행할\s*수\s*있습니다\./g, (_, sym) => {
      if (lang === "en") return `${sym} claim is complete. You can now continue to staking or the next step.`;
      if (lang === "ja") return `${sym} の受取が完了しました。これでステーキングまたは次の手順へ進めます。`;
      if (lang === "zh") return `${sym} 领取已完成。现在可以继续进行质押或下一步。`;
      return _;
    });
    out = out.replace(/정산\s*기간\s*\(([^)]+)\)/g, (_, daysText) => {
      const days = translateDayRangeText(daysText, lang);
      if (lang === "en") return `Settlement Period (${days})`;
      if (lang === "ja") return `精算期間（${days}）`;
      if (lang === "zh") return `结算期间（${days}）`;
      return _;
    });
    out = out.replace(/(?:거래\s*수수료|Trading Fee|取引手数料|交易手续费)\s*(?:매수|Buy|買い|买入)\s*([0-9.,]+%)\s*[·•・]\s*(?:매도|Sell|売り|卖出)\s*([0-9.,]+%)/g, (_, buyFee, sellFee) => {
      if (lang === "en") return `Trading Fee Buy ${buyFee} · Sell ${sellFee}`;
      if (lang === "ja") return `取引手数料 買い ${buyFee} ・ 売り ${sellFee}`;
      if (lang === "zh") return `交易手续费 买入 ${buyFee} · 卖出 ${sellFee}`;
      return `거래 수수료 매수 ${buyFee} · 매도 ${sellFee}`;
    });
    out = out.replace(/(?:Settlement period|Settlement Period)\s*\(([^)]+)\)/g, (_, daysText) => {
      const days = translateDayRangeText(daysText, lang);
      if (lang === "en") return `Settlement Period (${days})`;
      if (lang === "ja") return `精算期間（${days}）`;
      if (lang === "zh") return `结算期间（${days}）`;
      return `정산 기간(${daysText})`;
    });
    out = out.replace(/Payout Date\(([^)]+)\)/g, (_, dayText) => {
      if (lang === "en") return `Payout Date(${translateDayRangeText(dayText, lang)})`;
      if (lang === "ja") return `支給日（${translateDayRangeText(dayText, lang)}）`;
      if (lang === "zh") return `发放日（${translateDayRangeText(dayText, lang)}）`;
      return `지급일(${dayText})`;
    });
    out = out.replace(/Settlement Currency/g, () => {
      if (lang === "en") return 'Settlement Currency';
      if (lang === "ja") return '精算通貨';
      if (lang === "zh") return '结算货币';
      return '정산통화';
    });
    out = out.replace(/Before Unclaimed Interest/g, () => {
      if (lang === "en") return 'Previous Unclaimed Interest';
      if (lang === "ja") return '過去の未受取利息';
      if (lang === "zh") return '历史未领取利息';
      return '이전 미클레임 이자';
    });
    out = out.replace(/^([0-9]+)\s*년$/g, (_, years) => {
      if (lang === "en") return `${years} years`;
      if (lang === "ja") return `${years}年`;
      if (lang === "zh") return `${years}年`;
      return `${years}년`;
    });
    return out;
  }


  function getLang() {
    // ★ 기본 언어: 영어 (사용자 명시적 KO 선택 시에만 한국어)
    //   HTML 소스는 한국어 그대로 두고, applyText()가 자동으로 영어로 번역
    const raw = String(localStorage.getItem(STORAGE_KEY) || "en").trim().toLowerCase();
    return ["ko", "en"].includes(raw) ? raw : "en";
  }

  function setLang(lang) {
    const next = ["ko", "en"].includes(String(lang || "").trim().toLowerCase())
      ? String(lang).trim().toLowerCase()
      : "en";
    localStorage.setItem(STORAGE_KEY, next);
  }

  function locale() {
    return LOCALES[getLang()] || "en-US";
  }

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function translateExact(value, lang) {
    const norm = normalize(value);
    if (!norm) return null;
    const direct = EXACT[lang]?.[norm] || PARTS[lang]?.[norm] || (lang !== "en" ? EN_SOURCE[lang]?.[norm] : null) || null;
    if (direct) return direct;
    if (lang !== "en") {
      const enFallback = EXACT.en?.[norm] || PARTS.en?.[norm] || null;
      if (enFallback && !/[가-힣]/.test(String(enFallback))) {
        return EXACT[lang]?.[enFallback] || EN_SOURCE[lang]?.[enFallback] || PARTS[lang]?.[enFallback] || enFallback;
      }
    }
    return null;
  }

  function replaceLooseToken(source, key, value) {
    const escaped = escapeRegExp(key);
    const isPlainHangulWord = /^[가-힣]+$/.test(key);
    if (isPlainHangulWord) {
      return source.replace(new RegExp(`(^|[^가-힣A-Za-z0-9])(${escaped})(?=$|[^가-힣A-Za-z0-9])`, "g"), (_, lead) => `${lead}${value}`);
    }
    // (2026-05-12 v292) 영어 키도 word-boundary 적용. 이전엔 boundary 없이
    //   순수 substring 치환이라 'for'/'Two' 같은 짧은 키가 'for fee' /
    //   'Two-Factor Authentication' 등 무관한 문장 안의 일부를 덮어쓰는
    //   버그가 있었음. ASCII 영숫자 + 한글로 둘러싸이지 않은 위치에서만
    //   매치되도록 양쪽에 lookbehind/lookahead 추가.
    const isPlainAsciiWord = /^[A-Za-z0-9][A-Za-z0-9\s\-_\.]*[A-Za-z0-9]$|^[A-Za-z0-9]$/.test(key);
    if (isPlainAsciiWord) {
      return source.replace(new RegExp(`(^|[^A-Za-z0-9가-힣])(${escaped})(?=$|[^A-Za-z0-9가-힣])`, "g"), (_, lead) => `${lead}${value}`);
    }
    return source.replace(new RegExp(escaped, "g"), value);
  }

  const LOOSE_CACHE = new Map();

  function getLooseMerged(lang) {
    if (LOOSE_CACHE.has(lang)) return LOOSE_CACHE.get(lang);
    const merged = lang === "en"
      ? Object.assign({}, PARTS.en || {})
      : Object.assign({}, PARTS[lang] || {}, EN_SOURCE[lang] || {});
    const keys = Object.keys(merged)
      .filter((key) => key && !UNSAFE_LOOSE_KEYS.has(key))
      .sort((a, b) => b.length - a.length);
    const payload = { merged, keys };
    LOOSE_CACHE.set(lang, payload);
    return payload;
  }

  function translateLoose(text, lang) {
    let out = String(text ?? "");
    const { merged, keys } = getLooseMerged(lang);

    for (const key of keys) {
      if (!out.includes(key)) continue;
      try {
        out = replaceLooseToken(out, key, merged[key]);
      } catch (_) {
        // ignore individual dictionary failures
      }
    }
    return out;
  }

  function shouldUseLooseTranslation(text, lang) {
    const norm = normalize(text);
    if (!norm) return false;
    const plain = norm.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = plain ? plain.split(/\s+/).length : 0;
    if (lang === "en") return true;
    if (lang === "ko") {
      if (!/[A-Za-z]/.test(plain)) return false;
      if (/[.!?]/.test(plain) && plain.length > 40) return false;
      if (plain.length >= 64) return false;
      return true;
    }
    if (/[.!?]/.test(plain)) return false;
    if (/[·•:→]/.test(plain) && plain.length >= 12) return false;
    if (/\d/.test(plain) && /[가-힣]/.test(plain) && plain.length >= 10) return false;
    if (words >= 4) return false;
    if (plain.length >= 28) return false;
    return true;
  }

  function preservePadding(source, translated) {
    const lead = String(source).match(/^\s*/)?.[0] || "";
    const trail = String(source).match(/\s*$/)?.[0] || "";
    return `${lead}${translated}${trail}`;
  }

  // 번역 결과 메모이제이션 — applyText가 수백~수천번 호출될 때 재연산 방지
  // 언어별로 분리된 Map 으로 관리, 언어 변경 시 cacheVersion 증가로 무효화
  let TRANSLATE_CACHE_VERSION = 0;
  const TRANSLATE_CACHE = new Map(); // key = lang + "\x00" + text
  const TRANSLATE_CACHE_MAX = 8000;
  function clearTranslateCache() {
    TRANSLATE_CACHE_VERSION++;
    TRANSLATE_CACHE.clear();
  }

  function translateStringCore(input, forcedLang) {
    const lang = forcedLang || getLang();
    const text = String(input ?? "");
    if (!text) return text;
    if (lang === "ko" && !/[A-Za-z]/.test(text)) return text;

    const exact = translateExact(text, lang);
    if (exact) return preservePadding(text, exact);

    if (text.includes("\n")) {
      return text
        .split(/(\n+)/)
        .map((chunk) => (/^\n+$/.test(chunk) ? chunk : translateString(chunk, lang)))
        .join("");
    }

    const patterned = translatePatternText(text, lang);
    if (!shouldUseLooseTranslation(patterned, lang)) {
      if (lang !== "en" && /[가-힣]/.test(patterned)) {
        const fallbackExact = translateExact(text, "en");
        if (fallbackExact && !/[가-힣]/.test(String(fallbackExact))) return preservePadding(text, fallbackExact);
      }
      return preservePadding(text, patterned);
    }
    const loose = translateLoose(patterned, lang);
    if (lang !== "en" && /[가-힣]/.test(loose)) {
      const fallbackExact = translateExact(text, "en");
      if (fallbackExact && !/[가-힣]/.test(String(fallbackExact))) return preservePadding(text, fallbackExact);
      const enPattern = translatePatternText(text, "en");
      const enLoose = translateLoose(enPattern, "en");
      if (enLoose !== text && !/[가-힣]/.test(enLoose)) return preservePadding(text, enLoose);
    }
    return preservePadding(text, loose);
  }

  function translateString(input, forcedLang) {
    const text = String(input ?? "");
    if (!text) return text;
    // 긴 텍스트(>512자)는 캐시 대상에서 제외 — 메모리 낭비 방지
    if (text.length > 512) return translateStringCore(input, forcedLang);
    const lang = forcedLang || getLang();
    const cacheKey = lang + "\x00" + text;
    const cached = TRANSLATE_CACHE.get(cacheKey);
    if (cached !== undefined) return cached;
    const result = translateStringCore(input, forcedLang);
    // 크기 제한 — 초과 시 절반 비우기 (LRU 근사)
    if (TRANSLATE_CACHE.size >= TRANSLATE_CACHE_MAX) {
      const half = Math.floor(TRANSLATE_CACHE_MAX / 2);
      let i = 0;
      for (const k of TRANSLATE_CACHE.keys()) {
        TRANSLATE_CACHE.delete(k);
        if (++i >= half) break;
      }
    }
    TRANSLATE_CACHE.set(cacheKey, result);
    return result;
  }

  const NON_ASSET_PREFIXES = new Set(["KRW", "USD", "USDT", "JPY", "CNY", "EUR", "GBP", "AUD", "CAD", "HKD", "SGD", "CHF"]);

  function isStructuredAssetLabel(text) {
    const t = normalize(text);
    if (!t) return false;
    const mixed = t.match(/^([A-Z0-9_-]{2,})\s*[·•]\s*(.+)$/);
    if (mixed) {
      const head = String(mixed[1] || "").toUpperCase();
      const tail = normalize(mixed[2] || "");
      if (NON_ASSET_PREFIXES.has(head) && tail && !/^[A-Z0-9_-]{2,}(?:\/[A-Z0-9_-]{2,})?$/.test(tail)) return false;
      return true;
    }
    if (/^[A-Z0-9_-]{2,}(?:\/[A-Z0-9_-]{2,})?$/.test(t)) return true;
    if (/^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(t)) return true;
    return false;
  }

  function shouldProtectElement(el) {
    if (!(el instanceof Element)) return false;
    if (el.closest('[data-no-i18n="1"], [translate="no"]')) return true;

    const text = normalize(el.textContent || "");
    const meta = `${el.id || ""} ${typeof el.className === "string" ? el.className : ""}`.toLowerCase();

    if (/assetname|tokenname|tokensymbol|assetsymbol|walletpill|walletaddr|marketname/.test(meta)) return true;
    if (/^(usdt|sol|recon rwa)$/i.test(text)) return true;
    if (isStructuredAssetLabel(text)) return true;
    if (el.matches('.asset-card h3, #assetTitle, #saleTitle, #fundAssetName, #stakeAssetName, #tradeAssetName, #claimDoneAsset')) return true;
    if (el.matches('#wdAssetToggleLabel, #wdAssetMeta')) return isStructuredAssetLabel(text);
    if (el.matches('#tradeAssetSelect option, #stakeAssetSelect option, #claimAssetSelect option, #fundAssetSelect option, #chartAssetSelect option, #depAsset option, #wdAsset option')) {
      return isStructuredAssetLabel(text);
    }
    return false;
  }

  function protectNoI18n(root) {
    const scope = root && root.nodeType === 1 ? root : document;
    const candidates = new Set();
    const selectors = [
      '.asset-card h3',
      '#assetTitle',
      '#saleTitle',
      '#fundAssetName',
      '#stakeAssetName',
      '#tradeAssetName',
      '#claimDoneAsset',
      '#wdAssetToggleLabel',
      '#wdAssetMeta',
      '#tradeAssetSelect option',
      '#stakeAssetSelect option',
      '#claimAssetSelect option',
      '#fundAssetSelect option',
      '#chartAssetSelect option',
      '#depAsset option',
      '#wdAsset option',
      '[id*="assetname" i]',
      '[id*="tokenname" i]',
      '[id*="tokensymbol" i]',
      '[id*="assetsymbol" i]',
      '.mono',
      '#walletPill .addr'
    ];
    selectors.forEach((sel) => scope.querySelectorAll?.(sel).forEach((el) => candidates.add(el)));
    scope.querySelectorAll?.('option, h1, h2, h3, h4, h5, h6, p, span, div, strong, td, th, a, button, label').forEach((el) => candidates.add(el));
    candidates.forEach((el) => {
      if (!shouldProtectElement(el)) return;
      el.setAttribute('data-no-i18n', '1');
      el.setAttribute('translate', 'no');
    });
  }

  function shouldSkipNode(node) {
    const p = node.parentElement;
    if (!p) return true;
    const tag = p.tagName;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE|IFRAME|SVG|PATH)$/.test(tag)) return true;
    if (p.closest('[data-no-i18n="1"], [translate="no"]')) return true;
    return false;
  }

  // 노드 레벨 캐시: 이미 번역된 텍스트 노드는 nodeValue 가 마지막 번역 결과와
  // 같으면 재처리 스킵. WeakMap 을 써서 노드가 DOM 에서 제거되면 자동 GC.
  const TRANSLATED_NODES = new WeakMap(); // textNode -> { lang, translated }

  function applyText(root) {
    const lang = getLang();
    // (2026-05-07) KO early return 제거 — 정책 변경: EN 이 source, KO 는 번역.
    //   swap.html 같은 EN-source 페이지에서 KO 토글 시 변환되도록.
    //   translateStringCore 의 line "if (lang === ko && !/[A-Za-z]/.test(text)) return text"
    //   가드가 한글-only 텍스트는 보호하므로 KO source 도 안전하게 그대로 유지.
    const scope = root && root.nodeType === 1 ? root : document.documentElement;
    protectNoI18n(scope);
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    for (const textNode of nodes) {
      if (shouldSkipNode(textNode)) continue;
      const raw = textNode.nodeValue;
      if (!raw || !hasTranslatableContentForLang(raw, lang)) continue;
      // 노드 레벨 캐시: 동일 언어로 동일 번역 결과가 이미 적용된 노드는 스킵
      const prev = TRANSLATED_NODES.get(textNode);
      if (prev && prev.lang === lang && prev.translated === raw) continue;
      const translated = translateString(raw, lang);
      if (translated !== raw) {
        textNode.nodeValue = translated;
        TRANSLATED_NODES.set(textNode, { lang, translated });
      } else {
        // 번역 없음 — 다시 확인하지 않도록 마킹 (raw 자체를 번역 결과로 저장)
        TRANSLATED_NODES.set(textNode, { lang, translated: raw });
      }
    }
  }

  function applyAttrs(root) {
    const lang = getLang();
    const scope = root && root.nodeType === 1 ? root : document.documentElement;
    const elements = [scope, ...((scope && scope.querySelectorAll) ? scope.querySelectorAll("*") : [])];
    for (const el of elements) {
      if (!(el instanceof Element)) continue;
      if (el.closest('[data-no-i18n="1"], [translate="no"]')) continue;
      for (const attr of ["placeholder", "title", "aria-label"]) {
        const raw = el.getAttribute(attr);
        if (raw && hasTranslatableContentForLang(raw, lang)) {
          const translated = translateString(raw, lang);
          if (translated !== raw) el.setAttribute(attr, translated);
        }
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
        const raw = el.value;
        if (raw && hasTranslatableContentForLang(raw, lang) && /^(button|submit|reset)$/i.test(el.type || "button")) {
          const translated = translateString(raw, lang);
          if (translated !== raw) el.value = translated;
        }
      }
    }
    if (document.title && hasTranslatableContentForLang(document.title, lang)) {
      document.title = translateString(document.title, lang);
    }
  }

  function wrapNativeDialogs() {
    if (window.__RWA_I18N_DIALOGS_WRAPPED__) return;
    const rawAlert = window.alert?.bind(window);
    const rawConfirm = window.confirm?.bind(window);
    const rawPrompt = window.prompt?.bind(window);
    if (rawAlert) window.alert = (message) => rawAlert(translateString(message));
    if (rawConfirm) window.confirm = (message) => rawConfirm(translateString(message));
    if (rawPrompt) window.prompt = (message, defaultValue) => rawPrompt(translateString(message), defaultValue);
    window.__RWA_I18N_DIALOGS_WRAPPED__ = true;
  }

  function setHtmlLang() {
    const lang = getLang();
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    document.documentElement.setAttribute("data-rwa-lang", lang);
  }

  function markI18nReady() {
    try {
      document.documentElement.setAttribute('data-rwa-i18n-ready', '1');
      document.documentElement.removeAttribute('data-rwa-i18n-pending');
      if (typeof window.__RWA_I18N_BOOT_RELEASE__ === 'function') window.__RWA_I18N_BOOT_RELEASE__();
    } catch (_) {}
  }

  function injectStyle() {
    if (document.getElementById('rwaLangStyle')) return;
    const style = document.createElement('style');
    style.id = 'rwaLangStyle';
    style.textContent = `
      .rwa-lang-wrap{display:flex;align-items:center;gap:8px;min-width:0}
      .rwa-lang-select{height:36px;padding:0 12px;border:1px solid var(--border,#dbe2ea);border-radius:999px;background:#fff;color:var(--text,#0f172a);font-size:13px;font-weight:700;box-shadow:0 6px 16px rgba(15,23,42,.06)}
      .rwa-lang-floating{position:fixed;top:14px;right:14px;z-index:9999}
      header.site-header .header-inner{display:flex;align-items:center;gap:6px;min-height:64px;height:auto;flex-wrap:nowrap;padding:10px 0;min-width:0}
      header.site-header .brand{min-width:0}
      /* (v622) 운영자: '로고 노란색 테두리 다시 발생'. .brand.active-home img
         의 gold box-shadow (rgba(245,196,0,.18)) 가 홈페이지에서만 발동되어
         재발생. v611 의 border:none 만으로는 box-shadow 까지 제거 못 함.
         → box-shadow:none 으로 명시. title 골드 색도 단순 텍스트로. */
      header.site-header .brand.active-home .title{color:var(--text)}
      header.site-header .brand.active-home img{box-shadow:none}
      /* (v624) gap 0→6 — 메뉴 간격 확대. */
      header.site-header .nav{display:flex;align-items:center;gap:6px;flex:0 0 auto;flex-wrap:nowrap;overflow:visible;margin-left:80px;margin-right:0}
      header.site-header .nav a,
      header.site-header .nav .nav-link{display:inline-flex;align-items:center;justify-content:center}
      /* (v613) min-width:0 제거 — 컨텐츠 사이즈 이하로 shrink 금지 (nav 세로 깨짐 방지). */
      header.site-header .nav-item{position:relative;display:flex;align-items:center;flex-shrink:0}
      header.site-header .nav-item.has-sub{gap:4px}
      header.site-header .nav-item.has-sub::after{content:"";position:absolute;left:0;right:0;top:100%;height:16px}
      header.site-header .nav-item.has-sub > .nav-sub{display:none;position:absolute;top:calc(100% - 2px);left:0;z-index:220;min-width:200px;padding:6px;border:1px solid rgba(15,23,42,.18);border-radius:10px;background:#FFFFFF;box-shadow:0 12px 32px rgba(15,23,42,.12), 0 0 0 1px rgba(124,58,237,.10);flex-direction:column;gap:2px}
      header.site-header .nav-item.has-sub > .nav-sub::before{content:"";position:absolute;left:0;right:0;top:-16px;height:16px}
      header.site-header .nav-item.has-sub:hover > .nav-sub,
      header.site-header .nav-item.has-sub:focus-within > .nav-sub,
      header.site-header .nav-item.has-sub.is-open > .nav-sub{display:flex}
      header.site-header .nav-item.has-sub.has-active-child > .nav-link{background:#8E24AA;color:#FFFFFF;box-shadow:0 2px 0 0 #6A1B9A}
      header.site-header .nav-sub a{display:flex;align-items:center;justify-content:flex-start;padding:10px 14px;border-radius:6px;white-space:normal;line-height:1.3;font-size:13px;font-weight:600;color:#0F172A;background:transparent;letter-spacing:0.02em;transition:all .18s ease}
      header.site-header .nav-sub a:hover{color:#FFFFFF;background:#8E24AA;box-shadow:0 3px 0 0 #6A1B9A}
      header.site-header .nav-sub a[aria-current="page"],
      header.site-header .nav-sub a.active{color:#7C3AED;background:rgba(124,58,237,.08);box-shadow:inset 0 0 0 1px rgba(124,58,237,.25)}
      header.site-header .nav-caret{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid transparent;border-radius:999px;background:transparent;color:#475569;cursor:pointer;transition:background .18s ease,color .18s ease,border-color .18s ease}
      header.site-header .nav-caret:hover,
      header.site-header .nav-item.has-sub.is-open > .nav-caret,
      header.site-header .nav-item.has-sub:focus-within > .nav-caret{background:rgba(124,58,237,.10);color:#0F172A;border-color:rgba(124,58,237,.30)}
      /* (v608) CSS-chevron 제거 — site-header.html 의 .nav-caret span::before
         {content:'▾'} 와 중복 표시 문제. 텍스트 ▾ 하나만 노출. */
      header.site-header .nav-caret > span{display:inline-flex;align-items:center;justify-content:center;line-height:1}
      header.site-header .nav-item.has-sub.is-open > .nav-caret > span{transform:rotate(180deg)}
      /* (v622) actions margin-left:auto 복원 — 우측 끝으로 push. */
      header.site-header .header-actions{display:flex;align-items:center;gap:4px;flex-wrap:nowrap;justify-content:flex-end;flex-shrink:0;margin-left:auto}
      header.site-header .header-actions > *{max-width:100%}
      /* (v613) 운영자: '헤더 가로 여백 충분한데 nav 가 세로 컬럼으로 깨진다.'
         원인: EN 페이지에서 .nav a 에 overflow-wrap:anywhere + word-break:
         break-word 가 적용 → 임의 위치에서 줄바꿈 가능 → flex 분배 시 nav
         items 가 1글자 폭까지 shrink → "Inv\nest" 처럼 세로 깨짐.
         + @media(max-width:1100px) 의 .header-actions{flex:1 1 100%} 이
         nav 를 강제 squeeze. v607 에서 hamburger breakpoint 를 1024 로 낮춰서
         이 max-width:1100 룰은 1024-1100 구간 (데스크톱 가로 nav 노출 구간)
         에서만 동작 → 충돌만 일으킴. 제거. */
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .btn,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .badge,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .tab-btn,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .seg-btn,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .nav-sub a,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .small-note,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .notice,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .card,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .table th,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .table td,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .modal-panel,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .otp-panel,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .empty,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .help{overflow-wrap:anywhere;word-break:break-word}
      /* 헤더 .nav a / .nav-link 는 nowrap 강제 — 위 룰에서 명시적으로 제외 */
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) header.site-header .nav a,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) header.site-header .nav .nav-link,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) header.site-header .nav-caret{white-space:nowrap !important;word-break:keep-all !important;overflow-wrap:normal !important;line-height:1.1}
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .btn,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .badge,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .tab-btn,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .seg-btn,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .nav-sub a,
      html[data-rwa-lang]:not([data-rwa-lang="ko"]) .table th{white-space:normal;line-height:1.35}
      /* (v613) max-width:1100px 의 .header-actions{flex:1 1 100%} 룰 제거 —
         v607 의 hamburger breakpoint(1024) 와 충돌하는 1024-1100 구간에서
         actions 가 100% width 를 잡아 nav 를 squeeze 했다. 더 이상 적용 안 함. */
      @media (max-width:1024px){header.site-header .nav{display:none}}
      @media (max-width:900px){.rwa-lang-select{height:34px;font-size:12px;padding:0 10px}}
    `;
    document.head.appendChild(style);
  }

  function selectorMarkup() {
    const current = getLang();
    return `
      <div class="rwa-lang-wrap" data-rwa-lang-switch="1">
        <select id="rwaLangSelect" class="rwa-lang-select" aria-label="Language">
          ${LANGS.map(x => `<option value="${x.code}" ${x.code===current?"selected":""}>${x.label}</option>`).join("")}
        </select>
      </div>`;
  }

  function bindSelect(root) {
    const sel = (root || document).querySelector('#rwaLangSelect');
    if (!sel || sel.dataset.bound === '1') return;
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => {
      const next = String(sel.value || 'ko');
      if (next === getLang()) return;
      setLang(next);
      location.reload();
    });
  }

  function injectSelector() {
    injectStyle();
    let host = document.querySelector('header.site-header .header-actions');
    // SilicaChain: 헤더가 동적 로드되므로 floating fallback 비활성화.
    // 헤더 없을 시 그냥 skip — MutationObserver가 헤더 로드 후 재호출함.
    if (!host) {
      // 만약 이전 floating이 잔존해 있다면 즉시 제거 (FOUC 방지)
      const stale = document.querySelector('.rwa-lang-floating[data-rwa-lang-host="1"]');
      if (stale) stale.remove();
      return;
    }
    // 헤더에 이미 KO/EN 토글이 마크되어 있으면(`data-rwa-lang-switch="1"`)
    // i18n.js는 select를 추가하지 않음 — Stellar Aurora 토글 유지.
    let switcher = document.querySelector('header.site-header [data-rwa-lang-switch="1"]');
    if (!switcher) host.insertAdjacentHTML('afterbegin', selectorMarkup());
    bindSelect(document);
    // 안전장치: 어떤 이유로든 floating이 남아있으면 제거
    const floating = document.querySelector('.rwa-lang-floating[data-rwa-lang-host="1"]');
    if (floating) floating.remove();
  }

  let observerPaused = false;

  function pauseObserver() {
    const obs = window.__RWA_I18N_OBSERVER__;
    if (obs && !observerPaused) {
      obs.disconnect();
      observerPaused = true;
    }
  }

  function resumeObserver() {
    const obs = window.__RWA_I18N_OBSERVER__;
    if (obs && observerPaused) {
      obs.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
      observerPaused = false;
    }
  }

  function apply(root) {
    const scope = root || document.documentElement;
    setHtmlLang();
    wrapNativeDialogs();
    injectSelector();
    pauseObserver();
    try {
      protectNoI18n(scope);
      applyText(scope);
      applyAttrs(scope);
      markI18nReady();
    } finally {
      resumeObserver();
    }
  }

  let applyHandle = null;
  const pendingRoots = new Set();
  let applyInFlight = false;

  function normalizeRoot(root) {
    if (!root) return document.documentElement;
    if (root.nodeType === Node.TEXT_NODE) return root.parentElement || document.documentElement;
    return root.nodeType === Node.ELEMENT_NODE ? root : document.documentElement;
  }

  function flushApplyQueue() {
    applyHandle = null;
    if (applyInFlight) return;
    applyInFlight = true;
    const roots = Array.from(pendingRoots);
    pendingRoots.clear();
    const scope = roots.length === 1 ? roots[0] : document.documentElement;
    try {
      apply(scope);
    } finally {
      applyInFlight = false;
      if (pendingRoots.size) scheduleApply(document.documentElement);
    }
  }

  function scheduleApply(root) {
    pendingRoots.add(normalizeRoot(root));
    if (applyHandle) return;
    const runner = () => flushApplyQueue();
    if (typeof window.requestIdleCallback === 'function') {
      applyHandle = window.requestIdleCallback(runner, { timeout: 240 });
    } else {
      applyHandle = window.setTimeout(runner, 120);
    }
  }

  function watch() {
    if (window.__RWA_I18N_OBSERVER__) return;
    const obs = new MutationObserver((mutations) => {
      if (observerPaused) return;
      for (const m of mutations) {
        if (m.type === 'childList') { scheduleApply(m.target); return; }
        if (m.type === 'characterData') { scheduleApply(m.target.parentElement || document.documentElement); return; }
      }
    });
    obs.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    window.__RWA_I18N_OBSERVER__ = obs;
  }

  function init() {
    apply();
    watch();
  }

  window.RwaI18n = {
    getLang,
    lang: getLang, // alias — 페이지 JS 들이 RwaI18n.lang() 으로 호출함
    setLang,
    locale,
    translateString,
    translateMessage: translateString,
    formatMonthDay,
    formatYearMonthDay,
    formatCount,
    formatSettlementLabel,
    injectSelector,
    apply,
    init,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

})();
