const WORLD_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const PLACES = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';

export function createMapStyle(): any {
  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      satellite: {
        type: 'raster',
        tiles: [WORLD_IMAGERY],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community'
      },
      places: {
        type: 'geojson',
        data: PLACES,
        attribution: 'Localidades © Natural Earth'
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
          'raster-contrast': 0.05,
          'raster-saturation': 0.06
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
        id: 'place-labels-major',
        type: 'symbol',
        source: 'places',
        minzoom: 2.2,
        maxzoom: 24,
        filter: ['<=', ['to-number', ['get', 'scalerank']], 4],
        layout: {
          'text-field': ['coalesce', ['get', 'name'], ['get', 'nameascii']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 13, 12, 16],
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#f7f9ff',
          'text-halo-color': 'rgba(0,0,0,0.92)',
          'text-halo-width': 1.5,
          'text-halo-blur': 0.35
        }
      },
      {
        id: 'place-labels-secondary',
        type: 'symbol',
        source: 'places',
        minzoom: 5.4,
        maxzoom: 24,
        filter: ['all', ['>', ['to-number', ['get', 'scalerank']], 4], ['<=', ['to-number', ['get', 'scalerank']], 8]],
        layout: {
          'text-field': ['coalesce', ['get', 'name'], ['get', 'nameascii']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 10, 12, 16, 14],
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#edf3ff',
          'text-halo-color': 'rgba(0,0,0,0.88)',
          'text-halo-width': 1.25,
          'text-halo-blur': 0.3
        }
      },
      {
        id: 'clusters',
        type: 'circle',
        source: 'cameras',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#1f8cff', 50, '#ff9f1c', 250, '#ffdf40'],
          'circle-radius': ['step', ['get', 'point_count'], 15, 50, 20, 250, 27, 1000, 34],
          'circle-stroke-color': 'rgba(0,0,0,0.88)',
          'circle-stroke-width': 3,
          'circle-opacity': 0.94
        }
      },
      {
        id: 'cluster-count',
        type: 'symbol',
        source: 'cameras',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11
        },
        paint: {
          'text-color': '#030405',
          'text-halo-color': 'rgba(255,255,255,0.25)',
          'text-halo-width': 0.5
        }
      },
      {
        id: 'camera-icons',
        type: 'symbol',
        source: 'cameras',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['concat', 'camera-', ['get', 'light']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.22, 5, 0.28, 12, 0.36, 18, 0.44],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-anchor': 'center'
        }
      }
    ]
  };
}
