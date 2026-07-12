import { useEffect, useRef, useState } from 'react';
import type { Camera } from '../types';
import { formatLocalTime, resolveTimeZone } from '../lib/time';
import { MediaPlayer } from './MediaPlayer';

interface Props {
  camera: Camera | null;
  onClose: () => void;
}

export function CameraPanel({ camera, onClose }: Props) {
  const hostRef = useRef<HTMLElement | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!camera) return null;
  const source = camera.sourceUrl || camera.url || (camera.videoId ? `https://www.youtube.com/watch?v=${camera.videoId}` : '');
  const zone = resolveTimeZone(camera);

  return (
    <aside className="camera-panel" ref={hostRef} aria-label={`Cámara ${camera.title}`}>
      <header>
        <div>
          <strong>{camera.title}</strong>
          <span>{camera.city} · {camera.country} · {formatLocalTime(camera, now)}{zone ? ` · ${zone}` : ''}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar cámara">×</button>
      </header>
      <div className="camera-media"><MediaPlayer camera={camera} muted={false} /></div>
      <footer>
        <span>{camera.provider} · {camera.type} · {camera.status}</span>
        <div>
          <button type="button" onClick={() => hostRef.current?.requestFullscreen?.()}>pantalla completa</button>
          {source && <a href={source} target="_blank" rel="noopener noreferrer">fuente</a>}
        </div>
      </footer>
    </aside>
  );
}
