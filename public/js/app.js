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

const Actions = {
  'order:open': ({ id }) => Router.navigate('orderDetail', { orderId: id }),

  'order:accept': async ({ id }) => {
    await Api.acceptOrder(id);
    Router.refresh();
  },

  'order:decline': async ({ id }) => {
    await Api.declineOrder(id);
    if (Router.current === 'orderDetail') Router.navigate('orders');
    else Router.refresh();
  },

  'order:markReady': async ({ id }) => {
    await Api.markOrderReady(id);
    Router.refresh();
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
    if (t && (!s.emoji || s.emoji === '🧁')) s.emoji = t.emoji;
    if (value === 'cupcakes' && s.soldBy === 'individual') s.soldBy = null;
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
    if (!s.name.trim() || !s.productType) {
      alert('Item needs a name and a product type.');
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

  'pmb:selectStore': ({ value }) => {
    const s = Router.state.priceMyBakes;
    if (!s) return;
    s.store = value;
    Router.refresh({ keepScroll: true });
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
    await Api.setAccepting(value === 'on');
    Router.refresh();
  },

  'availability:selectDate': ({ el }) => {
    const date = el.dataset.date;
    const current = Router.state.availability?.selectedDate;
    Router.navigate('availability', { selectedDate: current === date ? null : date });
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

  'availability:addSlot': async ({ el }) => {
    const date = el.dataset.date;
    const raw = prompt('How many orders will you accept on this day?', '4');
    if (raw === null) return;
    const count = parseInt(raw, 10);
    if (!Number.isFinite(count) || count < 1) {
      alert('Please enter a whole number of 1 or more.');
      return;
    }
    try {
      await Api.addSlot(date, count);
      Router.navigate('availability', { selectedDate: date });
    } catch (e) {
      alert(e.message);
    }
  },

  'availability:editSlot': async ({ id, el }) => {
    const delta = parseInt(el.dataset.delta, 10);
    const current = parseInt(el.parentElement.querySelector('.step-value').textContent, 10);
    const next = Math.max(1, current + delta);
    if (next === current) return;
    try {
      await Api.updateSlot(id, next);
      Router.refresh();
    } catch (e) {
      alert(e.message);
    }
  },

  'availability:removeSlot': async ({ id }) => {
    if (!confirm('Remove this pickup date? Customers will no longer be able to book this day.')) return;
    try {
      await Api.removeSlot(id);
      Router.navigate('availability', { selectedDate: null });
    } catch (e) {
      alert(e.message);
    }
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

  'auth:login': async ({ email, form }) => {
    const card = form.closest('.login-card');
    const errorEl = card.querySelector('.login-error');
    const submitBtn = form.querySelector('.login-submit');
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    try {
      await Api.login(email);
      Router.navigate('home');
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue';
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
      ${renderStatusBar()}
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
  profile: renderProfile
};

Api.onUnauthorized = () => {
  if (Router.current !== 'login') Router.navigate('login');
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Api.getSession();
    Router.navigate('home');
    setInterval(refreshUnreadBadge, 30000);
  } catch {
    // onUnauthorized already routed to login when status was 401
    if (Router.current !== 'login') Router.navigate('login');
  }
});
