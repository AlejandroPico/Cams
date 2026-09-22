'use strict';

const CACHE_NAME = 'cams-app-shell-v4.0.2';
const APP_ROOT = new URL('./', self.registration.scope).href;
const SHELL_RESOURCES = [
  './',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
].map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_RESOURCES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('cams-app-shell-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  // El catálogo cambia con frecuencia y supera los 50 MB. Se mantiene siempre
  // en red para no instalar una copia enorme ni servir estados desactualizados.
  if (url.pathname.includes('/data/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_ROOT, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(APP_ROOT)) || Response.error();
      }
    })());
    return;
  }

  const cacheable = ['script', 'style', 'font', 'image'].includes(request.destination)
    || url.pathname.endsWith('/manifest.webmanifest');
  if (!cacheable) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    const update = fetch(request).then(async response => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }).catch(() => null);
    return cached || (await update) || Response.error();
  })());
});
