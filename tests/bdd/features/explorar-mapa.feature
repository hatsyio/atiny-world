# language: es
Característica: Explorar mensajes en el mapa
  Como visitante anónima
  Quiero ver solo los mensajes públicos sobre el mapa
  Para descubrir la constelación que creamos juntos sin revelar mensajes ocultos

  Escenario: Una visitante anónima obtiene los puntos públicos del viewport
    Dado el viewport oeste -10, sur 35, este 5, norte 45 con zoom 5
    Cuando solicito los map features del viewport
    Entonces recibo solo mensajes públicos en la lectura actual
    Y el conjunto de features no incluye contenido completo ni motivos de moderación

  Escenario: Los puntos se agrupan con conteos y orden estables
    Dado que existen mensajes públicos y ocultos cerca de una ciudad
    Cuando solicito el grupo paginado del área
    Entonces el grupo empieza por el mensaje público más reciente
    Y los mensajes ocultos no aparecen en el grupo

  Escenario: Los filtros de destinatario y fan acotan la lectura
    Dado que existen mensajes públicos para ATEEZ y para ATINY
    Cuando filtro por destinatario "ateez"
    Entonces solo recibo mensajes públicos dirigidos a ATEEZ
    Cuando filtro por fan con un identificador público
    Entonces solo recibo mensajes públicos de esa fan

  Escenario: Una ficha pública muestra campos mínimos tras revalidar visibilidad
    Dado que existe un mensaje público enlazable
    Cuando abro su ficha pública
    Entonces veo contenido, autora pública, localidad o país y fecha
    Y no veo estado, motivo ni referencia a moderación

  Escenario: Un mensaje oculto o eliminado responde igual que uno ausente
    Dado que existe un mensaje oculto o eliminado
    Cuando abro su ficha pública
    Entonces la respuesta no distingue ausencia de ocultación
    Y el enlace estable sigue sin revelar su contenido

  Escenario: La lectura pública no depende de sesión
    Dado que Clerk no identifica a la visitante
    Cuando solicito map features, ficha y búsqueda de fans
    Entonces las respuestas públicas son las mismas que para una fan identificada