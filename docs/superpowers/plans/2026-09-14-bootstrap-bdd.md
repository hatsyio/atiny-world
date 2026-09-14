# ATINY World Bootstrap and BDD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar una aplicación Next.js ejecutable con TypeScript, pnpm, Clerk y una conexión PostgreSQL de Supabase encapsulada en servidor, usando Specs → Gherkin → BDD como flujo de desarrollo.

**Architecture:** Next.js App Router mantiene UI y adaptadores HTTP; `src/server` contiene integraciones de servidor y `src/domain` contendrá reglas puras. Los escenarios Gherkin en español son criterios de aceptación ejecutables mediante Cucumber.js; Vitest cubre unidades y adaptadores aislados.

**Tech Stack:** Node.js 24, pnpm 12, TypeScript 5.9, Next.js 16, React 19, Clerk 7, Postgres.js, Cucumber.js y Vitest 5.

**Spec:** `docs/requisitos.md` y `docs/arquitectura.md`.

## Global Constraints

- pnpm es el único gestor de paquetes y `pnpm-lock.yaml` se versiona.
- Todo el código propio se escribe en TypeScript estricto.
- Cada comportamiento de producto parte de escenarios Gherkin trazables a las especificaciones; las comprobaciones de infraestructura son pruebas técnicas.
- El navegador nunca recibe credenciales de PostgreSQL ni accede directamente a Supabase.
- Clerk gestiona identidad; roles, perfiles y suspensiones pertenecerán a PostgreSQL.
- Se usa Node.js, no Edge Runtime.
- No se crea otro proyecto Supabase ni se activa un plan de pago.

---

### Task 1: Toolchain and executable Gherkin harness

**Files:**
- Create: `.node-version`
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `cucumber.mjs`
- Create: `tests/bdd/features/bootstrap.feature`
- Create: `tests/bdd/step_definitions/bootstrap.steps.ts`

**Interfaces:**
- Produces: scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:unit`, `test:bdd`.

- [x] **Step 1: Escribir el escenario Gherkin inicial**

```gherkin
# language: es
Característica: Base ejecutable de ATINY World
  Escenario: La aplicación identifica el proyecto
    Cuando consulto la identidad pública de la aplicación
    Entonces el nombre es "ATINY World"
```

- [x] **Step 2: Configurar pnpm, TypeScript, Vitest y Cucumber sin implementar la identidad**

Crear la configuración y una definición de pasos que importe `getPublicAppIdentity` desde `src/app-identity.ts`, todavía inexistente.

- [x] **Step 3: Ejecutar el escenario y verificar RED**

Run: `pnpm test:bdd`
Expected: FAIL porque `src/app-identity.ts` no existe.

- [x] **Step 4: Implementar la identidad mínima**

```ts
export function getPublicAppIdentity() {
  return { name: "ATINY World" } as const
}
```

- [x] **Step 5: Ejecutar BDD y verificar GREEN**

Run: `pnpm test:bdd`
Expected: PASS, 1 scenario.

### Task 2: Next.js shell with Clerk

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/proxy.ts`
- Create: `src/server/auth/session.ts`
- Create: `tests/unit/server/auth/session.test.ts`

**Interfaces:**
- Consumes: `getPublicAppIdentity(): { readonly name: "ATINY World" }`.
- Produces: `getSessionIdentity(): Promise<{ clerkUserId: string } | null>`.

- [x] **Step 1: Escribir una prueba unitaria de sesión anónima y autenticada**

La prueba inyecta un lector de Clerk y exige `null` sin `userId` y `{ clerkUserId }` cuando existe.

- [x] **Step 2: Ejecutar la prueba y verificar RED**

Run: `pnpm test:unit tests/unit/server/auth/session.test.ts`
Expected: FAIL porque el módulo no existe.

- [x] **Step 3: Implementar el adaptador mínimo y el shell de aplicación**

El layout usa `ClerkProvider` dentro de `body`; `src/proxy.ts` usa `clerkMiddleware`; la página muestra la identidad pública y controles de sesión de Clerk.

- [x] **Step 4: Ejecutar pruebas, lint y tipos**

Run: `pnpm test:unit && pnpm lint && pnpm typecheck`
Expected: PASS.

- [x] **Step 5: Expresar la resolución de sesión en Gherkin**

Los escenarios de aceptación cubren tanto la visitante anónima como la fan
identificada sin depender de una cuenta externa durante la suite local.

### Task 3: Server-only PostgreSQL connection

**Files:**
- Modify: `.env.example`
- Create: `src/server/env.ts`
- Create: `src/server/db/client.ts`
- Create: `src/server/db/health.ts`
- Create: `src/app/api/health/route.ts`
- Create: `tests/unit/server/env.test.ts`
- Create: `tests/unit/server/db/health.test.ts`

**Interfaces:**
- Produces: `getDatabaseUrl(env?: NodeJS.ProcessEnv): string`, `getDb(): Sql`, `checkDatabaseHealth(sql?: HealthSql): Promise<DatabaseHealth>`.

- [x] **Step 1: Escribir pruebas para configuración ausente y health check**

Exigir error explícito sin `DATABASE_URL`, aceptación de una URL presente y resultado `{ database: "ok" }` cuando `select 1` responde.

- [x] **Step 2: Ejecutar pruebas y verificar RED**

Run: `pnpm test:unit tests/unit/server/env.test.ts tests/unit/server/db/health.test.ts`
Expected: FAIL porque los módulos no existen.

- [x] **Step 3: Implementar cliente perezoso y health check**

Postgres.js se inicializa solo al pedirlo, con `max: 1`, `prepare: false` y SSL únicamente para conexiones remotas. La ruta devuelve 200/503 sin revelar detalles sensibles.

- [x] **Step 4: Verificar con Supabase local**

Run: `supabase start`, configurar `DATABASE_URL` localmente y ejecutar `pnpm test:integration`.
Expected: PASS con `select 1` real.

- [x] **Step 5: Cubrir técnicamente las respuestas HTTP de salud**

Las pruebas unitarias verifican el `200` saludable y el `503` sanitizado. Las
comprobaciones PostgreSQL, Docker y Compose permanecen fuera de BDD por ser
infraestructura técnica.

### Task 4: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/desarrollo-local.md`
- Modify: `docs/superpowers/plans/2026-09-13-atiny-world.md`

**Interfaces:**
- Consumes: todos los scripts y variables definidos anteriormente.

- [x] **Step 1: Documentar el flujo Specs → Gherkin → BDD**

Explicar la ubicación de specs, features y steps, y el ciclo RED/GREEN para cada entrega.

- [x] **Step 2: Documentar pnpm, Clerk y PostgreSQL local**

Incluir instalación, variables por nombre y comandos sin valores secretos.

- [x] **Step 3: Ejecutar la verificación completa**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`
Expected: PASS sin advertencias de aplicación.

- [x] **Step 4: Revisar secretos y estado Git**

Run: `git diff --check` y búsqueda de patrones de credenciales en archivos versionables.
Expected: sin secretos ni errores de whitespace.

- [x] **Step 5: Separar suites y automatizar la integración continua**

Organizar BDD, unitarias e integración bajo `tests/`, añadir cobertura V8 y
validar pruebas, estilo, tipos, Next.js y Docker mediante GitHub Actions. Vercel
gestiona previews y producción mediante su integración con GitHub.
