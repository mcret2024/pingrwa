(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  const COUNTRY_LABEL = {
    KR: "대한민국",
    US: "미국",
    KZ: "카자흐스탄",
    PH: "필리핀",
    GE: "조지아",
    ID: "인도네시아",
    VN: "베트남",
  };

  const CUR_LABEL = {
    KRW: "KRW",
    USD: "USD",
    KZT: "KZT",
    PHP: "PHP",
    GEL: "GEL",
    IDR: "IDR",
    VND: "VND",
  };

  const STATUS_TITLE = {
    활성: "운영 중",
    모집중: "운영 중",         // legacy alias — DB 마이그레이션 전후 모두 호환
    구매진행: "운영 중",       // legacy
    분배중: "운영 중",         // legacy
    운영중: "운영 중",         // legacy
    매각: "매각 진행",
    "매각(완료)": "매각 분배 완료",
    모집실패: "취소됨",
    취소됨: "취소됨",
  };

  // Silica 단순 상태머신: 매각 흐름은 wind-down (운영 종료) 모델로 대체되어
  //   폐기 됨. 자산 자체에 '매각'/'매각(완료)' 상태가 부여되는 경로 없음.
  //   투자 차단은 wind-down state (state !== 'active' 또는 staking_disabled_at
  //   설정) 가 담당 — frontend app.js 의 PAGES_BLOCKED_DURING_WINDDOWN 와
  //   backend 의 silicaIsServiceActive() / silicaIsStakingDisabled() 가드.
  // (2026-05-18 v479) 운영자 정정: '매각 폐기 했는데 NON_INVESTABLE 에
  //   잔재로 남아 차단 트리거됨'. '매각'/'매각(완료)' 제거 — 자산 status 가
  //   어떤 legacy 값이든 wind-down 만 보면 됨. 모집실패/취소됨 도 사실상
  //   사용되지 않으나 안전망으로 유지.
  const NON_INVESTABLE_STATUSES = new Set(["모집실패", "취소됨"]);
  const isInvestable = (status) => !NON_INVESTABLE_STATUSES.has(String(status || ""));

  const normalizeStatusForUi = (a) => {
    // 단순 모델: 단계 자동 전환 없음. 자산이 가진 상태값을 그대로 노출.
    return String(a?.status || "");
  };

  const normalizeAssetForUi = (a) => {
    if (!a) return a;
    return {
      ...a,
      status: normalizeStatusForUi(a)
    };
  };

  window.RwaPages["funding"] = async () => {
    console.log('[funding] RwaPages.funding() invoked — page handler started');
    const C = window.RwaCore;
    if (!C) {
      console.error('[funding] RwaCore not loaded');
      throw new Error("RwaCore(core.js)가 로드되지 않았습니다.");
    }
    console.log('[funding] RwaCore loaded:', typeof C);

    const I18N = window.RwaI18n || {};
    const t = (value) => {
      const raw = String(value ?? "");
      return typeof I18N.translateString === "function" ? I18N.translateString(raw) : raw;
    };
    const getLang = () => (typeof I18N.getLang === "function" ? I18N.getLang() : "ko");
    const tt = (ko, en, ja, zh) => {
      const lang = getLang();
      if (lang === "en") return en ?? ko;
      if (lang === "ja") return ja ?? ko;
      if (lang === "zh") return zh ?? ko;
      return ko;
    };

    const els = {
      select: C.qs("#fundAssetSelect"),

      fundDocsBtn: C.qs("#fundDocsBtn"),
      fundDetailBtn: C.qs("#fundDetailBtn"),

      fundPhaseNote: C.qs("#fundPhaseNote"),
      fundPhaseTitle: C.qs("#fundPhaseTitle"),
      fundPhaseDesc: C.qs("#fundPhaseDesc"),
      fundPhaseAction: C.qs("#fundPhaseAction"),

      fundStatus: C.qs("#fundStatus"),
      fundMarket: C.qs("#fundMarket"),
      fundCountry: C.qs("#fundCountry"),
      fundCurrency: C.qs("#fundCurrency"),
      fundAssetName: C.qs("#fundAssetName"),
      fundAssetImage: C.qs("#fundAssetImage"),

      fundPct: C.qs("#fundPct"),
      fundProgress: C.qs("#fundProgress"),
      fundRaised: C.qs("#fundRaised"),
      fundTarget: C.qs("#fundTarget"),
      fundMin: C.qs("#fundMin"),

      fundFxLine: C.qs("#fundFxLine"),
      fundFxHint: C.qs("#fundFxHint"),

      amount: C.qs("#fundAmount"),
      localCode: C.qs("#fundLocalCode"),
      localPreview: C.qs("#fundLocalPreview"),
      localHint: C.qs("#fundLocalHint"),

      contractStatusLabel: C.qs("#fundContractStatusLabel"),
      contractStatusDesc: C.qs("#fundContractStatusDesc"),
      contractMiniSummary: C.qs("#fundContractMiniSummary"),
      contractBtn: C.qs("#fundContractBtn"),
      contractViewBtn: C.qs("#fundContractViewBtn"),
      contractResetBtn: C.qs("#fundContractResetBtn"),

      otpCode: C.qs("#fundOtpCode"),

      refField: C.qs("#fundRefField"),
      refCode: C.qs("#fundRefCode"),
      refApplyBtn: C.qs("#fundRefApplyBtn"),
      refState: C.qs("#fundRefState"),

      maxBtn: C.qs("#fundMaxBtn"),
      fundBtn: C.qs("#fundBtn"),

      myFundingList: C.qs("#myFundingList"),
      myFundingTotalUsdt: C.qs("#myFundingTotalUsdt"),
      myFundingLocalCode: C.qs("#myFundingLocalCode"),
      myFundingTotalLocal: C.qs("#myFundingTotalLocal"),

      contractModal: C.qs("#contractModal"),
      contractBackdrop: C.qs("#contractModal .contract-backdrop"),
      contractModalTitle: C.qs("#contractModalTitle"),
      contractModalSub: C.qs("#contractModalSub"),
      contractMetaAsset: C.qs("#contractMetaAsset"),
      contractMetaAmount: C.qs("#contractMetaAmount"),
      contractMetaCurrency: C.qs("#contractMetaCurrency"),
      contractMetaNo: C.qs("#contractMetaNo"),
      contractDocBody: C.qs("#contractDocBody"),

      contractSignWrap: C.qs("#contractSignWrap"),
      contractSignerName: C.qs("#contractSignerName"),
      contractAgreeElectronic: C.qs("#contractAgreeElectronic"),
      contractAgreeSignature: C.qs("#contractAgreeSignature"),
      contractSignatureCanvas: C.qs("#contractSignatureCanvas"),
      contractClearSignBtn: C.qs("#contractClearSignBtn"),

      contractSignedViewBox: C.qs("#contractSignedViewBox"),
      contractSignedName: C.qs("#contractSignedName"),
      contractSignedAt: C.qs("#contractSignedAt"),
      contractSignedImage: C.qs("#contractSignedImage"),

      contractCloseBtn: C.qs("#contractCloseBtn"),
      contractModalXBtn: C.qs("#contractModalXBtn"),
      contractSaveBtn: C.qs("#contractSignSaveBtn"),

      contractHistoryModal: C.qs("#contractHistoryModal"),
      contractHistoryBackdrop: C.qs("#contractHistoryModal .contract-backdrop"),
      contractHistoryList: C.qs("#contractHistoryList"),
      contractHistoryHint: C.qs("#contractHistoryHint"),
      contractHistoryCloseBtn: C.qs("#contractHistoryCloseBtn"),
      contractHistoryCloseBtn2: C.qs("#contractHistoryCloseBtn2"),

      balanceShortage: C.qs("#fundBalanceShortage"),
      myBalance: C.qs("#fundMyBalance"),
      myBalanceRow: C.qs("#fundMyBalanceRow"),
      myBalanceDisplay: C.qs("#fundMyBalanceDisplay"),
    };

    if (!els.select) return;

    if (els.contractDocBody) {
      els.contractDocBody.setAttribute("data-no-i18n", "1");
      els.contractDocBody.setAttribute("translate", "no");
    }

    // ── OTP: HTML default=hidden. Show only when OTP is NOT bypassed ──
    (async () => {
      try {
        const cfg = (typeof C.getConfig === "function")
          ? await C.getConfig()
          : await C.api("/api/public/config", { auth: false });
        if (!cfg?.bypass_otp) {
          // OTP 활성 → 필드 보이기
          const f = C.qs("#fundOtpField");
          if (f) f.style.display = "";
          const s = C.qs("#contractOtpStep");
          if (s) s.style.display = "";
        }
      } catch {
        // config 실패 시 안전하게 OTP 표시(기본 보안)
        const f = C.qs("#fundOtpField");
        if (f) f.style.display = "";
        const s = C.qs("#contractOtpStep");
        if (s) s.style.display = "";
      }
    })();

    const pageState = {
      fundingRows: [],
      fundingTotalUsdt: 0,
      participatedByServer: false,
      uiSeq: 0,
      amountFieldMode: "normal",
      submittingFund: false,
    };

    const contractState = {
      item: null,
      list: [],
      modalMode: "view",
      signing: false,
    };

    const STORAGE_LAST_ASSET = "rwa_funding_last_asset_v1";
    // (2026-05-08) Resolved at call time so the toast/title reflects the
    //   current language. Using a function avoids capturing the lang at
    //   page-load — earlier the constant evaluated once in Korean and leaked
    //   on EN page reloads.
    const CONTRACT_RESET_GUIDE = () => tt(
      "계약이 작성 되었음으로 금액을 변경하기 위해서는 계약 다시 작성 버튼을 눌러 계약을 초기화 해주세요.",
      "A contract has already been drafted. To change the amount, click the Rewrite button to reset the contract.",
      "契約書が作成済みのため、金額を変更するには「再作成」ボタンを押して契約をリセットしてください。",
      "合同已起草。如需更改金额，请点击重写按钮重置合同。"
    );

    const sigPad = {
      bound: false,
      ctx: null,
      dirty: false,
      drawing: false,
    };

    const ACTIVE_FUNDING_CONTRACT_STATUSES = new Set(["draft", "user_signed", "awaiting_admin", "completed"]);
    const REUSABLE_FUNDING_CONTRACT_STATUSES = new Set(["draft", "user_signed"]);
    const SIGN_REQUIRED_CONTRACT_STATUSES = new Set(["draft"]);

    const modalState = {
      contractLastFocus: null,
      historyLastFocus: null,
    };

    const setModalVisibility = (el, visible) => {
      if (!el) return;
      el.classList.toggle("hidden", !visible);
      el.setAttribute("aria-hidden", visible ? "false" : "true");
      if (!visible) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    };

    // 초기화 시점에 모달 숨김 (TDZ 회피를 위해 선언 이후에 호출)
    setModalVisibility(els.contractModal, false);
    setModalVisibility(els.contractHistoryModal, false);

    const rememberFocus = () => (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const openLayer = (el, focusEl, stateKey) => {
      if (!el) return;
      if (stateKey) modalState[stateKey] = rememberFocus();
      setModalVisibility(el, true);
      window.setTimeout(() => {
        try {
          (focusEl || el).focus?.();
        } catch {}
      }, 10);
    };

    const closeLayer = (el, stateKey) => {
      if (!el) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && el.contains(active)) {
        try { active.blur(); } catch {}
      }
      setModalVisibility(el, false);
      const prev = stateKey ? modalState[stateKey] : null;
      if (stateKey) modalState[stateKey] = null;
      if (prev && typeof prev.focus === "function") {
        window.setTimeout(() => {
          try { prev.focus(); } catch {}
        }, 0);
      }
    };

    const sanitizeFundingContractRows = (rows) => (Array.isArray(rows) ? rows : []).filter((row) => {
      const st = String(row?.status || "");
      return row && row.id != null && ACTIVE_FUNDING_CONTRACT_STATUSES.has(st);
    });

    const setHTML = (el, html) => { if (el) el.innerHTML = html ?? ""; };
    const setText = (el, text) => { if (el) el.textContent = (text ?? "-"); };
    const setSrc = (el, src) => { if (el) el.setAttribute("src", C.assetImageUrl ? C.assetImageUrl(src || "") : (C.absUrl ? C.absUrl(src || "") : (src || ""))); };
    const setHref = (el, href) => { if (el) el.setAttribute("href", href || "#"); };

    const safeNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const sortContractList = (rows) => sanitizeFundingContractRows(rows)
      .slice()
      .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));

    const setContractList = (rows, preferredId = null) => {
      const merged = [];
      const seen = new Set();

      [...(Array.isArray(rows) ? rows : []), ...(contractState.item ? [contractState.item] : [])].forEach((row) => {
        const id = row?.id != null ? String(row.id) : "";
        if (!id || seen.has(id)) return;
        seen.add(id);
        merged.push(row);
      });

      contractState.list = sortContractList(merged);

      if (preferredId != null) {
        const preferred = contractState.list.find((row) => String(row?.id) === String(preferredId));
        if (preferred) contractState.item = preferred;
      } else if (contractState.item?.id) {
        const current = contractState.list.find((row) => String(row?.id) === String(contractState.item.id));
        if (current) contractState.item = current;
      }
    };

    const upsertContractListItem = (contract) => {
      if (!contract || contract.id == null) return;
      setContractList([contract, ...contractState.list], contract.id);
    };

    const contractStatusMeta = (status) => {
      const st = String(status || "");
      if (st === "draft") {
        return {
          label: tt("작성중", "Drafting", "作成中", "起草中"),
          desc: tt(
            "아직 사용자 서명이 완료되지 않은 계약입니다. 이어서 서명할 수 있습니다.",
            "User signature is not yet complete. You can continue signing this contract.",
            "ユーザー署名がまだ完了していない契約書です。引き続き署名できます。",
            "用户签名尚未完成。您可以继续签署该合同。"
          ),
        };
      }
      if (st === "user_signed") {
        return {
          label: tt("서명완료", "Signed", "署名済み", "已签名"),
          desc: tt(
            "사용자 서명이 완료되어 관리자 최종 체결을 기다리는 계약입니다.",
            "User signature complete. Awaiting administrator's final execution.",
            "ユーザー署名が完了し、管理者の最終締結を待っている契約です。",
            "用户签名已完成，正在等待管理员最终签署。"
          ),
        };
      }
      if (st === "awaiting_admin") {
        return {
          label: tt("관리자대기", "Awaiting Admin", "管理者待ち", "等待管理员"),
          desc: tt(
            "관리자 서명 대기 중인 계약입니다.",
            "This contract is awaiting administrator signature.",
            "管理者の署名待ちの契約書です。",
            "该合同正在等待管理员签名。"
          ),
        };
      }
      if (st === "completed") {
        return {
          label: tt("체결완료", "Executed", "締結完了", "已签署"),
          desc: tt(
            "사용자와 관리자 서명이 모두 완료된 체결 계약입니다.",
            "Both user and administrator signatures have been completed.",
            "ユーザーと管理者双方の署名が完了した締結済み契約です。",
            "用户与管理员双方签名均已完成的已签署合同。"
          ),
        };
      }
      if (st === "rejected") {
        return {
          label: tt("재작성필요", "Rewrite Required", "再作成が必要", "需要重写"),
          desc: tt(
            "이전 계약이 반려되어 다시 작성이 필요한 상태입니다.",
            "The previous contract was rejected and needs to be drafted again.",
            "前回の契約が却下されたため、再作成が必要な状態です。",
            "上一份合同已被驳回，需要重新起草。"
          ),
        };
      }
      return {
        label: st || "-",
        desc: tt(
          "계약 상세 내용을 열어 상태를 확인할 수 있습니다.",
          "Open the contract to view its current status.",
          "契約書を開いて状態を確認できます。",
          "打开合同即可查看状态。"
        ),
      };
    };

    const openContractHistoryModal = () => {
      const rows = contractState.list.length
        ? contractState.list
        : (contractState.item ? [contractState.item] : []);

      if (!rows.length) {
        C.toast(t("이 상품의 계약 이력이 없습니다."), "bad");
        return;
      }

      if (els.contractHistoryHint) {
        const selected = getSelected();
        const assetName = selected?.name ? `${selected.id} · ${selected.name}` : (selected?.id || tt("현재 상품", "Current asset", "現在の商品", "当前资产"));
        els.contractHistoryHint.textContent = tt(
          `${assetName}에 대해 제출하거나 체결한 계약 목록입니다. 열기 버튼으로 상세 내용을 확인할 수 있습니다.`,
          `This is the list of contracts submitted or executed for ${assetName}. Open a card to review the details.`,
          `${assetName}について提出または締結した契約一覧です。開くボタンから詳細を確認できます。`,
          `这是 ${assetName} 已提交或已签署的合同列表。点击打开即可查看详情。`
        );
      }

      if (els.contractHistoryList) {
        els.contractHistoryList.innerHTML = rows.map((row) => {
          const meta = contractStatusMeta(row?.status);
          const createdAt = row?.created_at ? C.fmt.time(row.created_at) : "-";
          const signedAt = row?.user_signed_at ? C.fmt.time(row.user_signed_at) : "";
          const amountText = `${C.fmt.num(row?.amount_usdt || 0, 2)} USDT`;
          const settlement = String(row?.settlement_basis || "-");
          const isCurrent = contractState.item?.id != null && String(contractState.item.id) === String(row?.id);
          const needsAction = SIGN_REQUIRED_CONTRACT_STATUSES.has(String(row?.status || ""));

          const descParts = [meta.desc];
          if (signedAt) descParts.push(tt(`사용자 서명: ${signedAt}`, `User signature: ${signedAt}`, `ユーザー署名: ${signedAt}`, `用户签名：${signedAt}`));
          if (row?.admin_signed_at) {
            const adminSignedAt = C.fmt.time(row.admin_signed_at);
            descParts.push(tt(`관리자 체결: ${adminSignedAt}`, `Admin execution: ${adminSignedAt}`, `管理者締結: ${adminSignedAt}`, `管理员签署：${adminSignedAt}`));
          }

          return `
            <div class="contract-history-card${needsAction ? ' needs-action' : ''}">
              <div class="contract-history-main">
                <div class="contract-history-title">
                  <span>${escapeHtml(String(row?.contract_no || `#${row?.id || "-"}`))}</span>
                  <span class="badge neutral">${escapeHtml(meta.label)}</span>
                  ${needsAction ? `<span class="badge warn">${escapeHtml(tt("서명 필요", "Signature required", "署名が必要", "需要签名"))}</span>` : ''}
                  ${isCurrent ? `<span class="badge neutral">${escapeHtml(t("현재 진행중"))}</span>` : ''}
                </div>
                <div class="contract-history-meta">
                  <span class="badge neutral">${escapeHtml(tt(`계약번호 ${String(row?.contract_no || "-")}`, `Contract No. ${String(row?.contract_no || "-")}`, `契約番号 ${String(row?.contract_no || "-")}`, `合同编号 ${String(row?.contract_no || "-")}`))}</span>
                  <span class="badge neutral">${escapeHtml(amountText)}</span>
                  <span class="badge neutral">${escapeHtml(settlement)}</span>
                  <span class="badge neutral">${escapeHtml(createdAt)}</span>
                </div>
                <div class="contract-history-desc">${escapeHtml(descParts.join(" · "))}</div>
              </div>
              <div class="contract-history-actions">
                <button type="button" class="btn small contract-history-open-btn" data-contract-id="${escapeHtml(String(row?.id || ""))}">${escapeHtml(t("열기"))}</button>
              </div>
            </div>
          `;
        }).join("");
      }

      openLayer(els.contractHistoryModal, els.contractHistoryCloseBtn, "historyLastFocus");
    };

    const closeContractHistoryModal = () => {
      closeLayer(els.contractHistoryModal, "historyLastFocus");
    };

    const openContractFromHistory = async (contractId) => {
      if (!contractId) return;

      try {
        const r = await C.api(`/api/contracts/${encodeURIComponent(contractId)}`, {
          method: "GET",
          auth: true,
        });

        if (!r?.contract) throw new Error(t("전자계약서를 불러오지 못했습니다."));

        const loadedContract = r.contract;
        const loadedStatus = String(loadedContract.status || "");
        const reusable = REUSABLE_FUNDING_CONTRACT_STATUSES.has(loadedStatus);

        upsertContractListItem(loadedContract);
        closeContractHistoryModal();

        if (reusable) {
          contractState.item = loadedContract;
          if (contractState.item && hydrateAmountFromContract(contractState.item, true)) {
            await updateLocalPreview();
          } else {
            renderContractState();
          }
        }

        if (loadedStatus === "draft" && reusable && contractMatchesCurrentSelection()) {
          openContractModal("sign", contractState.item);
        } else {
          openContractModal("view", reusable ? contractState.item : loadedContract);
        }
      } catch (e) {
        C.toast(e.message || t("전자계약서 조회 실패"), "bad");
      }
    };

    const fmtLocal = (n, ccy) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "-";
      return `${C.fmt.num(x, 0)} ${String(ccy || "").toUpperCase()}`;
    };

    const sameAmount = (a, b) => Math.abs(safeNum(a) - safeNum(b)) <= 0.000001;
    const normalizeOtp = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);
    const normalizeWholeAmountInput = (value) => {
      let raw = String(value || "").replace(/,/g, "").trim();
      if (!raw) return "";
      const dotIdx = raw.indexOf(".");
      if (dotIdx >= 0) raw = raw.slice(0, dotIdx);
      raw = raw.replace(/\D/g, "");
      raw = raw.replace(/^0+(?=\d)/, "");
      return raw;
    };
    const getEnteredAmount = () => {
      const normalized = normalizeWholeAmountInput(els.amount?.value || "");
      return normalized ? Number(normalized) : 0;
    };
    const getSelected = () => assets.find((a) => a.id === els.select.value) || null;
    const isStale = (seq) => seq !== pageState.uiSeq;
    const currentAssetId = () => String(getSelected()?.id || "");
    const readRememberedAssetId = () => {
      try {
        return String(localStorage.getItem(STORAGE_LAST_ASSET) || "").trim();
      } catch {
        return "";
      }
    };
    const writeRememberedAssetId = (assetId) => {
      try {
        if (assetId) localStorage.setItem(STORAGE_LAST_ASSET, String(assetId));
      } catch {}
    };
    const formatInputAmount = (value) => {
      const n = Math.trunc(safeNum(value));
      if (!(n > 0)) return "";
      return String(n);
    };
    const hydrateAmountFromContract = (contract, force = true) => {
      if (!els.amount || !contract) return false;
      if (String(contract.asset_id || "") !== currentAssetId()) return false;

      const st = String(contract.status || "");
      if (!["draft", "user_signed", "awaiting_admin", "completed", "rejected"].includes(st)) {
        return false;
      }

      const nextValue = formatInputAmount(contract.amount_usdt);
      if (!nextValue) return false;

      const currentValue = String(els.amount.value || "").replace(/,/g, "").trim();
      if (!force && currentValue) return false;

      els.amount.value = nextValue;
      return true;
    };

    const getConfig = async () => {
      if (typeof C.getConfig === "function") return await C.getConfig();
      return await C.api("/api/public/config", { auth: false });
    };

    // Check if OTP is bypassed from server config
    const isOtpBypassedFromConfig = async () => {
      try {
        const cfg = await getConfig();
        return !!cfg?.bypass_otp;
      } catch { return false; }
    };

    const getFxForAsset = async (a) => {
      const ccy = String(a?.settlement_basis || "KRW").toUpperCase();
      const fixed = !isInvestable(String(a?.status || "")) || (safeNum(a?.funded_snapshot_usdt) > 0);

      const cfg = await getConfig().catch(() => null);
      const fxRates = cfg?.fx_rates || null;

      const liveFx = safeNum(fxRates?.[ccy]);
      const fixedFx = safeNum(a?.fx_at_funding);

      const fx = fixed
        ? ((fixedFx > 0) ? fixedFx : liveFx)
        : ((liveFx > 0) ? liveFx : fixedFx);

      return { ccy, fx, fixed };
    };

    let assets = ((await C.getAssetsCached().catch(() => [])) || [])
      .map(normalizeAssetForUi)
      .slice()
      .sort((a, b) => C.statusOrder(a.status) - C.statusOrder(b.status));

    els.select.innerHTML = assets
      .map((a) => `<option value="${String(a.id).replace(/"/g, "&quot;")}">${a.id} · ${a.name}</option>`)
      .join("");

    const fromQuery = C.getParam("id");
    if (fromQuery && assets.some((a) => a.id === fromQuery)) {
      els.select.value = fromQuery;
    } else {
      const rememberedAssetId = readRememberedAssetId();
      if (rememberedAssetId && assets.some((a) => a.id === rememberedAssetId)) {
        els.select.value = rememberedAssetId;
      }
    }

    // assets.html 에서 ?amount=N 으로 진입한 경우 자동 prefill
    // (사장님 정책: 1 이상의 양의 정수만 허용)
    try {
      const amtParam = C.getParam("amount");
      if (amtParam && els.amount) {
        const cleaned = String(amtParam).replace(/[^0-9]/g, "");
        const n = parseInt(cleaned, 10);
        if (Number.isFinite(n) && n > 0) {
          els.amount.value = String(n);
        }
      }
    } catch (_) {}

    const updateContractSaveButtonState = () => {
      if (!els.contractSaveBtn) return;

      const canSave =
        contractState.modalMode === "sign" &&
        !!String(els.contractSignerName?.value || "").trim() &&
        !!els.contractAgreeElectronic?.checked &&
        !!els.contractAgreeSignature?.checked &&
        !!sigPad.dirty;

      els.contractSaveBtn.disabled = !canSave;
    };

    const contractMatchesCurrentSelection = () => {
      const c = contractState.item;
      const a = getSelected();
      if (!c || !a) return false;
      if (String(c.asset_id || "") !== String(a.id || "")) return false;
      return sameAmount(c.amount_usdt, getEnteredAmount());
    };

    const isParticipatedOnCurrentAsset = () => {
      const st = String(contractState.item?.status || "");
      return st === "awaiting_admin" || st === "completed";
    };

    let amountLockToastAt = 0;
    const notifyContractLockedAmount = () => {
      if (pageState.amountFieldMode !== "contract_locked") return;
      const now = Date.now();
      if (now - amountLockToastAt < 1200) return;
      amountLockToastAt = now;
      C.toast(CONTRACT_RESET_GUIDE());
    };

    const setReferralFieldHidden = (hidden) => {
      if (els.refField) els.refField.style.display = hidden ? "none" : "";
    };

    const setAmountFieldMode = (mode, opts = {}) => {
      pageState.amountFieldMode = mode;
      if (!els.amount) return;

      const opacity = Object.prototype.hasOwnProperty.call(opts, "opacity")
        ? opts.opacity
        : (mode === "normal" ? "" : "0.65");

      els.amount.disabled = mode === "disabled";
      els.amount.readOnly = mode === "contract_locked";
      els.amount.style.opacity = opacity;
      els.amount.style.cursor = mode === "contract_locked" ? "pointer" : "";
      els.amount.title = mode === "contract_locked" ? CONTRACT_RESET_GUIDE() : "";
      els.amount.dataset.lockMode = mode;
      if (mode !== "contract_locked") amountLockToastAt = 0;
    };

    const buildContractSummaryHtml = (c) => {
      if (!c) return "";
      const tags = [];
      tags.push(`<span class="badge neutral">${escapeHtml(tt(`계약번호 ${String(c.contract_no || "-")}`, `Contract No. ${String(c.contract_no || "-")}`, `契約番号 ${String(c.contract_no || "-")}`, `合同编号 ${String(c.contract_no || "-")}`))}</span>`);
      tags.push(`<span class="badge neutral">${escapeHtml(`${C.fmt.num(c.amount_usdt || 0, 2)} USDT`)}</span>`);
      tags.push(`<span class="badge neutral">${escapeHtml(String(c.settlement_basis || "-"))}</span>`);
      return tags.join("");
    };

    /** Lock/unlock amount, asset select, and max button based on contract state */
    const lockAmountInputs = (locked) => {
      setAmountFieldMode(locked ? "contract_locked" : "normal");
      if (els.select) els.select.disabled = locked;
      if (els.maxBtn) els.maxBtn.disabled = locked;
    };

    const renderContractState = () => {
      const a = getSelected();
      const w = C.getWallet();
      const c = contractState.item;
      const enteredAmt = getEnteredAmount();
      const st = String(c?.status || "");

      if (els.contractMiniSummary) {
        els.contractMiniSummary.innerHTML = c ? buildContractSummaryHtml(c) : "";
      }

      if (els.contractViewBtn) els.contractViewBtn.classList.toggle("hidden", !(contractState.list.length || c));
      if (els.contractResetBtn) {
        const resetVisible = !!(c && REUSABLE_FUNDING_CONTRACT_STATUSES.has(st));
        els.contractResetBtn.classList.toggle("hidden", !resetVisible);
      }

      if (els.contractBtn) {
        els.contractBtn.disabled = !w?.connected || !a || !isInvestable(String(a.status || "")) || !(enteredAmt > 0);
      }

      updateContractSaveButtonState();

      /* (2026-05-08) Always pass false — the amount/asset/MAX inputs stay
         editable regardless of an active draft / user_signed contract. The
         backend /api/contracts/draft cascade-discards previous drafts on
         every PARTICIPATE click, so re-editing is safe. Earlier behavior
         kept showing the "이미 작성되었습니다 — Rewrite" toast on every
         focus / click of the amount field even after the v131 fix
         disabled the broader contract_locked guard. */
      lockAmountInputs(false);

      if (!w?.connected) {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, tt("지갑 연결 필요", "Wallet Connection Required", "ウォレット接続が必要", "需要连接钱包"));
        setText(els.contractStatusDesc, tt(
          "지갑을 연결한 후 투자 청약 전자계약서를 작성할 수 있습니다.",
          "Connect your wallet to draft the investment subscription contract.",
          "ウォレットを接続後、投資申込の電子契約書を作成できます。",
          "连接钱包后即可起草投资认购电子合同。"
        ));
        return;
      }

      if (!a) {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, tt("자산 선택 필요", "Select an Asset", "資産を選択してください", "请选择资产"));
        setText(els.contractStatusDesc, tt(
          "자산을 먼저 선택하세요.",
          "Please select an asset first.",
          "先に資産を選択してください。",
          "请先选择资产。"
        ));
        return;
      }


      if (!isInvestable(String(a.status || ""))) {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, tt("작성 불가", "Drafting Unavailable", "作成不可", "无法起草"));
        setText(els.contractStatusDesc, tt(
          "현재 단계에서는 신규 전자계약서 작성 및 모금 참여가 불가합니다.",
          "New electronic contracts and participation are not available at this stage.",
          "現段階では新規電子契約書の作成および参加はできません。",
          "当前阶段无法起草新合同或参与募集。"
        ));
        return;
      }

      if (c && st === "awaiting_admin") {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, tt("관리자 서명 대기", "Awaiting Admin Signature", "管理者署名待ち", "等待管理员签名"));
        setText(els.contractStatusDesc, tt(
          "최근 참여 신청 건입니다. 관리자 서명이 완료되면 모금액에 확정 반영됩니다.",
          "Your recent participation request is on file. Once the administrator signs, it will be finalized in the funded amount.",
          "直近の参加申請です。管理者の署名が完了すると、募集額に確定反映されます。",
          "您最近的参与申请，管理员签名完成后将计入募集金额。"
        ));
        return;
      }

      if (c && st === "completed") {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, t("참여 확정 완료"));
        setText(els.contractStatusDesc, t("양측 서명이 완료되어 모금에 확정 반영된 계약입니다."));
        return;
      }

      if (!(enteredAmt > 0)) {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, t("금액 입력 필요"));
        setText(els.contractStatusDesc, t("참여 금액을 먼저 입력한 후 전자계약서를 작성하세요."));
        return;
      }

      if (!c) {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, t("미작성"));
        setText(els.contractStatusDesc, t("참여 전에 전자계약서를 먼저 작성하고 자필서명을 완료해야 합니다."));
        return;
      }

      if ((st === "draft" || st === "user_signed") && !contractMatchesCurrentSelection()) {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, tt("재작성 필요", "Rewrite Required", "再作成が必要", "需要重写"));
        setText(els.contractStatusDesc, tt(
          "입력 금액이 변경되어 기존 전자계약서를 그대로 사용할 수 없습니다. 다시 작성하세요.",
          "The amount has changed, so the existing contract can no longer be used. Please draft a new one.",
          "入力金額が変更されたため、既存の電子契約書はそのまま使用できません。再作成してください。",
          "输入金额已更改，无法继续使用现有合同。请重新起草。"
        ));
        return;
      }

      if (st === "draft") {
        setText(els.contractStatusLabel, tt("초안 생성됨 (금액 확정)", "Draft Created (Amount Locked)", "下書き作成済み（金額確定）", "草稿已创建（金额已锁定）"));
        setText(els.contractStatusDesc, tt(
          "계약 내용을 검토하고 자필 전자서명을 완료하세요. 금액 변경 시 '다시 작성' 버튼을 이용하세요.",
          "Review the contract and complete the handwritten electronic signature. To change the amount, use the Rewrite button.",
          "契約内容を確認の上、手書き電子署名を完了してください。金額を変更するには「再作成」ボタンを使用します。",
          "请检查合同内容并完成手写电子签名。如需更改金额，请点击重写按钮。"
        ));
        return;
      }

      if (st === "user_signed") {
        setText(els.contractStatusLabel, tt("사용자 서명 완료 ✓", "User Signature Complete ✓", "ユーザー署名完了 ✓", "用户签名已完成 ✓"));
        // Check if OTP is bypassed to show appropriate message
        isOtpBypassedFromConfig().then(bypassed => {
          if (bypassed) {
            setText(els.contractStatusDesc, tt(
              "전자계약서 서명이 완료되었습니다. 참여하기 버튼을 눌러주세요.",
              "Contract signature complete. Click the Participate button to continue.",
              "電子契約書の署名が完了しました。「参加する」ボタンを押してください。",
              "电子合同签名已完成。请点击参与按钮。"
            ));
          } else {
            setText(els.contractStatusDesc, tt(
              "전자계약서 서명이 완료되었습니다. OTP 입력 후 참여하기를 실행하세요.",
              "Contract signature complete. Enter your OTP, then click Participate.",
              "電子契約書の署名が完了しました。OTPを入力してから「参加する」を実行してください。",
              "电子合同签名已完成。请输入OTP后点击参与。"
            ));
          }
        }).catch(() => {});
        return;
      }

      if (st === "rejected") {
        lockAmountInputs(false);
        setText(els.contractStatusLabel, tt("재작성 필요", "Rewrite Required", "再作成が必要", "需要重写"));
        setText(els.contractStatusDesc, tt(
          "이전 계약서를 다시 작성해야 합니다.",
          "The previous contract must be drafted again.",
          "前回の契約書を再作成する必要があります。",
          "需要重新起草上一份合同。"
        ));
        return;
      }

      lockAmountInputs(false);
      setText(els.contractStatusLabel, tt("미작성", "Not Drafted", "未作成", "未起草"));
      setText(els.contractStatusDesc, tt(
        "참여 전에 전자계약서를 먼저 작성하고 자필서명을 완료해야 합니다.",
        "Before participating, you must draft the electronic contract and complete the handwritten signature.",
        "参加前に電子契約書を作成し、手書き署名を完了する必要があります。",
        "参与前必须先起草电子合同并完成手写签名。"
      ));
    };

    const closeContractModal = () => {
      if (!els.contractModal) return;
      contractState.modalMode = "view";
      // 모달이 서명 미완료 상태로 닫히면 pendingInvestment 무효화 → 사용자가 다시 입력해야 안전.
      // signing 처리 중에는 닫혀도 (성공 직후 closeContractModal 호출) pending 유지가 필요할 수 있으나,
      // 그 케이스에서는 runInvestmentAfterContract 가 이미 pending 을 직접 null 로 비웠으므로 안전.
      contractState.pendingInvestment = null;
      closeLayer(els.contractModal, "contractLastFocus");
      updateContractSaveButtonState();
    };

    const resizeSignatureCanvas = () => {
      const canvas = els.contractSignatureCanvas;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);

      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));

      const ctx = canvas.getContext("2d");
      sigPad.ctx = ctx;

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#111827";

      sigPad.dirty = false;
      sigPad.drawing = false;
      updateContractSaveButtonState();
    };

    const clearSignatureCanvas = () => {
      const canvas = els.contractSignatureCanvas;
      const ctx = sigPad.ctx;
      if (!canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);

      sigPad.dirty = false;
      sigPad.drawing = false;
      updateContractSaveButtonState();
    };

    const bindSignaturePad = () => {
      if (sigPad.bound || !els.contractSignatureCanvas) return;
      sigPad.bound = true;

      const canvas = els.contractSignatureCanvas;

      const pointOf = (e) => {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };

      const start = (e) => {
        if (contractState.modalMode !== "sign") return;
        if (!sigPad.ctx) return;

        e.preventDefault();

        if (canvas.setPointerCapture && e.pointerId != null) {
          canvas.setPointerCapture(e.pointerId);
        }

        const p = pointOf(e);
        sigPad.drawing = true;
        sigPad.ctx.beginPath();
        sigPad.ctx.moveTo(p.x, p.y);
      };

      const move = (e) => {
        if (contractState.modalMode !== "sign") return;
        if (!sigPad.drawing || !sigPad.ctx) return;

        e.preventDefault();

        const p = pointOf(e);
        sigPad.ctx.lineTo(p.x, p.y);
        sigPad.ctx.stroke();
        sigPad.dirty = true;
        updateContractSaveButtonState();
      };

      const end = (e) => {
        if (e) e.preventDefault();
        sigPad.drawing = false;
        updateContractSaveButtonState();
      };

      canvas.addEventListener("pointerdown", start);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointerleave", end);
      canvas.addEventListener("pointercancel", end);
    };

    const openContractModal = (mode, contract) => {
      if (!els.contractModal || !contract) return;

      contractState.modalMode = mode;

      const _curLang = getLang();
      const _selectedAsset = getSelected();
      // (2026-05-17 v449) 운영자 보고: '모달 헤더와 Asset 카드의 자산명이 admin
      //   자산편집에서 설정한 값으로 표기되어야 한다 (하드코딩 X)'. 기존 함수가
      //   SILICA-79907 에 대해 'High-Purity Silica Mine' 을 하드코딩 → admin 이
      //   다른 영문명 입력해도 무시됨.
      //   수정: backend (contracts.php /api/contracts/:id, v449 다국어 후처리) 가
      //   asset_name_en / asset_name_ko 를 응답에 포함. 그 값을 우선 사용.
      //   fallback: 선택된 asset 객체의 name_en/name_ko (assets.html silica-data-bind
      //   가 채움) → contract.asset_name (legacy) → asset.name → asset.id.
      const _localizedAssetName = (asset, lang, ctr) => {
        if (lang === "en") {
          return (ctr && ctr.asset_name_en) || (asset && asset.name_en) ||
                 (ctr && ctr.asset_name) || (asset && asset.name) ||
                 (asset && asset.id) || "-";
        }
        return (ctr && ctr.asset_name_ko) || (asset && asset.name_ko) ||
               (ctr && ctr.asset_name) || (asset && asset.name) ||
               (asset && asset.id) || "-";
      };
      const _assetDisplayName = _localizedAssetName(_selectedAsset, _curLang, contract);
      // (2026-05-17 v449) 모달 헤더 — backend 가 이미 lang 별 contract_title 을
      //   박아둠 (v444 의 _en 컬럼 dispatch + v446 의 asset_name 변수 치환).
      //   즉 contract.contract_title 자체가 admin 입력 영문/한국어 자산명을
      //   포함한 완성된 제목. frontend 합성 로직 제거.
      const _titleText = contract.contract_title || (
        _curLang === "en"
          ? `${_assetDisplayName} Investment Subscription Agreement`
          : `${_assetDisplayName} 투자 청약 전자계약서`
      );
      setText(els.contractModalTitle, _titleText);
      setText(
        els.contractModalSub,
        mode === "sign"
          ? tt(
              "계약 내용을 검토한 후 자필 전자서명을 완료하세요.",
              "Review the contract details, then complete your handwritten electronic signature.",
              "契約内容を確認のうえ、手書きの電子署名を完了してください。",
              "请在确认合同内容后完成手写电子签名。"
            )
          : tt(
              "작성된 전자계약서 내용입니다.",
              "Signed electronic contract details.",
              "作成済みの電子契約書の内容です。",
              "已签署的电子合同详情。"
            )
      );
      setText(els.contractMetaAsset, `${contract.asset_id} · ${_assetDisplayName}`);
      setText(els.contractMetaAmount, `${C.fmt.num(contract.amount_usdt || 0, 2)} USDT`);
      setText(els.contractMetaCurrency, String(contract.settlement_basis || "-"));
      setText(els.contractMetaNo, String(contract.contract_no || "-"));
      setHTML(els.contractDocBody, contract.contract_body_html || "");
      if (els.contractDocBody) {
        els.contractDocBody.setAttribute("data-no-i18n", "1");
        els.contractDocBody.setAttribute("translate", "no");
      }

      const signMode = mode === "sign";

      if (els.contractSignWrap) els.contractSignWrap.classList.toggle("hidden", !signMode);
      if (els.contractSaveBtn) els.contractSaveBtn.classList.toggle("hidden", !signMode);
      if (els.contractSignedViewBox) els.contractSignedViewBox.classList.toggle("hidden", signMode);

      if (signMode) {
        if (els.contractSignerName) els.contractSignerName.value = String(contract.signer_name || "");
        if (els.contractAgreeElectronic) els.contractAgreeElectronic.checked = !!Number(contract.consent_electronic || 0);
        if (els.contractAgreeSignature) els.contractAgreeSignature.checked = !!Number(contract.consent_signature || 0);

        openLayer(els.contractModal, els.contractModalXBtn || els.contractCloseBtn, "contractLastFocus");

        requestAnimationFrame(() => {
          resizeSignatureCanvas();
          bindSignaturePad();
          updateContractSaveButtonState();
        });
      } else {
        setText(els.contractSignedName, contract.signer_name || "-");
        setText(els.contractSignedAt, contract.user_signed_at ? C.fmt.time(contract.user_signed_at) : "-");

        if (els.contractSignedImage) {
          els.contractSignedImage.onerror = () => {
            els.contractSignedImage.style.display = "none";
          };

          if (contract.user_signature_path) {
            setSrc(els.contractSignedImage, contract.user_signature_path);
            els.contractSignedImage.style.display = "";
          } else {
            els.contractSignedImage.removeAttribute("src");
            els.contractSignedImage.style.display = "none";
          }
        }

        openLayer(els.contractModal, els.contractModalXBtn || els.contractCloseBtn, "contractLastFocus");
        updateContractSaveButtonState();
      }
    };

    const setParticipatedUi = (participated) => {
      if (!participated) return;

      if (els.fundBtn) els.fundBtn.disabled = true;
      if (els.contractBtn) els.contractBtn.disabled = true;
      if (els.amount) {
        els.amount.disabled = true;
        els.amount.placeholder = tt(
          "이미 참여한 자산입니다.",
          "You have already participated in this asset.",
          "すでに参加した資産です。",
          "您已参与该资产。"
        );
        els.amount.style.opacity = "0.65";
      }
      if (els.select) els.select.disabled = true;
      if (els.maxBtn) els.maxBtn.disabled = true;
      if (els.otpCode) els.otpCode.disabled = true;
      if (els.refCode) els.refCode.disabled = true;
      if (els.refApplyBtn) els.refApplyBtn.disabled = true;

      if (els.contractStatusLabel) {
        els.contractStatusLabel.textContent = tt(
          "이미 참여 완료",
          "Already Participated",
          "参加済み",
          "已参与"
        );
      }

      if (els.contractStatusDesc) {
        els.contractStatusDesc.textContent = tt(
          "이미 해당 자산 모금에 참여하셨습니다.",
          "You have already participated in funding for this asset.",
          "すでにこの資産の募集に参加しています。",
          "您已参与该资产的募集。"
        );
      }

      if (els.refState) {
        els.refState.textContent = tt(
          "이미 참여한 자산은 추천인 코드를 변경할 수 없습니다.",
          "Once you've participated, the referrer code cannot be changed.",
          "参加済みの資産では紹介コードを変更できません。",
          "已参与的资产无法更改推荐人代码。"
        );
      }
    };

    const renderPhaseNote = (a) => {
      if (!els.fundPhaseNote || !els.fundPhaseTitle || !els.fundPhaseDesc) return;

      if (els.fundPhaseAction) els.fundPhaseAction.innerHTML = "";

      if (!a || isInvestable(a.status)) {
        els.fundPhaseNote.classList.add("hidden");
        return;
      }

      els.fundPhaseNote.classList.remove("hidden");

      const st = String(a.status || "");
      const title = STATUS_TITLE[st] || st || "-";

      els.fundPhaseTitle.textContent = title;

      // Silica 단순 상태머신: legacy 구매진행/분배중/운영중 = 모두 정상 운영(=ACTIVE).
      // 하나의 안내문 + 동일 액션으로 통합. 별도 "토큰 받기" CTA 없음 (자동 분배).
      const portfolioLabel = tt("포트폴리오", "Portfolio", "ポートフォリオ", "投资组合");
      const stakingLabel = tt("스테이킹", "Staking", "ステーキング", "质押");
      const assetDetailLabel = tt("자산 상세", "Asset Detail", "資産詳細", "资产详情");
      if (st === "구매진행" || st === "분배중" || st === "운영중" || st === "활성") {
        els.fundPhaseDesc.textContent = tt(
          "운영 중입니다. 보유 SilicaSTO는 포트폴리오에서 즉시 확인할 수 있으며, 스테이킹 / 이자·배당 클레임 / 외부 출금이 가능합니다.",
          "Operating. Your SilicaSTO holdings are visible in the portfolio, and staking / interest & dividend claims / external withdrawals are available.",
          "運営中です。保有するSilicaSTOはポートフォリオで即時確認でき、ステーキング・利息/配当クレーム・外部出金が可能です。",
          "运营中。您持有的 SilicaSTO 可在投资组合中即时查看，并可进行质押 / 利息·分红领取 / 外部提取。"
        );
        if (els.fundPhaseAction) {
          els.fundPhaseAction.innerHTML = `
            <a class="btn small primary" href="portfolio.html">${escapeHtml(portfolioLabel)}</a>
            <a class="btn small" href="staking.html?id=${encodeURIComponent(a.id)}">${escapeHtml(stakingLabel)}</a>
            <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">${escapeHtml(assetDetailLabel)}</a>
          `;
        }
      } else if (st === "매각") {
        els.fundPhaseDesc.textContent = tt(
          "매각 정산 단계입니다. 보유 토큰을 반환하고 차익(USDT)을 수령합니다.",
          "Sale settlement is in progress. Return your tokens to receive the gains (USDT).",
          "売却精算段階です。保有トークンを返却し、差益（USDT）を受け取ります。",
          "进入出售结算阶段。返还您持有的代币即可领取差额（USDT）。"
        );
        if (els.fundPhaseAction) {
          const saleLabel = tt("매각 차익 받기", "Receive Sale Gains", "売却差益を受け取る", "领取出售差额");
          els.fundPhaseAction.innerHTML = `
            <a class="btn small primary" href="sale-detail.html?id=${encodeURIComponent(a.id)}">${escapeHtml(saleLabel)}</a>
            <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">${escapeHtml(assetDetailLabel)}</a>
          `;
        }
      } else if (st === "모집실패") {
        els.fundPhaseDesc.textContent = tt(
          "모집 실패 자산입니다. 환불 조건을 확인하세요.",
          "Funding failed for this asset. Please review the refund terms.",
          "募集失敗の資産です。返金条件をご確認ください。",
          "该资产募集失败。请查看退款条件。"
        );
        if (els.fundPhaseAction) {
          const refundLabel = tt("환불/내역", "Refunds / History", "返金・履歴", "退款 / 记录");
          els.fundPhaseAction.innerHTML = `
            <a class="btn small primary" href="#fundingHistorySection">${escapeHtml(refundLabel)}</a>
            <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">${escapeHtml(assetDetailLabel)}</a>
          `;
        }
      } else if (st === "취소됨") {
        els.fundPhaseDesc.textContent = tt(
          "매입이 취소된 자산입니다. 투자 USDT 환불 및 참여 내역을 확인하세요.",
          "Purchase has been cancelled. Please check the USDT refund and participation history.",
          "購入がキャンセルされた資産です。投資USDTの返金および参加履歴をご確認ください。",
          "购买已取消。请查看 USDT 退款及参与记录。"
        );
        if (els.fundPhaseAction) {
          const refundLabel = tt("환불/내역", "Refunds / History", "返金・履歴", "退款 / 记录");
          els.fundPhaseAction.innerHTML = `
            <a class="btn small primary" href="#fundingHistorySection">${escapeHtml(refundLabel)}</a>
            <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">${escapeHtml(assetDetailLabel)}</a>
          `;
        }
      } else {
        els.fundPhaseDesc.textContent = tt(
          "현재 단계에서 조건을 확인하세요.",
          "Please review the conditions for the current stage.",
          "現段階の条件をご確認ください。",
          "请查看当前阶段的条件。"
        );
        if (els.fundPhaseAction) {
          els.fundPhaseAction.innerHTML = `<a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">${escapeHtml(assetDetailLabel)}</a>`;
        }
      }
    };

    // (2026-05-08) Resolve labels at call time so language changes mid-page are
    //   reflected. Earlier static map captured KO at module load.
    const DOC_CAT_LABELS = () => ({
      registry: tt("등기부등본", "Registry Certificate", "登記事項証明書", "登记簿证明"),
      valuation: tt("자산평가서", "Asset Valuation", "資産評価書", "资产评估报告"),
      accounting: tt("회계자료", "Accounting Records", "会計資料", "会计资料"),
      official1: tt("공식문서1", "Official Document 1", "公式文書1", "官方文件1"),
      official2: tt("공식문서2", "Official Document 2", "公式文書2", "官方文件2"),
      proof: tt("증빙문서", "Supporting Documents", "証明文書", "证明文件"),
      sale: tt("매각문서", "Sale Documents", "売却文書", "出售文件"),
      sale_proof: tt("매각증빙자료", "Sale Supporting Records", "売却証明資料", "出售证明资料"),
      general: tt("일반문서", "General Documents", "一般文書", "一般文件"),
    });

    // ── 문서 열람 모달 ──
    const docModal = C.qs("#fundDocModal");
    const docModalTitle = C.qs("#fundDocModalTitle");
    const docModalSub = C.qs("#fundDocModalSub");
    const docModalContent = C.qs("#fundDocModalContent");
    const docModalNewTab = C.qs("#fundDocModalNewTab");

    const showDocModal = (title, sub, contentHtml, newTabUrl) => {
      if (!docModal) return;
      if (docModalTitle) docModalTitle.textContent = title || tt("문서 열람", "Document Viewer", "文書閲覧", "文档查看");
      if (docModalSub) docModalSub.textContent = sub || "";
      if (docModalNewTab) docModalNewTab.href = newTabUrl || "#";
      if (docModalNewTab) docModalNewTab.style.display = newTabUrl ? "" : "none";
      if (docModalContent) docModalContent.innerHTML = contentHtml;
      docModal.classList.remove("hidden");
      docModal.setAttribute("aria-hidden", "false");
    };

    const openDocViewer = (title, sub, fileUrl) => {
      const absUrl = C.absUrl ? C.absUrl(fileUrl) : fileUrl;
      const ext = String(fileUrl || "").split(".").pop().toLowerCase().split("?")[0];
      let html;

      if (ext === "pdf") {
        html = `<iframe src="${absUrl}" style="width:100%;height:100%;border:none;flex:1;"></iframe>`;
      } else if (["jpg","jpeg","png","gif","webp","svg"].includes(ext)) {
        const altText = title || tt("문서", "Document", "文書", "文件");
        html = `<div style="padding:16px;text-align:center;overflow:auto"><img src="${absUrl}" style="max-width:100%;max-height:65vh;border-radius:8px;" alt="${escapeHtml(altText)}"></div>`;
      } else {
        const unsupported = tt(
          "이 파일 형식은 미리보기를 지원하지 않습니다.",
          "Preview is not available for this file format.",
          "このファイル形式はプレビューをサポートしていません。",
          "此文件格式不支持预览。"
        );
        const downloadLabel = tt("다운로드/열기", "Download / Open", "ダウンロード／開く", "下载 / 打开");
        html = `<div style="padding:24px;text-align:center">
          <div class="muted" style="margin-bottom:12px">${escapeHtml(unsupported)}</div>
          <a class="btn primary" href="${absUrl}" target="_blank" rel="noopener">${escapeHtml(downloadLabel)}</a>
        </div>`;
      }

      showDocModal(title, sub, html, absUrl);
    };

    const closeDocModal = () => {
      if (!docModal) return;
      docModal.classList.add("hidden");
      docModal.setAttribute("aria-hidden", "true");
      if (docModalContent) docModalContent.innerHTML = "";
    };

    C.qs("#fundDocModalClose")?.addEventListener("click", closeDocModal);
    C.qs("#fundDocModalCloseBtn")?.addEventListener("click", closeDocModal);
    docModal?.querySelector(".contract-backdrop")?.addEventListener("click", closeDocModal);

    // 문서 목록 테이블 내 "보기" 버튼 클릭 → 인라인 뷰어로 전환
    if (docModalContent) {
      docModalContent.addEventListener("click", (e) => {
        const link = e.target.closest("[data-doc-view]");
        if (!link) return;
        e.preventDefault();
        openDocViewer(
          link.dataset.docTitle || tt("문서", "Document", "文書", "文件"),
          link.dataset.docDate || "",
          link.dataset.docView
        );
      });
    }

    const buildDocListHtml = (catLabel, catDocs, catLabels, catOrder, allCats) => {
      // allCats가 주어지면 여러 카테고리 목록, 아니면 단일 카테고리 목록
      const groups = allCats ? catOrder.filter(c => allCats[c]) : [null];
      let html = '<div style="padding:16px; overflow:auto">';

      const docNameHeader = tt("문서명", "Document Name", "文書名", "文件名");
      const dateHeader = tt("날짜", "Date", "日付", "日期");
      const viewHeader = tt("보기", "View", "表示", "查看");
      const itemsLabel = (n) => tt(`${n}건`, `${n} ${n === 1 ? "item" : "items"}`, `${n}件`, `${n} 项`);
      for (const cat of groups) {
        const docs = cat ? allCats[cat] : catDocs;
        const label = cat ? (catLabels[cat] || cat) : catLabel;
        if (!docs || !docs.length) continue;

        if (allCats) {
          html += `<div style="font-weight:900;font-size:14px;margin:12px 0 6px;color:var(--text)">${label} <span class="muted" style="font-weight:400;font-size:12px">(${itemsLabel(docs.length)})</span></div>`;
        }
        html += `<table class="table"><thead><tr><th>${docNameHeader}</th><th class="right">${dateHeader}</th><th class="right" style="width:60px">${viewHeader}</th></tr></thead><tbody>`;
        for (const doc of docs) {
          html += `<tr>`;
          html += `<td>${doc.title || "-"}</td>`;
          html += `<td class="right">${doc.doc_date || "-"}</td>`;
          html += `<td class="right"><button class="btn small" data-doc-view="${C.absUrl ? C.absUrl(doc.file_path) : doc.file_path}" data-doc-title="${(doc.title || "").replace(/"/g, "&quot;")}" data-doc-date="${doc.doc_date || ""}">${viewHeader}</button></td>`;
          html += `</tr>`;
        }
        html += '</tbody></table>';
      }

      html += '</div>';
      return html;
    };

    const renderDocsButton = async (assetId) => {
      const area = C.qs("#fundDocsBtnArea");
      const section = C.qs("#fundDocsSection");
      const countBadge = C.qs("#fundDocsCount");

      // 섹션 초기 숨김
      if (section) section.style.display = "none";
      if (area) area.innerHTML = "";

      try {
        const d = await C.loadAssetDetail(assetId).catch(() => null);
        const docs = d?.docs || [];
        if (!docs.length) return;

        // 섹션 표시 + 건수 배지
        if (section) section.style.display = "";
        const docsCountText = (n) => tt(`${n}건`, `${n} ${n === 1 ? "item" : "items"}`, `${n}件`, `${n} 项`);
        if (countBadge) countBadge.textContent = docsCountText(docs.length);

        // Group by category
        const cats = {};
        for (const doc of docs) {
          const t = doc.doc_type || "general";
          if (!cats[t]) cats[t] = [];
          cats[t].push(doc);
        }

        const catOrder = ["registry","valuation","accounting","official1","official2","proof","sale","sale_proof","general"];
        const catLabels = d.doc_categories || DOC_CAT_LABELS();

        // "전체 보기" 버튼
        if (docs.length > 1) {
          const allBtn = document.createElement("button");
          allBtn.className = "btn small fund-doc-btn";
          allBtn.type = "button";
          allBtn.textContent = tt(`전체 보기 (${docs.length})`, `View All (${docs.length})`, `すべて表示 (${docs.length})`, `查看全部 (${docs.length})`);
          allBtn.addEventListener("click", () => {
            const html = buildDocListHtml(null, null, catLabels, catOrder, cats);
            showDocModal(
              tt("증빙문서 전체", "All Supporting Documents", "証明文書すべて", "全部证明文件"),
              docsCountText(docs.length),
              html,
              `ir.html?id=${encodeURIComponent(assetId)}#tab-docs`
            );
          });
          if (area) area.appendChild(allBtn);
        }

        // 카테고리별 버튼
        for (const cat of catOrder) {
          if (!cats[cat]) continue;
          const label = catLabels[cat] || cat;
          const catDocs = cats[cat];

          const btn = document.createElement("button");
          btn.className = "btn small fund-doc-btn";
          btn.type = "button";
          btn.textContent = `${label} (${catDocs.length})`;
          btn.addEventListener("click", () => {
            if (catDocs.length === 1) {
              openDocViewer(catDocs[0].title || label, catDocs[0].doc_date || "", catDocs[0].file_path);
            } else {
              const html = buildDocListHtml(label, catDocs, catLabels, catOrder, null);
              showDocModal(label, docsCountText(catDocs.length), html, `ir.html?id=${encodeURIComponent(assetId)}#tab-docs`);
            }
          });
          if (area) area.appendChild(btn);
        }
      } catch {}
    };

    const updateLocalPreview = async () => {
      const a = getSelected();
      if (!a) return;

      const { ccy, fx, fixed } = await getFxForAsset(a);

      if (els.localCode) els.localCode.textContent = CUR_LABEL[ccy] || ccy;
      if (els.myFundingLocalCode) els.myFundingLocalCode.textContent = CUR_LABEL[ccy] || ccy;

      if (els.fundFxLine) {
        els.fundFxLine.textContent = (fx > 0)
          ? `1 USDT = ${C.fmt.num(fx, 6)} ${ccy}`
          : "-";
      }

      if (els.fundFxHint) {
        els.fundFxHint.textContent = fixed
          ? tt(
              "모금액 달성 시점 기준으로 확정된 환율입니다.",
              "FX rate locked at the moment the funding goal was reached.",
              "募集達成時点を基準に確定された為替レートです。",
              "在募集达成时点确定的汇率。"
            )
          : tt(
              "모금액 달성 시점에 확정됩니다. (현재 표기는 live 예상치)",
              "FX rate will be locked when the funding goal is reached. (Currently shown as a live estimate.)",
              "募集達成時点で確定されます（現在の表示はライブ推定値）。",
              "汇率将在达成募集目标时锁定。（当前显示为实时估算值。）"
            );
      }

      const amt = getEnteredAmount();
      if (!els.localPreview || !Number.isFinite(amt) || amt <= 0 || !(fx > 0)) {
        setText(els.localPreview, "-");
        if (els.localHint) els.localHint.textContent = "";
        renderContractState();
        return;
      }

      const local = amt * fx;
      setText(els.localPreview, fmtLocal(local, ccy));

      if (els.localHint) {
        els.localHint.textContent = fixed
          ? tt(" (확정)", " (locked)", "（確定）", "（已锁定）")
          : tt(" (live 예상)", " (live estimate)", "（ライブ推定）", "（实时估算）");
      }

      renderContractState();
    };

    const renderMyFunding = async (assetId, seq) => {
      if (!els.myFundingList) return;

      pageState.fundingRows = [];
      pageState.fundingTotalUsdt = 0;

      const w = C.getWallet();
      if (!w?.connected) {
        if (isStale(seq) || currentAssetId() !== assetId) return;
        const noWalletMsg = tt(
          "지갑을 연결하면 참여 내역이 표시됩니다.",
          "Connect your wallet to view participation history.",
          "ウォレットを接続すると参加履歴が表示されます。",
          "连接钱包后将显示参与记录。"
        );
        els.myFundingList.innerHTML =
          `<tr><td colspan="3" class="center muted">${escapeHtml(noWalletMsg)}</td></tr>`;
        setText(els.myFundingTotalUsdt, "-");
        setText(els.myFundingTotalLocal, "-");
        renderContractState();
        return;
      }

      try {
        const response = typeof C.api === "function"
          ? await C.api(`/api/funding/${encodeURIComponent(assetId)}`, { auth: true })
          : null;
        const rows = Array.isArray(response?.rows)
          ? response.rows
          : (typeof C.loadFundingHistory === "function" ? await C.loadFundingHistory(assetId) : []);

        if (isStale(seq) || currentAssetId() !== assetId) return;

        const list = Array.isArray(rows) ? rows.slice() : [];
        pageState.fundingRows = list.slice();

        const confirmedUsdt = safeNum(response?.summary?.confirmed_usdt);
        const pendingUsdt = safeNum(response?.summary?.pending_usdt);
        const refundUsdt = safeNum(response?.summary?.refund_usdt);
        const fallbackNetUsdt = list.reduce((acc, r) => {
          const kind = String(r?.status_group || r?.entry_kind || "").toLowerCase();
          const amt = safeNum(r?.amount_usdt);
          if (kind === "refund" || kind === "refund_record") return acc - amt;
          if (kind === "pending" || kind === "pending_contract" || kind === "confirmed" || kind === "funding_record") return acc + amt;
          return acc + amt;
        }, 0);
        const netUsdt = response?.summary && Number.isFinite(Number(response?.summary?.net_participation_usdt))
          ? safeNum(response.summary.net_participation_usdt)
          : Math.max(0, fallbackNetUsdt);
        pageState.fundingTotalUsdt = netUsdt;

        if (els.myFundingTotalUsdt) {
          els.myFundingTotalUsdt.textContent = `${C.fmt.num(netUsdt, 2)} USDT`;
        }

        const a = getSelected();
        const { ccy, fx } = await getFxForAsset(a);

        if (isStale(seq) || currentAssetId() !== assetId) return;

        if (els.myFundingTotalLocal) {
          els.myFundingTotalLocal.textContent = (fx > 0 && netUsdt > 0)
            ? fmtLocal(netUsdt * fx, ccy)
            : (netUsdt === 0 ? fmtLocal(0, ccy) : "-");
        }

        const statusBadge = (row) => {
          const group = String(row?.status_group || row?.entry_kind || "").toLowerCase();
          const fallbackLabel = group === "pending"
            ? tt("대기중", "Pending", "保留中", "等待中")
            : group === "refund"
              ? tt("환불 완료", "Refunded", "返金完了", "已退款")
              : tt("참여완료", "Participated", "参加完了", "已参与");
          const label = escapeHtml(String(row?.status_label || fallbackLabel || "-"));
          let tone = "neutral";
          if (group === "pending" || group === "pending_contract") tone = "warn";
          else if (group === "refund" || group === "refund_record") tone = "bad";
          else tone = "good";
          const style = tone === "warn"
            ? 'background:#fff7ed;color:#9a3412;border:1px solid #fdba74;'
            : tone === "bad"
              ? 'background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5;'
              : 'background:#ecfdf5;color:#166534;border:1px solid #86efac;';
          return `<span class="badge" style="${style}">${label}</span>`;
        };

        els.myFundingList.innerHTML =
          list.map((r) => {
            const group = String(r?.status_group || r?.entry_kind || "").toLowerCase();
            const sign = (group === "refund" || group === "refund_record") ? "-" : "";
            return `
            <tr>
              <td>${C.fmt.time(r.created_at)}</td>
              <td>${statusBadge(r)}</td>
              <td class="right">${sign}${C.fmt.num(r.amount_usdt, 2)}</td>
            </tr>
          `;
          }).join("") || `<tr><td colspan="3" class="center muted">${escapeHtml(tt(
            "참여 내역이 없습니다.",
            "No participation history.",
            "参加履歴がありません。",
            "暂无参与记录。"
          ))}</td></tr>`;
      } catch {
        if (isStale(seq) || currentAssetId() !== assetId) return;
        pageState.fundingRows = [];
        pageState.fundingTotalUsdt = 0;

        els.myFundingList.innerHTML =
          `<tr><td colspan="3" class="center muted">${escapeHtml(tt(
            "참여 내역을 불러오지 못했습니다.",
            "Failed to load participation history.",
            "参加履歴を読み込めませんでした。",
            "无法加载参与记录。"
          ))}</td></tr>`;
        setText(els.myFundingTotalUsdt, "-");
        setText(els.myFundingTotalLocal, "-");
      }

      if (isStale(seq) || currentAssetId() !== assetId) return;
      renderContractState();
    };

    const updateReferralUI = async (enabled) => {
      if (!els.refCode || !els.refApplyBtn || !els.refState) return;

      const w = C.getWallet();
      if (!w?.connected) {
        setReferralFieldHidden(false);
        els.refCode.value = "";
        els.refCode.disabled = true;
        els.refApplyBtn.disabled = true;
        els.refState.textContent = tt(
          "지갑을 연결하면 추천인 코드를 설정할 수 있습니다.",
          "Connect your wallet to set a referrer code.",
          "ウォレットを接続すると紹介コードを設定できます。",
          "连接钱包后可设置推荐人代码。"
        );
        return;
      }

      let existing = null;
      // (2026-05-16 v429) 정책 재확정: '투자 서명을 투자자가 하면 추천인 고정'.
      //   v426 의 hasConfirmedFunding (funding_records 후) 보다 한 단계 빠른
      //   hasSignedFunding (user_signed/awaiting_admin/completed) 사용. backend
      //   (/api/me, portfolio) 가 hasSignedFunding 필드 노출 — 없으면 폴백:
      //   hasConfirmedFunding → fundingRequestCount/hasAnyFunding.
      let hasSignedFunding = false;
      let meLoaded = false;
      // (2026-05-18 v474) 운영자 정책: '관리자가 추천인으로 지정한 유저가
      //   투자시 추천인 코드를 입력 할 수 없는 문제'. approved referrer
      //   (referrer_codes 등재 + is_active) 는 본인이 아직 추천인 link
      //   가 없으면 hasSignedFunding 락을 우회하여 추천인 코드 추가 가능.
      //   /api/me 의 myRefCode 가 채워져 있으면 approved referrer.
      let isApprovedReferrer = false;

      try {
        const me = await C.api("/api/me", { method: "GET", auth: true });
        meLoaded = true;
        existing = me?.myReferrer || null;
        isApprovedReferrer = !!(me?.myRefCode);
        if (typeof me?.hasSignedFunding === "boolean") {
          hasSignedFunding = !!me.hasSignedFunding;
        } else if (typeof me?.hasAnyFunding === "boolean") {
          // 폴백 — hasAnyFunding 은 awaiting_admin/completed 기준이므로 user_signed
          //   만 있는 corner case 는 못 잡지만 대부분의 케이스에서 안전.
          hasSignedFunding = !!me.hasAnyFunding;
        } else if (Number.isFinite(Number(me?.fundingRequestCount))) {
          hasSignedFunding = Number(me.fundingRequestCount) > 0;
        }
      } catch {}

      if ((!meLoaded || (!existing && !hasSignedFunding))) {
        try {
          const pf = await C.loadPortfolio();
          if (!existing) existing = pf?.myReferrer || null;
          if (!hasSignedFunding) {
            if (typeof pf?.hasSignedFunding === "boolean") {
              hasSignedFunding = !!pf.hasSignedFunding;
            } else if (typeof pf?.hasAnyFunding === "boolean") {
              hasSignedFunding = !!pf.hasAnyFunding;
            } else if (Number.isFinite(Number(pf?.fundingRequestCount))) {
              hasSignedFunding = Number(pf.fundingRequestCount) > 0;
            }
          }
        } catch {}
      }

      // pageState.fundingRows 폴백 — pending(awaiting_admin) 도 포함.
      if (!hasSignedFunding) {
        hasSignedFunding = (pageState.fundingRows || []).some((r) => {
          const sg = String(r?.status_group || "");
          const ek = String(r?.entry_kind || "");
          return sg === "confirmed" || sg === "pending"
              || ek === "funding_record" || ek === "pending_contract";
        });
      }

      // 'hasAnyFunding' 변수명을 유지 — 아래 분기 코드 호환성. 의미는 hasSignedFunding 임.
      const hasAnyFunding = hasSignedFunding;

      // (2026-05-18 v474) approved referrer 우회: hasSignedFunding=true 라도
      //   isApprovedReferrer && !existing 이면 추천인 추가 가능 (락 미적용).
      //   설정 후엔 다른 사용자와 동일하게 변경 불가.
      const referrerCanBypassLock = isApprovedReferrer && !existing;

      // (2026-06-17 v905) 운영자 정책: 이미 투자(hasSignedFunding)한 지갑은 추천 설정
      //   시점을 놓침 → 추천 설정 불가 + 입력칸 '숨김'. v903 추천 자율화로 모든 회원이
      //   approved referrer(myRefCode 보유)가 되면서, 아래 referrerCanBypassLock 우회가
      //   투자 후에도 추천 설정을 허용하던 문제를 함께 차단. 투자 전 사용자만 설정 가능.
      //   Revert: 이 if(hasAnyFunding) 블록 제거 → 아래 기존 v422/v474 분기로 복귀.
      if (hasAnyFunding) {
        setReferralFieldHidden(true);
        els.refCode.value = "";
        els.refCode.disabled = true;
        els.refApplyBtn.disabled = true;
        return;
      }

      // (2026-05-16 v422) 운영자: 추천인 카드를 숨기지 말고 그대로 노출하되,
      //   기존 추천인이 있으면 코드를 채워 disabled 처리. 첫 참여 이후 사용자가
      //   자신이 등록한 추천인을 시각적으로 확인할 수 있도록 (히든 카드 → 표시).
      //   existing 유무로 안내 메시지만 분기:
      //     - existing 있음: '설정됨, 변경 불가'
      //     - existing 없음 + 투자 이력 있음: '첫 참여 이후 등록 불가'
      //   (v905) ↓ 아래 hasAnyFunding 분기는 위 선처리로 투자 후엔 미도달 (보존).
      if (hasAnyFunding && !referrerCanBypassLock) {
        setReferralFieldHidden(false);
        els.refCode.value = existing || "";
        els.refCode.disabled = true;
        els.refApplyBtn.disabled = true;
        els.refState.textContent = existing
          ? tt(
              "추천인 코드가 설정되었습니다. 변경할 수 없습니다.",
              "Referrer code is set. It cannot be changed.",
              "紹介コードが設定されています。変更できません。",
              "推荐人代码已设置，无法更改。"
            )
          : tt(
              "첫 참여 이후에는 추천인 등록이 불가합니다.",
              "Referrer registration is not available after your first participation.",
              "初回参加後は紹介者の登録ができません。",
              "首次参与后无法注册推荐人。"
            );
        return;
      }

      // (2026-05-18 v474) approved referrer 가 hasAnyFunding 락을 우회한 분기 —
      //   input 활성 + 안내 메시지 별도. 설정 후엔 잠금 (existing 채워지면 위
      //   if(hasAnyFunding && !referrerCanBypassLock) 분기로 자동 진입).
      if (referrerCanBypassLock) {
        setReferralFieldHidden(false);
        els.refCode.value = "";
        if (!enabled) {
          els.refCode.disabled = true;
          els.refApplyBtn.disabled = true;
          els.refState.textContent = tt(
            "현재 단계에서는 추천인 설정이 불가합니다.",
            "Referrer codes cannot be set at this stage.",
            "現段階では紹介者設定はできません。",
            "当前阶段无法设置推荐人。"
          );
          return;
        }
        els.refCode.disabled = false;
        els.refApplyBtn.disabled = false;
        els.refState.textContent = tt(
          "승인된 추천인 자격으로 추천인 코드를 추가할 수 있습니다. 설정 후에는 변경할 수 없습니다.",
          "As an approved referrer, you may add a referrer code now. Once set, it cannot be changed.",
          "承認済み紹介者として紹介コードを追加できます。設定後は変更できません。",
          "作为已批准的推荐人，您现在可以添加推荐人代码。设置后无法更改。"
        );
        return;
      }

      setReferralFieldHidden(false);

      // (2026-05-16 v424) 운영자 정책: '투자 확정진행 전이면 추천인 변경 가능'.
      //   기존 흐름은 existing 있으면 항상 disabled → 사용자가 첫 참여 전이어도
      //   변경 불가 상태가 됨. 정책 변경: hasAnyFunding=false 면 input 활성 +
      //   현재 추천인 코드를 placeholder 처럼 채워서 노출 (Apply 누르면 교체).
      //   backend referrals.php apply / funding.php 도 동일 정책으로 변경됨.
      if (existing) {
        els.refCode.value = existing;
        if (!enabled) {
          // enabled=false 면 어차피 다른 분기에서 disabled 처리되지만 명시적 분기.
          els.refCode.disabled = true;
          els.refApplyBtn.disabled = true;
          els.refState.textContent = tt(
            "현재 단계에서는 추천인 설정이 불가합니다.",
            "Referrer codes cannot be set at this stage.",
            "現段階では紹介者設定はできません。",
            "当前阶段无法设置推荐人。"
          );
          return;
        }
        els.refCode.disabled = false;
        els.refApplyBtn.disabled = false;
        els.refState.textContent = tt(
          "현재 추천인이 설정되어 있습니다. 첫 참여 전에는 변경할 수 있습니다.",
          "A referrer is currently set. You can still change it before your first participation.",
          "現在の紹介者が設定されています。初回参加前であれば変更できます。",
          "已设置推荐人。首次参与前仍可更改。"
        );
        return;
      }

      if (!enabled) {
        els.refCode.disabled = true;
        els.refApplyBtn.disabled = true;
        els.refState.textContent = tt(
          "현재 단계에서는 추천인 설정이 불가합니다.",
          "Referrer codes cannot be set at this stage.",
          "現段階では紹介者設定はできません。",
          "当前阶段无法设置推荐人。"
        );
        return;
      }

      els.refCode.disabled = false;
      els.refApplyBtn.disabled = false;
      // (2026-05-19 v600) 운영자 요청 — field-help 안내 텍스트 제거.
      //   Apply 버튼 클릭 시 자기 자신/미등록 추천인 popup 은 그대로 유지 (v589).
      els.refState.textContent = "";
    };

    const setFundingEnabled = (enabled) => {
      const c = contractState.item;
      const st = String(c?.status || "");
      // (2026-05-07) Drop the contract_locked guard. Earlier behavior froze
      //   the amount input whenever the user had a draft / user_signed
      //   contract, telling them to click a "Rewrite" button — but that
      //   button is hidden in the current Silica markup, so users got stuck
      //   with no escape. The backend /api/contracts/draft now cascades-
      //   discards any existing drafts/user_signed before creating a new one,
      //   so each PARTICIPATE click effectively rewrites the contract. The
      //   UI can let the user freely edit the amount without lockout.
      const contractLocked = false;

      if (els.amount) {
        if (!enabled) {
          const restored = c ? hydrateAmountFromContract(c, true) : false;
          if (!restored) {
            els.amount.value = "";
          }
          els.amount.placeholder = tt(
            "현재 단계에서는 참여할 수 없습니다.",
            "Participation is not available at this stage.",
            "現段階では参加できません。",
            "当前阶段无法参与。"
          );
          setAmountFieldMode("disabled", { opacity: "0.65" });
        } else {
          // (2026-05-08) Use a neutral "0" placeholder instead of "e.g. 100"
          //   to avoid users mistaking the placeholder text for a default
          //   pre-filled amount on first visit.
          els.amount.placeholder = "0";
          setAmountFieldMode("normal");
        }
      }

      if (els.select) els.select.disabled = !enabled;
      if (els.maxBtn) els.maxBtn.disabled = !enabled;
      if (els.fundBtn) els.fundBtn.disabled = !enabled;

      if (els.refCode) els.refCode.disabled = !enabled;
      if (els.refApplyBtn) els.refApplyBtn.disabled = !enabled;

      if (els.otpCode) els.otpCode.disabled = !enabled;
      if (els.contractBtn) els.contractBtn.disabled = !enabled || !(getEnteredAmount() > 0);
    };

    const fetchLatestContract = async (assetId, seq) => {
      const a = getSelected();
      const w = C.getWallet();

      if (!a || !w?.connected) {
        if (isStale(seq) || currentAssetId() !== assetId) return;
        contractState.item = null;
        contractState.list = [];
        pageState.participatedByServer = false;
        renderContractState();
        return;
      }

      try {
        const r = await C.api(`/api/contracts/my?assetId=${encodeURIComponent(assetId)}`, {
          method: "GET",
          auth: true,
        });

        if (isStale(seq) || currentAssetId() !== assetId) return;

        contractState.item = r?.contract || null;
        setContractList(sanitizeFundingContractRows(Array.isArray(r?.contracts) ? r.contracts : (Array.isArray(r?.rows) ? r.rows : [])), contractState.item?.id ?? null);
        if (contractState.item && !ACTIVE_FUNDING_CONTRACT_STATUSES.has(String(contractState.item.status || ""))) {
          contractState.item = null;
        }
        pageState.participatedByServer = !!r?.participated;
        // (2026-05-16 v431) 운영자 보고: '페이지 새로고침 시 amount 가 100 으로
        //   유지되어 0 으로 초기화되지 않는다'. 원인: 페이지 로드 시 backend 의
        //   draft/user_signed contract amount 를 input 에 자동 채움. 사용자는
        //   새로고침 시 빈 상태에서 다시 입력하기를 원함 → hydrate 호출 제거.
        //   모달 열기/sign/invest 등 명시적 액션 흐름의 hydrate 는 그대로 유지.
      } catch {
        if (isStale(seq) || currentAssetId() !== assetId) return;
        contractState.item = null;
        contractState.list = [];
        pageState.participatedByServer = false;
      }

      if (isStale(seq) || currentAssetId() !== assetId) return;

      renderContractState();

      const canFund = isInvestable(String(a.status || ""));

      setFundingEnabled(canFund);
    };

    // ── 잔액 조회 및 부족 안내 ──
    let _cachedBalance = null;

    const setBalanceRowStyle = (type) => {
      if (!els.myBalanceRow) return;
      if (type === "warn") {
        els.myBalanceRow.style.background = "#fef3c7";
        els.myBalanceRow.style.borderColor = "#fbbf24";
        els.myBalanceRow.style.color = "#92400e";
      } else {
        els.myBalanceRow.style.background = "#f0fdf4";
        els.myBalanceRow.style.borderColor = "#bbf7d0";
        els.myBalanceRow.style.color = "#166534";
      }
    };

    const updateBalanceNotice = async () => {
      // 항상 잔액 행은 표시 (지갑 미연결이면 "-" 표시)
      if (els.myBalanceRow) els.myBalanceRow.style.display = "";

      const w = C.getWallet();
      if (!w?.connected) {
        if (els.myBalanceDisplay) els.myBalanceDisplay.textContent = "-";
        if (els.balanceShortage) els.balanceShortage.style.display = "none";
        setBalanceRowStyle("normal");
        return;
      }
      try {
        const me = await C.api("/api/me", { auth: true });
        _cachedBalance = Number(me?.usdt ?? 0);
      } catch {
        // x-wallet fallback: portfolio API도 시도
        try {
          const pf = await C.api("/api/portfolio", { auth: true });
          _cachedBalance = Number(pf?.usdt ?? pf?.balance_usdt ?? 0);
        } catch {
          _cachedBalance = 0;
        }
      }

      const balText = C.fmt?.num ? C.fmt.num(_cachedBalance, 2) : String(Number(_cachedBalance).toFixed(2));
      if (els.myBalanceDisplay) els.myBalanceDisplay.textContent = balText;
      if (els.myBalance) els.myBalance.textContent = balText;

      const amt = getEnteredAmount();
      if (Number.isFinite(amt) && amt > 0 && _cachedBalance < amt) {
        if (els.balanceShortage) els.balanceShortage.style.display = "";
        setBalanceRowStyle("warn");
      } else {
        if (els.balanceShortage) els.balanceShortage.style.display = "none";
        setBalanceRowStyle("normal");
      }
    };

    const showBalanceShortage = (balance) => {
      if (els.myBalance) els.myBalance.textContent = C.fmt.num(balance, 2);
      if (els.balanceShortage) els.balanceShortage.style.display = "";
    };

    const updateUI = async () => {
      const a = getSelected();
      if (!a) return;

      const seq = ++pageState.uiSeq;
      const assetId = String(a.id);

      writeRememberedAssetId(assetId);

      contractState.item = null;
      contractState.list = [];
      pageState.fundingRows = [];
      pageState.fundingTotalUsdt = 0;
      pageState.participatedByServer = false;

      renderContractState();

      setHref(els.fundDetailBtn, `ir.html?id=${encodeURIComponent(a.id)}`);

      renderPhaseNote(a);

      setHTML(els.fundStatus, C.statusBadge(a.status));
      setText(els.fundMarket, a.market || "-");

      const cc = String(a.country_code || "KR").toUpperCase();
      setText(els.fundCountry, COUNTRY_LABEL[cc] || cc);

      const ccy = String(a.settlement_basis || "KRW").toUpperCase();
      setText(els.fundCurrency, tt(
        `정산통화 ${CUR_LABEL[ccy] || ccy}`,
        `Settlement Currency: ${CUR_LABEL[ccy] || ccy}`,
        `決済通貨 ${CUR_LABEL[ccy] || ccy}`,
        `结算货币 ${CUR_LABEL[ccy] || ccy}`
      ));

      setText(els.fundAssetName, a.name || "-");

      // Reset image loading state
      const skeleton = C.qs("#fundAssetImageSkeleton");
      if (skeleton) skeleton.style.display = "";
      if (els.fundAssetImage) els.fundAssetImage.style.display = "none";
      setSrc(els.fundAssetImage, a.image_url || "");

      const pct = C.fundPct(a);
      setText(els.fundPct, `${C.fmt.num(pct, 1)}%`);
      if (els.fundProgress) els.fundProgress.style.width = `${pct}%`;

      setText(els.fundRaised, C.money.usdt(a.raised_usdt, 0));
      setText(els.fundTarget, C.money.usdt(a.target_usdt, 0));
      setText(els.fundMin, C.money.usdt(a.min_usdt, 0));

      await renderDocsButton(a.id);

      if (isStale(seq) || currentAssetId() !== assetId) return;

      const canFund = isInvestable(String(a.status || ""));
      setFundingEnabled(canFund);

      // 잔액 조회 및 부족 안내 업데이트
      await updateBalanceNotice();

      await updateLocalPreview();
      if (isStale(seq) || currentAssetId() !== assetId) return;

      await Promise.all([
        renderMyFunding(assetId, seq),
        fetchLatestContract(assetId, seq),
      ]);

      if (isStale(seq) || currentAssetId() !== assetId) return;
      renderContractState();
      setFundingEnabled(canFund);
      await updateReferralUI(canFund);
    };

    const createContractDraft = async () => {
      const w = C.getWallet();
      if (!w?.connected) return C.toast(tt("지갑을 연결하세요.", "Please connect your wallet.", "ウォレットを接続してください。", "请连接钱包。"), "bad");

      const a = getSelected();
      if (!a) return C.toast(tt("자산을 선택하세요.", "Please select an asset.", "資産を選択してください。", "请选择资产。"), "bad");
      if (!isInvestable(String(a.status || ""))) {
        return C.toast(tt("현재 단계에서는 전자계약서를 작성할 수 없습니다.", "Electronic contracts cannot be drafted at this stage.", "現段階では電子契約書を作成できません。", "当前阶段无法起草电子合同。"), "bad");
      }

      const activeStatus = String(contractState.item?.status || "");
      if (contractState.item && ["draft", "user_signed"].includes(activeStatus) && contractMatchesCurrentSelection()) {
        return viewCurrentContract();
      }

      const amt = getEnteredAmount();
      if (!Number.isFinite(amt) || amt <= 0) return C.toast(tt("참여 금액을 먼저 입력하세요.", "Please enter the amount first.", "参加金額を先に入力してください。", "请先输入参与金额。"), "bad");
      if (amt < Number(a.min_usdt || 0)) {
        return C.toast(tt(
          `최소 참여 금액은 ${C.money.usdt(a.min_usdt, 0)} 입니다.`,
          `Minimum participation amount is ${C.money.usdt(a.min_usdt, 0)}.`,
          `最低参加金額は ${C.money.usdt(a.min_usdt, 0)} です。`,
          `最低参与金额为 ${C.money.usdt(a.min_usdt, 0)}。`
        ), "bad");
      }

      try {
        const userLang = (window.RwaI18n?.lang?.() || 'ko');
        const r = await C.api("/api/contracts/draft", {
          method: "POST",
          auth: true,
          body: {
            assetId: a.id,
            amount: amt,
            lang: userLang,
          },
        });

        contractState.item = r.contract || null;
        upsertContractListItem(contractState.item);
        if (contractState.item && hydrateAmountFromContract(contractState.item, true)) {
          await updateLocalPreview();
        } else {
          renderContractState();
        }

        if (contractState.item) openContractModal("sign", contractState.item);
      } catch (e) {
        C.toast(e.message || tt("전자계약서 생성 실패", "Failed to create electronic contract", "電子契約書の作成失敗", "电子合同创建失败"), "bad");
      }
    };

    const viewCurrentContract = async () => {
      const c = contractState.item;
      if (!c?.id) return;

      try {
        const r = await C.api(`/api/contracts/${encodeURIComponent(c.id)}`, {
          method: "GET",
          auth: true,
        });

        if (!r?.contract) throw new Error(tt(
          "전자계약서를 불러오지 못했습니다.",
          "Failed to load the electronic contract.",
          "電子契約書を読み込めませんでした。",
          "无法加载电子合同。"
        ));

        contractState.item = r.contract;
        upsertContractListItem(contractState.item);
        if (contractState.item && hydrateAmountFromContract(contractState.item, true)) {
          await updateLocalPreview();
        } else {
          renderContractState();
        }

        if (String(contractState.item.status || "") === "draft" && contractMatchesCurrentSelection()) {
          openContractModal("sign", contractState.item);
        } else {
          openContractModal("view", contractState.item);
        }
      } catch (e) {
        C.toast(e.message || tt(
          "전자계약서 조회 실패",
          "Failed to fetch the electronic contract.",
          "電子契約書の照会に失敗しました。",
          "查询电子合同失败。"
        ), "bad");
      }
    };

    const submitContractSignature = async () => {
      const c = contractState.item;
      if (!c?.id) return C.toast(tt(
        "전자계약서가 없습니다.",
        "No electronic contract is available.",
        "電子契約書がありません。",
        "暂无电子合同。"
      ), "bad");

      // Prevent double-click
      if (contractState.signing) return;

      const signerName = String(els.contractSignerName?.value || "").trim();
      if (!signerName) return C.toast(tt(
        "서명자명을 입력하세요.",
        "Please enter the signer's name.",
        "署名者名を入力してください。",
        "请输入签名人姓名。"
      ), "bad");
      if (!els.contractAgreeElectronic?.checked) return C.toast(tt(
        "전자문서 동의가 필요합니다.",
        "Please agree to electronic documents.",
        "電子文書への同意が必要です。",
        "需要同意电子文档。"
      ), "bad");
      if (!els.contractAgreeSignature?.checked) return C.toast(tt(
        "전자서명 동의가 필요합니다.",
        "Please agree to the electronic signature.",
        "電子署名への同意が必要です。",
        "需要同意电子签名。"
      ), "bad");
      if (!sigPad.dirty || !els.contractSignatureCanvas) return C.toast(tt(
        "자필 전자서명이 필요합니다.",
        "A handwritten electronic signature is required.",
        "手書きの電子署名が必要です。",
        "需要手写电子签名。"
      ), "bad");

      const signatureDataUrl = els.contractSignatureCanvas.toDataURL("image/png");

      // Validate data URL client-side before sending
      if (!signatureDataUrl || !signatureDataUrl.startsWith("data:image/png;base64,")) {
        console.error("[user-sign] Invalid canvas dataUrl:", signatureDataUrl?.slice(0, 80));
        return C.toast(tt(
          "서명 이미지를 생성할 수 없습니다. 다시 서명해 주세요.",
          "Unable to generate the signature image. Please sign again.",
          "署名画像を生成できませんでした。もう一度署名してください。",
          "无法生成签名图像。请重新签名。"
        ), "bad");
      }

      const base64Part = signatureDataUrl.slice("data:image/png;base64,".length);
      if (!base64Part || base64Part.length < 100) {
        console.error("[user-sign] Base64 data too short:", base64Part?.length);
        return C.toast(tt(
          "서명이 너무 작습니다. 다시 서명해 주세요.",
          "Your signature is too small. Please sign again.",
          "署名が小さすぎます。もう一度署名してください。",
          "签名过小。请重新签名。"
        ), "bad");
      }

      contractState.signing = true;
      if (els.contractSaveBtn) {
        els.contractSaveBtn.disabled = true;
        els.contractSaveBtn.textContent = tt("서명 처리 중…", "Processing signature…", "署名処理中…", "签名处理中…");
      }

      try {
        const r = await C.api(`/api/contracts/${encodeURIComponent(c.id)}/user-sign`, {
          method: "POST",
          auth: true,
          body: {
            signerName,
            consentElectronic: true,
            consentSignature: true,
            signatureDataUrl,
          },
        });

        if (r?.contract) {
          contractState.item = r.contract || null;
          upsertContractListItem(contractState.item);
          if (contractState.item && hydrateAmountFromContract(contractState.item, true)) {
            await updateLocalPreview();
          } else {
            renderContractState();
          }

          // 새 플로우: 서명 완료 직후 투자 실행 (계약서와 투자가 같은 호흡으로 묶임)
          // 환율 차익(서명 후 환율 유리한 시점에 별도로 투자) 방지.
          if (contractState.pendingInvestment && typeof contractState._runInvestmentAfterContract === "function") {
            const pending = contractState.pendingInvestment;
            // contractState.signing 은 finally 에서 false 로 재설정됨 → 미리 false 로 해서 fundBtn busy 가드 충돌 방지
            contractState.signing = false;
            await contractState._runInvestmentAfterContract(contractState.item, pending);
            return; // skip toast — 성공 팝업이 대신 보여짐
          }

          closeContractModal();
          C.toast(tt(
            "전자계약서 서명이 완료되었습니다.",
            "Your electronic contract signature is complete.",
            "電子契約書の署名が完了しました。",
            "电子合同签名已完成。"
          ), "good");
        } else {
          C.toast(tt("서명 완료 처리 실패", "Failed to finalize signature.", "署名完了処理に失敗しました。", "签名完成处理失败。"), "bad");
        }
      } catch (e) {
        console.error("[user-sign] API error:", e.status, e.message, e.detail, e.data);
        const detail = e.detail ? ` (${e.detail})` : "";
        C.toast((e.message || tt("전자계약서 서명 저장 실패", "Failed to save contract signature.", "電子契約書の署名保存に失敗しました。", "电子合同签名保存失败。")) + detail, "bad");
      } finally {
        contractState.signing = false;
        if (els.contractSaveBtn) {
          els.contractSaveBtn.textContent = tt("서명 완료", "Complete Signature", "署名完了", "完成签名");
          updateContractSaveButtonState();
        }
      }
    };

    if (!els.select.dataset.bound) {
      els.select.dataset.bound = "1";
      els.select.addEventListener("change", async () => {
        writeRememberedAssetId(els.select.value);
        await updateUI();
      });
    }

    if (els.amount && !els.amount.dataset.bound) {
      els.amount.dataset.bound = "1";
      els.amount.addEventListener("input", () => {
        const normalized = normalizeWholeAmountInput(els.amount.value);
        if (els.amount.value !== normalized) els.amount.value = normalized;
        updateLocalPreview();
        // 실시간 잔액 부족 안내 업데이트
        const amt = getEnteredAmount();
        const shortage = _cachedBalance !== null && Number.isFinite(amt) && amt > 0 && _cachedBalance < amt;
        if (shortage) {
          if (els.balanceShortage) els.balanceShortage.style.display = "";
          setBalanceRowStyle("warn");
        } else {
          if (els.balanceShortage) els.balanceShortage.style.display = "none";
          setBalanceRowStyle("normal");
        }
      });
      const amountLockGuideHandler = (e) => {
        if (pageState.amountFieldMode !== "contract_locked") return;
        if (e?.type === "keydown" && ["Tab", "Shift", "Control", "Alt", "Meta", "Escape"].includes(e.key)) return;
        if (e?.type === "keydown") e.preventDefault();
        notifyContractLockedAmount();
      };
      els.amount.addEventListener("click", amountLockGuideHandler);
      els.amount.addEventListener("focus", amountLockGuideHandler);
      els.amount.addEventListener("keydown", amountLockGuideHandler);
    }

    if (els.otpCode && !els.otpCode.dataset.bound) {
      els.otpCode.dataset.bound = "1";
      els.otpCode.addEventListener("input", () => {
        els.otpCode.value = normalizeOtp(els.otpCode.value);
      });
    }

    if (els.contractBtn && !els.contractBtn.dataset.bound) {
      els.contractBtn.dataset.bound = "1";
      els.contractBtn.addEventListener("click", createContractDraft);
    }

    if (els.contractResetBtn && !els.contractResetBtn.dataset.bound) {
      els.contractResetBtn.dataset.bound = "1";
      els.contractResetBtn.addEventListener("click", () => {
        if (!confirm(tt("기존 전자계약서가 파기되고 새로 작성됩니다.\n계속하시겠습니까?", "The existing electronic contract will be discarded and recreated.\nDo you want to continue?", "既存の電子契約書は破棄され、新しく作成されます。\n続行しますか？", "现有电子合同将被废弃并重新创建。\n是否继续？"))) return;

        contractState.item = null;
        lockAmountInputs(false);
        renderContractState();
        if (els.amount) els.amount.focus();
        C.toast(tt(
          "기존 계약서가 파기되었습니다. 금액을 변경한 후 다시 작성하세요.",
          "The previous contract was discarded. Change the amount, then draft a new contract.",
          "既存の契約書が破棄されました。金額を変更してから再作成してください。",
          "原合同已废弃。请更改金额后重新起草。"
        ), "good");
      });
    }

    if (els.contractViewBtn && !els.contractViewBtn.dataset.bound) {
      els.contractViewBtn.dataset.bound = "1";
      els.contractViewBtn.addEventListener("click", openContractHistoryModal);
    }

    if (els.contractClearSignBtn && !els.contractClearSignBtn.dataset.bound) {
      els.contractClearSignBtn.dataset.bound = "1";
      els.contractClearSignBtn.addEventListener("click", clearSignatureCanvas);
    }

    if (els.contractSaveBtn && !els.contractSaveBtn.dataset.bound) {
      els.contractSaveBtn.dataset.bound = "1";
      els.contractSaveBtn.addEventListener("click", submitContractSignature);
    }

    if (els.contractCloseBtn && !els.contractCloseBtn.dataset.bound) {
      els.contractCloseBtn.dataset.bound = "1";
      els.contractCloseBtn.addEventListener("click", closeContractModal);
    }

    if (els.contractModalXBtn && !els.contractModalXBtn.dataset.bound) {
      els.contractModalXBtn.dataset.bound = "1";
      els.contractModalXBtn.addEventListener("click", closeContractModal);
    }

    if (els.contractBackdrop && !els.contractBackdrop.dataset.bound) {
      els.contractBackdrop.dataset.bound = "1";
      els.contractBackdrop.addEventListener("click", closeContractModal);
    }

    if (els.contractHistoryList && !els.contractHistoryList.dataset.bound) {
      els.contractHistoryList.dataset.bound = "1";
      els.contractHistoryList.addEventListener("click", (e) => {
        const btn = e.target.closest(".contract-history-open-btn");
        if (!btn) return;
        openContractFromHistory(btn.getAttribute("data-contract-id"));
      });
    }

    if (els.contractHistoryCloseBtn && !els.contractHistoryCloseBtn.dataset.bound) {
      els.contractHistoryCloseBtn.dataset.bound = "1";
      els.contractHistoryCloseBtn.addEventListener("click", closeContractHistoryModal);
    }

    if (els.contractHistoryCloseBtn2 && !els.contractHistoryCloseBtn2.dataset.bound) {
      els.contractHistoryCloseBtn2.dataset.bound = "1";
      els.contractHistoryCloseBtn2.addEventListener("click", closeContractHistoryModal);
    }

    if (els.contractHistoryBackdrop && !els.contractHistoryBackdrop.dataset.bound) {
      els.contractHistoryBackdrop.dataset.bound = "1";
      els.contractHistoryBackdrop.addEventListener("click", closeContractHistoryModal);
    }

    if (els.contractSignerName && !els.contractSignerName.dataset.bound) {
      els.contractSignerName.dataset.bound = "1";
      els.contractSignerName.addEventListener("input", updateContractSaveButtonState);
    }

    if (els.contractAgreeElectronic && !els.contractAgreeElectronic.dataset.bound) {
      els.contractAgreeElectronic.dataset.bound = "1";
      els.contractAgreeElectronic.addEventListener("change", updateContractSaveButtonState);
    }

    if (els.contractAgreeSignature && !els.contractAgreeSignature.dataset.bound) {
      els.contractAgreeSignature.dataset.bound = "1";
      els.contractAgreeSignature.addEventListener("change", updateContractSaveButtonState);
    }

    if (els.refApplyBtn && !els.refApplyBtn.dataset.bound) {
      els.refApplyBtn.dataset.bound = "1";
      els.refApplyBtn.addEventListener("click", async () => {
        const w = C.getWallet();
        if (!w?.connected) return C.toast(tt(
          "지갑을 연결하세요.",
          "Please connect your wallet.",
          "ウォレットを接続してください。",
          "请连接钱包。"
        ), "bad");

        const a = getSelected();
        if (!a) return;

        if (!isInvestable(String(a.status || ""))) {
          return C.toast(tt(
            "현재 단계에서는 추천인 설정이 불가합니다.",
            "Referrer codes cannot be set at this stage.",
            "現段階では紹介者設定はできません。",
            "当前阶段无法设置推荐人。"
          ), "bad");
        }

        const code = String(els.refCode?.value || "").trim();
        if (!code) return C.toast(tt(
          "추천인 코드를 입력하세요.",
          "Please enter a referrer code.",
          "紹介コードを入力してください。",
          "请输入推荐人代码。"
        ), "bad");

        // (2026-05-19 v589) 운영자 요청 — 두 케이스 팝업 안내:
        //   ① 자기 자신 입력 (지갑 주소가 본인 주소와 동일)
        //   ② 미등록/유효하지 않은 추천인 코드
        // 단순 toast 보다 alert() 팝업이 더 분명한 차단 신호.
        const selfAddr = String(w?.address || "").trim();
        if (selfAddr && code === selfAddr) {
          alert("You can only set this before your first participation.");
          return;
        }

        // Validate code first
        // (2026-05-16 v425) auth: true 로 전환 — backend 가 본인 추천 차단을
        //   validate 단계에서도 적용하도록 (인증 정보 전달 필요). 미인증 호출은
        //   apply 단계에서야 차단되어 UX 결함이었음.
        try {
          const v = await C.api(`/api/referral/validate?code=${encodeURIComponent(code)}`, { auth: true });
          if (!v?.valid) {
            // (2026-06-17 v906) v903 추천 자율화 후 메시지 정정 — 옛 '승인된 주소만'(승인제)
            //   → '유효하지 않은 추천인'(미가입/오타). 모든 회원이 자동 추천인이라, 가입된
            //   추천 코드/지갑 주소면 유효. 다국어 tt (운영 정책상 ja/zh 미사용 → en 복제).
            alert(tt(
              "유효하지 않은 추천인입니다. 추천인 코드 또는 가입된 지갑 주소를 정확히 입력해 주세요.",
              "Invalid referrer. Please enter a valid referrer code or a registered wallet address.",
              "Invalid referrer. Please enter a valid referrer code or a registered wallet address.",
              "Invalid referrer. Please enter a valid referrer code or a registered wallet address."
            ));
            return;
          }
        } catch (e) {
          // (2026-06-17 v906) validate API 오류 — 옛 '승인된 주소만' → 확인 오류 안내로 정정.
          alert(tt(
            "추천인 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            "Could not verify the referrer. Please try again in a moment.",
            "Could not verify the referrer. Please try again in a moment.",
            "Could not verify the referrer. Please try again in a moment."
          ));
          return;
        }

        // Apply via new referral system
        try {
          await C.api("/api/referral/apply", {
            method: "POST",
            auth: true,
            body: { code },
          });
          C.toast(tt(
            "추천인 코드가 적용되었습니다.",
            "Referrer code applied.",
            "紹介コードが適用されました。",
            "已应用推荐人代码。"
          ), "good");
          if (els.refCode) els.refCode.disabled = true;
          if (els.refApplyBtn) els.refApplyBtn.disabled = true;
          if (els.refState) els.refState.textContent = tt(
            "추천인 코드가 설정되었습니다.",
            "Referrer code has been set.",
            "紹介コードが設定されました。",
            "推荐人代码已设置。"
          );
        } catch (e) {
          // If already linked or first-funding restriction, show message
          C.toast(e.message || tt(
            "추천인 코드 적용 실패",
            "Failed to apply the referrer code.",
            "紹介コードの適用に失敗しました。",
            "应用推荐人代码失败。"
          ), "bad");
        }
      });
    }

    // (2026-05-18 v480) 운영자 디버그 요청: 'F12 에서 오류가 나타나도록 해봐'.
    //   MAX/PARTICIPATE 클릭이 아무 반응 없음 — disabled 일 가능성, 또는
    //   handler 내부 silent fail. 매 분기마다 console.log 로 상태 출력.
    console.log('[funding] MAX button el:', els.maxBtn, 'bound:', els.maxBtn?.dataset?.bound, 'disabled:', els.maxBtn?.disabled);
    console.log('[funding] fundBtn el:', els.fundBtn, 'bound:', els.fundBtn?.dataset?.bound, 'disabled:', els.fundBtn?.disabled);
    console.log('[funding] assets list size:', assets.length, 'select.value:', els.select?.value);

    if (els.maxBtn && !els.maxBtn.dataset.bound) {
      els.maxBtn.dataset.bound = "1";
      els.maxBtn.addEventListener("click", async () => {
        console.log('[funding] MAX clicked. disabled=', els.maxBtn.disabled);
        const w = C.getWallet();
        console.log('[funding] MAX: wallet=', w);
        if (!w?.connected) {
          console.warn('[funding] MAX blocked: wallet not connected');
          return C.toast(tt(
            "지갑을 연결하세요.",
            "Please connect your wallet.",
            "ウォレットを接続してください。",
            "请连接钱包。"
          ), "bad");
        }

        const a = getSelected();
        console.log('[funding] MAX: selected asset=', a);
        if (!a) {
          console.error('[funding] MAX blocked: getSelected() returned null. assets=', assets, 'select.value=', els.select?.value);
          return;
        }
        console.log('[funding] MAX: asset.status=', a.status, 'isInvestable=', isInvestable(String(a.status || "")));
        if (!isInvestable(String(a.status || ""))) {
          console.warn('[funding] MAX blocked: asset not investable, status=', a.status);
          return C.toast(tt(
            "현재 단계에서는 참여할 수 없습니다.",
            "Participation is not available at this stage.",
            "現段階では参加できません。",
            "当前阶段无法参与。"
          ), "bad");
        }

        // (2026-05-08) Removed the contract-locked MAX guard. /api/contracts/draft
        //   now cascade-discards the user's existing draft / user_signed
        //   contracts on every PARTICIPATE click, so the MAX button can
        //   freely overwrite the amount field — the next PARTICIPATE
        //   submit will simply replace the old draft with a new one.

        try {
          // (2026-05-08) MAX = min(USDT balance, per-asset reservable, global STO cap).
          //   The first two come from /api/me + the asset row (backend now caps
          //   remaining_reservable_usdt by the global silica_max_sto_supply,
          //   but we belt-and-suspenders here to handle deploy lag).
          //   The third is computed from /api/public/config (silica_max_sto_supply
          //   minus silica_sold_sto_total) at the canonical 1 USDT = 1 STO peg.
          console.log('[funding] MAX: fetching /api/me + /api/public/config');
          const [me, cfg] = await Promise.all([
            C.api("/api/me", { auth: true }),
            C.api("/api/public/config", { auth: false }).catch((err) => { console.warn('[funding] cfg fetch err', err); return null; }),
          ]);
          console.log('[funding] MAX: me=', me, 'cfg.silica_max_sto_supply=', cfg?.silica_max_sto_supply, 'cfg.silica_sold_sto_total=', cfg?.silica_sold_sto_total);
          const balance = Math.max(0, Number(me.usdt || 0));
          const reservable = Number.isFinite(Number(a.remaining_reservable_usdt))
            ? Number(a.remaining_reservable_usdt)
            : Math.max(0, Number(a.target_usdt || 0) - Number(a.raised_usdt || 0));

          // Global Silica STO sale supply cap (1 USDT = 1 STO peg).
          //   max=0 means "unlimited" (admin hasn't configured a cap), in which
          //   case we use Infinity so it doesn't constrain the min().
          const stoMax = Number(cfg?.silica_max_sto_supply || 0);
          const stoSold = Number(cfg?.silica_sold_sto_total || 0);
          const stoRemaining = stoMax > 0 ? Math.max(0, stoMax - stoSold) : Infinity;

          const maxAmount = Math.max(0, Math.min(balance, reservable, stoRemaining));
          console.log('[funding] MAX: balance=', balance, 'reservable=', reservable, 'stoRemaining=', stoRemaining, '→ maxAmount=', maxAmount);
          if (maxAmount <= 0) {
            // (2026-05-16 v414) 운영자: '코멘트 너무 단순. 지갑 USDT 부족
            //   안내 + 예치 바로가기 버튼이 있는 팝업 배너.'
            //   3가지 케이스 분기:
            //     1) balance == 0 → USDT 부족 모달 (예치 바로가기)
            //     2) reservable == 0 → 모집 완료 토스트
            //     3) stoRemaining == 0 → STO 한도 도달 토스트
            if (balance <= 0 && typeof window.showInsufficientBalancePopup === "function") {
              window.showInsufficientBalancePopup();
              return;
            }
            if (reservable <= 0) {
              return C.toast(tt(
                "이 자산은 모집이 완료되었습니다.",
                "This asset's funding is complete.",
                "この資産の募集は完了しました。",
                "该资产的募集已完成。"
              ), "bad");
            }
            if (stoRemaining <= 0) {
              return C.toast(tt(
                "SilicaSTO 발행 한도에 도달했습니다.",
                "The SilicaSTO issuance cap has been reached.",
                "SilicaSTOの発行上限に達しました。",
                "SilicaSTO 发行上限已达。"
              ), "bad");
            }
            return C.toast(tt(
              "현재 접수 가능한 잔여 금액이 없습니다.",
              "No remaining amount is currently available.",
              "現在受付可能な残額がありません。",
              "当前没有可受理的剩余金额。"
            ), "bad");
          }
          if (els.amount) els.amount.value = formatInputAmount(Math.floor(maxAmount));
          await updateLocalPreview();
        } catch (e) {
          C.toast(e.message || tt(
            "최대 설정 실패",
            "Failed to set the maximum amount.",
            "最大値の設定に失敗しました。",
            "设置最大值失败。"
          ), "bad");
        }
      });
    }

    if (els.fundBtn && !els.fundBtn.dataset.bound) {
      els.fundBtn.dataset.bound = "1";
      els.fundBtn.addEventListener("click", async () => {
        console.log('[funding] PARTICIPATE clicked. disabled=', els.fundBtn.disabled);
        if (pageState.submittingFund) { console.warn('[funding] PARTICIPATE blocked: already submitting'); return; }
        if (contractState.signing) { console.warn('[funding] PARTICIPATE blocked: contract signing in progress'); return; }

        const w = C.getWallet();
        console.log('[funding] PARTICIPATE: wallet=', w);
        if (!w?.connected) {
          console.warn('[funding] PARTICIPATE blocked: wallet not connected');
          return C.toast(tt("지갑을 연결하세요.", "Please connect your wallet.", "ウォレットを接続してください。", "请连接钱包。"), "bad");
        }

        const a = getSelected();
        console.log('[funding] PARTICIPATE: asset=', a);
        if (!a) { console.error('[funding] PARTICIPATE blocked: no asset selected'); return; }

        if (!isInvestable(String(a.status || ""))) {
          console.warn('[funding] PARTICIPATE blocked: not investable, status=', a.status);
          return C.toast(tt("현재 단계에서는 참여할 수 없습니다.", "Participation is not available at this stage.", "現段階では参加できません。", "当前阶段无法参与。"), "bad");
        }

        const amt = getEnteredAmount();
        console.log('[funding] PARTICIPATE: amount=', amt, 'els.amount.value=', els.amount?.value);
        if (!Number.isFinite(amt) || amt <= 0) {
          console.warn('[funding] PARTICIPATE blocked: amount<=0');
          return C.toast(tt("금액을 입력하세요.", "Please enter an amount.", "金額を入力してください。", "请输入金额。"), "bad");
        }
        if (amt < Number(a.min_usdt || 0)) {
          return C.toast(tt(`최소 참여 금액은 ${C.money.usdt(a.min_usdt, 0)} 입니다.`, `The minimum participation amount is ${C.money.usdt(a.min_usdt, 0)}.`, `最低参加金額は ${C.money.usdt(a.min_usdt, 0)} です。`, `最低参与金额为 ${C.money.usdt(a.min_usdt, 0)}。`), "bad");
        }

        // 클라이언트 사전 잔액 체크
        if (_cachedBalance !== null && _cachedBalance < amt) {
          showBalanceShortage(_cachedBalance);
          C.toast(tt(`USDT 잔액이 부족합니다. (보유: ${C.fmt.num(_cachedBalance, 2)} USDT, 필요: ${C.fmt.num(amt, 2)} USDT)`, `Insufficient USDT balance. (Available: ${C.fmt.num(_cachedBalance, 2)} USDT, Required: ${C.fmt.num(amt, 2)} USDT)`, `USDT残高が不足しています。（保有: ${C.fmt.num(_cachedBalance, 2)} USDT / 必要: ${C.fmt.num(amt, 2)} USDT）`, `USDT 余额不足。（持有：${C.fmt.num(_cachedBalance, 2)} USDT，所需：${C.fmt.num(amt, 2)} USDT）`), "bad");
          if (els.balanceShortage) els.balanceShortage.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        const otpBypassed = await isOtpBypassedFromConfig();
        const otp = normalizeOtp(els.otpCode?.value || "");
        if (!otpBypassed && !/^\d{6}$/.test(otp)) {
          return C.toast(tt("OTP 6자리를 입력하세요.", "Please enter your 6-digit OTP.", "OTP6桁を入力してください。", "请输入6位OTP验证码。"), "bad");
        }

        // 새 플로우: 투자하기 클릭 → 계약서 자동 생성 + 서명 모달 → 서명 시 즉시 투자 실행
        // 환율 차익(서명 후 환율 유리한 시점에 투자) 방지: 계약과 투자가 같은 트랜잭션 호흡으로 묶임.
        const refCode = String(els.refCode?.value || "").trim() || null;

        // (2026-05-18 v497) 운영자 보고: '없는 추천인 입력해도 계약서 팝업이
        //   뜬다 — 초기화 이전엔 정상적으로 막혔던 부분'. PARTICIPATE 핸들러가
        //   refCode 를 모달 오픈 전 검증 안 함 → invalid code 여도 contract
        //   draft 가 생성되고 서명 모달이 뜸. 실제 차단은 /api/funding 서버에서
        //   하므로 사용자가 계약 서명까지 마친 후에야 거부됨 → UX 손상.
        //   수정: refCode 가 비어있지 않으면 /api/referral/validate 로 사전
        //   검증, 실패 시 toast + 모달 미오픈.
        if (refCode) {
          try {
            const v = await C.api(`/api/referral/validate?code=${encodeURIComponent(refCode)}`, { auth: true });
            if (!v?.valid) {
              return C.toast(v?.message || tt(
                "유효하지 않은 추천인 코드입니다.",
                "Invalid referrer code.",
                "無効な紹介コードです。",
                "推荐人代码无效。"
              ), "bad");
            }
          } catch (refErr) {
            return C.toast(refErr?.message || tt(
              "추천인 코드 확인 실패",
              "Failed to verify the referrer code.",
              "紹介コードの確認に失敗しました。",
              "推荐人代码验证失败。"
            ), "bad");
          }
        }

        contractState.pendingInvestment = {
          assetId: a.id,
          amount: amt,
          refCode,
          otp: otpBypassed ? "000000" : otp,
          otpBypassed,
        };

        // 계약서가 이미 user_signed 이고 현재 선택과 일치 → 바로 /api/funding (legacy fast-path)
        const c = contractState.item;
        if (c?.id && String(c.status || "") === "user_signed" && contractMatchesCurrentSelection()) {
          await runInvestmentAfterContract(c, contractState.pendingInvestment);
          return;
        }

        // 그 외 → 새 계약서 draft 생성 + 서명 모달 오픈
        if (els.fundBtn) {
          els.fundBtn.disabled = true;
          els.fundBtn.dataset.busy = "1";
        }
        try {
          const userLang = getLang();
          const r = await C.api("/api/contracts/draft", {
            method: "POST",
            auth: true,
            body: { assetId: a.id, amount: amt, lang: userLang },
          });
          contractState.item = r.contract || null;
          upsertContractListItem(contractState.item);
          if (contractState.item && hydrateAmountFromContract(contractState.item, true)) {
            await updateLocalPreview();
          } else {
            renderContractState();
          }
          if (contractState.item) {
            openContractModal("sign", contractState.item);
          } else {
            C.toast(tt("전자계약서 생성 실패", "Failed to create electronic contract.", "電子契約書の作成に失敗しました。", "电子合同创建失败。"), "bad");
          }
        } catch (e) {
          C.toast(e.message || tt("전자계약서 생성 실패", "Failed to create electronic contract.", "電子契約書の作成に失敗しました。", "电子合同创建失败。"), "bad");
        } finally {
          if (els.fundBtn) {
            els.fundBtn.disabled = false;
            delete els.fundBtn.dataset.busy;
          }
        }
      });
    }

    // 서명 완료 직후 투자 실행 (계약+투자 원자적 묶음)
    const runInvestmentAfterContract = async (contract, pending) => {
      if (!contract?.id || !pending) return;

      pageState.submittingFund = true;
      if (els.fundBtn) {
        els.fundBtn.disabled = true;
        els.fundBtn.dataset.busy = "1";
      }
      if (els.contractSaveBtn) {
        els.contractSaveBtn.disabled = true;
        els.contractSaveBtn.textContent = tt("투자 처리 중…", "Processing investment…", "投資処理中…", "投资处理中…");
      }

      try {
        const r = await C.api("/api/funding", {
          method: "POST",
          auth: true,
          body: {
            assetId: pending.assetId,
            amount: pending.amount,
            refCode: pending.refCode,
            contractId: contract.id,
            otp: pending.otp,
          },
        });

        if (els.otpCode) els.otpCode.value = "";
        contractState.pendingInvestment = null;

        // 모달 닫고 성공 팝업 띄움
        closeContractModal();
        showInvestmentSuccess({
          amount: pending.amount,
          contractNo: contract.contract_no || contract.id,
          status: r?.status || "",
          asset: getSelected(),
        });
      } catch (e) {
        // (2026-05-16 v427) 운영자 보고: '서명 버튼 눌러도 다른 플로우로 넘어가지
        //   않는다' + 콘솔에 /api/funding 500. 기존 catch 는 토스트만 띄우고
        //   modal 을 닫지 않아 사용자가 어떤 에러인지 인지 어려움. 강화:
        //   - console.error 로 status/detail 포함 출력 (진단 용이)
        //   - e.detail 을 토스트 메시지에 추가
        //   - modal 명시적 닫기 (사용자가 다시 시도 가능 상태로)
        console.error("[/api/funding] error:", e?.status, e?.message, e?.detail, e?.data);
        const baseMsg = e?.message || tt("참여 실패", "Investment failed.", "参加に失敗しました。", "参与失败。");
        const detail = e?.detail ? ` (${e.detail})` : "";
        const msg = baseMsg + detail;
        C.toast(msg, "bad");
        if (msg.includes("잔액 부족") || msg.includes("잔액") || msg.toLowerCase().includes("balance") || msg.toLowerCase().includes("insufficient")) {
          await updateBalanceNotice();
          if (els.balanceShortage) {
            els.balanceShortage.style.display = "";
            els.balanceShortage.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
        // 실패 후 modal 닫아서 사용자가 다시 시도할 수 있게 함 (재서명 흐름).
        try { closeContractModal(); } catch {}
        await updateUI();
      } finally {
        pageState.submittingFund = false;
        if (els.fundBtn) {
          els.fundBtn.disabled = false;
          delete els.fundBtn.dataset.busy;
        }
        if (els.contractSaveBtn) {
          els.contractSaveBtn.textContent = tt("서명 완료", "Complete Signature", "署名完了", "完成签名");
          updateContractSaveButtonState();
        }
      }
    };

    // 투자 성공 팝업 표시
    const showInvestmentSuccess = (info) => {
      const modal = document.getElementById("investSuccessModal");
      if (!modal) {
        // 폴백: 모달이 없으면 토스트 + 리다이렉트
        C.toast(tt("투자가 완료되었습니다.", "Your investment has been completed.", "投資が完了しました。", "投资已完成。"), "good");
        setTimeout(() => { location.href = "portfolio.html"; }, 800);
        return;
      }

      const amtEl = document.getElementById("investSuccessAmount");
      const krwEl = document.getElementById("investSuccessKrw");
      const contractEl = document.getElementById("investSuccessContract");
      const noteEl = document.getElementById("investSuccessNote");

      if (amtEl) amtEl.textContent = `${C.fmt.num(info.amount, 2)} USDT`;
      // (2026-05-08) Drop the KRW reference line on the success popup —
      //   사장님: 원화 환산 표기는 불필요. The hidden #investSuccessKrw
      //   element is kept in the DOM for backward compatibility but is
      //   left empty so it doesn't render.
      if (krwEl) krwEl.textContent = "";
      // (2026-05-07) STO 수량 표시 — 1 SilicaSTO = 1 USDT 페그.
      const tokensEl = document.getElementById("investSuccessTokens");
      if (tokensEl) tokensEl.textContent = `${C.fmt.num(info.amount, 2)} SilicaSTO`;
      if (contractEl) contractEl.textContent = info.contractNo || "-";
      if (noteEl) {
        noteEl.textContent = info.status === "구매진행"
          ? tt(
              "관리자 서명이 완료되면 목표 달성 여부가 확정 반영됩니다.",
              "Once the administrator's signature is complete, the funding goal status will be finalized.",
              "管理者の署名が完了すると、目標達成の有無が確定反映されます。",
              "管理员签名完成后将最终确认目标达成情况。"
            )
          : tt(
              "참여 신청이 접수되었습니다. 관리자 서명 완료 후 모금액에 확정 반영됩니다.",
              "Your participation has been submitted. It will be reflected in the funded amount once the administrator's signature is complete.",
              "参加申請を受け付けました。管理者の署名完了後に募集額に確定反映されます。",
              "您的参与申请已受理，管理员签名完成后将计入募集金额。"
            );
      }

      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      modal.removeAttribute("inert");

      const closeBtn = document.getElementById("investSuccessCloseBtn");
      const goBtn = document.getElementById("investSuccessGoBtn");
      const backdrop = modal.querySelector(".invest-success-backdrop");
      const closeFn = () => { location.href = "portfolio.html"; };
      if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = "1";
        closeBtn.addEventListener("click", closeFn);
      }
      if (goBtn && !goBtn.dataset.bound) {
        goBtn.dataset.bound = "1";
        goBtn.addEventListener("click", closeFn);
      }
      if (backdrop && !backdrop.dataset.bound) {
        backdrop.dataset.bound = "1";
        backdrop.addEventListener("click", closeFn);
      }
    };
    // expose for submitContractSignature scope (declared earlier in same closure)
    contractState._runInvestmentAfterContract = runInvestmentAfterContract;

    if (!window.__fundingContractResizeBound) {
      window.__fundingContractResizeBound = true;
      window.addEventListener("resize", () => {
        if (!els.contractModal?.classList.contains("hidden") && contractState.modalMode === "sign") {
          requestAnimationFrame(() => {
            resizeSignatureCanvas();
            updateContractSaveButtonState();
          });
        }
      });
    }

    // OTP: second pass — ensure correct visibility
    try {
      const otpBypassed = await isOtpBypassedFromConfig();
      const otpField = C.qs("#fundOtpField");
      const otpStep = C.qs("#contractOtpStep");
      if (otpBypassed) {
        if (otpField) otpField.style.display = "none";
        if (otpStep) otpStep.style.display = "none";
      } else {
        if (otpField) otpField.style.display = "";
        if (otpStep) otpStep.style.display = "";
      }
    } catch {}

    bindSignaturePad();
    await updateUI();

    // (2026-05-11 v253) Deep-link entry — assets.html?id=&amount= ... 외부
    // 컴포넌트가 amount 를 미리 채워 들고 들어올 경우 곧바로 계약 검토/서명
    // 모달을 자동으로 띄운다. (구 funding.html 페이지는 v253 에서 제거 —
    // assets.html 와 중복이었음. body data-page="funding" 그대로라 본 핸들러는
    // assets.html 에서도 동일하게 실행된다.)
    try {
      const amtParam = C.getParam("amount");
      if (amtParam && els.amount && Number(els.amount.value) > 0) {
        // 약간의 지연으로 페이지 렌더 완료 후 모달 띄우기 (지갑 미연결 / 비활성 자산 등은 실패해도 무해)
        setTimeout(() => { try { createContractDraft(); } catch (_) {} }, 350);
      }
    } catch (_) {}
  };
})();