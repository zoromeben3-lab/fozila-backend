const CACHE_STATIC  = 'fozila-static-v6';
const CACHE_AUDIO   = 'fozila-audio-v1';

const STATIC_FILES = [
  '/',
  '/index.html',
  '/albums.html',
  '/singles.html',
  '/auth.html',
  '/dashboard.html',
  '/album-detail.html',
  '/player.html',
  '/fozila.css',
  '/fozila.js',
  '/bg-pattern.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// Installation — met en cache les fichiers statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// Activation — supprime les vieux caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_STATIC && k !== CACHE_AUDIO).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── AUDIO : cache après première écoute ──
  if (url.pathname.startsWith('/api/download/')) {
    event.respondWith(
      caches.open(CACHE_AUDIO).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached; // Hors ligne ou déjà en cache
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return cached || new Response('Audio non disponible hors ligne', { status: 503 });
        }
      })
    );
    return;
  }

  // ── API : toujours réseau, jamais de cache ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Hors ligne' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // ── FICHIERS STATIQUES : network first, cache en fallback ──
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then(cached => cached || caches.match('/index.html'))
    )
  );
});
