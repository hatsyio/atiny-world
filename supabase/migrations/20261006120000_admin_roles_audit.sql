create table app_private.admin_audit (
  id bigint generated always as identity primary key,
  actor_id bigint references app_private.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_public_id uuid,
  reason_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index admin_audit_created_idx on app_private.admin_audit (created_at desc, id desc);
create index admin_audit_actor_idx on app_private.admin_audit (actor_id);
create index admin_audit_target_idx on app_private.admin_audit (target_type, target_public_id);

-- Override the broad runtime default privileges: audit entries are append-only.
revoke all on app_private.admin_audit from public, anon, authenticated, service_role,
  atiny_preview_reader, atiny_app_runtime;
grant select, insert on app_private.admin_audit to atiny_app_runtime;
grant usage, select on sequence app_private.admin_audit_id_seq to atiny_app_runtime;
comment on table app_private.admin_audit is 'Private append-only administrative history; metadata contains only allowlisted operational values.';
