(function () {
  const dataEl = document.getElementById('msg-data');
  if (!dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const bubbles = document.getElementById('bubbles');
  const form = document.getElementById('composer');
  const input = document.getElementById('msgInput');

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  function paintTimes() { document.querySelectorAll('.bubble-time').forEach(t => { t.textContent = fmtTime(t.dataset.sent); }); }
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function bubbleHtml(m) {
    return '<div class="bubble bubble-' + (m.sender === 'baker' ? 'baker' : 'customer') + '">' +
      '<div class="bubble-text">' + escapeHtml(m.text) + '</div>' +
      '<time class="bubble-time" data-sent="' + escapeHtml(m.sentAt || '') + '"></time></div>';
  }
  function scrollBottom() { if (bubbles) bubbles.scrollTop = bubbles.scrollHeight; }
  function render(messages) {
    if (!bubbles) return;
    bubbles.innerHTML = messages.length
      ? messages.map(bubbleHtml).join('')
      : '<p class="muted bubbles-empty">Say hello to start the conversation.</p>';
    paintTimes(); scrollBottom();
  }

  async function poll() {
    if (!data.threadId) return;
    try {
      const r = await fetch('/api/customer/messages/' + encodeURIComponent(data.threadId));
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.messages)) render(j.messages);
    } catch (_) {}
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      try {
        const r = await fetch('/api/customer/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: data.threadId, bakerId: data.bakerId, bakerEmail: data.bakerEmail, text: text, isCustomQuote: data.isCustomQuote })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Could not send.');
        if (j.message && j.message.threadId) data.threadId = j.message.threadId;
        await poll();
      } catch (err) { alert(err.message); input.value = text; }
    });
  }

  paintTimes();
  scrollBottom();
  setInterval(poll, 30000);
})();
