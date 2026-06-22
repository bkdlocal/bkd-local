const crypto = require('crypto');

const KEYLEN = 64;

// Format: scrypt$<saltHex>$<hashHex>
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const derived = crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(derived, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

module.exports = { hashPassword, verifyPassword, generateToken };
