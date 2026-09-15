# T045 — Geoapify EU autocomplete adapter

## Cambios

- Se añadió `src/server/locations/geoapify.ts`, marcado como `server-only`.
- El adaptador consulta el endpoint de autocomplete con `bias=countrycode:none` literal, idioma, límite y formato JSON. La clave se obtiene solo desde el entorno del servidor y se envía en la cabecera privada `x-api-key`, nunca en la URL.
- Se limita la respuesta del proveedor a localidad, país, código ISO en minúsculas, coordenadas públicas y la atribución fija `Geoapify`; no devuelve campos de dirección ni la respuesta cruda.
- Un 429 se representa como `GeoapifyProviderError` con `outcome: 'rate_limited'`; abortos, timeout, respuestas no correctas y cuerpos inválidos se representan con `outcome: 'unavailable'`.

## TDD y comandos

RED (antes de crear el adaptador):

```text
$ pnpm vitest run tests/unit/server/locations/geoapify.test.ts
FAIL  ... Cannot find module '/src/server/locations/geoapify'
Test Files  1 failed (1)
Tests  no tests
```

GREEN:

```text
$ pnpm vitest run tests/unit/server/locations/geoapify.test.ts
Test Files  1 passed (1)
Tests  3 passed (3)
```

Verificación focalizada adicional:

```text
$ pnpm exec eslint src/server/locations/geoapify.ts tests/unit/server/locations/geoapify.test.ts
# sin salida; código 0
```

`pnpm typecheck` continúa fallando fuera de T045 porque falta `src/app/api/locations/suggestions/route`, que corresponde a T047:

```text
tests/contract/location-suggestions-api.test.ts(3,22): error TS2307:
Cannot find module '../../src/app/api/locations/suggestions/route'
```

## Archivos

- `src/server/locations/geoapify.ts`
- `tests/unit/server/locations/geoapify.test.ts`
- `.superpowers/sdd/plan/task-45-report.md`

## Revisión propia

- La URL no incorpora la clave ni datos de resultados; la consulta va al proveedor como parte de la solicitud backend y nunca se registra.
- La prueba cubre parámetros de proveedor, allowlist del DTO, 429 y timeout/abort.
- No se modificaron la ruta T047, UI, tokens de selección ni archivos ajenos.

## Dudas y preocupaciones

- Ninguna para T045. El typecheck global queda bloqueado de forma preexistente por T047 aún no implementada.

## Corrección 1 — límites de coordenadas públicas

- Se corrigió `normalizeResult` para descartar resultados de Geoapify cuya latitud no esté entre `-90` y `90` o cuya longitud no esté entre `-180` y `180`.
- Se añadió una regresión con `lat: 90.0001` y `lon: -180.0001`; ambas sugerencias deben descartarse.

RED:

```text
$ pnpm vitest run tests/unit/server/locations/geoapify.test.ts
FAIL  drops provider results whose coordinates are outside public point bounds
Expected: []
Received: two normalized suggestions with latitude 90.0001 and longitude -180.0001
```

GREEN:

```text
$ pnpm vitest run tests/unit/server/locations/geoapify.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)

$ pnpm exec eslint src/server/locations/geoapify.ts tests/unit/server/locations/geoapify.test.ts
# sin salida; código 0
```
