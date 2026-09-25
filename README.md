# ATINY World

Un mundo de buenos deseos para ATEEZ.

ATINY World será un mapa público y permanente de mensajes de ATINY, con ubicaciones elegidas por sus autoras y moderación configurable.

## Estado

La base ejecutable incluye Next.js, TypeScript, pnpm, Clerk, persistencia en
PostgreSQL, mapa público y creación de mensajes. Moderación y gestión de
mensajes siguen en desarrollo.

## Documentación

- [Requisitos de producto](docs/requisitos.md): alcance de la primera versión y mejoras futuras.
- [Arquitectura](docs/arquitectura.md): tecnologías, modelo de datos, permisos, entornos y migraciones.
- [Entorno local](docs/desarrollo-local.md): arranque de Supabase y estado de la infraestructura.
- [Plan de implementación](docs/superpowers/plans/2026-09-13-atiny-world.md): entregas previstas y trabajo pendiente.

## Tecnologías acordadas

- Next.js con TypeScript: frontend y backend en un mismo proyecto, desplegados en Vercel.
- Clerk: autenticación con contraseña y Google.
- Supabase PostgreSQL: persistencia, accesible únicamente mediante el backend.
- Leaflet y CARTO: visualización del mapa.
- Geoapify: búsqueda de ubicaciones.

Interfaz en inglés y español, con mensajes en cualquier idioma, incluido coreano.

## Desarrollo y publicación

Desarrollo con Supabase local y un único proyecto remoto para producción. Las previews usarán acceso de solo lectura por defecto; cualquier escritura requerirá autorización específica. Las migraciones se probarán localmente y se aplicarán mediante un flujo compatible con las versiones activas.

Las credenciales y la configuración local no se incluyen en el repositorio.
Consulta [Entorno local](docs/desarrollo-local.md) para instalar dependencias,
arrancar Supabase y ejecutar la aplicación.

## Flujo de desarrollo

El desarrollo sigue `Specs → Gherkin → BDD`:

1. Las decisiones se mantienen en `docs/requisitos.md` y `docs/arquitectura.md`.
2. Cada comportamiento se expresa en español en `tests/bdd/features/`.
3. Cucumber.js ejecuta los pasos TypeScript de
   `tests/bdd/step_definitions/`.
4. La implementación empieza con el escenario en rojo y termina con el
   escenario en verde.

Las pruebas están separadas por propósito: `tests/bdd` contiene comportamiento
de producto, `tests/unit` unidades aisladas de aplicación y servidor, y
`tests/integration` colaboración real con infraestructura. Vitest genera la
cobertura técnica con el proveedor V8.

Los literales TypeScript usan comillas simples, exigidas por ESLint. Los
atributos JSX conservan las comillas dobles convencionales.

Comandos principales:

```sh
pnpm install
pnpm test
pnpm test:integration
pnpm test:contract
pnpm test:coverage
pnpm lint
pnpm typecheck
pnpm build
```

GitHub Actions valida lint, tipos, BDD, pruebas unitarias, integración,
contratos, cobertura, build de Next.js, migraciones de Compose y build de Docker. Vercel gestiona los despliegues:
crea una preview para cada pull request y publica producción al integrar en
`main`.

También puede levantarse la aplicación con Docker Compose usando uno de dos perfiles:

```sh
cp .env.example .env  # solo la primera vez; completa las claves locales
pnpm docker:up       # app y PostgreSQL local
pnpm docker:up:pro   # app conectada al PostgreSQL remoto
```

Un único `compose.yaml` usa `.env` para Clerk de desarrollo en ambos
perfiles. El perfil `pro` añade `.env.pro` para sustituir solo la
URL de PostgreSQL. El modo local publica PostgreSQL con PostGIS en el puerto `54332` y
aplica las migraciones pendientes antes de arrancar la aplicación. El modo
`pro` no levanta ni migra una base de datos; requiere `DATABASE_URL` de una
cuenta de aplicación en `.env.pro`. `.env.example` documenta las variables.

## Iniciativa de fans

Proyecto no oficial, sin afiliación con ATEEZ ni su agencia.
