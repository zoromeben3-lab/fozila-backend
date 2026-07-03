const CACHE_STATIC = 'fozila-static-v10';
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

  // Ignorer toutes les ressources externes
  if (url.origin !== self.location.origin) return;

  // ── AUDIO : cache + gestion range requests ──
  if (url.pathname.startsWith('/api/download/')) {
    event.respondWith((async () => {
      const cache    = await caches.open(CACHE_AUDIO);
      const cacheKey = url.pathname + url.search;
      const cached   = await cache.match(cacheKey);

      if (cached) {
        const rangeHeader = event.request.headers.get('Range');
        if (rangeHeader) {
          const ab    = await cached.clone().arrayBuffer();
          const bytes = new Uint8Array(ab);
          const total = bytes.length;
          const m     = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (m) {
            const start = parseInt(m[1], 10);
            const end   = m[2] ? parseInt(m[2], 10) : total - 1;
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

      // Pas en cache — fetch réseau
      try {
        const response = await fetch(event.request);
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
