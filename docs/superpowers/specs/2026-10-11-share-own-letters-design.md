# Compartir tus cartas

## Objetivo y decisiones acordadas

Facilitar que el autor comparta sus cartas en redes sociales y lleve a nuevas personas a leerlas en Atiny Atlas. La primera versión se centra en cartas propias: el usuario ha aprobado un menú de compartir, textos preparados, copia de enlaces e imágenes para stories y publicaciones.

El contenido compartido conserva la voz del autor: se utiliza un extracto literal, sin reescribir la carta ni generar texto con IA. Las imágenes son composiciones tipográficas de la carta y la identidad visual de la aplicación.

## Experiencia

En el listado de Mis cartas y en el detalle de una carta propia y públicamente visible aparece «Compartir», junto a las acciones de la carta. En escritorio abre un desplegable; en móvil, un panel inferior. Ambos ofrecen:

- Threads y X/Twitter.
- WhatsApp, Telegram, Facebook y Pinterest.
- Instagram · Story (9:16) e Instagram · Publicación (1:1).
- Copiar enlace de la carta.
- Más opciones, cuando el dispositivo admite compartir de forma nativa.

Cada destino web usa su mecanismo de compartir documentado y verificado durante la implementación. No se muestran opciones que no tengan un recorrido funcional. «Más opciones» abre los destinos disponibles en el dispositivo; la aplicación no intenta enumerar todas las redes existentes.

El botón solo aparece si la sesión corresponde al autor, la cuenta puede usar la aplicación y la carta cumple la consulta de visibilidad pública existente. El estado de moderación por sí solo no basta. Las cartas pendientes, rechazadas, ocultas o de cuentas suspendidas no ofrecen esta acción. No se ofrece compartir el enlace general de la aplicación.

## Texto y enlaces

El texto preparado sigue esta estructura, traduciendo únicamente la introducción y la llamada a leer según el idioma activo:

> Una carta desde [localidad, país].
>
> «[Inicio literal de la carta]…»
>
> Lee mi carta completa en Atiny Atlas:
> [enlace canónico de la carta]

Si no hay localidad se muestra el país. Se prioriza terminar el extracto en una frase; si una primera frase es demasiado larga se corta entre palabras. Solo se añade elipsis cuando se omite contenido. El presupuesto de texto depende del destino e incluye introducción, llamada a leer y enlace; X requiere respetar su cómputo de caracteres y enlaces.

Sin soporte nativo de archivos, Threads y X abren el compositor con el texto y el enlace preparados. El usuario revisa y publica en la red elegida. Otros destinos pueden admitir solo el enlace o construir su propia vista previa; la interfaz no promete conservar un texto que la plataforma no acepta.

Los enlaces apuntan a `/messages/{publicId}`, sin parámetros de retorno, navegación ni seguimiento. El origen se obtiene de la configuración canónica existente (`metadataBase` / `SITE_URL`). La copia confirma el resultado con «Enlace copiado»; si falla, muestra el enlace seleccionable.

## Imágenes para Instagram y otros destinos

Las dos acciones de Instagram preparan estos formatos:

- Story: PNG de 1080 × 1920.
- Publicación: PNG de 1080 × 1080.

La composición incluye un pergamino con bordes irregulares, fibras y desgaste suave en los márgenes, tipografía coherente con la aplicación, inicio literal de la carta, firma del autor, localidad y país, fecha y marca discreta de Atiny Atlas. El extracto termina con «Continúa leyendo en Atiny Atlas» si falta contenido. Se reservan márgenes amplios en la story para que la interfaz de la red no tape el texto.

El texto se ajusta mediante medición real del espacio disponible; las cartas largas se recortan entre palabras y no reducen indefinidamente el tamaño de la letra. Se conserva el contenido Unicode y no se exportan caracteres cortados. Las dos dimensiones comparten la misma identidad visual.

La vista previa permite descargar la imagen, copiar el texto preparado y copiar el enlace de la carta. En dispositivos compatibles también permite compartir el archivo con el menú nativo. Instagram puede aparecer como destino, pero no se garantiza abrir directamente su editor de stories ni rellenar su pie de foto. Se indica que el enlace de una story se añade con la herramienta de enlaces de Instagram: el texto incluido en un PNG no es clicable.

## Vista previa al pegar el enlace

Las cartas públicamente visibles tienen título, descripción e imagen Open Graph propios, además de metadatos compatibles con tarjetas de X. El título identifica una carta y su autor; la descripción usa un extracto literal; la imagen es una postal horizontal de 1200 × 630.

La lectura para metadatos y la ruta de imagen pública utiliza exclusivamente `getVisibleMessage`, nunca la consulta privada del autor. Si la carta deja de ser pública, no se devuelve su contenido ni su imagen. Se evita introducir caché persistente de contenido retirado; las copias ya descargadas y las cachés externas de redes sociales no se pueden revocar desde la aplicación.

## Integración técnica

- `src/app/(site)/messages/[publicId]/page.tsx` calcula la elegibilidad usando la autoría ya consultada, autorización y resultado público, y la pasa de forma explícita al detalle. Amplía `generateMetadata` con la lectura pública.
- `src/components/messages/letter-detail.tsx` integra el control sin interferir con edición ni navegación.
- Nuevos componentes de compartir encapsulan desplegable, panel móvil, vista previa, descarga y respuesta de las APIs del navegador. Se reutilizan los componentes accesibles de `react-aria-components` ya instalados.
- Un módulo de dominio prepara extractos y enlaces de destino con codificación correcta, sin depender de React ni del navegador.
- Una composición de imagen compartida produce las tres dimensiones. La exportación PNG y la imagen Open Graph utilizan `ImageResponse` de Next.js, con ejecución Node.js y recursos tipográficos locales verificados contra la versión instalada. No se incorpora un servicio externo de generación.
- La ruta de exportación verifica sesión, autoría y visibilidad pública; recibe únicamente identificador, formato e idioma validados. No acepta HTML, contenido arbitrario ni direcciones remotas de imágenes o fuentes. La ruta Open Graph permite lectura pública del contenido ya visible.
- Los textos de interfaz se añaden a los catálogos existentes en español e inglés. El texto original de la carta conserva su idioma.

No se cambia el esquema de base de datos ni se conectan cuentas sociales. El listado reutiliza el control de compartir y recibe del servidor el autor y el origen canónico; las filas no públicas y las cuentas suspendidas no lo muestran.

## Accesibilidad y errores

Los controles tienen nombres accesibles, navegación por teclado, cierre con Escape y devolución del foco al botón de apertura. El panel y la vista previa gestionan el foco como diálogos. Los estados de copia, generación y error se anuncian sin desplazar el foco.

La generación muestra progreso, evita solicitudes duplicadas y permite reintentar. Un fallo conserva las opciones de copiar texto y enlace. Cancelar el menú nativo no se trata como error. Si no se pueden compartir archivos se mantiene la descarga; si no hay menú nativo se omite «Más opciones». Si la carta deja de ser visible durante la interacción, la exportación falla con un mensaje comprensible.

## Verificación y criterios de aceptación

1. El autor ve el menú en su carta pública; un visitante y otro usuario no lo ven. El autor no lo ve para cartas privadas ni con una cuenta suspendida.
2. Los textos incluyen el extracto literal y el enlace correcto; el truncado, Unicode y codificación de parámetros funcionan con cartas largas y caracteres especiales.
3. Ambas opciones de copia generan enlaces canónicos y ofrecen una alternativa si falla el portapapeles.
4. Las imágenes tienen las dimensiones elegidas, texto legible, firma, lugar y marca; no hay desbordamiento en cartas largas ni nombres extensos. Se inspeccionan visualmente los tres formatos.
5. La exportación rechaza solicitudes de otros usuarios y cartas no visibles. Los metadatos y la imagen pública nunca incluyen cartas privadas.
6. Se prueba navegación por teclado, cierre y restauración del foco, errores de descarga y cancelación de compartir.
7. Se verifican los compositores web actuales de los destinos ofrecidos y el recorrido de descargar/compartir imagen en móvil, indicando cualquier límite de dispositivos no disponibles para la prueba.
8. Pasan lint, comprobación de tipos y las pruebas afectadas de dominio, componentes, permisos y metadatos.

## Fuera de alcance

Compartir cartas ajenas desde la interfaz, publicación automática, conexión de cuentas sociales, contenido reescrito con IA, editor de plantillas, carruseles de la carta completa y métricas nuevas de viralidad.


## Ajustes de revisión del 12 de octubre de 2026

El usuario solicita compartir directamente desde el listado, retirar LinkedIn y la opción de compartir el enlace general, dos destinos de Instagram y un aspecto de pergamino gastado.

En navegadores que admiten compartir archivos, abrir el menú prepara los PNG story y publicación. Las acciones esperan a que su archivo esté disponible: el clic llama a `navigator.share` inmediatamente, preservando la activación del usuario. Instagram recibe un archivo en el formato elegido; X y Threads reciben el PNG cuadrado y el texto con enlace, adaptado al presupuesto de X. No se copia texto silenciosamente al portapapeles.

El menú nativo determina las aplicaciones disponibles y permite elegir Instagram y el destino story o publicación; una web no puede seleccionar ese destino por el usuario. En escritorio o sin soporte de archivos, Instagram abre la vista previa en el formato elegido y conserva descarga/copia. X y Threads abren su compositor web con texto y enlace, cuya imagen de vista previa usa el nuevo pergamino: dichos enlaces no adjuntan directamente un PNG.

El fallo de generación permite usar los compositores web y reintentar mediante la vista previa. Cancelar el menú nativo no es un error ni provoca un segundo lanzamiento. Cada apertura prepara una nueva generación; cerrar aborta las solicitudes pendientes. La imagen pública sigue usando solo la lectura pública y la exportación sigue comprobando autoría y visibilidad.
