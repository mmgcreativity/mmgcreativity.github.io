# DEVİR NOTU — Dijital Finans Asistanı (mmgcreativity.com)

Son güncelleme: 2026-07-28 · Canlı sürüm: **app-version.json = 2026-07-28-44** (sırada 45)

---

## 1) PROJE & ALTYAPI
- **Site:** https://mmgcreativity.com  (GitHub Pages özel domain)
- **Repo:** https://github.com/mmgcreativity/mmgcreativity.github.io  (branch: `main`)
- **Çalışma klasörü (yerel):** `C:\Users\CihanFinans\OneDrive\0.mmgcreativity\web\html`
- **Firebase projesi:** `mmgcreativity-31263` (Blaze planı açık) — Firestore + Auth + Functions + FCM push
- **Frontend:** düz HTML/JS (build yok). Ortak parçalar: `mmg-chat-widget.js` (sohbet), `mmg-undo.js` (Geri Al/Ctrl+Z), `i18n-core.js` (TR/EN).

## 2) DEPLOY AKIŞI (web/site)
1. Dosyayı yerel klasörde düzenle.
2. https://github.com/mmgcreativity/mmgcreativity.github.io/upload/main aç → değişen dosyaları seç (birden fazla olabilir).
3. **"Commit changes"** (Doğrudan `main`'e).
4. **`app-version.json`** içindeki sürümü her deploy'da artır (ör. `2026-07-28-45`) — uygulamanın "güncelleme var, yenile" mantığı buna bakar.
- GitHub Pages CDN'i her commit'te kendi kendine tazeler; kullanıcı tarafında **Ctrl+F5** ile kesin tazelenir.

## 3) FIREBASE DEPLOY (SENİN BİLGİSAYARINDAN — GitHub'a yüklemek YETMEZ)
Proje klasöründe (firebase.json'ın olduğu yer) PowerShell:
```
firebase deploy --only firestore:rules     # YAPILDI (28 Tem) — sohbet silme, bildirim, konsolide okuma
firebase deploy --only functions           # BEKLIYOR — push bildirimi, hesap değiştirme token'ı, Resend şifre maili
```
- `firestore.rules` ve `functions/index.js` yerel klasörde günceldir; sadece yukarıdaki komutlarla Firebase'e gider.
- **functions deploy edilene kadar:** kapalı-uygulama push bildirimi, hesap değiştirme (accountSwitchToken/accountLinkConfirm/accountUnlink), markalı şifre sıfırlama maili ÇALIŞMAZ.

## 4) BU OTURUMDA CANLIYA ALINANLAR (özet)
- **KRİTİK FIX:** `mmg-chat-widget.js` içinde eksik bir `}` (wireUp fonksiyonu) tüm sohbet widget'ını kırıyordu → düzeltildi. Chat, bildirim, dürtme, istekler artık çalışır durumda.
- Chat: İstek sekmesi Gelen/Gönderilen alt başlıkları; "Geri Çek"; "+ Kişi Ekle" artık İstek→Gönderilen altında; dışarı tıklayınca kapanma (iframe blur ile); gönderdiğim istekleri iptal.
- Hesap değiştirme (çoklu hesap): index.html'de "Hesaplarım" — admin girip kendi diğer hesaplarına şifresiz geçiş; Google ile bağla + şifremi unuttum; listede **#kod · ad** (kod önce). *Backend functions deploy şart.*
- Talimat: gönderen IBAN otomatik (firma+banka → tek IBAN otomatik, çok IBAN'da ALTA açılır seçim); göndericilerde sadece grup firmaları; aynı adla ikinci kayıt engeli; logo/kaşe düzeni; önizleme 3× netlik.
- Hazır Metin: "+ Hazır Metin Talimatı Ekle" + var olandan kopyalama; **Kredi Kartı Taahhütnamesi** şablonu (Excel'den).
- **Yeni sayfa:** `Taksitli_Kredi_Hesaplama.html` (Excel ile birebir doğrulanmış; Excel/PDF çıktı, Sıfırla/Geri Al). index.html kısayol açıklaması `sc_desc_taksitli` (i18n metni eklenmeli).
- Vadeli Mevduat: banka açılır liste + adil (net getiriye göre) yan-yana kutu karşılaştırma + Excel/PDF çıktı (PDF Türkçe font eklendi).
- Kredi Karşılaştırma: sonuçlar yan yana kutu; varsayılan **100.000 tutar + 12 ay**.
- Rotatif: çoklu çekim tablosu + Sıfırla/Geri Al; tekli Sıfırla çokluyu etkilemiyor; İki-tarih bölümü Gelişmiş'ten çıkıp kartın altında, iki tarih de bugün; satırlar **100.000** varsayılan.
- Nakit Akış: konsolide canlı veri (girilen anında yansıyor); Konsolide butonu araç çubuğunda; mobil düzeltme.
- İstatistikler: kullanıcı tablosunda sütun-bazlı arama; uygulama kırılımında kişiye tıklayınca giriş zamanları (ileriye dönük kaydediliyor).
- Geri Al/Ctrl+Z: veri-giriş sayfalarında (`mmg-undo.js`) — Talimat, Vade Sapma, Vadeli dahil.
- Masaüstü: kart sürükleme (pointer), "Ekle" kutusu sadece kart kalmayınca; firma popup dışarı-tıkla kapanma.
- Forum: yazar avatarında logo (geniş fallback). Profil: logo fallback genişletildi.

## 5) BEKLEYEN / YAPILMAYAN İŞLER
1. **Konsolide Nakit Akış** — kullanıcı özel istedi: tek gün değil, **serbest tarih aralığında GÜN GÜN** her firma gelir/gider/net + genel toplam. (Spec kullanıcıdan netleşecek.) **YAPILMADI.**
2. **Hikâyeler (Story)** — profil Faz 2: 24s hikaye yükleme + süre dolumu + görüntüleyici. Şu an "Yakında" stub. **YAPILMADI.**
3. **Masaüstü özelleştirilebilir arka plan** — düz renk / hazır şablon / kendi resmini yükleme. **YAPILMADI.**
4. **Beğeniler gelmiyor** (`Begen_Istatistikleri.html`) — 50 beğeni var ama 1 görünüyor. Dosya yerelde senkronsuzdu (OneDrive cloud-only). Muhtemelen `collectionGroup` okuma kuralı engelliyordu; **firestore:rules deploy sonrası yenileyip kontrol et** — düzelmemişse sorguya/indekse bak.
5. **Bildirim/dürtme teslimi** — kod+kurallar hazır; **iki taraf da Ctrl+F5 sonrası, YENİ bir koda istek/mesaj** ile test et (zaten bekleyen istek yeni bildirim üretmez). Kapalı-uygulama push için functions deploy şart.
6. Küçük: index.html'de `sc_desc_taksitli` i18n metni (Taksitli kart açıklaması) eklenebilir.

## 6) ÖNEMLİ TEKNİK DERSLER (tekrar hata yapmamak için)
- **ES module dosyalarını (`mmg-chat-widget.js` vb.) mutlaka MODÜL olarak doğrula:** `cp x.js /tmp/x.mjs && node --check /tmp/x.mjs`. Düz `node --check x.js` eksik `}` gibi hataları MASKELEYEBİLİYOR (bu bir kez tüm chat'i kırdı). Inline HTML scriptlerinde de import satırlarını temizleyip `.mjs` modül denetimi yap.
- **Sayfa genişliği per-page'dir** — global `max-width` değiştirme. Kart/ızgara sayfaları geniş (1400–1500px), form/hesap sayfaları dar (~1180px) daha iyi.
- Sohbet widget'ı her sayfada `<script type="module" src="mmg-chat-widget.js"></script>` ile en altta; kendi Firebase'ini kurar (getApps kontrolü).
- Firebase config (client): apiKey `AIzaSyCWzcRqmwhIBqjnYqyMoIrO8zj2p8oj5kU`, projectId `mmgcreativity-31263`, messagingSenderId `243143536600`.
- Cloud Functions callable'lar (us-central1): `accountLinkConfirm`, `accountSwitchToken`, `accountUnlink`, `firmaSetSeats/…`, `sendPasswordResetMail`, `publishToBlogger`, `pushOnNotification` (notifications create → FCM push).

## 7) HEMEN TEST EDİLECEKLER (yeniledikten sonra)
- [ ] Chat açılıyor mu (her sayfada baloncuk)
- [ ] Yeni koda istek → karşı tarafa bildirim (iki taraf da yenilenmiş)
- [ ] Sohbet silme çalışıyor mu
- [ ] Konsolide: ADERANS/CİHANTAŞ verileri geliyor mu
- [ ] Beğeniler listesi tam geliyor mu
- [ ] Vadeli PDF'te Türkçe karakter düzgün mü
