/**
 * Fantasy atlas palette: charcoal seas, olive parchment land and dark ink.
 * Color palette for the CARTO Voyager vector background. Edit the HEX values and reload the map.
 * Letter and control colors live in src/components/map/map-theme.css.
 * Fallback PNG tiles retain the original CARTO colors.
 */
export const mapStyle = {
  colors: {
    land: '#c9c08c',
    water: '#202827',
    waterShore: '#36413a',
    vegetation: '#ada777',
    residential: '#c1b383',
    buildings: '#afa071',
    buildingOutline: '#7c7553',
    roads: '#dbd0a0',
    majorRoads: '#bca16d',
    roadOutline: '#8e845d',
    paths: '#8a825d',
    railways: '#6e7355',
    boundaries: '#747453',
    labels: '#30372a',
    waterLabels: '#d5d0af',
    labelHalo: '#e1d7a8',
    waterLabelHalo: '#202827',
  },
}

export type MapColors = typeof mapStyle.colors
