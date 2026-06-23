(function () {
  // Only present in the logged-in customer header.
  const el = document.querySelector('[data-nav-unread]');
  if (!el) return;
  async function refresh() {
    try {
      const r = await fetch('/api/customer/unread-count');
      if (!r.ok) return;
      const j = await r.json();
      const n = Number(j.count) || 0;
      if (n > 0) { el.textContent = n > 9 ? '9+' : String(n); el.hidden = false; }
      else { el.hidden = true; }
    } catch (_) {}
  }
  setInterval(refresh, 30000);
})();
