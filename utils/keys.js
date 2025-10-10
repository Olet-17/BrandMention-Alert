// utils/keys.js
const crypto = require('crypto');

function randomKey(bytes = 24) {
  // bm_ + url-safe base64 (~32 chars) => readable + high entropy
  const raw = crypto.randomBytes(bytes).toString('base64url');
  const key = `bm_${raw}`;
  return key;
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex'); // 64 hex chars
}

// Optional: constant-time compare (if you ever need to compare short strings)
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { randomKey, sha256Hex, timingSafeEqual };
