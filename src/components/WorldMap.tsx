import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Camera } from '../types';
import { buildNightGrid, lightState } from '../map/dayNight';
import { createMapStyle, FALLBACK_MAP, PLACES_URL } from '../map/mapStyle';
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
        category: camera.category
      }
    }))
  };
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function addCameraImages(map: MapLibreMap) {
  const icons = await withTimeout(createCameraIcons(), 4_000, 'El icono de cámara no terminó de cargar');
  for (const [variant, image] of Object.entries(icons)) {
    const name = `camera-${variant}`;
    if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 });
  }
}

function addClusterCountLayer(map: MapLibreMap) {
  if (map.getLayer('cluster-count')) return;
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'cameras',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Regular'],
      'text-size': 11
    },
    paint: {
      'text-color': '#030405',
      'text-halo-color': 'rgba(255,255,255,0.3)',
      'text-halo-width': 0.5
    }
  });
}

function addCameraIconLayer(map: MapLibreMap) {
  if (map.getLayer('camera-icons')) return;
  map.addLayer({
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
  });
  if (map.getLayer('camera-dots')) map.setLayoutProperty('camera-dots', 'visibility', 'none');
}

function addPlaceLayers(map: MapLibreMap, visible: boolean) {
  if (!map.getSource('places')) {
    map.addSource('places', {
      type: 'geojson',
      data: PLACES_URL,
      attribution: 'Localidades © Natural Earth'
    });
  }

  const visibility = visible ? 'visible' : 'none';
  if (!map.getLayer('place-labels-major')) {
    map.addLayer({
      id: 'place-labels-major',
      type: 'symbol',
      source: 'places',
      minzoom: 2.2,
      maxzoom: 24,
      filter: ['<=', ['to-number', ['get', 'scalerank']], 4],
      layout: {
        visibility,
        'text-field': ['coalesce', ['get', 'name'], ['get', 'nameascii']],
        'text-font': ['Open Sans Regular'],
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
    });
  }

  if (!map.getLayer('place-labels-secondary')) {
    map.addLayer({
      id: 'place-labels-secondary',
      type: 'symbol',
      source: 'places',
      minzoom: 5.4,
      maxzoom: 24,
      filter: ['all', ['>', ['to-number', ['get', 'scalerank']], 4], ['<=', ['to-number', ['get', 'scalerank']], 8]],
      layout: {
        visibility,
        'text-field': ['coalesce', ['get', 'name'], ['get', 'nameascii']],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 10, 12, 16, 14],
        'text-allow-overlap': false,
        'text-ignore-placement': false
      },
      paint: {
        'text-color': '#edf3ff',
        'text-halo-color': 'rgba(0,0,0,0.9)',
        'text-halo-width': 1.25,
        'text-halo-blur': 0.3
      }
    });
  }
}

function enableFallbackMap(map: MapLibreMap) {
  if (!map.getSource('fallback-map')) {
    map.addSource('fallback-map', {
      type: 'raster',
      tiles: [FALLBACK_MAP],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
    });
  }
  if (!map.getLayer('fallback-map')) {
    map.addLayer({
      id: 'fallback-map',
      type: 'raster',
      source: 'fallback-map',
      minzoom: 0,
      maxzoom: 24,
      paint: { 'raster-opacity': 1, 'raster-fade-duration': 80 }
    }, 'night-shade');
  }
  if (map.getLayer('satellite')) map.setPaintProperty('satellite', 'raster-opacity', 0);
}

export function WorldMap({ cameras, selected, onSelect, showLabels, showDayNight }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const cameraIndexRef = useRef(new Map<string, Camera>());
  const labelsRef = useRef(showLabels);
  const dayNightRef = useRef(showDayNight);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1.25);
  const [status, setStatus] = useState('preparando motor');
  const [mapWarning, setMapWarning] = useState('');
  const cameraData = useMemo(() => toGeoJson(cameras), [cameras]);

  useEffect(() => {
    cameraIndexRef.current = new Map(cameras.map((camera) => [camera.id, camera]));
  }, [cameras]);

  useEffect(() => {
    labelsRef.current = showLabels;
  }, [showLabels]);

  useEffect(() => {
    dayNightRef.current = showDayNight;
  }, [showDayNight]);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    if (!maplibregl.supported()) {
      setMapWarning('Este navegador no dispone del WebGL necesario para mostrar el globo.');
      setStatus('WebGL no disponible');
      return;
    }

    let map: MapLibreMap;
    let disposed = false;
    let styleReady = false;
    let baseInteractionsBound = false;
    let iconInteractionsBound = false;
    let satelliteLoaded = false;
    let satelliteErrors = 0;
    let satelliteWatchdog: number | undefined;

    try {
      map = new maplibregl.Map({
        container: hostRef.current,
        style: createMapStyle(),
        center: [2, 32],
        zoom: 1.25,
        minZoom: 0.3,
        maxZoom: 22,
        pitch: 0,
        bearing: 0,
        renderWorldCopies: false,
        attributionControl: false,
        cooperativeGestures: false,
        fadeDuration: 80
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar MapLibre';
      setMapWarning(message);
      setStatus('error al iniciar el mapa');
      return;
    }

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.scrollZoom.setWheelZoomRate(1 / 280);
    map.touchZoomRotate.enable();

    const selectCamera = (event: MapLayerMouseEvent) => {
      const id = String(event.features?.[0]?.properties?.id || '');
      const camera = cameraIndexRef.current.get(id);
      if (camera) onSelect(camera);
    };

    const bindPointerLayer = (layer: string) => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    };

    const activateFallback = (reason: string) => {
      if (disposed || !map.isStyleLoaded() || map.getLayer('fallback-map')) return;
      try {
        enableFallbackMap(map);
        setStatus('mapa de respaldo activo');
        setMapWarning(reason);
      } catch (error) {
        console.error('No se pudo activar el mapa de respaldo:', error);
      }
    };

    const bindBaseInteractions = () => {
      if (baseInteractionsBound) return;
      baseInteractionsBound = true;

      map.on('click', 'clusters', async (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') return;
        const clusterId = Number(feature.properties?.cluster_id);
        const cameraSource = map.getSource('cameras') as maplibregl.GeoJSONSource;
        try {
          const expansionZoom = await cameraSource.getClusterExpansionZoom(clusterId);
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom: Math.min(expansionZoom, 18),
            duration: 650
          });
        } catch (error) {
          console.warn('No se pudo expandir el grupo de cámaras:', error);
        }
      });

      map.on('click', 'camera-dots', selectCamera);
      bindPointerLayer('clusters');
      bindPointerLayer('camera-dots');
    };

    const installOptionalLayers = async () => {
      try {
        addClusterCountLayer(map);
      } catch (error) {
        console.warn('No se pudo añadir el contador de grupos:', error);
      }

      try {
        await addCameraImages(map);
        if (disposed || !map.getStyle()) return;
        addCameraIconLayer(map);
        if (!iconInteractionsBound) {
          iconInteractionsBound = true;
          map.on('click', 'camera-icons', selectCamera);
          bindPointerLayer('camera-icons');
        }
      } catch (error) {
        console.warn('Se mantienen marcadores simplificados porque el icono no pudo cargarse:', error);
      }

      try {
        if (!disposed && map.getStyle()) addPlaceLayers(map, labelsRef.current);
      } catch (error) {
        console.warn('Las etiquetas de localidades no están disponibles:', error);
      }
    };

    map.on('style.load', () => {
      if (disposed) return;
      styleReady = true;
      setReady(true);
      setStatus('cargando teselas satélite');
      setMapWarning('');

      try {
        map.setProjection({ type: 'globe' });
      } catch (error) {
        console.warn('La proyección de globo no está disponible; se conserva Mercator:', error);
        setMapWarning('El navegador ha activado el mapa plano de respaldo porque no admite la proyección de globo.');
      }

      const cameraSource = map.getSource('cameras') as maplibregl.GeoJSONSource | undefined;
      cameraSource?.setData(toGeoJson([...cameraIndexRef.current.values()]));
      const nightSource = map.getSource('night') as maplibregl.GeoJSONSource | undefined;
      nightSource?.setData(buildNightGrid());
      if (map.getLayer('night-shade')) {
        map.setLayoutProperty('night-shade', 'visibility', dayNightRef.current ? 'visible' : 'none');
      }

      bindBaseInteractions();
      void installOptionalLayers();
      window.setTimeout(() => map.resize(), 0);

      if (satelliteWatchdog) window.clearTimeout(satelliteWatchdog);
      satelliteWatchdog = window.setTimeout(() => {
        if (!satelliteLoaded) {
          activateFallback('Las teselas satelitales no respondieron a tiempo y se ha activado temporalmente el mapa cartográfico de respaldo.');
        }
      }, 12_000);
    });

    map.on('load', () => {
      if (disposed) return;
      setReady(true);
      setStatus(satelliteLoaded ? 'satélite activo' : 'mapa listo');
    });

    map.on('sourcedata', (event) => {
      if (event.sourceId === 'satellite' && event.isSourceLoaded) {
        satelliteLoaded = true;
        if (satelliteWatchdog) window.clearTimeout(satelliteWatchdog);
        setStatus('satélite activo');
      }
    });

    map.on('error', (event) => {
      const detail = event as unknown as { sourceId?: string; error?: Error };
      const message = detail.error?.message || 'Error cartográfico no identificado';
      console.error('MapLibre:', message);

      if (detail.sourceId === 'satellite' || message.includes('arcgisonline')) {
        satelliteErrors += 1;
        if (!satelliteLoaded && satelliteErrors >= 5) {
          activateFallback('Las teselas satelitales no respondieron y se ha activado temporalmente el mapa cartográfico de respaldo.');
        }
      }
    });

    map.on('zoom', () => setZoom(map.getZoom()));

    const watchdog = window.setTimeout(() => {
      if (!disposed && !styleReady) {
        setReady(false);
        setStatus('el estilo del mapa no respondió');
        setMapWarning('MapLibre no ha podido completar la inicialización. Recarga la página para reintentar.');
      }
    }, 10_000);

    const timer = window.setInterval(() => {
      if (!map.isStyleLoaded()) return;
      const source = map.getSource('cameras') as maplibregl.GeoJSONSource | undefined;
      const night = map.getSource('night') as maplibregl.GeoJSONSource | undefined;
      source?.setData(toGeoJson([...cameraIndexRef.current.values()]));
      night?.setData(buildNightGrid());
    }, 60_000);

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(hostRef.current);

    return () => {
      disposed = true;
      window.clearTimeout(watchdog);
      if (satelliteWatchdog) window.clearTimeout(satelliteWatchdog);
      window.clearInterval(timer);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    const source = map.getSource('cameras') as maplibregl.GeoJSONSource | undefined;
    source?.setData(cameraData);
  }, [cameraData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    const visibility = showLabels ? 'visible' : 'none';
    for (const layer of ['place-labels-major', 'place-labels-secondary']) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility);
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
      zoom: Math.max(map.getZoom(), 11),
      pitch: 42,
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
    map.easeTo({ center: [2, 32], zoom: 1.25, pitch: 0, bearing: 0, duration: 900 });
  };

  return (
    <section className="map-stage" aria-label="Globo satelital de webcams">
      <div ref={hostRef} className="maplibre-host" />
      <div className="map-status" data-ready={ready}>
        <span>{cameras.length.toLocaleString('es-ES')} cámaras</span>
        <span>zoom {zoom.toFixed(1)}</span>
        <span>{status}</span>
        {mapWarning && <span className="map-warning" title={mapWarning}>aviso</span>}
        <button type="button" onClick={reset}>restablecer</button>
      </div>
      {mapWarning && !ready && (
        <div className="map-error-panel" role="alert">
          <strong>No se ha podido mostrar el globo</strong>
          <span>{mapWarning}</span>
          <button type="button" onClick={() => window.location.reload()}>reintentar</button>
        </div>
      )}
    </section>
  );
}
