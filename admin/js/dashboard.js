(() => {
  "use strict";

  const { qs, api, fmtNum, statusOrder, statusBadge, bootAdminPage, toast, onReady, showAdminRecovery, dismissAdminRecovery, clearAdminTransientUi } = window.AdminCore;

  // (2026-05-18 v546) XSS audit 결과 추가 — 본 파일은 esc 헬퍼가 없어
  //   asset.name / market 등 admin 작성 텍스트가 innerHTML 에 직접 보간되었다.
  //   복수 admin 환경에서 한 admin 이 악의적 입력을 자산명에 박으면 모든
  //   admin 의 dashboard 에 XSS 가 실행되는 stored XSS 가 됨. 일관된 esc()
  //   적용으로 차단.
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

  const fmtTime = (s) => {
    if (!s) return "-";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };

  const pct = (a, b) => {
    const den = n(b);
    if (!(den > 0)) return 0;
    return (n(a) / den) * 100;
  };

  const money = (x, d = 2) => `${fmtNum(n(x), d)} USDT`;
  const visibilityBadge = (asset) => Number(asset?.is_public || 0) > 0 ? '<span class="badge blue">공개</span>' : '<span class="badge neutral">비공개</span>';


  const hardCloseDashboardUi = (reason = "") => {
    try { window.__ADMIN_DASHBOARD_FORCE_CLOSE_UI__?.(reason || "dashboard-hard-close"); } catch (_) {}
    try { clearAdminTransientUi?.(reason || "dashboard-hard-close"); } catch (_) {}
  };

  const normalizeSummary = (raw = {}) => ({
    fx_krw_per_usdt: n(raw.fx_krw_per_usdt),
    staking_cfg: raw.staking_cfg && typeof raw.staking_cfg === "object" ? raw.staking_cfg : {},
    counts: raw.counts && typeof raw.counts === "object" ? raw.counts : {},
    platform: raw.platform && typeof raw.platform === "object" ? raw.platform : {},
    orders: raw.orders && typeof raw.orders === "object" ? raw.orders : {},
    trades: raw.trades && typeof raw.trades === "object" ? raw.trades : {},
    sales: raw.sales && typeof raw.sales === "object" ? raw.sales : {},
    staking: raw.staking && typeof raw.staking === "object" ? raw.staking : {},
    assets: Array.isArray(raw.assets) ? raw.assets : [],
  });

  const init = async () => {
    hardCloseDashboardUi("dashboard-init");

    const me = await bootAdminPage("dashboard");
    if (!me) return;

    const kpiTotal = qs("#kpiTotal");
    const kpiFunding = qs("#kpiFunding");
    // kpiBuying 제거됨 2026-05-05 — 라벨 오류 카드 (counts["구매진행"]을 "총 발행 STO"로 잘못 표기)
    // kpiActive 제거됨 2026-05-05 — counts["분배중"]+counts["운영중"]을 자산 갯수로 표시하던 RECON 잔재.
    // 단일 고정 자산 프로젝트에서는 0/1 만 나오는데다 "누적 분배 (장부)" 카드와 라벨이 혼동됨.
    const kpiSold = qs("#kpiSold");
    const kpiFailed = qs("#kpiFailed");
    const kpiOpenOrders = qs("#kpiOpenOrders");
    const kpiVol24h = qs("#kpiVol24h");
    const kpiPlatformFee = qs("#kpiPlatformFee");
    const kpiStaked = qs("#kpiStaked");
    const kpiPayday = qs("#kpiPayday");
    const kpiFx = qs("#kpiFx");
    const kpiFxSource = qs("#kpiFxSource");

    // STO 분배 모델 v1 KPI elements (장부 모델 — burn 없음)
    const kpiStoMinted = qs("#kpiStoMinted");
    const kpiStoDistributed = qs("#kpiStoDistributed");
    const kpiStoReserve = qs("#kpiStoReserve");

    const alertsBox = qs("#dashAlertsBox");
    const alertsList = qs("#dashAlertsList");

    const tbodyAssets = qs("#dashAssetTbody");
    const tbodyBook = qs("#dashBookTbody");
    const tbodyTrades = qs("#dashTradesTbody");
    const tbodySales = qs("#dashSalesTbody");
    const tbodyStaking = qs("#dashStakingTbody");

    const refreshBtn = qs("#dashRefreshBtn");

    const renderErrorState = (message) => {
      const msg = message || "대시보드를 불러오지 못했습니다.";
      if (alertsBox) alertsBox.classList.remove("hidden");
      if (alertsList) alertsList.textContent = msg;
      if (tbodyAssets) tbodyAssets.innerHTML = `<tr><td colspan="5" class="center muted">${msg}</td></tr>`;
      if (tbodyBook) tbodyBook.innerHTML = `<tr><td colspan="6" class="center muted">${msg}</td></tr>`;
      if (tbodyTrades) tbodyTrades.innerHTML = `<tr><td colspan="5" class="center muted">${msg}</td></tr>`;
      if (tbodySales) tbodySales.innerHTML = `<tr><td colspan="5" class="center muted">${msg}</td></tr>`;
      if (tbodyStaking) tbodyStaking.innerHTML = `<tr><td colspan="4" class="center muted">${msg}</td></tr>`;
    };

    const render = async () => {
      hardCloseDashboardUi("dashboard-render-start");
      const sum = normalizeSummary(await api("/api/admin/dashboard/summary", { method: "GET" }));
      dismissAdminRecovery();
      hardCloseDashboardUi("dashboard-render-success");

      const fx = n(sum.fx_krw_per_usdt);
      if (kpiFx) kpiFx.textContent = fx ? `1 USDT = ${fmtNum(fx, 0)} KRW` : "-";

      // (2026-05-18 v522) 누적 순 출금 (STO / Silica)
      const nw = sum.net_withdraw || {};
      const nwSto = n(nw.sto);
      const nwSilica = n(nw.silica);
      const elNwSto = qs("#kpiNetWithdrawSto");
      const elNwSilica = qs("#kpiNetWithdrawSilica");
      if (elNwSto)    elNwSto.textContent    = `${fmtNum(nwSto, 2)} STO`;
      if (elNwSilica) elNwSilica.textContent = `${fmtNum(nwSilica, 2)} Silica`;

      // (2026-05-08) Hydrate FX source label from /api/admin/fx/live so the
      //   dashboard reflects the actual provider (CoinGecko / manual / etc.)
      //   instead of a hardcoded "한국은행 API" placeholder. Best-effort —
      //   if the call fails (e.g. fx_quote_latest table missing) we hide the
      //   label rather than block the rest of the dashboard.
      if (kpiFxSource) {
        try {
          const live = await api("/api/admin/fx/live", { method: "GET" });
          const mode = String(live?.mode || "").trim().toLowerCase();
          const providerRaw = String(live?.provider || "").trim();
          const PROVIDER_LABEL = {
            coingecko: "CoinGecko",
            coinmarketcap: "CoinMarketCap",
            coinlore: "CoinLore",
            binance: "Binance",
            kraken: "Kraken",
            er_api: "ExchangeRate-API",
            "exchangerate-api": "ExchangeRate-API",
            frankfurter: "Frankfurter",
            manual: "수동 입력",
            "": "수동 입력",
          };
          const label = PROVIDER_LABEL[providerRaw.toLowerCase()] || providerRaw || "수동 입력";
          kpiFxSource.textContent = mode === "manual" ? "수동 입력" : label;
        } catch (_) {
          kpiFxSource.textContent = "수동 입력";
        }
      }

      const cfg = sum.staking_cfg || {};
      if (kpiPayday) kpiPayday.textContent = cfg.payday ? `${cfg.payday}일` : "-";

      const assets = (sum.assets || []).slice().sort((a, b) => statusOrder(a.status) - statusOrder(b.status));
      const counts = sum.counts || {};
      const total = assets.length;

      const cFunding = n(counts["모집중"]);
      const cSold = n(counts["매각"]) + n(counts["매각(완료)"]);
      const cFail = n(counts["모집실패"]) + n(counts["취소됨"]);

      if (kpiTotal) kpiTotal.textContent = `${total}개`;
      if (kpiFunding) kpiFunding.textContent = `${cFunding}개`;
      // kpiBuying / kpiActive 카드 제거됨 — counts["구매진행"], counts["분배중"]+counts["운영중"] 더 이상 출력 안 함.
      if (kpiSold) kpiSold.textContent = `${cSold}개`;
      if (kpiFailed) kpiFailed.textContent = `${cFail}개`;

      const openCount = n(sum.orders?.open_count);
      const vol24 = n(sum.trades?.last24h?.volume);
      const pf = n(sum.platform?.usdt_balance);
      const stakedTotal = n(sum.staking?.staked_total);
      const stakers = n(sum.staking?.stakers);

      if (kpiOpenOrders) kpiOpenOrders.textContent = `${openCount.toLocaleString("ko-KR")}건`;
      if (kpiVol24h) kpiVol24h.textContent = money(vol24, 2);
      if (kpiPlatformFee) kpiPlatformFee.textContent = money(pf, 6);
      if (kpiStaked) kpiStaked.textContent = `${fmtNum(stakedTotal, 6)} TOKEN · ${stakers}명`;

      // ── STO 분배 모델 v1: Minted / Distributed / Reserve KPI ──
      // 장부(ledger) 모델 — burn 없음. Reserve = 사전 발행 - 누적 분배(장부).
      // Minted: settings (admin/silica/tokens) 에서 관리.
      // Distributed: SUM(holdings.claimed_token) — 단일 자산이므로 첫 번째 STO 자산에서 산출.
      try {
        const tokens = await api("/api/admin/silica/tokens", { method: "GET" });
        const minted = n(tokens?.silica_sto_total_minted);
        const stoAsset = (sum.assets || []).find((a) => String(a.id || "").toUpperCase().startsWith("SILICA"));
        const distributed = stoAsset ? n(stoAsset.distributed_token) : 0;
        const reserveQty = Math.max(0, minted - distributed);
        if (kpiStoMinted) kpiStoMinted.textContent = `${fmtNum(minted, 0)} STO`;
        if (kpiStoDistributed) kpiStoDistributed.textContent = `${fmtNum(distributed, 0)} STO`;
        if (kpiStoReserve) kpiStoReserve.textContent = `${fmtNum(reserveQty, 0)} STO`;
      } catch (_) {
        if (kpiStoMinted) kpiStoMinted.textContent = "-";
        if (kpiStoDistributed) kpiStoDistributed.textContent = "-";
        if (kpiStoReserve) kpiStoReserve.textContent = "-";
      }

      const salesMap = new Map((sum.sales?.sold || []).map((s) => [s.asset_id, s]));
      const alerts = [];

      // Silica 단순 분배 모델 (2026-05-05): 자산별 target/supply_token 경고는 의미 없음.
      // (사전 발행 1B Reserve + 1:1 페그 → 자산별 supply_token 미사용, target 도 통계용일 뿐)
      // 매각 상태에서 sales 정산 정보 누락만 운영 경고로 유지.
      for (const a of assets) {
        if ((a.status === "매각" || a.status === "매각(완료)") && !salesMap.has(a.id)) {
          alerts.push(`${a.id}: 매각 상태인데 sales(정산정보)가 없습니다.`);
        }
      }

      // (2026-05-19 v588) KYC 보류 카운터 — 별도 endpoint 에서 받아 KPI 카드 +
      //   alert 박스에 표시. 0 이면 카드는 회색 + alert 노출 안 함.
      try {
        const kyc = await api("/api/admin/kyc/pending-count", { method: "GET" });
        const pendingReview = Number(kyc?.pending_review || 0);
        const rejected = Number(kyc?.rejected || 0);
        const kpiVal = qs("#kpiKycPending");
        const kpiSub = qs("#kpiKycPendingSub");
        const kpiCard = qs("#kpiKycPendingCard");
        const total = pendingReview + rejected;
        if (kpiVal) kpiVal.textContent = `${total}명`;
        if (kpiSub) kpiSub.textContent = `검토 ${pendingReview} · 거절 ${rejected}`;
        if (kpiCard) {
          // 0 이면 amber 강조 끔.
          if (total === 0) kpiCard.classList.remove("amber");
          else kpiCard.classList.add("amber");
        }
        if (pendingReview > 0) {
          alerts.push(`KYC 검토 대기 ${pendingReview}건 — 유저 관리 페이지에서 처리`);
        }
        if (rejected > 0) {
          alerts.push(`KYC 거절 / 정보 불일치 ${rejected}건 — 유저 관리 페이지에서 처리`);
        }
      } catch (e) {
        // 백엔드 미배포 또는 호출 실패 — 조용히 무시 (대시보드 다른 카드는 계속 표시).
        console.warn("[dashboard] kyc/pending-count failed:", e?.message || e);
      }

      if (alerts.length) {
        if (alertsBox) alertsBox.classList.remove("hidden");
        if (alertsList) alertsList.innerHTML = alerts.map((x) => `• ${esc(x)}`).join("<br>");
      } else {
        if (alertsBox) alertsBox.classList.add("hidden");
        if (alertsList) alertsList.textContent = "-";
      }

      if (tbodyAssets) {
        // "발행"(supply_token) 컬럼 제거됨 2026-05-05 — RECON 펀딩 스냅샷 잔재.
        // Silica 는 1B STO 사전 발행 + 1:1 페그 즉시 분배 모델이라 자산별 supply_token 의미 없음.
        tbodyAssets.innerHTML = assets.map((a) => {
          // (v410) 컬럼 의미 명확화:
          //   총수량       = pre_minted_supply (사전 발행, 보통 1B)
          //   판매 목표    = max_sto_supply    (운영자 설정, 가변)
          //   판매됨       = raised_usdt       (1 STO = 1 USDT peg)
          //   진행률       = raised / max_sto_supply
          const r = n(a.raised_usdt);
          const maxSto = (a.max_sto_supply !== null && a.max_sto_supply !== undefined)
            ? Number(a.max_sto_supply)
            : null;

          // 진행률은 판매 목표 기준. 목표 = 0 (무제한) 이면 '-' 표시.
          let pTxt = '-';
          let isOver = false;
          if (maxSto !== null && maxSto > 0) {
            const p = pct(r, maxSto);
            pTxt = `${fmtNum(Math.min(p, 999), 2)}%`;
            isOver = r > maxSto + 1e-9;
          }

          const preMinted = (a.pre_minted_supply !== null && a.pre_minted_supply !== undefined)
            ? fmtNum(a.pre_minted_supply, 0)
            : '-';
          const maxStoTxt = (maxSto !== null)
            ? (maxSto > 0 ? fmtNum(maxSto, 0) : '무제한')
            : '-';

          return `<tr>
            <td><strong>${esc(a.name || a.id)}</strong>${a.name && a.name !== a.id ? `<div class="small-note">${esc(a.id)}</div>` : ""}</td>
            <td class="right">${preMinted}</td>
            <td class="right">${maxStoTxt}</td>
            <td class="right">${fmtNum(r, 2)}</td>
            <td class="right">${isOver ? `<span class="badge bad">초과 ${pTxt}</span>` : pTxt}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="5" class="center muted">자산이 없습니다.</td></tr>`;
      }

      const book = Array.isArray(sum.orders?.book) ? sum.orders.book : [];
      const bookMap = new Map(book.map((x) => [x.asset_id, x]));
      // (2026-05-18 v519) 운영자 보고: '호가창 미체결 있는데 거래/주문 요약
      //   비어있음'. 기존 필터는 legacy 상태 (분배중/운영중/매각) 만 매칭 →
      //   Silica 자산 (활성) 이 제외됨. negative filter 로 전환: 모집실패/
      //   취소됨 만 제외.
      const tradeable = assets.filter((a) => !["모집실패", "취소됨"].includes(a.status));

      if (tbodyBook) {
        tbodyBook.innerHTML = tradeable.map((a) => {
          const b = bookMap.get(a.id) || {};
          const bid = b.best_bid != null ? n(b.best_bid) : null;
          const ask = b.best_ask != null ? n(b.best_ask) : null;

          let spreadTxt = "-";
          if (bid != null && ask != null && ask > 0) {
            const sp = ((ask - bid) / ask) * 100;
            spreadTxt = `${fmtNum(sp, 2)}%`;
          }

          const bidCnt = n(b.bid_cnt);
          const askCnt = n(b.ask_cnt);
          const bidQty = n(b.bid_qty);
          const askQty = n(b.ask_qty);

          return `<tr>
            <td><strong>${esc(a.name || a.id)}</strong>${a.name && a.name !== a.id ? `<div class="small-note">${esc(a.id)}</div>` : (a.market ? `<div class="small-note">${esc(a.market)}</div>` : "")}</td>
            <td class="right">${bid != null ? fmtNum(bid, 6) : "-"}</td>
            <td class="right">${ask != null ? fmtNum(ask, 6) : "-"}</td>
            <td class="right">${spreadTxt}</td>
            <td class="right">${bidCnt} / ${askCnt}</td>
            <td class="right">${fmtNum(bidQty, 2)} / ${fmtNum(askQty, 2)}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="6" class="center muted">거래 가능한 자산이 없습니다.</td></tr>`;
      }

      const recentTrades = Array.isArray(sum.trades?.recent) ? sum.trades.recent.slice() : [];
      // (2026-05-18 v524) 자산 ID → 이름 매핑 — 최근 체결 행에서 자산명
      //   primary 표시. 운영자가 자산 편집에서 입력한 이름 노출.
      // (2026-05-21 v740) 운영자 요청 — 자산명 아래 sub-line 의 asset_id
      //   (예: 'SILICA-79907') 텍스트 제거. 자산명만 노출.
      const assetNameMap = new Map(assets.map((a) => [a.id, a.name || a.id]));
      if (tbodyTrades) {
        tbodyTrades.innerHTML = recentTrades.map((t) => {
          const price = n(t.price);
          const qty = n(t.qty);
          const notional = price * qty;
          const aName = assetNameMap.get(t.asset_id) || t.asset_id;
          return `<tr>
            <td>${fmtTime(t.created_at)}</td>
            <td><strong>${esc(aName)}</strong></td>
            <td class="right">${fmtNum(price, 6)}</td>
            <td class="right">${fmtNum(qty, 2)}</td>
            <td class="right">${fmtNum(notional, 2)}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="5" class="center muted">체결이 없습니다.</td></tr>`;
      }

      const sold = Array.isArray(sum.sales?.sold) ? sum.sales.sold : [];
      const redeemAgg = Array.isArray(sum.sales?.redemptions_by_asset) ? sum.sales.redemptions_by_asset : [];
      const redMap = new Map(redeemAgg.map((r) => [r.asset_id, r]));

      if (tbodySales) {
        tbodySales.innerHTML = sold.map((s) => {
          const rr = redMap.get(s.asset_id) || {};
          const redeemedUsdt = n(rr.usdt_sum);
          const vault = n(s.vault_balance_usdt);
          const remaining = Math.max(vault - redeemedUsdt, 0);
          const win = (s.sale_date || s.window_start) ? String(s.sale_date || s.window_start).slice(0, 10) : "-";
          return `<tr>
            <td><strong>${esc(s.asset_id)}</strong><div class="small-note">${esc(s.name || "")}</div></td>
            <td class="right">${money(vault, 6)}</td>
            <td class="right">${win}</td>
            <td class="right">${money(redeemedUsdt, 6)}</td>
            <td class="right">${money(remaining, 6)}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="5" class="center muted">매각 자산이 없습니다.</td></tr>`;
      }

      const stkByAsset = Array.isArray(sum.staking?.by_asset) ? sum.staking.by_asset : [];
      const stkMap = new Map(stkByAsset.map((x) => [x.asset_id, x]));
      // (2026-05-18 v519) 운영자 보고: '스테이킹/이자 카드 비어있음'.
      //   tradeable 과 동일 — Silica '활성' 자산이 포함되어야 함.
      const stakeAssets = assets.filter((a) => !["모집실패", "취소됨", "매각", "매각(완료)"].includes(a.status));

      if (tbodyStaking) {
        tbodyStaking.innerHTML = stakeAssets.map((a) => {
          const s = stkMap.get(a.id) || {};
          return `<tr>
            <td><strong>${esc(a.name || a.id)}</strong>${a.name && a.name !== a.id ? `<div class="small-note">${esc(a.id)}</div>` : ""}</td>
            <td class="right">${fmtNum(n(a.apr), 2)}%</td>
            <td class="right">${fmtNum(n(s.staked_sum), 6)}</td>
            <td class="right">${n(s.stakers)}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="4" class="center muted">스테이킹 대상 자산이 없습니다.</td></tr>`;
      }
    };

    const run = async () => {
      try {
        await render();
      } catch (e) {
        hardCloseDashboardUi("dashboard-render-failed");
        console.error("[admin.dashboard] render failed", e);
        const msg = e?.message || "대시보드 로드 실패";
        renderErrorState(msg);
        showAdminRecovery("관리자 대시보드 데이터를 불러오지 못했습니다.", msg);
        toast(msg, "bad");
      }
    };

    refreshBtn?.addEventListener("click", run);
    await run();
  };

  onReady(() => {
    hardCloseDashboardUi("dashboard-ready");
    void init();
  });
})();
