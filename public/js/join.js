(function () {
  // ---- /join chooser ----
  const charterBtn = document.getElementById('chooseCharter');
  const betaBtn = document.getElementById('chooseBeta');

  if (betaBtn) {
    betaBtn.addEventListener('click', function () {
      window.location = '/join/finish?tier=beta';
    });
  }

  if (charterBtn) {
    charterBtn.addEventListener('click', async function () {
      charterBtn.disabled = true;
      const original = charterBtn.textContent;
      charterBtn.textContent = 'Redirecting...';
      try {
        const r = await fetch('/api/join/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: 'charter' })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) throw new Error(j.error || 'Could not start checkout. Please try again.');
        window.location = j.url;
      } catch (e) {
        charterBtn.disabled = false;
        charterBtn.textContent = original;
        alert(e.message);
      }
    });
  }

  // ---- finish-signup form ----
  const form = document.getElementById('joinForm');
  if (!form) return;
  const err = document.getElementById('joinError');
  const btn = document.getElementById('joinSubmit');
  const card = document.getElementById('joinCard');
  const done = document.getElementById('joinDone');
  const doneNote = document.getElementById('joinDoneNote');

  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function showError(msg) { err.textContent = msg; err.hidden = false; btn.disabled = false; }

  // Light confetti burst in brand colors, ~2.5s then self-cleans. Skipped when
  // the visitor prefers reduced motion.
  function launchConfetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#C2557E', '#F2C4D8', '#D4C8E0'];
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const size = 6 + Math.random() * 8;
      const dur = 1.8 + Math.random() * 1.0;
      const delay = Math.random() * 0.4;
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.width = p.style.height = size + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDuration = dur + 's';
      p.style.animationDelay = delay + 's';
      document.body.appendChild(p);
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, (dur + delay) * 1000 + 600);
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.hidden = true;
    btn.disabled = true;

    const body = {
      tier: form.dataset.tier || 'beta',
      sessionId: form.dataset.session || '',
      firstName: val('firstName'),
      lastName: val('lastName'),
      bakeryName: val('bakeryName'),
      email: val('email'),
      phone: val('phone'),
      city: val('city'),
      state: val('state'),
      zip: val('zip')
    };

    if (!body.firstName || !body.lastName) return showError('Please enter your first and last name.');
    if (!body.bakeryName) return showError('Please enter your bakery name.');
    if (!body.email) return showError('Please enter your email.');

    try {
      const r = await fetch('/api/join/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not finish signup.');
      card.hidden = true;
      done.hidden = false;
      launchConfetti();
      if (j.emailWarning) {
        doneNote.textContent = 'We had trouble sending the email. Use "reset password" on the login page to get your link.';
        doneNote.hidden = false;
      }
      window.scrollTo(0, 0);
    } catch (e2) {
      showError(e2.message);
    }
  });
})();
