/* Service Worker — permite abrir la app sin señal (los datos ya son locales).
   Estrategia segura:
   - HTML/navegación: NETWORK-FIRST (siempre intenta traer la última versión;
     si no hay internet, usa la copia guardada). Así nunca queda "vieja".
   - Librería Leaflet (CDN): CACHE-FIRST (no cambia).
   - Tiles del mapa: no se cachean (son demasiados). */
const CACHE = 'cedulas-v3';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'
];

self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(CORE).catch(()=>{})));
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(ks=> Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  let url;
  try{ url = new URL(req.url); }catch(_){ return; }

  // Tiles del mapa: dejar pasar a la red, sin cachear.
  if(url.hostname.endsWith('tile.openstreetmap.org')) return;

  // HTML / navegación: network-first.
  if(req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')){
    e.respondWith(
      fetch(req).then(r=>{
        const copia = r.clone();
        caches.open(CACHE).then(c=> c.put(req, copia)).catch(()=>{});
        return r;
      }).catch(()=> caches.match(req).then(m=> m || caches.match('./index.html')))
    );
    return;
  }

  // Resto de assets (Leaflet, etc.): cache-first.
  e.respondWith(
    caches.match(req).then(m=> m || fetch(req).then(r=>{
      const copia = r.clone();
      caches.open(CACHE).then(c=> c.put(req, copia)).catch(()=>{});
      return r;
    }).catch(()=> m))
  );
});
