// public/assets/js/pages/sale-detail.js
(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  window.RwaPages["sale-detail"] = async () => {
    const C = window.RwaCore || {};
    const qs = typeof C.qs === "function"
      ? C.qs
      : (sel, el = document) => el.querySelector(sel);

    const toast =
      typeof C.toast === "function"
        ? C.toast
        : (msg) => {
            const t = qs("#toast");
            if (t) {
              t.classList.remove("hidden");
              t.textContent = msg;
              clearTimeout(toast._t);
              toast._t = setTimeout(() => t.classList.add("hidden"), 2600);
            } else {
              console.log(msg);
            }
          };

    const fmt =
      C.fmt || {
        num(n, d = 0) {
          const x = Number(n);
          return Number.isFinite(x) ? x.toFixed(d) : "-";
        },
        date(s) {
          return s ? String(s) : "-";
        },
        time(s) {
          return s ? String(s) : "-";
        },
      };

    const api =
      typeof C.api === "function"
        ? C.api
        : async () => {
            throw new Error("RwaCore.api가 없습니다.");
          };

    const getWallet =
      typeof C.getWallet === "function"
        ? () => C.getWallet()
        : () => ({ connected: false, token: null });

    const getParam =
      typeof C.getParam === "function"
        ? C.getParam
        : (k) => {
            try {
              return new URLSearchParams(location.search).get(k);
            } catch {
              return null;
            }
          };

    const absUrl = typeof C.absUrl === "function"
      ? C.absUrl
      : (p) => {
          const s = String(p || "").trim();
          if (!s) return "";
          if (/^(https?:)?\/\//i.test(s)) return s;
          if (s.startsWith("/")) return s;
          return `/${s}`;
        };

    const curFmt = (n, ccy, d = 4) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return `${fmt.num(x, d)} ${String(ccy || "").toUpperCase()}`;
    };

    const usdtFmt = (n, d = 6) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return `${fmt.num(x, d)} USDT`;
    };

    const tokenSymbolOf = (sale, fallbackAssetId) => {
      const symbol = String(sale?.token_symbol || sale?.asset_id || sale?.id || fallbackAssetId || "TOKEN").trim().toUpperCase();
      return symbol || "TOKEN";
    };

    const executionLabelOf = (sale) => {
      const label = String(
        sale?.sale_execution_display_at ||
        sale?.sale_executed_label ||
        sale?.exchange_available_at ||
        sale?.sale_executed_at_kst ||
        sale?.sale_executed_at ||
        sale?.exchange_available_date ||
        ""
      ).trim();
      return label || "";
    };

    const isRedeemableSaleStatus = (status) => {
      const s = String(status || "").trim();
      return s === "매각" || s === "매각(완료)";
    };

    const POW10 = (d) => 10n ** BigInt(d);

    const decToRaw = (val, decimals = 6) => {
      const s0 = String(val ?? "").replace(/,/g, "").trim();
      if (!s0) return 0n;

      const neg = s0.startsWith("-");
      const s = neg ? s0.slice(1) : s0;

      const parts = s.split(".");
      const ip = (parts[0] || "0").replace(/[^\d]/g, "") || "0";
      const fp = (parts[1] || "")
        .replace(/[^\d]/g, "")
        .slice(0, decimals)
        .padEnd(decimals, "0");

      const raw = BigInt(ip) * POW10(decimals) + BigInt(fp || "0");
      return neg ? -raw : raw;
    };

    const rawToDecStr = (raw, decimals = 6) => {
      let v = BigInt(raw);
      if (v < 0n) v = 0n;
      const ip = v / POW10(decimals);
      const fp = (v % POW10(decimals)).toString().padStart(decimals, "0");
      return `${ip.toString()}.${fp}`;
    };

    const TOKEN_DECIMALS = 6;
    const TOKEN_SCALE = POW10(TOKEN_DECIMALS);

    const floorTokenRawToWholeRaw = (raw) => {
      let v = BigInt(raw);
      if (v < 0n) v = 0n;
      return (v / TOKEN_SCALE) * TOKEN_SCALE;
    };

    const tokenRawToWholeStr = (raw) => {
      const wholeRaw = floorTokenRawToWholeRaw(raw);
      return (wholeRaw / TOKEN_SCALE).toString();
    };

    const normalizeWholeTokenInput = (val) => {
      const s0 = String(val ?? "").trim().replace(/,/g, "");
      if (!s0) return "";
      const m = s0.match(/^(\d+)/);
      if (!m) return "";
      return m[1].replace(/^0+(?=\d)/, "");
    };

    const wholeTokenStrToRaw = (val) => {
      const s = normalizeWholeTokenInput(val);
      if (!s) return 0n;
      return BigInt(s) * TOKEN_SCALE;
    };

    const assetId = String(getParam("id") || "").trim();

    const titleEl = qs("#saleTitle");
    const statusEl = qs("#saleStatus");
    const marketEl = qs("#saleMarket");
    const currencyEl = qs("#saleCurrency");
    const imgEl = qs("#saleImage");
    const tokenEl = qs("#saleTokenImage");

    const buyEl = qs("#saleBuyPrice");
    const soldEl = qs("#saleSoldPrice");
    const expEl = qs("#saleExpenses");

    const netUsdtEl = qs("#saleNetUsdt");
    const netLocalEl = qs("#saleNetInflowLocal");

    const rpUsdtEl = qs("#saleRedeemPriceUsdt");
    const rpLocalEl = qs("#saleRedeemPriceLocal");
    const fxLineEl = qs("#saleFxLine");
    const fxHintEl = qs("#saleFxHint");

    const vaultTotalEl = qs("#saleVaultTotal");
    const supplyEl = qs("#saleSupply");
    const supplyUnitEl = qs("#saleSupplyUnit");

    const windowEl = qs("#saleWindow");
    const vaultEl = qs("#saleVault");

    const docsBody = qs("#saleDocsList");
    const histBody = qs("#saleHistory");

    const myBalEl = qs("#saleMyBalance");
    const amtEl = qs("#saleRedeemAmount");
    const receiveEl = qs("#saleReceive");
    const maxBtn = qs("#saleMaxBtn");
    const redeemBtn = qs("#saleRedeemBtn");
    const curInEl = qs("#saleCurCodeIn");

    if (!titleEl) {
      console.error("sale-detail.html 필수 요소(#saleTitle)가 없습니다.");
      return;
    }

    const state = {
      loaded: false,
      saleStatus: "",
      saleExecuted: false,
      ccy: "KRW",
      tokenSymbol: tokenSymbolOf(null, assetId),
      fxNow: 0,
      saleFxPerUsdt: 0,
      executionLabel: "",

      supplyStr6: "0.000000",
      supplyRaw: 0n,

      vaultRemainStr6: "0.000000",
      vaultRemainRaw: 0n,

      vaultTotalStr6: "0.000000",
      vaultTotalRaw: 0n,

      unitUsdtStr6: "0.000000",
      unitUsdtRaw: 0n,
      unitLocal: 0,

      myBalStr6: "0.000000",
      myBalRaw: 0n,
      myBalWholeStr: "0",
      myBalWholeRaw: 0n,
    };

    const syncTokenLabels = () => {
      const tokenLabel = tokenSymbolOf({ token_symbol: state.tokenSymbol }, assetId);
      if (curInEl) curInEl.textContent = tokenLabel;
      if (supplyUnitEl) supplyUnitEl.textContent = tokenLabel;
      if (amtEl) amtEl.placeholder = `예: 10 ${tokenLabel}`;
      return tokenLabel;
    };

    const setDisabledPage = (message) => {
      state.loaded = false;
      state.saleStatus = "";
      state.saleExecuted = false;
      state.tokenSymbol = tokenSymbolOf(null, assetId);
      state.saleFxPerUsdt = 0;
      state.executionLabel = "";
      state.myBalWholeStr = "0";
      state.myBalWholeRaw = 0n;

      if (titleEl) titleEl.textContent = message || "매각 정보를 찾을 수 없습니다.";
      if (statusEl) statusEl.textContent = "-";
      if (marketEl) marketEl.textContent = "-";
      if (currencyEl) currencyEl.textContent = "-";
      if (buyEl) buyEl.textContent = "-";
      if (soldEl) soldEl.textContent = "-";
      if (expEl) expEl.textContent = "-";
      if (netUsdtEl) netUsdtEl.textContent = "-";
      if (netLocalEl) netLocalEl.textContent = "-";
      if (rpUsdtEl) rpUsdtEl.textContent = "-";
      if (rpLocalEl) rpLocalEl.textContent = "-";
      if (fxLineEl) fxLineEl.textContent = "-";
      if (fxHintEl) fxHintEl.textContent = "올바른 매각 자산 정보가 없습니다.";
      if (vaultTotalEl) vaultTotalEl.textContent = "-";
      if (supplyEl) supplyEl.textContent = "-";
      syncTokenLabels();
      if (windowEl) windowEl.textContent = "-";
      if (vaultEl) vaultEl.textContent = "-";
      if (myBalEl) myBalEl.textContent = "-";
      if (receiveEl) receiveEl.textContent = "-";
      if (redeemBtn) redeemBtn.disabled = true;
      if (amtEl) amtEl.value = "";

      if (docsBody) {
        docsBody.innerHTML = `<tr><td colspan="3" class="center muted">문서가 없습니다.</td></tr>`;
      }

      if (histBody) {
        histBody.innerHTML = `<tr><td colspan="4" class="center muted">내역이 없습니다.</td></tr>`;
      }
    };

    const getConfig = async () => {
      if (typeof C.getConfig === "function") return await C.getConfig();
      return await api("/api/public/config", { auth: false });
    };

    const loadSale = async () => {
      if (!assetId) {
        setDisabledPage("매각 자산 ID가 없습니다.");
        toast("잘못된 접근입니다. sale-detail.html?id=자산ID 형태로 접속해야 합니다.", "bad");
        return false;
      }

      const data = await api(`/api/sales/${encodeURIComponent(assetId)}`, { auth: false });
      if (!data?.sale) throw new Error("매각 정보 없음");

      const cfg = await getConfig().catch(() => null);
      const fxRates = cfg?.fx_rates || {};
      const s = data.sale;

      state.ccy = String(s.settlement_basis || "KRW").toUpperCase();
      state.tokenSymbol = tokenSymbolOf(s, assetId);
      state.fxNow = Number(fxRates?.[state.ccy] || 0);
      state.saleStatus = String(s.display_status || s.status || "").trim();
      state.executionLabel = executionLabelOf(s);
      state.saleExecuted = !!s.sale_executed || !!state.executionLabel || isRedeemableSaleStatus(state.saleStatus);

      state.supplyStr6 = rawToDecStr(decToRaw(String(s.supply_token ?? "0.000000"), 6), 6);
      state.supplyRaw = decToRaw(state.supplyStr6, 6);

      state.vaultRemainStr6 = rawToDecStr(decToRaw(String(s.vault_balance_usdt ?? "0.000000"), 6), 6);
      state.vaultRemainRaw = decToRaw(state.vaultRemainStr6, 6);

      const totalCandidate = String(s.vault_total_usdt ?? "0.000000");
      state.vaultTotalStr6 = rawToDecStr(decToRaw(totalCandidate, 6), 6);
      state.vaultTotalRaw = decToRaw(state.vaultTotalStr6, 6);
      if (!(state.vaultTotalRaw > 0n) && state.vaultRemainRaw > 0n) {
        state.vaultTotalStr6 = state.vaultRemainStr6;
        state.vaultTotalRaw = state.vaultRemainRaw;
      }

      const unitCandidate = String(s.token_unit_usdt ?? "0.000000");
      state.unitUsdtStr6 = rawToDecStr(decToRaw(unitCandidate, 6), 6);
      state.unitUsdtRaw = decToRaw(state.unitUsdtStr6, 6);
      if (!(state.unitUsdtRaw > 0n) && state.supplyRaw > 0n && state.vaultTotalRaw > 0n) {
        state.unitUsdtRaw = (state.vaultTotalRaw * 1000000n) / state.supplyRaw;
        state.unitUsdtStr6 = rawToDecStr(state.unitUsdtRaw, 6);
      }

      const lockedFx = Number(s.fixed_fx_per_usdt || s.display_fx_per_usdt || 0);
      const storedFx = Number(s.display_fx_per_usdt || s.fx_per_usdt || 0);
      state.saleFxPerUsdt = state.ccy === "USDT"
        ? 1
        : (lockedFx > 0 ? lockedFx : (storedFx > 0 ? storedFx : state.fxNow));
      state.unitLocal = Number(s.token_unit_local || s.token_unit_settlement || 0);
      if (!(state.unitLocal > 0) && state.unitUsdtRaw > 0n && state.saleFxPerUsdt > 0 && state.ccy !== "USDT") {
        state.unitLocal = Number(state.unitUsdtStr6) * state.saleFxPerUsdt;
      }

      const buy = Number(s.buy_price_krw || 0);
      const sold = Number(s.sold_price_krw || 0);
      const exp = Number(s.expenses_krw || 0);
      const netLocal = sold - exp;

      if (titleEl) titleEl.textContent = `${s.id} · ${s.name}`;
      if (statusEl) statusEl.textContent = state.saleStatus || "매각";
      if (marketEl) marketEl.textContent = s.market || "-";
      if (currencyEl) currencyEl.textContent = state.ccy;
      syncTokenLabels();
      if (amtEl) amtEl.placeholder = `예: 10 ${state.tokenSymbol}`;

      if (imgEl) imgEl.src = (window.RwaCore?.assetImageUrl ? window.RwaCore.assetImageUrl(s.image_url || "") : absUrl(s.image_url || ""));
      if (tokenEl) tokenEl.src = (window.RwaCore?.tokenImageUrl ? window.RwaCore.tokenImageUrl(s.token_image_url || "") : absUrl(s.token_image_url || ""));

      if (buyEl) buyEl.textContent = curFmt(buy, state.ccy, 0);
      if (soldEl) soldEl.textContent = curFmt(sold, state.ccy, 0);
      if (expEl) expEl.textContent = curFmt(exp, state.ccy, 0);
      if (netUsdtEl) netUsdtEl.textContent = state.vaultTotalRaw > 0n ? usdtFmt(Number(state.vaultTotalStr6), 6) : "-";
      if (netLocalEl) netLocalEl.textContent = Number.isFinite(netLocal) ? curFmt(netLocal, state.ccy, 0) : "-";
      if (rpUsdtEl) rpUsdtEl.textContent = state.unitUsdtRaw > 0n ? usdtFmt(Number(state.unitUsdtStr6), 6) : "-";

      if (rpLocalEl) {
        if (state.ccy === "USDT") {
          rpLocalEl.textContent = "정산통화가 USDT이므로 현지통화 참고값이 없습니다.";
        } else if (state.unitLocal > 0) {
          rpLocalEl.textContent = `현지통화 환산액: 1 ${state.tokenSymbol} ≈ ${curFmt(state.unitLocal, state.ccy, 6)}`;
        } else {
          rpLocalEl.textContent = "현지통화 참고값을 계산할 수 없습니다.";
        }
      }

      if (fxLineEl) {
        if (state.ccy === "USDT") {
          fxLineEl.textContent = lockedFx > 0 ? "고정 환율: 1 USDT = 1 USDT" : "1 USDT = 1 USDT";
        } else if (lockedFx > 0) {
          fxLineEl.textContent = `고정 환율: 1 USDT = ${fmt.num(lockedFx, 4)} ${state.ccy}`;
        } else {
          fxLineEl.textContent = state.saleFxPerUsdt > 0 ? `1 USDT = ${fmt.num(state.saleFxPerUsdt, 4)} ${state.ccy}` : "-";
        }
      }

      if (fxHintEl) {
        fxHintEl.textContent = lockedFx > 0
          ? "매각 실행 시 확정된 환율이 적용되며, 플랫폼 유저 할당총액 기준으로 토큰당 교환단가가 확정됩니다. 관리자 매각 실행 완료 후 토큰 입금 즉시 영구 소각되고 해당 수량만큼 USDT가 지급됩니다."
          : "관리자 매각 실행 완료 후 플랫폼 유저 할당총액 기준으로 토큰당 교환단가가 적용되며, 토큰 입금 즉시 영구 소각 후 해당 수량만큼 USDT가 지급됩니다.";
      }

      if (vaultTotalEl) vaultTotalEl.textContent = state.vaultTotalRaw > 0n ? usdtFmt(Number(state.vaultTotalStr6), 6) : "-";
      if (supplyEl) supplyEl.textContent = state.supplyRaw > 0n ? fmt.num(Number(state.supplyStr6), 6) : "-";
      if (windowEl) windowEl.textContent = state.executionLabel || "-";
      if (vaultEl) vaultEl.textContent = usdtFmt(Number(state.vaultRemainStr6), 6);

      if (docsBody) {
        const docs = data.docs || [];
        docsBody.innerHTML =
          docs.map((d) => {
            const href = absUrl(d.file_path || "");
            return `<tr>
              <td>${d.title || "-"}</td>
              <td class="right">${d.doc_date ? fmt.date(d.doc_date) : "-"}</td>
              <td class="right"><a class="btn small" href="${href}" target="_blank" rel="noopener">보기</a></td>
            </tr>`;
          }).join("") || `<tr><td colspan="3" class="center muted">등록된 문서가 없습니다.</td></tr>`;
      }

      state.loaded = true;
      return true;
    };

    const loadPortfolio = async () => {
      const w = getWallet();
      if (!w.connected || !w.token) {
        state.myBalStr6 = "0.000000";
        state.myBalRaw = 0n;
        state.myBalWholeStr = "0";
        state.myBalWholeRaw = 0n;
        if (myBalEl) myBalEl.textContent = "-";
        return;
      }

      try {
        const pf =
          typeof C.loadPortfolio === "function"
            ? await C.loadPortfolio()
            : await api("/api/portfolio", { method: "GET", auth: true });

        const row = (pf.holdings || []).find((h) => h.asset_id === assetId) || { balance_token: 0 };
        state.tokenSymbol = tokenSymbolOf(row, assetId) || state.tokenSymbol;
        syncTokenLabels();
        state.myBalStr6 = rawToDecStr(decToRaw(String(row.balance_token ?? "0.000000"), 6), 6);
        state.myBalRaw = decToRaw(state.myBalStr6, 6);
        state.myBalWholeRaw = floorTokenRawToWholeRaw(state.myBalRaw);
        state.myBalWholeStr = tokenRawToWholeStr(state.myBalRaw);

        if (myBalEl) {
          myBalEl.textContent = `${fmt.num(Number(state.myBalStr6), 6)} ${state.tokenSymbol}`;
        }
      } catch {
        state.myBalStr6 = "0.000000";
        state.myBalRaw = 0n;
        state.myBalWholeRaw = 0n;
        state.myBalWholeStr = "0";
        if (myBalEl) myBalEl.textContent = "-";
      }
    };

    const loadHistory = async () => {
      const w = getWallet();
      if (!histBody) return;

      if (!w.connected || !w.token) {
        histBody.innerHTML = `<tr><td colspan="4" class="center muted">지갑을 연결하세요.</td></tr>`;
        return;
      }

      try {
        const h = await api(`/api/sales/${encodeURIComponent(assetId)}/history`, { auth: true });
        const rows = h.rows || [];

        histBody.innerHTML =
          rows.map((r) => `<tr>
            <td>${fmt.time(r.created_at)}</td>
            <td class="right">${fmt.num(r.tokens, 6)} ${state.tokenSymbol}</td>
            <td class="right">${fmt.num(r.amount_local, 4)} ${String(r.settlement_basis || state.ccy).toUpperCase()}</td>
            <td class="right">${fmt.num(r.usdt, 6)} USDT</td>
          </tr>`).join("") || `<tr><td colspan="4" class="center muted">내역이 없습니다.</td></tr>`;
      } catch {
        histBody.innerHTML = `<tr><td colspan="4" class="center muted">내역을 불러오지 못했습니다.</td></tr>`;
      }
    };

    const canOpenRedeemFlow = () => (
      state.loaded &&
      (isRedeemableSaleStatus(state.saleStatus) || state.saleExecuted) &&
      state.saleExecuted &&
      state.supplyRaw > 0n &&
      state.vaultTotalRaw > 0n
    );

    const recalc = () => {
      const w = getWallet();
      const flowReady = canOpenRedeemFlow();
      if (!state.loaded) {
        if (receiveEl) receiveEl.textContent = "-";
        if (redeemBtn) redeemBtn.disabled = true;
        return;
      }

      if (!w.connected || !w.token) {
        if (receiveEl) receiveEl.textContent = "-";
        if (redeemBtn) redeemBtn.disabled = !flowReady;
        return;
      }

      const qtyStr = normalizeWholeTokenInput(amtEl?.value || "");
      const qtyRaw = wholeTokenStrToRaw(qtyStr);

      let receiveRaw = 0n;
      if (qtyRaw > 0n && state.vaultTotalRaw > 0n && state.supplyRaw > 0n) {
        receiveRaw = (qtyRaw * state.vaultTotalRaw) / state.supplyRaw;
      }

      if (receiveEl) {
        if (qtyRaw > 0n && receiveRaw > 0n) {
          const receiveStr6 = rawToDecStr(receiveRaw, 6);
          const receiveNum = Number(receiveStr6);
          if (state.ccy !== "USDT" && state.saleFxPerUsdt > 0) {
            const localEq = receiveNum * state.saleFxPerUsdt;
            receiveEl.textContent = `${usdtFmt(receiveNum, 6)} (≈ ${curFmt(localEq, state.ccy, 4)})`;
          } else {
            receiveEl.textContent = usdtFmt(receiveNum, 6);
          }
        } else {
          receiveEl.textContent = "-";
        }
      }

      if (redeemBtn) {
        redeemBtn.disabled = !flowReady;
      }
    };

    if (maxBtn && !maxBtn.dataset.bound) {
      maxBtn.dataset.bound = "1";
      maxBtn.addEventListener("click", () => {
        const w = getWallet();
        if (!w.connected) {
          toast("지갑을 연결하세요.");
          return;
        }
        if (amtEl) amtEl.value = state.myBalWholeStr;
        recalc();
      });
    }

    if (amtEl && !amtEl.dataset.bound) {
      amtEl.dataset.bound = "1";
      amtEl.setAttribute("inputmode", "numeric");
      amtEl.setAttribute("pattern", "[0-9]*");
      amtEl.addEventListener("beforeinput", (e) => {
        if (String(e.inputType || "").startsWith("delete")) return;
        const chunk = typeof e.data === "string" ? e.data : "";
        if (chunk && /[^\d]/.test(chunk)) {
          e.preventDefault();
        }
      });
      amtEl.addEventListener("paste", (e) => {
        const raw = String(e.clipboardData?.getData("text") || window.clipboardData?.getData("Text") || "");
        const cleaned = raw.replace(/,/g, "").trim();
        if (!cleaned) {
          e.preventDefault();
          return;
        }
        if (!/^\d+$/.test(cleaned)) {
          e.preventDefault();
          toast("토큰 입금 수량은 정수만 입력할 수 있습니다.", "bad");
          return;
        }
        e.preventDefault();
        amtEl.value = cleaned.replace(/^0+(?=\d)/, "");
        recalc();
      });
      amtEl.addEventListener("input", () => {
        const cleaned = normalizeWholeTokenInput(amtEl.value || "");
        if (amtEl.value !== cleaned) {
          amtEl.value = cleaned;
        }
        recalc();
      });
    }

    if (redeemBtn && !redeemBtn.dataset.bound) {
      redeemBtn.dataset.bound = "1";
      redeemBtn.addEventListener("click", async () => {
        const w = getWallet();
        if (!w.connected || !w.token) {
          toast("지갑을 연결하세요.");
          return;
        }

        if (!(isRedeemableSaleStatus(state.saleStatus) || state.saleExecuted)) {
          toast("현재 매각 교환 가능 상태가 아닙니다.");
          return;
        }
        if (!state.saleExecuted) {
          toast("매각 실행 완료 후부터 정산할 수 있습니다.");
          return;
        }
        if (!(state.vaultRemainRaw > 0n)) {
          toast("남은 교환 가능액이 없습니다.");
          return;
        }
        if (!(state.myBalRaw > 0n)) {
          toast("교환 가능한 보유 토큰이 없습니다.");
          return;
        }

        const qtyStr = normalizeWholeTokenInput(amtEl?.value || "");
        const qtyRaw = wholeTokenStrToRaw(qtyStr);
        if (!(qtyRaw > 0n)) return toast("토큰 입금 수량은 1개 이상 정수만 입력하세요.");
        if (qtyRaw > state.myBalRaw) return toast("보유 토큰이 부족합니다.");

        let receiveRaw = 0n;
        if (qtyRaw > 0n && state.vaultTotalRaw > 0n && state.supplyRaw > 0n) {
          receiveRaw = (qtyRaw * state.vaultTotalRaw) / state.supplyRaw;
        }
        if (!(receiveRaw > 0n)) return toast("예상 수령액을 계산할 수 없습니다.");
        if (receiveRaw > state.vaultRemainRaw) return toast("남은 교환 가능액을 초과합니다.");

        try {
          const r = await api(`/api/sales/${encodeURIComponent(assetId)}/redeem`, {
            method: "POST",
            auth: true,
            body: { tokens: qtyStr },
          });

          toast(`수령 완료: ${fmt.num(r.receive_usdt, 6)} USDT`, "good");

          await loadSale();
          await loadPortfolio();
          await loadHistory();
          if (amtEl) amtEl.value = "";
          recalc();
        } catch (e) {
          toast(e.message || "정산 실패", "bad");
        }
      });
    }

    try {
      const ok = await loadSale();
      if (!ok) return;
      await loadPortfolio();
      await loadHistory();
      recalc();
    } catch (e) {
      setDisabledPage("매각 정보를 불러오지 못했습니다.");
      toast(e.message || "매각 상세 로드 실패", "bad");
    }
  };
})();
