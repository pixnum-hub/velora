// Velora service worker
const CACHE = 'velora-v3'; // bumped: icon paths moved into icons/, must bust old cache
const CORE_ASSETS = [
  './manifest.json',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/favicon-16x16.png',
  './icons/favicon-32x32.png',
  './icons/apple-touch-icon.png'
];

// Guard: never activate on Claude preview / sandbox domains
const BLOCKED_HOSTS = ['claude.site', 'claudeusercontent.com', 'anthropic.com'];
function isBlockedHost() {
  return BLOCKED_HOSTS.some(h => self.location.hostname.endsWith(h));
}

self.addEventListener('install', (event) => {
  if (isBlockedHost()) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (isBlockedHost()) return;
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache live weather/AQI/geocoding/map API calls — always go to network
  const liveHosts = [
    'api.open-meteo.com',
    'geocoding-api.open-meteo.com',
    'air-quality-api.open-meteo.com',
    'nominatim.openstreetmap.org',
    'api.rainviewer.com',
    'tilecache.rainviewer.com',
    'tile.openstreetmap.org',
    'api.weather.gov',
    'nhc.noaa.gov'
  ];
  if (liveHosts.some((h) => url.hostname.includes(h))) {
    event.respondWith(fetch(req).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // App shell HTML: network-first so updates show up immediately.
  // Falls back to the cached copy only when offline.
  const isHtmlShell = url.origin === self.location.origin &&
    (url.pathname.endsWith('/') || url.pathname.endsWith('index.html'));
  if (isHtmlShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Other same-origin static assets (icons, manifest): cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
