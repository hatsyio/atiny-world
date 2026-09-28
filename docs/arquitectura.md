# ATINY World — Arquitectura de la primera versión

Fecha: 2026-09-13.
Base de producto: [requisitos validados](./requisitos.md).
Estado: base tecnológica ejecutable, modelo principal de datos, permisos y
estrategia de entornos y migraciones confirmados por el propietario. Clerk y el
proyecto remoto de Supabase están provisionados; los flujos funcionales, el
esquema de aplicación y las credenciales restringidas de previews siguen
pendientes.

Decisiones confirmadas durante la revisión: Clerk como proveedor de autenticación, Supabase como proveedor de PostgreSQL y Next.js con App Router y TypeScript para frontend y backend en un mismo proyecto y despliegue en Vercel. Se elige Supabase por su encaje funcional y por la experiencia previa del propietario. Si surge una necesidad concreta, se podrá separar el backend en el futuro. Leaflet queda confirmado como biblioteca del mapa y CARTO como proveedor del mapa base. Geoapify queda confirmado como proveedor inicial de geocodificación en su plan gratuito. Europa queda confirmada para el backend y la base de datos, procurando elegir la misma región o las ubicaciones disponibles más próximas. La ubicación exacta se comprobará al provisionar los servicios. Los demás detalles operativos siguen pendientes de confirmación.

## Base confirmada y detalles pendientes

Se acuerda una aplicación Next.js con App Router y TypeScript, con frontend y backend desplegados juntos en Vercel, PostgreSQL en Supabase y autenticación gestionada por Clerk. La lógica de permisos y producto pertenece a la aplicación; Clerk solo gestiona identidad, credenciales, verificación, recuperación y acceso con Google. La elección de Supabase no implica utilizar Supabase Auth.

Las rutas y acciones de Next.js serán adaptadores delgados hacia los módulos de servidor. Las reglas de dominio no dependerán de componentes React ni de peticiones de Next.js. Esto facilita una futura separación del backend sin introducir ahora un segundo despliegue; esa extracción requerirá trabajo de integración y no se considera automática.

Acceso a datos confirmado: el navegador no consultará ni modificará directamente los datos de Supabase. Tanto las lecturas públicas como las operaciones autenticadas pasarán por el backend de la aplicación, que centralizará permisos, visibilidad, moderación y límites. Las credenciales de base de datos permanecerán exclusivamente en el servidor. Esta decisión no impide el flujo de autenticación del navegador con Clerk ni las peticiones de cartografía al proveedor que se acuerde.

Se comienza con Clerk Hobby y Supabase Free, sin activar planes de pago. Clerk
está conectado al proyecto Vercel y sus variables de desarrollo se mantienen
fuera de Git. Supabase está provisionado en París (`eu-west-3`), vinculado a la
CLI y verificado con PostgreSQL 17.6. La región efectiva del backend de Vercel y
su proximidad con la base de datos se validarán antes del lanzamiento.

Alternativas consideradas:

- Sites: la guía disponible se centra en identidad de ChatGPT y no proporciona una ruta confirmada para las cuentas públicas con Google y contraseña requeridas. No se cambia el requisito de acceso para ajustarlo a esa plantilla.
- Neon: cubre las necesidades de PostgreSQL, pero no aporta una ventaja decisiva para este alcance frente a la familiaridad del propietario con Supabase. Se descarta de la propuesta activa y no se completará su alta.

Se usará el runtime Node.js. No se necesitan microservicios, WebSockets, almacenamiento de archivos ni Redis para el alcance inicial.

## Entornos y migraciones confirmados

- Un único proyecto remoto de Supabase, destinado a producción, dado que el propietario dispone de un solo hueco gratuito.
- Desarrollo habitual y pruebas destructivas con Supabase local y datos de prueba.
- Previews de Vercel conectadas a la base remota con credenciales propias de solo lectura por defecto. Esta restricción debe imponerse en los permisos de base de datos, no solo ocultando controles en la interfaz.
- La capacidad de lectura no implica acceso a todas las tablas: las previews no deben recibir acceso indiscriminado a solicitudes de revisión privadas u otros datos sensibles. Los permisos y la visibilidad de aplicación siguen aplicándose.
- Habilitar escrituras únicamente para previews concretas, revisadas y autorizadas caso por caso, reconociendo que sus operaciones afectan a producción. No reutilizar indiscriminadamente credenciales de escritura en todas las ramas.
- Las previews no ejecutan migraciones automáticamente.
- Migraciones versionadas y probadas localmente. Aplicación remota mediante un paso controlado e independiente de los builds de previews, con credenciales de migración separadas del acceso de la aplicación.
- Flujo de expansión y contracción: añadir cambios compatibles con la versión actual; aplicarlos a producción; desplegar y validar la preview; publicar el código nuevo; retirar estructuras antiguas en otra migración una vez que ninguna versión activa dependa de ellas y haya pasado el margen de rollback.
- Añadir columnas inicialmente opcionales cuando sea necesario para mantener compatibilidad. Renombrados, eliminaciones y nuevas restricciones obligatorias requieren transición y comprobación de los datos existentes.
- Revertir una versión de aplicación no implica deshacer automáticamente una migración ni eliminar datos. Las previews antiguas deben retirarse o actualizarse antes de contraer el esquema que utilizan.

## Límites entre módulos

- `src/domain/messages`: estados, visibilidad, validación internacional y reglas de edición.
- `src/domain/location`: desplazamiento estable y validación de coordenadas.
- `src/server/auth`: identidad verificada y resolución del perfil local.
- `src/server/db`: acceso a PostgreSQL y transacciones.
- `src/server/messages`: lectura pública, publicación, edición, eliminación y límites.
- `src/server/moderation`: solicitudes de revisión, decisiones, suspensión, configuración e historial.
- `src/components/map`: mapa, marcadores, agrupaciones, filtros y selección de ubicación.
- `src/i18n`: diccionarios inglés/español, incluidos motivos de moderación.

La UI no decide permisos. Todas las mutaciones comprueban sesión, propietario del recurso, suspensión y rol en el servidor. La lectura pública aplica la misma regla de visibilidad en el mapa, las fichas, los filtros y los enlaces compartidos.

## Modelo de datos conceptual

Modelo principal aprobado por el propietario: perfiles, mensajes, solicitudes de revisión, configuración e historial administrativo. Las credenciales y el inicio de sesión permanecen en Clerk. Se confirma un identificador estable y una versión incremental por mensaje; editar sustituye el texto y vuelve a pendiente de forma atómica. El texto anterior solo se conserva cuando forma parte de una solicitud de revisión sujeta a retención.

Permisos aprobados:

- Fan: gestiona sus mensajes y puede pedir la revisión de mensajes.
- Administrador: modera, gestiona solicitudes de revisión, suspende cuentas y cambia configuración; no edita textos ajenos.
- Propietario: tiene los permisos administrativos y asigna o retira administradores.
- Solo el propietario puede suspender a un administrador o retirarle el rol. Un administrador no puede suspender a otro administrador; esta restricción se comprueba en el backend según los roles vigentes.
- Visitante anónima: consulta exclusivamente información pública.
- Cuenta suspendida: mantiene las posibilidades de consulta, contacto y borrado acordadas, sin poder publicar, editar ni pedir revisión.

Roles y suspensiones residen en Supabase y se verifican en el backend en cada operación protegida. Ningún rol enviado por el navegador es fuente de autoridad. Las solicitudes de revisión y el historial administrativo quedan fuera de las consultas públicas del mapa.

Las entidades auxiliares de implementación siguientes concretan la persistencia de esas responsabilidades, sin añadir funciones de producto.

- `profiles`: identificador local, identidad Clerk, nombre público no único, rol, suspensión y fechas. Los nombres de usuario antiguos se conservan solo como dato histórico. No almacena contraseñas.
- `messages`: identificador público estable, autora, versión actual, texto, destinatario opcional, estado, precisión, coordenadas públicas persistidas, localidad, país y fechas.
- `review_requests`: solicitante, referencia nullable al mensaje, número de versión, copia privada del texto sujeto a revisión, motivo, estado del caso, cierre y vencimiento de conservación.
- `moderation_actions`: decisión, motivo traducible y nota opcional.
- `settings`: moderación inicialmente desactivada, límite de 10 mensajes y cooldown de 10 segundos.
- `admin_audit`: actor, acción, objeto, fecha y metadatos pertinentes, sin duplicar innecesariamente texto privado.
- `account_deletion_jobs`: seguimiento de la eliminación entre la aplicación y Clerk para poder reintentar fallos sin restaurar el acceso público.

Los identificadores públicos serán opacos. El rol de propietario se asigna mediante un procedimiento administrativo explícito, nunca al primer visitante. La identidad interna es `clerk_user_id`; el nombre público conserva la escritura original y puede repetirse.

## Mensajes, versiones y concurrencia

El identificador del mensaje es estable. Editar incrementa su versión, sustituye el texto y vuelve a pendiente dentro de la misma transacción. No se conserva un historial público de textos. Una solicitud de revisión mantiene solo su propia copia privada.

Publicar bloquea el registro de la cuenta durante la comprobación del límite y cooldown y durante la inserción. Dos solicitudes simultáneas no pueden superar los límites. El borrado de un mensaje no reinicia el instante del último envío.

Las acciones de moderación incluyen la versión revisada: un administrador no puede aprobar inadvertidamente una edición posterior. Los cambios administrativos y su auditoría se guardan atómicamente.

## Estado y visibilidad

La regla pública es:

```text
cuenta activa AND (
  estado aprobado OR
  (estado pendiente AND moderación desactivada)
)
```

Rechazados y retirados nunca son públicos. Cambiar la configuración no reescribe mensajes. No se utilizará caché pública persistente para contenido moderable en la primera versión; al modificarlo, la interfaz volverá a consultar los datos. Una respuesta ya entregada a un navegador no puede revocarse, pero las nuevas lecturas sí deben reflejar el cambio.

«Mis mensajes» utiliza un endpoint privado independiente para incluir estados ocultos. No se expone esta información mediante parámetros de la consulta pública.

## Ubicación y mapa

Separar el motor visual del proveedor de cartografía y del buscador geográfico. CARTO queda elegido para el mapa base, utilizando su opción gratuita aplicable al proyecto; el propietario trabaja en CARTO y prefiere ese proveedor. Leaflet queda confirmado para renderizado e interacción; la agrupación se resolverá con un complemento compatible. Geoapify queda confirmado para geocodificación, comenzando con el plan gratuito. El proveedor se encapsulará en el backend y se verificará su cobertura con búsquedas representativas, incluidas direcciones en coreano. Se conservarán las atribuciones requeridas para los resultados almacenados. No se activará un plan de pago sin autorización. La cuota se consumirá al buscar ubicaciones, no al leer mensajes ya guardados. Antes de integrar CARTO se comprobarán las condiciones vigentes, atribución, cuotas y clave necesarias para el servicio seleccionado.

La comparación de geocodificación prioriza cobertura internacional, búsqueda en escritura coreana, conservación permanente de las coordenadas seleccionadas y compatibilidad con el mapa base de CARTO. No se promete que ningún plan gratuito soporte cualquier volumen ni que la cobertura de direcciones sea uniforme entre países.

Para ubicaciones aproximadas, partir del centro de la localidad, no de una dirección privada. Calcular una vez el desplazamiento con el identificador del mensaje y guardar las coordenadas resultantes y la versión del algoritmo. El hash no convierte coordenadas precisas en datos anónimos: no se conservará una dirección privada para obtener la posición aproximada.

Las consultas del mapa usarán área visible y filtros para no descargar todos los textos a escala mundial. Los grupos devuelven conteos; los mensajes de un grupo se consultan con paginación y orden estable por fecha, con identificador como desempate.

Como alternativa de arranque, los servicios públicos de OpenStreetMap exigirían atribución, respeto de caché y límites de uso. Nominatim no se utilizará para autocompletar ni para enviar direcciones privadas; requiere una revisión específica de su política antes de adoptarlo. No es el proveedor definitivo de este diseño.

## Autenticación y correos

Configurar en Clerk usuario, correo verificado obligatorio, contraseña y Google. Validar vinculación de cuentas, recuperación y los textos en ambos idiomas con la integración real. El nombre público permanece en la aplicación y es distinto del usuario de acceso.

Los correos de autenticación los gestiona Clerk; no se añade un segundo proveedor de correo mientras cubra verificación y recuperación. El correo de contacto del footer es una dirección real que aportará el propietario y no implica un sistema de envío desde la web.

La activación de Google en producción y el dominio final pueden requerir configuración del propietario. No se publicará un acceso simulado mientras falten estos pasos.

## Eliminación y conservación

Al solicitar eliminación de cuenta, desactivar primero su visibilidad y capacidad de operar. Borrar sus mensajes y completar después la eliminación de identidad con reintentos registrados si Clerk falla. La respuesta no afirmará una eliminación completa mientras haya pasos pendientes.

Las solicitudes de revisión abiertas conservan su copia privada. Al cerrar un caso se calcula el vencimiento a dos años naturales; un proceso periódico elimina la copia vencida. Las referencias al mensaje o cuenta eliminados serán anulables, evitando que el borrado en cascada destruya la evidencia retenida. Su acceso es exclusivamente administrativo.

## Verificación

Pruebas unitarias para la matriz completa de visibilidad, transiciones, grafemas y coordenadas estables. Pruebas con PostgreSQL para carreras de publicación, autorizaciones y auditoría atómica. Comprobación del flujo real de registro, recuperación, Google, mensajes, filtros, moderación y borrado antes de abrir el lanzamiento.

## Situación de provisión

- Proyecto local vinculado a `joseppascualbadia-8623s-projects/atiny-world` en Vercel.
- Clerk Hobby provisionado y conectado a development, preview y production;
  sus variables locales se descargan a archivos excluidos de Git.
- El intento de alta de Neon se detuvo por aceptación de condiciones; no se retomará tras elegir Supabase.
- Supabase Free provisionado en París (`eu-west-3`), vinculado y verificado
  mediante una consulta de solo lectura.
- La base ejecutable existe localmente; todavía no hay despliegue público,
  esquema de producto, credencial restringida de aplicación ni rol de preview.

## Fuentes consultadas

- [Next.js: instalación](https://nextjs.org/docs/app/getting-started/installation).
- [Clerk: opciones de registro](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options).
- [Clerk: vinculación de cuentas](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/account-linking).
- [Clerk: precios](https://clerk.com/pricing).
- [Neon: integración con Vercel](https://neon.tech/docs/guides/vercel-native-integration).
- [Supabase: integración con Clerk](https://supabase.com/docs/guides/auth/third-party/clerk).
- [Supabase: precios](https://supabase.com/pricing).
- [MapTiler: precios](https://www.maptiler.com/cloud/pricing/).
- [MapTiler: condiciones](https://www.maptiler.com/terms/cloud/).
- [OpenStreetMap: política de teselas](https://operations.osmfoundation.org/policies/tiles/).
- [Nominatim: política de uso](https://operations.osmfoundation.org/policies/nominatim/).
- Catálogo y planes consultados con Vercel CLI 54.9.1 el 2026-09-13.
