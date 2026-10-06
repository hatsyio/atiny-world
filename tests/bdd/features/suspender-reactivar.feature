# language: es
@us5 @suspension
Característica: Suspender y reactivar cuentas con auditoría privada
  Como administradora autorizada
  Quiero suspender y reactivar cuentas sin reescribir sus cartas
  Para controlar su visibilidad respetando los permisos

  Escenario: Suspender una fan oculta sus cartas y permite borrarlas
    Dado una administradora y una fan con cartas pendientes y aprobadas
    Cuando suspende a la fan con motivo "conduct"
    Entonces las cartas de la fan quedan ocultas sin cambiar sus versiones
    Y la fan puede leer y borrar sus cartas pero no editarlas
    Y la suspensión y su auditoría quedan registradas sin copiar la nota

  Esquema del escenario: La reactivación respeta las reglas vigentes
    Dado una administradora y una fan con cartas pendientes y aprobadas
    Y la fan está suspendida y la moderación previa está <modo>
    Cuando reactiva a la fan con la versión actual
    Entonces quedan visibles <cantidad> cartas de la fan sin cambiar sus versiones

    Ejemplos:
      | modo        | cantidad |
      | activada    | 1        |
      | desactivada | 2        |

  Escenario: Un administrador no suspende a otro administrador
    Dado una administradora y una fan con cartas pendientes y aprobadas
    Y la fan ahora tiene rol de administradora
    Cuando suspende a la fan con motivo "spam"
    Entonces se rechaza la suspensión sin auditoría parcial

  Escenario: Otra suspensión invalida un formulario antiguo
    Dado una administradora y una fan con cartas pendientes y aprobadas
    Y la fan ya ha sido suspendida por otra administradora
    Cuando suspende a la fan con motivo "spam"
    Entonces se rechaza el formulario antiguo sin repetir la auditoría
