// public/assets/js/pages/sales.js
(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  window.RwaPages["sales"] = async () => {
    const C = window.RwaCore;
    if (!C) throw new Error("RwaCore(core.js)가 로드되지 않았습니다.");

    const el = C.qs("#salesList");
    if (!el) return;

    const api = (path, opt) => C.api(path, opt);
    const toast = (msg, kind = "info") =>
      (typeof C.toast === "function" ? C.toast(msg, kind) : console.log(kind, msg));

    const fmt = C.fmt || {
      num(n, d = 0) {
        const x = Number(n);
        return Number.isFinite(x) ? x.toFixed(d) : "-";
      }
    };

    const getWallet = () =>
      (typeof C.getWallet === "function" ? C.getWallet() : { connected: false, token: null });

    const statusBadge = (s) =>
      (typeof C.statusBadge === "function"
        ? C.statusBadge(s)
        : `<span class="badge neutral">${s || "-"}</span>`);

    const numFmt = (n, d = 0) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return fmt.num(x, d);
    };

    const signedNumFmt = (n, d = 0) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return x < 0 ? `-${fmt.num(Math.abs(x), d)}` : fmt.num(x, d);
    };

    const pctFmt = (n, d = 2) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return `${signedNumFmt(x, d)}%`;
    };

    const w = getWallet();

    let pf = null;
    let portfolioReady = false;
    let portfolioAuthFailed = false;

    if (w.connected && w.token) {
      try {
        pf = await api("/api/portfolio", { method: "GET", auth: true });
        portfolioReady = true;
      } catch {
        pf = null;
        portfolioAuthFailed = true;
      }
    }

    const myMap = new Map();
    (pf?.holdings || []).forEach((h) => myMap.set(h.asset_id, h));

    let list = [];
    try {
      const data = await api("/api/sales", { auth: false });
      list = data.rows || data.sales || [];
    } catch (e) {
      toast(e.message || "매각 목록 로드 실패", "bad");
      el.innerHTML = `<div class="muted">매각 정보를 불러오지 못했습니다.</div>`;
      return;
    }

    if (!list.length) {
      el.innerHTML = `<div class="muted">매각 완료된 자산이 없습니다.</div>`;
      return;
    }

    const cards = list.map((row) => {
      const assetId = String(row.id || row.asset_id || "").trim();
      const ccy = String(row.settlement_basis || "KRW").toUpperCase();
      const tokenSymbol = String(row.token_symbol || assetId || "TOKEN").trim().toUpperCase() || "TOKEN";
      const supply = Number(row.supply_token || 0);
      const fundedUsdt = Number(row.funded_snapshot_usdt || 0);
      const vaultTotalUsdt = Number(row.vault_total_usdt || 0);
      const investorLocal = Number(row.investor_payout_settlement || 0);
      const tokenUnitUsdt = Number(row.token_unit_usdt || 0);
      const tokenUnitLocal = Number(row.token_unit_local || row.token_unit_settlement || 0);
      const lockedFx = Number(row.fixed_fx_per_usdt || row.display_fx_per_usdt || 0);
      const pct = fundedUsdt > 0 ? ((vaultTotalUsdt - fundedUsdt) / fundedUsdt) * 100 : 0;
      const redeemPriceUsdt = tokenUnitUsdt > 0
        ? tokenUnitUsdt
        : ((supply > 0 && vaultTotalUsdt > 0) ? (vaultTotalUsdt / supply) : null);
      const redeemPriceLocal = tokenUnitLocal > 0
        ? tokenUnitLocal
        : ((redeemPriceUsdt != null && lockedFx > 0)
            ? (redeemPriceUsdt * lockedFx)
            : ((supply > 0 && investorLocal !== 0) ? (investorLocal / supply) : null));
      const mine = myMap.get(assetId);
      const myBal = mine ? Number(mine.balance_token || 0) : 0;

      const imgUrl = C.assetImageUrl ? C.assetImageUrl(row.image_url || "") : (C.absUrl ? C.absUrl(row.image_url || "") : (row.image_url || ""));
      const tokUrl = C.tokenImageUrl ? C.tokenImageUrl(row.token_image_url || "") : (C.absUrl ? C.absUrl(row.token_image_url || "") : (row.token_image_url || ""));

      const holdingBox = (() => {
        if (!w.connected) {
          return `<div class="small-note" style="margin-top:10px">지갑을 연결하면 내 보유수량이 표시됩니다.</div>`;
        }

        if (!portfolioReady) {
          return `<div class="small-note" style="margin-top:10px">지갑 인증 후 내 보유수량을 불러옵니다.</div>`;
        }

        return `<div class="notice" style="margin-top:10px">
                  <strong>내 교환 가능</strong><br>
                  ${numFmt(myBal, 0)} ${tokenSymbol}
                </div>`;
      })();

      return `<div class="card asset-card profit-card">
        <div class="thumb"><img src="${imgUrl}" alt="${row.name || row.id}"></div>
        <div class="pad">
          <div class="tagrow">
            ${statusBadge(String(row.status || "매각").trim() || "매각")}
            <span class="chip"><img src="${tokUrl}" alt="">${row.market || ""}</span>
            <span class="badge neutral">${ccy}</span>
          </div>

          <h3 style="margin-top:10px">${row.name || assetId}</h3>

          <div style="margin-top:10px" class="profit-big">
            ${pctFmt(pct, 2)} <small>플랫폼 유저 기준 수익률</small>
          </div>

          <div class="notice" style="margin-top:10px">
            <strong>토큰당 교환금액</strong><br>
            ${
              redeemPriceUsdt == null
                ? `<span class="small-note">발행 수량 정보가 없어 계산할 수 없습니다.</span>`
                : `1 ${tokenSymbol} = ${numFmt(redeemPriceUsdt, 2)} USDT`
            }
            ${
              redeemPriceLocal == null || ccy === "USDT"
                ? ""
                : `<div class="small-note" style="margin-top:4px">토큰당 교환단가(현지통화): 1 ${tokenSymbol} = ${numFmt(redeemPriceLocal, 2)} ${ccy}</div>`
            }
            <div class="small-note" style="margin-top:4px">플랫폼 유저 할당총액: ${numFmt(vaultTotalUsdt, 2)} USDT</div>
          </div>

          ${holdingBox}

          <div class="tagrow" style="margin-top:12px">
            <a class="btn small primary" href="sale-detail.html?id=${encodeURIComponent(assetId)}">매각 자산 교환</a>
            <a class="btn small" href="ir.html?id=${encodeURIComponent(assetId)}">상세</a>
          </div>
        </div>
      </div>`;
    });

    el.innerHTML = cards.join("");

    if (portfolioAuthFailed) {
      toast("내 보유수량 표시는 지갑 인증 완료 후 가능합니다.", "info");
    }
  };
})();
