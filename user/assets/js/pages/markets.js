(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  window.RwaPages["markets"] = async () => {
    const C = window.RwaCore;
    if (!C) throw new Error("RwaCore(core.js)가 로드되지 않았습니다.");

    const sel = C.qs("#marketSelect");
    const search = C.qs("#marketSearch");
    const tbody = C.qs("#marketList");

    if (!sel || !tbody) return;

    const FALLBACK_IMG = C.absUrl ? C.absUrl("assets/images/logo.svg") : "/assets/images/logo.svg";

    const escapeHtml = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const tradeSeriesCache = new Map();

    const sparklineSVG = (values) => {
      const w = 160;
      const h = 44;
      const pad = 5;

      if (!Array.isArray(values) || values.length < 2) {
        return `<div class="sparkline"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><text x="50%" y="55%" text-anchor="middle" font-size="12" fill="rgba(255,255,255,.35)">-</text></svg></div>`;
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = (max - min) || 1;
      const step = (w - pad * 2) / Math.max(1, values.length - 1);

      const pts = values.map((v, i) => {
        const x = pad + (step * i);
        const y = pad + ((h - pad * 2) * (1 - ((v - min) / range)));
        return [x, y];
      });

      const d = pts
        .map((p, i) => (i === 0 ? `M ${p[0].toFixed(2)} ${p[1].toFixed(2)}` : `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`))
        .join(" ");

      return `<div class="sparkline"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="rgba(110,231,255,.95)" stroke-width="2" stroke-linecap="round" /></svg></div>`;
    };

    const getTradesCached = async (assetId) => {
      if (tradeSeriesCache.has(assetId)) return tradeSeriesCache.get(assetId);

      const trades = await C.loadTrades(assetId).catch(() => []);
      const prices = (trades || [])
        .map((x) => Number(x.price))
        .filter((n) => Number.isFinite(n));

      tradeSeriesCache.set(assetId, prices);
      return prices;
    };

    const [assetsAll, marketsRaw] = await Promise.all([
      C.getAssetsCached().catch(() => []),
      C.loadMarkets().catch(() => []),
    ]);

    const assetsMap = new Map(
      (assetsAll || []).map((a) => [String(a.id || "").trim(), a])
    );

    const mergedAll = (marketsRaw || [])
      .map((m) => {
        const assetId = String(m.assetId || m.id || "").trim();
        const a = assetsMap.get(assetId) || {};

        return {
          id: assetId,
          assetId,
          market: m.market || a.market || `${assetId}/USDT`,
          name: m.name || a.name || assetId,
          status: m.status || a.status || "-",
          country_code: m.country_code || a.country_code || "KR",
          settlement_basis: m.settlement_basis || a.settlement_basis || "KRW",
          image_url: a.image_url || "",
          token_image_url: a.token_image_url || "",
          location: a.location || "",
          last_price: Number(m.last_price ?? m.last?.price ?? 0) || null,
          best_bid: Number(m.best_bid ?? 0) || null,
          best_ask: Number(m.best_ask ?? 0) || null,
          volume_24h: Number(m.volume_24h ?? 0) || 0,
          month: m.month || null,
        };
      })
      .filter((x) => !!x.id)
      .sort((a, b) => {
        const so = C.statusOrder(a.status) - C.statusOrder(b.status);
        if (so !== 0) return so;
        return String(a.id).localeCompare(String(b.id), "en", { numeric: true, sensitivity: "base" });
      });

    sel.innerHTML =
      `<option value="ALL">전체</option>` +
      mergedAll
        .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.id)} · ${escapeHtml(a.name)}</option>`)
        .join("");

    const render = async () => {
      const pickId = String(sel.value || "ALL");
      const q = String(search?.value || "").trim().toLowerCase();

      const list = mergedAll.filter((a) => {
        if (pickId !== "ALL" && a.id !== pickId) return false;

        if (q) {
          const hay = [
            a.id,
            a.name,
            a.market,
            a.location,
            a.country_code,
            a.settlement_basis,
          ]
            .join(" ")
            .toLowerCase();

          if (!hay.includes(q)) return false;
        }

        return true;
      });

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="center muted">표시할 자산이 없습니다.</td></tr>`;
        return;
      }

      await Promise.all(list.map((a) => getTradesCached(a.id)));

      tbody.innerHTML = list
        .map((a) => {
          const lastPrice = Number.isFinite(Number(a?.last_price)) && Number(a?.last_price) > 0 ? Number(a.last_price) : null;
          const bestAsk = Number.isFinite(Number(a?.best_ask)) && Number(a?.best_ask) > 0 ? Number(a.best_ask) : null;
          const bestBid = Number.isFinite(Number(a?.best_bid)) && Number(a?.best_bid) > 0 ? Number(a.best_bid) : null;

          let monthText = "-";
          if (a.month && a.month.open != null && a.month.close != null) {
            const open = Number(a.month.open);
            const close = Number(a.month.close);
            const change = open ? (((close - open) / open) * 100) : 0;
            const sign = change >= 0 ? "+" : "";
            monthText = `${C.fmt.num(close, 4)} (${sign}${C.fmt.num(change, 2)}%)`;
          }

          const prices = (tradeSeriesCache.get(a.id) || []).slice(-18);
          const spark = sparklineSVG(prices);

          const imgUrl = a.image_url ? (C.absUrl ? C.absUrl(a.image_url) : a.image_url) : FALLBACK_IMG;
          const tokenUrl = a.token_image_url ? (C.absUrl ? C.absUrl(a.token_image_url) : a.token_image_url) : FALLBACK_IMG;

          const countryLabel =
            typeof C.labelCountry === "function"
              ? C.labelCountry(a.country_code)
              : String(a.country_code || "-").toUpperCase();

          const currencyLabel =
            typeof C.labelCurrency === "function"
              ? C.labelCurrency(a.settlement_basis)
              : String(a.settlement_basis || "-").toUpperCase();

          const imgAlt = `${a.name} 이미지`;
          const tokenAlt = `${a.id} 토큰 이미지`;

          return `
            <tr>
              <td>
                <img
                  class="table-thumb"
                  src="${escapeHtml(imgUrl)}"
                  alt="${escapeHtml(imgAlt)}"
                  loading="lazy"
                  onerror="this.onerror=null;this.src='${escapeHtml(FALLBACK_IMG)}';"
                >
              </td>

              <td>
                <div style="display:flex; align-items:center; gap:10px">
                  <img
                    class="token-thumb"
                    src="${escapeHtml(tokenUrl)}"
                    alt="${escapeHtml(tokenAlt)}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${escapeHtml(FALLBACK_IMG)}';"
                  >
                  <div>
                    <div style="font-weight:950">${escapeHtml(a.market)}</div>
                    <div class="small-note">${escapeHtml(a.name)}</div>
                    <div class="small-note">${escapeHtml(countryLabel)} · ${escapeHtml(currencyLabel)}</div>
                  </div>
                </div>
              </td>

              <td>${spark}</td>

              <td class="right">
                ${lastPrice != null
                  ? `${C.fmt.num(lastPrice, 4)} USDT`
                  : (bestAsk != null
                      ? `<div>${C.fmt.num(bestAsk, 4)} USDT</div><div class="small-note">매도호가</div>`
                      : (bestBid != null
                          ? `<div>${C.fmt.num(bestBid, 4)} USDT</div><div class="small-note">매수호가</div>`
                          : "-"))}
              </td>

              <td class="right">${monthText !== "-" ? monthText : (bestBid != null || bestAsk != null ? `<div>${bestBid != null ? `매수 ${C.fmt.num(bestBid, 4)}` : '-'}</div><div>${bestAsk != null ? `매도 ${C.fmt.num(bestAsk, 4)}` : '-'}</div>` : "-")}</td>

              <td class="right">
                <a class="btn small" href="trade.html?id=${encodeURIComponent(a.id)}">거래</a>
                <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">상세</a>
              </td>
            </tr>
          `;
        })
        .join("");
    };

    if (!sel.dataset.bound) {
      sel.dataset.bound = "1";
      sel.addEventListener("change", render);
    }

    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      search.addEventListener("input", render);
    }

    await render();
  };
})();