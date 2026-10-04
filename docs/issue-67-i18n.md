# Issue 67: verificación y despliegue

Implementación de https://github.com/hatsyio/atiny-world/issues/67.

## Comportamiento

next-intl resuelve `en`/`es` por petición: perfil explícito → cookie explícita
→ Accept-Language → inglés. Perfil `auto` ignora elecciones explícitas del
dispositivo. La cookie anónima y la de cuenta son independientes; la de cuenta
está vinculada a la identidad actual. Login desde visitante adopta su elección
si el perfil no tiene preferencia; logout restaura la anterior del visitante;
un cambio directo de cuenta usa el nuevo perfil o el navegador, sin heredar
la anterior. La adopción condicional no pisa una elección concurrente.

El selector del encabezado y `/settings` ofrecen Automático, Español e Inglés.
Refrescar la petición conserva ruta, recurso, query/hash, borrador, ubicación
y estado de Leaflet. Las cartas no se traducen ni se reescriben. Fechas de
publicación en UTC; textos, errores, números, plurales, `html lang`, metadatos
y Clerk siguen el locale activo.

`/en/...` y `/es/...` redirigen con 307 al recurso sin prefijo conservando query;
el navegador conserva el fragmento cuando Location no lo reemplaza. El
prefijo histórico no modifica preferencias. Next.js puede normalizar primero
una barra final con su 308 habitual, independiente del idioma. Destinos
anidados de retorno se validan y normalizan. No se crean hreflang para cartas
que sólo cambian la interfaz del lector.

## Evidencia local (2026-10-04)

Base aislada: `atiny_i18n67_test`, creada para estas pruebas; todas las
migraciones aplicadas desde cero. El checkout original permanece intacto.

| Comprobación | Resultado |
| --- | --- |
| `pnpm test` | 365 pruebas unitarias; 37 escenarios BDD y 290 pasos |
| `pnpm test:coverage` | 431 pruebas, 61 archivos (unidad + 66 integración) |
| `pnpm test:contract` | 43 pruebas de contratos |
| Cobertura | líneas 87,28%; sentencias 84,01%; ramas 76,79%; funciones 85,75% |
| `pnpm lint` | sin errores ni advertencias |
| `pnpm typecheck` | correcto |
| `pnpm build` | correcto con entorno equivalente a CI, sin credenciales externas |
| HTTP de build con Clerk Development | primer HTML español para es-MX; fallback inglés para ko/fr; cookie manual vence navegador; detalle y auth localizados; legado 307 y `/settings` conserva destino |
| Revisión independiente | aprobada; ajustes de zoom/marker/decimales de mapa preciso revisados y verificados |

Regresiones incluyen catálogos equivalentes, negociación regional/prioridades,
Automático y persistencia/cambio de cuenta, HTML SSR e hidratación sin errores,
retornos seguros y contenido coreano/emojis compuestos/saltos de línea idéntico
en PostgreSQL y componentes. El selector, formularios y mapa mantienen su
estado al cambiar el proveedor real de next-intl; el mapa preciso conserva
instancia, marcador, punto confirmado y búsqueda sin fetch adicional.

Esta evidencia no sustituye la matriz de dispositivos móviles del release ni
una sesión real de Clerk entre dispositivos distintos.

## Orden de despliegue

1. Aplicar `supabase/migrations/20261004202808_language_preference.sql` al
   entorno destino antes de desplegar el código que lee esa columna.
2. Desplegar y verificar la preview; publicar según el flujo del repositorio.
3. Si se usa dominio propio, configurar `SITE_URL` como origen del canonical;
   en Vercel se usa `VERCEL_PROJECT_PRODUCTION_URL` como fallback, en local
   `http://localhost:3000`.

La columna es nullable y aditiva. El código anterior sigue siendo compatible;
un rollback de aplicación conserva la columna y las preferencias guardadas.
No se ha aplicado esta migración a producción en esta tarea.
