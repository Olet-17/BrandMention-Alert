const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

const config = require('./config');
const connectDB = require('./config/database');
const User = require('./models/User');
const authMiddleware = require('./middleware/auth');
const searchRoutes = require('./routes/search');

const app = express();

// Connect to MongoDB
connectDB();

// Temporary in-memory storage as fallback
const memoryUsers = new Map();

// ADD TEST API KEY TO MEMORY
memoryUsers.set('test-key-123', {
  userId: 'test-user',
  email: 'demo@brandmentalert.com',
  name: 'Demo User',
  company: 'BrandMention Alert',
  plan: 'beta',
  searches: 0,
  searchesThisMonth: 0,
  createdAt: new Date().toISOString()
});

// Middleware - Configure helmet to allow inline scripts for landing page
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests, please try again later.',
    details: `Rate limit exceeded. Maximum ${config.rateLimit.max} requests per hour.`
  }
});
app.use(limiter);

// FIXED authentication middleware - checks both database and memory
const createAuthMiddleware = () => {
  return async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        details: 'Please provide an API key in the X-API-Key header'
      });
    }

    try {
      let userData;

      // First check memory storage (for test key and cached users)
      userData = memoryUsers.get(apiKey);

      // If not found in memory, check database
      if (!userData && mongoose.connection.readyState === 1) {
        const user = await User.findOne({ apiKey, isActive: true });
        if (user) {
          userData = {
            userId: user._id,
            email: user.email,
            name: user.name,
            company: user.company,
            plan: user.plan,
            searches: user.searches,
            searchesThisMonth: user.searchesThisMonth,
            createdAt: user.createdAt
          };
          // Cache in memory for future requests
          memoryUsers.set(apiKey, userData);
        }
      }

      if (!userData) {
        return res.status(401).json({
          error: 'Invalid API key',
          details: 'The provided API key is invalid or inactive.'
        });
      }

      // Check if user has searches remaining (only for database users)
      if (mongoose.connection.readyState === 1 && userData.userId !== 'test-user') {
        const user = await User.findOne({ apiKey });
        if (user && !user.hasSearchesRemaining()) {
          return res.status(429).json({
            error: 'Monthly search limit exceeded',
            details: `You've used all ${user.searchesThisMonth} searches for this month. Upgrade your plan for more searches.`
          });
        }
      }

      req.user = userData;
      req.apiKey = apiKey;
      req.useDatabase = mongoose.connection.readyState === 1 && userData.userId !== 'test-user';
      next();

    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        error: 'Authentication failed',
        details: 'Please try again later'
      });
    }
  };
};

// Use the fixed auth middleware
const authMiddlewareWithDB = createAuthMiddleware();

// Signup endpoint with database
app.post('/api/signup', express.json(), async (req, res) => {
  try {
    const { email, name, company } = req.body;
    
    console.log('📝 Signup attempt:', { email, name, company });
    
    if (!email || !name) {
      return res.status(400).json({ 
        error: 'Name and email required',
        details: 'Please provide both name and email address'
      });
    }

    // Generate API key
    const apiKey = 'bm-' + crypto.randomBytes(16).toString('hex');
    
    try {
      // Create user in database
      const user = new User({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        company: company?.trim(),
        apiKey: apiKey,
        plan: 'beta'
      });

      await user.save();
      console.log('✅ New user registered in database:', user.email);

      // Also store in memory as backup
      memoryUsers.set(apiKey, {
        userId: user._id,
        email: user.email,
        name: user.name,
        company: user.company,
        plan: user.plan,
        searches: 0,
        searchesThisMonth: 0,
        createdAt: user.createdAt
      });

      res.json({
        success: true,
        message: 'Welcome to BrandMention Alert!',
        apiKey: apiKey,
        user: {
          name: user.name,
          email: user.email,
          plan: user.plan
        },
        usage: {
          searches: 0,
          searchesThisMonth: 0,
          limit: 100,
          remaining: 100,
          reset: 'monthly'
        },
        nextSteps: [
          'Use your API key in the X-API-Key header',
          'Check the documentation for usage examples',
          'Join our community for support'
        ]
      });
      
    } catch (dbError) {
      if (dbError.code === 11000) {
        // Duplicate key error
        return res.status(409).json({
          error: 'Email already registered',
          details: 'This email address is already associated with an API key'
        });
      }
      throw dbError;
    }
    
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({
      error: 'Signup failed',
      details: 'Please try again later'
    });
  }
});

// Get user info endpoint
app.get('/api/user', authMiddlewareWithDB, async (req, res) => {
  try {
    // For test user, return mock data
    if (req.user.userId === 'test-user') {
      return res.json({
        user: {
          userId: 'test-user',
          name: 'Demo User',
          email: 'demo@brandmentalert.com',
          company: 'BrandMention Alert',
          plan: 'beta',
          joined: new Date().toISOString()
        },
        usage: {
          totalSearches: 0,
          monthlySearches: 0,
          limit: 100,
          remaining: 100
        }
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: 'The user associated with this API key was not found'
      });
    }

    res.json({
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        plan: user.plan,
        joined: user.createdAt
      },
      usage: {
        totalSearches: user.searches,
        monthlySearches: user.searchesThisMonth,
        limit: 100,
        remaining: user.getRemainingSearches()
      }
    });
  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      details: 'Please try again later'
    });
  }
});

// Routes with database authentication
app.use('/api/search', authMiddlewareWithDB, searchRoutes);

// Update search route to track usage in database
app.use('/api/search', authMiddlewareWithDB, async (req, res, next) => {
  try {
    if (req.useDatabase) {
      const user = await User.findById(req.user.userId);
      if (user) {
        // Update search counts
        user.searches += 1;
        user.searchesThisMonth += 1;
        await user.save();
        
        console.log(`📊 Database usage tracked: ${user.email} - Total: ${user.searches}, Monthly: ${user.searchesThisMonth}, Remaining: ${user.getRemainingSearches()}`);
      }
    } else {
      // Memory usage tracking for test user
      const userData = memoryUsers.get(req.apiKey);
      if (userData) {
        userData.searches = (userData.searches || 0) + 1;
        userData.searchesThisMonth = (userData.searchesThisMonth || 0) + 1;
        console.log(`📊 Memory usage tracked: ${userData.email} - Total: ${userData.searches}, Monthly: ${userData.searchesThisMonth}`);
      }
    }
    next();
  } catch (error) {
    console.error('Usage tracking error:', error);
    next(); // Continue even if tracking fails
  }
});

// Health check with database status
app.get('/health', async (req, res) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;
    
    let userCount = 0;
    if (dbConnected) {
      try {
        userCount = await User.countDocuments();
      } catch (dbError) {
        console.error('Database count error:', dbError);
      }
    }

    const memoryUserCount = memoryUsers.size;

    res.json({
      status: dbConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      environment: config.app.env,
      database: {
        status: dbConnected ? 'connected' : 'disconnected',
        users: userCount,
        connectionState: mongoose.connection.readyState
      },
      memory: {
        users: memoryUserCount
      },
      stats: {
        totalUsers: userCount + memoryUserCount
      }
    });
  } catch (error) {
    res.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: {
        status: 'error',
        connectionState: mongoose.connection ? mongoose.connection.readyState : 'unknown'
      }
    });
  }
});

// Root endpoint - serve the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Usage endpoint
app.get('/api/usage', authMiddlewareWithDB, async (req, res) => {
  try {
    let usage;
    
    if (req.useDatabase) {
      const user = await User.findById(req.user.userId);
      usage = {
        totalSearches: user.searches,
        monthlySearches: user.searchesThisMonth,
        limit: 100,
        remaining: user.getRemainingSearches()
      };
    } else {
      const userData = memoryUsers.get(req.apiKey);
      usage = {
        totalSearches: userData.searches || 0,
        monthlySearches: userData.searchesThisMonth || 0,
        limit: 100,
        remaining: Math.max(0, 100 - (userData.searchesThisMonth || 0))
      };
    }

    res.json({
      userId: req.user.userId,
      plan: req.user.plan,
      usage: usage,
      rateLimit: {
        requestsPerHour: config.rateLimit.max,
        remaining: 'Check headers'
      }
    });
  } catch (error) {
    console.error('Usage endpoint error:', error);
    res.status(500).json({
      error: 'Failed to get usage data',
      details: 'Please try again later'
    });
  }
});

// Debug endpoint to see all API keys (remove in production)
app.get('/api/debug/keys', (req, res) => {
  if (config.app.env !== 'development') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const memoryKeys = Array.from(memoryUsers.keys());
  
  User.find({}, 'apiKey email name').then(users => {
    const dbKeys = users.map(user => ({
      apiKey: user.apiKey,
      email: user.email,
      name: user.name
    }));

    res.json({
      memory: {
        count: memoryKeys.length,
        keys: memoryKeys
      },
      database: {
        count: dbKeys.length,
        keys: dbKeys
      }
    });
  }).catch(error => {
    res.json({
      memory: {
        count: memoryKeys.length,
        keys: memoryKeys
      },
      database: {
        error: error.message
      }
    });
  });
});

// 404 handler
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      error: 'Endpoint not found',
      details: `The requested endpoint ${req.originalUrl} does not exist.`
    });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: config.app.env === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(config.app.port, () => {
  console.log(`
🚀 ${config.app.name} v${config.app.version}
📍 Server running on port ${config.app.port}
🗄️  Database: ${process.env.MONGODB_URI ? 'MongoDB Atlas' : 'In-memory (fallback)'}
🌐 Landing Page: http://localhost:${config.app.port}/
🔍 API: http://localhost:${config.app.port}/api/search?keyword=test
📝 Signup: http://localhost:${config.app.port}/#signup
❤️  Health check: http://localhost:${config.app.port}/health
🔑 Test API Key: test-key-123
🔑 Memory API Keys: ${Array.from(memoryUsers.keys()).join(', ')}
  `);
});

module.exports = app;