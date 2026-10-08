# Sincronización de idioma e identidad analítica (#102)

## Revalidación y decisión

Revisado el 8 de octubre de 2026 sobre `45eb9c5`, después de #97 y #101.
`recoverProfile` ya devuelve el perfil y su preferencia. La sincronización seguía
leyendo esa preferencia una segunda vez incluso cuando ya estaba definida.

`AnalyticsIdentity`, montado bajo Clerk en el layout raíz, gestiona exclusivamente
`identify` y `reset` de PostHog. La sincronización de idioma conserva su efecto y
la cancelación de respuestas que dejan de corresponder al estado actual.

Se conserva `pathname`. Quitar la navegación eliminaría un reintento del registro
incompleto y la oportunidad de observar una preferencia guardada desde otra
pestaña cuando el layout raíz persiste. No se añade un canal de eventos ni polling.
Los cambios entre pestañas se observan en la siguiente navegación/sincronización,
no inmediatamente mientras una pestaña permanece inactiva.

## Medición reproducible

Las cifras corresponden a pruebas locales controladas, no a coste o latencia en
producción. Las llamadas del cliente se cuentan en el límite de la server action;
las consultas SQL de la acción se cuentan con PostgreSQL real. No incluyen las
lecturas del render del servidor ni el tráfico interno de Clerk/PostHog.

| Caso | Antes | Después |
| --- | --- | --- |
| Perfil existente con preferencia definida: consultas SQL por sincronización | 2 | 1 |
| Auth pendiente: llamadas a la acción | 0 | 0 |
| Auth cargada: llamada inicial | 1 | 1 |
| Rerender sin cambiar dependencias: llamadas adicionales | 0 | 0 |
| Login, cambio de cuenta o logout: llamadas por transición | 1 | 1 |
| Cambio de ruta: llamadas adicionales | 1 | 1 |
| Cambio de preferencia: llamadas adicionales | 1 | 1 |
| Respuesta con otro idioma y aplicación de locale/preferencia tras refresh | 2 | 2 |

La última fila incluye la sincronización que detecta la diferencia y la que
confirma el estado del proveedor actualizado; la segunda no vuelve a refrescar.
Se mantienen `locale` y `preference` porque forman parte de la comparación con el
estado renderizado; `isLoaded`/`userId` cubren sesión y logout.

La lectura posterior sigue siendo necesaria cuando el perfil tiene la preferencia
aún sin definir: la adopción condicional puede perder frente a una elección
explícita concurrente y hay que devolver esa elección. Un alta incompleta conserva
su cookie vinculada al propietario y no hace esa lectura posterior.

## Comprobaciones

- `tests/unit/i18n/language-synchronizer.test.tsx`: contadores anteriores, reintento
  en navegación, cambio desde otra pestaña, conservación del estado del borrador
  durante el cambio de contexto y descarte de respuestas de una cuenta anterior.
- `tests/unit/components/analytics-identity.test.tsx`: identificación una vez por
  cuenta, reset antes del cambio de cuenta y al salir.
- `tests/unit/i18n/language-actions.test.ts`: preferencias `es`, `en`, `auto`,
  cookies de visitante/cuenta, alta incompleta y fallos técnicos.
- `tests/integration/language-profile-recovery.test.ts`: consulta habitual única,
  recuperación real y elección concurrente desde otra conexión PostgreSQL.
- La prueba existente `tests/unit/components/messages/live-locale.test.tsx`
  comprueba también el borrador del formulario real al cambiar de idioma.

La conservación de borradores y la interacción entre pestañas se verifican a
través de componentes/acciones en pruebas, sin una sesión manual de navegador
con dos pestañas autenticadas.
