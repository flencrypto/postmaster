# ThreadOptimizer (postmaster)

An automation tool that generates and posts optimized **Threads** content for niches like data centers (DC), AI infrastructure, hyperscale, and green tech — powered by [xAI Grok](https://x.ai) and the [Meta Threads API](https://developers.facebook.com/docs/threads).

## Features

- **10 Grok Prompt Templates** — from professional daily insights to sarcastic roast threads
- **Auto-hook generation** — question/hot-take openers for 3–5× more replies
- **Optimal scheduling** — posts within 8–11 AM or 4–7 PM GMT windows
- **MAX_POSTS cap** — configurable per-day limit (default 7, hard cap at 10)
- **Hashtag management** — 2–4 niche hashtags per post
- **Image suggestions** — Unsplash-powered visuals attached to posts
- **Content mix controls** — insights, questions/polls, shoutouts, personal
- **Meta OAuth** — secure login with `threads_basic`, `threads_content_publish`, `threads_manage_replies` scopes
- **Draft → Approve → Publish** workflow
- **Extended threads** — optional follow-up posts spaced 4–12h apart

## Architecture

```
postmaster/
├── backend/          # Node.js/Express API
│   ├── src/
│   │   ├── config/   # Environment-based configuration
│   │   ├── controllers/  # Auth, Post, Grok controllers
│   │   ├── models/   # Sequelize models (User, Post, ScheduledJob)
│   │   ├── routes/   # Express routes (/api/auth, /api/posts, /api/grok)
│   │   ├── services/ # Grok, Threads API, Scheduler, Image services
│   │   └── middleware/ # JWT auth, rate limiting
│   └── tests/        # Jest unit tests (22 tests)
├── frontend/         # React 18 + Vite SPA
│   └── src/
│       ├── components/  # Auth, Dashboard, PostComposer, PostList, Layout
│       └── services/    # Axios API client
└── docker-compose.yml  # PostgreSQL + Redis + app containers
```

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for PostgreSQL + Redis)

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

Required keys:
| Variable | Description |
|---|---|
| `META_APP_ID` | Meta App ID (from Meta Developer Portal) |
| `META_APP_SECRET` | Meta App Secret |
| `XAI_API_KEY` | xAI Grok API key |
| `JWT_SECRET` | Random secret for JWT signing |
| `ENCRYPTION_KEY` | 32-char key for access token encryption |
| `UNSPLASH_ACCESS_KEY` | Unsplash API key (optional, for images) |

### 2. Start services

```bash
# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Install and start backend
cd backend && npm install && npm start

# Install and start frontend (new terminal)
cd frontend && npm install && npm run dev
```

Or run everything with Docker:
```bash
docker-compose up --build
```

### 3. Access the app

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Health check**: http://localhost:3001/health

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/threads` | Initiate Meta OAuth |
| GET | `/api/auth/threads/callback` | OAuth callback |
| GET | `/api/auth/profile` | Get current user |

### Posts
| Method | Path | Description |
|---|---|---|
| POST | `/api/posts` | Create post draft |
| POST | `/api/posts/generate` | Generate via Grok + schedule |
| GET | `/api/posts` | List posts (paginated) |
| GET | `/api/posts/:id` | Get post details |
| PUT | `/api/posts/:id/approve` | Approve draft |
| POST | `/api/posts/:id/publish` | Publish immediately |

### Content Generation
| Method | Path | Description |
|---|---|---|
| POST | `/api/grok/generate` | Preview Grok-generated content |

**Example request:**
```json
POST /api/grok/generate
{
  "subject": "Latest trends in liquid cooling for AI data centers 2026",
  "style": "conversational",
  "templateType": "basic_insight"
}
```

## Grok Prompt Templates

| Template | Description |
|---|---|
| `basic_insight` | Daily insight / hot take (single post) |
| `question_poll` | Reply-driving question or poll |
| `short_thread` | 4–8 post deep-dive thread |
| `shoutout` | Community shoutout / goodwill builder |
| `personal` | Behind-the-scenes / humanizing |
| `sarcastic_hot_take` | 🔥 Ultra-sarcastic eye-roll hot take |
| `sarcastic_question` | 😈 Sarcasm-loaded debate-nuke question |
| `sarcastic_thread` | 💀 Full roast thread teardown |
| `sarcastic_shoutout` | 🙄 Backhanded "congrats" |
| `sarcastic_personal` | 😤 Burned-out insider rant |

## Style Options

`professional` · `conversational` · `hot_take` · `technical` · `optimistic`

## Running Tests

```bash
cd backend && npm test
# 22 tests passing (grokService, threadsService, schedulerService)
```

## Security

- Access tokens encrypted with AES-256-CBC before storage
- JWT for app sessions
- Rate limiting: 100 requests / 15 minutes per IP
- HTTPS enforced in production
- Secrets validated on startup in production mode

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL (Sequelize ORM) |
| Queue | BullMQ (Redis) |
| Auth | Meta OAuth 2.0 + JWT |
| AI | xAI Grok API |
| Images | Unsplash API |
| Containers | Docker Compose |