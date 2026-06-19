(() => {
  "use strict";

  const { api, logout, toast, onReady, showAdminRecovery, ADMIN_ASSET_TOKEN } = window.AdminCore;
  const HEADER_PATH = `header.html?_v=${encodeURIComponent(ADMIN_ASSET_TOKEN || "1")}`;
  const POLL_MS = 20000;
  let pollTimer = null;
  let lastTotalPending = null;
  let baseTitle = "";
  let loadPromise = null;

  function bindLogout() {
    const btn = document.getElementById("adminLogoutBtn");
    if (!btn) return;
    btn.onclick = logout;
  }

  // (2026-05-07) KO/EN 토글 바인딩 — header.html 의 인라인 스크립트는
  // innerHTML 로 주입되어 실행되지 않으므로, mountHeader 직후 명시적으로
  // 호출한다. 두 번 호출되어도 dataset.bound 가드로 중복 등록 방지.
  function bindAdminLangToggle() {
    const buttons = document.querySelectorAll('.admin-top .lang-toggle .lang-btn');
    if (!buttons.length) return false;
    const LANG_KEY = 'rwa_lang_admin_v1';
    const current = (() => {
      try { return (localStorage.getItem(LANG_KEY) || 'ko').trim().toLowerCase(); }
      catch (_) { return 'ko'; }
    })();
    buttons.forEach((btn) => {
      const lang = btn.getAttribute('data-lang');
      if (lang === current) btn.classList.add('active');
      else btn.classList.remove('active');
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-lang');
        if (!next) return;
        let cur;
        try { cur = (localStorage.getItem(LANG_KEY) || 'ko').trim().toLowerCase(); }
        catch (_) { cur = 'ko'; }
        if (next === cur) return;
        try {
          localStorage.setItem(LANG_KEY, next);
          window.AdminI18n?.setLang?.(next);
        } catch (e) {
          console.warn('[admin.header] lang switch failed', e);
        }
        location.reload();
      });
    });
    return true;
  }

  function setBadge(id, count) {
    const badge = document.getElementById(id);
    if (!badge) return;
    const n = Number(count || 0);
    badge.textContent = String(n);
    badge.style.display = n > 0 ? "inline-block" : "none";
  }

  function playAlertBeep(times = 1) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!playAlertBeep._ctx) playAlertBeep._ctx = new Ctx();
      const ctx = playAlertBeep._ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const gap = 0.16;
      const now = ctx.currentTime;
      for (let i = 0; i < Math.max(1, Math.min(3, times)); i += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, now + i * gap);
        gain.gain.exponentialRampToValueAtTime(0.08, now + i * gap + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * gap + 0.11);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * gap);
        osc.stop(now + i * gap + 0.12);
      }
    } catch (e) { console.error('[admin.header] beep failed', e); }
  }

  function updateDocumentTitle(totalPending) {
    if (!baseTitle) baseTitle = document.title || "RECON RWA 관리자";
    const cleanBase = baseTitle.replace(/^\[[0-9]+\]\s*/, "");
    const translated = window.AdminI18n?.translateString?.(cleanBase) || cleanBase;
    document.title = totalPending > 0 ? `[${totalPending}] ${translated}` : translated;
  }

  function fallbackHeaderHtml() {
    return `
      <div class="admin-top">
        <div style="display:flex; align-items:center; gap:12px">
          <img src="/assets/images/recon-logo.png" alt="RECON" style="width:32px; height:32px; border-radius:50%;">
          <div>
            <div style="font-weight:900;font-size:18px;color:var(--text);letter-spacing:-.02em">RECON RWA 관리자</div>
            <div class="muted" id="adminWho" style="font-size:12px">-</div>
          </div>
        </div>
        <div class="tagrow" style="flex-wrap:wrap; justify-content:flex-end; gap:8px">
          <a class="btn small" href="deposits.html">입금</a>
          <a class="btn small" href="contracts.html">계약서</a>
          <a class="btn small" href="withdrawals.html">USDT 출금</a>
          <a class="btn small" href="accounting.html">회계</a>
          <a class="btn small" href="token-withdrawals.html">토큰 출금</a>
          <button id="adminLogoutBtn" class="btn small danger" type="button">로그아웃</button>
        </div>
      </div>`;
  }

  async function mountHeader() {
    const mount = document.getElementById("adminHeaderMount");
    if (!mount) return false;

    try {
      // force-cache (HEADER_PATH 의 _v= 쿼리가 cache-buster) — no-store 이면 매 페이지 로드마다 왕복
      const r = await fetch(HEADER_PATH, { cache: "force-cache", credentials: "same-origin" });
      if (!r.ok) throw new Error(`header load failed (${r.status})`);
      mount.innerHTML = await r.text();
      window.AdminI18n?.apply?.(mount);
      bindAdminLangToggle();
      return true;
    } catch (e) {
      console.error("[admin.header] header load failed", e);
      mount.innerHTML = fallbackHeaderHtml();
      window.AdminI18n?.apply?.(mount);
      bindAdminLangToggle();
      showAdminRecovery("관리자 상단 메뉴를 불러오지 못해 기본 헤더로 대체했습니다.", e?.message || "header load failed");
      return false;
    }
  }

  async function loadAdminUser() {
    try {
      const r = await api("/api/admin/auth/me");
      const el = document.getElementById("adminWho");
      if (el) el.textContent = (window.AdminI18n?.translateString?.("로그인: ") || "로그인: ") + (r.username || "admin");
    } catch (e) {
      console.error("[admin.header] loadAdminUser failed", e);
    }
  }

  // 부모 메뉴 뱃지: 자식 카운트 합계 (0 이면 숨김)
  function setParentBadge(id, total) {
    const badge = document.getElementById(id);
    if (!badge) return;
    const n = Number(total || 0);
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.style.display = n > 0 ? "inline-block" : "none";
  }

  async function loadAlertsSummary() {
    try {
      const r = await api("/api/admin/alerts/summary");
      const counts = r?.counts || {};
      const totalPending = Number(r?.total_pending || 0);

      const cDeposits = Number(counts.deposits || 0);
      // (2026-05-07) Token deposits get their own badge, fed by counts.token_deposits.
      //   Previously the "토큰 입금" link had no badge slot and the backend lumped
      //   all deposits into counts.deposits, so token-deposit pending items only
      //   visible on the page weren't reflected in the nav notifications.
      const cTokenDeposits = Number(counts.token_deposits || 0);
      const cContracts = Number(counts.contracts || 0);
      const cWithdrawals = Number(counts.withdrawals || 0);
      const cTokenWithdrawals = Number(counts.token_withdrawals || 0);

      setBadge("depositAlertCount", cDeposits);
      setBadge("tokenDepositAlertCount", cTokenDeposits);
      setBadge("contractAlertCount", cContracts);
      setBadge("withdrawAlertCount", cWithdrawals);
      setBadge("tokenWithdrawAlertCount", cTokenWithdrawals);

      // 부모 메뉴 합계 뱃지 — 거래 메뉴는 4개 자식 합계.
      setParentBadge("tradeParentAlertCount", cDeposits + cTokenDeposits + cWithdrawals + cTokenWithdrawals);
      setParentBadge("accountingParentAlertCount", cContracts);

      updateDocumentTitle(totalPending);

      if (lastTotalPending !== null && totalPending > lastTotalPending && document.visibilityState !== "hidden") {
        const diff = totalPending - lastTotalPending;
        toast(`새 관리자 처리 항목 ${diff}건`, "info");
        playAlertBeep(diff);
      }
      lastTotalPending = totalPending;
      return true;
    } catch (e) {
      console.error("[admin.header] loadAlertsSummary failed", e);
      setBadge("depositAlertCount", 0);
      setBadge("tokenDepositAlertCount", 0);
      setBadge("contractAlertCount", 0);
      setBadge("withdrawAlertCount", 0);
      setBadge("tokenWithdrawAlertCount", 0);
      setParentBadge("tradeParentAlertCount", 0);
      setParentBadge("accountingParentAlertCount", 0);
      updateDocumentTitle(0);
      return false;
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPolling() {
    stopPolling();
    void loadAlertsSummary();

    pollTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void loadAlertsSummary();
    }, POLL_MS);
  }

  // ─────────────────────────────────────────────────────────────────
  // 관리자 지갑 연결 UI (모든 admin 페이지 공통)
  // 헤더 우상단 .admin-top-actions 영역에 인라인 마운트 — 로그아웃 버튼 옆에 배치
  // 데이터 수정은 지정 지갑 연결 시에만 가능
  // ─────────────────────────────────────────────────────────────────
  function ensureWalletPillStyles() {
    if (document.getElementById("adminWalletPillStyles")) return;
    const style = document.createElement("style");
    style.id = "adminWalletPillStyles";
    style.textContent = `
      .admin-top .admin-top-actions { gap: 10px; flex-wrap: nowrap; white-space: nowrap; }
      #adminWalletPill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 14px;
        background: #FFFFFF;
        border: 2px solid #E2E8F0;
        border-radius: 100px;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
        font-family: 'Space Grotesk', -apple-system, sans-serif;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        cursor: pointer;
        user-select: none;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      #adminWalletPill:hover { transform: translateY(-1px); }
      #adminWalletPill.connected {
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        border-color: #059669;
        color: #FFFFFF;
      }
      #adminWalletPill.connected:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
      }
      #adminWalletPill.disconnected {
        background: #FFFFFF;
        border-color: #7C3AED;
        color: #7C3AED;
      }
      #adminWalletPill.disconnected:hover {
        background: rgba(124, 58, 237, 0.08);
      }
      #adminWalletPill .dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: currentColor;
      }
      #adminWalletPill.connected .dot {
        background: #FFFFFF;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
      }
      @media (max-width: 900px) {
        #adminWalletPill { font-size: 11px; padding: 6px 10px; }
        .admin-top .admin-top-actions { gap: 6px; }
      }
      @media (max-width: 600px) {
        #adminWalletPill .pill-label { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderWalletPill() {
    ensureWalletPillStyles();
    // Header 의 .admin-top-actions 영역 안에 mount (logout 버튼 앞)
    const actions = document.querySelector(".admin-top .admin-top-actions");
    let pill = document.getElementById("adminWalletPill");
    if (!pill) {
      pill = document.createElement("button");
      pill.type = "button";
      pill.id = "adminWalletPill";
      pill.title = "관리자 지갑 연결 상태 — 데이터 수정 시 필요";
    }
    // 이미 헤더가 마운트되어 있으면 logout 앞에 삽입, 아직이면 body 에 임시 삽입
    if (actions && pill.parentElement !== actions) {
      const logout = actions.querySelector("#adminLogoutBtn");
      if (logout) actions.insertBefore(pill, logout);
      else actions.appendChild(pill);
    } else if (!actions && !pill.parentElement) {
      document.body.appendChild(pill);  // fallback: header 미장착 시 임시 표시
    }
    const connected = window.AdminWallet?.isConnected?.() || false;
    pill.classList.toggle("connected", connected);
    pill.classList.toggle("disconnected", !connected);
    if (connected) {
      const addr = window.AdminWallet?.getAddress?.() || "";
      pill.innerHTML = `<span class="dot"></span><span class="pill-label">지갑 ${addr.slice(0, 4)}...${addr.slice(-4)}</span>`;
    } else {
      pill.innerHTML = `<span class="dot"></span><span class="pill-label">지갑 연결</span>`;
    }
    pill.onclick = async () => {
      if (window.AdminWallet?.isConnected?.()) {
        if (!confirm("관리자 지갑 연결을 해제하시겠습니까?\n해제 후에는 데이터 수정이 불가능합니다.")) return;
        await window.AdminWallet.disconnect();
        renderWalletPill();
      } else {
        const addr = await window.AdminWallet?.connect?.();
        renderWalletPill();
        if (addr) {
          toast("지갑 연결됨 — 데이터 수정 가능", "good");
        }
      }
    };
  }

  // 지갑 변경 이벤트 감지 → pill 재렌더
  window.addEventListener("admin-wallet-changed", () => renderWalletPill());

  async function doLoadHeader() {
    if (!baseTitle) baseTitle = document.title || "RECON RWA 관리자";
    await mountHeader();
    bindLogout();
    renderWalletPill();  // ★ 관리자 지갑 pill 렌더
    await Promise.allSettled([loadAdminUser(), loadAlertsSummary()]);
    window.AdminI18n?.apply?.();
    startPolling();
    return true;
  }

  async function loadHeader() {
    if (loadPromise) return loadPromise;
    loadPromise = doLoadHeader().finally(() => {
      setTimeout(() => {
        loadPromise = null;
      }, 0);
    });
    return loadPromise;
  }

  window.addEventListener("beforeunload", stopPolling);

  window.AdminHeader = {
    loadHeader,
    stopHeaderRefresh: stopPolling,
  };

  onReady(() => {
    if (document.getElementById("adminHeaderMount")) {
      void loadHeader();
    }
  });
})();
