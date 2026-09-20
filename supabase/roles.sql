-- Application roles are declared here so Supabase local development creates
-- them on `supabase start` / `supabase db reset`, mirroring the roles that
-- production provisioning must create. Passwords are never stored in the
-- repository; the runtime and preview credentials live in environment files.
create role atiny_app_runtime nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role atiny_preview_reader nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;