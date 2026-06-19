(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  window.RwaPages["history"] = async () => {
    const C = window.RwaCore;
    if (!C) throw new Error("RwaCore(core.js)가 로드되지 않았습니다.");

    const I18N = window.RwaI18n || null;
    const t = (key, fallback = "") => I18N?.t?.(key) || I18N?.translateMessage?.(key) || fallback || key;
    // (2026-05-07) default 'en' 통일 — i18n.js / site-header / silica-data-bind 와 일치.
    const getLang = () => String(I18N?.lang?.() || localStorage.getItem("rwa_lang_user_v1") || "en").trim().toLowerCase();
    const tt = (map) => {
      const lang = getLang();
      return map?.[lang] || map?.ko || map?.en || "";
    };
    const esc = (v) => String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const els = {
      wallet: C.qs("#historyWallet"),
      title: C.qs("#historyTitle"),
      lead: C.qs("#historyLead"),
      calcNote: C.qs("#historyCalcNote"),
      walletLabel: C.qs("#historyWalletLabel"),
      depositLabel: C.qs("#histDepositLabel"),
      depositValue: C.qs("#histDepositValue"),
      depositSub: C.qs("#histDepositSub"),
      fundingLabel: C.qs("#histFundingLabel"),
      fundingValue: C.qs("#histFundingValue"),
      fundingSub: C.qs("#histFundingSub"),
      interestLabel: C.qs("#histInterestLabel"),
      interestValue: C.qs("#histInterestValue"),
      interestSub: C.qs("#histInterestSub"),
      saleProfitLabel: C.qs("#histSaleProfitLabel"),
      saleProfitValue: C.qs("#histSaleProfitValue"),
      saleProfitSub: C.qs("#histSaleProfitSub"),
      withdrawLabel: C.qs("#histWithdrawLabel"),
      withdrawValue: C.qs("#histWithdrawValue"),
      withdrawSub: C.qs("#histWithdrawSub"),
      currentLabel: C.qs("#histCurrentLabel"),
      currentValue: C.qs("#histCurrentValue"),
      currentSub: C.qs("#histCurrentSub"),
      roiLabel: C.qs("#histRoiLabel"),
      roiValue: C.qs("#histRoiValue"),
      roiSub: C.qs("#histRoiSub"),
      flowTitle: C.qs("#historyFlowTitle"),
      flowLead: C.qs("#historyFlowLead"),
      flowRows: C.qs("#historyFlowRows"),
      flowNote: C.qs("#historyFlowNote"),
      snapshotTitle: C.qs("#historySnapshotTitle"),
      snapshotLead: C.qs("#historySnapshotLead"),
      snapshotNote: C.qs("#historySnapshotNote"),
      roiBadge: C.qs("#historyRoiBadge"),
      assetRows: C.qs("#historyAssetRows"),
      timelineTitle: C.qs("#historyTimelineTitle"),
      timelineLead: C.qs("#historyTimelineLead"),
      timelineRows: C.qs("#historyTimelineRows"),
      assetHead: C.qs("#histAssetHead"),
      availHead: C.qs("#histAvailHead"),
      stakedHead: C.qs("#histStakedHead"),
      pendingHead: C.qs("#histPendingHead"),
      nominalHead: C.qs("#histNominalHead"),
      typeHead: C.qs("#histTypeHead"),
      detailHead: C.qs("#histDetailHead"),
      statusHead: C.qs("#histStatusHead"),
      amountHead: C.qs("#histAmountHead"),
      timeHead: C.qs("#histTimeHead"),
    };

    const setStaticTexts = () => {
      document.title = tt({
        ko: "자금 히스토리 · SilicaChain",
        en: "Funds History · SilicaChain",
        ja: "資金履歴 · SilicaChain",
        zh: "资金历史 · SilicaChain",
      });
      if (els.title) els.title.textContent = tt({
        ko: "자금 히스토리",
        en: "Funds History",
        ja: "資金履歴",
        zh: "资金历史",
      });
      if (els.lead) els.lead.textContent = tt({
        ko: "입금, 투자 참여, 매각손익, 이자 수령, 출금, 현재 추정 자산과 수익률을 한눈에 확인할 수 있습니다.",
        en: "See deposits, funding participation, sale profit and loss, interest receipts, withdrawals, estimated current assets, and ROI at a glance.",
        ja: "入金、投資参加、売却損益、利息受取、出金、現在の推定資産と収益率を一目で確認できます。",
        zh: "可一目了然地查看入金、投资参与、出售损益、利息领取、出金、当前估算资产与收益率。",
      });
      if (els.calcNote) els.calcNote.textContent = tt({
        ko: "수익률은 현재 USDT 잔액 + 보유 토큰의 명목가치(1 Token = 1 USDT 기준) + 미클레임 이자를 반영해 추정합니다.",
        en: "ROI is estimated from current USDT balance + nominal token value (1 Token = 1 USDT) + unclaimed interest.",
        ja: "収益率は、現在のUSDT残高 + 保有トークンの名目価値（1 Token = 1 USDT）+ 未請求利息を反映して推定します。",
        zh: "收益率按照当前USDT余额 + 持有代币名义价值（1 Token = 1 USDT）+ 未领取利息进行估算。",
      });
      if (els.walletLabel) els.walletLabel.textContent = tt({ ko: "지갑", en: "Wallet", ja: "ウォレット", zh: "钱包" });
      if (els.depositLabel) els.depositLabel.textContent = tt({ ko: "누적 입금", en: "Total Deposits", ja: "累计入金", zh: "累计入金" });
      if (els.depositSub) els.depositSub.textContent = tt({
        ko: "외부 지갑에서 입금 완료된 USDT 기준",
        en: "Based on completed USDT deposits from external wallets",
        ja: "外部ウォレットから完了したUSDT入金基準",
        zh: "基于来自外部钱包的已完成USDT入金",
      });
      if (els.fundingLabel) els.fundingLabel.textContent = tt({ ko: "투자 참여 사용", en: "Used for Funding", ja: "投資参加に使用", zh: "用于投资参与" });
      if (els.fundingSub) els.fundingSub.textContent = tt({
        ko: "모금 참여에 사용된 금액",
        en: "Amount used for funding participation",
        ja: "募金参加に使われた金額",
        zh: "用于募资参与的金额",
      });
      if (els.interestLabel) els.interestLabel.textContent = tt({ ko: "이자/보너스 수령", en: "Interest / Bonus Received", ja: "利息/ボーナス受取", zh: "已领取利息/奖励" });
      if (els.interestSub) els.interestSub.textContent = tt({
        ko: "클레임 이자 + 추천 보상 누계",
        en: "Claimed interest + referral bonus total",
        ja: "請求済み利息 + 紹介報酬の累計",
        zh: "已领取利息 + 推荐奖励累计",
      });
      if (els.saleProfitLabel) els.saleProfitLabel.textContent = tt({ ko: "매각손익", en: "Sale Profit / Loss", ja: "売却損益", zh: "出售损益" });
      if (els.saleProfitSub) els.saleProfitSub.textContent = tt({
        ko: "매각 실행 기준 확정 손익 합계",
        en: "Total realized profit and loss based on sale execution",
        ja: "売却実行基準の確定損益合計",
        zh: "按出售执行基准确定的损益合计",
      });
      if (els.withdrawLabel) els.withdrawLabel.textContent = tt({ ko: "누적 출금", en: "Total Withdrawals", ja: "累计出金", zh: "累计出金" });
      if (els.withdrawSub) els.withdrawSub.textContent = tt({
        ko: "실제 전송 완료 기준",
        en: "Based on completed transfers",
        ja: "実際の送金完了基準",
        zh: "以实际转账完成为准",
      });
      if (els.currentLabel) els.currentLabel.textContent = tt({ ko: "현재 추정 총자산", en: "Estimated Current Assets", ja: "現在の推定総資産", zh: "当前估算总资产" });
      if (els.currentSub) els.currentSub.textContent = tt({
        ko: "USDT + 토큰 명목가치 + 미클레임 이자",
        en: "USDT + nominal token value + unclaimed interest",
        ja: "USDT + トークン名目価値 + 未請求利息",
        zh: "USDT + 代币名义价值 + 未领取利息",
      });
      if (els.roiLabel) els.roiLabel.textContent = tt({ ko: "추정 수익률", en: "Estimated ROI", ja: "推定収益率", zh: "估算收益率" });
      if (els.roiSub) els.roiSub.textContent = tt({
        ko: "누적 입금 대비 현재 자산·출금 반영",
        en: "Current assets and withdrawals versus total deposits",
        ja: "累計入金に対する現在資産・出金反映",
        zh: "相对于累计入金反映当前资产与出金",
      });
      if (els.flowTitle) els.flowTitle.textContent = tt({ ko: "자금 흐름", en: "Funds Flow", ja: "資金フロー", zh: "资金流向" });
      if (els.flowLead) els.flowLead.textContent = tt({
        ko: "어떤 자금이 들어왔고, 어디에 사용되었는지, 매각손익이 얼마나 반영됐는지 규모를 비교해서 볼 수 있습니다.",
        en: "Compare incoming funds, where funds were used, and how much sale profit or loss has been reflected.",
        ja: "どの資金が入り、どこに使われ、売却損益がどれだけ反映されたかを規模比較で確認できます。",
        zh: "可对比查看资金流入、资金用途以及出售损益的反映规模。",
      });
      if (els.flowNote) els.flowNote.textContent = tt({
        ko: "바 길이는 현재 화면에 표시된 주요 금액 중 가장 큰 값을 기준으로 상대적으로 표시됩니다.",
        en: "Bar lengths are shown relatively against the largest amount displayed on this screen.",
        ja: "バーの長さは、この画面に表示された主な金額のうち最大値を基準に相対表示されます。",
        zh: "条形长度会根据本页显示的主要金额中的最大值进行相对展示。",
      });
      if (els.snapshotTitle) els.snapshotTitle.textContent = tt({ ko: "현재 자산 스냅샷", en: "Current Asset Snapshot", ja: "現在資産スナップショット", zh: "当前资产快照" });
      if (els.snapshotLead) els.snapshotLead.textContent = tt({
        ko: "현재 보유 토큰, 스테이킹 수량, 자산별 미클레임 이자를 함께 확인할 수 있습니다.",
        en: "View current token holdings, staked amounts, and unclaimed interest by asset.",
        ja: "現在の保有トークン、ステーキング数量、資産別の未請求利息をまとめて確認できます。",
        zh: "可同时查看当前持有代币、质押数量以及各资产的未领取利息。",
      });
      if (els.snapshotNote) els.snapshotNote.textContent = tt({
        ko: "토큰 명목가치는 1 Token = 1 USDT 기준의 참고용 수치입니다.",
        en: "Nominal token value is a reference figure based on 1 Token = 1 USDT.",
        ja: "トークン名目価値は 1 Token = 1 USDT 基準の参考値です。",
        zh: "代币名义价值为按 1 Token = 1 USDT 计算的参考数值。",
      });
      if (els.timelineTitle) els.timelineTitle.textContent = tt({ ko: "자금 타임라인", en: "Funds Timeline", ja: "資金タイムライン", zh: "资金时间线" });
      if (els.timelineLead) els.timelineLead.textContent = tt({
        ko: "최근 입금, 투자 참여, 매각손익, 매각 정산, 환급, 이자 수령, 추천 보상, 출금 내역을 시간순으로 확인할 수 있습니다.",
        en: "Review recent deposits, funding participation, sale profit/loss, sale settlements, refunds, interest receipts, referral bonuses, and withdrawals in chronological order.",
        ja: "最近の入金、投資参加、売却損益、売却精算、返金、利息受取、紹介報酬、出金履歴を時系列で確認できます。",
        zh: "可按时间顺序查看最近的入金、投资参与、出售损益、出售结算、退款、利息领取、推荐奖励及出金记录。",
      });
      if (els.assetHead) els.assetHead.textContent = tt({ ko: "자산", en: "Asset", ja: "資産", zh: "资产" });
      if (els.availHead) els.availHead.textContent = tt({ ko: "가용", en: "Available", ja: "可用", zh: "可用" });
      if (els.stakedHead) els.stakedHead.textContent = tt({ ko: "스테이킹", en: "Staked", ja: "ステーキング", zh: "质押" });
      if (els.pendingHead) els.pendingHead.textContent = tt({ ko: "미클레임 이자", en: "Unclaimed Interest", ja: "未請求利息", zh: "未领取利息" });
      if (els.nominalHead) els.nominalHead.textContent = tt({ ko: "명목가치", en: "Nominal Value", ja: "名目価値", zh: "名义价值" });
      if (els.typeHead) els.typeHead.textContent = tt({ ko: "구분", en: "Type", ja: "区分", zh: "类型" });
      if (els.detailHead) els.detailHead.textContent = tt({ ko: "상세", en: "Detail", ja: "詳細", zh: "详情" });
      if (els.statusHead) els.statusHead.textContent = tt({ ko: "상태", en: "Status", ja: "状態", zh: "状态" });
      if (els.amountHead) els.amountHead.textContent = tt({ ko: "금액", en: "Amount", ja: "金額", zh: "金额" });
      if (els.timeHead) els.timeHead.textContent = tt({ ko: "시간", en: "Time", ja: "時間", zh: "时间" });
    };

    const sumBy = (rows, pick) => (rows || []).reduce((acc, row) => acc + Number(pick(row) || 0), 0);
    const fmtUsdt = (n, d = 2) => `${C.fmt.num(Number(n || 0), d)} USDT`;
    const fmtSignedUsdt = (n, d = 2) => {
      const num = Math.abs(Number(n || 0)) <= 0.0000005 ? 0 : Number(n || 0);
      if (num === 0) return `${C.fmt.num(0, d)} USDT`;
      return `${num >= 0 ? "+" : "-"}${C.fmt.num(Math.abs(num), d)} USDT`;
    };
    const fmtTokenQty = (n) => {
      const num = Number(n || 0);
      const digits = Math.abs(num - Math.round(num)) <= 0.0000005 ? 0 : 6;
      return C.fmt.num(num, digits);
    };
    const fmtPct = (n) => `${Number(n || 0).toLocaleString(I18N?.locale?.() || "ko-KR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
    const fmtDateTime = (s) => {
      if (!s) return "-";
      // (2026-05-20 v669) UTC → 사용자 로컬 timezone 변환 (robust 버전).
      //   백엔드 nowUtcSql() 가 'Y-m-d H:i:s' (UTC) 로 저장. 'Z' 마커
      //   없어 JS new Date(s) 가 local time 으로 잘못 파싱 → 9시간 차이.
      //   다양한 입력 포맷 (공백/T 구분자, 미세초, 타임존 마커 유무) 지원.
      let str = String(s).trim();
      if (!str) return "-";
      const hasTz = /Z$|[+-]\d{2}:?\d{2}$/i.test(str);
      if (!hasTz) {
        if (str.includes(" ")) str = str.replace(" ", "T");
        str = str.replace(/\.\d+$/, "");
        str += "Z";
      }
      const d = new Date(str);
      if (isNaN(d)) return String(s);
      return d.toLocaleString(I18N?.locale?.() || "ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    };
    const parseMemoNum = (memo, key) => {
      const src = String(memo || "");
      if (!src || !key) return 0;
      const m = src.match(new RegExp(`${String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(-?\\d+(?:\\.\\d+)?)`, "i"));
      return m ? Number(m[1] || 0) : 0;
    };
    const isSuccessStatus = (status) => {
      const s = String(status || "").trim();
      return /(입금완료|출금완료|전송완료|환불 완료|참여완료|완료)$/i.test(s) || s === "완료";
    };
    const statusBadgeClass = (status) => {
      const s = String(status || "").trim();
      if (!s) return "neutral";
      if (/(완료|executed|completed|confirmed|confirmed|입금완료|출금완료|전송완료|참여완료|환불 완료)/i.test(s)) return "good";
      if (/(대기|pending|processing|신청|진행|교환가능|available|일부교환|partial)/i.test(s)) return "warn";
      if (/(반려|실패|cancel|취소|rejected|failed)/i.test(s)) return "bad";
      return "neutral";
    };
    const resolveSaleHistoryStatus = (key) => {
      const s = String(key || "").trim().toLowerCase();
      if (s === "available") return tt({ ko: "교환가능", en: "Exchange Available", ja: "交換可能", zh: "可兑换" });
      if (s === "partial") return tt({ ko: "일부교환", en: "Partially Exchanged", ja: "一部交換済み", zh: "部分已兑换" });
      if (s === "done") return tt({ ko: "교환완료", en: "Exchange Completed", ja: "交換完了", zh: "兑换完成" });
      return tt({ ko: "확정", en: "Confirmed", ja: "確定", zh: "已确定" });
    };
    const setEmptyTable = (tbody, colspan, text) => {
      if (!tbody) return;
      tbody.innerHTML = `<tr><td colspan="${Number(colspan || 1)}" class="center muted">${esc(text)}</td></tr>`;
    };
    const kindMeta = (kind) => {
      switch (kind) {
        case "deposit":
          return { cls: "is-deposit", label: tt({ ko: "입금", en: "Deposit", ja: "入金", zh: "入金" }) };
        case "funding":
          return { cls: "is-funding", label: tt({ ko: "투자 참여", en: "Funding", ja: "投資参加", zh: "投资参与" }) };
        case "refund":
          return { cls: "is-refund", label: tt({ ko: "환급", en: "Refund", ja: "返金", zh: "退款" }) };
        case "interest":
          return { cls: "is-interest", label: tt({ ko: "이자", en: "Interest", ja: "利息", zh: "利息" }) };
        case "bonus":
          return { cls: "is-bonus", label: tt({ ko: "추천 보상", en: "Referral Bonus", ja: "紹介報酬", zh: "推荐奖励" }) };
        case "sale_profit":
          return { cls: "is-sale", label: tt({ ko: "매각손익", en: "Sale Profit / Loss", ja: "売却損益", zh: "出售损益" }) };
        case "sale_settlement":
          return { cls: "is-sale", label: tt({ ko: "매각 정산", en: "Sale Settlement", ja: "売却精算", zh: "出售结算" }) };
        case "withdraw":
          return { cls: "is-withdraw", label: tt({ ko: "출금", en: "Withdrawal", ja: "出金", zh: "出金" }) };
        default:
          return { cls: "is-other", label: tt({ ko: "기타", en: "Other", ja: "その他", zh: "其他" }) };
      }
    };
    const shortAddress = (addr) => {
      const s = String(addr || "").trim();
      if (!s) return "-";
      if (s.length <= 16) return s;
      return `${s.slice(0, 8)}...${s.slice(-6)}`;
    };

    setStaticTexts();

    const wallet = C.getWallet();
    if (els.wallet) els.wallet.textContent = wallet?.address ? shortAddress(wallet.address) : "-";

    if (!wallet?.connected || !wallet?.token) {
      const msg = tt({
        ko: "지갑을 연결하면 계정별 자금 히스토리와 수익률을 확인할 수 있습니다.",
        en: "Connect your wallet to view account-specific funds history and ROI.",
        ja: "ウォレットを接続すると、アカウント別の資金履歴と収益率を確認できます。",
        zh: "连接钱包后即可查看账户资金历史和收益率。",
      });
      [
        els.depositValue,
        els.fundingValue,
        els.interestValue,
        els.saleProfitValue,
        els.withdrawValue,
        els.currentValue,
        els.roiValue,
      ].forEach((el) => { if (el) el.textContent = "-"; });
      if (els.roiBadge) {
        els.roiBadge.className = "history-roi-badge flat";
        els.roiBadge.textContent = tt({ ko: "지갑 연결 필요", en: "Wallet required", ja: "ウォレット接続が必要", zh: "需要连接钱包" });
      }
      if (els.flowRows) els.flowRows.innerHTML = `<div class="history-state">${esc(msg)}</div>`;
      setEmptyTable(els.assetRows, 5, msg);
      setEmptyTable(els.timelineRows, 5, msg);
      return;
    }

    let portfolio = null;
    let walletTx = null;
    let saleTx = { rows: [] };
    let saleHistory = { rows: [] };
    try {
      [portfolio, walletTx, saleTx, saleHistory] = await Promise.all([
        C.api("/api/portfolio", { method: "GET", auth: true }),
        C.api("/api/wallet/transactions?limit=200", { method: "GET", auth: true }),
        C.api("/api/me/sale-redemptions", { method: "GET", auth: true }).catch(() => ({ rows: [] })),
        C.api("/api/me/sale-history", { method: "GET", auth: true }).catch(() => ({ rows: [] })),
      ]);
    } catch (e) {
      const msg = e?.message || tt({
        ko: "히스토리를 불러오지 못했습니다.",
        en: "Failed to load history.",
        ja: "履歴を読み込めませんでした。",
        zh: "无法加载历史记录。",
      });
      C.toast(msg, "bad");
      if (els.flowRows) els.flowRows.innerHTML = `<div class="history-state">${esc(msg)}</div>`;
      setEmptyTable(els.assetRows, 5, msg);
      setEmptyTable(els.timelineRows, 5, msg);
      return;
    }

    const walletRows = Array.isArray(walletTx?.transactions) ? walletTx.transactions : [];
    const saleRows = Array.isArray(saleTx?.rows) ? saleTx.rows : [];
    const saleHistoryRows = Array.isArray(saleHistory?.rows) ? saleHistory.rows : [];
    const holdings = Array.isArray(portfolio?.holdings) ? portfolio.holdings : [];
    const fundingRows = Array.isArray(portfolio?.funding) ? portfolio.funding : [];
    const interestSummary = portfolio?.interestSummary && typeof portfolio.interestSummary === "object"
      ? Object.values(portfolio.interestSummary)
      : [];

    const isRefundCredit = (row) => /refund_/i.test(String(row?.memo || ""));
    const completedDeposits = walletRows.filter((row) => String(row?.kind || "") === "deposit" && isSuccessStatus(row?.status) && !isRefundCredit(row));
    const refundCredits = walletRows.filter((row) => String(row?.kind || "") === "deposit" && isSuccessStatus(row?.status) && isRefundCredit(row));
    const completedWithdrawals = walletRows.filter((row) => String(row?.kind || "") === "withdraw" && isSuccessStatus(row?.status));
    const interestRows = walletRows.filter((row) => String(row?.kind || "") === "interest_claim" && isSuccessStatus(row?.status));
    const bonusRows = walletRows.filter((row) => String(row?.kind || "") === "referral_bonus" && isSuccessStatus(row?.status));

    const totalDeposits = sumBy(completedDeposits, (row) => row?.amount);
    const totalFundingUsed = sumBy(fundingRows.filter((row) => String(row?.entry_kind || "") === "funding_record"), (row) => row?.amount_usdt);
    const totalFundingRefunded = sumBy(fundingRows.filter((row) => String(row?.entry_kind || "") === "contract_refund"), (row) => row?.amount_usdt);
    const totalWithdrawals = sumBy(completedWithdrawals, (row) => row?.withdraw_net_amount || parseMemoNum(row?.memo, "net") || row?.amount);
    const claimedInterestFromTx = sumBy(interestRows, (row) => row?.amount);
    const claimedInterestFromSummary = sumBy(interestSummary, (row) => row?.claimed_interest_usdt);
    const totalClaimedInterest = Math.max(claimedInterestFromTx, claimedInterestFromSummary);
    const totalBonus = sumBy(bonusRows, (row) => row?.amount);
    const totalSaleProfit = Number((saleHistory?.total_profit_usdt ?? sumBy(saleHistoryRows, (row) => row?.profit_usdt)) || 0);
    const totalSaleSettlements = sumBy(saleRows, (row) => row?.usdt);
    const totalPendingInterest = sumBy(interestSummary, (row) => row?.pending_interest_usdt);
    const nominalTokenValue = sumBy(holdings, (row) => Number(row?.balance_token || 0) + Number(row?.staked_token || 0));
    const currentUsdt = Number(portfolio?.usdt || 0);
    const currentEstimatedAssets = currentUsdt + nominalTokenValue + totalPendingInterest;
    const roi = totalDeposits > 0 ? (((currentEstimatedAssets + totalWithdrawals) - totalDeposits) / totalDeposits) * 100 : 0;
    const totalIncome = totalClaimedInterest + totalBonus;

    if (els.depositValue) els.depositValue.textContent = fmtUsdt(totalDeposits, 2);
    if (els.fundingValue) els.fundingValue.textContent = fmtUsdt(totalFundingUsed, 2);
    if (els.interestValue) els.interestValue.textContent = fmtUsdt(totalIncome, 2);
    if (els.saleProfitValue) els.saleProfitValue.textContent = fmtSignedUsdt(totalSaleProfit, 2);
    if (els.withdrawValue) els.withdrawValue.textContent = fmtUsdt(totalWithdrawals, 2);
    if (els.currentValue) els.currentValue.textContent = fmtUsdt(currentEstimatedAssets, 2);
    if (els.roiValue) els.roiValue.textContent = totalDeposits > 0 ? fmtPct(roi) : "-";

    if (els.roiBadge) {
      const cls = totalDeposits <= 0 ? "flat" : (roi > 0.0001 ? "good" : (roi < -0.0001 ? "bad" : "flat"));
      els.roiBadge.className = `history-roi-badge ${cls}`;
      els.roiBadge.textContent = totalDeposits <= 0
        ? tt({ ko: "입금 내역 없음", en: "No deposit history", ja: "入金履歴なし", zh: "无入金记录" })
        : `${roi >= 0 ? "+" : ""}${fmtPct(roi)}`;
    }

    const flowData = [
      {
        key: "in",
        label: tt({ ko: "누적 입금", en: "Deposits", ja: "累计入金", zh: "累计入金" }),
        value: totalDeposits,
        cls: "is-in",
      },
      {
        key: "out",
        label: tt({ ko: "투자 참여 사용", en: "Used for Funding", ja: "投資参加に使用", zh: "用于投资参与" }),
        value: totalFundingUsed,
        cls: "is-out",
      },
      {
        key: "refund",
        label: tt({ ko: "환급/환불 반영", en: "Refunds Returned", ja: "返金反映", zh: "退款返还" }),
        value: totalFundingRefunded + sumBy(refundCredits, (row) => row?.amount),
        cls: "is-refund",
      },
      {
        key: "sale_profit",
        label: tt({ ko: "매각손익", en: "Sale Profit / Loss", ja: "売却損益", zh: "出售损益" }),
        value: totalSaleProfit,
        cls: "is-sale",
      },
      {
        key: "income",
        label: tt({ ko: "이자 + 추천 보상", en: "Interest + Bonus", ja: "利息 + 紹介報酬", zh: "利息 + 推荐奖励" }),
        value: totalIncome,
        cls: "is-income",
      },
      {
        key: "withdraw",
        label: tt({ ko: "누적 출금", en: "Withdrawals", ja: "累计出金", zh: "累计出金" }),
        value: totalWithdrawals,
        cls: "is-out",
      },
      {
        key: "current",
        label: tt({ ko: "현재 추정 총자산", en: "Estimated Current Assets", ja: "現在の推定総資産", zh: "当前估算总资产" }),
        value: currentEstimatedAssets,
        cls: "is-current",
      },
    ];

    const maxFlow = Math.max(1, ...flowData.map((item) => Math.abs(Number(item.value || 0))));
    if (els.flowRows) {
      els.flowRows.innerHTML = flowData.map((item) => {
        const value = Number(item.value || 0);
        const absValue = Math.abs(value);
        const width = absValue > 0 ? Math.max(4, Math.min(100, (absValue / maxFlow) * 100)) : 0;
        const valueText = item.key === "sale_profit" ? fmtSignedUsdt(value, 2) : fmtUsdt(value, 2);
        return `
          <div class="history-flow-row">
            <div class="history-flow-label">${esc(item.label)}</div>
            <div class="history-flow-track"><div class="history-flow-bar ${item.cls}" style="width:${width}%"></div></div>
            <div class="history-flow-value">${esc(valueText)}</div>
          </div>
        `;
      }).join("");
    }

    if (!holdings.length) {
      setEmptyTable(
        els.assetRows,
        5,
        tt({
          ko: "현재 보유 또는 스테이킹 중인 자산이 없습니다.",
          en: "There are no currently held or staked assets.",
          ja: "現在保有中またはステーキング中の資産はありません。",
          zh: "当前没有持有或质押中的资产。",
        })
      );
    } else if (els.assetRows) {
      const summaryMap = new Map(interestSummary.map((row) => [String(row?.asset_id || ""), row]));
      const rows = holdings.slice().sort((a, b) => String(a?.asset_name || a?.asset_id || "").localeCompare(String(b?.asset_name || b?.asset_id || "")));
      els.assetRows.innerHTML = rows.map((row) => {
        const assetId = String(row?.asset_id || "");
        const label = String(row?.asset_name || row?.name || assetId || "-");
        const tokenSymbol = String(row?.token_symbol || assetId || "TOKEN");
        const available = Number(row?.balance_token || 0);
        const staked = Number(row?.staked_token || 0);
        const pendingInterest = Number(summaryMap.get(assetId)?.pending_interest_usdt || 0);
        const nominal = available + staked;
        return `
          <tr>
            <td>
              <div class="history-asset-name">
                <strong data-no-i18n="1" translate="no">${esc(label)}</strong>
                <span class="history-asset-symbol" data-no-i18n="1" translate="no">${esc(tokenSymbol)}</span>
              </div>
            </td>
            <td class="right mono">${esc(C.fmt.num(available, 1))}</td>
            <td class="right mono">${esc(C.fmt.num(staked, 1))}</td>
            <td class="right mono">${esc(C.fmt.num(pendingInterest, 2))} USDT</td>
            <td class="right mono">${esc(C.fmt.num(nominal, 1))} USDT</td>
          </tr>
        `;
      }).join("");
    }

    const events = [];
    completedDeposits.forEach((row) => {
      events.push({
        kind: "deposit",
        detail: row?.asset && String(row.asset).toUpperCase() !== "USDT"
          ? tt({ ko: "토큰 입금", en: "Token Deposit", ja: "トークン入金", zh: "代币入金" })
          : tt({ ko: "USDT 입금", en: "USDT Deposit", ja: "USDT入金", zh: "USDT入金" }),
        status: String(row?.status || "-"),
        amount: Number(row?.amount || 0),
        created_at: row?.created_at,
        extra: row?.asset ? String(row.asset).toUpperCase() : "USDT",
      });
    });
    refundCredits.forEach((row) => {
      events.push({
        kind: "refund",
        detail: tt({ ko: "출금 반려 환급", en: "Withdrawal Reversal Refund", ja: "出金差戻し返金", zh: "出金驳回退款" }),
        status: String(row?.status || tt({ ko: "환불 완료", en: "Refunded", ja: "返金完了", zh: "退款完成" })),
        amount: Number(row?.amount || 0),
        created_at: row?.created_at,
        extra: "USDT",
      });
    });
    fundingRows.forEach((row) => {
      const isRefund = String(row?.entry_kind || "") === "contract_refund";
      events.push({
        kind: isRefund ? "refund" : "funding",
        detail: isRefund
          ? tt({ ko: "계약 환급", en: "Contract Refund", ja: "契約返金", zh: "合同退款" })
          : tt({ ko: "모금 참여", en: "Funding Participation", ja: "募金参加", zh: "募资参与" }),
        status: String(row?.funding_status_label || (isRefund
          ? tt({ ko: "환불 완료", en: "Refunded", ja: "返金完了", zh: "退款完成" })
          : tt({ ko: "참여완료", en: "Completed", ja: "参加完了", zh: "参与完成" }))),
        amount: Number(row?.amount_usdt || 0) * (isRefund ? 1 : -1),
        created_at: row?.created_at,
        extra: String(row?.asset_name || row?.name || row?.asset_id || ""),
      });
    });
    interestRows.forEach((row) => {
      events.push({
        kind: "interest",
        detail: tt({ ko: "이자 수령", en: "Interest Claim", ja: "利息受取", zh: "利息领取" }),
        status: String(row?.status || tt({ ko: "완료", en: "Completed", ja: "完了", zh: "完成" })),
        amount: Number(row?.amount || 0),
        created_at: row?.created_at,
        extra: String(row?.asset || "USDT"),
      });
    });
    bonusRows.forEach((row) => {
      events.push({
        kind: "bonus",
        detail: tt({ ko: "추천 보상 수령", en: "Referral Bonus Received", ja: "紹介報酬受取", zh: "推荐奖励领取" }),
        status: String(row?.status || tt({ ko: "완료", en: "Completed", ja: "完了", zh: "完成" })),
        amount: Number(row?.amount || 0),
        created_at: row?.created_at,
        extra: "USDT",
      });
    });
    saleHistoryRows.forEach((row) => {
      const assetName = String(row?.asset_name || row?.asset_id || "").trim();
      const tokenSymbol = String(row?.token_symbol || row?.asset_id || "TOKEN").trim();
      const tokenQty = Number(row?.total_tokens || 0);
      const extraParts = [];
      if (assetName) extraParts.push(assetName);
      if (tokenQty > 0) extraParts.push(`${fmtTokenQty(tokenQty)} ${tokenSymbol}`);
      events.push({
        kind: "sale_profit",
        detail: tt({ ko: "매각손익 확정", en: "Sale Profit Finalized", ja: "売却損益確定", zh: "出售损益确定" }),
        status: resolveSaleHistoryStatus(row?.status_key),
        amount: Number(row?.profit_usdt || 0),
        created_at: row?.sale_executed_at || row?.created_at || row?.sale_date,
        extra: extraParts.join(" · "),
      });
    });
    saleRows.forEach((row) => {
      const assetName = String(row?.asset_name || row?.asset_id || "").trim();
      const tokenSymbol = String(row?.token_symbol || row?.asset_id || "TOKEN").trim();
      const tokenQty = Number(row?.tokens || 0);
      const settlementBasis = String(row?.settlement_basis || "USDT").toUpperCase();
      const localAmount = Number(row?.amount_local || 0);
      const extraParts = [];
      if (assetName) extraParts.push(assetName);
      if (tokenQty > 0) extraParts.push(`${fmtTokenQty(tokenQty)} ${tokenSymbol}`);
      if (localAmount > 0 && settlementBasis !== "USDT") {
        extraParts.push(`${C.fmt.num(localAmount, 4)} ${settlementBasis}`);
      }
      events.push({
        kind: "sale_settlement",
        detail: tt({ ko: "매각 정산 수령", en: "Sale Settlement Received", ja: "売却精算受領", zh: "出售结算收入" }),
        status: String(row?.status || tt({ ko: "교환완료", en: "Completed", ja: "完了", zh: "完成" })),
        amount: Number(row?.usdt || 0),
        created_at: row?.created_at,
        extra: extraParts.join(" · "),
      });
    });
    completedWithdrawals.forEach((row) => {
      events.push({
        kind: "withdraw",
        detail: tt({ ko: "USDT 출금", en: "USDT Withdrawal", ja: "USDT出金", zh: "USDT出金" }),
        status: String(row?.status || "-"),
        amount: -1 * Number(row?.withdraw_net_amount || parseMemoNum(row?.memo, "net") || row?.amount || 0),
        created_at: row?.created_at,
        extra: "USDT",
      });
    });

    events.sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());

    if (!events.length) {
      setEmptyTable(
        els.timelineRows,
        5,
        tt({
          ko: "표시할 자금 히스토리가 없습니다.",
          en: "There is no funds history to display.",
          ja: "表示できる資金履歴がありません。",
          zh: "没有可显示的资金历史。",
        })
      );
    } else if (els.timelineRows) {
      els.timelineRows.innerHTML = events.slice(0, 200).map((evt) => {
        const meta = kindMeta(evt.kind);
        const amount = Number(evt.amount || 0);
        const status = String(evt.status || "-");
        const detail = `${evt.detail}${evt.extra ? ` · ${evt.extra}` : ""}`;
        return `
          <tr>
            <td><span class="history-kind ${meta.cls}">${esc(meta.label)}</span></td>
            <td>${esc(detail)}</td>
            <td><span class="badge ${statusBadgeClass(status)}">${esc(status)}</span></td>
            <td class="right mono history-amount ${amount >= 0 ? "plus" : "minus"}">${amount >= 0 ? "+" : "-"}${esc(C.fmt.num(Math.abs(amount), 2))} USDT</td>
            <td class="right mono">${esc(fmtDateTime(evt.created_at))}</td>
          </tr>
        `;
      }).join("");
    }
  };
})();
