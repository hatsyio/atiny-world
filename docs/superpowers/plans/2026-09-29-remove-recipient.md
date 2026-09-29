# Eliminar destinatario de los mensajes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar `recipient` del dominio, persistencia, APIs, UI, pruebas y documentación, conservando el resto de datos y filtros de mensajes.

**Architecture:** Mantener las fronteras actuales del sistema y retirar el campo de cada contrato de entrada/salida. Añadir una migración posterior que elimine solo la columna `app_private.messages.recipient`; las consultas del mapa conservarán ciudad, país y fan. Las URL del mapa que incluyan el parámetro obsoleto fallarán con el validador existente.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, PostgreSQL/PostGIS vía `postgres`, Supabase migrations, Vitest y Cucumber.

**Spec:** `docs/superpowers/specs/2026-09-29-remove-recipient-design.md`

## Global Constraints

- Las migraciones ya aplicadas no se editan.
- Los enlaces públicos existentes siguen resolviendo por `public_id`.
- Se elimina únicamente la dimensión de destinatario; no se convierte en otro valor ni se modifica el contenido de las cartas.
- Las URL antiguas del mapa que contengan `recipient` reciben un error de validación explícito.
- No se rediseñará la moderación, la búsqueda de usuarios, la selección de ubicación ni el modelo de cuentas.
- El cambio local preexistente en `next-env.d.ts` no forma parte de esta tarea.

## Review Focus

- Datos existentes al ejecutar la migración: se conserva el resto de columnas y el `public_id`; probarlo en la migración/integración de base de datos.
- Parámetro `recipient` obsoleto en ambas API del mapa: debe devolver 400 y no consultar el repositorio; fijarlo en `tests/unit/server/http/map-params.test.ts` y `tests/contract/public-map-api.test.ts`.
- Contratos de publicación sin destinatario: una publicación válida no debe pedir ni serializar el campo; fijarlo en los tests de acción y formulario.
- Filtros restantes: ciudad, país y fan deben seguir presentes en estado y URL; fijarlo en los tests del controlador y mapa.
- Proyecciones y respuestas: ningún mensaje público o propio puede exponer la propiedad retirada; fijarlo en pruebas de repositorio/contrato e integración.

### Task 1: Actualizar contratos de dominio y pruebas de publicación

**Files:**
- Modify: `src/domain/contracts.ts`
- Modify: `src/domain/messages/content.ts`
- Modify: `src/server/actions/create-message.ts`
- Modify: `src/server/messages/create-message.ts`
- Modify: `tests/unit/domain/contracts.test.ts`
- Modify: `tests/unit/domain/messages/message-content.test.ts`
- Modify: `tests/contract/create-message-action.test.ts`
- Modify: `tests/integration/create-message-action.test.ts`
- Modify: `tests/integration/create-message-concurrency.test.ts`

**Interfaces:**
- `CreateMessageActionInput` queda como `{ content: string; location: CreateMessageLocationInput }`.
- `CreateMessageInput` queda como `{ clerkUserId: string; content: string; location: ... }`.
- `validateMessageContent(content)` sigue validando contenido y adjuntos, pero ya no conoce destinatarios.

- [ ] **Step 1: Actualizar primero las expectativas de los tests**

  Elimina imports, fixtures y aserciones de `RECIPIENTS`, `Recipient` y `recipient`; cambia los inputs válidos a `{ content, location }`; conserva una prueba de que contenido vacío o demasiado largo sigue fallando.

- [ ] **Step 2: Ejecutar las pruebas de contratos y dominio para confirmar el fallo**

  Run: `pnpm vitest run tests/unit/domain/contracts.test.ts tests/unit/domain/messages/message-content.test.ts tests/contract/create-message-action.test.ts`

  Expected: FAIL por imports, propiedades y validaciones de destinatario aún presentes.

- [ ] **Step 3: Retirar el vocabulario de destinatario**

  Elimina de `contracts.ts` las constantes, tipo y guard. En `content.ts`, reduce `ContentValidation` a `content | attachments`, elimina `validateRecipient` y deja la firma `validateMessageContent(content, { attachments } = {})`. Retira la validación y el paso de `recipient` de ambas capas de creación.

- [ ] **Step 4: Ejecutar las pruebas actualizadas**

  Run: `pnpm vitest run tests/unit/domain/contracts.test.ts tests/unit/domain/messages/message-content.test.ts tests/contract/create-message-action.test.ts tests/integration/create-message-action.test.ts tests/integration/create-message-concurrency.test.ts`

  Expected: PASS.

- [ ] **Step 5: Ejecutar TypeScript sobre las interfaces consumidoras**

  Run: `pnpm typecheck`

  Expected: puede fallar solo por consumidores de `recipient`; registrar esos archivos para las tareas de lectura/UI siguientes y no cambiar interfaces ajenas.

### Task 2: Retirar el campo de proyecciones, repositorios y edición

**Files:**
- Modify: `src/domain/messages/public-message.ts`
- Modify: `src/domain/messages/own-message.ts`
- Modify: `src/server/messages/public-repository.ts`
- Modify: `src/server/messages/own-message-repository.ts`
- Modify: `src/server/messages/update-message.ts`
- Modify: `tests/integration/manage-own-messages.test.ts`
- Modify: `tests/integration/own-message-list.test.ts`
- Modify: `tests/integration/public-message-reads.test.ts`

**Interfaces:**
- `PublicMapFeature`, `PublicMessageDetail` y `OwnMessage` no contienen `recipient`.
- `MapFeatureOptions` y los argumentos de `pagePublicMessages` no contienen `recipient`.
- `projectPublicFeature` y `projectOwnMessage` reciben filas sin la columna retirada.

- [ ] **Step 1: Eliminar propiedades en las pruebas de lecturas**

  Cambia las consultas de test para no seleccionar `recipient`, elimina los overrides y sustituye las aserciones de preservación por aserciones de contenido, ubicación, versión y `publicId`.

- [ ] **Step 2: Ejecutar las pruebas de lecturas para observar el fallo de implementación**

  Run: `pnpm vitest run tests/integration/manage-own-messages.test.ts tests/integration/own-message-list.test.ts tests/integration/public-message-reads.test.ts`

  Expected: FAIL por selects, tipos y proyecciones que aún esperan `messages.recipient`.

- [ ] **Step 3: Actualizar tipos y SQL**

  Quita `recipient` de las interfaces y de las columnas seleccionadas. En `public-repository.ts`, elimina la rama de filtro de `extraConditions` y usa las columnas restantes en las proyecciones. En `own-message-repository.ts`, retira la columna de su `select`. La ruta de edición ya no necesita cambios funcionales; solo debe seguir llamando a `validateMessageContent(input.content)`.

- [ ] **Step 4: Ejecutar integración de mensajes**

  Run: `pnpm vitest run tests/integration/manage-own-messages.test.ts tests/integration/own-message-list.test.ts tests/integration/public-message-reads.test.ts`

  Expected: PASS cuando la base de datos ya tenga la migración de Task 3 aplicada; si se ejecuta antes, el fallo esperado será la ausencia temporal de la columna en los tests antiguos.

### Task 3: Añadir migración, seed y helpers de base de datos

**Files:**
- Create: `supabase/migrations/20260929000100_drop_message_recipient.sql`
- Modify: `supabase/seed.sql`
- Modify: `tests/support/database.ts`
- Add/Modify: `tests/integration/db-foundation.test.ts` o el test de migraciones existente que cubra esquema

**Interfaces:**
- La migración deja `app_private.messages` sin columna `recipient` y no altera las demás columnas.
- `insertMessage(sql, authorId, overrides)` ya no acepta un override de destinatario.

- [ ] **Step 1: Añadir una prueba de esquema sobre datos existentes**

  En la suite de integración de base de datos, inserta un perfil y un mensaje con los campos restantes, ejecuta la migración mediante el flujo normal de la suite y verifica que `public_id`, `content`, `author_id`, `status` y `public_point` siguen presentes; verifica también que `recipient` no aparece en `information_schema.columns`.

- [ ] **Step 2: Ejecutar la prueba de esquema antes de la implementación**

  Run: `pnpm test:integration -- tests/integration/db-foundation.test.ts`

  Expected: FAIL mientras el esquema inicial conserva `recipient`.

- [ ] **Step 3: Crear la migración nueva sin editar migraciones anteriores**

  Añade una migración que primero elimine y después recree `preview_api.public_messages` sin `recipient`, y que elimine la columna:

  ```sql
  drop view preview_api.public_messages;
  alter table app_private.messages drop column recipient;
  create view preview_api.public_messages with (security_invoker = false) as
  select m.public_id, m.location_precision, m.locality, m.country,
         m.country_code, m.published_at, p.public_id as author_public_id,
         p.username, p.display_name
    from app_private.messages m
    join app_private.profiles p on p.id = m.author_id
   where p.account_state = 'active' and p.suspended_at is null
     and (m.status = 'approved' or (m.status = 'pending' and not exists (
       select 1 from app_private.settings s where s.id = 1 and s.premoderation_enabled
     )));
  ```

  No uses `drop table`, no recrees mensajes y no modifiques `20260915000100_create_app_private_core.sql`; conserva el `security_invoker`, los filtros de visibilidad y el grant para `atiny_preview_reader` al recrear la vista.

- [ ] **Step 4: Actualizar seed y helper**

  Elimina `recipient` de los `insert` de `supabase/seed.sql` y de `tests/support/database.ts`; conserva el mensaje demo, su ubicación, país, estado y fecha.

- [ ] **Step 5: Aplicar migraciones y verificar preservación**

  Run: `pnpm test:integration -- tests/integration/db-foundation.test.ts`

  Expected: PASS con la columna retirada y los demás datos intactos.

### Task 4: Retirar `recipient` del parseo y las rutas públicas del mapa

**Files:**
- Modify: `src/server/http/map-params.ts`
- Modify: `src/app/api/map/features/route.ts`
- Modify: `src/app/api/map/messages/route.ts`
- Modify: `tests/unit/server/http/map-params.test.ts`
- Modify: `tests/contract/public-map-api.test.ts`

**Interfaces:**
- `MapQueryParams` conserva bounds, zoom, fan, city, country, cursor y limit, pero no `recipient`.
- Los handlers pasan al repositorio solo `fan`, `city`, `country` y sus límites.

- [ ] **Step 1: Añadir pruebas para rechazo explícito del parámetro obsoleto**

  Verifica que `parseMapQuery(new URLSearchParams({ ...bounds, recipient: 'ateez' }))` devuelve `{ ok: false }`, y que una petición válida con `city`, `country`, `fan` y `limit` conserva esos valores.

- [ ] **Step 2: Ejecutar pruebas del parser y contrato API**

  Run: `pnpm vitest run tests/unit/server/http/map-params.test.ts tests/contract/public-map-api.test.ts`

  Expected: FAIL porque el parser actual acepta `recipient` y el contrato aún lo expone.

- [ ] **Step 3: Hacer estricto el esquema de parámetros**

  Elimina la propiedad `recipient` del objeto Zod y añade `.strict()` al objeto. Conserva `recipient: searchParams.get('recipient') ?? undefined` únicamente en el objeto crudo que se entrega a `safeParse`; así una URL antigua se rechaza como clave desconocida, pero el tipo resultante y el objeto de retorno no lo exponen. Ajusta los destructurings de ambas rutas.

- [ ] **Step 4: Ejecutar pruebas de API y parser**

  Run: `pnpm vitest run tests/unit/server/http/map-params.test.ts tests/contract/public-map-api.test.ts`

  Expected: PASS; las respuestas de features y messages no deben contener `recipient`.

### Task 5: Actualizar UI de publicación, mapa y controladores

**Files:**
- Modify: `src/components/messages/create-message-form.tsx`
- Modify: `src/components/map/map-filters.tsx`
- Modify: `src/components/map/public-map-controller.tsx`
- Modify: `tests/unit/components/messages/create-message-form.test.tsx`
- Modify: `tests/unit/components/map/public-map.test.tsx`
- Modify: `tests/unit/components/map/public-map-controller.test.ts`
- Modify: `tests/unit/components/map/leaflet-map-lifecycle.test.tsx`

**Interfaces:**
- `MapFilterValues` solo contiene `city`, `country` y `fan`.
- `CreateMessageSubmit` recibe el input sin `recipient`.
- `buildFeatureRequest` y `buildMessageRequest` nunca serializan `recipient`.

- [ ] **Step 1: Cambiar tests de UI a la ausencia del control**

  Sustituye pruebas que buscan el combobox de destinatario por aserciones de que no existe; actualiza el submit esperado a `{ content, location }`; conserva las comprobaciones de ciudad, país, fan, contador y ubicación.

- [ ] **Step 2: Ejecutar tests de componentes para confirmar el fallo**

  Run: `pnpm vitest run tests/unit/components/messages/create-message-form.test.tsx tests/unit/components/map/public-map.test.tsx tests/unit/components/map/public-map-controller.test.ts tests/unit/components/map/leaflet-map-lifecycle.test.tsx`

  Expected: FAIL por controles, estado y URLs de destinatario aún presentes.

- [ ] **Step 3: Retirar estado y copy de publicación**

  Elimina imports, textos, estado, handler, errores y bloque JSX de destinatario en `create-message-form.tsx`; publica con `{ content, location }` y reinicia solo contenido y ubicación.

- [ ] **Step 4: Reducir filtros y URL del mapa**

  Elimina `RECIPIENTS`, `normalizeRecipient`, el `<select>` de `map-filters.tsx`, la propiedad inicial y la llamada `appendFilter(..., 'recipient', ...)` del controlador. Mantén normalización y serialización de ciudad, país y fan.

- [ ] **Step 5: Ejecutar tests de UI**

  Run: `pnpm vitest run tests/unit/components/messages/create-message-form.test.tsx tests/unit/components/map/public-map.test.tsx tests/unit/components/map/public-map-controller.test.ts tests/unit/components/map/leaflet-map-lifecycle.test.tsx`

  Expected: PASS.

### Task 6: Actualizar BDD, contratos y documentación de producto

**Files:**
- Modify: `tests/bdd/features/crear-cuenta-publicar.feature`
- Modify: `tests/bdd/features/explorar-mapa.feature`
- Modify: `tests/bdd/step_definitions/crear-cuenta-publicar.steps.ts`
- Modify: `tests/bdd/step_definitions/explorar-mapa.steps.ts`
- Modify: `specs/001-atiny-world-mvp/spec.md`
- Modify: `specs/001-atiny-world-mvp/data-model.md`
- Modify: `specs/001-atiny-world-mvp/contracts/http-api.yaml`
- Modify: `specs/001-atiny-world-mvp/contracts/server-actions.md`
- Modify: `specs/001-atiny-world-mvp/contracts/ui-behavior.md`
- Modify: `specs/001-atiny-world-mvp/research.md`
- Modify: `specs/001-atiny-world-mvp/tasks.md`
- Modify: `docs/requisitos.md`
- Modify: `docs/arquitectura.md`

**Interfaces:**
- Los escenarios BDD publican con contenido y ubicación, y exploran con ciudad, país y fan.
- Los contratos documentan respuestas sin `recipient` y no enumeran un filtro de destinatario.

- [ ] **Step 1: Actualizar escenarios y steps**

  Elimina pasos de selección/assertion/filtro de destinatario, cambia los helpers para construir inputs sin `recipient` y conserva la cobertura de publicación, visibilidad, ciudad, país y fan.

- [ ] **Step 2: Ejecutar BDD para detectar referencias restantes de esquema**

  Run: `pnpm test:bdd`

  Expected: FAIL solo por referencias de pasos/fixtures retirados hasta completar la documentación y helpers.

- [ ] **Step 3: Actualizar especificaciones y contratos**

  Elimina FR-016 y la parte de destinatario de FR-029, modifica la entidad Mensaje y el modelo de `messages`, retira el parámetro/schema/campo de `http-api.yaml`, y actualiza contratos de server actions y UI para reflejar inputs sin destinatario.

- [ ] **Step 4: Actualizar requisitos y arquitectura**

  Elimina las afirmaciones de destinatario de `docs/requisitos.md`, `docs/arquitectura.md` y referencias equivalentes del plan histórico solo si describen el estado actual; conserva los documentos históricos sin reescribir decisiones ya aplicadas cuando su contexto sea explícitamente histórico.

- [ ] **Step 5: Ejecutar BDD de nuevo**

  Run: `pnpm test:bdd`

  Expected: PASS.

### Task 7: Barrido final, verificación completa y entrega

**Files:**
- Modify: cualquier archivo restante reportado por `rg -n -i 'recipient|destinatari|destinatario' src tests supabase docs specs README.md`, solo si contiene comportamiento o documentación vigente.

- [ ] **Step 1: Buscar referencias funcionales restantes**

  Run: `rg -n -i 'recipient|destinatari|destinatario' src tests supabase docs specs README.md`

  Expected: solo referencias históricas explícitamente justificadas, o ninguna.

- [ ] **Step 2: Ejecutar lint y typecheck**

  Run: `pnpm lint && pnpm typecheck`

  Expected: PASS sin incluir ni modificar `next-env.d.ts`.

- [ ] **Step 3: Ejecutar la suite unitaria, contractual, de integración y BDD**

  Run: `pnpm test`

  Expected: PASS.

- [ ] **Step 4: Revisar el diff y el estado del árbol**

  Run: `git diff --check && git status --short && git diff --stat HEAD`

  Expected: no errores de whitespace; el diff contiene solo cambios de issue #36 y el cambio local previo de `next-env.d.ts` sigue separado/no modificado.

- [ ] **Step 5: Crear un commit de implementación**

  ```bash
  git add src tests supabase docs specs
  git commit -m "feat: remove message recipients"
  ```

  No añadir `next-env.d.ts` al commit.
