#!/usr/bin/env bash
#
# Smoke test for docker-compose.yml. Starts the datastores, writes a marker to
# each, recreates the containers, and reads the marker back. That round-trip is
# the assertion: it proves the data really lands in the named volumes rather
# than somewhere inside the image layer.
#
# Why this exists: a datastore image bump is a one-line diff, and nothing else
# in CI starts docker-compose.yml, so lint, typecheck, test and build all pass
# on a stack that cannot boot. postgres:18 is the case that prompted this --
# it moved PGDATA to /var/lib/postgresql/<major>/docker, which makes the mount
# at /var/lib/postgresql/data silently the wrong path.
#
# Bash rather than .mjs like the other scripts here: this is a pipeline of
# docker CLI calls with no parsing logic, which Node would only wrap in
# execSync.
#
# Runs under a project name unique to the invocation, so the `down -v` in the
# cleanup trap can only ever reach this run's own volumes -- never those of a
# real local stack, and never those of a concurrent run of this script.

set -euo pipefail

readonly PROJECT="website-auditor-smoke-$$"
readonly TOKEN="smoke-${RANDOM}${RANDOM}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Everything here talks to the containers through `compose exec`, so the test
# needs no published ports -- and publishing them would make it collide with a
# real local stack already holding 5432 and 6379. Note that `ports: []` does not
# clear them: compose concatenates sequence fields across files, so the mapping
# survives. `!reset` is the tag that actually drops it, confirmed against
# `docker compose config`.
TMPDIR_SMOKE="$(mktemp -d)"
readonly TMPDIR_SMOKE
readonly OVERRIDE="${TMPDIR_SMOKE}/compose-smoke-override.yml"
cat > "${OVERRIDE}" <<'YAML'
services:
  postgres:
    ports: !reset []
  redis:
    ports: !reset []
YAML

compose() {
  docker compose -p "${PROJECT}" -f docker-compose.yml -f "${OVERRIDE}" "$@"
}

# psql, resolving the credentials from the container's own environment so the
# script stays correct whatever .env sets POSTGRES_USER and POSTGRES_DB to.
psql_c() {
  # shellcheck disable=SC2016 # Single quotes are intentional: the container's
  # shell expands POSTGRES_USER and POSTGRES_DB, not ours.
  compose exec -T postgres sh -c \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1"' sh "$1" |
    tr -d '\r' | tr -d '[:space:]'
}

redis_c() {
  compose exec -T redis redis-cli "$@" | tr -d '\r' | tr -d '[:space:]'
}

# web and worker declare `env_file: .env`, which compose resolves for the whole
# file even when only the datastores are started. .env is gitignored, so CI has
# none.
created_env=false
if [[ ! -f .env ]]; then
  : > .env
  created_env=true
fi

# shellcheck disable=SC2329 # Invoked indirectly, by the EXIT trap below.
cleanup() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "${TMPDIR_SMOKE}"
  if [[ "${created_env}" == true ]]; then
    rm -f .env
  fi
}
trap cleanup EXIT

start() {
  if ! compose up -d --wait postgres redis; then
    echo "FAIL: the datastores did not come up healthy." >&2
    compose logs --no-color --tail 40 postgres redis >&2
    exit 1
  fi
}

echo "==> Starting datastores"
start

echo "==> Writing markers"
psql_c "CREATE TABLE IF NOT EXISTS compose_smoke (token text PRIMARY KEY)" >/dev/null
psql_c "INSERT INTO compose_smoke (token) VALUES ('${TOKEN}')" >/dev/null
redis_c SET compose_smoke "${TOKEN}" >/dev/null
# Explicit SAVE so the assertion does not depend on redis's background save
# points firing inside the life of this test.
redis_c SAVE >/dev/null

echo "==> Recreating containers, keeping volumes"
compose down
start

echo "==> Verifying"
failures=0

# Filtered to this run's token rather than selecting the table: a row left by
# an interrupted earlier run would otherwise concatenate into the comparison and
# report a token that did persist as lost.
postgres_token="$(psql_c "SELECT token FROM compose_smoke WHERE token = '${TOKEN}'" || true)"
if [[ "${postgres_token}" == "${TOKEN}" ]]; then
  echo "PASS: postgres data survived in the named volume"
else
  echo "FAIL: postgres lost its data across a container recreation." >&2
  echo "      expected '${TOKEN}', read '${postgres_token}'" >&2
  echo "      The volume is probably not mounted at the image's PGDATA." >&2
  failures=$((failures + 1))
fi

redis_token="$(redis_c GET compose_smoke || true)"
if [[ "${redis_token}" == "${TOKEN}" ]]; then
  echo "PASS: redis data survived in the named volume"
else
  echo "FAIL: redis lost its data across a container recreation." >&2
  echo "      expected '${TOKEN}', read '${redis_token}'" >&2
  failures=$((failures + 1))
fi

exit "${failures}"
