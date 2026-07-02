// V5 Pro: service worker neutro. Non salva cache per evitare vecchie versioni bloccate su GitHub Pages.
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (self.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {});
