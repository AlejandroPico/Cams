export type MediaKind = 'youtube' | 'iframe' | 'image' | 'snapshot' | 'mjpeg' | 'hls' | 'video' | 'link';
export type CameraStatus = 'online' | 'unknown' | 'offline' | 'blocked';
export type CameraStatusFilter = 'available' | 'all' | CameraStatus;
export type MapBaseMode = 'satellite' | 'political' | 'relief';

export interface Camera {
  id: string;
  title: string;
  description?: string;
  country: string;
  countryCode?: string;
  region?: string;
  province?: string;
  city: string;
  locality?: string;
  lat: number;
  lon: number;
  altitudeM?: number;
  category: string;
  type: MediaKind;
  provider: string;
  providerCode?: string;
  active: boolean;
  status: CameraStatus;
  statusReason?: string;
  timezone?: string;
  videoId?: string;
  url?: string;
  embedUrl?: string;
  snapshotUrl?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  refreshSeconds?: number;
  isLive?: boolean;
  isEmbeddable?: boolean;
  width?: number;
  height?: number;
  fps?: number;
  viewDirection?: string;
  attribution?: string;
  license?: string;
  licenseUrl?: string;
  termsUrl?: string;
  lastCheckedAt?: string;
}

export interface CameraFilters {
  text: string;
  country: string;
  category: string;
  mode: 'all' | 'live' | 'snapshot';
  status: CameraStatusFilter;
}

export type ViewMode = 'map' | 'mosaic';
