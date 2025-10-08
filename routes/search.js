const express = require('express');
const { analyzeSentiment } = require('../utils/sentiment');
const redditAPI = require('../utils/reddit');

const router = express.Router();
const searchHistory = new Map();

router.get('/', async (req, res) => {
  try {
    const { keyword, platform = 'all', limit = 10 } = req.query;

    if (!keyword || keyword.length < 2) {
      return res.status(400).json({
        error: 'Invalid keyword',
        details: 'Keyword must be at least 2 characters long'
      });
    }

    const searchLimit = Math.min(parseInt(limit), 50);
    const userId = req.user.userId;

    // Store search history
    if (!searchHistory.has(userId)) {
      searchHistory.set(userId, []);
    }
    
    const searchRecord = {
      id: `search_${userId}_${Date.now()}`,
      keyword,
      platform,
      timestamp: new Date().toISOString()
    };
    
    searchHistory.get(userId).push(searchRecord);

    console.log(`\n🎯 NEW SEARCH: "${keyword}", limit: ${searchLimit}`);

    const mentions = [];

    // Get real Reddit data
    if (platform === 'all' || platform === 'reddit') {
      console.log('🔄 Fetching real Reddit data...');
      const redditMentions = await redditAPI.search(keyword, searchLimit);
      
      if (redditMentions.length > 0) {
        console.log(`✅ Got ${redditMentions.length} real Reddit mentions`);
        
        // Analyze sentiment for each mention
        const mentionsWithSentiment = redditMentions.map(mention => {
          const sentimentResult = analyzeSentiment(mention.content);
          return {
            ...mention,
            sentiment: sentimentResult.sentiment,
            confidence: sentimentResult.confidence
          };
        });
        
        mentions.push(...mentionsWithSentiment);
      } else {
        console.log('❌ No Reddit results found');
      }
    }

    // For other platforms, you can add real API integrations later
    if ((platform === 'all' || platform === 'news') && mentions.length === 0) {
      console.log('💡 Tip: Add NewsAPI integration for news mentions');
    }

    const sortedMentions = mentions.slice(0, searchLimit);

    console.log(`📦 Delivering: ${sortedMentions.length} mentions\n`);

    res.json({
      searchId: searchRecord.id,
      keyword,
      platform,
      totalResults: sortedMentions.length,
      mentions: sortedMentions,
      timestamp: searchRecord.timestamp,
      source: 'reddit_api'
    });

  } catch (error) {
    console.error('💥 Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    });
  }
});

// Search history endpoint
router.get('/history', (req, res) => {
  const userId = req.user.userId;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  
  const userHistory = searchHistory.get(userId) || [];
  const recentSearches = userHistory
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);

  res.json({
    totalSearches: userHistory.length,
    recentSearches
  });
});

module.exports = router;