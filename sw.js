/* ============================================================
   CephasGM GameZone — Service Worker
   Strategy:
     • App shell + HTML pages  → Cache First, fallback to offline.html
     • Static assets (css/js)  → Stale-While-Revalidate
     • External CDN / fonts    → Cache First with runtime cache
     • API / non-GET           → Network only
   ============================================================ */

const VERSION    = 'cephasgm-v1.0.0';
const SHELL_CACHE = `${VERSION}-shell`;
const PAGE_CACHE  = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const CDN_CACHE   = `${VERSION}-cdn`;

/* ------------------------------------------------------------
   Precache list — app shell + all core pages.
   Uses addAllSettled semantics so a missing file doesn't break install.
   ------------------------------------------------------------ */
const PRECACHE_PAGES = [
  './',
  './index.html',
  './offline.html',

  /* Auth & account */
  './signin.html',
  './signup.html',
  './forgot-password.html',
  './dashboard.html',
  './profile.html',
  './wallet.html',
  './deposit.html',
  './withdraw.html',
  './transactions.html',
  './bet-history.html',
  './bonuses.html',
  './kyc.html',
  './settings.html',
  './leaderboard.html',

  /* Core sections */
  './sports.html',
  './live-betting.html',
  './casino.html',
  './promotions.html',

  /* Virtual games */
  './virtual-football.html',
  './virtual-horse-racing.html',
  './virtual-car-racing.html',
  './virtual-netball.html',
  './adventure-games.html',
  './aviator.html',

  /* Support & info */
  './support.html',
  './messages.html',
  './notifications.html',
  './faq.html',
  './contact.html',
  './responsible-gambling.html',
  './self-exclusion.html',
  './about.html',
  './vip.html',
  './referrals.html',
  './privacy.html',
  './terms.html',
  './cookies.html'
];

const PRECACHE_ASSETS = [
  './manifest.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

/* ============================================================
   INSTALL
   ============================================================ */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell  = await caches.open(SHELL_CACHE);
    const pages  = await caches.open(PAGE_CACHE);
    const assets = await caches.open(ASSET_CACHE);

    // Cache each item individually so one 404 doesn't kill the install
    await Promise.allSettled(
      PRECACHE_PAGES.map(url => pages.add(new Request(url, { cache: 'reload' })))
    );
    await Promise.allSettled(
      PRECACHE_ASSETS.map(url => assets.add(new Request(url, { cache: 'reload' })))
    );
    await shell.add(new Request('./offline.html', { cache: 'reload' }));

    // Activate immediately
    self.skipWaiting();
  })());
});

/* ============================================================
   ACTIVATE — clean old caches
   ============================================================ */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE, CDN_CACHE]);
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !keep.has(k)).map(k => caches.delete(k))
    );

    // Take control of existing clients immediately
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

/* ============================================================
   FETCH
   ============================================================ */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ignore chrome-extension and other non-http schemes
  if (!url.protocol.startsWith('http')) return;

  // --- HTML / navigation requests ---
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(handleNavigate(req));
    return;
  }

  // --- Same-origin static assets ---
  if (url.origin === self.location.origin) {
    // CSS, JS, images, fonts, etc.
    if (
      req.destination === 'style' ||
      req.destination === 'script' ||
      req.destination === 'image' ||
      req.destination === 'font'
    ) {
      event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
      return;
    }
  }

  // --- External CDN (Tailwind, Google Fonts, remote images) ---
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(req, CDN_CACHE));
    return;
  }

  // Fallback: try network, then cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

/* ============================================================
   HANDLERS
   ============================================================ */

/* Navigation requests — network first, cache fallback, then offline page */
async function handleNavigate(req) {
  const cache = await caches.open(PAGE_CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });

  try {
    // Try network (with a soft timeout so slow 3G doesn't hang)
    const fresh = await fetchWithTimeout(req, 5000);
    if (fresh && fresh.status === 200) {
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    }
    if (cached) return cached;
    return fresh;
  } catch (err) {
    // Offline → cached page or fallback
    if (cached) return cached;

    // Last resort: offline.html
    const offline = await caches.match('./offline.html');
    if (offline) return offline;

    return new Response(
      '<h1>Offline</h1><p>You are offline and this page is not cached.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/* Stale-While-Revalidate — serve cache, refresh in background */
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const networkPromise = fetch(req)
    .then(res => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);

  return cached || (await networkPromise) || new Response('', { status: 504 });
}

/* Cache-First — good for immutable CDN assets */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  if (cached) {
    // Refresh in the background (fire & forget)
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          cache.put(req, res.clone()).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const fresh = await fetch(req);
    if (fresh && (fresh.status === 200 || fresh.type === 'opaque')) {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    return new Response('', { status: 504 });
  }
}

/* Fetch with a timeout — prevents slow networks from hanging navigation */
function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

/* ============================================================
   MESSAGES (skipWaiting / clearCache from the page)
   ============================================================ */
self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }

  if (data.type === 'GET_VERSION') {
    event.source && event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});
