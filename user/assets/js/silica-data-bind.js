/* silica-data-bind.js
 * 사용자 페이지의 신규 ID 들 (#kpiXxx, #balXxx, #walletXxx 등) 을
 * 실제 API 응답으로 채우는 단일 통합 바인더.
 *
 * 인증 안 된 상태: 기본값(0/empty) 유지 + KYC 미인증 안내
 * 인증 된 상태:    /api/portfolio + /api/public/config + /api/kyc/status 호출
 *
 * 모든 페이지에 1번 include — body[data-page] 로 자동 분기.
 */
(() => {
  "use strict";

  // (2026-05-18 v569) KYC 인증 정보 모달 — 승인된 사용자가 카드 CTA 클릭 시
  //   본인의 KYC 데이터를 확인. CSS 는 lazy-inject (한 번만). i18n KO/EN.
  function showKycInfoModal(kyc) {
    if (!kyc) return;
    const lang = (window.RwaI18n?.getLang?.() || 'en').toLowerCase() === 'ko' ? 'ko' : 'en';
    const t = (en, ko) => lang === 'ko' ? ko : en;
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

    if (!document.getElementById('__kycInfoStyle')) {
      const style = document.createElement('style');
      style.id = '__kycInfoStyle';
      style.textContent = `
        .kyc-info-modal { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: flex-start; justify-content: center; padding: 10vh 16px 0; }
        .kyc-info-backdrop { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.65); backdrop-filter: blur(6px); }
        .kyc-info-panel {
          position: relative; width: 100%; max-width: 480px;
          background: var(--panel, #fff); border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: 16px; padding: 24px; color: var(--text, #0f172a);
          box-shadow: 0 20px 50px rgba(0,0,0,0.30);
        }
        .kyc-info-panel::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #10B981, #059669, #10B981);
          border-radius: 16px 16px 0 0;
        }
        .kyc-info-head {
          display: flex; align-items: center; gap: 12px; margin-bottom: 18px;
        }
        .kyc-info-icon {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, #10B981, #059669);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 22px;
        }
        .kyc-info-title {
          font-family: 'Bebas Neue', 'Oswald', sans-serif;
          font-size: 22px; letter-spacing: 1px; margin: 0;
        }
        .kyc-info-table { display: grid; grid-template-columns: 130px 1fr; gap: 10px 14px; margin-bottom: 20px; }
        .kyc-info-label {
          font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--steel, #6b7280); font-weight: 600;
          align-self: center;
        }
        .kyc-info-value {
          font-size: 14px; word-break: break-word;
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          color: var(--text, #0f172a);
        }
        .kyc-info-value.mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
        .kyc-info-actions { display: flex; justify-content: flex-end; }
        .kyc-info-close {
          padding: 10px 22px;
          background: linear-gradient(135deg, #7c3aed, #06b6d4);
          color: #fff; border: none; border-radius: 8px;
          font-weight: 700; font-size: 13px; letter-spacing: 0.5px;
          cursor: pointer;
        }
        .kyc-info-close:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(124,58,237,0.30); }
      `;
      document.head.appendChild(style);
    }

    // doc type 라벨 매핑
    const DOC_TYPE_LABELS = {
      id_card:         t('National ID Card', '주민등록증/국가 ID'),
      drivers_license: t("Driver's License", '운전면허증'),
      passport:        t('Passport', '여권'),
    };
    const docTypeLabel = DOC_TYPE_LABELS[String(kyc.kyc_doc_type || '').toLowerCase()] || (kyc.kyc_doc_type || '—');
    const verifiedAt = (kyc.kyc_last_verified_at || '').slice(0, 19).replace('T', ' ');
    const docRegdate = (kyc.kyc_doc_regdate || '').slice(0, 10);

    const modal = document.createElement('div');
    modal.className = 'kyc-info-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="kyc-info-backdrop"></div>
      <div class="kyc-info-panel">
        <div class="kyc-info-head">
          <div class="kyc-info-icon">✓</div>
          <h2 class="kyc-info-title">${t('KYC Verified', 'KYC 인증 정보')}</h2>
        </div>
        <div class="kyc-info-table">
          <div class="kyc-info-label">${t('Name', '이름')}</div>
          <div class="kyc-info-value">${esc(kyc.mt_name || '—')}</div>
          <div class="kyc-info-label">${t('Date of Birth', '생년월일')}</div>
          <div class="kyc-info-value">${esc(kyc.mt_birth || '—')}</div>
          <div class="kyc-info-label">${t('Document Type', '신분증 종류')}</div>
          <div class="kyc-info-value">${esc(docTypeLabel)}</div>
          ${docRegdate ? `
          <div class="kyc-info-label">${t('Submitted', '제출일')}</div>
          <div class="kyc-info-value mono">${esc(docRegdate)}</div>
          ` : ''}
          ${verifiedAt ? `
          <div class="kyc-info-label">${t('Verified At', '인증 완료')}</div>
          <div class="kyc-info-value mono">${esc(verifiedAt)} UTC</div>
          ` : ''}
          ${kyc.kyc_extracted_name && kyc.kyc_extracted_name !== kyc.mt_name ? `
          <div class="kyc-info-label">${t('Extracted Name', '문서 인식 이름')}</div>
          <div class="kyc-info-value">${esc(kyc.kyc_extracted_name)}</div>
          ` : ''}
          ${kyc.kyc_extracted_birth && kyc.kyc_extracted_birth !== kyc.mt_birth ? `
          <div class="kyc-info-label">${t('Extracted Birth', '문서 인식 생년월일')}</div>
          <div class="kyc-info-value">${esc(kyc.kyc_extracted_birth)}</div>
          ` : ''}
          <div class="kyc-info-label">${t('Wallet', '지갑 주소')}</div>
          <div class="kyc-info-value mono" style="font-size:11px;">${esc(kyc.address || '—')}</div>
        </div>
        <div class="kyc-info-actions">
          <button class="kyc-info-close" type="button">${t('Close', '닫기')}</button>
        </div>
      </div>
    `;
    const closeFn = () => modal.remove();
    modal.querySelector('.kyc-info-backdrop')?.addEventListener('click', closeFn);
    modal.querySelector('.kyc-info-close')?.addEventListener('click', closeFn);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { closeFn(); document.removeEventListener('keydown', onEsc); }
    });
    document.body.appendChild(modal);
  }

  // ─── 안전한 fetch 도우미 (core.js 의 api 가 있으면 그걸 우선) ───
  // (2026-05-14 v354) 운영자: '오늘 14일인데 스테이킹과 언스테이킹이 유저
  //   ui에서 작동하는 것 처럼 보인다.' 진단: 기존 apiCall 은 throw 를 일괄
  //   catch → null 반환. read API 의 graceful degrade 목적이지만, POST 같은
  //   mutation 도 동일하게 null 반환되어 backend 가 400/500 거부해도 UI 가
  //   '성공' 으로 처리 (false-success). 14~16일 lock 거부 + 잔액 부족 + 자산
  //   상태 차단 등 모든 거부가 사용자에게 보이지 않는 광범위 버그.
  //   수정: mutation (POST/PUT/PATCH/DELETE) 만 throw 보존 → 호출 측의 catch
  //   가 backend 메시지를 toast 로 표시. read (GET / method 미지정) 는 기존
  //   동작 (null fallback) 유지.
  const _isMutation = (opt) => {
    const m = String(opt?.method || "GET").toUpperCase();
    return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
  };
  const apiCall = async (path, opt = {}) => {
    if (window.RwaCore?.api) {
      try { return await window.RwaCore.api(path, opt); }
      catch (e) {
        if (_isMutation(opt)) throw e;
        return null;
      }
    }
    // fallback: 직접 fetch (RwaCore 미로드 시)
    try {
      const headers = { Accept: "application/json", "Content-Type": "application/json" };
      if (opt.auth !== false) {
        const w = JSON.parse(localStorage.getItem("rwa_wallet_v3") || "{}");
        if (w.token) headers.Authorization = `Bearer ${w.token}`;
        else if (w.address) headers["x-wallet"] = w.address;
      }
      const method = String(opt?.method || "GET").toUpperCase();
      const init = { method, headers, credentials: "include" };
      if (opt?.body != null && method !== "GET" && method !== "HEAD") {
        init.body = typeof opt.body === "string" ? opt.body : JSON.stringify(opt.body);
      }
      const res = await fetch(path, init);
      if (!res.ok) {
        if (_isMutation(opt)) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || data?.error || `요청 실패 (${res.status})`);
        }
        return null;
      }
      return await res.json();
    } catch (e) {
      if (_isMutation(opt)) throw e;
      return null;
    }
  };

  // ─── 포맷 유틸 ───
  const fmtN = (n, d = 2) => {
    const x = Number(n);
    if (!isFinite(x)) return "0";
    return x.toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  };
  // (2026-05-18 v514) USDT 표기 3자리 정밀 — 거래 수수료 0.5% 단위 노출.
  const fmtUsdHtml = (v) => {
    const n = Number(v) || 0;
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    const intPart = Math.floor(abs).toLocaleString("en-US");
    const dec = (abs.toFixed(3).split(".")[1] || "000");
    return `${sign}$${intPart}<small>.${dec}</small>`;
  };
  // (2026-05-11 v235) Operator: '소수점은 폰트 크기가 작아야한다.'
  //   Portfolio token-balance numbers (USDT / SilicaSTO / Silica)
  //   render as a big integer portion + a small <small> decimal so
  //   the eye anchors to the dollar amount, not the cents.
  const fmtBalHtml = (v, d = 2) => {
    const n = Number(v) || 0;
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    const intPart = Math.floor(abs).toLocaleString("en-US");
    if (d <= 0) return `${sign}${intPart}`;
    const decStr = abs.toFixed(d).split(".")[1] || "0".repeat(d);
    return `${sign}${intPart}<small>.${decStr}</small>`;
  };

  // (2026-05-22 v780) 운영자 요청: '10000 부터는 B 로 표기 가능하도록.'
  //   큰 금액 (4자리 이상) 에서 표시 폭이 길어 좁은 viewport 에서 깨짐.
  //   표준 abbreviated notation 적용:
  //     < 1,000,000   : 기존 fmtBalHtml 패턴 (풀 값 그대로)
  //     1M ~ 999M     : M 표기 (예: 1.2M, 99.9M)
  //     1B ~ 999B     : B 표기 (예: 1.5B)
  //     1T+           : T 표기 (예: 1.2T)
  //   100 이상 → 소수점 없음 (100M, 999M 등)
  //   100 미만 → 소수점 1자리 (1.2M, 9.9M)
  //   소수점 부분은 <small> 로 감싸 작게 표시 (단위 M/B/T 도 <small>).
  //
  // (2026-06-08 v895) 운영자 요청 — M 단위 (>= 1,000,000) 부터만 약식 표기.
  //   K 단위 (10K~999K) 는 풀 값 그대로 노출 (예: 999,000.000).
  const fmtBalAbbrev = (v, dBelow10K = 2) => {
    const n = Number(v) || 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";

    if (abs < 1000000) {
      // 1,000,000 미만: 풀 값 (K 약식 없음)
      return fmtBalHtml(v, dBelow10K);
    }

    // (v895) K 단위 항목 제거 — 위 early return 이 abs < 1,000,000 을 차단하므로
    //   K 자리에 도달할 수 없음. 코드 명확성 위해 제거.
    const tiers = [
      { v: 1e12, s: "T" },
      { v: 1e9,  s: "B" },
      { v: 1e6,  s: "M" }
    ];
    for (const tier of tiers) {
      if (abs >= tier.v) {
        const num = abs / tier.v;
        if (num >= 100) {
          // 100K, 999M 같이 정수만
          const intPart = Math.floor(num).toLocaleString("en-US");
          return `${sign}${intPart}<small>${tier.s}</small>`;
        } else {
          // 12.3K, 9.9M — 소수점 1자리
          const fixed = num.toFixed(1);
          const [i, d] = fixed.split(".");
          return `${sign}${i}<small>.${d}${tier.s}</small>`;
        }
      }
    }
    return `${sign}${abs.toLocaleString("en-US")}`;
  };
  const fmtKrw = (v) => `≈ ₩${Math.round(Number(v) || 0).toLocaleString("en-US")}`;

  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el && txt !== undefined && txt !== null) el.textContent = String(txt);
  };
  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  const setBg = (id, css) => {
    const el = document.getElementById(id);
    if (el) Object.assign(el.style, css);
  };

  // ─── lang 해석 (전역 — 알림 렌더러 등 bind() 외부에서도 사용) ───
  // (2026-05-07) default 'en' 으로 통일 — i18n.js 본체 / site-header lang-toggle
  // / 페이지 boot script 모두 'en' default 로 일치시켜 EN 모드에서 한국어가
  // 누출되는 문제 (예: swap.html 의 "방금" / "🔒 시세 잠금...") 차단.
  const getCurrentLang = () => {
    try {
      const v = window.RwaI18n?.getLang?.() || window.RwaI18n?.lang?.()
        || document.documentElement.getAttribute("data-rwa-lang")
        || (window.__RWA_I18N_BOOT_LANG__ || "en");
      return String(v || "en").toLowerCase() === "en" ? "en" : "ko";
    } catch (_) { return "en"; }
  };

  // ─── 인증 상태 감지 ───
  const isLoggedIn = () => {
    try {
      const w = JSON.parse(localStorage.getItem("rwa_wallet_v3") || "{}");
      return !!(w.connected && w.address);
    } catch (_) { return false; }
  };

  // ─── 메인 바인딩 ───
  const bind = async () => {
    const page = document.body?.dataset?.page;
    if (!page) return;

    // 1) 공개 설정 (인증 불필요)
    // (v640) 운영자 요청: '/api/public/config 중복 호출 제거.'
    // RwaCore.getConfig() 가 30초 TTL 캐시. core.js 의 이전 호출 결과 재사용.
    // 미존재 시 직접 apiCall 폴백.
    let cfg;
    if (typeof window.RwaCore?.getConfig === "function") {
      try { cfg = await window.RwaCore.getConfig(); }
      catch (_) { cfg = await apiCall("/api/public/config", { auth: false }); }
    } else {
      cfg = await apiCall("/api/public/config", { auth: false });
    }
    cfg = cfg || {};
    const krwRate = Number(cfg.fx_krw_per_usdt || 1400);

    // (2026-05-11) Apply admin-uploaded token logos to all img tags
    // marked with data-token-logo="usdt|silicasto|silica". This runs
    // before the auth-check early return below so logos appear even
    // for logged-out visitors (e.g. landing page Token Holdings panel).
    // (2026-05-19 v634) admin URL 캐시를 window 에 노출 + helper 함수 제공.
    //   deposit/withdraw 의 동적 dropdown 이 메뉴 재구성 시 호출 가능.
    try {
      const logos = cfg.silica_logo_urls || {};
      // (2026-05-26 v846) /uploads/* → /api/file/* swap — UPLOAD_DIR 이 배포 zone
      //   밖이라 직접 정적 접근 불가. core.js absUrl 과 동일 패턴.
      const swapUrl = (u) => {
        const s = String(u || "").trim();
        if (s.startsWith('/uploads/')) return '/api/file/' + s.substring('/uploads/'.length);
        if (s.startsWith('uploads/')) return '/api/file/' + s.substring('uploads/'.length);
        return s;
      };
      // 동적 dropdown 이 menu 재생성 후 호출할 수 있도록 캐시.
      window.__RWA_LOGO_URLS__ = logos;
      const applyLogos = (rootEl) => {
        const root = rootEl || document;
        ["usdt", "silicasto", "silica"].forEach(tok => {
          const url = swapUrl(logos[tok] || "");
          if (!url) return; // empty → bundled SVG 유지
          root.querySelectorAll(`img[data-token-logo="${tok}"]`).forEach(img => {
            img.src = url;
          });
        });
      };
      window.__RWA_APPLY_LOGOS__ = applyLogos;
      applyLogos(); // 페이지 초기 적용.
    } catch (_e) { /* logo override failures are non-fatal */ }
    // (2026-05-08) Silica reward token price (USDT per Silica). Source of truth
    //   is the silica_price_usdt setting (manual admin entry or coinlore/MEA
    //   sync), exposed via /api/public/config. Earlier the field was missing
    //   from that endpoint so the code always fell through to a hardcoded 0.05
    //   default, making every portfolio display "≈ X USDT (price 0.05)" no
    //   matter what the admin set. Now defaults to 0 — UI will show "—" or
    //   skip the conversion when admin hasn't configured the price.
    let silicaPrice = Number(cfg.silica_price_usdt ?? cfg.silica_price ?? 0);
    if (!isFinite(silicaPrice) || silicaPrice < 0) silicaPrice = 0;

    // (2026-05-06 v3) bind() 전체에서 사용되는 _lang 을 인증 검사 전에 정의.
    // 이전에는 staking/asset 등 특정 페이지 블록 내부에서만 정의되어, wallet 카드 부분
    // (모든 페이지 공통) 에서 _lang 참조 시 ReferenceError 가 발생했음.
    const _lang = getCurrentLang();

    // 2) 인증 안 됐으면 기본 0/empty 유지하고 종료.
    //    (2026-05-07) history 페이지는 예외 — 인증 안 된 상태에서도 이후 코드를
    //    계속 실행시켜 "거래 내역을 보려면 지갑을 연결하세요" 안내 메시지를
    //    표시한다. 미연결 상태에서 정적 dummy "No transaction history yet"
    //    문구가 그대로 남는 문제 해결.
    if (!isLoggedIn() && page !== "history") {
      // 지갑 연결 안내만 살짝 갱신
      // dashSub 제거됨 (사용자 요청)
      return;
    }

    // 3) 포트폴리오 + KYC + 자산 목록 병렬 호출.
    // (v643 Tier 1) /api/assets 도 함께 병렬화 — auth-free + portfolio/me/kyc
    //   와 독립이므로 단일 Promise.all 로 묶어 라운드트립 1회 절감.
    //   staking / assets / funding 페이지 블록이 _allAssetsCache 재사용.
    const [portfolio, meRes, kyc, _assetsResMain] = await Promise.all([
      apiCall("/api/portfolio"),
      apiCall("/api/me"),
      apiCall("/api/kyc/status"),
      apiCall("/api/assets", { auth: false }).catch(() => null),
    ]);
    const _allAssetsCache = Array.isArray(_assetsResMain?.assets)
      ? _assetsResMain.assets
      : (Array.isArray(_assetsResMain) ? _assetsResMain : []);

    const me = meRes || {};
    const usdt = Number(portfolio?.usdt ?? me?.usdt ?? 0);
    const holdings = Array.isArray(portfolio?.holdings) ? portfolio.holdings : [];
    const silicaH = holdings.find((h) => String(h?.asset_id || "") === "SILICA-79907") || {};

    const stoBal    = Number(silicaH.silica_sto_balance || 0);
    const stoStaked = Number(silicaH.silica_sto_staked  || 0);
    const stoIdle   = Math.max(0, stoBal - stoStaked);
    const silicaBal = Number(silicaH.silica_balance || 0);

    const totalUsdt = usdt + stoBal + silicaBal * silicaPrice;
    const totalKrw  = totalUsdt * krwRate;

    // 4) 이자 누적 (interestSummary 합계)
    // (2026-05-08) BUGFIX — /api/portfolio returns interestSummary as a
    //   JSON object keyed by asset_id (PHP associative array), NOT a
    //   JSON array. The old `Array.isArray(...)` branch always failed
    //   for objects, fell through to [], and showed 0 pending interest
    //   even when interest_claims had unclaimed rows. The notification
    //   popup correctly read the user_notifications table separately,
    //   so users saw "4.10 USDT pending" in the popup but "0.00 USDT
    //   NO PENDING" on the staking/claim card. history.js and
    //   portfolio.js already used Object.values() — only this file
    //   was broken. Normalize defensively (handle both shapes).
    const _isRaw = portfolio?.interestSummary;
    const interestSummary = Array.isArray(_isRaw)
      ? _isRaw
      : (_isRaw && typeof _isRaw === "object" ? Object.values(_isRaw) : []);
    const cumulInterestUsdt = interestSummary.reduce(
      (sum, r) => sum + Number(r?.claimed_interest_usdt || 0),
      0
    );
    // (2026-05-11 v240) Cumulative Silica dividends actually paid out
    //   (sum of wallet_transactions kind='dividend_claim'). Was
    //   previously substituted with silicaBal (wallet balance) which
    //   was misleading — wallet Silica can come from deposits/swaps,
    //   not just dividend payouts.
    const cumulativeDividendSilica = Number(portfolio?.cumulativeDividendSilica || 0);

    // (2026-05-08) Surface raw API response on window so the operator
    //   can press F12 → Console and immediately see what's coming back
    //   without having to fight with admin/diagnose-wallet. If pending
    //   is 0 here, the row didn't make it through the
    //   /api/portfolio interest_claims query — server-side issue.
    try {
      window.__SILICA_DEBUG_PORTFOLIO__ = portfolio;
      window.__SILICA_DEBUG_INTEREST_SUMMARY__ = interestSummary;
      const _pendingDebug = interestSummary.reduce(
        (s, r) => s + Number(r?.pending_interest_usdt || 0), 0
      );
      const _claimedDebug = cumulInterestUsdt;
      const _addr = (portfolio?.address || me?.address || "").trim();
      const _serverDebug = portfolio?.interestSummaryDebug || null;
      // eslint-disable-next-line no-console
      console.log(
        "[silica][interest-debug]",
        "page=", page,
        "client.address=", JSON.stringify(_addr),
        "client.addr.length=", _addr.length,
        "client.interestSummary.rows=", interestSummary.length,
        "client.pending=", _pendingDebug,
        "client.claimed=", _claimedDebug,
        "server.debug=", _serverDebug
      );
      if (_serverDebug && _serverDebug.trim_match_rows > 0 && interestSummary.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(
          "[silica][interest-debug] MISMATCH — server has",
          _serverDebug.trim_match_rows,
          "rows but interestSummary aggregation returned 0. Likely the",
          "asset_status filter or LEFT JOIN sales is dropping them. raw=",
          _isRaw
        );
      }
    } catch (_) { /* never throw from debug */ }

    // 6) 페이지별 바인딩
    // ─── 대시보드 (index) ───
    if (page === "index") {
      // 총 자산 가치: 단순 텍스트 노드 (i18n MutationObserver 우회 — "1 items" 버그 방지)
      // setHtml 로 <span> 분리 시 i18n 이 텍스트 노드를 잘못 변환할 수 있어 setText 사용
      // data-no-i18n 속성도 같이 설정하여 이중 보호
      // (2026-05-18 v514) 운영자 요청: USDT는 소수점 3자리로 표기 (거래 수수료
      //   0.5% 정밀도 일치). balUsdt / totalUsdt 등 USDT 단위 모두 3자리.
      const tv = document.getElementById("kpiTotalAssets");
      if (tv) {
        tv.setAttribute("data-no-i18n", "1");
        tv.setAttribute("translate", "no");
        // (2026-05-19 v603) 운영자: 'index.html 소수점은 폰트가 작아야한다.'
        //   fmtBalHtml 으로 .000 부분만 <small> 로 감싸 노출. data-no-i18n=1 이
        //   적용돼 있어 MutationObserver 가 텍스트 노드를 망치지 않는다.
        // (2026-05-22 v780) 운영자: 'USDT 폰트가 너무 크다 + 10000 부터 B로 표기.'
        //   fmtBalAbbrev 로 큰 금액 K/M/B/T 약어 표기 + USDT 를 .ccy span 으로
        //   감싸 폰트 축소 (split-mega 의 0.42em 사이즈).
        tv.innerHTML = `${fmtBalAbbrev(totalUsdt, 3)} <span class="ccy">USDT</span>`;
      }
      setText("kpiTotalKrw", `₩${fmtN(totalKrw, 0)}`);
      // 3-trio KPI
      // (2026-05-19 v609) 운영자: 'Staked STO / Cumulative Interest / Silica Held
      //   카드에서 소수점 폰트가 정수와 동일' → kpiInterest / kpiSilica 의
      //   소수점을 <small> 로 감싸 작게 표시 (TOTAL PORTFOLIO 와 동일 패턴).
      //   data-no-i18n=1 으로 MutationObserver 텍스트 변형 차단.
      setText("kpiStaked", fmtN(stoStaked, 0));
      setText("kpiStakedUsdt", `≈ ${fmtN(stoStaked, 0)} USDT`);
      const elKi = document.getElementById("kpiInterest");
      if (elKi) {
        elKi.setAttribute("data-no-i18n", "1");
        elKi.setAttribute("translate", "no");
        elKi.innerHTML = fmtBalHtml(cumulInterestUsdt, 2);
      }
      setText("kpiInterestSub", `USDT · ${cumulInterestUsdt > 0 ? Math.ceil(cumulInterestUsdt) : 0} cycles`);
      const elKs = document.getElementById("kpiSilica");
      if (elKs) {
        elKs.setAttribute("data-no-i18n", "1");
        elKs.setAttribute("translate", "no");
        elKs.innerHTML = fmtBalHtml(silicaBal, 2);
      }
      setText("kpiSilicaUsdt", `≈ ${fmtN(silicaBal * silicaPrice, 3)} USDT @ ${silicaPrice}`);

      // Token Holdings — USDT 카드는 3자리 정밀
      setText("balUsdt", fmtN(usdt, 3));
      setText("balUsdtKrw", `${fmtKrw(usdt * krwRate)} KRW`);
      setText("balSto", fmtN(stoBal, 2));
      setText("balStoUsdt", `≈ ${fmtN(stoBal, 0)} USDT`);
      setText("balSilica", fmtN(silicaBal, 2));
      setText("balSilicaUsdt", `≈ ${fmtN(silicaBal * silicaPrice, 3)} USDT`);

      // 최근 활동 (interestSummary + funding 등을 합쳐 최근 5건)
      const activity = [];
      const funding = Array.isArray(portfolio?.funding) ? portfolio.funding : [];
      funding.slice(0, 5).forEach((f) => {
        activity.push({
          time: f.created_at,
          type: f.entry_kind === "contract_refund" ? "Investment Canceled" : "Investment",
          token: "USDT",
          amount: Number(f.amount_usdt || 0),
          status: f.funding_status_label || "Completed",
        });
      });

      // Activity Feed (Concept E — div 기반 feed-item 구조)
      const feedList = document.getElementById("feedList");
      if (feedList) {
        if (activity.length === 0) {
          // (2026-05-19 v590) 운영자: 빈 활동 피드 부가 안내 제거.
          //   "No Activity Yet" 라벨로만 상태 전달.
          feedList.innerHTML = `
            <div class="feed-empty">
              <div class="icon">⊕</div>
              <div class="title">No Activity Yet</div>
            </div>`;
        } else {
          feedList.innerHTML = activity.map((a) => {
            const ts = (a.time || "").slice(5, 16).replace("T", " ");
            return `
              <div class="feed-item">
                <div class="when">${ts} · ${a.status}</div>
                <div class="what">
                  <span>${a.type} · USDT</span>
                  <span class="amt">+${fmtN(a.amount, 2)}</span>
                </div>
              </div>`;
          }).join("");
        }
      }

      // KYC (Concept E 디자인)
      // (2026-05-18 v569) 운영자 보고: '인증 됐는데도 카드가 Unverified 그대로'.
      //   원인: kyc?.status 를 읽는데 API 는 kyc_yn / kyc_status 를 반환 → 항상
      //   undefined → 기본 HTML (Unverified) 유지. kyc_yn (Y/N) + kyc_status
      //   (pending/rejected/APPROVED 등) 조합으로 4가지 상태를 직접 계산해
      //   카드 갱신. 승인 상태에서 CTA 클릭 시 인증 정보 모달 노출.
      // (2026-05-18 v570) 운영자 보고: 반려된 사용자가 홈 카드에서 자기 상태를
      //   알 수 없다 (노란 Reviewing 카드로 표시됨). 원인: 매핑이 `ks ===
      //   'rejected'` 한 가지만 보는데 백엔드는 그 키를 절대 쓰지 않는다 —
      //   실제 저장값은 'kyc_status_not_approved' / 'mismatch_name' /
      //   'mismatch_birth' / 'kyc_no_credits'. 정렬: 백엔드 실제 키 4 종을
      //   모두 인식 + 사유별 sub-text + 4 개국어.
      if (kyc && typeof kyc === 'object') {
        const yn = String(kyc.kyc_yn || 'N').toUpperCase();
        const ks = String(kyc.kyc_status || '').toLowerCase();
        const nameSet  = !!kyc.mt_name_set;
        const birthSet = !!kyc.mt_birth_set;

        // (v570) 백엔드 실제 reject 키 집합. 'rejected' 는 옛 호환을 위해 유지.
        const REJECT_KEYS = new Set([
          'rejected',
          'kyc_status_not_approved',
          'mismatch_name',
          'mismatch_birth',
          'kyc_no_credits',
        ]);

        // 상태 도출 — kyc_yn 'Y' = 승인. 그 외엔 kyc_status 또는 입력 진행 상태.
        let state;
        if (yn === 'Y') state = 'approved';
        else if (REJECT_KEYS.has(ks)) state = 'rejected';
        else if (ks === 'pending' || ks === 'reviewing' || ks === 'in_progress' || ks === 'in_review') state = 'pending';
        else if (nameSet && birthSet) state = 'pending';  // basic info 입력 후 진행 중
        else state = 'unverified';

        // (v570) 반려 사유별 sub-text + CTA. mismatch 류는 kyc-ready.html 로
        //   유도 (기본 정보 정정), 그 외엔 kyc-certification.html (재신청).
        const rejectInfo = (() => {
          switch (ks) {
            case 'mismatch_name':
              return {
                sub: _lang === "en" ? "Name didn't match your ID. Please correct your basic info." :
                     _lang === "ja" ? "氏名が身分証と一致しません。基本情報を修正してください。" :
                     _lang === "zh" ? "姓名与身份证不符。请修正基本信息。" :
                                      "이름이 신분증과 일치하지 않습니다. 기본 정보를 정정해 주세요.",
                ctaHref: "kyc-ready.html",
              };
            case 'mismatch_birth':
              return {
                sub: _lang === "en" ? "Date of birth didn't match your ID. Please correct your basic info." :
                     _lang === "ja" ? "生年月日が身分証と一致しません。基本情報を修正してください。" :
                     _lang === "zh" ? "出生日期与身份证不符。请修正基本信息。" :
                                      "생년월일이 신분증과 일치하지 않습니다. 기본 정보를 정정해 주세요.",
                ctaHref: "kyc-ready.html",
              };
            case 'kyc_no_credits':
              return {
                sub: _lang === "en" ? "Verification provider credits are exhausted. Please contact support." :
                     _lang === "ja" ? "認証プロバイダーのクレジットが不足しています。サポートにご連絡ください。" :
                     _lang === "zh" ? "认证服务额度已用尽。请联系客服。" :
                                      "KYC 공급자 크레딧이 소진되었습니다. 운영자에게 문의해 주세요.",
                ctaHref: "javascript:void(0)",
              };
            case 'kyc_status_not_approved':
            case 'rejected':
            default:
              // (2026-05-19 v588) 운영자 디자인 원칙 — 불필요 텍스트 제거.
              //   기본 거절 케이스 sub 메시지 비움. 상태는 카드 라벨 (✕ Rejected)
              //   과 CTA 버튼으로 충분히 전달됨.
              return {
                sub: '',
                ctaHref: "kyc-certification.html",
              };
          }
        })();

        // CTA 라벨도 4 개국어. mismatch 는 "Edit Info / 정보 수정", 그 외는
        //   "Resubmit / 재신청".
        const ctaResubmit =
          _lang === "en" ? "Resubmit →" :
          _lang === "ja" ? "再申請 →" :
          _lang === "zh" ? "重新提交 →" :
                           "재신청 →";
        const ctaEditInfo =
          _lang === "en" ? "Edit Info →" :
          _lang === "ja" ? "情報を修正 →" :
          _lang === "zh" ? "修改信息 →" :
                           "정보 수정 →";
        const ctaContact =
          _lang === "en" ? "Contact Support" :
          _lang === "ja" ? "サポートに連絡" :
          _lang === "zh" ? "联系客服" :
                           "운영자 문의";
        const rejectedCta =
          (ks === 'mismatch_name' || ks === 'mismatch_birth') ? ctaEditInfo :
          (ks === 'kyc_no_credits') ? ctaContact :
                                       ctaResubmit;

        const verifiedDate = (kyc.kyc_last_verified_at || kyc.kyc_doc_regdate || '').slice(0, 10);
        const map = {
          approved:    { txt: "Verified",   sub: verifiedDate ? `Verified on ${verifiedDate}` : "Verification complete", icon: "✓", iconBg: "linear-gradient(135deg, #10B981, #059669)", iconColor: "#FFFFFF", iconBorder: "transparent", cta: "View Details", ctaHref: "javascript:void(0)" },
          pending:     { txt: "Reviewing",  sub: "Please wait while we verify your documents",                                            icon: "⌛", iconBg: "linear-gradient(135deg, #F59E0B, #D97706)", iconColor: "#FFFFFF", iconBorder: "transparent", cta: "Check Status →", ctaHref: "kyc-certification.html" },
          rejected:    { txt: "Rejected",   sub: rejectInfo.sub,                                                                          icon: "✕", iconBg: "linear-gradient(135deg, #EF4444, #DC2626)", iconColor: "#FFFFFF", iconBorder: "transparent", cta: rejectedCta, ctaHref: rejectInfo.ctaHref },
          unverified:  { txt: "Unverified", sub: "KYC verification required<br>before investing.",                                       icon: "🔒", iconBg: "linear-gradient(135deg, #F1F5F9, #E2E8F0)", iconColor: "#94A3B8", iconBorder: "#CBD5E1", cta: "Start KYC", ctaHref: "kyc-ready.html" },
        };
        const v = map[state] || map.unverified;
        setText("kycStatusText", v.txt);
        setHtml("kycSubText", v.sub);
        const iconEl = document.getElementById("kycIconWrap");
        if (iconEl) {
          iconEl.textContent = v.icon;
          iconEl.style.background = v.iconBg;
          iconEl.style.color = v.iconColor;
          iconEl.style.border = `2px solid ${v.iconBorder}`;
        }
        const ctaEl = document.getElementById("kycCta");
        if (ctaEl) {
          ctaEl.textContent = v.cta;
          ctaEl.setAttribute("href", v.ctaHref);
          // (v588) 거절 상태 빨강 단색 — index.html 의 .kycE-cta[data-kyc-state=...]
          //   CSS 셀렉터가 색상 적용. state 속성으로 hand-off.
          ctaEl.setAttribute("data-kyc-state", state);
          // (v569) 승인 상태에서만 클릭 → 모달. 다른 상태는 일반 링크 (HREF) 그대로.
          // (v570) kyc_no_credits 는 contact CTA 라 클릭해도 동작 없음 — 명시적으로
          //   onclick 차단.
          if (state === 'approved') {
            ctaEl.onclick = (e) => { e.preventDefault(); showKycInfoModal(kyc); return false; };
          } else if (state === 'rejected' && ks === 'kyc_no_credits') {
            ctaEl.onclick = (e) => { e.preventDefault(); return false; };
          } else {
            ctaEl.onclick = null;
          }
        }
      }
    }

    // ─── 포트폴리오 (지갑) ───
    if (page === "portfolio") {
      setHtml("walletTotalUsdt", fmtUsdHtml(totalUsdt));
      setText("walletTotalKrw", fmtKrw(totalKrw) + " KRW");

      // (2026-05-11 v235) Portfolio big balances use fmtBalHtml so the
      //   decimal part is rendered in <small> at a reduced font size.
      // (2026-06-07 v880) 큰 잔액은 약식 표기 (1.00M / 999K). 값 >= 10000 일
      //   때 정확한 값을 부제 (.token-balance-exact) 에 함께 노출.
      const _setBalanceWithExact = (bigId, exactId, value, unit, smallDigits) => {
        setHtml(bigId, fmtBalAbbrev(value, smallDigits != null ? smallDigits : 2));
        const exactEl = document.getElementById(exactId);
        if (!exactEl) return;
        const abs = Math.abs(Number(value) || 0);
        // (v881) 운영자 요청 — M 단위 (>= 1,000,000) 부터만 부제 표시.
        if (abs >= 1000000) {
          exactEl.textContent = `${fmtN(value, smallDigits != null ? smallDigits : 2)} ${unit}`;
          exactEl.classList.add("is-visible");
        } else {
          exactEl.classList.remove("is-visible");
        }
      };
      _setBalanceWithExact("walletUsdt", "walletUsdtExact", usdt, "USDT", 3);
      setText("walletUsdtKrw", fmtKrw(usdt * krwRate) + " KRW");
      // (2026-05-20 v675) USDT 카드 하단 '누적이자' 행 — 운영자 요청.
      //   Mint 주소 (Es9...wNYB) 자리에 cumulInterestUsdt 표시.
      setText("walletUsdtCumulInterest", `${fmtN(cumulInterestUsdt, 2)} USDT`);
      _setBalanceWithExact("walletSto", "walletStoExact", stoBal, "SilicaSTO", 2);
      // (2026-05-06 v3) walletStoUsdt 의 작은 텍스트에 idle/staked 분리 표기 추가.
      // 사용자가 큰 숫자(TOTAL) 아래에서 즉시 보유분/스테이킹 분포를 확인할 수 있게.
      // (2026-05-08) ja/zh 분기 추가 — 비-KO/EN locale 에서 한국어 누출 방지.
      // (2026-05-20 v674) 운영자 요청 — '· ≈ X USDT (1:1 페그)' suffix 제거.
      //   STO 1:1 USDT peg 가 자명하므로 표기 불필요. idle/staked 분포만 표시.
      setText("walletStoUsdt",
        _lang === "en" ? `Idle ${fmtN(stoIdle, 0)}  ·  Staked ${fmtN(stoStaked, 0)}` :
        _lang === "ja" ? `保有 ${fmtN(stoIdle, 0)}  ·  ステーキング ${fmtN(stoStaked, 0)}` :
        _lang === "zh" ? `持有 ${fmtN(stoIdle, 0)}  ·  质押 ${fmtN(stoStaked, 0)}` :
        `보유 ${fmtN(stoIdle, 0)}  ·  스테이킹 ${fmtN(stoStaked, 0)}`);
      setText("walletStoStaked", fmtN(stoStaked, 2));
      setText("walletStoIdle", fmtN(stoIdle, 2));

      // (2026-05-17 v439) 운영자 요청: 'USDT/SilicaSTO 카드에 관리자 승인 대기
      //   자산을 표기하여 유저가 알 수 있도록'. portfolio.php (v439) 가 노출하는
      //   pendingDepositUsdt / pendingDepositSto / pendingFundingSto 필드를 읽어
      //   카드 안 .token-pending 박스에 표시. 값이 0 이면 박스 자체 숨김.
      const _pendingUsdt   = Number(portfolio?.pendingDepositUsdt || 0);
      const _pendingStoDep = Number(portfolio?.pendingDepositSto  || 0);
      const _pendingStoFun = Number(portfolio?.pendingFundingSto  || 0);
      const _pendingStoSum = _pendingStoDep + _pendingStoFun;

      const _usdtPendingLabel =
        _lang === "en" ? "Awaiting admin approval — deposit" :
        _lang === "ja" ? "管理者承認待ち — 入金" :
        _lang === "zh" ? "等待管理员审核 — 存入" :
        "관리자 승인 대기 입금";
      const _stoPendingLabel = (_pendingStoDep > 0 && _pendingStoFun > 0)
        ? (_lang === "en" ? "Awaiting admin approval — deposit + investment" :
           _lang === "ja" ? "管理者承認待ち — 入金 + 投資" :
           _lang === "zh" ? "等待管理员审核 — 存入 + 投资" :
           "관리자 승인 대기 (입금 + 투자)")
        : (_pendingStoFun > 0
            ? (_lang === "en" ? "Awaiting admin approval — investment" :
               _lang === "ja" ? "管理者承認待ち — 投資" :
               _lang === "zh" ? "等待管理员审核 — 投资" :
               "관리자 승인 대기 (투자 신청)")
            : (_lang === "en" ? "Awaiting admin approval — deposit" :
               _lang === "ja" ? "管理者承認待ち — 入金" :
               _lang === "zh" ? "等待管理员审核 — 存入" :
               "관리자 승인 대기 입금"));

      const _usdtPendingRow = document.getElementById("walletUsdtPendingRow");
      if (_usdtPendingRow) {
        if (_pendingUsdt > 0) {
          setText("walletUsdtPendingLabel", _usdtPendingLabel);
          setText("walletUsdtPending", fmtN(_pendingUsdt, 2));
          _usdtPendingRow.classList.add("is-visible");
        } else {
          _usdtPendingRow.classList.remove("is-visible");
        }
      }
      const _stoPendingRow = document.getElementById("walletStoPendingRow");
      if (_stoPendingRow) {
        if (_pendingStoSum > 0) {
          setText("walletStoPendingLabel", _stoPendingLabel);
          setText("walletStoPending", fmtN(_pendingStoSum, 2));
          _stoPendingRow.classList.add("is-visible");
        } else {
          _stoPendingRow.classList.remove("is-visible");
        }
      }

      // (2026-05-21 v731) Silica 입금 대기 — SilicaSTO/USDT 와 동일 패턴.
      //   portfolio.php 의 pendingDepositSilica 필드 사용.
      const _pendingSilicaDep = Number(portfolio?.pendingDepositSilica || 0);
      const _silicaPendingLabel =
        _lang === "en" ? "Awaiting admin approval — deposit" :
        _lang === "ja" ? "管理者承認待ち — 入金" :
        _lang === "zh" ? "等待管理员审核 — 存入" :
        "관리자 승인 대기 입금";
      const _silicaPendingRow = document.getElementById("walletSilicaPendingRow");
      if (_silicaPendingRow) {
        if (_pendingSilicaDep > 0) {
          setText("walletSilicaPendingLabel", _silicaPendingLabel);
          setText("walletSilicaPending", fmtN(_pendingSilicaDep, 2));
          _silicaPendingRow.classList.add("is-visible");
        } else {
          _silicaPendingRow.classList.remove("is-visible");
        }
      }

      // (2026-05-21 v719) 출금 대기 수량 표시 — USDT / SilicaSTO / Silica 카드.
      //   잔액에서는 이미 차감되어 있지만 사용자가 "내가 N 출금 요청해두었다"
      //   는 사실을 카드에서 한눈에 확인 가능. 입금 대기와 구분 위해 blue 톤.
      const _pendingWithdrawUsdt   = Number(portfolio?.pendingWithdrawUsdt   || 0);
      const _pendingWithdrawSto    = Number(portfolio?.pendingWithdrawSto    || 0);
      const _pendingWithdrawSilica = Number(portfolio?.pendingWithdrawSilica || 0);

      const _withdrawPendingLabel =
        _lang === "en" ? "Withdrawal pending (admin processing)" :
        _lang === "ja" ? "出金処理中 (管理者対応中)" :
        _lang === "zh" ? "提现处理中 (管理员处理中)" :
        "출금 대기 (관리자 처리 중)";

      const _usdtWithdrawPendingRow = document.getElementById("walletUsdtPendingWithdrawRow");
      if (_usdtWithdrawPendingRow) {
        if (_pendingWithdrawUsdt > 0) {
          setText("walletUsdtPendingWithdrawLabel", _withdrawPendingLabel);
          setText("walletUsdtPendingWithdraw", fmtN(_pendingWithdrawUsdt, 2));
          _usdtWithdrawPendingRow.classList.add("is-visible");
        } else {
          _usdtWithdrawPendingRow.classList.remove("is-visible");
        }
      }

      const _stoWithdrawPendingRow = document.getElementById("walletStoPendingWithdrawRow");
      if (_stoWithdrawPendingRow) {
        if (_pendingWithdrawSto > 0) {
          setText("walletStoPendingWithdrawLabel", _withdrawPendingLabel);
          setText("walletStoPendingWithdraw", fmtN(_pendingWithdrawSto, 2));
          _stoWithdrawPendingRow.classList.add("is-visible");
        } else {
          _stoWithdrawPendingRow.classList.remove("is-visible");
        }
      }

      const _silicaWithdrawPendingRow = document.getElementById("walletSilicaPendingWithdrawRow");
      if (_silicaWithdrawPendingRow) {
        if (_pendingWithdrawSilica > 0) {
          setText("walletSilicaPendingWithdrawLabel", _withdrawPendingLabel);
          setText("walletSilicaPendingWithdraw", fmtN(_pendingWithdrawSilica, 2));
          _silicaWithdrawPendingRow.classList.add("is-visible");
        } else {
          _silicaWithdrawPendingRow.classList.remove("is-visible");
        }
      }
      _setBalanceWithExact("walletSilica", "walletSilicaExact", silicaBal, "Silica", 2);
      setText("walletSilicaUsdt",
        _lang === "en" ? `≈ ${fmtN(silicaBal * silicaPrice, 2)} USDT (price ${silicaPrice})` :
        _lang === "ja" ? `≈ ${fmtN(silicaBal * silicaPrice, 2)} USDT (価格 ${silicaPrice})` :
        _lang === "zh" ? `≈ ${fmtN(silicaBal * silicaPrice, 2)} USDT (价格 ${silicaPrice})` :
        `≈ ${fmtN(silicaBal * silicaPrice, 2)} USDT (시세 ${silicaPrice})`);
      setText("walletSilicaPrice", `${silicaPrice} USDT`);
      // (2026-05-11 v240) walletSilicaCumul = paid Silica dividends,
      //   not the user's wallet balance.
      setText("walletSilicaCumul", fmtN(cumulativeDividendSilica, 2));

      if (me.address) {
        setText("walletAddress", me.address);
        const el = document.getElementById("walletAddress");
        if (el) { el.classList.remove("text-muted"); el.style.color = "var(--ice)"; }
      }
    }

    // ─── 스테이킹 ───
    if (page === "staking") {
      setText("stakeStaked", fmtN(stoStaked, 0));
      setText("stakeIdle", fmtN(stoIdle, 0));
      setText("stakeCumulInterest", fmtN(cumulInterestUsdt, 2));
      setText("stakeAvailable", `${fmtN(stoIdle, 2)} SilicaSTO`);

      // (2026-05-08) Interest claim card — ALWAYS visible. Earlier this
      //   was hidden when pending = 0; users repeatedly couldn't find a
      //   claim button. Now we render the card unconditionally and swap
      //   between "ready" (green, button enabled) and "no pending" (gray,
      //   disabled with explanatory text) styles.
      const pendingInterestUsdt = interestSummary.reduce(
        (sum, r) => sum + Number(r?.pending_interest_usdt || 0), 0
      );
      const pendingRounds = interestSummary.reduce(
        (sum, r) => sum + Number(r?.pending_rounds || 0), 0
      );
      const pendingCard = document.getElementById("pendingInterestCard");
      const pendingAmt = document.getElementById("pendingInterestAmount");
      const pendingAmtWrap = document.getElementById("pendingInterestAmountWrap");
      const pendingRoundsEl = document.getElementById("pendingInterestRounds");
      const pendingHeading = document.getElementById("pendingInterestHeading");
      const pendingBadge = document.getElementById("pendingInterestBadge");
      const claimBtn = document.getElementById("interestClaimBtn");
      const langEnLocal = (_lang === "en");
      const hasPending = pendingInterestUsdt > 0;
      if (pendingCard) {
        pendingCard.style.display = "";
        if (hasPending) {
          pendingCard.style.borderColor = "var(--green)";
          pendingCard.style.background = "rgba(16, 185, 129, 0.05)";
        } else {
          pendingCard.style.borderColor = "";
          pendingCard.style.background = "";
        }
      }
      if (pendingHeading) {
        pendingHeading.textContent = hasPending
          ? (langEnLocal ? "Interest Ready to Claim" : "수령 가능 이자")
          : (langEnLocal ? "Interest Claim" : "이자 클레임");
        pendingHeading.style.color = hasPending ? "var(--green)" : "";
      }
      if (pendingBadge) {
        if (hasPending) {
          pendingBadge.textContent = langEnLocal ? "Available" : "수령 가능";
          pendingBadge.style.background = "rgba(16, 185, 129, 0.20)";
          pendingBadge.style.color = "#059669";
        } else {
          pendingBadge.textContent = langEnLocal ? "No Pending" : "대기 없음";
          pendingBadge.style.background = "rgba(148, 163, 184, 0.18)";
          pendingBadge.style.color = "#64748b";
        }
      }
      // (2026-05-12 v305) 백엔드 stakingTruncatePayoutUsdt() 가 이자를
      //   1자리로 절삭 저장하므로 표시도 1자리로 통일 — 카드 / cycle / history
      //   모두 같은 정밀도. '0.00' → '0.0', '+4.10' → '+4.1'.
      if (pendingAmt) pendingAmt.textContent = fmtN(pendingInterestUsdt, 1);
      if (pendingAmtWrap) pendingAmtWrap.style.color = hasPending ? "var(--green)" : "var(--steel)";
      if (pendingRoundsEl) {
        if (hasPending) {
          pendingRoundsEl.textContent = langEnLocal
            ? `${pendingRounds} round${pendingRounds === 1 ? "" : "s"} pending · click Claim to receive in your USDT balance`
            : `누적 ${pendingRounds}회 · 클레임 시 USDT 잔액으로 지급`;
        } else if (stoStaked > 0) {
          // (2026-05-19 v592) 안내 문구 제거.
          pendingRoundsEl.textContent = "";
        } else {
          pendingRoundsEl.textContent = "";
        }
      }
      if (claimBtn) {
        claimBtn.disabled = !hasPending;
        if (claimBtn.dataset.busy !== "1") {
          claimBtn.textContent = langEnLocal ? "Claim" : "이자 클레임";
        }
      }
      if (claimBtn && !claimBtn.dataset.bound) {
        claimBtn.dataset.bound = "1";
        claimBtn.addEventListener("click", async () => {
          if (claimBtn.dataset.busy === "1") return;
          if (claimBtn.disabled) return;
          claimBtn.dataset.busy = "1";
          claimBtn.disabled = true;
          const origLabel = claimBtn.textContent;
          claimBtn.textContent = langEnLocal ? "Claiming…" : "처리 중…";
          try {
            const r = await apiCall("/api/interest/claim", {
              method: "POST",
              body: { assetId: "SILICA-79907" },
            });
            const amt = Number(r?.amount_usdt || 0);
            const cnt = Number(r?.claimed_count || 0);
            window.RwaCore?.toast?.(
              langEnLocal
                ? `Claimed ${fmtN(amt, 1)} USDT (${cnt} round${cnt === 1 ? "" : "s"}) — USDT balance updated.`
                : `${fmtN(amt, 1)} USDT (${cnt}회) 클레임 완료 — USDT 잔액에 반영되었습니다.`,
              "good"
            );
            // Soft reload — the easiest way to refresh balances /
            // pendingInterest / cumulInterest in one paint.
            setTimeout(() => location.reload(), 700);
          } catch (e) {
            window.RwaCore?.toast?.(
              (langEnLocal ? "Claim failed: " : "클레임 실패: ") + (e?.message || e),
              "bad"
            );
            claimBtn.dataset.busy = "0";
            claimBtn.disabled = false;
            claimBtn.textContent = origLabel;
          }
        });
      }

      // (2026-05-08) "자세히 보기" — fetches /api/interest/pending and
      //   shows per-row breakdown in a modal.
      const detailBtn = document.getElementById("interestDetailBtn");
      if (detailBtn) {
        detailBtn.textContent = langEnLocal ? "View Details" : "자세히 보기";
        if (!detailBtn.dataset.bound) {
          detailBtn.dataset.bound = "1";
          detailBtn.addEventListener("click", () => openInterestDetailModal(langEnLocal));
        }
      }

      // (2026-05-08) Recent Cycle History card population — was a static
      //   placeholder ("No cycles have been paid out yet.") that never
      //   got wired. Now fetches /api/interest/claimed (last 2 paid;
      //   operator wants this card kept compact — full history is on
      //   claim.html via the 'View All →' link).
      (async () => {
        const histList = document.getElementById("cycleHistoryList");
        if (!histList) return;
        try {
          const r = await apiCall("/api/interest/claimed?limit=2");
          const rows = Array.isArray(r?.rows) ? r.rows : [];
          if (!rows.length) {
            // (2026-05-19 v592) 안내 문구 → "-" 로 단순화 (운영자 요청).
            histList.innerHTML = `<div class="text-center text-muted" style="padding:32px 0;font-size:13px">-</div>`;
            return;
          }
          const fmtClaimed = (s) => {
            if (!s) return "—";
            return String(s).replace("T", " ").slice(0, 16);
          };
          histList.innerHTML = rows.map((row) => {
            const month = String(row.month_key || "").slice(0, 7);
            const amt = Number(row.amount_usdt || 0);
            const claimed = fmtClaimed(row.claimed_at);
            return `
              <div class="cycle-history-row">
                <div>
                  <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:0.5px">${month}</div>
                  <div class="text-muted" style="font-size:11px;margin-top:2px">${
                    langEnLocal ? "Paid" : "지급"
                  } ${claimed}</div>
                </div>
                <div class="text-mono text-success" style="font-weight:700;font-size:14px;align-self:center">
                  +${fmtN(amt, 1)} USDT
                </div>
              </div>
            `;
          }).join("");
        } catch (e) {
          // Auth/network failure — leave the empty state in place.
          // (Don't surface technical errors on a passive list card.)
        }
      })();

      // APR 표시 (관리자 설정 — silica asset.apr 사용)
      // (v643 Tier 1) 메인 Promise.all 의 _allAssetsCache 재사용 — 중복 호출 제거.
      const allAssets = _allAssetsCache;
      const silicaA = allAssets.find((a) => a.id === "SILICA-79907") || {};
      // (2026-05-16 v428) /api/public/config 의 silica_apr_pct 우선 사용.
      //   admin staking 페이지가 사용하는 interest_rate_history 와 동일 소스.
      //   '이번 회차' (silicaCalcThisCyclePayoutDate) 효력 발생 요율 노출 →
      //   매월 16일 0시 자동으로 다음 회차 요율로 전환. 폴백: assets.apr 컬럼.
      const apr = Number(cfg?.silica_apr_pct ?? silicaA.apr ?? 0);
      const aprInt = Math.floor(apr);
      const aprDec = (apr - aprInt).toFixed(2).slice(1); // ".00" 또는 ".50"
      const monthlyPct = (apr / 12).toFixed(3);

      setText("aprValueInt", String(aprInt));
      setText("aprValueDec", `${aprDec}%`);
      // (2026-05-08) ja/zh/ko 분기 — 비-EN locale 에서 "미설정" Korean 누출 방지.
      const _aprUnsetSuffix = (() => {
        if (apr > 0) return "";
        const lang = getCurrentLang();
        if (lang === "en") return " · NOT SET";
        if (lang === "ja") return " · 未設定";
        if (lang === "zh") return " · 未设置";
        return " · 미설정";
      })();
      // (2026-05-19 v592) aprLabel / aprDetail 안내 문구 제거 — APR 수치만
      //   단독 노출 (운영자 요청). suffix (관리자 미설정 시 경고 등) 도 일관성
      //   위해 비움.
      setText("aprLabel", "");
      setText("aprDetail", "");

      // 입력 변경 시 예상수익 계산 (관리자 설정 APR 사용)
      // (2026-05-12 v303) 백엔드 stakingTruncatePayoutUsdt() 가 지급 USDT 를
      //   소수점 1자리에서 절삭(floor((v + 1e-9) * 10) / 10) — 화면 표시도
      //   같은 정밀도로 맞춰 운영자가 본 '예상 이자' 와 실제 지급액이
      //   2자리 차이로 어긋나지 않게 한다 (예: 1000 STO × 5% / 12 = 4.166...
      //   → 화면 4.17, 실제 지급 4.1 의 mismatch 제거).
      const truncPayout = (v) => Math.floor(((+v || 0) + 1e-9) * 10) / 10;
      const inputEl = document.getElementById("stakeAmountInput");
      const updateEst = () => {
        const amt = Number(inputEl?.value || 0);
        const monthlyTrunc = truncPayout(amt * (apr / 100) / 12);
        // 연 이자는 월 절삭치 × 12 — 실제 12개월 누적 지급액과 일치.
        const annualTrunc  = truncPayout(monthlyTrunc * 12);
        setText("stakeMonthlyInterest", `+${fmtN(monthlyTrunc, 1)} USDT`);
        setText("stakeAnnualInterest", `+${fmtN(annualTrunc, 1)} USDT`);
        setText("stakeUsdtEst", `≈ ${fmtN(amt, 0)} USDT`);
      };
      if (inputEl) {
        inputEl.addEventListener("input", updateEst);
        updateEst();
      }

      // (2026-05-07) Active cycle countdown — populates the .cycle-card under
      //   MY STAKING. Cycle definition matches lib/silica.php silicaGetCurrentRateBps:
      //     - Cycle is identified by its payout date (the 15th of a calendar month)
      //     - Cycle starts on the 16th of the previous month, ends on the 15th
       //    - When today <= 15, the active cycle pays out on this month's 15th.
      //     - When today >= 16, the active cycle pays out on next month's 15th.
      //   Updates six DOM hooks: #cycleName / #cycleBadge / #cycleFill /
      //   #cyclePeriod / #cycleDday / #cycleExpected. UI strings are English-first
      //   per platform language policy.
      (function renderCycleCard() {
        const cycleNameEl = document.getElementById("cycleName");
        const cycleBadgeEl = document.getElementById("cycleBadge");
        const cycleFillEl = document.getElementById("cycleFill");
        const cyclePeriodEl = document.getElementById("cyclePeriod");
        const cycleDdayEl = document.getElementById("cycleDday");
        const cycleExpectedEl = document.getElementById("cycleExpected");
        if (!cycleNameEl) return; // page may not include the card
        const langEn = getCurrentLang() === "en";

        // Compute cycle bounds in local KST-aligned wall-clock terms (date-only).
        // Using local Date math is acceptable here because the cycle 15th cutoff
        // is interpreted on the server in KST too — this page only displays.
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const day = today.getDate();
        let payoutDate, cycleStart;
        if (day <= 15) {
          payoutDate = new Date(today.getFullYear(), today.getMonth(), 15);
          cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, 16);
        } else {
          payoutDate = new Date(today.getFullYear(), today.getMonth() + 1, 15);
          cycleStart = new Date(today.getFullYear(), today.getMonth(), 16);
        }
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const daysToPayout = Math.max(0, Math.round((payoutDate - today) / MS_PER_DAY));
        const totalDays = Math.max(1, Math.round((payoutDate - cycleStart) / MS_PER_DAY));
        const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((today - cycleStart) / MS_PER_DAY)));
        const progressPct = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));

        const fmtMd = (d) => {
          // English: "Mar 16" — Korean: "3/16"
          if (langEn) {
            return d.toLocaleString("en-US", { month: "short", day: "numeric" });
          }
          return `${d.getMonth() + 1}/${d.getDate()}`;
        };
        const cyclePayoutLabel = `${payoutDate.getFullYear()}-${String(payoutDate.getMonth() + 1).padStart(2, "0")}`;
        const periodText = `${fmtMd(cycleStart)} → ${fmtMd(payoutDate)}`;

        // Active when user has any stake. Otherwise the cycle is shown as
        // pending (matches the legacy default state).
        const hasStake = Number(stoStaked || 0) > 0;
        // (2026-05-12 v303) 백엔드 stakingTruncatePayoutUsdt() 절삭 정책과
        //   동일하게 1자리 floor — '예상 이자: 4.17' 이라 표시해놓고 실제
        //   지급은 4.10 으로 나가던 mismatch 해소.
        const expectedUsdtRaw = hasStake ? (Number(stoStaked) * (apr / 100)) / 12 : 0;
        const expectedUsdt = Math.floor((expectedUsdtRaw + 1e-9) * 10) / 10;

        // (2026-05-08) ja/zh 분기 추가 — 비-KO/EN locale 에서도 한국어 누출 방지.
        const _stakeLang = getCurrentLang();
        const _pickStakeText = (ko, en, ja, zh) =>
          _stakeLang === "en" ? en :
          _stakeLang === "ja" ? (ja ?? en) :
          _stakeLang === "zh" ? (zh ?? en) :
          ko;
        cycleNameEl.textContent = _pickStakeText(
          `${cyclePayoutLabel} 회차`,
          `Cycle ${cyclePayoutLabel}`,
          `${cyclePayoutLabel} 回`,
          `${cyclePayoutLabel} 周期`
        );
        if (cycleBadgeEl) {
          if (hasStake) {
            cycleBadgeEl.textContent = _pickStakeText("진행중", "Active", "進行中", "进行中");
            cycleBadgeEl.style.background = "rgba(16, 185, 129, 0.15)";
            cycleBadgeEl.style.color = "#059669";
          } else {
            cycleBadgeEl.textContent = _pickStakeText("대기", "Pending", "保留", "等待");
            cycleBadgeEl.style.background = "rgba(148, 163, 184, 0.15)";
            cycleBadgeEl.style.color = "var(--steel)";
          }
        }
        if (cycleFillEl) cycleFillEl.style.width = `${progressPct.toFixed(1)}%`;
        if (cyclePeriodEl) {
          // (2026-05-19 v592) 미참여 시 안내 문구 제거 — 빈 텍스트.
          cyclePeriodEl.textContent = hasStake ? periodText : "";
        }
        if (cycleDdayEl) {
          cycleDdayEl.textContent = daysToPayout > 0
            ? `D-${daysToPayout}`
            : _pickStakeText("오늘 지급", "Payout today", "本日支払", "今日支付");
        }
        if (cycleExpectedEl) {
          cycleExpectedEl.textContent = hasStake
            ? _pickStakeText(
                `예상 이자: +${fmtN(expectedUsdt, 1)} USDT (${cyclePayoutLabel}-15 지급)`,
                `Expected payout: +${fmtN(expectedUsdt, 1)} USDT on ${cyclePayoutLabel}-15`,
                `予想利息: +${fmtN(expectedUsdt, 1)} USDT（${cyclePayoutLabel}-15 支払）`,
                `预期利息: +${fmtN(expectedUsdt, 1)} USDT（${cyclePayoutLabel}-15 支付）`
              )
            : "";
        }
      })();

      // (2026-05-07) Stake / Unstake 모드 — 같은 form 을 모드 전환으로 재사용.
      //   stakeMode 가 'unstake' 이면 입력 라벨, Available 행, Yield 카드, 버튼
      //   라벨이 모두 unstake 시맨틱으로 바뀌고, 버튼 클릭 시 /api/staking/unstake
      //   를 호출한다. 기본 모드는 'stake'.
      let stakeMode = "stake";
      const idleMax = () => Math.max(0, Math.floor(Number(stoIdle || 0)));
      const stakedMax = () => Math.max(0, Math.floor(Number(stoStaked || 0)));
      const _stakeBtnRef = document.getElementById("stakeBtn");
      const _yieldCard = document.getElementById("stakeYieldCard");
      const _infoMsg = document.getElementById("stakeInfoMessage");
      const _availLabel = document.getElementById("stakeAvailableLabelText");
      const _formLabel = document.getElementById("stakeFormLabel");
      const isEn = () => getCurrentLang() === "en";

      // (2026-05-08) Helper that picks 4-lang localized text based on current
      //   getCurrentLang(). Earlier 2-way isEn() ternary leaked KO on JA/ZH locales.
      const _pickStake4 = (ko, en, ja, zh) => {
        const lang = getCurrentLang();
        if (lang === "en") return en;
        if (lang === "ja") return ja ?? en;
        if (lang === "zh") return zh ?? en;
        return ko;
      };

      const applyStakeModeUI = () => {
        const stakeBtnEl = _stakeBtnRef;
        const max = stakeMode === "unstake" ? stakedMax() : idleMax();
        // (2026-05-19 v592) 운영자 요청 — 라벨에서 "(SilicaSTO)" 제거,
        //   info 보조 메시지 모두 제거 (form-label, alert 본문, etc).
        if (stakeMode === "unstake") {
          if (stakeBtnEl) stakeBtnEl.textContent = _pickStake4("언스테이킹", "Unstake", "アンステーキング", "解除质押");
          if (_formLabel) _formLabel.textContent = _pickStake4("언스테이킹 수량", "Unstake Amount", "アンステーキング数量", "解除质押数量");
          if (_availLabel) _availLabel.textContent = _pickStake4("스테이킹됨", "Staked", "ステーキング済み", "已质押");
          setText("stakeAvailable", `${fmtN(stoStaked, 2)} SilicaSTO`);
          if (_yieldCard) _yieldCard.style.display = "none";
          if (_infoMsg) _infoMsg.textContent = "";
        } else {
          if (stakeBtnEl) stakeBtnEl.textContent = _pickStake4("스테이킹", "Stake", "ステーキング", "质押");
          if (_formLabel) _formLabel.textContent = _pickStake4("스테이킹 수량", "Stake Amount", "ステーキング数量", "质押数量");
          if (_availLabel) _availLabel.textContent = _pickStake4("보유", "Available", "保有", "可用");
          setText("stakeAvailable", `${fmtN(stoIdle, 2)} SilicaSTO`);
          if (_yieldCard) _yieldCard.style.display = "";
          if (_infoMsg) _infoMsg.textContent = "";
        }
        const stakeMaxBtnEl = document.getElementById("stakeMaxBtn");
        if (stakeMaxBtnEl) stakeMaxBtnEl.disabled = max <= 0;
      };

      // 탭 클릭 — Staking / Unstaking 토글
      const stakeTabBtn = document.getElementById("stakeTabBtn");
      const unstakeTabBtn = document.getElementById("unstakeTabBtn");
      if (stakeTabBtn && !stakeTabBtn.dataset.bound) {
        stakeTabBtn.dataset.bound = "1";
        stakeTabBtn.addEventListener("click", () => {
          if (stakeMode === "stake") return;
          stakeMode = "stake";
          stakeTabBtn.classList.add("active");
          unstakeTabBtn?.classList.remove("active");
          if (inputEl) { inputEl.value = ""; inputEl.dispatchEvent(new Event("input", { bubbles: true })); }
          applyStakeModeUI();
        });
      }
      if (unstakeTabBtn && !unstakeTabBtn.dataset.bound) {
        unstakeTabBtn.dataset.bound = "1";
        unstakeTabBtn.addEventListener("click", () => {
          if (stakeMode === "unstake") return;
          stakeMode = "unstake";
          unstakeTabBtn.classList.add("active");
          stakeTabBtn?.classList.remove("active");
          if (inputEl) { inputEl.value = ""; inputEl.dispatchEvent(new Event("input", { bubbles: true })); }
          applyStakeModeUI();
        });
      }

      // MAX 버튼 — 모드별 최대 잔량(stake = idle, unstake = staked)을 정수로 내림.
      // 1 STO = 1 USDT 페그 정수 거래 정책에 맞춰 floor 처리.
      const stakeMaxBtn = document.getElementById("stakeMaxBtn");
      if (stakeMaxBtn && inputEl && !stakeMaxBtn.dataset.bound) {
        stakeMaxBtn.dataset.bound = "1";
        stakeMaxBtn.addEventListener("click", () => {
          const maxAmt = stakeMode === "unstake" ? stakedMax() : idleMax();
          if (maxAmt <= 0) return;
          inputEl.value = String(maxAmt);
          inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          inputEl.focus();
        });
      }
      // initial sync (stake mode default)
      applyStakeModeUI();

      // ── (2026-05-06) 입력 보안 — 정수만, 음수/소수점/지수 표기/주입 차단 ──────────────
      // 클라이언트 측 사전 방어. 백엔드도 동일하게 정수 강제하지만, 잘못된 입력이
      // POST 까지 가는 경로 자체를 막아 UX/네트워크 비용 절약.
      if (inputEl && !inputEl.dataset.intGuardBound) {
        inputEl.dataset.intGuardBound = "1";

        const sanitizeIntOnly = (raw) => {
          // 1) 모든 비-숫자 문자 제거 (-, ., e/E, +, 공백, 한글 등 전부)
          const digits = String(raw || "").replace(/[^0-9]/g, "");
          // 2) leading zero 제거 (단 "0" 자체는 유지)
          const stripped = digits.replace(/^0+(?=\d)/, "");
          return stripped;
        };

        // input 이벤트 — 매 입력마다 비숫자 즉시 제거
        inputEl.addEventListener("input", () => {
          const cleaned = sanitizeIntOnly(inputEl.value);
          if (inputEl.value !== cleaned) inputEl.value = cleaned;
        });

        // keydown — '-' / '.' / 'e' / 'E' / '+' 키 자체를 차단하여 사용자에게 즉각 피드백
        inputEl.addEventListener("keydown", (e) => {
          if (["-", ".", "e", "E", "+"].includes(e.key)) e.preventDefault();
        });

        // paste — 클립보드에서 비숫자 섞여 들어오는 경우 paste 후 즉시 sanitize
        inputEl.addEventListener("paste", () => {
          setTimeout(() => {
            const cleaned = sanitizeIntOnly(inputEl.value);
            if (inputEl.value !== cleaned) inputEl.value = cleaned;
          }, 0);
        });
      }

      // ── Stake / Unstake 버튼 — stakeMode 에 따라 분기 ──────────────────────
      // 같은 #stakeBtn 엘리먼트가 mode 에 따라 stake / unstake API 를 호출한다.
      // 정수 검증 + 잔량 검사 + 재진입 방어는 양쪽 모드 공통.
      const stakeBtn = document.getElementById("stakeBtn");
      if (stakeBtn && !stakeBtn.dataset.bound) {
        stakeBtn.dataset.bound = "1";

        // (2026-05-06) Lang-aware 토스트/버튼 텍스트.
        // (2026-05-08) ja/zh 분기 추가 — EN/KO 외 locale 에서도 한국어 누출 방지.
        const stakeTx = (ko, en, ja, zh) => {
          const lang = getCurrentLang();
          if (lang === "en") return en;
          if (lang === "ja") return ja ?? en;
          if (lang === "zh") return zh ?? en;
          return ko;
        };

        stakeBtn.addEventListener("click", async () => {
          if (stakeBtn.dataset.busy === "1") return; // 재진입 방어
          if (!isLoggedIn()) {
            window.RwaCore?.toast?.(stakeTx(
              "지갑을 연결하세요.",
              "Please connect your wallet.",
              "ウォレットを接続してください。",
              "请连接钱包。"
            ), "bad");
            return;
          }

          const isUnstake = stakeMode === "unstake";

          // 입력값 sanitize 후 정수 검증
          const rawIn = String(inputEl?.value || "").replace(/[^0-9]/g, "");
          if (!rawIn) {
            window.RwaCore?.toast?.(stakeTx(
              isUnstake ? "언스테이킹 수량을 입력하세요." : "스테이킹 수량을 입력하세요.",
              isUnstake ? "Please enter the unstaking amount." : "Please enter the staking amount.",
              isUnstake ? "アンステーキング数量を入力してください。" : "ステーキング数量を入力してください。",
              isUnstake ? "请输入解除质押数量。" : "请输入质押数量。"
            ), "bad");
            return;
          }
          const qty = Number(rawIn);
          if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
            window.RwaCore?.toast?.(stakeTx(
              isUnstake ? "언스테이킹 수량은 1 이상의 정수여야 합니다." : "스테이킹 수량은 1 이상의 정수여야 합니다.",
              isUnstake ? "Unstaking amount must be a positive integer." : "Staking amount must be a positive integer.",
              isUnstake ? "アンステーキング数量は1以上の整数でなければなりません。" : "ステーキング数量は1以上の整数でなければなりません。",
              isUnstake ? "解除质押数量必须为大于等于1的整数。" : "质押数量必须为大于等于1的整数。"
            ), "bad");
            return;
          }

          // 클라 측 잔량 사전 검사 (UX) — 백엔드도 잡지만 빠른 피드백
          const max = isUnstake ? stakedMax() : idleMax();
          if (qty > max) {
            window.RwaCore?.toast?.(stakeTx(
              isUnstake
                ? `스테이킹된 SilicaSTO 가 부족합니다. (스테이킹: ${max}, 요청: ${qty})`
                : `보유 SilicaSTO 가 부족합니다. (보유: ${max}, 요청: ${qty})`,
              isUnstake
                ? `Insufficient staked SilicaSTO. (Staked: ${max}, Requested: ${qty})`
                : `Insufficient SilicaSTO balance. (Available: ${max}, Requested: ${qty})`,
              isUnstake
                ? `ステーキングされたSilicaSTOが不足しています。（ステーキング: ${max}、要求: ${qty}）`
                : `保有SilicaSTOが不足しています。（保有: ${max}、要求: ${qty}）`,
              isUnstake
                ? `已质押的 SilicaSTO 不足。（已质押：${max}，请求：${qty}）`
                : `持有的 SilicaSTO 不足。（持有：${max}，请求：${qty}）`
            ), "bad");
            return;
          }

          stakeBtn.dataset.busy = "1";
          stakeBtn.disabled = true;
          const origText = stakeBtn.textContent;
          stakeBtn.textContent = stakeTx("처리 중…", "Processing…", "処理中…", "处理中…");

          try {
            const endpoint = isUnstake ? "/api/staking/unstake" : "/api/staking/stake";
            // (2026-05-14 v354) 운영자: '오늘 14일인데 스테이킹과 언스테이킹이
            //   유저 ui에서 작동하는 것 처럼 보인다.' 진단: apiCall() 이
            //   RwaCore.api 의 throw 를 catch 해서 null 을 반환 → backend 가
            //   400 거부 (lock window / 잔액 부족 등) 해도 await 가 fulfill 됨
            //   → showStakingSuccessModal 실행되어 "STAKING COMPLETED" 가 잘못
            //   표시됨. 실제 자산은 안전 (DB 미변경) 이지만 사용자 오해 심각.
            //   수정: stake/unstake 만큼은 RwaCore.api 를 직접 호출하여 throw
            //   를 catch (e) 까지 보존 — 백엔드 거부 메시지를 toast 로 그대로
            //   사용자에게 노출.
            if (!window.RwaCore?.api) {
              throw new Error(stakeTx(
                "API 모듈이 로드되지 않았습니다.",
                "API module not loaded.",
                "APIモジュールが読み込まれていません。",
                "API 模块未加载。"
              ));
            }
            await window.RwaCore.api(endpoint, {
              method: "POST",
              auth: true,
              body: { assetId: "SILICA-79907", amount: qty },
            });
            if (inputEl) {
              inputEl.value = "";
              inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            }
            if (isUnstake) {
              // 언스테이킹 성공 — toast + 페이지 새로고침으로 잔량 갱신.
              window.RwaCore?.toast?.(stakeTx(
                `${qty} SilicaSTO 언스테이킹 완료. 잔액에 반영됩니다.`,
                `Unstaked ${qty} SilicaSTO. The amount has returned to your idle balance.`,
                `${qty} SilicaSTO のアンステーキングが完了しました。残高に反映されます。`,
                `${qty} SilicaSTO 解除质押已完成。已反映至余额。`
              ), "good");
              setTimeout(() => location.reload(), 900);
            } else {
              // (2026-05-06) 토스트+자동 리로드 → 명시적 성공 팝업으로 교체.
              // 사용자가 직접 확인 후 페이지 새로고침을 트리거.
              showStakingSuccessModal(qty);
            }
          } catch (e) {
            const msg = e?.message || stakeTx(
              isUnstake ? "언스테이킹 실패" : "스테이킹 실패",
              isUnstake ? "Unstaking failed." : "Staking failed.",
              isUnstake ? "アンステーキングに失敗しました。" : "ステーキングに失敗しました。",
              isUnstake ? "解除质押失败。" : "质押失败。"
            );
            // (2026-05-14 v356) 운영자: '메시지를 팝업으로 구현.' 토스트가
            //   하단에 잠깐 떴다가 사라져 사용자가 놓치는 문제 — modal 로
            //   명확히 노출. catch (e) 에서 받은 메시지는 i18n 풀-센텐스
            //   매핑으로 lang-aware 자동 번역.
            showStakingErrorModal(msg, { isUnstake });
          } finally {
            stakeBtn.dataset.busy = "0";
            stakeBtn.disabled = false;
            stakeBtn.textContent = origText;
          }
        });
      }
    }

    // ─── 클레임 ───
    if (page === "claim") {
      // (2026-05-08) Show TOTAL (claimed + pending) on the headline so the
      //   user sees their full earned interest right after the admin runs
      //   "이자 지급 테스팅" — earlier this only counted claimed_interest_usdt
      //   so the page read $0.00 until the user clicked Claim on staking.html.
      const totalInterestUsdt = interestSummary.reduce(
        (sum, r) => sum + Number(r?.total_interest_usdt || 0), 0
      );
      const pendingInterestUsdt = interestSummary.reduce(
        (sum, r) => sum + Number(r?.pending_interest_usdt || 0), 0
      );
      const pendingRoundsTotal = interestSummary.reduce(
        (sum, r) => sum + Number(r?.pending_rounds || 0), 0
      );

      // (2026-05-08) Claim hero card — ALWAYS visible. Earlier this was
      //   hidden when pending = 0 and users repeatedly couldn't find any
      //   claim button. Now we always render the card and swap between
      //   green-active and gray-disabled states.
      const heroCard = document.getElementById("claimHeroCard");
      const heroAmt = document.getElementById("claimHeroAmount");
      const heroAmtWrap = document.getElementById("claimHeroAmountWrap");
      const heroRounds = document.getElementById("claimHeroRounds");
      const heroEyebrow = document.getElementById("claimHeroEyebrow");
      const heroBtn = document.getElementById("claimHeroBtn");
      const claimLangEn = (_lang === "en");
      const heroHasPending = pendingInterestUsdt > 0;
      if (heroCard) {
        heroCard.style.display = "";
        if (heroHasPending) {
          heroCard.style.border = "1px solid rgba(16, 185, 129, 0.4)";
          heroCard.style.background = "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))";
        } else {
          heroCard.style.border = "1px solid var(--line)";
          heroCard.style.background = "";
        }
      }
      if (heroEyebrow) {
        heroEyebrow.textContent = heroHasPending
          ? (claimLangEn ? "◆ READY TO CLAIM" : "◆ 수령 가능")
          : (claimLangEn ? "◆ INTEREST CLAIM" : "◆ 이자 클레임");
        heroEyebrow.style.color = heroHasPending ? "var(--green)" : "";
      }
      // (2026-05-12 v305) claim.html hero pending amount — 1자리 통일.
      if (heroAmt) heroAmt.textContent = fmtN(pendingInterestUsdt, 1);
      if (heroAmtWrap) heroAmtWrap.style.color = heroHasPending ? "var(--green)" : "var(--steel)";
      if (heroRounds) {
        if (heroHasPending) {
          // (v592) 안내 문구 단순화 — 회차 수만 노출.
          heroRounds.textContent = claimLangEn
            ? `${pendingRoundsTotal} pending`
            : `${pendingRoundsTotal}회 미수령`;
        } else {
          heroRounds.textContent = "";
        }
      }
      if (heroBtn) {
        heroBtn.disabled = !heroHasPending;
        if (heroBtn.dataset.busy !== "1") {
          heroBtn.textContent = claimLangEn ? "Claim Now" : "이자 클레임";
        }
      }
      if (heroBtn && !heroBtn.dataset.bound) {
        heroBtn.dataset.bound = "1";
        heroBtn.addEventListener("click", async () => {
          if (heroBtn.dataset.busy === "1") return;
          if (heroBtn.disabled) return;
          heroBtn.dataset.busy = "1";
          heroBtn.disabled = true;
          const origLabel = heroBtn.textContent;
          heroBtn.textContent = claimLangEn ? "Claiming…" : "처리 중…";
          try {
            const r = await apiCall("/api/interest/claim", {
              method: "POST",
              body: { assetId: "SILICA-79907" },
            });
            const amt = Number(r?.amount_usdt || 0);
            const cnt = Number(r?.claimed_count || 0);
            window.RwaCore?.toast?.(
              claimLangEn
                ? `Claimed ${fmtN(amt, 1)} USDT (${cnt} round${cnt === 1 ? "" : "s"}) — USDT balance updated.`
                : `${fmtN(amt, 1)} USDT (${cnt}회) 클레임 완료 — USDT 잔액에 반영되었습니다.`,
              "good"
            );
            setTimeout(() => location.reload(), 700);
          } catch (e) {
            window.RwaCore?.toast?.(
              (claimLangEn ? "Claim failed: " : "클레임 실패: ") + (e?.message || e),
              "bad"
            );
            heroBtn.dataset.busy = "0";
            heroBtn.disabled = false;
            heroBtn.textContent = origLabel;
          }
        });
      }

      // (2026-05-08) "자세히 보기" on claim.html hero card — same
      //   detail modal as on staking.html.
      const heroDetailBtn = document.getElementById("claimHeroDetailBtn");
      if (heroDetailBtn) {
        heroDetailBtn.textContent = claimLangEn ? "View Details" : "자세히 보기";
        if (!heroDetailBtn.dataset.bound) {
          heroDetailBtn.dataset.bound = "1";
          heroDetailBtn.addEventListener("click", () => openInterestDetailModal(claimLangEn));
        }
      }

      setHtml("claimCumulInterest", fmtUsdHtml(totalInterestUsdt));
      const cumulRounds = interestSummary.reduce((s, r) => s + Number(r?.total_rounds || 0), 0);
      const langEnClaim = (_lang === "en");
      setText("claimCumulInterestUnit", cumulRounds > 0
        ? (langEnClaim
            ? `USDT (${cumulRounds} cycles${pendingInterestUsdt > 0 ? ` · ${fmtN(pendingInterestUsdt, 1)} pending` : ""})`
            : `USDT (${cumulRounds}회${pendingInterestUsdt > 0 ? ` · ${fmtN(pendingInterestUsdt, 1)} 미수령` : ""})`)
        : "USDT");
      // (2026-05-11 v237) Cumulative Dividend 소수점 작게 — fmtBalHtml
      //   이 정수 부분 + <small>.소수점</small> 형태로 출력.
      // (2026-05-11 v240) 실제 지급된 배당 합계만 사용. 이전에는
      //   silicaBal(지갑 잔고)을 사용해 배당 받지 않은 사용자에게도
      //   잔고만큼 표시되는 버그가 있었음.
      setHtml("claimCumulDividend", fmtBalHtml(cumulativeDividendSilica, 2));
      setHtml("claimTotalValue", fmtUsdHtml(totalInterestUsdt + cumulativeDividendSilica * silicaPrice));

      // (2026-05-15 v364) INTEREST 탭의 Next Interest Schedule 카드 — 배당과
      //   동일 패턴. 다음 지급일 + 본인 expected_usdt 표시.
      (async () => {
        const titleEl = document.getElementById("nextInterestTitle");
        const dateEl = document.getElementById("nextInterestDate");
        const amtEl = document.getElementById("nextInterestAmount");
        if (!titleEl && !dateEl && !amtEl) return;

        try {
          const r = await apiCall("/api/silica/interest/next");
          const next = r?.next;
          if (!next) return;

          const payoutDate = String(next.payout_date || "").slice(0, 10);
          const aprPct = Number(next.apr_pct || 0);
          const userStake = next.user;

          if (titleEl) {
            titleEl.textContent = claimLangEn
              ? `Monthly Interest · ${payoutDate}`
              : `월 이자 · ${payoutDate}`;
          }

          if (dateEl) {
            // (2026-05-19 v593) 운영자 요청 — 안내 문구 제거. 스테이킹된 경우만
            //   수량/APR 한 줄로 노출, 그 외엔 빈 텍스트.
            if (userStake && userStake.staked_sto > 0) {
              dateEl.textContent = `${fmtN(userStake.staked_sto, 0)} SilicaSTO · APR ${aprPct}%`;
            } else {
              dateEl.textContent = "";
            }
          }

          if (amtEl) {
            const expectedUsdt = userStake?.expected_usdt;
            if (expectedUsdt != null && expectedUsdt > 0) {
              amtEl.innerHTML = `${fmtN(expectedUsdt, 1)} <span style="font-size:0.45em;color:var(--steel);font-weight:600;letter-spacing:1px">USDT</span>`;
            } else {
              amtEl.innerHTML = `<span style="font-size:0.65em;color:var(--steel)">— USDT</span>`;
            }
          }
        } catch (e) {
          console.warn('[next interest]', e);
        }
      })();

      // (2026-05-15 v363) DIVIDEND 탭 — Annual Dividend Payout Info 데이터
      //   backend dividend_executions 의 다음 scheduled 회차 정보를 fetch.
      //   wallet 연결 시 본인 share + expected silica 까지 계산해 표시.
      //   기존엔 frontend 에 fetch 로직 자체가 없어 정적 placeholder 만 노출됨.
      (async () => {
        const titleEl = document.getElementById("nextDividendTitle");
        const dateEl = document.getElementById("nextDividendDate");
        const amtEl = document.getElementById("nextDividendAmount");
        if (!titleEl && !dateEl && !amtEl) return;

        try {
          const r = await apiCall("/api/silica/dividend/schedule");
          const next = r?.next;
          // (2026-06-16 v898) 미수령(my_pending)은 예정(next)과 독립 — 배당 paid 후에도 표시.
          //   구버전 응답(next.user.pending_*) 폴백 포함.
          const myPending = r?.my_pending || (next && next.user) || null;

          // (2026-06-16 v898) NEXT DIVIDEND(예정) 영역만 if/else 로 칠하고, 아래 CLAIM 블록은
          //   항상 실행(myPending 기준). 기존엔 next 없으면 return 하여 claim 버튼 미도달이었음.
          if (!next) {
            // (v593) 안내 문구 제거 — 빈 상태.
            if (titleEl) titleEl.textContent = claimLangEn
              ? "No Scheduled Dividend"
              : "예정된 배당 없음";
            if (dateEl) dateEl.textContent = "";
            if (amtEl) amtEl.innerHTML = `<span style="font-size:0.65em;color:var(--steel)">— Silica</span>`;
            // (v898) return 제거 — 아래 CLAIM 블록으로 계속 진행
          } else {

          const payoutDate = String(next.payout_date || "").slice(0, 10);
          const poolUsdt = Number(next.pool_usdt || 0);
          const silicaPriceUsdt = next.silica_price_usdt;
          const userShare = next.user;

          if (titleEl) {
            titleEl.textContent = claimLangEn
              ? `Annual Dividend · ${payoutDate}`
              : `연 배당 · ${payoutDate}`;
          }

          if (dateEl) {
            const sharePct = userShare?.share_pct;
            if (sharePct != null && sharePct > 0) {
              dateEl.textContent = claimLangEn
                ? `Pool: ${fmtN(poolUsdt, 0)} USDT · Your share: ${sharePct}%`
                : `풀: ${fmtN(poolUsdt, 0)} USDT · 내 비중: ${sharePct}%`;
            } else if (userShare) {
              dateEl.textContent = claimLangEn
                ? `Pool: ${fmtN(poolUsdt, 0)} USDT · Stake SilicaSTO before payout date to participate.`
                : `풀: ${fmtN(poolUsdt, 0)} USDT · 지급일 전 SilicaSTO 스테이킹 필요`;
            } else {
              dateEl.textContent = claimLangEn
                ? `Pool: ${fmtN(poolUsdt, 0)} USDT · Connect wallet to see your expected receipt.`
                : `풀: ${fmtN(poolUsdt, 0)} USDT · 지갑 연결 시 예상 수령액 표시`;
            }
          }

          if (amtEl) {
            const expectedSilica = userShare?.expected_silica;
            if (expectedSilica != null && expectedSilica > 0) {
              amtEl.innerHTML = `${fmtN(expectedSilica, 2)} <span style="font-size:0.45em;color:var(--steel);font-weight:600;letter-spacing:1px">Silica</span>`;
            } else if (silicaPriceUsdt == null) {
              amtEl.innerHTML = claimLangEn
                ? `<span style="font-size:0.45em;color:var(--steel)">Silica price not set</span>`
                : `<span style="font-size:0.45em;color:var(--steel)">Silica 시세 미설정</span>`;
            } else {
              amtEl.innerHTML = `<span style="font-size:0.65em;color:var(--steel)">— Silica</span>`;
            }
          }
          } // (2026-06-16 v898) NEXT DIVIDEND else 블록 끝 — 예정 있을 때만 위 영역 렌더

          // (2026-05-15 v367) Claim button — pending 분이 있으면 활성.
          //   합산 silica 표시 + 클릭 시 한 번에 모두 클레임.
          //   (2026-06-16 v898) myPending(미수령) 기준 — 예정(next) 유무와 독립. next 없어도 실행.
          const claimAmtEl = document.getElementById('dividendClaimAmount');
          const claimRoundsEl = document.getElementById('dividendClaimRounds');
          const claimBtn = document.getElementById('dividendClaimBtn');
          const claimEyebrow = document.getElementById('dividendClaimEyebrow');

          const pendingSilica = Number(myPending?.pending_silica_total || 0);
          const pendingCount = Number(myPending?.pending_claim_count || 0);

          if (claimAmtEl) claimAmtEl.textContent = fmtN(pendingSilica, 2);
          if (claimRoundsEl) {
            claimRoundsEl.textContent = pendingCount > 0
              ? (claimLangEn
                  ? `${pendingCount} round${pendingCount === 1 ? '' : 's'} pending · click Claim Now to receive Silica`
                  : `${pendingCount}회 미수령 · Claim Now 클릭 시 Silica 잔액 입금`)
              : (claimLangEn
                  ? 'No dividend to claim right now.'
                  : '지금 수령할 배당이 없습니다.');
          }
          if (claimEyebrow) {
            claimEyebrow.textContent = pendingCount > 0
              ? (claimLangEn ? '◆ READY TO CLAIM' : '◆ 수령 가능')
              : (claimLangEn ? '◆ DIVIDEND CLAIM' : '◆ 배당 클레임');
            claimEyebrow.style.color = pendingCount > 0 ? 'var(--green)' : '';
          }
          if (claimBtn) {
            claimBtn.disabled = !(pendingCount > 0);
            claimBtn.textContent = claimLangEn ? 'Claim Now' : '배당 클레임';
            if (!claimBtn.dataset.bound) {
              claimBtn.dataset.bound = '1';
              claimBtn.addEventListener('click', async () => {
                if (claimBtn.dataset.busy === '1' || claimBtn.disabled) return;
                claimBtn.dataset.busy = '1';
                claimBtn.disabled = true;
                const origLabel = claimBtn.textContent;
                claimBtn.textContent = claimLangEn ? 'Claiming…' : '처리 중…';
                try {
                  if (!window.RwaCore?.api) throw new Error('API not available');
                  const r = await window.RwaCore.api('/api/silica/dividend/claim', {
                    method: 'POST',
                    auth: true,
                    body: {},
                  });
                  const total = Number(r?.total_silica || 0);
                  const cnt = Number(r?.claimed_count || 0);
                  window.RwaCore?.toast?.(
                    claimLangEn
                      ? `Claimed ${fmtN(total, 2)} Silica (${cnt} round${cnt === 1 ? '' : 's'}) — Silica balance updated.`
                      : `${fmtN(total, 2)} Silica (${cnt}회) 배당 클레임 완료 — Silica 잔액에 반영되었습니다.`,
                    'good'
                  );
                  setTimeout(() => location.reload(), 800);
                } catch (e) {
                  window.RwaCore?.toast?.(
                    (claimLangEn ? 'Claim failed: ' : '클레임 실패: ') + (e?.message || e),
                    'bad'
                  );
                  claimBtn.dataset.busy = '0';
                  claimBtn.disabled = false;
                  claimBtn.textContent = origLabel;
                }
              });
            }
          }
        } catch (e) {
          console.warn('[dividend schedule]', e);
        }
      })();

      // (2026-05-16 v412) REFERRAL 탭 — 클레임 카드 (pending 합계 + Claim 버튼).
      //   기존 즉시 지급 → 클레임 방식 전환. 사용자가 [Claim Now] 클릭 시
      //   본인 pending referral_bonus_payouts 모두 합산해 balances.usdt 가산.
      (async () => {
        const claimAmtElR     = document.getElementById('referralClaimAmount');
        const claimRoundsElR  = document.getElementById('referralClaimRounds');
        const claimBtnR       = document.getElementById('referralClaimBtn');
        const claimEyebrowR   = document.getElementById('referralClaimEyebrow');
        if (!claimBtnR) return;

        try {
          const r = await apiCall("/api/referral/pending");
          const pendingTotal = Number(r?.pending_total_usdt || 0);
          const pendingCount = Number(r?.pending_count || 0);

          if (claimAmtElR) claimAmtElR.textContent = fmtN(pendingTotal, 3);
          if (claimRoundsElR) {
            claimRoundsElR.textContent = pendingCount > 0
              ? (claimLangEn
                  ? `${pendingCount} pending`
                  : `${pendingCount}회 미수령`)
              : '';
          }
          if (claimEyebrowR) {
            claimEyebrowR.textContent = pendingCount > 0
              ? (claimLangEn ? '◆ READY TO CLAIM' : '◆ 수령 가능')
              : (claimLangEn ? '◆ REFERRAL BONUS' : '◆ 추천 보너스');
            claimEyebrowR.style.color = pendingCount > 0 ? 'var(--green)' : '';
          }
          claimBtnR.disabled = !(pendingCount > 0);
          claimBtnR.textContent = claimLangEn ? 'Claim Now' : '추천 보너스 클레임';

          if (!claimBtnR.dataset.bound) {
            claimBtnR.dataset.bound = '1';
            claimBtnR.addEventListener('click', async () => {
              // (v413) 이중 클릭 방어 강화:
              //   1) busy / disabled 즉시 확인 → JS single-thread 라 race 차단
              //   2) pointer-events: none + opacity 시각 피드백
              //   3) 클릭 직후 1.5초 추가 cooldown (성공/실패 무관)
              //   4) backend (referral.php) 가 FOR UPDATE 로 동시 transaction
              //      차단 — pending 0 시 'no pending' 응답 (자연스러운 차단)
              if (claimBtnR.dataset.busy === '1' || claimBtnR.disabled) return;
              claimBtnR.dataset.busy = '1';
              claimBtnR.disabled = true;
              claimBtnR.style.pointerEvents = 'none';
              claimBtnR.style.opacity = '0.6';
              const origLabel = claimBtnR.textContent;
              claimBtnR.textContent = claimLangEn ? 'Claiming…' : '처리 중…';
              let resolvedAt = 0;
              try {
                if (!window.RwaCore?.api) throw new Error('API not available');
                const res = await window.RwaCore.api('/api/referral/claim', {
                  method: 'POST',
                  auth: true,
                  body: {},
                });
                const total = Number(res?.total_usdt || 0);
                const cnt   = Number(res?.claimed_count || 0);
                if (cnt > 0) {
                  window.RwaCore?.toast?.(
                    claimLangEn
                      ? `Claimed ${fmtN(total, 3)} USDT (${cnt} round${cnt === 1 ? '' : 's'}) — USDT balance updated.`
                      : `${fmtN(total, 3)} USDT (${cnt}회) 추천 보너스 클레임 완료 — USDT 잔액 반영.`,
                    'good'
                  );
                  setTimeout(() => location.reload(), 1200);
                } else {
                  // backend 가 '수령할 보너스 없음' 반환 — 이중 클릭 또는 이미 처리됨.
                  window.RwaCore?.toast?.(
                    claimLangEn
                      ? 'No referral bonus to claim — already processed.'
                      : '수령할 추천 보너스가 없습니다 (이미 처리됨).',
                    'good'
                  );
                  resolvedAt = Date.now();
                }
              } catch (e) {
                window.RwaCore?.toast?.(
                  (claimLangEn ? 'Claim failed: ' : '클레임 실패: ') + (e?.message || e),
                  'bad'
                );
                resolvedAt = Date.now();
              } finally {
                // 추가 cooldown — 빠른 재클릭 차단.
                const cooldown = Math.max(0, 1500 - (Date.now() - resolvedAt));
                setTimeout(() => {
                  claimBtnR.dataset.busy = '0';
                  claimBtnR.disabled = false;
                  claimBtnR.style.pointerEvents = '';
                  claimBtnR.style.opacity = '';
                  claimBtnR.textContent = origLabel;
                }, cooldown);
              }
            });
          }
        } catch (e) {
          console.warn('[referral pending]', e);
        }
      })();

      // (2026-05-08) Per-cycle rows on claim.html — earlier this rendered
      //   a single aggregated 'X cycles · Y USDT' row per asset, but the
      //   operator wanted each interest_claims row visible separately.
      //   Fetch /api/interest/pending + /api/interest/claimed in parallel,
      //   merge, sort newest first, render one <tr> per row. Empty state
      //   preserved when both lists are empty.
      const tbody = document.getElementById("claimHistoryBody");
      if (tbody) {
        // Async sub-block — don't block the rest of bind() on this fetch.
        (async () => {
          let pendingRows = [];
          let claimedRows = [];
          try {
            const [pRes, cRes] = await Promise.all([
              apiCall("/api/interest/pending"),
              apiCall("/api/interest/claimed?limit=200"),
            ]);
            pendingRows = Array.isArray(pRes?.rows) ? pRes.rows : [];
            claimedRows = Array.isArray(cRes?.rows) ? cRes.rows : [];
          } catch (_) { /* leave empty state */ }

          const all = [
            ...pendingRows.map((r) => ({ ...r, _pending: true })),
            ...claimedRows.map((r) => ({ ...r, _pending: false })),
          ];

          if (!all.length) return;

          // Newest cycle first; within same month_key pending precedes
          // claimed so the user sees actionable rows on top.
          all.sort((a, b) => {
            const ma = String(a.month_key || "");
            const mb = String(b.month_key || "");
            if (ma !== mb) return mb.localeCompare(ma);
            return (a._pending === b._pending) ? 0 : (a._pending ? -1 : 1);
          });

          // Compute period label "Mar 16 → Apr 15" or "3/16~4/15"
          const monthLabelEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const periodFromMonthKey = (mk) => {
            const m = /^(\d{4})-(\d{2})$/.exec(String(mk || ""));
            if (!m) return "—";
            const y = Number(m[1]);
            const mo = Number(m[2]);
            const prevMo = mo === 1 ? 12 : mo - 1;
            const prevY = mo === 1 ? y - 1 : y;
            if (langEnClaim) {
              return `${monthLabelEn[prevMo - 1]} 16 → ${monthLabelEn[mo - 1]} 15`;
            }
            // KO compact form: "3/16 ~ 4/15"
            return `${prevY === y ? "" : prevY + "."}${prevMo}/16 ~ ${mo}/15`;
          };

          tbody.innerHTML = all.map((r) => {
            const month = String(r.month_key || "—").slice(0, 7);
            const period = periodFromMonthKey(r.month_key);
            const apr = Number(r.apr_snapshot || 0);
            const staked = Number(r.staked_snapshot || 0);
            const amt = Number(r.amount_usdt || 0);
            const isPending = !!r._pending;
            const statusBadge = isPending
              ? `<span class="badge" style="background:rgba(245,158,11,0.18);color:#92400e">${langEnClaim ? "Pending" : "미수령"}</span>`
              : `<span class="badge badge-success">${langEnClaim ? "Paid" : "지급 완료"}</span>`;
            const txCell = isPending
              ? `<a href="staking.html" style="color:var(--aurora-3);font-size:12px;text-decoration:none">${langEnClaim ? "Claim →" : "클레임 →"}</a>`
              : "—";
            return `
              <tr>
                <td><strong>${month}</strong></td>
                <td class="text-muted" style="font-size:12px">${period}</td>
                <td class="text-mono">${fmtN(apr, 2)}%</td>
                <td class="text-mono">${fmtN(staked, 0)} STO</td>
                <td class="text-mono text-success">+${fmtN(amt, 1)} USDT</td>
                <td>${statusBadge}</td>
                <td>${txCell}</td>
              </tr>`;
          }).join("");
        })();
      }
    }

    // ─── 출금 ───
    if (page === "withdraw") {
      setText("wdBalUsdt", fmtN(usdt, 2));
      setText("wdBalSto", fmtN(stoIdle, 2));
      setText("wdBalSilica", fmtN(silicaBal, 2));

      // ★ 받는 주소 자동 입력 (연결된 본인 지갑) + readonly
      const toAddrInput = document.getElementById("wdToAddress");
      if (toAddrInput && me.address) {
        toAddrInput.value = String(me.address);
        toAddrInput.readOnly = true;
      }

      // 사용가능 표시 (선택된 토큰 = SilicaSTO 기본)
      setText("wdAvailable", `${Math.floor(stoIdle).toLocaleString()} SilicaSTO`);

      // 출금 수량 정수만 강제
      const amtInput = document.getElementById("wdAmountInput");
      if (amtInput) {
        amtInput.addEventListener("input", () => {
          // 소수점/문자 제거 → 정수만
          let v = String(amtInput.value || "").replace(/[^\d]/g, "");
          if (v && Number(v) > 0) amtInput.value = v;
          else amtInput.value = "";
        });
        amtInput.addEventListener("blur", () => {
          let v = parseInt(amtInput.value || "0", 10);
          if (!Number.isFinite(v) || v < 1) {
            amtInput.value = "";
          } else {
            amtInput.value = String(v);
          }
        });
      }

      // MAX 버튼 — idle 잔액 정수 부분만
      document.getElementById("wdMaxBtn")?.addEventListener("click", () => {
        if (amtInput) amtInput.value = String(Math.floor(stoIdle));
      });
    }

    // ─── 스왑 ───
    if (page === "swap") {
      // (2026-05-06) lang-aware 표기
      // (2026-05-07) STO 산식 정정 — 1 SilicaSTO = 1 USDT 페그.
      //   sto_out = silica_in × silicaPrice  (USDT 가치 = STO 수량)
      //   기존 (amt / 20) 은 silicaPrice=0.05 가정의 정적 계산이라
      //   MEA 연동 시 가격이 0.0029 등으로 바뀌면 STO 표기가 어긋났음.
      // 또한 swap.html 인라인 JS 의 quote 가 잠금되면 그쪽이 갱신을 가로채고,
      // 잠금이 없는 페이지 진입 직후에는 이 binding 이 표시 책임을 진다.
      // (2026-05-08) ja/zh 분기 추가 — 비-KO/EN locale 에서도 한국어 누출 방지.
      const _balLabel =
        _lang === "en" ? "Balance" :
        _lang === "ja" ? "残高" :
        _lang === "zh" ? "余额" :
        "잔액";
      setText("swapFromBalance", `${_balLabel}: ${fmtN(silicaBal, 2)}`);
      setText("swapToBalance", `${_balLabel}: ${fmtN(stoBal, 2)}`);
      const fromInput = document.getElementById("swapFromAmount");
      const fromConv = document.getElementById("swapFromConv");
      const toInput = document.getElementById("swapToAmount");
      const toConv = document.getElementById("swapToConv");
      const updateSwap = () => {
        const amt = Number(fromInput?.value || 0);
        const usdtVal = amt * silicaPrice;
        // (2026-05-08) ja/zh 분기 — KO/EN 외 locale 에서 한국어/영어 누출 방지.
        if (fromConv) {
          fromConv.textContent =
            _lang === "en" ? `≈ ${fmtN(usdtVal, 2)} USDT (price ${silicaPrice})` :
            _lang === "ja" ? `≈ ${fmtN(usdtVal, 2)} USDT (価格 ${silicaPrice})` :
            _lang === "zh" ? `≈ ${fmtN(usdtVal, 2)} USDT (价格 ${silicaPrice})` :
            `≈ ${fmtN(usdtVal, 2)} USDT (시세 ${silicaPrice})`;
        }
        // 1 STO = 1 USDT 페그라 STO 수량 = silica × price.
        // (2026-05-11 v234) STO는 정수만 발행되므로 Math.floor 적용.
        //   기존 toFixed(4)는 입력 전 상태에서 '0.0000'으로 출력되어
        //   더미 값처럼 보였음. 정수 표기로 통일 — 0일 때는 '0'.
        if (toInput) toInput.value = silicaPrice > 0 ? String(Math.floor(usdtVal)) : "";
        // 정적 "≈ 5.00 USDT (1:1 peg)" 자리 — 사용자 입력에 맞춰 동적.
        // 인라인 swap.html JS 가 quote 잠금 후엔 fee 차감한 net 값을 다시 갱신함.
        if (toConv) {
          const pegSuffix =
            _lang === "en" ? "(1:1 peg)" :
            _lang === "ja" ? "(1:1 ペグ)" :
            _lang === "zh" ? "(1:1 锚定)" :
            "(1:1 페그)";
          toConv.textContent = (silicaPrice > 0 && amt > 0)
            ? `≈ ${fmtN(usdtVal, 2)} USDT ${pegSuffix}`
            : `≈ - USDT ${pegSuffix}`;
        }
      };
      if (fromInput) {
        fromInput.addEventListener("input", updateSwap);
        updateSwap();
      }
    }

    // ─── 입금 (deposit) — 지갑 주소 표시 (복사 버튼 제거됨, 외부 수동 입금 방지) ───
    if (page === "deposit") {
      const addr = String(me.address || "").trim();
      if (addr) {
        setText("depositAddress", addr);
        const addrEl = document.getElementById("depositAddress");
        if (addrEl) { addrEl.classList.remove("text-muted"); addrEl.style.color = "var(--ice)"; }

        // QR 박스 텍스트 (실제 QR은 별도 라이브러리 필요)
        setText("depositQrText", `Address:\n${addr.slice(0, 12)}...${addr.slice(-8)}`);
      }
    }

    // ─── 프로필 (profile) — 사용자 정보 표시 ───
    if (page === "profile") {
      const addr = String(me.address || "").trim();
      const profile = await apiCall("/api/user/profile").catch(() => null);

      // 사이드바
      const initial = (kyc?.approved_name || addr.slice(0, 1) || "?").charAt(0).toUpperCase();
      setText("profileAvatar", initial);
      setText("profileName", kyc?.approved_name || (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—"));
      setText("profileEmail", profile?.email || "—");

      // KYC 뱃지
      if (kyc?.status === "approved") {
        const badge = document.getElementById("profileKycBadge");
        if (badge) {
          badge.textContent = "KYC ✓";
          badge.style.background = "var(--success)";
          badge.style.color = "#fff";
        }
      }

      // 입력 폼 (기본값 채우기, 빈 칸은 placeholder)
      const setInputVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      setInputVal("profileNameInput", kyc?.approved_name || "");
      setInputVal("profileEmailInput", profile?.email || "");

      // 연결된 지갑
      if (addr) {
        setText("profileWalletAddr", `${addr.slice(0, 8)}...${addr.slice(-6)}`);
        const walletBadge = document.getElementById("profileWalletBadge");
        if (walletBadge) {
          // (2026-05-08) lang-aware. EN/JA/ZH 모드에서 "연결됨" 한국어 누출 방지.
          walletBadge.textContent =
            _lang === "en" ? "Connected" :
            _lang === "ja" ? "接続済み" :
            _lang === "zh" ? "已连接" :
            "연결됨";
          walletBadge.style.background = "var(--success)";
          walletBadge.style.color = "#fff";
          walletBadge.style.border = "none";
        }
      }
    }

    // ─── 거래 (trade) — SilicaSTO ↔ USDT 가격/잔액 표시 ───
    // (2026-05-08) Pair updated to SilicaSTO/USDT. The Silica reward token
    //   trades externally; this page is the in-platform STO order book.
    //   Reference price is the 1 STO = 1 USDT peg until the OHLC API
    //   wires up actual trade-derived prices.
    if (page === "trade") {
      setText("tradePrice", `1.00 USDT`);
      setText("tradeHigh", `1.00 USDT`);  // 24H high — replace with OHLC pull when trades start landing
      setText("tradeChange", "0.00%");
      setText("tradeVolume", "0 STO");
      setText("tradeAvailable", `${fmtN(usdt, 2)} USDT`);
      // (2026-05-08) STO holdings under the Available USDT row.
      //   Operator wanted the tradable token balance visible alongside.
      setText("tradeAvailableSto", `${fmtN(stoBal, 0)} STO`);

      // 미체결 주문 (/api/orders/my 등) — 해당 API 미구현 시 empty 유지
    }

    // ─── 추천인 (1단계 only — Recon 호환) ───
    if (page === "referral") {
      // /api/referral/my-status — 내 추천인 코드/통계 + 관리자 설정 보너스율
      const status = await apiCall("/api/referral/my-status");

      // ★ 관리자 승인된 추천인 만 접근 허용 (Recon 동일)
      const allowed = !!status?.is_referrer && !!status?.referrer_active;
      if (!allowed) {
        // 페이지 콘텐츠 숨기고 안내 표시
        const container = document.querySelector('div.container');
        if (container) {
          container.innerHTML = `
            <div style="max-width: 720px; margin: 80px auto; padding: 64px 32px; text-align: center;
                        background: var(--panel); border: 1px solid var(--line-strong); border-radius: 16px;">
              <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
              <h1 style="font-family: 'Bebas Neue'; font-size: 32px; letter-spacing: 1px; margin-bottom: 12px;">
                Referrer Permission Required
              </h1>
              <p class="text-muted" style="font-size: 14px; line-height: 1.7; margin-bottom: 24px;">
                The Referral Program is available only to <strong>admin-approved users</strong>.<br>
                Please contact admin to request referrer permission.
              </p>
              <a href="index.html" class="btn btn-primary" style="margin-right: 8px;">Home</a>
              <a href="portfolio.html" class="btn btn-secondary">Portfolio</a>
            </div>`;
        }
        return; // 더 이상 진행 안 함
      }

      const refCode = String(status?.referrer_code || "").trim();

      // 관리자가 설정한 보너스율 (settings.referral_bonus_rate × 100)
      const bonusRatePct = Number(status?.bonus_rate_pct || 1);
      const ratePctText = bonusRatePct.toFixed(bonusRatePct % 1 === 0 ? 0 : 1);

      // hero 카드 동적 표시
      setHtml("refHeroRate", `${ratePctText}<small style="font-size:0.4em;font-weight:700;">%</small>`);
      setText("refEyebrow", `◆ 1-TIER REFERRAL · ${ratePctText}% DIRECT`);
      setText("refSubtitle", `Invite friends directly and earn ${ratePctText}% of their monthly interest`);
      setHtml("refHeroDesc",
        `Earn an additional <strong style="color: var(--aurora-3);">${ratePctText}%</strong> of monthly interest from users you directly invited.`
      );
      setHtml("refAlertRate", `${ratePctText}%`);

      if (refCode) {
        const url = `${location.origin}/?ref=${encodeURIComponent(refCode)}`;
        setText("refCode", refCode);
        setText("refUrl", url);

        // 복사·공유 버튼 핸들러
        const copyTo = (txt) => {
          if (!txt) return;
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(txt).then(() => alert("Copied to clipboard."));
          } else {
            const ta = document.createElement("textarea");
            ta.value = txt; document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); alert("Copied to clipboard."); } catch (_) {}
            document.body.removeChild(ta);
          }
        };
        document.getElementById("refCodeCopy")?.addEventListener("click", () => copyTo(refCode));
        document.getElementById("refUrlCopy")?.addEventListener("click", () => copyTo(url));
        document.getElementById("refShareKakao")?.addEventListener("click", () => copyTo(`SilicaChain RWA — Korean Silica Mine Tokenization ${url}`));
        document.getElementById("refShareEmail")?.addEventListener("click", () => {
          location.href = `mailto:?subject=${encodeURIComponent("SilicaChain Referral")}&body=${encodeURIComponent("SilicaChain RWA referral link: " + url)}`;
        });
        document.getElementById("refShareTwitter")?.addEventListener("click", () => {
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent("SilicaChain RWA referral: " + url)}`, "_blank");
        });
      } else {
        setText("refCode", "No referrer code yet");
        setText("refUrl", "Contact admin to activate");
      }

      // 통계 (referral_count, total_bonus_usdt)
      const directCount = Number(status?.referral_count || 0);
      const totalBonus  = Number(status?.total_bonus_usdt || 0);
      setText("refDirectCount", String(directCount));
      setText("refListCount", `${directCount} users`);
      // (2026-05-12 v307) 추천 보상은 백엔드 floor3() 3자리 저장 정책에
      //   맞춰 표시도 3자리. fmtUsdHtml 은 2자리 고정이라 fmtBalHtml(v, 3)
      //   사용 — '$0.041' 처럼 0.001 USDT 단위까지 노출.
      setHtml("refTotalBonus", "$" + fmtBalHtml(totalBonus, 3));

      // 추천한 사람 목록 (1단계만) — bonusRatePct 는 위에서 이미 선언됨
      const refData = await apiCall("/api/referral/my-referrals");
      const list = Array.isArray(refData?.referrals) ? refData.referrals : [];

      // 이번달 예상 (정확한 stake 정보가 referral 응답에 없으면 0 처리)
      // 보수적으로 0 표시 (다음 회차에서 정확히 산출됨)
      setHtml("refMonthlyEst", fmtUsdHtml(0));

      // 추천한 사람 리스트 렌더링
      const listEl = document.getElementById("refList");
      if (listEl && list.length > 0) {
        listEl.innerHTML = list.map((r) => {
          const masked = String(r.address_masked || "—");
          const nick = String(r.nickname || "").trim();
          const init = (nick || masked).slice(0, 2).toUpperCase();
          const linkedAt = String(r.linked_at || "").slice(0, 10);
          return `
            <div class="tree-node">
              <div class="tree-avatar">${init}</div>
              <div style="flex: 1;">
                <div style="font-weight: 600;">${masked}${nick ? ` <span class="text-muted" style="font-size:11px;font-weight:400">· ${nick}</span>` : ""} <span class="text-muted" style="font-size:11px;font-weight:400">· Direct Referral</span></div>
                <div class="text-muted" style="font-size: 12px;">${linkedAt ? "Joined " + linkedAt : "Join date unknown"}</div>
              </div>
              <div class="text-right">
                <div class="text-muted" style="font-size: 11px;">${ratePctText}%</div>
              </div>
            </div>`;
        }).join("");
      }
    }

    // ─── 자산 투자 페이지 (assets.html — data-page='funding' 으로 통합됨) ───
    // assets.html 이 funding 모듈을 통합 호스팅하므로 두 page 값 모두 처리.
    // 이 블록은 calc summary / scenario card / KRW lock note 등 assets.html
    // 전용 UI 만 업데이트하며, 계약/펀딩 폼은 pages/funding.js 가 담당.
    if (page === "assets" || page === "funding") {
      // 사장님 정책: 영어 페이지에서 한국어 누출 금지.
      // 모든 사용자 가시 텍스트는 lang 분기 후 채운다.
      const _lang = (window.RwaI18n?.getLang?.() || window.RwaI18n?.lang?.() || "ko");
      const tx = (ko, en) => (_lang === "en" ? en : ko);

      // 자산 정보 + 가격 정보 호출 (인증 불필요)
      // (v643 Tier 1) 메인 Promise.all 의 _allAssetsCache 재사용 — 중복 호출 제거.
      const allAssets = _allAssetsCache;
      const silicaAsset = allAssets.find((a) => a.id === "SILICA-79907") || {};

      // 자산 이름 — DB 의 한국어 name 이 그대로 표기되지 않도록 lang 분기.
      // 백엔드가 name_en / name_ko 를 분리 노출하면 그걸 우선 사용, 없으면 fallback.
      // (2026-05-08) ja/zh 분기 추가 — EN 외 비-KO locale 에서도 KO fallback 누출 방지.
      const assetDisplayName = (_lang === "en")
        ? (silicaAsset.name_en || silicaAsset.symbol || "High-Purity Silica Mine")
        : (_lang === "ja")
          ? (silicaAsset.name_ja || silicaAsset.name_en || silicaAsset.symbol || "高純度シリカ鉱山")
          : (_lang === "zh")
            ? (silicaAsset.name_zh || silicaAsset.name_en || silicaAsset.symbol || "高纯度硅矿")
            : (silicaAsset.name_ko || silicaAsset.name || "고순도 실리카 광산");
      // 페이지 어딘가에서 silicaAsset.name 을 그대로 쓰는 곳이 있다면 displayName 으로 덮어쓰기
      silicaAsset.displayName = assetDisplayName;
      const _assetNameEl = document.getElementById("silicaAssetName");
      if (_assetNameEl) _assetNameEl.textContent = assetDisplayName;

      // 1) 진행률 카드
      const target = Number(silicaAsset.target_usdt || 0);
      const raised = Number(silicaAsset.raised_usdt || 0);
      const progressPct = target > 0 ? Math.min(100, (raised / target) * 100) : 0;

      setText("targetAmount", `$${fmtN(target, 0)}`);
      setText("raisedAmount", `$${fmtN(raised, 0)}`);
      setText("progressPct", `${progressPct.toFixed(1)}% raised`);
      setText("saleStatus", silicaAsset.status || "Pending");

      const fillEl = document.getElementById("progressFill");
      if (fillEl) fillEl.style.width = `${progressPct}%`;

      // 2) 단계/가격 정보 — Silica 정책: 1 USDT = 1 SilicaSTO 고정 페어.
      //    (2026-05-16 v430) legacy /api/public/silica/sale-phase 호출 제거.
      //    backend 에 endpoint 정의 안 됨 → 콘솔 404 노이즈 + 응답을 어차피
      //    사용하지 않음 (phasePrice=1 하드코딩). 1:1 페어 정책 유지.
      const phasePrice = 1; // 1:1 고정 페어
      // 정책: 양의 정수만 허용. min_usdt 가 비정상값이어도 1 이상 정수로 강제.
      const minInvest = Math.max(1, Math.floor(Number(silicaAsset.min_usdt || 100) || 100));

      setText("phasePrice", `1 USDT`);
      setText("phaseHelp", `1 USDT = 1 SilicaSTO (1:1 peg)`);
      setText("minInvestVal", `${fmtN(minInvest, 0)} USDT`);
      setText("minInvestKrw", `~₩${fmtN(minInvest * krwRate, 0)}`);

      // 3) APR 표시
      // (2026-05-16 v428) /api/public/config 의 silica_apr_pct (interest_rate_history
      //   기준) 우선 사용. assets.apr 컬럼은 정적값이라 admin staking 설정과
      //   일치 안 함. 폴백: silicaAsset.apr → 5.
      const apr = Number(cfg?.silica_apr_pct ?? silicaAsset.apr ?? 5);

      // 4) 사용자 사용 가능 USDT (정수 표시)
      const usdtAvailableInt = Math.max(0, Math.floor(Number(usdt) || 0));
      setText("availableUsdt", `${fmtN(usdtAvailableInt, 0)} USDT`);

      // (2026-05-08) KRW lock-in note removed — 사장님: 원화 표기 불필요.
      //   krwLockNote 요소는 DOM 에 남아 있지만 본문은 비워둔다. updateInvest()
      //   안에서도 같은 ID 를 다시 비워 일관성 유지.
      setText("krwLockNote", "");

      // (제거됨 2026-05-04 v2) Participate 버튼 클릭 시 #fundContractBtn attention-flash —
      // 새 플로우에서는 Invest 버튼 자체가 계약서 모달을 띄우고 서명과 동시에 투자가 실행되므로
      // 별도 "Create Electronic Contract" 버튼을 강조할 필요가 없다.

      // 5) 입력 안전화 — 소수점/음수/숫자 외 문자 제거하여 정수만 허용
      // funding 통합 후 input ID 가 #fundAmount 로 통일됨. 구 #investAmount fallback 유지.
      const investInput = document.getElementById("fundAmount") || document.getElementById("investAmount");
      const sanitizeInputValue = () => {
        if (!investInput) return 0;
        const raw = String(investInput.value || "");
        // 첫 음수 부호 / 소수점 / 비숫자 문자 모두 제거
        const cleaned = raw.replace(/[^0-9]/g, "");
        // leading zero 제거 (예: "007" → "7", 단 "0" 자체는 유지)
        const stripped = cleaned.replace(/^0+(?=\d)/, "");
        if (stripped !== raw) {
          // 커서 위치 보정: 정리 후 길이만큼 끝으로 이동
          investInput.value = stripped;
          try { investInput.setSelectionRange(stripped.length, stripped.length); } catch (_) {}
        }
        const n = parseInt(stripped, 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
      };

      const updateInvest = () => {
        const amt = sanitizeInputValue();
        const krw = amt * krwRate;
        const sto = phasePrice > 0 ? Math.floor(amt / phasePrice) : 0;
        const monthly = amt * (apr / 100) / 12;
        const annual = amt * (apr / 100);

        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

        setVal("receivedSto", sto.toLocaleString("en-US", { maximumFractionDigits: 0 }));
        // (2026-05-06) Investment Amount 필드 — USDT 표기로 환원.
        // KRW 환산은 아래 krwLockNote / calcLegalFootnote 의 참고치로만 노출.
        setVal("krwEquivalent", `${fmtN(amt, 0)}`);
        // Calc Summary — USDT primary, KRW 는 참고용 reference FX 한 줄.
        setText("calcKrw", `${fmtN(amt, 0)} USDT`);
        setText("calcFx", `₩${fmtN(krwRate, 0)}`);
        setText("calcSto", `${sto.toLocaleString("en-US", { maximumFractionDigits: 0 })} STO`);
        setText("calcTotal", `${fmtN(amt, 0)} USDT`);

        // (2026-05-08) KRW 참고치 행 제거 — 사장님: 원화 표기 불필요.
        //   krwLockNote / calcLegalFootnote 두 곳 모두 KRW 환산을 비우고
        //   USDT 단일 정책만 안내하도록 단순화. 요소 자체는 DOM 에 남기되
        //   본문은 비워서 layout 영향 최소화.
        const krwHintEl = document.getElementById("krwLockNote");
        if (krwHintEl) {
          krwHintEl.textContent = "";
        }

        // (2026-05-19 v589) Legal footer + scenarioBase + scenarioMonthlyLabel
        //   문구 제거 (운영자 요청). DOM 요소는 그대로 두고 빈 문자열 채움.
        const footerEl = document.getElementById("calcLegalFootnote");
        if (footerEl) footerEl.innerHTML = "";

        setText("scenarioBase", "");
        setText("scenarioMonthlyLabel", "");
        setText("scenarioMonthly", `+${fmtN(Math.floor(monthly), 0)} USDT`);
        setText("scenarioAnnual", `+${fmtN(Math.floor(annual), 0)} USDT`);
      };
      if (investInput) {
        // 모든 변형 입력 채널(타이핑·붙여넣기·드래그)에서 sanitize
        investInput.addEventListener("input", updateInvest);
        investInput.addEventListener("paste", () => setTimeout(updateInvest, 0));
        investInput.addEventListener("blur", updateInvest);
        // 키보드 입력 단계에서 음수/소수점/지수 문자 차단 (Number input 으로 우회 방지)
        investInput.addEventListener("keydown", (e) => {
          if (["-", "+", ".", "e", "E"].includes(e.key)) {
            e.preventDefault();
          }
        });
        updateInvest();
      }

      // MAX 버튼 — funding 통합 후 #fundMaxBtn 은 funding.js 가 핸들링.
      // assets.html 의 옛 #investMaxBtn 은 더 이상 존재하지 않으므로 dead-code 제거.

      // 6) 투자 버튼 — assets.html (data-page="funding") 위의
      // #fundContractBtn / #fundBtn 은 pages/funding.js 가 직접 핸들링.
      // 별도 redirect 불필요. (구 funding.html 페이지는 v253 제거.)

      // 7) (2026-05-07) Sale supply cap — 관리자가 silica_max_sto_supply 를
      //    설정하고 sold_total >= max 가 되면 신규 투자 신청을 차단한다.
      //    /api/public/config 에서 sale_open / max / sold 를 받아와 banner
      //    토글 + invest 카드 잠금. 백엔드 /api/contracts/draft 도 409 로
      //    한 번 더 막지만, 사용자가 양식을 채우기 전에 시각적으로 차단한다.
      try {
        // (v640) 동일 페이지 사이클 내 config 캐시 재사용 — RwaCore.getConfig() 30s TTL.
        const cfg = (typeof window.RwaCore?.getConfig === "function")
          ? await window.RwaCore.getConfig().catch(() => null)
          : await apiCall("/api/public/config", { auth: false });
        if (cfg) {
          const max = Number(cfg.silica_max_sto_supply || 0);
          const sold = Number(cfg.silica_sold_sto_total || 0);
          const saleOpen = !!cfg.silica_sale_open;
          const banner = document.getElementById("saleSuspendedBanner");
          const investCard = document.getElementById("investCard");
          const fundBtn = document.getElementById("fundBtn");
          const fundAmount = document.getElementById("fundAmount");

          // (2026-05-07) Sale supply progress card — visible whenever a cap
          //   is configured. Always shows current sold / max so users can
          //   see how much room is left before the global cap.
          const supplyCard = document.getElementById("saleSupplyCard");
          if (supplyCard) {
            if (max > 0) {
              const pct = Math.max(0, Math.min(100, (sold / max) * 100));
              supplyCard.style.display = "";
              const labelEl = document.getElementById("saleSupplyLabel");
              const pctEl = document.getElementById("saleSupplyPct");
              const barEl = document.getElementById("saleSupplyBar");
              const soldEl = document.getElementById("saleSupplySold");
              const maxEl = document.getElementById("saleSupplyMax");
              if (labelEl) labelEl.textContent = tx("◆ 전체 판매량", "◆ Total Sale Supply");
              if (pctEl) pctEl.textContent = `${pct.toFixed(2)}%`;
              if (barEl) barEl.style.width = `${pct}%`;
              if (soldEl) soldEl.textContent = tx(`판매됨 ${fmtN(sold, 0)} STO`, `Sold ${fmtN(sold, 0)} STO`);
              if (maxEl) maxEl.textContent = tx(`최대 ${fmtN(max, 0)} STO`, `Max ${fmtN(max, 0)} STO`);

              // (2026-05-16 v423) Admin-configurable notice text rendered
              //   directly above the supply label. Language picked from
              //   tx()'s current-lang resolution: if KO empty, fall back to
              //   EN (and vice-versa) so a single-language admin still works.
              //   textContent + white-space:pre-wrap → XSS-safe + preserves
              //   newlines as entered in the admin textarea.
              const noticeEl = document.getElementById("saleSupplyNotice");
              if (noticeEl) {
                const ko = String(cfg.silica_sale_notice_ko ?? "").trim();
                const en = String(cfg.silica_sale_notice_en ?? "").trim();
                const picked = tx(ko || en, en || ko);
                if (picked) {
                  noticeEl.textContent = picked;
                  noticeEl.style.display = "";
                } else {
                  noticeEl.textContent = "";
                  noticeEl.style.display = "none";
                }
              }
              // Tone shift when nearing or past cap
              if (sold >= max) {
                supplyCard.style.background = "rgba(220, 38, 38, 0.06)";
                supplyCard.style.borderColor = "rgba(220, 38, 38, 0.30)";
                if (pctEl) pctEl.style.color = "#dc2626";
                if (labelEl) labelEl.style.color = "#dc2626";
              } else if (pct >= 90) {
                supplyCard.style.background = "rgba(245, 158, 11, 0.08)";
                supplyCard.style.borderColor = "rgba(245, 158, 11, 0.30)";
                if (pctEl) pctEl.style.color = "#d97706";
                if (labelEl) labelEl.style.color = "#92400e";
              } else {
                supplyCard.style.background = "rgba(139, 92, 246, 0.06)";
                supplyCard.style.borderColor = "rgba(139, 92, 246, 0.25)";
                if (pctEl) pctEl.style.color = "#7c3aed";
                if (labelEl) labelEl.style.color = "#6b21a8";
              }
            } else {
              supplyCard.style.display = "none";
            }
          }

          if (max > 0 && !saleOpen) {
            // 매진 상태 — banner 표시 + 양식 잠금
            if (banner) banner.style.display = "";
            const titleEl = document.getElementById("saleSuspendedTitle");
            const bodyEl = document.getElementById("saleSuspendedBody");
            const statsEl = document.getElementById("saleSuspendedStats");
            if (titleEl) titleEl.textContent = tx("판매 일시 중단", "Sale Temporarily Suspended");
            if (bodyEl) bodyEl.textContent = tx(
              "최대 SilicaSTO 판매 수량에 도달하여 신규 투자 신청이 일시적으로 중단되었습니다. 관리자가 판매 한도를 늘리는 경우 다시 신청할 수 있습니다.",
              "The maximum SilicaSTO sale quantity has been reached. New investment applications are temporarily paused. Please check back later — the cap may be raised by the administrator."
            );
            if (statsEl) {
              statsEl.textContent = `${fmtN(sold, 0)} / ${fmtN(max, 0)} STO sold`;
            }
            if (investCard) investCard.style.opacity = "0.55";
            if (investCard) investCard.style.pointerEvents = "none";
            if (fundBtn) {
              fundBtn.disabled = true;
              fundBtn.textContent = tx("판매 중단", "Sale Suspended");
              fundBtn.dataset.saleSuspended = "1";
            }
            if (fundAmount) fundAmount.readOnly = true;
          } else {
            // 판매 가능 — banner 숨김
            if (banner) banner.style.display = "none";
            if (investCard) {
              investCard.style.opacity = "";
              investCard.style.pointerEvents = "";
            }
            if (fundBtn && fundBtn.dataset.saleSuspended === "1") {
              // 한 번 잠갔던 버튼만 복원 (funding.js 의 자체 disabled 로직과 충돌 방지)
              fundBtn.disabled = false;
              fundBtn.textContent = tx("참여 (투자)", "Participate (Invest)");
              delete fundBtn.dataset.saleSuspended;
            }
            if (fundAmount) fundAmount.readOnly = false;
          }
        }
      } catch (e) {
        // public/config 실패 시 banner 숨김 유지 — UX 보수적으로 처리.
        console.warn("[silica-data-bind] sale-supply config load failed", e?.message || e);
      }
    }

    // ─── 거래 이력 ───
    if (page === "history") {
      // (2026-05-11 v281) Operator: 'history.html 에서 트레이드만 표기되고
      //   나머지 탭이 비어 있다.' Each trade fill emits up to 6 rows
      //   (token + USDT + fee × buy/sell), so a few dozen recent trades
      //   easily fill any reasonable window and starve the other tabs.
      //   Fix: bump the default fetch to limit=200 AND refetch on tab
      //   click with the backend's new ?kind= filter so each tab gets
      //   its own deep slice instead of slicing one shared 50-row pool.
      // (2026-05-21 v718) 운영자 보고: admin 에는 보이는 옛 pending 출금이
      //   user history 에 안 보임. LIMIT 200 으로 컷오프된 케이스. 500 으로
      //   상향하여 어제 ~ 한 달 전 데이터까지 포괄.
      const tx = await apiCall("/api/wallet/transactions?limit=500");
      // (2026-05-11 v233) Diagnostic console logs from the v220-v232
      //   legacy-row migration debugging session were removed once the
      //   read-time virtualization (v232-tsfallback) was confirmed
      //   working. The PHP /api/wallet/transactions response still
      //   carries a minimal _meta block (code_version,
      //   virtualize_debug counts) for any future need.
      const apiOk = tx !== null;
      // 응답 키 폴백 — 백엔드가 jsonOk(['transactions' => $rows]) 로 'transactions'
      // 키에 담아 보내는데, 이전 코드는 'rows' 만 검사해서 항상 빈 배열로 처리됐다.
      // 새 'rows' 키로 바뀔 가능성에도 대비해 두 키 모두 허용 + 배열 자체도 허용.
      const rawAllRows = Array.isArray(tx?.transactions) ? tx.transactions
                    : Array.isArray(tx?.rows)         ? tx.rows
                    : Array.isArray(tx)                ? tx
                    : [];

      // (2026-05-21 v705) 운영자 요청: '같은 반려가 Withdraw Refund + Failed
      //   두 행으로 나타나 혼란스럽다 — USDT 반려 처리와 동일한 형태로
      //   통일.' USDT 반려 = 1 FAILED + 1 Refund (2 행).
      //   토큰 반려는 추가로 'USDT 수수료 환불' 행이 생겨 3 행이 되는데,
      //   이 수수료 환불 행을 frontend 에서 숨김 → 토큰 반려도 2 행
      //   (FAILED 토큰 + Refund 토큰) 으로 USDT 와 동일 패턴.
      //   백엔드 audit trail (wallet_transactions) 은 그대로 유지.
      //   숨김 조건: kind='withdraw_refund' AND memo 가
      //   'refund_token_withdraw_fee:' 로 시작 (토큰 출금 수수료 환불 행).
      const hiddenForDiag = [];
      const dedupedFailedDiag = [];
      const dedupedRefundDiag = [];
      // (2026-05-21 v712) FAILED + 출금환불 중복 dedup — 같은 minute + asset + amount
      //   의 wallet_tx 중복 행이 발견됨 (사용자 multi-click 또는 백엔드 중복
      //   INSERT). 1 개만 표시하여 USDT 패턴과 동일 1:1 페어링 유지.
      const seenFailedKeys = new Set();
      const seenRefundKeys = new Set();
      const allRows = rawAllRows.filter((r) => {
        const kind = String(r?.kind || "");
        const status = String(r?.status || "");

        // FAILED 토큰/USDT 출금 dedup
        if (kind === "withdraw" && status === "실패") {
          const minute = String(r?.created_at || "").slice(0, 16);  // YYYY-MM-DD HH:MM
          const key = (r.asset || "") + "|" + Number(r.amount || 0).toFixed(6) + "|" + minute;
          if (seenFailedKeys.has(key)) {
            dedupedFailedDiag.push({ id: r.id, asset: r.asset, amount: r.amount, minute });
            return false;
          }
          seenFailedKeys.add(key);
        }

        if (kind !== "withdraw_refund") return true;
        const memo = String(r?.memo || "");
        // USDT 수수료 환불 행은 숨김 (토큰 cancel 의 부산물)
        if (memo.indexOf("refund_token_withdraw_fee:") === 0
            || memo.indexOf("|refund_token_withdraw_fee:") !== -1) {
          hiddenForDiag.push({ id: r.id, asset: r.asset, amount: r.amount, memo: memo.slice(0, 80) });
          return false;
        }
        // withdraw_refund 중복도 dedup — FAILED 와 동일 키 (asset+amount+minute)
        const minute = String(r?.created_at || "").slice(0, 16);
        const refKey = (r.asset || "") + "|" + Number(r.amount || 0).toFixed(6) + "|" + minute;
        if (seenRefundKeys.has(refKey)) {
          dedupedRefundDiag.push({ id: r.id, asset: r.asset, amount: r.amount, minute });
          return false;
        }
        seenRefundKeys.add(refKey);
        return true;
      });
      // (2026-05-21 v706/v712) 진단 로그 — 어떤 행이 필터/dedup 으로 숨겨졌는지.
      //   운영자: F12 콘솔에서 USDT 수수료 환불 / FAILED 중복 행이 적절히
      //   처리되는지 확인.
      try {
        const refundRows = rawAllRows.filter(r => String(r?.kind || "") === "withdraw_refund");
        const failedWithdraws = rawAllRows.filter(r =>
          String(r?.kind || "") === "withdraw" && String(r?.status || "") === "실패");
        console.log("%c[v712 history filter] 전체:" + rawAllRows.length
          + " | withdraw_refund: " + refundRows.length
          + " | failed withdraws: " + failedWithdraws.length
          + " | hidden(USDT fee refund): " + hiddenForDiag.length
          + " | deduped(중복 FAILED): " + dedupedFailedDiag.length
          + " | visible: " + allRows.length,
          "color:#00897B;font-weight:bold");
        if (hiddenForDiag.length) {
          console.log("  숨긴 fee refund 상세:", hiddenForDiag);
        }
        if (dedupedFailedDiag.length) {
          console.log("  dedup 된 중복 FAILED 상세:", dedupedFailedDiag);
        }
        if (dedupedRefundDiag.length) {
          console.log("  dedup 된 중복 환불 상세:", dedupedRefundDiag);
        }
      } catch (_) {}
      const tbody = document.getElementById("historyBody");
      const tabsBox = document.getElementById("historyTabs");
      const histLang = getCurrentLang();

      // (2026-05-06) 탭 필터 — wallet_transactions.kind 매칭표.
      // (2026-05-07) staking 필터 = 정확 일치 → 정규식 (`stake`, `unstake`,
      // `stake_failed`, `stake_rejected` 등 변형 모두 매칭).
      // (2026-05-07) Investments 탭 신규 — invest / invest_credit 분리.
      //   사용자 입장에서 "투자 신청 / 투자 확정" 은 별도 카테고리로 보는 게
      //   직관적이라 deposit_withdraw 에서 제외하고 별도 탭에 배치.
      // (2026-05-12 v310) 운영자: '추천인 승인을 받은 유저는 히스토리에서
      //   러퍼럴 수익 항목이 나타나야한다. 일반 유저는 보여서는 안된다.'
      //   referral_bonus 를 interest 필터에서 분리, 별도 전용 탭. 비-referrer
      //   는 referral_bonus 행 전체 클라이언트 측 차단 (아래 sanitizeForReferrer).
      const TAB_FILTERS = {
        all:              () => true,
        deposit_withdraw: (k) => /^(deposit|withdraw)/i.test(k),
        investments:      (k) => /^invest/i.test(k),
        staking:          (k) => /stake|unstake/i.test(k),
        interest:         (k) => /^interest/i.test(k),
        referral_bonus:   (k) => /^referral_bonus/i.test(k),
        dividend:         (k) => /dividend/i.test(k),
        swap:             (k) => /swap/i.test(k),
        trade:            (k) => /^(trade|order)/i.test(k),
      };

      // (2026-05-12 v310) Referrer 게이팅
      // 1) /api/referral/my-status 로 is_referrer && referrer_active 확인
      // 2) 승인 referrer → #histTabReferral 노출 (탭 클릭 가능)
      // 3) 미승인 / 미신청 → 탭 숨김 + 모든 보기에서 referral_bonus 행 차단
      //    (백엔드는 본인 주소 행만 반환하지만, 과거 referrer 상태에서
      //     발생한 행이 DB 에 남을 수 있어 안전망)
      let _isApprovedReferrer = false;
      try {
        const refSt = await apiCall("/api/referral/my-status");
        _isApprovedReferrer = !!(refSt?.is_referrer && refSt?.referrer_active);
      } catch (_) {
        _isApprovedReferrer = false;
      }
      const histTabReferralEl = document.getElementById("histTabReferral");
      if (histTabReferralEl) {
        histTabReferralEl.hidden = !_isApprovedReferrer;
      }
      const isReferralRow = (row) => {
        const k = (row?.kind && String(row.kind).trim()) ? String(row.kind) : inferKind(row);
        return /^referral_bonus/i.test(k);
      };
      const sanitizeForReferrer = (rows) => {
        if (_isApprovedReferrer) return rows;
        return (rows || []).filter((r) => !isReferralRow(r));
      };

      // (2026-05-08) Solscan link helper. /api/public/config reports the active
      //   network ('mainnet' / 'devnet' / 'testnet'); append ?cluster= for any
      //   non-mainnet so the user lands on the correct explorer view. Earlier
      //   the Tx Hash anchor used href="#" which made clicks no-ops.
      // (2026-05-11 v233) The v207 distinct-kinds / console.table dump
      //   was helpful while debugging but is now noise — removed.
      const _solanaNetwork = String(cfg?.solana_network || "mainnet").trim().toLowerCase();
      const _solscanCluster = (_solanaNetwork && _solanaNetwork !== "mainnet" && _solanaNetwork !== "mainnet-beta")
        ? `?cluster=${encodeURIComponent(_solanaNetwork)}` : "";
      const buildExplorerTxUrl = (txid) => `https://solscan.io/tx/${encodeURIComponent(String(txid || ""))}${_solscanCluster}`;

      // kind 표시 라벨 (lang-aware)
      // (2026-05-08) JA/ZH 추가 — 비-KO/EN locale 에서도 한국어 누출 방지.
      // (2026-05-16 v407) 운영자: 'force_unstake 한국어 (종료)언스테이킹
      //   으로 표기.' wind-down 4단계 [스테이킹 중단] 실행 시 백엔드가
      //   wallet_transactions 에 kind='force_unstake' 로 기록 — 사용자
      //   히스토리에서 일반 unstake 와 구분되도록 한국어/영어 라벨 추가.
      const KIND_LABELS_KO = {
        deposit: "입금", withdraw: "출금", withdraw_completed: "출금 완료",
        withdraw_failed: "출금 실패", withdraw_refund: "출금 환불",
        invest: "투자 신청", invest_credit: "투자 확정 (STO 분배)",
        invest_refund: "투자 반려 환불",
        stake: "스테이킹", unstake: "언스테이킹",
        force_unstake: "(종료)언스테이킹",
        interest_claim: "이자 클레임", referral_bonus: "추천 보상",
        dividend_claim: "배당 클레임",
        // (2026-05-07) Silica → SilicaSTO swap — 한 회 swap 이 세 행으로 기록됨
        // (Silica 차감 + SilicaSTO 입금 + USDT 수수료).
        swap_out: "스왑 (Silica 차감)", swap_in: "스왑 (SilicaSTO 입금)",
        swap_fee: "스왑 수수료",
        swap: "스왑",
        // (2026-05-10 v220) Trade fills now emit 3 rows per side: token
        //   leg + USDT gross leg + fee. Older v214-v219 rows were
        //   single-USDT-with-fee-bundled; the v220 backfill rewrites
        //   them so all 'trade_buy' / 'trade_sell' rows now mean the
        //   token side and asset is SilicaSTO.
        trade_buy: "매수 체결 (토큰 입금)", trade_buy_pay: "매수 결제 (USDT)", trade_buy_fee: "매수 수수료",
        trade_sell: "매도 체결 (토큰 출금)", trade_sell_recv: "매도 수령 (USDT)", trade_sell_fee: "매도 수수료",
        // (2026-05-18 v511) 미체결 주문 placement / cancel 시 escrow lock/refund 기록.
        order_buy_placed: "매수 주문 등록 (USDT 잠금)",
        order_buy_canceled: "매수 주문 취소 (USDT 반환)",
        order_sell_canceled: "매도 주문 취소 (토큰 반환)",
      };
      const KIND_LABELS_EN = {
        deposit: "Deposit", withdraw: "Withdraw", withdraw_completed: "Withdraw Completed",
        withdraw_failed: "Withdraw Failed", withdraw_refund: "Withdraw Refund",
        invest: "Investment Requested", invest_credit: "Investment Confirmed (STO)",
        invest_refund: "Investment Rejected (Refund)",
        stake: "Staking", unstake: "Unstaking",
        force_unstake: "(Closure) Unstake",
        interest_claim: "Interest Claim", referral_bonus: "Referral Bonus",
        dividend_claim: "Dividend Claim",
        swap_out: "Swap (Silica out)", swap_in: "Swap (SilicaSTO in)",
        swap_fee: "Swap Fee",
        swap: "Swap",
        trade_buy: "Trade Buy (Token in)", trade_buy_pay: "Buy Payment (USDT)", trade_buy_fee: "Buy Fee",
        trade_sell: "Trade Sell (Token out)", trade_sell_recv: "Sell Proceeds (USDT)", trade_sell_fee: "Sell Fee",
        order_buy_placed: "Buy Order Placed (USDT Locked)",
        order_buy_canceled: "Buy Order Canceled (USDT Refunded)",
        order_sell_canceled: "Sell Order Canceled (Token Returned)",
      };
      const KIND_LABELS_JA = {
        deposit: "入金", withdraw: "出金", withdraw_completed: "出金完了",
        withdraw_failed: "出金失敗", withdraw_refund: "出金返金",
        invest: "投資申請", invest_credit: "投資確定 (STO 配布)",
        invest_refund: "投資却下 返金",
        stake: "ステーキング", unstake: "アンステーキング",
        force_unstake: "(終了)アンステーキング",
        interest_claim: "利息クレーム", referral_bonus: "紹介報酬",
        dividend_claim: "配当クレーム",
        swap_out: "スワップ (Silica 控除)", swap_in: "スワップ (SilicaSTO 入金)",
        swap_fee: "スワップ手数料",
        swap: "スワップ",
        trade_buy: "買い (トークン入金)", trade_buy_pay: "買い 決済 (USDT)", trade_buy_fee: "買い 手数料",
        trade_sell: "売り (トークン出金)", trade_sell_recv: "売り 受取 (USDT)", trade_sell_fee: "売り 手数料",
      };
      const KIND_LABELS_ZH = {
        deposit: "充值", withdraw: "提现", withdraw_completed: "提现完成",
        withdraw_failed: "提现失败", withdraw_refund: "提现退款",
        invest: "投资申请", invest_credit: "投资确认 (STO 分配)",
        invest_refund: "投资驳回退款",
        stake: "质押", unstake: "解除质押",
        force_unstake: "(关停)解除质押",
        interest_claim: "利息领取", referral_bonus: "推荐奖励",
        dividend_claim: "分红领取",
        swap_out: "兑换 (Silica 扣除)", swap_in: "兑换 (SilicaSTO 入账)",
        swap_fee: "兑换手续费",
        swap: "兑换",
        trade_buy: "买入 (代币入账)", trade_buy_pay: "买入 支付 (USDT)", trade_buy_fee: "买入 手续费",
        trade_sell: "卖出 (代币出账)", trade_sell_recv: "卖出 收款 (USDT)", trade_sell_fee: "卖出 手续费",
      };
      const STATUS_LABELS_KO = {
        "대기": "대기", "완료": "완료", "실패": "실패", "환불": "환불", "반려": "반려",
        // (2026-05-08) Withdraw-specific statuses — backend uses these for
        //   pending withdraw rows. Without entries here history.html showed
        //   the raw Korean ("출금신청") even on the EN locale.
        // (2026-05-20 v676) 출금반환 status 추가 — 관리자 거절/취소 시 환불.
        "출금신청": "출금신청", "출금완료": "출금완료", "출금실패": "출금실패",
        "출금취소": "출금취소", "출금반환": "출금반환",
        "입금완료": "입금완료", "입금대기": "입금대기",
        "pending": "대기", "completed": "완료", "failed": "실패", "rejected": "반려",
      };
      const STATUS_LABELS_EN = {
        "대기": "Pending", "완료": "Completed", "실패": "Failed", "환불": "Refunded", "반려": "Rejected",
        "출금신청": "Withdraw Requested", "출금완료": "Withdraw Completed", "출금실패": "Withdraw Failed",
        "출금취소": "Withdraw Canceled", "출금반환": "Withdraw Refunded",
        "입금완료": "Deposited", "입금대기": "Deposit Pending",
        "pending": "Pending", "completed": "Completed", "failed": "Failed", "rejected": "Rejected",
      };
      const STATUS_LABELS_JA = {
        "대기": "保留中", "완료": "完了", "실패": "失敗", "환불": "返金", "반려": "却下",
        "출금신청": "出金申請", "출금완료": "出金完了", "출금실패": "出金失敗",
        "출금취소": "出金取消", "출금반환": "出金返金",
        "입금완료": "入金完了", "입금대기": "入金待ち",
        "pending": "保留中", "completed": "完了", "failed": "失敗", "rejected": "却下",
      };
      const STATUS_LABELS_ZH = {
        "대기": "等待中", "완료": "已完成", "실패": "失败", "환불": "已退款", "반려": "已驳回",
        "출금신청": "提现申请", "출금완료": "提现完成", "출금실패": "提现失败",
        "출금취소": "提现取消", "출금반환": "提现退款",
        "입금완료": "已充值", "입금대기": "充值等待",
        "pending": "等待中", "completed": "已完成", "failed": "失败", "rejected": "已驳回",
      };

      // (2026-05-07) 빈 kind 추론 — RECON 시대 wallet_transactions.kind ENUM 때문에
      // 일부 행이 kind='' 로 저장된 케이스. status / asset / memo 패턴으로 추정.
      // db.php 의 자동 마이그레이션이 적용되면 더이상 빈 kind 가 안 들어가지만
      // 이미 DB 에 있는 legacy 행을 위한 client-side 폴백.
      const inferKind = (r) => {
        const k = String(r?.kind || "").trim();
        if (k) return k;
        const status = String(r?.status || "").trim();
        const asset  = String(r?.asset || "").trim();
        const memo   = String(r?.memo || "");
        if (/투자/.test(memo)) return "invest";
        if (/STO.*분배|STO 분배/.test(memo)) return "invest_credit";
        if (/스테이킹|stake/i.test(memo)) return "stake";
        if (/언스테이킹|unstake/i.test(memo)) return "unstake";
        if (status === "대기" && asset === "USDT") return "invest";
        return ""; // 추정 실패 — labelKind 가 "-" 처리
      };
      // (2026-05-08) Lang-aware label dispatch — pick the dictionary that
      //   matches the active locale. EN/KO 만 분기하던 기존 로직은 JA/ZH 사용자에게
      //   한국어를 그대로 보여주는 누출이 있었음.
      const KIND_DICT =
        histLang === "en" ? KIND_LABELS_EN :
        histLang === "ja" ? KIND_LABELS_JA :
        histLang === "zh" ? KIND_LABELS_ZH :
        KIND_LABELS_KO;
      const STATUS_DICT =
        histLang === "en" ? STATUS_LABELS_EN :
        histLang === "ja" ? STATUS_LABELS_JA :
        histLang === "zh" ? STATUS_LABELS_ZH :
        STATUS_LABELS_KO;
      const FALLBACK_COMPLETED =
        histLang === "en" ? "Completed" :
        histLang === "ja" ? "完了" :
        histLang === "zh" ? "已完成" :
        "완료";

      const labelKind   = (k, row) => {
        const eff = (k && String(k).trim()) ? k : inferKind(row);
        return KIND_DICT[eff] || eff || "-";
      };
      const labelStatus = (s) => STATUS_DICT[s] || s || FALLBACK_COMPLETED;
      const pagingText  = (n) =>
        histLang === "en" ? `Total: ${n}` :
        histLang === "ja" ? `合計 ${n}件` :
        histLang === "zh" ? `合计 ${n} 项` :
        `전체 ${n}건`;
      // (2026-05-08) Withdraw breakdown labels — Fee / Net / Requested.
      //   사장님: 출금 행은 amount=720, fee=1, net=719 처럼 분리 표기해야
      //   유저 혼란이 없다.
      const FEE_LABEL =
        histLang === "en" ? "Fee" :
        histLang === "ja" ? "手数料" :
        histLang === "zh" ? "手续费" :
        "수수료";
      const NET_LABEL =
        histLang === "en" ? "Net" :
        histLang === "ja" ? "実受取" :
        histLang === "zh" ? "实收" :
        "실수령";
      const REQ_LABEL =
        histLang === "en" ? "Requested" :
        histLang === "ja" ? "申請" :
        histLang === "zh" ? "申请" :
        "신청";

      // (2026-05-08) Parse withdrawal fee/net breakdown.
      //   Source priority: memo string > joined DB columns.
      //   Reason: deposit_withdraw.php's INSERT into withdraw_requests does
      //   NOT populate the fee_amount/net_amount columns (only the memo).
      //   The DB migration then backfills net_amount=amount, fee_amount=0,
      //   so the joined cols read 0/amount and look like "no fee" even when
      //   a fee actually applied. Memo is the canonical source — it carries
      //   "fee_amount:1|net:719" exactly as the quote was computed.
      //
      //   USDT memo:  to:<addr>|fee_mode:fixed|fee_value:1|fee_amount:1|net:719
      //   Token memo: fee_mode:fixed|fee_value:1|fee_amount:1|fee_asset:USDT|net:100
      const parseWithdrawBreakdown = (r) => {
        const memo = String(r?.memo || "");
        if (memo) {
          const feeMatch = memo.match(/fee_amount:([\d.]+)/);
          const netMatch = memo.match(/(?:^|\|)net:([\d.]+)/);
          const feeAssetMatch = memo.match(/fee_asset:([A-Za-z0-9_-]+)/i);
          const modeMatch = memo.match(/fee_mode:([A-Za-z0-9_-]+)/i);
          const fee = feeMatch ? Number(feeMatch[1]) : NaN;
          const net = netMatch ? Number(netMatch[1]) : NaN;
          if (Number.isFinite(fee) && Number.isFinite(net)) {
            return {
              fee,
              net,
              feeAsset: feeAssetMatch ? feeAssetMatch[1].toUpperCase() : "USDT",
              mode: modeMatch ? modeMatch[1] : "",
            };
          }
        }
        // Fallback: joined withdraw_requests columns (only useful if backend
        // INSERT was updated to populate them — older rows have 0/amount).
        const dFee = Number(r?.withdraw_fee_amount);
        const dNet = Number(r?.withdraw_net_amount);
        if (Number.isFinite(dFee) && Number.isFinite(dNet) && dFee > 0) {
          return {
            fee: dFee,
            net: dNet,
            feeAsset: "USDT",
            mode: String(r?.withdraw_fee_mode || ""),
          };
        }
        return null;
      };

      const emptyText   =
        histLang === "en" ? "No transactions in this category." :
        histLang === "ja" ? "このカテゴリには取引履歴がありません。" :
        histLang === "zh" ? "此类别暂无交易记录。" :
        "해당 카테고리에 거래 내역이 없습니다.";
      // (2026-05-07) 인증 실패 메시지 — apiCall 이 401/네트워크 에러로 null 반환한 경우.
      const authFailText =
        histLang === "en" ? "Connect your wallet to view transaction history." :
        histLang === "ja" ? "ウォレットを接続すると取引履歴を表示できます。" :
        histLang === "zh" ? "连接钱包后可查看交易记录。" :
        "거래 내역을 보려면 지갑을 연결하세요.";

      const renderRows = (rows) => {
        if (!tbody) return;
        if (!rows.length) {
          // 빈 상태 메시지 — 인증 실패와 진짜 0건을 구분.
          const msg = apiOk ? emptyText : authFailText;
          tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:48px 0;font-size:13px">${msg}</td></tr>`;
          setText("historyPaging", pagingText(0));
          return;
        }
        // (2026-05-07) kind 기반 자산 추정 — DB 의 asset 컬럼이 빈 문자열인 legacy 행도
        // 아이콘/라벨이 정확히 표시되도록.
        //   invest, deposit, withdraw           → USDT
        //   invest_credit, stake, unstake,
        //   swap_in, interest_claim, referral,
        //   dividend (USDT 지급)                → SilicaSTO 또는 USDT — kind 별 매핑.
        //   swap_out                            → Silica
        const inferAsset = (r, kind) => {
          const raw = String(r?.asset || "").trim();
          if (raw) return raw;  // DB 값이 있으면 우선
          const k = String(kind || "").trim();
          if (/^(deposit|withdraw|invest|invest_refund|swap_fee)$/.test(k)) return "USDT";
          if (/^(invest_credit|stake|unstake|swap_in)$/.test(k)) return "SilicaSTO";
          if (/^swap_out$/.test(k)) return "Silica";
          if (/interest|referral_bonus/.test(k)) return "USDT";
          if (/dividend/.test(k)) return "Silica"; // 연 배당은 Silica 토큰 지급
          // (2026-05-10 v220) Trade fills — token rows = SilicaSTO,
          //   USDT-payment / USDT-proceeds / fee rows = USDT.
          if (/^(trade_buy|trade_sell)$/.test(k)) return "SilicaSTO";
          if (/^trade_(buy|sell)_(pay|recv|fee)$/.test(k)) return "USDT";
          return "";
        };

        // (2026-05-07) 거절 사유 + 관리자 연락처 파싱 헬퍼.
        //   admin_deposit.php reject 엔드포인트가 admin_note 컬럼에
        //   "Reason: <X>\nContact: <Y>" 형태로 저장한다. 컬럼이 없는 fallback
        //   배포 환경에서는 memo 안에 같은 형식이 들어 있을 수 있으므로 두 곳 모두 살펴본다.
        const escHtml = (s) => String(s ?? "")
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const parseRejectInfo = (r) => {
          // (v704) URL-decode helper — token_withdraw_requests.memo 의
          //   reject_reason 값은 백엔드가 rawurlencode 로 인코딩하여 저장.
          //   SUBSTRING_INDEX 로 추출된 결과도 인코딩된 상태이므로 복원 필요.
          const safeDecode = (s) => {
            if (!s) return "";
            try { return decodeURIComponent(s); }
            catch (_) { return s; }
          };
          // (2026-05-21 v700) 1순위: withdraw_reject_reason 컬럼 (백엔드 JOIN
          //   으로 노출 — USDT withdraw_requests.reject_reason 또는 토큰
          //   token_withdraw_requests.reject_reason). 가장 신뢰성 높음.
          const directReasonRaw = String(r?.withdraw_reject_reason || "").trim();
          if (directReasonRaw) {
            // (v704) URL-encoded 가능성 → decode (실패 시 원본 유지)
            return { reason: safeDecode(directReasonRaw), contact: "" };
          }
          // 2순위: admin_note / memo 의 'Reason:' 또는 'reject_reason:' 패턴 파싱
          const note = String(r?.admin_note || "");
          const memo = String(r?.memo || "");

          // (2026-05-21 v702) 운영자: 'v700 배포 후에도 Reason 버튼이 나오지
          //   않는다.' admin_note 가 'reject_reason:<text>' 1줄 형식이면
          //   'Reason:\s*([^\n]+)' 정규식이 'reject_reason' 안의 'reason'
          //   부터 매칭하여 ':' 이후를 캡처 — 정상 동작이어야 하지만 일부
          //   환경에서 누락 발견. 강화: 두 source 를 분리 처리 + 더 명시적인
          //   'reject_reason:' prefix 패턴 우선 매칭.
          // (2026-05-21 v704) token_withdraw_requests.memo 는 cancel endpoint
          //   가 rawurlencode 로 인코딩 — '관리자 사유' → '%EA%B4%80...'.
          //   safeDecode (위에 정의) 로 복원 시도 후 실패하면 raw 그대로 사용.
          const tryExtract = (src) => {
            if (!src) return "";
            // 'reject_reason:<text>' 패턴 직접 매칭 — admin_note / memo 양쪽에
            // 이 형식으로 저장. '|' 다음 또는 라인 시작.
            const rrm = src.match(/(?:^|\|)reject_reason:([^|\n]+)/i);
            if (rrm) return safeDecode(rrm[1].trim());
            // (v704) backward compat — v703 까지의 cancel endpoint 는
            //   'cancel_reason:<text>' 키로 token_withdraw_requests.memo 에 저장.
            //   기존 reject 행 (이미 DB 에 있는) 의 사유 노출을 위해 같이 매칭.
            const crm = src.match(/(?:^|\|)cancel_reason:([^|\n]+)/i);
            if (crm) return safeDecode(crm[1].trim());
            // legacy 'Reason: <text>' 패턴 (deposit reject 사용)
            const rm = src.match(/Reason:\s*([^\n]+)/i);
            if (rm) return rm[1].trim();
            // 더 legacy '|reject:<요약>' fallback
            const lm = src.match(/\|reject:([^|]+)/);
            if (lm) return lm[1].trim();
            return "";
          };

          let reason = tryExtract(note) || tryExtract(memo);
          const contactMatch = (note || memo).match(/Contact:\s*([^\n]+)/i);
          const contact = contactMatch ? contactMatch[1].trim() : "";

          if (!reason && !contact) {
            // (v702) 진단 로그 — FAILED 인데 reason 못 찾은 경우 콘솔에 행 dump.
            //   운영자 F12 → Console 에서 어떤 필드가 비어있는지 확인 가능.
            if (r && (r.status === "실패" || r.status === "반려")) {
              try {
                console.warn("%c[parseRejectInfo v702] reason not found for FAILED row",
                  "color:#dc2626;font-weight:bold", {
                    id: r.id, kind: r.kind, asset: r.asset, amount: r.amount,
                    withdraw_reject_reason: r.withdraw_reject_reason,
                    admin_note: r.admin_note,
                    memo: r.memo ? String(r.memo).slice(0, 200) : null,
                  });
              } catch (_) {}
            }
            return null;
          }
          return { reason, contact };
        };

        // (2026-05-07) History 페이지의 Reason 모달 — read-only audit view.
        //   "Don't show again" 체크박스는 deposit 페이지의 모달에만 존재한다 (사장님
        //   요청). history 는 영구 거래 기록이므로 사용자가 자발적으로 Reason 버튼을
        //   누른 경우에만 디테일을 보여주고, dismiss 메커니즘은 두지 않는다.
        // (2026-05-21 v713) 다국어 i18n — 'Deposit Rejected' / 'Below is...' /
        //   'Contact admin' 등 영문이 한국어 페이지에서 그대로 표출되던 문제.
        //   현재 언어에 맞는 라벨로 동적 교체. 또한 deposit 전용 제목 →
        //   범용 '반려 사유' 로 변경 (출금 반려에도 같은 모달 재사용).
        const ensureRejectModal = () => {
          if (document.getElementById("rejectDetailModal")) return;
          const wrap = document.createElement("div");
          wrap.id = "rejectDetailModal";
          wrap.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;font-family:'Space Grotesk',sans-serif";
          const lang = getCurrentLang();
          const i18n = (map) => map[lang] || map.en || map.ko || "";
          const labels = {
            title: i18n({
              ko: "반려 사유", en: "Rejected", ja: "却下", zh: "已拒绝",
            }),
            description: i18n({
              ko: "아래는 관리자가 제공한 반려 사유와 후속 문의용 연락처입니다.",
              en: "Below is the rejection reason and the administrator contact provided for follow-up.",
              ja: "以下は管理者から提供された却下理由とフォローアップ用の連絡先です。",
              zh: "以下是管理员提供的驳回理由和后续联系方式。",
            }),
            reasonLabel: i18n({ ko: "사유", en: "Reason", ja: "理由", zh: "理由" }),
            contactLabel: i18n({ ko: "관리자 연락처", en: "Contact admin", ja: "管理者連絡先", zh: "管理员联系方式" }),
            closeBtn: i18n({ ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭" }),
          };
          wrap.innerHTML = `
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;max-width:480px;width:100%;padding:24px;color:#111;box-shadow:0 24px 48px rgba(0,0,0,0.18)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <div style="font-size:18px;font-weight:700;color:#dc2626">${labels.title}</div>
                <button type="button" id="rejModalX" aria-label="Close"
                  style="background:transparent;border:none;color:#6b7280;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px">×</button>
              </div>
              <div style="font-size:13px;color:#6b7280;margin-bottom:16px;line-height:1.5">
                ${labels.description}
              </div>
              <div style="margin-bottom:12px">
                <div style="font-size:11px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${labels.reasonLabel}</div>
                <div id="rejModalReason" style="font-size:14px;color:#111;line-height:1.5;word-break:break-word"></div>
              </div>
              <div style="margin-bottom:18px">
                <div style="font-size:11px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${labels.contactLabel}</div>
                <div id="rejModalContact" class="text-mono" style="font-size:14px;color:#111;word-break:break-all"></div>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:8px">
                <button type="button" id="rejModalClose" class="btn small primary"
                  style="background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer">${labels.closeBtn}</button>
              </div>
            </div>
          `;
          document.body.appendChild(wrap);
          const close = () => { wrap.style.display = "none"; };
          wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
          wrap.querySelector("#rejModalClose").addEventListener("click", close);
          wrap.querySelector("#rejModalX").addEventListener("click", close);
        };
        const openRejectModal = (txId, reason, contact) => {
          // (v713) 매번 호출 시 기존 모달 제거 후 재생성 — 사용자가 언어를
          //   변경했어도 현재 언어로 라벨이 그려지게 함.
          const existing = document.getElementById("rejectDetailModal");
          if (existing) existing.remove();
          ensureRejectModal();
          const wrap = document.getElementById("rejectDetailModal");
          wrap.dataset.txId = String(txId || "");
          wrap.querySelector("#rejModalReason").textContent = reason || "—";
          wrap.querySelector("#rejModalContact").textContent = contact || "—";
          wrap.style.display = "flex";
        };

        tbody.innerHTML = rows.slice(0, 200).map((r) => {
          const amt = Number(r.amount || 0);
          // (2026-05-07) raw kind 가 빈 문자열이면 inferKind 로 추정한 값을 부호/라벨에 사용.
          const k = (r.kind && String(r.kind).trim()) ? String(r.kind) : inferKind(r);
          // 부호: 잔량이 늘어나는 방향 = +, 줄어드는 방향 = −.
          // swap_in (SilicaSTO 입금)은 +, swap_out (Silica 차감)은 −.
          // invest_refund (반려 환불) 도 USDT 가 다시 들어오므로 +.
          // (2026-05-10 v220) Trade kinds were redesigned to emit 3 rows
          //   per side. Sign now needs exact-match for trade kinds because
          //   substring matching would falsely flag trade_sell_fee as +.
          // (2026-05-18 v513) order_buy_canceled / order_sell_canceled 도 환불
          //   (+) 케이스에 추가. 이전엔 누락되어 cancel 이 -로 표시되던 버그.
          // (2026-05-20 v677) withdraw_refund 추가 — 관리자 거절/취소로 인한
          //   USDT 환불도 잔고 증가 (+) 케이스. 운영자 보고: '출금반환은
          //   - 가 아니라 + 이다.' 버그 수정.
          const positiveSubstring = /deposit|invest_credit|invest_refund|unstake|interest|referral|dividend|swap_in|order_buy_canceled|order_sell_canceled|withdraw_refund/.test(k);
          const positiveTradeExact = /^(trade_buy|trade_sell_recv)$/.test(k);
          const positive = positiveSubstring || positiveTradeExact;
          const sign = positive ? "+" : "-";
          // (2026-05-07) DB asset 빈값이어도 kind 로 정확한 토큰 추정.
          const eAsset = inferAsset(r, k);
          // (v636) 운영자 점검: 'history TOKEN 아이콘이 admin 업로드 로고로
          // 나오는지.' 글리프 ($, S, ◆) → <img data-token-logo>. silica-data-bind
          // 의 __RWA_APPLY_LOGOS__ 가 admin URL 주입. 미지원 토큰은 fallback
          // 글리프 유지.
          const tokenLogoKey =
            eAsset === "USDT" ? "usdt" :
            eAsset === "SilicaSTO" ? "silicasto" :
            eAsset === "Silica" ? "silica" : "";
          const tokenLogoSrc =
            tokenLogoKey === "usdt" ? "assets/images/token-usdt.svg" :
            tokenLogoKey === "silicasto" ? "assets/images/token-silicasto.svg" :
            tokenLogoKey === "silica" ? "assets/images/token-silica.svg" : "";
          const tokenFallbackGlyph =
            eAsset === "USDT" ? "$" :
            eAsset === "SilicaSTO" ? "S" :
            eAsset === "Silica" ? "◆" : "—";
          const tokenChipClass = eAsset === "USDT" ? "usdt" : (eAsset === "SilicaSTO" ? "silica-sto" : "silica");
          const tokenLabel = eAsset || "-";
          // <img data-token-logo> 가 있으면 admin URL 우선; 없으면 글리프 fallback.
          const tokenIconHtml = tokenLogoKey
            ? `<img class="icon" alt="${escHtml(tokenLabel)}" data-token-logo="${tokenLogoKey}" src="${tokenLogoSrc}">`
            : `<span class="icon">${tokenFallbackGlyph}</span>`;
          // (2026-05-07) status 별 배지 색상 — '반려' 추가.
          //   대기 → warning(주황), 실패/반려 → danger(빨강), 그 외(완료/입금완료/환불) → success(초록).
          // (2026-05-20 v676) 출금반환 / 출금취소 → warning(amber) — 정상 완료
          //   가 아닌 환원성 트랜잭션임을 시각화. 외부 입금(녹색) 과 구분.
          const statusBadge = r.status === "대기" ? "badge-warning"
                            : (r.status === "실패" || r.status === "반려") ? "badge-danger"
                            : (r.status === "출금반환" || r.status === "출금취소") ? "badge-warning"
                            : "badge-success";
          // (2026-05-07) 거절(실패) 행은 status 배지 옆에 인라인 "Reason" 버튼을 노출.
          //   별도 행으로 펼치는 대신 클릭 시 모달이 열려 사유 + 연락처 + dismiss
          //   체크박스를 표시한다. 사용자는 체크박스를 켜고 Close 하면 deposit.html
          //   배너가 더 이상 그 거절 건에 대해 뜨지 않게 된다 (localStorage 기록).
          const rejectInfo = (r.status === "실패" || r.status === "반려") ? parseRejectInfo(r) : null;
          const reasonBtn = rejectInfo ? `<button type="button" class="btn-reject-reason"
              data-tx-id="${escHtml(r.id)}"
              data-reason="${escHtml(rejectInfo.reason)}"
              data-contact="${escHtml(rejectInfo.contact)}"
              title="View rejection reason and admin contact"
              style="margin-left:6px;background:transparent;border:1px solid #dc2626;color:#dc2626;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;letter-spacing:0.5px;cursor:pointer;line-height:1.4;font-family:inherit">Reason</button>` : "";

          // (2026-05-08) Withdraw rows: 720 (gross balance impact) is the
          //   primary number, with a small subtitle showing fee + net so the
          //   user clearly sees they paid 1 USDT fee and received 719 USDT
          //   on-chain. Applies to /^withdraw/ rows that have fee/net info.
          // (2026-05-12 v304/v307) kind별 정밀도 분기 — 백엔드 저장 정밀도와
          //   동일하게 표시:
          //     · interest_claim (스테이킹 이자): 1자리 floor — 4.1 USDT
          //     · referral_bonus (추천 보상): 3자리 floor — 0.041 USDT
          //     · 그 외 (입출금/거래/스왑 등): 2자리 그대로
          // (2026-05-18 v513) 운영자 요청: 거래 수수료가 0.5% (소수점 3자리
          //   정밀도) 이므로 trade_*, order_* 도 3자리 표기. 1 USDT × 0.5%
          //   = 0.005 USDT 가 정확히 보이도록.
          let amtDigits = 2;
          if (/^interest/.test(k)) amtDigits = 1;
          else if (/^referral_bonus/.test(k)) amtDigits = 3;
          else if (/^(trade_|order_)/.test(k)) amtDigits = 3;
          let amountCell = `${sign}${fmtN(amt, amtDigits)}`;
          // (2026-05-18 v515) order_buy_placed / order_buy_canceled 의 memo 에
          //   '[order=N, fee=N]' 형태로 분해 정보가 포함되어 있으면 작은 부제로
          //   '주문 N · 수수료 N' 표시. 사용자 요청.
          if (/^order_buy_(placed|canceled)$/.test(k)) {
            const m = String(r.memo || "").match(/\[order=([\d.]+),\s*fee=([\d.]+)\]/);
            if (m) {
              const orderPart = Number(m[1]) || 0;
              const feePart = Number(m[2]) || 0;
              const _histRowLang = (typeof getCurrentLang === "function" ? getCurrentLang() : "ko");
              const ko = _histRowLang === "ko";
              const orderLbl = ko ? "주문" : "Order";
              const feeLbl   = ko ? "수수료" : "Fee";
              amountCell = `
                <div>${sign}${fmtN(amt, 3)}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;font-weight:500;letter-spacing:0">
                  ${escHtml(orderLbl)} ${fmtN(orderPart, 3)} · ${escHtml(feeLbl)} ${fmtN(feePart, 3)}
                </div>
              `;
            }
          }
          if (/^withdraw/i.test(k)) {
            const bd = parseWithdrawBreakdown(r);
            if (bd && bd.fee > 0) {
              const sameAsset = (bd.feeAsset || "USDT").toUpperCase() === String(eAsset || "").toUpperCase();
              const feeStr = `${FEE_LABEL} ${fmtN(bd.fee, 2)}${sameAsset ? "" : " " + bd.feeAsset}`;
              const netStr = `${NET_LABEL} ${fmtN(bd.net, 2)}${sameAsset ? "" : " " + (eAsset || "")}`;
              amountCell = `
                <div>${sign}${fmtN(amt, 2)}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;font-weight:500;letter-spacing:0">
                  ${escHtml(feeStr)} · ${escHtml(netStr)}
                </div>
              `;
            }
          }

          // (2026-05-20 v672) UTC → 사용자 로컬 timezone 변환.
          //   백엔드 nowUtcSql() 는 'Y-m-d H:i:s' UTC 로 저장하지만 'Z' 마커
          //   없어 raw slice 시 UTC 시각 그대로 표시 (KST 사용자 9시간 차이).
          //   히스토리 테이블의 시간 컬럼이 이전 v669 fmtDateTime 우회하던 곳.
          const fmtUtcLocal = (s) => {
            if (!s) return "-";
            let str = String(s).trim();
            if (!str) return "-";
            const hasTz = /Z$|[+-]\d{2}:?\d{2}$/i.test(str);
            if (!hasTz) {
              if (str.includes(" ")) str = str.replace(" ", "T");
              str = str.replace(/\.\d+$/, "");
              str += "Z";
            }
            const d = new Date(str);
            if (isNaN(d.getTime())) return String(s).slice(0, 16).replace("T", " ");
            const pad = (n) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
          };
          return `
            <tr>
              <td>${fmtUtcLocal(r.created_at)}</td>
              <td>${labelKind(k, r)}</td>
              <td><span class="token-chip ${tokenChipClass}">${tokenIconHtml}${tokenLabel}</span></td>
              <td class="text-right text-mono">${amountCell}</td>
              <td style="white-space:nowrap"><span class="badge ${statusBadge}">${labelStatus(r.status)}</span>${reasonBtn}</td>
              <td>${r.txid ? `<a href="${buildExplorerTxUrl(r.txid)}" target="_blank" rel="noopener" class="text-cyan" style="text-decoration:none;font-size:12px;">${String(r.txid).slice(0, 4)}...${String(r.txid).slice(-3)} ↗</a>` : "—"}</td>
            </tr>`;
        }).join("");
        // (v636) 행 재생성 후 admin 업로드 토큰 로고 즉시 적용.
        if (typeof window.__RWA_APPLY_LOGOS__ === "function") {
          try { window.__RWA_APPLY_LOGOS__(tbody); } catch (_) {}
        }
        // Event delegation for the Reason buttons inside the (re)rendered tbody.
        // tbody.dataset.rejectBound 으로 한 번만 바인딩되도록 보장.
        if (!tbody.dataset.rejectBound) {
          tbody.dataset.rejectBound = "1";
          tbody.addEventListener("click", (ev) => {
            const btn = ev.target.closest(".btn-reject-reason");
            if (!btn) return;
            ev.preventDefault();
            openRejectModal(btn.dataset.txId, btn.dataset.reason, btn.dataset.contact);
          });
        }
        setText("historyPaging", pagingText(rows.length));
        // (2026-05-21 v727) Export CSV — 현재 렌더된 rows (=필터 적용 후) 를
        //   CSV 로 다운로드. 한국어 헤더 + UTF-8 BOM (Excel 호환).
        const exportBtn = document.getElementById("historyExportBtn");
        if (exportBtn && !exportBtn.dataset.bound) {
          exportBtn.dataset.bound = "1";
          exportBtn.addEventListener("click", () => {
            try {
              const csvRows = [];
              csvRows.push(["시간", "종류", "토큰", "금액", "수수료", "실수령", "상태", "TX Hash", "메모"].join(","));
              const escCsv = (v) => {
                const s = String(v ?? "");
                return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
              };
              rows.forEach((r) => {
                const k = (r.kind && String(r.kind).trim()) ? String(r.kind) : inferKind(r);
                const eAsset = inferAsset(r, k);
                const positiveSub = /deposit|invest_credit|invest_refund|unstake|interest|referral|dividend|swap_in|order_buy_canceled|order_sell_canceled|withdraw_refund/.test(k);
                const positiveTrade = /^(trade_buy|trade_sell_recv)$/.test(k);
                const positive = positiveSub || positiveTrade;
                const sign = positive ? "+" : "-";
                const amt = Number(r.amount || 0);
                const fee = parseMemoNum(r.memo, "fee_amount") || parseMemoNum(r.memo, "fee_value");
                const net = parseMemoNum(r.memo, "net") || (amt - fee);
                csvRows.push([
                  fmtUtcLocal(r.created_at),
                  KIND_LABELS[k] || k,
                  eAsset,
                  `${sign}${amt}`,
                  fee > 0 ? fee : "",
                  positive ? "" : (net > 0 ? net : ""),
                  labelStatus(r.status),
                  r.txid || "",
                  String(r.memo || "").slice(0, 200),
                ].map(escCsv).join(","));
              });
              const csv = "﻿" + csvRows.join("\n"); // UTF-8 BOM (Excel)
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const now = new Date();
              const fname = `history_${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 5).replace(":", "")}.csv`;
              a.href = url;
              a.download = fname;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            } catch (e) {
              console.warn("[history export] failed:", e);
              alert("Export 실패: " + (e?.message || String(e)));
            }
          });
        }
      };

      // (2026-05-12 v310) 비-referrer 는 All 탭에서도 referral_bonus 행을
      //   숨긴다 (백엔드는 자기 주소 행만 반환하지만 과거 referrer 였던
      //   사용자가 비활성화된 경우 행이 잔존할 수 있어 안전망).
      const sanitizedAll = sanitizeForReferrer(allRows);
      renderRows(sanitizedAll);

      // 탭 클릭 — active 토글 + 서버측 필터 재요청 (v281)
      // (2026-05-07) inferKind 를 적용해서 빈 kind 행도 정확한 탭에 잡히게.
      // (2026-05-11 v281) 트레이드 활동이 많은 사용자는 latest 200 rows 도
      //   여전히 트레이드로 채워질 수 있어, 탭 클릭 시 백엔드의 ?kind=
      //   filter 를 사용해 해당 카테고리의 깊은 슬라이스를 별도로 fetch.
      //   첫 응답으로 채운 allRows 캐시는 'all' 탭 전용으로 유지.
      const tabCache = { all: sanitizedAll };
      if (tabsBox && !tabsBox.dataset.bound) {
        tabsBox.dataset.bound = "1";
        tabsBox.addEventListener("click", async (e) => {
          const btn = e.target.closest("button.tab[data-tab]");
          if (!btn || btn.disabled) return;
          // (2026-05-12 v310) Referral 탭은 referrer 승인자만 클릭 허용
          // (hidden 이어도 키보드/스크립트로 우회 시도되면 차단).
          const key = btn.dataset.tab || "all";
          if (key === "referral_bonus" && !_isApprovedReferrer) {
            return;
          }
          tabsBox.querySelectorAll("button.tab").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");

          const filterFn = TAB_FILTERS[key] || TAB_FILTERS.all;

          // 'all' 은 이미 캐시된 응답 재사용.
          if (key === "all") {
            renderRows(tabCache.all);
            return;
          }

          // 서버측 ?kind= 로 깊은 슬라이스 fetch — 한 번 받으면 캐시.
          if (!tabCache[key]) {
            renderRows([]);   // 로딩 중 빈 상태로 즉시 표시 (placeholder optional)
            try {
              const r = await apiCall(`/api/wallet/transactions?kind=${encodeURIComponent(key)}&limit=500`);
              const rows = Array.isArray(r?.transactions) ? r.transactions
                         : Array.isArray(r?.rows)         ? r.rows
                         : Array.isArray(r)               ? r
                         : [];
              // (2026-05-12 v310) 비-referrer 안전망 — 서버가 referral_bonus
              //   행을 넣어 보내도 클라이언트에서 한 번 더 제거.
              tabCache[key] = sanitizeForReferrer(rows);
            } catch (_) {
              tabCache[key] = [];
            }
          }

          // 서버 필터가 잡지 못한 legacy 빈-kind 행을 위해 클라이언트 측 한 번 더 필터링.
          const filtered = tabCache[key].filter((r) => {
            const eff = (r.kind && String(r.kind).trim()) ? String(r.kind) : inferKind(r);
            return filterFn(eff);
          });
          renderRows(filtered);
        });
      }
    }
  };

  // (2026-05-14 v356) Staking modal icon helpers — success/error 모두
  //   동일한 #rwaNotifModal chrome 을 공유하므로 매 호출 시 icon (체크/⚠)
  //   과 색상 (green/red) 을 명시적으로 reset 해야 이전 상태가 새지 않음.
  const _setStakingIcon = (modal, kind) => {
    const iconEl = modal?.querySelector(".rwa-notif-icon");
    if (!iconEl) return;
    if (kind === "error") {
      iconEl.style.background = "linear-gradient(135deg, #DC2626, #B91C1C)";
      iconEl.style.boxShadow = "0 12px 32px rgba(220, 38, 38, 0.35)";
      // ⚠ warning triangle
      iconEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
    } else {
      // success — 원래 디자인 (체크마크 + green gradient)
      iconEl.style.background = "linear-gradient(135deg, #16a34a, #059669)";
      iconEl.style.boxShadow = "0 12px 32px rgba(16, 163, 74, 0.35)";
      iconEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5"></path>
        </svg>`;
    }
  };

  // ─── Staking success popup (2026-05-06) ─────────────────────────────
  // 스테이킹 성공 시 토스트 대신 명시적 그린-체크 모달 — 기존 notif 모달 chrome
  // 재사용. 사용자가 "View My Staking" 클릭 시 페이지 새로고침으로 갱신된 카드 노출.
  const showStakingSuccessModal = (amount) => {
    const modal = ensureNotifModal();
    const titleEl = document.getElementById("rwaNotifTitle");
    const bodyEl = document.getElementById("rwaNotifBody");
    const metaEl = document.getElementById("rwaNotifMeta");
    const goBtn = document.getElementById("rwaNotifGoBtn");
    const closeBtn = document.getElementById("rwaNotifCloseBtn");
    const counterEl = document.getElementById("rwaNotifCounter");
    if (!modal || !titleEl || !bodyEl || !goBtn || !closeBtn) return;

    // (v356) icon 을 success (green/체크) 로 리셋 — error 호출 후 이 함수가
    //   호출돼도 깨끗하게 표시. error 가 goBtn 을 hide 시켰을 수 있어 display
    //   도 복원.
    _setStakingIcon(modal, "success");
    goBtn.style.display = "";

    const lang = getCurrentLang();
    // (2026-05-08) JA/ZH 분기 추가 — 비-EN/KO locale 에서도 한국어 누출 방지.
    const _amountLabel = Number(amount).toLocaleString();
    const labels =
      lang === "en" ? {
        title: "Staking Completed",
        body: `You have successfully staked ${_amountLabel} SilicaSTO. Monthly USDT interest will begin from the next 15th payout cycle.`,
        metaLabel: "Staked Amount",
        go: "View My Staking",
        close: "Close",
      } :
      lang === "ja" ? {
        title: "ステーキング完了",
        body: `${_amountLabel} SilicaSTO のステーキングが正常に完了しました。次の15日支払サイクルから毎月USDT利息が自動支払されます。`,
        metaLabel: "ステーキング数量",
        go: "ステーキング状況を表示",
        close: "閉じる",
      } :
      lang === "zh" ? {
        title: "质押完成",
        body: `${_amountLabel} SilicaSTO 质押已成功完成。将从下次15日支付周期开始每月自动支付 USDT 利息。`,
        metaLabel: "质押数量",
        go: "查看我的质押",
        close: "关闭",
      } : {
        title: "스테이킹 완료",
        body: `${_amountLabel} SilicaSTO 스테이킹이 정상적으로 완료되었습니다. 다음 15일 지급 주기부터 매월 USDT 이자가 자동 지급됩니다.`,
        metaLabel: "스테이킹 수량",
        go: "스테이킹 현황 보기",
        close: "닫기",
      };

    titleEl.textContent = labels.title;
    bodyEl.textContent = labels.body;
    if (metaEl) {
      metaEl.innerHTML = `
        <span style="font-family:'Space Grotesk';letter-spacing:1.5px;text-transform:uppercase;font-weight:600">${labels.metaLabel}</span>
        <strong style="color:var(--text);font-family:'Unbounded',sans-serif;font-size:14px">${Number(amount).toLocaleString()} STO</strong>
      `;
    }
    goBtn.textContent = labels.go;
    closeBtn.textContent = labels.close;
    if (counterEl) counterEl.textContent = "";

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    _notifShowing = true;

    const dismiss = (action) => {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      _notifShowing = false;
      // 어떤 버튼을 누르든 페이지 새로고침으로 카드/잔량 갱신.
      // 정산 직후라 stale 한 화면 상태가 남으면 안 됨.
      setTimeout(() => location.reload(), 200);
    };

    goBtn.onclick = () => dismiss("go");
    closeBtn.onclick = () => dismiss("close");
    const backdrop = modal.querySelector(".rwa-notif-backdrop");
    if (backdrop) backdrop.onclick = () => dismiss("close");
  };

  // ─── Staking error popup (2026-05-14 v356) ──────────────────────────
  // 운영자: '메시지를 팝업으로 구현.' 14~16일 lock 거부 / 잔액 부족 등 backend
  // 거부 메시지가 화면 하단 토스트로 짧게 표시되어 사용자가 놓치는 문제. 동일
  // notif 모달 chrome 을 ⚠ warning + red gradient 로 재사용해 명확히 노출.
  // success 와 달리 reload 안 함 — 사용자 입력값 보존.
  const showStakingErrorModal = (rawMsg, opts = {}) => {
    const modal = ensureNotifModal();
    const titleEl = document.getElementById("rwaNotifTitle");
    const bodyEl = document.getElementById("rwaNotifBody");
    const metaEl = document.getElementById("rwaNotifMeta");
    const goBtn = document.getElementById("rwaNotifGoBtn");
    const closeBtn = document.getElementById("rwaNotifCloseBtn");
    const counterEl = document.getElementById("rwaNotifCounter");
    if (!modal || !titleEl || !bodyEl || !goBtn || !closeBtn) return;

    // icon 을 error (red/⚠) 로 설정.
    _setStakingIcon(modal, "error");

    const lang = getCurrentLang();
    const isUnstake = !!opts.isUnstake;
    // backend 메시지는 i18n.js 의 풀-센텐스 매핑을 통해 자동 번역.
    const translatedMsg = window.RwaI18n?.translateMessage?.(String(rawMsg || "")) || String(rawMsg || "");

    const labels =
      lang === "en" ? {
        title: isUnstake ? "Unstaking Failed" : "Staking Failed",
        close: "Close",
      } :
      lang === "ja" ? {
        title: isUnstake ? "アンステーキング失敗" : "ステーキング失敗",
        close: "閉じる",
      } :
      lang === "zh" ? {
        title: isUnstake ? "解除质押失败" : "质押失败",
        close: "关闭",
      } : {
        title: isUnstake ? "언스테이킹 실패" : "스테이킹 실패",
        close: "닫기",
      };

    titleEl.textContent = labels.title;
    bodyEl.textContent = translatedMsg || labels.title;
    if (metaEl) metaEl.innerHTML = "";   // error 시 meta 행 숨김
    goBtn.style.display = "none";        // error 는 단일 close 버튼만
    closeBtn.textContent = labels.close;
    if (counterEl) counterEl.textContent = "";

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    _notifShowing = true;

    const dismiss = () => {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      _notifShowing = false;
      // (v356) error 닫을 때 reload 안 함 — 사용자 입력값 보존.
      // 다음 success 호출 시 _setStakingIcon 이 다시 green 으로 리셋 +
      // goBtn 의 display:none 도 그 분기에서 별도로 해제 필요.
      goBtn.style.display = "";          // success 호출 시 복원되도록 비움
    };

    closeBtn.onclick = dismiss;
    const backdrop = modal.querySelector(".rwa-notif-backdrop");
    if (backdrop) backdrop.onclick = dismiss;
  };

  // ─── User notifications 1회용 팝업 ────────────────────────────────────
  // 관리자 서명 등 비동기 이벤트가 발생하면 백엔드가 user_notifications 큐에
  // 행을 넣는다. 여기서 30초 주기로 폴링하여 미읽음 알림이 있으면 모달을 띄우고
  // 닫을 때 read 처리한다. 같은 알림은 한 번만 노출됨.
  const NOTIF_POLL_INTERVAL_MS = 30000;
  let _notifTimer = null;
  let _notifShowing = false;
  let _notifSeenIds = new Set();

  // (2026-05-08) Interest pending detail modal — fired by the
  //   "자세히 보기" button on staking.html / claim.html cards. Shows a
  //   per-row breakdown of unclaimed interest_claims rows for the
  //   logged-in user (month, staked snapshot, APR, USDT amount, accrual
  //   timestamp). Reuses the .rwa-notif-layer styles where possible
  //   but overrides panel width since this is table-shaped content.
  const ensureInterestDetailModal = () => {
    let modal = document.getElementById("silicaIntDetailModal");
    if (modal) return modal;

    const css = `
      .silica-int-detail-layer { position: fixed; inset: 0; z-index: 6100; display: flex; align-items: center; justify-content: center; padding: 16px; }
      .silica-int-detail-layer.hidden { display: none; }
      .silica-int-detail-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); }
      @keyframes silicaIntDetailIn { 0% { transform: translateY(20px) scale(0.96); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      .silica-int-detail-panel {
        position: relative; width: min(720px, calc(100vw - 32px));
        max-height: calc(100vh - 64px); display: flex; flex-direction: column;
        background: var(--panel, #fff); border: 1.5px solid var(--border-strong, #d1d5db);
        border-radius: 16px; box-shadow: 0 30px 90px rgba(0,0,0,0.25);
        animation: silicaIntDetailIn 0.28s cubic-bezier(.2,.8,.25,1.05);
      }
      .silica-int-detail-head { padding: 20px 24px 14px; border-bottom: 1px solid var(--line, rgba(0,0,0,0.08)); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
      .silica-int-detail-title { font-family: 'Unbounded', 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: var(--text, #111); margin: 0 0 4px; letter-spacing: -0.01em; }
      .silica-int-detail-sub { font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: var(--muted, #6b7280); }
      .silica-int-detail-close {
        background: transparent; border: 1px solid var(--line, #e5e7eb); border-radius: 8px;
        width: 32px; height: 32px; cursor: pointer; color: var(--muted, #6b7280);
        display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
      }
      .silica-int-detail-close:hover { background: var(--glass-2, rgba(0,0,0,0.04)); color: var(--text, #111); }
      .silica-int-detail-scroll { overflow: auto; padding: 0; }
      .silica-int-detail-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: 'Space Grotesk', sans-serif; }
      .silica-int-detail-table thead th {
        position: sticky; top: 0; background: var(--panel, #fff);
        text-align: left; padding: 10px 14px; font-size: 11px;
        letter-spacing: 1px; text-transform: uppercase;
        color: var(--muted, #6b7280); border-bottom: 1px solid var(--line, rgba(0,0,0,0.08));
        font-weight: 600;
      }
      .silica-int-detail-table tbody td { padding: 12px 14px; border-bottom: 1px solid var(--line, rgba(0,0,0,0.05)); color: var(--text, #111); }
      .silica-int-detail-table tbody tr:last-child td { border-bottom: none; }
      .silica-int-detail-table .num { font-family: 'Unbounded', monospace; font-weight: 600; text-align: right; }
      .silica-int-detail-foot { padding: 14px 24px; border-top: 1px solid var(--line, rgba(0,0,0,0.08)); display: flex; justify-content: space-between; align-items: center; gap: 16px; background: rgba(16, 185, 129, 0.04); }
      .silica-int-detail-total-label { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted, #6b7280); }
      .silica-int-detail-total-amt { font-family: 'Unbounded', monospace; font-weight: 800; font-size: 22px; color: var(--green, #059669); line-height: 1; }
      .silica-int-detail-empty { padding: 48px 24px; text-align: center; color: var(--muted, #6b7280); font-size: 13px; }
      .silica-int-detail-loading { padding: 48px 24px; text-align: center; color: var(--muted, #6b7280); font-size: 13px; }
    `;

    const style = document.createElement("style");
    style.id = "silicaIntDetailStyle";
    style.textContent = css;
    document.head.appendChild(style);

    modal = document.createElement("div");
    modal.id = "silicaIntDetailModal";
    modal.className = "silica-int-detail-layer hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="silica-int-detail-backdrop" data-int-detail-dismiss="1"></div>
      <div class="silica-int-detail-panel">
        <div class="silica-int-detail-head">
          <div>
            <h2 class="silica-int-detail-title" id="silicaIntDetailTitle">-</h2>
            <div class="silica-int-detail-sub" id="silicaIntDetailSub">-</div>
          </div>
          <button type="button" class="silica-int-detail-close" id="silicaIntDetailClose" aria-label="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="silica-int-detail-scroll" id="silicaIntDetailScroll">
          <div class="silica-int-detail-loading" id="silicaIntDetailLoading">Loading…</div>
        </div>
        <div class="silica-int-detail-foot" id="silicaIntDetailFoot" style="display:none">
          <div>
            <div class="silica-int-detail-total-label" id="silicaIntDetailTotalLabel">-</div>
            <div class="silica-int-detail-total-amt" id="silicaIntDetailTotalAmt">-</div>
          </div>
          <div class="silica-int-detail-sub" id="silicaIntDetailRowsCount">-</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Wire close handlers
    const closeBtn = modal.querySelector("#silicaIntDetailClose");
    const backdrop = modal.querySelector(".silica-int-detail-backdrop");
    const closeFn = () => {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    };
    if (closeBtn) closeBtn.addEventListener("click", closeFn);
    if (backdrop) backdrop.addEventListener("click", closeFn);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) closeFn();
    });

    return modal;
  };

  const openInterestDetailModal = async (langEn) => {
    const modal = ensureInterestDetailModal();
    const title = modal.querySelector("#silicaIntDetailTitle");
    const sub = modal.querySelector("#silicaIntDetailSub");
    const scroll = modal.querySelector("#silicaIntDetailScroll");
    const foot = modal.querySelector("#silicaIntDetailFoot");
    const totalLabel = modal.querySelector("#silicaIntDetailTotalLabel");
    const totalAmt = modal.querySelector("#silicaIntDetailTotalAmt");
    const rowsCount = modal.querySelector("#silicaIntDetailRowsCount");

    if (title) title.textContent = langEn ? "Pending Interest Detail" : "미수령 이자 상세 내역";
    if (sub) sub.textContent = langEn
      ? "Each row is one monthly accrual. Click 'Claim' to receive the total in your USDT balance."
      : "각 행은 월별 이자 적립 1건입니다. 'Claim' 클릭 시 합계가 USDT 잔액으로 입금됩니다.";
    if (scroll) scroll.innerHTML = `<div class="silica-int-detail-loading">${langEn ? "Loading…" : "불러오는 중…"}</div>`;
    if (foot) foot.style.display = "none";

    // Show modal
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    try {
      const r = await apiCall("/api/interest/pending");
      const rows = Array.isArray(r?.rows) ? r.rows : [];
      const total = Number(r?.total_usdt || 0);

      if (!rows.length) {
        scroll.innerHTML = `<div class="silica-int-detail-empty">${langEn ? "No pending interest at the moment." : "현재 수령 대기 중인 이자가 없습니다."}</div>`;
        return;
      }

      const headers = langEn
        ? ["Cycle", "Payout Date", "Staked", "APR", "Amount (USDT)"]
        : ["회차", "지급 예정일", "스테이킹", "이자율", "금액 (USDT)"];

      const fmtMonth = (m) => String(m || "").slice(0, 7);
      const fmtPayoutDate = (m) => `${fmtMonth(m)}-15`;
      const fmtCreated = (s) => {
        if (!s) return "—";
        // Just keep YYYY-MM-DD HH:MM portion for compactness
        return String(s).replace("T", " ").slice(0, 16);
      };

      const trs = rows.map((row) => {
        const month = fmtMonth(row.month_key);
        const payoutDate = fmtPayoutDate(row.month_key);
        const staked = Number(row.staked_snapshot || 0);
        const apr = Number(row.apr_snapshot || 0);
        const amt = Number(row.amount_usdt || 0);
        const created = fmtCreated(row.created_at);
        return `
          <tr>
            <td>${month}</td>
            <td>${payoutDate}<br><span style="color:var(--muted);font-size:11px">${langEn ? "accrued" : "적립"} ${created}</span></td>
            <td class="num">${fmtN(staked, 0)} STO</td>
            <td class="num">${fmtN(apr, 2)}%</td>
            <td class="num" style="color:var(--green,#059669)">+${fmtN(amt, 4)}</td>
          </tr>
        `;
      }).join("");

      scroll.innerHTML = `
        <table class="silica-int-detail-table">
          <thead>
            <tr>
              ${headers.map((h, i) => `<th${i >= 2 ? ' style="text-align:right"' : ""}>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      `;

      if (totalLabel) totalLabel.textContent = langEn ? "Total Pending" : "미수령 합계";
      if (totalAmt) totalAmt.textContent = `${fmtN(total, 2)} USDT`;
      if (rowsCount) rowsCount.textContent = langEn
        ? `${rows.length} round${rows.length === 1 ? "" : "s"}`
        : `${rows.length}회차`;
      if (foot) foot.style.display = "";
    } catch (e) {
      if (scroll) {
        scroll.innerHTML = `<div class="silica-int-detail-empty" style="color:#dc2626">
          ${langEn ? "Failed to load: " : "조회 실패: "}${(e?.message || e)}
        </div>`;
      }
    }
  };

  const ensureNotifModal = () => {
    let modal = document.getElementById("rwaNotifModal");
    if (modal) return modal;

    const css = `
      .rwa-notif-layer { position: fixed; inset: 0; z-index: 6000; display: flex; align-items: center; justify-content: center; padding: 16px; }
      .rwa-notif-layer.hidden { display: none; }
      .rwa-notif-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); }
      @keyframes rwaNotifIn { 0% { transform: translateY(20px) scale(0.94); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      @keyframes rwaNotifIcon { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.18); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      .rwa-notif-panel { position: relative; width: min(440px, calc(100vw - 32px)); background: var(--panel, #fff); border: 1.5px solid var(--border-strong, #d1d5db); border-radius: 20px; padding: 32px 28px 24px; box-shadow: 0 30px 90px rgba(0,0,0,0.25); text-align: center; animation: rwaNotifIn 0.32s cubic-bezier(.2,.8,.25,1.05); }
      .rwa-notif-icon { width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 50%; background: linear-gradient(135deg, #16a34a, #059669); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 32px rgba(16, 163, 74, 0.35); animation: rwaNotifIcon 0.5s cubic-bezier(.2,.8,.25,1.4) 0.05s both; }
      .rwa-notif-title { font-family: 'Unbounded', 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; margin: 0 0 8px; color: var(--text, #111); letter-spacing: -0.01em; line-height: 1.3; }
      .rwa-notif-body { font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: var(--muted, #6b7280); line-height: 1.55; margin-bottom: 20px; white-space: pre-line; }
      .rwa-notif-meta { background: var(--glass-2, rgba(0,0,0,0.03)); border: 1px solid var(--line, rgba(0,0,0,0.08)); border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; font-size: 12px; color: var(--muted, #6b7280); display: flex; justify-content: space-between; gap: 12px; }
      .rwa-notif-meta:empty { display: none; }
      .rwa-notif-foot { display: flex; flex-direction: column; gap: 8px; }
      .rwa-notif-foot .btn { width: 100%; justify-content: center; }
      .rwa-notif-counter { font-family: 'Space Grotesk', sans-serif; font-size: 11px; color: var(--muted, #6b7280); margin-top: 12px; }
      .rwa-notif-counter:empty { display: none; }
    `;

    const style = document.createElement("style");
    style.id = "rwaNotifStyle";
    style.textContent = css;
    document.head.appendChild(style);

    modal = document.createElement("div");
    modal.id = "rwaNotifModal";
    modal.className = "rwa-notif-layer hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="rwa-notif-backdrop" data-rwa-notif-dismiss="1"></div>
      <div class="rwa-notif-panel">
        <div class="rwa-notif-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5"></path>
          </svg>
        </div>
        <h2 class="rwa-notif-title" id="rwaNotifTitle">-</h2>
        <div class="rwa-notif-body" id="rwaNotifBody">-</div>
        <div class="rwa-notif-meta" id="rwaNotifMeta"></div>
        <div class="rwa-notif-foot">
          <button id="rwaNotifGoBtn" type="button" class="btn primary">-</button>
          <button id="rwaNotifCloseBtn" type="button" class="btn">-</button>
        </div>
        <div class="rwa-notif-counter" id="rwaNotifCounter"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  };

  // (2026-05-06) 알림 팝업 — DB 에 저장된 한국어 title/body 를 그대로 노출하던 구조에서
  // type + payload 기반 lang-aware 템플릿 렌더링으로 전환. EN 페이지에서 한국어 누수 차단.
  // (2026-05-08) JA/ZH 추가 — 비-EN/KO locale 에서도 한국어 누출 방지.
  const NOTIF_TEMPLATES = {
    admin_signed_funding: {
      ko: {
        title: () => "투자 확정 — SilicaSTO 분배 완료",
        body:  (sto) => `관리자 서명이 완료되어 ${sto.toLocaleString()} SilicaSTO 가 즉시 분배되었습니다. 포트폴리오에서 보유분을 확인하세요.`,
      },
      en: {
        title: () => "Investment Confirmed — SilicaSTO Distributed",
        body:  (sto) => `Admin signature is complete. ${sto.toLocaleString()} SilicaSTO has been credited to your wallet. Check your portfolio for the new balance.`,
      },
      ja: {
        title: () => "投資確定 — SilicaSTO 配布完了",
        body:  (sto) => `管理者の署名が完了し、${sto.toLocaleString()} SilicaSTO が即時配布されました。ポートフォリオで保有分をご確認ください。`,
      },
      zh: {
        title: () => "投资确认 — SilicaSTO 已分配",
        body:  (sto) => `管理员签名已完成，${sto.toLocaleString()} SilicaSTO 已立即分配至您的钱包。请在投资组合中查看持有数量。`,
      },
    },
    orphan_sto_backfill: {
      ko: {
        title: () => "미수령 SilicaSTO 가 분배되었습니다",
        body:  (sto) => `이전 정책에서 양측 서명까지 완료되었으나 미수령 상태였던 ${sto.toLocaleString()} SilicaSTO 가 분배 자동화 정책 전환에 따라 즉시 분배되었습니다. 포트폴리오에서 보유분을 확인하세요.`,
      },
      en: {
        title: () => "Pending SilicaSTO Has Been Released",
        body:  (sto) => `${sto.toLocaleString()} SilicaSTO that was finalized but never claimed under the previous policy has now been distributed under the new auto-distribution rule. Check your portfolio for the new balance.`,
      },
      ja: {
        title: () => "未受領 SilicaSTO が配布されました",
        body:  (sto) => `旧ポリシーで両者の署名が完了していたが未受領だった ${sto.toLocaleString()} SilicaSTO が、配布自動化ポリシーへの移行により即時配布されました。ポートフォリオで保有分をご確認ください。`,
      },
      zh: {
        title: () => "未领取的 SilicaSTO 已分配",
        body:  (sto) => `${sto.toLocaleString()} SilicaSTO 在旧政策下已双方签名但尚未领取，根据新的自动分配规则已立即分配。请在投资组合中查看持有数量。`,
      },
    },
    auto_unstake_on_sale: {
      ko: {
        title: () => "매각 진행 — 자동 언스테이킹 완료",
        body:  (sto) => `광산 매각 실행에 따라 보유하셨던 ${sto.toLocaleString()} SilicaSTO 의 스테이킹이 자동 해제되었습니다. 매각 정산이 준비되면 보유 토큰을 USDT 로 교환하실 수 있습니다.`,
      },
      en: {
        title: () => "Sale In Progress — Auto-Unstaked",
        body:  (sto) => `Your ${sto.toLocaleString()} SilicaSTO has been automatically unstaked because the mine sale was executed. Once settlement is ready, you can redeem your tokens for USDT.`,
      },
      ja: {
        title: () => "売却進行中 — 自動アンステーキング完了",
        body:  (sto) => `鉱山売却の実行に伴い、保有していた ${sto.toLocaleString()} SilicaSTO のステーキングが自動解除されました。売却精算の準備が整い次第、保有トークンを USDT へ交換できます。`,
      },
      zh: {
        title: () => "出售进行中 — 自动解除质押已完成",
        body:  (sto) => `由于矿山出售已执行，您持有的 ${sto.toLocaleString()} SilicaSTO 的质押已自动解除。一旦结算就绪，您即可将持有代币兑换为 USDT。`,
      },
    },
    // (2026-05-08) Interest accrual — fired by createInterestAccrualRecord()
    //   (admin force-interest button + monthly cron) when an interest row
    //   lands in interest_claims awaiting user claim. Payload carries
    //   amount_usdt / month_key / payout_date / asset_id. The CTA button
    //   takes the user to staking.html where the "이자 클레임" / "Claim"
    //   button is.
    interest_accrued: {
      goHref:  'staking.html',
      goLabel: { ko: '클레임 받으러 가기', en: 'Go to Claim' },
      ko: {
        title: (_sto, p) => "스테이킹 이자가 지급되었습니다",
        body:  (_sto, p) => {
          const amt = Number(p?.amount_usdt ?? 0).toFixed(2);
          const month = String(p?.month_key || '').slice(0, 7);
          return `${month} 회차 이자 ${amt} USDT 가 클레임 대기 중입니다. 스테이킹 페이지에서 "이자 클레임" 버튼을 눌러 잔액에 받아가세요.`;
        },
      },
      en: {
        title: (_sto, p) => "Staking Interest Ready to Claim",
        body:  (_sto, p) => {
          const amt = Number(p?.amount_usdt ?? 0).toFixed(2);
          const month = String(p?.month_key || '').slice(0, 7);
          return `Your ${month} cycle interest of ${amt} USDT is waiting. Visit the Staking page and click "Claim" to receive it in your balance.`;
        },
      },
    },
    // (2026-05-08) Rate change announcement — admin_silica_rate.php fans
    //   this out to every staker / SilicaSTO holder when admin saves a
    //   new interest rate. Payload carries new_rate_pct / prev_rate_pct /
    //   effective_from_payout. UI takes the second argument (full payload)
    //   instead of the legacy sto-only number.
    rate_change: {
      ko: {
        title: (_sto, p) => "스테이킹 이자율이 변경되었습니다",
        body:  (_sto, p) => {
          const cur = Number(p?.new_rate_pct ?? 0).toFixed(2);
          const prev = (p?.prev_rate_pct != null) ? Number(p.prev_rate_pct).toFixed(2) : null;
          const eff = String(p?.effective_from_payout || '').slice(0, 10);
          return `${eff} 회차부터 새 이자율 ${cur}% 가 적용됩니다.${prev !== null ? ` (이전: ${prev}%)` : ''}`;
        },
      },
      en: {
        title: (_sto, p) => "Staking Interest Rate Updated",
        body:  (_sto, p) => {
          const cur = Number(p?.new_rate_pct ?? 0).toFixed(2);
          const prev = (p?.prev_rate_pct != null) ? Number(p.prev_rate_pct).toFixed(2) : null;
          const eff = String(p?.effective_from_payout || '').slice(0, 10);
          return `Starting from the ${eff} payout cycle, the new staking interest rate is ${cur}%.${prev !== null ? ` (previously ${prev}%)` : ''}`;
        },
      },
    },
  };

  const NOTIF_LABELS = {
    ko: {
      fallback_title: "알림",
      meta_label: "분배 수량",
      btn_go: "포트폴리오 확인",
      btn_close: "닫기",
      queue_more: (n) => `+${n}개 알림이 더 있습니다.`,
    },
    en: {
      fallback_title: "Notice",
      meta_label: "Distribution Amount",
      btn_go: "View Portfolio",
      btn_close: "Close",
      queue_more: (n) => `+${n} more notification${n > 1 ? "s" : ""} pending.`,
    },
    ja: {
      fallback_title: "お知らせ",
      meta_label: "配布数量",
      btn_go: "ポートフォリオを確認",
      btn_close: "閉じる",
      queue_more: (n) => `他に ${n} 件の通知があります。`,
    },
    zh: {
      fallback_title: "通知",
      meta_label: "分配数量",
      btn_go: "查看投资组合",
      btn_close: "关闭",
      queue_more: (n) => `还有 ${n} 条通知待处理。`,
    },
  };

  const renderNotifContent = (notif) => {
    const lang = getCurrentLang();
    // (2026-05-08) Fallback chain: chosen lang → en → ko, so unknown locales
    //   never end up rendering raw DB Korean text.
    const baseLabels = NOTIF_LABELS[lang] || NOTIF_LABELS.en || NOTIF_LABELS.ko;
    const typeMap = NOTIF_TEMPLATES[notif.type] || {};
    const tpl = typeMap[lang] || typeMap.en || typeMap.ko;
    // sto = legacy first-arg (admin_signed / orphan / auto_unstake all use it)
    // payload = full payload object for new templates that need more fields
    const payload = notif.payload || {};
    const sto = Number(payload.sto_credited || payload.unstaked_token || 0);

    // (2026-05-08) Per-template CTA override. interest_accrued routes
    //   the "Go" button to staking.html with a "Go to Claim" label;
    //   other types fall through to the default portfolio.html /
    //   "View Portfolio".
    const goHref = (typeMap && typeMap.goHref) ? String(typeMap.goHref) : 'portfolio.html';
    const goLabelMap = (typeMap && typeMap.goLabel) || null;
    const goLabel = goLabelMap
      ? (goLabelMap[lang] || goLabelMap.en || goLabelMap.ko || baseLabels.btn_go)
      : baseLabels.btn_go;
    const labels = Object.assign({}, baseLabels, { btn_go: goLabel });

    if (tpl) {
      return {
        title: tpl.title(sto, payload),
        body:  tpl.body(sto, payload),
        labels,
        goHref,
      };
    }
    // 미등록 type — DB title/body 폴백 (이미 한국어일 수 있음 — 최후의 안전망)
    return {
      title: notif.title || baseLabels.fallback_title,
      body:  notif.body || "",
      labels,
      goHref,
    };
  };

  const showNotifModal = (notif, queueRemaining) => {
    if (!notif) return;
    const modal = ensureNotifModal();
    const titleEl = document.getElementById("rwaNotifTitle");
    const bodyEl = document.getElementById("rwaNotifBody");
    const metaEl = document.getElementById("rwaNotifMeta");
    const goBtn = document.getElementById("rwaNotifGoBtn");
    const closeBtn = document.getElementById("rwaNotifCloseBtn");
    const counterEl = document.getElementById("rwaNotifCounter");

    const { title, body, labels, goHref } = renderNotifContent(notif);
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
    if (goBtn) goBtn.textContent = labels.btn_go;
    if (closeBtn) closeBtn.textContent = labels.btn_close;
    // Cache the resolved href on the modal so dismiss('go') can route
    //   per-notification (interest_accrued → staking.html, others →
    //   portfolio.html). renderNotifContent picks this from the
    //   template's goHref field.
    const resolvedGoHref = goHref || 'portfolio.html';

    // 메타 영역 — payload 의 sto_credited / unstaked_token 가 있으면 강조 표시
    if (metaEl) {
      const sto = Number(notif.payload?.sto_credited || notif.payload?.unstaked_token || 0);
      const usdt = Number(notif.payload?.amount_usdt || 0);
      if (sto > 0) {
        metaEl.innerHTML = `
          <span style="font-family:'Space Grotesk';letter-spacing:1.5px;text-transform:uppercase;font-weight:600">${labels.meta_label}</span>
          <strong style="color:var(--text);font-family:'Unbounded',sans-serif;font-size:14px">${sto.toLocaleString()} STO${usdt ? ` <small style="color:var(--muted);font-weight:400">(${usdt.toLocaleString()} USDT)</small>` : ""}</strong>
        `;
      } else {
        metaEl.innerHTML = "";
      }
    }

    if (counterEl) {
      counterEl.textContent = queueRemaining > 1 ? labels.queue_more(queueRemaining - 1) : "";
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    _notifShowing = true;

    const dismiss = async (action) => {
      // 서버에 read 처리
      try {
        await apiCall(`/api/notifications/${encodeURIComponent(notif.id)}/read`, { method: "POST", body: {} });
      } catch (_) {}
      _notifSeenIds.add(notif.id);

      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      _notifShowing = false;

      if (action === "go") {
        // (2026-05-08) Route per-notification: interest_accrued → staking.html,
        //   other types → portfolio.html (existing behavior). resolvedGoHref
        //   was captured from the template's goHref above.
        const target = String(resolvedGoHref || 'portfolio.html');
        const here = location.pathname.split('/').pop() || '';
        if (here === target) {
          location.reload();
        } else {
          location.href = target;
        }
        return;
      }

      // (2026-05-08) For state-changing notifications (interest_accrued,
      //   rate_change), reload the page on CLOSE too if the user is on
      //   staking.html / claim.html. Otherwise the page keeps its stale
      //   data from the original load (e.g. 'NO PENDING' card shown
      //   right after a force-interest popup said 4.10 USDT pending,
      //   because /api/portfolio was only fetched at page mount).
      const heroRefreshTypes = new Set(['interest_accrued', 'rate_change']);
      if (action === "close" && heroRefreshTypes.has(String(notif?.type || ''))) {
        const here = (location.pathname.split('/').pop() || '').toLowerCase();
        if (here === 'staking.html' || here === 'claim.html') {
          location.reload();
          return;
        }
      }

      // 큐에 더 있으면 다음 알림 표시
      setTimeout(() => pollAndShow(), 350);
    };

    // 핸들러는 매번 재바인딩 (이전 알림의 클로저 새로 만들기)
    if (goBtn) {
      goBtn.onclick = () => dismiss("go");
    }
    if (closeBtn) {
      closeBtn.onclick = () => dismiss("close");
    }
    const backdrop = modal.querySelector(".rwa-notif-backdrop");
    if (backdrop) {
      backdrop.onclick = () => dismiss("close");
    }
  };

  const pollAndShow = async () => {
    if (_notifShowing) return; // 이미 모달 표시 중이면 중복 호출 방지
    if (!isLoggedIn()) return;

    const r = await apiCall("/api/notifications/unread");
    const list = Array.isArray(r?.notifications) ? r.notifications : [];
    const fresh = list.filter((n) => !_notifSeenIds.has(n.id));
    if (fresh.length === 0) return;

    showNotifModal(fresh[0], fresh.length);
  };

  const startNotifPoller = () => {
    if (_notifTimer) return;
    // 첫 호출은 약간 지연 — 페이지 로드 직후의 다른 API 호출들과 충돌 방지
    setTimeout(pollAndShow, 1500);
    _notifTimer = setInterval(pollAndShow, NOTIF_POLL_INTERVAL_MS);

    // 탭 가시성 회복 시 즉시 한 번 더 폴링 (장시간 백그라운드에 있다가 돌아왔을 때)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") pollAndShow();
    });
  };

  // DOM 준비되면 실행
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { bind(); startNotifPoller(); });
  } else {
    bind();
    startNotifPoller();
  }
})();
