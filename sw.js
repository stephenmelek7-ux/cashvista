// CashVista Service Worker - FIXED
const CACHE_NAME = 'cashvista-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/admin.html',
  '/settings.html'
];

// Install event - cache only static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(function() {
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.log('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// Fetch event - ONLY cache static assets, NOT API calls
self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);
  
  // Skip caching for Supabase API calls
  if (requestUrl.hostname.includes('supabase.co')) {
    // Just fetch from network, don't cache
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Skip caching for external resources
  if (requestUrl.hostname !== self.location.hostname) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For static assets, try cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(function(response) {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clone the response
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              })
              .catch(function(err) {
                console.log('Cache put error:', err);
              });
            return response;
          })
          .catch(function(error) {
            console.log('Fetch failed:', error);
            // Return a fallback response for HTML pages
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            return new Response('Network error', { status: 503 });
          });
      })
  );
});
