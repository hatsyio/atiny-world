# language: es
Característica: Base ejecutable de ATINY World
  Escenario: La aplicación identifica el proyecto
    Cuando consulto la identidad pública de la aplicación
    Entonces el nombre es "atiny world"

  Escenario: Una visitante sin sesión permanece anónima
    Dado que Clerk no identifica a la visitante
    Cuando resuelvo la sesión en el servidor
    Entonces la sesión es anónima

  Escenario: Una fan identificada obtiene su identidad de servidor
    Dado que Clerk identifica a la fan como "user_atiny"
    Cuando resuelvo la sesión en el servidor
    Entonces la sesión pertenece a "user_atiny"
