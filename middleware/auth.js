// middleware/auth.js
const User = require('../models/User');
const mongoose = require('mongoose');
const { sha256Hex } = require('../utils/keys');

module.exports = async function authenticateApiKey(req, res, next) {
  try {
    const apiKeyRaw = req.header('X-API-Key') || req.query.api_key;
    if (!apiKeyRaw) {
      return res.status(401).json({ error: 'API key required', details: 'Use X-API-Key header' });
    }

    const hash = sha256Hex(apiKeyRaw);
    let user = null;

    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ apiKeyHash: hash, isActive: { $ne: false } }).lean();
      // Optional lazy migration from legacy plaintext apiKey -> apiKeyHash
      if (!user) {
        user = await User.findOne({ apiKey: apiKeyRaw, isActive: { $ne: false } });
        if (user) {
          user.apiKeyHash = hash;
          user.apiKeyPrefix = apiKeyRaw.slice(0, 8);
          user.apiKeyCreatedAt = new Date();
          user.apiKey = undefined; // remove plaintext
          await user.save();
          user = user.toObject();
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid API key', details: 'Key not found or inactive' });
    }

    // Attach safe identifiers; do NOT expose raw key
    req.apiKeyHash = hash;
    req.apiKeyPrefix = apiKeyRaw.slice(0, 8);
    req.user = user; // lean object
    next();
  } catch (err) {
    next(err);
  }
};
