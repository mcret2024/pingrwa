// public/assets/js/pages/staking.js
(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  window.RwaPages["staking"] = async () => {
    const C = window.RwaCore;
    if (!C) throw new Error("RwaCore가 로드되지 않았습니다.");
    if (typeof C.api !== "function") throw new Error("RwaCore.api가 없습니다.");

    // (2026-05-07) Skip the legacy RECON staking page bindings when the page
    // is using the Silica HTML layout. The Silica layout uses #stakeAmountInput
    // (not #stakeAmount) and is wired entirely from silica-data-bind.js's
    // staking block — running this file's handlers in parallel produced
    // duplicate toasts (e.g., a Korean "수량을 입력하세요" notification firing
    // alongside the success modal because qs("#stakeAmount") resolved to null).
    if (document.getElementById("stakeAmountInput") && !document.getElementById("stakeAmount")) {
      return;
    }

    const qs = (sel, el = document) => (typeof C.qs === "function" ? C.qs(sel, el) : el.querySelector(sel));
    const toast = (msg, kind) => (typeof C.toast === "function" ? C.toast(msg, kind) : console.log(msg));
    const absUrl = (u) => (typeof C.absUrl === "function" ? C.absUrl(u || "") : (u || ""));
    const getWallet = () => (typeof C.getWallet === "function" ? C.getWallet() : { connected: false });

    const I18N = window.RwaI18n || {};
    const t = (value) => {
      const raw = String(value ?? "");
      return typeof I18N.translateString === "function" ? I18N.translateString(raw) : raw;
    };
    const getLang = () => (typeof I18N.getLang === "function" ? I18N.getLang() : "ko");
    const countText = (n, unit) => (typeof I18N.formatCount === "function" ? I18N.formatCount(n, unit) : `${n}${unit || ""}`);

    const langText = (ko, en, ja, zh) => {
      const lang = getLang();
      if (lang === "en") return en ?? ko;
      if (lang === "ja") return ja ?? ko;
      if (lang === "zh") return zh ?? ko;
      return ko;
    };
    const tt = langText;

    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;

    const fmtNum = (n, d = 2) => (C.fmt?.num ? C.fmt.num(n, d) : Number(n || 0).toFixed(d));
    const fmtPct = (n, d = 1) => (C.fmt?.pct ? C.fmt.pct(n, d) : `${Number(n || 0).toFixed(d)}%`);
    const fmtTime = (s) => (C.fmt?.time ? C.fmt.time(s) : (s ? String(s) : "-"));
    const fmtRateSummary = (n) => {
      const x = Number(n);
      return Number.isFinite(x) ? fmtNum(x, 1) : "-";
    };
    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    // (2026-05-06) Silica 단순 상태머신 호환 — '활성' 추가, RECON legacy 값(분배중/운영중)도 유지.
    // 백엔드 staking.php 의 stakingAllowsNewStake 와 동일하게 블랙리스트 정책으로 흡수:
    // 매각/매각(완료)/모집실패/취소됨 만 차단, 그 외 모든 상태에서 스테이킹 허용.
    const DISPLAYABLE_STATUSES = new Set(["활성", "분배중", "운영중", "매각", "매각(완료)"]);
    const STAKEABLE_STATUSES   = new Set(["활성", "분배중", "운영중"]);
    const SOLD_STATUSES        = new Set(["매각", "매각(완료)"]);
    const SOLD_STATUS = "매각"; // legacy compat — 단일값 비교 코드가 있어 유지

    const statusOrder = (s) => {
      if (s === "모집중") return 0;
      if (s === "구매진행") return 1;
      if (s === "분배중") return 2;
      if (s === "운영중") return 3;
      if (s === "매각") return 4;
      if (s === "모집실패") return 5;
      if (s === "취소됨") return 6;
      return 99;
    };

    const normalizeStatusForUi = (a) => {
      const status = String(a?.status || "");
      const raised = Number(a?.raised_usdt || 0);
      const target = Number(a?.target_usdt || 0);

      if (status === "모집중" && target > 0 && raised >= target) {
        return "구매진행";
      }
      return status;
    };

    const compareAssets = (a, b) => {
      const sa = normalizeStatusForUi(a);
      const sb = normalizeStatusForUi(b);

      const p = statusOrder(sa) - statusOrder(sb);
      if (p !== 0) return p;

      return String(a?.id || "").localeCompare(String(b?.id || ""), "en", {
        numeric: true,
        sensitivity: "base",
      });
    };

    const tokenAmount = (row) => {
      const bal = Number(row?.balance_token || 0);
      const staked = Number(row?.staked_token || 0);
      return bal + staked;
    };

    // ---------- DOM ----------
    const sel = qs("#stakeAssetSelect");
    if (!sel) return;

    const lockBadge = qs("#stakeLockBadge");
    const lockDaysLabel = qs("#stakeLockDaysLabel");
    const lockDaysLabel2 = qs("#stakeLockDaysLabel2");

    const stakeNotice = qs("#stakeNotice");
    const lockCountdownBox = qs("#stakeLockCountdownBox");
    const lockCountdownTitle = qs("#stakeLockCountdownTitle");
    const lockCountdownSub = qs("#stakeLockCountdownSub");
    const lockResumeLabel = qs("#stakeLockResumeLabel");
    const lockModal = qs("#stakeLockModal");
    const lockModalBackdrop = qs("#stakeLockModalBackdrop");
    const lockModalBadge = qs("#stakeLockModalBadge");
    const lockModalTitle = qs("#stakeLockModalTitle");
    const lockModalDesc = qs("#stakeLockModalDesc");
    const lockModalResumeLabel = qs("#stakeLockModalResumeLabel");
    const lockModalNote = qs("#stakeLockModalNote");
    const lockModalClose = qs("#stakeLockModalClose");

    const assetImg = qs("#stakeAssetImg");
    const tokenImg = qs("#stakeTokenImg");
    const ownedOnlyChk = qs("#stakeOwnedOnly");
    const assetName = qs("#stakeAssetName");
    const assetLink = qs("#stakeAssetLink");
    const aprEl = qs("#stakeApr");
    const tokenMetaEl = qs("#stakeTokenSymbol");
    const settlementMetaEl = qs("#stakeSettlementCode");

    const rulesSummaryEl = qs("#stakeRulesSummary");
    const rulesTextEl = qs("#stakeRulesText");

    const curEls = [
      qs("#stakeCurCode2"),
      qs("#stakeCurCode3"),
      qs("#stakeCurCode4"),
      qs("#stakeCurCode5"),
    ];

    const balEl = qs("#stakeBalance");
    const stakedEl = qs("#stakeStaked");

    const stakeAmount = qs("#stakeAmount");
    const unstakeAmount = qs("#unstakeAmount");
    const stakeBtn = qs("#stakeBtn");
    const unstakeBtn = qs("#unstakeBtn");
    const stakeMaxBtn = qs("#stakeMaxBtn");
    const unstakeMaxBtn = qs("#unstakeMaxBtn");

    const paydayLabelEl = qs("#interestPaydayLabel");
    const paydayEl = qs("#interestPayday");
    const interestEst = qs("#interestEstimate");
    const interestStaked = qs("#interestStaked");
    const interestApr = qs("#interestApr");
    const interestFxLine = qs("#interestFxLine");
    const interestFxHint = qs("#interestFxHint");
    const claimBtn = qs("#interestClaimBtn");
    const hintEl = qs("#interestHint");
    const histBody = qs("#interestHistory");
    const pendingBox = qs("#interestPendingBox");
    const pendingBreakdownEl = qs("#interestPendingBreakdown");

    const interestClaimResultModal = qs("#interestClaimResultModal");
    const interestClaimResultBackdrop = qs("#interestClaimResultBackdrop");
    const interestClaimResultBadge = qs("#interestClaimResultBadge");
    const interestClaimResultTitle = qs("#interestClaimResultTitle");
    const interestClaimResultSub = qs("#interestClaimResultSub");
    const interestClaimResultTotalLabel = qs("#interestClaimResultTotalLabel");
    const interestClaimResultTotal = qs("#interestClaimResultTotal");
    const interestClaimResultTotalMeta = qs("#interestClaimResultTotalMeta");
    const interestClaimResultCountLabel = qs("#interestClaimResultCountLabel");
    const interestClaimResultCount = qs("#interestClaimResultCount");
    const interestClaimResultCountMeta = qs("#interestClaimResultCountMeta");
    const interestClaimResultAssetLabel = qs("#interestClaimResultAssetLabel");
    const interestClaimResultAsset = qs("#interestClaimResultAsset");
    const interestClaimResultAssetMeta = qs("#interestClaimResultAssetMeta");
    const interestClaimResultClaimedAtLabel = qs("#interestClaimResultClaimedAtLabel");
    const interestClaimResultClaimedAt = qs("#interestClaimResultClaimedAt");
    const interestClaimResultClaimedAtMeta = qs("#interestClaimResultClaimedAtMeta");
    const interestClaimResultBreakdownTitle = qs("#interestClaimResultBreakdownTitle");
    const interestClaimResultBreakdown = qs("#interestClaimResultBreakdown");
    const interestClaimResultCloseBtn = qs("#interestClaimResultCloseBtn");

    const setDisabledStakeAction = (disabled) => {
      ["#stakeBtn", "#stakeMaxBtn", "#stakeAmount"].forEach((id) => {
        const el = qs(id);
        if (el) el.disabled = !!disabled;
      });
    };

    const setDisabledUnstakeAction = (disabled) => {
      ["#unstakeBtn", "#unstakeMaxBtn", "#unstakeAmount"].forEach((id) => {
        const el = qs(id);
        if (el) el.disabled = !!disabled;
      });
    };

    const setDisabledStakeControls = (disabled) => {
      setDisabledStakeAction(disabled);
      setDisabledUnstakeAction(disabled);
    };

    const setClaimButtonLabel = (count = 0) => {
      if (!claimBtn) return;
      claimBtn.textContent = Number(count || 0) >= 2 ? t('누적 이자 클레임') : t('이자 클레임');
    };

    const setDisabledClaimControl = (disabled) => {
      if (claimBtn) claimBtn.disabled = !!disabled;
    };

    setClaimButtonLabel(0);

    const clearHistory = (msg) => {
      if (pendingBreakdownEl) pendingBreakdownEl.textContent = msg || t("예상 이자 내역이 없습니다.");
      if (!histBody) return;
      histBody.innerHTML = `<tr><td colspan="5" class="center muted">${msg}</td></tr>`;
    };

    const parseDateSafe = (v) => {
      if (!v) return 0;
      const d = new Date(String(v).replace(' ', 'T') + (String(v).includes('Z') ? '' : 'Z'));
      const t = d.getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const buildRoundLabelMap = (rows) => {
      const map = new Map();
      const counts = {};
      [...(rows || [])]
        .slice()
        .sort((a, b) => (parseDateSafe(a?.created_at) - parseDateSafe(b?.created_at)) || (Number(a?.id || 0) - Number(b?.id || 0)))
        .forEach((row) => {
          const mk = String(row?.month_key || '-');
          counts[mk] = (counts[mk] || 0) + 1;
          map.set(Number(row?.id || 0), counts[mk] > 1 ? `${mk} ${countText(counts[mk], "회차")}` : mk);
        });
      return map;
    };

    const renderPendingBreakdown = (rows, ccy) => {
      if (!pendingBreakdownEl) return;
      if (!rows.length) {
        pendingBreakdownEl.textContent = t('예상 이자 내역이 없습니다.');
        return;
      }
      const labels = buildRoundLabelMap(rows);
      pendingBreakdownEl.innerHTML = rows.map((row) => {
        const id = Number(row?.id || 0);
        const label = labels.get(id) || String(row?.month_key || '-');
        const fx = Number(row?.fx_per_usdt || row?.fx_krw_per_usdt || 0);
        const when = fmtTime(row?.created_at || row?.claimed_at || '');
        return `<div><strong>${label}</strong> · ${fmtNum(row?.amount_local || 0, 4)} ${ccy} → ${fmtNum(row?.amount_usdt || 0, 1)} USDT <span class="small-note">(환율 ${fmtNum(fx, 2)} · ${when})</span></div>`;
      }).join('');
    };

    const renderInterestHistory = (rows, ccy) => {
      if (!histBody) return;
      if (!rows.length) {
        histBody.innerHTML = `<tr><td colspan="5" class="center muted">${t("내역이 없습니다.")}</td></tr>`;
        return;
      }
      const labels = buildRoundLabelMap(rows);
      histBody.innerHTML = rows.map((row) => {
        const id = Number(row?.id || 0);
        const label = labels.get(id) || String(row?.month_key || '-');
        const fx = Number(row?.fx_per_usdt || row?.fx_krw_per_usdt || 0);
        const claimed = !!row?.claimed_at;
        const stateText = claimed ? `${t("클레임 완료")}<br><span class="small-note">${fmtTime(row?.claimed_at)}</span>` : `${t("미클레임")}<br><span class="small-note">${fmtTime(row?.created_at)}</span>`;
        return `<tr>
          <td>${label}</td>
          <td class="right">${fmtNum(row?.amount_local || 0, 4)} ${ccy}</td>
          <td class="right">${fx > 0 ? `${fmtNum(fx, 2)} ${ccy}` : '-'}</td>
          <td class="right">${fmtNum(row?.amount_usdt || 0, 1)} USDT</td>
          <td class="right">${stateText}</td>
        </tr>`;
      }).join('');
    };

    // ---------- Config helpers ----------
    const getConfig = async () => {
      if (typeof C.getConfig === "function") return await C.getConfig();
      return await C.api("/api/public/config", { auth: false });
    };

    const getKSTPartsFromDate = (date) => {
      const shifted = new Date((date instanceof Date ? date.getTime() : Date.now()) + KST_OFFSET_MS);
      return {
        y: shifted.getUTCFullYear(),
        mo: shifted.getUTCMonth() + 1,
        d: shifted.getUTCDate(),
        h: shifted.getUTCHours(),
        mi: shifted.getUTCMinutes(),
        s: shifted.getUTCSeconds(),
      };
    };

    const getKSTParts = () => {
      const { y, mo, d } = getKSTPartsFromDate(new Date());
      return { y, mo, d };
    };

    const makeKSTDate = (y, mo, d, h = 0, mi = 0, s = 0) => new Date(Date.UTC(y, mo - 1, d, h - 9, mi, s));

    const localeForLang = () => ({ ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN" }[getLang()] || "ko-KR");

    const formatUnlockAt = (date) => {
      if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "-";
      return `${date.toLocaleString(localeForLang(), {
        timeZone: "Asia/Seoul",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23",
      })} KST`;
    };

    const nextSettlementUnlockAt = (lockDays) => {
      const current = getKSTPartsFromDate(new Date());
      let candidate = makeKSTDate(current.y, current.mo, current.d + 1, 0, 0, 0);
      for (let i = 0; i < 40; i += 1) {
        const parts = getKSTPartsFromDate(candidate);
        if (!(lockDays || []).includes(parts.d)) return candidate;
        candidate = new Date(candidate.getTime() + DAY_MS);
      }
      return candidate;
    };

    const lockWindowKey = (lockDays) => {
      const { y, mo } = getKSTParts();
      return `${y}-${String(mo).padStart(2, "0")}:${(lockDays || []).join(",")}`;
    };

    const monthKeyKST = () => {
      const { y, mo } = getKSTParts();
      return `${y}-${String(mo).padStart(2, "0")}`;
    };

    const normalizePayday = (n) => {
      const x = Number(n);
      return Number.isFinite(x) && x >= 1 && x <= 28 ? x : 15;
    };

    const normalizeLockDays = (arr, payday) => {
      const raw = Array.isArray(arr) ? arr.map(Number) : [];
      let lock = raw.filter((n) => Number.isFinite(n) && n >= 1 && n <= 31);

      const a = payday - 1;
      const b = payday;
      const c = payday + 1;
      if (a >= 1 && !lock.includes(a)) lock.push(a);
      if (!lock.includes(b)) lock.push(b);
      if (c <= 31 && !lock.includes(c)) lock.push(c);

      lock = Array.from(new Set(lock)).sort((x, y) => x - y);
      return lock;
    };

    const fmtDaysLabel = (days) => {
      const d = (days || []).slice().sort((a, b) => a - b);
      if (!d.length) return "-";
      if (d.length === 1) return `${d[0]}일`;
      const consecutive = d.every((value, index) => index === 0 || value === d[index - 1] + 1);
      if (consecutive) return `${d[0]}~${d[d.length - 1]}일`;
      return `${d.join(",")}일`;
    };

    const localizeDaysLabel = (rawValue) => {
      const raw = String(rawValue || "").trim();
      const lang = getLang();
      if (!raw || lang === "ko") return raw;
      let m = raw.match(/^(\d+)~(\d+)일$/);
      if (m) {
        if (lang === "en") return `${m[1]}-${m[2]}`;
        if (lang === "ja") return `${m[1]}〜${m[2]}日`;
        if (lang === "zh") return `${m[1]}-${m[2]}日`;
      }
      m = raw.match(/^(\d+(?:\s*,\s*\d+)+)일$/);
      if (m) {
        const parts = String(m[1]).split(/\s*,\s*/).filter(Boolean);
        if (lang === "en") return parts.join(", ");
        if (lang === "ja") return `${parts.join("・")}日`;
        if (lang === "zh") return `${parts.join("、")}日`;
      }
      m = raw.match(/^(\d+)일$/);
      if (m) {
        if (lang === "en") return String(m[1]);
        if (lang === "ja" || lang === "zh") return `${m[1]}日`;
      }
      return raw;
    };

    const nextPayday = (payday) => {
      const { y, mo, d } = getKSTParts();
      const cur = new Date(Date.UTC(y, mo - 1, d));
      let next = new Date(Date.UTC(y, mo - 1, payday));
      if (cur > next) next = new Date(Date.UTC(y, mo, payday));
      return next;
    };

    const isSettlementLock = (lockDays) => {
      const { d } = getKSTParts();
      return (lockDays || []).includes(d);
    };

    const isInterestOpenToday = (payday) => {
      const { d } = getKSTParts();
      return d === payday;
    };

    const getFxForCurrency = async (cfg, ccy) => {
      const fxRates = cfg?.fx_rates || {};
      const k = String(ccy || "KRW").toUpperCase();
      const fx = Number(fxRates?.[k] || 0);
      return Number.isFinite(fx) && fx > 0 ? fx : 0;
    };

    // ---------- Data loaders ----------
    const loadAssets = async () => {
      const r = await C.api("/api/assets", { auth: false });
      return (r.assets || []).map((a) => ({ ...a, status: normalizeStatusForUi(a) }));
    };

    const loadPortfolio = async () => {
      return await C.api("/api/portfolio", { method: "GET", auth: true });
    };

    const loadInterestHistory = async (assetId) => {
      const r = await C.api(`/api/interest/history?assetId=${encodeURIComponent(assetId)}`, { auth: true });
      return r.rows || [];
    };

    // ---------- interest math ----------
    const payoutTrunc1 = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return 0;
      return Math.floor((x + 1e-9) * 10) / 10;
    };

    const calcMonthly = (stakedToken, aprPct, fundingFx, payoutFx, settlementBasis) => {
      const st = Number(stakedToken);
      const apr = Number(aprPct);
      const ff = Number(fundingFx);
      const pf = Number(payoutFx);
      const ccy = String(settlementBasis || 'KRW').toUpperCase();
      if (!(st > 0) || !(apr > 0)) return { principalLocal: 0, localExact: 0, usdtRaw: 0, usdt1: 0 };
      const effectiveFundingFx = ccy === 'USDT' ? 1 : ff;
      const effectivePayoutFx = ccy === 'USDT' ? 1 : pf;
      if (!(effectiveFundingFx > 0) || !(effectivePayoutFx > 0)) return { principalLocal: 0, localExact: 0, usdtRaw: 0, usdt1: 0 };
      const principalLocal = ccy === 'USDT' ? st : (st * effectiveFundingFx);
      const localExact = principalLocal * (apr / 100) / 12;
      const usdtRaw = ccy === 'USDT' ? localExact : (localExact / effectivePayoutFx);
      const usdt1 = payoutTrunc1(usdtRaw);
      return { principalLocal, localExact, usdtRaw, usdt1 };
    };

    const setSettlementCopy = (lockLabel) => {
      const daysText = localizeDaysLabel(lockLabel);
      if (lockCountdownTitle) lockCountdownTitle.textContent = langText("재개까지 남은 시간", "Time until resume", "再開までの残り時間", "恢复倒计时");
      if (lockCountdownSub) {
        lockCountdownSub.textContent = langText(
          `정산 기간(${daysText})에는 스테이킹/언스테이킹이 제한됩니다.`,
          `Staking and unstaking are unavailable during the settlement period (${daysText}).`,
          `精算期間（${daysText}）はステーキング/アンステーキングが制限されます。`,
          `结算期间（${daysText}）质押/解除质押将受限。`
        );
      }
      if (lockResumeLabel) lockResumeLabel.textContent = langText("다시 가능 시점", "Resume at", "再開可能時刻", "恢复时间");
      if (lockModalResumeLabel) lockModalResumeLabel.textContent = langText("다시 가능 시점", "Resume at", "再開可能時刻", "恢复时间");
      if (lockModalBadge) {
        lockModalBadge.textContent = langText(
          `정산 기간 ${daysText}`,
          `Settlement ${daysText}`,
          `精算期間 ${daysText}`,
          `结算期间 ${daysText}`
        );
      }
      if (lockModalTitle) {
        lockModalTitle.textContent = langText(
          "스테이킹/언스테이킹이 일시 중단됩니다.",
          "Staking and unstaking are temporarily unavailable.",
          "ステーキング/アンステーキングは一時停止中です。",
          "质押/解除质押暂时不可用。"
        );
      }
      if (lockModalDesc) {
        lockModalDesc.textContent = langText(
          `매월 ${daysText}에는 정산이 진행되며, 이 기간에는 스테이킹과 언스테이킹을 할 수 없습니다.`,
          `Settlement runs every month on ${daysText}, and staking and unstaking are unavailable during this period.`,
          `毎月${daysText}は精算期間のため、この間はステーキングとアンステーキングはできません。`,
          `每月 ${daysText} 为结算期，在此期间无法进行质押和解除质押。`
        );
      }
      if (lockModalNote) {
        lockModalNote.textContent = langText(
          "현재 페이지는 조회만 가능하며, 버튼은 정산 기간 종료 시점까지 비활성화됩니다.",
          "This page remains view-only, and the action buttons stay disabled until settlement ends.",
          "このページは閲覧のみ可能で、ボタンは精算終了時点まで無効です。",
          "当前页面仅可查看，按钮会在结算结束前保持禁用。"
        );
      }
      if (lockModalClose) lockModalClose.textContent = langText("확인", "OK", "確認", "确定");

      const unitTexts = {
        days: langText("일", "Days", "日", "天"),
        hours: langText("시간", "Hours", "時間", "小时"),
        minutes: langText("분", "Min", "分", "分钟"),
        seconds: langText("초", "Sec", "秒", "秒"),
      };
      Object.entries(unitTexts).forEach(([key, value]) => {
        document.querySelectorAll(`[data-lock-unit="${key}"]`).forEach((el) => {
          el.textContent = value;
        });
      });
    };

    const setCountdownValue = (key, value) => {
      document.querySelectorAll(`[data-lock-count="${key}"]`).forEach((el) => {
        el.textContent = value;
      });
    };

    const setResumeAtValue = (value) => {
      document.querySelectorAll("[data-lock-resume-at]").forEach((el) => {
        el.textContent = value;
      });
    };

    const closeSettlementModal = () => {
      if (!lockModal) return;
      lockModal.classList.add("hidden");
      lockModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("stake-lock-modal-open");
    };

    const openSettlementModal = () => {
      if (!lockModal) return;
      lockModal.classList.remove("hidden");
      lockModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("stake-lock-modal-open");
    };

    const setClaimModalBodyLock = (locked) => {
      const body = document.body;
      if (!body) return;
      if (locked) {
        if (body.dataset.interestClaimPrevOverflow == null) body.dataset.interestClaimPrevOverflow = body.style.overflow || "";
        body.style.overflow = "hidden";
      } else {
        const prev = body.dataset.interestClaimPrevOverflow;
        if (prev != null) {
          body.style.overflow = prev;
          delete body.dataset.interestClaimPrevOverflow;
        } else {
          body.style.overflow = "";
        }
      }
    };

    const closeInterestClaimResultModal = () => {
      if (!interestClaimResultModal) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && interestClaimResultModal.contains(active)) {
        try { active.blur(); } catch {}
      }
      interestClaimResultModal.classList.add("hidden");
      interestClaimResultModal.setAttribute("aria-hidden", "true");
      try { interestClaimResultModal.setAttribute("inert", ""); } catch {}
      setClaimModalBodyLock(false);
      const prev = state.interestClaimModalRestoreEl;
      state.interestClaimModalRestoreEl = null;
      if (prev instanceof HTMLElement) {
        window.setTimeout(() => {
          try { prev.focus(); } catch {}
        }, 10);
      }
    };

    const openInterestClaimResultModal = ({ asset, rows, totalUsdt, ccy, claimedAt }) => {
      if (!interestClaimResultModal) return false;

      const safeRows = Array.isArray(rows) ? rows.slice() : [];
      const count = safeRows.length;
      const countLabel = countText(count || 0, "회차");
      const assetId = String(asset?.id || "-");
      const assetName = String(asset?.name || "");
      const assetLabel = assetName ? `${assetId} · ${assetName}` : assetId;
      const claimedLabel = fmtTime(claimedAt || '');

      if (interestClaimResultBadge) {
        interestClaimResultBadge.textContent = tt(
          "이자 수령 완료",
          "Interest received",
          "利息受取完了",
          "利息领取完成"
        );
      }
      if (interestClaimResultTitle) {
        interestClaimResultTitle.textContent = count >= 2
          ? tt(
              "누적 이자 수령이 완료되었습니다.",
              "Accumulated interest has been received.",
              "累積利息の受取が完了しました。",
              "累计利息领取已完成。"
            )
          : tt(
              "이자 수령이 완료되었습니다.",
              "Interest has been received.",
              "利息の受取が完了しました。",
              "利息领取已完成。"
            );
      }
      if (interestClaimResultSub) {
        interestClaimResultSub.textContent = count >= 2
          ? tt(
              `이번에 ${countLabel}의 이자를 한 번에 수령했습니다.`,
              `You received ${countLabel} of interest at once.`,
              `今回、${countLabel}の利息をまとめて受け取りました。`,
              `本次已一次性领取 ${countLabel} 的利息。`
            )
          : tt(
              "이번 이자 수령 금액과 산출 내역입니다.",
              "Here are the received amount and calculation details for this interest payout.",
              "今回の利息受取金額と算出内訳です。",
              "以下为本次利息领取金额及计算明细。"
            );
      }

      if (interestClaimResultTotalLabel) interestClaimResultTotalLabel.textContent = tt("총 수령액", "Total received", "受取合計", "领取总额");
      if (interestClaimResultTotal) interestClaimResultTotal.textContent = `${fmtNum(totalUsdt || 0, 1)} USDT`;
      if (interestClaimResultTotalMeta) interestClaimResultTotalMeta.textContent = tt("최종 계정 반영 금액", "Amount credited to your account", "口座に反映された金額", "已计入账户的金额");

      if (interestClaimResultCountLabel) interestClaimResultCountLabel.textContent = tt("누적 회차", "Claimed rounds", "受取回次", "领取期次");
      if (interestClaimResultCount) interestClaimResultCount.textContent = countLabel;
      if (interestClaimResultCountMeta) interestClaimResultCountMeta.textContent = tt("이번에 한 번에 수령한 이자입니다.", "Interest received in this batch.", "今回まとめて受け取った利息です。", "本次一并领取的利息。"
      );

      if (interestClaimResultAssetLabel) interestClaimResultAssetLabel.textContent = tt("자산", "Asset", "資産", "资产");
      if (interestClaimResultAsset) interestClaimResultAsset.textContent = assetLabel;
      if (interestClaimResultAssetMeta) interestClaimResultAssetMeta.textContent = tt("선택한 자산 기준", "Based on the selected asset", "選択した資産基準", "基于当前所选资产");

      if (interestClaimResultClaimedAtLabel) interestClaimResultClaimedAtLabel.textContent = tt("수령 시각", "Received at", "受取時刻", "领取时间");
      if (interestClaimResultClaimedAt) interestClaimResultClaimedAt.textContent = claimedLabel;
      if (interestClaimResultClaimedAtMeta) interestClaimResultClaimedAtMeta.textContent = tt("지갑 잔고에 즉시 반영되었습니다.", "It was credited to your wallet balance immediately.", "ウォレット残高へ即時反映されました。", "已即时计入钱包余额。"
      );

      if (interestClaimResultBreakdownTitle) interestClaimResultBreakdownTitle.textContent = tt("산출 내역", "Calculation details", "算出内訳", "计算明细");

      if (interestClaimResultBreakdown) {
        if (!safeRows.length) {
          interestClaimResultBreakdown.innerHTML = `<div class="interest-claim-item"><div class="interest-claim-item-line">${escapeHtml(tt("산출 내역을 확인할 수 없습니다.", "Calculation details are unavailable.", "算出内訳を確認できません。", "暂时无法查看计算明细。"))}</div></div>`;
        } else {
          const labels = buildRoundLabelMap(safeRows);
          interestClaimResultBreakdown.innerHTML = safeRows.map((row) => {
            const id = Number(row?.id || 0);
            const label = labels.get(id) || String(row?.month_key || "-");
            const fx = Number(row?.fx_per_usdt || row?.fx_krw_per_usdt || 0);
            const amountLocal = Number(row?.amount_local || 0);
            const amountUsdt = Number(row?.amount_usdt || 0);
            const when = fmtTime(row?.created_at || row?.claimed_at || claimedAt || '');
            const calcLine = (String(ccy || '').toUpperCase() === 'USDT' || !(fx > 0))
              ? `${fmtNum(amountLocal, 4)} ${escapeHtml(String(ccy || 'USDT').toUpperCase())} → ${fmtNum(amountUsdt, 1)} USDT`
              : `${fmtNum(amountLocal, 4)} ${escapeHtml(String(ccy || '').toUpperCase())} ÷ ${fmtNum(fx, 2)} = ${fmtNum(amountUsdt, 1)} USDT`;
            const metaLine = (fx > 0 && String(ccy || '').toUpperCase() !== 'USDT')
              ? tt(
                  `적용 환율 ${fmtNum(fx, 2)} · 배정 시각 ${when}`,
                  `Applied FX ${fmtNum(fx, 2)} · allocated at ${when}`,
                  `適用為替 ${fmtNum(fx, 2)} ・配分時刻 ${when}`,
                  `适用汇率 ${fmtNum(fx, 2)} · 分配时间 ${when}`
                )
              : tt(
                  `배정 시각 ${when}`,
                  `Allocated at ${when}`,
                  `配分時刻 ${when}`,
                  `分配时间 ${when}`
                );
            return `<div class="interest-claim-item">
              <div class="interest-claim-item-head">
                <strong>${escapeHtml(label)}</strong>
                <span>${fmtNum(amountUsdt, 1)} USDT</span>
              </div>
              <div class="interest-claim-item-line">${calcLine}</div>
              <div class="interest-claim-item-meta">${escapeHtml(metaLine)}</div>
            </div>`;
          }).join('');
        }
      }

      state.interestClaimModalRestoreEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      interestClaimResultModal.classList.remove("hidden");
      interestClaimResultModal.setAttribute("aria-hidden", "false");
      try { interestClaimResultModal.removeAttribute("inert"); } catch {}
      setClaimModalBodyLock(true);
      window.setTimeout(() => {
        try { interestClaimResultCloseBtn?.focus?.(); } catch {}
      }, 10);
      return true;
    };

    if (interestClaimResultModal && interestClaimResultModal.dataset.bound !== "1") {
      interestClaimResultModal.dataset.bound = "1";
      interestClaimResultBackdrop?.addEventListener("click", closeInterestClaimResultModal);
      interestClaimResultCloseBtn?.addEventListener("click", closeInterestClaimResultModal);
      interestClaimResultModal.addEventListener("click", (e) => {
        if (e.target === interestClaimResultModal) closeInterestClaimResultModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && interestClaimResultModal && !interestClaimResultModal.classList.contains("hidden")) {
          closeInterestClaimResultModal();
        }
      });
    }

    const stopSettlementCountdown = () => {
      if (state.lockCountdownTimer) {
        window.clearInterval(state.lockCountdownTimer);
        state.lockCountdownTimer = 0;
      }
      state.lockUnlockAt = null;
    };

    const updateSettlementCountdown = () => {
      const unlockAt = state.lockUnlockAt;
      if (!(unlockAt instanceof Date) || !Number.isFinite(unlockAt.getTime())) return;

      const remainingMs = Math.max(0, unlockAt.getTime() - Date.now());
      const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      const pad2 = (n) => String(Math.max(0, Number(n || 0))).padStart(2, "0");

      setCountdownValue("days", pad2(days));
      setCountdownValue("hours", pad2(hours));
      setCountdownValue("minutes", pad2(minutes));
      setCountdownValue("seconds", pad2(seconds));
      setResumeAtValue(formatUnlockAt(unlockAt));

      if (remainingMs <= 0) {
        stopSettlementCountdown();
        closeSettlementModal();
        updateUI({ rebuildSelect: false }).catch(() => {});
      }
    };

    const startSettlementCountdown = (unlockAt) => {
      stopSettlementCountdown();
      state.lockUnlockAt = unlockAt;
      updateSettlementCountdown();
      state.lockCountdownTimer = window.setInterval(updateSettlementCountdown, 1000);
    };

    const syncSettlementLockUi = ({ locked, lockDays, unlockAt, shouldOpenModal }) => {
      const lockLabel = fmtDaysLabel(lockDays);
      setSettlementCopy(lockLabel);

      if (!locked) {
        if (lockCountdownBox) lockCountdownBox.classList.add("hidden");
        setResumeAtValue("-");
        setCountdownValue("days", "00");
        setCountdownValue("hours", "00");
        setCountdownValue("minutes", "00");
        setCountdownValue("seconds", "00");
        stopSettlementCountdown();
        closeSettlementModal();
        return;
      }

      if (lockCountdownBox) lockCountdownBox.classList.remove("hidden");
      startSettlementCountdown(unlockAt);
      if (shouldOpenModal) openSettlementModal();
    };

    // ---------- state ----------
    const state = {
      allAssets: [],
      cfg: null,
      lockUnlockAt: null,
      lockCountdownTimer: 0,
      lockPopupShownForKey: "",
      interestClaimModalRestoreEl: null,
    };

    const getRelevantAssetIdsFromPortfolio = (pf) => {
      const ids = new Set();

      (pf?.funding || []).forEach((r) => {
        if (Number(r?.amount_usdt || 0) > 0 && r.asset_id) ids.add(String(r.asset_id));
      });

      (pf?.holdings || []).forEach((r) => {
        if (tokenAmount(r) > 0 && r.asset_id) ids.add(String(r.asset_id));
      });

      return ids;
    };

    const buildSelectableAssets = (allAssets, pf, walletConnected, forcedId) => {
      const assets = Array.isArray(allAssets) ? allAssets.slice() : [];
      const ownedOnly = !!ownedOnlyChk?.checked;
      let list = assets.filter((a) => DISPLAYABLE_STATUSES.has(String(a.status || "")));

      if (walletConnected && pf && ownedOnly) {
        const relevantIds = getRelevantAssetIdsFromPortfolio(pf);
        list = list.filter((a) => relevantIds.has(String(a.id)));
      }

      if (forcedId && !list.some((a) => String(a.id) === String(forcedId))) {
        const forced = assets.find((a) => String(a.id) === String(forcedId));
        if (forced) list.unshift(forced);
      }

      if (!list.length && !ownedOnly) list = assets.slice();
      return list.sort(compareAssets);
    };

    const renderAssetSelect = (list, keepId) => {
      if (!sel) return null;

      if (!Array.isArray(list) || !list.length) {
        sel.innerHTML = `<option value="">표시할 자산이 없습니다.</option>`;
        sel.disabled = true;
        return null;
      }

      sel.disabled = false;
      sel.innerHTML = list.map((a) => `<option value="${a.id}">${a.id} · ${a.name}</option>`).join("");

      const finalId =
        (keepId && list.some((a) => String(a.id) === String(keepId)) && keepId) ||
        list[0].id;

      sel.value = finalId;
      return list.find((a) => String(a.id) === String(finalId)) || null;
    };

    const renderNoAssetState = (msg) => {
      if (assetImg) assetImg.src = "assets/images/default-asset.svg";
      if (tokenImg) tokenImg.src = "assets/images/default-token.svg";
      if (assetName) assetName.textContent = msg || "표시할 자산이 없습니다.";
      if (assetLink) assetLink.href = "ir.html";
      if (aprEl) aprEl.textContent = "-";
      if (tokenMetaEl) tokenMetaEl.textContent = "-";
      if (settlementMetaEl) settlementMetaEl.textContent = "-";
      curEls.forEach((el) => { if (el) el.textContent = "-"; });

      if (balEl) balEl.textContent = "-";
      if (stakedEl) stakedEl.textContent = "-";

      if (interestStaked) interestStaked.textContent = "-";
      if (interestApr) interestApr.textContent = "-";
      if (interestEst) interestEst.textContent = "-";
      if (interestFxLine) interestFxLine.textContent = "-";
      if (interestFxHint) interestFxHint.textContent = "-";
      if (hintEl) hintEl.textContent = msg || "표시할 자산이 없습니다.";

      setDisabledStakeControls(true);
      setDisabledClaimControl(true);
      clearHistory(msg || "내역이 없습니다.");
    };

    const updateUI = async ({ rebuildSelect = false } = {}) => {
      const wallet = getWallet();
      const walletConnected = !!wallet?.connected;

      if (!state.cfg) {
        state.cfg = await getConfig().catch(() => null);
      }

      const payday = normalizePayday(state.cfg?.interest_pay_day ?? 15);
      const lockDays = normalizeLockDays(state.cfg?.settlement_lock_days, payday);
      const lockLabel = fmtDaysLabel(lockDays);

      if (lockDaysLabel) lockDaysLabel.textContent = localizeDaysLabel(lockLabel);
      if (lockDaysLabel2) lockDaysLabel2.textContent = localizeDaysLabel(lockLabel);

      const locked = isSettlementLock(lockDays);
      if (lockBadge) lockBadge.classList.toggle("hidden", !locked);

      const unlockAt = locked ? nextSettlementUnlockAt(lockDays) : null;
      const popupKey = locked ? lockWindowKey(lockDays) : "";
      const shouldOpenModal = !!locked && state.lockPopupShownForKey !== popupKey;
      syncSettlementLockUi({ locked, lockDays, unlockAt, shouldOpenModal });
      state.lockPopupShownForKey = popupKey;

      {
        const dPay = payday;
        const maxLockDay = (lockDays || []).reduce((max, value) => Math.max(max, Number(value) || 0), dPay);
        const resumeDay = maxLockDay >= 31 ? 1 : (maxLockDay + 1);
        const lockLabel = fmtDaysLabel(lockDays);
        if (rulesSummaryEl) {
          rulesSummaryEl.innerHTML = tt(
            `매월 <strong>${dPay}일</strong> 스테이킹 잔고 기준으로 이자가 계산되며, 정산통화 계산 중 절삭 없이 계산한 뒤 최종 <strong>USDT 소수 첫째 자리까지</strong> 계정에 반영됩니다.`,
            `Interest is calculated each month based on the staked balance on the <strong>${dPay}th</strong>. Settlement-currency calculations are kept untruncated, and only the final credited amount is reflected to the account in <strong>USDT to one decimal place</strong>.`,
            `毎月<strong>${dPay}日</strong>のステーキング残高を基準に利息が計算され、精算通貨ベースでは切り捨てずに計算した後、最終的に<strong>USDT小数第1位まで</strong>口座へ反映されます。`,
            `每月按<strong>${dPay}日</strong>的质押余额计算利息，结算货币的计算过程不截断，最终仅按<strong>USDT 保留 1 位小数</strong>记入账户。`
          );
        }
        if (rulesTextEl) {
          rulesTextEl.innerHTML = tt(
            `1. 투자원금은 모금 달성(또는 마감) 시점 환율로 확정됩니다.<br>` +
              `예: 2,000 USDT 투자 × 확정 환율 1,500 = 3,000,000 정산통화 기준 원금입니다.<br><br>` +
              `2. 월 이자는 확정 원금에 연이자율/12를 적용합니다.<br>` +
              `예: 연 8%면 월 이자 기준은 3,000,000 × 8% ÷ 12 입니다.<br><br>` +
              `3. 계산된 월 이자는 지급일(<strong>${dPay}일</strong>) 환율로 다시 USDT 환산해 확정합니다.<br>` +
              `4. 정산통화 기준 계산 과정에서는 절삭하지 않고, 최종 계정 반영 USDT만 <strong>소수 첫째 자리까지</strong> 반영합니다.<br>` +
              `5. 정산 기간(<strong>${lockLabel}</strong>)에는 스테이킹/언스테이킹이 제한되며, <strong>${resumeDay}일</strong>부터 다시 가능합니다.<br>` +
              `6. 자산이 <strong>매각</strong> 상태가 되면 신규 스테이킹과 이후 이자 배정이 중단되며, 지급 확정된 미수령 이자와 언스테이킹만 가능합니다.`,
            `1. The investment principal is fixed using the exchange rate at the time funding is completed (or closes).<br>` +
              `Example: 2,000 USDT investment × locked FX 1,500 = 3,000,000 in settlement-currency principal.<br><br>` +
              `2. Monthly interest is calculated by applying annual interest / 12 to the locked principal.<br>` +
              `Example: At 8% APR, the monthly interest basis is 3,000,000 × 8% ÷ 12.<br><br>` +
              `3. The calculated monthly interest is converted back into USDT using the payout-date FX on the <strong>${dPay}th</strong>.<br>` +
              `4. No truncation is applied during settlement-currency calculations, and only the final credited USDT is rounded to <strong>one decimal place</strong>.<br>` +
              `5. During the settlement period (<strong>${lockLabel}</strong>), staking and unstaking are restricted and become available again from the <strong>${resumeDay}th</strong>.<br>` +
              `6. Once an asset enters the <strong>Sale</strong> status, new staking and future interest allocation stop. Only confirmed but unclaimed interest and unstaking remain available.`,
            `1. 投資元本は、募金達成（または締切）時点の為替で確定します。<br>` +
              `例: 2,000 USDT投資 × 確定為替 1,500 = 精算通貨基準元本 3,000,000。<br><br>` +
              `2. 月利は確定元本に年利率/12を適用して計算します。<br>` +
              `例: 年利8%なら、月利基準は 3,000,000 × 8% ÷ 12 です。<br><br>` +
              `3. 計算された月利は支払日（<strong>${dPay}日</strong>）の為替で再びUSDT換算して確定します。<br>` +
              `4. 精算通貨基準の計算過程では切り捨てを行わず、最終口座反映USDTのみ<strong>小数第1位まで</strong>反映します。<br>` +
              `5. 精算期間（<strong>${lockLabel}</strong>）はステーキング/アンステーキングが制限され、<strong>${resumeDay}日</strong>から再び可能です。<br>` +
              `6. 資産が<strong>売却</strong>状態になると、新規ステーキングと今後の利息配分は停止され、支給確定済みの未受取利息とアンステーキングのみ可能です。`,
            `1. 投资本金会按募资达成（或截止）时的汇率锁定。<br>` +
              `示例：2,000 USDT 投资 × 锁定汇率 1,500 = 3,000,000 结算货币本金。<br><br>` +
              `2. 月利按锁定本金乘以年化利率 ÷ 12 计算。<br>` +
              `示例：年化 8% 时，月利基数为 3,000,000 × 8% ÷ 12。<br><br>` +
              `3. 计算出的月利会按支付日（<strong>${dPay}日</strong>）汇率重新折算为 USDT 并确认。<br>` +
              `4. 结算货币的计算过程不做截断，只有最终入账的 USDT 才会按<strong>保留 1 位小数</strong>处理。<br>` +
              `5. 在结算期间（<strong>${lockLabel}</strong>）内，质押/解除质押会受限，并于<strong>${resumeDay}日</strong>恢复。<br>` +
              `6. 当资产进入<strong>出售</strong>状态后，新的质押和后续利息分配将停止，仅可领取已确认但未领取的利息并解除质押。`
          );
        }
      }

      if (paydayLabelEl) paydayLabelEl.textContent = localizeDaysLabel(`${payday}일`);
      if (paydayEl) {
        const next = nextPayday(payday);
        paydayEl.textContent = next.toLocaleDateString("ko-KR", {
          month: "long",
          day: "numeric",
          timeZone: "Asia/Seoul",
        });
      }

      let pf = null;
      if (walletConnected) {
        try {
          pf = await loadPortfolio();
        } catch (e) {
          toast(e.message || "포트폴리오 로드 실패", "bad");
          renderNoAssetState("포트폴리오를 불러오지 못했습니다.");
          return;
        }
      }

      const forcedId = (typeof C.getParam === "function" ? C.getParam("id") : null) || sel.value || "";
      const selectable = buildSelectableAssets(state.allAssets, pf, walletConnected, forcedId);

      let currentAsset = null;
      if (rebuildSelect || !sel.value || !selectable.some((a) => String(a.id) === String(sel.value))) {
        currentAsset = renderAssetSelect(selectable, forcedId);
      } else {
        currentAsset = selectable.find((a) => String(a.id) === String(sel.value)) || null;
      }

      if (!currentAsset) {
        renderNoAssetState(walletConnected ? (ownedOnlyChk?.checked ? "보유 자산이 없습니다." : "보유 자산이 없습니다.") : "표시할 자산이 없습니다.");
        return;
      }

      const a = currentAsset;
      const ccy = String(a.settlement_basis || "KRW").toUpperCase();
      const tokenSymbol = String(a.id || "TOKEN").toUpperCase();
      if (tokenMetaEl) tokenMetaEl.textContent = tokenSymbol;
      if (settlementMetaEl) settlementMetaEl.textContent = ccy;
      curEls.forEach((el) => { if (el) el.textContent = tokenSymbol; });

      if (assetImg) { assetImg.onerror = () => { assetImg.onerror = null; assetImg.src = "assets/images/default-asset.svg"; }; assetImg.src = (C.assetImageUrl ? C.assetImageUrl(a.image_url) : absUrl(a.image_url)) || "assets/images/default-asset.svg"; }
      if (tokenImg) { tokenImg.onerror = () => { tokenImg.onerror = null; tokenImg.src = "assets/images/default-token.svg"; }; tokenImg.src = (C.tokenImageUrl ? C.tokenImageUrl(a.token_image_url) : absUrl(a.token_image_url)) || "assets/images/default-token.svg"; }
      if (assetName) assetName.textContent = `${a.id} · ${a.name}`;
      if (assetLink) assetLink.href = `ir.html?id=${encodeURIComponent(a.id)}`;
      if (aprEl) {
        const current = fmtPct(a.apr, 1);
        const pending = a.pending_apr_change;
        if (pending && pending.effective_from && Number(pending.apr) > 0) {
          aprEl.innerHTML = `${current} <span class="apr-pending" style="font-size:10px;color:#b45309;background:#fef3c7;padding:1px 5px;border-radius:4px;margin-left:2px" title="${window.RwaI18n?.translateString?.('다음 회차 적용 예정') || '다음 회차 적용 예정'}">→ ${fmtPct(pending.apr, 1)} (${pending.effective_from})</span>`;
        } else {
          aprEl.textContent = current;
        }
      }

      setDisabledStakeAction(locked);
      setDisabledUnstakeAction(locked);
      setDisabledClaimControl(true);

      if (!walletConnected) {
        if (stakeNotice) stakeNotice.textContent = "지갑을 연결하면 내 참여 자산 기준으로 스테이킹/이자 기능이 활성화됩니다.";
        if (balEl) balEl.textContent = "-";
        if (stakedEl) stakedEl.textContent = "-";
        if (interestStaked) interestStaked.textContent = "-";
        if (interestApr) {
          const current = fmtPct(a.apr, 1);
          const pending = a.pending_apr_change;
          if (pending && pending.effective_from && Number(pending.apr) > 0) {
            interestApr.innerHTML = `${current} <span class="apr-pending" style="font-size:10px;color:#b45309;background:#fef3c7;padding:1px 5px;border-radius:4px;margin-left:2px" title="${window.RwaI18n?.translateString?.('다음 회차 적용 예정') || '다음 회차 적용 예정'}">→ ${fmtPct(pending.apr, 1)} (${pending.effective_from})</span>`;
          } else {
            interestApr.textContent = current;
          }
        }
        if (interestEst) interestEst.textContent = "-";
        if (interestFxLine) interestFxLine.textContent = "-";
        if (interestFxHint) interestFxHint.textContent = "-";
        if (hintEl) hintEl.textContent = "지갑을 연결하면 이자 클레임이 활성화됩니다.";
        setClaimButtonLabel(0);
        clearHistory("지갑을 연결하세요.");
        return;
      }

      const row = (pf?.holdings || []).find((h) => String(h.asset_id) === String(a.id)) || { balance_token: 0, staked_token: 0 };
      const balanceToken = Number(row.balance_token || 0);
      const stakedToken = Number(row.staked_token || 0);

      if (balEl) balEl.textContent = `${fmtNum(balanceToken, 4)} ${tokenSymbol}`;
      if (stakedEl) stakedEl.textContent = `${fmtNum(stakedToken, 4)} ${tokenSymbol}`;

      if (interestStaked) interestStaked.textContent = `${fmtNum(stakedToken, 4)} ${tokenSymbol}`;
      if (interestApr) {
        const current = fmtPct(a.apr, 1);
        const pending = a.pending_apr_change;
        if (pending && pending.effective_from && Number(pending.apr) > 0) {
          interestApr.innerHTML = `${current} <span class="apr-pending" style="font-size:10px;color:#b45309;background:#fef3c7;padding:1px 5px;border-radius:4px;margin-left:2px" title="${window.RwaI18n?.translateString?.('다음 회차 적용 예정') || '다음 회차 적용 예정'}">→ ${fmtPct(pending.apr, 1)} (${pending.effective_from})</span>`;
        } else {
          interestApr.textContent = current;
        }
      }

      const payoutFx = await getFxForCurrency(state.cfg, ccy);
      const fundingFx = Number(a.fx_at_funding || 0) > 0 ? Number(a.fx_at_funding || 0) : (ccy === 'USDT' ? 1 : payoutFx);
      if (interestFxLine) interestFxLine.textContent = (payoutFx > 0) ? `확정환율 ${fmtRateSummary(fundingFx)} ${ccy} / 지급일환율 ${fmtRateSummary(payoutFx)} ${ccy}` : "-";
      if (interestFxHint) interestFxHint.textContent = `원금은 모금 확정 환율, 지급은 ${payday}일 환율 기준으로 USDT 환산됩니다.`;

      if (interestEst) {
        const { usdt1 } = calcMonthly(stakedToken, a.apr, fundingFx, payoutFx, ccy);
        interestEst.textContent = (usdt1 > 0) ? `${fmtNum(usdt1, 1)} USDT` : "-";
      }

      const statusText = String(a.status || "");
      const soldStatus = SOLD_STATUSES.has(statusText);
      const stakeableStatus = STAKEABLE_STATUSES.has(statusText);
      const claimableStatus = stakeableStatus || soldStatus;
      const relevantIds = getRelevantAssetIdsFromPortfolio(pf);
      const hasRelationship = relevantIds.has(String(a.id)) || tokenAmount(row) > 0;

      if (stakeNotice) {
        if (locked && soldStatus) {
          stakeNotice.innerHTML = tt(`현재 자산은 <strong>매각</strong> 상태이며, 정산 기간(<strong>${lockLabel}</strong>)에는 언스테이킹도 제한됩니다. 지급 확정된 미수령 이자 클레임만 가능합니다.`, `This asset is in <strong>Sale</strong> status, and unstaking is also restricted during the settlement period (<strong>${lockLabel}</strong>). Only confirmed but unclaimed interest can be claimed.`, `現在の資産は<strong>売却</strong>状態であり、精算期間（<strong>${lockLabel}</strong>）中はアンステーキングも制限されます。支給確定済みの未受取利息のみ請求できます。`, `当前资产处于<strong>出售</strong>状态，结算期间（<strong>${lockLabel}</strong>）内解除质押也受限制。仅可领取已确认但未领取的利息。`);
        } else if (locked) {
          stakeNotice.textContent = `정산 기간(${lockLabel})에는 스테이킹/언스테이킹이 제한됩니다.`;
        } else if (!hasRelationship && tokenAmount(row) <= 0) {
          stakeNotice.textContent = "";
        } else if (soldStatus) {
          // (2026-05-06) 매각 실행 시 staked_token 은 자동 언스테이킹되어 balance_token 으로 이동.
          // 안내: 더 이상 unstake 액션이 필요 없고, 매각 완료(매각(완료)) 시점에 정산 redeem 가능.
          stakeNotice.innerHTML = tt(
            `현재 자산은 <strong>매각</strong> 상태입니다. <strong>스테이킹은 자동으로 해제</strong>되었으며, 매각 정산이 준비되면 <a class="btn small" href="sale-detail.html?id=${encodeURIComponent(a.id)}">매각 정산</a> 에서 보유 토큰을 USDT 로 교환하실 수 있습니다. 지급 확정된 미수령 이자는 클레임 가능합니다.`,
            `This asset is in <strong>Sale</strong> status. <strong>Staking has been automatically released</strong>. Once settlement is ready, you can redeem your tokens for USDT on the <a class="btn small" href="sale-detail.html?id=${encodeURIComponent(a.id)}">Sale Settlement</a> page. Confirmed but unclaimed interest can still be claimed.`,
            `現在の資産は<strong>売却</strong>状態です。ステーキングは自動的に解除されました。精算が準備でき次第、保有トークンを USDT と交換できます。支給確定済みの未受取利息は請求できます。`,
            `当前资产处于<strong>出售</strong>状态。质押已自动解除。结算准备就绪后，您可以将持有代币兑换为 USDT。已确认但未领取的利息仍可领取。`
          );
        } else if (!stakeableStatus) {
          stakeNotice.innerHTML = `현재 단계에서는 스테이킹이 비활성화됩니다. (상태: <strong>${a.status}</strong>)`;
        } else if (balanceToken + stakedToken <= 0) {
          // Silica 자동 분배: 별도 claim 액션 없음 — 투자(자산 페이지) 또는 거래로 SilicaSTO 확보 안내.
          stakeNotice.innerHTML =
            `보유 자산이 없습니다. <a class="btn small" href="assets.html">투자</a> 또는 ` +
            `<a class="btn small" href="trade.html?id=${encodeURIComponent(a.id)}">거래</a>로 확보하세요.`;
        } else {
          stakeNotice.textContent = "보유에서 스테이킹으로 이동하거나, 언스테이킹이 가능합니다.";
        }
      }

      const canStakeNow = stakeableStatus && balanceToken > 0 && !locked;
      const canUnstakeNow = stakedToken > 0 && !locked;
      setDisabledStakeAction(!canStakeNow);
      setDisabledUnstakeAction(!canUnstakeNow);

      let history = [];
      try {
        history = await loadInterestHistory(a.id);
      } catch {
        history = [];
      }

      const pendingRows = history.filter((r) => !r?.claimed_at);
      const claimedRows = history.filter((r) => !!r?.claimed_at);
      setClaimButtonLabel(pendingRows.length);
      const pendingTotalUsdt = pendingRows.reduce((sum, r) => sum + Number(r?.amount_usdt || 0), 0);
      const claimedTotalUsdt = claimedRows.reduce((sum, r) => sum + Number(r?.amount_usdt || 0), 0);

      if (interestEst) {
        if (pendingTotalUsdt > 0) interestEst.textContent = `${fmtNum(pendingTotalUsdt, 1)} USDT`;
        else if (soldStatus) interestEst.textContent = "-";
        else {
          const { usdt1 } = calcMonthly(stakedToken, a.apr, fundingFx, payoutFx, ccy);
          interestEst.textContent = usdt1 > 0 ? `${fmtNum(usdt1, 1)} USDT` : '-';
        }
      }

      renderPendingBreakdown(pendingRows, ccy);
      renderInterestHistory(history, ccy);
      if (pendingBox) pendingBox.classList.toggle('hidden', false);

      const claimableNow = pendingRows.length > 0 && payoutFx > 0 && claimableStatus;
      setDisabledClaimControl(!claimableNow);

      if (hintEl) {
        if (soldStatus && pendingRows.length > 0) hintEl.textContent = tt(`${pendingRows.length}개 회차의 클레임 가능한 미수령 이자가 있습니다. 지금 한 번에 클레임할 수 있습니다.`, `${pendingRows.length} payout rounds of claimable unclaimed interest are available. You can claim them all at once now.`, `${pendingRows.length}回分の請求可能な未受取利息があります。今すぐまとめて請求できます。`, `当前有 ${pendingRows.length} 笔可领取的未领取利息，现在可以一次性领取。`);
        else if (soldStatus && locked) hintEl.textContent = tt(`현재 자산은 매각 상태이지만 정산 기간(${lockLabel})에는 언스테이킹도 제한됩니다. 지급 확정된 미수령 이자만 클레임 가능합니다.`, `This asset is in sale status, and unstaking is also restricted during the settlement period (${lockLabel}). Only confirmed but unclaimed interest can be claimed.`, `この資産は売却状態ですが、精算期間（${lockLabel}）中はアンステーキングも制限されます。支給確定済みの未受取利息のみ請求できます。`, `当前资产处于出售状态，且在结算期间（${lockLabel}）内解除质押也受限制。仅可领取已确认但未领取的利息。`);
        else if (soldStatus) hintEl.textContent = tt(`매각 상태에서는 신규 이자 배정이 중단됩니다. 지급 확정된 미수령 이자와 언스테이킹만 가능합니다.`, `In sale status, new interest allocation stops. Only confirmed but unclaimed interest and unstaking are available.`, `売却状態では新規の利息配分は停止されます。支給確定済みの未受取利息とアンステーキングのみ可能です。`, `在出售状态下，新的利息分配将停止。仅可领取已确认但未领取的利息并解除质押。`);
        else if (!stakeableStatus) hintEl.textContent = "현재 단계에서는 이자 클레임이 열리지 않습니다.";
        else if (payoutFx <= 0) hintEl.textContent = t("환율 설정이 필요합니다. (관리자 FX 설정)");
        else if (pendingRows.length > 0) hintEl.textContent = t(`${pendingRows.length}개 회차의 예상 이자가 있습니다. 지금 한 번에 클레임할 수 있습니다.`);
        else if (stakedToken <= 0) hintEl.textContent = t("스테이킹 잔고가 없습니다. 먼저 스테이킹하세요.");
        else if (claimedRows.length > 0) hintEl.textContent = `${t("누적 클레임 완료 이자")} ${fmtNum(claimedTotalUsdt, 1)} USDT / ${t("아직 배정되지 않은 상태입니다.")}`;
        else hintEl.textContent = t("아직 관리자가 이자를 배정하지 않았습니다. 다음 배정 후 예상 이자를 클레임할 수 있습니다.");
      }
    };

    // ---------- Load initial assets ----------
    state.allAssets = (await loadAssets().catch(() => [])).slice().sort(compareAssets);

    // ---------- Bindings ----------
    sel.addEventListener("change", async () => {
      await updateUI({ rebuildSelect: false });
    });
    ownedOnlyChk?.addEventListener("change", async () => {
      await updateUI({ rebuildSelect: true });
    });

    lockModalBackdrop?.addEventListener("click", closeSettlementModal);
    lockModalClose?.addEventListener("click", closeSettlementModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSettlementModal();
    });

    const bindWalletRefresh = () => {
      const btn = qs("#walletBtn");
      if (!btn) return;
      if (btn.dataset.stakingRefreshBound === "1") return;
      btn.dataset.stakingRefreshBound = "1";

      btn.addEventListener("click", () => {
        setTimeout(() => {
          updateUI({ rebuildSelect: true }).catch(() => {});
        }, 1200);
      });
    };

    stakeMaxBtn?.addEventListener("click", async () => {
      // (2026-06-17 v925) 미연결 시 공통 지갑연결 모달 (기존 toast 대체).
      if (!window.RwaCore.requireWalletConnected()) return;

      const a = state.allAssets.find((x) => String(x.id) === String(sel.value));
      if (!a) return;

      try {
        const pf = await loadPortfolio();
        const row = (pf.holdings || []).find((h) => String(h.asset_id) === String(a.id)) || { balance_token: 0 };
        if (stakeAmount) stakeAmount.value = String(Number(row.balance_token || 0));
      } catch (e) {
        toast(e.message || "최대 설정 실패", "bad");
      }
    });

    unstakeMaxBtn?.addEventListener("click", async () => {
      // (2026-06-17 v925) 미연결 시 공통 지갑연결 모달 (기존 toast 대체).
      if (!window.RwaCore.requireWalletConnected()) return;

      const a = state.allAssets.find((x) => String(x.id) === String(sel.value));
      if (!a) return;

      try {
        const pf = await loadPortfolio();
        const row = (pf.holdings || []).find((h) => String(h.asset_id) === String(a.id)) || { staked_token: 0 };
        if (unstakeAmount) unstakeAmount.value = String(Number(row.staked_token || 0));
      } catch (e) {
        toast(e.message || "최대 설정 실패", "bad");
      }
    });

    stakeBtn?.addEventListener("click", async () => {
      const cfg = await getConfig().catch(() => null);
      const payday = normalizePayday(cfg?.interest_pay_day ?? 15);
      const lockDays = normalizeLockDays(cfg?.settlement_lock_days, payday);
      if (isSettlementLock(lockDays)) return toast(t(`정산 기간(${fmtDaysLabel(lockDays)})에는 제한됩니다.`));

      // (2026-06-17 v925) 미연결 시 공통 지갑연결 모달 (기존 toast 대체).
      if (!window.RwaCore.requireWalletConnected()) return;

      const a = state.allAssets.find((x) => String(x.id) === String(sel.value));
      if (!a) return;

      const qty = Number(String(stakeAmount?.value || "").replace(/,/g, "").trim());
      if (!Number.isFinite(qty) || qty <= 0) return toast("수량을 입력하세요.");

      try {
        await C.api("/api/staking/stake", { method: "POST", auth: true, body: { assetId: a.id, amount: qty } });
        if (stakeAmount) stakeAmount.value = "";
        toast("스테이킹이 완료되었습니다.", "good");
        await updateUI({ rebuildSelect: true });
      } catch (e) {
        toast(e.message || "스테이킹 실패", "bad");
      }
    });

    unstakeBtn?.addEventListener("click", async () => {
      const cfg = await getConfig().catch(() => null);
      const payday = normalizePayday(cfg?.interest_pay_day ?? 15);
      const lockDays = normalizeLockDays(cfg?.settlement_lock_days, payday);
      // (2026-06-17 v925) 미연결 시 공통 지갑연결 모달 (기존 toast 대체).
      if (!window.RwaCore.requireWalletConnected()) return;

      const a = state.allAssets.find((x) => String(x.id) === String(sel.value));
      if (!a) return;

      if (isSettlementLock(lockDays)) return toast(t(`정산 기간(${fmtDaysLabel(lockDays)})에는 제한됩니다.`));

      const qty = Number(String(unstakeAmount?.value || "").replace(/,/g, "").trim());
      if (!Number.isFinite(qty) || qty <= 0) return toast("수량을 입력하세요.");

      try {
        await C.api("/api/staking/unstake", { method: "POST", auth: true, body: { assetId: a.id, amount: qty } });
        if (unstakeAmount) unstakeAmount.value = "";
        toast("언스테이킹이 완료되었습니다.", "good");
        await updateUI({ rebuildSelect: true });
      } catch (e) {
        toast(e.message || "언스테이킹 실패", "bad");
      }
    });

    claimBtn?.addEventListener("click", async () => {
      // (2026-06-17 v925) 미연결 시 공통 지갑연결 모달 (기존 toast 대체).
      if (!window.RwaCore.requireWalletConnected()) return;

      const a = state.allAssets.find((x) => String(x.id) === String(sel.value));
      if (!a) return;

      try {
        const r = await C.api("/api/interest/claim", { method: "POST", auth: true, body: { assetId: a.id } });
        const count = Number(r?.claimed_count || 0);
        const amt = Number(r?.amount_usdt || 0);
        const ccy = String(a?.settlement_basis || "KRW").toUpperCase();
        const rows = Array.isArray(r?.rows) && r.rows.length
          ? r.rows
          : [{
              month_key: monthKeyKST(),
              amount_local: Number(r?.amount_local || 0),
              amount_usdt: amt,
              fx_per_usdt: await getFxForCurrency(state.cfg || await getConfig().catch(() => null), ccy),
              created_at: r?.claimed_at || '',
              claimed_at: r?.claimed_at || '',
            }];
        await updateUI({ rebuildSelect: true });
        const opened = openInterestClaimResultModal({
          asset: a,
          rows,
          totalUsdt: amt,
          ccy,
          claimedAt: r?.claimed_at || '',
        });
        if (!opened) {
          toast(`${count || 0}개 회차를 일괄 클레임했습니다. (${fmtNum(amt, 1)} USDT)`, "good");
        }
      } catch (e) {
        toast(e.message || "이자 클레임 실패", "bad");
      }
    });

    bindWalletRefresh();
    await updateUI({ rebuildSelect: true });
  };
})();