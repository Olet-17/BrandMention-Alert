// utils/reddit.js
const axios = require('axios');

class RedditAPI {
  constructor(opts = {}) {
    this.baseURL = 'https://www.reddit.com';
    this.userAgent =
      opts.userAgent ||
      'BrandMentionAlert/1.0 (+https://yourdomain.com; contact@yourdomain.com)';
  }

  async search(keyword, limit = 25, sort = 'new', time = 'month') {
    const params = {
      q: keyword,
      limit: Math.max(1, Math.min(100, Number(limit) || 25)),
      sort,                 // 'new' | 'relevance' | 'top' | 'comments'
      t: time,              // 'hour'|'day'|'week'|'month'|'year'|'all'
      raw_json: 1,          // proper JSON (no HTML entities)
      include_over_18: 0,   // safer results
      restrict_sr: false
      // NOTE: intentionally NOT using "type: 'link'" (too restrictive)
    };

    const url = `${this.baseURL}/search.json`;

    try {
      const { data } = await axios.get(url, {
        params,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      const children = data?.data?.children || [];
      console.log(`🟥 reddit children: ${children.length} for "${keyword}"`);
      return this.formatSearchResults(children, keyword);
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;
      console.error('❌ Reddit fetch failed', status, body?.message || body);
      // Do NOT silently return []; propagate so the route can 502 with details.
      const e = new Error(`Reddit fetch failed${status ? ` (HTTP ${status})` : ''}`);
      e.details = typeof body === 'string' ? body : JSON.stringify(body || {});
      e.code = 'REDDIT_FETCH_FAILED';
      throw e;
    }
  }

  formatSearchResults(posts, keyword) {
    if (!Array.isArray(posts)) return [];
    return posts
      .filter(p => p?.data && !p.data.stickied)
      .map(({ data }) => {
        const content = (data.selftext || data.title || '').trim();
        const engagement = (data.ups || 0) + (data.num_comments || 0);
        return {
          id: `reddit_${data.id}`,
          platform: 'reddit',
          title: data.title,
          content, // keep short content; don’t filter it out
          author: data.author,
          url: `https://reddit.com${data.permalink}`,
          source: `r/${data.subreddit}`,
          sentiment: 'neutral',
          confidence: 0,
          metadata: {
            upvotes: data.ups,
            comments: data.num_comments,
            subreddit: data.subreddit,
            score: data.score,
            engagement,
            created_utc: data.created_utc,
            subreddit_subscribers: data.subreddit_subscribers
          },
          timestamp: new Date(data.created_utc * 1000).toISOString(),
          keyword
        };
      });
  }
}

module.exports = RedditAPI; // use with: const Reddit = require('../utils/reddit'); new Reddit();
