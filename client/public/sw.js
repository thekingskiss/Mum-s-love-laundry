/* Mum's Love Laundry service worker.
 *
 * What it does:
 *   - Keeps the app shell (index.html + every hashed JS/CSS/image file the person
 *     has already loaded) so the installed app opens instantly and offline.
 *   - Shows /offline.html when a page can't be loaded and nothing is cached.
 *
 * What it deliberately never does: touch the API. Orders, payments and profiles
 * always come from the network, so nobody sees stale balances or another
 * person's data from a cache.
 *
 * __BUILD_ID__ is replaced with a fresh value on every `vite build` (see
 * vite.config.js), which is what makes browsers notice a new version.
 */
const BUILD = '__BUILD_ID__';
const SHELL_CACHE = `mll-shell-${BUILD}`;
const ASSET_CACHE = 'mll-assets-v1';
const MAX_ASSETS = 120;
const NAVIGATION_TIMEOUT_MS = 6000;

const PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One missing file must not stop the worker installing.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('mll-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// The page asks for the waiting worker to take over once the person taps
// "Update", so a refresh never happens in the middle of filling in a form.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Other origins (the API in development, fonts, payment pages) are the browser's business.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Vite names built files by content hash, so a cached copy is never out of date.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match('/');

  try {
    // With a cached shell to fall back on, don't make the person wait on a bad connection.
    const controller = new AbortController();
    const timer = cached ? setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS) : null;
    const response = await fetch(request, { signal: controller.signal });
    if (timer) clearTimeout(timer);

    const isHtml = (response.headers.get('content-type') || '').includes('text/html');
    // Every route serves the same single-page shell, so one copy covers them all.
    if (response.ok && isHtml) cache.put('/', response.clone());
    return response;
  } catch {
    return cached || (await cache.match('/offline.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);

  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        trim(cache);
      }
      return response;
    })
    .catch(() => null);

  if (hit) {
    refresh.catch(() => {});
    return hit;
  }
  return (await refresh) || Response.error();
}

// Old builds' hashed files would otherwise pile up forever.
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ASSETS) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ASSETS).map((key) => cache.delete(key)));
}
