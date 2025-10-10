// middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const ipLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 60min
  max: 60,                   // free/IP
  standardHeaders: false,    // no RFC RateLimit-* (keep it simple)
  legacyHeaders: true,       // X-RateLimit-Limit/Remaining
  handler: (req, res) => {
    res.setHeader('Retry-After', Math.ceil(60 * 60)); // seconds
    res.status(429).json({ error: 'Hourly IP rate limit exceeded' });
  }
});

// simple in-memory buckets for paid keys (swap for Redis in prod)
const buckets = new Map();
function nextMidnightUTC() {
  const n = new Date();
  return +new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
}

/**
 * Per-API key daily limiter for paid plans (1000/day)
 * Adds: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 */
function paidKeyLimiter(req, res, next) {
  // only apply to paid plan (free/beta are enforced by IP limiter)
  if (!(req.user && req.user.plan === 'paid')) return next();

  // ✅ use the HASH, not the raw key
  // (auth middleware must set req.apiKeyHash)
  const keyHash = req.apiKeyHash;
  if (!keyHash) {
    // if somehow missing, fail closed with 401 so we don't leak behavior
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const bucketKey = `key:${keyHash}`;
  const limit = 1000;
  const now = Date.now();

  let b = buckets.get(bucketKey);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: nextMidnightUTC(), limit };
    buckets.set(bucketKey, b);
  }

  b.count += 1;
  const remaining = Math.max(0, b.limit - b.count);

  res.setHeader('X-RateLimit-Limit', String(b.limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(b.resetAt / 1000))); // unix seconds

  if (b.count > b.limit) {
    res.setHeader('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Daily key rate limit exceeded' });
  }

  next();
}

module.exports = { ipLimiter, paidKeyLimiter };
