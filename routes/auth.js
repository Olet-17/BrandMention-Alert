const config = require('../config');

/**
 * API Key authentication middleware
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      details: 'Please provide an API key in the X-API-Key header'
    });
  }
  
  const keyData = config.apiKeys[apiKey];
  if (!keyData) {
    return res.status(401).json({
      error: 'Invalid API key',
      details: 'The provided API key is invalid. Please check your key or contact support.'
    });
  }
  
  // Add user info to request
  req.user = keyData;
  req.apiKey = apiKey;
  
  next();
};

module.exports = authenticateApiKey;