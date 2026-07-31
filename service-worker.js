/* service-worker.js — MMG Creativity PWA
 * PWA install desteği + GÜNCEL kod garantisi.
 *
 * ÖNEMLİ STRATEJİ DEĞİŞİKLİĞİ (kullanıcı şikâyeti: "deploy ettim ama değişiklik gelmiyor"):
 *  - HTML / JS / CSS / JSON (yani KOD): NETWORK-FIRST → her açılışta önce ağdan en güncel
 *    sürüm çekilir; yalnızca çevrimdışıysa cache'e düşülür. Böylece yeni deploy ANINDA gelir,
 *    kullanıcı bir daha "eski sürüm cache'te kaldı" sorunu yaşamaz.
 *  - Görsel / font / diğer statikler: stale-while-revalidate (hız için önbellekten, arkada tazelenir).
 *  - Cross-origin (Firestore/Firebase/CDN) ve non-GET istekler DOKUNULMAZ.
 *
 * SW_VERSION değişince yeni cache adı oluşur, eski cache silinir.
 * FCM için AYRI firebase-messaging-service-worker.js gerekir; bu dosya onun yerini tutmaz.
 */

const SW_VERSION = '2026-07-31-firma-kodu-kullanici-yonetimi';
const CACHE = 'mmg-' + SW_VERSION;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  // Yalnızca kendi origin'imizin dosyaları; cross-origin → tarayıcı/ağ yönetir.
  if (url.origin !== self.location.origin) return;

  // Sayfa (navigate) veya kod dosyaları mı? Bunlarda DAİMA güncel olmalıyız.
  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  const isCode = isDoc || /\.(html|js|css|json)$/i.test(url.pathname);

  if (isCode) {
    // NETWORK-FIRST: önce ağdan güncel sürüm; başarısızsa (çevrimdışı) cache.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const net = await fetch(req, { cache: 'no-store' });
        if (net && net.status === 200 && net.type === 'basic') {
          try { cache.put(req, net.clone()); } catch (e) {}
        }
        return net;
      } catch (e) {
        const cached = await cache.match(req);
        if (cached) return cached;
        // Navigasyon için son çare: köke düş.
        if (isDoc) {
          const root = await cache.match('index.html') || await cache.match('/');
          if (root) return root;
        }
        return Response.error();
      }
    })());
    return;
  }

  // Diğer statikler (görsel/font vb.): stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const networkPromise = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        try { cache.put(req, res.clone()); } catch (e) {}
      }
      return res;
    }).catch(() => null);
    if (cached) { networkPromise; return cached; }
    const net = await networkPromise;
    return net || fetch(req);
  })());
});
