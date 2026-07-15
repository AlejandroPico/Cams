import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { Camera } from '../types';

interface Props {
  camera: Camera;
  muted?: boolean;
  compact?: boolean;
}

const youtubeEmbed = (camera: Camera) => camera.embedUrl || (camera.videoId
  ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(camera.videoId)}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`
  : camera.url || '');

function sourceFor(camera: Camera): string {
  return camera.sourceUrl || camera.snapshotUrl || camera.url || camera.embedUrl || '';
}

function cameraPlace(camera: Camera): string {
  const values = [camera.city, camera.locality, camera.region, camera.country]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)].slice(0, 3).join(' · ') || camera.title;
}

function validTimestamp(value?: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function relativeAge(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) return 'ahora';
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function MediaContext({ camera, receivedAt, compact }: { camera: Camera; receivedAt: number; compact: boolean }) {
  const [now, setNow] = useState(Date.now());
  const publishedAt = validTimestamp(camera.capturedAt);
  const timestamp = publishedAt ?? receivedAt;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const exact = new Date(timestamp).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: camera.timezone || undefined,
  });

  return (
    <div className="media-context" data-compact={compact ? 'true' : 'false'}>
      <strong>{cameraPlace(camera)}</strong>
      <span title={exact}>
        {publishedAt ? 'captura' : 'imagen recibida'} {relativeAge(timestamp, now)}
        {!compact && camera.provider ? ` · ${camera.provider}` : ''}
      </span>
    </div>
  );
}

function MediaFallback({ camera, message }: { camera: Camera; message: string }) {
  const source = sourceFor(camera);
  return (
    <div className="media-error" role="status">
      <strong>{message}</strong>
      <span>{camera.provider}{camera.statusReason ? ` · ${camera.statusReason}` : ''}</span>
      {source && <a href={source} target="_blank" rel="noopener noreferrer">abrir fuente original</a>}
    </div>
  );
}

function Snapshot({ camera, compact }: { camera: Camera; compact: boolean }) {
  const base = camera.snapshotUrl || camera.url || '';
  const interval = Math.max(10, camera.refreshSeconds || 60) * 1000;
  const [tick, setTick] = useState(Date.now());
  const [failed, setFailed] = useState(false);
  const [receivedAt, setReceivedAt] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval, camera.id]);

  const src = useMemo(() => {
    if (!base) return '';
    const upgraded = typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http://')
      ? `https://${base.slice('http://'.length)}`
      : base;
    if (/[?&](?:token|sig|signature|expires|x-amz-)/i.test(upgraded)) return upgraded;
    const joiner = upgraded.includes('?') ? '&' : '?';
    return `${upgraded}${joiner}cams_refresh=${tick}`;
  }, [base, tick]);

  useEffect(() => setFailed(false), [src, camera.id]);

  if (!src) return <MediaFallback camera={camera} message="La fuente no publica un snapshot insertable" />;
  if (failed) return <MediaFallback camera={camera} message="La imagen no ha respondido o impide su inserción" />;

  return (
    <div className="media-frame">
      <img
        src={src}
        alt={camera.title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setReceivedAt(Date.now())}
        onError={() => setFailed(true)}
      />
      <MediaContext camera={camera} receivedAt={receivedAt} compact={compact} />
    </div>
  );
}

function HlsVideo({ camera, muted }: { camera: Camera; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const src = camera.url || camera.embedUrl || '';

  useEffect(() => {
    const video = videoRef.current;
    setFailed(false);
    if (!video || !src) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    if (!Hls.isSupported()) {
      setFailed(true);
      return;
    }
    const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setFailed(true);
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [src, camera.id]);

  if (!src || failed) return <MediaFallback camera={camera} message="El directo HLS no está disponible en este navegador" />;
  return <video ref={videoRef} autoPlay playsInline controls muted={muted} onError={() => setFailed(true)} />;
}

export function MediaPlayer({ camera, muted = true, compact = false }: Props) {
  if (camera.status === 'offline') {
    return <MediaFallback camera={camera} message="Cámara fuera de servicio" />;
  }
  if (camera.status === 'blocked') {
    return <MediaFallback camera={camera} message="El proveedor bloquea la reproducción insertada" />;
  }

  if (camera.type === 'youtube') {
    const src = youtubeEmbed(camera);
    return src ? (
      <iframe
        src={src}
        title={camera.title}
        loading={compact ? 'lazy' : 'eager'}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    ) : <MediaFallback camera={camera} message="Directo de YouTube no disponible" />;
  }

  if (camera.type === 'snapshot' || camera.type === 'image' || camera.type === 'mjpeg') {
    return <Snapshot camera={camera} compact={compact} />;
  }

  if (camera.type === 'hls') return <HlsVideo camera={camera} muted={muted} />;

  if (camera.type === 'video') {
    return camera.url
      ? <video src={camera.url} autoPlay playsInline controls muted={muted} />
      : <MediaFallback camera={camera} message="Vídeo no disponible" />;
  }

  if (camera.type === 'iframe') {
    return camera.embedUrl || camera.url
      ? <iframe src={camera.embedUrl || camera.url} title={camera.title} loading="lazy" allowFullScreen />
      : <MediaFallback camera={camera} message="Fuente no disponible" />;
  }

  if (camera.type === 'link') {
    return <MediaFallback camera={camera} message="La red publica la ubicación, pero no ofrece una imagen insertable" />;
  }

  return <MediaFallback camera={camera} message="La fuente utiliza un formato todavía no integrado" />;
}
