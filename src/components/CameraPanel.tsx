import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Camera } from '../types';
import { formatLocalTime, resolveTimeZone } from '../lib/time';
import { MediaPlayer } from './MediaPlayer';

interface Props {
  camera: Camera | null;
  onClose: () => void;
}

interface Position {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);

export function CameraPanel({ camera, onClose }: Props) {
  const hostRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [now, setNow] = useState(new Date());
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setPosition(null);
    setCollapsed(false);
  }, [camera?.id]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      const host = hostRef.current;
      if (!drag || !host || event.pointerId !== drag.pointerId) return;
      const rect = host.getBoundingClientRect();
      const maxX = Math.max(8, window.innerWidth - rect.width - 8);
      const maxY = Math.max(8, window.innerHeight - rect.height - 8);
      setPosition({
        x: clamp(event.clientX - drag.offsetX, 8, maxX),
        y: clamp(event.clientY - drag.offsetY, 8, maxY)
      });
    };

    const end = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  useEffect(() => {
    const keepInsideViewport = () => {
      const host = hostRef.current;
      if (!host || !position) return;
      const rect = host.getBoundingClientRect();
      setPosition({
        x: clamp(position.x, 8, Math.max(8, window.innerWidth - rect.width - 8)),
        y: clamp(position.y, 8, Math.max(8, window.innerHeight - rect.height - 8))
      });
    };
    window.addEventListener('resize', keepInsideViewport);
    return () => window.removeEventListener('resize', keepInsideViewport);
  }, [position]);

  if (!camera) return null;

  const source = camera.sourceUrl || camera.url || camera.snapshotUrl || (camera.videoId ? `https://www.youtube.com/watch?v=${camera.videoId}` : '');
  const zone = resolveTimeZone(camera);
  const style = position ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto' } : undefined;

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (window.matchMedia('(max-width: 760px)').matches) return;
    if ((event.target as HTMLElement).closest('button, a')) return;
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    setPosition({ x: rect.left, y: rect.top });
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  return (
    <aside
      className="camera-panel"
      ref={hostRef}
      style={style}
      data-dragging={dragging}
      data-collapsed={collapsed}
      aria-label={`Cámara ${camera.title}`}
    >
      <header className="camera-panel-drag" onPointerDown={beginDrag} onDoubleClick={() => setPosition(null)}>
        <span className="drag-grip" aria-hidden="true">⠿</span>
        <div>
          <strong>{camera.title}</strong>
          <span>{camera.city} · {camera.country} · {formatLocalTime(camera, now)}{zone ? ` · ${zone}` : ''}</span>
        </div>
        <div className="camera-panel-actions">
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir cámara' : 'Minimizar cámara'}>{collapsed ? '□' : '—'}</button>
          <button type="button" onClick={onClose} aria-label="Cerrar cámara">×</button>
        </div>
      </header>
      {!collapsed && <div className="camera-media"><MediaPlayer camera={camera} muted={false} /></div>}
      {!collapsed && (
        <footer>
          <div className="camera-source-meta">
            <strong>{camera.provider}</strong>
            <span>{camera.type} · {camera.status}{camera.refreshSeconds ? ` · refresco ${camera.refreshSeconds}s` : ''}</span>
          </div>
          <div className="camera-footer-actions">
            <button type="button" onClick={() => hostRef.current?.requestFullscreen?.()}>pantalla completa</button>
            {source && <a href={source} target="_blank" rel="noopener noreferrer">fuente</a>}
          </div>
        </footer>
      )}
    </aside>
  );
}
