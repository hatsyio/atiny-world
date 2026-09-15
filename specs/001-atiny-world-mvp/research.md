# Research: ATINY World MVP

## 1. Aplicación full-stack y fronteras de Next.js

**Decisión**: mantener una única aplicación Next.js 16 en runtime Node.js. Las páginas, layouts y lecturas iniciales serán Server Components; Leaflet, controles del mapa y formularios interactivos serán Client Components pequeños. Las mutaciones de la UI usarán Server Actions y las interfaces HTTP reales usarán Route Handlers.

**Razón**: conserva secretos y PostgreSQL en el servidor, reduce JavaScript cliente y respeta la arquitectura de adaptadores delgados. Las consultas de Server Components llamarán directamente a `src/server/*`, sin una vuelta HTTP interna.

**Alternativas descartadas**: convertir páginas completas en Client Components; usar Route Handlers para toda mutación; añadir un backend separado; usar Edge runtime. Aumentan superficie, latencia o despliegues sin resolver una necesidad del MVP.

**Fuentes**: [Server y Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [Server Actions](https://nextjs.org/docs/app/getting-started/updating-data), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).

## 2. Localización y caché

**Decisión**: usar rutas `src/app/[lang]` solo para `en` y `es`; `/` redirige siempre a `/en`. Las APIs quedan fuera del locale y devuelven códigos estables que traduce la UI. El contenido moderable se obtiene en cada lectura, con `Cache-Control: no-store`; no se activan Cache Components, ISR ni caché persistente para mapa, fichas, datos propios o administración. Streaming y Suspense sí se pueden usar.

**Razón**: las URLs compartidas son reproducibles, inglés sigue siendo el valor por defecto y una retirada, suspensión o edición se refleja en la siguiente lectura.

**Alternativas descartadas**: detectar idioma automáticamente por navegador; ocultar locale en cookie; añadir una biblioteca i18n para solo dos diccionarios; invalidación stale-while-revalidate de datos moderables.

**Fuentes**: [Internationalization](https://nextjs.org/docs/app/guides/internationalization), [Fetching y streaming](https://nextjs.org/docs/app/getting-started/fetching-data), [`connection()`](https://nextjs.org/docs/app/api-reference/functions/connection).

## 3. Autenticación, autorización y borrado de cuenta

**Decisión**: Clerk gestiona identidad, credenciales, verificación, Google y recuperación. `clerkMiddleware()` permanece en el único `src/proxy.ts`, pero la autorización efectiva resuelve en cada operación el perfil PostgreSQL, estado de borrado, suspensión, rol y propiedad. El borrado es una saga persistente e idempotente: ocultación y purga local transaccional primero, Clerk después, job de reintento y webhook firmado como reconciliación.

**Razón**: Proxy y la UI no bastan para autorizar. No se debe mantener una transacción PostgreSQL abierta durante una llamada externa ni afirmar que la cuenta se borró si Clerk sigue pendiente.

**Alternativas descartadas**: autorizar solo en Proxy/layout; borrar primero en Clerk y depender del webhook; llamar a Clerk dentro de una transacción; añadir un motor externo de workflows.

**Fuentes**: [Clerk middleware](https://clerk.com/docs/reference/nextjs/clerk-middleware), [Clerk `auth()`](https://clerk.com/docs/reference/nextjs/app-router/auth), [gestión de usuarios](https://clerk.com/docs/guides/users/managing), [webhooks](https://clerk.com/docs/guides/development/webhooks/overview).

## 4. Esquema PostgreSQL y exposición de datos

**Decisión**: almacenar producto en `app_private`, deshabilitar Data API y revocar privilegios por defecto de `PUBLIC`, `anon`, `authenticated` y `service_role`. Las PK internas serán `bigint generated always as identity`; los recursos públicos tendrán además UUID opaco único. Estados, roles y destinatarios usarán `text` con restricciones `CHECK`; fechas, `timestamptz`. El máximo de 500 grafemas se valida en TypeScript, no con `char_length`.

**Razón**: los FK e índices internos quedan compactos, los enlaces no son enumerables y los estados se pueden ampliar con una migración compatible. La separación privada reduce el impacto de una exposición accidental del Data API.

**Alternativas descartadas**: UUID v4/v7 como todas las PK; enums PostgreSQL; tablas en `public`; Supabase Auth/RLS basados en `auth.uid()`. Ninguna mejora el modelo backend-only con Clerk y algunas complican evolución o paridad local.

**Fuentes**: [hardening del Data API](https://supabase.com/docs/guides/database/hardening-data-api), [roles PostgreSQL en Supabase](https://supabase.com/docs/guides/database/postgres/roles), [PostgreSQL 17 constraints](https://www.postgresql.org/docs/17/ddl-constraints.html).

## 5. Roles y conexiones por entorno

**Decisión**: crear tres fronteras: rol de migración fuera de Vercel, `atiny_app_runtime` con DML mínimo y `atiny_preview_reader` con `SELECT` solo sobre proyecciones públicas seguras. Producción usa Supavisor Transaction Pooler, SSL, prepared statements desactivadas y cliente compartido a nivel de módulo; desarrollo usa Supabase local. Preview es solo lectura salvo autorización temporal explícita.

**Razón**: aplica mínimo privilegio y conserva transacciones/locks compatibles con Functions sin entregar credenciales administrativas. Las vistas de preview no contienen solicitudes, evidencia, auditoría, correo, suspensión ni jobs.

**Alternativas descartadas**: credencial `postgres`/service role en runtime; credencial de escritura compartida por previews; Session Pooler; sincronización amplia automática de secretos del Marketplace.

**Fuentes**: [conexiones a PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [integración Vercel](https://supabase.com/docs/guides/integrations/vercel-marketplace), [pooling en Vercel Functions](https://examples.vercel.com/kb/guide/connection-pooling-with-functions).

## 6. Ubicación y consultas espaciales

**Decisión**: habilitar PostGIS y guardar solo el punto público final en `geography(Point,4326)`, junto con localidad, país, precisión y versión del algoritmo. Un índice GiST limita lecturas al viewport. La dirección escrita y la respuesta cruda de geocodificación no se guardan. El punto aproximado parte del centro de localidad y se calcula una vez, de forma determinista, después de asignar el UUID del mensaje.

**Razón**: el dato persistido coincide con lo que se puede publicar; PostGIS cubre viewport, antimeridiano y evolución de escala sin otro servicio. Mantener el punto calculado hace estables las ediciones de texto.

**Alternativas descartadas**: guardar dirección privada; recalcular el desplazamiento; usar latitud/longitud sin índice espacial; introducir un servicio geoespacial separado.

**Fuentes**: [PostGIS en Supabase](https://supabase.com/docs/guides/database/extensions/postgis), [PostGIS `geography`](https://postgis.net/docs/using_postgis_dbmanagement.html).

## 7. Mapa, clustering y CARTO

**Decisión**: Leaflet se importa en una isla cliente mediante `next/dynamic` con `ssr: false`; `leaflet.markercluster` agrupa en presentación solo los puntos públicos del viewport y filtros activos. CARTO raster XYZ se consume directamente desde el navegador con key restringida por dominio y atribución visible. La aplicación no proxifica ni cachea teselas.

**Razón**: Leaflet depende del DOM y el plugin cubre conteos, zoom y puntos coincidentes. El backend sigue siendo responsable de limitar el conjunto y no envía todos los textos. Las condiciones vigentes de CARTO obligan a usar key y prohíben el proxy/cache de teselas.

**Alternativas descartadas**: SSR de Leaflet; descargar todos los mensajes; clustering global solo cliente; proxy propio de teselas; agrupación espacial completa en servidor desde el primer día. Esta última queda como evolución si las métricas la justifican.

**Fuentes**: [lazy loading de Next.js](https://nextjs.org/docs/app/guides/lazy-loading), [Leaflet](https://leafletjs.com/examples/quick-start/), [MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster), [CARTO API key](https://carto.com/basemaps/apikey/), [términos de CARTO Basemaps](https://carto.com/legal/basemap-terms/).

## 8. Geoapify, privacidad y cuota

**Decisión**: exponer un `POST /api/locations/suggestions` propio que llama al autocomplete europeo de Geoapify. La consulta nunca aparece en URL ni logs. El backend valida idioma, longitud y límite, fuerza búsqueda mundial sin sesgo por IP de Vercel, aplica rate limit y reduce la respuesta a un DTO. La selección se representa mediante un token firmado y breve; el cliente usa debounce y descarta respuestas obsoletas. No se activa pago automáticamente.

**Razón**: protege la key, evita enviar la IP del navegador y reduce persistencia accidental de direcciones. El plan gratuito vigente hace necesarias las protecciones de cuota. El corpus de lanzamiento incluye hangul, romanización y ambigüedades internacionales.

**Alternativas descartadas**: API desde navegador; dirección en query string; Nominatim público para autocomplete; persistir la respuesta cruda; geocodificar solo al enviar y perder previsualización.

**Fuentes**: [Autocomplete](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/), [Forward Geocoding](https://apidocs.geoapify.com/docs/geocoding/), [DPA](https://www.geoapify.com/data-processing-agreement/), [precios](https://www.geoapify.com/pricing/), [privacidad](https://www.geoapify.com/privacy-policy/).

## 9. Límite y cooldown bajo concurrencia

**Decisión**: resolver geocodificación antes y abrir después una transacción corta. Bloquear el perfil con `SELECT ... FOR UPDATE`, comprobar estado, leer settings, contar todos los mensajes no eliminados, comparar `last_message_created_at` con la hora de DB, insertar el pendiente y actualizar ese instante. Crear y borrar adquieren primero el mismo lock. Se devuelve un `retryAfterSeconds` estable.

**Razón**: serializa las publicaciones de una cuenta bajo `READ COMMITTED`, impide superar 10 mensajes o 10 segundos y mantiene las llamadas externas fuera de la transacción. El borrado libera cupo pero no reinicia cooldown.

**Alternativas descartadas**: validación solo en UI; constraint simple; advisory lock; aislamiento SERIALIZABLE con retries. El lock explícito de una fila existente es más directo.

**Fuentes**: [locking explícito](https://www.postgresql.org/docs/17/explicit-locking.html), [transacciones](https://www.postgresql.org/docs/17/tutorial-transactions.html).

## 10. Revisión, auditoría y retención

**Decisión**: separar `review_requests` de `review_evidence`. La solicitud referencia de forma anulable mensaje y solicitante; la evidencia guarda solo el snapshot privado de la versión. Al cerrar se fija `purge_at = closed_at + interval '2 years'`. Supabase Cron llama diariamente una función SQL idempotente que purga evidencia vencida por lotes, sin borrar el metadato del caso. Moderación y auditoría se escriben atómicamente y toda decisión incluye versión esperada.

**Razón**: las referencias `ON DELETE SET NULL` permiten borrar cuentas/mensajes sin destruir evidencia vigente. Separar el texto permite permisos, purga y política de backup específicas. La versión evita decidir sobre una edición posterior.

**Alternativas descartadas**: historial público de versiones; evidencia dentro de auditoría; `ON DELETE CASCADE`; purga desde el navegador; conservar snapshots indefinidamente.

**Fuentes**: [Supabase Cron](https://supabase.com/docs/guides/cron), [backups](https://supabase.com/docs/guides/platform/backups).

## 11. Migraciones, backups y despliegue

**Decisión**: usar migraciones SQL imperativas revisadas en `supabase/migrations`, roles declarados sin contraseñas en `supabase/roles.sql` y expansión/contracción en pasos separados. Probar desde cero localmente, inspeccionar `db push --dry-run` y aplicar remoto fuera del build. Mantener dumps lógicos cifrados, rotatorios y fuera del repo, con restore drill; excluir `review_evidence` del dump si es la única forma de garantizar que una copia vencida no sobreviva a la retención. Vercel despliega mediante integración Git, con Node.js en París `cdg1` si la verificación de región confirma proximidad.

**Razón**: el SQL explícito es auditable para permisos, funciones y cron. Un rollback de aplicación puede convivir con el esquema expandido. El plan Free no sustituye una estrategia de exportación y restauración.

**Alternativas descartadas**: cambios manuales en Studio; migrar durante previews/builds; rollback destructivo automático; multi-región; duplicar despliegue desde CI.

**Fuentes**: [migraciones Supabase](https://supabase.com/docs/guides/deployment/database-migrations), [esquemas declarativos e imperativos](https://supabase.com/docs/guides/local-development/declarative-database-schemas), [Vercel Git deployments](https://vercel.com/docs/git), [regiones de Functions](https://vercel.com/docs/functions/configuring-functions/region).

## 12. Identidad pública y contrato visual

**Decisión**: `username_normalized` es el único identificador humano con restricción de unicidad. `display_name` es independiente, puede coincidir con el usuario de la misma cuenta y repetirse entre cuentas; toda búsqueda muestra ambos valores para desambiguar. La orientación «cálida y participativa» se revisa cualitativamente como SHOULD. Los MUST de FR-003 se automatizan: orden semántico de FR-002, área visible del mapa mayor que cualquier otra región de contenido anterior al formulario y allowlist de assets sin fotografías del grupo ni logotipos oficiales.

**Razón**: evita convertir una preferencia estética en una métrica arbitraria y hace comprobables las dos obligaciones visuales. Mantener el nombre público no único permite la expresión internacional sin convertirlo accidentalmente en credencial.

**Alternativas descartadas**: índice único o desigualdad obligatoria para `display_name`; validación solo por captura visual; snapshots de píxeles como único gate. Restringen producto o producen pruebas frágiles sin mejorar permisos.

## 13. Degradación del mapa y la búsqueda de ubicaciones

**Decisión**: modelar por separado datos del mapa, teselas CARTO y búsqueda Geoapify, con estados seguros y mensajes específicos. Los fallos temporales ofrecen reintento manual y nunca remontan el árbol que contiene filtros, borrador y selección confirmada. Los filtros permanecen en URL/estado cliente; el borrador y la dirección escrita solo en memoria de la pestaña. Geoapify usa `attemptId` y cancelación/descartado de respuestas obsoletas; `429` respeta `Retry-After`, y vacío, configuración inválida y fallo temporal son estados distintos. CARTO escucha el ciclo de teselas: un fallo aislado degrada; un ciclo visible sin ninguna tesela correcta declara indisponibilidad; el reintento invoca una sola vez `redraw()`.

**Razón**: CARTO, la API propia del mapa y Geoapify pueden fallar de forma independiente. Un error no debe borrar entrada válida ni bloquear funciones que no dependen del servicio caído. Una publicación valida localmente la firma, caducidad, cuenta y contenido del `selectionId`; no vuelve a consultar Geoapify, por lo que una ubicación ya confirmada y vigente sigue siendo publicable durante una caída. Editar la consulta de ubicación invalida esa selección; sin selección vigente se conserva el borrador pero no se publica.

**Alternativas descartadas**: fallback de página completa; retry automático en bucle; guardar dirección/borrador en URL, storage o servidor; volver a geocodificar durante la publicación; tratar cualquier `tileerror` como caída completa.

**Fuentes**: [eventos y `redraw()` de Leaflet](https://leafletjs.com/reference), [autocomplete de Geoapify](https://apidocs.geoapify.com/how-to/addresses/add-address-autocomplete/), [manejo de límites de Geoapify](https://apidocs.geoapify.com/how-to/addresses/geocode-address-list/), [`searchParams` de Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/page), [caducidad JWT](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1.4).

## 14. Automatización y protocolo de medición móvil

**Decisión**: usar dos capas que ejecutan los mismos recorridos Cucumber. Cada PR ejecuta Playwright sobre el build de producción con proyectos WebKit/Chromium, touch móvil, 320/390 píxeles CSS y `en`/`es`. El gate de lanzamiento, sin retries, ejecuta esos recorridos mediante Appium/WebDriver en Safari de la versión estable actual de iOS y Chrome estable actual de Android, resolviendo y registrando versión de SO/navegador, dispositivo o simulador y `window.innerWidth` al comenzar. En iOS se usa Simulator para demostrar ambos anchos y se añade smoke en dispositivo físico; en Android se usan AVD configurados y smoke físico. Si el runtime iOS actual no demuestra 320 y 390, el lanzamiento queda bloqueado: WebKit desktop no sustituye esa evidencia.

SC-001 prepara datos fuera del reloj, empieza con `performance.now()` tras portada, mapa y marcador/grupo listos, y termina al renderizar la ficha pública (`elapsedMs < 60_000`). SC-002 prepara la identidad única fuera del reloj, empieza antes de la primera acción de registro y termina cuando la UI confirma mensaje pendiente y enlace estable (`elapsedMs < 300_000`). Ambos atraviesan solo UI; SC-002 usa la instancia Development real de Clerk y sus credenciales de test. Cada ejecución produce JSON con criterio, flujo, navegador/versión, SO, dispositivo, ancho CSS, locale, hitos, duración, commit/deployment y resultado; trazas, vídeo y capturas se retienen al fallar.

SC-010 contiene 2 plataformas × 2 anchos × 2 locales = 8 configuraciones para cada uno de sus cuatro recorridos, 32 ejecuciones mínimas. Cada caso afirma `innerWidth`, `lang`, `scrollWidth <= clientWidth`, controles esenciales visibles/habilitados/dentro del viewport y cero excepciones no atrapadas, respuestas 5xx inesperadas o errores de consola fuera de allowlist. El 100 % significa primer intento aprobado; un retry exitoso sigue bloqueando el release.

**Razón**: Playwright da feedback barato y determinista, pero su WebKit no es Safari de marca ni prueba iOS real. Appium/WebDriver demuestra los runtimes exigidos. Hitos monotónicos explícitos miden el recorrido del requisito y no el setup del runner.

**Alternativas descartadas**: solo Playwright; solo dispositivos físicos, que no garantizan 320 CSS en iOS actual; Selenium puro con plumbing duplicado; granja comercial de dispositivos, que requiere coste y autorización. Esta última puede reconsiderarse si el laboratorio local no permite una matriz reproducible.

**Fuentes**: [testing E2E de Next.js](https://nextjs.org/docs/app/guides/testing), [emulación Playwright](https://playwright.dev/docs/emulation), [navegadores Playwright](https://playwright.dev/docs/browsers), [retries Playwright](https://playwright.dev/docs/test-retries), [Safari WebDriver en iOS](https://developer.apple.com/documentation/safari-developer-tools/ios-enabling-webdriver), [Appium XCUITest](https://appium.github.io/appium-xcuitest-driver/latest/installation/requirements/), [Appium UiAutomator2](https://github.com/appium/appium-uiautomator2-driver/blob/master/docs/capability-sets.md), [Clerk E2E](https://clerk.com/docs/guides/development/testing/playwright/test-sign-up-flows), [CSSOM View](https://www.w3.org/TR/cssom-view/).
