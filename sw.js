const CACHE_NAME = 'meteo-conte-v26-cache-fix';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) { client.postMessage({ type: 'MC_UPDATED', version: 'V26' }); }
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
});
