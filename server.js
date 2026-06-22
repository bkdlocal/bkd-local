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
const cloudinary = require('./server/cloudinary');
const multer = require('multer');
const { hashPassword, verifyPassword, generateToken } = require('./server/passwords');
const emailService = require('./server/email');
const { CustomerStore, customerPublic } = require('./server/customers');
const publicSite = require('./server/public-site');
const publicData = require('./server/public-data');
const orderFlow = require('./server/order-flow');

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

const customers = new CustomerStore(airtable);
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const SERVICE_FEE = 1.5; // Phase 1 flat customer service fee, shown on the order request.

const app = express();
app.set('trust proxy', true);
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

  const customerPayload = verifySession(cookies.bkd_customer_session, SESSION_SECRET);
  if (customerPayload && customerPayload.email && customerPayload.iat && customerPayload.role === 'customer') {
    const age = Date.now() - customerPayload.iat;
    if (age < SESSION_TTL_SECONDS * 1000) {
      req.customer = { email: normEmail(customerPayload.email) };
    }
  }
  next();
});

// index:false so "/" is handled by the public homepage route below, not by
// auto-serving the baker SPA's index.html.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(httpError(400, 'Only image files are allowed.'));
  }
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

function requireCustomerAuth(req, res, next) {
  if (!req.customer) return res.status(401).json({ error: 'Not logged in.' });
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

function setCustomerSessionCookie(res, email) {
  const token = signSession({ email, role: 'customer', iat: Date.now() }, SESSION_SECRET);
  res.setHeader('Set-Cookie', buildCookie('bkd_customer_session', token, {
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }));
}

function clearCustomerSessionCookie(res) {
  res.setHeader('Set-Cookie', buildCookie('bkd_customer_session', '', {
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

// ── Customer auth ──────────────────────────────────────────────────────────

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
}

async function issueVerification(req, customerId, email) {
  const token = generateToken();
  const expires = new Date(Date.now() + VERIFY_TTL_MS).toISOString();
  await customers.update(customerId, {
    'Verification Token': token,
    'Verification Token Expires': expires,
    'Email Verified': false
  });
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const link = `${base}/api/customer/verify?token=${encodeURIComponent(token)}`;
  await emailService.sendVerificationEmail({ to: email, link });
  return link;
}

app.post('/api/customer/signup', async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!firstName) return res.status(400).json({ error: 'First name is required.' });

    const existing = await customers.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

    const rec = await customers.create({
      'First Name': firstName,
      'Last Name': lastName || undefined,
      'Email': email,
      'Phone': req.body?.phone || undefined,
      'City': req.body?.city || undefined,
      'Password Hash': hashPassword(password),
      'Email Verified': false,
      'Rating Count': 0,
      'Account Created': new Date().toISOString().slice(0, 10)
    });

    await issueVerification(req, rec.id, email);
    res.json({ ok: true, customer: customerPublic(rec), emailVerified: false });
  } catch (e) { next(e); }
});

app.post('/api/customer/login', async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const rec = await customers.findByEmail(email);
    if (!rec || !verifyPassword(password, rec.fields['Password Hash'])) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    if (rec.fields['Email Verified'] !== true) {
      return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox for the verification link.' });
    }
    setCustomerSessionCookie(res, email);
    res.json({ ok: true, customer: customerPublic(rec) });
  } catch (e) { next(e); }
});

app.post('/api/customer/logout', (req, res) => {
  clearCustomerSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/customer/me', requireCustomerAuth, async (req, res, next) => {
  try {
    const rec = await customers.findByEmail(req.customer.email);
    if (!rec) return res.status(404).json({ error: 'Account not found.' });
    res.json({ customer: customerPublic(rec) });
  } catch (e) { next(e); }
});

app.get('/api/customer/verify', async (req, res, next) => {
  try {
    const token = String(req.query?.token || '');
    if (!token) return res.status(400).json({ error: 'Missing verification token.' });
    const rec = await customers.findByToken(token);
    if (!rec) return res.status(400).json({ error: 'Invalid or already-used verification link.' });
    const expires = rec.fields['Verification Token Expires'];
    if (expires && Date.now() > new Date(expires).getTime()) {
      return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
    }
    await customers.update(rec.id, {
      'Email Verified': true,
      'Verification Token': null,
      'Verification Token Expires': null
    });
    res.json({ ok: true, verified: true });
  } catch (e) { next(e); }
});

app.post('/api/customer/resend-verification', async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const rec = await customers.findByEmail(email);
    // Respond generically either way so this can't be used to probe which emails are registered.
    if (rec && rec.fields['Email Verified'] !== true) {
      await issueVerification(req, rec.id, email);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Photo uploads ──────────────────────────────────────────────────────────

app.post('/api/uploads/photo', requireAuth, photoUpload.single('photo'), async (req, res, next) => {
  try {
    await currentBaker(req);
    if (!cloudinary.isConfigured()) {
      return res.status(503).json({ error: 'Photo uploads are not configured.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded. Attach a file under the "photo" field.' });
    }
    const result = await cloudinary.uploadImage(req.file.buffer, {
      filename: req.file.originalname
    });
    res.json({
      ok: true,
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height
    });
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

// ── Public site (server-rendered) ────────────────────────────────────────────

async function loadPublicBakers() {
  if (MODE === 'mock') return [publicData.publicBakerFromMock(mock.baker)];
  const records = await airtable.list('Baker Profiles', {
    filterByFormula: "{Profile Status} = 'Live'"
  });
  return records.map(publicData.publicBakerFromRecord);
}

async function loadPublicBakerById(id) {
  if (MODE === 'mock') {
    return id === mock.baker.id ? publicData.publicBakerFromMock(mock.baker) : null;
  }
  const rec = await airtable.findById('Baker Profiles', id);
  if (!rec || rec.fields['Profile Status'] !== 'Live') return null;
  return publicData.publicBakerFromRecord(rec);
}

async function loadPublicMenu(email) {
  if (MODE === 'mock') {
    return mock.getMenuItems().filter(m => m.available !== false).map(publicData.publicMenuItemFromMock);
  }
  const records = await airtable.list('Menu Items', {
    filterByFormula: `AND(LOWER(TRIM({Baker Email})) = '${escapeFormula(email)}', {Available})`
  });
  return records.map(publicData.publicMenuItemFromRecord);
}

async function loadPublicReviews(email) {
  if (MODE === 'mock') {
    return mock.getReviews().map(r => ({ reviewerName: r.reviewerName, rating: r.rating, text: r.text, date: r.date }));
  }
  const records = await airtable.list('Reviews', {
    filterByFormula: `LOWER(TRIM({Baker Email})) = '${escapeFormula(email)}'`,
    sort: [{ field: 'Review Date', direction: 'desc' }]
  });
  return records.map(publicData.publicReviewFromRecord);
}

// Availability "Available Date" is a date-only field; the API returns it as a
// 'YYYY-MM-DD' string. Compare as strings (no Date parsing) so the picker value
// and the stored value can't drift by a day across timezones.
function availabilityDateMatches(d, dateFilter) {
  if (!d || typeof d !== 'string') return false;
  const iso = d.slice(0, 10);
  if (dateFilter.mode === 'range') return iso >= dateFilter.from && iso <= dateFilter.to;
  return iso === dateFilter.date;
}

// Spec 6.2: a row only makes the baker available if it still has open capacity
// (Slots Filled < Slots Available). A blank Slots Filled counts as 0; a missing
// or non-positive Slots Available is treated as no capacity.
function slotHasOpenCapacity(available, filled) {
  const a = Number(available);
  if (!Number.isFinite(a) || a <= 0) return false;
  const f = Number(filled) || 0;
  return f < a;
}

// Returns the set of baker emails + linked record ids that have at least one
// Availability row on (single) or within (range) the selected date AND with
// open capacity on that row.
async function availableBakerKeys(dateFilter) {
  const emails = new Set();
  const ids = new Set();
  if (MODE === 'mock') {
    if (mock.getSlots().some(s =>
      availabilityDateMatches(s.date, dateFilter) &&
      slotHasOpenCapacity(s.slotsAvailable, s.slotsFilled))) {
      emails.add(normEmail(mock.baker.email));
      ids.add(mock.baker.id);
    }
    return { emails, ids };
  }
  const rows = await airtable.list('Availability');
  for (const rec of rows) {
    if (!availabilityDateMatches(rec.fields['Available Date'], dateFilter)) continue;
    if (!slotHasOpenCapacity(rec.fields['Slots Available'], rec.fields['Slots Filled'])) continue;
    const email = normEmail(rec.fields['Baker Email']);
    if (email) emails.add(email);
    const links = rec.fields['Baker Profiles'];
    if (Array.isArray(links)) links.forEach(id => ids.add(id));
  }
  return { emails, ids };
}

app.get('/', async (req, res, next) => {
  try {
    const bakers = await loadPublicBakers();
    res.type('html').send(publicSite.renderHome({ bakers }));
  } catch (e) { next(e); }
});

app.get('/bakers', async (req, res, next) => {
  try {
    const all = await loadPublicBakers();
    const cities = [...new Set(all.map(b => b.city).filter(Boolean))].sort();
    const types = [...new Set(all.flatMap(b => b.productTypes))].sort();
    const city = req.query.city ? String(req.query.city) : '';
    const type = req.query.type ? String(req.query.type) : '';
    const q = req.query.q ? String(req.query.q).trim() : '';

    // Date-first filter (primary). Single date or inclusive from/to range.
    const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
    const mode = req.query.mode === 'range' ? 'range' : 'single';
    let date = '', from = '', to = '', dateFilter = null;
    if (mode === 'range') {
      from = isDate(req.query.from) ? String(req.query.from) : '';
      to = isDate(req.query.to) ? String(req.query.to) : '';
      if (from && to) {
        if (from > to) { const tmp = from; from = to; to = tmp; } // forgiving about order
        dateFilter = { mode: 'range', from, to };
      }
    } else {
      date = isDate(req.query.date) ? String(req.query.date) : '';
      if (date) dateFilter = { mode: 'single', date };
    }

    let bakers = all;
    if (dateFilter) {
      const { emails, ids } = await availableBakerKeys(dateFilter);
      bakers = bakers.filter(b => emails.has(b.email) || ids.has(b.id));
    }
    if (q) {
      const ql = q.toLowerCase();
      bakers = bakers.filter(b =>
        [b.businessName, b.bio, ...(b.productTypes || []), ...(b.specialtyTags || [])]
          .filter(Boolean).join(' ').toLowerCase().includes(ql)
      );
    }
    if (city) bakers = bakers.filter(b => b.city === city);
    if (type) bakers = bakers.filter(b => b.productTypes.includes(type));

    res.type('html').send(publicSite.renderDirectory({
      bakers, cities, types,
      filters: { city, type, q, mode, date, from, to },
      total: all.length
    }));
  } catch (e) { next(e); }
});

app.get('/bakers/:id', async (req, res, next) => {
  try {
    const baker = await loadPublicBakerById(req.params.id);
    if (!baker) return res.status(404).type('html').send(publicSite.renderNotFound());
    const [menu, reviews] = await Promise.all([
      loadPublicMenu(baker.email),
      loadPublicReviews(baker.email)
    ]);
    res.type('html').send(publicSite.renderProfile({ baker, menu, reviews }));
  } catch (e) { next(e); }
});

// ── Customer order request flow (spec 6.4) ──────────────────────────────────

async function loadMenuItemForBaker(baker, itemId) {
  if (!itemId) return null;
  if (MODE === 'mock') {
    const m = mock.getMenuItem(itemId);
    return m ? publicData.publicMenuItemFromMock(m) : null;
  }
  const rec = await airtable.findById('Menu Items', itemId);
  if (!rec || normEmail(rec.fields['Baker Email']) !== baker.email) return null;
  if (rec.fields['Available'] === false) return null;
  return publicData.publicMenuItemFromRecord(rec);
}

// Pickup dates this baker has open capacity on, today or later (string compare).
async function loadBakerOpenDates(baker) {
  const today = new Date().toISOString().slice(0, 10);
  const out = new Set();
  if (MODE === 'mock') {
    mock.getSlots().forEach(s => {
      const d = String(s.date || '').slice(0, 10);
      if (d && d >= today && slotHasOpenCapacity(s.slotsAvailable, s.slotsFilled)) out.add(d);
    });
  } else {
    const rows = await airtable.list('Availability', {
      filterByFormula: `LOWER(TRIM({Baker Email})) = '${escapeFormula(baker.email)}'`
    });
    rows.forEach(rec => {
      const d = String(rec.fields['Available Date'] || '').slice(0, 10);
      if (d && d >= today && slotHasOpenCapacity(rec.fields['Slots Available'], rec.fields['Slots Filled'])) out.add(d);
    });
  }
  return [...out].sort();
}

// Order Status "Pending" may not exist on the single-select yet (the MCP can't
// add select options). Prefer Pending; fall back to New if Airtable rejects it.
async function createOrderRecord(fields) {
  if (MODE === 'mock') {
    console.log('[order:mock] would create order:', JSON.stringify(fields));
    return { id: 'mock-order' };
  }
  try {
    return await airtable.create('Orders', { ...fields, 'Order Status': 'Pending' });
  } catch (e) {
    if (e && e.status === 422) {
      console.warn('[order] "Pending" Order Status not available; using "New". Add a Pending option to enable it.');
      return await airtable.create('Orders', { ...fields, 'Order Status': 'New' });
    }
    throw e;
  }
}

app.get('/login', (req, res) => {
  res.type('html').send(orderFlow.renderAuth({ mode: 'login', redirect: req.query.redirect ? String(req.query.redirect) : '' }));
});

app.get('/signup', (req, res) => {
  res.type('html').send(orderFlow.renderAuth({ mode: 'signup', redirect: req.query.redirect ? String(req.query.redirect) : '' }));
});

app.get('/order/new', async (req, res, next) => {
  try {
    if (!req.customer) {
      return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    const baker = await loadPublicBakerById(String(req.query.baker || ''));
    if (!baker) return res.status(404).type('html').send(publicSite.renderNotFound());
    const item = await loadMenuItemForBaker(baker, String(req.query.item || ''));
    if (!item) return res.status(404).type('html').send(publicSite.renderNotFound());
    const availableDates = await loadBakerOpenDates(baker);
    res.type('html').send(orderFlow.renderOrderFlow({ baker, item, availableDates, serviceFee: SERVICE_FEE }));
  } catch (e) { next(e); }
});

app.post('/api/orders/request', requireCustomerAuth, async (req, res, next) => {
  try {
    const customer = await customers.findByEmail(req.customer.email);
    if (!customer) return res.status(404).json({ error: 'Account not found.' });
    const b = req.body || {};

    const baker = await loadPublicBakerById(String(b.bakerId || ''));
    if (!baker) return res.status(404).json({ error: 'Baker not found.' });
    const item = await loadMenuItemForBaker(baker, String(b.itemId || ''));
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const quantity = Math.max(1, parseInt(b.quantity, 10) || 0);
    const pickupDate = String(b.pickupDate || '');
    const openDates = await loadBakerOpenDates(baker);
    if (!openDates.includes(pickupDate)) {
      return res.status(400).json({ error: 'Please choose an available pickup date.' });
    }

    // Recompute add-ons + total server-side from the item definition. Never trust client prices.
    const defByName = new Map(item.addOns.map(a => [a.name, a]));
    const addOns = [];
    let addOnTotal = 0;
    for (const sel of (Array.isArray(b.addOns) ? b.addOns : [])) {
      const def = defByName.get(sel && sel.name);
      if (!def) continue;
      let qty = parseInt(sel.qty, 10) || 0;
      if (qty <= 0) continue;
      qty = def.unit === 'per_cookie' ? Math.min(qty, quantity) : 1;
      const cost = def.unit === 'per_cookie' ? qty * def.price : def.price;
      addOnTotal += cost;
      addOns.push({ name: def.name, unit: def.unit, price: def.price, qty });
    }
    const subtotal = quantity * Number(item.price) + addOnTotal;
    const orderTotal = Math.round((subtotal + SERVICE_FEE) * 100) / 100;

    const customerName = [customer.fields['First Name'], customer.fields['Last Name']]
      .filter(Boolean).join(' ').trim();
    const notes = b.notes ? String(b.notes).trim() : '';

    await createOrderRecord({
      'Order ID': 'ORD-' + Date.now().toString(36).toUpperCase(),
      'Baker Name': baker.businessName,
      'Baker Email': baker.email,
      'Customer Email': req.customer.email,
      'Customer Name': customerName || undefined,
      'Customer Phone': customer.fields['Phone'] || undefined,
      'Menu Item': item.name,
      'Add-ons Selected': JSON.stringify(addOns),
      'Order Total': orderTotal,
      'Pick Up Date': pickupDate,
      'Notes': notes || undefined
    });

    // Baker notification: no channel is wired yet (email is stubbed). Log for now.
    console.log(`[order] request for ${baker.email} from ${req.customer.email}: ${item.name} x${quantity}, pickup ${pickupDate}, total $${orderTotal}`);
    res.json({ ok: true, orderTotal });
  } catch (e) { next(e); }
});

// Baker-facing SPA now lives under /app (client-side routed).
app.get(['/app', '/app/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[server]', err.message);
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  res.status(status).json({ error: err.message || 'Server error' });
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
