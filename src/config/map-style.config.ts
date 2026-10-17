/**
 * Nautical reference palette: dark sepia land, parchment seas and gold details.
 * Color palette for the CARTO Voyager vector background. Edit the HEX values and reload the map.
 * Letter and control colors live in src/components/map/map-theme.css.
 * Fallback PNG tiles retain the original CARTO colors.
 */
export const mapStyle = {
  colors: {
    land: '#5a351c',
    water: '#d8af73',
    waterShore: '#e6c58f',
    vegetation: '#4b3721',
    residential: '#684529',
    buildings: '#795333',
    buildingOutline: '#422916',
    roads: '#ac814c',
    majorRoads: '#c49a60',
    roadOutline: '#382216',
    paths: '#8b6a42',
    railways: '#ae8b59',
    boundaries: '#a07841',
    labels: '#f3dbab',
    waterLabels: '#5b3b20',
    labelHalo: '#402818',
    waterLabelHalo: '#e4c28a',
  },
}

export type MapColors = typeof mapStyle.colors
