export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

export function thumbnailUrl(camera) {
  if (camera.type === 'youtube' && camera.videoId) {
    return `https://img.youtube.com/vi/${encodeURIComponent(camera.videoId)}/hqdefault.jpg`;
  }
  if ((camera.type === 'image' || camera.type === 'mjpeg') && camera.url) {
    return camera.url;
  }
  return 'assets/img/favicon.svg';
}

export function publicUrl(camera) {
  if (camera.type === 'youtube' && camera.videoId) {
    return `https://www.youtube.com/watch?v=${camera.videoId}`;
  }
  return camera.url || '';
}

export function cameraElement(camera) {
  if (camera.type === 'youtube' && camera.videoId) {
    const origin = location.origin && location.origin !== 'null'
      ? `&origin=${encodeURIComponent(location.origin)}`
      : '';
    const params = `autoplay=1&mute=1&playsinline=1&controls=0&modestbranding=1&rel=0&enablejsapi=1${origin}`;
    return `<iframe loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(camera.videoId)}?${params}"></iframe>`;
  }

  if (camera.type === 'image' || camera.type === 'mjpeg') {
    return `<img loading="lazy" src="${escapeHtml(camera.url || '')}" alt="${escapeHtml(camera.title)}">`;
  }

  if (camera.type === 'hls') {
    return `<video muted autoplay playsinline controls src="${escapeHtml(camera.url || '')}"></video>`;
  }

  return `<iframe loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" src="${escapeHtml(camera.url || '')}"></iframe>`;
}

export function extractYouTubeId(value) {
  const source = String(value || '').trim();
  const patterns = [
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/watch\?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
    /youtube\.com\/live\/([^?&/]+)/
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return match[1];
  }

  if (/^[\w-]{8,}$/.test(source)) return source;
  return '';
}
