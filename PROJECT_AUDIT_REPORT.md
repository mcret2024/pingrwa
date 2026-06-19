# SilicaChain / RWA Project Audit Report

Date: 2026-06-07
Post-pull update: 2026-06-10, after fast-forwarding `main` from `fac96e0` to `3e4f027` (`origin/main`, 44 commits).
Scope: practical engineering and security audit of the local repository. This is not a formal legal, financial, or compliance certification.

## Executive Summary

Overall risk rating: **High** for production use until the admin authorization gaps, public-triggered financial jobs, deploy artifact exposure, and operational migration strategy are tightened.

The project is a PHP 8/MySQL API with a hand-rolled router, static admin/user frontends, Solana transaction helpers, SQL schema files, and shared-hosting deployment assets. The codebase shows substantial security work already: prepared SQL usage is common, PHP syntax is clean, upload hardening exists for several paths, CORS is allowlist-based, critical secrets are checked at boot, and some high-risk admin routes have been migrated from `adminAuth()` to `adminOnly()`.

The biggest remaining risks are uneven admin authorization enforcement, schema drift from multiple auto-migration paths, unauthenticated public requests that can trigger monthly interest accrual, wallet-login nonce replay within the nonce TTL, deployable preview/backup artifacts, an unsafe document upload path, disabled/no-op rate limiting on hosts without APCu, and production checklist drift across env examples and docs.

## Post-Pull Comparison - 2026-06-10

Pulled code range:
- Fast-forwarded `main` from `fac96e0` to `3e4f027` (`v860` through `v904`).
- Major pulled areas: Solana RPC/network handling, deposit transaction diagnostics, `interest_claims` uniqueness migration, contract PDF generation, upload serving through `/api/file/:name`, admin UI changes, and production checklist edits.

Audit items that appear improved:
- **Interest duplicate race partially fixed:** `php-api/lib/db.php` now attempts to add `ux_ic_addr_asset_month` on `interest_claims(address, asset_id, month_key)` (`php-api/lib/db.php:867`), and `sql/manual_add_interest_claims_unique_v900.sql` documents the manual pre-check and `ALTER TABLE`. This mitigates the double-insert race discussed in the 15th payout audit, assuming production DB has no existing duplicates and the index is actually present.
- **Production checklist improved:** `PRODUCTION_CHECKLIST.md` now includes `CRON_KEY` regeneration and Hostinger cron checks, plus an explicit `interest_claims` unique-index production item.
- **Solana deposit validation improved:** `validateDepositTransactionStructure()` still enforces exact fee payer, mint, derived admin ATA destination, owner, decimals, amount, and exactly one `transferChecked`, while adding controlled allowances for Compute Budget, Token-2022, and Lighthouse assertion programs (`php-api/lib/solana.php:560`). This is compatible with the earlier funds-flow finding and does not introduce a first-party Solana program.
- **Contract PDF generation uses safer defaults:** the new dompdf path disables remote fetching and sets `chroot` to `UPLOAD_DIR` (`php-api/lib/pdf.php:106`). Signature paths are reduced to `basename()` before reading from `UPLOAD_DIR`.

Audit items still open after the pull:
- **C1 remains open:** high-impact routes still call `adminAuth()` instead of `adminOnly()`, including deposit admin routes, rate changes, and the new contract PDF regeneration/admin-sign flow (`php-api/routes/admin_deposit.php`, `php-api/routes/admin_silica_rate.php`, `php-api/routes/admin_contracts.php:103`, `php-api/routes/admin_contracts.php:119`).
- **H1 remains open:** the asset document upload path still needs the stricter PDF-only validation and `move_uploaded_file()` success handling.
- **H3 remains open:** rate limiting still depends on APCu and can be a no-op on shared hosting.
- **H4 remains open:** root `.env.example` still sets `BYPASS_OTP=1` and `BYPASS_KYC=1` even though `php-api/.env.example` uses safer `0` defaults.
- **H5/H6 remain open:** admin JWTs are still in `localStorage`, and wallet login nonce consumption was not changed.
- **H7 remains open:** `/api/public/config` still registers `lazyTryMonthlyInterestAccrual`, so unauthenticated public reads can trigger monthly accrual (`php-api/routes/public.php:14`).
- **H8 remains open:** `_backup/`, `_manual_build/`, `preview-router.php`, and preview pages still exist in the deploy tree, and root `.htaccess` still serves real files/directories before API routing.
- **H9 remains open:** no first-party Solana program was added. Funds still move through standard SPL transfers to/from admin-controlled wallets, while staking, interest, dividends, swaps, and liabilities remain database-ledger operations.
- **H10 remains open:** `runMonthlyInterestBatch()` still writes `cron_accrual_done_{YYYY-MM}` after counting per-holder failures (`php-api/routes/staking.php:1751`, `php-api/routes/staking.php:1763`). A partial failure can still be hidden behind the monthly done lock.
- **H11 remains open:** monthly interest still selects `holdings.staked_token > 0`, while dividend distribution uses `holdings.silica_sto_staked > 0` (`php-api/routes/staking.php:1715`, `php-api/routes/admin_silica_dividend.php:621`).
- **H12 remains open:** dividend cron still updates `dividend_executions.status='paid'` even if all rounded per-user `silicaAmount` values are skipped and `recipients` remains `0` (`php-api/routes/admin_silica_dividend.php:664`, `php-api/routes/admin_silica_dividend.php:686`).
- **H13 remains open:** payment-delay detection still requires previous-month `interest_claims`, so the first failed production interest month can be missed (`php-api/lib/silica.php:405`).
- **M1/M5 remain open:** public config still exposes bypass flags, and neither `.env.example` nor `php-api/.env.example` contains a `CRON_KEY=` entry despite docs/checklist mentioning it.

New or changed risks introduced by the pulled code:
- **New High - unauthenticated upload diagnostics disclose operational file data.** `/api/file/diagnose` is public and returns `UPLOAD_DIR`, public/deploy upload paths, writability, permissions, PHP user, file count, and sample filenames (`php-api/routes/public.php:301`). `/api/file/:name` also returns verbose debug details on errors, including full paths and sample upload names (`php-api/routes/public.php:341`, `php-api/routes/public.php:379`). This is useful during deployment but should be admin-only or disabled in production.
- **New Medium - contract PDF rendering trusts stored contract HTML.** `generateContractPdf()` injects stored `contract_body_html` directly into the PDF HTML (`php-api/lib/pdf.php:37`, `php-api/lib/pdf.php:85`). Remote fetching is disabled, which is good, but malformed or hostile stored HTML/CSS can still affect generated contract content. Treat contract templates as privileged admin content, keep PDF regeneration behind `adminOnly()`, and consider a template sanitizer/allowlist.
- **New Medium - schema-status text is stale/conflicting.** `php-api/lib/db.php` and `PRODUCTION_CHECKLIST.md` now expect `ux_ic_addr_asset_month`, but `/api/admin/staking/schema-status` still reports policy `no_unique (testBtn 의도된 중복 허용)` and comments that `has_ux_addr_asset_month=false` is normal (`php-api/routes/staking.php:1928`). This can mislead operators during production verification.
- **Changed deployment posture - `uploads/.htaccess` was deleted.** The new root rewrite sends single-segment `/uploads/<file>` requests to `/api/file/<file>` before real-file serving (`.htaccess:52`). That improves survivability when uploads live outside the deploy tree, but it also makes the PHP file-serving route the primary security boundary. Keep `UPLOAD_DIR` outside public web root, restrict diagnostics, and consider restoring upload-directory defense in depth for any environment where `uploads/` exists under web root.

15th-of-month audit conclusion after pull:
- The pull does not yet make the monthly interest/dividend process safe enough to trust without manual reconciliation. On every 15th KST run, operators should still verify that `cron_accrual_done_{YYYY-MM}` was set only after `holder_failed=0`, compare eligible stakers from `staked_token` and `silica_sto_staked`, confirm `interest_claims` rows exist for every eligible holder/asset/month, confirm `dividend_payouts` has pending rows for every expected recipient, and reject any dividend execution with `recipient_count=0` unless there is a documented cancellation/zero-payout decision.

## System Overview

- Backend: PHP API router in `php-api/index.php`, libraries in `php-api/lib/`, routes in `php-api/routes/`.
- Frontend: static admin pages under `admin/`; static user pages and JS under `user/`.
- Data layer: baseline `rwa.sql` plus multiple manual SQL patches in `sql/`; additional runtime DDL in `php-api/lib/db.php`, route helpers, and `php-api/lib/migrations.php`.
- Dependencies: Composer manifest in `php-api/composer.json`; vendored Composer packages are checked in under `php-api/vendor/`.
- Deployment: Apache `.htaccess`, Hostinger-oriented docs, upload hardening via `uploads/.htaccess`.

## Backend, Solana, and Funds Flow

Backend presence:
- Yes. The project has a first-party PHP REST backend under `php-api/`, with route handlers in `php-api/routes/`, shared libraries in `php-api/lib/`, a MySQL schema in `rwa.sql`, and migration patches in `sql/`.
- Auth, KYC, OTP, admin actions, deposit verification, withdrawal request management, staking, interest claims, dividend claims, swaps, and operational cron handlers are all backend-mediated.

Solana program presence:
- No first-party Anchor/Rust/Solana program was found in this repository. Targeted file discovery did not find `Anchor.toml`, Rust program sources, or a `programs/` tree.
- Solana involvement is through standard programs and RPC: SPL Token (`Tokenkeg...`), Associated Token Account (`AToken...`), Memo (`MemoSq4...`), and optional Compute Budget (`ComputeBudget...`) constants are defined in `php-api/lib/config.php`.
- Token creation is documented as an external Solana CLI step using `spl-token create-token`; the admin panel stores externally created mint addresses after deployment (`README.md:105`, `README.md:114`, `DEPLOY_SILICA.md:118`, `DEPLOY_SILICA.md:127`).
- `php-api/lib/solana.php` handles base58, wallet signature verification, transaction parsing, ATA derivation, RPC calls, transaction broadcast, and parsed transaction verification. It is not a Solana smart contract.

Custody model:
- On-chain custody appears centralized. User deposits go from the user's Phantom wallet to the configured admin deposit wallet's token account. The backend then records a pending ledger entry, and an admin approval credits the user's internal DB balance or holding.
- Withdrawals reverse the process operationally: the user's internal DB balance/holding is debited when a withdrawal request is created, then an admin Phantom wallet signs an outbound SPL token transfer back to the user's wallet, and the backend broadcasts/verifies the signed transaction.
- Staking, unstaking, interest accrual, dividend payout records, dividend claims, swaps, and referral bonus claims are internal database ledger operations. They do not call a first-party Solana program and do not by themselves move on-chain tokens.

Primary funds flow:
- **User USDT/token deposit:** user page builds an SPL `transferChecked` transaction from the user's Phantom wallet to the admin deposit wallet ATA (`user/assets/js/pages/deposit.js:91`, `user/assets/js/pages/deposit.js:959`). The PHP backend parses and validates the signed transaction before broadcasting (`php-api/routes/deposit_withdraw.php:118`, `php-api/routes/deposit_withdraw.php:155`). If chain verification finds a positive admin-wallet delta, it records `wallet_transactions.kind='deposit'` with status `대기` (`php-api/routes/deposit_withdraw.php:255`, `php-api/routes/deposit_withdraw.php:262`). Admin approval then credits `balances.usdt`, `holdings.silica_sto_balance`, `holdings.silica_balance`, or legacy `holdings.balance_token` (`php-api/routes/admin_deposit.php:177`, `php-api/routes/admin_deposit.php:215`).
- **User USDT withdrawal:** user request debits internal `balances.usdt` and creates `withdraw_requests.status='pending'` plus a `wallet_transactions.kind='withdraw'` row (`php-api/routes/deposit_withdraw.php:346`, `php-api/routes/deposit_withdraw.php:366`, `php-api/routes/deposit_withdraw.php:391`). The admin UI builds and Phantom-signs a USDT SPL transfer from the admin wallet ATA to the user's ATA (`admin/js/withdrawals.js:738`, `admin/js/withdrawals.js:748`). The backend broadcasts the signed transaction and marks the request/ledger complete with the txid (`php-api/routes/admin_withdraw.php:507`, `php-api/routes/admin_withdraw.php:539`, `php-api/routes/admin_withdraw.php:548`).
- **User token withdrawal:** user request debits internal token holdings and, when needed, USDT fee balance (`php-api/routes/token_withdraw.php:159`, `php-api/routes/token_withdraw.php:178`). The admin UI fetches the mint/request details, builds a Phantom-signed SPL token transfer, and sends `signedTxBase64` to the backend (`admin/js/token-withdrawals.js:674`, `admin/js/token-withdrawals.js:702`, `admin/js/token-withdrawals.js:739`). The backend broadcasts it and marks the token withdrawal done (`php-api/routes/admin_token_withdraw.php:1255`, `php-api/routes/admin_token_withdraw.php:1287`, `php-api/routes/admin_token_withdraw.php:1299`).
- **Staking/unstaking:** staking moves internal SilicaSTO from idle to staked columns without chain movement (`php-api/routes/staking.php:747`, `php-api/routes/staking.php:766`). Unstaking moves internal staked balance back to idle (`php-api/routes/staking.php:845`, `php-api/routes/staking.php:864`).
- **Interest claims:** monthly accrual creates `interest_claims` rows, and user claim credits internal `balances.usdt` and marks those rows claimed (`php-api/routes/staking.php:530`, `php-api/routes/staking.php:578`, `php-api/routes/staking.php:585`).
- **Dividend claims:** admin/cron payout creates pending `dividend_payouts` rows rather than immediately crediting users (`php-api/routes/admin_silica_dividend.php:832`, `php-api/routes/admin_silica_dividend.php:842`). User claim credits internal `holdings.silica_balance` and writes a `dividend_claim` ledger row (`php-api/routes/admin_silica_dividend.php:1010`, `php-api/routes/admin_silica_dividend.php:1068`, `php-api/routes/admin_silica_dividend.php:1080`).
- **Swap:** swaps are internal ledger conversions from `holdings.silica_balance` to `holdings.silica_sto_balance`, with an optional USDT fee debited from `balances.usdt` (`php-api/routes/swap.php:255`, `php-api/routes/swap.php:327`, `php-api/routes/swap.php:335`).

Where funds go:
- Real on-chain deposits go to the configured `deposit_admin_usdt_address` and its ATAs for the selected mint. The baseline/frontend allowlist currently names `BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu` as the known admin deposit wallet (`user/assets/js/pages/deposit.js:25`, `user/assets/js/pages/deposit.js:27`).
- Real on-chain withdrawals leave whichever admin Phantom wallet signs the withdrawal transaction in the admin UI. For token withdrawals, the code explicitly allows a sending wallet that is different from the configured admin wallet, relying on Phantom/RPC balance checks (`php-api/routes/admin_token_withdraw.php:1215`, `php-api/routes/admin_token_withdraw.php:1220`).
- Internal accounting funds go to MySQL rows: USDT in `balances.usdt`, SilicaSTO/Silica in `holdings`, accrual obligations in `interest_claims`, dividend obligations in `dividend_payouts`, and history/audit rows in `wallet_transactions` and `silica_audit_log`.

## Critical Findings

### C1. Admin authorization policy is inconsistent across high-impact write endpoints

Evidence:
- `adminAuth()` only validates an admin JWT and returns the username; it does not enforce `ADMIN_WALLET_ADDRESSES`, `X-Admin-Wallet`, or `ADMIN_KEY` fallback behavior (`php-api/lib/auth.php:331`).
- `adminOnly()` implements JWT/API-key auth, optional wallet whitelist enforcement, and opt-in wallet checks for selected on-chain routes (`php-api/lib/auth.php:369`, `php-api/lib/auth.php:396`, `php-api/lib/auth.php:445`).
- Several sensitive mutations still call `adminAuth()` directly, including deposit approval/rejection (`php-api/routes/admin_deposit.php:146`, `php-api/routes/admin_deposit.php:246`, `php-api/routes/admin_deposit.php:338`), interest rate changes (`php-api/routes/admin_silica_rate.php:73`), price changes and MEA sync (`php-api/routes/admin_silica_price.php:92`, `php-api/routes/admin_silica_price.php:179`), contract admin-sign (`php-api/routes/admin_contracts.php:101`), some wind-down actions (`php-api/routes/admin_silica_winddown.php:469`, `php-api/routes/admin_silica_winddown.php:504`, `php-api/routes/admin_silica_winddown.php:559`, `php-api/routes/admin_silica_winddown.php:623`, `php-api/routes/admin_silica_winddown.php:807`), and some withdrawal state changes (`php-api/routes/admin_withdraw.php:600`, `php-api/routes/admin_withdraw.php:676`, `php-api/routes/admin_withdraw.php:791`, `php-api/routes/admin_withdraw.php:843`).

Impact:
- If a valid admin JWT is stolen or issued in an environment where wallet whitelist is expected, these routes can bypass the stronger `adminOnly()` controls.
- This directly affects money movement, user balances, token economics, contract finalization, interest rates, price settings, withdrawal state, and wind-down lifecycle operations.

Recommended fix:
- Make `adminAuth()` call `adminOnly()` or remove `adminAuth()` from route code entirely.
- If read-only JWT auth is still needed, split helpers into explicit names such as `adminJwtOnlyRead()` and `adminStrict()` so weaker auth cannot be used accidentally.
- Add an automated route audit test that fails on `post('/api/admin...` or `delete_route('/api/admin...` handlers using `adminAuth()`.

## High Findings

### H1. One asset document upload path lacks the validation present in other upload paths

Evidence:
- Asset image uploads validate extension, client MIME, real MIME via `finfo`, size, and move success (`php-api/routes/admin_assets.php:475`).
- Sales document uploads include strong checks in comments and code (`php-api/routes/admin_sales.php:276` onward).
- The asset document upload at `POST /api/admin/assets/:id/docs` says "PDF file required" but does not validate extension/MIME and does not check `move_uploaded_file()` success before storing `/uploads/...` in DB (`php-api/routes/admin_assets.php:783`, `php-api/routes/admin_assets.php:796`, `php-api/routes/admin_assets.php:801`, `php-api/routes/admin_assets.php:804`).
- Public file serving allows several extensions, including `svg` and `pdf`, based on the final extension (`php-api/routes/public.php:125`, `php-api/routes/public.php:134`).

Impact:
- A malicious or mistaken admin upload could store unexpected content in `UPLOAD_DIR`.
- `uploads/.htaccess` reduces direct script execution risk when uploads are under Apache, but the PHP `/api/file/:name` route bypasses Apache per-file rules and serves allowed extensions itself.

Recommended fix:
- Reuse the stricter upload validation helper from sales/assets for `POST /api/admin/assets/:id/docs`.
- Restrict this route to PDF only if that is the intended product requirement.
- Check `move_uploaded_file()` return value and reject failed uploads before DB insert.
- Consider serving uploaded documents with `Content-Disposition: attachment` and a restrictive CSP for PDFs/SVGs.

### H2. Runtime schema mutation is spread across boot, login, route handlers, and SQL files

Evidence:
- `DB::get()` runs `autoMigrate()` on first database connection (`php-api/lib/db.php:18`), and `autoMigrate()` performs many `ALTER TABLE`, `CREATE TABLE`, and data backfills.
- Admin login registers `lazyApplyPendingMigrationsOnShutdown()` (`php-api/routes/admin_auth.php:63`), which executes all pending `sql/*.sql` files after response flush (`php-api/lib/migrations.php:120`).
- `applyPendingMigrations()` sorts all SQL patch filenames alphabetically and applies files not present in `db_migrations` (`php-api/lib/migrations.php:63`, `php-api/lib/migrations.php:98`).
- Multiple route files also contain runtime DDL helpers, for example referral table creation/indexing in `php-api/routes/admin_referrals.php` and sales schema helpers in `php-api/routes/admin_sales.php`.
- Baseline `rwa.sql` has a unique key on `interest_claims(address, asset_id, month_key)` (`rwa.sql:1000`), while runtime boot logic later drops `uniq_interest` (`php-api/lib/db.php:864`) and production docs say mainnet should re-add a unique key.

Impact:
- Production schema can diverge depending on which endpoint is hit first, which admin logs in, and which SQL patches already ran.
- Alphabetical manual patch order is fragile if filenames do not encode strict order and dependencies.
- Runtime DDL during web requests can create lock contention or partial deployments, especially on shared hosting.

Recommended fix:
- Move schema changes into one ordered migration system with numeric versions and explicit checksums.
- Disable automatic DDL on normal user requests in production.
- Keep `rwa.sql` as a generated snapshot from migrations, or mark it clearly as install-only and version it.
- Add a schema-status command/API that reports expected migration version, applied files, and drift.

### H3. Rate limiting is effectively disabled without APCu

Evidence:
- `php-api/index.php` calls `rateLimit(240)` for all API requests.
- `rateLimit()` returns immediately when `apcu_fetch` is unavailable (`php-api/lib/helpers.php:1517`, `php-api/lib/helpers.php:1520`).
- The deployment target is Hostinger/shared hosting, where APCu may not be enabled.

Impact:
- Login, OTP, KYC, quote, cron-like, and admin endpoints may have no practical request throttling in the most likely deployment environment.
- This raises brute-force and resource-exhaustion risk.

Recommended fix:
- Implement a file-based fallback under a non-public writable directory or a small DB-backed limiter for critical endpoints.
- Use stricter limits for admin login, OTP verification, KYC handoff resolution, and write-heavy endpoints.
- Avoid trusting `X-Forwarded-For` unless the request came from a known reverse proxy.

### H4. Root env example has unsafe testing bypass defaults

Evidence:
- Root `.env.example` sets `BYPASS_OTP=1` and `BYPASS_KYC=1`.
- `php-api/.env.example` correctly sets both bypasses to `0`.
- `DEPLOY_SILICA.md` correctly says production must use `BYPASS_OTP=0`, `BYPASS_KYC=0`.

Impact:
- Operators may copy the root `.env.example` instead of the PHP API env example and accidentally disable OTP/KYC in production.

Recommended fix:
- Change the root `.env.example` bypass defaults to `0`.
- Add comments that test bypasses should be enabled only in local/dev.
- Prefer a single authoritative env example, or make the root file explicitly deprecated.

### H5. Admin JWTs are stored in browser localStorage

Evidence:
- Admin API core reads `rwa_admin_token_v1` from `localStorage` and sends it as `Authorization: Bearer ...` (`admin/js/admin.core.js:274`, `admin/js/admin.core.js:276`).
- Admin page guard also checks the same localStorage token (`admin/js/admin.core.js:518`).

Impact:
- Any XSS in admin pages can exfiltrate the admin JWT.
- This risk is amplified by C1 because some sensitive endpoints still accept JWT-only `adminAuth()`.

Recommended fix:
- Fix C1 first so a stolen JWT alone is insufficient where wallet whitelist is configured.
- Consider short-lived admin access tokens plus refresh flow, or HttpOnly/SameSite cookies if deployment constraints allow.
- Continue replacing dynamic `innerHTML` with DOM APIs or escaped render helpers on admin pages that render server-provided content.

### H6. Wallet login nonce is reusable until it expires

Evidence:
- `/api/auth/nonce` stores one nonce per address with a 10-minute expiry (`php-api/routes/auth.php:11`, `php-api/routes/auth.php:14`).
- `/api/auth/login` verifies the signed message and issues a JWT (`php-api/routes/auth.php:37`, `php-api/routes/auth.php:39`, `php-api/routes/auth.php:52`).
- The successful login path does not delete, rotate, or mark the nonce as consumed before returning the token (`php-api/routes/auth.php:54`).

Impact:
- A captured signed login payload can be replayed within the nonce lifetime to mint additional JWTs for the same wallet.
- This is especially risky if logs, browser extensions, frontend errors, or proxy tooling expose request bodies.

Recommended fix:
- Delete or mark the nonce consumed inside the same transaction that accepts the login.
- Bind nonces to a purpose, creation timestamp, and optional client context where practical.
- Add a regression test that a second login with the same signature fails.

### H7. Public config requests can trigger monthly interest accrual

Evidence:
- `/api/public/config` registers `lazyTryMonthlyInterestAccrual` on every public config request when the helper exists (`php-api/routes/public.php:10`, `php-api/routes/public.php:16`).
- The lazy helper can call `runMonthlyInterestBatch()` during lock-window days (`php-api/routes/staking.php:1764`, `php-api/routes/staking.php:1788`, `php-api/routes/staking.php:1790`, `php-api/routes/staking.php:1797`).
- `runMonthlyInterestBatch()` creates financial accrual records in `interest_claims` and then writes a monthly done lock (`php-api/routes/staking.php:1651`, `php-api/routes/staking.php:1723`, `php-api/routes/staking.php:1741`).

Impact:
- An unauthenticated public page load can initiate financial state changes.
- The code has date and idempotency guards, but execution timing, auditability, retry behavior, and operational ownership are weaker than an explicit cron/admin job.

Recommended fix:
- Remove lazy accrual from `/api/public/config` in production.
- Run accrual only from authenticated cron/admin paths with explicit logs and alerting.
- Keep the public endpoint read-only and expose only status fields derived from already-completed jobs.

### H8. Preview, backup, and manual-build artifacts can be served from the deploy tree

Evidence:
- Root `.htaccess` serves real files and directories directly before API routing (`.htaccess:52`, `.htaccess:55`).
- The deny rule only covers `.env`, `.git`, Composer files, and `vendor/` (`.htaccess:70`, `.htaccess:73`).
- The repository contains root/deploy-tree artifacts such as `preview-router.php`, `admin/preview-mode.html`, `_backup/...`, `_manual_build/...`, and `user/landing.html.backup-2026-05-21-v755`.
- `preview-router.php` is a mock API router with permissive CORS, bypass flags, and accepting any admin username in preview login (`preview-router.php:16`, `preview-router.php:51`, `preview-router.php:64`, `preview-router.php:72`).

Impact:
- If the full repository is copied to the public web root, preview/mock code and backups can be browsed or executed.
- Old route copies under `_backup/` may disclose implementation details or expose outdated behavior if PHP executes them.
- Operators and testers can accidentally interact with fake data or permissive preview endpoints on a production host.

Recommended fix:
- Exclude `_backup/`, `_manual_build/`, `*.backup*`, preview pages, and `preview-router.php` from deploy artifacts.
- Add `.htaccess` deny rules for development/backup directories as a defense in depth.
- Add a release check that fails if public-root deploy output contains preview or backup files.

### H9. Funds custody is centralized in admin wallets and the database ledger, not enforced by a first-party Solana program

Evidence:
- No first-party Anchor/Rust/Solana program was found in the repository; token deployment is documented as external `spl-token create-token` commands.
- User deposits are standard SPL token transfers into the configured admin deposit wallet ATA, then become internal ledger credit only after admin approval (`user/assets/js/pages/deposit.js:959`, `php-api/routes/deposit_withdraw.php:155`, `php-api/routes/admin_deposit.php:177`).
- User withdrawals are internal ledger debits followed by admin Phantom-signed SPL transfers from an admin wallet to the user wallet (`php-api/routes/deposit_withdraw.php:360`, `admin/js/withdrawals.js:747`, `php-api/routes/admin_withdraw.php:507`).
- Token withdrawals permit any connected admin Phantom wallet with balance to be the sending wallet, not necessarily the configured admin wallet (`php-api/routes/admin_token_withdraw.php:1215`, `php-api/routes/admin_token_withdraw.php:1220`).
- Staking, interest, dividends, and swaps mutate MySQL state rather than a verifiable on-chain escrow/program state.

Impact:
- Users do not have on-chain escrow guarantees from this codebase. They rely on operational custody controls, admin wallet security, and DB integrity.
- Compromise or misuse of admin wallets, admin UI, DB, or admin approval paths can affect customer balances/funds.
- Any public claim that staking/distribution is fully enforced on Solana would be inaccurate unless there is another external program/repository not included in this audit scope.

Recommended fix:
- Document the custodial model clearly in product/legal/operator materials.
- Require strict admin wallet allowlisting, hardware wallets/multisig where possible, and maker-checker approval for withdrawals and deposit approvals.
- Reconcile on-chain admin wallet balances against DB liabilities daily.
- If non-custodial guarantees are a product requirement, design and audit a Solana escrow/program; this repository does not currently provide one.

### H10. Monthly interest cron can mark a month complete even when holder payouts failed

Evidence:
- `runMonthlyInterestBatch()` counts per-holder failures in `holder_failed` but continues processing (`php-api/routes/staking.php:1728`, `php-api/routes/staking.php:1731`).
- After the loop, it writes `cron_accrual_done_{YYYY-MM}` regardless of `holder_failed`, `assetStats.failed`, or whether all expected holders were paid (`php-api/routes/staking.php:1738`, `php-api/routes/staking.php:1741`).
- The cron endpoint then treats the done key as idempotency and skips future runs for that month (`php-api/routes/staking.php:1655`, `php-api/routes/staking.php:1663`, `php-api/routes/staking.php:1857`).

Impact:
- On the 15th/16th, a partial failure can become permanently hidden behind the monthly done lock.
- Affected users may not receive `interest_claims` rows, while the system reports the month as already completed.

Recommended fix:
- Do not set the done lock when `holder_failed > 0`; instead keep an explicit partial/failed status and allow safe retry.
- Store a monthly batch table with expected holder count, paid count, failed count, and failed addresses.
- Make the 15th operator check fail if `holder_failed > 0` or if expected staker count differs from created claim rows.

### H11. Interest and dividend eligibility use different staking columns

Evidence:
- Staking writes both legacy `staked_token` and newer `silica_sto_staked` (`php-api/routes/staking.php:747`, `php-api/routes/staking.php:753`).
- Monthly interest selects eligible holders from `holdings.staked_token > 0` (`php-api/routes/staking.php:1692`, `php-api/routes/staking.php:1694`).
- Dividend distribution selects eligible holders from `holdings.silica_sto_staked > 0` (`php-api/routes/admin_silica_dividend.php:621`, `php-api/routes/admin_silica_dividend.php:623`).
- The disaster/payment-status live-system checks also use `staked_token > 0` (`php-api/lib/silica.php:382`, `php-api/lib/silica.php:388`; `php-api/routes/admin_silica_dividend.php:1286`, `php-api/routes/admin_silica_dividend.php:1292`).

Impact:
- If the two columns drift, the same user can be eligible for dividends but missed by monthly interest, or vice versa.
- Existing comments elsewhere acknowledge legacy/new staking drift as a real migration concern.

Recommended fix:
- Pick one canonical staking column for payout eligibility, preferably `silica_sto_staked`, and update interest, payment-status, diagnostics, and live-system checks consistently.
- Add a production reconciliation query that flags `ABS(staked_token - silica_sto_staked) > 0`.
- Before each 15th run, compare expected staker sets for interest and dividend.

### H12. Dividend cron can mark an execution paid with zero recipients

Evidence:
- Dividend cron computes per-user `silicaAmount = round($shareUsdt / $silicaPrice, 2)` and skips users where the rounded amount is `<= 0` (`php-api/routes/admin_silica_dividend.php:661`, `php-api/routes/admin_silica_dividend.php:664`).
- It then updates `dividend_executions.status` to `paid` even if `recipients` remains `0` and `silica_total_distributed` remains `0` (`php-api/routes/admin_silica_dividend.php:684`, `php-api/routes/admin_silica_dividend.php:693`).

Impact:
- A too-small dividend pool or high Silica price can silently produce no claimable payouts while marking the annual dividend as paid.
- Operators may believe the 15th dividend ran successfully even though no user received a pending claim row.

Recommended fix:
- Reject payout completion when `recipients === 0` or `totalSilicaDistributed <= 0`.
- Surface a clear error requiring the operator to increase pool size, adjust price, or confirm a zero-payout cancellation path.
- Add a 15th check that `dividend_executions.recipient_count` matches the expected staker count or an approved exception.

### H13. Payment-delay detection can miss the first failed production interest month

Evidence:
- `silicaHasDisasterPending()` only reports overdue interest after day 16 when `cron_accrual_done_{YYYY-MM}` is missing and there are previous-month `interest_claims` rows (`php-api/lib/silica.php:405`, `php-api/lib/silica.php:415`).
- `/api/silica/payment-status` uses the same previous-month-claims condition for overdue interest (`php-api/routes/admin_silica_dividend.php:1351`, `php-api/routes/admin_silica_dividend.php:1367`).
- This intentionally avoids false alarms on fresh installs, but it also means the first real production month with stakers and no prior claims may not trigger the disaster banner after the 16th.

Impact:
- The first missed monthly interest run in a new production system can avoid the very alert intended to protect users from unstaking before payment recovery.
- Operators relying on `/api/silica/payment-status` may miss the incident.

Recommended fix:
- Track production go-live date or first eligible staking month explicitly, rather than inferring obligation from previous claims.
- After day 16, flag overdue interest when there were eligible stakers during the lock window and no done lock, even if it is the first payout month.
- Include this edge case in the monthly 15th/17th monitoring runbook.

## Medium Findings

### M1. Public config exposes operational toggles and deposit address

Evidence:
- `/api/public/config` returns deposit admin address, Solana network, mint addresses, bypass flags, sale state, token logos, fees, and APR data (`php-api/routes/public.php:10`, `php-api/routes/public.php:20`).

Impact:
- Most of this is required by the static frontend, but `bypass_otp` and `bypass_kyc` unnecessarily disclose security posture to all clients.

Recommended fix:
- Remove bypass flags from public config unless a specific user-facing page requires them.
- If needed for UI messaging, return a generic KYC/OTP status through authenticated user endpoints.

### M2. Admin wallet allowlist is optional and empty by default

Evidence:
- `ADMIN_WALLET_ADDRESSES=` is empty in `php-api/.env.example`.
- Auth code treats an empty allowlist as disabled (`php-api/lib/auth.php:354`, `php-api/lib/auth.php:361`).

Impact:
- Installations can run with password/JWT-only admin access even though the code and comments describe wallet whitelist as the second factor.

Recommended fix:
- Make `ADMIN_WALLET_ADDRESSES` a production checklist blocker.
- Add a boot warning or admin dashboard warning when `NODE_ENV=production` and the list is empty.

### M3. Deposit wallet allowlist is hardcoded in frontend

Evidence:
- `KNOWN_ADMIN_WALLETS` is hardcoded in `user/assets/js/pages/deposit.js` (`user/assets/js/pages/deposit.js:25`).
- Deployment docs document a manual two-step rotation procedure that requires changing this JS and the DB setting.

Impact:
- This is a reasonable defense against deposit hijacking, but it creates an operational footgun: wallet rotation can break deposits if cache-busting/deployment order is wrong.

Recommended fix:
- Keep the hardcoded allowlist, but add an automated deployment check that compares the DB setting against the JS allowlist before production release.
- Consider publishing a signed config manifest if wallet rotation needs to happen without code deploys.

### M4. Composer dependency validation/audit could not be run in this environment

Evidence:
- `composer validate --no-check-publish` and `composer audit --locked` both failed because `composer` is not installed in the local shell.

Impact:
- Dependency metadata and known vulnerability checks are not verified by this audit run.

Recommended fix:
- Install Composer in CI or add a containerized check.
- Run `composer validate --strict` and `composer audit --locked` before deployment.

### M5. Cron endpoints require `CRON_KEY`, but env examples do not define it

Evidence:
- Interest, FX, and dividend cron handlers require `CRON_KEY` via query parameter or `X-Cron-Key` header (`php-api/routes/staking.php:1825`, `php-api/routes/admin_fx.php:44`, `php-api/routes/admin_silica_dividend.php:530`).
- The handlers fail closed when the expected key is empty (`php-api/routes/staking.php:1827`, `php-api/routes/admin_fx.php:46`, `php-api/routes/admin_silica_dividend.php:532`).
- `README.md` references `CRON_KEY`, but targeted searches did not find a `CRON_KEY=` entry in `.env.example` or `php-api/.env.example`.

Impact:
- Fresh deployments can silently miss scheduled interest, FX, or dividend jobs if operators follow the env template literally.
- This is primarily an availability and financial-operations risk, not a direct bypass, because empty keys fail closed.

Recommended fix:
- Add `CRON_KEY=` to the authoritative env example with production guidance.
- Add a startup/admin dashboard warning when cron-capable production deployments do not have it set.
- Include cron endpoint smoke tests in deployment verification.

### M6. KYC handoff token is placed in the URL and resolves sensitive session data

Evidence:
- Handoff tokens are 64-character bearer tokens with a 10-minute TTL (`php-api/routes/kyc.php:1052`, `php-api/routes/kyc.php:1054`).
- The generated handoff link embeds the token in a query parameter (`php-api/routes/kyc.php:1074`).
- The public resolve endpoint treats the token itself as authentication (`php-api/routes/kyc.php:1092`, `php-api/routes/kyc.php:1096`) and returns the full wallet address plus Didit session URL/id (`php-api/routes/kyc.php:1136`, `php-api/routes/kyc.php:1142`).
- The validator rejects used or expired tokens, but the token is not marked used at resolve time (`php-api/routes/kyc.php:837`, `php-api/routes/kyc.php:849`).

Impact:
- Query-string tokens can leak through browser history, server logs, analytics, screenshots, referrers, or support tickets.
- Anyone with the token during the TTL can resolve the wallet address and provider session data.

Recommended fix:
- Prefer a fragment token handled client-side, a POST body exchange, or a short-lived one-time exchange that returns an ephemeral session.
- Mark tokens consumed earlier if the flow allows, or bind resolution to tighter context.
- Avoid returning full wallet/provider session details unless strictly required for that browser step.

### M7. Some admin error render paths interpolate unescaped messages into `innerHTML`

Evidence:
- Admin settings wind-down detail failure renders `${e?.message || e}` directly into `innerHTML` (`admin/settings.html:1885`).
- Admin dividend payout-log failure renders `(e && e.message) || e` directly into `innerHTML` (`admin/dividend.html:1519`).
- Nearby row rendering sometimes also places raw row fields into HTML attributes/text, such as dividend payout `row.address` and `row.claimed_at` (`admin/dividend.html:1497`, `admin/dividend.html:1505`).

Impact:
- If an API error message or row field contains HTML, an admin page can execute it.
- This compounds the localStorage admin JWT risk in H5.

Recommended fix:
- Use `textContent` for error messages and DOM APIs for table rows.
- Where template strings remain, route all untrusted values through a shared escape helper.
- Add a small frontend lint/check for `${...}` interpolation inside `innerHTML` assignments.

## Low Findings

### L1. Root and PHP API env examples overlap and can confuse operators

Evidence:
- Both `.env.example` and `php-api/.env.example` define DB, JWT, admin, CORS, KYC, and Solana settings with different defaults.

Impact:
- Operational mistakes become more likely, especially on shared hosting where env file placement is already multi-path.

Recommended fix:
- Keep one authoritative env template for production.
- If the root file remains, add a top-level warning that `php-api/.env.example` is authoritative for the PHP deployment.

### L2. Large frontend bundle is committed

Evidence:
- `user/assets/js/index.iife.js` is 26,084 lines.

Impact:
- This is not automatically wrong, but reviewability and supply-chain visibility suffer if the bundle source/build process is not documented.

Recommended fix:
- Document how the bundle is built and from which dependencies.
- Prefer committing source plus reproducible build steps, or pin the generated bundle hash in release notes.

## Positive Observations

- First-party PHP files passed syntax checks under PHP 8.5.4.
- Database access generally uses prepared statements through the `DB` helper.
- Global JSON exception handling avoids leaking stack traces unless debug flags are enabled.
- CORS is explicit allowlist-based and blocked origins are logged.
- Upload hardening exists for `uploads/.htaccess`, asset image uploads, token logo uploads, and sales document uploads.
- Deposit flow includes a frontend allowlist and backend post-transaction verification against expected admin ATA/address.
- Duplicate write request guard exists for in-flight POST/PUT/PATCH/DELETE requests.
- Deployment docs include mainnet security tasks and warn about double-payment risks in cron/claim flows.

## Operational Checklist

Before production:
- Replace every sensitive admin write route using `adminAuth()` with `adminOnly()` or a stricter renamed helper.
- Set `ADMIN_WALLET_ADDRESSES` and verify all admin pages send `X-Admin-Wallet`.
- Set strong, distinct `JWT_SECRET` and `ADMIN_JWT_SECRET`.
- Set `BYPASS_OTP=0` and `BYPASS_KYC=0`; remove unsafe defaults from root `.env.example`.
- Set `CRON_KEY` and verify interest, FX, and dividend cron calls fail without it and succeed with it.
- Run Composer validation and audit in CI.
- Run schema migrations in a controlled maintenance step, not opportunistically from login/user traffic.
- Reconcile configured admin deposit/withdraw wallets, on-chain token balances, and DB liabilities before go-live.
- Decide and disclose whether the product is custodial. If it should be non-custodial, build and audit an on-chain escrow/program before accepting customer funds.
- Fix 15th payout correctness risks: partial interest batch locking, staking-column drift, zero-recipient dividend completion, and first-month overdue-interest detection.
- Remove public-request-triggered interest accrual; keep financial batch mutation behind cron/admin execution.
- Make wallet-login nonces one-time use.
- Add upload validation to `POST /api/admin/assets/:id/docs`.
- Add real rate limiting for admin login, OTP, KYC, cron, and write endpoints.
- Exclude preview, backup, and manual-build artifacts from the deployed public web root.
- Verify `UPLOAD_DIR` is outside deploy-wiped directories and not directly executable.
- Confirm mainnet Solana network, token mints, deposit wallet, withdraw wallet, and hardcoded deposit wallet allowlist are aligned.

After deployment:
- Check PHP error logs for `[security][BOOT]` warnings.
- Verify `/api/public/config` reports expected network/mints/fees without debug or bypass values.
- Run a small deposit/withdraw/claim flow end-to-end on the target network.
- Confirm cron endpoints require the expected key and are idempotent across retries.
- Confirm `db_migrations` status and schema-status endpoints match the intended release.
- Confirm production URLs cannot browse `preview-router.php`, `_backup/`, `_manual_build/`, or `*.backup*` files.

Recurring:
- Review `silica_audit_log` weekly.
- On the 15th of every month KST, verify that interest accrual and scheduled dividend distribution ran successfully, inspect `interest_claims` and `dividend_payouts` for missing/failed/duplicate rows, confirm claim UI visibility, and reconcile DB liabilities against admin wallet balances.
- Run backup and restore tests at least quarterly.
- Run dependency audit on every release.
- Re-test wallet rotation procedure before changing admin deposit wallets.
- Review public KYC handoff and admin rendering paths after each KYC/admin UI change.
- Reconcile admin wallet balances against `balances`, `holdings`, pending withdrawals, pending interest, and pending dividend liabilities.

## Verification Notes

Commands/checks run locally:
- `find . -maxdepth 3 -type f ...` to inventory first-party files.
- `rg` searches for auth helpers, admin routes, uploads, secrets, SQL/DDL, localStorage usage, and frontend API calls.
- Second-pass `rg`/`nl` inspections for login nonce reuse, KYC handoff tokens, cron env drift, public-triggered accrual, `.htaccess` deploy exposure, preview/backup artifacts, and admin `innerHTML` sinks.
- Funds-flow trace across Solana helpers, user deposit/withdraw JS, admin withdrawal JS, deposit approval routes, user/admin withdrawal routes, staking, interest, dividend, and swap routes.
- Targeted search for first-party Solana program/Anchor/Rust files; none were found in the repository.
- 15th payout code audit across monthly interest cron, dividend cron, payment-status/disaster detection, staking lock helpers, and production checklist runbook.
- Post-pull Git comparison from `fac96e0` to `3e4f027`, including changed files, commit list, and targeted inspection of Solana validation, upload serving, PDF generation, monthly interest, dividend payout, env templates, and checklist changes.
- `git status --short --branch`: `main` matches `origin/main`; `PROJECT_AUDIT_REPORT.md` is the only local working-tree addition/change after restoring it from the pre-pull stash.
- `php -v`: PHP 8.5.4 CLI available.
- `find php-api -type f -name '*.php' -not -path 'php-api/vendor/*' -print0 | xargs -0 -n1 php -l`: no syntax errors detected in first-party PHP files before the pull and again after the pull, including new `php-api/lib/pdf.php`.
- `wc -l` across first-party PHP, JS, SQL, and schema files to estimate review surface.
- `git status --short`: no pre-existing tracked modifications were reported before writing this report.

Checks attempted but not completed:
- `composer validate --no-check-publish`: failed because `composer` is not installed.
- `composer audit --locked`: failed because `composer` is not installed.

Not performed:
- No dynamic API tests against a running database.
- No Solana devnet/mainnet transaction tests.
- No browser UI testing.
- No formal penetration test or legal/compliance review.
