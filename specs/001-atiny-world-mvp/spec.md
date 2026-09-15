# Feature Specification: ATINY World MVP

**Feature Branch**: `feat/bootstrap`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Crear la especificación base de ATINY World MVP usando `docs/requisitos.md` como fuente autoritativa, manteniendo un máximo inicial de 10 mensajes, sin sistema de «Me gusta» y con la acción «Pedir revisión»."

## Clarifications

### Session 2026-09-15

- Q: ¿Qué protocolo debe usarse para medir los porcentajes y tiempos de SC-001 y SC-002? → A: Pruebas automatizadas cronometradas.
- Q: ¿Con qué matriz y criterio objetivo debe validarse que los recorridos móviles de SC-010 se completan “sin bloqueos”? → A: Safari estable actual en iOS y Chrome estable actual en Android, a 320 y 390 píxeles CSS, en inglés y español; sin desbordamiento horizontal, controles inaccesibles ni errores no gestionados.
- Q: ¿Cómo debe convertirse la intención “cálida y participativa” de FR-003 en un criterio verificable? → A: Orientación estética SHOULD; mapa como mayor región de contenido visible antes del formulario y prohibición de fotografías y logotipos oficiales como requisitos MUST.
- Q: ¿Puede el nombre público coincidir con el usuario único y repetirse entre distintas cuentas? → A: Sí; solo el usuario es único.
- Q: ¿Qué debe ver y poder hacer una persona cuando el mapa o la búsqueda de ubicaciones falla temporalmente? → A: Estado específico con reintento manual, conservación de filtros y borrador, y publicación solo con una ubicación válida ya confirmada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explorar mensajes en el mapa (Priority: P1)

Como visitante, quiero explorar un mapa mundial de mensajes de buenos deseos para descubrir las aportaciones públicas de fans sin tener que crear una cuenta.

**Why this priority**: El mapa y la lectura pública constituyen el valor central del producto y permiten que el proyecto sea útil desde su primera entrega.

**Independent Test**: Se puede validar abriendo el producto sin sesión, explorando agrupaciones y filtros, y accediendo a la ficha y al enlace público de un mensaje visible.

**Acceptance Scenarios**:

1. **Given** que existen mensajes visibles en distintas ubicaciones, **When** una visitante abre la página, **Then** ve el mapa mundial con marcadores o agrupaciones y sus contadores.
2. **Given** una agrupación con varios mensajes, **When** la visitante la abre, **Then** puede recorrer los mensajes en orden estable del más reciente al más antiguo.
3. **Given** varios mensajes visibles, **When** la visitante filtra por ciudad, país, destinatario o fan, **Then** solo aparecen los mensajes públicos que cumplen el filtro.
4. **Given** un mensaje visible, **When** la visitante abre su ficha, **Then** ve el texto completo, el nombre público de la autora, la ubicación mostrable y la fecha de publicación.
5. **Given** un enlace público a un mensaje oculto o eliminado, **When** alguien lo abre, **Then** recibe un aviso de indisponibilidad sin que se revele el contenido.

---

### User Story 2 - Crear una cuenta y publicar (Priority: P1)

Como fan, quiero identificarme y publicar un mensaje asociado a una ubicación elegida para participar en el mapa.

**Why this priority**: Sin cuentas verificadas y publicación no puede crecer el contenido del mapa ni atribuirse cada mensaje a su autora.

**Independent Test**: Se puede validar creando una cuenta, completando el perfil y publicando un mensaje con destinatario y ubicación, para comprobar después su estado y visibilidad.

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta, **When** se registra con un correo válido, lo verifica y completa su perfil, **Then** obtiene una cuenta con usuario único y nombre público.
2. **Given** una fan autenticada y activa, **When** introduce un mensaje válido, elige destinatario y selecciona una ubicación aproximada, **Then** se crea un mensaje pendiente de revisión con un enlace público estable.
3. **Given** que la fan elige una ubicación precisa, **When** confirma la advertencia y publica, **Then** el punto elegido puede mostrarse públicamente, pero no se muestra la dirección escrita.
4. **Given** una cuenta con 10 mensajes no eliminados, **When** intenta publicar otro, **Then** se impide la publicación y se ofrece acceso a «Mis mensajes» para liberar espacio.
5. **Given** una publicación reciente, **When** la misma cuenta intenta publicar antes de finalizar el intervalo configurado, **Then** se impide el envío y se muestra el tiempo de espera restante.

---

### User Story 3 - Gestionar mensajes propios (Priority: P2)

Como fan autenticada, quiero consultar, editar, localizar y eliminar mis mensajes para mantener bajo mi control mis aportaciones.

**Why this priority**: La gestión propia permite corregir contenido, conocer decisiones de moderación y ejercer el control sobre los datos publicados.

**Independent Test**: Se puede validar desde «Mis mensajes» editando y eliminando mensajes en distintos estados y comprobando el enlace, la ubicación, la visibilidad y el límite de cuenta.

**Acceptance Scenarios**:

1. **Given** una fan con mensajes visibles y ocultos, **When** abre «Mis mensajes», **Then** puede consultar todos los suyos con su estado y el motivo de moderación cuando exista.
2. **Given** un mensaje propio, **When** la autora cambia solo el texto, **Then** se sustituye el contenido, el mensaje vuelve a pendiente y conserva el enlace y el punto.
3. **Given** un mensaje propio, **When** la autora cambia la ubicación, **Then** puede elegir un nuevo punto y el mensaje vuelve a pendiente conservando su enlace.
4. **Given** un mensaje propio, **When** la autora lo elimina tras confirmar, **Then** deja de estar disponible y libera un espacio del límite de la cuenta.
5. **Given** un mensaje ajeno, **When** una fan o un administrador intenta reescribir su texto, **Then** la operación se rechaza.

---

### User Story 4 - Pedir revisión de un mensaje (Priority: P2)

Como fan autenticada, quiero pedir privadamente la revisión de un mensaje indicando un motivo para que el equipo de administración pueda evaluarlo.

**Why this priority**: La participación pública necesita un canal de aviso que permita abordar contenido problemático sin exponer a la persona solicitante ni alterar automáticamente el contenido.

**Independent Test**: Se puede validar solicitando la revisión de una versión visible, editando o eliminando después el mensaje y comprobando que la copia privada sigue disponible solo para administradores durante el periodo acordado.

**Acceptance Scenarios**:

1. **Given** una fan autenticada y activa que consulta un mensaje, **When** usa «Pedir revisión» e indica un motivo, **Then** se crea una solicitud privada referida a esa versión.
2. **Given** una solicitud creada, **When** se registra, **Then** el estado y la visibilidad del mensaje no cambian automáticamente.
3. **Given** una solicitud abierta, **When** la autora edita o elimina el mensaje o su cuenta, **Then** los administradores conservan la copia privada de la versión revisada.
4. **Given** una cuenta suspendida o una visitante sin sesión, **When** intenta pedir revisión, **Then** la operación se rechaza sin crear una solicitud.

---

### User Story 5 - Moderar y administrar el proyecto (Priority: P2)

Como administradora, quiero revisar mensajes y solicitudes, aplicar decisiones justificadas y configurar los límites para mantener el mapa seguro y operativo.

**Why this priority**: La moderación protege la visibilidad pública y permite adaptar las reglas operativas sin reescribir las aportaciones de las fans.

**Independent Test**: Se puede validar con mensajes en los cuatro estados, alternando la moderación previa, resolviendo solicitudes de revisión y comprobando permisos, motivos y registro de acciones.

**Acceptance Scenarios**:

1. **Given** un mensaje pendiente, **When** una administradora aprueba la versión que está revisando, **Then** el mensaje queda aprobado y visible.
2. **Given** un mensaje pendiente o publicado, **When** una administradora lo rechaza o retira con un motivo, **Then** queda oculto y la autora puede consultar el motivo en «Mis mensajes».
3. **Given** que un mensaje cambia mientras se revisa, **When** una administradora intenta decidir sobre la versión anterior, **Then** la operación se rechaza para evitar aplicar la decisión a contenido distinto.
4. **Given** mensajes existentes, **When** una administradora activa o desactiva la moderación previa tras consultar el impacto, **Then** cambia su visibilidad conforme a las reglas sin alterar estado, contenido ni ubicación.
5. **Given** una acción administrativa, **When** se completa, **Then** queda un registro privado de quién actuó, cuándo, qué hizo y el motivo aplicable.
6. **Given** dos administradores, **When** uno intenta suspender al otro o retirarle el rol, **Then** se rechaza la operación salvo que quien actúe sea el propietario.

---

### User Story 6 - Gestionar suspensión y eliminación de cuenta (Priority: P3)

Como titular de una cuenta, quiero entender una suspensión y poder eliminar mis mensajes o mi cuenta para conservar el control incluso cuando no puedo publicar.

**Why this priority**: Completa las garantías de seguridad, transparencia y control de datos necesarias para operar el servicio responsablemente.

**Independent Test**: Se puede validar suspendiendo una cuenta, comprobando su visibilidad y permisos, restituyéndola y ejecutando una eliminación de cuenta con solicitudes de revisión abiertas y cerradas.

**Acceptance Scenarios**:

1. **Given** una cuenta suspendida, **When** accede al producto, **Then** puede consultar el motivo y el correo de contacto, pero no publicar, editar ni pedir revisión.
2. **Given** una cuenta suspendida, **When** consulta sus datos, **Then** puede borrar mensajes o solicitar la eliminación de la cuenta.
3. **Given** una cuenta restituida, **When** vuelve a consultar el mapa, **Then** sus mensajes recuperan la visibilidad que corresponde a su estado.
4. **Given** una eliminación de cuenta confirmada, **When** se completa, **Then** se eliminan sus mensajes, se cierra su sesión y no se afirma que la eliminación terminó mientras quede algún paso pendiente.
5. **Given** que una versión de un mensaje forma parte de una solicitud de revisión sujeta a conservación, **When** se elimina la cuenta o el mensaje, **Then** solo se conserva la copia privada durante el periodo acordado.

---

### User Story 7 - Usar el producto en distintos idiomas y dispositivos (Priority: P3)

Como fan internacional, quiero utilizar la interfaz en inglés o español, publicar texto internacional y navegar desde móvil para participar sin perder mi forma de expresión.

**Why this priority**: La comunidad objetivo es internacional y necesita una experiencia accesible desde los dispositivos y escrituras que utiliza habitualmente.

**Independent Test**: Se puede validar cambiando de idioma, publicando coreano y emojis compuestos, y completando la exploración y publicación desde una pantalla móvil.

**Acceptance Scenarios**:

1. **Given** una primera visita, **When** se carga la interfaz, **Then** se muestra en inglés y permite cambiar a español.
2. **Given** una fan que escribe coreano, emojis y saltos de línea, **When** publica un mensaje válido, **Then** el texto se conserva y muestra sin alteraciones.
3. **Given** una pantalla móvil, **When** la fan explora o publica, **Then** puede completar ambos recorridos y expandir o cerrar el mapa a pantalla completa.

### Edge Cases

- Dos publicaciones simultáneas de una misma cuenta no pueden superar el límite de 10 mensajes ni el intervalo entre envíos.
- Los mensajes pendientes, aprobados, rechazados y retirados cuentan para el límite hasta que se eliminan.
- Eliminar un mensaje libera espacio, pero no reinicia el instante del último envío.
- Un texto de 500 unidades visibles se acepta y uno de 501 se rechaza; un emoji compuesto completo cuenta como una unidad.
- Si varias cuentas comparten nombre público, la búsqueda muestra también el usuario único para distinguirlas.
- Una búsqueda o enlace nunca revela texto, estado privado ni motivo de moderación de un mensaje oculto a quien no sea su autora o administradora autorizada.
- Los puntos aproximados permanecen estables entre lecturas y ediciones de texto, aunque se publiquen nuevos mensajes en la misma localidad.
- Varios mensajes de una cuenta en la misma localidad pueden recibir puntos aproximados distintos.
- Las agrupaciones siguen siendo utilizables cuando varios puntos coinciden o están muy próximos.
- Una decisión administrativa sobre una versión obsoleta no afecta a una edición posterior.
- Cambiar la moderación previa puede mostrar u ocultar mensajes pendientes, pero no cambia sus estados.
- Una solicitud de revisión conserva solo su copia privada; no crea un historial público de versiones del mensaje.
- Al vencer dos años naturales desde el cierre de una solicitud de revisión, se elimina su copia privada conservada.
- Si el mapa o la búsqueda de ubicaciones falla temporalmente, la interfaz muestra qué servicio no está disponible y ofrece reintento manual sin perder los filtros ni el borrador; publicar solo sigue permitido cuando ya existe una ubicación válida confirmada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El producto MUST presentarse como «ATINY World» y mostrar en español el subtítulo «Un mundo de buenos deseos para ATEEZ».
- **FR-002**: La página principal MUST presentar, en este orden, cabecera de cuenta, título e introducción, mapa, formulario de publicación y footer.
- **FR-003**: La apariencia SHOULD transmitir una sensación cálida y participativa; el mapa MUST ocupar la mayor región de contenido visible antes del formulario, y la interfaz MUST NOT usar fotografías del grupo ni logotipos oficiales.
- **FR-004**: El footer MUST mostrar un correo de contacto y declarar que el proyecto es una iniciativa de fans sin afiliación oficial con ATEEZ ni su agencia.
- **FR-005**: La interfaz MUST estar disponible en inglés y español, usar inglés por defecto y permitir cambiar de idioma.
- **FR-006**: Los mensajes MUST admitir y conservar texto en cualquier idioma, emojis y saltos de línea, sin traducción automática en esta versión.
- **FR-007**: Una persona MUST poder registrarse con usuario único, correo obligatorio verificado y contraseña, recuperar el acceso por correo y acceder con Google.
- **FR-008**: Una cuenta creada mediante Google MUST completar los datos obligatorios de perfil antes de publicar.
- **FR-009**: Las credenciales de Google y contraseña MUST poder vincularse a una misma cuenta tras verificar la titularidad, sin duplicar el perfil ni los mensajes.
- **FR-010**: Cada cuenta MUST tener un usuario único y un nombre público independiente que MAY coincidir con el usuario y repetirse entre cuentas; el nombre público MUST admitir coreano, espacios y emojis.
- **FR-011**: El correo MUST permanecer privado y los mensajes públicos MUST mostrar el nombre público.
- **FR-012**: Cualquier visitante MUST poder leer el mapa y abrir enlaces de mensajes públicos sin iniciar sesión.
- **FR-013**: Solo una cuenta autenticada y no suspendida MUST poder publicar, editar o pedir la revisión de un mensaje.
- **FR-014**: Un mensaje MUST admitir solo texto y emojis, sin archivos adjuntos ni enlaces clicables.
- **FR-015**: Un mensaje MUST aceptar como máximo 500 unidades visibles, contando cada emoji completo como una unidad.
- **FR-016**: Cada mensaje MUST permitir un único destinatario opcional entre ATEEZ, cada uno de sus ocho miembros y ATINY en general; no seleccionar ninguno MUST significar «para todo el mundo».
- **FR-017**: El máximo inicial MUST ser de 10 mensajes no eliminados por cuenta y MUST ser configurable por una administradora.
- **FR-018**: Los mensajes pendientes, aprobados, rechazados y retirados MUST contar para el límite hasta que sean eliminados.
- **FR-019**: El intervalo inicial entre nuevas publicaciones de una cuenta MUST ser de 10 segundos y MUST ser configurable por una administradora.
- **FR-020**: Cuando el intervalo impida publicar, el formulario MUST mostrar el tiempo restante; cuando se alcance el límite, MUST ofrecer acceso a «Mis mensajes».
- **FR-021**: La comprobación del límite y del intervalo MUST impedir que solicitudes simultáneas de una cuenta vulneren cualquiera de las dos reglas.
- **FR-022**: El formulario MUST permitir buscar una ciudad o dirección y previsualizar el resultado antes de publicar.
- **FR-023**: La ubicación MUST poder elegirse como aproximada o precisa, con la opción aproximada seleccionada por defecto.
- **FR-024**: En modo preciso, la fan MUST poder mover el punto y MUST confirmar una advertencia de que ese punto será público.
- **FR-025**: La vista pública MUST mostrar el punto y la ciudad o país, pero MUST NOT mostrar la dirección escrita introducida en la búsqueda.
- **FR-026**: Una ubicación aproximada MUST producir un punto estable derivado del mensaje alrededor de la ubicación general y MUST identificarse visualmente como aproximada.
- **FR-027**: Editar solo el texto MUST conservar el punto; cambiar la ubicación MUST permitir establecer un nuevo punto.
- **FR-028**: El mapa MUST abrir inicialmente con vista mundial, agrupar mensajes cercanos y mostrar el número de mensajes de cada agrupación.
- **FR-029**: El mapa MUST permitir buscar por ciudad o país y filtrar por destinatario y por fan.
- **FR-030**: La búsqueda de fans MUST aceptar nombre público y usuario único, y MUST mostrar ambos en los resultados.
- **FR-031**: Todos los filtros y búsquedas MUST aplicar las mismas reglas de visibilidad y MUST NOT revelar mensajes ocultos.
- **FR-032**: La ficha de un mensaje visible MUST mostrar texto completo, nombre público, ubicación mostrable y fecha de publicación.
- **FR-033**: Los mensajes de una agrupación MUST poder recorrerse con orden estable del más reciente al más antiguo.
- **FR-034**: El mapa MUST poder expandirse a toda la ventana en escritorio y móvil y MUST ofrecer un control visible para volver a la página.
- **FR-035**: Cada mensaje MUST tener un enlace público estable que centre el mapa y abra su ficha cuando sea visible.
- **FR-036**: Un enlace a un mensaje no disponible públicamente MUST mostrar un aviso sin revelar contenido; tras una edición, el mismo enlace MUST mostrar la versión actual cuando sea visible.
- **FR-037**: «Mis mensajes» MUST mostrar a la autora todos sus mensajes, incluidos los ocultos, con estado, motivo de moderación cuando exista y acceso para localizarlos, editarlos o eliminarlos.
- **FR-038**: Solo la autora MUST poder editar el texto de un mensaje; ningún administrador MUST poder reescribirlo.
- **FR-039**: Editar MUST sustituir el contenido anterior, incrementar la versión y devolver el mensaje a pendiente sin consumir otro espacio del límite.
- **FR-040**: La versión anterior MUST dejar de mostrarse tras una edición y MUST NOT permanecer pública durante la revisión de la nueva.
- **FR-041**: Eliminar un mensaje MUST hacerlo indisponible y liberar un espacio del límite, sin convertir la eliminación en un estado recuperable.
- **FR-042**: Cada mensaje MUST tener exactamente uno de estos estados: pendiente de revisión, aprobado, rechazado o retirado por una administradora.
- **FR-043**: Con moderación previa desactivada, los mensajes pendientes y aprobados de cuentas activas MUST ser visibles; con ella activada, solo los aprobados MUST ser visibles.
- **FR-044**: Los mensajes rechazados, retirados o pertenecientes a cuentas suspendidas MUST permanecer ocultos con independencia de la configuración de moderación.
- **FR-045**: Aprobar MUST aplicarse a un mensaje pendiente; rechazar MUST registrar un motivo; retirar un mensaje publicado MUST registrar un motivo.
- **FR-046**: Las decisiones administrativas MUST referirse a la versión revisada y MUST ser rechazadas si el mensaje fue editado antes de aplicarlas.
- **FR-047**: Antes de cambiar la moderación previa, el panel MUST indicar cuántos mensajes aparecerán o se ocultarán; el cambio MUST NOT alterar estado, contenido ni ubicación.
- **FR-048**: Una fan autenticada y activa MUST poder usar la acción privada «Pedir revisión» e indicar un motivo.
- **FR-049**: Pedir revisión MUST NOT cambiar automáticamente el estado ni la visibilidad del mensaje.
- **FR-050**: Cada solicitud de revisión MUST conservar privadamente la versión solicitada aunque la autora edite o elimine el mensaje o su cuenta.
- **FR-051**: La copia privada MUST conservarse mientras la solicitud esté abierta y durante dos años naturales desde su cierre; una vez vencida, MUST eliminarse.
- **FR-052**: Solo administradores autorizados MUST poder consultar y gestionar solicitudes de revisión y sus copias privadas.
- **FR-053**: El propietario MUST poder asignar o retirar el rol de administrador y suspender administradores; un administrador MUST NOT poder suspender a otro administrador ni retirarle el rol.
- **FR-054**: El panel administrativo MUST permitir buscar y revisar mensajes, aprobar, rechazar, retirar, gestionar solicitudes de revisión, suspender cuentas y configurar moderación, límite e intervalo.
- **FR-055**: Los motivos de rechazo, retirada y suspensión MUST ofrecer opciones predefinidas en inglés y español y una nota libre opcional.
- **FR-056**: Cada acción administrativa MUST dejar un historial privado con actor, fecha, acción y motivo cuando corresponda, incluidos cambios de configuración y suspensiones.
- **FR-057**: Una cuenta suspendida MUST poder acceder, consultar el motivo y correo de contacto, borrar sus mensajes y eliminar su cuenta, pero MUST NOT poder publicar, editar ni pedir revisión.
- **FR-058**: Al levantar una suspensión, los mensajes MUST recuperar la visibilidad correspondiente a su estado.
- **FR-059**: Una fan MUST poder eliminar su cuenta mediante confirmación explícita; el proceso MUST ocultar primero su contenido y capacidad de operar, eliminar sus mensajes y cerrar la sesión.
- **FR-060**: La eliminación de cuenta MUST NOT declararse completa mientras queden pasos pendientes y MUST preservar únicamente las copias privadas de solicitudes de revisión durante su periodo de conservación.
- **FR-061**: La primera versión MUST NOT incluir sistema de «Me gusta», reacciones positivas o negativas, contadores asociados ni ordenación basada en reacciones.
- **FR-062**: La primera versión MUST NOT incluir traducción automática, archivos adjuntos, soporte interno, personalización para ocasiones especiales ni skins seleccionables.
- **FR-063**: Todo mensaje nuevo MUST crearse en estado pendiente de revisión.
- **FR-064**: La autora MUST poder editar también mensajes rechazados o retirados; la edición MUST devolverlos a pendiente de revisión.
- **FR-065**: El resultado y motivo de moderación MUST consultarse en «Mis mensajes» y MUST NOT generar un correo por cada revisión.
- **FR-066**: El producto MUST admitir varias cuentas administradoras simultáneas, bajo la gestión de roles del propietario.

### Key Entities

- **Cuenta de fan**: Identidad verificada con usuario único, nombre público, correo privado, rol, estado de suspensión y fechas relevantes; es autora de mensajes y puede pedir revisiones.
- **Mensaje**: Aportación con identificador y enlace estables, autora, versión actual, texto, destinatario opcional, estado, tipo de precisión, punto público, localidad, país y fechas.
- **Solicitud de revisión**: Petición privada vinculada a la versión de un mensaje, con solicitante, copia privada, motivo, estado, cierre y vencimiento de conservación.
- **Decisión de moderación**: Aprobación, rechazo, retirada o suspensión aplicada por una persona autorizada a una versión concreta, con motivo y nota opcional cuando proceda.
- **Configuración operativa**: Valores administrables para moderación previa, máximo de mensajes por cuenta e intervalo entre publicaciones.
- **Registro administrativo**: Evidencia privada de cada acción administrativa, su actor, fecha, objeto y motivo aplicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los recorridos automatizados de exploración MUST encontrar y abrir un mensaje visible desde el mapa en menos de 60 segundos, medidos desde la portada cargada y sin iniciar sesión ni intervención manual.
- **SC-002**: El 100 % de los recorridos automatizados de alta y publicación MUST completar registro, perfil y primera publicación en menos de 5 minutos, medidos desde el inicio del registro hasta la creación del mensaje y sin intervención manual.
- **SC-003**: El 100 % de los intentos verificados de publicar por encima del límite de 10 mensajes o antes de terminar el intervalo configurado se bloquea con una explicación accionable.
- **SC-004**: El 100 % de las pruebas de visibilidad para los cuatro estados, ambos modos de moderación y cuentas activas o suspendidas devuelve exclusivamente el contenido autorizado.
- **SC-005**: El 100 % de los mensajes de prueba con coreano, saltos de línea y emojis compuestos dentro del límite conserva exactamente su contenido visible tras publicar y editar.
- **SC-006**: El 100 % de los enlaces de prueba conserva el mismo destino lógico después de editar, y ninguno revela contenido cuando el mensaje está oculto o eliminado.
- **SC-007**: El 100 % de las ubicaciones aproximadas de prueba mantiene el mismo punto entre lecturas y ediciones de texto, y ninguna muestra la dirección escrita de búsqueda.
- **SC-008**: El 100 % de las solicitudes de revisión de prueba permanece privado, conserva la versión correcta durante el plazo acordado y se elimina al vencer su conservación.
- **SC-009**: El 100 % de las acciones administrativas de prueba respeta los roles, rechaza decisiones sobre versiones obsoletas y produce un registro auditable.
- **SC-010**: El 100 % de los recorridos automatizados esenciales de exploración, publicación, gestión propia y contacto por suspensión MUST completarse en Safari estable actual sobre iOS y Chrome estable actual sobre Android, a 320 y 390 píxeles CSS y en inglés y español, sin desbordamiento horizontal, controles inaccesibles ni errores no gestionados.

## Assumptions

- Esta especificación representa el primer MVP integral del producto; las funcionalidades futuras se documentarán como especificaciones independientes.
- `docs/requisitos.md` es la fuente autoritativa para alcance y reglas de producto; las decisiones técnicas se incorporarán durante la planificación desde `docs/arquitectura.md`.
- El propietario aportará antes del lanzamiento el dominio, el correo de contacto real y la identidad de las cuentas propietaria y administradoras iniciales.
- Los textos finales de introducción, normas y privacidad se completarán antes del lanzamiento sin cambiar las reglas funcionales aquí definidas.
- La publicación es pública desde el lanzamiento; no se contempla una fase privada para usuarios finales.
- El proyecto busca comenzar con coste de 0 €/mes, admite un presupuesto orientativo de hasta 20 €/mes previa revisión y no activa servicios de pago sin autorización.
- No existe una fecha límite de lanzamiento; la salida pública depende de verificar todos los recorridos esenciales.
- «Pedir revisión» se trata como una solicitud privada de moderación y no como una reacción social ni un mecanismo automático de retirada.
