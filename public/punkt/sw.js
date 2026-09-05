// Minimal service worker for Punkt — required for iOS/Android to treat
// the app as installable. No offline caching yet: everything goes
// straight to the network so tasks are never served stale.
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
    // Intentionally a no-op: let the browser handle every request
    // normally. Having a fetch handler at all is what makes iOS Safari
    // consider this an installable, standalone-capable web app.
});
