/*
 * EatWise service worker (spec §23) — hand-rolled, no Workbox (Next 16 +
 * Turbopack compatibility).
 *
 * Caching policy (hard-won rule: HTML/API are ALWAYS network-first —
 * cache-first on those serves stale pages/endpoints after every deploy):
 *   - navigations        → network-first, fallback to cached /offline.html
 *   - /_next/static/**   → cache-first (content-hashed, immutable)
 *   - /api/**            → network only (auth + fresh data; never cached)
 *   - other same-origin  → stale-while-revalidate
 *   - cross-origin       → network only
 *
 * Offline food-log queueing lives in the app (Dexie), not here — server
 * actions can't be replayed from the SW reliably.
 */
const VERSION = "eatwise-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("eatwise-") && !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Navigations: network-first, offline fallback shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache successful app-shell navigations for offline display.
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          // Offline: try a cached copy of this exact URL, else the shell.
          const cached = await caches.match(req);
          if (cached && cached.ok) return cached;
          const offline = await caches.match("/offline.html");
          if (offline) return offline;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  // API: never cached (auth, freshness, AI quota safety).
  if (url.pathname.startsWith("/api/")) return;

  // Same-origin only below.
  if (url.origin !== self.location.origin) return;

  // Immutable hashed build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Everything else same-origin (icons, fonts, _next chunks): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
