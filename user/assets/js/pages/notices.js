/* public/assets/js/pages/notices.js
 *
 * (2026-05-11 v270) Operator: 'ir 메뉴 아래에 공지 메뉴를 추가하고,
 * 연간(또는 분기별) 회계 자료를 유저가 볼 수 있도록 …'. This handler
 * renders the user-facing /user/notices.html page: pulls notices via
 * GET /api/notices, builds category-filter tabs, and lists each row
 * with title / period / date / download link.
 */
(() => {
  "use strict";
  const C = window.RwaCore;

  window.RwaPages = window.RwaPages || {};

  const getLang = () => {
    try {
      const l = String(document.documentElement.getAttribute("data-rwa-lang") || "en").toLowerCase();
      return l === "ko" ? "ko" : "en";
    } catch (_) { return "en"; }
  };

  const CATEGORY_LABELS = {
    accounting_annual:    { ko: "연간 회계", en: "Annual Reports" },
    accounting_quarterly: { ko: "분기 회계", en: "Quarterly Reports" },
    general:              { ko: "일반 공지", en: "General Notices" },
  };
  const ALL_KEY = "__all__";

  const escAttr = (s) => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const safeDocHref = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (s.startsWith("/uploads/")) return s;
    if (/^https?:\/\//i.test(s)) return s;
    return "";
  };

  const fmtDate = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    return s.slice(0, 10);
  };

  let allNotices = [];
  let activeFilter = ALL_KEY;
  let serverCategories = {};

  const renderTabs = () => {
    const lang = getLang();
    const tabsEl = document.getElementById("noticesTabs");
    if (!tabsEl) return;

    // Build tab list: '전체' + each category in NOTICE_CATEGORIES order.
    const cats = Object.keys(serverCategories).length
      ? Object.keys(serverCategories)
      : Object.keys(CATEGORY_LABELS);

    const tabs = [
      { key: ALL_KEY, label: lang === "ko" ? "전체" : "All" },
      ...cats.map(k => ({
        key: k,
        label: (CATEGORY_LABELS[k]?.[lang]) || serverCategories[k] || k,
      })),
    ];

    tabsEl.innerHTML = tabs.map(t => `
      <button class="notices-tab${t.key === activeFilter ? ' active' : ''}"
              type="button" data-cat="${escAttr(t.key)}">${escAttr(t.label)}</button>
    `).join("");

    tabsEl.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-cat") || ALL_KEY;
        if (k === activeFilter) return;
        activeFilter = k;
        renderTabs();
        renderList();
      });
    });
  };

  const renderList = () => {
    const listEl = document.getElementById("noticesList");
    if (!listEl) return;
    const lang = getLang();

    const filtered = activeFilter === ALL_KEY
      ? allNotices
      : allNotices.filter(n => String(n.category) === activeFilter);

    if (!filtered.length) {
      listEl.innerHTML = `<div class="notices-empty">${
        lang === "ko" ? "표시할 공지가 없습니다." : "No notices to display."
      }</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(n => {
      const href = safeDocHref(n.file_path);
      const period = String(n.period || "").trim();
      const dateText = fmtDate(n.notice_date) || fmtDate(n.created_at);
      const catLabel = (CATEGORY_LABELS[n.category]?.[lang]) || n.category_label || n.category;
      const body = String(n.body || "").trim();
      const dlLabel = lang === "ko" ? "다운로드 ↓" : "Download ↓";
      return `<div class="notice-card">
        <div>
          <div class="notice-period">${escAttr(period || dateText || "—")}</div>
          <span class="notice-cat-badge">${escAttr(catLabel)}</span>
        </div>
        <div class="notice-body">
          <div class="notice-title">${escAttr(n.title || "")}</div>
          <div class="notice-meta">${escAttr(dateText)}${
            period && dateText ? ` · ${escAttr(period)}` : ""
          }</div>
          ${body ? `<div class="notice-body-text">${escAttr(body)}</div>` : ""}
        </div>
        <div class="notice-actions">
          ${href
            ? `<a class="notice-dl" href="${escAttr(href)}" target="_blank" rel="noopener">${dlLabel}</a>`
            : `<span class="notice-meta">${lang === "ko" ? "(파일 없음)" : "(no file)"}</span>`}
        </div>
      </div>`;
    }).join("");
  };

  window.RwaPages["notices"] = async () => {
    // Localize the heading / subtitle.
    const lang = getLang();
    const heading = document.getElementById("noticesHeading");
    const subtitle = document.getElementById("noticesSubtitle");
    if (heading)  heading.textContent  = lang === "ko" ? "공지" : "Notices";
    if (subtitle) subtitle.textContent = lang === "ko"
      ? "연간 / 분기 회계 자료 및 일반 공지를 확인하세요."
      : "Annual / quarterly accounting reports and general announcements.";
    try { document.title = (lang === "ko" ? "공지" : "Notices") + " · SilicaChain"; } catch (_) {}

    let data = null;
    try {
      data = await C.api("/api/notices", { auth: false });
    } catch (e) {
      console.warn("[notices] /api/notices failed:", e?.message || e);
    }
    allNotices = Array.isArray(data?.notices) ? data.notices : [];
    serverCategories = data?.categories || {};
    renderTabs();
    renderList();
  };
})();
