BrandMention Alert API

Monitor brand mentions starting with Reddit — with API-key auth, rate limits, usage tracking, and Swagger docs.
Built with Node.js + Express, MongoDB Atlas (Mongoose), and a simple front-end demo.

✨ Features

🔎 Search Reddit for brand mentions: GET /api/search

🔐 API-key auth (keys are stored hashed + prefix; full key is shown once)

📈 Usage tracking per user (total + monthly)

🚦 Rate limiting

Free/IP: 60 req/hr (legacy X-RateLimit-* headers)

Paid/key: 1000 req/day with X-RateLimit-Limit/Remaining/Reset

🧪 Live docs with Swagger/OpenAPI at /docs

🔑 Key rotation endpoint: POST /api/keys/rotate

❤️ Health check at /health

🧰 Clean utils for validation, sentiment, and Reddit fetcher

🧱 Ready to swap in Redis for distributed rate limiting

🗺️ API Overview

Base URL (local): http://localhost:3000

Method	Path	Description	Auth
POST	/api/signup	Create an account & return a new API key (shown once)	❌
GET	/api/search	Search Reddit mentions (keyword, limit)	✅
GET	/api/user	Get current user profile	✅
GET	/api/usage	Get usage & rate-limit info	✅
POST	/api/keys/rotate	Rotate API key (returns new key once)	✅
GET	/docs	Interactive Swagger UI	❌
GET	/health	Health probe & basic stats	❌

Auth header:
X-API-Key: <your_api_key>

A demo memory key exists for local testing: test-key-123.

🚀 Quick Start
# 1) Clone
git clone https://github.com/<you>/brandmention-api.git
cd brandmention-api

# 2) Install
npm install

# 3) Configure env
cp .env.example .env
# edit .env with your MongoDB URI, etc.

# 4) Run
npm start
# or: node server.js

# 5) Docs
open http://localhost:3000/docs

.env.example
# Server
PORT=3000
NODE_ENV=development

# Mongo
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority

# App metadata (optional)
APP_NAME=BrandMention Alert API
APP_VERSION=1.0.0

# (Optional) Redis for distributed rate limits
# REDIS_URL=redis://localhost:6379

🔑 Signup (get an API key)
curl -s -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice+1@example.com"}'


Response (important):

{
  "success": true,
  "message": "Welcome to BrandMention Alert!",
  "apiKey": "bm_...shown_once...",
  "user": { "name": "Alice", "email": "alice+1@example.com", "plan": "beta" },
  "usage": { "searches": 0, "searchesThisMonth": 0, "limit": 100, "remaining": 100, "reset": "monthly" }
}


We store only a sha256 hash and an 8-char prefix of your key.
Keep the full key safe; you won’t see it again.

🔍 Search mentions
curl -s "http://localhost:3000/api/search?keyword=openai&limit=3" \
  -H "X-API-Key: bm_...your_key..."


Paid plan responses include per-key headers:

X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1760140800   # unix seconds (midnight UTC)


Free/IP responses include:

X-RateLimit-Limit: 60
X-RateLimit-Remaining: 55
X-RateLimit-Reset: 1760096452

👤 User / 📊 Usage
# user profile
curl -s http://localhost:3000/api/user \
  -H "X-API-Key: bm_...your_key..."

# usage & rate-limit info
curl -s http://localhost:3000/api/usage \
  -H "X-API-Key: bm_...your_key..."

🔁 Rotate API key
curl -s -X POST http://localhost:3000/api/keys/rotate \
  -H "X-API-Key: bm_...your_key..."


Response:

{ "apiKey": "bm_...new_key...", "rotatedAt": "2025-10-10T10:55:00.000Z", "prefix": "bm_xxxxxxxx" }


Old key is immediately invalidated.

🧱 Architecture

server.js – app wiring, routes, security, Swagger, rate limits

routes/

search.js – GET /api/search

keys.js – POST /api/keys/rotate

middleware/

auth.js – hash-based API key auth (DB) + test-key adapter

rateLimit.js – per-IP and per-key limiters (Redis-ready)

models/ – User.js (apiKeyHash, apiKeyPrefix, usage, plan, etc.)

utils/

reddit.js – Reddit search via public JSON API

validation.js – parameter validation, SQLi guard, sanitization

keys.js – randomKey(), sha256Hex()

sentiment.js – simple sentiment stub (wire up as needed)

public/ – landing page + live demo UI

openapi.yaml – Swagger/OpenAPI 3.0

🔒 Security Notes

API keys are never stored in plaintext (only hash + prefix).

Full key displayed once on signup/rotation.

Helmet CSP is enabled; CORS is open by default for demo.

SQL-like injection rejected early (detectSQLi).

Prefer HTTPS in production (behind a proxy/load balancer).

When scaling horizontally, move rate-limit buckets to Redis.

🧪 Local Testing Snippets
# 1) Sign up and capture KEY (PowerShell example)
$resp = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/signup" -ContentType 'application/json' -Body (@{name="Postman User";email="postman+$([guid]::NewGuid().ToString('N'))@example.com"} | ConvertTo-Json)
$KEY = $resp.apiKey

# 2) Search
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/search?keyword=tesla&limit=2" -Headers @{ 'X-API-Key' = $KEY }

# 3) Rotate key
$rot = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/keys/rotate" -Headers @{ 'X-API-Key' = $KEY }
$NEWKEY = $rot.apiKey

📦 Deploy (one-liner-ish)

Set MONGODB_URI and (optionally) REDIS_URL.

Run with a process manager (PM2/Docker) behind HTTPS proxy.

# PM2 example
npm i -g pm2
pm2 start server.js --name brandmention-api
pm2 save

🗺️ Roadmap

Reddit OAuth & richer signals (score, author karma, etc.)

Additional sources (X, Hacker News, Product Hunt)

Webhooks & email digests

Stripe billing + self-serve plan upgrades

Admin dashboard (user search & key management)

Replace in-memory key buckets with Redis in prod

🤝 Contributing

PRs welcome! Please:

Run npm run lint and add tests where possible.

Keep endpoints documented in openapi.yaml.

📄 License

MIT © You

🙋 Support

Open an issue in GitHub or email osharapolli123@gmail.com