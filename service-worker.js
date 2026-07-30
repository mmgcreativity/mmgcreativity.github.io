/* service-worker.js — MMG Creativity PWA
 * PWA install desteği + HIZLI açılış için statik dosya önbelleği.
 *
 * Strateji: stale-while-revalidate (yalnızca KENDİ origin'imizdeki GET istekleri için).
 *  - Önbellekte varsa ANINDA döner (modüller hızlı açılır), arka planda ağdan tazelenir.
 *  - Yeni deploy'da SW_VERSION değişir → yeni cache adı → eski cache silinir → kullanıcı
 *    ilk açılışta güncel kodu çeker. Böylece hız + tazelik birlikte sağlanır.
 *  - Cross-origin (Firestore/Firebase/CDN) ve non-GET istekler DOKUNULMAZ (doğrudan ağ).
 *    Kullanıcı verisi runtime'da Firestore'dan geldiği için önbellek onu bayatlatmaz.
 *
 * FCM için AYRI bir firebase-messaging-service-worker.js gerekir; bu dosya onun yerini tutmaz.
 */

const SW_VERSION = '2026-07-30-mobil-firma-popup-inline';
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
  // Yalnızca kendi origin'imizin statik dosyalarını önbelleğe al.
  if (url.origin !== self.location.origin) return; // cross-origin → tarayıcı/ağ yönetir
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const networkPromise = fetch(req).then((res) => {
      // Yalnızca başarılı, aynı-origin (basic) yanıtları önbelleğe yaz.
      if (res && res.status === 200 && res.type === 'basic') {
        try { cache.put(req, res.clone()); } catch (e) {}
      }
      return res;
    }).catch(() => null);
    // Önbellekte varsa anında ver (arka planda güncellenir); yoksa ağdan bekle.
    if (cached) { networkPromise; return cached; }
    const net = await networkPromise;
    return net || fetch(req);
  })());
});
