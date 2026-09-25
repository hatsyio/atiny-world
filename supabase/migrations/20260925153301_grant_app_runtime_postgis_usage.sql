-- PostGIS functions live in extensions. Runtime queries call them without a
-- schema prefix, so the application role needs USAGE on this schema.
-- This grants no CREATE privilege and no access to application tables.
grant usage on schema extensions to atiny_app_runtime;
