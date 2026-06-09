import { state } from './state.js';
import { filteredCams } from './filtering.js';
import { escapeHtml } from './player.js';
import { setSelected } from './ui.js';

export function renderMap() {
  const svgEl = document.querySelector('#worldMap');
  if (!svgEl) return;

  const width = svgEl.clientWidth || window.innerWidth;
  const height = svgEl.clientHeight || window.innerHeight;

  if (!window.d3 || !window.topojson) {
    renderFallbackMap(svgEl, width, height);
    return;
  }

  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('viewBox', [0, 0, width, height]);
  const projection = d3.geoNaturalEarth1().fitExtent([[28, 28], [width - 28, height - 28]], { type: 'Sphere' });
  const path = d3.geoPath(projection);
  const g = svg.append('g');

  g.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
  g.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule10()));
  const markerLayer = g.append('g').attr('class', 'markers');

  state.d3State = { svg, g, projection, path, markerLayer, width, height };
  svg.call(d3.zoom().scaleExtent([1, 12]).on('zoom', (event) => g.attr('transform', event.transform)));

  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then((world) => {
      const countries = topojson.feature(world, world.objects.countries).features;
      g.insert('g', '.markers')
        .selectAll('path')
        .data(countries)
        .join('path')
        .attr('class', 'country')
        .attr('d', path)
        .append('title')
        .text((d) => d.properties.name);
      drawMarkers();
    })
    .catch(() => {
      drawMarkers();
      toast('Mapa externo no cargado; se muestran solo puntos.');
    });
}

export function drawMarkers() {
  if (!state.d3State || !window.d3) return;

  const cameras = filteredCams(state.catalog, state.settings)
    .filter((camera) => Number.isFinite(camera.lat) && Number.isFinite(camera.lon));

  const grouped = new Map();
  for (const camera of cameras) {
    const key = `${Math.round(camera.lat * 10) / 10},${Math.round(camera.lon * 10) / 10}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(camera);
  }

  const points = [...grouped.values()].map((list) => ({ camera: list[0], count: list.length }));
  const selection = state.d3State.markerLayer
    .selectAll('g.map-marker')
    .data(points, (d) => d.camera.id);

  const enter = selection.enter()
    .append('g')
    .attr('class', 'map-marker')
    .on('click', (_event, d) => setSelected(d.camera));

  enter.append('circle').attr('class', 'outer').attr('r', 12);
  enter.append('circle').attr('class', 'inner').attr('r', 4.5);
  enter.append('text')
    .attr('class', 'map-label')
    .attr('x', 9)
    .attr('y', 3)
    .text((d) => d.count > 1 ? `${d.camera.city || d.camera.country} (${d.count})` : (d.camera.city || d.camera.country));

  selection.merge(enter).attr('transform', (d) => {
    const point = state.d3State.projection([d.camera.lon, d.camera.lat]) || [0, 0];
    return `translate(${point[0]},${point[1]})`;
  });

  selection.exit().remove();
}

function renderFallbackMap(svgEl, width, height) {
  svgEl.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const background = document.createElementNS(ns, 'rect');
  background.setAttribute('width', width);
  background.setAttribute('height', height);
  background.setAttribute('fill', 'var(--map-water)');
  svgEl.appendChild(background);

  const cameras = filteredCams(state.catalog, state.settings);
  for (const camera of cameras) {
    const x = (camera.lon + 180) / 360 * width;
    const y = (90 - camera.lat) / 180 * height;
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'map-marker');
    g.setAttribute('transform', `translate(${x},${y})`);
    g.innerHTML = `<circle class="outer" r="12"></circle><circle class="inner" r="4.5"></circle><text class="map-label" x="9" y="3">${escapeHtml(camera.city || camera.country)}</text>`;
    g.addEventListener('click', () => setSelected(camera));
    svgEl.appendChild(g);
  }
}

export function resetMap() {
  if (state.d3State && window.d3) {
    state.d3State.svg.transition().duration(250).call(d3.zoom().transform, d3.zoomIdentity);
  }
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}
