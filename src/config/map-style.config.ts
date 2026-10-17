/**
 * Vintage parchment palette for the CARTO Voyager vector background. Edit the HEX values and reload the map.
 * Letter and control colors live in src/components/map/map-theme.css.
 * Fallback PNG tiles retain the original CARTO colors.
 */
export const mapStyle = {
  colors: {
    land: '#e6cf9f',
    water: '#b6c2be',
    waterShore: '#c6cbb7',
    vegetation: '#cbc79f',
    residential: '#ddc292',
    buildings: '#cdb185',
    buildingOutline: '#a98b5c',
    roads: '#f4e4bf',
    majorRoads: '#d9b87c',
    roadOutline: '#b49a70',
    paths: '#a38c66',
    railways: '#8e8b6e',
    boundaries: '#9a805b',
    labels: '#5e442d',
    waterLabels: '#4d5b50',
    labelHalo: '#f4e4bf',
  },
}

export type MapColors = typeof mapStyle.colors
