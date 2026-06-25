const { normEmail, MENU_PHOTO_FIELDS } = require('./airtable');

// Multi-selects come back as arrays from Airtable, but the mock baker stores
// them as comma-separated strings. Normalize both to a clean array.
function toList(v) {
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function firstAttachmentUrl(field) {
  if (Array.isArray(field) && field[0] && field[0].url) return field[0].url;
  return null;
}

function publicBakerFromRecord(rec) {
  const f = rec.fields || {};
  return {
    id: rec.id,
    email: normEmail(f['Email']),
    businessName: f['Business Name'] || 'Baker',
    contactName: f['Contact Name'] || null,
    city: f['City'] || null,
    neighborhood: f['Neighborhood'] || null,
    bio: f['Bio'] || null,
    productTypes: toList(f['Product Types']),
    specialtyTags: toList(f['Specialty Tags']),
    defaultPickupDays: toList(f['Default Pickup Days']),
    instagram: f['Instagram Handle'] || null,
    pickupWindows: f['Pick-up Windows'] || null,
    rating: typeof f['Baker Rating'] === 'number' ? f['Baker Rating'] : null,
    ratingCount: typeof f['Rating Count'] === 'number' ? f['Rating Count'] : 0,
    verified: f['Verified'] === true,
    foundingBaker: f['Badge'] === 'Founding Baker',
    acceptingOrders: f['Accepting Orders'] === true,
    photo: firstAttachmentUrl(f['Profile Photo']),
    gallery: [f['Gallery Image 1'], f['Gallery Image 2'], f['Gallery Image 3']]
      .map(firstAttachmentUrl)
      .filter(Boolean)
  };
}

function publicBakerFromMock(b) {
  return {
    id: b.id,
    email: normEmail(b.email),
    businessName: b.businessName || 'Baker',
    contactName: b.contactName || null,
    city: b.city || null,
    neighborhood: b.neighborhood || null,
    bio: b.bio || null,
    productTypes: toList(b.productTypes),
    specialtyTags: toList(b.specialtyTags),
    instagram: b.instagram || null,
    pickupWindows: b.pickupLocation || null,
    rating: typeof b.rating === 'number' ? b.rating : null,
    ratingCount: typeof b.ratingCount === 'number' ? b.ratingCount : 0,
    verified: true,
    foundingBaker: b.tier === 'Charter' || b.badge === 'Verified',
    acceptingOrders: b.acceptingOrders !== false,
    photo: null,
    gallery: []
  };
}

function publicMenuItemFromRecord(rec) {
  const f = rec.fields || {};
  const photos = MENU_PHOTO_FIELDS.map(k => f[k]).filter(Boolean); // Cover + Portfolio 1-6, in order
  return {
    id: rec.id,
    name: f['Item Name'] || '',
    description: f['Description'] || null,
    price: typeof f['Price'] === 'number' ? f['Price'] : (parseFloat(f['Price']) || 0),
    category: f['Category'] || null,
    coverPhoto: f['Cover Photo URL'] || null,
    photos,
    emoji: null,
    // Sold Per is a single-select ("Dozen" / "Half dozen" / "Individual"); surface
    // it lowercased as the unit word. Add-ons aren't on live Menu Items yet.
    soldPer: (f['Sold Per'] || '').toLowerCase() || null,
    minimumQuantity: numOrNull(f['Minimum Quantity']),
    addOns: []
  };
}

function normalizeAddOn(a) {
  return {
    name: a.name,
    price: Number(a.price) || 0,
    unit: a.priceUnit === 'per_cookie' ? 'per_cookie' : 'per_set'
  };
}

function publicMenuItemFromMock(m) {
  const detail = (m.typeFields && (m.typeFields.flavors || m.typeFields.finish)) || null;
  const soldBy = m.soldBy ? m.soldBy.charAt(0).toUpperCase() + m.soldBy.slice(1) : null;
  const description = [soldBy, detail].filter(Boolean).join(' · ') || null;
  return {
    id: m.id,
    name: m.name || '',
    description,
    price: typeof m.price === 'number' ? m.price : (parseFloat(m.price) || 0),
    category: m.category || null,
    coverPhoto: (Array.isArray(m.photos) && m.photos[0]) || null,
    photos: Array.isArray(m.photos) ? m.photos.filter(Boolean) : [],
    emoji: m.emoji || null,
    soldPer: m.soldBy || null,
    minimumQuantity: numOrNull(m.minimumQuantity),
    addOns: Array.isArray(m.addOns) ? m.addOns.map(normalizeAddOn) : []
  };
}

function publicReviewFromRecord(rec) {
  const f = rec.fields || {};
  return {
    reviewerName: f['Reviewer Name'] || 'Customer',
    rating: Number(f['Star Rating']) || 0,
    text: f['Review Text'] || '',
    date: f['Review Date'] || null
  };
}

function numOrNull(v) {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function customerOrderFromRecord(rec) {
  const f = rec.fields || {};
  let addOns = [];
  try { const p = JSON.parse(f['Add-ons Selected'] || '[]'); if (Array.isArray(p)) addOns = p; } catch (_) {}
  return {
    id: rec.id,
    orderRef: f['Order ID'] || rec.id,
    bakerName: f['Baker Name'] || 'Baker',
    bakerEmail: normEmail(f['Baker Email']),
    customerEmail: normEmail(f['Customer Email']),
    customerName: f['Customer Name'] || null,
    menuItem: f['Menu Item'] || '',
    addOns,
    itemSubtotal: numOrNull(f['Item Subtotal']),
    serviceFee: numOrNull(f['Service Fee']),
    orderTotal: numOrNull(f['Order Total']),
    pickupDate: f['Pick Up Date'] || null,
    status: f['Order Status'] || 'New',
    notes: f['Notes'] || null,
    ratingLeftByCustomer: f['Rating Left by Customer'] === true,
    customerRatingOfBaker: numOrNull(f['Customer Rating of Baker']),
    customerReviewText: f['Customer Review Text'] || null,
    ratingLeftByBaker: f['Rating Left by Baker'] === true,
    bakerRatingOfCustomer: numOrNull(f['Baker Rating of Customer'])
  };
}

module.exports = {
  toList,
  firstAttachmentUrl,
  numOrNull,
  publicBakerFromRecord,
  publicBakerFromMock,
  publicMenuItemFromRecord,
  publicMenuItemFromMock,
  publicReviewFromRecord,
  customerOrderFromRecord
};
