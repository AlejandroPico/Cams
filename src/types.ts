export type MediaKind = 'youtube' | 'iframe' | 'image' | 'snapshot' | 'mjpeg' | 'hls' | 'video';
export type CameraStatus = 'online' | 'unknown' | 'offline';

export interface Camera {
  id: string;
  title: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  category: string;
  type: MediaKind;
  provider: string;
  active: boolean;
  status: CameraStatus;
  timezone?: string;
  videoId?: string;
  url?: string;
  embedUrl?: string;
  snapshotUrl?: string;
  sourceUrl?: string;
  refreshSeconds?: number;
  attribution?: string;
  license?: string;
  lastCheckedAt?: string;
}

export interface CameraFilters {
  text: string;
  country: string;
  category: string;
  mode: 'all' | 'live' | 'snapshot';
  status: 'all' | CameraStatus;
}

export type ViewMode = 'map' | 'mosaic';
