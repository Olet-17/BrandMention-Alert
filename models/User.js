const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  apiKey: { 
    type: String, 
    required: true, 
    unique: true 
  },
  plan: { 
    type: String, 
    default: 'beta',
    enum: ['beta', 'free', 'starter', 'pro', 'business']
  },
  searches: { 
    type: Number, 
    default: 0 
  },
  searchesThisMonth: { 
    type: Number, 
    default: 0 
  },
  lastSearchReset: {
    type: Date,
    default: Date.now
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Reset monthly searches on month change
userSchema.methods.resetMonthlySearchesIfNeeded = function() {
  const now = new Date();
  const lastReset = new Date(this.lastSearchReset);
  
  // Check if month has changed
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.searchesThisMonth = 0;
    this.lastSearchReset = now;
    return true;
  }
  return false;
};

// Check if user has searches remaining
userSchema.methods.hasSearchesRemaining = function() {
  this.resetMonthlySearchesIfNeeded();
  
  const planLimits = {
    beta: 100,
    free: 100,
    starter: 1000,
    pro: 5000,
    business: 20000
  };
  
  const limit = planLimits[this.plan] || 100;
  return this.searchesThisMonth < limit;
};

// Get remaining searches
userSchema.methods.getRemainingSearches = function() {
  this.resetMonthlySearchesIfNeeded();
  
  const planLimits = {
    beta: 100,
    free: 100,
    starter: 1000,
    pro: 5000,
    business: 20000
  };
  
  const limit = planLimits[this.plan] || 100;
  return Math.max(0, limit - this.searchesThisMonth);
};

module.exports = mongoose.model('User', userSchema);