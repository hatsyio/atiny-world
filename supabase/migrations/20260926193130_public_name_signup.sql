-- Preserve historical usernames while allowing new profiles to use a single,
-- non-unique public name. Existing public UUIDs and message FKs stay intact.
alter table app_private.profiles
  alter column username drop not null,
  alter column username_normalized drop not null;

alter table app_private.profiles
  drop constraint if exists profiles_username_normalized_key;

alter table app_private.profiles
  add constraint profiles_display_name_not_blank
  check (length(btrim(display_name)) between 1 and 50);

create index if not exists profiles_display_name_search_idx
  on app_private.profiles (lower(display_name));

drop view preview_api.public_messages;
create view preview_api.public_messages with (security_invoker = false) as
select
  m.public_id, m.recipient, m.location_precision, m.locality, m.country,
  m.country_code, m.published_at, p.public_id as author_public_id,
  p.display_name
from app_private.messages m
join app_private.profiles p on p.id = m.author_id
where p.account_state = 'active' and p.suspended_at is null
  and (m.status = 'approved' or (m.status = 'pending' and not exists (
    select 1 from app_private.settings s where s.id = 1 and s.premoderation_enabled
  )));

revoke all on preview_api.public_messages from public, anon, authenticated, service_role;
grant select on preview_api.public_messages to atiny_preview_reader;
