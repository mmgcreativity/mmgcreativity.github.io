/* firebase-messaging-service-worker.js — MMG Creativity FCM arka plan push (#16)
 *
 * Uygulama KAPALIYKEN / sekme pasifken gelen push mesajlarını gösterir. Bu dosya, PWA
 * `service-worker.js`'den AYRIDIR ve yalnızca Firebase Cloud Messaging için çalışır.
 *
 * NOT: İstemcideki getToken(...) çağrısı bu dosyayı otomatik olarak FCM kapsamında kaydeder.
 * Push'un fiilen çalışması için index.html'deki MMG_VAPID_KEY doldurulmuş VE Cloud Function
 * (pushOnNotification) Blaze planında deploy edilmiş olmalıdır. Aksi halde bu SW sessizce
 * bekler; mevcut uygulama-içi çan/badge etkilenmez.
 */
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCWzcRqmwhIBqjnYqyMoIrO8zj2p8oj5kU",
  authDomain: "mmgcreativity-31263.firebaseapp.com",
  projectId: "mmgcreativity-31263",
  storageBucket: "mmgcreativity-31263.firebasestorage.app",
  messagingSenderId: "243143536600",
  appId: "1:243143536600:web:daa53a2614b42a2ccb8cad",
  measurementId: "G-X8HEZRNWWS"
});

const messaging = firebase.messaging();

// Arka plan mesajı: push data-only gönderildiği için bildirimi BURADA gösteriyoruz
// (çift bildirim olmasın diye Cloud Function `notification` değil `data` alanı yolluyor).
messaging.onBackgroundMessage((payload) => {
  const d = (payload && payload.data) || {};
  const title = d.title || 'MMG Creativity';
  self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.notifId || undefined,
    data: { url: '/index.html', type: d.type || '', notifId: d.notifId || '' }
  });
});

// Bildirime tıklanınca: açık bir sekme varsa öne getir, yoksa uygulamayı aç.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('/index.html');
  })());
});
