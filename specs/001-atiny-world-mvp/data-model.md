# Data Model: ATINY World MVP

## Conventions

- Todas las entidades viven en `app_private`; ninguna tabla de producto se expone por Data API.
- PK interna: `bigint generated always as identity`. Recursos enlazables: `public_id uuid default gen_random_uuid()` con `UNIQUE`.
- Fechas: `timestamptz` con hora de PostgreSQL. Texto: UTF-8/PostgreSQL `text`; la longitud en grafemas se valida en dominio.
- Estados y roles: `text` con `CHECK`, no enums. FK indexadas. Borrados físicos cuando el producto dice «eliminar».
- El backend usa IDs internos; el navegador solo recibe IDs opacos o cursores firmados.
- No existen tablas, columnas, contadores ni eventos de «Me gusta» o reacciones.

## Canonical visibility rule

Un mensaje es público si y solo si:

```text
profile.account_state = 'active'
AND profile.suspended_at IS NULL
AND (
  message.status = 'approved'
  OR (message.status = 'pending' AND settings.premoderation_enabled = false)
)
```

`rejected` y `withdrawn` nunca son públicos. Todas las lecturas públicas —viewport, filtros, grupos, ficha y enlace— llaman la misma consulta/predicado de servidor.

## Entities

### `profiles`

Perfil de producto; Clerk conserva credenciales y correo.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | bigint | PK identity |
| `public_id` | uuid | único, opaco |
| `clerk_user_id` | text | único, no nulo mientras la identidad exista |
| `username` | text | escritura pública original |
| `username_normalized` | text | normalización canónica, única |
| `display_name` | text | conserva coreano, espacios y emojis; puede coincidir con `username` y repetirse entre cuentas |
| `role` | text | `fan`, `admin`, `owner`; default `fan` |
| `account_state` | text | `active`, `deletion_pending`; default `active` |
| `suspended_at` | timestamptz | nullable |
| `suspension_reason_code` | text | nullable; código traducible |
| `suspension_note` | text | nullable, privado |
| `suspended_by` | bigint | FK nullable a `profiles.id`, `ON DELETE SET NULL` |
| `last_message_created_at` | timestamptz | nullable; no se borra al eliminar mensajes |
| `created_at`, `updated_at` | timestamptz | no nulos |

Restricciones: un perfil no puede ser simultáneamente activo y marcado para borrado; la asignación inicial de `owner` ocurre por procedimiento administrativo explícito. `username_normalized` nunca procede del cliente sin recalcular en servidor. `display_name` no tiene restricción ni índice único y no se exige que sea distinto de `username`.

Índices: únicos en `public_id`, `clerk_user_id`, `username_normalized`; búsqueda normalizada de `display_name`/`username` se añadirá según consulta real y `EXPLAIN`.

### `messages`

Versión actual de cada mensaje. No existe historial general de texto.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | bigint | PK identity |
| `public_id` | uuid | único, enlace estable |
| `author_id` | bigint | FK a `profiles.id`; la cuenta se purga en la misma transacción antes de eliminarse |
| `version` | integer | no nulo, inicia en 1, `CHECK version > 0` |
| `content` | text | no vacío; máximo 500 grafemas validado en dominio; enlaces no se vuelven clicables |
| `recipient` | text | nullable; `ateez`, ocho miembros o `atiny` |
| `status` | text | `pending`, `approved`, `rejected`, `withdrawn`; inicia `pending` |
| `moderation_reason_code` | text | requerido para rechazo/retirada; privado para autora/admin |
| `moderation_note` | text | nullable, privado para autora/admin |
| `location_precision` | text | `approximate` o `precise` |
| `public_point` | `extensions.geography(Point,4326)` | único punto persistido; latitud/longitud válidas |
| `locality` | text | nullable, mostrable |
| `country` | text | no nulo, mostrable |
| `country_code` | text | ISO 3166-1 alfa-2 minúscula |
| `location_algorithm_version` | integer | requerido en aproximado; estable entre ediciones de texto |
| `published_at` | timestamptz | instante de creación; orden público estable |
| `created_at`, `updated_at` | timestamptz | no nulos |

Índices iniciales: único `public_id`; `(author_id, created_at DESC, id DESC)`; `(status, published_at DESC, id DESC)`; GiST sobre `public_point`; índices de FK. Los índices por destinatario/localidad serán compuestos o parciales solo cuando las consultas implementadas lo demuestren.

Transiciones:

```text
crear -> pending v1
pending -> approved | rejected
approved -> withdrawn
editar cualquier estado -> pending v+1
eliminar cualquier estado -> borrado físico
```

Editar solo texto conserva `public_id` y `public_point`. Cambiar ubicación sustituye el punto. Una transición administrativa exige `expectedVersion`; si no coincide, no modifica nada.

### `review_requests`

Metadatos de la acción privada «Pedir revisión».

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | bigint | PK identity |
| `public_id` | uuid | único; solo visible en administración |
| `requester_id` | bigint | FK nullable a `profiles`, `ON DELETE SET NULL` |
| `message_id` | bigint | FK nullable a `messages`, `ON DELETE SET NULL` |
| `message_public_id` | uuid | snapshot del identificador estable para contexto privado |
| `message_version` | integer | versión exacta solicitada |
| `reason` | text | motivo aportado por la solicitante, privado |
| `status` | text | `open` o `closed` |
| `resolution_code` | text | nullable; requerido al cerrar si la política lo exige |
| `resolution_note` | text | nullable, privado |
| `closed_by` | bigint | FK nullable a `profiles`, `ON DELETE SET NULL` |
| `created_at`, `closed_at` | timestamptz | `closed_at` solo para `closed` |

Índice de cola: `(status, created_at ASC, id ASC)`. Crear una solicitud no cambia `messages.status` ni la visibilidad.

### `review_evidence`

Snapshot separado para limitar acceso, backup y purga.

| Campo | Tipo | Reglas |
|---|---|---|
| `review_request_id` | bigint | PK y FK a `review_requests`, `ON DELETE CASCADE` |
| `content_snapshot` | text | copia exacta de la versión solicitada |
| `author_display_name_snapshot` | text | contexto mínimo no credencial |
| `recipient_snapshot` | text | nullable |
| `location_label_snapshot` | text | localidad/país mostrable, nunca dirección |
| `captured_at` | timestamptz | no nulo |
| `purge_at` | timestamptz | `NULL` mientras abierta; al cerrar, dos años naturales después |

Índice parcial: `(purge_at) WHERE purge_at IS NOT NULL`. La purga elimina esta fila, conserva el caso y registra solo conteo/fecha operativos.

### `moderation_actions`

Decisiones de contenido y cuenta aplicadas a una versión/estado concreto.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | bigint | PK identity |
| `actor_id` | bigint | FK nullable a `profiles`, `ON DELETE SET NULL` |
| `action` | text | `approve`, `reject`, `withdraw`, `suspend`, `reinstate`, `close_review` |
| `message_id` | bigint | FK nullable a `messages`, `ON DELETE SET NULL` |
| `message_public_id` | uuid | nullable, contexto sin texto |
| `message_version` | integer | requerido para decisión de mensaje |
| `subject_profile_id` | bigint | FK nullable a `profiles`, `ON DELETE SET NULL` |
| `reason_code` | text | nullable según acción |
| `note` | text | nullable, privado |
| `created_at` | timestamptz | inmutable |

No duplica `content` ni `review_evidence`.

### `settings`

Singleton operativo (`id = 1`).

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | smallint | PK, `CHECK id = 1` |
| `premoderation_enabled` | boolean | default `false` |
| `message_limit` | integer | default `10`, positivo |
| `cooldown_seconds` | integer | default `10`, no negativo |
| `version` | integer | incrementa en cada cambio |
| `updated_by` | bigint | FK nullable a `profiles` |
| `updated_at` | timestamptz | no nulo |

El panel calcula el impacto de premoderación mediante una lectura, pero el cambio revalida `expectedVersion` y escribe settings + auditoría en una única transacción.

### `admin_audit`

Registro privado e inmutable de toda acción administrativa, incluidos roles y configuración.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | bigint | PK identity |
| `actor_id` | bigint | FK nullable a `profiles`, `ON DELETE SET NULL` |
| `action` | text | código estable |
| `target_type` | text | tipo de objeto |
| `target_public_id` | uuid | nullable |
| `reason_code` | text | nullable |
| `metadata` | jsonb | allowlist de metadatos no sensibles; nunca texto de mensaje/evidencia/dirección |
| `created_at` | timestamptz | inmutable |

Índices: `(created_at DESC, id DESC)`, `actor_id`, y `(target_type, target_public_id)`.

### `account_deletion_jobs`

Saga entre PostgreSQL y Clerk.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | bigint | PK identity |
| `profile_public_id` | uuid | identificador local para trazabilidad privada |
| `clerk_user_id` | text | único mientras el job exista |
| `status` | text | `pending`, `processing`, `completed`, `failed_retryable` |
| `attempt_count` | integer | default 0 |
| `next_attempt_at` | timestamptz | nullable |
| `claimed_at` | timestamptz | nullable; lease recuperable |
| `last_error_code` | text | nullable, sin payloads/secretos |
| `created_at`, `updated_at`, `completed_at` | timestamptz | según estado |

Índice parcial en `(next_attempt_at, id)` para estados pendientes/reintentables. `404` de Clerk se considera éxito idempotente. Tras completar se elimina o anonimiza `clerk_user_id` según la política operativa acordada.

### `maintenance_runs`

Telemetría mínima de purga/reintentos, sin contenido privado.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | bigint | PK identity |
| `job_name` | text | código del job |
| `started_at`, `finished_at` | timestamptz | no nulos al completar |
| `affected_rows` | integer | no negativo |
| `status` | text | `succeeded` o `failed` |
| `error_code` | text | nullable |

## Atomic operations

### Publish message

1. Validar localmente firma, caducidad, cuenta y contenido de la selección de ubicación ya confirmada antes de la transacción; no llamar de nuevo a Geoapify.
2. `SELECT profile FOR UPDATE` por `clerk_user_id`.
3. Rechazar perfil incompleto, suspendido o `deletion_pending`.
4. Leer `settings`; contar todos los mensajes de la autora.
5. Comparar cooldown con `clock_timestamp()`.
6. Asignar `public_id`, calcular una sola vez el punto aproximado si aplica, insertar `pending` y actualizar `last_message_created_at`.
7. Commit; ninguna llamada HTTP ocurre dentro.

El borrado de mensajes bloquea primero el mismo perfil, borra físicamente y no toca `last_message_created_at`.

### Edit message

Bloquear perfil y mensaje, comprobar autora/estado de cuenta, validar `expectedVersion`, sustituir contenido/ubicación, incrementar versión, establecer `pending` y limpiar el motivo de moderación actual. La evidencia ya capturada permanece independiente.

### Moderate or configure

Bloquear objeto, resolver roles actuales, comprobar restricciones owner/admin y versión esperada, escribir cambio + `moderation_actions`/`admin_audit` antes del commit. Ningún administrador reescribe texto ajeno.

### Delete account

Bloquear perfil, marcar `deletion_pending`, borrar mensajes, anular referencias permitidas e insertar/upsert del job. Tras commit se llama a Clerk. Toda lectura y mutación excluye desde el primer commit ese perfil.

## Read models

- `PublicMapFeature`: `publicId`, punto, precisión, localidad/país, destinatario, fecha y autora mínima; sin texto completo.
- `PublicMessageDetail`: añade texto completo solo tras volver a comprobar visibilidad.
- `OwnMessage`: estado, motivo, versión y controles de propiedad; nunca sale por endpoints públicos.
- `AdminReviewCase`: solicitud + evidencia vigente; solo runtime admin, nunca preview.
- `preview_api.public_messages`: vista mínima de filas ya públicas para la credencial de preview; no concede acceso a tablas base.

## Non-persisted UI state

Los filtros del mapa se reflejan en `searchParams` y estado cliente. El borrador de mensaje, la consulta de dirección y la selección confirmada viven solo en memoria de la pestaña y se conservan al degradarse o reintentarse mapa, teselas o búsqueda. No forman entidades PostgreSQL, no se escriben en URL, storage, logs ni telemetría, y se eliminan al cambiar de identidad o cerrar sesión. Modificar la consulta después de seleccionar invalida la confirmación; una selección firmada vigente puede publicarse sin que Geoapify esté disponible.

## Retention and backup boundary

- `review_evidence` permanece mientras la solicitud está abierta y hasta dos años naturales desde `closed_at`; después se elimina por lotes.
- El restore runbook ejecuta la purga inmediatamente después de restaurar.
- Los dumps de backup excluyen `review_evidence` si no existe una política cifrada/rotatoria que garantice el mismo límite. Esta decisión debe quedar cerrada antes del lanzamiento.
- Mensajes, perfiles e identidad se eliminan según el flujo de cuenta; auditoría conserva solo identificadores/contexto permitido, nunca el texto borrado.
