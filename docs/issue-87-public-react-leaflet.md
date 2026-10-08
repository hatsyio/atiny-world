# Issue 87: React Leaflet en el mapa público

## Decisión

Extender la adopción de React Leaflet al mapa principal después de los pilotos
#92 y #93. La rama parte de la integración de #93 en #89 (62ce9b5).
Los tres mapas usan ahora la misma biblioteca; el clustering conserva
leaflet.markercluster 1.5.3, Leaflet 1.9.4, sus iconos y los tiles de Carto.

El componente principal anterior tenía 399 líneas. El wrapper, la implementación
React Leaflet y el adaptador de clustering suman 285. Se eliminan la creación
manual del mapa y los marcadores, los registros de capas por ID, los observadores
de consulta por popup, la construcción de contenido DOM y la actualización
manual de los estados de contenido y traducción. La sincronización DOM restante
se limita a etiquetas que Leaflet crea y no expone como props mutables.

## Responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| LeafletMap | Carga sin SSR, fallback, filtros/listado y estado de pantalla completa |
| ReactLeafletPublicMap | Mapa, tiles, controles, eventos y marcadores con identidad estable |
| MarkerCluster | Adaptador del plugin mediante createLayerComponent y layerContainer |
| PublicMarker | Popup, selección/revelado y etiquetas nativas |
| MessageContent | Consulta pública montada solo mientras el popup está abierto |

React Leaflet añade y retira los hijos del grupo. El plugin calcula agrupaciones
y actualiza el índice cuando cambia la posición de un marcador. Se declara
@react-leaflet/core 3.0.0 como dependencia directa porque se usa su API de extensión;
ya estaba en el lockfile como dependencia transitiva, sin añadir otra biblioteca
ni modificar las versiones restantes.

## Comportamiento y limpieza

La vista inicial sigue siendo la guardada, o latitud 20/longitud 0/zoom 2. Las
actualizaciones de datos, callbacks, idioma y paneles conservan la instancia y
la exploración. Las cartas se identifican por publicId; un punto publicado
actualizado mueve la misma capa. El mapa sigue emitiendo vista y límites al
montarse y después de moveend. Se conservan límites verticales y world wrapping.

Seleccionar una carta centra inicialmente a zoom 8. Si está agrupada, el grupo
se amplía o despliega hasta mostrar el marcador y abrir su carta. Este revelado
usa listeners cancelables propios: zoomToShowLayer del plugin carece de API de
cancelación y puede dejar un listener que falla si se retira el marcador durante
la animación. Al completar o cancelar el efecto se retiran moveend, animationend
y spiderfied; los callbacks comprueban que el marcador siga en el grupo.

El contenido usa JSX escapado y useQuery con la política pública existente:
sin caché persistente, revalidación de consultas abiertas y errores no reveladores.
Cerrar el popup, retirar su marcador o desmontar cancela la petición pendiente.
Una carta que pasa a no pública no conserva contenido visible tras revalidar.
Los filtros, el listado y la lectura completa mantienen sus callbacks actuales.

La pantalla completa conserva su control debajo del zoom, paneles y Escape.
Las traducciones cambian sin reconstruir el mapa ni cerrar el popup. El módulo
Leaflet y el plugin solo se importan en el componente cargado sin SSR. El error
boundary conserva el aviso de mapa no disponible; no detecta errores de red de
cada tile individual, como tampoco hacía la implementación anterior.

## Evidencia

La regresión del cambio de coordenadas falla antes de la migración: el marcador
permanece en el punto anterior. Pasa conservando la identidad de mapa y capa.
La regresión de retirada durante revelado falla con zoomToShowLayer por TypeError
en el siguiente moveend; pasa con la limpieza cancelable.

Las pruebas de ciclo de vida usan React Leaflet, Leaflet y markercluster reales,
sin sustituir sus implementaciones. Cubren clusters y retirada, selección agrupada,
popups/callbacks actualizados, texto literal, cambios de idioma y vista, filtros,
pantalla completa, consultas retiradas/cerradas, StrictMode y SSR sin window.
La revisión independiente confirma la corrección de la carrera del revelado.

En Chrome local se verifican tiles, medallón de tres cartas, revelado y popup de
selección, texto literal, lectura completa, idioma con popup abierto, filtros,
pantalla completa/Escape, retirada de capas y apertura por Enter. Esta prueba
visual usa cartas sintéticas y una respuesta local, mientras los contratos y
pruebas de integración validan los endpoints reales. La ruta temporal se elimina
antes de crear la PR.

## Referencias

- [Arquitectura y API de extensión de React Leaflet](https://react-leaflet.js.org/docs/core-architecture/)
- [Props mutables de Marker y Popup](https://react-leaflet.js.org/docs/api-components/)
- [Plugin markercluster y métodos de grupo](https://github.com/Leaflet/Leaflet.markercluster)
