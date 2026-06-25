// Hourly reminder scheduler (foreground, on the Railway server) via node-cron.
// Each hour it scans Confirmed orders and sends:
//   - 24h before pickup: baker reminder + customer reminder
//   - morning of pickup (>= 8am Central): customer "today" reminder
// Dedup uses boolean fields on Orders; if a field does not exist in Airtable
// yet, that reminder is skipped (with a logged note) so we never duplicate-send.

const cron = require('node-cron');
const email = require('./email');
const { buildPickupIcs } = require('./ics');
const { normEmail, escapeFormula } = require('./airtable');

const FIELD_BAKER = 'Reminder Sent Baker';
const FIELD_CUST_24H = 'Reminder Sent Customer 24h';
const FIELD_CUST_DAYOF = 'Reminder Sent Customer Day Of';

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || 'there';
}

// Calendar date + hour in America/Chicago (West TN launch region), so "tomorrow"
// and the 8am day-of gate line up with the baker's local day.
function centralNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false
  }).formatToParts(new Date());
  const o = {};
  parts.forEach(p => { o[p.type] = p.value; });
  const hour = o.hour === '24' ? 0 : Number(o.hour);
  return { date: `${o.year}-${o.month}-${o.day}`, hour };
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const nd = new Date(Date.UTC(y, m - 1, d + n));
  const p = x => String(x).padStart(2, '0');
  return `${nd.getUTCFullYear()}-${p(nd.getUTCMonth() + 1)}-${p(nd.getUTCDate())}`;
}

async function loadBakerProfile(airtable, cache, bakerEmail) {
  const key = normEmail(bakerEmail);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  let rec = null;
  try {
    rec = await airtable.findOne('Baker Profiles', {
      filterByFormula: `LOWER(TRIM({Email})) = '${escapeFormula(key)}'`
    });
  } catch (_) { rec = null; }
  cache.set(key, rec);
  return rec;
}

async function runTick(airtable) {
  if (!airtable) return;
  const [hasBaker, hasCust24h, hasDayOf] = await Promise.all([
    airtable.hasField('Orders', FIELD_BAKER),
    airtable.hasField('Orders', FIELD_CUST_24H),
    airtable.hasField('Orders', FIELD_CUST_DAYOF)
  ]);
  if (hasBaker === false || hasCust24h === false || hasDayOf === false) {
    const missing = [
      hasBaker === false ? FIELD_BAKER : null,
      hasCust24h === false ? FIELD_CUST_24H : null,
      hasDayOf === false ? FIELD_CUST_DAYOF : null
    ].filter(Boolean);
    console.warn(`[reminders] Skipping reminders that lack a dedup field. Add these boolean fields to the Orders table to enable them: ${missing.join(', ')}`);
  }

  const { date: today, hour } = centralNow();
  const tomorrow = addDays(today, 1);

  let orders = [];
  try {
    orders = await airtable.list('Orders', { filterByFormula: "{Order Status} = 'Confirmed'" });
  } catch (e) {
    console.error('[reminders] could not load Confirmed orders:', e.message);
    return;
  }

  const bakerCache = new Map();
  for (const rec of orders) {
    const f = rec.fields || {};
    const pickup = String(f['Pick Up Date'] || '').slice(0, 10);
    if (!pickup) continue;
    const isTomorrow = pickup === tomorrow;
    const isToday = pickup === today;
    if (!isTomorrow && !isToday) continue;

    const itemName = f['Menu Item'] || 'your order';
    const customerName = f['Customer Name'] || 'there';
    const customerEmail = normEmail(f['Customer Email']);
    const bakerEmail = normEmail(f['Baker Email']);
    const bakerRec = await loadBakerProfile(airtable, bakerCache, bakerEmail);
    const bf = (bakerRec && bakerRec.fields) || {};
    const bakerName = f['Baker Name'] || bf['Business Name'] || 'your baker';
    const bakerFirst = firstName(bf['Contact Name']);
    const pickupAddress = bf['Exact Pick-up Address'] || '';
    const pickupTime = bf['Pick-up Windows'] || '';
    const orderUrl = `${email.publicBase()}/customer/orders/${rec.id}`;

    try {
      if (isTomorrow && hasBaker && !f[FIELD_BAKER] && bakerEmail) {
        await email.sendBakerReminder({
          to: bakerEmail, bakerFirstName: bakerFirst, customerFirstName: firstName(customerName),
          itemName, quantity: null, pickupDate: pickup, pickupTime
        });
        await airtable.update('Orders', rec.id, { [FIELD_BAKER]: true });
      }
      if (isTomorrow && hasCust24h && !f[FIELD_CUST_24H] && customerEmail) {
        await email.sendCustomerReminder24h({
          to: customerEmail, customerFirstName: firstName(customerName), bakerName,
          itemName, quantity: null, pickupDate: pickup, pickupTime, pickupAddress, orderUrl
        });
        await airtable.update('Orders', rec.id, { [FIELD_CUST_24H]: true });
      }
      if (isToday && hour >= 8 && hasDayOf && !f[FIELD_CUST_DAYOF] && customerEmail) {
        await email.sendCustomerReminderDayOf({
          to: customerEmail, customerFirstName: firstName(customerName), bakerName,
          itemName, quantity: null, pickupDate: pickup, pickupTime, pickupAddress, orderUrl
        });
        await airtable.update('Orders', rec.id, { [FIELD_CUST_DAYOF]: true });
      }
    } catch (e) {
      console.error(`[reminders] failed for order ${rec.id}:`, e.message);
    }
  }
}

function start({ airtable }) {
  if (!airtable) {
    console.log('[reminders] no Airtable client; scheduler not started (mock mode).');
    return;
  }
  // Top of every hour. node-cron default timezone is the server's; the date/hour
  // math above is done explicitly in America/Chicago regardless.
  cron.schedule('0 * * * *', () => {
    runTick(airtable).catch(e => console.error('[reminders] tick error:', e.message));
  });
  console.log('[reminders] hourly reminder scheduler started.');
}

module.exports = { start, runTick };
