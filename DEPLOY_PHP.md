# RWA Platform - PHP 배포 가이드 (Hostinger 공유 호스팅)

## 개요

이 가이드는 Node.js가 아닌 **PHP + MySQL** 기반 Hostinger 공유 호스팅에 RWA 플랫폼을 배포하는 방법을 설명합니다.

## 요구사항

- Hostinger Business/Premium 공유 호스팅
- PHP 8.0 이상 (8.2+ 권장)
- MySQL 8.0
- PHP 확장: `pdo_mysql`, `mbstring`, `curl`, `gmp`, `bcmath`, `json`, `intl`

## 파일 구조

```
public_html/
├── .htaccess           # URL 라우팅 (루트)
├── admin/              # 관리자 프론트엔드 (정적 파일)
├── user/               # 사용자 프론트엔드 (정적 파일)
├── uploads/            # 업로드 파일 디렉토리
└── php-api/            # PHP API 백엔드
    ├── .htaccess       # API 라우팅
    ├── .env            # 환경 변수 설정 파일
    ├── index.php       # API 라우터 (진입점)
    ├── composer.json    # PHP 의존성
    ├── vendor/         # Composer 패키지 (composer install 후 생성)
    ├── lib/            # 핵심 라이브러리
    │   ├── config.php  # 환경 설정 로드
    │   ├── db.php      # PDO DB 연결
    │   ├── helpers.php # 유틸리티 함수
    │   ├── jwt_helper.php  # JWT 토큰
    │   ├── auth.php    # 인증 미들웨어
    │   ├── solana.php  # Solana 헬퍼
    │   └── fx.php      # 환율 헬퍼
    └── routes/         # API 라우트 파일들
        ├── public.php
        ├── auth.php
        ├── otp.php
        ├── assets.php
        ├── contracts.php
        ├── funding.php
        ├── staking.php
        ├── markets.php
        ├── portfolio.php
        ├── deposit_withdraw.php
        ├── sales.php
        ├── kyc.php
        ├── token_withdraw.php
        ├── admin_auth.php
        ├── admin_assets.php
        ├── admin_sales.php
        ├── admin_settings.php
        ├── admin_dashboard.php
        ├── admin_contracts.php
        ├── admin_withdraw.php
        ├── admin_fx.php
        └── admin_token_withdraw.php
```

## 배포 단계

### 1단계: MySQL 데이터베이스 생성

1. hPanel → 데이터베이스 → MySQL
2. 데이터베이스 이름: `rwa` (실제: `u123456789_rwa`)
3. 사용자 이름: `rwa_manager` (실제: `u123456789_rwa_manager`)
4. 비밀번호: 강력한 비밀번호 생성

### 2단계: 테이블 가져오기

1. hPanel → phpMyAdmin 열기
2. `rwa.sql` 파일 가져오기 (Import)
3. `api/migration_v2.sql` 파일 가져오기

### 3단계: 파일 업로드

1. hPanel → 파일 관리자 또는 FTP
2. `public_html/` 디렉토리에 다음 업로드:
   - `.htaccess` (루트 라우팅)
   - `admin/` 폴더 전체
   - `user/` 폴더 전체
   - `php-api/` 폴더 전체 (vendor 제외)
3. `uploads/` 폴더 생성 (`chmod 755`)

### 4단계: Composer 설치

SSH 접속이 가능한 경우:
```bash
cd ~/domains/yourdomain.com/public_html/php-api
php composer.phar install --no-dev --optimize-autoloader
```

SSH가 없는 경우:
- 로컬에서 `composer install --no-dev` 실행 후 `vendor/` 폴더를 함께 업로드

### 5단계: 환경 변수 설정

`php-api/.env.example`을 `php-api/.env`로 복사하고 편집:

```bash
cp php-api/.env.example php-api/.env
```

필수 설정:
```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=u123456789_rwa_manager
DB_PASSWORD=실제비밀번호
DB_NAME=u123456789_rwa

JWT_SECRET=랜덤32자이상
ADMIN_JWT_SECRET=다른랜덤32자이상
ADMIN_KEY=관리자API키

PUBLIC_DIR=/home/u123456789/domains/yourdomain.com/public_html
UPLOAD_DIR=/home/u123456789/domains/yourdomain.com/public_html/uploads

CORS_ORIGIN=https://yourdomain.com

BYPASS_OTP=1
BYPASS_KYC=1
```

### 6단계: SSL 설정

1. hPanel → 보안 → SSL
2. 무료 Let's Encrypt SSL 설치
3. HTTPS 리다이렉트 강제

### 7단계: 프론트엔드 API Base URL 설정

관리자 로그인 후 API Base URL을 `https://yourdomain.com`으로 설정하거나,
프론트엔드 JS 파일에서 localStorage에 API base URL 저장.

### 8단계: 확인

| 확인 항목 | URL / 명령 |
|-----------|------------|
| API 상태 | `https://yourdomain.com/api/health` → `{"ok":true}` |
| 관리자 로그인 | `https://yourdomain.com/admin/login.html` |
| 사용자 페이지 | `https://yourdomain.com/user/` |
| 파일 업로드 | uploads 폴더 권한 755 |

기본 관리자: `admin / admin1234` (로그인 후 비밀번호 변경)

## FX 환율 업데이트 (크론)

Hostinger 크론 작업 (선택사항, 별도 PHP 스크립트 필요):
```
*/3 * * * * cd /home/u123456789/domains/yourdomain.com/public_html/php-api && php fx_worker.php
```

## 문제 해결

| 증상 | 확인사항 |
|------|---------|
| 404 에러 | `.htaccess` 파일 확인, `mod_rewrite` 활성화 |
| 500 에러 | `php-api/.env` 설정 확인, PHP 에러 로그 |
| DB 연결 실패 | DB 자격증명, 호스트 확인 |
| CORS 에러 | `CORS_ORIGIN` 에 도메인 추가 |
| 파일 업로드 실패 | `uploads/` 폴더 존재 및 권한 755 |
| OTP 실패 | 테스트시 `BYPASS_OTP=1` |
| composer 오류 | PHP 8.0+ 확인, 필수 확장 설치 |

## Node.js 대비 변경사항

| 기능 | Node.js | PHP |
|------|---------|-----|
| 런타임 | Node.js 20+ | PHP 8.0+ |
| 패키지 관리 | npm | Composer |
| HTTP 서버 | Express.js | Apache + .htaccess |
| DB 라이브러리 | mysql2 | PDO (내장) |
| JWT | jsonwebtoken | firebase/php-jwt |
| OTP | speakeasy | spomky-labs/otphp |
| QR Code | qrcode | endroid/qr-code |
| Solana | @solana/web3.js | curl + JSON-RPC |
| bcrypt | bcrypt | password_hash() (내장) |
| 환율 수집기 | api/rwa_quote.js | 별도 PHP cron 스크립트 |
