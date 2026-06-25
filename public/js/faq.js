// Customer AI FAQ chat widget. Posts the typed question to the widget's
// data-endpoint and renders the answer in a chat bubble.
(function () {
  const widget = document.querySelector('.faq-widget');
  if (!widget) return;
  const endpoint = widget.getAttribute('data-endpoint') || '/api/faq/customer';
  const thread = widget.querySelector('#faqThread');
  const form = widget.querySelector('#faqForm');
  const input = widget.querySelector('#faqInput');
  const suggestions = widget.querySelector('#faqSuggestions');
  const FALLBACK = 'Sorry, something went wrong. Email us at hello@bkdlocal.com';

  function addBubble(cls, text) {
    const div = document.createElement('div');
    div.className = 'faq-bubble ' + cls;
    div.textContent = text;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
    return div;
  }

  async function ask(q) {
    q = (q || '').trim();
    if (!q) return;
    if (suggestions && suggestions.parentNode) suggestions.remove();
    addBubble('faq-user', q);
    input.value = '';
    const bot = addBubble('faq-bot', 'Thinking...');
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      const j = await r.json().catch(() => ({}));
      bot.textContent = (j && j.answer) || FALLBACK;
    } catch (e) {
      bot.textContent = FALLBACK;
    }
    thread.scrollTop = thread.scrollHeight;
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
  widget.addEventListener('click', function (e) {
    const pill = e.target.closest('.faq-pill');
    if (pill) ask(pill.getAttribute('data-q'));
  });
})();
