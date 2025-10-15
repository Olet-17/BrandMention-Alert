// routes/search.js
const express = require('express');
const { sanitizeKeyword, validateParams, detectSQLi } = require('../utils/validation');
const Reddit = require('../utils/reddit'); // must export a CLASS (module.exports = RedditAPI)

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { keyword, platform = 'all', limit, sort = 'new', time = 'month' } = req.query;

    // 1) Validate/sanitize
    const { errors, limit: lim } = validateParams({ keyword, limit });
    if (errors.length) return res.status(400).json({ errors });
    if (detectSQLi(keyword)) return res.status(400).json({ error: 'Suspicious query detected.' });

    const cleanKeyword = sanitizeKeyword(keyword);
    if (!cleanKeyword) return res.status(400).json({ error: 'Keyword is empty after sanitization.' });

    // 2) Fetch
    const results = [];
    if (platform === 'all' || platform === 'reddit') {
      try {
        const reddit = new Reddit();              // <-- only if reddit.js exports a CLASS
        const items = await reddit.search(cleanKeyword, lim, sort, time);
        results.push(...items);
      } catch (e) {
        // Surface upstream failure so you see the reason in the client
        return res.status(502).json({
          error: 'Upstream fetch failed',
          source: 'reddit',
          message: e.message,
          details: e.details ?? null
        });
      }
    }

    // 3) Respond
    res.json({ keyword: cleanKeyword, count: results.length, results });
  } catch (err) {
    next(err);
  }



  sendBrandMention({
    keyword,
    total,
    items: results.map(r => ({
      title: r.title,
      url: r.url
    }))
  });

  res.json({ keyword, count: total, results });


});




module.exports = router;
