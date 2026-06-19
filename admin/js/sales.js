// public/admin/js/sales.js
(() => {
  "use strict";

  const { qs, api, toast, fmtNum, bootAdminPage } = window.AdminCore;

  const STORAGE = {
    adminToken: "rwa_admin_token_v1",
    apiBase: "rwa_api_base_v1",
  };

  const absUrl = (p) => {
    const s = String(p || "").trim();
    if (!s) return "";
    if (/^(https?:)?\/\//i.test(s)) return s;
    if (s.startsWith("/")) return s;
    return `/${s}`;
  };

  const fmtSigned = (n, digits = 0) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    const sign = x > 0 ? "+" : (x < 0 ? "-" : "");
    return `${sign}${fmtNum(Math.abs(x), digits)}`;
  };

  const cur = (n, ccy, digits = 0) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return `${fmtNum(x, digits)} ${String(ccy || "").toUpperCase()}`;
  };

  const curSigned = (n, ccy, digits = 0) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return `${fmtSigned(x, digits)} ${String(ccy || "").toUpperCase()}`;
  };

  const usdt = (n, digits = 6) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return `${fmtNum(x, digits)} USDT`;
  };

  const usdtSigned = (n, digits = 6) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return `${fmtSigned(x, digits)} USDT`;
  };

  const toNum = (v) => {
    const s = String(v ?? "").replace(/,/g, "").trim();
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const isNonNeg = (n) => Number.isFinite(n) && n >= 0;

  const setImg = (el, url) => {
    if (!el) return;
    const u = absUrl(url);
    if (u) {
      el.src = u;
      el.style.visibility = "visible";
    } else {
      el.removeAttribute("src");
      el.style.visibility = "hidden";
    }
  };

  const uploadForm = async (path, formData) => {
    const base = (localStorage.getItem(STORAGE.apiBase) || "").trim().replace(/\/+$/, "");
    const token = localStorage.getItem(STORAGE.adminToken) || "";
    const url = `${base}${path}`;

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    // (2026-05-24 v824) X-Admin-Wallet 헤더 추가 (admin.core.js requestJson 과 동일).
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

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("sales");
    if (!me) return;
    const currentAdminUsername = String(me?.username || "").trim();

    const els = {
      shell: document.querySelector(".admin-shell"),
      assetSel: qs("#saleAssetSelect"),
      assetFilter: qs("#saleAssetFilter"),
      assetSearch: qs("#saleAssetSearch"),
      assetFilterMeta: qs("#saleAssetFilterMeta"),
      status: qs("#saleAssetStatus"),
      settleCcy: qs("#saleSettleCcy"),
      fundedUsdt: qs("#saleFundedUsdt"),
      fundedLocal: qs("#saleFundedLocal"),
      executionMeta: qs("#saleExecutionMeta"),
      inputCcy: qs("#saleInputCcy"),
      fundingFxLine: qs("#saleFundingFxLine"),
      fxLine: qs("#saleFxLine"),
      startFxLine: qs("#saleStartFxLine"),
      fxSourceLine: qs("#saleFxSourceLine"),
      dateFx: qs("#saleDateFx"),
      dateFxMeta: qs("#saleDateFxMeta"),
      dateFxLabelUnit: qs("#saleDateFxLabelUnit"),
      dateFxUnit: qs("#saleDateFxUnit"),
      manualFx: qs("#saleManualFx"),
      manualFxLabelUnit: qs("#saleManualFxLabelUnit"),
      manualFxUnit: qs("#saleManualFxUnit"),
      actionHint: qs("#saleActionHint"),
      actionState: qs("#saleActionState"),
      refreshBtn: qs("#saleRefreshBtn"),
      saveBtn: qs("#saleSaveBtn"),
      inlineSaveBtn: qs("#saleInlineSaveBtn"),
      executeBtn: qs("#saleExecuteBtn"),
      buy: qs("#saleBuy"),
      buyLabelUnit: qs("#saleBuyLabelUnit"),
      buyUnit: qs("#saleBuyUnit"),
      buyRatio: qs("#saleBuyRatio"),
      actualBuy: qs("#saleActualBuy"),
      actualBuyLabelUnit: qs("#saleActualBuyLabelUnit"),
      actualBuyUnit: qs("#saleActualBuyUnit"),
      externalCapital: qs("#saleExternalCapital"),
      externalCapitalLabelUnit: qs("#saleExternalCapitalLabelUnit"),
      externalCapitalUnit: qs("#saleExternalCapitalUnit"),
      externalRatio: qs("#saleExternalRatio"),
      sold: qs("#saleSold"),
      soldLabelUnit: qs("#saleSoldLabelUnit"),
      soldUnit: qs("#saleSoldUnit"),
      tax: qs("#saleTax"),
      taxLabelUnit: qs("#saleTaxLabelUnit"),
      taxUnit: qs("#saleTaxUnit"),
      exp: qs("#saleExpenses"),
      expLabelUnit: qs("#saleExpensesLabelUnit"),
      expUnit: qs("#saleExpensesUnit"),
      vault: qs("#saleVault"),
      vaultLabelUnit: qs("#saleVaultLabelUnit"),
      vaultUnit: qs("#saleVaultUnit"),
      ws: qs("#saleWindowStart"),
      wsHelp: qs("#saleWindowStartHelp"),
      we: qs("#saleWindowEnd"),
      setToSold: qs("#saleSetAssetToSold"),
      link: qs("#saleDetailLink"),
      saleDocType: qs("#saleDocType"),
      saleDocTitle: qs("#saleDocTitle"),
      saleDocDate: qs("#saleDocDate"),
      saleDocFile: qs("#saleDocFile"),
      saleDocUploadBtn: qs("#saleDocUploadBtn"),
      saleDocRefreshBtn: qs("#saleDocRefreshBtn"),
      saleDocHint: qs("#saleDocHint"),
      saleDocListTbody: qs("#saleDocListTbody"),
      executeModal: qs("#saleExecuteModal"),
      executeSummary: qs("#saleExecuteSummary"),
      executeCheck: qs("#saleExecuteCheck"),
      executePolicyWarning: qs("#saleExecutePolicyWarning"),
      confirmUsername: qs("#saleConfirmUsername"),
      confirmPassword: qs("#saleConfirmPassword"),
      confirmCancelBtn: qs("#saleConfirmCancelBtn"),
      confirmSubmitBtn: qs("#saleConfirmSubmitBtn"),
    };

    const pv = {
      market: qs("#saleMarket"),
      title: qs("#saleTitle"),
      img: qs("#saleImg"),
      supply: qs("#saleSupply"),
      settleBadge: qs("#pvSettleCcy"),
      soldTotal: qs("#pvSoldTotal"),
      totalCost: qs("#pvTotalCost"),
      netLocal: qs("#pvNetLocal"),
      projectCost: qs("#pvProjectCost"),
      pureLocal: qs("#pvPureLocal"),
      fundedUsdt: qs("#pvFundedUsdt"),
      fundingFx: qs("#pvFundingFx"),
      principalLocal: qs("#pvPrincipalLocal"),
      principalLocalMeta: qs("#pvPrincipalLocalMeta"),
      externalCapital: qs("#pvExternalCapital"),
      externalCapitalMeta: qs("#pvExternalCapitalMeta"),
      investorLocal: qs("#pvInvestorLocal"),
      investorLocalMeta: qs("#pvInvestorLocalMeta"),
      externalAllocation: qs("#pvExternalAllocation"),
      externalAllocationMeta: qs("#pvExternalAllocationMeta"),
      supplyTokens: qs("#pvSupplyTokens"),
      redeemLocal: qs("#pvRedeemLocal"),
      payoutFx: qs("#pvPayoutFx"),
      redeemUsdt: qs("#pvRedeemUsdt"),
      saleDate: qs("#pvSaleDate"),
      totalCostInput: qs("#pvTotalCostInput"),
    };

    let assets = [];
    let assetDetail = null;
    let saleDetail = null;
    let draftSale = null;
    let fxRates = {};
    let interestPayDay = 15;
    let settleCcy = "KRW";
    let lastAssetId = "";
    let lastFocus = null;
    let fxPreview = {
      autoFx: 0,
      autoFound: false,
      fetchedAt: "",
      provider: "",
      date: "",
      currentFx: 0,
      source: "current",
      message: "",
    };

    let executePrecheck = {
      ready: false,
      message: "",
      reasonCode: "",
      blockers: [],
      warnings: [],
      executionLock: null,
    };

    let executionLock = {
      locked: false,
      days: [14, 15, 16],
      label: "14~16일",
      nextOpenLabel: "",
      message: "",
    };

    let saleLockState = {
      locked: false,
      reasonCode: "",
      message: "",
      executedAt: "",
      executedAtKst: "",
      fixedFx: 0,
      redeemCount: 0,
      assetStatus: "",
    };

    const esc = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const soldLikeStatuses = new Set(["매각", "매각(완료)"]);
    const normalizeSearchText = (value) => String(value || "").trim().toLowerCase();
    const isSoldLikeStatus = (value) => soldLikeStatuses.has(String(value || "").trim());
    const isSoldAssetRow = (asset) => {
      const status = String(asset?.status || "").trim();
      const displayStatus = String(asset?.display_status || asset?.displayStatus || "").trim();
      return isSoldLikeStatus(displayStatus || status) || isSoldLikeStatus(status);
    };
    const getAssetBucketLabel = (asset) => {
      const displayStatus = String(asset?.display_status || asset?.displayStatus || asset?.status || "").trim();
      if (displayStatus === "매각(완료)") return "매각완료";
      return isSoldAssetRow(asset) ? "매각" : "미매각";
    };
    const buildAssetOptionLabel = (asset) => {
      const bits = [`[${getAssetBucketLabel(asset)}]`, String(asset?.id || "").trim(), String(asset?.name || "").trim()].filter(Boolean);
      return bits.length >= 3 ? `${bits[0]} ${bits[1]} · ${bits[2]}` : bits.join(" " );
    };
    const getAssetSearchHaystack = (asset) => normalizeSearchText([
      asset?.id,
      asset?.name,
      asset?.market,
      asset?.status,
      asset?.display_status,
      getAssetBucketLabel(asset),
    ].filter(Boolean).join(" "));

    const normalizeSaleLock = (obj = null) => {
      const fixedFx = Number(obj?.fixed_fx_per_usdt ?? obj?.fixedFx ?? 0);
      const redeemCount = Number(obj?.redeem_count ?? obj?.redeemCount ?? 0);
      return {
        locked: !!obj?.locked,
        reasonCode: String(obj?.reason_code ?? obj?.reasonCode ?? "").trim(),
        message: String(obj?.message ?? "").trim(),
        executionSource: String(obj?.execution_source ?? obj?.executionSource ?? "").trim(),
        executedAt: String(obj?.executed_at ?? obj?.executedAt ?? "").trim(),
        executedAtKst: String(obj?.executed_at_kst ?? obj?.executedAtKst ?? "").trim(),
        fixedFx: Number.isFinite(fixedFx) && fixedFx > 0 ? fixedFx : 0,
        redeemCount: Number.isFinite(redeemCount) && redeemCount > 0 ? redeemCount : 0,
        assetStatus: String(obj?.asset_status ?? obj?.assetStatus ?? "").trim(),
      };
    };

    const getExecutedAtLabel = () => {
      return String(
        saleDetail?.sale_executed_at_kst
        || saleLockState?.executedAtKst
        || draftSale?.executed_at_kst
        || saleDetail?.sale_executed_at
        || saleLockState?.executedAt
        || draftSale?.executed_at
        || (saleLockState?.locked ? "실행 시각 미기록" : "")
      ).trim() || "-";
    };

    let formulaTooltip = null;
    let formulaTooltipBubble = null;
    let formulaTooltipArrow = null;
    let activeFormulaTooltipTarget = null;
    let formulaTooltipViewportBound = false;

    const ensureFormulaTooltip = () => {
      if (formulaTooltip) return;
      formulaTooltip = document.createElement("div");
      formulaTooltip.id = "formulaTooltipLayer";
      formulaTooltip.className = "formula-tooltip-layer";
      formulaTooltip.hidden = true;
      formulaTooltip.setAttribute("role", "tooltip");
      formulaTooltip.setAttribute("aria-hidden", "true");
      formulaTooltip.dataset.placement = "top";
      formulaTooltip.innerHTML = '<div class="formula-tooltip-bubble"></div><div class="formula-tooltip-arrow"></div>';
      document.body.appendChild(formulaTooltip);
      formulaTooltipBubble = formulaTooltip.querySelector(".formula-tooltip-bubble");
      formulaTooltipArrow = formulaTooltip.querySelector(".formula-tooltip-arrow");
    };

    const getFormulaTooltipText = (el) => {
      if (!el) return "";
      return String(el.getAttribute("data-formula") || el.getAttribute("data-tooltip") || "").trim();
    };

    const hideFormulaTooltip = (target = null) => {
      if (target && activeFormulaTooltipTarget && target !== activeFormulaTooltipTarget) return;
      if (activeFormulaTooltipTarget) activeFormulaTooltipTarget.removeAttribute("aria-describedby");
      activeFormulaTooltipTarget = null;
      if (!formulaTooltip) return;
      formulaTooltip.hidden = true;
      formulaTooltip.setAttribute("aria-hidden", "true");
      formulaTooltip.style.visibility = "hidden";
    };

    const positionFormulaTooltip = (target) => {
      if (!formulaTooltip || !formulaTooltipBubble || !target) return;
      const rect = target.getBoundingClientRect();
      const gap = 12;
      const margin = 8;

      formulaTooltip.hidden = false;
      formulaTooltip.setAttribute("aria-hidden", "false");
      formulaTooltip.style.visibility = "hidden";
      formulaTooltip.style.left = "0px";
      formulaTooltip.style.top = "0px";
      formulaTooltip.dataset.placement = "top";

      const tipRect = formulaTooltip.getBoundingClientRect();
      let placement = "top";
      let top = rect.top - tipRect.height - gap;
      if (top < margin) {
        placement = "bottom";
        top = rect.bottom + gap;
      }
      if (top + tipRect.height > window.innerHeight - margin) {
        placement = rect.top >= (window.innerHeight - rect.bottom) ? "top" : "bottom";
        top = placement === "top"
          ? Math.max(margin, rect.top - tipRect.height - gap)
          : Math.min(window.innerHeight - margin - tipRect.height, rect.bottom + gap);
      }

      let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - tipRect.width));
      const anchorCenter = rect.left + (rect.width / 2);
      const arrowLeft = Math.max(14, Math.min(anchorCenter - left - 6, tipRect.width - 14));

      formulaTooltip.dataset.placement = placement;
      formulaTooltip.style.left = `${Math.round(left)}px`;
      formulaTooltip.style.top = `${Math.round(top)}px`;
      if (formulaTooltipArrow) formulaTooltipArrow.style.left = `${Math.round(arrowLeft)}px`;
      formulaTooltip.style.visibility = "visible";
    };

    const showFormulaTooltip = (target) => {
      const message = getFormulaTooltipText(target);
      if (!message) return hideFormulaTooltip();
      ensureFormulaTooltip();
      if (!formulaTooltipBubble) return;
      activeFormulaTooltipTarget = target;
      formulaTooltipBubble.textContent = message;
      target.setAttribute("aria-describedby", "formulaTooltipLayer");
      positionFormulaTooltip(target);
    };

    const bindFormulaTooltips = () => {
      ensureFormulaTooltip();
      const elsToBind = document.querySelectorAll('.formula-help[data-formula], .formula-tip[data-tooltip]');
      elsToBind.forEach((el) => {
        if (el.dataset.tooltipBound === "1") return;
        el.dataset.tooltipBound = "1";
        el.addEventListener("mouseenter", () => showFormulaTooltip(el));
        el.addEventListener("mouseleave", () => hideFormulaTooltip(el));
        el.addEventListener("focus", () => showFormulaTooltip(el));
        el.addEventListener("blur", () => hideFormulaTooltip(el));
      });
      if (!formulaTooltipViewportBound) {
        const handleViewportChange = () => {
          if (activeFormulaTooltipTarget) positionFormulaTooltip(activeFormulaTooltipTarget);
        };
        window.addEventListener("resize", handleViewportChange, { passive: true });
        window.addEventListener("scroll", handleViewportChange, true);
        formulaTooltipViewportBound = true;
      }
    };

    const normalizeFxPreview = (obj = null) => ({
      autoFx: Number(obj?.autoFx || obj?.rate || 0),
      autoFound: !!(obj?.autoFound ?? obj?.found),
      fetchedAt: String(obj?.fetchedAt || obj?.fetched_at || "").trim(),
      provider: String(obj?.provider || obj?.source || "").trim(),
      date: String(obj?.date || obj?.reference_date || "").trim(),
      currentFx: Number(obj?.currentFx || obj?.current_fx || 0),
      source: String(obj?.source || "current").trim() || "current",
      message: String(obj?.message || "").trim(),
    });

    const normalizeExecutionLock = (obj = null) => {
      const rawDays = Array.isArray(obj?.days)
        ? obj.days
        : (Array.isArray(obj?.lock_days) ? obj.lock_days : executionLock.days);
      const days = rawDays.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0).sort((a, b) => a - b);
      const isRange = days.length >= 2 && days.every((day, idx) => idx === 0 || day === (days[idx - 1] + 1));
      const label = String(obj?.label || obj?.lock_label || "").trim() || (days.length ? (isRange ? `${days[0]}~${days[days.length - 1]}일` : `${days.join(', ')}일`) : executionLock.label);
      return {
        locked: !!(obj?.locked ?? obj?.is_locked),
        days: days.length ? days : executionLock.days,
        label,
        nextOpenLabel: String(obj?.nextOpenLabel || obj?.next_open_label || "").trim(),
        message: String(obj?.message || "").trim(),
      };
    };

    const normalizePrecheckItems = (items) => (Array.isArray(items) ? items : []).map((item) => ({
      code: String(item?.code || "").trim(),
      message: String(item?.message || "").trim(),
    })).filter((item) => item.message);

    const normalizeExecutePrecheck = (obj = null) => {
      const blockers = normalizePrecheckItems(obj?.blockers);
      const warnings = normalizePrecheckItems(obj?.warnings);
      const executionLockInfo = obj?.execution_lock ? normalizeExecutionLock(obj.execution_lock) : null;
      return {
        ready: !!obj?.ready,
        message: String(obj?.message || (blockers[0]?.message || "")).trim(),
        reasonCode: String(obj?.reasonCode || obj?.reason_code || (blockers[0]?.code || "")).trim(),
        blockers,
        warnings,
        executionLock: executionLockInfo,
        saleDateMin: String(obj?.sale_date_min || obj?.min_sale_date || "").trim(),
        saleDateRuleMessage: String(obj?.sale_date_rule_message || obj?.saleDateRuleMessage || "").trim(),
      };
    };

    const getKstDayOfMonth = () => {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", day: "numeric" }).formatToParts(new Date());
        const value = Number(parts.find((part) => part.type === "day")?.value || 0);
        return Number.isFinite(value) ? value : 0;
      } catch (_) {
        const fallback = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
        const parsed = new Date(fallback);
        const value = Number(parsed.getDate() || 0);
        return Number.isFinite(value) ? value : 0;
      }
    };

    const getKstDateParts = () => {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date());
        const year = Number(parts.find((part) => part.type === "year")?.value || 0);
        const month = Number(parts.find((part) => part.type === "month")?.value || 0);
        const day = Number(parts.find((part) => part.type === "day")?.value || 0);
        if (year > 0 && month > 0 && day > 0) return { year, month, day };
      } catch (_) {}
      try {
        const fallback = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
        const parsed = new Date(fallback);
        const year = Number(parsed.getFullYear() || 0);
        const month = Number((parsed.getMonth() || 0) + 1);
        const day = Number(parsed.getDate() || 0);
        if (year > 0 && month > 0 && day > 0) return { year, month, day };
      } catch (_) {}
      return null;
    };

    const pad2 = (v) => String(v).padStart(2, "0");

    const normalizeSaleDateValue = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      const datePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (datePrefix) return datePrefix[1];
      return raw;
    };

    const normalizeYmd = (value) => {
      const ymd = normalizeSaleDateValue(value);
      return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : "";
    };

    const getKstTodayYmd = () => {
      const parts = getKstDateParts();
      return parts ? `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}` : "";
    };

    const getMinSelectableSaleDate = () => "";

    const getSaleDateBackdateRuleMessage = () => "";

    const applySaleDateConstraints = () => {
      if (!els.ws) return;
      const today = getKstTodayYmd();
      if (today) els.ws.max = today;
      els.ws.removeAttribute("min");
      if (els.wsHelp) {
        els.wsHelp.textContent = "운영자가 문서 기준으로 확정한 실제 오프라인 매각일을 입력하세요. 14~16일 포함 언제든 선택할 수 있으며, 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다.";
      }
    };

    const validateSaleDateInput = (value) => {
      const rawSaleDate = String(value || "").trim();
      if (!rawSaleDate) return;
      const saleDate = normalizeYmd(rawSaleDate);
      if (!saleDate) {
        throw new Error("매각일 형식이 올바르지 않습니다. YYYY-MM-DD 형태로 다시 선택하세요.");
      }
      const today = normalizeYmd(getKstTodayYmd());
      if (today && saleDate > today) {
        throw new Error("매각일은 미래일 수 없습니다. 실제 오프라인 매각일을 입력하세요.");
      }
    };

    const isExecutionLockedToday = () => {
      const days = Array.isArray(executionLock?.days) && executionLock.days.length ? executionLock.days : [14, 15, 16];
      return !!executionLock?.locked || days.includes(getKstDayOfMonth());
    };

    const getExecutionLockMessage = () => {
      const label = String(executionLock?.label || "").trim() || "14~16일";
      const nextOpen = String(executionLock?.nextOpenLabel || "").trim();
      return String(executionLock?.message || "").trim()
        || `정산 제한 기간(${label})에는 매각 최종 실행이 불가합니다.${nextOpen ? ` ${nextOpen} 이후 다시 시도하세요.` : ""} 저장과 문서 업로드 등 준비 작업은 계속할 수 있으며, 매각일은 문서 기준 실제 오프라인 날짜로 자유롭게 저장할 수 있습니다. 유저의 매각 자산 교환은 매각 실행일 이후 시작됩니다.`;
    };

    const getClientSaleDateBlocker = () => {
      const saleDate = normalizeSaleDateValue(els.ws?.value || draftSale?.sale_date || saleDetail?.sale_date || draftSale?.window_start || saleDetail?.window_start || "");
      if (!saleDate) return "";
      try {
        validateSaleDateInput(saleDate);
        return "";
      } catch (e) {
        return String(e?.message || "매각일을 다시 확인하세요.").trim();
      }
    };

    const isAdminSessionExpiredError = (e) => {
      const status = Number(e?.status || 0);
      if (status !== 401) return false;
      const msg = String(e?.message || "").trim();
      return /관리자 로그인이 필요합니다|관리자 토큰이 유효하지 않습니다/i.test(msg);
    };

    const handleAdminSessionExpired = (e) => {
      if (!isAdminSessionExpiredError(e)) return false;
      toast("관리자 세션이 만료되었습니다. 다시 로그인하세요.", "bad");
      setTimeout(() => {
        try {
          localStorage.removeItem(STORAGE.adminToken);
        } catch (_) {}
        location.replace("login.html");
      }, 200);
      return true;
    };

    const renderExecuteCheck = (message = "", kind = "info") => {
      if (!els.executeCheck) return;
      const pre = executePrecheck || {};
      const blockers = Array.isArray(pre.blockers) ? pre.blockers : [];
      const warnings = Array.isArray(pre.warnings) ? pre.warnings : [];
      const parts = [];
      let heading = String(message || "").trim();

      if (blockers.length) {
        const duplicate = blockers.some((item) => item.message === heading);
        if (!heading || duplicate || /현재 상태에서 매각 실행이 가능합니다|매각 실행 전 확인이 필요합니다/i.test(heading)) {
          heading = "현재 실행 불가";
        }
      } else if (pre.ready) {
        if (!heading || /현재 상태에서 매각 실행이 가능합니다/i.test(heading)) heading = "현재 실행 가능";
      }

      if (heading) {
        parts.push(`<div style="font-weight:900;${kind === 'bad' ? 'color:#991b1b' : kind === 'good' ? 'color:#166534' : 'color:#1e293b'}">${heading}</div>`);
      }

      if (blockers.length) {
        parts.push(`<div style="font-weight:800;color:#991b1b;margin-top:${heading ? 8 : 0}px">실행 전 해결이 필요한 항목</div>`);
        parts.push(`<ul style="margin:8px 0 0 18px;padding:0;color:#7f1d1d">${blockers.map((item) => `<li>${item.message}</li>`).join("")}</ul>`);
      } else if (warnings.length) {
        parts.push(`<div style="font-weight:800;color:#9a3412;margin-top:${heading ? 10 : 0}px">실행 시 참고</div>`);
        parts.push(`<ul style="margin:8px 0 0 18px;padding:0;color:#9a3412">${warnings.map((item) => `<li>${item.message}</li>`).join("")}</ul>`);
      }

      const hasContent = parts.length > 0;
      els.executeCheck.hidden = !hasContent;
      els.executeCheck.innerHTML = hasContent ? parts.join("") : "";
      els.executeCheck.style.background = kind === "bad" ? "#fef2f2" : (pre.ready && !blockers.length ? "#f0fdf4" : "#fff7ed");
      els.executeCheck.style.borderColor = kind === "bad" ? "#fecaca" : (pre.ready && !blockers.length ? "#bbf7d0" : "#fdba74");
      els.executeCheck.style.color = kind === "bad" ? "#7f1d1d" : (pre.ready && !blockers.length ? "#166534" : "#9a3412");
    };

    const hasManualFxInput = () => String(els.manualFx?.value || "").trim() !== "";

    const getFxNow = () => {
      if (settleCcy === "USDT") return 1;
      const fx = Number(fxRates?.[settleCcy] || 0);
      return Number.isFinite(fx) && fx > 0 ? fx : 0;
    };

    const getLockedFx = () => {
      const fx = Number(saleDetail?.fixed_fx_per_usdt || saleLockState?.fixedFx || 0);
      if (!Number.isFinite(fx) || fx <= 0) return 0;
      return settleCcy === "USDT" ? 1 : fx;
    };

    const getManualFx = () => {
      if (settleCcy === "USDT") return 1;
      const raw = toNum(els.manualFx?.value);
      return Number.isFinite(raw) && raw > 0 ? raw : 0;
    };

    const getAutoStartFx = () => {
      if (settleCcy === "USDT") return 1;
      const fx = Number(fxPreview?.autoFx || 0);
      return Number.isFinite(fx) && fx > 0 ? fx : 0;
    };

    const hasWindowStart = () => !!String(els.ws?.value || "").trim();

    const isExecuted = () => {
      const at = String(saleDetail?.sale_executed_at || saleLockState?.executedAt || "").trim();
      return !!at || getLockedFx() > 0 || saleDetail?.sale_executed === true || saleLockState?.locked === true;
    };

    const getSavedManualFx = () => {
      if (settleCcy === "USDT") return 1;
      const fx = Number(draftSale?.manual_fx_per_usdt || 0);
      return Number.isFinite(fx) && fx > 0 ? fx : 0;
    };

    const getPayoutFxMode = () => {
      if (settleCcy === "USDT") return "usdt";
      if (isExecuted()) return getSavedManualFx() > 0 ? "fixed_manual" : "fixed_legacy";
      if (getManualFx() > 0) return "manual";
      return "manual_required";
    };

    const getPayoutFx = () => {
      if (settleCcy === "USDT") return 1;
      const locked = getLockedFx();
      if (locked > 0) return locked;
      const manual = getManualFx();
      if (manual > 0) return manual;
      return 0;
    };

    const formatFxValue = (fx) => {
      const n = Number(fx);
      if (!Number.isFinite(n) || n <= 0) return "-";
      if (settleCcy === "USDT") return "1 USDT = 1 USDT";
      return `1 USDT = ${fmtNum(n, 4)} ${settleCcy}`;
    };

    const getServerInterestPolicyText = () => {
      const warnings = Array.isArray(executePrecheck?.warnings) ? executePrecheck.warnings : [];
      const item = warnings.find((entry) => String(entry?.code || "").trim().toUpperCase() === "INTEREST_POLICY");
      return String(item?.message || "").trim();
    };

    const getInterestPolicyText = () => {
      const serverMessage = getServerInterestPolicyText();
      if (serverMessage) return serverMessage;
      const payday = Number.isFinite(Number(interestPayDay)) && Number(interestPayDay) > 0 ? Number(interestPayDay) : 15;
      const day = getKstDayOfMonth();
      if (!Number.isFinite(day) || day <= 0) {
        return `매각실행일(KST)이 ${payday}일 이전이면 실행월 이자는 지급되지 않고, ${payday}일 이상이면 실행월 이자는 유지되며 다음월부터 중단됩니다.`;
      }
      if (day >= payday) {
        return `매각실행일(KST)이 ${payday}일 이상이므로 실행월 이자는 유지되고 다음월부터 중단됩니다.`;
      }
      return `매각실행일(KST)이 ${payday}일 이전이므로 실행월 이자는 지급되지 않습니다.`;
    };

    const renderExecutePolicyWarning = () => {
      if (!els.executePolicyWarning) return;
      const lines = [
        '실행 즉시 되돌릴 수 없습니다.',
        '유저는 플랫폼 유저 할당총액을 기준으로 정산받고, 토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 ÷ 매각 환율로 계산됩니다.',
      ];
      if (settleCcy === 'USDT') {
        lines.push('정산통화가 USDT이므로 별도 환율 고정은 필요하지 않습니다.');
      } else if (isExecuted() && getLockedFx() > 0) {
        lines.push(`현재 고정 환율은 ${formatFxValue(getLockedFx())} 입니다.`);
      } else if (getManualFx() > 0) {
        lines.push(`입력한 관리자 수동 환율(${formatFxValue(getManualFx())})만 최종 고정되며, 매각일 기준 자동 조회 환율은 참고용입니다.`);
      } else {
        lines.push('관리자 수동 환율을 입력해야 매각 실행할 수 있습니다. 자동 조회 환율은 참고용입니다.');
      }
      lines.push('해당 자산의 스테이킹 수량은 전량 언스테이킹됩니다.');
      lines.push(getInterestPolicyText());
      lines.push('이전 누적 미수령 이자는 계속 클레임할 수 있습니다.');
      lines.push('유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다. 단, 14~16일에는 매각 최종 실행이 제한됩니다.');
      els.executePolicyWarning.innerHTML = lines.join('<br>');
    };

    const setText = (el, value) => {
      if (el) el.textContent = value;
    };

    const joinFormulaLines = (...lines) => lines.filter((line) => String(line || "").trim()).join("\n");

    const setFormulaHelpText = (key, text) => {
      const message = String(text || "").trim() || "현재 값 입력 후 계산식이 표시됩니다.";
      document.querySelectorAll(`[data-formula-key="${key}"]`).forEach((el) => {
        el.setAttribute("data-formula", message);
        el.setAttribute("title", message.replace(/\n+/g, " | "));
      });
    };

    const updateFormulaHelps = (c) => {
      const digits = settleCcy === "USDT" ? 6 : 0;
      const fxDigits = settleCcy === "USDT" ? 0 : 4;
      const saleDate = normalizeSaleDateValue(els.ws?.value || "") || "-";
      const manualFx = getManualFx();
      const autoFx = getAutoStartFx();
      const payoutFx = getPayoutFx();
      const hasFundingFx = Number.isFinite(c?.fundingFx) && c.fundingFx > 0;
      const principalReady = Number.isFinite(c?.principal) && c.principal > 0;
      const actualReady = Number.isFinite(c?.actual) && c.actual > 0;
      const soldReady = isNonNeg(c?.sold);
      const taxReady = isNonNeg(c?.tax);
      const expReady = isNonNeg(c?.exp);
      const netReady = Number.isFinite(c?.net);
      const investorLocalReady = Number.isFinite(c?.investorLocal);
      const investorUsdtReady = Number.isFinite(c?.investorUsdt);
      const totalCostReady = Number.isFinite(c?.totalCost);
      const supply = Number(assetDetail?.supply_token || 0);
      const supplyText = supply > 0 ? fmtNum(supply, Number.isInteger(supply) ? 0 : 6) : "-";
      const autoFxText = autoFx > 0 ? formatFxValue(autoFx) : "환율 이력 없음";
      const manualFxText = manualFx > 0 ? formatFxValue(manualFx) : "미입력";
      const payoutFxText = payoutFx > 0 ? formatFxValue(payoutFx) : "미입력";
      const externalAllocationReady = Number.isFinite(c?.externalAllocation);

      setFormulaHelpText("principal", settleCcy === "USDT"
        ? joinFormulaLines(
            "플랫폼 유저 총 투자금 = 확정 모금액(USDT)",
            principalReady ? `= ${usdt(c.principal, 6)}` : "확정 모금액이 있으면 자동 고정됩니다."
          )
        : joinFormulaLines(
            "플랫폼 유저 총 투자금 = 확정 모금액(USDT) × 모금 확정 환율",
            (c.fundedUsdt > 0 && hasFundingFx && principalReady)
              ? `= ${usdt(c.fundedUsdt, 6)} × ${fmtNum(c.fundingFx, fxDigits)} ${settleCcy}/USDT
= ${cur(c.principal, settleCcy, digits)}`
              : "확정 모금액과 모금 확정 환율이 있으면 자동 고정됩니다."
          ));

      setFormulaHelpText("actual", joinFormulaLines(
        "총 취득원가 = 실부동산 매수금액 + 매수세금 + 취득부대비용",
        actualReady ? `현재 입력값 = ${cur(c.actual, settleCcy, digits)}` : "관리자가 문서 기준 총 취득원가를 직접 입력합니다."
      ));

      setFormulaHelpText("external", joinFormulaLines(
        "외부자금 = max(0, 취득원가 - 투자금액 확정환율 환산)",
        (actualReady && principalReady)
          ? `= max(0, ${cur(c.actual, settleCcy, digits)} - ${cur(c.principal, settleCcy, digits)})
= ${cur(c.externalCapital, settleCcy, digits)}`
          : "취득원가와 투자금액 확정환율 환산 값이 있으면 자동 계산됩니다."
      ));

      setFormulaHelpText("sold", joinFormulaLines(
        "총매각금 = 관리자가 문서 기준으로 입력한 실제 총 매각대금",
        soldReady ? `현재 입력값 = ${cur(c.sold, settleCcy, digits)}` : "문서 기준 실제 총 매각대금을 입력하세요."
      ));

      setFormulaHelpText("tax", joinFormulaLines(
        "매각세금 = 관리자가 문서 기준으로 입력한 세금 총액",
        taxReady ? `현재 입력값 = ${cur(c.tax, settleCcy, digits)}` : "문서 기준 매각세금을 입력하세요."
      ));

      setFormulaHelpText("expenses", joinFormulaLines(
        "기타 매각비용 = 관리자가 문서 기준으로 입력한 기타 비용 총액",
        expReady ? `현재 입력값 = ${cur(c.exp, settleCcy, digits)}` : "문서 기준 기타 매각비용을 입력하세요."
      ));

      setFormulaHelpText("vault", settleCcy === "USDT"
        ? joinFormulaLines(
            "플랫폼 유저 할당총액(USDT) = 플랫폼 유저 할당총액(정산통화)",
            investorLocalReady ? `= ${usdt(Math.max(0, c.investorLocal), 6)}` : "플랫폼 유저 할당총액 계산 후 자동 표시됩니다."
          )
        : joinFormulaLines(
            "플랫폼 유저 할당총액(USDT) = 플랫폼 유저 할당총액(정산통화) ÷ 매각 환율",
            (investorLocalReady && payoutFx > 0 && investorUsdtReady)
              ? `= ${cur(c.investorLocal, settleCcy, digits)} ÷ ${fmtNum(payoutFx, fxDigits)} ${settleCcy}/USDT
= ${usdt(Math.max(0, c.investorUsdt), 6)}`
              : "플랫폼 유저 할당총액과 매각 환율이 준비되면 자동 계산됩니다."
          )
      );

      setFormulaHelpText("saleDate", joinFormulaLines(
        "매각일 = 운영자가 문서 기준으로 확정한 실제 오프라인 매각일",
        `현재 선택값 = ${saleDate}`,
        "유저의 매각 자산 교환은 매각 실행 완료 시점부터 시작됩니다."
      ));

      setFormulaHelpText("autoFx", settleCcy === "USDT"
        ? joinFormulaLines("USDT 자산은 별도 환율 조회가 필요 없습니다.", "자동 조회값 = 1 USDT = 1 USDT")
        : joinFormulaLines(
            "자동 조회 환율 = 내부 fx_quotes에서 매각일 이전 최신 1건 조회",
            `현재 참고값 = ${autoFxText}`,
            saleDate !== "-" ? `기준 매각일 = ${saleDate}` : "매각일 선택 후 참고값이 조회됩니다.",
            "이 값은 참고용으로만 표시되며 저장/실행에는 사용되지 않습니다."
          ));

      setFormulaHelpText("manualFx", settleCcy === "USDT"
        ? joinFormulaLines("USDT 자산은 수동 환율 입력이 필요 없습니다.", "적용값 = 1 USDT = 1 USDT")
        : joinFormulaLines(
            "관리자 수동 환율 = 저장/실행 시 실제로 고정되는 매각 환율",
            `현재 입력값 = ${manualFxText}`,
            "자동 조회 환율은 참고용이며, 입력한 수동 환율만 저장/실행에 사용됩니다."
          ));

      setFormulaHelpText("soldTotal", joinFormulaLines(
        "총매각금(정산통화) = 관리자가 입력한 실제 총 매각대금",
        soldReady ? `= ${cur(c.sold, settleCcy, digits)}` : "총매각금을 입력하면 표시됩니다."
      ));

      setFormulaHelpText("totalCost", joinFormulaLines(
        "세금 및 비용(정산통화) = 매각세금 + 기타 매각비용",
        (taxReady && expReady && totalCostReady)
          ? `= ${cur(c.tax, settleCcy, digits)} + ${cur(c.exp, settleCcy, digits)}
= ${cur(c.totalCost, settleCcy, digits)}`
          : "세금과 기타 비용을 입력하면 계산됩니다."
      ));

      setFormulaHelpText("netLocal", joinFormulaLines(
        "순매각금(정산통화) = 총매각금 - 세금 및 비용",
        (soldReady && totalCostReady && netReady)
          ? `= ${cur(c.sold, settleCcy, digits)} - ${cur(c.totalCost, settleCcy, digits)}
= ${cur(c.net, settleCcy, digits)}`
          : "총매각금과 세금/비용이 준비되면 계산됩니다."
      ));

      setFormulaHelpText("projectCost", joinFormulaLines(
        "취득원가(정산통화) = 관리자가 입력한 실부동산 실제 매수금액",
        actualReady ? `= ${cur(c.actual, settleCcy, digits)}` : "총 취득원가 입력 후 표시됩니다."
      ));

      setFormulaHelpText("pureLocal", joinFormulaLines(
        "매각차익금(정산통화) = 순매각금 - 취득원가",
        (netReady && actualReady)
          ? `= ${cur(c.net, settleCcy, digits)} - ${cur(c.actual, settleCcy, digits)}
= ${cur(c.projectPureLocal, settleCcy, digits)}`
          : "순매각금과 취득원가가 준비되면 계산됩니다."
      ));

      setFormulaHelpText("fundedUsdt", joinFormulaLines(
        "플랫폼 유저 투자금액(USDT) = 자산의 확정 모금액(USDT)",
        c.fundedUsdt > 0 ? `= ${usdt(c.fundedUsdt, 6)}` : "확정 모금액이 있으면 자동 표시됩니다."
      ));

      setFormulaHelpText("fundingFx", settleCcy === "USDT"
        ? joinFormulaLines("확정환율(모금 확정) = 1 USDT = 1 USDT", "USDT 자산은 별도 확정환율 환산이 필요 없습니다.")
        : joinFormulaLines(
            "확정환율(모금 확정) = 자산 모금 완료 시점에 고정된 환율",
            hasFundingFx ? `= ${formatFxValue(c.fundingFx)}` : "모금 확정 환율이 있으면 자동 표시됩니다."
          ));

      setFormulaHelpText("principalLocal", settleCcy === "USDT"
        ? joinFormulaLines(
            "투자금액 확정환율 환산 = 플랫폼 유저 투자금액(USDT)",
            principalReady ? `= ${usdt(c.principal, 6)}` : "플랫폼 유저 투자금액이 있으면 표시됩니다.",
            actualReady && Number.isFinite(c.principalPct) ? `플랫폼 유저 비율 = ${fmtNum(c.principalPct, 4)}%` : ""
          )
        : joinFormulaLines(
            "투자금액 확정환율 환산(정산통화) = 플랫폼 유저 투자금액(USDT) × 확정환율",
            (c.fundedUsdt > 0 && hasFundingFx && principalReady)
              ? `= ${usdt(c.fundedUsdt, 6)} × ${fmtNum(c.fundingFx, fxDigits)} ${settleCcy}/USDT
= ${cur(c.principal, settleCcy, digits)}`
              : "플랫폼 유저 투자금액과 확정환율이 있으면 자동 계산됩니다.",
            actualReady && Number.isFinite(c.principalPct) ? `플랫폼 유저 비율 = ${fmtNum(c.principalPct, 4)}%` : ""
          ));

      setFormulaHelpText("investorLocal", joinFormulaLines(
        "플랫폼 유저 할당총액(정산통화) = 순매각금 × (투자금액 확정환율 환산 ÷ 취득원가)",
        (netReady && principalReady && actualReady)
          ? `= ${cur(c.net, settleCcy, digits)} × (${cur(c.principal, settleCcy, digits)} ÷ ${cur(c.actual, settleCcy, digits)})
= ${cur(c.investorLocal, settleCcy, digits)}`
          : "순매각금, 투자금액 확정환율 환산, 취득원가가 준비되면 계산됩니다."
      ));

      setFormulaHelpText("externalAllocation", joinFormulaLines(
        "외부투자자 할당총액(정산통화) = 순매각금 - 플랫폼 유저 할당총액",
        (netReady && investorLocalReady && externalAllocationReady)
          ? `= ${cur(c.net, settleCcy, digits)} - ${cur(c.investorLocal, settleCcy, digits)}
= ${cur(c.externalAllocation, settleCcy, digits)}`
          : "순매각금과 플랫폼 유저 할당총액이 준비되면 계산됩니다."
      ));

      setFormulaHelpText("supply", joinFormulaLines(
        "총발행 토큰수량 = 자산의 발행량(supply_token)",
        supply > 0 ? `= ${supplyText} TOKEN` : "발행량이 있으면 자동 표시됩니다."
      ));

      setFormulaHelpText("payoutFx", settleCcy === "USDT"
        ? joinFormulaLines("매각 환율(적용) = 1 USDT = 1 USDT", "USDT 자산은 별도 매각 환율 입력이 필요 없습니다.")
        : joinFormulaLines(
            "매각 환율(적용) = 관리자 수동 환율",
            `현재 적용값 = ${payoutFxText}`,
            "자동 조회 환율은 참고용으로만 표시됩니다."
          ));

      setFormulaHelpText("redeemLocal", joinFormulaLines(
        "토큰당 가격(정산통화) = 플랫폼 유저 할당총액 ÷ 누적 분배(Claim) 수량",
        "(Silica 분배 모델: 사전 발행분 1B 가 아닌 실제 유저 지갑에 전달된 STO 합계가 분모)",
        (investorLocalReady && supply > 0 && Number.isFinite(c?.unitLocal))
          ? `= ${cur(c.investorLocal, settleCcy, digits)} ÷ ${supplyText} STO
= ${cur(c.unitLocal, settleCcy, 6)}`
          : "플랫폼 유저 할당총액과 분배 수량이 준비되면 계산됩니다."
      ));

      setFormulaHelpText("redeemUsdt", joinFormulaLines(
        "토큰당 교환금액(USDT) = 토큰당 가격 ÷ 매각 환율",
        (investorLocalReady && supply > 0 && payoutFx > 0 && Number.isFinite(c?.unitLocal) && Number.isFinite(c?.unitUsdt))
          ? `= ${cur(c.unitLocal, settleCcy, 6)} ÷ ${fmtNum(payoutFx, fxDigits)} ${settleCcy}/USDT
= ${usdt(c.unitUsdt, 6)}`
          : "토큰당 가격과 매각 환율이 준비되면 계산됩니다."
      ));
    };

    const updateFieldCurrencyBadges = () => {
      const settleUnit = String(settleCcy || "-").toUpperCase() || "-";
      const fxUnit = settleUnit === "USDT" ? "USDT / USDT" : `${settleUnit} / USDT`;
      [
        els.buyLabelUnit,
        els.buyUnit,
        els.actualBuyLabelUnit,
        els.actualBuyUnit,
        els.externalCapitalLabelUnit,
        els.externalCapitalUnit,
        els.soldLabelUnit,
        els.soldUnit,
        els.taxLabelUnit,
        els.taxUnit,
        els.expLabelUnit,
        els.expUnit,
      ].forEach((el) => setText(el, settleUnit));
      [els.vaultLabelUnit, els.vaultUnit].forEach((el) => setText(el, "USDT"));
      [els.dateFxLabelUnit, els.dateFxUnit, els.manualFxLabelUnit, els.manualFxUnit].forEach((el) => setText(el, fxUnit));
      if (els.manualFx) {
        if (settleUnit === "USDT") {
          els.manualFx.placeholder = "예: 1.0000";
        } else if (settleUnit === "PHP") {
          els.manualFx.placeholder = "예: 59.72";
        } else if (settleUnit === "KRW") {
          els.manualFx.placeholder = "예: 1330.50";
        } else {
          els.manualFx.placeholder = `예: ${settleUnit} 기준 환율`;
        }
      }
    };

    const getPreviewFxSummary = () => {
      const mode = getPayoutFxMode();
      const fx = getPayoutFx();
      if (settleCcy === "USDT") {
        return { label: "적용 고정 환율", value: "1 USDT = 1 USDT" };
      }
      if (mode === "fixed_manual") {
        return { label: "고정 지급 환율", value: `수동 입력 고정 · ${formatFxValue(fx)}` };
      }
      if (mode === "fixed_legacy") {
        return { label: "고정 지급 환율", value: `${draftSale?.sale_date || draftSale?.window_start || els.ws?.value || "-"} 기준 기존 고정값 · ${formatFxValue(fx)}` };
      }
      if (mode === "manual") {
        return { label: "적용 예정 환율", value: `수동 입력 예정 · ${formatFxValue(fx)}` };
      }
      return { label: "적용 예정 환율", value: "관리자 수동 환율 입력이 필요합니다. 자동 조회 환율은 참고용으로만 표시됩니다." };
    };

    const getFundedUsdt = () => {
      const n = Number(assetDetail?.funded_snapshot_usdt ?? assetDetail?.raised_usdt ?? 0);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const getFundingFx = () => {
      if (settleCcy === "USDT") return 1;
      const fx = Number(assetDetail?.fx_at_funding || 0);
      if (Number.isFinite(fx) && fx > 0) return fx;
      return getFxNow();
    };

    const getFixedPrincipalInput = () => {
      const fundedUsdt = getFundedUsdt();
      if (!(fundedUsdt > 0)) {
        const stored = Number(saleDetail?.buy_price_input ?? saleDetail?.buy_price_krw ?? 0);
        return Number.isFinite(stored) && stored > 0 ? stored : 0;
      }
      if (settleCcy === "USDT") return fundedUsdt;
      const fx = getFundingFx();
      return fx > 0 ? fundedUsdt * fx : 0;
    };

    const calc = () => {
      const principal = getFixedPrincipalInput();
      const actualRaw = toNum(els.actualBuy?.value);
      const actual = Number.isFinite(actualRaw) && actualRaw > 0 ? actualRaw : principal;
      const sold = toNum(els.sold?.value);
      const tax = toNum(els.tax?.value);
      const exp = toNum(els.exp?.value);
      // Silica STO 분배 모델 v1: 매각 단가 분모는 "누적 분배(claim) 수량".
      // - distributed_token = SUM(holdings.claimed_token) (실제로 유저 지갑에 전달된 STO)
      // - 미클레임/미서명/미모집분은 분모에 포함되지 않음.
      // - distributed_token 가 0 이거나 미제공이면 supply_token 으로 fallback (legacy 호환).
      const distributed = Number(assetDetail?.distributed_token || 0);
      const supplyTokenLegacy = Number(assetDetail?.supply_token || 0);
      const supply = distributed > 0 ? distributed : supplyTokenLegacy;
      const payoutFx = getPayoutFx();
      const fundedUsdt = getFundedUsdt();
      const totalCost = (isNonNeg(tax) ? tax : 0) + (isNonNeg(exp) ? exp : 0);
      const net = isNonNeg(sold) ? (sold - totalCost) : NaN;
      const ratio = actual > 0 ? (principal / actual) : NaN;
      const investorLocal = Number.isFinite(net) && Number.isFinite(ratio) && ratio >= 0 ? Math.max(0, net * ratio) : NaN;
      const investorUsdt = settleCcy === "USDT"
        ? investorLocal
        : ((payoutFx > 0 && Number.isFinite(investorLocal)) ? (investorLocal / payoutFx) : NaN);
      const projectPureLocal = Number.isFinite(net) ? (net - actual) : NaN;
      const externalAllocation = (Number.isFinite(net) && Number.isFinite(investorLocal)) ? (net - investorLocal) : NaN;
      const unitLocal = (supply > 0 && Number.isFinite(investorLocal)) ? (investorLocal / supply) : NaN;
      const unitUsdt = (supply > 0 && Number.isFinite(investorUsdt)) ? (investorUsdt / supply) : NaN;
      const investorProfitLocal = Number.isFinite(investorLocal) ? (investorLocal - principal) : NaN;
      const investorPct = (principal > 0 && Number.isFinite(investorProfitLocal)) ? ((investorProfitLocal / principal) * 100) : NaN;
      const externalCapital = Math.max(0, actual - principal);
      const storedVaultUsdt = Number(saleDetail?.vault_total_usdt ?? saleDetail?.vault_balance_usdt ?? 0);
      const principalPct = actual > 0 ? (principal / actual) * 100 : NaN;
      const externalPct = actual > 0 ? (externalCapital / actual) * 100 : NaN;
      return {
        fundedUsdt,
        fundingFx: getFundingFx(),
        payoutFx,
        principal,
        actual,
        sold,
        tax,
        exp,
        totalCost,
        net,
        projectPureLocal,
        ratio,
        investorLocal,
        investorUsdt,
        externalAllocation,
        unitLocal,
        unitUsdt,
        investorProfitLocal,
        investorPct,
        externalCapital,
        storedVaultUsdt,
        principalPct,
        externalPct,
      };
    };

    const setEditableState = (locked) => {
      [els.actualBuy, els.sold, els.tax, els.exp, els.ws, els.we, els.manualFx, els.setToSold, els.saveBtn, els.inlineSaveBtn].forEach((el) => {
        if (el) el.disabled = !!locked;
      });
      if (els.executeBtn) {
        const saleDateBlocker = !locked ? getClientSaleDateBlocker() : "";
        const blocked = !!locked || isExecutionLockedToday() || !!saleDateBlocker;
        els.executeBtn.disabled = blocked;
        els.executeBtn.title = saleDateBlocker || ((!locked && isExecutionLockedToday()) ? getExecutionLockMessage() : "");
      }
      if (els.dateFx) els.dateFx.disabled = !!locked;
      if (locked && els.setToSold) els.setToSold.checked = true;
    };

    const clearPreview = () => {
      [
        pv.soldTotal,
        pv.totalCost,
        pv.netLocal,
        pv.projectCost,
        pv.pureLocal,
        pv.fundedUsdt,
        pv.fundingFx,
        pv.principalLocal,
        pv.principalLocalMeta,
        pv.externalCapital,
        pv.externalCapitalMeta,
        pv.investorLocal,
        pv.investorLocalMeta,
        pv.externalAllocation,
        pv.externalAllocationMeta,
        pv.supplyTokens,
        pv.redeemLocal,
        pv.payoutFx,
        pv.redeemUsdt,
        pv.saleDate,
        pv.totalCostInput,
      ].forEach((el) => {
        if (el) el.textContent = "-";
      });
    };

    const renderActionState = () => {
      if (!els.actionState) return;
      const locked = isExecuted();
      const fixedFx = getLockedFx();
      const executedAtLabel = getExecutedAtLabel();
      const executedBy = String(saleDetail?.sale_executed_by || draftSale?.executed_by || "").trim() || currentAdminUsername || "admin";
      const saleDateBlocker = getClientSaleDateBlocker();
      const rawPrecheckBlocker = executePrecheck?.blockers?.[0]?.message || "";
      const unsavedManualFxBlocker = !saleDateBlocker && executePrecheck?.reasonCode === "MANUAL_FX_REQUIRED" && getManualFx() > 0;
      const firstBlocker = saleDateBlocker || (unsavedManualFxBlocker ? "수동 환율이 입력되었습니다. 먼저 저장한 뒤 매각 실행을 진행하세요." : rawPrecheckBlocker);

      let tone = "info";
      let badge = "준비중";
      let title = "매각 실행 대기";
      let meta = "저장된 초안입니다. 매각 실행 전까지는 수정할 수 있습니다.";

      if (locked) {
        tone = "good";
        badge = "실행완료";
        title = "매각 실행이 완료되었습니다.";
        const bits = [`실행 시각 ${executedAtLabel}`, `실행 관리자 ${executedBy}`];
        if (fixedFx > 0) bits.push(`고정 환율 ${formatFxValue(fixedFx)}`);
        bits.push('체크박스와 저장 버튼은 잠금 처리되며, 문서 업로드만 계속할 수 있습니다.');
        meta = bits.join(' · ');
      } else if (firstBlocker) {
        tone = "warn";
        badge = "점검필요";
        title = "현재 매각 실행 전 확인이 필요합니다.";
        meta = firstBlocker;
      } else if (getPayoutFxMode() === "manual") {
        badge = "실행가능";
        title = "매각 실행 준비가 완료되었습니다.";
        meta = `저장 후 즉시 실행할 수 있습니다. 고정 환율은 ${formatFxValue(getManualFx())} 기준으로 저장됩니다.`;
      }

      els.actionState.hidden = false;
      els.actionState.dataset.tone = tone;
      els.actionState.innerHTML = `<div class="sale-action-state-title"><span class="sale-action-state-badge">${esc(badge)}</span><span>${esc(title)}</span></div><div class="sale-action-state-meta">${esc(meta)}</div>`;
    };

    const renderExecutionMeta = (c) => {
      const locked = isExecuted();
      const fixedFx = getLockedFx();
      const fxSummary = getPreviewFxSummary();
      const saleDateBlocker = getClientSaleDateBlocker();
      const rawPrecheckBlocker = executePrecheck?.blockers?.[0]?.message || "";
      const unsavedManualFxBlocker = !saleDateBlocker && executePrecheck?.reasonCode === "MANUAL_FX_REQUIRED" && getManualFx() > 0;
      const firstBlocker = saleDateBlocker || (unsavedManualFxBlocker ? "수동 환율이 입력되었습니다. 먼저 저장한 뒤 매각 실행을 진행하세요." : rawPrecheckBlocker);
      if (els.executionMeta) {
        if (locked) {
          const by = String(saleDetail?.sale_executed_by || draftSale?.executed_by || "").trim() || "admin";
          const at = getExecutedAtLabel();
          const fxLabel = settleCcy === "USDT" ? "1 USDT = 1 USDT" : (fixedFx > 0 ? `${fxSummary.value}` : "-");
          els.executionMeta.textContent = `매각 실행 완료 · ${at} · ${by} · ${fxLabel}`;
        } else if (firstBlocker) {
          els.executionMeta.textContent = `실행 전 확인 필요 · ${firstBlocker}`;
        } else {
          els.executionMeta.textContent = "저장만 된 상태입니다. 매각 실행 전까지는 복구 가능하며, 실행 후에는 복구할 수 없습니다.";
        }
      }
      if (els.actionHint) {
        if (locked) {
          els.actionHint.textContent = "매각 실행이 완료되어 숫자 수정 및 상태 복구는 불가합니다. 문서 업로드만 계속할 수 있으며, 유저의 매각 자산 교환은 매각 실행일 이후 계속 가능합니다.";
        } else if (isExecutionLockedToday()) {
          els.actionHint.textContent = getExecutionLockMessage();
        } else if (firstBlocker) {
          els.actionHint.textContent = `현재 실행 불가 · ${firstBlocker}`;
        } else if (getPayoutFxMode() === "manual") {
          els.actionHint.textContent = `입력한 관리자 수동 환율(${formatFxValue(getManualFx())})만 매각 실행 시 최종 고정됩니다. 유저는 플랫폼 유저 할당총액을 기준으로 정산받고, 토큰당 교환금액은 플랫폼 유저 할당총액 ÷ 총발행 토큰수량 ÷ 매각 환율로 계산됩니다. 자동 조회 환율은 참고용이며, 실행과 동시에 전량 언스테이킹됩니다. 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다. ${getInterestPolicyText()}`;
        } else if (hasWindowStart()) {
          if (getAutoStartFx() > 0) {
            els.actionHint.textContent = `매각일(${els.ws.value}) 기준 자동 조회 환율(${formatFxValue(getAutoStartFx())})은 참고용입니다. 관리자 수동 환율을 입력한 뒤 저장/실행하세요. 유저는 플랫폼 유저 할당총액을 기준으로 정산받으며, 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다.`;
          } else {
            els.actionHint.textContent = `매각일(${els.ws.value}) 기준 환율 이력이 없습니다. 자동 조회는 참고용이므로 관리자 수동 환율을 입력한 뒤 저장/실행하세요. 유저는 플랫폼 유저 할당총액을 기준으로 정산받으며, 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다.`;
          }
        } else {
          els.actionHint.textContent = "매각일은 실제 오프라인 기준으로 언제든 선택할 수 있습니다. 14~16일도 선택할 수 있으며, 자동 조회 환율은 참고용입니다. 실제 저장/실행에는 관리자 수동 환율 입력이 필수이고, 유저는 플랫폼 유저 할당총액을 기준으로 정산받습니다. 유저의 매각 자산 교환은 매각 실행일 기준으로 시작됩니다.";
        }
      }
      renderActionState();
      setEditableState(locked);
      if (els.setToSold && !locked && lastAssetId !== String(els.assetSel?.value || "")) {
        els.setToSold.checked = false;
      }
    };

    const renderPreview = () => {
      const c = calc();
      const digits = settleCcy === "USDT" ? 6 : 0;
      const fxDigits = settleCcy === "USDT" ? 0 : 4;
      const fxSummary = getPreviewFxSummary();
      const autoFx = getAutoStartFx();
      const manualFx = getManualFx();
      const currentFx = getFxNow();

      if (els.buy) els.buy.value = Number.isFinite(c.principal) ? String(c.principal) : "";
      if (els.externalCapital) els.externalCapital.value = Number.isFinite(c.externalCapital) ? String(c.externalCapital) : "";
      if (els.buyRatio) els.buyRatio.textContent = Number.isFinite(c.principalPct) ? `지분율 ${fmtNum(c.principalPct, 4)}%` : "지분율 -";
      if (els.externalRatio) els.externalRatio.textContent = Number.isFinite(c.externalPct) ? `지분율 ${fmtNum(c.externalPct, 4)}%` : "지분율 -";
      if (els.inputCcy) els.inputCcy.value = settleCcy;
      if (els.fundedUsdt) els.fundedUsdt.textContent = c.fundedUsdt > 0 ? usdt(c.fundedUsdt, 6) : "-";
      if (els.fundedLocal) {
        const localValue = settleCcy === "USDT" ? c.fundedUsdt : (c.fundingFx > 0 ? (c.fundedUsdt * c.fundingFx) : 0);
        els.fundedLocal.textContent = localValue > 0 ? cur(localValue, settleCcy, digits) : "-";
      }
      if (els.fundingFxLine) {
        if (settleCcy === "USDT") {
          els.fundingFxLine.textContent = "모금 확정 환율: 1 USDT = 1 USDT";
        } else if (c.fundingFx > 0) {
          els.fundingFxLine.textContent = `모금 확정 환율: 1 USDT = ${fmtNum(c.fundingFx, fxDigits)} ${settleCcy}`;
        } else {
          els.fundingFxLine.textContent = "모금 확정 환율: -";
        }
      }
      if (els.dateFx) {
        if (settleCcy === "USDT") {
          els.dateFx.value = "1.0000";
        } else if (hasWindowStart()) {
          els.dateFx.value = autoFx > 0 ? fmtNum(autoFx, fxDigits) : "";
        } else {
          els.dateFx.value = currentFx > 0 ? fmtNum(currentFx, fxDigits) : "";
        }
      }
      if (els.dateFxMeta) {
        if (settleCcy === "USDT") {
          els.dateFxMeta.textContent = "USDT는 별도 환율 조회가 필요 없습니다.";
        } else if (hasWindowStart()) {
          if (autoFx > 0) {
            const parts = [`${els.ws?.value || "-"} 기준 히스토리 환율(참고용)`];
            if (fxPreview.fetchedAt) parts.push(`저장시각 ${fxPreview.fetchedAt}`);
            els.dateFxMeta.textContent = parts.join(" · ");
          } else {
            els.dateFxMeta.textContent = fxPreview.message || `${els.ws?.value || "-"} 기준 환율 이력이 없습니다. 참고값 조회에 실패했습니다.`;
          }
        } else {
          els.dateFxMeta.textContent = "매각일을 선택하면 해당일 기준 히스토리 환율을 참고용으로 조회합니다.";
        }
      }
      if (els.startFxLine) {
        if (settleCcy === "USDT") {
          els.startFxLine.textContent = "매각일 기준 환율(참고용 자동 조회): 1 USDT = 1 USDT";
        } else if (hasWindowStart()) {
          els.startFxLine.textContent = autoFx > 0
            ? `매각일 기준 환율(참고용 자동 조회): 1 USDT = ${fmtNum(autoFx, fxDigits)} ${settleCcy}`
            : `매각일 기준 환율(참고용 자동 조회): ${els.ws?.value || "-"} 기준 환율 이력 없음`;
        } else {
          els.startFxLine.textContent = currentFx > 0
            ? `매각일 미선택 · 현재 설정 환율(참고): 1 USDT = ${fmtNum(currentFx, fxDigits)} ${settleCcy}`
            : "매각일 기준 환율(참고용 자동 조회): -";
        }
      }
      if (els.fxLine) {
        if (settleCcy === "USDT") {
          els.fxLine.textContent = isExecuted() ? "고정 지급 환율: 1 USDT = 1 USDT" : "적용 예정 환율: 1 USDT = 1 USDT";
        } else {
          els.fxLine.textContent = `${fxSummary.label}: ${fxSummary.value}`;
        }
      }
      if (els.fxSourceLine) {
        if (settleCcy === "USDT") {
          els.fxSourceLine.textContent = "적용 예정 환율: 1 USDT = 1 USDT";
        } else {
          const manualSuffix = manualFx > 0 && !isExecuted() ? " · 입력한 수동 환율만 저장/실행에 사용" : "";
          els.fxSourceLine.textContent = `${fxSummary.label}: ${fxSummary.value}${manualSuffix}`;
        }
      }

      const supply = Number(assetDetail?.supply_token || 0);
      const supplyDigits = Number.isInteger(supply) ? 0 : 6;
      if (!isNonNeg(c.sold) || !isNonNeg(c.tax) || !isNonNeg(c.exp) || !(c.actual > 0)) {
        clearPreview();
      } else {
        if (pv.soldTotal) pv.soldTotal.textContent = cur(c.sold, settleCcy, digits);
        if (pv.totalCost) pv.totalCost.textContent = cur(c.totalCost, settleCcy, digits);
        if (pv.netLocal) pv.netLocal.textContent = cur(c.net, settleCcy, digits);
        if (pv.projectCost) pv.projectCost.textContent = cur(c.actual, settleCcy, digits);
        if (pv.pureLocal) pv.pureLocal.textContent = curSigned(c.projectPureLocal, settleCcy, digits);
        if (pv.fundedUsdt) pv.fundedUsdt.textContent = c.fundedUsdt > 0 ? usdt(c.fundedUsdt, 6) : "-";
        if (pv.fundingFx) pv.fundingFx.textContent = c.fundingFx > 0 ? formatFxValue(c.fundingFx) : "-";
        if (pv.principalLocal) pv.principalLocal.textContent = Number.isFinite(c.principal) ? cur(c.principal, settleCcy, digits) : "-";
        if (pv.principalLocalMeta) pv.principalLocalMeta.textContent = Number.isFinite(c.principalPct) ? `플랫폼 유저 비율 ${fmtNum(c.principalPct, 4)}%` : "-";
        if (pv.externalCapital) pv.externalCapital.textContent = Number.isFinite(c.externalCapital) ? cur(c.externalCapital, settleCcy, digits) : "-";
        if (pv.externalCapitalMeta) pv.externalCapitalMeta.textContent = Number.isFinite(c.externalPct) ? `외부 비율 ${fmtNum(c.externalPct, 4)}%` : "-";
        if (pv.investorLocal) pv.investorLocal.textContent = Number.isFinite(c.investorLocal) ? cur(c.investorLocal, settleCcy, digits) : "-";
        if (pv.investorLocalMeta) pv.investorLocalMeta.textContent = Number.isFinite(c.principalPct) ? `플랫폼 유저 비율 ${fmtNum(c.principalPct, 4)}%` : "-";
        if (pv.externalAllocation) pv.externalAllocation.textContent = Number.isFinite(c.externalAllocation) ? cur(c.externalAllocation, settleCcy, digits) : "-";
        if (pv.externalAllocationMeta) pv.externalAllocationMeta.textContent = Number.isFinite(c.externalPct) ? `외부 비율 ${fmtNum(c.externalPct, 4)}%` : "-";
        if (pv.supplyTokens) pv.supplyTokens.textContent = supply > 0 ? `${fmtNum(supply, supplyDigits)} TOKEN` : "-";
        if (pv.redeemLocal) pv.redeemLocal.textContent = Number.isFinite(c.unitLocal) ? cur(c.unitLocal, settleCcy, 6) : "-";
        if (pv.payoutFx) pv.payoutFx.textContent = c.payoutFx > 0 ? formatFxValue(c.payoutFx) : "-";
        if (pv.redeemUsdt) pv.redeemUsdt.textContent = Number.isFinite(c.unitUsdt) ? usdt(c.unitUsdt, 6) : "-";
        if (pv.saleDate) pv.saleDate.textContent = normalizeSaleDateValue(els.ws?.value || "") || "-";
        if (pv.totalCostInput) pv.totalCostInput.textContent = cur(c.totalCost, settleCcy, digits);
      }

      const vaultValue = Number.isFinite(c.investorUsdt)
        ? c.investorUsdt
        : (isExecuted() && Number.isFinite(c.storedVaultUsdt) ? c.storedVaultUsdt : NaN);
      if (els.vault) els.vault.value = Number.isFinite(vaultValue) ? String(Math.max(0, vaultValue)) : "";

      updateFormulaHelps(c);
      renderExecutionMeta(c);
      renderExecutePolicyWarning();
    };

    const loadConfig = async () => {
      const cfg = await api("/api/public/config").catch(() => null);
      fxRates = cfg?.fx_rates || {};
      const payday = Number(cfg?.interest_pay_day || 15);
      interestPayDay = Number.isFinite(payday) && payday > 0 ? payday : 15;
      if (Array.isArray(cfg?.settlement_lock_days) && cfg.settlement_lock_days.length) {
        executionLock = normalizeExecutionLock({ ...executionLock, days: cfg.settlement_lock_days });
      }
      applySaleDateConstraints();
    };

    const renderAssetOptions = ({ preserveSelection = true } = {}) => {
      if (!els.assetSel) return;

      const selectedId = preserveSelection ? String(els.assetSel.value || "").trim() : "";
      const keyword = normalizeSearchText(els.assetSearch?.value || "");
      const filter = String(els.assetFilter?.value || "all").trim();
      const visible = assets.filter((asset) => {
        const sold = isSoldAssetRow(asset);
        if (filter === "sold" && !sold) return false;
        if (filter === "unsold" && sold) return false;
        if (keyword && !getAssetSearchHaystack(asset).includes(keyword)) return false;
        return true;
      });
      const current = selectedId ? assets.find((asset) => String(asset?.id || "").trim() === selectedId) : null;
      const buildGroup = (rows) => rows.map((asset) => `<option value="${esc(asset.id)}">${esc(buildAssetOptionLabel(asset))}</option>`).join("");
      const unsoldRows = visible.filter((asset) => !isSoldAssetRow(asset));
      const soldRows = visible.filter((asset) => isSoldAssetRow(asset));

      let html = "";
      const visibleIds = new Set(visible.map((asset) => String(asset?.id || "").trim()));
      if (current && !visibleIds.has(selectedId)) {
        html += `<optgroup label="현재 선택"><option value="${esc(current.id)}">${esc(buildAssetOptionLabel(current))}</option></optgroup>`;
      }
      if (unsoldRows.length) html += `<optgroup label="미매각 자산">${buildGroup(unsoldRows)}</optgroup>`;
      if (soldRows.length) html += `<optgroup label="매각 자산">${buildGroup(soldRows)}</optgroup>`;
      if (!html) html = `<option value="">표시할 자산이 없습니다.</option>`;

      els.assetSel.innerHTML = html;
      if (current && selectedId) {
        els.assetSel.value = selectedId;
      } else if (visible.length) {
        els.assetSel.value = String(visible[0]?.id || "");
      } else {
        els.assetSel.value = "";
      }

      if (els.assetFilterMeta) {
        const soldCount = assets.filter((asset) => isSoldAssetRow(asset)).length;
        const unsoldCount = Math.max(0, assets.length - soldCount);
        const visibleCount = visible.length;
        const extras = [];
        extras.push(`미매각 ${fmtNum(unsoldCount, 0)}건`);
        extras.push(`매각 ${fmtNum(soldCount, 0)}건`);
        extras.push(`현재 ${fmtNum(visibleCount, 0)}건 표시`);
        if (current && !visibleIds.has(selectedId)) extras.push('현재 선택 자산은 상단에 유지됩니다.');
        els.assetFilterMeta.textContent = extras.join(' · ');
      }
    };

    const loadAssets = async () => {
      const r = await api("/api/assets");
      assets = Array.isArray(r.assets) ? r.assets : [];
      renderAssetOptions({ preserveSelection: true });
    };

    const loadAsset = async (id) => {
      const d = await api(`/api/assets/${encodeURIComponent(id)}`);
      assetDetail = d?.asset || null;
      if (assetDetail) {
        assets = assets.map((asset) => String(asset?.id || "").trim() === String(id || "").trim()
          ? { ...asset, ...assetDetail }
          : asset);
        renderAssetOptions({ preserveSelection: true });
      }
      return assetDetail;
    };

    const loadSale = async (id) => {
      try {
        const d = await api(`/api/admin/sales/${encodeURIComponent(id)}`);
        saleDetail = d?.sale || null;
        draftSale = d?.draft || d?.sale || null;
        saleLockState = normalizeSaleLock(d?.sale_lock || null);
        if (saleDetail && saleLockState.executedAt && !saleDetail.sale_executed_at) saleDetail.sale_executed_at = saleLockState.executedAt;
        if (saleDetail && saleLockState.executedAtKst && !saleDetail.sale_executed_at_kst) saleDetail.sale_executed_at_kst = saleLockState.executedAtKst;
        if (saleDetail && saleLockState.locked) saleDetail.sale_executed = true;
        executePrecheck = normalizeExecutePrecheck(d?.precheck || null);
        if (d?.fx_preview) fxPreview = normalizeFxPreview(d.fx_preview);
        if (d?.execution_lock) executionLock = normalizeExecutionLock(d.execution_lock);
        if (executePrecheck?.executionLock) executionLock = executePrecheck.executionLock;
        return saleDetail;
      } catch (e) {
        if (handleAdminSessionExpired(e)) return null;
        throw e;
      }
    };

    const loadFxPreview = async () => {
      const assetId = String(els.assetSel?.value || "").trim();
      const windowStart = String(els.ws?.value || "").trim();
      const currentFx = getFxNow();
      fxPreview = normalizeFxPreview({
        autoFx: 0,
        autoFound: false,
        fetchedAt: "",
        provider: "",
        date: windowStart,
        currentFx,
        source: windowStart ? "missing" : "current",
        message: windowStart ? `${windowStart} 기준 환율 이력이 없습니다. 관리자 수동 환율을 입력하세요.` : "",
      });

      if (settleCcy === "USDT") {
        fxPreview = normalizeFxPreview({
          autoFx: 1,
          autoFound: true,
          fetchedAt: "",
          provider: "system",
          date: windowStart,
          currentFx: 1,
          source: "usdt",
          message: "",
        });
        return fxPreview;
      }

      if (!assetId || !windowStart) {
        return fxPreview;
      }

      let r;
      try {
        r = await api(`/api/admin/sales/${encodeURIComponent(assetId)}/fx-preview?date=${encodeURIComponent(windowStart)}`);
      } catch (e) {
        if (handleAdminSessionExpired(e)) return fxPreview;
        throw e;
      }
      fxPreview = normalizeFxPreview({
        autoFx: Number(r?.auto_fx_per_usdt || 0),
        autoFound: !!r?.historical_found,
        fetchedAt: String(r?.historical_fetched_at || "").trim(),
        provider: String(r?.historical_provider || "").trim(),
        date: windowStart,
        currentFx: Number(r?.current_fx_per_usdt || currentFx),
        source: String(r?.source || (r?.historical_found ? "historical" : "missing")),
        message: !r?.historical_found ? `${windowStart} 기준 환율 이력이 없습니다. 관리자 수동 환율을 입력하세요.` : "",
      });
      return fxPreview;
    };

    const renderSaleDocs = (docs) => {
      if (!els.saleDocListTbody) return;
      const typeLabel = {
        sale: "매각공문/정산문서",
        sale_proof: "매각증빙자료",
      };
      els.saleDocListTbody.innerHTML = docs.map((row) => {
        const href = absUrl(row.file_path);
        return `<tr>
          <td>${typeLabel[row.doc_type] || row.doc_type || "-"}</td>
          <td>${row.title || "-"}</td>
          <td class="right">${row.doc_date || "-"}</td>
          <td class="right"><a class="btn small" href="${href}" target="_blank" rel="noopener">보기</a></td>
          <td class="right"><button class="btn small danger" data-del-sale-doc="${row.id}">삭제</button></td>
        </tr>`;
      }).join("") || `<tr><td colspan="5" class="center muted">문서가 없습니다.</td></tr>`;

      Array.from(els.saleDocListTbody.querySelectorAll("[data-del-sale-doc]")).forEach((btn) => {
        btn.addEventListener("click", async () => {
          const assetId = String(els.assetSel?.value || "").trim();
          const docId = String(btn.getAttribute("data-del-sale-doc") || "").trim();
          if (!assetId || !docId) return;
          try {
            await api(`/api/admin/sales/${encodeURIComponent(assetId)}/docs/${encodeURIComponent(docId)}`, { method: "DELETE" });
            toast("삭제 완료", "good");
            await loadSaleDocs();
          } catch (e) {
            toast(e.message || "삭제 실패", "bad");
          }
        });
      });
    };

    const loadSaleDocs = async () => {
      const assetId = String(els.assetSel?.value || "").trim();
      if (!assetId) {
        renderSaleDocs([]);
        return;
      }
      let r = { docs: [] };
      try {
        r = await api(`/api/admin/sales/${encodeURIComponent(assetId)}/docs`);
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        throw e;
      }
      const docs = r?.docs || [];
      if (els.saleDocHint) els.saleDocHint.textContent = `${assetId} · 매각 문서 ${docs.length}개`;
      renderSaleDocs(docs);
    };

    const fill = async () => {
      const id = String(els.assetSel?.value || "").trim();
      if (!id) return;

      if (id !== lastAssetId && els.setToSold) els.setToSold.checked = false;
      lastAssetId = id;
      if (els.link) els.link.href = `../user/sale-detail.html?id=${encodeURIComponent(id)}`;

      bindFormulaTooltips();
    await loadConfig();
      const a = await loadAsset(id);
      const s = await loadSale(id);
      settleCcy = String(a?.settlement_basis || "KRW").toUpperCase();
      if (els.settleCcy) els.settleCcy.textContent = settleCcy;
      if (pv.settleBadge) pv.settleBadge.textContent = settleCcy;
      updateFieldCurrencyBadges();
      if (els.status) els.status.textContent = a?.status || "-";
      if (pv.market) pv.market.textContent = a?.market || "-";
      if (pv.title) pv.title.textContent = a ? `${a.id} · ${a.name}` : "-";
      setImg(pv.img, a?.image_url || "");
      if (pv.supply) pv.supply.textContent = a?.supply_token != null ? `${fmtNum(a.supply_token, 6)} TOKEN` : "-";

      if (s) {
        const draft = draftSale || s;
        if (els.actualBuy) els.actualBuy.value = String(draft.actual_acquisition_cost_input ?? s.actual_acquisition_cost_input ?? draft.buy_price_input ?? s.buy_price_input ?? draft.buy_price_krw ?? s.buy_price_krw ?? "");
        if (els.sold) els.sold.value = String(draft.sold_price_input ?? s.sold_price_input ?? draft.sold_price_krw ?? s.sold_price_krw ?? "");
        if (els.tax) els.tax.value = String(draft.sale_tax_input ?? s.sale_tax_input ?? draft.sale_tax_amount ?? s.sale_tax_amount ?? 0);
        if (els.exp) els.exp.value = String(draft.other_expenses_input ?? s.other_expenses_input ?? draft.other_expenses_amount ?? s.other_expenses_amount ?? draft.expenses_input ?? s.expenses_input ?? draft.expenses_krw ?? s.expenses_krw ?? 0);
        if (els.ws) els.ws.value = normalizeSaleDateValue(draft.sale_date || s.sale_date || draft.window_start || s.window_start || "");
        if (els.we) els.we.value = "";
        if (els.manualFx) {
          const savedManualFx = Number(draft.manual_fx_per_usdt || s.manual_fx_per_usdt || 0);
          els.manualFx.value = savedManualFx > 0 ? String(savedManualFx) : "";
        }
      } else {
        if (els.actualBuy) els.actualBuy.value = String(getFixedPrincipalInput() || "");
        if (els.sold) els.sold.value = "";
        if (els.tax) els.tax.value = "";
        if (els.exp) els.exp.value = "";
        if (els.ws) els.ws.value = "";
        if (els.we) els.we.value = "";
        if (els.manualFx) els.manualFx.value = "";
      }

      applySaleDateConstraints();

      try {
        await loadFxPreview();
      } catch (e) {
        fxPreview.autoFx = 0;
        fxPreview.autoFound = false;
        fxPreview.fetchedAt = "";
        fxPreview.provider = "";
        if (els.dateFxMeta) {
          els.dateFxMeta.textContent = e?.message || "매각일 기준 환율 참고 조회에 실패했습니다. 관리자 수동 환율을 입력하세요.";
        }
      }
      renderPreview();
      await loadSaleDocs();
    };

    const validateBeforeSave = () => {
      const id = String(els.assetSel?.value || "").trim();
      if (!id) throw new Error("자산을 선택하세요.");
      if (!assetDetail) throw new Error("자산 정보를 불러오지 못했습니다.");
      if (isExecuted()) throw new Error("이미 매각 실행된 자산은 수정할 수 없습니다.");

      const c = calc();
      const ws = els.ws?.value ? normalizeSaleDateValue(els.ws.value) : null;
      const manualRaw = String(els.manualFx?.value || "").trim();
      const manualFx = getManualFx();

      if (!(c.actual > 0)) throw new Error("실부동산 실제 매수금액(총 취득원가)을 입력하세요.");
      if (!isNonNeg(c.sold) || !isNonNeg(c.tax) || !isNonNeg(c.exp)) {
        throw new Error("매각금액/매각세금/기타비용은 0 이상의 숫자만 입력하세요.");
      }
      if (ws) validateSaleDateInput(ws);
      if (settleCcy !== "USDT" && !(manualFx > 0)) {
        throw new Error("관리자 수동 환율을 입력 후 저장/실행하세요. 매각일 기준 자동 조회 환율은 참고용입니다.");
      }
      if (manualRaw && !(manualFx > 0)) {
        throw new Error("관리자 수동 환율은 0보다 큰 숫자만 입력하세요.");
      }
      if (c.actual + 0.000001 < c.principal) {
        throw new Error("실제 취득원가는 플랫폼 유저 총 투자금보다 작을 수 없습니다.");
      }
      if (settleCcy !== "USDT" && (c.investorLocal > 0 || c.net > 0) && !(c.payoutFx > 0)) {
        throw new Error("관리자 수동 환율을 입력해야 플랫폼 유저 할당총액을 계산할 수 있습니다.");
      }

      return { id, c, ws, manualFx };
    };

    const saveDraft = async ({ silent = false } = {}) => {
      const { id, c, ws, manualFx } = validateBeforeSave();
      await api("/api/admin/sales/upsert", {
        method: "POST",
        body: {
          sale: {
            asset_id: id,
            actual_acquisition_cost_input: c.actual,
            sold_price_input: c.sold,
            sold_price_krw: c.sold,
            sale_tax_input: c.tax,
            sale_tax_amount: c.tax,
            other_expenses_input: c.exp,
            expenses_krw: c.exp,
            sale_date: ws,
            window_start: ws,
            manual_fx_per_usdt: settleCcy === "USDT" ? 0 : manualFx,
          }
        }
      });
      await loadSale(id);
      try {
        await loadFxPreview();
      } catch (_) {}
      renderPreview();
      if (!silent) toast("저장 완료", "good");
      return calc();
    };

    const buildExecuteSummaryHtml = (c) => {
      const digits = settleCcy === "USDT" ? 6 : 0;
      const items = [
        ["자산", assetDetail ? `${assetDetail.id} · ${assetDetail.name}` : "-"],
        ["정산통화", settleCcy],
        ["총매각금(정산통화)", cur(c.sold, settleCcy, digits)],
        ["세금 및 비용(정산통화)", cur(c.totalCost, settleCcy, digits)],
        ["순매각금(정산통화)", cur(c.net, settleCcy, digits)],
        ["취득원가(정산통화)", cur(c.actual, settleCcy, digits)],
        ["플랫폼 유저 투자금액(USDT)", usdt(Math.max(0, Number(c.fundedUsdt || 0)), 6)],
        ["확정환율(모금 확정)", c.fundingFx > 0 ? formatFxValue(c.fundingFx) : "-"],
        ["투자금액 확정환율 환산(정산통화)", cur(c.principal, settleCcy, digits)],
        ["외부자금(정산통화)", cur(c.externalCapital, settleCcy, digits)],
        ["플랫폼 유저 할당총액(정산통화)", cur(c.investorLocal, settleCcy, digits)],
        ["외부투자자 할당총액(정산통화)", cur(c.externalAllocation, settleCcy, digits)],
        ["총발행 토큰수량", `${fmtNum(Number(assetDetail?.supply_token || 0), Number.isInteger(Number(assetDetail?.supply_token || 0)) ? 0 : 6)} TOKEN`],
        ["토큰당 가격(정산통화)", Number.isFinite(c.unitLocal) ? cur(c.unitLocal, settleCcy, 6) : "-"],
        ["매각 환율(적용)", c.payoutFx > 0 ? formatFxValue(c.payoutFx) : "-"],
        ["토큰당 교환금액(USDT)", Number.isFinite(c.unitUsdt) ? usdt(Math.max(0, Number(c.unitUsdt || 0)), 6) : "-"],
        ["매각일", `${normalizeSaleDateValue(els.ws?.value || "") || "-"}`],
        ["이자 처리 기준", getInterestPolicyText()],
      ];
      return items.map(([label, value]) => `<div class="notice" style="margin:0"><strong>${label}</strong><br>${value || "-"}</div>`).join("");
    };

    const closeExecuteModal = () => {
      if (!els.executeModal) return;
      els.executeModal.hidden = true;
      renderExecuteCheck("", "info");
      if (els.shell) els.shell.inert = false;
      if (lastFocus && typeof lastFocus.focus === "function") {
        try { lastFocus.focus(); } catch (_) {}
      }
    };

    const openExecuteModal = async () => {
      if (isExecuted()) return toast("이미 매각 실행이 완료되었습니다.", "bad");
      if (isExecutionLockedToday()) return toast(getExecutionLockMessage(), "bad");
      const saleDateBlocker = getClientSaleDateBlocker();
      if (saleDateBlocker) return toast(saleDateBlocker, "bad");
      if (!els.setToSold?.checked) return toast("매각 실행 체크를 먼저 선택하세요.", "bad");
      if (!normalizeSaleDateValue(els.ws?.value || "")) return toast("매각일을 입력한 뒤 매각을 실행하세요.", "bad");
      const c = await saveDraft({ silent: true });
      if (!els.executeModal || !els.executeSummary) return;
      els.executeSummary.innerHTML = buildExecuteSummaryHtml(c);
      renderExecuteCheck(executePrecheck?.message || "", executePrecheck?.ready ? "good" : "bad");
      if (els.confirmUsername) els.confirmUsername.value = currentAdminUsername;
      if (els.confirmPassword) els.confirmPassword.value = "";
      if (els.confirmSubmitBtn) els.confirmSubmitBtn.disabled = !executePrecheck?.ready;
      lastFocus = document.activeElement;
      if (els.shell) els.shell.inert = true;
      els.executeModal.hidden = false;
      try { els.executeModal.querySelector('.sale-modal')?.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) {}
      setTimeout(() => {
        try { ((executePrecheck?.ready ? els.confirmPassword : els.confirmCancelBtn) || els.confirmUsername)?.focus(); } catch (_) {}
      }, 0);
    };

    const applyExecutedResponse = (res) => {
      const fixedFx = Number(res?.fixed_fx_per_usdt || 0);
      const executedAt = String(res?.sale_executed_at || res?.executed_at || "").trim();
      const executedAtKst = String(res?.sale_executed_at_kst || res?.executed_at_kst || "").trim();
      const executedBy = String(res?.executed_by || currentAdminUsername || "admin").trim() || "admin";
      const assetStatus = String(res?.asset_status || assetDetail?.status || saleDetail?.status || "매각").trim() || "매각";

      if (assetDetail) assetDetail = { ...assetDetail, status: assetStatus, display_status: assetStatus };
      assets = assets.map((asset) => String(asset?.id || "").trim() === String(res?.asset_id || assetDetail?.id || "").trim()
        ? { ...asset, status: assetStatus, display_status: assetStatus }
        : asset);
      renderAssetOptions({ preserveSelection: true });
      saleDetail = {
        ...(saleDetail || {}),
        status: assetStatus,
        sale_executed: true,
        sale_executed_at: executedAt || saleDetail?.sale_executed_at || "",
        sale_executed_at_kst: executedAtKst || saleDetail?.sale_executed_at_kst || "",
        sale_executed_by: executedBy,
        fixed_fx_per_usdt: fixedFx > 0 ? fixedFx : Number(saleDetail?.fixed_fx_per_usdt || 0),
      };
      draftSale = {
        ...(draftSale || {}),
        executed_at: executedAt || draftSale?.executed_at || "",
        executed_at_kst: executedAtKst || draftSale?.executed_at_kst || "",
        executed_by: executedBy,
        fixed_fx_per_usdt: fixedFx > 0 ? fixedFx : Number(draftSale?.fixed_fx_per_usdt || 0),
        manual_fx_per_usdt: Number(res?.manual_fx_per_usdt || draftSale?.manual_fx_per_usdt || 0),
      };
      saleLockState = normalizeSaleLock(res?.sale_lock || {
        locked: true,
        reason_code: "ALREADY_EXECUTED",
        message: "이미 매각 실행이 완료된 자산입니다.",
        executed_at: executedAt,
        executed_at_kst: executedAtKst,
        fixed_fx_per_usdt: fixedFx,
        asset_status: assetStatus,
      });
      executePrecheck = normalizeExecutePrecheck({
        ready: false,
        message: "이미 매각 실행이 완료된 자산입니다.",
        reason_code: "ALREADY_EXECUTED",
        blockers: [{ code: "ALREADY_EXECUTED", message: "이미 매각 실행이 완료된 자산입니다." }],
      });
      if (els.status) els.status.textContent = assetStatus;
      if (els.setToSold) els.setToSold.checked = true;
      renderPreview();
    };

    const executeSale = async () => {
      const id = String(els.assetSel?.value || "").trim();
      if (!id) return toast("자산을 선택하세요.", "bad");
      if (isExecutionLockedToday()) return toast(getExecutionLockMessage(), "bad");
      const username = String(els.confirmUsername?.value || "").trim();
      const password = String(els.confirmPassword?.value || "").trim();
      if (!username || !password) return toast("관리자 아이디와 비밀번호를 입력하세요.", "bad");

      try {
        if (els.confirmSubmitBtn) els.confirmSubmitBtn.disabled = true;
        const res = await api(`/api/admin/sales/${encodeURIComponent(id)}/execute`, {
          method: "POST",
          body: { username, password }
        });

        closeExecuteModal();
        applyExecutedResponse(res);

        const extra = [];
        const unstakeCount = Number(res?.unstaked_holder_count || 0);
        const canceledCount = Number(res?.canceled_current_month_interest_count || 0);
        const fixedFx = Number(res?.fixed_fx_per_usdt || 0);
        if (fixedFx > 0) {
          const fxSourceLabel = res?.fx_source === "manual" ? "수동환율" : (res?.fx_source === "historical" ? "자동조회환율" : "고정환율");
          extra.push(`${fxSourceLabel} ${formatFxValue(fixedFx)}`);
        }
        if (unstakeCount > 0) extra.push(`언스테이킹 ${unstakeCount}명`);
        if (Number(res?.awarded_interest_count || 0) > 0) extra.push(`실행월 이자 배정 ${Number(res?.awarded_interest_count || 0)}건`);
        if (canceledCount > 0) extra.push(`미지급 이자 취소 ${canceledCount}건`);
        if (res?.interest_kept_current_month) extra.push(`실행월 이자 유지`);
        toast(`매각 실행 완료${extra.length ? ` · ${extra.join(" / ")}` : ""}`, "good");

        try {
          await fill();
        } catch (refreshError) {
          if (handleAdminSessionExpired(refreshError)) return;
          renderPreview();
          toast("매각 실행은 완료되었지만 화면 동기화에 실패했습니다. 상단 새로고침으로 상태를 다시 확인하세요.", "bad");
        }
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        if (e?.payload?.execution_lock) {
          executionLock = normalizeExecutionLock(e.payload.execution_lock);
          renderPreview();
        }
        if (e?.payload?.precheck) {
          executePrecheck = normalizeExecutePrecheck(e.payload.precheck);
          if (executePrecheck?.executionLock) executionLock = executePrecheck.executionLock;
        }
        if (e?.payload?.sale_lock) {
          saleLockState = normalizeSaleLock(e.payload.sale_lock);
        }
        if (els.confirmPassword && Number(e?.status || 0) === 401) {
          els.confirmPassword.value = "";
          setTimeout(() => {
            try { els.confirmPassword.focus(); } catch (_) {}
          }, 0);
        }
        renderExecuteCheck(e.message || executePrecheck?.message || "매각 실행 실패", "bad");
        renderPreview();
        toast(e.message || "매각 실행 실패", "bad");
      } finally {
        if (els.confirmSubmitBtn) els.confirmSubmitBtn.disabled = !executePrecheck?.ready || isExecuted();
      }
    };

    const refreshAssetSelectorView = () => {
      renderAssetOptions({ preserveSelection: true });
    };

    els.assetFilter?.addEventListener("change", refreshAssetSelectorView);
    els.assetSearch?.addEventListener("input", refreshAssetSelectorView);

    els.assetSel?.addEventListener("change", async () => {
      try {
        await fill();
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        toast(e.message || "자산 로드 실패", "bad");
      }
    });

    els.refreshBtn?.addEventListener("click", async () => {
      try {
        await fill();
        toast("새로고침 완료", "good");
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        toast(e.message || "새로고침 실패", "bad");
      }
    });

    const onSaveClick = async () => {
      try {
        await saveDraft();
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        toast(e.message || "저장 실패", "bad");
      }
    };
    els.saveBtn?.addEventListener("click", onSaveClick);
    els.inlineSaveBtn?.addEventListener("click", onSaveClick);

    els.executeBtn?.addEventListener("click", async () => {
      try {
        await openExecuteModal();
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        toast(e.message || "매각 실행 준비 실패", "bad");
      }
    });

    [els.actualBuy, els.sold, els.tax, els.exp, els.manualFx].forEach((el) => el?.addEventListener("input", renderPreview));
    els.ws?.addEventListener("change", async () => {
      applySaleDateConstraints();
      try {
        validateSaleDateInput(els.ws?.value || "");
      } catch (e) {
        toast(e.message || "매각일을 다시 확인하세요.", "bad");
      }
      try {
        await loadFxPreview();
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        fxPreview.autoFx = 0;
        fxPreview.autoFound = false;
        fxPreview.fetchedAt = "";
        fxPreview.provider = "";
        if (els.dateFxMeta) els.dateFxMeta.textContent = e?.message || "매각일 기준 환율 참고 조회에 실패했습니다. 관리자 수동 환율을 입력하세요.";
      }
      renderPreview();
    });
    els.setToSold?.addEventListener("change", renderPreview);

    els.saleDocRefreshBtn?.addEventListener("click", async () => {
      try {
        await loadSaleDocs();
        toast("새로고침 완료", "good");
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        toast(e.message || "문서 새로고침 실패", "bad");
      }
    });

    els.saleDocUploadBtn?.addEventListener("click", async () => {
      const assetId = String(els.assetSel?.value || "").trim();
      const type = String(els.saleDocType?.value || "sale").trim();
      const title = String(els.saleDocTitle?.value || "").trim() || "매각 문서";
      const docDate = String(els.saleDocDate?.value || "").trim();
      const file = els.saleDocFile?.files?.[0];

      if (!assetId) return toast("자산을 선택하세요.", "bad");
      if (!["sale", "sale_proof"].includes(type)) return toast("올바른 문서 유형을 선택하세요.", "bad");
      if (!file) return toast("파일을 선택하세요.", "bad");

      const fd = new FormData();
      fd.append("type", type);
      fd.append("title", title);
      if (docDate) fd.append("date", docDate);
      fd.append("file", file);

      try {
        els.saleDocUploadBtn.disabled = true;
        await uploadForm(`/api/admin/sales/${encodeURIComponent(assetId)}/docs`, fd);
        toast("업로드 완료", "good");
        if (els.saleDocTitle) els.saleDocTitle.value = "";
        if (els.saleDocDate) els.saleDocDate.value = "";
        if (els.saleDocFile) els.saleDocFile.value = "";
        await loadSaleDocs();
      } catch (e) {
        if (handleAdminSessionExpired(e)) return;
        toast(e.message || "업로드 실패", "bad");
      } finally {
        els.saleDocUploadBtn.disabled = false;
      }
    });

    els.confirmCancelBtn?.addEventListener("click", closeExecuteModal);
    els.confirmSubmitBtn?.addEventListener("click", executeSale);
    els.executeModal?.addEventListener("click", (e) => {
      if (e.target === els.executeModal) closeExecuteModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.executeModal?.hidden) {
        closeExecuteModal();
      }
    });

    try {
      await loadAssets();
      applySaleDateConstraints();
      if (assets.length) {
        await fill();
      } else if (els.saleDocHint) {
        els.saleDocHint.textContent = "등록된 자산이 없습니다.";
      }
    } catch (e) {
      if (handleAdminSessionExpired(e)) return;
      toast(e.message || "매각 관리 페이지를 불러오지 못했습니다.", "bad");
    }
  });
})();
