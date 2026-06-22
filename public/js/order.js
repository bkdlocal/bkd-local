(function () {
  const data = JSON.parse(document.getElementById('order-data').textContent);
  const item = data.item;
  const serviceFee = Number(data.serviceFee) || 0;
  const state = { quantity: 1, pickupDate: null, addons: {}, notes: '' };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) { const p = iso.split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0]; }
  function money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); }
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  document.querySelectorAll('.date-pill').forEach(b => { b.textContent = fmtDate(b.dataset.date); });

  function addonCost(i) {
    const a = item.addOns[i]; const q = state.addons[i] || 0;
    return a.unit === 'per_cookie' ? q * a.price : (q > 0 ? a.price : 0);
  }
  function subtotal() { let s = state.quantity * Number(item.price); item.addOns.forEach((a, i) => s += addonCost(i)); return s; }
  function total() { return subtotal() + serviceFee; }
  function renderTotals() { document.querySelectorAll('.order-total-val').forEach(el => el.textContent = money(total())); }

  function clampPerCookie() {
    item.addOns.forEach((a, i) => {
      if (a.unit === 'per_cookie' && (state.addons[i] || 0) > state.quantity) {
        state.addons[i] = state.quantity; setAddonQty(i);
      }
    });
  }
  function setAddonQty(i) { const el = document.querySelector('.addon-qty[data-i="' + i + '"]'); if (el) el.textContent = state.addons[i] || 0; }
  function updateNext1() { document.getElementById('next1').disabled = !(state.quantity >= 1 && state.pickupDate); }

  function showStep(n) {
    document.querySelectorAll('.ostep').forEach(s => s.classList.toggle('active', s.dataset.step === String(n)));
    document.querySelectorAll('.pdot').forEach(d => { d.classList.toggle('active', typeof n === 'number' && Number(d.dataset.dot) <= n); });
    window.scrollTo(0, 0);
    if (n === 3) buildSummary();
    if (n === 2 || n === 3) renderTotals();
  }

  function row(label, val, plain) { return '<div class="sum-row' + (plain ? ' plain' : '') + '"><span>' + escapeHtml(label) + '</span><span>' + escapeHtml(val) + '</span></div>'; }
  function buildSummary() {
    let html = row(item.name + ' × ' + state.quantity, money(state.quantity * Number(item.price)));
    item.addOns.forEach((a, i) => {
      const q = state.addons[i] || 0;
      if (q > 0) html += row(a.unit === 'per_cookie' ? a.name + ' × ' + q : a.name, money(addonCost(i)));
    });
    html += row('Pickup', state.pickupDate ? fmtDate(state.pickupDate) : '—', true);
    html += '<div class="sum-divider"></div>';
    html += row('Subtotal', money(subtotal()));
    html += row('Service fee', money(serviceFee));
    html += '<div class="sum-total">' + row('Total', money(total())) + '</div>';
    document.getElementById('summary').innerHTML = html;
  }

  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act;
    if (act === 'qty-inc') { state.quantity++; document.getElementById('qtyVal').textContent = state.quantity; clampPerCookie(); updateNext1(); renderTotals(); }
    else if (act === 'qty-dec') { if (state.quantity > 1) { state.quantity--; document.getElementById('qtyVal').textContent = state.quantity; clampPerCookie(); updateNext1(); renderTotals(); } }
    else if (act === 'pick-date') { state.pickupDate = t.dataset.date; document.querySelectorAll('.date-pill').forEach(p => p.classList.toggle('selected', p === t)); updateNext1(); }
    else if (act === 'addon-inc') { const i = t.dataset.i; state.addons[i] = Math.min((state.addons[i] || 0) + 1, state.quantity); setAddonQty(i); renderTotals(); }
    else if (act === 'addon-dec') { const i = t.dataset.i; state.addons[i] = Math.max((state.addons[i] || 0) - 1, 0); setAddonQty(i); renderTotals(); }
    else if (act === 'to-1') { showStep(1); }
    else if (act === 'to-2') { showStep(2); }
    else if (act === 'to-3') { showStep(3); }
    else if (act === 'submit') { submit(t); }
  });
  document.addEventListener('change', function (e) {
    const t = e.target.closest('[data-act="addon-toggle"]'); if (!t) return;
    state.addons[t.dataset.i] = t.checked ? 1 : 0; renderTotals();
  });

  function submit(btn) {
    const err = document.getElementById('orderError'); err.hidden = true;
    state.notes = (document.getElementById('orderNotes').value || '').trim();
    const addOns = item.addOns
      .map((a, i) => ({ name: a.name, unit: a.unit, price: a.price, qty: state.addons[i] || 0 }))
      .filter(a => a.qty > 0);
    btn.disabled = true; btn.textContent = 'Sending...';
    fetch('/api/orders/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bakerId: data.bakerId, itemId: item.id, quantity: state.quantity, pickupDate: state.pickupDate, addOns: addOns, notes: state.notes })
    })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not send request.'); showStep('done'); })
      .catch(e => { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Send request'; });
  }

  renderTotals();
})();
