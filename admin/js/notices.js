/* admin/js/notices.js
 *
 * (2026-05-11 v270) Operator: '회계 자료만 별도 관리 할 수 있는
 * 설정탭을 구성해줘.' Standalone admin page that lists every notice,
 * uploads a new one (with optional file attachment), toggles
 * publish on/off, and deletes.
 *
 * Hits:
 *   GET    /api/admin/notices
 *   POST   /api/admin/notices               (multipart)
 *   POST   /api/admin/notices/:id/toggle
 *   DELETE /api/admin/notices/:id
 */
(() => {
  "use strict";

  const { qs, toast, api, bootAdminPage, STORAGE } = window.AdminCore;

  const CATEGORY_LABEL = {
    accounting_annual:    "연간 회계",
    accounting_quarterly: "분기 회계",
    general:              "일반 공지",
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const uploadForm = async (path, formData) => {
    const base = (localStorage.getItem(STORAGE.apiBase) || "").trim();
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
    if (!res.ok || data.ok === false) throw new Error(data.message || `요청 실패 (${res.status})`);
    return data;
  };

  const fmtDate = (raw) => {
    const s = String(raw || "").trim();
    return s ? s.slice(0, 10) : "";
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("notices");
    if (!me) return;

    const listEl    = qs("#ntList");
    const refreshBtn = qs("#noticeRefreshBtn");
    const submitBtn = qs("#ntSubmitBtn");
    const feedback  = qs("#ntSubmitFeedback");
    const inputs = {
      category:  qs("#ntCategory"),
      title:     qs("#ntTitle"),
      titleEn:   qs("#ntTitleEn"),
      period:    qs("#ntPeriod"),
      date:      qs("#ntDate"),
      body:      qs("#ntBody"),
      bodyEn:    qs("#ntBodyEn"),
      file:      qs("#ntFile"),
      published: qs("#ntPublished"),
    };

    // (v506) 수정 모달 elements + state.
    let __noticesCache = []; // 최근 GET 응답 캐시 — 수정 모달 prefill 용
    const editEls = {
      backdrop:    qs("#ntEditBackdrop"),
      id:          qs("#ntEditId"),
      category:    qs("#ntEditCategory"),
      title:       qs("#ntEditTitle"),
      titleEn:     qs("#ntEditTitleEn"),
      period:      qs("#ntEditPeriod"),
      date:        qs("#ntEditDate"),
      body:        qs("#ntEditBody"),
      bodyEn:      qs("#ntEditBodyEn"),
      file:        qs("#ntEditFile"),
      removeFile:  qs("#ntEditRemoveFile"),
      currentFile: qs("#ntEditCurrentFile"),
      published:   qs("#ntEditPublished"),
      cancelBtn:   qs("#ntEditCancel"),
      saveBtn:     qs("#ntEditSave"),
    };

    const openEditModal = (row) => {
      if (!editEls.backdrop || !row) return;
      editEls.id.value         = String(row.id);
      editEls.category.value   = row.category || "general";
      editEls.title.value      = row.title || "";
      editEls.titleEn.value    = row.title_en || "";
      editEls.period.value     = row.period || "";
      editEls.date.value       = row.notice_date ? String(row.notice_date).slice(0, 10) : "";
      editEls.body.value       = row.body || "";
      editEls.bodyEn.value     = row.body_en || "";
      editEls.published.checked = !!row.published;
      editEls.file.value       = "";
      editEls.removeFile.checked = false;
      const curFile = String(row.file_path || "").trim();
      editEls.currentFile.innerHTML = curFile
        ? `현재 파일: <a href="${esc(curFile)}" target="_blank" rel="noopener">${esc(curFile.split("/").pop())}</a> (새 파일 선택 시 교체)`
        : "현재 첨부 파일 없음";
      editEls.backdrop.classList.add("open");
      editEls.backdrop.setAttribute("aria-hidden", "false");
    };

    const closeEditModal = () => {
      if (!editEls.backdrop) return;
      editEls.backdrop.classList.remove("open");
      editEls.backdrop.setAttribute("aria-hidden", "true");
    };

    editEls.cancelBtn?.addEventListener("click", closeEditModal);
    editEls.backdrop?.addEventListener("click", (e) => {
      if (e.target === editEls.backdrop) closeEditModal();
    });

    editEls.saveBtn?.addEventListener("click", async () => {
      const id = String(editEls.id.value || "").trim();
      if (!id) return;
      const title = String(editEls.title.value || "").trim();
      if (!title) return toast("한국어 제목은 비울 수 없습니다.", "bad");
      try {
        const fd = new FormData();
        fd.append("category", editEls.category.value || "general");
        fd.append("title", title);
        fd.append("title_en", String(editEls.titleEn.value || "").trim());
        fd.append("period", String(editEls.period.value || "").trim());
        fd.append("notice_date", String(editEls.date.value || "").trim());
        fd.append("body", editEls.body.value || "");
        fd.append("body_en", editEls.bodyEn.value || "");
        fd.append("published", editEls.published.checked ? "1" : "0");
        if (editEls.removeFile.checked) fd.append("remove_file", "1");
        const f = editEls.file.files?.[0];
        if (f) fd.append("file", f);

        editEls.saveBtn.disabled = true;
        editEls.saveBtn.textContent = "저장 중…";
        await uploadForm(`/api/admin/notices/${encodeURIComponent(id)}/update`, fd);
        toast("수정 완료", "good");
        closeEditModal();
        await loadList();
      } catch (e) {
        toast(e?.message || "수정 실패", "bad");
      } finally {
        editEls.saveBtn.disabled = false;
        editEls.saveBtn.textContent = "저장";
      }
    });

    const renderList = (rows) => {
      if (!listEl) return;
      if (!rows.length) {
        listEl.innerHTML = `<div class="muted" style="padding:14px 0">등록된 공지가 없습니다.</div>`;
        return;
      }
      listEl.innerHTML = rows.map(n => {
        const catLabel = CATEGORY_LABEL[n.category] || n.category;
        const dateText = fmtDate(n.notice_date) || fmtDate(n.created_at);
        const pubBadge = n.published
          ? `<span class="pub-on">● 공개</span>`
          : `<span class="pub-off">○ 비공개</span>`;
        const hasFile = !!String(n.file_path || "").trim();
        const metaBits = [];
        if (dateText)  metaBits.push(esc(dateText));
        if (n.period)  metaBits.push(esc(n.period));
        if (hasFile)   metaBits.push("📎 첨부 있음");
        // (v502) KO/EN 둘 다 표시 — admin 이 한눈에 어느 언어가 채워졌는지 확인.
        const titleKo = String(n.title || "").trim();
        const titleEn = String(n.title_en || "").trim();
        const titleLine = titleEn
          ? `<div class="title-line" style="margin-top:6px">${esc(titleKo || "(제목 없음)")}</div>
             <div class="title-line" style="margin-top:2px;color:#475569;font-weight:600">${esc(titleEn)}</div>`
          : `<div class="title-line" style="margin-top:6px">${esc(titleKo || "(제목 없음)")}</div>
             <div class="meta-line" style="color:#94a3b8">영문 미입력 (한국어로 폴백)</div>`;
        return `<div class="notice-row" data-id="${n.id}">
          <div class="nr-main">
            <div class="nr-head">
              <span class="cat-badge">${esc(catLabel)}</span>
              ${pubBadge}
            </div>
            ${titleLine}
            <div class="meta-line">${metaBits.join(" · ")}</div>
          </div>
          <div class="nr-actions">
            ${hasFile
              ? `<a class="btn small" href="${esc(n.file_path)}" target="_blank" rel="noopener">파일 보기</a>`
              : ``}
            <button class="btn small primary" data-edit="${n.id}" type="button">수정</button>
            <button class="btn small" data-toggle="${n.id}" type="button">
              ${n.published ? "비공개로" : "공개로"}
            </button>
            <button class="btn small" data-delete="${n.id}" type="button" style="background:#dc262622;color:#dc2626">삭제</button>
          </div>
        </div>`;
      }).join("");

      // Wire row actions.
      // (v506) 수정 버튼
      listEl.querySelectorAll("[data-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = String(btn.getAttribute("data-edit") || "");
          const row = __noticesCache.find(n => String(n.id) === id);
          if (!row) return toast("공지를 찾을 수 없습니다.", "bad");
          openEditModal(row);
        });
      });
      listEl.querySelectorAll("[data-toggle]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-toggle");
          try {
            await api(`/api/admin/notices/${encodeURIComponent(id)}/toggle`, { method: "POST" });
            toast("공개 상태 변경 완료", "good");
            await loadList();
          } catch (e) {
            toast(e.message || "변경 실패", "bad");
          }
        });
      });
      listEl.querySelectorAll("[data-delete]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-delete");
          if (!confirm("이 공지를 삭제하시겠습니까? 첨부 파일도 함께 삭제됩니다.")) return;
          try {
            await api(`/api/admin/notices/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast("삭제 완료", "good");
            await loadList();
          } catch (e) {
            toast(e.message || "삭제 실패", "bad");
          }
        });
      });
    };

    const loadList = async () => {
      try {
        const r = await api("/api/admin/notices", { method: "GET" });
        const rows = Array.isArray(r?.notices) ? r.notices : [];
        __noticesCache = rows; // (v506) 수정 모달 prefill 용 캐시
        renderList(rows);
      } catch (e) {
        if (listEl) {
          listEl.innerHTML = `<div class="muted" style="color:#dc2626;padding:14px 0">로딩 실패: ${esc(e.message || e)}</div>`;
        }
      }
    };

    refreshBtn?.addEventListener("click", loadList);

    submitBtn?.addEventListener("click", async () => {
      const title = String(inputs.title?.value || "").trim();
      if (!title) {
        if (feedback) feedback.textContent = "한국어 제목은 필수입니다.";
        return;
      }
      try {
        const fd = new FormData();
        fd.append("category", inputs.category?.value || "general");
        fd.append("title", title);
        // (v502) 영문 제목/본문 — 입력 시에만 전송. 비워두면 한국어 폴백.
        const titleEn = String(inputs.titleEn?.value || "").trim();
        if (titleEn) fd.append("title_en", titleEn);
        if (inputs.period?.value) fd.append("period", inputs.period.value.trim());
        if (inputs.date?.value)   fd.append("notice_date", inputs.date.value);
        if (inputs.body?.value)   fd.append("body", inputs.body.value);
        if (inputs.bodyEn?.value) fd.append("body_en", inputs.bodyEn.value);
        fd.append("published", inputs.published?.checked ? "1" : "0");
        const f = inputs.file?.files?.[0];
        if (f) fd.append("file", f);

        await uploadForm("/api/admin/notices", fd);
        toast("등록 완료", "good");
        if (feedback) feedback.textContent = "";
        // Reset form
        if (inputs.title)    inputs.title.value    = "";
        if (inputs.titleEn)  inputs.titleEn.value  = "";
        if (inputs.period)   inputs.period.value   = "";
        if (inputs.date)     inputs.date.value     = "";
        if (inputs.body)     inputs.body.value     = "";
        if (inputs.bodyEn)   inputs.bodyEn.value   = "";
        if (inputs.file)     inputs.file.value     = "";
        if (inputs.published) inputs.published.checked = true;
        await loadList();
      } catch (e) {
        toast(e.message || "등록 실패", "bad");
        if (feedback) feedback.textContent = e.message || "등록 실패";
      }
    });

    await loadList();
  });
})();
