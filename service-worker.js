/* service-worker.js — MMG Creativity PWA
 * Amaç: "Ana Ekrana Ekle" (PWA install) desteği için gereken minimal service worker.
 *
 * Tasarım kararı: AGRESİF CACHE YOK. İçerik sürekli güncellendiği (finans verisi, sürüm
 * çıkışları) için burada dosya önbelleğe alınmaz — bayat/eski içerik riski önlenir. Chrome'un
 * installability şartı yalnızca bir "fetch" dinleyicisidir; bu yüzden istekler doğrudan ağa
 * geçirilir (network passthrough) ve ağ yoksa (offline) önbellekte varsa geri dönülür.
 *
 * İleride (#16 mobil push / offline destek) genişletilebilir. FCM için AYRI bir
 * firebase-messaging-service-worker.js dosyası gerekir; bu dosya onun yerini tutmaz.
 */

const SW_VERSION = '2026-07-29-login-iban-fix';

// Yeni sürüm yayınlanınca hemen devreye girsin (bekleyen SW'yi atla).
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Aktivasyonda eski önbellekleri temizle ve açık sekmelerin kontrolünü hemen al.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Ağ öncelikli: her istek doğrudan ağa gider; ağ başarısız olursa (offline) önbellekte
// varsa ondan yanıt ver. Önbelleğe yazma yapılmadığı için normalde eşleşme bulunmaz —
// bu bilinçli bir tercih (bayat içerik yok).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
