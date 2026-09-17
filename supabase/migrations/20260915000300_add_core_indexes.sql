-- Core index set for the initial read paths. Unique constraints for
-- profiles(public_id), profiles(clerk_user_id), profiles(username_normalized)
-- and messages(public_id) are created with the tables in
-- 20260915000100_create_app_private_core.sql and are NOT repeated here.

set search_path to app_private;

-- FK support: suspended_by references profiles.id
create index profiles_suspended_by_idx
  on app_private.profiles (suspended_by);

-- Own-message pagination and edit/delete lookups.
create index messages_author_created_idx
  on app_private.messages (author_id, created_at desc, id desc);

-- Public traversal by status with a stable cursor order.
create index messages_status_published_idx
  on app_private.messages (status, published_at desc, id desc);

-- Viewport bound reads on the persisted public point.
create index messages_public_point_gix
  on app_private.messages
  using gist (public_point);

-- settings.updated_by FK support
create index settings_updated_by_idx
  on app_private.settings (updated_by);