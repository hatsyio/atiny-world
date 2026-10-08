# Investigación de errores pendientes de PostHog

Revisión del 8 de octubre de 2026, proyecto `651528`, últimos siete días.
Los recuentos corresponden a la consulta, no a una métrica persistida. Esta
investigación no cambia configuración de producción ni resuelve incidencias en
PostHog. Las correcciones anteriores de Clerk, UUID y CI están en la PR #111.

## Conexiones agotadas: prioridad alta

[Incidencia](https://us.posthog.com/project/651528/error_tracking/01a11ad8-7a41-7a40-a435-81dfb788ceb1):
dos excepciones de renderizado de `/`, el 8 de octubre a las 09:29:16 y
09:29:38 UTC. El servidor recibió `EMAXCONNSESSION`, con un límite de 15
clientes en modo sesión. Los dos distinct_id del servidor no permiten concluir
que fueran dos personas diferentes.

Hechos:

- `.env.pro` apunta al pooler compartido de Supabase por el puerto 5432.
- El error de producción confirma uso del modo sesión en esas peticiones.
- `getDb()` limita cada cliente a una conexión, pero ese límite se aplica por
  instancia del proceso, no al conjunto de instancias de Vercel.
- El cliente no configura `idle_timeout`. Postgres.js puede mantener las
  conexiones inactivas hasta su cierre o el vencimiento de su vida máxima.
- Una consulta de diagnóstico actual mostró cuatro conexiones del usuario de
  aplicación en estado idle; la más antigua llevaba unos seis minutos. Esa
  fotografía no reconstruye la saturación de las 09:29.
- Se probó el endpoint de transacción del mismo pooler en el puerto 6543 con el
  usuario de aplicación, `prepare: false` y las mismas opciones de search_path.
  Una transacción de lectura pudo consultar settings y ejecutar funciones de
  PostGIS, obteniendo SRID 4326. Se cerró la conexión al terminar.
- La lectura de variables de Vercel no proporcionó un DATABASE_URL utilizable
  para verificar su valor actual; no se copiaron secretos al informe.

Diagnóstico: está confirmado el agotamiento del pool de sesión; es consistente
con varias instancias reteniendo conexiones, pero falta información histórica
para atribuir el pico a tráfico, previews u otro cliente concreto.

Siguiente cambio recomendado: usar modo transacción para el runtime de Vercel y
cerrar conexiones inactivas con `idle_timeout` (por ejemplo, 20 segundos).
Verificar los flujos reales en preview antes de cambiar las variables de
producción. Mantener las conexiones de migración separadas.

Referencias: [conexiones de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
y [cierre de conexiones de Postgres.js](https://github.com/porsager/postgres#connection-timeout).

## React 418: hidratación del panel en iOS

[Incidencia](https://us.posthog.com/project/651528/error_tracking/01a118c1-c4bb-7c10-90fa-bed72eed4fec):
tres ocurrencias, una identidad, dos sesiones. Todas en `/admin/messages`,
incluido el filtro `status=pending`, desde Chrome iOS. Última ocurrencia:
8 de octubre a las 04:39:26 UTC.

React 418 confirma que el texto generado por el servidor no coincidió con el
del cliente. La traza disponible contiene frames minificados de React y no
identifica el nodo que difería. La cola formatea fechas en servidor y navegador,
y muestra texto libre de cartas. Las fechas ya especifican UTC, lo que reduce
la probabilidad de una simple diferencia de zona horaria.

Hipótesis a comprobar:

- Diferencias de formato entre las implementaciones de Intl del servidor y iOS.
- Conversión automática de fechas, teléfonos o direcciones en enlaces por iOS;
  no existe una configuración `format-detection` que la desactive.

No se confirmó ninguna de esas causas. Reproducir en iOS con el mismo idioma y
datos del panel, comparar el DOM antes de hidratar y subir source maps privados
ligados al build. No ocultar el error con `suppressHydrationWarning` sin localizar
el elemento afectado.

Referencias: [React 418](https://react.dev/errors/418),
[problemas de hidratación en iOS](https://nextjs.org/docs/messages/react-hydration-error#common-ios-issues)
y [trazas de PostHog](https://posthog.com/docs/error-tracking/stack-traces).

## ResizeObserver: publicación móvil, sin bloqueo observado

[Incidencia](https://us.posthog.com/project/651528/error_tracking/01a11a97-273a-7eb3-8af4-30e90b926394):
tres ocurrencias, dos identidades y dos sesiones; siempre en `/messages/new`.
Afecta a Safari iOS y Chrome Android.

En ambas sesiones hay un evento `message_published` después del error y una
navegación a `/?publication=pending#map`. Esto confirma que pudieron completar
la publicación; no demuestra ausencia de problemas visuales.

La aplicación no implementa ResizeObserver directamente. El ComboBox y el
Popover de React Aria del selector de ubicación observan tamaños y actualizan
anchuras. Son candidatos razonables, pero el error no incluye stack ni elemento
afectado. Reproducir al abrir sugerencias, mostrar el teclado y cambiar el ancho
del móvil antes de alterar CSS, sustituir componentes o suprimir captura.

## Script error: una ráfaga sin origen identificable

[Incidencia](https://us.posthog.com/project/651528/error_tracking/01a11aae-6eca-74b3-a08d-d901a9915f15):
nueve eventos en una sola sesión de Safari iOS. Ocurrieron entre las
08:43:21.210 y las 08:43:21.219 UTC, nueve milisegundos en total, en la portada
después de publicar. Inmediatamente después aparece un pageleave.

No son nueve fallos independientes demostrados. Podrían compartir un mismo
origen, pero no hay stack ni recurso identificado. Revisar el script que falla
con inspector remoto; comprobar CORS y `crossorigin` si procede de otro origen.
Los source maps por sí solos no reconstruyen una traza que el navegador no envió.

Referencia: [diagnóstico de PostHog](https://posthog.com/docs/error-tracking/troubleshooting).

## Fallos de red: dos casos distintos

- [Load failed](https://us.posthog.com/project/651528/error_tracking/01a1189c-db63-7e40-9412-508df8b3915b):
  una ocurrencia de Safari iOS. El frame de la aplicación corresponde a
  `global-error.tsx`, que registra el error recibido del límite global de Next.
  Este frame es el punto de captura, no identifica la petición que falló.
  La sesión siguió navegando y abriendo cartas después del error.
- [network error](https://us.posthog.com/project/651528/error_tracking/01a11aad-a771-7f43-a829-0b525feb4399):
  una ocurrencia en Chrome Windows, seis segundos después de abrir la portada;
  no hay stack ni URL de la petición.

El mapa ya gestiona errores mediante React Query y aplica un reintento. El
selector de ubicación captura fallos de red y muestra estado de indisponibilidad.
Sin embargo, `LanguageSynchronizer` invoca una acción del servidor con `.then()`
y sin `.catch()`. El try/catch de la acción solo captura fallos dentro del
servidor: no puede capturar el rechazo del transporte en el navegador.

Ese camino puede producir una promesa rechazada sin gestionar. Es una debilidad
concreta del código, pero no se puede atribuir la incidencia a ese componente
con la evidencia actual. Añadir una prueba de rechazo de transporte y gestión
del fallo, conservando el idioma y los borradores, y registrar contexto del
origen para distinguirlo de futuras incidencias de red.

## Orden propuesto

1. Pool de transacción y cierre por inactividad: protege la disponibilidad del
   servidor y tiene una prueba de conectividad inicial satisfactoria.
2. Manejo del rechazo de sincronización de idioma y contexto de diagnóstico.
3. Source maps y reproducción de hidratación en iOS.
4. Reproducción visual de ResizeObserver; captura del origen de Script error.

Las grabaciones están desactivadas en la aplicación; se usaron cronologías de
eventos, no vídeos. No se activaron grabaciones, no se cambió el pool, no se
suprimieron errores ni se marcaron incidencias como resueltas.

## Correcciones posteriores a la investigación

La rama `fix/posthog-pool-and-language-network` incorpora:

- Selección del puerto 6543 para URLs del pooler compartido de Supabase en
  modo sesión cuando `VERCEL=1`, sin cambiar variables de entorno o scripts
  de migración. Las URLs directas y locales conservan su puerto.
- `idle_timeout: 20` en el cliente de runtime; una prueba contra PostgreSQL
  comprueba que una consulta posterior abre otra conexión y sigue funcionando.
- Manejo del rechazo de transporte de `LanguageSynchronizer`, conservando el
  idioma y los borradores y reintentando con la navegación existente. La
  excepción se registra con `operation: synchronize_language_preference`.

Estas correcciones no prueban el origen de las dos incidencias de red
observadas ni resuelven las hipótesis pendientes de iOS y ResizeObserver.
El cambio de modo del pool se aplicará al desplegar esta rama en Vercel.
El cliente modificado también completó dos transacciones de lectura contra el
pooler remoto por 6543, comprobando search_path, settings y PostGIS. No se
realizaron escrituras remotas durante esa comprobación.
