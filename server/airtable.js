const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

class AirtableError extends Error {
  constructor(status, body) {
    super(`Airtable ${status}: ${body}`);
    this.status = status;
  }
}

class AirtableClient {
  constructor({ apiKey, baseId }) {
    this.apiKey = apiKey;
    this.baseId = baseId;
  }

  url(table, recordId) {
    const t = encodeURIComponent(table);
    return recordId
      ? `${AIRTABLE_API_BASE}/${this.baseId}/${t}/${recordId}`
      : `${AIRTABLE_API_BASE}/${this.baseId}/${t}`;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async list(table, { filterByFormula, maxRecords, sort } = {}) {
    const params = new URLSearchParams();
    if (filterByFormula) params.set('filterByFormula', filterByFormula);
    if (maxRecords) params.set('maxRecords', String(maxRecords));
    if (sort) {
      sort.forEach((s, i) => {
        params.set(`sort[${i}][field]`, s.field);
        if (s.direction) params.set(`sort[${i}][direction]`, s.direction);
      });
    }
    const url = `${this.url(table)}?${params.toString()}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new AirtableError(res.status, await res.text());
    const json = await res.json();
    return json.records;
  }

  async findOne(table, options) {
    const records = await this.list(table, { ...options, maxRecords: 1 });
    return records[0] || null;
  }

  async findById(table, id) {
    const res = await fetch(this.url(table, id), { headers: this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new AirtableError(res.status, await res.text());
    return res.json();
  }

  async update(table, recordId, fields) {
    const res = await fetch(this.url(table, recordId), {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ fields })
    });
    if (!res.ok) throw new AirtableError(res.status, await res.text());
    return res.json();
  }

  async create(table, fields) {
    const res = await fetch(this.url(table), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ fields })
    });
    if (!res.ok) throw new AirtableError(res.status, await res.text());
    return res.json();
  }

  async delete(table, recordId) {
    const res = await fetch(this.url(table, recordId), {
      method: 'DELETE',
      headers: this.headers()
    });
    if (!res.ok) throw new AirtableError(res.status, await res.text());
    return res.json();
  }
}

function normEmail(s) {
  return String(s || '').trim().toLowerCase();
}

function escapeFormula(s) {
  return String(s).replace(/'/g, "\\'");
}

function parseFeeRate(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return raw > 1 ? raw / 100 : raw;
  const n = parseFloat(String(raw).replace('%', '').trim());
  if (Number.isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

function statusFromAirtable(raw) {
  const lc = String(raw || '').toLowerCase().trim();
  if (lc === 'in progress' || lc === 'inprogress') return 'in_progress';
  if (lc === 'completed' || lc === 'complete') return 'complete';
  if (lc === 'declined') return 'declined';
  if (lc === 'ready') return 'ready';
  return 'new';
}

function paymentStatusFromAirtable(raw) {
  const lc = String(raw || '').toLowerCase().trim();
  if (lc === 'paid' || lc === 'confirmed') return 'paid';
  return 'pending';
}

const FAQ_FIELDS = {
  specialties:        'FAQ Specialties',
  locationPickup:     'FAQ Location & Pickup',
  delivery:           'FAQ Delivery',
  leadTime:           'FAQ Lead Time',
  minimumOrder:       'FAQ Minimum Order',
  customOrders:       'FAQ Custom Orders',
  busySeasons:        'FAQ Busy Seasons',
  glutenFree:         'FAQ Gluten Free',
  otherDietary:       'FAQ Other Dietary',
  allergens:          'FAQ Allergens',
  paymentTiming:      'FAQ Payment Timing',
  paymentMethods:     'FAQ Payment Methods',
  cancellationPolicy: 'FAQ Cancellation Policy',
  soldOut:            'FAQ Sold Out',
  samples:            'FAQ Samples',
  tastings:           'FAQ Tastings',
  contactResponse:    'FAQ Contact & Response',
  anythingElse:       'FAQ Anything Else'
};

function faqFromRecord(f) {
  const out = {};
  for (const [key, col] of Object.entries(FAQ_FIELDS)) {
    out[key] = f[col] || null;
  }
  return out;
}

function bakerFromRecord(rec) {
  const f = rec.fields || {};
  const contact = f['Contact Name'] || '';
  return {
    id: rec.id,
    email: normEmail(f['Email']),
    contactName: contact || null,
    firstName: contact.split(' ')[0] || 'Baker',
    businessName: f['Business Name'] || null,
    avatarLetter: (contact[0] || (f['Business Name'] || '?')[0] || '?').toUpperCase(),
    phone: f['Phone'] || null,
    city: f['City'] || null,
    tier: f['Tier'] || null,
    feeRate: parseFeeRate(f['Fee Rate']),
    pickupLocation: f['Exact Pick-up Address'] || null,
    profileStatus: f['Profile Status'] || null,
    badge: f['Badge'] || null,
    bio: f['Bio'] || null,
    productTypes: f['Product Types'] || null,
    specialtyTags: f['Specialty Tags'] || null,
    acceptingOrders: f['Accepting Orders'] !== false,
    faq: faqFromRecord(f)
  };
}

function slotFromRecord(rec) {
  const f = rec.fields || {};
  const available = typeof f['Slots Available'] === 'number'
    ? f['Slots Available']
    : parseInt(f['Slots Available'], 10) || 0;
  const filled = typeof f['Slots Filled'] === 'number'
    ? f['Slots Filled']
    : parseInt(f['Slots Filled'], 10) || 0;
  return {
    id: rec.id,
    date: f['Pickup Date'] || null,
    slotsAvailable: available,
    slotsFilled: filled
  };
}

function menuItemFromRecord(rec) {
  const f = rec.fields || {};
  const cost = f['Recipe Cost'];
  return {
    id: rec.id,
    name: f['Item Name'] || '',
    emoji: f['Emoji'] || '🧁',
    price: typeof f['Price'] === 'number' ? f['Price'] : parseFloat(f['Price']) || 0,
    recipeCost: (cost == null || cost === '') ? null : (typeof cost === 'number' ? cost : parseFloat(cost) || null),
    category: f['Category'] || 'Other',
    available: f['Available'] !== false
  };
}

function orderFromRecord(rec) {
  const f = rec.fields || {};
  return {
    id: rec.id,
    customerName: f['Customer Name'] || 'Customer',
    customerEmail: f['Customer Email'] || null,
    customerPhone: f['Customer Phone'] || null,
    customerCity: f['Customer City'] || null,
    item: f['Item'] || '',
    notes: f['Notes'] || null,
    specialInstructions: f['Special Instructions'] || null,
    allergens: f['Allergens'] || null,
    pickupDate: f['Pickup Date'] || null,
    requestedDate: f['Requested Date'] || null,
    completedDate: f['Completed Date'] || null,
    readyAt: f['Ready At'] || null,
    paymentStatus: paymentStatusFromAirtable(f['Payment Status']),
    amount: typeof f['Amount'] === 'number' ? f['Amount'] : parseFloat(f['Amount']) || 0,
    status: statusFromAirtable(f['Status']),
    review: f['Review'] || null,
    reviewRating: typeof f['Review Rating'] === 'number' ? f['Review Rating'] : null,
    reviewRequestedAt: f['Review Requested At'] || null
  };
}

module.exports = {
  AirtableClient,
  AirtableError,
  normEmail,
  escapeFormula,
  parseFeeRate,
  statusFromAirtable,
  paymentStatusFromAirtable,
  bakerFromRecord,
  orderFromRecord,
  slotFromRecord,
  menuItemFromRecord,
  FAQ_FIELDS
};
