// =============================================
// CASHVISTA SERVICE WORKER
// =============================================

const CACHE_NAME = 'cashvista-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/invest.html',
  '/advertise.html',
  '/watch.html',
  '/profile.html',
  '/withdraw.html',
  '/referral-network.html',
  '/admin-login.html',
  '/admin.html',
  '/settings.html',
  '/forgot-password.html',
  '/terms.html',
  '/privacy.html'
];

// =============================================
// INSTALL - Cache all files
// =============================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('CashVista: Cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

// =============================================
// FETCH - Serve from cache, fallback to network
// =============================================
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Clone the request
        var fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          function(response) {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            var responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          }
        );
      })
  );
});

// =============================================
// ACTIVATE - Clean up old caches
// =============================================
self.addEventListener('activate', function(event) {
  var cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
