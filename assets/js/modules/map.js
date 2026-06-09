import { state } from './state.js';
import { filteredCams } from './filtering.js';
import { cameraElement, escapeHtml, publicUrl } from './player.js';

const EARTH_IMAGE = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const EARTH_BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
const SKY_IMAGE = 'https://unpkg.com/three-globe/example/img/night-sky.png';
const WORLD_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const MARKER_LIGHT_UPDATE_MS = 60000;
const TILE_UPDATE_DELAY_MS = 120;

const COUNTRY_TIME_ZONES = new Map([
  ['espana', 'Europe/Madrid'], ['spain', 'Europe/Madrid'], ['francia', 'Europe/Paris'], ['france', 'Europe/Paris'],
  ['italia', 'Europe/Rome'], ['italy', 'Europe/Rome'], ['portugal', 'Europe/Lisbon'], ['alemania', 'Europe/Berlin'], ['germany', 'Europe/Berlin'],
  ['reino unido', 'Europe/London'], ['united kingdom', 'Europe/London'], ['uk', 'Europe/London'],
  ['irlanda', 'Europe/Dublin'], ['ireland', 'Europe/Dublin'], ['paises bajos', 'Europe/Amsterdam'], ['netherlands', 'Europe/Amsterdam'],
  ['belgica', 'Europe/Brussels'], ['belgium', 'Europe/Brussels'], ['suiza', 'Europe/Zurich'], ['switzerland', 'Europe/Zurich'],
  ['austria', 'Europe/Vienna'], ['grecia', 'Europe/Athens'], ['greece', 'Europe/Athens'], ['noruega', 'Europe/Oslo'], ['norway', 'Europe/Oslo'],
  ['suecia', 'Europe/Stockholm'], ['sweden', 'Europe/Stockholm'], ['finlandia', 'Europe/Helsinki'], ['finland', 'Europe/Helsinki'],
  ['dinamarca', 'Europe/Copenhagen'], ['denmark', 'Europe/Copenhagen'], ['islandia', 'Atlantic/Reykjavik'], ['iceland', 'Atlantic/Reykjavik'],
  ['marruecos', 'Africa/Casablanca'], ['morocco', 'Africa/Casablanca'], ['sudafrica', 'Africa/Johannesburg'], ['south africa', 'Africa/Johannesburg'],
  ['japon', 'Asia/Tokyo'], ['japan', 'Asia/Tokyo'], ['china', 'Asia/Shanghai'], ['corea del sur', 'Asia/Seoul'], ['south korea', 'Asia/Seoul'],
  ['india', 'Asia/Kolkata'], ['tailandia', 'Asia/Bangkok'], ['thailand', 'Asia/Bangkok'], ['singapur', 'Asia/Singapore'], ['singapore', 'Asia/Singapore'],
  ['mexico', 'America/Mexico_City'], ['argentina', 'America/Argentina/Buenos_Aires'], ['chile', 'America/Santiago'], ['colombia', 'America/Bogota'], ['peru', 'America/Lima'],
  ['brasil', 'America/Sao_Paulo'], ['brazil', 'America/Sao_Paulo'], ['uruguay', 'America/Montevideo'], ['nueva zelanda', 'Pacific/Auckland'], ['new zealand', 'Pacific/Auckland']
]);

let world = null;
let leafletMap = null;
let leafletMarker = null;
let currentPreviewCamera = null;
let markerTimer = null;
let controlsBound = false;
let lastPointCount = 0;
let tileGroup = null;
let tileLoader = null;
let tileUpdateTimer = null;
let lastTileKey = '';
let activeTileMeshes = new Map();
let currentTileZoom = 0;

export function renderMap() {
  const container = document.querySelector('#worldGlobe');
  if (!container) return;
  if (typeof Globe !== 'function') {
    fallback(container);
    return;
  }
  if (!world) initGlobe(container);
  else world.width(container.clientWidth || window.innerWidth).height(container.clientHeight || window.innerHeight);
  drawMarkers();
  scheduleTileUpdate();
}

function initGlobe(container) {
  container.innerHTML = '';
  world = Globe()(container)
    .globeImageUrl(EARTH_IMAGE)
    .bumpImageUrl(EARTH_BUMP)
    .backgroundImageUrl(SKY_IMAGE)
    .showAtmosphere(true)
    .atmosphereColor('#3a6680')
    .atmosphereAltitude(0.15)
    .htmlLat('lat')
    .htmlLng('lng')
    .htmlAltitude('htmlAlt')
    .htmlTransitionDuration(0)
    .htmlElement(createCameraMarker)
    .pathsData([])
    .polygonsData([])
    .pointsData([]);

  configureControls();
  initTileOverlay();
  bindMapControls();
  drawMarkers();
  clearInterval(markerTimer);
  markerTimer = setInterval(drawMarkers, MARKER_LIGHT_UPDATE_MS);
}

function configureControls() {
  try {
    const controls = world.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.36;
    controls.zoomSpeed = 1.55;
    controls.minDistance = 100.003;
    controls.maxDistance = 1500;
    controls.screenSpacePanning = false;
    controls.addEventListener?.('change', scheduleTileUpdate);
    controls.update();
  } catch (err) {
    console.warn('No se pudieron ajustar controles del globo:', err);
  }

  try {
    const camera = world.camera();
    camera.near = 0.0005;
    camera.far = 9000;
    camera.updateProjectionMatrix();
  } catch (err) {
    console.warn('No se pudo ajustar la cámara del globo:', err);
  }

  try {
    if (typeof world.globeCurvatureResolution === 'function') world.globeCurvatureResolution(0.65);
    const renderer = typeof world.renderer === 'function' ? world.renderer() : null;
    if (renderer?.setPixelRatio) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.85));
    if (world.globeMaterial && world.globeMaterial()) world.globeMaterial().bumpScale = 2.4;
  } catch (err) {
    console.warn('No se pudo ajustar material del globo:', err);
  }
}

function initTileOverlay() {
  try {
    const THREE = window.THREE;
    if (!THREE || !world.scene) return;
    tileGroup = new THREE.Group();
    tileGroup.name = 'dynamic-satellite-tile-overlay';
    world.scene().add(tileGroup);
    tileLoader = new THREE.TextureLoader();
    tileLoader.setCrossOrigin?.('anonymous');
    scheduleTileUpdate();
  } catch (err) {
    console.warn('No se pudo iniciar la capa de teselas:', err);
  }
}

function scheduleTileUpdate() {
  if (!world || !tileGroup) return;
  clearTimeout(tileUpdateTimer);
  tileUpdateTimer = setTimeout(updateSatelliteTiles, TILE_UPDATE_DELAY_MS);
}

function updateSatelliteTiles() {
  if (!world || !tileGroup || !window.THREE) return;
  const pov = getPointOfView();
  const tileZoom = tileZoomFromAltitude(pov.altitude);
  currentTileZoom = tileZoom;

  if (!tileZoom) {
    clearTileMeshes();
    lastTileKey = 'none';
    updateMapStats();
    return;
  }

  const center = lonLatToTile(pov.lng, pov.lat, tileZoom);
  const radius = tileRadius(tileZoom);
  const key = `${tileZoom}:${center.x}:${center.y}:${radius}`;
  if (key === lastTileKey) return;
  lastTileKey = key;

  const needed = new Set();
  const count = 2 ** tileZoom;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = wrapTileX(center.x + dx, count);
      const y = center.y + dy;
      if (y < 0 || y >= count) continue;
      const tileKey = `${tileZoom}/${x}/${y}`;
      needed.add(tileKey);
      if (!activeTileMeshes.has(tileKey)) {
        const mesh = createTileMesh(x, y, tileZoom);
        if (mesh) {
          activeTileMeshes.set(tileKey, mesh);
          tileGroup.add(mesh);
        }
      }
    }
  }

  for (const [tileKey, mesh] of activeTileMeshes.entries()) {
    if (!needed.has(tileKey)) {
      tileGroup.remove(mesh);
      disposeMesh(mesh);
      activeTileMeshes.delete(tileKey);
    }
  }
  updateMapStats();
}

function createTileMesh(x, y, z) {
  const THREE = window.THREE;
  if (!THREE || !tileLoader) return null;

  const lonLeft = tileToLng(x, z);
  const lonRight = tileToLng(x + 1, z);
  const latTop = tileToLat(y, z);
  const latBottom = tileToLat(y + 1, z);
  const segments = z >= 14 ? 3 : z >= 11 ? 5 : 8;
  const vertices = [];
  const uvs = [];
  const indices = [];
  const tileAlt = z >= 15 ? 0.0011 : z >= 12 ? 0.0014 : 0.002;

  for (let row = 0; row <= segments; row++) {
    const v = row / segments;
    const lat = latTop + (latBottom - latTop) * v;
    for (let col = 0; col <= segments; col++) {
      const u = col / segments;
      const lng = lonLeft + (lonRight - lonLeft) * u;
      const p = world.getCoords(lat, lng, tileAlt);
      vertices.push(p.x, p.y, p.z);
      uvs.push(u, 1 - v);
    }
  }

  for (let row = 0; row < segments; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * (segments + 1) + col;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;

  const url = WORLD_IMAGERY.replace('{z}', z).replace('{y}', y).replace('{x}', x);
  tileLoader.load(url, (texture) => {
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    else texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(world.renderer?.()?.capabilities?.getMaxAnisotropy?.() || 4, 8);
    material.map = texture;
    material.needsUpdate = true;
  }, undefined, () => {
    material.opacity = 0;
    material.transparent = true;
  });

  return mesh;
}

function clearTileMeshes() {
  for (const mesh of activeTileMeshes.values()) {
    tileGroup?.remove(mesh);
    disposeMesh(mesh);
  }
  activeTileMeshes.clear();
}

function disposeMesh(mesh) {
  mesh.geometry?.dispose?.();
  if (mesh.material?.map) mesh.material.map.dispose?.();
  mesh.material?.dispose?.();
}

function getPointOfView() {
  try {
    const pov = world.pointOfView();
    return {
      lat: Number.isFinite(pov.lat) ? pov.lat : 0,
      lng: Number.isFinite(pov.lng) ? pov.lng : 0,
      altitude: Number.isFinite(pov.altitude) ? pov.altitude : 2
    };
  } catch {
    return { lat: 0, lng: 0, altitude: 2 };
  }
}

function tileZoomFromAltitude(altitude) {
  if (altitude > 0.32) return 0;
  if (altitude > 0.22) return 7;
  if (altitude > 0.145) return 8;
  if (altitude > 0.095) return 9;
  if (altitude > 0.065) return 10;
  if (altitude > 0.045) return 11;
  if (altitude > 0.032) return 12;
  if (altitude > 0.022) return 13;
  if (altitude > 0.015) return 14;
  if (altitude > 0.010) return 15;
  if (altitude > 0.0065) return 16;
  if (altitude > 0.0042) return 17;
  return 18;
}

function tileRadius(z) {
  if (z >= 16) return 2;
  if (z >= 13) return 3;
  return 2;
}

function lonLatToTile(lon, lat, zoom) {
  const n = 2 ** zoom;
  const safeLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const x = Math.floor((normalizeLng(lon) + 180) / 360 * n);
  const latRad = degreesToRadians(safeLat);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x: wrapTileX(x, n), y: Math.max(0, Math.min(n - 1, y)) };
}

function tileToLng(x, z) {
  return x / (2 ** z) * 360 - 180;
}

function tileToLat(y, z) {
  const n = Math.PI - 2 * Math.PI * y / (2 ** z);
  return radiansToDegrees(Math.atan(Math.sinh(n)));
}

function wrapTileX(x, count) {
  return ((x % count) + count) % count;
}

export function drawMarkers() {
  if (!world) return;
  const data = groupCameraPoints(filteredCams(state.catalog, state.settings));
  lastPointCount = data.length;
  world.htmlElementsData(data);
  world.pathsData([]);
  world.polygonsData([]);
  updateMapStats();
}

function groupCameraPoints(cameras) {
  const grouped = new Map();
  for (const camera of cameras) {
    if (!Number.isFinite(camera.lat) || !Number.isFinite(camera.lon)) continue;
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
      lng: camera.lon,
      htmlAlt: 0.018,
      light: getLightClass(camera.lat, camera.lon),
      local
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
  for (const type of ['pointerdown', 'mousedown', 'touchstart']) marker.addEventListener(type, (event) => event.stopPropagation(), { capture: true });
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
  if (Number.isFinite(camera.lat) && Number.isFinite(camera.lon)) {
    world.pointOfView({ lat: camera.lat, lng: camera.lon, altitude: 0.018 }, 700);
    setTimeout(scheduleTileUpdate, 760);
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
  if (!panel || !mapEl || !title || !meta || !window.L || !camera) return;
  const lat = Number(camera.lat);
  const lon = Number(camera.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const local = getLocalTime(camera);
  title.textContent = camera.title || 'Zoom satelital';
  meta.textContent = [camera.city, camera.country, local.label].filter(Boolean).join(' · ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  panel.hidden = false;
  if (!leafletMap) {
    leafletMap = L.map(mapEl, { zoomControl: true, attributionControl: true, maxZoom: 20, minZoom: 2, worldCopyJump: true });
    L.tileLayer(WORLD_IMAGERY, { maxZoom: 20, maxNativeZoom: 19, attribution: 'Esri World Imagery' }).addTo(leafletMap);
  }
  if (leafletMarker) leafletMarker.remove();
  leafletMarker = L.marker([lat, lon]).addTo(leafletMap).bindPopup(escapeHtml(camera.title || 'Cámara'));
  leafletMap.setView([lat, lon], 19, { animate: false });
  setTimeout(() => { leafletMap.invalidateSize(); leafletMarker?.openPopup(); }, 80);
}

function closeDeepZoom() {
  const panel = document.querySelector('#deepZoomPanel');
  if (panel) panel.hidden = true;
}

function bindMapControls() {
  if (controlsBound) return;
  controlsBound = true;
  document.querySelector('#mapPreviewClose')?.addEventListener('click', closeMapPreview);
  document.querySelector('#mapPreviewDeepZoom')?.addEventListener('click', () => currentPreviewCamera && openDeepZoom(currentPreviewCamera));
  document.querySelector('#deepZoomClose')?.addEventListener('click', closeDeepZoom);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMapPreview();
      closeDeepZoom();
    }
  }, { passive: true });
}

export function resetMap() {
  if (!world) return;
  clearTileMeshes();
  lastTileKey = '';
  currentTileZoom = 0;
  world.pointOfView({ lat: 23, lng: 12, altitude: 2.35 }, 650);
  setTimeout(scheduleTileUpdate, 700);
}

function getSubsolarPoint(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
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
  const a = latLngToVector(lat, lon);
  const b = latLngToVector(sun.lat, sun.lng);
  const illumination = a.x * b.x + a.y * b.y + a.z * b.z;
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
  const local = new Date(Date.now() + offsetHours * 3600000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const sign = offsetHours >= 0 ? '+' : '-';
  return { label: `hora local aprox. ${hh}:${mm} (UTC${sign}${Math.abs(offsetHours)})`, timeZone: '' };
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
  if (country.includes('canada') && Number.isFinite(lon)) {
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
  if ((country.includes('brasil') || country.includes('brazil')) && Number.isFinite(lon)) return lon < -60 ? 'America/Manaus' : 'America/Sao_Paulo';
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

function degreesToRadians(value) { return value * Math.PI / 180; }
function radiansToDegrees(value) { return value * 180 / Math.PI; }
function normalizeLng(value) { let lng = value; while (lng > 180) lng -= 360; while (lng < -180) lng += 360; return lng; }

function updateMapStats() {
  const stats = document.querySelector('#mapStats');
  if (!stats) return;
  const tileInfo = currentTileZoom ? ` · teselas z${currentTileZoom}` : '';
  stats.textContent = `${lastPointCount} cámaras · globo 3D${tileInfo}`;
}

function fallback(container) {
  container.innerHTML = '<div class="empty">No se ha podido cargar Globe.gl para el globo 3D.</div>';
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}
