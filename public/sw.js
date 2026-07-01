const CACHE_STATIC = 'fozila-static-v7';
const CACHE_AUDIO  = 'fozila-audio-v1';

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
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_STATIC && k !== CACHE_AUDIO).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Laisser passer toutes les ressources externes (Cloudinary, Google, etc.)
  if (url.origin !== self.location.origin) {
    return; // Pas de cache, fetch normal
  }

  // Audio API — cache après première écoute
  if (url.pathname.startsWith('/api/download/')) {
    event.respondWith(
      caches.open(CACHE_AUDIO).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
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

  // Autres API — toujours réseau
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

  // Fichiers statiques — network first, cache en fallback
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        caches.open(CACHE_STATIC).then(cache => cache.put(event.request, response.clone()));
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then(cached => cached || caches.match('/index.html'))
    )
  );
});
