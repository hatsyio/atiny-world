# Suspensión y reactivación de cuentas

Entrega incremental de US5 en `feat/admin-account-suspension`, después de los merges de roles (#76), moderación (#77) y configuración (#78). Requisitos: FR-044, FR-053–056; T079, T083 y controles de T087. La explicación de suspensión adelanta parte de T101 sin completar el ciclo de eliminación de cuenta de US6.

## Recorrido y permisos

`Administración → Usuarios` ofrece suspensión y reactivación de fans a administradores activos; solo el propietario puede actuar sobre otras cuentas administradoras. No permite actuar sobre el propietario, sobre la propia cuenta, perfiles incompletos ni cuentas pendientes de borrado. La interfaz pide confirmación identificando la cuenta y explicando el efecto sobre las cartas.

Suspender exige uno de los motivos bilingües existentes y admite una nota interna de hasta 1000 caracteres. La cuenta suspendida ve el motivo traducido en un aviso compartido, con acceso a consultar o borrar sus cartas. La nota interna no se envía a esa cuenta. Los códigos antiguos desconocidos muestran una explicación genérica, nunca el código privado.

Las cartas quedan ocultas sin cambiar su contenido, estado, ubicación, fecha o versión. Publicar y editar queda bloqueado por los controles existentes del servidor; leer y borrar cartas propias sigue permitido. Reactivar limpia el estado, motivo, nota y actor vigentes, conservando la auditoría. La visibilidad se recalcula según la configuración: las rechazadas/retiradas siguen ocultas y las pendientes aparecen solo si la moderación previa está desactivada.

## Transacción y recuperación

La identidad procede de la sesión. Se bloquean actor y destinatario por ID en orden estable y se revalidan permisos dentro de la transacción. `expectedRoleVersion` y `expectedSuspensionVersion` rechazan decisiones sobre datos antiguos, incluidos ciclos de suspensión/reactivación que vuelven al estado anterior. La versión de suspensión la mantiene un trigger; el cliente no puede reescribirla.

La fila de configuración se bloquea en modo compartido antes de cambiar visibilidad, sincronizando la operación con el cálculo de impacto de moderación previa. Estado de cuenta, `moderation_actions` y `admin_audit` se escriben atómicamente. La auditoría general conserva únicamente motivo y metadatos de estado/versión; la nota está en los registros privados específicos. Un fallo de auditoría revierte todo. Solicitar el estado ya vigente con versiones actuales no crea una segunda decisión.

Tras éxito se revalida el layout raíz y se recarga el panel. Conflictos y denegaciones deshabilitan el formulario antiguo; el conflicto ofrece recargar sin reintentos automáticos. Una nueva versión o estado reinicia la confirmación.

## Migraciones y reversión

- `20261006130000_message_moderation.sql`: faltaba en remoto; aplicada al proyecto enlazado `atiny-world` mediante `supabase db push --linked --skip-vault --yes`, tras simulación que mostró solo esa migración.
- `20261006140000_profile_suspension_version.sql`: expansión aditiva con columna y trigger. Creada con el CLI y ordenada después de moderación. Aplicada a pruebas locales bajo el advisory lock de las suites y al proyecto remoto mediante el mismo flujo, tras simulación.
- Compose local (`54332`): faltaban ambas migraciones; aplicadas con `docker compose --profile local run --rm --no-deps migrate`, conservando los datos y registrando cada fichero en `app_migrations.applied`.
- Comprobados historial remoto, tabla de decisiones, trigger y permisos: runtime puede insertar decisiones pero no modificarlas; preview no puede leerlas. Supabase no devuelve avisos de seguridad.

El esquema es compatible con el código anterior. Si hay que revertir la aplicación, se puede volver al código previo conservando columna y trigger. No borrar auditorías ni levantar suspensiones en masa como rollback: cambiar el estado de una cuenta requiere una decisión explícita. En la base de pruebas se aplicó únicamente el SQL nuevo, sin reset ni reparación del historial antiguo; un entorno nuevo usa todas las migraciones en orden.

## Verificación del 6 de octubre de 2026

- BDD: 51 escenarios y 416 pasos correctos, incluidos cinco escenarios de suspensión/reactivación.
- Unitarias: 512 pruebas correctas; permisos puros, validación, acción de sesión, confirmación, conflictos, controles según rol y aviso bilingüe.
- Integración: 121 pruebas correctas; 12 de suspensión, permisos runtime, ciclos ABA, concurrencia, revocación en curso, sincronización con settings, rollback y visibilidad.
- Contratos: 51 pruebas correctas.
- Cobertura conjunta: 633 pruebas; líneas 89,78 %, ramas 81,80 %, funciones 87,27 %, sentencias 86,66 %.
- Typecheck, lint, build Next.js y `docker compose --profile local --profile pro build`: correctos.
- Revisión independiente: sin hallazgos; añadida cobertura específica de concurrencia con configuración.

Pendientes de entregas futuras: solicitudes/evidencia de revisión, visor de auditoría, eliminación coordinada de cuentas y contacto real del proyecto antes de lanzamiento. US5 y US6 no se marcan completas. No se ha desplegado la aplicación ni ejecutado ninguna suspensión sobre cuentas reales para probarla.
