// utils/n8n.js
const axios = require('axios');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/brand-mention';


async function sendBrandMention(payload) {
  try {
    await axios.post(
      N8N_WEBHOOK_URL,
      payload,
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          ...(N8N_TOKEN ? { 'X-Webhook-Token': N8N_TOKEN } : {})
        }
      }
    );
  } catch (err) {
    console.error('Failed to notify n8n:', err.response?.data || err.message);
  }
}

module.exports = { sendBrandMention };
