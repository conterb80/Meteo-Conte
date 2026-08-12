const CACHE='meteo-conte-rc34-1-v1';
const CORE=['./','./index.html','./style.css?v=rc33.1','./app.js?v=rc33.1','./radar.html','./radar.css','./radar.js','./manifest.json','./icon.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin===location.origin){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));return;}e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
