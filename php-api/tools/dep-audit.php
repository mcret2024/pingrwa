<?php
/**
 * (audit M4 · 2026-06-12) composer 미설치 환경용 의존성 보안 권고 점검 도구.
 *
 * composer.lock 의 전체 패키지를 Packagist 공식 security-advisories API
 * (composer audit 이 내부적으로 사용하는 것과 같은 데이터 소스) 로 조회해
 * 패키지별 잠긴 버전과 알려진 권고를 나란히 출력한다.
 *
 * 사용 (CLI 전용):
 *   php php-api/tools/dep-audit.php
 *
 * 출력 해석:
 *   - 각 권고의 affected 버전 범위에 잠긴(locked) 버전이 포함되는지 사람이 확인.
 *   - 포함되면 업그레이드 검토. disputed CVE 는 NVD 상태 확인 후 판단.
 *
 * 정기 실행 권장: 릴리스 전 + 분기 1회 (PRODUCTION_CHECKLIST 참조).
 * composer 가 있는 환경에서는 `composer audit --locked` 가 더 정확함 (버전
 * 범위 자동 비교) — 이 스크립트는 그 대체재.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

$lockPath = __DIR__ . '/../composer.lock';
if (!is_file($lockPath)) {
    fwrite(STDERR, "composer.lock 없음: {$lockPath}\n");
    exit(1);
}

$lock = json_decode((string)file_get_contents($lockPath), true);
if (!is_array($lock)) {
    fwrite(STDERR, "composer.lock 파싱 실패\n");
    exit(1);
}

$locked = [];
foreach (['packages', 'packages-dev'] as $section) {
    foreach (($lock[$section] ?? []) as $p) {
        if (!empty($p['name'])) $locked[$p['name']] = (string)($p['version'] ?? '?');
    }
}
if (!$locked) {
    fwrite(STDERR, "패키지 없음\n");
    exit(1);
}

$qs = [];
foreach (array_keys($locked) as $name) {
    $qs[] = 'packages[]=' . rawurlencode($name);
}
$url = 'https://packagist.org/api/security-advisories/?' . implode('&', $qs);

$ctx = stream_context_create(['http' => ['timeout' => 20, 'header' => "User-Agent: silica-dep-audit\r\n"]]);
$raw = @file_get_contents($url, false, $ctx);
if ($raw === false && function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_USERAGENT => 'silica-dep-audit']);
    $raw = curl_exec($ch);
    curl_close($ch);
}
if ($raw === false || $raw === null) {
    fwrite(STDERR, "Packagist API 조회 실패 — 네트워크 확인\n");
    exit(1);
}

$data = json_decode((string)$raw, true);
$advisories = $data['advisories'] ?? [];

echo "=== silica 의존성 보안 권고 점검 (" . gmdate('Y-m-d H:i') . " UTC) ===\n";
echo "패키지 " . count($locked) . "개 / 권고 보유 패키지 " . count(array_filter($advisories)) . "개\n";

$flagged = 0;
foreach ($locked as $name => $version) {
    $list = $advisories[$name] ?? [];
    if (!$list) {
        echo "  OK   {$name} {$version} — 권고 없음\n";
        continue;
    }
    $flagged++;
    echo "  CHECK {$name} {$version} — 권고 " . count($list) . "건 (affected 범위와 locked 버전 비교 필요):\n";
    foreach ($list as $adv) {
        echo "        - " . ($adv['title'] ?? '?')
            . " | affected: " . ($adv['affectedVersions'] ?? '?')
            . " | CVE: " . ($adv['cve'] ?? '-') . "\n";
    }
}

echo "\n완료 — CHECK 표시 {$flagged}건은 affected 범위에 locked 버전이 포함되는지 수동 확인.\n";
echo "(2026-06-12 기준 전수 확인 결과는 PRODUCTION_CHECKLIST.md 의 M4 항목 참조)\n";
