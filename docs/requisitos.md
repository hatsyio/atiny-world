# ATINY World — Requisitos de producto

Estado: validado por el propietario el 13 de septiembre de 2026 y actualizado el 14 de septiembre de 2026. Alcance acordado para la primera versión.

## Propósito y lanzamiento

ATINY World es un mapa permanente y público de mensajes de buenos deseos de fans de ATEEZ. Cada fan puede crear una cuenta y publicar mensajes asociados a una ubicación elegida.

- Nombre: ATINY World.
- Subtítulo en español: «Un mundo de buenos deseos para ATEEZ».
- Lanzamiento público desde el principio; el propietario se encarga de la difusión inicial.
- Sin fecha límite de lanzamiento.
- Objetivo de coste inicial: 0 €/mes. Presupuesto orientativo: hasta 20 €/mes, ampliable tras revisarlo con el propietario.
- La implementación se realizará después de validar los requisitos.

## Página y apariencia

Orden principal de la página:

1. Cabecera con acceso, registro o identificación de la cuenta activa.
2. Título e introducción.
3. Mapa de mensajes.
4. Formulario de publicación.
5. Footer.

Estética cálida y participativa, fondo claro y elementos originales inspirados en estrellas, viajes y mapas. El mapa es el protagonista. No se utilizarán fotografías del grupo ni logotipos oficiales.

El footer incluirá un correo de contacto administrativo y una nota que identifique el proyecto como una iniciativa de fans sin afiliación oficial con ATEEZ ni su agencia. El correo también estará accesible desde el aviso de suspensión. No habrá un sistema de soporte interno en esta versión.

## Idiomas

- Interfaz en inglés y español, con selector e inglés predeterminado.
- Mensajes en cualquier idioma, incluido coreano, conservando el texto original.
- Soporte de texto internacional, emojis y saltos de línea.
- No habrá traducción automática de mensajes en la primera versión.

## Cuentas y acceso

- Registro con nombre de usuario, correo obligatorio verificado y contraseña.
- Recuperación de acceso mediante correo.
- Acceso con Google.
- Nombre de usuario único y nombre público separados. El nombre público admite coreano, espacios y emojis.
- Quienes accedan con Google completarán los datos necesarios del perfil.
- Google y contraseña podrán vincularse a una misma cuenta tras verificar su titularidad, conservando perfil y mensajes.
- El correo es privado. Los mensajes muestran el nombre público.
- Leer el mapa y abrir enlaces de mensajes no requiere cuenta.
- Publicar y pedir la revisión de un mensaje requiere iniciar sesión.
- Cada fan podrá eliminar su cuenta con confirmación explícita. Se eliminarán sus mensajes y se cerrará su sesión, con la excepción de conservación de solicitudes de revisión descrita más abajo.

## Contenido y publicación

- Texto y emojis, sin archivos adjuntos ni enlaces clicables.
- Hasta 500 caracteres visibles; un emoji completo cuenta como una unidad.
- Destinatario opcional y único. Sin selección significa «para todo el mundo».
- Destinatarios seleccionables: ATEEZ, cada uno de sus ocho miembros y ATINY en general.
- Máximo inicial de 10 mensajes por cuenta, configurable por el administrador.
- Los pendientes, aprobados, rechazados y retirados cuentan para el límite mientras no se eliminen.
- Cooldown inicial de 10 segundos entre nuevos mensajes de una cuenta, configurable por el administrador. El formulario mostrará el tiempo de espera.
- Al alcanzar el límite, el formulario dirigirá a «Mis mensajes» para liberar espacio.

## Selección de ubicación

- Buscar una ciudad o dirección y previsualizar el resultado en un pequeño mapa.
- Elegir ubicación aproximada o precisa; aproximada seleccionada por defecto.
- En modo preciso se puede mover el pin antes de enviar.
- Advertir antes de publicar que un punto preciso será público.
- Mostrar públicamente ciudad o país y el pin, sin la dirección escrita.
- En modo aproximado, distribuir los mensajes alrededor de la ubicación general mediante un desplazamiento determinista basado en el identificador del mensaje.
- Cada mensaje conservará su punto aunque lleguen nuevos mensajes. Varios mensajes de una misma cuenta podrán tener puntos distintos.
- Identificar visualmente la posición aproximada como tal.
- Cambiar solo el texto conserva el punto; cambiar la ubicación permite recalcularlo.
- La distribución estable se combina con agrupación de marcadores para resolver zonas concurridas; no se presupone que el desplazamiento elimine todas las superposiciones.

## Exploración del mapa

- Vista mundial inicial con agrupación de mensajes cercanos y contador.
- Búsqueda por ciudad o país.
- Acceso a «Mis mensajes» para cuentas autenticadas.
- Filtro por destinatario: todos por defecto, ATEEZ, un miembro, ATINY en general o sin destinatario específico.
- Filtro por usuario para ver en el mapa los mensajes de una fan, con acceso directo a los propios mensajes para cuentas autenticadas.
- Búsqueda de fans tanto por nombre público como por nombre de usuario único. Los resultados muestran ambos para distinguir cuentas con el mismo nombre público.
- Los filtros respetan las reglas de visibilidad: buscar una cuenta no revela sus mensajes ocultos.
- Pulsar un marcador abre una ficha con texto completo, nombre público, ubicación elegida y fecha de publicación.
- Los grupos permiten acercarse y recorrer los mensajes individualmente.
- Dentro de una agrupación, orden estable por mensajes más recientes.
- Botón para expandir el mapa a toda la ventana del navegador, también en móvil, y control visible para volver a la página.
- Cada mensaje tendrá un enlace público que centre el mapa y abra su ficha.
- Si el mensaje no está disponible públicamente, su enlace mostrará un aviso sin revelar contenido.
- El enlace se conserva tras editar y muestra la versión actual cuando sea visible.

## Gestión de mensajes propios

«Mis mensajes» permitirá consultar mensajes, ver su estado y motivo de moderación cuando corresponda, localizarlos en el mapa, editarlos y eliminarlos.

- Eliminar un mensaje libera un espacio del límite.
- Rechazados y retirados siguen disponibles para su autora en esta sección.
- Editar sustituye el contenido anterior.
- La versión anterior deja de mostrarse; no permanece visible mientras se revisa la nueva.
- La sustitución no consume otro espacio del límite de mensajes.
- Una edición vuelve a estado pendiente, conservando enlace y ubicación si esta no cambia.
- Solo la autora puede editar el texto. Ningún administrador puede reescribirlo.

## Estados y visibilidad

La moderación previa es configurable y estará desactivada inicialmente. El estado y la visibilidad son independientes.

| Estado | Moderación desactivada | Moderación activada |
| --- | --- | --- |
| Pendiente de revisión | Visible | Oculto |
| Aprobado | Visible | Visible |
| Rechazado | Oculto | Oculto |
| Retirado por administrador | Oculto | Oculto |

Reglas de transición:

- Crear un mensaje: pendiente de revisión.
- Editar un mensaje, incluido uno rechazado o retirado: pendiente de revisión.
- Aprobar un mensaje pendiente: aprobado.
- Rechazar un mensaje pendiente: rechazado, con motivo.
- Retirar un mensaje publicado: retirado, con motivo.
- Eliminar un mensaje: deja de estar disponible y deja de contar para el límite; no constituye otro estado público recuperable.
- Pedir revisión no cambia automáticamente el estado ni la visibilidad.

El interruptor de moderación se aplica también a todos los mensajes existentes. No modifica sus estados, contenido ni ubicación. Antes de aplicar el cambio, el panel indicará cuántos mensajes aparecerán o se ocultarán.

La suspensión de la cuenta autora oculta sus mensajes independientemente del estado. El resultado de moderación se consulta en «Mis mensajes», sin correos por cada revisión.

## Pedir revisión

- Acción «Pedir revisión» con motivo, privada y gestionada por administradores.
- Cada solicitud conserva una copia privada de la versión cuya revisión se pide, aunque la autora edite o elimine el mensaje o su cuenta.
- La copia permanece mientras la solicitud esté abierta y durante dos años desde su cierre.
- Esta excepción de conservación se explicará en los flujos de eliminación correspondientes.

## Administración

- Varios administradores con permisos de moderación y configuración.
- El propietario gestiona quién tiene el rol de administrador.
- Solo el propietario puede suspender a un administrador o retirarle ese rol; los administradores no pueden suspenderse entre sí.
- Panel para buscar y revisar mensajes, aprobar, rechazar, retirar, gestionar solicitudes de revisión y suspender cuentas.
- Configuración de moderación, máximo de mensajes por cuenta y cooldown.
- Motivos predefinidos traducidos al inglés y español, con nota opcional en texto libre, para rechazo, retirada y suspensión.
- Historial privado de acciones administrativas: quién, cuándo, acción y motivo cuando corresponda. Incluye cambios de configuración y suspensión de cuentas.
- Los administradores no pueden modificar el texto de las fans.

Una cuenta suspendida:

- No puede publicar, editar ni pedir revisión.
- Tiene sus mensajes ocultos mientras dure la suspensión.
- Puede acceder, consultar el motivo, contactar por correo, borrar sus mensajes o eliminar su cuenta.
- Al levantarse la suspensión, sus mensajes recuperan la visibilidad correspondiente a su estado.

## Mejoras futuras

- Personalización administrativa para ocasiones especiales.
- Skins seleccionables por cada usuario.
- Traducción automática de mensajes.

## Detalles pendientes para preparar el lanzamiento

Estos puntos no han sido elegidos durante la entrevista y no deben tratarse como decisiones aprobadas:

- Dominio y dirección de correo de contacto reales.
- Identidad de la cuenta propietaria y administradores iniciales.
- Proveedores y arquitectura de alojamiento, mapas, búsqueda geográfica, autenticación y envío de correo, dentro del presupuesto acordado.
- Textos finales de introducción, normas de publicación y documentación de privacidad, incluido el tratamiento de las copias de solicitudes de revisión.

## Flujos esenciales que verificar antes de publicar

- Registro, verificación, recuperación y acceso con contraseña o Google; vinculación sin duplicar la cuenta.
- Publicación internacional con emojis, destinatario opcional y ambas precisiones de ubicación.
- Posición aproximada estable, agrupación, exploración y expansión del mapa.
- Límite por cuenta, cooldown configurable y liberación de espacio al eliminar.
- Edición que conserva enlace y punto cuando corresponde y sustituye el contenido.
- Cambios de moderación que alteran la visibilidad sin modificar los estados.
- Enlaces públicos que no revelan contenido oculto.
- Solicitudes de revisión con copia de la versión y conservación acordada.
- Separación entre permisos de autora, administrador y propietario.
- Suspensión, restitución y eliminación de cuenta con las reglas acordadas.
- Interfaz en inglés y español y uso desde móvil.
