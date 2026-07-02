const CACHE='meteo-conte-v6';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','index.html?v=6','style.css?v=6','app.js?v=6','manifest.json?v=6','icon.svg'])))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.url.includes('api.open-meteo.com'))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||caches.match('./'))))});
