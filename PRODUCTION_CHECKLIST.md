# SilicaChain Production 전환 체크리스트

> devnet → mainnet 운영 전환 시 반드시 검토할 항목들. 누락 시 자산 / 보안 / 회계 위험.
> 작성: 2026-05-15 (v380). 동기화 대상: `admin/settings.html#prod-checklist` 섹션.

각 항목의 더 자세한 기술적 배경은 git history 의 인용된 commit 을 참조.

---

## 🔐 보안 (Critical)

- [ ] **admin 비밀번호 변경** — devnet 기본값 `admin1234` 그대로 두면 안 됨. 강력한 값으로 변경. (DB `admins.password_hash`)
- [ ] **OTP 등록** — admin 계정에 Google Authenticator OTP 활성화. 미설정 상태에서 운영 = 비밀번호만으로 로그인 가능.
- [ ] **`JWT_SECRET` / `ADMIN_JWT_SECRET` 재발급** — devnet 의 secret 그대로 두면 다른 환경에서 발급된 토큰 통용 가능. 32+자 랜덤.
- [ ] **`CRON_KEY` 재발급** — Hostinger cron URL 의 `?key=` 와 `.env` 의 값 모두 새로 발급. devnet key 노출 위험 차단.
- [ ] **`ADMIN_KEY` 재발급** — admin API 호출용 키. `.env` 의 값 갱신.
- [x] **admin write endpoint 권한 통일** (audit C1 fix v2 · 2026-06-12 적용)
  - `adminAuth()` 정의를 `adminOnly()` wrapper 로 변경 → 49개 호출지 자동 강화 (JWT + ADMIN_WALLET_ADDRESSES + ADMIN_KEY).
  - 예외: `/api/admin/auth/me` 만 `adminJwtOnlyRead()` (admin.core.js 가 auth 라우트에 X-Admin-Wallet 미부착 — v1 자동 로그아웃 사고의 원인이었음).
- [ ] **`ADMIN_WALLET_ADDRESSES` 필수 설정** — 운영 admin 지갑 allowlist 를 비워두지 않음. 모든 admin 페이지가 `X-Admin-Wallet` header 를 보내는지 확인. (2026-06-12 운영 .env 에 설정되어 있음이 확인됨 — Phase 2 v1 사고에서 검증 작동 확인)
- [x] **root `.env.example` bypass 기본값 수정** (audit H4 fix · 2026-06-12 적용) — `BYPASS_OTP=0`, `BYPASS_KYC=0` 으로 변경 + 운영 경고 주석. php-api/.env.example 이 authoritative 임을 양쪽에 명시 (audit L1). 두 example 모두 `CRON_KEY=` 항목 추가 (audit M5).
- [x] **public upload diagnostics 차단** (audit 신규High fix · 2026-06-12 적용)
  - `/api/file/diagnose` → `adminOnly()` 잠금 (frontend 호출처 없음 확인).
  - `/api/file/:name` 오류 응답에서 debug 필드 (UPLOAD_DIR 절대경로 / full_path / 파일명 샘플 / realpath) 제거 → PHP error_log 의 `[file serve]` 항목으로 이동. reason 코드는 유지.
- [x] **rate limiting 활성화** (audit H3 · 2026-06-12 운영 적용 + 실측 검증)
  - 원인: 운영 서버 (Hostinger) 의 APCu 확장이 꺼져 있어 `rateLimit(240)` 이 무조건 통과 (속도 제한 0).
  - 조치: 운영자가 hPanel → PHP 확장 모듈 → `apcu` 활성화 (코드 변경 불필요 — 기존 코드가 자동 감지).
  - 실측 검증 (2026-06-12): 단일 연결 260회 연속 요청 → 243회 200 + **17회 429** (240 임계 정확 작동).
  - 잔여 nuance: LiteSpeed 다중 PHP 워커 환경에서 APCu 카운터는 워커별 — 분산 병렬 공격의 실효 한도는 240×워커수/분. "무제한 → 유한" 으로 핵심 위험 해소. 중앙집중 카운터 (DB/Redis 기반) 가 필요하면 개발자 복귀 후 검토 (우선순위 하향).
  - ⚠ 함께 발견: `/api/public/config` 실측 응답에서 **운영 `bypass_otp: true` 확인** — 운영 .env 의 `BYPASS_OTP` 가 1 로 켜져 있음. 사용자 출금 OTP 검증이 우회되는 상태. 운영자 결정 필요 (아래 별도 항목).
- [ ] **운영 `BYPASS_OTP=0` 전환** (2026-06-12 실측에서 `bypass_otp:true` 확인됨)
  - 현재: 사용자 출금 등의 OTP 검증이 운영에서 우회 중. `bypass_kyc` 는 false (정상).
  - 조치: `silica.env` 의 `BYPASS_OTP=0` 으로 변경 (운영자만 가능 — .env 는 repo 밖).
  - 시점 권장: 6/15~16 지급 윈도우 직후 — 윈도우 중 사용자 흐름 변경 회피. 전환 후 사용자 출금 1건으로 OTP 요구 정상 작동 확인.
- [ ] **public config 의 lazy 이자 accrual 제거** (audit H7 · 조건부 연기 2026-06-12)
  - `/api/public/config` 가 lock window (14~16일) 중 `lazyTryMonthlyInterestAccrual` 을 발사하는 구조.
  - 3중 가드 존재 (14~16일 윈도우 + done lock + 5분 inflight lock) — 이중지급/시점외 실행 불가.
  - **연기 사유: 6월 15일 첫 운영 지급의 백업 경로.** CRON_KEY 미설정 시 정식 cron 이 401 fail-closed 라 lazy 가 유일한 지급 경로일 수 있음.
  - **제거 조건: 2026-06-15 지급이 정식 cron 경로로 성공 확인된 후** (Hostinger cron 등록 + CRON_KEY 일치 검증 포함).
- [ ] **public config 의 bypass_otp / bypass_kyc 필드 제거** (audit M1 · 연기 2026-06-12)
  - user 프론트 6개 파일 (core.js / deposit.js / funding.js / withdraw.js 등) 이 OTP/KYC UI 게이트로 실사용 중 — 제거 시 사용자 흐름 파손.
  - 운영 bypass 값이 0 이면 노출 정보 자체가 무해 ("OTP 활성" 은 기본 기대값). 인증 endpoint 로 이전하는 구조 변경은 개발자 복귀 후.
- [x] **asset 문서 업로드 검증 강화** (audit H1 fix · 2026-06-12 적용)
  - `POST /api/admin/assets/:id/docs` 에 admin_sales v408 과 동일한 다층 검증 적용:
    UPLOAD_ERR / 크기 min·max / is_uploaded_file / 확장자 화이트리스트 (pdf·png·jpg·jpeg·webp) /
    double-extension 차단 / finfo 실제 MIME 검증 / 이미지 getimagesize / 파일명 랜덤화 /
    `move_uploaded_file()` 성공 확인 후 DB INSERT.
- [x] **admin innerHTML 에러 메시지 escape** (audit M7 fix · 2026-06-12 적용)
  - admin/settings.html 배당금 detail 로딩 실패 메시지 + admin/dividend.html payout 로그
    로딩 실패 메시지 / address·claimed_at 행 필드 → 기존 escHtml 헬퍼로 escape.
- [ ] **contract PDF 템플릿 sanitizer** (audit 신규Medium · 부분 완화 + 연기 2026-06-12)
  - 이미 적용된 완화: dompdf `isRemoteEnabled=false` + `chroot=UPLOAD_DIR` (v893),
    PDF regenerate endpoint 는 C1 fix 로 `adminOnly()` 검증 (2026-06-12).
  - 잔여: 저장된 contract_body_html 의 HTML/CSS sanitize allowlist — 계약 템플릿은
    admin 전용 콘텐츠이므로 위험 제한적. 개발자 복귀 후 진행.
- [x] **wallet login nonce 1회용 소비** (audit H6 fix · 2026-06-12 적용)
  - `/api/auth/login` 서명 검증 통과 즉시 `auth_nonces` 행 DELETE → 캡처된 서명 payload 재전송 (replay) 차단.
  - 프론트 영향 없음 (core.js 두 로그인 경로 모두 1회 호출, 재시도 루프 없음 — 전수 확인).
- [ ] **admin JWT localStorage → HttpOnly cookie 전환** (audit H5 · 연기 결정 2026-06-12)
  - audit 권장 1차 완화 (C1 fix) 가 적용되어 stolen JWT 단독으로는 지갑 화이트리스트 통과 불가.
  - admin JWT TTL 은 이미 12h (적정). 쿠키 전환은 admin.core.js 전면 개편 필요 → mainnet 운영 중 위험. 개발자 복귀 후 진행.
- [ ] **KYC handoff 토큰 URL 전달 개선** (audit M6 · 연기 결정 2026-06-12)
  - didit 왕복이 같은 토큰을 재사용하는 구조 (v799) — resolve 시점 소비는 모바일 KYC 흐름 파손 위험.
  - 현행 완화: 10분 TTL + KYC 완료 시 무효화 + revoke endpoint 존재. fragment/POST 전환은 개발자 복귀 후 인앱 브라우저 실기기 테스트와 함께 진행.

## 📊 데이터 / 회계

- [ ] **DB reset 또는 새 DB 생성** — devnet 의 testInterestBtn / 시험 거래 / 계약 / 사용자 등 모든 데이터 정리. clean state 에서 운영 시작.
- [x] **`interest_claims` UNIQUE 추가** (v900 · 2026-06-08 자동 마이그레이션 적용)
  ```sql
  ALTER TABLE interest_claims
    ADD UNIQUE KEY ux_ic_addr_asset_month (address, asset_id, month_key);
  ```
  - `php-api/lib/db.php` 의 `ensureCoreSchema()` 에서 신규 환경 자동 적용
  - 기존 운영 DB 에 중복 데이터가 있을 경우 자동 ADD 가 실패할 수 있음 →
    `sql/manual_add_interest_claims_unique_v900.sql` 의 사전 진단 SELECT
    로 검증 후 수동 적용
  - 효과: force-interest disaster + catch-up-accrual 의 race condition
    (동시 호출 / 두 브라우저 동시 클릭) 으로 인한 이중 이자 지급 차단
- [ ] **`dividend_payouts` UNIQUE 확인** — `ux_dividend_payouts_exec_addr` 자동 적용됨 (v361 self-healing migration). admin `/api/admin/staking/schema-status` 로 검증.
- [x] **`/api/admin/staking/schema-status` 문구 동적화** (audit 신규Medium fix · 2026-06-12 적용) — policy 문구가 실제 DB 인덱스 (`ux_ic_addr_asset_month`) 존재 여부를 조회해 표시됨. 적용 환경: `unique_enforced (v900 ...)`, 미적용 환경: 경고 + 패치 파일 안내.
- [ ] **`silica_price_usdt` 운영 값 설정** — admin 설정 → "Silica 시세" 에서 mainnet 가격으로 갱신.
- [ ] **스테이킹 컬럼 drift 점검** — 이자 cron 은 `staked_token`, 배당 cron 은 `silica_sto_staked` 를 사용하므로 운영 전 두 컬럼 차이 0 확인.
  ```sql
  SELECT address, asset_id, staked_token, silica_sto_staked
    FROM holdings
   WHERE ABS(COALESCE(staked_token,0) - COALESCE(silica_sto_staked,0)) > 0.000001;
  ```
- [ ] **15일 이자 지급 수동 검증** — 매월 15일 KST cron 후 `interest_claims` 가 대상 staker/asset/month 전부에 생성됐는지 확인. `holder_failed > 0` 이면 `cron_accrual_done_YYYY-MM` 완료로 간주 금지.
  - (audit H10 fix · 2026-06-10 적용) `runMonthlyInterestBatch()` 가 `holder_failed > 0` 시 done lock 저장을 자동 skip 함. 다음 cron 이 실패한 holder 만 재시도. `error_log` 에 `[interest batch] DONE lock SKIPPED` 메시지 확인.
- [ ] **`production_first_payout_month` setting 입력 (mainnet 출시 시 1회)** — (audit H13 fix · 2026-06-10) mainnet 출시 후 첫 14일 KST 이전에 admin 설정 또는 SQL 로 입력:
  ```sql
  INSERT INTO settings (`key`, `value`) VALUES ('production_first_payout_month', '2026-MM')
    ON DUPLICATE KEY UPDATE `value`='2026-MM';
  ```
  값: 첫 이자 지급 예정 회차 (YYYY-MM, 예: `2026-07`).
  효과: 첫 운영 월 cron 이 실패해도 `/api/silica/payment-status` 가 정확히 overdue 검출 → 사용자 보호 배너 노출.
- [ ] **15일 배당 지급 수동 검증** — `dividend_executions.recipient_count > 0`, `dividend_payouts.status='pending'` row 수가 예상 대상자 수와 일치하는지 확인. 0명 지급 상태로 `paid` 처리되면 운영 사고로 취급.
  - (audit H12 fix · 2026-06-10 적용) dividend cron 이 `recipients=0` 시 자동 abort + rollback. `silica_audit_log` 의 `dividend_zero_recipient_aborted` 행 확인. 운영자가 배당 풀 증액 또는 silica 가격 조정 후 재실행.
- [ ] **이자/배당 자격 컬럼 통일 확인** — (audit H11 fix · 2026-06-10) 이자 cron 의 holder SELECT 와 disaster check 가 `silica_sto_staked` 로 통일됨. 운영 DB 의 두 컬럼 drift 가 0 인지 위 SQL 로 확인 필수.
- [ ] **DB 부채 vs on-chain 지갑 잔액 reconcile** — `balances`, `holdings`, pending withdrawals, pending `interest_claims`, pending `dividend_payouts` 합계와 admin wallet/ATA 잔액 비교.

## 🛠 UI / 운영 도구

- [ ] **testInterestBtn 비활성화 또는 제거** (선택) — devnet 테스트 도구. mainnet 에서 운영자가 실수로 누르면 사용자에게 진짜 USDT 두 번 지급. `admin/staking.html` 의 `#testInterestCard` 제거 권장. `forceInterestBtn` (재해 복구) 만 남김.
- [ ] **payment-delay banner 작동 검증** — `/api/silica/payment-status` 호출 결과 + user 페이지 헤더 아래 빨강 배너 노출 확인.
- [ ] **모든 user 페이지 cache buster bump** — 운영 전환 시 모든 자산 강제 재다운로드.

## ⚖ 법적 / 약관

- [ ] **force majeure 조항 확인** — 약관 (admin/terms.html) 에 재해 / 서버 이슈로 인한 미지급 면책 조항 포함 확인. KO/EN 양어.
- [ ] **투자 위험 고지** — 원금 손실 가능성 명시.
- [ ] **개인정보 처리 방침** — KYC / 지갑 주소 / 이메일 처리 동의.

## 🌐 인프라

- [ ] **Hostinger cron 설정 확인** — `accrue-interest` + `distribute-dividends` 양쪽 등록. 매월 15일 KST 발화. `CRON_KEY` 일치.
- [ ] **env template 에 `CRON_KEY=` 추가/확인** — `.env.example`, `php-api/.env.example` 에는 아직 `CRON_KEY=` 가 없을 수 있음. 실제 운영 `.env` 에는 반드시 설정.
- [ ] **Solana 네트워크 전환** — devnet → mainnet-beta. admin 설정 "Solana 네트워크" 갱신.
- [ ] **SilicaSTO + Silica 토큰 Mint 주소** — mainnet 발행 주소로 갱신. admin 설정 "토큰 Mints".
- [ ] **관리자 입금 지갑** — mainnet 지갑 주소로 갱신. admin 설정 "입금 지갑".
- [ ] **`UPLOAD_DIR` public web root 밖으로 이동** — `uploads/.htaccess` 가 삭제되어 PHP `/api/file/:name` route 가 primary guard. public_html 내부 업로드 디렉토리에 의존하지 않음.
- [x] **preview / backup / manual build / 내부 문서 웹 접근 차단** (audit H8 fix · 2026-06-12 적용)
  - 실측 (2026-06-12): `PROJECT_AUDIT_REPORT.md` / `PRODUCTION_CHECKLIST.md` / `rwa.sql` / `preview-router.php` 가 운영 도메인에서 **200 노출 중**이었음.
  - `.htaccess` 에 403 차단 RewriteRule 추가: `.git/`, `_backup/`, `_manual_build/`, `sql/`, `php-api/vendor/`, `preview-router.php`, `preview-mode.html`, `*.backup*`, `*.sql`, `*.md`.
  - 파일은 repo 에 보존 (운영자 지침 — 삭제 대신 보존), 웹 레이어에서만 차단.
  - 적용 후 검증: 위 URL 들이 403 반환하는지 + 사이트/admin/API 정상 동작 확인.
- [ ] **SSL 인증서 확인** — Hostinger 패널에서 HTTPS 활성 확인.
- [x] **composer 의존성 보안 감사** (audit M4 · 2026-06-12 1차 수행 완료)
  - 도구: `php php-api/tools/dep-audit.php` (composer 불필요 — Packagist 공식 advisory API 직조회, CLI 전용).
  - **2026-06-12 전수 결과: 16개 패키지 중 조치 필요 0건.**
    - dompdf v3.1.5 — 권고 14건 전부 `<2.0.4` 이하 대상 → 비해당.
    - sodium_compat v1.24.0 / css-parser v9.3.0 / random_compat v9.99.100 — 권고 범위 밖 → 비해당.
    - firebase/php-jwt v6.11.1 — CVE-2025-45769 (`<7.0.0`) 는 **NVD disputed** (키 길이는 앱 책임, CVSS 미부여). 본 프로젝트는 JWT_SECRET 32+자 정책으로 무관. 개발자 복귀 시 v7 업그레이드 검토 (breaking change 가능).
  - 정기 실행: 릴리스 전 + 분기 1회. composer 가능 환경에선 `composer audit --locked` 우선.
- [x] **DB 자동 마이그레이션 끄기 스위치 신설** (audit H2-1 fix · 2026-06-12 적용)
  - `AUTO_MIGRATE_ENABLED` env 상수 신설 (config.php). **기본 true — 미설정 시 현 동작 100% 유지 (비파괴)**. 명시적으로 `0/false/no/off` 일 때만 끔.
  - 끄면 정지되는 자동 경로: ① `autoMigrate()` (db.php 인라인 DDL) ② `lazyApplyPendingMigrationsOnShutdown()` (admin 로그인 시 sql/ 패치 자동 적용).
  - 끈 상태 배포 후 수동 적용 경로: `POST/GET /api/admin/db/migrate` (adminOnly) → `DB::runAutoMigrateNow()` (force=true, 스위치 무시) + `applyPendingMigrations()` 둘 다 실행. 응답에 `auto_migrate` + `auto_migrate_enabled` 포함.
  - ⚠ **끄기는 배포 워크플로우 변경과 세트** — 끈 뒤 새 코드 배포 시 `/api/admin/db/migrate` 수동 실행 필수. 깜빡하면 새 컬럼 없어 `Unknown column` 에러.
  - **현재는 켜둔 상태(기본값)로 머지** — 실제 끄기는 6/15 지급 + 개발자 복귀 후 배포 절차 정비와 함께 운영자가 결정.
- [x] **파괴적 패치 자동 적용 차단** (audit H2-2 fix · 2026-06-12 적용)
  - 🔴 **발견 경위**: 2026-06-12 정밀 검토 중 `silica_cleanup_dummies.sql` (users/holdings/interest_claims/balances/wallet_transactions/dividend_payouts 등 **전체 DELETE** — 개발 시드 청소용) 이 운영 sql/ 에 존재 + db_migrations 미기록 상태로 발견. 알파벳 1번 `manual_add_interest_claims_unique_v900.sql` 의 break (v900 UNIQUE 를 phpMyAdmin 수동 적용한 탓에 패치 재실행 시 Duplicate key) 가 *우연히* cleanup 을 막던 불안정 상태였음.
  - **조치**: `php-api/lib/migrations.php` 에 `MIGRATION_AUTO_APPLY_BLOCKLIST` 상수 신설. `applyPendingMigrations()` 가 blocklist 파일을 모든 자동 경로 (lazyApply / `/api/admin/db/migrate` / user_profile·admin_emails self-heal) 에서 skip + error_log. db_migrations 에 기록 안 함 → 차단 상태 유지.
  - **자동 실행만 차단, 초기화 능력은 보존**: 고객 이관 직전 초기화가 필요하면 phpMyAdmin 에서 파일 내용 직접 실행 (의도적 1회). blocklist 는 자동 경로만 막을 뿐 수동 SQL 과 무관. 파일도 보존 (다른 부동산 자산 새 설치 시 재사용).
  - 현재 blocklist: `silica_cleanup_dummies.sql` 1건. 향후 파괴적 reset 패치 추가 시 배열에 등록.
- [ ] **고객 이관 / 공개운영 전환 절차** (비공개 베타 → 공개운영, 운영자 D-day)
  - 현재 mainnet 이지만 **비공개 베타** 운영 중. 지금 데이터는 베타 테스트 데이터. 고객 이관(공개운영) 직전 1회 초기화 예정.
  - 절차: ① 백업 (ZIP + DB export) → ② phpMyAdmin 에서 `silica_cleanup_dummies.sql` 내용 직접 실행 (의도적 초기화) → ③ 검증 (테이블 비워짐 + `SILICA-79907`·admins·settings·templates·FX 보존 확인) → ④ `BYPASS_OTP=0` 등 정식 설정 전환 → ⑤ `silica_cleanup_dummies.sql` 파일 격리(`sql/_oneshot_danger/`) 또는 제거 → ⑥ 비공개 → 공개 오픈.
  - ⚠ ②를 하기 전 절대 금지: `manual_add_interest_claims_unique_v900.sql` 을 db_migrations 에 기록하거나 수정/삭제 (현재 break 안전벨트 — H2-2 blocklist 로 이중 안전화됐으나 주의).
- [x] **H2-3(a) 베이스 스키마 drift 정리** (audit H2-3a · 2026-06-12 적용 — 방법 A: 운영 DB 구조 Export)
  - **배경**: 신규 설치 파일 `silica_full_install.sql` (D:\ai\new_silica\, silica git 밖) 이 6/3 base 덤프라 db.php autoMigrate 70개 DDL 거의 전부 미반영 (interest_claims `claimed_at`/`ux_ic_addr_asset_month`/`month_key VARCHAR(32)`, wallet_transactions 트리거 역방향, 누락 테이블 16개 등). `AUTO_MIGRATE_ENABLED=false` 환경에서 신규 설치 시 깨짐.
  - **조치**: 운영 DB(u781966299_silica2RWA) **구조만** phpMyAdmin Export (데이터 제외 — 개인정보 보호) → 시스템 seed 결합 → 새 `silica_full_install.sql` 재생성.
    - 구조: 57 테이블, drift 0 (운영 = 정답지. interest_claims UNIQUE/claimed_at/VARCHAR ✅, wallet_transactions guard_update 트리거 없음 ✅ — 역방향 drift 자동 해결).
    - seed: 시스템 부트스트랩만 (admins[**placeholder 비밀번호**] + settings + app_settings + contract_templates + interest_rate_history + fx + **SILICA-79907 단일 고정 자산**). 사용자 데이터·더미 자산(APT/test) 제외.
    - 기존 파일 백업: `silica_full_install.sql.backup-20260612-pre-drift-fix` (105K).
  - ⚠ admins 비밀번호 placeholder — 신규 설치 후 즉시 변경 필요.
  - 참고: `silica_full_install.sql` 은 silica git repo **밖** (신규 설치용 로컬 도구, 운영 서버 미배포). 위치/배포 방식은 운영자 정책.
- [x] **H2-3(b) v900 패치 break 해소** (audit H2-3b · 2026-06-12 적용 — db_migrations 기록 방식)
  - **정밀 검증 결과**: break 가 2곳 (v900 `ADD UNIQUE` + silica_schema_migration 섹션1 `ADD COLUMN` 둘 다 bare DDL, 이미 존재 → Duplicate). 운영은 이미 Silica 운영 중이라 미적용 12개 패치의 효과가 **대부분 이미 DB 에 반영됨** (검증 SQL 로 확인: 7개 중 5개 적용, user_email·sto_view 만 미적용 — 둘 다 미사용 기능).
  - **데이터 위험 0 확인**: orphan_targets / state_targets / holdings_targets 전부 0 → backfill·UPDATE 적용해도 0행.
  - **조치 (가장 안전한 방식)**: 운영 데이터·스키마에 **DDL/DML 0** — `db_migrations` 에 미적용 11개 (cleanup 제외) 를 `INSERT IGNORE` 로 "이미 적용됨" 기록만 추가 → migrations 가 전부 skip → break 해소. `file_hash='manual'` 로 구분 (되돌리기: `DELETE FROM db_migrations WHERE file_hash='manual'`).
  - `silica_cleanup_dummies.sql` 은 의도적 제외 (H2-2 blocklist 유지).
  - user_email·sto_view 는 "효과 미적용" 으로 기록 — 미사용 기능이라 무관, 필요 시 phpMyAdmin 수동 실행.
  - **잔여 (선택, 개발자 복귀 후)**: v900 + schema_migration 섹션1 의 bare DDL 을 멱등화 (IF NOT EXISTS) 하면 근본 해결 + 신규 환경 재발 방지. 단 현재 운영은 db_migrations 기록으로 이미 안전.
- [ ] **H2-4/H2-5** (audit H2 · 선택적) — **2차 정밀 검증 결과 긴급성 하향**: autoMigrate UPDATE 들이 전부 WHERE 조건부 + 정상 DB 0행 매칭이라 이전 실익 적음. 라우트 ensureSchema 16개도 static 가드 격리됨. 구조 정리 차원에서만.
  - 끄기 스위치 보완 (H2-1 의 D): `user_profile.php:40` / `admin_emails.php:22` self-heal 도 `AUTO_MIGRATE_ENABLED=false` 시 가드 — 단 H2-2 blocklist 로 파괴적 패치는 이미 차단됨.

---

## 정책 결정 사항 (기록)

### `interest_claims` UNIQUE 정책 (devnet vs mainnet)

| 환경 | UNIQUE 적용 | 이유 |
|---|---|---|
| **devnet** | ❌ | testInterestBtn 의 의도된 중복 INSERT 와 충돌. 테스트 환경의 자유로운 중복 허용 |
| **mainnet** | ✅ | 정상 운영에선 각 사용자/자산/월 1행만 정상. race + 인적 오류 보호 |

v376 에서 UNIQUE migration 시도했으나 devnet 의 기존 중복 데이터로 ALTER 실패 → v379 에서 코드 제거. mainnet 전환 시 clean state 에서 재추가.

### 배당 흐름 (v367)

자동 분배 → 클레임 방식 전환. cron 은 `dividend_payouts` 에 status='pending' 만 INSERT (bulk INSERT 가능). 사용자가 `claim.html` 의 [Claim Dividend] 버튼 클릭 시 본인 분만 처리. **1만 명+ 동시 처리 부담 자연 분산**.

미수령 정책: **무기한 대기** (옵션 A). 사용자가 언젠가 들어와서 받으면 그때 처리.

### 재해 복구 흐름 (v347)

14~16일 cron 모두 실패 시 17일 이후 자동 탐지:
- `/api/silica/payment-status` 가 `has_pending=true` 반환
- user 페이지 헤더 아래 빨강 배너 + 모달 자동 노출
- "관리자 지급 완료까지 언스테이킹 금지" 안내
- 관리자가 admin/dividend.html 의 [▶ 즉시 지급] 또는 admin/staking.html 의 force-interest 카드로 수동 처리

---

## 🛑 운영 종료 / Wind-down 절차 (v392~v396)

매각 또는 서비스 종료 결정 시 단계별 운영자 절차. 약관 제10조 (광산 매각, 운영 종료 및 정산) 의 시스템 구현.

### 시나리오 분기 (약관 제10.2조)

| 시나리오 | 절차 |
|---|---|
| **가. 인수자 발생 (서비스 지속)** | 인수자 정보 + 약관 인계 공지. 보유 토큰 / 스테이킹 / 미수령 보상 그대로 유지. 본 wind-down 절차 적용 안 함. |
| **나. 인수자 없음 (운영 종료)** | 아래 5단계 진행. |

### 5단계 운영 절차

전체 UI 위치: `admin/staking.html` 페이지 하단의 빨강 박스 (⚠ 운영 종료 / Wind-down).
각 단계 카드가 현재 state 에 따라 자동 활성/비활성.

#### 1단계 — Wind-down 시작
- **Endpoint**: `POST /api/admin/silica/winddown/begin`
- **효과**: state = `winding_down`, `announced_at` = NOW. 이후 2~5단계 활성.
- **검증**: state = `active` 일 때만 실행 가능.
- **운영자 입력**: 종료 사유 (선택, audit 기록).

#### 2단계 — AMM 매수 풀 설정 (선택)
- **Endpoint**: `POST /api/admin/silica/winddown/set-amm`
- **운영자 입력**: enabled (체크박스), 매수 시세 (USDT), USDT 유동성 한도.
- **참고**: 매수 시세는 회사 재량 — **1토큰 = 1 USDT 보장 안 함** (약관 제10.4조).
  USDT 유동성 소진 시 매수 자동 중단.
- 매호출이 그 시점 설정으로 덮어쓰기 (운영자가 시세 조정 / 유동성 추가 가능).

#### 3단계 — 출금 마감일 설정
- **Endpoint**: `POST /api/admin/silica/winddown/set-deadline`
- **제약**: `announced_at + 최대 2개월` (frontend `input.max` + backend 검증).
- **자동 적용**: `YYYY-MM-DD` 입력 시 KST 23:59:59 자동 보정.

#### 4단계 — 스테이킹 강제 중단 ⚠
- **Endpoint**: `POST /api/admin/silica/winddown/disable-staking`
- **확인 문구**: `스테이킹 중단` 정확 입력.
- **효과**:
  - 모든 stakers 의 `silica_sto_staked` → `silica_sto_balance` 이동 (FOR UPDATE 트랜잭션).
  - 각 사용자 `wallet_transactions` INSERT (kind=`force_unstake`).
  - `silica_audit_log` INSERT (category=`winddown`, action=`force_unstake` per-user + `winddown_disable_staking` 종합).
- **차단**: 매월 **14~16일 KST 락 윈도우 동안 실행 불가** (frontend `button.disabled` + backend `423 Locked`).
- **단일 실행**: 이미 `staking_disabled_at` 있으면 `409 Conflict`.

#### 5단계 — 영구 폐쇄 🛑
- **Endpoint**: `POST /api/admin/silica/winddown/close`
- **확인 문구**: `서비스 종료` 정확 입력.
- **선결 조건**: state = `winding_down` + `withdrawal_deadline` 설정됨.
- **효과**:
  - state = `closed`. (E 단계 후속에서 user API 차단 가드 추가 예정.)
  - 미회수 자금 합계 (silica_sto + silica + usdt) audit 기록.
  - 약관 제10.5조에 따라 **미회수 자금 회사 귀속** 명시.

### 운영자 체크리스트 (실 운영 시점)

운영 종료 결정 이후 D-Day 까지:

- [ ] **법무 검토** — 약관 제10조 / 분쟁 조항 / 미회수 자금 귀속 적법성 변호사 자문
- [ ] **공지** — 사이트 내 공지사항 게시 (**필수**), 배너 / 이메일 (재량)
- [ ] **1단계** Wind-down 시작 — 종료 사유 audit 기록
- [ ] **3단계** 출금 마감일 산정 (D + 최대 2개월)
- [ ] **2단계** (선택) AMM 활성 + USDT 유동성 입금
- [ ] 회원에게 출금 / 매도 / 클레임 안내 (충분한 기간 확보)
- [ ] **14~16일 외 시점**에 **4단계** 스테이킹 강제 중단
- [ ] 출금 마감일 도래까지 cron / 운영 모니터링
- [ ] 마감일 이후 **5단계** 영구 폐쇄
- [ ] 미회수 자금 audit 결과 회계 처리 + 보관

### 약관 / 시스템 매핑

| 약관 조항 | 시스템 구성 |
|---|---|
| 제10.1조 매각 결정 | `admin/sales.html` (현재 hidden — v393) |
| 제10.2조 시나리오 분기 | 운영자 의사결정 (자동 분기 없음) |
| 제10.3조 wind-down 절차 | `admin/staking.html` 5단계 패널 (v396) |
| 제10.4조 정산 기준 (유연) | AMM 시세 회사 재량 (1=1 보장 안 함) |
| 제10.5조 미회수 자금 회사 귀속 | close endpoint audit 기록 |
| 제10.6조 회원 책임 | `user/terms.html` 표시 |

### 미반영 (E 단계 후속 예정)

- [ ] user 헤더 배너 (winding_down 상태 + 출금 마감 카운트다운)
- [ ] **closed 상태에서 user API 차단** (staking/swap/withdraw 가드)
- [ ] user 측 AMM 매도 endpoint + UI
- [ ] 실제 미회수 자금 zero-out (현재는 audit 기록만)
- [ ] 자동 milestone 공지 (D-30 / D-7 / D-Day) — 현재는 운영자 수동

---

## 변경 이력

- **v396 (2026-05-15)**: D-1 — admin/staking.html 에 wind-down 5단계 종합 패널. 각 단계 카드 자동 활성/비활성 + 텍스트 confirm 모달.
- **v395 (2026-05-15)**: C — admin/staking.html 에 [스테이킹 중단] 단일 버튼 (4단계). backend 에 wallet_transactions 기록 추가.
- **v394 (2026-05-15)**: B — `silica_winddown_state` 테이블 + 7개 endpoints. state machine (active → winding_down → closed).
- **v393 (2026-05-15)**: 매각 메뉴 / 페이지 hidden (admin + user). 코드 보존 — 다른 부동산 사이트 활성화 시 hidden 만 제거.
- **v392 (2026-05-15)**: A — 약관 제10조 wind-down 절차 (6 sub-sections) + 제16조 면책 reference. 운영자 결정 반영 (회사 귀속 / 1=1 보장 안 함 / 2개월 제한 / 공지 필수·배너 재량).
- **v380 (2026-05-15)**: 이 체크리스트 신규 작성. admin/settings.html#prod-checklist 와 동기화.
