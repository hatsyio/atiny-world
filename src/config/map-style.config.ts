/**
 * CARTO Voyager vector background palette. Edit the HEX values and reload the map.
 * Letter and control colors live in src/components/map/map-theme.css.
 * Fallback PNG tiles retain the original CARTO colors.
 */
export const mapStyle = {
  colors: {
    land: '#f3ecdf',
    water: '#b8cdd1',
    waterShore: '#c8dadd',
    vegetation: '#d8dfc8',
    residential: '#e8dfd0',
    buildings: '#d9cbb8',
    buildingOutline: '#bba98f',
    roads: '#fff9ed',
    majorRoads: '#e8d2a6',
    roadOutline: '#c5b79f',
    paths: '#b6aa96',
    railways: '#9c9b91',
    boundaries: '#a99c8d',
    labels: '#344b5a',
    waterLabels: '#344f5a',
    labelHalo: '#fff9ed',
  },
}

export type MapColors = typeof mapStyle.colors
