/**
 * (2026-06-07 v867) VPN/DNS 안내 카드 — 조건부 표시.
 *
 * 운영자 의도: 안내 카드를 모든 유저에게 항상 보여주지 말고,
 *   VPN 사용 의심 사용자에게만 표시.
 *
 * 감지 로직 (heuristic):
 *   1. 브라우저 timezone (Intl.DateTimeFormat) 을 backend 에 전달.
 *   2. backend (/api/public/geo) 가 client IP 의 country (CF-IPCountry 헤더)
 *      를 알아내고, country 의 typical timezone 과 mismatch 면 is_likely_vpn=true.
 *   3. dismissed=1 이 localStorage 에 있으면 표시 안 함 (한 번 닫으면 안 보임).
 *   4. detection_available=false (Cloudflare 헤더 없음) → 안전 측 hide.
 *
 * HTML 구조 요구:
 *   <div id="vpnNoticeCard" style="display:none">
 *     ...본문...
 *     <button id="vpnNoticeClose" type="button">×</button>
 *   </div>
 *
 * 4 페이지에서 사용: deposit.html, withdraw.html, kyc-certification.html, kyc-ready.html
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'vpn_notice_dismissed_v1';

  function isDismissed() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch (_) { return false; }
  }

  function markDismissed() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
  }

  function getBrowserTz() {
    try {
      return (Intl && Intl.DateTimeFormat &&
              Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
    } catch (_) { return ''; }
  }

  function showCard(card) {
    if (!card) return;
    card.style.display = '';
    card.removeAttribute('hidden');
  }

  function hideCard(card) {
    if (!card) return;
    card.style.display = 'none';
  }

  async function check() {
    var card = document.getElementById('vpnNoticeCard');
    if (!card) return;             // 페이지에 카드 없음 — no-op

    // 1) dismissed 면 즉시 hide
    if (isDismissed()) { hideCard(card); return; }

    // 2) backend 에 GeoIP + tz 조회
    var tz = encodeURIComponent(getBrowserTz());
    var url = '/api/public/geo?tz=' + tz;

    try {
      var resp = await fetch(url, { credentials: 'omit' });
      if (!resp.ok) { hideCard(card); return; }
      var data = await resp.json().catch(function () { return null; });
      // jsonOk wrap: { ok: true, data: {...} } 가능성 + bare 가능성 모두 처리
      var payload = data && data.data ? data.data : data;
      if (!payload) { hideCard(card); return; }

      // 감지 자체가 불가능 (서버에 country 없음) → 안전 측 hide
      if (payload.detection_available === false) { hideCard(card); return; }

      if (payload.is_likely_vpn === true) {
        showCard(card);
      } else {
        hideCard(card);
      }
    } catch (_) {
      // 네트워크/JSON 오류 — 안전 측 hide (VPN 의심 카드 false-positive 방지)
      hideCard(card);
    }
  }

  function bindDismiss() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === 'vpnNoticeClose' || (t.closest && t.closest('#vpnNoticeClose'))) {
        markDismissed();
        var card = document.getElementById('vpnNoticeCard');
        hideCard(card);
      }
    });
  }

  function init() {
    bindDismiss();
    check();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
