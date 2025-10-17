// routes/search.js
const express = require('express');
const { sanitizeKeyword, validateParams, detectSQLi } = require('../utils/validation');
const Reddit = require('../utils/reddit');

// OPTIONAL: tiny cache (works if you add utils/cache.js below; otherwise remove cache parts)
let cache;
try { cache = require('../utils/cache'); } catch (_) { cache = null; }

const router = express.Router();

/**
 * GET /api/search
 * Query: keyword (required), limit (1-100), page (>=1), platform=reddit|all, nocache=1 (bypass)
 * Response: { keyword, results, count, meta:{ limit, page, hasNext } }
 */
router.get('/', async (req, res, next) => {
  try {
    const { keyword, platform = 'all', limit, page } = req.query;

    // validateParams already checks keyword + limit range; we add page here
    const { errors, limit: lim } = validateParams({ keyword, limit });
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);

    if (errors.length) return res.status(400).json({ errors });
    if (detectSQLi(keyword)) return res.status(400).json({ error: 'Suspicious query detected.' });

    const cleanKeyword = sanitizeKeyword(keyword);
    if (!cleanKeyword) return res.status(400).json({ error: 'Keyword is empty after sanitization.' });

    // --------- Optional cache (90s) ----------
    const cacheKey = `search:${cleanKeyword}:${lim}:${pageNum}:${platform}`;
    if (cache && !req.query.nocache) {
      const hit = await cache.get(cacheKey);
      if (hit) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(hit));
      }
    }
    res.setHeader('X-Cache', 'MISS');

    // --------- Aggregate sources (currently Reddit only) ----------
    const all = [];
    if (platform === 'all' || platform === 'reddit') {
      const reddit = new Reddit();
      const items = await reddit.search(cleanKeyword, Math.min(lim * pageNum, 100)); // fetch enough for current page
      all.push(...items);
    }

    // You can sort here if you want stable order (e.g., by timestamp desc)
    all.sort((a, b) => (new Date(b.timestamp) - new Date(a.timestamp)));

    // --------- Simple pagination (page/limit) ----------
    const start = (pageNum - 1) * lim;
    const end   = start + lim;
    const paged = all.slice(start, end);

    const payload = {
      keyword: cleanKeyword,
      results: paged,
      count: paged.length,
      meta: {
        limit: lim,
        page: pageNum,
        hasNext: end < all.length
      }
    };

    // --------- Save to cache ----------
    if (cache && !req.query.nocache) {
      await cache.set(cacheKey, JSON.stringify(payload)); // TTL handled inside cache helper
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
