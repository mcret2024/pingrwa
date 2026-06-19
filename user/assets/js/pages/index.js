(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  window.RwaPages["index"] = async () => {
    const C = window.RwaCore || {};

    const qs = typeof C.qs === "function" ? C.qs : (sel, el = document) => el.querySelector(sel);
    const clamp = typeof C.clamp === "function" ? C.clamp : (n, a, b) => Math.max(a, Math.min(b, n));

    const toast =
      typeof C.toast === "function"
        ? C.toast
        : (msg) => {
            const el = qs("#toast");
            if (!el) return;
            el.classList.remove("hidden");
            el.textContent = msg;
            clearTimeout(toast._t);
            toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
          };

    const fmt =
      C.fmt ||
      {
        num(n, d = 0) {
          const x = Number(n);
          if (!Number.isFinite(x)) return "-";
          return x.toLocaleString("en-US", {
            minimumFractionDigits: d,
            maximumFractionDigits: d,
          });
        },
        pct(n, d = 1) {
          const x = Number(n);
          if (!Number.isFinite(x)) return "-";
          return `${x.toLocaleString("en-US", {
            minimumFractionDigits: d,
            maximumFractionDigits: d,
          })}%`;
        },
        date(s) {
          if (!s) return "-";
          const d = new Date(s);
          if (isNaN(d)) return String(s);
          return d.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        },
        time(s) {
          if (!s) return "-";
          const d = new Date(s);
          if (isNaN(d)) return String(s);
          return d.toLocaleString("ko-KR", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
        },
      };

    const api =
      typeof C.api === "function"
        ? C.api
        : async () => {
            throw new Error("RwaCore.api가 없습니다.");
          };

    const COUNTRY_LABEL = {
      KR: "대한민국",
      US: "미국",
      KZ: "카자흐스탄",
      PH: "필리핀",
      GE: "조지아",
      ID: "인도네시아",
      VN: "베트남",
    };

    const SAFE_STATUS_LABEL = (s) => {
      if (s === "모집중") return "모집중";
      if (s === "구매진행") return "모집완료 · 매입중";
      if (s === "분배중") return "토큰 분배중";
      if (s === "운영중") return "운영중";
      if (s === "매각") return "매각";
      if (s === "모집실패") return "모집실패";
      if (s === "취소됨") return "취소됨";
      return s || "-";
    };

    const getKSTParts = () => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const map = {};
      parts.forEach((p) => (map[p.type] = p.value));
      return { y: Number(map.year), m: Number(map.month), d: Number(map.day) };
    };

    const nextPayday = (payday = 15) => {
      const { y, m, d } = getKSTParts();
      const cur = new Date(Date.UTC(y, m - 1, d));
      let next = new Date(Date.UTC(y, m - 1, payday));
      if (cur > next) next = new Date(Date.UTC(y, m, payday));
      return next;
    };

    const applyHeroGridLayout = () => {
      const grid = qs(".hero-grid");
      const qm = qs("#quickMenuCard");
      if (!grid) return;

      if (qm && qm.classList.contains("hidden")) {
        grid.style.gridTemplateColumns = "1fr";
      } else {
        grid.style.gridTemplateColumns = "";
      }
    };

    const statusOrder = (s) => {
      if (s === "모집중") return 0;
      if (s === "구매진행") return 1;
      if (s === "분배중") return 2;
      if (s === "운영중") return 3;
      if (s === "매각") return 4;
      if (s === "모집실패") return 5;
      if (s === "취소됨") return 6;
      return 99;
    };

    const normalizeStatusForUi = (a) => {
      const status = String(a?.status || "");
      const raised = Number(a?.raised_usdt || 0);
      const target = Number(a?.target_usdt || 0);

      if (status === "모집중" && target > 0 && raised >= target) {
        return "구매진행";
      }

      return status;
    };

    const normalizeAssetForUi = (a) => {
      if (!a) return a;
      return {
        ...a,
        status: normalizeStatusForUi(a),
      };
    };

    const compareAssets = (a, b) => {
      const sa = normalizeStatusForUi(a);
      const sb = normalizeStatusForUi(b);

      const primary = statusOrder(sa) - statusOrder(sb);
      if (primary !== 0) return primary;

      return String(a?.id || "").localeCompare(String(b?.id || ""), "en", {
        numeric: true,
        sensitivity: "base",
      });
    };

    const canShowClaimCta = (a) => {
      const status = normalizeStatusForUi(a);
      if (!(status === "분배중" || status === "운영중" || status === "매각")) return false;

      const supply = Number(a?.supply_token || 0);
      const denom = Number(a?.funded_snapshot_usdt || a?.raised_usdt || 0);

      return supply > 0 && denom > 0;
    };

    const fundPct = (a) => {
      if (typeof C.fundPct === "function") return C.fundPct(a);
      const raised = Number(a?.raised_usdt || 0);
      const target = Number(a?.target_usdt || 0);
      if (!target) return 0;
      return clamp((raised / target) * 100, 0, 100);
    };

    const statusBadge = (s) => {
      if (typeof C.statusBadge === "function") return C.statusBadge(s);
      if (s === "모집중") return `<span class="badge warn">모집중</span>`;
      if (s === "구매진행") return `<span class="badge neutral">모집완료 · 매입중</span>`;
      if (s === "분배중") return `<span class="badge neutral">토큰 분배중</span>`;
      if (s === "운영중") return `<span class="badge good">운영중</span>`;
      if (s === "매각") return `<span class="badge bad">매각</span>`;
      if (s === "모집실패") return `<span class="badge bad">모집실패</span>`;
      if (s === "취소됨") return `<span class="badge bad">취소됨</span>`;
      return `<span class="badge neutral">${s || "-"}</span>`;
    };

    const tradeable = (a) => {
      const s = normalizeStatusForUi(a);
      return s === "분배중" || s === "운영중" || s === "매각";
    };

    const loadAssets = async () => {
      const data = await api("/api/assets", { auth: false });
      return (data.assets || []).map(normalizeAssetForUi);
    };

    const loadTrades = async (assetId) => {
      const data = await api(`/api/trades?assetId=${encodeURIComponent(assetId)}`, { auth: false });
      return data.trades || [];
    };


    const claimStatusMap = new Map();

    const fetchClaimStatuses = async () => {
      claimStatusMap.clear();
      try {
        const res = await api('/api/claim/status', { auth: true });
        const rows = Array.isArray(res?.claims) ? res.claims : [];
        rows.forEach((row) => {
          const key = String(row?.assetId || row?.id || '').trim();
          if (key) claimStatusMap.set(key, row);
        });
      } catch (_) {
      }
    };

    const claimStatusOf = (assetId) => claimStatusMap.get(String(assetId || '').trim()) || null;

    const hasReceivedDistribution = (assetId) => {
      const row = claimStatusOf(assetId);
      if (!row) return false;
      if (String(row.claim_state || '').trim() === 'claimed') return true;
      return Number(row.available_token || row.availableToken || 0) <= 0
        && Number(row.claimed_token || row.alreadyClaimedToken || 0) > 0;
    };

    // Silica 자동 분배 모델 (2026-05-05): 관리자 서명 시점에 holdings 즉시 증액.
    // 별도 "토큰 받기" 버튼 없음 — 포트폴리오에서 즉시 확인 가능.
    const claimButtonHtml = (_a) => "";

    const actionButtons = (a, uiStatus) => {
      if (uiStatus === "모집중") {
        return `
          <a class="btn small primary" href="assets.html?id=${encodeURIComponent(a.id)}">모금 참여</a>
          <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">상세</a>
        `;
      }

      if (uiStatus === "구매진행") {
        return `
          <a class="btn small primary" href="ir.html?id=${encodeURIComponent(a.id)}">진행 확인</a>
          <a class="btn small" href="assets.html">자산</a>
        `;
      }

      if (uiStatus === "분배중") {
        return `
          ${claimButtonHtml(a)}
          <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">상세</a>
          <a class="btn small" href="trade.html?id=${encodeURIComponent(a.id)}">거래</a>
        `;
      }

      if (uiStatus === "운영중") {
        return `
          ${claimButtonHtml(a)}
          <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">상세</a>
          <a class="btn small" href="trade.html?id=${encodeURIComponent(a.id)}">거래</a>
        `;
      }

      if (uiStatus === "매각") {
        return `
          <a class="btn small primary" href="sale-detail.html?id=${encodeURIComponent(a.id)}">매각 차익 받기</a>
          <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">상세</a>
        `;
      }

      if (uiStatus === "모집실패" || uiStatus === "취소됨") {
        return `
          <a class="btn small primary" href="assets.html?id=${encodeURIComponent(a.id)}">환불/내역</a>
          <a class="btn small" href="ir.html?id=${encodeURIComponent(a.id)}">상세</a>
        `;
      }

      return `<a class="btn small primary" href="ir.html?id=${encodeURIComponent(a.id)}">상세</a>`;
    };

    const fundingBarBlock = (a) => {
      const raised = Number(a?.raised_usdt || 0);
      const target = Number(a?.target_usdt || 0);
      const pct = fundPct(a);

      const raisedTxt = Number.isFinite(raised) ? fmt.num(raised, 0) : "-";
      const targetTxt = Number.isFinite(target) ? fmt.num(target, 0) : "-";

      return `
        <div style="margin-top:12px">
          <div class="muted" style="font-size:12px">모금 진행</div>
          <div style="margin-top:8px" class="progress"><div style="width:${pct}%"></div></div>
          <div style="margin-top:10px; font-weight:950; font-size:18px">
            ${raisedTxt} / ${targetTxt} USDT
          </div>
          <div class="small-note" style="margin-top:6px">
            모집률 ${fmt.num(pct, 1)}% · 목표 달성 시 매입 단계로 전환됩니다.
          </div>
        </div>
      `;
    };

    const phaseNote = (uiStatus) => {
      if (uiStatus === "구매진행") {
        return `
          <div class="small-note" style="margin-top:10px">
            모집완료 후 오프라인 매입 절차가 진행 중입니다.
          </div>
        `;
      }
      if (uiStatus === "분배중") {
        return `
          <div class="small-note" style="margin-top:10px">
            토큰 발행 후 분배(클레임)가 진행 중입니다.
          </div>
        `;
      }
      if (uiStatus === "운영중") {
        return `
          <div class="small-note" style="margin-top:10px">
            운영 단계: 스테이킹 이자 및 P2P 거래가 가능합니다.
          </div>
        `;
      }
      if (uiStatus === "매각") {
        return `
          <div class="small-note" style="margin-top:10px">
            매각 정산 완료: 토큰 반환 후 차익을 수령합니다.
          </div>
        `;
      }
      if (uiStatus === "모집실패") {
        return `
          <div class="small-note" style="margin-top:10px">
            모집 미달: 만료 후 환불(Refund) 청구가 열립니다.
          </div>
        `;
      }
      if (uiStatus === "취소됨") {
        return `
          <div class="small-note" style="margin-top:10px">
            매입 취소 자산입니다. 환불/참여 내역을 확인하세요.
          </div>
        `;
      }
      return ``;
    };

    const featuredCardHTML = (a) => {
      const uiStatus = normalizeStatusForUi(a);

      const imgUrl = typeof C.assetImageUrl === "function" ? C.assetImageUrl(a.image_url || "") : (typeof C.absUrl === "function" ? C.absUrl(a.image_url || "") : a.image_url || "");
      const tokenUrl = typeof C.tokenImageUrl === "function" ? C.tokenImageUrl(a.token_image_url || "") : (typeof C.absUrl === "function" ? C.absUrl(a.token_image_url || "") : a.token_image_url || "");

      const cc = String(a.country_code || "KR").toUpperCase();
      const countryName = COUNTRY_LABEL[cc] || cc;

      const cur = String(a.settlement_basis || "KRW").toUpperCase();
      const settleLabel = `${cur} 기준 정산 → USDT 지급`;

      return `
        <div class="card asset-card">
          <div class="thumb">
            <img src="${imgUrl}" alt="${a.name || ''}">
            <div class="token-overlay"><img src="${tokenUrl}" alt="${a.market || ''}"></div>
          </div>
          <div class="pad">
            <div class="tagrow" style="justify-content:space-between; gap:10px; flex-wrap:wrap">
              <div class="tagrow" style="gap:8px; flex-wrap:wrap">
                ${statusBadge(uiStatus)}
                <span class="chip">${a.market || ""}</span>
              </div>
              <span class="badge neutral">${countryName}</span>
            </div>

            <h3 style="margin-top:8px">${a.name || ""}</h3>

            <div class="muted" style="font-size:13px">
              고정 이자 ${fmt.pct(a.apr, 1)} · 모금마감 ${fmt.date(a.fund_end_date)}
            </div>
            <div class="muted" style="font-size:12px; margin-top:6px">
              ${settleLabel}
            </div>

            ${
              uiStatus === "모집중"
                ? fundingBarBlock(a)
                : `<div class="row" style="margin-top:12px">
                     <div class="muted" style="font-size:12px">상태</div>
                     <div style="font-weight:900">${SAFE_STATUS_LABEL(uiStatus)}</div>
                   </div>`
            }

            ${phaseNote(uiStatus)}

            <div class="row" style="margin-top:12px; justify-content:flex-start; gap:10px; flex-wrap:wrap">
              ${actionButtons(a, uiStatus)}
            </div>

            ${
              String(a.status) === "모집중" &&
              Number(a.target_usdt || 0) > 0 &&
              Number(a.raised_usdt || 0) >= Number(a.target_usdt || 0)
                ? `<div class="small-note" style="margin-top:10px">
                     * 모집 달성으로 단계 전환 처리 중입니다. 잠시 후 다시 확인하세요.
                   </div>`
                : ``
            }
          </div>
        </div>
      `;
    };

    const pickFeaturedAssets = (assets) => {
      const sorted = assets.slice().sort(compareAssets);

      const a1 = sorted.find((a) => normalizeStatusForUi(a) === "모집중") || null;
      const a2 =
        sorted.find((a) => {
          const s = normalizeStatusForUi(a);
          return s === "구매진행" || s === "분배중" || s === "운영중";
        }) || null;
      const a3 = sorted.find((a) => normalizeStatusForUi(a) === "매각") || null;

      const result = [];
      const used = new Set();

      const pushUnique = (a) => {
        if (!a || used.has(a.id)) return;
        used.add(a.id);
        result.push(a);
      };

      pushUnique(a1);
      pushUnique(a2);
      pushUnique(a3);

      for (const a of sorted) {
        if (result.length >= 3) break;
        pushUnique(a);
      }

      return result;
    };

    const loadHomeSummaryKpi = async () => {
      const elInterest = qs("#kpiTotalInterest");
      const elSaleProfit = qs("#kpiTotalSaleProfit");
      const elTotal = qs("#kpiTotalAssets");
      const elActive = qs("#kpiActiveProjects");
      const elPayday = qs("#kpiNextPayday");

      if (elInterest) elInterest.textContent = "-";
      if (elSaleProfit) elSaleProfit.textContent = "-";

      try {
        const j = await api("/api/home/summary");
        if (!j || !j.ok) return;

        const platform = j.platform || j;
        if (platform) {
          // kpiTotalAssets 는 Silica 신규 디자인에서 "총 포트폴리오 USDT 가치" 의미로 재정의됨.
          // 레거시 자산 개수 표기 비활성화 (silica-data-bind.js 가 USDT 단위로 갱신).
          // if (elTotal && platform.total_assets != null) elTotal.textContent = `${Number(platform.total_assets)}개`;
          if (elActive && platform.active_assets != null) elActive.textContent = `${Number(platform.active_assets)}개`;

          const d = String(platform.next_interest_pay_date || platform.next_interest_date || "");
          if (elPayday && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            const [, mm, dd] = d.split("-").map(Number);
            elPayday.textContent = `${mm}월 ${dd}일`;
          }

          const totalInterest = platform.total_interest_usdt ?? platform.total_interest_paid_usdt;
          if (elInterest && totalInterest != null) {
            elInterest.textContent = `${fmt.num(totalInterest, 2)} USDT`;
          }

          const pVal = platform.sale_profit_computable
            ? platform.total_sale_profit_usdt
            : platform.total_sale_payout_usdt;

          if (elSaleProfit && pVal != null) {
            elSaleProfit.textContent = `${fmt.num(pVal, 2)} USDT`;
          }
        }
      } catch (e) {
        console.warn("[home/summary] fail:", e);
      }
    };

    const bindHomeKpiRefreshOnWallet = () => {
      const btn = qs("#walletBtn");
      if (!btn) return;
      if (btn.dataset.kpiBound === "1") return;
      btn.dataset.kpiBound = "1";

      btn.addEventListener("click", () => {
        setTimeout(() => {
          loadHomeSummaryKpi().catch(() => {});
          renderIndex().catch(() => {});
        }, 1200);
      });
    };

    const renderIndex = async () => {
      applyHeroGridLayout();

      const kpiTotal = qs("#kpiTotalAssets");
      const kpiActive = qs("#kpiActiveProjects");
      const kpiPayday = qs("#kpiNextPayday");
      const featured = qs("#featuredAssets");
      const recentTradesBody = qs("#recentTrades");

      const assets = (await loadAssets()).slice().sort(compareAssets);
      await fetchClaimStatuses();

      // kpiTotalAssets 는 Silica 신규 디자인에서 "총 포트폴리오 USDT 가치" 의미로 재정의됨.
      // 레거시 자산 개수(`${assets.length}개`) 덮어쓰기 비활성화 — silica-data-bind.js 가 USDT 단위로 갱신.
      // if (kpiTotal) kpiTotal.textContent = `${assets.length}개`;

      if (kpiActive) {
        const activeCnt = assets.filter((a) => {
          const s = normalizeStatusForUi(a);
          return s === "모집중" || s === "구매진행" || s === "분배중" || s === "운영중";
        }).length;
        kpiActive.textContent = `${activeCnt}개`;
      }

      if (kpiPayday) {
        let payday = 15;
        try {
          if (typeof C.getConfig === "function") {
            const cfg = await C.getConfig();
            payday = Number(cfg?.interest_pay_day || 15);
          } else {
            const cfg = await api("/api/public/config", { auth: false });
            payday = Number(cfg?.interest_pay_day || 15);
          }
        } catch {}

        const next = nextPayday(payday);
        kpiPayday.textContent = next.toLocaleDateString("ko-KR", {
          month: "long",
          day: "numeric",
          timeZone: "Asia/Seoul",
        });
      }

      await loadHomeSummaryKpi();

      if (featured) {
        const pick = pickFeaturedAssets(assets);
        featured.innerHTML =
          pick.map(featuredCardHTML).join("") ||
          `<div class="muted">표시할 자산이 없습니다.</div>`;
      }

      if (recentTradesBody) {
        const tradeableAssets = assets.filter(tradeable).slice(0, 10);

        const lists = await Promise.all(
          tradeableAssets.map(async (a) => {
            const t = await loadTrades(a.id).catch(() => []);
            return (t || []).map((r) => ({ ...r, assetId: a.id }));
          })
        );

        const rows = lists
          .flat()
          .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
          .slice(0, 8);

        recentTradesBody.innerHTML =
          rows
            .map((r) => {
              const a = assets.find((x) => x.id === r.assetId);
              if (!a) return "";
              return `<tr>
                <td><a href="ir.html?id=${encodeURIComponent(a.id)}"><strong>${a.id}</strong></a><div class="small-note">${a.name || ""}</div></td>
                <td class="right">${fmt.num(r.price, 4)} USDT</td>
                <td class="right">${fmt.num(r.qty, 2)}</td>
                <td class="right">${fmt.time(r.created_at)}</td>
              </tr>`;
            })
            .join("") || `<tr><td colspan="4" class="center muted">최근 체결이 없습니다.</td></tr>`;
      }
    };

    try {
      bindHomeKpiRefreshOnWallet();
      await renderIndex();
    } catch (e) {
      toast(e.message || "렌더링 실패", "bad");
    }
  };
})();