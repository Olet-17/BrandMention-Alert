// utils/cache.js
const Redis = require('ioredis');
const url = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(url, { lazyConnect: true });

const TTL = parseInt(process.env.SEARCH_CACHE_TTL || '90', 10); // seconds

async function ensure() {
  if (!redis.status || redis.status === 'end') {
    try { await redis.connect(); } catch { /* ignore connect errors, operate without cache */ }
  }
}

exports.get = async (key) => {
  try { await ensure(); return await redis.get(key); } catch { return null; }
};
exports.set = async (key, val, ttl = TTL) => {
  try { await ensure(); await redis.set(key, val, 'EX', ttl); } catch {}
};
