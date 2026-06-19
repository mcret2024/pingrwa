(() => {
  "use strict";

  const { qs, toast, api, STORAGE, normalizeApiBase, onReady, showAdminRecovery, dismissAdminRecovery } = window.AdminCore;

  // (2026-05-19 v587) OTP 필드 제거 — 운영자 결정. 지갑 화이트리스트가 2-factor.

  // (2026-05-19 v584) 로그인 페이지 — 지갑 화이트리스트 게이트
  //   1) /api/admin/auth/wallet-required 로 백엔드의 화이트리스트 활성 여부 조회
  //   2) 활성 시: 지갑 섹션 노출 + 로그인 버튼 비활성화 + 지갑 연결까지 차단
  //   3) 연결되면: X-Admin-Wallet 헤더 자동 주입하여 /login 호출
  //   4) 백엔드 가드 (admin_auth.php v584) 가 화이트리스트 검사 후 토큰 발급
  const short = (s) => {
    s = String(s || "");
    if (s.length <= 16) return s;
    return s.slice(0, 6) + "..." + s.slice(-6);
  };

  const init = async () => {
    const user = qs("#adminUser");
    const pass = qs("#adminPass");
    const base = qs("#adminApiBase");
    const btn = qs("#adminLoginBtn");
    const baseField = base?.closest(".field");
    const canEditBase = !!(baseField && window.getComputedStyle(baseField).display !== "none");

    // 지갑 게이트 관련 DOM
    const walletSection = qs("#adminWalletSection");
    const walletConnectBtn = qs("#adminWalletConnectBtn");
    const walletConnectLabel = qs("#adminWalletConnectLabel");
    const walletStatus = qs("#adminWalletStatus");
    const walletAddrBox = qs("#adminWalletAddressBox");
    const walletAddrText = qs("#adminWalletAddressText");
    const walletDisconnectBtn = qs("#adminWalletDisconnectBtn");

    if (base) {
      base.value = canEditBase ? (localStorage.getItem(STORAGE.apiBase) || "") : "";
    }
    if (!canEditBase) {
      localStorage.removeItem(STORAGE.apiBase);
    }

    // (2026-05-19 v587) OTP 검증 호출 제거 — 관리자 로그인 흐름에서 OTP 미사용.

    // [지갑 게이트] — 화이트리스트 활성 여부 조회
    let walletRequired = false;
    try {
      const r = await api("/api/admin/auth/wallet-required");
      walletRequired = !!r?.wallet_required;
    } catch (e) {
      // 백엔드가 v584 이전이면 엔드포인트 404 — 게이트 비활성으로 간주 (기존 동작)
      console.warn("[admin.login] wallet-required check failed, assuming optional:", e?.message || e);
    }

    // 지갑 게이트 UI 갱신 — connected 면 connect 버튼 숨기고 주소박스 표시 +
    //   Sign in 버튼 활성. disconnected 면 그 반대.
    const refreshWalletUi = () => {
      const addr = (window.AdminWallet?.getAddress?.() || "").trim();
      const connected = !!addr;
      if (connected) {
        if (walletConnectBtn) walletConnectBtn.style.display = "none";
        if (walletAddrBox) walletAddrBox.classList.remove("hidden");
        if (walletAddrText) walletAddrText.textContent = short(addr);
        if (walletStatus) walletStatus.textContent = "지갑이 연결되었습니다. 로그인을 진행하세요.";
        if (btn) btn.disabled = false;
      } else {
        if (walletConnectBtn) walletConnectBtn.style.display = "";
        if (walletAddrBox) walletAddrBox.classList.add("hidden");
        if (walletStatus) walletStatus.textContent = "관리자 화이트리스트에 등록된 지갑이 필요합니다.";
        if (walletRequired && btn) btn.disabled = true;
      }
    };

    if (walletRequired) {
      // 지갑 섹션 노출
      if (walletSection) walletSection.classList.remove("hidden");
      if (btn) btn.disabled = !window.AdminWallet?.isConnected?.();

      walletConnectBtn?.addEventListener("click", async () => {
        walletConnectBtn.disabled = true;
        if (walletConnectLabel) walletConnectLabel.textContent = "CONNECTING...";
        try {
          const addr = await window.AdminWallet?.connect?.();
          if (!addr) {
            toast("지갑 연결이 취소되었습니다.", "bad");
          }
        } catch (e) {
          toast(e?.message || "지갑 연결 실패", "bad");
        } finally {
          walletConnectBtn.disabled = false;
          if (walletConnectLabel) walletConnectLabel.textContent = "CONNECT PHANTOM WALLET";
          refreshWalletUi();
        }
      });

      walletDisconnectBtn?.addEventListener("click", async () => {
        await window.AdminWallet?.disconnect?.();
        refreshWalletUi();
      });

      // 다른 탭이나 페이지에서 지갑 상태 바뀌면 UI 갱신
      window.addEventListener("admin-wallet-changed", refreshWalletUi);

      refreshWalletUi();
    } else {
      // 화이트리스트 비활성 — 기존 동작 (지갑 섹션 숨김, 로그인 버튼 항상 활성)
      if (walletSection) walletSection.classList.add("hidden");
      if (btn) btn.disabled = false;
    }

    // (2026-05-13 v331) 폼 제출(Enter 키 / 버튼 클릭) 통합 핸들러.
    //   button 이 type="submit" 으로 바뀌어 click 도 form submit 으로
    //   bubble 되므로 form.submit 만 듣고 e.preventDefault() 로 기본 동작
    //   (페이지 새로고침) 차단. 비밀번호 매니저 / Enter 키 / 보조 기술 지원.
    const form = document.getElementById('adminLoginForm');
    const handleSubmit = async () => {
      try {
        const nextBase = normalizeApiBase(base?.value || "");
        if (canEditBase && nextBase) localStorage.setItem(STORAGE.apiBase, nextBase);
        else localStorage.removeItem(STORAGE.apiBase);

        // 지갑 게이트 — 화이트리스트 활성인데 지갑 없으면 즉시 차단
        if (walletRequired) {
          const walletAddr = (window.AdminWallet?.getAddress?.() || "").trim();
          if (!walletAddr) {
            toast("로그인 전에 Phantom 지갑을 연결하세요.", "bad");
            return;
          }
        }

        const username = String(user?.value || "").trim();
        const password = String(pass?.value || "").trim();
        if (!username || !password) {
          toast("아이디/비밀번호를 입력하세요.", "bad");
          return;
        }

        const body = { username, password };

        // 화이트리스트 활성이면 X-Admin-Wallet 헤더 명시적 주입 — admin.core.js
        //   의 auto-injection 은 auth 라우트 (login 포함) 에선 적용 안 됨.
        const loginOpts = { method: "POST", body };
        if (walletRequired) {
          const walletAddr = (window.AdminWallet?.getAddress?.() || "").trim();
          loginOpts.headers = { "X-Admin-Wallet": walletAddr };
        }

        const r = await api("/api/admin/auth/login", loginOpts);

        localStorage.setItem(STORAGE.adminToken, r.token);
        dismissAdminRecovery();
        location.href = "dashboard.html";
      } catch (e) {
        toast(e.message || "로그인 실패", "bad");
      }
    };

    // (v331) 폼 submit 이벤트 — Enter 키와 type="submit" 버튼 클릭 모두 여기로
    //   bubble. 기본 동작(페이지 새로고침) 차단 후 handleSubmit() 호출.
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmit();
      });
    } else {
      // form 없는 fallback — 기존처럼 버튼 클릭에만 반응
      btn?.addEventListener('click', handleSubmit);
    }
  };

  onReady(() => {
    void init().catch((e) => {
      console.error("[admin.login] init failed", e);
      showAdminRecovery("관리자 로그인 페이지를 초기화하지 못했습니다.", e?.message || "login init failed");
    });
  });
})();
