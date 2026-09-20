create extension if not exists postgis with schema extensions;

create schema if not exists app_private;

set search_path to app_private, extensions;

create table app_private.profiles (
  id bigint generated always as identity primary key,
  public_id uuid not null unique default gen_random_uuid(),
  clerk_user_id text not null unique,
  username text not null,
  username_normalized text not null unique,
  display_name text not null,
  role text not null default 'fan'
    check (role in ('fan', 'admin', 'owner')),
  account_state text not null default 'active'
    check (account_state in ('active', 'deletion_pending')),
  suspended_at timestamptz,
  suspension_reason_code text,
  suspension_note text,
  suspended_by bigint references app_private.profiles (id) on delete set null,
  last_message_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (suspended_at is null or suspension_reason_code is not null)
);

create table app_private.messages (
  id bigint generated always as identity primary key,
  public_id uuid not null unique default gen_random_uuid(),
  author_id bigint not null references app_private.profiles (id),
  version integer not null default 1 check (version > 0),
  content text not null check (length(btrim(content)) > 0),
  recipient text
    check (recipient is null or recipient in (
      'ateez', 'hongjoong', 'seonghwa', 'yunho', 'yeosang',
      'san', 'mingi', 'wooyoung', 'jongho', 'atiny'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  moderation_reason_code text,
  moderation_note text,
  location_precision text not null
    check (location_precision in ('approximate', 'precise')),
  public_point extensions.geography(point, 4326) not null,
  locality text,
  country text not null,
  country_code text not null
    check (country_code ~ '^[a-z]{2}$'),
  location_algorithm_version integer,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status not in ('rejected', 'withdrawn') or moderation_reason_code is not null
  ),
  check (
    location_precision = 'precise' or location_algorithm_version is not null
  ),
  check (
    st_x(public_point::geometry) between -180 and 180
    and st_y(public_point::geometry) between -90 and 90
  )
);

comment on column app_private.profiles.suspension_note is 'privado';
comment on column app_private.messages.moderation_note is 'privado para autora y administración';
comment on column app_private.messages.moderation_reason_code is 'privado para autora y administración';

create table app_private.settings (
  id smallint primary key check (id = 1),
  premoderation_enabled boolean not null default false,
  message_limit integer not null default 10 check (message_limit > 0),
  cooldown_seconds integer not null default 10 check (cooldown_seconds >= 0),
  version integer not null default 1,
  updated_by bigint references app_private.profiles (id),
  updated_at timestamptz not null default now()
);

insert into app_private.settings (id)
values (1);

alter table app_private.profiles
  add constraint profiles_no_simultaneous_suspension_and_deletion
  check (not (account_state = 'deletion_pending' and suspended_at is not null));