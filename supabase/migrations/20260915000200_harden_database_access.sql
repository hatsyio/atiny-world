-- Harden database access: only the application runtime touches app_private,
-- and previews only read deliberate public projections through preview_api.
-- Any rollback of this migration must be preceded by confirming no live
-- deployment depends on the revoked privileges.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'atiny_app_runtime') then
    create role atiny_app_runtime nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'atiny_preview_reader') then
    create role atiny_preview_reader nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

-- app_private is invisible by default, but this makes the intent explicit and
-- protects every object even if future default privileges change.
revoke all on schema app_private from public;
revoke all on schema app_private from anon, authenticated, service_role;
revoke all on all tables in schema app_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema app_private from public, anon, authenticated, service_role;
revoke all on all functions in schema app_private from public, anon, authenticated, service_role;

alter default privileges in schema app_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema app_private revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema app_private revoke all on functions from public, anon, authenticated, service_role;

-- Runtime role: data access for the Next.js backend only. No DDL, no role
-- management, no bypassing row-level security.
grant usage on schema app_private to atiny_app_runtime;

grant select, insert, update, delete
  on app_private.profiles, app_private.messages, app_private.settings
  to atiny_app_runtime;

grant usage, select on all sequences in schema app_private to atiny_app_runtime;

alter default privileges in schema app_private
  grant select, insert, update, delete on tables to atiny_app_runtime;

alter default privileges in schema app_private
  grant usage, select on sequences to atiny_app_runtime;

-- The migration/bootstrap role keeps membership so local and remote
-- environments can verify least privilege with `set role` and so restores can
-- be audited directly. The application never connects as this role.
-- The bootstrapping user (postgres locally, the migration user remotely) owns
-- every object in app_private already; membership solely lets migrations,
-- restore drills and tests verify least privilege with `set local role`.
grant atiny_app_runtime to postgres;
grant atiny_preview_reader to postgres;


-- Preview role: read-only, and only through an allowlisted public projection.
-- It has no privileges over app_private itself.
create schema if not exists preview_api;

revoke all on schema preview_api from public;
revoke all on schema preview_api from anon, authenticated, service_role;
revoke all on all tables in schema preview_api from public, anon, authenticated, service_role;

grant usage on schema preview_api to atiny_preview_reader;

create view preview_api.public_messages with (security_invoker = false) as
select
  m.public_id,
  m.recipient,
  m.location_precision,
  m.locality,
  m.country,
  m.country_code,
  m.published_at,
  p.public_id as author_public_id,
  p.username,
  p.display_name
from app_private.messages m
join app_private.profiles p on p.id = m.author_id
where p.account_state = 'active'
  and p.suspended_at is null
  and (
    m.status = 'approved'
    or (
      m.status = 'pending'
      and not exists (
        select 1
        from app_private.settings s
        where s.id = 1
          and s.premoderation_enabled
      )
    )
  );

revoke all on preview_api.public_messages from public, anon, authenticated, service_role;
grant select on preview_api.public_messages to atiny_preview_reader;

alter default privileges in schema preview_api
  revoke all on tables from public, anon, authenticated, service_role;