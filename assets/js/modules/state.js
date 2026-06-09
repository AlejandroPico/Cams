export const STORE_KEY = 'cams_v2_catalog';
export const SETTINGS_KEY = 'cams_v2_settings';

export const DEFAULT_SETTINGS = {
  view: 'wallView',
  grid: 4,
  index: 0,
  country: '',
  category: '',
  text: '',
  labels: true,
  theme: 'dark',
  rotation: false,
  interval: 30000,
  selectedId: null
};

export const state = {
  catalog: [],
  settings: { ...DEFAULT_SETTINGS },
  rotationTimer: null,
  d3State: null,
  lastFilteredIds: []
};

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function saveSettings() {
  saveJSON(SETTINGS_KEY, state.settings);
}

export function saveCatalog() {
  saveJSON(STORE_KEY, state.catalog);
}

export function stopRotation() {
  clearInterval(state.rotationTimer);
  state.rotationTimer = null;
}
