/* admin/js/terms.js — Legal terms editor (2026-05-12 v306)
 *
 * Operator: '이용약관 관리자에서 수정 할 수 있도록 해줘. 영어와 한국어 별도 기재.'
 *
 * Endpoints:
 *   GET  /api/admin/terms   — load current KO + EN versions
 *   POST /api/admin/terms   — save both versions in one call
 *   (Public GET /api/terms is consumed by /user/terms.html)
 */
(() => {
  "use strict";

  const { qs, toast, api, bootAdminPage } = window.AdminCore;

  const fmtUpdated = (raw, updatedBy) => {
    const s = String(raw || "").trim();
    if (!s) return "-";
    const t = s.replace("T", " ").slice(0, 16);
    return updatedBy ? `${t} · ${updatedBy}` : t;
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("terms-admin");
    if (!me) return;

    const els = {
      titleKo:           qs("#termsTitleKo"),
      titleEn:           qs("#termsTitleEn"),
      subtitleKo:        qs("#termsSubtitleKo"),
      subtitleEn:        qs("#termsSubtitleEn"),
      bodyKo:            qs("#termsBodyKo"),
      bodyEn:            qs("#termsBodyEn"),
      effectiveDate:     qs("#termsEffectiveDate"),
      updatedMeta:       qs("#termsUpdatedMeta"),
      saveBtn:           qs("#termsSaveBtn"),
      refreshBtn:        qs("#termsRefreshBtn"),
      loadDraftBtn:      qs("#termsLoadDraftBtn"),
      appendSuspensionBtn: qs("#termsAppendSuspensionBtn"),
      feedback:          qs("#termsSaveFeedback"),
    };

    // (2026-05-15 v385) 폼을 terms_draft.js 의 SilicaChain 운영 모델 기반
    //   기본 초안으로 덮어씀. 기존 DB 약관이 있어도 강제 적용 — 단, [저장]
    //   클릭이 따로 필요하므로 사고 위험 없음 (운영자 검토 기회 보장).
    //   load() 의 brand-new fallback 과 동일 데이터 소스 (window.SILICA_TERMS_DRAFT).
    const loadDraft = () => {
      const draft = window.SILICA_TERMS_DRAFT;
      if (!draft) {
        toast("초안 데이터를 로드할 수 없습니다 (terms_draft.js 미로드).", "bad");
        return;
      }
      const confirmMsg = "현재 폼 내용을 기본 초안으로 덮어씁니다.\n\n"
        + "저장 전까지는 DB / 사용자 페이지에 반영되지 않습니다.\n"
        + "검토 후 [저장] 을 별도로 클릭하셔야 적용됩니다.\n\n"
        + "계속하시겠습니까?";
      if (!confirm(confirmMsg)) return;

      if (els.titleKo)    els.titleKo.value    = draft.title_ko    || "";
      if (els.titleEn)    els.titleEn.value    = draft.title_en    || "";
      if (els.subtitleKo) els.subtitleKo.value = draft.subtitle_ko || "";
      if (els.subtitleEn) els.subtitleEn.value = draft.subtitle_en || "";
      if (els.bodyKo)     els.bodyKo.value     = draft.body_ko     || "";
      if (els.bodyEn)     els.bodyEn.value     = draft.body_en     || "";
      if (els.effectiveDate && !els.effectiveDate.value) {
        els.effectiveDate.value = new Date().toISOString().slice(0, 10);
      }
      if (els.feedback) {
        els.feedback.textContent = "기본 초안이 폼에 로드되었습니다. 검토 후 [저장] 을 클릭하면 사용자 페이지에 반영됩니다. (아직 DB 미반영)";
      }
      toast("초안 로드 완료 — 검토 후 [저장] 클릭", "good");
    };

    const load = async () => {
      try {
        const r = await api("/api/admin/terms", { method: "GET" });
        const t = r?.terms || null;
        if (!t) {
          // (2026-05-15 v384) Brand-new state — DB 에 약관이 한 번도 저장된
          //   적 없는 경우, terms_draft.js 의 SilicaChain 운영 모델 기반
          //   기본 초안을 폼에 미리 채워 운영자가 검토 + 수정 + [저장] 만
          //   하면 user/terms.html 에 즉시 반영되도록 함. 저장 행동 없이
          //   페이지를 떠나면 DB 에 들어가지 않음 (popup default 사고와 다른
          //   안전 패턴 — 명시적 [저장] 클릭이 항상 필요).
          //   draft 객체 미로드 시엔 기존처럼 title 만 채우는 fallback 유지.
          const draft = window.SILICA_TERMS_DRAFT;
          if (draft) {
            if (els.titleKo)    els.titleKo.value    = draft.title_ko    || "이용약관 및 투자 안내";
            if (els.titleEn)    els.titleEn.value    = draft.title_en    || "Terms of Service & Investment";
            if (els.subtitleKo) els.subtitleKo.value = draft.subtitle_ko || "";
            if (els.subtitleEn) els.subtitleEn.value = draft.subtitle_en || "";
            if (els.bodyKo)     els.bodyKo.value     = draft.body_ko     || "";
            if (els.bodyEn)     els.bodyEn.value     = draft.body_en     || "";
          } else {
            if (els.titleEn) els.titleEn.value = "Terms of Service & Investment";
            if (els.titleKo) els.titleKo.value = "이용약관 및 투자 안내";
          }
          if (els.effectiveDate) els.effectiveDate.value = new Date().toISOString().slice(0, 10);
          if (els.updatedMeta) els.updatedMeta.textContent = "(아직 저장된 약관이 없습니다 — 기본 초안이 미리 채워졌습니다. 검토 후 [저장] 클릭 시 사용자 페이지에 반영됩니다.)";
          return;
        }
        if (els.titleKo)       els.titleKo.value       = String(t.title_ko ?? "");
        if (els.titleEn)       els.titleEn.value       = String(t.title_en ?? "");
        if (els.subtitleKo)    els.subtitleKo.value    = String(t.subtitle_ko ?? "");
        if (els.subtitleEn)    els.subtitleEn.value    = String(t.subtitle_en ?? "");
        if (els.bodyKo)        els.bodyKo.value        = String(t.body_html_ko ?? "");
        if (els.bodyEn)        els.bodyEn.value        = String(t.body_html_en ?? "");
        if (els.effectiveDate) els.effectiveDate.value = String(t.effective_date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        if (els.updatedMeta)   els.updatedMeta.textContent = fmtUpdated(t.updated_at, t.updated_by);
      } catch (e) {
        toast(e.message || "약관 로드 실패", "bad");
      }
    };

    const save = async () => {
      const titleEn = String(els.titleEn?.value || "").trim();
      if (!titleEn) {
        toast("English 제목은 필수입니다.", "bad");
        return;
      }

      const payload = {
        title_ko:       String(els.titleKo?.value || "").trim(),
        title_en:       titleEn,
        subtitle_ko:    String(els.subtitleKo?.value || ""),
        subtitle_en:    String(els.subtitleEn?.value || ""),
        body_html_ko:   String(els.bodyKo?.value || ""),
        body_html_en:   String(els.bodyEn?.value || ""),
        effective_date: String(els.effectiveDate?.value || "").trim(),
      };

      try {
        if (els.saveBtn) els.saveBtn.disabled = true;
        await api("/api/admin/terms", { method: "POST", body: payload });
        toast("이용약관이 저장되었습니다. 사용자 페이지에 즉시 반영됩니다.", "good");
        if (els.feedback) els.feedback.textContent = "저장 완료 · 사용자 페이지 새로고침 시 반영됩니다.";
        await load();
      } catch (e) {
        toast(e.message || "저장 실패", "bad");
        if (els.feedback) els.feedback.textContent = e.message || "저장 실패";
      } finally {
        if (els.saveBtn) els.saveBtn.disabled = false;
      }
    };

    // (2026-05-18 v561) 사용중지 면책 조항 추가 — 운영자가 본문 끝에
    //   사용중지 / 출금정지 자동 처리 / 비복원 / 면책 조항 HTML 을 append.
    //   data-clause-key="suspension_disclaimer" 마커로 중복 추가 방지.
    const appendSuspensionClause = () => {
      const clause = window.SILICA_SUSPENSION_CLAUSE;
      if (!clause) {
        toast("면책 조항 데이터 미로드 (terms_suspension_clause.js 누락).", "bad");
        return;
      }
      const marker = 'data-clause-key="suspension_disclaimer"';
      const koHas = (els.bodyKo?.value || "").includes(marker);
      const enHas = (els.bodyEn?.value || "").includes(marker);
      if (koHas && enHas) {
        toast("이미 KO/EN 양쪽에 추가되어 있습니다.", "info");
        return;
      }
      const confirmMsg = "현재 본문 끝에 '사용중지 면책 조항' HTML 블록을 추가합니다.\n\n"
        + "- KO 본문: " + (koHas ? "이미 있음 (skip)" : "추가됨") + "\n"
        + "- EN 본문: " + (enHas ? "이미 있음 (skip)" : "추가됨") + "\n\n"
        + "저장 전까지는 DB / 사용자 페이지에 반영되지 않습니다.\n"
        + "검토 후 [저장] 을 별도로 클릭하셔야 적용됩니다.\n\n"
        + "계속하시겠습니까?";
      if (!confirm(confirmMsg)) return;

      if (!koHas && els.bodyKo) {
        const cur = String(els.bodyKo.value || "").trimEnd();
        els.bodyKo.value = (cur ? cur + "\n\n" : "") + clause.body_ko + "\n";
      }
      if (!enHas && els.bodyEn) {
        const cur = String(els.bodyEn.value || "").trimEnd();
        els.bodyEn.value = (cur ? cur + "\n\n" : "") + clause.body_en + "\n";
      }
      if (els.feedback) {
        els.feedback.textContent = "사용중지 면책 조항이 본문 끝에 추가되었습니다. 검토 후 [저장] 을 클릭하면 사용자 페이지에 반영됩니다. (아직 DB 미반영)";
      }
      toast("면책 조항 추가 완료 — 검토 후 [저장] 클릭", "good");
    };

    els.saveBtn?.addEventListener("click", save);
    els.refreshBtn?.addEventListener("click", load);
    els.loadDraftBtn?.addEventListener("click", loadDraft);
    els.appendSuspensionBtn?.addEventListener("click", appendSuspensionClause);

    await load();
  });
})();
