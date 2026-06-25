const Router = {
  current: null,
  previous: null,
  state: {},

  async navigate(screenId, params) {
    if (params) {
      this.state[screenId] = { ...(this.state[screenId] || {}), ...params };
    }
    Api.invalidate();
    const root = document.getElementById('app');
    const renderer = SCREENS[screenId] || renderPlaceholder;
    root.innerHTML = await renderer(this.state[screenId] || {}, screenId);
    if (screenId !== this.current) this.previous = this.current;
    this.current = screenId;
    this.bindEvents();
    root.querySelector('.scroll-content')?.scrollTo(0, 0);
    refreshUnreadBadge();
  },

  async refresh(opts) {
    if (opts && opts.keepScroll) {
      const top = document.querySelector('.scroll-content')?.scrollTop || 0;
      await this.navigate(this.current);
      const sc = document.querySelector('.scroll-content');
      if (sc) sc.scrollTo(0, top);
      return;
    }
    return this.navigate(this.current);
  },

  back() {
    return this.navigate(this.previous || 'home');
  },

  bindEvents() {
    document.querySelectorAll('[data-screen]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        const target = el.dataset.screen;
        if (target && target !== this.current) this.navigate(target);
      });
    });

    document.querySelectorAll('[data-action]').forEach(el => {
      if (el.tagName === 'FORM') return;
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const handler = Actions[el.dataset.action];
        if (!handler) return;
        await handler({ id: el.dataset.id, value: el.dataset.value, el });
      });
    });

    document.querySelectorAll('form[data-action]').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const handler = Actions[form.dataset.action];
        if (!handler) return;
        const formData = Object.fromEntries(new FormData(form));
        await handler({ ...formData, form });
      });
    });
  }
};

function showShareToast(msg) {
  const existing = document.querySelector('.share-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'share-toast';
  toast.textContent = msg;
  (document.querySelector('.app-frame') || document.body).appendChild(toast);
  // Force reflow so the entrance transition runs.
  void toast.offsetWidth;
  toast.classList.add('share-toast--visible');
  setTimeout(() => {
    toast.classList.remove('share-toast--visible');
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}

async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
}

// ── Baker FAQ chat ──
function runBakerFaq(question) {
  const q = (question || '').trim();
  if (!q) return;
  const thread = document.getElementById('faqThread');
  if (!thread) return;
  const sugg = document.getElementById('faqSuggestions');
  const input = document.getElementById('faqInput');
  if (sugg && sugg.parentNode) sugg.remove();
  if (input) input.value = '';
  const FALLBACK = 'Sorry, something went wrong. Email us at hello@bkdlocal.com';
  const bubble = (cls, text) => {
    const d = document.createElement('div');
    d.className = 'faq-bubble ' + cls;
    d.textContent = text;
    thread.appendChild(d);
    thread.scrollTop = thread.scrollHeight;
    return d;
  };
  bubble('faq-user', q);
  const bot = bubble('faq-bot', 'Thinking...');
  fetch('/api/faq/baker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q })
  })
    .then(r => r.json()).then(j => { bot.textContent = (j && j.answer) || FALLBACK; thread.scrollTop = thread.scrollHeight; })
    .catch(() => { bot.textContent = FALLBACK; });
}

// ── Bake Timer helpers ──
// A single self-clearing 1s ticker updates the display while running; it looks
// the element + persisted state up each tick so it survives re-renders, screen
// lock, and (via DOMContentLoaded re-arm below) page refresh.
function stopBakeTimerTick() {
  if (window.__bakeTimerInterval) {
    clearInterval(window.__bakeTimerInterval);
    window.__bakeTimerInterval = null;
  }
}
function ensureBakeTimerTick() {
  if (window.__bakeTimerInterval) return;
  window.__bakeTimerInterval = setInterval(() => {
    const t = readBakeTimer();
    if (t.state !== 'running') { stopBakeTimerTick(); return; }
    const el = document.getElementById('bakeTimerDisplay');
    if (el) el.textContent = formatHMS(bakeElapsedMs(t));
  }, 1000);
}
// Hourly-rate message from the Profit Summary "Your listed price" field.
// Reads the live DOM input first; falls back to the in-memory state value
// (kept in sync by onPmbListedPriceInput) so the rate still computes even if
// the input element can't be found at the moment of pause.
function bakeTimerResultMessage(elapsedMs) {
  // Read the live "Your listed price" input (by id, then by class), falling back
  // to the in-memory state value kept in sync by onPmbListedPriceInput.
  let price = NaN;
  const input = document.getElementById('pmb-listed-price') || document.querySelector('.pmb-summary-price-input');
  if (input && input.value !== '') price = parseFloat(input.value);
  if (!(price > 0) && typeof Router !== 'undefined' && Router.state && Router.state.priceMyBakes) {
    price = Number(Router.state.priceMyBakes.listedPrice);
  }
  const hours = elapsedMs / 3600000;
  if (price > 0 && hours > 0) {
    return `At this pace you make approximately $${Math.round(price / hours).toLocaleString('en-US')} per hour`;
  }
  return 'Enter your listed price in the Profit Summary below to see your hourly rate.';
}
function paintBakeTimer() {
  const t = readBakeTimer();
  const disp = document.getElementById('bakeTimerDisplay');
  const btn = document.getElementById('bakeTimerToggle');
  const res = document.getElementById('bakeTimerResult');
  if (disp) disp.textContent = formatHMS(bakeElapsedMs(t));
  if (btn) btn.textContent = t.state === 'running' ? 'Pause' : (t.state === 'paused' ? 'Resume' : 'Start Timer');
  if (res) {
    if (t.result) { res.textContent = t.result; res.hidden = false; }
    else { res.textContent = ''; res.hidden = true; }
  }
}

const Actions = {
  'order:open': ({ id }) => Router.navigate('orderDetail', { orderId: id }),

  'home:shareProfile': async ({ value }) => {
    const url = value || '';
    if (!url) return;
    try {
      await copyToClipboard(url);
      showShareToast('Link copied — share it anywhere.');
    } catch (e) {
      showShareToast('Could not copy. Your link: ' + url);
    }
  },

  'faq:send': (fields) => { runBakerFaq(fields && fields.question); },
  'faq:pill': ({ el }) => { runBakerFaq(el.dataset.q); },

  'order:accept': async ({ id }) => {
    try {
      await Api.acceptOrder(id);
      Router.refresh();
    } catch (e) { alert(e.message); }
  },

  'order:decline': async ({ id }) => {
    try {
      await Api.declineOrder(id);
      if (Router.current === 'orderDetail') Router.navigate('orders');
      else Router.refresh();
    } catch (e) { alert(e.message); }
  },

  'order:markReady': async ({ id }) => {
    try {
      await Api.markOrderReady(id);
      Router.refresh();
    } catch (e) { alert(e.message); }
  },

  'orders:filter': ({ value }) => Router.navigate('orders', { filter: value }),
  'messages:open': () => Router.navigate('messages'),
  'nav:back': () => Router.back(),

  'menu:add': () => {
    Router.state.menuItem = { itemId: null };
    Router.navigate('menuItem');
  },
  'menu:edit': ({ id }) => {
    Router.state.menuItem = { itemId: id };
    Router.navigate('menuItem');
  },
  'menu:priceItem': ({ id }) => {
    Router.state.priceMyBakes = { itemId: id };
    Router.navigate('priceMyBakes');
  },

  'menuItem:setType': ({ value }) => {
    const s = Router.state.menuItem;
    if (!s) return;
    s.productType = value;
    const t = PRODUCT_TYPES.find(x => x.id === value);
    if (t && !s.emoji) s.emoji = t.emoji;
    if (value === 'cupcakes' && s.soldBy === 'individual') s.soldBy = null;
    // Cakes have no "Sold by" picker (sized/tiered instead); they're sold per cake.
    if (value === 'cakes') s.soldBy = 'individual';
    Router.refresh({ keepScroll: true });
  },
  'menuItem:setSoldBy': ({ value }) => {
    const s = Router.state.menuItem;
    if (!s) return;
    s.soldBy = value;
    Router.refresh({ keepScroll: true });
  },
  'menuItem:toggleSize': ({ value }) => {
    const s = Router.state.menuItem;
    if (!s) return;
    s.typeFields.sizes = Array.isArray(s.typeFields.sizes) ? s.typeFields.sizes : [];
    const i = s.typeFields.sizes.indexOf(value);
    if (i >= 0) s.typeFields.sizes.splice(i, 1);
    else s.typeFields.sizes.push(value);
    Router.refresh({ keepScroll: true });
  },
  'menuItem:setLayersPerTier': ({ value }) => {
    const s = Router.state.menuItem;
    if (!s) return;
    s.typeFields.layersPerTier = parseInt(value, 10);
    Router.refresh({ keepScroll: true });
  },
  'menuItem:setTiers': ({ value }) => {
    const s = Router.state.menuItem;
    if (!s) return;
    s.typeFields.tiers = parseInt(value, 10);
    Router.refresh({ keepScroll: true });
  },
  'menuItem:toggleTag': ({ value }) => {
    const s = Router.state.menuItem;
    if (!s) return;
    s.occasionTags = Array.isArray(s.occasionTags) ? s.occasionTags : [];
    const i = s.occasionTags.indexOf(value);
    if (i >= 0) s.occasionTags.splice(i, 1);
    else s.occasionTags.push(value);
    Router.refresh({ keepScroll: true });
  },
  'menuItem:addAddon': () => {
    const s = Router.state.menuItem;
    if (!s) return;
    s.addOns = s.addOns || [];
    s.addOns.push({ name: '', price: 0, priceUnit: 'per_cookie' });
    Router.refresh({ keepScroll: true });
  },
  'menuItem:removeAddon': ({ id }) => {
    const s = Router.state.menuItem;
    if (!s) return;
    s.addOns.splice(parseInt(id, 10), 1);
    Router.refresh({ keepScroll: true });
  },
  'menuItem:setAddonUnit': ({ id, el }) => {
    const s = Router.state.menuItem;
    if (!s) return;
    const idx = parseInt(id, 10);
    if (!s.addOns || !s.addOns[idx]) return;
    const value = el.dataset.value === 'per_set' ? 'per_set' : 'per_cookie';
    s.addOns[idx].priceUnit = value;
    Router.refresh({ keepScroll: true });
  },
  'menuItem:save': async () => {
    const s = Router.state.menuItem;
    if (!s) return;
    if (!miIsValid(s)) {
      alert("To save, add an item name, product type, how it's sold, a base price, and at least one photo.");
      return;
    }
    const payload = {
      name: s.name.trim(),
      emoji: s.emoji,
      price: Number(s.price) || 0,
      productType: s.productType,
      soldBy: s.soldBy,
      occasionTags: s.occasionTags || [],
      addOns: (s.addOns || [])
        .filter(a => a.name && a.name.trim())
        .map(a => ({
          name: a.name.trim(),
          price: Number(a.price) || 0,
          priceUnit: a.priceUnit === 'per_set' ? 'per_set' : 'per_cookie'
        })),
      typeFields: s.typeFields || {},
      batchSize: s.batchSize ?? null,
      batchUnit: s.batchUnit || s.soldBy || null,
      minimumQuantity: s.minimumQuantity ?? null,
      photos: Array.isArray(s.photos) ? s.photos.filter(Boolean) : [],
      available: true
    };
    try {
      if (s.itemId) await Api.updateMenuItem(s.itemId, payload);
      else await Api.createMenuItem(payload);
      Router.state.menuItem = null;
      Router.navigate('menu');
    } catch (e) { alert(e.message); }
  },
  'menuItem:delete': async () => {
    const s = Router.state.menuItem;
    if (!s || !s.itemId) return;
    if (!confirm('Remove this item from your menu?')) return;
    try {
      await Api.deleteMenuItem(s.itemId);
      Router.state.menuItem = null;
      Router.navigate('menu');
    } catch (e) { alert(e.message); }
  },
  'menuItem:cancel': () => {
    Router.state.menuItem = null;
    Router.navigate('menu');
  },
  'menuItem:priceCheck': () => {
    const s = Router.state.menuItem;
    if (!s) return;
    // Preserve the in-progress draft (incl. uploaded photo URLs) by leaving
    // Router.state.menuItem intact; Back returns to it unchanged.
    Router.state.priceMyBakes = {
      itemId: s.itemId || null,
      prefillName: (s.name || '').trim(),
      prefillPrice: Number(s.price) || 0
    };
    Router.navigate('priceMyBakes');
  },
  'menuItem:removePhoto': ({ id }) => {
    const s = Router.state.menuItem;
    if (!s || !Array.isArray(s.photos)) return;
    s.photos.splice(parseInt(id, 10), 1);
    Router.refresh({ keepScroll: true });
  },
  'menuItem:makeCover': ({ id }) => {
    const s = Router.state.menuItem;
    if (!s || !Array.isArray(s.photos)) return;
    const i = parseInt(id, 10);
    if (i > 0 && i < s.photos.length) {
      const [p] = s.photos.splice(i, 1);
      s.photos.unshift(p);
    }
    Router.refresh({ keepScroll: true });
  },

  'pmb:selectStore': ({ value }) => {
    const s = Router.state.priceMyBakes;
    if (!s) return;
    s.store = value;
    Router.refresh({ keepScroll: true });
  },

  // ── Bake Timer (foreground only) ──
  // localStorage is the source of truth; DOM is updated directly (no re-render)
  // so the running clock, the typed price, and scroll position aren't disturbed.
  // Toggle cycles idle -> running (Start) -> paused (Pause) -> running (Resume).
  'pmb:timerToggle': () => {
    const t = readBakeTimer();
    if (t.state === 'running') {
      // Pause: freeze accumulated elapsed, compute the hourly-rate result.
      const elapsed = bakeElapsedMs(t);
      writeBakeTimer({ state: 'paused', startTs: null, accumMs: elapsed, result: bakeTimerResultMessage(elapsed) });
      stopBakeTimerTick();
    } else {
      // Start (from idle) or Resume (from paused): keep accumulated time, set a
      // fresh start timestamp, clear the result while timing continues.
      writeBakeTimer({ state: 'running', startTs: Date.now(), accumMs: Number(t.accumMs) || 0, result: null });
      ensureBakeTimerTick();
    }
    paintBakeTimer();
  },

  'pmb:timerReset': () => {
    stopBakeTimerTick();
    writeBakeTimer({ state: 'idle', startTs: null, accumMs: 0, result: null });
    paintBakeTimer();
  },

  'pmb:addIngredient': ({ id }) => {
    const s = Router.state.priceMyBakes;
    if (!s) return;
    const item = PMB.catalogById[id];
    if (!item) return;
    const ug = item.isCustom ? null : PMB.unitGroups[item.unitGroup];
    const defaultUnit = item.isCustom ? 'use' : (item.defaultUnit || ug?.default || 'grams');
    s.ingredients = s.ingredients || [];
    s.ingredients.push({ catalogId: id, custom: !!item.isCustom, quantity: 1, unit: defaultUnit });
    Router.refresh({ keepScroll: true });
  },

  'pmb:removeIngredient': ({ id }) => {
    const s = Router.state.priceMyBakes;
    if (!s) return;
    s.ingredients.splice(parseInt(id, 10), 1);
    Router.refresh({ keepScroll: true });
  },

  'pmb:setUnit': ({ id, value }) => {
    const s = Router.state.priceMyBakes;
    if (!s) return;
    const idx = parseInt(id, 10);
    if (!s.ingredients[idx]) return;
    s.ingredients[idx].unit = value;
    Router.refresh({ keepScroll: true });
  },

  'pmb:overridePrice': async ({ id }) => {
    const item = PMB.catalogById[id];
    if (!item || item.isCustom) return;
    const s = Router.state.priceMyBakes;
    const current = PMB.overrides[id] != null
      ? PMB.overrides[id]
      : (item.prices[s.store] != null ? item.prices[s.store] : item.prices.walmart);
    const raw = prompt(`Your price for ${item.name} (${item.packageLabel}):`, current);
    if (raw === null) return;
    const v = parseFloat(raw);
    if (!Number.isFinite(v) || v < 0) { alert('Enter a valid price.'); return; }
    try {
      const result = await Api.setIngredientOverride(id, v);
      PMB.overrides = result.overrides;
      Router.refresh({ keepScroll: true });
    } catch (e) { alert(e.message); }
  },

  'pmb:openCustomForm': () => {
    const s = Router.state.priceMyBakes;
    s.showCustomForm = true;
    Router.refresh({ keepScroll: true });
  },

  'pmb:closeCustomForm': () => {
    const s = Router.state.priceMyBakes;
    s.showCustomForm = false;
    Router.refresh({ keepScroll: true });
  },

  'pmb:submitCustomForm': async (fields) => {
    try {
      const r = await Api.addCustomIngredient(fields);
      PMB.custom.push(r.item);
      PMB.catalogById[r.item.id] = { ...r.item, isCustom: true };
      const s = Router.state.priceMyBakes;
      s.ingredients.push({ catalogId: r.item.id, custom: true, quantity: 1, unit: 'use' });
      s.showCustomForm = false;
      Router.refresh({ keepScroll: true });
    } catch (e) { alert(e.message); }
  },

  'pmb:addSupply': ({ id }) => {
    const s = Router.state.priceMyBakes;
    if (!s) return;
    s.supplies = s.supplies || [];
    s.supplies.push({ catalogId: id, quantity: 1 });
    Router.refresh({ keepScroll: true });
  },

  'pmb:removeSupply': ({ id }) => {
    const s = Router.state.priceMyBakes;
    s.supplies.splice(parseInt(id, 10), 1);
    Router.refresh({ keepScroll: true });
  },

  'pmb:overrideSupply': async ({ id }) => {
    const supply = PMB.supplies.find(x => x.id === id);
    if (!supply) return;
    const raw = prompt(`Price per use for ${supply.name}:`, supply.pricePerUse);
    if (raw === null) return;
    const v = parseFloat(raw);
    if (!Number.isFinite(v) || v < 0) { alert('Enter a valid price.'); return; }
    try {
      const r = await Api.upsertSupply({ id, name: supply.name, pricePerUse: v });
      Object.assign(supply, r.supply);
      Router.refresh({ keepScroll: true });
    } catch (e) { alert(e.message); }
  },

  'pmb:openSupplyForm': () => {
    const s = Router.state.priceMyBakes;
    s.showSupplyForm = true;
    Router.refresh({ keepScroll: true });
  },

  'pmb:closeSupplyForm': () => {
    const s = Router.state.priceMyBakes;
    s.showSupplyForm = false;
    Router.refresh({ keepScroll: true });
  },

  'pmb:submitSupplyForm': async (fields) => {
    try {
      const r = await Api.upsertSupply(fields);
      PMB.supplies.push(r.supply);
      const s = Router.state.priceMyBakes;
      s.supplies.push({ catalogId: r.supply.id, quantity: 1 });
      s.showSupplyForm = false;
      Router.refresh({ keepScroll: true });
    } catch (e) { alert(e.message); }
  },

  'pmb:saveRecipe': async ({ el }) => {
    const s = Router.state.priceMyBakes;
    if (!s || !s.itemId) {
      alert('Open this from a menu item to link the recipe.');
      return;
    }
    const food = totalFoodCost(s);
    const supplies = totalSuppliesCost(s);
    const totalCost = food + supplies;
    el.disabled = true;
    const original = el.textContent;
    el.textContent = 'Saving…';
    try {
      await Api.saveRecipe(s.itemId, {
        store: s.store,
        listedPrice: s.listedPrice,
        ingredients: s.ingredients,
        supplies: s.supplies,
        totalCost,
        batchSize: s.batchSize,
        batchUnit: s.batchUnit
      });
      el.textContent = 'Saved ✓';
      setTimeout(() => { el.textContent = original; el.disabled = false; }, 1400);
    } catch (e) {
      alert(e.message);
      el.textContent = original;
      el.disabled = false;
    }
  },

  'conversation:open': ({ id }) => {
    Router.state.conversation = {};
    Router.navigate('conversation', { conversationId: id });
  },

  'conversation:fetchSuggestion': async ({ id }) => {
    Router.state.conversation = { ...(Router.state.conversation || {}), suggestionLoading: true };
    await Router.refresh();
    try {
      const result = await Api.getSmartReply(id);
      Router.state.conversation = {
        ...(Router.state.conversation || {}),
        suggestion: result.suggestion || null,
        suggestionLoading: false
      };
    } catch (e) {
      Router.state.conversation = {
        ...(Router.state.conversation || {}),
        suggestion: null,
        suggestionLoading: false
      };
      alert(e.message);
    }
    Router.refresh();
  },

  'conversation:useSuggestion': () => {
    const input = document.querySelector('.composer-input');
    const suggestion = Router.state.conversation?.suggestion;
    if (!input || !suggestion) return;
    input.value = suggestion;
    input.focus();
    Router.state.conversation = { ...(Router.state.conversation || {}), draft: suggestion };
  },

  'conversation:send': async ({ text, form }) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    const id = form.dataset.id;
    try {
      await Api.sendReply(id, trimmed);
      Router.state.conversation = { ...(Router.state.conversation || {}), suggestion: null, draft: '' };
      Router.refresh();
    } catch (e) {
      alert(e.message);
    }
  },

  'availability:toggleAccepting': async ({ value }) => {
    const s = Router.state.availability;
    const next = value === 'on';
    if (s) s.accepting = next;            // optimistic
    Router.refresh({ keepScroll: true });
    try { await Api.setAccepting(next); }
    catch (e) { if (s) s.accepting = !next; alert(e.message); Router.refresh({ keepScroll: true }); }
  },

  'availability:toggleDay': async ({ el }) => {
    const s = Router.state.availability;
    if (!s) return;
    const day = el.dataset.day;
    const set = new Set(s.defaultDays || []);
    if (set.has(day)) set.delete(day); else set.add(day);
    const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    s.defaultDays = order.filter(d => set.has(d));
    Router.refresh({ keepScroll: true });    // repaint pills + calendar highlights
    try { await Api.setDefaultDays(s.defaultDays); }
    catch (e) { alert(e.message); }
  },

  'availability:toggleException': async ({ el }) => {
    const s = Router.state.availability;
    if (!s) return;
    const date = el.dataset.date;
    if (!s.exceptions) s.exceptions = new Set();
    const willBeException = !s.exceptions.has(date);
    if (willBeException) s.exceptions.add(date); else s.exceptions.delete(date);
    Router.refresh({ keepScroll: true });    // gray <-> available instantly
    try {
      const r = await Api.setException(date, willBeException);
      if (r && r.ok === false) {
        // Not supported yet (no Is Exception field): revert.
        if (willBeException) s.exceptions.delete(date); else s.exceptions.add(date);
        s.exceptionsSupported = false;
        Router.refresh({ keepScroll: true });
      }
    } catch (e) {
      if (willBeException) s.exceptions.delete(date); else s.exceptions.add(date);
      alert(e.message);
      Router.refresh({ keepScroll: true });
    }
  },

  'availability:prevMonth': () => {
    const s = Router.state.availability || {};
    const today = new Date();
    let y = s.viewYear ?? today.getFullYear();
    let m = (s.viewMonth ?? today.getMonth()) - 1;
    if (m < 0) { m = 11; y--; }
    Router.navigate('availability', { viewYear: y, viewMonth: m });
  },

  'availability:nextMonth': () => {
    const s = Router.state.availability || {};
    const today = new Date();
    let y = s.viewYear ?? today.getFullYear();
    let m = (s.viewMonth ?? today.getMonth()) + 1;
    if (m > 11) { m = 0; y++; }
    Router.navigate('availability', { viewYear: y, viewMonth: m });
  },

  'profile:editZone': ({ el }) => {
    const zone = el.dataset.zone;
    Router.state.profile = { ...(Router.state.profile || {}), editingZone: zone, editingFaq: null };
    Router.refresh({ keepScroll: true });
  },

  'profile:cancelZone': () => {
    Router.state.profile = { ...(Router.state.profile || {}), editingZone: null };
    Router.refresh({ keepScroll: true });
  },

  'profile:saveZone': async (fields) => {
    const zone = fields.form.dataset.zone;
    const patch = {};
    if (zone === 'basic') {
      patch.businessName = (fields.businessName || '').trim();
      patch.contactName = (fields.contactName || '').trim();
      patch.phone = (fields.phone || '').trim();
    } else if (zone === 'location') {
      patch.city = (fields.city || '').trim();
      patch.pickupLocation = (fields.pickupLocation || '').trim();
    } else if (zone === 'voice') {
      patch.bio = (fields.bio || '').trim();
      patch.productTypes = (fields.productTypes || '').trim();
      patch.specialtyTags = (fields.specialtyTags || '').trim();
    }
    try {
      await Api.updateBaker(patch);
      Router.state.profile = { ...(Router.state.profile || {}), editingZone: null };
      Router.refresh({ keepScroll: true });
    } catch (e) { alert(e.message); }
  },

  'profile:editFaq': ({ el }) => {
    const key = el.dataset.key;
    Router.state.profile = { ...(Router.state.profile || {}), editingFaq: key, editingZone: null };
    Router.refresh({ keepScroll: true });
  },

  'profile:cancelFaq': () => {
    Router.state.profile = { ...(Router.state.profile || {}), editingFaq: null };
    Router.refresh({ keepScroll: true });
  },

  'profile:saveFaq': async (fields) => {
    const key = fields.form.dataset.key;
    const value = (fields.value || '').trim();
    try {
      await Api.updateBaker({ faq: { [key]: value } });
      Router.state.profile = { ...(Router.state.profile || {}), editingFaq: null };
      Router.refresh({ keepScroll: true });
    } catch (e) { alert(e.message); }
  },

  'profile:goLive': async () => {
    if (!confirm('Set your profile to Live? You\'ll show up in the public directory.')) return;
    try {
      await Api.updateBaker({ profileStatus: 'Live' });
      Router.refresh();
    } catch (e) { alert(e.message); }
  },

  'profile:resetOnboarding': async () => {
    if (!confirm('Clear all FAQ answers and start onboarding from scratch? (Mock mode only — useful for testing.)')) return;
    try {
      await Api.resetOnboarding();
      Router.state.profile = {};
      Router.refresh();
    } catch (e) { alert(e.message); }
  },

  'auth:login': async ({ email, password, form }) => {
    const card = form.closest('.login-card');
    const errorEl = card.querySelector('.login-error');
    const submitBtn = form.querySelector('.login-submit');
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    try {
      await Api.login(email, password);
      Router.navigate('home');
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue';
    }
  },

  'auth:forgotSubmit': async ({ email, form }) => {
    const card = form.closest('.login-card');
    const errorEl = card.querySelector('.login-error');
    const submitBtn = form.querySelector('.login-submit');
    const value = (email || '').trim();
    errorEl.hidden = true;
    if (!value) {
      errorEl.textContent = 'Please enter your email.';
      errorEl.hidden = false;
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      await Api.forgotPassword(value);
      document.getElementById('forgotCard').hidden = true;
      document.getElementById('forgotDone').hidden = false;
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send reset link';
    }
  },

  'auth:logout': async () => {
    try { await Api.logout(); } catch {}
    Router.navigate('login');
  }
};

async function refreshUnreadBadge() {
  try {
    const r = await fetch('/api/baker/unread-count');
    if (!r.ok) return;
    const j = await r.json();
    window.__unreadThreads = Number(j.count) || 0;
    paintNavBadge();
  } catch (_) {}
}

function paintNavBadge() {
  const icon = document.querySelector('.bottom-nav [data-screen="messages"] .nav-icon');
  if (!icon) return;
  let b = icon.querySelector('.nav-badge');
  const n = window.__unreadThreads || 0;
  if (n > 0) {
    if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; icon.appendChild(b); }
    b.textContent = n > 9 ? '9+' : String(n);
  } else if (b) { b.remove(); }
}

async function renderPlaceholder(state, screenId) {
  const label = screenId.charAt(0).toUpperCase() + screenId.slice(1);
  let extra = '';
  if (screenId === 'profile') {
    try {
      const baker = await Api.getBaker();
      extra = `
        <div class="profile-placeholder-card">
          <div class="profile-placeholder-label">Logged in as</div>
          <div class="profile-placeholder-email">${baker.email}</div>
          <button class="btn-logout" type="button" data-action="auth:logout">Log Out</button>
        </div>
      `;
    } catch {}
  }
  return `
    <div class="screen">
      ${renderLogoBar()}
      <div class="top-nav">
        <div>
          <div class="greeting-sub">Coming soon</div>
          <div class="greeting-name">${label}</div>
        </div>
      </div>
      <div class="scroll-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:24px;padding:32px 16px;">
        <div style="color:var(--mauve);font-size:13px;max-width:240px;line-height:1.6;">
          This screen is next on the build list.
        </div>
        ${extra}
      </div>
      ${renderBottomNav(screenId)}
    </div>
  `;
}

const SCREENS = {
  login: renderLogin,
  forgotPassword: renderForgotPassword,
  home: renderHome,
  orders: renderOrders,
  orderDetail: renderOrderDetail,
  availability: renderAvailability,
  messages: renderMessages,
  conversation: renderConversation,
  menu: renderMenu,
  menuItem: renderMenuItem,
  priceMyBakes: renderPriceMyBakes,
  reviews: renderReviews,
  profile: renderProfile,
  faq: renderFaq
};

Api.onUnauthorized = () => {
  if (Router.current !== 'login') Router.navigate('login');
};

document.addEventListener('DOMContentLoaded', async () => {
  // Resume live ticking if a bake timer was left running before a refresh.
  if (readBakeTimer().state === 'running') ensureBakeTimerTick();
  try {
    await Api.getSession();
    // Deep-link support for /app/faq (otherwise default to the dashboard).
    Router.navigate(/\/faq\/?$/.test(window.location.pathname) ? 'faq' : 'home');
    setInterval(refreshUnreadBadge, 30000);
  } catch {
    // onUnauthorized already routed to login when status was 401
    if (Router.current !== 'login') Router.navigate('login');
  }
});
