# Editable vector map palette

Issue: [#131](https://github.com/hatsyio/atiny-world/issues/131).

## Edit the colors

Edit **`src/config/map-style.config.ts`** and reload the map. The same configuration is used by the public explorer, letter-location preview and location picker. A deployment is needed to change the hosted preview or production site; this is a repository configuration, not a settings screen.

```ts
export const mapStyle = {
  colors: {
    land: '#5a351c',
    water: '#d8af73',
    // Other feature colors are listed in the configuration file.
  },
}
```

| Setting | Default | Use |
| --- | --- | --- |
| `land` | `#5a351c` | Dark sepia continents and country boundary halo |
| `water` | `#d8af73` | Light parchment seas, lakes and rivers |
| `waterShore` | `#e6c58f` | Water edge/shadow |
| `vegetation` | `#4b3721` | Parks, woodland and natural land cover |
| `residential` | `#684529` | Residential areas |
| `buildings` | `#795333` | Buildings and roofs |
| `buildingOutline` | `#422916` | Building outlines |
| `roads` | `#ac814c` | Minor roads and airport surfaces |
| `majorRoads` | `#c49a60` | Primary/secondary roads, trunks and motorways |
| `roadOutline` | `#382216` | Road casings, including bridges and tunnels |
| `paths` | `#8b6a42` | Paths |
| `railways` | `#ae8b59` | Rail lines; dashes use `roads` |
| `boundaries` | `#a07841` | Country and administrative boundaries |
| `labels` | `#f3dbab` | Place, road, building-number and point-of-interest text |
| `waterLabels` | `#5b3b20` | Water names |
| `labelHalo` | `#402818` | Dark halo for light labels on land |
| `waterLabelHalo` | `#e4c28a` | Light halo for dark water names |

The configuration changes paint colors; CARTO's existing placement, geometry, widths, opacity and zoom-dependent visibility remain intact. Changes to those advanced properties belong in the style builder or the pinned style, rather than the color palette.

## Letters and controls

Edit **`src/components/map/map-theme.css`** for all `--map-*` interface tokens. Warm parchment markers have a sepia border and a pale paper halo. Deep navy clusters have a double border and a numeric count. Selected letters have a double border plus an outer ring; keyboard focus adds a dashed outline. Selection is also exposed as `aria-pressed`.

| Content | Foreground / background | Contrast |
| --- | --- | --- |
| Marker, popup and attribution text | `#2b1a12` / `#f4dab0` | 12.31:1 |
| Cluster and selected letter | `#f4dab0` / `#102033` | 12.14:1 |
| Zoom/fullscreen controls | `#102033` / `#f4dab0` | 12.14:1 |
| Secondary interface text | `#684728` / `#f4dab0` | 6.15:1 |
| Cartographic label / halo | `#f3dbab` / `#402818` | 10.12:1 |
| Water label / halo | `#5b3b20` / `#e4c28a` | 5.92:1 |

These ratios apply to the defaults. Recheck contrast after editing colors. A subtle, static SVG grain and edge shading age only the vector background. Set `--map-grain-opacity` to `0` to disable the effect; `--map-aged-edge` adjusts its edge tint. Markers, controls and popups sit in separate panes, so their contrast remains unchanged by the texture.

The old CSS sepia filter now applies only to the static map placeholder, so it cannot alter configured live-map colors or control contrast.

## Rendering and fallback

Leaflet still owns navigation, clustering, markers, popups and controls. A lazily imported MapLibre GL layer draws the vector background using the existing public `NEXT_PUBLIC_CARTO_BASEMAP_KEY`. Its module worker is bundled and served from the same origin by Next.js. The key is appended only to HTTPS CARTO basemap resource URLs, including TileJSON, tiles, sprites and glyphs.

Raster tiles remain visible while the vector layer loads. They are removed when GL is ready. Without WebGL2, on an initialization/resource error, context loss, or a 15-second startup timeout, the map retains or restores the original CARTO raster layer. Raster fallback preserves letter interactions and interface colors, but **cannot use the editable cartographic colors**. The initial raster/vector overlap also downloads both sets of tiles during startup. The adapter requires a minimum Leaflet zoom of 1.

The pinned Voyager style is in `src/components/map/styles/carto-voyager.json`, retrieved from [CARTO's Voyager style](https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json). Its geometry and label rules are retained and its paint is customized. Upstream licensing is preserved in `CARTO-LICENSE.md`. The map credits CARTO, OpenStreetMap and OpenMapTiles, and retains the existing Geoapify attribution in the public explorer.

## Verification and screenshots

Run `pnpm exec playwright test --config playwright.palette.config.ts` with the existing `.env`/public CARTO key. This serves the real map components in an isolated browser harness with deterministic letter data; actual CARTO network access is required. Tests cover 320, 390 and 1440 px, contrast, keyboard focus, selection, popup, fullscreen, a second zoom, unmount/remount, missing WebGL and vector resource failure.

See [comparable captures](previews/issue-131/README.md). To regenerate the before captures, serve the harness with `MAP_PALETTE_BASELINE_REF=628556c node --env-file-if-exists=.env scripts/visual-map-server.mjs`; this loads the original map component and CSS from Git. Use the same viewport, center and zoom as the after captures.

The palette tests wait for a zoom to finish before unmounting. Leaflet 1.9.4 has a separately reproduced existing defect when unmounted during an animated zoom: its pending transition timeout reads a removed map pane (`_leaflet_pos`). It also reproduces with raster only; this PR does not change that navigation behavior.

### Verification record (2026-10-17)

- `pnpm build`, `pnpm typecheck`, `pnpm lint`: passed.
- `pnpm test`: 51 BDD scenarios and 893 unit tests passed after the reference palette refinement. An earlier full unit run hit a timing failure in `language-switcher.test.tsx` (`Saving language…` versus `Language saved.`); its isolated rerun passed. This unrelated test was not changed.
- Integration: 163 passed. Contract: 61 passed. The existing `20261014143000_geographic_locations.sql` migration had to be applied to the local test database first; this PR adds no schema changes.
- Palette browser suite: 6 passed, including actual context loss and three viewport widths.
- Existing map browser suite: 28 passed, 1 intermittent failure in `applies partial cities automatically without moving the filters on /map at 390px` (city URL parameter timing). A previous run hit the desktop variant and a selected-popup timing failure; their focused reruns passed. The failing mobile case then passed three consecutive focused reruns; the unchanged baseline also passed its focused repetitions. The cause of the intermittent failure is not attributed to this PR. Keep this limitation visible when reviewing the experimental PR.
- Actual production build: vector layer visible, raster layer removed, worker and `/api/map/features`, `/api/map/messages`, `/api/map/filter-options` returned HTTP 200, no page errors.

### Vintage parchment refinement

The supplied nautical reference guides the palette: dark sepia continents against a light parchment sea, with antique gold details, cream paper and deep navy controls. Residential areas, buildings, roads and vegetation use related brown/olive/gold tones. These HEX values are interpreted from the reference, not exact sampled colors. Land labels use cream ink with a dark halo; water names use dark ink with a separate light halo. A static, low-opacity paper grain is confined to the vector background; letters and controls remain crisp. The existing configuration files still control all colors, and the CSS texture can be disabled independently. Updated comparison, popup and fullscreen captures show this refinement.
