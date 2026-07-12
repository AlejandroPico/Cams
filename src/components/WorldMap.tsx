import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Camera } from '../types';
import { buildNightGrid, lightState } from '../map/dayNight';
import { createBaseMapStyle, PLACES_URL, SATELLITE_TILES } from '../map/mapStyle';
import { createCameraIcons } from '../map/cameraIcon';

interface Props {
  cameras: Camera[];
  selected: Camera | null;
  onSelect: (camera: Camera | null) => void;
  showLabels: boolean;
  showDayNight: boolean;
}

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

function addSatellite(map: MapLibreMap) {
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
  if (!map.getLayer('satellite')) {
    map.addLayer({
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 24,
      paint: {
        'raster-opacity': 1,
        'raster-resampling': 'linear',
        'raster-fade-duration': 100,
        'raster-contrast': 0.04,
        'raster-saturation': 0.04
      }
    });
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
        'circle-color': ['step', ['get', 'point_count'], '#2e97ff', 50, '#ff911f', 250, '#ffe03f'],
        'circle-radius': ['step', ['get', 'point_count'], 15, 50, 20, 250, 27, 1000, 34],
        'circle-stroke-color': 'rgba(0,0,0,.92)',
        'circle-stroke-width': 3,
        'circle-opacity': 0.96
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
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3.7, 6, 4.8, 12, 6.2, 18, 7.5],
        'circle-stroke-color': '#020305',
        'circle-stroke-width': 2,
        'circle-opacity': 0.98
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
        'fill-color': '#020814',
        'fill-opacity': [
          '*',
          ['coalesce', ['get', 'shade'], 0],
          ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 0.82, 11, 0.28, 13, 0]
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
        'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.2, 5, 0.27, 12, 0.36, 18, 0.44],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'center'
      }
    });
    if (map.getLayer('camera-dots')) map.setLayoutProperty('camera-dots', 'visibility', 'none');
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
        'text-halo-color': 'rgba(0,0,0,.92)',
        'text-halo-width': 1.5
      }
    });
  }
}

export function WorldMap({ cameras, selected, onSelect, showLabels, showDayNight }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const cameraIndexRef = useRef(new Map<string, Camera>());
  const labelsRef = useRef(showLabels);
  const dayNightRef = useRef(showDayNight);
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

      try { addSatellite(map); } catch (error) { console.warn('Satélite no disponible:', error); }
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
      setStatus('globo activo');
      map.resize();
    };

    map.on('style.load', boot);
    map.on('load', boot);
    map.on('styledata', boot);
    window.setTimeout(boot, 0);
    window.setTimeout(boot, 250);
    window.setTimeout(boot, 1000);

    map.on('sourcedata', (event) => {
      if (event.sourceId === 'satellite' && event.isSourceLoaded) setStatus('satélite activo');
    });
    map.on('error', (event) => {
      const detail = event as unknown as { sourceId?: string; error?: Error };
      const message = detail.error?.message || '';
      if (detail.sourceId === 'satellite' || message.includes('arcgisonline')) {
        setStatus('globo cartográfico activo');
        setWarning('La fotografía satelital no respondió; el globo base continúa disponible.');
        if (map.getLayer('satellite')) map.setLayoutProperty('satellite', 'visibility', 'none');
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
      pitch: 45,
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
    map.easeTo({ center: [2, 30], zoom: 1.2, pitch: 0, bearing: 0, duration: 900 });
  };

  return (
    <section className="map-stage" aria-label="Globo mundial de webcams">
      <div ref={hostRef} className="maplibre-host" />
      <div className="map-status" data-ready={ready}>
        <span>{cameras.length.toLocaleString('es-ES')} cámaras</span>
        <span>zoom {zoom.toFixed(1)}</span>
        <span>{status}</span>
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
