import type { StyleSpecification } from 'maplibre-gl';

export const POLITICAL_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const RELIEF_TILES = 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png';
export const TERRAIN_TILEJSON = 'https://tiles.mapterhorn.com/tilejson.json';

export const PLACES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';

export function createBaseMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      political: {
        type: 'raster',
        tiles: [POLITICAL_TILES],
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
        id: 'political-base',
        type: 'raster',
        source: 'political',
        minzoom: 0,
        maxzoom: 24,
        layout: { visibility: 'none' },
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'linear',
          'raster-fade-duration': 80,
          'raster-saturation': -0.12,
          'raster-contrast': 0.08
        }
      }
    ]
  };
}
