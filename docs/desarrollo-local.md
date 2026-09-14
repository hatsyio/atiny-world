# Supabase: preparación del entorno

## Estado

Entorno local inicializado con Supabase CLI 2.109.1 y PostgreSQL 17.
Verificado el 13 de septiembre de 2026 mediante una consulta SQL: PostgreSQL
17.6 responde correctamente. Todavía no hay tablas de la aplicación.

Proyecto remoto creado y vinculado: `atiny-world`, región París (`eu-west-3`),
referencia `ngwsobelmdwiqsdmuonw`, organización «Josep Test» (plan Free confirmado
por el propietario). Instancia nano, estado `ACTIVE_HEALTHY`. PostgreSQL 17.6
verificado mediante una consulta SQL de solo lectura el 13 de septiembre de 2026.

[Panel del proyecto](https://supabase.com/dashboard/project/ngwsobelmdwiqsdmuonw).
La contraseña generada se guarda únicamente en `.env.production.local`, con
permisos de archivo `600` y excluido de Git. Es una credencial de administración;
no es la futura credencial de la aplicación ni debe usarse para previews.
La vinculación de la CLI se guarda en `supabase/.temp/`, también excluido de Git.

Para vincular otro checkout: `supabase link --project-ref ngwsobelmdwiqsdmuonw`.
Proporcionar la contraseña por el mecanismo privado de la CLI, sin publicarla.
Usar siempre `--local` en las consultas de desarrollo; `--linked` apunta a producción.

## Uso local

Requisitos: Node.js 24.16, pnpm 12.3, Docker en ejecución y Supabase CLI
2.109.1. Las versiones de Node.js y pnpm están fijadas en `.node-version` y
`package.json`.
Desde la raíz del repositorio:

```sh
pnpm install
supabase start
supabase db query --local 'select 1 as ok;'
pnpm test:db
pnpm dev
```

La aplicación queda disponible en `http://localhost:3000` y su comprobación de
PostgreSQL en `http://localhost:3000/api/health`. El desarrollo utiliza la URL
local no sensible guardada en `.env.development.local`; Clerk se descarga desde
Vercel a `.env.local`. Ninguno de esos archivos se versiona.

## Docker Compose

El modo Docker levanta Next.js y PostgreSQL 17 con un solo comando. Antes del
primer arranque, `.env.local` debe contener las variables de Clerk; pueden
descargarse sin imprimir sus valores:

```sh
vercel env pull .env.local --yes
chmod 600 .env.local
docker compose up --build
```

La aplicación usa recarga en caliente sobre el checkout local. PostgreSQL se
publica únicamente en `127.0.0.1:54332`, mientras el contenedor de aplicación
se conecta a `db:5432`. Se usa un puerto
distinto de `54322` para que este Compose pueda convivir con Supabase CLI.

Comandos operativos:

```sh
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

`docker compose down` detiene los servicios y conserva los volúmenes
`postgres_data`, `node_modules` y `next_cache`. Para borrar también los datos
locales se requiere la orden destructiva explícita `docker compose down -v`.

Este Compose incluye solo PostgreSQL porque la aplicación usa Clerk y mantiene
Auth, Storage, Realtime y Edge Runtime de Supabase desactivados. Las migraciones
SQL seguirán siendo compatibles con Supabase PostgreSQL y se validarán además
con `supabase start` antes de aplicarlas remotamente.

`supabase stop` conserva los datos locales. Evitar `--no-backup` si se quieren
conservar. `supabase db reset` elimina los datos locales y reconstruye el esquema;
solo debe utilizarse cuando se acepte perder esos datos de desarrollo.

PostgreSQL escucha en `127.0.0.1:54322`, la API en `127.0.0.1:54321`
y Studio en `http://127.0.0.1:54323`. `supabase status` muestra los detalles de
conexión: no copiar sus claves a documentación, commits o conversaciones.

La configuración local mantiene PostgreSQL, API y Studio. Auth, Storage,
Realtime, correo local, Edge Runtime y Analytics están desactivados porque
la aplicación usará Clerk y un backend en Next.js. Los seeds están desactivados
hasta disponer de datos de desarrollo. Esta configuración no se ha aplicado
a ningún proyecto remoto.

## Pruebas y BDD

Las especificaciones de producto y arquitectura originan escenarios Gherkin en
español. Las features viven en `tests/acceptance/features/` y sus definiciones
TypeScript en `tests/acceptance/steps/`.

```sh
pnpm test:bdd
pnpm test:unit
pnpm test:db
pnpm test
```

Para cada comportamiento nuevo se añade primero un escenario o prueba que falle
por la ausencia del comportamiento, se implementa el mínimo y se vuelve a
ejecutar hasta obtener verde. `pnpm test` ejecuta unidades y aceptación; las
pruebas de PostgreSQL se invocan aparte porque requieren Supabase local activo.

## Servicios remotos

Clerk Hobby está provisionado mediante Vercel Marketplace y conectado a
development, preview y production. Supabase continúa siendo el proyecto remoto
existente, sin crear un recurso duplicado en Marketplace. La credencial de
aplicación remota y el rol de solo lectura para previews siguen pendientes del
esquema de datos; no se reutilizará la contraseña administrativa.

## Migraciones y previews

Crear cada migración con `supabase migration new nombre`, revisarla y probarla
localmente. La aplicación en producción requiere un paso separado y controlado;
nunca ejecutar migraciones desde un build de preview.

Las previews deberán usar un rol específico con permisos de solo lectura sobre
los datos autorizados. Ese rol todavía no está creado: se definirá junto con el
esquema y sus permisos. No utilizar credenciales de administrador para previews.

Los cambios de esquema seguirán expand/contract: primero cambios compatibles,
después la funcionalidad y, cuando dejen de existir versiones dependientes,
las eliminaciones. No conectar producción al desarrollo local.

Referencia: [desarrollo local de Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started).
