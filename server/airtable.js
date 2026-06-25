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

  // Field-name set for a table, via the Meta API (cached ~5 min so newly-added
  // Airtable fields are picked up without a server restart). Returns null when
  // the schema can't be read, so callers can choose to pass payloads through.
  async tableFieldNames(table) {
    const now = (this._schemaAt && this._schemaTime) ? Date.now() - this._schemaTime : Infinity;
    if (this._schemaAt && now < 5 * 60 * 1000) return this._schemaAt[table] || null;
    try {
      const res = await fetch(`${AIRTABLE_API_BASE}/meta/bases/${this.baseId}/tables`, { headers: this.headers() });
      if (!res.ok) return this._schemaAt ? (this._schemaAt[table] || null) : null;
      const json = await res.json();
      const map = {};
      for (const t of json.tables || []) map[t.name] = new Set((t.fields || []).map(f => f.name));
      this._schemaAt = map;
      this._schemaTime = Date.now();
      return map[table] || null;
    } catch (_) {
      return this._schemaAt ? (this._schemaAt[table] || null) : null;
    }
  }

  // True/false/null(unknown) for whether a single field exists on a table.
  async hasField(table, field) {
    const set = await this.tableFieldNames(table);
    if (!set) return null;
    return set.has(field);
  }

  // Drop keys that aren't real columns so create/update never 422s on a field
  // the user hasn't added yet. If the schema can't be read, pass through.
  async knownFields(table, fields) {
    const set = await this.tableFieldNames(table);
    if (!set) return { ...fields };
    const out = {};
    for (const k of Object.keys(fields)) if (set.has(k)) out[k] = fields[k];
    return out;
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
  // Live "Order Status" vocabulary is the single source of truth:
  // Pending / New / Confirmed / Fulfilled / Cancelled / Disputed.
  const lc = String(raw || '').toLowerCase().trim();
  if (lc === 'confirmed') return 'in_progress';
  if (lc === 'fulfilled') return 'complete';
  if (lc === 'cancelled' || lc === 'canceled') return 'declined';
  if (lc === 'disputed') return 'disputed';
  return 'new'; // Pending / New / blank
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
    photo: (Array.isArray(f['Profile Photo']) && f['Profile Photo'][0] && f['Profile Photo'][0].url) || null,
    phone: f['Phone'] || null,
    city: f['City'] || null,
    tier: f['Tier'] || null,
    feeRate: parseFeeRate(f['Fee Rate']),
    pickupLocation: f['Exact Pick-up Address'] || null,
    pickupWindows: f['Pick-up Windows'] || null,
    profileStatus: f['Profile Status'] || null,
    badge: f['Badge'] || null,
    bio: f['Bio'] || null,
    productTypes: f['Product Types'] || null,
    specialtyTags: f['Specialty Tags'] || null,
    acceptingOrders: f['Accepting Orders'] === true,
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
    date: f['Available Date'] || null,
    slotsAvailable: available,
    slotsFilled: filled
  };
}

// Live "Product Type" / "Sold Per" single-select option names <-> baker-app ids.
const PRODUCT_TYPE_TO_ID = {
  'Decorated Sugar Cookies': 'sugarCookies',
  'Cakes': 'cakes',
  'Cupcakes': 'cupcakes',
  'Macarons': 'macarons',
  'Drop Cookies / Bars / Brownies': 'dropCookies',
  'Cinnamon Rolls': 'cinnamonRolls',
  'Pies': 'pies',
  'Breads': 'breads'
};
const SOLD_PER_TO_ID = {
  'Dozen': 'dozen',
  'Half dozen': 'halfDozen',
  'Individual': 'individual'
};
const PRODUCT_TYPE_EMOJI = {
  sugarCookies: '🍪', cakes: '🎂', cupcakes: '🧁', macarons: '🌸', dropCookies: '🍫'
};
// Photo URL columns on Menu Items: Cover (photo 1) + Portfolio 1-6 (photos 2-7). Max 7.
const MENU_PHOTO_FIELDS = [
  'Cover Photo URL',
  'Portfolio Photo URL 1', 'Portfolio Photo URL 2', 'Portfolio Photo URL 3',
  'Portfolio Photo URL 4', 'Portfolio Photo URL 5', 'Portfolio Photo URL 6'
];

function menuItemFromRecord(rec) {
  const f = rec.fields || {};
  const cost = f['Recipe Cost']; // not on live Menu Items -> null (tolerated)
  const productType = PRODUCT_TYPE_TO_ID[f['Product Type']] || null;
  const photos = MENU_PHOTO_FIELDS.map(k => f[k]).filter(Boolean);
  return {
    id: rec.id,
    name: f['Item Name'] || '',
    emoji: PRODUCT_TYPE_EMOJI[productType] || '🧁',
    price: typeof f['Price'] === 'number' ? f['Price'] : parseFloat(f['Price']) || 0,
    productType,
    soldBy: SOLD_PER_TO_ID[f['Sold Per']] || null,
    photos,
    coverPhoto: photos[0] || null,
    recipeCost: (cost == null || cost === '') ? null : (typeof cost === 'number' ? cost : parseFloat(cost) || null),
    category: f['Category'] || 'Other',
    available: f['Available'] !== false,
    minimumQuantity: minOrNull(f['Minimum Quantity'])
  };
}

// Minimum Quantity is a number field; treat blank/0/negative as "no minimum".
function minOrNull(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function orderFromRecord(rec) {
  const f = rec.fields || {};
  return {
    id: rec.id,
    customerName: f['Customer Name'] || 'Customer',
    customerEmail: f['Customer Email'] || null,
    customerPhone: f['Customer Phone'] || null,
    customerCity: f['Customer City'] || null,           // not on live Orders -> null (tolerated)
    item: f['Menu Item'] || '',                         // live field name
    notes: f['Notes'] || null,
    specialInstructions: f['Special Instructions'] || null, // not on live -> null (tolerated)
    allergens: f['Allergens'] || null,                  // not on live -> null (tolerated)
    pickupDate: f['Pick Up Date'] || null,              // live field name
    requestedDate: f['Requested Date'] || null,         // not on live -> null (tolerated)
    completedDate: f['Completed Date'] || null,         // not on live -> null (tolerated)
    readyAt: f['Ready At'] || null,                     // not on live -> null (tolerated)
    paymentStatus: f['Paid'] === true ? 'paid' : 'pending', // live "Paid" checkbox
    amount: typeof f['Order Total'] === 'number' ? f['Order Total'] : parseFloat(f['Order Total']) || 0, // live field name
    status: statusFromAirtable(f['Order Status']),      // live field name
    review: f['Review'] || null,                        // not on live -> null (tolerated)
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
  MENU_PHOTO_FIELDS,
  FAQ_FIELDS
};
