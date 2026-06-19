(() => {
  "use strict";

  const STORAGE_KEY = "rwa_lang_admin_v1";
  const LANGS = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" }
  ];
  const LOCALES = { ko: "ko-KR", en: "en-US" };

  const EXACT = { en: {
  "투자 상품은 원금 손실 가능성이 있으며, 시세와 수익은 변동될 수 있습니다. 이 페이지의 표기는 이해를 돕기 위한 정보입니다.": "Investment products may result in loss of principal, and prices and returns may fluctuate. Information on this page is provided for easier understanding.",
  "모금 → 매입 → 토큰 분배(클레임) → 거래 → 스테이킹 이자 → 매각 정산(차익)": "Funding → Acquisition → Token Distribution (Claim) → Trading → Staking Interest → Sale Settlement (Profit)",
  "스테이킹 잔고 기준으로 매월 15일에 이자 클레임이 열립니다. 정산 기간(14~16일)에는 스테이킹/언스테이킹이 제한됩니다.": "Interest claims open on the 15th of each month based on your staking balance. Staking and unstaking are restricted during the settlement period (14th–16th).",
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
  "관리자 페이지 로드 오류": "Admin Page Load Error",
  "페이지 처리 중 오류가 발생했습니다.": "An error occurred while processing the page.",
  "페이지 일부를 불러오지 못했습니다.": "Some parts of the page could not be loaded.",
  "최신 스크립트와 캐시가 맞지 않거나 API 응답이 일시적으로 불안정할 때 발생할 수 있습니다.": "This can happen when the latest scripts and cached files do not match, or when the API response is temporarily unstable.",
  "관리자 로그인 스크립트 로드 실패": "Failed to load admin login scripts",
  "관리자 로그인 스크립트를 불러오지 못했습니다.": "Unable to load admin login scripts.",
  "동일 요청을 처리 중입니다. 잠시만 기다려 주세요.": "The same request is already being processed. Please wait a moment.",
  "매각일": "Sale Date"
} };
  const PARTS = { en: {
  // (2026-05-08) Admin nav + dashboard labels that were leaking Korean on
  // EN. Order matters: longer phrases first so substring replacement
  // matches the most specific form before falling back to single-word
  // entries (e.g. "단일 자산 현황" must be tried before "자산 현황").
  "단일 자산 현황": "Single Asset Overview",
  "단일 자산": "Single Asset",
  "단일": "Single",
  "마케팅": "Marketing",
  "사용자": "Users",
  "이메일 발송": "Send Email",
  "Email 발송": "Send Email",
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
  "단체 메일 발송": "Bulk Email",
  "단체 메일 발송 · RECON RWA": "Bulk Email · RECON RWA",
  "인증된 이메일 보유 전체": "All users with verified email",
  "스테이킹 보유자": "Stakers",
  "모금 참여자": "Funding Participants",
  "지갑 주소로 지정": "Specific wallet addresses",
  "지갑 주소 목록 (한 줄에 하나, 또는 쉼표로 구분)": "Wallet address list (one per line or comma-separated)",
  "발송 대상 수": "Recipient count",
  "샘플 (상위 10명)": "Sample (top 10)",
  "재계산": "Recount",
  "미리보기": "Preview",
  "발송 시작": "Send",
  "발송 이력": "Broadcast History",
  "상세 로그": "Detail Logs",
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
  "포트폴리오": "Portfolio",
  "추천인": "Referral",
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
  "모집중": "Funding Open",
  "구매진행": "Acquiring",
  "분배중": "Distributing",
  "운영중": "Operating",
  "매각(완료)": "Sale (Completed)",
  "모집실패": "Funding Failed",
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
} };


  const EXTRA_EXACT = {
  "en": {
    "관리자 OTP 6자리를 입력하세요.": "Enter the 6-digit admin OTP code.",
    "거절 사유를 입력하세요.": "Enter the reject reason.",
    "정말 삭제하시겠습니까?": "Are you sure you want to delete this?",
    "정말 승인하시겠습니까?": "Are you sure you want to approve this?",
    "정말 이자를 배정하시겠습니까?": "Are you sure you want to allocate interest?",
    "선택된 항목이 없습니다.": "No item is selected.",
    "저장되었습니다.": "Saved.",
    "처리 중입니다. 잠시만 기다려주세요.": "Processing. Please wait a moment.",
    "Google Authenticator 6자리 코드를 입력하세요.": "Enter the 6-digit code from Google Authenticator."
  }
};
  const EXTRA_PARTS = {
  "en": {
    "주요 메뉴": "Main Menu",
    "홈으로 이동": "Go to home",
    "관리자 지갑(Phantom)": "Admin Wallet (Phantom)",
    "전송수량": "Transfer Amount",
    "신청수량": "Requested Amount",
    "수령 주소": "Receiving Address",
    "수령주소": "Receiving Address",
    "거절/실패": "Rejected / Failed",
    "승인 대기": "Pending Approval",
    "승인 완료": "Approved",
    "작업": "Action",
    "조회": "View",
    "보너스 내역": "Bonus History",
    "보너스(USDT)": "Bonus (USDT)",
    "현재 저장 값": "Currently Saved Value",
    "현재 적용 값": "Currently Applied Value",
    "토큰 입금 승인 관리": "Token Deposit Approvals",
    "USDT 입금 승인 관리": "USDT Deposit Approvals",
    "이자 지급 테스팅": "Interest Allocation Testing",
    "연결된 지갑": "Connected Wallet",
    "연결일": "Connected At"
  }
};

  function mergeLangMap(target, extra) {
    Object.entries(extra || {}).forEach(([lang, map]) => {
      target[lang] = Object.assign({}, target[lang] || {}, map || {});
    });
  }

  mergeLangMap(EXACT, EXTRA_EXACT);
  mergeLangMap(PARTS, EXTRA_PARTS);

  const EXTRA_PARTS_V3 = {
  "en": {
    "Bid/Ask 주문수": "Bid/Ask Order Count",
    "Bid/Ask 잔량": "Bid/Ask Remaining",
    "정산 준비금": "Settlement Reserve",
    "잔여 준비금": "Remaining Reserve",
    "프론트/백엔드가 다른 도메인이면 입력": "Enter this if the frontend and backend use different domains",
    "비우면 same-origin": "Leave blank for same-origin",
    "예: 123456": "Example: 123456",
    "구매 진행": "Acquisition In Progress",
    "이자율 변경 시 다음 이자일(매월 15일)부터 반영됩니다.": "APR changes take effect from the next interest date (the 15th of each month).",
    "공시/평가(": "Disclosure / Appraisal (",
    "아파트": "Apartment",
    "오피스텔": "Officetel",
    "토지": "Land",
    "빌딩": "Building",
    "상가": "Retail",
    "공장": "Factory",
    "창고": "Warehouse",
    "숙박시설": "Hospitality",
    "종교시설": "Religious Facility",
    "리조트": "Resort",
    "오피스": "Office",
    "레지던스": "Residence",
    "주택": "House",
    "농지": "Farmland",
    "기타": "Other",
    "표시 템플릿": "Display Template",
    "자동 생성 ID": "Auto-generated ID",
    "토큰 이미지": "Token Image",
    "입력 통화": "Input Currency",
    "투자자 부담 원금(입력통화)": "Investor Principal (Input Currency)",
    "정산 준비금(USDT)": "Settlement Reserve (USDT)",
    "플랫폼 유저 할당총액(USDT, 자동계산)": "Platform User Allocation Total (USDT, Auto Calculated)",
    "플랫폼 유저 할당총액(USDT)": "Platform User Allocation Total (USDT)",
    "플랫폼 유저 할당총액(정산통화)": "Platform User Allocation Total (Settlement Currency)",
    "플랫폼 유저 할당총액/매각일": "Platform User Allocation Total / Sale Date",
    "토큰당 교환단가(정산통화)": "Token Exchange Unit Price (Settlement Currency)",
    "토큰당 교환금액(USDT)": "Token Exchange Amount (USDT)",
    "플랫폼 유저 배분비율": "Platform User Allocation Ratio",
    "외부투자자 할당총액(정산통화)": "External Investor Allocation Total (Settlement Currency)",
    "플랫폼 유저 기대 수익률": "Platform User Expected Return",
    "실제로 투자자에게 배분할 USDT 준비금입니다.": "This is the USDT reserve that will actually be distributed to investors.",
    "총 차감 비용": "Total Deducted Costs",
    "정산 시작": "Settlement Start",
    "정산 종료": "Settlement End",
    "옵션": "Options",
    "· 투자자 부담 원금 대비": "· Compared with Investor Principal",
    "비용 구성": "Cost Breakdown",
    "유저 목록": "User List",
    "유저": "User",
    "총 토큰": "Total Tokens",
    "총 STO": "Total STO",
    "미체결주문": "Open Orders",
    "이름": "Name",
    "가입일": "Joined At",
    "사유": "Reason",
    "사용중지": "Disable",
    "사용중지 해제": "Enable",
    "계약서": "Contracts",
    "가 월별로 배정되는 즉시": "as soon as it is allocated monthly",
    "를 추가 보상으로 받습니다.": "is paid as an additional reward.",
    "보상률 설정": "Reward Rate Settings",
    "추천코드": "Referral Code",
    "추천수": "Referrals",
    "관리": "Manage",
    "추천한 유저 목록": "Referred Users",
    "투자유저": "Investor User",
    "투자자 이자(USDT)": "Investor Interest (USDT)",
    "보너스율": "Bonus Rate",
    "거절": "Rejected",
    "대기": "Pending",
    "최신 환율(1 USDT = ?)": "Latest FX Rates (1 USDT = ?)",
    "통화": "Currency",
    "최종 업데이트": "Last Updated",
    "통화(히스토리)": "Currency (History)",
    "설명": "Description",
    "* 표시만 제공되며 수정은 지원하지 않습니다.": "* Display only. Editing is not supported.",
    "- 이자 산식(서버):": "- Interest Formula (Server):",
    "- 소수 처리:": "- Decimal Handling:",
    "PDF 파일": "PDF File",
    "신청자": "Requester",
    "토큰 민트": "Token Mint",
    "설정": "Settings",
    "다음달 예상(USDT)": "Estimated Next Month (USDT)",
    "지급일": "Payment Day",
    "락(제한일)": "Lock (Restricted Days)",
    "고정 수수료(USDT)": "Fixed Fee (USDT)",
    "비율 수수료(%)": "Rate Fee (%)",
    "주의": "Caution",
    "- 프로덕션 환경에서는 OTP/KYC를": "- OTP/KYC must be",
    "반드시 활성화": "enabled in production",
    "Devnet (테스트)": "Devnet (Test)",
    "Mainnet-Beta (프로덕션)": "Mainnet-Beta (Production)",
    "USDT 소수점 자릿수": "USDT Decimal Places",
    "일반적으로 6 (USDT 표준). 자체 배포 토큰의 소수점에 맞추세요.": "Usually 6 (USDT standard). Match the decimals of your deployed token.",
    "Devnet 테스트 가이드": "Devnet Test Guide",
    "아래 항목은 유지됩니다:": "The following items will be kept:",
    "계약서 템플릿": "Contract Templates",
    "Devnet / USDT 설정값": "Devnet / USDT Settings",
    "구분": "Type",
    "계약 목록을 불러오는 중...": "Loading contract list...",
    "지우기": "Clear",
    "템플릿을 불러오는 중...": "Loading templates...",
    "같은 코드로 여러 버전을 만들 수 있습니다.": "You can create multiple versions with the same code.",
    "HTML 본문을 입력하세요...": "Enter HTML body...",
    "전송 처리": "Process Transfer",
    "요청ID": "Request ID",
    "검토 기록": "Review History",
    "수수료": "Fee",
    "처리중": "Processing",
    "보유자산만 보기": "Show Held Assets Only"
  }
};
  mergeLangMap(PARTS, EXTRA_PARTS_V3);

  const EXTRA_EXACT_V2 = { en: {
  "자산을 선택하면 아래 카드에서 계약서와 편집 항목을 관리합니다.": "Select an asset to manage contracts and editable fields in the cards below.",
  "전체 자산을 표시 중입니다.": "Showing all assets.",
  "자산을 선택하면 계약서 정보가 표시됩니다.": "Contract information appears when you select an asset.",
  "템플릿을 지정하지 않으면 기본 템플릿(funding_subscription)이 자동 적용됩니다.": "If no template is specified, the default template (funding_subscription) is applied automatically.",
  "선택 자산의 증빙문서를 등록·관리합니다.": "Register and manage supporting documents for the selected asset.",
  "자산을 선택하면 등록된 문서가 표시됩니다.": "Registered documents are shown when you select an asset.",
  "현재 진행 상태는 관리자가 수동 변경하지 않고, 계약 확정·분배·매각 진행 상황에 따라 자동으로 반영됩니다.": "The current status is not changed manually by the admin. It is reflected automatically according to contract confirmation, distribution, and sale progress.",
  "모금/매입 취소 : 모집중이면 상태를 '모집실패'로, 구매진행이면 상태를 '취소됨'으로 바꾸고 참여자 USDT를 전액 환불합니다. 관리자 서명 대기 계약도 함께 반려됩니다.": "Cancel funding/acquisition: if the asset is in funding, the status changes to 'Funding Failed'; if it is in acquisition, the status changes to 'Cancelled', and participant USDT is fully refunded. Contracts awaiting admin signature are also rejected.",
  "구매 진행 : 상태를 '구매진행'으로 변경합니다. 아직 토큰 분배/거래가 시작되기 전 단계입니다.": "Start acquisition: changes the status to 'Acquisition in Progress'. This is the stage before token distribution/trading begins.",
  "자산명과 동일하게 사용됩니다.": "Used the same as the asset name.",
  "자산 ID와 동일하게 사용됩니다.": "Used the same as the asset ID.",
  "각 통화 기준으로 “1 USDT = ? (통화)” 값을 저장합니다.": "Stores the value of “1 USDT = ? (currency)” for each currency.",
  "스테이킹 전역 설정(표시)": "Global Staking Settings (Display)",
  "현재 저장된 지급일/락 값을 확인합니다.": "Shows the currently saved payout/lock values.",
  "관리자 페이지가 호출하는 API Base 값 확인": "Check the API base value used by the admin page.",
  "빈 값이면 same-origin으로 동작합니다.": "If empty, it works in same-origin mode.",
  "유저가 팬텀지갑으로 USDT를 전송할 주소(공개값)": "Public address that users send USDT to from Phantom.",
  "비워두면 미설정 상태로 저장됩니다.": "If left empty, it is saved as not configured.",
  "출금 수수료를 고정 USDT 또는 퍼센트 방식으로 설정합니다.": "Set the withdrawal fee as either fixed USDT or a percentage.",
  "고정 USDT는 토큰 출금 시 별도 USDT로 차감되고, 퍼센트는 신청 자산 수량 기준으로 차감됩니다.": "Fixed USDT is deducted separately in USDT for token withdrawals, while percentage mode is deducted based on the requested asset amount.",
  "USDT 출금은 신청 수량에서 차감되고, 토큰 출금은 별도 USDT로 차감됩니다.": "For USDT withdrawals, the fee is deducted from the requested amount; for token withdrawals, it is deducted separately in USDT.",
  "전송수량은 신청 수량 - 비율 수수료로 계산됩니다.": "Transfer amount is calculated as requested amount minus percentage fee.",
  "기본값: 1%. 매각 차익에 대한 추천인 보상은 없으며, 오직 스테이킹 수익에서만 보상이 발생합니다.": "Default: 1%. There is no referral reward for sale profits; rewards are generated only from staking yield.",
  "테스트 기간에는 OTP/KYC를 비활성화하여 편리하게 테스트할 수 있습니다. 프로덕션에서는 반드시 활성화하세요.": "During testing, you can disable OTP/KYC for convenience. In production, they must be enabled.",
  "비활성화 시 유저/관리자 모두 OTP 입력 없이 이용 가능합니다.": "When disabled, both users and admins can use the service without entering OTP.",
  "비활성화 시 유저는 KYC 절차 없이 모든 기능을 이용할 수 있습니다.": "When disabled, users can use all functions without going through KYC.",
  "테스트 시 Devnet + 자체 배포 USDT, 프로덕션 시 Mainnet으로 전환": "For testing, use Devnet + self-issued USDT; switch to Mainnet in production.",
  "Devnet: 무료 테스트 환경. Mainnet: 실제 거래 네트워크.": "Devnet: free test environment. Mainnet: real transaction network.",
  "비어있으면 네트워크에 맞는 기본 RPC를 사용합니다.": "If empty, the default RPC for the selected network is used.",
  "지급일/락일은 고정값으로만 표시되며 이 페이지에서 수정할 수 없습니다.": "Payout day and lock days are shown as fixed values and cannot be edited on this page.",
  "확정환율로 원금 확정 → 월이자 계산 → 지급일 환율로 USDT 환산": "Lock principal with the final FX → calculate monthly interest → convert to USDT with payout-day FX.",
  "정산통화 계산 중 절삭 없음 / 최종 USDT 계정 반영 시 소수 첫째 자리까지 반영": "No truncation during settlement-currency calculation / final USDT posting keeps one decimal place.",
  "클레임 분배 기준(스냅샷)입니다. 스테이킹/이자에는 필수 아님.": "This is the snapshot used for claim distribution. It is not required for staking or interest."
} };
  const EXTRA_PARTS_V2 = { en: {
  "자산 목록": "Asset List",
  "건 표시 중": "items shown",
  "발행": "Issued",
  "환율(FX) 설정": "FX Settings",
  "스테이킹 전역 설정(표시)": "Global Staking Settings (Display)",
  "적용 범위": "Scope",
  "정책": "Policy",
  "출금 처리 관리자 지갑주소(서명용)": "Admin Withdrawal Wallet (Signer)",
  "수수료 방식": "Fee Mode",
  "고정 USDT": "Fixed USDT",
  "퍼센트": "Percentage",
  "중요": "Important",
  "추천인 보상률 설정": "Referral Reward Rate",
  "보상률 (%)": "Reward Rate (%)",
  "보안 설정 (OTP / KYC)": "Security Settings (OTP / KYC)",
  "Solana 네트워크 / USDT 토큰 설정": "Solana Network / USDT Token Settings",
  "USDT 토큰 Mint 주소": "USDT Token Mint Address",
  "전역 설정": "Global Settings",
  "전역 저장": "Save Global Settings",
  "이자 지급일(1~28)": "Interest Payout Day (1–28)",
  "정산 락(예: 14,15) / 비우면 안됨": "Settlement Lock Days (e.g. 14,15) / must not be empty",
  "자산별 스테이킹/이자 파라미터": "Per-Asset Staking / Interest Parameters",
  "운영중 반영": "Applied in Operating Status",
  "자산관리 페이지 값 표시 전용": "Display-only value from Asset Management page",
  "자산 등록 페이지에서 수정": "Edit on the Asset Registration page",
  "이자율은": "The interest rate can only be edited on the",
  "페이지에서만 수정 가능합니다.": "page.",
  "공시가격/평가가(참고,": "Public/Appraised Price (reference,",
  "발행량(참고,": "Supply (reference,",
  "분배 스냅샷(선택)(funded_snapshot_usdt)": "Distribution Snapshot (Optional) (funded_snapshot_usdt)",
  "환율(지급시점)": "FX (Payout Time)",
  "이자 계산 미리보기": "Interest Preview",
  "이자 지급 테스팅": "Interest Payout Testing",
  "지급 방식": "Payout Method",
  "기준": "Basis"
} };
  mergeLangMap(EXACT, EXTRA_EXACT_V2);
  mergeLangMap(PARTS, EXTRA_PARTS_V2);


  const EXTRA_EXACT_V3 = { en: {
  "거래/매각/스테이킹/리스크 상태를 한 화면에서 확인합니다.": "Confirm trade/sale/staking/risk status on one screen.",
  "자산을 선택한 뒤 아래 카드에서 계약서와 편집 항목을 관리합니다.": "Select an asset and manage contracts and editable items in the cards below.",
  "선택 자산에 적용되는 계약서 템플릿을 관리합니다.": "Manage contract templates applied to the selected asset.",
  "전용 계약서 없음": "No dedicated contract template",
  "기본 템플릿 사용 중": "Using the default template",
  "자산별로 세분화된 증빙문서를 등록합니다. 각 카테고리별 문서를 개별 등록·관리할 수 있습니다. 매각 관련 문서는 충돌 방지를 위해 매각 관리 페이지에서만 등록할 수 있습니다.": "Register asset-specific supporting documents. Documents can be registered and managed separately for each category. Sale-related documents can only be registered from the Sale Management page to prevent conflicts.",
  "수정 가능한 진행 상태와 모금 후속 동작을 관리합니다.": "Manage editable progress states and post-funding actions.",
  "새 자산은 기본 비공개입니다.": "New assets are private by default.",
  "구글맵에서 '공유→지도 퍼가기'의 iframe src를 붙여넣으세요. 비어있으면 지도 쿼리로 자동 생성됩니다.": "Paste the iframe src from Google Maps → Share → Embed a map. If left empty, it is generated automatically from the map query.",
  "이미지 선택 후 저장 버튼 또는 업로드 버튼으로 즉시 반영합니다.": "After selecting images, click Save or Upload to apply them immediately.",
  "이미지 선택 후 저장 버튼으로 즉시 반영합니다.": "After selecting images, click Save to apply them immediately.",
  "실제 모금 합산값입니다. 수동 편집 불가.": "This is the actual summed funding value. Manual editing is not allowed.",
  "모금 종료, 환율 확정, 발행량과 거래 수수료를 관리합니다.": "Manage funding closeout, locked FX, supply, and trading fees.",
  "모금 마감일입니다. 이 날짜가 지나면 신규 참여가 불가합니다.": "This is the funding end date. New participation is unavailable after this date.",
  "부동산 매입 완료 시 환율이 자동 확정됩니다. 한번 확정 후 변경 불가.": "The FX is locked automatically when property acquisition is completed. Once locked, it cannot be changed.",
  "참여 접수된 계약과 서명 완료 계약을 표시합니다": "Shows submitted and signed contracts.",
  "계약번호를 클릭하면 상세 계약관리 페이지로 이동합니다.": "Click the contract number to open the detailed contract management page.",
  "증빙/감정평가/회계자료 문서를 업로드하고 노출합니다. 매각 관련 문서도 이 페이지와 매각 관리 페이지에서 같은 데이터로 연동됩니다.": "Upload and display supporting, appraisal, and accounting documents. Sale-related documents are synced with the Sale Management page.",
  "자산 생성 시 확정된 정산통화와 플랫폼 유저 총 투자금을 기준으로, 실제 취득원가 대비 플랫폼 유저 지분율만큼 플랫폼 유저 할당총액과 토큰당 교환금액이 자동 계산됩니다.": "When an asset is created, the locked settlement currency and total platform-user investment are used to automatically calculate the platform-user allocation total and token exchange amount according to the platform-user ownership ratio versus the actual acquisition cost.",
  "운영자가 문서 기준으로 확정한 실제 오프라인 매각일을 입력하세요. 14~16일 포함 언제든 선택할 수 있으며, 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다.": "Enter the actual offline sale date confirmed by the operator based on documents. Any date can be selected, including the 14th–16th, and user exchange for sold assets starts based on the sale execution date.",
  "관리자 수동 환율 입력이 필요합니다. 자동 조회 환율은 참고용으로만 표시됩니다.": "Admin manual FX input is required. The auto-fetched FX is shown for reference only.",
  "실행 전 확인 필요 · 저장된 매각 정보가 없습니다. 먼저 저장하세요.": "Pre-execution check required · No saved sale information. Save first.",
  "현재 매각 실행 전 확인이 필요합니다.": "A pre-execution sale check is required.",
  "저장된 매각 정보가 없습니다. 먼저 저장하세요.": "No saved sale information. Save first.",
  "이자 지급일/락일은 고정값으로만 표시되며 이 페이지에서 수정할 수 없습니다.": "Payout day and lock days are shown as fixed values and cannot be edited on this page.",
  "해당 일에 “이자 클레임”이 활성화됩니다.": "The \"Claim Interest\" action becomes available on that day.",
  "해당 날짜에는 스테이킹/언스테이킹을 제한합니다.": "Staking and unstaking are restricted on those dates.",
  "유저별 보유 USDT, 토큰 총량, 출금/사용 제재 상태를 확인할 수 있습니다.": "Review each user's USDT holdings, total tokens, and withdrawal/usage restriction status.",
  "유저 실보유 USDT, 총 모금 사용액, 입금/출금 대기, 전월/당월/다음달 이자를 함께 확인합니다.": "Review real user USDT holdings, total funding usage, pending deposits/withdrawals, and previous/current/next-month interest together.",
  "집계 기준": "Aggregation Basis",
  "미지급 이자 대신 전월/당월 실제 발생 이자와 현재 스테이킹 기준 다음달 예상 이자를 표시합니다.": "Instead of unpaid interest, this shows actual accrued interest for the previous/current month and the estimated next-month interest based on current staking.",
  "추천인으로 승인된 주소만 추천 코드를 발급받아 추천 보상을 받을 수 있습니다.": "Only addresses approved as referrers can receive a referral code and earn referral rewards.",
  "추천인은 투자유저의 스테이킹 이자가 월별로 배정되는 즉시 1%를 추가 보상으로 받습니다.": "Referrers receive an additional 1% reward as soon as monthly staking interest is allocated to the investor user.",
  "투자유저가 직접 이자를 클레임하지 않아도 추천 보상은 자동으로 즉시 지급됩니다.": "Referral rewards are paid automatically even if the investor user does not claim the interest directly.",
  "투자유저의 수익은 100% 그대로 유지되며, 추천 보상은 플랫폼에서 별도 지급됩니다.": "The investor user's yield remains 100%, and referral rewards are paid separately by the platform.",
  "매각 차익에 대한 추천인 보상은 없습니다. 오직 스테이킹 이자 배정분에 대해서만 보상이 발생합니다.": "There is no referral reward for sale profits. Rewards are generated only from allocated staking interest.",
  "유저 USDT 입금을 확인하고 승인/반려합니다. 토큰 입금은 별도 페이지에서 승인합니다.": "Review user USDT deposits and approve/reject them. Token deposits are approved on a separate page.",
  "유저가 신청한 USDT 출금 요청을 검토하고 전송 또는 반려 처리합니다. 전송 시에는 신청수량이 아닌 전송수량이 Phantom 지갑에서 전송됩니다.": "Review user USDT withdrawal requests and either transfer or reject them. The Phantom wallet sends the transfer amount, not the requested amount.",
  "목록에서 요청을 선택하세요.": "Select a request from the list.",
  "반려 사유는 유저에게 표시되고 관리자 패널 기록에도 남습니다.": "The reject reason is shown to the user and is also saved in the admin panel log.",
  "반려 시 신청 수량은 플랫폼 잔고로 환불되며, 반려 사유가 유저에게 노출됩니다.": "When rejected, the requested amount is refunded to the platform balance and the reject reason is shown to the user.",
  "유저가 신청한 자산 토큰 출금 요청을 관리합니다. 관리자 Phantom 지갑을 먼저 연결해야 전송할 수 있으며, 관리자 출금지갑과 동일한 수령주소 요청은 실제 전송할 수 없습니다.": "Manage asset-token withdrawal requests submitted by users. The admin Phantom wallet must be connected before transfer, and requests using the same receiving address as the admin withdrawal wallet cannot be transferred.",
  "출금 요청을 선택하면 상세 정보가 여기에 표시됩니다.": "Select a withdrawal request to display the details here.",
  "입출금 확정 기록(불변 로그) 보기": "View immutable deposit/withdrawal confirmation logs",
  "조건에 맞는 계약이 없습니다.": "No contracts match the current filters.",
  "각 통화 기준으로 “1 USDT = ? (통화)” 값을 저장합니다.": "Store the value of \"1 USDT = ? (currency)\" for each currency.",
  "정책": "Policy",
  "출금은 USDT만 지원.": "Only USDT withdrawals are supported.",
  "토큰은 거래에서 매도 후 USDT로 출금합니다.": "Tokens must be sold in trading and withdrawn as USDT.",
  "관리자가 Phantom으로 연결해 출금 처리할 지갑 주소": "Wallet address used by the admin for withdrawal processing via Phantom",
  "출금 승인 시 Phantom으로 연결하는 관리자 지갑 주소입니다.": "This is the admin wallet address connected through Phantom during withdrawal approval.",
  "입금 전용 지갑주소와 출금 처리 지갑주소는 분리하는 것을 권장합니다.": "It is recommended to separate the dedicated deposit wallet address and the withdrawal processing wallet address.",
  "출금 처리 시 연결된 Phantom 지갑은 이 값과 일치해야 합니다.": "The connected Phantom wallet must match this value during withdrawal processing.",
  "퍼센트 방식은 신청 자산 수량 기준으로 차감됩니다.": "In percentage mode, the deduction is based on the requested asset quantity.",
  "테스트 기간에는 OTP/KYC를 비활성화하여 편리하게 테스트할 수 있습니다. 프로덕션에서는 반드시 활성화하세요.": "During testing, you can disable OTP/KYC for convenience. In production, they must be enabled.",
  ".env 파일에서도 BYPASS_OTP, BYPASS_KYC를 설정할 수 있으며, 이 패널의 설정이 .env보다 우선합니다.": "You can also configure BYPASS_OTP and BYPASS_KYC in the .env file, but this panel's settings take precedence.",
  "Devnet에서 자체 배포한 SPL 토큰의 Mint 주소를 입력합니다.": "Enter the mint address of the self-issued SPL token deployed on Devnet.",
  "테스트 데이터 전체 초기화": "Reset All Test Data",
  "유저, 자산, 계약, 모금, 추천인, 입출금, 거래, 클레임, 스테이킹, 업로드 파일을 한 번에 비웁니다.": "Clear users, assets, contracts, funding, referrals, deposits/withdrawals, trades, claims, staking, and uploaded files all at once.",
  "아래 항목은 유지됩니다: 관리자 계정, 설정, 계약서 템플릿, Devnet / USDT 설정값.": "The following items are kept: admin account, settings, contract templates, and Devnet / USDT settings.",
  "버튼을 누르면 현재 테스트 데이터가 모두 삭제됩니다.": "Clicking the button deletes all current test data.",
  "히스토리는 DB 저장 행 기준으로 표시됩니다.": "History is displayed based on rows saved in the database."
  } };

  const EXTRA_PARTS_V4 = { en: {
    "리스크": "Risk",
    "거래대금": "Trade Value",
    "매각/정산 요약": "Sale Settlement Summary",
    "누적 클레임(USDT)": "Cumulative Claimed (USDT)",
    "스테이킹 합계": "Total Staking",
    "스테이커 수": "Staker Count",
    "공개": "Public",
    "비공개": "Private",
    "선택된 파일 없음": "No file selected",
    "등록된 증빙문서가 없습니다.": "No supporting documents have been registered.",
    "문서가 없습니다.": "No documents.",
    "문서명": "Document Title",
    "문서일": "Document Date",
    "연도-월-일": "YYYY-MM-DD",
    "선택 자산": "Selected Asset",
    "현재 요약": "Current Summary",
    "발행 예정": "Planned Issuance",
    "사용 중": "In Use",
    "등록된": "Registered",
    "선택된": "Selected",
    "저장된": "Saved",
    "연결된": "Connected",
    "적용 예정 환율": "Pending FX",
    "모금 확정 환율": "Funding Locked FX",
    "매각일 미선택": "No Sale Date Selected",
    "매각일 기준 환율(참고용 자동 조회)": "Sale Date FX (Reference Auto Lookup)",
    "매각일 기준 자동 조회 환율 안내": "Sale-date auto FX reference guide",
    "관리자 수동 환율 안내": "Admin manual FX guide",
    "매각 실행": "Sale Execute",
    "점검 필요": "Check Required",
    "점검필요": "Check Required",
    "총 매각금액": "Total Sale Amount",
    "매각세금": "Sale Tax",
    "기타 매각비용": "Other Sale Costs",
    "플랫폼 유저 총 투자금": "Platform User Total Investment",
    "실행 전 확인 필요": "Pre-execution Check Required",
    "입력한 수동 환율만 저장/실행에 사용됩니다.": "Only the manually entered FX is used for save/execute.",
    "매각 관련 문서": "Sale Related Documents",
    "매각 공문/정산 문서": "Sale Notice / Settlement Documents",
    "문서 제목": "Document Title",
    "문서 날짜": "Document Date",
    "유저별": "Per User",
    "토큰 총량": "Total Tokens",
    "제재 상태": "Restriction Status",
    "제재": "Restriction",
    "정상": "Active",
    "출금 요청": "Withdrawal Requests",
    "토큰 출금 요청": "Token Withdrawal Requests",
    "보유 내역": "Holdings Details",
    "클레임됨": "Claimed",
    "매각반환": "Sale Returned",
    "실보유": "Actual Holdings",
    "전월": "Previous Month",
    "당월": "Current Month",
    "다음달": "Next Month",
    "대상월": "Target Month",
    "이자일": "Interest Date",
    "기준월": "Base Month",
    "추천인 보상 규칙": "Referral Reward Rules",
    "추천인 주소": "Referral Address",
    // (2026-05-16 v420) "유저 등록 여부와 관계없이 주소만으로 추천인 권한을 추가합니다."
    //   문구 제거 — UI 단순화 차원. 키 자체를 제거하면 정적 빌드 손상 가능성 있어
    //   빈 문자열 매핑으로 유지 (DOM 에서는 더 이상 사용되지 않음).
    "승인된 추천인 목록": "Approved Referral List",
    "총 보너스 (USDT)": "Total Bonus (USDT)",
    "활성": "Active",
    "메모": "Memo",
    "승인필요": "Approval Required",
    "선택된 요청": "Selected Request",
    "신청자 지갑": "Requester Wallet",
    "토큰 출금 요청 관리": "Token Withdrawal Requests",
    "DEVNET 전송": "DEVNET Transfer",
    "설정 출금지갑": "Configured Withdrawal Wallet",
    "요청 없음": "No requests",
    "전자계약 관리": "Electronic Contract Management",
    "프론트/백엔드 연결(API Base)": "Frontend/Backend Connection (API Base)",
    "입금 전용 관리자 지갑 주소(USDT)": "Dedicated Admin Deposit Wallet Address (USDT)",
    "현재 보상률": "Current Reward Rate",
    "보상률 저장": "Save Reward Rate",
    "조회 건수": "Rows to View",
    "데이터 없음": "No data",
    "오전": "AM",
    "오후": "PM"
  } };

  mergeLangMap(EXACT, EXTRA_EXACT_V3);
  mergeLangMap(PARTS, EXTRA_PARTS_V4);
  if (PARTS.en) delete PARTS.en["하세요."];


  const EXTRA_EXACT_V4 = { en: {
  "유저 실보유 USDT, 모금 사용 총액, 입금/출금 대기, 전월/당월/다음달 이자를 함께 확인합니다.": "Review real user USDT holdings, total funding usage, pending deposits/withdrawals, and previous/current/next-month interest together.",
  "미지급 이자 대신 전월/당월 실제 발생 이자와 현재 스테이킹 기준 다음달 예상 이자를 표시합니다.": "Instead of unpaid interest, this shows actual accrued interest for the previous/current month and the estimated next-month interest based on current staking.",
  "자산을 선택하면 아래 카드에서 계약서와 편집 항목을 관리합니다.": "Select an asset and manage contracts and editable items in the cards below.",
  "전체 자산을 표시 중입니다.": "Showing all assets.",
  "선택 자산에 적용되는 전자계약서 템플릿을 관리합니다.": "Manage electronic contract templates applied to the selected asset.",
  "자산을 선택하면 계약서 정보가 표시됩니다.": "Contract information appears when you select an asset.",
  "템플릿을 지정하지 않으면 기본 템플릿(funding_subscription)이 자동 적용됩니다.": "If no template is specified, the default template (funding_subscription) is applied automatically.",
  "선택 자산의 증빙문서를 등록·관리합니다.": "Register and manage supporting documents for the selected asset.",
  "자산을 선택하면 등록된 문서가 표시됩니다.": "Registered documents appear when you select an asset.",
  "모집중이면 상태를 '모집실패'로, 구매진행이면 상태를 '취소됨'으로 바꾸고 참여자 USDT를 전액 환불합니다. 관리자 서명 대기 계약도 함께 반려됩니다.": "If the asset is in Funding Open, the status changes to 'Funding Failed'; if it is in Acquiring, the status changes to 'Cancelled', all participant USDT is refunded, and contracts awaiting admin signature are also rejected.",
  "상태를 '구매진행'으로 변경합니다. 아직 토큰 분배/거래가 시작되기 전 단계입니다.": "Changes the status to 'Acquiring'. This is the stage before token distribution and trading begin.",
  "구매 완료 후 분배를 시작합니다. 토큰 발행량은 확정 모금액 기준 1 USDT = 1 Token 입니다.": "Start distribution after acquisition is completed. Token supply is fixed at 1 USDT = 1 token based on the locked funding amount.",
  "자산명과 동일하게 사용됩니다.": "Used the same as the asset name.",
  "자산 ID와 동일하게 사용됩니다.": "Used the same as the asset ID.",
  "유저 출금 요청이 완료되어 온체인으로 전송된 누적 수량입니다.": "This is the cumulative quantity sent on-chain after user withdrawal requests were completed.",
  "운영자가 발행할 토큰 컨트랙트 소수점 기준입니다.": "This is the decimal standard for the token contract issued by the operator.",
  "토큰 컨트랙트를 배포한 뒤 입력하세요. 최초 저장 후 변경할 수 없습니다.": "Enter this after deploying the token contract. It cannot be changed after the first save.",
  "분배 시작 전 모금 확정 수량을 기준으로 운영자가 발행할 토큰 수량을 안내합니다.": "Before distribution starts, this guides the token quantity to be issued by the operator based on the locked funding amount.",
  "자산을 선택하면 상태 관리가 표시됩니다.": "Status management appears when you select an asset.",
  "자산을 선택하세요": "Select an asset",
  "실제 모금 합산값. 수동 편집 불가.": "Actual summed funding value. Manual editing is not allowed.",
  "분배 시작 시 자동 계산됩니다. 발행량은 확정 모금액 기준 1 USDT = 1 Token 입니다.": "Calculated automatically when distribution starts. Supply is fixed at 1 USDT = 1 token based on the locked funding amount.",
  "자산 ID, 이름, 주소, 국가, 정산통화로 검색합니다.": "Search by asset ID, name, address, country, and settlement currency.",
  "이 자산에 적용할 계약서 템플릿을 선택하세요.": "Select the contract template to apply to this asset.",
  "템플릿 이름 또는 코드 검색": "Search template name or code",
  "종류 선택 시 자동 생성": "Auto-generated after selecting the type",
  "유저가 팬텀지갑으로 USDT를 전송할 주소(공개값)": "Public address that users send USDT to from Phantom.",
  "빈 값이면 same-origin으로 동작합니다.": "If empty, it works in same-origin mode.",
  "테스트는 별도 유저 지갑으로 진행해야 합니다.": "Testing must be performed with a separate user wallet.",
  "메모 Search...": "Search memo...",
  "지갑 주소, txid, 메모 검색...": "Search wallet address, txid, or memo...",
  "지갑 주소, txid, 메모 Search...": "Search wallet address, txid, or memo...",
  "지갑주소, txid, 메모 검색...": "Search wallet address, txid, or memo..."
  } };

  const EXTRA_PARTS_V5 = { en: {
    "예: ": "Example: ",
    "또는 구글지도 공유 링크": "or a Google Maps share link",
    "구글지도": "Google Maps",
    "지도 퍼가기": "Embed a map",
    "업로드 시 자동 설정": "Auto-set on upload",
    "실시간 환율": "Live FX",
    "계약 없음": "No contracts",
    "참여 접수된 계약 없음": "No submitted contracts",
    "문서 로딩 실패": "Failed to load documents",
    "검색 조건에 맞는 자산이 없습니다.": "No assets match the search criteria.",
    "토큰 민트 주소를 입력하세요.": "Enter the token mint address.",
    "정상적인 솔라나 주소가 아닙니다.": "This is not a valid Solana address.",
    "검색어": "Query",
    "타입": "Type",
    "자산을 먼저 선택하세요.": "Select an asset first.",
    "카테고리를 선택하세요.": "Select a category.",
    "문서 제목을 입력하세요.": "Enter the document title.",
    "파일을 선택하세요.": "Select a file.",
    "자산 ID가 필요합니다.": "Asset ID is required.",
    "서명대기": "Awaiting Signature",
    "서명완료": "Signature Completed",
    "사용자서명": "User Signature",
    "초안": "Draft",
    "제목": "Title",
    "날짜": "Date",
    "검색 조건에 맞는": "matching the search criteria",
    "보상률은 0~50% 사이여야 합니다.": "Reward rate must be between 0% and 50%.",
    "보상률 저장 실패": "Failed to save reward rate",
    "추천인 보상률이": "Referral reward rate is",
    "로 저장되었습니다.": " saved.",
    "관리자 수동 환율 입력이 필요합니다. 자동 조회 환율은 참고용으로만 표시됩니다.": "Admin manual FX input is required. The auto-fetched FX is shown for reference only.",
    "자동 조회 환율은 참고용으로만 표시됩니다.": "The auto-fetched FX is shown for reference only.",
    "자동 조회 환율은 참고용입니다.": "The auto-fetched FX is for reference.",
    "먼저 저장하세요.": "Save first.",
    "실행 전 확인 필요": "Pre-execution Check Required",
    "현재 매각 실행 전 확인이 필요합니다.": "A pre-execution sale check is required.",
    "저장된 매각 정보가 없습니다.": "No saved sale information.",
    "지원하지 않습니다.": "not supported.",
    "반영됩니다.": "is applied.",
    "표시됩니다.": "is displayed.",
    "입력하세요.": "Enter it.",
    "보상률": "Reward Rate",
    "서비스 실제 적용값": "Actual Applied Value",
    "기본 RPC": "Default RPC",
    "소수점": "Decimals",
    "관리자 계정": "Admin Account",
    "입출금": "Deposits/Withdrawals"
  } };

  mergeLangMap(EXACT, EXTRA_EXACT_V4);
  mergeLangMap(PARTS, EXTRA_PARTS_V5);

  // -----------------------------------------------------------
  // V6 patch (2026-04-21): prevent remaining Korean/English mixing
  // - Compound Korean words must be in PARTS so longest-match kicks in
  //   before shorter keys (매각, 발행, 수량 etc.) could partial-replace.
  // - Bracketed status prefixes so [미매각] / [매각] / [매각완료] translate.
  // - Sentence fragments seen in the live dump that fell through to loose
  //   translation are moved into EXACT.
  // -----------------------------------------------------------
  const EXTRA_PARTS_V6 = { en: {
    // status prefixes used in selector options
    "[미매각]": "[Unsold]",
    "[매각]": "[Sold]",
    "[매각완료]": "[Sold Out]",
    "미매각": "Unsold",
    "매각완료": "Sold Out",
    // sales amounts / costs (compound words that were being broken into 2-char pieces)
    "총매각금": "Total Sale Amount",
    "순매각금": "Net Sale Amount",
    "매각차익금": "Sale Profit",
    "매각금액": "Sale Amount",
    "매각세금": "Sale Tax",
    "매각비용": "Sale Cost",
    "매각환율": "Sale FX",
    "매각 환율": "Sale FX",
    "매각일자": "Sale Date",
    "매각실행일": "Sale Execution Date",
    "매각 실행일": "Sale Execution Date",
    "매각 자산": "Sold Asset",
    "매각 상태": "Sale Status",
    "매각 관련 문서": "Sale Related Documents",
    "매각 공문": "Sale Notice",
    "정산 문서": "Settlement Documents",
    "정산통화": "Settlement Currency",
    "정산 통화": "Settlement Currency",
    "정산 준비금": "Settlement Reserve",
    "정산 기록": "Settlement Record",
    "정산 잔고": "Settlement Balance",
    "정산 이력": "Settlement History",
    "정산 금액": "Settlement Amount",
    "정산 단위": "Settlement Unit",
    "정산": "Settlement",
    // funding / issuance compounds
    "모금액": "Funding Amount",
    "모금 확정": "Funding Confirmed",
    "모금 완료": "Funding Completed",
    "확정 모금액": "Locked Funding Amount",
    "확정 모금 금액": "Locked Funding Amount",
    "확정환율": "Locked FX",
    "확정 환율": "Locked FX",
    "지급일환율": "Payout-day FX",
    "지급일 환율": "Payout-day FX",
    "총발행": "Total Issuance",
    "총 발행": "Total Issuance",
    "총발행 토큰수량": "Total Issued Tokens",
    "토큰 수량": "Token Quantity",
    "토큰수량": "Token Quantity",
    "신청수량": "Requested Quantity",
    "전송수량": "Transfer Quantity",
    "전송 수량": "Transfer Quantity",
    "신청 수량": "Requested Quantity",
    "총 차감 비용": "Total Deducted Costs",
    "투자 금액": "Investment Amount",
    "투자금액": "Investment Amount",
    "투자금": "Investment",
    "투자자": "Investor",
    "취득원가": "Acquisition Cost",
    "취득 원가": "Acquisition Cost",
    "외부자금": "External Capital",
    "외부 자금": "External Capital",
    "외부투자자": "External Investor",
    "외부 투자자": "External Investor",
    "할당총액": "Allocation Total",
    "할당 총액": "Allocation Total",
    "토큰당 가격": "Price per Token",
    "토큰당 교환금액": "Token Exchange Amount",
    "토큰당 교환단가": "Token Exchange Unit Price",
    "토큰 이미지": "Token Image",
    "토큰 이름": "Token Name",
    "토큰 약어": "Token Symbol",
    "유저 총 투자금": "Total User Investment",
    "플랫폼 유저": "Platform User",
    // status / date words
    "매각일": "Sale Date",
    "매각 실행": "Sale Execute",
    "매각실행": "Sale Execute",
    "월이자": "Monthly Interest",
    "월 이자": "Monthly Interest",
    "월분": "month(s)",
    "월별로": "monthly",
    "월별": "monthly",
    "이자 계산": "Interest Calculation",
    "이자 배정": "Interest Allocation",
    "이자 산식": "Interest Formula",
    "이자 지급": "Interest Payout",
    "이자 지급일": "Interest Payout Day",
    "이자 지급 테스팅": "Interest Payout Testing",
    "이자 클레임": "Claim Interest",
    "이자율": "Interest Rate",
    "이자 정산": "Interest Settlement",
    "클레임 분배": "Claim Distribution",
    "소수 처리": "Decimal Handling",
    "소수 첫째 자리": "first decimal place",
    "소수 둘째 자리": "second decimal place",
    "절삭 없음": "no truncation",
    "이상 거래": "suspicious trading",
    "이상거래": "suspicious trading",
    "서류 확인": "document review",
    "보안 조치": "security action",
    // verbs / common endings that should resolve as whole phrases (bounded)
    "확인할 수 있습니다": "can be viewed",
    "확인합니다": "Review",
    "관리합니다": "Manage",
    "표시합니다": "Display",
    "안내합니다": "Show",
    "이동합니다": "Go",
    "변경합니다": "Change",
    "연동됩니다": "is synced",
    "자동 생성됩니다": "is generated automatically",
    "한 화면에서": "on one screen",
    "한번에": "at once",
    "한 번에": "at once",
    "언제든": "any time",
    "포함": "including",
    "제한": "restriction",
    "제한합니다": "restrict",
    "활성화됩니다": "becomes active",
    "활성화": "Active",
    "비활성화": "Disabled",
    // UI labels
    "수정 가능": "Editable",
    "수정불가": "Read-only",
    "수정 불가": "Read-only",
    "수정 가능한": "Editable",
    "읽기 전용": "Read-only",
    "진행 상태": "Progress Status",
    "진행 상황": "Progress",
    "진행상태": "Progress Status",
    "진행상황": "Progress",
    "발행 예정": "Planned Issuance",
    "발행 필요 수량": "Required Issuance Quantity",
    "배분 비율": "Allocation Ratio",
    "지분율": "Ownership Ratio",
    "구매 진행": "Acquisition",
    "구매완료": "Acquisition Completed",
    "분배 시작": "Start Distribution",
    "분배/거래": "Distribution/Trading",
    "토큰 분배": "Token Distribution",
    "자산 상태": "Asset Status",
    "자산관리": "Asset Management",
    "자산 관리": "Asset Management",
    "자산 등록": "Asset Registration",
    "자산등록": "Asset Registration",
    "자산 편집": "Edit Asset",
    "자산편집": "Edit Asset",
    "매각 관리": "Sale Management",
    "환율 정보": "FX Information",
    "환율 이력": "FX History",
    "히스토리 환율": "Historical FX",
    "수동 환율": "Manual FX",
    "자동 조회 환율": "Auto-fetched FX",
    "자동 조회": "Auto Lookup",
    "자동 고정": "Auto-locked",
    "최종 고정": "Finally Locked",
    "최종 확인": "Final Confirmation",
    "관리자 수동": "Admin Manual",
    "관리자 수동 환율": "Admin Manual FX",
    "관리자 수동 환율(필수)": "Admin Manual FX (Required)",
    "관리자 수동 환율(선택)": "Admin Manual FX (Optional)",
    "관리자 패널": "Admin Panel",
    "실행 가능": "Ready to execute",
    "실행 불가": "Execution unavailable",
    "실행 준비": "Execution Ready",
    "점검 필요": "Check Required",
    "점검이 필요": "check required",
    "확인 필요": "Check Required",
    "확인이 필요": "check required",
    "실행 시": "on execution",
    "실행 후": "after execution",
    "실행 전": "before execution",
    "실행 중": "executing",
    "실행일": "Execution Date",
    "실행일 기준": "based on execution date",
    "실행월": "execution month",
    "복구 불가": "Irreversible",
    // suffix particles & common endings often left stranded
    "참고용": "for reference",
    "참고용으로": "for reference",
    "참고 용": "for reference",
    "실제 매각일": "actual sale date",
    "실제 오프라인 매각일": "actual offline sale date",
    "실제 운영": "actual operation",
    "전량 언스테이킹": "fully unstaked",
    // misc
    "공시가격": "Public Price",
    "평가가": "Appraised Price",
    "공시/평가": "Disclosure/Appraisal",
    "분배 스냅샷": "Distribution Snapshot",
    "수수료 방식": "Fee Mode",
    "수수료": "Fee",
    "사용 중": "In Use",
    "사용중": "In Use",
    "사용중지": "Disable",
    "사용 중지": "Disable",
    "출금중지": "Block Withdrawal",
    "출금 중지": "Block Withdrawal",
    "미체결주문": "Open Orders",
    "미체결 주문": "Open Orders",
    "언스테이킹": "Unstaking",
    "스테이킹": "Staking",
    "스테이커": "Staker",
    "이자 배정분": "allocated interest",
    "추천 보상": "Referral Reward",
    "추천인 보상": "Referral Reward",
    "추천 코드": "Referral Code",
    "추천인 코드": "Referral Code",
    "추천한": "referred",
    "추천인으로": "as a referrer",
    "추가 보상": "additional reward",
    "매월": "every month",
    "당일": "same day",
    "해당 월": "that month",
    "당월": "Current Month",
    "전월": "Previous Month",
    "다음 달": "Next Month",
    "다음달": "Next Month",
    "다음월": "Next Month",
    "해당월": "that month",
    "매각월": "sale month",
    "누적": "Accumulated",
    "누적 발생": "Accrued",
    "누적 이자": "Accumulated Interest",
    "신규 스테이킹": "New staking",
    "신규 참여": "new participation",
    "신규": "New",
    "이전 미클레임": "previously unclaimed",
    "미클레임": "unclaimed",
    "미수령": "unclaimed",
    // money / currency
    "현지통화": "Local Currency",
    "현지 통화": "Local Currency",
    "환산": "convert",
    "환산액": "Converted Amount",
    "환산(": "Converted (",
    // file / document
    "증빙 문서": "Supporting Documents",
    "증빙문서": "Supporting Documents",
    "감정 평가": "Appraisal",
    "감정평가": "Appraisal",
    "회계 자료": "Accounting Documents",
    "회계자료": "Accounting Documents",
    // UI copy
    "상세 정보": "Details",
    "상세 계약": "Contract Details",
    "계약 확정": "Contract Confirmation",
    "계약서 확정": "Contract Finalization",
    "관리자 서명 대기": "Awaiting Admin Signature",
    "관리자 서명": "Admin Signature",
    "사용자 서명": "User Signature",
    "서명 완료": "Signed",
    "서명 정보": "Signature Info",
    "서명대기": "Awaiting Signature",
    "서명완료": "Signed",
    "자필 전자서명": "Handwritten Electronic Signature",
    // common Korean verbs at end that were creating "Confirm합니다" etc.
    "확인": "Confirm",
    "설정": "Settings",
    "관리": "Manage",
    "등록": "Register",
    "입력": "Input",
    "변경": "Change",
    "업로드": "Upload",
    "반영": "Apply",
    "저장": "Save",
    "삭제": "Delete",
    "복사": "Copy"
  } };

  const EXTRA_EXACT_V5 = { en: {
    "유저별 보유 USDT, 토큰 총량, 출금/사용 제재 상태를 확인할 수 있습니다.": "Review each user's USDT holdings, total tokens, and withdrawal/usage restriction status.",
    "자산 생성 시 확정된 정산통화와 플랫폼 유저 총 투자금을 기준으로, 실제 취득원가 대비 플랫폼 유저 지분율만큼 플랫폼 유저 할당총액과 토큰당 교환금액이 자동 계산됩니다.": "Based on the settlement currency and total platform-user investment locked at asset creation, the platform-user allocation total and per-token exchange amount are calculated automatically from the platform-user ownership ratio versus the actual acquisition cost.",
    "거래/매각/스테이킹/리스크 상태를 한 화면에서 확인합니다.": "Review trade / sale / staking / risk status on one screen.",
    "확정환율 → 월이자 계산 → 지급일 환율로 USDT 환산": "Locked FX → monthly interest calculation → convert to USDT using payout-day FX",
    "확정환율 → 월이자 계산": "Locked FX → monthly interest calculation",
    "→ 지급일 환율로 USDT 환산": "→ convert to USDT using payout-day FX",
    "→ 지급일 환율로 USDT 환산 → 최종 USDT만 소수 첫째 자리 반영": "→ convert to USDT using payout-day FX → keep final USDT at the first decimal place",
    "→ 최종 USDT만 소수 첫째 자리 반영": "→ keep final USDT at the first decimal place",
    "→ 최종 USDT만 소수 둘째 자리 이하 버림": "→ truncate final USDT below the second decimal place",
    "원금 = 100 TOKEN × 확정환율 → 월이자 = 원금 × APR ÷ 12": "Principal = 100 TOKEN × locked FX → Monthly interest = Principal × APR ÷ 12",
    "* 계산식(서버 동일): 원금 = 100 TOKEN × 확정환율 → 월이자 = 원금 × APR ÷ 12": "* Formula (same as server): Principal = 100 TOKEN × locked FX → Monthly interest = Principal × APR ÷ 12",
    "정산통화 계산 중 절삭 없음 / 최종 USDT 계정 반영 시 소수 첫째 자리까지 반영": "No truncation during settlement-currency calculation; final USDT posting keeps the first decimal place.",
    "정산통화 계산 중 절삭 없이 계산하고, 최종 USDT만 소수 첫째 자리까지 반영합니다.": "No truncation during settlement-currency calculation; only the final USDT is rounded to the first decimal place.",
    "100 TOKEN 기준 월 정산금액": "Monthly settlement amount per 100 TOKEN",
    "(절삭 없음 · 표기는 4자리)": "(no truncation · shown to 4 decimals)",
    "100 TOKEN 최종 계정 반영 예정": "Estimated final posting for 100 TOKEN",
    "(USDT · 소수 첫째 자리)": "(USDT · first decimal place)",
    "선택 자산 전체 스테이커 대상": "All stakers of the selected asset",
    "1개월분 자동 배정": "auto allocate one month's interest",
    "1개월 이자를 추가 배정합니다": "additionally allocates one month of interest",
    "* 날짜와 관계없이 버튼을 누를 때마다 1개월 이자를 추가 배정합니다. 이미 같은 월 이력이 있어도 테스트용으로 중복 배정됩니다.": "* Regardless of the date, each click allocates one additional month of interest. Duplicate allocations for the same month are allowed for testing.",
    "지급일/락일은 고정값으로만 표시되며 이 페이지에서 수정할 수 없습니다.": "Payout day and lock days are shown as fixed values and cannot be edited on this page.",
    "이자 지급일/락일은 고정값으로만 표시되며 이 페이지에서 수정할 수 없습니다.": "Payout day and lock days are shown as fixed values and cannot be edited on this page.",
    "해당 일에 \"이자 클레임\"이 활성화됩니다.": "The \"Claim Interest\" action becomes available on that day.",
    "해당 일에 \u201c이자 클레임\u201d이 활성화됩니다.": "The \"Claim Interest\" action becomes available on that day.",
    "해당 날짜에는 스테이킹/언스테이킹을 제한합니다.": "Staking and unstaking are restricted on those dates.",
    "- 지급일: 해당 일에 \"이자 클레임\"이 활성화됩니다.": "- Payment Day: The \"Claim Interest\" action becomes available on that day.",
    "- 락: 해당 날짜에는 스테이킹/언스테이킹을 제한합니다.": "- Lock: Staking and unstaking are restricted on those dates.",
    "지급일: 15일 / 락: 14,15,16": "Payout day: 15th / Lock: 14,15,16",
    "지급일: 15일": "Payout day: 15th",
    "락: 14,15,16": "Lock: 14,15,16",
    "- 자산 상태는 자산관리 페이지에서 설정한 값을 호출만 합니다.": "- Asset status is read-only here; set it on the Asset Management page.",
    "- 이자 산식(서버): 확정환율로 원금 확정 → 월이자 계산 → 지급일 환율로 USDT 환산": "- Interest formula (server): lock principal with locked FX → calculate monthly interest → convert to USDT using payout-day FX",
    "- 소수 처리: 정산통화 계산 중 절삭 없음 / 최종 USDT 계정 반영 시 소수 첫째 자리까지 반영": "- Decimal handling: no truncation during settlement-currency calculation; final USDT posting keeps the first decimal place.",
    "이자율은 부동산 자산 등록/관리 페이지에서만 수정 가능합니다.": "The interest rate can only be edited from the Asset Management page.",
    "이자율은 부동산 자산 등록/관리": "The interest rate is controlled on the Asset Management",
    "페이지에서만 수정 가능합니다.": "page only.",
    "지급일환율 1,488 KRW": "Payout-day FX 1,488 KRW",
    "자산관리 페이지 값 표시 전용": "Display-only value from the Asset Management page",
    "자산 등록 페이지에서 수정": "Edit on the Asset Registration page",
    "운영중 반영": "Apply to Operating",
    "자산 설정 저장": "Save Asset Settings",
    "유저 목록": "User List",
    "총 취득원가 - 플랫폼 유저 총 투자금": "Total acquisition cost − total platform-user investment",
    "부동산 매수금액 + 매수세금 + 취득부대비용 총합": "Sum of property purchase price + purchase tax + acquisition incidentals",
    "모금 완료 시점에 확정된 값으로 자동 고정됩니다.": "Automatically locked to the value confirmed when funding was completed.",
    "매각 실행 시 관리자 수동 환율만 최종 고정됩니다.": "Only the admin manual FX is finally locked at sale execution.",
    "자동 조회 환율은 참고용이며, 입력한 수동 환율만 매각 실행 시 고정됩니다.": "Auto-fetched FX is for reference only; only the admin manual FX is locked at sale execution.",
    "입력한 수동 환율만 저장/실행에 사용됩니다.": "Only the manually entered FX is used for save/execute.",
    "운영자가 문서 기준으로 확정한 실제 오프라인 매각일을 입력하세요. 14~16일 포함 언제든 선택할 수 있으며, 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다.": "Enter the actual offline sale date confirmed by the operator. Any date including the 14th–16th can be selected; user exchange for sold assets starts from the sale execution date.",
    "매각일을 선택하면 해당일 기준 히스토리 환율을 참고용으로 조회합니다.": "Selecting the sale date shows the historical FX for that date as a reference.",
    "매각일은 실제 오프라인 기준으로 언제든 선택할 수 있습니다. 다만 매각 최종 실행은 14~16일이 아닌 날짜에만 가능하며, 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다.": "The sale date can be any actual offline date. Final sale execution is only possible outside the 14th–16th, and user exchange for sold assets starts from the sale execution date.",
    "내부 환율 이력(fx_quotes) 기준으로 조회되는 참고값입니다.": "Reference value queried from the internal FX history (fx_quotes).",
    "매각 실행 (실행 후 복구 불가)": "Sale Execute (irreversible)",
    "매각 실행 준비가 완료되었습니다.": "Sale execution is ready.",
    "매각 실행 준비 완료": "Sale Execution Ready",
    "플랫폼 유저 할당총액 = 순매각금 × (투자금액 확정환율 환산 ÷ 취득원가)": "Platform user allocation total = net sale amount × (investment locked FX conversion ÷ acquisition cost)",
    "토큰당 가격 = 플랫폼 유저 할당총액 ÷ 총발행 토큰수량": "Price per token = platform user allocation total ÷ total issued tokens",
    "토큰당 교환금액(USDT) = 토큰당 가격 ÷ 매각 환율": "Token exchange amount (USDT) = price per token ÷ sale FX",
    "* 플랫폼 유저 할당총액 = 순매각금 × (투자금액 확정환율 환산 ÷ 취득원가)": "* Platform user allocation total = net sale amount × (investment locked FX conversion ÷ acquisition cost)",
    "* 토큰당 가격 = 플랫폼 유저 할당총액 ÷ 총발행 토큰수량": "* Price per token = platform user allocation total ÷ total issued tokens",
    "* 토큰당 교환금액(USDT) = 토큰당 가격 ÷ 매각 환율": "* Token exchange amount (USDT) = price per token ÷ sale FX",
    "유저 실보유 USDT, 총 모금 사용액, 입금/출금 대기, 전월/당월/다음달 이자를 함께 확인합니다.": "Review real user USDT holdings, total funding usage, pending deposits/withdrawals, and previous/current/next month interest together.",
    "Total User USDT는 balances 기준 실제 현재 보유분이며, 모금 사용액과 승인 전 입금대기액은 별도 집계입니다.": "Total User USDT reflects actual balance holdings; funding usage and unapproved deposit requests are tracked separately.",
    "Total User USDT는 balances 기준 실제 현재 보유분이며, 모금 사용액과 승인 전 입금대기액은 별도 집계입니다. 출금/거래 수수료 수익은 완료 데이터 기준이며, 토큰형 출금 수수료는 최근 거래가 또는 자산 기준가로 USDT 환산합니다.": "Total User USDT reflects actual balance holdings; funding usage and unapproved deposit requests are tracked separately. Withdrawal/trade fee income reflects completed data, and token-type withdrawal fees are converted to USDT using the latest trade price or asset base price.",
    "모든 토큰이 소각 되면 입금출금측에서도 제거 되어야함.": "Once all tokens are burned, the asset must also be removed from deposit/withdrawal targets.",
    "투자유저의 스테이킹 이자가 월별로 배정되는 즉시 1%를 추가 보상으로 받습니다.": "A 1% additional reward is paid as soon as investor-user staking interest is allocated monthly.",
    "투자유저가 직접 이자를 클레임하지 않아도 추천 보상은 자동으로 즉시 지급됩니다.": "Referral rewards are paid automatically even if the investor user does not claim the interest directly.",
    "투자유저의 수익은 100% 그대로 유지되며, 추천 보상은 플랫폼에서 별도 지급됩니다.": "Investor-user returns are preserved at 100%; referral rewards are paid separately by the platform.",
    "매각 차익에 대한 추천인 보상은 없습니다. 오직 스테이킹 이자 배정분에 대해서만 보상이 발생합니다.": "There is no referral reward on sale profits; rewards are generated only from allocated staking interest.",
    // (2026-05-16 v420) "유저 등록 여부와 관계없이 주소만으로 추천인 권한을 추가합니다."
    //   문구 제거 — UI 단순화 차원. 키 자체를 제거하면 정적 빌드 손상 가능성 있어
    //   빈 문자열 매핑으로 유지 (DOM 에서는 더 이상 사용되지 않음).
    "스테이킹 이자 배정분의 몇 %를 추천인에게 지급할지 설정합니다. (기본: 1%)": "Set the percentage of staking interest allocation paid to the referrer (default: 1%).",
    // (2026-05-16 v420) 0.01% 입력 허용에 따른 도움말 갱신.
    "스테이킹 이자 배정분의 몇 %를 추천인에게 지급할지 설정합니다. (최소 0.01%, 최대 50%, 기본: 1%)": "Set the percentage of staking interest paid to the referrer (min 0.01%, max 50%, default: 1%).",
    "반려 사유는 유저에게 표시되고 관리자 패널 기록에도 남습니다.": "The reject reason is shown to the user and kept in the admin panel log.",
    "반려 시 신청 수량은 플랫폼 잔고로 환불되며, 반려 사유가 유저에게 노출됩니다.": "When rejected, the requested quantity is refunded to the platform balance and the reject reason is shown to the user.",
    "전송 처리 시 신청 수량이 아니라 전송 수량을 전송합니다.": "When processing the transfer, the transfer amount (not the requested amount) is sent.",
    "- 전송 처리 시 신청 수량이 아니라 전송 수량을 전송합니다.": "- When processing the transfer, the transfer amount (not the requested amount) is sent.",
    "- 반려 시 신청 수량은 플랫폼 잔고로 환불되며, 반려 사유가 유저에게 노출됩니다.": "- When rejected, the requested quantity is refunded to the platform balance and the reject reason is shown to the user.",
    "전송 시에는 신청수량이 아닌 전송수량이 Phantom 지갑에서 전송됩니다.": "When processing a transfer, the Phantom wallet sends the transfer amount, not the requested amount.",
    "사용중지는 미체결 주문 취소 및 스테이킹 해제를 포함합니다. 출금중지는 출금만 차단합니다.": "Disabling includes open-order cancellation and unstaking; withdrawal block only stops withdrawals.",
    "- 출금은 USDT만 지원.": "- Only USDT withdrawals are supported.",
    "- 토큰은 거래에서 매도 후 USDT로 출금합니다.": "- Tokens must first be sold in trading and then withdrawn as USDT.",
    "테스트 기간에는 OTP/KYC를 비활성화하여 편리하게 테스트할 수 있습니다. 프로덕션에서는 반드시 활성화하세요.": "During testing, OTP/KYC can be disabled for convenience. In production they must be enabled.",
    ".env 파일에서도 BYPASS_OTP, BYPASS_KYC를 설정할 수 있으며, 이 패널의 설정이 .env보다 우선합니다.": "You can also configure BYPASS_OTP and BYPASS_KYC in the .env file, but this panel's settings take precedence.",
    "- 프로덕션 환경에서는 OTP/KYC를 반드시 활성화하세요.": "- OTP/KYC must be enabled in the production environment.",
    "- 입금 전용 지갑주소와 출금 처리 지갑주소는 분리하는 것을 권장합니다.": "- It is recommended to separate the deposit-only wallet address from the withdrawal-processing wallet address.",
    "- 출금 처리 시 연결된 Phantom 지갑은 이 값과 일치해야 합니다.": "- The connected Phantom wallet must match this value during withdrawal processing.",
    "- 퍼센트 방식은 신청 자산 수량 기준으로 차감됩니다.": "- Percentage mode deducts based on the requested asset quantity.",
    "이곳에서 업로드한 문서는 문서 관리 페이지와 같은 데이터로 연동됩니다.": "Documents uploaded here are linked with the Document Management page.",
    "PDF 또는 이미지 업로드 가능": "PDF or images can be uploaded.",
    "현재 확정 모금 기준 발행 필요 수량은": "Required issuance quantity based on current locked funding is",
    "개이며, 분배 시작 시 1 USDT = 1 Token 기준으로 고정됩니다.": "tokens, fixed at 1 USDT = 1 token when distribution begins.",
    "현재 등록된 민트 주소:": "Currently registered mint address:",
    "분배 시작 시 1 USDT = 1 Token 기준으로 고정됩니다.": "Fixed at 1 USDT = 1 token when distribution begins.",
    "APR 변경 이력": "APR Change History",
    "(초기)": "(Initial)",
    "적용일": "Effective Date",
    "자산 소개, 입지, 수요, 특징 등을 입력하세요.": "Describe the asset overview, location, demand, and key features.",
    "토큰 분배가 시작된 이후에는 토큰 민트 주소를 변경할 수 없습니다. 현재 저장된 값이 유지됩니다.": "After token distribution starts, the token mint address cannot be changed; the currently saved value remains.",
    "구글맵에서 \u2018공유\u2192지도 퍼가기\u2019의 iframe src를 붙여넣으세요. 비어있으면 지도 쿼리로 자동 생성됩니다.": "Paste the iframe src from Google Maps → Share → Embed. If empty, the map query is used to auto-generate it.",
    "구글맵에서 '공유→지도 퍼가기'의 iframe src를 붙여넣으세요. 비어있으면 지도 쿼리로 자동 생성됩니다.": "Paste the iframe src from Google Maps → Share → Embed. If empty, the map query is used to auto-generate it.",
    "이미지 선택 후 저장 버튼 또는 업로드 버튼으로 즉시 반영합니다.": "After selecting an image, use Save or Upload to apply it immediately.",
    "이미지 선택 후 저장 버튼으로 즉시 반영합니다.": "After selecting an image, click Save to apply it immediately.",
    "실제 모금 합산값. 수동 편집 불가.": "Actual summed funding value. Manual editing is not allowed.",
    "실제 모금 합산값입니다. 수동 편집 불가.": "Actual summed funding value. Manual editing is not allowed.",
    "분배 시작 시 자동 계산됩니다. 발행량은 확정 모금액 기준 1 USDT = 1 Token 입니다.": "Automatically calculated at distribution start. Supply equals the locked funding amount at 1 USDT = 1 token.",
    "클레임 분배 기준(스냅샷)입니다. 스테이킹/이자에는 필수 아님.": "Snapshot used for claim distribution. Not required for staking or interest.",
    "모금 마감일입니다. 이 날짜가 지나면 신규 참여가 불가합니다.": "Funding deadline. New participation is not allowed after this date.",
    "부동산 매입 완료 시 환율이 자동 확정됩니다. 한번 확정 후 변경 불가.": "FX is locked automatically once property acquisition completes; it cannot be changed afterward.",
    "모금 종료, 환율 확정, 발행량과 거래 수수료를 관리합니다.": "Manage funding closeout, FX lock, supply, and trading fees.",
    "운영자가 발행할 토큰 컨트랙트 소수점 기준입니다.": "Decimal standard for the token contract issued by the operator.",
    "유저 출금 요청이 완료되어 온체인으로 전송된 누적 수량입니다.": "Cumulative quantity sent on-chain for completed user withdrawal requests.",
    "자산명과 동일하게 사용됩니다.": "Used the same as the asset name.",
    "자산 ID와 동일하게 사용됩니다.": "Used the same as the asset ID.",
    "모집중이면 상태를 '모집실패'로, 구매진행이면 상태를 '취소됨'으로 바꾸고 참여자 USDT를 전액 환불합니다. 관리자 서명 대기 계약도 함께 반려됩니다.": "If funding is open, the status becomes 'Funding Failed'; if it is acquiring, the status becomes 'Cancelled'. Participant USDT is fully refunded and contracts awaiting admin signature are also rejected.",
    "상태를 '구매진행'으로 변경합니다. 아직 토큰 분배/거래가 시작되기 전 단계입니다.": "Status is changed to 'Acquiring'. This is the stage before token distribution or trading begins.",
    "구매 완료 후 분배를 시작합니다. 토큰 발행량은 확정 모금액 기준 1 USDT = 1 Token 입니다.": "Distribution begins after acquisition. Token supply equals the locked funding amount at 1 USDT = 1 token.",
    "현재 진행 상태는 관리자가 수동 변경하지 않고, 계약 확정·분배·매각 진행 상황에 따라 자동으로 반영됩니다.": "The current progress status is not changed manually by the admin; it is reflected automatically based on contract confirmation, distribution, and sale progress.",
    "자산별로 세분화된 증빙문서를 등록합니다. 각 카테고리별 문서를 개별 등록·관리할 수 있습니다. 매각 관련 문서는 충돌 방지를 위해 매각 관리 페이지에서만 등록할 수 있습니다.": "Register asset-specific supporting documents. Each category can be registered and managed separately. Sale-related documents can only be registered from the Sale Management page to avoid conflicts.",
    "자산을 선택한 뒤 아래 카드에서 계약서와 편집 항목을 관리합니다.": "Select an asset, then manage contracts and editable fields in the cards below.",
    "자산을 선택하면 계약서 정보가 표시됩니다.": "Contract information appears when an asset is selected.",
    "자산을 선택하면 등록된 문서가 표시됩니다.": "Registered documents appear when an asset is selected.",
    "자산을 선택하면 상태 관리가 표시됩니다.": "Status management appears when an asset is selected.",
    "선택 자산에 적용되는 계약서 템플릿을 관리합니다.": "Manage the contract templates applied to the selected asset.",
    "선택 자산에 적용되는 전자계약서 템플릿을 관리합니다.": "Manage the electronic contract templates applied to the selected asset.",
    "선택 자산의 증빙문서를 등록·관리합니다.": "Register and manage supporting documents for the selected asset.",
    "현재 저장된 지급일/락 값을 확인합니다.": "Shows the currently saved payout day and lock values.",
    "각 통화 기준으로 \u201c1 USDT = ? (통화)\u201d 값을 저장합니다.": "Stores the \"1 USDT = ? (currency)\" value for each currency.",
    "관리자 페이지가 호출하는 API Base 값 확인": "Check the API base value called by the admin page.",
    "유저가 팬텀지갑으로 USDT를 전송할 주소(공개값)": "Public address that users send USDT to from Phantom.",
    "관리자가 Phantom으로 연결해 출금 처리할 지갑 주소": "Wallet address used by the admin via Phantom for withdrawal processing.",
    "출금 승인 시 Phantom으로 연결하는 관리자 지갑 주소입니다.": "Admin wallet address connected through Phantom when approving withdrawals.",
    "출금 수수료를 고정 USDT 또는 퍼센트 방식으로 설정합니다.": "Set the withdrawal fee as either a fixed USDT amount or a percentage.",
    "고정 USDT는 토큰 출금 시 별도 USDT로 차감되고, 퍼센트는 신청 자산 수량 기준으로 차감됩니다.": "Fixed USDT is deducted separately in USDT for token withdrawals; percentage mode deducts based on the requested asset quantity.",
    "USDT 출금은 신청 수량에서 차감되고, 토큰 출금은 별도 USDT로 차감됩니다.": "USDT withdrawals deduct from the requested amount; token withdrawals deduct separately in USDT.",
    "Devnet에서 자체 배포한 SPL 토큰의 Mint 주소를 입력합니다.": "Enter the mint address of the self-issued SPL token on Devnet.",
    "1. spl-token create-token --decimals 6": "1. spl-token create-token --decimals 6",
    "2. spl-token create-account <MINT>": "2. spl-token create-account <MINT>",
    "3. spl-token mint <MINT> 1000000": "3. spl-token mint <MINT> 1000000",
    "4. 위 Mint 주소를 이 설정에 등록": "4. Register the mint address above in these settings.",
    "유저, 자산, 계약, 모금, 추천인, 입출금, 거래, 클레임, 스테이킹, 업로드 파일을 한 번에 비웁니다.": "Clears users, assets, contracts, funding, referrals, deposits/withdrawals, trades, claims, staking, and uploaded files at once.",
    "버튼을 누르면 현재 테스트 데이터가 모두 삭제됩니다.": "Clicking the button deletes all current test data.",
    "아래 항목은 유지됩니다: 관리자 계정, 설정, 계약서 템플릿, Devnet / USDT 설정값.": "The following are kept: admin account, settings, contract templates, and Devnet / USDT settings.",
    "기본값: 1%. 매각 차익에 대한 추천인 보상은 없으며, 오직 스테이킹 수익에서만 보상이 발생합니다.": "Default: 1%. There is no referral reward on sale profits; rewards are generated only from staking yield.",
    "히스토리는 DB 저장 행 기준으로 표시됩니다.": "History is displayed based on rows saved in the database.",
    "* 히스토리는 DB 저장 행 기준으로 표시됩니다.": "* History is displayed based on rows saved in the database.",
    "모집실패": "Funding Failed",
    "취소됨": "Cancelled",
    "사용중지": "Disable",
    "사용중지 해제": "Enable",
    "출금중지": "Block Withdrawal",
    "출금중지 해제": "Unblock Withdrawal",
    "USDT 잔액에서 차감됩니다.": "Deducted from the USDT balance.",
    "예: 이상거래 탐지, 서류 확인 필요, 보안 조치 등": "Example: suspicious trading, document review required, security action, etc.",
    "예: 계정 검증 필요, 출금정책 위반, 주소 불일치 등": "Example: account verification required, withdrawal policy violation, address mismatch, etc.",
    "예: 계정 검증 필요, 출금Policy 위반, Address 불일치 등": "Example: account verification required, withdrawal policy violation, address mismatch, etc.",
    "관리자 지갑(Phantom)": "Admin Wallet (Phantom)",
    "연결된 Phantom 지갑과 설정 출금지갑이 일치합니다.": "The connected Phantom wallet matches the configured withdrawal wallet.",
    "연결된 Phantom 지갑과 설정 출금지갑이 일치하지 않습니다.": "The connected Phantom wallet does not match the configured withdrawal wallet.",
    "출금 처리 시 이 지갑의 USDT가 출금됩니다.": "USDT from this wallet is used for withdrawal processing.",
    "Phantom 연결이 필요합니다.": "Phantom connection is required."
  } };

  mergeLangMap(PARTS, EXTRA_PARTS_V6);
  mergeLangMap(EXACT, EXTRA_EXACT_V5);

  // -----------------------------------------------------------
  // V7 patch (2026-04-21): final sweep for remaining mixed-language strings
  // identified by scanning every HTML text node in /admin/*.html and running
  // them through the engine. These add compounds, status words, bracketed
  // labels, and the last few sentence-level entries that were still mixed.
  // -----------------------------------------------------------
  const EXTRA_PARTS_V7 = { en: {
    // status strings used across pages
    "입금완료": "Deposit Completed",
    "입금 완료": "Deposit Completed",
    "출금완료": "Withdrawal Completed",
    "출금 완료": "Withdrawal Completed",
    "출금신청": "Withdrawal Request",
    "출금 신청": "Withdrawal Request",
    "출금취소": "Withdrawal Cancelled",
    "출금 취소": "Withdrawal Cancelled",
    "전송완료": "Transfer Completed",
    "전송 완료": "Transfer Completed",
    "전송중": "Transferring",
    "전송 중": "Transferring",
    "모집중": "Funding Open",
    "구매진행": "Acquiring",
    "모집실패": "Funding Failed",
    "취소됨": "Cancelled",
    "매각완료": "Sold Out",
    // bracketed labels / suffixes that were being left behind
    "(고정)": "(Fixed)",
    "(선택)": "(Optional)",
    "(필수)": "(Required)",
    "(참고)": "(Reference)",
    "(참고용)": "(Reference)",
    "(공개값)": "(Public)",
    "(불변 로그)": "(Immutable Log)",
    "(매입일 기준, 1 USDT =": "(As of acquisition date, 1 USDT =",
    "(OTP 필수)": "(OTP Required)",
    "(KYC 필수)": "(KYC Required)",
    "(OTP 건너뜀 - 테스트용)": "(Skip OTP – Test Only)",
    "(KYC 건너뜀 - 테스트용)": "(Skip KYC – Test Only)",
    "(서버 동일)": "(Same as server)",
    "(6자리)": "(6 digits)",
    "(변수 사용 가능)": "(Variables allowed)",
    "(절삭 없음 · 표기는 4자리)": "(no truncation · shown to 4 decimals)",
    "(USDT · 소수 첫째 자리)": "(USDT · first decimal place)",
    "(감정평가 전용)": "(Appraisal only)",
    "(마스킹)": "(Masked)",
    "(초기)": "(Initial)",
    // compounds with 계산식 / 식
    "계산식": "Formula",
    "산식": "Formula",
    "비밀번호": "Password",
    "로그인한": "logged-in",
    "로그인": "Login",
    "현재 로그인": "currently logged-in",
    "아이디와 비밀번호": "ID and password",
    "아이디": "ID",
    // common endings/words not yet covered
    "유형": "Type",
    "값": "Value",
    "파일": "File",
    "상세": "Details",
    "목록": "List",
    "처리": "Processing",
    "처리중": "Processing",
    "처리 중...": "Processing...",
    "중...": "…",
    "요청": "Request",
    "변경": "Change",
    "해제": "Deselect",
    "선택 해제": "Deselect",
    "일괄": "Bulk",
    "선택 일괄 승인": "Bulk Approve Selected",
    "선택 일괄 거절": "Bulk Reject Selected",
    "선택 일괄 반려": "Bulk Reject Selected",
    "선택 요청": "Selected Request",
    "선택 유저": "Selected User",
    "선택 자산을": "the selected asset to",
    "선택 자산을 실제 운영중으로 저장": "Save selected asset as live operating",
    // file/document types
    "매각공문/정산문서": "Sale Notice / Settlement Documents",
    "매각공문": "Sale Notice",
    "매각증빙자료": "Sale Supporting Documents",
    "평가금액": "Appraisal Amount",
    "문서 유형": "Document Type",
    // transaction / settlement table column words
    "입금": "Deposit",
    "출금": "Withdrawal",
    "신청수량": "Requested Quantity",
    "전송수량": "Transfer Quantity",
    "수령 주소": "Receiving Address",
    "수령주소": "Receiving Address",
    "지갑주소": "Wallet Address",
    "토큰 민트 주소": "Token Mint Address",
    "토큰 민트": "Token Mint",
    "Mint 주소": "Mint Address",
    "솔라나 지갑 주소": "Solana wallet address",
    "솔라나 지갑": "Solana wallet",
    "솔라나": "Solana",
    // referral page
    "추천인 추가": "Add Referrer",
    "추천인 상세": "Referrer Details",
    "추천인은 투자유저의": "Referrer earns",
    "총 보너스": "Total Bonus",
    "스테이킹 이자": "staking interest",
    "투자유저": "Investor User",
    // settings page
    "환경설정": "Settings",
    "환경 설정": "Settings",
    "스테이킹 설정 이동": "Open Staking Settings",
    "관리자 출금지갑": "Admin Withdrawal Wallet",
    "관리자 출금": "Admin Withdrawal",
    "Admin 출금지갑": "Admin Withdrawal Wallet",
    "Admin 출금": "Admin Withdrawal",
    "입금 전용 관리자 지갑주소": "Dedicated Admin Deposit Wallet Address",
    "관리자 지갑주소": "Admin Wallet Address",
    "관리자 출금 처리 지갑주소": "Admin Withdrawal Processing Wallet Address",
    "출금 처리 지갑주소": "Withdrawal Processing Wallet Address",
    "출금 지갑주소": "Withdrawal Wallet Address",
    "입금 지갑주소": "Deposit Wallet Address",
    "네트워크 확인": "Network Check",
    "네트워크 확인 중": "Checking Network",
    "데브넷": "Devnet",
    "메인넷": "Mainnet",
    "데브넷/메인넷 설정": "Devnet/Mainnet Settings",
    // admin OTP / auth
    "관리자 OTP": "Admin OTP",
    "관리자 로그인": "Admin Login",
    "관리자 아이디": "Admin ID",
    "아이디와": "ID and",
    // reject / approve compound
    "계약 반려": "Reject Contract",
    "최종 반려": "Final Reject",
    "최종 확인": "Final Confirmation",
    "반려 사유": "Reject Reason",
    "반려 사유를 확인한 뒤 최종 반려를 진행하세요.": "Review the reject reason and then proceed with the final rejection.",
    // tables / listings
    "업로드된 문서": "Uploaded Documents",
    "업로드된": "Uploaded",
    "업로드 중": "Uploading",
    "전체 토큰": "All Tokens",
    "모든 토큰": "All Tokens",
    "토큰 자산": "Token Asset",
    "자산 토큰": "Asset Tokens",
    // layout labels
    "자산 이미지": "Asset Image",
    "세부 이미지": "Detail Images",
    "자산 소개": "Asset Overview",
    "이미지": "Image",
    "이미지 URL": "Image URL",
    // misc
    "서명 전": "before signature",
    "관리자 서명 전": "before admin signature",
    "자동 환불": "Auto Refund",
    "합산되지 않습니다.": "not included in the total.",
    "합산되지": "not included",
    "합산": "Sum",
    "자동 생성": "Auto Generate",
    "자동 생성됩니다": "is generated automatically",
    "자동으로 숨김": "automatically hidden",
    "자동으로 숨김 처리됩니다.": "is automatically hidden.",
    "숨김": "Hidden",
    // common sentence fragments from referrals/deposits
    "비활성화된 템플릿은 계약 생성 시 사용되지 않습니다.": "Disabled templates are not used when creating contracts.",
    "좌측에서 템플릿을 선택하거나 새로 만드세요.": "Pick a template on the left or create a new one.",
    "템플릿을 적용할 자산을 선택하세요.": "Select assets to apply this template to.",
    "이 템플릿이 적용된 자산입니다. 전용 템플릿이 없는 자산은 기본 템플릿(funding_subscription)이 자동 적용됩니다.": "Assets that use this template. Assets without a dedicated template automatically use the default (funding_subscription).",
    "솔라나 지갑 주소를 입력하세요": "Enter a Solana wallet address",
    "월": "Month",
    "총": "Total",
    "전체": "All",
    // counts widely used
    "개": "",
    // transactions-specific
    "입/출금 거래내역": "Deposits / Withdrawals History",
    "입/출금": "Deposits / Withdrawals",
    "거래내역": "Transaction History",
    "입금/출금 확정 기록": "Deposit / Withdrawal Confirmation Log",
    "불변 로그": "immutable log",
    "조회": "View",
    "불러오기": "Reload",
    "새로고침": "Refresh",
    // tail-free endings that were leftover in descriptive text
    "이동": "Go",
    "이동합니다": "Go",
    "관리합니다": "Manage",
    "표시합니다": "Display",
    "확인합니다": "Review",
    "안내합니다": "Guide",
    "차단합니다": "Block",
    "진행합니다": "Proceed",
    "해주세요": "Please",
    "전송됩니다.": "Sent.",
    "사용되지 않습니다.": "Not used.",
    "매각이 실행됩니다.": "the sale is executed.",
    "실행됩니다.": "is executed.",
    "진행하세요.": "Proceed.",
    "필수": "Required",
    "건너뜀": "Skipped",
    "테스트용": "Test Only",
    // 중/과 particles that remained attached
    "중인": "in progress",
    "관계없이": "regardless of",
    "관계 없이": "regardless of",
    "적용 여부": "applicability",
    "여부": "",
    "동시에": "at the same time",
    "그대로": "as-is",
    "즉시": "immediately",
    // verbs seen dangling at line-end
    "저장": "Save",
    "등록": "Register",
    "거절": "Reject",
    "승인": "Approve",
    "반려": "Reject",
    "확인": "Confirm",
    "선택": "Select",
    "입력": "Input",
    "삭제": "Delete",
    "수정": "Edit",
    "변경": "Change",
    "복사": "Copy",
    "시작": "Start",
    "종료": "End",
    "실행": "Execute",
    "상세보기": "View Details",
    "자세히 보기": "View Details"
  } };

  const EXTRA_EXACT_V6 = { en: {
    "매각 상세 페이지": "Sale Details Page",
    "플랫폼 유저 총 투자금(고정)": "Platform User Total Investment (Fixed)",
    "정산통화(고정):": "Settlement Currency (Fixed):",
    "입력 통화(고정)": "Input Currency (Fixed)",
    "실부동산 실제 매수금액(총 취득원가)": "Actual Real-Estate Purchase Amount (Total Acquisition Cost)",
    "외부 공동투자/운영자 자금": "External Co-Investor / Operator Capital",
    "총 취득원가 - 플랫폼 유저 총 투자금 ·": "Total Acquisition Cost − Platform User Total Investment ·",
    "세금 및 비용(정산통화)": "Taxes and Costs (Settlement Currency)",
    "세금 및 비용(Settlement Currency)": "Taxes and Costs (Settlement Currency)",
    "세금 및 비용 계산식": "Taxes and Costs Formula",
    "문서 유형": "Document Type",
    "매각공문/정산문서": "Sale Notice / Settlement Documents",
    "매각증빙자료": "Sale Supporting Documents",
    "평가금액(": "Appraisal Amount (",
    ") (감정평가 전용)": ") (Appraisal only)",
    "아래 내용을 다시 확인하고, 현재 로그인한 관리자 아이디와 비밀번호를 입력해야만 매각이 실행됩니다.": "Review the summary below; the sale is executed only after entering the currently logged-in admin ID and password.",
    "실행 즉시 되돌릴 수 없습니다.": "It cannot be reverted once executed.",
    "매각일 선택 후 자동 조회": "Automatically fetched after selecting the sale date",
    "매각일 기준 자동 조회 환율은 참고용이며, 입력한 관리자 수동 환율만 최종 고정됩니다. 유저는 플랫폼 유저 할당총액을 기준으로 정산받고, 토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 ÷ 매각 환율로 계산됩니다. 매각 실행과 동시에 해당 자산의 스테이킹 수량은 전량 언스테이킹되며, 이자 지급 여부는 매각일과 15일 기준 규칙에 따라 판단됩니다. 이전 누적 미수령 이자는 그대로 클레임할 수 있고, 유저의 매각 자산 교환은 매각 실행 완료 시점부터 시작됩니다.": "The auto-fetched FX based on the sale date is for reference only; only the admin manual FX is finally locked. Users are settled against the platform-user allocation total, and the per-token exchange amount equals platform-user allocation total ÷ total issued tokens ÷ sale FX. Upon sale execution the asset's staked quantity is fully unstaked, and interest payout is determined by the sale-date-and-15th rule. Previously accumulated unclaimed interest can still be claimed, and user exchange for sold assets starts at sale execution completion.",
    "플랫폼 유저 총 투자금 계산식": "Platform User Total Investment Formula",
    "총 취득원가 계산식": "Total Acquisition Cost Formula",
    "외부 공동투자 자금 계산식": "External Co-Investor Capital Formula",
    "플랫폼 유저 할당총액 계산식": "Platform User Allocation Total Formula",
    "총 차감 비용 계산식": "Total Deducted Costs Formula",
    "총매각금 계산식": "Total Sale Amount Formula",
    "순매각금 계산식": "Net Sale Amount Formula",
    "취득원가 계산식": "Acquisition Cost Formula",
    "매각차익금 계산식": "Sale Profit Formula",
    "플랫폼 유저 투자금액 계산식": "Platform User Investment Amount Formula",
    "확정환율 계산식": "Locked FX Formula",
    "투자금액 확정환율 환산 계산식": "Investment Locked-FX Conversion Formula",
    "외부자금 계산식": "External Capital Formula",
    "외부투자자 할당총액 계산식": "External Investor Allocation Formula",
    "토큰당 가격 계산식": "Price-per-Token Formula",
    "매각 환율 계산식": "Sale FX Formula",
    "토큰당 교환금액 계산식": "Token Exchange Amount Formula",
    "예: 매각정산 보고서": "Example: Sale Settlement Report",
    "예: 매각 정산 보고서": "Example: Sale Settlement Report",
    "예: 등기부등본(마스킹)": "Example: Registry Copy (masked)",
    "예: 2026년 3월 등기부등본": "Example: March 2026 Registry Copy",
    "예: 서울 강남구 테헤란로": "Example: Teheran-ro, Gangnam-gu, Seoul",
    "예: APT001, 강남, 오피스텔": "Example: APT001, Gangnam, Officetel",
    "예: 서울 강남 오피스텔 101호": "Example: Seoul Gangnam Officetel #101",
    "예: 2160 또는 1000000": "Example: 2160 or 1000000",
    "예: 계약 정보 불일치, 서류 확인 필요": "Example: contract info mismatch, document review required",
    "예: 기본 투자 청약 전자계약서": "Example: Default Investment Subscription Electronic Contract",
    "예: {{asset_name}} 투자 청약 전자계약서": "Example: {{asset_name}} Investment Subscription Electronic Contract",
    "자산 ID 또는 이름 검색": "Search by asset ID or name",
    "계약서 제목 (변수 사용 가능)": "Contract Title (variables allowed)",
    "계약서 본문 HTML (변수 사용 가능)": "Contract Body HTML (variables allowed)",
    "100 TOKEN 기준 월 정산금액 (절삭 없음 · 표기는 4자리)": "Monthly settlement amount per 100 TOKEN (no truncation · shown to 4 decimals)",
    "100 TOKEN 최종 계정 반영 예정 (USDT · 소수 첫째 자리)": "Estimated final posting per 100 TOKEN (USDT · first decimal place)",
    "선택 자산 전체 스테이커 대상 1개월분 자동 배정": "Automatically allocate one month of interest to all stakers of the selected asset.",
    "* 계산식(서버 동일): 원금 = 100 TOKEN × 확정환율 → 월이자 = 원금 × APR ÷ 12 → 지급일 환율로 USDT 환산 → 최종 USDT만 소수 둘째 자리 이하 버림": "* Formula (same as server): Principal = 100 TOKEN × locked FX → Monthly interest = Principal × APR ÷ 12 → convert to USDT using payout-day FX → truncate final USDT below the second decimal place.",
    "확정환율 → 월이자 계산 → 지급일 환율로 USDT 환산 → 최종 USDT만 소수 첫째 자리 반영": "Locked FX → monthly interest calculation → convert to USDT using payout-day FX → keep final USDT at the first decimal place",
    "- 지급일: 해당 일에 \u201c이자 클레임\u201d이 활성화됩니다.": "- Payout day: the \u201cClaim Interest\u201d action becomes available on that day.",
    "- 지급일: 해당 일에 \"이자 클레임\"이 활성화됩니다.": "- Payout day: the \"Claim Interest\" action becomes available on that day.",
    "- .env 파일에서도 BYPASS_OTP, BYPASS_KYC를 설정할 수 있으며, 이 패널의 설정이 .env보다 우선합니다.": "- You can also configure BYPASS_OTP / BYPASS_KYC in the .env file, but settings on this panel take precedence.",
    "Devnet에서 자체 배포한 SPL 토큰의 Mint 주소를 입력하세요.": "Enter the mint address of the self-issued SPL token on Devnet.",
    "활성화 (OTP 필수)": "Enabled (OTP Required)",
    "비활성화 (OTP 건너뜀 - 테스트용)": "Disabled (Skip OTP – Test Only)",
    "활성화 (KYC 필수)": "Enabled (KYC Required)",
    "비활성화 (KYC 건너뜀 - 테스트용)": "Disabled (Skip KYC – Test Only)",
    "- 각 페이지의 환산/표기(/api/public/config fx_rates)": "- Conversion / display on each page (/api/public/config fx_rates)",
    "최종환율 (매입일 기준, 1 USDT =": "Final FX (as of acquisition date, 1 USDT =",
    "유저 USDT 입금을 확인하고 승인/거절합니다. 토큰 입금은 별도 페이지에서 승인합니다.": "Review and approve/reject user USDT deposits. Token deposits are approved on a separate page.",
    "관리자가 배포를 시작한 자산 토큰 입금만 승인합니다. 승인 후 사용자 보유 수량에 반영됩니다.": "Only approves deposits of asset tokens whose distribution has been started. Approved deposits are applied to the user's holdings.",
    "유저가 신청한 자산 토큰 출금 요청을 관리합니다. 관리자 Phantom 지갑을 먼저 연결해야 전송할 수 있으며, 관리자 출금지갑과 동일한 수령 주소 요청은 실제 전송할 수 없습니다.": "Manage asset-token withdrawal requests submitted by users. The admin Phantom wallet must be connected before transfer, and requests whose receiving address matches the admin withdrawal wallet cannot be transferred.",
    "데브넷/메인넷 설정과 관리자 출금지갑 일치 여부를 확인합니다. 전송 버튼은 Phantom이 연결되고 설정 지갑과 일치할 때만 활성화됩니다.": "Verifies that the Devnet/Mainnet setting matches the admin withdrawal wallet. The transfer button is enabled only when Phantom is connected and matches the configured wallet.",
    "유저가 신청한 USDT 출금 요청을 검토하고 전송 또는 반려 처리합니다.": "Review user USDT withdrawal requests and either transfer or reject them.",
    "전송 시에는 신청수량이 아닌": "When processing a transfer, the transfer amount (not the requested amount)",
    "이 Phantom 지갑에서 전송됩니다.": "is sent from this Phantom wallet.",
    "전송 처리 시 이 지갑의 USDT가 출금됩니다.": "USDT from this wallet is sent when processing the transfer.",
    "관리자 OTP(6자리)": "Admin OTP (6 digits)",
    "관리자에서 OTP를 비활성화한 경우 자동으로 숨김 처리됩니다.": "Automatically hidden when admin OTP is disabled.",
    "- 전송 처리 시 신청수량이 아니라 전송수량을 전송합니다.": "- When processing the transfer, the transfer amount (not the requested amount) is sent.",
    "반려 시 신청 금액은 환불 처리되고, 입력한 반려 사유가 사용자에게 표시됩니다.": "When rejected, the requested amount is refunded and the reject reason is shown to the user.",
    "반려 사유를 확인한 뒤 최종 반려를 진행하세요.": "Review the reject reason and then proceed with the final rejection.",
    "관리자 서명 전 계약만 반려할 수 있으며, 반려 시 투자금은 자동 환불되고 모금액에 합산되지 않습니다.": "Only contracts pending admin signature can be rejected. When rejected, the investment is auto-refunded and is not added to the funding total.",
    "settings 값(서비스 실제 적용값) 기준": "Based on settings value (actually applied value)",
    "settings 값(Actual Applied Value) Basis": "Based on settings value (actually applied value)",
    "* 히스토리는 DB 저장 행 기준으로 조회됩니다.": "* History is queried from rows saved in the database.",
    "파일이 저장될 때까지 잠시만 기다려주세요.": "Please wait while the file is being saved.",
    "선택 유저 상세": "Selected User Details",
    "목록에서 유저를 선택하세요.": "Select a user from the list.",
    "출금 요청 목록": "Withdrawal Request List",
    "최종 반려": "Final Reject",
    "자산별 SPL 토큰 주소": "Per-asset SPL token addresses",
    "네트워크 확인 중...": "Checking network…",
    "선택 요청": "Selected Request",
    "토큰 민트 주소": "Token Mint Address",
    "시간 / 처리": "Time / Action",
    "투자유저 스테이킹 이자의 몇 %를 추천인에게 추가 지급할지 설정합니다.": "Set the percentage of investor-user staking interest paid as an additional referral reward.",
    "투자유저의 수익은 100% 그대로 유지되며, 추천인 보상은 플랫폼에서 별도 지급됩니다.": "Investor-user returns are preserved at 100%; referral rewards are paid separately by the platform.",
    "추천인은 투자유저의": "Referrers earn from the investor user's",
    "솔라나 지갑 주소를 입력하세요": "Enter a Solana wallet address",
    "자산 ID 또는 이름 검색": "Search by asset ID or name",
    "토큰 출금 신청 관리": "Token Withdrawal Request Management",
    "출금 승인 시 Phantom으로 연결하는 관리자 지갑주소입니다.": "Admin wallet address connected via Phantom when approving withdrawals.",
    "관리자 출금 처리 지갑주소(Solana)": "Admin Withdrawal Processing Wallet Address (Solana)",
    "입금 전용 관리자 지갑주소(USDT)": "Dedicated Admin Deposit Wallet Address (USDT)",
    "관리자가 Phantom으로 연결해 출금 처리할 지갑주소": "Wallet address used by the admin via Phantom for withdrawal processing",
    "환경설정 · RECON RWA": "Settings · RECON RWA",
    "입/출금 거래내역 · RECON RWA": "Deposits / Withdrawals History · RECON RWA",
    "입금/출금 확정 기록(불변 로그) 조회": "View the deposit / withdrawal confirmation records (immutable log)",
    "이 Phantom 지갑에서 전송됩니다.": "is sent from this Phantom wallet.",
    "증빙/감정평가/회계 문서를 업로드하고 노출합니다. 매각 관련 문서도 이 페이지와 매각 관리 페이지에서 같은 데이터로 연동됩니다.": "Upload and display supporting, appraisal, and accounting documents. Sale-related documents are linked with the Sale Management page.",
    "구글지도에서 '공유→지도 퍼가기'의 iframe src를 붙여넣으세요. 비어있으면 지도 쿼리로 자동 생성됩니다.": "Paste the iframe src from Google Maps → Share → Embed. If left blank, it is generated automatically from the map query.",
    "구글지도에서 \u2018공유\u2192지도 퍼가기\u2019의 iframe src를 붙여넣으세요. 비어있으면 지도 쿼리로 자동 생성됩니다.": "Paste the iframe src from Google Maps → Share → Embed. If left blank, it is generated automatically from the map query.",
    // Text nodes that immediately follow a closing </strong> tag start with a leading
    // colon, so normalize() keeps that colon. Register them as exact entries so the
    // full sentence translates cleanly.
    ": 모집중이면 상태를 '모집실패'로, 구매진행이면 상태를 '취소됨'으로 바꾸고 참여자 USDT를 전액 환불합니다. 관리자 서명 대기 계약도 함께 반려됩니다.": ": if the asset is in Funding Open, the status changes to 'Funding Failed'; if it is in Acquiring, the status changes to 'Cancelled'. Participant USDT is fully refunded and contracts awaiting admin signature are also rejected.",
    ": 상태를 '구매진행'으로 변경합니다. 아직 토큰 분배/거래가 시작되기 전 단계입니다.": ": the status changes to 'Acquiring'. This is the stage before token distribution or trading begins.",
    ": 구매 완료 후 분배를 시작합니다. 토큰 발행량은 확정 모금액 기준 1 USDT = 1 Token 입니다.": ": distribution starts after acquisition. Token supply equals the locked funding amount at 1 USDT = 1 token.",
    // Standalone trailing "하세요." rendered as its own text node when split by <strong>.
    // Map it to just a period so the reconstructed sentence doesn't look odd.
    "하세요.": "."
  } };

  const EXTRA_EXACT_V7 = { en: {
    // 페이지 타이틀
    "관리자 대시보드 · RECON RWA": "Admin Dashboard · RECON RWA",
    "관리자 로그인 · RECON RWA": "Admin Login · RECON RWA",
    "매각/정산 관리 · RECON RWA": "Sale / Settlement · RECON RWA",
    "문서 관리 · RECON RWA": "Document Management · RECON RWA",
    "스테이킹/이자 설정 · RECON RWA": "Staking / Interest Settings · RECON RWA",
    "실시간 환율 · RECON RWA": "Live FX · RECON RWA",
    "유저 관리 · RECON RWA": "User Management · RECON RWA",
    "자산 등록/관리 · RECON RWA": "Asset Registration · RECON RWA",
    "출금 신청 관리 · RECON RWA": "Withdrawal Requests · RECON RWA",
    "추천인 관리 · RECON RWA": "Referrer Management · RECON RWA",
    "토큰 입금 승인 관리 · RECON RWA": "Token Deposit Approval · RECON RWA",
    "토큰 출금 관리 · RECON RWA": "Token Withdrawal · RECON RWA",
    "회계 통계 · RECON RWA": "Accounting · RECON RWA",
    "USDT 입금 승인 관리 · RECON RWA": "USDT Deposit Approval · RECON RWA",
    "RECON RWA 관리자": "RECON RWA Admin",

    // 자산 유형
    "공장 (FCT)": "Factory (FCT)",
    "농지 (FRM)": "Farmland (FRM)",
    "레지던스 (RSD)": "Residence (RSD)",
    "리조트 (RST)": "Resort (RST)",
    "빌딩 (BLD)": "Building (BLD)",
    "상가 (SHP)": "Shopping Mall (SHP)",
    "숙박시설 (HTL)": "Lodging (HTL)",
    "아파트 (APT)": "Apartment (APT)",
    "오피스 (OFC)": "Office (OFC)",
    "오피스텔 (OFT)": "Officetel (OFT)",
    "종교시설 (REL)": "Religious Facility (REL)",
    "주택 (HSE)": "House (HSE)",
    "창고 (WRH)": "Warehouse (WRH)",
    "토지 (LND)": "Land (LND)",
    "기타 (ETC)": "Other (ETC)",

    // 검색 placeholder
    "검색 (address / txid / memo)": "Search (address / txid / memo)",
    "검색(주소/수령주소)": "Search (from / to address)",
    "검색(지갑주소)": "Search (wallet address)",
    "검색(address/txid/memo)": "Search (address / txid / memo)",
    "자산 목록 검색": "Search asset list",
    "주소 / 자산 검색": "Search address / asset",
    "지갑주소 / 계약번호 검색": "Search wallet / contract no.",

    // 매각/정산
    "매각 실행 최종 확인": "Final Sale Execution Confirmation",
    "매각 환율(적용)": "Sale FX (Applied)",
    "매각/정산 관리": "Sale / Settlement",
    "매각/정산 입력": "Sale / Settlement Input",
    "매각세금 안내": "Sale Tax Guide",
    "매각일 기준 안내": "Sale Date Basis Guide",
    "매각일 안내": "Sale Date Guide",
    "매각차익금(정산통화)": "Sale Profit (Settlement Currency)",
    "매각일 기준 환율(참고용 자동 조회): -": "Sale Date FX (reference auto-lookup): -",
    "등록된 매각 문서": "Registered Sale Documents",
    "기타 매각비용 안내": "Other Sale Cost Guide",
    "총 매각금액 안내": "Total Sale Amount Guide",
    "총매각금(정산통화)": "Total Sale Amount (Settlement Currency)",
    "순매각금(정산통화)": "Net Sale Amount (Settlement Currency)",
    "취득원가(정산통화)": "Acquisition Cost (Settlement Currency)",
    "외부자금(정산통화)": "External Capital (Settlement Currency)",
    "플랫폼 유저 총 투자금(정산통화):": "Platform User Total Investment (Settlement Currency):",
    "플랫폼 유저 투자금액(USDT)": "Platform User Investment Amount (USDT)",
    "토큰당 가격(정산통화)": "Price Per Token (Settlement Currency)",
    "투자금액 확정환율 환산(정산통화)": "Investment at Locked FX (Settlement Currency)",
    "확정 모금액(USDT):": "Locked Funding (USDT):",
    "확정환율(모금 확정)": "Locked FX (Funding Confirmed)",
    "적용 예정 환율: -": "FX to be applied: -",
    "발행량(supply):": "Supply:",
    "총발행 토큰수량 안내": "Total Token Supply Guide",

    // 공용 라벨
    "-- 선택 --": "-- Select --",
    "0건 선택": "0 selected",
    "관리자 메모": "Admin Note",
    "관리자 비밀번호": "Admin Password",
    "관리자 서명 완료": "Admin Signature Completed",
    "관리자 스크립트 로드 실패": "Failed to load admin scripts",
    "관리자 입금 지갑주소(Solana)": "Admin Deposit Address (Solana)",
    "누적 수령(USDT)": "Cumulative Received (USDT)",
    "대기 (승인필요)": "Pending (Needs Approval)",
    "목표 모금(USDT) *": "Target Funding (USDT) *",
    "물건지 국가 *": "Property Country *",
    "브라우저 캐시와 최신 파일이 맞지 않을 때 발생할 수 있습니다. 새로고침 후 다시 확인하세요.": "This can occur when the browser cache is out of sync with the latest files. Please refresh and try again.",
    "설정 출금지갑:": "Configured Withdraw Address:",
    "스테이킹 이자율 APR(%)": "Staking APR (%)",
    "스테이킹/이자 요약": "Staking / Interest Summary",
    "아이디/비밀번호로 관리자 페이지에 접속합니다.": "Access the admin panel with username and password.",
    "연이율(%)": "Annual Rate (%)",
    "자산 / 신청자": "Asset / Applicant",
    "자산 종류 *": "Asset Type *",
    "자산명 *": "Asset Name *",
    "전체 문서": "All Documents",
    "전체 선택": "Select All",
    "전체 자산": "All Assets",
    "정산통화 *": "Settlement Currency *",
    "주소 *": "Address *",
    "차트(유저)": "Chart (User)",
    "총 보너스(USDT)": "Total Bonus (USDT)",
    "최근 체결(전체)": "Recent Fills (All)",
    "추천인 보상률 (%)": "Referrer Bonus Rate (%)",
    "출금 반려 확인": "Confirm Withdrawal Rejection",
    "출금 수수료 설정": "Withdrawal Fee Settings",
    "현재 설정": "Current Settings",
    "현재 수수료": "Current Fee",
    "현재 제재 상태": "Current Restriction Status",
    "현재 API Base": "Current API Base",
    "마켓(유저)": "Market (User)",
    "문서 업로드": "Upload Document",
    "계약서 템플릿 선택": "Select Contract Template",
    "Solana 네트워크": "Solana Network",
    "API Base(선택)": "API Base (optional)",

    // 안내 라인 (리스트 bullet 포함)
    "- 매각 정산(/api/sales/*)": "- Sale Settlement (/api/sales/*)",
    "- 이자 지급(/api/interest/claim)": "- Interest Payment (/api/interest/claim)",
    "- 지급일: 해당 일에 \"이자 클레임\"이 활성화됩니다.": "- Payout day: 'Interest Claim' activates on that day.",
    "- 지급일: 해당 일에 \u201C이자 클레임\u201D이 활성화됩니다.": "- Payout day: 'Interest Claim' activates on that day.",

    // placeholder 예시 (PARTS "예: "로도 커버되지만 정확도 확보)
    "예: 1000 USDT (선택)": "Example: 1000 USDT (optional)",
    "예: funding_subscription": "Example: funding_subscription",
    "예: https://api.devnet.solana.com": "Example: https://api.devnet.solana.com",
    "예: BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu": "Example: BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu",
    "예: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "Example: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",

    // Google Maps placeholder
    "https://www.google.com/maps/embed?pb=... (선택)": "https://www.google.com/maps/embed?pb=... (optional)",
    "https://www.google.com/maps/embed?pb=... 또는 구글지도 공유 링크": "https://www.google.com/maps/embed?pb=... or a Google Maps share link"
  } };

  mergeLangMap(PARTS, EXTRA_PARTS_V7);
  mergeLangMap(EXACT, EXTRA_EXACT_V6);
  mergeLangMap(EXACT, EXTRA_EXACT_V7);

  // V8 — admin/js/*.js 하드코딩 한국어(innerHTML·textContent·toast) 121개 번역 추가
  const EXTRA_EXACT_V8 = {
    en: {
      // ─── 상태/뱃지 라벨 ───
      "⏳ 승인대기": "⏳ Pending Approval",
      "✓ 입금완료": "✓ Deposit Completed",
      "✕ 거절": "✕ Rejected",
      "처리완료": "Completed",
      "저장됨": "Saved",
      "비활성": "Inactive",
      "비활성화 (테스트모드)": "Inactive (Test Mode)",
      "매입중": "Acquiring",
      "양측 서명 완료": "Signed by Both Parties",

      // ─── 빈 상태 메시지 ───
      "내역이 없습니다.": "No records.",
      "자산이 없습니다.": "No assets.",
      "유저가 없습니다.": "No users.",
      "보유 내역이 없습니다.": "No holdings.",
      "보너스 내역이 없습니다.": "No bonus history.",
      "체결이 없습니다.": "No trades.",
      "거래 가능한 자산이 없습니다.": "No tradable assets.",
      "매각 자산이 없습니다.": "No sold assets.",
      "스테이킹 대상 자산이 없습니다.": "No stakeable assets.",
      "표시할 자산이 없습니다.": "No assets to display.",
      "등록된 자산이 없습니다.": "No registered assets.",
      "등록된 추천인이 없습니다.": "No registered referrers.",
      "추천한 유저가 없습니다.": "No referred users.",
      "지급 대상이 없습니다.": "No payout targets.",
      "(스테이킹 가능 자산 없음 — 분배중/운영중 자산만 표시)": "(No stakeable assets — only Distributing/Operating assets shown)",

      // ─── 완료/성공 메시지 ───
      "갱신 완료": "Refresh Complete",
      "새로고침 완료": "Refresh Complete",
      "저장 완료": "Save Complete",
      "상태 변경 완료": "Status Updated",
      "삭제 완료": "Delete Complete",
      "업로드 완료": "Upload Complete",
      "불러오기 완료": "Load Complete",
      "계약 반려 완료": "Contract Rejected",
      "구매진행 상태로 변경 완료": "Changed to Acquiring Status",
      "문서 등록 완료": "Document Registered",
      "문서 삭제 완료": "Document Deleted",
      "보안 설정 저장 완료": "Security Settings Saved",
      "입금 지갑주소 저장 완료": "Deposit Wallet Saved",
      "출금 지갑주소 저장 완료": "Withdraw Wallet Saved",
      "출금 수수료 저장 완료": "Withdraw Fee Saved",
      "환율 저장 완료": "FX Rates Saved",
      "자산 설정 저장 완료": "Asset Settings Saved",
      "운영 / 정산 / 발행 정보 저장 완료": "Operation / Settlement / Issuance Saved",
      "이미지 업로드 완료": "Image Upload Complete",
      "파일 업로드 완료": "File Upload Complete",
      "토큰 민트 주소 저장 완료": "Token Mint Address Saved",
      "테스트 데이터 초기화 완료": "Test Data Reset Complete",
      "취소 완료": "Cancellation Complete",
      "출금 반려 완료": "Withdrawal Rejected",
      "지갑 연결 완료": "Wallet Connected",
      "지갑 연결 해제": "Wallet Disconnected",

      // ─── 진행 중 메시지 ───
      "검증 중...": "Verifying...",
      "초기화 중...": "Resetting...",
      "취소 중...": "Cancelling...",
      "서명 준비 중...": "Preparing signature...",
      "서버 전송 중...": "Sending to server...",
      "선택 전송": "Selected Transfer",
      "지갑 상태 갱신": "Refresh Wallet Status",

      // ─── 오류/안내 메시지 ───
      "아이디/비밀번호를 입력하세요.": "Enter your ID and password.",
      "관리자 아이디와 비밀번호를 입력하세요.": "Enter admin ID and password.",
      "관리자 세션이 만료되었습니다. 다시 로그인하세요.": "Admin session expired. Please log in again.",
      "반려 사유를 입력하세요.": "Enter the rejection reason.",
      "자산을 선택하세요.": "Select an asset.",
      "계약을 선택하세요": "Select a contract.",
      "유저를 선택하세요.": "Select a user.",
      "요청을 선택하세요.": "Select a request.",
      "업로드할 파일을 선택하세요.": "Select a file to upload.",
      "업로드 시에는 구체적인 문서 유형을 선택하세요.": "Choose a specific document type before uploading.",
      "올바른 문서 유형을 선택하세요.": "Choose a valid document type.",
      "올바른 솔라나 지갑 주소를 입력하세요.": "Enter a valid Solana wallet address.",
      "삭제할 자산이 선택되지 않았습니다.": "No asset selected for deletion.",
      "자산을 찾을 수 없음": "Asset not found.",
      "매각 실행 체크를 먼저 선택하세요.": "Check the sale execution option first.",
      "매각일을 입력한 뒤 매각을 실행하세요.": "Enter sale date before executing.",
      "이미 매각 실행이 완료되었습니다.": "Sale execution already completed.",
      "이미 완료된 요청입니다.": "This request is already completed.",
      "현재 요청은 전송할 수 없습니다.": "This request cannot be sent.",
      "현재 요청은 취소할 수 없습니다.": "This request cannot be cancelled.",
      "현재 상태에서는 반려할 수 없습니다.": "Cannot reject in the current status.",
      "대기 상태에서만 반려할 수 있습니다.": "Rejection allowed only in pending status.",
      "대기 상태에서만 전송할 수 있습니다.": "Sending allowed only in pending status.",
      "추천인 식별값이 없습니다.": "Referrer identifier missing.",
      "추천인 주소를 입력하세요.": "Enter the referrer address.",
      "추천인 목록을 불러오지 못했습니다.": "Failed to load referrer list.",
      "관리자 출금지갑이 아직 설정되지 않았습니다.": "Admin withdraw wallet not set.",
      "이자 지급일과 정산 락 기간은 이 페이지에서 수정할 수 없습니다.": "Interest payday and lock days cannot be changed on this page.",
      "자산 상태 변경은 자산관리 페이지에서만 가능합니다.": "Asset status can only be changed on the Asset Management page.",
      "매각 상태 자산은 해당월 이자를 배정할 수 없습니다.": "Sold assets cannot accrue interest for that month.",
      "토큰 컨트랙트가 추가되어 있지 않습니다. 토큰 민트 주소를 먼저 입력하세요.": "Token contract not added. Enter token mint address first.",
      "필터를 초기화했습니다.": "Filter reset.",
      "고정 출금 수수료는 0 이상이어야 합니다.": "Fixed withdraw fee must be ≥ 0.",
      "퍼센트 수수료는 0 이상 100 미만이어야 합니다.": "Percent fee must be 0 ≤ v < 100.",
      "확인을 누르면 종료됩니다.": "Click OK to close.",
      "현재 저장된 최종 PDF가 없습니다. 상세 화면에서 서명본을 확인하세요.": "No finalized PDF saved. Check signed copy in detail view.",

      // ─── 에러 prefix (동적 문자열) ───
      "이미지 업로드 실패:": "Image upload failed:",
      "파일 업로드 실패:": "File upload failed:",
      "자산 삭제 완료:": "Asset deleted:",

      // ─── 테이블/필드 라벨 ───
      "모금:": "Funding:",
      "발행 예정:": "Scheduled Issuance:",
      "상태:": "Status:",
      "&middot; KYC 상태:": "· KYC Status:",
      "&middot; KYC 필수:": "· KYC Required:",

      // ─── 매각 관련 메시지 ───
      "매각일 기준 환율(참고용 자동 조회): 1 USDT = 1 USDT": "Sale-date FX (auto reference): 1 USDT = 1 USDT",
      "모금 확정 환율: -": "Locked Funding FX: -",
      "모금 확정 환율: 1 USDT = 1 USDT": "Locked Funding FX: 1 USDT = 1 USDT",
      "적용 예정 환율: 1 USDT = 1 USDT": "FX to apply: 1 USDT = 1 USDT",
      "실행 시 참고": "Reference on execution",
      "실행 전 해결이 필요한 항목": "Items to resolve before execution",
      "매각 실행은 완료되었지만 화면 동기화에 실패했습니다. 상단 새로고침으로 상태를 다시 확인하세요.": "Sale executed but screen sync failed. Refresh to see updated status.",
      "매각 실행이 완료되어 숫자 수정 및 상태 복구는 불가합니다. 문서 업로드만 계속할 수 있으며, 유저의 매각 자산 교환은 매각 실행일 이후 계속 가능합니다.": "Sale executed — numbers cannot be edited nor status reverted. Only document upload remains; user redemption continues after the execution date.",
      "저장만 된 상태입니다. 매각 실행 전까지는 복구 가능하며, 실행 후에는 복구할 수 없습니다.": "Saved only — recoverable before execution, not recoverable after."
    },
    ja: {
      "⏳ 승인대기": "⏳ 承認待ち",
      "✓ 입금완료": "✓ 入金完了",
      "✕ 거절": "✕ 却下",
      "처리완료": "処理完了",
      "저장됨": "保存済み",
      "비활성": "非アクティブ",
      "비활성화 (테스트모드)": "非アクティブ（テストモード）",
      "매입중": "買付中",
      "양측 서명 완료": "両者署名完了",
      "내역이 없습니다.": "履歴がありません。",
      "자산이 없습니다.": "資産がありません。",
      "유저가 없습니다.": "ユーザーがいません。",
      "보유 내역이 없습니다.": "保有履歴がありません。",
      "보너스 내역이 없습니다.": "ボーナス履歴がありません。",
      "체결이 없습니다.": "約定がありません。",
      "거래 가능한 자산이 없습니다.": "取引可能な資産がありません。",
      "매각 자산이 없습니다.": "売却済み資産がありません。",
      "스테이킹 대상 자산이 없습니다.": "ステーキング対象資産がありません。",
      "표시할 자산이 없습니다.": "表示する資産がありません。",
      "등록된 자산이 없습니다.": "登録された資産がありません。",
      "등록된 추천인이 없습니다.": "登録された紹介者がいません。",
      "추천한 유저가 없습니다.": "紹介されたユーザーがいません。",
      "지급 대상이 없습니다.": "支払い対象がありません。",
      "갱신 완료": "更新完了",
      "새로고침 완료": "更新完了",
      "저장 완료": "保存完了",
      "상태 변경 완료": "ステータス変更完了",
      "삭제 완료": "削除完了",
      "업로드 완료": "アップロード完了",
      "불러오기 완료": "読み込み完了",
      "계약 반려 완료": "契約却下完了",
      "문서 등록 완료": "文書登録完了",
      "문서 삭제 완료": "文書削除完了",
      "환율 저장 완료": "為替レート保存完了",
      "이미지 업로드 완료": "画像アップロード完了",
      "파일 업로드 완료": "ファイルアップロード完了",
      "취소 완료": "キャンセル完了",
      "지갑 연결 완료": "ウォレット接続完了",
      "지갑 연결 해제": "ウォレット接続解除",
      "검증 중...": "検証中...",
      "초기화 중...": "初期化中...",
      "취소 중...": "キャンセル中...",
      "서명 준비 중...": "署名準備中...",
      "서버 전송 중...": "サーバー送信中...",
      "아이디/비밀번호를 입력하세요.": "IDとパスワードを入力してください。",
      "반려 사유를 입력하세요.": "却下理由を入力してください。",
      "자산을 선택하세요.": "資産を選択してください。",
      "계약을 선택하세요": "契約を選択してください",
      "유저를 선택하세요.": "ユーザーを選択してください。",
      "요청을 선택하세요.": "リクエストを選択してください。",
      "업로드할 파일을 선택하세요.": "アップロードするファイルを選択してください。",
      "올바른 솔라나 지갑 주소를 입력하세요.": "正しいSolanaウォレットアドレスを入力してください。",
      "삭제할 자산이 선택되지 않았습니다.": "削除する資産が選択されていません。",
      "매각일을 입력한 뒤 매각을 실행하세요.": "売却日を入力してから売却を実行してください。",
      "이미 매각 실행이 완료되었습니다.": "既に売却実行が完了しました。",
      "이미 완료된 요청입니다.": "既に完了したリクエストです。",
      "현재 상태에서는 반려할 수 없습니다.": "現在のステータスでは却下できません。",
      "확인을 누르면 종료됩니다.": "OKで終了します。"
    },
    zh: {
      "⏳ 승인대기": "⏳ 等待审核",
      "✓ 입금완료": "✓ 入金完成",
      "✕ 거절": "✕ 已拒绝",
      "처리완료": "处理完成",
      "저장됨": "已保存",
      "비활성": "已停用",
      "비활성화 (테스트모드)": "已停用（测试模式）",
      "매입중": "购买中",
      "양측 서명 완료": "双方签名完成",
      "내역이 없습니다.": "无记录。",
      "자산이 없습니다.": "无资产。",
      "유저가 없습니다.": "无用户。",
      "보유 내역이 없습니다.": "无持仓记录。",
      "보너스 내역이 없습니다.": "无奖金记录。",
      "체결이 없습니다.": "无成交。",
      "거래 가능한 자산이 없습니다.": "无可交易资产。",
      "매각 자산이 없습니다.": "无已出售资产。",
      "스테이킹 대상 자산이 없습니다.": "无质押对象资产。",
      "표시할 자산이 없습니다.": "无可显示资产。",
      "등록된 자산이 없습니다.": "无已登记资产。",
      "등록된 추천인이 없습니다.": "无已登记推荐人。",
      "추천한 유저가 없습니다.": "无已推荐用户。",
      "지급 대상이 없습니다.": "无支付对象。",
      "갱신 완료": "更新完成",
      "새로고침 완료": "刷新完成",
      "저장 완료": "保存完成",
      "상태 변경 완료": "状态已更新",
      "삭제 완료": "删除完成",
      "업로드 완료": "上传完成",
      "불러오기 완료": "加载完成",
      "계약 반려 완료": "合同拒绝完成",
      "문서 등록 완료": "文档登记完成",
      "문서 삭제 완료": "文档删除完成",
      "환율 저장 완료": "汇率保存完成",
      "이미지 업로드 완료": "图片上传完成",
      "파일 업로드 완료": "文件上传完成",
      "취소 완료": "取消完成",
      "지갑 연결 완료": "钱包连接完成",
      "지갑 연결 해제": "钱包断开连接",
      "검증 중...": "验证中...",
      "초기화 중...": "初始化中...",
      "취소 중...": "取消中...",
      "서명 준비 중...": "签名准备中...",
      "서버 전송 중...": "服务器发送中...",
      "아이디/비밀번호를 입력하세요.": "请输入账号/密码。",
      "반려 사유를 입력하세요.": "请输入拒绝理由。",
      "자산을 선택하세요.": "请选择资产。",
      "계약을 선택하세요": "请选择合同",
      "유저를 선택하세요.": "请选择用户。",
      "요청을 선택하세요.": "请选择请求。",
      "업로드할 파일을 선택하세요.": "请选择要上传的文件。",
      "올바른 솔라나 지갑 주소를 입력하세요.": "请输入正确的 Solana 钱包地址。",
      "삭제할 자산이 선택되지 않았습니다.": "未选择要删除的资产。",
      "매각일을 입력한 뒤 매각을 실행하세요.": "请输入出售日期后再执行出售。",
      "이미 매각 실행이 완료되었습니다.": "出售已完成。",
      "이미 완료된 요청입니다.": "该请求已完成。",
      "현재 상태에서는 반려할 수 없습니다.": "当前状态下无法拒绝。",
      "확인을 누르면 종료됩니다.": "点击确认后关闭。"
    }
  };
  mergeLangMap(EXACT, EXTRA_EXACT_V8);

  // ===== V9: AMM liquidity management + token recycling (2026-04-24) =====
  const EXTRA_EXACT_V9_AMM = {
    en: {
      // section titles
      "AMM 유동성 관리": "AMM Liquidity Management",
      "AMM 토큰 재활용 매각": "AMM Token Recycle Sell",
      "AMM 모드": "AMM Mode",
      "AMM 축적 토큰": "AMM Accumulated Tokens",
      "현재 유동성(장부)": "Current Liquidity (Ledger)",
      "현재 AMM 오픈 주문": "Current AMM Open Orders",
      "운영 가이드": "Operations Guide",
      "모드 저장": "Save Mode",

      // descriptions
      "0.8 USDT 이하 저가 매도를 시스템이 자동 매수하는 AMM 풀을 관리합니다. 장부 방식(온체인 전송 없음)으로 동작합니다.":
        "Manages the AMM pool that auto-buys low-price sell orders (≤ 0.8 USDT). Operates on a ledger-only basis (no on-chain transfer).",
      "AMM 보유 토큰을 관리자가 지정한 가격/수량으로 오더북에 매도 등록합니다. 체결 대금은 자동으로 AMM 유동성 풀로 환원됩니다. AMM 자신은 수수료가 없습니다.":
        "Registers AMM-held tokens on the order book at an admin-specified price and quantity. Matched proceeds flow automatically back into the AMM liquidity pool. AMM itself pays no fee.",
      "비활성화 시 유동성 부담이 없어지지만, 0.8 USDT 이하 바닥가 보호가 사라집니다.":
        "Disabling removes liquidity pressure, but also removes floor-price protection below 0.8 USDT.",
      "충전(+): 유동성 증가. 회수(-): 현재 유동성에서 차감(0 미만 불가).":
        "Topup (+): increases liquidity. Withdraw (-): deducts from current liquidity (cannot go below 0).",
      "축적된 토큰은 아래 \"토큰 재활용 매각\"에서 오더북에 매도하여 USDT로 회수할 수 있습니다.":
        "Accumulated tokens can be sold on the order book below (\"Token Recycle Sell\") to recover USDT.",
      "AMM이 보유 중인 토큰만 목록에 표시됩니다.": "Only tokens currently held by AMM are listed.",
      "AMM 보유 수량 이하로만 가능합니다.": "Cannot exceed AMM's current holding.",
      "0.8 USDT 초과로 설정 권장 (AMM 자동 매수 트리거 회피).":
        "Recommended above 0.8 USDT (to avoid triggering AMM auto-buy).",
      "비워두면 무기한 등록됩니다.": "Leave blank for indefinite listing.",
      "현재 등록된 AMM 오픈 주문이 없습니다.": "No AMM open orders are currently registered.",

      // dropdown options
      "활성화 (0.8 USDT 이하 저가 매도 자동 매수)": "Enabled (auto-buy sells ≤ 0.8 USDT)",
      "비활성화 (오더북만 사용)": "Disabled (orderbook only)",
      "자산을 선택하세요...": "Select an asset...",

      // labels
      "조정 금액 (USDT)": "Adjustment Amount (USDT)",
      "매도 수량 (토큰)": "Sell Amount (Tokens)",
      "매도 가격 (USDT / 토큰)": "Sell Price (USDT / Token)",
      "만료일 (선택)": "Expiry Date (Optional)",

      // buttons
      "+ 충전": "+ Topup",
      "- 회수": "- Withdraw",
      "AMM 매도 주문 생성": "Create AMM Sell Order",

      // guidance / operational note
      "- 충전/회수는 장부 기록만이며 실제 온체인 USDT 전송이 발생하지 않습니다.":
        "- Topups/withdrawals are ledger-only; no on-chain USDT transfer occurs.",
      "- 유저가 0.8 USDT 이하로 매도하면 시스템이 이 풀에서 USDT를 차감하여 지불합니다.":
        "- When users sell at ≤ 0.8 USDT, the system deducts USDT from this pool to pay them.",
      "- 유동성이 0이면 저가 매도가 \"시스템 AMM 유동성이 부족합니다.\" 오류로 실패합니다.":
        "- If liquidity is 0, low-price sells fall back to the order book (no error).",
      "- 운영 권장: 평상시 20,000~50,000 USDT 유지.":
        "- Operational recommendation: maintain 20,000–50,000 USDT during normal operation.",

      // toasts
      "AMM 활성화 저장 완료": "AMM enabled (saved)",
      "AMM 비활성화 저장 완료": "AMM disabled (saved)",
      "AMM 매도 주문 생성 완료": "AMM sell order created",
      "AMM 매도 주문 생성 실패": "Failed to create AMM sell order",
      "AMM 주문 취소 완료": "AMM order cancelled",
      "취소 실패": "Cancellation failed",
      "충전 실패": "Topup failed",
      "회수 실패": "Withdrawal failed",
      "매도 주문 생성 실패": "Failed to create sell order",

      // validation / error messages (from admin_settings.php & settings.js)
      "자산을 선택하세요.": "Please select an asset.",
      "자산(asset_id)을 선택하세요.": "Please select an asset (asset_id).",
      "수량을 입력하세요.": "Please enter an amount.",
      "가격을 입력하세요.": "Please enter a price.",
      "가격은 숫자여야 합니다.": "Price must be a number.",
      "수량은 숫자여야 합니다.": "Amount must be a number.",
      "가격은 0보다 커야 합니다.": "Price must be greater than 0.",
      "수량은 0보다 커야 합니다.": "Amount must be greater than 0.",
      "한 번에 매도 가능한 수량은 10억 이하입니다.": "A single sell cannot exceed 1 billion tokens.",
      "자산을 찾을 수 없습니다.": "Asset not found.",
      "주문을 찾을 수 없습니다.": "Order not found.",
      "AMM 주문이 아닙니다.": "This is not an AMM order.",
      "이미 체결 완료되었거나 취소된 주문입니다.": "This order is already filled or cancelled.",
      "AMM 주소가 설정되지 않았습니다.": "AMM address is not configured.",
      "AMM 주소가 비어 있습니다.": "AMM address is empty.",
      "조정 금액은 숫자여야 합니다.": "Adjustment amount must be a number.",
      "조정 금액이 올바르지 않습니다.": "Adjustment amount is invalid.",
      "한 번에 조정 가능한 금액은 ±1억 USDT 이하입니다.": "A single adjustment cannot exceed ±100M USDT.",
      "조정 금액은 0이 아니어야 합니다.": "Adjustment amount must not be zero.",
      "enabled 값이 필요합니다.": "'enabled' value is required.",
      "0보다 큰 금액을 입력하세요.": "Enter an amount greater than 0.",
      "한 번에 조정 가능한 금액은 1억 USDT 이하입니다.": "A single adjustment cannot exceed 100M USDT.",
      "불러오기 완료": "Loaded",
      // V11: status line descriptions + accumulated tokens help + token unit
      "0.8 USDT 이하 저가 매도 시 자동 매수": "auto-buys sells at ≤ 0.8 USDT",
      "— 0.8 USDT 이하 저가 매도 시 자동 매수": "— auto-buys sells at ≤ 0.8 USDT",
      "오더북만 사용 (바닥가 보호 없음)": "orderbook only (no floor-price protection)",
      "— 오더북만 사용 (바닥가 보호 없음)": "— orderbook only (no floor-price protection)",
      "축적된 토큰은 가격이 회복되면 오더북에 매도하여 USDT로 회수할 수 있습니다.":
        "Accumulated tokens can be sold on the order book once prices recover, to recover USDT.",
      "축적된 토큰은 아래 \"토큰 재활용 매각\"에서 오더북에 매도하여 USDT로 회수할 수 있습니다.":
        "Accumulated tokens can be sold via 'AMM Token Recycle Sell' below to recover USDT.",
      "토큰": "tokens",
      // V11.1: side label inside Current AMM Open Orders list (renderAmmOpenOrders)
      "매도": "Sell",
      "매수": "Buy",
      // V12: sales.js admin sale page Korean fragments
      "기준 환율 이력이 없습니다.": "No reference FX history available.",
      "관리자 수동 환율을 입력하세요.": "Please enter Admin Manual FX.",
      "기준 환율 이력 없음": "No reference FX history",
      "환율 이력 없음": "No FX history",
      "참고값 조회에 실패했습니다.": "Failed to fetch reference value.",
    }
  };
  mergeLangMap(EXACT, EXTRA_EXACT_V9_AMM);

  const EXTRA_PARTS_V8_AMM = {
    en: {
      "AMM 유동성": "AMM Liquidity",
      "AMM 주문": "AMM order",
      "유동성": "Liquidity",
      "축적 토큰 없음": "No accumulated tokens",
      "토큰 재활용 매각": "Token Recycle Sell",
      "AMM 보유 토큰 부족": "AMM has insufficient tokens",
      "AMM 보유 토큰 부족.": "AMM has insufficient tokens.",
      "회수 금액이 현재 유동성보다 큽니다.": "Withdrawal amount exceeds current liquidity.",
      "매도 주문": "Sell order",
      "매수 주문": "Buy order",
      "무기한": "Indefinite",
      "자산 선택": "Select Asset",
      "보유": "Held",
      "요청": "Requested",
      "총량": "Total",
      "잔량": "Remaining",
      "만료": "Expires",
      "주문 ID": "Order ID",
      "가격": "Price",
      "수량": "Amount",
      "만료일": "Expiry Date",
      "현재 상태": "Current Status",
      "활성화": "Enabled",
      "비활성화": "Disabled",
      "충전": "Topup",
      "회수": "Withdraw",
      "충전 완료": "Topup complete",
      "회수 완료": "Withdrawal complete",
      // V9: token breakdown (보유 + 오픈주문)
      "오픈주문": "Open orders",
      "오픈 주문": "Open orders",
      // V12: sales.js fragments — 외부 비율 / 플랫폼 유저 비율 / 지분율
      "외부 비율": "External Ratio",
      "플랫폼 유저 비율": "Platform User Ratio",
      "지분율": "Stake Ratio",
      "기준 환율": "Reference FX",
      "환율 이력": "FX History",
      // V12: sales.js dynamic message fragments (template literals with ${date})
      "기준 환율 이력이 없습니다.": "no reference FX history available.",
      "관리자 수동 환율을 입력하세요.": "Please enter Admin Manual FX.",
      "기준 환율 이력 없음": "no reference FX history",
      "환율 이력 없음": "no FX history",
      "참고값 조회에 실패했습니다.": "Failed to fetch reference value.",
      "자동 조회는 참고용이므로 관리자 수동 환율을 입력한 뒤 저장/실행하세요.":
        "Auto-lookup is for reference only; please enter Admin Manual FX before save/execute.",
      "유저는 플랫폼 유저 할당총액을 기준으로 정산받으며, 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다.":
        "Users are settled based on the Platform User Allocation Total, and user exchange for sold assets starts from the sale execution date.",
      "매각일": "Sale Date",
      "매각일 기준 환율(참고용 자동 조회)": "Sale Date Reference FX (auto-lookup, reference only)",
      // V10: audit log
      "AMM 관리자 감사 로그": "AMM Admin Audit Log",
      "감사 로그 없음": "No audit logs",
      "AMM 활성화": "AMM Enabled",
      "AMM 비활성화": "AMM Disabled",
      "매도 주문 생성": "Create Sell Order",
      "매도 주문 취소": "Cancel Sell Order",
      "자산": "Asset",
      "수량/금액": "Qty/Amount",
      "잔고": "Balance",
      "주문": "Order",
      "동시 오픈 AMM 주문은 1,000건 이하로 제한됩니다.": "Concurrent open AMM orders are limited to 1,000.",
      "기존 주문을 취소한 뒤 재시도하세요.": "Cancel existing orders and retry.",
      "가격은 0보다 커야 합니다. (음수 입력 차단)": "Price must be greater than 0. (Negative values blocked)",
      "수량은 0보다 커야 합니다. (음수 입력 차단)": "Amount must be greater than 0. (Negative values blocked)",
      "조정 금액은 0보다 커야 합니다. (음수 입력 차단)": "Adjustment amount must be greater than 0. (Negative values blocked)",
      "가격은 1,000,000 USDT 이하로 설정하세요.": "Price must not exceed 1,000,000 USDT.",
      "가격 값이 유효하지 않습니다.": "Price value is invalid.",
      "수량 값이 유효하지 않습니다.": "Amount value is invalid.",
      "action 은 'add' 또는 'subtract' 여야 합니다.": "Action must be 'add' or 'subtract'.",
      "충전·회수·AMM 모드 전환·매도 주문 생성·취소 이력 (최근 50건). 관리자·시간·IP 포함.":
        "Topup / withdraw / AMM mode toggle / sell-order create-cancel history (last 50). Includes admin, time, and IP.",
    }
  };
  mergeLangMap(PARTS, EXTRA_PARTS_V8_AMM);

  // (2026-05-06) Silica 스테이킹/이자율 통합 페이지 + 그 밖의 Silica 한정
  // 신규 문구를 위한 번역 블록. mergeLangMap 으로 PARTS 에 합쳐 부분 일치 매칭에 사용.
  const EXTRA_PARTS_V9_SILICA_STAKING = {
    en: {
      // Page header / title
      "스테이킹 설정 · SilicaChain": "Staking Settings · SilicaChain",
      "// 회차 단위 이자율 + 자산 파라미터 + 이자 계산/지급 테스팅":
        "// Cycle-based interest rate + asset params + interest calc/payout testing",

      // Hero card
      "매월 15일 USDT 자동 지급": "Auto USDT payout on the 15th of each month",

      // Rate change form
      "이자율 변경": "Change Interest Rate",
      "// 변경된 요율은 다음 회차부터 적용됩니다":
        "// New rate applies starting from the next cycle",
      "현재 이자율 (읽기 전용)": "Current Interest Rate (read-only)",
      "새 이자율": "New Interest Rate",
      "편집하기 버튼을 눌러 이자율을 변경하세요.":
        "Click 'Edit' to change the interest rate.",
      "변경 사유": "Reason for Change",
      "예: 시장 금리 상승 반영": "e.g. Reflect rising market rates",
      "예: 시장 금리 상승": "e.g. Rising market rates",
      "변경 시 적용 회차": "Effective Cycle on Change",
      "새 이자율 입력 후 표시됩니다.":
        "Displayed after entering a new rate.",
      "편집하기": "Edit",
      "변경 사항 저장": "Save Changes",
      "편집하기 버튼을 누르면 입력이 활성화됩니다. (관리자 지갑 연결 필요)":
        "Inputs become editable after clicking 'Edit'. (Admin wallet connection required)",
      "편집 모드 — 변경 사항 저장 후 모든 사용자에게 알림 팝업 자동 발송":
        "Edit mode — after saving, an announcement popup is auto-sent to all users.",

      // Cycle detection box
      "\"이번 회차\" 판별 로직": "\"Current Cycle\" Detection Logic",
      "// 실행일 ≤15: 당월, ≥16: 다음달":
        "// Run day ≤15: current month, ≥16: next month",
      "이번 회차 →": "Current Cycle →",
      "다음 회차 →": "Next Cycle →",
      "오늘:": "Today:",
      "지급)": "payout)",
      "요율": "Rate",
      "← 새 요율 적용 예정": "← new rate scheduled",
      "변경: ": "Change: ",
      "이번 회차: ": "Current cycle: ",
      "다음 회차부터: ": "Starting next cycle: ",
      " 유지": " (kept)",
      " 적용": " applies",

      // (2026-05-06) X월 회차 → "Month Cycle".
      // Pure-Korean key "월" → "Month" 가 다른 위치에 등록되어 있어
      // 이 항목들을 명시적으로 매칭(5-6자, 우선순위 ↑) 하지 않으면
      // "5월 회차" 같은 라벨이 "5Month Cycle" 로 깨진다.
      "1월 회차": "January Cycle",
      "2월 회차": "February Cycle",
      "3월 회차": "March Cycle",
      "4월 회차": "April Cycle",
      "5월 회차": "May Cycle",
      "6월 회차": "June Cycle",
      "7월 회차": "July Cycle",
      "8월 회차": "August Cycle",
      "9월 회차": "September Cycle",
      "10월 회차": "October Cycle",
      "11월 회차": "November Cycle",
      "12월 회차": "December Cycle",

      // Asset params / FX block
      "자산 파라미터 / 환율": "Asset Params / FX",
      "자산 설정 저장": "Save Asset Settings",
      "연 이율 APR(%)": "Annual APR (%)",
      "자산 등록 페이지에서 수정": "edit on the Asset Management page",
      "예: 8.5 (연 8.5%)": "e.g. 8.5 (annual 8.5%)",
      "연 이율 → 시스템이 12로 나눠 매월 15일에 월 이자 배정.":
        "Annual rate → divided by 12, monthly interest accrues on the 15th.",
      "페이지에서만 수정 가능합니다.": "page only.",

      // Interest calc preview card
      "100 TOKEN 기준 월 정산금액": "Monthly settlement amount per 100 TOKEN",
      "(절삭 없음 · 표기는 4자리)": "(no truncation · 4-digit display)",
      "100 TOKEN 최종 계정 반영 예정": "Final account posting per 100 TOKEN",
      "(USDT · 소수 첫째 자리)": "(USDT · 1 decimal)",
      "* 계산식(서버 동일): 원금 = 100 TOKEN × 확정환율 → 월이자 = 원금 × APR ÷ 12":
        "* Formula (matches server): Principal = 100 TOKEN × locked FX → Monthly interest = Principal × APR ÷ 12",
      "→ 지급일 환율로 USDT 환산 → 최종 USDT만 소수 둘째 자리 이하 버림":
        "→ Convert to USDT at the payout-day FX → only the final USDT is truncated below the 2nd decimal",

      // Interest payout testing card
      "지급 방식": "Payout Method",
      "선택 자산 전체 스테이커 대상": "Targets all stakers of the selected asset",
      "1개월분 자동 배정": "Auto-allocates one month",
      "기준": "Basis",
      "확정환율 → 월이자 계산": "Locked FX → monthly interest",
      "→ 지급일 환율로 USDT 환산": "→ converted to USDT at payout-day FX",
      "→ 최종 USDT만 소수 첫째 자리 반영": "→ final USDT keeps 1 decimal",
      "* 날짜와 관계없이 버튼을 누를 때마다 1개월 이자를 추가 배정합니다. 이미 같은 월 이력이 있어도 테스트용으로 중복 배정됩니다.":
        "* Regardless of date, each button press allocates an additional month of interest. If a record for the same month already exists, it is duplicated for testing.",

      // Rate change history table
      "변경 이력 (감사 로그)": "Change History (Audit Log)",
      "// 모든 이자율 변경은 자동 기록": "// All rate changes are auto-logged",
      "⟳ 새로고침": "⟳ Refresh",
      "변경일": "Change Date",
      "적용 시작 회차": "Effective Cycle",
      "이전 요율": "Previous Rate",
      "새 요율": "New Rate",
      "변경자": "Changed by",
      "사유": "Reason",
      "초기 설정": "Initial setup",
      " 회차": " Cycle",

      // Toast / dialog messages
      "관리자 지갑을 먼저 연결하세요.": "Connect the admin wallet first.",
      "새 이자율은 0 이상의 숫자여야 합니다.":
        "New interest rate must be a non-negative number.",
      "변경 사유를 입력하세요.": "Enter a reason for the change.",
      "저장 (다음 회차부터 적용 · API 연동 대기 중)":
        "saved (applies from next cycle · awaiting API integration)",

      // Misc Silica admin labels (popups / silica-price)
      "예: 광산 채굴 진척에 따른 가치 평가 조정":
        "e.g. Valuation adjustment per mining-progress",
      "오늘 하루 보지 않기": "Don't show today",

      // Common menu / button labels that may still leak through
      "스테이킹/이자": "Staking / Interest",
    }
  };
  mergeLangMap(PARTS, EXTRA_PARTS_V9_SILICA_STAKING);

  // make absolutely sure these dangerous short suffix keys never leak back in
  if (PARTS.en) {
    delete PARTS.en["하세요."];
    delete PARTS.en["합니다."];
    delete PARTS.en["됩니다."];
    delete PARTS.en["입니다."];
    delete PARTS.en["하세요"];
    // "개" by itself was added for stripping counters, but leave alone — the
    // regex path handles "3개" etc. and we don't want to accidentally erase
    // Korean text. So back it out if anything tries to rely on empty mapping.
    delete PARTS.en["개"];
  }

  // (2026-05-07) 전 admin 페이지 한글 텍스트 정밀 점검 후 추가된 번역.
  // 페이지 타이틀, 자산/배당/팝업/설정/대시보드/사용자 등 366건의 미번역
  // 문자열 중 가장 노출 빈도가 높은 라벨/문장을 우선 등록.
  const EXTRA_PARTS_V10_SILICA_FULL = {
    en: {
      // ───── Page titles (· SilicaChain pattern)
      "회계 통계 · SilicaChain": "Accounting · SilicaChain",
      "자산 정보 · SilicaChain": "Asset Info · SilicaChain",
      "자산 등록/관리 · SilicaChain": "Asset Management · SilicaChain",
      "전자계약 관리 · SilicaChain": "Contract Management · SilicaChain",
      "관리자 대시보드 · SilicaChain": "Admin Dashboard · SilicaChain",
      "USDT 입금 승인 관리 · SilicaChain": "USDT Deposit Approvals · SilicaChain",
      "연 배당 실행 · SilicaChain": "Annual Dividend · SilicaChain",
      "문서 관리 · SilicaChain": "Document Management · SilicaChain",
      "단체 메일 발송 · SilicaChain": "Bulk Email · SilicaChain",
      "실시간 환율 · SilicaChain": "Live FX · SilicaChain",
      "관리자 로그인 · SilicaChain": "Admin Login · SilicaChain",
      "공지 팝업 관리 · SilicaChain": "Notification Popups · SilicaChain",
      "추천인 관리 · SilicaChain": "Referral Management · SilicaChain",
      "매각/정산 관리 · SilicaChain": "Sales / Settlement · SilicaChain",
      "환경설정 · SilicaChain": "Settings · SilicaChain",
      "Silica 시세 관리 · SilicaChain": "Silica Price Management · SilicaChain",
      "토큰 입금 승인 관리 · SilicaChain": "Token Deposit Approvals · SilicaChain",
      "토큰 출금 관리 · SilicaChain": "Token Withdrawal Management · SilicaChain",
      "입/출금 거래내역 · SilicaChain": "Transaction History · SilicaChain",
      "유저 관리 · SilicaChain": "User Management · SilicaChain",
      "출금 신청 관리 · SilicaChain": "Withdrawal Request Management · SilicaChain",

      // ───── Common short labels (placement: after partial-match longer entries)
      "예: ": "e.g. ",
      "인원": "Headcount",
      "항목": "Item",
      "변동": "Change",
      "한국어": "Korean",
      "교체": "Replace",
      "즉시 반영": "Immediate effect",
      "다시 확인": "Re-check",
      "확인 중…": "Checking…",
      "수동 완료": "Manual Complete",
      "다시 진단": "Re-diagnose",
      "지금 분배하기": "Distribute Now",

      // ───── asset.html (mine-specific)
      "SiO₂ 순도": "SiO₂ Purity",
      "간단 설명 (한 줄)": "Brief description (one line)",
      "고순도 실리카 광산": "High-purity silica mine",
      "관할 (국가)": "Jurisdiction (Country)",
      "광산 면적": "Mine Area",
      "광산 특화 정보": "Mine-Specific Info",
      "광업권 번호": "Mining Right Number",
      "광업권 증서": "Mining Right Certificate",
      "대한민국 (Korea)": "Republic of Korea",
      "분석 보고서": "Analysis Report",
      "상세 설명 (English)": "Detailed Description (English)",
      "상세 설명 (한국어)": "Detailed Description (Korean)",
      "자산 문서": "Asset Documents",
      "자산 설명 (다국어)": "Asset Description (Multilingual)",
      "자산 이름 (영문)": "Asset Name (English)",
      "자산 이름 (한국어)": "Asset Name (Korean)",
      "자산 정보 편집": "Edit Asset Info",
      "총 매장량": "Total Reserves",
      "회수 가능량": "Recoverable Amount",
      "회수율": "Recovery Rate",
      "한국 271헥타르 고순도 실리카 광산 (SiO₂ 97.04%)":
        "Korea 271-hectare high-purity silica mine (SiO₂ 97.04%)",
      "한국에 위치한 271헥타르 규모의 고순도 석영 매장지. 일반 한국 광산이 90~93% 수준인 것에 비해 97.04% SiO₂ 함량을 자랑하며, 반도체 웨이퍼·광섬유·태양광 패널 제조에 적합한 프리미엄 등급의 원료 광산입니다.":
        "A 271-hectare high-purity quartz deposit located in Korea. With 97.04% SiO₂ content vs. the 90–93% typical for Korean mines, it is a premium-grade raw-material mine suitable for semiconductor wafers, optical fiber, and solar panel manufacturing.",
      "// 사용자 페이지에 표시될 상세 설명":
        "// Detailed description shown on the user-facing page",
      "// 투자자 공개용 문서 관리": "// Manage investor-facing documents",

      // ───── assets.html
      "됩니다. 이번 회차(가장 가까운 다가오는 15일 지급)는 기존 이율로 집행되어 버퍼 1회가 보장됩니다.":
        "applies. The current cycle (closest upcoming 15th payout) executes at the existing rate, ensuring a one-cycle buffer.",
      "모금 완료 시 확정": "Locked at funding completion",
      "모금 완료(매입 가정) 시점의 시장 환율이 자동 확정됩니다. 한번 확정 후 변경 불가.":
        "The market FX at funding-completion (acquisition-assumed) is auto-locked. Once locked, it cannot be changed.",
      "연 이율 기준으로 입력 → 시스템이 자동으로 12로 나눠 매월 15일에 월 이자 배정.":
        "Enter as annual rate → system divides by 12 automatically and accrues monthly interest on the 15th.",
      "예: 8.0 (연 8%)": "e.g. 8.0 (annual 8%)",
      "이자율 변경은 항상 '다음 회차' 지급일부터 적용":
        "Rate changes always apply from the 'next cycle' payout date",
      "최종환율 (모금 완료 시점 기준, 1 USDT =":
        "Final FX (at funding completion, 1 USDT =",

      // ───── contracts.html
      "⚠ 미수령 SilicaSTO 가 있습니다": "⚠ Unclaimed SilicaSTO present",
      "옛 정책 결함으로 토큰을 받지 못한 유저들에게 1:1 페그로 분배하고 팝업 알림을 자동 발송합니다. 안전하게 여러 번 눌러도 됩니다.":
        "Distributes tokens at 1:1 peg to users who couldn't receive tokens due to a legacy policy flaw, and auto-sends a popup notification. Safe to press multiple times.",

      // ───── dashboard.html
      "- USDT 예정": "- USDT scheduled",
      "// 24H 거래대금": "// 24H Trading Volume",
      "// STO 사전 발행": "// STO Pre-issued",
      "// 누적 분배 (장부)": "// Cumulative Distribution (ledger)",
      "// 다음 이자 지급일": "// Next Interest Payout",
      "// 미분배 STO 잔량 (장부)": "// Undistributed STO Balance (ledger)",
      "// 실패 / 취소": "// Failed / Cancelled",
      "// 환율 (USDT/KRW)": "// FX (USDT/KRW)",
      "2025년 연 배당 (Silica)": "2025 Annual Dividend (Silica)",
      "Reserve 영구 보관": "Reserve permanent custody",
      "▲ 4~5월 (배당 시즌)": "▲ Apr–May (dividend season)",
      "▲ 매월 15일": "▲ 15th of each month",
      "거래 / 주문 요약": "Trading / Order Summary",
      "거래소 미체결": "Exchange unfilled",
      "결산 후 실행": "Execute after settlement",
      "고정이자 자동 지급 (USDT)": "Fixed interest auto-payout (USDT)",
      "누적 수수료": "Cumulative Fees",
      "매각 / 정산 요약": "Sale / Settlement Summary",
      "매각 분모": "Sale Denominator",
      "매월 15일": "15th of each month",
      "반려·환불": "Rejected · Refunded",
      "배당 실행 →": "Run Dividend →",
      "사전 발행 − 누적 분배": "Pre-issued − Cumulative Distribution",
      "예정된 작업": "Scheduled Tasks",
      "유저 마켓 ↗": "User Market ↗",
      "자산 데이터 로딩 중...": "Loading asset data...",
      "잔량 (B/A)": "Remaining (B/A)",
      "주문수 (B/A)": "Orders (B/A)",
      "차트 ↗": "Chart ↗",
      "체결 데이터 로딩 중...": "Loading trade data...",
      "한국은행 API": "Bank of Korea API",
      "호가 데이터 로딩 중...": "Loading order-book data...",

      // ───── dividend.html
      "// USDT 기준 배당 풀 입력 → Silica 환산 분배":
        "// Enter dividend pool in USDT → distribute as Silica",
      "// 광산 운영 수익을 Silica 토큰으로 분배":
        "// Distribute mining-operation profits as Silica tokens",
      "// 지급일 이전까지 수정·취소 가능":
        "// Editable / cancellable until the payout date",
      "2025년 연 배당이 2026년 6월 15일에 지급됩니다.":
        "The 2025 annual dividend will be paid on June 15, 2026.",
      "425명": "425 users",
      "847명": "847 users",
      "~1,189명": "~1,189 users",
      "→ 1,000,000 Silica 분배 (시세 0.05 기준)":
        "→ 1,000,000 Silica distributed (at 0.05 price)",
      "▲ 6월 15일 (D-50)": "▲ June 15 (D-50)",
      "▸ 변경 시 자동 팝업 공지": "▸ Auto popup on change",
      "▸ 이번 회차는 선택 불가": "▸ Current cycle not selectable",
      "▸ 지급 단위: Silica 토큰 (소수점 2자리)":
        "▸ Unit: Silica token (2 decimals)",
      "▸ 지급 대상: 지급일 시점 스테이킹 유저":
        "▸ Recipients: stakers at the payout time",
      "▸ 지급일 = 선택 회차 15일": "▸ Payout date = 15th of selected cycle",
      "▸ 취소·수정: 지급일 이전까지 가능":
        "▸ Cancel / edit: allowed until payout date",
      "◆ 예상 분배 (현 시세 기준)":
        "◆ Estimated Distribution (at current price)",
      "⚠ 이번 회차(5월)는 선택 불가 — 투자자 액션 시간 확보 필요":
        "⚠ Current cycle (May) not selectable — investors need action time",
      "과거 배당 이력": "Past Dividend History",
      "광산 회계 결산 후 분배 가능 금액":
        "Distributable amount after mining accounting settlement",
      "발행 Silica 토큰": "Issued Silica Tokens",
      "배당 실행 (확인 모달 열기)": "Run Dividend (open confirmation modal)",
      "배당 풀": "Dividend Pool",
      "배당 풀 (USDT 가치)": "Dividend Pool (USDT value)",
      "배당 회차 선택": "Select Dividend Cycle",
      "사용자 페이지에 표시될 안내 메시지 (실행 시 자동 발송)":
        "Notification message shown on user pages (auto-sent on execution)",
      "새 배당 실행": "New Dividend Execution",
      "실행 규칙": "Execution Rules",
      "실행 후 지급일 이전까지 취소·수정 가능":
        "Cancellable / editable until the payout date after execution",
      "연 배당 실행": "Annual Dividend Execution",
      "예상 수령자 (현재 기준)": "Expected recipients (as of now)",
      "예정된 배당": "Scheduled Dividends",
      "유저 공지 팝업 콘텐츠": "User Notification Popup Content",
      "이번 배당은 광산 운영 수익을 Silica 토큰으로 지급하며, 6월 15일 시점 스테이킹 중인 투자자에게만 분배됩니다. 자세한 내용은 IR 페이지를 확인해주세요.":
        "This dividend pays Silica tokens from mining-operation profits, distributed only to investors actively staking on June 15. See the IR page for details.",
      "지금 시세로 락 (실행 시점 고정)":
        "Lock at current price (frozen at execution)",
      "지급일 거래소 API 시세 (상장 후)":
        "Exchange-API price on payout day (post-listing)",
      "지급일 시점 관리자 설정값 사용": "Use admin-set price at payout time",
      "평균 1인당 (예상)": "Avg per user (estimated)",
      "현재 Silica 시세:": "Current Silica price:",
      "Silica 시세 모드": "Silica Price Mode",

      // ───── docs.html
      "예: 100000 USDT": "e.g. 100000 USDT",

      // ───── emails.html
      "\"미리보기\" 버튼을 눌러 발송될 본문을 확인하세요.":
        "Click 'Preview' to confirm the body that will be sent.",
      "(최대 500자)": "(max 500 chars)",
      "— <script> 등 위험 태그 자동 제거": "— Risky tags like <script> are auto-stripped",
      "대상": "Target",
      "발송자": "Sender",
      "본문 (HTML 허용)": "Body (HTML allowed)",
      "성공": "Success",
      "수신자": "Recipient",
      "시각": "Time",
      "안녕하세요 RECON RWA입니다.": "Hello, this is RECON RWA.",
      "예: RECON RWA 공지 — 서비스 점검 안내":
        "e.g. RECON RWA Notice — Service Maintenance",
      "오류/시각": "Error / Time",
      "이메일": "Email",
      "인증된 이메일을 보유한 유저에게 공지/알림 메일을 발송합니다.":
        "Send notice / alert emails to users with verified email addresses.",
      "최근 50건": "Recent 50",

      // ───── login.html
      "API Base (선택)": "API Base (optional)",
      "Google Authenticator 6자리 코드": "Google Authenticator 6-digit code",
      "아이디·비밀번호·OTP로 관리자 페이지에 접속합니다.":
        "Sign in with username, password, and OTP.",
      "프론트와 백엔드가 다른 도메인일 때만 입력":
        "Only enter when frontend and backend are on different domains",

      // ───── popups.html
      "\"오늘 하루 보지 않기\" 버튼 활성화":
        "Enable 'Don't show today' button",
      "+ 새 팝업": "+ New Popup",
      "// 사용자 페이지에 표시되는 알림 팝업을 작성·관리":
        "// Compose and manage notification popups shown on user pages",
      "// 사용자에게 노출되는 화면": "// Screen shown to users",
      "// 사용자에게 노출될 안내 팝업을 작성합니다":
        "// Compose the announcement popup shown to users",
      "// 현재 사용자 페이지에서 표시되는 팝업 목록":
        "// Popups currently shown on the user page",
      "2025년 연 배당 실행 안내": "2025 Annual Dividend Notice",
      "5월 회차부터 6.00% 적용 예정": "6.00% applies from the May cycle",
      "KYC 완료 사용자만": "KYC-completed users only",
      "▸ Silica 시세 큰폭 변경 → 자동 팝업 생성":
        "▸ Large Silica-price change → auto popup",
      "▸ 배당 실행/취소 → 자동 팝업 생성":
        "▸ Dividend run / cancel → auto popup",
      "▸ 이자율 변경 → 자동 팝업 생성":
        "▸ Interest-rate change → auto popup",
      "▸ 점검 공지 → 수동 발송":
        "▸ Maintenance notice → sent manually",
      "◆ 배당 공지": "◆ Dividend Notice",
      "공지 팝업 관리": "Notification Popups",
      "노출 기간": "Display Period",
      "노출 대상": "Audience",
      "배당 공지": "Dividend Notice",
      "본 사용자": "Active Users",
      "본문 (English)": "Body (English)",
      "본문 (한국어)": "Body (Korean)",
      "비활성 시 매번 강제 노출": "Always shown when disabled",
      "사용자 페이지 팝업에 표시될 메시지":
        "Message shown in the user-page popup",
      "새 팝업 작성": "Compose New Popup",
      "스테이킹 유저 (847명)": "Stakers (847)",
      "스테이킹 중인 사용자만": "Active stakers only",
      "시작일": "Start Date",
      "실시간 미리보기": "Live Preview",
      "이번 배당은 광산 운영 수익을 Silica 토큰으로 지급하며, 6월 15일 시점 스테이킹 중인 투자자에게만 분배됩니다.":
        "This dividend pays Silica tokens from mining-operation profits, distributed only to investors actively staking on June 15.",
      "이벤트": "Event",
      "일반 공지": "General Notice",
      "자세한 내용은 IR 페이지를 확인해주세요.":
        "See the IR page for details.",
      "전체 (1,247명)": "All (1,247)",
      "전체 사용자": "All users",
      "점검 / 긴급 공지": "Maintenance / Urgent Notice",
      "종료일": "End Date",
      "중지": "Stopped",
      "진행중": "In progress",
      "특정 사용자 그룹": "Specific user group",
      "팝업 게시": "Publish Popup",
      "팝업 유형": "Popup Type",
      "활성 팝업 (사용자 노출 중)": "Active Popups (currently shown to users)",

      // ───── preview-mode.html
      "DB 없이 디자인을 검토하기 위한 임시 우회 모드입니다.":
        "Temporary bypass mode to review design without a DB.",
      "Preview 토큰 제거 (실제 로그인 모드로)":
        "Remove preview token (back to real login mode)",
      "localStorage에 더미 토큰을 설정하여 인증 체크를 통과합니다.":
        "Sets a dummy token in localStorage to bypass auth checks.",
      "• \"저장\" 버튼은 토스트만 표시 (DB 미연동)":
        "• 'Save' buttons only show a toast (DB not connected)",
      "• Preview 토큰은 클라이언트 측만 우회합니다":
        "• Preview tokens only bypass on the client side",
      "• 일부 페이지는 API 호출 실패로 데이터가 비어 있을 수 있습니다 (정상)":
        "• Some pages may show empty data due to API call failures (normal)",
      "• 콘솔에 일부 에러가 표시될 수 있습니다 (정상)":
        "• Some errors may appear in the console (normal)",
      "◆ Preview Mode 활성화": "◆ Activate Preview Mode",
      "⚠ Preview Mode 비활성 — 활성화 버튼을 누르세요.":
        "⚠ Preview Mode inactive — press the activate button.",
      "로그인 (디자인)": "Login (design)",
      "📌 알아두실 사항": "📌 Things to know",

      // ───── referrals.html
      "예: 1.0": "e.g. 1.0",

      // ───── sales.html
      "실제 취득원가 대비 플랫폼 유저 지분율만큼 플랫폼 유저 할당총액과 토큰당 교환금액이 자동 계산됩니다.":
        "Platform-user allocation total and per-token exchange amount are auto-calculated based on the platform-user equity ratio against actual acquisition cost.",
      "예: 1000000000": "e.g. 1000000000",
      "예: 120000000": "e.g. 120000000",
      "예: 1620000000": "e.g. 1620000000",
      "예: 30000000": "e.g. 30000000",
      "예: 59.72": "e.g. 59.72",
      "자산 생성 시 확정된 정산통화와 플랫폼 유저 총 투자금을 기준으로,":
        "Based on the settlement currency locked at asset creation and the platform-user total invested,",

      // ───── settings.html
      "// Devnet (테스트) / Mainnet (프로덕션) 토글":
        "// Toggle Devnet (test) / Mainnet (production)",
      "// 모든 출금에 USDT 고정 수수료 적용 (토큰 출금 포함)":
        "// Fixed USDT fee applies to all withdrawals (including token withdrawals)",
      "// 스테이킹 이자의 N% 추가 지급":
        "// Pay N% additional on staking interest",
      "// 시세 대비 일정 비율 이하 저가 매도 자동 매수 풀":
        "// Auto-buy pool for low-priced sells below a price threshold",
      "// 시스템(AMM) 보유 SilicaSTO 를 오더북에 매도 등록":
        "// Register system (AMM)-held SilicaSTO as order-book sells",
      "// 외부에서 발행한 SPL 토큰의 Mint 주소를 등록합니다.":
        "// Register the Mint address of externally issued SPL tokens.",
      "// 이 시세가 배당·스왑·거래 기준 가격에 동시 적용됩니다.":
        "// This price applies simultaneously to dividend, swap, and trading reference.",
      "// 충전·회수·매각 이력 (최근 50건)":
        "// Topup / withdraw / sale history (recent 50)",
      "// 테스트용 우회 토글. 프로덕션은 반드시 활성화.":
        "// Test-only bypass toggle. Must be enabled in production.",
      "// 토큰, 네트워크, 환율, 보안, AMM 등 핵심 설정":
        "// Core settings: tokens, network, FX, security, AMM, etc.",
      "// 프론트/백엔드 연결 확인": "// Verify frontend / backend connectivity",
      "// 한국 회계 기준 USDT ↔ KRW 환산용":
        "// USDT ↔ KRW conversion for Korea accounting",
      "1 SilicaSTO = 1 USDT 페그.": "1 SilicaSTO = 1 USDT peg.",
      "1 USDT peg · 투자증서 토큰": "1 USDT peg · investment-receipt token",
      "AMM 감사": "AMM Audit",
      "AMM 감사 로그": "AMM Audit Log",
      "AMM 매각": "AMM Sale",
      "Claim · 스테이킹 · 스왑 · 거래 · 매각 정산 모두 장부 처리.":
        "Claim · staking · swap · trading · sale settlement all use ledger entries.",
      "Devnet 설정": "Devnet config",
      "Devnet: 무료 테스트. Mainnet: 실제 거래.":
        "Devnet: free testing. Mainnet: real trading.",
      "Helius 등 사용. 비우면 기본 RPC.":
        "Use Helius etc. Default RPC if empty.",
      "STO 분배 정책 (Silica · 장부 모델)":
        "STO Distribution Policy (Silica · Ledger Model)",
      "Silica 1개당 USDT 가격. 변경 시 모든 사용자에게 알림.":
        "USDT price per Silica unit. All users are notified on change.",
      "Silica Mint (Token 2 · 보상 토큰)": "Silica Mint (Token 2 · Reward Token)",
      "SilicaSTO Mint (Token 1 · 투자증서)":
        "SilicaSTO Mint (Token 1 · Investment Receipt)",
      "SilicaSTO Mint 의 on-chain 총 발행량 (Solana RPC":
        "SilicaSTO Mint on-chain total supply (Solana RPC",
      "SilicaSTO 매도 주문 생성": "Create SilicaSTO Sell Order",
      "SilicaSTO 사전 발행량 (on-chain)":
        "SilicaSTO Pre-issued Supply (on-chain)",
      "SilicaSTO 판매": "SilicaSTO Sale",
      "on-chain 배포 및 보유 수량 추적용 reserve 지갑. 사이트 내부 거래(Claim/스테이킹/스왑/거래/매각)는 모두 장부 처리이며, 외부 출금 시에만 관리자가 수동 전송합니다.":
        "Reserve wallet for tracking on-chain distribution and balances. All in-platform actions (claim, staking, swap, trade, sale) are ledger entries; admin sends on-chain only on external withdrawal.",
      "① 연 배당 계산 (USDT 풀 → Silica 수량 환산)":
        "① Annual dividend calc (USDT pool → Silica unit conversion)",
      "② 단방향 스왑 비율 (Silica → SilicaSTO)":
        "② One-way swap ratio (Silica → SilicaSTO)",
      "③ 거래 페이지 시세 표시": "③ Trading-page price display",
      "거래소 API 자동 (상장 후 활성화)":
        "Exchange-API auto (enabled after listing)",
      "고정 수수료 (USDT)": "Fixed Fee (USDT)",
      "관리자 직접 설정 (현재)": "Admin-set (current)",
      "권장: 1.0 USDT (peg 가격)": "Recommended: 1.0 USDT (peg)",
      "기본 1%. 매각 차익은 보상 없음.":
        "Default 1%. No reward on sale gains.",
      "누적 분배(Claim) 수량 (장부 기준). 사전 발행량 1B 또는 reserve 잔량은 분모에 사용되지 않음.":
        "Cumulative distributed (Claim) amount (ledger basis). Pre-issued 1B or reserve balance is NOT used as denominator.",
      "매각 분배 계산식 분모:": "Sale-distribution formula denominator:",
      "매도 가격 (USDT)": "Sell Price (USDT)",
      "매도 수량 (SilicaSTO)": "Sell Amount (SilicaSTO)",
      "매도 호가가 이 값 이하면 시스템이 자동 매수합니다. (기본 0.80, 범위 0.01~1.00)":
        "If a sell ask drops to/below this value, the system auto-buys. (default 0.80, range 0.01–1.00)",
      "모금 시작 전 reserve 지갑에 1B STO 일괄 발행 → 영구 보관 (플랫폼 원장의 1:1 backing).":
        "Mints 1B STO into the reserve wallet before funding starts → permanent custody (1:1 backing of platform ledger).",
      "보안 (OTP / KYC)": "Security (OTP / KYC)",
      "보안 (OTP/KYC)": "Security (OTP / KYC)",
      "보유량:": "Balance:",
      "분배 트리거:": "Distribution trigger:",
      "비워두면 미설정.": "Leave empty for unset.",
      "비활성화 (오더북만)": "Disabled (order book only)",
      "비활성화 (테스트용)": "Disabled (testing)",
      "빈 값이면 same-origin 동작.": "Empty value → same-origin behavior.",
      "사이트 내부 이동:": "In-platform movement:",
      "사전 발행:": "Pre-issuance:",
      "사전 발행분을 보관 중인 지갑 주소":
        "Wallet address holding the pre-issued supply",
      "상세 관리 →": "Detailed Management →",
      "상장 전: 관리자가 직접 시세 입력. 상장 후: API 자동 호출 가능.":
        "Pre-listing: admin enters price manually. Post-listing: API auto-call available.",
      "시세 결정 모드": "Price-Determination Mode",
      "시스템 보유 토큰 판매": "System-Held Token Sale",
      "시장 가격 변동. 거래소 상장 가정. Decimals: 6 권장 (UI는 정수/2자리 표시).":
        "Market-price-driven. Exchange listing assumed. Decimals: 6 recommended (UI shows integer / 2 decimals).",
      "예: 5fHneW46xGXgs5mUiveM4rPQEyKfxxMGgB1qgYWQcHjJ":
        "e.g. 5fHneW46xGXgs5mUiveM4rPQEyKfxxMGgB1qgYWQcHjJ",
      "예: https://devnet.helius-rpc.com/?api-key=...":
        "e.g. https://devnet.helius-rpc.com/?api-key=...",
      "외부 출금:": "External withdrawal:",
      "외부에서 배포한 Silica Mint 주소를 입력":
        "Enter the Silica Mint address deployed externally",
      "외부에서 배포한 SilicaSTO Mint 주소를 입력":
        "Enter the SilicaSTO Mint address deployed externally",
      "유저 투자 → 관리자 계약 서명 → 유저 Claim 클릭 → 플랫폼 내부 원장(ledger) 에 보유 기록 (on-chain SPL Transfer ❌).":
        "User invests → admin signs contract → user clicks Claim → balance recorded in platform ledger (no on-chain SPL Transfer).",
      "유저가 외부 지갑으로 출금 신청 시에만 관리자가 reserve 에서 수동으로 on-chain SPL Transfer 실행.":
        "Admin executes an on-chain SPL Transfer from reserve manually only when a user requests an external-wallet withdrawal.",
      "유지:": "Kept:",
      "임계값 저장": "Save Threshold",
      "입금 전용 관리자 지갑": "Admin Deposit-Only Wallet",
      "입금 지갑": "Deposit Wallet",
      "입금 지갑 주소 (Solana)": "Deposit Wallet Address (Solana)",
      "자동 매수 모드": "Auto-Buy Mode",
      "자동 매수 유동성 관리": "Auto-Buy Liquidity Management",
      "자동 매수 임계값 (USDT 절대값)":
        "Auto-Buy Threshold (USDT absolute)",
      "적용 영향 (즉시 반영)": "Applied Effects (immediate)",
      "조회). 관리자 입력값이 아닌 블록체인상 실제 발행량입니다.":
        "query). The on-chain actual supply, not an admin-entered value.",
      "테스트 초기화": "Test Reset",
      "토큰 Mint": "Token Mint",
      "토큰 Mints": "Token Mints",
      "한국 회계 환산용 (필수)": "For Korea accounting (required)",
      "현재 Silica 시세 (USDT)": "Current Silica Price (USDT)",
      "현재 오픈 매도 주문": "Currently Open Sell Orders",
      "현재 유동성": "Current Liquidity",
      "환율 (FX)": "FX",
      "환율 (FX) — KRW": "FX — KRW",
      "활성화 (임계값 이하 자동 매수)":
        "Enabled (auto-buy below threshold)",

      // ───── silica-price.html
      "// A: 관리자 직접 / C: 거래소 API":
        "// A: admin direct / C: exchange API",
      "// 모든 변경은 자동 기록되며 사용자에게 공개됩니다":
        "// All changes are auto-logged and disclosed to users",
      "// 변경 시 자동으로 모든 사용자에게 알림":
        "// Auto-notify all users on change",
      "1 SilicaSTO = 1 USDT, 새 Silica 시세 / 1 USDT 기준":
        "1 SilicaSTO = 1 USDT, new Silica price / per 1 USDT",
      "A. 관리자 직접 설정": "A. Admin direct",
      "C. 거래소 API 자동 (미래 옵션)":
        "C. Exchange API auto (future option)",
      "Silica 시세 관리": "Silica Price Management",
      "Silica가 거래소 상장 후 활성화. Binance/Upbit 시세 자동 호출.":
        "Activated after Silica is listed. Auto-call Binance / Upbit price.",
      "거래 페이지 기준 시세 표시": "Trading-page reference price",
      "관리자 직접 설정 ·": "Admin Direct ·",
      "관리자가 시세를 직접 입력합니다. 거래소 미상장 단계에서 사용.":
        "Admin enters the price directly. Used pre-listing.",
      "단방향 스왑 비율 (Silica → SilicaSTO)":
        "One-way swap ratio (Silica → SilicaSTO)",
      "마지막 업데이트 4일 전": "Last update 4 days ago",
      "변경 사유 (감사 로그용)": "Change reason (for audit log)",
      "변경 시 모든 사용자에게 알림 팝업 자동 발송":
        "Auto-send a popup notification to all users on change",
      "변경 시간": "Change Time",
      "변경: 0.05 → 0.06 (+20.00%)": "Change: 0.05 → 0.06 (+20.00%)",
      "분기 평가 조정": "Quarterly valuation adjustment",
      "새 시세": "New Price",
      "스왑 비율 (자동 계산)": "Swap Ratio (auto)",
      "시세 변경": "Change Price",
      "시세 변경은 즉시 ① 배당 계산 ② 스왑 비율 ③ 거래 화면에 반영됩니다.":
        "Price changes immediately propagate to ① dividend calc ② swap ratio ③ trading screen.",
      "시세 업데이트": "Price Update",
      "연 배당 계산 (USDT 풀 → Silica 수량 환산)":
        "Annual dividend calc (USDT pool → Silica unit conversion)",
      "운영 시작 반영": "Operational start applied",
      "월 정기 평가": "Monthly periodic valuation",
      "이 시세가 적용되는 곳": "Places this price applies",
      "즉시 반영": "Immediate effect",
      "채굴 진척 반영": "Mining-progress reflected",
      "플랫폼 런칭": "Platform launch",
      "현재 시세 (읽기 전용)": "Current Price (read-only)",

      // ───── staking.html (residual)
      "예: 5.50": "e.g. 5.50",
      "지급) ·": "payout) ·",

      // ───── users.html
      "Holdings 진단·복구": "Holdings Diagnose · Repair",
      "funding_records 기준 source-of-truth":
        "funding_records as source-of-truth",
      "funding_records 기준 복구": "Reset from funding_records",
      "유저를 선택하면 진단이 자동으로 실행됩니다.":
        "Diagnosis runs automatically when you select a user.",

      // ───── withdrawals.html
      "processing 상태 — Solscan 검증 후 수동 완료":
        "processing — manually complete after Solscan verification",

      // ───── (2026-05-07) MECCA(MEA) 시세 연동 옵션
      "B. MECCA(MEA) 시세 연동 (테스트용)":
        "B. MECCA(MEA) Price Linking (testing)",
      "CoinLore 의 MEA 시세를 Silica 시세로 그대로 사용합니다. 상장 전 테스트 단계 한정.":
        "Use the CoinLore MEA price as the Silica price as-is. Pre-listing testing only.",
      "MECCA(MEA) → Silica 동기화": "MECCA(MEA) → Silica Sync",
      "CoinLore 의 MEA 시세를 즉시 가져와 적용합니다.":
        "Pulls the latest MEA price from CoinLore immediately and applies it.",
      "MEA 시세로 동기화": "Sync from MEA",
      "동기화 중…": "Syncing…",
      "CoinLore MEA 연동": "CoinLore MEA Link",
      "// A: 관리자 직접 / B: MEA 연동 (테스트용) / C: 거래소 API":
        "// A: Admin direct / B: MEA link (testing) / C: Exchange API",

      // ───── (2026-05-07) Mode-aware 시세 변경 패널
      "시세 변경 — 관리자 직접 입력":
        "Change Price — Admin Direct Entry",
      "// 새 시세를 직접 입력하고 즉시 반영합니다":
        "// Enter the new price manually and apply immediately",
      "시세 변경 — MECCA(MEA) 연동":
        "Change Price — MECCA(MEA) Link",
      "// CoinLore 의 MEA 시세를 즉시 Silica 시세로 복사합니다":
        "// Copy CoinLore's MEA price into the Silica price instantly",
      "현재 Silica 시세": "Current Silica Price",
      "아직 동기화되지 않았습니다. 아래 버튼을 눌러 가져오세요.":
        "Not yet synced. Click the button below to pull.",
      "CoinLore 의 MEA 시세가 적용되어 있습니다.":
        "CoinLore's MEA price is currently applied.",
      "마지막 동기화": "Last Sync",
      "아직 동기화되지 않았습니다.": "Not yet synced.",
      "시세 변경 — 거래소 API 자동":
        "Change Price — Exchange API Auto",
      "// Silica 거래소 상장 후 활성화 예정":
        "// Activates after Silica is listed on an exchange",
      "상장 대기 중": "Awaiting listing",
      "Silica 가 Binance / Upbit 등 거래소에 상장되면 이 모드가 활성화되어":
        "Once Silica is listed on Binance / Upbit, etc., this mode will activate and",
      "거래소 공개 가격 API 를 자동 폴링해 시세를 갱신합니다.":
        "automatically poll the exchange's public price API to update the price.",
      "지금은 모드 A (관리자 직접) 또는 모드 B (MEA 연동) 를 사용해 주세요.":
        "For now, please use mode A (Admin direct) or mode B (MEA link).",
      "상장 후 활성화": "Activate after listing",

      // (2026-05-07) 시세 변경 이력 부제 — manual 만 기록 정책으로 변경.
      "// 관리자 직접 설정 기록만 로그에 남습니다":
        "// Only manual admin entries are recorded here",

      // (2026-05-07) Swap 수수료 settings 섹션
      "스왑 수수료": "Swap Fee",
      "// Silica → SilicaSTO 변환 시 차감되는 % 수수료 (0 ~ 10)":
        "// Percent fee deducted on Silica → SilicaSTO swap (0 ~ 10)",
      "수수료율 (%)": "Fee Rate (%)",
      "0% 입력 시 무료. swap.html 의 Sync Price 시 quote 와 함께 잠금되어 execute 시 그 값으로 차감됩니다.":
        "Enter 0 for free. The fee is locked with the quote at Sync Price and deducted at execute.",
      "현재 수수료율": "Current Fee Rate",
      "0% (무료)": "0% (Free)",
      "스왑 수수료 저장 완료": "Swap fee saved.",
      "스왑 수수료는 숫자여야 합니다.": "Swap fee must be a number.",
      "스왑 수수료는 0 이상이어야 합니다.": "Swap fee must be ≥ 0.",
      "스왑 수수료는 10% 이하로 설정해야 합니다.": "Swap fee must be ≤ 10%.",

      // ───── (2026-05-07) USDT-fixed 단순화 후 신규 라벨
      "자산 파라미터": "Asset Parameters",
      "100 TOKEN 연 이자": "Annual Interest per 100 TOKEN",
      "100 TOKEN 월 이자": "Monthly Interest per 100 TOKEN",
      "* 계산식: 1 TOKEN = 1 USDT 페그 → 연이자 = 스테이킹 수량 × APR, 월이자 = 연이자 ÷ 12 (USDT)":
        "* Formula: 1 TOKEN = 1 USDT peg → Annual = Staked × APR, Monthly = Annual ÷ 12 (USDT)",
      "연이자 = 스테이킹 수량 × APR,": "Annual = Staked × APR,",
      "월이자 = 연이자 ÷ 12 (USDT)": "Monthly = Annual ÷ 12 (USDT)",
      "월이자 = 스테이킹 수량 × APR ÷ 12 (USDT)":
        "Monthly = Staked × APR ÷ 12 (USDT)",
      "월이자 = 스테이킹 수량 × APR ÷ 12":
        "Monthly interest = Staked × APR ÷ 12",
      "월이자 = 스테이킹 수량 × APR ÷ 12 (USDT, 소수 첫째 자리 반영)":
        "Monthly interest = Staked × APR ÷ 12 (USDT, 1-decimal rounding)",
      "* 계산식: 1 TOKEN = 1 USDT 페그 →":
        "* Formula: 1 TOKEN = 1 USDT peg →",
      "* 계산식: 1 TOKEN = 1 USDT 페그 → 월이자 = 스테이킹 수량 × APR ÷ 12 (USDT, 소수 첫째 자리 반영)":
        "* Formula: 1 TOKEN = 1 USDT peg → Monthly interest = Staked × APR ÷ 12 (USDT, 1-decimal rounding)",

      // ───── 잔여 짧은 라벨 / 회차 패턴
      "스테이킹 / 이자": "Staking / Interest",
      "Silica 시세": "Silica Price",
      "예정": "Scheduled",
      "공지 팝업": "Notice Popups",
      "배당 실행": "Run Dividend",
      "자산 정보": "Asset Info",
      "2026-01 회차": "2026-01 Cycle",
      "2026-06 회차 (6/15 지급) ← 다음 회차부터 선택 가능":
        "2026-06 Cycle (6/15 payout) ← selectable from next cycle",
      "2026-07 회차 (7/15 지급)": "2026-07 Cycle (7/15 payout)",
      "2026-08 회차 (8/15 지급)": "2026-08 Cycle (8/15 payout)",
      "2026-09 회차 (9/15 지급)": "2026-09 Cycle (9/15 payout)",
      "예: 0.05": "e.g. 0.05",
      "예: 1": "e.g. 1",
      "예: 1000": "e.g. 1000",
      "예: 10000": "e.g. 10000",
      "예: 1400": "e.g. 1400",
      "<p>안녕하세요 RECON RWA입니다.</p>&#10;<p>...</p>":
        "<p>Hello, this is RECON RWA.</p>&#10;<p>...</p>",
    }
  };
  mergeLangMap(PARTS, EXTRA_PARTS_V10_SILICA_FULL);

  function getLang() {
    const raw = String(localStorage.getItem(STORAGE_KEY) || 'ko').trim().toLowerCase();
    return raw === 'en' ? 'en' : 'ko';
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, String(lang || 'ko').trim().toLowerCase() === 'en' ? 'en' : 'ko');
  }

  function locale() { return LOCALES[getLang()] || 'ko-KR'; }
  function normalize(text) { return String(text || '').replace(/\s+/g, ' ').trim(); }
  function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function ordinalSuffix(num) {
    const n = Number(num);
    if (!Number.isFinite(n)) return String(num);
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    const mod10 = n % 10;
    if (mod10 === 1) return `${n}st`;
    if (mod10 === 2) return `${n}nd`;
    if (mod10 === 3) return `${n}rd`;
    return `${n}th`;
  }
  const STATUS_PREFIX_WORDS = ['미매각','미Sale','매각완료','매각','Sale Completed','Sale','Unsold','Sold'];
  function stripStatusPrefix(value) {
    let out = String(value || '').trim();
    for (let i = 0; i < 3; i += 1) {
      const match = out.match(/^\[([^\]]+)\]\s*/);
      if (!match) break;
      const inner = match[1].trim();
      const matched = STATUS_PREFIX_WORDS.some((word) => inner === word);
      if (!matched && !/^[A-Za-z가-힣 ()/·•-]+$/.test(inner)) break;
      out = out.slice(match[0].length);
    }
    return out.trim();
  }
  function isLikelyAssetName(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (!/[가-힣]/.test(raw)) return false;
    // reject corrupted names that already contain english words from previous partial translation
    if (/[A-Za-z]{3,}/.test(raw)) return false;
    // reject translation tokens
    if (/__ADMIN_I18N_NAME_\d+__/.test(raw)) return false;
    // reject overly long strings - asset names are typically short
    if (raw.length > 40) return false;
    return true;
  }
  function ensureProtectedNames(root) {
    const scope = root && root.nodeType === 1 ? root : document;
    const set = window.__ADMIN_I18N_ASSET_NAMES__ instanceof Set ? window.__ADMIN_I18N_ASSET_NAMES__ : new Set();
    const addName = (value) => {
      const raw = normalize(value);
      if (!raw || !/[가-힣]/.test(raw)) return;
      const cleaned = stripStatusPrefix(raw);
      const patterns = [
        /^[A-Z][A-Z0-9_-]{1,}\s*[·•]\s*(.+)$/,
        /(?:Edit|편집)\s*:\s*[A-Z][A-Z0-9_-]{1,}\s*\((.+)\)$/,
        /^[A-Z][A-Z0-9_-]{1,}\s*\((.+)\)$/
      ];
      for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (!match) continue;
        const name = stripStatusPrefix(normalize(match[1]).replace(/\s*\(.*\)\s*$/, ''));
        if (isLikelyAssetName(name)) set.add(name);
      }
    };
    scope.querySelectorAll?.('option, td, th, div, span, strong, h1, h2, h3, h4, h5, h6, label, p, a, button').forEach((el) => addName(el.textContent || ''));
    // prune any corrupted names that sneaked in previously
    Array.from(set).forEach((existing) => {
      if (!isLikelyAssetName(existing)) set.delete(existing);
    });
    window.__ADMIN_I18N_ASSET_NAMES__ = set;
    return set;
  }
  function maskProtectedNames(text) {
    const raw = window.__ADMIN_I18N_ASSET_NAMES__ instanceof Set ? window.__ADMIN_I18N_ASSET_NAMES__ : new Set();
    const names = Array.from(raw).filter(isLikelyAssetName);
    if (!names.length) return { text: String(text ?? ''), tokens: [] };
    let out = String(text ?? '');
    const tokens = [];
    names.sort((a, b) => b.length - a.length).forEach((name, idx) => {
      if (!name || !out.includes(name)) return;
      const token = `__ADMIN_I18N_NAME_${idx}__`;
      out = out.replace(new RegExp(escapeRegExp(name), 'g'), token);
      tokens.push([token, name]);
    });
    return { text: out, tokens };
  }
  function unmaskProtectedNames(text, tokens) {
    let out = String(text ?? '');
    (tokens || []).forEach(([token, name]) => {
      out = out.replace(new RegExp(escapeRegExp(token), 'g'), name);
    });
    return out;
  }
  // (2026-05-06) 회차 라벨용 영어 월 이름 — "5월 회차" → "May Cycle".
  const MONTH_NAMES_EN = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  function applyRegexTranslations(text) {
    let out = String(text ?? '');
    out = out.replace(/\b오전\b/g, 'AM');
    out = out.replace(/\b오후\b/g, 'PM');
    out = out.replace(/총\s*([0-9][\d,]*)명/g, (_, n) => `Total ${n} users`);
    out = out.replace(/([0-9][\d,]*)건수/g, (_, n) => `${n} records`);
    out = out.replace(/([0-9][\d,]*)건(?![가-힣])/g, (_, n) => `${n} items`);
    out = out.replace(/([0-9][\d,]*)개(?![가-힣])/g, (_, n) => `${n} items`);
    out = out.replace(/([0-9][\d,]*)명(?![가-힣])/g, (_, n) => `${n} users`);
    // Koreans use the day-of-month marker 일 without an ASCII word break, so \b after 일
    // doesn't fire. Use a Hangul lookahead instead so "15일" or "지급일: 15일" render as "15th".
    out = out.replace(/(?<!~)(?<!\d-)(?<!\d)(\d{1,2})일(?![가-힣])/g, (_, n) => ordinalSuffix(n));
    out = out.replace(/14~16일/g, '14–16');

    // (2026-05-06) 이자율 회차 라벨.
    //   "5월 회차"        → "May Cycle"
    //   "2026-01 회차"   → "2026-01 Cycle"
    out = out.replace(/(\d{1,2})월\s*회차/g, (whole, n) => {
      const idx = parseInt(n, 10) - 1;
      return (idx >= 0 && idx < 12) ? `${MONTH_NAMES_EN[idx]} Cycle` : whole;
    });
    out = out.replace(/(\d{4})-(\d{1,2})\s*회차/g, (_, y, m) => `${y}-${m} Cycle`);

    return out;
  }

  function translateExact(value, lang) {
    const norm = normalize(value);
    if (!norm) return null;
    return EXACT[lang]?.[norm] || (lang !== 'en' ? EXACT.en?.[norm] : null) || null;
  }

  // A PARTS key is "pure Korean" if it contains only Hangul characters (no spaces/english/digits/punct).
  // For those keys we require Korean word boundaries so we don't corrupt longer Korean compounds
  // (e.g. "매각" -> "Sale" should NOT fire inside "미매각", "매각세금", or the asset name "밀양창고부지").
  function isPureKoreanKey(key) {
    return /^[가-힣]+$/.test(String(key || ''));
  }
  function buildKeyPattern(key) {
    const escaped = escapeRegExp(key);
    if (isPureKoreanKey(key)) {
      // Require non-Korean (or string boundary) on both sides. Korean has no word boundary in \b
      // so we use explicit lookarounds against the Hangul block.
      return new RegExp(`(?<![가-힣])${escaped}(?![가-힣])`, 'g');
    }
    return new RegExp(escaped, 'g');
  }
  function translateLoose(text, lang) {
    const masked = maskProtectedNames(text);
    let out = masked.text;
    const merged = Object.assign({}, PARTS.en || {}, PARTS[lang] || {});
    const keys = Object.keys(merged).sort((a,b)=> b.length - a.length);
    for (const key of keys) {
      if (!key || !out.includes(key)) continue;
      try {
        out = out.replace(buildKeyPattern(key), merged[key]);
      } catch (_) {
        // 특수문자 키 하나가 잘못돼도 전체 관리자 번역이 멈추지 않게 유지한다.
      }
    }
    out = applyRegexTranslations(out);
    return unmaskProtectedNames(out, masked.tokens);
  }

  function preservePadding(source, translated) {
    const lead = String(source).match(/^\s*/)?.[0] || '';
    const trail = String(source).match(/\s*$/)?.[0] || '';
    return `${lead}${translated}${trail}`;
  }

  function translateString(input, forcedLang) {
    const lang = forcedLang || getLang();
    const text = String(input ?? '');
    if (!text || lang === 'ko') return text;
    const exact = translateExact(text, lang);
    if (exact) return preservePadding(text, exact);
    if (text.includes('\n')) {
      return text.split(/(\n+)/).map((chunk) => (/^\n+$/.test(chunk) ? chunk : translateString(chunk, lang))).join('');
    }
    return translateLoose(text, lang);
  }

  function shouldProtectElement(el) {
    if (!(el instanceof Element)) return false;
    if (el.closest('[data-no-i18n="1"], [translate="no"]')) return true;
    const text = normalize(el.textContent || '');
    const meta = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`.toLowerCase();
    if (/assetname|tokenname|tokensymbol|assetsymbol|walletaddr|walletpill/.test(meta)) return true;
    const protectedNames = window.__ADMIN_I18N_ASSET_NAMES__ instanceof Set ? window.__ADMIN_I18N_ASSET_NAMES__ : new Set();
    if (text && protectedNames.has(text)) return true;
    if (/^(usdt|sol|recon rwa)$/i.test(text)) return true;
    // plain "LND001 · 밀양창고부지" style → fully protect
    if (/^[A-Z0-9_-]{2,}\s*[·•]\s*.+$/.test(text)) return true;
    // "[미매각] LND001 · 밀양창고부지" style → do NOT fully protect, so the bracket can be
    // translated (e.g. [Unsold]). Asset-name masking handles the Korean name inside.
    if (/^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(text)) return true;
    if (el.matches('option') && /^[A-Z0-9_-]{2,}\s*[·•]\s*.+$/.test(text)) return true;
    return false;
  }

  function protectNoI18n(root) {
    const scope = root && root.nodeType === 1 ? root : document;
    ensureProtectedNames(scope);
    const candidates = new Set();
    const selectors = ['[id*="assetname" i]','[id*="tokenname" i]','[id*="tokensymbol" i]','[id*="assetsymbol" i]','.mono','select option'];
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

  // 노드 레벨 캐시 (admin, EN 고정)
  const ADMIN_TRANSLATED_NODES = new WeakMap(); // textNode -> translated string

  function applyText(root) {
    if (getLang() === 'ko') return;
    const scope = root && root.nodeType === 1 ? root : document.documentElement;
    protectNoI18n(scope);
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    for (const textNode of nodes) {
      if (shouldSkipNode(textNode)) continue;
      const raw = textNode.nodeValue;
      if (!raw || !/[가-힣]/.test(raw)) continue;
      // 노드 레벨 캐시: 이미 번역된 결과와 동일하면 스킵
      const prev = ADMIN_TRANSLATED_NODES.get(textNode);
      if (prev === raw) continue;
      const translated = translateString(raw, 'en');
      if (translated !== raw) {
        textNode.nodeValue = translated;
        ADMIN_TRANSLATED_NODES.set(textNode, translated);
      } else {
        ADMIN_TRANSLATED_NODES.set(textNode, raw);
      }
    }
  }

  function applyAttrs(root) {
    if (getLang() === 'ko') return;
    const scope = root && root.nodeType === 1 ? root : document.documentElement;
    const elements = [scope, ...((scope && scope.querySelectorAll) ? scope.querySelectorAll('*') : [])];
    for (const el of elements) {
      if (!(el instanceof Element)) continue;
      if (el.closest('[data-no-i18n="1"], [translate="no"]')) continue;
      for (const attr of ['placeholder','title','aria-label']) {
        const raw = el.getAttribute(attr);
        if (raw && /[가-힣]/.test(raw)) {
          const translated = translateString(raw, 'en');
          if (translated !== raw) el.setAttribute(attr, translated);
        }
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
        const raw = el.value;
        if (raw && /[가-힣]/.test(raw) && /^(button|submit|reset)$/i.test(el.type || 'button')) {
          const translated = translateString(raw, 'en');
          if (translated !== raw) el.value = translated;
        }
      }
    }
    if (document.title && /[가-힣]/.test(document.title)) document.title = translateString(document.title, 'en');
  }

  function wrapNativeDialogs() {
    if (window.__ADMIN_I18N_DIALOGS_WRAPPED__) return;
    const rawAlert = window.alert?.bind(window);
    const rawConfirm = window.confirm?.bind(window);
    const rawPrompt = window.prompt?.bind(window);
    // (2026-05-08) Was hardcoded to 'en' which forced KO → EN translation
    // through a partial dictionary, producing broken hybrids like
    // "Selected Asset(SILICA-79907)의 스테이커들에게 1 itemsMonthly Interest를
    // 지금 immediately 배정합니다." Caller-side templates already handle
    // per-locale text (see admin/js/staking.js T[lang]); we just want a
    // no-op when lang === 'ko', which translateString does via the early
    // return on line ~3269. Pass current lang so dialogs render in whatever
    // locale the admin selected.
    if (rawAlert) window.alert = (message) => rawAlert(translateString(message, getLang()));
    if (rawConfirm) window.confirm = (message) => rawConfirm(translateString(message, getLang()));
    if (rawPrompt) window.prompt = (message, defaultValue) => rawPrompt(translateString(message, getLang()), defaultValue);
    window.__ADMIN_I18N_DIALOGS_WRAPPED__ = true;
  }

  function setHtmlLang() { document.documentElement.lang = getLang(); }

  function injectStyle() {
    if (document.getElementById('adminLangStyle')) return;
    const style = document.createElement('style');
    style.id = 'adminLangStyle';
    style.textContent = `
      .admin-lang-wrap{display:flex;align-items:center;gap:8px;min-width:0}
      .admin-lang-select{height:34px;padding:0 12px;border:1px solid var(--border,#dbe2ea);border-radius:999px;background:#fff;color:var(--text,#0f172a);font-size:13px;font-weight:700;box-shadow:0 6px 16px rgba(15,23,42,.06)}
      .admin-lang-floating{position:fixed;top:14px;right:14px;z-index:9999}
      html[lang="en"] .btn,
      html[lang="en"] .badge,
      html[lang="en"] .small-note,
      html[lang="en"] .muted,
      html[lang="en"] .help,
      html[lang="en"] .table th,
      html[lang="en"] .table td{white-space:normal;line-height:1.35;overflow-wrap:anywhere;word-break:break-word}
      html[lang="en"] .admin-top{align-items:flex-start}
      html[lang="en"] .admin-top .tagrow{flex-wrap:wrap}
      @media (max-width:900px){.admin-lang-select{height:32px;font-size:12px;padding:0 10px}}
    `;
    document.head.appendChild(style);
  }

  function selectorMarkup() {
    const current = getLang();
    return `
      <div class="admin-lang-wrap" data-admin-lang-switch="1">
        <select id="adminLangSelect" class="admin-lang-select" aria-label="Language">
          ${LANGS.map(x => `<option value="${x.code}" ${x.code===current?"selected":""}>${x.label}</option>`).join('')}
        </select>
      </div>`;
  }

  function bindSelect(root) {
    const sel = (root || document).querySelector('#adminLangSelect');
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
    let host = document.querySelector('.admin-top .tagrow');
    if (!host) {
      let floating = document.querySelector('.admin-lang-floating[data-admin-lang-host="1"]');
      if (!floating) {
        floating = document.createElement('div');
        floating.className = 'admin-lang-floating';
        floating.dataset.adminLangHost = '1';
        document.body.appendChild(floating);
      }
      if (!floating.querySelector('[data-admin-lang-switch="1"]')) floating.innerHTML = selectorMarkup();
      bindSelect(floating);
      return;
    }
    let switcher = document.querySelector('.admin-top [data-admin-lang-switch="1"]');
    if (!switcher) host.insertAdjacentHTML('afterbegin', selectorMarkup());
    bindSelect(document);
    const floating = document.querySelector('.admin-lang-floating[data-admin-lang-host="1"]');
    if (floating) floating.remove();
  }

  function apply(root) {
    // Always scan the full document for protected names so that asset names
    // registered in one panel are respected everywhere else on the page.
    ensureProtectedNames(document.documentElement);
    setHtmlLang();
    wrapNativeDialogs();
    injectSelector();
    protectNoI18n(root || document.documentElement);
    applyText(root || document.documentElement);
    applyAttrs(root || document.documentElement);
  }

  let watchTimer = null;
  function scheduleApply(root) {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => apply(root || document.documentElement), 60);
  }

  function watch() {
    if (window.__ADMIN_I18N_OBSERVER__) return;
    const obs = new MutationObserver((mutations) => {
      // Any meaningful mutation schedules a full re-apply. Processing only the
      // first mutation's target (as before) caused later async updates to be
      // missed when several fetches settle in the same tick.
      for (const m of mutations) {
        if (m.type === 'childList' || m.type === 'characterData') {
          scheduleApply(document.documentElement);
          return;
        }
      }
    });
    obs.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    window.__ADMIN_I18N_OBSERVER__ = obs;
  }

  function init() {
    apply();
    watch();
  }

  window.AdminI18n = { getLang, setLang, locale, translateString, translateMessage: translateString, injectSelector, apply, init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

})();
