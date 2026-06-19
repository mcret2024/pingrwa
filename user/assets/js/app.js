// public/user/assets/js/app.js
// NOTE: "lockdown-install.js:1 SES Removing unpermitted intrinsics" is a benign console
// message from Phantom wallet's Secure EcmaScript (SES) hardening. It cannot be suppressed
// from application code as it runs before any page scripts. It is NOT an error.
(() => {
  "use strict";

  // Extract version from app.js's own script tag for cache-busting
  const APP_VER = (() => {
    try {
      const scripts = document.querySelectorAll('script[src*="app.js"]');
      for (const s of scripts) {
        const u = new URL(s.src, location.origin);
        const v = u.searchParams.get('v');
        if (v) return v;
      }
    } catch {}
    return String(Date.now());
  })();

  const inferPage = () => {
    const body = document.body;
    let p = (body?.getAttribute("data-page") || "").trim();
    if (p) return p;

    const file = (location.pathname.split("/").pop() || "").split("?")[0].toLowerCase();
    if (!file || file === "index.html") p = "index";
    else p = file.replace(".html", "");

    if (body) body.setAttribute("data-page", p);
    return p;
  };

  // 스크립트 로드 재시도: 일시적 네트워크 오류(QUIC/HTTP3 핸드셰이크 실패,
  // 일시적 5xx 등)가 발생하면 점증 백오프(500ms → 1500ms)로 최대 2회 재시도.
  // - 재시도 시 캐시 우회를 위해 ?r=N 쿼리 추가
  // - 같은 src 의 기존 <script> 태그가 남으면 cleanup
  const loadScript = (src, opts = {}) => {
    const { retries = 2, baseDelay = 500 } = opts || {};
    return new Promise((resolve, reject) => {
      const tryLoad = (attempt) => {
        const s = document.createElement("script");
        // 재시도 시에는 src 에 r=attempt 추가 → 브라우저 / Service Worker 캐시
        // 우회 + 새로운 connection 시도 유도
        const finalSrc = attempt === 0
          ? src
          : src + (src.includes("?") ? "&" : "?") + "r=" + attempt;
        s.src = finalSrc;
        s.defer = true;
        s.dataset.rwaScript = "1";
        s.onload = () => resolve();
        s.onerror = () => {
          try { s.remove(); } catch {}
          if (attempt < retries) {
            const delay = baseDelay * (attempt + 1);
            console.warn(`[loadScript] retry ${attempt + 1}/${retries} after ${delay}ms — ${src}`);
            setTimeout(() => tryLoad(attempt + 1), delay);
          } else {
            reject(new Error(`스크립트 로드 실패 (${retries + 1}회 시도): ${src}`));
          }
        };
        document.head.appendChild(s);
      };
      tryLoad(0);
    });
  };

  const releaseI18nHold = () => {
    try {
      document.documentElement.setAttribute("data-rwa-i18n-ready", "1");
      document.documentElement.removeAttribute("data-rwa-i18n-pending");
      if (typeof window.__RWA_I18N_BOOT_RELEASE__ === "function") window.__RWA_I18N_BOOT_RELEASE__();
    } catch {}
  };

  // (2026-05-18 v527/v529) 운영자 요청: '로딩 애니메이션은 본문에만 해당.
  //   헤더는 그냥 나오면 된다.'
  //   v529: 풀스크린 배경 제거 → 스피너만 본문 중앙에 표시. 본문 visibility
  //   는 가려도 헤더 / siteHeaderMount 는 가리지 않음 → 헤더는 mount 즉시
  //   정상 노출. 본문은 loader 가 제거되면 드러남.
  const __installBootLoader = () => {
    try {
      // (2026-06-17 v915) head 의 early-booting(html.rwa-booting-early)이 이미 본문을
      //   가리고 스피너를 띄웠으면 중복 설치 스킵 — __removeBootLoader 가 해제 전담.
      if (document.documentElement.classList.contains('rwa-booting-early')) return;
      const css = `
        /* (v529) 본문만 visibility:hidden — 헤더 / 스크립트 / 스타일 / 로더 제외 */
        body.rwa-booting > *:not(#rwaBootLoader):not(#siteHeaderMount):not(header):not(header.site-header):not(script):not(style):not(noscript):not(link) {
          visibility: hidden !important;
        }
        #rwaBootLoader {
          position: fixed; inset: 0;
          z-index: 100; /* 헤더(보통 1000+) 보다 낮게 → 헤더가 위에 자연스레 노출 */
          pointer-events: none;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: 16px;
          /* (v529) 풀스크린 배경 제거 — 본문 영역만 스피너로 안내 */
          background: transparent;
          transition: opacity 280ms ease-out;
        }
        #rwaBootLoader.is-hiding { opacity: 0; }
        /* (v648) 운영자: '로딩 애니메이션 좀 더 크게, 텍스트도 더 크게.'
           spinner 44 → 72, border 3 → 5. label 11 → 18px. */
        #rwaBootLoader .rwa-spinner {
          width: 72px; height: 72px;
          border: 5px solid rgba(124,58,237,0.15);
          border-top-color: #7C3AED;
          border-radius: 50%;
          animation: rwaSpin 0.9s linear infinite;
        }
        #rwaBootLoader .rwa-loading-label {
          font-family: 'Space Grotesk', 'Pretendard', system-ui, sans-serif;
          font-size: 18px; letter-spacing: 4px; text-transform: uppercase;
          color: #7C3AED; font-weight: 800;
        }
        @keyframes rwaSpin { to { transform: rotate(360deg); } }
      `;
      const style = document.createElement('style');
      style.id = 'rwaBootLoaderStyle';
      style.textContent = css;
      document.head.appendChild(style);

      document.body.classList.add('rwa-booting');
      const loader = document.createElement('div');
      loader.id = 'rwaBootLoader';
      loader.innerHTML = '<div class="rwa-spinner"></div><div class="rwa-loading-label">LOADING</div>';
      document.body.appendChild(loader);
    } catch (_) {}
  };

  const __removeBootLoader = () => {
    try {
      // (2026-06-17 v915) head early-booting 클래스 해제 (본문 표시). app.js 부트 완료 시점.
      document.documentElement.classList.remove('rwa-booting-early');
      const loader = document.getElementById('rwaBootLoader');
      if (!loader) {
        document.body.classList.remove('rwa-booting');
        return;
      }
      loader.classList.add('is-hiding');
      // 헤더가 보이도록 본문 visibility 해제 직후, 오버레이 페이드 아웃
      document.body.classList.remove('rwa-booting');
      setTimeout(() => { try { loader.remove(); } catch (_) {} }, 320);
    } catch (_) {
      try { document.body.classList.remove('rwa-booting'); } catch (_) {}
    }
  };

  const bootError = (e) => {
    console.error(e);
    // (v527) 부팅 실패 시에도 본문 가림 해제 — 사용자가 에러 메시지 확인 가능.
    try { __removeBootLoader(); } catch (_) {}
    releaseI18nHold();
    const t = document.querySelector("#toast");
    if (t) {
      t.classList.remove("hidden");
      t.classList.add("bad");
      t.textContent = e?.message || "스크립트 오류";
    } else {
      alert(e?.message || "스크립트 오류");
    }
  };

  // (v625) 페이지 이동 로딩 가속 — 의존성이 직렬 await 였던 것을 모두
  // 모듈-eval 시점에 병렬로 시작. 이후 await 는 await Promise.all 패턴.
  // - i18nLoad: 기존 (모듈 eval 시점 시작)
  // - walletAdapterLoad / coreLoad / pageJsLoad: 신규 — 의존성 순서는 유지
  //   되어야 하므로 ".then" chain 으로 직렬 실행, 단 fetch 자체는 모두
  //   parallel 로 시작.
  // - serviceStateLoad: 신규 — service-state API 도 병렬 시작.
  // (2026-06-17 v916) A: 직렬 fetch 병목 제거 — core.js 는 coreLoad(=walletAdapter
  //   .then)라 wallet 로드가 끝나야 fetch 가 시작돼 ~0.4초가 직렬로 쌓였다. preload 로
  //   fetch 만 즉시 병렬 시작(캐시 적재)하고, 아래 loadScript 의 eval 순서(의존성)는
  //   그대로 유지 → 같은 <script> 가 preload 캐시를 hit 해 네트워크 대기 없이 실행.
  const __preloadScript = (src) => {
    try {
      if (document.querySelector(`link[rel="preload"][data-rwa-pl="${src}"]`)) return;
      const l = document.createElement('link');
      l.rel = 'preload'; l.as = 'script'; l.href = src;
      l.setAttribute('data-rwa-pl', src);
      document.head.appendChild(l);
    } catch (_) {}
  };
  __preloadScript(`/user/assets/js/core.js?v=${encodeURIComponent(APP_VER)}`);

  const i18nLoad = loadScript(`/user/assets/js/i18n.js?v=${encodeURIComponent(APP_VER)}`);
  const walletAdapterLoad = loadScript(`/user/assets/js/wallet-adapter.js?v=${encodeURIComponent(APP_VER)}`);
  const coreLoad = walletAdapterLoad.then(() =>
    loadScript(`/user/assets/js/core.js?v=${encodeURIComponent(APP_VER)}`)
  );
  const domReady = document.readyState === "loading"
    ? new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }))
    : Promise.resolve();

  // (2026-05-16 v402) state=closed redirect 가드.
  //   admin 이 wind-down 5단계 (영구 폐쇄) 실행 시 모든 user 페이지가
  //   /user/closed.html 로 자동 전환. closed.html 자체는 window
  //   .__RWA_SKIP_CLOSED_REDIRECT__ 플래그로 우회 — 무한 루프 방지.
  //   landing.html 도 우회 — 폐쇄 후에도 마케팅 페이지는 접근 허용.
  //
  // (2026-05-18 v467) wind-down 도중 page-level 차단 추가. 운영자 보고:
  //   "스왑 시도 이전에 페이지 접근만으로도 사용 불가 팝업 필요". 기존엔
  //   사용자가 SWAP 버튼 눌러야 423 응답 → STAKING-style 모달 표시. 이제
  //   service-state 가 active 가 아닌 동안 transactional 페이지(swap,
  //   funding) 에 진입하면 full-screen blocking overlay 로 즉시 안내.
  //   staking 페이지는 unstake (출구) 가 여전히 허용되므로 차단 안 함.
  const PAGES_BLOCKED_DURING_WINDDOWN = new Set(['swap', 'funding']);

  const _resolveBootLang = () => {
    try {
      const v = String(localStorage.getItem('rwa_lang_user_v1') || 'en').trim().toLowerCase();
      return v === 'ko' ? 'ko' : 'en';
    } catch (_) { return 'en'; }
  };

  const showWindDownBlockOverlay = (page) => {
    if (document.getElementById('__rwa_winddown_block_overlay')) return;
    const isKo = _resolveBootLang() === 'ko';
    const labels = isKo ? {
      title: '서비스 일시 사용 제한',
      body: '서비스 운영 종료 절차가 진행 중입니다. 신규 거래는 차단되었으며, 보유 자산의 출금/언스테이킹/이자 청구는 마감일까지 계속 가능합니다.',
      portfolio: '포트폴리오로',
      close: '닫기',
    } : {
      title: 'SERVICE UNAVAILABLE',
      body: 'Service wind-down in progress. New transactions are blocked. Withdrawals, unstaking, and interest claims remain available until the deadline.',
      portfolio: 'Go to Portfolio',
      close: 'Close',
    };
    const overlay = document.createElement('div');
    overlay.id = '__rwa_winddown_block_overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(8,8,16,0.78)', 'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:24px', 'font-family:\'Inter\',\'Pretendard\',system-ui,sans-serif',
    ].join(';');
    overlay.innerHTML = ''
      + '<div style="background:#15151f;border:1px solid #ef4444;border-radius:16px;'
      + 'padding:40px 32px;max-width:480px;width:100%;text-align:center;color:#f0f0f5;'
      + 'box-shadow:0 24px 64px rgba(0,0,0,0.55);">'
      +   '<div style="width:64px;height:64px;border-radius:50%;background:#ef4444;'
      +   'display:flex;align-items:center;justify-content:center;margin:0 auto 18px;'
      +   'font-size:32px;color:#fff;font-weight:900;">!</div>'
      +   '<h2 style="margin:0 0 12px;font-size:22px;font-weight:800;letter-spacing:2px;'
      +   'text-transform:uppercase;color:#ef4444;">' + labels.title + '</h2>'
      +   '<p style="margin:0 0 28px;color:#b0b0c0;line-height:1.6;font-size:14px;">'
      +     labels.body + '</p>'
      +   '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">'
      +     '<a href="/user/portfolio.html" style="display:inline-block;padding:12px 24px;'
      +     'background:#8b5cf6;color:#fff;text-decoration:none;border-radius:10px;'
      +     'font-weight:700;font-size:13px;letter-spacing:1px;">'
      +       labels.portfolio + '</a>'
      +     '<button type="button" id="__rwa_winddown_block_close" style="padding:12px 24px;'
      +     'background:transparent;color:#b0b0c0;border:1px solid #3a3a4a;border-radius:10px;'
      +     'font-weight:600;font-size:13px;letter-spacing:1px;cursor:pointer;">'
      +       labels.close + '</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(overlay);
    const closeBtn = document.getElementById('__rwa_winddown_block_close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        try { overlay.remove(); } catch (_) {}
      });
    }
  };

  const checkServiceState = async () => {
    if (window.__RWA_SKIP_CLOSED_REDIRECT__) return { skip: false, state: 'active' };
    try {
      const apiBase = (() => {
        try {
          const v = localStorage.getItem('rwa_api_base_v1');
          if (v) return String(v).replace(/\/+$/, '');
        } catch (_) {}
        return '';
      })();
      const r = await fetch(`${apiBase}/api/silica/service-state`, { method: 'GET', cache: 'no-store' });
      const data = await r.json().catch(() => ({}));
      const state = data?.state || 'active';
      if (state === 'closed') {
        location.replace('/user/closed.html');
        return { skip: true, state };
      }
      // wind-down 도중 거래 페이지 차단 — overlay 표시 후 page-specific JS 는
      //   계속 실행 (사용자가 잔액/이력 등은 볼 수 있도록). 단 SWAP 등 거래
      //   입력은 overlay 위로 막힘.
      if (state !== 'active') {
        const page = inferPage();
        if (PAGES_BLOCKED_DURING_WINDDOWN.has(page)) {
          // dom 이 준비된 후 overlay 표시.
          if (document.body) {
            showWindDownBlockOverlay(page);
          } else {
            document.addEventListener('DOMContentLoaded', () => showWindDownBlockOverlay(page), { once: true });
          }
        }
      }
      return { skip: false, state };
    } catch (e) {
      console.warn('[app] service-state check failed:', e?.message || e);
      return { skip: false, state: 'active' };
    }
  };

  // (v625) service-state fetch 도 모듈 eval 시점에 시작 → domReady 대기와 병렬.
  //   checkServiceState 는 DOM 의존성이 없는 순수 fetch + body 존재 시
  //   overlay 표시. domReady 이전에 fetch 가 시작되고, overlay show 부분은
  //   내부에서 DOMContentLoaded 가드 처리됨.
  const serviceStatePromise = checkServiceState();

  (async () => {
    try {
      await domReady;
      // (v527) 본문 visibility 가리기 + 스피너 — 헤더가 mount 되기 전 까지.
      __installBootLoader();

      // page 추론은 domReady 이후 (body 가 있어야 함).
      const page = inferPage();
      // (2026-06-17 v916) A: page.js 도 preload 로 즉시 병렬 fetch (eval 은 core 후 유지).
      __preloadScript(`/user/assets/js/pages/${encodeURIComponent(page)}.js?v=${encodeURIComponent(APP_VER)}`);
      // pages/{page}.js 도 즉시 fetch 시작 (단, 실행은 core 가 먼저 끝난 후).
      const pageJsLoad = coreLoad.then(() =>
        loadScript(`/user/assets/js/pages/${encodeURIComponent(page)}.js?v=${encodeURIComponent(APP_VER)}`)
          .catch(pageJsErr => {
            console.warn(`[app] pages/${page}.js 로드 실패 (무시):`, pageJsErr?.message || pageJsErr);
          })
      );

      // (2026-06-17 v920) C: 로더 조기 해제 — service-state 를 로더 블로킹에서 제외.
      //   기존엔 service-state API(~0.6초)까지 기다린 뒤 로더를 내렸다. 이제 스크립트 +
      //   헤더(boot)만 기다려 즉시 해제하고, service-state 는 백그라운드로 처리한다.
      //   (closed → closed.html redirect, wind-down → overlay 는 모두 checkServiceState
      //    내부에서 수행되므로, 정상 active 에선 로딩만 단축되고 드문 종료 상황은 약간
      //    늦게 차단된다.) 원복: 아래 Promise.all 에 serviceStatePromise 복원 + skip 가드.
      await Promise.all([
        i18nLoad,
        walletAdapterLoad,
        coreLoad,
        pageJsLoad,
      ]);

      await window.RwaCore.boot();
      // (v527) 헤더가 mount 된 직후 본문 가림 해제 + 스피너 fade-out.
      //   page-specific JS / i18n apply 는 본문이 보이는 상태로 계속 진행.
      __removeBootLoader();

      // (v920) service-state 백그라운드 — 로더 해제와 무관하게 종료/종료절차 차단 처리.
      serviceStatePromise.catch(() => {});

      // 지갑 미연결 시 공개 페이지가 아니면 landing으로 리다이렉트
      if (typeof window.RwaCore?.requireWalletOrRedirectLanding === "function") {
        if (!window.RwaCore.requireWalletOrRedirectLanding()) {
          // 리다이렉트 진행 중 — 페이지 로직/i18n 스킵
          return;
        }
      }

      if (typeof window.RwaCore?.isOtpUnlocked === "function" && !window.RwaCore.isOtpUnlocked()) {
        window.RwaI18n?.apply?.();
        releaseI18nHold();
        return;
      }

      // (2026-05-18 v557) Proactive 사용중지 status check — 어떤 페이지든
      //   wallet 이 연결된 사용자가 도착하면 즉시 /api/user/account/status 를
      //   호출. 사용중지 사용자는 403 + status='account_suspended' 응답을
      //   받고 core.js api() 인터셉터가 자동으로 landing.html 로 redirect
      //   (sessionStorage 에 정보 저장). 정상 사용자는 200 응답 → 무시 후
      //   페이지 로직 진행. 공개 페이지는 skip (그 자체가 로그인 불필요).
      try {
        const isPublic = typeof window.RwaCore?.isPublicPage === "function"
          ? window.RwaCore.isPublicPage()
          : false;
        if (!isPublic) {
          await window.RwaCore.api('/api/user/account/status', { method: 'GET' }).catch(() => {});
        }
      } catch (_) {}

      const fn = window.RwaPages?.[page];
      if (typeof fn === "function") await fn();
      window.RwaI18n?.apply?.();
      releaseI18nHold();

      // (2026-05-11 v277) Admin-published popup announcements — load
      //   after page-specific JS so RwaCore.api + RwaI18n are ready.
      //   Fire-and-forget; failures must not block page rendering.
      loadScript(`/user/assets/js/silica-popups.js?v=${encodeURIComponent(APP_VER)}`)
        .catch(err => console.warn("[app] silica-popups.js load failed (무시):", err?.message || err));
    } catch (e) {
      bootError(e);
    }
  })();

})();