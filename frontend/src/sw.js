import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

// Activate a newly installed service worker immediately instead of waiting
// for every open tab to close first — otherwise sw.js changes (like the
// media-cache strategy below) can silently keep running the old version
self.skipWaiting()
clientsClaim()

// Precache the app shell — injected automatically by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)

// Cache events API — network first
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/events'),
    new NetworkFirst({
        cacheName: 'api-events-cache',
        plugins: [
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
        ],
    })
)

// Cache organizations API — network first
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/organizations'),
    new NetworkFirst({
        cacheName: 'api-organizations-cache',
        plugins: [
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
        ],
    })
)

// Cache media — network first, so a fresh upload/edit is never shadowed by
// a stale (or, pre-fix, opaque-failed) cached response; falls back to cache
// only when offline
registerRoute(
    ({ url }) => url.pathname.startsWith('/media/'),
    new NetworkFirst({
        cacheName: 'media-cache',
        plugins: [
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
        ],
    })
)

// ── Push notification handler ──────────────────────────────────────────────

self.addEventListener('push', (event) => {
    let data = { title: 'StuStaApp', body: 'You have a new notification', url: '/' }
    try {
        data = event.data.json()
    } catch (e) {
        // fallback to default
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/pwa-192x192.png',
            badge: '/notification-badge.png',
            data: { url: data.url || '/' },
        })
    )
})

// ── Notification click handler ──────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = event.notification.data?.url || '/'

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url)
                    return client.focus()
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url)
            }
        })
    )
})