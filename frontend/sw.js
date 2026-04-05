/**
 * SLM MARKET - Service Worker (PWA)
 * Caching strategies: App Shell, API responses, Assets
 * Version: 7.0.0
 */

const CACHE_NAME = 'slm-market-v7';
const STATIC_CACHE = 'slm-static-v7';
const API_CACHE = 'slm-api-v7';

// Assets to pre-cache (App Shell)
const APP_SHELL = [
    '/',
    '/index.html',
    '/frontend-spa.js',
    '/styles/main.css',
    '/styles/components.css',
    '/styles/responsive.css',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [
    /\/api\/v1\/products/,
];

// ============================================================
// INSTALL EVENT — Pre-cache App Shell
// ============================================================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v7...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(APP_SHELL.filter(url => {
                // Only cache resources that exist
                return fetch(url).then(() => true).catch(() => false);
            }).then ? APP_SHELL : []))
            .then(() => self.skipWaiting())
            .catch(err => console.warn('[SW] Pre-cache failed:', err))
    );
});

// ============================================================
// ACTIVATE EVENT — Clean old caches
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker v7...');

    const validCaches = [CACHE_NAME, STATIC_CACHE, API_CACHE];

    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(name => !validCaches.includes(name))
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            ))
            .then(() => self.clients.claim())
    );
});

// ============================================================
// FETCH EVENT — Intercept requests
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and cross-origin requests (except API)
    if (request.method !== 'GET') return;

    // API requests — Network First, fallback to cache
    if (url.pathname.startsWith('/api/') || API_CACHE_PATTERNS.some(p => p.test(url.pathname))) {
        event.respondWith(networkFirst(request, API_CACHE, 60));
        return;
    }

    // Static assets — Cache First, fallback to network
    if (
        url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2|woff)$/)
    ) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // HTML pages — Network First
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirst(request, CACHE_NAME, 0));
        return;
    }

    // Default: network
    event.respondWith(fetch(request).catch(() => caches.match(request)));
});

// ============================================================
// STRATEGIES
// ============================================================

/**
 * Cache First: serve from cache, fallback to network
 */
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Network First: try network, fallback to cache
 * maxAgeSeconds: 0 means no cache TTL check
 */
async function networkFirst(request, cacheName, maxAgeSeconds = 300) {
    const cache = await caches.open(cacheName);

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;

        // Return offline page for navigation
        if (request.mode === 'navigate') {
            return cache.match('/index.html') || new Response(
                '<h1>Hors ligne</h1><p>Vérifiez votre connexion internet.</p>',
                { headers: { 'Content-Type': 'text/html' } }
            );
        }

        return new Response(JSON.stringify({ success: false, message: 'Hors ligne' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ============================================================
// BACKGROUND SYNC — Queue failed POST requests
// ============================================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-orders') {
        event.waitUntil(syncPendingOrders());
    }
});

async function syncPendingOrders() {
    // In production: retry failed order submissions from IndexedDB queue
    console.log('[SW] Syncing pending orders...');
}

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};

    const options = {
        body: data.body || 'Nouvelle notification S.L.M Market',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-72.png',
        data: { url: data.url || '/' },
        actions: [
            { action: 'view', title: 'Voir' },
            { action: 'close', title: 'Fermer' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'S.L.M Market', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'view' || !event.action) {
        const url = event.notification.data?.url || '/';
        event.waitUntil(clients.openWindow(url));
    }
});
