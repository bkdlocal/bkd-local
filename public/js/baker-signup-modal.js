// Logged-out baker-profile signup modal. Intercepts "Request an order" taps,
// collects a quick account, auto-logs-in via /api/customer/quick-signup, then
// continues to the order request flow. Only present when the visitor is
// logged out (the server omits it for signed-in customers).
(function () {
  const modal = document.getElementById('bakerSignupModal');
  if (!modal) return;
  const bakerId = modal.getAttribute('data-baker-id') || '';
  const ref = new URLSearchParams(window.location.search).get('ref') || '';
  const form = document.getElementById('bsmForm');
  const err = document.getElementById('bsmError');
  const titleEl = modal.querySelector('.bsm-title');
  const subEl = modal.querySelector('.bsm-sub');
  const defaultTitle = titleEl ? titleEl.textContent : '';
  const defaultSub = subEl ? subEl.textContent : '';
  let targetHref = '/customer/orders';

  function setCopy(title, sub) {
    if (titleEl && title != null) titleEl.textContent = title;
    if (subEl && sub != null) subEl.textContent = sub;
  }

  function open(href) {
    if (href) targetHref = href;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  // Opened from a favorite-heart tap: reframe the copy around saving this baker
  // and complete the favorite after signup/login via /bakers/<id>?fav=1.
  document.addEventListener('bkd:fav-signup', function (e) {
    var d = (e && e.detail) || {};
    var id = d.bakerId || bakerId;
    var name = d.bakerName || 'this baker';
    setCopy(
      'Create a free account to save ' + name + ' to your favorites',
      'It only takes a minute, and we will save them to your favorites as soon as you are in.'
    );
    open('/bakers/' + encodeURIComponent(id) + '?fav=1');
  });
  function close() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[href^="/order/new"]');
    if (link) { e.preventDefault(); setCopy(defaultTitle, defaultSub); open(link.getAttribute('href')); return; }
    if (e.target.closest('[data-bsm-close]')) { close(); return; }
    if (e.target === modal) { close(); return; }
    const signin = e.target.closest('[data-bsm-signin]');
    if (signin) { e.preventDefault(); window.location = '/login?redirect=' + encodeURIComponent(targetHref); return; }
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.hidden = true;
    const fd = new FormData(form);
    const body = {
      firstName: (fd.get('firstName') || '').trim(),
      lastName: (fd.get('lastName') || '').trim(),
      email: (fd.get('email') || '').trim(),
      password: fd.get('password') || '',
      state: (fd.get('state') || '').trim(),
      zipCode: (fd.get('zipCode') || '').trim(),
      bakerId: bakerId,
      ref: ref
    };
    const btn = form.querySelector('.bsm-submit');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Creating your account...';
    try {
      const r = await fetch('/api/customer/quick-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not create your account.');
      // Logged in via session cookie; continue straight to the order request.
      window.location = targetHref;
    } catch (e2) {
      err.textContent = e2.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = original;
    }
  });
})();
