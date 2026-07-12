import type { Camera } from '../types';
import bundledSeed from './catalog.seed.json';
import { DEFAULT_CAMS } from '../../assets/js/data/cameras.js';

const normalise = (raw: Record<string, unknown>, index: number): Camera | null => {
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const type = String(
    raw.type ||
    (raw.snapshotUrl ? 'snapshot' : raw.embedUrl ? 'iframe' : raw.videoId ? 'youtube' : raw.url ? 'video' : 'image')
  ) as Camera['type'];

  const status = raw.status === 'online' || raw.status === 'offline' || raw.status === 'blocked'
    ? raw.status
    : 'unknown';

  return {
    id: String(raw.id || `camera-${index + 1}`),
    title: String(raw.title || raw.city || raw.country || `Cámara ${index + 1}`),
    description: raw.description ? String(raw.description) : undefined,
    country: String(raw.country || raw.countryCode || 'Sin país'),
    countryCode: raw.countryCode ? String(raw.countryCode) : undefined,
    region: raw.region ? String(raw.region) : undefined,
    province: raw.province ? String(raw.province) : undefined,
    city: String(raw.city || raw.locality || 'Sin localidad'),
    locality: raw.locality ? String(raw.locality) : undefined,
    lat,
    lon,
    altitudeM: Number.isFinite(Number(raw.altitudeM)) ? Number(raw.altitudeM) : undefined,
    category: String(raw.category || 'other'),
    type,
    provider: String(raw.provider || 'Catálogo Cams'),
    providerCode: raw.providerCode ? String(raw.providerCode) : undefined,
    active: raw.active !== false,
    status,
    statusReason: raw.statusReason ? String(raw.statusReason) : undefined,
    timezone: raw.timezone ? String(raw.timezone) : undefined,
    videoId: raw.videoId ? String(raw.videoId) : undefined,
    url: raw.url ? String(raw.url) : undefined,
    embedUrl: raw.embedUrl ? String(raw.embedUrl) : undefined,
    snapshotUrl: raw.snapshotUrl ? String(raw.snapshotUrl) : undefined,
    sourceUrl: raw.sourceUrl ? String(raw.sourceUrl) : undefined,
    thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : undefined,
    refreshSeconds: Number.isFinite(Number(raw.refreshSeconds)) ? Number(raw.refreshSeconds) : undefined,
    isLive: raw.isLive === true || raw.type === 'youtube',
    isEmbeddable: raw.isEmbeddable !== false,
    width: Number.isFinite(Number(raw.width)) ? Number(raw.width) : undefined,
    height: Number.isFinite(Number(raw.height)) ? Number(raw.height) : undefined,
    fps: Number.isFinite(Number(raw.fps)) ? Number(raw.fps) : undefined,
    viewDirection: raw.viewDirection ? String(raw.viewDirection) : undefined,
    attribution: raw.attribution ? String(raw.attribution) : undefined,
    license: raw.license ? String(raw.license) : undefined,
    licenseUrl: raw.licenseUrl ? String(raw.licenseUrl) : undefined,
    termsUrl: raw.termsUrl ? String(raw.termsUrl) : undefined,
    lastCheckedAt: raw.lastCheckedAt ? String(raw.lastCheckedAt) : undefined
  };
};

const parsePayload = (payload: unknown): Camera[] => {
  const source: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { cameras?: unknown[] }).cameras)
      ? (payload as { cameras: unknown[] }).cameras
      : [];

  const deduped = new Map<string, Camera>();
  source.forEach((item: unknown, index: number) => {
    if (!item || typeof item !== 'object') return;
    const camera = normalise(item as Record<string, unknown>, index);
    if (!camera || !camera.active) return;
    deduped.set(camera.id, camera);
  });
  return [...deduped.values()];
};

export async function loadCatalog(): Promise<Camera[]> {
  const candidates = [
    `${import.meta.env.BASE_URL}data/cameras.json`,
    new URL('data/cameras.json', window.location.href).toString(),
    '/Cams/data/cameras.json'
  ];

  for (const url of [...new Set(candidates)]) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      const cameras = parsePayload(await response.json());
      if (cameras.length) return cameras;
    } catch {
      // Se prueba la siguiente ruta de despliegue.
    }
  }

  const integrated = parsePayload(bundledSeed);
  if (integrated.length) return integrated;

  const historical = parsePayload(DEFAULT_CAMS as unknown[]);
  if (historical.length) return historical;

  throw new Error('No se ha podido cargar ningún catálogo de cámaras.');
}
