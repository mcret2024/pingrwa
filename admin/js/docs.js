(() => {
  "use strict";

  const { qs, qsa, api, toast, fmtNum, bootAdminPage } = window.AdminCore;

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

  const isSaleType = (type) => ["sale", "sale_proof"].includes(String(type || "").trim());

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
    const me = await bootAdminPage("docs");
    if (!me) return;

    const assetSel = qs("#docAssetSelect");
    const typeSel = qs("#docTypeSelect");
    const titleEl = qs("#docTitle");
    const dateEl = qs("#docDate");
    const amountWrap = qs("#docAmountWrap");
    const amountEl = qs("#docAmount");
    const amountCcyEl = qs("#docAmountCcy");
    const fileEl = qs("#docFile");
    const uploadBtn = qs("#docUploadBtn");
    const refreshBtn = qs("#docRefreshBtn");
    const hintEl = qs("#docHint");
    const thead = qs("#docListThead");
    const tbody = qs("#docListTbody");
    const uploadOverlay = qs("#docUploadOverlay");
    const uploadOverlayMsg = qs("#docUploadOverlayMsg");

    if (!assetSel || !typeSel || !tbody) return;

    let assets = [];

    const CAT_LABELS = {
      registry: "등기부등본",
      valuation: "자산평가서",
      accounting: "회계자료",
      official1: "공식문서1",
      official2: "공식문서2",
      proof: "증빙문서",
      sale: "매각공문/정산문서",
      sale_proof: "매각증빙자료",
      general: "일반문서",
    };

    const setUploading = (busy, msg) => {
      if (uploadBtn) uploadBtn.disabled = !!busy;
      if (fileEl) fileEl.disabled = !!busy;
      if (refreshBtn) refreshBtn.disabled = !!busy;
      if (uploadOverlayMsg && msg) uploadOverlayMsg.textContent = String(msg);
      if (uploadOverlay) {
        uploadOverlay.classList.toggle("hidden", !busy);
        uploadOverlay.setAttribute("aria-hidden", busy ? "false" : "true");
      }
      document.body.style.overflow = busy ? "hidden" : "";
    };

    const getSelectedAsset = () => {
      const id = String(assetSel.value || "").trim();
      return assets.find((a) => a.id === id) || null;
    };

    const setAmountUI = () => {
      const t = String(typeSel.value || "registry");
      const ccy = "USDT";
      if (amountWrap) amountWrap.style.display = (t === "valuation" || t === "accounting") ? "block" : "none";
      if (amountCcyEl) amountCcyEl.textContent = ccy;
    };

    const loadAssets = async () => {
      const r = await api("/api/assets", { method: "GET" });
      assets = r.assets || [];
      assetSel.innerHTML = assets.map((a) => `<option value="${a.id}">${a.id} · ${a.name}</option>`).join("");
    };

    const loadDocs = async () => {
      const assetId = String(assetSel.value || "").trim();
      // (2026-05-12 v283) 빈 값(placeholder 상태)도 '_all' 로 간주해
      //   페이지 진입 시 전체 문서를 우선 보여줌. 업로드 검증과는 별개.
      const tRaw = String(typeSel.value || "").trim();
      const t = (!tRaw || tRaw === "_all") ? "_all" : tRaw;
      if (!assetId) return;

      const d = await api(`/api/assets/${encodeURIComponent(assetId)}`, { method: "GET" });
      const allDocs = d.docs || [];
      const isAll = (t === "_all");
      const docs = isAll ? allDocs : allDocs.filter((x) => x.doc_type === t);

      const assetCcy = "USDT";
      const typeLabel = isAll ? "전체" : (CAT_LABELS[t] || t);
      if (hintEl) hintEl.textContent = `${assetId} · ${typeLabel} 문서 ${docs.length}개`;

      const amountText = (row) => {
        const v = Number(row.amount || 0);
        if (!(v > 0)) return "-";
        const ccy = String(row.amount_currency || assetCcy || "USDT").toUpperCase();
        return `${fmtNum(v, 0)} ${ccy}`;
      };

      if (thead) {
        thead.innerHTML = isAll
          ? `<tr><th>유형</th><th>문서</th><th class="right">문서일</th><th class="right">금액</th><th class="right">보기</th><th class="right">삭제</th></tr>`
          : `<tr><th>문서</th><th class="right">문서일</th><th class="right">금액</th><th class="right">보기</th><th class="right">삭제</th></tr>`;
      }

      tbody.innerHTML = docs.map((row) => {
        const href = absUrl(row.file_path);
        const typeCol = isAll ? `<td style="font-size:12px">${CAT_LABELS[row.doc_type] || row.doc_type || "-"}</td>` : "";
        return `<tr>
          ${typeCol}
          <td>${row.title}</td>
          <td class="right">${row.doc_date ? new Date(row.doc_date).toLocaleDateString("ko-KR") : "-"}</td>
          <td class="right">${amountText(row)}</td>
          <td class="right"><a class="btn small" href="${href}" target="_blank" rel="noopener">보기</a></td>
          <td class="right"><button class="btn small danger" data-del="${row.id}" data-doc-type="${row.doc_type || ""}">삭제</button></td>
        </tr>`;
      }).join("") || `<tr><td colspan="${isAll ? 6 : 5}" class="center muted">문서가 없습니다.</td></tr>`;

      qsa("[data-del]", tbody).forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            const docId = btn.getAttribute("data-del");
            const docType = String(btn.getAttribute("data-doc-type") || "");
            const path = isSaleType(docType)
              ? `/api/admin/sales/${encodeURIComponent(assetId)}/docs/${encodeURIComponent(docId)}`
              : `/api/admin/assets/${encodeURIComponent(assetId)}/docs/${encodeURIComponent(docId)}`;
            await api(path, { method: "DELETE" });
            toast("삭제 완료", "good");
            await loadDocs();
          } catch (e) {
            toast(e.message || "삭제 실패", "bad");
          }
        });
      });
    };

    typeSel.addEventListener("change", async () => {
      setAmountUI();
      await loadDocs();
    });

    assetSel.addEventListener("change", async () => {
      setAmountUI();
      await loadDocs();
    });

    refreshBtn?.addEventListener("click", async () => {
      try {
        await loadDocs();
        toast("새로고침 완료", "good");
      } catch (e) {
        toast(e.message || "실패", "bad");
      }
    });

    uploadBtn?.addEventListener("click", async () => {
      try {
        const assetId = String(assetSel.value || "").trim();
        // (2026-05-12 v283) 운영자: '문서 유형을 선택하지 않으면 등록
        //   되지 않도록 해라.' 이전 코드는 빈 값을 'proof' 로 silent
        //   fallback 시켜서 placeholder 상태로 업로드되면 모두 증빙문서로
        //   분류되는 문제가 있었음. 빈 값과 '_all' 은 명시적으로 거부.
        const t = String(typeSel.value || "").trim();
        const title = String(titleEl?.value || "").trim() || "문서";
        const date = String(dateEl?.value || "").trim();
        const file = fileEl?.files?.[0];

        if (!assetId) return toast("자산을 선택하세요.", "bad");
        if (!t) return toast("문서 유형을 선택하세요.", "bad");
        if (t === "_all") return toast("업로드 시에는 구체적인 문서 유형을 선택하세요.", "bad");
        if (!file) return toast("파일을 선택하세요.", "bad");

        const assetCcy = "USDT";
        if (t === "valuation") {
          const amt = Number(String(amountEl?.value || "").trim());
          if (!Number.isFinite(amt) || amt <= 0) return toast(`감정평가 금액(${assetCcy})을 입력하세요.`, "bad");
        }

        const fd = new FormData();
        fd.append("type", t);
        fd.append("title", title);
        if (date) fd.append("date", date);
        if (t === "valuation") {
          fd.append("amount", String(Number(amountEl.value)));
          fd.append("amount_currency", assetCcy);
        }
        fd.append("file", file);

        const route = isSaleType(t)
          ? `/api/admin/sales/${encodeURIComponent(assetId)}/docs`
          : `/api/admin/assets/${encodeURIComponent(assetId)}/docs`;

        setUploading(true, `${file.name || "파일"} 업로드 중입니다. 완료될 때까지 기다려주세요.`);
        await uploadForm(route, fd);

        toast("업로드 완료", "good");
        if (titleEl) titleEl.value = "";
        if (dateEl) dateEl.value = "";
        if (amountEl) amountEl.value = "";
        if (fileEl) fileEl.value = "";
        await loadDocs();
      } catch (e) {
        toast(e.message || "업로드 실패", "bad");
      } finally {
        setUploading(false, "파일이 저장될 때까지 잠시만 기다려주세요.");
      }
    });

    await loadAssets();
    setAmountUI();
    await loadDocs();
  });
})();
