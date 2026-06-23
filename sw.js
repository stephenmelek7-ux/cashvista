// =============================================
// CASHVISTA SERVICE WORKER
// Complete and Verified for PWA Installation
// =============================================

const CACHE_NAME = 'cashvista-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/admin.html',
  '/settings.html',
  '/admin-login.html'
];

// =============================================
// INSTALL EVENT - Cache static assets
// =============================================
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(function() {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.log('Service Worker: Cache failed', error);
      })
  );
});

// =============================================
// ACTIVATE EVENT - Clean old caches
// =============================================
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating...');
  
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
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// =============================================
// FETCH EVENT - Smart caching strategy
// =============================================
self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);
  
  // ===== SKIP CACHING FOR SUPABASE API =====
  if (requestUrl.hostname.includes('supabase.co')) {
    console.log('Service Worker: Bypassing cache for Supabase API');
    event.respondWith(fetch(event.request));
    return;
  }
  
  // ===== SKIP CACHING FOR EXTERNAL RESOURCES =====
  if (requestUrl.hostname !== self.location.hostname) {
    console.log('Service Worker: Bypassing cache for external resource');
    event.respondWith(fetch(event.request));
    return;
  }
  
  // ===== CACHE FIRST STRATEGY FOR STATIC ASSETS =====
  event.respondWith(
    caches.match(event.request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return cachedResponse;
        }
        
        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(function(response) {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the response for future use
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              })
              .catch(function(err) {
                console.log('Service Worker: Cache put error:', err);
              });
            
            return response;
          })
          .catch(function(error) {
            console.log('Service Worker: Fetch failed:', error);
            
            // Return fallback for HTML pages
            const acceptHeader = event.request.headers.get('accept') || '';
            if (acceptHeader.includes('text/html')) {
              console.log('Service Worker: Returning fallback index.html');
              return caches.match('/index.html');
            }
            
            // Return a simple error response
            return new Response('Network error - please check your connection', { 
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// =============================================
// MESSAGE EVENT - Handle messages from the app
// =============================================
self.addEventListener('message', function(event) {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
