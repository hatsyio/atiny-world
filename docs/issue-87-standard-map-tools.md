# Issue 87: primera tanda de herramientas estándar

Esta PR cubre las consultas públicas del mapa, el ComboBox de ubicaciones,
los esquemas compartidos y la corrección del parser de tokens. La issue 87
continúa abierta para jose, useActionState y las evaluaciones independientes
de React Leaflet y del ejecutor de migraciones. No cambia la presentación
planteada en las issues 38, 45 y 46.

## Consultas públicas

`MapQueryProvider` mantiene un QueryClient por montaje del proveedor. Las
claves comparten el prefijo `public-map` y distinguen zona/filtros, lista y
publicId. TanStack Query sustituye efectos, contadores de reintento,
AbortControllers y acumulación manual de páginas. Los popups usan
QueryObserver porque su contenido sigue perteneciendo a Leaflet: se
suscriben en `popupopen` y se destruyen en `popupclose` o al retirar el marcador.

- `staleTime: 0`: revalidación al montar, enfocar la ventana y reconectar.
- `gcTime: 0`: no conservar cartas públicas cuando dejan de tener observadores.
- Revalidación cada 30 segundos mientras la vista está activa. La moderación
  remota no es instantánea: se refleja en la siguiente revalidación.
- Sin reintentos automáticos de HTTP 4xx, incluido 429. Un reintento para
  fallos de red y HTTP 5xx; el botón de reintento sigue disponible.
- Publicar, editar y eliminar reinician explícitamente las consultas públicas
  y recargan las activas; se retira el evento `atiny:message-published`.
- La lista usa useInfiniteQuery. Un fallo al solicitar la página siguiente
  permite reintentar esa página sin perder las anteriores. Un fallo de
  revalidación oculta los datos anteriores para evitar seguir mostrando una
  carta que ya no es pública.
- Los marcadores recibidos del servidor prevalecen sobre el marcador inicial
  de una carta seleccionada; no se reinserta indefinidamente una carta que
  desaparece de la consulta pública.

## Ubicación, contenido y tokens

React Aria gestiona teclado, opción activa, relación input/listbox, cierre y
selección. Las sugerencias siguen procediendo del backend, con debounce,
cancelación y protección frente a respuestas antiguas. Los avisos se muestran
dentro del popover abierto para que sigan accesibles al lector de pantalla,
y debajo del campo cuando está cerrado. La selección exacta sigue requiriendo
confirmar explícitamente el punto público.

`domain/location/selection.ts` define los esquemas Zod y sus tipos inferidos
para el picker y las acciones. Coordenadas y contenido comparten las mismas
reglas entre dominio y acciones, sin imports de servidor en el cliente. Se
conservan los errores por campo y la precedencia de selección inválida/caducada.
Autorización y control de versión permanecen en las operaciones del servidor.

El formato HMAC actual continúa: no hay transición de tokens ni cursores en
esta tanda. Solo se aceptan exactamente dos segmentos base64url y firmas de
43 caracteres ASCII. El payload de selección se valida antes de leer la
caducidad, conservando INVALID y EXPIRED. Las selecciones y cursores válidos
emitidos antes del cambio siguen funcionando.

## Validación

Las pruebas cubren navegación del ComboBox con flechas/Enter/Escape, respuestas
fuera de orden, privacidad y confirmación exacta; paginación y cancelación;
invalidación de cartas visibles y popups; deduplicación, errores HTTP y ausencia
de caché inactiva; firmas Unicode, segmentos extra y payloads firmados inválidos.
Las suites BDD, de contrato y de integración ejercitan las acciones y permisos
contra la base local migrada.

En Chrome local se comprueban carga del mapa, filtros y pantalla completa con
Escape. El formulario completo requiere una sesión de Clerk; la interacción
del picker se verifica en las pruebas de componentes con React Aria real.

## Referencias

- [Consultas infinitas de TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [Cancelación de consultas](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
- [ComboBox de React Aria](https://react-aria.adobe.com/ComboBox)
- [Esquemas Zod](https://zod.dev/api)
