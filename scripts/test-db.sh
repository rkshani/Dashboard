#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres and runs the SQL checks in supabase/tests.
# Needs PostgreSQL 15+ installed locally (initdb / pg_ctl / psql). Usage: npm run test:db
set -euo pipefail
BIN="${PG_BIN:-$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DIR="$(mktemp -d)"; PORT="${PG_PORT:-5499}"
cleanup() { "$BIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
"$BIN/initdb" -D "$DIR/data" -A trust >/dev/null
"$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR" -l "$DIR/log" start >/dev/null
PSQL=(psql -h "$DIR" -p "$PORT" -U "$(whoami)" -d postgres -v ON_ERROR_STOP=1 -q -t -A)
"${PSQL[@]}" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f" 2>&1 | grep -v NOTICE || true; done
for f in supabase/tests/[1-9]*.sql; do echo "== $f"; psql -h "$DIR" -p "$PORT" -U "$(whoami)" -d postgres -q -t -A -f "$f" 2>&1 | grep -v '^$'; done
