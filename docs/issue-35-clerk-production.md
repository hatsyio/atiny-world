# Clerk Production para atiny world

Estado comprobado el 26 de septiembre de 2026 por CLI:

- `atiny-world.vercel.app` y las vistas previas usan las claves de la instancia Development de Clerk `clerk-rose-fountain` (`ins_3JJWZ2zGQb2Mvn0biv4BEo3w6YH`), provisionada por Vercel Marketplace. Su dominio de autenticación es `charming-puma-8856.clerk.accounts.dev`. El nombre público que devuelve esa instancia sigue siendo `clerk-rose-fountain`.
- La instancia conectada tiene tres usuarios; dos corresponden a los dos perfiles existentes en la base remota. Hay que conservar sus claves hasta planificar una migración de identidades.
- La aplicación Clerk separada `app_3JI4zhFVA0aV562F9b7xpl7MB28` sí se llama `atiny world`, pero no está conectada a Vercel y su instancia Development no tiene usuarios. En ella están configurados correo verificado, Google, un mínimo de contraseña de 8 caracteres y la comprobación de contraseñas comprometidas. Estos ajustes no modifican la instancia conectada.
- La migración `20260926193130_public_name_signup.sql` está aplicada en la base de datos local y en la base remota compartida por Vercel Production y Preview. Los dos perfiles existentes conservan sus datos. La revisión de seguridad de Supabase no encontró problemas.
- Instancia Production `ins_3JsZ908qMscCJl9ToOnEX7SBSUl`, creada en la aplicación separada para `atiny-world.vercel.app`.
- Política Production: mínimo de 8 caracteres, `disable_hibp=false` y `enforce_hibp_on_sign_in=true`.
- `clerk deploy status`: `domain_pending`; falta configurar los CNAME de `clerk.atiny-world.vercel.app` y `accounts.atiny-world.vercel.app`. Al ser un subdominio de `vercel.app`, el proyecto no controla esos registros DNS. Es necesario un dominio propio administrable y cambiar el dominio de Clerk antes de activar Production.
- Google OAuth figura como `pending` en Production; requiere credenciales propias para esa instancia.

La vista previa de la PR #47 está protegida por Vercel SSO y utiliza la base de datos remota. Queda pendiente la comprobación manual en navegador del registro por correo y Google, la recuperación de contraseña y los correos.

La instancia conectada debe renombrarse a `atiny world` desde el panel de Clerk al que conduce el recurso `clerk-rose-fountain` de Vercel Marketplace. La CLI de Vercel no ofrece cambio de nombre para ese recurso y el acceso CLI de Clerk disponible solo administra la aplicación separada. Hay que comprobar después el nombre en el formulario, la ventana de Google y los correos. El dominio aleatorio `accounts.dev` y el prefijo `[Development]` seguirán apareciendo mientras se utilice Development.

No sustituir las claves de la instancia conectada por las de la aplicación separada: sus usuarios no se transfieren automáticamente y se perdería el vínculo con los perfiles. Antes de activar Production hace falta resolver el dominio, planificar la migración de identidades y verificar por correo y Google el registro, la recuperación de contraseña y los enlaces del perfil.

Clerk indica que Development **no es apta para usuarios reales en producción**: usa un dominio `accounts.dev` en el portal y en OAuth, añade `[Development]` a los correos, tiene un límite de 100 usuarios y sus usuarios no se transfieren a Production. Además, su manejo de sesión no tiene la postura de seguridad de Production. Por tanto, `atiny-world.vercel.app` con estas claves debe tratarse como un entorno de pruebas cerrado; no se debe invitar al público a registrarse hasta activar Production con un dominio cuyo DNS se pueda administrar. Véase [Clerk: Instances / Environments](https://clerk.com/docs/guides/development/managing-environments).
