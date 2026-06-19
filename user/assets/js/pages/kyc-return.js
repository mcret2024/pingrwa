(() => {
  "use strict";

  const SESSION_KEY = "rwa_kyc_session_id";
  const RETURN_KEY = "rwa_kyc_return_url";
  // (2026-05-23 v799) KYC handoff 토큰 sessionStorage 키 — core.js 와 동일.
  //   didit.me 에서 돌아온 사용자가 핸드오프 모드였다면 토큰을 보존해
  //   kyc-certification.html 진입 시 가드 우회되도록 함.
  const HANDOFF_TOKEN_SS_KEY = "rwa_kyc_handoff_token";

  const qs = (sel, el = document) => el.querySelector(sel);

  // (v799) 핸드오프 토큰을 sessionStorage 에서 읽어 URL 에 포함한 redirect URL 생성.
  //   토큰이 없거나 무효 형식이면 토큰 없이 redirect (일반 흐름).
  const buildKycCertUrl = (ret) => {
    let path = `kyc-certification.html?return=${encodeURIComponent(ret)}`;
    try {
      const token = String(sessionStorage.getItem(HANDOFF_TOKEN_SS_KEY) || "").trim();
      if (token && /^[a-f0-9]{32,128}$/i.test(token)) {
        path += `&kyc_token=${encodeURIComponent(token)}`;
      }
    } catch (_) {}
    return path;
  };

  async function init() {
    const C = window.RwaCore;
    if (C?.boot) await C.boot().catch(() => {});

    let sid = "";
    try {
      const sp = new URLSearchParams(location.search || "");
      sid = String(
        sp.get("verificationSessionId") ||
        sp.get("verificationSessionID") ||
        sp.get("verification_session_id") ||
        sp.get("session_id") ||
        ""
      ).trim();
    } catch {}

    if (sid) {
      try { localStorage.setItem(SESSION_KEY, sid); } catch {}
    }

    const btn = qs("#kycReturnBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        const ret = localStorage.getItem(RETURN_KEY) || "index.html";
        location.href = buildKycCertUrl(ret);
      });
    }

    setTimeout(() => {
      const ret = localStorage.getItem(RETURN_KEY) || "index.html";
      location.href = buildKycCertUrl(ret);
    }, 1200);
  }

  window.addEventListener("load", init);
})();
