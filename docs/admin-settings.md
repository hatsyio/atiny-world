# Configuración administrativa

`/admin/settings` permite a una cuenta administradora activa cambiar la moderación previa, el máximo de cartas por cuenta y el intervalo entre nuevas publicaciones.

Antes de cambiar la moderación previa, el panel indica cuántas cartas pendientes de cuentas activas aparecerán u ocultarán. La administradora debe confirmar el efecto. El formulario incluye la versión de configuración y el número esperado de cartas afectadas. Si otra administradora cambia la configuración o cambia el número de pendientes, la transacción rechaza la acción y el panel pide recargar.

El backend toma la identidad de la sesión y, dentro de la transacción, vuelve a comprobar que la cuenta tenga rol `admin` u `owner`, esté activa, no esté suspendida y tenga perfil completo. Exige confirmación explícita cuando cambia la moderación previa. Bloquea la fila de configuración, valida un límite positivo y un intervalo no negativo, recalcula el impacto y actualiza la versión.

La actualización y el registro `admin_audit` se guardan en una sola transacción. La auditoría conserva únicamente los valores operativos anteriores y nuevos, versiones e impacto. No conserva texto, notas ni ubicaciones. El cambio de configuración no reescribe ninguna carta; las lecturas públicas usan la regla de visibilidad canónica y reflejan el ajuste en sus nuevas consultas.

## Migración y estado operativo

La tabla `app_private.settings` existe desde `20260915000100_create_app_private_core.sql`; esta entrega no añade migraciones. Antes de desplegarla, comprobar y aplicar por el flujo habitual la migración de moderación `20261006130000_message_moderation.sql` si todavía falta en producción. No se modificó la base de Compose ni la remota durante esta entrega.

## Verificación

Las pruebas BDD, de integración y de componentes cubren el impacto de pendientes activas, la exclusión de cuentas suspendidas, confirmación de interfaz, autorización, valores inválidos, conflictos de versión o impacto, concurrencia, rollback de auditoría y ausencia de reescrituras de cartas.
