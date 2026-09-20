# language: es
Característica: Completar el perfil tras el registro
  Como fan recién registrada
  Quiero completar mi usuario único y mi nombre público antes de publicar
  Para participar en el mapa sin que la identidad, el correo ni el rol dependan del cliente

  Escenario: Una cuenta verificada completa el perfil y queda lista para publicar
    Dado que Clerk identifica a la fan "user_pending" con correo verificado y perfil incompleto
    Cuando completo el usuario "atiny-seoul" y el nombre público "ATINY Seoul"
    Entonces el perfil queda completo con rol fan
    Y la fan puede acceder a la publicación sin volver a estar bloqueada

  Escenario: Una fan incompleta es dirigida a completar el perfil al escribir una carta
    Dado que Clerk identifica a la fan "user_pending" con correo verificado y perfil incompleto
    Cuando intenta escribir una carta
    Entonces se la dirige a completar el perfil

  Escenario: Un perfil ya completo no vuelve a quedar bloqueado
    Dado que Clerk identifica a la fan "user_ready" con perfil completo
    Cuando intenta escribir una carta
    Entonces puede continuar hacia la publicación

  Escenario: Un nombre de usuario ocupado ofrece una salida clara
    Dado que Clerk identifica a la fan "user_pending" con correo verificado y perfil incompleto
    Y el usuario "atiny-seoul" ya pertenece a otra cuenta
    Cuando completo el usuario "atiny-seoul" y el nombre público "Otra ATINY"
    Entonces recibo un error de usuario ocupado en el campo de usuario

  Escenario: Los datos inválidos se rechazan con errores por campo
    Dado que Clerk identifica a la fan "user_pending" con correo verificado y perfil incompleto
    Cuando completo el perfil sin usuario ni nombre público
    Entonces recibo errores de campo para usuario y nombre público

  Escenario: Sin sesión no se puede completar el perfil
    Dado que Clerk no identifica a la visitante
    Cuando completo el usuario "visitante" y el nombre público "Visitante"
    Entonces recibo una salida clara de sesión ausente