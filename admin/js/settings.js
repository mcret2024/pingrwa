// public/admin/js/settings.js
(() => {
  "use strict";

  const { qs, toast, api, apiBase, fmtNum, bootAdminPage, toNum } = window.AdminCore;

  document.addEventListener("DOMContentLoaded", async () => {
    const me = await bootAdminPage("settings");
    if (!me) return;

    const fxKRW = qs("#fxKRW");
    const fxUSD = qs("#fxUSD");
    const fxKZT = qs("#fxKZT");
    const fxPHP = qs("#fxPHP");
    const fxGEL = qs("#fxGEL");
    const fxIDR = qs("#fxIDR");
    const fxVND = qs("#fxVND");

    const fxNow = qs("#fxNow");
    const fxRefreshBtn = qs("#fxRefreshBtn");
    const fxSaveBtn = qs("#fxSaveBtn");

    // (2026-05-08) Live FX summary — provider + last fetched rate.
    const fxLiveProvider = qs("#fxLiveProvider");
    const fxLiveRate = qs("#fxLiveRate");
    const fxLiveLastAt = qs("#fxLiveLastAt");
    const fxLiveError = qs("#fxLiveError");
    // Provider chain editor (admin sets ordered try list)
    const fxProviderChain = qs("#fxProviderChain");
    const fxProviderSaveBtn = qs("#fxProviderSaveBtn");

    const stkPayday = qs("#stkPayday");
    const stkLockDays = qs("#stkLockDays");

    const apiBaseNow = qs("#apiBaseNow");
    if (apiBaseNow) apiBaseNow.textContent = apiBase() || "(same-origin)";

    // Deposit
    const depInput = qs("#depositAddrInput");
    const depNow = qs("#depositAddrNow");
    const depRefreshBtn = qs("#depRefreshBtn");
    const depSaveBtn = qs("#depSaveBtn");

    // Withdraw admin wallet
    const wdWalletInput = qs("#withdrawAddrInput");
    const withdrawFeeMode = qs("#withdrawFeeMode");
    const withdrawFeeInput = qs("#withdrawFeeInput");
    const withdrawFeePercentInput = qs("#withdrawFeePercentInput");
    const withdrawFeeFixedWrap = qs("#withdrawFeeFixedWrap");
    const withdrawFeePercentWrap = qs("#withdrawFeePercentWrap");
    const withdrawFeeNow = qs("#withdrawFeeNow");
    const wdFeeSaveBtn = qs("#wdFeeSaveBtn");
    const wdWalletNow = qs("#withdrawAddrNow");
    const wdWalletRefreshBtn = qs("#wdWalletRefreshBtn");
    const wdWalletSaveBtn = qs("#wdWalletSaveBtn");

    // ---- helpers ----
    const n6 = (v) => {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    };

    const setFxInputs = (m) => {
      const v = (k) => String(n6(m?.[k] ?? 0));
      if (fxKRW) fxKRW.value = v("KRW");
      if (fxUSD) fxUSD.value = v("USD");
      if (fxKZT) fxKZT.value = v("KZT");
      if (fxPHP) fxPHP.value = v("PHP");
      if (fxGEL) fxGEL.value = v("GEL");
      if (fxIDR) fxIDR.value = v("IDR");
      if (fxVND) fxVND.value = v("VND");
    };

    const renderFxNow = (m) => {
      const order = ["KRW", "USD", "KZT", "PHP", "GEL", "IDR", "VND"];
      const lines = order.map((ccy) => {
        const val = n6(m?.[ccy] ?? 0);
        return `1 USDT = ${fmtNum(val, 6)} ${ccy}`;
      });
      if (fxNow) fxNow.textContent = lines.join(" / ");
    };

    // (2026-05-08) Map known fx_worker_provider keys to display labels.
    //   /api/admin/fx/live returns the raw key (e.g. 'coingecko'); the
    //   admin panel shows a human-readable name. Falls back to the raw
    //   key when unmapped, and to '수동 입력' when the mode is manual.
    const FX_PROVIDER_LABEL = {
      coingecko: "CoinGecko",
      coinmarketcap: "CoinMarketCap",
      coinlore: "CoinLore",
      binance: "Binance",
      kraken: "Kraken",
      er_api: "ExchangeRate-API",
      "exchangerate-api": "ExchangeRate-API",
      frankfurter: "Frankfurter",
      yahoo: "Yahoo Finance",
      manual: "수동 입력",
      "": "수동 입력",
    };

    const loadFxLive = async () => {
      // Read live worker output (provider + latest fetched rate). The
      //   /api/admin/fx/live endpoint returns { mode, provider, last_at,
      //   provider_chain: ['coingecko', ...], fx_rates: { KRW }, latest: [...],
      //   worker_last_error }.
      try {
        const live = await api("/api/admin/fx/live", { method: "GET" });
        const provRaw = String(live?.provider || "").trim();
        const provLabel = FX_PROVIDER_LABEL[provRaw.toLowerCase()] || provRaw || "—";
        const krw = Number(live?.fx_rates?.KRW || 0);
        const lastAt = String(live?.last_at || live?.worker_last_success_at || "").trim();

        if (fxLiveProvider) fxLiveProvider.textContent = provLabel;
        if (fxLiveRate) {
          fxLiveRate.textContent = krw > 0
            ? `${krw.toLocaleString("en-US", { maximumFractionDigits: 2 })} KRW`
            : "—";
        }
        if (fxLiveLastAt) {
          fxLiveLastAt.textContent = lastAt
            ? lastAt.slice(0, 19).replace("T", " ")
            : "—";
        }
        if (fxLiveError) {
          const err = String(live?.worker_last_error || "").trim();
          if (err) {
            fxLiveError.style.display = "";
            fxLiveError.textContent = `워커 에러: ${err}`;
          } else {
            fxLiveError.style.display = "none";
            fxLiveError.textContent = "";
          }
        }
        // Populate the provider chain editor with the saved chain (or the
        //   single fallback provider for legacy installs that only set
        //   fx_worker_provider).
        if (fxProviderChain && !fxProviderChain.dataset.touched) {
          const chain = Array.isArray(live?.provider_chain) ? live.provider_chain : null;
          const fallback = String(live?.provider || "").trim();
          fxProviderChain.value = chain && chain.length
            ? chain.join(", ")
            : (fallback || "coingecko, exchangerate-api, frankfurter");
        }
      } catch (e) {
        if (fxLiveProvider) fxLiveProvider.textContent = "—";
        if (fxLiveRate) fxLiveRate.textContent = "—";
        if (fxLiveLastAt) fxLiveLastAt.textContent = "—";
        if (fxLiveError) {
          fxLiveError.style.display = "";
          fxLiveError.textContent = `Live 환율 로드 실패: ${e?.message || e}`;
        }
      }
    };

    const saveFxProviderChain = async () => {
      if (!fxProviderChain) return;
      const raw = String(fxProviderChain.value || "").trim();
      // Tokenize: comma-separated, trimmed, lowercased, dedupe.
      const seen = new Set();
      const chain = raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => {
        if (!s) return false;
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      });
      if (!chain.length) {
        return toast("Provider 체인은 최소 1개 이상 입력하세요.", "bad");
      }
      try {
        await api("/api/admin/settings/fx-providers", {
          method: "POST",
          body: { chain },
        });
        toast("Provider 체인 저장 완료. 워커가 다음 실행부터 적용합니다.", "good");
        fxProviderChain.dataset.touched = "";
        await loadFxLive();
      } catch (e) {
        toast(`저장 실패: ${e?.message || e}`, "bad");
      }
    };

    const loadFx = async () => {
      let m = null;

      try {
        const r = await api("/api/admin/settings/fx", { method: "GET" });
        m = r?.fx_rates || null;
      } catch {
        m = null;
      }

      if (!m) {
        const cfg = await api("/api/public/config").catch(() => null);
        m = cfg?.fx_rates || null;
      }

      setFxInputs(m || {});
      renderFxNow(m || {});

      // (2026-05-08) Always refresh the live summary alongside the
      //   manual values so the operator sees both at once.
      loadFxLive().catch(() => {});

      const cfg2 = await api("/api/public/config").catch(() => null);
      const dep = String(cfg2?.deposit_admin_usdt_address || "").trim();

      if (depNow) depNow.textContent = dep ? dep : "-";
      if (depInput && !depInput.value) depInput.value = dep ? dep : "";
    };

    const saveFx = async () => {
      const read = (el) => {
        const n = toNum(el?.value, 0);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      };

      const fx_rates = {
        KRW: read(fxKRW),
        USD: read(fxUSD),
        KZT: read(fxKZT),
        PHP: read(fxPHP),
        GEL: read(fxGEL),
        IDR: read(fxIDR),
        VND: read(fxVND),
      };

      if (!(fx_rates.KRW > 0)) {
        return toast("KRW 환율(1 USDT = ? KRW)은 필수입니다.", "bad");
      }

      await api("/api/admin/settings/fx", {
        method: "POST",
        body: { fx_rates }
      });

      toast("환율 저장 완료", "good");
      await loadFx();
    };

    const loadStakingGlobal = async () => {
      const r = await api("/api/admin/settings/staking", { method: "GET" }).catch(() => null);
      const payday = r?.payday ?? 15;
      const lock = Array.isArray(r?.lock_days) ? r.lock_days.join(",") : "14,15";

      if (stkPayday) stkPayday.textContent = `${payday}일`;
      if (stkLockDays) stkLockDays.textContent = lock;
    };

    const loadDeposit = async () => {
      const r = await api("/api/admin/settings/deposit", { method: "GET" }).catch(() => null);
      const dep = String(r?.deposit_admin_usdt_address || "").trim();

      if (depInput) depInput.value = dep;
      if (depNow) depNow.textContent = dep ? dep : "-";
    };

    const saveDeposit = async () => {
      if (!depInput) return;

      const addr = String(depInput.value || "").trim();

      await api("/api/admin/settings/deposit", {
        method: "POST",
        body: { deposit_admin_usdt_address: addr }
      });

      toast("입금 지갑주소 저장 완료", "good");
      await loadFx();
      await loadDeposit();
    };

    const loadWithdrawWallet = async () => {
      const r = await api("/api/admin/settings/withdraw-wallet", { method: "GET" }).catch(() => null);
      const addr = String(r?.withdraw_admin_usdt_address || "").trim();

      if (wdWalletInput) wdWalletInput.value = addr;
      if (wdWalletNow) wdWalletNow.textContent = addr ? addr : "-";
    };


    // (2026-05-05) "percent" 모드 단계적 제거 — 모든 출금에 USDT 고정 수수료 단일 정책.
    // DB 에 mode='percent' 로 남아있어도 로드 시점에 'fixed_usdt' 로 보정한다.
    const syncWithdrawFeeModeUi = () => {
      // fixed_usdt 단일 모드라 fixed wrap 은 항상 표시.
      if (withdrawFeeFixedWrap) withdrawFeeFixedWrap.style.display = "";
      if (withdrawFeePercentWrap) withdrawFeePercentWrap.style.display = "none";
    };

    const renderWithdrawFeeNow = (_mode, fixedFee, _percentFee) => {
      if (!withdrawFeeNow) return;
      withdrawFeeNow.textContent = `${fixedFee} USDT`;
    };

    const loadWithdrawFee = async () => {
      const r = await api("/api/admin/settings/withdraw-fee", { method: "GET" }).catch(() => null);
      // 정책 단순화: 어떤 값이 저장되어 있어도 항상 fixed_usdt 로 표시·취급.
      const mode = "fixed_usdt";
      const fixedFee = Number(r?.withdraw_fee_usdt || 0);
      const percentFee = Number(r?.withdraw_fee_percent || 0);
      if (withdrawFeeMode) withdrawFeeMode.value = mode;
      if (withdrawFeeInput) withdrawFeeInput.value = String(fixedFee);
      if (withdrawFeePercentInput) withdrawFeePercentInput.value = String(percentFee);
      syncWithdrawFeeModeUi();
      renderWithdrawFeeNow(mode, fixedFee, percentFee);
    };

    // 음수 입력 차단: 타이핑/붙여넣기 시 즉시 0 이상으로 클램프
    const clampNonNegative = (inputEl, maxVal) => {
      if (!inputEl || inputEl.dataset.clampBound === "1") return;
      inputEl.dataset.clampBound = "1";
      const handler = () => {
        const v = Number(inputEl.value);
        if (!Number.isFinite(v) || v < 0) {
          inputEl.value = "0";
        } else if (typeof maxVal === "number" && v > maxVal) {
          inputEl.value = String(maxVal);
        }
      };
      inputEl.addEventListener("input", handler);
      inputEl.addEventListener("blur", handler);
      inputEl.addEventListener("paste", () => setTimeout(handler, 0));
      // '-' 키 자체를 차단 (숫자 입력 UX 강화)
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "-" || e.key === "Subtract") e.preventDefault();
      });
    };
    clampNonNegative(withdrawFeeInput, 10000);
    // (2026-05-05) 퍼센트 입력 제거 — clampNonNegative 호출도 함께 제거. helper 의 null 가드로 인해 무해하나 정리.

    const saveWithdrawFee = async () => {
      // 정책 단순화 (2026-05-05): mode 항상 fixed_usdt, percent 값은 0 으로 강제 저장.
      const fixedFee = Number(withdrawFeeInput?.value || 0);
      if (!Number.isFinite(fixedFee) || fixedFee < 0) return toast("고정 출금 수수료는 0 이상이어야 합니다.", "bad");
      if (fixedFee > 10000) return toast("고정 출금 수수료는 10,000 USDT 이하로 설정해야 합니다.", "bad");
      await api("/api/admin/settings/withdraw-fee", {
        method: "POST",
        body: {
          withdraw_fee_mode: "fixed_usdt",
          withdraw_fee_usdt: fixedFee,
          withdraw_fee_percent: 0,
        }
      });
      toast("출금 수수료 저장 완료", "good");
      await loadWithdrawFee();
    };

    // (2026-05-07) Swap 수수료 (%) — 음수/비정상값 다중 가드.
    const swapFeeInput = qs("#swapFeePctInput");
    const swapFeeNow   = qs("#swapFeeNow");
    const swapFeeBtn   = qs("#swapFeeSaveBtn");

    const loadSwapFee = async () => {
      const r = await api("/api/admin/settings/swap-fee", { method: "GET" }).catch(() => null);
      const pct = Number(r?.swap_fee_pct || 0);
      const safe = Number.isFinite(pct) && pct >= 0 && pct <= 10 ? pct : 0;
      if (swapFeeInput) swapFeeInput.value = String(safe);
      if (swapFeeNow)   swapFeeNow.textContent = safe > 0 ? `${safe}%` : "0% (무료)";
    };

    // 1차 차단 — 타이핑 / 붙여넣기 / minus 키 차단 + 0..10 clamp.
    clampNonNegative(swapFeeInput, 10);

    const saveSwapFee = async () => {
      if (!swapFeeInput) return;
      const raw = swapFeeInput.value;
      // 2차 검증 — Number 변환 + 유한성 + 범위.
      const pct = Number(raw);
      if (!Number.isFinite(pct))  return toast("스왑 수수료는 숫자여야 합니다.", "bad");
      if (pct < 0)                return toast("스왑 수수료는 0 이상이어야 합니다.", "bad");
      if (pct > 10)               return toast("스왑 수수료는 10% 이하로 설정해야 합니다.", "bad");

      try {
        await api("/api/admin/settings/swap-fee", {
          method: "POST",
          body: { swap_fee_pct: pct },
        });
        toast("스왑 수수료 저장 완료", "good");
        await loadSwapFee();
      } catch (e) {
        toast(`저장 실패: ${e?.message || e}`, "bad");
      }
    };

    swapFeeBtn?.addEventListener("click", saveSwapFee);

    // (2026-05-11) 거래 수수료 통합 입력 — 한 개 % 값으로 fee_buyer +
    //   fee_seller 양쪽을 동일하게 세팅. Operator: '매수와 매도 수수료
    //   를 통합 해줘'. 매수와 매도를 따로 두려면 admin/assets.html 에서
    //   직접 편집.
    const TRADE_FEE_ASSET_ID = "SILICA-79907";
    const tradeFeeInput = qs("#tradeFeeInput");
    const tradeFeeNow   = qs("#tradeFeeNow");
    const tradeFeeBtn   = qs("#tradeFeeSaveBtn");

    clampNonNegative(tradeFeeInput, 10);

    const loadTradeFee = async () => {
      try {
        const r = await api(`/api/assets/${encodeURIComponent(TRADE_FEE_ASSET_ID)}`,
          { method: "GET" });
        const asset = r?.asset || r || {};
        const fb = Number(asset.fee_buyer ?? 0);
        const fs = Number(asset.fee_seller ?? 0);
        // 통합 화면이라 표시값은 fee_buyer 기준. fee_seller 가 다르면
        //   안내 텍스트로 비대칭 상태를 노출.
        const safe = Number.isFinite(fb) && fb >= 0 && fb <= 10 ? fb : 0;
        if (tradeFeeInput) tradeFeeInput.value = String(safe);
        if (tradeFeeNow) {
          if (Number.isFinite(fs) && Math.abs(fs - fb) > 0.0001) {
            tradeFeeNow.textContent =
              `${safe}% (매수 ${fb}% · 매도 ${fs}% — 자산 관리에서 분리 설정됨)`;
          } else {
            tradeFeeNow.textContent = safe > 0 ? `${safe}%` : "0% (무료)";
          }
        }
      } catch (e) {
        if (tradeFeeNow) tradeFeeNow.textContent = `불러오기 실패: ${e?.message || e}`;
      }
    };

    const saveTradeFee = async () => {
      if (!tradeFeeInput) return;
      const v = Number(tradeFeeInput.value);
      if (!Number.isFinite(v) || v < 0 || v > 10) return toast("거래 수수료는 0~10% 사이여야 합니다.", "bad");
      try {
        await api("/api/admin/assets/upsert", {
          method: "POST",
          body: { asset: { id: TRADE_FEE_ASSET_ID, fee_buyer: v, fee_seller: v } },
        });
        toast("거래 수수료 저장 완료", "good");
        await loadTradeFee();
      } catch (e) {
        toast(`저장 실패: ${e?.message || e}`, "bad");
      }
    };

    tradeFeeBtn?.addEventListener("click", saveTradeFee);

    const saveWithdrawWallet = async () => {
      if (!wdWalletInput) return;

      const addr = String(wdWalletInput.value || "").trim();

      await api("/api/admin/settings/withdraw-wallet", {
        method: "POST",
        body: { withdraw_admin_usdt_address: addr }
      });

      toast("출금 지갑주소 저장 완료", "good");
      await loadWithdrawWallet();
    };

    fxRefreshBtn?.addEventListener("click", async () => {
      // (2026-05-11) Actually trigger a provider HTTP fetch — operator:
      //   '환율 새로고침이 작동하지 않는다.' Old behaviour was only
      //   re-reading the DB. Now: call /api/admin/fx/refresh-now first
      //   (runs the cron's provider chain), then reload the UI.
      fxRefreshBtn.disabled = true;
      const origLabel = fxRefreshBtn.textContent;
      fxRefreshBtn.textContent = "↻ 갱신중…";
      try {
        const r = await api("/api/admin/fx/refresh-now", { method: "POST" });
        if (r?.ok) {
          const first = r.results && r.results[0];
          if (first?.rate > 0) {
            toast(`✓ ${first.ccy} ${first.rate} via ${first.provider}`, "good");
          } else {
            toast("새로고침 완료 (결과 없음)", "good");
          }
        } else {
          const msg = (r?.errors && r.errors.join(" | ")) || "모든 provider 실패";
          toast(`갱신 실패: ${msg}`, "bad");
        }
        await loadFx();
      } catch (e) {
        toast(e.message || "실패", "bad");
        try { await loadFx(); } catch (_) {}
      } finally {
        fxRefreshBtn.disabled = false;
        fxRefreshBtn.textContent = origLabel;
      }
    });

    fxSaveBtn?.addEventListener("click", async () => {
      try {
        await saveFx();
      } catch (e) {
        toast(e.message || "저장 실패", "bad");
      }
    });

    // Track typing in the provider chain so loadFxLive() doesn't overwrite
    // the operator's in-progress edit on the next refresh.
    fxProviderChain?.addEventListener("input", () => {
      fxProviderChain.dataset.touched = "1";
    });
    fxProviderSaveBtn?.addEventListener("click", saveFxProviderChain);

    depRefreshBtn?.addEventListener("click", async () => {
      try {
        await loadDeposit();
        toast("불러오기 완료", "good");
      } catch (e) {
        toast(e.message || "실패", "bad");
      }
    });

    depSaveBtn?.addEventListener("click", async () => {
      try {
        await saveDeposit();
      } catch (e) {
        toast(e.message || "저장 실패", "bad");
      }
    });

    wdWalletRefreshBtn?.addEventListener("click", async () => {
      try {
        await loadWithdrawWallet();
        toast("불러오기 완료", "good");
      } catch (e) {
        toast(e.message || "실패", "bad");
      }
    });

    wdWalletSaveBtn?.addEventListener("click", async () => {
      try {
        await saveWithdrawWallet();
      } catch (e) {
        toast(e.message || "저장 실패", "bad");
      }
    });

    wdFeeSaveBtn?.addEventListener("click", async () => {
      try { await saveWithdrawFee(); } catch (e) { toast(e.message || "저장 실패", "bad"); }
    });
    withdrawFeeMode?.addEventListener("change", syncWithdrawFeeModeUi);

    // ====== Referral Bonus Rate ======
    const settingsRefRate = qs("#settingsRefBonusRate");
    const settingsRefRateNow = qs("#settingsRefRateNow");
    const refRateRefreshBtn = qs("#refRateRefreshBtn");
    const refRateSaveBtn = qs("#refRateSaveBtn");

    const loadRefRate = async () => {
      const r = await api("/api/admin/settings/referral", { method: "GET" }).catch(() => null);
      const pct = r?.referral_bonus_pct ?? 1;
      if (settingsRefRate) settingsRefRate.value = pct;
      if (settingsRefRateNow) settingsRefRateNow.textContent = `${pct}%`;
    };

    const saveRefRate = async () => {
      // (2026-05-16 v420) 운영자: 1% 미만 값도 입력 가능 (최소 0.01%).
      // 백엔드 검증과 동일 범위 [0.01, 50].
      const pct = parseFloat(settingsRefRate?.value);
      if (!Number.isFinite(pct) || pct < 0.01 || pct > 50) {
        return toast("보상률은 0.01~50% 사이여야 합니다.", "bad");
      }
      await api("/api/admin/settings/referral", {
        method: "POST",
        body: { referral_bonus_pct: pct },
      });
      toast(`추천인 보상률이 ${pct}%로 저장되었습니다.`, "good");
      await loadRefRate();
    };

    refRateRefreshBtn?.addEventListener("click", async () => {
      try { await loadRefRate(); toast("불러오기 완료", "good"); }
      catch (e) { toast(e.message || "실패", "bad"); }
    });

    refRateSaveBtn?.addEventListener("click", async () => {
      try { await saveRefRate(); }
      catch (e) { toast(e.message || "저장 실패", "bad"); }
    });

    // ====== Security: KYC Toggle ======
    // (2026-05-19 v587) OTP 토글 제거 — 운영자 결정: 관리자 로그인에서 OTP
    //   완전 미사용 (지갑 화이트리스트가 2-factor). bypass_otp 필드는 서버
    //   응답에 여전히 포함되지만 UI 에서는 더 이상 노출/저장하지 않음.
    const secBypassKyc = qs("#secBypassKyc");
    const secNow = qs("#secNow");
    const secRefreshBtn = qs("#secRefreshBtn");
    const secSaveBtn = qs("#secSaveBtn");

    const renderSecNow = (d) => {
      if (!secNow) return;
      // (2026-05-21 v728) 운영자 요청 — '(테스트모드)' 텍스트 제거.
      const kycStatus = d?.bypass_kyc ? '<span style="color:#dc2626;font-weight:bold">비활성화</span>' : '<span style="color:#16a34a;font-weight:bold">활성화</span>';
      secNow.innerHTML = `KYC: ${kycStatus}`;
    };

    const loadSecurity = async () => {
      const r = await api("/api/admin/settings/security", { method: "GET" }).catch(() => null);
      if (!r) return;
      if (secBypassKyc) secBypassKyc.value = r.bypass_kyc ? "1" : "0";
      renderSecNow(r);
    };

    const saveSecurity = async () => {
      // bypass_otp 는 보존 (서버 측 상태 그대로 유지) — UI 에서 변경 못 함.
      const body = {
        bypass_kyc: secBypassKyc?.value === "1",
      };

      await api("/api/admin/settings/security", { method: "POST", body });
      toast("보안 설정 저장 완료", "good");
      await loadSecurity();
    };

    secRefreshBtn?.addEventListener("click", async () => {
      try { await loadSecurity(); toast("불러오기 완료", "good"); }
      catch (e) { toast(e.message || "실패", "bad"); }
    });

    secSaveBtn?.addEventListener("click", async () => {
      try { await saveSecurity(); }
      catch (e) { toast(e.message || "저장 실패", "bad"); }
    });

    // ====== Solana Network / USDT Token ======
    const solNetwork = qs("#solNetwork");
    // (v863) RPC URL 입력 필드는 UI 에서 제거됨. 응급 override 가 필요한
    //   경우에는 API 를 직접 호출. 아래 변수는 legacy 호환을 위해 null fallback
    //   가능하도록 남겨둠 (saveSolana 의 trim() 가드 함께).
    const solRpcUrl = qs("#solRpcUrl");
    const solUsdtMint = qs("#solUsdtMint");
    const solUsdtDecimals = qs("#solUsdtDecimals");
    // (v864) solNow 박스 제거 — API key 포함 URL 노출 보안 위험으로 폐기.
    const solRefreshBtn = qs("#solRefreshBtn");
    const solSaveBtn = qs("#solSaveBtn");

    // (v863) RPC 연결 상태 카드 (활성화 / 오류 / 재검사 버튼)
    const solHealthBadge = qs("#solHealthBadge");
    const solHealthDetail = qs("#solHealthDetail");
    const solHealthRecheckBtn = qs("#solHealthRecheckBtn");

    // (v863) Legacy DB override 경고 + 해제 버튼 (이전 버전 잔존 값 처리)
    const solLegacyOverrideWarn = qs("#solLegacyOverrideWarn");
    const solLegacyOverrideUrl = qs("#solLegacyOverrideUrl");
    const solClearLegacyOverrideBtn = qs("#solClearLegacyOverrideBtn");

    const resetTestDataBtn = qs("#resetTestDataBtn");
    const resetTestDataInfo = qs("#resetTestDataInfo");

    // (v864) renderSolNow / RPC_SOURCE_LABEL 제거됨 — "현재 적용 중인 RPC"
    //   박스는 API key 포함 URL 노출 위험으로 v864 에서 삭제. RPC 적용 여부는
    //   "RPC 연결 상태" 카드(🟢/🔴) 만으로 충분.
    //   maskRpcUrl 도 제거 — backend 가 이미 host 만 반환하므로 frontend
    //   마스킹 불필요.

    // (v863) RPC 연결 상태 표시 — 활성화 / 오류 / 검사 중.
    const renderRpcHealth = (h) => {
      if (!solHealthBadge || !solHealthDetail) return;
      if (!h) {
        solHealthBadge.textContent = "⏳ 검사 중…";
        solHealthBadge.style.color = "#475569";
        solHealthDetail.textContent = "-";
        return;
      }
      if (h.status === "ok") {
        solHealthBadge.textContent = "🟢 활성화 (API 연결됨)";
        solHealthBadge.style.color = "#047857";
        solHealthDetail.textContent = "";
      } else {
        solHealthBadge.textContent = "🔴 연결 오류";
        solHealthBadge.style.color = "#b91c1c";
        solHealthDetail.textContent = h.message || "RPC 호출 실패";
      }
    };

    const setRpcHealthLoading = () => {
      if (!solHealthBadge || !solHealthDetail) return;
      solHealthBadge.textContent = "⏳ 검사 중…";
      solHealthBadge.style.color = "#475569";
      solHealthDetail.textContent = "Solana getHealth RPC 호출 중...";
    };

    const recheckRpcHealth = async () => {
      setRpcHealthLoading();
      try {
        const r = await api("/api/admin/settings/solana/health", { method: "GET" });
        renderRpcHealth(r?.rpc_health);
      } catch (e) {
        renderRpcHealth({ status: "error", message: e?.message || "재검사 실패" });
      }
    };

    const loadSolana = async () => {
      const r = await api("/api/admin/settings/solana", { method: "GET" }).catch(() => null);
      if (!r) return;
      if (solNetwork) solNetwork.value = r.network || "devnet";
      // (v864) solRpcUrl 은 UI 에서 제거됨. backend 는 host 만 반환 (full URL 미노출).
      if (solRpcUrl) solRpcUrl.value = ""; // 보안: hidden input 에도 키 채우지 않음
      if (solUsdtMint) solUsdtMint.value = r.usdt_mint || "";
      if (solUsdtDecimals) solUsdtDecimals.value = r.usdt_decimals ?? 6;
      // (v864) renderSolNow 제거 — API key 노출 박스 폐기.
      renderRpcHealth(r.rpc_health || null);

      // (v863) Legacy override 경고 — DB 에 rpc_url 값이 남아 있으면 표시.
      //   v862 이전 admin 패널 입력값이 그대로 남아있으면 silica.env 의
      //   네트워크별 키가 무시되므로, 운영자에게 알려서 한 번에 해제 가능.
      //   (v864) backend 가 host 만 반환 + rpc_url_present boolean 동봉.
      if (solLegacyOverrideWarn) {
        if (r.rpc_url_present === true) {
          // r.rpc_url 은 backend 에서 이미 host 로 마스킹된 값.
          if (solLegacyOverrideUrl) solLegacyOverrideUrl.textContent = r.rpc_url || "(unknown host)";
          solLegacyOverrideWarn.hidden = false;
        } else {
          solLegacyOverrideWarn.hidden = true;
        }
      }
    };

    const saveSolana = async () => {
      const body = {
        network: solNetwork?.value || "devnet",
        // (v863) rpc_url 은 UI 에서 제거됨 — 기존에 저장된 값이 있어도
        //   설정 저장 시 함께 전송하지 않음. 응급 override 가 필요하면
        //   API 직접 호출로만 진행.
        usdt_mint: (solUsdtMint?.value || "").trim(),
        usdt_decimals: parseInt(solUsdtDecimals?.value) || 6,
      };

      if (body.usdt_mint && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.usdt_mint)) {
        return toast("Mint 주소가 올바르지 않습니다. (Base58 32~44자)", "bad");
      }

      await api("/api/admin/settings/solana", { method: "POST", body });
      toast("Solana 설정 저장 완료", "good");
      await loadSolana();
      // 네트워크가 바뀌었으면 RPC 도 달라지므로 health 즉시 재검사.
      await recheckRpcHealth();
    };

    solRefreshBtn?.addEventListener("click", async () => {
      try { await loadSolana(); toast("불러오기 완료", "good"); }
      catch (e) { toast(e.message || "실패", "bad"); }
    });

    solSaveBtn?.addEventListener("click", async () => {
      try { await saveSolana(); }
      catch (e) { toast(e.message || "저장 실패", "bad"); }
    });

    // (v863) 연결 재검사 버튼 — 운영자가 실시간 상태 확인.
    solHealthRecheckBtn?.addEventListener("click", async () => {
      try { await recheckRpcHealth(); }
      catch (e) { toast(e.message || "재검사 실패", "bad"); }
    });

    // 이전 설정값 해제 — 한 번 클릭으로 빈 값 저장.
    solClearLegacyOverrideBtn?.addEventListener("click", async () => {
      const ok = window.confirm(
        "이전 설정값을 해제하면 선택한 네트워크가 정상 적용됩니다. 계속하시겠습니까?"
      );
      if (!ok) return;
      try {
        await api("/api/admin/settings/solana", {
          method: "POST",
          body: { rpc_url: "" },
        });
        toast("해제 완료", "good");
        await loadSolana();
        await recheckRpcHealth();
      } catch (e) {
        toast(e?.message || "해제 실패", "bad");
      }
    });

    const renderResetSummary = (r) => {
      if (!resetTestDataInfo) return;
      const users = Number(r?.deleted_counts?.users || 0);
      const assets = Number(r?.deleted_counts?.assets || 0);
      const contracts = Number(r?.deleted_counts?.investment_contracts || 0);
      const walletTx = Number(r?.deleted_counts?.wallet_transactions || 0);
      const uploads = Number(r?.uploads_deleted || 0);
      resetTestDataInfo.textContent = `삭제 완료 · 유저 ${users}명 · 자산 ${assets}건 · 계약 ${contracts}건 · 지갑내역 ${walletTx}건 · 업로드파일 ${uploads}개`;
    };

    resetTestDataBtn?.addEventListener("click", async () => {
      const ok = window.confirm("관리자 계정, 환경설정, 계약서 템플릿, Devnet/USDT 설정값은 유지하고 나머지 테스트 데이터를 모두 삭제합니다. 계속하시겠습니까?");
      if (!ok) return;

      const prev = resetTestDataBtn.disabled;
      const oldText = resetTestDataBtn.textContent;
      resetTestDataBtn.disabled = true;
      resetTestDataBtn.textContent = "초기화 중...";
      if (resetTestDataInfo) resetTestDataInfo.textContent = "DB와 업로드 파일을 초기화하는 중입니다...";

      try {
        const r = await api("/api/admin/settings/reset-test-data", {
          method: "POST",
          body: { confirm: true },
        });
        renderResetSummary(r);
        toast("테스트 데이터 초기화 완료", "good");
      } catch (e) {
        if (resetTestDataInfo) resetTestDataInfo.textContent = e.message || "초기화 실패";
        toast(e.message || "초기화 실패", "bad");
      } finally {
        resetTestDataBtn.disabled = prev;
        resetTestDataBtn.textContent = oldText;
      }
    });

    // ====== Auto-Buy Liquidity Management (구 AMM) ======
    const ammEnabled = qs("#ammEnabled");
    const ammThresholdInput = qs("#ammThresholdInput");
    const ammThresholdSaveBtn = qs("#ammThresholdSaveBtn");
    const ammStatusNow = qs("#ammStatusNow");
    const ammBalanceNow = qs("#ammBalanceNow");
    const ammUpdatedAt = qs("#ammUpdatedAt");
    const ammTokensNow = qs("#ammTokensNow");
    const ammTopupAmount = qs("#ammTopupAmount");
    const ammRefreshBtn = qs("#ammRefreshBtn");
    const ammToggleSaveBtn = qs("#ammToggleSaveBtn");
    const ammTopupAddBtn = qs("#ammTopupAddBtn");
    const ammTopupSubBtn = qs("#ammTopupSubBtn");

    clampNonNegative(ammTopupAmount, 100000000);

    const fmtUsdt = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return "0 USDT";
      return `${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 6 })} USDT`;
    };

    const renderAmm = (d) => {
      if (!d) return;
      const enabled = !!d.amm_enabled;
      const thr = Number(d.amm_threshold || 0.8);
      if (ammEnabled) ammEnabled.value = enabled ? "1" : "0";
      if (ammThresholdInput) ammThresholdInput.value = thr.toFixed(2);
      if (ammStatusNow) {
        ammStatusNow.innerHTML = enabled
          ? `<span style="color:#16a34a;font-weight:950">● 활성화</span> — ${thr.toFixed(2)} USDT 이하 저가 매도 시 자동 매수`
          : '<span style="color:#dc2626;font-weight:950">● 비활성화</span> — 오더북만 사용 (바닥가 보호 없음)';
      }

      const bal = Number(d.usdt_balance || 0);
      if (ammBalanceNow) {
        ammBalanceNow.textContent = fmtUsdt(bal);
        ammBalanceNow.style.color = bal <= 0 ? "#dc2626" : (bal < 1000 ? "#d97706" : "#16a34a");
      }
      if (ammUpdatedAt) ammUpdatedAt.textContent = d.updated_at ? `최종 업데이트: ${d.updated_at}` : "-";

      const tokens = Array.isArray(d.accumulated_tokens) ? d.accumulated_tokens : [];
      if (ammTokensNow) {
        if (!tokens.length) {
          ammTokensNow.innerHTML = '<span class="muted">축적 토큰 없음</span>';
        } else {
          ammTokensNow.innerHTML = tokens.map((t) => {
            const name = String(t.name || `#${t.asset_id}`).replace(/</g, "&lt;");
            const market = String(t.market || "").replace(/</g, "&lt;");
            const held = Number(t.balance_token || 0);
            const escrow = Number(t.escrow_token || 0);
            const total = Number(t.total_token || (held + escrow));
            const breakdown = (escrow > 0)
              ? ` <span class="muted" style="font-size:11px">(보유 ${fmtNum(held, 6)} + 오픈주문 ${fmtNum(escrow, 6)})</span>`
              : "";
            return `<div>- ${name}${market ? ` <span class="muted">(${market})</span>` : ""}: <strong>${fmtNum(total, 6)}</strong> 토큰${breakdown}</div>`;
          }).join("");
        }
      }
    };

    const loadAmm = async () => {
      const r = await api("/api/admin/settings/amm", { method: "GET" }).catch(() => null);
      const data = r || { amm_enabled: true, usdt_balance: 0, accumulated_tokens: [], open_orders: [], silica_balances: {} };
      renderAmm(data);
      // 시스템 토큰 판매 영역(SilicaSTO/Silica 잔액, 오픈 주문 목록) 갱신
      if (typeof renderAmmSellAssetOptions === "function") renderAmmSellAssetOptions(data.accumulated_tokens || [], data);
      if (typeof renderAmmOpenOrders === "function") renderAmmOpenOrders(data.open_orders || []);
    };

    const saveAmmEnabled = async () => {
      const enabled = String(ammEnabled?.value || "1") === "1";
      const thr = Number(ammThresholdInput?.value || 0.8);
      const confirmMsg = enabled
        ? `자동 매수를 활성화합니다. ${thr.toFixed(2)} USDT 이하 저가 매도를 시스템이 자동 매수합니다.`
        : "자동 매수를 비활성화합니다. 모든 매도가 오더북으로 등록되며, 바닥가 자동 매수가 중단됩니다.\n\n계속하시겠습니까?";
      if (!window.confirm(confirmMsg)) return;

      await api("/api/admin/settings/amm/enabled", {
        method: "POST",
        body: { enabled },
      });
      toast(enabled ? "AMM 활성화 저장 완료" : "AMM 비활성화 저장 완료", "good");
      await loadAmm();
      await loadAmmAudit();
    };

    const adjustAmm = async (sign) => {
      const raw = Number(ammTopupAmount?.value || 0);
      if (!Number.isFinite(raw) || raw <= 0) {
        return toast("0보다 큰 금액을 입력하세요.", "bad");
      }
      if (raw > 100000000) {
        return toast("한 번에 조정 가능한 금액은 1억 USDT 이하입니다.", "bad");
      }
      const action = sign > 0 ? "충전" : "회수";
      const apiAction = sign > 0 ? "add" : "subtract";
      if (!window.confirm(`AMM 유동성을 ${raw.toLocaleString()} USDT ${action}하시겠습니까?\n(장부 기록만 변경, 온체인 전송 없음)`)) return;

      // 신규 action/amount 스키마 — 서버에서 음수 값을 원천 차단함
      const r = await api("/api/admin/settings/amm/topup", {
        method: "POST",
        body: { action: apiAction, amount: raw },
      });
      toast(`${action} 완료 · ${fmtUsdt(r?.before || 0)} → ${fmtUsdt(r?.after || 0)}`, "good");
      if (ammTopupAmount) ammTopupAmount.value = "";
      await loadAmm();
      await loadAmmAudit();
    };

    ammRefreshBtn?.addEventListener("click", async () => {
      try { await loadAmm(); toast("불러오기 완료", "good"); }
      catch (e) { toast(e.message || "실패", "bad"); }
    });

    // (2026-05-11) AMM 미체결 매도 일괄 처리 — 기존 호가창에 OPEN 으로
    //   잠긴 저가 매도 주문을 일괄 AMM 풀로 매수. Operator: '자동
    //   매수가 되지 않고 있다.'
    const ammSweepBtn = qs("#ammSweepBtn");
    ammSweepBtn?.addEventListener("click", async () => {
      if (!confirm("임계값 이하 모든 OPEN 매도 주문을 AMM 풀로 매수 처리하시겠습니까?")) return;
      ammSweepBtn.disabled = true;
      const orig = ammSweepBtn.textContent;
      ammSweepBtn.textContent = "처리중…";
      try {
        const r = await api("/api/admin/settings/amm/sweep", { method: "POST" });
        const filledTotal = (r.filled_full ?? 0) + (r.filled_partial ?? 0);
        // (2026-05-20 v662) 토스트 메시지 명확화 — "체결 성공 N건" 메인
        //   + 세부 카운트를 보조 정보로. 운영자 'AMM 매수가 안된다' 등의
        //   상황과 'AMM 매수가 정상 완료됨' 상황을 즉시 구분 가능.
        let toastMsg;
        let toastColor;
        if (r.errors?.length) {
          toastMsg = `⚠ 오류 발생 (스캔 ${r.scanned ?? 0} / 체결 ${filledTotal} / 건너뜀 ${r.skipped ?? 0})`;
          toastColor = "bad";
        } else if (filledTotal > 0) {
          toastMsg = `✅ AMM 매수 ${filledTotal}건 체결 성공 (완전 ${r.filled_full ?? 0} · 부분 ${r.filled_partial ?? 0})`;
          toastColor = "good";
        } else if ((r.scanned ?? 0) === 0) {
          toastMsg = `처리할 매도 주문 없음 (임계값 이하 OPEN 매도 0건)`;
          toastColor = "good";
        } else {
          toastMsg = `⚠ 매칭 안됨 — 스캔 ${r.scanned ?? 0} · 건너뜀 ${r.skipped ?? 0}${r.pool_exhausted ? " · 풀 소진" : ""}`;
          toastColor = "bad";
        }
        toast(toastMsg, toastColor);

        // (2026-05-20 v660) DIAGNOSTIC — 콘솔에 전체 응답 + diag 라인 출력.
        console.log("%c[amm-sweep] 응답 전체", "color:#0065CD;font-weight:bold", r);
        if (Array.isArray(r.diag) && r.diag.length) {
          console.log("%c[amm-sweep] === diag (" + r.diag.length + " 라인) ===",
            "color:#9B29B2;font-weight:bold");
          r.diag.forEach((line, i) => {
            const style = String(line).startsWith("SKIP") || String(line).startsWith("EXCEPTION")
              ? "color:#E70014;font-weight:bold"
              : (String(line).startsWith("COMMIT") || String(line).startsWith("audit_log auditOk=1"))
                ? "color:#2E7D32;font-weight:bold"
                : "color:#333";
            console.log("%c  " + (i + 1) + ". " + line, style);
          });
        }
        if (r.errors?.length) console.warn("[amm-sweep] errors:", r.errors);
        await loadAmm();
        // (v662) 체결이 발생했으면 감사 로그 카드도 자동 새로고침
        //   → 운영자가 별도로 새로고침 안 해도 새 entry 가 즉시 보임.
        if (filledTotal > 0 && typeof loadAmmAuditDays === "function") {
          try { await loadAmmAuditDays(); } catch (e) { console.warn("[amm-sweep] reload audit days failed:", e); }
        }
      } catch (e) {
        toast(e?.message || "AMM 스위프 실패", "bad");
      } finally {
        ammSweepBtn.disabled = false;
        ammSweepBtn.textContent = orig;
      }
    });
    ammToggleSaveBtn?.addEventListener("click", async () => {
      try { await saveAmmEnabled(); }
      catch (e) { toast(e.message || "저장 실패", "bad"); }
    });

    // 자동 매수 임계값 저장 (settings.amm_threshold)
    const saveAmmThreshold = async () => {
      const v = Number(ammThresholdInput?.value || 0);
      if (!Number.isFinite(v) || v <= 0 || v > 1) {
        toast("임계값은 0.01 ~ 1.00 사이여야 합니다.", "bad");
        return;
      }
      await api("/api/admin/settings/amm/threshold", {
        method: "POST",
        body: { threshold: v },
      });
      toast(`임계값 ${v.toFixed(2)} USDT 저장됨`, "good");
      await loadAmm();
    };
    ammThresholdSaveBtn?.addEventListener("click", async () => {
      try { await saveAmmThreshold(); }
      catch (e) { toast(e.message || "저장 실패", "bad"); }
    });

    ammTopupAddBtn?.addEventListener("click", async () => {
      try { await adjustAmm(+1); }
      catch (e) { toast(e.message || "충전 실패", "bad"); }
    });
    ammTopupSubBtn?.addEventListener("click", async () => {
      try { await adjustAmm(-1); }
      catch (e) { toast(e.message || "회수 실패", "bad"); }
    });

    // ====== System Token Sale (Silica 단일 자산 - SilicaSTO / Silica) ======
    const ammSellRefreshBtn = qs("#ammSellRefreshBtn");
    const ammOpenOrders     = qs("#ammOpenOrders");

    // SilicaSTO 입력 요소
    const ammSellStoBalance   = qs("#ammSellStoBalance");
    const ammSellStoAmount    = qs("#ammSellStoAmount");
    const ammSellStoPrice     = qs("#ammSellStoPrice");
    const ammSellStoExpiry    = qs("#ammSellStoExpiry");
    const ammSellStoCreateBtn = qs("#ammSellStoCreateBtn");

    // Silica 입력 요소
    const ammSellSilicaBalance   = qs("#ammSellSilicaBalance");
    const ammSellSilicaAmount    = qs("#ammSellSilicaAmount");
    const ammSellSilicaPrice     = qs("#ammSellSilicaPrice");
    const ammSellSilicaExpiry    = qs("#ammSellSilicaExpiry");
    const ammSellSilicaCreateBtn = qs("#ammSellSilicaCreateBtn");

    clampNonNegative(ammSellStoAmount, 1000000000);
    clampNonNegative(ammSellStoPrice, 1000000);
    clampNonNegative(ammSellSilicaAmount, 1000000000);
    clampNonNegative(ammSellSilicaPrice, 1000000);

    // 마지막 fetch 한 silica_balances + asset_id 캐시 (sell 호출 시 사용)
    let _silicaAssetId = '';

    // AMM 데이터 로드 시 SilicaSTO/Silica 잔액 표시
    const renderAmmSellAssetOptions = (_unused, fullData) => {
      const sb = fullData?.silica_balances || {};
      _silicaAssetId = String(sb.asset_id || '');
      if (ammSellStoBalance) {
        ammSellStoBalance.textContent = fmtNum(Number(sb.silica_sto_balance || 0), 6);
      }
      if (ammSellSilicaBalance) {
        ammSellSilicaBalance.textContent = fmtNum(Number(sb.silica_balance || 0), 6);
      }
    };

    const renderAmmOpenOrders = (orders) => {
      if (!ammOpenOrders) return;
      const list = Array.isArray(orders) ? orders : [];
      if (!list.length) {
        ammOpenOrders.innerHTML = '<div class="muted">현재 등록된 시스템 매도 주문이 없습니다.</div>';
        return;
      }
      const rows = list.map((o) => {
        const name = String(o.asset_name || o.asset_id || "").replace(/</g, "&lt;");
        const tokenType = String(o.token_type || 'legacy');
        const tokenLabel = tokenType === 'silica_sto' ? 'SilicaSTO'
                         : tokenType === 'silica' ? 'Silica'
                         : '토큰';
        const tokenColor = tokenType === 'silica_sto' ? 'var(--aurora-1)'
                         : tokenType === 'silica' ? 'var(--aurora-2)'
                         : '#94A3B8';
        const price = fmtNum(Number(o.price || 0), 6);
        const amt = fmtNum(Number(o.amount || 0), 6);
        const rem = fmtNum(Number(o.remaining || 0), 6);
        const side = (o.side === 'sell') ? '매도' : '매수';
        const expiry = o.expiry_date ? String(o.expiry_date) : '무기한';
        const id = String(o.id || "").replace(/"/g, "&quot;");
        return `<div class="card" style="padding:10px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
            <div>
              <div>
                <strong style="color:${tokenColor}">${tokenLabel}</strong>
                · <span style="color:${o.side==='sell'?'#b91c1c':'#16a34a'};font-weight:900">${side}</span>
              </div>
              <div class="muted" style="font-size:12px;margin-top:4px">주문 ID: <code style="user-select:all">${id}</code></div>
              <div style="margin-top:4px">가격 <strong>${price} USDT</strong> · 총량 ${amt} · <span style="color:#d97706">잔량 ${rem}</span> · 만료 ${expiry}</div>
            </div>
            <button class="btn small" data-amm-cancel="${id}" type="button" style="background:#fff;color:#b91c1c;border-color:#f3b7b7">취소</button>
          </div>
        </div>`;
      });
      ammOpenOrders.innerHTML = rows.join("");

      // 취소 버튼 이벤트 바인딩
      ammOpenOrders.querySelectorAll('[data-amm-cancel]').forEach((btn) => {
        btn.addEventListener("click", async () => {
          const oid = btn.getAttribute("data-amm-cancel");
          if (!oid) return;
          if (!window.confirm(`매도 주문을 취소하시겠습니까?\n\n주문 ID: ${oid}\n\n잔여 토큰은 시스템 보유분으로 환원됩니다.`)) return;
          try {
            await api("/api/admin/settings/amm/cancel-order", {
              method: "POST",
              body: { order_id: oid },
            });
            toast("매도 주문 취소 완료", "good");
            await loadAmm();
            await loadAmmAudit();
          } catch (e) {
            toast(e.message || "취소 실패", "bad");
          }
        });
      });
    };

    // 토큰 종류별 매도 주문 생성 helper
    const createTokenSellOrder = async (tokenType, amountEl, priceEl, expiryEl) => {
      if (!_silicaAssetId) {
        return toast("자산 정보를 불러오는 중입니다. 새로고침을 눌러주세요.", "bad");
      }
      const amount = Number(amountEl?.value || 0);
      const price = Number(priceEl?.value || 0);
      const expiryRaw = String(expiryEl?.value || "").trim();

      if (!Number.isFinite(amount) || amount <= 0) return toast("수량을 입력하세요.", "bad");
      if (!Number.isFinite(price) || price <= 0) return toast("가격을 입력하세요.", "bad");

      const expiryDate = expiryRaw || null;
      const tokenLabel = tokenType === 'silica_sto' ? 'SilicaSTO' : 'Silica';

      // SilicaSTO 는 1 USDT peg 가 권장. 0.8 미만이면 경고.
      const priceWarning = (tokenType === 'silica_sto' && price < 0.95)
        ? "\n\n⚠️ SilicaSTO 권장 가격은 1.0 USDT (peg) 입니다."
        : (price <= 0.8
          ? "\n\n⚠️ 가격 ≤ 0.8 USDT 입니다. AMM 자동 매수가 트리거될 수 있으니 주의하세요."
          : "");

      if (!window.confirm(
        `${tokenLabel} 매도 주문을 생성합니다.\n\n수량: ${amount.toLocaleString()} ${tokenLabel}\n가격: ${price} USDT\n만료: ${expiryDate || '무기한'}${priceWarning}\n\n진행하시겠습니까?`
      )) return;

      const r = await api("/api/admin/settings/amm/sell", {
        method: "POST",
        body: {
          asset_id: _silicaAssetId,
          token_type: tokenType,
          amount,
          price,
          expiry_date: expiryDate,
        },
      });

      toast(`${tokenLabel} 매도 주문 생성 완료 · ${r?.order_id ? '#' + r.order_id : ''}`, "good");
      if (amountEl) amountEl.value = "";
      if (expiryEl) expiryEl.value = "";
      await loadAmm();
      await loadAmmAudit();
    };

    ammSellStoCreateBtn?.addEventListener("click", async () => {
      try { await createTokenSellOrder('silica_sto', ammSellStoAmount, ammSellStoPrice, ammSellStoExpiry); }
      catch (e) { toast(e.message || "SilicaSTO 매도 주문 생성 실패", "bad"); }
    });
    ammSellSilicaCreateBtn?.addEventListener("click", async () => {
      try { await createTokenSellOrder('silica', ammSellSilicaAmount, ammSellSilicaPrice, ammSellSilicaExpiry); }
      catch (e) { toast(e.message || "Silica 매도 주문 생성 실패", "bad"); }
    });
    ammSellRefreshBtn?.addEventListener("click", async () => {
      try { await loadAmm(); await loadAmmAudit(); toast("불러오기 완료", "good"); }
      catch (e) { toast(e.message || "실패", "bad"); }
    });

    // ====== AMM Audit Log ======
    // (2026-05-16 v404) 운영자: '로그가 있는날만 표기, 클릭시 팝업으로
    //   그날 거래 로그 모두 표기 (페이지당 10개), 화살표로 다음 10개.'
    //   기존 단순 list → 날짜 그리드 + 모달 패턴.
    const ammAuditDays         = qs("#ammAuditDays");
    const ammAuditRefreshBtn   = qs("#ammAuditRefreshBtn");
    const ammAuditModal        = qs("#ammAuditModal");
    const ammAuditModalTitle   = qs("#ammAuditModalTitle");
    const ammAuditModalMeta    = qs("#ammAuditModalMeta");
    const ammAuditModalBody    = qs("#ammAuditModalBody");
    const ammAuditModalClose   = qs("#ammAuditModalClose");
    const ammAuditModalPrev    = qs("#ammAuditModalPrev");
    const ammAuditModalNext    = qs("#ammAuditModalNext");
    const ammAuditModalPageInfo= qs("#ammAuditModalPageInfo");
    const AMM_AUDIT_PAGE_SIZE  = 10;
    const ammAuditModalState   = { date: '', offset: 0, total: 0 };

    const ACTION_LABEL = {
      topup:       { label: "충전",      color: "#16a34a" },
      withdraw:    { label: "회수",      color: "#d97706" },
      enable:      { label: "AMM 활성화", color: "#16a34a" },
      disable:     { label: "AMM 비활성화", color: "#dc2626" },
      sell_create: { label: "매도 주문 생성", color: "#2563eb" },
      sell_cancel: { label: "매도 주문 취소", color: "#6b7280" },
      // (2026-05-20 v655) AMM 자동 매수 — 임계값 이하 매도 주문을
      // 시스템이 자동으로 매입. note 필드로 sweep / on_order 구분.
      auto_buy:    { label: "AMM 매수",  color: "#0E7490" },
    };

    // (2026-05-20 v655) auto_buy note → 한국어 라벨 매핑.
    //  - on_order: 유저 주문 발생 시 즉시 인라인 매칭
    //  - sweep   : 관리자 일괄 처리 / 설정 변경 후 자동 sweep
    const AUTO_BUY_NOTE_LABEL = {
      on_order: "주문 발생 시 자동 체결",
      sweep:    "일괄 처리(sweep)",
    };

    const renderAmmAuditLogRow = (r) => {
      const meta = ACTION_LABEL[r.action] || { label: r.action || "-", color: "#374151" };
      // (v655) auto_buy 는 시스템 자동 액션이므로 admin_username 이
      // NULL 일 수 있다. NULL 일 때는 'SYSTEM' 표기로 일관성 유지.
      const adminRaw = r.admin_username || (r.action === 'auto_buy' ? 'SYSTEM' : '-');
      const admin = String(adminRaw).replace(/</g, "&lt;");
      const ip = String(r.ip || "-").replace(/</g, "&lt;");
      const time = String(r.created_at || "-");
      const parts = [];
      if (r.asset_id) parts.push(`자산 <strong>${String(r.asset_id).replace(/</g, "&lt;")}</strong>`);
      if (r.amount !== null && r.amount !== undefined && Number(r.amount) !== 0) {
        // auto_buy 는 토큰 수량으로 표기 (가격 곱으로 USDT 환산은 별도 표시).
        const amtLabel = r.action === 'auto_buy' ? '매수 수량' : '수량/금액';
        parts.push(`${amtLabel} <strong>${fmtNum(Number(r.amount), 6)}</strong>`);
      }
      if (r.price !== null && r.price !== undefined && Number(r.price) !== 0) {
        parts.push(`가격 <strong>${fmtNum(Number(r.price), 6)} USDT</strong>`);
      }
      // (v655) auto_buy 일 때는 풀에서 빠진 USDT(잔고 감소액) 도 표시.
      if (r.action === 'auto_buy' &&
          r.balance_before !== null && r.balance_after !== null &&
          r.balance_before !== undefined && r.balance_after !== undefined) {
        const delta = Number(r.balance_before) - Number(r.balance_after);
        if (delta > 0) parts.push(`풀 지출 <strong>${fmtNum(delta, 6)} USDT</strong>`);
      }
      if (r.balance_before !== null && r.balance_after !== null && r.balance_before !== undefined) {
        parts.push(`잔고 ${fmtNum(Number(r.balance_before), 6)} → <strong>${fmtNum(Number(r.balance_after), 6)}</strong> USDT`);
      }
      if (r.order_id) parts.push(`주문 #${String(r.order_id).replace(/</g, "&lt;")}`);
      // (v655) note 가 auto_buy 소스 구분이면 한국어 라벨로 추가.
      if (r.action === 'auto_buy' && r.note && AUTO_BUY_NOTE_LABEL[r.note]) {
        parts.push(`경로 <strong>${AUTO_BUY_NOTE_LABEL[r.note]}</strong>`);
      } else if (r.note) {
        parts.push(`비고 ${String(r.note).replace(/</g, "&lt;")}`);
      }
      const detail = parts.join(" · ") || "-";
      return `<div style="padding:8px;border-bottom:1px solid #eee;font-size:12px;line-height:1.6">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <span style="color:${meta.color};font-weight:900">[${meta.label}]</span>
          <span class="muted">${time} · ${admin} · ${ip}</span>
        </div>
        <div style="margin-top:2px">${detail}</div>
      </div>`;
    };

    const renderAmmAuditDays = (days) => {
      if (!ammAuditDays) return;
      const list = Array.isArray(days) ? days : [];
      if (!list.length) {
        ammAuditDays.innerHTML = '<div class="muted" style="grid-column: 1/-1; padding: 12px;">최근 60일간 감사 로그 없음</div>';
        return;
      }
      ammAuditDays.innerHTML = list.map((d) => {
        const day = String(d.day || '').replace(/</g, '&lt;');
        const cnt = Number(d.log_count || 0);
        return `<button class="btn small" data-amm-audit-day="${day}" type="button"
                        style="display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:10px 12px; text-align:left;">
          <span style="font-weight:800; font-size:13px;">${day}</span>
          <span class="muted" style="font-size:11px;">${cnt}건</span>
        </button>`;
      }).join('');
      ammAuditDays.querySelectorAll('[data-amm-audit-day]').forEach((btn) => {
        btn.addEventListener('click', () => openAmmAuditModal(btn.getAttribute('data-amm-audit-day')));
      });
    };

    const loadAmmAuditDays = async () => {
      if (!ammAuditDays) return;
      ammAuditDays.innerHTML = '<div class="muted" style="grid-column: 1/-1; padding: 12px;">로딩 중…</div>';
      try {
        const r = await api('/api/admin/settings/amm/audit/days', { method: 'GET' });
        renderAmmAuditDays(r?.days || []);
      } catch (e) {
        ammAuditDays.innerHTML = `<div style="color:#dc2626; grid-column: 1/-1; padding: 12px;">로딩 실패: ${e?.message || e}</div>`;
      }
    };

    const renderAmmAuditModalPage = async () => {
      if (!ammAuditModalBody) return;
      ammAuditModalBody.innerHTML = '<div class="muted">로딩 중…</div>';
      const params = new URLSearchParams();
      params.set('date',   ammAuditModalState.date);
      params.set('offset', String(ammAuditModalState.offset));
      params.set('limit',  String(AMM_AUDIT_PAGE_SIZE));
      try {
        const r = await api('/api/admin/settings/amm/audit?' + params.toString(), { method: 'GET' });
        const logs = Array.isArray(r?.logs) ? r.logs : [];
        const pag  = r?.pagination || {};
        ammAuditModalState.total = Number(pag.total || 0);
        if (!logs.length) {
          ammAuditModalBody.innerHTML = '<div class="muted" style="padding:24px 0; text-align:center;">감사 로그 없음</div>';
        } else {
          ammAuditModalBody.innerHTML = logs.map(renderAmmAuditLogRow).join('');
        }
        const curPage   = Math.floor(ammAuditModalState.offset / AMM_AUDIT_PAGE_SIZE) + 1;
        const totalPage = Math.max(1, Math.ceil(ammAuditModalState.total / AMM_AUDIT_PAGE_SIZE));
        if (ammAuditModalPageInfo) ammAuditModalPageInfo.textContent =
          `${curPage} / ${totalPage} (전체 ${ammAuditModalState.total}건)`;
        if (ammAuditModalPrev) ammAuditModalPrev.disabled = (ammAuditModalState.offset === 0);
        if (ammAuditModalNext) ammAuditModalNext.disabled = !pag.has_more;
      } catch (e) {
        ammAuditModalBody.innerHTML = `<div style="color:#dc2626; padding:24px 0; text-align:center;">로딩 실패: ${e?.message || e}</div>`;
      }
    };

    const openAmmAuditModal = (date) => {
      if (!ammAuditModal) return;
      ammAuditModalState.date   = date;
      ammAuditModalState.offset = 0;
      ammAuditModalState.total  = 0;
      if (ammAuditModalTitle) ammAuditModalTitle.textContent = `AMM 감사 로그 · ${date}`;
      if (ammAuditModalMeta)  ammAuditModalMeta.textContent  = '';
      ammAuditModal.classList.remove('hidden');
      renderAmmAuditModalPage();
    };
    const closeAmmAuditModal = () => ammAuditModal?.classList.add('hidden');

    ammAuditModalClose?.addEventListener('click', closeAmmAuditModal);
    ammAuditModal?.addEventListener('click', (e) => {
      if (e.target === ammAuditModal) closeAmmAuditModal();
    });
    ammAuditModalPrev?.addEventListener('click', () => {
      if (ammAuditModalState.offset === 0) return;
      ammAuditModalState.offset = Math.max(0, ammAuditModalState.offset - AMM_AUDIT_PAGE_SIZE);
      renderAmmAuditModalPage();
    });
    ammAuditModalNext?.addEventListener('click', () => {
      ammAuditModalState.offset = ammAuditModalState.offset + AMM_AUDIT_PAGE_SIZE;
      renderAmmAuditModalPage();
    });

    const loadAmmAudit = loadAmmAuditDays;  // 외부 호출 호환 (loadAmm + loadAmmAudit 패턴)

    ammAuditRefreshBtn?.addEventListener("click", async () => {
      try { await loadAmmAuditDays(); toast("불러오기 완료", "good"); }
      catch (e) { toast(e.message || "실패", "bad"); }
    });

    await loadFx();
    await loadStakingGlobal();
    await loadDeposit();
    await loadWithdrawWallet();
    // 재발 방지: 출금 수수료 설정은 별도 엔드포인트에서 읽기 때문에
    // 초기 진입 시 loadWithdrawFee()를 누락하면 저장값이 비어 보인다.
    await loadWithdrawFee();
    await loadSwapFee();
    await loadTradeFee();
    await loadRefRate();
    await loadSecurity();
    await loadSolana();
    await loadAmm();
    await loadAmmAudit();

    // (2026-05-20 v665) AMM 카드 자동 폴링 — 운영자: '현재 오픈 매도
    //   주문이 체결된 후에도 새로고침 전까지 사라지지 않음'. AMM 풀
    //   잔고 / 현재 오픈 주문 / 축적 토큰 정보가 외부 거래 (유저의
    //   매도가 AMM 에 의해 자동 매수 등) 로 인해 변하는 것을 즉시 반영.
    //   POLL: 5초 주기. 탭이 hidden 일 때는 일시 정지 (불필요한 API 호출
    //   방지). 토큰 mints / fee 설정 / 보안 등은 변경 빈도 낮아 폴링 불필요.
    const AMM_POLL_MS = 5000;
    let ammPollTimer = null;
    const tickAmm = async () => {
      try { await loadAmm(); }
      catch (e) { console.warn("[settings.amm-poll]", e?.message || e); }
    };
    const startAmmPoll = () => {
      if (ammPollTimer) return;
      ammPollTimer = setInterval(tickAmm, AMM_POLL_MS);
    };
    const stopAmmPoll = () => {
      if (ammPollTimer) { clearInterval(ammPollTimer); ammPollTimer = null; }
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAmmPoll();
      else startAmmPoll();
    });
    if (!document.hidden) startAmmPoll();
  });
})();