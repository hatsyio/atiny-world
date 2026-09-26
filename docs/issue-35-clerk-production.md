# Clerk Production para atiny world

Estado comprobado el 26 de septiembre de 2026 por CLI:

- Aplicación Clerk `app_3JI4zhFVA0aV562F9b7xpl7MB28`: nombre `atiny world`.
- Instancia Production `ins_3JsZ908qMscCJl9ToOnEX7SBSUl`, creada para `atiny-world.vercel.app`.
- Política Production: mínimo de 8 caracteres, `disable_hibp=false` y `enforce_hibp_on_sign_in=true`.
- `clerk deploy status`: `domain_pending`; falta configurar los CNAME de `clerk.atiny-world.vercel.app` y `accounts.atiny-world.vercel.app`. Al ser un subdominio de `vercel.app`, el proyecto no controla esos registros DNS. Es necesario un dominio propio administrable y cambiar el dominio de Clerk antes de activar Production.
- Google OAuth figura como `pending` en Production; requiere credenciales propias para esa instancia.

No sustituir las claves Development del despliegue por las de Production hasta que `clerk deploy status` esté completo y se verifiquen por correo y Google el registro, la recuperación de contraseña, los correos sin `[Development]` y los enlaces del perfil.
