/* Bump VERSION when changing any cached game file. */
const VERSION = '2026-10-30-1';
const PREFIX = `color-exit:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const FILES = ['index.html', 'game.js', 'levels.js', 'board-photo.jpg', 'pwa.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const urls = FILES.map(file => new URL(file, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll fails atomically: never report a partially downloaded game as ready.
    await cache.addAll(urls.map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const clean = new URL(url.href);
  clean.search = '';
  clean.hash = '';
  const isHome = request.mode === 'navigate' && (clean.pathname === scope.pathname || clean.pathname === scope.pathname + 'index.html');
  const key = isHome ? urls[0] : clean.href;
  if (!urls.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(key);
    if (saved) return saved;
    // A missing entry can be repaired online; an error is never cached.
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') await cache.put(key, response.clone());
    return response;
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_OFFLINE_READY' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const found = await Promise.all(urls.map(url => cache.match(url)));
    event.ports[0].postMessage({ready: found.every(Boolean), version: VERSION});
  })());
});
