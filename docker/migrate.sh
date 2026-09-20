#!/bin/sh
set -eu

export PGHOST=db
export PGPORT=5432
export PGUSER=postgres
export PGDATABASE=postgres
: "${PGPASSWORD:?PGPASSWORD must match the local database password}"

psql -X -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists extensions;
alter role postgres in database postgres set search_path to "$user", public, extensions;
create schema if not exists app_migrations;
create table if not exists app_migrations.applied (
  filename text primary key,
  applied_at timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;
SQL

for migration in /migrations/*.sql; do
  [ -f "$migration" ] || continue
  filename=${migration##*/}
  applied=$(psql -X -At -v ON_ERROR_STOP=1 -c "select count(*) from app_migrations.applied where filename = '$filename'")
  if [ "$applied" = 0 ]; then
    echo "Applying $filename"
    {
      printf 'begin;\n'
      cat "$migration"
      printf "\ninsert into app_migrations.applied (filename) values ('%s');\ncommit;\n" "$filename"
    } | psql -X -v ON_ERROR_STOP=1
  fi
done
