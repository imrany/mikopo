const CACHE_VERSION = "mikopo-pwa-v2";
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
  "/hero-image.png",
  "/robots.txt",
  "/sitemap.xml",
];

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
    url.pathname.match(/\.(js|mjs|css|png|jpg|jpeg|svg|webp|gif|ico|woff|woff2|ttf|otf|eot)$/i) ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.pathname.startsWith("/assets/")
  );
}

// Fetch with a timeout helper
function fetchWithTimeout(request, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Network timeout"));
    }, timeoutMs);

    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Fetch Handler with Smart Offline Caching & Background Revalidation
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations like POST, PUT, DELETE cannot be cached)
  if (request.method !== "GET") {
    return;
  }

  // 1. Navigation Requests (Page Visits): Network-First with Fast Fallback to Cache / Shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetchWithTimeout(request, 2500)
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

          // Standalone styled offline fallback page matching Mikopo design system
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8"/>
                <title>Mikopo — Offline Mode</title>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
                <style>
                  :root {
                    --bg-dark: #081310;
                    --card-bg: #0e201b;
                    --card-border: rgba(16, 185, 129, 0.16);
                    --primary-gradient: linear-gradient(135deg, #0d7a64 0%, #10b981 100%);
                    --gold: #f59e0b;
                    --gold-bg: rgba(245, 158, 11, 0.12);
                    --gold-border: rgba(245, 158, 11, 0.28);
                    --text-main: #f0fdf4;
                    --text-muted: #8fa89e;
                  }
                  * { box-sizing: border-box; }
                  body {
                    margin: 0;
                    padding: 24px;
                    font-family: 'Manrope', system-ui, -apple-system, sans-serif;
                    background-color: var(--bg-dark);
                    background-image: 
                      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.18), transparent),
                      radial-gradient(ellipse 60% 40% at 50% 120%, rgba(245, 158, 11, 0.08), transparent);
                    color: var(--text-main);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    overflow-x: hidden;
                  }
                  .card {
                    max-width: 440px;
                    width: 100%;
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 20px;
                    padding: 36px 30px;
                    text-align: center;
                    box-shadow: 
                      0 1px 2px rgba(0, 0, 0, 0.4),
                      0 20px 45px -10px rgba(0, 0, 0, 0.6),
                      0 0 40px -10px rgba(16, 185, 129, 0.15);
                    position: relative;
                    animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                  }
                  @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                  }
                  .brand-mark {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 24px;
                    text-decoration: none;
                  }
                  .brand-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: var(--primary-gradient);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                  }
                  .brand-name {
                    font-family: 'Sora', sans-serif;
                    font-size: 18px;
                    font-weight: 700;
                    color: #ffffff;
                    letter-spacing: -0.02em;
                  }
                  .icon-wrapper {
                    width: 64px;
                    height: 64px;
                    background: var(--gold-bg);
                    border: 1px solid var(--gold-border);
                    border-radius: 18px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 18px;
                    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.12);
                  }
                  .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 12px;
                    border-radius: 9999px;
                    font-size: 12px;
                    font-weight: 600;
                    background: var(--gold-bg);
                    border: 1px solid var(--gold-border);
                    color: #fbbf24;
                    margin-bottom: 14px;
                    letter-spacing: 0.01em;
                  }
                  .badge-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #f59e0b;
                    box-shadow: 0 0 8px #f59e0b;
                    animation: pulse 2s infinite ease-in-out;
                  }
                  @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.85); }
                  }
                  h1 {
                    font-family: 'Sora', sans-serif;
                    font-size: 22px;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    margin: 0 0 10px 0;
                    color: #ffffff;
                  }
                  p {
                    font-size: 14px;
                    color: var(--text-muted);
                    line-height: 1.6;
                    margin: 0 0 24px 0;
                  }
                  .features-box {
                    background: rgba(8, 19, 16, 0.6);
                    border: 1px solid rgba(16, 185, 129, 0.12);
                    border-radius: 12px;
                    padding: 12px 14px;
                    margin-bottom: 24px;
                    text-align: left;
                    font-size: 12px;
                    color: #a3b8af;
                  }
                  .feature-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 0;
                  }
                  .feature-item svg {
                    color: #10b981;
                    shrink: 0;
                  }
                  .btn-primary {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    width: 100%;
                    padding: 13px 20px;
                    background: var(--primary-gradient);
                    color: #ffffff;
                    border: none;
                    border-radius: 12px;
                    font-family: 'Manrope', sans-serif;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    text-decoration: none;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
                  }
                  .btn-primary:hover {
                    opacity: 0.94;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
                  }
                  .btn-primary:active {
                    transform: translateY(0);
                  }
                  .btn-secondary {
                    display: block;
                    width: 100%;
                    padding: 10px 20px;
                    margin-top: 10px;
                    background: transparent;
                    color: var(--text-muted);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    font-family: 'Manrope', sans-serif;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    text-decoration: none;
                    transition: all 0.15s ease;
                  }
                  .btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.04);
                    color: #ffffff;
                    border-color: rgba(255, 255, 255, 0.15);
                  }
                  .status-text {
                    margin-top: 18px;
                    font-size: 11px;
                    color: #64748b;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="brand-mark">
                    <div class="brand-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="8" cy="8" r="6"/>
                        <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
                        <path d="M7 6h1v4"/>
                        <path d="m16.71 13.88.7.71-2.82 2.82"/>
                      </svg>
                    </div>
                    <span class="brand-name">Mikopo</span>
                  </div>

                  <div class="icon-wrapper">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                      <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                      <line x1="12" y1="20" x2="12.01" y2="20"></line>
                    </svg>
                  </div>

                  <div class="badge">
                    <span class="badge-dot"></span>
                    <span>Offline Mode Active</span>
                  </div>

                  <h1>You're Currently Offline</h1>
                  <p>Mikopo is operating from local cache. You can view existing loan balances and account summaries without interruption.</p>

                  <div class="features-box">
                    <div class="feature-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>Cached loan balances and statements ready</span>
                    </div>
                    <div class="feature-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>M-Pesa disbursements & requests will auto-sync on reconnect</span>
                    </div>
                  </div>

                  <button id="retry-btn" class="btn-primary" onclick="handleRetry()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                    </svg>
                    <span>Retry Connection</span>
                  </button>

                  <a href="/" class="btn-secondary">Return to Cached Home</a>

                  <div class="status-text" id="status-info">Auto-detecting network restoration...</div>
                </div>

                <script>
                  function handleRetry() {
                    const btn = document.getElementById('retry-btn');
                    if (btn) btn.innerHTML = 'Checking connection...';
                    setTimeout(() => window.location.reload(), 400);
                  }

                  window.addEventListener('online', () => {
                    const status = document.getElementById('status-info');
                    const btn = document.getElementById('retry-btn');
                    if (status) status.innerText = '✨ Internet restored! Reloading app...';
                    if (btn) btn.innerText = 'Connected! Reloading...';
                    setTimeout(() => window.location.reload(), 500);
                  });
                </script>
              </body>
            </html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
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
    title: "Mikopo Alert",
    message: "You have a new update in Mikopo.",
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
    tag: data.tag || "mikopo-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title || "Mikopo Notification", options));
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
