# Desplegables de la aplicación

Usa `AppSelect` de `@/components/ui/app-select` para los campos de selección. El componente comparte el menú, la flecha SVG, el foco, la navegación por teclado y la integración con `FormData`. React Aria gestiona las interacciones y la validación de campos obligatorios.

```tsx
<AppSelect
  label="Idioma"
  name="languagePreference"
  value={preference}
  onChange={setPreference}
  variant="header"
  options={[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }]}
/>
```

Las variantes disponibles son `light` (formularios, por defecto), `header` (cabecera oscura), `paper` (mapa), `admin-messages` y `admin-users`. Los colores se definen una sola vez en `src/components/ui/app-select.css` y se aplican al botón y al menú. Añade variantes aquí cuando haga falta otra superficie; evita sobrescribir el selector desde cada pantalla.

El menú se renderiza en un portal y conserva su propietario mediante `data-overlay-owner`. Los contenedores que se cierran al perder el foco o al pulsar fuera deben usar `containsOverlayTarget`, como `AccountMenu` y `SiteHeader`. En pantalla completa el portal se aloja dentro del elemento que está en ese modo.

## Controles que evitan regresiones

`pnpm lint` rechaza `<select>` e importaciones directas de `Select` de React Aria fuera del componente común. Las pruebas unitarias comprueban esta regla, la selección por teclado, Escape, valores enviados, validación obligatoria y campos deshabilitados.

`pnpm test:visual` comprueba los cinco estilos a 1440 y 390 píxeles, abiertos y cerrados. Incluye la cabecera real sin sesión, elegir idioma dentro del menú de cuenta y seleccionar país en pantalla completa. Las conexiones de navegación, sesión y guardado se sustituyen únicamente en el servidor de pruebas; los componentes y estilos son los de la aplicación.

Para comprobarlo en macOS:

```sh
pnpm build
pnpm exec playwright install chromium
pnpm test:visual
```

Las capturas se guardan por plataforma. CI usa la imagen fijada de Playwright sobre Ubuntu Noble para mantener estable el renderizado de Linux. Para reproducir sus comprobaciones desde macOS, arranca el servidor en una terminal:

```sh
pnpm build
node scripts/visual-select-server.mjs
```

En otra terminal:

```sh
docker run --rm --ipc host \
  -e CI=true -e VISUAL_BASE_URL=http://host.docker.internal:8770 \
  -v "$PWD:/work" -w /work \
  mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f \
  node node_modules/@playwright/test/cli.js test
```

En Linux usa `--network host` y `VISUAL_BASE_URL=http://127.0.0.1:8770`, como hace CI. Para un cambio visual intencional, añade `--update-snapshots` a la ejecución correspondiente, revisa las imágenes y sube las nuevas referencias de macOS y Linux con el cambio. No actualices las referencias para ocultar un fallo de estilo.
