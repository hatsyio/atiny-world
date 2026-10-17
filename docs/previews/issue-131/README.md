# Map palette comparison

The same production map component is rendered in a deterministic letter harness. CARTO tiles are real; letter data is a local fixture. All captures use Barcelona at latitude 41.395, longitude 2.16 and Leaflet zoom 12. Browser: Chromium. Height: 900 px. The baseline uses commit `628556c`; the updated view uses this branch.

| Viewport | Before: raster and original palette | After: vector and new palette |
| --- | --- | --- |
| Desktop, 1440 px | ![Original desktop map](before-1440.png) | ![Updated desktop map](after-1440.png) |
| Mobile, 390 px | ![Original mobile map](before-390.png) | ![Updated mobile map](after-390.png) |

## Selection and popup

| Desktop | Mobile |
| --- | --- |
| ![Selected letter and readable popup on desktop](popup-1440.png) | ![Selected letter and readable popup on mobile](popup-390.png) |

## Fullscreen

| Desktop | Mobile |
| --- | --- |
| ![Desktop fullscreen map](fullscreen-1440.png) | ![Mobile fullscreen map](fullscreen-390.png) |

The screenshots show paper markers over urban land, the sea and natural terrain, navy clusters and a selected letter with a double border and outer ring. Browser assertions separately check dashed keyboard focus and contrast of at least 4.5:1 for normal, selected and hovered letters, clusters, controls, popup and attribution text. The 320 px viewport is tested without adding another near-identical capture.

See [palette configuration and verification](../../map-palette.md) for editing instructions, default colors, fallback behavior and reproduction commands.
