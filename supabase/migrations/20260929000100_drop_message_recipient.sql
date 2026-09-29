drop view preview_api.public_messages;

alter table app_private.messages
  drop column recipient;

create view preview_api.public_messages with (security_invoker = false) as
select
  m.public_id,
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
where p.account_state = 'active' and p.suspended_at is null
  and (m.status = 'approved' or (m.status = 'pending' and not exists (
    select 1 from app_private.settings s where s.id = 1 and s.premoderation_enabled
  )));

revoke all on preview_api.public_messages from public, anon, authenticated, service_role;
grant select on preview_api.public_messages to atiny_preview_reader;
