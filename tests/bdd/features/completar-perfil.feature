# language: es
Característica: Crear el perfil tras verificar el registro
  Como fan recién registrada
  Quiero elegir un solo nombre público durante el alta
  Para participar sin un formulario de perfil posterior

  Escenario: Una identidad verificada obtiene un perfil con nombre Unicode
    Dado que Clerk identifica a la fan "user_pending" con correo verificado y perfil incompleto
    Cuando Clerk entrega el nombre público "ATINY 서울 🌙"
    Entonces el perfil queda completo con rol fan
    Y la fan puede acceder a la publicación sin volver a estar bloqueada

  Escenario: Una cuenta sin perfil no puede escribir antes de crearlo
    Dado que Clerk identifica a la fan "user_pending" con correo verificado y perfil incompleto
    Cuando intenta escribir una carta
    Entonces se la dirige a reintentar la creación del perfil

  Escenario: Un perfil existente sigue disponible
    Dado que Clerk identifica a la fan "user_ready" con perfil completo
    Cuando intenta escribir una carta
    Entonces puede continuar hacia la publicación

  Escenario: Dos cuentas pueden elegir el mismo nombre público
    Dado que Clerk identifica a la fan "user_pending" con correo verificado y perfil incompleto
    Y otra cuenta ya usa el nombre público "ATINY 🌙"
    Cuando Clerk entrega el nombre público "ATINY 🌙"
    Entonces el perfil queda completo con rol fan

  Escenario: Un nombre vacío se rechaza en servidor
    Dado que Clerk identifica a la fan "user_pending" con correo verificado y perfil incompleto
    Cuando Clerk entrega el nombre público "   "
    Entonces recibo un error para el nombre público

  Escenario: Sin sesión no se puede crear el perfil
    Dado que Clerk no identifica a la visitante
    Cuando Clerk entrega el nombre público "Visitante"
    Entonces recibo una salida clara de sesión ausente
