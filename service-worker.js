const CACHE = 'hermes-shop-v3';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isShell = url.pathname === '/' || SHELL.some((s) => url.pathname.endsWith(s.replace('./', '/')));
  const isImage = url.pathname.includes('/images/');

  if (isShell) {
    // Network-first for the app itself (index.html) — always try to fetch
    // the latest version first, so any future update shows up on the very
    // next load. Only fall back to the cached copy if the network request
    // actually fails (genuinely offline). The earlier cache-first version of
    // this file kept serving a stale, months-old index.html forever after
    // every subsequent deploy — this is the fix for that.
    event.respondWith(
      fetch(event.request).then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      }).catch(() => caches.match(event.request))
    );
  } else if (isImage) {
    // Product photos rarely change — cache-first is fine and faster here.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached);
      })
    );
  }
});
