const rateLimit = require('express-rate-limit');

// Custom rate limit by API key (optional enhancement)
const createKeyGenerator = () => {
  return (req) => {
    return req.apiKey || req.ip; // Rate limit by API key, fallback to IP
  };
};

const customRateLimit = (windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: createKeyGenerator(),
    message: {
      error: 'Rate limit exceeded',
      details: `Too many requests from your API key. Please try again in ${windowMs/60000} minutes.`
    }
  });
};

module.exports = customRateLimit;