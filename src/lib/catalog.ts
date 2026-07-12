import type { Camera, CameraFilters } from '../types';

export const isLiveCamera = (camera: Camera) => ['youtube', 'hls', 'mjpeg', 'video', 'iframe'].includes(camera.type);
export const isSnapshotCamera = (camera: Camera) => ['snapshot', 'image'].includes(camera.type);

const STATUS_RANK: Record<Camera['status'], number> = {
  online: 0,
  unknown: 1,
  offline: 2
};

export function filterCameras(cameras: Camera[], filters: CameraFilters): Camera[] {
  const needle = filters.text.trim().toLocaleLowerCase('es');
  return cameras
    .filter((camera) => {
      if (filters.country !== 'all' && camera.country !== filters.country) return false;
      if (filters.category !== 'all' && camera.category !== filters.category) return false;
      if (filters.status === 'available' && camera.status === 'offline') return false;
      if (filters.status !== 'all' && filters.status !== 'available' && camera.status !== filters.status) return false;
      if (filters.mode === 'live' && !isLiveCamera(camera)) return false;
      if (filters.mode === 'snapshot' && !isSnapshotCamera(camera)) return false;
      if (!needle) return true;
      return `${camera.title} ${camera.city} ${camera.country} ${camera.category} ${camera.provider}`
        .toLocaleLowerCase('es')
        .includes(needle);
    })
    .sort((a, b) => {
      const statusDifference = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (statusDifference !== 0) return statusDifference;
      return a.title.localeCompare(b.title, 'es');
    });
}

export const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
