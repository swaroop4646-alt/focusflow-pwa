
// Basic service worker for offline caching
const CACHE = 'focusflow-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './privacy.html',
  './terms.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Cache-first for same-origin assets
  if (url.origin === location.origin) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
    return;
  }

  // Network-first for cross-origin (e.g., CDN libs). If offline, try cache.
  event.respondWith(
    fetch(req).then(res => {
      const resClone = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, resClone)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req))
  );
});
