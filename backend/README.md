# ThreadOptimizer Backend

Backend API for ThreadOptimizer — automated Threads (Meta) content generation and posting for data center and AI infrastructure professionals.

## Features
- Meta Threads OAuth 2.0 authentication
- AI content generation via xAI Grok API (10 template types)
- Scheduled posting with BullMQ + Redis
- Optimal posting window management (08:00-11:00 and 16:00-19:00 GMT)
- Image search via Unsplash API
- PostgreSQL persistence via Sequelize ORM

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis

### Installation
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
```

### Running
```bash
npm run dev   # development with auto-reload
npm start     # production
npm test      # run tests
```

## API Routes

### Auth
- `GET  /api/auth/threads`           — Initiate Meta OAuth
- `GET  /api/auth/threads/callback`  — OAuth callback
- `POST /api/auth/refresh`           — Refresh token (requires JWT)
- `GET  /api/auth/profile`           — Get profile (requires JWT)

### Posts
- `POST /api/posts`                  — Create draft post
- `POST /api/posts/generate`         — Generate + schedule (full pipeline)
- `GET  /api/posts`                  — List posts (paginated)
- `GET  /api/posts/:id`              — Get post
- `PUT  /api/posts/:id/approve`      — Approve draft
- `POST /api/posts/:id/publish`      — Publish immediately

### Content Generation
- `POST /api/grok/generate`          — Preview generated content

### Health
- `GET  /health`                     — Health check

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection URL |
| `REDIS_URL` | Redis connection URL |
| `JWT_SECRET` | JWT signing secret |
| `META_APP_ID` | Meta App ID |
| `META_APP_SECRET` | Meta App Secret |
| `META_REDIRECT_URI` | OAuth callback URL |
| `XAI_API_KEY` | xAI Grok API key |
| `UNSPLASH_ACCESS_KEY` | Unsplash API key |
| `FRONTEND_URL` | Frontend URL for CORS |
| `MAX_POSTS_PER_DAY` | Daily post limit (default: 7) |
| `ENCRYPTION_KEY` | 32-char key for token encryption |
