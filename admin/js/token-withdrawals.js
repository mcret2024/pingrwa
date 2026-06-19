(() => {
  "use strict";

  const { qs, qsa, toast, api, bootAdminPage } = window.AdminCore;
  const { PublicKey, Transaction, SystemProgram, TransactionInstruction } = solanaWeb3;

  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
  const SYSVAR_RENT_PUBKEY = new PublicKey("SysvarRent111111111111111111111111111111111");

  let requests = [];
  let selectedId = null;
  let runtime = {
    network: "devnet",
    admin_wallet_address: "",
    admin_wallet_error: "",
    same_wallet_noop_enabled: false,
    bypass_otp: false,
  };

  const provider = () => {
    // 재발 방지: 다른 확장프로그램이 window.solana 를 선점해도 Phantom을 최우선으로 사용한다.
    const phantom = window.phantom?.solana;
    if (phantom?.isPhantom) return phantom;
    const legacy = window.solana;
    if (legacy?.isPhantom) return legacy;
    return null;
  };

  const esc = (s) => String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const short = (s) => {
    const x = String(s || "").trim();
    if (!x) return "-";
    return x.length > 18 ? `${x.slice(0, 8)}...${x.slice(-6)}` : x;
  };
  // (2026-05-21 v696) 운영자: '신청자 주소 앞5,콤마2개,뒤5'.
  //   table 컬럼 폭 절약용 짧은 포맷. 'xxxxx,,xxxxx' (12자).
  const shortAddr5 = (s) => {
    const x = String(s || "").trim();
    if (!x) return "-";
    return x.length > 12 ? `${x.slice(0, 5)},,${x.slice(-5)}` : x;
  };

  const fmt = (n, d = 6) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return x.toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: d });
  };

  const toDateUtc = (v) => {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return new Date(`${s.replace(" ", "T")}Z`);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return new Date(`${s}Z`);
    return new Date(s);
  };

  const fmtKst = (v) => {
    const d = toDateUtc(v);
    if (!d || Number.isNaN(d.getTime())) return v ? String(v) : "-";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  };

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

  const resolveFeeAmount = (row) => {
    const direct = Number(row?.fee_amount);
    if (Number.isFinite(direct) && direct > 0) return direct;
    return parseMemoNum(row?.memo, ["fee_amount", "fee"]);
  };

  const resolveFeeAsset = (row) => {
    const direct = String(row?.fee_asset || "").trim();
    if (direct) return direct;
    const memoAsset = parseMemoText(row?.memo, ["fee_asset"]);
    if (memoAsset) return memoAsset;
    const mode = String(row?.fee_mode || parseMemoText(row?.memo, ["fee_mode"]) || "").trim();
    return mode === "fixed_usdt" ? "USDT" : String(row?.asset_id || "TOKEN");
  };

  const resolveNetAmount = (row) => {
    const direct = Number(row?.net_amount);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const memoNet = parseMemoNum(row?.memo, ["net_amount", "net_amt", "net"]);
    if (memoNet > 0) return memoNet;
    const amount = Number(row?.amount_token || 0);
    const fee = resolveFeeAmount(row);
    return String(resolveFeeAsset(row)).toUpperCase() === "USDT" ? amount : Math.max(0, amount - fee);
  };

  const resolveMint = (row) => String(row?.token_mint_address || "").trim();
  const resolveLastError = (row) => String(row?.last_error || row?.reject_reason || parseMemoText(row?.memo, ["send_error"]) || "").trim();
  const resolveSelected = () => requests.find((row) => Number(row?.id || 0) === Number(selectedId || 0)) || null;
  const isPendingLike = (row) => ["pending", "processing"].includes(String(row?.status || "").trim().toLowerCase());
  const sameWalletRow = (row) => {
    const wallet = String(runtime.admin_wallet_address || "").trim();
    return !!wallet && String(row?.to_address || "").trim() === wallet;
  };

  const statusLabel = (row) => {
    const s = String(row?.status || "").trim().toLowerCase();
    if (s === "pending") return "대기";
    if (s === "processing") return "처리중";
    if (s === "done") return "완료";
    if (s === "canceled") return "취소";
    if (s === "failed") return "실패";
    return row?.status || "-";
  };

  const statusClass = (row) => {
    const s = String(row?.status || "").trim().toLowerCase();
    return ["pending", "processing", "done", "canceled", "failed"].includes(s) ? s : "pending";
  };

  const isSolanaAddressLike = (value) => {
    try { new PublicKey(String(value || "").trim()); return true; }
    catch { return false; }
  };

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
  const toAmountBigInt = (amountRaw, decimals) => {
    const s = String(amountRaw ?? "0").trim();
    const [i, f = ""] = s.split(".");
    const intPart = (i || "0").replace(/\D/g, "") || "0";
    const dec = Math.max(0, Math.min(255, Number(decimals) || 0));
    const fracPart = (f || "").replace(/\D/g, "").slice(0, dec).padEnd(dec, "0");
    return BigInt(intPart) * (10n ** BigInt(dec)) + BigInt(fracPart || "0");
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

  const makeMemoIx = (text) => new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: u8FromText(String(text || "")).slice(0, 180),
  });

  const getLatestBlockhashFromServer = async () => {
    const r = await api("/api/public/solana/blockhash", { method: "GET" });
    const bh = String(r?.blockhash || "").trim();
    if (!bh) throw new Error("blockhash 조회 실패");
    return bh;
  };

  const buildExplorerTxUrl = (txid) => {
    const sig = encodeURIComponent(String(txid || "").trim());
    if (!sig) return "#";
    return runtime.network === "mainnet-beta"
      ? `https://solscan.io/tx/${sig}`
      : `https://solscan.io/tx/${sig}?cluster=${encodeURIComponent(runtime.network || "devnet")}`;
  };

  const setNetworkChip = () => {
    const chip = qs("#twNetworkChip");
    if (!chip) return;
    const network = String(runtime.network || "devnet").trim() || "devnet";
    chip.textContent = network === "mainnet-beta" ? "메인넷 전송" : `${network.toUpperCase()} 전송`;
  };

  const renderWalletInfo = () => {
    // (2026-05-21 v699) 운영자 정책: '설정 출금지갑' 개념은 오래전 제거됨.
    //   #twConfigWalletAddr 노출 + admin_wallet_address 와의 비교 안내 모두
    //   불필요. note 에는 Phantom 연결 상태 / 오류만 표시.
    const walletEl = qs("#twConfigWalletAddr");
    if (walletEl) walletEl.textContent = "-";

    // (2026-05-21 v725) 운영자 요청 — 'Phantom 연결 안내 / 연결됨 안내' 문구
    //   모두 제거. note 는 display:none 으로 처리됨. 에러 발생 시에만 노출.
    const note = qs("#twWalletNote");
    if (!note) return;
    note.classList.remove("good", "bad");
    note.style.display = "none";

    if (runtime.admin_wallet_error) {
      note.textContent = runtime.admin_wallet_error;
      note.classList.add("bad");
      note.style.display = "block";
      return;
    }
    // 정상 케이스: note 비표시 유지.
    note.textContent = "";
  };

  const setWalletUI = () => {
    const btn = qs("#admWalletBtn");
    const addr = qs("#admWalletAddr");
    const p = provider();
    const connected = !!(p?.isPhantom && p?.publicKey);
    if (connected) {
      const wallet = p.publicKey.toBase58();
      if (btn) {
        btn.textContent = "지갑 해제";
        btn.classList.add("danger");
      }
      if (addr) addr.textContent = wallet;
    } else {
      if (btn) {
        btn.textContent = "팬텀 연결";
        btn.classList.remove("danger");
      }
      if (addr) addr.textContent = "-";
    }
    renderWalletInfo();
    renderList();
    renderSelected();
  };

  const connectPhantom = async () => {
    const p = provider();
    if (!p?.isPhantom) throw new Error("Phantom 지갑이 필요합니다.");
    await p.connect();
    setWalletUI();
  };

  const disconnectPhantom = async () => {
    const p = provider();
    if (p?.isPhantom) {
      try { await p.disconnect(); } catch {}
    }
    setWalletUI();
  };

  const ensureConnectedAdminWallet = async () => {
    const p = provider();
    if (!p?.isPhantom) throw new Error("Phantom 확장이 필요합니다.");
    // 재발 방지: 선택 전송 클릭만으로 자동 연결/자동 처리되지 않게 한다.
    // 관리자는 상단의 '팬텀 연결' 버튼으로 먼저 연결해야 한다.
    if (!p.publicKey) throw new Error("상단의 '팬텀 연결' 버튼으로 관리자 Phantom 지갑을 먼저 연결하세요.");
    // (2026-05-08) 사장님 정책: 출금 송금에 사용하는 지갑은 설정 출금지갑과
    //   일치하지 않아도 OK. 잔액이 있는 어떤 Phantom 지갑이든 사용 가능.
    //   (잔액 부족 시 Solana RPC 가 자체적으로 거절한다.)
    return p.publicKey;
  };

  const requestAdminOtp = async () => {
    if (runtime.bypass_otp) return "000000";
    const raw = window.prompt("관리자 OTP 6자리를 입력하세요.", "") ?? "";
    const otp = String(raw).replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(otp)) throw new Error("OTP 6자리를 입력하세요.");
    return otp;
  };

  // ★ 이중출금 방지: 'pending' 만 전송 허용 ('processing' 은 잠금 상태)
  const isPendingOnly = (row) => String(row?.status || "").trim().toLowerCase() === "pending";
  const isProcessingRow = (row) => String(row?.status || "").trim().toLowerCase() === "processing";

  const canSendRow = (row) => {
    if (!row || !isPendingOnly(row)) return false;  // ★ pending 전용
    if (runtime.admin_wallet_error) return false;
    const netAmount = resolveNetAmount(row);
    if (!(netAmount > 0)) return false;
    // (2026-05-21 v692) 운영자 정책: 자기-전송 허용. 수령 주소 == 관리자
    //   출금지갑 이어도 전송 진행 가능. 이전 sameWalletRow 차단 제거.
    const mint = resolveMint(row);
    if (!mint || !isSolanaAddressLike(mint)) return false;
    const p = provider();
    if (!p?.isPhantom || !p.publicKey) return false;
    // (2026-05-08) 사장님 정책: 송금 시 어떤 지갑이든 OK. 연결 지갑이
    //   설정 출금지갑과 일치하지 않아도 send 버튼은 활성.
    return true;
  };

  // (2026-05-20 v682) 운영자: '전송 버튼이 비활성화 되어 진행 불가.'
  //   비활성 사유를 사람이 읽을 수 있는 메시지로 반환하여 button title
  //   (hover tooltip) 에 표시. 자가-진단 용도.
  const sendDisabledReason = (row) => {
    if (!row) return "행을 선택하세요.";
    if (!isPendingOnly(row)) return `status='${row?.status || '-'}' — pending 만 전송 가능.`;
    if (runtime.admin_wallet_error) return `관리자 지갑 오류: ${runtime.admin_wallet_error}`;
    const netAmount = resolveNetAmount(row);
    if (!(netAmount > 0)) return "전송 수량이 0 이하입니다.";
    // (v692) sameWalletRow 자기-전송 차단 사유 제거 (canSendRow 동일)
    const mint = resolveMint(row);
    if (!mint) return `토큰 민트 주소 미등록 (asset='${row?.asset_id || ''}'). → admin/assets.html 에서 ${row?.asset_id || '자산'} 의 '토큰 민트 주소' 등록 필요.`;
    if (!isSolanaAddressLike(mint)) return `토큰 민트 주소 형식 오류 (mint='${mint}'). Solana base58 44자가 아님.`;
    const p = provider();
    if (!p?.isPhantom) return "Phantom 지갑이 감지되지 않음 — 브라우저 확장 설치 필요.";
    if (!p.publicKey) return "Phantom 지갑이 연결되지 않음 — 상단 '팬텀 연결' 버튼 클릭.";
    return "";
  };

  // 취소도 'pending' 전용 (processing 은 체인 전송 가능성 → manual-complete 로 검증 후 처리)
  const canCancelRow = (row) => isPendingOnly(row);

  // ★ 수동완료 가능 = 'processing' (체인 전송됐을 가능성, 관리자가 Solscan 에서 검증 후)
  const canManualCompleteRow = (row) => isProcessingRow(row);

  const renderTxidCell = (row) => {
    const txid = String(row?.txid || "").trim();
    if (!txid) return "-";
    return `<a href="${buildExplorerTxUrl(txid)}" target="_blank" rel="noopener" class="mono" style="color:var(--link);text-decoration:none">${esc(short(txid))}</a>`;
  };

  const renderList = () => {
    const tbody = qs("#requestsTbody");
    if (!tbody) return;

    // (2026-05-21 v690) 운영자: 'F12 에서 선택 전송 비활성 사유 표출.'
    //   각 행마다 canSend 결과 + 사유를 console.table 로 출력.
    //   pending 행이라도 (status='pending') Phantom 미연결 / 동일 지갑 등의
    //   조건으로 disabled 될 수 있음. 어느 조건 미충족인지 한눈에 진단.
    try {
      const diag = requests.map((row) => ({
        id: row?.id,
        status: row?.status,
        asset: row?.asset_id,
        to_addr: String(row?.to_address || '').slice(0, 12) + '...',
        amount: row?.amount_token,
        net: resolveNetAmount(row),
        canSend: canSendRow(row),
        disabled_reason: canSendRow(row) ? '' : sendDisabledReason(row),
      }));
      console.log("%c[token-withdraw renderList] " + diag.length + " 행 · canSend 진단",
        "color:#0065CD;font-weight:bold");
      console.table(diag);
      const blockedPending = diag.filter(d => d.status === 'pending' && !d.canSend);
      if (blockedPending.length) {
        console.warn("%c[token-withdraw] PENDING 인데 전송 불가 (" + blockedPending.length + " 행) — 사유:", "color:#E70014;font-weight:bold");
        blockedPending.forEach((d) => console.warn("  #" + d.id + " → " + d.disabled_reason));
      }
    } catch (diagErr) {
      console.warn("[token-withdraw renderList] diag failed:", diagErr?.message || diagErr);
    }

    tbody.innerHTML = requests.map((row) => {
      const active = Number(row?.id || 0) === Number(selectedId || 0);
      const amount = Number(row?.amount_token || 0);
      const net = resolveNetAmount(row);
      const fee = resolveFeeAmount(row);
      const feeAsset = resolveFeeAsset(row);
      const canSend = canSendRow(row);
      const canCancel = canCancelRow(row);
      const canManualComplete = canManualCompleteRow(row);
      // (2026-05-21 v696) 신청자 주소 == 수령 주소 동일 (in-platform 출금).
      //   '수령 주소' 컬럼 제거 → 폭 절약. 신청자 컬럼만 표시, 짧은 포맷 (앞5,,뒤5).
      return `
        <tr data-id="${row.id}" class="token-request-row ${esc(String(row?.status || ""))} ${active ? "active" : ""}" style="cursor:pointer">
          <td><div class="row-id"><span class="pick-dot"></span><span>#${row.id}</span></div></td>
          <td><span class="tw-status-chip ${esc(statusClass(row))}">${esc(statusLabel(row))}</span></td>
          <td>${esc(String(row?.asset_name || row?.asset_id || "-"))}</td>
          <td class="small-note mono">${esc(shortAddr5(row?.address))}</td>
          <td class="right">${fmt(amount, 1)}</td>
          <td class="right">${fmt(net, 1)}</td>
          <td class="right">${fee > 0 ? `${fmt(fee, String(feeAsset).toUpperCase() === "USDT" ? 6 : 1)} ${esc(feeAsset)}` : "-"}</td>
          <td class="small-note mono">${esc(short(resolveMint(row) || "-"))}</td>
          <td>${renderTxidCell(row)}</td>
          <td>
            <div class="tw-time-cell">
              <div class="small-note">${esc(fmtKst(row?.created_at))}</div>
              <div class="tw-row-actions">
                <button class="btn small primary" type="button" data-row-send="${row.id}" ${canSend ? "" : "disabled"} title="${esc(canSend ? "전송 처리" : sendDisabledReason(row))}">선택 전송</button>
                ${canManualComplete ? `<button class="btn small" type="button" data-row-manual="${row.id}" style="background:#1976D2;color:#fff" title="Solscan 에서 sig 확인 후 수동 완료 처리">수동 완료</button>` : ""}
                <!-- (2026-05-21 v694) 행 우측 '출금 반려' 버튼 — 클릭 시 모달 open. -->
                <button class="btn small" type="button" data-row-reject="${row.id}" ${canCancel ? "" : "disabled"} style="background:#c62828;color:#fff" title="${esc(canCancel ? "반려 사유 입력 후 최종 반려" : "pending 상태만 반려 가능")}">출금 반려</button>
              </div>
            </div>
          </td>
        </tr>`;
    }).join("") || '<tr><td colspan="11" class="center muted">요청 없음</td></tr>';

    tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
      tr.addEventListener("click", () => {
        selectedId = Number(tr.getAttribute("data-id"));
        renderList();
        renderSelected();
      });
    });
    qsa("[data-row-send]", tbody).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute("data-row-send") || 0);
        const row = requests.find((x) => Number(x?.id || 0) === id);
        if (!row) return;
        selectedId = id;
        renderList();
        renderSelected();
        await sendRow(row, btn);
      });
    });
    // (2026-05-20 v681) 인라인 [data-row-cancel] 핸들러 제거됨.
    //   사유 강제 입력을 위해 선택 카드 영역의 #twRejectBtn 으로 단일화.
    // ★ 수동 완료 처리 버튼 (processing 상태에서만 노출)
    qsa("[data-row-manual]", tbody).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute("data-row-manual") || 0);
        const row = requests.find((x) => Number(x?.id || 0) === id);
        if (!row) return;
        selectedId = id;
        renderList();
        renderSelected();
        await manualCompleteRow(row, btn);
      });
    });
  };

  const renderSelected = () => {
    const row = resolveSelected();
    const empty = qs("#twSelectedEmpty");
    const detail = qs("#twSelectedDetail");

    if (!row) {
      if (empty) empty.classList.remove("hidden");
      if (detail) detail.classList.add("hidden");
      return;
    }

    if (empty) empty.classList.add("hidden");
    if (detail) detail.classList.remove("hidden");

    const mint = resolveMint(row);
    const netAmount = resolveNetAmount(row);
    const feeAmount = resolveFeeAmount(row);
    const feeAsset = resolveFeeAsset(row);
    const txid = String(row?.txid || "").trim();
    const lastError = resolveLastError(row);

    const setHtml = (sel, value) => {
      const el = qs(sel);
      if (el) el.innerHTML = value;
    };

    setHtml("#twSelRequest", `#${row.id} · ${esc(fmtKst(row?.created_at))}`);
    setHtml("#twSelAsset", `${esc(String(row?.asset_name || row?.asset_id || "-"))}<br><span class="small-note mono">${esc(short(row?.address))}</span>`);
    setHtml("#twSelTo", esc(String(row?.to_address || "-")));
    setHtml("#twSelAmount", `${fmt(row?.amount_token, 1)} ${esc(String(row?.asset_id || "TOKEN"))}`);
    setHtml("#twSelNet", `${fmt(netAmount, 1)} ${esc(String(row?.asset_id || "TOKEN"))}`);
    setHtml("#twSelFee", feeAmount > 0 ? `${fmt(feeAmount, String(feeAsset).toUpperCase() === "USDT" ? 6 : 1)} ${esc(feeAsset)}` : "-");
    setHtml("#twSelMint", esc(mint || "-"));
    setHtml("#twSelStatus", esc(statusLabel(row)));
    setHtml("#twSelTxid", txid ? `<a href="${buildExplorerTxUrl(txid)}" target="_blank" rel="noopener" class="mono" style="color:var(--link);text-decoration:none">${esc(txid)}</a>` : "-");

    // (2026-05-21 v741) 신청 시간 + 전송 시간 카드.
    //   - 신청 시간 = row.created_at (유저 출금 신청 시점)
    //   - 전송 시간 = row.reviewed_at — 단, status='done' 일 때만 표시.
    //     reject/cancel 시에도 reviewed_at 이 set 되므로 status 체크 필요.
    const rowStatusLower = String(row?.status || '').trim().toLowerCase();
    const isDone = ['done', 'sent', 'completed'].includes(rowStatusLower);
    setHtml("#twSelCreatedAt", row?.created_at ? esc(fmtKst(row.created_at)) : "-");
    setHtml("#twSelSentAt", (isDone && row?.reviewed_at) ? esc(fmtKst(row.reviewed_at)) : "-");

    let hint = "행 안쪽의 '선택 전송' 버튼으로 바로 처리할 수 있습니다.";
    if (lastError) {
      hint = `마지막 실패 사유: ${lastError}`;
    }
    if (runtime.admin_wallet_error) {
      hint = runtime.admin_wallet_error;
    } else if (!isPendingLike(row)) {
      hint = `현재 상태는 ${statusLabel(row)}이며 다시 전송할 수 없습니다.`;
    } else if (!(netAmount > 0)) {
      hint = "전송 수량이 0 이하라 전송할 수 없습니다.";
    // (v692) sameWalletRow 차단 메시지 제거 — 운영자: '자기-전송 허용'.
    //   else if (sameWalletRow(row)) { ... }  ← 제거됨
    } else if (!mint) {
      hint = "저장된 토큰 민트 주소가 없어 전송할 수 없습니다. 자산관리에서 민트 주소를 먼저 저장하세요.";
    } else if (!isSolanaAddressLike(mint)) {
      hint = "저장된 토큰 민트 주소 형식이 올바르지 않습니다.";
    } else if (!(provider()?.isPhantom)) {
      hint = "이 브라우저에서는 Phantom 확장이 필요합니다.";
    } else if (!provider()?.publicKey) {
      hint = "Phantom 지갑을 연결하면 바로 전송할 수 있습니다.";
    } else {
      // (v699) '설정 출금지갑' 비교 안내 제거 — 어차피 의미 없음.
      // (2026-05-21 v720) 운영자 요청 — '현재 서버 전송 네트워크 devnet ...'
      //   안내 문구도 제거. hint 비워서 미표시.
      hint = "";
    }

    const hintEl = qs("#twSelectedHint");
    if (hintEl) hintEl.textContent = hint;
  };

  const loadRuntime = async () => {
    const r = await api("/api/admin/token-withdraw/runtime", { method: "GET" });
    runtime = {
      network: String(r?.network || "devnet").trim() || "devnet",
      admin_wallet_address: String(r?.admin_wallet_address || "").trim(),
      admin_wallet_error: String(r?.admin_wallet_error || "").trim(),
      same_wallet_noop_enabled: false,
      bypass_otp: !!r?.bypass_otp,
    };
    // (2026-05-20 v685/v686) sync_diag 진단 출력.
    if (r?.sync_diag) {
      const d = r.sync_diag;
      console.log("%c[token-withdraw sync-stale] 결과", "color:#0065CD;font-weight:bold", d);
      console.log("  has_wallet_tx_id_col: " + d.has_wallet_tx_id_col);
      console.log("  Phase 1a (canceled → '실패'): " + d.phase1_linked_updated + " 행 updated");
      console.log("  Phase 1b (done → '출금완료' + txid): " + (d.phase1_done_synced || 0) + " 행 updated");
      console.log("  Phase 2 (fallback by address+asset+amount):");
      console.log("    orphans 대상: " + d.phase2_orphans_found);
      console.log("    정확 1건 매칭 → UPDATE 수행: " + d.phase2_matched_one);
      console.log("    다중 매칭 (위험 회피 skip): " + d.phase2_matched_multi_skipped);
      console.log("    매칭 0건 (수동 정리 필요): " + d.phase2_no_match);
      if (Array.isArray(d.phase2_updates) && d.phase2_updates.length) {
        console.log("    Phase 2 상세:", d.phase2_updates);
      }
      // (v686) errors 배열 각 항목을 개별 라인으로 명시 출력 — 한눈에 확인 가능.
      if (Array.isArray(d.errors) && d.errors.length) {
        console.warn("%c[token-withdraw sync-stale] errors (" + d.errors.length + ")", "color:#E70014;font-weight:bold");
        d.errors.forEach((msg, i) => console.warn("  " + (i + 1) + ". " + msg));
      }
    }
    // (2026-05-21 v703) v701 의 잘못된 보정 자동 되돌림 결과.
    //   v701 의 correctDoubleRefunds 가 cancel marker 와 heal marker 를
    //   구분 못해 정상 cancel 환불까지 'double refund' 로 오판 → 추가 차감.
    //   사례: 9 STO → 1 STO 출금/반려 2회 → 7 STO (정상 9). v703 가 이런
    //   false positive 만 식별 (reviewed_at >= v701 deploy 시점) 후 차감
    //   되돌림. v701 deploy 이전의 진짜 victim 은 보정 유지.
    if (r?.rollback_diag) {
      const rb = r.rollback_diag;
      console.log("%c[token-withdraw rollback v703] 결과", "color:#00897B;font-weight:bold", rb);
      console.log("  scanned (v701 보정 마커 있는 행): " + rb.scanned);
      console.log("  rolled_back (이번 호출에서 되돌림): " + rb.rolled_back);
      console.log("  skipped_already_undone (이미 v703 마커): " + rb.skipped_already_undone);
      console.log("  skipped_pre_v701_real_victim (진짜 피해자 → 보정 유지): " + rb.skipped_pre_v701_real_victim);
      if (Array.isArray(rb.details) && rb.details.length) {
        console.log("  되돌림 상세:", rb.details);
      }
      if (Array.isArray(rb.errors) && rb.errors.length) {
        console.warn("%c[token-withdraw rollback v703] errors (" + rb.errors.length + ")", "color:#E70014;font-weight:bold");
        rb.errors.forEach((msg, i) => console.warn("  " + (i + 1) + ". " + msg));
      }
    }
    // (v689) holdings 환불 미반영 자동 복구 결과
    if (r?.heal_diag) {
      const h = r.heal_diag;
      console.log("%c[token-withdraw heal-refunds] 결과", "color:#2E7D32;font-weight:bold", h);
      console.log("  scanned (canceled + 별칭 asset_id): " + h.scanned);
      console.log("  refunded (이번 호출에서 정정됨): " + h.refunded);
      console.log("  skipped (이미 fixed marker): " + h.skipped_marked);
      if (Array.isArray(h.details) && h.details.length) {
        console.log("  refund 상세:", h.details);
      }
      if (Array.isArray(h.errors) && h.errors.length) {
        console.warn("%c[token-withdraw heal-refunds] errors (" + h.errors.length + ")", "color:#E70014;font-weight:bold");
        h.errors.forEach((msg, i) => console.warn("  " + (i + 1) + ". " + msg));
      }
    }
    // (v706/v707) 누락된 refund wallet_tx 행 복구 — history 1:1 페어링 보장
    if (r?.refund_wtx_heal_diag) {
      const w = r.refund_wtx_heal_diag;
      console.log("%c[token-withdraw refund-wtx-heal v707] 결과", "color:#7B1FA2;font-weight:bold", w);
      console.log("  -- Phase 1 (canceled twr 기반) --");
      console.log("  scanned (canceled twr 행 수): " + w.scanned);
      console.log("  inserted_token (신규 토큰 환불 행): " + w.inserted_token);
      console.log("  inserted_fee (신규 USDT 수수료 환불 행): " + w.inserted_fee);
      console.log("  skipped_existing (이미 있는 토큰 환불 행): " + w.skipped_existing);
      console.log("  -- Phase 2 (FAILED wallet_tx 기반 audit fill) --");
      console.log("  phase2_scanned (FAILED 출금 행 수): " + (w.phase2_scanned || 0));
      console.log("  phase2_matched_existing (이미 환불 행 매칭): " + (w.phase2_matched_existing || 0));
      console.log("  phase2_inserted (audit fill INSERT): " + (w.phase2_inserted || 0));
      if (w.asset_dist_failed) {
        console.log("  FAILED asset 값 분포:", w.asset_dist_failed);
      }
      if (w.asset_dist_refund) {
        console.log("  REFUND asset 값 분포:", w.asset_dist_refund);
      }
      if (Array.isArray(w.details) && w.details.length) {
        console.log("  복구 상세:", w.details);
      }
      if (Array.isArray(w.errors) && w.errors.length) {
        console.warn("%c[token-withdraw refund-wtx-heal v707] errors (" + w.errors.length + ")", "color:#E70014;font-weight:bold");
        w.errors.forEach((msg, i) => console.warn("  " + (i + 1) + ". " + msg));
      }
    }
    setNetworkChip();
    renderWalletInfo();
    renderSelected();
  };

  const loadRequests = async () => {
    await loadRuntime();
    const status = qs("#statusFilter")?.value || "";
    const q = qs("#searchInput")?.value || "";
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const r = await api(`/api/admin/token-withdraw/requests?${params.toString()}`, { method: "GET" });
    requests = r?.rows || [];
    if (!resolveSelected()) selectedId = requests[0]?.id ? Number(requests[0].id) : null;
    renderList();
    renderSelected();
  };

  const fetchPrepare = async (requestId) => api(`/api/admin/token-withdraw/prepare?request_id=${encodeURIComponent(String(requestId || 0))}`, { method: "GET" });

  const buildSignedTransferPayload = async (row, prep) => {
    const p = provider();
    const adminPk = await ensureConnectedAdminWallet();
    const fromAddress = adminPk.toBase58();

    // (2026-05-08) 사장님 정책: 출금 송금 지갑이 설정 출금지갑과 일치하지 않아도
    //   송금 진행. 잔액 부족 시 Solana RPC 가 거절하므로 별도 검증 불필요.
    // (2026-05-21 v725) 운영자 정책: 자기-전송 허용. 동일 wallet/ATA 차단 제거.
    //   Solana 가 self-transfer 를 어떻게 처리할지는 RPC 에 맡김 (대부분 성공
    //   하거나 0 amount no-op). 운영 흐름 자체를 막지 않도록 변경.

    const mintPk = new PublicKey(String(prep?.token_mint_address || "").trim());
    const toOwner = new PublicKey(String(prep?.to_address || "").trim());
    const fromATA = findATA(adminPk, mintPk);
    const toATA = findATA(toOwner, mintPk);

    const amountBig = toAmountBigInt(prep?.net_amount, prep?.token_decimals);
    if (amountBig <= 0n) throw new Error("전송 수량이 0 이하입니다.");

    const tx = new Transaction();
    tx.feePayer = adminPk;
    tx.recentBlockhash = await getLatestBlockhashFromServer();
    tx.add(createATAIxIdempotent(adminPk, toATA, toOwner, mintPk));
    tx.add(makeTransferCheckedIx(fromATA, mintPk, toATA, adminPk, amountBig, prep?.token_decimals));
    tx.add(makeMemoIx(`admin_token_withdraw:${row.id}|asset:${row.asset_id}|user:${row.address}|to:${row.to_address}|network:${runtime.network}`));

    const signed = await p.signTransaction(tx);
    return { sameWallet: false, fromAddress, signedTxBase64: u8ToBase64(signed.serialize()) };
  };

  const sendRow = async (row, btn = null) => {
    if (!row) return toast("요청을 선택하세요.", "bad");
    if (!canSendRow(row)) return toast("현재 요청은 전송할 수 없습니다.", "bad");

    const prevText = btn?.textContent || "선택 전송";
    const prevDisabled = btn?.disabled;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "검증 중...";
    }

    try {
      const prep = await fetchPrepare(row.id);
      if (prep?.duplicated) {
        toast("이미 완료된 요청입니다.", "good");
        await loadRequests();
        return;
      }

      if (btn) btn.textContent = "서명 준비 중...";
      const built = await buildSignedTransferPayload(row, prep);

      if (btn) btn.textContent = "OTP 확인 중...";
      const otp = await requestAdminOtp();

      if (btn) btn.textContent = "서버 전송 중...";
      const body = {
        request_id: row.id,
        otp,
        from_address: built.fromAddress,
      };
      body.signedTxBase64 = built.signedTxBase64;

      const r = await api("/api/admin/token-withdraw/send", { method: "POST", body });
      toast(`전송 완료: #${row.id}${r?.txid ? ` / ${short(r.txid)}` : ""}`, "good");
      await loadRequests();
    } catch (e) {
      toast(e.message || "전송 실패", "bad");
    } finally {
      if (btn) {
        btn.disabled = prevDisabled;
        btn.textContent = prevText;
      }
      renderSelected();
    }
  };

  // ★ 수동 완료 처리 (processing 상태 + sig 보유 → Solscan 검증 후)
  const manualCompleteRow = async (row, btn = null) => {
    if (!row) return toast("요청을 선택하세요.", "bad");
    if (!canManualCompleteRow(row)) return toast("현재 요청은 수동완료 처리 대상이 아닙니다.", "bad");

    const sigSaved = String(row?.txid || "").trim();
    const sigPrompt = sigSaved
      ? `\n\n저장된 시그니처: ${sigSaved}\n(이 sig 가 Solscan에서 정상 confirm 됐는지 확인하세요)`
      : "\n\n주의: 이 요청에는 저장된 sig 가 없습니다. 직접 Solscan 에서 사용자 주소로의 트랜잭션을 찾아 입력하세요.";

    const inputTxid = window.prompt(
      `#${row.id} 수동 완료 처리\n\nSolscan 에서 검증한 트랜잭션 시그니처(txid)를 입력하세요.${sigPrompt}\n\n(서버가 체인에서 한 번 더 검증한 후 done 처리합니다)`,
      sigSaved
    );
    if (!inputTxid || !inputTxid.trim()) return;
    const txid = inputTxid.trim();

    const confirmText = window.confirm(
      `시그니처 [${short(txid)}] 로 #${row.id} 를 수동 완료 처리합니다.\n\n` +
      `이 작업은 되돌릴 수 없으며, 서버가 체인 RPC 로 txid 의 실재 여부를 검증한 후에만 완료 처리됩니다.\n\n진행하시겠습니까?`
    );
    if (!confirmText) return;

    const prevText = btn?.textContent || "수동 완료";
    const prevDisabled = btn?.disabled;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "검증 중...";
    }

    try {
      const otp = await requestAdminOtp();
      const r = await api("/api/admin/token-withdraw/manual-complete", {
        method: "POST",
        body: { request_id: row.id, otp, txid },
      });
      toast(`수동 완료: #${row.id} / ${short(r?.txid || txid)}`, "good");
      await loadRequests();
    } catch (e) {
      toast(e.message || "수동완료 실패", "bad");
    } finally {
      if (btn) {
        btn.disabled = prevDisabled;
        btn.textContent = prevText;
      }
      renderSelected();
    }
  };

  const cancelRow = async (row, btn = null) => {
    if (!row) return toast("요청을 선택하세요.", "bad");
    if (!canCancelRow(row)) return toast("현재 요청은 취소할 수 없습니다.", "bad");

    const ok = window.confirm(`#${row.id} 요청을 취소하시겠습니까?\n신청 수량은 사용자 보유량으로 복구됩니다.`);
    if (!ok) return;

    const prevText = btn?.textContent || "취소";
    const prevDisabled = btn?.disabled;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "취소 중...";
    }

    try {
      const otp = await requestAdminOtp();
      await api("/api/admin/token-withdraw/cancel", {
        method: "POST",
        body: { request_id: row.id, otp, reason: "관리자 취소" },
      });
      toast("취소 완료", "good");
      await loadRequests();
    } catch (e) {
      toast(e.message || "취소 실패", "bad");
    } finally {
      if (btn) {
        btn.disabled = prevDisabled;
        btn.textContent = prevText;
      }
      renderSelected();
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("token-withdrawals");
    if (!me) return;
    window.AdminHeader?.loadHeader();

    setWalletUI();
    setNetworkChip();
    try {
      provider()?.on?.("connect", setWalletUI);
      provider()?.on?.("disconnect", setWalletUI);
      provider()?.on?.("accountChanged", setWalletUI);
    } catch {}

    qs("#statusFilter")?.addEventListener("change", loadRequests);
    qs("#searchInput")?.addEventListener("input", loadRequests);
    qs("#refreshBtn")?.addEventListener("click", async () => {
      await loadRequests();
      toast("새로고침 완료", "good");
    });

    // (2026-05-21 v694) 출금 반려 플로우 — 인라인 [data-row-reject] 버튼 →
    //   모달 (사유 입력 + 최종 반려). 이전 v681 의 선택카드 영역 사유 입력은
    //   제거되고 모달 내부로 이동. row 단위 처리로 더 명확.
    const confirmOv = qs("#twRejectConfirm");
    const confirmSummary = qs("#twRejectConfirmSummary");
    const confirmCancel = qs("#twRejectConfirmCancel");
    const confirmOk = qs("#twRejectConfirmOk");
    // 현재 모달이 열려있는 row id — confirmOk 가 사용
    let pendingRejectId = null;
    const getReasonEl = () => qs("#twRejectReason");
    const openConfirm = () => {
      if (!confirmOv) return;
      confirmOv.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      // 모달 open 시 사유 input 포커스
      setTimeout(() => { getReasonEl()?.focus(); }, 50);
    };
    const closeConfirm = () => {
      if (!confirmOv) return;
      confirmOv.classList.add("hidden");
      document.body.style.overflow = "";
      pendingRejectId = null;
      const r = getReasonEl();
      if (r) r.value = "";
    };
    // 인라인 [data-row-reject] 버튼 — renderList 가 매 갱신마다 새로 그림.
    //   tbody event delegation 으로 한 번만 바인딩.
    const requestsTbody = qs("#requestsTbody");
    requestsTbody?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-row-reject]");
      if (!btn) return;
      e.stopPropagation();
      const id = Number(btn.getAttribute("data-row-reject") || 0);
      const row = requests.find((x) => Number(x?.id || 0) === id);
      if (!row) return;
      if (!canCancelRow(row)) return toast("현재 요청은 반려할 수 없습니다 (pending 상태만 가능).", "bad");
      pendingRejectId = id;
      // 모달 summary 채우기
      if (confirmSummary) {
        const amt = Number(row.amount_token || 0);
        const feeVal = Number(row.fee_amount || 0);
        const feeAst = String(row.fee_asset || "USDT");
        const lines = [
          `요청 ID: #${row.id}`,
          `자산: ${row.asset_id || "-"}`,
          `신청자: ${row.address || "-"}`,
          `수령 주소: ${row.to_address || "-"}`,
          `신청 수량: ${fmt(amt, 6)} ${row.asset_id || ""}`,
          feeVal > 0 ? `수수료 환불: ${fmt(feeVal, 6)} ${feeAst}` : null,
        ].filter(Boolean);
        confirmSummary.textContent = lines.join("\n");
      }
      openConfirm();
    });
    confirmCancel?.addEventListener("click", closeConfirm);
    confirmOv?.addEventListener("click", (e) => {
      if (e.target === confirmOv) closeConfirm();
    });
    confirmOk?.addEventListener("click", async () => {
      const id = pendingRejectId;
      const row = requests.find((x) => Number(x?.id || 0) === Number(id));
      if (!row) { closeConfirm(); return; }
      const reason = String(getReasonEl()?.value || "").trim();
      if (!reason) {
        toast("반려 사유를 입력하세요.", "bad");
        getReasonEl()?.focus();
        return;
      }
      confirmOk.disabled = true;
      const prevTxt = confirmOk.textContent;
      confirmOk.textContent = "처리 중…";
      try {
        const otp = await requestAdminOtp();
        await api("/api/admin/token-withdraw/cancel", {
          method: "POST",
          body: { request_id: row.id, otp, reason },
        });
        toast("출금 반려 완료", "good");
        closeConfirm();
        await loadRequests();
      } catch (e) {
        toast(e.message || "반려 실패", "bad");
      } finally {
        confirmOk.disabled = false;
        confirmOk.textContent = prevTxt;
      }
    });
    qs("#admWalletBtn")?.addEventListener("click", async () => {
      try {
        if (provider()?.publicKey) {
          await disconnectPhantom();
          toast("지갑 연결 해제", "good");
        } else {
          await connectPhantom();
          toast("지갑 연결 완료", "good");
        }
      } catch (e) {
        toast(e.message || "지갑 연결 실패", "bad");
      }
    });

    await loadRequests();
  });
})();
