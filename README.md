# ATINY World

Un mundo de buenos deseos para ATEEZ.

ATINY World será un mapa público y permanente de mensajes de ATINY, con ubicaciones elegidas por sus autoras, reacciones y moderación configurable.

## Estado

Primera base ejecutable en desarrollo: Next.js, TypeScript, pnpm, Clerk y la
conexión de servidor a PostgreSQL están configurados. El dominio de mensajes y
el mapa todavía no están implementados.

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
2. Cada comportamiento se expresa en español en `tests/acceptance/features/`.
3. Cucumber.js ejecuta los pasos TypeScript de `tests/acceptance/steps/`.
4. La implementación empieza con el escenario en rojo y termina con el
   escenario en verde; Vitest cubre las unidades y las integraciones técnicas.

Comandos principales:

```sh
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

También puede levantarse la aplicación y PostgreSQL con Docker:

```sh
docker compose up --build
```

Este modo usa `.env.local` para Clerk, publica Next.js en el puerto `3000` y
PostgreSQL en el `54332` para no colisionar con Supabase CLI.

## Iniciativa de fans

Proyecto no oficial, sin afiliación con ATEEZ ni su agencia.
