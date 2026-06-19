(() => {
  "use strict";

  const STORAGE = {
    adminToken: "rwa_admin_token_v1",
    apiBase: "rwa_api_base_v1",
    adminWallet: "rwa_admin_wallet_v1",
  };

  // 정책: 관리자 데이터 수정 시 Phantom 지갑이 *연결되어 있어야* 한다.
  // 다만 특정 주소로 제한하지 않는다 — 연결된 어떤 지갑이든 사용 가능.

  // (2026-05-11 v272) Fallback header-fetch cache token. Bump whenever
  //   admin/header.html changes — otherwise pages that don't set
  //   window.__ADMIN_ASSET_TOKEN themselves (everything except
  //   dashboard.html, which uses Date.now()) will load the cached
  //   `header.html?_v=...` and miss the new nav items. Operator: '대시
  //   보드 헤더에만 회계자료/공지 메뉴가 보인다. 다른 페이지의 헤더
  //   에서는 안 보인다.' — v270 added the 회계 자료/공지 link but
  //   admin pages still had the old cached header.
  const ADMIN_ASSET_TOKEN = String(window.__ADMIN_ASSET_TOKEN || "20260512v306-termsedit");

  const RWA_VERSION = "v2026.04.26.02";
  window.RWA_VERSION = RWA_VERSION;

  // ─────────────────────────────────────────────────────────────────
  // 관리자 지갑 헬퍼 (window.AdminWallet)
  // 모든 admin 페이지에서 공통으로 사용
  // ─────────────────────────────────────────────────────────────────
  const phantomProvider = () => {
    try {
      if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
      if (window.solana?.isPhantom) return window.solana;
    } catch (_) {}
    return null;
  };

  const getAdminWalletAddress = () => {
    try { return localStorage.getItem(STORAGE.adminWallet) || ""; }
    catch (_) { return ""; }
  };

  const isAdminWalletConnected = () => {
    // 어떤 주소든 저장되어 있으면 연결된 것으로 간주.
    return Boolean(getAdminWalletAddress());
  };

  const connectAdminWallet = async () => {
    const p = phantomProvider();
    if (!p) {
      alert("Phantom 지갑이 설치되어 있지 않습니다.\nphantom.app 에서 설치 후 다시 시도하세요.");
      window.open("https://phantom.app/", "_blank");
      return null;
    }
    try {
      const resp = await p.connect();
      const address = resp.publicKey.toBase58();
      // 특정 주소 제한 없음 — 연결된 어떤 지갑이든 그대로 저장.
      localStorage.setItem(STORAGE.adminWallet, address);
      // 다른 페이지/탭에서도 즉시 반영
      window.dispatchEvent(new CustomEvent("admin-wallet-changed", { detail: { address } }));
      return address;
    } catch (e) {
      console.warn("관리자 지갑 연결 실패:", e);
      return null;
    }
  };

  const disconnectAdminWallet = async () => {
    const p = phantomProvider();
    if (p) {
      try { await p.disconnect(); } catch (_) {}
    }
    try { localStorage.removeItem(STORAGE.adminWallet); } catch (_) {}
    window.dispatchEvent(new CustomEvent("admin-wallet-changed", { detail: { address: "" } }));
  };

  // 글로벌 노출 (REQUIRED 키는 더 이상 사용하지 않으므로 노출 안 함)
  window.AdminWallet = {
    connect: connectAdminWallet,
    disconnect: disconnectAdminWallet,
    getAddress: getAdminWalletAddress,
    isConnected: isAdminWalletConnected,
  };

  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));

  const onReady = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    try { fn(); } catch (e) { console.error(e); }
  };

  const toast = (msg, kind = "info") => {
    const el = qs("#toast");
    if (!el) return;
    el.classList.remove("hidden");
    el.classList.toggle("good", kind === "good");
    el.classList.toggle("bad", kind === "bad");
    el.textContent = window.AdminI18n?.translateMessage?.(msg) || msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  };

  const normalizeApiBase = (value) => {
    const raw = String(value || "").trim();
    if (!raw || raw === "/" || raw.toLowerCase() === "same-origin") return "";
    return raw.replace(/\/+$/, "");
  };

  const apiBase = () => normalizeApiBase(localStorage.getItem(STORAGE.apiBase) || "");

  const buildApiUrlCandidates = (path) => {
    const cleanPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
    const base = apiBase();
    const urls = base ? [`${base}${cleanPath}`, cleanPath] : [cleanPath];
    return Array.from(new Set(urls));
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

  const requestJson = async (url, opt = {}) => {
    const headers = Object.assign({ "Content-Type": "application/json" }, opt.headers || {});
    const token = localStorage.getItem(STORAGE.adminToken);
    if (token) headers.Authorization = `Bearer ${token}`;

    // ★ 모든 admin API 호출 (GET 포함) 에 관리자 Phantom 지갑 헤더 자동 주입.
    //   인증 라우트(로그인/로그아웃 등)는 면제 — 지갑 없이도 로그인 가능.
    //
    // (2026-05-19 v583) 운영자 요청: 'ADMIN_WALLET_ADDRESSES 화이트리스트
    //   적용 시 관리자 페이지 접근 자체가 차단되어야 함.' 이전엔 POST 등
    //   쓰기 메서드만 헤더 주입 → 화이트리스트가 GET (페이지 데이터 로드)
    //   에선 우회 가능했다. 모든 메서드에 헤더 주입하여 백엔드 적용 보장.
    const isAuthRoute = /\/api\/admin\/auth\/(login|logout|refresh|otp|verify|setup|me)/.test(url);
    if (!isAuthRoute) {
      const wallet = (() => {
        try { return localStorage.getItem(STORAGE.adminWallet) || ""; }
        catch (_) { return ""; }
      })();
      if (wallet) headers["X-Admin-Wallet"] = wallet;
    }

    let res;
    try {
      res = await fetch(url, {
        method: opt.method || "GET",
        headers,
        body: opt.body ? JSON.stringify(opt.body) : undefined,
        credentials: opt.credentials || "same-origin",
        cache: opt.cache || "no-store",
      });
    } catch (e) {
      const err = new Error("네트워크 연결 또는 API 주소를 확인하세요.");
      err.retryable = true;
      err.cause = e;
      throw err;
    }

    const raw = await res.text();
    let data = {};
    if (String(raw || "").trim()) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        const err = new Error(res.ok ? "서버 응답 형식 오류" : `요청 실패 (${res.status})`);
        err.status = res.status;
        err.retryable = true;
        err.responseText = raw;
        err.cause = e;
        throw err;
      }
    }

    if (!res.ok || data.ok === false) {
      const err = new Error(data.message || `요청 실패 (${res.status})`);
      err.status = res.status;
      err.retryable = res.status === 404 || res.status >= 500 || !data || typeof data !== "object";
      err.payload = data;
      throw err;
    }

    return data;
  };

  // (2026-05-13 v330) 운영자: '관리자 토큰이 유효하지 않습니다 401 이 모든
  //   admin API 에서 발생' 후 추가 조사. 두 가지 보호장치 추가.
  //
  // (1) 401 자동 처리: admin 경로에서 401 이 반환되면 stale token 으로
  //     판단하고 즉시 제거 + 로그인 페이지로 redirect. 무한 401 루프 방지.
  //     로그인/로그아웃/검증 라우트 자체는 제외 (이미 인증 흐름의 일부).
  //
  // (2) apiBase silent-drift 방지: api() 의 fallback 분기에서 apiBase 가
  //     제거될 때, 그 base 로 발급된 token 은 동일 base 의 JWT 시크릿으로만
  //     검증 가능하므로 origin 이 바뀌면 토큰도 무효. 함께 제거하여
  //     "발급 서버 ≠ 검증 서버" 미스매치를 원천 차단.
  const AUTH_ROUTE_RX = /\/api\/admin\/auth\/(login|logout|refresh|otp|verify|setup|me)/;
  const handleAdminUnauthorized = (url) => {
    if (AUTH_ROUTE_RX.test(String(url || ''))) return; // 로그인 자체 401 은 통과
    try {
      localStorage.removeItem(STORAGE.adminToken);
    } catch (_) {}
    // 이미 로그인 페이지에 있으면 리다이렉트 생략 (무한 루프 방지)
    if (!/\/admin\/login(\.html)?$/.test(window.location.pathname)) {
      try {
        // 다른 호출처와 동일하게 상대 경로 사용 — admin/ 디렉토리 안에서
        // 실행되므로 login.html 로 충분. 다른 라우팅 구조로 deploy 된 환경
        // 에서도 호환.
        window.location.replace('login.html');
      } catch (_) {}
    }
  };

  const api = async (path, opt = {}) => {
    const urls = buildApiUrlCandidates(path);
    let lastErr = null;

    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      try {
        const data = await requestJson(url, opt);
        if (i > 0) {
          // (v330) fallback 성공 → apiBase 가 제거되므로 그 base 로 발급된
          //   token 도 무효 가능성. 함께 제거하여 다음 호출은 동일 origin 에서
          //   재로그인 후 새 토큰을 받도록.
          try {
            localStorage.removeItem(STORAGE.apiBase);
            localStorage.removeItem(STORAGE.adminToken);
          } catch (_) {}
        }
        return data;
      } catch (e) {
        lastErr = e;
        // (v330) 401 자동 처리 — 로그인 라우트가 아니라면 토큰 제거 + 로그인
        //   페이지로 리다이렉트. 첫 401 에서 즉시 동작.
        if (e?.status === 401) {
          handleAdminUnauthorized(url);
          throw e;
        }
        const hasFallback = i < urls.length - 1;
        if (!hasFallback || !e?.retryable) break;
      }
    }

    throw lastErr || new Error("요청 실패");
  };

  const fmtNum = (n, d = 0) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    const locale = window.AdminI18n?.locale?.() || "ko-KR";
    // 소수점이 모두 0이면 표기 생략 (trailing zeros 제거)
    return x.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: d });
  };

  const statusOrder = (s) => {
    if (s === "모집중") return 0;
    if (s === "구매진행") return 1;
    if (s === "분배중") return 2;
    if (s === "운영중") return 3;
    if (s === "매각") return 4;
    if (s === "매각(완료)") return 5;
    if (s === "모집실패") return 6;
    if (s === "취소됨") return 7;
    return 99;
  };

  const statusBadge = (s) => {
    if (s === "모집중") return `<span class="badge warn">모집중</span>`;
    if (s === "구매진행") return `<span class="badge good">매입중</span>`;
    if (s === "분배중") return `<span class="badge blue">분배중</span>`;
    if (s === "운영중") return `<span class="badge good">운영중</span>`;
    if (s === "매각") return `<span class="badge bad">매각</span>`;
    if (s === "매각(완료)") return `<span class="badge neutral">매각(완료)</span>`;
    if (s === "모집실패") return `<span class="badge bad">모집실패</span>`;
    if (s === "취소됨") return `<span class="badge neutral">취소됨</span>`;
    return `<span class="badge neutral">${s || "-"}</span>`;
  };

  const toNum = (v, fallback = null) => {
    const t = String(v ?? "").trim();
    if (!t) return fallback;
    const x = Number(t);
    return Number.isFinite(x) ? x : fallback;
  };

  const toStr = (v, fallback = null) => {
    const t = String(v ?? "").trim();
    return t ? t : fallback;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE.adminToken);
    toast("로그아웃", "good");
    setTimeout(() => { location.href = "login.html"; }, 150);
  };

  const dismissAdminRecovery = () => {
    const el = qs("#adminRecoveryNotice");
    if (el) el.remove();
  };

  const clearAdminBackdrop = () => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    qsa(".tx-overlay, .tp-overlay, .adm-modal-overlay, .ap-overlay, .upload-overlay, .confirm-overlay, dialog[open]").forEach((el) => {
      if (typeof el.close === "function") {
        try { el.close(); } catch (_) {}
      }
      try { el.removeAttribute("open"); } catch (_) {}
      el.classList.add("hidden");
      el.classList.remove("show");
      el.setAttribute("aria-hidden", "true");
      if (el.style) {
        el.style.display = "";
        el.style.pointerEvents = "none";
      }
    });
    try { window.__ADMIN_DASHBOARD_OVERLAY_GUARD__?.sweep?.(); } catch (_) {}
  };

  const showAdminRecovery = (message, detail = "") => {
    if (!/\/admin\//.test(location.pathname)) return;
    // 재발 방지: 브라우저 확장(inpage.js / MetaMask / 기타 월렛)이 뿌린 오류는
    // 관리자 페이지 자체 장애 카드로 승격하지 않는다.
    if (isAdminInjectedWalletNoise({ message, detail })) {
      dismissAdminRecovery();
      return;
    }
    clearAdminBackdrop();

    const root = qs(".admin-shell") || document.body;
    if (!root) return;

    let box = qs("#adminRecoveryNotice");
    if (!box) {
      box = document.createElement("div");
      box.id = "adminRecoveryNotice";
      box.className = "card";
      box.style.margin = "16px auto";
      box.style.maxWidth = "1200px";
      box.innerHTML = `
        <div class="pad">
          <div style="font-weight:900;font-size:18px;margin-bottom:6px;color:#991b1b">관리자 페이지 로드 오류</div>
          <div id="adminRecoveryMsg" class="muted"></div>
          <div id="adminRecoveryDetail" class="help" style="margin-top:8px"></div>
          <div class="row" style="margin-top:12px;gap:8px">
            <button id="adminRecoveryReload" type="button" class="btn primary">다시 불러오기</button>
            <button id="adminRecoveryDismiss" type="button" class="btn ghost">닫기</button>
          </div>
        </div>`;
      root.insertBefore(box, root.firstChild);
      box.querySelector("#adminRecoveryReload")?.addEventListener("click", () => location.reload());
      box.querySelector("#adminRecoveryDismiss")?.addEventListener("click", dismissAdminRecovery);
    }

    const msgEl = box.querySelector("#adminRecoveryMsg");
    const detailEl = box.querySelector("#adminRecoveryDetail");
    if (msgEl) msgEl.textContent = window.AdminI18n?.translateString?.(message || "페이지 일부를 불러오지 못했습니다.") || message || "페이지 일부를 불러오지 못했습니다.";
    if (detailEl) {
      const rawDetail = detail || "최신 스크립트와 캐시가 맞지 않거나 API 응답이 일시적으로 불안정할 때 발생할 수 있습니다.";
      detailEl.textContent = window.AdminI18n?.translateString?.(rawDetail) || rawDetail;
    }
    window.AdminI18n?.apply?.(box);
  };

  const requireAdmin = async () => {
    const token = localStorage.getItem(STORAGE.adminToken);
    if (!token) {
      location.replace("login.html");
      return null;
    }

    try {
      return await api("/api/admin/auth/me");
    } catch {
      localStorage.removeItem(STORAGE.adminToken);
      location.replace("login.html");
      return null;
    }
  };

  const bootAdminPage = async (activeKey) => {
    const me = await requireAdmin();
    if (!me) return null;

    const who = qs("#adminWho");
    if (who) who.textContent = `로그인: ${me.username || "admin"}`;

    const logoutBtn = qs("#adminLogoutBtn");
    logoutBtn?.addEventListener("click", logout);

    qsa("[data-admin-link]").forEach((a) => a.classList.remove("active"));
    const cur = qs(`[data-admin-link="${activeKey}"]`);
    if (cur) cur.classList.add("active");

    dismissAdminRecovery();
    window.AdminI18n?.apply?.();
    return me;
  };

  if (!window.AdminHeader || typeof window.AdminHeader.loadHeader !== "function") {
    window.AdminHeader = {
      loadHeader: async () => false,
      stopHeaderRefresh: () => {},
    };
  }


  const flattenAdminErrorParts = (value, out = []) => {
    if (value == null) return out;
    if (typeof value === "string") {
      out.push(value);
      return out;
    }
    if (value instanceof Error) {
      if (value.name) out.push(value.name);
      if (value.message) out.push(value.message);
      if (value.stack) out.push(value.stack);
      if (value.cause) flattenAdminErrorParts(value.cause, out);
      return out;
    }
    if (typeof value === "object") {
      ["message", "reason", "stack", "filename", "fileName", "source", "src", "href"].forEach((key) => {
        const v = value?.[key];
        if (typeof v === "string" && v.trim()) out.push(v.trim());
      });
      if (value?.reason && typeof value.reason !== "string") flattenAdminErrorParts(value.reason, out);
      if (value?.error) flattenAdminErrorParts(value.error, out);
      if (value?.cause) flattenAdminErrorParts(value.cause, out);
      return out;
    }
    out.push(String(value));
    return out;
  };

  const ADMIN_EXTENSION_NOISE_PATTERNS = [
    /failed to connect to metamask/i,
    /metamask extension not found/i,
    /could not establish connection/i,
    /receiving end does not exist/i,
    /message port closed before a response was received/i,
    /extension context invalidated/i,
    /disconnected port object/i,
    /could not establish connection\.\s*receiving end does not exist/i,
  ];

  const ADMIN_EXTENSION_SOURCE_PATTERNS = [
    /(?:chrome|moz|safari-web)-extension:\/\//i,
    /\binpage\.js\b/i,
    /\bcontentscript\.js\b/i,
    /\blockdown-install\.js\b/i,
    /\bmetamask\b/i,
    /\bphantom\b/i,
    /\brabby\b/i,
    /\bcoinbase\b/i,
    /\bsolflare\b/i,
    /\bokx\b/i,
  ];

  const isAdminInjectedWalletNoise = (value) => {
    const raw = flattenAdminErrorParts(value, []).join(" | ").trim();
    if (!raw) return false;
    return ADMIN_EXTENSION_NOISE_PATTERNS.some((rx) => rx.test(raw)) || ADMIN_EXTENSION_SOURCE_PATTERNS.some((rx) => rx.test(raw));
  };

  const safeLoadAdminHeader = async () => {
    try {
      if (window.AdminHeader && typeof window.AdminHeader.loadHeader === "function") {
        return await window.AdminHeader.loadHeader();
      }
      return false;
    } catch (e) {
      console.error("[admin.core] safeLoadAdminHeader failed", e);
      showAdminRecovery("상단 관리자 헤더를 불러오지 못했습니다.", e?.message || "header load failed");
      return false;
    }
  };

  window.addEventListener("error", (ev) => {
    const target = ev?.target;
    const resourceSource = target && target !== window ? (target.src || target.href || "") : "";
    if (isAdminInjectedWalletNoise({
      message: ev?.message,
      filename: ev?.filename,
      source: resourceSource,
      error: ev?.error,
    })) {
      try { ev.preventDefault?.(); } catch (_) {}
      return;
    }
    if (target && target !== window) return;
    const msg = ev?.message || "스크립트 오류가 발생했습니다.";
    showAdminRecovery("페이지 스크립트 오류가 발생했습니다.", msg);
  });

  if (/\/admin\/dashboard\.html(?:$|[?#])/.test(location.pathname + location.search + location.hash)) {
    window.addEventListener("pageshow", clearAdminBackdrop);
    onReady(() => { clearAdminBackdrop(); });
  }

  function mountVersionBadge() {
    if (document.getElementById("adminSiteVersion")) return;
    const el = document.createElement("div");
    el.id = "adminSiteVersion";
    el.textContent = RWA_VERSION;
    el.style.cssText = [
      "text-align:center",
      "font-size:11px",
      "color:#999",
      "letter-spacing:.04em",
      "opacity:.7",
      "padding:14px 0 18px",
      "user-select:all",
    ].join(";");
    document.body.appendChild(el);
  }
  onReady(mountVersionBadge);

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev?.reason;
    // 재발 방지: 브라우저 확장(inpage.js / MetaMask / 기타 월렛)의 주입 오류는
    // 관리자 페이지 자체 결함이 아니므로 공용 에러 카드로 승격하지 않는다.
    if (isAdminInjectedWalletNoise(reason)) {
      try { ev.preventDefault?.(); } catch (_) {}
      return;
    }
    const msg = reason?.message || String(reason || "알 수 없는 비동기 오류");
    showAdminRecovery("페이지 처리 중 오류가 발생했습니다.", msg);
  });

  window.AdminCore = {
    STORAGE,
    ADMIN_ASSET_TOKEN,
    qs,
    qsa,
    onReady,
    toast,
    api,
    apiBase,
    normalizeApiBase,
    buildApiUrlCandidates,
    fmtNum,
    statusOrder,
    statusBadge,
    toNum,
    toStr,
    logout,
    bootAdminPage,
    clearAdminBackdrop,
    showAdminRecovery,
    dismissAdminRecovery,
    safeLoadAdminHeader,
  };
})();
