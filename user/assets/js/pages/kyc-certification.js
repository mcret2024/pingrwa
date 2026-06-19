(() => {
  "use strict";

  // (2026-05-23 v806) v798-v805 의 디버그 빨간 배지 + 글로벌 에러 banner 제거.
  //   KYC 핸드오프 흐름이 정상 작동 검증되어 진단 도구 불필요.
  //   관련 history: v798 (배지), v800 (에러 catcher).

  // ════════════════════════════════════════════════════════════════════
  // (2026-05-23 v802) EMERGENCY BOOTSTRAP — RwaPages 의존 제거.
  //
  // ChatGPT 외부 분석으로 발견된 두 가지 critical 문제:
  //   #1) disabled button 은 click 이벤트 자체가 발생 안 함. 기존 KYC 세션이
  //       localStorage 에 남아있으면 init() 이 setStartBtnState(true, "Checking...")
  //       호출하여 startBtn 을 disabled 시킴 → 클릭 무반응.
  //   #2) app.js 가 OTP 가드 등에서 early return 하면 RwaPages 의 page function
  //       (init) 자체가 호출 안 됨. v801 의 bindCriticalButtonsEarly 도 실행 안 됨.
  //
  // 해결: 이 블록은 IIFE 즉시 실행 시점에 동작. RwaPages, RwaCore, init() 의존
  //   없음. 인앱 브라우저 감지 시:
  //   1) localStorage 의 rwa_kyc_session_id 즉시 삭제 (polling lock 방지)
  //   2) DOMContentLoaded 후 critical 버튼 (배너 + Start) 에 click 핸들러 직접 부착
  //   3) MutationObserver 로 startBtn.disabled 자동 false 유지 (인앱 한정)
  //   4) document capture listener 보강
  // ════════════════════════════════════════════════════════════════════
  (() => {
    try {
      const ua = String(navigator.userAgent || "").toLowerCase();
      // (v813) Phantom 제거 — 직접 KYC 가능. 다른 인앱만 emergency bootstrap.
      const isInApp = /metamaskmobile|trust\b|coinbasewallet|kakaotalk|line\b/.test(ua);
      if (!isInApp) return;

      // 1) 기존 세션 클리어 — polling 진입으로 인한 disabled 잠금 방지
      try { localStorage.removeItem('rwa_kyc_session_id'); } catch (_) {}

      // 인앱용 핸드오프 모달 트리거 — RwaCore 없이도 작동하도록 최소 구현.
      // (2026-05-23 v808) v802 의 클릭 시 진단 alert 제거 — 흐름 정상 작동
      //   확인됨. 실패 케이스는 모달의 errBox 에 표시되므로 alert 불필요.
      const earlyTriggerHandoff = (/* source */) => {
        try {
          if (typeof window.__rwaPopulateHandoffModal === 'function') {
            window.__rwaPopulateHandoffModal('');
          } else {
            // RwaCore 가 아직 안 떴으면 200ms 간격으로 최대 5초 재시도
            let tries = 0;
            const tick = () => {
              tries++;
              if (typeof window.__rwaPopulateHandoffModal === 'function') {
                window.__rwaPopulateHandoffModal('');
                return;
              }
              if (tries > 25) {
                // 5초 후에도 RwaCore 미준비 — 매우 드문 케이스. 사용자에게 안내.
                try {
                  if (window.RwaCore?.toast) {
                    window.RwaCore.toast('KYC handoff is loading slowly. Please refresh if it does not appear.', 'info');
                  }
                } catch (_) {}
                return;
              }
              setTimeout(tick, 200);
            };
            setTimeout(tick, 200);
          }
        } catch (e) {
          try { console.error('[kyc-handoff] earlyTriggerHandoff error:', e); } catch (_) {}
        }
      };

      const bindButtonsNow = () => {
        // Generate Secure Link 배너 버튼
        const copyBtn = document.getElementById("kycInAppCopyUrlBtn");
        if (copyBtn && !copyBtn.dataset.bound_v802) {
          copyBtn.dataset.bound_v802 = '1';
          try { copyBtn.style.cursor = 'pointer'; } catch (_) {}
          try {
            const span = copyBtn.querySelector('span');
            if (span) span.style.pointerEvents = 'none';
          } catch (_) {}
          const h = (ev) => {
            if (ev) try { ev.preventDefault(); } catch (_) {}
            earlyTriggerHandoff('Generate Secure Link');
          };
          copyBtn.addEventListener('click', h);
          copyBtn.addEventListener('touchend', h);
          copyBtn.addEventListener('pointerup', h);
          try { copyBtn.onclick = h; } catch (_) {}
        }

        // Start Verification 버튼
        const startBtn = document.getElementById("kycStartBtn");
        if (startBtn && !startBtn.dataset.bound_v802) {
          startBtn.dataset.bound_v802 = '1';
          // 즉시 disabled 해제 (이미 disabled 면)
          try { startBtn.disabled = false; startBtn.removeAttribute('disabled'); } catch (_) {}
          try { startBtn.style.cursor = 'pointer'; } catch (_) {}
          const h = (ev) => {
            if (ev) try { ev.preventDefault(); } catch (_) {}
            earlyTriggerHandoff('Start Verification');
          };
          startBtn.addEventListener('click', h);
          startBtn.addEventListener('touchend', h);
          startBtn.addEventListener('pointerup', h);
          try { startBtn.onclick = h; } catch (_) {}
        }

        // 배너 자체 unhide (CSS 의 .hidden 제거)
        const banner = document.getElementById("kycInAppBrowserBanner");
        if (banner) banner.classList.remove('hidden');

        // 배너 버튼 라벨 변경
        try {
          if (copyBtn) {
            const span = copyBtn.querySelector('span');
            if (span && span.textContent !== 'Generate Secure Link' && span.textContent !== '보안 링크 생성') {
              const lang = String(localStorage.getItem('rwa_lang_user_v1') || 'en').toLowerCase();
              span.textContent = (lang === 'ko') ? '보안 링크 생성' : 'Generate Secure Link';
            }
          }
        } catch (_) {}
      };

      // DOM ready 후 즉시 바인딩 + retry (DOM elements 늦게 생성될 수 있음)
      const ensureBindings = () => {
        bindButtonsNow();
        // 추가 retry — late DOM 추가 / SPA 리하이드레이션 대응
        let retries = 0;
        const retry = setInterval(() => {
          retries++;
          bindButtonsNow();
          if (retries > 20) clearInterval(retry); // 4초 (200ms × 20)
        }, 200);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureBindings, { once: true });
      } else {
        ensureBindings();
      }

      // 3) MutationObserver — startBtn.disabled 자동 해제 (인앱 한정)
      const watchDisabled = () => {
        const startBtn = document.getElementById('kycStartBtn');
        if (!startBtn) {
          setTimeout(watchDisabled, 200);
          return;
        }
        if (startBtn.disabled) {
          startBtn.disabled = false;
          startBtn.removeAttribute('disabled');
        }
        try {
          const obs2 = new MutationObserver(() => {
            if (startBtn.disabled) {
              startBtn.disabled = false;
              startBtn.removeAttribute('disabled');
            }
          });
          obs2.observe(startBtn, { attributes: true, attributeFilter: ['disabled'] });
        } catch (_) {}
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchDisabled, { once: true });
      } else {
        watchDisabled();
      }

      // 4) Document capture listener — fallback. 다른 핸들러가 모두 실패해도 잡음.
      document.addEventListener('click', (ev) => {
        try {
          const t = ev.target;
          if (!t) return;
          const target = (t.closest && t.closest('#kycStartBtn, #kycInAppCopyUrlBtn'));
          if (!target) return;
          // 이미 우리 핸들러가 처리하지만, 다른 path 로 들어온 경우 fallback
          if (target.dataset.bound_v802 === '1') return; // 정상 핸들러가 처리할 것
          earlyTriggerHandoff('Document capture: ' + target.id);
        } catch (_) {}
      }, true); // capture: true
    } catch (e) {
      try { console.error('[kyc-handoff v802 bootstrap] ', e); } catch (_) {}
    }
  })();

  if (window.__RWA_KYC_CERT_INITED__) return;
  window.__RWA_KYC_CERT_INITED__ = true;

  // (2026-05-23 v798) RwaCore.toast 의존하지 않는 강제 visible 토스트.
  //   RwaCore 가 미로드 또는 toast 가 어떤 이유로 동작 안 할 때 fallback.
  //   화면 중앙 하단에 floating box 로 직접 DOM 생성.
  const __forceToast = (msg, color = '#1F2937') => {
    try {
      const box = document.createElement('div');
      box.textContent = String(msg);
      box.style.cssText = `
        position:fixed; bottom:60px; left:50%; transform:translateX(-50%);
        z-index:999999; background:${color}; color:#fff;
        padding:10px 16px; border-radius:8px; font-size:13px; font-weight:600;
        font-family:system-ui, sans-serif;
        max-width:calc(100vw - 32px); word-break:break-all;
        box-shadow:0 4px 20px rgba(0,0,0,0.4);
        opacity:0; transition:opacity 0.2s;
      `;
      document.body.appendChild(box);
      setTimeout(() => { box.style.opacity = '1'; }, 10);
      setTimeout(() => {
        box.style.opacity = '0';
        setTimeout(() => box.remove(), 300);
      }, 3500);
    } catch (_) {}
  };
  window.__kycForceToast = __forceToast; // 디버깅용 전역 노출

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

  // (2026-05-22 v772) In-app browser 감지 — KYC 차단 + 핸드오프 모달 트리거.
  // (2026-05-24 v813) Phantom 제외! 실제 테스트 (v812 kyc-test-direct.html) 에서
  //   Phantom 인앱 WebView 가 didit 의 카메라/문서스캔/얼굴인증을 정상적으로
  //   완료할 수 있음이 확인됨. v772 의 차단 가정 (Phantom 카메라 미지원) 은
  //   잘못된 추측이었음.
  //   → Phantom 사용자는 일반 흐름 (직접 didit redirect) 으로 진행.
  //   → 다른 인앱 (MetaMask/Trust/Coinbase/KakaoTalk/LINE) 은 미검증 상태이며
  //     보수적으로 핸드오프 유지 (camera 작동 불안정 가능성).
  //   → 향후 다른 인앱도 테스트 페이지로 검증 후 화이트리스트 추가 가능.
  const isInAppBrowser = () => {
    try {
      const ua = String(navigator.userAgent || "").toLowerCase();
      // (v813) Phantom 은 직접 KYC 가능 — 인앱 감지 X
      // if (/phantom/i.test(ua)) return { kind: 'phantom', ua };  ← 제거
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
  // (2026-05-23 v793) 핸드오프 토큰 발급 + 모달 표시.
  // 반환값:
  //   true  → 사용자가 "취소" 선택 (KYC 흐름 중단)
  //   false → in-app 아님 (정상 진행)
  //
  // 핸드오프 모달 표시 헬퍼 — 모달 ID #kycHandoffModal 사용.
  // (2026-05-23 v797) 핸드오프 모달 자동 생성기 — Phantom WebView 등이 HTML 을
  //   stale-cache 해서 #kycHandoffModal element 가 DOM 에 없는 경우 우회. JS 가
  //   init 시점에 호출해 모달을 동적으로 body 에 주입한다. 이미 있으면 no-op.
  //   향후 HTML 이 정상 업데이트 되더라도 호환 (idempotent).
  const ensureHandoffModalElement = () => {
    if (document.getElementById('kycHandoffModal')) return false; // 이미 있음
    try {
      const modal = document.createElement('div');
      modal.id = 'kycHandoffModal';
      modal.className = 'kyc-modal hidden';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="backdrop"></div>
        <div class="panel" style="max-width:520px;">
          <div style="font-weight:800; font-size:16px; margin-bottom:8px; color:#F59E0B;">
            ⚠ In-app browser detected
          </div>
          <div style="font-size:13px; line-height:1.55; color:var(--text); margin-bottom:12px;">
            This wallet's in-app browser does not support the camera and document scan required for identity verification. Please use the secure link below in Chrome, Safari, or Samsung Internet to complete KYC. Your wallet account will be linked automatically.
          </div>
          <div id="kycHandoffUrlBox" style="background:#F9FAFB; border:1.5px solid #E5E7EB; border-radius:8px; padding:10px 12px; margin-bottom:10px; font-family:monospace; font-size:11px; word-break:break-all; color:#374151; user-select:all; -webkit-user-select:all; -moz-user-select:all; cursor:text; transition:background 0.3s, border-color 0.3s;">—</div>
          <div style="font-size:12px; color:#6B7280; margin-bottom:14px;">
            ⏱ Expires in <span id="kycHandoffCountdown" style="font-weight:700; color:#F59E0B;">10:00</span>
            <span style="margin-left:8px; opacity:0.7;">(single-use, expires automatically)</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button id="kycHandoffShareBtn" type="button" class="btn primary block hidden" style="font-size:14px; padding:11px;">
              📤 <span>Share Link (recommended)</span>
            </button>
            <button id="kycHandoffCopyBtn" type="button" class="btn block" style="font-size:13px; padding:10px; background:#3B82F6; color:#fff;">
              📋 <span>Copy Link</span>
            </button>
            <button id="kycHandoffQrBtn" type="button" class="btn block hidden" style="font-size:13px; padding:10px; background:#F3F4F6; color:#374151;">
              📱 <span>Show QR Code</span>
            </button>
            <button id="kycHandoffDoneBtn" type="button" class="btn block" style="font-size:13px; padding:10px; background:#10B981; color:#fff;">
              🔄 <span>I completed KYC, refresh</span>
            </button>
            <button id="kycHandoffCancelBtn" type="button" class="btn block" style="font-size:12px; padding:8px; background:transparent; color:#6B7280; border:1px solid #E5E7EB;">
              <span>Cancel</span>
            </button>
          </div>
          <div id="kycHandoffQrBox" class="hidden" style="margin-top:14px; padding:12px; background:#fff; border:1.5px solid #E5E7EB; border-radius:8px; text-align:center;">
            <div id="kycHandoffQrCanvas" style="display:inline-block;"></div>
          </div>
          <div id="kycHandoffDiagnostic" class="hidden" style="margin-top:10px; padding:8px 10px; background:#F3F4F6; border:1px solid #E5E7EB; border-radius:6px; font-family:monospace; font-size:10px; color:#6B7280; line-height:1.5; max-height:120px; overflow-y:auto;"></div>
          <div id="kycHandoffError" class="hidden" style="margin-top:10px; padding:10px; background:#FEE2E2; border:1px solid #FCA5A5; border-radius:6px; font-size:12px; color:#991B1B;"></div>
        </div>
      `;
      document.body.appendChild(modal);
      try { console.log('[kyc-handoff] Modal auto-bootstrapped (HTML was stale-cached)'); } catch (_) {}
      return true; // 새로 생성됨
    } catch (e) {
      try { console.warn('[kyc-handoff] ensureHandoffModalElement failed:', e); } catch (_) {}
      return false;
    }
  };

  const showHandoffModal = () => {
    ensureHandoffModalElement(); // 매번 확인 (idempotent — 이미 있으면 no-op)
    const m = document.getElementById('kycHandoffModal');
    if (!m) return;
    m.classList.remove('hidden');
    m.setAttribute('aria-hidden', 'false');
  };
  const hideHandoffModal = () => {
    const m = document.getElementById('kycHandoffModal');
    if (!m) return;
    m.classList.add('hidden');
    m.setAttribute('aria-hidden', 'true');
  };

  // 핸드오프 토큰 발급 + 모달 채우기. 비동기.
  let __handoffCountdownTimer = null;
  const stopHandoffCountdown = () => {
    if (__handoffCountdownTimer) {
      clearInterval(__handoffCountdownTimer);
      __handoffCountdownTimer = null;
    }
  };

  const startHandoffCountdown = (ttlSeconds, onExpire) => {
    stopHandoffCountdown();
    const countdownEl = document.getElementById('kycHandoffCountdown');
    if (!countdownEl) return;
    let remaining = Math.max(0, Math.floor(Number(ttlSeconds) || 0));
    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };
    countdownEl.textContent = fmt(remaining);
    __handoffCountdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        countdownEl.textContent = '00:00';
        stopHandoffCountdown();
        if (typeof onExpire === 'function') onExpire();
        return;
      }
      countdownEl.textContent = fmt(remaining);
    }, 1000);
  };

  const issueHandoffToken = async () => {
    const C = window.RwaCore;
    if (!C) throw new Error('RwaCore not available');

    // (2026-05-24 v811) Phantom 의 현재 UI 상태 (country + 선택된 doc-btn) 를
    //   백엔드에 함께 전송. 둘 다 있으면 백엔드가 didit 세션 미리 생성 →
    //   Chrome 진입 시 즉시 didit redirect. 둘 중 하나라도 없으면 백엔드는
    //   토큰만 발급 (Chrome 은 폼 표시).
    const body = {};
    try {
      const countryEl = document.getElementById('kycCountry');
      const country = String(countryEl?.value || '').trim();
      if (country) body.country = country;

      const activeDocBtn = document.querySelector('.doc-btn.active');
      const docType = activeDocBtn ? String(activeDocBtn.getAttribute('data-doc') || '').trim() : '';
      if (docType) body.document_type = docType;
    } catch (_) {}

    return await C.api('/api/kyc/handoff/create', { method: 'POST', body });
  };

  // (2026-05-23 v795) 진단 로그 헬퍼 — 어떤 method 가 시도되고 어떤 결과를
  //   냈는지 화면에 표시. F12 없이 운영자/유저가 어디서 실패했는지 즉시 확인.
  const diagLog = (line) => {
    try {
      const box = document.getElementById('kycHandoffDiagnostic');
      if (!box) return;
      box.classList.remove('hidden');
      const ts = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.textContent = `[${ts}] ${line}`;
      box.appendChild(entry);
      // 자동 스크롤
      box.scrollTop = box.scrollHeight;
      // 콘솔에도 동시 출력
      try { console.log('[kyc-handoff]', line); } catch (_) {}
    } catch (_) {}
  };

  // (2026-05-23 v803) 중복 호출 방지 lock — touchend/click/pointerup 다중
  //   바인딩 + v802 emergency bootstrap 의 retry 로직이 동시에 호출할 가능성
  //   있음. populateAndShowHandoffModal 끝나기 전엔 새 호출 무시.
  let __handoffInFlight = false;

  const populateAndShowHandoffModal = async (kindName) => {
    // (v803) 중복 호출 lock
    if (__handoffInFlight) {
      try { console.log('[kyc-handoff] populateAndShowHandoffModal already in flight, skipping'); } catch (_) {}
      // 모달 다시 표시는 해줌 (사용자가 닫고 다시 열 수 있어야)
      showHandoffModal();
      return;
    }
    __handoffInFlight = true;

    showHandoffModal();
    const urlBox = document.getElementById('kycHandoffUrlBox');
    const errBox = document.getElementById('kycHandoffError');
    const copyBtn = document.getElementById('kycHandoffCopyBtn');
    const shareBtn = document.getElementById('kycHandoffShareBtn');
    const qrBtn = document.getElementById('kycHandoffQrBtn');
    const qrBox = document.getElementById('kycHandoffQrBox');
    const diagBox = document.getElementById('kycHandoffDiagnostic');

    // (v803) URL 박스가 placeholder 상태일 때 Copy/Share 버튼 visual disabled.
    //   토큰 발급 완료 후 enable. 사용자 혼란 방지.
    const setActionButtonsEnabled = (enabled) => {
      [copyBtn, shareBtn].forEach((btn) => {
        if (!btn) return;
        if (enabled) {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.style.cursor = 'pointer';
          btn.removeAttribute('aria-disabled');
        } else {
          btn.style.opacity = '0.5';
          btn.style.pointerEvents = 'none';
          btn.style.cursor = 'not-allowed';
          btn.setAttribute('aria-disabled', 'true');
        }
      });
    };
    setActionButtonsEnabled(false); // URL 받기 전엔 disabled

    if (errBox) { errBox.classList.add('hidden'); errBox.textContent = ''; }
    if (qrBox) qrBox.classList.add('hidden');
    if (diagBox) { diagBox.innerHTML = ''; diagBox.classList.add('hidden'); }
    // QR 라이브러리 미탑재 — v1 에서는 버튼 자체를 숨김. 추후 vendor 추가 시 노출.
    if (qrBtn) qrBtn.classList.add('hidden');

    // (v795) navigator.share 가 지원되는 환경 (모바일 WebView/Chrome) 에서만
    //   Share 버튼 노출. 데스크톱 Chrome 은 미지원이라 자동 숨김.
    if (shareBtn) {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        shareBtn.classList.remove('hidden');
        diagLog('navigator.share() supported — Share button visible');
      } else {
        shareBtn.classList.add('hidden');
        diagLog('navigator.share() NOT supported — Share button hidden');
      }
    }

    if (urlBox) urlBox.textContent = L('Generating secure link...');

    try {
      const r = await issueHandoffToken();
      const handoffUrl = String(r?.handoff_url || '').trim();
      const ttlSec = Number(r?.ttl_seconds || 600);

      if (!handoffUrl) throw new Error('empty_handoff_url');

      if (urlBox) {
        // (v804) 이전 에러 상태였다면 스타일 복원
        urlBox.style.color = '#374151';
        urlBox.style.background = '#F9FAFB';
        urlBox.style.borderColor = '#E5E7EB';
        urlBox.textContent = handoffUrl;
      }
      // (v803) 토큰 정상 수신 → 액션 버튼 enable
      setActionButtonsEnabled(true);
      startHandoffCountdown(ttlSec, () => {
        // 만료 시 — 사용자에게 알리고 새로 발급 받도록 안내
        if (errBox) {
          errBox.classList.remove('hidden');
          errBox.textContent = L('Link expired. Please close this dialog and try again to generate a new link.');
        }
      });

      // (2026-05-23 v796) Share/Copy 버튼 바인딩은 bindHandoffModalActions() 에
      //   서 페이지 init 시점에 미리 처리됨. 여기서는 토큰/URL 만 채우면 됨.
    } catch (e) {
      // (2026-05-23 v803) 케이스별 상세 진단 표시 — ChatGPT 분석 반영.
      //   URL 박스가 '—' 으로 남을 때 사용자가 원인 알 수 있도록 errBox 에
      //   모든 정보 노출. HTTP status / server status / message / detail 분리.
      const httpStatus = e?.status || '?';
      const srvStatus = e?.data?.status || '';
      const srvMsg = e?.data?.message || e?.message || '';
      const srvDetail = e?.detail || e?.data?.detail || '';

      // 사용자 친화적 안내 (케이스별)
      let friendly = L('Failed to generate handoff link. Please try again.');
      let actionHint = '';
      if (httpStatus === 401) {
        friendly = L('Wallet authentication required.');
        actionHint = L('Please reconnect your wallet and complete OTP verification, then try again.');
      } else if (httpStatus === 409 && String(srvStatus).includes('already_verified')) {
        friendly = L('KYC is already completed.');
        actionHint = L('Please refresh the page to see your verified status.');
      } else if (httpStatus === 409 && String(srvStatus) === 'kyc_in_review') {
        // (v814) 리뷰 중 — 새 핸드오프 발급 차단
        friendly = L('KYC is currently under review.');
        actionHint = L('You cannot resubmit until the review is complete. Please close this dialog and wait.');
      } else if (httpStatus === 503 && String(srvStatus).includes('not_configured')) {
        friendly = L('KYC service not configured.');
        actionHint = L('Administrator action required. Please contact support.');
      } else if (httpStatus === 500 || httpStatus >= 500) {
        friendly = L('Server error generating link.');
        actionHint = L('This may be a database migration issue or temporary server problem. Please contact support.');
      } else if (httpStatus === 0 || String(srvMsg).toLowerCase().includes('network')) {
        friendly = L('Network error.');
        actionHint = L('Check your internet connection and try again.');
      }

      // (v804) URL 박스에 에러 인라인 표시 — 사용자가 가장 먼저 보는 곳.
      if (urlBox) {
        urlBox.style.color = '#991B1B';
        urlBox.style.background = '#FEE2E2';
        urlBox.style.borderColor = '#FCA5A5';
        urlBox.textContent = `✖ HTTP ${httpStatus}: ${friendly}`;
      }
      if (errBox) {
        errBox.classList.remove('hidden');
        // (v804) 모달 상단으로 errBox 이동 — 사용자가 스크롤 없이 즉시 봄.
        try {
          const panel = errBox.closest('.panel') || errBox.parentNode;
          if (panel && errBox.parentNode === panel && panel.firstChild !== errBox) {
            panel.insertBefore(errBox, panel.firstChild);
          }
        } catch (_) {}
        // 친화 메시지 + 행동 가이드 + raw 진단 정보 (모두 노출)
        errBox.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; font-size:14px;">⚠ ${friendly}</div>
          ${actionHint ? `<div style="margin-bottom:6px;">${actionHint}</div>` : ''}
          <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #FCA5A5; font-family:monospace; font-size:10px; opacity:0.85; word-break:break-all;">
            <div>HTTP: ${httpStatus}</div>
            ${srvStatus ? `<div>Server status: ${srvStatus}</div>` : ''}
            ${srvMsg ? `<div>Message: ${String(srvMsg).substring(0,300)}</div>` : ''}
            ${srvDetail ? `<div>Detail: ${String(srvDetail).substring(0,300)}</div>` : ''}
          </div>
        `;
      }
      // (v808) v804 의 강제 alert 제거 — errBox 가 v804 의 insertBefore 로 모달
      //   상단에 이동했고 URL 박스에 인라인 에러도 표시되므로 alert 없이도
      //   사용자가 즉시 인지 가능. 콘솔 dump 는 F12 진단용으로 유지.
      try { console.error('[kyc-handoff] /api/kyc/handoff/create failed:', { httpStatus, srvStatus, srvMsg, srvDetail, error: e }); } catch (_) {}
    } finally {
      // (v803) 중복 호출 lock 해제 — populateAndShowHandoffModal 끝나면 다음
      //   호출 가능. 모달 표시 중에도 사용자가 다른 버튼 탭하면 새 토큰 발급
      //   막아야 함 (서버 측에서 이전 토큰 자동 무효화하긴 하지만 race 방지).
      __handoffInFlight = false;
    }
  };

  // (2026-05-23 v802) populateAndShowHandoffModal 을 window 에 노출.
  //   IIFE 상단의 emergency bootstrap 이 RwaPages init() 없이도 이 함수를
  //   호출할 수 있도록 (RwaCore.boot() / OTP 가드에서 막힐 경우 대응).
  try { window.__rwaPopulateHandoffModal = populateAndShowHandoffModal; } catch (_) {}

  const handleInAppBrowserGate = () => {
    const detected = isInAppBrowser();
    if (!detected) return false;

    const kindName = ({
      phantom: 'Phantom',
      metamask: 'MetaMask',
      trust: 'Trust Wallet',
      coinbase: 'Coinbase Wallet',
      kakao: 'KakaoTalk',
      line: 'LINE'
    })[detected.kind] || detected.kind;

    // 핸드오프 모달 표시 + 토큰 발급 (비동기)
    populateAndShowHandoffModal(kindName);

    return true;
  };

  // 핸드오프 모달 액션 버튼 바인딩 (init 외부에서 한 번만 처리해도 안전)
  const bindHandoffModalActions = () => {
    const doneBtn = document.getElementById('kycHandoffDoneBtn');
    const cancelBtn = document.getElementById('kycHandoffCancelBtn');
    const qrBtn = document.getElementById('kycHandoffQrBtn');
    const qrBox = document.getElementById('kycHandoffQrBox');
    const copyBtn = document.getElementById('kycHandoffCopyBtn');
    const shareBtn = document.getElementById('kycHandoffShareBtn');
    const urlBox = document.getElementById('kycHandoffUrlBox');

    if (doneBtn && !doneBtn.dataset.bound) {
      doneBtn.dataset.bound = '1';
      doneBtn.addEventListener('click', () => {
        stopHandoffCountdown();
        hideHandoffModal();
        // 강제 새로고침 — 서버에서 KYC 완료 상태 가져오게.
        location.reload();
      });
    }
    if (cancelBtn && !cancelBtn.dataset.bound) {
      cancelBtn.dataset.bound = '1';
      cancelBtn.addEventListener('click', () => {
        stopHandoffCountdown();
        hideHandoffModal();
      });
    }
    if (qrBtn && !qrBtn.dataset.bound) {
      qrBtn.dataset.bound = '1';
      qrBtn.addEventListener('click', () => {
        if (qrBox) qrBox.classList.toggle('hidden');
      });
    }

    // (2026-05-23 v796) Share 버튼 — 페이지 init 시점에 미리 바인딩.
    //   v795 까지는 populateAndShowHandoffModal 의 await 뒤에 바인딩 되어,
    //   토큰 발급 전이나 발급 실패 시 버튼이 무반응이었음. init 시점 바인딩
    //   으로 옮기되, 클릭 핸들러 안에서 urlBox.textContent 를 매번 새로 읽음.
    if (shareBtn && !shareBtn.dataset.bound) {
      shareBtn.dataset.bound = '1';
      shareBtn.addEventListener('click', async () => {
        diagLog('Share: button clicked');
        const url = String(document.getElementById('kycHandoffUrlBox')?.textContent || '').trim();
        if (!url || url === '—' || /generating|expired/i.test(url) || url.length < 20) {
          diagLog(`Share: blocked — invalid url state (length=${url.length}, value="${url.substring(0,30)}...")`);
          if (window.RwaCore?.toast) window.RwaCore.toast(L('Please wait until the link is generated.'), 'info');
          return;
        }

        if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
          diagLog('Share: navigator.share not available — falling back to copy');
          if (copyBtn) copyBtn.click();
          return;
        }

        try {
          diagLog('Share: calling navigator.share()...');
          await navigator.share({
            title: 'SilicaChain KYC',
            text: L('Complete KYC verification at this secure link:'),
            url: url,
          });
          diagLog('Share: navigator.share() RESOLVED — user picked an action');
          if (window.RwaCore?.toast) window.RwaCore.toast(L('Link shared.'), 'good');
          try {
            const orig = shareBtn.style.background;
            shareBtn.style.background = '#10B981';
            setTimeout(() => { shareBtn.style.background = orig; }, 800);
          } catch (_) {}
        } catch (e) {
          const name = e?.name || 'Error';
          diagLog(`Share: navigator.share() REJECTED — ${name}: ${e?.message || ''}`);
          if (name === 'AbortError') return;
          if (window.RwaCore?.toast) {
            window.RwaCore.toast(L('Share failed. Please use Copy Link instead.'), 'bad');
          }
        }
      });
      diagLog('Share button bound at init');
    }

    // (2026-05-23 v796) Copy 버튼 — 페이지 init 시점에 미리 바인딩 (위와 동일 이유).
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = '1';
      copyBtn.addEventListener('click', async () => {
        diagLog('Copy: button clicked');
        const url = String(document.getElementById('kycHandoffUrlBox')?.textContent || '').trim();
        if (!url || url === '—' || /generating|expired/i.test(url) || url.length < 20) {
          diagLog(`Copy: blocked — invalid url state (length=${url.length}, value="${url.substring(0,30)}...")`);
          if (window.RwaCore?.toast) window.RwaCore.toast(L('Please wait until the link is generated.'), 'info');
          return;
        }

        diagLog(`Copy: proceeding with url length=${url.length}`);
        let copied = false;

        // Method 1: Modern Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          diagLog('Copy: trying navigator.clipboard.writeText()...');
          try {
            await navigator.clipboard.writeText(url);
            copied = true;
            diagLog('Copy: clipboard API resolved (may still be silent-fail — verify by pasting)');
          } catch (e) {
            diagLog(`Copy: clipboard API FAILED — ${e?.name || 'Error'}: ${e?.message || ''}`);
          }
        } else {
          diagLog('Copy: navigator.clipboard.writeText not available');
        }

        // Method 2: textarea + execCommand fallback
        if (!copied) {
          diagLog('Copy: trying textarea + execCommand fallback...');
          try {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '0';
            ta.style.left = '0';
            ta.style.width = '1px';
            ta.style.height = '1px';
            ta.style.opacity = '0';
            ta.style.pointerEvents = 'none';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { ta.setSelectionRange(0, url.length); } catch (_) {}
            try {
              copied = document.execCommand('copy');
              diagLog(`Copy: execCommand returned ${copied}`);
            } catch (e) {
              copied = false;
              diagLog(`Copy: execCommand threw — ${e?.name || 'Error'}`);
            }
            document.body.removeChild(ta);
          } catch (e) {
            diagLog(`Copy: textarea fallback failed — ${e?.name || 'Error'}`);
          }
        }

        if (copied) {
          if (window.RwaCore?.toast) window.RwaCore.toast(L('Link copied to clipboard.'), 'good');
          try {
            const orig = copyBtn.style.background;
            copyBtn.style.background = '#10B981';
            setTimeout(() => { copyBtn.style.background = orig; }, 800);
          } catch (_) {}
        } else {
          diagLog('Copy: ALL methods failed — falling back to manual selection');
          try {
            const box = document.getElementById('kycHandoffUrlBox');
            if (box) {
              const range = document.createRange();
              range.selectNodeContents(box);
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
              }
              box.style.background = '#FEF3C7';
              box.style.borderColor = '#F59E0B';
              setTimeout(() => {
                box.style.background = '#F9FAFB';
                box.style.borderColor = '#E5E7EB';
              }, 1500);
            }
          } catch (_) {}
          if (window.RwaCore?.toast) {
            window.RwaCore.toast(L('Auto-copy blocked. The link is highlighted — long-press to copy manually.'), 'info');
          }
        }
      });
      diagLog('Copy button bound at init');
    }

    // (2026-05-23 v796) URL 박스 직접 탭 → 자동 선택. 사용자가 long-press 로
    //   수동 복사 할 수 있도록 도와줌. 클립보드 API 가 모두 실패하는 환경에서
    //   최후의 수단.
    if (urlBox && !urlBox.dataset.bound) {
      urlBox.dataset.bound = '1';
      urlBox.addEventListener('click', () => {
        const url = String(urlBox.textContent || '').trim();
        if (!url || url === '—' || /generating|expired/i.test(url) || url.length < 20) return;
        try {
          const range = document.createRange();
          range.selectNodeContents(urlBox);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          diagLog('URL box tapped — text selected for manual copy');
        } catch (_) {}
      });
    }
  };

  // (2026-05-23 v793) 핸드오프 토큰 모드 상태.
  //   - URL ?kyc_token=XXX 로 진입한 경우 활성화.
  //   - 활성화 시 모든 KYC API 호출에 X-Kyc-Handoff-Token 헤더 추가.
  //   - 일반 지갑 연결 흐름 (RwaCore.boot 의 wallet auth) 우회.
  const __handoffMode = {
    active: false,
    token: '',
    address: '',
    masked: '',
    expiresAt: '',
    ttlRemaining: 0,
  };

  const readKycTokenFromUrl = () => {
    try {
      const qp = new URLSearchParams(location.search);
      const tok = String(qp.get('kyc_token') || '').trim();
      if (!tok) return '';
      if (!/^[a-f0-9]{32,128}$/i.test(tok)) return '';
      return tok;
    } catch { return ''; }
  };

  // KYC API 전용 wrapper — 토큰 모드면 헤더 추가, 아니면 C.api 그대로.
  const kycApi = async (path, opt = {}) => {
    const C = window.RwaCore;
    if (!C) throw new Error('RwaCore not available');
    const opt2 = Object.assign({}, opt);
    if (__handoffMode.active && __handoffMode.token) {
      opt2.headers = Object.assign({}, opt.headers || {}, {
        'X-Kyc-Handoff-Token': __handoffMode.token,
      });
      // 토큰 모드에서는 wallet JWT 가 없을 수 있으므로 auth:false 처리 — 서버가
      //   핸드오프 헤더만 보고 인증한다. 단 다른 헤더 (lang, idempotency) 는 유지.
      opt2.auth = false;
    }
    return await C.api(path, opt2);
  };

  // 핸드오프 모드 활성화 — URL 토큰을 서버에 resolve 해서 wallet 주소 확인.
  //   페이지 상단에 "Handoff Session" 배너 표시.
  const tryActivateHandoffMode = async () => {
    // (2026-05-23 v799) URL 또는 sessionStorage 에서 토큰 읽음. sessionStorage
    //   는 didit.me 라운드 트립 (kyc-return.html 경유) 에서 토큰을 잃지 않게
    //   유지하기 위함. URL 우선, 없으면 sessionStorage fallback.
    let token = readKycTokenFromUrl();
    if (!token) {
      try {
        const key = window.RwaCore?.HANDOFF_TOKEN_SS_KEY || "rwa_kyc_handoff_token";
        const fromSS = String(sessionStorage.getItem(key) || "").trim();
        if (fromSS && /^[a-f0-9]{32,128}$/i.test(fromSS)) {
          token = fromSS;
        }
      } catch (_) {}
    }
    if (!token) return false;

    try {
      const C = window.RwaCore;
      if (!C) return false;
      // resolve 는 auth 불필요 — 토큰 자체가 인증.
      const r = await C.api(`/api/kyc/handoff/resolve?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        auth: false,
      });
      if (!r?.address) {
        // 토큰 무효 → sessionStorage 도 정리
        try {
          const key = window.RwaCore?.HANDOFF_TOKEN_SS_KEY || "rwa_kyc_handoff_token";
          sessionStorage.removeItem(key);
        } catch (_) {}
        return false;
      }

      __handoffMode.active = true;
      __handoffMode.token = token;
      __handoffMode.address = String(r.address || '').toLowerCase();
      __handoffMode.masked = String(r.masked_address || '');
      __handoffMode.expiresAt = String(r.expires_at || '');
      __handoffMode.ttlRemaining = Number(r.ttl_remaining_seconds || 0);

      // (2026-05-23 v810) 핸드오프 모드 활성화 → body 에 handoff-mode 클래스 추가.
      //   CSS 로 헤더의 wallet UI (Connect Wallet 버튼, wallet pill, OTP 버튼,
      //   모바일 햄버거 등) 를 숨겨 사용자 혼란 방지. KYC 는 항상 토큰 발급한
      //   원본 Phantom 지갑에 묶이므로 Chrome 의 다른 지갑 연결은 의미 없음.
      try {
        document.body.classList.add('handoff-mode');
      } catch (_) {}

      // (v799) sessionStorage 에 토큰 저장 — didit.me 갔다가 돌아와도 유지.
      //   URL 에 토큰이 노출되어 있어도 page navigation 후엔 사라지므로 SS 가 안전.
      try {
        const key = window.RwaCore?.HANDOFF_TOKEN_SS_KEY || "rwa_kyc_handoff_token";
        sessionStorage.setItem(key, token);
      } catch (_) {}

      // (2026-05-24 v811) 백엔드가 핸드오프 시점에 didit 세션을 미리 생성했다면
      //   여기서 즉시 didit 으로 redirect — 사용자는 폼 재선택 없이 바로 인증 시작.
      //   session_id 도 localStorage 에 저장 (Chrome 복귀 후 poll 흐름 호환).
      //
      //   안전장치: didit 갔다가 돌아온 경우 무한 redirect 방지.
      //     - sessionStorage 에 토큰별 redirect flag 저장
      //     - 동일 토큰으로 두 번째 진입 시 redirect 건너뛰고 폼/폴링 흐름으로
      if (r?.didit_session_url) {
        const redirectFlagKey = 'rwa_kyc_handoff_redirected_' + token.substring(0, 16);
        let alreadyRedirected = false;
        try {
          alreadyRedirected = sessionStorage.getItem(redirectFlagKey) === '1';
        } catch (_) {}

        if (!alreadyRedirected) {
          try {
            if (r.didit_session_id) {
              localStorage.setItem(SESSION_KEY, String(r.didit_session_id));
            }
          } catch (_) {}
          try {
            sessionStorage.setItem(redirectFlagKey, '1');
          } catch (_) {}
          try {
            // 잠깐 사용자에게 진행 중임을 알리는 모달 (1초 이내 redirect)
            showModal(L('Opening the verification window...'), false);
          } catch (_) {}
          // 다음 tick 에 redirect — 모달 paint 보장
          setTimeout(() => {
            try { location.href = r.didit_session_url; }
            catch (_) { location.replace(r.didit_session_url); }
          }, 50);
          // tryActivateHandoffMode 는 true 반환하지만 페이지는 redirect 됨
          return true;
        }
        // 이미 redirect 했음 → didit 복귀 케이스. session_id 만 보장하고 폴링 흐름 진입.
        try {
          if (r.didit_session_id) {
            localStorage.setItem(SESSION_KEY, String(r.didit_session_id));
          }
        } catch (_) {}
      }

      // 페이지 상단에 핸드오프 세션 배너 표시 (form 영역 내).
      try {
        const formSec = document.getElementById('kycFormSection');
        if (formSec && !document.getElementById('kycHandoffSessionBanner')) {
          const banner = document.createElement('div');
          banner.id = 'kycHandoffSessionBanner';
          banner.style.cssText = 'margin-bottom:16px; padding:12px 14px; background:#ECFDF5; border:1.5px solid #10B981; border-radius:8px; color:#065F46; font-size:13px;';
          banner.innerHTML = `
            <div style="font-weight:700; margin-bottom:4px;">✓ ${L('Verified handoff session')}</div>
            <div style="font-size:12px; line-height:1.5;">
              ${L('Wallet')}: <span style="font-family:monospace; font-weight:600;">${__handoffMode.masked || '—'}</span><br>
              ${L('You can complete KYC here without connecting a wallet. Return to your wallet browser when done.')}
            </div>
          `;
          formSec.insertBefore(banner, formSec.firstChild);
        }
      } catch (_) {}

      return true;
    } catch (e) {
      // resolve 실패 — 토큰 만료/무효. 사용자에게 안내 후 정상 흐름으로 진입.
      try {
        const formSec = document.getElementById('kycFormSection');
        if (formSec && !document.getElementById('kycHandoffSessionExpired')) {
          const banner = document.createElement('div');
          banner.id = 'kycHandoffSessionExpired';
          banner.style.cssText = 'margin-bottom:16px; padding:12px 14px; background:#FEE2E2; border:1.5px solid #FCA5A5; border-radius:8px; color:#991B1B; font-size:13px;';
          banner.innerHTML = `
            <div style="font-weight:700; margin-bottom:4px;">⚠ ${L('Handoff link invalid or expired')}</div>
            <div style="font-size:12px; line-height:1.5;">
              ${L('Please re-open the page in your wallet browser and generate a new handoff link.')}
            </div>
          `;
          formSec.insertBefore(banner, formSec.firstChild);
        }
      } catch (_) {}
      return false;
    }
  };

  // (2026-05-23 v801) 모든 await 이전에 호출 — Phantom WebView 에서 C.boot()
  //   이나 /api/kyc/status 가 hang 해도 핵심 버튼은 작동하게.
  //   ChatGPT 외부 분석으로 발견: init() 의 await 들이 hang 하면 startBtn /
  //   배너 버튼이 영영 미바인딩 상태가 됨. 이 함수는 sync 만 사용.
  const bindCriticalButtonsEarly = () => {
    // 1) 배너 버튼 ("Generate Secure Link") — 핸드오프 모달 오픈
    try {
      const inAppDetected = !__handoffMode.active && isInAppBrowser();
      const banner = document.getElementById("kycInAppBrowserBanner");
      const copyBtn = document.getElementById("kycInAppCopyUrlBtn");
      if (inAppDetected && banner) {
        banner.classList.remove("hidden");

        // 라벨 변경
        if (copyBtn) {
          const labelSpan = copyBtn.querySelector('span');
          if (labelSpan) {
            try {
              labelSpan.textContent = (typeof L === 'function') ? L('Generate Secure Link') : 'Generate Secure Link';
            } catch (_) {}
            labelSpan.setAttribute('data-i18n-en', 'Generate Secure Link');
            labelSpan.setAttribute('data-i18n-ko', '보안 링크 생성');
            try { labelSpan.style.pointerEvents = 'none'; } catch (_) {}
          }
        }

        if (copyBtn) {
          // (v808) v801 의 클릭 시 alert 제거 — 흐름 정상 작동 확인. 에러는
          //   populateAndShowHandoffModal 내부의 errBox 로 표시되므로 alert 불필요.
          let __earlyHandoffLastFire = 0;
          const earlyHandoffHandler = (ev) => {
            try {
              const now = Date.now();
              if (now - __earlyHandoffLastFire < 500) return;
              __earlyHandoffLastFire = now;
              if (ev) try { ev.preventDefault(); } catch (_) {}
              try {
                populateAndShowHandoffModal('');
              } catch (e) {
                try { console.error('[kyc-handoff] populateAndShowHandoffModal threw:', e); } catch (_) {}
              }
            } catch (outer) {
              try { console.error('[kyc-handoff] early handoff handler error:', outer); } catch (_) {}
            }
          };
          bindOnce(copyBtn, "open-handoff-early", "click", earlyHandoffHandler);
          bindOnce(copyBtn, "open-handoff-early-touch", "touchend", earlyHandoffHandler);
          bindOnce(copyBtn, "open-handoff-early-pointer", "pointerup", earlyHandoffHandler);
          try { copyBtn.onclick = earlyHandoffHandler; } catch (_) {}
          try { copyBtn.style.cursor = 'pointer'; } catch (_) {}
        }
      }
    } catch (e) {
      try { console.error('[kyc-handoff] early banner bind error:', e); } catch (_) {}
    }

    // 2) Start Verification 버튼 — 인앱 + Chrome handoff 모두 처리.
    //    (v809) Chrome handoff 모드에서 late handler 가 init() 의 awaits 뒤에
    //    있어 status 응답에 따라 early return 시 미바인딩 가능. 따라서 early
    //    bind 가 모든 케이스를 안전하게 처리. late handler 는 동일 key 'start' 로
    //    bindOnce 처리되어 no-op 됨 (중복 방지).
    try {
      const startBtn = document.getElementById("kycStartBtn");
      if (startBtn) {
        try { startBtn.style.cursor = 'pointer'; } catch (_) {}
        let __earlyStartLastFire = 0;
        let __earlyStartSubmitting = false;
        const earlyStartHandler = async (ev) => {
          try {
            const now = Date.now();
            if (now - __earlyStartLastFire < 500) return;
            __earlyStartLastFire = now;

            // 인앱 감지 시 — 핸드오프 모달 즉시 표시
            const detected = isInAppBrowser();
            if (detected && !__handoffMode.active) {
              if (ev) {
                try { ev.preventDefault(); } catch (_) {}
                try { ev.stopImmediatePropagation && ev.stopImmediatePropagation(); } catch (_) {}
              }
              try {
                populateAndShowHandoffModal('');
              } catch (e) {
                try { console.error('[kyc-handoff] populateAndShowHandoffModal threw:', e); } catch (_) {}
              }
              return;
            }

            // (v809) 비-인앱 (Chrome handoff 또는 일반 wallet 사용자) → KYC 시작.
            //   late handler 가 동일 key 로 bindOnce 되어 no-op 되므로 여기서 처리.
            if (__earlyStartSubmitting) return;

            // 클릭 시점에 DOM 에서 country / docType 읽음 (closure 의존 X).
            const countryEl = document.getElementById('kycCountry');
            const country = String(countryEl?.value || '').trim();
            const activeDocBtn = document.querySelector('.doc-btn.active');
            const docType = activeDocBtn ? String(activeDocBtn.getAttribute('data-doc') || '').trim() : '';

            const C = window.RwaCore;
            if (!country) {
              if (C?.toast) C.toast(L('Please select your country first.'), 'bad');
              return;
            }
            if (!docType) {
              if (C?.toast) C.toast(L('Please select an ID document type.'), 'bad');
              return;
            }

            if (ev) {
              try { ev.preventDefault(); } catch (_) {}
              try { ev.stopImmediatePropagation && ev.stopImmediatePropagation(); } catch (_) {}
            }

            __earlyStartSubmitting = true;
            try { startBtn.disabled = true; startBtn.textContent = L('Processing...'); } catch (_) {}
            try { showModal(L('Opening the verification window...'), false); } catch (_) {}

            try {
              const r = await kycApi('/api/kyc-certify', {
                method: 'POST',
                body: { document_type: docType, country: country }
              });

              if (r?.status === 'session_created' && r?.session_url) {
                // session_id localStorage 저장 (poll 흐름 호환)
                try { localStorage.setItem(SESSION_KEY, String(r.session_id || '')); } catch {}
                // didit 으로 redirect
                location.href = r.session_url;
                return;
              }
              if (r?.status === 'succ' || r?.already_verified === true) {
                try { hideModal(); } catch (_) {}
                if (C?.toast) C.toast(L('KYC verification completed.'), 'good');
                return;
              }
              // 알 수 없는 응답
              try { hideModal(); } catch (_) {}
              if (C?.toast) C.toast(L('Unexpected response. Please refresh and try again.'), 'bad');
            } catch (apiErr) {
              try { hideModal(); } catch (_) {}
              const httpStatus = apiErr?.status || '?';
              const srvStatus = apiErr?.data?.status || '';
              const msg = apiErr?.data?.message || apiErr?.message || '';

              // (2026-05-24 v814) 리뷰 진행 중 → 재신청 차단. 페이지 reload
              //   하면 /api/kyc/status 응답이 in_review 로 와서 ReviewPanel 표시.
              if (srvStatus === 'kyc_in_review') {
                if (C?.toast) {
                  C.toast(L('KYC is under review. Please wait until completion.'), 'info');
                }
                try { console.log('[kyc-handoff] In review — reloading to show ReviewPanel'); } catch (_) {}
                setTimeout(() => location.reload(), 600);
                return;
              }

              if (C?.toast) {
                C.toast(`${L('KYC start failed')}: ${httpStatus} ${srvStatus || msg}`, 'bad');
              }
              try { console.error('[kyc-handoff] /api/kyc-certify failed:', { httpStatus, srvStatus, msg, error: apiErr }); } catch (_) {}
            } finally {
              __earlyStartSubmitting = false;
              try { startBtn.disabled = false; startBtn.textContent = L('Start Verification'); } catch (_) {}
            }
          } catch (outer) {
            try { console.error('[kyc-handoff] early start handler error:', outer); } catch (_) {}
          }
        };
        // (v809) 동일 key 'start' 사용 → late init() 의 startBtn bind 가 no-op.
        bindOnce(startBtn, "start", "click", earlyStartHandler);
        bindOnce(startBtn, "start-touch", "touchend", earlyStartHandler);
        bindOnce(startBtn, "start-pointer", "pointerup", earlyStartHandler);
      }
    } catch (e) {
      try { console.error('[kyc-handoff] early start bind error:', e); } catch (_) {}
    }
  };

  async function init() {
    // (2026-05-23 v801) PHASE 1 - 동기 critical 버튼 바인딩. await 이전.
    //   document.body 가 준비된 시점에서 호출되므로 안전.
    try { bindCriticalButtonsEarly(); } catch (_) {}

    if (document.body?.dataset?.kycCertInit === "1") return;
    if (document.body) document.body.dataset.kycCertInit = "1";

    saveReturnUrl();

    const C = window.RwaCore;
    if (!C) return;

    // (2026-05-23 v797) 핸드오프 모달 자동 생성 (HTML 이 stale-cached 인 경우
    //   대비). 이미 있으면 no-op.
    ensureHandoffModalElement();

    // (2026-05-23 v793) 핸드오프 모달의 액션 버튼 미리 바인딩 (idempotent).
    bindHandoffModalActions();

    // (2026-05-23 v801) PHASE 1.5 - 모달 생성 직후 다시 critical 바인딩 호출.
    //   ensureHandoffModalElement 가 모달 동적 생성한 경우 그 자식들도 바인딩됨.
    try { bindCriticalButtonsEarly(); } catch (_) {}

    // (2026-05-23 v793) URL 에 kyc_token 이 있으면 핸드오프 모드 시도.
    //   성공하면 RwaCore.boot 의 지갑 연결 단계를 건너뛴다.
    const handoffActivated = await tryActivateHandoffMode();

    if (!handoffActivated) {
      // 일반 흐름 — 지갑 연결 + MFA.
      await C.boot().catch(() => {});
    } else {
      // 핸드오프 모드 — 지갑 boot 건너뛰되, i18n / 헤더 / 푸터 같은
      //   non-auth 초기화는 필요할 수 있음. core.js 의 boot() 가 단일 진입점
      //   이라 분리가 어려운데, boot() 내부에서 지갑 연결 실패해도 graceful
      //   fallback 이므로 그대로 호출해도 안전. 단, 지갑 연결을 시도하지
      //   않도록 별도 flag 전달.
      try {
        // boot() 가 인자를 받지 않으므로 직접 호출. 지갑이 없으면 인앱이 아닌
        //   일반 브라우저에서는 connect 팝업이 뜰 수 있는데, boot() 는 일반적
        //   으로 자동 연결만 시도하고 사용자 클릭 없이는 팝업을 띄우지 않으므로
        //   안전.
        await C.boot().catch(() => {});
      } catch (_) {}
    }

    const nameEl = qs("#kycName");
    const birthEl = qs("#kycBirth");
    const startBtn = qs("#kycStartBtn");
    const okBtn = qs("#kycModalOk");
    const doneBox = qs("#kycDoneBox");
    const docBtns = qsa("[data-doc]");

    // (2026-05-22 v772) 페이지 로드 시 in-app browser 감지 → 배너 표시.
    //   사용자가 START VERIFICATION 누르기 전에 미리 알림. 'Copy URL' 버튼으로
    //   클립보드 복사 가능 → 일반 브라우저에서 paste 후 진행.
    // (2026-05-23 v793) 페이지 로드 시 in-app 감지 → 사전 안내 배너. 기존
    //   'Copy URL' 버튼은 보조 액션이고, 메인 액션은 'Generate Secure Link'
    //   (핸드오프 모달 오픈). 핸드오프 모드 (이미 Chrome 등에서 token 진입)
    //   에서는 배너를 표시하지 않는다.
    try {
      const inAppDetected = !__handoffMode.active && isInAppBrowser();
      const banner = qs("#kycInAppBrowserBanner");
      const copyBtn = qs("#kycInAppCopyUrlBtn");
      if (inAppDetected && banner) {
        banner.classList.remove("hidden");

        // 'Copy URL' 버튼 라벨을 'Generate Secure Link' 로 변경하고
        //   클릭 시 핸드오프 모달을 열도록 동작 교체.
        if (copyBtn) {
          const labelSpan = copyBtn.querySelector('span');
          if (labelSpan) {
            labelSpan.textContent = L('Generate Secure Link');
            labelSpan.setAttribute('data-i18n-en', 'Generate Secure Link');
            labelSpan.setAttribute('data-i18n-ko', '보안 링크 생성');
          }
        }

        // (2026-05-23 v800) 다중 이벤트 + 직접 onclick — Phantom WebView 의
        //   'click' 이벤트 정상 작동 안 할 가능성 대비. 여러 이벤트 타입
        //   (click/touchend/pointerup) 으로 바인딩하되 debounce 로 중복 발화 방지.
        // (2026-05-23 v808) 진단용 alert 제거 — 흐름 정상 확인. 에러는 errBox 로.
        let __handoffLastFire = 0;
        const handoffClickHandler = (ev) => {
          try {
            // 500ms 내 중복 발화 무시 (touchend → click 이중 발화 방지)
            const now = Date.now();
            if (now - __handoffLastFire < 500) return;
            __handoffLastFire = now;

            if (ev && typeof ev.preventDefault === 'function') {
              try { ev.preventDefault(); } catch (_) {}
            }
            try {
              populateAndShowHandoffModal('');
            } catch (e) {
              try { console.error('[kyc-handoff] populateAndShowHandoffModal threw:', e); } catch (_) {}
            }
          } catch (outerErr) {
            try { console.error('[kyc-handoff] handler outer error:', outerErr); } catch (_) {}
          }
        };
        // 1) 표준 click
        bindOnce(copyBtn, "open-handoff", "click", handoffClickHandler);
        // 2) touchend — 모바일 WebView 에서 click 보다 먼저 발화 가능
        bindOnce(copyBtn, "open-handoff-touch", "touchend", handoffClickHandler);
        // 3) pointerup — 더 모던한 이벤트, 모든 입력 타입 통합
        bindOnce(copyBtn, "open-handoff-pointer", "pointerup", handoffClickHandler);
        // 4) onclick property fallback — addEventListener 가 실패해도 작동
        try { copyBtn.onclick = handoffClickHandler; } catch (_) {}
        // 5) cursor 명시 — 일부 WebView 가 cursor:pointer 아니면 클릭 차단
        try { copyBtn.style.cursor = 'pointer'; } catch (_) {}
        // 6) 자식 span 이 클릭을 가로채지 않도록 (pointer-events: none 처리)
        try {
          const labelSpan = copyBtn.querySelector('span');
          if (labelSpan) labelSpan.style.pointerEvents = 'none';
        } catch (_) {}

        try { console.log('[kyc-handoff] Banner button bound at init (v800 multi-event)'); } catch (_) {}
      }
    } catch (e) {
      try { console.error('[kyc-handoff] init banner setup error:', e); } catch (_) {}
    }

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

      // (2026-05-24 v816) 수동 refresh 버튼 제거됨 — 백엔드 polling 으로 자동
      //   업데이트되므로 수동 새로고침 불필요. 'Return to Dashboard' 만 노출.

      // Slow background poll — 30 s. Once didit final-approves, the poll
      //   returns status='succ' and we reload to show the green panel.
      stopPolling();
      verifying = true;
      const pollReviewOnce = async () => {
        if (pollInFlight) return;
        pollInFlight = true;
        try {
          // (2026-05-23 v793) kycApi wrapper — 핸드오프 모드면 X-Kyc-Handoff-Token 헤더 추가.
          const r = await kycApi("/api/kyc-certify/poll", {
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
      // (2026-05-23 v793) kycApi wrapper — 핸드오프 모드면 X-Kyc-Handoff-Token 헤더 추가.
      const st = await kycApi("/api/kyc/status", { method: "GET" });

      // (2026-05-18 v539) 운영자: '필수가 아니더라도 KYC 는 가능해야 한다'.
      //   v537 의 강제 redirect 제거. bypass mode 여도 사용자가 자발적
      //   verify 를 진행할 수 있도록 정상 흐름 유지.
      // (2026-05-24 v817) 운영자 요청: 'KYC is currently optional' 토스트 제거.
      //   안내 문구가 불필요 (페이지 자체가 자발적 verify 흐름이므로 자명).

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
        // (2026-05-23 v793) kycApi wrapper — 핸드오프 모드면 X-Kyc-Handoff-Token 헤더 추가.
        const r = await kycApi("/api/kyc-certify/poll", {
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
          // (2026-05-23 v799) KYC 완료 → sessionStorage 의 handoff token 정리.
          //   토큰은 1회용이라 다음 페이지 진입 시 무효 응답 받아 혼란 발생.
          try {
            const ssKey = window.RwaCore?.HANDOFF_TOKEN_SS_KEY || "rwa_kyc_handoff_token";
            sessionStorage.removeItem(ssKey);
          } catch (_) {}
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

    // (2026-05-23 v808) v800 의 startBtn 진단 alert 제거. cursor:pointer 만 유지.
    try { startBtn.style.cursor = 'pointer'; } catch (_) {}

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
      // (2026-05-23 v793) 핸드오프 모드 (이미 Chrome 등 일반 브라우저에서
      //   handoff token 으로 진입) 인 경우엔 인앱 검사 우회. 토큰 발급은
      //   wallet JWT 가 있는 인앱에서만 가능하므로, 핸드오프 모드면 이미
      //   외부 브라우저에 있는 상태로 간주.
      if (!__handoffMode.active && handleInAppBrowserGate()) return;

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
        // (2026-05-23 v793) kycApi wrapper — 핸드오프 모드면 X-Kyc-Handoff-Token 헤더 추가.
        const r = await kycApi("/api/kyc-certify", {
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