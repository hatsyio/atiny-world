# Revisión de compartir cartas

Ruta de producto: **Mis cartas → Ver carta → Compartir**. El control aparece únicamente para el autor de una carta que siga visible públicamente.

- Threads y X preparan un extracto literal y el enlace; el usuario revisa y publica en la plataforma.
- WhatsApp, Telegram, Facebook, LinkedIn y Pinterest reciben sus parámetros de compartir.
- El menú copia el enlace de la carta o el de Atiny Atlas; si el portapapeles falla, ofrece texto seleccionable.
- Instagram abre la postal: formatos story y publicación, descarga PNG, copia de texto/enlace y envío de archivos con el menú nativo cuando el dispositivo lo admite.
- El enlace compartido tiene metadatos e imagen horizontal propios. Cartas privadas y retiradas no alimentan los metadatos ni las rutas de imagen.

Las capturas usan la carta de ejemplo del fixture visual y los componentes reales, con PNG generados por el renderer de la aplicación. No representan una sesión autenticada en producción.

![Vista previa en escritorio](desktop-story.png)
![Menú en móvil](mobile-menu.png)
![Story en móvil](mobile-story.png)
![Postal cuadrada exportada](postcard-square.png)

## Comprobaciones

Lint, tipos y build pasan. Pasan los escenarios BDD, la suite unitaria, integración y contratos locales. Las pruebas de navegador cubren 1440 y 390 píxeles, límites del menú, cierre con Escape, recuperación del foco, formatos, PNG real, márgenes conservados y descarga; se mantiene el resto de comprobaciones visuales existentes.

Se ha revisado el diff de forma independiente y corregido el cómputo de enlaces cortos de X y la geometría de postales/vista previa. El cálculo de X usa su parser oficial `twitter-text`; las fuentes de las imágenes se distribuyen localmente con sus licencias.

## Revisión manual pendiente

Probar los compositores externos con cuentas reales y compartir archivos en iOS/Android con Instagram instalado. El entorno local permite verificar los parámetros, las APIs del navegador y el recorrido de descarga, pero no la recepción por aplicaciones móviles físicas. Instagram no recibe una publicación automática: el enlace de una story se añade con su sticker de enlace.
