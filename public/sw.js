const CACHE_STATIC = 'fozila-static-v9';
const CACHE_AUDIO  = 'fozila-audio-v2';

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

  // Ignorer les ressources externes
  if (url.origin !== self.location.origin) return;

  // ── AUDIO : cache + gestion des range requests ──
  if (url.pathname.startsWith('/api/download/')) {
    event.respondWith((async () => {
      const cache    = await caches.open(CACHE_AUDIO);
      const cacheKey = event.request.url; // URL sans les headers Range
      const cached   = await cache.match(cacheKey);

      if (cached) {
        // Gérer les range requests depuis le cache
        const rangeHeader = event.request.headers.get('Range');
        if (rangeHeader) {
          const arrayBuffer = await cached.clone().arrayBuffer();
          const bytes       = new Uint8Array(arrayBuffer);
          const total       = bytes.length;
          const match       = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (match) {
            const start = parseInt(match[1], 10);
            const end   = match[2] ? parseInt(match[2], 10) : total - 1;
            const chunk = bytes.slice(start, end + 1);
            return new Response(chunk, {
              status: 206,
              headers: {
                'Content-Type':  cached.headers.get('Content-Type') || 'audio/mpeg',
                'Content-Range': `bytes ${start}-${end}/${total}`,
                'Content-Length': String(chunk.length),
                'Accept-Ranges': 'bytes',
              }
            });
          }
        }
        return cached;
      }

      // Pas en cache — fetch depuis le réseau
      try {
        // Fetch sans range header pour avoir la réponse complète à mettre en cache
        const fullRequest = new Request(cacheKey, {
          method: 'GET',
          headers: { 'Authorization': event.request.headers.get('Authorization') || '' }
        });
        const response = await fetch(fullRequest);
        if (response.ok && response.status === 200) {
          const clone = response.clone();
          cache.put(cacheKey, clone);
        }
        return response;
      } catch {
        return new Response('Audio non disponible hors ligne', { status: 503 });
      }
    })());
    return;
  }

  // ── Autres API : réseau uniquement ──
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

  // ── Fichiers statiques : network first ──
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const clone = response.clone();
        const cache = await caches.open(CACHE_STATIC);
        cache.put(event.request, clone);
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      return cached || await caches.match('/index.html');
    }
  })());
});
