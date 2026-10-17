# Editable vector map palette

Issue: [#131](https://github.com/hatsyio/atiny-world/issues/131).

## Edit the colors

Edit **`src/config/map-style.config.ts`** and reload the map. The same configuration is used by the public explorer, letter-location preview and location picker. A deployment is needed to change the hosted preview or production site; this is a repository configuration, not a settings screen.

```ts
export const mapStyle = {
  colors: {
    land: '#f3ecdf',
    water: '#b8cdd1',
    // Other feature colors are listed in the configuration file.
  },
}
```

| Setting | Default | Use |
| --- | --- | --- |
| `land` | `#f3ecdf` | Paper-colored land and country boundary halo |
| `water` | `#b8cdd1` | Seas, lakes and rivers |
| `waterShore` | `#c8dadd` | Water edge/shadow |
| `vegetation` | `#d8dfc8` | Parks, woodland and natural land cover |
| `residential` | `#e8dfd0` | Residential areas |
| `buildings` | `#d9cbb8` | Buildings and roofs |
| `buildingOutline` | `#bba98f` | Building outlines |
| `roads` | `#fff9ed` | Minor roads and airport surfaces |
| `majorRoads` | `#e8d2a6` | Primary/secondary roads, trunks and motorways |
| `roadOutline` | `#c5b79f` | Road casings, including bridges and tunnels |
| `paths` | `#b6aa96` | Paths |
| `railways` | `#9c9b91` | Rail lines; dashes use `roads` |
| `boundaries` | `#a99c8d` | Country and administrative boundaries |
| `labels` | `#344b5a` | Place, road, building-number and point-of-interest text |
| `waterLabels` | `#344f5a` | Water names |
| `labelHalo` | `#fff9ed` | Text halo |

The configuration changes paint colors; CARTO's existing placement, geometry, widths, opacity and zoom-dependent visibility remain intact. Changes to those advanced properties belong in the style builder or the pinned style, rather than the color palette.

## Letters and controls

Edit **`src/components/map/map-theme.css`** for all `--map-*` interface tokens. Warm paper markers have a brown border and a white halo. Navy clusters have a double border and a numeric count. Selected letters have a double border plus an outer ring; keyboard focus adds a dashed outline. Selection is also exposed as `aria-pressed`.

| Content | Foreground / background | Contrast |
| --- | --- | --- |
| Marker, popup and attribution text | `#38271c` / `#fff6e5` | 13.26:1 |
| Cluster and selected letter | `#fff6e5` / `#17354a` | 11.90:1 |
| Zoom/fullscreen controls | `#17354a` / `#fff6e5` | 11.90:1 |
| Secondary interface text | `#65513e` / `#fff6e5` | 6.99:1 |
| Cartographic label / halo | `#344b5a` / `#fff9ed` | 8.71:1 |

These ratios apply to the defaults. Recheck contrast after editing colors. The old CSS sepia filter now applies only to the static map placeholder, so it cannot alter configured live-map colors or control contrast.

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
- `pnpm test`: 51 BDD scenarios and 892 unit tests passed. A subsequent full unit run hit a timing failure in `language-switcher.test.tsx` (`Saving language…` versus `Language saved.`); its isolated rerun passed. This unrelated test was not changed.
- Integration: 163 passed. Contract: 61 passed. The existing `20261014143000_geographic_locations.sql` migration had to be applied to the local test database first; this PR adds no schema changes.
- Palette browser suite: 6 passed, including actual context loss and three viewport widths.
- Existing map browser suite: 28 passed, 1 intermittent failure in `applies partial cities automatically without moving the filters on /map at 390px` (city URL parameter timing). A previous run hit the desktop variant and a selected-popup timing failure; their focused reruns passed. The failing mobile case then passed three consecutive focused reruns; the unchanged baseline also passed its focused repetitions. The cause of the intermittent failure is not attributed to this PR. Keep this limitation visible when reviewing the experimental PR.
- Actual production build: vector layer visible, raster layer removed, worker and `/api/map/features`, `/api/map/messages`, `/api/map/filter-options` returned HTTP 200, no page errors.
