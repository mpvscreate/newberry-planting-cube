// Newberry EC Cube — service worker
// Bumped to v2: caches the current active app (UPDATE 9) and uses a
// network-first strategy for the page itself, so an online device always
// gets the freshest build while an offline device still opens from cache.
// (v1 cached an outdated filename and served pages cache-first, which could
// pin a stale copy of the app — that is fixed here.)
const CACHE_NAME = 'newberry-ec-cube-v3';

// Precache the active app + manifest + install icons so it opens (and installs)
// offline even on a cold start.
const APP_SHELL = [
  './Newberry_Planting_Cube UPDATE 9.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];
const FALLBACK_PAGE = './Newberry_Planting_Cube UPDATE 9.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   • HTML / navigations   → network-first, fall back to cache (fresh online, works offline)
//   • other same-origin GET → stale-while-revalidate (fast + self-healing)
//   • cross-origin (e.g. the live weather API) → left untouched, always network
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(cached => cached || caches.match(FALLBACK_PAGE)))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
