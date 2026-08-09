import type { Camera, CameraFilters } from '../types';

export const isLiveCamera = (camera: Camera) =>
  camera.isLive === true || ['youtube', 'hls', 'mjpeg', 'video', 'iframe'].includes(camera.type);

export const isSnapshotCamera = (camera: Camera) =>
  ['snapshot', 'image'].includes(camera.type);

const STATUS_RANK: Record<Camera['status'], number> = {
  online: 0,
  unknown: 1,
  blocked: 2,
  offline: 3
};

// Quita acentos y signos para que "coruna" encuentre "A Coruna", "malaga" encuentre
// "Malaga" y "st moritz" encuentre "St. Moritz". El catalogo mezcla castellano,
// catalan, gallego, aleman, checo o japones, asi que escribir el nombre exacto no es
// una expectativa razonable.
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[·.,;:_/\\()\[\]{}'"«»–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Texto sobre el que busca cada camara. Se calcula una vez y se reutiliza mientras el
// objeto no cambie: con 68.000 camaras, rehacerlo en cada pulsacion se notaria.
const haystacks = new WeakMap<Camera, string>();

function haystack(camera: Camera): string {
  const cached = haystacks.get(camera);
  if (cached) return cached;
  const value = fold([
    camera.title, camera.city, camera.locality, camera.province,
    camera.region, camera.country, camera.countryCode,
    camera.category, camera.provider, camera.description
  ].filter(Boolean).join(' '));
  haystacks.set(camera, value);
  return value;
}

export function filterCameras(cameras: Camera[], filters: CameraFilters): Camera[] {
  // Cada palabra debe aparecer, en cualquier orden y en cualquier campo: "playa
  // asturias" encuentra las playas asturianas aunque ningun campo las contenga juntas.
  const terms = fold(filters.text).split(' ').filter(Boolean);
  return cameras
    .filter((camera) => {
      if (filters.country !== 'all' && camera.country !== filters.country) return false;
      if (filters.category !== 'all' && camera.category !== filters.category) return false;
      if (filters.status === 'available' && (camera.status === 'offline' || camera.status === 'blocked')) return false;
      if (filters.status !== 'all' && filters.status !== 'available' && camera.status !== filters.status) return false;
      if (filters.mode === 'live' && !isLiveCamera(camera)) return false;
      if (filters.mode === 'snapshot' && !isSnapshotCamera(camera)) return false;
      if (!terms.length) return true;
      const texto = haystack(camera);
      return terms.every((term) => texto.includes(term));
    })
    .sort((a, b) => {
      const statusDifference = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (statusDifference !== 0) return statusDifference;
      if (terms.length) {
        // Con busqueda activa, primero aquellas cuyo titulo empieza por lo escrito:
        // quien busca "girona" espera Girona antes que una carretera que la menciona.
        const scoreA = fold(a.title).startsWith(terms[0]) ? 0 : 1;
        const scoreB = fold(b.title).startsWith(terms[0]) ? 0 : 1;
        if (scoreA !== scoreB) return scoreA - scoreB;
      }
      return a.title.localeCompare(b.title, 'es');
    });
}

export const uniqueSorted = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
