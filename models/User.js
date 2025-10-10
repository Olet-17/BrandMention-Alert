// models/User.js
const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  daily: { type: Map, of: Number, default: {} } // YYYY-MM-DD -> count
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: { type: String, index: true },
  name: String,
  company: String,

  plan: { type: String, enum: ['free', 'beta', 'paid'], default: 'beta' },

  // 🔒 secure key storage
  apiKeyHash: { type: String, unique: true, sparse: true },  // sha256 hex of full key
  apiKeyPrefix: { type: String, index: true },               // first 8 chars for display/search
  apiKeyCreatedAt: { type: Date, default: Date.now },

  // (legacy) remove if present:
  // apiKey: String,

  usage: { type: usageSchema, default: () => ({}) },

  searches: { type: Number, default: 0 },
  searchesThisMonth: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Helpers (unchanged)
userSchema.methods.incrementDailyUsage = async function (dateKey) {
  const current = this.usage?.daily?.get(dateKey) || 0;
  this.usage.daily.set(dateKey, current + 1);
  await this.save();
};

userSchema.methods.getRemainingDailyQuota = function (limitPerDay) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const used = this.usage?.daily?.get(dateKey) || 0;
  return Math.max(0, limitPerDay - used);
};

module.exports = mongoose.model('User', userSchema);
