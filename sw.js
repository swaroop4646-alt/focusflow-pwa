const CACHE='focusflow-premium-cache-v1';
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./manifest.json','./privacy.html','./terms.html',
  './favicon.ico',
  './icons/icon-192.png','./icons/icon-512.png',
  './icons/edit.svg','./icons/trash.svg','./icons/check.svg','./icons/theme.svg','./icons/install.svg','./icons/undo.svg','./icons/info.svg'
];
self.addEventListener('install',e=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) .then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(cached=> cached || fetch(e.request)));
  }else{
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
  }
});
