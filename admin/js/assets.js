(() => {
  "use strict";
  const {
    qs, qsa, api, toast, fmtNum, statusOrder, statusBadge,
    toNum, toStr, bootAdminPage, STORAGE
  } = window.AdminCore;

  let assetContracts = [];
  let updateFundingUI = () => {};

  const DEFAULT_ASSET_PREVIEW = "/user/assets/images/default-asset.svg";
  const DEFAULT_TOKEN_PREVIEW = "/user/assets/images/default-token.svg";

  // ====== Template Picker Modal State ======
  let tpResolve = null;
  let tpSelectedId = null;
  let tpAllTemplates = [];
  let tpFilteredTemplates = [];
  let assetFilters = { query: "", type: "", status: "" };

  // (2026-05-11) On-chain SilicaSTO supply cache. Filled at page load via
  //   GET /api/admin/silica/onchain-supply
  // and used to render the truthful '발행' column in the asset list.
  // null = not loaded yet / fetch failed (fallback to DB planned qty)
  let __silicaOnChainSupply = null;

  // (2026-05-18 v492) Global Silica STO sale supply cap.
  //   GET /api/admin/silica/max-supply 로 로드. '목표' 컬럼에 표시.
  let __silicaMaxStoSupply = 0;

  const CONTRACT_PARTICIPATED = new Set(["awaiting_admin","completed"]);

  async function loadAssetContracts(assetId){
    const box = qs("#admAssetContracts");
    if(!box) return;
    assetContracts = [];
    box.innerHTML = "";
    const r = await api(`/api/admin/assets/${assetId}/contracts`).catch(()=>null);
    if(!r){
      box.innerHTML = "<tr><td colspan='5' class='muted center'>계약 없음</td></tr>";
      updateFundingUI();
      return;
    }
    const all = r.rows || r.contracts || [];
    assetContracts = all.filter(c => CONTRACT_PARTICIPATED.has(c.status));
    box.innerHTML = assetContracts.map(c=>`
      <tr data-contract-id="${c.id}" data-status="${c.status}" style="cursor:pointer">
        <td>${c.contract_no}</td>
        <td class="small-note">${c.address}</td>
        <td class="right">${fmtNum(c.amount_usdt,2)} USDT</td>
        <td>${statusLabel(c.status)}</td>
        <td class="small-note">${c.created_at}</td>
      </tr>
    `).join("") || `<tr><td colspan="5" class="center muted">참여 접수된 계약 없음</td></tr>`;

    qsa("tr[data-contract-id]", box).forEach(tr => {
      tr.addEventListener("click", () => {
        const id = tr.getAttribute("data-contract-id");
        if (id) location.href = `contracts.html?id=${encodeURIComponent(id)}`;
      });
    });
    updateFundingUI();
  }

  function statusLabel(s) {
    const map = { awaiting_admin: "서명대기", completed: "서명완료", draft: "초안", user_signed: "사용자서명", rejected: "반려" };
    return map[s] || s;
  }

  function getCheckedContracts() {
    return Array.from(qsa(".contract-check:checked")).map(cb => ({
      id: Number(cb.value),
      status: cb.getAttribute("data-status"),
    }));
  }

  function updateBatchButtons() { return; }

  // =============================================
  // Template Picker Modal
  // =============================================
  function openTemplatePicker(opts = {}) {
    return new Promise(async (resolve) => {
      tpResolve = resolve;
      tpSelectedId = null;

      if (qs("#tpTitle")) qs("#tpTitle").textContent = opts.title || "\uacc4\uc57d\uc11c \ud15c\ud50c\ub9bf \uc120\ud0dd";
      if (qs("#tpSubtitle")) qs("#tpSubtitle").textContent = opts.subtitle || "\uc774 \uc790\uc0b0\uc5d0 \uc801\uc6a9\ud560 \uacc4\uc57d\uc11c \ud15c\ud50c\ub9bf\uc744 \uc120\ud0dd\ud558\uc138\uc694.";
      if (qs("#tpSearch")) qs("#tpSearch").value = "";

      // Load templates
      await loadAllTemplates();
      renderTpList();

      qs("#tmplPickerOverlay")?.classList.add("show");
      setTimeout(() => qs("#tpSearch")?.focus(), 100);
    });
  }

  function closeTemplatePicker(result = null) {
    qs("#tmplPickerOverlay")?.classList.remove("show");
    if (tpResolve) { tpResolve(result); tpResolve = null; }
  }

  async function loadAllTemplates() {
    try {
      const r = await api("/api/admin/contract-templates");
      tpAllTemplates = r?.templates || [];
    } catch { tpAllTemplates = []; }
  }

  function renderTpList() {
    const listEl = qs("#tpList");
    const countEl = qs("#tpCount");
    if (!listEl) return;

    const q = (qs("#tpSearch")?.value || "").toLowerCase().trim();

    tpFilteredTemplates = tpAllTemplates.filter(t => {
      if (q) {
        const hay = `${t.template_code} ${t.template_name} ${t.template_title || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (countEl) countEl.textContent = String(tpFilteredTemplates.length);

    if (tpFilteredTemplates.length === 0) {
      listEl.innerHTML = '<div class="muted" style="padding:24px;text-align:center">\ud15c\ud50c\ub9bf\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</div>';
      return;
    }

    listEl.innerHTML = "";
    for (const t of tpFilteredTemplates) {
      const isActive = t.is_active == 1;
      const isDefault = t.template_code === "funding_subscription";
      const iconClass = isDefault ? "default" : (isActive ? "active" : "inactive");
      const iconChar = isDefault ? "\u2605" : (isActive ? "\u25b6" : "\u25cb");
      const selected = tpSelectedId == t.id;

      // Show assigned assets as badges
      const assignedAssets = t.assigned_assets || [];
      let badgesHtml = "";
      if (assignedAssets.length > 0) {
        badgesHtml = '<div class="tp-badges">' +
          assignedAssets.map(a => `<span class="tp-asset-badge">${a.asset_id}</span>`).join("") +
          '</div>';
      } else if (isDefault) {
        badgesHtml = '<div class="tp-badges"><span class="tp-asset-badge" style="background:rgba(22,163,74,.12);color:#16a34a">\uae30\ubcf8</span></div>';
      }

      const div = document.createElement("div");
      div.className = "tp-item" + (selected ? " selected" : "");
      div.innerHTML = `
        <div class="tp-icon ${iconClass}">${iconChar}</div>
        <div class="tp-info">
          <div class="tp-name">${t.template_name || t.template_code}</div>
          <div class="tp-detail">${t.template_code} v${t.version_no} \u00b7 ${isActive ? "\ud65c\uc131" : "\ube44\ud65c\uc131"}</div>
          ${badgesHtml}
        </div>
        <div class="tp-check">${selected ? "\u2713" : ""}</div>
      `;
      div.addEventListener("click", () => {
        tpSelectedId = t.id;
        renderTpList();
      });
      listEl.appendChild(div);
    }
  }

  function initTemplatePicker() {
    qs("#tpClose")?.addEventListener("click", () => closeTemplatePicker(null));
    qs("#tpCancelBtn")?.addEventListener("click", () => closeTemplatePicker(null));
    qs("#tpConfirmBtn")?.addEventListener("click", () => {
      closeTemplatePicker(tpSelectedId || null);
    });
    qs("#tpSearch")?.addEventListener("input", renderTpList);

    qs("#tmplPickerOverlay")?.addEventListener("click", (e) => {
      if (e.target === qs("#tmplPickerOverlay")) closeTemplatePicker(null);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && qs("#tmplPickerOverlay")?.classList.contains("show")) {
        closeTemplatePicker(null);
      }
    });
  }

  // =============================================
  // Contract Template Assignment for Asset
  // =============================================
  async function loadAssetTemplate(assetId) {
    const currentBox = qs("#admAssetTmplCurrent");
    if (!currentBox) return;

    try {
      const r = await api(`/api/admin/assets/${encodeURIComponent(assetId)}/template`);
      const assigned = r?.assigned;

      if (assigned) {
        currentBox.innerHTML = `
          <span class="tmpl-tag">
            <span>${assigned.template_name} (${assigned.template_code} v${assigned.version_no})</span>
          </span>
          <span class="muted" style="font-size:12px">ID: ${assigned.template_id}</span>
        `;
      } else {
        currentBox.innerHTML = `
          <span class="muted" style="font-size:13px">\uc804\uc6a9 \uacc4\uc57d\uc11c \uc5c6\uc74c</span>
          <span style="display:inline-block;font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(22,163,74,.12);color:#16a34a;font-weight:700;border:1px solid rgba(22,163,74,.2)">\uae30\ubcf8 \ud15c\ud50c\ub9bf \uc0ac\uc6a9 \uc911</span>
        `;
      }
    } catch (e) {
      currentBox.innerHTML = '<span class="muted">\ub85c\ub4dc \uc2e4\ud328</span>';
    }
  }

  // =========================
  // URL helpers
  // =========================
  const absUrl = (p) => {
    let s = String(p || "").trim();
    if (!s) return "";
    // (2026-05-26 v843) /uploads/* → /api/file/* swap (user core.js 와 동일).
    if (s.startsWith('/uploads/')) s = '/api/file/' + s.substring('/uploads/'.length);
    else if (s.startsWith('uploads/')) s = '/api/file/' + s.substring('uploads/'.length);
    if (/^(https?:)?\/\//i.test(s)) return s;
    if (s.startsWith("/")) return s;
    return `/${s}`;
  };

  const setPreview = (imgEl, url) => {
    if (!imgEl) return;
    const isToken = /token/i.test(String(imgEl.id || ""));
    const fallback = isToken ? DEFAULT_TOKEN_PREVIEW : DEFAULT_ASSET_PREVIEW;
    const u = absUrl(url) || fallback;
    imgEl.src = u;
    // (2026-05-11 v252) Fix infinite-loop console flood when the fallback
    //   image is also missing. The old guard compared `imgEl.src` (which
    //   the browser resolves to an absolute URL) against the relative
    //   `fallback` literal — they never matched, so the onerror handler
    //   re-set the same broken fallback every tick, producing tens of
    //   thousands of 404 entries. Now we (a) detach the handler before
    //   assigning the fallback so a second failure can't re-fire, and
    //   (b) use endsWith on pathname for a robust same-URL check.
    imgEl.onerror = () => {
      try {
        const cur = new URL(imgEl.src, location.href).pathname;
        if (cur.endsWith(fallback)) {
          imgEl.onerror = null;
          return;
        }
      } catch (_) { /* malformed URL — fall through */ }
      imgEl.onerror = null;
      imgEl.src = fallback;
    };
    imgEl.style.display = "block";
  };

  const fileToPreviewDataUrl = (file, imgEl) => {
    if (!file || !imgEl) return;
    const fr = new FileReader();
    fr.onload = () => { imgEl.src = String(fr.result || ""); imgEl.style.display = "block"; };
    fr.readAsDataURL(file);
  };

  // =========================
  // Upload helper
  // =========================
  const uploadForm = async (path, formData) => {
    const base = (localStorage.getItem(STORAGE.apiBase) || "").trim();
    const token = localStorage.getItem(STORAGE.adminToken) || "";
    const url = `${base}${path}`;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    // (2026-05-24 v824) X-Admin-Wallet 헤더 추가 — admin.core.js requestJson 과
    //   동일 패턴. ADMIN_WALLET_ADDRESSES 화이트리스트 활성 시 adminOnly() 가
    //   이 헤더 없으면 403 거부 → 이미지 업로드 실패.
    const wallet = (() => {
      try { return localStorage.getItem(STORAGE.adminWallet) || ""; }
      catch (_) { return ""; }
    })();
    if (wallet) headers["X-Admin-Wallet"] = wallet;
    const res = await fetch(url, { method: "POST", headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.message || `업로드 실패 (${res.status})`);
    return data;
  };

  const COUNTRY_LABEL = {
    KR: "대한민국", US: "미국", KZ: "카자흐스탄",
    PH: "필리핀", GE: "조지아", ID: "인도네시아", VN: "베트남",
  };

  const SUPPORTED_CURRENCIES = new Set(["KRW","USD","KZT","PHP","GEL","IDR","VND","USDT"]);

  const setCurLabels = (ccy) => {
    const k = String(ccy || "KRW").toUpperCase();
    const fxCur = qs("#admFxCur");
    const offCur = qs("#admOfficialCur");
    if (fxCur) fxCur.textContent = k;
    if (offCur) offCur.textContent = k;
  };

  const plannedIssueQty = (asset) => {
    const snap = Number(asset?.funded_snapshot_usdt || 0);
    if (snap > 0) return snap;
    const raised = Number(asset?.raised_usdt || 0);
    if (raised > 0) return raised;
    return 0;
  };

  const computeDisplayStatus = (asset) => {
    const status = String(asset?.status || "").trim();
    if (status === "매각") {
      const remaining = Number(asset?.sale_vault_balance_usdt ?? asset?.vault_balance_usdt ?? asset?.sale_remaining_usdt ?? 0);
      if (Number.isFinite(remaining) && remaining <= 0.000001 && Number(asset?.sale_total_usdt || asset?.vault_total_usdt || 0) > 0) {
        return "매각(완료)";
      }
    }
    return status || "-";
  };

  const fmtIssueQty = (value) => {
    const num = Number(value || 0);
    if (!(num > 0)) return "0";
    return num.toLocaleString("ko-KR", {
      minimumFractionDigits: num % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 6,
    });
  };

  // =========================
  // Lock immutable fields
  // =========================
  const lockImmutableFields = (isExisting) => {
    const lockFields = qsa(".adm-lock-field");
    const badge = qs("#admLockBadge");
    lockFields.forEach(el => {
      if (isExisting) {
        el.setAttribute("readonly", "");
        el.setAttribute("disabled", "");
        el.classList.add("adm-immutable");
      } else {
        el.removeAttribute("readonly");
        el.removeAttribute("disabled");
        el.classList.remove("adm-immutable");
      }
    });
    if (badge) badge.style.display = isExisting ? "inline-block" : "none";
  };

  // (2026-05-11 v282) 운영자 결정: 자산 페이지의 증빙문서 관리 카드는 제거.
  //   문서는 /admin/docs.html 에서만 관리하고, 매각 문서는
  //   /admin/sales.html 에서만 관리한다. 관련 helper / event 핸들러
  //   (DOC_CATEGORY_LABELS, loadAssetDocs, window._deleteDoc,
  //    els.docUploadBtn click handler) 일괄 제거. 백엔드 엔드포인트
  //   /api/admin/assets/:id/docs 는 docs.html / sales.html 이 그대로
  //   사용하므로 보존.

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("assets");
    if (!me) return;

    initTemplatePicker();

    const els = {
      refreshBtn: qs("#admRefreshBtn"),
      forceSeedBtn: qs("#admForceSeedBtn"),
      newBtn: qs("#admNewBtn"),
      openSearchModal: qs("#admOpenSearchModal"),
      clearFiltersBtn: qs("#admClearFiltersBtn"),
      searchSummary: qs("#admSearchSummary"),
      listCount: qs("#admListCount"),
      tbody: qs("#admAssetsTbody"),
      searchModal: qs("#admSearchModal"),
      filterQuery: qs("#admFilterQuery"),
      filterType: qs("#admFilterType"),
      filterStatus: qs("#admFilterStatus"),
      searchApply: qs("#admSearchApply"),
      searchCancel: qs("#admSearchCancel"),
      searchReset: qs("#admSearchReset"),
      searchListBody: qs("#admSearchAssetList"),
      searchListCount: qs("#admSearchListCount"),
      editingId: qs("#admEditingId"),
      cancelFundingBtn: qs("#admCancelFundingBtn"),
      proceedBuyBtn: qs("#admProceedBuyBtn"),
      startDistributionBtn: qs("#admStartDistributionBtn"),
      fundingActions: qs("#admFundingActions"),
      fundingEmpty: qs("#admFundingEmpty"),
      fundingStatus: qs("#admFundingStatus"),
      saveBtn: qs("#admSaveBtn"),
      saveFeedback: qs("#admSaveFeedback"),
      deleteBtn: qs("#admDeleteBtn"),

      id: qs("#admId"),
      market: qs("#admMarket"),
      name: qs("#admName"),
      country: qs("#admCountry"),
      currency: qs("#admCurrency"),
      status: qs("#admStatus"),
      type: qs("#admType"),
      location: qs("#admLocation"),
      mapQuery: qs("#admMapQuery"),
      googleMapUrl: qs("#admGoogleMapUrl"),
      imageUrl: qs("#admImageUrl"),
      tokenImageUrl: qs("#admTokenImageUrl"),
      overview: qs("#admOverview"),
      // (2026-05-11 v268) Per-language overview field — saved to
      //   asset_key_info.overview_en via POST /api/admin/assets/:id/key-info.
      //   ir.html reads it in EN mode (silica overview is otherwise Korean).
      overviewEn: qs("#admOverviewEn"),
      // (2026-05-17 v436) Per-language asset name fields — saved to
      //   asset_key_info.name_en / asset_key_info.name_ko. contracts.php /
      //   funding pages 가 lang 분기로 표시. 비워두면 기본 assets.name 폴백.
      nameEn: qs("#admNameEn"),
      nameKo: qs("#admNameKo"),
      target: qs("#admTarget"),
      raised: qs("#admRaised"),
      min: qs("#admMin"),
      expectedBuy: qs("#admExpectedBuy"),
      apr: qs("#admApr"),
      aprNote: qs("#admAprNote"),
      aprHistory: qs("#admAprHistory"),
      aprHistoryList: qs("#admAprHistoryList"),
      fundEnd: qs("#admFundEnd"),
      fxAtFunding: qs("#admFxAtFunding"),
      officialKrw: qs("#admOfficialKrw"),
      supply: qs("#admSupply"),
      snapshot: qs("#admSnapshot"),
      feeBuyer: qs("#admFeeBuyer"),
      feeSeller: qs("#admFeeSeller"),
      isPublic: qs("#admIsPublic"),
      tokenMintAddress: qs("#admTokenMintAddress"),
      tokenMintNote: qs("#admTokenMintNote"),
      mintSaveFeedback: qs("#admMintSaveFeedback"),
      saveMintBtn: qs("#admSaveMintBtn"),
      opsSaveBtn: qs("#admOpsSaveBtn"),
      opsSaveFeedback: qs("#admOpsSaveFeedback"),
      tokenNameDerived: qs("#admTokenNameDerived"),
      tokenSymbolDerived: qs("#admTokenSymbolDerived"),
      tokenDecimalsDerived: qs("#admTokenDecimalsDerived"),
      tokenIssueQty: qs("#admTokenIssueQty"),
      tokenIssueHint: qs("#admTokenIssueHint"),

      imageFile: qs("#admImageFile"),
      tokenFile: qs("#admTokenImageFile"),
      detailImages: qs("#admDetailImages"),

      uploadImagesBtn: qs("#admUploadImagesBtn"),
      imagePreview: qs("#admImagePreview"),
      tokenPreview: qs("#admTokenPreview"),
      detailGrid: qs("#admDetailGrid"),

      // (2026-05-11 v282) 증빙문서 관리 카드 제거 — 관련 ID 핸들러 모두 삭제.

      // Create modal
      createModal: qs("#admCreateModal"),
      createCancel: qs("#admCreateCancel"),
      createSubmit: qs("#admCreateSubmit"),
      newType: qs("#admNewType"),
      newId: qs("#admNewId"),
      newName: qs("#admNewName"),
      newCountry: qs("#admNewCountry"),
      newCurrency: qs("#admNewCurrency"),
      newLocation: qs("#admNewLocation"),
      newMapQuery: qs("#admNewMapQuery"),
      newTarget: qs("#admNewTarget"),
      newExpectedBuy: qs("#admNewExpectedBuy"),
      newApr: qs("#admNewApr"),
      newFundEnd: qs("#admNewFundEnd"),
      newTermYears: qs("#admNewTermYears"),
      newOverview: qs("#admNewOverview"),
      newImage: qs("#admNewImage"),
      newTokenImage: qs("#admNewTokenImage"),
    };

    let assets = [];
    let current = null;
    const MINT_LOCK_STATUSES = new Set(["분배중", "운영중", "매각"]);
    const normalizeMintValue = (value) => String(value || "").trim();
    const isLikelySolanaAddress = (value) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalizeMintValue(value));
    const isMintLocked = (asset) => MINT_LOCK_STATUSES.has(String(computeDisplayStatus(asset || current || {}) || "").trim());
    const getFilteredAssets = () => {
      const q = String(assetFilters.query || "").trim().toLowerCase();
      const typeFilter = String(assetFilters.type || "").trim();
      const statusFilter = String(assetFilters.status || "").trim();
      return assets.filter(a => {
        if (typeFilter && String(a.type || "").trim() !== typeFilter) return false;
        if (statusFilter && String(a.status || "").trim() !== statusFilter) return false;
        if (!q) return true;
        const hay = `${a.id} ${a.name} ${a.market} ${a.location || ""} ${(a.country_code||"")} ${(a.settlement_basis||"")} ${(a.type||"")}`.toLowerCase();
        return hay.includes(q);
      });
    };
    const renderAssetRowHtml = (a) => {
      // (2026-05-07) Silica USDT-fixed 모델 — fallback KRW → USDT.
      const ccy = String(a.settlement_basis || "USDT").toUpperCase();
      const cc = String(a.country_code || "KR").toUpperCase();
      const raised = Number(a?.raised_usdt || 0);
      // (2026-05-18 v492) 운영자 보고: '설정에서 판매수량을 200,000 으로 설정
      //   했는데 왜 목표가 0 으로 나오나'. 기존 target 는 assets.target_usdt
      //   (자산별 모금 목표) 인데 Silica 단일자산 모델에서 의미 없음.
      //   대신 silica_max_sto_supply (전역 판매 상한, 1 USDT = 1 STO peg) 를
      //   목표로 표시 — 운영자 직관 일치.
      const maxStoSupply = Number(__silicaMaxStoSupply || 0);
      const target = maxStoSupply > 0 ? maxStoSupply : Number(a?.target_usdt || 0);
      const plannedQty = plannedIssueQty(a);

      // (2026-05-11) 발행 column — prefer on-chain SilicaSTO supply when
      // available. Fall back to plannedIssueQty (DB) only if the on-chain
      // value couldn't be fetched. Show a small reconciliation note when
      // the on-chain supply diverges from the DB planned amount so the
      // operator can spot drift at a glance.
      const onChain = __silicaOnChainSupply;
      const showOnChain = onChain != null && Number.isFinite(Number(onChain));
      const displayQty = showOnChain ? Number(onChain) : plannedQty;

      // (2026-05-18 v488/v490) drift 경고 + 'DB 계획값' 폴백 문구 모두 제거.
      //   on-chain 라벨만 표시 (운영자 요청: 불필요한 내용 정리).
      //   on-chain 미조회 시에도 별도 안내 없이 숫자만 표기.
      let issueCellExtra = "";
      if (showOnChain) {
        issueCellExtra = `<div class="small-note" style="color:#64748b">on-chain</div>`;
      }

      // (2026-05-18 v493) 자산명 표시 우선순위: name_ko (asset_key_info) →
      //   assets.name. 운영자가 '자산명 (한국어)' 폼에 입력한 값이 assets.name
      //   sync 와 관계없이 즉시 표에 반영되도록.
      const displayName = String(a.name_ko || a.name || a.id);

      // (2026-05-18 v494/v496) 운영자 요청: '대한민국 · USDT · mine 불필요한
      //   문구 제거'. 자산 ID + 자산명 두 줄만 유지, 국가/통화/종류 부가
      //   라인 제거. v496 - 캐시 강제 갱신 (v494 후에도 옛 라인 잔존 보고).
      const __rendered = `<tr data-id="${a.id}" style="cursor:pointer">
        <td>
          <strong>${a.id}</strong>
          <div class="small-note">${displayName}</div>
        </td>
        <td>${statusBadge(computeDisplayStatus(a))}</td>
        <td class="right">${fmtNum(raised, 2)} USDT</td>
        <td class="right">${fmtNum(target, 2)} USDT</td>
        <td class="right">${fmtIssueQty(displayQty)}${issueCellExtra}</td>
      </tr>`;
      // 캐시 확인용 — 콘솔에서 v496 로딩 확인 가능. 한 번만 출력.
      if (!window.__assetsRowV496Logged) {
        window.__assetsRowV496Logged = true;
        console.log('[admin/assets v496] renderAssetRowHtml — country/currency/type subline removed. displayName=', displayName);
      }
      return __rendered;
    };
    const bindAssetRows = (root) => {
      qsa("tr[data-id]", root).forEach(tr => {
        if (tr.dataset.bound === "1") return;
        tr.dataset.bound = "1";
        tr.addEventListener("click", async () => {
          const id = tr.getAttribute("data-id");
          const a = await loadDetail(id);
          if (a) fillForm(a);
          if (root === els.searchListBody) closeSearchModal();
        });
      });
    };
    const renderSearchModalList = () => {
      const filtered = getFilteredAssets();
      if (els.searchListCount) els.searchListCount.textContent = String(filtered.length);
      if (!els.searchListBody) return;
      els.searchListBody.innerHTML = filtered.length
        ? filtered.map(renderAssetRowHtml).join("")
        : `<tr><td colspan="3" class="center muted">검색 조건에 맞는 자산이 없습니다.</td></tr>`;
      bindAssetRows(els.searchListBody);
    };
    const getMintValidationError = (value, { allowEmpty = true } = {}) => {
      const mint = normalizeMintValue(value);
      if (!mint) return allowEmpty ? "" : "토큰 민트 주소를 입력하세요.";
      if (!isLikelySolanaAddress(mint)) return "정상적인 솔라나 주소가 아닙니다.";
      return "";
    };


    const feedbackTimers = {};
    const showInlineFeedback = (el, message, kind = "good") => {
      if (!el) return;
      const key = el.id || String(Math.random());
      if (feedbackTimers[key]) clearTimeout(feedbackTimers[key]);
      el.textContent = String(message || "");
      el.style.color = kind === "bad" ? "#b91c1c" : "#166534";
      el.style.fontWeight = "700";
      feedbackTimers[key] = setTimeout(() => {
        el.textContent = "";
      }, 4000);
    };

    const closeSearchModal = () => {
      els.searchModal?.classList.remove("show");
    };

    const renderSearchSummary = (visibleCount, totalCount) => {
      if (els.listCount) els.listCount.textContent = String(visibleCount);
      if (!els.searchSummary) return;

      const parts = [];
      const q = String(assetFilters.query || "").trim();
      if (q) parts.push(`검색어: ${q}`);
      if (assetFilters.type) parts.push(`타입: ${assetFilters.type}`);
      if (assetFilters.status) parts.push(`상태: ${assetFilters.status}`);

      els.searchSummary.textContent = parts.length > 0
        ? `${parts.join(" · ")} · ${visibleCount}/${totalCount}건 표시 중`
        : `전체 자산 ${visibleCount}/${totalCount}건을 표시 중입니다.`;
    };

    const openSearchModal = () => {
      if (els.filterQuery) els.filterQuery.value = assetFilters.query || "";
      if (els.filterType) els.filterType.value = assetFilters.type || "";
      if (els.filterStatus) els.filterStatus.value = assetFilters.status || "";
      renderSearchModalList();
      els.searchModal?.classList.add("show");
      window.setTimeout(() => els.filterQuery?.focus(), 50);
    };

    const applyFilters = () => {
      assetFilters = {
        query: String(els.filterQuery?.value || "").trim(),
        type: String(els.filterType?.value || "").trim(),
        status: String(els.filterStatus?.value || "").trim(),
      };
      renderList();
      closeSearchModal();
    };

    const clearFilters = () => {
      assetFilters = { query: "", type: "", status: "" };
      if (els.filterQuery) els.filterQuery.value = "";
      if (els.filterType) els.filterType.value = "";
      if (els.filterStatus) els.filterStatus.value = "";
      renderList();
      renderSearchModalList();
    };

    setCurLabels(els.currency?.value || "KRW");

    const loadAssets = async () => {
      const r = await api("/api/assets");
      assets = (r.assets || []).slice().sort((a, b) => statusOrder(a.status) - statusOrder(b.status));
      return assets;
    };

    const loadDetail = async (id) => {
      const d = await api(`/api/assets/${encodeURIComponent(id)}`);
      const asset = d?.asset || null;
      if (asset && Array.isArray(d?.keyInfo)) {
        // (2026-05-11 v268) Surface key-info rows onto the asset object
        //   so fillForm() can populate fields backed by asset_key_info
        //   (detail_image_*, overview_en, name_en, …) without a second
        //   request. The detail-image gallery loader already expects
        //   `a._keyInfo` to be present; this assignment was previously
        //   missing — so that branch never fired in production.
        asset._keyInfo = d.keyInfo;
      }
      return asset;
    };

    const syncSelectedRow = () => {
      qsa("tr[data-id]", els.tbody).forEach(tr => {
        const rowId = tr.getAttribute("data-id");
        const active = !!(current?.id && rowId === current.id);
        tr.classList.toggle("is-selected", active);
        if (active) tr.setAttribute("aria-current", "true");
        else tr.removeAttribute("aria-current");
      });
    };

    const renderList = () => {
      const filtered = getFilteredAssets();

      renderSearchSummary(filtered.length, assets.length);
      renderSearchModalList();

      els.tbody.innerHTML = filtered.length
        ? filtered.map(renderAssetRowHtml).join("")
        : `<tr><td colspan="5" class="center muted">등록된 자산이 없습니다. 우측 '자산 강제 시드' 버튼으로 복구 가능합니다.</td></tr>`;

      bindAssetRows(els.tbody);
      syncSelectedRow();

      // (v488) 강제 시드 버튼은 자산 0개일 때만 표시 — 평소엔 불필요.
      if (els.forceSeedBtn) {
        els.forceSeedBtn.style.display = (assets.length === 0) ? "" : "none";
      }
    };

    const setVal = (el, val) => { if (el) el.value = val ?? ""; };

    const updateDerivedTokenInfo = (asset) => {
      const tokenName = String(asset?.name || "").trim();
      const tokenSymbol = String(asset?.id || "").trim();
      if (els.tokenNameDerived) els.tokenNameDerived.value = tokenName;
      if (els.tokenSymbolDerived) els.tokenSymbolDerived.value = tokenSymbol;
      if (els.tokenDecimalsDerived) els.tokenDecimalsDerived.value = "1";

      if (els.tokenIssueQty) {
        const issueQty = plannedIssueQty(asset);
        els.tokenIssueQty.textContent = `${fmtIssueQty(issueQty)} ${tokenSymbol || 'TOKEN'}`;
      }
      if (els.tokenIssueHint) {
        const mint = String(asset?.token_mint_address || "").trim();
        const issueQty = plannedIssueQty(asset);
        const status = String(asset?.status || "").trim() || "-";
        const baseMsg = issueQty > 0
          ? `현재 확정 모금 기준 발행 필요 수량은 ${fmtIssueQty(issueQty)}개이며, 분배 시작 시 1 USDT = 1 Token 기준으로 고정됩니다.`
          : "분배 시작 전 모금 확정 수량을 기준으로 운영자가 발행할 토큰 수량을 안내합니다.";
        const mintMsg = mint
          ? `현재 등록된 민트 주소: ${mint}`
          : "토큰 분배를 시작하려면 먼저 토큰 민트 주소를 저장해야 합니다.";
        els.tokenIssueHint.textContent = `${baseMsg} 상태: ${status}. ${mintMsg}`;
      }
    };

    const fillForm = (a) => {
      current = a;
      syncSelectedRow();
      const isExisting = true;

      if (els.editingId) els.editingId.textContent = `편집: ${a.id} (${a.name})`;

      setVal(els.id, a.id);
      setVal(els.market, a.market);
      setVal(els.name, a.name);

      const cc = String(a.country_code || "KR").toUpperCase();
      if (els.country) els.country.value = cc;
      // (2026-05-07) Silica USDT-fixed — fallback KRW → USDT.
      const ccy = String(a.settlement_basis || "USDT").toUpperCase();
      if (els.currency) els.currency.value = ccy;
      setCurLabels(ccy);

      setVal(els.status, computeDisplayStatus(a));
      setVal(els.type, a.type);
      setVal(els.location, a.location);
      setVal(els.mapQuery, a.map_query);
      setVal(els.googleMapUrl, a.google_map_url);
      setVal(els.imageUrl, a.image_url);
      setVal(els.tokenImageUrl, a.token_image_url);
      setVal(els.overview, a.overview);
      setVal(els.target, a.target_usdt);
      setVal(els.raised, a.raised_usdt);
      setVal(els.min, a.min_usdt);
      setVal(els.expectedBuy, a.expected_buy_price_usdt);
      setVal(els.apr, a.apr);
      setVal(els.fundEnd, a.fund_end_date ? String(a.fund_end_date).slice(0,10) : "");
      setVal(els.fxAtFunding, a.fx_at_funding);
      setVal(els.officialKrw, a.official_price_krw);
      setVal(els.supply, a.supply_token);
      setVal(els.snapshot, a.funded_snapshot_usdt);
      setVal(els.feeBuyer, a.fee_buyer);
      setVal(els.feeSeller, a.fee_seller);

      if (els.isPublic) els.isPublic.value = String(a.is_public || 0);

      const mintValue = normalizeMintValue(a.token_mint_address);
      setVal(els.tokenMintAddress, mintValue);
      if (els.tokenMintAddress) {
        const locked = isMintLocked(a);
        els.tokenMintAddress.readOnly = locked;
        els.tokenMintAddress.classList.toggle("adm-immutable", locked);
      }
      if (els.tokenMintNote) {
        els.tokenMintNote.textContent = isMintLocked(a)
          ? "토큰 분배가 시작된 이후에는 토큰 민트 주소를 수정할 수 없습니다. 현재 저장된 값을 유지합니다."
          : "토큰 컨트랙트를 배포한 뒤 입력하세요. 앞뒤 공백은 자동 제거되며, 정상적인 솔라나 주소만 저장됩니다.";
      }
      setScopedSaveButtons();
      updateDerivedTokenInfo(a);
      const withdrawnQtyEl = qs("#admTokenWithdrawnQty");
      if (withdrawnQtyEl) withdrawnQtyEl.textContent = `${fmtIssueQty(Number(a.onchain_withdrawn_token || 0))} ${String(a.id || "TOKEN")}`;

      // fx_at_funding: editable only if 0
      if (els.fxAtFunding) {
        const fxSet = (parseFloat(a.fx_at_funding) || 0) > 0;
        els.fxAtFunding.readOnly = fxSet;
        els.fxAtFunding.style.opacity = fxSet ? '.6' : '1';
      }

      setPreview(els.imagePreview, a.image_url);
      setPreview(els.tokenPreview, a.token_image_url);

      if (els.imageFile) els.imageFile.value = "";
      if (els.tokenFile) els.tokenFile.value = "";

      // Lock immutable fields for existing asset
      lockImmutableFields(isExisting);

      // Load detail images from keyInfo
      loadDetailImages(a);

      // (2026-05-11 v271) Toggle the asset-image delete button.
      refreshAssetImageDeleteVisibility();

      // (2026-05-11 v268) Populate per-language overview override
      //   from asset_key_info.overview_en. ir.html uses this for the
      //   EN view; if blank, the EN view falls through to its static
      //   marketing copy.
      if (els.overviewEn) {
        const enRow = (Array.isArray(a._keyInfo) ? a._keyInfo : [])
          .find(kv => String(kv?.k || "").toLowerCase() === "overview_en");
        els.overviewEn.value = enRow ? String(enRow.v || "") : "";
      }

      // (2026-05-17 v436) Populate per-language asset name fields from
      //   asset_key_info.name_en / name_ko. 비워두면 자산 기본 name 폴백.
      const _keyInfoList = Array.isArray(a._keyInfo) ? a._keyInfo : [];
      if (els.nameEn) {
        const row = _keyInfoList.find(kv => String(kv?.k || "").toLowerCase() === "name_en");
        els.nameEn.value = row ? String(row.v || "") : "";
      }
      if (els.nameKo) {
        const row = _keyInfoList.find(kv => String(kv?.k || "").toLowerCase() === "name_ko");
        els.nameKo.value = row ? String(row.v || "") : "";
      }

      // Load APR history
      loadAprHistory(a.id);

      // Load contracts
      loadAssetContracts(a.id);

      // Load template assignment
      loadAssetTemplate(a.id);

      // (2026-05-11 v282) loadAssetDocs() 제거 — 자산 페이지 doc 카드 폐기.

      // Update funding management UI
      updateFundingUI();
    };

    const loadDetailImages = (a) => {
      const grid = els.detailGrid;
      if (!grid) return;
      grid.innerHTML = "";
      // keyInfo detail images
      if (a._keyInfo) {
        a._keyInfo.filter(kv => kv.k && kv.k.startsWith("detail_image_")).forEach(kv => {
          // (2026-05-11 v271) Wrap each thumbnail in a tile with a
          //   delete X. Click → confirm → DELETE the detail_image row
          //   (and unlink the file). data-url attribute holds the
          //   original /uploads/... path so the click handler can
          //   send it back to the server unchanged.
          const tile = document.createElement("div");
          tile.className = "adm-detail-tile";
          tile.dataset.url = String(kv.v || "");

          const img = document.createElement("img");
          img.src = absUrl(kv.v);
          img.alt = kv.k;

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "adm-detail-del-btn";
          btn.title = "이 세부 이미지 삭제";
          btn.textContent = "✕";

          tile.appendChild(img);
          tile.appendChild(btn);
          grid.appendChild(tile);
        });
      }
    };

    // (2026-05-11 v271) Toggle the [✕ 자산 이미지 삭제] button visibility
    //   based on whether #admImageUrl has a value. Called after fillForm
    //   and after successful upload / delete.
    const refreshAssetImageDeleteVisibility = () => {
      const row = document.getElementById("admImageDeleteRow");
      if (!row) return;
      const hasUrl = String(els.imageUrl?.value || "").trim() !== "";
      row.style.display = hasUrl ? "" : "none";
    };

    const loadAprHistory = async (assetId) => {
      if (!els.aprHistory || !els.aprHistoryList) return;
      try {
        const r = await api(`/api/admin/assets/${encodeURIComponent(assetId)}/apr-history`);
        const history = r.history || [];
        if (history.length > 0) {
          els.aprHistory.style.display = "block";
          const todayStr = new Date().toISOString().slice(0, 10);
          els.aprHistoryList.innerHTML = history.map(h => {
            const isPending = String(h.effective_from) > todayStr;
            const badge = isPending
              ? '<span style="background:#fbbf24;color:#78350f;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;margin-left:4px">예정(다음 회차)</span>'
              : (h.reason === 'initial'
                  ? '<span style="color:#64748b;font-size:11px;margin-left:4px">(초기)</span>'
                  : '<span style="color:#64748b;font-size:11px;margin-left:4px">(적용됨)</span>');
            return `<div style="padding:3px 0;border-bottom:1px solid var(--border)">APR ${h.apr}% · 적용 회차: ${h.effective_from}${badge}</div>`;
          }).join("");
        } else {
          els.aprHistory.style.display = "none";
        }
      } catch (e) {
        els.aprHistory.style.display = "none";
      }
    };

    const buildPayload = () => {
      const id = toStr(els.id.value);
      if (!id) throw new Error("자산 ID가 필요합니다.");

      const base = Object.assign({}, current || {});
      // (2026-05-07) Silica USDT-fixed — fallback KRW → USDT.
      const ccy = String(els.currency?.value || base.settlement_basis || "USDT").toUpperCase();

      return {
        id,
        // These won't be updated for existing assets (API ignores them)
        country_code: String(els.country?.value || base.country_code || "KR").toUpperCase(),
        settlement_basis: ccy,
        market: toStr(els.market.value) ?? base.market,
        name: toStr(els.name.value) ?? base.name,
        type: toStr(els.type.value),
        location: toStr(els.location.value),

        // Mutable fields
        status: toStr(els.status.value) ?? base.status ?? "모집중",
        map_query: toStr(els.mapQuery.value),
        google_map_url: toStr(els.googleMapUrl?.value),
        image_url: toStr(els.imageUrl.value),
        token_image_url: toStr(els.tokenImageUrl.value),
        overview: toStr(els.overview.value),
        target_usdt: toNum(els.target.value, 0),
        min_usdt: toNum(els.min.value, 50),
        expected_buy_price_usdt: toNum(els.expectedBuy.value, null),
        apr: toNum(els.apr.value, 8),
        fund_end_date: toStr(els.fundEnd.value),
        fx_at_funding: toNum(els.fxAtFunding.value, 0),
        official_price_krw: toNum(els.officialKrw.value, null),
        supply_token: toNum(els.supply.value, 0),
        funded_snapshot_usdt: toNum(els.snapshot.value, null),
        fee_buyer: toNum(els.feeBuyer.value, 0.5),
        fee_seller: toNum(els.feeSeller.value, 0.5),
        is_public: toNum(els.isPublic?.value, 0),
        token_mint_address: normalizeMintValue(toStr(els.tokenMintAddress?.value)),
      };
    };


    const getEditingAssetId = () => String(els.id?.value || current?.id || "").trim();

    const buildOpsPayload = () => ({
      id: getEditingAssetId(),
      fund_end_date: toStr(els.fundEnd?.value),
      fx_at_funding: toNum(els.fxAtFunding?.value, 0),
      official_price_krw: toNum(els.officialKrw?.value, null),
      fee_buyer: toNum(els.feeBuyer?.value, 0.5),
      fee_seller: toNum(els.feeSeller?.value, 0.5),
    });

    const setScopedSaveButtons = () => {
      const hasAsset = !!getEditingAssetId();
      if (els.opsSaveBtn) els.opsSaveBtn.disabled = !hasAsset;
      if (els.saveMintBtn) {
        const locked = hasAsset ? isMintLocked(current) : true;
        const mint = normalizeMintValue(els.tokenMintAddress?.value || current?.token_mint_address || "");
        const mintReady = mint !== "" && !getMintValidationError(mint, { allowEmpty: false });
        els.saveMintBtn.disabled = !hasAsset || locked || !mintReady;
        els.saveMintBtn.textContent = "저장";
        // 재발 방지: 토큰 분배가 시작된 뒤에는 민트 주소를 바꾸면 안 되므로 버튼 자체를 숨긴다.
        // 위치도 입력칸 바로 옆으로 고정해서, 저장 동작이 일반 자산 저장과 섞이지 않게 유지한다.
        els.saveMintBtn.style.display = (hasAsset && !locked) ? "inline-flex" : "none";
      }
    };

    const save = async (payload) => {
      // (v493) 응답 반환 — 운영자 진단 (immutable_note 등 backend 메시지 확인용)
      return await api("/api/admin/assets/upsert", { method: "POST", body: { asset: payload } });
    };

    // (2026-05-11) Fetch on-chain SilicaSTO supply from Solana RPC.
    // Updates the global cache used by renderAssetRowHtml so the 발행
    // column reflects on-chain truth rather than the DB planned amount.
    // Failures are non-fatal — the table just falls back to the DB value
    // with a 'DB 계획값 (on-chain 미조회)' note.
    const loadOnChainSupply = async () => {
      try {
        const r = await api("/api/admin/silica/onchain-supply");
        if (r && Number.isFinite(Number(r.ui_supply))) {
          __silicaOnChainSupply = Number(r.ui_supply);
        } else {
          __silicaOnChainSupply = null;
        }
      } catch (_e) {
        __silicaOnChainSupply = null;
      }
    };

    // (2026-05-18 v492) silica_max_sto_supply 로드 — '목표' 컬럼에 표시.
    const loadMaxStoSupply = async () => {
      try {
        const r = await api("/api/admin/silica/max-supply");
        __silicaMaxStoSupply = Number(r?.max_supply || 0);
      } catch (_e) {
        __silicaMaxStoSupply = 0;
      }
    };

    const refresh = async (keepId = null) => {
      await Promise.all([loadAssets(), loadOnChainSupply(), loadMaxStoSupply()]);
      renderList();
      if (keepId) {
        const a = await loadDetail(keepId);
        if (a) fillForm(a);
      }
    };

    // =========================
    // Event listeners
    // =========================

    els.currency?.addEventListener("change", () => setCurLabels(els.currency.value));

    // (2026-05-11 v282) Document upload handler 제거 — 카드 자체가 사라짐.

    // File upload
    const doUpload = async () => {
      const assetId = String(els.id?.value || "").trim();
      if (!assetId) return toast("자산 ID가 필요합니다.", "bad");

      const img = els.imageFile?.files?.[0] || null;
      const tok = els.tokenFile?.files?.[0] || null;
      const detailFiles = els.detailImages?.files || [];
      if (!img && !tok && detailFiles.length === 0) return toast("업로드할 파일을 선택하세요.", "bad");

      const fd = new FormData();
      if (img) fd.append("image", img);
      if (tok) fd.append("token", tok);
      for (let i = 0; i < detailFiles.length; i++) {
        fd.append("detail_images[]", detailFiles[i]);
      }

      const r = await uploadForm(`/api/admin/assets/${encodeURIComponent(assetId)}/images`, fd);

      if (r.image_url && els.imageUrl) els.imageUrl.value = r.image_url;
      if (r.token_image_url && els.tokenImageUrl) els.tokenImageUrl.value = r.token_image_url;

      setPreview(els.imagePreview, r.image_url || els.imageUrl?.value || "");
      setPreview(els.tokenPreview, r.token_image_url || els.tokenImageUrl?.value || "");

      if (els.imageFile) els.imageFile.value = "";
      if (els.tokenFile) els.tokenFile.value = "";
      if (els.detailImages) els.detailImages.value = "";


      return r;
    };

    els.uploadImagesBtn?.addEventListener("click", async () => {
      try {
        const r = await doUpload();
        // (2026-05-26 v834) 서버가 reject 한 파일이 있으면 사용자에게 사유 노출.
        //   예: SVG 의 finfo MIME 이 환경별로 달라 silent skip 되던 케이스 진단.
        if (r && Array.isArray(r.rejected) && r.rejected.length > 0) {
          const why = r.rejected.join('\n');
          console.warn('[admin/assets] rejected files:', r.rejected);
          toast('일부 파일이 거부됨:\n' + why, 'bad');
        } else {
          toast("파일 업로드 완료", "good");
        }
        const assetId = String(els.id?.value || "").trim();
        if (assetId) await refresh(assetId);
      } catch (e) {
        toast(e.message || "업로드 실패", "bad");
      }
    });

    els.imageFile?.addEventListener("change", () => {
      const f = els.imageFile.files?.[0];
      if (f) fileToPreviewDataUrl(f, els.imagePreview);
    });

    els.tokenFile?.addEventListener("change", () => {
      const f = els.tokenFile.files?.[0];
      if (f) fileToPreviewDataUrl(f, els.tokenPreview);
    });

    // (2026-05-11 v271) Delete asset main image — operator: '등록 된
    //   자산 이미지 삭제 할 수 있도록 구현 해줘.' Clears the URL on
    //   the server and on screen. Confirmation prompt is required so a
    //   mis-click doesn't blow away an asset's hero image.
    qs("#admImageDeleteBtn")?.addEventListener("click", async () => {
      const assetId = String(els.id?.value || "").trim();
      if (!assetId) return toast("자산 ID가 필요합니다.", "bad");
      const hadUrl = String(els.imageUrl?.value || "").trim();
      if (!hadUrl) return toast("삭제할 이미지가 없습니다.", "bad");
      if (!confirm("자산 이미지를 삭제하시겠습니까?\n파일도 서버에서 함께 삭제됩니다.")) return;
      try {
        await api(`/api/admin/assets/${encodeURIComponent(assetId)}/image/delete`, {
          method: "POST",
          body: { which: "main" },
        });
        toast("이미지 삭제 완료", "good");
        // Clear the URL field + preview so the UI reflects the new state
        //   without waiting for refresh().
        if (els.imageUrl)     els.imageUrl.value = "";
        if (els.imagePreview) { els.imagePreview.src = ""; els.imagePreview.style.display = "none"; }
        refreshAssetImageDeleteVisibility();
        await refresh(assetId);
      } catch (e) {
        toast(e.message || "삭제 실패", "bad");
      }
    });

    // (2026-05-11 v271) Delete a single detail image — X button on each
    //   thumbnail. data-url is set by loadDetailImages() above.
    els.detailGrid?.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.(".adm-detail-del-btn");
      if (!btn) return;
      const tile = btn.closest(".adm-detail-tile");
      const url = String(tile?.dataset?.url || "").trim();
      const assetId = String(els.id?.value || "").trim();
      if (!url || !assetId) return;
      if (!confirm("이 세부 이미지를 삭제하시겠습니까?\n파일도 서버에서 함께 삭제됩니다.")) return;
      try {
        await api(`/api/admin/assets/${encodeURIComponent(assetId)}/detail-image/delete`, {
          method: "POST",
          body: { url },
        });
        toast("세부 이미지 삭제 완료", "good");
        if (tile && tile.parentNode) tile.parentNode.removeChild(tile);
        await refresh(assetId);
      } catch (err) {
        toast(err.message || "삭제 실패", "bad");
      }
    });

    // =========================
    // (2026-05-11) Token logo management — USDT / SilicaSTO / Silica
    // =========================
    // The three system tokens have logos that aren't tied to any single
    // asset row, so the values live in app_settings rather than the
    // assets table. UI flow: pick a file → upload → URL stored in settings
    // → preview updated. '기본으로' button clears the override so the
    // bundled SVG is used instead.
    // ---------------------------------------------------------------
    const LOGO_DEFAULTS = {
      usdt:      "/user/assets/images/token-usdt.svg",
      silicasto: "/user/assets/images/token-silicasto.svg",
      silica:    "/user/assets/images/token-silica.svg",
    };
    const LOGO_LABELS = {
      usdt:      "USDT",
      silicasto: "SilicaSTO",
      silica:    "Silica",
    };
    const logoEls = {
      usdt:      { img: qs("#admLogoPrevUsdt"),      urlNote: qs("#admLogoUrlUsdt"),      file: qs("#admLogoFileUsdt") },
      silicasto: { img: qs("#admLogoPrevSilicasto"), urlNote: qs("#admLogoUrlSilicasto"), file: qs("#admLogoFileSilicasto") },
      silica:    { img: qs("#admLogoPrevSilica"),    urlNote: qs("#admLogoUrlSilica"),    file: qs("#admLogoFileSilica") },
    };

    const renderLogoRow = (token, url) => {
      const ref = logoEls[token];
      if (!ref) return;
      const effective = String(url || "").trim();
      // (2026-05-26 v847) /uploads/ → /api/file/ swap (admin 도 v843 패턴 적용).
      //   absUrl 가 swap 처리하므로 그쪽 경유. urlNote 는 운영자에게 원본 경로
      //   보여주는 게 좋아 원본 그대로.
      if (ref.img) ref.img.src = effective ? absUrl(effective) : LOGO_DEFAULTS[token];
      if (ref.urlNote) {
        ref.urlNote.textContent = effective ? effective : "기본 로고";
        ref.urlNote.style.color = effective ? "var(--text, #0f172a)" : "var(--muted, #64748b)";
      }
    };

    const loadTokenLogos = async () => {
      try {
        const r = await api("/api/admin/silica/token-logos");
        const logos = r?.logos || {};
        Object.keys(logoEls).forEach(tok => renderLogoRow(tok, logos[tok] || ""));
      } catch (_e) {
        Object.keys(logoEls).forEach(tok => renderLogoRow(tok, ""));
      }
    };

    // File-picked preview (before upload) — show the chosen image
    // immediately so the operator can sanity-check before submitting.
    Object.entries(logoEls).forEach(([tok, ref]) => {
      ref.file?.addEventListener("change", () => {
        const f = ref.file.files?.[0];
        if (f && ref.img) fileToPreviewDataUrl(f, ref.img);
      });
    });

    const uploadTokenLogo = async (token) => {
      const ref = logoEls[token];
      if (!ref) return;
      const f = ref.file?.files?.[0];
      if (!f) return toast(`${LOGO_LABELS[token]} 파일을 선택하세요.`, "bad");
      if (f.size > 2 * 1024 * 1024) return toast("파일은 2 MB 이하여야 합니다.", "bad");

      try {
        const fd = new FormData();
        fd.append("token", token);
        fd.append("file", f);
        const r = await uploadForm("/api/admin/silica/token-logos/upload", fd);
        renderLogoRow(token, r?.url || "");
        if (ref.file) ref.file.value = "";
        toast(`${LOGO_LABELS[token]} 로고 업데이트 완료`, "good");
      } catch (e) {
        toast(e.message || "업로드 실패", "bad");
      }
    };

    const clearTokenLogo = async (token) => {
      if (!confirm(`${LOGO_LABELS[token]} 로고를 기본값으로 되돌립니까?`)) return;
      try {
        await api("/api/admin/silica/token-logos/clear", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        renderLogoRow(token, "");
        toast(`${LOGO_LABELS[token]} 기본 로고로 복원`, "good");
      } catch (e) {
        toast(e.message || "복원 실패", "bad");
      }
    };

    qsa('[data-logo-upload]').forEach(btn => {
      btn.addEventListener("click", () => uploadTokenLogo(btn.getAttribute("data-logo-upload")));
    });
    qsa('[data-logo-clear]').forEach(btn => {
      btn.addEventListener("click", () => clearTokenLogo(btn.getAttribute("data-logo-clear")));
    });

    // Initial paint
    loadTokenLogos();

    els.openSearchModal?.addEventListener("click", openSearchModal);
    [els.filterQuery, els.filterType, els.filterStatus].forEach((el) => {
      el?.addEventListener(el === els.filterQuery ? "input" : "change", renderSearchModalList);
    });
    els.tokenMintAddress?.addEventListener("input", () => {
      const trimmed = normalizeMintValue(els.tokenMintAddress?.value);
      if (els.tokenMintAddress) els.tokenMintAddress.value = trimmed;
      setScopedSaveButtons();
    });
    els.tokenMintAddress?.addEventListener("blur", () => {
      if (els.tokenMintAddress) els.tokenMintAddress.value = normalizeMintValue(els.tokenMintAddress.value);
      setScopedSaveButtons();
    });
    els.clearFiltersBtn?.addEventListener("click", () => {
      clearFilters();
      toast("필터를 초기화했습니다.", "good");
    });
    els.searchApply?.addEventListener("click", applyFilters);
    els.searchCancel?.addEventListener("click", closeSearchModal);
    els.searchReset?.addEventListener("click", () => {
      clearFilters();
      closeSearchModal();
    });
    els.searchModal?.addEventListener("click", (e) => {
      if (e.target === els.searchModal) closeSearchModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.searchModal?.classList.contains("show")) {
        closeSearchModal();
      }
    });

    els.refreshBtn?.addEventListener("click", async () => {
      try {
        await refresh(current?.id || null);
        toast("새로고침 완료", "good");
      } catch (e) { toast(e.message || "실패", "bad"); }
    });

    // (v485) 자산 강제 시드 — Hostinger OPcache 등으로 lazy auto-seed 가
    //   안 도는 경우 우회. 응답에 시드 결과 표시.
    els.forceSeedBtn?.addEventListener("click", async () => {
      try {
        els.forceSeedBtn.disabled = true;
        const r = await api("/api/admin/silica/force-seed-asset", { method: "POST" });
        const msg = r.message || (r.seeded ? "시드 완료" : "이미 자산 있음");
        toast(`${msg} — 자산 ${r.count}건`, "good");
        await refresh(current?.id || null);
      } catch (e) {
        toast(e.message || "강제 시드 실패", "bad");
      } finally {
        els.forceSeedBtn.disabled = false;
      }
    });

    // Save
    els.saveBtn?.addEventListener("click", async () => {
      try {
        const assetId = String(els.id?.value || "").trim();
        if (!assetId) throw new Error("자산 ID가 필요합니다.");

        // Upload files first if any
        const hasFiles = (els.imageFile?.files?.length || 0) + (els.tokenFile?.files?.length || 0)
          + (els.detailImages?.files?.length || 0);
        // (2026-05-26 v837) 저장 버튼의 업로드 reject 처리 누락 fix.
        //   기존엔 doUpload 가 200 OK 로 반환하면 reject 여부 무관하게 "완료"
        //   토스트 표시 후 save() 진행 → buildPayload 가 빈 imageUrl 값으로
        //   덮어써서 메인 이미지가 사라지는 비대칭 (세부는 별도 테이블이라
        //   영향 X). 이제 reject 항목이 있으면 toast 로 사유 노출 + console.warn.
        //   메인 이미지가 reject 된 경우 save 흐름을 중단 → 빈 값 덮어쓰기 방지.
        let mainImageRejected = false;
        let mainImageSilentLoss = false;
        const mainImageSelected = (els.imageFile?.files?.length || 0) > 0;
        if (hasFiles > 0) {
          try {
            const r = await doUpload();
            console.log('[admin/assets] doUpload response:', r);
            if (r && Array.isArray(r.rejected) && r.rejected.length > 0) {
              const why = r.rejected.join('\n');
              console.warn('[admin/assets] rejected files:', r.rejected);
              toast('일부 파일이 거부됨:\n' + why, 'bad');
              if (r.rejected.some((rec) => /^image\b/i.test(String(rec || '')))) {
                mainImageRejected = true;
              }
            } else {
              toast("파일 업로드 완료", "good");
            }
            // 메인 이미지를 선택했는데 response 에 image_url 이 없는 silent loss 케이스
            if (mainImageSelected && !r?.image_url && !mainImageRejected) {
              mainImageSilentLoss = true;
              console.warn('[admin/assets] main image selected but no image_url in response', r);
            }
          } catch (ue) {
            toast("파일 업로드 실패: " + ue.message, "bad");
            return;
          }
          if (mainImageRejected || mainImageSilentLoss) {
            const msg = mainImageSilentLoss
              ? '메인 자산 이미지가 서버에서 처리되지 않은 것 같습니다. F12 Console 의 response 를 확인하세요. 저장을 중단합니다.'
              : '메인 자산 이미지 업로드가 거부되어 저장을 중단합니다. 위 사유를 확인 후 다른 파일로 다시 시도하세요.';
            toast(msg, 'bad');
            return;
          }
        }

        const mintValidationError = getMintValidationError(els.tokenMintAddress?.value, { allowEmpty: true });
        if (mintValidationError) throw new Error(mintValidationError);
        if (els.tokenMintAddress) els.tokenMintAddress.value = normalizeMintValue(els.tokenMintAddress.value);
        const payload = buildPayload();

        // (2026-05-18 v491) 운영자 보고: '자산명 변경했지만 표에 반영 안 됨'.
        //   '자산명 (한국어)' 입력값이 asset_key_info.name_ko 에만 저장되고
        //   등록 자산 표 (renderAssetRowHtml) 는 assets.name 컬럼을 보여줘
        //   불일치. 단일 자산 모델에서 두 값 동기화 — 한국어 자산명을
        //   assets.name 으로도 함께 업데이트하여 표가 즉시 반영되도록.
        // (v493) 진단 로그 추가 — 운영자 보고: v491 후에도 반영 안 됨.
        console.log('[admin/assets] BEFORE name sync — payload.name=', payload.name, 'els.nameKo.value=', els.nameKo?.value, 'els.name.value=', els.name?.value);
        if (els.nameKo) {
          const koVal = String(els.nameKo.value || "").trim();
          if (koVal !== "") {
            payload.name = koVal; // upsert 페이로드의 name 필드를 한국어 값으로 덮어쓰기
          }
        }
        console.log('[admin/assets] AFTER name sync — payload.name=', payload.name, 'full payload=', payload);

        const saveRes = await save(payload);
        console.log('[admin/assets] save() response:', saveRes);

        // (2026-05-11 v268) Persist per-language overview override
        //   alongside the main upsert. Sent to a dedicated key-info
        //   endpoint because the assets table doesn't have a column
        //   for it (asset_key_info pattern matches detail_image_*).
        //   Failure here is non-fatal — the main asset upsert already
        //   succeeded.
        if (els.overviewEn) {
          try {
            await api(`/api/admin/assets/${encodeURIComponent(payload.id)}/key-info`, {
              method: "POST",
              body: { key: "overview_en", value: String(els.overviewEn.value || "") },
            });
          } catch (ke) {
            toast("영문 개요 저장 실패: " + (ke?.message || ke), "bad");
          }
        }

        // (2026-05-17 v436) Per-language asset name 도 함께 저장 — 사용자 페이지
        //   의 lang 분기에 사용.
        // (2026-05-18 v489) 운영자 보고: '자산명 입력 후 저장했지만 새로고침
        //   하니 제거되고 반영 안 됨'. 진단 강화 — 실패 시 자세한 에러를
        //   inline feedback 에도 노출, 토스트 누락 방지.
        let nameSaveErrors = [];
        if (els.nameEn) {
          try {
            const enVal = String(els.nameEn.value || "").trim();
            const enRes = await api(`/api/admin/assets/${encodeURIComponent(payload.id)}/key-info`, {
              method: "POST",
              body: { key: "name_en", value: enVal },
            });
            console.log('[admin/assets] name_en saved:', enRes, 'value=', enVal);
          } catch (ke) {
            const msg = "영문 자산명 저장 실패: " + (ke?.message || String(ke));
            console.error('[admin/assets] name_en save FAILED', ke);
            nameSaveErrors.push(msg);
            toast(msg, "bad");
          }
        }
        if (els.nameKo) {
          try {
            const koVal = String(els.nameKo.value || "").trim();
            const koRes = await api(`/api/admin/assets/${encodeURIComponent(payload.id)}/key-info`, {
              method: "POST",
              body: { key: "name_ko", value: koVal },
            });
            console.log('[admin/assets] name_ko saved:', koRes, 'value=', koVal);
          } catch (ke) {
            const msg = "한국어 자산명 저장 실패: " + (ke?.message || String(ke));
            console.error('[admin/assets] name_ko save FAILED', ke);
            nameSaveErrors.push(msg);
            toast(msg, "bad");
          }
        }

        if (nameSaveErrors.length > 0) {
          toast("일부 항목 저장 실패 — 자세한 사항은 콘솔/네트워크 확인", "bad");
          showInlineFeedback(els.saveFeedback, "저장 부분 실패: " + nameSaveErrors.join(" / "), "bad");
        } else {
          toast("저장 완료", "good");
          showInlineFeedback(els.saveFeedback, "저장되었습니다.", "good");
        }
        await refresh(payload.id);
      } catch (e) {
        showInlineFeedback(els.saveFeedback, e.message || "저장 실패", "bad");
        toast(e.message || "저장 실패", "bad");
      }
    });

    els.saveMintBtn?.addEventListener("click", async () => {
      try {
        const assetId = String(els.id?.value || current?.id || "").trim();
        if (!assetId) throw new Error("자산을 먼저 선택하세요.");
        if (isMintLocked(current)) throw new Error("토큰 분배가 시작된 이후에는 토큰 민트 주소를 수정할 수 없습니다.");
        const mint = normalizeMintValue(els.tokenMintAddress?.value);
        const mintValidationError = getMintValidationError(mint, { allowEmpty: false });
        if (mintValidationError) throw new Error(mintValidationError);
        if (els.tokenMintAddress) els.tokenMintAddress.value = mint;
        await save({ id: assetId, token_mint_address: mint });
        toast("토큰 민트 주소 저장 완료", "good");
        showInlineFeedback(els.mintSaveFeedback, "저장되었습니다.", "good");
        await refresh(assetId);
      } catch (e) {
        showInlineFeedback(els.mintSaveFeedback, e.message || "저장 실패", "bad");
        toast(e.message || "토큰 민트 주소 저장 실패", "bad");
      }
    });


    els.opsSaveBtn?.addEventListener("click", async () => {
      try {
        const assetId = getEditingAssetId();
        if (!assetId) throw new Error("자산을 먼저 선택하세요.");
        await save(buildOpsPayload());
        toast("운영 / 정산 / 발행 정보 저장 완료", "good");
        showInlineFeedback(els.opsSaveFeedback, "저장되었습니다.", "good");
        await refresh(assetId);
      } catch (e) {
        showInlineFeedback(els.opsSaveFeedback, e.message || "저장 실패", "bad");
        toast(e.message || "운영 / 정산 / 발행 정보 저장 실패", "bad");
      }
    });

    // (2026-05-11 v273) Delete-asset handler — DISABLED.
    //   Operator: '자산 삭제 버튼 제거해라. 버튼뿐만 아니라, 완전히
    //   삭제 될 수 없도록 해야한다.' Silica is single-asset so deleting
    //   SILICA-79907 would orphan every dependent record (holdings,
    //   trades, contracts, ...). The button is hidden via display:none
    //   in admin/assets.html and the backend endpoint also returns
    //   403 unconditionally, so even if a stale tab somehow fires the
    //   click, the request is rejected server-side.
    //   The element is still bound here (rather than removed) so a
    //   future operator who restores the button doesn't have to also
    //   remember to re-bind the JS.
    if (els.deleteBtn) {
      els.deleteBtn.addEventListener("click", () => {
        toast("자산 삭제는 비활성화되어 있습니다.", "bad");
      });
    }

    // ============ Funding management ============
    updateFundingUI = () => {
      if (!current) {
        if (els.fundingActions) els.fundingActions.style.display = "none";
        if (els.fundingEmpty) els.fundingEmpty.style.display = "block";
        setScopedSaveButtons();
        return;
      }
      if (els.fundingEmpty) els.fundingEmpty.style.display = "none";
      if (els.fundingActions) els.fundingActions.style.display = "block";

      const st = String(current.status || "");
      const raised = Number(current.raised_usdt || 0);
      const target = Number(current.target_usdt || 0);
      const pct = target > 0 ? ((raised / target) * 100).toFixed(1) : "0.0";

      const issueQty = plannedIssueQty(current);
      if (els.fundingStatus) {
        els.fundingStatus.innerHTML = `
          <div><strong>상태:</strong> ${st || '-'}</div>
          <div><strong>모금:</strong> ${fmtNum(raised,2)} / ${fmtNum(target,2)} USDT (${pct}%)</div>
          <div><strong>발행 예정:</strong> ${fmtIssueQty(issueQty)} ${current?.id || 'TOKEN'}</div>
        `;
      }
      updateDerivedTokenInfo(current);

      const hasFundingTrail = (raised > 0 || Number(current?.funded_snapshot_usdt || 0) > 0 || (Array.isArray(assetContracts) && assetContracts.length > 0));
      const canCancel = ["모집중","구매진행","모집실패","취소됨"].includes(st) && hasFundingTrail;
      if (els.cancelFundingBtn) els.cancelFundingBtn.style.display = canCancel ? "" : "none";

      // Proceed button: visible for 모집중 when raised > 0
      const canProceed = st === "모집중" && raised > 0;
      if (els.proceedBuyBtn) els.proceedBuyBtn.style.display = canProceed ? "" : "none";

      // Start distribution: visible for 구매진행 only
      const canStartDistribution = st === "구매진행";
      if (els.startDistributionBtn) els.startDistributionBtn.style.display = canStartDistribution ? "" : "none";
    };

    els.cancelFundingBtn?.addEventListener("click", async () => {
      const assetId = String(els.id?.value || "").trim();
      if (!assetId) return toast("자산을 선택하세요.", "bad");
      const status = String(current?.status || "");
      const isBuying = status === "구매진행";
      const confirmText = isBuying
        ? `정말로 "${assetId}" 자산의 매입을 취소하시겠습니까?

모든 참여자에게 투자 USDT가 전액 환불되고 상태가 '취소됨'으로 변경됩니다.
이미 토큰 분배/거래/정산이 진행된 경우에는 취소할 수 없습니다.
이 작업은 되돌릴 수 없습니다.`
        : `정말로 "${assetId}"의 모금을 취소하시겠습니까?

모든 참여자에게 투자 USDT가 전액 환불되고 상태가 '모집실패'로 변경됩니다.
이 작업은 되돌릴 수 없습니다.`;
      if (!confirm(confirmText)) return;
      try {
        const r = await api(`/api/admin/assets/${encodeURIComponent(assetId)}/cancel-funding`, { method: "POST", body: { action: "cancel" } });
        toast(r?.message || (isBuying ? "매입 취소 및 환불 완료" : "모금 취소 및 환불 완료"), "good");
        await refresh(assetId);
      } catch (e) { toast(e.message || "취소 실패", "bad"); }
    });

    els.startDistributionBtn?.addEventListener("click", async () => {
      const assetId = String(els.id?.value || "").trim();
      if (!assetId) return toast("자산을 선택하세요.", "bad");
      const mintAddress = normalizeMintValue(els.tokenMintAddress?.value || current?.token_mint_address || "");
      if (!mintAddress) {
        toast("토큰 컨트랙트가 추가되어 있지 않습니다. 토큰 민트 주소를 먼저 입력하세요.", "bad");
        els.tokenMintAddress?.focus();
        return;
      }
      if (!isLikelySolanaAddress(mintAddress)) {
        toast("정상적인 솔라나 주소가 아닙니다.", "bad");
        els.tokenMintAddress?.focus();
        return;
      }
      const issueQty = plannedIssueQty(current);
      const tokenName = String(current?.name || assetId).trim() || assetId;
      const tokenSymbol = assetId;
      const msg = `"${assetId}" 자산의 토큰 분배를 시작하시겠습니까?

토큰명: ${tokenName}
약어: ${tokenSymbol}
소수점: 1
민트 주소: ${mintAddress}
발행 필요 수량: ${fmtIssueQty(issueQty)} ${tokenSymbol}

분배 시작 시 1 USDT = 1 Token 기준으로 토큰 수량이 확정됩니다.`;
      if (!confirm(msg)) return;
      try {
        const r = await api(`/api/admin/assets/${encodeURIComponent(assetId)}/cancel-funding`, { method: "POST", body: { action: "start_distribution" } });
        toast(r?.message || "토큰 분배 시작 완료", "good");
        await refresh(assetId);
      } catch (e) {
        toast(e.message || "토큰 분배 시작 실패", "bad");
      }
    });

    els.proceedBuyBtn?.addEventListener("click", async () => {
      const assetId = String(els.id?.value || "").trim();
      if (!assetId) return toast("자산을 선택하세요.", "bad");
      if (!confirm(`"${assetId}" 자산의 부동산 매입을 진행하시겠습니까?\n\n상태가 '구매진행'으로 변경됩니다.`)) return;
      try {
        const payload = buildPayload();
        payload.status = "구매진행";
        await save(payload);
        toast("구매진행 상태로 변경 완료", "good");
        await refresh(assetId);
      } catch (e) { toast(e.message || "상태 변경 실패", "bad"); }
    });

    // =========================
    // Create Modal
    // =========================
    els.newBtn?.addEventListener("click", () => {
      els.createModal.classList.add("show");
      // Reset form
      if (els.newType) els.newType.value = "";
      if (els.newId) els.newId.value = "";
      if (els.newName) els.newName.value = "";
      if (els.newCountry) els.newCountry.value = "KR";
      if (els.newCurrency) els.newCurrency.value = "KRW";
      if (els.newLocation) els.newLocation.value = "";
      if (els.newMapQuery) els.newMapQuery.value = "";
      if (els.newTarget) els.newTarget.value = "";
      if (els.newExpectedBuy) els.newExpectedBuy.value = "";
      if (els.newApr) els.newApr.value = "8.00";
      if (els.newFundEnd) els.newFundEnd.value = "";
      if (els.newOverview) els.newOverview.value = "";
    });

    els.createCancel?.addEventListener("click", () => {
      els.createModal.classList.remove("show");
    });

    // Auto-generate ID when type is selected
    els.newType?.addEventListener("change", async () => {
      const type = els.newType.value;
      if (!type) { if (els.newId) els.newId.value = ""; return; }
      try {
        const r = await api("/api/admin/assets/generate-id", { method: "POST", body: { type } });
        if (els.newId) els.newId.value = r.id || "";
      } catch (e) {
        toast("ID 생성 실패: " + e.message, "bad");
      }
    });

    // Create submit
    els.createSubmit?.addEventListener("click", async () => {
      try {
        const type = els.newType?.value;
        const name = els.newName?.value?.trim();
        const location = els.newLocation?.value?.trim();
        const target = parseFloat(els.newTarget?.value) || 0;

        if (!type) throw new Error("자산 종류를 선택하세요.");
        if (!name) throw new Error("자산명을 입력하세요.");
        if (!location) throw new Error("주소를 입력하세요.");
        if (target <= 0) throw new Error("목표 모금액을 입력하세요.");

        const payload = {
          type,
          name,
          country_code: els.newCountry?.value || "KR",
          // (2026-05-07) Silica USDT-fixed — 신규 자산 기본 정산통화 USDT.
          settlement_basis: els.newCurrency?.value || "USDT",
          location,
          map_query: els.newMapQuery?.value?.trim() || location,
          google_map_url: qs("#admNewGoogleMapUrl")?.value?.trim() || "",
          target_usdt: target,
          expected_buy_price_usdt: parseFloat(els.newExpectedBuy?.value) || null,
          apr: parseFloat(els.newApr?.value) || 8,
          fund_end_date: String(els.newFundEnd?.value || "").trim() || null,
          overview: els.newOverview?.value?.trim() || "",
          min_usdt: 50,
          fee_buyer: 0.5,
          fee_seller: 0.5,
          is_public: 0,
        };

        const r = await api("/api/admin/assets/create", { method: "POST", body: { asset: payload } });
        const newId = r.id;

        toast(`자산 생성 완료: ${newId}`, "good");

        // Upload images if selected
        const img = els.newImage?.files?.[0];
        const tok = els.newTokenImage?.files?.[0];
        if ((img || tok) && newId) {
          const fd = new FormData();
          if (img) fd.append("image", img);
          if (tok) fd.append("token", tok);
          try {
            await uploadForm(`/api/admin/assets/${encodeURIComponent(newId)}/images`, fd);
            toast("이미지 업로드 완료", "good");
          } catch (ue) {
            toast("이미지 업로드 실패: " + ue.message, "bad");
          }
        }

        els.createModal.classList.remove("show");
        await refresh(newId);
      } catch (e) {
        toast(e.message || "자산 생성 실패", "bad");
      }
    });

    // =========================
    // Template assignment buttons (using modal picker)
    // =========================
    qs("#admAssetTmplAssignBtn")?.addEventListener("click", async () => {
      const assetId = String(els.id?.value || "").trim();
      if (!assetId) return toast("\uc790\uc0b0\uc744 \uba3c\uc800 \uc120\ud0dd\ud558\uc138\uc694.", "bad");

      const templateId = await openTemplatePicker({
        title: "\uacc4\uc57d\uc11c \ud15c\ud50c\ub9bf \uc120\ud0dd",
        subtitle: `${assetId} \uc790\uc0b0\uc5d0 \uc801\uc6a9\ud560 \uacc4\uc57d\uc11c \ud15c\ud50c\ub9bf\uc744 \uc120\ud0dd\ud558\uc138\uc694.`,
      });
      if (!templateId) return;

      try {
        const r = await api(`/api/admin/assets/${encodeURIComponent(assetId)}/template/assign`, {
          method: "POST", body: { template_id: parseInt(templateId) }
        });
        toast(`${r.template_name} \ud15c\ud50c\ub9bf \uc801\uc6a9 \uc644\ub8cc`, "good");
        loadAssetTemplate(assetId);
      } catch (e) {
        // (v501) \uc804\uccb4 \uc5d0\ub7ec \uac1d\uccb4 + payload(diag) \ucf58\uc194 \ub364\ud504 \u2014 F12 \uc5d0\uc11c \uc989\uc2dc \uc6d0\uc778 \ud655\uc778
        console.error('[admin/assets] template/assign FAILED', {
          message: e?.message,
          status: e?.status,
          payload: e?.payload,
          diag: e?.payload?.diag,
        });
        toast(e.message || "\uc801\uc6a9 \uc2e4\ud328", "bad");
      }
    });

    qs("#admAssetTmplUnlinkBtn")?.addEventListener("click", async () => {
      const assetId = String(els.id?.value || "").trim();
      if (!assetId) return toast("\uc790\uc0b0\uc744 \uba3c\uc800 \uc120\ud0dd\ud558\uc138\uc694.", "bad");
      if (!confirm(`${assetId} \uc790\uc0b0\uc758 \uc804\uc6a9 \uacc4\uc57d\uc11c\ub97c \ud574\uc81c\ud558\uace0 \uae30\ubcf8 \ud15c\ud50c\ub9bf\uc744 \uc0ac\uc6a9\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?`)) return;
      try {
        await api(`/api/admin/assets/${encodeURIComponent(assetId)}/template/unassign`, { method: "POST", body: {} });
        toast("\uc5f0\uacb0 \ud574\uc81c \uc644\ub8cc. \uae30\ubcf8 \ud15c\ud50c\ub9bf\uc774 \uc0ac\uc6a9\ub429\ub2c8\ub2e4.", "good");
        loadAssetTemplate(assetId);
      } catch (e) { toast(e.message || "\ud574\uc81c \uc2e4\ud328", "bad"); }
    });

    qs("#admAssetTmplCloneBtn")?.addEventListener("click", async () => {
      const assetId = String(els.id?.value || "").trim();
      if (!assetId) return toast("\uc790\uc0b0\uc744 \uba3c\uc800 \uc120\ud0dd\ud558\uc138\uc694.", "bad");

      // Open template picker to choose which template to clone from
      const sourceTemplateId = await openTemplatePicker({
        title: "\ubcf5\uc81c\ud560 \ud15c\ud50c\ub9bf \uc120\ud0dd",
        subtitle: `${assetId} \uc804\uc6a9 \uacc4\uc57d\uc11c\ub85c \ubcf5\uc81c\ud560 \uc6d0\ubcf8 \ud15c\ud50c\ub9bf\uc744 \uc120\ud0dd\ud558\uc138\uc694.`,
      });
      if (!sourceTemplateId) return;

      const sourceTmpl = tpAllTemplates.find(t => t.id == sourceTemplateId);
      if (!confirm(`"${sourceTmpl?.template_name || '\ud15c\ud50c\ub9bf'}"\uc744 \ubcf5\uc81c\ud558\uc5ec ${assetId} \uc804\uc6a9 \uacc4\uc57d\uc11c\ub97c \ub9cc\ub4e4\uae4c\uc694?\n\n\ubcf5\uc81c \ud6c4 \uc804\uc790\uacc4\uc57d \uad00\ub9ac \ud398\uc774\uc9c0\uc5d0\uc11c \ub0b4\uc6a9\uc744 \ud3b8\uc9d1\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.`)) return;

      try {
        const r = await api(`/api/admin/contract-templates/${sourceTemplateId}/clone`, {
          method: "POST", body: { asset_id: assetId }
        });
        toast(`${assetId} \uc804\uc6a9 \uacc4\uc57d\uc11c \uc0dd\uc131 \uc644\ub8cc (${r.template_code} v${r.version_no})`, "good");
        loadAssetTemplate(assetId);
      } catch (e) { toast(e.message || "\ubcf5\uc81c \uc2e4\ud328", "bad"); }
    });

    // =========================
    // Init
    // =========================
    await refresh();
    if (assets[0]?.id) {
      const a = await loadDetail(assets[0].id);
      if (a) fillForm(a);
    }
  });
})();
