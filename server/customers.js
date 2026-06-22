const crypto = require('crypto');
const { normEmail, escapeFormula } = require('./airtable');

const TABLE = 'Customers';

// Public-safe view: never exposes Password Hash or Verification Token.
function customerPublic(rec) {
  const f = (rec && rec.fields) || {};
  return {
    id: rec.id,
    firstName: f['First Name'] || null,
    lastName: f['Last Name'] || null,
    email: normEmail(f['Email']),
    phone: f['Phone'] || null,
    city: f['City'] || null,
    state: f['State'] || null,
    zipCode: f['Zip Code'] || null,
    profilePhotoUrl: f['Profile Photo URL'] || null,
    occasionTags: f['Occasion Tags'] || [],
    phoneVerified: f['Phone Verified'] === true,
    emailVerified: f['Email Verified'] === true,
    customerRating: typeof f['Customer Rating'] === 'number' ? f['Customer Rating'] : null,
    ratingCount: typeof f['Rating Count'] === 'number' ? f['Rating Count'] : 0,
    accountCreated: f['Account Created'] || null
  };
}

// Backed by Airtable when a client is supplied; otherwise an in-memory store
// so customer auth works end-to-end in mock mode (parity with the rest of the app).
class CustomerStore {
  constructor(airtable) {
    this.airtable = airtable || null;
    this.mem = this.airtable ? null : [];
  }

  async findByEmail(email) {
    const e = normEmail(email);
    if (!e) return null;
    if (this.airtable) {
      return this.airtable.findOne(TABLE, {
        filterByFormula: `LOWER(TRIM({Email})) = '${escapeFormula(e)}'`
      });
    }
    return this.mem.find(r => normEmail(r.fields['Email']) === e) || null;
  }

  async findByToken(token) {
    const t = String(token || '');
    if (!t) return null;
    if (this.airtable) {
      return this.airtable.findOne(TABLE, {
        filterByFormula: `{Verification Token} = '${escapeFormula(t)}'`
      });
    }
    return this.mem.find(r => r.fields['Verification Token'] === t) || null;
  }

  async create(fields) {
    if (this.airtable) return this.airtable.create(TABLE, fields);
    const rec = { id: `cust_${crypto.randomBytes(8).toString('hex')}`, fields: { ...fields } };
    this.mem.push(rec);
    return rec;
  }

  async update(id, fields) {
    if (this.airtable) return this.airtable.update(TABLE, id, fields);
    const rec = this.mem.find(r => r.id === id);
    if (!rec) return null;
    rec.fields = { ...rec.fields, ...fields };
    return rec;
  }
}

module.exports = { CustomerStore, customerPublic };
