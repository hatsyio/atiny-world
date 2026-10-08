#!/bin/sh
set -eu

# Transition only: translate the old executor's committed filenames into CLI history.
# Never infer applied migrations from tables or mark files that the old history did not record.
query() { psql -X -At -v ON_ERROR_STOP=1 -c "$1"; }
fail() { echo "Migration history requires manual review: $1" >&2; exit 1; }
legacy=$(query "select to_regclass('app_migrations.applied') is not null")
canonical=$(query "select to_regclass('supabase_migrations.schema_migrations') is not null")
if [ "$canonical" = t ]; then
  canonical_versions=$(query 'select version from supabase_migrations.schema_migrations order by version')
else
  canonical_versions=''
fi
if [ "$legacy" = t ]; then
  filenames=$(query 'select filename from app_migrations.applied order by filename')
else
  filenames=''
fi

# A schema without either history cannot safely be treated as an empty database.
if [ -z "$filenames$canonical_versions" ] && [ "$(query "select to_regnamespace('app_private') is not null")" = t ]; then
  fail 'app_private exists but no applied migrations are recorded'
fi

# Reject canonical versions not represented in this checkout before touching either history.
for version in $canonical_versions; do
  case "$version" in *[!0-9]*|'') fail 'invalid canonical version' ;; esac
  set -- supabase/migrations/"${version}"_*.sql
  [ "$#" = 1 ] && [ -f "$1" ] || fail 'canonical versions are unknown or ambiguous'
done

# Validate the complete legacy history before performing any repair.
# The old executor ran files in order: recorded filenames must form a known prefix.
expected=$(find supabase/migrations -maxdepth 1 -name '*.sql' -exec basename {} \; | LC_ALL=C sort)
set --
while IFS= read -r filename; do
  [ -n "$filename" ] || continue
  first=$(printf '%s\n' "$expected" | head -n 1)
  [ "$filename" = "$first" ] || fail 'legacy filenames are unknown, renamed or not a contiguous prefix'
  expected=$(printf '%s\n' "$expected" | sed '1d')
  version=${filename%%_*}
  case "$version" in *[!0-9]*|'') fail 'invalid migration version' ;; esac
  [ "${#version}" = 14 ] || fail 'invalid migration version length'
  if ! printf '%s\n' "$canonical_versions" | grep -Fxq "$version"; then
    set -- "$@" "$version"
  fi
done <<EOF_HISTORY
$filenames
EOF_HISTORY

if [ "$#" -gt 0 ]; then
  supabase migration repair --db-url "$MIGRATION_DATABASE_URL" --status applied "$@"
fi
# Keep app_migrations.applied as an archival record. All future writes belong to the CLI.
