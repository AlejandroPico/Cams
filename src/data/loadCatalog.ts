import type { Camera } from '../types';
// Se conserva la semilla histórica durante la migración al nuevo pipeline gratuito.
// @ts-expect-error El archivo antiguo es JavaScript y se reutiliza deliberadamente.
import { DEFAULT_CAMS } from '../../assets/js/data/cameras.js';

const normalise = (raw: Partial<Camera> & Record<string, unknown>, index: number): Camera | null => {
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const type = String(raw.type || (raw.snapshotUrl ? 'snapshot' : raw.videoId ? 'youtube' : 'image')) as Camera['type'];
  return {
    id: String(raw.id || `camera-${index + 1}`),
    title: String(raw.title || raw.city || raw.country || `Cámara ${index + 1}`),
    country: String(raw.country || 'Sin país'),
    city: String(raw.city || 'Sin localidad'),
    lat,
    lon,
    category: String(raw.category || 'paisaje'),
    type,
    provider: String(raw.provider || 'Catálogo Cams'),
    active: raw.active !== false,
    status: (raw.status === 'online' || raw.status === 'offline') ? raw.status : 'unknown',
    timezone: raw.timezone ? String(raw.timezone) : undefined,
    videoId: raw.videoId ? String(raw.videoId) : undefined,
    url: raw.url ? String(raw.url) : undefined,
    embedUrl: raw.embedUrl ? String(raw.embedUrl) : undefined,
    snapshotUrl: raw.snapshotUrl ? String(raw.snapshotUrl) : undefined,
    sourceUrl: raw.sourceUrl ? String(raw.sourceUrl) : undefined,
    refreshSeconds: Number.isFinite(Number(raw.refreshSeconds)) ? Number(raw.refreshSeconds) : undefined,
    attribution: raw.attribution ? String(raw.attribution) : undefined,
    license: raw.license ? String(raw.license) : undefined,
    lastCheckedAt: raw.lastCheckedAt ? String(raw.lastCheckedAt) : undefined
  };
};

export async function loadCatalog(): Promise<Camera[]> {
  let remote: unknown[] = [];
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/cameras.json`, { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      remote = Array.isArray(payload) ? payload : Array.isArray(payload.cameras) ? payload.cameras : [];
    }
  } catch {
    // GitHub Pages puede servir brevemente la versión anterior mientras publica el nuevo catálogo.
  }

  const source = remote.length ? remote : DEFAULT_CAMS;
  const deduped = new Map<string, Camera>();
  source.forEach((item, index) => {
    const camera = normalise(item as Record<string, unknown>, index);
    if (!camera) return;
    const key = camera.id || `${camera.title}|${camera.lat.toFixed(5)}|${camera.lon.toFixed(5)}`;
    deduped.set(key, camera);
  });

  return [...deduped.values()].filter((camera) => camera.active);
}
