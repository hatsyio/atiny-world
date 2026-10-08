# Logs operativos

Los consumidores usan `createLogger(scope)` de
`src/server/observability/logger.ts` y sus métodos `info`, `warn` y `error`.
El mensaje identifica el evento; los datos variables van en campos para que
la política común pueda protegerlos. No incluir datos personales, contenido
de cartas ni credenciales en el mensaje o el scope.

```ts
const logger = createLogger('api.map.features')
logger.info('map_features_response_sent', {
  feature_count: features.length,
  result_truncated: truncated,
})
```

La política redacta claves sensibles, también en estructuras anidadas, listas
y claves con puntos, y valores con formato de correo o credencial. No modifica
los campos originales. Después distribuye el evento a dos adapters:

- Consola: una línea JSON con hora, nivel, scope, mensaje y campos protegidos.
- OTLP/PostHog: conserva mensaje y nivel, incluye el scope como atributo y
  serializa objetos y listas protegidos como atributos JSON. Los campos nulos
  o de tipos no compatibles se omiten del transporte OTLP.

La consola siempre está activa. OTLP requiere
`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` y `NEXT_PUBLIC_POSTHOG_HOST`. El exporter
se inicializa en el module graph que emite, sin depender de instrumentation.
El envío y `forceFlush` se ejecutan mediante `after` de Next.js. Sin
configuración, fuera de un contexto de petición o ante fallos del exporter,
la petición conserva su resultado y la consola sigue disponible. El fallo
de un destino no impide intentar el otro.

El segundo argumento de `createLogger` permite configurar una lista de
`LogSink` para pruebas u otros contextos. Los adapters reciben campos ya
protegidos; no deben usarse directamente desde consumidores.

La analítica de producto y la captura de excepciones de PostHog siguen en
`src/server/observability/posthog.ts`, con su propio ciclo de captura y flush.
No se distribuyen como logs operativos.

Verificación local: `pnpm exec vitest run tests/unit/server/observability`.
Las pruebas de OTLP utilizan un receptor HTTP local y el exporter real;
no envían eventos al servicio remoto.
