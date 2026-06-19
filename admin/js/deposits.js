// public/admin/js/deposits.js
(() => {
  "use strict";

  const { qs, qsa, toast, api, bootAdminPage, fmtNum } = window.AdminCore;

  /* ── helpers ────────────────────────────── */
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

  const toDateUtc = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s))
      return new Date(s.replace(" ", "T") + "Z");
    return new Date(s);
  };

  const fmtKst = (v) => {
    const d = toDateUtc(v);
    if (!d || isNaN(d)) return v ? String(v) : "-";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const g = (t) => parts.find((p) => p.type === t)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
  };

  /* ── state ──────────────────────────────── */
  let _checked = new Set(); // tx_id set
  let _noteSaveTimers = {};  // debounce timers for note saving
  const PAGE_ASSET_TYPE = String(document.body?.dataset?.assetType || 'all').trim().toLowerCase();

  /* ── UI updaters ───────────────────────── */

  const updateSummary = (counts) => {
    const c = counts || {};
    const el = (id, v) => { const e = qs("#" + id); if (e) e.textContent = v; };
    el("sumPending",  Number(c.pending  || 0));
    el("sumApproved", Number(c.approved || 0));
    el("sumRejected", Number(c.rejected || 0));
    el("sumTotal",    Number(c.total    || 0));
    const pa = Number(c.pending_amount || 0);
    el("sumPendingAmt", pa > 0 ? `${fmtNum(pa, 2)}` : "0");
  };

  const updateBatchBar = () => {
    const bar = qs("#batchBar");
    const cnt = qs("#batchCount");
    if (!bar) return;
    if (_checked.size > 0) {
      bar.classList.add("show");
      if (cnt) cnt.textContent = `${_checked.size}건 선택`;
    } else {
      bar.classList.remove("show");
    }
  };

  const setCheckboxStates = () => {
    qsa(".dep-row-cb").forEach((cb) => {
      cb.checked = _checked.has(String(cb.dataset.txId));
    });
    const all = qs("#depCheckAll");
    const pending = qsa(".dep-row-cb");
    if (all && pending.length) {
      all.checked = pending.length > 0 && pending.every((cb) => cb.checked);
    }
    updateBatchBar();
  };

  /* ── admin note save ───────────────────── */
  const saveNote = async (txId, note) => {
    try {
      await api("/api/admin/deposit/note", {
        method: "POST",
        body: { tx_id: txId, note: note },
      });
      // Show saved indicator
      const indicator = qs(`#noteSaved_${txId}`);
      if (indicator) {
        indicator.classList.add("show");
        setTimeout(() => indicator.classList.remove("show"), 1500);
      }
    } catch (e) {
      toast(`메모 저장 실패: ${e?.message || "오류"}`, "bad");
    }
  };

  const debouncedSaveNote = (txId, note) => {
    if (_noteSaveTimers[txId]) clearTimeout(_noteSaveTimers[txId]);
    _noteSaveTimers[txId] = setTimeout(() => saveNote(txId, note), 800);
  };


  const loadAssetOptions = async () => {
    const sel = qs('#depAsset');
    if (!sel) return;
    try {
      const r = await api('/api/assets', { method: 'GET' });
      const rows = Array.isArray(r?.assets) ? r.assets : [];
      const allowed = new Set(['분배중', '운영중', '매각']);
      const assets = rows.filter((a) => String(a?.token_mint_address || '').trim() && allowed.has(String(a?.status || '').trim()));
      const prev = String(sel.value || 'all');
      sel.innerHTML = `<option value="all">전체 토큰</option>` + assets.map((a) => `<option value="${esc(String(a.id))}">${esc(String(a.id))} · ${esc(String(a.name || a.id))}</option>`).join('');
      sel.value = assets.some((a) => String(a.id) === prev) ? prev : 'all';
    } catch (_) {
      sel.innerHTML = `<option value="all">전체 토큰</option>`;
    }
  };

  /* ── fetch & render ────────────────────── */
  const fetchList = async () => {
    const status = String(qs("#depStatus")?.value || "all").trim();
    const q = String(qs("#depQ")?.value || "").trim();
    const asset = String(qs('#depAsset')?.value || 'all').trim();

    const params = new URLSearchParams();
    if (PAGE_ASSET_TYPE && PAGE_ASSET_TYPE !== 'all') params.set('asset_type', PAGE_ASSET_TYPE);
    if (asset && asset !== 'all') params.set('asset', asset);
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    params.set("limit", "500");

    try {
      const r = await api(`/api/admin/deposits?${params.toString()}`, { method: "GET" });

      updateSummary(r.counts);

      const rows = Array.isArray(r.rows) ? r.rows : [];
      const tb = qs("#depRows");
      if (!tb) return;

      if (!rows.length) {
        tb.innerHTML = `<tr><td colspan="10" class="center muted">내역이 없습니다.</td></tr>`;
        _checked.clear();
        updateBatchBar();
        return;
      }

      // Purge checked items that are no longer pending
      const pendingIds = new Set(rows.filter(x => x.status === "대기").map(x => String(x.id)));
      for (const id of [..._checked]) {
        if (!pendingIds.has(id)) _checked.delete(id);
      }

      tb.innerHTML = rows.map((x) => {
        const isPending = x.status === "대기";
        const txid = x.txid ? String(x.txid) : "";
        const txCell = txid
          ? `<a class="mono" target="_blank" rel="noopener" href="https://solscan.io/tx/${encodeURIComponent(txid)}" style="color:var(--link);font-weight:900;text-decoration:none" title="${esc(txid)}">${esc(short(txid))}</a>`
          : "-";

        // Status badge
        let stHtml;
        if (isPending) stHtml = `<span class="st-pending">⏳ 승인대기</span>`;
        else if (x.status === "입금완료") stHtml = `<span class="st-approved">✓ 입금완료</span>`;
        else if (x.status === "실패") stHtml = `<span class="st-rejected">✕ 거절</span>`;
        else stHtml = esc(x.status);

        // Checkbox (only for pending)
        const cbHtml = isPending
          ? `<input type="checkbox" class="dep-row-cb" data-tx-id="${x.id}" ${_checked.has(String(x.id)) ? "checked" : ""}>`
          : "";

        // Action buttons (only for pending)
        const actHtml = isPending
          ? `<button class="btn small primary dep-approve-btn" data-tx-id="${x.id}" data-addr="${esc(short(x.address))}" data-amt="${x.amount}">승인</button>
             <button class="btn small danger dep-reject-btn" data-tx-id="${x.id}" data-addr="${esc(short(x.address))}" data-amt="${x.amount}" style="margin-left:4px">거절</button>`
          : `<span class="muted" style="font-size:12px">처리완료</span>`;

        const timeStr = fmtKst(x.created_at);
        const adminNote = String(x.admin_note || "");

        // Admin note — editable textarea
        const noteHtml = `
          <div style="position:relative">
            <textarea class="admin-note-input dep-note" data-tx-id="${x.id}" rows="2" placeholder="메모 입력...">${esc(adminNote)}</textarea>
            <span class="note-saved" id="noteSaved_${x.id}">저장됨</span>
          </div>`;

        return `
          <tr class="${isPending ? "row-pending" : ""}">
            <td class="cb-col">${cbHtml}</td>
            <td class="mono" style="font-size:12px">${esc(x.id)}</td>
            <td>${stHtml}</td>
            <td class="mono" style="font-size:12px" title="${esc(x.address)}">${esc(short(x.address))}</td>
            <td><span class="mono">${esc(String(x.asset || 'USDT'))}</span></td>
            <td class="right mono" style="font-weight:700">${Number(x.amount || 0).toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            <td style="font-size:12px">${txCell}</td>
            <td>${noteHtml}</td>
            <td class="mono timecol" style="font-size:12px">${esc(timeStr)}</td>
            <td style="white-space:nowrap">${actHtml}</td>
          </tr>
        `;
      }).join("");

      updateBatchBar();
    } catch (e) {
      toast(e?.message || "목록 조회 실패", "bad");
    }
  };

  /* ── approve / reject ──────────────────── */
  const approveOne = async (txId) => {
    // Grab the current note from the textarea if present
    const noteEl = qs(`.dep-note[data-tx-id="${txId}"]`);
    const adminNote = noteEl ? noteEl.value.trim() : "";

    try {
      const r = await api("/api/admin/deposit/approve", {
        method: "POST",
        body: { tx_id: txId, admin_note: adminNote },
      });
      toast(`#${txId} 승인 완료 (${fmtNum(r.amount, 2)} ${r.asset || 'USDT'})`, "good");
      _checked.delete(String(txId));
      await fetchList();
    } catch (e) {
      toast(`#${txId} 승인 실패: ${e?.message || "오류"}`, "bad");
    }
  };

  // (2026-05-07) 거절 사유 + 관리자 연락처 필수 입력 모달.
  //   기존 prompt() 한 번 호출 방식은 사유가 비어 있어도 통과되어 사용자가
  //   거절 사유를 알 길이 없었다. 백엔드 reject 엔드포인트도 동시에 4자 이상의
  //   reason / admin_contact 를 요구하도록 강화됨.
  const promptRejectDialog = () => new Promise((resolve) => {
    // 이미 열려 있으면 중복 생성 방지
    document.getElementById("depRejectModal")?.remove();

    // (2026-05-21 v733) 운영자 보고: 다크 테마 (#0f1117 배경 + 회색 텍스트) 가
    //   admin 전체 라이트 테마와 안 맞고 폰트 작아 가독성 저하. withdrawals /
    //   token-withdrawals 의 confirm 모달과 동일한 라이트 카드 + 14-15px 폰트로
    //   재구성. label 진한 검정, helper 회색, danger 강조 빨강.
    const wrap = document.createElement("div");
    wrap.id = "depRejectModal";
    wrap.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(6px);z-index:10020;display:flex;align-items:flex-start;justify-content:center;padding:14vh 16px 16px;font-family:'Space Grotesk',sans-serif";
    wrap.innerHTML = `
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;max-width:520px;width:100%;padding:24px 26px;color:#0f172a;box-shadow:0 20px 60px rgba(15,23,42,.30)">
        <div style="font-size:18px;font-weight:950;color:#0f172a;margin-bottom:8px">입금 거절</div>
        <div style="font-size:13px;color:#475569;margin-bottom:18px;line-height:1.55">
          사용자가 거절 사유를 확인하고 관리자에게 연락할 수 있도록 두 항목 모두 필수입니다.
        </div>

        <label style="display:block;font-size:13px;color:#0f172a;font-weight:700;margin-bottom:6px">거절 사유 <span style="color:#dc2626">*</span></label>
        <textarea id="rejReason" rows="3"
          placeholder="예: 송금 금액과 트랜잭션 금액이 일치하지 않습니다."
          style="width:100%;background:#ffffff;border:1px solid #cbd5e1;color:#0f172a;border-radius:8px;padding:12px;font-size:14px;line-height:1.5;resize:vertical;min-height:80px;font-family:inherit;box-sizing:border-box"></textarea>
        <div style="font-size:12px;color:#64748b;margin-top:4px">4 ~ 500자</div>

        <label style="display:block;font-size:13px;color:#0f172a;font-weight:700;margin:16px 0 6px">관리자 연락처 <span style="color:#dc2626">*</span></label>
        <input id="rejContact" type="text"
          placeholder="예: support@silicachain.com  /  Telegram: @silica_admin"
          style="width:100%;background:#ffffff;border:1px solid #cbd5e1;color:#0f172a;border-radius:8px;padding:12px;font-size:14px;line-height:1.5;font-family:inherit;box-sizing:border-box" />
        <div style="font-size:12px;color:#64748b;margin-top:4px">이메일 / Telegram / KakaoTalk 등 4 ~ 120자</div>

        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;color:#991b1b;font-size:13px;line-height:1.5;margin-top:16px">
          거절 시 신청 입금은 환불되며, 입력한 사유와 연락처가 사용자에게 표시됩니다.
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
          <button type="button" id="rejCancelBtn" class="btn">취소</button>
          <button type="button" id="rejConfirmBtn" class="btn small danger" style="background:#dc2626;color:#fff;border:none;padding:8px 18px;font-weight:700">거절 확정</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const close = (val) => { wrap.remove(); resolve(val); };
    wrap.querySelector("#rejCancelBtn").addEventListener("click", () => close(null));
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(null); });
    wrap.querySelector("#rejConfirmBtn").addEventListener("click", () => {
      const reason = String(wrap.querySelector("#rejReason").value || "").trim();
      const contact = String(wrap.querySelector("#rejContact").value || "").trim();
      if (reason.length < 4) { alert("거절 사유는 4자 이상 입력해 주세요."); return; }
      if (reason.length > 500) { alert("거절 사유는 500자 이하로 입력해 주세요."); return; }
      if (contact.length < 4) { alert("관리자 연락처는 4자 이상 입력해 주세요."); return; }
      if (contact.length > 120) { alert("관리자 연락처는 120자 이하로 입력해 주세요."); return; }
      close({ reason, contact });
    });
    setTimeout(() => wrap.querySelector("#rejReason")?.focus(), 50);
  });

  const rejectOne = async (txId) => {
    const result = await promptRejectDialog();
    if (!result) return; // cancelled

    try {
      await api("/api/admin/deposit/reject", {
        method: "POST",
        body: { tx_id: txId, reason: result.reason, admin_contact: result.contact },
      });
      toast(`#${txId} 거절 처리됨`, "good");
      _checked.delete(String(txId));
      await fetchList();
    } catch (e) {
      toast(`#${txId} 거절 실패: ${e?.message || "오류"}`, "bad");
    }
  };

  const batchApprove = async () => {
    const ids = [..._checked].map(Number).filter(n => n > 0);
    if (!ids.length) { toast("선택된 항목이 없습니다.", "bad"); return; }

    if (!confirm(`${ids.length}건을 일괄 승인하시겠습니까?`)) return;

    try {
      const r = await api("/api/admin/deposit/approve-batch", {
        method: "POST",
        body: { tx_ids: ids },
      });

      const results = r.results || [];
      const ok = results.filter(x => x.ok).length;
      const fail = results.filter(x => !x.ok).length;

      if (fail > 0) {
        const failMsgs = results.filter(x => !x.ok).map(x => `#${x.tx_id}: ${x.error}`).join("\n");
        toast(`${ok}건 승인, ${fail}건 실패`, fail > 0 ? "bad" : "good");
        console.warn("[batch approve failures]", failMsgs);
      } else {
        toast(`${ok}건 일괄 승인 완료`, "good");
      }

      _checked.clear();
      await fetchList();
    } catch (e) {
      toast(`일괄 승인 실패: ${e?.message || "오류"}`, "bad");
    }
  };

  /* ── event delegation ──────────────────── */
  const bindEvents = () => {
    // Refresh
    qs("#depRefreshBtn")?.addEventListener("click", fetchList);

    // Filter change
    qs("#depStatus")?.addEventListener("change", fetchList);
    qs('#depAsset')?.addEventListener('change', fetchList);
    qs("#depQ")?.addEventListener("keydown", (e) => { if (e.key === "Enter") fetchList(); });

    // Check all
    qs("#depCheckAll")?.addEventListener("change", (e) => {
      const checked = e.target.checked;
      qsa(".dep-row-cb").forEach((cb) => {
        const id = String(cb.dataset.txId);
        if (checked) _checked.add(id); else _checked.delete(id);
        cb.checked = checked;
      });
      updateBatchBar();
    });

    // Individual checkbox (delegated)
    qs("#depRows")?.addEventListener("change", (e) => {
      if (!e.target.classList.contains("dep-row-cb")) return;
      const id = String(e.target.dataset.txId);
      if (e.target.checked) _checked.add(id); else _checked.delete(id);
      setCheckboxStates();
    });

    // Admin note auto-save (delegated)
    qs("#depRows")?.addEventListener("input", (e) => {
      if (!e.target.classList.contains("dep-note")) return;
      const txId = Number(e.target.dataset.txId);
      if (txId > 0) debouncedSaveNote(txId, e.target.value.trim());
    });

    // Approve / Reject buttons (delegated)
    qs("#depRows")?.addEventListener("click", (e) => {
      const approveBtn = e.target.closest(".dep-approve-btn");
      if (approveBtn) {
        const txId = Number(approveBtn.dataset.txId);
        const addr = approveBtn.dataset.addr || "";
        const amt = approveBtn.dataset.amt || "";
        // (2026-05-16 v417) 운영자: '소수점 입금은 현재 허용 X. 입금 알림도
        //   소수점 없는게 가독성 높다.' raw 값 (1000.000000) → 정수 + 1,000
        //   콤마 포맷. 테이블 셀과 일관성 (이미 1,000 형식).
        const amtNum = Number(amt);
        const amtFormatted = Number.isFinite(amtNum)
          ? amtNum.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
          : amt;
        if (confirm(`[${addr}] ${amtFormatted} 입금을 승인하시겠습니까?`)) {
          approveOne(txId);
        }
        return;
      }

      const rejectBtn = e.target.closest(".dep-reject-btn");
      if (rejectBtn) {
        const txId = Number(rejectBtn.dataset.txId);
        rejectOne(txId);
        return;
      }
    });

    // Batch approve
    qs("#batchApproveBtn")?.addEventListener("click", batchApprove);

    // Batch clear
    qs("#batchClearBtn")?.addEventListener("click", () => {
      _checked.clear();
      setCheckboxStates();
    });
  };

  /* ── init ───────────────────────────────── */
  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("deposits");
    if (!me) return;

    bindEvents();
    await loadAssetOptions().catch(() => {});
    await fetchList();
  });
})();
