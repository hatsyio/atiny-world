alter table app_private.profiles add column role_version integer not null default 1 check (role_version > 0);

create function app_private.advance_profile_role_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    new.role_version := old.role_version + 1;
  else
    new.role_version := old.role_version;
  end if;
  return new;
end;
$$;

revoke all on function app_private.advance_profile_role_version() from public, anon, authenticated, service_role;
create trigger profiles_role_version before update on app_private.profiles
for each row execute function app_private.advance_profile_role_version();
