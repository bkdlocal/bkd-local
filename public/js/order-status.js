(function () {
  const wrap = document.getElementById('starInput');
  if (!wrap) return;
  const stars = Array.from(wrap.querySelectorAll('.star'));
  const submit = document.getElementById('submitRating');
  const err = document.getElementById('rateError');
  const orderId = wrap.dataset.order;
  let value = 0;

  function paint(n) { stars.forEach(s => { s.textContent = Number(s.dataset.val) <= n ? '★' : '☆'; }); }

  stars.forEach(s => {
    s.addEventListener('mouseenter', () => paint(Number(s.dataset.val)));
    s.addEventListener('click', () => { value = Number(s.dataset.val); paint(value); submit.disabled = false; });
  });
  wrap.addEventListener('mouseleave', () => paint(value));

  submit.addEventListener('click', async () => {
    if (!value) return;
    err.hidden = true; submit.disabled = true; submit.textContent = 'Submitting...';
    try {
      const r = await fetch('/api/orders/' + encodeURIComponent(orderId) + '/rate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: value })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not submit rating.');
      const prompt = document.getElementById('ratePrompt');
      prompt.innerHTML = '<h2>Your rating</h2><div class="rating-display"><span class="rating-stars">' +
        '★★★★★'.slice(0, value) + '☆☆☆☆☆'.slice(0, 5 - value) +
        '</span></div><p class="muted">Thanks for rating. Ratings cannot be changed once submitted.</p>';
    } catch (e) { err.textContent = e.message; err.hidden = false; submit.disabled = false; submit.textContent = 'Submit rating'; }
  });
})();
