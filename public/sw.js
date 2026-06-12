// ══════════════════════════════════════════════════
//  FOZILA — Service Worker PWA
// ══════════════════════════════════════════════════

const CACHE_NAME = 'fozila-v1';
const STATIC_FILES = [
  '/',
  '/index.html',
  '/albums.html',
  '/singles.html',
  '/auth.html',
  '/dashboard.html',
  '/album-detail.html',
  '/fozila.css',
  '/fozila.js',
  '/bg-pattern.jpg',
];

// Installation — mise en cache des fichiers statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

// Activation — supprimer les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — stratégie Network First pour l'API, Cache First pour les fichiers statiques
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls → toujours réseau (pas de cache)
  if (url.hostname.includes('onrender.com') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => {
      return new Response(JSON.stringify({ error: 'Hors ligne' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // Fichiers statiques → Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
