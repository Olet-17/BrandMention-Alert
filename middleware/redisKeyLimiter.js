// middleware/redisKeyLimiter.js
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { lazyConnect: true });
async function ensure() { if (!redis.status || redis.status === 'end') try { await redis.connect(); } catch {} }

function nextMidnightUTC() {
  const n = new Date();
  return +new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
}

module.exports = async function paidKeyLimiter(req, res, next) {
  try {
    // Only enforce for paid plans
    if (!(req.user && req.user.plan === 'paid')) return next();

    const keyHash = req.apiKeyHash;               // from your auth middleware
    if (!keyHash) return res.status(401).json({ error: 'Invalid API key' });

    const limit = parseInt(process.env.PAID_DAILY_LIMIT || '1000', 10);
    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const rkey = `rl:${keyHash}:${dateKey}`;

    await ensure();

    // INCR and set expiry to next midnight
    const cnt = await redis.incr(rkey);
    if (cnt === 1) {
      const ttl = Math.ceil((nextMidnightUTC() - Date.now()) / 1000);
      await redis.expire(rkey, ttl);
    }

    const remaining = Math.max(0, limit - cnt);
    const resetAt = Math.floor(nextMidnightUTC() / 1000);

    // RFC-style + legacy headers
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('RateLimit-Reset', String(resetAt));
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('X-RateLimit-Reset', String(resetAt));

    if (cnt > limit) {
      res.setHeader('Retry-After', String(resetAt - Math.floor(Date.now() / 1000)));
      return res.status(429).json({ error: 'Daily key rate limit exceeded' });
    }
    next();
  } catch (e) {
    // Fail-open (don’t block traffic if Redis hiccups)
    console.error('paidKeyLimiter error:', e.message);
    next();
  }
};
