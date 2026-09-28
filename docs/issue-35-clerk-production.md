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

La PR #47 ya se integró en `main`. Después, el propietario decidió usar el campo `username` de Clerk como nombre visible para simplificar el registro. Eso implica los límites y la unicidad de Clerk en lugar de nombres Unicode, emojis y duplicados. La app sigue usando el ID de Clerk para autorización y el UUID del perfil para enlaces públicos. Un perfil existente mantiene su nombre y sus cartas. La migración `20260928170000_clerk_username_length.sql` amplía a 64 caracteres el límite de `display_name`; está aplicada en la base local y remota. La revisión de seguridad de Supabase no encontró problemas.

El registro usará el componente estándar `<SignUp />`. Para correo, Clerk pedirá el username durante el alta; para Google, Clerk puede pedirlo en su paso de continuación tras OAuth. Al completar la identidad, `/auth/continue` crea el perfil de manera idempotente con `user.username`. Se conserva la lectura de `unsafeMetadata.publicName` solo para altas antiguas interrumpidas. La Frontend API de Clerk todavía devuelve `auth_config.username: off` tanto en Production como en Development: hay que activar username en **la aplicación conectada** antes de integrar el cambio de código.

Una prueba en Preview creó una cuenta Clerk Development con correo verificado pero sin username, porque esa opción todavía estaba desactivada. La cuenta quedaba en `/profile` y el botón de reintento no podía resolver la ausencia del nombre. El nuevo flujo de recuperación permite elegir un username para esa cuenta, lo guarda en Clerk con una acción autenticada y vuelve a intentar la creación del perfil. Esto no sustituye activar Username en Clerk para que las altas nuevas lo pidan durante el registro. Los errores de `clerkMiddleware` observados en logs correspondían a solicitudes `/favicon.ico`, no a `/profile`; el proxy ahora incluye esa ruta.

## Pendiente de comprobación manual

- En la aplicación Clerk conectada `clerk-rose-fountain`, activar Username para registro, marcarlo obligatorio y permitir acceso por username tanto en **Production** como en **Development** (que usa Vercel Preview). Desactivar el cambio posterior de username para que el nombre visible del perfil no quede desincronizado. La CLI disponible no tiene acceso de configuración a esta aplicación de Vercel Marketplace. Verificar después que la Frontend API indique username activo.
- Crear el primer usuario real en `https://atiny-world.dynv6.net/en/sign-up`. Esto debería completar el check de Clerk “Create your first user in production”. Comprobar también el acceso y la recuperación de contraseña. El check “Set up environment variables” puede tardar en actualizarse aunque Vercel ya tenga las claves Production; comprobarlo de nuevo en Clerk.
- Configurar Google OAuth para la instancia Production conectada si se quiere probar acceso con Google. En la última consulta no había conexión social Production configurada.
- Cambiar el nombre visible `clerk-rose-fountain` a `atiny world` desde el panel de la aplicación Clerk conectada. La CLI de Clerk disponible solo administra la aplicación separada. Revisar después el nombre mostrado en formulario, correos y Google.
- Probar en navegador el flujo del nuevo PR (correo, Google y continuación para elegir username, recuperación, textos y correos). La vista previa está protegida por Vercel SSO. El propietario pidió que el agente no utilice navegador.

El fichero local `ddclient` contiene una credencial de dynv6, está excluido de Git y tiene permisos `0600`. La API DynDNS configurada allí modifica el registro A; no ejecutar `ddclient` para detectar la IP local, porque sobrescribiría la dirección de Vercel.
