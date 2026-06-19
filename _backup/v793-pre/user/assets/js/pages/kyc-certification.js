(() => {
  "use strict";

  if (window.__RWA_KYC_CERT_INITED__) return;
  window.__RWA_KYC_CERT_INITED__ = true;

  const SESSION_KEY = "rwa_kyc_session_id";
  const RETURN_KEY = "rwa_kyc_return_url";
  const RETRY_STUCK_KEY = "rwa_kyc_retry_stuck_sec";
  const RETRY_REVIEW_KEY = "rwa_kyc_retry_review_sec";

  // (2026-05-12 v297) Operator: '영어 페이지에서 한국어가 절대로 나오지
  //   않게 해라.' All toast / modal / button-label strings were
  //   hardcoded Korean. Replaced with English source + L() helper that
  //   pulls KO translation from window.RwaI18n.translateString when
  //   user locale is KO. The DOM-injected status messages also flow
  //   through L() so neither EN nor KO sees mixed languages.
  const L = (en) => {
    try {
      const lang = (window.RwaI18n?.getLang?.() || "en").toLowerCase();
      if (lang === "ko" && window.RwaI18n?.translateString) {
        return window.RwaI18n.translateString(en);
      }
    } catch {}
    return en;
  };

  // Button-label sentinel for "Complete" — used in string compare at
  //   click time. Recompute per call so locale change between page
  //   loads (and the rare in-session flip) doesn't cause stale match.
  const TXT_COMPLETE = () => L("Complete");
  const TXT_START = () => L("Start Verification");

  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const getReturnUrl = () => {
    try {
      const qp = new URLSearchParams(location.search).get("return");
      const saved = localStorage.getItem(RETURN_KEY);
      return qp || saved || "index.html";
    } catch {
      return "index.html";
    }
  };

  const saveReturnUrl = () => {
    try {
      const qp = new URLSearchParams(location.search).get("return");
      if (qp) localStorage.setItem(RETURN_KEY, qp);
    } catch {}
  };

  const showModal = (text, okVisible = false) => {
    const modal = qs("#kycModal");
    const textEl = qs("#kycModalText");
    const okBtn = qs("#kycModalOk");
    if (!modal || !textEl || !okBtn) return;

    textEl.textContent = text || "";
    okBtn.classList.toggle("hidden", !okVisible);
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  };

  const hideModal = () => {
    const modal = qs("#kycModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  };

  const loadRetryHints = () => ({
    stuck: Number(localStorage.getItem(RETRY_STUCK_KEY) || 60),
    review: Number(localStorage.getItem(RETRY_REVIEW_KEY) || 90)
  });

  const saveRetryHints = (stuck, review) => {
    try {
      if (Number.isFinite(Number(stuck)) && Number(stuck) > 0) {
        localStorage.setItem(RETRY_STUCK_KEY, String(Math.floor(Number(stuck))));
      }
      if (Number.isFinite(Number(review)) && Number(review) > 0) {
        localStorage.setItem(RETRY_REVIEW_KEY, String(Math.floor(Number(review))));
      }
    } catch {}
  };

  const clearSession = () => {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  };

  const doneAndGo = () => {
    clearSession();
    const ret = getReturnUrl();
    location.href = ret;
  };

  function bindOnce(el, key, eventName, handler) {
    if (!el) return;
    const k = `bound_${key}`;
    if (el.dataset[k] === "1") return;
    el.dataset[k] = "1";
    el.addEventListener(eventName, handler);
  }

  // (2026-05-22 v772) Phantom 인앱 브라우저 감지.
  // 운영자 보고: '팬텀 익스플로러에서 인증 시작 버튼이 작동하지 않는다.'
  // 원인: Phantom 인앱 WebView 는 KYC 제공사 (didit.me) 의:
  //   - Camera API (getUserMedia) 권한 처리 불완전
  //   - SDK iframe / popup 흐름 미지원
  //   - 외부 navigation 후 cookie/session 손실
  // 해결: in-app browser 감지 시 사용자에게 외부 브라우저로 열도록 안내.
  // (window.open 으로 escape 시도는 Phantom 가 차단 — 사용자에게 URL 복사
  //  + 외부 브라우저 열기 안내가 가장 신뢰성 높음.)
  const isInAppBrowser = () => {
    try {
      const ua = String(navigator.userAgent || "").toLowerCase();
      // Phantom 인앱 브라우저는 userAgent 에 'Phantom' 또는 'PhantomBrowser'
      // 포함. 다른 wallet 인앱 (MetaMask 'MetaMaskMobile', Trust 'Trust',
      // Coinbase 'CoinbaseWallet') 도 함께 감지.
      if (/phantom/i.test(ua)) return { kind: 'phantom', ua };
      if (/metamaskmobile/i.test(ua)) return { kind: 'metamask', ua };
      if (/trust\b/i.test(ua)) return { kind: 'trust', ua };
      if (/coinbasewallet/i.test(ua)) return { kind: 'coinbase', ua };
      // 카카오톡 인앱 브라우저 (Android KAKAOTALK / iOS KAKAOTALK)
      if (/kakaotalk/i.test(ua)) return { kind: 'kakao', ua };
      // 라인 인앱
      if (/line\b/i.test(ua)) return { kind: 'line', ua };
      return null;
    } catch { return null; }
  };

  // KYC 시작 전 in-app browser 감지 → 외부 브라우저 안내 UI.
  // 반환값:
  //   true  → 사용자가 "취소" 선택 (KYC 흐름 중단)
  //   false → in-app 아님 (정상 진행)
  const handleInAppBrowserGate = () => {
    const detected = isInAppBrowser();
    if (!detected) return false;

    const url = location.href;
    const kindName = ({
      phantom: 'Phantom',
      metamask: 'MetaMask',
      trust: 'Trust Wallet',
      coinbase: 'Coinbase Wallet',
      kakao: 'KakaoTalk',
      line: 'LINE'
    })[detected.kind] || detected.kind;

    const msg =
      L(`${kindName} in-app browser does not support the camera and document scan required for identity verification.`) + "\n\n" +
      L("Please open this page in a standard browser (Chrome / Safari / Samsung Internet) to continue.") + "\n\n" +
      L("URL:") + " " + url;

    // 모달로 안내 + 'URL 복사' 액션.
    showModal(msg, true);

    // URL 자동 클립보드 복사 시도 — 사용자 편의.
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          () => {
            try {
              if (window.RwaCore?.toast) window.RwaCore.toast(L("URL copied to clipboard."), "good");
            } catch {}
          },
          () => {}
        );
      }
    } catch {}

    return true;
  };

  async function init() {
    if (document.body?.dataset?.kycCertInit === "1") return;
    if (document.body) document.body.dataset.kycCertInit = "1";

    saveReturnUrl();

    const C = window.RwaCore;
    if (!C) return;

    await C.boot().catch(() => {});

    const nameEl = qs("#kycName");
    const birthEl = qs("#kycBirth");
    const startBtn = qs("#kycStartBtn");
    const okBtn = qs("#kycModalOk");
    const doneBox = qs("#kycDoneBox");
    const docBtns = qsa("[data-doc]");

    // (2026-05-22 v772) 페이지 로드 시 in-app browser 감지 → 배너 표시.
    //   사용자가 START VERIFICATION 누르기 전에 미리 알림. 'Copy URL' 버튼으로
    //   클립보드 복사 가능 → 일반 브라우저에서 paste 후 진행.
    try {
      const inAppDetected = isInAppBrowser();
      const banner = qs("#kycInAppBrowserBanner");
      const copyBtn = qs("#kycInAppCopyUrlBtn");
      if (inAppDetected && banner) {
        banner.classList.remove("hidden");
        bindOnce(copyBtn, "copy-url", "click", async () => {
          const url = location.href;
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(url);
              C.toast(L("URL copied to clipboard."), "good");
            } else {
              // Fallback — 옛 textarea + execCommand 방식
              const ta = document.createElement("textarea");
              ta.value = url;
              ta.style.position = "fixed";
              ta.style.opacity = "0";
              document.body.appendChild(ta);
              ta.select();
              try { document.execCommand("copy"); C.toast(L("URL copied to clipboard."), "good"); }
              catch { C.toast(url, "info"); }
              finally { document.body.removeChild(ta); }
            }
          } catch (e) {
            // 복사 실패 시 URL 그대로 보여줌
            C.toast(url, "info");
          }
        });
      }
    } catch (_) {}

    let docType = "";
    let verifying = false;
    let submitting = false;
    let pollTimer = null;
    let pollInFlight = false;

    const setStartBtnState = (disabled, text) => {
      if (!startBtn) return;
      startBtn.disabled = !!disabled;
      if (typeof text === "string") startBtn.textContent = text;
    };

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      pollInFlight = false;
      verifying = false;
    };

    const setDoc = (v) => {
      docType = String(v || "");
      docBtns.forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-doc") === docType);
      });
    };

    docBtns.forEach((btn) => {
      bindOnce(btn, "docclick", "click", () => {
        if (verifying || submitting) return;
        setDoc(btn.getAttribute("data-doc"));
      });
    });

    bindOnce(okBtn, "ok", "click", () => {
      hideModal();
      const txt = String(qs("#kycModalText")?.textContent || "");
      // Detect 'complete' marker in either language so the user gets
      //   navigated forward after acknowledging the success modal.
      if (txt.includes("완료") || /\bcomplete(d)?\b/i.test(txt)) doneAndGo();
    });

    // (2026-05-18 v570) 백엔드 주도 'in_review' UI. didit 가 검토 중이거나
    //   세션이 pending 인데 last decision 이 review-like 면 폼을 숨기고
    //   "Verification in Progress" 패널만 노출. 30 초마다 자동 재확인 (승인
    //   되면 새로고침).
    const showReviewPanel = (info) => {
      const panel = qs("#kycInProgressPanel");
      const form = qs("#kycFormSection");
      if (form) form.classList.add("hidden");
      if (panel) panel.classList.remove("hidden");
      const statusEl = qs("#kycReviewProviderStatus");
      if (statusEl) statusEl.textContent = info?.didit_status || L("Under review");
      const sidEl = qs("#kycReviewSessionId");
      if (sidEl) sidEl.textContent = info?.session_id || "—";
      const overdueEl = qs("#kycReviewOverdueNotice");
      if (overdueEl) overdueEl.classList.toggle("hidden", !info?.review_overdue);

      // Persist sessionId so the existing poll path can act on it.
      if (info?.session_id) {
        try { localStorage.setItem(SESSION_KEY, String(info.session_id)); } catch {}
      }

      // Hook the manual refresh button (idempotent).
      const refreshBtn = qs("#kycReviewRefreshBtn");
      bindOnce(refreshBtn, "rev", "click", () => location.reload());

      // Slow background poll — 30 s. Once didit final-approves, the poll
      //   returns status='succ' and we reload to show the green panel.
      stopPolling();
      verifying = true;
      const pollReviewOnce = async () => {
        if (pollInFlight) return;
        pollInFlight = true;
        try {
          const r = await C.api("/api/kyc-certify/poll", {
            method: "POST",
            body: { session_id: info?.session_id || localStorage.getItem(SESSION_KEY) || "" }
          });
          if (r?.status === "succ") {
            stopPolling();
            location.reload();
          } else if (r?.status === "in_review" && statusEl) {
            statusEl.textContent = r.didit_status || L("Under review");
            if (overdueEl) overdueEl.classList.toggle("hidden", !r.review_overdue);
          }
        } catch (e) {
          const status = e?.data?.status || "";
          if (["mismatch_birth", "mismatch_name", "kyc_status_not_approved", "kyc_no_credits"].includes(status)) {
            // 거절 — 폼으로 되돌려서 재시도 가능하게.
            stopPolling();
            clearSession();
            if (panel) panel.classList.add("hidden");
            if (form) form.classList.remove("hidden");
            let msg = L("KYC verification was not completed.");
            if (status === "mismatch_birth") msg = L("Date of birth does not match. Please verify your basic information.");
            if (status === "mismatch_name") msg = L("Name does not match. Please verify your basic information.");
            if (status === "kyc_status_not_approved") msg = L("Verification was not approved. Please try again.");
            if (status === "kyc_no_credits") msg = L("KYC provider credits are insufficient. Please contact the administrator.");
            showModal(msg, true);
          }
        } finally {
          pollInFlight = false;
        }
      };
      // 즉시 1회 — 'pending row 인데 last decision 이 이미 Approved' 같은
      //   엣지 케이스를 30 초 기다리지 않고 바로 해결.
      pollReviewOnce();
      pollTimer = setInterval(pollReviewOnce, 30000);
    };

    // (2026-05-19 v582) 거부 상태 패널 — kyc_status 가 terminal 실패 키이고
    //   활성 세션이 없을 때 표시. 사용자가 didit 에서 거부된 후 페이지로
    //   돌아오면 폼 대신 이 카드로 거부 사실 + 사유 + 신청일/거부일 + 재제출
    //   안내. 재제출 버튼은 kyc_status 별로 다르게:
    //     mismatch_name / mismatch_birth  → kyc-ready.html 로 보내서 정보 수정
    //     kyc_no_credits                  → 운영자 문의 (action 비활성)
    //     kyc_status_not_approved / rejected → 폼 노출, 새 didit 세션 시작
    const REJECT_KEYS_SET = new Set([
      'kyc_status_not_approved',
      'mismatch_name',
      'mismatch_birth',
      'kyc_no_credits',
      'rejected',
    ]);

    const fmtDateTime = (raw) => {
      if (!raw) return '—';
      try {
        const d = new Date(String(raw).replace(' ', 'T') + (String(raw).includes('Z') ? '' : 'Z'));
        if (Number.isNaN(d.getTime())) return String(raw);
        return d.toLocaleString(undefined, {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false
        });
      } catch { return String(raw); }
    };

    const showRejectedPanel = (st) => {
      const panel = qs("#kycRejectedPanel");
      const form = qs("#kycFormSection");
      if (form) form.classList.add("hidden");
      if (panel) panel.classList.remove("hidden");

      const ks = String(st?.kyc_status || '').toLowerCase();

      // 사유별 메시지 + reason 라벨 + 액션 버튼 라벨/동작
      let msg = L("Your identity verification was not approved by our verification provider. Please review the details below and resubmit with the correct information.");
      let reason = ks || L("Not approved");
      let actionLabel = L("Resubmit");
      let actionMode = 'resubmit'; // 'resubmit' | 'edit_info' | 'contact'

      if (ks === 'mismatch_name') {
        msg = L("Your submitted name didn't match the name extracted from your ID document. Please correct your basic information and resubmit.");
        reason = L("Name didn't match the ID document");
        actionLabel = L("Edit Info");
        actionMode = 'edit_info';
      } else if (ks === 'mismatch_birth') {
        msg = L("Your submitted date of birth didn't match the value extracted from your ID document. Please correct your basic information and resubmit.");
        reason = L("Date of birth didn't match the ID document");
        actionLabel = L("Edit Info");
        actionMode = 'edit_info';
      } else if (ks === 'kyc_no_credits') {
        msg = L("Our verification provider's credits are exhausted and your submission could not be processed. Please contact support.");
        reason = L("Provider credits exhausted");
        actionLabel = L("Contact Support");
        actionMode = 'contact';
      } else if (st?.latest_session_fail_reason) {
        // 백엔드 fail_reason 이 있으면 부가 표시 (예: 'declined', 'timeout')
        reason = String(st.latest_session_fail_reason);
      }

      const msgEl = qs("#kycRejectMessage");
      if (msgEl) msgEl.textContent = msg;
      const reasonEl = qs("#kycRejectReason");
      if (reasonEl) reasonEl.textContent = reason;
      const submittedEl = qs("#kycRejectSubmitted");
      if (submittedEl) submittedEl.textContent = fmtDateTime(st?.latest_session_submitted_at);
      const decidedEl = qs("#kycRejectDecided");
      if (decidedEl) decidedEl.textContent = fmtDateTime(st?.latest_session_decided_at);
      const sidEl = qs("#kycRejectSessionId");
      if (sidEl) sidEl.textContent = st?.latest_session_id || '—';

      const actionBtn = qs("#kycRejectActionBtn");
      if (actionBtn) {
        actionBtn.textContent = actionLabel;
        actionBtn.disabled = (actionMode === 'contact');
        if (actionMode === 'edit_info') {
          actionBtn.onclick = () => {
            location.href = `kyc-ready.html?return=${encodeURIComponent(getReturnUrl())}`;
          };
        } else if (actionMode === 'resubmit') {
          // 거부 카드 닫고 폼 노출 → 사용자가 국가/문서 선택 후 Start Verification
          //   누르면 /api/kyc-certify 가 새 세션 생성 (UPDATE users SET
          //   kyc_status='pending' WHERE address=?) — 자동으로 거부 상태 청산.
          actionBtn.onclick = () => {
            if (panel) panel.classList.add("hidden");
            if (form) form.classList.remove("hidden");
            clearSession();
          };
        } else {
          actionBtn.onclick = (e) => { e.preventDefault(); return false; };
        }
      }
    };

    try {
      const st = await C.api("/api/kyc/status", { method: "GET" });

      // (2026-05-18 v539) 운영자: '필수가 아니더라도 KYC 는 가능해야 한다'.
      //   v537 의 강제 redirect 를 제거. bypass mode 여도 사용자가 자발적
      //   verify 를 진행할 수 있도록 정상 흐름을 유지. 안내만 toast 로 표시.
      if (st?.bypassed === true && String(st?.kyc_yn || "N").toUpperCase() !== "Y") {
        C.toast(L("KYC is currently optional. You may proceed with voluntary verification."), "info");
      }

      if (!st?.mt_name_set || !st?.mt_birth_set) {
        C.toast(L("Please enter your basic information first."), "bad");
        location.href = `kyc-ready.html?return=${encodeURIComponent(getReturnUrl())}`;
        return;
      }

      if (nameEl) nameEl.value = st?.mt_name || "";
      if (birthEl) birthEl.value = st?.mt_birth || "";

      if (String(st?.kyc_yn || "N").toUpperCase() === "Y") {
        if (doneBox) doneBox.classList.remove("hidden");
        setStartBtnState(false, TXT_COMPLETE());
        // 인증 완료자에게는 폼이 보일 필요 없음.
        const form = qs("#kycFormSection");
        if (form) {
          // 단, doneBox 는 form 내부에 있어 통째로 숨기면 안 됨 → 폼 내부의
          //   국가/문서 카드만 따로 숨기는 대신 폼 자체는 유지 + start 버튼만
          //   "Complete" 로 두기 (기존 v569 동작). 별도 작업 불필요.
        }
        return;
      }

      // (v570) 활성 세션이 검토 중이면 즉시 인-리뷰 패널로 전환.
      if (st?.session_state === "in_review") {
        showReviewPanel({
          didit_status: st.session_didit_status,
          session_id: st.session_id,
          review_overdue: false,
        });
        return;
      }

      // (v582) 거부 상태 — 활성 세션 없음 + kyc_status 가 terminal 실패 키.
      //   거부 카드로 진입. 새 didit 세션이 만들어지면 kyc_status='pending'
      //   으로 덮어쓰여 자동 청산되므로, 사용자가 [재제출] 클릭하면 폼 노출 →
      //   /api/kyc-certify 호출 → 정상 흐름 복귀.
      if (!st?.session_state && REJECT_KEYS_SET.has(String(st?.kyc_status || '').toLowerCase())) {
        showRejectedPanel(st);
        return;
      }

      // session_state === 'pending' & sessionId 가 서버에 있는데 로컬에는
      //   없으면 (다른 디바이스, 캐시 클리어) 복구. 아래 currentSession 분기가
      //   정상 폴링을 이어받음.
      if (st?.session_state === "pending" && st?.session_id) {
        try { localStorage.setItem(SESSION_KEY, String(st.session_id)); } catch {}
      }
    } catch (e) {
      C.toast(e?.message || L("Failed to load KYC information."), "bad");
      location.href = "index.html";
      return;
    }

    const pollOnce = async () => {
      const sessionId = localStorage.getItem(SESSION_KEY) || "";
      if (!sessionId) return;
      if (pollInFlight) return;

      pollInFlight = true;

      try {
        const r = await C.api("/api/kyc-certify/poll", {
          method: "POST",
          body: { session_id: sessionId }
        });

        if (r?.status === "pending") {
          const { stuck, review } = loadRetryHints();
          const statusLabel = r?.didit_status || L("In Progress");
          // Build the multi-line status message via L() so each
          //   fragment can be translated independently.
          const lines = [
            L("Verifying your authentication result."),
            L("Please wait a moment."),
            "",
            `${L("Current status:")} ${statusLabel}`,
            "",
            L("If the not-started state persists, please retry after about {sec} seconds.").replace("{sec}", String(stuck)),
            L("If the review state persists, please retry after about {sec} seconds.").replace("{sec}", String(review)),
          ];
          showModal(lines.join("\n"), false);
          verifying = true;
          return;
        }

        // (2026-05-18 v570) didit 가 사람 검토에 회부 — 모달 닫고 폼 숨기고
        //   "Verification in Progress" 패널로 전환. 30 초 슬로우 폴링이
        //   백그라운드에서 final approval / decline 을 감지.
        if (r?.status === "in_review") {
          stopPolling();
          hideModal();
          showReviewPanel({
            didit_status: r.didit_status,
            session_id: r.session_id,
            review_overdue: !!r.review_overdue,
          });
          return;
        }

        if (r?.status === "succ") {
          stopPolling();
          clearSession();
          if (doneBox) doneBox.classList.remove("hidden");
          setStartBtnState(false, TXT_COMPLETE());
          showModal(L("KYC verification completed."), true);
          return;
        }
      } catch (e) {
        const status = e?.data?.status || "";

        if (["mismatch_birth", "mismatch_name", "kyc_status_not_approved", "kyc_no_credits"].includes(status)) {
          stopPolling();
          clearSession();

          let msg = L("KYC verification was not completed.");
          if (status === "mismatch_birth") msg = L("Date of birth does not match. Please verify your basic information.");
          if (status === "mismatch_name") msg = L("Name does not match. Please verify your basic information.");
          if (status === "kyc_status_not_approved") msg = L("Verification was not approved. Please try again.");
          if (status === "kyc_no_credits") msg = L("KYC provider credits are insufficient. Please contact the administrator.");

          showModal(msg, true);
          return;
        }

        if (status === "missing_session_id") {
          stopPolling();
          clearSession();
          hideModal();
          setStartBtnState(false, TXT_START());
          return;
        }
      } finally {
        pollInFlight = false;
      }
    };

    const startPolling = async () => {
      stopPolling();
      verifying = true;
      showModal(L("Verifying your authentication result."), false);
      await pollOnce();
      if (verifying) {
        pollTimer = setInterval(pollOnce, 2500);
      }
    };

    const currentSession = localStorage.getItem(SESSION_KEY) || "";
    if (currentSession) {
      setStartBtnState(true, L("Checking verification..."));
      await startPolling();
      if (!verifying) {
        setStartBtnState(false, TXT_START());
      }
    }

    if (!startBtn) return;

    bindOnce(startBtn, "start", "click", async () => {
      const isDone = String(startBtn.textContent || "") === TXT_COMPLETE();
      if (isDone) {
        doneAndGo();
        return;
      }

      if (verifying || submitting) return;

      // (2026-05-22 v772) Phantom / 기타 wallet 인앱 브라우저 차단.
      //   인앱 WebView 는 didit.me 의 Camera/ID scan 흐름 미지원 → 사용자에게
      //   외부 브라우저로 열도록 안내. KYC 흐름 진입 자체를 차단.
      if (handleInAppBrowserGate()) return;

      // (2026-05-18 v543) 국가 선택 의무화 — 운영자: '유저는 국가를 먼저 선택
      //   해야 한다'. 국가 미선택 시 doc type 버튼도 disabled 라서 docType
      //   체크 전에 country 체크가 먼저 실패하게 된다.
      const countryEl = qs("#kycCountry");
      const country = String(countryEl?.value || "").trim();
      if (!country) {
        C.toast(L("Please select your country first."), "bad");
        return;
      }
      if (!docType) {
        C.toast(L("Please select an ID document type."), "bad");
        return;
      }

      submitting = true;
      setStartBtnState(true, L("Processing..."));
      showModal(L("Opening the verification window..."), false);

      try {
        const r = await C.api("/api/kyc-certify", {
          method: "POST",
          // (v543) country 도 함께 전송. 백엔드는 현재 무시 (didit 가 자동 인식)
          //   하지만 audit / 향후 didit country hint 지원에 대비.
          body: { document_type: docType, country: country }
        });

        if (r?.status === "succ") {
          submitting = false;
          hideModal();
          if (doneBox) doneBox.classList.remove("hidden");
          setStartBtnState(false, TXT_COMPLETE());
          showModal(L("KYC verification completed."), true);
          return;
        }

        saveRetryHints(r?.retry_after_sec_not_started, r?.retry_after_sec_review);
        localStorage.setItem(SESSION_KEY, String(r.session_id || ""));

        if (!r?.session_url) throw new Error("session_url missing");

        location.href = r.session_url;
      } catch (e) {
        submitting = false;
        hideModal();
        setStartBtnState(false, TXT_START());

        const status = e?.data?.status || "";
        if (status === "busy_try_again") {
          C.toast(L("Please try again in a moment."), "bad");
          return;
        }
        if (status === "need_basic_info") {
          C.toast(L("Please enter your basic information first."), "bad");
          location.href = `kyc-ready.html?return=${encodeURIComponent(getReturnUrl())}`;
          return;
        }
        // (2026-05-18 v549) didit 미설정 — admin 액션이 필요하다는 점을 명확히
        //   알리고, '건너뛰기' 가 아니라 '관리자에게 문의' 로 안내. KYC 가
        //   필수가 아닌 모드에서도 사용자는 자발적으로 verify 를 시도할 권리가
        //   있어 단순히 모달로 막지 않는다.
        if (status === "kyc_not_configured") {
          showModal(
            L("KYC verification service has not been configured by the administrator yet.")
            + "\n\n"
            + L("Please contact support to enable identity verification."),
            true
          );
          return;
        }

        C.toast(e?.message || L("Failed to start KYC."), "bad");
      }
    });
  }

  // (2026-05-18 v536) RwaCore 레이스 컨디션 회피 — app.js 가 RwaCore.boot()
  //   직후 호출하는 RwaPages 경로를 정상 경로로 사용. 옛 load 리스너는
  //   안전망으로 유지하되 RwaCore 미준비 시 무동작.
  const _runOnce = async () => {
    if (!window.RwaCore) return; // RwaPages 경로가 처리할 것
    await init();
  };
  window.RwaPages = window.RwaPages || {};
  window.RwaPages["kyc-certification"] = _runOnce;
  if (document.readyState === "complete") {
    _runOnce();
  } else {
    window.addEventListener("load", _runOnce, { once: true });
  }
})();