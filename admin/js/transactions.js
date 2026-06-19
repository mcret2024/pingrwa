// public/admin/js/transactions.js
(() => {
  "use strict";

  const { qs, toast, api, bootAdminPage } = window.AdminCore;

  const short = (s) => {
    s = String(s || "");
    if (s.length <= 18) return s;
    return s.slice(0, 8) + "..." + s.slice(-6);
  };

  const esc = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const assetCatalog = new Map([["USDT", "USDT"]]);

  const syncAssetOptions = (rows = []) => {
    const sel = qs("#txAsset");
    if (!sel) return;

    rows.forEach((row) => {
      const code = String(row?.asset || "").trim();
      if (!code) return;
      if (!assetCatalog.has(code)) assetCatalog.set(code, code);
    });

    const prev = String(sel.value || "all");
    const options = ['<option value="all">all</option>'];
    Array.from(assetCatalog.entries())
      .sort((a, b) => {
        if (a[0] === "USDT") return -1;
        if (b[0] === "USDT") return 1;
        return a[0].localeCompare(b[0], "en", { numeric: true, sensitivity: "base" });
      })
      .forEach(([code, label]) => {
        options.push(`<option value="${esc(code)}">${esc(label)}</option>`);
      });
    sel.innerHTML = options.join("");
    sel.value = assetCatalog.has(prev) || prev === "all" ? prev : "all";
  };

  const loadAssetOptions = async () => {
    try {
      const r = await api("/api/assets", { method: "GET" });
      const assets = Array.isArray(r?.assets) ? r.assets : [];
      assets.forEach((asset) => {
        const id = String(asset?.id || "").trim();
        if (!id) return;
        const name = String(asset?.name || "").trim();
        assetCatalog.set(id, name ? `${id} · ${name}` : id);
      });
    } catch (_) {
    }
    syncAssetOptions();
  };

  // ? MySQL DATETIME(UTC로 저장된 값)을 KST로 출력: YYYY-MM-DD HH:mm:ss
  const toDateUtc = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;

    const s = String(v).trim();
    if (!s) return null;

    // "YYYY-MM-DD HH:mm:ss" 형태면 UTC로 간주해서 Z 붙임
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
      return new Date(s.replace(" ", "T") + "Z");
    }

    // 이미 ISO(Z 포함) 또는 기타는 기본 파서 사용
    return new Date(s);
  };

  const fmtKst = (v) => {
    const d = toDateUtc(v);
    if (!d || isNaN(d)) return v ? String(v) : "-";

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

  const fetchList = async () => {
    const kind = String(qs("#txKind")?.value || "all").trim();
    const status = String(qs("#txStatus")?.value || "all").trim();
    const asset = String(qs("#txAsset")?.value || "all").trim();
    const q = String(qs("#txQ")?.value || "").trim();

    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    if (status !== "all") params.set("status", status);
    if (asset !== "all") params.set("asset", asset);
    if (q) params.set("q", q);
    params.set("limit", "200");

    const r = await api(`/api/admin/wallet/transactions?${params.toString()}`, { method: "GET" });

    const rows = Array.isArray(r.rows) ? r.rows : [];
    syncAssetOptions(rows);
    const tb = qs("#txRows");
    if (!tb) return;

    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="9" class="center muted">내역이 없습니다.</td></tr>`;
      return;
    }

    tb.innerHTML = rows.map((x) => {
      const txid = x.txid ? String(x.txid) : "";
      const txCell = txid
        ? `<a class="mono" target="_blank" rel="noopener" href="https://solscan.io/tx/${encodeURIComponent(txid)}" style="color:var(--link);font-weight:900;text-decoration:none">${esc(short(txid))}</a>`
        : "-";

      // ? KST로 표시
      const tKst = fmtKst(x.created_at);

      return `
        <tr>
          <td class="mono">${esc(x.id)}</td>
          <td class="mono">${esc(x.kind)}</td>
          <td>${esc(x.status)}</td>
          <td class="mono">${esc(String(x.asset || "-"))}</td>
          <td class="mono">${esc(short(x.address))}</td>
          <td class="right mono">${Number(x.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</td>
          <td>${txCell}</td>
          <td class="mono">${esc(String(x.memo || "").slice(0, 80))}</td>
          <td class="mono timecol">${esc(tKst)}</td>
        </tr>
      `;
    }).join("");
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("transactions");
    if (!me) return;

    await loadAssetOptions();

    qs("#txRefreshBtn")?.addEventListener("click", fetchList);
    qs("#txKind")?.addEventListener("change", fetchList);
    qs("#txStatus")?.addEventListener("change", fetchList);
    qs("#txAsset")?.addEventListener("change", fetchList);
    qs("#txQ")?.addEventListener("keydown", (e) => { if (e.key === "Enter") fetchList(); });

    await fetchList();
  });
})();