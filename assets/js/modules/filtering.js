export function normalizeCatalog(arr) {
  return arr.map((camera, index) => {
    const next = { ...camera };
    next.id = next.id || `cam-${String(index + 1).padStart(3, '0')}`;
    next.title = next.title || 'Sin título';
    next.country = next.country || 'Sin país';
    next.city = next.city || '';
    next.category = next.category || 'sin categoría';
    next.type = next.type || (next.videoId ? 'youtube' : 'iframe');
    next.provider = next.provider || providerFrom(next);
    next.active = next.active !== false;
    next.lat = Number(next.lat || 0);
    next.lon = Number(next.lon || 0);
    return next;
  });
}

export function providerFrom(camera) {
  if (camera.provider) return camera.provider;
  if (camera.type === 'youtube') return 'YouTube';
  try {
    return new URL(camera.url || '').hostname.replace(/^www\./, '');
  } catch {
    return camera.type || 'desconocido';
  }
}

export function countries(catalog) {
  return [...new Set(catalog.map((camera) => camera.country).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}

export function categories(catalog) {
  return [...new Set(catalog.map((camera) => camera.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}

export function filteredCams(catalog, settings) {
  const query = (settings.text || '').trim().toLowerCase();
  let result = catalog.filter((camera) => camera.active !== false);

  if (settings.country) {
    result = result.filter((camera) => camera.country === settings.country);
  }

  if (settings.category) {
    result = result.filter((camera) => camera.category === settings.category);
  }

  if (query) {
    result = result.filter((camera) => [
      camera.title,
      camera.city,
      camera.country,
      camera.category,
      camera.provider,
      camera.videoId,
      camera.url
    ].join(' ').toLowerCase().includes(query));
  }

  return result;
}

export function gridShape(n) {
  if (n <= 1) return [1, 1];
  if (n === 2) return [2, 1];
  if (n === 4) return [2, 2];
  if (n === 6) return [3, 2];
  const side = Math.ceil(Math.sqrt(n));
  return [side, side];
}
