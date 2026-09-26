# language: es
@us2
Característica: Crear cuenta y publicar un mensaje
  Como fan autenticada
  Quiero completar mi perfil y publicar desde una ubicación pública
  Para participar en el mapa sin exceder los límites de mi cuenta

  Escenario: Una cuenta verificada completa un perfil y publica aproximadamente
    Dado una identidad Clerk con correo verificado y perfil incompleto
    Cuando Clerk entrega el nombre público "ATINY Seoul"
    Y publico "Siempre contigo" para "ateez" desde una ubicación aproximada
    Entonces recibo un mensaje pendiente con enlace estable

  Escenario: Una ubicación precisa requiere confirmación explícita
    Dado una fan activa con perfil completo
    Cuando intento publicar una ubicación precisa sin confirmar la advertencia
    Entonces la publicación se rechaza por ubicación no confirmada
    Cuando confirmo la advertencia y publico una ubicación precisa
    Entonces el punto público preciso no incluye la dirección escrita

  Escenario: El undécimo mensaje es bloqueado y enlaza a mis mensajes
    Dado una fan activa con diez mensajes no eliminados
    Cuando intenta publicar otro mensaje válido
    Entonces recibe el error "MESSAGE_LIMIT_REACHED" y acceso a "Mis mensajes"

  Escenario: El cooldown muestra el tiempo restante
    Dado una fan activa que acaba de publicar
    Cuando intenta publicar antes del cooldown configurado
    Entonces recibe el error "MESSAGE_COOLDOWN_ACTIVE" con segundos restantes

  Escenario: La carta pendiente aparece en el mapa cuando no hay moderación previa
    Dado una fan activa con perfil completo
    Cuando publico "Nos vemos en el mapa" para "atiny" desde una ubicación aproximada
    Entonces el mensaje pendiente aparece en el mapa y abre su enlace estable

  Escenario: La moderación previa oculta la carta pendiente
    Dado una fan activa con perfil completo y moderación previa activada
    Cuando publico "Esperando revisión" para "ateez" desde una ubicación aproximada
    Entonces el mensaje pendiente conserva su enlace estable pero no aparece públicamente
