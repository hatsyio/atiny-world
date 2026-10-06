# Moderación de cartas

Entrega de US5 posterior al merge de usuarios y roles (#76), en la rama `feat/admin-message-moderation`.

## Recorrido

`Administración → Moderación de mensajes` abre `/admin/messages`, inicialmente filtrada por pendientes. Permite buscar por contenido, nombre de autora o identificador de carta, filtrar los cuatro estados o todos y recorrer páginas de 25 resultados. La búsqueda trata `%` y `_` como texto literal.

Cada carta muestra texto de solo lectura, autora, estado de cuenta, estado de moderación, versión, ubicación pública, fecha de publicación UTC y visibilidad actual. Motivos y notas se mantienen privados para autora y administración. No se envían credenciales de Clerk ni IDs internos al navegador.

- Aprobar: solo pendientes; pasa a aprobado.
- Rechazar: solo pendientes; exige motivo predefinido y pasa a rechazado.
- Retirar: solo cartas actualmente públicas; exige motivo y pasa a retirado. Incluye pendientes con moderación previa desactivada; cuentas suspendidas y pendientes ocultos no se consideran públicos.
- Motivos disponibles: contenido no deseado, acoso/mala conducta, datos personales/información privada e incumplimiento de normas de la comunidad. Etiquetas en español e inglés, también en «Mis mensajes».
- Nota opcional: hasta 1000 caracteres, compartida privadamente con la autora.

## Garantías

La identidad del actor procede de la sesión. La transacción vuelve a comprobar que sea `admin` u `owner`, activo, sin suspensión y con perfil completo. Mantiene bloqueados los perfiles en orden por ID, la configuración de visibilidad y el mensaje hasta el commit. Autorizar la página no sustituye esta comprobación.

Cada decisión exige la versión revisada e incrementa la versión resultante. Un cambio de contenido u otra decisión rechaza el formulario antiguo sin efecto parcial. Un cambio de visibilidad puede invalidar una retirada; «Recargar cartas» obtiene las decisiones vigentes y reinicia el formulario incluso cuando la versión no cambió. No hay reintentos automáticos de decisiones obsoletas.

El cambio de estado, `moderation_actions` y `admin_audit` se escriben en una transacción. El registro de decisión conserva actor, identificador y versión revisada, acción, motivo y nota privada. La auditoría general conserva solamente estados y versiones en metadata, sin contenido ni notas. Los registros sobreviven al borrado de carta/perfiles mediante referencias nullable; runtime solo puede leer e insertar, nunca modificar ni borrar el historial.

Contenido, punto público y fecha/orden de publicación permanecen intactos. Al completar la acción se revalidan inicio, listado y detalle público, «Mis mensajes» y cola administrativa. Las consultas públicas y API del mapa siguen usando la visibilidad canónica y respuestas sin caché; la carta oculta deja de aparecer en mapa, últimas cartas y enlaces públicos. El aviso de éxito permanece cuando la carta sale de la cola filtrada.

## Migración y estado operativo

Nueva migración: `supabase/migrations/20261006130000_message_moderation.sql`. Crea `moderation_actions` y sus índices de FK y permisos mínimos; reutiliza `admin_audit` y el índice de cola de mensajes existentes. El timestamp queda después de las dos migraciones de roles del mismo día.

Aplicada únicamente a la base aislada de pruebas local (`127.0.0.1:54322`). Esa base ya tenía las tablas de roles sin registro de sus migraciones: el CLI intentó recrear `admin_audit` y se detuvo. Se aplicó solo el SQL nuevo con el mismo advisory lock de las suites, sin reset ni modificación del historial anterior. Para un entorno nuevo, las migraciones deben aplicarse en orden; para bases existentes, comprobar primero su historial y evitar recrear objetos ya presentes.

La base local de uso real de Compose (`54332`) y la base remota no se han modificado. Antes de desplegar esta rama, aplicar la migración por el sistema de migraciones de cada entorno. Sin esa tabla, las consultas de la cola funcionan, pero guardar una decisión falla y devuelve un error seguro, con rollback completo.

## Verificación del 6 de octubre de 2026

- BDD: 45 escenarios y 361 pasos correctos; ocho escenarios nuevos de moderación.
- Unitarias: 465 pruebas correctas.
- Integración: 97 pruebas correctas, incluidas 17 nuevas de moderación, atomicidad, concurrencia, visibilidad y permisos reales de runtime.
- Contrato: 51 pruebas correctas.
- Cobertura conjunta: 562 pruebas; líneas 89,26 %, ramas 80,59 %, funciones 86,76 % y sentencias 86,15 %, por encima de los umbrales del proyecto.
- TypeScript, ESLint y build de Next.js correctos; ruta `/admin/messages` incluida en el build.
- Vista previa estática del componente real con CSS del proyecto en Chromium: sin desbordamiento a 320, 390 y 1280 px, español e inglés; controles de al menos 44 px. Esta comprobación de layout no sustituye un recorrido autenticado completo en Safari/iOS y Chrome/Android.
- Revisión independiente: un hallazgo de recuperación del formulario tras cambios de visibilidad, corregido y cubierto con prueba.

Configuración, suspensión, solicitudes/evidencias de revisión y visor de auditoría siguen pendientes. US5 no se marca completa. No se ha publicado la rama ni desplegado esta entrega.
