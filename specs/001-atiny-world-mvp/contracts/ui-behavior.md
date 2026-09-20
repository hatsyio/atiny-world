# UI Behavior Contract

Este contrato define comportamiento observable de la interfaz que no pertenece a OpenAPI ni a Server Actions. Los textos visibles tienen variantes `en` y `es`; los códigos indicados son claves estables, no mensajes finales.

## Home hierarchy and visual constraints

La portada presenta, en este orden semántico y visual: cabecera de cuenta, título e introducción, mapa, formulario de publicación y footer. Antes del formulario, el rectángulo visible del mapa debe tener mayor área que cualquier otra región de contenido. «Cálida y participativa» es una orientación cualitativa SHOULD; no altera el gate objetivo.

Los assets de producción se validan contra una allowlist propia. No se admiten fotografías de ATEEZ ni logotipos oficiales. El footer contiene contacto y descargo de afiliación.

## Independent dependency states

La pantalla mantiene estados independientes para:

- `mapData`: `idle | loading | ready | unavailable` — datos públicos de la API propia.
- `basemap`: `idle | loading | ready | degraded | unavailable` — teselas CARTO; un `tileabort` por navegación no es fallo.
- `locationSearch`: `idle | loading | ready | empty | rateLimited | unavailable | misconfigured` — Geoapify.

Cada fallo identifica el servicio afectado y ofrece reintento manual cuando sea accionable. No hay retry automático en bucle ni fallback de página completa. El reintento del mapa repite la lectura actual o ejecuta una sola llamada a `tileLayer.redraw()`; el de ubicación usa la consulta actual y descarta respuestas de intentos anteriores.

## State preservation and publishing

Un cambio de estado o reintento no remonta el formulario ni elimina filtros, texto, destinatario, consulta de ubicación, precisión o selección confirmada. La dirección permanece solo en memoria y nunca entra en URL, storage o telemetría. Cambiar la consulta tras seleccionar invalida la selección; cambiar de cuenta o cerrar sesión elimina borrador y token.

Publicar está habilitado únicamente con una selección confirmada cuyo `selectionId` siga siendo válido. Si Geoapify falla después de confirmarla, la publicación continúa sin consultar al proveedor. Si falta, fue manipulada o caducó, la UI conserva el borrador, bloquea la publicación y muestra `location.selection_required` o `location.selection_expired`.

## Mobile release matrix

Los recorridos de exploración, publicación, gestión propia y contacto por suspensión se ejecutan en Safari/iOS estable y Chrome/Android estable, a 320 y 390 píxeles CSS, en `en` y `es`: 32 ejecuciones mínimas. Cada caso verifica al inicio navegador/SO resueltos, `window.innerWidth` y `document.documentElement.lang`.

Un recorrido queda bloqueado si `scrollWidth > clientWidth`, un control esencial no está visible, habilitado, nombrado de forma accesible o dentro del viewport al accionarlo, o aparece una excepción no gestionada, 5xx inesperado o error de consola no permitido. No se usan retries para convertir un fallo en aprobado.

## Timed journeys

- `SC-001`: empieza después de cargar portada, mapa y al menos un marcador/grupo; termina al renderizar la ficha pública. Debe durar menos de 60 segundos.
- `SC-002`: empieza antes de la primera acción de registro; termina cuando la UI confirma el mensaje pendiente y su enlace estable. Debe durar menos de 5 minutos.

El setup de datos queda fuera del reloj. Los hitos usan reloj monotónico y cada ejecución genera evidencia JSON conforme a [quickstart.md](../quickstart.md).
