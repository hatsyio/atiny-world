-- NULL means no product preference yet: adopt an anonymous visitor's manual
-- selection on first login. 'auto' is explicit and always negotiates the browser.
alter table app_private.profiles
  add column language_preference text
  constraint profiles_language_preference_valid
  check (language_preference in ('auto', 'en', 'es'));

comment on column app_private.profiles.language_preference is
  'Reader interface language; NULL until first adoption, auto follows Accept-Language. Never translates letters.';
