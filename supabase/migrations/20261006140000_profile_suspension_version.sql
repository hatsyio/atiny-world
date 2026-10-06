-- Independent version prevents stale suspension forms after suspend/reinstate cycles.
alter table app_private.profiles add column suspension_version integer not null default 1 check (suspension_version > 0);

create function app_private.advance_profile_suspension_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.suspended_at is distinct from old.suspended_at
     or new.suspension_reason_code is distinct from old.suspension_reason_code
     or new.suspension_note is distinct from old.suspension_note
     or new.suspended_by is distinct from old.suspended_by then
    new.suspension_version := old.suspension_version + 1;
  else
    new.suspension_version := old.suspension_version;
  end if;
  return new;
end;
$$;

revoke all on function app_private.advance_profile_suspension_version() from public, anon, authenticated, service_role;
create trigger profiles_suspension_version before update on app_private.profiles
for each row execute function app_private.advance_profile_suspension_version();
