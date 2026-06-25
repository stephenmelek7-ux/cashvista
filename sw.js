// =============================================
// CASHVISTA SERVICE WORKER - FIXED v6
// =============================================

const CACHE_VERSION = 'v6';
const CACHE_NAME = `cashvista-${CACHE_VERSION}`;

// =============================================
// STATIC ASSETS TO CACHE
// =============================================
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/watch.html',           // ✅ ADDED - FIXED
  '/advertise.html',        // ✅ ADDED
  '/invest.html',           // ✅ ADDED
  '/withdraw.html',         // ✅ ADDED
  '/admin.html',            // ✅ ADDED
  '/admin-login.html',      // ✅ ADDED
  '/settings.html',         // ✅ ADDED
  '/manifest.json',
  '/favicon.svg'
];

// =============================================
// INSTALL EVENT
// =============================================
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing version', CACHE_VERSION);
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
// ACTIVATE EVENT - DELETE OLD CACHES
// =============================================
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating version', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            // Delete all caches that don't match current version
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        console.log('Service Worker: Taking control of all clients');
        return self.clients.claim();
      })
  );
});

// =============================================
// FETCH EVENT - SMART CACHING STRATEGY
// =============================================
self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);
  const request = event.request;

  // ===== 1. SKIP SUPABASE API =====
  if (requestUrl.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
  }

  // ===== 2. SKIP EXTERNAL RESOURCES =====
  if (requestUrl.hostname !== self.location.hostname) {
    event.respondWith(fetch(request));
    return;
  }

  // ===== 3. NETWORK FIRST FOR HTML PAGES (CRITICAL FIX) =====
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          // Cache the fresh response
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          // If network fails, serve from cache
          return caches.match(request)
            .then(function(cachedResponse) {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Fallback to dashboard if page not cached
              return caches.match('/dashboard.html');
            });
        })
    );
    return;
  }

  // ===== 4. CACHE FIRST FOR STATIC ASSETS (CSS, JS, Images) =====
  event.respondWith(
    caches.match(request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request)
          .then(function(response) {
            // Cache valid responses
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(function(error) {
            console.log('Service Worker: Fetch failed for', request.url, error);
            // Return offline page if available
            return caches.match('/offline.html');
          });
      })
  );
});

// =============================================
// MESSAGE EVENT - FORCE UPDATE
// =============================================
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Check for version update message
  if (event.data && event.data.type === 'CHECK_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION,
      name: CACHE_NAME
    });
  }
});

// =============================================
// PERIODIC CACHE CLEANUP (Optional)
// =============================================
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'clean-caches') {
    event.waitUntil(
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  }
});

console.log('Service Worker: Loaded successfully!');
