(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  window.RwaPages.withdraw = async () => {
    const C = window.RwaCore;
    if (!C) throw new Error("RwaCore가 없습니다.");

    // (2026-05-07) Skip the legacy RECON withdraw page bindings when the page
    // is using the new Silica three-token dropdown layout. The Silica markup
    // has #wdAssetToggle (custom dropdown) but no #wdAssetMenu/#wdAssetIcon
    // bindings the legacy code expects — running this file's handlers in
    // parallel produced ReferenceErrors and ate clicks meant for the inline
    // dropdown script in user/withdraw.html.
    if (document.getElementById("tokenDropdownToggle") && document.getElementById("wdAsset")) {
      return;
    }

    const { api, toast, getWallet, connectWallet, refreshOtpGate, isOtpUnlocked } = C;
    const { PublicKey } = solanaWeb3;
    const $ = (id) => document.getElementById(id);

    const short = (s) => {
      s = String(s || "");
      if (s.length <= 18) return s;
      return `${s.slice(0, 8)}...${s.slice(-6)}`;
    };
    const fmtNum = (n, d = 6) => Number(n || 0).toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: d });
    const fmtKst = (v) => (C.fmt?.time ? C.fmt.time(v) : (v || "-"));
    const escHtml = (s) => String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
    const isSolanaAddressLike = (a) => {
      try { new PublicKey(String(a || "").trim()); return true; } catch { return false; }
    };
    const parseMemoNum = (memo, key) => {
      const s = String(memo || "");
      const m = s.match(new RegExp(`(?:^|\\|)${key}:([0-9.]+)`));
      return m ? Number(m[1] || 0) : 0;
    };
    const parseMemoText = (memo, key) => {
      const s = String(memo || "");
      const m = s.match(new RegExp(`(?:^|\\|)${key}:([^|]+)`));
      return m ? String(m[1] || "").trim() : "";
    };
    const decodeMaybe = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      try { return decodeURIComponent(raw); } catch { return raw; }
    };
    const cleanRejectReason = (value) => {
      let text = decodeMaybe(value);
      if (!text) return "";
      text = text.replace(/^reject_reason\s*:\s*/i, "").replace(/^reason\s*:\s*/i, "").trim();
      if (/^admin_send$/i.test(text)) return "";
      return text;
    };
    const resolveRejectReason = (row) => {
      const candidates = [
        row?.withdraw_reject_reason,
        row?.reject_reason,
        row?.admin_note,
        parseMemoText(row?.memo, 'reject_reason'),
        parseMemoText(row?.memo, 'reason'),
      ];
      for (const candidate of candidates) {
        const cleaned = cleanRejectReason(candidate);
        if (cleaned) return cleaned;
      }
      return "";
    };
    
    const clamp = (n) => Number.isFinite(n) ? Number(n) : 0;
    const digitsOf = (assetId) => assetId === "USDT" ? 6 : 1;

    let withdrawFeeMode = "fixed_usdt";
    let withdrawFeeUsdt = 0;
    let withdrawFeePercent = 0;
    let otpBypassed = false;
    let usdtBalance = 0;
    let holdings = [];
    let assetOptions = [];
    let _overlayLocked = false;
    const isRejectReasonOpen = () => {
      const ov = $("rejectReasonOverlay");
      return !!ov && !ov.classList.contains("hidden");
    };
    const syncBodyLock = () => {
      document.body.style.overflow = (_overlayLocked || isRejectReasonOpen()) ? "hidden" : "";
    };

    const currentAsset = () => {
      const code = String($("wdAsset")?.value || "USDT");
      return assetOptions.find((x) => x.id === code) || assetOptions[0] || { id: "USDT", symbol: "USDT", name: "USDT", balance: 0, type: "usdt" };
    };

    const ensureWalletConnected = async () => {
      const w = getWallet();
      if (w?.connected && w?.address && w?.token) return;
      await connectWallet();
      await refreshOtpGate();
    };
    const requireMfaOrOpen = async () => {
      await refreshOtpGate();
      return isOtpUnlocked();
    };

    const quoteFor = (asset, amountRaw) => {
      const amount = clamp(amountRaw);
      const isUsdt = asset.id === "USDT";
      if (!(amount > 0)) {
        return { mode: withdrawFeeMode, feeAmount: 0, feeAsset: isUsdt ? "USDT" : asset.symbol, netAmount: 0, totalDebited: 0, extraUsdtFee: 0 };
      }
      if (withdrawFeeMode === "percent") {
        const feeAmount = clamp(amount * (withdrawFeePercent / 100));
        const netAmount = clamp(Math.max(0, amount - feeAmount));
        return {
          mode: "percent",
          feeAmount,
          feeAsset: isUsdt ? "USDT" : asset.symbol,
          netAmount,
          totalDebited: amount,
          extraUsdtFee: 0,
        };
      }
      const feeAmount = clamp(withdrawFeeUsdt);
      if (isUsdt) {
        return {
          mode: "fixed_usdt",
          feeAmount,
          feeAsset: "USDT",
          netAmount: clamp(Math.max(0, amount - feeAmount)),
          totalDebited: amount,
          extraUsdtFee: 0,
        };
      }
      return {
        mode: "fixed_usdt",
        feeAmount,
        feeAsset: "USDT",
        netAmount: amount,
        totalDebited: amount,
        extraUsdtFee: feeAmount,
      };
    };

    const closeAssetMenu = () => {
      const menu = $("wdAssetMenu");
      const btn = $("wdAssetToggle");
      if (menu) menu.classList.add("hidden");
      if (btn) btn.setAttribute("aria-expanded", "false");
    };
    const openAssetMenu = () => {
      const menu = $("wdAssetMenu");
      const btn = $("wdAssetToggle");
      if (menu) menu.classList.remove("hidden");
      if (btn) btn.setAttribute("aria-expanded", "true");
    };
    const toggleAssetMenu = () => {
      const menu = $("wdAssetMenu");
      if (!menu) return;
      if (menu.classList.contains("hidden")) openAssetMenu(); else closeAssetMenu();
    };

    const syncWalletAddressFields = () => {
      const w = getWallet();
      const addr = String(w?.address || "").trim();
      if ($("myWallet")) $("myWallet").textContent = addr || "-";
      if ($("toAddr")) $("toAddr").value = addr;
    };

    const renderAssetDropdown = () => {
      const sel = $("wdAsset");
      const menu = $("wdAssetMenu");
      if (!sel || !menu) return;
      const prev = sel.value;
      sel.innerHTML = assetOptions.map((x) => `<option value="${x.id}">${x.id === 'USDT' ? 'USDT' : `${x.symbol} · ${x.name}`}</option>`).join("");
      if (assetOptions.some((x) => x.id === prev)) sel.value = prev;
      menu.innerHTML = assetOptions.map((x) => {
        const label = x.id === 'USDT' ? 'USDT' : `${x.symbol} · ${x.name}`;
        return `
        <button class="asset-dd-item${sel.value === x.id ? ' active' : ''}" type="button" data-id="${escHtml(x.id)}" role="option" aria-selected="${sel.value === x.id ? 'true' : 'false'}">
          <span class="asset-dd-item-main">
            <img class="token-thumb" src="${escHtml(x.icon)}" alt="${escHtml(x.symbol)}">
            <div>
              <strong>${escHtml(label)}</strong>
              <span class="small-note">출금 가능 ${fmtNum(x.balance, digitsOf(x.id))} ${escHtml(x.symbol)}</span>
            </div>
          </span>
          <span class="small-note">선택</span>
        </button>
      `;
      }).join("");
      menu.querySelectorAll("[data-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = String(btn.getAttribute("data-id") || "USDT");
          sel.value = id;
          renderAssetDropdown();
          refreshSelectedAssetBox();
          closeAssetMenu();
        });
      });
      const a = currentAsset();
      if ($("wdAssetToggleLabel")) $("wdAssetToggleLabel").textContent = a.id === "USDT" ? "USDT" : `${a.symbol} · ${a.name}`;
      if ($("wdAssetToggleIcon")) {
        $("wdAssetToggleIcon").src = a.icon || (typeof C.tokenImageUrl === "function" ? C.tokenImageUrl("") : "assets/images/default-token.svg");
      }
    };

    const updateWithdrawSummary = () => {
      const a = currentAsset();
      const feeLine = $("wdFeeLine");
      const actualLine = $("wdActualLine");
      const requestLine = $("wdDebitLine");
      const amountNum = Number(String($("amount")?.value || "").replace(/,/g, "").trim());
      const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0;
      const q = quoteFor(a, amount);

      if (feeLine) {
        if (withdrawFeeMode === "percent") {
          feeLine.textContent = `출금 수수료: ${fmtNum(withdrawFeePercent, 6)}%${amount > 0 ? ` (예상 ${fmtNum(q.feeAmount, digitsOf(a.id))} ${q.feeAsset})` : ""}`;
        } else {
          feeLine.textContent = `출금 수수료: ${fmtNum(withdrawFeeUsdt, 6)} USDT`;
        }
      }
      if (!actualLine || !requestLine) return;
      if (!(amount > 0)) {
        actualLine.textContent = "전송수량: -";
        requestLine.textContent = "출금신청금액: -";
        return;
      }
      actualLine.textContent = `전송수량: ${fmtNum(q.netAmount, digitsOf(a.id))} ${a.symbol}`;
      requestLine.textContent = `출금신청금액: ${fmtNum(amount, digitsOf(a.id))} ${a.symbol}`;
    };

    const refreshSelectedAssetBox = () => {
      const a = currentAsset();
      const balanceEl = $("myAssetBalance");
      const labelEl = $("wdAmountLabel");
      const btnEl = $("btnWithdraw");
      const extraEl = $("wdAssetHelp");
      const iconEl = $("wdAssetIcon");
      const metaEl = $("wdAssetMeta");
      const hintEl = $("wdAssetBalanceHint");
      if (balanceEl) balanceEl.textContent = `${fmtNum(a.balance, digitsOf(a.id))} ${a.symbol}`;
      if (labelEl) labelEl.textContent = `${a.id === 'USDT' ? '출금 신청 금액' : '출금 신청 수량'} (${a.symbol})`;
      if (btnEl) btnEl.textContent = a.id === 'USDT' ? 'USDT 출금 신청' : `${a.symbol} 출금 신청`;
      if (extraEl) {
        if (withdrawFeeMode === 'percent') {
          extraEl.textContent = a.id === 'USDT'
            ? 'USDT 출금은 신청 수량에서 비율 수수료가 차감된 뒤 전송됩니다.'
            : '토큰 출금은 신청 수량에서 비율 수수료가 차감된 뒤 전송됩니다.';
        } else {
          extraEl.textContent = a.id === 'USDT'
            ? 'USDT 출금은 신청 수량 - 고정 수수료 = 전송수량으로 계산됩니다.'
            : '토큰 출금은 신청 수량 전액이 전송되고, 고정 수수료는 별도 USDT로 차감됩니다.';
        }
      }
      if (iconEl) {
        iconEl.src = a.icon || (typeof C.tokenImageUrl === 'function' ? C.tokenImageUrl('') : 'assets/images/default-token.svg');
        iconEl.onerror = () => { iconEl.src = (typeof C.tokenImageUrl === 'function' ? C.tokenImageUrl('') : 'assets/images/default-token.svg'); };
      }
      if (metaEl) metaEl.textContent = a.id === 'USDT' ? 'USDT' : `${a.symbol} · ${a.name}`;
      if (hintEl) hintEl.textContent = `출금 가능 수량: ${fmtNum(a.balance, digitsOf(a.id))} ${a.symbol}`;
      renderAssetDropdown();
      updateWithdrawSummary();
    };

    const updateAssetOptions = () => {
      const defaultTokenIcon = typeof C.tokenImageUrl === 'function' ? C.tokenImageUrl('') : 'assets/images/default-token.svg';
      const base = [{ id: 'USDT', name: 'USDT', symbol: 'USDT', balance: usdtBalance, type: 'usdt', icon: defaultTokenIcon }];
      const tokenOpts = (holdings || [])
        .filter((h) => Number(h.balance_token || 0) > 0)
        .map((h) => ({
          id: String(h.asset_id || h.id || ''),
          name: String(h.asset_name || h.name || h.asset_id || 'TOKEN'),
          symbol: String(h.asset_id || h.id || 'TOKEN'),
          balance: Number(h.balance_token || 0),
          type: 'token',
          icon: typeof C.tokenImageUrl === 'function'
            ? C.tokenImageUrl(h.token_image_url || h.image_url || '')
            : (typeof C.assetImageUrl === 'function' ? C.assetImageUrl(h.image_url || '') : defaultTokenIcon),
        }));
      assetOptions = base.concat(tokenOpts);
      renderAssetDropdown();
      refreshSelectedAssetBox();
    };

    const refreshConfig = async () => {
      try {
        const cfg = await api('/api/public/config', { auth: false });
        withdrawFeeMode = String(cfg?.withdraw_fee_mode || 'fixed_usdt');
        withdrawFeeUsdt = Number(cfg?.withdraw_fee_usdt || 0) || 0;
        withdrawFeePercent = Number(cfg?.withdraw_fee_percent || 0) || 0;
        otpBypassed = !!cfg?.bypass_otp;
      } catch {
        withdrawFeeMode = 'fixed_usdt';
        withdrawFeeUsdt = 0;
        withdrawFeePercent = 0;
        otpBypassed = false;
      }
      const otpArea = $('otpArea');
      if (otpArea) otpArea.style.display = otpBypassed ? 'none' : '';
      refreshSelectedAssetBox();
    };

    const refreshMe = async () => {
      syncWalletAddressFields();
      try {
        const pf = await api('/api/portfolio', { auth: true });
        usdtBalance = Number(pf?.usdt || 0) || 0;
        holdings = Array.isArray(pf?.holdings) ? pf.holdings : [];
        if ($('myUsdt')) $('myUsdt').textContent = `${fmtNum(usdtBalance, 6)} USDT`;
      } catch {
        usdtBalance = 0;
        holdings = [];
        if ($('myUsdt')) $('myUsdt').textContent = '-';
      }
      updateAssetOptions();
    };

    const setMaxAmount = () => {
      const a = currentAsset();
      const amountEl = $('amount');
      if (!amountEl) return;
      const maxAmount = Number(a.balance || 0);
      amountEl.value = String(maxAmount);
      updateWithdrawSummary();
      toast(`최대 출금 가능 수량 ${fmtNum(maxAmount, digitsOf(a.id))} ${a.symbol}를 입력했습니다.`, 'good');
    };

    const openRejectReasonOverlay = ({ title, text }) => {
      const ov = $("rejectReasonOverlay");
      if (!ov) return;
      const titleEl = $("rejectReasonTitle");
      const textEl = $("rejectReasonText");
      if (titleEl) titleEl.textContent = title || "반려 사유";
      if (textEl) textEl.textContent = text || "-";
      ov.classList.remove("hidden");
      ov.setAttribute("aria-hidden", "false");
      syncBodyLock();
      $("rejectReasonOk")?.focus?.();
    };
    const closeRejectReasonOverlay = () => {
      const ov = $("rejectReasonOverlay");
      if (!ov) return;
      ov.classList.add("hidden");
      ov.setAttribute("aria-hidden", "true");
      syncBodyLock();
    };

    const refreshTxs = async () => {
      const tb = $('txRows');
      if (!tb) return;
      tb.innerHTML = '<tr><td colspan="8" class="muted">로딩 중...</td></tr>';
      const ok = await requireMfaOrOpen();
      if (!ok) {
        tb.innerHTML = '<tr><td colspan="8" class="muted">OTP 인증이 필요합니다.</td></tr>';
        return;
      }
      try {
        const [walletRes, tokenRes] = await Promise.all([
          api('/api/wallet/transactions?limit=100', { auth: true }).catch(() => ({ transactions: [] })),
          api('/api/token-withdraw/my', { auth: true }).catch(() => ({ rows: [] })),
        ]);
        const walletRows = (Array.isArray(walletRes?.transactions) ? walletRes.transactions : [])
          .filter((r) => String(r.kind || '') === 'withdraw' || /출금/.test(String(r.status || '')))
          .map((r) => ({
            source: 'usdt',
            asset: 'USDT',
            asset_label: 'USDT',
            asset_name: 'USDT',
            request_amount: Number(r.amount || 0),
            fee_amount: Number(r.withdraw_fee_amount || parseMemoNum(r.memo, 'fee_amount') || parseMemoNum(r.memo, 'fee') || 0),
            fee_asset: 'USDT',
            net_amount: Number(r.withdraw_net_amount || parseMemoNum(r.memo, 'net') || r.amount || 0),
            status: String(r.status || '-'),
            txid: r.txid || '',
            created_at: r.created_at,
            note: resolveRejectReason(r),
          }));
        const tokenRows = (Array.isArray(tokenRes?.rows) ? tokenRes.rows : []).map((r) => ({
          source: 'token',
          asset: String(r.asset_id || ''),
          asset_label: String(r.asset_id || '-'),
          asset_name: String(r.asset_name || ''),
          request_amount: Number(r.amount_token || 0),
          fee_amount: Number(r.fee_amount || parseMemoNum(r.memo, 'fee_amount') || parseMemoNum(r.memo, 'fee') || 0),
          fee_asset: String(r.fee_asset || ((String(r.fee_mode || parseMemoText(r.memo, 'fee_mode') || '') === 'fixed_usdt') ? 'USDT' : (r.asset_id || 'TOKEN'))),
          net_amount: Number(r.net_amount || parseMemoNum(r.memo, 'net') || r.amount_token || 0),
          status: String(r.status || '-'),
          txid: r.txid || '',
          created_at: r.created_at,
          note: resolveRejectReason(r),
        }));
        const rows = walletRows.concat(tokenRows).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        if (!rows.length) {
          tb.innerHTML = '<tr><td colspan="8" class="muted">내역이 없습니다.</td></tr>';
          return;
        }
        tb.innerHTML = rows.map((x) => {
          const asset = String(x.asset || 'USDT');
          const d = digitsOf(asset === 'USDT' ? 'USDT' : 'TOKEN');
          const txCell = x.txid
            ? `<a class="mono" style="color:var(--link);font-weight:900;text-decoration:none" target="_blank" rel="noopener" href="https://solscan.io/tx/${encodeURIComponent(x.txid)}">${short(x.txid)}</a>`
            : '-';
          const feeText = x.fee_amount > 0 ? `${fmtNum(x.fee_amount, x.fee_asset === 'USDT' ? 6 : d)} ${x.fee_asset}` : '-';
          const noteText = cleanRejectReason(x.note);
          const noteCell = noteText
            ? `<button type="button" class="btn small note-detail-btn" data-title="${encodeURIComponent(`${x.asset_label} 반려 사유`)}" data-note="${encodeURIComponent(noteText)}">자세히 보기</button>`
            : '-';
          const assetCell = asset === 'USDT'
            ? 'USDT'
            : `<div><strong data-no-i18n="1" translate="no">${escHtml(x.asset_label)}</strong>${x.asset_name ? `<div class="small-note" data-no-i18n="1" translate="no">${escHtml(x.asset_name)}</div>` : ''}</div>`;
          return `
            <tr>
              <td>${escHtml(x.status)}</td>
              <td class="tx-asset">${assetCell}</td>
              <td class="right mono tx-request">${fmtNum(x.request_amount, asset === 'USDT' ? 6 : 1)}</td>
              <td class="right mono tx-fee">${escHtml(feeText)}</td>
              <td class="right mono tx-net">${fmtNum(x.net_amount, asset === 'USDT' ? 6 : 1)} ${escHtml(asset === 'USDT' ? 'USDT' : asset)}</td>
              <td class="tx-note">${noteCell}</td>
              <td class="tx-txid">${txCell}</td>
              <td class="mono tx-time">${escHtml(fmtKst(x.created_at))}</td>
            </tr>
          `;
        }).join('');
        tb.querySelectorAll('.note-detail-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const title = decodeMaybe(btn.getAttribute('data-title'));
            const note = decodeMaybe(btn.getAttribute('data-note'));
            openRejectReasonOverlay({ title, text: note });
          });
        });
      } catch (e) {
        tb.innerHTML = `<tr><td colspan="8" class="muted">${escHtml(String(e?.message || '내역 조회 실패'))}</td></tr>`;
      }
    };

    const setOverlayUI = (mode, msg) => {
      const title = $('txOverlayTitle');
      const text = $('txOverlayMsg');
      const spin = $('txOverlaySpinner');
      const actions = $('txOverlayActions');
      const okBtn = $('txOverlayOk');
      if (title) title.textContent = mode === 'done' ? '출금 신청 완료' : '출금 신청중';
      if (text) text.textContent = msg || (mode === 'done' ? '출금 신청이 완료되었습니다.' : '출금 신청을 처리하고 있습니다. 잠시만 기다려주세요.');
      if (spin) spin.style.display = mode === 'done' ? 'none' : '';
      if (actions) actions.style.display = mode === 'done' ? 'flex' : 'none';
      if (mode === 'done' && okBtn) okBtn.focus?.();
    };
    const lockAllInputs = (lock) => {
      _overlayLocked = !!lock;
      syncBodyLock();
      ['btnWithdraw','btnRefresh','btnOtpOpen','btnAmountMax','wdAssetToggle'].forEach((id) => { const el = $(id); if (el) el.disabled = lock; });
      ['amount','toAddr','wdAsset','otpCode'].forEach((id) => { const el = $(id); if (el) el.disabled = lock; });
    };
    const openTxOverlay = (msg) => {
      const ov = $('txOverlay');
      if (!ov) return;
      setOverlayUI('loading', msg);
      ov.classList.remove('hidden');
      ov.setAttribute('aria-hidden', 'false');
      lockAllInputs(true);
    };
    const closeTxOverlay = () => {
      const ov = $('txOverlay');
      if (!ov) return;
      ov.classList.add('hidden');
      ov.setAttribute('aria-hidden', 'true');
      lockAllInputs(false);
    };
    const showTxDone = (msg) => setOverlayUI('done', msg);

    $('txOverlayOk')?.addEventListener('click', async () => {
      closeTxOverlay();
      await refreshMe().catch(() => {});
      await refreshTxs().catch(() => {});
    });
    $('rejectReasonClose')?.addEventListener('click', closeRejectReasonOverlay);
    $('rejectReasonOk')?.addEventListener('click', closeRejectReasonOverlay);
    document.querySelector('#rejectReasonOverlay .reason-overlay-backdrop')?.addEventListener('click', closeRejectReasonOverlay);
    $('txOverlay')?.addEventListener('click', (e) => { if (e?.preventDefault) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (isRejectReasonOpen() && e.key === 'Escape') {
        e.preventDefault();
        closeRejectReasonOverlay();
        return;
      }
      if (!_overlayLocked) return;
      if (e.key === 'Escape' || e.key === 'Tab') e.preventDefault();
    }, true);

    const submitWithdraw = async () => {
      // (2026-06-17 v925) 미연결 시 공통 지갑연결 모달 + 중단 (기존 connectWallet 직접호출 대체).
      if (!window.RwaCore.requireWalletConnected()) return;
      const ok = await requireMfaOrOpen();
      if (!ok) return;
      const walletAddr = String(getWallet()?.address || '').trim();
      if (!walletAddr || !isSolanaAddressLike(walletAddr)) {
        toast('로그인한 지갑주소를 확인할 수 없습니다.', 'bad');
        return;
      }
      if ($('toAddr')) $('toAddr').value = walletAddr;
      const otpCode = String($('otpCode')?.value || '').trim();
      const amountStr = String($('amount')?.value || '').trim();
      const amountNum = Number(amountStr);
      if (!(Number.isFinite(amountNum) && amountNum > 0)) { toast('출금 수량을 입력하세요.', 'bad'); return; }
      if (!Number.isInteger(amountNum) || !/^\d+$/.test(amountStr)) {
        toast('출금 수량은 정수만 입력 가능합니다.', 'bad');
        return;
      }
      const a = currentAsset();
      const q = quoteFor(a, amountNum);
      if (amountNum > Number(a.balance || 0)) {
        toast(`${a.symbol} 보유 수량이 부족합니다.`, 'bad');
        return;
      }
      if (!(q.netAmount > 0)) {
        toast('수수료를 제외하면 전송수량이 0 이하입니다.', 'bad');
        return;
      }
      if (a.id !== 'USDT' && q.extraUsdtFee > 0 && usdtBalance < q.extraUsdtFee) {
        toast(`토큰 출금 고정 수수료 ${fmtNum(q.extraUsdtFee, 6)} USDT가 부족합니다.`, 'bad');
        return;
      }
      openTxOverlay('출금 신청을 접수하고 있습니다. 잠시만 기다려주세요.');
      const lastReq = $('lastReq');
      if (lastReq) lastReq.textContent = '출금 신청 중...';
      try {
        let r;
        if (a.id === 'USDT') {
          r = await api('/api/withdraw/request', { method: 'POST', auth: true, body: { amount: amountStr, to_address: walletAddr, otp: otpCode } });
        } else {
          r = await api('/api/token-withdraw/request', { method: 'POST', auth: true, body: { assetId: a.id, amount: amountStr, to_address: walletAddr, otp: otpCode } });
        }
        const feeAmount = Number(r?.fee_amount || 0);
        const feeAsset = String(r?.fee_asset || ((r?.fee_mode === 'fixed_usdt') ? 'USDT' : a.symbol));
        const netAmount = Number(r?.net_amount || amountNum);
        if (lastReq) {
          lastReq.textContent = `${a.symbol} 출금 신청 완료 · 신청 ${fmtNum(amountNum, digitsOf(a.id))} ${a.symbol} / 수수료 ${feeAmount > 0 ? `${fmtNum(feeAmount, feeAsset === 'USDT' ? 6 : digitsOf(a.id))} ${feeAsset}` : '0'} / 전송수량 ${fmtNum(netAmount, digitsOf(a.id))} ${a.symbol} → ${short(walletAddr)}`;
        }
        const amountEl = $('amount');
        const otpEl = $('otpCode');
        if (amountEl) amountEl.value = '';
        if (otpEl) otpEl.value = '';
        updateWithdrawSummary();
        await refreshMe().catch(() => {});
        await refreshTxs().catch(() => {});
        showTxDone(`${a.symbol} 출금 신청이 완료되었습니다. 전송수량은 ${fmtNum(netAmount, digitsOf(a.id))} ${a.symbol}입니다.`);
        toast(`${a.symbol} 출금 신청 완료`, 'good');
      } catch (e) {
        if (lastReq) lastReq.textContent = `실패: ${String(e?.message || '출금 신청 실패')}`;
        toast(e?.message || '출금 신청 실패', 'bad');
        closeTxOverlay();
      }
    };

    $('btnRefresh')?.addEventListener('click', async () => {
      try {
        await refreshMe();
        await refreshConfig();
        await refreshTxs();
        toast('갱신 완료', 'good');
      } catch (e) { toast(e?.message || '실패', 'bad'); }
    });
    $('btnOtpOpen')?.addEventListener('click', async () => {
      try { await ensureWalletConnected(); await refreshOtpGate(); }
      catch (e) { toast(e?.message || '실패', 'bad'); }
    });
    $('btnWithdraw')?.addEventListener('click', submitWithdraw);
    $('btnAmountMax')?.addEventListener('click', setMaxAmount);
    $('amount')?.addEventListener('input', updateWithdrawSummary);
    $('wdAssetToggle')?.addEventListener('click', toggleAssetMenu);
    document.addEventListener('click', (e) => {
      const box = $('wdAssetMenu');
      const btn = $('wdAssetToggle');
      if (!box || !btn) return;
      if (box.contains(e.target) || btn.contains(e.target)) return;
      closeAssetMenu();
    });

    syncWalletAddressFields();
    try {
      const cfg = await api('/api/public/config', { auth: false });
      if (cfg?.bypass_otp) {
        otpBypassed = true;
        const otpArea = $('otpArea'); if (otpArea) otpArea.style.display = 'none';
      }
    } catch {}
    await refreshConfig().catch(() => {});
    await refreshMe().catch(() => {});
    await refreshTxs().catch(() => {});
  };
})();
