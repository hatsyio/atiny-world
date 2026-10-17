/**
 * Site-derived atlas palette: header-dark seas, warm paper land and brown ink.
 * Anchors match globals.css: header #181b21, paper #d9ac70, paper-light #eed4a7,
 * ink #2b1a12, brown #6a3b20 and gold #c79a50. Feature shades mix these anchors.
 * Color palette for the CARTO Voyager vector background. Edit the HEX values and reload the map.
 * Letter and control colors live in src/components/map/map-theme.css.
 * Fallback PNG tiles retain the original CARTO colors.
 */
export const mapStyle = {
  colors: {
    land: '#d9ac70',
    water: '#181b21',
    waterShore: '#2b2a29',
    vegetation: '#cb9d66',
    residential: '#d3a66c',
    buildings: '#c39560',
    buildingOutline: '#b28454',
    roads: '#eed4a7',
    majorRoads: '#d3a665',
    roadOutline: '#ad7f50',
    paths: '#b28454',
    railways: '#a7794c',
    boundaries: '#9c6e44',
    labels: '#2b1a12',
    waterLabels: '#eed4a7',
    labelHalo: '#eed4a7',
    waterLabelHalo: '#181b21',
  },
}

export type MapColors = typeof mapStyle.colors
