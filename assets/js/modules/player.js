export function buildViewer(camera, { experimental = false } = {}) {
  if (camera.embedUrl) {
    return `
      <iframe
        title="${escapeHtml(camera.title)}"
        src="${camera.embedUrl}"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen>
      </iframe>
    `;
  }

  if (experimental) {
    return `
      <iframe
        title="${escapeHtml(camera.title)}"
        src="${camera.sourceUrl}"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms">
      </iframe>
    `;
  }

  return `
    <div class="viewer-placeholder">
      <div>
        <strong>Fuente externa preparada</strong>
        <small>Esta cámara puede bloquear la incrustación. Ábrela desde su fuente oficial o prueba el visor experimental.</small>
      </div>
    </div>
  `;
}

export function cameraLocation(camera) {
  return [camera.city, camera.country, camera.continent].filter(Boolean).join(" · ");
}

export function sourceLabel(camera) {
  if (camera.embedUrl) return "Embebida";
  if (camera.sourceType === "youtube-search") return "Búsqueda YouTube";
  return "Fuente oficial";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
