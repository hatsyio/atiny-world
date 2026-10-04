# language: es
Característica: Idioma de interfaz por lector
  La misma carta conserva su contenido y su URL independientemente del idioma.

  Esquema del escenario: Primera visita negocia el navegador
    Dado un navegador que solicita los idiomas "<idiomas>"
    Cuando resuelvo el idioma de la interfaz para la visitante
    Entonces la interfaz utiliza el idioma "<locale>"

    Ejemplos:
      | idiomas                   | locale |
      | es-MX,en;q=0.8            | es     |
      | en-GB,es;q=0.8            | en     |
      | fr-FR,ko;q=0.8            | en     |
      | en;q=0.2,es-AR;q=0.9     | es     |
      | es;q=0,en;q=0.8          | en     |

  Escenario: La elección manual prevalece y Automático vuelve al navegador
    Dado un navegador que solicita los idiomas "en"
    Y una elección de visitante "es"
    Cuando resuelvo el idioma de la interfaz para la visitante
    Entonces la interfaz utiliza el idioma "es"
    Cuando la visitante vuelve a Automático
    Entonces la interfaz utiliza el idioma "en"

  Escenario: Automático del perfil ignora cookies de idioma anteriores
    Dado un navegador que solicita los idiomas "es-MX"
    Y una elección de visitante "en"
    Y una cuenta con preferencia de idioma "auto"
    Cuando resuelvo el idioma de la interfaz para la cuenta
    Entonces la interfaz utiliza el idioma "es"

  Escenario: La preferencia del perfil se recupera en otro dispositivo
    Dado una fan que guarda el idioma "es" en su perfil
    Y otro dispositivo con navegador "en" y sin cookies
    Cuando recupero la preferencia de idioma de esa fan
    Entonces la interfaz utiliza el idioma "es"

  Escenario: Un prefijo histórico no impone el idioma de lectura
    Dado un navegador que solicita los idiomas "es"
    Cuando abro el destino histórico "/en/messages/letter-67?from=map#letter"
    Entonces el destino normalizado es "/messages/letter-67?from=map#letter"
    Y la interfaz utiliza el idioma "es"
