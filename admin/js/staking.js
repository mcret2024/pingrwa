(() => {
  "use strict";

  const { qs, api, toast, bootAdminPage } = window.AdminCore;

  const OPERATIONAL_STATUSES = new Set(["분배중", "운영중", "매각"]);
  // (2026-05-06) Silica 단순 상태머신 호환 — '활성' 추가, legacy(분배중/운영중) 도 유지.
  const INTEREST_ACTIVE_STATUSES = new Set(["활성", "분배중", "운영중"]);

  const payoutTrunc1 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.floor((x + 1e-9) * 10) / 10;
  };

  const fmt = (n, d = 0) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const toInt = (v, fb = null) => {
    const x = Number(String(v ?? "").replace(/,/g, "").trim());
    if (!Number.isFinite(x)) return fb;
    return Math.floor(x);
  };

  const toDec = (v, fb = null) => {
    const x = Number(String(v ?? "").replace(/,/g, "").trim());
    if (!Number.isFinite(x)) return fb;
    return x;
  };

  const PREVIEW_TOKEN_COUNT = 100;

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("staking");
    if (!me) return;

    // ---------- Global UI ----------
    const paydayEl = qs("#payday");
    const lockDaysEl = qs("#lockDays");
    const previewEl = qs("#globalPreview");
    const refreshBtn = qs("#stkRefreshBtn");
    const saveGlobalBtn = qs("#stkSaveGlobalBtn");

    // ---------- Asset UI ----------
    const assetSel = qs("#aprAssetSelect");
    const assetSettleCcyEl = qs("#assetSettleCcy");
    const assetStatusEl = qs("#assetStatus");
    const aprValueEl = qs("#aprValue");

    // NOTE: officialPriceKrw / supplyToken / fundedSnapshotUsdt 필드는
    // admin/staking.html에서 제거됨 (자산 관리 페이지에서만 관리).
    // 하위 호환을 위해 null 참조 허용.
    const officialPriceEl = null;
    const supplyTokenEl = null;
    const fundedSnapshotEl = null;

    const officialCcyEl = null;
    const supplyCcyEl = null;

    const assetSaveBtn = qs("#assetSaveBtn");
    const assetTestBtn = qs("#assetTestBtn");
    const forceInterestBtn = qs("#forceInterestBtn");
    const testInterestBtn = qs("#testInterestBtn");   // (v359) 테스트용 — 항상 활성

    if (assetTestBtn) { assetTestBtn.disabled = true; assetTestBtn.style.display = 'none'; }

    // ---------- Calc UI ----------
    // (2026-05-07) USDT-fixed 모델 — 환율 카드 / 정산통화 단가 표기가 사라졌다.
    // 노출 요소: 연 이자 + 월 이자 두 칸.
    const perTokenAnnualEl = qs("#calcPerTokenAnnualUsdt");
    const perTokenUsdtEl   = qs("#calcPerTokenMonthlyUsdt");

    let assets = [];
    let fxRates = {};

    const loadAssets = async (selectedId = null) => {
      const keepId = String(selectedId || assetSel?.value || "").trim();
      const r = await api("/api/assets", { method: "GET" });
      const all = r.assets || [];
      // (2026-05-06) Silica 단순 상태머신 호환 — 화이트리스트 → 블랙리스트.
      // 매각/매각(완료)/모집실패/취소됨 만 제외, 그 외(활성 + legacy 분배중/운영중) 모두 포함.
      const NON_ELIGIBLE = new Set(["매각", "매각(완료)", "모집실패", "취소됨"]);
      assets = all.filter((a) => !NON_ELIGIBLE.has(String(a.status || "").trim()));

      if (assetSel) {
        if (assets.length === 0) {
          assetSel.innerHTML = `<option value="">(스테이킹 가능 자산 없음)</option>`;
        } else {
          assetSel.innerHTML = assets.map(a => `<option value="${a.id}">${a.id} · ${a.name}</option>`).join("");
          // 단일 자산 (Silica) 환경 호환: keepId 가 없으면 자동으로 첫 번째 자산 선택.
          if (keepId && assets.some(a => a.id === keepId)) {
            assetSel.value = keepId;
          } else {
            assetSel.value = assets[0].id;
          }
        }
      }
    };

    const loadGlobal = async () => {
      const r = await api("/api/admin/settings/staking", { method: "GET" }).catch(() => null);
      const payday = r?.payday ?? 15;
      const lockDays = Array.isArray(r?.lock_days) ? r.lock_days.join(",") : "14,15";

      if (paydayEl) { paydayEl.value = String(payday); paydayEl.disabled = true; paydayEl.readOnly = true; }
      if (lockDaysEl) { lockDaysEl.value = String(lockDays); lockDaysEl.disabled = true; lockDaysEl.readOnly = true; }
      if (previewEl) previewEl.textContent = `지급일: ${payday}일 / 락: ${lockDays}`;
      if (saveGlobalBtn) saveGlobalBtn.disabled = true;
    };

    const loadPublicConfig = async () => {
      const r = await api("/api/public/config", { method: "GET" }).catch(() => null);
      fxRates = r?.fx_rates || {};
    };

    const getSelectedAsset = () => {
      const id = String(assetSel?.value || "").trim();
      return assets.find(x => x.id === id) || null;
    };

    const fetchFreshAsset = async (assetId) => {
      return api(`/api/assets/${encodeURIComponent(assetId)}`, { method: "GET" })
        .then(r => r.asset || null)
        .catch(() => null);
    };

    // (2026-05-07) Silica USDT-fixed 모델 — 자산 record 의 settlement_basis 가
    // null/빈값이면 KRW 가 아니라 USDT 로 fallback. RECON 의 KRW 디폴트 유산.
    const getSettleCcy = (a) => String(a?.settlement_basis || "USDT").toUpperCase();

    const getFxNow = (ccy) => {
      const fx = Number(fxRates?.[String(ccy || "USDT").toUpperCase()] || 0);
      return (Number.isFinite(fx) && fx > 0) ? fx : 0;
    };

    const setCcyLabels = (ccy) => {
      const k = String(ccy || "USDT").toUpperCase();
      if (assetSettleCcyEl) assetSettleCcyEl.textContent = k;
      if (officialCcyEl) officialCcyEl.textContent = k;
      if (supplyCcyEl) supplyCcyEl.textContent = k;
    };

    const fillAssetFields = () => {
      const a = getSelectedAsset();
      if (!a) return;

      if (assetStatusEl) { assetStatusEl.value = String(a.status || "모집중"); assetStatusEl.disabled = true; }
      if (aprValueEl) aprValueEl.value = String(a.apr ?? "");

      if (officialPriceEl) officialPriceEl.value = (a.official_price_krw == null ? "" : String(a.official_price_krw));
      if (supplyTokenEl) supplyTokenEl.value = (a.supply_token == null ? "" : String(a.supply_token));
      if (fundedSnapshotEl) fundedSnapshotEl.value = (a.funded_snapshot_usdt == null ? "" : String(a.funded_snapshot_usdt));

      const ccy = getSettleCcy(a);
      setCcyLabels(ccy);

      updateCalcPreview();

      if (forceInterestBtn) {
        const activeForInterest = INTEREST_ACTIVE_STATUSES.has(String(a.status || "").trim());
        // 자산 상태 기반 1차 disable. payment-status gating 은 별도 함수에서.
        forceInterestBtn.disabled = !activeForInterest;
        forceInterestBtn.title = activeForInterest ? "" : "매각 상태 자산은 당월 이자를 배정할 수 없습니다.";
        // (2026-05-14 v357) payment-status 재해 검출 결과로 최종 disable 토글.
        refreshDisasterGate();
      }
    };

    // (2026-05-14 v357) 운영자: '이 버튼들은 이슈가 있지 않다면 비활성화
    //   되어야한다.' 평상시엔 cron 자동 처리되므로 admin 수동 개입 불필요 →
    //   button disabled. /api/silica/payment-status 가 overdue_interest=true
    //   반환 시 (= 14~16일 cron 실패 후 17일+ 상태) 만 활성화.
    let _disasterCache = null;   // { has_pending, overdue_interest, fetched_at }
    const fetchDisasterStatus = async () => {
      try {
        // 1분 cache — 자산 선택 토글마다 fetch 폭주 방지
        if (_disasterCache && (Date.now() - _disasterCache.fetched_at) < 60_000) {
          return _disasterCache;
        }
        const r = await api("/api/silica/payment-status", { auth: false });
        _disasterCache = {
          has_pending: !!r?.has_pending,
          overdue_interest: !!r?.overdue_interest,
          overdue_dividends: Array.isArray(r?.overdue_dividends) ? r.overdue_dividends : [],
          fetched_at: Date.now(),
        };
        return _disasterCache;
      } catch (_) {
        // 검출 실패 시 보수적으로 비활성화 (재해라고 단정 불가)
        return { has_pending: false, overdue_interest: false, overdue_dividends: [], fetched_at: Date.now() };
      }
    };

    const refreshDisasterGate = async () => {
      if (!forceInterestBtn) return;
      const stateEl = qs("#forceInterestState");
      // (v902) 두 재해 복구 카드 자체의 표시/숨김 제어 + grid 컬럼 동적 조정
      const forceCard = qs("#forceInterestCard");
      const catchUpCard = qs("#catchUpAccrualCard");
      const cardGrid = qs("#interestCardGrid");
      const selected = getSelectedAsset();
      const activeForInterest = selected
        ? INTEREST_ACTIVE_STATUSES.has(String(selected.status || "").trim())
        : false;

      // 자산이 비활성 (매각 등) 이면 어떤 경우에도 비활성 + 안내.
      if (!activeForInterest) {
        forceInterestBtn.disabled = true;
        // (v902) 매각 자산도 운영자가 상황 파악 가능하도록 forceInterestCard 만 노출
        //   (catch-up 은 회차 명시 입력이 별도라 매각 자산과 무관 — 숨김 유지)
        if (forceCard) forceCard.style.display = "";
        if (catchUpCard) catchUpCard.style.display = "none";
        if (cardGrid) cardGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
        if (stateEl) {
          stateEl.style.display = "";  // (v901) 안내 박스 표시
          stateEl.style.background = "rgba(148,163,184,0.10)";
          stateEl.style.borderColor = "rgba(148,163,184,0.30)";
          stateEl.style.color = "#475569";
          stateEl.textContent = "— 매각 상태 자산은 당월 이자를 배정할 수 없습니다.";
        }
        return;
      }

      const ds = await fetchDisasterStatus();
      if (ds.overdue_interest) {
        // 재해 검출 — 두 카드 모두 표시 + force-interest 활성화 + 빨강 강조
        forceInterestBtn.disabled = false;
        forceInterestBtn.title = "재해 복구 모드: 미지급 이자 강제 배정";
        // (v902) 재해 시 두 카드 모두 표시 + grid 3컬럼
        if (forceCard) forceCard.style.display = "";
        if (catchUpCard) catchUpCard.style.display = "";
        if (cardGrid) cardGrid.style.gridTemplateColumns = "repeat(3, 1fr)";
        if (stateEl) {
          stateEl.style.display = "";  // (v901) 안내 박스 표시
          stateEl.style.background = "rgba(220,38,38,0.08)";
          stateEl.style.borderColor = "rgba(220,38,38,0.30)";
          stateEl.style.color = "#991B1B";
          stateEl.innerHTML = "⚠ <strong>재해 검출:</strong> 이번 달 이자 자동 처리가 완료되지 않았습니다. 수동 배정 가능.";
        }
      } else {
        // 평상시 — 두 카드 모두 숨김 + grid 1컬럼 (이자 계산 미리보기만 풀폭)
        forceInterestBtn.disabled = true;
        forceInterestBtn.title = "현재 정상 운영 중 — 수동 배정 불필요";
        // (v902) 평상시 두 재해 복구 카드 모두 숨김 — 운영자 요청
        if (forceCard) forceCard.style.display = "none";
        if (catchUpCard) catchUpCard.style.display = "none";
        if (cardGrid) cardGrid.style.gridTemplateColumns = "1fr";
        if (stateEl) {
          // (v901) 정상 운영 중 안내 텍스트 제거 — 운영자 요청. 박스 자체 숨김.
          stateEl.style.display = "none";
          stateEl.textContent = "";
        }
      }
    };

    // (2026-05-07) USDT-fixed 모델 단순화 — 1 TOKEN = 1 USDT 페그.
    //   환율(지급시점) UI 와 정산통화→USDT 변환 단계가 모두 제거됨.
    //   연이자 = PREVIEW_TOKEN_COUNT × APR / 100
    //   월이자 = 연이자 / 12 → 소수 첫째 자리에서 절삭 (서버 동일)
    const updateCalcPreview = () => {
      const a = getSelectedAsset();
      if (!a) return;

      const apr = toDec(aprValueEl?.value, Number(a.apr || 0)) || 0;
      const annualRaw  = apr > 0 ? PREVIEW_TOKEN_COUNT * (apr / 100) : 0;
      const monthlyRaw = annualRaw / 12;
      const monthlyFinal = payoutTrunc1(monthlyRaw);

      if (perTokenAnnualEl) {
        perTokenAnnualEl.textContent = annualRaw > 0 ? `${fmt(annualRaw, 2)} USDT` : "-";
      }
      if (perTokenUsdtEl) {
        perTokenUsdtEl.textContent = monthlyFinal > 0 ? `${fmt(monthlyFinal, 1)} USDT` : "-";
      }
    };

    const saveGlobal = async () => {
      toast("이자 지급일과 정산 락 기간은 이 페이지에서 수정할 수 없습니다.", "bad");
    };

    const buildUpsertPayload = (a, patch) => {
      return {
        id: a.id,
        country_code: a.country_code,
        settlement_basis: a.settlement_basis,

        market: a.market,
        name: a.name,
        status: patch.status ?? a.status,

        type: a.type,
        location: a.location,
        map_query: a.map_query,
        image_url: a.image_url,
        token_image_url: a.token_image_url,
        overview: a.overview,

        target_usdt: a.target_usdt,
        raised_usdt: a.raised_usdt,
        min_usdt: a.min_usdt,
        expected_buy_price_usdt: a.expected_buy_price_usdt,

        apr: patch.apr ?? a.apr,

        fund_end_date: a.fund_end_date ? String(a.fund_end_date).slice(0,10) : null,

        fx_at_funding: a.fx_at_funding,

        official_price_krw: patch.official_price_krw ?? a.official_price_krw,
        supply_token: patch.supply_token ?? a.supply_token,
        funded_snapshot_usdt: patch.funded_snapshot_usdt ?? a.funded_snapshot_usdt,

        fee_buyer: a.fee_buyer,
        fee_seller: a.fee_seller,
      };
    };

    const validateOperationalPatch = (fresh, patch) => {
      const finalStatus = String(patch.status ?? fresh.status ?? "").trim();
      if (!OPERATIONAL_STATUSES.has(finalStatus)) return null;

      const finalSupply = Number(patch.supply_token ?? fresh.supply_token ?? 0);
      const finalSnapshot = Number(
        patch.funded_snapshot_usdt ??
        fresh.funded_snapshot_usdt ??
        fresh.raised_usdt ??
        0
      );
      const finalFx = Number(fresh.fx_at_funding || 0);

      if (!(finalFx > 0)) {
        return "확정 환율(fx_at_funding)이 없어 운영 상태로 저장하면 안됩니다.";
      }
      if (!(finalSupply > 0)) {
        return "발행량(supply_token)이 0보다 커야 운영 상태로 저장할 수 있습니다.";
      }
      if (!(finalSnapshot > 0)) {
        return "분배 스냅샷(funded_snapshot_usdt)이 0보다 커야 운영 상태로 저장할 수 있습니다.";
      }

      return null;
    };

    const saveAsset = async (patch, freshAsset = null) => {
      const selected = getSelectedAsset();
      if (!selected) return toast("자산을 선택하세요.", "bad");

      const fresh = freshAsset || await fetchFreshAsset(selected.id);
      if (!fresh) return toast("자산을 찾을 수 없음", "bad");

      const payload = buildUpsertPayload(fresh, patch);

      await api("/api/admin/assets/upsert", {
        method: "POST",
        body: { asset: payload }
      });

      toast("자산 설정 저장 완료", "good");
      await loadAssets(fresh.id);
      fillAssetFields();
    };

    const saveAssetAllFromInputs = async (opts = {}) => {
      const selected = getSelectedAsset();
      if (!selected) return toast("자산을 선택하세요.", "bad");

      const fresh = await fetchFreshAsset(selected.id);
      if (!fresh) return toast("자산을 찾을 수 없음", "bad");

      const status = String(fresh.status || "").trim();

      // APR is read-only on staking page; use the server value directly
      const apr = toDec(aprValueEl?.value, null);
      if (!Number.isFinite(apr) || apr < 0 || apr > 100) return toast("APR은 0~100", "bad");

      // 스테이킹 페이지는 status + apr만 관리 — official/supply/snapshot은 자산 페이지에서
      const patch = {
        status,
        apr,
      };

      const opError = validateOperationalPatch(fresh, patch);
      if (opError) return toast(opError, "bad");

      const prevStatus = String(fresh.status || "").trim();
      if ((opts.requireConfirm !== false) && prevStatus !== status && OPERATIONAL_STATUSES.has(status)) {
        const lang = (window.AdminI18n?.getLang?.() || 'ko');
        const msg = ({
          ko: `선택 자산 상태를 "${status}"로 저장합니다.\n실제 운영 데이터인지 다시 확인하세요.`,
          en: `Save the selected asset's status as "${status}".\nPlease confirm this is real operational data.`,
          ja: `選択した資産のステータスを「${status}」で保存します。\n実際の運用データか再度ご確認ください。`,
          zh: `将所选资产的状态保存为 "${status}"。\n请再次确认是否为真实运营数据。`,
        })[lang] || `선택 자산 상태를 "${status}"로 저장합니다.\n실제 운영 데이터인지 다시 확인하세요.`;
        const ok = window.confirm(msg);
        if (!ok) return;
      }

      await saveAsset(patch, fresh);
    };

    // ---------- events ----------
    refreshBtn?.addEventListener("click", async () => {
      try {
        const keepId = String(assetSel?.value || "").trim();
        await loadAssets(keepId);
        await loadGlobal();
        await loadPublicConfig();
        fillAssetFields();
        toast("새로고침 완료", "good");
      } catch (e) {
        toast(e.message || "실패", "bad");
      }
    });

    saveGlobalBtn?.addEventListener("click", async () => {
      try {
        await saveGlobal();
      } catch (e) {
        toast(e.message || "저장 실패", "bad");
      }
    });

    assetSel?.addEventListener("change", fillAssetFields);


    assetSaveBtn?.addEventListener("click", async () => {
      try {
        await saveAssetAllFromInputs({ requireConfirm: true });
      } catch (e) {
        toast(e.message || "저장 실패", "bad");
      }
    });

    assetTestBtn?.addEventListener("click", async () => {
      toast("자산 상태 변경은 자산관리 페이지에서만 가능합니다.", "bad");
    });

    // (2026-05-14 v359) testInterestBtn + forceInterestBtn 두 버튼이 같은
    //   force-interest 엔드포인트를 공유 — confirm 메시지만 mode 에 따라 다름.
    //   - mode='test': 개발/검증용. 항상 활성, 중복 배정 안내.
    //   - mode='disaster': 재해 복구용. payment-status 기반 활성, 중복 위험 경고.
    const runForceInterest = async (btn, mode) => {
      try {
        const selected = getSelectedAsset();
        if (!selected) return toast("자산을 선택하세요.", "bad");
        if (!INTEREST_ACTIVE_STATUSES.has(String(selected.status || "").trim())) {
          return toast("매각 상태 자산은 해당월 이자를 배정할 수 없습니다.", "bad");
        }

        // 언어별 confirm 템플릿 — mode 에 따라 분기.
        const lang = (window.AdminI18n?.getLang?.() || 'ko');
        const isDisaster = mode === 'disaster';
        const T = {
          ko: {
            confirm: (id) => isDisaster
              ? `⚠ 재해 복구 모드\n\n선택 자산(${id})의 스테이커들에게 1개월 이자를 즉시 배정합니다.\n같은 월에 이미 배정된 사용자가 있을 경우 중복 배정될 수 있으므로 신중히 진행하세요.\n계속하시겠습니까?`
              : `선택 자산(${id})의 스테이커들에게 1개월 이자를 지금 즉시 배정합니다.\n테스트용으로 같은 월에도 버튼을 누를 때마다 중복 배정됩니다.\n계속하시겠습니까?`,
            result: (paid, total, failed) => `${paid}명에게 1개월 이자를 배정했습니다.\n총 배정: ${total} USDT (소수 첫째 자리 기준)${failed > 0 ? `\n실패: ${failed}건` : ''}`,
            noTarget: "지급 대상이 없습니다.",
            failed: "이자 지급 실패",
          },
          en: {
            confirm: (id) => isDisaster
              ? `⚠ Disaster Recovery Mode\n\nThis will immediately allocate 1 month of interest to all stakers of the selected asset (${id}).\nIf interest has already been allocated for the current month, this may cause duplicate allocation. Proceed with caution.\nContinue?`
              : `This will immediately allocate 1 month of interest to all stakers of the selected asset (${id}).\nFor testing, duplicate allocation is allowed within the same month on each click.\nContinue?`,
            result: (paid, total, failed) => `Monthly interest allocated to ${paid} staker(s).\nTotal: ${total} USDT (first decimal place)${failed > 0 ? `\nFailed: ${failed}` : ''}`,
            noTarget: "No recipients found.",
            failed: "Interest allocation failed.",
          },
          ja: {
            confirm: (id) => isDisaster
              ? `⚠ 災害復旧モード\n\n選択資産（${id}）のステーカーに1か月分の利息を即時配分します。\n同月内に既に配分済みの場合、重複配分の恐れがあります。慎重に進めてください。\n続行しますか？`
              : `選択資産（${id}）のステーカーに1か月分の利息を今すぐ配分します。\nテストのため、同月内でもボタンを押すたびに重複配分されます。\n続行しますか？`,
            result: (paid, total, failed) => `${paid}名に1か月分の利息を配分しました。\n合計: ${total} USDT（小数第1位まで）${failed > 0 ? `\n失敗: ${failed}件` : ''}`,
            noTarget: "対象者がいません。",
            failed: "利息配分に失敗しました。",
          },
          zh: {
            confirm: (id) => isDisaster
              ? `⚠ 灾难恢复模式\n\n将立即向所选资产（${id}）的质押者分配1个月利息。\n如果当月已分配，可能造成重复分配。请谨慎操作。\n继续吗？`
              : `将立即向所选资产（${id}）的质押者分配1个月利息。\n测试用途:同月内每次点击都会重复分配。\n继续吗？`,
            result: (paid, total, failed) => `已向 ${paid} 名质押者分配1个月利息。\n合计: ${total} USDT (小数第1位)${failed > 0 ? `\n失败: ${failed}` : ''}`,
            noTarget: "没有可分配的对象。",
            failed: "利息分配失败。",
          },
        };
        const t = T[lang] || T.ko;

        const ok = window.confirm(t.confirm(selected.id));
        if (!ok) return;

        if (btn) btn.disabled = true;
        // (2026-05-21 보안감사) mode 인자를 body 에 포함 — backend 가 mode 별 중복 체크 분기.
        //   'disaster' : per-holder 중복 체크 적용 (운영 안전).
        //   'test'     : 중복 체크 우회 (devnet 반복 테스트). 운영 전환 시 제거.
        const r = await api("/api/admin/staking/force-interest", {
          method: "POST",
          body: { assetId: selected.id, mode: mode }
        });

        const paid = Number(r?.paid_count || 0);
        const alreadyPaid = Number(r?.already_paid_count || 0);
        const failed = Number(r?.failed_count || 0);
        const total = Number(r?.total_interest_usdt || 0);

        if (paid > 0 || alreadyPaid > 0) {
          // 결과 메시지에 already_paid 포함 (mode='disaster' 일 때 의미 있음).
          const alreadyLine = alreadyPaid > 0
            ? ({
                ko: `\n이미 처리됨 (skip): ${alreadyPaid}명`,
                en: `\nAlready paid (skipped): ${alreadyPaid}`,
              }[lang] || `\n이미 처리됨: ${alreadyPaid}명`)
            : '';
          const msg = t.result(paid, fmt(total, 1), failed) + alreadyLine;
          toast(msg.split('\n').join(' / '), "good");
          window.alert(msg);
        } else {
          window.alert(t.noTarget);
          toast(t.noTarget, "bad");
        }
      } catch (e) {
        const lang2 = (window.AdminI18n?.getLang?.() || 'ko');
        const failedMsg = ({ ko: "이자 지급 실패", en: "Interest allocation failed.", ja: "利息配分に失敗しました。", zh: "利息分配失败。" })[lang2] || "이자 지급 실패";
        toast(e.message || failedMsg, "bad");
      } finally {
        // 테스트 버튼은 항상 활성. 재해 복구 버튼은 refreshDisasterGate 가 재토글.
        if (btn === testInterestBtn && btn) btn.disabled = false;
        if (btn === forceInterestBtn) refreshDisasterGate();
      }
    };

    // (2026-05-26 v861) Mainnet 전환 — testInterestBtn 이벤트 비활성화.
    //   HTML 의 testInterestCard 도 함께 주석 처리됨. devnet 회귀 테스트
    //   필요 시 두 곳 모두 주석 해제. 백엔드 staking.php 의 mainnet 가드도
    //   별도로 차단하므로 다중 안전망.
    // testInterestBtn?.addEventListener("click", () => runForceInterest(testInterestBtn, 'test'));
    forceInterestBtn?.addEventListener("click", () => runForceInterest(forceInterestBtn, 'disaster'));

    // ---------- 이자 지급 로그 — 2단계 뷰 (2026-05-15 v371) ----------
    //   1) 회차별 집계 (가벼움) — 메인 카드에 표시
    //   2) row 클릭 → 모달 → 세부 50개씩 페이지네이션
    const fmtAddr = (a) => {
      const s = String(a || '');
      return s.length > 12 ? s.slice(0, 6) + '...' + s.slice(-4) : s;
    };

    // -------- 1단계: 회차별 집계 --------
    const interestSummaryBody = qs("#interestSummaryBody");
    const interestSummaryRefresh = qs("#interestSummaryRefresh");

    const renderInterestSummary = async () => {
      if (!interestSummaryBody) return;
      interestSummaryBody.innerHTML = '<tr><td colspan="7" class="text-center muted" style="padding:24px 0;">로딩 중…</td></tr>';
      try {
        const r = await api('/api/admin/staking/interest-summary?limit=24', { method: 'GET' });
        const rows = Array.isArray(r?.rows) ? r.rows : [];
        if (!rows.length) {
          interestSummaryBody.innerHTML = '<tr><td colspan="7" class="text-center muted" style="padding:24px 0;">아직 지급 이력이 없습니다.</td></tr>';
          return;
        }
        interestSummaryBody.innerHTML = rows.map((row) => {
          const monthKey = String(row.month_key || '—');
          const assetId = String(row.asset_id || '—');
          const total = Number(row.total_count || 0);
          const paid = Number(row.paid_count || 0);
          const pending = Number(row.pending_count || 0);
          const totalUsdt = Number(row.total_usdt || 0).toFixed(1);
          const firstCreated = String(row.first_created_at || '—').slice(0, 16);
          return `
            <tr data-month-key="${monthKey}" data-asset-id="${assetId}"
                style="cursor:pointer;transition:background .15s ease;"
                onmouseover="this.style.background='rgba(124,58,237,0.04)'"
                onmouseout="this.style.background=''">
              <td style="font-family:'Space Grotesk',monospace;font-weight:700;">${monthKey}</td>
              <td style="font-family:'Space Grotesk',monospace;font-size:11.5px;">${assetId}</td>
              <td style="text-align:right;font-family:'Space Grotesk',monospace;">${total.toLocaleString('ko-KR')}</td>
              <td style="text-align:right;font-family:'Space Grotesk',monospace;color:#047857;font-weight:700;">${paid.toLocaleString('ko-KR')}</td>
              <td style="text-align:right;font-family:'Space Grotesk',monospace;color:${pending > 0 ? '#92400E' : 'var(--muted)'};font-weight:${pending > 0 ? '700' : '400'};">${pending.toLocaleString('ko-KR')}</td>
              <td style="text-align:right;font-family:'Space Grotesk',monospace;font-weight:700;">${totalUsdt}</td>
              <td style="font-family:'Space Grotesk',monospace;font-size:11.5px;color:var(--muted);">${firstCreated}</td>
            </tr>`;
        }).join('');

        interestSummaryBody.querySelectorAll('tr[data-month-key]').forEach((tr) => {
          tr.addEventListener('click', () => {
            const mk = tr.getAttribute('data-month-key');
            const aid = tr.getAttribute('data-asset-id');
            if (mk && aid) openInterestDetailModal(mk, aid);
          });
        });
      } catch (e) {
        interestSummaryBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:24px 0;color:#DC2626;">로딩 실패: ${(e && e.message) || e}</td></tr>`;
      }
    };

    interestSummaryRefresh?.addEventListener('click', renderInterestSummary);
    renderInterestSummary();

    // -------- 2단계: 세부 모달 + 페이지네이션 --------
    const interestDetailModal = qs("#interestDetailModal");
    const interestDetailBackdrop = qs("#interestDetailBackdrop");
    const interestDetailClose = qs("#interestDetailClose");
    const interestDetailTitle = qs("#interestDetailTitle");
    const interestDetailBody = qs("#interestDetailBody");
    const interestDetailMeta = qs("#interestDetailMeta");
    const interestDetailPrev = qs("#interestDetailPrev");
    const interestDetailNext = qs("#interestDetailNext");
    const interestDetailPageInfo = qs("#interestDetailPageInfo");

    const PAGE_SIZE = 50;
    const detailState = { monthKey: '', assetId: '', offset: 0, total: 0, address: '', status: '' };
    const interestDetailSearch = qs("#interestDetailSearch");
    const interestDetailStatus = qs("#interestDetailStatus");
    const interestDetailSearchClear = qs("#interestDetailSearchClear");

    const renderInterestDetailPage = async () => {
      if (!interestDetailBody) return;
      interestDetailBody.innerHTML = '<tr><td colspan="9" class="text-center muted" style="padding:24px 0;">로딩 중…</td></tr>';

      const params = new URLSearchParams();
      params.set('month_key', detailState.monthKey);
      params.set('asset_id', detailState.assetId);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(detailState.offset));
      // (v372) 검색 / 필터 적용
      if (detailState.address) params.set('address', detailState.address);
      if (detailState.status) params.set('status', detailState.status);

      try {
        const r = await api('/api/admin/staking/interest-log?' + params.toString(), { method: 'GET' });
        const rows = Array.isArray(r?.rows) ? r.rows : [];
        const pag = r?.pagination || {};
        detailState.total = Number(pag.total || 0);

        if (!rows.length) {
          interestDetailBody.innerHTML = '<tr><td colspan="9" class="text-center muted" style="padding:24px 0;">조회 결과 없음</td></tr>';
        } else {
          interestDetailBody.innerHTML = rows.map((row) => {
            const isClaimed = !!row.claimed_at;
            const amt = Number(row.amount_usdt || 0).toFixed(1);
            const staked = Number(row.staked_snapshot || 0);
            // (2026-05-17 v454) 운영자 요청: '이자지급로그에 이자율 표기가 없는
            //   듯'. apr_snapshot 컬럼 표시. interest_claims.apr_snapshot 은
            //   퍼센트 값 (5.0, 6.95 등 — assets.apr 기준). 일관성 위해 2 자리
            //   소수점 표시.
            const aprPct = Number(row.apr_snapshot || 0);
            const aprLabel = aprPct > 0 ? `${aprPct.toFixed(2)}%` : '—';
            const monthKey = row.month_key || '—';
            const batchShort = row.claim_batch_id
              ? String(row.claim_batch_id).slice(0, 24) + (String(row.claim_batch_id).length > 24 ? '…' : '')
              : '—';
            return `
              <tr>
                <td style="font-family:'Space Grotesk',monospace;font-size:11.5px;white-space:nowrap;">${row.created_at || '—'}</td>
                <td style="font-family:'Space Grotesk',monospace;font-size:11.5px;font-weight:700;">${monthKey}</td>
                <td title="${row.address}" style="font-family:'Space Grotesk',monospace;font-size:11.5px;">${fmtAddr(row.address)}</td>
                <td style="text-align:right;font-family:'Space Grotesk',monospace;font-size:11.5px;">${staked.toLocaleString('ko-KR')}</td>
                <td style="text-align:right;font-family:'Space Grotesk',monospace;font-size:11.5px;color:#7c3aed;font-weight:700;">${aprLabel}</td>
                <td style="text-align:right;font-family:'Space Grotesk',monospace;font-weight:700;">${amt}</td>
                <td>${isClaimed
                  ? '<span style="display:inline-block;padding:2px 8px;background:rgba(16,185,129,0.12);color:#047857;border-radius:100px;font-size:11px;font-weight:700;">수령 완료</span>'
                  : '<span style="display:inline-block;padding:2px 8px;background:rgba(245,158,11,0.12);color:#92400E;border-radius:100px;font-size:11px;font-weight:700;">미수령</span>'}</td>
                <td style="font-family:'Space Grotesk',monospace;font-size:11.5px;white-space:nowrap;">${row.claimed_at || '—'}</td>
                <td title="${row.claim_batch_id || ''}" style="font-family:'Space Grotesk',monospace;font-size:10.5px;color:var(--muted);">${batchShort}</td>
              </tr>`;
          }).join('');
        }

        const currentPage = Math.floor(detailState.offset / PAGE_SIZE) + 1;
        const totalPages = Math.max(1, Math.ceil(detailState.total / PAGE_SIZE));
        if (interestDetailPageInfo) interestDetailPageInfo.textContent = `${currentPage} / ${totalPages}`;
        if (interestDetailPrev) interestDetailPrev.disabled = detailState.offset === 0;
        if (interestDetailNext) interestDetailNext.disabled = !pag.has_more;
        if (interestDetailMeta) {
          interestDetailMeta.innerHTML = `전체 <strong>${detailState.total.toLocaleString('ko-KR')}건</strong> · 현재 페이지 <strong>${rows.length}건</strong>`;
        }
      } catch (e) {
        interestDetailBody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:24px 0;color:#DC2626;">로딩 실패: ${(e && e.message) || e}</td></tr>`;
      }
    };

    const openInterestDetailModal = (monthKey, assetId) => {
      if (!interestDetailModal) return;
      detailState.monthKey = monthKey;
      detailState.assetId = assetId;
      detailState.offset = 0;
      detailState.total = 0;
      detailState.address = '';
      detailState.status = '';
      if (interestDetailSearch) interestDetailSearch.value = '';
      if (interestDetailStatus) interestDetailStatus.value = '';
      if (interestDetailTitle) interestDetailTitle.textContent = `${monthKey} · ${assetId}`;
      interestDetailModal.classList.remove('hidden');
      interestDetailModal.style.display = 'flex';
      renderInterestDetailPage();
    };

    const closeInterestDetailModal = () => {
      if (!interestDetailModal) return;
      interestDetailModal.classList.add('hidden');
      interestDetailModal.style.display = 'none';
    };

    interestDetailClose?.addEventListener('click', closeInterestDetailModal);
    interestDetailBackdrop?.addEventListener('click', closeInterestDetailModal);
    interestDetailPrev?.addEventListener('click', () => {
      if (detailState.offset === 0) return;
      detailState.offset = Math.max(0, detailState.offset - PAGE_SIZE);
      renderInterestDetailPage();
    });
    interestDetailNext?.addEventListener('click', () => {
      detailState.offset = detailState.offset + PAGE_SIZE;
      renderInterestDetailPage();
    });

    // (v372) 검색바 — 지갑 주소 검색 (debounce 350ms) + 상태 필터.
    //   필터 변경 시 offset reset (0 부터 다시 표시).
    let _searchDebounce = null;
    const triggerDetailSearch = () => {
      detailState.address = (interestDetailSearch?.value || '').trim();
      detailState.status = interestDetailStatus?.value || '';
      detailState.offset = 0;
      renderInterestDetailPage();
    };
    interestDetailSearch?.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(triggerDetailSearch, 350);
    });
    interestDetailSearch?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(_searchDebounce);
        triggerDetailSearch();
      }
    });
    interestDetailStatus?.addEventListener('change', triggerDetailSearch);
    interestDetailSearchClear?.addEventListener('click', () => {
      if (interestDetailSearch) interestDetailSearch.value = '';
      if (interestDetailStatus) interestDetailStatus.value = '';
      triggerDetailSearch();
    });
    if (interestDetailModal) {
      interestDetailModal.classList.add('hidden');
      interestDetailModal.style.display = 'none';
    }

    // (2026-05-08) "이자 지급 테스팅 했는데 유저 페이지에 안 나온다"
    //   상황 디버깅용. /api/admin/staking/diagnose-wallet 을 호출해
    //   해당 지갑의 holdings + interest_claims 원본을 그대로 표시한다.
    const diagWalletBtn = qs("#diagWalletBtn");
    const diagWalletInput = qs("#diagWalletInput");
    const diagWalletResult = qs("#diagWalletResult");
    const diagWalletSummary = qs("#diagWalletSummary");
    const diagWalletClaimsBody = qs("#diagWalletClaimsBody");

    const renderDiagSummary = (data) => {
      if (!diagWalletSummary) return;
      const h = data?.holding || null;
      const s = data?.summary || {};
      const stakedNum = h ? Number(h.staked_token || 0) : 0;
      const balanceNum = h ? Number(h.balance_token || 0) : 0;
      const cells = [
        ['지갑', data?.address || '—'],
        ['자산', data?.asset_id || '—'],
        ['holdings 행 존재', h ? '있음' : '없음 (유저가 한번도 거래 안 한 지갑)'],
        ['보유 토큰 (balance_token)', fmt(balanceNum, 0)],
        ['스테이킹 (staked_token)', fmt(stakedNum, 0) + (stakedNum > 0 ? '' : '  ⚠ 0 이면 force-interest 가 row 생성 안 함')],
        ['interest_claims 총 행수', String(s.total_rows || 0)],
        ['미수령 행수 (pending)', String(s.pending_rows || 0)],
        ['미수령 합계 (USDT)', fmt(Number(s.pending_usdt || 0), 4)],
        ['수령 완료 행수 (paid)', String(s.paid_rows || 0)],
        ['수령 완료 합계 (USDT)', fmt(Number(s.paid_usdt || 0), 4)],
      ];
      diagWalletSummary.innerHTML = cells.map(([k, v]) =>
        `<div class="kv"><div class="k">${k}</div><div class="v" style="word-break:break-all">${v}</div></div>`
      ).join('');
    };

    const renderDiagClaims = (claims) => {
      if (!diagWalletClaimsBody) return;
      const arr = Array.isArray(claims) ? claims : [];
      if (!arr.length) {
        diagWalletClaimsBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted)">행 없음 — force-interest 를 누른 적이 없거나 그 지갑에 row 가 INSERT 되지 않았습니다.</td></tr>`;
        return;
      }
      diagWalletClaimsBody.innerHTML = arr.map((c) => {
        const isPending = !c.claimed_at;
        const statusBadge = isPending
          ? `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b">미수령</span>`
          : `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981">수령</span>`;
        return `<tr>
          <td>${c.id}</td>
          <td class="text-mono">${c.month_key || '—'}</td>
          <td class="text-mono">${fmt(Number(c.staked_snapshot || 0), 0)}</td>
          <td class="text-mono">${fmt(Number(c.apr_snapshot || 0), 2)}%</td>
          <td class="text-mono"><strong>${fmt(Number(c.amount_usdt || 0), 4)}</strong></td>
          <td>${statusBadge}</td>
          <td class="text-mono" style="font-size:11px">${c.created_at || '—'}</td>
          <td class="text-mono" style="font-size:11px">${c.claimed_at || '—'}</td>
        </tr>`;
      }).join('');
    };

    const renderDiagAddrSamples = (data) => {
      const wrap = qs("#diagAddrSampleWrap");
      const body = qs("#diagAddrSampleBody");
      if (!wrap || !body) return;
      const samples = Array.isArray(data?.stored_address_samples) ? data.stored_address_samples : [];
      if (!samples.length) { wrap.style.display = 'none'; return; }
      // (2026-05-08) Show whenever ANY stored row has a different length
      //   than the trimmed input or fails an exact-string compare. That's
      //   the visual signal for hypothesis A (whitespace mismatch).
      const inputTrimmedLen = Number(data?.address_trimmed_length || 0);
      const anyMismatch = samples.some(s =>
        Number(s?.length || 0) !== inputTrimmedLen || s?.matches_input_trimmed === false
      );
      if (!anyMismatch) { wrap.style.display = 'none'; return; }
      wrap.style.display = '';
      const rows = [
        `입력 raw: 길이 ${data.address_input_length} ('${(data.address_input_raw || '').replace(/'/g, "\\'")}')`,
        `입력 trim: 길이 ${data.address_trimmed_length} ('${(data.address || '').replace(/'/g, "\\'")}')`,
        '',
        ...samples.map(s => {
          const exact = s.matches_input_exactly ? '✓' : '✗';
          const trimMatch = s.matches_input_trimmed ? '✓' : '✗';
          return `[${s.source}] 길이 ${s.length} | exact=${exact} trim-match=${trimMatch} | '${(s.value || '').replace(/'/g, "\\'")}'`;
        }),
      ];
      body.textContent = rows.join('\n');
    };

    diagWalletBtn?.addEventListener('click', async () => {
      const addr = String(diagWalletInput?.value || '').trim();
      if (!addr) {
        toast('지갑 주소를 입력하세요.', 'bad');
        return;
      }
      try {
        diagWalletBtn.disabled = true;
        const selected = getSelectedAsset();
        const aid = selected?.id || 'SILICA-79907';
        const r = await api(`/api/admin/staking/diagnose-wallet?address=${encodeURIComponent(addr)}&assetId=${encodeURIComponent(aid)}`);
        renderDiagSummary(r);
        renderDiagClaims(r?.claims || []);
        renderDiagAddrSamples(r);
        if (diagWalletResult) diagWalletResult.style.display = '';
      } catch (e) {
        toast(e.message || '진단 실패', 'bad');
      } finally {
        if (diagWalletBtn) diagWalletBtn.disabled = false;
      }
    });

    // (2026-05-17 v453) 지갑 진단 (스테이킹 수량) — 신규 카드.
    //   주소 검색 → /api/admin/staking/diagnose-stake → 모달 팝업으로 요약 +
    //   스테이킹 거래 기록 표시. 이력 기반 net 과 holdings 차이가 있으면 노란
    //   경고 박스.
    const diagStakeBtn = qs("#diagStakeBtn");
    const diagStakeInput = qs("#diagStakeInput");
    const diagStakeModal = qs("#diagStakeModal");
    const diagStakeModalClose = qs("#diagStakeModalClose");
    const diagStakeModalAddr = qs("#diagStakeModalAddr");
    const diagStakeSummary = qs("#diagStakeSummary");
    const diagStakeRecordsBody = qs("#diagStakeRecordsBody");
    const diagStakeDiscrepancyBox = qs("#diagStakeDiscrepancyBox");
    const diagStakeDiscrepancyDesc = qs("#diagStakeDiscrepancyDesc");

    const escapeHtmlStake = (s) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const renderStakeSummary = (data) => {
      if (!diagStakeSummary) return;
      const s = data?.summary || {};
      const cells = [
        ['현재 스테이킹', `${fmt(Number(s.current_staked || 0), 2)} SilicaSTO`, '#7c3aed'],
        ['현재 Idle', `${fmt(Number(s.current_idle || 0), 2)} SilicaSTO`, '#0891b2'],
        ['이력 기준 net', `${fmt(Number(s.net_staked_from_history || 0), 2)} SilicaSTO`, '#059669'],
        ['총 스테이킹 (누적)', `+${fmt(Number(s.total_stake_in || 0), 2)} SilicaSTO`, '#475569'],
        ['총 언스테이킹 (누적)', `-${fmt(Number(s.total_unstake || 0), 2)} SilicaSTO`, '#475569'],
        ['거래 기록 수', `${s.record_count || 0} 건`, '#475569'],
      ];
      diagStakeSummary.innerHTML = cells.map(([k, v, c]) =>
        `<div style="padding:10px 12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">
           <div style="font-size:11px; color:#6b7280; letter-spacing:0.5px;">${escapeHtmlStake(k)}</div>
           <div style="margin-top:3px; font-weight:700; font-size:14px; color:${c};">${escapeHtmlStake(v)}</div>
         </div>`
      ).join('');

      // 차이 (discrepancy) 표시.
      const discrepancy = Number(s.discrepancy || 0);
      const tolerance = 0.000001;
      if (Math.abs(discrepancy) > tolerance && diagStakeDiscrepancyBox) {
        diagStakeDiscrepancyBox.style.display = '';
        const sign = discrepancy > 0 ? '+' : '';
        if (diagStakeDiscrepancyDesc) {
          diagStakeDiscrepancyDesc.innerHTML =
            `holdings.silica_sto_staked (${fmt(Number(s.current_staked||0), 6)}) - 이력 기준 net (${fmt(Number(s.net_staked_from_history||0), 6)}) = <strong>${sign}${fmt(discrepancy, 6)} SilicaSTO</strong>.<br>` +
            `wallet_transactions 기록과 holdings 가 일치하지 않습니다. 누락된 기록이 있거나 holdings 가 별도 경로로 변경되었을 가능성.`;
        }
      } else if (diagStakeDiscrepancyBox) {
        diagStakeDiscrepancyBox.style.display = 'none';
      }
    };

    const renderStakeRecords = (records) => {
      if (!diagStakeRecordsBody) return;
      const arr = Array.isArray(records) ? records : [];
      if (!arr.length) {
        diagStakeRecordsBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#6b7280;">스테이킹/언스테이킹 기록이 없습니다.</td></tr>`;
        return;
      }
      diagStakeRecordsBody.innerHTML = arr.map((r) => {
        const isStake = r.kind === 'stake';
        const typeLabel = isStake
          ? `<span style="display:inline-block; padding:2px 8px; background:#dcfce7; color:#15803d; border-radius:4px; font-size:11px; font-weight:700;">STAKE</span>`
          : `<span style="display:inline-block; padding:2px 8px; background:#fee2e2; color:#b91c1c; border-radius:4px; font-size:11px; font-weight:700;">UNSTAKE</span>`;
        const amtStr = `${isStake ? '+' : '-'}${fmt(Number(r.amount || 0), 2)}`;
        const amtColor = isStake ? '#15803d' : '#b91c1c';
        return `<tr>
          <td style="font-family:monospace;">${escapeHtmlStake(r.id)}</td>
          <td style="font-family:monospace; font-size:11px;">${escapeHtmlStake(r.created_at || '')}</td>
          <td>${typeLabel}</td>
          <td style="text-align:right; font-weight:700; color:${amtColor};">${escapeHtmlStake(amtStr)}</td>
          <td style="text-align:right; font-family:monospace; font-size:11px; color:#6b7280;">${fmt(Number(r.before_amount || 0), 2)}</td>
          <td style="text-align:right; font-family:monospace; font-size:11px; color:#6b7280;">${fmt(Number(r.after_amount || 0), 2)}</td>
          <td>${escapeHtmlStake(r.status || '-')}</td>
          <td style="font-size:11px; color:#6b7280; max-width:240px; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtmlStake(r.memo || '')}">${escapeHtmlStake(r.memo || '-')}</td>
        </tr>`;
      }).join('');
    };

    const closeStakeModal = () => { if (diagStakeModal) diagStakeModal.style.display = 'none'; };
    diagStakeModalClose?.addEventListener('click', closeStakeModal);
    diagStakeModal?.addEventListener('click', (e) => {
      // backdrop 클릭 시 닫기 (모달 카드 내부 클릭은 propagation 으로 도달, 닫지 않음).
      if (e.target === diagStakeModal) closeStakeModal();
    });

    diagStakeBtn?.addEventListener('click', async () => {
      const addr = String(diagStakeInput?.value || '').trim();
      if (!addr) {
        toast('지갑 주소를 입력하세요.', 'bad');
        return;
      }
      try {
        diagStakeBtn.disabled = true;
        const selected = getSelectedAsset();
        const aid = selected?.id || 'SILICA-79907';
        const r = await api(`/api/admin/staking/diagnose-stake?address=${encodeURIComponent(addr)}&assetId=${encodeURIComponent(aid)}`);
        if (diagStakeModalAddr) {
          diagStakeModalAddr.textContent = `${r?.address || addr} · ${r?.asset_id || aid}`;
        }
        renderStakeSummary(r);
        renderStakeRecords(r?.records || []);
        // (v455) reconcile 도구 표시 — 진단 직후 dry-run 자동 호출.
        await reconcileAutoPreview(addr, aid);
        if (diagStakeModal) diagStakeModal.style.display = 'flex';
      } catch (e) {
        toast(e.message || '스테이킹 진단 실패', 'bad');
      } finally {
        if (diagStakeBtn) diagStakeBtn.disabled = false;
      }
    });

    // (2026-05-17 v455) 데이터 정정 도구 — reconcile-wallet endpoint 활용.
    //   진단 모달이 열린 직후 자동으로 dry-run 호출하여 누락 항목 안내.
    //   사용자가 체크박스로 액션 선택 후 '실행' 클릭 → POST 로 실제 백필.
    const reconcileBox = qs("#diagStakeReconcileBox");
    const reconcileDesc = qs("#diagStakeReconcileDesc");
    const reconcileChkInvest = qs("#reconcileChkInvest");
    const reconcileChkStakeGap = qs("#reconcileChkStakeGap");
    const reconcilePreviewBtn = qs("#reconcilePreviewBtn");
    const reconcileApplyBtn = qs("#reconcileApplyBtn");
    const reconcileResult = qs("#reconcileResult");
    let _reconcileCurrent = { address: '', asset_id: '' };

    const reconcileAutoPreview = async (address, assetId) => {
      _reconcileCurrent = { address, asset_id: assetId };
      if (reconcileResult) { reconcileResult.style.display = 'none'; reconcileResult.innerHTML = ''; }
      // (2026-05-17 v460) 운영자 요청: '데이터 정정 도구' UI 영구 숨김.
      //   v457 의 자동 dry-run 호출도 제거 (불필요한 admin API 호출 방지).
      //   백엔드 endpoint (reconcile-wallet / reconcile-revert) 는 그대로
      //   보존 — 향후 재활성화 또는 직접 API 호출로 사용 가능.
      if (reconcileBox) reconcileBox.style.display = 'none';
      return;
      // eslint-disable-next-line no-unreachable
      try {
        const r = await api('/api/admin/staking/reconcile-wallet', {
          method: 'POST',
          body: { address, asset_id: assetId, dry_run: true }
        });
        const a = r?.analysis || {};
        const missingInvest = (a.missing_invest_credits || []).length;
        const missingTotal = Number(a.missing_invest_credit_total || 0);
        const gap = Number(a.staked_gap || 0);
        const existingReconcile = Number(a.existing_reconcile_count || 0);
        const hasMissing = missingInvest > 0;
        const hasGap = Math.abs(gap) > 0.000001;
        const hasExisting = existingReconcile > 0;

        // (2026-05-17 v457) 누락/gap 없어도 기존 백필 row 가 있으면 박스 표시
        //   → 운영자가 되돌리기 가능.
        if (!hasMissing && !hasGap && !hasExisting) {
          if (reconcileBox) reconcileBox.style.display = 'none';
          return;
        }

        if (reconcileBox) reconcileBox.style.display = '';
        const parts = [];
        if (hasMissing || hasGap) {
          parts.push('감지된 누락 항목:');
          if (hasMissing) {
            parts.push(`• <strong>invest_credit ${missingInvest}건 누락</strong> (총 ${missingTotal} SilicaSTO) — funding_records 에는 있지만 wallet_transactions 에 INSERT 안 됨`);
          }
          if (hasGap) {
            const sign = gap > 0 ? '+' : '';
            parts.push(`• <strong>staked gap ${sign}${gap} SilicaSTO</strong> — holdings.silica_sto_staked (${a.current_staked}) vs 이력 net (${a.net_staked_from_history})`);
          }
          parts.push('<br>아래 체크박스로 백필 대상을 선택 후 [실행] 클릭. holdings 자체는 변경되지 않습니다 (wallet_transactions INSERT 만 수행).');
        }
        if (hasExisting) {
          if (parts.length) parts.push('<hr style="border:none; border-top:1px dashed #93c5fd; margin:8px 0;">');
          parts.push(`<strong>📌 기존 백필 row ${existingReconcile}건 존재</strong> — '[v455 reconcile]' marker 표시된 wallet_transactions row. 우측 [백필 되돌리기] 로 삭제 가능.`);
        }
        if (reconcileDesc) reconcileDesc.innerHTML = parts.join('<br>');
        if (reconcileChkInvest) {
          reconcileChkInvest.checked = hasMissing;
          reconcileChkInvest.disabled = !hasMissing;
        }
        if (reconcileChkStakeGap) {
          reconcileChkStakeGap.checked = false; // 위험성 있어 default unchecked
          reconcileChkStakeGap.disabled = !hasGap;
        }
        // 되돌리기 버튼 visibility 조정 — 기존 row 없으면 disabled.
        // (v457) 변수 hoisting 안전 위해 qs() 로 직접 조회.
        const revertBtnEl = qs("#reconcileRevertBtn");
        if (revertBtnEl) {
          revertBtnEl.disabled = !hasExisting;
          revertBtnEl.title = hasExisting
            ? `[v455 reconcile] marker row ${existingReconcile}건 삭제`
            : '되돌릴 백필 row 없음';
        }
      } catch (e) {
        if (reconcileBox) reconcileBox.style.display = 'none';
        // 에러는 silent — 진단 자체는 이미 완료된 상태.
      }
    };

    reconcilePreviewBtn?.addEventListener('click', async () => {
      if (!_reconcileCurrent.address) return;
      try {
        reconcilePreviewBtn.disabled = true;
        const r = await api('/api/admin/staking/reconcile-wallet', {
          method: 'POST',
          body: { address: _reconcileCurrent.address, asset_id: _reconcileCurrent.asset_id, dry_run: true }
        });
        const json = JSON.stringify(r?.analysis || {}, null, 2);
        if (reconcileResult) {
          reconcileResult.style.display = '';
          reconcileResult.innerHTML = '<strong>분석 결과 (dry-run):</strong><pre style="margin:6px 0 0; padding:8px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; max-height:240px; overflow:auto; font-size:11px;">'
            + escapeHtmlStake(json) + '</pre>';
        }
      } catch (e) {
        toast(e?.message || '미리보기 실패', 'bad');
      } finally {
        reconcilePreviewBtn.disabled = false;
      }
    });

    // (2026-05-17 v456) v455 백필 row 되돌리기 — 운영자가 백필 결과가 어색한
    //   경우 사용. memo='[v455 reconcile]%' 인 wallet_transactions row 만 DELETE.
    const reconcileRevertBtn = qs("#reconcileRevertBtn");
    reconcileRevertBtn?.addEventListener('click', async () => {
      if (!_reconcileCurrent.address) return;
      // (v459) DB trigger 가 DELETE 차단 → soft-delete (status='취소' + marker).
      //   사용자 confirm 메시지에도 명시.
      if (!confirm('이 지갑의 v455 백필 row 를 되돌립니다 (soft-delete: status=취소 + marker).\nDB trigger 가 DELETE 차단하여 row 자체는 보존되며, 진단 도구는 무시합니다.\nholdings 자체는 변경되지 않습니다.\n진행하시겠습니까?')) return;
      try {
        reconcileRevertBtn.disabled = true;
        const r = await api('/api/admin/staking/reconcile-revert', {
          method: 'POST',
          body: { address: _reconcileCurrent.address }
        });
        // v458 응답: deleted / v459 응답: reverted. 둘 다 지원.
        const cnt = Number(r?.reverted ?? r?.deleted ?? 0);
        toast(`백필 row ${cnt}건 되돌리기 완료 (soft-delete)`, 'good');
        if (reconcileResult) {
          reconcileResult.style.display = '';
          reconcileResult.innerHTML = `<strong>되돌리기 결과:</strong> ${cnt}건 삭제됨` +
            (r?.rows && r.rows.length
              ? `<pre style="margin:6px 0 0; padding:8px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; max-height:200px; overflow:auto; font-size:11px;">${escapeHtmlStake(JSON.stringify(r.rows, null, 2))}</pre>`
              : '');
        }
        // 진단 결과 새로고침.
        const fresh = await api(`/api/admin/staking/diagnose-stake?address=${encodeURIComponent(_reconcileCurrent.address)}&assetId=${encodeURIComponent(_reconcileCurrent.asset_id)}`);
        renderStakeSummary(fresh);
        renderStakeRecords(fresh?.records || []);
        await reconcileAutoPreview(_reconcileCurrent.address, _reconcileCurrent.asset_id);
      } catch (e) {
        // (v458) detail 정보를 toast + console 둘 다 출력 — 진단 용이.
        console.error('[reconcile-revert] error:', e?.status, e?.message, e?.detail, e?.data);
        const detail = e?.detail ? ` (${e.detail})` : '';
        toast((e?.message || '되돌리기 실패') + detail, 'bad');
      } finally {
        reconcileRevertBtn.disabled = false;
      }
    });

    reconcileApplyBtn?.addEventListener('click', async () => {
      if (!_reconcileCurrent.address) return;
      const apply = [];
      if (reconcileChkInvest?.checked) apply.push('backfill_invest_credit');
      if (reconcileChkStakeGap?.checked) apply.push('backfill_stake_gap');
      if (!apply.length) {
        toast('하나 이상의 백필 항목을 선택하세요.', 'bad');
        return;
      }
      if (!confirm('선택한 항목을 wallet_transactions 에 INSERT 합니다.\nholdings 자체는 변경되지 않습니다.\n진행하시겠습니까?')) return;
      try {
        reconcileApplyBtn.disabled = true;
        const r = await api('/api/admin/staking/reconcile-wallet', {
          method: 'POST',
          body: { address: _reconcileCurrent.address, asset_id: _reconcileCurrent.asset_id, dry_run: false, apply }
        });
        const lines = (r?.applied || []).join('\n');
        toast(`백필 완료 (${(r?.applied || []).length}건)`, 'good');
        if (reconcileResult) {
          reconcileResult.style.display = '';
          reconcileResult.innerHTML = '<strong>실행 결과:</strong><pre style="margin:6px 0 0; padding:8px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; font-size:11px;">' + escapeHtmlStake(lines || '(변경 없음)') + '</pre>';
        }
        // 진단 결과 다시 가져옴 (모달 안에서 새 상태 반영)
        const fresh = await api(`/api/admin/staking/diagnose-stake?address=${encodeURIComponent(_reconcileCurrent.address)}&assetId=${encodeURIComponent(_reconcileCurrent.asset_id)}`);
        renderStakeSummary(fresh);
        renderStakeRecords(fresh?.records || []);
        await reconcileAutoPreview(_reconcileCurrent.address, _reconcileCurrent.asset_id);
      } catch (e) {
        toast(e?.message || '백필 실패', 'bad');
      } finally {
        reconcileApplyBtn.disabled = false;
      }
    });

    // ---------- (2026-05-18 v575) 과거 회차 catch-up ----------
    // 14-16일 lock window 전체가 outage 였을 때 지난 회차를 명시적으로 보충.
    //   month_key + "재해복구확인" type-to-confirm 둘 다 채워져야 버튼 활성화.
    //   POST /api/admin/staking/catch-up-accrual 호출 → 백엔드가 다중 안전장치.
    const catchUpMonthKey = qs("#catchUpMonthKey");
    const catchUpConfirm = qs("#catchUpConfirm");
    const catchUpBtn = qs("#catchUpAccrualBtn");
    const catchUpResult = qs("#catchUpResult");

    const updateCatchUpBtnState = () => {
      if (!catchUpBtn) return;
      const m = String(catchUpMonthKey?.value || '').trim();
      const c = String(catchUpConfirm?.value || '').trim();
      const monthOk = /^\d{4}-\d{2}$/.test(m);
      const confirmOk = c === '재해복구확인';
      catchUpBtn.disabled = !(monthOk && confirmOk);
    };

    catchUpMonthKey?.addEventListener('input', updateCatchUpBtnState);
    catchUpConfirm?.addEventListener('input', updateCatchUpBtnState);

    catchUpBtn?.addEventListener('click', async () => {
      const month_key = String(catchUpMonthKey?.value || '').trim();
      const confirmText = String(catchUpConfirm?.value || '').trim();
      if (!month_key || confirmText !== '재해복구확인') return;

      const finalCheck = confirm(
        `정말로 ${month_key} 회차를 catch-up 실행하시겠습니까?\n\n` +
        `해당 회차의 모든 자산 + 모든 스테이커에게 1개월분 이자가 지급됩니다.\n` +
        `이미 청구 기록이 있으면 자동 거절됩니다.\n` +
        `이 작업은 silica_audit_log 에 기록됩니다.`
      );
      if (!finalCheck) return;

      catchUpBtn.disabled = true;
      catchUpBtn.textContent = '처리 중...';
      if (catchUpResult) catchUpResult.classList.add('hidden');

      try {
        const r = await api('/api/admin/staking/catch-up-accrual', {
          method: 'POST',
          body: { month_key, confirm: confirmText }
        });
        toast(`${month_key} 회차 catch-up 완료`, 'good');
        if (catchUpResult) {
          catchUpResult.classList.remove('hidden');
          catchUpResult.innerHTML =
            '<strong>실행 결과:</strong><br>' +
            `회차: ${escapeHtmlStake(r.month_key || month_key)}<br>` +
            `지급 완료: ${Number(r.paid_count || 0)} 건<br>` +
            `실패: ${Number(r.failed_count || 0)} 건<br>` +
            `총 지급액: ${Number(r.total_interest_usdt || 0).toFixed(6)} USDT<br>` +
            `실행자: ${escapeHtmlStake(r.actor || '-')}`;
        }
        // 입력값 초기화 — 같은 회차 두 번 실수 클릭 방지
        if (catchUpConfirm) catchUpConfirm.value = '';
        updateCatchUpBtnState();
      } catch (e) {
        const msg = e?.message || '실행 실패';
        toast(msg, 'bad');
        if (catchUpResult) {
          catchUpResult.classList.remove('hidden');
          catchUpResult.innerHTML = '<strong style="color:#dc2626">실패:</strong> ' + escapeHtmlStake(msg);
        }
      } finally {
        catchUpBtn.disabled = false;
        catchUpBtn.textContent = '과거 회차 보충 지급 실행';
        updateCatchUpBtnState();
      }
    });

    // ---------- boot ----------
    await loadAssets();
    await loadGlobal();
    await loadPublicConfig();
    fillAssetFields();
  });
})();