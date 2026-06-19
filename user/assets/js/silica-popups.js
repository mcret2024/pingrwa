/* public/user/assets/js/silica-popups.js
 *
 * (2026-05-11 v277) Operator: '유저에게 팝업이 나타나지 않는다.'
 *
 * User-side display for admin-published popup announcements.
 *
 *   GET  /api/silica/popups/active     — list active popups for this user
 *   POST /api/silica/popups/dismiss    — '오늘 하루 보지 않기'
 *
 * Loaded by app.js after RwaCore.boot() so RwaCore.api / RwaI18n are
 * guaranteed available. Popups are shown one at a time, in start_at
 * order (oldest first). Closing the modal advances to the next popup.
 *
 * Per-popup dismissal state lives on the server for authenticated
 * users (popup_dismissals table) and in localStorage for guests, so
 * the dismiss button works in both states.
 */
(() => {
  "use strict";
  if (window.SilicaPopups?._booted) return;

  const LS_GUEST_KEY = "silica_popup_dismissed_v1";
  const TYPE_BADGE = {
    general:     "◆ NOTICE",
    dividend:    "◆ DIVIDEND",
    rate_change: "◆ RATE CHANGE",
    maintenance: "◆ MAINTENANCE",
    event:       "◆ EVENT",
  };
  const TYPE_BADGE_KO = {
    general:     "◆ 공지",
    dividend:    "◆ 배당 공지",
    rate_change: "◆ 이자율 변경",
    maintenance: "◆ 점검 공지",
    event:       "◆ 이벤트",
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const getLang = () => {
    try {
      const l = (window.RwaI18n?.getLang?.() || document.documentElement.getAttribute("data-rwa-lang") || "en").toLowerCase();
      return l === "ko" ? "ko" : "en";
    } catch (_) { return "en"; }
  };

  const todayKey = () => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };

  // (2026-05-18 v526) 운영자 보고: '유저에게 팝업이 나타나지 않는다'.
  //   원인: reset-test-data (v525) 가 popup_announcements AUTO_INCREMENT 를
  //   1 로 reset → 새 popup 이 옛 popup 과 동일 id 를 받음. localStorage
  //   에 옛 id 의 dismiss 기록이 있으면 새 popup 도 false positive 로
  //   필터링됨. 해결: dismiss 키를 (id + start_at) 조합으로 변경 → ID
  //   재사용 시에도 충돌 없음.
  const dismissKey = (popupId, startAt) => {
    const id = String(popupId || '');
    const sa = String(startAt || '').replace(/\s+/g, 'T').slice(0, 16);
    return sa ? `${id}@${sa}` : id;
  };

  const readGuestDismissed = () => {
    try {
      const raw = localStorage.getItem(LS_GUEST_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === "object") ? obj : {};
    } catch (_) { return {}; }
  };
  const writeGuestDismiss = (popupOrId, startAt) => {
    try {
      const obj = readGuestDismissed();
      // popupOrId 가 객체면 객체에서 id/start_at 추출, 아니면 인자 사용.
      const id = (popupOrId && typeof popupOrId === 'object') ? popupOrId.id : popupOrId;
      const sa = (popupOrId && typeof popupOrId === 'object') ? popupOrId.start_at : startAt;
      obj[dismissKey(id, sa)] = todayKey();
      // (v526) 같은 id 의 옛 plain-id 키가 있으면 정리 — 새 키로 마이그.
      const plainKey = String(id);
      if (Object.prototype.hasOwnProperty.call(obj, plainKey) && plainKey !== dismissKey(id, sa)) {
        delete obj[plainKey];
      }
      localStorage.setItem(LS_GUEST_KEY, JSON.stringify(obj));
    } catch (_) {}
  };
  const isGuestDismissed = (popupOrId, startAt) => {
    const obj = readGuestDismissed();
    const id = (popupOrId && typeof popupOrId === 'object') ? popupOrId.id : popupOrId;
    const sa = (popupOrId && typeof popupOrId === 'object') ? popupOrId.start_at : startAt;
    // 새 키 형식 (id@start_at) 만 매칭 — id-only legacy 키는 무시하여 reset
    //   후 ID 재사용으로 인한 false positive 방지.
    return obj[dismissKey(id, sa)] === todayKey();
  };

  // (2026-05-11 v280) Operator clarified: the earlier 'accumulation'
  //   was just two duplicate popups they created during testing — not
  //   a bug. '일반 닫기 후 페이지 이동시 배너는 다시 노출 되어야한다.'
  //   So sessionStorage tracking is removed again. Only '오늘 하루
  //   보지 않기' is persistent (localStorage today-key + the server
  //   popup_dismissals row for connected wallets). Plain close = view
  //   dismiss for the current page render, popup re-shows on next
  //   navigation.

  let styleInjected = false;
  const injectStyles = () => {
    if (styleInjected) return;
    styleInjected = true;
    const css = `
      .silica-popup-overlay {
        position: fixed; inset: 0; z-index: 10000;
        display: none;
        align-items: center; justify-content: center;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 24px;
      }
      .silica-popup-overlay.open { display: flex; }
      .silica-popup-card {
        position: relative;
        width: min(480px, 100%);
        max-height: 86vh;
        overflow: hidden;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 24px 80px rgba(0,0,0,.4);
        display: flex; flex-direction: column;
        animation: silica-popup-in .2s ease-out;
      }
      @keyframes silica-popup-in {
        from { opacity: 0; transform: translateY(12px) scale(.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      /* (v605) gradient → 단색 violet. */
      .silica-popup-card::before {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; height: 4px;
        background: #8E24AA;
      }
      .silica-popup-close {
        position: absolute; top: 12px; right: 12px;
        width: 32px; height: 32px;
        border: 0; background: transparent;
        font-size: 18px; cursor: pointer; color: #475569;
        border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .silica-popup-close:hover { background: rgba(15,23,42,.06); color: #0F172A; }
      .silica-popup-body {
        padding: 28px 24px 20px;
        overflow-y: auto;
        flex: 1 1 auto;
      }
      .silica-popup-type {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 100px;
        background: rgba(124, 58, 237, .10);
        color: #7C3AED;
        font-family: 'Space Grotesk', 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 12px;
      }
      .silica-popup-title {
        font-family: 'Bebas Neue', 'Inter', sans-serif;
        font-size: 22px;
        letter-spacing: 0.5px;
        color: #0F172A;
        line-height: 1.25;
        margin: 0 0 14px;
        word-break: break-word;
      }
      .silica-popup-message {
        color: #334155;
        font-size: 14px;
        line-height: 1.7;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .silica-popup-counter {
        margin-top: 16px;
        font-size: 11px;
        color: #94A3B8;
        font-family: 'Space Grotesk', monospace;
        letter-spacing: 0.5px;
      }
      .silica-popup-actions {
        display: flex; gap: 8px;
        padding: 16px 20px 20px;
        border-top: 1px solid #E2E8F0;
        background: #F8FAFC;
      }
      .silica-popup-actions button {
        flex: 1;
        padding: 10px 14px;
        border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background .15s, transform .15s;
      }
      .silica-popup-btn-secondary {
        background: #E2E8F0;
        border: 1px solid #CBD5E1;
        color: #334155;
      }
      .silica-popup-btn-secondary:hover { background: #CBD5E1; }
      .silica-popup-btn-primary {
        background: #7C3AED;
        border: 1px solid #6D28D9;
        color: #fff;
      }
      .silica-popup-btn-primary:hover { background: #6D28D9; }
    `;
    const tag = document.createElement("style");
    tag.id = "silica-popup-styles";
    tag.textContent = css;
    document.head.appendChild(tag);
  };

  let overlayEl = null;
  const buildOverlay = () => {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement("div");
    overlayEl.className = "silica-popup-overlay";
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.innerHTML = `
      <div class="silica-popup-card">
        <button type="button" class="silica-popup-close" data-action="close" aria-label="Close">✕</button>
        <div class="silica-popup-body">
          <span class="silica-popup-type" data-slot="type"></span>
          <h3 class="silica-popup-title" data-slot="title"></h3>
          <div class="silica-popup-message" data-slot="message"></div>
          <div class="silica-popup-counter" data-slot="counter"></div>
        </div>
        <div class="silica-popup-actions">
          <button type="button" class="silica-popup-btn-secondary" data-action="dismiss" data-slot="dismiss-btn"></button>
          <button type="button" class="silica-popup-btn-primary" data-action="close" data-slot="close-btn"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener("click", (e) => {
      // Backdrop click — close current popup, advance queue.
      if (e.target === overlayEl) advance("close");
    });
    overlayEl.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        advance(btn.getAttribute("data-action"));
      });
    });
    document.addEventListener("keydown", (e) => {
      if (!overlayEl.classList.contains("open")) return;
      if (e.key === "Escape") { e.preventDefault(); advance("close"); }
    });
    return overlayEl;
  };

  let queue = [];
  let current = null;
  let dismissEnabledForCurrent = true;
  let totalCount = 0;       // total popups in this batch (set once when showQueue starts)
  let currentIdx = 0;       // 1-based index of the popup being rendered

  const render = (popup) => {
    const lang = getLang();
    const badgeMap = lang === "ko" ? TYPE_BADGE_KO : TYPE_BADGE;
    const titleKo = popup.title_ko || "";
    const titleEn = popup.title_en || titleKo;
    const bodyKo  = popup.body_ko  || "";
    const bodyEn  = popup.body_en  || bodyKo;
    const title   = lang === "ko" ? titleKo : titleEn;
    const body    = lang === "ko" ? bodyKo  : bodyEn;

    overlayEl.querySelector('[data-slot="type"]').textContent    = badgeMap[popup.type] || (lang === "ko" ? "◆ 공지" : "◆ NOTICE");
    overlayEl.querySelector('[data-slot="title"]').textContent   = title || (lang === "ko" ? "(제목 없음)" : "(Untitled)");
    overlayEl.querySelector('[data-slot="message"]').textContent = body;
    const counterEl = overlayEl.querySelector('[data-slot="counter"]');
    // (2026-05-11 v279) Fixed counter math — totalCount is set once when
    //   the queue begins so advancing through popups shows '2 of 3',
    //   '3 of 3', etc. instead of always defaulting to '1 of N'.
    counterEl.textContent = totalCount > 1
      ? (lang === "ko" ? `${currentIdx} / ${totalCount}` : `${currentIdx} of ${totalCount}`)
      : "";

    dismissEnabledForCurrent = !!Number(popup.dismissable);
    const dismissBtn = overlayEl.querySelector('[data-slot="dismiss-btn"]');
    const closeBtn   = overlayEl.querySelector('[data-slot="close-btn"]');
    dismissBtn.textContent = lang === "ko" ? "오늘 하루 보지 않기" : "Don't show again today";
    closeBtn.textContent   = lang === "ko" ? "닫기" : "Close";
    dismissBtn.style.display = dismissEnabledForCurrent ? "" : "none";
    if (!dismissEnabledForCurrent) closeBtn.style.flex = "1 1 100%";
    else closeBtn.style.flex = "1";

    overlayEl.classList.add("open");
    overlayEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const advance = async (action) => {
    if (!current) return;
    const popup = current;
    current = null;

    if (action === "dismiss" && dismissEnabledForCurrent) {
      try {
        // Authenticated users → server-side dismissal (cross-device, durable).
        await window.RwaCore?.api?.("/api/silica/popups/dismiss", {
          method: "POST",
          body: { popup_id: popup.id },
        });
      } catch (_) {
        // Guests / network failure → fall back to local-storage so the
        //   popup at least doesn't re-appear within the same session.
        // (v526) 전체 popup 객체 전달 → id+start_at 키로 ID 충돌 회피.
        writeGuestDismiss(popup);
      }
      writeGuestDismiss(popup);   // always also write locally (UX safety)
    }

    if (queue.length) {
      current = queue.shift();
      currentIdx += 1;
      render(current);
    } else {
      overlayEl.classList.remove("open");
      overlayEl.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  };

  const showQueue = (popups) => {
    // (v526) id 만이 아니라 popup 객체 (id + start_at) 로 dismiss 매칭.
    const filtered = popups.filter(p => !isGuestDismissed(p));
    // (v530) 진단 로그 — 어느 단계에서 잘렸는지 운영자가 즉시 확인.
    console.log('[silica.popups v530] showQueue — input:', popups.length, 'after dismiss filter:', filtered.length);
    if (popups.length !== filtered.length) {
      const dismissed = popups.filter(p => isGuestDismissed(p));
      console.warn('[silica.popups v530] some popups dismissed locally:', dismissed.map(p => ({ id: p.id, type: p.type, title: p.title_ko, start_at: p.start_at })));
    }
    if (!filtered.length) {
      console.warn('[silica.popups v530] no popups to render after filter');
      return;
    }
    injectStyles();
    buildOverlay();
    totalCount = filtered.length;
    currentIdx = 1;
    current = filtered[0];
    queue = filtered.slice(1);
    console.log('[silica.popups v530] rendering popup:', { id: current.id, type: current.type, title: current.title_ko });
    render(current);
  };

  const load = async () => {
    // (2026-05-14 v348) 운영자: '모든 모달들은 유저가 지갑을 연결하여
    //   로그인했을 때에만 나타나야한다.' 지갑 미연결 visitor 에게는 시스템
    //   팝업도 노출 안 함. RwaCore.getWallet() 으로 상태 확인.
    // (v530) 진단 로그 — 운영자가 'F12 에서 원인 확인' 가능.
    try {
      const w = window.RwaCore?.getWallet?.();
      console.log('[silica.popups v530] wallet check:', { connected: w?.connected, address: w?.address });
      if (!w || !w.connected) {
        console.warn('[silica.popups v530] aborted: wallet not connected — popups require connected wallet');
        return;
      }
    } catch (e) {
      console.error('[silica.popups v530] wallet check threw', e);
      return;
    }

    try {
      // auth defaults to true → JWT/wallet header is auto-attached when
      //   the user is connected, so server-side dismiss filtering kicks in.
      console.log('[silica.popups v530] fetching /api/silica/popups/active');
      const r = await window.RwaCore?.api?.("/api/silica/popups/active", { method: "GET" });
      console.log('[silica.popups v530] response:', r);
      const list = Array.isArray(r?.popups) ? r.popups : [];
      console.log('[silica.popups v530] popups array length:', list.length, 'rows:', list);
      if (!list.length) {
        // (v531) 백엔드 진단 정보 (_diag) 풀-덤프 — now_utc 와 모든 popup row.
        console.warn('[silica.popups v530] backend returned empty popups array.');
        if (r?._diag) {
          console.warn('[silica.popups v531] backend _diag:', r._diag);
          console.table(r._diag.all_popups || []);
          console.warn('[silica.popups v531] NOW (UTC) used by backend:', r._diag.now_utc);
        }
        return;
      }
      showQueue(list);
    } catch (e) {
      console.error('[silica.popups v530] fetch FAILED', e);
    }
  };

  window.SilicaPopups = { load, _booted: true };

  // Auto-run a moment after boot — gives RwaI18n / RwaCore a chance
  // to finish initializing before we render so the language toggle
  // is honored on first paint.
  const start = () => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(load, 600), { once: true });
    } else {
      setTimeout(load, 600);
    }
  };
  start();
})();
