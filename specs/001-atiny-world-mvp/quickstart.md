# Quickstart and Verification: ATINY World MVP

Esta guía valida la implementación futura del plan. No ejecuta migraciones remotas ni activa planes de pago.

## Prerequisites

- Node.js `>=24.16.0` y pnpm `12.3.4`.
- Docker compatible con Supabase local.
- Supabase CLI enlazada al proyecto correcto; cualquier operación remota se revisa por separado.
- Aplicaciones y credenciales de desarrollo reales para Clerk, Geoapify y CARTO.
- Navegadores Playwright instalados para el gate de PR; Xcode/iOS Simulator con Safari y Appium XCUITest, y Android SDK/AVD con Chrome estable y Appium UiAutomator2, para el gate móvil de lanzamiento.

## 1. Install and configure local development

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
supabase start
```

Completar `.env.local` sin copiar valores a commits, documentación, logs ni conversación. Desarrollo apunta a PostgreSQL local; la key de Geoapify es solo servidor y la de CARTO es pública pero debe restringirse por dominios.

Comprobar la base local sin mostrar secretos:

```bash
supabase status
supabase db query --local 'select current_database(), current_setting('"'"'server_version'"'"');'
```

## 2. Apply and review migrations locally

Crear cada migración con nombre concreto:

```bash
supabase migration new create_private_application_schema
```

Después de escribir y revisar el SQL, reconstruir la base local desde cero:

```bash
supabase db reset
```

`supabase db reset` es destructivo para la base local indicada. Verificar que el objetivo es el Supabase local y que no contiene datos que deban conservarse antes de ejecutarlo. Nunca usar producción para pruebas destructivas.

Comprobar como mínimo:

- PostGIS y esquema `app_private` existen; Data API no expone producto.
- `anon`, `authenticated`, `service_role` y `PUBLIC` no obtienen acceso accidental.
- `atiny_app_runtime` solo realiza las operaciones previstas.
- `atiny_preview_reader` solo selecciona proyecciones públicas seguras y no puede escribir.
- Defaults de settings son premoderación desactivada, límite 10 y cooldown 10 segundos.
- No existe ninguna tabla, columna, vista o función de reacciones/«Me gusta».

Antes de una migración remota, y solo tras revisión explícita del objetivo:

```bash
supabase db push --dry-run --include-roles
```

El push real es un paso operativo separado de builds y previews; no forma parte de este quickstart local.

## 3. Run the application

```bash
pnpm dev
```

Validación manual mínima en `http://localhost:3000`:

1. `/` redirige a `/en`; el selector conserva la ruta lógica al cambiar a `/es`.
2. La portada ordena cabecera, título/introducción, mapa, formulario y footer; el mapa es la mayor región de contenido anterior al formulario.
3. Una visitante puede mover/expandir el mapa, filtrar y abrir solo mensajes públicos.
4. CARTO carga directamente en navegador con atribución OSM+CARTO visible; ninguna fotografía del grupo ni logotipo oficial aparece entre los assets permitidos.
5. Una búsqueda de ubicación usa el backend, muestra atribución Geoapify y no coloca la dirección en la URL.
6. La navegación móvil permite explorar, publicar, gestionar mensajes propios, consultar contacto por suspensión y cerrar pantalla completa con teclado y lector de pantalla.

## 4. Behavior-first test loop

Para cada tarea:

1. Añadir o actualizar el escenario español en `tests/bdd/features` o la prueba de unidad/integración más estrecha.
2. Ejecutarla y comprobar que falla por la conducta aún ausente.
3. Implementar el menor corte coherente.
4. Ejecutar de nuevo la prueba estrecha y después los gates aplicables.

Comandos del flujo; los dos gates E2E se incorporan al implementar el arnés:

```bash
pnpm test:bdd
pnpm test:unit
pnpm test:integration
pnpm test:coverage
pnpm test:e2e
pnpm test:e2e:mobile:release
pnpm lint
pnpm typecheck
pnpm build
docker compose build
```

`test:e2e` y `test:e2e:mobile:release` se añaden durante la implementación del arnés descrito en [ui-behavior.md](./contracts/ui-behavior.md); el segundo nunca se ejecuta con credenciales de producción.

## 5. Automated timing and mobile matrix

Ejecutar E2E contra `next build && next start`, con fixtures reproducibles preparados antes de medir y retries desactivados:

- SC-001 inicia el reloj monotónico tras portada, mapa y marcador/grupo listos; termina con la ficha pública renderizada; cada resultado debe ser `< 60_000 ms`.
- SC-002 inicia antes de la primera acción de registro y termina al mostrar el mensaje pendiente y su enlace estable; cada resultado debe ser `< 300_000 ms`. Usa Clerk Development, correo de test y OTP documentado por Clerk; no usa helpers que omitan la UI.
- Cada ejecución guarda JSON con criterio, flujo, navegador y versión, SO, dispositivo/simulador, `viewportCss`, locale, hitos, `elapsedMs`, commit/deployment y resultado. Trazas, vídeo y capturas se retienen solo como diagnóstico.

El gate rápido usa WebKit/Chromium de Playwright en 320/390 × `en`/`es`, pero no se presenta como evidencia de Safari/iOS ni Chrome/Android reales. El gate de lanzamiento ejecuta mediante Appium/WebDriver:

| Runtime | Anchos CSS | Locales | Recorridos SC-010 |
|---|---|---|---|
| Safari de iOS estable actual | 320, 390 | `en`, `es` | exploración, publicación, gestión propia, contacto por suspensión |
| Chrome estable actual de Android | 320, 390 | `en`, `es` | exploración, publicación, gestión propia, contacto por suspensión |

Son 32 ejecuciones mínimas. Cada una afirma versión/UA, `window.innerWidth`, `lang`, `scrollWidth <= clientWidth`, controles esenciales visibles/habilitados/dentro del viewport y cero errores no gestionados. Safari/iOS añade smoke físico a ancho nativo; ambos anchos contractuales se prueban en Simulator. Si el runtime estable no demuestra 320 o 390, el release se bloquea y no se sustituye por WebKit desktop.

## 6. Mandatory integration scenarios

Ejecutar contra dos conexiones PostgreSQL locales reales cuando aplique:

- Dos publicaciones simultáneas de la misma cuenta nunca superan 10 mensajes ni el cooldown.
- Crear y borrar adquieren locks en el mismo orden; borrar libera cupo sin reiniciar último envío.
- Los cuatro estados × ambos modos de premoderación × cuenta activa/suspendida cumplen una única matriz de visibilidad en mapa, filtros y enlace.
- Editar incrementa versión, conserva `public_id`, conserva ubicación cuando no cambia y rechaza decisiones administrativas obsoletas.
- «Pedir revisión» conserva la versión exacta, no cambia visibilidad y solo admin puede leer la evidencia.
- Borrar mensaje/cuenta anula referencias pero no elimina evidencia vigente.
- Cerrar solicitud calcula dos años naturales; la purga elimina únicamente evidencia vencida y es idempotente.
- Cambiar settings, roles, suspensión o moderación escribe auditoría en la misma transacción.
- Preview no puede leer evidencia/auditoría ni ejecutar DML aun con una petición fabricada.

## 7. Real-provider release checks

### Clerk

- Registro por contraseña con correo verificado, recuperación y Google funcionan en inglés y español.
- La vinculación no duplica perfil ni mensajes.
- Un perfil acepta `username === displayName`; dos cuentas pueden compartir `displayName` con usuarios distintos, y la búsqueda devuelve ambos campos para desambiguarlas.
- Perfil incompleto, suspensión, roles y propiedad se revalidan en cada acción/handler.
- `user.deleted` firmado es idempotente.
- Fallo simulado al borrar en Clerk deja job pendiente y acceso local bloqueado; el reintento completa y `404` cuenta como éxito.

### Geoapify

- Endpoint europeo, DPA y texto de privacidad revisados.
- Corpus de ciudades, direcciones, hangul, romanizaciones y nombres ambiguos aprobado.
- Debounce, respuestas obsoletas, límite de 5–8 resultados, `429` y cuota agotada producen UX accionable.
- Una caída `5xx` identifica Geoapify, conserva consulta, borrador y selección confirmada, y solo reintenta al pulsar el control manual; una respuesta obsoleta nunca pisa la consulta actual.
- Con Geoapify caído, una selección firmada vigente permite publicar sin otra llamada; sin selección, tras editar la consulta o al caducar, publicar queda bloqueado sin perder el borrador.
- La dirección, respuesta cruda y token no aparecen en DB, logs, trazas, analítica ni errores.
- Solo punto público, precisión, localidad/país, versión del algoritmo y atribución necesaria se persisten.

### CARTO and Leaflet

- Key provisionada, restringida a dominios y monitorizada; encaje gratuito/no comercial aceptado.
- Atribución permanece visible en vista normal y pantalla completa.
- Ninguna tesela pasa por backend ni caché propia; se respetan los términos de cache del navegador.
- Puntos coincidentes son accesibles mediante zoom/spiderfy y no bloquean la UI.
- El backend limita por bbox/filtros y nunca envía todos los textos del mapa.
- Fallos inducidos distinguen datos del mapa de teselas CARTO, conservan filtros y borrador y ofrecen un único reintento manual. `tileabort` por paneo no se trata como caída.

## 8. Performance, accessibility and privacy evidence

- Usar `EXPLAIN (ANALYZE, BUFFERS)` con datos locales representativos para viewport, ficha, «Mis mensajes», colas y purga; ajustar índices solo con evidencia.
- Verificar p95 menor de 1 s para lecturas PostgreSQL del objetivo inicial y ausencia de descarga global.
- Revisar los JSON cronometrados de SC-001/002 y las 32 ejecuciones de SC-010; cualquier fallo, retry o duración fuera del umbral bloquea el release.
- Probar contenido coreano, saltos de línea y emojis compuestos exactamente en 500/501 grafemas.
- Inspeccionar respuestas, logs de desarrollo y artefactos de test en busca de correo, dirección, evidencia, mensajes ocultos y secretos.

## 9. Deployment gate

Antes de producción:

- Vercel Functions ejecuta Node.js en `cdg1` o en la región europea verificada más próxima a Supabase `eu-west-3`.
- Variables Development, Preview y Production están separadas; preview usa solo `atiny_preview_reader`.
- Migración y roles fueron revisados y aplicados fuera del build; los despliegues antiguos siguen compatibles.
- Cron y reintentos solo operan en producción, son idempotentes y usan secreto dedicado.
- Hay dumps cifrados/rotatorios fuera del repo, política explícita para excluir o caducar `review_evidence`, restore drill y purga inmediata post-restore.
- Dominio, correo de contacto, normas, privacidad, alertas de cuota y todos los SC-001 a SC-010 están aprobados; la evidencia conserva las versiones móviles resueltas y los anchos CSS observados.

Solo entonces integrar mediante el flujo Git configurado y ejecutar un smoke test de lectura, publicación, moderación, revisión y eliminación. Un fallo en cualquier gate bloquea declarar el MVP completo.
