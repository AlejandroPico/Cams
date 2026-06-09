import { DEFAULT_SETTINGS, SETTINGS_KEY, STORE_KEY, loadJSON, saveCatalog, saveSettings, state, stopRotation } from './state.js';
import { categories, countries, filteredCams, gridShape, normalizeCatalog, providerFrom } from './filtering.js';
import { cameraElement, escapeHtml, extractYouTubeId, publicUrl } from './player.js';
import { drawMarkers, renderMap } from './map.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let wallObserver = null;

export function initUI(defaultCams) {
  state.catalog = loadCatalog(defaultCams);
  state.settings = { ...DEFAULT_SETTINGS, ...loadJSON(SETTINGS_KEY, {}) };
  state.settings.view = state.settings.view || 'wallView';
  applyTheme();
  document.body.classList.toggle('labels-on', state.settings.labels);
  fillFilters();
  wireEvents();
  syncControls();
  setView(state.settings.view);
  renderAll();
  startRotation();
  if (location.protocol === 'file:') toast('YouTube funciona mejor desde GitHub Pages o localhost que con file://');
}

function loadCatalog(defaultCams) {
  const stored = loadJSON(STORE_KEY, null);
  if (Array.isArray(stored) && stored.length) return normalizeCatalog(stored);
  return normalizeCatalog(defaultCams);
}

function syncControls() {
  $('#labelsBtn').textContent = state.settings.labels ? 'on' : 'off';
  $('#labelsBtn').classList.toggle('good', state.settings.labels);
  $('#gridSelect').value = String(state.settings.grid || 4);
  $('#rotationInterval').value = String(state.settings.interval || 30000);
  $('#textFilter').value = state.settings.text || '';
  $('#countryFilter').value = state.settings.country || '';
  $('#categoryFilter').value = state.settings.category || '';
}

function wireEvents() {
  $('#menuBtn').addEventListener('click', openSide);
  $('#closeSide').addEventListener('click', closeSide);
  $('#drawerShade').addEventListener('click', closeSide);
  $$('.nav button').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

  $('#countryFilter').addEventListener('change', (event) => {
    state.settings.country = event.target.value;
    state.settings.index = 0;
    saveSettings();
    renderAll();
  });

  $('#categoryFilter').addEventListener('change', (event) => {
    state.settings.category = event.target.value;
    state.settings.index = 0;
    saveSettings();
    renderAll();
  });

  $('#textFilter').addEventListener('input', (event) => {
    state.settings.text = event.target.value;
    state.settings.index = 0;
    saveSettings();
    renderAll();
  });

  $('#gridSelect').addEventListener('change', (event) => {
    state.settings.grid = Number(event.target.value);
    state.settings.selectedId = null;
    saveSettings();
    renderLive();
  });

  $('#prevBtn').addEventListener('click', () => nextPage(-1));
  $('#nextBtn').addEventListener('click', () => nextPage(1));
  $('#shuffleBtn').addEventListener('click', shuffle);
  $('#rotationBtn').addEventListener('click', () => {
    state.settings.rotation = !state.settings.rotation;
    saveSettings();
    startRotation();
  });
  $('#rotationInterval').addEventListener('change', (event) => {
    state.settings.interval = Number(event.target.value);
    saveSettings();
    startRotation();
  });

  $('#labelsBtn').addEventListener('click', () => {
    state.settings.labels = !state.settings.labels;
    document.body.classList.toggle('labels-on', state.settings.labels);
    $('#labelsBtn').textContent = state.settings.labels ? 'on' : 'off';
    $('#labelsBtn').classList.toggle('good', state.settings.labels);
    saveSettings();
  });

  $('#themeBtn').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveSettings();
    if (state.settings.view === 'mapView') renderMap();
  });

  $('#fullscreenBtn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });

  $('#openSelectedBtn').addEventListener('click', openSelected);
  $('#catalogSearch').addEventListener('input', renderCatalog);
  $('#checkVisibleBtn').addEventListener('click', checkVisible);
  $('#addCamBtn').addEventListener('click', addCamFromFields);
  $('#importBtn').addEventListener('click', importJSON);
  $('#exportBtn').addEventListener('click', exportJSON);
  $('#resetCatalogBtn').addEventListener('click', resetCatalog);
  $('#catalogList').addEventListener('click', handleCatalogAction);

  window.addEventListener('resize', () => {
    if (state.settings.view === 'mapView') renderMap();
  });
}

function renderAll() {
  renderWall();
  renderLive();
  renderCatalog();
  drawMarkers();
  updateStats();
}

function renderWall() {
  const grid = $('#wallGrid');
  const cameras = filteredCams(state.catalog, state.settings);
  state.lastFilteredIds = cameras.map((camera) => camera.id);

  if (wallObserver) {
    wallObserver.disconnect();
    wallObserver = null;
  }

  if (!cameras.length) {
    grid.innerHTML = '<div class="empty">No hay cámaras con estos filtros.</div>';
    return;
  }

  grid.innerHTML = cameras.map((camera) => `
    <article class="wall-card" data-id="${escapeHtml(camera.id)}" title="${escapeHtml(camera.title)}">
      <div class="wall-player" data-player-id="${escapeHtml(camera.id)}">
        <div class="wall-loading">cargando directo</div>
      </div>
      <div class="wall-badges">
        <span class="badge">${escapeHtml(camera.category)}</span>
        <span class="badge">${escapeHtml(camera.country)}</span>
      </div>
      <div class="wall-meta">
        <div class="wall-title">${escapeHtml(camera.title)}</div>
        <div class="wall-place">${escapeHtml([camera.city, camera.country].filter(Boolean).join(' · '))}</div>
      </div>
    </article>
  `).join('');

  hydrateWallPlayers();
}

function hydrateWallPlayers() {
  const slots = [...document.querySelectorAll('.wall-player[data-player-id]')];

  const loadSlot = (slot) => {
    if (slot.dataset.loaded === 'true') return;
    const camera = state.catalog.find((item) => item.id === slot.dataset.playerId);
    if (!camera) return;
    slot.innerHTML = cameraElement(camera);
    slot.dataset.loaded = 'true';
  };

  if (!('IntersectionObserver' in window)) {
    slots.forEach(loadSlot);
    return;
  }

  wallObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadSlot(entry.target);
      wallObserver.unobserve(entry.target);
    });
  }, {
    root: $('#wallGrid'),
    rootMargin: '520px 0px',
    threshold: 0.01
  });

  slots.forEach((slot) => wallObserver.observe(slot));
}

function renderLive() {
  const grid = $('#tileGrid');
  const batch = visibleBatch();
  const n = Math.max(1, Number(state.settings.grid || 4));
  const [cols, rows] = gridShape(n);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  if (!batch.length) {
    grid.innerHTML = '<div class="empty">No hay cámaras con estos filtros.</div>';
    return;
  }

  grid.innerHTML = batch.map((camera) => `
    <article class="cam-tile" data-id="${escapeHtml(camera.id)}">
      ${cameraElement(camera)}
      <div class="tile-overlay">
        <div class="tile-title">${escapeHtml(camera.title)}</div>
        <div class="tile-status">${escapeHtml(camera.city || camera.country)}</div>
      </div>
    </article>
  `).join('');
}

function renderCatalog() {
  const query = ($('#catalogSearch').value || '').toLowerCase().trim();
  let cameras = state.catalog;
  if (query) {
    cameras = cameras.filter((camera) => [camera.title, camera.city, camera.country, camera.category, camera.provider, camera.videoId, camera.url].join(' ').toLowerCase().includes(query));
  }

  $('#catalogList').innerHTML = cameras.map((camera) => `
    <div class="cam-row" data-id="${escapeHtml(camera.id)}">
      <div class="cam-main">
        <div class="cam-name"><span class="dot ${statusClass(camera)}"></span> ${escapeHtml(camera.title)}</div>
        <div class="cam-meta">${escapeHtml(camera.city || '')}${camera.city ? ' · ' : ''}${escapeHtml(camera.country)} · ${escapeHtml(camera.category)} · ${escapeHtml(camera.provider || camera.type)} ${camera.videoId ? '· ' + escapeHtml(camera.videoId) : ''}</div>
      </div>
      <div class="cam-actions">
        <button class="mini" data-action="test" type="button">test</button>
        <button class="mini" data-action="view" type="button">ver</button>
        <button class="mini" data-action="map" type="button">mapa</button>
        <button class="mini ${camera.active === false ? 'warn' : ''}" data-action="toggle" type="button">${camera.active === false ? 'activar' : 'ocultar'}</button>
        <button class="mini bad" data-action="remove" type="button">quitar</button>
      </div>
    </div>
  `).join('') || '<div class="empty">Sin resultados.</div>';

  updateStats();
}

function visibleBatch() {
  const cameras = filteredCams(state.catalog, state.settings);
  if (!cameras.length) return [];
  const n = Number(state.settings.grid || 4);

  if (state.settings.selectedId && n === 1) {
    const selected = cameras.find((camera) => camera.id === state.settings.selectedId) || state.catalog.find((camera) => camera.id === state.settings.selectedId);
    return selected ? [selected] : cameras.slice(0, 1);
  }

  const start = ((state.settings.index % cameras.length) + cameras.length) % cameras.length;
  return Array.from({ length: Math.min(n, cameras.length) }, (_, offset) => cameras[(start + offset) % cameras.length]);
}

function nextPage(step = 1) {
  const cameras = filteredCams(state.catalog, state.settings);
  if (!cameras.length) return;
  state.settings.index = (state.settings.index + step * Number(state.settings.grid || 4) + cameras.length) % cameras.length;
  state.settings.selectedId = null;
  saveSettings();
  renderLive();
}

function shuffle() {
  const cameras = filteredCams(state.catalog, state.settings);
  if (!cameras.length) return;
  state.settings.index = Math.floor(Math.random() * cameras.length);
  state.settings.selectedId = null;
  saveSettings();
  renderLive();
}

function startRotation() {
  stopRotation();
  if (state.settings.rotation) {
    state.rotationTimer = setInterval(() => nextPage(1), Number(state.settings.interval || 30000));
    $('#rotationBtn').textContent = 'on';
    $('#rotationBtn').classList.add('good');
  } else {
    $('#rotationBtn').textContent = 'off';
    $('#rotationBtn').classList.remove('good');
  }
}

export function setSelected(camera) {
  state.settings.selectedId = camera.id;
  state.settings.grid = 1;
  $('#gridSelect').value = '1';
  saveSettings();
  setView('liveView');
  renderLive();
}

export function setView(id) {
  state.settings.view = id;
  saveSettings();
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === id));
  $$('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.view === id));
  closeSide();
  if (id === 'mapView') setTimeout(renderMap, 40);
  if (id === 'catalogView') renderCatalog();
  if (id === 'wallView') setTimeout(hydrateWallPlayers, 40);
}

function openSelected() {
  const camera = state.settings.selectedId ? state.catalog.find((item) => item.id === state.settings.selectedId) : visibleBatch()[0];
  const url = camera ? publicUrl(camera) : '';
  if (url) window.open(url, '_blank', 'noopener');
}

function handleCatalogAction(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const row = event.target.closest('.cam-row');
  if (!row) return;
  const camera = state.catalog.find((item) => item.id === row.dataset.id);
  if (!camera) return;
  const action = button.dataset.action;

  if (action === 'test') checkCamera(camera);
  if (action === 'view') setSelected(camera);
  if (action === 'map') {
    state.settings.country = '';
    state.settings.category = '';
    state.settings.text = '';
    fillFilters();
    syncControls();
    setView('mapView');
    setTimeout(drawMarkers, 100);
  }
  if (action === 'toggle') {
    camera.active = camera.active === false;
    saveCatalog();
    renderAll();
  }
  if (action === 'remove' && confirm('¿Quitar esta cámara del catálogo local?')) {
    state.catalog = state.catalog.filter((item) => item.id !== camera.id);
    saveCatalog();
    fillFilters();
    renderAll();
  }
}

function statusClass(camera) {
  if (camera.status === 'ok') return 'ok';
  if (camera.status === 'warn') return 'warn';
  if (camera.status === 'bad') return 'bad';
  if (camera.status === 'checking') return 'checking';
  return '';
}

async function checkVisible() {
  const ids = new Set(state.lastFilteredIds.length ? state.lastFilteredIds : filteredCams(state.catalog, state.settings).map((camera) => camera.id));
  const cameras = state.catalog.filter((camera) => ids.has(camera.id));
  toast(`Comprobando ${cameras.length} cámaras...`);
  const workers = 5;
  let cursor = 0;
  async function worker() {
    while (cursor < cameras.length) await checkCamera(cameras[cursor++]);
  }
  await Promise.all(Array.from({ length: workers }, worker));
  toast('Comprobación terminada');
}

async function checkCamera(camera) {
  camera.status = 'checking';
  renderCatalog();
  try {
    if (camera.type === 'youtube' && camera.videoId) {
      const status = await checkYouTube(camera.videoId);
      camera.status = status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : 'bad';
    } else if (camera.type === 'image' || camera.type === 'mjpeg') {
      await checkImage(camera.url);
      camera.status = 'ok';
    } else {
      await checkFrame(camera.url);
      camera.status = 'warn';
    }
  } catch {
    camera.status = 'bad';
  }
  saveCatalog();
  renderCatalog();
  return camera.status;
}

async function checkYouTube(videoId) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`, { cache: 'no-store' });
    if (response.ok) return 'ok';
  } catch {}
  try {
    await checkImage(`https://img.youtube.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`);
    return 'warn';
  } catch {
    return 'bad';
  }
}

function checkImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('missing image src'));
    const img = new Image();
    const timeout = setTimeout(() => reject(new Error('timeout')), 7000);
    img.onload = () => { clearTimeout(timeout); resolve(true); };
    img.onerror = () => { clearTimeout(timeout); reject(new Error('image error')); };
    img.referrerPolicy = 'no-referrer';
    img.src = src + (src.includes('?') ? '&' : '?') + '_wc=' + Date.now();
  });
}

function checkFrame(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('missing iframe src'));
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
    const timeout = setTimeout(() => { frame.remove(); reject(new Error('timeout')); }, 7000);
    frame.onload = () => { clearTimeout(timeout); frame.remove(); resolve(true); };
    frame.onerror = () => { clearTimeout(timeout); frame.remove(); reject(new Error('frame error')); };
    frame.src = src;
    document.body.appendChild(frame);
  });
}

function addCamFromFields() {
  const type = $('#newType').value;
  const value = $('#newUrl').value.trim();
  if (!value) return toast('Falta URL o ID');

  const camera = {
    id: uid(),
    title: $('#newTitle').value.trim() || 'Nueva cámara',
    city: $('#newCity').value.trim(),
    country: $('#newCountry').value.trim() || 'Sin país',
    category: $('#newCategory').value.trim() || 'personal',
    type,
    lat: Number($('#newLat').value || 0),
    lon: Number($('#newLon').value || 0),
    active: true
  };

  if (type === 'youtube') {
    camera.videoId = extractYouTubeId(value) || value;
    camera.provider = 'YouTube';
  } else {
    camera.url = value;
    camera.provider = providerFrom(camera);
  }

  state.catalog.unshift(camera);
  saveCatalog();
  fillFilters();
  renderAll();
  toast('Cámara añadida');
}

function importJSON() {
  try {
    const data = JSON.parse($('#jsonImport').value);
    const imported = normalizeCatalog(Array.isArray(data) ? data : [data]);
    state.catalog = [...imported, ...state.catalog];
    saveCatalog();
    fillFilters();
    renderAll();
    $('#jsonImport').value = '';
    toast(`${imported.length} importadas`);
  } catch {
    toast('JSON no válido');
  }
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state.catalog, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'cams_catalogo.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function resetCatalog() {
  if (!confirm('¿Restaurar catálogo base y eliminar cambios locales?')) return;
  localStorage.removeItem(STORE_KEY);
  location.reload();
}

function fillFilters() {
  $('#countryFilter').innerHTML = '<option value="">todo el mundo</option>' + countries(state.catalog).map((country) => `<option>${escapeHtml(country)}</option>`).join('');
  $('#categoryFilter').innerHTML = '<option value="">todas</option>' + categories(state.catalog).map((category) => `<option>${escapeHtml(category)}</option>`).join('');
}

function updateStats() {
  const active = state.catalog.filter((camera) => camera.active !== false).length;
  const total = state.catalog.length;
  const filtered = filteredCams(state.catalog, state.settings).length;
  $('#sideStats').textContent = `${filtered} filtradas · ${active} activas · ${total} catálogo`;
}

function applyTheme() {
  document.documentElement.classList.toggle('light', state.settings.theme === 'light');
  $('#themeBtn').textContent = state.settings.theme === 'light' ? 'día' : 'noche';
}

function openSide() {
  $('#side').classList.add('open');
  $('#drawerShade').classList.add('show');
}

function closeSide() {
  $('#side').classList.remove('open');
  $('#drawerShade').classList.remove('show');
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function uid() {
  return 'cam-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}
