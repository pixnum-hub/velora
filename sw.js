// Velora PWA Service Worker · Manik Roy © 2026
const CACHE = 'velora-v1';
const STATIC = [
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-maskable-192x192.png',
  './icon-maskable-512x512.png',
  './apple-touch-icon.png',
  './favicon-32x32.png',
  './favicon-16x16.png'
];

// Install: pre-cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for API, Cache-first for static
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls: network first, no cache fallback (always fresh data)
  const isAPI = url.hostname.includes('open-meteo.com') ||
                url.hostname.includes('ipapi.co') ||
                url.hostname.includes('nominatim.openstreetmap.org');

  if (isAPI) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(
        JSON.stringify({ error: 'offline' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Static assets: cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// Background sync placeholder for future use
self.addEventListener('sync', e => {
  if (e.tag === 'weather-sync') {
    console.log('[Velora SW] Background sync triggered');
  }
});

// Push notification handler (for future alerts)
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'Velora', body: 'Weather update available' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192x192.png',
      badge: './icon-72x72.png',
      vibrate: [200, 100, 200],
      data: { url: './' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || './'));
});
