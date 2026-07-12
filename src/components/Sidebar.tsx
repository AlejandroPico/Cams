import type { CameraFilters, MapBaseMode, ViewMode } from '../types';

interface Props {
  open: boolean;
  view: ViewMode;
  filters: CameraFilters;
  countries: string[];
  categories: string[];
  total: number;
  filtered: number;
  liveCount: number;
  snapshotCount: number;
  onlineCount: number;
  gridCount: number;
  rotation: boolean;
  rotationInterval: number;
  mosaicLabels: boolean;
  mapLabels: boolean;
  dayNight: boolean;
  mapMode: MapBaseMode;
  terrain3d: boolean;
  onClose: () => void;
  onView: (view: ViewMode) => void;
  onFilters: (filters: CameraFilters) => void;
  onResetFilters: () => void;
  onGridCount: (count: number) => void;
  onRotation: (enabled: boolean) => void;
  onRotationInterval: (milliseconds: number) => void;
  onMosaicLabels: (enabled: boolean) => void;
  onMapLabels: (enabled: boolean) => void;
  onDayNight: (enabled: boolean) => void;
  onMapMode: (mode: MapBaseMode) => void;
  onTerrain3d: (enabled: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onRandom: () => void;
}

const GRID_COUNTS = [1, 2, 4, 6, 9, 12, 16, 20, 25, 30];

const MAP_MODES: Array<{ value: MapBaseMode; label: string; hint: string }> = [
  { value: 'satellite', label: 'Satélite', hint: 'Fotografía aérea' },
  { value: 'political', label: 'Geográfico', hint: 'Mapa y localidades' },
  { value: 'relief', label: 'Relieve', hint: 'Topografía y montaña' }
];

export function Sidebar(props: Props) {
  const setFilter = <K extends keyof CameraFilters>(key: K, value: CameraFilters[K]) => {
    props.onFilters({ ...props.filters, [key]: value });
  };

  const hasFilters = props.filters.text !== '' ||
    props.filters.country !== 'all' ||
    props.filters.category !== 'all' ||
    props.filters.mode !== 'all' ||
    props.filters.status !== 'all';

  return (
    <>
      <button className="drawer-shade" data-open={props.open} type="button" aria-label="Cerrar menú" onClick={props.onClose} />
      <aside className="sidebar" data-open={props.open} aria-label="Panel de control">
        <header className="sidebar-head">
          <div className="sidebar-identity">
            <span className="sidebar-logo" aria-hidden="true"><i /></span>
            <div><strong>Cams</strong><span>World camera explorer</span></div>
          </div>
          <button className="sidebar-close" type="button" onClick={props.onClose} aria-label="Cerrar menú">×</button>
        </header>

        <nav className="view-switch" aria-label="Vistas principales">
          <button className={props.view === 'map' ? 'active' : ''} type="button" onClick={() => props.onView('map')}>
            <span aria-hidden="true">◎</span><b>Mapa</b>
          </button>
          <button className={props.view === 'mosaic' ? 'active' : ''} type="button" onClick={() => props.onView('mosaic')}>
            <span aria-hidden="true">▦</span><b>Mosaico</b>
          </button>
        </nav>

        <div className="sidebar-scroll">
          <div className="catalog-summary" aria-label="Resumen del catálogo">
            <div><strong>{props.total.toLocaleString('es-ES')}</strong><span>total</span></div>
            <div><strong>{props.onlineCount.toLocaleString('es-ES')}</strong><span>online</span></div>
            <div><strong>{props.snapshotCount.toLocaleString('es-ES')}</strong><span>snapshots</span></div>
            <div><strong>{props.liveCount.toLocaleString('es-ES')}</strong><span>directos</span></div>
          </div>

          <details className="sidebar-group" open>
            <summary><span>Explorar cámaras</span><small>{props.filtered.toLocaleString('es-ES')} visibles</small></summary>
            <div className="sidebar-group-body">
              <label>Buscar</label>
              <div className="search-field">
                <span aria-hidden="true">⌕</span>
                <input value={props.filters.text} onChange={(event) => setFilter('text', event.target.value)} placeholder="ciudad, carretera, costa..." />
              </div>

              <div className="field-grid">
                <div>
                  <label>País</label>
                  <select value={props.filters.country} onChange={(event) => setFilter('country', event.target.value)}>
                    <option value="all">Todos</option>
                    {props.countries.map((country) => <option value={country} key={country}>{country}</option>)}
                  </select>
                </div>
                <div>
                  <label>Categoría</label>
                  <select value={props.filters.category} onChange={(event) => setFilter('category', event.target.value)}>
                    <option value="all">Todas</option>
                    {props.categories.map((category) => <option value={category} key={category}>{category}</option>)}
                  </select>
                </div>
              </div>

              <div className="field-grid">
                <div>
                  <label>Medio</label>
                  <select value={props.filters.mode} onChange={(event) => setFilter('mode', event.target.value as CameraFilters['mode'])}>
                    <option value="all">Todos</option>
                    <option value="live">Directos</option>
                    <option value="snapshot">Snapshots</option>
                  </select>
                </div>
                <div>
                  <label>Estado</label>
                  <select value={props.filters.status} onChange={(event) => setFilter('status', event.target.value as CameraFilters['status'])}>
                    <option value="all">Cualquiera</option>
                    <option value="available">Disponibles</option>
                    <option value="online">Online</option>
                    <option value="unknown">Sin verificar</option>
                    <option value="offline">Fuera de servicio</option>
                    <option value="blocked">Bloqueadas</option>
                  </select>
                </div>
              </div>

              <button className="secondary-action" type="button" disabled={!hasFilters} onClick={props.onResetFilters}>Limpiar filtros</button>
            </div>
          </details>

          <details className="sidebar-group" open={props.view === 'map'}>
            <summary><span>Visualización del mapa</span><small>{MAP_MODES.find((mode) => mode.value === props.mapMode)?.label}</small></summary>
            <div className="sidebar-group-body">
              <div className="map-mode-grid" role="radiogroup" aria-label="Tipo de mapa">
                {MAP_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    role="radio"
                    aria-checked={props.mapMode === mode.value}
                    className={props.mapMode === mode.value ? 'active' : ''}
                    onClick={() => props.onMapMode(mode.value)}
                  >
                    <strong>{mode.label}</strong>
                    <span>{mode.hint}</span>
                  </button>
                ))}
              </div>

              <div className="toggle-row">
                <div><strong>Terreno 3D</strong><span>Eleva montañas y relieve</span></div>
                <button type="button" data-on={props.terrain3d} onClick={() => props.onTerrain3d(!props.terrain3d)}>{props.terrain3d ? 'on' : 'off'}</button>
              </div>
              <div className="toggle-row">
                <div><strong>Día y noche</strong><span>Sombra solar aproximada</span></div>
                <button type="button" data-on={props.dayNight} onClick={() => props.onDayNight(!props.dayNight)}>{props.dayNight ? 'on' : 'off'}</button>
              </div>
              <div className="toggle-row">
                <div><strong>Localidades</strong><span>Nombres de ciudades</span></div>
                <button type="button" data-on={props.mapLabels} onClick={() => props.onMapLabels(!props.mapLabels)}>{props.mapLabels ? 'on' : 'off'}</button>
              </div>
            </div>
          </details>

          <details className="sidebar-group" open={props.view === 'mosaic'}>
            <summary><span>Configuración del mosaico</span><small>{props.gridCount} cámaras</small></summary>
            <div className="sidebar-group-body">
              <label>Número de cámaras</label>
              <select value={props.gridCount} onChange={(event) => props.onGridCount(Number(event.target.value))}>
                {GRID_COUNTS.map((count) => <option value={count} key={count}>{count} cámaras</option>)}
              </select>
              <div className="button-row">
                <button type="button" onClick={props.onPrevious}>← anterior</button>
                <button type="button" onClick={props.onRandom}>azar</button>
                <button type="button" onClick={props.onNext}>siguiente →</button>
              </div>
              <div className="toggle-row">
                <div><strong>Rotación automática</strong><span>Cambia el lote visible</span></div>
                <button type="button" data-on={props.rotation} onClick={() => props.onRotation(!props.rotation)}>{props.rotation ? 'on' : 'off'}</button>
              </div>
              <label>Intervalo</label>
              <select value={props.rotationInterval} onChange={(event) => props.onRotationInterval(Number(event.target.value))}>
                <option value={15000}>15 segundos</option>
                <option value={30000}>30 segundos</option>
                <option value={60000}>60 segundos</option>
                <option value={120000}>120 segundos</option>
              </select>
              <div className="toggle-row">
                <div><strong>Etiquetas</strong><span>Nombre y procedencia</span></div>
                <button type="button" data-on={props.mosaicLabels} onClick={() => props.onMosaicLabels(!props.mosaicLabels)}>{props.mosaicLabels ? 'on' : 'off'}</button>
              </div>
            </div>
          </details>

          <footer className="sidebar-footer">
            <span className="status-dot" />
            <div><strong>{props.filtered.toLocaleString('es-ES')} cámaras visibles</strong><small>Catálogo SQLite · actualización automática</small></div>
          </footer>
        </div>
      </aside>
    </>
  );
}
