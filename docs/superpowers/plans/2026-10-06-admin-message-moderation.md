# Moderación de mensajes — plan de implementación

> Ejecución: `superpowers:executing-plans`, en esta sesión, según la autorización del usuario.

**Objetivo:** entregar `/admin/messages`, búsqueda y filtros, decisiones versionadas, historial privado y actualización de las vistas.

**Arquitectura:** reutilizar identidad de sesión, permisos del panel, `admin_audit` y visibilidad canónica. Separar política pura, consulta paginada, transacción de moderación y controles de presentación. Ninguna decisión modifica contenido, ubicación o fecha de publicación.

**Stack:** Next.js 16, React 19, next-intl, Postgres.js, PostgreSQL/Supabase, Vitest y Cucumber; sin dependencias nuevas.

**Spec:** `specs/001-atiny-world-mvp/spec.md` (US5, FR-045–047, FR-054–056); `contracts/server-actions.md` (`moderateMessage`); tareas T077–080, T085, T088 y pruebas correspondientes.

## Restricciones y decisiones

- Administradores y propietarios activos pueden moderar; fans, suspendidos y perfiles pendientes de borrado no acceden a la cola ni deciden.
- Aprobar/rechazar solo pendientes. Retirar solo mensajes actualmente públicos, incluidos pendientes sin moderación previa (contrato de acciones).
- Rechazo/retirada exigen un código predefinido traducido; notas privadas opcionales hasta 1000 caracteres.
- La versión aumenta con cada decisión: impide aplicar un formulario antiguo después de otra decisión; el historial guarda la versión revisada.
- Bloquear perfiles por ID en orden estable antes del mensaje, y mantener bloqueada la configuración de visibilidad durante la decisión.
- Conservar historial al borrar autora o mensaje mediante FK nullable; nunca guardar contenido o notas en `admin_audit.metadata`.
- Aplicar la migración solo a la base de pruebas local (54322). La base de uso local y la remota requieren autorización específica antes de migrarlas.

## Riesgos que verifican las pruebas

Revocación de permisos; decisión sobre una edición posterior; dos decisiones concurrentes; fallo al insertar historial; exposición privada a credenciales públicas o preview; búsqueda literal y páginas inválidas; cambios de visibilidad y motivos para la autora.

### Tarea 1: políticas y transacción

- [X] Crear pruebas de políticas en `tests/unit/domain/moderation/policies.test.ts` y de atomicidad/privacidad/concurrencia en `tests/integration/admin-moderation.test.ts`.
- [X] Ejecutarlas y comprobar fallo por funcionalidad ausente.
- [X] Implementar `src/domain/moderation/policies.ts`, `src/i18n/moderation-reasons.ts`, `src/server/moderation/moderate-message.ts` y `message-repository.ts`.
- [X] Completar `20261006130000_message_moderation.sql`: tabla append-only `moderation_actions`, índices de FK, permisos mínimos. Reutilizar índices de cola y auditoría existentes.
- [X] Aplicar migración a pruebas y ejecutar `node scripts/run-db-suite.mjs vitest run tests/integration/admin-moderation.test.ts` y las pruebas unitarias de políticas.

Interfaces: `moderateMessage(sql, {clerkUserId, publicId, expectedVersion, decision, reasonCode?, note?})` devuelve `ActionResult<{publicId, status, version}>`; `searchModerationMessages(sql, clerkUserId, {query, status, page})` devuelve elementos privados paginados con visibilidad y decisiones disponibles.

### Tarea 2: panel y acción de sesión

- [X] Crear y ejecutar pruebas de acción, acceso directo y controles en `tests/unit/app/admin-moderation-action.test.ts`, `admin-messages.test.tsx` y `tests/unit/components/admin-message-queue.test.tsx`.
- [X] Implementar `src/app/(site)/admin/messages/{actions,page}.tsx` (acción `.ts`) y `src/components/admin/{message-queue,admin-refresh}.tsx`. Añadir navegación de mensajes al layout.
- [X] Añadir catálogos inglés/español y estilos usando el panel existente. Mostrar contenido sin edición, estado, versión, autora, ubicación pública, fecha, motivo y nota.
- [X] Revalidar raíz, mensajes, detalle, cola y «Mis mensajes» tras una decisión correcta; refrescar la cola sin reintentar conflictos.
- [X] Ejecutar pruebas del panel y verificar catálogo/paridad y tipos.

### Tarea 3: recorrido y entrega

- [X] Traducir todos los motivos de la allowlist en «Mis mensajes» y probar que no muestra códigos privados desconocidos.
- [X] Crear escenarios españoles de aprobación, rechazo, retirada y conflicto en `tests/bdd/features/moderar-administrar.feature`, con steps reales de base de datos.
- [X] Ejecutar BDD, unitarias, integración, contrato, lint, typecheck y build; revisar permisos y diff.
- [X] Documentar alcance, migración y resultados en `docs/admin-moderation.md`; actualizar tasks sin marcar completa US5.

No incluye configuración, suspensión, solicitudes de revisión ni visor de auditoría. No publicar, mergear ni modificar bases de uso real como parte de esta ejecución.

## Registro de ejecución

- Base `origin/main`: `8b82d86`, merge de roles (#76); rama `feat/admin-message-moderation`.
- Pruebas nuevas ejecutadas antes de implementar los módulos, acción y controles; traducción y avisos de UI con fallos de aserción reproducidos antes de corregir.
- La base de pruebas ya tenía las migraciones de roles aplicadas sin entradas en `schema_migrations`; `supabase migration up --local` se detuvo al encontrar `admin_audit`. Se aplicó únicamente el SQL nuevo, bajo el advisory lock de pruebas, sin reset ni reparación del historial anterior.
- Regla: el contrato de acciones permite retirar pendientes públicos; actualizado el diagrama de data-model para hacer explícita esa transición.
- Regla: `expectedVersion` protege también decisiones administrativas consecutivas; cada decisión incrementa la versión y la acción conserva la revisada.
- Revisión independiente: corregido bloqueo del formulario tras cambiar visibilidad sin cambiar versión; prueba RED/GREEN. Clave del formulario incluye decisiones disponibles.
- Verificación completa y límites de la entrega: `docs/admin-moderation.md`.
