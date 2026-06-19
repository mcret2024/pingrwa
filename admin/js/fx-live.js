(() => {
  "use strict";

  const { qs, api, toast, bootAdminPage, fmtNum } = window.AdminCore;

  const parseDateSafe = (v) => {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;

    const s = String(v).trim();
    if (!s) return null;

    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    d = new Date(s.replace(" ", "T"));
    if (!isNaN(d.getTime())) return d;

    const m = s.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (!m) return null;

    const yy = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const dd = Number(m[3]);
    const hh = Number(m[4] || 0);
    const mi = Number(m[5] || 0);
    const ss = Number(m[6] || 0);

    d = new Date(yy, mm, dd, hh, mi, ss);
    if (!isNaN(d.getTime())) return d;

    return null;
  };

  const fmtTime = (s) => {
    const d = parseDateSafe(s);
    if (!d) return "-";
    return d.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const drawLineChart = (container, series) => {
    if (!container) return;

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 90;
    const pad = 10;

    const pts = (series || [])
      .map((r) => {
        const d = parseDateSafe(r.fetched_at);
        return [d ? d.getTime() : NaN, Number(r.rate)];
      })
      .filter((x) => Number.isFinite(x[0]) && Number.isFinite(x[1]))
      .sort((a, b) => a[0] - b[0]);

    container.innerHTML = "";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.width = "100%";
    svg.style.height = "100%";
    container.appendChild(svg);

    if (pts.length < 2) return;

    const minX = pts[0][0];
    const maxX = pts[pts.length - 1][0];
    const minY = Math.min(...pts.map((p) => p[1]));
    const maxY = Math.max(...pts.map((p) => p[1]));
    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;

    const mapX = (x) => pad + (w - pad * 2) * ((x - minX) / rangeX);
    const mapY = (y) => pad + (h - pad * 2) * (1 - (y - minY) / rangeY);

    const path = document.createElementNS(svgNS, "path");
    let d = "";
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      d += (i === 0 ? `M ${mapX(x)} ${mapY(y)}` : ` L ${mapX(x)} ${mapY(y)}`);
    }

    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgba(110,231,255,.95)");
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("fxlive");
    if (!me) return;

    const statusEl = qs("#fxStatus");
    const refreshBtn = qs("#fxLiveRefreshBtn");

    const tbody = qs("#fxTbody");

    const ccySel = qs("#fxCcySel");
    const limitEl = qs("#fxHistLimit");
    const histTbody = qs("#fxHistTbody");
    const sparkEl = qs("#fxSpark");

    const loadLive = async () => {
      const r = await api("/api/admin/fx/live", { method: "GET" });

      const lastAt = r.last_at ? fmtTime(r.last_at) : "-";
      const mode = String(r.mode || "-");
      const provider = String(r.provider || "-");
      const lastOk = r.worker_last_success_at ? fmtTime(r.worker_last_success_at) : "-";
      const lastErr = r.worker_last_error ? String(r.worker_last_error) : "-";

      if (statusEl) {
        statusEl.textContent = `mode=${mode} · provider=${provider} · latest=${lastAt} · worker_ok=${lastOk} · last_error=${lastErr}`;
      }

      const fx = r.fx_rates || {};
      const latestMap = new Map((r.latest || []).map((x) => [String(x.quote_currency).toUpperCase(), x]));
      const settingsUpdatedAt = r.settings_updated_at || {};

      const order = ["KRW", "USD", "KZT", "PHP", "GEL", "IDR", "VND"];

      tbody.innerHTML = order.map((ccy) => {
        const v = Number(fx[ccy] || 0);
        const latestRow = latestMap.get(ccy);
        const updatedAt = settingsUpdatedAt[ccy] || latestRow?.fetched_at || null;
        const at = updatedAt ? fmtTime(updatedAt) : "-";

        return `<tr>
          <td><strong>${ccy}</strong></td>
          <td class="right">${fmtNum(v, 6)}</td>
          <td class="right">${at}</td>
        </tr>`;
      }).join("");
    };

    const loadHistory = async () => {
      const ccy = String(ccySel?.value || "KRW").toUpperCase();
      const limit = Math.min(2000, Math.max(10, Number(limitEl?.value || 240)));

      const r = await api(`/api/admin/fx/history?ccy=${encodeURIComponent(ccy)}&limit=${encodeURIComponent(limit)}`, {
        method: "GET"
      });

      const rows = Array.isArray(r.rows) ? r.rows : [];

      if (histTbody) {
        histTbody.innerHTML =
          rows.slice().reverse().slice(0, 100).reverse().map((x) => `
            <tr>
              <td>${fmtTime(x.fetched_at)}</td>
              <td class="right">${fmtNum(x.rate, 6)}</td>
              <td class="right">${x.provider || "-"}</td>
            </tr>
          `).join("") || `<tr><td colspan="3" class="center muted">데이터 없음</td></tr>`;
      }

      if (sparkEl) {
        drawLineChart(sparkEl, rows.slice(-120));
      }
    };

    refreshBtn?.addEventListener("click", async () => {
      try {
        await loadLive();
        await loadHistory();
        toast("새로고침 완료", "good");
      } catch (e) {
        toast(e.message || "실패", "bad");
      }
    });

    ccySel?.addEventListener("change", loadHistory);

    limitEl?.addEventListener("input", () => {
      clearTimeout(loadHistory._t);
      loadHistory._t = setTimeout(loadHistory, 250);
    });

    await loadLive();
    await loadHistory();
  });
})();