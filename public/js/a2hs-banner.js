// Add-to-Home-Screen banner — shared by the customer site (/bakers, baker
// profile pages) and the baker app (/app). Self-contained: injects its own
// scoped styles so it looks identical regardless of which stylesheet the host
// page loads. Shows once per device, on mobile, when not already installed.
(function () {
  var DISMISS_KEY = 'bkd_a2hs_dismissed';

  // --- gates -------------------------------------------------------------
  function alreadyDismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }
  function isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent);
  }
  // Customer directory + profile pages, or anywhere in the baker app.
  function onAllowedPage() {
    var p = window.location.pathname;
    return p === '/bakers' || p.indexOf('/bakers/') === 0 ||
      p === '/app' || p.indexOf('/app/') === 0;
  }
  // The baker app is a fixed-height flex column with a bottom nav, so the
  // banner must sit above it; the customer site spans full width.
  function isBakerApp() {
    var p = window.location.pathname;
    return p === '/app' || p.indexOf('/app/') === 0;
  }

  if (alreadyDismissed() || isStandalone() || !isMobile() || !onAllowedPage()) return;

  // --- styles ------------------------------------------------------------
  var css = '' +
    '.bkd-a2hs *{box-sizing:border-box;font-family:"Poppins",-apple-system,BlinkMacSystemFont,sans-serif;}' +
    '.bkd-a2hs{position:fixed;left:0;right:0;bottom:0;z-index:9998;display:flex;align-items:center;gap:12px;' +
      'background:#FDF6F9;border-top:1px solid #F0E8EE;box-shadow:0 -6px 20px -10px rgba(44,26,36,0.25);' +
      'padding:13px 16px calc(13px + env(safe-area-inset-bottom));font-family:"Poppins",-apple-system,sans-serif;}' +
    '.bkd-a2hs--app{max-width:440px;left:50%;transform:translateX(-50%);' +
      'bottom:calc(72px + env(safe-area-inset-bottom));padding-bottom:13px;border-radius:14px;' +
      'border:1px solid #F0E8EE;box-shadow:0 10px 30px -10px rgba(44,26,36,0.35);}' +
    '.bkd-a2hs__text{flex:1;font-size:13px;line-height:1.5;color:#2C1A24;font-weight:400;}' +
    '.bkd-a2hs__link{background:none;border:0;padding:0;margin:0;font:inherit;color:#C2557E;font-weight:500;' +
      'cursor:pointer;text-decoration:underline;white-space:nowrap;}' +
    '.bkd-a2hs__close{flex-shrink:0;background:none;border:0;cursor:pointer;color:#7A5068;font-size:22px;' +
      'line-height:1;padding:2px 4px;}' +
    '.bkd-a2hs-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;' +
      'background:rgba(44,26,36,0.45);padding:0;}' +
    '.bkd-a2hs-modal__card{background:#FDF6F9;width:100%;max-width:440px;border-radius:22px 22px 0 0;' +
      'padding:24px 22px calc(28px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(44,26,36,0.3);}' +
    '.bkd-a2hs-modal__head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}' +
    '.bkd-a2hs-modal__head h3{margin:0;font-size:18px;font-weight:500;color:#2C1A24;}' +
    '.bkd-a2hs-modal__close{background:none;border:0;cursor:pointer;color:#7A5068;font-size:24px;line-height:1;padding:0 4px;}' +
    '.bkd-a2hs-tabs{display:flex;gap:8px;margin-bottom:18px;}' +
    '.bkd-a2hs-tabs button{flex:1;padding:10px;border:1px solid #D4C8E0;background:#fff;border-radius:999px;' +
      'font:inherit;font-size:14px;font-weight:500;color:#7A5068;cursor:pointer;}' +
    '.bkd-a2hs-tabs button.is-active{background:#C2557E;border-color:#C2557E;color:#fff;}' +
    '.bkd-a2hs-steps{margin:0;padding-left:20px;color:#2C1A24;font-size:14px;line-height:1.7;font-weight:400;}' +
    '.bkd-a2hs-steps[hidden]{display:none;}' +
    '.bkd-a2hs-steps b{font-weight:500;}';

  var style = document.createElement('style');
  style.id = 'bkd-a2hs-style';
  style.textContent = css;
  document.head.appendChild(style);

  // --- banner ------------------------------------------------------------
  var banner = document.createElement('div');
  banner.className = 'bkd-a2hs' + (isBakerApp() ? ' bkd-a2hs--app' : '');
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Add Bkd Local to your home screen');
  banner.innerHTML =
    '<span class="bkd-a2hs__text">Save Bkd Local to your home screen for the fastest experience — no app store needed. ' +
    '<button type="button" class="bkd-a2hs__link" id="bkdA2hsHow">How to add it</button></span>' +
    '<button type="button" class="bkd-a2hs__close" id="bkdA2hsClose" aria-label="Dismiss">&times;</button>';
  document.body.appendChild(banner);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    if (banner.parentNode) banner.parentNode.removeChild(banner);
  }
  document.getElementById('bkdA2hsClose').addEventListener('click', dismiss);

  // --- modal -------------------------------------------------------------
  function openModal() {
    var modal = document.createElement('div');
    modal.className = 'bkd-a2hs-modal';
    modal.innerHTML =
      '<div class="bkd-a2hs-modal__card" role="dialog" aria-modal="true" aria-label="How to add Bkd Local">' +
        '<div class="bkd-a2hs-modal__head"><h3>Add to your home screen</h3>' +
          '<button type="button" class="bkd-a2hs-modal__close" aria-label="Close">&times;</button></div>' +
        '<div class="bkd-a2hs-tabs">' +
          '<button type="button" data-tab="ios" class="is-active">iOS</button>' +
          '<button type="button" data-tab="android">Android</button>' +
        '</div>' +
        '<ol class="bkd-a2hs-steps" data-pane="ios">' +
          '<li>Open Bkd Local in <b>Safari</b>.</li>' +
          '<li>Tap the <b>Share</b> button.</li>' +
          '<li>Tap <b>Add to Home Screen</b>.</li>' +
        '</ol>' +
        '<ol class="bkd-a2hs-steps" data-pane="android" hidden>' +
          '<li>Open Bkd Local in <b>Chrome</b>.</li>' +
          '<li>Tap the <b>three-dot menu</b>.</li>' +
          '<li>Tap <b>Add to Home Screen</b>.</li>' +
        '</ol>' +
      '</div>';
    document.body.appendChild(modal);

    function closeModal() { if (modal.parentNode) modal.parentNode.removeChild(modal); }
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector('.bkd-a2hs-modal__close').addEventListener('click', closeModal);

    var tabs = modal.querySelectorAll('.bkd-a2hs-tabs button');
    var panes = modal.querySelectorAll('.bkd-a2hs-steps');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        panes.forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== tab.getAttribute('data-tab'); });
      });
    });
  }
  document.getElementById('bkdA2hsHow').addEventListener('click', openModal);
})();
