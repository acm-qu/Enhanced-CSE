# Enhanced CSE Portal

A Next.js web portal for Qatar University's Computer Science and Engineering (CSE) department. It syncs content from the department's WordPress site into a local PostgreSQL database and serves it through a modern web UI and a public REST API.

---

## What It Does

- Pulls **wiki articles** (knowledge base) and **blog posts** from the QU CSE WordPress site every 8 hours via a scheduled job
- Stores content in PostgreSQL for fast, reliable reads
- Serves a **browsable web UI** at `/wiki` and `/posts`
- Exposes a **public REST API** at `/api/v1/` for programmatic access
- Supports manual sync triggering via a protected internal API

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS + shadcn/ui |
| Containerization | Docker + Docker Compose |
| Deployment | Vercel (production) |

---

## Architecture

This is a **monolithic Next.js application** — there is no separate backend service. Everything lives in one codebase:

```text
Browser ──► Next.js App (port 3000)
                │
                ├── /app/              React pages (SSR, force-dynamic)
                ├── /app/api/v1/       Public REST API
                ├── /app/api/internal/ Protected sync endpoints
                └── /lib/              Business logic, DB queries, sync service
                        │
                        └── PostgreSQL (port 54329 on host / 5432 in Docker)
```

Content sync flow:

```text
Scheduler (GitHub Actions / Vercel Cron) ──► POST /api/internal/sync/cron
                                │
                                └── Fetches from WordPress REST API
                                        │
                                        └── Upserts into PostgreSQL
```

---

## Prerequisites

- [Node.js 20+](https://nodejs.org/) and npm — for dev mode
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for running PostgreSQL or the full stack

---

## Setup

### Option A — Dev Mode (recommended for development)

Runs the database in Docker and the Next.js app locally on your machine. Gives you hot-reload and a fast feedback loop.

#### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd Enhanced-CSE
npm install
```

#### 2. Configure environment variables

```bash
cp .env.example .env.local
```

The defaults in `.env.example` work out of the box for local development. You only need to set real values for `SYNC_SECRET` and `CRON_SECRET` (any non-empty string works locally).

#### 3. Start the database

```bash
npm run db:up
```

This starts a PostgreSQL container on port `54329`.

#### 4. Run database migrations

```bash
npm run db:migrate
```

This creates all the required tables. Run this once on first setup, and again whenever new migrations are added (i.e., after pulling changes that include new files in `drizzle/`).

#### 5. Start the dev server

```bash
npm run dev
```

The app is now running at <http://localhost:3000>.

The database will be empty until you trigger a sync — see [Syncing Content](#syncing-content) below.

---

### Option B — Docker App Mode (Neon-ready)

Runs the Next.js app in Docker and connects it to the `DATABASE_URL` in `.env.local` (for Neon or any external PostgreSQL).

#### 1. Clone the repo

```bash
git clone <repo-url>
cd Enhanced-CSE
```

#### 2. Set `DATABASE_URL`

For Neon, set your Neon connection string in `.env.local`.

#### 3. Build and start the app

```bash
docker compose up --build
```

This will:

1. Build the Next.js app into a Docker image
2. Run all database migrations automatically against `DATABASE_URL`
3. Start the production Next.js server

The app is available at <http://localhost:3000>.

To run in the background:

```bash
docker compose up --build -d
docker compose logs -f app   # stream logs
```

To also run the bundled local PostgreSQL service, enable the `local-db` profile:

```bash
docker compose --profile local-db up --build
```

### Docker Compose Watch Mode

For iterative development while staying in Docker, run:

```bash
docker compose up --build --watch
```

Watch behavior is path-aware:

- Frontend/backend app code (`app/`, `components/`, `lib/`) -> rebuild app image
- Static files (`public/`) -> live sync into the running container
- Migration files (`drizzle/`, `drizzle.config.ts`) -> sync + container restart
- Dependency/build config changes (`package*.json`, `next.config.mjs`, etc.) -> rebuild app image

To stop everything:

```bash
docker compose down
```

> **Note on secrets:** `docker-compose.yml` includes default values for `SYNC_SECRET` and `CRON_SECRET` that are fine for local use. For a shared or internet-facing environment, override them with strong random secrets.

---

## Environment Variables

Create `.env.local` by copying `.env.example`:

```bash
cp .env.example .env.local
```

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@127.0.0.1:54329/enhanced_cse` | PostgreSQL connection string |
| `WP_API_BASE` | No | `http://blogs.qu.edu.qa/cse/wp-json/wp/v2` | WordPress REST API base URL |
| `WP_POST_TYPE` | No | `epkb_post_type_1` | WordPress custom post type slug for wiki articles |
| `SYNC_SECRET` | Yes | — | Value expected in the `x-sync-secret` header when triggering a manual sync |
| `CRON_SECRET` | Yes | — | Bearer token for the automated cron endpoint |
| `SYNC_BASE_URL` | No | `http://localhost:3000` | Base URL the `sync:now` script uses to reach the API |
| `SYNC_TIMEOUT_MS` | No | `180000` | How long (ms) `sync:now` waits before timing out (default: 3 min) |
| `SYNC_POLL_MS` | No | `2000` | How often (ms) `sync:now` polls for completion |
| `UPSTASH_REDIS_REST_URL` | No | - | Upstash Redis REST URL (enables distributed API cache + rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | No | - | Upstash Redis REST token |
| `PUBLIC_API_RATE_LIMIT_REQUESTS` | No | `120` | Max requests per window per client IP for `/api/v1/*` |
| `PUBLIC_API_RATE_LIMIT_WINDOW_SECONDS` | No | `60` | Rate-limit window size in seconds |

---

## Syncing Content

The database starts empty. Content is populated by syncing from WordPress.

### Trigger a one-shot sync (with the app running)

```bash
npm run sync:now
```

This calls the sync API, polls until it finishes, and prints a summary. Requires the app to be running and `.env.local` to have `SYNC_SECRET` and `SYNC_BASE_URL` set.

### Trigger via API directly

```bash
curl -X POST http://localhost:3000/api/internal/sync/run \
  -H "x-sync-secret: local-sync-secret"
```

### Check sync status

```bash
curl http://localhost:3000/api/internal/sync/status \
  -H "x-sync-secret: local-sync-secret"
```

In production, schedule calls to `/api/internal/sync/cron` every 8 hours. This repo includes a GitHub Actions workflow for that schedule.

---

## npm Scripts Reference

| Script | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server with hot-reload |
| `npm run build` | Build the app for production |
| `npm run start` | Start the production server (requires a build first) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run typecheck:watch` | Run TypeScript type checking in watch mode |
| `npm run db:up` | Start the PostgreSQL Docker container |
| `npm run db:down` | Stop the PostgreSQL Docker container |
| `npm run db:ps` | Show PostgreSQL container status |
| `npm run db:migrate` | Apply pending database migrations |
| `npm run db:generate` | Regenerate migration files from schema changes |
| `npm run sync:now` | Trigger a full content sync and wait for completion |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

---

## API Endpoints

All public endpoints are read-only and require no authentication.

### API Cache and Rate Limiting

When Upstash Redis credentials are configured, all `/api/v1/*` routes use:

- Response caching in Redis (TTL aligned with each route's `s-maxage`)
- IP-based rate limiting via Upstash Ratelimit (default: `120` requests per `60` seconds)

Responses include:

- `X-Cache: HIT|MISS`
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

### Wiki

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/v1/wiki/articles` | List wiki articles (paginated, filterable) |
| GET | `/api/v1/wiki/articles/:slug` | Get a single wiki article by slug |
| GET | `/api/v1/wiki/categories` | List wiki categories |
| GET | `/api/v1/wiki/tags` | List wiki tags |
| GET | `/api/v1/wiki/meta` | Sync metadata (last sync time, counts) |

### Blog Posts

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/v1/posts` | List blog posts (paginated, filterable) |
| GET | `/api/v1/posts/:slug` | Get a single blog post by slug |
| GET | `/api/v1/posts/categories` | List blog post categories |
| GET | `/api/v1/posts/archives` | List archive months |

### System

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check — DB connectivity and sync freshness |

### Common query parameters for list endpoints

| Parameter | Description | Example |
| --- | --- | --- |
| `page` | Page number | `?page=2` |
| `pageSize` | Items per page (max 100) | `?pageSize=50` |
| `sort` | Sort order | `?sort=modified_desc` |
| `category` | Filter by category slug | `?category=senior-projects` |
| `tag` | Filter by tag slug (wiki only) | `?tag=advising` |
| `month` | Filter by month (posts only) | `?month=2024-09` |

---

## Running Tests

```bash
npm test
```

Tests live in `tests/` and cover:

- `tests/content/html.test.ts` — HTML sanitization and link rewriting
- `tests/api/auth.test.ts` — sync endpoint authentication
- `tests/sync/wp-client.test.ts` — WordPress API client

---

## Project Structure

```text
Enhanced-CSE/
├── app/                    # Next.js pages and API routes
│   ├── api/
│   │   ├── v1/            # Public REST API
│   │   ├── internal/      # Protected sync trigger & status endpoints
│   │   └── health/        # Health check
│   ├── wiki/              # Wiki browser pages
│   ├── posts/             # Blog posts pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # React components (shadcn/ui + custom)
├── lib/
│   ├── db/               # Drizzle schema, queries, migration runner
│   ├── sync/             # Sync orchestration logic
│   ├── wp/               # WordPress REST API client
│   ├── content/          # HTML sanitization and API response transforms
│   └── internal/         # Auth helpers, env loader, HTTP utilities
├── drizzle/              # SQL migration files (auto-applied at startup)
├── scripts/              # sync-now.mjs utility
├── tests/                # Vitest unit tests
├── public/               # Static assets (logos, images)
├── Dockerfile            # Multi-stage Docker build for the app
├── docker-compose.yml    # Starts PostgreSQL + app together
├── .env.example          # Environment variable template — copy to .env.local
├── drizzle.config.ts     # Drizzle ORM configuration
├── next.config.mjs       # Next.js configuration
├── vercel.json           # Vercel project config
└── .github/workflows/    # GitHub Actions schedulers
```

---

## Deployment

The app is designed for deployment on **Vercel**.

1. Push to GitHub and import the repo in [Vercel](https://vercel.com)
2. Set the following environment variables in the Vercel project settings:

   | Variable | Notes |
   | --- | --- |
   | `DATABASE_URL` | Connection string for a production PostgreSQL instance (Neon, Supabase, Railway, etc.) |
   | `SYNC_SECRET` | A strong random string |
   | `CRON_SECRET` | A strong random string |
   | `WP_API_BASE` | WordPress source URL (default is pre-set) |
   | `WP_POST_TYPE` | Custom post type slug (default is pre-set) |

3. Add GitHub Actions repository secrets:

   | Secret | Value |
   | --- | --- |
   | `VERCEL_SYNC_CRON_URL` | `https://<your-app-domain>/api/internal/sync/cron` |
   | `CRON_SECRET` | Same value as the Vercel `CRON_SECRET` environment variable |

4. The workflow at `.github/workflows/sync-cron.yml` triggers sync every 8 hours UTC.

For the production database, run `npm run db:migrate` once pointed at the production `DATABASE_URL` to set up the schema before the first deploy.
