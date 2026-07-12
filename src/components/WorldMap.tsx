import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Camera } from '../types';
import { buildNightGrid, lightState } from '../map/dayNight';
import { createMapStyle } from '../map/mapStyle';
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

async function addCameraImages(map: MapLibreMap) {
  const icons = await createCameraIcons();
  for (const [variant, image] of Object.entries(icons)) {
    const name = `camera-${variant}`;
    if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 });
  }
}

export function WorldMap({ cameras, selected, onSelect, showLabels, showDayNight }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const cameraIndexRef = useRef(new Map<string, Camera>());
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1.25);
  const cameraData = useMemo(() => toGeoJson(cameras), [cameras]);

  useEffect(() => {
    cameraIndexRef.current = new Map(cameras.map((camera) => [camera.id, camera]));
  }, [cameras]);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
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

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', async () => {
      try {
        map.setProjection({ type: 'globe' });
      } catch {
        // Navegadores antiguos conservan el mapa teselado en Mercator.
      }
      await addCameraImages(map);
      const source = map.getSource('cameras') as maplibregl.GeoJSONSource | undefined;
      source?.setData(cameraData);
      const night = map.getSource('night') as maplibregl.GeoJSONSource | undefined;
      night?.setData(buildNightGrid());

      map.on('click', 'clusters', async (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') return;
        const clusterId = Number(feature.properties?.cluster_id);
        const cameraSource = map.getSource('cameras') as maplibregl.GeoJSONSource;
        const expansionZoom = await cameraSource.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: expansionZoom, duration: 650 });
      });

      map.on('click', 'camera-icons', (event) => {
        const id = String(event.features?.[0]?.properties?.id || '');
        const camera = cameraIndexRef.current.get(id);
        if (camera) onSelect(camera);
      });

      for (const layer of ['clusters', 'cluster-count', 'camera-icons']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }
      setReady(true);
    });

    map.on('zoom', () => setZoom(map.getZoom()));

    const timer = window.setInterval(() => {
      const source = map.getSource('cameras') as maplibregl.GeoJSONSource | undefined;
      const night = map.getSource('night') as maplibregl.GeoJSONSource | undefined;
      source?.setData(toGeoJson([...cameraIndexRef.current.values()]));
      night?.setData(buildNightGrid());
    }, 60_000);

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(hostRef.current);

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('cameras') as maplibregl.GeoJSONSource | undefined;
    source?.setData(cameraData);
  }, [cameraData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const labelVisibility = showLabels ? 'visible' : 'none';
    for (const layer of ['place-labels-major', 'place-labels-secondary']) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', labelVisibility);
    }
    if (map.getLayer('night-shade')) {
      map.setLayoutProperty('night-shade', 'visibility', showDayNight ? 'visible' : 'none');
    }
  }, [showLabels, showDayNight, ready]);

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
    mapRef.current?.easeTo({ center: [2, 32], zoom: 1.25, pitch: 0, bearing: 0, duration: 900 });
  };

  return (
    <section className="map-stage" aria-label="Globo satelital de webcams">
      <div ref={hostRef} className="maplibre-host" />
      <div className="map-status">
        <span>{cameras.length.toLocaleString('es-ES')} cámaras</span>
        <span>zoom {zoom.toFixed(1)}</span>
        <span>{ready ? 'satélite activo' : 'cargando globo'}</span>
        <button type="button" onClick={reset}>restablecer</button>
      </div>
    </section>
  );
}
