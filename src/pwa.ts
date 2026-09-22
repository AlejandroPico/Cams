const baseUrl = import.meta.env.BASE_URL;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${baseUrl}service-worker.js`, {
      scope: baseUrl,
      updateViaCache: 'none'
    }).catch((error: unknown) => {
      console.error('[Cams PWA] No se pudo registrar el service worker.', error);
    });
  }, { once: true });
}
