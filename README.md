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
- `MCP_DISABLED`: Set to `true` to turn the MCP server off entirely, so administrators can't turn it on in the web app.

## Notes

- The web service bootstraps the first admin user automatically if no admin exists.
- At this stage, registration is intentionally disabled.
- Websites are shared across all authenticated users in the installation.
- Audit history is retained per website for comparison and troubleshooting.

## API

Scripts, CI jobs and MCP clients can use the same HTTP API as the web app with an API token. The API is unstable before 1.0 and may change between releases.

1. Create a token from **API tokens** in the sidebar. It's only shown once, so store it somewhere safe.
2. Send it as a bearer token, for example to start an audit:

   ```bash
   curl -X POST -H "Authorization: Bearer $WEBSITE_AUDITOR_TOKEN" \
     https://auditor.example.com/api/websites/<website-id>/audits
   ```

3. Poll `GET /api/audits/<audit-id>` until `status` is no longer `queued` or `running`. Starting another audit for the same website responds `409` until then.

Each token is limited to the scopes chosen when it's created:

| Scope | Allows |
| --- | --- |
| `read` | Viewing websites, audits and their results |
| `audit:run` | Starting and stopping audits |
| `websites:write` | Adding and editing websites, allowing typo words and ignoring broken links (administrators only) |

Tokens act as the user who created them, stop working when that user is disabled, and can't manage users or other tokens. The OpenAPI description is served at `/_openapi.json`.

## MCP server

The web service includes an [MCP](https://modelcontextprotocol.io) server at `/mcp`, so AI assistants such as Claude Code can look up results, start audits and clear false positives. It's off until an administrator turns it on from **MCP server** in the sidebar, which also has setup instructions for Claude Code, Claude Desktop, Cursor, VS Code and Codex.

Clients authenticate with an API token and only see the tools its scopes allow. For example, with Claude Code:

```bash
claude mcp add --transport http --scope user website-auditor https://auditor.example.com/mcp \
  --header "Authorization: Bearer $WEBSITE_AUDITOR_TOKEN"
```

Clients that can only sign in with OAuth, such as claude.ai connectors, aren't supported yet.

## Backups

Persist these volumes:

- `postgres-data`
- `redis-data`

Redis only holds job state and can be recreated, but persisting it avoids dropping queued work during restarts.
