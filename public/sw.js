const CACHE_VERSION = "mikopo-pwa-v3";
const STATIC_CACHE = `mikopo-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `mikopo-dynamic-${CACHE_VERSION}`;

// Core assets to precache for offline application shell
const PRECACHE_ASSETS = [
  "/",
  "/auth",
  "/terms",
  "/privacy",
  "/manifest.json",
  "/pwa-icon.png",
  "/pwa-icon-192.png",
  "/favicon.png",
  "/favicon.ico",
  "/hero-image.png",
  "/robots.txt",
  "/sitemap.xml",
];

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>You're offline</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      @media (prefers-color-scheme: dark) {
        body { background: #0b0f19; color: #f3f4f6; }
        .card p { color: #9ca3af !important; }
        .primary { background: #f3f4f6 !important; color: #111 !important; }
        .secondary { background: #1f2937 !important; color: #f3f4f6 !important; border-color: #374151 !important; }
        .status-note { color: #6b7280 !important; }
      }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
      p { color: #4b5563; font-size: 0.875rem; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
      .status-note { margin-top: 1.25rem; font-size: 0.75rem; color: #9ca3af; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>You're offline</h1>
      <p>Please check your internet connection and try again, or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
      <div class="status-note">Auto-detecting network connection...</div>
    </div>
    <script>
      window.addEventListener('online', function() {
        location.reload();
      });
    </script>
  </body>
</html>`;

// Install Event - Precache core shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        // Use individual adds so one failure doesn't abort the entire precache
        for (const asset of PRECACHE_ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn(`[SW] Precache skipped for ${asset}:`, err);
          }
        }
      })
      .then(() => {
        // Force waiting service worker to activate immediately
        return self.skipWaiting();
      }),
  );
});

// Activate Event - Clean up old cache versions & claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith("mikopo-") && name !== STATIC_CACHE && name !== DYNAMIC_CACHE,
            )
            .map((name) => {
              console.log("[SW] Removing old cache:", name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients that SW is activated
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "SW_ACTIVATED", version: CACHE_VERSION });
          });
        });
      }),
  );
});

// Helper: Determine request type
function isApiRequest(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/_server_fn");
}

function isStaticAsset(url) {
  return (
    url.pathname.match(
      /\.(js|mjs|css|png|jpg|jpeg|svg|webp|gif|ico|icon|woff|woff2|ttf|otf|eot|json|webmanifest)$/i,
    ) ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.pathname.startsWith("/assets/")
  );
}

// Fetch Handler with Smart Offline Caching & Background Revalidation
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations like POST, PUT, DELETE cannot be cached)
  if (request.method !== "GET") {
    return;
  }

  // 1. Navigation Requests (Page Visits): Network-First without premature timeout
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Check if the specific visited page was cached before
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          // Check if root shell is in cache (TanStack router takes over client-side navigation)
          const rootCache = await caches.match("/");
          if (rootCache) return rootCache;

          // Precached auth fallback
          const authCache = await caches.match("/auth");
          if (authCache) return authCache;

          // Standalone styled offline fallback page matching error page design
          return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }),
    );
    return;
  }

  // 2. Static Assets (JS, CSS, Images, Fonts): Stale-While-Revalidate with background updates
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }

  // 3. API & Server Functions Queries: Network-First with Dynamic Cache Fallback
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return graceful offline fallback JSON payload
          return new Response(
            JSON.stringify({
              _offline: true,
              message: "Offline mode: Using locally cached state.",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }),
    );
    return;
  }

  // 4. Default: Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// Handle postMessage commands from client & perform background revalidation
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Revalidate core precache assets when client signals online status
  if (event.data.type === "ONLINE_SYNC" || event.data.type === "CHECK_UPDATES") {
    caches.open(STATIC_CACHE).then(async (cache) => {
      for (const asset of PRECACHE_ASSETS) {
        try {
          const response = await fetch(asset, { cache: "reload" });
          if (response.status === 200) {
            await cache.put(asset, response);
          }
        } catch (e) {
          // Ignore transient background update failures
        }
      }
    });
  }
});

// ==========================================
// Web Push Notifications Handling
// ==========================================
self.addEventListener("push", (event) => {
  let data = {
    title: "Alert",
    message: "You have a new update.",
    url: "/",
    icon: "/pwa-icon.png",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.message = event.data.text();
    }
  }

  const options = {
    body: data.message || data.body || "",
    icon: data.icon || "/pwa-icon.png",
    badge: "/pwa-icon.png",
    data: {
      url: data.url || data.link || "/",
    },
    vibrate: [100, 50, 100],
    tag: data.tag || "notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title || "Notification", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this origin
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // If no window is open, open a new window/tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    }),
  );
});
