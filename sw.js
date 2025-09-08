const CACHE = 'focusflow-cache-v6';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([
    './','index.html','styles.css','app.js','manifest.json',
    'icons/icon-192.png','icons/icon-512.png','icons/favicon.ico',
    'icons/edit.svg','icons/trash.svg','icons/check.svg','icons/theme.svg','icons/install.svg'
  ])));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
