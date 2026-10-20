/* StudyMind — Service Worker (عمل دون اتصال) */
'use strict';
const VERSION = 'studymind-v1.1.0';
const SHELL = [
  './', 'index.html', 'style.css', 'core.js', 'i18n.js', 'study.js', 'app.js', 'manifest.json',
  'logo.png', 'logo-dark.png', 'logo-mark.png', 'logo-mark-dark.png', 'body.png', 'cap.png', 'cap-dark.png',
  'wordmark.png', 'wordmark-dark.png', 'tagline.png', 'tagline-dark.png', 'favicon.png', 'apple-touch-icon.png',
  'icon-192.png', 'google.png', 'icon-512.png', 'icon-maskable-512.png', 'og-image.png', 'share-qr.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { })));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // لا نخزّن طلبات الخادم/الذكاء الاصطناعي
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(VERSION); c.put('index.html', fresh.clone()).catch(() => { });
        return fresh;
      } catch (err) {
        return (await caches.match('index.html')) || (await caches.match('./')) || new Response('offline', { status: 503 });
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const net = fetch(req).then(async r => {
      if (r && r.ok) { const c = await caches.open(VERSION); c.put(req, r.clone()).catch(() => { }); }
      return r;
    }).catch(() => null);
    return cached || (await net) || new Response('', { status: 504 });
  })());
});
