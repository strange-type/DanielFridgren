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

self.addEventListener('push', (event) => {
    let payload = { title: 'Punkt', body: 'Du har en påminnelse.' };
    if (event.data) {
        try {
            payload = event.data.json();
        } catch {
            payload.body = event.data.text();
        }
    }
    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: '/punkt/icons/icon-192.png',
            badge: '/punkt/icons/icon-192.png',
            data: { url: '/punkt/' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/punkt/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes('/punkt/') && 'focus' in client) return client.focus();
            }
            return self.clients.openWindow(url);
        })
    );
});
