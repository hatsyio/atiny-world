# language: es
@us3
Característica: Gestionar mensajes propios
  Como fan autenticada
  Quiero consultar, localizar, editar y eliminar mis mensajes
  Para mantener bajo mi control mis aportaciones y conocer el motivo de cada decisión

  Escenario: Mis mensajes lista todos los propios con estado y motivo
    Dado una fan con mensajes visibles y ocultos
    Cuando abro "Mis mensajes"
    Entonces consulto todos mis mensajes con su estado y el motivo de moderación cuando exista
    Y ningún estado ni motivo privado aparece en las respuestas públicas

  Escenario: Localizar un mensaje propio centra el mapa en su punto
    Dado una fan con un mensaje propio visible
    Cuando uso "localizar" sobre ese mensaje
    Entonces el mapa se centra en el punto del mensaje y su enlace estable abre la ficha

  Escenario: Editar solo el texto conserva el enlace y el punto
    Dado un mensaje propio aprobado
    Cuando edito solo el texto del mensaje
    Entonces el mensaje vuelve a pendiente e incrementa su versión
    Y el contenido anterior deja de mostrarse públicamente conservando el enlace y el mismo punto público

  Escenario: Editar un mensaje oculto lo devuelve a pendiente
    Dado un mensaje propio rechazado con motivo
    Cuando edito su texto
    Entonces el mensaje vuelve a pendiente y queda sin motivo de moderación

  Escenario: Cambiar la ubicación establece un nuevo punto
    Dado un mensaje propio con una ubicación aproximada
    Cuando cambio la ubicación del mensaje
    Entonces puedo elegir un nuevo punto y el mensaje vuelve a pendiente conservando su enlace estable

  Escenario: Eliminar tras confirmar libera espacio y deja de estar disponible
    Dado una fan en el límite de mensajes con un mensaje propio
    Cuando elimina ese mensaje tras confirmarlo
    Entonces el mensaje deja de estar disponible públicamente y libera un espacio del límite
    Y la eliminación no es un estado recuperable

  Escenario: Una fan ajena no puede reescribir el texto
    Dado un mensaje de otra fan
    Cuando una fan distinta de la autora intenta reescribir su texto
    Entonces la operación se rechaza sin modificar contenido ni estado

  Escenario: Un administrador no puede reescribir el texto ajeno
    Dado un mensaje de una fan
    Cuando un administrador intenta reescribir su texto
    Entonces la operación se rechaza sin modificar contenido ni estado