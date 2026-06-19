(() => {
  "use strict";

  const { qs, toast, api, bootAdminPage } = window.AdminCore;

  const fmt = (n, d = 6) => {
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
  const short = (s) => {
    s = String(s || "");
    if (s.length <= 18) return s;
    return `${s.slice(0, 8)}...${s.slice(-6)}`;
  };
  const fmtDate = (v) => {
    if (!v) return "-";
    const d = new Date(String(v).replace(" ", "T") + (String(v).includes("Z") ? "" : "Z"));
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(d);
  };

  let USERS = [];
  let SELECTED = "";

  const statusHtml = (u) => {
    const parts = [];
    if (Number(u?.is_suspended || 0) > 0) parts.push('<span class="status-chip bad">사용중지</span>');
    if (Number(u?.withdraw_suspended || 0) > 0) parts.push('<span class="status-chip warn">출금중지</span>');
    if (!parts.length) parts.push('<span class="status-chip good">정상</span>');
    return parts.join(" ");
  };

  // (2026-05-18 v579) KYC 4-state 칩 — 이름 옆 inline 표시.
  //   - approved   = 인증 (초록): kyc_yn='Y'
  //   - pending    = 진행중 (앰버): kyc_status in {pending, reviewing, in_progress, in_review}
  //   - rejected   = 실패 (빨강): kyc_status in {kyc_status_not_approved, mismatch_*, kyc_no_credits, rejected}
  //   - unverified = 미인증 (회색): 그 외
  const PENDING_KEYS = new Set(['pending', 'reviewing', 'in_progress', 'in_review']);
  const REJECT_KEYS = new Set(['rejected', 'kyc_status_not_approved', 'mismatch_name', 'mismatch_birth', 'kyc_no_credits']);
  const kycChipHtml = (u) => {
    const yn = String(u?.kyc_yn || 'N').toUpperCase();
    const ks = String(u?.kyc_status || '').toLowerCase();
    if (yn === 'Y') return '<span class="kyc-chip approved">✓ KYC 인증</span>';
    if (PENDING_KEYS.has(ks)) return '<span class="kyc-chip pending">⌛ KYC 진행중</span>';
    if (REJECT_KEYS.has(ks)) return '<span class="kyc-chip rejected">✕ KYC 실패</span>';
    return '<span class="kyc-chip unverified">○ KYC 미인증</span>';
  };

  const renderUsers = (rows) => {
    USERS = Array.isArray(rows) ? rows : [];
    const tb = qs("#usrRows");
    const summary = qs("#usrSummary");
    if (summary) summary.textContent = `총 ${USERS.length}명`;
    if (!tb) return;
    if (!USERS.length) {
      tb.innerHTML = '<tr><td colspan="5" class="muted center">유저가 없습니다.</td></tr>';
      return;
    }
    // (v654) 미체결주문 컬럼 제거 — 같은 값이 우측 '선택 유저 상세' 카드의
    // 미체결주문 셀(#usrOpenOrders)에 이미 표시되어 표가 5→4 컬럼으로 축소.
    // (2026-05-21 v721) 운영자 요청 — 유저 리스트의 USDT / 토큰 수량은 출금
    //   대기 중인 것을 포함해야 함. balances/holdings 에서 이미 차감된
    //   상태이므로 backend 의 pending_withdraw_*_amount 를 더해 합산 표시.
    //   pending > 0 이면 sub-line 으로 '대기 N 포함' 안내.
    tb.innerHTML = USERS.map((u) => {
      const pendingUsdt = Number(u.pending_withdraw_usdt_amount || 0);
      const pendingSto = Number(u.pending_withdraw_sto_amount || 0);
      // (2026-05-21 v736) Silica 컬럼 추가 — balance + pending 합산.
      const pendingSilica = Number(u.pending_withdraw_silica_amount || 0);
      const silicaBalance = Number(u.silica_balance_total || 0);
      const usdtTotal = Number(u.usdt || 0) + pendingUsdt;
      const tokenTotal = Number(u.token_total || 0) + pendingSto;
      const silicaTotal = silicaBalance + pendingSilica;
      const usdtSub = pendingUsdt > 0
        ? `<div class="small-note" style="color:#1e40af">대기 ${fmt(pendingUsdt, 4)}</div>`
        : "";
      const tokenSub = pendingSto > 0
        ? `<div class="small-note" style="color:#1e40af">대기 ${fmt(pendingSto, 4)}</div>`
        : "";
      const silicaSub = pendingSilica > 0
        ? `<div class="small-note" style="color:#1e40af">대기 ${fmt(pendingSilica, 4)}</div>`
        : "";
      return `
      <tr class="rowpick${SELECTED === u.address ? ' active' : ''}" data-address="${esc(u.address)}">
        <td>
          <div class="mono">${esc(short(u.address))}</div>
          <div class="small-note">${esc(u.name || '-')}${kycChipHtml(u)}</div>
        </td>
        <td class="right mono">${fmt(usdtTotal, 6)}${usdtSub}</td>
        <td class="right mono">${fmt(tokenTotal, 6)}${tokenSub}</td>
        <td class="right mono">${fmt(silicaTotal, 6)}${silicaSub}</td>
        <td>${statusHtml(u)}</td>
      </tr>
      `;
    }).join("");
    tb.querySelectorAll("tr.rowpick").forEach((tr) => {
      tr.addEventListener("click", async () => {
        SELECTED = String(tr.getAttribute("data-address") || "");
        renderUsers(USERS);
        await loadDetail(SELECTED);
      });
    });
  };

  const renderStatusBox = (r) => {
    const el = qs("#usrStatusBox");
    if (!el) return;
    const parts = [];
    if (Number(r?.is_suspended || 0) > 0) {
      parts.push(`<div>${statusHtml({ is_suspended: 1 })} <span class="small-note">${esc(r.suspended_reason || '사유 없음')}</span></div>`);
    }
    if (Number(r?.withdraw_suspended || 0) > 0) {
      parts.push(`<div style="margin-top:6px">${statusHtml({ withdraw_suspended: 1 })} <span class="small-note">${esc(r.withdraw_suspension_reason || '사유 없음')}</span></div>`);
    }
    if (!parts.length) parts.push(statusHtml({}));
    el.innerHTML = parts.join("");
  };

  const renderDetail = (r) => {
    qs("#usrHint").textContent = r?.address ? `${r.address}` : "목록에서 유저를 선택하세요.";
    // #usrAddress 셀 제거됨 (2026-05-05) — 주소는 #usrHint 한 곳에서만 노출.
    qs("#usrName").textContent = r?.name || "-";
    // (2026-05-21 v698) 운영자 요청: 선택 유저 상세 카드의 자산 수량 소수점
    //   6자리 → 4자리로 줄여 가독성 ↑. USDT / SilicaSTO / Silica / 보유 내역
    //   표의 모든 수량에 동일 적용.
    qs("#usrUsdtNow").textContent = r?.address ? `${fmt(r.usdt, 4)} USDT` : "-";
    qs("#usrStoBalance").textContent = r?.address ? `${fmt(r.silica_sto_balance, 4)} STO` : "-";
    qs("#usrStoStaked").textContent  = r?.address ? `${fmt(r.silica_sto_staked, 4)} STO` : "-";
    qs("#usrSilicaBalance").textContent = r?.address ? `${fmt(r.silica_balance, 4)} Silica` : "-";
    qs("#usrOpenOrders").textContent = r?.address ? String(r.open_orders ?? 0) : "-";
    qs("#usrPendingWithdraws").textContent = r?.address ? String(r.pending_withdrawals ?? 0) : "-";
    qs("#usrPendingTokenWithdraws").textContent = r?.address ? String(r.pending_token_withdrawals ?? 0) : "-";

    // (2026-05-21 v720) 출금 대기 amount 를 각 자산 카드내에 표시. 0 이면 숨김.
    const _pwUsdt   = Number(r?.pending_withdraw_amount_usdt   || 0);
    const _pwSto    = Number(r?.pending_withdraw_amount_sto    || 0);
    const _pwSilica = Number(r?.pending_withdraw_amount_silica || 0);
    const togglePendingLine = (lineId, valId, amount, decimals = 4) => {
      const line = qs("#" + lineId);
      const val = qs("#" + valId);
      if (!line || !val) return;
      if (amount > 0) {
        val.textContent = fmt(amount, decimals);
        line.style.display = "block";
      } else {
        line.style.display = "none";
      }
    };
    togglePendingLine("usrUsdtPendingLine", "usrUsdtPending", _pwUsdt);
    togglePendingLine("usrStoPendingLine", "usrStoPending", _pwSto);
    togglePendingLine("usrSilicaPendingLine", "usrSilicaPending", _pwSilica);

    // (v720) 출금 요청 카드 클릭 → popup detail. 데이터는 r.pending_withdraw_details.
    //   USDT 카드는 kind='usdt' 만, 토큰 카드는 kind='token' 만 필터.
    const details = Array.isArray(r?.pending_withdraw_details) ? r.pending_withdraw_details : [];
    const usdtCard = qs("#usrPendingWithdrawsCard");
    const tokCard = qs("#usrPendingTokenWithdrawsCard");
    if (usdtCard) usdtCard._pwDetails = details.filter(d => d.kind === "usdt");
    if (tokCard) tokCard._pwDetails = details.filter(d => d.kind === "token");

    qs("#usrKyc").textContent = r?.address ? String(r.kyc_yn || "N") : "-";
    qs("#usrCreatedAt").textContent = r?.address ? fmtDate(r.created_at) : "-";
    renderStatusBox(r || {});
    const tbody = qs("#usrHoldings");
    if (!tbody) return;
    const rows = Array.isArray(r?.holdings) ? r.holdings : [];
    tbody.innerHTML = rows.length ? rows.map((x) => `
      <tr>
        <td><strong>${esc(x.asset_id)}</strong><div class="small-note">${esc(x.name || '')}</div></td>
        <td class="right mono">${fmt(x.balance_token, 4)}</td>
        <td class="right mono">${fmt(x.staked_token, 4)}</td>
        <td class="right mono">${fmt(x.claimed_token, 4)}</td>
      </tr>
    `).join("") : '<tr><td colspan="4" class="muted center">보유 내역이 없습니다.</td></tr>';
  };

  const loadUsers = async () => {
    const q = String(qs("#usrSearch")?.value || "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", "200");
    const r = await api(`/api/admin/users/list?${params.toString()}`, { method: "GET" });
    renderUsers(r.users || []);
    if (SELECTED) {
      const found = (r.users || []).find((u) => String(u.address) === SELECTED);
      if (!found) {
        SELECTED = "";
        renderDetail(null);
      }
    }
    if (!SELECTED && (r.users || []).length) {
      SELECTED = String(r.users[0].address || "");
      renderUsers(r.users || []);
      await loadDetail(SELECTED);
    }
  };

  async function loadDetail(address) {
    if (!address) {
      renderDetail(null);
      runHoldingsDiag(null);
      return;
    }
    try {
      const r = await api(`/api/admin/users/balance?address=${encodeURIComponent(address)}`, { method: "GET" });
      renderDetail(r || null);
      runHoldingsDiag(address);
    } catch (e) {
      toast(e.message || "유저 상세 조회 실패", "bad");
    }
  }

  // (2026-05-06) Holdings 진단 도구 — 콘솔 paste 없이 버튼 한 번으로.
  // (2026-05-18 v544) 운영자: '무결성 복구 (비파괴) 버튼은 제거해줘'.
  //   reset 버튼 제거. 진단만 남김 — DRIFT 발생 시 화면에서 확인 가능하고,
  //   필요 시 DB 직접 조작이나 별도 절차로 복구.
  async function runHoldingsDiag(address) {
    const box = qs("#usrHoldingsDiagBox");
    if (!box) return;
    if (!address) {
      box.innerHTML = "유저를 선택하면 진단이 자동으로 실행됩니다.";
      return;
    }
    box.innerHTML = "<span class=\"muted\">진단 중…</span>";
    try {
      const r = await api(`/api/admin/holdings-diag?address=${encodeURIComponent(address)}`, { method: "GET" });
      const rows = Array.isArray(r?.rows) ? r.rows : [];
      if (rows.length === 0) {
        box.innerHTML = "<span class=\"muted\">holdings 행 없음.</span>";
        return;
      }
      // (2026-05-18 v540) DRIFT 검사식 단순화.
      //   v538 의 'silica_sto_balance === net_funded + swap_in' 검사는
      //   admin_deposit / admin_contracts / winddown 등 다른 inflow 경로를
      //   놓쳐 여전히 false positive 발생. 모든 inflow 를 합산하는 건
      //   fragile 하므로 schema invariant 만 검사하는 단순 모델로 회귀:
      //
      //   진짜 DRIFT 조건 (둘 중 하나):
      //     (1) status !== 'ok'           ← legacy/silica 미러 불일치
      //                                     (백엔드 SQL CASE 가 이미 판정)
      //     (2) claimed_token !== net_funded ← 회계 불일치
      //
      //   'silica_sto_balance' 의 절대량은 검사하지 않는다. balance 가
      //   funded 보다 클 수 있다 (swap/deposit/winddown). 단, legacy 미러와
      //   claimed 회계만 일치하면 무결성 OK.
      const isDrift = (row) => {
        const funded    = Number(row.confirmed_funded_usdt || 0);
        const refunded  = Number(row.refunded_usdt || 0);
        const netFunded = Math.max(0, funded - refunded);
        const claimed   = Number(row.claimed_token || 0);
        const status    = String(row.status || '').trim();
        return (status !== 'ok') || (claimed !== netFunded);
      };

      const lines = rows.map((row) => {
        const funded       = Number(row.confirmed_funded_usdt || 0);
        const refunded     = Number(row.refunded_usdt || 0);
        const netFunded    = Math.max(0, funded - refunded);
        const swapIn       = Number(row.swap_in_sto || 0);
        const claimed      = Number(row.claimed_token || 0);
        const balance      = Number(row.balance_token || 0);
        const staked       = Number(row.staked_token || 0);
        const silicaBal    = Number(row.silica_sto_balance || 0);
        const silicaStaked = Number(row.silica_sto_staked || 0);
        const drift = isDrift(row);
        const flag = drift
          ? '<span style="color:#dc2626;font-weight:700">⚠ DRIFT</span>'
          : '<span style="color:#16a34a;font-weight:700">✓ OK</span>';
        const swapInLine = swapIn > 0
          ? ` · <span class="muted">swap_in:</span> ${fmt(swapIn, 2)}`
          : '';
        const refundLine = refunded > 0
          ? ` · <span class="muted">refunded:</span> ${fmt(refunded, 2)}`
          : '';
        return `<div style="margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.03);border-radius:6px;line-height:1.6">
          <strong>${esc(row.asset_id)}</strong> ${flag} <span class="muted">(status: ${esc(row.status)})</span><br>
          <span class="muted">funded(truth):</span> ${fmt(funded, 2)}${refundLine}${swapInLine} ·
          <span class="muted">claimed:</span> ${fmt(claimed, 2)} ·
          <span class="muted">balance/staked:</span> ${fmt(balance, 2)} / ${fmt(staked, 2)} ·
          <span class="muted">silica balance/staked:</span> ${fmt(silicaBal, 2)} / ${fmt(silicaStaked, 2)}
        </div>`;
      });

      // (2026-05-21 v724) 진단 강화 — wallet_transactions 기반 expected balance
      //   vs actual 비교. v701 사례 같은 'phantom drift' 검출.
      let expectedSection = "";
      const ed = r?.expected_diag;
      if (ed && typeof ed === "object") {
        const renderAssetRow = (key, label) => {
          const a = ed[key];
          if (!a) return "";
          const status = String(a.status || "ok");
          const diff = Number(a.diff || 0);
          const actual = Number(a.actual || 0);
          const expected = Number(a.expected || 0);
          let chip, sub = "";
          if (status === "ok") {
            chip = '<span style="color:#16a34a;font-weight:700">✓ OK</span>';
          } else if (status === "EXTRA") {
            chip = '<span style="color:#dc2626;font-weight:700">⚠ EXTRA (+' + fmt(Math.abs(diff), 4) + ')</span>';
            sub = `<div class="small-note" style="color:#dc2626;margin-top:2px">실제가 기대값보다 ${fmt(Math.abs(diff), 4)} 더 많음 — phantom 입금 또는 비기록 credit 의심</div>`;
          } else if (status === "MISSING") {
            chip = '<span style="color:#dc2626;font-weight:700">⚠ MISSING (' + fmt(diff, 4) + ')</span>';
            sub = `<div class="small-note" style="color:#dc2626;margin-top:2px">실제가 기대값보다 ${fmt(Math.abs(diff), 4)} 더 적음 — v701 같은 비기록 차감 의심</div>`;
          }
          return `<div style="margin-top:6px;padding:8px 10px;background:rgba(0,0,0,0.03);border-radius:6px;line-height:1.6">
            <strong>${esc(label)}</strong> ${chip}<br>
            <span class="muted">actual:</span> ${fmt(actual, 4)} ·
            <span class="muted">expected (wallet_tx 합):</span> ${fmt(expected, 4)} ·
            <span class="muted">diff:</span> ${fmt(diff, 4)}
            ${sub}
          </div>`;
        };
        expectedSection = `<div style="margin-top:14px;padding:10px;border:1px dashed rgba(82,132,255,.35);border-radius:8px;background:rgba(82,132,255,.04)">
          <div style="font-weight:800;font-size:13px;color:#2446b8">▼ wallet_transactions 기반 expected balance 검증 (v724)</div>
          <div class="muted" style="font-size:11px;margin-top:2px">scanned ${Number(ed.tx_count||0)} tx. 일관된 schema 미러는 통과해도, 실제값 ≠ 기대값 이면 phantom drift.</div>
          ${renderAssetRow("usdt", "USDT")}
          ${renderAssetRow("sto", "SilicaSTO 총량 (idle + staked)")}
          ${renderAssetRow("silica", "Silica")}
          ${Array.isArray(ed.errors) && ed.errors.length ? `<div class="small-note" style="color:#dc2626;margin-top:6px">errors: ${esc(ed.errors.join(' | '))}</div>` : ""}
        </div>`;
      }

      box.innerHTML = lines.join("") + expectedSection;
    } catch (e) {
      box.innerHTML = `<span style="color:#dc2626">진단 실패: ${esc(e.message || e)}</span>`;
    }
  }

  const doControl = async (action) => {
    if (!SELECTED) return toast("유저를 선택하세요.", "bad");
    const reason = String(qs("#usrReason")?.value || "").trim();
    const r = await api("/api/admin/users/control", {
      method: "POST",
      body: { address: SELECTED, action, reason },
    });
    let msg = "저장 완료";
    if (action === "suspend") {
      // (2026-05-18 v556) pending 출금 자동 취소 카운트 포함.
      const usdtRefund = Number(r.refunded_usdt || 0);
      const tokenRefund = Number(r.refunded_token || 0);
      const wdCnt = Number(r.cancelled_usdt_withdrawals || 0);
      const twdCnt = Number(r.cancelled_token_withdrawals || 0);
      msg = `사용중지 완료 · 미체결주문 ${r.cancelled_orders || 0}건 취소 / 스테이킹 ${fmt(r.unstaked_token, 6)} 해제`;
      if (wdCnt > 0 || twdCnt > 0) {
        msg += ` / 출금신청 ${wdCnt + twdCnt}건 취소 (USDT ${fmt(usdtRefund, 2)} + 토큰 ${fmt(tokenRefund, 2)} 환불)`;
      }
    } else if (action === "unsuspend") {
      msg = "사용중지 해제 완료";
    } else if (action === "withdraw_suspend") {
      msg = "출금중지 완료";
    } else if (action === "withdraw_unsuspend") {
      msg = "출금중지 해제 완료";
    }
    toast(msg, "good");
    await loadUsers();
    await loadDetail(SELECTED);
  };

  // (2026-05-18 v570) KYC 동기화 감사. didit "검토중" 인데 우리는 'Y' 로
  //   잘못 승인된 케이스 일괄 정정.
  //   1) GET /api/admin/kyc/audit — mismatch 목록 받기 (DB 변경 없음)
  //   2) 각 행 [롤백] 버튼 → POST /api/admin/kyc/reset { address }
  //   3) 행 자체를 회색 처리 + 결과 텍스트 인플레이스 표시
  const runKycAudit = async () => {
    const modal = qs("#kycAuditModal");
    const statusEl = qs("#kycAuditStatus");
    const tbody = qs("#kycAuditRows");
    if (!modal || !tbody || !statusEl) return;

    modal.classList.add("show");
    statusEl.textContent = "didit 에 재조회 중... (인증완료 유저 수만큼 시간이 소요됩니다)";
    tbody.innerHTML = '<tr><td colspan="5" class="muted center" style="padding:20px">감사 실행 중...</td></tr>';

    try {
      const r = await api("/api/admin/kyc/audit", { method: "GET" });
      const mismatch = Array.isArray(r?.mismatch) ? r.mismatch : [];
      const errors = Array.isArray(r?.errors) ? r.errors : [];

      statusEl.textContent =
        `스캔 ${r?.scanned ?? 0}건 · 정상 ${r?.ok_count ?? 0}건 · ` +
        `불일치 ${mismatch.length}건 · 조회실패 ${errors.length}건`;

      if (!mismatch.length && !errors.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="center" style="padding:20px;color:#10B981;font-weight:700">모든 KYC 인증완료 유저가 didit 와 일치합니다 ✓</td></tr>';
        return;
      }

      const rowsHtml = mismatch.map((m) => `
        <tr data-addr="${esc(m.address)}">
          <td class="mono" style="font-size:11px">${esc(short(m.address))}</td>
          <td>${esc(m.kyc_extracted_name || '—')}</td>
          <td><span class="status-chip ${/APPROV/i.test(m.didit_status_overall) ? 'good' : /REVIEW/i.test(m.didit_status_overall) ? 'warn' : 'bad'}">${esc(m.didit_status_overall || '—')}</span></td>
          <td><span class="status-chip ${/APPROV/i.test(m.didit_idv_status) ? 'good' : /REVIEW/i.test(m.didit_idv_status) ? 'warn' : 'bad'}">${esc(m.didit_idv_status || '—')}</span></td>
          <td><button class="btn small" data-reset="${esc(m.address)}" type="button">롤백 → ${esc(m.recommended_action === 'reset_to_in_review' ? '검토중' : '미승인')}</button></td>
        </tr>
      `).join("");

      const errsHtml = errors.map((e) => `
        <tr style="opacity:0.6">
          <td class="mono" style="font-size:11px">${esc(short(e.address))}</td>
          <td colspan="3" class="muted">조회 실패: ${esc(e.error || '')}</td>
          <td>—</td>
        </tr>
      `).join("");

      tbody.innerHTML = rowsHtml + errsHtml;

      // 행별 롤백 버튼 hook
      tbody.querySelectorAll("button[data-reset]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const addr = btn.getAttribute("data-reset") || "";
          if (!addr) return;
          if (!confirm(`정말로 ${addr.slice(0, 8)}... 사용자의 KYC 를 롤백하시겠습니까?\n\n이 작업은 사용자의 kyc_yn 을 'N' 으로 되돌리고, didit 실제 상태로 동기화합니다.`)) return;
          btn.disabled = true;
          btn.textContent = "처리 중...";
          try {
            const res = await api("/api/admin/kyc/reset", {
              method: "POST",
              body: { address: addr, reason: "operator_didit_mismatch_v570" },
            });
            const tr = btn.closest("tr");
            if (tr) {
              tr.style.opacity = "0.5";
              tr.style.textDecoration = "line-through";
              btn.replaceWith(Object.assign(document.createElement("span"), {
                className: "status-chip good",
                textContent: `완료: kyc_status=${res?.new_kyc_status || '?'}`,
              }));
            }
            toast("롤백 완료", "ok");
          } catch (e) {
            btn.disabled = false;
            btn.textContent = "롤백 (재시도)";
            const status = e?.data?.status || e?.payload?.status || "";
            if (status === "didit_actually_approved") {
              toast("didit 가 이제 승인 상태 — 롤백 불필요", "warn");
            } else {
              toast(e?.message || "롤백 실패", "bad");
            }
          }
        });
      });
    } catch (e) {
      statusEl.textContent = "감사 실패: " + (e?.message || "알 수 없는 오류");
      tbody.innerHTML = '<tr><td colspan="5" class="center" style="padding:20px;color:#EF4444">감사 실행 실패. 콘솔 로그를 확인하세요.</td></tr>';
      console.error("[kyc audit] failed", e);
    }
  };

  const closeKycAuditModal = () => {
    const modal = qs("#kycAuditModal");
    if (modal) modal.classList.remove("show");
  };

  // (2026-05-21 v720) 출금 요청 detail 팝업 — 카드 클릭 시 표시.
  const fmtKstShort = (s) => {
    if (!s) return "-";
    try {
      const str = String(s).includes("T") ? String(s) : String(s).replace(" ", "T") + "Z";
      const d = new Date(str);
      if (isNaN(d)) return String(s);
      return d.toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
    } catch (_) { return String(s); }
  };
  const shortAddrFmt = (a) => {
    const s = String(a || "");
    if (s.length <= 16) return s;
    return s.slice(0, 6) + ".." + s.slice(-4);
  };
  const openPendingDetailModal = (titleSuffix, details) => {
    const modal = qs("#pendingWithdrawDetailModal");
    const title = qs("#pwdDetailTitle");
    const body = qs("#pwdDetailBody");
    if (!modal || !body) return;
    if (title) title.textContent = `출금 요청 상세 — ${titleSuffix}`;
    if (!Array.isArray(details) || details.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="muted center">대기/처리중 출금 요청이 없습니다.</td></tr>';
    } else {
      body.innerHTML = details.map((d) => `
        <tr>
          <td class="mono">#${esc(d.id)}</td>
          <td>${esc(d.kind === "usdt" ? "USDT" : "토큰")}</td>
          <td class="right mono">${fmt(Number(d.amount || 0), d.kind === "usdt" ? 4 : 4)} ${esc(d.asset || "")}</td>
          <td><span class="small-note" style="color:${String(d.status).toLowerCase() === "processing" ? "#2453c5" : "#9a6300"}">${esc(d.status || "-")}</span></td>
          <td class="mono small-note">${esc(shortAddrFmt(d.to_address))}</td>
          <td class="small-note">${esc(fmtKstShort(d.created_at))}</td>
        </tr>
      `).join("");
    }
    modal.style.display = "flex";
  };
  const closePendingDetailModal = () => {
    const modal = qs("#pendingWithdrawDetailModal");
    if (modal) modal.style.display = "none";
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("users");
    if (!me) return;
    qs("#usrRefreshBtn")?.addEventListener("click", loadUsers);

    // (v720) 출금 요청 카드 클릭 → 팝업
    qs("#usrPendingWithdrawsCard")?.addEventListener("click", () => {
      const card = qs("#usrPendingWithdrawsCard");
      const details = (card && card._pwDetails) || [];
      openPendingDetailModal("USDT", details);
    });
    qs("#usrPendingTokenWithdrawsCard")?.addEventListener("click", () => {
      const card = qs("#usrPendingTokenWithdrawsCard");
      const details = (card && card._pwDetails) || [];
      openPendingDetailModal("토큰 (SilicaSTO / Silica)", details);
    });
    qs("#pwdDetailClose")?.addEventListener("click", closePendingDetailModal);
    qs("#pwdDetailCloseBtn")?.addEventListener("click", closePendingDetailModal);
    qs("#pendingWithdrawDetailModal")?.addEventListener("click", (e) => {
      if (e.target === qs("#pendingWithdrawDetailModal")) closePendingDetailModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && qs("#pendingWithdrawDetailModal")?.style.display === "flex") {
        closePendingDetailModal();
      }
    });

    // (v570) KYC 동기화 감사 버튼 + 모달 닫기 hook
    qs("#kycAuditBtn")?.addEventListener("click", runKycAudit);
    qs("#kycAuditCloseBtn")?.addEventListener("click", closeKycAuditModal);
    qs("#kycAuditModal")?.querySelector(".suspend-confirm-backdrop")
      ?.addEventListener("click", closeKycAuditModal);

    // (2026-05-06) 검색창 — 타이핑 즉시 부분일치 검색 (300ms debounce 로 API 호출 빈도 제한).
    // 이전엔 Enter 만 트리거 → 1글자라도 들어가면 자동 필터되도록 변경.
    qs("#usrSearch")?.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") await loadUsers();
    });
    let _usrSearchDebounce = null;
    qs("#usrSearch")?.addEventListener("input", () => {
      clearTimeout(_usrSearchDebounce);
      _usrSearchDebounce = setTimeout(() => { loadUsers().catch(() => {}); }, 300);
    });
    // (2026-05-18 v550) 진단 강화 — 500 발생 시 e.message + e.payload 전체를
    //   콘솔에도 강제 출력. 운영자가 F12 콘솔에서 즉시 확인 가능 (토스트만 보면
    //   잘리는 경우 있음).
    const ctrlClick = (action) => async () => {
      try {
        await doControl(action);
      } catch (e) {
        console.error('[users/control] action=' + action + ' FAILED', {
          message: e?.message,
          status: e?.status,
          payload: e?.payload,
        });
        toast(e?.message || "실패", "bad");
      }
    };

    // (2026-05-18 v555) 사용중지 type-to-confirm 모달.
    //   운영자가 실수로 버튼 누르는 것을 방지 — 정확히 '사용중지' 문구를
    //   입력해야 실행 버튼 활성화. 다른 액션 (unsuspend / withdraw_*) 은
    //   파괴적이지 않거나 가역적이라 단순 클릭 유지.
    const suspendModal = qs("#suspendConfirmModal");
    const suspendInput = qs("#suspendConfirmInput");
    const suspendOk    = qs("#suspendConfirmOkBtn");
    const suspendHint  = qs("#suspendConfirmHint");
    const suspendAddr  = qs("#suspendConfirmAddr");

    const SUSPEND_WORD = "사용중지";

    const openSuspendModal = () => {
      if (!SELECTED) { toast("유저를 선택하세요.", "bad"); return; }
      if (!suspendModal) { ctrlClick("suspend")(); return; }
      if (suspendAddr) suspendAddr.textContent = SELECTED;
      if (suspendInput) {
        suspendInput.value = "";
        suspendInput.classList.remove("match");
      }
      if (suspendHint) {
        suspendHint.textContent = "텍스트가 정확히 일치해야 활성화됩니다.";
        suspendHint.classList.remove("ok");
      }
      if (suspendOk) suspendOk.disabled = true;
      suspendModal.classList.add("show");
      // focus 부여 — 키보드 흐름 친화적.
      setTimeout(() => suspendInput?.focus(), 50);
    };

    const closeSuspendModal = () => {
      suspendModal?.classList.remove("show");
    };

    suspendInput?.addEventListener("input", () => {
      const v = String(suspendInput.value || "").trim();
      const ok = v === SUSPEND_WORD;
      suspendInput.classList.toggle("match", ok);
      if (suspendOk) suspendOk.disabled = !ok;
      if (suspendHint) {
        if (ok) {
          suspendHint.textContent = "확인 — 위 버튼이 활성화되었습니다.";
          suspendHint.classList.add("ok");
        } else if (v === "") {
          suspendHint.textContent = "텍스트가 정확히 일치해야 활성화됩니다.";
          suspendHint.classList.remove("ok");
        } else {
          suspendHint.textContent = `입력값이 '${SUSPEND_WORD}' 와 일치하지 않습니다.`;
          suspendHint.classList.remove("ok");
        }
      }
    });

    suspendInput?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !suspendOk?.disabled) {
        ev.preventDefault();
        suspendOk?.click();
      }
      if (ev.key === "Escape") {
        closeSuspendModal();
      }
    });

    suspendOk?.addEventListener("click", async () => {
      if (suspendOk.disabled) return;
      suspendOk.disabled = true;
      try {
        await doControl("suspend");
      } catch (e) {
        console.error('[users/control] action=suspend FAILED', {
          message: e?.message, status: e?.status, payload: e?.payload,
        });
        toast(e?.message || "실패", "bad");
      } finally {
        closeSuspendModal();
      }
    });

    qs("#suspendConfirmCancelBtn")?.addEventListener("click", closeSuspendModal);
    suspendModal?.querySelector(".suspend-confirm-backdrop")
      ?.addEventListener("click", closeSuspendModal);

    qs("#usrSuspendBtn")?.addEventListener("click", openSuspendModal);
    qs("#usrUnsuspendBtn")?.addEventListener("click", ctrlClick("unsuspend"));
    qs("#usrWithdrawSuspendBtn")?.addEventListener("click", ctrlClick("withdraw_suspend"));
    qs("#usrWithdrawUnsuspendBtn")?.addEventListener("click", ctrlClick("withdraw_unsuspend"));

    // (2026-06-07 v875 → v876) KYC 강제 처리 — 버튼 클릭 시 prompt 으로 사유
    //   입력. #usrReason 의존 제거 (운영자 요청: 사유 입력은 버튼 클릭 후
    //   나오게). 사유 미입력/취소 시 진행 안 함. 3자 미만 시 차단.
    //   approve: didit 와 무관하게 강제 인증 완료 (kyc_yn='Y').
    //   revoke:  인증 강제 취소 (kyc_yn='N') — 출금/투자/거래 즉시 차단.
    const kycOverride = (action) => async () => {
      if (!SELECTED) { toast("유저를 선택하세요.", "bad"); return; }
      const label = action === "approve" ? "강제 KYC 인증완료" : "강제 KYC 취소";

      // 1) 사유 입력 prompt — 취소(null) 또는 빈 값이면 진행 안 함.
      const raw = window.prompt(
        `${label}\n\n지갑: ${SELECTED}\n\n사유를 입력하세요 (3자 이상, 감사 추적용):`,
        ""
      );
      if (raw === null) return; // 운영자가 Cancel 누름
      const reason = String(raw).trim();
      if (reason.length < 3) {
        toast("사유는 3자 이상이어야 합니다. (감사 추적용)", "bad");
        return;
      }

      // 2) 최종 확인 — 사유 함께 노출.
      const ok = window.confirm(
        `${label}\n\n지갑: ${SELECTED}\n사유: ${reason}\n\n계속하시겠습니까?`
      );
      if (!ok) return;

      try {
        await api("/api/admin/users/kyc-override", {
          method: "POST",
          body: { address: SELECTED, action, reason },
        });
        toast(`${label} 완료`, "good");
        await loadUsers();
        if (SELECTED) await loadDetail(SELECTED);
      } catch (e) {
        toast(e?.message || `${label} 실패`, "bad");
      }
    };
    qs("#usrKycForceApproveBtn")?.addEventListener("click", kycOverride("approve"));
    qs("#usrKycForceRevokeBtn")?.addEventListener("click", kycOverride("revoke"));

    // Holdings 진단 도구 (v544 복구 버튼 제거됨)
    qs("#usrHoldingsDiagBtn")?.addEventListener("click", () => { if (SELECTED) runHoldingsDiag(SELECTED); });

    await loadUsers();
  });
})();
