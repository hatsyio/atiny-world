# Issue 87: useActionState en publicación y edición

Esta tercera tanda depende de la rama de la PR #89, que ya incluye la PR #90.
Adopta useActionState en los dos formularios existentes, sin dependencias nuevas.
Quedan para tandas independientes las evaluaciones de React Leaflet y migraciones.

## Responsabilidades

React gestiona el resultado y el estado pendiente de cada envío. Se retiran
los useState de sending/saving, los indicadores independientes de éxito y
los errores generales. En creación se conserva la última publicación exitosa
para seguir mostrando la confirmación durante intentos posteriores.

El contenido, la selección y confirmación del picker, los errores por campo
que se descartan al corregir un control y el cooldown siguen siendo estado
local. No se añade un gestor de formularios. Las acciones de servidor,
validación, permisos y control de versión mantienen sus contratos.

El evento submit valida las condiciones de la UI y captura el payload tipado;
se despacha dentro de startTransition. Se conserva el formulario controlado
y su envío con teclado. Una ref bloquea de inmediato los envíos repetidos en
el mismo turno de eventos: useActionState por sí solo los encolaría, y el
estado pendiente aún puede no haberse renderizado. La ref se libera al terminar,
incluso ante excepciones; React mantiene deshabilitados enviar y cancelar
mientras está pendiente.

Los errores esperados y las excepciones conservan el borrador y permiten el
reintento que ya admitía cada formulario. Una ubicación inválida o caducada
en creación exige corregir la selección; el cooldown y el límite bloquean
publicación como antes. Una edición conserva expectedVersion tras un conflicto
sin reenviar automáticamente. Los avisos se traducen en el idioma actual.

Tras éxito se conserva el callback de publicación o guardado, la limpieza del
formulario de creación y la invalidación de consultas públicas de edición,
así como el destino de navegación existente.

## Verificación

Las regresiones de envíos simultáneos fallan en ambos formularios anteriores
con dos llamadas, y pasan con una sola llamada y un solo callback. Las pruebas
usan useActionState real y promesas pendientes, no un mock del hook.

También se comprueban payloads y teclado, estados pendientes, errores por campo,
selecciones caducadas, cooldown y límite; borradores Unicode, reintento después
de excepciones y conservación del conflicto y selección al cambiar de idioma.
Las suites BDD, contratos e integración verifican los flujos y permisos del
servidor contra la base local migrada.

- [useActionState de React](https://react.dev/reference/react/useActionState)
