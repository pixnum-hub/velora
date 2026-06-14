// Velora PWA Service Worker · Manik Roy © 2026
// v3 — updated with allergy index, rain index, all fixes
const CACHE = 'velora-v4';
const STATIC = [
  './',
  './index.html',
  './manifest.json',
  './icon-72x72.png',
  './icon-96x96.png',
  './icon-128x128.png',
  './icon-144x144.png',
  './icon-152x152.png',
  './icon-192x192.png',
  './icon-384x384.png',
  './icon-512x512.png',
  './icon-maskable-192x192.png',
  './icon-maskable-512x512.png',
  './apple-touch-icon.png',
  './favicon-32x32.png',
  './favicon-16x16.png',
  './og-image.png'
];

// API hostnames — always network-first, never cached
const API_HOSTS = [
  'open-meteo.com',
  'air-quality-api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'ipapi.co',
  'nominatim.openstreetmap.org'
];

// Install — pre-cache all static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete all old cache versions
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[Velora SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', e => {
  // Only handle http/https
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);
  const isAPI = API_HOSTS.some(h => url.hostname.includes(h));

  if (isAPI) {
    // API: network-only, return empty JSON on failure (app handles gracefully)
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Static: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            cache.put(e.request, res.clone());
          }
          return res;
        }).catch(() => cached || caches.match('./index.html'));
        // Return cached immediately, update in background
        return cached || fetchPromise;
      })
    )
  );
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'Velora', body: 'New weather update available' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192x192.png',
      badge: './icon-72x72.png',
      vibrate: [200, 100, 200],
      tag: 'velora-weather',
      renotify: true,
      data: { url: './' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const existing = cls.find(c => c.url.includes('index.html') && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow('./');
    })
  );
});

// Background sync
self.addEventListener('sync', e => {
  if (e.tag === 'velora-sync') {
    console.log('[Velora SW] Background sync fired');
  }
});
