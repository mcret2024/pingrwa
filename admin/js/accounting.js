(() => {
  "use strict";

  const { qs, toast, api, bootAdminPage } = window.AdminCore;

  const fmt = (n, d = 0) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const esc = (s) => String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  // USDT 값을 정수로 반올림하여 HTML로 표기 (단위만 작게)
  const usdtHtml = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    const s = Math.round(x).toLocaleString("en-US");
    return `${esc(s)} <span class="unit">USDT</span>`;
  };
  // (2026-05-11 v263) Decimal variant — operator: '거래수수료 수익 표기
  //   가 정확하지 않다. 소수점 3자리까지.' The default usdtHtml rounds
  //   to integer, which buries small fees (0.5% × small trade can be
  //   below 1 USDT). Backend returns 6-decimal precision via clamp6();
  //   this helper preserves 3 of them for display while keeping the
  //   thousands separator + dimmed-decimal styling consistent.
  const usdtHtmlDp = (n, d = 3) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    const s = x.toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
    const [intPart, decPart] = s.split(".");
    const numHtml = decPart
      ? `${esc(intPart)}<span class="dec">.${esc(decPart)}</span>`
      : esc(intPart);
    return `${numHtml} <span class="unit">USDT</span>`;
  };

  const setText = (selector, value) => {
    const el = qs(selector);
    if (el) el.textContent = value;
  };
  const setUsdt = (selector, n) => {
    const el = qs(selector);
    if (el) el.innerHTML = usdtHtml(n);
  };
  const setUsdtDp = (selector, n, d = 3) => {
    const el = qs(selector);
    if (el) el.innerHTML = usdtHtmlDp(n, d);
  };
  const monthText = (key) => key || "-";
  const dateText = (date) => date || "-";

  const renderSummary = (s) => {
    setText("#acctUserCount", fmt(s.user_count, 0));
    setUsdt("#acctTotalUserUsdt", s.total_user_usdt);
    setUsdt("#acctFundingUsed", s.funding_used_usdt);
    setUsdt("#acctPendingDeposits", s.pending_deposits_usdt);
    setUsdt("#acctCumulativeInterest", s.cumulative_interest_usdt);
    setUsdt("#acctPreviousMonthInterest", s.previous_month_interest_usdt);
    setUsdt("#acctCurrentMonthInterest", s.current_month_interest_usdt);
    setUsdt("#acctNextProjectedInterest", s.next_month_projected_interest_usdt);
    setUsdt("#acctPendingWithdrawals", s.pending_withdrawals_usdt);
    // (2026-05-20 v680) 토큰 출금 대기 — SilicaSTO / Silica 분리.
    //   숫자만 표시하는 헬퍼 (USDT suffix 없이). 자산명은 stat-title 에 표기됨.
    const tokFmt = (n) => {
      const v = Number(n || 0);
      return Number.isFinite(v)
        ? v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })
        : '-';
    };
    const tokens = s.pending_withdrawals_tokens || {};
    setText("#acctPendingWithdrawalsSto", tokFmt(tokens.silica_sto));
    setText("#acctPendingWithdrawalsSilica", tokFmt(tokens.silica));

    setText("#acctPreviousMonthLabel", `대상월 ${monthText(s.previous_month_key)} · 이자일 ${dateText(s.previous_interest_date)}`);
    setText("#acctCurrentMonthLabel", `대상월 ${monthText(s.current_month_key)} · 이자일 ${dateText(s.current_interest_date)}`);
    setText("#acctNextProjectedLabel", `대상월 ${monthText(s.next_month_key)} · 이자일 ${dateText(s.next_interest_date)}`);

    setUsdt("#acctWithdrawFeeCumulative", s.withdraw_fee_cumulative_usdt);
    setUsdt("#acctWithdrawFeePrevious", s.withdraw_fee_previous_month_usdt);
    setUsdt("#acctWithdrawFeeCurrent", s.withdraw_fee_current_month_usdt);
    setText("#acctWithdrawFeePreviousLabel", `기준월 ${monthText(s.previous_month_key)}`);
    setText("#acctWithdrawFeeCurrentLabel", `기준월 ${monthText(s.current_month_key)}`);

    // (2026-05-11 v263) Trade fee revenue shown to 3 decimals — operator
    //   request. Trade fees can be sub-USDT (e.g. 0.5% × 0.70 USDT trade
    //   = 0.0035 USDT, floored to the 0.001 MIN_TRADE_FEE_USDT). Rounding
    //   them to integer hid the number entirely as '0 USDT'.
    setUsdtDp("#acctTradeFeeCumulative", s.trade_fee_cumulative_usdt, 3);
    setUsdtDp("#acctTradeFeePrevious",   s.trade_fee_previous_month_usdt, 3);
    setUsdtDp("#acctTradeFeeCurrent",    s.trade_fee_current_month_usdt, 3);
    setText("#acctTradeFeePreviousLabel", `기준월 ${monthText(s.previous_month_key)}`);
    setText("#acctTradeFeeCurrentLabel", `기준월 ${monthText(s.current_month_key)}`);

    // (2026-05-11 v281) 운영자: 'notes 문구가 이해하기 어렵고 폰트가 크다.'
    //   전월/당월/다음달 dump 는 카드별 라벨(#acctPreviousMonthLabel 등)에
    //   이미 표기되므로 중복 제거. notes 본문만 그대로 렌더.
    setText("#acctSummaryMeta", String(s.notes || "").trim());
  };

  // 정수로 반올림해서 표시 (USDT/토큰 수량)
  const numInt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return Math.round(x).toLocaleString("en-US");
  };
  // 소수 포함 표시 (APR 등 백분율 전용)
  const numDec = (n, d = 2) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    const s = x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    const [intPart, decPart] = s.split(".");
    return decPart ? `${esc(intPart)}<span class="dec">.${esc(decPart)}</span>` : esc(intPart);
  };

  const renderAssets = (rows) => {
    const tb = qs("#acctAssetRows");
    if (!tb) return;
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="9" class="muted center">자산이 없습니다.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map((r) => `
      <tr>
        <td><strong>${esc(r.asset_id)}</strong><div class="small-note">${esc(r.asset_name || "")}</div></td>
        <td>${esc(r.status || "-")}</td>
        <td class="right mono">${numDec(r.apr, 2)}%</td>
        <td class="right mono">${fmt(r.staker_count, 0)}</td>
        <td class="right mono">${numInt(r.staked_total)}</td>
        <td class="right mono">${numInt(r.cumulative_interest_usdt)}</td>
        <td class="right mono">${numInt(r.previous_month_interest_usdt)}</td>
        <td class="right mono">${numInt(r.current_month_interest_usdt)}</td>
        <td class="right mono">${numInt(r.next_month_projected_interest_usdt)}</td>
      </tr>
    `).join("");
  };

  const loadData = async () => {
    const r = await api("/api/admin/accounting/summary", { method: "GET" });
    renderSummary(r.summary || {});
    renderAssets(Array.isArray(r.assets) ? r.assets : []);
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("accounting");
    if (!me) return;

    qs("#acctRefreshBtn")?.addEventListener("click", async () => {
      try {
        await loadData();
        toast("갱신 완료", "good");
      } catch (e) {
        toast(e.message || "불러오기 실패", "bad");
      }
    });

    try {
      await loadData();
    } catch (e) {
      toast(e.message || "불러오기 실패", "bad");
    }
  });
})();
