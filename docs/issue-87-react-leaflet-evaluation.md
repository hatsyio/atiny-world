# Issue 87: evaluación de React Leaflet

## Estado de la evaluación

Este documento recoge el piloto inicial de #92. La evaluación posterior del
[selector](issue-87-selection-react-leaflet.md) y del
[mapa principal](issue-87-public-react-leaflet.md) justifica extender la adopción
a los tres mapas. Las siguientes conclusiones describen el alcance de ese
primer piloto, no una restricción vigente.

## Decisión del piloto inicial

Adoptar React Leaflet 5.0.0 solo en `LetterLocationMap`, el mapa estático de una
carta. Conservar las implementaciones actuales de `LeafletMap` y
`LocationSelectionMap`: el piloto no demuestra todavía una reducción clara
de mantenimiento para esos dos mapas interactivos.

La PR depende de la rama de #89, que incluye las PR #90 y #91. La evaluación
parte del commit 508c74816c1e2dae674d60b83948d52a6db0b280.

## Comparación del piloto

| Responsabilidad | Antes | Después |
| --- | --- | --- |
| Carga en navegador | import asíncrono dentro de un efecto y bandera disposed | next/dynamic con ssr: false |
| Montaje y retirada | crear mapa, añadir tiles/marker, bindPopup y map.remove | MapContainer, TileLayer, Marker y Popup gestionan capas y listeners |
| Contenido de carta | crear un párrafo DOM y escribir textContent | hijo React de Popup; texto escapado por React |
| Cambio de contenido | retirar y reconstruir el mapa | actualizar el hijo conservando mapa y popup abierto |
| Cambio de idioma | retirar y reconstruir el mapa | actualizar títulos accesibles y botón de cierre conservando el popup |
| Punto distinto | reconstruir centrando a zoom 15 | key por coordenadas: reconstruir centrando a zoom 15 |
| Fallo de montaje | catch y estado local | error boundary con el mismo aviso traducido |

No es una reducción de líneas totales: el componente anterior tiene 82 líneas;
el wrapper y el mapa declarativo suman 94 en esta versión. La mejora está en
retirar la creación y destrucción manual del mapa y sus capas, la bandera de
cancelación, la construcción del popup DOM y la reinstanciación por texto o
idioma. La única sincronización DOM restante actualiza etiquetas que Leaflet
crea y que React Leaflet no expone como props mutables.

La nueva dependencia tiene esa responsabilidad concreta y añade
`@react-leaflet/core` 3.0.0 de forma transitiva. Sus peers son compatibles con
React/React DOM 19.3.0 y Leaflet 1.9.4 ya instalados; el lockfile mantiene una
sola versión de Leaflet. No sustituye Leaflet ni cambia tiles, iconos, CSS,
navegación deshabilitada, zoom inicial o privacidad del punto recibido.

## Carga, ciclo de vida y traducciones

React Leaflet importa Leaflet, que necesita DOM incluso al cargar el módulo.
`letter-location-map.tsx` no importa la implementación estática: la carga con
next/dynamic y SSR desactivado. En el servidor se renderiza solo el contenedor.
Sin clave de tiles se mantiene el aviso y no se crea un mapa. El error boundary
contiene errores de carga/renderizado/montaje; no pretende detectar fallos de
red de cada tile, que tampoco detectaba el componente anterior.

MapContainer usa opciones iniciales inmutables. La key por coordenadas evita
que un cambio de carta deje el centro anterior. Contenido y traducciones no
entran en esa key. El título del marcador tampoco es mutable en React Leaflet:
una ref permite actualizar su elemento sin reemplazar la capa. El botón de
cierre se traduce al añadir el popup y al cambiar el idioma con el popup abierto.
Los listeners declarativos se retiran por la biblioteca al desmontar.

## Mapas que se conservan

React Leaflet y leaflet.markercluster usan el mismo Leaflet 1.9.4; no se ha
probado un nuevo adaptador de clustering. React Leaflet no incluye por sí mismo
MarkerClusterGroup. Migrar el mapa principal requeriría decidir quién posee
marcadores, observadores de consultas, popups, controles y eventos. Añadir un
wrapper sin retirar esa gestión podría mantener dos modelos de ciclo de vida.
La suite existente comprueba que el mapa principal y sus popups siguen funcionando
junto al piloto; eso no valida una futura migración del plugin a React Leaflet.

El selector gestiona clics, dragend, centro seleccionable, enfoque y callbacks
actualizados. Su migración requeriría un piloto propio que pruebe esas entradas,
confirmación del punto y limpieza. Se conserva por falta de evidencia específica
de reducción de mantenimiento, no por incompatibilidad demostrada.

## Evidencia

Las dos regresiones de actualización de texto e idioma fallan en el componente
anterior porque el popup desaparece al reconstruir el mapa. Pasan en el piloto
manteniendo una sola instancia, centro y zoom. Se mantienen las cuatro pruebas
anteriores de navegación estática, cambio de punto, falta de configuración,
click/Enter/cierre y texto literal sin ejecutar HTML.

Las pruebas adicionales cubren StrictMode, cierre inicialmente en español,
fallo de montaje y renderizado SSR en un entorno sin window. Las pruebas usan
React Leaflet y Leaflet reales. Build, tipos y la suite general comprueban la
integración con Next.js y los mapas actuales. En Chrome local se comprueban
tiles y marcador, apertura/cierre por teclado, texto literal, actualización
de contenido e idioma con popup abierto y cambio de punto a Seúl. La página
temporal de prueba se elimina antes del commit.

## Referencias

- [Conceptos y límites de React Leaflet](https://react-leaflet.js.org/docs/start-introduction/)
- [MapContainer y opciones inmutables](https://react-leaflet.js.org/docs/api-map/)
- [Props mutables de Marker y Popup](https://react-leaflet.js.org/docs/api-components/)
- [Implementación de MapContainer 5.0.0](https://github.com/PaulLeCam/react-leaflet/blob/v5.0.0/packages/react-leaflet/src/MapContainer.tsx)
- [Limpieza de eventHandlers](https://github.com/PaulLeCam/react-leaflet/blob/v5.0.0/packages/core/src/events.ts)
