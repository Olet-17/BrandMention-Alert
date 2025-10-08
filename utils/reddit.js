const axios = require('axios');

class RedditAPI {
  constructor() {
    this.baseURL = 'https://www.reddit.com';
    this.userAgent = 'BrandMentionAlert/1.0.0';
  }

  async search(keyword, limit = 25, sort = 'relevance') {
    try {
      console.log(`🔍 Searching Reddit for: "${keyword}"`);
      
      const searchUrl = `${this.baseURL}/search.json`;
      const params = {
        q: keyword,
        limit: Math.min(limit, 100),
        sort: sort,
        type: 'link',
        restrict_sr: false
      };

      console.log('🌐 Making request to:', searchUrl);
      console.log('📋 Parameters:', params);

      const response = await axios.get(
        searchUrl,
        {
          params: params,
          headers: {
            'User-Agent': this.userAgent
          },
          timeout: 10000
        }
      );

      console.log('✅ Reddit API response received');
      const results = this.formatSearchResults(response.data.data.children, keyword);
      console.log(`📊 Found ${results.length} real Reddit mentions for "${keyword}"`);
      
      return results;
    } catch (error) {
      console.error('❌ Reddit search failed:');
      console.error('   Error:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      }
      return [];
    }
  }

  formatSearchResults(posts, keyword) {
    if (!posts || !Array.isArray(posts)) {
      console.log('⚠️  No posts array received from Reddit');
      return [];
    }

    console.log(`📨 Raw Reddit posts received: ${posts.length}`);

    const filteredPosts = posts.filter(post => post && post.data && !post.data.stickied);
    console.log(`📊 After filtering stickied posts: ${filteredPosts.length}`);

    const results = filteredPosts.map(post => {
      const data = post.data;
      
      const engagement = (data.ups || 0) + (data.num_comments || 0);
      
      return {
        id: `reddit_${data.id}`,
        platform: 'reddit',
        title: data.title,
        content: data.selftext || data.title,
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
          engagement: engagement,
          created_utc: data.created_utc,
          subreddit_subscribers: data.subreddit_subscribers
        },
        timestamp: new Date(data.created_utc * 1000).toISOString(),
        keyword: keyword
      };
    }).filter(mention => mention.content && mention.content.length > 10);

    console.log(`🎯 Final formatted results: ${results.length}`);
    
    return results;
  }
}

module.exports = new RedditAPI();