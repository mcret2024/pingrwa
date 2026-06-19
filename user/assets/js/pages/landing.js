// public/assets/js/pages/landing.js
(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  // Concept A 디자인 적용 이후 landing은 완전 정적이며, 별도 렌더링 훅이 필요 없음.
  // 과거 injectFxNotice(자산별 정산 기준 배너)는 신규 디자인의 Trust 섹션과
  // 중복되고 상단 배치가 부자연스러워 제거함.
  // (2026-05-18 v557) 사용중지된 사용자가 다른 페이지에서 redirect 되어 도착할
  //   때 sessionStorage 의 rwa_account_suspended 플래그를 읽고 글로벌 모달을
  //   표시. 플래그를 읽은 후 즉시 제거 — 새로고침 시 사용자가 직접 보러
  //   온 경우엔 다시 표시되지 않음. 단, 백그라운드 status check 가 또 403 을
  //   받으면 core.js api() 가 다시 플래그를 설정해 모달이 재표시된다.
  window.RwaPages["landing"] = async () => {
    try {
      const raw = sessionStorage.getItem('rwa_account_suspended');
      if (!raw) return;
      sessionStorage.removeItem('rwa_account_suspended');
      const info = JSON.parse(raw) || {};
      // RwaCore.showAccountSuspendedModal 가 노출되어 있으면 그것을, 없으면 ignore.
      if (typeof window.RwaCore?.showAccountSuspendedModal === 'function') {
        window.RwaCore.showAccountSuspendedModal({
          suspended_reason: info.suspended_reason || '',
          suspended_at: info.suspended_at || '',
        });
      }
    } catch (_) {}
  };
})();
