# Agent Notes

## Audit engine
- Never declare named functions (incl. `const fn = () =>`) inside a `page.evaluate(() => …)` callback. The worker runs audit-engine *source* via `tsx` (tsconfig `paths` map to `src`), and esbuild's `keepNames` wraps named functions with a `__name` helper that is undefined in the browser, causing `ReferenceError: __name is not defined` at runtime. Use inline expressions or anonymous arrows passed directly to `.map`/`.filter`. This path is not covered by CI (no browsers installed), so verify browser-side changes manually.

## Datastore images
- `postgres` and `redis` majors are pinned out of Dependabot in the synced `.github/dependabot.yml` (source of truth: `bevanjkay/.github`), so they never arrive as a PR. Bumping one is a migration, not a tag change: Postgres 18+ puts `PGDATA` at `/var/lib/postgresql/<major>/docker`, so the compose mount has to move to `/var/lib/postgresql` and the existing cluster needs `pg_upgrade` or a dump/restore.
- `pnpm test:compose` is the only check that starts `docker-compose.yml`; lint, typecheck, test and build all pass on a stack that cannot boot.
