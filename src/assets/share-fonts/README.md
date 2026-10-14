# Fuentes de las postales

Recursos locales para medir y generar las imágenes sin descargar fuentes o emojis durante la solicitud.

- Source Serif 4 Regular: https://github.com/adobe-fonts/source-serif/tree/release/OTF, SIL OFL (licencia adjunta).
- Noto Sans KR Regular: https://github.com/notofonts/noto-cjk/tree/main/Sans/SubsetOTF/KR, SIL OFL (licencia adjunta). Incluye coreano y cobertura CJK para cartas de ATINY.
- Noto Emoji: https://github.com/google/fonts/tree/main/ofl/notoemoji, SIL OFL (licencia adjunta). Instancia estática de peso 400, generada con FontTools 4.60.1 porque el parser de Satori no admite esta fuente variable:

```sh
fonttools varLib.instancer 'NotoEmoji[wght].ttf' wght=400 --output=NotoEmoji-Regular.ttf
```

Las fuentes se incluyen explícitamente en los artefactos de las rutas de imagen mediante `outputFileTracingIncludes`. No son fuentes adicionales descargadas por el navegador.
