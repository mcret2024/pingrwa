// public/assets/js/core.js
(() => {
  "use strict";

  // =========================
  // Storage
  // =========================
  const STORAGE = {
    wallet: "rwa_wallet_v3",
    adminKey: "rwa_admin_key_v1",
    apiBase: "rwa_api_base_v1",
  };

  // core.js 쿼리(v=1)에서 버전 자동 추출(캐시 갱신용)
  const CORE_VER = (() => {
    try {
      const src = document.currentScript?.src || "";
      const u = new URL(src, location.origin);
      return u.searchParams.get("v") || "1";
    } catch {
      return "1";
    }
  })();

  // =========================
  // Utils
  // =========================
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // (2026-05-12 v298) Operator: '영어 페이지에서 한국어가 절대로 나오지
  //   않게 해라.' Wallet / OTP toasts and modal text used to be hardcoded
  //   Korean and bypassed the i18n.js DOM-translation pipeline (since
  //   toast() / textContent set strings imperatively). L(en) returns the
  //   English source for EN users and delegates to RwaI18n.translateString
  //   for KO users — every L() key needs a matching EN_SOURCE.ko entry
  //   in i18n.js so KO users still see Korean.
  const L = (en) => {
    try {
      const lang = (window.RwaI18n?.getLang?.() || "en").toLowerCase();
      if (lang === "ko" && window.RwaI18n?.translateString) {
        return window.RwaI18n.translateString(en);
      }
    } catch {}
    return en;
  };

  const readJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const writeJSON = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const getParam = (k) => {
    try {
      return new URLSearchParams(location.search).get(k);
    } catch {
      return null;
    }
  };

  const toast = (msg, kind = "info") => {
    const el = qs("#toast");
    if (!el) return;
    el.classList.remove("hidden");
    el.classList.toggle("good", kind === "good");
    el.classList.toggle("bad", kind === "bad");
    el.textContent = window.RwaI18n?.translateMessage?.(msg) || msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  };

  const localeOf = () => window.RwaI18n?.locale?.() || "ko-KR";

  const fmt = {
    num(n, d = 0) {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      // 소수점이 모두 0이면 표기 생략 — min=0, max=d 로 trailing zeros 자동 제거
      return x.toLocaleString(localeOf(), {
        minimumFractionDigits: 0,
        maximumFractionDigits: d,
      });
    },
    pct(n, d = 1) {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return `${x.toLocaleString(localeOf(), {
        minimumFractionDigits: 0,
        maximumFractionDigits: d,
      })}%`;
    },
    date(s) {
      if (!s) return "-";
      const d = new Date(s);
      if (isNaN(d)) return String(s);
      return d.toLocaleDateString(localeOf(), {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    },
    time(s) {
      if (!s) return "-";
      const d = new Date(s);
      if (isNaN(d)) return String(s);
      return d.toLocaleString(localeOf(), {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  };

  const money = {
    usdt(n, d = 2) {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return `${fmt.num(x, d)} USDT`;
    },
    krw(n) {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return `${fmt.num(x, 0)} KRW`;
    },
    fx(n) {
      const x = Number(n);
      if (!Number.isFinite(x) || x <= 0) return "-";
      return `1 USDT = ${fmt.num(x, 0)} KRW`;
    },
  };

  // 경로를 절대경로로 변환 (.htaccess에서 /assets/ -> user/assets/ 리라이트)
  const absUrl = (p) => {
    let s = String(p || "").trim();
    if (!s) return "";
    // (2026-05-26 v843) /uploads/* → /api/file/* 자동 변환.
    //   Hostinger 자동 배포가 /uploads/ 폴더를 매 deploy 마다 wipe 하는 문제로
    //   파일은 UPLOAD_DIR (배포 zone 밖) 에 저장되고 PHP /api/file 라우트로
    //   serve. .htaccess 의 rewrite 가 적용 안 되는 환경 (dot file skip) 에
    //   대비해 frontend 에서도 같은 swap 수행.
    if (s.startsWith('/uploads/')) {
      s = '/api/file/' + s.substring('/uploads/'.length);
    } else if (s.startsWith('uploads/')) {
      s = '/api/file/' + s.substring('uploads/'.length);
    }
    if (/^(https?:)?\/\//i.test(s)) return s;
    if (s.startsWith("/")) return s;
    return `/${s}`;
  };

  const DEFAULT_ASSET_IMAGE = "/user/assets/images/default-asset.svg";
  const DEFAULT_TOKEN_IMAGE = "/user/assets/images/default-token.svg";

  const assetImageUrl = (src) => absUrl(src || "") || DEFAULT_ASSET_IMAGE;
  const tokenImageUrl = (src) => absUrl(src || "") || DEFAULT_TOKEN_IMAGE;

  // =========================
  // Header / Footer include
  // =========================
  const ensureToastEl = () => {
    if (qs("#toast")) return;
    const el = document.createElement("div");
    el.id = "toast";
    el.className = "pill hidden";
    el.setAttribute(
      "style",
      "position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:999; max-width:min(520px, calc(100% - 28px));"
    );
    document.body.appendChild(el);
  };

  // (2026-05-12 v283) 운영자: '유저 페이지 언어 변환기가 작동하지 않는다.'
  //   site-header.html 의 인라인 <script> 는 innerHTML 로 주입되면 실행되지
  //   않으므로 (HTML 스펙) KO/EN 버튼 클릭 핸들러가 영영 attach 되지 않았다.
  //   admin.header.js 의 bindAdminLangToggle() 과 동일한 구조로 core.js 에
  //   바인더를 두고, ensureHeader() 가 헤더를 주입한 직후 명시적으로 호출.
  const bindUserLangToggle = () => {
    const buttons = document.querySelectorAll('header.site-header .lang-toggle .lang-btn');
    if (!buttons.length) return false;
    const LANG_KEY = 'rwa_lang_user_v1';
    const readCur = () => {
      try { return (localStorage.getItem(LANG_KEY) || 'en').trim().toLowerCase(); }
      catch (_) { return 'en'; }
    };
    const current = readCur();
    buttons.forEach((btn) => {
      const lang = (btn.getAttribute('data-lang') || '').trim().toLowerCase();
      if (lang === current) btn.classList.add('active');
      else btn.classList.remove('active');
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const next = (btn.getAttribute('data-lang') || '').trim().toLowerCase();
        if (!next || next === readCur()) return;
        try {
          localStorage.setItem(LANG_KEY, next);
          window.RwaI18n?.setLang?.(next);
        } catch (e) {
          console.warn('[core] user lang switch failed', e);
        }
        location.reload();
      });
    });
    return true;
  };

  // (2026-05-12 v318) 운영자: '모바일에서 메뉴를 눌려도 메뉴가 펼쳐지지
  //   않는 문제가 있다.' Same root cause as the v283 lang-toggle issue
  //   above — the mobile drawer's bind script was inlined in
  //   site-header.html and never executed because mount.innerHTML
  //   doesn't run <script> tags. Mirror the bindUserLangToggle pattern:
  //   define the binder here and have ensureHeader() call it after the
  //   markup lands.
  const bindMobileDrawer = () => {
    const ham      = document.getElementById('mobileHamBtn');
    const drawer   = document.getElementById('mobileDrawer');
    const backdrop = document.getElementById('mobileBackdrop');
    const closeBtn = document.getElementById('mobileDrawerClose');
    if (!ham || !drawer || !backdrop) return false;
    if (ham.dataset.bound === '1') return true;
    ham.dataset.bound = '1';

    const open = () => {
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');
      ham.classList.add('is-open');
      ham.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.classList.add('mobile-drawer-open');
    };
    const close = () => {
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      ham.classList.remove('is-open');
      ham.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('mobile-drawer-open');
    };

    ham.addEventListener('click', (e) => {
      e.preventDefault();
      drawer.classList.contains('is-open') ? close() : open();
    });
    backdrop.addEventListener('click', close);
    if (closeBtn && closeBtn.dataset.bound !== '1') {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', close);
    }

    // Global ESC handler (idempotent via dataset flag on document)
    if (!document.body.dataset.mobileDrawerEsc) {
      document.body.dataset.mobileDrawerEsc = '1';
      document.addEventListener('keydown', (e) => {
        const d = document.getElementById('mobileDrawer');
        if (e.key === 'Escape' && d && d.classList.contains('is-open')) close();
      });
    }

    // Auto-close on link tap (so navigation proceeds)
    drawer.querySelectorAll('.mobile-link').forEach((a) => {
      if (a.dataset.bound === '1') return;
      a.dataset.bound = '1';
      a.addEventListener('click', () => setTimeout(close, 30));
    });

    // Auto-close past breakpoint (idempotent via flag)
    if (!window.__mobileDrawerResize) {
      window.__mobileDrawerResize = true;
      window.addEventListener('resize', () => {
        const d = document.getElementById('mobileDrawer');
        if (window.innerWidth > 768 && d && d.classList.contains('is-open')) close();
      });
    }
    return true;
  };

  // (2026-05-14 v347) 운영자: '14~16일 재해 + 17일 정상화 시 자동 배너.'
  //   /api/silica/payment-status 폴링 후 has_pending → 사이트 헤더 아래
  //   붉은 sticky 배너. KO/EN 자동 토글. 세션 dismissible.
  const bindPaymentDelayAlert = () => {
    const box = document.getElementById('paymentDelayAlert');
    if (!box) return false;

    // (2026-05-14 v348) 운영자: '모든 모달들은 유저가 지갑을 연결하여
    //   로그인했을 때에만 나타나야한다.' 지갑 미연결 사용자에게는 배너 +
    //   모달 둘 다 숨김. updateWalletUI() 가 wallet state 바뀔 때마다
    //   bindPaymentDelayAlert() 재호출하므로 연결 직후 즉시 노출 가능.
    const wallet = getWallet();
    const modal = document.getElementById('pdModal');
    if (!wallet || !wallet.connected) {
      box.style.display = 'none';
      if (modal) modal.hidden = true;
      // dataset.bound 는 일부러 설정 안 함 → 다음 호출 시 다시 평가
      return false;
    }

    if (box.dataset.bound === '1') return true;
    box.dataset.bound = '1';

    const SESSION_KEY = 'silica_payment_alert_dismissed';
    const MODAL_SESSION_KEY = 'silica_payment_modal_dismissed';
    const KO_TITLE = '이자/배당 지급 지연 안내';
    const EN_TITLE = 'Interest / Dividend Payment Delay Notice';
    const getLang = () => {
      try {
        const v = (localStorage.getItem('rwa_lang_user_v1') || 'en').toLowerCase();
        return v === 'ko' ? 'ko' : 'en';
      } catch (_) { return 'en'; }
    };

    const showAlert = (data) => {
      const lang = getLang();
      const title = lang === 'ko' ? KO_TITLE : EN_TITLE;
      const body  = lang === 'ko' ? (data.message_ko || '') : (data.message_en || '');

      // (1) 배너 — 세션 dismissible
      if (sessionStorage.getItem(SESSION_KEY) !== '1') {
        const titleEl = document.getElementById('paymentDelayTitle');
        const bodyEl = document.getElementById('paymentDelayBody');
        const closeBtn = document.getElementById('paymentDelayClose');
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.textContent = body;
        box.style.display = 'block';
        box.hidden = false;
        if (closeBtn) {
          closeBtn.onclick = () => {
            try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}
            box.style.display = 'none';
          };
        }
      }

      // (2) 모달 — 페이지 진입 시 1회 (v347c)
      const modal = document.getElementById('pdModal');
      const mTitle = document.getElementById('pdModalTitle');
      const mBody = document.getElementById('pdModalBody');
      if (modal && sessionStorage.getItem(MODAL_SESSION_KEY) !== '1') {
        if (mTitle) mTitle.textContent = title;
        if (mBody) mBody.textContent = body;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        const closeModal = () => {
          modal.hidden = true;
          document.body.style.overflow = '';
          try { sessionStorage.setItem(MODAL_SESSION_KEY, '1'); } catch (_) {}
        };
        modal.addEventListener('click', (e) => {
          if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-pd-close')) closeModal();
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !modal.hidden) closeModal();
        });
      }
    };

    (async () => {
      try {
        const r = await api('/api/silica/payment-status', { method: 'GET' });

        // (2026-05-18 v570) 운영자 진단용 — '계속 나타난다' 보고 후
        //   F12 콘솔에서 즉시 원인을 식별할 수 있게 응답을 풀어서 노출.
        //   - fresh_install_short_circuit 필드 부재 → 배포된 PHP 가 v570 이전
        //   - has_pending=true 일 때 어느 경로 (배당 / 이자) 가 트리거인지 명시
        //   - overdue_dividends 가 있다면 각 행의 id + payout_month 출력
        try {
          const tag = '%c[payment-status]';
          const styleHead = 'background:#7c3aed;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700';
          const styleWarn = 'background:#dc2626;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700';
          const styleOk   = 'background:#16a34a;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700';

          // 응답이 v570 이전 형식인지 (fresh_install_short_circuit 키 미존재)
          const hasV570Field = Object.prototype.hasOwnProperty.call(r || {}, 'fresh_install_short_circuit');
          if (!hasV570Field) {
            console.warn(tag + ' %c⚠ DEPLOYED PHP IS PRE-v570',
              styleHead, styleWarn,
              '— response is missing `fresh_install_short_circuit`. Server has not picked up the v570 patch yet. Check that the latest php-api/routes/admin_silica_dividend.php is deployed and PHP-FPM (or opcache) has been reset.');
          }

          if (r && r.has_pending) {
            console.warn(tag + ' %chas_pending=TRUE',
              styleHead, styleWarn, '— banner/modal WILL show.');
            console.warn(tag + ' full response:', styleHead, r);

            // 트리거 분해
            const triggers = [];
            if (Array.isArray(r.overdue_dividends) && r.overdue_dividends.length) {
              triggers.push(`overdue_dividends (${r.overdue_dividends.length} rows in dividend_executions)`);
            }
            if (r.overdue_interest) triggers.push('overdue_interest (cron_accrual_done_YYYY-MM missing AND interest_claims has rows for PRIOR months — v572)');
            console.warn(tag + ' triggers:', styleHead, triggers.length ? triggers.join(' + ') : '(none — server bug?)');

            if (Array.isArray(r.overdue_dividends) && r.overdue_dividends.length) {
              console.warn(tag + ' overdue dividend executions:', styleHead);
              console.table(r.overdue_dividends);
              console.warn(tag + ' %cFix:', styleHead, styleWarn,
                'DELETE from dividend_executions WHERE id IN (' +
                r.overdue_dividends.map(d => d.id).join(',') +
                ')  — OR mark them as paid/cancelled via admin UI.');
            }
            if (r.overdue_interest) {
              const ym = new Date().toISOString().slice(0, 7);
              console.warn(tag + ' %cFix:', styleHead, styleWarn,
                `Either (a) actually run the monthly interest cron for ${ym}, or (b) mark it done manually:\n` +
                `   INSERT INTO app_settings (k, v) VALUES ('cron_accrual_done_${ym}', JSON_QUOTE(NOW())) ` +
                `ON DUPLICATE KEY UPDATE v=VALUES(v);`);
            }
          } else {
            console.info(tag + ' %chas_pending=false',
              styleHead, styleOk,
              r?.fresh_install_short_circuit === true
                ? '— fresh install short-circuit fired (v570). No activity in DB.'
                : '— evaluated normally; no overdue items.');
          }
        } catch (logErr) {
          console.error('[payment-status] diagnostic logging failed (non-fatal):', logErr);
        }

        if (r && r.has_pending) showAlert(r);
      } catch (e) {
        // (v570) 네트워크/auth 실패도 콘솔에 명시 — 평소엔 silent 였음.
        console.warn('[payment-status] request failed:', e?.message || e);
      }
    })();
    return true;
  };

  // (2026-05-18 v541) 운영자 보고: 'kyc-certification.html 에 헤더가 2개
  //   나온다'. 원인: 페이지에 #siteHeaderMount 가 없을 때 ensureHeader 가
  //   `injectAll(document.body, …)` 경로로 떨어지는데, 그 안에 await fetch
  //   가 있어 두 번째 호출(load 이벤트로 시작된 _runOnce → init → C.boot →
  //   ensureHeader) 이 첫 호출의 await 도중 같은 코드로 진입하면 둘 다
  //   `already` 체크가 null 을 반환 → 두 번 inject. promise 캐시로 멱등화.
  let _ensureHeaderPromise = null;
  const ensureHeader = async () => {
    if (_ensureHeaderPromise) return _ensureHeaderPromise;
    _ensureHeaderPromise = (async () => {
      const already = qs('header.site-header[data-included="1"]');
      if (already) {
        // 헤더가 이미 있어도 lang 버튼 핸들러는 미바인딩일 수 있어 1회 추가 시도.
        bindUserLangToggle();
        bindMobileDrawer();
        bindPaymentDelayAlert();
        return;
      }

      const mount = qs("#siteHeaderMount");
      const existing = qs("header.site-header");

      const url = `${absUrl("assets/includes/site-header.html")}?v=${encodeURIComponent(CORE_VER)}`;
      // Use force-cache (?v= 쿼리가 cache-buster 역할) — no-store 이면 매 페이지 로드마다 네트워크 왕복
      // → 헤더가 늦게 표시되는 주된 원인. 버전이 바뀌면 새 URL 이라 자동 무효화.
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error(`헤더 로드 실패 (${res.status})`);
      const html = await res.text();

      const injectAll = (parent, beforeEl) => {
        const wrap = document.createElement("div");
        wrap.innerHTML = html;

        const nodes = Array.from(wrap.children);
        nodes.forEach((n) => {
          if (beforeEl) parent.insertBefore(n, beforeEl);
          else parent.appendChild(n);
        });

        const hdr = parent.querySelector("header.site-header");
        if (hdr) hdr.dataset.included = "1";
        window.RwaI18n?.apply?.(parent);
        bindUserLangToggle();
        bindMobileDrawer();
        bindPaymentDelayAlert();
      };

      if (mount) {
        mount.innerHTML = html;
        const hdr = mount.querySelector("header.site-header");
        if (hdr) hdr.dataset.included = "1";
        window.RwaI18n?.apply?.(mount);
        bindUserLangToggle();
        bindMobileDrawer();
        bindPaymentDelayAlert();
        return;
      }

      if (existing && existing.parentNode) {
        const parent = existing.parentNode;
        injectAll(parent, existing);
        parent.removeChild(existing);
        return;
      }

      injectAll(document.body, document.body.firstChild);
    })();

    try {
      await _ensureHeaderPromise;
    } catch (e) {
      // 실패 시 캐시 해제 — 다음 호출에서 재시도 가능.
      _ensureHeaderPromise = null;
      throw e;
    }
  };

  // (v541) ensureHeader 와 동일한 race 회피 — promise 캐시로 멱등화.
  let _ensureFooterPromise = null;
  const ensureFooter = async () => {
    if (_ensureFooterPromise) return _ensureFooterPromise;
    _ensureFooterPromise = (async () => {
      const already = qs('footer.footer[data-included="1"]');
      if (already) return;

      const mount = qs("#siteFooterMount");
      const existing = qs("footer.footer");

      const url = `${absUrl("assets/includes/site-footer.html")}?v=${encodeURIComponent(CORE_VER)}`;
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error(`푸터 로드 실패 (${res.status})`);
      const html = await res.text();

      const injectAll = (parent, beforeEl) => {
        const wrap = document.createElement("div");
        wrap.innerHTML = html;

        const nodes = Array.from(wrap.children);
        nodes.forEach((n) => {
          if (beforeEl) parent.insertBefore(n, beforeEl);
          else parent.appendChild(n);
        });

        const ftr = parent.querySelector("footer.footer");
        if (ftr) ftr.dataset.included = "1";
        window.RwaI18n?.apply?.(parent);
      };

      if (mount) {
        // 이중 푸터 방지: 페이지에 정적 footer 가 함께 있으면 제거
        if (existing && existing.parentNode && !mount.contains(existing)) {
          existing.parentNode.removeChild(existing);
        }
        mount.innerHTML = html;
        const ftr = mount.querySelector("footer.footer");
        if (ftr) ftr.dataset.included = "1";
        window.RwaI18n?.apply?.(mount);
        paintFooterVersion(mount);
        return;
      }

      if (existing && existing.parentNode) {
        const parent = existing.parentNode;
        injectAll(parent, existing);
        parent.removeChild(existing);
        paintFooterVersion(parent);
        return;
      }

      injectAll(document.body, null);
      paintFooterVersion(document.body);
    })();

    try {
      await _ensureFooterPromise;
    } catch (e) {
      _ensureFooterPromise = null;
      throw e;
    }
  };

  // (2026-05-11 v227) Dynamic footer version. Inline <script> blocks
  //   inserted via innerHTML are inert (browser security), so the
  //   site-footer.html template can't run its own version-setter.
  //   Doing it here in core.js — which IS a real script — works.
  //   Reads the cache-buster from any silica-data-bind.js / app.js
  //   <script> tag and reformats '20260508v226-versionline' as
  //   'v2026.05.08 · v226-versionline · Solana Devnet'.
  const paintFooterVersion = (scope) => {
    try {
      const el = (scope || document).querySelector("#siteVersion") ||
                 document.querySelector("#siteVersion");
      if (!el) return;
      const fallback = el.dataset.staticFallback || "2026.04.26 · Solana Devnet";
      const scripts = document.querySelectorAll(
        'script[src*="silica-data-bind.js"], script[src*="app.js"]'
      );
      let ver = "";
      for (let i = 0; i < scripts.length && !ver; i++) {
        const m = String(scripts[i].src || "").match(/[?&]v=([^&#]+)/);
        if (m) ver = decodeURIComponent(m[1]);
      }
      let label = fallback;
      if (ver) {
        const parts = ver.split("v");
        if (parts.length >= 2 && /^\d{8}$/.test(parts[0])) {
          const raw = parts[0];
          const tag = parts.slice(1).join("v");
          const datePart = raw.slice(0, 4) + "." + raw.slice(4, 6) + "." + raw.slice(6, 8);
          label = datePart + " · v" + tag + " · Solana Devnet";
        } else {
          label = ver + " · Solana Devnet";
        }
      }
      el.textContent = "v" + label;
    } catch (_) { /* keep static fallback */ }
  };

  // =========================
  // Tabs (필수: asset-detail.js가 사용)
  // =========================
  const bindTabs = (root = document) => {
    const btns = qsa("[data-tab-btn]", root);
    if (!btns.length) return;

    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-tab-btn");
        btns.forEach((b) => b.classList.toggle("active", b === btn));
        qsa("[data-tab]", root).forEach((tab) => {
          tab.classList.toggle("hidden", tab.getAttribute("data-tab") !== key);
        });
      });
    });
  };

  // =========================
  // Wallet
  // =========================
  const getWallet = () =>
    readJSON(STORAGE.wallet, {
      connected: false,
      address: null,
      token: null,
      mode: "none",
    });

  const setWallet = (w) => writeJSON(STORAGE.wallet, w);

  const u8ToBase64 = (u8) => {
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  };

  const getApiBase = () => {
    const v = localStorage.getItem(STORAGE.apiBase);
    return v ? String(v).trim() : "";
  };

const WRITE_REQUEST_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FETCH_IDEMPOTENCY_COOLDOWN_MS = 1200;
const inFlightWriteFetches = new Map();

const stableStringify = (value) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
};

const hashFingerprint = (input) => {
  const text = String(input || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const snapshotResponse = async (res) => {
  let body = null;
  try {
    body = await res.clone().arrayBuffer();
  } catch (_) {
    body = null;
  }
  return {
    status: res.status,
    statusText: res.statusText,
    headers: Array.from(res.headers.entries()),
    body,
  };
};

const cloneResponseFromSnapshot = (snapshot) =>
  new Response(snapshot?.body ? snapshot.body.slice(0) : null, {
    status: snapshot?.status || 200,
    statusText: snapshot?.statusText || "",
    headers: snapshot?.headers || [],
  });

const formDataSignature = (formData) => {
  const parts = [];
  formData.forEach((value, key) => {
    if (value instanceof File) {
      parts.push(`${key}=file:${value.name}:${value.size}:${value.type || ""}:${value.lastModified || 0}`);
      return;
    }
    parts.push(`${key}=${String(value)}`);
  });
  parts.sort();
  return parts.join("&");
};

const buildRequestSignature = (body) => {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (body instanceof FormData) return formDataSignature(body);
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof Blob) return `blob:${body.size}:${body.type || ""}`;
  if (body instanceof ArrayBuffer) return `buffer:${body.byteLength}`;
  if (ArrayBuffer.isView(body)) return `buffer:${body.byteLength}`;
  if (typeof body === "object") return stableStringify(body);
  return String(body);
};

const resolveFetchUrl = (input) => {
  try {
    if (typeof input === "string") return new URL(input, location.href);
    if (input instanceof URL) return input;
    if (typeof Request !== "undefined" && input instanceof Request) return new URL(input.url, location.href);
  } catch (_) {}
  return null;
};

const buildWriteFetchMeta = (input, init = {}) => {
  const requestMethod = String(
    init?.method || (((typeof Request !== "undefined") && input instanceof Request && input.method) ? input.method : "GET")
  ).toUpperCase();

  if (!WRITE_REQUEST_METHODS.has(requestMethod)) return null;

  const url = resolveFetchUrl(input);
  if (!url || !/^\/api(?:\/|$)/.test(url.pathname)) return null;

  const body = Object.prototype.hasOwnProperty.call(init || {}, "body")
    ? init.body
    : undefined;

  const signature = `${requestMethod} ${url.origin}${url.pathname}${url.search}|${buildRequestSignature(body)}`;
  return {
    requestKey: signature,
    headerKey: `web:${hashFingerprint(signature)}`,
  };
};

const createFetchInitWithIdempotency = (input, init = {}, idempotencyKey) => {
  const nextInit = Object.assign({}, init || {});
  const headers = new Headers((init && init.headers) || (((typeof Request !== "undefined") && input instanceof Request) ? input.headers : undefined) || {});
  if (!headers.has("X-Idempotency-Key")) {
    headers.set("X-Idempotency-Key", idempotencyKey);
  }
  nextInit.headers = headers;
  return nextInit;
};

if (!window.__RWA_FETCH_IDEMPOTENCY_PATCHED__) {
  window.__RWA_FETCH_IDEMPOTENCY_PATCHED__ = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init = undefined) => {
    const meta = buildWriteFetchMeta(input, init || {});
    if (!meta) return nativeFetch(input, init);

    const existing = inFlightWriteFetches.get(meta.requestKey);
    if (existing) {
      return existing.snapshotPromise.then((snapshot) => cloneResponseFromSnapshot(snapshot));
    }

    const nextInit = createFetchInitWithIdempotency(input, init || {}, meta.headerKey);
    const pending = nativeFetch(input, nextInit).then(async (response) => {
      const snapshot = await snapshotResponse(response);
      return { response, snapshot };
    });

    const entry = {
      snapshotPromise: pending.then((item) => item.snapshot),
    };
    inFlightWriteFetches.set(meta.requestKey, entry);

    try {
      const { response } = await pending;
      return response;
    } finally {
      setTimeout(() => {
        if (inFlightWriteFetches.get(meta.requestKey) === entry) {
          inFlightWriteFetches.delete(meta.requestKey);
        }
      }, FETCH_IDEMPOTENCY_COOLDOWN_MS);
    }
  };
}

  const api = async (path, opt = {}) => {
    const base = getApiBase();
    const url = `${base}${path}`;
    const method = opt.method || "GET";
    const wallet = getWallet();

    const headers = Object.assign({ "Content-Type": "application/json" }, opt.headers || {});

    if (opt.auth !== false) {
      if (wallet?.token) headers.Authorization = `Bearer ${wallet.token}`;
      else if (wallet?.connected && wallet?.address) headers["x-wallet"] = wallet.address;
    }

    if (opt.admin) {
      const k = localStorage.getItem(STORAGE.adminKey) || "";
      if (k) headers["x-admin-key"] = k;
    }

    // (2026-05-08) Send the active locale to the backend so server-side
    //   error messages can be returned in the user's language. Site policy
    //   only ships EN and KO (other locales were dropped); default is EN.
    //   Anything else collapses to EN before being forwarded so a stale
    //   localStorage 'ja' / 'zh' value doesn't reach the backend.
    try {
      const rawLang = (window.RwaI18n?.getLang?.() || window.RwaI18n?.lang?.()
        || document.documentElement.getAttribute("data-rwa-lang")
        || window.__RWA_I18N_BOOT_LANG__
        || (localStorage.getItem("rwa_lang_user_v1") || "en"));
      const lang = String(rawLang || "en").toLowerCase() === "ko" ? "ko" : "en";
      headers["x-rwa-lang"] = lang;
    } catch (_) {}

    const res = await fetch(url, {
      method,
      headers,
      body: opt.body != null ? JSON.stringify(opt.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      // (2026-05-26 v857) i18n — fallback 메시지가 한글 하드코딩이라 영문 페이지에서도 한글 노출.
      const _fallbackFailMsg = (() => {
        try {
          const lang = (window.RwaI18n?.lang?.() || document.documentElement?.getAttribute('data-rwa-lang') || 'en').toLowerCase();
          if (lang === 'ko') return `요청 실패 (${res.status})`;
          if (lang === 'ja') return `リクエスト失敗 (${res.status})`;
          if (lang === 'zh') return `请求失败 (${res.status})`;
          return `Request failed (${res.status})`;
        } catch (_) { return `Request failed (${res.status})`; }
      })();
      const e = new Error(data.message || data.error || _fallbackFailMsg);
      e.status = res.status;
      e.detail = data.detail;
      e.data = data;
      // (2026-05-18 v556 → v557) 사용중지 사용자 — 글로벌 모달 + 강제 redirect.
      //   v556 은 모달만 표시했으나 사용자가 다른 페이지로 직접 URL 접근
      //   가능하면 우회되었다 ('사용중지 유저가 모든 페이지 접근 가능').
      //   v557: sessionStorage 에 정보 저장 → landing.html 로 강제 이동 →
      //   landing 의 boot 가 sessionStorage 를 읽어 모달 표시. 이로써 어떤
      //   protected API 호출이든 사용중지가 감지되면 즉시 landing 으로 추방.
      // (2026-05-26 v858) 401 안내 — Phantom 서명 미완료 케이스 가이드.
      //   지갑 연결만 하고 sign message 단계를 완료하지 않으면 JWT 가 없어
      //   API 호출이 401 로 막힘. 사용자는 "LOGIN IS REQUIRED" 만 보고 무엇을
      //   해야 하는지 모름. 글로벌 모달로 명확한 재연결 안내 (EN/KO).
      if (res.status === 401) {
        // (2026-06-16 v901) 미연결(둘러보기) 유저에겐 재연결 모달 스킵.
        //   배경: v900 페이지 개방 후, 미연결 유저가 페이지 진입만 해도 개인 API
        //   (portfolio/me/kyc) 자동 호출 → 401 → 이 '재연결' 모달이 기능 시도 없이도
        //   떴음(운영자 6/16 지적). 조치: 지갑이 연결된 상태(connected=true — 세션/서명
        //   만료)에서만 안내. 미연결은 기능 버튼의 connectWallet() 으로 연결 유도(2단계).
        //   Revert: 아래 if(w401?.connected) 가드 제거하고 모달 직접 호출.
        const w401 = (typeof getWallet === 'function') ? getWallet() : null;
        if (w401?.connected) {
          try { showSessionExpiredModal(); } catch (_) {}
        } else if (WRITE_REQUEST_METHODS.has(String(method || 'GET').toUpperCase())) {
          // (2026-06-16 v902 → 2026-06-17 v913) 미연결 + 기능 시도(write) → 지갑 연결
          //   안내. v902 는 toast 였으나 운영자 요청(6/17)으로 모달 팝업으로 강화.
          //   조회(GET)는 둘러보기라 스킵(v901). 스테이킹/스왑/클레임/입금/출금 등
          //   자체 가드 없던 버튼도 이 중앙 처리로 커버. Revert: 이 else if 블록 제거.
          try {
            showSessionExpiredModal('connect');
          } catch (_) {
            try {
              const _lang401 = (window.RwaI18n?.lang?.() || document.documentElement?.getAttribute('data-rwa-lang') || 'en').toLowerCase();
              toast(_lang401 === 'ko' ? '이 기능을 사용하려면 지갑을 연결하세요.' : 'Please connect your wallet to use this feature.', 'bad');
            } catch (_) {}
          }
        }
      }
      if (res.status === 403 && data?.status === 'account_suspended') {
        try {
          sessionStorage.setItem('rwa_account_suspended', JSON.stringify({
            suspended_reason: data.suspended_reason || '',
            suspended_at: data.suspended_at || '',
            shownAt: Date.now(),
          }));
        } catch (_) {}
        const path = String(location.pathname || '').toLowerCase();
        const isOnLanding = path.endsWith('/landing.html') || path.endsWith('/landing');
        if (isOnLanding) {
          // 이미 landing 이면 모달만 즉시 표시 (재귀 redirect 방지).
          try { showAccountSuspendedModal(data); } catch (_) {}
        } else {
          // 다른 페이지면 즉시 landing 으로. landing.js 가 sessionStorage 를 읽고 모달 표시.
          try { location.replace('/user/landing.html'); } catch { location.href = '/user/landing.html'; }
        }
      }
      throw e;
    }

    return data;
  };

  // (2026-05-18 v556) account suspended 안내 모달 — 어느 페이지에서든 401/403
  //   상황에 단 한 번만 표시. body 에 동적 inject, position:fixed 라 어떤
  //   페이지 레이아웃에도 안전. 디자인은 v554 withdraw block modal 과 동일
  //   톤 (빨강 gradient + 자물쇠 아이콘 + 'Account Suspended' 타이틀).
  // (2026-05-18 v560) 운영자: '팝업에 영문/국문 변환 버튼 구현해줘'. 우측 상단에
  //   EN/KO 토글 pill 추가. 클릭 시 즉시 텍스트 재렌더 + localStorage 의 사이트
  //   언어 설정도 함께 갱신해 다음 페이지에서도 그대로 적용.
  // (2026-05-26 v858) Session expired / wallet signature 미완료 안내 모달.
  //   401 응답 발생 시 단 한 번 표시. EN/KO 토글 지원 (운영 정책상 JA/ZH 미사용).
  let _sessionExpiredShown = false;
  function showSessionExpiredModal(mode) {
    if (_sessionExpiredShown) return;
    _sessionExpiredShown = true;
    // (2026-06-17 v913) mode='connect' → 미연결 유저가 기능(스테이킹/스왑/클레임/
    //   입금/출금) 시도 시 '지갑 연결' 안내. 기본(reconnect) → 세션 만료 재연결.
    const _isConnect = (mode === 'connect');

    const detectLang = () => {
      try {
        const l = (window.RwaI18n?.lang?.() || document.documentElement?.getAttribute('data-rwa-lang') || 'en').toLowerCase();
        return l === 'ko' ? 'ko' : 'en';
      } catch (_) { return 'en'; }
    };
    let curLang = detectLang();

    const texts = {
      en: _isConnect ? {
        title: 'Connect your wallet',
        body: 'Please connect your wallet to use this feature.',
        hint: 'Staking, Swap, Claim, Deposit and Withdrawal all require a connected wallet.',
        connect: 'Connect Wallet',
        close: 'Close',
      } : {
        title: 'Wallet sign-in required',
        body: 'Please reconnect your Phantom wallet and approve the signature request to continue.',
        hint: 'On mobile, open the Phantom app to see pending signature requests.',
        connect: 'Reconnect Wallet',
        close: 'Close',
      },
      ko: _isConnect ? {
        title: '지갑 연결이 필요합니다',
        body: '이 기능을 사용하려면 먼저 지갑을 연결해 주세요.',
        hint: '스테이킹·스왑·클레임·입금·출금은 지갑 연결 후 이용할 수 있습니다.',
        connect: '지갑 연결',
        close: '닫기',
      } : {
        title: '지갑 로그인이 필요합니다',
        body: 'Phantom 지갑을 다시 연결한 뒤 서명 요청을 승인해주세요.',
        hint: '모바일에서는 Phantom 앱을 열어 대기 중인 서명 요청이 있는지 확인하세요.',
        connect: '지갑 재연결',
        close: '닫기',
      },
    };

    if (!document.getElementById('__sessExpStyle')) {
      const style = document.createElement('style');
      style.id = '__sessExpStyle';
      style.textContent = `
        .sess-exp-modal { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: flex-start; justify-content: center; padding: 12vh 16px 0; }
        .sess-exp-backdrop { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.78); backdrop-filter: blur(8px); }
        .sess-exp-panel { position: relative; width: 100%; max-width: 460px; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px 26px 22px; color: #111; box-shadow: 0 24px 60px rgba(0,0,0,0.28); }
        .sess-exp-panel::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg,#8b5cf6,#ec4899); border-radius: 18px 18px 0 0; }
        .sess-exp-langtoggle { position: absolute; top: 14px; right: 16px; display: flex; gap: 4px; }
        .sess-exp-langtoggle button { padding: 4px 10px; font-size: 11px; font-weight: 700; letter-spacing: 1px; border-radius: 14px; border: 1px solid #e5e7eb; background: #f8fafc; color: #475569; cursor: pointer; }
        .sess-exp-langtoggle button.active { background: #111; color: #fff; border-color: #111; }
        .sess-exp-icon { font-size: 36px; margin-bottom: 12px; }
        .sess-exp-title { font-size: 20px; font-weight: 800; margin-bottom: 10px; color: #111; }
        .sess-exp-body { font-size: 14px; line-height: 1.6; margin-bottom: 6px; color: #334155; }
        .sess-exp-hint { font-size: 12px; line-height: 1.5; margin-bottom: 18px; color: #64748b; }
        .sess-exp-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .sess-exp-btn { padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #111; }
        .sess-exp-btn-primary { background: linear-gradient(135deg,#8b5cf6,#ec4899); color: #fff; border: none; }
      `;
      document.head.appendChild(style);
    }

    const root = document.createElement('div');
    root.className = 'sess-exp-modal';
    root.innerHTML = `
      <div class="sess-exp-backdrop"></div>
      <div class="sess-exp-panel" role="dialog" aria-modal="true">
        <div class="sess-exp-langtoggle">
          <button data-lang="en">EN</button>
          <button data-lang="ko">KO</button>
        </div>
        <div class="sess-exp-icon">🔒</div>
        <div class="sess-exp-title"></div>
        <div class="sess-exp-body"></div>
        <div class="sess-exp-hint"></div>
        <div class="sess-exp-actions">
          <button type="button" class="sess-exp-btn sess-exp-close"></button>
          <button type="button" class="sess-exp-btn sess-exp-btn-primary sess-exp-connect"></button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    const renderText = () => {
      const t = texts[curLang] || texts.en;
      root.querySelector('.sess-exp-title').textContent = t.title;
      root.querySelector('.sess-exp-body').textContent = t.body;
      root.querySelector('.sess-exp-hint').textContent = t.hint;
      root.querySelector('.sess-exp-connect').textContent = t.connect;
      root.querySelector('.sess-exp-close').textContent = t.close;
      root.querySelectorAll('.sess-exp-langtoggle button').forEach((b) => {
        b.classList.toggle('active', b.dataset.lang === curLang);
      });
    };
    renderText();

    root.querySelectorAll('.sess-exp-langtoggle button').forEach((b) => {
      b.addEventListener('click', () => {
        curLang = b.dataset.lang === 'ko' ? 'ko' : 'en';
        try { localStorage.setItem('rwa_lang_user_v1', curLang); } catch (_) {}
        renderText();
      });
    });

    const closeBtn = root.querySelector('.sess-exp-close');
    closeBtn.addEventListener('click', () => {
      try { root.remove(); } catch (_) {}
      _sessionExpiredShown = false;
    });

    const connectBtn = root.querySelector('.sess-exp-connect');
    connectBtn.addEventListener('click', async () => {
      try { root.remove(); } catch (_) {}
      _sessionExpiredShown = false;
      try {
        await disconnectWallet({ reload: false });
        await connectWallet();
        location.reload();
      } catch (e) {
        try { toast(e?.message || 'Reconnect failed', 'bad'); } catch (_) {}
      }
    });
  }

  // (2026-06-17 v925) 공통 지갑연결 게이트 — 미연결/미서명 시 연결 모달 표시 + false 반환.
  //   각 페이지(스왑/스테이킹/출금/입금) 실행 함수 시작에서:
  //     if (!window.RwaCore.requireWalletConnected()) return;
  //   기존 제각각인 toast/connectWallet 직접호출을 통일. 모달은 401 핸들러와 동일.
  // (2026-06-18 v926) FIX: 이 스코프(메인 IIFE)엔 `C` 바인딩이 없다(export 는 객체 리터럴,
  //   `const C = window.RwaCore` 는 맨 아래 별도 IIFE 에만 존재). v925 가 `C.` 로 적어
  //   런타임 ReferenceError → core.js 가 export(window.RwaCore=) 도달 전 죽어 전 페이지
  //   부팅 실패했다. bare const 로 정의하고 아래 export 객체에 등록한다.
  const requireWalletConnected = () => {
    try {
      const w = (typeof getWallet === 'function') ? getWallet() : null;
      if (w?.connected && w?.token) return true;
      try { showSessionExpiredModal('connect'); } catch (_) {}
      return false;
    } catch (_) { return false; }
  };

  let _acctSuspendModalShown = false;
  function showAccountSuspendedModal(data) {
    if (_acctSuspendModalShown) return;
    _acctSuspendModalShown = true;
    const reason = String(data?.suspended_reason || '').trim();
    const since  = data?.suspended_at || '';

    // CSS 한 번만 inject.
    if (!document.getElementById('__acctSuspendStyle')) {
      const style = document.createElement('style');
      style.id = '__acctSuspendStyle';
      style.textContent = `
        .acct-susp-modal { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: flex-start; justify-content: center; padding: 12vh 16px 0; }
        .acct-susp-backdrop { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.78); backdrop-filter: blur(8px); }
        .acct-susp-panel {
          position: relative; width: 100%; max-width: 480px;
          background: linear-gradient(135deg, #1a1f3a 0%, #2a1a4a 100%);
          border: 1px solid rgba(239, 68, 68, 0.40);
          border-radius: 18px; padding: 28px 26px 24px; color: #f8fafc;
          box-shadow: 0 25px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(239,68,68,0.10);
        }
        .acct-susp-panel::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #dc2626, #f97316, #dc2626);
          border-radius: 18px 18px 0 0;
        }
        /* (v560) 우측 상단 EN/KO 토글 pill */
        .acct-susp-lang {
          position: absolute; top: 14px; right: 14px;
          display: inline-flex; align-items: center;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 999px; padding: 2px; gap: 0;
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
        }
        .acct-susp-lang-btn {
          background: transparent; color: #cbd5e1; border: none;
          padding: 4px 10px; border-radius: 999px; cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .acct-susp-lang-btn:hover { color: #fff; }
        .acct-susp-lang-btn.active {
          background: linear-gradient(135deg, #7c3aed, #06b6d4);
          color: #fff;
        }
        .acct-susp-icon {
          display: flex; align-items: center; justify-content: center;
          width: 64px; height: 64px; margin: 0 auto 14px;
          background: rgba(239, 68, 68, 0.12);
          border: 2px solid rgba(239, 68, 68, 0.40);
          border-radius: 50%; font-size: 32px; color: #fca5a5;
        }
        .acct-susp-title {
          font-family: 'Bebas Neue', 'Oswald', sans-serif;
          font-size: 28px; letter-spacing: 1px;
          text-align: center; margin: 0 0 10px; color: #fecaca;
        }
        .acct-susp-msg {
          font-size: 14px; line-height: 1.6;
          text-align: center; color: #cbd5e1; margin-bottom: 16px;
        }
        .acct-susp-reason-box {
          margin: 14px 0 14px;
          padding: 12px 14px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
        }
        .acct-susp-reason-label {
          font-size: 10px; letter-spacing: 2px; font-weight: 700;
          color: #fca5a5; text-transform: uppercase; margin-bottom: 6px;
        }
        .acct-susp-reason-text {
          font-size: 14px; line-height: 1.5; color: #f8fafc; word-break: break-word;
        }
        .acct-susp-since {
          font-size: 11px; color: #94a3b8;
          text-align: center; margin-bottom: 18px;
          font-family: 'Space Grotesk', 'Inter', monospace;
        }
        .acct-susp-actions { display: flex; flex-direction: column; gap: 8px; }
        .acct-susp-btn-primary {
          width: 100%; padding: 12px;
          background: linear-gradient(135deg, #7c3aed, #06b6d4);
          color: #fff; border: none; border-radius: 10px;
          font-weight: 700; font-size: 14px; cursor: pointer;
          transition: transform 0.1s, box-shadow 0.15s;
        }
        .acct-susp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(124,58,237,0.35); }
        .acct-susp-btn-secondary {
          width: 100%; padding: 11px;
          background: transparent; color: #cbd5e1;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .acct-susp-btn-secondary:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.30); }
      `;
      document.head.appendChild(style);
    }

    // 모달 element — 토글 시 텍스트 부분만 갱신하므로 querySelector 로 다시 찾는다.
    const modal = document.createElement('div');
    modal.className = 'acct-susp-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="acct-susp-backdrop"></div>
      <div class="acct-susp-panel">
        <div class="acct-susp-lang" role="tablist" aria-label="Language">
          <button class="acct-susp-lang-btn" data-lang="en" type="button">EN</button>
          <button class="acct-susp-lang-btn" data-lang="ko" type="button">KO</button>
        </div>
        <div class="acct-susp-icon">🔒</div>
        <h2 class="acct-susp-title"></h2>
        <p class="acct-susp-msg"></p>
        ${(reason && reason !== 'admin_suspend')
          ? `<div class="acct-susp-reason-box">
               <div class="acct-susp-reason-label"></div>
               <div class="acct-susp-reason-text"></div>
             </div>`
          : ''}
        ${since ? `<div class="acct-susp-since"></div>` : ''}
        <div class="acct-susp-actions">
          <button class="acct-susp-btn-primary" data-act="home" type="button"></button>
          <button class="acct-susp-btn-secondary" data-act="contact" type="button"></button>
        </div>
      </div>
    `;

    // 현재 언어를 사이트 i18n 에서 시작, 모달 내부에선 토글 가능.
    let currentLang = (window.RwaI18n?.getLang?.() || 'en').toLowerCase() === 'ko' ? 'ko' : 'en';

    function renderText(lang) {
      const t = (en, ko) => lang === 'ko' ? ko : en;
      // 타이틀
      modal.querySelector('.acct-susp-title').textContent = t('Account Suspended', '계정 사용중지');
      // 본문
      modal.querySelector('.acct-susp-msg').textContent = t(
        'Your account has been suspended by the platform administrator. Trading, withdrawals, and other write actions are currently disabled.',
        '관리자에 의해 계정이 사용중지되었습니다. 거래·출금·기타 액션이 모두 차단된 상태입니다.'
      );
      // 사유 라벨 + 내용 (사유 텍스트는 운영자 작성이라 그대로 — 언어 무관)
      const reasonLabel = modal.querySelector('.acct-susp-reason-label');
      if (reasonLabel) reasonLabel.textContent = t('Reason', '사유');
      const reasonEl = modal.querySelector('.acct-susp-reason-text');
      if (reasonEl) reasonEl.textContent = reason;
      // 제재 시각
      const sinceEl = modal.querySelector('.acct-susp-since');
      if (sinceEl) {
        sinceEl.textContent = t('Suspended since: ', '제재 시각: ') + String(since);
      }
      // 버튼
      modal.querySelector('[data-act="home"]').textContent    = t('Go to Home', '홈으로 가기');
      modal.querySelector('[data-act="contact"]').textContent = t('Contact Support', '지원팀 문의');
      // 토글 활성 상태 동기화
      modal.querySelectorAll('.acct-susp-lang-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-lang') === lang);
      });
    }

    // 언어 토글 핸들러 — 클릭 시 currentLang 갱신 + 즉시 재렌더 + localStorage 도 함께 갱신.
    modal.querySelectorAll('.acct-susp-lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-lang') === 'ko' ? 'ko' : 'en';
        if (next === currentLang) return;
        currentLang = next;
        try {
          localStorage.setItem('rwa_lang_user_v1', next);
          // 다음 페이지 로드부터 사이트 전체에 반영. 현 페이지의 다른 요소는
          // 단순 모달 토글이라 의도적으로 건드리지 않음.
          if (typeof window.RwaI18n?.setLang === 'function') {
            window.RwaI18n.setLang(next);
          }
        } catch (_) {}
        renderText(next);
      });
    });

    // 액션 버튼
    modal.querySelector('[data-act="home"]')?.addEventListener('click', () => {
      location.href = '/user/landing.html';
    });
    modal.querySelector('[data-act="contact"]')?.addEventListener('click', () => {
      location.href = '/user/index.html';
    });

    // 초기 렌더 + DOM 부착
    renderText(currentLang);
    document.body.appendChild(modal);
  }

  const apiForm = async (path, formData, opt = {}) => {
    const base = getApiBase();
    const url = `${base}${path}`;
    const method = opt.method || "POST";
    const wallet = getWallet();

    const headers = Object.assign({}, opt.headers || {});
    if (opt.auth !== false) {
      if (wallet?.token) headers.Authorization = `Bearer ${wallet.token}`;
      else if (wallet?.connected && wallet?.address) headers["x-wallet"] = wallet.address;
    }
    if (opt.admin) {
      const k = localStorage.getItem(STORAGE.adminKey) || "";
      if (k) headers["x-admin-key"] = k;
    }

    const res = await fetch(url, { method, headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      // (2026-05-26 v857) i18n fallback (apiForm path).
      const _fmsg = (() => {
        try {
          const lang = (window.RwaI18n?.lang?.() || document.documentElement?.getAttribute('data-rwa-lang') || 'en').toLowerCase();
          if (lang === 'ko') return `요청 실패 (${res.status})`;
          if (lang === 'ja') return `リクエスト失敗 (${res.status})`;
          if (lang === 'zh') return `请求失败 (${res.status})`;
          return `Request failed (${res.status})`;
        } catch (_) { return `Request failed (${res.status})`; }
      })();
      throw new Error(data.message || _fmsg);
    }
    return data;
  };

  const setReferralMenuVisible = (visible) => {
    const link = qs("#navReferral");
    if (link) {
      link.style.display = visible ? "" : "none";
      link.setAttribute("aria-hidden", visible ? "false" : "true");

      const item = link.closest('.nav-item.has-sub, .nav-item[data-nav-group="portfolio"]');
      const caret = item ? item.querySelector(':scope > .nav-caret') : null;
      const submenu = item ? item.querySelector(':scope > .nav-sub, :scope > .nav-submenu') : null;
      if (caret) caret.style.display = visible ? "" : "none";
      if (submenu) {
        submenu.style.display = visible ? "" : "none";
        if (!visible) item?.classList.remove("is-open");
      }
    }

    // (2026-05-12 v316 → 2026-05-22 v792) Mobile drawer 의 Referral row 만
    // 추천인 승인 gating 적용. 이전 v316 은 'Referral 없으면 Portfolio 라벨이
    // 비어보일까봐' 전체 #mobileDrawerPortfolioSection 을 숨겼는데, 그 결과
    // 비-추천인 사용자가 모바일 메뉴에서 Portfolio 접근 불가 (운영자 보고).
    // Portfolio 는 모든 사용자가 접근해야 하는 기본 기능 → 섹션은 항상 노출,
    // Referral 링크만 조건부 숨김.
    const mobileRef = qs("#navReferralMobile");
    if (mobileRef) {
      mobileRef.style.display = visible ? "" : "none";
      mobileRef.setAttribute("aria-hidden", visible ? "false" : "true");
    }
    // (v792) Portfolio section 전체 숨김 제거 — 항상 노출. Referral 만 위에서 토글.
    const mobileSect = qs("#mobileDrawerPortfolioSection");
    if (mobileSect) {
      mobileSect.style.display = "";  /* 항상 노출 — 비추천인도 Portfolio 접근 가능 */
    }
  };

  const updateWalletUI = () => {
    const w = getWallet();
    const btn = qs("#walletBtn");
    const pill = qs("#walletPill");
    // Silica 헤더에는 #walletMenu 래퍼가 없음 — pill 자체에 hidden 토글.
    // (legacy RECON 변수명 'pillWrap' 은 제거)
    const portfolioLink = qs("#portfolioLink");
    const addrEl = pill ? qs(".addr", pill) : null;
    const addrFullEl = qs("#walletAddrFull");
    const avatarEl = pill ? qs(".rcn-avatar", pill) : null;

    // 지갑 연결 상태에 따라 Connect 버튼 <-> Wallet Pill 전환
    if (btn) {
      const lang = (window.RwaI18n?.getLang?.() || "ko");
      btn.textContent = lang === "en" ? "Connect Wallet" : "지갑 연결";
      btn.classList.add("primary");
      btn.classList.remove("danger");
      btn.classList.toggle("hidden", !!w.connected);
    }
    if (pill) pill.classList.toggle("hidden", !w.connected);
    if (portfolioLink) portfolioLink.classList.toggle("hidden", !w.connected);
    if (w.connected && w.address) {
      // (v612) 운영자: 'CnSeQJ...Aog 표기에서 앞 5개와 점2 까지만 표기 CnSeQ..'
      if (addrEl) addrEl.textContent = `${w.address.slice(0, 5)}..`;
      if (addrFullEl) addrFullEl.textContent = w.address;
      if (avatarEl) avatarEl.textContent = (w.address[0] || "R").toUpperCase();
    }
    if (!w.connected) setReferralMenuVisible(false);

    // body class 동기화 — CSS 가 메뉴 표시 여부 결정 (지갑 미연결 시 nav 숨김)
    try {
      document.body?.classList.toggle("no-wallet", !w.connected);
      document.body?.classList.toggle("has-wallet", !!w.connected);
    } catch (_) {}

    // (2026-05-26 v839) 헤더 로고 href 를 지갑 상태에 따라 swap.
    //   미연결: landing.html (홈/마케팅) — FOUC 없이 바로 진입.
    //   연결: index.html (대시보드) — 단골 사용자는 바로 자산 화면.
    //   site-header.html 의 data-href-connected 속성을 참조.
    try {
      const brand = document.querySelector('header.site-header .brand');
      if (brand) {
        const fallback = brand.dataset.hrefFallback || 'landing.html';
        const connected = brand.dataset.hrefConnected || 'index.html';
        if (!brand.dataset.hrefFallback) {
          brand.dataset.hrefFallback = brand.getAttribute('href') || 'landing.html';
        }
        brand.setAttribute('href', w.connected ? connected : (brand.dataset.hrefFallback || fallback));
      }
    } catch (_) {}

    // (2026-05-19 v591) About 메뉴 직접 토글 — body class 기반 CSS 규칙이
    //   타이밍 의존 (헤더 inject 가 wallet 상태 변경보다 빠르거나, MutationObserver
    //   가 늦게 잡는 경우 등) 으로 가끔 안 먹는 케이스 보고됨 (운영자 trade.html
    //   캡처). data-hidden-by-js attribute 로 명시 차단.
    try {
      const navLanding = document.getElementById("navLanding");
      const mobileLanding = document.querySelector('#mobileDrawer .mobile-link[href="landing.html"]');
      if (navLanding) {
        if (w.connected) navLanding.setAttribute("data-hidden-by-js", "1");
        else navLanding.removeAttribute("data-hidden-by-js");
      }
      if (mobileLanding) {
        if (w.connected) mobileLanding.setAttribute("data-hidden-by-js", "1");
        else mobileLanding.removeAttribute("data-hidden-by-js");
      }
    } catch (_) {}

    // (2026-05-14 v348) 지갑 상태 변경 시 payment-delay 알림 + 시스템 팝업
    //   재평가. 연결 → 알림 노출, 해제 → 즉시 숨김.
    try { bindPaymentDelayAlert(); } catch (_) {}
    try { window.SilicaPopups?.load?.(); } catch (_) {}
  };

  const refreshReferralNav = async () => {
    const link = qs("#navReferral");
    if (!link) return false;

    const w = getWallet();
    if (!w?.connected || !w?.token) {
      setReferralMenuVisible(false);
      return false;
    }

    try {
      const st = await api("/api/referral/my-status", { method: "GET", auth: true });
      const allowed = !!st?.is_referrer && !!st?.referrer_active;
      setReferralMenuVisible(allowed);
      return allowed;
    } catch {
      setReferralMenuVisible(false);
      return false;
    }
  };

  // (2026-05-14 v352) v349~v351 의 URL ?ref= 자동 캡처 / 자동 apply / 자동
  //   페이지 복귀 시스템을 모두 제거. 운영자 판단: '의미가 없는 것 같다.
  //   기존 정상 작동 기능들에 좋지 않은 영향이 있을까봐 걱정된다.' 추천인
  //   attribution 은 referral.html / assets.html 의 수동 입력 + Apply 흐름
  //   (v348 이전 동작) 으로 복귀.

  // =========================
  // OTP Gate (공통)
  // =========================
  let _OTP_UNLOCKED = true;

  function isOtpUnlocked() {
    return _OTP_UNLOCKED;
  }

  function otpEls() {
    return {
      modal: qs("#otpModal"),
      msg: qs("#otpMsg"),
      setupBox: qs("#otpSetupBox"),
      verifyBox: qs("#otpVerifyBox"),
      qr: qs("#otpQr"),
      secret: qs("#otpSecret"),

      btnSetup: qs("#otpSetupBtn"),
      btnVerify: qs("#otpVerifyBtn"),

      close: qs("#otpCloseBtn"),
      forceLogout: qs("#otpForceLogoutBtn"),

      codeSetup: qs("#otpCodeInputSetup"),
      codeVerify: qs("#otpCodeInputVerify"),
      enableBtn: qs("#otpEnableBtn"),
      verifyBtn: qs("#otpVerifyBtnDo"),
      backdrop: qs("#otpModal .otp-backdrop"),
    };
  }

  function showOtpModal(mode) {
    const E = otpEls();
    _OTP_UNLOCKED = false;

    if (!E.modal) {
      toast("OTP UI가 없습니다. site-header.html에 OTP 모달/버튼을 추가하세요.", "bad");
      return;
    }

    E.modal.classList.remove("hidden");
    E.modal.setAttribute("aria-hidden", "false");

    if (E.setupBox) E.setupBox.classList.toggle("hidden", mode !== "setup");
    if (E.verifyBox) E.verifyBox.classList.toggle("hidden", mode !== "verify");
  }

  function hideOtpModal() {
    const E = otpEls();
    if (!E.modal) return;
    E.modal.classList.add("hidden");
    E.modal.setAttribute("aria-hidden", "true");
  }

  async function refreshOtpGate() {
    const w = getWallet();
    const E = otpEls();

    let bypassed = false;
    try {
      const cfg = (typeof window.RwaCore?.getConfig === "function")
        ? await window.RwaCore.getConfig()
        : await api("/api/public/config", { method: "GET", auth: false });
      bypassed = !!cfg?.bypass_otp;
    } catch {}

    if (bypassed) {
      _OTP_UNLOCKED = true;
      hideOtpModal();
      if (E.msg) E.msg.textContent = "";
      if (E.btnSetup) E.btnSetup.classList.add("hidden");
      if (E.btnVerify) E.btnVerify.classList.add("hidden");
      return;
    }

    if (!w?.connected || !w?.token) {
      _OTP_UNLOCKED = true;
      hideOtpModal();
      if (E.btnSetup) E.btnSetup.classList.add("hidden");
      if (E.btnVerify) E.btnVerify.classList.add("hidden");
      return;
    }

    let st = null;
    try {
      st = await api("/api/otp/status", { method: "GET" });
    } catch (e) {
      await disconnectWallet({ reload: false });
      _OTP_UNLOCKED = true;
      hideOtpModal();
      return;
    }

    // If OTP is bypassed server-side, skip all OTP gates
    if (st.bypassed) {
      _OTP_UNLOCKED = true;
      hideOtpModal();
      if (E.msg) E.msg.textContent = "";
      if (E.btnSetup) E.btnSetup.classList.add("hidden");
      if (E.btnVerify) E.btnVerify.classList.add("hidden");
      return;
    }

    if (E.btnSetup) E.btnSetup.classList.toggle("hidden", !st.requires_setup);
    if (E.btnVerify) E.btnVerify.classList.toggle("hidden", !st.requires_verify);

    if (st.locked) {
      if (E.msg) {
        E.msg.textContent = L("OTP is locked. Please retry after {sec}s.")
          .replace("{sec}", String(Number(st.lock_remaining_sec || 0)));
      }
      showOtpModal(st.requires_setup ? "setup" : "verify");
      return;
    }

    if (st.requires_setup) {
      if (E.msg) E.msg.textContent = L("OTP setup is required.");
      showOtpModal("setup");

      try {
        const r = await api("/api/otp/setup", { method: "POST", body: {} });
        if (E.secret) E.secret.textContent = r.secret_base32 || "-";
        if (E.qr) {
          E.qr.innerHTML = r.qr_svg
            ? r.qr_svg
            : `<div class='small-note'>${L("QR generation unavailable (use the manual setup key)")}</div>`;
        }
      } catch (e) {
        if (E.msg) E.msg.textContent = e.message || L("OTP setup preparation failed.");
      }
      return;
    }

    if (st.requires_verify) {
      if (E.msg) E.msg.textContent = L("OTP verification is required.");
      showOtpModal("verify");
      return;
    }

    _OTP_UNLOCKED = true;
    hideOtpModal();
  }

  function bindOtpUi() {
    const E = otpEls();
    if (!E.modal) return;

    if (E.modal.dataset.bound === "1") return;
    E.modal.dataset.bound = "1";

    const safe6 = (s) => String(s || "").trim().replace(/\D/g, "").slice(0, 6);

    if (E.close) {
      E.close.addEventListener("click", async () => {
        await disconnectWallet({ reload: true });
      });
    }

    if (E.backdrop) {
      E.backdrop.addEventListener("click", async () => {
        await disconnectWallet({ reload: true });
      });
    }

    if (E.forceLogout) {
      E.forceLogout.addEventListener("click", async () => {
        await disconnectWallet({ reload: true });
      });
    }

    if (E.btnSetup && !E.btnSetup.dataset.bound) {
      E.btnSetup.dataset.bound = "1";
      E.btnSetup.addEventListener("click", () => showOtpModal("setup"));
    }

    if (E.btnVerify && !E.btnVerify.dataset.bound) {
      E.btnVerify.dataset.bound = "1";
      E.btnVerify.addEventListener("click", () => showOtpModal("verify"));
    }

    if (E.enableBtn && !E.enableBtn.dataset.bound) {
      E.enableBtn.dataset.bound = "1";
      E.enableBtn.addEventListener("click", async () => {
        try {
          const otp = safe6(E.codeSetup?.value);
          if (!/^\d{6}$/.test(otp)) throw new Error(L("Please enter the 6-digit OTP code."));
          const r = await api("/api/otp/enable", { method: "POST", body: { otp } });
          const w = getWallet();
          setWallet({ ...w, token: r.token });
          location.reload();
        } catch (e) {
          if (E.msg) E.msg.textContent = e.message || L("OTP setup failed.");
        }
      });
    }

    if (E.verifyBtn && !E.verifyBtn.dataset.bound) {
      E.verifyBtn.dataset.bound = "1";
      E.verifyBtn.addEventListener("click", async () => {
        try {
          const otp = safe6(E.codeVerify?.value);
          if (!/^\d{6}$/.test(otp)) throw new Error(L("Please enter the 6-digit OTP code."));
          const r = await api("/api/otp/verify", { method: "POST", body: { otp } });
          const w = getWallet();
          setWallet({ ...w, token: r.token });
          location.reload();
        } catch (e) {
          if (E.msg) E.msg.textContent = e.message || L("OTP verification failed.");
        }
      });
    }
  }

  // Active wallet adapter — set after a successful connect, used by disconnect
  // and account-change listener bindings.
  let _activeAdapter = null;

  const connectWallet = async () => {
    if (!window.RwaWallet || typeof window.RwaWallet.pickWallet !== "function") {
      // Wallet adapter failed to load — fall back to Phantom-only legacy path
      if (window.solana?.isPhantom) {
        return _legacyPhantomConnect();
      }
      toast(L("Failed to load the wallet connection module. Please refresh the page."), "bad");
      return;
    }

    let chosen;
    try {
      chosen = await window.RwaWallet.pickWallet();
    } catch (e) {
      toast(e?.message || L("Wallet selection failed."), "bad");
      return;
    }
    if (!chosen) return; // user cancelled or no wallet installed

    const adapter = window.RwaWallet.adapt(chosen);
    let address;
    try {
      address = await adapter.connect();
    } catch (e) {
      toast(e?.message || L("Failed to connect {wallet}.").replace("{wallet}", chosen.name), "bad");
      return;
    }
    if (!address) {
      toast(L("Failed to connect {wallet}.").replace("{wallet}", chosen.name), "bad");
      return;
    }

    const nonce = await api("/api/auth/nonce", {
      method: "POST",
      auth: false,
      body: { address },
    });
    const msg = nonce.message;

    let sigBytes;
    try {
      sigBytes = await adapter.signMessage(msg);
    } catch (e) {
      toast(e?.message || L("Wallet signature failed."), "bad");
      return;
    }
    const signatureBase64 = u8ToBase64(sigBytes);

    const login = await api("/api/auth/login", {
      method: "POST",
      auth: false,
      body: { address, signatureBase64 },
    });

    _activeAdapter = adapter;
    setWallet({
      connected: true,
      address,
      token: login.token,
      mode: chosen.id,
      walletName: chosen.name,
    });
    toast(L("Wallet connected."), "good");
    updateWalletUI();
    await refreshReferralNav().catch(() => {});

    try {
      adapter.onAccountChange(handleWalletAccountChange);
    } catch {}

    try {
      bindOtpUi();
      await refreshOtpGate();
    } catch {}
  };

  // Legacy Phantom path — kept as a safety fallback if wallet-adapter.js
  // failed to load for any reason. Identical to the previous implementation.
  const _legacyPhantomConnect = async () => {
    const resp = await window.solana.connect();
    const address = resp.publicKey.toString();
    const nonce = await api("/api/auth/nonce", { method: "POST", auth: false, body: { address } });
    const encoded = new TextEncoder().encode(nonce.message);
    const signed = await window.solana.signMessage(encoded, "utf8");
    const signatureBase64 = u8ToBase64(signed.signature);
    const login = await api("/api/auth/login", { method: "POST", auth: false, body: { address, signatureBase64 } });
    setWallet({ connected: true, address, token: login.token, mode: "phantom", walletName: "Phantom" });
    toast(L("Wallet connected."), "good");
    updateWalletUI();
    await refreshReferralNav().catch(() => {});
    try { bindPhantomListeners(); } catch {}
    try { bindOtpUi(); await refreshOtpGate(); } catch {}
  };

  // Generic account-change handler — works for any wallet adapter
  const handleWalletAccountChange = (publicKey) => {
    if (!publicKey) {
      // Wallet locked or disconnected from extension side
      disconnectWallet({ reload: true });
      return;
    }
    const newAddr = typeof publicKey.toString === "function" ? publicKey.toString() : String(publicKey);
    const cur = getWallet();
    if (cur?.address && cur.address !== newAddr) {
      // User switched account in their wallet — force re-auth
      disconnectWallet({ reload: true });
    }
  };

  const disconnectWallet = async (opts = {}) => {
    const { reload = false } = opts || {};
    const w = getWallet();
    // Prefer adapter-based disconnect if available
    if (_activeAdapter) {
      try { await _activeAdapter.disconnect(); } catch {}
      _activeAdapter = null;
    } else if (w.mode === "phantom" && window.solana?.isPhantom) {
      // Fallback for sessions restored from localStorage where no adapter exists
      try { await window.solana.disconnect(); } catch {}
    }
    setWallet({ connected: false, address: null, token: null, mode: "none" });
    {
      const _l = (window.RwaI18n?.getLang?.() || "ko");
      toast(_l === "en" ? "Wallet disconnected." : "지갑 연결을 해제했습니다.", "info");
    }
    updateWalletUI();
    await refreshReferralNav().catch(() => {});

    try {
      await refreshOtpGate();
    } catch {}

    if (reload) {
      console.warn('[core] disconnectWallet({reload:true}) → location.reload()', new Error('stack').stack);
      location.reload();
      return;
    }
  };

  const bindWalletButton = () => {
    // 1) Connect 버튼 — 지갑 미연결 상태에서 표시
    const btn = qs("#walletBtn");
    if (btn && btn.dataset.bound !== "1") {
      btn.dataset.bound = "1";
      btn.addEventListener("click", async () => {
        try { await connectWallet(); }
        catch (e) { toast(e.message || L("Wallet connection failed."), "bad"); }
      });
    }

    // 2) Wallet Pill — 클릭 시 disconnect 확인 다이얼로그.
    //    (Silica 헤더는 #walletDropdown 이 없으므로 confirm 으로 대체)
    const pill = qs("#walletPill");
    if (pill && pill.dataset.bound !== "1") {
      pill.dataset.bound = "1";
      pill.style.cursor = "pointer";
      const _lang = (window.RwaI18n?.getLang?.() || "ko");
      pill.title = _lang === "en" ? "Click to disconnect wallet" : "클릭하여 지갑 연결 해제";
      pill.addEventListener("click", async (e) => {
        e.stopPropagation();
        const w = getWallet();
        if (!w?.connected) return;
        const cur = (window.RwaI18n?.getLang?.() || "ko");
        const confirmMsg = cur === "en"
          ? "Disconnect wallet?\nYou will need to reconnect to access protected pages."
          : "지갑 연결을 해제하시겠습니까?\n해제 후 보호 페이지에 접근하려면 다시 연결해야 합니다.";
        if (!confirm(confirmMsg)) return;
        try { await disconnectWallet({ reload: true }); }
        catch (err) {
          const failMsg = cur === "en" ? "Failed to disconnect" : "지갑 해제 실패";
          toast(err?.message || failMsg, "bad");
        }
      });
    }

    // 3) (legacy) 별도 disconnect 버튼이 있으면 함께 바인딩
    const disconnectBtn = qs("#walletDisconnectBtn");
    if (disconnectBtn && disconnectBtn.dataset.bound !== "1") {
      disconnectBtn.dataset.bound = "1";
      disconnectBtn.addEventListener("click", async () => {
        try { await disconnectWallet({ reload: true }); }
        catch (e) { toast(e.message || L("Failed to disconnect wallet."), "bad"); }
      });
    }

    // 5) 지갑-게이트 CTA — [data-wallet-gate] 마크된 a/button 클릭 가로채기.
    //    지갑 미연결 → 페이지 이동 차단 + Phantom 연결 팝업 호출 (성공 시 원래 href 로 이동).
    //    지갑 연결 상태 → 정상 클릭 동작 그대로 통과.
    if (!document.body.dataset.walletGateBound) {
      document.body.dataset.walletGateBound = "1";
      document.addEventListener("click", async (ev) => {
        const target = ev.target?.closest?.("[data-wallet-gate]");
        if (!target) return;
        const w = getWallet();
        if (w?.connected && w?.token) return;  // 연결됨 → 기본 동작 (이동) 진행

        // 미연결: 기본 이동 차단
        ev.preventDefault();
        ev.stopPropagation();

        // 원래 이동할 href / data-href 보관 (button 도 지원)
        const dest =
          target.getAttribute("data-href") ||
          target.getAttribute("href") ||
          "";
        try {
          await connectWallet();
          // 연결 성공 시 원래 destination 으로 이동
          const w2 = getWallet();
          if (w2?.connected && dest) {
            try { location.href = dest; } catch (_) {}
          }
        } catch (e) {
          toast(e?.message || L("Wallet connection failed."), "bad");
        }
      }, true);
    }
  };

  // =========================
  // Wallet account change / disconnect detection
  // Phantom이 다른 계정으로 변경되거나 연결 해제되면 현재 세션을 강제 종료.
  // (이전 지갑 토큰이 유효한 상태로 남아있으면 공격 벡터가 됨)
  // =========================
  let _walletListenersBound = false;
  const bindPhantomListeners = () => {
    if (_walletListenersBound) return;
    const sol = window.solana;
    if (!sol || !sol.isPhantom || typeof sol.on !== "function") return;
    _walletListenersBound = true;

    sol.on("accountChanged", async (publicKey) => {
      const w = getWallet();
      if (!w?.connected) return;
      const newAddr = publicKey ? publicKey.toString() : null;
      console.warn('[core] accountChanged event — newAddr=', newAddr, 'stored=', w.address);
      if (!newAddr || newAddr !== w.address) {
        console.warn('[core] accountChanged → disconnect+reload');
        try { toast(L("Wallet account changed — logging out."), "bad"); } catch {}
        await disconnectWallet({ reload: true });
      }
    });

    sol.on("disconnect", async () => {
      const w = getWallet();
      if (!w?.connected) return;
      console.warn('[core] Phantom disconnect event fired → reload');
      try { toast(L("Wallet disconnected — logging out."), "bad"); } catch {}
      await disconnectWallet({ reload: true });
    });
  };

  // 부팅 시점에 저장된 address와 Phantom의 현재 publicKey가 일치하는지 검증.
  // 주의: Phantom은 페이지 로드 직후 isConnected=false 상태로 시작할 수 있으므로
  //       "현재 Phantom이 다른 주소로 연결되어 있다"는 명확한 신호가 있을 때만 종료.
  //       그 외에는 accountChanged/disconnect 이벤트 리스너에 맡긴다.
  const verifyWalletSession = async () => {
    const w = getWallet();
    if (!w?.connected || !w?.token) return;
    const sol = window.solana;
    if (!sol || !sol.isPhantom) return;

    // Phantom이 이미 다른 주소로 연결되어 있는 경우만 (확정적 불일치)
    if (sol.isConnected && sol.publicKey) {
      const current = sol.publicKey.toString();
      if (current && current !== w.address) {
        console.warn('[core] verifyWalletSession mismatch — stored=', w.address, 'phantom=', current, '→ disconnect+reload');
        try { toast(L("Wallet account changed — logging out."), "bad"); } catch {}
        await disconnectWallet({ reload: true });
      }
    }
    // 아직 Phantom이 준비되지 않은 경우(isConnected=false)에는 아무것도 하지 않음.
    // 이후 사용자가 실제로 변경/해제하면 accountChanged/disconnect 이벤트로 감지됨.
  };

  // =========================
  // Status / calc
  // =========================
  // Silica 단순 상태머신 (2026-05-05): 활성 / 매각 / 매각(완료) 만 사용.
  // legacy 값(모집중/구매진행/분배중/운영중)은 모두 ACTIVE 와 동등하게 취급.
  const statusOrder = (s) => {
    if (s === "활성" || s === "모집중" || s === "구매진행" || s === "분배중" || s === "운영중") return 0;
    if (s === "매각") return 1;
    if (s === "매각(완료)") return 2;
    return 99;
  };

  const statusBadge = (s) => {
    if (s === "활성" || s === "모집중" || s === "구매진행" || s === "분배중" || s === "운영중") return `<span class="badge good">활성</span>`;
    if (s === "매각") return `<span class="badge warn">매각 진행</span>`;
    if (s === "매각(완료)") return `<span class="badge neutral">매각 완료</span>`;
    if (s === "모집실패" || s === "취소됨") return `<span class="badge bad">취소됨</span>`;
    return `<span class="badge neutral">${s || "-"}</span>`;
  };

  // 거래 가능 자산 — 매각/매각완료 가 아니면 모두 거래 가능.
  const tradeable = (a) => a && a.status !== "매각(완료)" && a.status !== "모집실패" && a.status !== "취소됨";

  const fundPct = (a) => {
    const raised = Number(a?.raised_usdt || 0);
    const target = Number(a?.target_usdt || 0);
    if (!target) return 0;
    return clamp((raised / target) * 100, 0, 100);
  };

  // =========================
  // Charts
  // =========================
  const drawLineChart = (container, series) => {
    if (!container) return;
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 180;
    const pad = 14;

    const points = (series || [])
      .map((s) => [new Date(s.created_at || s.t).getTime(), Number(s.price || s.p)])
      .filter((x) => Number.isFinite(x[0]) && Number.isFinite(x[1]))
      .sort((a, b) => a[0] - b[0]);

    container.innerHTML = "";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.width = "100%";
    svg.style.height = "100%";
    container.appendChild(svg);

    if (points.length < 2) return;

    const minX = points[0][0];
    const maxX = points[points.length - 1][0];
    const minY = Math.min(...points.map((p) => p[1]));
    const maxY = Math.max(...points.map((p) => p[1]));
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const mapX = (x) => pad + (w - pad * 2) * ((x - minX) / rangeX);
    const mapY = (y) => pad + (h - pad * 2) * (1 - (y - minY) / rangeY);

    const path = document.createElementNS(svgNS, "path");
    let d = "";
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      const X = mapX(x);
      const Y = mapY(y);
      d += i === 0 ? `M ${X} ${Y}` : ` L ${X} ${Y}`;
    }
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#f5c400");
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
  };

  // =========================
  // Data loaders
  // =========================
  let ASSETS_CACHE = null;

  const loadAssets = async () => {
    const data = await api("/api/assets", { auth: false });
    ASSETS_CACHE = data.assets || [];
    return ASSETS_CACHE;
  };

  const getAssetsCached = async () => {
    if (ASSETS_CACHE) return ASSETS_CACHE;
    return loadAssets();
  };

  const loadAssetDetail = async (id) => {
    const data = await api(`/api/assets/${encodeURIComponent(id)}`, { auth: false });
    return data;
  };

const loadTrades = async (assetId, limit = 200) => {
  const n = Math.min(5000, Math.max(1, Number(limit || 200)));
  const data = await api(
    `/api/trades?asset_id=${encodeURIComponent(assetId)}&limit=${n}`,
    { auth: false }
  );
  return data.trades || [];
};
  const loadMarkets = async () => {
    const data = await api("/api/markets", { auth: false });
    return data.markets || [];
  };

  // =========================
  // Nav highlight / submenu
  // =========================
  const bindNavSubmenus = () => {
    const nav = qs("header.site-header .nav");
    if (!nav || nav.dataset.submenuBound === "1") return;
    nav.dataset.submenuBound = "1";

    const items = qsa('.nav-item.has-sub', nav);
    const closeTimers = new WeakMap();
    const isDesktop = () => {
      try {
        return window.matchMedia('(min-width: 961px)').matches;
      } catch (_) {
        return window.innerWidth > 960;
      }
    };
    const clearCloseTimer = (item) => {
      const timer = closeTimers.get(item);
      if (timer) {
        clearTimeout(timer);
        closeTimers.delete(item);
      }
    };
    const setExpanded = (item, open) => {
      const btn = item.querySelector(':scope > .nav-caret');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    const openItem = (item, exclusive = true) => {
      clearCloseTimer(item);
      if (exclusive) {
        items.forEach((other) => {
          if (other !== item) {
            clearCloseTimer(other);
            other.classList.remove('is-open');
            setExpanded(other, false);
          }
        });
      }
      item.classList.add('is-open');
      setExpanded(item, true);
    };
    const closeItem = (item) => {
      clearCloseTimer(item);
      item.classList.remove('is-open');
      setExpanded(item, false);
    };
    const scheduleClose = (item, delay = 360) => {
      clearCloseTimer(item);
      const timer = window.setTimeout(() => closeItem(item), delay);
      closeTimers.set(item, timer);
    };
    const closeAll = (except = null) => {
      items.forEach((item) => {
        if (except && item === except) return;
        closeItem(item);
      });
    };

    items.forEach((item) => {
      const btn = item.querySelector(':scope > .nav-caret');
      const link = item.querySelector(':scope > .nav-link, :scope > a');
      const submenu = item.querySelector(':scope > .nav-sub, :scope > .nav-submenu');
      if (!submenu) return;

      if (btn && btn.dataset.bound !== '1') {
        btn.dataset.bound = '1';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const willOpen = !item.classList.contains('is-open');
          if (willOpen) openItem(item);
          else closeItem(item);
        });
      }

      const keepOpen = () => {
        if (!isDesktop()) return;
        clearCloseTimer(item);
        openItem(item);
      };
      const maybeClose = () => {
        if (!isDesktop()) return;
        scheduleClose(item);
      };

      item.addEventListener('mouseenter', keepOpen);
      item.addEventListener('mouseleave', maybeClose);
      submenu.addEventListener('mouseenter', keepOpen);
      submenu.addEventListener('mouseleave', maybeClose);
      link?.addEventListener('focus', () => openItem(item));
      btn?.addEventListener('focus', () => openItem(item));
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) closeAll();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });
    window.addEventListener('resize', () => {
      if (!isDesktop()) closeAll();
    });
  };

  const highlightNav = () => {
    const page = (document.body.getAttribute("data-page") || "").trim();
    // (2026-05-11 v250) Operator: '헤더 메뉴에서 메뉴 색상이 서로 다르게
    //   나오는 문제가 있다. 아울러 스왑은 이러한 색상 처리도 되어 있지
    //   않은 문제가 있다.' Two bugs:
    //   1) Portfolio looked different from Invest when active — fixed by
    //      patching the i18n.js inline CSS rule for has-sub parents so
    //      it uses the same solid-purple + white-text active style.
    //   2) swap / ir pages had no entry in this map → no active class →
    //      no highlight. Added below alongside the existing entries.
    //   asset-detail.html is gone (merged into ir.html), so its entry
    //   was removed; ir now covers both 'IR materials' and the mine
    //   detail content.
    const map = {
      landing:    "navLanding",
      assets:     "navAssets",
      funding:    "navAssets",
      markets:    "navTrade",
      trade:      "navTrade",
      chart:      "navTrade",
      swap:       "navSwap",
      staking:    "navStaking",
      claim:      "navClaim",
      sales:      "navSales",
      "sale-detail": "navSales",
      portfolio:  "navPortfolio",
      deposit:    "navDeposit",
      withdraw:   "navWithdraw",
      history:    "navHistory",
      referral:   "navReferral",
      ir:         "navIR",
      // (2026-05-11 v270) 공지 페이지 — 연간 / 분기 회계 보고서 +
      //   일반 공지 목록. 메뉴 활성 색은 #navNotices CSS hover 색
      //   과 일치 (그린).
      notices:    "navNotices",
    };

    if (page === 'index') {
      qs('header.site-header .brand')?.classList.add('active-home');
      return;
    }

    const id = map[page];
    if (!id) return;
    const el = qs(`#${id}`);
    if (!el) return;
    el.classList.add("active");
    const item = el.closest('.nav-item.has-sub');
    if (item) {
      item.classList.add('has-active-child');
      const trigger = item.querySelector(':scope > .nav-link, :scope > a');
      if (trigger && trigger !== el) trigger.classList.add('active');
    }
  };

  // =========================
  // Boot
  // =========================
  // =========================
  // Access control — 지갑 미연결 시 랜딩 페이지로 리다이렉트
  // =========================
  // SilicaChain 정책: 지갑 미연결 사용자는 landing.html 만 접근 가능.
  // 메뉴는 .no-wallet body 클래스로 전부 숨김 처리 (CSS).
  // KYC didit.me 콜백(kyc-return), 약관(terms) 은 외부 흐름 호환을 위해 예외.
  const PUBLIC_PAGES = new Set([
    "landing",
    "kyc-return",            // didit.me 콜백 — 외부 도메인이 redirect 함
    "terms", "terms-en",     // 약관 — 회원가입 전 검토용
    "preview-mode",          // 내부 디버그
    // (2026-05-11 v249) ir.html 은 광산 소개(구 asset-detail.html) +
    // 투자 자료 (Document Library / Roadmap / Milestones) 가 합쳐진
    // 메인 마케팅 페이지. 미가입자도 광산 정보를 열람해 투자를
    // 결정할 수 있어야 한다. Invest 버튼은 assets.html 로 가며 (구
    // funding.html 는 v253 에서 제거됨 — assets.html 와 중복) 거기서
    // 지갑 연결 게이트가 동작한다.
    "ir",
    // (2026-05-11 v270) 공지 페이지 — 연간/분기 회계 보고서를
    // 잠재 투자자도 열람할 수 있어야 한다. 미가입자에게도 공개.
    "notices",
  ]);
  // 위 화이트리스트 외 모든 페이지는 지갑 연결 필요 → 미연결 시 landing.html 으로 redirect.

  // (2026-05-23 v799) KYC handoff 예외 — kyc-certification 에 ?kyc_token=XXX
  //   파라미터로 진입한 경우 지갑 없이도 public 처리. 이유: 인앱 브라우저
  //   (Phantom 등) 사용자가 일반 Chrome 으로 KYC 만 옮겨가 진행할 수 있도록
  //   하는 핸드오프 흐름. 토큰 자체가 단기 유효 + 1회용 + wallet 매핑 보유
  //   이므로 보안상 안전. 동일 페이지 내 재진입을 위해 sessionStorage 에도
  //   토큰 저장 (didit.me 라운드 트립 대응).
  const HANDOFF_TOKEN_SS_KEY = "rwa_kyc_handoff_token";
  const hasHandoffTokenForKyc = () => {
    try {
      const sp = new URLSearchParams(location.search || "");
      const fromUrl = String(sp.get("kyc_token") || "").trim();
      if (fromUrl && /^[a-f0-9]{32,128}$/i.test(fromUrl)) return true;
      const fromSession = String(sessionStorage.getItem(HANDOFF_TOKEN_SS_KEY) || "").trim();
      if (fromSession && /^[a-f0-9]{32,128}$/i.test(fromSession)) return true;
    } catch (_) {}
    return false;
  };

  const isPublicPage = () => {
    const page = String(document.body?.getAttribute("data-page") || "").trim();
    if (PUBLIC_PAGES.has(page)) return true;
    // (v799) kyc-certification + 유효한 kyc_token → 핸드오프 모드, public 처리
    if (page === "kyc-certification" && hasHandoffTokenForKyc()) return true;
    return false;
  };

  /**
   * 지갑 미연결 상태에서 보호 페이지에 접근하면 landing.html로 즉시 리다이렉트.
   * 반환값: true = 계속 진행 가능, false = 리다이렉트 발생(페이지 로직 중단 필요)
   */
  const requireWalletOrRedirectLanding = () => {
    // (2026-06-16 v900) 운영자 정책 변경: 미연결도 모든 메뉴/페이지 둘러보기 허용.
    //   정밀분석 확인 — 모든 자금 write API 가 authRequired/authMfaRequired 로 보호되어
    //   화면을 개방해도 미인증 요청은 서버에서 401. 기능 실행은 각 버튼의 connectWallet()
    //   안내로 유도(2단계). 따라서 페이지 진입을 막던 landing 강제 redirect 를 해제.
    //   Revert: 바로 아래 'return true;' 한 줄 삭제 → 직전(공개페이지 외 redirect) 동작 복귀.
    return true;

    if (isPublicPage()) return true;
    const w = getWallet();
    if (w?.connected && w?.token) return true;

    // 현재 페이지 정보를 from 파라미터로 전달 (연결 후 복귀 가능하도록 —
    // v351 에서 redirectAfterLogin 으로 이 값을 사용했으나 v352 에서
    // referral 자동화와 함께 제거. 향후 다른 용도로 재활용될 수 있어
    // 저장 자체는 보존.)
    try {
      const page = document.body?.getAttribute("data-page") || "";
      const search = location.search || "";
      const ret = page + (search || "");
      sessionStorage.setItem("rwa_post_login_return", ret);
    } catch {}
    try { location.replace("landing.html"); } catch { location.href = "landing.html"; }
    return false;
  };

  const boot = async () => {
    ensureToastEl();

    // (2026-06-08 v894) boot 직렬 호출 병렬화 그룹 A.
    //   Stage 1: ensureHeader + ensureFooter 병렬 — 두 fetch 독립.
    //   Stage 2 (헤더 mount 후): refreshReferralNav + loadAssets 병렬.
    //     - refreshReferralNav 는 헤더 안의 #navReferral 에 의존하므로
    //       반드시 Stage 1 완료 후에만 가능.
    //     - loadAssets 는 헤더/지갑과 독립이라 어디서든 가능.
    //   기대 절약: cold cache 기준 ~350~500ms (직렬 ~700ms → 병렬 ~300ms).
    await Promise.all([ensureHeader(), ensureFooter()]);

    bindNavSubmenus();
    highlightNav();
    bindWalletButton();
    updateWalletUI();

    await Promise.all([
      refreshReferralNav().catch(() => {}),
      loadAssets().catch(() => {}),
    ]);

    // 지갑 계정 변경/해제 감지 리스너 등록 (이미 로그인 상태라면 즉시 바인딩)
    try { bindPhantomListeners(); } catch {}

    // ── 페이지 이동 후 자동 재연결 (silent re-connect) ──
    // Phantom 은 페이지 로드 직후 isConnected=false 로 시작하므로, localStorage 에
    // 활성 세션이 있으면 Phantom 의 onlyIfTrusted=true 옵션으로 팝업 없이 조용히
    // 재연결을 시도한다. 이전에 사이트를 승인한 적이 있는 경우에만 성공하며, 그
    // 외에는 조용히 실패하므로 사용자 경험에 영향이 없다.
    try {
      const w0 = getWallet();
      const sol = window.solana;
      if (w0?.connected && w0?.address && sol?.isPhantom && !sol.isConnected) {
        await sol.connect({ onlyIfTrusted: true }).catch(() => {});
      }
    } catch (_) {}

    // 저장된 address vs 현재 Phantom publicKey 불일치 검증 (공격 벡터 차단)
    try { await verifyWalletSession(); } catch {}

    bindOtpUi();
    await refreshOtpGate().catch(() => {});

    window.RwaI18n?.apply?.();
  };

  // =========================
  // Export
  // =========================
  window.RwaCore = {
    STORAGE,
    qs,
    qsa,
    clamp,
    readJSON,
    writeJSON,
    getParam,
    toast,
    fmt,
    money,
    absUrl,
    assetImageUrl,
    tokenImageUrl,
    bindTabs,
    // (2026-05-18 v557) landing.js 가 sessionStorage 기반으로 모달을 재표시할 수 있도록 노출.
    showAccountSuspendedModal,

    ensureHeader,
    ensureFooter,
    ensureToastEl,

    getWallet,
    setWallet,
    api,
    apiForm,

    updateWalletUI,
    connectWallet,
    disconnectWallet,
    bindWalletButton,
    bindPhantomListeners,
    verifyWalletSession,
    isPublicPage,
    requireWalletOrRedirectLanding,
    // (2026-06-18 v926) v925 의 지갑연결 게이트 — 위에서 bare const 로 정의, 여기서 export.
    requireWalletConnected,
    // (2026-05-23 v799) KYC handoff 토큰 sessionStorage 키 — 페이지 간 공유.
    HANDOFF_TOKEN_SS_KEY,
    hasHandoffTokenForKyc,
    refreshReferralNav,

    isOtpUnlocked,
    refreshOtpGate,
    bindOtpUi,

    statusOrder,
    statusBadge,
    tradeable,
    fundPct,

    drawLineChart,

    loadAssets,
    getAssetsCached,
    loadAssetDetail,
    loadTrades,
    loadMarkets,

    boot,
  };
})();

window.RwaCore.loadPortfolio = async function () {
  return await this.api("/api/portfolio", { method: "GET", auth: true });
};

// ? core.js 맨 아래에 추가 (기존 삭제 금지)
(() => {
  window.RwaCore = window.RwaCore || {};
  const C = window.RwaCore;

  let _CFG = null;
  let _CFG_AT = 0;

  C.getConfig = async (force = false) => {
    const now = Date.now();
    if (!force && _CFG && now - _CFG_AT < 30000) return _CFG;
    if (typeof C.api !== "function") throw new Error("RwaCore.api가 없습니다.");
    const r = await C.api("/api/public/config", { auth: false });
    _CFG = r;
    _CFG_AT = now;
    return _CFG;
  };

  C.COUNTRY_LABEL = {
    KR: "대한민국",
    US: "미국",
    KZ: "카자흐스탄",
    PH: "필리핀",
    GE: "조지아",
    ID: "인도네시아",
    VN: "베트남",
  };

  C.labelCountry = (code) => {
    const k = String(code || "").toUpperCase();
    return C.COUNTRY_LABEL[k] || k || "-";
  };

  C.labelCurrency = (ccy) => {
    const k = String(ccy || "").toUpperCase();
    return k || "-";
  };
  
  
  
  
  
  
  
})();

// core.js (window.RwaCore 생성 후) 아래 추가
window.RwaCore.loadFundingHistory = async function (assetId) {
  const d = await this.api(`/api/funding/${encodeURIComponent(assetId)}`, { auth: true });
  return d?.rows || [];
};





// ===== KYC Gate Add-on (core.js 맨 아래 추가) =====
(() => {
	
	
	
  window.RwaCore = window.RwaCore || {};
  const C = window.RwaCore;

  // (2026-05-18 v565) 운영자 요청 — portfolio / funding (assets.html) 도
  //   KYC 미승인 상태에서 접근 가능해야 하며, 상단에 KYC 안내 카드 표시.
  //   실제 투자/출금 등 자금 이동 액션은 서버측 가드 (assertUserKycEligible)
  //   에서 별도 차단되므로 페이지 열람만 허용해도 안전.
  // (2026-05-20 v669) deposit 페이지 추가 — 운영자: 'KYC 미인증 유저는
  //   입금이 가능해야 한다.' 입금 (USDT 충전) 은 KYC 없이도 허용.
  //   출금 / 거래 / 스왑 / 스테이킹 / 투자 등 KYC 필요한 행위는 여전히 차단.
  // (2026-05-21 v729) IR Materials 페이지 (ir / ir-concepts) 도 KYC 미인증
  //   유저 접근 허용. 자금 이동 없는 read-only 정보 페이지이므로 안전.
  // (2026-05-21 v730) 운영자 요청 — index (메인 대시보드) 도 KYC 미인증
  //   접근 허용. 로그인 직후 즉시 KYC 리다이렉트되는 강제 흐름 완화.
  // (2026-06-07 v873) 운영자 요청 — history 도 KYC 미인증 접근 허용.
  //   본인의 입금 등 read-only 거래 내역 조회는 자금 이동이 없으므로 안전.
  //   투자/출금 등 자금 이동 액션은 서버측 가드 (assertUserKycEligible) 가
  //   별도 차단하므로 페이지 열람만 허용해도 안전.
  const EXEMPT_PAGES = new Set(["kyc-ready", "kyc-certification", "kyc-return", "asset-detail", "referral", "portfolio", "funding", "deposit", "ir", "ir-concepts", "index", "history"]);
  let _KYC = null;
  let _KYC_AT = 0;

  function currentPageKey() {
    try { return String(document.body?.getAttribute("data-page") || "").trim(); }
    catch { return ""; }
  }

  function currentReturnUrl() {
    const path = location.pathname.split("/").pop() || "index.html";
    return `${path}${location.search || ""}`;
  }

  C.getKycStatus = async (force = false) => {
    const now = Date.now();
    if (!force && _KYC && (now - _KYC_AT) < 15000) return _KYC;
    const r = await C.api("/api/kyc/status", { method: "GET" });
    _KYC = r;
    _KYC_AT = now;
    return r;
  };

  C.checkKycGate = async (force = false) => {
    const page = currentPageKey();
    if (EXEMPT_PAGES.has(page)) return true;

    const w = typeof C.getWallet === "function" ? C.getWallet() : null;
    if (!w?.connected || !w?.token) return true;

    if (typeof C.isOtpUnlocked === "function" && !C.isOtpUnlocked()) return true;

    // Check if KYC is bypassed via public config
    try {
      const cfg = await C.api("/api/public/config", { method: "GET", auth: false });
      if (cfg?.bypass_kyc) return true;
    } catch {}

    try {
      const st = await C.getKycStatus(force);
      if (st?.bypassed) return true;
      const yn = String(st?.kyc_yn || "N").toUpperCase();
      if (yn !== "Y") {
        // (2026-06-17 v911) 운영자: KYC 미인증도 모든 페이지 접근 허용 — 강제
        //   kyc-ready redirect 제거. 거래/스테이킹/출금/스왑 등 자금이동 기능은
        //   서버측 assertUserKycEligibleOrThrow 가 차단하고, 화면엔 KYC 안내
        //   배너(renderKycBanner)를 노출한다. 원복: 아래 redirect 3줄 주석 해제.
        // try {
        //   localStorage.setItem("rwa_kyc_return_url", currentReturnUrl());
        // } catch {}
        // location.href = `kyc-ready.html?return=${encodeURIComponent(currentReturnUrl())}`;
        // return false;
        return true;
      }
      return true;
    } catch (e) {
      // OTP 미통과/로그인 끊김 등의 경우는 여기서 강제하지 않음
      return true;
    }
  };

  const origConnectWallet = C.connectWallet;
  if (typeof origConnectWallet === "function") {
    C.connectWallet = async (...args) => {
      const r = await origConnectWallet.apply(C, args);
      try { await C.checkKycGate(true); } catch {}
      return r;
    };
  }

  const origBoot = C.boot;
  if (typeof origBoot === "function") {
    C.boot = async (...args) => {
      const r = await origBoot.apply(C, args);
      try { await C.checkKycGate(false); } catch {}
      try { await C.renderKycBanner(); } catch {}
      return r;
    };
  }

  // (2026-05-18 v565) KYC 상태 배너 — portfolio / funding 페이지 상단에 표시.
  //   페이지에 #kycStatusBanner 가 있을 때만 동작. KYC 상태에 따라 4가지
  //   variant (unverified / continue / pending / rejected). bypassed=true
  //   또는 kyc_yn=Y 인 경우엔 배너 자체를 숨김 (display:none) — 운영자 요청.
  C.renderKycBanner = async () => {
    const banner = document.getElementById('kycStatusBanner');
    // (2026-05-19 v599) 페이지에 배너 markup 없어도 헤더 #kycHeaderCta 는 갱신
    //   해야 함. 두 element 를 한꺼번에 다루는 헬퍼.
    const headerCta = document.getElementById('kycHeaderCta');
    const hideAll = () => {
      if (banner) banner.style.display = 'none';
      if (headerCta) headerCta.style.display = 'none';
    };
    if (!banner && !headerCta) return; // 둘 다 없으면 할 일 없음

    // 지갑 미연결 / OTP 미해제 시엔 정보 부족이므로 숨김 — 사용자 인증 후 다시 갱신.
    const w = typeof C.getWallet === "function" ? C.getWallet() : null;
    if (!w?.connected || !w?.token) { hideAll(); return; }
    if (typeof C.isOtpUnlocked === "function" && !C.isOtpUnlocked()) {
      hideAll();
      return;
    }

    let st;
    try { st = await C.getKycStatus(false); }
    catch (e) { hideAll(); return; }

    const yn       = String(st?.kyc_yn || 'N').toUpperCase();
    const bypassed = !!st?.bypassed;
    const status   = String(st?.kyc_status || '').toLowerCase();
    const nameSet  = !!st?.mt_name_set;
    const birthSet = !!st?.mt_birth_set;

    // (v566) 운영자: '운영자가 KYC 끔 → 배너 숨겨서는 안된다.' bypass 모드여도
    //   자발적 KYC 진행을 안내해야 함. 완전 승인(Y) 인 경우만 숨김.
    if (yn === 'Y') {
      hideAll();
      return;
    }

    if (banner) banner.style.display = '';

    // 상태별 variant 선택
    const lang = (window.RwaI18n?.getLang?.() || 'en').toLowerCase() === 'ko' ? 'ko' : 'en';
    const t = (en, ko) => lang === 'ko' ? ko : en;
    let variant;
    // (v566) bypass 모드 — 별도 variant 로 'KYC 선택사항' 임을 명시.
    // (2026-05-19 v589) 운영자 요청 — "(Optional)" 및 부연 설명 제거. 상태 라벨
    //   만 남기고 sub 문구 비움.
    if (bypassed) {
      if (status === 'rejected') {
        variant = {
          icon: '✕',
          bg:   '#DC2626',
          title: t('KYC Rejected', 'KYC 반려'),
          sub:   '',
          cta:   t('Re-submit', '다시 신청'),
          href:  'kyc-ready.html',
        };
      } else if (status === 'pending' || status === 'reviewing' || status === 'in_progress' || status === 'in_review') {
        variant = {
          icon: '⌛',
          bg:   '#D97706',
          title: t('KYC Under Review', 'KYC 검증 중'),
          sub:   '',
          cta:   t('Check Status', '상태 확인'),
          href:  'kyc-certification.html',
        };
      } else if (nameSet && birthSet) {
        variant = {
          icon: '→',
          bg:   '#7C3AED',
          title: t('Continue KYC', 'KYC 이어서 진행'),
          sub:   '',
          cta:   t('Continue', '계속'),
          href:  'kyc-certification.html',
        };
      } else {
        variant = {
          icon: 'ℹ',
          bg:   '#0EA5E9',
          title: t('KYC', 'KYC'),
          sub:   '',
          cta:   t('Start KYC', 'KYC 시작'),
          href:  'kyc-ready.html',
        };
      }
      // 위에서 variant 결정 후 공통 렌더 로직으로 이어짐.
    } else if (status === 'rejected') {
      variant = {
        icon: '✕',
        bg:   'linear-gradient(135deg, #EF4444, #DC2626)',
        title: t('KYC Rejected', 'KYC 반려'),
        sub:   t('Your verification was rejected. Please re-submit.', '검증이 반려되었습니다. 다시 신청해 주세요.'),
        cta:   t('Re-submit', '다시 신청'),
        href:  'kyc-ready.html',
      };
    } else if (status === 'pending' || status === 'reviewing' || status === 'in_progress' || status === 'in_review') {
      variant = {
        icon: '⌛',
        bg:   'linear-gradient(135deg, #F59E0B, #D97706)',
        title: t('KYC Under Review', 'KYC 검증 중'),
        sub:   t('Your verification is being reviewed by our provider.', '제출하신 인증을 검토 중입니다.'),
        cta:   t('Check Status', '상태 확인'),
        href:  'kyc-certification.html',
      };
    } else if (nameSet && birthSet) {
      variant = {
        icon: '→',
        bg:   'linear-gradient(135deg, #7C3AED, #06B6D4)',
        title: t('Continue KYC', 'KYC 이어서 진행'),
        sub:   t('Basic info saved. Continue with document verification.', '기본 정보 저장 완료. 신분증 인증을 이어서 진행하세요.'),
        cta:   t('Continue', '계속'),
        href:  'kyc-certification.html',
      };
    } else {
      variant = {
        icon: '🔒',
        bg:   'linear-gradient(135deg, #6366F1, #8B5CF6)',
        title: t('KYC Verification Required', 'KYC 인증이 필요합니다'),
        sub:   t('Complete identity verification to start investing.', '투자를 시작하려면 신원 인증을 완료해 주세요.'),
        cta:   t('Start KYC', 'KYC 시작'),
        href:  'kyc-ready.html',
      };
    }

    // (v599) banner 가 null 일 수 있음 (페이지에 markup 없음) — null 가드.
    if (banner) {
      const iconEl  = banner.querySelector('[data-kyc-banner-icon]');
      const titleEl = banner.querySelector('[data-kyc-banner-title]');
      const subEl   = banner.querySelector('[data-kyc-banner-sub]');
      const ctaEl   = banner.querySelector('[data-kyc-banner-cta]');
      if (iconEl) {
        iconEl.textContent = variant.icon;
        iconEl.style.background = variant.bg;
      }
      if (titleEl) titleEl.textContent = variant.title;
      if (subEl)   subEl.textContent = variant.sub;
      if (ctaEl) {
        ctaEl.textContent = variant.cta;
        ctaEl.setAttribute('href', variant.href);
      }
    }

    // (v599) 헤더의 #kycHeaderCta 도 동일 variant 로 갱신. 페이지의
    //   #kycStatusBanner 가 없어도 헤더 버튼은 항상 노출 가능. 완료 시
    //   yn==='Y' 분기에서 이미 return 했으므로 여기 도달 = 미완료 = 노출.
    if (headerCta) {
      headerCta.textContent = variant.cta;
      headerCta.setAttribute('href', variant.href);
      headerCta.style.display = '';
    }
  };

})();