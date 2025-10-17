// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUI = require('swagger-ui-express');
const paidKeyLimiter = require('./middleware/redisKeyLimiter');
const YAML = require('yamljs');
const mongoose = require('mongoose');
require('dotenv').config();

const openapi = YAML.load(path.join(__dirname, 'openapi.yaml'));
const config = require('./config');
const connectDB = require('./config/database');
const User = require('./models/User');

const searchRoutes = require('./routes/search');
const keyRoutes = require('./routes/keys');                 // 🔑 add this
const authenticateApiKey = require('./middleware/auth');    // hash-based
const { randomKey, sha256Hex } = require('./utils/keys');

const app = express();

// -----------------------------
// DB
// -----------------------------
connectDB();

// -----------------------------
// Memory test user (for demos)
// -----------------------------
const memoryUsers = new Map();
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

// -----------------------------
// Security / JSON / Static
// -----------------------------
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
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------
// Global (free) IP limiter 60/hr
// -----------------------------
const ipLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: false,
  legacyHeaders: true,
  message: {
    error: 'Too many requests, please try again later.',
    details: 'Rate limit exceeded. Maximum 60 requests per hour.'
  }
});
app.use(ipLimiter);

// -----------------------------
// Swagger
// -----------------------------
app.get('/openapi.json', (_req, res) => res.json(openapi));
app.use('/docs', swaggerUI.serve, swaggerUI.setup(openapi, {
  customSiteTitle: 'BrandMention Alert API Docs',
  swaggerOptions: { persistAuthorization: true }
}));

// -----------------------------
// Test-key adapter + hash auth
// If X-API-Key is the test key, short-circuit to memory user.
// Otherwise, fall through to hash-based DB auth.
// -----------------------------
const testKeyOrAuth = async (req, res, next) => {
  const apiKeyRaw = req.header('X-API-Key') || req.query.api_key;
  if (apiKeyRaw && memoryUsers.has(apiKeyRaw)) {
    const u = memoryUsers.get(apiKeyRaw);
    req.user = { ...u };                   // userId='test-user'
    req.apiKeyHash = sha256Hex(apiKeyRaw); // so limiter uses hash
    req.apiKeyPrefix = apiKeyRaw.slice(0, 8);
    req.apiKeyRaw = apiKeyRaw;
    req.useDatabase = false;
    return next();
  }
  // DB path
  return authenticateApiKey(req, res, () => {
    req.useDatabase = true; // set a flag for usage tracker
    return next();
  });
};

app.set("trust proxy", 1);
// -----------------------------
// Paid per-key limiter (1000/day) keyed by HASH
// -----------------------------
const keyBuckets = new Map(); // keyHash -> { count, resetAt, limit }
function nextMidnightUTC() {
  const n = new Date();
  return +new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
}


// -----------------------------
// Signup (secure: hash + prefix, show full key once)
// Better 11000 handling to reveal which field collided.
// -----------------------------
app.post('/api/signup', express.json(), async (req, res) => {
  try {
    const { email, name, company } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Name and email required' });
    }

    const apiKey = randomKey();
    const apiKeyHash = sha256Hex(apiKey);
    const apiKeyPrefix = apiKey.slice(0, 8);

    const user = new User({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      company: company?.trim(),
      plan: 'beta',
      apiKeyHash,
      apiKeyPrefix,
      apiKeyCreatedAt: new Date()
    });

    await user.save();

    return res.json({
      success: true,
      message: 'Welcome to BrandMention Alert!',
      apiKey, // show once
      user: { name: user.name, email: user.email, plan: user.plan },
      usage: { searches: 0, searchesThisMonth: 0, limit: 100, remaining: 100, reset: 'monthly' }
    });
  } catch (err) {
    console.error('Signup DB error:', {
      code: err.code,
      keyValue: err.keyValue,
      keyPattern: err.keyPattern,
      message: err.message
    });

    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'email';
      const msg = field === 'apiKeyHash'
        ? 'Key collision on apiKeyHash (check key generation).'
        : 'Email already registered';
      return res.status(409).json({ error: msg, field });
    }
    return res.status(500).json({ error: 'Signup failed', details: 'Please try again later' });
  }
});

// -----------------------------
// Auth’d endpoints (user/usage)
// Use testKeyOrAuth everywhere
// -----------------------------
app.get('/api/user', testKeyOrAuth, async (req, res) => {
  try {
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
        usage: { totalSearches: 0, monthlySearches: 0, limit: 100, remaining: 100 }
      });
    }

    const user = await User.findById(req.user._id || req.user.id || req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

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
        totalSearches: user.searches || 0,
        monthlySearches: user.searchesThisMonth || 0,
        limit: 100,
        remaining: user.getRemainingSearches?.()
      }
    });
  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

app.get('/api/usage', testKeyOrAuth, async (req, res) => {
  try {
    let usage;
    if (req.user.userId === 'test-user') {
      const u = memoryUsers.get(req.apiKeyRaw || 'test-key-123') || {};
      usage = {
        totalSearches: u.searches || 0,
        monthlySearches: u.searchesThisMonth || 0,
        limit: 100,
        remaining: Math.max(0, 100 - (u.searchesThisMonth || 0))
      };
    } else {
      const user = await User.findById(req.user._id || req.user.id || req.user.userId);
      usage = {
        totalSearches: user?.searches || 0,
        monthlySearches: user?.searchesThisMonth || 0,
        limit: 100,
        remaining: user?.getRemainingSearches?.()
      };
    }

    res.json({
      userId: req.user.userId || req.user._id || req.user.id,
      plan: req.user.plan,
      usage,
      rateLimit: {
        freePerIpPerHour: 60,
        paidPerKeyPerDay: 1000,
        remaining: 'See X-RateLimit-Remaining header'
      }
    });
  } catch (error) {
    console.error('Usage endpoint error:', error);
    res.status(500).json({ error: 'Failed to get usage data' });
  }
});

// -----------------------------
// Usage tracker (best-effort)
// -----------------------------
const searchUsageTracker = async (req, res, next) => {
  try {
    if (req.user.userId === 'test-user') {
      const apiKeyRaw = req.apiKeyRaw || 'test-key-123';
      const u = memoryUsers.get(apiKeyRaw);
      if (u) {
        u.searches = (u.searches || 0) + 1;
        u.searchesThisMonth = (u.searchesThisMonth || 0) + 1;
        memoryUsers.set(apiKeyRaw, u);
        console.log(`📊 Memory usage: ${u.email} => total=${u.searches}, monthly=${u.searchesThisMonth}`);
      }
    } else {
      const user = await User.findById(req.user._id || req.user.id || req.user.userId);
      if (user) {
        user.searches = (user.searches || 0) + 1;
        user.searchesThisMonth = (user.searchesThisMonth || 0) + 1;
        await user.save();
        console.log(`📊 DB usage: ${user.email} => total=${user.searches}, monthly=${user.searchesThisMonth}`);
      }
    }
  } catch (e) {
    console.error('Usage tracking error:', e);
  } finally {
    next();
  }
};

// -----------------------------
// /api/search chain
// -----------------------------
app.use('/api/search', testKeyOrAuth, paidKeyLimiter, searchUsageTracker, searchRoutes);

// -----------------------------
// 🔑 Key management routes
// -----------------------------
app.use('/api/keys', keyRoutes);

// -----------------------------
// Health / debug
// -----------------------------
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
      memory: { users: memoryUserCount },
      stats: { totalUsers: userCount + memoryUserCount }
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

// -----------------------------
// Root / 404 / error handler
// -----------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      error: 'Endpoint not found',
      details: `The requested endpoint ${req.originalUrl} does not exist.`
    });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: config.app.env === 'development' ? err.message : 'Something went wrong'
  });
});

// -----------------------------
// Start
// -----------------------------
app.listen(config.app.port, () => {
  console.log(`
🚀 ${config.app.name} v${config.app.version}
📍 Server running on port ${config.app.port}
🗄️  Database: ${process.env.MONGODB_URI ? 'MongoDB Atlas' : 'In-memory (fallback)'}
🌐 Landing Page: http://localhost:${config.app.port}/
🔎 API: http://localhost:${config.app.port}/api/search?keyword=test
📘 Docs: http://localhost:${config.app.port}/docs
❤️  Health: http://localhost:${config.app.port}/health
🔑 Test API Key: test-key-123
  `);
});

module.exports = app;
