const CACHE_STATIC = 'fozila-static-v13';
const CACHE_AUDIO  = 'fozila-audio-v3';

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
    caches.open(CACHE_STATIC).then(async cache => {
      for (const url of STATIC_FILES) {
        try {
          // Forcer sans compression pour que le cache soit lisible hors ligne
          const response = await fetch(url, {
            cache: 'no-cache',
            headers: { 'Accept-Encoding': 'identity' }
          });
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch(e) {
          console.log('Erreur cache:', url, e);
        }
      }
    })
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

  // Fichiers statiques — cache first, réseau en fallback
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached && cached.headers.get('content-length') !== '0') {
      return cached;
    }
    try {
      const response = await fetch(event.request, { cache: 'no-cache' });
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
      }
      return response;
    } catch {
      return cached || await caches.match('/index.html');
    }
  })());
});
