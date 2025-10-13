// routes/keys.js
const express = require('express');
const User = require('../models/User');
const authenticateApiKey = require('../middleware/auth'); // hash-based auth
const { randomKey, sha256Hex } = require('../utils/keys');

const router = express.Router();

// Simple sanity route so we can verify the router is mounted
router.get('/ping', (_req, res) => res.json({ ok: true }));

// Rotate key for real (non-demo) users
router.post('/rotate', authenticateApiKey, async (req, res, next) => {
  try {
    // block demo/test key
    if (req.user && req.user.userId === 'test-user') {
      return res.status(400).json({ error: 'Rotation not available for demo key' });
    }

    const userId = req.user?._id || req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newKey = randomKey();
    user.apiKeyHash = sha256Hex(newKey);
    user.apiKeyPrefix = newKey.slice(0, 8);
    user.apiKeyCreatedAt = new Date();
    await user.save();

    return res.json({
      apiKey: newKey,                 // show once
      prefix: user.apiKeyPrefix,
      rotatedAt: user.apiKeyCreatedAt.toISOString()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
  