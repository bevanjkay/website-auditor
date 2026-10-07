# Agent Notes

## Audit engine
- Never declare named functions (incl. `const fn = () =>`) inside a `page.evaluate(() => …)` callback. The worker runs audit-engine *source* via `tsx` (tsconfig `paths` map to `src`), and esbuild's `keepNames` wraps named functions with a `__name` helper that is undefined in the browser, causing `ReferenceError: __name is not defined` at runtime. Use inline expressions or anonymous arrows passed directly to `.map`/`.filter`. This path is not covered by CI (no browsers installed), so verify browser-side changes manually.
- The web app and the worker update the same `audit_runs` row concurrently, so make status changes conditional on the current state (as `startAuditRun` does) rather than blind writes, or a stop can be silently undone.

## Datastore images
- `postgres` and `redis` majors are pinned out of Dependabot in the synced `.github/dependabot.yml` (source of truth: `bevanjkay/.github`), so they never arrive as a PR. Bumping one is a migration, not a tag change: Postgres 18+ puts `PGDATA` at `/var/lib/postgresql/<major>/docker`, so the compose mount has to move to `/var/lib/postgresql` and the existing cluster needs `pg_upgrade` or a dump/restore.
- `scripts/compose-smoke.sh` is the only check that starts `docker-compose.yml`; lint, typecheck, test and build all pass on a stack that cannot boot. CI runs it directly, so it needs no Node setup; `pnpm test:compose` is a local alias for the same script.

## Web app
- Every API route calls `requireUser(event, scope)` (GET routes use `read`) or the session-only `requireSessionUser`/`requireAdmin`; `tests/api-routes.test.ts` enforces this.
- MCP tools in `apps/web/server/mcp` call the REST routes in-process with the caller's token, so scopes are enforced in one place. List every tool in `mcpTools` (`packages/shared/src/mcp.ts`); `tests/mcp.test.ts` checks it against what's registered.
- Nitro reads `defineRouteMeta` statically, so it must be a top-level call whose argument is pure object, array and primitive literals: constants, template literals and spreads are silently dropped from `/_openapi.json`.
- `apps/web/tsconfig.json` does not map Nuxt's `~` alias, so `vue-tsc` fails on `~/…` imports; use relative paths for type imports under `app/`.
- The SPA can be checked visually without Postgres or Redis: run the built `.output/server/index.mjs` with a dummy `DATABASE_URL` and fulfil `/api/**` from fixtures with Playwright route mocking.
