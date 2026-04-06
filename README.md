# Website Auditor

**This project is under active development and may introduce breaking changes between releases.**

Website Auditor is a self-hosted Docker service for developers to inspect their site performance and receive crawl-based SEO and quality checks for public websites. Users can add a site, trigger an audit, inspect broken links, sitemap coverage, typo findings, and SEO issues, and review full audit history over time.

## Stack

- Nuxt 3 + Vue 3 frontend and HTTP API
- TypeScript monorepo managed with `pnpm`
- PostgreSQL via Drizzle ORM
- BullMQ + Redis for audit jobs
- Playwright for browser-rendered crawling

## Getting Started

The standard install path is Docker Compose using [docker-compose.yml](./docker-compose.yml).

1. Copy `.env.example` to `.env` and set `SESSION_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.
2. Start the stack with `docker compose up -d`.
3. Open `http://localhost:3000`.
4. Log in with the bootstrap admin credentials from `.env`.

## Local Development

To build and run the stack from source locally, use the development override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Environment Variables

- `WEB_IMAGE`: Optional override for the deployed web image. Defaults to `ghcr.io/bevankay/website-auditor-web:latest`.
- `WORKER_IMAGE`: Optional override for the deployed worker image. Defaults to `ghcr.io/bevankay/website-auditor-worker:latest`.
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string.
- `SESSION_SECRET`: Cookie signing secret.
- `ADMIN_USERNAME`: Username for the initial admin account.
- `ADMIN_PASSWORD`: Password for the initial admin account.
- `AUDIT_MAX_PAGES`: Crawl page budget per run.
- `AUDIT_MAX_DEPTH`: Maximum crawl depth.
- `AUDIT_PAGE_TIMEOUT_MS`: Page render timeout in milliseconds.
- `AUDIT_BROWSER_CONCURRENCY`: Concurrent browser page renders.
- `AUDIT_LINK_CONCURRENCY`: Concurrent link checks.

## Notes

- The web service bootstraps the first admin user automatically if no admin exists.
- At this stage, registration is intentionally disabled.
- Websites are shared across all authenticated users in the installation.
- Audit history is retained per website for comparison and troubleshooting.

## Backups

Persist these volumes:

- `postgres-data`
- `redis-data`

Redis only holds job state and can be recreated, but persisting it avoids dropping queued work during restarts.
