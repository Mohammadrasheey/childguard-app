/* CHILD-GUARD service worker: the app shell works offline; results refresh from the network when online. */
const VERSION = "childguard-1.0.1";
const SHELL = [
  "./", "index.html", "app.js", "app.css", "manifest.webmanifest",
  "ds/childguard.css", "ds/childguard.js",
  "vendor/react.production.min.js", "vendor/react-dom.production.min.js",
  "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Results: network first, so a new pipeline run shows up; cached copy when offline.
  if (url.origin === location.origin && url.pathname.endsWith("/data/app_data.json")) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); if (res.ok) caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req)));
    return;
  }
  // Google Fonts: cache on first use.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // App shell: cache first.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match("index.html"))));
  }
});
