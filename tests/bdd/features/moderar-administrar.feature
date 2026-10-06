# language: es
@us5 @moderation
Característica: Moderar cartas con decisiones justificadas y versionadas
  Como administradora autorizada
  Quiero revisar las cartas y registrar mis decisiones
  Para proteger el mapa sin reescribir el texto de sus autoras

  Escenario: Aprobar una carta pendiente con moderación previa
    Dado una administradora revisando una carta "pending" con moderación previa activada
    Cuando decide "approve" sobre la versión revisada sin motivo
    Entonces la carta queda "approved" y es pública
    Y la decisión y su auditoría conservan la versión revisada sin copiar el texto

  Escenario: Rechazar una carta con motivo privado
    Dado una administradora revisando una carta "pending" con moderación previa desactivada
    Cuando decide "reject" sobre la versión revisada con motivo "privacy"
    Entonces la carta queda "rejected" y está oculta
    Y la autora consulta el motivo "privacy" y la nota privada
    Y la decisión y su auditoría conservan la versión revisada sin copiar el texto

  Escenario: Retirar una carta publicada
    Dado una administradora revisando una carta "approved" con moderación previa desactivada
    Cuando decide "withdraw" sobre la versión revisada con motivo "spam"
    Entonces la carta queda "withdrawn" y está oculta
    Y la autora consulta el motivo "spam" y la nota privada

  Escenario: Retirar una carta pendiente que ya es pública
    Dado una administradora revisando una carta "pending" con moderación previa desactivada
    Cuando decide "withdraw" sobre la versión revisada con motivo "conduct"
    Entonces la carta queda "withdrawn" y está oculta

  Escenario: Una edición invalida la decisión anterior
    Dado una administradora revisando una carta "pending" con moderación previa activada
    Y la autora edita la carta después de que la administradora la consulte
    Cuando decide "approve" sobre la versión revisada sin motivo
    Entonces se rechaza la decisión obsoleta conservando la edición sin auditoría parcial

  Escenario: El rechazo exige un motivo conocido
    Dado una administradora revisando una carta "pending" con moderación previa desactivada
    Cuando decide "reject" sobre la versión revisada sin motivo
    Entonces la decisión se rechaza sin cambios ni auditoría

  Escenario: La retirada no permite actuar sobre una carta pendiente oculta
    Dado una administradora revisando una carta "pending" con moderación previa activada
    Cuando decide "withdraw" sobre la versión revisada con motivo "spam"
    Entonces la decisión se rechaza sin cambios ni auditoría

  Escenario: La revocación impide decidir y leer la cola privada
    Dado una administradora revisando una carta "pending" con moderación previa activada
    Y el propietario retira su rol antes de aplicar la decisión
    Cuando decide "approve" sobre la versión revisada sin motivo
    Entonces la decisión se rechaza sin cambios ni auditoría
    Y la cola privada no revela cartas a la cuenta sin permisos
