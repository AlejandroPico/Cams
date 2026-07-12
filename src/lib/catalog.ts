import type { Camera, CameraFilters } from '../types';

export const isLiveCamera = (camera: Camera) => ['youtube', 'hls', 'mjpeg', 'video', 'iframe'].includes(camera.type);
export const isSnapshotCamera = (camera: Camera) => ['snapshot', 'image'].includes(camera.type);

export function filterCameras(cameras: Camera[], filters: CameraFilters): Camera[] {
  const needle = filters.text.trim().toLocaleLowerCase('es');
  return cameras.filter((camera) => {
    if (filters.country !== 'all' && camera.country !== filters.country) return false;
    if (filters.category !== 'all' && camera.category !== filters.category) return false;
    if (filters.status !== 'all' && camera.status !== filters.status) return false;
    if (filters.mode === 'live' && !isLiveCamera(camera)) return false;
    if (filters.mode === 'snapshot' && !isSnapshotCamera(camera)) return false;
    if (!needle) return true;
    return `${camera.title} ${camera.city} ${camera.country} ${camera.category} ${camera.provider}`
      .toLocaleLowerCase('es')
      .includes(needle);
  });
}

export const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
