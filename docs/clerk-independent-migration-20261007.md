# Clerk independiente y dominio atinyatlas.com

Configuración aplicada el 7 de octubre de 2026 mediante CLI y API, sin navegador automatizado.

## Aplicación y entornos

La aplicación Clerk independiente `Atiny Atlas` (`app_3JI4zhFVA0aV562F9b7xpl7MB28`) sustituye a `clerk-rose-fountain`. El recurso antiguo y la instalación Clerk de Vercel Marketplace se eliminaron con autorización del propietario después de respaldar e importar las cuentas. El dominio antiguo estaba bloqueado por Marketplace y no podía liberarse mediante `change_domain`.

El 7 de octubre de 2026 se cambió el nombre de la aplicación de `atiny world` a `Atiny Atlas` mediante la Platform API de Clerk. Se comprobó que `/v1/environment` devuelve `display_config.application_name = "Atiny Atlas"` tanto en Production como en Development. Este es el nombre que reciben los componentes de acceso y registro; se conservaron el ID de aplicación, las instancias, las cuentas, las claves y los dominios.

La comprobación posterior en Chrome confirmó que una pestaña ya abierta todavía mostraba el nombre anterior. En una ventana de incógnito, `https://atinyatlas.com/sign-in` mostró «para continuar a Atiny Atlas». Recargar permite que una pestaña abierta vuelva a cargar la configuración de Clerk; si ya existe una sesión, puede redirigir al flujo de continuación.

| Vercel | Clerk | Instancia |
| --- | --- | --- |
| Production | Production, `clerk.atinyatlas.com` | `ins_3JsZ908qMscCJl9ToOnEX7SBSUl` |
| Preview y Development | Development | `ins_3JI4zlaxSHiw0ceHPoANGewfKJD` |

Las variables `CLERK_SECRET_KEY` y `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` se administran manualmente en Vercel. Production usa claves live y el secreto sensible; Preview y Development usan las claves test de la aplicación independiente. El archivo local `.env` también usa la nueva instancia Development. Los secretos y los CSV de usuarios están fuera de Git.

El despliegue Production `dpl_578PiSZ9qyfaYEZeiwfQjCy96HU7` se reconstruyó desde el despliegue anterior para incorporar las variables nuevas y quedó `READY`, con alias `https://atinyatlas.com`. Tanto `www.atinyatlas.com` como `atiny-world.dynv6.net` redirigen al dominio principal mediante HTTP 308.

## DNS y Google

Los servidores autoritativos son los de Vercel. Los CNAME de Clerk son:

| Host | Destino |
| --- | --- |
| `clerk` | `frontend-api.clerk.services` |
| `accounts` | `accounts.clerk.services` |
| `clkmail` | `mail.1nxk9g7xu2np.clerk.services` |
| `clk._domainkey` | `dkim1.1nxk9g7xu2np.clerk.services` |
| `clk2._domainkey` | `dkim2.1nxk9g7xu2np.clerk.services` |

Google está habilitado para registro y acceso en Production con credenciales propias. La URI autorizada en Google Cloud es `https://clerk.atinyatlas.com/v1/oauth_callback`. La petición de autorización a Google acepta esta URI sin `redirect_uri_mismatch`.

## Conservación de cuentas y cartas

Se importaron 26 cuentas Production y 5 Development, incluyendo las 21 contraseñas bcrypt existentes y 11 fotos de perfil. Se conservaron correos, usernames, metadatos y estados de bloqueo. El ID de Clerk anterior se guardó como `external_id` en cada cuenta nueva.

En una transacción se actualizaron los `clerk_user_id` de 29 perfiles. Se conservaron los 30 perfiles existentes, sus IDs, UUID públicos, nombres, roles y demás datos. Un perfil sin correspondencia en las cuentas exportadas quedó intacto. Las 21 cartas, 19 acciones de moderación, 31 entradas de auditoría y la configuración mantuvieron exactamente su contenido, comprobado mediante recuentos y huellas antes y después de la actualización. Las sesiones anteriores deben volver a iniciarse.

Los respaldos privados, CSV, mapas de IDs y configuración se conservan localmente en `~/.local/share/atiny-world/clerk-migration-20261007`, con directorios 0700 y archivos 0600. No deben subirse al repositorio.

## Verificación

Se verificaron las cuentas importadas, los vínculos de perfiles, las variables no gestionadas por Marketplace y las respuestas HTTP 200 de `/`, `/sign-in`, `/sign-up` y `/api/health`. La página de acceso contiene la clave pública Production actual. La Frontend API responde por HTTPS, muestra Google activo y sus claves públicas JWKS coinciden con la instancia independiente.

La comprobación final de Clerk confirmó el estado global `complete`, con DNS, SSL de ambos hosts y correo completos. El propietario probó el acceso real con su cuenta habitual y confirmó que las cartas y el panel de administración funcionan correctamente.
