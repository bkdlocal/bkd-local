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
  MENU_PHOTO_FIELDS,
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
const joinFlow = require('./server/join-flow');
const stripeClient = require('./server/stripe');
const customerSite = require('./server/customer-site');
const messaging = require('./server/messaging');
const ratings = require('./server/ratings');

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
const SETPW_TTL_MS = 72 * 60 * 60 * 1000; // baker set-password link validity
const CHARTER_PRICE_CENTS = 9700; // Bkd Local Charter Membership: $97 one-time
const mockOrders = []; // mock-mode customer order store (in-memory)
const mockMessages = []; // mock-mode unified Messages store (in-memory)
const mockBakerFields = {}; // mock-mode baker auth fields (Password Hash, Set Password Token...)

// Mock-only: one Fulfilled order so the rating flow is demonstrable in mock.
// Owner is ratingdemo@test.com (sign that email up to claim it). Pickup = today
// so the 7-day rating window is open regardless of the machine clock.
if (MODE === 'mock') {
  mockOrders.push({
    id: 'mockord-fulfilled-demo',
    fields: {
      'Order ID': 'ORD-DEMO',
      'Baker Name': mock.baker.businessName,
      'Baker Email': normEmail(mock.baker.email),
      'Customer Email': 'ratingdemo@test.com',
      'Customer Name': 'Rating Demo',
      'Menu Item': 'French Macaron Box',
      'Item Subtotal': 42, 'Service Fee': 1.5, 'Order Total': 43.5,
      'Pick Up Date': new Date().toISOString().slice(0, 10),
      'Order Status': 'Fulfilled'
    }
  });
}

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.bkd_session;
  const payload = verifySession(token, SESSION_SECRET);
  if (payload && payload.email && payload.iat && payload.role === 'baker') {
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
  const token = signSession({ email, role: 'baker', iat: Date.now() }, SESSION_SECRET);
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

// Raw Baker Profiles record for auth (Password Hash / token). Kept separate from
// bakerFromRecord so the hash is never serialized to the client.
async function findBakerAuthRecord(email) {
  const e = normEmail(email);
  if (MODE === 'mock') {
    if (e !== normEmail(mock.baker.email)) return null;
    return { id: mock.baker.id, fields: mockBakerFields, _mock: true, email: e };
  }
  const rec = await airtable.findOne('Baker Profiles', {
    filterByFormula: `LOWER(TRIM({Email})) = '${escapeFormula(e)}'`
  });
  return rec ? { id: rec.id, fields: rec.fields, email: e } : null;
}

async function findBakerAuthByToken(token) {
  const t = String(token || '');
  if (!t) return null;
  if (MODE === 'mock') {
    return mockBakerFields['Set Password Token'] === t
      ? { id: mock.baker.id, fields: mockBakerFields, _mock: true, email: normEmail(mock.baker.email) }
      : null;
  }
  const rec = await airtable.findOne('Baker Profiles', {
    filterByFormula: `{Set Password Token} = '${escapeFormula(t)}'`
  });
  return rec ? { id: rec.id, fields: rec.fields, email: normEmail(rec.fields['Email']) } : null;
}

async function updateBakerAuth(rec, fields) {
  // Guardrail: refuse to ever null/blank an existing Password Hash. Clearing it
  // breaks the baker's login at onboarding; nothing should ever do this. (Token
  // fields ARE allowed to be nulled — that's how a used set-password link is
  // cleared.) The generic profile-save path (PATCH /api/baker) never reaches
  // here and whitelists its fields, so auth fields can't be written there.
  if ('Password Hash' in fields && !fields['Password Hash']) {
    console.error(`[auth] BLOCKED attempt to clear Password Hash on ${rec.id || '(mock)'}`);
    throw new Error('Refusing to clear Password Hash.');
  }
  if (rec._mock) { Object.assign(mockBakerFields, fields); return; }
  await airtable.update('Baker Profiles', rec.id, fields);
}

async function issueBakerSetPassword(req, rec, email) {
  const token = generateToken();
  const expires = new Date(Date.now() + SETPW_TTL_MS).toISOString();
  await updateBakerAuth(rec, { 'Set Password Token': token, 'Set Password Token Expires': expires });
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const link = `${base}/auth/set-password?token=${encodeURIComponent(token)}`;
  try {
    await emailService.sendSetPasswordEmail({ to: email, link });
  } catch (e) {
    // Roll back the token so a failed send never leaves a dangling, unusable
    // token on the record. Clearing token fields is allowed by the guardrail;
    // the Password Hash is never touched here.
    await updateBakerAuth(rec, { 'Set Password Token': null, 'Set Password Token Expires': null });
    throw e;
  }
  return link;
}

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email) return res.status(400).json({ error: 'Please enter your email.' });

    const baker = await lookupBakerByEmail(email);
    if (!baker) {
      return res.status(404).json({
        error: MODE === 'mock'
          ? `No baker found in demo mode. Try: ${mock.baker.email}`
          : "We couldn't find a baker account for that email. New bakers, apply at bkdlocal.com."
      });
    }

    const authRec = await findBakerAuthRecord(email);
    const hash = authRec && authRec.fields['Password Hash'];
    if (!hash) {
      // No password set yet. Do NOT issue a token here. The set-password link is
      // sent only through the single "Set or reset your password" path
      // (/api/auth/forgot-password), so one request maps to exactly one token.
      return res.status(403).json({
        error: 'You have not set a password yet. Tap "Set or reset your password" to get a secure link by email.',
        needsPasswordSetup: true
      });
    }
    if (!password) return res.status(400).json({ error: 'Email and password are required.' });
    if (!verifyPassword(password, hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    setSessionCookie(res, baker.email);
    res.json({ ok: true, baker });
  } catch (e) { next(e); }
});

// Baker sets their password from an emailed one-time link.
app.get('/auth/set-password', (req, res) => {
  res.type('html').send(orderFlow.renderBakerSetPassword({ token: req.query.token ? String(req.query.token) : '' }));
});

app.post('/api/auth/set-password', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    if (!token) return res.status(400).json({ error: 'Missing token.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const rec = await findBakerAuthByToken(token);
    if (!rec) return res.status(400).json({ error: 'This set-password link is invalid or has already been used.' });
    const expires = rec.fields['Set Password Token Expires'];
    if (expires && Date.now() > new Date(expires).getTime()) {
      return res.status(400).json({ error: 'This set-password link has expired. Please request a new one.' });
    }
    await updateBakerAuth(rec, {
      'Password Hash': hashPassword(password),
      'Set Password Token': null,
      'Set Password Token Expires': null
    });
    // Log the baker in immediately and send them to the app.
    setSessionCookie(res, rec.email);
    res.json({ ok: true, redirect: '/app' });
  } catch (e) { next(e); }
});

// Forgot / re-issue set-password link. Generic response (no account enumeration).
app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const authRec = email ? await findBakerAuthRecord(email) : null;
    if (authRec) {
      try {
        await issueBakerSetPassword(req, authRec, email);
      } catch (e) {
        // Token already rolled back in issueBakerSetPassword. Surface a clean
        // message instead of the raw provider error.
        console.error('[set-password] could not send email:', e.message);
        return res.status(502).json({ error: 'We could not send the email right now. Please try again in a minute.' });
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Baker self-serve signup (/join). Replaces the Tally + Zapier intake.
// Charter ($97 one-time) goes through Stripe Checkout and is verified paid
// before any record is created; Beta (free) goes straight to the form. Both
// finish by creating a Baker Profiles record and firing the existing
// set-password email flow.
// ---------------------------------------------------------------------------
app.get('/join', (req, res) => {
  res.type('html').send(joinFlow.renderJoin({
    stripeReady: stripeClient.configured(),
    error: req.query.error ? String(req.query.error) : ''
  }));
});

app.post('/api/join/checkout', async (req, res, next) => {
  try {
    if (!stripeClient.configured()) {
      return res.status(503).json({ error: 'Card checkout is temporarily unavailable. Please start with the free Beta, or check back shortly.' });
    }
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const session = await stripeClient.createCheckoutSession({
      amount: CHARTER_PRICE_CENTS,
      productName: 'Bkd Local Charter Membership',
      successUrl: `${base}/join/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/join`,
      metadata: { tier: 'charter' }
    });
    res.json({ url: session.url });
  } catch (e) { next(e); }
});

// Stripe success redirect lands here. Verify the session is actually paid
// before showing the finish form; otherwise bounce back to /join.
app.get('/join/complete', async (req, res, next) => {
  try {
    const sessionId = req.query.session_id ? String(req.query.session_id) : '';
    if (!sessionId || !stripeClient.configured()) return res.redirect('/join?error=payment');
    let session;
    try { session = await stripeClient.retrieveCheckoutSession(sessionId); }
    catch (e) { return res.redirect('/join?error=payment'); }
    if (!session || session.payment_status !== 'paid') return res.redirect('/join?error=payment');
    res.type('html').send(joinFlow.renderFinish({
      tier: 'charter',
      sessionId,
      email: (session.customer_details && session.customer_details.email) || ''
    }));
  } catch (e) { next(e); }
});

// Beta entry to the finish form. Charter cannot be obtained here: the tier is
// forced to 'beta', and /api/join/finish re-verifies payment for Charter anyway.
app.get('/join/finish', (req, res) => {
  res.type('html').send(joinFlow.renderFinish({ tier: 'beta', sessionId: '', email: '' }));
});

app.post('/api/join/finish', async (req, res, next) => {
  try {
    if (!airtable) return res.status(503).json({ error: 'Signup is unavailable in demo mode.' });
    const b = req.body || {};
    const tier = b.tier === 'charter' ? 'charter' : 'beta';

    // Charter must present a Stripe session that is verified paid here, so the
    // finish endpoint can't be called directly to mint a free Charter account.
    if (tier === 'charter') {
      if (!stripeClient.configured()) return res.status(503).json({ error: 'Payment is temporarily unavailable.' });
      const sessionId = String(b.sessionId || '');
      if (!sessionId) return res.status(402).json({ error: 'Payment could not be verified. Please start again.' });
      let session;
      try { session = await stripeClient.retrieveCheckoutSession(sessionId); }
      catch (e) { return res.status(402).json({ error: 'Payment could not be verified. Please start again.' }); }
      if (!session || session.payment_status !== 'paid') {
        return res.status(402).json({ error: 'Payment could not be verified. Please start again.' });
      }
    }

    const firstName = String(b.firstName || '').trim();
    const lastName = String(b.lastName || '').trim();
    const bakeryName = String(b.bakeryName || '').trim();
    const email = normEmail(b.email);
    const phone = String(b.phone || '').trim();
    const city = String(b.city || '').trim();
    const state = String(b.state || '').trim().toUpperCase();
    const zip = String(b.zip || '').trim();

    if (!firstName || !lastName) return res.status(400).json({ error: 'Please enter your first and last name.' });
    if (!bakeryName) return res.status(400).json({ error: 'Please enter your bakery name.' });
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    // City field stores "City, ST" combined (e.g. "Jackson, TN"). State comes
    // from the dropdown as a 2-letter code; city alone is kept if state is absent.
    const cityCombined = city && /^[A-Z]{2}$/.test(state) ? `${city}, ${state}` : city;

    // One Baker Profile per email.
    const existing = await findBakerAuthRecord(email);
    if (existing) {
      return res.status(409).json({ error: 'An account already exists for that email. Try logging in or resetting your password.' });
    }

    const fields = {
      'Contact Name': `${firstName} ${lastName}`,
      'Business Name': bakeryName,
      'Email': email,
      'Profile Status': 'Incomplete'
    };
    if (phone) fields['Phone'] = phone;
    if (cityCombined) fields['City'] = cityCombined;
    if (zip) fields['Zip Code'] = zip;
    if (tier === 'charter') {
      fields['Tier'] = 'Charter';
      fields['Fee Rate'] = 0.05;                  // 5% lifetime
      fields['Fee Rate (legacy text)'] = '5%';    // exact live single-select option
      fields['Badge'] = 'Founding Baker';
    } else {
      fields['Tier'] = 'Beta';
      fields['Fee Rate'] = 0;                      // free for the 90-day beta window
      fields['Fee Rate (legacy text)'] = '0% (90 days)';
      // Badge intentionally left blank for Beta.
    }

    const rec = await airtable.create('Baker Profiles', fields);

    // Fire the set-password email through the existing forgot-password flow.
    try {
      await issueBakerSetPassword(req, { id: rec.id, fields: rec.fields, email }, email);
    } catch (e) {
      // Account exists but the email didn't send. Don't fail the signup; tell
      // them to use the reset-password link instead.
      console.error('[join] set-password email failed:', e.message);
      return res.status(200).json({ ok: true, emailWarning: true, recordId: rec.id });
    }

    res.json({ ok: true, recordId: rec.id });
  } catch (e) { next(e); }
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
    await safeRecomputeProfileStatus(baker);
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
    // Accepting only confirms the order. No payment is collected in Phase 1
    // (no Stripe), so we never mark it paid here.
    await airtable.update('Orders', req.params.id, { 'Order Status': 'Confirmed' });
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
    await airtable.update('Orders', req.params.id, { 'Order Status': 'Cancelled' });
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
    // "Mark ready" advances a confirmed order to Fulfilled (live Orders has no
    // separate "Ready" state, and no "Ready At" field exists).
    await airtable.update('Orders', req.params.id, { 'Order Status': 'Fulfilled' });
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

// ── Profile Status auto-complete ─────────────────────────────────────────────
// A baker becomes "Live" once their profile is order-ready: Bio + City filled,
// at least one sellable Menu Item (Cover Photo URL + Price), and at least one
// Availability slot. Otherwise "Incomplete". Re-run after any save to Baker
// Profiles, Menu Items, or Availability. A manually "Paused" baker is left
// untouched. Best-effort: wrapped so it never blocks or fails the save.
//
// Availability is matched on Baker Email (not the Baker Profiles link): slots
// created in-app set Baker Email but leave the link field empty, so email is
// the reliable join. Menu Items has no link field, so it is matched on email too.
async function recomputeProfileStatus(baker) {
  if (MODE === 'mock' || !airtable || !baker || !baker.id || !baker.email) return null;

  const profile = await airtable.findById('Baker Profiles', baker.id);
  if (!profile) return null;
  const f = profile.fields;
  const current = f['Profile Status'];

  if (current === 'Paused') return current; // never override a deliberate pause

  const bioOk  = String(f['Bio'] || '').trim() !== '';
  const cityOk = String(f['City'] || '').trim() !== ''; // City may carry a trailing space

  const menuItems = await airtable.list('Menu Items', {
    filterByFormula: `LOWER(TRIM({Baker Email})) = '${escapeFormula(baker.email)}'`
  });
  const hasSellableItem = menuItems.some((m) => {
    const cover = String(m.fields['Cover Photo URL'] || '').trim();
    const price = m.fields['Price'];
    const priceOk = price !== undefined && price !== null && String(price).trim() !== '';
    return cover !== '' && priceOk;
  });

  const slots = await airtable.list('Availability', {
    filterByFormula: `LOWER(TRIM({Baker Email})) = '${escapeFormula(baker.email)}'`
  });
  const hasAvailability = slots.length > 0;

  const next = (bioOk && cityOk && hasSellableItem && hasAvailability) ? 'Live' : 'Incomplete';
  if (next !== current) {
    await airtable.update('Baker Profiles', baker.id, { 'Profile Status': next });
  }
  return next;
}

async function safeRecomputeProfileStatus(baker) {
  try {
    return await recomputeProfileStatus(baker);
  } catch (e) {
    console.error('[profile-status] recompute failed:', e.message);
    return null;
  }
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
    await safeRecomputeProfileStatus(baker);
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
    await safeRecomputeProfileStatus(baker);
    res.json({ ok: true, slot: slotFromRecord(rec) });
  } catch (e) { next(e); }
});

app.get('/api/messages', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    res.json({ conversations: await bakerConversations(baker.email) });
  } catch (e) { next(e); }
});

app.get('/api/messages/:id', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const conv = await bakerConversation(baker.email, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    res.json(conv);
  } catch (e) { next(e); }
});

app.post('/api/messages/:id/reply', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
    const list = (await listMessages({ thread: req.params.id })).filter(m => m.bakerEmail === baker.email);
    if (!list.length) return res.status(404).json({ error: 'Conversation not found.' });
    const msg = await createMessage({ bakerEmail: baker.email, customerEmail: list[0].customerEmail, sender: 'baker', text });
    res.json({ ok: true, message: { id: msg.id, from: 'baker', text: msg.text, sentAt: msg.sentAt } });
  } catch (e) { next(e); }
});

app.post('/api/messages/:id/read', requireAuth, async (req, res, next) => {
  try {
    await currentBaker(req);
    // No read-state field on Messages yet; unread is derived (trailing customer
    // messages). Replying clears it. True read receipts need a schema field (later).
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

// Baker-app product-type / sold-by ids -> live single-select option names.
const PRODUCT_TYPE_TO_AIRTABLE = {
  sugarCookies: 'Decorated Sugar Cookies',
  cakes: 'Cakes',
  cupcakes: 'Cupcakes',
  macarons: 'Macarons',
  dropCookies: 'Drop Cookies / Bars / Brownies'
};
const SOLD_PER_TO_AIRTABLE = {
  dozen: 'Dozen',
  halfDozen: 'Half dozen',
  individual: 'Individual'
};

// Spread an array of photo URLs across Cover Photo URL + Portfolio Photo URL 1-6.
function menuPhotoFieldsFor(photos) {
  const arr = (Array.isArray(photos) ? photos.filter(Boolean) : []).slice(0, MENU_PHOTO_FIELDS.length);
  const out = {};
  MENU_PHOTO_FIELDS.forEach((field, i) => { out[field] = arr[i] || null; });
  return out;
}

// Required to save (client mirrors this): name, product type, sold-by, base
// price > 0, and at least one photo. Max Colors stays optional.
function validateMenuPayload(body) {
  const b = body || {};
  if (!String(b.name || '').trim()) return 'Item name is required.';
  if (!PRODUCT_TYPE_TO_AIRTABLE[b.productType]) return 'Please choose a product type.';
  if (!SOLD_PER_TO_AIRTABLE[b.soldBy]) return 'Please choose how this item is sold.';
  if (!(Number(b.price) > 0)) return 'Please enter a base price greater than $0.';
  const photos = Array.isArray(b.photos) ? b.photos.filter(Boolean) : [];
  if (photos.length < 1) return 'Please add at least one photo.';
  return null;
}

function menuItemAirtableFields(baker, b, { includeBaker } = {}) {
  const fields = {
    'Item Name': String(b.name).trim(),
    'Price': Number(b.price),
    'Product Type': PRODUCT_TYPE_TO_AIRTABLE[b.productType],
    'Sold Per': SOLD_PER_TO_AIRTABLE[b.soldBy],
    'Available': b.available !== false,
    ...menuPhotoFieldsFor(b.photos)
  };
  if (includeBaker) {
    fields['Baker Email'] = baker.email;
    if (baker.businessName) fields['Baker Name'] = baker.businessName;
  }
  return fields;
}

app.post('/api/menu', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const invalid = validateMenuPayload(req.body);
    if (invalid) return res.status(400).json({ error: invalid });
    const b = req.body || {};
    if (MODE === 'mock') {
      return res.json({ ok: true, item: mock.addMenuItem({
        name: String(b.name).trim(),
        emoji: b.emoji || '🧁',
        price: Number(b.price) || 0,
        category: b.category || 'Other',
        available: b.available !== false,
        productType: b.productType,
        soldBy: b.soldBy,
        occasionTags: b.occasionTags,
        addOns: b.addOns,
        typeFields: b.typeFields,
        batchSize: b.batchSize,
        batchUnit: b.batchUnit,
        photos: Array.isArray(b.photos) ? b.photos.filter(Boolean) : []
      }) });
    }
    const rec = await airtable.create('Menu Items', menuItemAirtableFields(baker, b, { includeBaker: true }));
    await safeRecomputeProfileStatus(baker);
    res.json({ ok: true, item: menuItemFromRecord(rec) });
  } catch (e) { next(e); }
});

app.patch('/api/menu/:id', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const invalid = validateMenuPayload(req.body);
    if (invalid) return res.status(400).json({ error: invalid });
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
    const updated = await airtable.update('Menu Items', req.params.id, menuItemAirtableFields(baker, body));
    await safeRecomputeProfileStatus(baker);
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
    const conv = await bakerConversation(baker.email, req.params.id);
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

// Baker profile photo: upload via the same Cloudinary path, then store the URL
// on the existing "Profile Photo" attachment field (renders on the profile
// avatar, the public profile banner, and the directory card).
app.post('/api/baker/profile/photo', requireAuth, photoUpload.single('photo'), async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    if (!cloudinary.isConfigured()) {
      return res.status(503).json({ error: 'Photo uploads are not configured.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded.' });
    }
    const result = await cloudinary.uploadImage(req.file.buffer, { filename: req.file.originalname });
    if (MODE === 'mock') {
      if (mock.baker) mock.baker.photo = result.url;
      return res.json({ ok: true, url: result.url });
    }
    const rec = await airtable.findOne('Baker Profiles', {
      filterByFormula: `LOWER(TRIM({Email})) = '${escapeFormula(baker.email)}'`
    });
    if (!rec) return res.status(404).json({ error: 'Baker profile not found.' });
    // "Profile Photo" is an attachment field; Airtable ingests the public URL.
    await airtable.update('Baker Profiles', rec.id, { 'Profile Photo': [{ url: result.url }] });
    res.json({ ok: true, url: result.url });
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
    await safeRecomputeProfileStatus(baker);
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

// Public reviews for the dual-rating system come from Orders (Customer Review
// Text on Fulfilled, rated orders), most recent first. First name + last initial.
function shortReviewer(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Customer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

async function loadBakerReviews(email) {
  const orders = await ratingOrders({ baker: email });
  return orders
    .filter(o => o.status === 'Fulfilled' && o.customerRatingOfBaker != null && o.customerReviewText)
    .map(o => ({ reviewerName: shortReviewer(o.customerName), rating: o.customerRatingOfBaker, text: o.customerReviewText, date: o.pickupDate }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
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

// Logged-in customers get a Messages/Orders/Profile top nav (with unread badge).
async function viewerFor(req) {
  if (!req.customer) return null;
  try {
    const threads = await customerThreads(req.customer.email);
    return { customer: true, unread: threads.filter(t => t.unread).length };
  } catch (_) { return { customer: true, unread: 0 }; }
}

app.get('/', async (req, res, next) => {
  try {
    const bakers = await loadPublicBakers();
    res.type('html').send(publicSite.renderHome({ bakers, viewer: await viewerFor(req) }));
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
      total: all.length,
      viewer: await viewerFor(req)
    }));
  } catch (e) { next(e); }
});

app.get('/bakers/:id', async (req, res, next) => {
  try {
    const baker = await loadPublicBakerById(req.params.id);
    if (!baker) return res.status(404).type('html').send(publicSite.renderNotFound());
    const [menu, reviews] = await Promise.all([
      loadPublicMenu(baker.email),
      loadBakerReviews(baker.email)
    ]);
    res.type('html').send(publicSite.renderProfile({ baker, menu, reviews, viewer: await viewerFor(req) }));
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
    const id = 'mockord-' + (mockOrders.length + 1);
    mockOrders.push({ id, fields: { ...fields, 'Order Status': fields['Order Status'] || 'New' } });
    console.log('[order:mock] created', id, JSON.stringify(fields));
    return { id };
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
    // Phase 1: store ONLY customer-facing numbers. The percentage platform fee
    // (baker subtotal x Fee Rate) is NOT computed or stored at request time; it
    // is calculated later when the baker confirms (Phase 2 / Stripe).
    const itemSubtotal = Math.round((quantity * Number(item.price) + addOnTotal) * 100) / 100;
    const orderTotal = Math.round((itemSubtotal + SERVICE_FEE) * 100) / 100;

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
      'Item Subtotal': itemSubtotal,
      'Service Fee': SERVICE_FEE,
      'Order Total': orderTotal,
      'Pick Up Date': pickupDate,
      'Notes': notes || undefined
    });

    // Baker notification: no channel is wired yet (email is stubbed). Log for now.
    console.log(`[order] request for ${baker.email} from ${req.customer.email}: ${item.name} x${quantity}, subtotal $${itemSubtotal}, service $${SERVICE_FEE}, total $${orderTotal}`);
    res.json({ ok: true, itemSubtotal, serviceFee: SERVICE_FEE, orderTotal });
  } catch (e) { next(e); }
});

// ── Customer account screens (spec 6.6 / 6.7 / 6.8) ─────────────────────────

async function loadCustomerOrders(email) {
  let recs;
  if (MODE === 'mock') {
    recs = mockOrders.filter(o => normEmail(o.fields['Customer Email']) === email);
  } else {
    recs = await airtable.list('Orders', {
      filterByFormula: `LOWER(TRIM({Customer Email})) = '${escapeFormula(email)}'`
    });
  }
  const orders = recs.map(publicData.customerOrderFromRecord);
  orders.sort((a, b) =>
    String(b.pickupDate || '').localeCompare(String(a.pickupDate || '')) ||
    String(b.orderRef || '').localeCompare(String(a.orderRef || '')));
  return orders;
}

async function loadCustomerOrder(email, orderId) {
  let rec;
  if (MODE === 'mock') {
    rec = mockOrders.find(o => o.id === orderId) || null;
  } else {
    rec = await airtable.findById('Orders', orderId);
  }
  if (!rec) return null;
  const o = publicData.customerOrderFromRecord(rec);
  if (o.customerEmail !== email) return null; // only the owner can view
  return o;
}

async function loadBakerLite(email) {
  if (!email) return null;
  if (MODE === 'mock') {
    return { id: mock.baker.id, businessName: mock.baker.businessName, photo: null, pickupAddress: mock.baker.pickupLocation || null };
  }
  const rec = await airtable.findOne('Baker Profiles', {
    filterByFormula: `LOWER(TRIM({Email})) = '${escapeFormula(email)}'`
  });
  if (!rec) return null;
  const pb = publicData.publicBakerFromRecord(rec);
  return { id: pb.id, businessName: pb.businessName, photo: pb.photo, pickupAddress: rec.fields['Exact Pick-up Address'] || null };
}

async function enrichOrdersWithBaker(orders) {
  const cache = new Map();
  for (const o of orders) {
    if (!cache.has(o.bakerEmail)) cache.set(o.bakerEmail, await loadBakerLite(o.bakerEmail));
    const b = cache.get(o.bakerEmail);
    o.bakerId = b ? b.id : null;
    o.bakerPhoto = b ? b.photo : null;
  }
  return orders;
}

function requireCustomerPage(req, res) {
  if (!req.customer) { res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl)); return false; }
  return true;
}

app.get('/customer/profile', async (req, res, next) => {
  try {
    if (!requireCustomerPage(req, res)) return;
    const rec = await customers.findByEmail(req.customer.email);
    if (!rec) return res.redirect('/login');
    const orders = await enrichOrdersWithBaker(await loadCustomerOrders(req.customer.email));
    res.type('html').send(customerSite.renderCustomerProfile({ customer: customerPublic(rec), orders }));
  } catch (e) { next(e); }
});

app.get('/customer/orders', async (req, res, next) => {
  try {
    if (!requireCustomerPage(req, res)) return;
    const orders = await enrichOrdersWithBaker(await loadCustomerOrders(req.customer.email));
    res.type('html').send(customerSite.renderPastOrders({ orders }));
  } catch (e) { next(e); }
});

app.get('/customer/orders/:orderId', async (req, res, next) => {
  try {
    if (!requireCustomerPage(req, res)) return;
    const order = await loadCustomerOrder(req.customer.email, req.params.orderId);
    if (!order) return res.status(404).type('html').send(publicSite.renderNotFound());
    const baker = await loadBakerLite(order.bakerEmail);
    res.type('html').send(customerSite.renderOrderStatus({ order, baker }));
  } catch (e) { next(e); }
});

app.patch('/api/customer/profile', requireCustomerAuth, async (req, res, next) => {
  try {
    const rec = await customers.findByEmail(req.customer.email);
    if (!rec) return res.status(404).json({ error: 'Account not found.' });
    const b = req.body || {};
    const fields = {};
    if (b.firstName !== undefined) fields['First Name'] = String(b.firstName).trim();
    if (b.lastName !== undefined) fields['Last Name'] = String(b.lastName).trim();
    if (b.city !== undefined) fields['City'] = String(b.city).trim();
    if (b.state !== undefined) fields['State'] = String(b.state).trim();
    if (b.zipCode !== undefined) fields['Zip Code'] = String(b.zipCode).trim();
    if (Array.isArray(b.occasionTags)) {
      const allowed = new Set(customerSite.OCCASION_CHOICES);
      fields['Occasion Tags'] = b.occasionTags.filter(t => allowed.has(t));
    }
    const updated = await customers.update(rec.id, fields);
    res.json({ ok: true, customer: customerPublic(updated) });
  } catch (e) { next(e); }
});

app.post('/api/customer/profile/photo', requireCustomerAuth, photoUpload.single('photo'), async (req, res, next) => {
  try {
    if (!cloudinary.isConfigured()) return res.status(503).json({ error: 'Photo uploads are not configured.' });
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded.' });
    const rec = await customers.findByEmail(req.customer.email);
    if (!rec) return res.status(404).json({ error: 'Account not found.' });
    const result = await cloudinary.uploadImage(req.file.buffer, { filename: req.file.originalname });
    await customers.update(rec.id, { 'Profile Photo URL': result.url });
    res.json({ ok: true, url: result.url });
  } catch (e) { next(e); }
});

// One-time customer rating of the baker after fulfilment. Storing the rating is
// done here; recalculating the baker's aggregate average is deferred to Batch E.
// ── Dual rating system (spec 7) ─────────────────────────────────────────────

async function fetchOrderById(orderId) {
  if (MODE === 'mock') {
    const r = mockOrders.find(o => o.id === orderId);
    return r ? publicData.customerOrderFromRecord(r) : null;
  }
  const rec = await airtable.findById('Orders', orderId);
  return rec ? publicData.customerOrderFromRecord(rec) : null;
}

async function updateOrderFields(orderId, fields) {
  if (MODE === 'mock') {
    const r = mockOrders.find(o => o.id === orderId);
    if (r) Object.assign(r.fields, fields);
    return;
  }
  await airtable.update('Orders', orderId, fields);
}

async function ratingOrders(filter) {
  let recs;
  if (MODE === 'mock') {
    recs = mockOrders.filter(o =>
      filter.baker ? normEmail(o.fields['Baker Email']) === filter.baker
                   : normEmail(o.fields['Customer Email']) === filter.customer);
  } else {
    const f = filter.baker
      ? `LOWER(TRIM({Baker Email})) = '${escapeFormula(filter.baker)}'`
      : `LOWER(TRIM({Customer Email})) = '${escapeFormula(filter.customer)}'`;
    recs = await airtable.list('Orders', { filterByFormula: f });
  }
  return recs.map(publicData.customerOrderFromRecord);
}

// Baker Rating = average of Customer Rating of Baker across the baker's Fulfilled
// rated orders; denormalized onto Baker Profiles (Baker Rating + Rating Count).
async function recomputeBakerRating(bakerEmail) {
  const orders = await ratingOrders({ baker: bakerEmail });
  const scores = orders
    .filter(o => o.status === 'Fulfilled' && o.customerRatingOfBaker != null)
    .map(o => o.customerRatingOfBaker);
  const avg = ratings.average(scores);
  const count = scores.length;
  if (MODE === 'mock') {
    if (normEmail(mock.baker.email) === bakerEmail) { mock.baker.rating = avg; mock.baker.ratingCount = count; }
    return { avg, count };
  }
  const rec = await airtable.findOne('Baker Profiles', {
    filterByFormula: `LOWER(TRIM({Email})) = '${escapeFormula(bakerEmail)}'`
  });
  if (rec) await airtable.update('Baker Profiles', rec.id, { 'Baker Rating': avg, 'Rating Count': count });
  return { avg, count };
}

// Customer Rating = average of Baker Rating of Customer across the customer's
// Fulfilled rated orders; denormalized onto Customers (Customer Rating + Rating Count).
async function recomputeCustomerRating(customerEmail) {
  const orders = await ratingOrders({ customer: customerEmail });
  const scores = orders
    .filter(o => o.status === 'Fulfilled' && o.bakerRatingOfCustomer != null)
    .map(o => o.bakerRatingOfCustomer);
  const avg = ratings.average(scores);
  const count = scores.length;
  const rec = await customers.findByEmail(customerEmail);
  if (rec) await customers.update(rec.id, { 'Customer Rating': avg, 'Rating Count': count });
  return { avg, count };
}

// Customer rates the baker: 1-5 stars + optional text review. One-time, 7-day window.
app.post('/api/orders/:orderId/rate', requireCustomerAuth, async (req, res, next) => {
  try {
    const order = await loadCustomerOrder(req.customer.email, req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.status !== 'Fulfilled') return res.status(400).json({ error: 'You can rate once the order is complete.' });
    if (!ratings.ratingWindowOpen(order.status, order.pickupDate)) {
      return res.status(400).json({ error: 'The rating window for this order has closed.' });
    }
    if (order.ratingLeftByCustomer) return res.status(409).json({ error: 'You already rated this order.' });
    const rating = parseInt(req.body && req.body.rating, 10);
    if (!ratings.validStars(rating)) return res.status(400).json({ error: 'Please choose 1 to 5 stars.' });
    const text = req.body && req.body.text ? String(req.body.text).trim().slice(0, 2000) : '';

    const fields = { 'Customer Rating of Baker': rating, 'Rating Left by Customer': true };
    if (text) fields['Customer Review Text'] = text;
    await updateOrderFields(order.id, fields);
    const agg = await recomputeBakerRating(order.bakerEmail);
    console.log(`[rating] customer ${req.customer.email} rated baker ${order.bakerEmail} ${rating}; baker avg now ${agg.avg} (${agg.count})`);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Baker rates the customer: 1-5 stars, no text. One-time, 7-day window. Private.
app.post('/api/baker/rate-customer', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const orderId = String(req.body && req.body.orderId || '');
    const order = await fetchOrderById(orderId);
    if (!order || order.bakerEmail !== baker.email) return res.status(404).json({ error: 'Order not found.' });
    if (order.status !== 'Fulfilled') return res.status(400).json({ error: 'You can rate once the order is complete.' });
    if (!ratings.ratingWindowOpen(order.status, order.pickupDate)) {
      return res.status(400).json({ error: 'The rating window for this order has closed.' });
    }
    if (order.ratingLeftByBaker) return res.status(409).json({ error: 'You already rated this customer.' });
    const rating = parseInt(req.body && req.body.rating, 10);
    if (!ratings.validStars(rating)) return res.status(400).json({ error: 'Please choose 1 to 5 stars.' });

    await updateOrderFields(order.id, { 'Baker Rating of Customer': rating, 'Rating Left by Baker': true });
    const agg = await recomputeCustomerRating(order.customerEmail);
    console.log(`[rating] baker ${baker.email} rated customer ${order.customerEmail} ${rating}; customer avg now ${agg.avg} (${agg.count})`);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Messaging (spec 6.5 + section 8): shared by customer + baker sides ───────

async function listMessages(filter) {
  if (MODE === 'mock') {
    return mockMessages.filter(r => {
      const f = r.fields;
      if (filter.thread && f['Thread ID'] !== filter.thread) return false;
      if (filter.baker && normEmail(f['Baker Email']) !== filter.baker) return false;
      if (filter.customer && normEmail(f['Customer Email']) !== filter.customer) return false;
      return true;
    }).map(messaging.msgFromRecord);
  }
  const clauses = [];
  if (filter.thread) clauses.push(`{Thread ID} = '${escapeFormula(filter.thread)}'`);
  if (filter.baker) clauses.push(`LOWER(TRIM({Baker Email})) = '${escapeFormula(filter.baker)}'`);
  if (filter.customer) clauses.push(`LOWER(TRIM({Customer Email})) = '${escapeFormula(filter.customer)}'`);
  if (!clauses.length) return [];
  const formula = clauses.length > 1 ? `AND(${clauses.join(', ')})` : clauses[0];
  const recs = await airtable.list('Messages', { filterByFormula: formula });
  return recs.map(messaging.msgFromRecord);
}

async function createMessage({ bakerEmail, customerEmail, sender, text, isCustomQuote, orderId }) {
  const fields = {
    'Thread ID': messaging.threadId(bakerEmail, customerEmail),
    'Baker Email': bakerEmail,
    'Customer Email': customerEmail,
    'Sender': sender,
    'Message Text': text,
    'Sent At': new Date().toISOString()
  };
  if (isCustomQuote) fields['Is Custom Quote'] = true;
  if (orderId) fields['Order ID'] = orderId;
  if (MODE === 'mock') {
    const id = 'msg-' + (mockMessages.length + 1);
    mockMessages.push({ id, fields });
    return messaging.msgFromRecord({ id, fields });
  }
  return messaging.msgFromRecord(await airtable.create('Messages', fields));
}

async function threadMessagesOwned(threadId, customerEmail) {
  const msgs = (await listMessages({ thread: threadId })).filter(m => m.customerEmail === customerEmail);
  msgs.sort(messaging.bySentAtAsc);
  return msgs;
}

async function customerThreads(customerEmail) {
  const grouped = messaging.groupByThread(await listMessages({ customer: customerEmail }));
  const cache = new Map();
  const out = [];
  for (const [tid, list] of grouped) {
    const bakerEmail = list[0].bakerEmail;
    if (!cache.has(bakerEmail)) cache.set(bakerEmail, await loadBakerLite(bakerEmail));
    const baker = cache.get(bakerEmail);
    const last = list[list.length - 1];
    out.push({
      threadId: tid, bakerEmail,
      bakerId: baker ? baker.id : null,
      bakerName: baker ? baker.businessName : bakerEmail,
      bakerPhoto: baker ? baker.photo : null,
      lastMessage: last.text, lastFrom: last.sender, lastMessageAt: last.sentAt,
      unread: last.sender === 'baker',
      isCustomQuote: list.some(m => m.isCustomQuote)
    });
  }
  out.sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')));
  return out;
}

// trailing customer messages since the baker's last reply (no read-state field)
function trailingUnread(list) {
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) { if (list[i].sender === 'customer') n++; else break; }
  return n;
}

async function bakerConversations(bakerEmail) {
  const grouped = messaging.groupByThread(await listMessages({ baker: bakerEmail }));
  const cache = new Map();
  const out = [];
  for (const [tid, list] of grouped) {
    const customerEmail = list[0].customerEmail;
    if (!cache.has(customerEmail)) cache.set(customerEmail, await customers.findByEmail(customerEmail));
    const cf = (cache.get(customerEmail) || {}).fields || {};
    const last = list[list.length - 1];
    const orderMsg = list.find(m => m.orderId);
    out.push({
      id: tid,
      customerName: [cf['First Name'], cf['Last Name']].filter(Boolean).join(' ').trim() || customerEmail,
      customerCity: cf['City'] || '',
      customerEmail,
      customerPhone: cf['Phone'] || '',
      relatedOrderId: orderMsg ? orderMsg.orderId : null,
      unread: trailingUnread(list),
      isCustomQuote: list.some(m => m.isCustomQuote),
      lastMessage: last.text, lastFrom: last.sender, lastMessageAt: last.sentAt
    });
  }
  out.sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')));
  return out;
}

async function bakerConversation(bakerEmail, threadId) {
  const list = (await listMessages({ thread: threadId })).filter(m => m.bakerEmail === bakerEmail).sort(messaging.bySentAtAsc);
  if (!list.length) return null;
  const customerEmail = list[0].customerEmail;
  const cf = ((await customers.findByEmail(customerEmail)) || {}).fields || {};
  const orderMsg = list.find(m => m.orderId);
  return {
    id: threadId,
    customerName: [cf['First Name'], cf['Last Name']].filter(Boolean).join(' ').trim() || customerEmail,
    customerCity: cf['City'] || '',
    customerEmail,
    customerPhone: cf['Phone'] || '',
    relatedOrderId: orderMsg ? orderMsg.orderId : null,
    unread: trailingUnread(list),
    isCustomQuote: list.some(m => m.isCustomQuote),
    messages: list.map(m => ({ id: m.id, from: m.sender, text: m.text, sentAt: m.sentAt }))
  };
}

function activeThreadFor(threadId, bakerLite, messages, isCustomQuote) {
  return {
    threadId,
    baker: { id: bakerLite.id, businessName: bakerLite.businessName, photo: bakerLite.photo, email: bakerLite.email },
    messages,
    isCustomQuote
  };
}

app.get('/customer/messages', async (req, res, next) => {
  try {
    if (!requireCustomerPage(req, res)) return;
    const email = req.customer.email;
    const threads = await customerThreads(email);
    let active = null;

    const wantThread = req.query.thread ? String(req.query.thread) : '';
    const wantBaker = req.query.baker ? String(req.query.baker) : '';
    const wantQuote = String(req.query.quote || '') === '1';

    if (wantBaker) {
      const baker = await loadPublicBakerById(wantBaker);
      if (baker) {
        const tid = messaging.threadId(baker.email, email);
        const msgs = await threadMessagesOwned(tid, email);
        active = activeThreadFor(tid, { id: baker.id, businessName: baker.businessName, photo: baker.photo, email: baker.email }, msgs, wantQuote || msgs.some(m => m.isCustomQuote));
      }
    } else if (wantThread) {
      const t = threads.find(x => x.threadId === wantThread);
      if (t) {
        const msgs = await threadMessagesOwned(t.threadId, email);
        active = activeThreadFor(t.threadId, { id: t.bakerId, businessName: t.bakerName, photo: t.bakerPhoto, email: t.bakerEmail }, msgs, t.isCustomQuote);
      }
    } else if (threads.length) {
      const t = threads[0];
      const msgs = await threadMessagesOwned(t.threadId, email);
      active = activeThreadFor(t.threadId, { id: t.bakerId, businessName: t.bakerName, photo: t.bakerPhoto, email: t.bakerEmail }, msgs, t.isCustomQuote);
    }

    const rec = await customers.findByEmail(email);
    res.type('html').send(customerSite.renderCustomerMessages({ threads, active, customer: customerPublic(rec) }));
  } catch (e) { next(e); }
});

app.get('/api/customer/messages/:threadId', requireCustomerAuth, async (req, res, next) => {
  try {
    const msgs = await threadMessagesOwned(req.params.threadId, req.customer.email);
    res.json({
      messages: msgs.map(m => ({ sender: m.sender, text: m.text, sentAt: m.sentAt })),
      isCustomQuote: msgs.some(m => m.isCustomQuote)
    });
  } catch (e) { next(e); }
});

app.post('/api/customer/messages', requireCustomerAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const text = String(b.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });

    let bakerEmail = b.bakerEmail ? normEmail(b.bakerEmail) : '';
    if (!bakerEmail && b.bakerId) {
      const baker = await loadPublicBakerById(String(b.bakerId));
      if (baker) bakerEmail = baker.email;
    }
    if (!bakerEmail && b.threadId) {
      const existing = await listMessages({ thread: String(b.threadId) });
      const owned = existing.find(m => m.customerEmail === req.customer.email);
      if (owned) bakerEmail = owned.bakerEmail;
    }
    if (!bakerEmail) return res.status(400).json({ error: 'Could not determine the baker for this message.' });

    const msg = await createMessage({
      bakerEmail, customerEmail: req.customer.email, sender: 'customer', text,
      isCustomQuote: b.isCustomQuote === true,
      orderId: b.orderId ? String(b.orderId) : null
    });
    // Email notification (debounced 1/30min per thread) is deferred: no email
    // channel is wired yet. The in-app unread indicator covers this for now.
    res.json({ ok: true, message: msg });
  } catch (e) { next(e); }
});

// Unread badge counts (threads where the other party sent last).
app.get('/api/baker/unread-count', requireAuth, async (req, res, next) => {
  try {
    const baker = await currentBaker(req);
    const convs = await bakerConversations(baker.email);
    res.json({ count: convs.filter(c => c.unread > 0).length });
  } catch (e) { next(e); }
});

app.get('/api/customer/unread-count', requireCustomerAuth, async (req, res, next) => {
  try {
    const threads = await customerThreads(req.customer.email);
    res.json({ count: threads.filter(t => t.unread).length });
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
