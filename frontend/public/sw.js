// Minimal service worker for install-to-home-screen PWA support.
// No aggressive caching — always fetches fresh from network so app data stays live.
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", () => { /* pass-through */ });
