const CACHE_STATIC = 'fozila-static-v14';
const CACHE_AUDIO  = 'fozila-audio-v3';

// Ne pas pré-cacher lors de l'install — laisser le navigateur gérer la décompression
self.addEventListener('install', event => {
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

  // Audio — cache avec gestion range requests
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
                'Content-Type':   cached.headers.get('Content-Type') || 'audio/mpeg',
                'Content-Range':  `bytes ${start}-${end}/${total}`,
                'Content-Length': String(chunk.length),
                'Accept-Ranges':  'bytes',
              }
            });
          }
        }
        return cached;
      }

      try {
        const fetchReq = new Request(url.pathname + url.search, {
          method: 'GET',
          headers: { 'Authorization': event.request.headers.get('Authorization') || '' }
        });
        const response = await fetch(fetchReq);
        if (response.ok && response.status === 200) {
          cache.put(cacheKey, response.clone());
        }
        return response;
      } catch {
        return new Response('Audio non disponible hors ligne', { status: 503 });
      }
    })());
    return;
  }

  // Autres API : réseau uniquement
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
  // Le navigateur décompresse avant de mettre en cache = taille correcte
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_STATIC);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      return cached || await caches.match('/');
    }
  })());
});
