# Implementation Plan: ATINY World MVP

**Branch**: `feat/bootstrap` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Especificación en `specs/001-atiny-world-mvp/spec.md` y arquitectura autoritativa en `docs/arquitectura.md`.

## Summary

Construir el MVP integral de ATINY World como una aplicación única Next.js 16 con App Router: lectura pública de mensajes sobre Leaflet/CARTO, cuentas Clerk, publicación y gestión de hasta 10 mensajes por cuenta, moderación, acción privada «Pedir revisión», administración, eliminación coordinada e interfaz inglesa/española. El backend Node.js será la única puerta a PostgreSQL 17 en Supabase, concentrará permisos e invariantes en módulos de dominio y servidor, y mantendrá toda dirección, evidencia de revisión e historial administrativo fuera del cliente. La UI conservará filtros, borrador y ubicaciones ya confirmadas ante fallos temporales de mapa o geocodificación, y los recorridos esenciales tendrán medición E2E automatizada sobre la matriz móvil exigida.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Node.js 24.16 o posterior

**Primary Dependencies**: Next.js 16.3.5, React 19.3, Clerk 7.9, Postgres.js 3.4, Leaflet, `leaflet.markercluster`, CARTO Basemaps y Geoapify

**Storage**: PostgreSQL 17.6 administrado por Supabase; esquema privado `app_private`, PostGIS para puntos e índices espaciales, migraciones SQL imperativas en `supabase/migrations`

**Testing**: Cucumber 13 para aceptación BDD, Vitest 5 y Testing Library para unidad/integración, Playwright para E2E determinista y cronometrado, adaptador Appium/WebDriver para el gate móvil de lanzamiento, PostgreSQL local real para transacciones y concurrencia

**Target Platform**: Navegadores actuales de escritorio; Safari de la versión estable actual de iOS y Chrome estable actual de Android a 320 y 390 píxeles CSS, en inglés y español; Vercel Functions con runtime Node.js en una región europea próxima a Supabase `eu-west-3`

**Project Type**: Aplicación web full-stack en un único proyecto Next.js

**Performance Goals**: interacción fluida del mapa a 60 fps una vez cargado; p95 inferior a 1 s para lecturas PostgreSQL de viewport/ficha bajo la escala inicial; no descargar el corpus mundial ni los textos completos con cada viewport

**Constraints**: coste inicial de 0 EUR/mes; sin caché pública persistente de contenido moderable; navegador sin acceso directo a Supabase; secretos solo en servidor; visibilidad actualizada en la siguiente lectura; WCAG 2.2 AA como objetivo de implementación; CARTO con atribución visible y sin proxy/cache de teselas; Geoapify sin direcciones en URLs, persistencia o logs; el mapa es la mayor región visible antes del formulario y no se usan fotografías ni logotipos oficiales; los recorridos móviles no admiten desbordamiento horizontal, controles inaccesibles ni errores no gestionados

**Scale/Scope**: MVP de una comunidad fan, diseñado y probado inicialmente hasta 10.000 mensajes, 1.000 cuentas y 100 lecturas concurrentes; 7 historias de usuario, 66 requisitos funcionales y 10 resultados medibles

## Constitution Check

*GATE: superado antes de investigación y reevaluado después del diseño.*

| Principio | Comprobación inicial | Comprobación tras diseño |
|---|---|---|
| I. Specification Before Implementation | PASS — `spec.md` y `docs/arquitectura.md` fijan alcance y límites. | PASS — modelo, contratos y quickstart trazan el diseño sin añadir funciones de producto. |
| II. Privacy and Server-Side Authority | PASS — toda lectura y mutación de producto pasa por backend. | PASS — esquema privado, roles mínimos, DTO públicos, autorización por operación y evidencia separada evitan exposición. |
| III. Behavior-First Verification | PASS — cada historia tiene prueba independiente y escenarios de aceptación. | PASS — el quickstart exige BDD primero, unidad para dominio e integración real para permisos, DB y concurrencia. |
| IV. Real Integrations and Environment Fidelity | PASS — se conservan Clerk, Supabase, Leaflet/CARTO, Geoapify y Vercel. | PASS — se definen pruebas contractuales reales, entornos, cuotas y gates de lanzamiento sin simulaciones públicas. |
| V. Simplicity, Atomicity, and Reversibility | PASS — aplicación única, sin microservicios, colas externas, Redis ni almacenamiento de archivos. | PASS — SQL versionado expand/contract, locks por perfil, decisiones por versión y saga idempotente de borrado. |

No hay excepciones constitucionales ni entradas de complejidad que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/001-atiny-world-mvp/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-api.yaml
│   ├── server-actions.md
│   └── ui-behavior.md
└── tasks.md                 # Fase siguiente: $speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── [lang]/
│   │   ├── admin/
│   │   ├── messages/[publicId]/
│   │   ├── my-messages/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/
│       ├── clerk/webhook/
│       ├── internal/account-deletions/
│       ├── locations/suggestions/
│       ├── map/features/
│       ├── map/messages/
│       ├── messages/[publicId]/
│       └── users/search/
├── components/
│   ├── account/
│   ├── admin/
│   ├── map/
│   └── messages/
├── domain/
│   ├── location/
│   ├── messages/
│   └── moderation/
├── i18n/
└── server/
    ├── auth/
    ├── db/
    ├── locations/
    ├── messages/
    └── moderation/

supabase/
├── migrations/
├── roles.sql
└── tests/

tests/
├── bdd/
│   ├── features/
│   └── step_definitions/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Se conserva el monolito modular ya aprobado. Las páginas y layouts son Server Components por defecto; Leaflet, controles interactivos y formularios son islas cliente. Los Route Handlers son adaptadores HTTP para lecturas dinámicas, geocodificación, webhooks y cron; las Server Actions adaptan mutaciones de la UI. Ambos delegan en `src/server/*`, que aplica sesión, perfil local, suspensión, rol, propiedad y transacciones, mientras `src/domain/*` contiene reglas puras independientes de React y Next.js.

## Delivery Strategy

### Phase 0 — Research

Las decisiones y alternativas están cerradas en [research.md](./research.md). Antes de implementar se han verificado las prácticas vigentes de Next.js/Clerk, Supabase/PostgreSQL, Vercel, Leaflet/CARTO, Geoapify, Playwright y Appium/WebDriver. No queda ninguna aclaración técnica pendiente; la capacidad del runtime iOS estable de demostrar 320 y 390 píxeles CSS es un gate verificable de lanzamiento, no una sustitución aceptable por emulación desktop.

### Phase 1 — Foundations and schema

1. Añadir las dependencias estrictamente necesarias para mapa, validación de contratos, conteo de grafemas y verificación de webhooks.
2. Crear migraciones expansivas para extensión PostGIS, esquema privado, tablas, restricciones, índices, vistas públicas de preview, roles y funciones de purga.
3. Implementar perfiles locales y la frontera de autorización Clerk → PostgreSQL.
4. Crear diccionarios `en`/`es`, rutas con prefijo de idioma y redirección estable de `/` a `/en`.
5. Establecer DTO, errores estables, estados de dependencia y validadores compartidos conforme a `contracts/`.

### Phase 2 — Public exploration and publishing

1. Implementar la regla canónica de visibilidad una sola vez en servidor y cubrir su matriz completa.
2. Añadir endpoints de viewport, grupo paginado, ficha pública y búsqueda de fans, siempre con paginación por cursor y `Cache-Control: no-store`.
3. Integrar Leaflet como Client Component cargado sin SSR, CARTO directamente desde navegador y clustering de los puntos públicos recibidos para el viewport.
4. Integrar Geoapify mediante `POST` backend con rate limit, debounce cliente, token de selección breve y descarte de dirección/response cruda.
5. Publicar dentro de una transacción corta: bloquear perfil, comprobar cuenta y configuración, validar límite/cooldown, insertar pendiente y actualizar último envío.
6. Construir ficha, enlace estable, «Mis mensajes», edición versionada y borrado físico.
7. Implementar la jerarquía FR-002/FR-003: el mapa es la mayor región antes del formulario; la calidez se revisa cualitativamente y una allowlist de assets excluye fotografías del grupo y logotipos oficiales.
8. Separar fallos de datos del mapa, teselas CARTO y búsqueda Geoapify; ofrecer reintento manual sin remontar el formulario ni perder filtros, borrador o selección confirmada. Una selección firmada vigente sigue siendo publicable sin volver a llamar a Geoapify.

### Phase 3 — Review, moderation and account lifecycle

1. Crear «Pedir revisión» con snapshot privado de la versión y sin efecto automático sobre estado o visibilidad.
2. Implementar colas administrativas, decisión optimista por versión, suspensiones, roles de propietario, configuración y auditoría atómica.
3. Ejecutar purga diaria e idempotente de evidencia vencida mediante Supabase Cron, con ejecución manual verificable tras una restauración.
4. Implementar borrado de cuenta como saga persistente: ocultación y borrado local transaccional, llamada posterior a Clerk, job reintentable y webhook reconciliador.
5. Completar estados de suspensión, contacto, accesibilidad móvil y traducciones de motivos.

### Phase 4 — Release verification

1. Ejecutar el conjunto completo de gates documentado en [quickstart.md](./quickstart.md), incluido container build y carreras con dos conexiones PostgreSQL.
2. Ejecutar SC-001 y SC-002 sin retries, con hitos monotónicos, fixtures reproducibles y evidencia JSON de cada duración; cualquier recorrido fallido o fuera de umbral bloquea la salida.
3. Ejecutar los cuatro recorridos de SC-010 en Safari/iOS y Chrome/Android estables × 320/390 píxeles CSS × `en`/`es` (32 ejecuciones mínimas), afirmando ancho/locale y ausencia de overflow, controles inaccesibles y errores no gestionados.
4. Validar registro, recuperación, Google y borrado contra Clerk real; coreano/internacional y degradación contra Geoapify real; mapa, atribuciones y degradación contra CARTO real.
5. Provisionar roles mínimos y variables por entorno; previews solo lectura y sin cron/migraciones.
6. Confirmar región Vercel, cuotas, alertas, backups cifrados, restore drill, política de privacidad, dominio y correo de contacto.
7. Aplicar migraciones remotas en paso controlado, desplegar por integración Git y efectuar smoke test público antes de declarar el MVP listo.

## Migration and Rollback Strategy

- `supabase/migrations` es la fuente de verdad. Cada cambio se prueba desde cero en Supabase local y se revisa antes de `supabase db push --dry-run` y del único push remoto controlado.
- Los roles viven sin contraseñas en `supabase/roles.sql`; runtime, preview y migración usan credenciales diferentes. Previews no ejecutan migraciones.
- Los cambios siguen expansión → adopción de código → contracción posterior. Una reversión de aplicación nunca revierte ni destruye datos automáticamente.
- La salida de código se puede revertir a la versión anterior mientras el esquema expandido siga siendo compatible. Una contracción requiere verificar que no quedan despliegues activos dependientes.
- La eliminación física de mensajes y evidencias vencidas no tiene rollback funcional. Se cubre con confirmación, pruebas, alcance exacto, lotes idempotentes y backups cuya política no contradiga la retención de dos años.

## Release Gates

- CARTO: key provisionada y restringida por dominio, atribución visible, encaje del proyecto con términos gratuitos/no comerciales confirmado, cuota monitorizada y ninguna tesela proxificada o cacheada por la aplicación.
- Geoapify: endpoint europeo y DPA revisados, corpus coreano/internacional aprobado, atribución visible, rate limit operativo y prueba de ausencia de direcciones en DB/logs/telemetría.
- Supabase: Data API deshabilitada para producto, roles mínimos verificados, preview incapaz de leer tablas sensibles o escribir, consulta espacial explicada con `EXPLAIN (ANALYZE, BUFFERS)`.
- Clerk: correo verificado, contraseña, Google, vinculación, recuperación, webhook firmado y borrado idempotente comprobados con la integración real.
- Retención: purga de dos años, ejecución posterior a restore y tratamiento de evidencia en backups decididos y verificados antes de producción.
- Producto: evidencia cronometrada de SC-001/002 y matriz completa de SC-010 aprobadas sin retries; estados de fallo conservan la entrada; jerarquía y assets cumplen FR-003; todos los SC-001 a SC-010 satisfechos; ningún vestigio de «Me gusta» o reacciones en esquema, contratos, interfaz, pruebas o telemetría.
