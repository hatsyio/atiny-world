-- Private decisions; text remains exclusively in messages, never in admin_audit.
create table app_private.moderation_actions (
  id bigint generated always as identity primary key,
  actor_id bigint references app_private.profiles (id) on delete set null,
  action text not null check (action in ('approve', 'reject', 'withdraw', 'suspend', 'reinstate', 'close_review')),
  message_id bigint references app_private.messages (id) on delete set null,
  message_public_id uuid,
  message_version integer check (message_version > 0),
  subject_profile_id bigint references app_private.profiles (id) on delete set null,
  reason_code text,
  note text check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  check (action not in ('approve', 'reject', 'withdraw') or (message_version is not null and message_public_id is not null)),
  check (action not in ('reject', 'withdraw', 'suspend') or reason_code is not null)
);

create index moderation_actions_actor_idx on app_private.moderation_actions (actor_id);
create index moderation_actions_message_idx on app_private.moderation_actions (message_id);
create index moderation_actions_subject_idx on app_private.moderation_actions (subject_profile_id);
-- Existing messages_status_published_idx and admin_audit indexes serve the queue/history.

revoke all on app_private.moderation_actions from public, anon, authenticated, service_role,
  atiny_preview_reader, atiny_app_runtime;
grant select, insert on app_private.moderation_actions to atiny_app_runtime;
grant usage, select on sequence app_private.moderation_actions_id_seq to atiny_app_runtime;
comment on table app_private.moderation_actions is 'Private append-only decisions about exact message versions; notes visible only to author/admin.';
