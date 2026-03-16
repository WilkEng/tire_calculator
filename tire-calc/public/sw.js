// Tire Calc – Service Worker
// Cache-first for app shell, network-first for API/weather

const CACHE_NAME = "tire-calc-v2";

// App shell files to pre-cache on install
const APP_SHELL = [
  "/tire_calculator/",
  "/tire_calculator/planner",
  "/tire_calculator/temperature",
  "/tire_calculator/history",
  "/tire_calculator/settings",
  "/tire_calculator/help",
  "/tire_calculator/icon-192.png",
  "/tire_calculator/icon-512.png",
  "/tire_calculator/logo-white.svg",
  "/tire_calculator/manifest.json",
];

// Install – pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate – purge old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch – network-first for API, cache-first for everything else
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Network-first for weather / external APIs
  if (
    url.hostname === "api.open-meteo.com" ||
    url.hostname === "geocoding-api.open-meteo.com" ||
    url.hostname === "archive-api.open-meteo.com"
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for same-origin app assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          // Cache successful responses for future offline use
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});
