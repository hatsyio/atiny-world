# T047 — Route handler for location suggestions

## Implementación

- Se creó `POST /api/locations/suggestions` con cuerpo JSON estricto: `query` de 2 a 200 caracteres, `language` en `en|es|ko` y `limit` entero de 1 a 8.
- Si no llega `limit`, la ruta solicita cinco resultados al adaptador Geoapify de T045 y recorta defensivamente la respuesta a ese límite.
- El DTO expone únicamente localidad, país, código de país, punto, atribución de fuente y `selectionToken`. El token se firma con T046 y el secreto de servidor; no se devuelve dirección escrita, payload bruto ni el error del proveedor.
- La atribución se devuelve tanto por sugerencia (`sourceAttribution`) como a nivel de proveedor (`providerAttribution`). No se registra el cuerpo ni la consulta.
- El manejador exportado `createLocationSuggestionsPostHandler` permite inyectar búsqueda y firma en pruebas, por lo que no necesita una clave externa ni secretos reales.
- Una cuota agotada de Geoapify se convierte en 429 con `Retry-After: 60`; errores no disponibles o timeout se convierten en 502. Ambos usan envelopes estables y no sensibles.

## TDD

### RED

```text
$ pnpm vitest run tests/contract/location-suggestions-api.test.ts
FAIL  Cannot find module '../../src/app/api/locations/suggestions/route'
Test Files  1 failed (0 tests)
```

La prueba nueva fijó límite por defecto, DTO público y atribución, opacidad del token, validación 400 y los mapeos 429/502 sin filtrar una dirección incluida en el error upstream.

### GREEN

```text
$ pnpm vitest run tests/contract/location-suggestions-api.test.ts
Test Files  1 passed (3)

$ pnpm exec eslint src/app/api/locations/suggestions/route.ts tests/contract/location-suggestions-api.test.ts
# sin salida; código 0

$ pnpm typecheck
$ tsc --noEmit
# código 0

$ pnpm test:contract
Test Files  2 passed (13)

$ git diff --check
# código 0
```

## Archivos

- `src/app/api/locations/suggestions/route.ts`
- `tests/contract/location-suggestions-api.test.ts`
- `.superpowers/sdd/plan/task-47-report.md`

## Revisión propia

- El handler no analiza URL ni escribe logs, y sus envelopes no incluyen el texto de entrada ni `error.message` del proveedor.
- La única información firmada procede del DTO normalizado de T045, mediante T046.
- Se evita depender de variables de entorno durante la prueba de éxito mediante dependencias inyectadas. En producción, el secreto se obtiene solo al firmar una selección válida.
- El límite del proveedor se fija como límite de respuesta aun si éste devolviera más resultados que los solicitados.

## Dudas y preocupaciones

- La limitación de tasa cubierta aquí es la señal de cuota del proveedor (429), que es el mecanismo disponible en las interfaces T045/T046. No existe todavía una abstracción de rate limiter por cliente en el repositorio; añadir una política local de ventana/IP excedería el corte y requeriría definir almacenamiento y semántica de despliegue.
