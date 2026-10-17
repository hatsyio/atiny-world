# Editable vector map palette

Issue: [#131](https://github.com/hatsyio/atiny-world/issues/131).

## Edit the colors

Edit **`src/config/map-style.config.ts`** and reload the map. The same configuration is used by the public explorer, letter-location preview and location picker. A deployment is needed to change the hosted preview or production site; this is a repository configuration, not a settings screen.

```ts
export const mapStyle = {
  colors: {
    land: '#d9ac70',
    water: '#181b21',
    // Other feature colors are listed in the configuration file.
  },
}
```

| Setting | Default | Use |
| --- | --- | --- |
| `land` | `#d9ac70` | Warm site parchment continents and country boundary halo |
| `water` | `#181b21` | Site header-dark seas, lakes and rivers |
| `waterShore` | `#2b2a29` | Water edge/shadow |
| `vegetation` | `#cb9d66` | Parks, woodland and natural land cover |
| `residential` | `#d3a66c` | Residential areas |
| `buildings` | `#c39560` | Buildings and roofs |
| `buildingOutline` | `#b28454` | Building outlines |
| `roads` | `#eed4a7` | Minor roads and airport surfaces |
| `majorRoads` | `#d3a665` | Primary/secondary roads, trunks and motorways |
| `roadOutline` | `#ad7f50` | Road casings, including bridges and tunnels |
| `paths` | `#b28454` | Paths |
| `railways` | `#a7794c` | Rail lines; dashes use `roads` |
| `boundaries` | `#9c6e44` | Country and administrative boundaries |
| `labels` | `#2b1a12` | Place, road, building-number and point-of-interest text |
| `waterLabels` | `#eed4a7` | Water names |
| `labelHalo` | `#eed4a7` | Light halo for dark labels on land |
| `waterLabelHalo` | `#181b21` | Dark halo for light water names |

The `water` setting colors the dominant ocean fill, including CARTO's translated overlay; `waterShore` colors its narrow exposed shoreline. The configuration changes paint colors; CARTO's existing placement, geometry, widths, opacity and zoom-dependent visibility remain intact. Changes to those advanced properties belong in the style builder or the pinned style, rather than the color palette.

## Letters and controls

Edit **`src/components/map/map-theme.css`** for all `--map-*` interface tokens. Parchment markers have a brown-ink border and a pale paper halo. Site navy clusters have a double border and a numeric count. Selected letters have a double border plus an outer ring; keyboard focus adds a dashed outline. Selection is also exposed as `aria-pressed`.

| Content | Foreground / background | Contrast |
| --- | --- | --- |
| Marker, popup and attribution text | `#2b1a12` / `#eed4a7` | 11.60:1 |
| Cluster and selected letter | `#eed4a7` / `#102033` | 11.45:1 |
| Zoom/fullscreen controls | `#102033` / `#eed4a7` | 11.45:1 |
| Secondary interface text | `#684728` / `#eed4a7` | 5.80:1 |
| Cartographic label / halo | `#2b1a12` / `#eed4a7` | 11.60:1 |
| Water label / halo | `#eed4a7` / `#181b21` | 12.00:1 |

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
- `pnpm test`: 51 BDD scenarios and 893 unit tests passed after the dark-sea atlas refinement. An earlier full unit run hit a timing failure in `language-switcher.test.tsx` (`Saving language…` versus `Language saved.`); its isolated rerun passed. This unrelated test was not changed.
- Integration: 163 passed. Contract: 61 passed. The existing `20261014143000_geographic_locations.sql` migration had to be applied to the local test database first; this PR adds no schema changes.
- Palette browser suite: 6 passed, including actual context loss and three viewport widths.
- Existing map browser suite: 28 passed, 1 intermittent failure in `applies partial cities automatically without moving the filters on /map at 390px` (city URL parameter timing). A previous run hit the desktop variant and a selected-popup timing failure; their focused reruns passed. The failing mobile case then passed three consecutive focused reruns; the unchanged baseline also passed its focused repetitions. The cause of the intermittent failure is not attributed to this PR. Keep this limitation visible when reviewing the experimental PR.
- Actual production build: vector layer visible, raster layer removed, worker and `/api/map/features`, `/api/map/messages`, `/api/map/filter-options` returned HTTP 200, no page errors.

### Site-derived atlas refinement

The dark-sea/light-land composition remains, with its colors anchored to the existing website rather than an independent olive palette. The sea uses the exact `.site-header` base color (`#181b21`). Land uses `--paper` (`#d9ac70`); labels use `--ink` (`#2b1a12`), and light paper uses `--paper-light` (`#eed4a7`). The palette configuration records these source anchors from `globals.css`.

Vegetation mixes paper with 13% site brown, residential areas with 5%, buildings with 20%, building outlines/paths with 35%, road outlines with 40%, railways with 45%, and boundaries with 55%. Major roads mix paper with 35% site gold (`#c79a50`). This keeps detail within the website's warm brown, paper and gold family. Marker, control and popup tokens use the same ink, brown, light paper and navy as the page.

The paper texture is still confined to the cartography. The earlier olive and nautical world captures remain available for comparison. The additional `?frame=brand` fixture uses the actual `.site-header` and `.paper-world` CSS to show the map alongside the existing site colors.

### CI fixture routing

The shared UI visual suite runs against the dropdown fixture on port 8770. Map palette tests run separately with `playwright.palette.config.ts` against port 8771; `PALETTE_BASE_URL` lets CI supply its already-running map fixture. `pnpm test:visual` executes both suites. The default Playwright configuration excludes `map-palette.spec.ts` so those tests cannot accidentally run against the dropdown page.

The original CI failure was caused by that accidental discovery: all six map tests ran against port 8770 and timed out looking for map elements that were absent from the page. The corrected workflow starts the map fixture explicitly, runs its dedicated configuration, and uploads traces/screenshots if either visual suite fails. The map tests also passed in the same Linux Playwright container used by CI without real credentials.
