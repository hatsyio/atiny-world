# ResizeObserver en la creación de cartas

Revisión del 9 de octubre de 2026, proyecto `651528`, últimos siete días.
Los recuentos son una consulta puntual, no una métrica persistida.

[Incidencia investigada](https://us.posthog.com/project/651528/error_tracking/01a11a97-273a-7eb3-8af4-30e90b926394):
`ResizeObserver loop completed with undelivered notifications.` Diez eventos,
ocho identidades y ocho sesiones; todos en `/messages/new`. Último evento:
9 de octubre a las 05:59:53 UTC. Hay muestras de iOS, Android, Linux y Windows.
Se priorizó por recurrencia, alcance y concentración en el formulario de creación.

## Impacto observado

Las cronologías de siete de las ocho sesiones incluyen `message_published`
después del aviso, incluida la sesión más reciente. La octava continúa navegando
sin una publicación observada en el intervalo consultado. Esto no demuestra un
bloqueo causado por el aviso ni descarta problemas visuales.

Los eventos no contienen stack. Los source maps no permiten reconstruir una
traza que el navegador no envió. Referencia:
[trazas de PostHog](https://posthog.com/docs/error-tracking/stack-traces).

## Reproducción y diagnóstico

La apertura y selección de una lista estable no reprodujo el fallo. Sí lo hizo
el componente real `LocationPicker` al cambiar consultas con el Popover abierto,
intercalando el estado de carga con listas de dos y doce sugerencias. La prueba
usa Chromium, CSS de la aplicación y viewports de 320 y 390 píxeles de ancho
por 660 de alto. Ambos casos produjeron tres avisos antes de la corrección.
El mismo ensayo a 1440 píxeles no produjo avisos.

Instrumentar los observadores en el ensayo identificó el elemento observado
como `.location-picker__popover`, con cambios entre 19 píxeles del estado de
carga y las alturas de resultados limitadas por el espacio disponible.
La implementación instalada de React Aria observa el overlay y ejecuta
`updatePosition` desde su callback; esa función modifica su posición y
`maxHeight`. Los cambios de contenido y la recolocación vuelven a modificar
la altura observada en el mismo ciclo.

Un límite explícito `maxHeight` no eliminó el aviso. Cambiar únicamente la lista
de grid a block, añadir overflow al Popover o contener su layout tampoco lo
eliminó. Mantener estable la altura del Popover sí eliminó el fallo reproducido.

## Corrección y comprobaciones

El Popover transparente reserva 230 píxeles de lista más el padding y borde
del panel interior. Su altura observada permanece estable. El panel visible
ajusta su altura al contenido; en el ensayo pasa de unos 253 píxeles con doce
sugerencias a unos 108 con dos. El `max-height` inline de React Aria limita
el contenedor y el panel al espacio disponible en el viewport.

Cuando el Popover se coloca encima del input, el panel se alinea al borde
inferior del contenedor; cuando se coloca debajo, al borde superior. Así el
panel visible queda junto al input sin mostrar el espacio reservado. La zona
transparente usa `pointer-events: none` y el panel `pointer-events: auto`:
un clic en la zona reservada llega al contenido subyacente y cierra el
desplegable como un clic exterior. La lista puede reducirse, mantiene las
opciones alineadas arriba y permite scroll.

La prueba de navegador escucha los eventos `error` de `window`: estos avisos
no llegan como excepciones `pageerror` de Playwright. Usa respuestas de búsqueda
controladas y mapas de prueba, sin peticiones de tiles ni escrituras remotas.
Ejercita carga, listas cortas y largas, selección y reducción del viewport a
460 píxeles de alto; comprueba que las opciones se pueden desplazar y el Popover
cabe en la pantalla. Verifica también que el panel se contrae y crece con los
resultados, queda anclado al lado correcto del input y los clics en la zona
transparente cierran la lista.

- Antes del cambio: dos pruebas fallan con tres avisos cada una; escritorio pasa.
- Después: las 17 pruebas de navegador pasan, incluidos los desplegables existentes.
- Las 19 pruebas unitarias de `LocationPicker` pasan.
- La comprobación de tipos pasa.

La reproducción confirma una causa local coherente con la incidencia. No prueba
que todos los eventos históricos compartan ese mecanismo. No se ha reproducido
en un iPhone o Android real, ni con el teclado virtual nativo. El cambio queda
pendiente de despliegue y observación en producción. La incidencia no se ha
marcado como resuelta ni suprimido su captura.

## Otros candidatos revisados

- `ChunkLoadError`: cinco eventos en dos sesiones, al descargar un chunk de UI
  desde `clerk.atinyatlas.com`. Conviene investigar disponibilidad del recurso
  y recuperación del inicio de sesión después de este cambio.
- `Load failed`: dos eventos capturados y gestionados por `LanguageSynchronizer`;
  el source map identifica ese componente. Ya existe manejo de rechazo de transporte.
- Los errores de `window.webkit.messageHandlers` y del puente Java incluyen
  funciones de comunicación nativa. El stack sugiere código inyectado por un
  navegador integrado; no se atribuyen a la aplicación sin más evidencia.
