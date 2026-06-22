const crypto = require('crypto');
const { normEmail } = require('./airtable');

// One thread per baker-customer pair. Roles are fixed (baker, customer), so the
// hash is stable regardless of who sends first.
function threadId(bakerEmail, customerEmail) {
  const b = normEmail(bakerEmail);
  const c = normEmail(customerEmail);
  return crypto.createHash('sha1').update(`${b}|${c}`).digest('hex').slice(0, 32);
}

function msgFromRecord(rec) {
  const f = rec.fields || {};
  return {
    id: rec.id,
    threadId: f['Thread ID'] || '',
    bakerEmail: normEmail(f['Baker Email']),
    customerEmail: normEmail(f['Customer Email']),
    sender: f['Sender'] === 'baker' ? 'baker' : 'customer',
    text: f['Message Text'] || '',
    sentAt: f['Sent At'] || null,
    isCustomQuote: f['Is Custom Quote'] === true,
    orderId: f['Order ID'] || null
  };
}

function bySentAtAsc(a, b) { return String(a.sentAt || '').localeCompare(String(b.sentAt || '')); }

function groupByThread(messages) {
  const map = new Map();
  for (const m of messages) {
    if (!map.has(m.threadId)) map.set(m.threadId, []);
    map.get(m.threadId).push(m);
  }
  for (const list of map.values()) list.sort(bySentAtAsc);
  return map;
}

module.exports = { threadId, msgFromRecord, bySentAtAsc, groupByThread };
