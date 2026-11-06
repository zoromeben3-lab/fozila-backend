// Service Worker minimal : rend l'app installable, ne met rien en cache
// (sauf la page hors ligne). Tout le reste passe normalement par le réseau.
self.addEventListener('install', e => {
  e.waitUntil(caches.open('foliza-offline').then(c => c.add('/offline.html')).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== 'foliza-offline').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/offline.html')));
  }
});
