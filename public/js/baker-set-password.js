(function () {
  const form = document.getElementById('setPwForm');
  if (!form) return;
  const token = form.dataset.token || '';
  const err = document.getElementById('setPwError');
  const note = document.getElementById('setPwNote');
  const btn = document.getElementById('setPwSubmit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true; note.hidden = true;
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    if (password.length < 8) { err.textContent = 'Password must be at least 8 characters.'; err.hidden = false; return; }
    if (password !== confirm) { err.textContent = 'Passwords do not match.'; err.hidden = false; return; }
    btn.disabled = true;
    try {
      const r = await fetch('/api/auth/set-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, password: password })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not set password.');
      form.querySelectorAll('input,button').forEach(el => { el.disabled = true; });
      note.innerHTML = 'Password set. You can now <a href="/app">log in to your baker account</a>.';
      note.hidden = false;
    } catch (e2) {
      err.textContent = e2.message; err.hidden = false; btn.disabled = false;
    }
  });
})();
