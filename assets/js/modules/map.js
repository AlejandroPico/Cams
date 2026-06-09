import { state } from './state.js';
import { filteredCams } from './filtering.js';
import { cameraElement, escapeHtml, publicUrl } from './player.js';

const COUNTRY_TOPOLOGY_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const SATELLITE_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BUMP_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
const NIGHT_SKY_URL = 'https://unpkg.com/three-globe/example/img/night-sky.png';

let globe = null;
let countryFeatures = null;
let currentSize = { width: 0, height: 0 };

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
    .atmosphereAltitude(0.13)
    .pointLat('lat')
    .pointLng('lon')
    .pointColor(() => '#7cc7ff')
    .pointAltitude((point) => 0.02 + Math.min(point.count, 8) * 0.003)
    .pointRadius((point) => Math.min(0.38, 0.16 + Math.log2(point.count + 1) * 0.04))
    .pointLabel((point) => point.label)
    .onPointClick((point) => openMapPreview(point.camera))
    .polygonAltitude(0.004)
    .polygonCapColor(() => 'rgba(124,199,255,0.018)')
    .polygonSideColor(() => 'rgba(124,199,255,0.01)')
    .polygonStrokeColor(() => 'rgba(190,224,255,0.62)')
    .polygonsTransitionDuration(0);

  currentSize = { width, height };
  tuneRenderer();
  tuneControls();
  globe.pointOfView({ lat: 23, lng: 12, altitude: 2.35 }, 0);

  state.d3State = { globe, width, height };
  bindMapPreviewControls();
  hydrateCountries();
  drawMarkers();
}

function tuneRenderer() {
  try {
    const renderer = globe.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  } catch {}

  if (typeof globe.pointResolution === 'function') globe.pointResolution(8);
  if (typeof globe.polygonCapCurvatureResolution === 'function') globe.polygonCapCurvatureResolution(7);
}

function tuneControls() {
  const controls = globe.controls();
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.36;
  controls.zoomSpeed = 0.72;
  controls.minDistance = 165;
  controls.maxDistance = 650;
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

  globe.pointsData(grouped);
  updateMapStats(grouped.length);
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

  title.textContent = camera.title || 'Cámara';
  meta.textContent = [camera.city, camera.country, camera.category].filter(Boolean).join(' · ');
  body.innerHTML = cameraElement(camera);
  const url = publicUrl(camera);
  source.href = url || '#';
  source.hidden = !url;
  preview.hidden = false;
}

function closeMapPreview() {
  const preview = document.querySelector('#mapPreview');
  const body = document.querySelector('#mapPreviewBody');
  if (body) body.innerHTML = '';
  if (preview) preview.hidden = true;
}

function bindMapPreviewControls() {
  document.querySelector('#mapPreviewClose')?.addEventListener('click', closeMapPreview);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMapPreview();
  }, { passive: true });
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
  bindMapPreviewControls();
  updateMapStats(cameras.length);
  toast('Globo 3D no disponible; se muestra fallback plano.');
}

export function resetMap() {
  if (!globe) return;
  globe.pointOfView({ lat: 23, lng: 12, altitude: 2.35 }, 650);
}

function updateMapStats(points) {
  const stats = document.querySelector('#mapStats');
  if (stats) stats.textContent = `${points} puntos · globo 3D`;
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}
