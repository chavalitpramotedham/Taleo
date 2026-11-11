/* Taleo's service worker.
 *
 * What it does:
 *  - keeps the app's own unchanging files (scripts, styles, fonts, the
 *    site's paintings) on the device, so a repeat visit - above all a
 *    launch from the home-screen icon - paints without waiting on the
 *    network for them;
 *  - shows a small "you're offline" page instead of the browser's error
 *    when a page can't be reached.
 *
 * What it never touches: anything under /api (stories, sign-in, live
 * progress), anything that isn't a plain GET, other sites (story
 * pictures come from storage and keep their own browser caching), the
 * music (it streams in ranges), and the pages themselves - a page is
 * always fetched fresh, so nobody is ever shown someone else's or an
 * out-of-date bookshelf.
 */
const VERSION = "v3";
const SHELL = "taleo-shell-" + VERSION; // the offline page and its icon
const ASSETS = "taleo-assets-" + VERSION; // files that never change, or rarely
const OFFLINE = "/offline.html";
const MAX_ASSETS = 220;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll([new Request(OFFLINE, { cache: "reload" }), "/icon-192.png?v=2"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("taleo-") && n !== SHELL && n !== ASSETS).map((n) => caches.delete(n)));
      // Start fetching a page while the worker itself is still waking up.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

const keepable = (res) => res && res.status === 200 && res.type === "basic";

/** Old builds' files pile up otherwise: keep the newest, drop the rest. */
async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

async function store(request, res) {
  const cache = await caches.open(ASSETS);
  await cache.put(request, res);
  if (Math.random() < 0.1) await trim(cache);
}

/** Build files carry their contents in their name: once had, always good. */
async function cacheFirst(event) {
  const hit = await caches.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (keepable(res)) event.waitUntil(store(event.request, res.clone()).catch(() => {}));
  return res;
}

/** The site's own pictures keep their name when repainted: show the one
 *  on the device at once, and quietly fetch the latest for next time. */
async function staleWhileRevalidate(event) {
  const hit = await caches.match(event.request);
  const fresh = fetch(event.request).then((res) => {
    if (keepable(res)) return store(event.request, res.clone()).then(() => res, () => res);
    return res;
  });
  if (!hit) return fresh;
  event.waitUntil(fresh.catch(() => {}));
  return hit;
}

async function page(event) {
  try {
    const early = await event.preloadResponse;
    if (early) return early;
    return await fetch(event.request);
  } catch (err) {
    const offline = await caches.match(OFFLINE);
    if (offline) return offline;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/music/")) return;

  if (req.mode === "navigate") return event.respondWith(page(event));
  if (p.startsWith("/_next/static/")) return event.respondWith(cacheFirst(event));
  if (p.startsWith("/art/") || p.startsWith("/steps/") || p.startsWith("/about/") || /^\/(icon-\d+|apple-icon|icon)\.png$/.test(p)) {
    return event.respondWith(staleWhileRevalidate(event));
  }
});
