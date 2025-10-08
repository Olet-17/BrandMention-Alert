const config = require('../config');

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
      details: 'The provided API key is invalid.'
    });
  }
  
  req.user = keyData;
  next();
};

module.exports = authenticateApiKey;