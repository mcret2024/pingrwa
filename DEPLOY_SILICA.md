# SilicaChain 배포 가이드

## 환경 요구사항

- **PHP**: 8.0+ (8.2 권장)
- **MySQL**: 8.0+
- **Composer**: PHP 패키지 관리
- **Apache**: `.htaccess` 활성화 (mod_rewrite)
- **HTTPS**: 필수 (KYC, 결제용)

---

## 1. 코드 배포

```bash
# Git 또는 FTP로 silica/ 폴더 전체를 서버에 업로드
# 예: /home/user/domains/silicachain.io/public_html/

cd /path/to/silicachain
```

## 2. PHP 의존성 설치

```bash
cd php-api
composer install --no-dev --optimize-autoloader
```

## 3. 환경 변수 설정

```bash
cp php-api/.env.example php-api/.env
# .env를 편집하여 실제 값 입력
nano php-api/.env
```

**필수 설정**:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `ADMIN_JWT_SECRET` (각 32+ 자 랜덤)
- `ADMIN_KEY`
- `ADMIN_INITIAL_PASSWORD`
- `BYPASS_OTP=0`, `BYPASS_KYC=0` (프로덕션)
- `HELIUS_RPC_URL`

## 4. 데이터베이스 초기화

### 4-1. 기본 스키마 (Recon)

```bash
mysql -u silica_user -p silica_db < rwa.sql
```

### 4-2. Silica 마이그레이션

```bash
mysql -u silica_user -p silica_db < sql/silica_schema_migration.sql
```

이 마이그레이션이 추가하는 것:
- `assets` 테이블에 광산 특화 컬럼 (sio2_purity, mine_area_ha 등)
- 단일 자산 시드 (광업권 79907호)
- 9개 신규 테이블 (silica_price_history, interest_rate_history, dividend_executions, dividend_payouts, silica_swaps, popup_announcements, popup_dismissals, silica_referral_bonus, silica_audit_log)

### 4-3. 기존 핫픽스 (선택)

```bash
for f in sql/manual_*.sql; do
  echo "Applying $f..."
  mysql -u silica_user -p silica_db < "$f"
done
```

### 4-4. 검증

```sql
SELECT v FROM app_settings WHERE k='silica_schema_version';
-- 결과: "1.0.0"

SELECT COUNT(*) FROM assets WHERE id='SILICA-79907';
-- 결과: 1
```

## 5. 관리자 계정 생성

```bash
# 자동: install.php 실행 (브라우저)
# 또는 수동:
mysql -u silica_user -p silica_db -e "
INSERT INTO admins (username, password_hash, otp_secret, role)
VALUES (
  'admin',
  '$2y$10$...',  -- bcrypt of your password
  'BASE32_OTP',
  'super'
);
"
```

## 6. Apache `.htaccess` 확인

`silica/.htaccess`가 다음 규칙을 포함해야 함:

```apache
RewriteEngine On

# /api/* → php-api/index.php
RewriteRule ^api/(.*)$ php-api/index.php [L,QSA]

# /assets/* → user/assets/*
RewriteRule ^assets/(.*)$ user/assets/$1 [L]

# Default to user/index.html for unknown paths
DirectoryIndex index.html
```

## 7. 토큰 배포 (외부)

별도 도구로 SPL 토큰 배포 (admin 패널에는 mint 주소만 입력):

```bash
# Devnet 예시
solana-keygen new -o silica-sto-keypair.json
solana airdrop 2 --url devnet
spl-token create-token --decimals 6 --url devnet  # SilicaSTO
spl-token create-token --decimals 6 --url devnet  # Silica

# Output mint address를 admin/settings.html에 입력
```

## 8. Cron 작업 등록 (Hostinger cPanel / 외부 cron)

운영 cron 은 **HTTP curl 방식만** 사용합니다. CRON_KEY 인증 + 서버측 KST
시간 가드(14-16일 lock window) + claim-based 지급 모델이 통합 적용된 단일
경로입니다. CLI 스크립트는 claim flow 우회로 인한 더블 페이먼트 위험이 있어
제거되었습니다 (이자 수동 보충은 `admin/staking.html` 의 [과거 회차 catch-up]
UI 를 사용하세요).

```cron
# 매월 14-16일 매시각: 월 이자 배정 (lock window 내 idempotent)
0 * 14-16 * * curl -s "https://rwa.silicachainholding.com/api/cron/accrue-interest?key=$CRON_KEY" > /dev/null 2>&1

# 매월 14-16일 09:30: 연 배당 지급 (scheduled 인 경우만, 자동 재시도 포함)
30 9 14-16 * * curl -s "https://rwa.silicachainholding.com/api/cron/distribute-dividends?key=$CRON_KEY" > /dev/null 2>&1

# 15분마다: FX 환율 수집 (CLI 그대로 유지 — 잔액 무관)
*/15 * * * * curl -s "https://rwa.silicachainholding.com/api/cron/fx?key=$CRON_KEY" > /dev/null 2>&1
```

## 9. 첫 로그인 후 설정 (관리자 패널)

1. **로그인**: `https://silicachain.io/admin/login.html`
2. **시스템 설정**: `/admin/settings.html`
   - Solana 네트워크: devnet (테스트) 또는 mainnet-beta (운영)
   - USDT mint, SilicaSTO mint, Silica mint 입력
   - 입금 / 출금 관리자 지갑 주소
   - 환율 (USDT/KRW)
3. **Silica 시세**: `/admin/silica-price.html`
   - 초기 시세 입력 (예: 0.05 USDT)
4. **이자율**: `/admin/interest-rates.html`
   - 기본 5% 그대로 두거나 변경
5. **자산 정보**: `/admin/asset.html`
   - 광업권 79907호 정보 확인 (자동 시드됨)
6. **공지 팝업**: `/admin/popups.html`
   - 시작 안내 팝업 작성

## 10. 보안 점검

```bash
# install.php 삭제 (재설치 방지)
rm install.php

# .env 파일 권한
chmod 600 php-api/.env

# uploads 폴더 권한
chmod 755 uploads/
chmod 755 php-api/uploads/

# vendor 폴더는 web access 차단 (.htaccess에 이미 포함되어야 함)
```

---

## 모니터링

### 헬스 체크 엔드포인트
- `GET /api/public/config` → 정상 응답 200
- `GET /api/silica/price` → 현재 시세 조회
- `GET /api/silica/rate` → 현재 이자율

### 로그
- PHP 에러 로그: `/var/log/apache2/error.log` 또는 호스팅 패널
- Cron 로그: `/var/log/silica-cron.log`
- DB 감사 로그: `silica_audit_log` 테이블

### 정기 점검
- **주 1회**: silica_audit_log에서 비정상 패턴 확인
- **월 1회**: dividend_payouts.status='failed' 체크
- **분기 1회**: 백업 + 복원 테스트

---

## 트러블슈팅

### 헤더 로드 실패
- `.htaccess`의 `/assets/` rewrite 규칙 확인
- Apache `mod_rewrite` 활성화 여부

### 401 Unauthorized
- JWT_SECRET이 .env에 설정되어 있는지
- 토큰이 만료되었는지

### 토큰 mint 미설정 오류
- admin/settings.html에서 SilicaSTO/Silica mint 등록 필요

### Cron 미실행
- `php-api/.env` 경로가 cron 환경에서 제대로 로드되는지
- `php` 바이너리 풀패스 사용 권장: `/usr/bin/php`

---

## 11. 관리자 입금 지갑 교체 절차 (v825+) ⚠️ 중요

### 배경

v825 (2026-05-26) 부터 **deposit hijacking 방어** 가 적용되어, 관리자 입금
지갑 주소 변경은 **두 곳을 함께 갱신** 해야 합니다:

1. `user/assets/js/pages/deposit.js` 의 하드코딩된 `KNOWN_ADMIN_WALLETS` 배열
2. 관리자 패널 → 설정 → `deposit_admin_usdt_address` (DB settings)

둘이 일치하지 않으면 사용자 입금 페이지에 **"입금 차단 — 보안 경고"** 모달이
뜨며 입금이 차단됩니다. 이건 의도된 동작입니다 (해커가 settings 만 변조한
경우도 동일하게 막아주는 방어선).

### 안전한 교체 순서 (절대 어기지 말 것)

```
[ ] 1. deposit.js 의 KNOWN_ADMIN_WALLETS 배열에 새 주소 *추가*
       (기존 주소는 그대로 둠 — 캐시된 구 클라이언트 호환용)
[ ] 2. deposit.html 의 캐시 버스터 버전 올림 (예: v826-rotate-wallet)
[ ] 3. 호스팅(Hostinger) 에 배포 → 브라우저에서 ctrl+shift+r 로 적용 확인
[ ] 4. 관리자 페이지 → 설정 → deposit_admin_usdt_address 를 새 주소로 변경
[ ] 5. 본인이 직접 한 번 테스트 입금 (소액 — 1 USDT 등)
[ ] 6. 공지: "관리자 입금 지갑이 교체되었습니다. 페이지를 새로고침 해주세요."
[ ] 7. (선택, 1~2주 후) KNOWN_ADMIN_WALLETS 에서 옛 주소 제거 → 재배포
```

### 절대 하지 말 것

- ❌ **순서를 바꿔서 4번 먼저** → 모든 사용자 입금이 즉시 차단됨 (사고)
- ❌ **KNOWN_ADMIN_WALLETS 에서 옛 주소 즉시 제거** → 캐시된 클라이언트 입금 차단
- ❌ **`Object.freeze()` 빼기** → allowlist 의 런타임 변조 방어 효과 사라짐

### 코드 위치 참조

```javascript
// 파일: user/assets/js/pages/deposit.js
// 줄: 약 25~30번 (window.RwaPages.deposit 정의 바로 위)

const KNOWN_ADMIN_WALLETS = Object.freeze([
  'BZvdF5dUnZ8BGvQcSJH8L3qhZaypNX3T2tVmb2WFFMgu', // 2026-02-23 ~
  // 'NEW_WALLET_ADDR_HERE',  ← 여기에 추가 (기존 주소 위에 그대로 두기)
]);
```

```html
<!-- 파일: user/deposit.html -->
<!-- 줄: 약 728번 -->
<script src="assets/js/app.js?v=20260526v825-deposit-hijack-defense"></script>
                                  ↑ 이 버전을 v826-... 등으로 올림
```

### 만약 잘못 진행해서 모든 사용자 입금이 차단된 경우

긴급 복구:
1. 관리자 패널 → 설정 → `deposit_admin_usdt_address` 를 **옛 주소로 되돌림**
2. 또는: deposit.js 의 `KNOWN_ADMIN_WALLETS` 배열에 새 주소를 추가하고 즉시 배포

두 방법 중 더 빠른 쪽을 선택. 사용자는 자동으로 정상화됨.

### Server 측 보호

서버 (`routes/deposit_withdraw.php`) 도 `validateDepositTransactionStructure()`
로 broadcast 전 검증을 수행. settings 의 `deposit_admin_usdt_address` 를 기준
으로 admin ATA 를 derive 해서 signed tx 의 destination 과 비교. 즉:

- 클라이언트 allowlist = settings 변조 방어
- 서버 검증 = 클라이언트 변조 방어 (XSS, MITM 등)

지갑 교체 시에는 settings 만 바꾸면 서버는 자동으로 새 주소로 derive하지만,
클라이언트 allowlist 가 막아주므로 **위 순서를 반드시 지켜야 합니다.**

---

**버전**: 1.1.0  (v825 deposit hijacking 방어 반영)
**최종 업데이트**: 2026-05-26
