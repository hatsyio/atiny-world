# PostHog

La cuenta y el proyecto se gestionan directamente en PostHog, sin la integración
del Marketplace de Vercel. El proyecto conectado es `651528`, en la región US.

- Panel: https://us.posthog.com/project/651528/dashboard/2182701
- Errores: https://us.posthog.com/project/651528/error_tracking
- Informe original del asistente: https://us.posthog.com/project/651528/notebooks/Ti1txa6E

## Configuración

`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` contiene el token público del proyecto.
`NEXT_PUBLIC_POSTHOG_HOST` contiene `https://us.i.posthog.com`.
Las variables están en `.env`, ignorado por Git, y configuradas manualmente en
Production, Preview y Development de Vercel. Un despliegue nuevo debe incorporar
estas variables al bundle del navegador.

El token del proyecto permite enviar eventos; no permite consultar los errores
almacenados. Para consultar datos desde Codex se puede conectar el MCP oficial
con OAuth:

```sh
codex mcp add posthog --url https://mcp.posthog.com/mcp
codex mcp login posthog
```

## Captura

- `src/instrumentation-client.ts`: inicializa el navegador y captura excepciones.
- `src/app/global-error.tsx`: registra errores capturados por el límite de React.
- `src/instrumentation.ts`: registra errores de peticiones de Next.js mediante
  `onRequestError`, incluyendo renderizado, rutas y acciones.
- `src/server/observability/posthog.ts`: eventos de publicación, edición,
  eliminación y administración; envío diferido con `after`.
- `src/server/observability/posthog-logs.ts`: exportación de logs del mapa con
  OpenTelemetry y envío diferido.

Los envíos tienen tiempos límite y sus fallos no sustituyen la respuesta de la
aplicación. La identificación usa el ID de Clerk, sin email, nombre ni usuario.
Las grabaciones de sesiones y la captura automática de interacciones están
desactivadas. Los errores de petición no incluyen cookies, cabeceras de
autorización ni parámetros de la URL.

## Verificación y límites

Se envió un error sintético con el mensaje
`PostHog integration verification — synthetic test`, marcado como `synthetic`.
Su identidad es `integration-verification`; no corresponde a un fallo real.

La comprobación de ingestión local no verifica un despliegue de producción.
Para verificar producción, publicar los cambios y comprobar una excepción
controlada en el proyecto de PostHog.

La carga automática de source maps no está configurada. Las trazas del navegador
pueden señalar código compilado; para resolverlas al código fuente original hay
que configurar la subida autenticada de mapas con la CLI de PostHog.

El informe del asistente describe su resultado original. Esta documentación
incluye los ajustes posteriores: captura del servidor, envío diferido,
minimización de identidad y corrección de la política de instalación de core-js.
