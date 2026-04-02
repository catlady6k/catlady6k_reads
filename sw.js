/* Service Worker — Catlady6k's Reads
   Caches the app shell so it loads offline.
   Books still require a Supabase connection to sync. */

const CACHE = 'catlady6k-reads-v1';

/* Files that make up the app shell */
const APP_SHELL = [
  '/catlady6k_reads/',
  '/catlady6k_reads/index.html',
  '/catlady6k_reads/manifest.json',
  '/catlady6k_reads/stars.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@700;900&display=swap'
];

/* ── Install: pre-cache the app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: network-first for Supabase, cache-first for everything else ── */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  /* Always go straight to network for Supabase API calls */
  if (url.includes('supabase.co') || url.includes('googleapis.com/fonts/css')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  /* Cache-first for Google Fonts static files (woff2 etc.) */
  if (url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  /* App shell: cache-first, fall back to network, update cache in background */
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached); /* offline: serve whatever we have */

      return cached || networkFetch;
    })
  );
});
