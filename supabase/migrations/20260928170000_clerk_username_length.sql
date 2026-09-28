-- Clerk usernames can be up to 64 characters. Preserve existing display names
-- while accepting every username allowed by the connected Clerk instance.
alter table app_private.profiles
  drop constraint profiles_display_name_not_blank,
  add constraint profiles_display_name_not_blank
  check (length(btrim(display_name)) between 1 and 64);
