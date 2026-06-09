import { state } from './state.js';
import { filteredCams } from './filtering.js';
import { cameraElement, escapeHtml, publicUrl } from './player.js';

const WORLD_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const COUNTRIES = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const UPDATE_MS = 60000;

let viewer;
let markerLayer;
let markers = [];
let currentPreviewCamera = null;
let leafletMap;
let leafletMarker;
let timer;
let countriesLoaded = false;
let controlsBound = false;

const TZ = new Map([
  ['espana', 'Europe/Madrid'], ['spain', 'Europe/Madrid'], ['francia', 'Europe/Paris'], ['france', 'Europe/Paris'],
  ['italia', 'Europe/Rome'], ['italy', 'Europe/Rome'], ['portugal', 'Europe/Lisbon'], ['alemania', 'Europe/Berlin'], ['germany', 'Europe/Berlin'],
  ['reino unido', 'Europe/London'], ['united kingdom', 'Europe/London'], ['japon', 'Asia/Tokyo'], ['japan', 'Asia/Tokyo'],
  ['mexico', 'America/Mexico_City'], ['argentina', 'America/Argentina/Buenos_Aires'], ['chile', 'America/Santiago'],
  ['brasil', 'America/Sao_Paulo'], ['brazil', 'America/Sao_Paulo'], ['marruecos', 'Africa/Casablanca'], ['morocco', 'Africa/Casablanca'],
  ['islandia', 'Atlantic/Reykjavik'], ['iceland', 'Atlantic/Reykjavik']
]);

export function renderMap() {
  const el = document.querySelector('#worldGlobe');
  if (!el) return;
  if (!window.Cesium) return fallback(el);
  if (!viewer) initViewer(el);
  else viewer.resize();
  drawMarkers();
}

function initViewer(el) {
  const C = window.Cesium;
  viewer = new C.Viewer(el, {
    imageryProvider: new C.UrlTemplateImageryProvider({
      url: WORLD_IMAGERY,
      maximumLevel: 19,
      tilingScheme: new C.WebMercatorTilingScheme(),
      credit: 'Esri World Imagery'
    }),
    terrainProvider: new C.EllipsoidTerrainProvider(),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    requestRenderMode: false
  });

  viewer.scene.globe.enableLighting = false;
  viewer.scene.globe.maximumScreenSpaceError = 0.75;
  viewer.scene.globe.tileCacheSize = 1000;
  viewer.scene.globe.preloadAncestors = true;
  viewer.scene.globe.preloadSiblings = true;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 50000000;
  viewer.scene.screenSpaceCameraController.inertiaZoom = 0.08;
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  viewer.camera.setView({
    destination: C.Cartesian3.fromDegrees(2, 35, 23000000),
    orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 }
  });

  markerLayer = document.createElement('div');
  markerLayer.className = 'cesium-marker-layer';
  el.appendChild(markerLayer);
  viewer.scene.postRender.addEventListener(updateMarkerPositions);
  installFastWheel(el);
  bindControls();
  loadCountryBorders();
  timer = setInterval(drawMarkers, UPDATE_MS);
}

function installFastWheel(el) {
  el.addEventListener('wheel', (ev) => {
    if (!viewer || !document.querySelector('#mapView')?.classList.contains('active')) return;
    ev.preventDefault();
    ev.stopPropagation();
    const h = Math.max(viewer.camera.positionCartographic.height, 1);
    if (ev.deltaY < 0) viewer.camera.zoomIn(Math.max(h * 0.62, 2));
    else viewer.camera.zoomOut(Math.max(h * 0.9, 20));
  }, { capture: true, passive: false });
}

async function loadCountryBorders() {
  if (countriesLoaded || !window.topojson) return;
  countriesLoaded = true;
  try {
    const C = window.Cesium;
    const world = await fetch(COUNTRIES).then(r => r.json());
    const geojson = topojson.feature(world, world.objects.countries);
    const ds = await C.GeoJsonDataSource.load(geojson, {
      stroke: C.Color.WHITE.withAlpha(0.45),
      fill: C.Color.TRANSPARENT,
      strokeWidth: 1,
      clampToGround: false
    });
    viewer.dataSources.add(ds);
    for (const e of ds.entities.values) {
      if (e.polygon) {
        e.polygon.material = C.Color.TRANSPARENT;
        e.polygon.outline = true;
        e.polygon.outlineColor = C.Color.WHITE.withAlpha(0.45);
        e.polygon.height = 2500;
      }
    }
  } catch {
    toast('No se han podido cargar las fronteras.');
  }
}

export function drawMarkers() {
  if (!viewer || !markerLayer || !window.Cesium) return;
  markerLayer.innerHTML = '';
  markers = groupCameras(filteredCams(state.catalog, state.settings)).map(p => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `globe-camera-marker ${p.light}`;
    el.title = `${p.camera.title || 'Cámara'} · ${p.local.label}`;
    el.innerHTML = p.count > 1 ? `<span class="camera-count">${p.count}</span>` : '';
    el.addEventListener('pointerdown', e => e.stopPropagation(), { capture: true });
    el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openMapPreview(p.camera);
    }, { capture: true });
    markerLayer.appendChild(el);
    return { ...p, el, pos: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 50) };
  });
  updateStats();
  updateMarkerPositions();
}

function updateMarkerPositions() {
  if (!viewer || !markers.length) return;
  const C = window.Cesium;
  const occ = new C.EllipsoidalOccluder(viewer.scene.globe.ellipsoid, viewer.camera.positionWC);
  for (const m of markers) {
    const screen = occ.isPointVisible(m.pos) ? C.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, m.pos) : null;
    m.el.style.display = screen ? 'block' : 'none';
    if (screen) {
      m.el.style.left = `${screen.x}px`;
      m.el.style.top = `${screen.y}px`;
    }
  }
}

function groupCameras(cams) {
  const map = new Map();
  for (const c of cams) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
    const key = `${Math.round(c.lat * 10) / 10},${Math.round(c.lon * 10) / 10}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }
  return [...map.values()].map(list => {
    const camera = list[0];
    return { camera, count: list.length, lat: camera.lat, lon: camera.lon, light: lightClass(camera.lat, camera.lon), local: localTime(camera) };
  });
}

function openMapPreview(camera) {
  const preview = document.querySelector('#mapPreview');
  const body = document.querySelector('#mapPreviewBody');
  const title = document.querySelector('#mapPreviewTitle');
  const meta = document.querySelector('#mapPreviewMeta');
  const source = document.querySelector('#mapPreviewOpen');
  if (!preview || !body || !title || !meta || !source) return;
  const local = localTime(camera);
  currentPreviewCamera = camera;
  title.textContent = camera.title || 'Cámara';
  meta.textContent = [camera.city, camera.country, camera.category, local.label].filter(Boolean).join(' · ');
  body.innerHTML = cameraElement(camera);
  const url = publicUrl(camera);
  source.href = url || '#';
  source.hidden = !url;
  preview.hidden = false;
  flyTo(camera, 750);
}

function flyTo(camera, height = 900) {
  if (!viewer || !Number.isFinite(camera.lat) || !Number.isFinite(camera.lon)) return;
  const C = window.Cesium;
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(camera.lon, camera.lat, height),
    orientation: { heading: 0, pitch: C.Math.toRadians(-72), roll: 0 },
    duration: 0.75
  });
}

function bindControls() {
  if (controlsBound) return;
  controlsBound = true;
  document.querySelector('#mapPreviewClose')?.addEventListener('click', closePreview);
  document.querySelector('#mapPreviewDeepZoom')?.addEventListener('click', () => currentPreviewCamera && openDeepZoom(currentPreviewCamera));
  document.querySelector('#deepZoomClose')?.addEventListener('click', closeDeepZoom);
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      closePreview();
      closeDeepZoom();
    }
  });
}

function closePreview() {
  const preview = document.querySelector('#mapPreview');
  const body = document.querySelector('#mapPreviewBody');
  if (body) body.innerHTML = '';
  if (preview) preview.hidden = true;
}

function openDeepZoom(camera) {
  const panel = document.querySelector('#deepZoomPanel');
  const mapEl = document.querySelector('#deepZoomMap');
  const title = document.querySelector('#deepZoomTitle');
  const meta = document.querySelector('#deepZoomMeta');
  if (!panel || !mapEl || !title || !meta || !window.L) return;
  const lat = Number(camera.lat);
  const lon = Number(camera.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const local = localTime(camera);
  title.textContent = camera.title || 'Zoom satelital';
  meta.textContent = [camera.city, camera.country, local.label].filter(Boolean).join(' · ');
  panel.hidden = false;
  if (!leafletMap) {
    leafletMap = L.map(mapEl, { maxZoom: 20, minZoom: 2, worldCopyJump: true });
    L.tileLayer(WORLD_IMAGERY, { maxZoom: 20, maxNativeZoom: 19, attribution: 'Esri World Imagery' }).addTo(leafletMap);
  }
  if (leafletMarker) leafletMarker.remove();
  leafletMarker = L.marker([lat, lon]).addTo(leafletMap).bindPopup(escapeHtml(camera.title || 'Cámara'));
  leafletMap.setView([lat, lon], 19, { animate: false });
  setTimeout(() => { leafletMap.invalidateSize(); leafletMarker.openPopup(); }, 80);
}

function closeDeepZoom() {
  const panel = document.querySelector('#deepZoomPanel');
  if (panel) panel.hidden = true;
}

export function resetMap() {
  if (!viewer) return;
  const C = window.Cesium;
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(2, 35, 23000000),
    orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
    duration: 0.7
  });
}

function localTime(camera) {
  const tz = guessTZ(camera);
  if (tz) {
    try {
      const h = new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      return { label: `hora local ${h} (${tz})`, timeZone: tz };
    } catch {}
  }
  const lon = Number(camera.lon);
  if (!Number.isFinite(lon)) return { label: 'hora local no disponible', timeZone: '' };
  const offset = Math.max(-12, Math.min(14, Math.round(lon / 15)));
  const d = new Date(Date.now() + offset * 3600000);
  return { label: `hora local aprox. ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} (UTC${offset >= 0 ? '+' : '-'}${Math.abs(offset)})`, timeZone: '' };
}

function guessTZ(camera) {
  const country = norm(camera.country || '');
  const city = norm(camera.city || '');
  const lon = Number(camera.lon);
  if ((country.includes('espana') || country.includes('spain')) && (city.includes('canarias') || city.includes('tenerife') || city.includes('gran canaria') || city.includes('lanzarote') || city.includes('fuerteventura'))) return 'Atlantic/Canary';
  if (country.includes('espana') || country.includes('spain')) return 'Europe/Madrid';
  if ((country.includes('estados unidos') || country.includes('united states') || country === 'usa') && Number.isFinite(lon)) {
    if (lon < -150) return 'Pacific/Honolulu';
    if (lon < -130) return 'America/Anchorage';
    if (lon < -114) return 'America/Los_Angeles';
    if (lon < -101) return 'America/Denver';
    if (lon < -86) return 'America/Chicago';
    return 'America/New_York';
  }
  return TZ.get(country) || null;
}

function lightClass(lat, lon) {
  const sun = subsolar(new Date());
  const a = vec(lat, lon);
  const b = vec(sun.lat, sun.lng);
  const light = a.x * b.x + a.y * b.y + a.z * b.z;
  if (light > 0.12) return 'is-day';
  if (light > -0.08) return 'is-twilight';
  return 'is-night';
}

function subsolar(date) {
  const y = date.getUTCFullYear();
  const day = Math.floor((Date.UTC(y, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(y, 0, 0)) / 86400000);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const g = 2 * Math.PI / 365 * (day - 1 + (hour - 12) / 24);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const mins = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  return { lat: dec * 180 / Math.PI, lng: wrap((720 - mins - eot) / 4) };
}

function vec(lat, lng) {
  const p = lat * Math.PI / 180;
  const l = lng * Math.PI / 180;
  const c = Math.cos(p);
  return { x: c * Math.cos(l), y: c * Math.sin(l), z: Math.sin(p) };
}

function wrap(lng) {
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
}

function norm(value) {
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function updateStats() {
  const stats = document.querySelector('#mapStats');
  if (stats) stats.textContent = `${markers.length} puntos · Cesium · zoom satelital`;
}

function fallback(container) {
  container.innerHTML = '<div class="empty">No se ha podido cargar Cesium para el globo 3D.</div>';
}

function toast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}
