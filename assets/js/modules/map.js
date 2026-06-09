import { state } from './state.js';
import { filteredCams } from './filtering.js';
import { cameraElement, escapeHtml, publicUrl } from './player.js';

const COUNTRY_TOPOLOGY_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const SATELLITE_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg';
const BUMP_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';
const NIGHT_SKY_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png';
const WORLD_IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const MARKER_LIGHT_UPDATE_MS = 60_000;

const COUNTRY_TIME_ZONES = new Map([
  ['espana', 'Europe/Madrid'], ['spain', 'Europe/Madrid'],
  ['andorra', 'Europe/Andorra'], ['francia', 'Europe/Paris'], ['france', 'Europe/Paris'],
  ['italia', 'Europe/Rome'], ['italy', 'Europe/Rome'], ['portugal', 'Europe/Lisbon'],
  ['reino unido', 'Europe/London'], ['united kingdom', 'Europe/London'], ['uk', 'Europe/London'],
  ['irlanda', 'Europe/Dublin'], ['ireland', 'Europe/Dublin'], ['alemania', 'Europe/Berlin'], ['germany', 'Europe/Berlin'],
  ['paises bajos', 'Europe/Amsterdam'], ['netherlands', 'Europe/Amsterdam'], ['belgica', 'Europe/Brussels'], ['belgium', 'Europe/Brussels'],
  ['suiza', 'Europe/Zurich'], ['switzerland', 'Europe/Zurich'], ['austria', 'Europe/Vienna'], ['grecia', 'Europe/Athens'], ['greece', 'Europe/Athens'],
  ['noruega', 'Europe/Oslo'], ['norway', 'Europe/Oslo'], ['suecia', 'Europe/Stockholm'], ['sweden', 'Europe/Stockholm'],
  ['finlandia', 'Europe/Helsinki'], ['finland', 'Europe/Helsinki'], ['dinamarca', 'Europe/Copenhagen'], ['denmark', 'Europe/Copenhagen'],
  ['islandia', 'Atlantic/Reykjavik'], ['iceland', 'Atlantic/Reykjavik'],
  ['marruecos', 'Africa/Casablanca'], ['morocco', 'Africa/Casablanca'], ['sudafrica', 'Africa/Johannesburg'], ['south africa', 'Africa/Johannesburg'],
  ['japon', 'Asia/Tokyo'], ['japan', 'Asia/Tokyo'], ['china', 'Asia/Shanghai'], ['corea del sur', 'Asia/Seoul'], ['south korea', 'Asia/Seoul'],
  ['india', 'Asia/Kolkata'], ['tailandia', 'Asia/Bangkok'], ['thailand', 'Asia/Bangkok'], ['singapur', 'Asia/Singapore'], ['singapore', 'Asia/Singapore'],
  ['emiratos arabes unidos', 'Asia/Dubai'], ['united arab emirates', 'Asia/Dubai'], ['turquia', 'Europe/Istanbul'], ['turkey', 'Europe/Istanbul'],
  ['mexico', 'America/Mexico_City'], ['argentina', 'America/Argentina/Buenos_Aires'], ['chile', 'America/Santiago'], ['colombia', 'America/Bogota'], ['peru', 'America/Lima'],
  ['brasil', 'America/Sao_Paulo'], ['brazil', 'America/Sao_Paulo'], ['uruguay', 'America/Montevideo'],
  ['nueva zelanda', 'Pacific/Auckland'], ['new zealand', 'Pacific/Auckland']
]);

let globe = null;
let countryFeatures = null;
let currentSize = { width: 0, height: 0 };
let leafletMap = null;
let leafletMarker = null;
let currentPreviewCamera = null;
let controlsBound = false;
let markerTimer = null;
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
    .pointsData([])
    .htmlElementsData([])
    .htmlLat('lat')
    .htmlLng('lon')
    .htmlAltitude(() => 0.024)
    .htmlElement((point) => createCameraMarker(point))
    .polygonAltitude(0.004)
    .polygonCapColor(() => 'rgba(124,199,255,0.018)')
    .polygonSideColor(() => 'rgba(124,199,255,0.01)')
    .polygonStrokeColor(() => 'rgba(190,224,255,0.62)')
    .polygonsTransitionDuration(0)
    .pathsData([]);

  currentSize = { width, height };
  tuneRenderer();
  tuneControls();
  globe.pointOfView({ lat: 23, lng: 12, altitude: 2.35 }, 0);

  state.d3State = { globe, width, height };
  bindMapControls();
  hydrateCountries();
  drawMarkers();
  startMarkerLightUpdates();
}

function tuneRenderer() {
  try {
    const renderer = globe.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45));
  } catch {}

  try {
    const material = globe.globeMaterial?.();
    if (material) material.anisotropy = 8;
  } catch {}

  if (typeof globe.pointResolution === 'function') globe.pointResolution(7);
  if (typeof globe.polygonCapCurvatureResolution === 'function') globe.polygonCapCurvatureResolution(6);
}

function tuneControls() {
  const controls = globe.controls();
  controls.enableDamping = true;
  controls.dampingFactor = 0.045;
  controls.rotateSpeed = 0.34;
  controls.zoomSpeed = 1.25;
  controls.minDistance = 101.15;
  controls.maxDistance = 1100;
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
  globe.pointsData([]);
  globe.htmlElementsData(grouped);
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
    const local = getLocalTime(camera);
    return {
      camera,
      count: list.length,
      lat: camera.lat,
      lon: camera.lon,
      light: getLightClass(camera.lat, camera.lon),
      local,
      label: `<b>${escapeHtml(camera.city || camera.country)}</b><br>${list.length} cámara${list.length === 1 ? '' : 's'}<br>${escapeHtml(camera.country)}<br>${escapeHtml(local.label)}`
    };
  });
}

function createCameraMarker(point) {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = `globe-camera-marker ${point.light}`;
  marker.title = `${point.camera.title || 'Cámara'} · ${point.local.label}`;
  marker.setAttribute('aria-label', marker.title);
  marker.style.pointerEvents = 'auto';
  marker.innerHTML = point.count > 1 ? `<span class="camera-count">${point.count}</span>` : '';

  for (const type of ['pointerdown', 'mousedown', 'touchstart']) {
    marker.addEventListener(type, (event) => event.stopPropagation(), { capture: true });
  }

  marker.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openMapPreview(point.camera);
  }, { capture: true });

  return marker;
}

function openMapPreview(camera) {
  const preview = document.querySelector('#mapPreview');
  const body = document.querySelector('#mapPreviewBody');
  const title = document.querySelector('#mapPreviewTitle');
  const meta = document.querySelector('#mapPreviewMeta');
  const source = document.querySelector('#mapPreviewOpen');
  if (!preview || !body || !title || !meta || !source || !camera) return;

  const local = getLocalTime(camera);
  currentPreviewCamera = camera;
  title.textContent = camera.title || 'Cámara';
  meta.textContent = [camera.city, camera.country, camera.category, local.label].filter(Boolean).join(' · ');
  body.innerHTML = cameraElement(camera);
  const url = publicUrl(camera);
  source.href = url || '#';
  source.hidden = !url;
  preview.hidden = false;

  if (globe && Number.isFinite(camera.lat) && Number.isFinite(camera.lon)) {
    globe.pointOfView({ lat: camera.lat, lng: camera.lon, altitude: 0.12 }, 900);
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

  const local = getLocalTime(camera);
  title.textContent = camera.title || 'Zoom satelital';
  meta.textContent = [camera.city, camera.country, local.label].filter(Boolean).join(' · ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
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

  leafletMap.setView([lat, lon], 19, { animate: false });
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

function startMarkerLightUpdates() {
  clearInterval(markerTimer);
  markerTimer = setInterval(drawMarkers, MARKER_LIGHT_UPDATE_MS);
}

function getSubsolarPoint(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gamma = 2 * Math.PI / 365 * (dayOfYear - 1 + (utcHours - 12) / 24);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const lng = normalizeLng((720 - utcMinutes - equationOfTime) / 4);
  return { lat: radiansToDegrees(declination), lng };
}

function getLightClass(lat, lon) {
  const sun = getSubsolarPoint(new Date());
  const cameraVector = latLngToVector(lat, lon);
  const sunVector = latLngToVector(sun.lat, sun.lng);
  const illumination = cameraVector.x * sunVector.x + cameraVector.y * sunVector.y + cameraVector.z * sunVector.z;
  if (illumination > 0.12) return 'is-day';
  if (illumination > -0.08) return 'is-twilight';
  return 'is-night';
}

function getLocalTime(camera) {
  const timeZone = guessTimeZone(camera);
  if (timeZone) {
    try {
      const formatted = new Intl.DateTimeFormat('es-ES', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      return { label: `hora local ${formatted} (${timeZone})`, timeZone };
    } catch {}
  }

  const lon = Number(camera.lon);
  if (!Number.isFinite(lon)) return { label: 'hora local no disponible', timeZone: '' };
  const offsetHours = Math.max(-12, Math.min(14, Math.round(lon / 15)));
  const now = new Date();
  const localMillis = now.getTime() + offsetHours * 3_600_000;
  const local = new Date(localMillis);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const sign = offsetHours >= 0 ? '+' : '-';
  const offsetLabel = `UTC${sign}${Math.abs(offsetHours)}`;
  return { label: `hora local aprox. ${hh}:${mm} (${offsetLabel})`, timeZone: offsetLabel };
}

function guessTimeZone(camera) {
  const country = normalizeText(camera.country || '');
  const city = normalizeText(camera.city || '');
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
  if ((country.includes('canada') || country.includes('canada')) && Number.isFinite(lon)) {
    if (lon < -125) return 'America/Vancouver';
    if (lon < -100) return 'America/Edmonton';
    if (lon < -85) return 'America/Winnipeg';
    if (lon < -60) return 'America/Toronto';
    return 'America/Halifax';
  }
  if (country.includes('australia') && Number.isFinite(lon)) {
    if (lon < 129) return 'Australia/Perth';
    if (lon < 141) return 'Australia/Adelaide';
    return 'Australia/Sydney';
  }
  if ((country.includes('brasil') || country.includes('brazil')) && Number.isFinite(lon)) {
    if (lon < -60) return 'America/Manaus';
    return 'America/Sao_Paulo';
  }
  if ((country.includes('rusia') || country.includes('russia')) && Number.isFinite(lon)) {
    if (lon < 60) return 'Europe/Moscow';
    if (lon < 90) return 'Asia/Yekaterinburg';
    if (lon < 115) return 'Asia/Novosibirsk';
    if (lon < 135) return 'Asia/Irkutsk';
    if (lon < 155) return 'Asia/Yakutsk';
    return 'Asia/Vladivostok';
  }

  return COUNTRY_TIME_ZONES.get(country) || null;
}

function normalizeText(value) {
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function latLngToVector(lat, lng) {
  const phi = degreesToRadians(lat);
  const lambda = degreesToRadians(lng);
  const cosPhi = Math.cos(phi);
  return { x: cosPhi * Math.cos(lambda), y: cosPhi * Math.sin(lambda), z: Math.sin(phi) };
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

function updateMapStats() {
  const stats = document.querySelector('#mapStats');
  if (!stats) return;
  stats.textContent = `${lastPointCount} puntos · globo 3D`;
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}
