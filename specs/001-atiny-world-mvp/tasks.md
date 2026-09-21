---

description: "Dependency-ordered implementation tasks for ATINY World MVP"
---

# Tasks: ATINY World MVP

**Input**: Design documents from `specs/001-atiny-world-mvp/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `.specify/memory/constitution.md`

**Tests**: Mandatory. The constitution requires Spanish Gherkin or equivalent acceptance coverage before implementation, unit coverage for isolated rules, and integration coverage for database, authorization, concurrency, and external boundaries. Every test task below must be written and observed failing for the intended reason before its corresponding implementation task starts.

**Organization**: Shared infrastructure is followed by one independently testable phase per user story, in specification priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no dependency on another incomplete task in the same phase.
- **[Story]**: User story from `spec.md`.
- Every task includes an exact repository-relative file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the existing Next.js repository for the approved stack without adding product behavior.

- [X] T001 Add exact runtime dependencies `leaflet`, `leaflet.markercluster`, `zod`, `server-only` and `@vercel/config`, plus development dependencies `@types/leaflet`, `@types/leaflet.markercluster` and `@testing-library/user-event`, in `package.json` and `pnpm-lock.yaml`
- [X] T002 [P] Extend server/client environment schemas for the CARTO public key, Geoapify server key, Clerk webhook secret, cron secret and location-selection signing secret without logging their values in `src/server/env.ts` and `.env.example`
- [X] T003 [P] Configure Vitest projects/helpers so `tests/unit`, `tests/integration` and `tests/contract` can run separately against deterministic environments in `vitest.config.mts` and `tests/support/test-env.ts`
- [X] T004 [P] Create the planned module entry points and enforce server-only imports for database, location, message and moderation adapters in `src/domain/index.ts`, `src/server/db/index.ts`, `src/server/locations/index.ts`, `src/server/messages/index.ts` and `src/server/moderation/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish persistence, authorization, shared contracts and privacy controls required by every story.

**Critical**: No user-story implementation begins until this phase passes its tests.

- [X] T005 [P] Write failing PostgreSQL integration tests for private schema ownership, Data API denial, runtime/preview least privilege, FK/index presence and settings defaults `premoderation_enabled=false`, `message_limit=10`, `cooldown_seconds=10` in `tests/integration/db-foundation.test.ts`
- [X] T006 [P] Write failing unit tests for shared roles `fan|admin|owner`, account states `active|deletion_pending`, message states `pending|approved|rejected|withdrawn`, recipient allowlist and stable action error envelopes in `tests/unit/domain/contracts.test.ts`
- [X] T007 Create the versioned PostGIS/private-schema migration in `supabase/migrations/20260915000100_create_app_private_core.sql` with no reaction/like fields and these verbatim field rules from `data-model.md`: `profiles.id` "PK identity"; `profiles.public_id` "único, opaco"; `profiles.clerk_user_id` "único, no nulo mientras la identidad exista"; `profiles.username` "escritura pública original"; `profiles.username_normalized` "normalización canónica, única"; `profiles.display_name` "conserva coreano, espacios y emojis; puede coincidir con `username` y repetirse entre cuentas"; `profiles.role` "`fan`, `admin`, `owner`; default `fan`"; `profiles.account_state` "`active`, `deletion_pending`; default `active`"; `profiles.suspended_at` "nullable"; `profiles.suspension_reason_code` "nullable; código traducible"; `profiles.suspension_note` "nullable, privado"; `profiles.suspended_by` "FK nullable a `profiles.id`, `ON DELETE SET NULL`"; `profiles.last_message_created_at` "nullable; no se borra al eliminar mensajes"; `profiles.created_at`, `profiles.updated_at` "no nulos"; `messages.id` "PK identity"; `messages.public_id` "único, enlace estable"; `messages.author_id` "FK a `profiles.id`; la cuenta se purga en la misma transacción antes de eliminarse"; `messages.version` "no nulo, inicia en 1, `CHECK version > 0`"; `messages.content` "no vacío; máximo 500 grafemas validado en dominio; enlaces no se vuelven clicables"; `messages.recipient` "nullable; `ateez`, ocho miembros o `atiny`"; `messages.status` "`pending`, `approved`, `rejected`, `withdrawn`; inicia `pending`"; `messages.moderation_reason_code` "requerido para rechazo/retirada; privado para autora/admin"; `messages.moderation_note` "nullable, privado para autora/admin"; `messages.location_precision` "`approximate` o `precise`"; `messages.public_point` "único punto persistido; latitud/longitud válidas"; `messages.locality` "nullable, mostrable"; `messages.country` "no nulo, mostrable"; `messages.country_code` "ISO 3166-1 alfa-2 minúscula"; `messages.location_algorithm_version` "requerido en aproximado; estable entre ediciones de texto"; `messages.published_at` "instante de creación; orden público estable"; `messages.created_at`, `messages.updated_at` "no nulos"; `settings.id` "PK, `CHECK id = 1`"; `settings.premoderation_enabled` "default `false`"; `settings.message_limit` "default `10`, positivo"; `settings.cooldown_seconds` "default `10`, no negativo"; `settings.version` "incrementa en cada cambio"; `settings.updated_by` "FK nullable a `profiles`"; `settings.updated_at` "no nulo"
- [X] T008 Create `atiny_app_runtime` and `atiny_preview_reader` as `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, revoke default access from `PUBLIC`, `anon`, `authenticated` and `service_role`, and grant preview only deliberate public projections in `supabase/roles.sql` and `supabase/migrations/20260915000200_harden_database_access.sql`
- [X] T009 Add required unique/FK/GiST/cursor indexes for `profiles(clerk_user_id)`, `profiles(username_normalized)`, `messages(author_id, created_at DESC, id DESC)`, `messages(status, published_at DESC, id DESC)` and `messages.public_point` in `supabase/migrations/20260915000300_add_core_indexes.sql`
- [X] T010 Implement the pooled Postgres.js server singleton with SSL support, prepared statements disabled for Supavisor transaction mode, transaction helpers and no session-level assumptions in `src/server/db/client.ts` and `src/server/db/transaction.ts`
- [X] T011 [P] Implement shared domain types, recipient/state allowlists, UUID/cursor primitives and the serializable `ActionResult`/`Problem` contract in `src/domain/contracts.ts` and `src/server/http/problem.ts`
- [X] T012 Implement Clerk identity-to-profile resolution that rechecks profile completeness, `account_state`, suspension and current role on every protected operation in `src/server/auth/session.ts` and `src/server/auth/authorize.ts`
- [X] T013 [P] Implement strict Zod validation and request-body size/field allowlists for route handlers and Server Actions in `src/server/http/validation.ts` and `src/server/actions/result.ts`
- [X] T014 [P] Implement privacy-safe structured logging/redaction that rejects email, address queries, message text, review evidence, provider payloads and secrets in `src/server/observability/logger.ts` and `tests/unit/server/observability/logger.test.ts`
- [X] T015 Implement a single `src/proxy.ts` callback that preserves Clerk middleware, redirects unprefixed UI routes deterministically to `/en`, leaves APIs unlocalized and performs no PostgreSQL/domain authorization
- [X] T016 [P] Add reusable local PostgreSQL fixture factories and two-connection concurrency helpers without production data in `tests/support/database.ts` and `supabase/seed.sql`
- [X] T017 Run the new foundation tests against a fresh local reset and record role/schema assertions and the expected green outcome in `docs/desarrollo-local.md`

**Checkpoint**: Shared database, contracts, environment validation, authentication boundary and test harness are ready.

---

## Phase 3: User Story 1 — Explorar mensajes en el mapa (Priority: P1) — MVP

**Goal**: Allow an anonymous visitor to explore only visible messages by viewport/filter, traverse clusters in stable order and open a stable public link without disclosure when hidden or deleted.

**Independent Test**: Open the product without a session, exercise clusters and city/country/recipient/fan filters, open a visible message, then request hidden/deleted IDs and verify indistinguishable unavailable responses.

### Tests for User Story 1

- [X] T018 [P] [US1] Write failing Spanish Gherkin scenarios for world map, cluster counts/order, filters, public detail and non-disclosing unavailable links in `tests/bdd/features/explorar-mapa.feature`
- [X] T019 [P] [US1] Write failing unit tests for the canonical visibility matrix across `pending|approved|rejected|withdrawn`, premoderation on/off and active/suspended/deletion-pending profiles in `tests/unit/domain/messages/visibility.test.ts`
- [X] T020 [P] [US1] Write failing OpenAPI contract tests for bbox validation, antimeridian handling, maximum 2,000 map features, stable cursors, `Cache-Control: no-store` and indistinguishable message 404s in `tests/contract/public-map-api.test.ts`
- [X] T021 [P] [US1] Write failing PostgreSQL integration tests proving viewport, filter, group, search and direct-link reads share the same visibility rule and never return hidden text/status/reasons in `tests/integration/public-message-reads.test.ts`
- [X] T022 [P] [US1] Write failing component tests for Leaflet loading state, clustering, spiderfy/fullscreen controls, filter accessibility and unavailable detail state in `tests/unit/components/map/public-map.test.tsx`

### Implementation for User Story 1

- [X] T023 [US1] Implement the pure canonical visibility predicate and public DTO projection with no private state or moderation reason in `src/domain/messages/visibility.ts` and `src/domain/messages/public-message.ts`
- [X] T024 [US1] Implement indexed viewport, stable `(published_at DESC, id DESC)` pagination, public detail and public fan-search queries using the canonical rule in `src/server/messages/public-repository.ts`
- [X] T025 [P] [US1] Implement validated `GET /api/map/features` with bbox/zoom/filter limits, antimeridian support, minimum public fields and `Cache-Control: no-store` in `src/app/api/map/features/route.ts`
- [X] T026 [P] [US1] Implement validated `GET /api/map/messages` with signed cursor, maximum page size 50 and stable order in `src/app/api/map/messages/route.ts`
- [X] T027 [P] [US1] Implement non-disclosing `GET /api/messages/{publicId}` that returns the current visible version or the same 404 for absent/hidden/deleted rows in `src/app/api/messages/[publicId]/route.ts`
- [X] T028 [P] [US1] Implement rate-limited public fan search returning only `publicId`, `username` and `displayName` in `src/app/api/users/search/route.ts`
- [X] T029 [US1] Implement Leaflet as a client-only dynamically loaded adapter with direct CARTO raster tiles, restricted-key configuration, visible `© OpenStreetMap contributors, © CARTO` attribution and no tile proxy/cache in `src/components/map/public-map-loader.tsx` and `src/components/map/leaflet-map.tsx`
- [X] T030 [US1] Implement viewport refresh, bulk marker loading, `leaflet.markercluster` counts/spiderfy and paginated group traversal without downloading all message texts in `src/components/map/public-map-controller.tsx` and `src/components/map/message-cluster-list.tsx`
- [X] T031 [P] [US1] Implement accessible city/country, recipient and fan filter controls that serialize only validated public filter values in `src/components/map/map-filters.tsx`
- [X] T032 [P] [US1] Implement public message detail showing only content, public author name, displayable locality/country and publication date in `src/components/messages/public-message-card.tsx`
- [X] T033 [US1] Assemble the anonymous English homepage in required order—account header, title/introduction, map, publication entry point and disclaimer/contact footer—and add the stable message route that centers/opens the marker in `src/app/[lang]/page.tsx` and `src/app/[lang]/messages/[publicId]/page.tsx`
- [X] T034 [US1] Bind the US1 Gherkin steps to real Route Handlers/components and make the BDD, unit, contract and integration suites pass in `tests/bdd/step_definitions/explorar-mapa.steps.ts`

**Checkpoint**: US1 is a deployable read-only MVP and can be tested without authentication.

---

## Phase 4: User Story 2 — Crear una cuenta y publicar (Priority: P1)

**Goal**: Register with real Clerk, complete a unique local profile, search/confirm a public location and publish a pending message while atomically enforcing the configurable 10-message limit and 10-second cooldown.

**Independent Test**: Create and verify a Clerk account, complete profile, publish approximate and confirmed precise messages, then verify the stable link and actionable blocks for the eleventh message and cooldown.

### Tests for User Story 2

- [X] T035 [P] [US2] Write failing Spanish Gherkin scenarios for registration/profile, approximate/precise publication, stable link, 10-message limit and remaining cooldown display in `tests/bdd/features/crear-cuenta-publicar.feature`
- [X] T036 [P] [US2] Write failing unit tests that accept 500 visible graphemes and reject 501 while treating each composed emoji as one, preserve Korean/newlines exactly, reject attachments and render links as non-clickable text in `tests/unit/domain/messages/message-content.test.ts`
- [X] T037 [P] [US2] Write failing unit tests for coordinate ranges, default `approximate`, explicit precise confirmation and stable per-message approximate offsets from locality center—not a private address—in `tests/unit/domain/location/public-location.test.ts`
- [X] T038 [P] [US2] Write failing contract tests for `POST /api/locations/suggestions`: body-only query of 2–200 characters, language `en|es|ko`, limit 1–8, normalized DTO, short-lived opaque selection and 400/429/502 errors in `tests/contract/location-suggestions-api.test.ts`
- [X] T039 [P] [US2] Write failing two-connection PostgreSQL tests proving all non-deleted states count, concurrent creates cannot exceed 10/cooldown, DB time drives `retryAfterSeconds`, and external HTTP is outside the transaction in `tests/integration/create-message-concurrency.test.ts`
- [X] T040 [P] [US2] Write failing integration tests for verified-email/profile requirements, normalized username uniqueness, Google/password identity linking without duplicate profiles and private email handling in `tests/integration/profile-auth-boundary.test.ts`

### Implementation for User Story 2

- [X] T041 [P] [US2] Implement content validation using grapheme segmentation, exact text preservation, recipient allowlist and non-clickable rendering policy in `src/domain/messages/content.ts`
- [X] T042 [P] [US2] Implement location selection types and a versioned deterministic approximate offset that persists one point per message and validates latitude `[-90,90]`/longitude `[-180,180]` in `src/domain/location/public-point.ts`
- [X] T043 [US2] Implement real Clerk sign-in/sign-up/account UI for verified email, password, Google, recovery and identity linking entry points in `src/app/[lang]/sign-in/[[...sign-in]]/page.tsx`, `src/app/[lang]/sign-up/[[...sign-up]]/page.tsx` and `src/components/account/account-menu.tsx`
- [X] T044 [US2] Implement atomic local profile completion with server-normalized unique username, separately preserved display name, no email persistence and no client-supplied role in `src/server/auth/profiles.ts` and `src/app/[lang]/profile/actions.ts`
- [X] T045 [P] [US2] Implement the Geoapify EU autocomplete adapter with `bias=countrycode:none`, server-only key, provider timeout/error mapping and response field allowlist in `src/server/locations/geoapify.ts`
- [X] T046 [P] [US2] Implement signed, expiring location-selection tokens that contain only normalized public locality/country/point/attribution and never the typed address in `src/server/locations/selection-token.ts`
- [X] T047 [US2] Implement rate-limited `POST /api/locations/suggestions` without query/body logging, returning 5 suggestions by default and provider/source attribution in `src/app/api/locations/suggestions/route.ts`
- [X] T048 [US2] Implement the short publish transaction: lock profile first, reject incomplete/suspended/deletion-pending accounts, read settings, count every existing message, check cooldown with DB time, assign UUID, calculate approximate point once, insert `pending` version 1 and update `last_message_created_at` in `src/server/messages/create-message.ts`
- [X] T049 [US2] Expose `createMessage` with the exact discriminated location payload, precise confirmation, selection-token validation and stable errors `MESSAGE_LIMIT_REACHED`, `MESSAGE_COOLDOWN_ACTIVE`, `PROFILE_INCOMPLETE`, `ACCOUNT_SUSPENDED`, `LOCATION_SELECTION_EXPIRED` in `src/app/[lang]/actions/create-message.ts`
- [X] T050 [P] [US2] Implement debounced/cancellable address search, selection invalidation after text changes, approximate-by-default mode, draggable precise preview and explicit public-point warning in `src/components/map/location-picker.tsx`
- [X] T051 [US2] Implement the accessible publication form, 500-grapheme counter, recipient choice, actionable cooldown and link to «Mis mensajes» at the limit in `src/components/messages/create-message-form.tsx`
- [X] T052 [US2] Refresh the current viewport after successful publication and open the stable link only when the canonical visibility rule permits it in `src/components/messages/create-message-flow.tsx`
- [ ] T053 [US2] Bind the US2 Gherkin steps to the real Clerk test boundary, Geoapify contract double and local PostgreSQL, then make all US2 suites pass in `tests/bdd/step_definitions/crear-cuenta-publicar.steps.ts`

**Checkpoint**: US2 can be demonstrated independently from registration through first publication and both invariant failures.

---

## Phase 5: User Story 3 — Gestionar mensajes propios (Priority: P2)

**Goal**: Let an authenticated owner list every own message, inspect status/reason, locate, edit and physically delete it while preserving link/version/location rules and ownership.

**Independent Test**: From «Mis mensajes», edit text and location in visible/hidden states, reject stale/foreign edits, delete with confirmation and verify the stable link, visibility and released account slot.

### Tests for User Story 3

- [ ] T054 [P] [US3] Write failing Spanish Gherkin scenarios for own-message listing, reasons, locating, text/location edits, physical deletion and rejection of foreign rewrites in `tests/bdd/features/gestionar-mensajes-propios.feature`
- [ ] T055 [P] [US3] Write failing PostgreSQL integration tests for owner-only access, `expectedVersion` conflicts, edit from any state to `pending` with version increment, point preservation/replacement, physical delete, released slot and unchanged cooldown timestamp in `tests/integration/manage-own-messages.test.ts`
- [ ] T056 [P] [US3] Write failing component tests for hidden-state/reason presentation, destructive confirmation and suspended-account delete-only controls in `tests/unit/components/messages/my-messages.test.tsx`

### Implementation for User Story 3

- [ ] T057 [US3] Implement paginated owner-only queries that include all four states and moderation reason without exposing them through public DTOs in `src/server/messages/own-message-repository.ts`
- [ ] T058 [US3] Implement `updateMessage` to lock profile/message, require active unsuspended ownership, compare `expectedVersion`, replace content, optionally replace location, increment version, set `pending`, clear current moderation reason and retain no general history in `src/server/messages/update-message.ts` and `src/app/[lang]/my-messages/actions.ts`
- [ ] T059 [US3] Implement confirmed `deleteMessage` for the owner—including suspended accounts—locking profile first, physically deleting, nulling retained-evidence references and leaving `last_message_created_at` unchanged in `src/server/messages/delete-message.ts` and `src/app/[lang]/my-messages/delete-action.ts`
- [ ] T060 [P] [US3] Implement «Mis mensajes» with stable cursor, state/reason, locate/edit/delete controls and unavailable-link behavior in `src/app/[lang]/my-messages/page.tsx` and `src/components/messages/my-message-list.tsx`
- [ ] T061 [P] [US3] Implement the edit form that preserves the existing point unless location is explicitly changed and never allows an administrator to edit another author’s text in `src/components/messages/edit-message-form.tsx`
- [ ] T062 [US3] Bind the US3 Gherkin steps and make its acceptance, integration and component suites pass in `tests/bdd/step_definitions/gestionar-mensajes-propios.steps.ts`

**Checkpoint**: US3 is independently verifiable with owned, foreign, hidden and deleted messages.

---

## Phase 6: User Story 4 — Pedir revisión de un mensaje (Priority: P2)

**Goal**: Allow an active authenticated fan to request private review of one exact message version without changing its state or visibility, retaining only that private evidence through later edits/deletion.

**Independent Test**: Request review of a visible version, edit/delete the source, verify unchanged public visibility and confirm only an authorized admin can still read the exact private snapshot.

### Tests for User Story 4

- [ ] T063 [P] [US4] Write failing Spanish Gherkin scenarios for «Pedir revisión», unchanged visibility, exact-version evidence, edit/delete survival and anonymous/suspended denial in `tests/bdd/features/pedir-revision.feature`
- [ ] T064 [P] [US4] Write failing unit tests for review states `open|closed`, nullable source references and `purge_at = closed_at + two calendar years` in `tests/unit/domain/moderation/review-request.test.ts`
- [ ] T065 [P] [US4] Write failing PostgreSQL integration tests proving requester/message `ON DELETE SET NULL`, evidence isolation, admin-only reads and no state/visibility side effects in `tests/integration/review-request-privacy.test.ts`

### Implementation for User Story 4

- [ ] T066 [US4] Create `review_requests` and separate `review_evidence` in `supabase/migrations/20260915000400_create_review_requests.sql` with these verbatim field rules from `data-model.md`: `review_requests.id` "PK identity"; `review_requests.public_id` "único; solo visible en administración"; `review_requests.requester_id` "FK nullable a `profiles`, `ON DELETE SET NULL`"; `review_requests.message_id` "FK nullable a `messages`, `ON DELETE SET NULL`"; `review_requests.message_public_id` "snapshot del identificador estable para contexto privado"; `review_requests.message_version` "versión exacta solicitada"; `review_requests.reason` "motivo aportado por la solicitante, privado"; `review_requests.status` "`open` o `closed`"; `review_requests.resolution_code` "nullable; requerido al cerrar si la política lo exige"; `review_requests.resolution_note` "nullable, privado"; `review_requests.closed_by` "FK nullable a `profiles`, `ON DELETE SET NULL`"; `review_requests.created_at`, `review_requests.closed_at` "`closed_at` solo para `closed`"; `review_evidence.review_request_id` "PK y FK a `review_requests`, `ON DELETE CASCADE`"; `review_evidence.content_snapshot` "copia exacta de la versión solicitada"; `review_evidence.author_display_name_snapshot` "contexto mínimo no credencial"; `review_evidence.recipient_snapshot` "nullable"; `review_evidence.location_label_snapshot` "localidad/país mostrable, nunca dirección"; `review_evidence.captured_at` "no nulo"; `review_evidence.purge_at` "`NULL` mientras abierta; al cerrar, dos años naturales después"
- [ ] T067 [US4] Add queue and partial purge indexes `(status, created_at, id)` and `(purge_at) WHERE purge_at IS NOT NULL`, with no preview/Data API grants, in `supabase/migrations/20260915000500_index_review_requests.sql`
- [ ] T068 [P] [US4] Implement review-request domain validation and two-calendar-year expiry calculation in `src/domain/moderation/review-request.ts`
- [ ] T069 [US4] Implement `requestMessageReview` to reauthorize active unsuspended fan access, compare `expectedVersion`, snapshot the exact version atomically and leave message state/visibility untouched in `src/server/moderation/request-review.ts` and `src/app/[lang]/messages/[publicId]/actions.ts`
- [ ] T070 [P] [US4] Implement private admin-only review evidence queries that never serialize to public/preview clients in `src/server/moderation/review-repository.ts`
- [ ] T071 [P] [US4] Add the accessible «Pedir revisión» dialog with required reason and private-action explanation to `src/components/messages/request-review-dialog.tsx`
- [ ] T072 [US4] Bind the US4 Gherkin steps and make its unit/integration/acceptance suites pass in `tests/bdd/step_definitions/pedir-revision.steps.ts`

**Checkpoint**: US4 works without the full admin panel and can be verified through the protected review repository.

---

## Phase 7: User Story 5 — Moderar y administrar el proyecto (Priority: P2)

**Goal**: Give current admins/owner protected queues and version-safe decisions, settings, suspension/role controls and immutable audit history without ever rewriting user text.

**Independent Test**: Exercise all message states and premoderation modes, close a review, reject a stale decision, verify author reasons/audit, and prove only owner can act on administrator roles/suspension.

### Tests for User Story 5

- [ ] T073 [P] [US5] Write failing Spanish Gherkin scenarios for approve/reject/withdraw, stale versions, premoderation impact/change, review closure, suspension, multi-admin restrictions and private audit in `tests/bdd/features/moderar-administrar.feature`
- [ ] T074 [P] [US5] Write failing unit tests for allowed message transitions, required reason codes, bilingual reason allowlists, role matrix and settings-impact calculation without rewriting state/content/location in `tests/unit/domain/moderation/policies.test.ts`
- [ ] T075 [P] [US5] Write failing PostgreSQL integration tests for atomic decision+audit, settings+audit, suspension+audit, version conflicts and owner-only changes affecting admins in `tests/integration/admin-atomicity.test.ts`
- [ ] T076 [P] [US5] Write failing component tests for admin guards, queues, impact preview, required reasons, optional notes and stale-version feedback in `tests/unit/components/admin/admin-panel.test.tsx`

### Implementation for User Story 5

- [ ] T077 [US5] Create immutable `moderation_actions` and `admin_audit` in `supabase/migrations/20260915000600_create_moderation_audit.sql` with these verbatim field rules from `data-model.md`: `moderation_actions.id` "PK identity"; `moderation_actions.actor_id` "FK nullable a `profiles`, `ON DELETE SET NULL`"; `moderation_actions.action` "`approve`, `reject`, `withdraw`, `suspend`, `reinstate`, `close_review`"; `moderation_actions.message_id` "FK nullable a `messages`, `ON DELETE SET NULL`"; `moderation_actions.message_public_id` "nullable, contexto sin texto"; `moderation_actions.message_version` "requerido para decisión de mensaje"; `moderation_actions.subject_profile_id` "FK nullable a `profiles`, `ON DELETE SET NULL`"; `moderation_actions.reason_code` "nullable según acción"; `moderation_actions.note` "nullable, privado"; `moderation_actions.created_at` "inmutable"; `admin_audit.id` "PK identity"; `admin_audit.actor_id` "FK nullable a `profiles`, `ON DELETE SET NULL`"; `admin_audit.action` "código estable"; `admin_audit.target_type` "tipo de objeto"; `admin_audit.target_public_id` "nullable"; `admin_audit.reason_code` "nullable"; `admin_audit.metadata` "allowlist de metadatos no sensibles; nunca texto de mensaje/evidencia/dirección"; `admin_audit.created_at` "inmutable"
- [ ] T078 [US5] Add indexes for moderation queues, actor FKs, audit `(created_at DESC, id DESC)` and `(target_type, target_public_id)` in `supabase/migrations/20260915000700_index_moderation_audit.sql`
- [ ] T079 [P] [US5] Implement bilingual predefined reason codes and pure role/transition policies, including `admin` cannot suspend/demote another admin and only `owner` can act on admins, in `src/domain/moderation/policies.ts` and `src/i18n/moderation-reasons.ts`
- [ ] T080 [US5] Implement `moderateMessage` with current-role recheck, `expectedVersion`, allowed transitions, mandatory rejection/withdrawal reason and same-transaction action/audit in `src/server/moderation/moderate-message.ts` and `src/app/[lang]/admin/messages/actions.ts`
- [ ] T081 [US5] Implement admin review queue/detail and `closeReviewRequest`, setting `closed_at` and `purge_at` atomically without implicitly changing the message in `src/server/moderation/manage-reviews.ts` and `src/app/[lang]/admin/reviews/actions.ts`
- [ ] T082 [US5] Implement premoderation impact calculation and optimistic `updateSettings` for boolean premoderation, positive configurable message limit and non-negative cooldown, with settings+audit atomicity and no message rewrites in `src/server/moderation/settings.ts` and `src/app/[lang]/admin/settings/actions.ts`
- [ ] T083 [US5] Implement `setSuspension` and owner-only `setAdministratorRole` with live role checks, required suspension reason and atomic audit in `src/server/moderation/accounts.ts` and `src/app/[lang]/admin/users/actions.ts`
- [ ] T084 [US5] Implement a server-side admin layout guard that discloses no queue data before authorization in `src/app/[lang]/admin/layout.tsx`
- [ ] T085 [P] [US5] Implement versioned message queue/search and decision controls that never expose an edit-text action in `src/app/[lang]/admin/messages/page.tsx` and `src/components/admin/message-queue.tsx`
- [ ] T086 [P] [US5] Implement review queue/detail with evidence expiry state and separate moderation decision controls in `src/app/[lang]/admin/reviews/page.tsx` and `src/components/admin/review-queue.tsx`
- [ ] T087 [P] [US5] Implement account/role/suspension controls, settings impact confirmation and private audit viewer in `src/app/[lang]/admin/users/page.tsx`, `src/app/[lang]/admin/settings/page.tsx` and `src/app/[lang]/admin/audit/page.tsx`
- [ ] T088 [US5] Surface current rejection/withdrawal reasons only to the author in «Mis mensajes» and refresh every affected public/private view after decisions in `src/components/messages/my-message-list.tsx` and `src/components/admin/admin-refresh.tsx`
- [ ] T089 [US5] Bind the US5 Gherkin steps and make its unit/integration/component/acceptance suites pass in `tests/bdd/step_definitions/moderar-administrar.steps.ts`

**Checkpoint**: US5 provides a complete, auditable and version-safe administration slice.

---

## Phase 8: User Story 6 — Gestionar suspensión y eliminación de cuenta (Priority: P3)

**Goal**: Explain suspension while preserving allowed deletion controls, restore canonical visibility after reinstatement and complete account deletion through an idempotent PostgreSQL→Clerk saga that retains only review evidence for its permitted period.

**Independent Test**: Suspend/reinstate an account, verify permissions/visibility, delete messages while suspended, then delete the account with forced Clerk failure/retry and retained open/closed review evidence.

### Tests for User Story 6

- [ ] T090 [P] [US6] Write failing Spanish Gherkin scenarios for suspension explanation/contact, forbidden operations, allowed deletions, reinstated visibility and pending/completed account deletion in `tests/bdd/features/suspension-eliminacion-cuenta.feature`
- [ ] T091 [P] [US6] Write failing unit tests for deletion job states `pending|processing|completed|failed_retryable`, retry scheduling, lease recovery and Clerk 404-as-success in `tests/unit/domain/accounts/account-deletion.test.ts`
- [ ] T092 [P] [US6] Write failing PostgreSQL integration tests for immediate `deletion_pending` invisibility, message purge, nullable review references, evidence retention, idempotent job upsert/claim and suspended-account allowances in `tests/integration/account-deletion-saga.test.ts`
- [ ] T093 [P] [US6] Write failing contract tests for signed/idempotent Clerk `user.deleted` webhook and bearer-protected aggregate-only deletion retry endpoint in `tests/contract/account-deletion-http.test.ts`

### Implementation for User Story 6

- [ ] T094 [US6] Create `account_deletion_jobs` and content-free `maintenance_runs` in `supabase/migrations/20260915000800_create_account_deletion_jobs.sql` with these verbatim field rules from `data-model.md`: `account_deletion_jobs.id` "PK identity"; `account_deletion_jobs.profile_public_id` "identificador local para trazabilidad privada"; `account_deletion_jobs.clerk_user_id` "único mientras el job exista"; `account_deletion_jobs.status` "`pending`, `processing`, `completed`, `failed_retryable`"; `account_deletion_jobs.attempt_count` "default 0"; `account_deletion_jobs.next_attempt_at` "nullable"; `account_deletion_jobs.claimed_at` "nullable; lease recuperable"; `account_deletion_jobs.last_error_code` "nullable, sin payloads/secretos"; `account_deletion_jobs.created_at`, `account_deletion_jobs.updated_at`, `account_deletion_jobs.completed_at` "según estado"; `maintenance_runs.id` "PK identity"; `maintenance_runs.job_name` "código del job"; `maintenance_runs.started_at`, `maintenance_runs.finished_at` "no nulos al completar"; `maintenance_runs.affected_rows` "no negativo"; `maintenance_runs.status` "`succeeded` o `failed`"; `maintenance_runs.error_code` "nullable"
- [ ] T095 [P] [US6] Implement pure retry/backoff, recoverable claim and terminal-state rules without storing provider payloads in `src/domain/accounts/account-deletion.ts`
- [ ] T096 [US6] Implement local-first account deletion: lock profile, set `deletion_pending`, remove all messages, null allowed review/audit references and upsert the job before commit in `src/server/accounts/request-account-deletion.ts`
- [ ] T097 [US6] Implement the post-commit Clerk deletion adapter and idempotent job processor, treating 404 as complete and retaining a safe retryable error code otherwise, in `src/server/accounts/clerk-deletion.ts` and `src/server/accounts/process-deletion-jobs.ts`
- [ ] T098 [P] [US6] Implement signed, idempotent Clerk webhook reconciliation for external `user.deleted` events in `src/app/api/clerk/webhook/route.ts`
- [ ] T099 [P] [US6] Implement production-only, bearer-protected account-deletion retry handler returning only claimed/completed/retryable counts in `src/app/api/internal/account-deletions/route.ts`
- [ ] T100 [US6] Implement `requestAccountDeletion` with exact `DELETE` confirmation, `completed|pending` result semantics and sign-out only after confirmed identity deletion in `src/app/[lang]/account/delete/actions.ts`
- [ ] T101 [P] [US6] Implement suspension notice with translated reason/contact and controls limited to viewing, deleting own messages and deleting account in `src/components/account/suspension-notice.tsx`
- [ ] T102 [P] [US6] Implement explicit account deletion confirmation and pending-state UI that never claims completion early in `src/app/[lang]/account/delete/page.tsx`
- [ ] T103 [US6] Configure European Node.js Functions and the production-only daily deletion retry cron without granting preview execution in `vercel.ts`
- [ ] T104 [US6] Bind the US6 Gherkin steps and make its unit/integration/contract/acceptance suites pass in `tests/bdd/step_definitions/suspension-eliminacion-cuenta.steps.ts`

**Checkpoint**: US6 is resilient to external deletion failure and preserves only authorized retained evidence.

---

## Phase 9: User Story 7 — Usar el producto en distintos idiomas y dispositivos (Priority: P3)

**Goal**: Complete English/Spanish localization, exact international-text behavior and accessible mobile exploration/publication including fullscreen map exit.

**Independent Test**: Start at English, switch to Spanish while preserving route/resource, publish Korean and composed emoji text unchanged, and complete exploration/publication on a mobile viewport using keyboard/touch accessibility.

### Tests for User Story 7

- [ ] T105 [P] [US7] Write failing Spanish Gherkin scenarios for English default, Spanish switch, Korean/composed emoji preservation and mobile map/publication flows in `tests/bdd/features/idiomas-dispositivos.feature`
- [ ] T106 [P] [US7] Write failing dictionary parity tests requiring every user-facing key and moderation reason in both `en` and `es` with no automatic message translation in `tests/unit/i18n/dictionaries.test.ts`
- [ ] T107 [P] [US7] Write failing responsive/accessibility component tests for focus order, labels, contrast hooks, touch targets, fullscreen escape and 320px viewport overflow in `tests/unit/components/accessibility/mobile-flows.test.tsx`

### Implementation for User Story 7

- [ ] T108 [US7] Implement typed, parity-checked `en`/`es` dictionaries for all public, account, moderation, suspension, validation and error UI while leaving user content untouched in `src/i18n/en.ts`, `src/i18n/es.ts` and `src/i18n/dictionaries.ts`
- [ ] T109 [US7] Implement async `[lang]` validation, English-default redirect, locale-preserving links, canonical/hreflang metadata and language selector in `src/app/[lang]/layout.tsx`, `src/app/layout.tsx` and `src/components/i18n/language-switcher.tsx`
- [ ] T110 [P] [US7] Implement responsive warm visual tokens and page layout with the map as protagonist, no official photos/logos and no horizontal overflow at 320px in `src/app/globals.css`
- [ ] T111 [P] [US7] Implement accessible mobile/fullscreen map focus management, visible close control and restoration of prior focus in `src/components/map/map-fullscreen.tsx`
- [ ] T112 [US7] Audit all message persistence/render boundaries for exact UTF-8 Korean, newlines and composed emoji preservation and add regression coverage in `tests/integration/international-message-roundtrip.test.ts`
- [ ] T113 [US7] Bind the US7 Gherkin steps and make its dictionary/component/integration/acceptance suites pass in `tests/bdd/step_definitions/idiomas-dispositivos.steps.ts`

**Checkpoint**: US7 completes the international and mobile product outcomes without translating user-authored content.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Validate operational safety, performance, privacy, providers and full release criteria across all selected stories.

- [ ] T114 [P] Implement idempotent batched review-evidence purge with `purge_at <= clock_timestamp()`, daily Supabase Cron registration, partial-index use and content-free run metrics in `supabase/migrations/20260915000900_schedule_review_evidence_purge.sql`
- [ ] T115 [P] Add end-to-end real-provider verification for Clerk registration/recovery/Google/linking/deletion, Geoapify EU Korean/international corpus/429 behavior and CARTO key/attribution/no-proxy behavior in `tests/e2e/real-provider-release.spec.ts`
- [ ] T116 [P] Add a database security regression suite proving preview cannot write or read review evidence, audit, suspension details or deletion jobs and runtime cannot assume migration privileges in `tests/integration/database-role-security.test.ts`
- [ ] T117 [P] Add representative-data `EXPLAIN (ANALYZE, BUFFERS)` scripts for viewport, detail, own messages, admin queues and purge, with the p95-under-1-second initial target and evidence-driven index review in `supabase/tests/performance.sql` and `docs/performance.md`
- [ ] T118 [P] Document encrypted rotating logical dumps, explicit `review_evidence` exclusion/expiry decision, role-password rotation after restore, restore drill and immediate post-restore purge in `docs/backup-restore.md`
- [ ] T119 [P] Complete release documentation for real contact email, fan-project disclaimer, privacy disclosure for Geoapify, CARTO free/non-commercial acceptance, domain restrictions, quotas and alert ownership in `docs/release-readiness.md`
- [ ] T120 Add an automated scope/privacy assertion that source, migrations, DTOs and telemetry contain no like/reaction system and no address/evidence/private-email leakage in `tests/integration/scope-privacy-regression.test.ts`
- [ ] T121 Run `pnpm lint`, `pnpm typecheck`, `pnpm test:bdd`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:coverage`, `pnpm build` and `docker compose build`, recording every result or exact remediation in `docs/release-readiness.md`
- [ ] T122 Execute every local and real-provider scenario in `specs/001-atiny-world-mvp/quickstart.md`, verify SC-001 through SC-010, preview read-only permissions and rollback compatibility, and record sign-off in `docs/release-readiness.md`

**Checkpoint**: All required gates are green and evidence supports release; no paid resource or destructive remote operation has been performed without explicit owner authorization.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: no dependencies.
- **Phase 2 — Foundational**: depends on Phase 1 and blocks every story.
- **US1 / Phase 3**: depends only on Foundation; produces the suggested read-only MVP.
- **US2 / Phase 4**: depends on Foundation and integrates with US1 public visibility/link behavior.
- **US3 / Phase 5**: depends on US2 messages/profile; public-link verification uses US1.
- **US4 / Phase 6**: depends on US1 visible messages and US2 authenticated profiles; it does not require the US5 admin UI.
- **US5 / Phase 7**: depends on US2 messages and US4 review storage; author-reason display integrates with US3.
- **US6 / Phase 8**: depends on US3 deletion controls, US4 retained evidence and US5 suspension/role rules.
- **US7 / Phase 9**: can begin after Foundation and then integrate completed UI from US1–US6; final parity testing waits for those strings/screens.
- **Phase 10 — Polish**: depends on all stories selected for release.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1
                    -> US2 -> US3
                         \-> US4 -> US5 -> US6
                    -> US7 (final integration after selected UI stories)
US1 also feeds US2, US3 and US4 public visibility/link checks.
```

### Within Each User Story

1. Add the listed acceptance/unit/contract/integration tests and confirm the expected red state.
2. Apply story-owned migrations/models before repository/service code.
3. Implement pure domain rules before server orchestration.
4. Implement services before Route Handlers/Server Actions.
5. Implement UI after its server contract exists.
6. Bind Gherkin steps and make every story-specific suite green before the checkpoint.

### Parallel Opportunities by Story

- **US1**: T018–T022 can run in parallel; after T024, T025–T028 can run in parallel; T031 and T032 can run in parallel.
- **US2**: T035–T040 can run in parallel; T041/T042/T045/T046 can run in parallel; T050 can proceed beside server transaction work once contracts are stable.
- **US3**: T054–T056 can run in parallel; T060 and T061 can run in parallel after server actions exist.
- **US4**: T063–T065 can run in parallel; T068 and T070/T071 can run in parallel after migrations.
- **US5**: T073–T076 can run in parallel; T079 and the migration work can proceed in parallel; T085–T087 target separate admin pages.
- **US6**: T090–T093 can run in parallel; T095, T098 and T099 target independent files after the schema contract; T101/T102 can run in parallel.
- **US7**: T105–T107 can run in parallel; T110/T111 can run in parallel after dictionary/API contracts settle.

## Parallel Execution Examples

### User Story 1

```text
T018 acceptance scenarios | T019 visibility unit tests | T020 HTTP contracts | T021 DB privacy reads | T022 map components
T025 features handler | T026 group pagination | T027 public detail | T028 fan search
```

### User Story 2

```text
T035 acceptance scenarios | T036 graphemes | T037 public point | T038 Geoapify contract | T039 concurrency | T040 auth boundary
T041 content domain | T042 location domain | T045 provider adapter | T046 selection token
```

### User Story 3

```text
T054 acceptance scenarios | T055 ownership/version integration | T056 component states
T060 own-message list | T061 edit form
```

### User Story 4

```text
T063 acceptance scenarios | T064 retention unit tests | T065 evidence privacy integration
T068 review domain | T070 protected repository | T071 request dialog
```

### User Story 5

```text
T073 acceptance scenarios | T074 policy unit tests | T075 atomicity integration | T076 admin components
T085 messages UI | T086 review UI | T087 users/settings/audit UI
```

### User Story 6

```text
T090 acceptance scenarios | T091 job rules | T092 saga integration | T093 HTTP contracts
T098 Clerk webhook | T099 retry handler | T101 suspension UI | T102 deletion UI
```

### User Story 7

```text
T105 acceptance scenarios | T106 dictionary parity | T107 mobile accessibility
T110 responsive styling | T111 fullscreen focus management
```

## Implementation Strategy

### MVP First — User Story 1

1. Complete Setup and Foundation.
2. Complete US1 test-first.
3. Stop and validate anonymous viewport/filter/cluster/detail/link behavior independently.
4. Deploy only if CARTO, privacy and read-only preview gates for that slice are satisfied.

This read-only MVP proves the central map value. It requires seeded/administratively prepared local test messages, not public publication.

### Incremental Delivery

1. **US1**: anonymous public exploration.
2. **US2**: real identity, profile, geocoding and atomic publication.
3. **US3**: author control over existing messages.
4. **US4**: private review requests and retained evidence.
5. **US5**: complete moderation and administration.
6. **US6**: suspension and resilient account deletion.
7. **US7**: finalize language/mobile coverage across all delivered screens.
8. Run cross-cutting release gates only for the stories intended for that release.

### Checkpoint and Commit Discipline

- A task is complete only after its relevant narrow tests pass; a story is complete only after its whole phase is green.
- Run full repository gates at story checkpoints and before integration.
- Commit after each task or coherent red/green slice, without mixing unrelated user changes.
- Remote migrations, production data operations, paid plans and provider/domain changes require separate explicit authorization.
