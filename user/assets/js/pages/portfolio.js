// public/assets/js/pages/portfolio.js
(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  window.RwaPages["portfolio"] = async () => {
    const C = window.RwaCore || {};
    const qs =
      typeof C.qs === "function"
        ? C.qs
        : (sel, el = document) => el.querySelector(sel);

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
    const countText = (n, unit) => (typeof I18N.formatCount === "function" ? I18N.formatCount(n, unit) : `${n}${unit || ""}`);

    const toast =
      typeof C.toast === "function"
        ? C.toast
        : (msg) => {
            const t = qs("#toast");
            if (t) {
              t.classList.remove("hidden");
              t.textContent = msg;
              clearTimeout(toast._t);
              toast._t = setTimeout(() => t.classList.add("hidden"), 2600);
            } else {
              console.log(msg);
            }
          };

    const fmt =
      C.fmt || {
        num(n, d = 0) {
          const x = Number(n);
          if (!Number.isFinite(x)) return "-";
          return x.toLocaleString("en-US", {
            minimumFractionDigits: d,
            maximumFractionDigits: d,
          });
        },
      };

    const getWallet =
      typeof C.getWallet === "function"
        ? C.getWallet
        : () => ({ connected: false, address: null, token: null, mode: "none" });

    const api =
      typeof C.api === "function"
        ? C.api
        : async () => {
            throw new Error("RwaCore.api가 없습니다.");
          };

    const addrEl = qs("#pfAddr");
    if (!addrEl) return;

    const usdtEl = qs("#pfUsdt");
    const totalEl = qs("#pfTotalTokens");
    const totalStakedEl = qs("#pfTotalStaked");
    const totalInterestEl = qs("#pfTotalInterest");
    const pendingInterestEl = qs("#pfPendingInterest");
    const holdingsEl = qs("#pfHoldings");
    const fundingEl = qs("#pfFunding");
    const contractsEl = qs("#pfContracts");
    const claimablesEl = qs("#pfClaimables");

    const refCodeEl = qs("#pfRefCode");
    const referrerEl = qs("#pfMyReferrer");
    const copyRefBtn = qs("#pfCopyRefBtn");

    const modal = qs("#pfContractModal");
    const doc = qs("#pfContractDoc");
    const signerName = qs("#pfSignerName");
    const signerImg = qs("#pfSignerImage");
    const adminStatus = qs("#pfAdminStatus");
    const adminSignerImg = qs("#pfAdminSignerImage");
    const rejectedReasonBox = qs("#pfRejectedReasonBox");
    const rejectedReasonEl = qs("#pfRejectedReason");
    const closeBtn = qs("#pfContractCloseBtn");
    const backdrop = qs("#pfContractModal .contract-backdrop");

    if (doc) {
      doc.setAttribute("data-no-i18n", "1");
      doc.setAttribute("translate", "no");
    }

    const setText = (el, v) => {
      if (el) el.textContent = v;
    };

    const CONTRACT_STATUS_LABEL = {
      draft: "작성중",
      user_signed: "사용자 서명 완료",
      awaiting_admin: "관리자 서명 대기",
      completed: "양측 서명 완료",
      rejected: "반려",
      void: "무효",
    };

    const contractStatusLabel = (s) => {
      const k = String(s || "").trim();
      return CONTRACT_STATUS_LABEL[k] || k || "-";
    };

    const toDateUtc = (v) => {
      if (!v) return null;
      if (v instanceof Date) return v;

      const s = String(v).trim();
      if (!s) return null;

      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        return new Date(s.replace(" ", "T") + "Z");
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
        return new Date(s + "Z");
      }
      return new Date(s);
    };

    const fmtKst = (v) => {
      const d = toDateUtc(v);
      if (!d || isNaN(d)) return v ? String(v) : "-";

      return new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(d);
    };

    const shortAddr = (a) => {
      const s = String(a || "");
      if (s.length <= 16) return s || "-";
      return `${s.slice(0, 6)}...${s.slice(-6)}`;
    };

    const hasPositiveHolding = (h) => {
      return (
        Number(h?.balance_token || 0) > 0 ||
        Number(h?.staked_token || 0) > 0
      );
    };

    const buildTotalTokenText = (rows) => {
      let total = 0;
      const parts = [];
      (rows || []).forEach((h) => {
        const symbol = String(h?.token_symbol || h?.asset_id || "TOKEN").toUpperCase();
        const amount = Number(h?.balance_token || 0) + Number(h?.staked_token || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        total += amount;
        parts.push(`${symbol} ${fmt.num(amount, 4)}`);
      });
      if (!parts.length) return t("보유 자산 없음");
      return tt(`합산 ${fmt.num(total, 4)} TOKEN (≈ ${fmt.num(total, 4)} USDT) / `, `Total ${fmt.num(total, 4)} TOKEN (≈ ${fmt.num(total, 4)} USDT) / `, `合計 ${fmt.num(total, 4)} TOKEN (≈ ${fmt.num(total, 4)} USDT) / `, `合计 ${fmt.num(total, 4)} TOKEN (≈ ${fmt.num(total, 4)} USDT) / `) + parts.join(" / ");
    };

    const renderDisconnected = (msg = t("지갑을 연결하세요."), walletAddress = "") => {
      setText(addrEl, walletAddress || msg);
      setText(usdtEl, "-");
      setText(totalEl, "-");
      setText(totalStakedEl, "-");
      setText(totalInterestEl, "-");
      setText(pendingInterestEl, "-");
      setText(refCodeEl, "-");
      setText(referrerEl, "-");

      if (copyRefBtn) copyRefBtn.disabled = true;

      if (holdingsEl) {
        holdingsEl.innerHTML =
          `<tr><td colspan="6" class="center muted">${msg}</td></tr>`;
      }

      if (fundingEl) {
        fundingEl.innerHTML =
          `<tr><td colspan="3" class="center muted">${msg}</td></tr>`;
      }

      if (claimablesEl) {
        claimablesEl.innerHTML =
          `<tr><td colspan="3" class="center muted">${msg}</td></tr>`;
      }

      if (contractsEl) {
        contractsEl.innerHTML =
          `<tr><td colspan="6" class="center muted">${msg}</td></tr>`;
      }
    };

    const closeContract = () => {
      if (!modal) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && modal.contains(active)) { try { active.blur(); } catch {} }
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    };

    async function openContract(id) {
      const r = await api(`/api/contracts/${encodeURIComponent(id)}`, {
        auth: true,
      }).catch(() => null);

      if (!r?.contract) {
        toast("계약 조회 실패");
        return;
      }

      const c = r.contract;

      if (doc) {
        doc.innerHTML = c.contract_body_html || `<div class="muted">${t("계약서 내용이 없습니다.")}</div>`;
        doc.setAttribute("data-no-i18n", "1");
        doc.setAttribute("translate", "no");
      }

      if (signerName) {
        signerName.textContent = c.signer_name || "-";
      }

      if (signerImg) {
        if (c.user_signature_path) {
          signerImg.src = c.user_signature_path;
          signerImg.style.display = "";
        } else {
          signerImg.removeAttribute("src");
          signerImg.style.display = "none";
        }
      }

      if (adminStatus) {
        adminStatus.textContent = c.status === "completed" ? t("관리자 서명 완료") : (c.status === "rejected" ? t("관리자 반려") : t("관리자 서명 대기"));
      }

      if (rejectedReasonBox && rejectedReasonEl) {
        if (String(c.status || '') === 'rejected' && c.rejected_reason) {
          rejectedReasonEl.textContent = String(c.rejected_reason || '-');
          rejectedReasonBox.classList.remove('hidden');
        } else {
          rejectedReasonEl.textContent = '-';
          rejectedReasonBox.classList.add('hidden');
        }
      }

      if (adminSignerImg) {
        if (c.admin_signature_path) {
          adminSignerImg.src = c.admin_signature_path;
          adminSignerImg.style.display = "";
        } else {
          adminSignerImg.removeAttribute("src");
          adminSignerImg.style.display = "none";
        }
      }

      if (modal) { modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false"); }
    }

    async function loadContracts() {
      if (!contractsEl) return;

      try {
        const r = await api("/api/contracts/my-all", { auth: true }).catch(() => null);
        const rows = Array.isArray(r?.rows) ? r.rows : [];

        const visibleRows = rows.filter((c) => String(c.status || "") !== "void");

        if (!visibleRows.length) {
          contractsEl.innerHTML =
            `<tr><td colspan="4" class="center muted">${t("계약 없음")}</td></tr>`;
          return;
        }

        contractsEl.innerHTML = visibleRows
          .map((c) => {
            const assetLabel = c.asset_name || c.asset_id || "-";
            return `
              <tr>
                <td>${assetLabel}</td>
                <td>${fmt.num(c.amount_usdt, 2)} USDT</td>
                <td>${contractStatusLabel(c.status)}${String(c.status || '') === 'rejected' && c.rejected_reason ? `<div class="small-note" style="color:#dc2626">${String(c.rejected_reason)}</div>` : ''}</td>
                <td class="right">
                  <button class="btn small" type="button" data-contract-id="${c.id}">보기</button>
                </td>
              </tr>
            `;
          })
          .join("");

        contractsEl.querySelectorAll("[data-contract-id]").forEach((btn) => {
          btn.addEventListener("click", () => openContract(btn.dataset.contractId));
        });
      } catch (_) {
        contractsEl.innerHTML =
          `<tr><td colspan="4" class="center muted">${t("계약 없음")}</td></tr>`;
      }
    }

    const renderClaimables = async () => {
      if (!claimablesEl) return;
      try {
        const r = await api('/api/claim/my-assets', { method: 'GET', auth: true });
        const rows = Array.isArray(r?.assets) ? r.assets : [];
        const visible = rows.filter((x) => ['분배중','운영중','매각','매각(완료)'].includes(String(x.status || x.assetStatus || '')));
        if (!visible.length) {
          claimablesEl.innerHTML = `<tr><td colspan="3" class="center muted">${t("분배 대기 또는 클레임 가능한 자산이 없습니다.")}</td></tr>`;
          return;
        }
        claimablesEl.innerHTML = visible.map((a) => {
          const st = String(a.status || a.assetStatus || '-');
          // Silica 자동 분배 (2026-05-05): STO 토큰은 관리자 서명 시 자동 증액 — claim.html 로 보내지 않음.
          // claim.html 은 이자/배당 클레임 전용. 자산 카드는 자산 상세로만 연결.
          const href = `ir.html?id=${encodeURIComponent(a.id || a.assetId)}`;
          const label = t(String(a.claim_label || '').trim() || (st === '분배중' || st === '운영중' || st === '매각' || st === '매각(완료)' ? '확인' : '상세'));
          const extra = String(a.claim_state || '') === 'claimed'
            ? `<div class="small-note" style="color:var(--green)">${t("이미 내 클레임을 완료했습니다.")}</div>`
            : (Number(a.available_token || 0) > 0 ? `<div class="small-note" style="color:#2563eb">${tt(`${fmt.num(a.available_token, 4)} 토큰 수령 가능`, `${fmt.num(a.available_token, 4)} tokens claimable`, `${fmt.num(a.available_token, 4)} トークン受取可能`, `${fmt.num(a.available_token, 4)} 代币可领取`)}</div>` : '');
          return `<tr>
            <td><strong>${a.id || a.assetId}</strong><div class="small-note">${a.name || a.assetName || ''}</div></td>
            <td>${t(st)}${extra}</td>
            <td class="right"><a class="btn small primary" href="${href}">${label}</a></td>
          </tr>`;
        }).join('');
      } catch (_) {
        claimablesEl.innerHTML = `<tr><td colspan="3" class="center muted">${t("분배 자산을 불러오지 못했습니다.")}</td></tr>`;
      }
    };

    const render = async () => {
      const w = getWallet();

      if (!w.connected) {
        renderDisconnected("지갑을 연결하세요.");
        return;
      }

      let pf = null;

      try {
        pf = await api("/api/portfolio", { method: "GET", auth: true });
      } catch (e) {
        if (e?.status === 401) {
          renderDisconnected("OTP 인증이 필요합니다.", w.address || "");
          return;
        }
        toast(e?.message || "포트폴리오 로드 실패");
        renderDisconnected("포트폴리오를 불러오지 못했습니다.", w.address || "");
        return;
      }

      setText(addrEl, pf.address || w.address || "-");
      setText(usdtEl, `${fmt.num(pf.usdt, 2)} USDT`);

      setText(refCodeEl, pf.myRefCode || w.address || "-");
      setText(referrerEl, pf.myReferrer || "-");

      if (copyRefBtn) {
        copyRefBtn.disabled = false;

        if (!copyRefBtn.dataset.bound) {
          copyRefBtn.dataset.bound = "1";

          copyRefBtn.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(pf.myRefCode || w.address || "");
              toast("추천코드 복사 완료");
            } catch {
              toast("복사 실패");
            }
          });
        }
      }

      const allHoldings = Array.isArray(pf.holdings) ? pf.holdings : [];
      const visibleHoldings = allHoldings.filter(hasPositiveHolding);
      const interestSummary = pf.interestSummary || {};
      const totalStaked = visibleHoldings.reduce((sum, h) => sum + Number(h?.staked_token || 0), 0);
      const totalInterest = Object.values(interestSummary).reduce((sum, row) => sum + Number(row?.claimed_interest_usdt || 0), 0);
      const pendingInterest = Object.values(interestSummary).reduce((sum, row) => sum + Number(row?.pending_interest_usdt || 0), 0);

      setText(totalEl, buildTotalTokenText(visibleHoldings));
      setText(totalStakedEl, totalStaked > 0 ? `${fmt.num(totalStaked, 4)} TOKEN` : '0 TOKEN');
      setText(totalInterestEl, `${fmt.num(totalInterest, 1)} USDT`);
      setText(pendingInterestEl, pendingInterest > 0 ? tt(`${fmt.num(pendingInterest, 1)} USDT (${countText(Object.values(interestSummary).reduce((sum, row) => sum + Number(row?.pending_rounds || 0), 0), "회차")} ${t("대기")})`, `${fmt.num(pendingInterest, 1)} USDT (${Object.values(interestSummary).reduce((sum, row) => sum + Number(row?.pending_rounds || 0), 0)} rounds pending)`, `${fmt.num(pendingInterest, 1)} USDT（${Object.values(interestSummary).reduce((sum, row) => sum + Number(row?.pending_rounds || 0), 0)}回分待機）`, `${fmt.num(pendingInterest, 1)} USDT（${Object.values(interestSummary).reduce((sum, row) => sum + Number(row?.pending_rounds || 0), 0)} 期待领取）`) : t('없음'));

      if (holdingsEl) {
        if (!visibleHoldings.length) {
          holdingsEl.innerHTML =
            `<tr><td colspan="6" class="center muted">${t("보유 내역이 없습니다.")}</td></tr>`;
        } else {
          holdingsEl.innerHTML = visibleHoldings
            .map((h) => {
              const symbol = String(h.token_symbol || h.asset_id || 'TOKEN').toUpperCase();
              const summary = interestSummary[String(h.asset_id)] || {};
              const claimed = Number(summary?.claimed_interest_usdt || 0);
              const pending = Number(summary?.pending_interest_usdt || 0);
              return `
                <tr>
                  <td>
                    <strong>${h.asset_id}</strong>
                    <div class="small-note">${h.name || ""}</div>
                    <div class="small-note">${tt(`토큰 ${symbol}`, `Token ${symbol}`, `トークン ${symbol}`, `代币 ${symbol}`)}</div>
                  </td>
                  <td class="right">${fmt.num(h.balance_token, 4)} ${symbol}</td>
                  <td class="right">${fmt.num(h.staked_token, 4)} ${symbol}</td>
                  <td class="right">${fmt.num(claimed, 1)} USDT</td>
                  <td class="right">${pending > 0 ? `${fmt.num(pending, 1)} USDT` : '-'}</td>
                  <td class="right">
                    <a class="btn small" href="ir.html?id=${encodeURIComponent(h.asset_id)}">${t("상세")}</a>
                    <a class="btn small" href="staking.html?id=${encodeURIComponent(h.asset_id)}">${t("스테이킹")}</a>
                  </td>
                </tr>
              `;
            })
            .join("");
        }
      }

      if (fundingEl) {
        const rows = Array.isArray(pf.funding) ? pf.funding.slice(0, 50) : [];

        fundingEl.innerHTML = rows.length
          ? rows
              .map((r) => {
                const assetLabel = r.asset_name || r.name || "";
                const fundingStatusLabel = String(r.funding_status_label || "").trim();
                return `
                <tr>
                  <td>
                    <a href="ir.html?id=${encodeURIComponent(r.asset_id)}">
                      <strong>${r.asset_id}</strong>
                    </a>
                    ${assetLabel ? `<div class="small-note">${assetLabel}</div>` : ""}
                    ${fundingStatusLabel ? `<div class="small-note" style="color:#dc2626">${fundingStatusLabel}</div>` : ""}
                  </td>
                  <td class="right">${fmt.num(r.amount_usdt, 2)}</td>
                  <td class="right">${fmtKst(r.created_at)}</td>
                </tr>
              `;
              })
              .join("")
          : `<tr><td colspan="3" class="center muted">참여 내역이 없습니다.</td></tr>`;
      }

      await renderClaimables();
      await loadContracts();
    };

    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = "1";
      closeBtn.addEventListener("click", closeContract);
    }

    if (backdrop && !backdrop.dataset.bound) {
      backdrop.dataset.bound = "1";
      backdrop.addEventListener("click", closeContract);
    }

    if (modal && !modal.dataset.escBound) {
      modal.dataset.escBound = "1";
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
          closeContract();
        }
      });
    }

    await render();
  };
})();