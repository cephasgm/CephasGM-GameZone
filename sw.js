/**
 * Service Worker - CephasGM GameZone PWA
 * 
 * This service worker enables offline support, caching, and push notifications
 * for the CephasGM GameZone platform. It caches static assets and provides
 * a fallback offline page when the network is unavailable.
 */

const CACHE_NAME = 'cephasgm-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/css/main.css',
  '/js/app.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached response
          return cachedResponse;
        }

        // Try network
        return fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Network failed - return offline page
            return caches.match('/offline.html');
          });
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'CephasGM GameZone';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/notifications',
      notificationId: data.id
    },
    actions: [
      {
        action: 'open',
        title: 'View'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;

  notification.close();

  if (action === 'open' || !action) {
    const url = notification.data?.url || '/notifications';
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(windowClients => {
          for (const client of windowClients) {
            if (client.url === url && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
    );
  }
});

// Background sync event
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bets') {
    event.waitUntil(syncPendingBets());
  }
});

// Function to sync pending bets
async function syncPendingBets() {
  try {
    const cache = await caches.open('pending-bets');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
          console.log('[SW] Synced pending bet:', request.url);
        }
      } catch (error) {
        console.error('[SW] Failed to sync bet:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Listen for messages from the client
self.addEventListener('message', event => {
  const data = event.data;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'CACHE_BET') {
    event.waitUntil(
      caches.open('pending-bets')
        .then(cache => {
          const request = new Request(data.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.bet)
          });
          return cache.put(request, new Response(JSON.stringify(data.bet)));
        })
        .then(() => {
          // Register background sync
          return self.registration.sync.register('sync-bets');
        })
    );
  }
});
