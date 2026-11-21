// Service worker: makes repeat visits load fast on phones (the model packs are ~20 MB).
// Pages, code and styles: network first, so updates always arrive; the cache is only an offline fallback.
// Model packs, GLB/images and the pinned three.js CDN files: served from cache, refreshed in the background.
// It never touches localStorage, so saves, autosave, backups and the multiple-tab guard are unaffected.
const CACHE = 'mykampung-v1';
const STATIC = /\/assets\/|cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\//;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url)) return;
  const sameOrigin = new URL(req.url).origin === location.origin;
  if (!sameOrigin && !STATIC.test(req.url)) return; // other hosts (e.g. a future backend) go straight to the network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const put = (res) => { if (res && res.ok) cache.put(req, res.clone()).catch(() => {}); return res; };
    if (STATIC.test(req.url)) {
      const hit = await cache.match(req);
      const fresh = fetch(req).then(put).catch(() => null);
      if (hit) { e.waitUntil(fresh); return hit; }
      return (await fresh) || Response.error();
    }
    try { return put(await fetch(req)); } catch { return (await cache.match(req)) || Response.error(); }
  })());
});
