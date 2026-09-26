# Clerk Production para atiny world

Estado comprobado el 26 de septiembre de 2026 por CLI:

- Aplicación Clerk `app_3JI4zhFVA0aV562F9b7xpl7MB28`: nombre `atiny world`.
- El despliegue público `atiny-world.vercel.app` y la vista previa usan las claves Development de Clerk. Las plantillas de verificación y recuperación incluyen `{{app.name}}` en el cuerpo, por lo que muestran `atiny world`; los correos conservan el prefijo `[Development]` mientras se utilice esa instancia.
- Development: registro con correo verificado y Google habilitados; mínimo de contraseña de 8 caracteres, `disable_hibp=false` y `enforce_hibp_on_sign_in=true`.
- La migración `20260926193130_public_name_signup.sql` está aplicada en la base de datos local y en la base remota compartida por Vercel Production y Preview. Los dos perfiles existentes conservan sus datos. La revisión de seguridad de Supabase no encontró problemas.
- Instancia Production `ins_3JsZ908qMscCJl9ToOnEX7SBSUl`, creada para `atiny-world.vercel.app`.
- Política Production: mínimo de 8 caracteres, `disable_hibp=false` y `enforce_hibp_on_sign_in=true`.
- `clerk deploy status`: `domain_pending`; falta configurar los CNAME de `clerk.atiny-world.vercel.app` y `accounts.atiny-world.vercel.app`. Al ser un subdominio de `vercel.app`, el proyecto no controla esos registros DNS. Es necesario un dominio propio administrable y cambiar el dominio de Clerk antes de activar Production.
- Google OAuth figura como `pending` en Production; requiere credenciales propias para esa instancia.

La vista previa de la PR #47 está protegida por Vercel SSO y utiliza la base de datos remota. Queda pendiente la comprobación manual en navegador del registro por correo y Google, la recuperación de contraseña y los correos.

No sustituir las claves Development del despliegue por las de Production hasta que `clerk deploy status` esté completo y se verifiquen por correo y Google el registro, la recuperación de contraseña, los correos sin `[Development]` y los enlaces del perfil. Se puede seguir usando `atiny-world.vercel.app` con Development sin comprar un dominio ahora; el cambio a Clerk Production queda para cuando haya un dominio cuyo DNS se pueda administrar.
