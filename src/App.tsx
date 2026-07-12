import { useEffect, useMemo, useState } from 'react';
import { CameraPanel } from './components/CameraPanel';
import { Mosaic } from './components/Mosaic';
import { Sidebar } from './components/Sidebar';
import { WorldMap } from './components/WorldMap';
import { loadCatalog } from './data/loadCatalog';
import { filterCameras, uniqueSorted } from './lib/catalog';
import type { Camera, CameraFilters, ViewMode } from './types';

const DEFAULT_FILTERS: CameraFilters = {
  text: '',
  country: 'all',
  category: 'all',
  mode: 'all',
  status: 'all'
};

export default function App() {
  const [catalog, setCatalog] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewMode>('map');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<CameraFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Camera | null>(null);
  const [gridCount, setGridCount] = useState(12);
  const [mosaicOffset, setMosaicOffset] = useState(0);
  const [rotation, setRotation] = useState(false);
  const [rotationInterval, setRotationInterval] = useState(30_000);
  const [mosaicLabels, setMosaicLabels] = useState(true);
  const [mapLabels, setMapLabels] = useState(true);
  const [dayNight, setDayNight] = useState(true);

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

  const filtered = useMemo(() => filterCameras(catalog, filters), [catalog, filters]);
  const countries = useMemo(() => uniqueSorted(catalog.map((camera) => camera.country)), [catalog]);
  const categories = useMemo(() => uniqueSorted(catalog.map((camera) => camera.category)), [catalog]);

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

  const random = () => {
    if (!filtered.length) return;
    setMosaicOffset(Math.floor(Math.random() * filtered.length));
  };

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
        <WorldMap cameras={filtered} selected={selected} onSelect={setSelected} showLabels={mapLabels} showDayNight={dayNight} />
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
        gridCount={gridCount}
        rotation={rotation}
        rotationInterval={rotationInterval}
        mosaicLabels={mosaicLabels}
        mapLabels={mapLabels}
        dayNight={dayNight}
        onClose={() => setDrawerOpen(false)}
        onView={chooseView}
        onFilters={setFilters}
        onGridCount={(count) => { setGridCount(count); setMosaicOffset(0); }}
        onRotation={setRotation}
        onRotationInterval={setRotationInterval}
        onMosaicLabels={setMosaicLabels}
        onMapLabels={setMapLabels}
        onDayNight={setDayNight}
        onPrevious={previous}
        onNext={next}
        onRandom={random}
      />

      <CameraPanel camera={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
