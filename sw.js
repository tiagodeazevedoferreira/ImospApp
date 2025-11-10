const CACHE_NAME = 'financas-v1';
const urlsToCache = [
  '/',
  '/ImospApp/',
  '/ImospApp/index.html',
  '/ImospApp/script.js',
  '/ImospApp/style.css',
  '/ImospApp/manifest.json',
  '/ImospApp/icon-192.png',
  '/ImospApp/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});