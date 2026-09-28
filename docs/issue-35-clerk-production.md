# Clerk Production para atiny world

Estado comprobado el 28 de septiembre de 2026 mediante CLI, DNS y peticiones HTTPS. No se usó navegador.

## Entornos conectados a Vercel

| Vercel | Clerk | Dominio de Clerk |
| --- | --- | --- |
| Production | `clerk-rose-fountain` Production (`ins_3JJWZ8omb6bbRK5sEaO2KHhIxEG`) | `clerk.atiny-world.dynv6.net` |
| Preview y Development | `clerk-rose-fountain` Development (`ins_3JJWZ2zGQb2Mvn0biv4BEo3w6YH`) | `charming-puma-8856.clerk.accounts.dev` |

Production de Vercel tiene `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` con prefijo `pk_live_` y `CLERK_SECRET_KEY` con prefijo `sk_live_`. Preview y Development conservan las claves `pk_test_` y `sk_test_`. Las claves Production proceden de la instancia **conectada** a Vercel, no de la otra aplicación Clerk creada por separado. Los secretos no están en Git.

El despliegue Production `dpl_GKYANh3NBCTtnqqZsdiZkoB8jHLG` se reconstruyó desde `main` (`dfcea92ce938c447325fb6b9307d7a3824899ef3`) tras cambiar las variables. `https://atiny-world.dynv6.net/en`, `/en/sign-in` y `/en/sign-up` responden 200 y entregan `pk_live_`, sin `pk_test_`. La Frontend API de Clerk responde por HTTPS como Production. El dominio `atiny-world.dynv6.net` está verificado en Vercel; los cinco CNAME solicitados por Clerk están publicados en dynv6 y Clerk los muestra como verificados.

La aplicación Clerk separada `app_3JI4zhFVA0aV562F9b7xpl7MB28` tiene otro entorno Production pendiente de DNS para `atiny-world.vercel.app`. No usar sus claves ni su instancia: no está conectada a Vercel. El acceso Production de esta aplicación se hace por `https://atiny-world.dynv6.net`.

## Usuarios y datos

Clerk Production tenía cero usuarios en la última consulta. Clerk Development tenía tres usuarios. La base de datos remota compartida por Vercel Production y Preview conserva dos perfiles y dos cartas, vinculados a IDs de usuario Development. El propietario decidió crear cuentas nuevas en Production para probar el flujo y **no migrar ni borrar** ahora las cuentas o perfiles anteriores. Las nuevas cuentas tendrán IDs de Clerk distintos y no heredarán automáticamente los perfiles o cartas existentes.

La migración `20260926193130_public_name_signup.sql` está aplicada en la base local y remota. La revisión de seguridad de Supabase no encontró problemas. El cambio de registro de un solo nombre de la issue #35 está en la PR borrador #47; el despliegue Production actual usa todavía el código de `main`. Las pruebas de Production ahora sirven para comprobar la configuración de Clerk y el flujo de acceso existente. El flujo nuevo requerirá integrar la PR y desplegarlo.

## Pendiente de comprobación manual

- Crear el primer usuario real en `https://atiny-world.dynv6.net/en/sign-up`. Esto debería completar el check de Clerk “Create your first user in production”. Comprobar también el acceso y la recuperación de contraseña. El check “Set up environment variables” puede tardar en actualizarse aunque Vercel ya tenga las claves Production; comprobarlo de nuevo en Clerk.
- Configurar Google OAuth para la instancia Production conectada si se quiere probar acceso con Google. En la última consulta no había conexión social Production configurada.
- Cambiar el nombre visible `clerk-rose-fountain` a `atiny world` desde el panel de la aplicación Clerk conectada. La CLI de Clerk disponible solo administra la aplicación separada. Revisar después el nombre mostrado en formulario, correos y Google.
- Probar en navegador el flujo de la PR #47 (correo, Google, recuperación, textos y correos). La vista previa está protegida por Vercel SSO. El propietario pidió que el agente no utilice navegador.

El fichero local `ddclient` contiene una credencial de dynv6, está excluido de Git y tiene permisos `0600`. La API DynDNS configurada allí modifica el registro A; no ejecutar `ddclient` para detectar la IP local, porque sobrescribiría la dirección de Vercel.
