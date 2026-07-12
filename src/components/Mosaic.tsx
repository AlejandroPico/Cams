import type { Camera } from '../types';
import { MediaPlayer } from './MediaPlayer';

interface Props {
  cameras: Camera[];
  count: number;
  offset: number;
  labels: boolean;
  onSelect: (camera: Camera) => void;
}

const SHAPES: Record<number, [number, number]> = {
  1: [1, 1], 2: [2, 1], 4: [2, 2], 6: [3, 2], 9: [3, 3],
  12: [4, 3], 16: [4, 4], 20: [5, 4], 25: [5, 5], 30: [6, 5]
};

const STATUS_LABEL: Record<Camera['status'], string> = {
  online: 'online',
  unknown: 'sin verificar',
  offline: 'fuera de servicio'
};

function visibleBatch(cameras: Camera[], count: number, offset: number): Camera[] {
  if (!cameras.length) return [];
  const size = Math.min(count, cameras.length);
  return Array.from({ length: size }, (_, index) => cameras[(offset + index) % cameras.length]);
}

export function Mosaic({ cameras, count, offset, labels, onSelect }: Props) {
  const [columns, rows] = SHAPES[count] || SHAPES[12];
  const batch = visibleBatch(cameras, count, offset);

  if (!batch.length) {
    return <section className="mosaic-empty">No hay cámaras disponibles que coincidan con los filtros.</section>;
  }

  return (
    <section
      className="mosaic-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      aria-label="Mosaico de cámaras"
    >
      {batch.map((camera, index) => (
        <article
          className="mosaic-cell"
          data-status={camera.status}
          key={`${camera.id}-${index}`}
          onClick={() => onSelect(camera)}
          title={`${camera.title} · ${camera.city}, ${camera.country} · ${STATUS_LABEL[camera.status]}`}
        >
          <MediaPlayer camera={camera} compact />
          {labels && (
            <div className="mosaic-label">
              <strong>{camera.title}</strong>
              <span>{camera.city} · {camera.country} · {camera.type} · {STATUS_LABEL[camera.status]}</span>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
