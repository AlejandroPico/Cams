import type { StyleSpecification } from 'maplibre-gl';

export const WORLD_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const FALLBACK_MAP = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const PLACES_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';
export const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

export function createMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [WORLD_IMAGERY],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community'
      },
      night: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      },
      cameras: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 42
      }
    },
    layers: [
      {
        id: 'space',
        type: 'background',
        paint: { 'background-color': '#010205' }
      },
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        minzoom: 0,
        maxzoom: 24,
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'linear',
          'raster-fade-duration': 80,
          'raster-contrast': 0.04,
          'raster-saturation': 0.05
        }
      },
      {
        id: 'night-shade',
        type: 'fill',
        source: 'night',
        minzoom: 0,
        maxzoom: 14,
        paint: {
          'fill-color': '#020814',
          'fill-opacity': [
            '*',
            ['coalesce', ['get', 'shade'], 0],
            ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 0.82, 11, 0.28, 13, 0]
          ]
        }
      },
      {
        id: 'clusters',
        type: 'circle',
        source: 'cameras',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#2e97ff', 50, '#ff911f', 250, '#ffe03f'],
          'circle-radius': ['step', ['get', 'point_count'], 15, 50, 20, 250, 27, 1000, 34],
          'circle-stroke-color': 'rgba(0,0,0,0.9)',
          'circle-stroke-width': 3,
          'circle-opacity': 0.95
        }
      },
      {
        id: 'camera-dots',
        type: 'circle',
        source: 'cameras',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'light'],
            'day', '#ffe03f',
            'twilight', '#ff911f',
            '#2e97ff'
          ],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3.8, 5, 4.8, 12, 6, 18, 7.5],
          'circle-stroke-color': '#050505',
          'circle-stroke-width': 2,
          'circle-opacity': 0.96
        }
      }
    ]
  };
}
