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

function Snapshot({ camera }: { camera: Camera }) {
  const base = camera.snapshotUrl || camera.url || '';
  const interval = Math.max(10, camera.refreshSeconds || 60) * 1000;
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval, camera.id]);

  const src = useMemo(() => {
    if (!base) return '';
    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}cams_refresh=${tick}`;
  }, [base, tick]);

  return src ? <img src={src} alt={camera.title} loading="lazy" referrerPolicy="no-referrer" /> : <div className="media-error">Sin snapshot</div>;
}

function HlsVideo({ camera, muted }: { camera: Camera; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = camera.url || camera.embedUrl || '';

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    if (!Hls.isSupported()) return;
    const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [src]);

  return <video ref={videoRef} autoPlay playsInline controls muted={muted} />;
}

export function MediaPlayer({ camera, muted = true, compact = false }: Props) {
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
    ) : <div className="media-error">Directo no disponible</div>;
  }

  if (camera.type === 'snapshot' || camera.type === 'image' || camera.type === 'mjpeg') {
    return <Snapshot camera={camera} />;
  }

  if (camera.type === 'hls') return <HlsVideo camera={camera} muted={muted} />;

  if (camera.type === 'video') {
    return <video src={camera.url} autoPlay playsInline controls muted={muted} />;
  }

  if (camera.type === 'iframe') {
    return camera.embedUrl || camera.url
      ? <iframe src={camera.embedUrl || camera.url} title={camera.title} loading="lazy" allowFullScreen />
      : <div className="media-error">Fuente no disponible</div>;
  }

  return <div className="media-error">Formato no compatible</div>;
}
