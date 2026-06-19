/* public/assets/js/pages/ir.js
 *
 * (2026-05-11 v249) Operator: 'ir.html, asset-detail.html 이 두 페이지를
 * 합치고 asset-detail.html 를 제거해줘.' This file is the merged-page
 * handler — it does what the old pages/asset-detail.js did (bind the
 * single asset record into the mine-detail eyebrow / title / hero
 * description / Mine Site visuals block / License No. / Jurisdiction)
 * AND coexists with the static IR sections at the bottom of the same
 * page (Document Library / Roadmap / Key Milestones — no JS needed).
 *
 * Static mine-spec cards (271 ha / 97.04% / 30.68M tons / Application
 * Areas / Investment Contract / IR sections) stay hardcoded — they're
 * product positioning + investor material, not DB-stored values.
 */
(() => {
  "use strict";
  const C = window.RwaCore;

  window.RwaPages = window.RwaPages || {};

  const COUNTRY_LABEL = {
    KR: { ko: "대한민국", en: "Republic of Korea" },
    US: { ko: "미국", en: "United States" },
    KZ: { ko: "카자흐스탄", en: "Kazakhstan" },
    PH: { ko: "필리핀", en: "Philippines" },
    GE: { ko: "조지아", en: "Georgia" },
    ID: { ko: "인도네시아", en: "Indonesia" },
    VN: { ko: "베트남", en: "Vietnam" },
  };

  // Status badge labels for the eyebrow line (Bebas Neue caps).
  const STATUS_BADGE_EN = {
    "모집중":    "LIVE FUNDING",
    "구매진행":  "ACQUIRING",
    "분배중":    "DISTRIBUTING",
    "운영중":    "LIVE",
    "활성":      "LIVE",
    "매각":      "REDEEMED",
    "모집실패":  "FAILED",
    "취소됨":    "CANCELLED",
  };
  // Korean status labels — DB usually stores Korean already; map kept
  // explicit so off-by-one strings (e.g. 'Active' coming back from
  // backend in mixed case) still resolve cleanly.
  const STATUS_BADGE_KO = {
    "모집중":    "모집중",
    "구매진행":  "매입 진행중",
    "분배중":    "분배중",
    "운영중":    "운영중",
    "활성":      "운영중",
    "매각":      "매각",
    "모집실패":  "모집 실패",
    "취소됨":    "취소됨",
  };

  const getLang = () => {
    try {
      const l = String(document.documentElement.getAttribute("data-rwa-lang") || "en").toLowerCase();
      return l === "ko" ? "ko" : "en";
    } catch (_) { return "en"; }
  };

  // Default to SILICA-79907 since this is a single-asset site. Any
  // existing deep-link of the form ir.html?id=XXX still works.
  const getAssetIdFromUrl = () => {
    try {
      const params = new URLSearchParams(location.search);
      const id = (params.get("id") || "").trim();
      if (id) return id;
    } catch (_) { /* fall through */ }
    return "SILICA-79907";
  };

  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(txt ?? "");
  };

  // Allow http(s) absolute or root-relative paths only — stop
  // javascript:/data: payloads from sneaking into <img src>.
  // (2026-05-26 v849) /uploads/ → /api/file/ swap (core.js absUrl 과 동일 패턴).
  const safeImageUrl = (raw) => {
    let s = String(raw || "").trim();
    if (!s) return "";
    if (s.startsWith('/uploads/')) s = '/api/file/' + s.substring('/uploads/'.length);
    else if (s.startsWith('uploads/')) s = '/api/file/' + s.substring('uploads/'.length);
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return s;
    return "";
  };

  // HTML-escape attribute values used inside template-literal src=""
  // since the URL may come from operator-uploaded values.
  const escAttr = (s) => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  // (2026-05-11 v268) Pull a Google-Maps embed URL out of whatever the
  //   operator pasted into asset.google_map_url. The field accepts the
  //   full <iframe src="..."> HTML snippet that Maps' '공유 → 지도
  //   퍼가기' button produces, so we extract just the src= URL. Only
  //   https://www.google.com/maps/... URLs are accepted to prevent the
  //   field from being used to inject arbitrary third-party iframes.
  const extractGoogleMapSrc = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    const m = s.match(/src=["']([^"']+)["']/i);
    const url = m ? m[1] : s;
    if (/^https:\/\/(www\.)?google\.com\/maps\//i.test(url)) return url;
    return "";
  };

  // (2026-05-11 v269) Document category catalog for the Document
  //   Library. Order matches admin_assets.php DOC_CATEGORIES so the
  //   admin UI and the IR page line up visually. Sale categories
  //   (sale / sale_proof) are excluded — they're surfaced on the
  //   매각 관리 / sale-detail flow, not the funding IR page.
  const IR_DOC_CATEGORIES = [
    { key: 'registry',   icon: '📋', ko: '등기부등본',  en: 'Property Registry' },
    { key: 'valuation',  icon: '📊', ko: '자산평가서',  en: 'Asset Valuation Report' },
    { key: 'accounting', icon: '💼', ko: '회계자료',    en: 'Accounting Records' },
    { key: 'official1',  icon: '⚖️', ko: '공식문서 1',  en: 'Official Document 1' },
    { key: 'official2',  icon: '📜', ko: '공식문서 2',  en: 'Official Document 2' },
    { key: 'proof',      icon: '🔬', ko: '증빙문서',    en: 'Supporting Documents' },
    { key: 'general',    icon: '📄', ko: '일반문서',    en: 'General Documents' },
  ];

  // Allow /uploads/... (relative) or absolute http(s)://… file_paths.
  //   Everything else is treated as missing — keeps a misconfigured DB
  //   row from emitting <a href="javascript:…"> or weird schemes.
  const safeDocHref = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (s.startsWith("/uploads/")) return s;
    if (/^https?:\/\//i.test(s)) return s;
    return "";
  };

  const fmtDocDate = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    // ISO yyyy-mm-dd or yyyy-mm-dd hh:mm:ss → just the date portion.
    return s.slice(0, 10);
  };

  const fmtDocAmount = (raw, ccy = 'USDT') => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return "";
    const s = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return `${s} ${ccy}`;
  };

  /* (2026-05-11 v276) Detail-image lightbox controller.
     setupLightbox(urls) is called after the gallery renders. It wires
     thumbnail clicks (intercept the anchor's default navigation), the
     close button, the prev/next buttons, backdrop click, and key
     bindings (Esc / ←/→). Calling it again on a fresh asset rebinds
     the urls list — older listeners are detached via the `_bound`
     guard so we don't pile up handlers across re-renders. */
  let lightboxState = null;
  const setupLightbox = (urls) => {
    const overlay  = document.getElementById("adetLightbox");
    const imgEl    = document.getElementById("adetLightboxImg");
    const btnClose = document.getElementById("adetLightboxClose");
    const btnPrev  = document.getElementById("adetLightboxPrev");
    const btnNext  = document.getElementById("adetLightboxNext");
    const counter  = document.getElementById("adetLightboxCounter");
    const gallery  = document.getElementById("adetGallery");
    if (!overlay || !imgEl || !gallery) return;

    lightboxState = { urls: Array.isArray(urls) ? urls.slice() : [], idx: 0 };

    const updateNav = () => {
      const total = lightboxState.urls.length;
      const show = total > 1;
      if (btnPrev) btnPrev.style.display = show ? "" : "none";
      if (btnNext) btnNext.style.display = show ? "" : "none";
      if (counter) counter.textContent = show ? `${lightboxState.idx + 1} / ${total}` : "";
    };
    const showAt = (i) => {
      const total = lightboxState.urls.length;
      if (!total) return;
      lightboxState.idx = ((i % total) + total) % total;
      imgEl.src = lightboxState.urls[lightboxState.idx];
      imgEl.alt = `Detail image ${lightboxState.idx + 1}`;
      updateNav();
    };
    const open = (i) => {
      if (!lightboxState.urls.length) return;
      showAt(i);
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      // Free the cached image so the browser doesn't keep huge bitmaps in RAM.
      imgEl.src = "";
    };
    const next = () => showAt(lightboxState.idx + 1);
    const prev = () => showAt(lightboxState.idx - 1);

    // One-time bindings — keyed off a data attribute so re-renders of
    // the gallery don't stack duplicate handlers.
    if (overlay.dataset.bound !== "1") {
      overlay.dataset.bound = "1";
      btnClose?.addEventListener("click", close);
      btnPrev?.addEventListener("click", (e) => { e.stopPropagation(); prev(); });
      btnNext?.addEventListener("click", (e) => { e.stopPropagation(); next(); });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();   // Backdrop click only.
      });
      document.addEventListener("keydown", (e) => {
        if (!overlay.classList.contains("open")) return;
        if (e.key === "Escape")     { e.preventDefault(); close(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        else if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
      });
    }

    // Gallery click delegation — replaces the old new-tab anchor.
    if (gallery.dataset.lbBound !== "1") {
      gallery.dataset.lbBound = "1";
      gallery.addEventListener("click", (e) => {
        const a = e.target.closest("a[data-lightbox-idx]");
        if (!a) return;
        e.preventDefault();
        const i = parseInt(a.getAttribute("data-lightbox-idx"), 10) || 0;
        open(i);
      });
    }
  };

  window.RwaPages["ir"] = async () => {
    const assetId = getAssetIdFromUrl();
    const lang = getLang();

    let data;
    try {
      data = await C.api(`/api/assets/${encodeURIComponent(assetId)}`, { auth: false });
    } catch (e) {
      // 404 / network error — leave fallback static text so the page
      // is still readable. The IR sections below are entirely static
      // and will render regardless.
      console.warn(`[ir] /api/assets/${assetId} failed:`, e?.message || e);
      setText("adetId", `◆ MINE · ${assetId}`);
      return;
    }

    const a = data?.asset || {};
    const keyInfo = Array.isArray(data?.keyInfo) ? data.keyInfo : [];
    const docs    = Array.isArray(data?.docs) ? data.docs : [];

    // (2026-05-11 v251) Look up language-specific keyInfo overrides
    //   (name_ko, name_en, overview_ko, overview_en). Operators can
    //   stash per-language copies via asset_key_info to keep the EN
    //   site readable while admin/assets.html stays a single-language
    //   form. When no override is set we fall back to the DB primary
    //   (which is whatever the operator typed — usually Korean) on KO
    //   and to the static EN copy in ir.html on EN.
    const findKeyInfo = (key) => {
      const lk = String(key).toLowerCase();
      const row = keyInfo.find(kv => String(kv?.k || "").toLowerCase() === lk);
      return row ? String(row.v || "").trim() : "";
    };
    const nameOverride     = findKeyInfo(`name_${lang}`);
    const overviewOverride = findKeyInfo(`overview_${lang}`);

    // ===== Hero eyebrow / name / short desc =====
    const country = COUNTRY_LABEL[String(a.country_code || "").toUpperCase()];
    const countryLabel = country ? (country[lang] || country.en) : String(a.country_code || "").toUpperCase();
    const statusBadge = lang === "ko" ? STATUS_BADGE_KO : STATUS_BADGE_EN;
    const statusLabel = statusBadge[String(a.status || "").trim()]
      || statusBadge[String(a.display_status || "").trim()]
      || String(a.display_status || a.status || "").trim().toUpperCase();
    const idShort = String(a.id || assetId).replace(/^SILICA-/i, "").trim() || a.id || assetId;
    const eyebrowParts = [`◆ MINE NO. ${idShort}`];
    if (countryLabel) eyebrowParts.push(countryLabel.toUpperCase());
    if (statusLabel)  eyebrowParts.push(statusLabel);
    setText("adetId", eyebrowParts.join(" · "));

    // Page title <title>{name} · SilicaChain</title>
    // Use the override when present so the title respects locale.
    const titleName = nameOverride || (lang === "ko" ? a.name : "");
    try {
      if (titleName) document.title = `${titleName} · SilicaChain`;
    } catch (_) {}

    // Hero name + short desc — only override the static HTML when we
    // have content in the CURRENT language. On EN with no name_en key,
    // the static 'High-Purity Silica Mine' text stays put.
    if (nameOverride) {
      setText("adetName", nameOverride);
    } else if (lang === "ko" && a.name) {
      setText("adetName", String(a.name));
    }

    const fullOverviewKo = String(a.overview || "").trim();
    const effectiveOverview = overviewOverride
      || (lang === "ko" ? fullOverviewKo : "");
    if (effectiveOverview) {
      const teaser = effectiveOverview.length > 280
        ? effectiveOverview.slice(0, 280).replace(/\s+\S*$/, "") + "…"
        : effectiveOverview;
      setText("adetShortDesc", teaser);
    }

    // ===== Mine Information cells =====
    setText("adetLicense", `#${idShort}`);
    if (countryLabel) setText("adetJurisdiction", countryLabel);

    // ===== Mine Site visuals block =====
    const visualsRoot   = document.getElementById("adetVisuals");
    const heroWrap      = document.getElementById("adetHeroImageWrap");
    const heroImg       = document.getElementById("adetHeroImage");
    const overviewCard  = document.getElementById("adetOverviewCard");
    const overviewText  = document.getElementById("adetOverview");
    const galleryWrap   = document.getElementById("adetGalleryWrap");
    const galleryGrid   = document.getElementById("adetGallery");

    let anyVisual = false;

    // Main asset image (image_url)
    const mainImg = safeImageUrl(a.image_url);
    if (mainImg && heroWrap && heroImg) {
      heroImg.src = mainImg;
      heroImg.alt = `${a.name || assetId} main image`;
      heroWrap.style.display = "";
      anyVisual = true;
    }

    // Full overview text — same language gate as the hero short-desc.
    //   EN with no `overview_en` keyInfo override leaves the card hidden
    //   (the static hero short-desc already carries the EN copy).
    //   KO uses asset.overview directly.
    if (effectiveOverview && overviewCard && overviewText) {
      overviewText.textContent = effectiveOverview;
      overviewCard.style.display = "";
      anyVisual = true;
    }

    // Detail images — keyInfo entries with key matching /^detail_image/.
    // Sort by trailing numeric suffix so the gallery preserves upload
    // order (detail_image_1, detail_image_2, ...).
    const detailImages = keyInfo
      .filter(kv => /^detail_image/i.test(String(kv?.k || "")))
      .map(kv => ({
        order: parseInt(String(kv.k).replace(/^\D+/g, ""), 10) || 0,
        url: safeImageUrl(kv.v),
      }))
      .filter(d => d.url)
      .sort((x, y) => x.order - y.order);

    if (detailImages.length && galleryWrap && galleryGrid) {
      galleryGrid.innerHTML = detailImages.map((d, i) => `
        <a href="${escAttr(d.url)}" data-lightbox-idx="${i}" aria-label="Open image ${i + 1}">
          <img src="${escAttr(d.url)}" alt="Detail image ${i + 1}" loading="lazy">
        </a>
      `).join("");
      galleryWrap.style.display = "";
      anyVisual = true;

      // (2026-05-11 v276) Wire the lightbox — clicking a thumbnail
      //   opens an in-page modal instead of a new tab. Esc / backdrop
      //   click closes; arrow keys + ‹/› buttons navigate.
      setupLightbox(detailImages.map(d => d.url));
    }

    // (2026-05-11 v268) Location map — prefer the explicit google_map_url
    //   (operator pastes an <iframe> snippet from Maps' Share dialog),
    //   fall back to a generated embed URL from map_query (search term).
    //   Neither set → leave the map card hidden.
    const mapWrap   = document.getElementById("adetMapWrap");
    const mapIframe = document.getElementById("adetMap");
    if (mapWrap && mapIframe) {
      let mapSrc = extractGoogleMapSrc(a.google_map_url);
      if (!mapSrc) {
        const q = String(a.map_query || "").trim();
        if (q) {
          mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
        }
      }
      if (mapSrc) {
        mapIframe.src = mapSrc;
        mapWrap.style.display = "";
        anyVisual = true;
      }
    }

    if (visualsRoot && anyVisual) {
      visualsRoot.style.display = "";
    }

    // ===== Document Library — operator-uploaded asset_docs =====
    // (2026-05-11 v269) Every category in IR_DOC_CATEGORIES gets a
    //   card, even if empty. Empty categories show '(준비중)' /
    //   '(Coming Soon)' instead of being hidden — operator decision:
    //   investors should see the full document roadmap.
    const docsGrid = document.getElementById('adetDocsGrid');
    if (docsGrid) {
      const comingSoon = lang === 'ko' ? '(준비중)' : '(Coming Soon)';
      const dlLabel    = lang === 'ko' ? '다운로드 ↓' : 'Download ↓';
      const cardsHtml = IR_DOC_CATEGORIES.map(cat => {
        const catDocs = docs.filter(d => String(d?.doc_type || '').toLowerCase() === cat.key);
        const title = lang === 'ko' ? cat.ko : cat.en;
        let bodyHtml;
        if (catDocs.length === 0) {
          bodyHtml = `<div class="doc-empty">${comingSoon}</div>`;
        } else {
          bodyHtml = `<div class="doc-list">` + catDocs.map(d => {
            const href = safeDocHref(d.file_path);
            const docTitle = String(d.title || '').trim() || title;
            const docDate  = fmtDocDate(d.doc_date);
            const docAmt   = fmtDocAmount(d.amount, d.amount_currency || 'USDT');
            const metaBits = [docDate, docAmt].filter(Boolean).join(' · ');
            return `<div class="doc-item">
              <div class="doc-item-title">${escAttr(docTitle)}</div>
              ${metaBits ? `<div class="doc-item-meta">${escAttr(metaBits)}</div>` : ''}
              ${href
                ? `<a class="doc-item-btn" href="${escAttr(href)}" target="_blank" rel="noopener">${dlLabel}</a>`
                : `<span class="doc-item-meta" style="color:#dc2626">⚠ file_path 누락</span>`}
            </div>`;
          }).join('') + `</div>`;
        }
        // (v642) data-cat 부여 — ir.html CSS 가 카테고리별 hover 컬러 매칭.
        return `<div class="card doc-card" data-cat="${escAttr(cat.key)}">
          <div class="doc-icon">${cat.icon}</div>
          <h3 class="heading-sm mb-sm" style="font-size: 22px;">${escAttr(title)}</h3>
          ${bodyHtml}
        </div>`;
      }).join('');
      docsGrid.innerHTML = cardsHtml;
    }
  };
})();
