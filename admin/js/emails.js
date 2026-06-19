(() => {
  "use strict";

  const { qs, qsa, toast, api, bootAdminPage } = window.AdminCore;

  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const short = (s) => {
    s = String(s || "");
    if (s.length <= 16) return s;
    return `${s.slice(0, 6)}...${s.slice(-6)}`;
  };

  const fmtDate = (v) => {
    if (!v) return "-";
    const d = new Date(String(v).replace(" ", "T") + (String(v).includes("Z") ? "" : "Z"));
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(d);
  };

  const fmtNum = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return x.toLocaleString("en-US");
  };

  // ========== 수신자 집계 ==========
  const refreshRecipientCount = async () => {
    const filter = qs("#emFilter")?.value || "all_verified";
    const addresses = (qs("#emAddresses")?.value || "").trim();
    const countEl = qs("#emRecipientCount");
    const sampleEl = qs("#emSample");
    if (countEl) countEl.textContent = "…";
    if (sampleEl) sampleEl.innerHTML = '<div class="muted">조회 중…</div>';

    try {
      const url = `/api/admin/emails/recipients?filter=${encodeURIComponent(filter)}&addresses=${encodeURIComponent(addresses)}`;
      const r = await api(url, { method: "GET" });
      if (countEl) countEl.textContent = fmtNum(r.total || 0);
      if (sampleEl) {
        const sample = Array.isArray(r.sample) ? r.sample : [];
        if (!sample.length) {
          sampleEl.innerHTML = '<div class="muted">대상 없음</div>';
        } else {
          sampleEl.innerHTML = sample.map((row) =>
            `<div class="sample-row"><span class="mono">${esc(short(row.address))}</span> — ${esc(row.email)}</div>`
          ).join("");
        }
      }
    } catch (e) {
      if (countEl) countEl.textContent = "0";
      if (sampleEl) sampleEl.innerHTML = `<div class="muted">오류: ${esc(e.message || "조회 실패")}</div>`;
    }
  };

  // ========== 미리보기 ==========
  const doPreview = async () => {
    const subject = (qs("#emSubject")?.value || "").trim();
    const bodyHtml = qs("#emBody")?.value || "";
    if (!subject) { toast("제목을 입력하세요.", "bad"); return; }
    if (!bodyHtml.trim()) { toast("본문을 입력하세요.", "bad"); return; }

    try {
      const filter = qs("#emFilter")?.value || "all_verified";
      const addresses = (qs("#emAddresses")?.value || "")
        .split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

      const r = await api("/api/admin/emails/preview", {
        method: "POST",
        body: { subject, body_html: bodyHtml, filter, addresses },
      });

      const previewEl = qs("#emPreview");
      if (previewEl) {
        previewEl.innerHTML =
          `<div style="padding-bottom:8px;border-bottom:1px solid #e5e7eb;margin-bottom:12px">
             <div class="small-note">제목</div>
             <div style="font-weight:700;font-size:15px;margin-top:4px">${esc(r.subject)}</div>
           </div>
           <div>${r.body_html}</div>`;
      }
      toast(`미리보기 OK — 대상 ${fmtNum(r.total)}명`, "good");
    } catch (e) {
      toast(e.message || "미리보기 실패", "bad");
    }
  };

  // ========== 발송 ==========
  const doSend = async () => {
    const subject = (qs("#emSubject")?.value || "").trim();
    const bodyHtml = qs("#emBody")?.value || "";
    if (!subject) { toast("제목을 입력하세요.", "bad"); return; }
    if (!bodyHtml.trim()) { toast("본문을 입력하세요.", "bad"); return; }

    const count = qs("#emRecipientCount")?.textContent || "0";
    if (!confirm(`대상 ${count}명에게 메일을 발송합니다. 계속하시겠습니까?`)) return;

    const sendBtn = qs("#emSendBtn");
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "발송 중…"; }

    try {
      const filter = qs("#emFilter")?.value || "all_verified";
      const addresses = (qs("#emAddresses")?.value || "")
        .split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

      const r = await api("/api/admin/emails/send", {
        method: "POST",
        body: { subject, body_html: bodyHtml, filter, addresses },
      });
      toast(r.message || "발송 시작", "good");
      await loadHistory();
      // 10초 후 자동 재조회 (백그라운드 발송 중)
      setTimeout(() => { loadHistory().catch(() => {}); }, 10000);
    } catch (e) {
      toast(e.message || "발송 실패", "bad");
    } finally {
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "발송 시작"; }
    }
  };

  // ========== 이력 ==========
  const loadHistory = async () => {
    const tb = qs("#emHistoryRows");
    if (!tb) return;
    try {
      const r = await api("/api/admin/emails/list?limit=50", { method: "GET" });
      const items = Array.isArray(r.items) ? r.items : [];
      if (!items.length) {
        tb.innerHTML = '<tr><td colspan="8" class="muted center">발송 이력이 없습니다.</td></tr>';
        return;
      }
      tb.innerHTML = items.map((it) => `
        <tr data-broadcast-id="${esc(it.id)}" style="cursor:pointer">
          <td class="mono">${esc(it.id)}</td>
          <td title="${esc(it.subject)}" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.subject)}</td>
          <td class="right">${fmtNum(it.total)}</td>
          <td class="right" style="color:#166534">${fmtNum(it.sent)}</td>
          <td class="right" style="color:${Number(it.failed) > 0 ? '#991b1b' : '#64748b'}">${fmtNum(it.failed)}</td>
          <td><span class="status-chip ${esc(it.status)}">${esc(it.status)}</span></td>
          <td class="small-note">
            <div>${esc(it.created_by || '-')}</div>
            ${it.created_ip ? `<div class="mono" style="font-size:10px;color:#94a3b8">${esc(it.created_ip)}</div>` : ''}
          </td>
          <td class="small-note">${esc(fmtDate(it.created_at))}</td>
        </tr>
      `).join("");

      qsa("#emHistoryRows tr[data-broadcast-id]").forEach((tr) => {
        tr.addEventListener("click", () => loadDetail(tr.dataset.broadcastId));
      });
    } catch (e) {
      tb.innerHTML = `<tr><td colspan="7" class="muted center">오류: ${esc(e.message || "로드 실패")}</td></tr>`;
    }
  };

  // ========== 상세 ==========
  const loadDetail = async (id) => {
    if (!id) return;
    const box = qs("#emDetailBox");
    const hdr = qs("#emDetailHeader");
    const rows = qs("#emDetailRows");
    if (box) box.classList.remove("hidden");
    if (hdr) hdr.textContent = `#${id} 로드 중…`;
    if (rows) rows.innerHTML = '<tr><td colspan="3" class="muted center">…</td></tr>';

    try {
      const r = await api(`/api/admin/emails/detail?id=${encodeURIComponent(id)}`, { method: "GET" });
      const bc = r.broadcast || {};
      if (hdr) {
        hdr.innerHTML = `#${esc(bc.id)} · <strong>${esc(bc.subject)}</strong> ·
          대상 ${fmtNum(bc.total)} / 성공 ${fmtNum(bc.sent)} / 실패 ${fmtNum(bc.failed)} ·
          <span class="status-chip ${esc(bc.status)}">${esc(bc.status)}</span>`;
      }
      const logs = Array.isArray(r.logs) ? r.logs : [];
      if (!logs.length) {
        rows.innerHTML = '<tr><td colspan="3" class="muted center">로그 없음</td></tr>';
        return;
      }
      rows.innerHTML = logs.map((l) => `
        <tr>
          <td>${esc(l.email)}</td>
          <td><span class="status-chip ${esc(l.status)}">${esc(l.status)}</span></td>
          <td class="small-note">${esc(l.error || fmtDate(l.sent_at))}</td>
        </tr>
      `).join("");
    } catch (e) {
      if (rows) rows.innerHTML = `<tr><td colspan="3" class="muted center">오류: ${esc(e.message || "")}</td></tr>`;
    }
  };

  // ========== 필터 변경 핸들링 ==========
  const bindFilterUI = () => {
    const filter = qs("#emFilter");
    const specificBox = qs("#emSpecificBox");
    const toggleSpecific = () => {
      const isSpecific = filter?.value === "specific";
      if (specificBox) specificBox.classList.toggle("hidden", !isSpecific);
    };
    filter?.addEventListener("change", () => {
      toggleSpecific();
      refreshRecipientCount();
    });
    toggleSpecific();

    qs("#emRefreshCountBtn")?.addEventListener("click", refreshRecipientCount);
    qs("#emAddresses")?.addEventListener("blur", () => {
      if (filter?.value === "specific") refreshRecipientCount();
    });
    qs("#emPreviewBtn")?.addEventListener("click", doPreview);
    qs("#emSendBtn")?.addEventListener("click", doSend);
    qs("#emReloadListBtn")?.addEventListener("click", loadHistory);
  };

  // ========== 부팅 ==========
  document.addEventListener("DOMContentLoaded", async () => {
    await bootAdminPage("emails");
    bindFilterUI();
    await refreshRecipientCount();
    await loadHistory();
  });
})();
