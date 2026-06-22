const { normEmail } = require('./airtable');

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
    instagram: f['Instagram Handle'] || null,
    pickupWindows: f['Pick-up Windows'] || null,
    rating: typeof f['Baker Rating'] === 'number' ? f['Baker Rating'] : null,
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
    rating: typeof b.rating === 'number' ? b.rating : 4.9,
    verified: true,
    foundingBaker: b.tier === 'Charter' || b.badge === 'Verified',
    acceptingOrders: b.acceptingOrders !== false,
    photo: null,
    gallery: []
  };
}

function publicMenuItemFromRecord(rec) {
  const f = rec.fields || {};
  return {
    id: rec.id,
    name: f['Item Name'] || '',
    description: f['Description'] || null,
    price: typeof f['Price'] === 'number' ? f['Price'] : (parseFloat(f['Price']) || 0),
    category: f['Category'] || null,
    coverPhoto: f['Cover Photo URL'] || null,
    emoji: null,
    // Live Menu Items has no sold-per or add-ons columns yet (graceful degradation).
    soldPer: null,
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
    coverPhoto: null,
    emoji: m.emoji || null,
    soldPer: m.soldBy || null,
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

module.exports = {
  toList,
  firstAttachmentUrl,
  publicBakerFromRecord,
  publicBakerFromMock,
  publicMenuItemFromRecord,
  publicMenuItemFromMock,
  publicReviewFromRecord
};
