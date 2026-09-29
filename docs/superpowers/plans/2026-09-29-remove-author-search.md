# Impedir la búsqueda de cartas por autor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la búsqueda y el filtrado público de cartas por autor, conservando la exploración por mapa/ciudad y «Mis mensajes».

**Architecture:** Retirar `fan` de los contratos y consultas públicas del mapa, eliminar la ruta de búsqueda pública de usuarios y simplificar el estado del mapa a ciudad y país. La autoría seguirá siendo un dato de presentación de una carta pública individual o de un punto del mapa, pero no será una dimensión consultable.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, PostgreSQL/PostGIS, Vitest y Cucumber.

**Spec:** `https://github.com/hatsyio/atiny-world/issues/37`

## Global Constraints

- Las cartas públicas siguen apareciendo al explorar el mapa y al filtrar por ciudad.
- Las API públicas `/api/map/features` y `/api/map/messages` rechazan `fan` y no aplican filtros de autor.
- `/api/users/search` deja de formar parte del contrato público.
- «Mis mensajes» conserva su consulta privada por la identidad autenticada.
- No se eliminan `fan` como rol de perfil ni `author` de las respuestas de cartas públicas.

## Review Focus

- Una URL antigua con `fan` no debe obtener resultados del autor: prueba de parser y ambas rutas de mapa.
- Las URLs generadas por el mapa no deben serializar `fan`: prueba del controlador.
- El formulario de filtros no debe ofrecer nombre, usuario ni identificador de autor: prueba de componente.
- Una carta de otra persona debe seguir visible por viewport/ciudad y por enlace individual: contratos/B​​DD.
- La lista privada de mensajes propios debe seguir limitada a la sesión: pruebas de integración existentes.

### Task 1: Fijar el nuevo contrato con pruebas RED

**Files:**
- Modify: `tests/unit/server/http/map-params.test.ts`
- Modify: `tests/unit/components/map/public-map-controller.test.ts`
- Modify: `tests/unit/components/map/public-map.test.tsx`
- Modify: `tests/contract/public-map-api.test.ts`
- Modify: `tests/bdd/features/explorar-mapa.feature`
- Modify: `tests/bdd/step_definitions/explorar-mapa.steps.ts`

- [x] Añadir pruebas que rechacen `fan` en el parser y en ambas API, y que comprueben que `buildFeatureRequest`/`buildMessageRequest` solo contienen ciudad y país.
- [x] Cambiar el escenario BDD de filtro por autor por exploración por ciudad y eliminar la búsqueda de fans del escenario de sesión anónima.
- [x] Ejecutar los tests afectados y confirmar fallos por el comportamiento actual.

### Task 2: Retirar autor del mapa y de las consultas públicas

**Files:**
- Modify: `src/server/http/map-params.ts`
- Modify: `src/app/api/map/features/route.ts`
- Modify: `src/app/api/map/messages/route.ts`
- Modify: `src/server/messages/public-repository.ts`
- Modify: `src/components/map/map-filters.tsx`
- Modify: `src/components/map/public-map-controller.tsx`

- [x] Eliminar `fan` de `MapQueryParams`, del esquema estricto, de las opciones del repositorio y de los argumentos de paginación.
- [x] Mantener el rechazo 400 de parámetros desconocidos, incluyendo `fan`, sin pasarlos al repositorio.
- [x] Eliminar el input Fan y reducir el estado/serialización del mapa a ciudad y país.
- [x] Ejecutar las pruebas unitarias y de contrato y corregir únicamente fallos de este flujo.

### Task 3: Eliminar búsqueda pública de usuarios

**Files:**
- Delete: `src/app/api/users/search/route.ts`
- Modify: `src/server/http/map-params.ts`
- Modify: `src/server/messages/public-repository.ts`
- Modify: `tests/contract/public-map-api.test.ts`
- Modify: `tests/bdd/step_definitions/explorar-mapa.steps.ts`

- [x] Eliminar `parseUserSearchQuery`, `PublicUserPage` y `searchPublicUsers` junto con los imports y pruebas del contrato retirado.
- [x] Verificar que no quedan enlaces, fetches ni imports de `/api/users/search`.
- [x] Ejecutar typecheck y el contrato público para detectar consumidores restantes.

### Task 4: Actualizar especificación, HTTP, BDD y documentación

**Files:**
- Modify: `specs/001-atiny-world-mvp/spec.md`
- Modify: `specs/001-atiny-world-mvp/data-model.md`
- Modify: `specs/001-atiny-world-mvp/contracts/http-api.yaml`
- Modify: `specs/001-atiny-world-mvp/contracts/ui-behavior.md`
- Modify: `specs/001-atiny-world-mvp/plan.md`
- Modify: `specs/001-atiny-world-mvp/tasks.md`
- Modify: `docs/requisitos.md`
- Modify: `docs/arquitectura.md`

- [x] Eliminar de los contratos la búsqueda de usuarios como mecanismo de localización de cartas.
- [x] Documentar que la autoría se muestra, pero no se puede buscar ni filtrar; conservar ciudad/país y la vista privada propia.
- [x] Revisar BDD completo para que sus nombres y pasos no prometan búsqueda por autor.

### Task 5: Verificación final

- [x] Ejecutar `pnpm lint`.
- [x] Ejecutar `pnpm typecheck`.
- [x] Ejecutar `pnpm test:unit`.
- [x] Ejecutar `pnpm test:contract` y `pnpm test:bdd` con la base de datos local disponible.
- [x] Revisar `git diff`, buscar referencias residuales a `fan` en el contexto de filtro/búsqueda y comprobar que «Mis mensajes» no ha cambiado.
