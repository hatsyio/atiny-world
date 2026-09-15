-- Seed data for local development.
-- Demo only — no production or PII data.
-- Enabled in supabase/config.toml [db.seed].enabled

insert into app_private.profiles (
  clerk_user_id, username, username_normalized, display_name, role, account_state
) values
  ('owner_demo_001', 'admin', 'admin', 'Demo Owner', 'owner', 'active'),
  ('fan_demo_001', 'atiny_demo', 'atiny_demo', 'ATINY Demo', 'fan', 'active')
on conflict (clerk_user_id) do nothing;

insert into app_private.messages (
  author_id, version, content, recipient, status, location_precision,
  location_algorithm_version,
  public_point, locality, country, country_code, published_at
)
select
  p.id, 1, 'Un mensaje de demo para ATEEZ', 'ateez', 'approved',
  'approximate', 1,
  ST_SetSRID(ST_MakePoint(-3.7033, 40.4167), 4326)::geography,
  'Madrid', 'España', 'es',
  now()
from app_private.profiles p
where p.clerk_user_id = 'fan_demo_001'
on conflict do nothing;