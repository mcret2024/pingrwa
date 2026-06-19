(() => {
  "use strict";

  const SESSION_RETURN_KEY = "rwa_kyc_return_url";

  // (2026-05-12 v297) Operator: '영어 페이지에서 한국어가 절대로 나오지
  //   않게 해라.' All user-facing strings emitted by this script were
  //   hardcoded Korean and bypassed i18n.js (since toast/modal text is
  //   set via textContent, MutationObserver picks it up only if the
  //   exact source string is in the translation map). Use English
  //   source so EN users see English, and EN_SOURCE.ko keys translate
  //   for KO users.
  const L = (en) => {
    try {
      const lang = (window.RwaI18n?.getLang?.() || "en").toLowerCase();
      if (lang === "ko" && window.RwaI18n?.translateString) {
        return window.RwaI18n.translateString(en);
      }
    } catch {}
    return en;
  };

  const qs = (sel, el = document) => el.querySelector(sel);
  const getReturnUrl = () => {
    try {
      const qp = new URLSearchParams(location.search).get("return");
      const saved = localStorage.getItem(SESSION_RETURN_KEY);
      return qp || saved || "index.html";
    } catch {
      return "index.html";
    }
  };

  const saveReturnUrl = () => {
    try {
      const qp = new URLSearchParams(location.search).get("return");
      if (qp) localStorage.setItem(SESSION_RETURN_KEY, qp);
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

  const goNext = () => {
    const ret = encodeURIComponent(getReturnUrl());
    location.href = `kyc-certification.html?return=${ret}`;
  };

  async function init() {
    // (2026-05-18 v536) idempotent 가드 — 옛 HTML 캐시가 동일 스크립트를
    //   두 번 로드해도 (브라우저 직접 + app.js 동적) init 은 1회만 실행.
    if (document.body?.dataset?.kycReadyInit === "1") return;
    if (document.body) document.body.dataset.kycReadyInit = "1";

    saveReturnUrl();

    const C = window.RwaCore;
    if (!C) {
      // RwaCore 미준비 — 가드 플래그도 풀어두어 다음 호출에서 재시도 가능.
      if (document.body) delete document.body.dataset.kycReadyInit;
      console.warn('[kyc-ready] RwaCore not ready — init aborted, will retry on RwaPages call');
      return;
    }

    const backBtn = qs("#kycBackBtn");
    if (backBtn) backBtn.href = getReturnUrl();

    const nameEl = qs("#kycName");
    const birthEl = qs("#kycBirth");
    const saveBtn = qs("#kycSaveBtn");
    const editBtn = qs("#kycEditBtn");
    const okBtn = qs("#kycModalOk");

    if (okBtn) okBtn.addEventListener("click", () => hideModal());

    // (2026-05-18 v543) Edit 토글 — disabled 된 입력을 다시 활성화.
    //   백엔드는 kyc_yn !== 'Y' 인 경우 재저장을 허용한다 (v543 변경).
    const enableEditing = () => {
      if (nameEl) nameEl.disabled = false;
      if (birthEl) birthEl.disabled = false;
      if (saveBtn) saveBtn.textContent = L("Save Changes");
      if (editBtn) editBtn.classList.add("hidden");
    };
    if (editBtn) editBtn.addEventListener("click", () => {
      enableEditing();
      // saved=false 상태로 돌려서 저장 핸들러가 다시 실제 API 를 호출하도록.
      saved = false;
      if (nameEl) nameEl.focus();
    });

    let saved = false;
    // (2026-05-18 v539) 운영자: '필수가 아니더라도 KYC 는 가능해야 한다'.
    //   v537 의 강제 차단 (입력 disable + 다음 단계 진입 차단) 을 해제.
    //   bypass mode 여도 자발적 KYC 진행이 가능하도록 폼은 활성 상태로 두고,
    //   "선택사항" 안내 배너만 표시. 백엔드 짧은 순환도 함께 제거되어
    //   /api/kyc-ready-save 와 /api/kyc-certify 가 실제 데이터를 처리한다.
    let bypassMode = false;

    try {
      const st = await C.api("/api/kyc/status", { method: "GET" });
      bypassMode = (st?.bypassed === true);

      // (2026-05-18 v576) 운영자 보고: didit 검토중 사용자가 kyc-ready.html 에
      //   직접 접근하면 처음부터 다시 입력하는 화면이 나오는 문제. v570 에서
      //   kyc-certification.html 에 "Verification in Progress" 패널을 만들었지만
      //   이전 단계인 kyc-ready 에는 같은 가드가 없었음. 검토 중인 사용자는
      //   기본 정보를 재입력할 필요가 없으므로 (그 정보로 이미 didit 세션이
      //   생성되어 처리 중) certification 페이지로 redirect → 거기 in-progress
      //   패널 또는 폴링 모달이 자동 표시. 입력 폼 노출 자체를 차단해서
      //   운영자가 우려한 "처음부터 다시 진행" 플로우로 빠지지 않도록.
      //
      //   in_review (didit 사람 검토 중) 와 pending (didit 자동 처리 중) 모두
      //   "활성 KYC 세션이 이미 있음" 신호 — step 1 (이름/생년월일 입력) 로
      //   돌아갈 이유 없음. 어느 상태든 certification 페이지가 적절히 처리.
      if (st?.session_state === 'in_review' || st?.session_state === 'pending') {
        const ret = encodeURIComponent(getReturnUrl());
        location.href = `kyc-certification.html?return=${ret}`;
        return;
      }

      if (String(st?.kyc_yn || "N").toUpperCase() === "Y") {
        // 이미 인증 완료된 사용자 — bypass 여부와 무관하게 "완료" 안내.
        showModal(L("KYC verification is already complete."), true);
        if (saveBtn) saveBtn.textContent = L("Continue");
        saved = true;
      }
      // (2026-05-24 v820) 운영자 요청: 'KYC is currently optional' 토스트 제거.
      //   페이지 자체가 자발적 verify 흐름이라 안내 문구 불필요. bypassMode
      //   분기는 유지 (향후 다른 동작 필요 시 활용 가능).
      // else if (bypassMode) {
      //   C.toast(L("KYC is currently optional..."), "info");
      // }

      if (nameEl) nameEl.value = st?.mt_name || "";
      if (birthEl) birthEl.value = st?.mt_birth || "";

      if (st?.mt_name_set && st?.mt_birth_set) {
        saved = true;
        if (nameEl) nameEl.disabled = true;
        if (birthEl) birthEl.disabled = true;
        if (saveBtn) saveBtn.textContent = L("Next Step");
        // (v543) didit 인증 전이면 Edit 버튼 노출 — 사용자가 오타/잘못된 정보를 정정 가능.
        //   kyc_yn === 'Y' (didit 승인 완료) 인 경우엔 Edit 비노출 (영구 잠금).
        if (editBtn && String(st?.kyc_yn || "N").toUpperCase() !== "Y") {
          editBtn.classList.remove("hidden");
        }
      }
    } catch (e) {
      C.toast(e?.message || L("Failed to load KYC status."), "bad");
      location.href = "index.html";
      return;
    }

    if (!saveBtn) return;

    saveBtn.addEventListener("click", async () => {
      if (saved) {
        const continueLabel = L("Continue");
        if ((qs("#kycModal") && !qs("#kycModal").classList.contains("hidden")) && String(saveBtn.textContent || "") === continueLabel) {
          location.href = getReturnUrl();
          return;
        }
        goNext();
        return;
      }

      const name = String(nameEl?.value || "").trim();
      const birth = String(birthEl?.value || "").trim();

      if (!name) return C.toast(L("Please enter your name."), "bad");
      if (!birth) return C.toast(L("Please enter your date of birth."), "bad");

      showModal(L("Saving basic information..."));
      try {
        await C.api("/api/kyc-ready-save", {
          method: "POST",
          body: { mt_name: name, mt_birth: birth }
        });

        hideModal();
        saved = true;
        if (nameEl) nameEl.disabled = true;
        if (birthEl) birthEl.disabled = true;
        saveBtn.textContent = L("Next Step");
        C.toast(L("Basic information saved."), "good");
        goNext();
      } catch (e) {
        hideModal();
        if (e?.data?.status === "already_set") {
          saved = true;
          if (nameEl) nameEl.disabled = true;
          if (birthEl) birthEl.disabled = true;
          saveBtn.textContent = L("Next Step");
          return C.toast(L("Basic information is already saved."), "info");
        }
        C.toast(e?.message || L("Failed to save basic information."), "bad");
      }
    });
  }

  // (2026-05-18 v536) 운영자: 'kyc-ready.html 버튼이 작동하지 않는다'.
  //   원인: 기존 `window.addEventListener("load", init)` 패턴은 load 이벤트가
  //   app.js 의 동적 core.js 로드보다 먼저 발생하면 `window.RwaCore` 가
  //   undefined 라 init 이 조용히 return → 버튼 리스너 미부착 → 클릭 무반응.
  //   다른 페이지(chart/portfolio/funding 등)는 모두 RwaPages 방식으로
  //   통일되어 있어 app.js 가 RwaCore.boot() 직후 호출 — 안전. 본 페이지도
  //   동일 패턴으로 전환.
  //
  //   중복 실행 방지: init 은 멱등하게 작동하지 않을 수 있어 (event listener
  //   중첩 부착 등) _bootedOnce 플래그로 1회만 실행 보장.
  let _bootedOnce = false;
  const _runOnce = async () => {
    if (_bootedOnce) return;
    if (!window.RwaCore) return; // RwaCore 미준비 — RwaPages 경로가 처리할 것
    _bootedOnce = true;
    await init();
  };

  // 정상 경로: app.js 가 RwaCore.boot() 직후 호출 — RwaCore 보장.
  window.RwaPages = window.RwaPages || {};
  window.RwaPages["kyc-ready"] = _runOnce;

  // 안전망: HTML 에서 직접 스크립트를 로드해 RwaPages 등록 없이 동작하던
  //   옛 경로 호환. 이미 load 가 발생했으면 즉시 시도, 아니면 load 대기.
  if (document.readyState === "complete") {
    _runOnce();
  } else {
    window.addEventListener("load", _runOnce, { once: true });
  }
})();
