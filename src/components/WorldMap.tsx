import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Camera, MapBaseMode } from '../types';
import { buildNightGrid, lightState } from '../map/dayNight';
import {
  createBaseMapStyle,
  PLACES_URL,
  RELIEF_TILES,
  SATELLITE_TILES,
  TERRAIN_TILEJSON
} from '../map/mapStyle';
import { createCameraIcons } from '../map/cameraIcon';

interface Props {
  cameras: Camera[];
  selected: Camera | null;
  onSelect: (camera: Camera | null) => void;
  showLabels: boolean;
  showDayNight: boolean;
  mapMode: MapBaseMode;
  terrain3d: boolean;
}

const MODE_LABELS: Record<MapBaseMode, string> = {
  satellite: 'satélite',
  political: 'geográfico',
  relief: 'relieve'
};

function toGeoJson(cameras: Camera[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cameras.map((camera) => ({
      type: 'Feature',
      id: camera.id,
      geometry: { type: 'Point', coordinates: [camera.lon, camera.lat] },
      properties: {
        id: camera.id,
        title: camera.title,
        city: camera.city,
        country: camera.country,
        light: lightState(camera.lat, camera.lon),
        type: camera.type,
        category: camera.category,
        provider: camera.provider
      }
    }))
  };
}

function addBaseLayers(map: MapLibreMap) {
  if (!map.getSource('satellite')) {
    map.addSource('satellite', {
      type: 'raster',
      tiles: [SATELLITE_TILES],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community'
    });
  }
  if (!map.getLayer('satellite-base')) {
    map.addLayer({
      id: 'satellite-base',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 24,
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 1,
        'raster-resampling': 'linear',
        'raster-fade-duration': 100,
        'raster-contrast': 0.05,
        'raster-saturation': 0.04
      }
    });
  }

  if (!map.getSource('relief')) {
    map.addSource('relief', {
      type: 'raster',
      tiles: [RELIEF_TILES],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 17,
      attribution: 'Map data © OpenStreetMap contributors · SRTM · OpenTopoMap'
    });
  }
  if (!map.getLayer('relief-base')) {
    map.addLayer({
      id: 'relief-base',
      type: 'raster',
      source: 'relief',
      minzoom: 0,
      maxzoom: 24,
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 1,
        'raster-resampling': 'linear',
        'raster-fade-duration': 100,
        'raster-saturation': -0.06,
        'raster-contrast': 0.07
      }
    });
  }

  if (!map.getSource('terrain-dem')) {
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      url: TERRAIN_TILEJSON
    });
  }
  if (!map.getSource('hillshade-dem')) {
    map.addSource('hillshade-dem', {
      type: 'raster-dem',
      url: TERRAIN_TILEJSON
    });
  }
  if (!map.getLayer('terrain-hillshade')) {
    map.addLayer({
      id: 'terrain-hillshade',
      type: 'hillshade',
      source: 'hillshade-dem',
      layout: { visibility: 'none' },
      paint: {
        'hillshade-shadow-color': '#172231',
        'hillshade-highlight-color': '#f4e8c8',
        'hillshade-accent-color': '#42546a',
        'hillshade-exaggeration': 0.55
      }
    });
  }
}

function applyMapMode(map: MapLibreMap, mode: MapBaseMode, terrainEnabled: boolean) {
  const visibility: Record<MapBaseMode, 'visible' | 'none'> = {
    satellite: mode === 'satellite' ? 'visible' : 'none',
    political: mode === 'political' ? 'visible' : 'none',
    relief: mode === 'relief' ? 'visible' : 'none'
  };

  if (map.getLayer('satellite-base')) map.setLayoutProperty('satellite-base', 'visibility', visibility.satellite);
  if (map.getLayer('political-base')) map.setLayoutProperty('political-base', 'visibility', visibility.political);
  if (map.getLayer('relief-base')) map.setLayoutProperty('relief-base', 'visibility', visibility.relief);
  if (map.getLayer('terrain-hillshade')) {
    map.setLayoutProperty('terrain-hillshade', 'visibility', mode === 'relief' || terrainEnabled ? 'visible' : 'none');
  }
}

function applyTerrain(map: MapLibreMap, enabled: boolean) {
  try {
    map.setTerrain(enabled ? { source: 'terrain-dem', exaggeration: 1.2 } : null);
    if (enabled && map.getPitch() < 35) {
      map.easeTo({ pitch: 55, duration: 650 });
    } else if (!enabled && map.getPitch() > 50) {
      map.easeTo({ pitch: 28, duration: 450 });
    }
  } catch (error) {
    console.warn('No se pudo cambiar el terreno 3D:', error);
  }
}

function addCameras(map: MapLibreMap, data: GeoJSON.FeatureCollection) {
  if (!map.getSource('cameras')) {
    map.addSource('cameras', {
      type: 'geojson',
      data,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 44
    });
  } else {
    (map.getSource('cameras') as GeoJSONSource).setData(data);
  }

  if (!map.getLayer('camera-clusters')) {
    map.addLayer({
      id: 'camera-clusters',
      type: 'circle',
      source: 'cameras',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': 'rgba(5,13,24,.9)',
        'circle-radius': ['step', ['get', 'point_count'], 15, 50, 20, 250, 27, 1000, 34],
        'circle-stroke-color': ['step', ['get', 'point_count'], '#72bbff', 50, '#ff9f32', 250, '#ffe66b'],
        'circle-stroke-width': 3,
        'circle-opacity': 0.96
      }
    });
  }

  if (!map.getLayer('camera-cluster-count')) {
    map.addLayer({
      id: 'camera-cluster-count',
      type: 'symbol',
      source: 'cameras',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Open Sans Regular'],
        'text-size': ['step', ['get', 'point_count'], 10, 100, 11, 1000, 12]
      },
      paint: {
        'text-color': '#f4f8ff',
        'text-halo-color': 'rgba(0,0,0,.8)',
        'text-halo-width': 1
      }
    });
  }

  if (!map.getLayer('camera-dots')) {
    map.addLayer({
      id: 'camera-dots',
      type: 'circle',
      source: 'cameras',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'match', ['get', 'light'],
          'day', '#ffe03f',
          'twilight', '#ff911f',
          '#2e97ff'
        ],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 6, 3.4, 12, 4.2, 18, 5],
        'circle-stroke-color': '#020305',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.9
      }
    });
  }
}

function addNight(map: MapLibreMap, visible: boolean) {
  if (!map.getSource('night')) {
    map.addSource('night', { type: 'geojson', data: buildNightGrid() });
  }
  if (!map.getLayer('night-shade')) {
    map.addLayer({
      id: 'night-shade',
      type: 'fill',
      source: 'night',
      minzoom: 0,
      maxzoom: 14,
      layout: { visibility: visible ? 'visible' : 'none' },
      paint: {
        'fill-color': '#010611',
        'fill-opacity': [
          '*',
          ['coalesce', ['get', 'shade'], 0],
          ['interpolate', ['linear'], ['zoom'], 0, 1, 7, 0.9, 10, 0.5, 12.5, 0]
        ]
      }
    }, 'camera-clusters');
  }
}

async function addCameraIcons(map: MapLibreMap) {
  const icons = await createCameraIcons();
  for (const [variant, image] of Object.entries(icons)) {
    const name = `camera-${variant}`;
    if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 });
  }
  if (!map.getLayer('camera-icons')) {
    map.addLayer({
      id: 'camera-icons',
      type: 'symbol',
      source: 'cameras',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['concat', 'camera-', ['get', 'light']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.18, 5, 0.23, 12, 0.3, 18, 0.38],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'center'
      }
    });
  }
}

function addPlaces(map: MapLibreMap, visible: boolean) {
  if (!map.getSource('places')) {
    map.addSource('places', {
      type: 'geojson',
      data: PLACES_URL,
      attribution: 'Localidades © Natural Earth'
    });
  }
  if (!map.getLayer('place-labels-major')) {
    map.addLayer({
      id: 'place-labels-major',
      type: 'symbol',
      source: 'places',
      minzoom: 2.2,
      maxzoom: 24,
      filter: ['<=', ['to-number', ['get', 'scalerank']], 4],
      layout: {
        visibility: visible ? 'visible' : 'none',
        'text-field': ['coalesce', ['get', 'name'], ['get', 'nameascii']],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 13, 12, 16],
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#f7f9ff',
        'text-halo-color': 'rgba(0,0,0,.94)',
        'text-halo-width': 1.6
      }
    });
  }
}

export function WorldMap({
  cameras,
  selected,
  onSelect,
  showLabels,
  showDayNight,
  mapMode,
  terrain3d
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const cameraIndexRef = useRef(new Map<string, Camera>());
  const labelsRef = useRef(showLabels);
  const dayNightRef = useRef(showDayNight);
  const mapModeRef = useRef(mapMode);
  const terrainRef = useRef(terrain3d);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1.2);
  const [status, setStatus] = useState('iniciando globo');
  const [warning, setWarning] = useState('');
  const cameraData = useMemo(() => toGeoJson(cameras), [cameras]);

  useEffect(() => {
    cameraIndexRef.current = new Map(cameras.map((camera) => [camera.id, camera]));
  }, [cameras]);
  useEffect(() => { labelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { dayNightRef.current = showDayNight; }, [showDayNight]);
  useEffect(() => { mapModeRef.current = mapMode; }, [mapMode]);
  useEffect(() => { terrainRef.current = terrain3d; }, [terrain3d]);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    let disposed = false;
    let booted = false;
    let map: MapLibreMap;

    try {
      map = new maplibregl.Map({
        container: hostRef.current,
        style: createBaseMapStyle(),
        center: [2, 30],
        zoom: 1.2,
        minZoom: 0.25,
        maxZoom: 22,
        maxPitch: 85,
        pitch: 0,
        bearing: 0,
        renderWorldCopies: false,
        attributionControl: false,
        cooperativeGestures: false,
        fadeDuration: 100
      });
    } catch (error) {
      setStatus('error del motor');
      setWarning(error instanceof Error ? error.message : 'No se pudo crear el mapa WebGL.');
      return;
    }

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.scrollZoom.setWheelZoomRate(1 / 260);
    map.touchZoomRotate.enable();

    const selectCamera = (event: MapLayerMouseEvent) => {
      const id = String(event.features?.[0]?.properties?.id || '');
      const camera = cameraIndexRef.current.get(id);
      if (camera) onSelect(camera);
    };

    const bindPointer = (layer: string) => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    };

    const boot = () => {
      if (disposed || booted || !map.isStyleLoaded()) return;
      booted = true;

      try {
        map.setProjection({ type: 'globe' });
      } catch (error) {
        console.warn('No se pudo activar la proyección esférica:', error);
        setWarning('El navegador conserva el mapa teselado en proyección plana.');
      }

      try {
        addBaseLayers(map);
        applyMapMode(map, mapModeRef.current, terrainRef.current);
        applyTerrain(map, terrainRef.current);
      } catch (error) {
        console.warn('Una capa cartográfica no está disponible:', error);
      }

      addCameras(map, toGeoJson([...cameraIndexRef.current.values()]));
      addNight(map, dayNightRef.current);

      map.on('click', 'camera-clusters', async (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') return;
        const source = map.getSource('cameras') as GeoJSONSource;
        try {
          const expansionZoom = await source.getClusterExpansionZoom(Number(feature.properties?.cluster_id));
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom: Math.min(expansionZoom, 18),
            duration: 650
          });
        } catch (error) {
          console.warn('No se pudo expandir el grupo:', error);
        }
      });

      map.on('click', 'camera-dots', selectCamera);
      bindPointer('camera-clusters');
      bindPointer('camera-dots');

      void addCameraIcons(map)
        .then(() => {
          map.on('click', 'camera-icons', selectCamera);
          bindPointer('camera-icons');
        })
        .catch((error) => console.warn('Se mantienen puntos de cámara simplificados:', error));

      try { addPlaces(map, labelsRef.current); } catch (error) { console.warn('Localidades no disponibles:', error); }

      setReady(true);
      setStatus(`${MODE_LABELS[mapModeRef.current]} activo`);
      map.resize();
    };

    map.on('style.load', boot);
    map.on('load', boot);
    map.on('styledata', boot);
    window.setTimeout(boot, 0);
    window.setTimeout(boot, 250);
    window.setTimeout(boot, 1000);

    map.on('error', (event) => {
      const detail = event as unknown as { sourceId?: string; error?: Error };
      const message = detail.error?.message || '';
      if (detail.sourceId === 'satellite' || message.includes('arcgisonline')) {
        setWarning('La fotografía satelital no respondió. Cambia a Geográfico o Relieve.');
        return;
      }
      if (detail.sourceId === 'terrain-dem' || detail.sourceId === 'hillshade-dem') {
        setWarning('El modelo de elevación 3D no está disponible temporalmente.');
        return;
      }
      console.warn('MapLibre:', message);
    });
    map.on('zoom', () => setZoom(map.getZoom()));

    const timer = window.setInterval(() => {
      if (!booted || !map.isStyleLoaded()) return;
      (map.getSource('cameras') as GeoJSONSource | undefined)?.setData(toGeoJson([...cameraIndexRef.current.values()]));
      (map.getSource('night') as GeoJSONSource | undefined)?.setData(buildNightGrid());
    }, 60_000);

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(hostRef.current);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    (map.getSource('cameras') as GeoJSONSource | undefined)?.setData(cameraData);
  }, [cameraData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    applyMapMode(map, mapMode, terrain3d);
    setStatus(`${MODE_LABELS[mapMode]} activo`);
  }, [mapMode, terrain3d, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    applyTerrain(map, terrain3d);
  }, [terrain3d, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    if (map.getLayer('place-labels-major')) {
      map.setLayoutProperty('place-labels-major', 'visibility', showLabels ? 'visible' : 'none');
    }
  }, [showLabels, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    if (map.getLayer('night-shade')) {
      map.setLayoutProperty('night-shade', 'visibility', showDayNight ? 'visible' : 'none');
    }
  }, [showDayNight, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    map.flyTo({
      center: [selected.lon, selected.lat],
      zoom: Math.max(map.getZoom(), 12),
      pitch: terrain3d ? 60 : 42,
      bearing: 0,
      speed: 1.15,
      curve: 1.35,
      essential: true
    });
  }, [selected?.id]);

  const reset = () => {
    onSelect(null);
    const map = mapRef.current;
    if (!map) return;
    map.resize();
    map.easeTo({ center: [2, 30], zoom: 1.2, pitch: terrain3d ? 40 : 0, bearing: 0, duration: 900 });
  };

  return (
    <section className="map-stage" aria-label="Globo mundial de webcams">
      <div ref={hostRef} className="maplibre-host" />
      <div className="map-status" data-ready={ready}>
        <span>{cameras.length.toLocaleString('es-ES')} cámaras</span>
        <span>zoom {zoom.toFixed(1)}</span>
        <span>{status}</span>
        {terrain3d && <span>3D</span>}
        {warning && <span className="map-warning" title={warning}>aviso</span>}
        <button type="button" onClick={reset}>restablecer</button>
      </div>
      {warning && !ready && (
        <div className="map-error-panel" role="alert">
          <strong>No se ha podido iniciar el motor gráfico</strong>
          <span>{warning}</span>
        </div>
      )}
    </section>
  );
}
