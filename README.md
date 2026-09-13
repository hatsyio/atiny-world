# ATINY World

Un mundo de buenos deseos para ATEEZ.

ATINY World será un mapa público y permanente de mensajes de ATINY, con ubicaciones elegidas por sus autoras, reacciones y moderación configurable.

## Estado

Proyecto en fase de especificación y preparación técnica. Este repositorio contiene los requisitos y las decisiones de arquitectura acordadas; todavía no incluye una aplicación ejecutable.

## Documentación

- [Requisitos de producto](docs/requisitos.md): alcance de la primera versión y mejoras futuras.
- [Arquitectura](docs/arquitectura.md): tecnologías, modelo de datos, permisos, entornos y migraciones.
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

Las credenciales y la configuración local no se incluyen en el repositorio. Los pasos de instalación se documentarán cuando exista la base ejecutable de la aplicación.

## Iniciativa de fans

Proyecto no oficial, sin afiliación con ATEEZ ni su agencia.
