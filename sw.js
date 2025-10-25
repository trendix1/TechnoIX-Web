// sw.js - simple service worker to cache shell and external assets for offline use
const CACHE = 'vscode-web-cache-v2';
const OFFLINE_URLS = [
  './',
  './code.html',
  './style.css',
  './main.js',
  './prettier.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs/loader.min.js',
  'https://unpkg.com/prettier@2.8.8/standalone.js',
  'https://unpkg.com/prettier@2.8.8/parser-html.js',
  'https://unpkg.com/prettier@2.8.8/parser-babel.js',
  'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js'
];

self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c=> c.addAll(OFFLINE_URLS).catch(()=>{/*ignore*/}))
  );
});

self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(cached=>{
      if(cached) return cached;
      return fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=> c.put(req, copy));
        return res;
      }).catch(()=> caches.match('./code.html'));
    })
  );
});

// ===== AUTO UPDATE SERVICE WORKER HANDLER =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // hapus cache lama jika versi berubah
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE) {
            return caches.delete(name);
          }
        })
      );
      await self.clients.claim();

      // beri tahu semua tab agar reload paksa
      const clientsList = await self.clients.matchAll({ type: 'window' });
      for (const client of clientsList) {
        client.postMessage({ type: 'RELOAD_PAGE' });
      }
    })()
  );
});
