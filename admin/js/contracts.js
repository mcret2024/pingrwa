(() => {
"use strict";

const { qs, qsa, api, toast, bootAdminPage } = window.AdminCore;

// ====== State ======
let contracts = [];
let currentContract = null;
let templates = [];
let currentTemplate = null;
let editingTemplateId = null;
let allAssets = [];
let ctx;
let drawing = false;
let currentContractState = "awaiting_admin";
let currentAssetFilter = "";
let bootContractId = null;

// ====== Asset Picker State ======
let apResolve = null;      // promise resolver
let apSelectedId = null;   // currently selected in picker
let apFilteredAssets = [];  // displayed list
let apExcludeIds = new Set();
let apCurrentTab = "all";
let apCurrentType = "all";

/* ================================================================
   ASSET PICKER MODAL
================================================================ */

const STATUS_MAP = {
  "\ubaa8\uc9d1\uc911": "funding",
  "\uad6c\ub9e4\uc9c4\ud589": "buying",
  "\ubd84\ubc30\uc911": "distributing",
  "\uc6b4\uc601\uc911": "operating",
  "\ub9e4\uac01": "sold",
  "\ubaa8\uc9d1\uc2e4\ud328": "failed",
  "\ucde8\uc18c\ub428": "failed",
};
const STATUS_ICON = {
  funding: "\u25b6",
  buying: "\u21e8",
  distributing: "\u2726",
  operating: "\u2605",
  sold: "\u2714",
  failed: "\u2718",
  default: "\u25cf",
};
const STATUS_LABEL = {
  "\ubaa8\uc9d1\uc911": "\ubaa8\uc9d1\uc911",
  "\uad6c\ub9e4\uc9c4\ud589": "\uad6c\ub9e4\uc9c4\ud589",
  "\ubd84\ubc30\uc911": "\ubd84\ubc30\uc911",
  "\uc6b4\uc601\uc911": "\uc6b4\uc601\uc911",
  "\ub9e4\uac01": "\ub9e4\uac01",
  "\ubaa8\uc9d1\uc2e4\ud328": "\ubaa8\uc9d1\uc2e4\ud328",
  "\ucde8\uc18c\ub428": "\ucde8\uc18c\ub428",
};

// Asset type short labels
const TYPE_SHORT = {
  "\uc544\ud30c\ud2b8": "APT", "\uc624\ud53c\uc2a4\ud154": "OFT", "\ud1a0\uc9c0": "LND",
  "\ube4c\ub529": "BLD", "\uc0c1\uac00": "SHP", "\uacf5\uc7a5": "FCT",
  "\ucc3d\uace0": "WRH", "\uc219\ubc15\uc2dc\uc124": "HTL", "\uc885\uad50\uc2dc\uc124": "REL",
  "\ub9ac\uc870\ud2b8": "RST", "\uc624\ud53c\uc2a4": "OFC", "\ub808\uc9c0\ub358\uc2a4": "RSD",
  "\uc8fc\ud0dd": "HSE", "\ub18d\uc9c0": "FRM", "\uae30\ud0c0": "ETC",
};

function getStatusClass(status) {
  return STATUS_MAP[status] || "default";
}

function openAssetPicker(opts = {}) {
  return new Promise(async (resolve) => {
    apResolve = resolve;
    apSelectedId = null;
    apExcludeIds = new Set(opts.excludeIds || []);
    apCurrentTab = "all";
    apCurrentType = "all";

    // Set title/subtitle
    if (qs("#apTitle")) qs("#apTitle").textContent = opts.title || "\uc790\uc0b0 \uc120\ud0dd";
    if (qs("#apSubtitle")) qs("#apSubtitle").textContent = opts.subtitle || "\ud15c\ud50c\ub9bf\uc744 \uc801\uc6a9\ud560 \uc790\uc0b0\uc744 \uc120\ud0dd\ud558\uc138\uc694.";
    if (qs("#apSearch")) qs("#apSearch").value = "";

    // Load assets (force refresh each time picker opens)
    await loadAllAssets(true);

    // Build tabs
    buildApTabs();
    buildApTypeTabs();
    renderApList();

    // Show modal
    qs("#assetPickerOverlay")?.classList.add("show");
    setTimeout(() => qs("#apSearch")?.focus(), 100);
  });
}

function closeAssetPicker(result = null) {
  qs("#assetPickerOverlay")?.classList.remove("show");
  if (apResolve) { apResolve(result); apResolve = null; }
}

function buildApTabs() {
  const tabsEl = qs("#apTabs");
  if (!tabsEl) return;

  const available = allAssets.filter(a => !apExcludeIds.has(a.id));
  const statusCounts = {};
  for (const a of available) {
    const s = a.status || "?";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  let html = `<button class="ap-tab${apCurrentTab === 'all' ? ' active' : ''}" data-tab="all">\uc804\uccb4 <span class="ap-cnt">${available.length}</span></button>`;
  for (const [status, count] of Object.entries(statusCounts)) {
    const label = STATUS_LABEL[status] || status;
    html += `<button class="ap-tab${apCurrentTab === status ? ' active' : ''}" data-tab="${status}">${label} <span class="ap-cnt">${count}</span></button>`;
  }
  tabsEl.innerHTML = html;

  tabsEl.querySelectorAll(".ap-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      apCurrentTab = btn.dataset.tab;
      tabsEl.querySelectorAll(".ap-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderApList();
    });
  });
}

function buildApTypeTabs() {
  const tabsEl = qs("#apTypeTabs");
  if (!tabsEl) return;

  const available = allAssets.filter(a => !apExcludeIds.has(a.id));
  const typeCounts = {};
  for (const a of available) {
    const t = a.type || "?";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  let html = `<button class="ap-tab${apCurrentType === 'all' ? ' active' : ''}" data-type="all">\uc804\uccb4 <span class="ap-cnt">${available.length}</span></button>`;
  for (const [type, count] of Object.entries(typeCounts)) {
    const short = TYPE_SHORT[type] || type;
    html += `<button class="ap-tab${apCurrentType === type ? ' active' : ''}" data-type="${type}">${type} <span class="ap-cnt">${count}</span></button>`;
  }
  tabsEl.innerHTML = html;

  tabsEl.querySelectorAll(".ap-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      apCurrentType = btn.dataset.type;
      tabsEl.querySelectorAll(".ap-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderApList();
    });
  });
}

function renderApList() {
  const listEl = qs("#apList");
  const countEl = qs("#apCount");
  if (!listEl) return;

  const q = (qs("#apSearch")?.value || "").toLowerCase().trim();
  const available = allAssets.filter(a => !apExcludeIds.has(a.id));

  apFilteredAssets = available.filter(a => {
    if (apCurrentTab !== "all" && a.status !== apCurrentTab) return false;
    if (apCurrentType !== "all" && a.type !== apCurrentType) return false;
    if (q) {
      const hay = `${a.id} ${a.name} ${a.status || ""} ${a.type || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (countEl) countEl.textContent = String(apFilteredAssets.length);

  if (apFilteredAssets.length === 0) {
    listEl.innerHTML = '<div style="padding:24px;text-align:center;color:#64748b">\uc790\uc0b0\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</div>';
    return;
  }

  listEl.innerHTML = "";
  for (const a of apFilteredAssets) {
    const sc = getStatusClass(a.status);
    const icon = STATUS_ICON[sc] || STATUS_ICON.default;
    const selected = apSelectedId === a.id;
    const typeLabel = a.type ? `<span class="ap-type-badge">${a.type}</span>` : "";

    const div = document.createElement("div");
    div.className = "ap-item" + (selected ? " selected" : "");
    div.innerHTML = `
      <div class="ap-icon ${sc}">${icon}</div>
      <div class="ap-info">
        <div class="ap-name">${a.id} &middot; ${a.name || "-"}</div>
        <div class="ap-detail">${a.status || "-"} ${typeLabel}</div>
      </div>
      <div class="ap-check">${selected ? "\u2713" : ""}</div>
    `;
    div.addEventListener("click", () => {
      apSelectedId = a.id;
      renderApList();
    });
    listEl.appendChild(div);
  }
}

function initAssetPicker() {
  qs("#apClose")?.addEventListener("click", () => closeAssetPicker(null));
  qs("#apCancelBtn")?.addEventListener("click", () => closeAssetPicker(null));
  qs("#apConfirmBtn")?.addEventListener("click", () => {
    closeAssetPicker(apSelectedId || null);
  });
  qs("#apSearch")?.addEventListener("input", renderApList);

  // Close on overlay click
  qs("#assetPickerOverlay")?.addEventListener("click", (e) => {
    if (e.target === qs("#assetPickerOverlay")) closeAssetPicker(null);
  });

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && qs("#assetPickerOverlay")?.classList.contains("show")) {
      closeAssetPicker(null);
    }
  });
}


/* ================================================================
   BOOT
================================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const me = await bootAdminPage("contracts");
  if (!me) return;

  initAssetPicker();

  // ====== Tab switching ======
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      if (target === "contracts") {
        qs("#tabContracts")?.classList.add("active");
      } else if (target === "templates") {
        qs("#tabTemplates")?.classList.add("active");
        loadTemplates();
      }
    });
  });

  // ====== Tab 1: Contract management ======
  initCanvas();
  bootContractId = new URLSearchParams(location.search).get("id");
  await loadAllAssets(true);
  populateContractAssetFilter();
  syncContractStateTabs();
  await loadContracts(bootContractId);

  qs("#refreshBtn")?.addEventListener("click", () => loadContracts(currentContract?.id || bootContractId));
  qs("#clearBtn")?.addEventListener("click", clearCanvas);
  qs("#signBtn")?.addEventListener("click", adminSign);
  qs("#rejectBtn")?.addEventListener("click", rejectContract);
  qs("#searchInput")?.addEventListener("input", renderContractList);
  qs("#assetFilter")?.addEventListener("change", () => {
    currentAssetFilter = qs("#assetFilter")?.value || "";
    renderContractList();
    if (currentContract && !getFilteredContracts().some(c => Number(c.id) === Number(currentContract.id))) {
      currentContract = null;
      if (qs("#contractDetailArea")) qs("#contractDetailArea").style.display = "none";
      if (qs("#contractEmptyMsg")) qs("#contractEmptyMsg").style.display = "";
    }
  });
  qsa("#contractStateTabs [data-contract-state]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentContractState = btn.getAttribute("data-contract-state") || "awaiting_admin";
      syncContractStateTabs();
      renderContractList();
      if (currentContract && !getFilteredContracts().some(c => Number(c.id) === Number(currentContract.id))) {
        currentContract = null;
        if (qs("#contractDetailArea")) qs("#contractDetailArea").style.display = "none";
        if (qs("#contractEmptyMsg")) qs("#contractEmptyMsg").style.display = "";
      }
    });
  });
  qs("#downloadBtn")?.addEventListener("click", downloadPdf);

  // ====== Tab 2: Template management ======
  qs("#tmplRefreshBtn")?.addEventListener("click", loadTemplates);
  qs("#tmplNewBtn")?.addEventListener("click", newTemplate);
  qs("#tmplSaveBtn")?.addEventListener("click", saveTemplate);
  qs("#tmplPreviewBtn")?.addEventListener("click", previewTemplate);
  qs("#tmplCloneBtn")?.addEventListener("click", cloneTemplate);
  qs("#tmplAssignBtn")?.addEventListener("click", assignAssetViaModal);
});


/* ================================================================
   TAB 1: CONTRACT MANAGEMENT
================================================================ */

function contractStatusLabel(status) {
  if (status === "awaiting_admin") return "관리자 서명 대기";
  if (status === "completed") return "서명 완료";
  if (status === "draft") return "초안";
  if (status === "user_signed") return "사용자 서명";
  if (status === "rejected") return "반려";
  return status || "-";
}

function syncContractStateTabs() {
  const sf = qs("#statusFilter");
  if (sf) sf.value = currentContractState;
  qsa("#contractStateTabs [data-contract-state]").forEach((btn) => {
    const active = (btn.getAttribute("data-contract-state") || "") === currentContractState;
    btn.classList.toggle("primary", active);
  });
}

function populateContractAssetFilter() {
  const sel = qs("#assetFilter");
  if (!sel) return;
  const rows = (allAssets || []).slice().sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""), "en", { numeric: true, sensitivity: "base" }));
  sel.innerHTML = [`<option value="">전체 자산</option>`].concat(
    rows.map((a) => `<option value="${a.id}">${a.id}${a.name ? ` · ${a.name}` : ""}</option>`)
  ).join("");
  sel.value = currentAssetFilter || "";
}

// (2026-05-17 v440) 운영자 보고: '관리자가 자산설정에서 입력한 자산명값이 아닌
//   다른 값으로 나옴'. backend /api/admin/contracts/* 가 asset_name_en /
//   asset_name_ko (asset_key_info 기반) 도 함께 반환. admin lang 에 따라 분기.
function getAssetDisplayName(c) {
  if (!c) return '-';
  const lang = (window.AdminI18n && typeof window.AdminI18n.getLang === 'function')
    ? window.AdminI18n.getLang()
    : 'ko';
  if (lang === 'en') {
    return c.asset_name_en || c.asset_name_ko || c.asset_name || c.asset_id || '-';
  }
  return c.asset_name_ko || c.asset_name || c.asset_id || '-';
}

function getFilteredContracts() {
  const keyword = (qs("#searchInput")?.value || "").toLowerCase().trim();
  return contracts.filter((c) => {
    if (currentContractState !== "all" && String(c.status || "") !== currentContractState) return false;
    if (currentAssetFilter && String(c.asset_id || "") !== currentAssetFilter) return false;
    if (keyword) {
      // 검색은 모든 다국어 자산명 포함 — admin 이 어떤 언어로든 검색 가능하도록.
      const hay = `${c.contract_no || ""} ${c.address || ""} ${c.asset_name || ""} ${c.asset_name_ko || ""} ${c.asset_name_en || ""} ${c.asset_id || ""}`.toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });
}

function setContractQueryId(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("id", String(id));
  else url.searchParams.delete("id");
  history.replaceState(null, "", url.toString());
}

async function loadContracts(preferredOpenId = null) {
  try {
    const r = await api("/api/admin/contracts/all?limit=500");
    contracts = r?.contracts || [];
    renderContractList();

    const targetId = preferredOpenId || currentContract?.id || bootContractId;
    if (!targetId) {
      if (qs("#contractDetailArea")) qs("#contractDetailArea").style.display = "none";
      if (qs("#contractEmptyMsg")) qs("#contractEmptyMsg").style.display = "";
      return;
    }

    const found = contracts.find((c) => Number(c.id) === Number(targetId));
    if (!found) {
      currentContract = null;
      if (qs("#contractDetailArea")) qs("#contractDetailArea").style.display = "none";
      if (qs("#contractEmptyMsg")) qs("#contractEmptyMsg").style.display = "";
      return;
    }

    if (!getFilteredContracts().some((c) => Number(c.id) === Number(targetId))) {
      currentContractState = ["completed","rejected","awaiting_admin"].includes(String(found.status||"")) ? String(found.status||"awaiting_admin") : "awaiting_admin";
      currentAssetFilter = String(found.asset_id || "");
      syncContractStateTabs();
      const af = qs("#assetFilter");
      if (af) af.value = currentAssetFilter;
      renderContractList();
    }

    await openContract(targetId, { preserveFilterState: true });
    bootContractId = null;
  } catch (e) {
    toast(e.message || "계약 목록 불러오기 실패", "bad");
  }
}

function renderContractList() {
  const list = qs("#contractList");
  if (!list) return;
  list.innerHTML = "";

  const filtered = getFilteredContracts();
  if (filtered.length === 0) {
    list.innerHTML = '<div class="muted" style="padding:20px;text-align:center">조건에 맞는 계약이 없습니다.</div>';
    return;
  }

  for (const c of filtered) {
    const div = document.createElement("div");
    div.className = "contract-item" + (currentContract?.id === c.id ? " selected" : "");
    // (2026-05-17 v451) 운영자 요청: 좌측 카드의 자산명 자리에 KYC 유저 실명
    //   표시. backend 가 mt_name / kyc_extracted_name 함께 반환 (v451).
    //   폴백: mt_name → kyc_extracted_name → '이름 미등록'.
    const userName = (c.mt_name && String(c.mt_name).trim())
        || (c.kyc_extracted_name && String(c.kyc_extracted_name).trim())
        || '이름 미등록';

    // (2026-05-18 v546) XSS audit — 모든 user/admin 작성 필드를 escape.
    //   contract_no, address, status label 까지 일관 처리.
    div.innerHTML = `
      <div><b>${escapeHtmlInline(c.contract_no || "-")}</b></div>
      <div class="muted">${escapeHtmlInline(userName)} · ${Number(c.amount_usdt || 0)} USDT</div>
      <div class="muted" style="font-size:12px">${escapeHtmlInline((c.address || "").slice(0,8))}... · ${escapeHtmlInline(contractStatusLabel(c.status))}</div>
    `;
    div.onclick = () => openContract(c.id);
    list.appendChild(div);
  }
}

// (v451) 좌측 카드 user_name HTML escape — XSS 방지. 한 곳에서만 사용되니
// 함수 외부 의존성 없이 inline 헬퍼로 정의.
function escapeHtmlInline(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function openContract(id, opts = {}) {
  try {
    const r = await api("/api/admin/contracts/" + id);
    currentContract = r?.contract;
    if (!currentContract) throw new Error("계약 데이터 없음");
    setContractQueryId(currentContract.id);

    if (!opts.preserveFilterState && !getFilteredContracts().some((c) => Number(c.id) === Number(currentContract.id))) {
      currentContractState = ["completed","rejected","awaiting_admin"].includes(String(currentContract.status||"")) ? String(currentContract.status||"awaiting_admin") : "awaiting_admin";
      currentAssetFilter = String(currentContract.asset_id || "");
      syncContractStateTabs();
      const af = qs("#assetFilter");
      if (af) af.value = currentAssetFilter;
      renderContractList();
    }

    if (qs("#contractDetailArea")) qs("#contractDetailArea").style.display = "block";
    if (qs("#contractEmptyMsg")) qs("#contractEmptyMsg").style.display = "none";

    // (2026-05-18 v546) XSS audit fix — KYC/지갑 필드는 모두 user-controlled.
    //   escapeHtmlInline 으로 일관 적용.
    const meta = qs("#contractMeta");
    if (meta) {
      meta.innerHTML = `번호: ${escapeHtmlInline(currentContract.contract_no || "-")} &middot; 상태: <strong>${escapeHtmlInline(contractStatusLabel(currentContract.status))}</strong> &middot; 금액: ${Number(currentContract.amount_usdt || 0)} USDT &middot; 자산: ${escapeHtmlInline(getAssetDisplayName(currentContract))}`;
    }
    const userMeta = qs("#contractUserMeta");
    const kycMeta = qs("#contractKycMeta");
    if (userMeta) {
      userMeta.innerHTML = `지갑: <span class="mono">${escapeHtmlInline(currentContract.address || "-")}</span> &middot; KYC 필수: <strong>${currentContract.kyc_required ? "예" : "아니오"}</strong> &middot; KYC 상태: <strong>${currentContract.kyc_required ? (currentContract.kyc_approved ? "완료" : "미완료") : "비활성화"}</strong>`;
    }
    if (kycMeta) {
      // textContent 라인을 만든 후 br 로만 연결 → 안전.
      const lines = [];
      lines.push(`실명: ${escapeHtmlInline(currentContract.mt_name || '-')}`);
      lines.push(`생년월일: ${escapeHtmlInline(currentContract.mt_birth || '-')}`);
      lines.push(`문서종류: ${escapeHtmlInline(currentContract.kyc_doc_type || '-')}`);
      lines.push(`검증상태: ${escapeHtmlInline(currentContract.kyc_status || '-')}`);
      lines.push(`추출이름: ${escapeHtmlInline(currentContract.kyc_extracted_name || '-')}`);
      lines.push(`추출생년월일: ${escapeHtmlInline(currentContract.kyc_extracted_birth || '-')}`);
      lines.push(`최종확인: ${escapeHtmlInline(currentContract.kyc_last_verified_at || '-')}`);
      kycMeta.innerHTML = lines.join('<br>');
    }

    // contract_body_html 은 의도된 HTML 페이로드 (운영자 작성 템플릿). 단,
    //   서버측 템플릿 엔진이 user 필드 (mt_name 등) 를 substitute 할 때
    //   HTML escape 하도록 함께 보장되어야 함. 본 라인은 admin-only 발신
    //   콘텐츠이므로 raw 그대로 두되, 백엔드 escape 책임을 명확히 한다.
    qs("#contractDoc").innerHTML = currentContract.contract_body_html || currentContract.body_html || "(내용 없음)";

    // (2026-06-08 v892) /uploads/* → /api/file/* 자동 swap (user core.js
    //   absUrl 와 동일 패턴). UPLOAD_DIR 가 배포 zone 밖이라 직접 정적
    //   접근 불가 — PHP serve 라우트 경유 필요.
    const swapUploadsUrl = (p) => {
      const s = String(p || "").trim();
      if (!s) return "";
      if (s.startsWith("/uploads/")) return "/api/file/" + s.substring("/uploads/".length);
      if (s.startsWith("uploads/"))  return "/api/file/" + s.substring("uploads/".length);
      return s;
    };
    const userSig = qs("#userSignature");
    if (userSig) {
      const swapped = swapUploadsUrl(currentContract.user_signature_path);
      userSig.src = swapped;
      userSig.style.display = swapped ? "" : "none";
    }

    const signBtn = qs("#signBtn");
    const clearBtn = qs("#clearBtn");
    const rejectBtn = qs("#rejectBtn");
    const rejectReason = qs("#rejectReason");
    const rejectReasonView = qs("#rejectReasonView");
    const canvas = qs("#adminSignCanvas");
    const img = qs("#adminSignatureImage");
    const status = String(currentContract.status || "");
    const canReject = ["draft","user_signed","awaiting_admin"].includes(status);
    const alreadySigned = !!currentContract.admin_signature_path || status === "completed";

    if (rejectReason) rejectReason.value = currentContract.rejected_reason || "";
    if (rejectReasonView) {
      if (currentContract.rejected_reason) {
        rejectReasonView.classList.remove("hidden");
        rejectReasonView.innerHTML = `<strong>반려 사유</strong><br>${escapeHtmlInline(currentContract.rejected_reason)}`;
      } else {
        rejectReasonView.classList.add("hidden");
        rejectReasonView.innerHTML = "";
      }
    }

    if (alreadySigned) {
      if (img) { const swapped = swapUploadsUrl(currentContract.admin_signature_path); img.src = swapped; img.style.display = swapped ? "block" : "none"; }
      if (canvas) canvas.style.display = "none";
      if (signBtn) signBtn.style.display = "none";
      if (clearBtn) clearBtn.style.display = "none";
    } else if (status === "rejected") {
      if (img) img.style.display = "none";
      if (canvas) canvas.style.display = "none";
      if (signBtn) signBtn.style.display = "none";
      if (clearBtn) clearBtn.style.display = "none";
    } else {
      if (img) img.style.display = "none";
      if (canvas) canvas.style.display = "block";
      if (signBtn) signBtn.style.display = "";
      if (clearBtn) clearBtn.style.display = "";
      setTimeout(() => initCanvas(), 50);
    }

    if (rejectBtn) rejectBtn.style.display = canReject ? "" : "none";
    if (rejectReason) rejectReason.disabled = !canReject;

    loadAuditLogs(id);
    renderContractList();
  } catch (e) {
    toast(e.message || "계약 열기 실패", "bad");
  }
}

async function loadAuditLogs(id) {
  const box = qs("#auditLog");
  if (!box) return;
  try {
    const r = await api(`/api/admin/contracts/${id}/logs`);
    const logs = r?.logs || [];
    if (logs.length === 0) { box.innerHTML = "로그 없음"; return; }
    box.innerHTML = logs.map(l =>
      `<div>${l.created_at || "-"} | ${l.actor_type} | ${l.action_type}</div>`
    ).join("");
  } catch { box.innerHTML = "로그 없음"; }
}

function initCanvas() {
  const canvas = qs("#adminSignCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  ctx = newCanvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  newCanvas.addEventListener("pointerdown", e => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
  newCanvas.addEventListener("pointermove", e => { if (!drawing) return; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); });
  newCanvas.addEventListener("pointerup", () => drawing = false);
  newCanvas.addEventListener("pointerleave", () => drawing = false);
}

function clearCanvas() {
  const canvas = qs("#adminSignCanvas");
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  initCanvas();
}

async function adminSign() {
  if (!currentContract) return toast("계약을 선택하세요", "bad");
  const canvas = qs("#adminSignCanvas");
  if (!canvas) return;
  const dataUrl = canvas.toDataURL("image/png");
  const signedId = currentContract.id;
  try {
    await api(`/api/admin/contracts/${signedId}/admin-sign`, { method: "POST", body: { signature_data_url: dataUrl } });
    toast("양측 서명 완료", "good");
    currentContractState = "completed";
    syncContractStateTabs();
    await loadContracts(signedId);
  } catch (e) { toast(e.message || "서명 실패", "bad"); }
}

async function rejectContract() {
  if (!currentContract) return toast("계약을 선택하세요", "bad");
  const status = String(currentContract.status || "");
  if (!["draft","user_signed","awaiting_admin"].includes(status)) {
    return toast("현재 상태에서는 반려할 수 없습니다.", "bad");
  }
  const reason = String(qs("#rejectReason")?.value || "").trim();
  if (!reason) return toast("반려 사유를 입력하세요.", "bad");
  const msg = `이 계약을 반려하시겠습니까?

반려 시 해당 사용자의 투자 접수는 취소되고 금액은 자동 환불됩니다.
반려 사유: ${reason}`;
  if (!confirm(msg)) return;
  try {
    await api(`/api/admin/contracts/${currentContract.id}/void`, { method: "POST", body: { reason } });
    toast("계약 반려 완료", "good");
    currentContractState = "rejected";
    syncContractStateTabs();
    await loadContracts(currentContract.id);
  } catch (e) {
    toast(e.message || "계약 반려 실패", "bad");
  }
}

function downloadPdf() {
  if (!currentContract) return;
  if (!currentContract.finalized_pdf_path) {
    // (v893) PDF 미생성 케이스 — 운영자가 기존 (v893 이전) 서명 완료된
    //   계약을 다운로드 시도. 자동으로 재생성 시도 후 다시 다운로드.
    if (currentContract.status === "completed") {
      return regenerateAndDownloadPdf(currentContract.id);
    }
    return toast("현재 저장된 최종 PDF가 없습니다. 상세 화면에서 서명본을 확인하세요.", "bad");
  }
  // (v893) /uploads/* → /api/file/* swap.
  const path = String(currentContract.finalized_pdf_path);
  const swapped = path.startsWith("/uploads/")
    ? "/api/file/" + path.substring("/uploads/".length)
    : (path.startsWith("uploads/")
        ? "/api/file/" + path.substring("uploads/".length)
        : path);
  window.open(swapped);
}

async function regenerateAndDownloadPdf(contractId) {
  try {
    toast("PDF 재생성 중...", "good");
    const r = await api(`/api/admin/contracts/${contractId}/regenerate-pdf`, { method: "POST" });
    if (r?.finalized_pdf_path) {
      const swapped = r.finalized_pdf_path.startsWith("/uploads/")
        ? "/api/file/" + r.finalized_pdf_path.substring("/uploads/".length)
        : r.finalized_pdf_path;
      // 현재 컨텍스트 갱신
      currentContract.finalized_pdf_path = r.finalized_pdf_path;
      window.open(swapped);
    } else {
      toast("PDF 재생성에 실패했습니다.", "bad");
    }
  } catch (e) {
    toast(e?.message || "PDF 재생성 실패", "bad");
  }
}


/* ================================================================
   TAB 2: TEMPLATE MANAGEMENT
================================================================ */

async function loadAllAssets(force = false) {
  if (allAssets.length > 0 && !force) return;
  try {
    const r = await api("/api/admin/contract-templates/assets-list");
    allAssets = r?.assets || [];
  } catch { allAssets = []; }
}

async function loadTemplates() {
  try {
    const r = await api("/api/admin/contract-templates");
    templates = r?.templates || [];
    renderTemplateList();
  } catch (e) {
    toast(e.message || "\ud15c\ud50c\ub9bf \ubd88\ub7ec\uc624\uae30 \uc2e4\ud328", "bad");
  }
}

function renderTemplateList() {
  const list = qs("#tmplList");
  if (!list) return;

  if (templates.length === 0) {
    list.innerHTML = '<div class="muted" style="padding:20px;text-align:center">\ub4f1\ub85d\ub41c \ud15c\ud50c\ub9bf\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</div>';
    return;
  }

  list.innerHTML = "";
  for (const t of templates) {
    const div = document.createElement("div");
    div.className = "tmpl-item" + (editingTemplateId === t.id ? " selected" : "");

    const isActive = (t.is_active == 1);
    const badge = isActive
      ? '<span class="tmpl-badge on">\ud65c\uc131</span>'
      : '<span class="tmpl-badge off">\ube44\ud65c\uc131</span>';

    // (2026-05-17 v442) \uc790\uc0b0 \ub9e4\ud551 \ubc30\uc9c0 \uc81c\uac70 \u2014 \uc790\uc0b0\uc774 \ub2e8\uc77c\uc774\ub77c \ubd88\ud544\uc694. \uae30\ubcf8
    //   \ud15c\ud50c\ub9bf \ub77c\ubca8\ub9cc \uc720\uc9c0 (funding_subscription \ucf54\ub4dc\uc758 \uacbd\uc6b0).
    let assetBadgesHtml = "";
    if (t.template_code === "funding_subscription") {
      assetBadgesHtml = `<div style="margin-top:4px"><span class="tmpl-default-badge">\uae30\ubcf8 \ud15c\ud50c\ub9bf</span></div>`;
    }

    // (2026-05-17 v442) \ube44\ud65c\uc131 \ud15c\ud50c\ub9bf \uce74\ub4dc \uc606\uc5d0 '\ud65c\uc131\ud654' \ubc84\ud2bc \ucd94\uac00 \u2014 \ud074\ub9ad \uc2dc
    //   \uac19\uc740 template_code \uc758 \ub2e4\ub978 \ubaa8\ub4e0 row \ube44\ud65c\uc131\ud654 + \ubcf8\uc778\ub9cc \ud65c\uc131\ud654.
    //   \ud604\uc7ac active \uc778 \uce74\ub4dc\ub294 \ubc84\ud2bc \ub178\ucd9c X (\uc774\ubbf8 \ud65c\uc131).
    const activateBtnHtml = isActive
      ? ''
      : `<button class="btn tiny tmpl-activate-btn" data-id="${t.id}" type="button"
                 style="margin-left:6px; padding:2px 8px; font-size:11px;">\ud65c\uc131\ud654</button>`;

    div.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:700;font-size:13px">${t.template_name || t.template_code}</div>
        <div class="muted" style="font-size:11px">${t.template_code} v${t.version_no}</div>
        ${assetBadgesHtml}
      </div>
      <div style="display:flex; align-items:center; gap:4px">${badge}${activateBtnHtml}</div>
    `;
    // \uce74\ub4dc \ubcf8\ubb38 \ud074\ub9ad = \ud15c\ud50c\ub9bf \uc5f4\uae30.
    div.onclick = (e) => {
      // \ud65c\uc131\ud654 \ubc84\ud2bc \ud074\ub9ad\uc740 \uce74\ub4dc onclick \uc73c\ub85c propagate \uc2dc\ud0a4\uc9c0 \uc54a\uc74c.
      if (e.target.closest('.tmpl-activate-btn')) return;
      openTemplate(t.id);
    };
    list.appendChild(div);
  }

  // (2026-05-17 v442) \ud65c\uc131\ud654 \ubc84\ud2bc \ud074\ub9ad \ud578\ub4e4\ub7ec binding \u2014 \uce74\ub4dc \ub80c\ub354 \ud6c4 \uc77c\uad04.
  list.querySelectorAll('.tmpl-activate-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!id) return;
      const t = templates.find(x => String(x.id) === String(id));
      const codeLabel = t ? `${t.template_name || t.template_code} (v${t.version_no})` : id;
      if (!confirm(`'${codeLabel}' \uc744(\ub97c) \ud65c\uc131\ud654\ud569\ub2c8\ub2e4.\n\uac19\uc740 \uc885\ub958\uc758 \ub2e4\ub978 \ud15c\ud50c\ub9bf\uc740 \uc790\ub3d9\uc73c\ub85c \ube44\ud65c\uc131\ud654\ub429\ub2c8\ub2e4.\n\uc9c4\ud589\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?`)) return;
      try {
        await api(`/api/admin/contract-templates/${id}/activate`, { method: 'POST', body: {} });
        toast(`${codeLabel} \ud65c\uc131\ud654 \uc644\ub8cc`, 'good');
        await loadTemplates();
      } catch (err) {
        toast(err.message || '\ud65c\uc131\ud654 \uc2e4\ud328', 'bad');
      }
    });
  });
}

function newTemplate() {
  editingTemplateId = null;
  currentTemplate = null;

  if (qs("#tmplEditForm")) qs("#tmplEditForm").style.display = "block";
  if (qs("#tmplEmptyMsg")) qs("#tmplEmptyMsg").style.display = "none";
  if (qs("#tmplPreviewArea")) qs("#tmplPreviewArea").style.display = "none";
  if (qs("#tmplAssignSection")) qs("#tmplAssignSection").style.display = "none";

  qs("#tmplCode").value = "funding_subscription";
  qs("#tmplName").value = "";
  qs("#tmplTitle").value = "{{asset_name}} \ud22c\uc790 \uccad\uc57d \uc804\uc790\uacc4\uc57d\uc11c";
  qs("#tmplBodyHtml").value = defaultTemplateHtml();
  // (2026-05-17 v443) \uc601\ubb38 \uc785\ub825\uce78 \ucd08\uae30\uac12.
  if (qs("#tmplTitleEn")) qs("#tmplTitleEn").value = "{{asset_name}} Investment Subscription Agreement";
  if (qs("#tmplBodyHtmlEn")) qs("#tmplBodyHtmlEn").value = "";
  qs("#tmplIsActive").checked = true;
  qs("#tmplEditingId").textContent = "\uc0c8 \ud15c\ud50c\ub9bf";
  qs("#tmplCode").readOnly = false;
  if (qs("#tmplCloneBtn")) qs("#tmplCloneBtn").style.display = "none";

  renderTemplateList();
}

async function openTemplate(id) {
  try {
    const r = await api("/api/admin/contract-templates/" + id);
    currentTemplate = r?.template;
    if (!currentTemplate) throw new Error("\ud15c\ud50c\ub9bf \ub370\uc774\ud130 \uc5c6\uc74c");
    editingTemplateId = currentTemplate.id;

    if (qs("#tmplEditForm")) qs("#tmplEditForm").style.display = "block";
    if (qs("#tmplEmptyMsg")) qs("#tmplEmptyMsg").style.display = "none";
    if (qs("#tmplPreviewArea")) qs("#tmplPreviewArea").style.display = "none";

    qs("#tmplCode").value = currentTemplate.template_code || "";
    qs("#tmplCode").readOnly = true;
    qs("#tmplName").value = currentTemplate.template_name || "";
    qs("#tmplTitle").value = currentTemplate.template_title || "";
    qs("#tmplBodyHtml").value = currentTemplate.body_html || "";
    // (2026-05-17 v443) 영문 컬럼 채움. backend 가 SELECT * 라 자동 반환.
    if (qs("#tmplTitleEn")) qs("#tmplTitleEn").value = currentTemplate.template_title_en || "";
    if (qs("#tmplBodyHtmlEn")) qs("#tmplBodyHtmlEn").value = currentTemplate.body_html_en || "";
    qs("#tmplIsActive").checked = currentTemplate.is_active == 1;
    qs("#tmplEditingId").textContent = `ID: ${currentTemplate.id} \xb7 v${currentTemplate.version_no}`;
    if (qs("#tmplCloneBtn")) qs("#tmplCloneBtn").style.display = "";

    // Show assignment section
    await loadAllAssets();
    showAssignmentSection(editingTemplateId);

    renderTemplateList();
  } catch (e) {
    toast(e.message || "\ud15c\ud50c\ub9bf \uc5f4\uae30 \uc2e4\ud328", "bad");
  }
}

async function showAssignmentSection(templateId) {
  const section = qs("#tmplAssignSection");
  if (!section) return;
  // (2026-05-17 v442) 운영자 요청: '자산이 하나 밖에 없음으로 자산 연결이
  //   필요없다'. 적용 자산 관리 섹션을 영구 숨김. 아래 코드는 unreachable 이지만
  //   다른 곳에서 함수 호출이 있을 경우의 안전한 no-op 동작을 위해 유지.
  section.style.display = "none";
  return;
  // unreachable below — kept for backward compatibility only.
  // eslint-disable-next-line no-unreachable
  section.style.display = "block";

  const tmpl = templates.find(t => t.id == templateId);
  const assignedAssets = tmpl?.assigned_assets || [];

  const badgesContainer = qs("#tmplAssignedBadges");
  if (badgesContainer) {
    if (assignedAssets.length === 0) {
      badgesContainer.innerHTML = '<span class="muted" style="font-size:12px">\uc9c0\uc815\ub41c \uc790\uc0b0 \uc5c6\uc74c (\uae30\ubcf8 \ud15c\ud50c\ub9bf \uc0ac\uc6a9 \uc2dc \uc9c0\uc815 \ubd88\ud544\uc694)</span>';
    } else {
      // (2026-05-17 v441) language \ub77c\ubca8 \ud45c\uc2dc. backend \uac00 assigned_assets \uc548\uc5d0
      //   language \ud544\ub4dc\ub97c \ud568\uaed8 \ubc18\ud658. 'ko'/'en'/null \ubcc4 \ubc30\uc9c0 \ucc28\ubcc4\ud654.
      const langBadge = (lang) => {
        if (lang === 'ko') return '<span class="lang-tag" style="display:inline-block;padding:1px 6px;margin-left:6px;background:#3b82f6;color:white;border-radius:4px;font-size:10px;font-weight:700;">KO</span>';
        if (lang === 'en') return '<span class="lang-tag" style="display:inline-block;padding:1px 6px;margin-left:6px;background:#10b981;color:white;border-radius:4px;font-size:10px;font-weight:700;">EN</span>';
        return '<span class="lang-tag" style="display:inline-block;padding:1px 6px;margin-left:6px;background:#6b7280;color:white;border-radius:4px;font-size:10px;font-weight:700;">\uacf5\ud1b5</span>';
      };
      badgesContainer.innerHTML = assignedAssets.map(a => {
        const lang = a.language || null;
        const langStr = lang === null ? 'null' : String(lang);
        return `<span class="asset-badge">
          <span>${a.asset_id} \u00b7 ${a.asset_name || "?"}${langBadge(lang)}</span>
          <span class="remove-asset" data-asset-id="${a.asset_id}" data-lang="${langStr}" title="\uc5f0\uacb0 \ud574\uc81c">&times;</span>
        </span>`;
      }).join("");

      badgesContainer.querySelectorAll(".remove-asset").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const assetId = btn.dataset.assetId;
          const lang = btn.dataset.lang === 'null' ? null : btn.dataset.lang;
          const langLabel = lang === 'ko' ? '\ud55c\uad6d\uc5b4' : lang === 'en' ? '\uc601\ubb38' : '\uacf5\ud1b5';
          if (!confirm(`${assetId} \uc790\uc0b0\uc5d0\uc11c \uc774 \ud15c\ud50c\ub9bf(${langLabel})\uc744 \uc5f0\uacb0 \ud574\uc81c\ud569\ub2c8\uae4c?`)) return;
          try {
            await api(`/api/admin/assets/${encodeURIComponent(assetId)}/template/unassign`, {
              method: "POST",
              body: { language: lang }
            });
            toast(`${assetId} (${langLabel}) \uc5f0\uacb0 \ud574\uc81c \uc644\ub8cc`, "good");
            await loadTemplates();
            showAssignmentSection(templateId);
          } catch (err) { toast(err.message || "\uc5f0\uacb0 \ud574\uc81c \uc2e4\ud328", "bad"); }
        });
      });
    }
  }
}

async function assignAssetViaModal() {
  if (!editingTemplateId) return toast("\uba3c\uc800 \ud15c\ud50c\ub9bf\uc744 \uc120\ud0dd\ud558\uc138\uc694.", "bad");

  const tmpl = templates.find(t => t.id == editingTemplateId);
  // (2026-05-17 v441) language \ubcc4 \ubd84\ub9ac \ub9e4\ud551 \u2014 \uac19\uc740 \uc790\uc0b0 + \ub2e4\ub978 lang \ub9e4\ud551 \ud5c8\uc6a9.
  //   excludeIds \ub294 (asset_id + language) \uc870\ud569 \uae30\uc900\uc73c\ub85c \ub9cc\ub4e4\uc5b4\uc57c \ud558\uc9c0\ub9cc picker
  //   \uac00 asset_id \ub9cc \ub2e4\ub8e8\ubbc0\ub85c \uc77c\ub2e8 \ube44\uc6cc\ub450\uace0 backend \uac00 (asset_id, lang) \uc720\ub2c8\ud06c.
  const assetId = await openAssetPicker({
    title: "\uc790\uc0b0 \uc120\ud0dd",
    subtitle: "\uc774 \ud15c\ud50c\ub9bf\uc744 \uc801\uc6a9\ud560 \uc790\uc0b0\uc744 \uc120\ud0dd\ud558\uc138\uc694.",
    excludeIds: [],
  });

  if (!assetId) return;

  // language \uc120\ud0dd \u2014 \uac04\ub2e8\ud55c prompt \uc0ac\uc6a9. 'ko'/'en'/'\uacf5\ud1b5(null)'.
  const langInput = window.prompt(
    "\uc774 \ub9e4\ud551\uc758 \uc5b8\uc5b4\ub97c \uc120\ud0dd\ud558\uc138\uc694:\n  ko  = \ud55c\uad6d\uc5b4 \uc0ac\uc6a9\uc790 \uc804\uc6a9\n  en  = \uc601\ubb38 \uc0ac\uc6a9\uc790 \uc804\uc6a9\n  (\ube48\uac12) = \ubaa8\ub4e0 \uc5b8\uc5b4 \uacf5\ud1b5\n\n\uc785\ub825:",
    "ko"
  );
  if (langInput === null) return; // cancelled
  const langRaw = String(langInput || "").trim().toLowerCase();
  let language = null;
  if (langRaw === "ko" || langRaw === "en") language = langRaw;
  else if (langRaw !== "" && langRaw !== "\uacf5\ud1b5" && langRaw !== "null") {
    return toast("\uc5b8\uc5b4\ub294 ko / en / (\uacf5\ubc31=\uacf5\ud1b5) \uc911 \ud558\ub098\uc5ec\uc57c \ud569\ub2c8\ub2e4.", "bad");
  }

  try {
    await api(`/api/admin/assets/${encodeURIComponent(assetId)}/template/assign`, {
      method: "POST",
      body: { template_id: editingTemplateId, language }
    });
    const langLabel = language === 'ko' ? '\ud55c\uad6d\uc5b4' : language === 'en' ? '\uc601\ubb38' : '\uacf5\ud1b5';
    toast(`${assetId} (${langLabel})\uc5d0 \ud15c\ud50c\ub9bf \uc801\uc6a9 \uc644\ub8cc`, "good");
    await loadTemplates();
    showAssignmentSection(editingTemplateId);
  } catch (e) { toast(e.message || "\uc801\uc6a9 \uc2e4\ud328", "bad"); }
}

async function cloneTemplate() {
  if (!editingTemplateId) return toast("\uba3c\uc800 \ud15c\ud50c\ub9bf\uc744 \uc120\ud0dd\ud558\uc138\uc694.", "bad");

  const assetId = await openAssetPicker({
    title: "\ubcf5\uc81c \ub300\uc0c1 \uc790\uc0b0 \uc120\ud0dd",
    subtitle: "\uc790\uc0b0\uc744 \uc120\ud0dd\ud558\uba74 \ud574\ub2f9 \uc790\uc0b0 \uc804\uc6a9 \uacc4\uc57d\uc11c\ub85c \ubcf5\uc81c\ub429\ub2c8\ub2e4. \uc120\ud0dd\ud558\uc9c0 \uc54a\uace0 \ud655\uc778\ud558\uba74 \uc77c\ubc18 \ubcf5\uc81c\ub429\ub2c8\ub2e4.",
    excludeIds: [],
  });

  // assetId can be null (general clone) or a specific ID
  try {
    const body = {};
    if (assetId) body.asset_id = assetId;

    const r = await api(`/api/admin/contract-templates/${editingTemplateId}/clone`, {
      method: "POST",
      body
    });

    const msg = assetId
      ? `${assetId} \uc804\uc6a9 \uacc4\uc57d\uc11c \ubcf5\uc81c \uc644\ub8cc (${r.template_code} v${r.version_no})`
      : `\ud15c\ud50c\ub9bf \ubcf5\uc81c \uc644\ub8cc (${r.template_code} v${r.version_no})`;
    toast(msg, "good");

    await loadTemplates();
    if (r.id) openTemplate(r.id);
  } catch (e) { toast(e.message || "\ubcf5\uc81c \uc2e4\ud328", "bad"); }
}

async function saveTemplate() {
  const code = (qs("#tmplCode")?.value || "").trim();
  const name = (qs("#tmplName")?.value || "").trim();
  const title = (qs("#tmplTitle")?.value || "").trim();
  const bodyHtml = qs("#tmplBodyHtml")?.value || "";
  // (2026-05-17 v443) \uc601\ubb38 \ubcf8\ubb38 \uc785\ub825\uac12. \ube44\uc5b4\uc788\uc5b4\ub3c4 OK (KO \ubcf8\ubb38\uc774 \ud3f4\ubc31).
  const titleEn = (qs("#tmplTitleEn")?.value || "").trim();
  const bodyHtmlEn = qs("#tmplBodyHtmlEn")?.value || "";
  const isActive = qs("#tmplIsActive")?.checked ?? true;

  if (!code) return toast("\ud15c\ud50c\ub9bf \ucf54\ub4dc\ub97c \uc785\ub825\ud558\uc138\uc694.", "bad");
  if (!name) return toast("\ud15c\ud50c\ub9bf \uc774\ub984\uc744 \uc785\ub825\ud558\uc138\uc694.", "bad");
  if (!title) return toast("\uacc4\uc57d\uc11c \uc81c\ubaa9(\ud55c\uad6d\uc5b4) \uc744 \uc785\ub825\ud558\uc138\uc694.", "bad");
  if (!bodyHtml.trim()) return toast("\uacc4\uc57d\uc11c \ubcf8\ubb38(\ud55c\uad6d\uc5b4) \uc744 \uc785\ub825\ud558\uc138\uc694.", "bad");

  try {
    if (editingTemplateId) {
      await api(`/api/admin/contract-templates/${editingTemplateId}/update`, {
        method: "POST",
        body: {
          template_name: name,
          template_title: title,
          body_html: bodyHtml,
          template_title_en: titleEn,
          body_html_en: bodyHtmlEn,
          is_active: isActive,
        }
      });
      toast("\ud15c\ud50c\ub9bf \uc218\uc815 \uc644\ub8cc", "good");
    } else {
      const r = await api("/api/admin/contract-templates", {
        method: "POST",
        body: {
          template_code: code,
          template_name: name,
          template_title: title,
          body_html: bodyHtml,
          template_title_en: titleEn,
          body_html_en: bodyHtmlEn,
        }
      });
      editingTemplateId = r?.id || null;
      toast(`\ud15c\ud50c\ub9bf \uc0dd\uc131 \uc644\ub8cc (v${r?.version_no || 1})`, "good");
    }
    await loadTemplates();
    if (editingTemplateId) {
      await loadAllAssets();
      showAssignmentSection(editingTemplateId);
    }
  } catch (e) { toast(e.message || "\uc800\uc7a5 \uc2e4\ud328", "bad"); }
}

async function previewTemplate() {
  if (!editingTemplateId) {
    const title = (qs("#tmplTitle")?.value || "").replace(/\{\{(\w+)\}\}/g, (_, k) => sampleVars()[k] || `{{${k}}}`);
    const body = (qs("#tmplBodyHtml")?.value || "").replace(/\{\{(\w+)\}\}/g, (_, k) => sampleVars()[k] || `{{${k}}}`);
    showPreview(title, body);
    return;
  }
  try {
    const r = await api(`/api/admin/contract-templates/${editingTemplateId}/preview`, { method: "POST", body: {} });
    showPreview(r?.title || "", r?.body_html || "");
  } catch (e) { toast(e.message || "\ubbf8\ub9ac\ubcf4\uae30 \uc2e4\ud328", "bad"); }
}

function showPreview(title, body) {
  const area = qs("#tmplPreviewArea");
  if (area) area.style.display = "block";
  if (qs("#tmplPreviewTitle")) qs("#tmplPreviewTitle").textContent = title;
  if (qs("#tmplPreviewBody")) qs("#tmplPreviewBody").innerHTML = body;
}

function sampleVars() {
  return {
    signed_date_kst: "2026-03-26 15:30:00", wallet_address: "SaMpLeWaLLeTaDdReSs1234567890abcdefgh",
    asset_id: "APT001", asset_name: "\uc11c\uc6b8 \uac15\ub0a8 \uc624\ud53c\uc2a4\ud154 (\uc0d8\ud50c)", market: "KR-APT001",
    country_code: "KR", country_name: "\ub300\ud55c\ubbfc\uad6d", settlement_basis: "KRW", apr: "8.00",
    fund_end_date: "2026-06-30", amount_usdt: "1,000.000000", amount_local: "1,350,000.000000",
    fx_per_usdt: "1,350.000000", min_usdt: "50.000000", target_usdt: "100,000.000000",
  };
}

function defaultTemplateHtml() {
  return `<div class="contract-body">
  <h2 style="margin:0 0 14px">\ud22c\uc790 \uccad\uc57d \uc804\uc790\uacc4\uc57d\uc11c</h2>
  <p>\ubcf8 \uacc4\uc57d\uc740 <strong>{{signed_date_kst}}</strong> \uae30\uc900\uc73c\ub85c Recon RWA \ud50c\ub7ab\ud3fc\uacfc \uc544\ub798 \ud22c\uc790\uc790 \uc0ac\uc774\uc758 \uc804\uc790\uc801 \uccad\uc57d \uacc4\uc57d\uc785\ub2c8\ub2e4.</p>

  <h3 style="margin:22px 0 10px">1. \ud22c\uc790\uc790 \uc815\ubcf4</h3>
  <ul>
    <li>\uc9c0\uac11 \uc8fc\uc18c: {{wallet_address}}</li>
    <li>\uacc4\uc57d \uae30\uc900\uc2dc\uac01(KST): {{signed_date_kst}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">2. \ud22c\uc790 \ub300\uc0c1 \uc790\uc0b0</h3>
  <ul>
    <li>\uc790\uc0b0 ID: {{asset_id}}</li>
    <li>\uc790\uc0b0\uba85: {{asset_name}}</li>
    <li>\uc2dc\uc7a5\uba85: {{market}}</li>
    <li>\uad6d\uac00: {{country_name}}</li>
    <li>\uc815\uc0b0\ud1b5\ud654: {{settlement_basis}}</li>
    <li>\uc608\uc0c1 \uc5f0\uc774\uc728(APR): {{apr}}%</li>
    <li>\ubaa8\uae08\uae30\uac04 \uc885\ub8cc\uc77c: {{fund_end_date}}</li>
  </ul>

  <h3 style="margin:22px 0 10px">3. \uccad\uc57d \uae08\uc561</h3>
  <ul>
    <li>\uccad\uc57d\uae08\uc561(USDT): {{amount_usdt}} USDT</li>
    <li>\uc608\uc0c1 \ud604\uc9c0\ud1b5\ud654 \ud658\uc0b0\uc561: {{amount_local}} {{settlement_basis}}</li>
    <li>\uc801\uc6a9 \ud658\uc728: 1 USDT = {{fx_per_usdt}} {{settlement_basis}}</li>
    <li>\ucd5c\uc18c \ucc38\uc5ec\uae08\uc561: {{min_usdt}} USDT</li>
    <li>\ubaa9\ud45c \ubaa8\uc9d1\uae08\uc561: {{target_usdt}} USDT</li>
  </ul>

  <h3 style="margin:22px 0 10px">4. \ud22c\uc790 \uc720\uc758\uc0ac\ud56d</h3>
  <ol>
    <li>\ubcf8 \uc0c1\ud488\uc740 \uc6d0\uae08\uc774 \ubcf4\uc7a5\ub418\uc9c0 \uc54a\uc73c\uba70, \uc790\uc0b0 \uc6b4\uc601 \ubc0f \ub9e4\uac01 \uacb0\uacfc\uc5d0 \ub530\ub77c \uc190\uc2e4\uc774 \ubc1c\uc0dd\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</li>
    <li>\uc218\uc775, \uc774\uc790, \ub9e4\uac01 \uc815\uc0b0\uc740 \ub300\uc0c1 \uad6d\uac00\uc758 \uc815\uc0b0\ud1b5\ud654\ub97c \uae30\uc900\uc73c\ub85c \uacc4\uc0b0\ub418\uba70 \uc9c0\uae09 \uc2dc\uc810 \ud658\uc728\uc5d0 \ub530\ub77c USDT\ub85c \ud658\uc0b0\ub420 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</li>
    <li>\ubaa8\uc9d1 \uc644\ub8cc \uc2dc\uc810\uc758 \ud658\uc728 \ubc0f \ubc1c\ud589\ub7c9\uc774 \ud655\uc815\ub418\uba70, \uc774\ud6c4 \ubcc0\ub3d9\ub420 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.</li>
    <li>\ud50c\ub7ab\ud3fc\uc740 \uad00\ub828 \ubc95\ub839, \ub0b4\ubd80\ud1b5\uc81c, KYC/OTP \uc808\ucc28\uc5d0 \ub530\ub77c \ud22c\uc790 \ucc38\uc5ec\ub97c \uc81c\ud55c\ud558\uac70\ub098 \ubcf4\ub958\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</li>
  </ol>

  <h3 style="margin:22px 0 10px">5. \uc804\uc790\ubb38\uc11c \ubc0f \uc804\uc790\uc11c\uba85 \ub3d9\uc758</h3>
  <p>\ud22c\uc790\uc790\ub294 \ubcf8 \uacc4\uc57d\uc744 \uc804\uc790\ubb38\uc11c \ud615\ud0dc\ub85c \uc5f4\ub78c\ud558\uc600\uace0, \uc9c1\uc811 \uc785\ub825\ud55c \uc790\ud544 \uc804\uc790\uc11c\uba85 \ubc0f OTP \uac80\uc99d\uc744 \ud1b5\ud574 \ubcf8 \uacc4\uc57d\uc758 \ub0b4\uc6a9\uc5d0 \ub3d9\uc758\ud558\uba70, \uc774\ub294 \uc11c\uba74 \uc11c\uba85\uacfc \ub3d9\uc77c\ud55c \ud6a8\ub825\uc744 \uac00\uc9c0\ub294 \uac83\uc5d0 \ub3d9\uc758\ud569\ub2c8\ub2e4.</p>

  <h3 style="margin:22px 0 10px">6. \ud6a8\ub825 \ubc1c\uc0dd</h3>
  <p>\ubcf8 \uacc4\uc57d\uc740 \ud22c\uc790\uc790\uc758 \uc790\ud544 \uc804\uc790\uc11c\uba85\uacfc OTP \uac80\uc99d\uc774 \uc644\ub8cc\ub418\uace0, \uc2e4\uc81c \ubaa8\uae08 \ucc38\uc5ec\uac00 \uc815\uc0c1 \uc811\uc218\ub41c \uc2dc\uc810\uc5d0 \uc720\ud6a8 \uc811\uc218\ub429\ub2c8\ub2e4. \uc774\ud6c4 \uad00\ub9ac\uc790\uc758 \ucd5c\uc885 \uc790\ud544\uc11c\uba85\uc774 \uc644\ub8cc\ub418\uba74 \uacc4\uc57d \uc0c1\ud0dc\ub294 \uc644\ub8cc\ub85c \uc804\ud658\ub429\ub2c8\ub2e4.</p>
</div>`;
}

})();
