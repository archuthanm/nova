const CACHE_NAME = 'nova-cache-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/main.css',
    '/js/app.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then(response => response || fetch(e.request)));
});