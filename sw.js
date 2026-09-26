/* Service worker: keeps the app working without internet. Bump VERSION after each update. */
const VERSION = 'raincy-coach-v8';
const JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
const FILES = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/icons.js', 'js/board.js', 'js/store.js', 'js/ui.js', 'js/exporter.js', 'js/auth.js', 'js/media.js', 'js/ratings.js', 'js/library.js', 'js/help.js', 'js/people.js', 'js/editor.js', 'js/views.js', 'js/app.js',
  'icons/crest.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES).then(() => c.add(new Request(JSPDF, { mode: 'cors' })).catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // PDF libraries come from a CDN with fixed versions: cache first, so they also work offline
  if (e.request.url.startsWith('https://cdn.jsdelivr.net/npm/')) {
    e.respondWith(caches.match(e.request.url).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request.url, copy)); return res; })));
    return;
  }
  if (new URL(e.request.url).origin !== location.origin) return;
  // App files: network first so updates arrive when online; cache when offline
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
