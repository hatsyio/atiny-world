# Postgres.js y Supavisor: investigación del pool de conexiones

Fecha: 9 de octubre de 2026. Alcance: documentación oficial, código y reportes originales; sin cambios de producción ni escrituras en la base de datos.

## Conclusión

La incompatibilidad entre el pipeline de Postgres.js y el pool compartido de Supavisor en modo transacción está documentada oficialmente. Supabase advierte que puede provocar consultas pendientes y respuestas asignadas a otra consulta. También indica que Postgres.js no tiene una opción funcional para desactivar el pipeline conservando `sql.begin()`: `max_pipeline: 0` rompe las transacciones. Esto explica por qué `prepare: false` no resuelve por sí solo nuestra situación. [Guía oficial Postgres.js](https://supabase.com/docs/guides/database/postgres-js).

La coincidencia con nuestra reproducción es fuerte, pero no equivale a una captura del protocolo de nuestro proyecto. No se ha capturado el protocolo del endpoint, pero la comparación y la validación del adaptador real descritas al final confirman una alternativa funcional con `pg`.

## Evidencia y estado de las correcciones

| Fuente primaria | Hallazgo | Estado consultado |
|---|---|---|
| [Postgres.js #970](https://github.com/porsager/postgres/issues/970) | Reporte original desde octubre de 2024: consultas quedan pendientes con Supavisor transacción y `prepare: false`. | Abierto. |
| [Reproducción Postgres.js 3.4.9](https://github.com/porsager/postgres/issues/970#issuecomment-5099587361) | Seis consultas triviales concurrentes; `max_pipeline: 1` sigue fallando, `0` permite completar las lecturas pero rompe transacciones. | Resultado del autor del reporte, no verificado aquí. |
| [Reproducción de septiembre](https://github.com/porsager/postgres/issues/970#issuecomment-5744912699) | Con una respuesta grande, el autor mide 0/10 tandas completas con pipeline predeterminado frente a 10/10 con `0`. Usa un parche adicional para transacciones. | Evidencia independiente, no garantía para nuestra aplicación. |
| [Supavisor #1061](https://github.com/supabase/supavisor/issues/1061) | Reproducción concurrente con Postgres.js: el pool libera el backend antes de recibir todas las respuestas. | Cerrado por #1079. |
| [Supavisor PR #1079](https://github.com/supabase/supavisor/pull/1079) | Cuenta respuestas `ReadyForQuery` esperadas antes de devolver la conexión. | Integrado el 15 de julio de 2026; mantenedor lo sitúa en la futura versión 2.10. |
| [Supavisor PR #1176](https://github.com/supabase/supavisor/pull/1176) | Corrige otro camino que evita ese conteo cuando un paquete TCP empieza por `Sync`. | Integrado el 8 de septiembre de 2026. |
| [Postgres.js #1189](https://github.com/porsager/postgres/issues/1189) | `BEGIN` puede enviarse sin reservar la conexión; el corte del pipeline omite `onexecute`. Reproducción en 3.4.9 con `max_pipeline: 1`. | Abierto. |
| [Postgres.js PR #1211](https://github.com/porsager/postgres/pull/1211) y [PR #1218](https://github.com/porsager/postgres/pull/1218) | Separan la reserva de la transacción del límite de pipeline. | Abiertos y sin integrar en la consulta realizada. |

Las últimas releases públicas consultadas son [Supavisor 2.9.13](https://github.com/supabase/supavisor/releases/tag/v2.9.13), publicada el 10 de septiembre de 2026, y [Postgres.js 3.4.9](https://github.com/porsager/postgres/releases/tag/v3.4.9). Los commits de #1079 y #1176 no son ancestros del tag 2.9.13 según la API de comparación de GitHub. Eso no demuestra ausencia de un backport equivalente ni identifica la versión gestionada que sirve nuestro proyecto. No se debe dar por hecho que un PR integrado ya está desplegado en el pool compartido. [Comparación #1079](https://github.com/supabase/supavisor/compare/d366ef0056393692e669d4883e47abe0723d8435...v2.9.13), [comparación #1176](https://github.com/supabase/supavisor/compare/b2ec0e40547630643407082e283cb1f52c4ad9b1...v2.9.13).

## Relación con nuestra reproducción

Las pruebas anteriores comunicadas en la conversación completan 6/6 lecturas en sesión 5432, pero dejan 3/6 pendientes en transacción 6543. Limitar `max_pipeline` a uno, desactivar `fetch_types` y precalentar la conexión no solucionaron el problema. Esta investigación no repite esas pruebas remotas.

El código instalado confirma el pipeline predeterminado de 100 y el orden de condiciones que puede omitir `onexecute`. También hace `describeFirst` cuando existen parámetros y no hay statement preparado: esto introduce una espera adicional, de modo que una prueba únicamente parametrizada puede ocultar el problema de consultas sin parámetros. `unsafe()` sin argumentos usa protocolo simple por defecto. Son observaciones del código, no una demostración de la causa exacta en nuestro proyecto. [Código 3.4.9 de conexión](https://github.com/porsager/postgres/blob/v3.4.9/src/connection.js), [cliente 3.4.9](https://github.com/porsager/postgres/blob/v3.4.9/src/index.js).

## Opciones que merece la pena probar

1. **Comparar `pg` en 6543 con `pipeline: false`**, mismas consultas, concurrencia, credenciales y contexto. Es la ruta estándar más clara que evaluar: su pool documenta pipeline desactivado por defecto y Vercel admite `pg` explícitamente en `attachDatabasePool`. Las transacciones deben usar un mismo cliente reservado y liberarlo en `finally`. Sigue siendo una hipótesis hasta superar nuestra prueba y Preview. [API de pg.Pool](https://node-postgres.com/apis/pool), [transacciones pg](https://node-postgres.com/features/transactions), [API Vercel](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool).

2. **Conservar Postgres.js con serialización explícita**, validada a nivel de cliente completo, incluidos fragmentos, transacciones y llamadas simultáneas de distintas peticiones. Una cola en un único `Promise.all` no basta si otros consumidores siguen compartiendo la conexión. Evitar pipeline mediante un parche tiene reportes favorables, pero obliga a mantener código de dependencia y validar ESM/CJS; no es un workaround oficial integrado. [Discusión de parche](https://github.com/porsager/postgres/issues/970#issuecomment-4980040901), [PR #1211](https://github.com/porsager/postgres/pull/1211).

3. **Evaluar un pool dedicado compatible**, si su disponibilidad y comportamiento real lo justifican. Cambiar de endpoint no elimina la necesidad de probar el protocolo y las restricciones del modo transacción. [Conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

El análisis local del agente principal encuentra 24 archivos que importan Postgres.js y 11 usos de `sql.begin` en `src/server`, además de consultas con tags y fragmentos. Por tanto, migrar a `pg` exige adaptar APIs: no basta cambiar el import. La comparación independiente debe preceder al refactor.

## Próxima validación

Usar una reproducción aislada de lectura que mezcle consultas sin parámetros, parametrizadas, tipos distinguibles y respuestas de distintos tamaños. Repetir rondas con cliente frío y caliente y más consultas concurrentes que conexiones. Comprobar identidad y contenido de cada resultado además de que termine: contar promesas resueltas no detecta respuestas cruzadas. Incluir transacciones de lectura y verificar reserva y liberación; las pruebas de escritura/rollback se reservan a una base de pruebas autorizada.

Si `pg` supera esa comparación, preparar el alcance de migración y validar en Preview. Si se conserva Postgres.js, demostrar que ninguna ruta permite pipeline y que `sql.begin()` mantiene aislamiento. Para aclarar la ruta de conservar el driver, preparar un informe reproducible para soporte Supabase sobre el endpoint y la disponibilidad de las correcciones; no se ha enviado ningún mensaje externo.

## Ensayo ejecutado con pg el 9 de octubre

Se instaló `pg@8.23.1` en un directorio temporal independiente; no se modificaron `package.json`, el lockfile de la aplicación ni variables remotas. Node.js: 24.16.0. La conexión se obtuvo de `.env.pro`, con el usuario de aplicación, mismo host y `search_path=extensions,public`. No se imprimieron credenciales. Se cambió el puerto únicamente en memoria dentro del diagnóstico. La reproducción está en [pg-pool-reproduction.mjs](./pg-pool-reproduction.mjs).

| Endpoint | Conexiones máximas del cliente | Rondas de 18 operaciones concurrentes | Resultado | Duración por ronda |
|---|---:|---:|---|---|
| Sesión, 5432 | 1 | 3 | 54/54 correctas | 1.073–1.231 s |
| Transacción, 6543 | 1 | 5 | 90/90 correctas | 1.043–1.277 s |
| Transacción, 6543 | 3 | 5 | 90/90 correctas | 0.353–0.616 s |

Cada ronda mezcla SELECT sin parámetros, SELECT parametrizados (algunos con respuestas de 8 KiB) y transacciones `BEGIN READ ONLY` con dos consultas. Cada respuesta debe conservar su marcador único y payload esperado. Las transacciones verifican el mismo PID de backend para ambas consultas; unas terminan con COMMIT y otras provocan un error de división por cero y hacen ROLLBACK. Se comprobaron también resolución de funciones PostGIS (SRID 4326), acceso al registro de settings usado por salud, cierre de clientes del pool tras inactividad y nueva consulta después del cierre. Los tres procesos finalizaron con código 0 y ninguna discrepancia de resultados.

El ajuste de startup `default_transaction_read_only=on` no produjo el estado esperado en una comprobación inicial; se retiró del ensayo para conservar la configuración de conexión de la aplicación. Las transacciones verifican `transaction_read_only=on` mediante `BEGIN READ ONLY`. El resto de consultas del script son exclusivamente SELECT controlados. No hubo operaciones de escritura de datos ni cambios persistentes de configuración.

Para repetir, instalar la dependencia aislada en un directorio temporal:

```sh
mkdir /tmp/atiny-pg-diagnostic
pnpm --dir /tmp/atiny-pg-diagnostic add --save-exact --ignore-scripts pg@8.23.1
node docs/research/pg-pool-reproduction.mjs --pg-dir /tmp/atiny-pg-diagnostic --port 6543 --max 1 --rounds 5
node docs/research/pg-pool-reproduction.mjs --pg-dir /tmp/atiny-pg-diagnostic --port 6543 --max 3 --rounds 5
```

El script no activa pipeline ni usa statements con nombre. Su SSL reproduce la semántica del cliente actual `ssl: 'require'`, sin verificar el certificado del servidor; la configuración TLS definitiva debe revisarse separadamente. Las duraciones son observaciones de un ensayo acotado desde el equipo local, no un benchmark de producción.

**Decisión respaldada por el ensayo:** `pg` sin pipeline funciona con nuestro endpoint de Supavisor transaccional para la mezcla probada. Es una base concreta para preparar la migración del acceso a datos. Todavía no se han comprobado login ni flujos de escritura, suspensión de Vercel con `attachDatabasePool`, carga sostenida o despliegues Preview/Production. El incidente de producción sigue sin considerarse resuelto.

## Comparación con la misma batería y el cliente actual

A petición del usuario se unificó la reproducción: un único conjunto de SQL, marcadores, payloads y validaciones sirve a ambos drivers. Postgres.js usa `unsafe` para SQL sin parámetros/parametrizado y su API nativa `sql.begin('read only', ...)`; `pg` usa `query` y un cliente reservado para BEGIN/COMMIT/ROLLBACK. Las transacciones propagan el error SQL esperado para comprobar el rollback nativo de cada implementación. El tamaño del pool se fijó en uno y el timeout de inactividad en 20 segundos para ambos, igual al runtime actual. La ronda tiene un límite externo de 10 segundos: un fallo indica operaciones pendientes al vencer ese límite, no un timeout emitido por Supabase.

Resultados de la misma batería, cinco rondas previstas de 18 operaciones:

| Driver | Puerto | Resultado concurrente | Cierre y reconexión |
|---|---|---|---|
| Postgres.js 3.4.9 | 5432 (actual) | 90/90 correctas | Verificados tras 21.5 s de espera |
| Postgres.js 3.4.9 | 6543 | Primera ejecución: 7/18 correctas; 11 pendientes a los 10 s | No alcanzado; cliente cerrado al abortar |
| Postgres.js 3.4.9 | 6543 | Segunda ejecución independiente: 9/18 correctas; 9 pendientes a los 10 s | No alcanzado; cliente cerrado al abortar |
| pg 8.23.1, pipeline desactivado | 6543 | 90/90 correctas | Verificados tras 21.5 s de espera |
| pg 8.23.1, pipeline desactivado | 5432 | 90/90 correctas | Verificados tras 21.5 s de espera |

Los procesos Postgres.js/6543 terminaron con código 1 y `ROUND_DEADLINE`; los procesos satisfactorios terminaron con código 0. Las operaciones completadas pasaron las comprobaciones de contenido y tipos: no se observaron resultados cruzados en ellas. Una respuesta pendiente no permite inferir su contenido.

Comandos desde la raíz del repositorio, usando el directorio temporal de pg descrito arriba:

```sh
node docs/research/pg-pool-reproduction.mjs --driver postgres --port 5432 --max 1 --rounds 5
node docs/research/pg-pool-reproduction.mjs --driver postgres --port 6543 --max 1 --rounds 5
node docs/research/pg-pool-reproduction.mjs --driver pg --pg-dir /tmp/atiny-pg-diagnostic --port 6543 --max 1 --rounds 5
```

La comparación demuestra la diferencia de compatibilidad en el endpoint probado al pasar a modo transacción. El cliente vigente en modo sesión **pasa** esta batería; su agotamiento global de conexiones entre instancias no se reproduce con un único pool. Validar ese límite requiere una prueba diferente y acotada en un entorno de pruebas. No se ha cambiado producción ni se han escrito datos remotos.


## Validación del fix de runtime

El adaptador de la aplicación ahora usa `pg` con SQL parametrizado y fragmentos
compuestos mediante `sql-template-tag`. `sql.begin()` reserva un cliente hasta
COMMIT/ROLLBACK y lo descarta si falla el rollback. El singleton de Vercel se
registra en `attachDatabasePool`; mantiene max=1 e inactividad de 20 segundos.
La URL y su puerto se conservan; el cambio a 6543 se configura explícitamente
al desplegar, sin fallback automático. Las migraciones no cambian.

Se ejecutó el adaptador real con este diagnóstico de solo lectura:

```sh
pnpm exec tsx tests/diagnostics/runtime-pool.ts --env-file .env.pro --port 6543
```

Resultado: **90/90 operaciones completadas**, incluyendo fragmentos anidados,
parámetros con payload de 8 KiB, consultas PostGIS, afinidad de backend en
transacciones de solo lectura y errores SQL que exigen rollback. Después de
21.5 segundos el pool tenía cero conexiones y volvió a consultar correctamente.
El proceso terminó con código 0. No hubo escrituras remotas.

También pasaron 687 pruebas unitarias, 140 de integración, 51 escenarios BDD y
56 pruebas de contrato, usando el nuevo adaptador en la base local. Lint,
typecheck y build pasaron. La prueba remota no demuestra la desaparición del
límite global entre instancias ni el ciclo de suspensión real de Vercel: estos
se observan en Preview tras configurar su `DATABASE_URL` a 6543.
