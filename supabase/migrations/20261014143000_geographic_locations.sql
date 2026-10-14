-- Shared geographic metadata; private backend access, no raw provider responses.
create table app_private.geographic_locations (
  identity text primary key,
  kind text not null check (kind in ('country', 'city')),
  name text not null,
  normalized_name text not null,
  country text not null,
  country_code text not null check (country_code ~ '^[a-z]{2}$'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  west double precision, south double precision, east double precision, north double precision,
  provider_id text,
  provider text not null check (provider = 'Geoapify'),
  attribution text not null,
  obtained_at timestamptz not null,
  check ((west is null and south is null and east is null and north is null) or
    (west is not null and south is not null and east is not null and north is not null and
     west between -180 and 180 and east between -180 and 180 and west < east and
     south between -90 and 90 and north between -90 and 90 and south < north)),
  check (kind <> 'country' or west is not null)
);
create index geographic_locations_lookup on app_private.geographic_locations (kind, normalized_name, country_code);
create unique index geographic_locations_country on app_private.geographic_locations (country_code) where kind = 'country';
create unique index geographic_locations_provider on app_private.geographic_locations (provider, kind, provider_id) where provider_id is not null;
revoke all on app_private.geographic_locations from public, anon, authenticated, service_role, atiny_preview_reader;
revoke all on app_private.geographic_locations from atiny_app_runtime;
grant select, insert on app_private.geographic_locations to atiny_app_runtime;
