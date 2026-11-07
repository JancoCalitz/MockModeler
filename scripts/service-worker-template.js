/* global self, caches */
// Keeps the app working without an internet connection. The build fills in the placeholders.
// eslint-disable-next-line no-undef
const ASSETS = __ASSETS__;
const APP_CACHE = 'mockmodeler-app-__APP_VERSION__';
const INDEX = new URL('index.html', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(ASSETS.map((path) => new URL(path, self.location).href))),
  );
});

// A new version waits until no tab is using the old one, as an open page may still need the old
// version's files. Controlling the page on the very first visit is safe, as nothing is older.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('mockmodeler-') && name !== APP_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function fromNetworkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(INDEX, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(INDEX);
    if (saved) return saved;
    throw error;
  }
}

async function fromCacheFirst(request) {
  // A server may send "Vary: Origin", which would stop the page's requests matching saved copies.
  const saved = await caches.match(request, { ignoreVary: true });
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(APP_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    request.mode === 'navigate' ? fromNetworkFirst(request) : fromCacheFirst(request),
  );
});
