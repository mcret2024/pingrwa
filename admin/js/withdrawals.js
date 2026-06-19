// public/admin/js/withdrawals.js
(() => {
  "use strict";

  const { qs, toast, api, bootAdminPage } = window.AdminCore;
  const { PublicKey, Transaction, SystemProgram, TransactionInstruction } = solanaWeb3;

  let SOLANA_NETWORK = "devnet";
  let USDT_MINT_STR = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  let USDT_MINT = new PublicKey(USDT_MINT_STR);
  let USDT_DECIMALS = 6;
  let CONFIGURED_ADMIN_WALLET = "";
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
  const SYSVAR_RENT_PUBKEY = new PublicKey("SysvarRent111111111111111111111111111111111");

  const u8FromText = (txt) => new TextEncoder().encode(String(txt || ""));
  const u8FromArr = (arr) => new Uint8Array(arr);
  const u8Alloc = (len) => new Uint8Array(len);

  const writeU64LE = (u8, offset, vBig) => {
    let v = BigInt(vBig);
    for (let i = 0; i < 8; i += 1) {
      u8[offset + i] = Number(v & 255n);
      v >>= 8n;
    }
  };

  const u8ToBase64 = (u8) => {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      bin += String.fromCharCode.apply(null, Array.from(u8.slice(i, i + chunk)));
    }
    return btoa(bin);
  };

  const toAmountBigInt = (amountStr, decimals) => {
    const s = String(amountStr ?? "0").trim();
    const [i, f = ""] = s.split(".");
    const intPart = (i || "0").replace(/\D/g, "") || "0";
    const fracPart = (f || "").replace(/\D/g, "").slice(0, decimals).padEnd(decimals, "0");
    return BigInt(intPart) * (10n ** BigInt(decimals)) + BigInt(fracPart || "0");
  };

  const findATA = (ownerPk, mintPk) => PublicKey.findProgramAddressSync(
    [ownerPk.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPk.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];

  const createATAIxIdempotent = (payer, ata, owner, mint) => new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: u8FromArr([1]),
  });

  const makeTransferCheckedIx = (fromATA, mint, toATA, owner, amountBig, decimals) => {
    const data = u8Alloc(10);
    data[0] = 12;
    writeU64LE(data, 1, amountBig);
    data[9] = Number(decimals) & 255;
    return new TransactionInstruction({
      keys: [
        { pubkey: fromATA, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: toATA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data,
    });
  };

  const makeMemoIx = (text) => {
    const u8 = u8FromText(String(text || "")).slice(0, 180);
    return new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM_ID, data: u8 });
  };

  const getLatestBlockhashFromServer = async () => {
    const r = await api("/api/public/solana/blockhash", { method: "GET" });
    const bh = String(r?.blockhash || "").trim();
    if (!bh) throw new Error("blockhash 조회 실패");
    return bh;
  };

  const buildExplorerTxUrl = (txid) => {
    const sig = encodeURIComponent(String(txid || "").trim());
    if (!sig) return '#';
    return SOLANA_NETWORK === 'mainnet-beta'
      ? `https://solscan.io/tx/${sig}`
      : `https://solscan.io/tx/${sig}?cluster=${encodeURIComponent(SOLANA_NETWORK || 'devnet')}`;
  };

  const blurIfContained = (root) => {
    const active = document.activeElement;
    if (root && active && root.contains(active) && typeof active.blur === 'function') {
      try { active.blur(); } catch {}
    }
  };

  const fmt = (n, d = 6) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const short = (s) => {
    s = String(s || "");
    if (s.length <= 18) return s;
    return `${s.slice(0, 8)}...${s.slice(-6)}`;
  };

  const escapeHtml = (s) => String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const parseMemoNum = (memo, keys) => {
    const src = String(memo || "");
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const m = src.match(new RegExp(`(?:^|\\|)${key}:([0-9.]+)`));
      const n = m ? Number(m[1] || 0) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };

  const parseMemoText = (memo, keys) => {
    const src = String(memo || "");
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const m = src.match(new RegExp(`(?:^|\\|)${key}:([^|]+)`));
      if (m && m[1]) {
        try { return decodeURIComponent(m[1]); } catch { return String(m[1]); }
      }
    }
    return "";
  };

  const feeAmount = (row) => {
    const direct = Number(row?.fee_amount);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const memoFee = parseMemoNum(row?.memo, ["fee_amount", "fee"]);
    return memoFee > 0 ? memoFee : 0;
  };

  const sendAmount = (row) => {
    const direct = Number(row?.net_amount);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const memoNet = parseMemoNum(row?.memo, ["net_amount", "net_amt", "net"]);
    if (memoNet > 0) return memoNet;
    return Math.max(0, Number(row?.amount || 0) - feeAmount(row));
  };

  const rejectReason = (row) => String(row?.reject_reason || parseMemoText(row?.memo, ["reject_reason", "reason"]) || "").trim();
  const normalizeRawStatus = (raw) => {
    const s = String(raw || "").trim().toLowerCase();
    if (["pending", "processing"].includes(s)) return "대기";
    if (["done", "sent"].includes(s)) return "전송완료";
    if (["rejected", "failed", "canceled", "cancelled"].includes(s)) return "반려";
    return raw ? String(raw) : "-";
  };
  const displayStatus = (row) => {
    const explicit = String(row?.display_status || "").trim();
    return explicit || normalizeRawStatus(row?.status || "");
  };
  // ★ 이중출금 방지: 액션(전송/반려) 가능 = 'pending' 만
  //    'processing' 은 잠금 상태 → 재전송 차단
  const isPendingLike = (row) => String(row?.status || "").trim().toLowerCase() === "pending";
  const isProcessingRow = (row) => String(row?.status || "").trim().toLowerCase() === "processing";
  // 수동완료 가능 = 'processing' (체인 전송됐을 가능성, Solscan 검증 후)
  const canManualCompleteRow = (row) => isProcessingRow(row);

  const toDateUtc = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return new Date(`${s.replace(" ", "T")}Z`);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return new Date(`${s}Z`);
    return new Date(s);
  };

  const fmtKst = (v) => {
    const d = toDateUtc(v);
    if (!d || Number.isNaN(d.getTime())) return v ? String(v) : "-";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  };

  const provider = () => window.solana;
  let PICK = null;
  let LAST_ROWS = [];
  let _locked = false;
  let _rejectConfirmResolve = null;
  let OTP_BYPASSED = false;
  let _restoreFocusEl = null;

  const isRejectConfirmOpen = () => {
    const el = qs("#wdRejectConfirm");
    return !!el && !el.classList.contains("hidden");
  };

  const syncBodyLock = () => {
    document.body.style.overflow = (_locked || isRejectConfirmOpen()) ? "hidden" : "";
  };

  const setWalletUI = () => {
    const btn = qs("#admWalletBtn");
    const addr = qs("#admWalletAddr");
    const connected = !!(provider()?.isPhantom && provider()?.publicKey);
    if (connected) {
      const a = provider().publicKey.toBase58();
      if (btn) {
        btn.textContent = "지갑 해제";
        btn.classList.add("danger");
      }
      if (addr) addr.textContent = a;
    } else {
      if (btn) {
        btn.textContent = "팬텀 연결";
        btn.classList.remove("danger");
      }
      if (addr) addr.textContent = "-";
    }
  };

  const syncOtpUi = () => {
    const field = qs("#wdOtp")?.closest(".field");
    if (field) field.style.display = OTP_BYPASSED ? "none" : "";
    if (OTP_BYPASSED) {
      const input = qs("#wdOtp");
      if (input) input.value = "";
    }
  };

  const loadSecurityConfig = async () => {
    let publicCfg = null;
    let bypass = null;
    try {
      publicCfg = await api("/api/public/config", { method: "GET" });
      if (publicCfg && typeof publicCfg.bypass_otp !== "undefined") bypass = !!publicCfg.bypass_otp;
    } catch (_) {}

    try {
      const r = await api("/api/admin/settings/security", { method: "GET" });
      if (r && typeof r.bypass_otp !== "undefined") bypass = !!r.bypass_otp;
    } catch (_) {}

    SOLANA_NETWORK = String(publicCfg?.solana_network || "devnet").trim() || "devnet";
    const mint = String(publicCfg?.usdt_mint || USDT_MINT_STR).trim();
    if (mint) {
      try {
        USDT_MINT = new PublicKey(mint);
        USDT_MINT_STR = mint;
      } catch (_) {}
    }
    const dec = Number(publicCfg?.usdt_decimals);
    USDT_DECIMALS = (Number.isFinite(dec) && dec >= 0) ? Math.floor(dec) : 6;

    OTP_BYPASSED = !!bypass;
    syncOtpUi();

    // 관리자 출금 지갑 설정 주소 로드
    try {
      const w = await api("/api/admin/settings/withdraw-wallet", { method: "GET" });
      CONFIGURED_ADMIN_WALLET = String(w?.withdraw_admin_usdt_address || "").trim();
    } catch (_) {
      CONFIGURED_ADMIN_WALLET = "";
    }
  };

  // (2026-05-08) Policy change: 출금 지갑은 관리자 지갑 설정과 일치하지 않아도
  //   관계 없다 — 사장님 지시. 중요한 것은 deposit_admin_usdt_address (입금
  //   주소) 이지, 출금 송금 시 사용하는 Phantom 지갑이 아니다.
  //   따라서 강제 일치 검사를 제거하고, 연결된 Phantom 지갑이 어떤 주소든
  //   잔액이 있으면 송금이 진행되도록 한다. (잔액 부족 시 Solana RPC 가
  //   알아서 거절하므로 별도 가드 불필요.)
  //
  //   다만 "주소가 한 번도 설정된 적 없는 fresh install" 상황에서 send 가
  //   곧장 진행되면 사용자가 무엇을 보내는지 헷갈릴 수 있으므로, 그 경우는
  //   기존 안내 alert 만 남기고 차단은 하지 않는다.
  const checkAdminWalletOrAlert = (_connectedAddr) => {
    // No-op — admin can use any connected wallet to send the withdrawal.
    // The configured CONFIGURED_ADMIN_WALLET is informational only.
    return true;
  };

  const connectPhantom = async () => {
    if (!provider()?.isPhantom) throw new Error("Phantom 지갑이 필요합니다.");
    await provider().connect();
    setWalletUI();
  };

  const disconnectPhantom = async () => {
    if (provider()?.isPhantom) {
      try { await provider().disconnect(); } catch {}
    }
    setWalletUI();
  };

  const ensurePhantomConnected = async () => {
    if (!provider()?.isPhantom) throw new Error("Phantom 지갑이 필요합니다.");
    if (!provider().publicKey) await provider().connect();
    setWalletUI();
    if (!provider().publicKey) throw new Error("지갑 연결 실패");
    return provider().publicKey;
  };

  const setOverlayUI = (mode, htmlOrText) => {
    const title = qs("#txOverlayTitle");
    const msg = qs("#txOverlayMsg");
    const spin = qs("#txOverlaySpinner");
    const actions = qs("#txOverlayActions");
    if (title) title.textContent = mode === "done" ? "완료" : "처리중";
    if (msg) msg.innerHTML = htmlOrText || (mode === "done" ? "완료되었습니다." : "처리 중입니다. 잠시만 기다려주세요.");
    if (spin) spin.style.display = mode === "done" ? "none" : "";
    if (actions) actions.style.display = mode === "done" ? "flex" : "none";
  };

  const syncActionButtons = () => {
    const hasPick = !!PICK?.id;
    const actionable = hasPick && isPendingLike(PICK);  // pending 만
    const manualOk = hasPick && canManualCompleteRow(PICK);  // processing 만
    const sendBtn = qs("#wdSendBtn");
    const rejectBtn = qs("#wdRejectBtn");
    const manualBtn = qs("#wdManualBtn");
    if (sendBtn) sendBtn.disabled = _locked || !actionable;
    if (rejectBtn) rejectBtn.disabled = _locked || !actionable;
    if (manualBtn) {
      manualBtn.hidden = !manualOk;
      manualBtn.disabled = _locked || !manualOk;
    }
  };

  const lockAll = (lock) => {
    _locked = !!lock;
    ["wdRefreshBtn", "wdSendBtn", "wdRejectBtn", "wdManualBtn", "admWalletBtn"].forEach((id) => {
      const el = qs(`#${id}`);
      if (el) el.disabled = lock;
    });
    ["wdStatus", "wdSearch", "wdOtp", "wdRejectReason"].forEach((id) => {
      const el = qs(`#${id}`);
      if (el) el.disabled = lock;
    });
    syncActionButtons();
    syncBodyLock();
  };

  const openOverlay = (msg) => {
    const ov = qs("#txOverlay");
    if (!ov) return;
    _restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try { ov.inert = false; } catch {}
    setOverlayUI("loading", escapeHtml(msg || "처리 중입니다..."));
    ov.classList.remove("hidden");
    ov.setAttribute("aria-hidden", "false");
    lockAll(true);
  };

  const doneOverlayTx = ({ request_id, txid, netAmount }) => {
    const ov = qs("#txOverlay");
    if (!ov) return;
    const tx = String(txid || "");
    const txShort = short(tx);
    const html =
      `전송 완료<br>` +
      `request_id=<span class="mono">${escapeHtml(request_id)}</span><br>` +
      (Number.isFinite(Number(netAmount)) ? `전송수량=<span class="mono">${escapeHtml(fmt(netAmount, 6))} USDT</span><br>` : "") +
      `txid=<a class="mono" target="_blank" rel="noopener" style="color:#7c3aed;font-weight:900;text-decoration:none" href="${buildExplorerTxUrl(tx)}">${escapeHtml(txShort)}</a>` +
      `<div class="mono" style="margin-top:8px; color:#374151">${escapeHtml(tx)}</div>` +
      `<div style="margin-top:10px;color:#475569">확인을 누르면 종료됩니다.</div>`;
    try { ov.inert = false; } catch {}
    setOverlayUI("done", html);
    ov.classList.remove("hidden");
    ov.setAttribute("aria-hidden", "false");
    lockAll(true);
  };

  const doneOverlayText = (msg) => {
    const ov = qs("#txOverlay");
    if (!ov) return;
    try { ov.inert = false; } catch {}
    setOverlayUI("done", escapeHtml(msg || "완료되었습니다."));
    ov.classList.remove("hidden");
    ov.setAttribute("aria-hidden", "false");
    lockAll(true);
  };

  const closeOverlay = () => {
    const ov = qs("#txOverlay");
    if (!ov) return;
    blurIfContained(ov);
    ov.classList.add("hidden");
    ov.setAttribute("aria-hidden", "true");
    try { ov.inert = true; } catch {}
    lockAll(false);
    if (_restoreFocusEl && typeof _restoreFocusEl.focus === "function") {
      try { _restoreFocusEl.focus(); } catch {}
    }
  };

  const closeRejectConfirm = (answer = false) => {
    // (2026-05-21 v715) 모달 안의 textarea (#wdRejectReason) 가 빈 상태로 최종
    //   반려 버튼 누르면 alert 표시 후 모달 유지 (UX: 사유 입력 강제).
    //   answer === true 일 때만 validation. cancel/backdrop click 시는 즉시 닫음.
    if (answer === true) {
      const reasonEl = qs("#wdRejectReason");
      const reason = String(reasonEl?.value || "").trim();
      if (!reason) {
        window.alert("반려 사유를 입력해 주세요.");
        try { reasonEl?.focus(); } catch {}
        return;  // 모달 유지
      }
    }
    const ov = qs("#wdRejectConfirm");
    if (ov) {
      blurIfContained(ov);
      ov.classList.add("hidden");
      ov.setAttribute("aria-hidden", "true");
      try { ov.inert = true; } catch {}
    }
    syncBodyLock();
    const resolve = _rejectConfirmResolve;
    _rejectConfirmResolve = null;
    if (_restoreFocusEl && typeof _restoreFocusEl.focus === "function") {
      try { _restoreFocusEl.focus(); } catch {}
    }
    if (typeof resolve === "function") resolve(!!answer);
  };

  // (2026-06-07 v882) 전송 사전 확인 모달 — Phantom 표시 한계 대응.
  let _sendConfirmResolve = null;
  const isSendConfirmOpen = () => {
    const ov = qs("#wdSendConfirm");
    return !!(ov && !ov.classList.contains("hidden"));
  };
  const closeSendConfirm = (answer = false) => {
    const ov = qs("#wdSendConfirm");
    if (ov) {
      blurIfContained(ov);
      ov.classList.add("hidden");
      ov.setAttribute("aria-hidden", "true");
      try { ov.inert = true; } catch {}
    }
    syncBodyLock();
    const resolve = _sendConfirmResolve;
    _sendConfirmResolve = null;
    if (_restoreFocusEl && typeof _restoreFocusEl.focus === "function") {
      try { _restoreFocusEl.focus(); } catch {}
    }
    if (typeof resolve === "function") resolve(!!answer);
  };
  // (v884) trailing zero 제거 — "1,000,000.000000" → "1,000,000".
  //   소수점이 있으면 의미있는 자리수까지만 표시 ("1,000.500000" → "1,000.5").
  const fmtTrim = (val, d) => String(fmt(Number(val) || 0, d)).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

  const askSendConfirm = ({ row, netAmount }) => new Promise((resolve) => {
    const ov = qs("#wdSendConfirm");
    if (!ov) {
      const msg = `USDT 출금 전송 확인\n\n받는 주소: ${row?.to_address || "-"}\n신청수량: ${fmtTrim(row?.amount, 6)} USDT\n출금수수료: ${fmtTrim(feeAmount(row), 6)} USDT\n실제 전송: ${fmtTrim(netAmount, 6)} USDT\n\nSolana 지갑으로 진행하시겠습니까?`;
      resolve(window.confirm(msg));
      return;
    }
    _restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    _sendConfirmResolve = resolve;
    const setText = (id, val) => { const el = qs(`#${id}`); if (el) el.textContent = val; };
    setText("wdSendCfReqId",     row?.id || "-");
    setText("wdSendCfTo",        row?.to_address || "-");
    setText("wdSendCfRequested", fmtTrim(row?.amount, 6));
    setText("wdSendCfFee",       fmtTrim(feeAmount(row), 6));
    setText("wdSendCfNet",       fmtTrim(netAmount, 6));
    try { ov.inert = false; } catch {}
    ov.classList.remove("hidden");
    ov.setAttribute("aria-hidden", "false");
    syncBodyLock();
    setTimeout(() => qs("#wdSendConfirmOk")?.focus(), 50);
  });

  const askRejectConfirm = ({ row, reason }) => new Promise((resolve) => {
    const ov = qs("#wdRejectConfirm");
    const summary = qs("#wdRejectConfirmSummary");
    if (!ov || !summary) {
      resolve(window.confirm(`정말 출금을 반려하시겠습니까?\n\n요청ID: ${row?.id || "-"}`));
      return;
    }
    _restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    _rejectConfirmResolve = resolve;
    // (2026-05-21 v715) summary 에서 '반려사유' 라인 제거 — 사용자가 모달 안의
    //   textarea 에서 직접 입력하므로 중복 표시 불필요.
    const lines = [
      `요청ID: ${row?.id || "-"}`,
      `현재상태: ${displayStatus(row)}`,
      `신청자 지갑: ${row?.address || "-"}`,
      `수령주소: ${row?.to_address || "-"}`,
      `신청수량: ${fmt(Number(row?.amount || 0), 6)} USDT`,
      `출금수수료: ${fmt(feeAmount(row), 6)} USDT`,
      `전송수량: ${fmt(sendAmount(row), 6)} USDT`,
    ];
    summary.textContent = lines.join("\n");
    try { ov.inert = false; } catch {}
    ov.classList.remove("hidden");
    ov.setAttribute("aria-hidden", "false");
    syncBodyLock();
    // 모달 열림 시 textarea 에 focus — 사용자가 바로 사유 입력 가능.
    setTimeout(() => qs("#wdRejectReason")?.focus(), 50);
  });

  qs("#txOverlayOk")?.addEventListener("click", closeOverlay);
  document.addEventListener("keydown", (e) => {
    if (isRejectConfirmOpen() && e.key === "Escape") {
      e.preventDefault();
      closeRejectConfirm(false);
      return;
    }
    if (!_locked) return;
    if (e.key === "Escape" || e.key === "Tab") e.preventDefault();
  }, true);

  const otpVal = () => String(qs("#wdOtp")?.value || "").trim().replace(/\D/g, "").slice(0, 6);

  const pickRender = (x) => {
    PICK = x || null;
    const reason = rejectReason(x);
    const rawAmount = Number(x?.amount || 0);
    const fee = feeAmount(x);
    const netAmount = sendAmount(x);
    qs("#wdPickId").textContent = x ? String(x.id) : "-";
    qs("#wdPickStatus").textContent = x ? displayStatus(x) : "-";
    qs("#wdPickAddr").textContent = x ? String(x.address || "-") : "-";
    qs("#wdPickTo").textContent = x ? String(x.to_address || "-") : "-";
    qs("#wdPickAmt").textContent = x ? `${fmt(rawAmount, 6)} USDT` : "-";
    qs("#wdPickFee").textContent = x ? `${fmt(fee, 6)} USDT` : "-";
    qs("#wdPickNet").textContent = x ? `${fmt(netAmount, 6)} USDT` : "-";
    // (2026-05-21 v737) 운영자 요청 — 검토 기록의 txid 해시 클릭 시 Solscan
    //   새 창 열림. textContent → innerHTML 로 변경하여 link 삽입 가능.
    //   reason 은 사용자 입력이므로 escapeHtml 처리, reviewed_by 도 동일.
    const reviewParts = [];
    if (x?.reviewed_by) reviewParts.push(`검토자 ${escapeHtml(String(x.reviewed_by))}`);
    if (x?.reviewed_at) reviewParts.push(escapeHtml(fmtKst(x.reviewed_at)));
    if (x?.txid) {
      const txid = String(x.txid);
      const url = buildExplorerTxUrl(txid);
      reviewParts.push(`txid <a class="mono" href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:#7c3aed;font-weight:700;text-decoration:underline" title="Solscan 새 창 열기">${escapeHtml(short(txid))} ↗</a>`);
    }
    if (reason) reviewParts.push(`반려사유: ${escapeHtml(String(reason))}`);
    qs("#wdPickReview").innerHTML = x ? (reviewParts.join(" | ") || "-") : "-";

    // (2026-05-21 v738) 신청 시간 / 전송 시간 별도 카드 표시.
    //   - 신청 시간 = withdraw_requests.created_at (유저가 출금 신청한 시점)
    //   - 전송 시간 = 'done' 상태일 때만 reviewed_at (관리자가 체인 전송한 시점)
    //     reviewed_at 은 reject 시에도 set 되므로 status 가 done/sent 일 때만 표시.
    const createdEl = qs("#wdPickCreatedAt");
    if (createdEl) createdEl.textContent = x && x.created_at ? fmtKst(x.created_at) : "-";
    const sentEl = qs("#wdPickSentAt");
    if (sentEl) {
      const isDone = ['done', 'sent', '완료', '출금완료'].includes(String(x?.status || '').trim().toLowerCase()) ||
                     ['완료', '출금완료'].includes(String(x?.status || '').trim());
      sentEl.textContent = (x && isDone && x.reviewed_at) ? fmtKst(x.reviewed_at) : "-";
    }
    qs("#wdPickHint").textContent = x
      ? `ID=${x.id} | ${displayStatus(x)} | ${short(x.address)} → ${short(x.to_address)}`
      : "목록에서 요청을 선택하세요.";
    const reasonEl = qs("#wdRejectReason");
    if (reasonEl) reasonEl.value = reason || "";
    syncActionButtons();
  };

  // (2026-05-21 v716) token-withdrawals 와 동일한 row UI — 상태 chip + 자산 +
  //   각 행 시간 column 에 인라인 액션 버튼 (선택 전송 / 출금 반려 / 수동 완료).
  //   상태별 chip 색상: pending=amber, processing=blue, done=green, rejected/failed=red.
  const statusChipClass = (r) => {
    const s = String(r?.status || "").trim().toLowerCase();
    if (s === "pending") return "pending";
    if (s === "processing") return "processing";
    if (s === "done") return "done";
    if (s === "rejected" || s === "canceled" || s === "cancelled") return "rejected";
    if (s === "failed") return "failed";
    return "pending";
  };
  const renderRows = (rows) => {
    LAST_ROWS = Array.isArray(rows) ? rows : [];
    const tb = qs("#wdRows");
    if (!tb) return;

    if (!LAST_ROWS.length) {
      tb.innerHTML = '<tr><td colspan="9" class="center muted">내역이 없습니다.</td></tr>';
      pickRender(null);
      return;
    }

    tb.innerHTML = LAST_ROWS.map((r) => {
      const uiStatus = displayStatus(r);
      const reason = rejectReason(r);
      const amountText = fmt(Number(r.amount || 0), 0);
      const feeText = fmt(feeAmount(r), 0);
      const netText = fmt(sendAmount(r), 0);
      const chipCls = statusChipClass(r);
      const canSend = isPendingLike(r);
      const canCancel = isPendingLike(r);
      const canManual = canManualCompleteRow(r);
      const active = Number(PICK?.id) === Number(r.id);
      return `
        <tr class="rowpick${active ? " active" : ""}" data-id="${escapeHtml(r.id)}" tabindex="0">
          <td><div class="row-id"><span class="pick-dot"></span><span>#${escapeHtml(r.id)}</span></div></td>
          <td>
            <span class="tw-status-chip ${chipCls}">${escapeHtml(uiStatus)}</span>
            ${reason ? `<div class="small-note" style="color:#dc2626;margin-top:4px;max-width:160px;overflow-wrap:anywhere">${escapeHtml(reason)}</div>` : ""}
          </td>
          <td><span class="tw-asset-chip">USDT</span></td>
          <td class="small-note mono">${escapeHtml(short(r.address))}</td>
          <td class="small-note mono">${escapeHtml(short(r.to_address))}</td>
          <td class="right mono">${amountText}</td>
          <td class="right mono">${feeText}</td>
          <td class="right mono">${netText}</td>
          <td>
            <div class="tw-time-cell">
              <div class="small-note" style="white-space:nowrap">${escapeHtml(fmtKst(r.created_at))}</div>
              <div class="tw-row-actions">
                <button class="btn small primary" type="button" data-row-send="${escapeHtml(r.id)}" ${canSend ? "" : "disabled"} title="${canSend ? "전송 처리" : "pending 상태에서만 전송 가능"}">선택 전송</button>
                ${canManual ? `<button class="btn small" type="button" data-row-manual="${escapeHtml(r.id)}" style="background:#1976D2;color:#fff" title="Solscan 검증 후 수동 완료">수동 완료</button>` : ""}
                <button class="btn small" type="button" data-row-reject="${escapeHtml(r.id)}" ${canCancel ? "" : "disabled"} style="background:#c62828;color:#fff" title="${canCancel ? "반려 사유 입력 후 최종 반려" : "pending 상태만 반려 가능"}">출금 반려</button>
              </div>
            </div>
          </td>
        </tr>`;
    }).join("");

    // (v716) 인라인 버튼 핸들러 — 행 클릭 이벤트와 충돌 방지 위해 stopPropagation.
    tb.querySelectorAll("[data-row-send]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-row-send");
        const row = findRowById(id);
        if (!row) return;
        selectRow(row);
        await actionSend();
      });
    });
    tb.querySelectorAll("[data-row-reject]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-row-reject");
        const row = findRowById(id);
        if (!row) return;
        selectRow(row);
        await actionReject();
      });
    });
    tb.querySelectorAll("[data-row-manual]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-row-manual");
        const row = findRowById(id);
        if (!row) return;
        selectRow(row);
        await actionManualComplete();
      });
    });
  };

  const findRowById = (id) => LAST_ROWS.find((v) => Number(v.id) === Number(id)) || null;

  const selectRow = (row) => {
    pickRender(row || null);
    renderRows(LAST_ROWS);
  };

  const fetchList = async () => {
    const st = String(qs("#wdStatus")?.value || "pending").trim();
    const q = String(qs("#wdSearch")?.value || "").trim();
    const params = new URLSearchParams();
    if (st && st !== "all") params.set("status", st);
    if (q) params.set("q", q);
    params.set("limit", "100");
    const r = await api(`/api/admin/withdraw/requests?${params.toString()}`, { method: "GET" });
    const rows = Array.isArray(r.rows) ? r.rows : [];
    renderRows(rows);
    selectRow((PICK ? rows.find((v) => Number(v.id) === Number(PICK.id)) : null) || rows[0] || null);
  };

  const requirePick = () => {
    if (!PICK?.id) {
      toast("요청을 선택하세요.", "bad");
      return false;
    }
    return true;
  };

  const requireOtp = () => {
    if (OTP_BYPASSED) return "";
    const o = otpVal();
    if (!/^\d{6}$/.test(o)) {
      toast("관리자 OTP 6자리를 입력하세요.", "bad");
      qs("#wdOtp")?.focus();
      return null;
    }
    return o;
  };

  // ★ 수동 완료 처리 (USDT) — processing 상태 + sig 보유 → Solscan 검증 후 done 처리
  const actionManualComplete = async () => {
    if (!requirePick()) return;
    if (!canManualCompleteRow(PICK)) return toast("processing 상태에서만 수동완료 처리 가능합니다.", "bad");

    const sigSaved = String(PICK?.txid || "").trim();
    const sigPrompt = sigSaved
      ? `\n\n저장된 시그니처: ${sigSaved}\n(이 sig 가 Solscan에서 정상 confirm 됐는지 확인하세요)`
      : "\n\n주의: 저장된 sig 가 없습니다. Solscan 에서 직접 트랜잭션을 찾아 입력하세요.";

    const inputTxid = window.prompt(
      `#${PICK.id} 수동 완료 처리 (USDT 출금)\n\nSolscan 에서 검증한 트랜잭션 시그니처(txid)를 입력하세요.${sigPrompt}\n\n(서버가 체인 RPC 로 한 번 더 검증한 후 완료 처리합니다)`,
      sigSaved
    );
    if (!inputTxid || !inputTxid.trim()) return;
    const txid = inputTxid.trim();

    const ok = window.confirm(
      `시그니처 [${short(txid)}] 로 #${PICK.id} 를 수동 완료 처리합니다.\n\n` +
      `이 작업은 되돌릴 수 없으며, 서버가 체인 RPC 로 txid 의 실재 여부를 검증한 후에만 완료 처리됩니다.\n\n진행하시겠습니까?`
    );
    if (!ok) return;

    const otp = requireOtp();
    if (otp === null) return;

    try {
      openOverlay("체인 RPC 검증 후 수동 완료 처리 중...");
      const r = await api("/api/admin/withdraw/manual-complete", {
        method: "POST",
        body: { request_id: PICK.id, otp, txid },
      });
      const stSel = qs("#wdStatus");
      if (stSel) stSel.value = "done";
      await fetchList();
      toast(`수동 완료: #${r?.request_id || PICK.id} / ${short(r?.txid || txid)}`, "good");
      doneOverlayTx({ request_id: r?.request_id || PICK.id, txid: r?.txid || txid, netAmount: PICK?.amount });
    } catch (e) {
      closeOverlay();
      toast(e.message || "수동완료 실패", "bad");
    }
  };

  const actionSend = async () => {
    if (!requirePick()) return;
    if (!isPendingLike(PICK)) return toast("대기 상태에서만 전송할 수 있습니다.", "bad");
    const otp = requireOtp();
    if (otp === null) return;

    try {
      if (!provider()?.isPhantom) return toast("Phantom 지갑이 필요합니다.", "bad");

      // 서명 전 지갑 주소 일치 검증
      const adminPk = await ensurePhantomConnected();
      checkAdminWalletOrAlert(adminPk.toBase58());

      // (v882) Phantom 팝업이 도메인 trust 미부여로 자산/수량 표시 못 하는
      //   한계 대응 — admin 화면에서 미리 자산/수량/주소를 명확히 보여주고
      //   운영자 확인 후 sign 진행.
      const netAmountPreview = sendAmount(PICK);
      const confirmed = await askSendConfirm({ row: PICK, netAmount: netAmountPreview });
      if (!confirmed) return;

      openOverlay("Solana 지갑에서 서명 후 전송 처리 중입니다...");

      const toPk = new PublicKey(String(PICK.to_address || "").trim());
      const netAmount = netAmountPreview;
      const amtBig = toAmountBigInt(String(netAmount), USDT_DECIMALS);
      if (!(amtBig > 0n)) throw new Error("전송 수량 오류");

      const fromATA = findATA(adminPk, USDT_MINT);
      const toATA = findATA(toPk, USDT_MINT);
      const blockhash = await getLatestBlockhashFromServer();

      const tx = new Transaction({ feePayer: adminPk, recentBlockhash: blockhash });
      tx.add(makeMemoIx(`RWA_ADMIN_WITHDRAW|req:${PICK.id}|to:${toPk.toBase58()}|req_amt:${String(PICK.amount)}|net_amt:${String(netAmount)}`));
      tx.add(createATAIxIdempotent(adminPk, toATA, toPk, USDT_MINT));
      tx.add(makeTransferCheckedIx(fromATA, USDT_MINT, toATA, adminPk, amtBig, USDT_DECIMALS));

      const signed = await provider().signTransaction(tx);
      const signedTxBase64 = u8ToBase64(signed.serialize());
      const body = { request_id: PICK.id, signedTxBase64 };
      if (otp) body.otp = otp;
      const r = await api("/api/admin/withdraw/send", {
        method: "POST",
        body,
      });

      const stSel = qs("#wdStatus");
      if (stSel) stSel.value = "done";
      await fetchList();
      toast("전송 완료", "good");
      doneOverlayTx({ request_id: r.request_id, txid: r.txid, netAmount });
    } catch (e) {
      closeOverlay();
      toast(e.message || "전송 실패", "bad");
    }
  };

  const actionReject = async () => {
    if (!requirePick()) return;
    if (!isPendingLike(PICK)) return toast("대기 상태에서만 반려할 수 있습니다.", "bad");

    const otp = requireOtp();
    if (otp === null) return;

    // (2026-05-21 v715) 새 흐름 — 반려 사유 textarea 를 모달 안으로 이동.
    //   1) 모달 열기 (사유 textarea 초기화)
    //   2) 사용자가 모달 안에서 사유 입력 + '최종 반려' 클릭
    //   3) closeRejectConfirm(true) 가 사유 검증 후 promise resolve
    //   4) 검증 통과 시 reason 읽고 API 호출
    const reasonEl = qs("#wdRejectReason");
    if (reasonEl) reasonEl.value = "";

    const confirmed = await askRejectConfirm({ row: PICK, reason: "" });
    if (!confirmed) return;

    const reason = String(qs("#wdRejectReason")?.value || "").trim();
    if (!reason) {
      toast("반려 사유가 비어있습니다.", "bad");
      return;
    }

    openOverlay("출금 반려 및 환불 처리 중...");
    try {
      const body = { request_id: PICK.id, reason };
      if (otp) body.otp = otp;
      const r = await api("/api/admin/withdraw/reject", {
        method: "POST",
        body,
      });
      const stSel = qs("#wdStatus");
      if (stSel) stSel.value = "rejected";
      await fetchList();
      toast("출금 반려 완료", "good");
      doneOverlayText(`출금 반려 완료\nrequest_id=${r.request_id}\n환불=${fmt(Number(r.refund_amount || 0), 6)} USDT\n사유=${reason}\n확인을 누르면 종료됩니다.`);
    } catch (e) {
      closeOverlay();
      toast(e.message || "반려 실패", "bad");
    }
  };

  // (2026-05-21 v717) 페이지 진입 시 자동 heal — 누락된 원본 wallet_tx 복구.
  //   admin 에는 보이는데 user history 에는 안 보이는 케이스 자동 해결.
  const runRuntimeHeal = async () => {
    try {
      const r = await api("/api/admin/withdraw/runtime", { method: "GET" });
      const h = r?.heal_diag;
      if (!h) return;
      console.log("%c[withdraw origin-wtx-heal v717] 결과", "color:#7B1FA2;font-weight:bold", h);
      console.log("  scanned (withdraw_requests 행 수): " + h.scanned);
      console.log("  inserted (신규 wallet_tx 복구): " + h.inserted);
      console.log("  skipped_existing (이미 wallet_tx 존재): " + h.skipped_existing);
      console.log("  skipped_no_amount (amount=0 등 무효): " + h.skipped_no_amount);
      if (Array.isArray(h.details) && h.details.length) {
        console.log("  복구 상세:", h.details);
      }
      if (Array.isArray(h.errors) && h.errors.length) {
        console.warn("%c[withdraw heal v717] errors (" + h.errors.length + ")", "color:#E70014;font-weight:bold");
        h.errors.forEach((m, i) => console.warn("  " + (i + 1) + ". " + m));
      }
    } catch (e) {
      console.warn("[withdraw heal v717] failed:", e?.message || e);
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("withdrawals");
    if (!me) return;

    // 자동 heal 먼저 (목록 fetch 전)
    await runRuntimeHeal();

    pickRender(null);

    qs("#admWalletBtn")?.addEventListener("click", async () => {
      try {
        const connected = !!(provider()?.isPhantom && provider()?.publicKey);
        if (!connected) await connectPhantom();
        else await disconnectPhantom();
        toast("지갑 상태 갱신", "good");
      } catch (e) {
        toast(e.message || "지갑 연결 실패", "bad");
      }
    });

    qs("#wdRefreshBtn")?.addEventListener("click", fetchList);
    qs("#wdStatus")?.addEventListener("change", fetchList);
    qs("#wdSearch")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fetchList();
    });

    qs("#wdRows")?.addEventListener("click", (e) => {
      const tr = e.target.closest?.("tr.rowpick[data-id]");
      if (!tr) return;
      selectRow(findRowById(tr.getAttribute("data-id")));
    });
    qs("#wdRows")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const tr = e.target.closest?.("tr.rowpick[data-id]");
      if (!tr) return;
      e.preventDefault();
      selectRow(findRowById(tr.getAttribute("data-id")));
    });

    qs("#wdSendBtn")?.addEventListener("click", actionSend);
    qs("#wdRejectBtn")?.addEventListener("click", actionReject);
    qs("#wdManualBtn")?.addEventListener("click", actionManualComplete);
    qs("#wdRejectConfirmCancel")?.addEventListener("click", () => closeRejectConfirm(false));
    qs("#wdRejectConfirmOk")?.addEventListener("click", () => closeRejectConfirm(true));
    qs("#wdRejectConfirm .confirm-overlay-backdrop")?.addEventListener("click", () => closeRejectConfirm(false));

    // (v882) 전송 사전 확인 모달 이벤트 바인딩.
    qs("#wdSendConfirmCancel")?.addEventListener("click", () => closeSendConfirm(false));
    qs("#wdSendConfirmOk")?.addEventListener("click", () => closeSendConfirm(true));
    qs("#wdSendConfirm .confirm-overlay-backdrop")?.addEventListener("click", () => closeSendConfirm(false));

    try { const ov = qs("#txOverlay"); if (ov) ov.inert = true; } catch {}
    try { const ov = qs("#wdRejectConfirm"); if (ov) ov.inert = true; } catch {}
    await loadSecurityConfig();
    setWalletUI();
    syncActionButtons();
    await fetchList();
  });
})();
