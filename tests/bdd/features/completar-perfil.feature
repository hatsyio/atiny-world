# language: es
Característica: Crear el perfil tras completar el registro en Clerk
  Como fan recién registrada
  Quiero elegir un username en Clerk durante el alta
  Para participar sin un formulario de perfil posterior

  Escenario: Una identidad sin correo obtiene un perfil con su username
    Dado que Clerk identifica a la fan "user_pending" sin correo y con perfil incompleto
    Cuando Clerk entrega el username "atiny_fan"
    Entonces el perfil queda completo con rol fan
    Y la fan puede acceder a la publicación sin volver a estar bloqueada

  Escenario: Una cuenta sin perfil no puede escribir antes de crearlo
    Dado que Clerk identifica a la fan "user_pending" sin correo y con perfil incompleto
    Cuando intenta escribir una carta
    Entonces se la dirige a reintentar la creación del perfil

  Escenario: Un perfil existente sigue disponible
    Dado que Clerk identifica a la fan "user_ready" con perfil completo
    Cuando intenta escribir una carta
    Entonces puede continuar hacia la publicación

  Escenario: Un username vacío se rechaza en servidor
    Dado que Clerk identifica a la fan "user_pending" sin correo y con perfil incompleto
    Cuando Clerk entrega el username "   "
    Entonces recibo un error para el username

  Escenario: Sin sesión no se puede crear el perfil
    Dado que Clerk no identifica a la visitante
    Cuando Clerk entrega el username "visitante"
    Entonces recibo una salida clara de sesión ausente
