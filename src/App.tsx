import { useEffect, useMemo, useState } from 'react';
import { AboutModal } from './components/AboutModal';
import { CameraPanel } from './components/CameraPanel';
import { Mosaic } from './components/Mosaic';
import { Sidebar } from './components/Sidebar';
import { WorldMap } from './components/WorldMap';
import { loadCatalog } from './data/loadCatalog';
import { filterCameras, isLiveCamera, isSnapshotCamera, uniqueSorted } from './lib/catalog';
import type { Camera, CameraFilters, MapBaseMode, ViewMode } from './types';

const DEFAULT_FILTERS: CameraFilters = {
  text: '',
  country: 'all',
  category: 'all',
  mode: 'all',
  status: 'all'
};

function readMapMode(): MapBaseMode {
  const value = window.localStorage.getItem('cams.mapMode');
  return value === 'political' || value === 'relief' ? value : 'satellite';
}

// Las preferencias del mosaico se conservan entre visitas: es una vista pensada para
// dejarla puesta, y volver a configurarla cada vez rompe justo ese uso.
function readStored(key: string, fallback: number, allowed?: number[]): number {
  const value = Number(window.localStorage.getItem(`cams.${key}`));
  if (!Number.isFinite(value)) return fallback;
  if (allowed && !allowed.includes(value)) return fallback;
  return value;
}

function readFlag(key: string, fallback: boolean): boolean {
  const value = window.localStorage.getItem(`cams.${key}`);
  return value === null ? fallback : value === '1';
}

export const GRID_COUNTS = [1, 2, 4, 6, 9, 12, 16, 20, 25, 30];
export const ROTATION_INTERVALS = [5_000, 10_000, 15_000, 30_000, 60_000, 120_000];

export default function App() {
  const [catalog, setCatalog] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewMode>('map');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [filters, setFilters] = useState<CameraFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Camera | null>(null);
  const [gridCount, setGridCount] = useState(() => readStored('gridCount', 12, GRID_COUNTS));
  const [mosaicOffset, setMosaicOffset] = useState(0);
  const [rotation, setRotation] = useState(() => readFlag('rotation', false));
  const [rotationInterval, setRotationInterval] = useState(() => readStored('rotationInterval', 30_000, ROTATION_INTERVALS));
  const [mosaicLabels, setMosaicLabels] = useState(() => readFlag('mosaicLabels', true));
  const [mapLabels, setMapLabels] = useState(true);
  const [dayNight, setDayNight] = useState(true);
  const [mapMode, setMapMode] = useState<MapBaseMode>(readMapMode);
  const [terrain3d, setTerrain3d] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((cameras) => {
        if (!cancelled) {
          setCatalog(cameras);
          setError('');
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el catálogo');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    window.localStorage.setItem('cams.mapMode', mapMode);
  }, [mapMode]);

  const filtered = useMemo(() => filterCameras(catalog, filters), [catalog, filters]);
  const countries = useMemo(() => uniqueSorted(catalog.map((camera) => camera.country)), [catalog]);
  const categories = useMemo(() => uniqueSorted(catalog.map((camera) => camera.category)), [catalog]);
  const catalogStats = useMemo(() => ({
    live: catalog.filter(isLiveCamera).length,
    snapshots: catalog.filter(isSnapshotCamera).length,
    online: catalog.filter((camera) => camera.status === 'online').length
  }), [catalog]);

  useEffect(() => {
    setMosaicOffset(0);
    if (selected && !filtered.some((camera) => camera.id === selected.id)) setSelected(null);
  }, [filters]);

  useEffect(() => {
    if (!rotation || view !== 'mosaic' || filtered.length <= gridCount) return;
    const timer = window.setInterval(() => {
      setMosaicOffset((offset) => (offset + gridCount) % filtered.length);
    }, rotationInterval);
    return () => window.clearInterval(timer);
  }, [rotation, rotationInterval, view, filtered.length, gridCount]);

  const previous = () => {
    if (!filtered.length) return;
    setMosaicOffset((offset) => (offset - gridCount + filtered.length) % filtered.length);
  };

  const next = () => {
    if (!filtered.length) return;
    setMosaicOffset((offset) => (offset + gridCount) % filtered.length);
  };

  useEffect(() => {
    window.localStorage.setItem('cams.gridCount', String(gridCount));
    window.localStorage.setItem('cams.rotationInterval', String(rotationInterval));
    window.localStorage.setItem('cams.rotation', rotation ? '1' : '0');
    window.localStorage.setItem('cams.mosaicLabels', mosaicLabels ? '1' : '0');
  }, [gridCount, rotationInterval, rotation, mosaicLabels]);

  // El navegador puede salir de pantalla completa por su cuenta (tecla Escape), asi
  // que el estado se sincroniza con el evento en lugar de suponerlo.
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  };

  const random = () => {
    if (!filtered.length) return;
    setMosaicOffset(Math.floor(Math.random() * filtered.length));
  };

  // Atajos de teclado del mosaico: la vista esta pensada para dejarla puesta y
  // manejarla de lejos, donde abrir el menu lateral resulta incomodo.
  useEffect(() => {
    if (view !== 'mosaic') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.key === 'ArrowLeft') { previous(); }
      else if (event.key === 'ArrowRight') { next(); }
      else if (event.key === 'r' || event.key === 'R') { random(); }
      else if (event.key === 'f' || event.key === 'F') { toggleFullscreen(); }
      else if (event.key === ' ') { event.preventDefault(); setRotation((value) => !value); }
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, filtered.length, gridCount]);

  const chooseView = (nextView: ViewMode) => {
    setView(nextView);
    setDrawerOpen(false);
    if (nextView === 'mosaic') setSelected(null);
  };

  return (
    <div className="app-shell" data-view={view}>
      <header className="floating-brand">
        <button className="hamburger" type="button" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">☰</button>
        <div><strong>Cams</strong><span>{view === 'map' ? 'mundo' : 'mosaico'}</span></div>
      </header>

      {loading && <div className="loading-screen"><span /><strong>Preparando el mundo</strong></div>}
      {error && <div className="fatal-error">{error}</div>}

      {!loading && !error && view === 'map' && (
        <WorldMap
          cameras={filtered}
          selected={selected}
          onSelect={setSelected}
          showLabels={mapLabels}
          showDayNight={dayNight}
          mapMode={mapMode}
          terrain3d={terrain3d}
        />
      )}

      {!loading && !error && view === 'mosaic' && (
        <Mosaic cameras={filtered} count={gridCount} offset={mosaicOffset} labels={mosaicLabels} onSelect={setSelected} />
      )}

      <Sidebar
        open={drawerOpen}
        view={view}
        filters={filters}
        countries={countries}
        categories={categories}
        total={catalog.length}
        filtered={filtered.length}
        liveCount={catalogStats.live}
        snapshotCount={catalogStats.snapshots}
        onlineCount={catalogStats.online}
        gridCount={gridCount}
        rotation={rotation}
        rotationInterval={rotationInterval}
        mosaicLabels={mosaicLabels}
        mapLabels={mapLabels}
        dayNight={dayNight}
        mapMode={mapMode}
        terrain3d={terrain3d}
        onClose={() => setDrawerOpen(false)}
        onAbout={() => setAboutOpen(true)}
        onView={chooseView}
        onFilters={setFilters}
        onResetFilters={() => setFilters(DEFAULT_FILTERS)}
        onGridCount={(count) => { setGridCount(count); setMosaicOffset(0); }}
        onRotation={setRotation}
        onRotationInterval={setRotationInterval}
        onMosaicLabels={setMosaicLabels}
        onMapLabels={setMapLabels}
        onDayNight={setDayNight}
        onMapMode={setMapMode}
        onTerrain3d={setTerrain3d}
        fullscreen={fullscreen}
        onFullscreen={toggleFullscreen}
        onPrevious={previous}
        onNext={next}
        onRandom={random}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CameraPanel camera={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
