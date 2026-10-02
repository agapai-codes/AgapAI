/**
 * AgapAI service worker.
 *
 * Hand-rolled on purpose: no extra dependency, and the caching rules for an
 * emergency app need to be explicit and auditable.
 *
 * Rules of the road:
 *   - /_next/static/* and icons/fonts  -> cache-first (immutable build assets)
 *   - navigations (HTML)               -> network-first with fast offline fallback
 *   - App Router RSC fetches           -> network-first too; the cached copy is
 *                                         only used when the network fails (a
 *                                         replayed payload can belong to another
 *                                         router state and would also mask a dead
 *                                         link while "online")
 *   - /api/*                           -> NEVER cached (incident data is live),
 *                                         and never intercepted for POST/PUT/PATCH/DELETE
 *   - the offline queue reads/writes IndexedDB from the page, not from here
 *
 * Registered from src/components/pwa/PwaRuntime.tsx as '/sw.js'. It lives in
 * public/ rather than the bundle so it keeps a stable, unhashed URL — the
 * browser compares SW bytes by URL to decide an update happened, and a hashed
 * path would re-register a "new" worker on every deploy while also falling
 * outside '/' scope (which would need a Service-Worker-Allowed header).
 */

const VERSION = 'agapai-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/** Grace period: how long previous-version caches survive after activation. */
const OLD_CACHE_GRACE_MS = 30_000;

/** App-shell navigations worth serving when the network is gone. */
const SHELL_URLS = [
  '/',
  '/dispatcher',
  '/responder',
  '/analytics',
  '/offline',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll fails the whole install if any single URL 404s, so add individually
      // and tolerate failures (e.g. /offline not present in every build).
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Take over clients and enable navigation preload straight away so the
      // new version is fully live from the first request after activation.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();

      // Previous-version caches are deliberately NOT deleted here. This worker
      // activated via skipWaiting() while pages are still running the previous
      // build; wiping their caches synchronously would strand any tab that goes
      // offline right after a deploy (its lazy-loaded chunks live in those
      // caches). Defer the cleanup for a bounded grace window instead — the new
      // version's caches are already populated during `install`, so nothing
      // below delays the update itself.
      await new Promise((resolve) => setTimeout(resolve, OLD_CACHE_GRACE_MS));
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key))
      );
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const isApiRequest = (url) => url.pathname.startsWith('/api/');
const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname === '/manifest.webmanifest' ||
  /\.(?:png|jpg|jpeg|svg|webp|woff2?|ico)$/i.test(url.pathname);

/** GET-only, same-origin, non-API requests we are willing to serve from cache. */
const isCacheableRead = (request, url) =>
  request.method === 'GET' &&
  url.origin === self.location.origin &&
  !isApiRequest(url);

/**
 * App Router data fetches: RSC payloads for client-side navigations plus
 * router prefetches. Next sets the `rsc` header (and prefetch headers) on every
 * such fetch and always appends a cache-busting `_rsc` query param — see
 * node_modules/next/dist/client/components/app-router-headers.js.
 */
const isRscRequest = (request, url) =>
  request.headers.has('rsc') ||
  request.headers.has('next-router-prefetch') ||
  request.headers.has('next-router-segment-prefetch') ||
  url.searchParams.has('_rsc');

/**
 * Only a pristine same-origin success may replace a cached entry: a transient
 * 500/404 must never overwrite the precached shell, because offline
 * navigations check the cache first and would then get the error page. Note
 * that same-origin network responses are type 'basic' (never 'default'), and a
 * redirected response can describe a different final URL than the key.
 */
const isStorable = (response) =>
  !!response && response.ok && response.type === 'basic' && !response.redirected;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Live incident data must never be served stale, and mutating calls must
  // always reach the network untouched.
  if (isApiRequest(url) || request.method !== 'GET') return;

  // Page navigations: network first (fast when up), shell fallback when down.
  if (request.mode === 'navigate') {
    // A rejected preloadResponse must not take the offline path while the
    // network is still fine — swallow it and fall through to a normal fetch.
    const preload = Promise.resolve(event.preloadResponse).catch(() => null);
    const network = preload.then((response) => response || fetch(request));

    // respondWith + waitUntil are both registered synchronously here (calling
    // waitUntil from inside an async continuation is not allowed). The
    // background cache write is chained into waitUntil so it is kept alive for
    // the lifetime of this event instead of floating.
    event.respondWith(
      network.catch(async () => {
        const cached =
          (await caches.match(request)) ||
          (await caches.match('/')) ||
          (await caches.match('/offline'));
        if (cached) return cached;
        return new Response(
          '<!doctype html><html lang="en"><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>AgapAI — Offline</title><body style="margin:0;background:#0A0A0D;color:#FAFAFA;' +
            "font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;text-align:center;padding:24px\">" +
            '<div><h1 style="font-size:20px;margin:0 0 8px">No connection</h1>' +
            '<p style="color:#A1A1AA;font-size:14px;margin:0">' +
            'AgapAI could not reach the network. Emergency reports you send now are queued and will transmit automatically when signal returns.</p>' +
            '</div></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );

    event.waitUntil(
      network
        .then((response) => {
          // Cache only pristine responses (see isStorable) so a flaky 500/404
          // can never replace the precached shell.
          if (!isStorable(response)) return null;
          const copy = response.clone();
          return caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => null);
        })
        .catch(() => null)
    );
    return;
  }

  // Build assets and icons: cache first, refresh in the background.
  if (isStaticAsset(url) && isCacheableRead(request, url)) {
    const cache = caches.open(ASSET_CACHE);
    const cached = cache.then((store) => store.match(request));
    const network = fetch(request);

    // Background revalidation write, tied to this event's lifetime.
    event.waitUntil(
      Promise.all([cache, network])
        .then(([store, response]) => {
          if (!response || !response.ok) return null;
          const copy = response.clone();
          return store.put(request, copy);
        })
        .catch(() => null)
    );

    event.respondWith(
      (async () => {
        const hit = await cached;
        if (hit) return hit;
        const fromNetwork = await network.catch(() => null);
        if (fromNetwork) return fromNetwork;
        // Offline and not in this version's cache: fall back to *any* cache,
        // so tabs still running the previous build can load their old hashed
        // chunks during the grace window before those caches are purged.
        const stale = await caches.match(request);
        return stale || Response.error();
      })()
    );
    return;
  }

  // App Router RSC data/prefetch: network first, exactly like a navigation.
  // Answering these stale-while-revalidate would render soft navigations from
  // cache while online, replay payloads generated under a different
  // Next-Router-State-Tree, and let a cached success report "online" over a
  // dead link. Cache only as an offline fallback.
  if (isCacheableRead(request, url) && isRscRequest(request, url)) {
    const network = fetch(request);

    event.respondWith(
      network.catch(async () => {
        const cached = await caches.match(request);
        // No cached payload: fail the request so the router sees a real
        // network error instead of a fabricated success.
        return cached || Response.error();
      })
    );

    event.waitUntil(
      network
        .then((response) => {
          if (!isStorable(response)) return null;
          // Only store entries keyed by `_rsc` so a payload can never be
          // written over a precached HTML shell at the bare path.
          if (!url.searchParams.has('_rsc')) return null;
          const copy = response.clone();
          return caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => null);
        })
        .catch(() => null)
    );
    return;
  }

  // Everything else same-origin GET: stale-while-revalidate.
  if (isCacheableRead(request, url)) {
    const cache = caches.open(SHELL_CACHE);
    const cached = cache.then((store) => store.match(request));
    const network = fetch(request);

    // Background revalidation write, tied to this event's lifetime.
    event.waitUntil(
      Promise.all([cache, network])
        .then(([store, response]) => {
          if (!response || !response.ok) return null;
          const copy = response.clone();
          return store.put(request, copy);
        })
        .catch(() => null)
    );

    event.respondWith(
      (async () => {
        const hit = await cached;
        if (hit) return hit;
        return (await network.catch(() => null)) || Response.error();
      })()
    );
  }
});
