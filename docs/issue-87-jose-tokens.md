# Issue 87: tokens estándar con jose

Esta segunda tanda depende de la PR #89. Sustituye los formatos HMAC propios
de selecciones y cursores por JWT firmados con jose 6.2.12. La issue continúa
abierta para useActionState y las evaluaciones de React Leaflet y migraciones.

## Firma y validación

Solo se permite HS256. El encabezado typ separa selecciones de ubicación
(`atiny-location-selection+jwt`) y cursores (`atiny-message-cursor+jwt`).
Los payloads se validan con Zod después de verificar la firma. Las selecciones
usan el esquema compartido y requieren exp entero; los cursores requieren un
identificador bigint positivo dentro del rango PostgreSQL y, en el mapa, una
fecha de publicación ISO válida. Los cursores propios no necesitan esa fecha.

Las selecciones duran cinco minutos, con precisión de segundos de JWT (hasta
menos de un segundo menos que el formato anterior). Solo un payload firmado,
válido y caducado produce EXPIRED; las firmas, algoritmos, tipos o payloads
incorrectos producen INVALID. Los cursores no caducan, como antes.

La firma y verificación son asíncronas en sugerencias, acciones y repositorios.
Se mantienen permisos, filtros, orden de paginación y límites existentes.
CURSOR_SECRET sigue siendo obligatorio en producción; en desarrollo se permite
una clave efímera por proceso. No es necesario rotar secretos ni migrar datos.

## Transición y reversión

Se retira el verificador anterior: los tokens de dos segmentos dejan de ser
válidos. Una selección antigua pide seleccionar de nuevo la ubicación, con el
contenido del borrador conservado por el formulario existente. No se publica
una ubicación sin validación.

El mapa devuelve 400 con fieldErrors.cursor = pagination.cursorInvalid para
cursores inválidos. Al pulsar reintentar, el cliente reinicia la consulta exacta
en la primera página y sustituye las páginas anteriores, sin duplicarlas. Los
otros errores mantienen su reintento habitual. En cartas propias, un cursor
antiguo vuelve a la primera página con los mismos permisos del propietario.
Una pestaña abierta con el JavaScript anterior puede necesitar recargarse para
adoptar esta recuperación.

El cambio se revierte con código, sin pérdida de datos. Volver a la versión
anterior invalida los JWT emitidos durante el despliegue: habrá que volver a
seleccionar la ubicación o reiniciar la paginación. Evitar mezclar instancias
que emitan formatos distintos durante una transición prolongada.

## Comprobaciones

Las pruebas verifican los JWT emitidos con jwtVerify de jose, algoritmos no
permitidos, separación de tipos, claves incorrectas, caducidad, payloads
firmados malformados y rechazo de tokens antiguos. La recuperación de la lista
se comprueba con un cursor rechazado y una primera página actualizada. Los
contratos ejercitan paginación real y acciones; BDD y las integraciones cubren
publicación, edición y permisos contra la base local migrada.

- [jose](https://github.com/panva/jose)
- [SignJWT](https://github.com/panva/jose/blob/main/docs/jwt/sign/classes/SignJWT.md)
- [jwtVerify](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md)
