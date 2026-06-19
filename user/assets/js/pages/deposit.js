// public/assets/js/pages/deposit.js
(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  // ============================================================================
  // (2026-05-26 v825) Deposit hijacking 방어 — 관리자 입금 지갑 allowlist.
  //
  //   /api/public/config 가 반환하는 deposit_admin_usdt_address 를 그대로 믿고
  //   서명 destination 으로 쓰던 기존 흐름은, 서버 settings 가 변조되면 사용자가
  //   알아챌 방법 없이 attacker 지갑으로 전송하게 되는 hijacking 경로였다.
  //   (Solana SPL transferChecked 의 destination 은 ATA 라 Phantom UI 가 지갑
  //    주소를 직접 보여주지 않음 → 사용자 자체 검증 불가능.)
  //
  //   해결: deposit.js 에 known-good 운영 지갑 주소를 *하드코딩* + Object.freeze
  //         으로 런타임 변조 차단. API 응답이 이 목록과 다르면 입금 자체를
  //         빨간 모달로 차단. attacker 가 성공하려면 (settings) + (PHP 코드) +
  //         (이 JS 파일 + 캐시 + SRI) 셋 다 동시에 침해해야 한다.
  //
  //   주소 추가/변경: 합법적인 운영 지갑 rotation 시에는 이 배열에 새 주소를 추가
  //                  한 뒤 v 버전을 올려 재배포. 과거 주소도 함께 보존해서 구
  //                  버전 캐시 클라이언트가 일시적으로 깨지지 않도록 한다.
  // ============================================================================
  const KNOWN_ADMIN_WALLETS = Object.freeze([
    'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', // 2026-02-23 ~ (rwa.sql baseline)
  ]);

  window.RwaPages.deposit = async () => {
    const C = window.RwaCore;
    if (!C) throw new Error("RwaCore가 없습니다.");

    const { api, toast, getWallet, connectWallet, refreshOtpGate, isOtpUnlocked, STORAGE } = C;
    const { PublicKey, Transaction, SystemProgram, TransactionInstruction } = solanaWeb3;
    const $ = (id) => document.getElementById(id);

    // 언어별 고정 문자열 헬퍼 — 템플릿에 조사/어미가 박혀 PARTS 매칭이 불가한 케이스용
    const tL = (ko, en, ja, zh) => {
      const lang = (window.RwaI18n?.lang?.() || 'ko');
      if (lang === 'en') return en;
      if (lang === 'ja') return ja;
      if (lang === 'zh') return zh;
      return ko;
    };

    let USDT_MINT;
    let USDT_DECIMALS = 6;
    let SOLANA_NETWORK = 'devnet';
    let depositAdminAddress = '';
    // (2026-05-07) Multi-token deposit — SilicaSTO and Silica reward token mint
    //   addresses from /api/public/config. Empty string when admin has not yet
    //   configured them (loadAssets() then hides those token-option cards).
    let SILICA_STO_MINT = '';
    let SILICA_TOKEN_MINT = '';
    let assets = [];
    let currentWalletBalance = null;
    let otpBypassed = false;

    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

    const short = (s) => {
      s = String(s || '');
      if (s.length <= 18) return s;
      return s.slice(0, 8) + '...' + s.slice(-6);
    };
    const fmtNum = (n, d = 6) => Number(n || 0).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: d });
    const fmtKst = (v) => (C.fmt?.time ? C.fmt.time(v) : (v || '-'));
    const formatTokenAmount = (value, decimals = 6) => fmtNum(value, Math.min(Math.max(Number(decimals) || 0, 0), 6));
    const isSolanaAddressLike = (a) => { try { new PublicKey(String(a || '').trim()); return true; } catch { return false; } };

    const isDevnet = () => SOLANA_NETWORK !== 'mainnet-beta';
    const solscanCluster = () => isDevnet() ? '?cluster=devnet' : '';

    // (2026-06-07 v867) Solana RPC proxy 사용 — frontend 가 공식 public RPC
    //   (api.mainnet-beta.solana.com) 를 직접 호출하면 abuse 차단으로 403.
    //   backend /api/public/solana/rpc 가 silica.env 의 Helius URL 로 forward.
    //   API key 는 backend 만 보유 → 브라우저에 절대 노출되지 않음.
    //   네트워크 (devnet/mainnet-beta) 는 backend admin 설정으로 결정.
    const RPC_PROXY_URL = (() => {
      // 절대 URL 로 — 같은 origin 의 API endpoint
      try { return new URL('/api/public/solana/rpc', window.location.origin).toString(); }
      catch (_) { return '/api/public/solana/rpc'; }
    })();
    const getConnection = () => new solanaWeb3.Connection(RPC_PROXY_URL, 'confirmed');

    const u8FromText = (txt) => new TextEncoder().encode(String(txt || ''));
    const u8FromArr = (arr) => new Uint8Array(arr);
    const u8Alloc = (len) => new Uint8Array(len);
    const writeU64LE = (u8, offset, vBig) => {
      let v = BigInt(vBig);
      for (let i = 0; i < 8; i++) { u8[offset + i] = Number(v & 255n); v >>= 8n; }
    };
    const u8ToBase64 = (u8) => {
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < u8.length; i += chunk) bin += String.fromCharCode.apply(null, Array.from(u8.slice(i, i + chunk)));
      return btoa(bin);
    };
    const findATA = (ownerPk, mintPk) => PublicKey.findProgramAddressSync([ownerPk.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPk.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID)[0];
    const createATAIxIdempotent = (payer, ata, owner, mint) => new TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: u8FromArr([1]),
    });
    const toAmountBigInt = (amountStr, decimals) => {
      const s = String(amountStr ?? '0').trim();
      const [i, f = ''] = s.split('.');
      const intPart = (i || '0').replace(/\D/g, '') || '0';
      const fracPart = (f || '').replace(/\D/g, '').slice(0, decimals).padEnd(decimals, '0');
      return BigInt(intPart) * (10n ** BigInt(decimals)) + BigInt(fracPart || '0');
    };
    const makeSplTransferCheckedIx = (fromATA, mint, toATA, owner, amountBig, decimals) => {
      const data = u8Alloc(10);
      data[0] = 12;
      writeU64LE(data, 1, amountBig);
      data[9] = Number(decimals) & 255;
      return new TransactionInstruction({
        keys: [
          { pubkey: fromATA, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: toATA, isSigner: false, isWritable: true },
          { pubkey: owner, isSigner: true, isWritable: false },
        ],
        programId: TOKEN_PROGRAM_ID,
        data,
      });
    };
    const makeMemoIx = (text) => new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM_ID, data: u8FromText(String(text || '')).slice(0, 180) });

    const currentAsset = () => {
      const code = String($("depAsset")?.value || 'USDT');
      return assets.find((x) => x.id === code) || assets[0] || null;
    };

    const getWalletTokenBalance = async (mintAddress) => {
      const owner = String(getWallet()?.address || window.solana?.publicKey?.toBase58?.() || '').trim();
      if (!owner || !mintAddress) return null;
      const conn = getConnection();
      const ownerPk = new PublicKey(owner);
      const mintPk = new PublicKey(mintAddress);
      const res = await conn.getParsedTokenAccountsByOwner(ownerPk, { mint: mintPk }, 'confirmed');
      const rows = Array.isArray(res?.value) ? res.value : [];
      let sum = 0;
      for (const row of rows) {
        const uiAmount = Number(row?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0);
        if (Number.isFinite(uiAmount)) sum += uiAmount;
      }
      return sum;
    };

    // (2026-05-07) Query a mint's actual decimals from chain. SPL Token's
    //   transferChecked instruction validates that the supplied decimals byte
    //   matches the mint's on-chain decimals — a mismatch raises custom
    //   program error 0x12 (MintDecimalsMismatch) and blocks the transfer.
    //   loadAssets() previously hardcoded decimals (6 for SilicaSTO/Silica,
    //   1 for legacy RWA), which fails whenever the actual mint was deployed
    //   with different decimals (e.g. SilicaSTO with 0 decimals per the
    //   integer-only peg policy).
    const _mintDecimalsCache = new Map();
    const fetchMintDecimals = async (mintAddress) => {
      const key = String(mintAddress || '').trim();
      if (!key) return null;
      if (_mintDecimalsCache.has(key)) return _mintDecimalsCache.get(key);
      try {
        const conn = getConnection();
        const info = await conn.getParsedAccountInfo(new PublicKey(key), 'confirmed');
        const dec = info?.value?.data?.parsed?.info?.decimals;
        if (Number.isInteger(dec) && dec >= 0 && dec <= 18) {
          _mintDecimalsCache.set(key, dec);
          return dec;
        }
      } catch (e) {
        console.warn('[deposit] mint decimals fetch failed for', key, e?.message || e);
      }
      return null;
    };

    const applyOtpUi = () => {
      const area = $("otpArea");
      if (area) area.style.display = otpBypassed ? 'none' : '';
    };

    // (2026-05-26 v825) 입금 hijacking 방어 — allowlist 위반 시 차단 모달.
    //   서버가 반환한 deposit_admin_usdt_address 가 KNOWN_ADMIN_WALLETS 에 없으면
    //   호출. 모달이 떠 있는 동안에는 depositAdminAddress 를 빈 문자열로 강제해
    //   submitDeposit() 의 형식 검증에 걸려 입금 자체가 시도되지 않게 한다.
    let _adminAllowlistBlocked = false;
    const showAdminMismatchModal = (apiAddr) => {
      if (document.getElementById('adminMismatchModal')) return;
      const wrap = document.createElement('div');
      wrap.id = 'adminMismatchModal';
      wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
      wrap.innerHTML = `
        <div style="background:#fff;border:3px solid #dc2626;border-radius:12px;max-width:560px;width:100%;padding:24px;color:#111;box-shadow:0 24px 48px rgba(0,0,0,0.35);font-family:'Space Grotesk',sans-serif">
          <div style="font-size:20px;font-weight:900;color:#dc2626;margin-bottom:12px">⚠ 입금 차단 — 보안 경고</div>
          <div style="font-size:14px;color:#111;line-height:1.6;margin-bottom:16px">
            서버가 알려준 관리자 입금 지갑 주소가 <b>이 사이트 코드에 등록된 알려진 주소</b>와 일치하지 않습니다.
            <br>이 사이트가 변조되었거나, 운영자가 합법적으로 지갑을 교체했을 수 있습니다.
            <br><br>
            <b style="color:#dc2626">절대 입금하지 마시고</b> 공식 채널을 통해 운영자에게 직접 확인 후 진행하세요.
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin-bottom:12px">
            <div style="font-size:11px;color:#991b1b;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">서버가 알려준 주소</div>
            <div class="mono" style="font-size:12px;color:#111;word-break:break-all">${String(apiAddr || '(empty)')}</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin-bottom:16px">
            <div style="font-size:11px;color:#166534;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">알려진 운영 주소 (이 코드 빌드 기준)</div>
            ${KNOWN_ADMIN_WALLETS.map((a) => `<div class="mono" style="font-size:12px;color:#111;word-break:break-all">${a}</div>`).join('')}
          </div>
          <div style="display:flex;justify-content:flex-end">
            <button type="button" id="adminMismatchClose"
              style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:10px 22px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">이해했습니다 (입금 불가)</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      document.getElementById('adminMismatchClose').addEventListener('click', () => {
        wrap.style.display = 'none';
      });
    };
    const checkAdminAllowlist = (apiAddr) => {
      const a = String(apiAddr || '').trim();
      if (!a) return false; // empty 는 별도 처리
      if (!KNOWN_ADMIN_WALLETS.includes(a)) {
        _adminAllowlistBlocked = true;
        depositAdminAddress = ''; // submitDeposit() 의 형식 검증에 걸리도록 비움
        showAdminMismatchModal(a);
        console.error('[deposit] ADMIN ALLOWLIST MISMATCH', { api: a, known: KNOWN_ADMIN_WALLETS });
        return false;
      }
      _adminAllowlistBlocked = false;
      return true;
    };

    const loadConfig = async () => {
      try {
        const cfg = (typeof C.getConfig === 'function')
          ? await C.getConfig()
          : await api('/api/public/config', { auth: false });
        const mintAddr = String(cfg?.usdt_mint || '').trim();
        if (mintAddr) USDT_MINT = new PublicKey(mintAddr);
        USDT_DECIMALS = Number(cfg?.usdt_decimals || 6) || 6;
        SOLANA_NETWORK = String(cfg?.solana_network || 'devnet').trim() || 'devnet';
        const apiAdminAddr = String(cfg?.deposit_admin_usdt_address || '').trim();
        // (2026-05-26 v825) Allowlist 검증 — 통과해야만 depositAdminAddress 세팅.
        //   실패 시 모달이 뜨고 depositAdminAddress 는 빈 문자열로 유지되어
        //   submitDeposit() 단계의 형식 검증에서 차단된다.
        if (checkAdminAllowlist(apiAdminAddr)) {
          depositAdminAddress = apiAdminAddr;
        } else {
          depositAdminAddress = '';
        }
        // SilicaSTO / Silica reward token mints — empty string until admin configures.
        SILICA_STO_MINT = String(cfg?.silica_sto_mint || '').trim();
        SILICA_TOKEN_MINT = String(cfg?.silica_token_mint || '').trim();
        otpBypassed = !!cfg?.bypass_otp;
      } catch (e) {
        console.error('[deposit] config load failed', e);
        otpBypassed = false;
      }
      if (!USDT_MINT) USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
      if ($("depNetwork")) {
        $("depNetwork").textContent = isDevnet() ? 'Devnet' : 'Mainnet';
        $("depNetwork").style.color = isDevnet() ? '#d97706' : '#059669';
      }
      if ($("depAdmin")) $("depAdmin").textContent = depositAdminAddress || '-';
      if ($("btnOpenSolscan")) $("btnOpenSolscan").href = depositAdminAddress ? `https://solscan.io/account/${encodeURIComponent(depositAdminAddress)}${solscanCluster()}` : '#';
      applyOtpUi();
    };

    const loadAssets = async () => {
      const list = [{ id: 'USDT', name: 'USDT', symbol: 'USDT', mint: USDT_MINT.toBase58(), decimals: USDT_DECIMALS, type: 'usdt' }];

      // (2026-05-07) SilicaSTO and Silica reward token — mints come from /api/public/config.
      //   When admin has not configured the mint yet (empty string), we silently skip
      //   the entry so loadAssets() stays robust on a fresh deployment.
      //   decimals is queried from chain via fetchMintDecimals() — hardcoding it
      //   produced custom program error 0x12 (MintDecimalsMismatch) when the
      //   actual mint was deployed with different decimals (e.g. SilicaSTO with
      //   0 decimals per the integer-only peg policy).
      if (SILICA_STO_MINT) {
        const dec = await fetchMintDecimals(SILICA_STO_MINT);
        if (dec === null) {
          console.warn('[deposit] SilicaSTO mint decimals lookup failed, skipping option');
        } else {
          list.push({ id: 'SilicaSTO', name: 'SilicaSTO', symbol: 'SilicaSTO', mint: SILICA_STO_MINT, decimals: dec, type: 'silica_sto' });
        }
      }
      if (SILICA_TOKEN_MINT) {
        const dec = await fetchMintDecimals(SILICA_TOKEN_MINT);
        if (dec === null) {
          console.warn('[deposit] Silica mint decimals lookup failed, skipping option');
        } else {
          list.push({ id: 'Silica', name: 'Silica', symbol: 'Silica', mint: SILICA_TOKEN_MINT, decimals: dec, type: 'silica' });
        }
      }

      try {
        const r = await api('/api/assets', { auth: false });
        const rows = Array.isArray(r?.assets) ? r.assets : (Array.isArray(r?.rows) ? r.rows : []);
        const allowedStatuses = new Set(['분배중', '운영중', '매각']);
        // Legacy RWA tokens — also fetch decimals from chain (parallel) so the
        // transferChecked instruction matches the actual mint metadata.
        const rwaRows = rows.filter((a) => {
          const mint = String(a?.token_mint_address || '').trim();
          const rawStatus = String(a?.status || '').trim();
          const displayStatus = String(a?.display_status || rawStatus).trim();
          if (!mint) return false;
          if (displayStatus === '매각(완료)') return false;
          if (!allowedStatuses.has(rawStatus)) return false;
          return true;
        });
        const rwaDecimals = await Promise.all(rwaRows.map((a) => fetchMintDecimals(String(a.token_mint_address))));
        rwaRows.forEach((a, idx) => {
          const dec = rwaDecimals[idx];
          if (dec === null) {
            console.warn('[deposit] RWA mint decimals lookup failed for', a.id, '— skipping');
            return;
          }
          list.push({
            id: String(a.id),
            name: String(a.name || a.id),
            symbol: String(a.id),
            mint: String(a.token_mint_address),
            decimals: dec,
            type: 'token',
          });
        });
      } catch {}
      assets = list;
      const sel = $("depAsset");
      if (sel) {
        const prev = sel.value;
        // (2026-05-07) Native <select> dropdown — options regenerated from the
        //   configured mint set so SilicaSTO / Silica only appear when admin has
        //   registered their mint addresses. Preserves the previous selection
        //   if it is still in the new list.
        sel.innerHTML = assets.map((a) => {
          const label = a.id === 'USDT' ? 'USDT (Solana)'
            : (a.id === 'SilicaSTO' || a.id === 'Silica') ? a.symbol
            : `${a.symbol} · ${a.name}`;
          return `<option value="${a.id}">${label}</option>`;
        }).join('');
        if (assets.some((a) => a.id === prev)) sel.value = prev;
      }
      await applyAssetUi();
    };

    const applyAssetUi = async () => {
      const a = currentAsset();
      if (!a) return;
      // (2026-05-07) Korean was hardcoded on the deposit button regardless of
      //   page language — "SILICASTO 전송(입금)" leaked onto the English page.
      //   Routed through tL() so the label matches the active language. The
      //   other helpers (depTitle / depDesc / depMintLabel / etc.) target
      //   elements that no longer exist in the Silica deposit.html layout, so
      //   they're safely no-op via the if-guard; left language-aware as well
      //   for future reuse.
      if ($("depTitle")) $("depTitle").textContent = tL(
        a.id === 'USDT' ? '입금(USDT)' : `입금(${a.symbol})`,
        a.id === 'USDT' ? 'Deposit (USDT)' : `Deposit (${a.symbol})`,
        a.id === 'USDT' ? '入金（USDT）' : `入金（${a.symbol}）`,
        a.id === 'USDT' ? '存入（USDT）' : `存入（${a.symbol}）`
      );
      if ($("depDesc")) $("depDesc").textContent = tL(
        a.id === 'USDT'
          ? '팬텀 지갑으로 USDT를 관리자 입금지갑으로 전송하면 잔액이 반영됩니다.'
          : `팬텀 지갑으로 ${a.symbol} 토큰을 관리자 입금지갑으로 전송하면 관리자 승인 후 내 보유 수량에 반영됩니다.`,
        a.id === 'USDT'
          ? 'Send USDT from your Phantom wallet to the admin deposit address — your balance will reflect after confirmation.'
          : `Send ${a.symbol} from your Phantom wallet to the admin deposit address — your holdings will reflect after admin approval.`,
        a.id === 'USDT'
          ? 'Phantom ウォレットから USDT を管理者入金ウォレットへ送信すると残高に反映されます。'
          : `Phantom ウォレットから ${a.symbol} を管理者入金ウォレットへ送信すると、管理者承認後に残高に反映されます。`,
        a.id === 'USDT'
          ? '从 Phantom 钱包向管理员存入地址转账 USDT — 确认后将反映到您的余额。'
          : `从 Phantom 钱包向管理员存入地址转账 ${a.symbol} — 管理员审核后将反映到您的持仓。`
      );
      if ($("depMintLabel")) $("depMintLabel").textContent = `${a.symbol} Mint`;
      if ($("depUsdtMint")) $("depUsdtMint").textContent = a.mint || '-';
      if ($("depAmountLabel")) $("depAmountLabel").textContent = tL(
        a.id === 'USDT' ? '입금할 USDT' : `입금할 ${a.symbol}`,
        `Amount to deposit (${a.symbol})`,
        `入金する ${a.symbol}`,
        `存入 ${a.symbol}`
      );
      if ($("btnDeposit")) $("btnDeposit").textContent = tL(
        `${a.symbol} 입금`,
        `Deposit ${a.symbol}`,
        `${a.symbol} 入金`,
        `存入 ${a.symbol}`
      );
      currentWalletBalance = null;
      await refreshWalletMaxHint().catch(() => {});
    };

    const ensureWalletConnected = async () => {
      const w = getWallet();
      if (w?.connected && w?.address && w?.token) return;
      await connectWallet();
      if (!otpBypassed) await refreshOtpGate();
    };
    const requireMfaOrOpen = async () => {
      if (otpBypassed) return true;
      await refreshOtpGate();
      return isOtpUnlocked();
    };

    const refreshMe = async () => {
      const w = getWallet();
      if ($("myWallet")) $("myWallet").textContent = w?.address || '-';
      if (!(w?.connected && w?.address && w?.token)) {
        if ($("myUsdt")) $("myUsdt").textContent = '-';
        return;
      }
      try {
        const me = await api('/api/me', { auth: true });
        if ($("myUsdt")) $("myUsdt").textContent = me?.usdt != null ? `${fmtNum(me.usdt, 6)} USDT` : '-';
      } catch {
        if ($("myUsdt")) $("myUsdt").textContent = '-';
      }
    };

    const refreshWalletMaxHint = async () => {
      const hint = $("walletMaxHint");
      const a = currentAsset();
      if (!hint || !a) return;
      const w = getWallet();
      // (2026-05-08) 4-lang 분기 — KO 외 모든 locale 에서 한국어 누출 방지.
      const maxButtonHint = tL(
        `최대 버튼은 현재 팬텀 지갑의 ${a.symbol} 보유량 기준으로 입력됩니다.`,
        `The MAX button uses your Phantom wallet ${a.symbol} balance.`,
        `MAXボタンは現在の Phantom ウォレットの ${a.symbol} 保有量を入力します。`,
        `MAX 按钮使用 Phantom 钱包当前 ${a.symbol} 余额。`
      );
      if (!w?.connected || !w?.address) {
        hint.textContent = maxButtonHint;
        return;
      }
      try {
        currentWalletBalance = await getWalletTokenBalance(a.mint);
        if (currentWalletBalance == null) {
          hint.textContent = maxButtonHint;
          return;
        }
        hint.textContent = tL(
          `팬텀 지갑 ${a.symbol} 보유량: ${formatTokenAmount(currentWalletBalance, a.decimals)} ${a.symbol}`,
          `Phantom wallet ${a.symbol} balance: ${formatTokenAmount(currentWalletBalance, a.decimals)} ${a.symbol}`,
          `Phantom ウォレット ${a.symbol} 保有量: ${formatTokenAmount(currentWalletBalance, a.decimals)} ${a.symbol}`,
          `Phantom 钱包 ${a.symbol} 余额：${formatTokenAmount(currentWalletBalance, a.decimals)} ${a.symbol}`
        );
      } catch {
        hint.textContent = maxButtonHint;
      }
    };

    const setAmountToWalletMax = async () => {
      const a = currentAsset();
      await ensureWalletConnected();
      currentWalletBalance = await getWalletTokenBalance(a.mint);
      if (!(Number.isFinite(currentWalletBalance) && currentWalletBalance > 0)) {
        const lang0 = (window.RwaI18n?.lang?.() || 'ko');
        const noBalMsg =
          lang0 === 'en' ? `No depositable ${a.symbol} in your Phantom Wallet.` :
          lang0 === 'ja' ? `Phantom ウォレットに入金可能な ${a.symbol} がありません。` :
          lang0 === 'zh' ? `Phantom 钱包中没有可存入的 ${a.symbol}。` :
          `팬텀 지갑에 입금 가능한 ${a.symbol}가 없습니다.`;
        toast(noBalMsg, 'bad');
        return;
      }
      if ($("amount")) $("amount").value = String(currentWalletBalance);
      await refreshWalletMaxHint().catch(() => {});
      const maxAmt = `${formatTokenAmount(currentWalletBalance, a.decimals)} ${a.symbol}`;
      const lang = (window.RwaI18n?.lang?.() || 'ko');
      const maxMsg =
        lang === 'en' ? `Entered max amount: ${maxAmt}` :
        lang === 'ja' ? `最大金額 ${maxAmt} を入力しました。` :
        lang === 'zh' ? `已输入最大金额 ${maxAmt}。` :
        `최대 금액 ${maxAmt}를 입력했습니다.`;
      toast(maxMsg, 'good');
    };

    // (2026-05-07) 거절(실패) 된 가장 최근 입금의 admin_note 에서 사유 + 관리자 연락처
    //   파싱. admin_deposit.php reject 가 "Reason: <X>\nContact: <Y>" 포맷으로 저장.
    //   legacy 행은 memo 의 "|reject:<요약>" 폴백.
    const escHtml = (s) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const parseRejectInfo = (x) => {
      const note = String(x?.admin_note || '');
      const memo = String(x?.memo || '');
      const src = note || memo;
      if (!src) return null;
      const reasonMatch = src.match(/Reason:\s*([^\n]+)/i);
      const contactMatch = src.match(/Contact:\s*([^\n]+)/i);
      let reason = reasonMatch ? reasonMatch[1].trim() : '';
      if (!reason) {
        const legacy = memo.match(/\|reject:([^|]+)/);
        if (legacy) reason = legacy[1].trim();
      }
      const contact = contactMatch ? contactMatch[1].trim() : '';
      if (!reason && !contact) return null;
      return { reason, contact };
    };

    // (2026-05-07) 거절 알림 dismiss 트래킹 — 사용자가 X 버튼이나 history modal 의
    //   "Don't show again" 체크박스로 닫은 거절 건은 deposit 페이지 배너에서 제외.
    //   localStorage key 는 silica-data-bind.js 와 공유되어 history 모달에서 dismiss
    //   해도 deposit 배너에 즉시 반영된다.
    const REJECT_DISMISS_KEY = 'silica_dismissed_rejects_v1';
    const getDismissedTxIds = () => {
      try {
        const raw = localStorage.getItem(REJECT_DISMISS_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
      } catch (_) { return new Set(); }
    };
    const addDismissedTxId = (id) => {
      const key = String(id || '').trim();
      if (!key) return;
      const set = getDismissedTxIds();
      set.add(key);
      try { localStorage.setItem(REJECT_DISMISS_KEY, JSON.stringify([...set])); } catch (_) {}
    };

    // (2026-05-07) Reject details modal — opened by the banner "View Reason" button.
    //   Includes the "Don't show this notice on the deposit page again" checkbox
    //   per platform owner request. Closing with the checkbox ticked persists the
    //   dismissal so the banner is permanently hidden for that rejection.
    let _depRejectModalEl = null;
    const ensureDepRejectModal = () => {
      if (_depRejectModalEl) return _depRejectModalEl;
      const wrap = document.createElement('div');
      wrap.id = 'depositRejectModal';
      wrap.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;font-family:'Space Grotesk',sans-serif";
      wrap.innerHTML = `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;max-width:480px;width:100%;padding:24px;color:#111;box-shadow:0 24px 48px rgba(0,0,0,0.18)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:18px;font-weight:700;color:#dc2626">Deposit Rejected</div>
            <button type="button" id="depRejX" aria-label="Close"
              style="background:transparent;border:none;color:#6b7280;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px">×</button>
          </div>
          <div style="font-size:13px;color:#6b7280;margin-bottom:16px;line-height:1.5">
            Below is the rejection reason and the administrator contact provided for follow-up.
          </div>
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Reason</div>
            <div id="depRejReason" style="font-size:14px;color:#111;line-height:1.5;word-break:break-word"></div>
          </div>
          <div style="margin-bottom:18px">
            <div style="font-size:11px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Contact admin</div>
            <div id="depRejContact" class="mono" style="font-size:14px;color:#111;word-break:break-all"></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#374151;margin-bottom:18px;cursor:pointer">
            <input type="checkbox" id="depRejDontShow" style="margin:0;width:16px;height:16px">
            <span>Don't show this notice on the deposit page again</span>
          </label>
          <div style="display:flex;justify-content:flex-end;gap:8px">
            <button type="button" id="depRejClose"
              style="background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      const close = () => {
        const cb = wrap.querySelector('#depRejDontShow');
        const txId = wrap.dataset.txId || '';
        if (cb && cb.checked && txId) {
          addDismissedTxId(txId);
          // Hide banner immediately if the dismissed rejection is the one currently shown.
          const box = $('recentRejectBox');
          if (box && box.dataset.txId === txId) box.style.display = 'none';
        }
        wrap.style.display = 'none';
      };
      wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
      wrap.querySelector('#depRejClose').addEventListener('click', close);
      wrap.querySelector('#depRejX').addEventListener('click', close);
      _depRejectModalEl = wrap;
      return wrap;
    };
    const openDepRejectModal = (txId, reason, contact) => {
      const wrap = ensureDepRejectModal();
      wrap.dataset.txId = String(txId || '');
      wrap.querySelector('#depRejReason').textContent = reason || '—';
      wrap.querySelector('#depRejContact').textContent = contact || '—';
      wrap.querySelector('#depRejDontShow').checked = false;
      wrap.style.display = 'flex';
    };

    const renderRecentReject = (allRows) => {
      const box = $('recentRejectBox');
      const meta = $('recentRejectMeta');
      const viewBtn = $('recentRejectViewBtn');
      if (!box) return;
      const dismissed = getDismissedTxIds();
      // 가장 최근(id DESC) 거절된 deposit 중 dismissed 되지 않은 1건만 노출.
      const recentReject = allRows.find((x) => {
        const st = String(x?.status || '').trim();
        const ty = String(x?.type || x?.kind || '').toLowerCase();
        if (st !== '실패') return false;
        if (!(ty === '' || ty.includes('deposit') || ty === '입금')) return false;
        if (dismissed.has(String(x?.id || ''))) return false;
        return true;
      });
      if (!recentReject) {
        box.style.display = 'none';
        return;
      }
      const info = parseRejectInfo(recentReject);
      if (!info) {
        box.style.display = 'none';
        return;
      }
      const asset = String(recentReject.asset || 'USDT');
      const amt = Number(recentReject.amount || 0);
      // Compact banner — full reason / contact only revealed in the modal.
      if (meta) meta.textContent = `${fmtNum(amt, asset === 'USDT' ? 6 : 1)} ${asset} · ${fmtKst(recentReject.created_at)}`;
      // Store everything needed by the modal on the View button as data attrs.
      if (viewBtn) {
        viewBtn.dataset.txId = String(recentReject.id || '');
        viewBtn.dataset.reason = info.reason || '';
        viewBtn.dataset.contact = info.contact || '';
      }
      // Tx id also stored on the banner for the X button quick-dismiss path.
      box.dataset.txId = String(recentReject.id || '');
      box.style.display = '';
    };

    // X dismiss + View Reason — bind once. Both paths add the tx_id to the
    // dismissed set (X immediately, modal only if the checkbox is ticked).
    const _bindRecentRejectControls = () => {
      const closeBtn = $('recentRejectClose');
      if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = '1';
        closeBtn.addEventListener('click', () => {
          const box = $('recentRejectBox');
          const txId = box?.dataset.txId || '';
          if (txId) addDismissedTxId(txId);
          if (box) box.style.display = 'none';
        });
      }
      const viewBtn = $('recentRejectViewBtn');
      if (viewBtn && !viewBtn.dataset.bound) {
        viewBtn.dataset.bound = '1';
        viewBtn.addEventListener('click', () => {
          openDepRejectModal(viewBtn.dataset.txId, viewBtn.dataset.reason, viewBtn.dataset.contact);
        });
      }
    };
    _bindRecentRejectControls();

    // 사용자의 승인 대기 입금 목록 — deposit.html 의 #pendingDepositsList 에 렌더.
    // 승인('입금완료') / 반려('실패') 된 항목은 pending 목록에서 자동 제외.
    // 거절된 가장 최근 행은 #recentRejectBox 에 별도 렌더링 (renderRecentReject).
    const refreshPendingDeposits = async () => {
      const list = $("pendingDepositsList");
      const count = $("pendingDepositsCount");
      if (!list) return;
      const w = getWallet();
      if (!w?.connected || !w?.address || !w?.token) {
        list.innerHTML = `<div class="pending-empty">${tL('지갑 연결 후 표시됩니다.','Visible after wallet connection.','ウォレット接続後に表示されます。','连接钱包后显示。')}</div>`;
        if (count) count.textContent = '';
        const rb = $('recentRejectBox'); if (rb) rb.style.display = 'none';
        return;
      }
      try {
        const r = await api('/api/wallet/transactions?limit=50', { auth: true });
        const all = Array.isArray(r?.transactions) ? r.transactions : (Array.isArray(r?.rows) ? r.rows : []);
        renderRecentReject(all);
        // 승인 대기('대기') + 입금 종류만 필터
        const pending = all.filter((x) => {
          const st = String(x?.status || '').trim();
          if (st !== '대기') return false;
          const ty = String(x?.type || x?.kind || '').toLowerCase();
          if (!ty) return true; // 종류 정보가 없으면 통과 (백엔드가 입금 endpoint 응답)
          return ty.includes('deposit') || ty === '입금';
        });
        if (!pending.length) {
          list.innerHTML = `<div class="pending-empty">${tL('승인 대기중인 입금이 없습니다.','No pending deposits.','承認待ちの入金はありません。','无待审核的存入。')}</div>`;
          if (count) count.textContent = '';
          return;
        }
        list.innerHTML = pending.map((x) => {
          const txid = x.txid ? String(x.txid) : '';
          const txCell = txid
            ? `<a class="mono" target="_blank" rel="noopener" href="https://solscan.io/tx/${encodeURIComponent(txid)}${solscanCluster()}">${short(txid)}</a>`
            : '-';
          const asset = String(x.asset || 'USDT');
          const amt = Number(x.amount || 0);
          const amtFmt = fmtNum(amt, asset === 'USDT' ? 6 : 1);
          return `<div class="pending-deposit-row">
            <div>
              <div class="pending-deposit-amt">${amtFmt} <small>${asset}</small></div>
              <div class="pending-deposit-meta">
                ${fmtKst(x.created_at)} · TX: ${txCell}
              </div>
            </div>
            <div class="pending-deposit-status">⏳ ${tL('승인 대기','Pending','承認待ち','待审核')}</div>
          </div>`;
        }).join('');
        if (count) count.textContent = `${pending.length} ${tL('건','item(s)','件','项')}`;
      } catch (e) {
        list.innerHTML = `<div class="pending-empty">${String(e?.message || tL('불러오기 실패','Failed to load','読み込み失敗','加载失败'))}</div>`;
        if (count) count.textContent = '';
      }
    };

    const refreshTxs = async () => {
      const tb = $("txRows");
      if (!tb) return;
      const w = getWallet();
      if (!w?.connected || !w?.address || !w?.token) {
        tb.innerHTML = `<tr><td colspan="7" class="muted">${tL(
          '지갑 연결 후 입금 내역을 확인할 수 있습니다.',
          'Connect your wallet to view deposit history.',
          'ウォレット接続後に入金履歴を確認できます。',
          '连接钱包后即可查看充值记录。'
        )}</td></tr>`;
        return;
      }
      tb.innerHTML = `<tr><td colspan="7" class="muted">${tL('로딩 중...', 'Loading…', '読み込み中…', '加载中…')}</td></tr>`;
      const ok = await requireMfaOrOpen();
      if (!ok) {
        tb.innerHTML = `<tr><td colspan="7" class="muted">${tL(
          'OTP 인증이 필요합니다.',
          'OTP authentication is required.',
          'OTP認証が必要です。',
          '需要 OTP 验证。'
        )}</td></tr>`;
        return;
      }
      try {
        const r = await api('/api/wallet/transactions?limit=50', { auth: true });
        const rows = Array.isArray(r?.transactions) ? r.transactions : (Array.isArray(r?.rows) ? r.rows : []);
        if (!rows.length) {
          tb.innerHTML = `<tr><td colspan="7" class="muted">${tL(
            '내역이 없습니다.',
            'No history.',
            '履歴がありません。',
            '暂无记录。'
          )}</td></tr>`;
          return;
        }
        // (2026-05-08) Status pill labels — 4-lang. Earlier hardcoded Korean only.
        const pendingPill = `<span style="color:#d97706;font-weight:700">⏳ ${tL('승인대기중', 'Awaiting Approval', '承認待ち', '审核中')}</span>`;
        const completedPill = `<span style="color:#059669;font-weight:700">✓ ${tL('입금완료', 'Deposited', '入金完了', '已充值')}</span>`;
        const rejectedPill = `<span style="color:#dc2626;font-weight:700">✕ ${tL('거절', 'Rejected', '却下', '已驳回')}</span>`;
        const pendingNote = `<br><span style="color:#d97706;font-size:11px">${tL('승인대기중', 'Awaiting approval', '承認待ち', '审核中')}</span>`;
        tb.innerHTML = rows.map((x) => {
          const txid = x.txid ? String(x.txid) : '';
          const txCell = txid ? `<a class="mono" style="color:var(--link);font-weight:900;text-decoration:none" target="_blank" rel="noopener" href="https://solscan.io/tx/${encodeURIComponent(txid)}${solscanCluster()}">${short(txid)}</a>` : '-';
          const st = String(x.status || '-');
          const asset = String(x.asset || 'USDT');
          let statusHtml = st;
          if (st === '대기') statusHtml = pendingPill;
          else if (st === '입금완료') statusHtml = completedPill;
          else if (st === '실패') statusHtml = rejectedPill;
          return `<tr${st === '대기' ? ' style="background:#fffbeb"' : ''}>
              <td>${statusHtml}</td>
              <td>${asset}</td>
              <td class="right mono">${fmtNum(x.amount || 0, asset === 'USDT' ? 6 : 1)}</td>
              <td class="right mono">${st === '대기' ? '-' : fmtNum(x.before_amount || 0, 6)}</td>
              <td class="right mono">${st === '대기' ? '-' : fmtNum(x.after_amount || 0, 6)}</td>
              <td>${txCell}</td>
              <td class="mono">${fmtKst(x.created_at)}${st === '대기' ? pendingNote : ''}</td>
            </tr>`;
        }).join('');
      } catch (e) {
        tb.innerHTML = `<tr><td colspan="7" class="muted">${String(e?.message || tL(
          '불러오기 실패',
          'Failed to load',
          '読み込みに失敗しました。',
          '加载失败'
        ))}</td></tr>`;
      }
    };

    let _overlayLocked = false;
    const setOverlayUI = (mode, msg) => {
      const title = $("txOverlayTitle");
      const text = $("txOverlayMsg");
      const spin = $("txOverlaySpinner");
      const actions = $("txOverlayActions");
      const okBtn = $("txOverlayOk");
      if (title) title.textContent = (mode === 'done')
        ? tL('전송 완료', 'Transfer Complete', '送信完了', '转账完成')
        : tL('전송중', 'Processing', '送信中', '转账中');
      if (text) text.textContent = msg || ((mode === 'done')
        ? tL('전송이 완료되었습니다.', 'Transfer completed.', '送信が完了しました。', '转账已完成。')
        : tL('전송을 처리하고 있습니다. 잠시만 기다려주세요.', 'Processing the transfer. Please wait a moment.', '送信を処理中です。しばらくお待ちください。', '正在处理转账。请稍候。'));
      if (spin) spin.style.display = (mode === 'done') ? 'none' : '';
      if (actions) actions.style.display = (mode === 'done') ? 'flex' : 'none';
      if (mode === 'done' && okBtn) okBtn.focus?.();
    };
    const lockAllInputs = (lock) => {
      _overlayLocked = !!lock;
      document.body.style.overflow = lock ? 'hidden' : '';
      ['btnConnect','btnDeposit','btnRefresh','btnOtpOpen','btnCopyAdmin','btnAmountMax'].forEach((id) => { const el = $(id); if (el) el.disabled = lock; });
      ['amount','depAsset'].forEach((id) => { const el = $(id); if (el) el.disabled = lock; });
    };
    const openTxOverlay = (msg) => {
      const ov = $("txOverlay");
      if (!ov) return;
      setOverlayUI('loading', msg);
      ov.classList.remove('hidden');
      ov.setAttribute('aria-hidden', 'false');
      lockAllInputs(true);
    };
    const closeTxOverlay = () => {
      const ov = $("txOverlay");
      if (!ov) return;
      ov.classList.add('hidden');
      ov.setAttribute('aria-hidden', 'true');
      lockAllInputs(false);
    };
    // (2026-05-17 v438) 운영자 요청: '관리자가 확인하기 이전에 트랜잭션이
    //   확인 되면 이 팝업은 닫혀야한다'. 기존엔 'Transfer Complete' + OK
    //   버튼 표시 후 사용자 클릭 대기 → 사용자가 클릭 안 하면 계속 막힌 상태.
    //   변경: showTxDone 호출 즉시 짧은 시각 피드백 (1.5초) 후 자동 closeTxOverlay
    //   + 잔액/내역 갱신. 그 사이 사용자가 OK 클릭하면 즉시 닫힘 (기존 핸들러).
    let _txDoneCloseTimer = null;
    const showTxDone = (msg) => {
      setOverlayUI('done', msg);
      if (_txDoneCloseTimer) { clearTimeout(_txDoneCloseTimer); _txDoneCloseTimer = null; }
      _txDoneCloseTimer = setTimeout(async () => {
        _txDoneCloseTimer = null;
        closeTxOverlay();
        await refreshMe().catch(() => {});
        await refreshTxs().catch(() => {});
        if (typeof refreshPendingDeposits === 'function') {
          await refreshPendingDeposits().catch(() => {});
        }
      }, 1500);
    };

    $("txOverlayOk")?.addEventListener('click', async () => {
      // 사용자가 OK 를 직접 클릭하면 예약된 자동 닫기 타이머 취소 + 즉시 닫기.
      if (_txDoneCloseTimer) { clearTimeout(_txDoneCloseTimer); _txDoneCloseTimer = null; }
      closeTxOverlay();
      await refreshMe().catch(() => {});
      await refreshTxs().catch(() => {});
    });
    $("txOverlay")?.addEventListener('click', (e) => { if (e?.preventDefault) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (!_overlayLocked) return;
      if (e.key === 'Escape' || e.key === 'Tab') e.preventDefault();
    }, true);

    const getLatestBlockhashFromServer = async () => {
      const r = await api('/api/public/solana/blockhash', { auth: false });
      const bh = String(r?.blockhash || '').trim();
      if (!bh) throw new Error('blockhash 조회 실패');
      return bh;
    };
    const postJsonWithDetail = async (path, bodyObj) => {
      const base = String(localStorage.getItem(STORAGE.apiBase) || '').trim();
      const url = `${base}${path}`;
      const w = getWallet();
      const headers = { 'Content-Type': 'application/json' };
      if (w?.token) headers.Authorization = `Bearer ${w.token}`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(bodyObj || {}), credentials: 'omit' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) {
        let msg = j.message || `요청 실패 (${res.status})`;
        if (j.reason) msg += ` [reason: ${j.reason}]`;
        const err = new Error(msg);
        err.status = res.status;
        err.detail = j.detail;
        err.reason = j.reason;
        err.txid = j.txid;
        err.serverResponse = j; // (v869) 풀 응답 — 진단 패널에서 사용
        // (v869) 자동 펼치기 — 운영자가 콘솔에서 클릭할 필요 없음.
        try {
          console.groupCollapsed('[deposit] server error — click to expand');
          console.error('status:', res.status);
          console.error('reason:', j.reason);
          console.error('message:', j.message);
          console.error('detail:', j.detail);
          console.error('full response:', j);
          console.groupEnd();
        } catch (_) {
          console.error('[deposit] server error:', j);
        }
        throw err;
      }
      return j;
    };

    // (v869) 진단 detail 을 사람이 읽기 쉬운 HTML 로 변환.
    //   expected_mint / actual_mint 같은 expected/actual 쌍을 강조하여 표시.
    const renderErrorDetailHtml = (detail) => {
      if (!detail || typeof detail !== 'object') return '';
      const rows = [];
      const keys = Object.keys(detail);
      if (keys.length === 0) return '';
      for (const k of keys) {
        const v = detail[k];
        const isHint = k === 'hint';
        const valStr = (v === null || v === undefined) ? '-'
          : (typeof v === 'object' ? JSON.stringify(v) : String(v));
        const safeKey = String(k).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        const safeVal = valStr.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        if (isHint) {
          rows.push(`<div style="margin-top:8px;padding:8px 10px;background:#fef3c7;border-left:3px solid #f59e0b;font-size:12px;color:#78350f;line-height:1.5">💡 ${safeVal}</div>`);
        } else {
          rows.push(`<div style="display:flex;gap:8px;font-family:monospace;font-size:11.5px;margin-bottom:3px"><span style="min-width:170px;color:#6b7280">${safeKey}</span><span style="color:#111827;word-break:break-all">${safeVal}</span></div>`);
        }
      }
      return rows.join('');
    };

    // 연속 클릭 / 더블 제출 차단을 위한 in-flight 가드.
    // openTxOverlay() 가 lockAllInputs(true) 를 부르기 전 await 윈도우에서
    // 사용자가 다시 클릭하면 두 번째 submit 이 시작될 수 있으므로
    // 함수 진입 즉시 _busy 플래그 + 버튼 disabled 처리한다.
    let _submitBusy = false;
    const submitDeposit = async () => {
      if (_submitBusy) return;
      _submitBusy = true;
      const depositBtn = $("btnDeposit");
      if (depositBtn) depositBtn.disabled = true;
      try {
        await _submitDepositInner();
      } finally {
        _submitBusy = false;
        if (depositBtn) depositBtn.disabled = false;
      }
    };

    const _submitDepositInner = async () => {
      // (2026-06-17 v925) 미연결 시 공통 지갑연결 모달 + 입금 중단.
      //   기존 ensureWalletConnected()=connectWallet() 직접호출은 취소해도 진행되어
      //   미연결 입금 플로우가 이어지는 문제 → requireWalletConnected 로 차단.
      if (!window.RwaCore.requireWalletConnected()) return;
      const a = currentAsset();
      await ensureWalletConnected();
      const ok = await requireMfaOrOpen();
      if (!ok) return;
      const amountStr = String($("amount")?.value || '').trim();
      const amountNum = Number(amountStr);
      if (!(Number.isFinite(amountNum) && amountNum > 0)) { toast(tL('입금 금액을 입력하세요.', 'Enter deposit amount.', '入金金額を入力してください。', '请输入存入金额。'), 'bad'); return; }
      if (!Number.isInteger(amountNum) || !/^\d+$/.test(amountStr)) {
        toast(tL('입금액은 정수만 입력 가능합니다.', 'Deposit amount must be an integer.', '入金額は整数のみ入力可能です。', '存入金额只能为整数。'), 'bad');
        return;
      }
      // (2026-05-26 v825) Allowlist 차단 상태 재확인 — 모달은 비동기로 닫힐 수 있어 belt-and-suspenders.
      if (_adminAllowlistBlocked) {
        toast('관리자 입금지갑 주소가 알려진 주소와 일치하지 않아 입금이 차단되었습니다.', 'bad');
        return;
      }
      if (!depositAdminAddress || !isSolanaAddressLike(depositAdminAddress)) { toast('관리자 입금지갑주소 형식 오류', 'bad'); return; }
      // (2026-05-26 v825) 한 번 더 명시적으로 allowlist 재확인 (변조 방지).
      if (!KNOWN_ADMIN_WALLETS.includes(depositAdminAddress)) {
        showAdminMismatchModal(depositAdminAddress);
        toast('관리자 입금지갑 주소 검증 실패', 'bad');
        return;
      }
      if (!window.solana?.isPhantom) { toast('Phantom 지갑이 필요합니다.', 'bad'); return; }
      const provider = window.solana;
      if (!provider.publicKey) await provider.connect();
      const walletPk = provider.publicKey;
      const myAddr = String(getWallet()?.address || '').trim();
      if (myAddr && walletPk?.toBase58 && walletPk.toBase58() !== myAddr) { toast('Phantom 지갑 계정이 로그인 지갑과 다릅니다.', 'bad'); return; }
      if (myAddr && myAddr === depositAdminAddress) { toast('관리자 입금지갑이 내 지갑과 동일합니다.', 'bad'); return; }
      const adminPk = new PublicKey(depositAdminAddress);
      const mintPk = new PublicKey(a.mint);
      const fromATA = findATA(walletPk, mintPk);
      const toATA = findATA(adminPk, mintPk);
      if (fromATA.toBase58() === toATA.toBase58()) {
        toast(tL('내 토큰 계정과 관리자 토큰 계정이 동일합니다.',
          'Your token account is the same as the admin token account.',
          '自分のトークンアカウントと管理者のトークンアカウントが同一です。',
          '您的代币账户与管理员代币账户相同。'), 'bad');
        return;
      }
      const amtBig = toAmountBigInt(amountStr, a.decimals);
      if (amtBig <= 0n) {
        toast(tL('금액 오류', 'Invalid amount', '金額エラー', '金额错误'), 'bad');
        return;
      }

      openTxOverlay(tL(
        '전송을 처리하고 있습니다. 지갑 팝업/승인 후 잠시만 기다려주세요.',
        'Processing the transfer. Please wait after approving in the wallet popup.',
        '送信を処理中です。ウォレットのポップアップ/承認後、しばらくお待ちください。',
        '正在处理转账。请在钱包弹窗/确认后稍候。'));
      const lastTx = $("lastTx");
      if (lastTx) lastTx.textContent = tL('전송/반영 중...', 'Sending / updating...', '送信/反映中...', '发送/更新中...');
      try {
        const blockhash = await getLatestBlockhashFromServer();
        const tx = new Transaction({ feePayer: walletPk, recentBlockhash: blockhash });
        tx.add(makeMemoIx(`RWA_DEPOSIT_${a.id}|to:${depositAdminAddress}`));
        tx.add(createATAIxIdempotent(walletPk, toATA, adminPk, mintPk));
        tx.add(makeSplTransferCheckedIx(fromATA, mintPk, toATA, walletPk, amtBig, a.decimals));
        const signed = await provider.signTransaction(tx);
        const rawB64 = u8ToBase64(signed.serialize());
        // (2026-05-26 v825) amount_raw 추가 — 서버측 validateDepositTransactionStructure 가
        //   transferChecked.amount 와 cross-check 하여 UI 표시 금액과 서명 금액의
        //   swap 공격 (UI 는 100, 서명은 1000) 도 차단한다.
        const r = await postJsonWithDetail('/api/deposit/submit', {
          signedTxBase64: rawB64,
          memo: 'deposit',
          asset: a.id,
          amount_raw: amtBig.toString(),
        });
        const txid = r.txid || '';
        const lang2 = (window.RwaI18n?.lang?.() || 'ko');
        const sentLabel =
          lang2 === 'en' ? `${a.symbol} transfer complete (pending approval)` :
          lang2 === 'ja' ? `${a.symbol} 送信完了（承認待ち）` :
          lang2 === 'zh' ? `${a.symbol} 转账完成（等待审核）` :
          `${a.symbol} 전송완료 (승인대기)`;
        if (lastTx) {
          lastTx.innerHTML = txid
            ? `${sentLabel}: <a class="mono" target="_blank" rel="noopener" href="https://solscan.io/tx/${encodeURIComponent(txid)}${solscanCluster()}" style="color:var(--link);font-weight:900;text-decoration:none">${short(txid)}</a>`
            : sentLabel;
        }
        await refreshMe().catch(() => {});
        await refreshTxs().catch(() => {});
        await refreshPendingDeposits().catch(() => {});
        const doneMsg =
          lang2 === 'en' ? `${a.symbol} transfer completed. It will be reflected after admin approval.` :
          lang2 === 'ja' ? `${a.symbol} の送信が完了しました。管理者承認後に反映されます。` :
          lang2 === 'zh' ? `${a.symbol} 转账已完成。将在管理员审核后反映。` :
          `${a.symbol} 전송이 완료되었습니다. 관리자 승인 후 반영됩니다.`;
        const toastMsg =
          lang2 === 'en' ? `${a.symbol} transfer complete — Pending Approval` :
          lang2 === 'ja' ? `${a.symbol} 送信完了 — 承認待ち` :
          lang2 === 'zh' ? `${a.symbol} 转账完成 — 等待审核` :
          `${a.symbol} 전송 완료 — 관리자 승인 대기중`;
        showTxDone(doneMsg);
        toast(toastMsg, 'good');
      } catch (e) {
        // (v871) 진단 카드 영역 — 별도 visible div (#depositErrorPanel) 에 그림.
        //   이전 (v848~v870) 에는 #lastTx (display:none span) 에 append 했으나
        //   부모가 hidden 이라 운영자 화면에 안 보였음 (가장 큰 버그).
        //   v871 부터 visible div 에 표시 + scrollIntoView 로 운영자가 못 놓침.
        const failLabel = tL('실패', 'Failed', '失敗', '失败');
        const panel = document.getElementById('depositErrorPanel');
        if (panel) {
          panel.style.display = 'block';
          panel.style.cssText =
            'display:block;margin-top:14px;padding:14px 16px;' +
            'border:2px solid #ef4444;background:#fef2f2;border-radius:10px;' +
            'color:#7f1d1d;font-size:13px;line-height:1.6;word-break:break-all;' +
            'box-shadow:0 4px 12px rgba(239,68,68,0.15);';

          const headerParts = [];
          headerParts.push('<div style="font-weight:800;font-size:14px;margin-bottom:8px;">❌ ' + failLabel + '</div>');
          headerParts.push('<div style="margin-bottom:4px;">' + String(e?.message || failLabel) + '</div>');
          if (e?.reason) headerParts.push('<div style="font-family:monospace;font-size:12px;color:#991b1b;margin-top:6px;">reason: <b>' + e.reason + '</b></div>');
          if (e?.status) headerParts.push('<div style="font-family:monospace;font-size:12px;color:#991b1b;">HTTP ' + e.status + '</div>');
          if (e?.txid)   headerParts.push('<div style="font-family:monospace;font-size:12px;color:#991b1b;">txid: ' + e.txid + '</div>');

          var html = headerParts.join('');

          // (v869) detail (expected/actual) — 표 형식
          var detailObj = e?.detail;
          var detailHtml = renderErrorDetailHtml(detailObj);
          if (detailHtml) {
            html += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed #fca5a5;">'
                  + '<div style="font-weight:700;font-size:12px;color:#7f1d1d;margin-bottom:8px">📊 진단 / Diagnostics</div>'
                  + detailHtml
                  + '</div>';
          }
          // (v870) Raw JSON dump — fallback / 전체 응답 확인
          var raw = e?.serverResponse;
          if (raw && typeof raw === 'object') {
            var rawStr = '';
            try { rawStr = JSON.stringify(raw, null, 2); } catch (_) { rawStr = String(raw); }
            var safeRaw = rawStr.replace(/[<>&]/g, function (c) { return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]; });
            html += '<details open style="margin-top:12px;padding-top:10px;border-top:1px dashed #fca5a5">'
                  + '<summary style="font-weight:700;font-size:11px;color:#7f1d1d;cursor:pointer">📋 Raw server response (click to collapse)</summary>'
                  + '<pre style="margin-top:6px;padding:10px;background:#fff;border:1px solid #fecaca;border-radius:6px;font-size:10.5px;color:#374151;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-all">'
                  + safeRaw
                  + '</pre>'
                  + '</details>';
          }
          // (v871) 닫기 버튼 — 운영자가 진단 후 카드 닫음
          html += '<div style="margin-top:10px;text-align:right;">'
                + '<button type="button" onclick="document.getElementById(\'depositErrorPanel\').style.display=\'none\'" '
                + 'style="padding:4px 12px;border:1px solid #fca5a5;background:#fff;color:#7f1d1d;border-radius:6px;font-size:12px;cursor:pointer;">닫기</button>'
                + '</div>';

          panel.innerHTML = html;
          // 운영자가 못 놓치도록 스크롤 이동.
          try { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        }
        // (v871) toast 도 reason 강조 + program_id 잘림 노출 (운영자가 빨리 식별).
        var toastMsg = String(e?.message || tL('전송 실패', 'Transfer failed', '送信失敗', '转账失败'));
        try {
          var rpid = e?.detail?.rejected_program_id;
          if (rpid && typeof rpid === 'string') {
            toastMsg += ' · prog ' + rpid.slice(0, 8) + '…' + rpid.slice(-4);
          }
        } catch (_) {}
        toast(toastMsg, 'bad');
        closeTxOverlay();
      }
    };

    $("btnConnect")?.addEventListener('click', async () => {
      try { await ensureWalletConnected(); await refreshMe(); await loadConfig(); await loadAssets(); await refreshTxs(); toast(tL('연결 완료', 'Connected', '接続完了', '已连接'), 'good'); }
      catch (e) { toast(e?.message || tL('실패','Failed','失敗','失败'), 'bad'); }
    });
    $("btnRefresh")?.addEventListener('click', async () => {
      try { await refreshMe(); await loadConfig(); await loadAssets(); await refreshTxs(); toast(tL('갱신 완료', 'Refreshed', '更新完了', '已刷新'), 'good'); }
      catch (e) { toast(e?.message || tL('실패','Failed','失敗','失败'), 'bad'); }
    });
    $("btnOtpOpen")?.addEventListener('click', async () => {
      try { await ensureWalletConnected(); await refreshOtpGate(); }
      catch (e) { toast(e?.message || tL('실패','Failed','失敗','失败'), 'bad'); }
    });
    $("btnAmountMax")?.addEventListener('click', async () => {
      try { await setAmountToWalletMax(); } catch (e) { toast(e?.message || tL('최대 금액 조회 실패', 'Failed to fetch max amount', '最大金額取得失敗', '获取最大金额失败'), 'bad'); }
    });
    $("btnCopyAdmin")?.addEventListener('click', async () => {
      const dep = String($("depAdmin")?.textContent || '').trim();
      if (!dep || dep === '-') return;
      try { await navigator.clipboard.writeText(dep); toast(tL('복사되었습니다.', 'Copied.', 'コピーしました。', '已复制。'), 'good'); }
      catch { toast(tL('복사 실패', 'Copy failed', 'コピー失敗', '复制失败'), 'bad'); }
    });
    $("btnDeposit")?.addEventListener('click', submitDeposit);
    $("depAsset")?.addEventListener('change', async () => { await applyAssetUi(); });

    // ── #amount 입력 실시간 안전화 (음수 / 소수점 / 지수 차단) ──
    // assets.html 의 invest 폼과 동일한 정책: 정수만 허용.
    // type="number" 가 아닌 type="text" + sanitizer 조합이 가장 안전 (브라우저별
    // -, e, e+1 등 우회 경로를 모두 막는다).
    const amountInputEl = $("amount");
    if (amountInputEl && !amountInputEl.dataset.sanitizerBound) {
      amountInputEl.dataset.sanitizerBound = "1";
      const sanitizeAmount = () => {
        const raw = String(amountInputEl.value || "");
        const cleaned = raw.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
        if (cleaned !== raw) {
          amountInputEl.value = cleaned;
          try { amountInputEl.setSelectionRange(cleaned.length, cleaned.length); } catch (_) {}
        }
      };
      amountInputEl.addEventListener("input", sanitizeAmount);
      amountInputEl.addEventListener("paste", () => setTimeout(sanitizeAmount, 0));
      amountInputEl.addEventListener("blur", sanitizeAmount);
      amountInputEl.addEventListener("keydown", (e) => {
        // 음수 / 소수점 / 지수 / 부호 키 차단 (네비게이션 키는 허용)
        if (["-", "+", ".", "e", "E"].includes(e.key)) {
          e.preventDefault();
        }
      });
    }

    await loadConfig().catch(() => {});
    await loadAssets().catch(() => {});
    await refreshMe().catch(() => {});
    await refreshTxs().catch(() => {});
    await refreshPendingDeposits().catch(() => {});
    await refreshWalletMaxHint().catch(() => {});

    // 승인/반려 즉시 반영을 위해 30초마다 pending 목록 폴링
    // (페이지가 visible 일 때만 실행 — 백그라운드 탭 트래픽 절약)
    if (!window._silicaPendingPollBound) {
      window._silicaPendingPollBound = true;
      setInterval(() => {
        if (document.visibilityState === 'visible') {
          refreshPendingDeposits().catch(() => {});
        }
      }, 30000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          refreshPendingDeposits().catch(() => {});
        }
      });
    }
  };
})();
