# SilicaChain Platform

> **광업권 79907호** 한국 고순도 실리카 광산 RWA 플랫폼
>
> Solana 기반 듀얼 토큰 (SilicaSTO + Silica) 투자 시스템

[![Stack: PHP 8 + MySQL + Solana](https://img.shields.io/badge/Stack-PHP%208%20%2B%20MySQL%20%2B%20Solana-8B5CF6)](.)
[![Theme: Stellar Aurora](https://img.shields.io/badge/Theme-Stellar%20Aurora-EC4899)](.)

---

## 개요

SilicaChain은 한국 단일 실리카 광산(광업권 79907호, SiO₂ 97.04%, 271 ha)을
토큰화하여 투자자에게 다음을 제공하는 RWA(Real World Asset) 플랫폼입니다.

- **고정이자**: 월 USDT 5% (회차 기반)
- **연 배당**: 광산 수익을 Silica 토큰으로 분배
- **3-Tier 추천**: 20% + 5% + 5% 보너스
- **단방향 스왑**: Silica → SilicaSTO

## 토큰 구조

| 토큰 | 심볼 | 가격 | 용도 |
|------|------|------|------|
| **SilicaSTO** | STO | 1 USDT 페그 | 투자증서, 스테이킹, 이자 수령 |
| **Silica** | SLCA | 시장가 변동 | 보상 토큰, 배당 분배, 거래 |

## 기술 스택

- **백엔드**: PHP 8.0+ / MySQL 8.0
- **프론트**: Vanilla HTML / JS (Stellar Aurora 다크 테마)
- **블록체인**: Solana (Devnet → Mainnet)
- **인증**: JWT + OTP (Google Authenticator) + KYC (didit.me)
- **배포**: Hostinger 공유 호스팅 호환

## 폴더 구조

```
silica/
├── admin/              관리자 패널 (24개 페이지)
│   ├── css/            silica-admin.css (Stellar Aurora 다크 테마)
│   ├── img/            로고/파비콘
│   └── js/             admin.core.js, admin.i18n.js, 페이지별 JS
├── user/               사용자 측 (24+ 페이지)
│   ├── assets/
│   │   ├── css/        silica-user.css
│   │   ├── images/     로고/이미지
│   │   ├── includes/   site-header.html, site-footer.html
│   │   └── js/         core.js, i18n.js, app.js, pages/
├── php-api/            REST API
│   ├── lib/            config, db, auth, jwt, solana, silica, fx, mailer
│   ├── routes/         29 + 5 (Silica 신규)
│   └── cron/           월 이자 / 연 배당 cron
├── sql/                마이그레이션 (Recon 패치 + Silica 스키마)
├── rwa.sql             기본 DB 스키마 (32 테이블)
├── install.php         원클릭 설치
└── DEPLOY_SILICA.md    배포 가이드
```

## 설치 가이드

### 1. 코드 배포

```bash
git clone https://github.com/mcret2024/silica.git
cd silica
```

### 2. PHP 의존성

```bash
cd php-api
composer install --no-dev --optimize-autoloader
cd ..
```

### 3. 환경 변수

```bash
cp php-api/.env.example php-api/.env
nano php-api/.env  # DB 정보, JWT 비밀키 입력
```

### 4. 원클릭 설치

브라우저에서 `https://your-domain.com/install.php` 접속 후 양식 작성:
- DB 정보
- 도메인
- 관리자 비밀번호
- Helius RPC API 키 (선택)

설치 시 자동 처리:
- DB 테이블 31개 생성 (`rwa.sql`)
- Silica 마이그레이션 적용 (`sql/silica_schema_migration.sql`)
- 단일 자산 시드 (광업권 79907호)
- 관리자 계정 생성
- `.env` 파일 자동 생성
- `.htaccess` 작성

설치 완료 후:
- `install.php` 자동으로 `.installed` 락 파일 생성 (재실행 방지)
- 보안 위해 `install.php` 삭제 권장

### 5. SPL 토큰 배포 (외부)

```bash
# Solana CLI 필요
solana-keygen new -o ~/silica-sto-keypair.json
spl-token create-token --decimals 6 --url devnet
spl-token create-token --decimals 6 --url devnet
```

배포 후 mint 주소를 관리자 패널 → 환경설정 → 토큰 Mint 항목에 입력.

### 6. Cron 등록 (HTTP curl 방식)

```cron
0 * 14-16 * *  curl -s "https://rwa.silicachainholding.com/api/cron/accrue-interest?key=$CRON_KEY" > /dev/null
30 9 14-16 * * curl -s "https://rwa.silicachainholding.com/api/cron/distribute-dividends?key=$CRON_KEY" > /dev/null
*/15 * * * *   curl -s "https://rwa.silicachainholding.com/api/cron/fx?key=$CRON_KEY" > /dev/null
```

CRON_KEY 인증 + 서버측 KST 시간 가드 + claim-based 지급 모델이 모두
적용된 단일 경로. CLI 스크립트(monthly_interest_cron / dividend_payout_cron)
는 claim flow 우회로 인한 더블 페이먼트 위험 때문에 제거되었습니다 —
재해복구는 admin/staking.html 의 [과거 회차 catch-up] UI 를 사용.

자세한 배포는 [`DEPLOY_SILICA.md`](DEPLOY_SILICA.md) 참조.

## Silica 신규 기능 (Phase A~F)

### Phase A: DB 스키마
- `sql/silica_schema_migration.sql` (334줄)
- 9개 신규 테이블: `silica_price_history`, `interest_rate_history`,
  `dividend_executions`, `dividend_payouts`, `silica_swaps`,
  `popup_announcements`, `popup_dismissals`, `silica_referral_bonus`, `silica_audit_log`
- `assets`, `holdings`, `interest_claims` 테이블 ALTER

### Phase B: PHP API (22 엔드포인트)
- `admin_silica_tokens.php` — Mint 주소 관리
- `admin_silica_price.php` — Silica 시세 (관리자 직접 / 거래소 API)
- `admin_silica_rate.php` — **회차 기반** 이자율 (다음 회차부터 적용)
- `admin_silica_dividend.php` — 연 배당 실행/취소/수정
- `admin_silica_popups.php` — 공지 팝업 관리

### Phase D: Solana 연동
- `lib/silica.php` — 13개 헬퍼 함수
- 듀얼 토큰 (SilicaSTO + Silica) mint 관리
- 시세 ↔ 스왑 비율 자동 환산

### Phase E: Cron 작업 (HTTP 엔드포인트 통합)
- `POST/GET /api/cron/accrue-interest` (staking.php) — 매월 14-16일 USDT 이자 pending row INSERT
- `POST/GET /api/cron/distribute-dividends` (admin_silica_dividend.php) — 연 배당 pending row INSERT (claim-based)
- `POST/GET /api/cron/fx` (admin_fx.php) — FX provider chain 자동 fallback
- CLI 직접 지급 스크립트는 claim flow 우회 위험으로 제거

### Phase F: 배포 가이드
- `DEPLOY_SILICA.md` — 10단계 가이드
- `.env.example` — 환경 변수 템플릿

## 디자인 (Stellar Aurora)

- **타이포그래피**: Bebas Neue + Unbounded + Oswald + Inter
- **컬러**: 보라(#8B5CF6) + 핑크(#EC4899) + 시안(#06B6D4)
- **다크 테마**: 별자리 배경, 오로라 그라디언트
- **헤더 nav**: 한국어/English 토글, 알림 뱃지

## 비즈니스 로직

### 회차(Cycle) 기반 이자
- 회차 = 매월 16일 ~ 다음달 15일 (지급일 = 15일)
- 이자율 변경 → **다음 회차부터** 적용 (이번 회차는 영향 없음)
- "이번 회차" 판별: 실행일 ≤15 → 당월, ≥16 → 다음달

### 연 배당
- 한국 회계 결산 후 4~5월 지급 (관리자 수동 실행)
- USDT 풀 → Silica 시세로 환산 → Silica 토큰 분배
- 배당월 선택: **이번 회차 제외, 다음 회차부터**
- 대상: 지급일 시점 스테이킹 중인 유저

### 단방향 스왑
- Silica → SilicaSTO만 (반대 불가)
- 환산: `1 SilicaSTO = (1 USDT / Silica 시세) Silica`

## 라이센스

Private / Proprietary — © 2026 SILICA CHAIN HOLDINGS

## 연락

- **이메일**: investor@silicachain.io
- **광업권 정보**: 광업권 79907호 (대한민국)
