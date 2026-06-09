import { state } from './state.js';
import { filteredCams } from './filtering.js';
import { cameraElement, escapeHtml, publicUrl } from './player.js';

const COUNTRY_TOPOLOGY_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const SATELLITE_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BUMP_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
const NIGHT_SKY_URL = 'https://unpkg.com/three-globe/example/img/night-sky.png';
const WORLD_IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const DAY_NIGHT_UPDATE_MS = 60_000;

let globe = null;
let countryFeatures = null;
let currentSize = { width: 0, height: 0 };
let leafletMap = null;
let leafletMarker = null;
let currentPreviewCamera = null;
let controlsBound = false;
let dayNightTimer = null;
let lastPointCount = 0;

export function renderMap() {
  const container = document.querySelector('#worldGlobe');
  if (!container) return;

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  if (!window.Globe || !window.d3 || !window.topojson) {
    renderFallbackMap(container, width, height);
    return;
  }

  if (globe) {
    if (width !== currentSize.width || height !== currentSize.height) {
      globe.width(width).height(height);
      currentSize = { width, height };
    }
    drawMarkers();
    drawDayNightGuide();
    return;
  }

  container.innerHTML = '';

  globe = Globe()(container)
    .width(width)
    .height(height)
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl(SATELLITE_TEXTURE_URL)
    .bumpImageUrl(BUMP_TEXTURE_URL)
    .backgroundImageUrl(NIGHT_SKY_URL)
    .showAtmosphere(true)
    .atmosphereColor('#7cc7ff')
    .atmosphereAltitude(0.1)
    .pointLat('lat')
    .pointLng('lon')
    .pointColor(() => '#7cc7ff')
    .pointAltitude((point) => 0.018 + Math.min(point.count, 8) * 0.0025)
    .pointRadius((point) => Math.min(0.32, 0.14 + Math.log2(point.count + 1) * 0.035))
    .pointLabel((point) => point.label)
    .onPointClick((point) => openMapPreview(point.camera))
    .onGlobeClick(({ lat, lng }) => openDeepZoom({
      title: 'Zona seleccionada',
      city: 'Zoom satelital',
      country: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      category: 'detalle',
      lat,
      lon: lng
    }))
    .polygonAltitude(0.004)
    .polygonCapColor(() => 'rgba(124,199,255,0.018)')
    .polygonSideColor(() => 'rgba(124,199,255,0.01)')
    .polygonStrokeColor(() => 'rgba(190,224,255,0.62)')
    .polygonsTransitionDuration(0)
    .pathsData([])
    .pathPoints('coords')
    .pathPointLat((point) => point[0])
    .pathPointLng((point) => point[1])
    .pathPointAlt(() => 0.018)
    .pathColor((path) => path.color)
    .pathStroke((path) => path.stroke);

  currentSize = { width, height };
  tuneRenderer();
  tuneControls();
  globe.pointOfView({ lat: 23, lng: 12, altitude: 2.35 }, 0);

  state.d3State = { globe, width, height };
  bindMapControls();
  hydrateCountries();
  drawMarkers();
  startDayNightGuide();
}

function tuneRenderer() {
  try {
    const renderer = globe.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
  } catch {}

  if (typeof globe.pointResolution === 'function') globe.pointResolution(7);
  if (typeof globe.polygonCapCurvatureResolution === 'function') globe.polygonCapCurvatureResolution(6);
}

function tuneControls() {
  const controls = globe.controls();
  controls.enableDamping = true;
  controls.dampingFactor = 0.045;
  controls.rotateSpeed = 0.34;
  controls.zoomSpeed = 1.05;
  controls.minDistance = 104;
  controls.maxDistance = 900;
}

async function hydrateCountries() {
  if (!globe || !window.d3 || !window.topojson) return;
  try {
    if (!countryFeatures) {
      const world = await d3.json(COUNTRY_TOPOLOGY_URL);
      countryFeatures = topojson.feature(world, world.objects.countries).features;
    }
    globe.polygonsData(countryFeatures);
  } catch {
    toast('No se han podido cargar las fronteras de países.');
  }
}

export function drawMarkers() {
  if (!globe) return;

  const grouped = groupCameraPoints(
    filteredCams(state.catalog, state.settings)
      .filter((camera) => Number.isFinite(camera.lat) && Number.isFinite(camera.lon))
  );

  lastPointCount = grouped.length;
  globe.pointsData(grouped);
  updateMapStats();
}

function groupCameraPoints(cameras) {
  const grouped = new Map();
  for (const camera of cameras) {
    const key = `${Math.round(camera.lat * 10) / 10},${Math.round(camera.lon * 10) / 10}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(camera);
  }

  return [...grouped.values()].map((list) => {
    const camera = list[0];
    return {
      camera,
      count: list.length,
      lat: camera.lat,
      lon: camera.lon,
      label: `<b>${escapeHtml(camera.city || camera.country)}</b><br>${list.length} cámara${list.length === 1 ? '' : 's'}<br>${escapeHtml(camera.country)}`
    };
  });
}

function openMapPreview(camera) {
  const preview = document.querySelector('#mapPreview');
  const body = document.querySelector('#mapPreviewBody');
  const title = document.querySelector('#mapPreviewTitle');
  const meta = document.querySelector('#mapPreviewMeta');
  const source = document.querySelector('#mapPreviewOpen');
  if (!preview || !body || !title || !meta || !source || !camera) return;

  currentPreviewCamera = camera;
  title.textContent = camera.title || 'Cámara';
  meta.textContent = [camera.city, camera.country, camera.category].filter(Boolean).join(' · ');
  body.innerHTML = cameraElement(camera);
  const url = publicUrl(camera);
  source.href = url || '#';
  source.hidden = !url;
  preview.hidden = false;

  if (globe && Number.isFinite(camera.lat) && Number.isFinite(camera.lon)) {
    globe.pointOfView({ lat: camera.lat, lng: camera.lon, altitude: 0.28 }, 900);
  }
}

function closeMapPreview() {
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
  if (!panel || !mapEl || !title || !meta || !camera) return;

  const lat = Number(camera.lat);
  const lon = Number(camera.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    toast('Esta cámara no tiene coordenadas válidas para zoom satelital.');
    return;
  }

  title.textContent = camera.title || 'Zoom satelital';
  meta.textContent = [camera.city, camera.country].filter(Boolean).join(' · ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  panel.hidden = false;

  if (!window.L) {
    mapEl.innerHTML = '<div class="empty">Leaflet no está disponible para el zoom profundo.</div>';
    return;
  }

  if (!leafletMap) {
    leafletMap = L.map(mapEl, {
      zoomControl: true,
      attributionControl: true,
      maxZoom: 20,
      minZoom: 2,
      worldCopyJump: true
    });

    L.tileLayer(WORLD_IMAGERY_TILES, {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: 'Tiles © Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }).addTo(leafletMap);
  }

  if (leafletMarker) leafletMarker.remove();
  leafletMarker = L.marker([lat, lon]).addTo(leafletMap);
  leafletMarker.bindPopup(escapeHtml(camera.title || 'Zona seleccionada'));

  leafletMap.setView([lat, lon], 18, { animate: false });
  setTimeout(() => {
    leafletMap.invalidateSize();
    leafletMarker?.openPopup();
  }, 80);
}

function closeDeepZoom() {
  const panel = document.querySelector('#deepZoomPanel');
  if (panel) panel.hidden = true;
}

function bindMapControls() {
  if (controlsBound) return;
  controlsBound = true;

  document.querySelector('#mapPreviewClose')?.addEventListener('click', closeMapPreview);
  document.querySelector('#mapPreviewDeepZoom')?.addEventListener('click', () => {
    if (currentPreviewCamera) openDeepZoom(currentPreviewCamera);
  });
  document.querySelector('#deepZoomClose')?.addEventListener('click', closeDeepZoom);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMapPreview();
      closeDeepZoom();
    }
  }, { passive: true });
}

function startDayNightGuide() {
  clearInterval(dayNightTimer);
  drawDayNightGuide();
  dayNightTimer = setInterval(drawDayNightGuide, DAY_NIGHT_UPDATE_MS);
}

function drawDayNightGuide() {
  if (!globe) return;
  const sun = getSubsolarPoint(new Date());
  const terminator = buildTerminator(sun.lat, sun.lng, 181);
  globe.pathsData([{
    type: 'terminator',
    coords: terminator,
    color: 'rgba(255,226,146,0.92)',
    stroke: 0.82
  }]);
  updateMapStats(sun);
}

function getSubsolarPoint(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gamma = 2 * Math.PI / 365 * (dayOfYear - 1 + (utcHours - 12) / 24);

  const equationOfTime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const lng = normalizeLng((720 - utcMinutes - equationOfTime) / 4);
  return { lat: radiansToDegrees(declination), lng };
}

function buildTerminator(sunLat, sunLng, steps = 181) {
  const s = latLngToVector(sunLat, sunLng);
  const reference = Math.abs(s.z) < 0.88 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const u = normalize(cross(s, reference));
  const v = normalize(cross(s, u));
  const coords = [];

  for (let i = 0; i <= steps; i++) {
    const theta = 2 * Math.PI * i / steps;
    const p = {
      x: Math.cos(theta) * u.x + Math.sin(theta) * v.x,
      y: Math.cos(theta) * u.y + Math.sin(theta) * v.y,
      z: Math.cos(theta) * u.z + Math.sin(theta) * v.z
    };
    coords.push([radiansToDegrees(Math.asin(p.z)), radiansToDegrees(Math.atan2(p.y, p.x))]);
  }

  return coords;
}

function latLngToVector(lat, lng) {
  const phi = degreesToRadians(lat);
  const lambda = degreesToRadians(lng);
  const cosPhi = Math.cos(phi);
  return {
    x: cosPhi * Math.cos(lambda),
    y: cosPhi * Math.sin(lambda),
    z: Math.sin(phi)
  };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function normalize(v) {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function radiansToDegrees(value) {
  return value * 180 / Math.PI;
}

function normalizeLng(value) {
  let lng = value;
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
}

function renderFallbackMap(container, width, height) {
  container.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Mapa de cámaras en modo fallback');

  const background = document.createElementNS(ns, 'rect');
  background.setAttribute('width', width);
  background.setAttribute('height', height);
  background.setAttribute('fill', 'var(--map-water)');
  svg.appendChild(background);

  const cameras = filteredCams(state.catalog, state.settings);
  for (const camera of cameras) {
    const x = (camera.lon + 180) / 360 * width;
    const y = (90 - camera.lat) / 180 * height;
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'map-marker');
    g.setAttribute('transform', `translate(${x},${y})`);
    g.innerHTML = `<circle class="outer" r="12"></circle><circle class="inner" r="4.5"></circle><text class="map-label" x="9" y="3">${escapeHtml(camera.city || camera.country)}</text>`;
    g.addEventListener('click', () => openMapPreview(camera));
    svg.appendChild(g);
  }

  container.appendChild(svg);
  bindMapControls();
  updateMapStats();
  toast('Globo 3D no disponible; se muestra fallback plano.');
}

export function resetMap() {
  if (!globe) return;
  globe.pointOfView({ lat: 23, lng: 12, altitude: 2.35 }, 650);
}

function updateMapStats(sun = null) {
  const stats = document.querySelector('#mapStats');
  if (!stats) return;
  const suffix = sun ? ` · día/noche ${sun.lat.toFixed(1)}°, ${sun.lng.toFixed(1)}°` : '';
  stats.textContent = `${lastPointCount} puntos · globo 3D${suffix}`;
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}
