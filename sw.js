// sw.js - simple service worker to cache shell and external assets for offline use
const CACHE = 'vscode-web-cache-v1';
const OFFLINE_URLS = [
  './',
  './code.html',
  './style.css',
  './main.js',
  './prettier.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs/loader.min.js',
  'https://unpkg.com/prettier@2.8.8/standalone.js',
  'https://unpkg.com/prettier@2.8.8/parser-html.js',
  'https://unpkg.com/prettier@2.8.8/parser-babel.js'
];

// install
self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c=> c.addAll(OFFLINE_URLS).catch(()=>{/*ignore individual failures*/}))
  );
});

// activate
self.addEventListener('activate', e=>{
  e.waitUntil(self.clients.claim());
});

// fetch handler - network first for API, otherwise cache-first
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(cached=>{
      if(cached) return cached;
      return fetch(req).then(res=>{
        // put in cache for future
        const copy = res.clone();
        caches.open(CACHE).then(c=> c.put(req, copy));
        return res;
      }).catch(()=> {
        // fallback to offline page if any
        return caches.match('./code.html');
      });
    })
  );
});
