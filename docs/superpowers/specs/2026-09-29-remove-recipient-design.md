# Eliminar destinatario de los mensajes

## Objetivo

Eliminar el concepto de destinatario (`recipient`) del producto. Publicar, consultar, editar y visualizar una carta no debe requerir ni mostrar una elección de destinatario. El mapa tampoco debe filtrar por ese campo.

## Alcance y criterios de éxito

- El formulario de publicación solo envía contenido y ubicación, y no muestra validaciones ni controles de destinatario.
- Los mensajes propios, públicos, las cartas y las respuestas del mapa no exponen `recipient`.
- Las API de mapa ya no aceptan `recipient`; una petición que lo incluya falla con `VALIDATION_ERROR` y HTTP 400.
- La creación, edición, lectura pública y gestión de mensajes continúan funcionando con los filtros restantes y los enlaces estables.
- Una migración nueva elimina `app_private.messages.recipient` sin modificar migraciones anteriores ni perder otros datos de mensajes existentes.
- Las semillas, pruebas, escenarios BDD y documentación de producto ya no describen destinatarios.

## Diseño técnico

### Dominio y flujo de escritura

Eliminar `RECIPIENTS`, `Recipient` e `isRecipient` de los contratos de dominio y retirar `recipient` de los tipos y validaciones de creación. La acción de publicación seguirá validando contenido y ubicación, pero no aceptará ni persistirá un destinatario. El repositorio de mensajes insertará las mismas columnas actuales salvo `recipient`.

Los objetos JavaScript que lleguen con una propiedad adicional `recipient` no tendrán una ruta de persistencia ni una validación asociada; los tipos públicos y los contratos de respuesta no la declararán.

### Persistencia

Crear una migración posterior a las existentes. Como `preview_api.public_messages` proyecta actualmente la columna, la migración debe eliminar y recrear esa vista sin el campo antes de ejecutar el `ALTER TABLE`:

La vista recreada debe seleccionar `public_id`, `location_precision`, `locality`, `country`, `country_code`, `published_at`, `author_public_id`, `username` y `display_name`, usando la misma unión, condición de visibilidad, `security_invoker = false` y permisos que tenía antes.

La operación conserva filas, identificadores, autoría, contenido, estado, ubicación, fechas y enlaces estables. La vista mantiene sus controles de seguridad y el grant de lectura para `atiny_preview_reader`. El seed y los helpers de base de datos de pruebas se adaptarán al nuevo esquema.

### Lecturas, mapa y API

Retirar `recipient` de `PublicMapFeature`, `PublicMessageDetail`, mensajes propios, DTOs de repositorio y proyecciones SQL. Las consultas del mapa conservarán los filtros de ciudad, país y fan.

`parseMapQuery` dejará de declarar el parámetro. Zod rechazará cualquier URL que aún lo incluya, de modo que ambas rutas públicas del mapa responderán 400 con el sobre de error existente. El estado del controlador y la serialización de URL se reducirán a los filtros restantes.

### Interfaz

Eliminar el selector y los textos de destinatario del formulario de creación, así como el estado y los errores relacionados. Eliminar el selector del mapa y cualquier renderizado del valor en tarjetas, listas, detalles o formularios de edición. No se cambiarán otros controles ni el flujo de selección de ubicación.

### Documentación y contratos

Actualizar la especificación MVP, el modelo de datos, contratos HTTP/UI, requisitos y arquitectura para que no definan destinatarios. Los escenarios BDD de publicación y exploración se simplificarán: publicar no requiere destinatario y explorar conserva filtros de ciudad, país y fan.

## Compatibilidad y errores

- Las migraciones ya aplicadas no se editan.
- Los enlaces públicos existentes siguen resolviendo por `public_id`.
- Se elimina únicamente la dimensión de destinatario; no se convierte en otro valor ni se modifica el contenido de las cartas.
- Las URL antiguas del mapa que contengan `recipient` reciben un error de validación explícito, evitando resultados ambiguos.

## Verificación

Se actualizarán o añadirán pruebas para:

1. contratos de dominio y validación de publicación sin destinatario;
2. formulario de publicación y filtros del mapa sin controles de destinatario;
3. parseo de mapa rechazando el parámetro retirado y preservando los filtros restantes;
4. contratos HTTP sin `recipient` en respuestas y con 400 para el parámetro obsoleto;
5. creación, edición, lectura pública y BDD sobre el esquema migrado;
6. aplicación de la migración sobre datos existentes conservando los demás campos.

## No incluido

No se rediseñará la moderación, la búsqueda de usuarios, la selección de ubicación ni el modelo de cuentas. Tampoco se añadirá compatibilidad de transición para consultar o restaurar destinatarios eliminados.
