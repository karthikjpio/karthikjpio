/* offline cache — bump VERSION to force update */
const VERSION = "vb2-v2";
const ASSETS = [
  "./","index.html","app.js",
  "deck_l1.js","deck_l2.js","deck_l3.js","deck_l4.js",
  "manifest.webmanifest","icon-192.png","icon-512.png","icon-180.png"
];
self.addEventListener("install", e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS).catch(()=>{})));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(
    caches.match(e.request).then(hit=> hit || fetch(e.request).then(res=>{
      const copy=res.clone(); caches.open(VERSION).then(c=>c.put(e.request,copy).catch(()=>{}));
      return res;
    }).catch(()=>hit))
  );
});
