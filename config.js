require('dotenv').config();

const config = {
  app: {
    name: "BrandMention Alert API",
    version: "1.0.0",
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/brandmention',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  rateLimit: {
    windowMs: 60 * 60 * 1000,
    max: 100
  },
  // Remove the in-memory apiKeys - we'll use database now
  apiKeys: {} // Keep empty for now
};

// Validate required environment variables
if (!process.env.MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI not set. Using in-memory storage (data will be lost on restart)');
}

module.exports = config;