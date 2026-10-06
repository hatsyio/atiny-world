# Usuarios y roles del panel administrativo

La sesión de Clerk identifica al usuario. `app_private.profiles.role` es la fuente de permisos; no se usan metadatos de Clerk ni Organizations. Las cuentas nuevas reciben `fan`.

## Entrega

- `/admin` conduce a `/admin/users`. El acceso se ofrece como entrada «Administración» en el desplegable de Mi cuenta a administradores y propietarios activos. El servidor comprueba el rol antes de mostrarla.
- `admin` y `owner` pueden buscar perfiles por nombre o ID de Clerk y consultar rol y estado. Resultados paginados de 25 cuentas; no se envían IDs de Clerk ni detalles de suspensión al navegador.
- Solo `owner` puede alternar `fan` y `admin`. No se puede otorgar ni retirar `owner` desde la web ni actuar sobre perfiles pendientes de borrado.
- La acción toma la identidad de la sesión, valida los valores, bloquea actor y destinatario en orden estable y vuelve a comprobar sus roles vigentes. Un trigger aumenta `role_version` en cada cambio y permite rechazar formularios antiguos incluso después de conceder y retirar el mismo rol.
- El cambio y su auditoría se guardan en una transacción. El runtime puede leer e insertar auditoría, pero no modificarla ni borrarla. La base de datos privada sigue inaccesible desde las credenciales públicas y las vistas previas.

Esta entrega cubre la base del panel y la gestión de roles. La moderación de mensajes se entrega en la siguiente iteración, documentada en `docs/admin-moderation.md`. Las pantallas de solicitudes, suspensión, configuración y consulta del historial siguen pendientes en US5. No se marca US5 completa.

## Primer propietario

El usuario autorizó el correo `joseppascualbadia@gmail.com` para desarrollo y producción. El script consulta la instancia correspondiente de Clerk, exige una coincidencia exacta con correo verificado y un username, y mantiene intacto un perfil existente. No crea cuentas de Clerk.

Aplicar primero `20261006120000_admin_roles_audit.sql` y `20261006121000_profile_role_version.sql` mediante el sistema de migraciones de cada entorno. Para revisar la identidad sin escribir:

```sh
pnpm exec tsx scripts/bootstrap-owner.ts dev joseppascualbadia@gmail.com
pnpm exec tsx scripts/bootstrap-owner.ts pro joseppascualbadia@gmail.com
```

Tras revisar los identificadores, añadir `--apply`. El script es idempotente y rechaza añadir o reemplazar un propietario distinto. No es un endpoint web. Usa `.env` para desarrollo, y combina `.env.pro` y `.env.clerk-production.local` para producción. Las credenciales están excluidas de Git y no se imprimen.

Preview y producción comparten la base remota, aunque sus instancias de Clerk tienen IDs distintos. Para habilitar también el propietario de desarrollo en esa base, usar `dev <email> --remote-db --apply`. Antes de admitir el propietario existente de la otra instancia, el script comprueba de manera independiente el mismo correo exacto y verificado en ella; no admite propietarios ajenos.

## Estado aplicado el 6 de octubre de 2026

- Desarrollo local de Compose: `tavivito93`, rol `owner`.
- Producción: `hachikisu`, rol `owner`.
- Preview/desarrollo contra la base remota: `tavivito93`, rol `owner`; coexistencia verificada con la identidad de producción.
- Las dos migraciones están aplicadas en Compose y en el proyecto Supabase `atiny-world`.
- El panel de roles está integrado en `main` mediante la PR #76. La siguiente entrega de moderación está documentada en `docs/admin-moderation.md`.

La base de Compose (`54332`) y la de pruebas de Supabase (`54322`) son distintas: la suite nunca debe ejecutarse contra la base de uso real ni contra producción. El reset de una base local elimina también su asignación de propietario, que debe repetirse expresamente.

## Verificación

Las pruebas cubren acceso directo al panel y acciones, identidad de sesión frente a actor falsificado, revocación de privilegios, restricciones de roles, formularios obsoletos, búsqueda literal y rollback del cambio si falla la auditoría. La asignación inicial es idempotente y no sustituye un propietario existente.

Resultado: 37 escenarios BDD, 423 pruebas unitarias, 80 pruebas de integración y 51 de contrato correctas; TypeScript, ESLint y build correctos. La revisión independiente detectó el caso de formulario antiguo tras conceder y retirar un rol; la versión monotónica lo corrige y su prueba pasa. Se corrigió además una aserción inestable de ubicación aproximada: un desplazamiento puede mantener una coordenada, pero debe cambiar el punto.

El bloqueo de filas sigue las garantías de [PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html). La búsqueda del propietario usa el filtro de correo de [Clerk getUserList](https://clerk.com/docs/reference/backend/user/get-user-list).
