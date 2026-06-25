// =============================================
// CASHVISTA SERVICE WORKER - FIXED v7
// =============================================

const CACHE_VERSION = 'v7';
const CACHE_NAME = `cashvista-${CACHE_VERSION}`;

// =============================================
// STATIC ASSETS TO CACHE
// =============================================
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/watch.html',
  '/advertise.html',
  '/invest.html',
  '/withdraw.html',
  '/admin.html',
  '/admin-login.html',
  '/settings.html',
  '/referral-network.html',
  '/manifest.json',
  '/favicon.svg'
];

// =============================================
// ✅ INSTALL EVENT - FORCE DELETE ALL OLD CACHES FIRST
// =============================================
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing version', CACHE_VERSION);
  
  event.waitUntil(
    // STEP 1: Delete ALL existing caches first
    caches.keys()
      .then(function(cacheNames) {
        console.log('Service Worker: Found', cacheNames.length, 'old caches to delete');
        return Promise.all(
          cacheNames.map(function(cacheName) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      // STEP 2: Then open new cache
      .then(function() {
        console.log('Service Worker: All old caches deleted');
        return caches.open(CACHE_NAME);
      })
      // STEP 3: Cache all static assets
      .then(function(cache) {
        console.log('Service Worker: Caching', STATIC_ASSETS.length, 'static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      // STEP 4: Skip waiting to activate immediately
      .then(function() {
        console.log('Service Worker: Installation complete, skipping wait');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.log('Service Worker: Installation error:', error);
      })
  );
});

// =============================================
// ✅ ACTIVATE EVENT - CLAIM ALL CLIENTS
// =============================================
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating version', CACHE_VERSION);
  
  event.waitUntil(
    // Clean up any remaining old caches (safety net)
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Cleanup - deleting cache:', cacheName);
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
// ✅ FETCH EVENT - NETWORK FIRST, CACHE FALLBACK
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

  // ===== 3. ✅ NETWORK FIRST FOR HTML PAGES =====
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
        .catch(function(error) {
          console.log('Service Worker: Network failed for', request.url, 'trying cache');
          return caches.match(request)
            .then(function(cachedResponse) {
              if (cachedResponse) {
                console.log('Service Worker: Serving from cache:', request.url);
                return cachedResponse;
              }
              // Fallback to dashboard
              console.log('Service Worker: No cache, falling back to dashboard');
              return caches.match('/dashboard.html');
            });
        })
    );
    return;
  }

  // ===== 4. ✅ CACHE FIRST FOR STATIC ASSETS =====
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
            console.log('Service Worker: Fetch failed for', request.url);
            // Try to return a fallback
            if (request.url.includes('.css')) {
              return new Response('/* Fallback CSS */', { headers: { 'Content-Type': 'text/css' } });
            }
            if (request.url.includes('.js')) {
              return new Response('// Fallback JS', { headers: { 'Content-Type': 'application/javascript' } });
            }
            return new Response('Network error', { status: 503 });
          });
      })
  );
});

// =============================================
// ✅ MESSAGE EVENT - SKIP WAITING
// =============================================
self.addEventListener('message', function(event) {
  console.log('Service Worker: Received message', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Skipping waiting');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CHECK_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION,
      name: CACHE_NAME,
      assets: STATIC_ASSETS.length
    });
  }
});

// =============================================
// ✅ PUSH NOTIFICATION (Optional)
// =============================================
self.addEventListener('push', function(event) {
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/favicon.svg',
    badge: '/favicon.svg'
  };
  
  event.waitUntil(
    self.registration.showNotification('CashVista', options)
  );
});

console.log('✅ Service Worker v' + CACHE_VERSION + ' loaded successfully!');
