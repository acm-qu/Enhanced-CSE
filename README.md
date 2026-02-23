# Enhanced CSE Content Platform

Next.js app that syncs both the WordPress CSE wiki CPT (`epkb_post_type_1`) and main site posts (`posts`) into Postgres, then serves public read APIs and frontend routes.

## Stack

- Next.js App Router (API routes)
- Neon Postgres
- Drizzle ORM + SQL migrations
- Vercel Cron (every 8 hours)
- HTML sanitization with internal-link rewriting

## Environment Variables

Copy `.env.example` to `.env.local`.

- `DATABASE_URL`: Neon PostgreSQL connection string
- `WP_API_BASE`: WordPress API base (default: `http://blogs.qu.edu.qa/cse/wp-json/wp/v2`)
- `WP_POST_TYPE`: CPT slug (default: `epkb_post_type_1`)
- `SYNC_SECRET`: shared secret for manual sync/status routes (`x-sync-secret`)
- `CRON_SECRET`: secret for cron route (`Authorization: Bearer <secret>`)

## Database

Schema files:

- `lib/db/schema.ts`
- `drizzle/0000_initial.sql`
- `drizzle/0001_posts_pipeline.sql`

Start local Postgres with Docker Compose:

- `npm run db:up`
- `npm run db:ps`
- `npm run db:down`

Scripts:

- `npm run db:generate`
- `npm run db:migrate`

## Run

1. Install dependencies: `npm install`
2. Run migrations: `npm run db:migrate`
3. Start dev server: `npm run dev`

## Public API

- `GET /api/v1/wiki/articles?page=1&pageSize=20&category=<slug>&tag=<slug>&sort=modified_desc`
- `GET /api/v1/wiki/articles/[slug]`
- `GET /api/v1/wiki/categories`
- `GET /api/v1/wiki/tags`
- `GET /api/v1/wiki/meta`
- `GET /api/v1/posts?page=1&pageSize=20&category=<slug>&month=YYYY-MM&sort=published_desc`
- `GET /api/v1/posts/[slug]`
- `GET /api/v1/posts/categories`
- `GET /api/v1/posts/archives?category=<slug>`
- `GET /api/health`

## Internal Sync API

- `POST /api/internal/sync/run` with header `x-sync-secret: <SYNC_SECRET>`
- `GET /api/internal/sync/status` with header `x-sync-secret: <SYNC_SECRET>`
- `GET /api/internal/sync/cron` with header `Authorization: Bearer <CRON_SECRET>`

## Manual Sync Script

Run full local sync flow (trigger, wait, verify):

- `npm run sync:now`

The script:

- Calls `POST /api/internal/sync/run`.
- Polls `GET /api/internal/sync/status` until the run is terminal.
- Prints `GET /api/v1/wiki/meta`, `GET /api/health`, plus wiki/post totals.

Optional overrides:

- `SYNC_BASE_URL` (default: `http://localhost:3000`)
- `SYNC_TIMEOUT_MS` (default: `180000`)
- `SYNC_POLL_MS` (default: `2000`)

## Sync Behavior

- Acquires PostgreSQL advisory lock to prevent concurrent syncs.
- Discovers taxonomy support from WordPress type endpoint.
- Full snapshot sync each run (`per_page=100`, paginated).
- Runs two phases in one run: wiki phase then posts phase.
- Upserts terms and content records for both datasets.
- Rebuilds wiki/article-term and post/category joins.
- Hard-deletes local rows missing in upstream only after each phase completes successfully.
- Stores raw source HTML; sanitizes and rewrites internal links when serving API responses.

## Tests

- `tests/content/html.test.ts`
- `tests/api/auth.test.ts`
- `tests/sync/wp-client.test.ts`

Run: `npm test`

## Vercel Cron

`vercel.json` schedules `/api/internal/sync/cron` every 8 hours (`0 */8 * * *`, UTC).
