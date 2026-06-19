(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  const COUNTRY_LABEL = {
    KR: "대한민국",
    US: "미국",
    KZ: "카자흐스탄",
    PH: "필리핀",
    GE: "조지아",
    ID: "인도네시아",
    VN: "베트남",
  };

  window.RwaPages["chart"] = async () => {
    const C = window.RwaCore;
    if (!C) throw new Error("RwaCore(core.js)가 로드되지 않았습니다.");

    const sel = C.qs("#chartAssetSelect");
    if (!sel) return;

    const titleEl = C.qs("#chartTitle");
    const lastEl = C.qs("#chartLast");
    const lastAtEl = C.qs("#chartLastAt");
    const chartEl = C.qs("#bigChart");
    const monthlyBody = C.qs("#monthlyOhlc");
    const recentBody = C.qs("#chartRecent");

    const topMarketLink = (() => {
      const links = C.qsa("a.btn.small");
      return links.find((a) => (a.getAttribute("href") || "").includes("markets.html")) || null;
    })();

    const topTradeLink = (() => {
      const links = C.qsa("a.btn.small");
      return links.find((a) => (a.getAttribute("href") || "").includes("trade.html")) || null;
    })();

    const escapeHtml = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const emptyChart = (msg) => {
      if (!chartEl) return;
      chartEl.innerHTML = `
        <div class="center muted" style="height:100%; min-height:160px; display:flex; align-items:center; justify-content:center;">
          ${escapeHtml(msg)}
        </div>
      `;
    };

    const monthKeyByKST = (dateObj) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(dateObj);

      const m = {};
      parts.forEach((p) => {
        m[p.type] = p.value;
      });

      return `${m.year}-${m.month}`;
    };

    const monthOHLCMap = (trades) => {
      const map = new Map();

      for (const t of trades || []) {
        const dt = new Date(t.created_at || t.t);
        if (isNaN(dt)) continue;

        const key = monthKeyByKST(dt);
        const p = Number(t.price || t.p);
        if (!Number.isFinite(p)) continue;

        if (!map.has(key)) {
          map.set(key, { open: p, high: p, low: p, close: p });
        } else {
          const o = map.get(key);
          o.close = p;
          if (p > o.high) o.high = p;
          if (p < o.low) o.low = p;
          map.set(key, o);
        }
      }

      return map;
    };

    const assetsAll = ((await C.getAssetsCached().catch(() => [])) || [])
      .slice()
      .sort((a, b) => (C.statusOrder ? C.statusOrder(a.status) - C.statusOrder(b.status) : 0));

    const markets = (await C.loadMarkets().catch(() => [])) || [];
    const marketIdSet = new Set(markets.map((m) => String(m.assetId || "")));

    // 거래 가능한 자산 우선, 없으면 전체 자산 fallback
    const preferredAssets = assetsAll.filter((a) => marketIdSet.has(String(a.id || "")));
    const assets = preferredAssets.length ? preferredAssets : assetsAll;

    if (!assets.length) {
      sel.innerHTML = `<option value="">자산이 없습니다.</option>`;
      if (titleEl) titleEl.textContent = "표시할 자산이 없습니다.";
      if (lastEl) lastEl.textContent = "-";
      if (lastAtEl) lastAtEl.textContent = "-";
      if (monthlyBody) monthlyBody.innerHTML = `<tr><td colspan="5" class="center muted">자산이 없습니다.</td></tr>`;
      if (recentBody) recentBody.innerHTML = `<tr><td colspan="3" class="center muted">자산이 없습니다.</td></tr>`;
      emptyChart("차트 데이터가 없습니다.");
      return;
    }

    sel.innerHTML = assets
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.id)} · ${escapeHtml(a.name)}</option>`)
      .join("");

    const fromQuery = C.getParam ? C.getParam("id") : null;

    let defaultId = "";

    if (fromQuery && assetsAll.some((a) => a.id === fromQuery)) {
      // query가 있으면 최우선
      if (!assets.some((a) => a.id === fromQuery)) {
        const qAsset = assetsAll.find((a) => a.id === fromQuery);
        if (qAsset) {
          sel.innerHTML =
            `<option value="${escapeHtml(qAsset.id)}">${escapeHtml(qAsset.id)} · ${escapeHtml(qAsset.name)}</option>` +
            sel.innerHTML;
        }
      }
      defaultId = fromQuery;
    } else {
      // 최근 체결이 있는 자산 우선
      const latestMarket = markets
        .filter((m) => m?.last?.at)
        .slice()
        .sort((a, b) => String(b.last.at).localeCompare(String(a.last.at)))[0];

      if (latestMarket?.assetId) {
        defaultId = latestMarket.assetId;
      } else {
        defaultId = assets[0]?.id || "";
      }
    }

    if (defaultId) sel.value = defaultId;

    const render = async () => {
      const id = sel.value || assets[0]?.id || "";
      const a = assetsAll.find((x) => x.id === id) || assets.find((x) => x.id === id);
      if (!a) return;

      const cc = String(a.country_code || "KR").toUpperCase();
      const ccy = String(a.settlement_basis || "KRW").toUpperCase();

      if (titleEl) {
        titleEl.textContent = `${a.id} · ${a.name} (${a.market || "-"}) · ${COUNTRY_LABEL[cc] || cc} · ${ccy}`;
      }

      if (topMarketLink) topMarketLink.setAttribute("href", "markets.html");
      if (topTradeLink) topTradeLink.setAttribute("href", `trade.html?id=${encodeURIComponent(a.id)}`);

      const trades = await C.loadTrades(a.id, 5000).catch(() => []);
      const last = trades.length ? trades[trades.length - 1] : null;

      if (lastEl) lastEl.textContent = last ? `${C.fmt.num(last.price, 4)} USDT` : "-";
      if (lastAtEl) lastAtEl.textContent = last ? C.fmt.time(last.created_at) : "-";

      if (trades.length >= 2) {
        if (chartEl) C.drawLineChart(chartEl, trades);
      } else if (trades.length === 1) {
        emptyChart("체결이 1건만 있어 라인 차트를 표시할 수 없습니다.");
      } else {
        emptyChart("체결 데이터가 없습니다.");
      }

      if (recentBody) {
        const desc = trades.slice().reverse().slice(0, 12);
        recentBody.innerHTML =
          desc.map((r) => `<tr>
            <td>${C.fmt.time(r.created_at)}</td>
            <td class="right">${C.fmt.num(r.price, 4)}</td>
            <td class="right">${C.fmt.num(r.qty, 2)}</td>
          </tr>`).join("") || `<tr><td colspan="3" class="center muted">체결이 없습니다.</td></tr>`;
      }

      if (monthlyBody) {
        const ohlc = monthOHLCMap(trades);
        const keys = Array.from(ohlc.keys())
          .sort((x, y) => (x < y ? 1 : -1))
          .slice(0, 6);

        monthlyBody.innerHTML =
          keys.map((k) => {
            const v = ohlc.get(k);
            return `<tr>
              <td>${escapeHtml(k)}</td>
              <td class="right">${C.fmt.num(v.open, 4)}</td>
              <td class="right">${C.fmt.num(v.high, 4)}</td>
              <td class="right">${C.fmt.num(v.low, 4)}</td>
              <td class="right">${C.fmt.num(v.close, 4)}</td>
            </tr>`;
          }).join("") || `<tr><td colspan="5" class="center muted">월간 데이터가 없습니다.</td></tr>`;
      }
    };

    if (!sel.dataset.bound) {
      sel.dataset.bound = "1";
      sel.addEventListener("change", render);
    }

    await render();
  };
})();