# language: es
Característica: Base ejecutable de ATINY World
  Escenario: La aplicación identifica el proyecto
    Cuando consulto la identidad pública de la aplicación
    Entonces el nombre es "ATINY World"

  Escenario: Una visitante sin sesión permanece anónima
    Dado que Clerk no identifica a la visitante
    Cuando resuelvo la sesión en el servidor
    Entonces la sesión es anónima

  Escenario: Una fan identificada obtiene su identidad de servidor
    Dado que Clerk identifica a la fan como "user_atiny"
    Cuando resuelvo la sesión en el servidor
    Entonces la sesión pertenece a "user_atiny"

  Escenario: PostgreSQL está disponible
    Dado que la comprobación de PostgreSQL responde correctamente
    Cuando consulto el estado HTTP de la base de datos
    Entonces el estado HTTP es 200 y solo informa que la base de datos está disponible

  Escenario: PostgreSQL no está disponible
    Dado que la comprobación de PostgreSQL falla
    Cuando consulto el estado HTTP de la base de datos
    Entonces el estado HTTP es 503 y no revela el error interno
