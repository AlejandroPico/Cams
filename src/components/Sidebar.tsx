import type { CameraFilters, ViewMode } from '../types';

interface Props {
  open: boolean;
  view: ViewMode;
  filters: CameraFilters;
  countries: string[];
  categories: string[];
  total: number;
  filtered: number;
  gridCount: number;
  rotation: boolean;
  rotationInterval: number;
  mosaicLabels: boolean;
  mapLabels: boolean;
  dayNight: boolean;
  onClose: () => void;
  onView: (view: ViewMode) => void;
  onFilters: (filters: CameraFilters) => void;
  onGridCount: (count: number) => void;
  onRotation: (enabled: boolean) => void;
  onRotationInterval: (milliseconds: number) => void;
  onMosaicLabels: (enabled: boolean) => void;
  onMapLabels: (enabled: boolean) => void;
  onDayNight: (enabled: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onRandom: () => void;
}

const GRID_COUNTS = [1, 2, 4, 6, 9, 12, 16, 20, 25, 30];

export function Sidebar(props: Props) {
  const setFilter = <K extends keyof CameraFilters>(key: K, value: CameraFilters[K]) => {
    props.onFilters({ ...props.filters, [key]: value });
  };

  return (
    <>
      <button className="drawer-shade" data-open={props.open} type="button" aria-label="Cerrar menú" onClick={props.onClose} />
      <aside className="sidebar" data-open={props.open} aria-label="Panel de control">
        <header>
          <div><strong>Cams</strong><span>visor mundial</span></div>
          <button type="button" onClick={props.onClose} aria-label="Cerrar menú">×</button>
        </header>

        <nav className="view-switch" aria-label="Vistas principales">
          <button className={props.view === 'map' ? 'active' : ''} type="button" onClick={() => props.onView('map')}>mapa</button>
          <button className={props.view === 'mosaic' ? 'active' : ''} type="button" onClick={() => props.onView('mosaic')}>mosaico</button>
        </nav>

        <div className="sidebar-scroll">
          <section>
            <h2>Explorar</h2>
            <label>Buscar</label>
            <input value={props.filters.text} onChange={(event) => setFilter('text', event.target.value)} placeholder="ciudad, costa, volcán..." />
            <label>País</label>
            <select value={props.filters.country} onChange={(event) => setFilter('country', event.target.value)}>
              <option value="all">Todos</option>
              {props.countries.map((country) => <option value={country} key={country}>{country}</option>)}
            </select>
            <label>Categoría</label>
            <select value={props.filters.category} onChange={(event) => setFilter('category', event.target.value)}>
              <option value="all">Todas</option>
              {props.categories.map((category) => <option value={category} key={category}>{category}</option>)}
            </select>
            <label>Tipo de medio</label>
            <select value={props.filters.mode} onChange={(event) => setFilter('mode', event.target.value as CameraFilters['mode'])}>
              <option value="all">Directos y snapshots</option>
              <option value="live">Solo directos</option>
              <option value="snapshot">Solo snapshots</option>
            </select>
            <label>Estado</label>
            <select value={props.filters.status} onChange={(event) => setFilter('status', event.target.value as CameraFilters['status'])}>
              <option value="available">Disponibles</option>
              <option value="online">Solo verificadas online</option>
              <option value="unknown">Sin comprobar</option>
              <option value="offline">Fuera de servicio</option>
              <option value="all">Cualquier estado</option>
            </select>
          </section>

          <section>
            <h2>Mapa</h2>
            <div className="toggle-row"><span>Localidades</span><button type="button" data-on={props.mapLabels} onClick={() => props.onMapLabels(!props.mapLabels)}>{props.mapLabels ? 'on' : 'off'}</button></div>
            <div className="toggle-row"><span>Día y noche</span><button type="button" data-on={props.dayNight} onClick={() => props.onDayNight(!props.dayNight)}>{props.dayNight ? 'on' : 'off'}</button></div>
          </section>

          <section>
            <h2>Mosaico</h2>
            <label>Número de cámaras</label>
            <select value={props.gridCount} onChange={(event) => props.onGridCount(Number(event.target.value))}>
              {GRID_COUNTS.map((count) => <option value={count} key={count}>{count} cámaras</option>)}
            </select>
            <div className="button-row">
              <button type="button" onClick={props.onPrevious}>←</button>
              <button type="button" onClick={props.onNext}>→</button>
              <button type="button" onClick={props.onRandom}>azar</button>
            </div>
            <div className="toggle-row"><span>Rotación</span><button type="button" data-on={props.rotation} onClick={() => props.onRotation(!props.rotation)}>{props.rotation ? 'on' : 'off'}</button></div>
            <label>Intervalo</label>
            <select value={props.rotationInterval} onChange={(event) => props.onRotationInterval(Number(event.target.value))}>
              <option value={15000}>15 segundos</option>
              <option value={30000}>30 segundos</option>
              <option value={60000}>60 segundos</option>
              <option value={120000}>120 segundos</option>
            </select>
            <div className="toggle-row"><span>Etiquetas</span><button type="button" data-on={props.mosaicLabels} onClick={() => props.onMosaicLabels(!props.mosaicLabels)}>{props.mosaicLabels ? 'on' : 'off'}</button></div>
          </section>

          <footer>
            <strong>{props.filtered.toLocaleString('es-ES')}</strong> visibles de {props.total.toLocaleString('es-ES')}
            <small>Por defecto se ocultan las cámaras confirmadas como caídas.</small>
          </footer>
        </div>
      </aside>
    </>
  );
}
