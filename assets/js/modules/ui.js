import { state, stopRotation, isRotationRunning } from "./state.js";
import { filterCameras, getCatalogStats, uniqueOptions } from "./filtering.js";
import { buildViewer, cameraLocation, escapeHtml, sourceLabel } from "./player.js";

const $ = (selector) => document.querySelector(selector);

let cameras = [];

const elements = {
  total: $("#stat-total"),
  countries: $("#stat-countries"),
  landscape: $("#stat-landscape"),
  search: $("#search-input"),
  continent: $("#continent-select"),
  category: $("#category-select"),
  provider: $("#provider-select"),
  landscapeToggle: $("#landscape-toggle"),
  highPriorityToggle: $("#high-priority-toggle"),
  reset: $("#reset-filters"),
  resultCount: $("#result-count"),
  grid: $("#camera-grid"),
  featured: $("#featured-camera"),
  prev: $("#prev-camera"),
  next: $("#next-camera"),
  toggleRotation: $("#toggle-rotation"),
  rotationInterval: $("#rotation-interval"),
  progress: $("#rotation-progress"),
  dialog: $("#camera-dialog"),
  dialogContent: $("#dialog-content")
};

export function initUI(inputCameras) {
  cameras = inputCameras;
  state.filtered = [...cameras].sort((a, b) => b.landscapeScore - a.landscapeScore);

  renderStats();
  hydrateSelects();
  bindEvents();
  applyAndRender();
}

function renderStats() {
  const stats = getCatalogStats(cameras);
  elements.total.textContent = stats.total;
  elements.countries.textContent = stats.countries;
  elements.landscape.textContent = stats.landscape;
}

function hydrateSelects() {
  fillSelect(elements.continent, uniqueOptions(cameras, "continent", "Todas"));
  fillSelect(elements.category, uniqueOptions(cameras, "category", "Todas"));
  fillSelect(elements.provider, uniqueOptions(cameras, "provider", "Todos"));
}

function fillSelect(select, options) {
  select.innerHTML = options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("");
}

function bindEvents() {
  elements.search.addEventListener("input", () => {
    state.query = elements.search.value;
    applyAndRender();
  });

  elements.continent.addEventListener("change", () => {
    state.continent = elements.continent.value;
    applyAndRender();
  });

  elements.category.addEventListener("change", () => {
    state.category = elements.category.value;
    applyAndRender();
  });

  elements.provider.addEventListener("change", () => {
    state.provider = elements.provider.value;
    applyAndRender();
  });

  elements.landscapeToggle.addEventListener("change", () => {
    state.landscapeFirst = elements.landscapeToggle.checked;
    applyAndRender();
  });

  elements.highPriorityToggle.addEventListener("change", () => {
    state.highPriorityOnly = elements.highPriorityToggle.checked;
    applyAndRender();
  });

  elements.reset.addEventListener("click", resetFilters);
  elements.prev.addEventListener("click", previousCamera);
  elements.next.addEventListener("click", nextCamera);

  elements.rotationInterval.addEventListener("change", () => {
    state.rotationInterval = Number(elements.rotationInterval.value);
    if (isRotationRunning()) {
      startRotation();
    }
  });

  elements.toggleRotation.addEventListener("click", () => {
    if (isRotationRunning()) {
      stopRotation();
      setRotationUi(false);
      return;
    }
    startRotation();
  });

  elements.grid.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;

    const id = action.dataset.id;
    const camera = state.filtered.find((item) => item.id === id);
    if (!camera) return;

    if (action.dataset.action === "select") {
      state.selectedIndex = Math.max(0, state.filtered.findIndex((item) => item.id === id));
      renderFeatured();
      return;
    }

    if (action.dataset.action === "details") {
      openDialog(camera);
    }
  });
}

function resetFilters() {
  state.query = "";
  state.continent = "Todas";
  state.category = "Todas";
  state.provider = "Todos";
  state.landscapeFirst = true;
  state.highPriorityOnly = false;

  elements.search.value = "";
  elements.continent.value = "Todas";
  elements.category.value = "Todas";
  elements.provider.value = "Todos";
  elements.landscapeToggle.checked = true;
  elements.highPriorityToggle.checked = false;

  applyAndRender();
}

function applyAndRender() {
  state.filtered = filterCameras(cameras, state);
  state.selectedIndex = Math.min(state.selectedIndex, Math.max(state.filtered.length - 1, 0));
  elements.resultCount.textContent = `${state.filtered.length} resultado${state.filtered.length === 1 ? "" : "s"}`;
  renderGrid();
  renderFeatured();
}

function renderGrid() {
  if (!state.filtered.length) {
    elements.grid.innerHTML = `
      <article class="camera-card">
        <span class="badge">Sin resultados</span>
        <h3>No hay cámaras para estos filtros</h3>
        <p class="location">Prueba a limpiar la búsqueda o abrir otro continente/categoría.</p>
      </article>
    `;
    return;
  }

  elements.grid.innerHTML = state.filtered.map((camera, index) => {
    const tags = camera.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const hot = camera.priority === "alta" ? " hot" : "";

    return `
      <article class="camera-card" style="--x: ${20 + (index % 7) * 11}%">
        <div class="card-topline">
          <span class="badge${hot}">${escapeHtml(camera.category)}</span>
          <span class="badge">${camera.landscapeScore}/100</span>
        </div>
        <h3>${escapeHtml(camera.title)}</h3>
        <p class="location">${escapeHtml(cameraLocation(camera))}</p>
        <div class="tag-list">${tags}</div>
        <div class="card-topline">
          <span class="badge">${escapeHtml(camera.provider)}</span>
          <span class="badge">${escapeHtml(sourceLabel(camera))}</span>
        </div>
        <div class="camera-actions">
          <button type="button" data-action="select" data-id="${escapeHtml(camera.id)}">Llevar al panel</button>
          <button type="button" data-action="details" data-id="${escapeHtml(camera.id)}">Detalles</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderFeatured() {
  const camera = state.filtered[state.selectedIndex] ?? state.filtered[0];

  if (!camera) {
    elements.featured.innerHTML = `
      <div class="viewer-placeholder">
        <div>
          <strong>No hay cámara seleccionada</strong>
          <small>Ajusta los filtros para recuperar resultados.</small>
        </div>
      </div>
    `;
    return;
  }

  elements.featured.innerHTML = `
    ${buildViewer(camera)}
    <span class="badge ${camera.priority === "alta" ? "hot" : ""}">${escapeHtml(camera.category)} · ${camera.landscapeScore}/100</span>
    <h3>${escapeHtml(camera.title)}</h3>
    <p>${escapeHtml(cameraLocation(camera))}</p>
    <p><strong>${escapeHtml(camera.provider)}</strong> · ${escapeHtml(sourceLabel(camera))}</p>
    <div class="camera-actions">
      <a href="${camera.sourceUrl}" target="_blank" rel="noopener noreferrer">Abrir fuente oficial</a>
      <button type="button" id="try-embed-current">Probar visor interno</button>
    </div>
  `;

  $("#try-embed-current")?.addEventListener("click", () => {
    elements.featured.innerHTML = `
      ${buildViewer(camera, { experimental: true })}
      <span class="badge ${camera.priority === "alta" ? "hot" : ""}">${escapeHtml(camera.category)} · ${camera.landscapeScore}/100</span>
      <h3>${escapeHtml(camera.title)}</h3>
      <p>${escapeHtml(cameraLocation(camera))}</p>
      <div class="camera-actions">
        <a href="${camera.sourceUrl}" target="_blank" rel="noopener noreferrer">Abrir fuente oficial</a>
        <button type="button" id="restore-current">Volver al resumen</button>
      </div>
    `;
    $("#restore-current")?.addEventListener("click", renderFeatured);
  });
}

function previousCamera() {
  if (!state.filtered.length) return;
  state.selectedIndex = (state.selectedIndex - 1 + state.filtered.length) % state.filtered.length;
  renderFeatured();
  restartProgressIfNeeded();
}

function nextCamera() {
  if (!state.filtered.length) return;
  state.selectedIndex = (state.selectedIndex + 1) % state.filtered.length;
  renderFeatured();
  restartProgressIfNeeded();
}

function startRotation() {
  stopRotation();
  state.rotationTimer = setInterval(nextCamera, state.rotationInterval);
  setRotationUi(true);
}

function setRotationUi(running) {
  elements.toggleRotation.textContent = running ? "Pausar rotación" : "Iniciar rotación";
  elements.progress.classList.toggle("running", running);
  elements.progress.style.setProperty("--rotation-duration", `${state.rotationInterval}ms`);
  if (!running) {
    elements.progress.classList.remove("running");
    elements.progress.style.width = "0";
  } else {
    elements.progress.style.width = "";
  }
}

function restartProgressIfNeeded() {
  if (!isRotationRunning()) return;
  elements.progress.classList.remove("running");
  void elements.progress.offsetWidth;
  elements.progress.classList.add("running");
}

function openDialog(camera) {
  elements.dialogContent.innerHTML = `
    <div class="dialog-inner">
      <div class="dialog-hero">${buildViewer(camera)}</div>
      <div class="dialog-meta">
        <div>
          <p class="eyebrow">${escapeHtml(camera.provider)} · ${escapeHtml(camera.category)}</p>
          <h3>${escapeHtml(camera.title)}</h3>
          <p>${escapeHtml(cameraLocation(camera))}</p>
          <p>${escapeHtml(camera.notes)}</p>
          <div class="tag-list">${camera.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        </div>
        <div class="dialog-actions">
          <a href="${camera.sourceUrl}" target="_blank" rel="noopener noreferrer">Abrir fuente oficial</a>
          <button type="button" id="dialog-try-embed">Probar visor interno</button>
        </div>
      </div>
    </div>
  `;

  $("#dialog-try-embed")?.addEventListener("click", () => {
    elements.dialogContent.querySelector(".dialog-hero").innerHTML = buildViewer(camera, { experimental: true });
  });

  if (typeof elements.dialog.showModal === "function") {
    elements.dialog.showModal();
  }
}
