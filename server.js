require('dotenv').config();
const express = require('express');
const path = require('path');
const {
  AirtableClient,
  normEmail,
  escapeFormula,
  bakerFromRecord,
  orderFromRecord,
  slotFromRecord,
  menuItemFromRecord,
  FAQ_FIELDS
} = require('./server/airtable');
const {
  CATALOG: INGREDIENT_CATALOG,
  UNIT_GROUPS
} = require('./server/ingredients');
const {
  getSessionSecret,
  signSession,
  verifySession,
  parseCookies,
  buildCookie
} = require('./server/session');
const mock = require('./server/mock-data');
const { smartReply } = require('./server/anthropic');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = getSessionSecret();
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const FORCE_MOCK = String(process.env.BKD_MODE || '').toLowerCase() === 'mock';
const airtable = !FORCE_MOCK && process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID
  ? new AirtableClient({
      apiKey: process.env.AIRTABLE_API_KEY,
      baseId: process.env.AIRTABLE_BASE_ID
    })
  : null;
const MODE = airtable ? 'airtable' : 'mock';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.bkd_session;
  const payload = verifySession(token, SESSION_SECRET);
  if (payload && payload.email && payload.iat) {
    const age = Date.now() - payload.iat;
    if (age < SESSION_TTL_SECONDS * 1000) {
      req.user = { email: normEmail(payload.email) };
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

async function lookupBakerByEmail(email) {
  if (MODE === 'mock') {
    return email === mock.baker.email ? mock.baker : null;
  }
  const rec = await airtable.findOne('Baker Profiles', {
    filterByFormula: `LOWER(TRIM({Email})) = '${escapeFormula(email)}'`
  });
  return rec ? bakerFromRecord(rec) : null;
}

async function currentBaker(req) {
  if (!req.user) throw httpError(401, 'Not logged in.');
  const baker = await lookupBakerByEmail(req.user.email);
  if (!baker) throw httpError(404, `No baker found for ${req.user.email}`);
  return baker;
}

async function loadOrdersForBaker(baker) {
  if (MODE === 'mock') return mock.getOrders();
  const records = await airtable.list('Orders', {
    filterByFormula: `LOWER(TRIM({Baker Email})) = '${escapeFormula(baker.email)}'`
  });
  return records.map(orderFromRecord);
}

async function loadOrderForBaker(baker, orderId) {
  if (MODE === 'mock') return mock.getOrder(orderId);
  const rec = await airtable.findById('Orders', orderId);
  if (!rec) return null;
  const order = orderFromRecord(rec);
  if (normEmail(rec.fields['Baker Email']) !== baker.email) return null;
  return order;
}

function setSessionCookie(res, email) {
  const token = signSession({ email, iat: Date.now() }, SESSION_SECRET);
  res.setHeader('Set-Cookie', buildCookie('bkd_session', token, {
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', buildCookie('bkd_session', '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }));
}

app.get('/api/mode', (req, res) => {
  res.json({
    mode: MODE,
    demoEmail: MODE === 'mock' ? mock.baker.email : null
  });
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Please enter your email.' });

    const baker = await lookupBakerByEmail(email);
    if (!baker) {
      return res.status(404).json({
        error: MODE === 'mock'
          ? `No baker found in demo mode. Try: ${mock.baker.email}`
          : "We couldn't find a baker account for that email. New bakers, apply at bkdlocal.com."
      });
    }

    setSessionCookie(res, baker.email);
    res.json({ ok: true, baker });
  } catch (e) { next(e); }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
    const baker = await currentBaker(req);
    res.json({ baker });
  } catch (e) { next(e); }
});

app.get('/api/baker', requireAuth, async (req, res, next) => {
  try { res.json(await currentBaker(req)); } catch (e) { next(e); }
});

app.patch('/api/baker', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const patch = req.body || {};
    if (MODE === 'mock') {
      const updated = mock.updateBaker(patch);
      return res.json({ ok: true, baker: { ...updated, faq: { ...updated.faq } } });
    }
    const fields = {};
    const basicMap = {
      contactName: 'Contact Name',
      businessName: 'Business Name',
      phone: 'Phone',
      city: 'City',
      pickupLocation: 'Pickup Location',
      bio: 'Bio',
      productTypes: 'Product Types',
      specialtyTags: 'Specialty Tags',
      profileStatus: 'Profile Status'
    };
    for (const [key, col] of Object.entries(basicMap)) {
      if (patch[key] !== undefined) fields[col] = patch[key] === '' ? null : patch[key];
    }
    if (patch.faq && typeof patch.faq === 'object') {
      for (const [key, col] of Object.entries(FAQ_FIELDS)) {
        if (patch.faq[key] !== undefined) fields[col] = patch.faq[key] === '' ? null : patch.faq[key];
      }
    }
    const updated = await airtable.update('Baker Profiles', baker.id, fields);
    res.json({ ok: true, baker: bakerFromRecord(updated) });
  } catch (e) { next(e); }
});

app.post('/api/baker/reset-onboarding', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    if (MODE !== 'mock') return res.status(403).json({ error: 'Only available in mock mode.' });
    const updated = mock.clearFaq();
    res.json({ ok: true, baker: { ...updated, faq: { ...updated.faq } } });
  } catch (e) { next(e); }
});

app.get('/api/orders', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    res.json(await loadOrdersForBaker(baker));
  } catch (e) { next(e); }
});

app.get('/api/orders/:id', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const order = await loadOrderForBaker(baker, req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (e) { next(e); }
});

app.post('/api/orders/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (MODE === 'mock') {
      mock.acceptOrder(req.params.id);
      return res.json({ ok: true });
    }
    const existing = await loadOrderForBaker(baker, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    await airtable.update('Orders', req.params.id, {
      Status: 'In Progress',
      'Payment Status': 'Paid'
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post('/api/orders/:id/decline', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (MODE === 'mock') {
      mock.declineOrder(req.params.id);
      return res.json({ ok: true });
    }
    const existing = await loadOrderForBaker(baker, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    await airtable.update('Orders', req.params.id, { Status: 'Declined' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post('/api/orders/:id/ready', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (MODE === 'mock') {
      mock.markReady(req.params.id);
      return res.json({ ok: true });
    }
    const existing = await loadOrderForBaker(baker, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    await airtable.update('Orders', req.params.id, { 'Ready At': new Date().toISOString() });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

async function loadSlotsForBaker(baker) {
  if (MODE === 'mock') return mock.getSlots();
  const records = await airtable.list('Availability', {
    filterByFormula: `LOWER(TRIM({Baker Email})) = '${escapeFormula(baker.email)}'`
  });
  return records.map(slotFromRecord);
}

function countFilled(orders, date) {
  return orders.filter(o =>
    o.pickupDate === date &&
    (o.status === 'in_progress' || o.status === 'complete')
  ).length;
}

app.get('/api/availability', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const [slots, orders] = await Promise.all([
      loadSlotsForBaker(baker),
      loadOrdersForBaker(baker)
    ]);
    const enriched = slots
      .filter(s => s.date)
      .map(s => ({ ...s, slotsFilled: countFilled(orders, s.date) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json({ acceptingOrders: baker.acceptingOrders, slots: enriched });
  } catch (e) { next(e); }
});

app.post('/api/availability/accepting', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const value = !!req.body?.acceptingOrders;
    if (MODE === 'mock') {
      mock.setAcceptingOrders(value);
    } else {
      await airtable.update('Baker Profiles', baker.id, { 'Accepting Orders': value });
    }
    res.json({ ok: true, acceptingOrders: value });
  } catch (e) { next(e); }
});

app.post('/api/availability/slots', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const date = String(req.body?.date || '').trim();
    const slotsAvailable = parseInt(req.body?.slotsAvailable, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Pickup date is required (YYYY-MM-DD).' });
    }
    if (!Number.isFinite(slotsAvailable) || slotsAvailable < 1) {
      return res.status(400).json({ error: 'Slot count must be 1 or more.' });
    }
    if (MODE === 'mock') {
      return res.json({ ok: true, slot: mock.addSlot(date, slotsAvailable) });
    }
    const rec = await airtable.create('Availability', {
      'Baker Email': baker.email,
      'Available Date': date,
      'Slots Available': slotsAvailable
    });
    res.json({ ok: true, slot: slotFromRecord(rec) });
  } catch (e) { next(e); }
});

app.patch('/api/availability/slots/:id', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const slotsAvailable = parseInt(req.body?.slotsAvailable, 10);
    if (!Number.isFinite(slotsAvailable) || slotsAvailable < 1) {
      return res.status(400).json({ error: 'Slot count must be 1 or more.' });
    }
    if (MODE === 'mock') {
      const slot = mock.updateSlot(req.params.id, slotsAvailable);
      if (!slot) return res.status(404).json({ error: 'Slot not found' });
      return res.json({ ok: true, slot });
    }
    const existing = await airtable.findById('Availability', req.params.id);
    if (!existing || normEmail(existing.fields['Baker Email']) !== baker.email) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    const rec = await airtable.update('Availability', req.params.id, {
      'Slots Available': slotsAvailable
    });
    res.json({ ok: true, slot: slotFromRecord(rec) });
  } catch (e) { next(e); }
});

app.get('/api/messages', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    if (MODE === 'mock') return res.json({ conversations: mock.getConversations() });
    res.json({ conversations: [], note: 'Messages live in a future Airtable table. Showing empty for now.' });
  } catch (e) { next(e); }
});

app.get('/api/messages/:id', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    if (MODE !== 'mock') return res.status(404).json({ error: 'Conversation not found.' });
    const conv = mock.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    res.json(conv);
  } catch (e) { next(e); }
});

app.post('/api/messages/:id/reply', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (MODE !== 'mock') return res.status(503).json({ error: 'Messaging is not connected yet.' });
    const msg = mock.appendMessage(req.params.id, text);
    if (!msg) return res.status(404).json({ error: 'Conversation not found.' });
    res.json({ ok: true, message: msg });
  } catch (e) { next(e); }
});

app.post('/api/messages/:id/read', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    if (MODE === 'mock') mock.markRead(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

async function loadMenuForBaker(baker) {
  if (MODE === 'mock') return mock.getMenuItems();
  const records = await airtable.list('Menu Items', {
    filterByFormula: `LOWER(TRIM({Baker Email})) = '${escapeFormula(baker.email)}'`
  });
  return records.map(menuItemFromRecord);
}

app.get('/api/menu', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    res.json(await loadMenuForBaker(baker));
  } catch (e) { next(e); }
});

app.get('/api/menu/:id', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (MODE === 'mock') {
      const item = mock.getMenuItem(req.params.id);
      if (!item) return res.status(404).json({ error: 'Menu item not found.' });
      return res.json(item);
    }
    const rec = await airtable.findById('Menu Items', req.params.id);
    if (!rec || normEmail(rec.fields['Baker Email']) !== baker.email) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }
    res.json(menuItemFromRecord(rec));
  } catch (e) { next(e); }
});

app.post('/api/menu', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Item name is required.' });
    const fields = {
      name,
      emoji: req.body?.emoji || '🧁',
      price: Number(req.body?.price) || 0,
      recipeCost: req.body?.recipeCost == null || req.body?.recipeCost === '' ? null : Number(req.body.recipeCost),
      category: req.body?.category || 'Other',
      available: req.body?.available !== false
    };
    if (MODE === 'mock') {
      return res.json({ ok: true, item: mock.addMenuItem({
        ...fields,
        productType: req.body?.productType,
        soldBy: req.body?.soldBy,
        occasionTags: req.body?.occasionTags,
        addOns: req.body?.addOns,
        typeFields: req.body?.typeFields,
        batchSize: req.body?.batchSize,
        batchUnit: req.body?.batchUnit
      }) });
    }
    const rec = await airtable.create('Menu Items', {
      'Baker Email': baker.email,
      'Item Name': fields.name,
      'Price': fields.price,
      'Category': fields.category,
      'Available': fields.available
    });
    res.json({ ok: true, item: menuItemFromRecord(rec) });
  } catch (e) { next(e); }
});

app.patch('/api/menu/:id', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const body = req.body || {};
    if (MODE === 'mock') {
      const item = mock.updateMenuItem(req.params.id, body);
      if (!item) return res.status(404).json({ error: 'Menu item not found.' });
      return res.json({ ok: true, item });
    }
    const rec = await airtable.findById('Menu Items', req.params.id);
    if (!rec || normEmail(rec.fields['Baker Email']) !== baker.email) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }
    const fields = {};
    if (body.name != null) fields['Item Name'] = body.name;
    if (body.price != null) fields['Price'] = Number(body.price);
    if (body.category != null) fields['Category'] = body.category;
    if (body.available != null) fields['Available'] = !!body.available;
    const updated = await airtable.update('Menu Items', req.params.id, fields);
    res.json({ ok: true, item: menuItemFromRecord(updated) });
  } catch (e) { next(e); }
});

app.delete('/api/menu/:id', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (MODE === 'mock') {
      mock.removeMenuItem(req.params.id);
      return res.json({ ok: true });
    }
    const rec = await airtable.findById('Menu Items', req.params.id);
    if (!rec || normEmail(rec.fields['Baker Email']) !== baker.email) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }
    await airtable.delete('Menu Items', req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post('/api/messages/:id/smart-reply', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (MODE !== 'mock') return res.status(503).json({ error: 'Messaging is not connected yet.' });
    const conv = mock.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

    let lastCustomerIdx = -1;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].from === 'customer') { lastCustomerIdx = i; break; }
    }
    if (lastCustomerIdx === -1) {
      return res.json({ suggestion: null, reason: 'no_customer_message' });
    }

    const customerMessage = conv.messages[lastCustomerIdx].text;
    const recentTurns = conv.messages
      .slice(Math.max(0, lastCustomerIdx - 6), lastCustomerIdx)
      .map(m => ({ from: m.from, text: m.text }));

    const result = await smartReply({
      baker,
      recentTurns,
      customerMessage,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    });
    res.json(result);
  } catch (e) { next(e); }
});

// ── Price My Bakes ─────────────────────────────────────────────────────────

app.get('/api/ingredients', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    res.json({ catalog: INGREDIENT_CATALOG, unitGroups: UNIT_GROUPS });
  } catch (e) { next(e); }
});

app.get('/api/baker/ingredient-overrides', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    if (MODE === 'mock') return res.json({ overrides: mock.getIngredientOverrides() });
    res.json({ overrides: {} });
  } catch (e) { next(e); }
});

app.post('/api/baker/ingredient-overrides', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    const catalogId = String(req.body?.catalogId || '');
    const price = req.body?.price;
    if (!catalogId) return res.status(400).json({ error: 'catalogId is required.' });
    if (MODE === 'mock') {
      const overrides = mock.setIngredientOverride(catalogId, price);
      return res.json({ ok: true, overrides });
    }
    res.json({ ok: true, overrides: {} });
  } catch (e) { next(e); }
});

app.get('/api/baker/custom-ingredients', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    if (MODE === 'mock') return res.json({ items: mock.getCustomIngredients() });
    res.json({ items: [] });
  } catch (e) { next(e); }
});

app.post('/api/baker/custom-ingredients', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Ingredient name is required.' });
    if (MODE === 'mock') {
      return res.json({ ok: true, item: mock.addCustomIngredient(req.body) });
    }
    res.json({ ok: true, item: null });
  } catch (e) { next(e); }
});

app.get('/api/baker/supplies', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    res.json({ supplies: mock.getSupplies() });
  } catch (e) { next(e); }
});

app.post('/api/baker/supplies', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    const item = mock.upsertSupply(req.body || {});
    if (!item) return res.status(400).json({ error: 'Supply name is required.' });
    res.json({ ok: true, supply: item });
  } catch (e) { next(e); }
});

app.delete('/api/baker/supplies/:id', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    mock.removeSupply(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.get('/api/menu/:id/recipe', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    if (MODE === 'mock') {
      const recipe = mock.getRecipe(req.params.id);
      return res.json({ recipe });
    }
    res.json({ recipe: null });
  } catch (e) { next(e); }
});

app.put('/api/menu/:id/recipe', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    if (MODE === 'mock') {
      const recipe = mock.saveRecipe(req.params.id, req.body || {});
      return res.json({ ok: true, recipe });
    }
    res.json({ ok: true, recipe: null });
  } catch (e) { next(e); }
});

function reviewFromRecord(rec) {
  const f = rec.fields || {};
  return {
    id: rec.id,
    orderId: Array.isArray(f.Order) ? f.Order[0] : null,
    item: f['Item'] || '',
    reviewerName: f['Reviewer Name'] || 'Customer',
    reviewerCity: f['Reviewer City'] || '',
    rating: Number(f['Star Rating']) || 0,
    text: f['Review Text'] || '',
    date: f['Review Date'] || null,
    pickupDate: f['Pickup Date'] || null
  };
}

app.get('/api/reviews', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (MODE === 'mock') return res.json({ reviews: mock.getReviews() });
    const records = await airtable.list('Reviews', {
      filterByFormula: `LOWER(TRIM({Baker Email})) = '${escapeFormula(baker.email)}'`
    });
    const reviews = records
      .map(reviewFromRecord)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    res.json({ reviews });
  } catch (e) { next(e); }
});

app.delete('/api/availability/slots/:id', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (MODE === 'mock') {
      mock.removeSlot(req.params.id);
      return res.json({ ok: true });
    }
    const existing = await airtable.findById('Availability', req.params.id);
    if (!existing || normEmail(existing.fields['Baker Email']) !== baker.email) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    await airtable.delete('Availability', req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.use((err, req, res, next) => {
  console.error('[server]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`\nBkd Local running on http://localhost:${PORT}`);
  if (MODE === 'airtable') {
    console.log('Mode: AIRTABLE  (bakers log in with their real email)\n');
  } else {
    console.log(`Mode: MOCK      (log in with: ${mock.baker.email})`);
    console.log('   Add AIRTABLE_API_KEY + AIRTABLE_BASE_ID to .env to switch to real data.\n');
  }
});
