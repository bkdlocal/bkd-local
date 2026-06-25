(function () {
  // Unread indicators (header + bottom-nav dots) in the logged-in customer UI.
  const dots = document.querySelectorAll('[data-nav-unread]');
  if (!dots.length) return;
  async function refresh() {
    try {
      const r = await fetch('/api/customer/unread-count');
      if (!r.ok) return;
      const j = await r.json();
      const n = Number(j.count) || 0;
      dots.forEach(el => { el.hidden = n <= 0; });
    } catch (_) {}
  }
  refresh();
  setInterval(refresh, 30000);
})();
