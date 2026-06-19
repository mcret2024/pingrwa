// public/user/assets/js/wallet-adapter.js
// Multi-wallet adapter for Solana ecosystem.
// Supports: Phantom, Solflare, Backpack, Glow, Coin98, Trust Wallet
// Plus Wallet Standard (auto-discovery for any compliant wallet)
//
// Usage:
//   const installed = window.RwaWallet.detectInstalled();
//   const chosen = await window.RwaWallet.pickWallet();      // shows modal if 2+
//   const adapter = window.RwaWallet.adapt(chosen);
//   const address = await adapter.connect();
//   const sig = await adapter.signMessage(message);
//   await adapter.disconnect();
(() => {
  "use strict";

  if (window.RwaWallet) return; // idempotent

  // ===== External Wallet Extension Error Filter =====
  // Phantom/Solflare/MetaMask/TronLink 등의 inject script 가 우리 사이트의
  // wallet-standard:app-ready 이벤트를 받고 자체 register() 시도 시
  // destructure 'register' of undefined 같은 내부 호환성 에러 발생.
  // 사이트 동작에는 영향 없지만 콘솔이 지저분해지므로 silently swallow.
  if (!window.__SILICA_WALLET_ERR_FILTERED__) {
    window.__SILICA_WALLET_ERR_FILTERED__ = true;
    const SILENCED_PATTERNS = [
      /Cannot destructure property 'register'/,
      /Cannot destructure property "register"/,
      /SES Removing unpermitted intrinsics/,
    ];
    const SILENCED_FILES = ['solana.js', 'inpage.js', 'lockdown-install.js', 'injected.js'];

    window.addEventListener('error', (ev) => {
      const msg = String(ev?.message || ev?.error?.message || '');
      const file = String(ev?.filename || '');
      const isExternalWalletErr =
        SILENCED_PATTERNS.some((re) => re.test(msg)) ||
        SILENCED_FILES.some((f) => file.includes(f));
      if (isExternalWalletErr) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return false;
      }
    }, true);

    window.addEventListener('unhandledrejection', (ev) => {
      const reason = ev?.reason;
      const msg = String(reason?.message || reason || '');
      if (SILENCED_PATTERNS.some((re) => re.test(msg))) {
        ev.preventDefault();
        return false;
      }
    });
  }

  // ===== Wallet Definitions =====
  // Each definition: { id, name, icon, install_url, detect() => provider | null }
  const WALLETS = [
    {
      id: "phantom",
      name: "Phantom",
      icon: "https://187760183-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MVOiF6Zqit57q_hxJYp%2Ficon%2FU7kNZ4ygz4QW1rUwOuTT%2FWhite%20Ghost_docs_nu.svg?alt=media&token=447b91f6-db6d-4791-902d-35d75c19c3d1",
      install_url: "https://phantom.app/",
      detect() {
        if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
        if (window.solana?.isPhantom) return window.solana;
        return null;
      },
    },
    {
      id: "solflare",
      name: "Solflare",
      icon: "https://solflare.com/favicon.ico",
      install_url: "https://solflare.com/",
      detect() {
        if (window.solflare?.isSolflare) return window.solflare;
        return null;
      },
    },
    {
      id: "backpack",
      name: "Backpack",
      icon: "https://backpack.app/favicon.ico",
      install_url: "https://backpack.app/",
      detect() {
        if (window.backpack?.isBackpack) return window.backpack;
        return null;
      },
    },
    {
      id: "glow",
      name: "Glow",
      icon: "https://glow.app/favicon.ico",
      install_url: "https://glow.app/",
      detect() {
        if (window.glowSolana?.isGlow) return window.glowSolana;
        if (window.glow?.solana) return window.glow.solana;
        if (window.solana?.isGlow) return window.solana;
        return null;
      },
    },
    {
      id: "coin98",
      name: "Coin98",
      icon: "https://coin98.com/favicon.ico",
      install_url: "https://coin98.com/wallet",
      detect() {
        if (window.coin98?.sol) return window.coin98.sol;
        return null;
      },
    },
    {
      id: "trust",
      name: "Trust Wallet",
      icon: "https://trustwallet.com/favicon.ico",
      install_url: "https://trustwallet.com/",
      detect() {
        if (window.trustwallet?.solana) return window.trustwallet.solana;
        return null;
      },
    },
  ];

  // ===== Wallet Standard auto-discovery =====
  // Wallets that comply with the Wallet Standard register themselves via the
  // 'wallet-standard:register-wallet' CustomEvent. We listen for these and
  // emit the 'wallet-standard:app-ready' event so wallets that wait for the
  // app handshake also publish themselves.
  const STANDARD_WALLETS = []; // { id, name, icon, providerLike }

  const adaptStandardWallet = (standardWallet) => {
    // Wallet Standard wallets expose features under wallet.features
    // Common features: 'standard:connect', 'standard:disconnect',
    // 'solana:signMessage', 'solana:signAndSendTransaction'
    const features = standardWallet?.features || {};

    return {
      get publicKey() {
        const acc = standardWallet?.accounts?.[0];
        return acc?.publicKey ? { toString: () => bs58Encode(acc.publicKey) } : null;
      },
      async connect() {
        const fn = features["standard:connect"]?.connect;
        if (typeof fn !== "function") throw new Error("Wallet does not support standard:connect");
        await fn();
        const acc = standardWallet?.accounts?.[0];
        if (!acc) throw new Error("Wallet did not return an account");
        // accounts[0].publicKey is a Uint8Array — convert to base58
        return { publicKey: { toString: () => bs58Encode(acc.publicKey) } };
      },
      async signMessage(messageBytes) {
        const fn = features["solana:signMessage"]?.signMessage;
        if (typeof fn !== "function") throw new Error("Wallet does not support solana:signMessage");
        const acc = standardWallet?.accounts?.[0];
        if (!acc) throw new Error("No connected account");
        const out = await fn({ account: acc, message: messageBytes });
        // Standard returns array of { signedMessage, signature } — we need first signature
        const first = Array.isArray(out) ? out[0] : out;
        return { signature: first?.signature || first?.signedMessage };
      },
      async disconnect() {
        const fn = features["standard:disconnect"]?.disconnect;
        if (typeof fn === "function") await fn();
      },
      on() {}, // standard wallets use change events differently — left as no-op for now
    };
  };

  // Minimal Base58 encoder for the Wallet Standard publicKey (Uint8Array → string)
  function bs58Encode(bytes) {
    if (!bytes || !bytes.length) return "";
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    let s = "";
    while (n > 0n) {
      const r = Number(n % 58n);
      s = ALPHABET[r] + s;
      n = n / 58n;
    }
    return "1".repeat(zeros) + s;
  }

  const registerStandardWallet = (wallet) => {
    if (!wallet || !wallet.name) return;
    // Skip duplicates by name (already detected via direct global)
    if (STANDARD_WALLETS.some((w) => w.name === wallet.name)) return;
    if (WALLETS.some((w) => w.name.toLowerCase() === wallet.name.toLowerCase())) return;

    STANDARD_WALLETS.push({
      id: "standard:" + String(wallet.name).toLowerCase().replace(/\s+/g, "_"),
      name: wallet.name,
      icon: wallet.icon || null,
      install_url: null,
      _standard: true,
      _provider: adaptStandardWallet(wallet),
    });
  };

  // Listen for wallets registering after page load
  window.addEventListener("wallet-standard:register-wallet", (event) => {
    try {
      const detail = event?.detail;
      if (typeof detail?.register !== "function") return;
      // Pass our callback so the wallet hands us its descriptor
      detail.register((api) => {
        const wallet = api?.wallet;
        if (wallet) registerStandardWallet(wallet);
      });
    } catch (e) {
      console.warn("[wallet-adapter] standard register failed", e);
    }
  });

  // Fire app-ready so wallets that haven't registered yet publish themselves
  try {
    window.dispatchEvent(new Event("wallet-standard:app-ready"));
  } catch {}

  // ===== Public API: detection =====
  const detectInstalled = () => {
    const list = [];

    // Direct detection for known wallets
    for (const w of WALLETS) {
      const provider = w.detect();
      if (provider) {
        list.push({
          id: w.id,
          name: w.name,
          icon: w.icon,
          install_url: w.install_url,
          installed: true,
          _provider: provider,
        });
      }
    }

    // Wallet Standard discoveries (deduplicated)
    for (const sw of STANDARD_WALLETS) {
      if (list.some((l) => l.name.toLowerCase() === sw.name.toLowerCase())) continue;
      list.push({
        id: sw.id,
        name: sw.name,
        icon: sw.icon,
        install_url: null,
        installed: true,
        _provider: sw._provider,
      });
    }

    return list;
  };

  // List of installable wallets that are NOT currently installed
  // (used to show install prompts when no wallet is detected)
  const getInstallSuggestions = () => {
    const installedIds = new Set(detectInstalled().map((w) => w.id));
    return WALLETS
      .filter((w) => !installedIds.has(w.id))
      .map((w) => ({
        id: w.id,
        name: w.name,
        icon: w.icon,
        install_url: w.install_url,
        installed: false,
      }));
  };

  // ===== Common Adapter =====
  // Wraps any wallet provider (direct or Wallet Standard) into a uniform
  // interface. The rest of the codebase only sees this adapter.
  const adapt = (walletDescriptor) => {
    const provider = walletDescriptor?._provider;
    if (!provider) throw new Error("Invalid wallet descriptor");

    return {
      id: walletDescriptor.id,
      name: walletDescriptor.name,
      icon: walletDescriptor.icon,
      provider, // expose the raw provider for legacy code paths

      async connect() {
        const resp = await provider.connect();
        const pubkey = resp?.publicKey || provider?.publicKey;
        if (!pubkey) throw new Error("Wallet did not return a public key");
        return typeof pubkey.toString === "function" ? pubkey.toString() : String(pubkey);
      },

      async signMessage(message) {
        const messageBytes = (message instanceof Uint8Array)
          ? message
          : new TextEncoder().encode(String(message));
        // Phantom-style: provider.signMessage(bytes, "utf8") → { signature, publicKey }
        // Some wallets accept (bytes) only or (bytes, "utf8")
        let result;
        try {
          result = await provider.signMessage(messageBytes, "utf8");
        } catch (e) {
          // Fallback to no-encoding-arg signature
          result = await provider.signMessage(messageBytes);
        }
        // Normalize — return Uint8Array signature
        if (result?.signature) return result.signature;
        if (result instanceof Uint8Array) return result;
        if (Array.isArray(result)) return Uint8Array.from(result);
        throw new Error("Wallet did not return a signature");
      },

      async disconnect() {
        try {
          if (typeof provider.disconnect === "function") {
            await provider.disconnect();
          }
        } catch {}
      },

      onAccountChange(handler) {
        if (typeof provider.on === "function") {
          try { provider.on("accountChanged", handler); } catch {}
        }
      },

      offAccountChange(handler) {
        if (typeof provider.off === "function") {
          try { provider.off("accountChanged", handler); } catch {}
        } else if (typeof provider.removeListener === "function") {
          try { provider.removeListener("accountChanged", handler); } catch {}
        }
      },
    };
  };

  // (2026-05-12 v319) Operator: '모바일 일반 브라우저에서는 지갑을 인식 할
  //   수 없음으로 다른 좋은 유저 플로우 방식이 없을까?' Mobile browsers
  //   (Safari / Chrome / Samsung Internet) don't expose wallet extensions —
  //   the desktop "install" suggestions are dead-ends.
  // (v319.1) Operator: '오픈인팬텀을 클릭해도 팬텀 지갑 설치 페이지로가고,
  //   팬텀앱이 열리지가 안는다. 나의 모바일에는 이미 팬텀이 설치 되어 있다.'
  //   Samsung Internet (and some Android browsers) don't honour Android
  //   App Links — they treat https://phantom.app/ul/... as a regular web
  //   URL, hit phantom.app, which then serves the install page because
  //   the server sees a "no Phantom" referrer.
  //   Fix: on Android emit an `intent://` URI with an explicit
  //   `package=app.phantom` (or com.solflare.mobile) so the OS hands the
  //   request directly to the installed app, with a documented
  //   browser_fallback_url for users who genuinely don't have it.
  //   iOS keeps the universal link (Apple's App Site Association is what
  //   does the routing there).
  const isMobileBrowser = () => {
    try {
      if (typeof navigator === 'undefined') return false;
      const ua = String(navigator.userAgent || '');
      return /iPhone|iPad|iPod|Android|Mobile|webOS|BlackBerry/i.test(ua);
    } catch (_) { return false; }
  };
  const isAndroid = () => {
    try { return /Android/i.test(String(navigator.userAgent || '')); }
    catch (_) { return false; }
  };

  // Each entry returns a function that builds a deep-link URL given the
  // current dApp URL. When tapped, the OS hands the URL to the wallet app
  // which then renders the dApp inside its own browser. The wallet's JS
  // provider is injected into that browser context so detect() succeeds.
  const MOBILE_DEEPLINKS = {
    phantom: (dApp, ref) => {
      const encUrl = encodeURIComponent(dApp);
      const encRef = encodeURIComponent(ref);
      if (isAndroid()) {
        // intent:// URI — Samsung Internet / Chrome on Android route this
        // straight to the app.phantom package without going through the
        // web server. If Phantom isn't installed, the OS opens the
        // browser_fallback_url (Play Store landing).
        const fb = encodeURIComponent('https://phantom.app/download');
        return `intent://phantom.app/ul/browse/${encUrl}?ref=${encRef}#Intent;scheme=https;package=app.phantom;S.browser_fallback_url=${fb};end`;
      }
      // iOS + others: universal link
      return `https://phantom.app/ul/browse/${encUrl}?ref=${encRef}`;
    },
    solflare: (dApp, ref) => {
      const encUrl = encodeURIComponent(dApp);
      const encRef = encodeURIComponent(ref);
      if (isAndroid()) {
        const fb = encodeURIComponent('https://solflare.com/download');
        return `intent://solflare.com/ul/v1/browse/${encUrl}?ref=${encRef}#Intent;scheme=https;package=com.solflare.mobile;S.browser_fallback_url=${fb};end`;
      }
      return `https://solflare.com/ul/v1/browse/${encUrl}?ref=${encRef}`;
    },
    // Backpack/Glow/Coin98/Trust deeplinks are less stable — left null,
    // they won't appear on the mobile picker.
    backpack: null,
    glow:     null,
    coin98:   null,
    trust:    null,
  };

  // Custom-scheme fallback. If even intent:// fails (very old browsers /
  // strange in-app webviews), the user can tap a small backup link that
  // uses the legacy phantom:// scheme directly. Discouraged but works
  // when nothing else does.
  const phantomCustomScheme = (dApp) =>
    `phantom://browse/${encodeURIComponent(dApp)}`;

  const currentDappUrl = () => {
    try { return window.location.origin + window.location.pathname; }
    catch (_) { return ''; }
  };
  const currentRef = () => {
    try { return window.location.host; } catch (_) { return 'silica'; }
  };

  // ===== Wallet Picker Modal =====
  // Returns a Promise that resolves with the chosen wallet descriptor,
  // or null if the user cancelled.
  const pickWallet = async () => {
    const installed = detectInstalled();
    if (installed.length === 0) {
      // No wallets detected.
      //   Mobile browser → deep-link modal (open inside wallet's app browser)
      //   Desktop browser → existing install-suggestions modal
      if (isMobileBrowser()) {
        return showMobileModal({ allowCancel: true });
      }
      return showModal({ installed: [], suggestions: getInstallSuggestions(), allowCancel: true });
    }
    if (installed.length === 1) {
      // Auto-select the only one
      return installed[0];
    }
    return showModal({ installed, suggestions: [], allowCancel: true });
  };

  const ensureModalStyles = () => {
    if (document.getElementById("rwa-wallet-modal-style")) return;
    const style = document.createElement("style");
    style.id = "rwa-wallet-modal-style";
    style.textContent = `
.rwa-wallet-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(2px);animation:rwafade .15s ease-out}
@keyframes rwafade{from{opacity:0}to{opacity:1}}
.rwa-wallet-modal{background:#fff;border-radius:18px;padding:22px;width:min(420px,92vw);max-height:84vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.rwa-wallet-modal h3{margin:0 0 4px;font-size:18px;font-weight:950;color:#111}
.rwa-wallet-modal .rwa-wallet-sub{color:#6b7280;font-size:13px;margin-bottom:16px}
.rwa-wallet-list{display:flex;flex-direction:column;gap:8px}
.rwa-wallet-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa;cursor:pointer;transition:all .12s}
.rwa-wallet-item:hover{background:#f0f9ff;border-color:#3b82f6}
.rwa-wallet-item.install{background:#fff;cursor:pointer;opacity:.85}
.rwa-wallet-item.install:hover{opacity:1}
.rwa-wallet-icon{width:36px;height:36px;border-radius:8px;background:#fff;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-weight:950;color:#3b82f6;font-size:14px;overflow:hidden}
.rwa-wallet-icon img{width:100%;height:100%;object-fit:contain}
.rwa-wallet-meta{flex:1;min-width:0}
.rwa-wallet-meta .name{font-weight:900;color:#111;font-size:15px}
.rwa-wallet-meta .status{font-size:12px;color:#6b7280;margin-top:2px}
.rwa-wallet-modal .rwa-wallet-cancel{margin-top:14px;padding:10px;background:#f3f4f6;border-radius:10px;text-align:center;cursor:pointer;font-size:13px;color:#374151}
.rwa-wallet-modal .rwa-wallet-cancel:hover{background:#e5e7eb}
.rwa-wallet-section-title{font-size:11px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px}

/* (v319) Mobile deep-link modal */
.rwa-mobile-intro{padding:14px 16px;background:linear-gradient(135deg,rgba(124,58,237,0.08),rgba(6,182,212,0.06));border:1px solid rgba(124,58,237,0.20);border-radius:12px;margin-bottom:14px;font-size:13px;color:#374151;line-height:1.55}
.rwa-mobile-intro strong{display:block;color:#5B21B6;font-weight:800;margin-bottom:4px;font-size:13px}
.rwa-mobile-cta{display:flex;align-items:center;gap:12px;padding:14px 14px;border-radius:14px;text-decoration:none;color:#111;margin-bottom:10px;transition:transform .12s ease,box-shadow .12s ease}
.rwa-mobile-cta.primary{background:linear-gradient(135deg,#8E24AA,#7C3AED);color:#fff;box-shadow:0 6px 18px rgba(124,58,237,0.30)}
.rwa-mobile-cta.primary:active{transform:translateY(1px)}
.rwa-mobile-cta.primary .name{color:#fff}
.rwa-mobile-cta.primary .sub{color:rgba(255,255,255,0.85)}
.rwa-mobile-cta.primary .arrow{color:#fff}
.rwa-mobile-cta.secondary{background:#fff;border:1px solid #E5E7EB}
.rwa-mobile-cta.secondary:active{background:#F9FAFB}
.rwa-mobile-cta .ic{width:42px;height:42px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:1px solid rgba(0,0,0,0.05)}
.rwa-mobile-cta .ic img{width:100%;height:100%;object-fit:contain}
.rwa-mobile-cta .meta{flex:1;min-width:0}
.rwa-mobile-cta .name{font-weight:800;font-size:15px;line-height:1.2}
.rwa-mobile-cta .sub{font-size:11.5px;color:#6B7280;margin-top:2px;letter-spacing:0.2px}
.rwa-mobile-cta .arrow{font-size:18px;color:#9CA3AF;font-weight:700;flex-shrink:0}
.rwa-mobile-alt{text-align:center;padding:10px 0 14px;font-size:12px;color:#6B7280}
.rwa-mobile-alt a{color:#7C3AED;font-weight:700;text-decoration:underline;margin-left:4px}
.rwa-mobile-footer{margin-top:8px;padding:12px 14px;background:#F9FAFB;border-radius:10px;font-size:12px;color:#6B7280;line-height:1.55}
.rwa-mobile-footer strong{display:block;color:#374151;font-weight:700;margin-bottom:2px;font-size:12px}
.rwa-mobile-footer a{color:#7C3AED;font-weight:700;text-decoration:none}
.rwa-mobile-footer a:active{text-decoration:underline}
`;
    document.head.appendChild(style);
  };

  const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // (v319) Mobile-specific modal — deep-link to wallet apps.
  // Resolves null after the user taps a deep-link (the browser navigates
  // away). When the user comes back through Phantom's in-app browser the
  // dApp re-runs with window.phantom.solana injected and the regular flow
  // takes over.
  const showMobileModal = ({ allowCancel }) =>
    new Promise((resolve) => {
      ensureModalStyles();

      const overlay = document.createElement("div");
      overlay.className = "rwa-wallet-overlay";
      overlay.setAttribute("data-no-i18n", "1");

      const modal = document.createElement("div");
      modal.className = "rwa-wallet-modal";

      const dApp = currentDappUrl();
      const ref = currentRef();

      // Build the deep-link list — only wallets we have a deeplink builder for
      const deepLinkWallets = WALLETS
        .filter((w) => typeof MOBILE_DEEPLINKS[w.id] === 'function')
        .map((w, idx) => ({
          ...w,
          mobileUrl: MOBILE_DEEPLINKS[w.id](dApp, ref),
          isPrimary: idx === 0,
        }));

      const phantomScheme = phantomCustomScheme(dApp);

      modal.innerHTML = `
        <h3>Connect on Mobile</h3>
        <div class="rwa-wallet-sub">Mobile browsers can't read wallet extensions. Tap a wallet below to open this site inside its app.</div>

        <div class="rwa-mobile-intro">
          <strong>How it works</strong>
          Your selected wallet app will open this site (<code>${escapeHtml(ref)}</code>) inside its built-in browser, where the wallet is automatically connected.
        </div>

        ${deepLinkWallets.map((w) => `
          <a class="rwa-mobile-cta ${w.isPrimary ? 'primary' : 'secondary'}"
             href="${escapeHtml(w.mobileUrl)}"
             rel="noopener">
            <div class="ic">${w.icon ? `<img src="${escapeHtml(w.icon)}" alt="">` : escapeHtml(w.name.charAt(0))}</div>
            <div class="meta">
              <div class="name">Open in ${escapeHtml(w.name)}</div>
              <div class="sub">${w.isPrimary ? 'Recommended · Solana wallet' : 'Alternative Solana wallet'}</div>
            </div>
            <span class="arrow">→</span>
          </a>
        `).join("")}

        <!-- (v319.1) 백업 — universal/intent 링크가 일부 브라우저에서
             막힐 경우 phantom:// 커스텀 스킴 직접 호출. 사용자가 명시적
             으로 탭하면 OS 가 직접 Phantom 앱으로 라우팅. -->
        <div class="rwa-mobile-alt">
          앱이 안 열리나요?
          <a href="${escapeHtml(phantomScheme)}">Phantom 앱 직접 호출 ↗</a>
        </div>

        <div class="rwa-mobile-footer">
          <strong>Don't have a wallet yet?</strong>
          Install Phantom from the
          <a href="https://phantom.app/download" target="_blank" rel="noopener">App Store / Play Store ↗</a>
          and revisit this page from within Phantom.
        </div>

        ${allowCancel ? `<div class="rwa-wallet-cancel" data-cancel="1">Cancel</div>` : ''}
      `;

      const close = (result) => {
        try { overlay.remove(); } catch (_) {}
        document.removeEventListener("keydown", onEsc);
        resolve(result);
      };

      const onEsc = (e) => { if (e.key === "Escape" && allowCancel) close(null); };
      document.addEventListener("keydown", onEsc);

      modal.addEventListener("click", (e) => {
        const cancelEl = e.target.closest("[data-cancel]");
        if (cancelEl) { close(null); return; }
        // Deep-link <a> taps — let the navigation proceed and dismiss the
        // overlay (no resolve needed; the user is being redirected away).
        const linkEl = e.target.closest("a.rwa-mobile-cta");
        if (linkEl) {
          setTimeout(() => { try { overlay.remove(); } catch (_) {} }, 60);
          // Don't call resolve — the page is navigating away.
        }
      });

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay && allowCancel) close(null);
      });

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    });

  const showModal = ({ installed, suggestions, allowCancel }) =>
    new Promise((resolve) => {
      ensureModalStyles();

      const overlay = document.createElement("div");
      overlay.className = "rwa-wallet-overlay";
      overlay.setAttribute("data-no-i18n", "1");

      const modal = document.createElement("div");
      modal.className = "rwa-wallet-modal";

      const hasInstalled = installed.length > 0;

      modal.innerHTML = `
        <h3>${hasInstalled ? "Select a wallet" : "No wallet detected"}</h3>
        <div class="rwa-wallet-sub">${hasInstalled
          ? "Choose the Solana wallet you want to connect."
          : "Install one of the supported Solana wallets and reload this page."}</div>

        ${hasInstalled ? `<div class="rwa-wallet-section-title">Installed</div>` : ""}
        <div class="rwa-wallet-list">
          ${installed.map((w, i) => `
            <div class="rwa-wallet-item" data-pick="${i}">
              <div class="rwa-wallet-icon">${w.icon ? `<img src="${escapeHtml(w.icon)}" alt="">` : escapeHtml(w.name.charAt(0))}</div>
              <div class="rwa-wallet-meta">
                <div class="name">${escapeHtml(w.name)}</div>
                <div class="status">Detected</div>
              </div>
            </div>
          `).join("")}
        </div>

        ${suggestions.length > 0 ? `
          <div class="rwa-wallet-section-title">Get a wallet</div>
          <div class="rwa-wallet-list">
            ${suggestions.map((w) => `
              <a class="rwa-wallet-item install" href="${escapeHtml(w.install_url)}" target="_blank" rel="noopener">
                <div class="rwa-wallet-icon">${w.icon ? `<img src="${escapeHtml(w.icon)}" alt="">` : escapeHtml(w.name.charAt(0))}</div>
                <div class="rwa-wallet-meta">
                  <div class="name">${escapeHtml(w.name)}</div>
                  <div class="status">Install ↗</div>
                </div>
              </a>
            `).join("")}
          </div>
        ` : ""}

        ${allowCancel ? `<div class="rwa-wallet-cancel" data-cancel="1">Cancel</div>` : ""}
      `;

      const close = (result) => {
        try { overlay.remove(); } catch {}
        document.removeEventListener("keydown", onEsc);
        resolve(result);
      };

      const onEsc = (e) => { if (e.key === "Escape" && allowCancel) close(null); };
      document.addEventListener("keydown", onEsc);

      modal.addEventListener("click", (e) => {
        const pickEl = e.target.closest("[data-pick]");
        if (pickEl) {
          const idx = Number(pickEl.getAttribute("data-pick"));
          if (Number.isFinite(idx) && installed[idx]) close(installed[idx]);
          return;
        }
        const cancelEl = e.target.closest("[data-cancel]");
        if (cancelEl) close(null);
      });

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay && allowCancel) close(null);
      });

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    });

  // ===== Export =====
  window.RwaWallet = {
    detectInstalled,
    getInstallSuggestions,
    pickWallet,
    adapt,
  };
})();
