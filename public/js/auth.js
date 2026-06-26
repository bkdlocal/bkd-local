(function () {
  const form = document.getElementById('authForm');
  const mode = form.dataset.mode;
  const redirect = form.dataset.redirect || '';
  const err = document.getElementById('authError');
  const note = document.getElementById('authNote');
  const btn = document.getElementById('authSubmit');

  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.hidden = true; note.hidden = true; btn.disabled = true;
    const body = { email: val('email'), password: val('password') };
    if (mode === 'signup') {
      body.firstName = val('firstName'); body.lastName = val('lastName');
      body.state = val('state'); body.zipCode = val('zipCode');
    }
    const url = mode === 'signup' ? '/api/customer/signup' : '/api/customer/login';
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (mode === 'login') {
        if (r.ok) { window.location = redirect || '/'; return; }
        throw new Error(j.error || 'Could not log in.');
      } else {
        if (r.ok) {
          const loginHref = '/login' + (redirect ? '?redirect=' + encodeURIComponent(redirect) : '');
          note.innerHTML = 'Account created. Check your email for a verification link, then <a href="' + loginHref + '">log in</a>.';
          note.hidden = false; form.reset(); btn.disabled = false; return;
        }
        throw new Error(j.error || 'Could not create account.');
      }
    } catch (e) {
      err.textContent = e.message; err.hidden = false; btn.disabled = false;
    }
  });
})();
