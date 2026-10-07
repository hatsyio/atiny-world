# Issue 87: React Leaflet en el selector de ubicación

Esta tanda amplía el piloto de #92 al selector. Depende de la rama de #89,
que incluye las PR #90–#92. No añade dependencias. El mapa principal y su
clustering siguen pendientes de una evaluación propia.

## Cambio y beneficio

MapContainer, TileLayer, Marker y ZoomControl sustituyen el montaje manual,
la bandera disposed y las refs de mapa, API y último callback. useMapEvents
registra el clic con el callback actual y retira el listener al desmontar.
El marcador se actualiza mediante position y se retira al desaparecer point;
eventHandlers registra y limpia dragend.

El picker conserva búsqueda/reverse geocoding, tokens, estado pendiente y
confirmación del punto público. Seleccionar o arrastrar un punto no lo publica.
La lógica de selección aproximada/exacta y el payload firmado no cambian.

El adaptador conserva dos sincronizaciones de producto: llevar un punto fuera
de la vista al mapa y enfocar una búsqueda distinta con zoom 14. Se comparan
coordenadas, para que objetos nuevos con el mismo foco no reinicien la exploración.
Sin punto, el mapa empieza en [20, 0] y zoom 2; con punto, zoom 14. La longitud
se normaliza al rango [-180, 180] en clic, arrastre y elección del centro.

Las traducciones actualizan el título/alt del marcador y el aria-label del
canvas. ZoomControl se recrea por sus títulos al cambiar de idioma, manteniendo
la instancia y vista del mapa. La acción de centro bloquea propagación nativa
con DomEvent.disableClickPropagation: situarla dentro de MapContainer sin esa
protección dispararía también un clic del mapa y dos solicitudes al proveedor.

## Carga y errores

El wrapper usa next/dynamic con ssr: false, como el mapa de carta. Leaflet no
se importa en el servidor. Se comparte MapErrorBoundary con la carta, retirando
la definición duplicada. Sin clave o ante un fallo de montaje se conserva el
canvas y el aviso traducido, sin acción de centro. No se cambian tiles, iconos,
CSS ni el proveedor de geocodificación.

## Validación

Las regresiones de foco equivalente y listener retirado fallan en el selector
anterior y pasan con React Leaflet. La prueba de centro detectó dos callbacks
sin la protección de propagación y pasa con uno.

Las pruebas del picker sustituyen el mock completo de Leaflet por mapas y capas
reales; solo se espían instancia y eventos para conducir entradas deterministas.
Conservan búsqueda, selección con teclado, errores, respuestas fuera de orden,
reconfirmación después de arrastrar y conservación de selección/confirmación al
cambiar idioma. Las pruebas directas cubren navegación, punto ausente, coordenadas
nuevas, callbacks nuevos, normalización, StrictMode, fallos y renderizado SSR
sin window. La suite de la carta verifica el error boundary compartido.

En Chrome local, con el picker y el backend reales, se comprueban búsqueda y
centrado en Madrid, confirmación exacta, traducción sin perder confirmación,
arrastre que exige reconfirmar y elección del centro. Los tres gestos de
búsqueda, arrastre y centro generan una solicitud al proveedor por gesto.
El harness temporal se retira antes del commit.

La adopción queda limitada a los dos mapas evaluados. El mapa principal conserva
controles, MarkerClusterGroup y observadores de consultas: migrarlo exige probar
ese ciclo de vida y retirar la gestión reemplazada, no añadir otra equivalente.

- [Hooks de mapa y ciclo de vida](https://react-leaflet.js.org/docs/api-map/)
- [Props mutables y eventHandlers](https://react-leaflet.js.org/docs/api-components/)
