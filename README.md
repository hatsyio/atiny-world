# Atiny Atlas

Un mundo de buenos deseos para ATEEZ.

Atiny Atlas es un mapa público y permanente de mensajes de ATINY, con ubicaciones elegidas por sus autoras y moderación configurable.

Producción: **https://atinyatlas.com**.

## Estado

La base ejecutable incluye Next.js, TypeScript, pnpm, Clerk, persistencia en
PostgreSQL, mapa público, creación y gestión de mensajes, moderación y
administración. La lista de trabajo de producto y verificación de lanzamiento
se mantiene en [tasks.md](specs/001-atiny-world-mvp/tasks.md).

## Servicios e infraestructura

Inventario revisado el **7 de octubre de 2026**. Clerk ya funciona de forma
independiente de Vercel Marketplace; el login, las cartas y la administración
se comprobaron después de migrar las cuentas.

| Servicio | Uso en Atiny Atlas | Configuración actual |
| --- | --- | --- |
| Namecheap | Registro y renovación del dominio | `atinyatlas.com`. Los servidores DNS delegados son `ns1.vercel-dns.com` y `ns2.vercel-dns.com`; los registros se administran en Vercel. |
| Vercel | Hosting de Next.js, despliegues, variables, DNS y HTTPS de la web | Proyecto `atiny-world`, conectado a GitHub. Production publica en `atinyatlas.com`; las PR generan previews. `SITE_URL=https://atinyatlas.com`. |
| Clerk | Cuentas, sesiones, acceso, recuperación y correos de autenticación | Aplicación independiente `atiny world`. Production usa claves live y `clerk.atinyatlas.com`; Preview y Development usan su instancia Development con claves test. Las variables se gestionan manualmente en Vercel. |
| Google Cloud / Google Auth Platform | Cliente OAuth para «Continuar con Google» | Credenciales propias configuradas en Clerk Production. URI de retorno: `https://clerk.atinyatlas.com/v1/oauth_callback`. El estado de publicación y la marca se gestionan en Google Cloud. |
| Supabase | PostgreSQL con PostGIS para perfiles, cartas y moderación | Proyecto remoto documentado como `atiny-world`, región París. Acceso desde el backend mediante `DATABASE_URL`; la autenticación de la aplicación la gestiona Clerk. Production y Preview comparten actualmente la base remota. |
| GitHub / GitHub Actions | Repositorio, PR y validación de CI | Repositorio `hatsyio/atiny-world`. Actions ejecuta los controles; Vercel realiza los despliegues. |
| CARTO / OpenStreetMap | Mapa base y datos cartográficos | Teselas de CARTO y atribución a CARTO/OpenStreetMap. La clave de CARTO es pública y se configura con `NEXT_PUBLIC_CARTO_BASEMAP_KEY`. |
| Geoapify | Autocompletado y búsqueda inversa de ubicaciones | Consultas desde el servidor; `GEOAPIFY_API_KEY` se mantiene privada. |
| Docker Compose | Aplicación y PostgreSQL/PostGIS para desarrollo | Proyecto local `atiny-world`; perfiles `local` y `pro`. No es el hosting de producción. |

`www.atinyatlas.com` y el dominio anterior `atiny-world.dynv6.net` redirigen
mediante HTTP 308 a `atinyatlas.com`. dynv6 queda como compatibilidad con
enlaces antiguos. No se utiliza como DNS del dominio nuevo.

Los certificados de la web se gestionan en Vercel y los de los subdominios de
autenticación en Clerk. Namecheap no aporta hosting ni correo de la aplicación.
Google OAuth tampoco implica tener correo de empresa o Google Workspace.

La configuración de la migración, los entornos y las verificaciones están en
[Clerk independiente](docs/clerk-independent-migration-20261007.md).

## Nombre definitivo y revisión pendiente

La marca es **Atiny Atlas**, respetando esa capitalización. Para nombres
técnicos nuevos, usar `atiny-atlas`; para el dominio, `atinyatlas.com`.
La interfaz, los metadatos, las traducciones, la identidad pública, el paquete
npm, las pruebas y la documentación vigente ya usan esta marca. El favicon
reproduce el símbolo dorado de cuatro puntas de la cabecera.
Los nombres anteriores todavía existen en los recursos siguientes; su
migración sigue pendiente.

| Elemento | Nombre o referencia actual | Cambio pendiente |
| --- | --- | --- |
| Vercel | Proyecto `atiny-world` y alias `atiny-world.vercel.app` | Renombrar el proyecto a `atiny-atlas`, revisar aliases generados y volver a comprobar el vínculo local, GitHub y el dominio propio. Mantener el ID del proyecto. |
| Clerk | Aplicación `atiny world` | Renombrar la aplicación a `Atiny Atlas`; revisar branding del Account Portal, formularios y correos. Mantener las instancias, IDs y cuentas actuales. |
| Google Cloud | Nombre del proyecto, cliente OAuth y marca de consentimiento por revisar | Usar `Atiny Atlas` en la marca pública y en el nombre descriptivo del cliente; comprobar dominio, enlaces de privacidad/contacto y estado `In production`. El ID técnico del proyecto no necesita cambiar. |
| Supabase | Proyecto remoto y `project_id = "atiny-world"` en `supabase/config.toml` | Revisar el nombre visible remoto y el identificador del entorno local por separado. Conservar la referencia remota y las conexiones de la base existente. |
| GitHub | `hatsyio/atiny-world` | Renombrar el repositorio a `atiny-atlas`; actualizar `origin`, vínculo con Vercel y referencias vigentes a issues/PR. |
| Docker | `name: atiny-world`; imagen `atiny-atlas-postgres:17.6-postgis` en `compose.yaml` | Revisar el nombre del proyecto, contenedores y volúmenes. Cambiar el nombre del proyecto puede seleccionar otros volúmenes: respaldar y conservar o trasladar los datos antes. |
| Carpeta local | `atiny-map` | Renombrar a `atiny-atlas` después de revisar referencias locales y sesiones/herramientas que dependen de la ruta. |
| Proveedores de mapas y búsqueda | Nombres de proyectos/claves de CARTO y Geoapify por revisar | Comprobar etiquetas y restricciones de dominio; renombrar etiquetas a `Atiny Atlas` cuando proceda. No regenerar claves solo por cambiar el nombre. |

La carpeta `specs/001-atiny-world-mvp/` conserva su ruta para mantener los
enlaces. Los planes y registros históricos conservan la marca original.
Docker Compose mantiene `name: atiny-world` para reutilizar los volúmenes
existentes, aunque la imagen de PostgreSQL ya se llama `atiny-atlas-postgres`.

Orden recomendado para lo pendiente: etiquetas de los servicios →
repositorio/Vercel → entornos locales y carpeta. Registrar cada
cambio y comprobar el acceso y los despliegues antes de retirar compatibilidad.

## Limpieza y retirada de elementos anteriores

- [x] Eliminar el recurso `clerk-rose-fountain` y desinstalar la integración Clerk de Vercel Marketplace.
- [x] Migrar las cuentas Production y Development y conservar los vínculos de perfiles, cartas y roles.
- [x] Sustituir las claves antiguas de Clerk en Vercel y en `.env`/`.env.clerk-production.local`.
- [x] Sustituir los CNAME de correo y DKIM de Clerk y verificar DNS, SSL y correo.
- [x] Marcar `docs/issue-35-clerk-production.md` como documentación histórica y enlazar la configuración vigente.
- [ ] Retirar el cliente OAuth o secretos de Google anteriores cuando se confirme que ningún otro entorno los utiliza. Conservar las credenciales del cliente nuevo.
- [ ] Retirar del cliente OAuth nuevo las URI antiguas, como la de `atiny-world.vercel.app`, si ya no se utilizan. Mantener la URI definitiva de `clerk.atinyatlas.com`.
- [ ] Decidir el plazo de conservación de `atiny-world.dynv6.net`. Mantener su redirección mientras haya enlaces en circulación; actualizar enlaces compartidos antes de retirar el dominio y sus registros.
- [ ] Retirar la configuración local `ddclient` y su credencial dynv6 cuando deje de ser necesaria. No ejecutar la detección de IP: podría sobrescribir el registro del dominio anterior.
- [ ] Revisar los alias antiguos de Vercel después del renombrado; mantener las redirecciones necesarias y eliminar solo los alias sin uso.
- [ ] Actualizar `docs/desarrollo-local.md` y `docs/arquitectura.md`: todavía contienen referencias a Clerk Marketplace y estados antiguos de provisión.
- [ ] Revisar variables, webhooks, claves de CI y archivos locales que aún puedan referirse a la instancia Clerk eliminada. No retirar claves de otros servicios ni secretos activos.
- [ ] Definir conservación y eliminación de los CSV descargados y las copias temporales de migración. Contienen datos personales y contraseñas cifradas; no subirlos a Git. Conservar el respaldo privado y los mapas de IDs mientras sea necesario para recuperar o auditar la migración.
- [ ] Revisar el perfil sin correspondencia con las cuentas exportadas que se conservó en la base. Verificar autoría y referencias antes de decidir una actuación; no borrarlo automáticamente.
- [ ] Provisionar y comprobar la credencial de solo lectura de Preview, pendiente en la documentación de desarrollo, antes de dar por aislados los datos de producción.

El respaldo privado de la migración está en
`~/.local/share/atiny-world/clerk-migration-20261007`. Su carpeta conserva el
nombre antiguo como referencia de la operación; no es un nombre público ni
debe eliminarse como parte de un reemplazo general de textos.

## Documentación

- [Requisitos de producto](docs/requisitos.md): alcance de la primera versión y mejoras futuras.
- [Arquitectura](docs/arquitectura.md): tecnologías, modelo de datos, permisos, entornos y migraciones.
- [Configuración administrativa](docs/admin-settings.md): moderación previa, límite e intervalo operativos.
- [Suspensión de cuentas](docs/admin-suspension.md): permisos, reactivación, visibilidad y auditoría.
- [Entorno local](docs/desarrollo-local.md): arranque de Supabase y estado de la infraestructura.
- [Plan de implementación](docs/superpowers/plans/2026-09-13-atiny-world.md): entregas previstas y trabajo pendiente.

## Tecnologías acordadas

- Next.js con TypeScript: frontend y backend en un mismo proyecto, desplegados en Vercel.
- Clerk: autenticación con contraseña y Google.
- Supabase PostgreSQL: persistencia, accesible únicamente mediante el backend.
- Leaflet y CARTO: visualización del mapa.
- Geoapify: búsqueda de ubicaciones.

Interfaz en inglés y español con `next-intl`. El idioma se resuelve desde el
primer HTML: preferencia del perfil → cookie explícita → navegador → inglés.
El selector público y los ajustes del producto ofrecen Automático, Español e
Inglés. Automático vuelve a seguir al navegador; cerrar sesión restaura la
preferencia previa del visitante y cambiar de cuenta no hereda la anterior.

Las rutas (`/messages/{publicId}`, `/my-messages`, `/settings`, etc.) no llevan
idioma. Los enlaces antiguos `/en/...` y `/es/...` redirigen temporalmente al
mismo recurso conservando query/hash y respetando el idioma del lector.
Cambiar idioma conserva borradores y la exploración del mapa. Las fechas de
publicación se muestran en UTC. Las cartas conservan su contenido original,
incluidos coreano, emojis y saltos de línea; nunca se traducen automáticamente.
El origen de canonical usa `SITE_URL` si se configura un dominio propio,
`VERCEL_PROJECT_PRODUCTION_URL` en Vercel y localhost durante desarrollo.

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
