#!/bin/sh
set -eu

# This runner is exclusively for Compose's local PostgreSQL, never the linked project.
export PGHOST=db PGPORT=5432 PGUSER=postgres
export PGDATABASE=${PGDATABASE:-postgres}
: "${PGPASSWORD:?PGPASSWORD must match the local database password}"
export MIGRATION_DATABASE_URL="postgresql://postgres:postgres@db:5432/$PGDATABASE?sslmode=disable"

/bin/sh /runner/reconcile-migrations.sh
psql -X -v ON_ERROR_STOP=1 -f /runner/bootstrap-db.sql
exec supabase migration up --db-url "$MIGRATION_DATABASE_URL"
