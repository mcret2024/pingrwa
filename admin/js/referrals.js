(() => {
  "use strict";

  const { qs, qsa, toast, api, bootAdminPage, fmtNum } = window.AdminCore;

  const fmtDate = (s) => {
    if (!s) return "-";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const maskAddr = (value) => {
    const addr = String(value || "").trim();
    if (!addr) return "-";
    if (addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const normalizeAddr = (value) => String(value || "").trim();
  const isLikelySolanaAddress = (value) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalizeAddr(value));

  const referrerRowKey = (row) => String(row?.row_key ?? row?.id ?? row?.address ?? "").trim();
  const encodePathPart = (value) => encodeURIComponent(String(value || "").trim());

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("referrals");
    if (!me) return;

    const els = {
      approveAddr: qs("#refApproveAddr"),
      approveBtn: qs("#refApproveBtn"),
      refreshBtn: qs("#refRefreshBtn"),
      hint: qs("#refHint"),
      tbody: qs("#refListTbody"),
      detailSection: qs("#refDetailSection"),
      detailHint: qs("#refDetailHint"),
      detailLinks: qs("#refDetailLinks"),
      detailBonuses: qs("#refDetailBonuses"),
      rateDisplay: qs("#refRateDisplay"),
      bonusRateInput: qs("#refBonusRateInput"),
      bonusRateSaveBtn: qs("#refBonusRateSaveBtn"),
    };

    // (2026-06-17 v909) 모달을 body 직속으로 이동 — 부모(.card/.admin-shell)의 스태킹
    //   컨텍스트에 갇혀 sticky 헤더(z-index:100) 아래로 상단이 가려지던 문제 방지.
    if (els.detailSection && els.detailSection.parentElement !== document.body) {
      document.body.appendChild(els.detailSection);
    }

    // (2026-06-17 v908) 추천인 상세 모달 닫기 — ✕ 버튼 + 배경(오버레이) 클릭으로 닫음.
    //   카드 내부 클릭은 유지(닫히지 않음). loadDetail 이 hidden 제거로 모달을 연다.
    (() => {
      const closeDetail = () => { if (els.detailSection) els.detailSection.classList.add("hidden"); };
      const closeBtn = qs("#refDetailClose");
      if (closeBtn) closeBtn.addEventListener("click", closeDetail);
      if (els.detailSection) {
        els.detailSection.addEventListener("click", (e) => {
          if (e.target === els.detailSection) closeDetail();
        });
      }
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && els.detailSection && !els.detailSection.classList.contains("hidden")) closeDetail();
      });
    })();

    const setApproveBusy = (busy) => {
      if (!els.approveBtn) return;
      els.approveBtn.disabled = !!busy;
      els.approveBtn.textContent = busy ? "추가 중..." : "추천인 추가";
    };

    const renderEmptyDetail = () => {
      if (els.detailSection) els.detailSection.classList.add("hidden");
      if (els.detailHint) els.detailHint.textContent = "-";
      if (els.detailLinks) {
        els.detailLinks.innerHTML = '<tr><td colspan="2" class="center muted">추천한 유저가 없습니다.</td></tr>';
      }
      if (els.detailBonuses) {
        els.detailBonuses.innerHTML = '<tr><td colspan="5" class="center muted">보너스 내역이 없습니다.</td></tr>';
      }
    };

    const loadReferrers = async () => {
      try {
        const r = await api("/api/admin/referrals", { method: "GET" });
        const list = Array.isArray(r?.referrers) ? r.referrers : [];

        if (els.hint) els.hint.textContent = `총 ${list.length}명의 추천인`;
        if (!els.tbody) return;

        els.tbody.innerHTML = list.map((row) => {
          const addr = maskAddr(row.address);
          const rowKey = referrerRowKey(row);
          const isActive = !!Number(row.is_active || 0);
          const statusBadge = isActive
            ? '<span class="badge good">활성</span>'
            : '<span class="badge bad">비활성</span>';
          const actionAttrs = rowKey ? `data-row-key="${rowKey}"` : "disabled";
          return `
            <tr>
              <td><strong>${addr}</strong>${row.nickname ? `<div class="small-note">${row.nickname}</div>` : ""}</td>
              <td><code>${String(row.code || "-")}</code></td>
              <td class="right">${row.referral_count || 0}</td>
              <td class="right">${fmtNum(row.total_bonus_usdt || 0, 6)}</td>
              <td class="right">${statusBadge}</td>
              <td class="right">
                <div class="tagrow" style="justify-content:flex-end; gap:4px; flex-wrap:wrap">
                  ${/* (2026-06-17 v907) 운영자: 비활성화 버튼 제거 (v903 자율화로 모든 회원 자동 추천인 → 개별 비활성 불필요). 원복: <button class="btn small" type="button" data-toggle ${'$'}{actionAttrs}>${'$'}{isActive ? "비활성화" : "활성화"}</button> */ ""}
                  <button class="btn small" type="button" data-detail ${actionAttrs}>상세</button>
                  ${/* (2026-06-17 v907) 운영자: 삭제 버튼 제거. 원복: <button class="btn small danger" type="button" data-delete ${'$'}{actionAttrs}>삭제</button> */ ""}
                </div>
              </td>
            </tr>
          `;
        }).join("") || '<tr><td colspan="6" class="center muted">등록된 추천인이 없습니다.</td></tr>';

        qsa("[data-toggle]", els.tbody).forEach((btn) => {
          btn.addEventListener("click", async () => {
            const rowKey = btn.getAttribute("data-row-key") || "";
            if (!rowKey) return toast("추천인 식별값이 없습니다.", "bad");
            try {
              await api(`/api/admin/referrals/${encodePathPart(rowKey)}/toggle`, {
                method: "POST",
                body: {},
              });
              toast("상태 변경 완료", "good");
              await loadReferrers();
            } catch (e) {
              toast(e.message || "상태 변경 실패", "bad");
            }
          });
        });

        qsa("[data-detail]", els.tbody).forEach((btn) => {
          btn.addEventListener("click", async () => {
            const rowKey = btn.getAttribute("data-row-key") || "";
            if (!rowKey) return toast("추천인 식별값이 없습니다.", "bad");
            await loadDetail(rowKey);
          });
        });

        qsa("[data-delete]", els.tbody).forEach((btn) => {
          btn.addEventListener("click", async () => {
            const rowKey = btn.getAttribute("data-row-key") || "";
            if (!rowKey) return toast("추천인 식별값이 없습니다.", "bad");
            if (!confirm("이 추천인을 삭제하시겠습니까?")) return;
            try {
              await api(`/api/admin/referrals/${encodePathPart(rowKey)}/delete`, {
                method: "POST",
                body: {},
              });
              toast("삭제 완료", "good");
              renderEmptyDetail();
              await loadReferrers();
            } catch (e) {
              toast(e.message || "삭제 실패", "bad");
            }
          });
        });
      } catch (e) {
        if (els.hint) els.hint.textContent = "추천인 목록을 불러오지 못했습니다.";
        if (els.tbody) {
          els.tbody.innerHTML = '<tr><td colspan="6" class="center muted">추천인 목록을 불러오지 못했습니다.</td></tr>';
        }
        toast(e.message || "추천인 목록 로드 실패", "bad");
      }
    };

    const loadDetail = async (id) => {
      try {
        const r = await api(`/api/admin/referrals/${encodePathPart(id)}/details`, { method: "GET" });
        if (els.detailSection) els.detailSection.classList.remove("hidden");
        if (els.detailHint) {
          els.detailHint.textContent = `추천인: ${maskAddr(r?.referrer?.address)} / 코드: ${r?.referrer?.code || "-"}`;
        }

        const links = Array.isArray(r?.links) ? r.links : [];
        if (els.detailLinks) {
          els.detailLinks.innerHTML = links.map((row) => `
            <tr>
              <td>${maskAddr(row.investor_address)}${row.investor_nickname ? ` (${row.investor_nickname})` : ""}</td>
              <td class="right">${fmtDate(row.created_at)}</td>
            </tr>
          `).join("") || '<tr><td colspan="2" class="center muted">추천한 유저가 없습니다.</td></tr>';
        }

        const bonuses = Array.isArray(r?.bonuses) ? r.bonuses : [];
        if (els.detailBonuses) {
          els.detailBonuses.innerHTML = bonuses.map((row) => `
            <tr>
              <td>${row.month_key || "-"}</td>
              <td>${row.asset_name || row.asset_id || "-"}</td>
              <td class="right">${fmtNum(row.investor_interest_usdt || 0, 6)}</td>
              <td class="right">${((Number(row.bonus_rate) || 0) * 100).toFixed(2)}%</td>
              <td class="right">${fmtNum(row.bonus_usdt || 0, 6)}</td>
            </tr>
          `).join("") || '<tr><td colspan="5" class="center muted">보너스 내역이 없습니다.</td></tr>';
        }
      } catch (e) {
        toast(e.message || "상세 정보를 불러오지 못했습니다.", "bad");
      }
    };

    const loadBonusRate = async () => {
      try {
        const r = await api("/api/admin/settings/referral", { method: "GET" });
        const pct = r?.referral_bonus_pct ?? 1;
        if (els.bonusRateInput) els.bonusRateInput.value = pct;
        if (els.rateDisplay) els.rateDisplay.textContent = `${pct}%`;
      } catch {
        if (els.rateDisplay) els.rateDisplay.textContent = "1%";
      }
    };

    const saveBonusRate = async () => {
      // (2026-05-16 v420) 운영자: 1% 미만 값도 입력 가능 (최소 0.01%).
      // 백엔드 검증과 동일 범위 [0.01, 50]. 0 또는 음수는 영구 차단.
      const pct = parseFloat(els.bonusRateInput?.value);
      if (!Number.isFinite(pct) || pct < 0.01 || pct > 50) {
        toast("보상률은 0.01~50% 사이여야 합니다.", "bad");
        return;
      }
      try {
        await api("/api/admin/settings/referral", {
          method: "POST",
          body: { referral_bonus_pct: pct },
        });
        toast(`보상률이 ${pct}%로 저장되었습니다.`, "good");
        await loadBonusRate();
      } catch (e) {
        toast(e.message || "보상률 저장 실패", "bad");
      }
    };

    const submitApprove = async () => {
      const address = normalizeAddr(els.approveAddr?.value);
      if (!address) {
        toast("추천인 주소를 입력하세요.", "bad");
        els.approveAddr?.focus();
        return;
      }
      if (!isLikelySolanaAddress(address)) {
        toast("올바른 솔라나 지갑 주소를 입력하세요.", "bad");
        els.approveAddr?.focus();
        return;
      }

      try {
        setApproveBusy(true);
        const r = await api("/api/admin/referrals/approve", {
          method: "POST",
          body: { address },
        });

        if (els.approveAddr) els.approveAddr.value = "";

        if (r?.already_exists) {
          toast(r?.message || "이미 등록된 추천인입니다.", "good");
        } else if (r?.code) {
          toast(`추천인 추가 완료 · 코드: ${r.code}`, "good");
        } else {
          toast(r?.message || "추천인 추가 완료", "good");
        }

        await loadReferrers();
      } catch (e) {
        toast(e.message || "추천인 추가 실패", "bad");
      } finally {
        setApproveBusy(false);
      }
    };

    els.approveBtn?.addEventListener("click", submitApprove);
    els.approveAddr?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      submitApprove();
    });

    els.refreshBtn?.addEventListener("click", async () => {
      await Promise.all([loadReferrers(), loadBonusRate()]);
      toast("새로고침 완료", "good");
    });

    els.bonusRateSaveBtn?.addEventListener("click", saveBonusRate);

    renderEmptyDetail();
    await Promise.all([loadReferrers(), loadBonusRate()]);
  });
})();
