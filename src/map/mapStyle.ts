import type { StyleSpecification } from 'maplibre-gl';

export const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const PLACES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';

export function createBaseMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      cartographic: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'space',
        type: 'background',
        paint: { 'background-color': '#010205' }
      },
      {
        id: 'cartographic',
        type: 'raster',
        source: 'cartographic',
        minzoom: 0,
        maxzoom: 24,
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'linear',
          'raster-fade-duration': 80
        }
      }
    ]
  };
}
